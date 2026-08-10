import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gekishin-series-game-reporting-'));
const databasePath = path.join(tempRoot, 'series.sqlite');
const port = 3157;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    DATABASE_PATH: databasePath,
    UPLOAD_PATH: path.join(tempRoot, 'uploads'),
    AUTH_SECRET: 'series-game-reporting-regression-secret-2026',
    ADMIN_USERNAME: 'series_admin',
    ADMIN_EMAIL: 'series-admin@test.local',
    ADMIN_PASSWORD: 'AdminSecure123!',
    ENABLE_DEV_TEST_CONSOLE: 'true',
    API_RATE_LIMIT_PER_MINUTE: '10000',
    REGISTER_RATE_LIMIT_MAX: '10000',
    LOGIN_FAILURE_LIMIT: '10000',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
let db = null;
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });

async function stopServer() {
  if (!child.killed) child.kill('SIGTERM');
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 1500);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  throw new Error(`Server did not start.\n${output}`);
}

async function request(url, { token, method = 'GET', body } = {}) {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) ? { 'X-CSRF-Token': '1' } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function accessCode(url) {
  return new URLSearchParams(new URL(url, base).hash.slice(1)).get('code');
}

async function tokenFromAccessUrl(url) {
  const exchanged = await request('/api/dev-test/access/exchange', {
    method: 'POST',
    body: { code: accessCode(url) },
  });
  assert.equal(exchanged.response.status, 200, JSON.stringify(exchanged.payload));
  return exchanged.payload.token;
}

function setDraftComplete(db, matchId, gameNumber, { bansA = [], bansB = [] } = {}) {
  const room = db.prepare('SELECT id,state_json FROM draft_rooms WHERE match_id=?').get(matchId);
  assert.ok(room, 'Draft room must exist.');
  const state = {
    status: 'active',
    gameNumber,
    engine: {
      state: 'complete',
      teamA: { picks: ['0001', '0002', '0003', '0004'], bans: bansA },
      teamB: { picks: ['0005', '0006', '0007', '0008'], bans: bansB },
    },
    chosenDivineRules: [],
    preDraft: { sideAssignment: { A: 'teamA', B: 'teamB' } },
  };
  db.prepare("UPDATE draft_rooms SET state_json=?,status='active',updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(JSON.stringify(state), room.id);
  db.prepare("UPDATE match_games SET status='draft_complete',updated_at=CURRENT_TIMESTAMP WHERE match_id=? AND game_number=?")
    .run(matchId, gameNumber);
}

try {
  await waitForServer();

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { identity: 'series_admin', password: 'AdminSecure123!' },
  });
  assert.equal(adminLogin.response.status, 200);
  const adminToken = adminLogin.payload.token;

  const created = await request('/api/dev-test/suites', { token: adminToken, method: 'POST' });
  assert.equal(created.response.status, 201, JSON.stringify(created.payload));
  const suite = created.payload.suite;
  const live = suite.tournaments.find(item => item.scenario === 'live');
  assert.ok(live, 'Live test tournament is required.');

  const hostPersona = suite.users.find(item => item.persona === 'host');
  const hostToken = await tokenFromAccessUrl(hostPersona.accessUrl);
  const tournament = await request(`/api/tournaments/${live.id}`, { token: hostToken });
  assert.equal(tournament.response.status, 200);
  const match = tournament.payload.matches.find(item => item.team_a_id && item.team_b_id && item.result_status !== 'final');
  assert.ok(match, 'Playable match is required.');

  db = new DatabaseSync(databasePath);
  const teamA = db.prepare('SELECT captain_user_id FROM teams WHERE id=?').get(match.team_a_id);
  const teamB = db.prepare('SELECT captain_user_id FROM teams WHERE id=?').get(match.team_b_id);
  const captainAPersona = suite.users.find(item => Number(item.id) === Number(teamA.captain_user_id));
  const captainBPersona = suite.users.find(item => Number(item.id) === Number(teamB.captain_user_id));
  assert.ok(captainAPersona && captainBPersona, 'Both match Captains must be in the test suite.');
  const captainAToken = await tokenFromAccessUrl(captainAPersona.accessUrl);
  const captainBToken = await tokenFromAccessUrl(captainBPersona.accessUrl);

  db.prepare("UPDATE matches SET series_rule='squadra_blast' WHERE id=?").run(match.id);
  const initialRoom = db.prepare('SELECT id,config_json FROM draft_rooms WHERE match_id=?').get(match.id);
  const initialConfig = JSON.parse(initialRoom.config_json);
  initialConfig.seriesRule = 'squadra_blast';
  initialConfig.heroBans = 1;
  initialConfig.squadraBlastCarryBans = false;
  db.prepare('UPDATE draft_rooms SET config_json=? WHERE id=?').run(JSON.stringify(initialConfig), initialRoom.id);

  setDraftComplete(db, match.id, 1, { bansA: ['0009'], bansB: ['0010'] });

  const blockedWholeSeries = await request(`/api/matches/${match.id}/results/submit`, {
    token: captainAToken,
    method: 'POST',
    body: { scoreA: 2, scoreB: 0 },
  });
  assert.equal(blockedWholeSeries.response.status, 409);
  assert.match(blockedWholeSeries.payload.error, /current game|full BO/i);

  const reportGame1 = await request(`/api/matches/${match.id}/games/current/report`, {
    token: captainAToken,
    method: 'POST',
    body: { winnerSide: 'A' },
  });
  assert.equal(reportGame1.response.status, 200, JSON.stringify(reportGame1.payload));
  assert.equal(reportGame1.payload.game.result_status, 'awaiting_confirmation');

  const selfConfirm = await request(`/api/matches/${match.id}/games/current/confirm`, {
    token: captainAToken,
    method: 'POST',
    body: { decision: 'confirm' },
  });
  assert.equal(selfConfirm.response.status, 403);

  const hostOverrideBlocked = await request(`/api/matches/${match.id}/draft-room/game-result`, {
    token: hostToken,
    method: 'POST',
    body: { winnerSide: 'A' },
  });
  assert.equal(hostOverrideBlocked.response.status, 403, 'A normal Host must not operate per-game winners.');

  const confirmGame1 = await request(`/api/matches/${match.id}/games/current/confirm`, {
    token: captainBToken,
    method: 'POST',
    body: { decision: 'confirm' },
  });
  assert.equal(confirmGame1.response.status, 200, JSON.stringify(confirmGame1.payload));
  assert.equal(confirmGame1.payload.seriesComplete, false);
  assert.equal(confirmGame1.payload.nextGameNumber, 2);
  assert.equal(confirmGame1.payload.scoreA, 1);
  assert.equal(confirmGame1.payload.scoreB, 0);
  assert.equal(confirmGame1.payload.room.links, undefined, 'Captain confirmation must not expose every Draft Room capability link.');
  assert.match(confirmGame1.payload.nextDraftUrl, /\/draft-room\.html#room=/);
  const nextGameUrl = new URL(confirmGame1.payload.nextDraftUrl);
  const nextGameAccess = new URLSearchParams(nextGameUrl.hash.slice(1));
  const nextGameExchange = await request(`/api/public/draft-rooms/${nextGameAccess.get('room')}/access`, {
    token: captainBToken,
    method: 'POST',
    body: { accessToken: nextGameAccess.get('access') },
  });
  assert.equal(nextGameExchange.response.status, 200, JSON.stringify(nextGameExchange.payload));
  assert.equal(nextGameExchange.payload.room.role, 'teamB');
  assert.equal(nextGameExchange.payload.room.config.gameNumber, 2);
  assert.equal(nextGameExchange.payload.room.config.seriesRule, 'squadra_blast');
  assert.equal(nextGameExchange.payload.room.config.squadraBlastCarryBans, false);
  assert.deepEqual(nextGameExchange.payload.room.config.previousPicksA, ['0001', '0002', '0003', '0004']);
  assert.deepEqual(nextGameExchange.payload.room.config.previousPicksB, ['0005', '0006', '0007', '0008']);
  assert.deepEqual(nextGameExchange.payload.room.config.previousBansA, []);
  assert.deepEqual(nextGameExchange.payload.room.config.previousBansB, []);

  setDraftComplete(db, match.id, 2);
  const reportGame2 = await request(`/api/matches/${match.id}/games/current/report`, {
    token: captainBToken,
    method: 'POST',
    body: { winnerSide: 'B' },
  });
  assert.equal(reportGame2.response.status, 200);
  const confirmGame2 = await request(`/api/matches/${match.id}/games/current/confirm`, {
    token: captainAToken,
    method: 'POST',
    body: { decision: 'confirm' },
  });
  assert.equal(confirmGame2.response.status, 200, JSON.stringify(confirmGame2.payload));
  assert.equal(confirmGame2.payload.nextGameNumber, 3);
  assert.equal(confirmGame2.payload.scoreA, 1);
  assert.equal(confirmGame2.payload.scoreB, 1);
  const game3Url = new URL(confirmGame2.payload.nextDraftUrl);
  const game3Access = new URLSearchParams(game3Url.hash.slice(1));
  const game3Exchange = await request(`/api/public/draft-rooms/${game3Access.get('room')}/access`, {
    token: captainAToken,
    method: 'POST',
    body: { accessToken: game3Access.get('access') },
  });
  assert.equal(game3Exchange.response.status, 200, JSON.stringify(game3Exchange.payload));
  assert.equal(game3Exchange.payload.room.config.gameNumber, 3);
  assert.deepEqual(game3Exchange.payload.room.config.previousPicksA, []);
  assert.deepEqual(game3Exchange.payload.room.config.previousPicksB, []);
  assert.deepEqual(game3Exchange.payload.room.config.previousBansA, []);
  assert.deepEqual(game3Exchange.payload.room.config.previousBansB, []);

  setDraftComplete(db, match.id, 3);
  const reportGame3 = await request(`/api/matches/${match.id}/games/current/report`, {
    token: captainAToken,
    method: 'POST',
    body: { winnerSide: 'A' },
  });
  assert.equal(reportGame3.response.status, 200);
  const confirmGame3 = await request(`/api/matches/${match.id}/games/current/confirm`, {
    token: captainBToken,
    method: 'POST',
    body: { decision: 'confirm' },
  });
  assert.equal(confirmGame3.response.status, 200, JSON.stringify(confirmGame3.payload));
  assert.equal(confirmGame3.payload.seriesComplete, true);
  assert.equal(confirmGame3.payload.final, true);
  assert.equal(confirmGame3.payload.nextDraftUrl, undefined);
  assert.equal(confirmGame3.payload.scoreA, 2);
  assert.equal(confirmGame3.payload.scoreB, 1);

  const finalMatch = db.prepare('SELECT * FROM matches WHERE id=?').get(match.id);
  assert.equal(finalMatch.result_status, 'final');
  assert.equal(finalMatch.score_a, 2);
  assert.equal(finalMatch.score_b, 1);
  assert.equal(Number(finalMatch.winner_team_id), Number(match.team_a_id));
  const games = db.prepare('SELECT game_number,status,result_status,winner_team_id FROM match_games WHERE match_id=? ORDER BY game_number').all(match.id);
  assert.deepEqual(games.map(item => item.status), ['completed', 'completed', 'completed']);
  assert.deepEqual(games.map(item => item.result_status), ['confirmed', 'confirmed', 'confirmed']);

  db.close();
  db = null;

  const dashboardSource = fs.readFileSync(path.join(root, 'js', 'dashboard.js'), 'utf8');
  const portalSource = fs.readFileSync(path.join(root, 'js', 'portal.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css', 'dashboard.css'), 'utf8');
  assert.doesNotMatch(dashboardSource, /\['team_a','team_b','host','referee'\]/, 'Host and Referee Ready buttons must be removed.');
  assert.match(portalSource, /games\/current\/report/);
  assert.match(portalSource, /games\/current\/confirm/);
  assert.match(css, /width:min\(1760px,calc\(100vw - 24px\)\)/);
  assert.match(css, /portal-settings-grid[\s\S]*grid-template-areas/);

  console.log('Game-by-game Captain reporting, automatic series finalization, readiness cleanup and wide layout checks passed.');
} finally {
  try { db?.close(); } catch {}
  await stopServer();
}

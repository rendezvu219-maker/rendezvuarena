import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const { io } = require('socket.io-client');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rendezvu-draft-series-'));
const databasePath = path.join(tempRoot, 'series.sqlite');
const port = 3164;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    DATABASE_PATH: databasePath,
    UPLOAD_PATH: path.join(tempRoot, 'uploads'),
    AUTH_SECRET: 'draft-series-persistence-secret-2026',
    ADMIN_USERNAME: 'series_persistence_admin',
    ADMIN_EMAIL: 'series-persistence-admin@test.local',
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
const sockets = [];
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });

const SERIES = {
  normal: [
    { picksA: ['0001', '0002', '0003', '0004'], picksB: ['0005', '0006', '0007', '0008'], bansA: ['0009'], bansB: ['0010'] },
    { picksA: ['0001', '0002', '0003', '0004'], picksB: ['0005', '0006', '0007', '0008'], bansA: ['0011'], bansB: ['0012'] },
    { picksA: ['0001', '0002', '0003', '0004'], picksB: ['0005', '0006', '0007', '0008'], bansA: ['0013'], bansB: ['0014'] },
  ],
  fearless: [
    { picksA: ['0001', '0002', '0003', '0004'], picksB: ['0005', '0006', '0007', '0008'], bansA: ['0009'], bansB: ['0010'] },
    { picksA: ['0011', '0012', '0013', '0014'], picksB: ['0015', '0016', '0017', '0018'], bansA: ['0019'], bansB: ['0020'] },
    { picksA: ['0021', '0022', '0023', '0024'], picksB: ['0025', '0026', '0027', '0028'], bansA: ['0029'], bansB: ['0030'] },
  ],
  team_no_repeat: [
    { picksA: ['0001', '0002', '0003', '0004'], picksB: ['0005', '0006', '0007', '0008'], bansA: ['0009'], bansB: ['0010'] },
    { picksA: ['0005', '0006', '0007', '0008'], picksB: ['0001', '0002', '0003', '0004'], bansA: ['0011'], bansB: ['0012'] },
    { picksA: ['0013', '0014', '0015', '0016'], picksB: ['0017', '0018', '0019', '0020'], bansA: ['0021'], bansB: ['0022'] },
  ],
  squadra_blast: [
    { picksA: ['0001', '0002', '0003', '0004'], picksB: ['0005', '0006', '0007', '0008'], bansA: ['0009'], bansB: ['0010'] },
    { picksA: ['0011', '0012', '0013', '0014'], picksB: ['0015', '0016', '0017', '0018'], bansA: ['0009'], bansB: ['0010'] },
    { picksA: ['0001', '0002', '0003', '0004'], picksB: ['0005', '0006', '0007', '0008'], bansA: ['0019'], bansB: ['0020'] },
  ],
};

async function request(url, { token, method = 'GET', body, allowError = false } = {}) {
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
  if (!response.ok && !allowError) throw new Error(`${method} ${url}: ${payload.error || response.status}`);
  return { response, payload };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  throw new Error(`Draft series server did not start.\n${output}`);
}

function accessValue(url, key) {
  return new URLSearchParams(new URL(url, base).hash.slice(1)).get(key);
}

async function tokenFromAccessUrl(url) {
  const exchanged = await request('/api/dev-test/access/exchange', {
    method: 'POST', body: { code: accessValue(url, 'code') },
  });
  return exchanged.payload.token;
}

async function connectDraftRole(roomCode, accessToken, accountToken) {
  const exchange = await request(`/api/public/draft-rooms/${roomCode}/access`, {
    token: accountToken, method: 'POST', body: { accessToken },
  });
  return new Promise((resolve, reject) => {
    const socket = io(base, {
      transports: ['websocket'],
      auth: { draftTicket: exchange.payload.socketTicket },
    });
    sockets.push(socket);
    socket.once('connect_error', reject);
    socket.once('connect', () => socket.emit('draft:join', { roomCode }, result => {
      if (!result?.ok) return reject(new Error(result?.error || 'Draft join failed.'));
      resolve({ socket, result });
    }));
  });
}

function waitForEvent(socket, event, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}.`)), timeout);
    socket.once(event, payload => { clearTimeout(timer); resolve(payload); });
  });
}

async function waitUntil(predicate, message, timeout = 4000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = predicate();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  throw new Error(message);
}

function createMatch(tournamentId, teamAId, teamBId, rule, index, captainAId, captainBId) {
  const result = db.prepare(`INSERT INTO matches(
      tournament_id,bracket_type,bracket_side,stage,round_no,round_name,position,
      team_a_id,team_b_id,best_of,series_rule,current_game_number,status,match_status,result_status
    ) VALUES (?,'single','winners',?,1,?,1,?,?,3,?,1,'available','available','none')`)
    .run(tournamentId, `phase2_${index}_${rule}`, `Phase 2 ${rule}`, teamAId, teamBId, rule);
  const matchId = Number(result.lastInsertRowid);
  db.prepare(`INSERT INTO match_checkins(match_id,actor_type,actor_id,status,checked_in_by)
      VALUES (?,'team',?,'ready',?),(?,'team',?,'ready',?)`)
    .run(matchId, teamAId, captainAId, matchId, teamBId, captainBId);
  return matchId;
}

function draftState(rule, gameNumber, selections) {
  return {
    status: 'active',
    gameNumber,
    seriesRule: rule,
    engine: {
      state: 'complete',
      gameNumber,
      seriesRule: rule,
      teamA: { picks: selections.picksA, bans: selections.bansA },
      teamB: { picks: selections.picksB, bans: selections.bansB },
    },
    chosenDivineRules: [],
    preDraft: { stage: 'complete', sideAssignment: { A: 'teamA', B: 'teamB' } },
  };
}

function assertPersistedGame(matchId, gameNumber, expected) {
  const game = db.prepare('SELECT * FROM match_games WHERE match_id=? AND game_number=?').get(matchId, gameNumber);
  assert.ok(game, `Game ${gameNumber} must be persisted.`);
  assert.deepEqual(JSON.parse(game.picks_a_json), expected.picksA);
  assert.deepEqual(JSON.parse(game.picks_b_json), expected.picksB);
  assert.deepEqual(JSON.parse(game.bans_a_json), expected.bansA);
  assert.deepEqual(JSON.parse(game.bans_b_json), expected.bansB);
  const snapshot = JSON.parse(game.draft_snapshot_json);
  assert.equal(snapshot.gameNumber, gameNumber);
  assert.deepEqual(snapshot.engine.teamA.picks, expected.picksA);
  return game;
}

function assertNextGameHistory(rule, nextGameNumber, config, completedGames) {
  assert.equal(config.gameNumber, nextGameNumber);
  assert.equal(config.seriesRule, rule);
  if (rule === 'squadra_blast' && nextGameNumber === 2) {
    assert.deepEqual(config.previousPicksA, completedGames[0].picksA);
    assert.deepEqual(config.previousPicksB, completedGames[0].picksB);
    assert.deepEqual(config.previousBansA, completedGames[0].bansA);
    assert.deepEqual(config.previousBansB, completedGames[0].bansB);
    return;
  }
  if (rule === 'squadra_blast') {
    assert.deepEqual(config.previousPicksA, []);
    assert.deepEqual(config.previousPicksB, []);
    assert.deepEqual(config.previousBansA, []);
    assert.deepEqual(config.previousBansB, []);
    return;
  }
  assert.deepEqual(config.previousPicksA, completedGames.flatMap(game => game.picksA));
  assert.deepEqual(config.previousPicksB, completedGames.flatMap(game => game.picksB));
  assert.deepEqual(config.previousBansA, []);
  assert.deepEqual(config.previousBansB, []);
}

async function stopServer() {
  sockets.forEach(socket => socket.connected && socket.disconnect());
  if (!child.killed) child.kill('SIGTERM');
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 1500);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

try {
  await waitForServer();
  const adminLogin = await request('/api/auth/login', {
    method: 'POST', body: { identity: 'series_persistence_admin', password: 'AdminSecure123!' },
  });
  const adminToken = adminLogin.payload.token;
  const created = await request('/api/dev-test/suites', { token: adminToken, method: 'POST' });
  const suite = created.payload.suite;
  const live = suite.tournaments.find(item => item.scenario === 'live');
  assert.ok(live, 'A live test tournament is required.');
  const hostToken = await tokenFromAccessUrl(suite.users.find(item => item.persona === 'host').accessUrl);
  const tournament = await request(`/api/tournaments/${live.id}`, { token: hostToken });
  const seedMatch = tournament.payload.matches.find(item => item.team_a_id && item.team_b_id);
  assert.ok(seedMatch, 'A match with both teams is required.');

  db = new DatabaseSync(databasePath);
  const teamA = db.prepare('SELECT captain_user_id FROM teams WHERE id=?').get(seedMatch.team_a_id);
  const teamB = db.prepare('SELECT captain_user_id FROM teams WHERE id=?').get(seedMatch.team_b_id);
  const captainAPersona = suite.users.find(item => Number(item.id) === Number(teamA.captain_user_id));
  const captainBPersona = suite.users.find(item => Number(item.id) === Number(teamB.captain_user_id));
  assert.ok(captainAPersona && captainBPersona, 'Both Captain personas are required.');
  const captainAToken = await tokenFromAccessUrl(captainAPersona.accessUrl);
  const captainBToken = await tokenFromAccessUrl(captainBPersona.accessUrl);

  const actionColumns = db.prepare('PRAGMA table_info(draft_actions)').all().map(column => column.name);
  assert.ok(actionColumns.includes('actor_user_id'), 'The draft action migration must retain the acting account.');

  for (const [index, [rule, games]] of Object.entries(SERIES).entries()) {
    const matchId = createMatch(live.id, seedMatch.team_a_id, seedMatch.team_b_id, rule, index, teamA.captain_user_id, teamB.captain_user_id);
    const opened = await request(`/api/matches/${matchId}/draft-room`, { token: hostToken, method: 'POST' });
    const { roomCode, links } = opened.payload.room;
    const teamAAccess = accessValue(links.teamA, 'access');
    let controller = await connectDraftRole(roomCode, teamAAccess, captainAToken);
    assert.equal(controller.result.authorityRole, 'teamA');

    for (let offset = 0; offset < games.length; offset += 1) {
      const gameNumber = offset + 1;
      controller.socket.emit('draft:command', {
        roomCode, action: 'select', data: { heroId: games[offset].picksA[0], team: 'A', actionType: 'pick' },
      });
      controller.socket.emit('draft:state', { roomCode, state: draftState(rule, gameNumber, games[offset]) });
      await waitUntil(() => {
        const row = db.prepare('SELECT status FROM match_games WHERE match_id=? AND game_number=?').get(matchId, gameNumber);
        return row?.status === 'draft_complete';
      }, `${rule} Game ${gameNumber} state was not persisted.`);
      assert.equal(assertPersistedGame(matchId, gameNumber, games[offset]).status, 'draft_complete');

      if (gameNumber === 1) {
        controller.socket.disconnect();
        controller = await connectDraftRole(roomCode, teamAAccess, captainAToken);
        assert.equal(controller.result.authorityRole, 'teamA', `${rule} authority must survive a Captain reconnect.`);
        assert.equal(controller.result.state.gameNumber, 1);
      }

      const reported = await request(`/api/matches/${matchId}/games/current/report`, {
        token: captainAToken, method: 'POST', body: { winnerSide: gameNumber === 2 ? 'B' : 'A' },
      });
      assert.equal(reported.response.status, 200);
      const confirmed = await request(`/api/matches/${matchId}/games/current/confirm`, {
        token: captainBToken, method: 'POST', body: { decision: 'confirm' },
      });
      assert.equal(confirmed.response.status, 200, JSON.stringify(confirmed.payload));
      assert.equal(assertPersistedGame(matchId, gameNumber, games[offset]).status, 'completed');

      if (gameNumber === 1 && rule === 'normal') {
        const staleError = waitForEvent(controller.socket, 'draft:error');
        controller.socket.emit('draft:state', { roomCode, state: draftState(rule, 1, games[0]) });
        assert.match((await staleError).message, /stale draft state ignored/i);
        const nextGame = db.prepare('SELECT status FROM match_games WHERE match_id=? AND game_number=2').get(matchId);
        assert.equal(nextGame.status, 'waiting_draft', 'A late Game 1 socket snapshot must not complete Game 2.');
        const staleRest = await request(`/api/matches/${matchId}/draft-room/game-result`, {
          token: adminToken, method: 'POST', body: { winnerSide: 'A', gameNumber: 1 }, allowError: true,
        });
        assert.equal(staleRest.response.status, 409, 'A stale REST result must not advance the current game.');
        assert.equal(db.prepare('SELECT current_game_number FROM matches WHERE id=?').get(matchId).current_game_number, 2);
      }

      if (gameNumber < 3) {
        const access = await request(`/api/public/draft-rooms/${roomCode}/access`, {
          token: captainAToken, method: 'POST', body: { accessToken: teamAAccess },
        });
        assertNextGameHistory(rule, gameNumber + 1, access.payload.room.config, games.slice(0, gameNumber));
      } else {
        assert.equal(confirmed.payload.seriesComplete, true);
        assert.equal(confirmed.payload.final, true);
      }
    }

    const actions = await request(`/api/matches/${matchId}/draft-room/actions`, { token: hostToken });
    assert.equal(actions.response.status, 200);
    assert.ok(actions.payload.actions.length >= 3, `${rule} must expose its Draft audit trail.`);
    assert.ok(actions.payload.actions.every((action, actionIndex, list) => actionIndex === 0 || action.id > list[actionIndex - 1].id));
    assert.ok(actions.payload.actions.some(action => Number(action.actorUserId) === Number(teamA.captain_user_id)));
    const captainAudit = await request(`/api/matches/${matchId}/draft-room/actions`, { token: captainAToken, allowError: true });
    assert.equal(captainAudit.response.status, 403, 'The Draft action log is a staff-only read path.');
    controller.socket.disconnect();
  }

  const dashboard = fs.readFileSync(path.join(root, 'js', 'dashboard.js'), 'utf8');
  assert.match(dashboard, /renderDraftActionLog/);
  assert.match(dashboard, /draft-room\/actions/);
  console.log('BO3 persistence, all series modes, authority reconnect, stale-state race and Draft audit log checks passed.');
} finally {
  try { db?.close(); } catch {}
  await stopServer();
}

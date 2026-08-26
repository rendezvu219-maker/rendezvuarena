import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rendezvu-e2e-32p-'));
const databasePath = path.join(tempRoot, 'tournament_32p.sqlite');
const port = 3199;
const base = `http://127.0.0.1:${port}`;

const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    DATABASE_PATH: databasePath,
    UPLOAD_PATH: path.join(tempRoot, 'uploads'),
    AUTH_SECRET: 'e2e-32p-tournament-secret-2026-very-long-and-secure',
    ADMIN_USERNAME: 'e2e_admin',
    ADMIN_EMAIL: 'e2e-admin@test.local',
    ADMIN_PASSWORD: 'AdminSecure123!',
    ENABLE_DEV_TEST_CONSOLE: 'true',
    API_RATE_LIMIT_PER_MINUTE: '10000',
    REGISTER_RATE_LIMIT_MAX: '10000',
    LOGIN_FAILURE_LIMIT: '10000',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });

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
  if (!response.ok && !allowError) {
    console.error('SERVER LOGS:', output);
    throw new Error(`${method} ${url} (${response.status}): ${payload.error || JSON.stringify(payload)}`);
  }
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
  throw new Error(`E2E test server did not start.\n${output}`);
}

let dbInit = null;
async function stopServer() {
  if (dbInit) {
    try { dbInit.close(); } catch {}
  }
  if (!child.killed) child.kill('SIGTERM');
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 1500);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  try {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  } catch (err) {
    // Windows file lock retry
    setTimeout(() => {
      try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
    }, 500);
  }
}

console.log('=== STARTING 32-PLAYER TOURNAMENT END-TO-END AUTOMATED TEST ===\n');

try {
  await waitForServer();
  console.log('[1/12] Server started successfully on port', port);

  // 1. Authenticate Admin and Create Host
  const adminRes = await request('/api/auth/login', {
    method: 'POST',
    body: { identity: 'e2e_admin', password: 'AdminSecure123!' },
  });
  const adminToken = adminRes.payload.token;

  dbInit = new DatabaseSync(databasePath);
  dbInit.prepare(`UPDATE users SET role='host', email_verified_at=CURRENT_TIMESTAMP WHERE id=1`).run();

  // 2. Create Tournament directly
  const startAt = new Date().toISOString();
  const slug = 'rendezvu-32p-championship';
  const name = 'RendezVu 32-Player Grand Championship';
  const rules = {
    structure: 'single',
    playoffBestOf: 3,
    grandFinalBestOf: 3,
    timerSeconds: 30,
    heroBans: 2,
    divineBans: 0,
    draftStyle: 'standard',
    mirrorPickMode: 'none',
    enableCoinFlip: true,
  };

  const tourResult = dbInit.prepare(`INSERT INTO tournaments(
      host_user_id,name,slug,description,status,timezone,default_server,start_at,schedule_mode,
      source_platform,source_url,source_external_id,source_metadata_json,source_sync_status,is_public,registration_mode,rules_json
    ) VALUES (1,?,?,?,'registration','Asia/Ho_Chi_Minh','Asia',?,'fixed_tournament_start','test-fixture','https://test.local/e2e','e2e-32p',?,'ready',1,'team_or_solo',?)`)
    .run(name, slug, 'Official 32-player solo pool tournament test', startAt, JSON.stringify({ fixture: true }), JSON.stringify(rules));
  
  const tournamentId = Number(tourResult.lastInsertRowid);
  const hostToken = adminToken;
  console.log(`[3/12] Tournament "${name}" created (ID: ${tournamentId}).`);

  // 3. Register 32 Solo Players (8 self-nominated Captains + 24 Players)
  console.log('[4/12] Registering 32 verified user accounts and solo signups...');
  const players = [];
  for (let i = 1; i <= 32; i += 1) {
    const num = String(i).padStart(2, '0');
    const isCaptain = i <= 8; // First 8 are self-nominated captains
    const username = `solo_hero_${num}`;
    const displayName = `Hero Fighter ${num}`;
    const gamerTag = `Fighter#${num}`;
    const reg = await request('/api/auth/register', {
      method: 'POST',
      body: {
        username,
        email: `${username}@player.local`,
        displayName,
        password: 'PlayerPassword123!',
        passwordConfirmation: 'PlayerPassword123!',
        role: 'player',
      },
    });
    const playerToken = reg.payload.token;
    const playerUser = reg.payload.user;

    // Verify email for test
    dbInit.prepare(`UPDATE users SET email_verified_at=CURRENT_TIMESTAMP WHERE id=?`).run(playerUser.id);

    // Join Tournament Solo Pool
    const joinRes = await request(`/api/tournaments/${slug}/join-requests`, {
      token: playerToken,
      method: 'POST',
      body: {
        soloSignup: true,
        requestedRole: isCaptain ? 'captain' : 'player',
        gamerTag,
        message: `Ready for battle! Role: ${isCaptain ? 'Captain' : 'Player'}`,
      },
    });

    players.push({
      index: i,
      user: playerUser,
      token: playerToken,
      requestId: joinRes.payload.request.id,
      gamerTag,
      isCaptain,
    });
  }
  assert.equal(players.length, 32, 'Must have 32 registered players.');
  console.log('       -> 32 players registered for Solo Pool (8 Captains, 24 Players).');

  // 4. Edge Case: Duplicate Pending Registration Check
  const dupPending = await request(`/api/tournaments/${slug}/join-requests`, {
    token: players[0].token,
    method: 'POST',
    body: { soloSignup: true, requestedRole: 'captain', gamerTag: 'Dup#01' },
    allowError: true,
  });
  assert.equal(dupPending.response.status, 409, 'Duplicate pending request must be rejected with 409.');
  console.log('[5/12] Edge Case Verified: Duplicate pending registration rejected (409).');

  // 5. Host Approves all 32 players into Solo Pool
  console.log('[6/12] Host approving all 32 players into the Solo Pool...');
  for (const p of players) {
    await request(`/api/tournaments/${tournamentId}/join-requests/${p.requestId}/review`, {
      token: hostToken,
      method: 'POST',
      body: { decision: 'approve', soloPool: true },
    });
  }

  // Edge Case: Re-registration after approval check (Bug prevention verification!)
  const reRegApproved = await request(`/api/tournaments/${slug}/join-requests`, {
    token: players[0].token,
    method: 'POST',
    body: { soloSignup: true, requestedRole: 'captain', gamerTag: 'ReReg#01' },
    allowError: true,
  });
  assert.equal(reRegApproved.response.status, 409, 'Re-registration after approval must be blocked with 409.');
  console.log('       -> Verified: Re-registration after approval is properly blocked (409).');

  // Edge Case: Test Remove from Solo Pool & Re-add
  const playerToRemove = players[31];
  const removeRes = await request(`/api/tournaments/${tournamentId}/solo-pool/${playerToRemove.requestId}`, {
    token: hostToken,
    method: 'DELETE',
  });
  assert.ok(removeRes.payload.ok, 'Host can remove a player from solo pool.');

  // Re-approve player 32 back into solo pool
  await request(`/api/tournaments/${tournamentId}/join-requests/${playerToRemove.requestId}/review`, {
    token: hostToken,
    method: 'POST',
    body: { decision: 'approve', soloPool: true },
  });
  console.log('       -> Verified: Player removal and re-approval in Solo Pool works seamlessly.');

  // 6. Randomize Solo Teams (32 players -> 8 teams of 4)
  console.log('[7/12] Testing Solo Randomizer: Previewing & confirming 8 teams of 4...');
  
  // Test invalid sizing (e.g. 32 into teams of 5)
  const invalidPreview = await request(`/api/tournaments/${tournamentId}/solo-randomizer/preview`, {
    token: hostToken,
    method: 'POST',
    body: { totalSlots: 32, teamSize: 5, captainMode: 'self_nominated' },
    allowError: true,
  });
  assert.equal(invalidPreview.response.status, 400, 'Indivisible team sizing must be rejected.');

  // Valid Preview
  const validPreview = await request(`/api/tournaments/${tournamentId}/solo-randomizer/preview`, {
    token: hostToken,
    method: 'POST',
    body: { totalSlots: 32, teamSize: 4, captainMode: 'self_nominated' },
  });
  const preview = validPreview.payload.preview;
  assert.equal(preview.assignments.length, 8, 'Must generate exactly 8 teams.');
  for (const t of preview.assignments) {
    assert.equal(t.members.length, 4, 'Each team must have exactly 4 members.');
    const caps = t.members.filter(m => m.isCaptain);
    assert.equal(caps.length, 1, 'Each team must have exactly 1 Captain.');
  }

  // Confirm Preview -> Forms actual teams
  const confirmTeams = await request(`/api/tournaments/${tournamentId}/solo-randomizer/confirm`, {
    token: hostToken,
    method: 'POST',
    body: { previewId: preview.id },
  });
  const db = dbInit;
  const createdTeams = db.prepare('SELECT * FROM teams WHERE tournament_id=?').all(tournamentId);
  assert.equal(createdTeams.length, 8, '8 teams must exist in the database.');
  console.log('       -> 8 Solo Teams successfully formed and confirmed in DB.');

  // 7. Seed Ordering & Preflight Check
  console.log('[8/12] Checking Seed Ordering & Preflight Verification...');
  await request(`/api/tournaments/${tournamentId}/seeding/randomize`, {
    token: hostToken,
    method: 'POST',
  });
  const preflight = await request(`/api/tournaments/${tournamentId}/preflight`, {
    token: hostToken,
  });
  assert.ok(preflight.payload.ok, 'Preflight check must pass with 0 blockers.');
  console.log('       -> Preflight check PASSED with 0 blockers.');

  // 8. Generate Single Elimination Bracket (8 Teams -> 7 Matches)
  console.log('[9/12] Generating Single Elimination Bracket (BO3)...');
  await request(`/api/tournaments/${tournamentId}/bracket/generate`, {
    token: hostToken,
    method: 'POST',
    body: { bestOf: 3 },
  });
  const matches = db.prepare('SELECT * FROM matches WHERE tournament_id=? ORDER BY round_no, position').all(tournamentId);
  assert.equal(matches.length, 7, '8 teams Single Elimination must create exactly 7 matches (4 QF, 2 SF, 1 Final).');
  console.log('       -> Bracket generated with 7 matches (Round 1: 4, Semis: 2, Final: 1).');

  // 9. Host Starts Tournament
  console.log('[10/12] Starting the tournament...');
  await request(`/api/tournaments/${tournamentId}/start`, {
    token: hostToken,
    method: 'POST',
  });
  const startedTourn = db.prepare('SELECT status FROM tournaments WHERE id=?').get(tournamentId);
  assert.equal(startedTourn.status, 'ongoing', 'Tournament status must be "ongoing".');
  console.log('       -> Tournament is now LIVE/ONGOING.');

  // 10. Play Through Entire Tournament to Grand Finals!
  console.log('[11/12] Simulating Tournament Playthrough (Check-in, Draft, Reporting, Finalizing)...');

  function getCaptainTokenForTeam(teamId) {
    const team = db.prepare('SELECT captain_user_id FROM teams WHERE id=?').get(teamId);
    const p = players.find(player => player.user.id === team.captain_user_id);
    return p ? p.token : hostToken;
  }

  async function playMatch(matchId, winnerTeamId) {
    const match = db.prepare('SELECT * FROM matches WHERE id=?').get(matchId);
    console.log(`       -> Playing match ${matchId} (Round ${match.round_no}, Pos ${match.position}): Team ${match.team_a_id} vs Team ${match.team_b_id}...`);
    const capAToken = getCaptainTokenForTeam(match.team_a_id);
    const capBToken = getCaptainTokenForTeam(match.team_b_id);

    // Captains check in
    const checkA = await request(`/api/matches/${matchId}/checkin`, { token: capAToken, method: 'POST', allowError: true });
    if (!checkA.response.ok) {
      console.error(`Checkin A failed for match ${matchId}:`, checkA.response.status, checkA.payload);
      console.error('SERVER LOGS SO FAR:\n', output);
      throw new Error(`Checkin A failed: ${JSON.stringify(checkA.payload)}`);
    }

    const checkB = await request(`/api/matches/${matchId}/checkin`, { token: capBToken, method: 'POST', allowError: true });
    if (!checkB.response.ok) {
      console.error(`Checkin B failed for match ${matchId}:`, checkB.response.status, checkB.payload);
      throw new Error(`Checkin B failed: ${JSON.stringify(checkB.payload)}`);
    }

    // Open draft room
    await request(`/api/matches/${matchId}/draft-room`, { token: hostToken, method: 'POST' });

    // Mark Game 1 draft complete
    db.prepare(`UPDATE draft_rooms SET status='draft_complete', state_json=? WHERE match_id=?`)
      .run(JSON.stringify({ status: 'complete', gameNumber: 1, engine: { state: 'complete', gameNumber: 1, teamA: { picks: ['0001'] }, teamB: { picks: ['0002'] } } }), matchId);

    // Game 1: Report & Confirm Winner
    const winnerSide = winnerTeamId === match.team_a_id ? 'A' : 'B';
    await request(`/api/matches/${matchId}/games/current/report`, {
      token: capAToken,
      method: 'POST',
      body: { winnerSide },
    });
    await request(`/api/matches/${matchId}/games/current/confirm`, {
      token: capBToken,
      method: 'POST',
      body: { decision: 'confirm' },
    });

    // Mark Game 2 draft complete
    db.prepare(`UPDATE draft_rooms SET status='draft_complete', state_json=? WHERE match_id=?`)
      .run(JSON.stringify({ status: 'complete', gameNumber: 2, engine: { state: 'complete', gameNumber: 2, teamA: { picks: ['0003'] }, teamB: { picks: ['0004'] } } }), matchId);

    // Game 2: Report & Confirm Winner (BO3 series win 2-0)
    await request(`/api/matches/${matchId}/games/current/report`, {
      token: capAToken,
      method: 'POST',
      body: { winnerSide },
    });
    await request(`/api/matches/${matchId}/games/current/confirm`, {
      token: capBToken,
      method: 'POST',
      body: { decision: 'confirm' },
    });

    const updated = db.prepare('SELECT * FROM matches WHERE id=?').get(matchId);
    assert.equal(updated.result_status, 'final', `Match ${matchId} must be finalized.`);
    assert.equal(updated.winner_team_id, winnerTeamId, `Winner of match ${matchId} must match.`);
  }

  // --- Round 1: Quarterfinals (4 Matches) ---
  const qfMatches = db.prepare('SELECT * FROM matches WHERE tournament_id=? AND round_no=1 ORDER BY position').all(tournamentId);
  for (const m of qfMatches) {
    await playMatch(m.id, m.team_a_id); // Team A wins each QF
  }
  console.log('       -> Quarterfinals completed: 4 winners advanced to Semifinals.');

  // --- Round 2: Semifinals (2 Matches) ---
  const sfMatches = db.prepare('SELECT * FROM matches WHERE tournament_id=? AND round_no=2 ORDER BY position').all(tournamentId);
  for (const m of sfMatches) {
    assert.ok(m.team_a_id && m.team_b_id, 'Semifinal match must have both teams populated from QF winners.');
    await playMatch(m.id, m.team_a_id); // Team A wins each SF
  }
  console.log('       -> Semifinals completed: 2 winners advanced to Grand Finals.');

  // --- Round 3: Grand Finals (1 Match) ---
  const gfMatch = db.prepare('SELECT * FROM matches WHERE tournament_id=? AND round_no=3 LIMIT 1').get(tournamentId);
  assert.ok(gfMatch.team_a_id && gfMatch.team_b_id, 'Grand Finals must have both finalist teams.');
  
  const championTeamId = gfMatch.team_a_id;
  await playMatch(gfMatch.id, championTeamId);
  console.log('       -> Grand Finals completed: Champion decided!');

  // 11. Final Tournament Completion & Results
  const finalTourn = db.prepare('SELECT * FROM tournaments WHERE id=?').get(tournamentId);
  const finalMatch = db.prepare('SELECT * FROM matches WHERE id=?').get(gfMatch.id);
  assert.equal(finalMatch.winner_team_id, championTeamId, 'Champion team ID must be recorded.');
  console.log(`[12/12] TOURNAMENT COMPLETE! Champion Team ID: ${championTeamId}`);

  console.log('\n===============================================================');
  console.log('🎉 ALL 32-PLAYER TOURNAMENT TESTS & EDGE CASES PASSED 100%! 🎉');
  console.log('===============================================================\n');
} finally {
  console.log('[Cleanup] Tearing down test server and deleting temporary test database...');
  await stopServer();
  console.log('[Cleanup] Cleanup complete. Zero leftover files.');
}

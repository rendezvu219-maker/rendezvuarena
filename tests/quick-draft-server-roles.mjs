import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { io } = require('socket.io-client');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gekishin-quick-roles-'));
const port = 3136;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    DATABASE_PATH: path.join(tempDir, 'quick.sqlite'),
    AUTH_SECRET: 'quick-draft-role-test-secret-32-characters!',
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
  if (!response.ok && !allowError) throw new Error(`${method} ${url}: ${payload.error || response.status}`);
  return { response, payload };
}

async function waitForServer() {
  for (let i = 0; i < 80; i += 1) {
    try { await request('/api/health'); return; }
    catch { await new Promise(resolve => setTimeout(resolve, 75)); }
  }
  throw new Error(`Quick Draft test server did not start.\n${output}`);
}

function fragmentValue(url, key) {
  return new URLSearchParams(new URL(url, base).hash.slice(1)).get(key);
}

async function connectRole(roomCode, accessToken) {
  const exchanged = await request(`/api/public/draft-rooms/${roomCode}/access`, {
    method: 'POST', body: { accessToken },
  });
  return new Promise((resolve, reject) => {
    const socket = io(base, { transports: ['websocket'], auth: { draftTicket: exchanged.payload.socketTicket } });
    socket.once('connect_error', reject);
    socket.once('connect', () => socket.emit('draft:join', { roomCode }, result => {
      if (!result?.ok) return reject(new Error(result?.error || 'Draft join failed.'));
      resolve({ socket, result });
    }));
  });
}

function waitForEvent(socket, event, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}.`)), timeout);
    socket.once(event, payload => { clearTimeout(timer); resolve(payload); });
  });
}

const sockets = [];
try {
  await waitForServer();
  const registered = await request('/api/auth/register', {
    method: 'POST',
    body: {
      displayName: 'Quick Host', username: 'quickhost',
      password: 'Password123!', passwordConfirmation: 'Password123!', role: 'player',
    },
  });
  const token = registered.payload.token;
  const created = await request('/api/quick-draft-rooms', {
    token, method: 'POST',
    body: { config: {
      sessionId: 'quick-role-session-001', teamA: 'Blue Warriors', teamB: 'Red Warriors',
      format: 'BO3', seriesRule: 'squadra_blast', timerSeconds: 30, heroBans: 1,
      enableCoinFlip: false, enableDivineDraw: false,
    } },
  });
  const room = created.payload.room;
  assert.ok(room.roomCode);
  assert.match(room.links.host, /\/draft-room\.html#room=/);
  assert.match(room.links.teamA, /\/draft-room\.html#room=/);
  assert.match(room.links.teamB, /\/draft-room\.html#room=/);
  assert.match(room.links.broadcaster, /\/broadcast\.html#room=/);
  assert.ok(!room.links.teamA.includes('?config='), 'Quick Team links must use a server room, not local query-string state.');

  const listed = await request('/api/tournaments', { token });
  assert.equal(listed.payload.tournaments.length, 0, 'Hidden Quick Draft backing events must not appear in Tournament Operations.');

  const host = await connectRole(room.roomCode, fragmentValue(room.links.host, 'access'));
  const teamA = await connectRole(room.roomCode, fragmentValue(room.links.teamA, 'access'));
  const teamB = await connectRole(room.roomCode, fragmentValue(room.links.teamB, 'access'));
  const broadcaster = await connectRole(room.roomCode, fragmentValue(room.links.broadcaster, 'access'));
  sockets.push(host.socket, teamA.socket, teamB.socket, broadcaster.socket);
  assert.equal(host.result.role, 'host');
  assert.equal(teamA.result.role, 'teamA');
  assert.equal(teamB.result.role, 'teamB');
  assert.equal(broadcaster.result.role, 'broadcaster');

  const hostCommand = waitForEvent(host.socket, 'draft:command');
  teamA.socket.emit('draft:command', {
    roomCode: room.roomCode, action: 'select', data: { heroId: '0001', team: 'A' },
  });
  assert.equal((await hostCommand).fromRole, 'teamA', 'Team Blue command must reach Host as teamA.');

  const quickCoinCommand = waitForEvent(host.socket, 'draft:command');
  teamB.socket.emit('draft:command', {
    roomCode: room.roomCode,
    action: 'pre-draft:coin-call',
    data: { face: 'TAILS', teamKey: 'teamB' },
  });
  const quickCoinPayload = await quickCoinCommand;
  assert.equal(quickCoinPayload.fromRole, 'teamB', 'Either Quick Play team must be able to submit the first coin call.');
  assert.equal(quickCoinPayload.action, 'pre-draft:coin-call');

  const wrongSideError = waitForEvent(teamA.socket, 'draft:error');
  teamA.socket.emit('draft:command', {
    roomCode: room.roomCode, action: 'select', data: { heroId: '0002', team: 'B' },
  });
  assert.match((await wrongSideError).message, /other team/i, 'Team Blue must be blocked from controlling Team Red.');

  const swappedStateSeen = waitForEvent(teamA.socket, 'draft:state');
  host.socket.emit('draft:state', {
    roomCode: room.roomCode,
    state: {
      status: 'waiting',
      preDraft: { stage: 'side-select', sideAssignment: { A: 'teamB', B: 'teamA' } },
    },
  });
  await swappedStateSeen;

  const swappedTeamACommand = waitForEvent(host.socket, 'draft:command');
  teamA.socket.emit('draft:command', {
    roomCode: room.roomCode, action: 'select', data: { heroId: '0004', team: 'B' },
  });
  assert.equal((await swappedTeamACommand).fromRole, 'teamA', 'After side selection, bracket Team A must control its resolved Red side.');

  const swappedTeamBCommand = waitForEvent(host.socket, 'draft:command');
  teamB.socket.emit('draft:command', {
    roomCode: room.roomCode, action: 'select', data: { heroId: '0005', team: 'A' },
  });
  assert.equal((await swappedTeamBCommand).fromRole, 'teamB', 'After side selection, bracket Team B must control its resolved Blue side.');

  const broadcastError = waitForEvent(broadcaster.socket, 'draft:error');
  broadcaster.socket.emit('draft:command', {
    roomCode: room.roomCode, action: 'select', data: { heroId: '0003', team: 'A' },
  });
  assert.match((await broadcastError).message, /cannot perform/i, 'Broadcast role must stay view-only.');

  const broadcastCoinError = waitForEvent(broadcaster.socket, 'draft:error');
  broadcaster.socket.emit('draft:command', {
    roomCode: room.roomCode,
    action: 'pre-draft:coin-call',
    data: { face: 'HEADS', teamKey: 'teamA' },
  });
  assert.match((await broadcastCoinError).message, /cannot perform/i, 'Broadcast role cannot interact with the pre-draft flow.');

  const hostAccess = fragmentValue(room.links.host, 'access');
  const teamAAccess = fragmentValue(room.links.teamA, 'access');
  const gameOneStateSeen = waitForEvent(teamA.socket, 'draft:state');
  host.socket.emit('draft:state', {
    roomCode: room.roomCode,
    state: {
      status: 'complete',
      preDraft: { stage: 'complete', sideAssignment: { A: 'teamA', B: 'teamB' } },
      engine: {
        state: 'complete', gameNumber: 1,
        teamA: { picks: ['0001','0002','0003','0004'], bans: ['0009'] },
        teamB: { picks: ['0005','0006','0007','0008'], bans: ['0010'] },
      },
    },
  });
  await gameOneStateSeen;

  const broadcasterResultAttempt = await request(`/api/public/draft-rooms/${room.roomCode}/game-result`, {
    method: 'POST', allowError: true,
    body: { accessToken: fragmentValue(room.links.broadcaster, 'access'), winnerSide: 'A' },
  });
  assert.equal(broadcasterResultAttempt.response.status, 403, 'A Broadcast link must never record Quick Draft results.');
  const nonAuthorityTeamAttempt = await request(`/api/public/draft-rooms/${room.roomCode}/game-result`, {
    method: 'POST', allowError: true, body: { accessToken: teamAAccess, winnerSide: 'A' },
  });
  assert.equal(nonAuthorityTeamAttempt.response.status, 409, 'A team link cannot record a result while the Host link controls the room.');

  const gameOneResult = await request(`/api/public/draft-rooms/${room.roomCode}/game-result`, {
    method: 'POST', body: { accessToken: hostAccess, winnerSide: 'A' },
  });
  assert.equal(gameOneResult.response.status, 200, JSON.stringify(gameOneResult.payload));
  assert.equal(gameOneResult.payload.nextGameNumber, 2, 'A shared Quick Draft controller link must advance to Game 2.');
  assert.match(gameOneResult.payload.nextDraftUrl, /\/draft-room\.html#room=/);

  const gameTwoRoom = await request(`/api/public/draft-rooms/${room.roomCode}/access`, {
    method: 'POST', body: { accessToken: hostAccess },
  });
  assert.equal(gameTwoRoom.payload.room.config.gameNumber, 2);
  assert.deepEqual(gameTwoRoom.payload.room.config.previousPicksA, ['0001','0002','0003','0004']);
  assert.deepEqual(gameTwoRoom.payload.room.config.previousPicksB, ['0005','0006','0007','0008']);
  assert.deepEqual(gameTwoRoom.payload.room.config.previousBansA, ['0009']);
  assert.deepEqual(gameTwoRoom.payload.room.config.previousBansB, ['0010']);

  const authorityShift = waitForEvent(teamA.socket, 'draft:authority');
  host.socket.disconnect();
  assert.equal((await authorityShift).role, 'teamA', 'A shared team link must take authority when the Quick Draft Host is absent.');

  const gameTwoStateSeen = waitForEvent(teamB.socket, 'draft:state');
  teamA.socket.emit('draft:state', {
    roomCode: room.roomCode,
    state: {
      status: 'complete',
      engine: {
        state: 'complete', gameNumber: 2,
        teamA: { picks: ['0011','0012','0013','0014'], bans: ['0009'] },
        teamB: { picks: ['0015','0016','0017','0018'], bans: ['0010'] },
      },
    },
  });
  await gameTwoStateSeen;
  const gameTwoResult = await request(`/api/public/draft-rooms/${room.roomCode}/game-result`, {
    method: 'POST', body: { accessToken: teamAAccess, winnerSide: 'B' },
  });
  assert.equal(gameTwoResult.response.status, 200, JSON.stringify(gameTwoResult.payload));
  assert.equal(gameTwoResult.payload.nextGameNumber, 3, 'The shared team controller link must advance to Game 3.');

  const gameThreeRoom = await request(`/api/public/draft-rooms/${room.roomCode}/access`, {
    method: 'POST', body: { accessToken: teamAAccess },
  });
  assert.equal(gameThreeRoom.payload.room.config.gameNumber, 3);
  assert.deepEqual(gameThreeRoom.payload.room.config.previousPicksA, [], 'Squadra Blast Game 3 must clear prior picks.');
  assert.deepEqual(gameThreeRoom.payload.room.config.previousPicksB, []);
  assert.deepEqual(gameThreeRoom.payload.room.config.previousBansA, [], 'Squadra Blast Game 3 must clear prior bans.');
  assert.deepEqual(gameThreeRoom.payload.room.config.previousBansB, []);

  const gameThreeStateSeen = waitForEvent(teamB.socket, 'draft:state');
  teamA.socket.emit('draft:state', {
    roomCode: room.roomCode,
    state: {
      status: 'complete',
      engine: {
        state: 'complete', gameNumber: 3,
        teamA: { picks: ['0019','0020','0021','0022'], bans: ['0027'] },
        teamB: { picks: ['0023','0024','0025','0026'], bans: ['0028'] },
      },
    },
  });
  await gameThreeStateSeen;
  const gameThreeResult = await request(`/api/public/draft-rooms/${room.roomCode}/game-result`, {
    method: 'POST', body: { accessToken: teamAAccess, winnerSide: 'A' },
  });
  assert.equal(gameThreeResult.response.status, 200, JSON.stringify(gameThreeResult.payload));
  assert.equal(gameThreeResult.payload.seriesComplete, true);
  assert.equal(gameThreeResult.payload.final, true, 'The shared Quick Draft controller must finalize the BO series.');

  console.log('Quick Draft shared links, role controls, next-game history and BO finalization passed.');
} finally {
  sockets.forEach(socket => socket.disconnect());
  if (!child.killed) child.kill('SIGTERM');
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 1500);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
  fs.rmSync(tempDir, { recursive: true, force: true });
}

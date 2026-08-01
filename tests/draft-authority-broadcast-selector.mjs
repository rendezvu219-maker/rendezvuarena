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
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gekishin-draft-authority-'));
const port = 3142;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    DATABASE_PATH: path.join(tempDir, 'authority.sqlite'),
    AUTH_SECRET: 'draft-authority-test-secret-32-characters!',
    ADMIN_EMAIL: 'authority_admin@test.local',
    ADMIN_PASSWORD: 'AdminPass123!',
    ADMIN_USERNAME: 'authority_admin',
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
  for (let index = 0; index < 100; index += 1) {
    try { await request('/api/health'); return; }
    catch { await new Promise(resolve => setTimeout(resolve, 70)); }
  }
  throw new Error(`Authority test server did not start.\n${output}`);
}

async function tokenFromAccessUrl(url) {
  const parsed = new URL(url, base);
  const code = new URLSearchParams(parsed.hash.slice(1)).get('code');
  const exchanged = await request('/api/dev-test/access/exchange', { method: 'POST', body: { code } });
  return exchanged.payload.token;
}

function fragmentValue(url, key) {
  return new URLSearchParams(new URL(url, base).hash.slice(1)).get(key);
}

async function connectDraftRole(roomCode, accessToken) {
  const exchange = await request(`/api/public/draft-rooms/${roomCode}/access`, {
    method: 'POST', body: { accessToken },
  });
  return new Promise((resolve, reject) => {
    const socket = io(base, {
      transports: ['websocket'],
      auth: { draftTicket: exchange.payload.socketTicket },
    });
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

const sockets = [];
try {
  await waitForServer();
  const login = await request('/api/auth/login', {
    method: 'POST', body: { identity: 'authority_admin', password: 'AdminPass123!' },
  });
  const adminToken = login.payload.token;
  const created = await request('/api/dev-test/suites', { token: adminToken, method: 'POST' });
  const suite = created.payload.suite;
  const live = suite.tournaments.find(item => item.scenario === 'live');
  assert.ok(live, 'The development suite must contain a live tournament.');

  const hostToken = await tokenFromAccessUrl(suite.users.find(item => item.persona === 'host').accessUrl);
  const broadcasterToken = await tokenFromAccessUrl(suite.users.find(item => item.persona === 'broadcaster').accessUrl);
  const tournament = await request(`/api/tournaments/${live.id}`, { token: hostToken });
  const match = tournament.payload.matches.find(item => item.team_a_id && item.team_b_id && item.result_status !== 'final');
  assert.ok(match, 'The live tournament must contain a playable match.');

  const selectable = await request('/api/broadcast/matches', { token: broadcasterToken });
  assert.ok(selectable.payload.matches.some(item => Number(item.id) === Number(match.id)),
    'A broadcaster must see an assigned upcoming or active match in the selector.');

  const opened = await request(`/api/matches/${match.id}/draft-room`, { token: hostToken, method: 'POST' });
  const room = opened.payload.room;
  assert.ok(room?.roomCode && room?.links?.teamA && room?.links?.teamB && room?.links?.host);

  const teamA = await connectDraftRole(room.roomCode, fragmentValue(room.links.teamA, 'access'));
  sockets.push(teamA.socket);
  assert.equal(teamA.result.authorityRole, 'teamA', 'Team A becomes authority when no Host is connected.');
  assert.equal(teamA.result.authoritySocketId, teamA.socket.id);

  const teamB = await connectDraftRole(room.roomCode, fragmentValue(room.links.teamB, 'access'));
  sockets.push(teamB.socket);
  assert.equal(teamB.result.authorityRole, 'teamA', 'Team A remains the elected fallback authority.');

  const proceedCommand = waitForEvent(teamA.socket, 'draft:command');
  teamB.socket.emit('draft:command', {
    roomCode: room.roomCode,
    action: 'pre-draft:complete',
    data: {},
  });
  const proceed = await proceedCommand;
  assert.equal(proceed.action, 'pre-draft:complete');
  assert.equal(proceed.fromRole, 'teamB', 'Either side can request Proceed to Draft without a Host tab.');

  const teamBState = waitForEvent(teamB.socket, 'draft:state');
  teamA.socket.emit('draft:state', {
    roomCode: room.roomCode,
    state: { status: 'active', engine: { state: 'active' }, preDraft: { stage: 'complete' } },
  });
  assert.equal((await teamBState).preDraft.stage, 'complete', 'The elected team authority can publish the shared Draft state.');

  const hostAuthoritySeen = waitForEvent(teamA.socket, 'draft:authority');
  const host = await connectDraftRole(room.roomCode, fragmentValue(room.links.host, 'access'));
  sockets.push(host.socket);
  const hostAuthority = await hostAuthoritySeen;
  assert.equal(hostAuthority.role, 'host', 'Host takes authority only while a Host view is connected.');
  assert.equal(hostAuthority.socketId, host.socket.id);

  const teamAuthorityRestored = waitForEvent(teamA.socket, 'draft:authority');
  host.socket.disconnect();
  const restored = await teamAuthorityRestored;
  assert.equal(restored.role, 'teamA', 'Authority returns to a team when the Host leaves.');
  assert.equal(restored.socketId, teamA.socket.id);

  const broadcastAccess = await request(`/api/matches/${match.id}/draft-room/access`, { token: broadcasterToken });
  assert.equal(broadcastAccess.payload.role, 'broadcaster');
  assert.match(broadcastAccess.payload.url, /\/broadcast\.html#room=/);

  await request(`/api/dev-test/suites/${created.payload.suiteId}`, { token: adminToken, method: 'DELETE' });
  console.log('Team-run Draft authority and Broadcast match selector access tests passed.');
} finally {
  sockets.forEach(socket => socket.connected && socket.disconnect());
  if (!child.killed) child.kill('SIGTERM');
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 1500);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
  fs.rmSync(tempDir, { recursive: true, force: true });
}

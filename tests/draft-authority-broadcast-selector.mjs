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

async function tokenFromPassword(username, password) {
  const login = await request('/api/auth/login', {
    method: 'POST', body: { identity: username, password },
  });
  return login.payload.token;
}

function fragmentValue(url, key) {
  return new URLSearchParams(new URL(url, base).hash.slice(1)).get(key);
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

function waitForEventMatching(socket, event, predicate, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for matching ${event}.`));
    }, timeout);
    const onEvent = payload => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, onEvent);
      resolve(payload);
    };
    socket.on(event, onEvent);
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
  const teamARecord = tournament.payload.teams.find(item => Number(item.id) === Number(match.team_a_id));
  const teamBRecord = tournament.payload.teams.find(item => Number(item.id) === Number(match.team_b_id));
  const captainAPersona = suite.users.find(item => Number(item.id) === Number(teamARecord?.captain_user_id));
  const captainBPersona = suite.users.find(item => Number(item.id) === Number(teamBRecord?.captain_user_id));
  const playerAMember = teamARecord?.members.find(item => !item.is_captain && item.user_id);
  const playerAPersona = suite.users.find(item => Number(item.id) === Number(playerAMember?.user_id));
  assert.ok(captainAPersona && captainBPersona && playerAPersona, 'Both Captains and a normal roster member must be available.');
  const captainAToken = await tokenFromPassword(captainAPersona.username, created.payload.password);
  const captainBToken = await tokenFromPassword(captainBPersona.username, created.payload.password);
  const playerAToken = await tokenFromPassword(playerAPersona.username, created.payload.password);

  const selectable = await request('/api/broadcast/matches', { token: broadcasterToken });
  assert.ok(selectable.payload.matches.some(item => Number(item.id) === Number(match.id)),
    'A broadcaster must see an assigned upcoming or active match in the selector.');

  const opened = await request(`/api/matches/${match.id}/draft-room`, { token: hostToken, method: 'POST' });
  const room = opened.payload.room;
  assert.ok(room?.roomCode && room?.links?.teamA && room?.links?.teamB && room?.links?.host);
  const teamAAccess = fragmentValue(room.links.teamA, 'access');

  const anonymousTeamExchange = await request(`/api/public/draft-rooms/${room.roomCode}/access`, {
    method: 'POST', body: { accessToken: teamAAccess }, allowError: true,
  });
  assert.equal(anonymousTeamExchange.response.status, 401, 'Tournament Draft links must require an assigned signed-in account.');
  const memberTeamExchange = await request(`/api/public/draft-rooms/${room.roomCode}/access`, {
    token: playerAToken, method: 'POST', body: { accessToken: teamAAccess }, allowError: true,
  });
  assert.equal(memberTeamExchange.response.status, 403, 'A normal roster member must not exchange the Captain team capability.');
  const memberPortalAccess = await request(`/api/matches/${match.id}/draft-room/access`, {
    token: playerAToken, allowError: true,
  });
  assert.equal(memberPortalAccess.response.status, 403, 'A normal roster member must not receive a team Draft link from the portal API.');

  const memberSocket = io(base, { transports: ['websocket'], auth: { token: playerAToken } });
  sockets.push(memberSocket);
  await new Promise((resolve, reject) => {
    memberSocket.once('connect_error', reject);
    memberSocket.once('connect', resolve);
  });
  const memberJoin = await new Promise(resolve => memberSocket.emit('draft:join', { roomCode: room.roomCode }, resolve));
  assert.equal(memberJoin.ok, false, 'A linked roster member must not bypass the Captain restriction through an account Socket.');
  assert.match(memberJoin.error, /access denied/i);

  const teamA = await connectDraftRole(room.roomCode, teamAAccess, captainAToken);
  sockets.push(teamA.socket);
  assert.equal(teamA.result.authorityRole, 'teamA', 'Team A becomes authority when no Host is connected.');
  assert.equal(teamA.result.authoritySocketId, teamA.socket.id);
  assert.equal(teamA.result.presence.teamA, 1);
  assert.equal(teamA.result.presence.teamB, 0, 'The first Captain can see that the opposing Captain is missing.');

  const teamBPresenceSeen = waitForEventMatching(teamA.socket, 'draft:presence', payload => payload?.presence?.teamB === 1);
  const teamB = await connectDraftRole(room.roomCode, fragmentValue(room.links.teamB, 'access'), captainBToken);
  sockets.push(teamB.socket);
  assert.equal(teamB.result.authorityRole, 'teamA', 'Team A remains the elected fallback authority.');
  assert.equal(teamB.result.presence.teamA, 1);
  assert.equal(teamB.result.presence.teamB, 1);
  assert.equal((await teamBPresenceSeen).presence.teamB, 1, 'Presence updates let the waiting Captain resume automatically.');

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
  const host = await connectDraftRole(room.roomCode, fragmentValue(room.links.host, 'access'), hostToken);
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

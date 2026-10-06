import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { io } = require('socket.io-client');
const root = fileURLToPath(new URL('..', import.meta.url));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-tournament-links-'));
const databasePath = path.join(temp, 'links.sqlite');
const base = 'http://127.0.0.1:3196';
const child = spawn(process.execPath, ['server.js'], {
  cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'test', PORT: '3196', DATABASE_PATH: databasePath,
    AUTH_SECRET: 'tournament-link-access-test-secret-32-chars', ADMIN_USERNAME: 'links_admin',
    ADMIN_EMAIL: 'links_admin@test.local', ADMIN_PASSWORD: 'AdminPass123!' },
});
let output = '';
child.stdout.on('data', bytes => { output += bytes; });
child.stderr.on('data', bytes => { output += bytes; });
const sockets = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(route, { token, method = 'GET', body, status = 200 } = {}) {
  const response = await fetch(`${base}${route}`, { method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(['GET', 'HEAD'].includes(method) ? {} : { 'X-CSRF-Token': '1' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(payload)}`);
  return payload;
}
const access = url => new URLSearchParams(new URL(url).hash.slice(1)).get('access');
function ack(socket, event, payload) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout: ${event}`)), 4000);
    socket.emit(event, payload, result => { clearTimeout(timer); resolve(result); });
  });
}
function once(socket, event) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`Timeout: ${event}`)); }, 4000);
    const handler = payload => { clearTimeout(timer); resolve(payload); };
    socket.once(event, handler);
  });
}
async function connect(room, role, token) {
  const exchange = await request(`/api/public/draft-rooms/${room.roomCode}/access`, {
    token, method: 'POST', body: { accessToken: access(room.links[role]) },
  });
  assert.equal(exchange.room.role, role);
  assert.equal(Boolean(exchange.room.links), role === 'host', 'Participants must not receive other role links.');
  const socket = io(base, { transports: ['websocket'], auth: { draftTicket: exchange.socketTicket } });
  sockets.push(socket);
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  const joined = await ack(socket, 'draft:join', { roomCode: room.roomCode });
  assert.equal(joined.ok, true, JSON.stringify(joined));
  assert.equal(joined.role, role);
  return socket;
}
try {
  for (let attempt = 0; ; attempt++) {
    try { await request('/api/health'); break; }
    catch (error) { if (attempt >= 80) throw new Error(`${error.message}\n${output}`); await sleep(75); }
  }
  const login = await request('/api/auth/login', { method: 'POST', body: { identity: 'links_admin', password: 'AdminPass123!' } });
  const token = login.token;
  const created = await request('/api/dev-test/suites', { token, method: 'POST', status: 201 });
  const tournament = created.suite.tournaments.find(item => item.scenario === 'live');
  const details = await request(`/api/tournaments/${tournament.id}`, { token });
  const matches = details.matches.filter(match => match.team_a_id && match.team_b_id && match.result_status !== 'final');
  assert.ok(matches.length >= 4);
  const selected = matches.slice(0, 4);
  // Only this disposable test database is modified; no existing event is touched.
  const fixture = new DatabaseSync(databasePath);
  for (const match of selected) {
    fixture.prepare('DELETE FROM draft_rooms WHERE match_id=?').run(match.id);
    fixture.prepare('DELETE FROM match_checkins WHERE match_id=?').run(match.id);
    fixture.prepare('UPDATE teams SET captain_user_id=NULL WHERE id IN (?,?)').run(match.team_a_id, match.team_b_id);
  }
  fixture.close();
  await request(`/api/matches/${selected[0].id}`, { token, method: 'PATCH', body: { seriesRule: 'squadra_blast', bestOf: 3 } });
  // The legacy account/check-in path is still available, not weakened globally.
  await request(`/api/matches/${selected[0].id}/draft-room`, { token, method: 'POST', status: 409 });
  await request(`/api/matches/${selected[0].id}/draft-room`, { method: 'POST', body: { linkAccess: true }, status: 401 });
  const rooms = [];
  for (const match of selected) {
    const result = await request(`/api/matches/${match.id}/draft-room`, { token, method: 'POST', body: { linkAccess: true } });
    assert.equal(result.room.config.linkAccess, true);
    assert.equal(result.room.config.matchId, match.id);
    rooms.push(result.room);
  }
  assert.equal(new Set(rooms.map(room => room.roomCode)).size, 4);
  const hosts = await Promise.all(rooms.map(room => connect(room, 'host', token)));
  const teams = await Promise.all(rooms.map(room => connect(room, 'teamA')));
  const teamB = await connect(rooms[0], 'teamB');
  const spectator = await connect(rooms[0], 'broadcaster');
  await request(`/api/public/draft-rooms/${rooms[0].roomCode}/access`, {
    method: 'POST', body: { accessToken: access(rooms[1].links.teamA) }, status: 403,
  });
  await request(`/api/public/draft-rooms/${rooms[0].roomCode}/access`, {
    method: 'POST', body: { accessToken: access(rooms[0].links.host) }, status: 401,
  });
  assert.equal((await ack(teams[0], 'draft:join', { roomCode: rooms[1].roomCode })).ok, false);
  let otherRoomCommands = 0;
  hosts[1].on('draft:command', () => { otherRoomCommands++; });
  const command = once(hosts[0], 'draft:command');
  teams[0].emit('draft:command', { roomCode: rooms[0].roomCode, action: 'select', data: { heroId: '0001', team: 'A' } });
  assert.equal((await command).fromRole, 'teamA');
  await sleep(50);
  assert.equal(otherRoomCommands, 0);
  const wrongSide = once(teams[0], 'draft:error');
  teams[0].emit('draft:command', { roomCode: rooms[0].roomCode, action: 'select', data: { heroId: '0001', team: 'B' } });
  assert.match((await wrongSide).message, /other team/i);
  const specError = once(spectator, 'draft:error');
  spectator.emit('draft:command', { roomCode: rooms[0].roomCode, action: 'select', data: { heroId: '0001', team: 'A' } });
  assert.match((await specError).message, /cannot perform/i);
  const stateSeen = once(teamB, 'draft:state');
  hosts[0].emit('draft:state', { roomCode: rooms[0].roomCode, state: {
    status: 'complete', gameNumber: 1, gameRollId: rooms[0].config.gameRollId,
    preDraft: { stage: 'complete', gameNumber: 1, gameRollId: rooms[0].config.gameRollId, sideAssignment: { A: 'teamB', B: 'teamA' } },
    engine: { state: 'complete', gameNumber: 1,
      teamA: { picks: ['0001','0002','0003','0004'], bans: ['0009'] },
      teamB: { picks: ['0005','0006','0007','0008'], bans: ['0010'] } },
  } });
  await stateSeen;
  await request(`/api/public/draft-rooms/${rooms[0].roomCode}/game-result`, {
    method: 'POST', body: { accessToken: access(rooms[0].links.teamA), winnerSide: 'A', gameNumber: 1 }, status: 403,
  });
  const result = await request(`/api/matches/${selected[0].id}/draft-room/game-result`, {
    token, method: 'POST', body: { winnerSide: 'A', gameNumber: 1 },
  });
  assert.equal(result.nextGameNumber, 2);
  const reopened = await request(`/api/matches/${selected[0].id}/draft-room`, { token, method: 'POST', body: { linkAccess: true } });
  assert.deepEqual(reopened.room.links, rooms[0].links, 'Reopening must retain the original share/rejoin links.');
  assert.equal(reopened.room.config.linkAccess, true);
  assert.equal(reopened.room.config.gameNumber, 2);
  assert.deepEqual(reopened.room.config.sideAssignment, { A: 'teamB', B: 'teamA' });
  assert.deepEqual(reopened.room.config.previousPicksA, ['0005','0006','0007','0008']);
  assert.deepEqual(reopened.room.config.previousPicksB, ['0001','0002','0003','0004']);
  assert.deepEqual(reopened.room.config.previousBansA, ['0010']);
  const other = await request(`/api/public/draft-rooms/${rooms[1].roomCode}/access`, { method: 'POST', body: { accessToken: access(rooms[1].links.teamA) } });
  assert.equal(other.room.config.gameNumber, 1);
  assert.equal(other.room.config.seriesScoreA, 0);
  assert.deepEqual(other.room.config.previousPicksA, []);
  await connect(reopened.room, 'teamA');
  // A legacy room can be opted into link access without changing its identity.
  const legacyFixture = new DatabaseSync(databasePath);
  const legacyConfig = { ...rooms[2].config, linkAccess: false };
  legacyFixture.prepare('UPDATE draft_rooms SET config_json=? WHERE room_code=?').run(JSON.stringify(legacyConfig), rooms[2].roomCode);
  legacyFixture.close();
  await request(`/api/public/draft-rooms/${rooms[2].roomCode}/access`, { method: 'POST', body: { accessToken: access(rooms[2].links.teamB) }, status: 401 });
  const converted = await request(`/api/matches/${selected[2].id}/draft-room`, { token, method: 'POST', body: { linkAccess: true } });
  assert.deepEqual(converted.room.links, rooms[2].links);
  await connect(converted.room, 'teamB');
  console.log('Existing Operations: four match-scoped rooms, no Captain/check-in, anonymous team/spec links, Host-only administration, stable rejoin, side/history persistence and legacy room conversion passed.');
} finally {
  sockets.forEach(socket => socket.disconnect());
  child.kill('SIGTERM');
  await new Promise(resolve => { const timer = setTimeout(resolve, 1500); child.once('exit', () => { clearTimeout(timer); resolve(); }); });
  fs.rmSync(temp, { recursive: true, force: true });
}

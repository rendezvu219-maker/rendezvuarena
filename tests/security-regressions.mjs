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
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gekishin-security-'));
const strongSecret = 'security-regression-auth-secret-2026-very-strong';

function spawnServer({ port, name, extraEnv = {} }) {
  const dbPath = path.join(tempRoot, `${name}.sqlite`);
  const uploadPath = path.join(tempRoot, `${name}-uploads`);
  const child = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      DATABASE_PATH: dbPath,
      UPLOAD_PATH: uploadPath,
      AUTH_SECRET: strongSecret,
      ADMIN_USERNAME: `${name}_admin`,
      ADMIN_EMAIL: `${name}_admin@test.local`,
      ADMIN_PASSWORD: 'AdminSecure123!',
      ALLOW_MANUAL_TOURNAMENT_CREATION: 'true',
      API_RATE_LIMIT_PER_MINUTE: '10000',
      REGISTER_RATE_LIMIT_MAX: '10000',
      LOGIN_FAILURE_LIMIT: '10000',
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  return { child, output: () => output, base: `http://127.0.0.1:${port}` };
}

async function stopServer(child) {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 1500);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

async function waitForServer(instance) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${instance.base}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  throw new Error(`Server did not start.\n${instance.output()}`);
}

async function request(instance, url, { token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${instance.base}${url}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(!['GET','HEAD','OPTIONS'].includes(String(method).toUpperCase()) ? { 'X-CSRF-Token': '1' } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

function fragmentParams(url, base) {
  return new URLSearchParams(new URL(url, base).hash.replace(/^#/, ''));
}

async function exchangeDevAccess(instance, accessUrl) {
  const code = fragmentParams(accessUrl, instance.base).get('code');
  assert.ok(code, 'Dev access link must carry its one-time code in the URL fragment.');
  const exchanged = await request(instance, '/api/dev-test/access/exchange', { method: 'POST', body: { code } });
  assert.equal(exchanged.response.status, 200);
  assert.ok(exchanged.payload.token, 'Test mode must return a bearer token for regression automation only.');
  return exchanged.payload.token;
}

function connectSocket(instance, options = {}) {
  return new Promise((resolve, reject) => {
    const socket = io(instance.base, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 2500,
      ...options,
    });
    const timer = setTimeout(() => { socket.disconnect(); reject(new Error('Socket connection timed out.')); }, 3500);
    socket.once('connect', () => { clearTimeout(timer); resolve(socket); });
    socket.once('connect_error', error => { clearTimeout(timer); socket.disconnect(); reject(error); });
  });
}

function expectSocketError(instance, options = {}, label = 'socket') {
  return new Promise((resolve, reject) => {
    const socket = io(instance.base, { transports: ['websocket'], reconnection: false, timeout: 2000, ...options });
    const timer = setTimeout(() => { socket.disconnect(); reject(new Error(`Expected Socket.IO connection rejection: ${label}.`)); }, 3000);
    socket.once('connect', () => { clearTimeout(timer); socket.disconnect(); reject(new Error(`Socket.IO connection unexpectedly succeeded: ${label}.`)); });
    socket.once('connect_error', error => { clearTimeout(timer); socket.disconnect(); resolve(error); });
  });
}

function emitAck(socket, event, payload, timeout = 2500) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event} acknowledgement.`)), timeout);
    socket.emit(event, payload, result => { clearTimeout(timer); resolve(result); });
  });
}

function once(socket, event, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.off(event, handler); reject(new Error(`Timed out waiting for ${event}.`)); }, timeout);
    const handler = value => { clearTimeout(timer); resolve(value); };
    socket.once(event, handler);
  });
}

async function exchangeDraftTicket(instance, link) {
  const params = fragmentParams(link, instance.base);
  const roomCode = params.get('room');
  const accessToken = params.get('access');
  assert.ok(roomCode && accessToken, 'Draft credentials must be present only in the URL fragment.');
  assert.equal(new URL(link, instance.base).searchParams.has('access'), false, 'Draft access token must never be placed in the query string.');
  const result = await request(instance, `/api/public/draft-rooms/${encodeURIComponent(roomCode)}/access`, {
    method: 'POST', body: { accessToken },
  });
  assert.equal(result.response.status, 200);
  return { roomCode, accessToken, ticket: result.payload.socketTicket, room: result.payload.room };
}

let rateServer;
let mainServer;
let productionServer;
const sockets = [];
try {
  // CRITICAL: login/register limits return 429 with Retry-After.
  rateServer = spawnServer({
    port: 3133,
    name: 'rate',
    extraEnv: { LOGIN_FAILURE_LIMIT: '5', REGISTER_RATE_LIMIT_MAX: '3' },
  });
  await waitForServer(rateServer);
  const loginStatuses = [];
  let lastLoginResponse;
  for (let index = 0; index < 6; index += 1) {
    lastLoginResponse = await request(rateServer, '/api/auth/login', {
      method: 'POST', body: { identity: 'rate_admin', password: 'WrongPassword123!' },
    });
    loginStatuses.push(lastLoginResponse.response.status);
  }
  assert.deepEqual(loginStatuses, [401, 401, 401, 401, 401, 429]);
  assert.ok(Number(lastLoginResponse.response.headers.get('retry-after')) > 0, 'Login 429 must include Retry-After.');

  const registerStatuses = [];
  let lastRegisterResponse;
  for (let index = 1; index <= 4; index += 1) {
    lastRegisterResponse = await request(rateServer, '/api/auth/register', {
      method: 'POST',
      body: { username: `rate_user_${index}`, email: `rate_user_${index}@test.local`, displayName: `Rate User ${index}`, password: 'RatePassword123!' },
    });
    registerStatuses.push(lastRegisterResponse.response.status);
  }
  assert.deepEqual(registerStatuses, [201, 201, 201, 429]);
  assert.ok(Number(lastRegisterResponse.response.headers.get('retry-after')) > 0, 'Register 429 must include Retry-After.');
  await stopServer(rateServer.child);
  rateServer = null;

  mainServer = spawnServer({ port: 3134, name: 'security' });
  await waitForServer(mainServer);

  // HIGH: mutation requests without the custom CSRF header are rejected before route logic.
  const noCsrf = await fetch(`${mainServer.base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: 'security_admin', password: 'WrongPassword123!' }),
  });
  assert.equal(noCsrf.status, 403);
  assert.equal((await noCsrf.json()).error, 'Missing CSRF token header.');

  const health = await request(mainServer, '/api/health');
  assert.deepEqual(health.payload, { status: 'ok', version: packageJson.version });
  assert.equal(Object.hasOwn(health.payload, 'database'), false, 'Public health endpoint must not expose the database path.');

  const evilCors = await request(mainServer, '/api/health', { headers: { Origin: 'https://evil.example' } });
  assert.equal(evilCors.response.status, 403, 'Untrusted browser origin must be rejected.');
  const allowedOrigin = mainServer.base;
  const allowedCors = await request(mainServer, '/api/health', { headers: { Origin: allowedOrigin } });
  assert.equal(allowedCors.response.status, 200);
  assert.equal(allowedCors.response.headers.get('access-control-allow-origin'), allowedOrigin);

  const html = await fetch(`${mainServer.base}/auth.html`);
  const csp = String(html.headers.get('content-security-policy') || '');
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.equal(html.headers.get('x-frame-options'), 'DENY');

  const adminLogin = await request(mainServer, '/api/auth/login', {
    method: 'POST', body: { identity: 'security_admin', password: 'AdminSecure123!' },
  });
  assert.equal(adminLogin.response.status, 200);
  let adminToken = adminLogin.payload.token;
  assert.ok(adminToken);
  const secondAdminLogin = await request(mainServer, '/api/auth/login', {
    method: 'POST', body: { identity: 'security_admin', password: 'AdminSecure123!' },
  });
  assert.equal(secondAdminLogin.response.status, 200);
  const secondAdminToken = secondAdminLogin.payload.token;

  // HIGH: password changes require the current password and preserve only the active session.
  const wrongCurrentPassword = await request(mainServer, '/api/auth/change-password', {
    token: adminToken, method: 'POST',
    body: { currentPassword: 'WrongOldPassword!1', newPassword: 'ChangedSecure123!' },
  });
  assert.equal(wrongCurrentPassword.response.status, 401);
  const changedPassword = await request(mainServer, '/api/auth/change-password', {
    token: adminToken, method: 'POST',
    body: { currentPassword: 'AdminSecure123!', newPassword: 'ChangedSecure123!' },
  });
  assert.equal(changedPassword.response.status, 200);
  assert.equal((await request(mainServer, '/api/auth/me', { token: adminToken })).response.status, 200, 'Current session must remain active.');
  assert.equal((await request(mainServer, '/api/auth/me', { token: secondAdminToken })).response.status, 401, 'Other active sessions must be revoked.');
  const oldPasswordLogin = await request(mainServer, '/api/auth/login', {
    method: 'POST', body: { identity: 'security_admin', password: 'AdminSecure123!' },
  });
  assert.equal(oldPasswordLogin.response.status, 401);
  const newPasswordLogin = await request(mainServer, '/api/auth/login', {
    method: 'POST', body: { identity: 'security_admin', password: 'ChangedSecure123!' },
  });
  assert.equal(newPasswordLogin.response.status, 200);
  adminToken = newPasswordLogin.payload.token;

  // Refresh is intentionally CSRF-exempt because its Strict cookie path is limited to /api/auth.
  const refreshCookies = typeof newPasswordLogin.response.headers.getSetCookie === 'function'
    ? newPasswordLogin.response.headers.getSetCookie()
    : [newPasswordLogin.response.headers.get('set-cookie')].filter(Boolean);
  const refreshCookieHeader = refreshCookies.map(value => value.split(';')[0]).join('; ');
  const refreshWithoutCsrf = await fetch(`${mainServer.base}/api/auth/refresh`, {
    method: 'POST', headers: { Cookie: refreshCookieHeader },
  });
  assert.equal(refreshWithoutCsrf.status, 200);
  const refreshedPayload = await refreshWithoutCsrf.json();
  if (refreshedPayload.token) adminToken = refreshedPayload.token;

  const registeredPlayer = await request(mainServer, '/api/auth/register', {
    method: 'POST', body: { username: 'privacy_player', email: 'privacy_player@test.local', displayName: 'Privacy Player', password: 'PrivacyPass123!' },
  });
  assert.equal(registeredPlayer.response.status, 201);
  const playerToken = registeredPlayer.payload.token;

  // HIGH: non-staff user search never reveals email or role, especially for admin accounts.
  const userSearch = await request(mainServer, '/api/users/search?q=security_admin', { token: playerToken });
  assert.equal(userSearch.response.status, 200);
  const adminResult = userSearch.payload.users.find(user => user.username === 'security_admin');
  assert.ok(adminResult);
  assert.equal(Object.hasOwn(adminResult, 'email'), false);
  assert.equal(Object.hasOwn(adminResult, 'role'), false);

  // HIGH: new tournaments are private until explicitly published.
  const createdPrivate = await request(mainServer, '/api/tournaments', {
    token: adminToken, method: 'POST', body: { name: 'Private Security Cup' },
  });
  assert.equal(createdPrivate.response.status, 201);
  assert.equal(Number(createdPrivate.payload.tournament.is_public), 0);
  const privateId = createdPrivate.payload.tournament.id;
  const privateSlug = createdPrivate.payload.tournament.slug;
  let publicList = await request(mainServer, '/api/public/tournaments');
  assert.equal(publicList.payload.tournaments.some(item => item.slug === privateSlug), false);
  await request(mainServer, `/api/tournaments/${privateId}/publish`, { token: adminToken, method: 'POST', body: { confirm: true } });
  publicList = await request(mainServer, '/api/public/tournaments');
  assert.equal(publicList.payload.tournaments.some(item => item.slug === privateSlug), true);
  const pagedPublicList = await request(mainServer, '/api/public/tournaments?limit=1&offset=0');
  assert.equal(pagedPublicList.payload.limit, 1);
  assert.equal(pagedPublicList.payload.offset, 0);
  assert.ok(pagedPublicList.payload.total >= 1);
  assert.ok(pagedPublicList.payload.tournaments.length <= 1);
  await request(mainServer, `/api/tournaments/${privateId}/unpublish`, { token: adminToken, method: 'POST' });
  publicList = await request(mainServer, '/api/public/tournaments');
  assert.equal(publicList.payload.tournaments.some(item => item.slug === privateSlug), false);

  // Use isolated fixture data for private payload, file and Draft Room regressions.
  const fixture = await request(mainServer, '/api/dev-test/suites', { token: adminToken, method: 'POST' });
  assert.equal(fixture.response.status, 201);
  const suite = fixture.payload.suite;
  const live = suite.tournaments.find(item => item.scenario === 'live');
  const hostToken = await exchangeDevAccess(mainServer, suite.quickLinks.host);
  const detail = await request(mainServer, `/api/tournaments/${live.id}`, { token: hostToken });
  const match = detail.payload.matches.find(item => item.team_a_id && item.team_b_id);
  assert.ok(match);

  // HIGH: declared image/png containing HTML must be rejected by magic-byte validation.
  const fakePng = await request(mainServer, `/api/matches/${match.id}/files`, {
    token: hostToken,
    method: 'POST',
    body: {
      purpose: 'chat_attachment', originalName: 'not-really.png', mimeType: 'image/png',
      dataBase64: Buffer.from('<!doctype html><script>document.body.dataset.pwned=1</script>').toString('base64'),
    },
  });
  assert.equal(fakePng.response.status, 400);
  assert.match(fakePng.payload.error, /does not match declared MIME/i);

  const onePixelPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlWkN8AAAAASUVORK5CYII=';
  const validUpload = await request(mainServer, `/api/matches/${match.id}/files`, {
    token: hostToken,
    method: 'POST',
    body: { purpose: 'chat_attachment', originalName: 'pixel.png', mimeType: 'image/png', dataBase64: onePixelPng },
  });
  assert.equal(validUpload.response.status, 201);
  const downloaded = await fetch(`${mainServer.base}/api/files/${validUpload.payload.file.id}`, { headers: { Authorization: `Bearer ${hostToken}` } });
  assert.equal(downloaded.status, 200);
  assert.match(String(downloaded.headers.get('content-disposition')), /^attachment;/i);
  assert.equal(downloaded.headers.get('x-content-type-options'), 'nosniff');
  assert.match(String(downloaded.headers.get('content-security-policy')), /sandbox/);
  assert.equal(Number(downloaded.headers.get('content-length')), Buffer.from(onePixelPng, 'base64').length);

  // CRITICAL: no unauthenticated Socket.IO connection is accepted.
  await expectSocketError(mainServer, {}, 'anonymous');
  const socketCorsProbe = await fetch(`${mainServer.base}/socket.io/?EIO=4&transport=polling`, {
    headers: { Origin: 'https://evil.example' },
  });
  assert.ok([400,403].includes(socketCorsProbe.status), 'Socket.IO Engine handshake must reject untrusted Origin.');

  // CRITICAL: authenticated spectator receives only the public match serializer.
  const spectatorSocket = await connectSocket(mainServer, { auth: { token: playerToken } });
  sockets.push(spectatorSocket);
  const joinResult = await emitAck(spectatorSocket, 'tournament:join', { tournamentId: live.id });
  assert.equal(joinResult.ok, true);
  assert.equal(joinResult.role, 'spectator');
  const publicUpdatePromise = once(spectatorSocket, 'match:updated');
  const privateSentinel = 'PRIVATE-SOCKET-LEAK-SENTINEL';
  const matchPatched = await request(mainServer, `/api/matches/${match.id}`, {
    token: hostToken,
    method: 'PATCH',
    body: { roomCode: 'ROOMSECRET42', notes: 'INTERNAL-NOTE-SENTINEL', privateNotes: privateSentinel, publicNotes: 'Safe public note' },
  });
  assert.equal(matchPatched.response.status, 200);
  const publicUpdate = await publicUpdatePromise;
  for (const forbidden of ['room_code', 'roomCode', 'private_notes', 'privateNotes', 'notes', 'assigned_referee_id', 'assigned_broadcaster_id', 'access_token']) {
    assert.equal(Object.hasOwn(publicUpdate, forbidden), false, `Public Socket payload leaked ${forbidden}.`);
  }
  assert.equal(publicUpdate.publicNotes, 'Safe public note');

  // HIGH: room role credential is exchanged in POST body for a short-lived, single-use ticket.
  const teamLink = suite.quickLinks.draftTeamA;
  const teamParams = fragmentParams(teamLink, mainServer.base);
  const teamRoomCode = teamParams.get('room');
  const teamAccessToken = teamParams.get('access');
  const draftExchangeWithoutCsrf = await fetch(`${mainServer.base}/api/public/draft-rooms/${encodeURIComponent(teamRoomCode)}/access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessToken: teamAccessToken }),
  });
  assert.equal(draftExchangeWithoutCsrf.status, 200, 'Draft access exchange must remain CSRF-exempt.');
  const draftExchangePayload = await draftExchangeWithoutCsrf.json();
  const firstExchange = { roomCode: teamRoomCode, accessToken: teamAccessToken, ticket: draftExchangePayload.socketTicket, room: draftExchangePayload.room };
  const teamSocket = await connectSocket(mainServer, { auth: { draftTicket: firstExchange.ticket } });
  sockets.push(teamSocket);
  const teamJoin = await emitAck(teamSocket, 'draft:join', { roomCode: firstExchange.roomCode });
  assert.equal(teamJoin.ok, true);
  assert.equal(teamJoin.role, 'teamA');
  await expectSocketError(mainServer, { auth: { draftTicket: firstExchange.ticket } }, 'reused-ticket');

  // MEDIUM: unknown keys are rejected, while valid chat works after a fresh reconnect ticket.
  const badPayloadError = once(teamSocket, 'draft:error');
  teamSocket.emit('draft:chat', { roomCode: firstExchange.roomCode, message: 'bad', unexpected: 'key' });
  assert.match((await badPayloadError).message, /invalid|oversized/i);
  teamSocket.disconnect();
  const reconnectExchange = await exchangeDraftTicket(mainServer, teamLink);
  const reconnectedTeamSocket = await connectSocket(mainServer, { auth: { draftTicket: reconnectExchange.ticket } });
  sockets.push(reconnectedTeamSocket);
  const rejoin = await emitAck(reconnectedTeamSocket, 'draft:join', { roomCode: reconnectExchange.roomCode });
  assert.equal(rejoin.ok, true);
  const chatPromise = once(reconnectedTeamSocket, 'draft:chat');
  reconnectedTeamSocket.emit('draft:chat', { roomCode: reconnectExchange.roomCode, message: 'Chat still works after reconnect.' });
  const chatMessage = await chatPromise;
  assert.equal(chatMessage.message, 'Chat still works after reconnect.');

  // MEDIUM: broadcaster remains read-only and cannot send Match Chat.
  const broadcasterExchange = await exchangeDraftTicket(mainServer, suite.quickLinks.broadcast);
  const broadcasterSocket = await connectSocket(mainServer, { auth: { draftTicket: broadcasterExchange.ticket } });
  sockets.push(broadcasterSocket);
  const broadcasterJoin = await emitAck(broadcasterSocket, 'draft:join', { roomCode: broadcasterExchange.roomCode });
  assert.equal(broadcasterJoin.role, 'broadcaster');
  const broadcasterError = once(broadcasterSocket, 'draft:error');
  broadcasterSocket.emit('draft:chat', { roomCode: broadcasterExchange.roomCode, message: 'Should be blocked.' });
  assert.match((await broadcasterError).message, /cannot send chat/i);

  // LOW hardening: staff can rotate all persistent role links after disclosure.
  const rotatedAccess = await request(mainServer, `/api/matches/${match.id}/draft-room/rotate-access`, {
    token: hostToken, method: 'POST',
  });
  assert.equal(rotatedAccess.response.status, 200);
  const oldLinkAfterRotation = await request(mainServer, `/api/public/draft-rooms/${encodeURIComponent(teamRoomCode)}/access`, {
    method: 'POST', body: { accessToken: teamAccessToken },
  });
  assert.equal(oldLinkAfterRotation.response.status, 403, 'A rotated role capability must stop exchanging tickets immediately.');
  const newTeamLink = rotatedAccess.payload.room.links.teamA;
  assert.ok(newTeamLink && newTeamLink !== teamLink);
  const newLinkExchange = await exchangeDraftTicket(mainServer, newTeamLink);
  assert.ok(newLinkExchange.ticket);

  // Static regressions: no remote Google font/hero runtime dependency, no credential query parsing, reconnect is wired on every connection loss.
  const frontendFiles = [
    ...fs.readdirSync(root).filter(name => name.endsWith('.html')).map(name => path.join(root, name)),
    ...fs.readdirSync(path.join(root, 'js')).filter(name => name.endsWith('.js')).map(name => path.join(root, 'js', name)),
  ];
  const frontendText = frontendFiles.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(frontendText, /fonts\.googleapis\.com|fonts\.gstatic\.com|dbg-squadra\.bn-ent\.net/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'js', 'realtime.js'), 'utf8'), /searchParams\.get\(['\"]access['\"]\)/);
  const realtimeSource = fs.readFileSync(path.join(root, 'js', 'realtime.js'), 'utf8');
  assert.match(realtimeSource, /socket\.on\('disconnect'/);
  assert.match(realtimeSource, /connectAndJoin\(\{ initial: false \}\)/);
  assert.match(realtimeSource, /emitLocal\('resync'/);
  const apiSource = fs.readFileSync(path.join(root, 'js', 'api.js'), 'utf8');
  assert.match(apiSource, /export function escapeHtml/);
  assert.match(apiSource, /X-CSRF-Token/);
  const appSource = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
  assert.match(appSource, /getElementById\('cinematic-team'\)\.textContent = teamName/);
  assert.match(appSource, /escapeHtml\(error\?\.message \|\| error\)/);

  await request(mainServer, `/api/dev-test/suites/${fixture.payload.suiteId}`, { token: adminToken, method: 'DELETE' });

  // MEDIUM/LOW: production hides the dev console and sends HSTS on trusted HTTPS requests.
  productionServer = spawnServer({
    port: 3135,
    name: 'production',
    extraEnv: {
      NODE_ENV: 'production',
      APP_ORIGIN: 'https://prod.gekishin.test',
      ADMIN_USERNAME: 'production_admin',
      ADMIN_EMAIL: 'admin@gekishin.test',
      ADMIN_PASSWORD: 'ProdAdmin#7391Secure',
      ALLOW_BEARER_TOKEN_RESPONSE: 'true',
      ALLOW_MANUAL_TOURNAMENT_CREATION: 'false',
      EMAIL_DELIVERY_MODE: 'resend',
      RESEND_API_KEY: 're_security_regression_test_key',
      EMAIL_FROM: 'RendezVu Arena <verify@rendezvu.test>',
      EMAIL_CODE_SECRET: 'production-email-code-secret-2026-very-strong',
    },
  });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`${productionServer.base}/api/health`, {
        redirect: 'manual',
        headers: { Origin: 'https://prod.gekishin.test', 'X-Forwarded-Proto': 'https' },
      });
      if (response.ok) break;
    } catch {}
    if (attempt === 99) throw new Error(`Production test server did not start.
${productionServer.output()}`);
    await new Promise(resolve => setTimeout(resolve, 60));
  }
  const productionLogin = await request(productionServer, '/api/auth/login', {
    method: 'POST',
    headers: { Origin: 'https://prod.gekishin.test', 'X-Forwarded-Proto': 'https' },
    body: { identity: 'production_admin', password: 'ProdAdmin#7391Secure' },
  });
  assert.equal(productionLogin.response.status, 200);
  const productionHeaders = { Origin: 'https://prod.gekishin.test', 'X-Forwarded-Proto': 'https' };
  const hiddenDevSuites = await request(productionServer, '/api/dev-test/suites', {
    token: productionLogin.payload.token, headers: productionHeaders,
  });
  assert.equal(hiddenDevSuites.response.status, 404);
  const hiddenDevSuiteCreate = await request(productionServer, '/api/dev-test/suites', {
    token: productionLogin.payload.token, method: 'POST', headers: productionHeaders,
  });
  assert.equal(hiddenDevSuiteCreate.response.status, 404);
  const hiddenDevSuiteDelete = await request(productionServer, '/api/dev-test/suites/1', {
    token: productionLogin.payload.token, method: 'DELETE', headers: productionHeaders,
  });
  assert.equal(hiddenDevSuiteDelete.response.status, 404);
  const productionHtml = await fetch(`${productionServer.base}/auth.html`, {
    headers: { Origin: 'https://prod.gekishin.test', 'X-Forwarded-Proto': 'https' },
  });
  assert.match(String(productionHtml.headers.get('strict-transport-security')), /max-age=63072000/i);
  await stopServer(productionServer.child);
  productionServer = null;
  console.log('Security regression suite passed: rate limits, Socket isolation, CORS, privacy, MIME, reconnect, CSP and visibility.');
} finally {
  sockets.forEach(socket => { try { socket.disconnect(); } catch {} });
  await stopServer(rateServer?.child);
  await stopServer(mainServer?.child);
  await stopServer(productionServer?.child);
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gekishin-locked-seed-'));
const port = 3140;
const base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    DATABASE_PATH: path.join(tempRoot, 'locked-seed.sqlite'),
    UPLOAD_PATH: path.join(tempRoot, 'uploads'),
    AUTH_SECRET: 'locked-seed-regression-secret-2026-very-strong',
    ADMIN_USERNAME: 'locked_seed_admin',
    ADMIN_EMAIL: 'locked-seed-admin@test.local',
    ADMIN_PASSWORD: 'AdminSecure123!',
    ALLOW_DIRECT_HOST_REGISTRATION: 'true',
    ALLOW_MANUAL_TOURNAMENT_CREATION: 'true',
    API_RATE_LIMIT_PER_MINUTE: '10000',
    REGISTER_RATE_LIMIT_MAX: '10000',
    LOGIN_FAILURE_LIMIT: '10000',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
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
  for (let attempt = 0; attempt < 100; attempt += 1) {
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
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

try {
  await waitForServer();

  const hostRegistration = await request('/api/auth/register', {
    method: 'POST',
    body: {
      username: 'locked_seed_host',
      email: 'locked-seed-host@test.local',
      displayName: 'Locked Seed Host',
      password: 'HostSecure123!',
      role: 'host',
    },
  });
  assert.equal(hostRegistration.response.status, 201);
  assert.equal(hostRegistration.payload.user.role, 'host');
  const hostToken = hostRegistration.payload.token;

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { identity: 'locked_seed_admin', password: 'AdminSecure123!' },
  });
  assert.equal(adminLogin.response.status, 200);
  assert.equal(adminLogin.payload.user.role, 'admin');
  const adminToken = adminLogin.payload.token;

  const createdTournament = await request('/api/tournaments', {
    token: hostToken,
    method: 'POST',
    body: { name: 'Locked Seed Regression', status: 'preparing' },
  });
  assert.equal(createdTournament.response.status, 201);
  const tournamentId = createdTournament.payload.tournament.id;

  const createdTeam = await request(`/api/tournaments/${tournamentId}/teams`, {
    token: hostToken,
    method: 'POST',
    body: { name: 'Immutable Seed Team' },
  });
  assert.equal(createdTeam.response.status, 201);
  const teamId = createdTeam.payload.team.id;

  const initialLock = await request(`/api/tournaments/${tournamentId}/seeding`, {
    token: hostToken,
    method: 'PUT',
    body: { seeds: [{ teamId, seed: 1, seedLocked: true }] },
  });
  assert.equal(initialLock.response.status, 200);
  assert.equal(initialLock.payload.teams[0].seed, 1);
  assert.equal(initialLock.payload.teams[0].seed_locked, 1);

  const blockedCombinedUnlockAndMove = await request(`/api/tournaments/${tournamentId}/seeding`, {
    token: hostToken,
    method: 'PUT',
    body: { seeds: [{ teamId, seed: 18, seedLocked: false }] },
  });
  assert.equal(blockedCombinedUnlockAndMove.response.status, 409);
  assert.match(blockedCombinedUnlockAndMove.payload.error, /locked/i);

  const afterBlockedSave = await request(`/api/tournaments/${tournamentId}`, { token: hostToken });
  assert.equal(afterBlockedSave.response.status, 200);
  assert.equal(afterBlockedSave.payload.teams[0].seed, 1);
  assert.equal(afterBlockedSave.payload.teams[0].seed_locked, 1);

  const blockedPatchBypass = await request(`/api/tournaments/${tournamentId}/teams/${teamId}`, {
    token: hostToken,
    method: 'PATCH',
    body: { seed: 7, seedLocked: false },
  });
  assert.equal(blockedPatchBypass.response.status, 409);

  const explicitUnlock = await request(`/api/tournaments/${tournamentId}/seeding`, {
    token: hostToken,
    method: 'PUT',
    body: { seeds: [{ teamId, seed: 1, seedLocked: false }] },
  });
  assert.equal(explicitUnlock.response.status, 200);
  assert.equal(explicitUnlock.payload.teams[0].seed, 1);
  assert.equal(explicitUnlock.payload.teams[0].seed_locked, 0);

  const ownerMoveAfterUnlock = await request(`/api/tournaments/${tournamentId}/seeding`, {
    token: hostToken,
    method: 'PUT',
    body: { seeds: [{ teamId, seed: 2, seedLocked: true }] },
  });
  assert.equal(ownerMoveAfterUnlock.response.status, 200);
  assert.equal(ownerMoveAfterUnlock.payload.teams[0].seed, 2);
  assert.equal(ownerMoveAfterUnlock.payload.teams[0].seed_locked, 1);

  const adminOverride = await request(`/api/tournaments/${tournamentId}/seeding`, {
    token: adminToken,
    method: 'PUT',
    body: { seeds: [{ teamId, seed: 9, seedLocked: false }] },
  });
  assert.equal(adminOverride.response.status, 200);
  assert.equal(adminOverride.payload.teams[0].seed, 9);
  assert.equal(adminOverride.payload.teams[0].seed_locked, 0);

  console.log('Locked Seed regression checks passed: non-admin requires explicit unlock; admin can override.');
} finally {
  await stopServer();
}

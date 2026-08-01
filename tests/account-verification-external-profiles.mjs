import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gekishin-account-verification-'));
const databasePath = path.join(tempRoot, 'account-verification.sqlite');
const port = 3152;
const base = `http://127.0.0.1:${port}`;
const authSecret = 'account-verification-auth-secret-2026-strong';
const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    DATABASE_PATH: databasePath,
    UPLOAD_PATH: path.join(tempRoot, 'uploads'),
    AUTH_SECRET: authSecret,
    ADMIN_USERNAME: 'account_admin',
    ADMIN_EMAIL: 'account-admin@test.local',
    ADMIN_PASSWORD: 'AdminSecure123!',
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
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Server did not start.\n${output}`);
}
async function request(url, { token, method = 'GET', body, redirect = 'follow' } = {}) {
  const response = await fetch(`${base}${url}`, {
    method,
    redirect,
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
function seedStartggTournament({ hostUserId }) {
  const db = new DatabaseSync(databasePath);
  try {
    const tournamentId = Number(db.prepare(`INSERT INTO tournaments(
      host_user_id,name,slug,description,source_platform,source_url,source_external_id,source_sync_status,status,is_public
    ) VALUES (?,?,?,?,?,?,?,?,?,1)`).run(
      hostUserId, 'Manual Profile Cup', 'oauth-profile-cup', 'start.gg pasted-profile eligibility test',
      'startgg', 'https://www.start.gg/tournament/oauth-profile-cup', 'oauth-profile-cup', 'api_verified', 'registration_open'
    ).lastInsertRowid);
    const teamId = Number(db.prepare(`INSERT INTO teams(tournament_id,name,tag,source,status,team_status)
      VALUES (?,?,?,'startgg','pending','captain_pending')`).run(tournamentId, 'Verified Profile Squad', 'VPS').lastInsertRowid);
    const matchingMemberId = Number(db.prepare(`INSERT INTO team_members(
      team_id,display_name,gamer_tag,member_role,external_provider,external_user_id,external_profile_slug
    ) VALUES (?,?,?,'player','startgg',?,?)`).run(teamId, 'Verified Entrant', 'VerifiedPlayer', '9988', '4bf3a5e0').lastInsertRowid);
    const mismatchMemberId = Number(db.prepare(`INSERT INTO team_members(
      team_id,display_name,gamer_tag,member_role,external_provider,external_user_id,external_profile_slug
    ) VALUES (?,?,?,'player','startgg',?,?)`).run(teamId, 'Different Entrant', 'OtherPlayer', '7777', 'different-user').lastInsertRowid);
    return { tournamentId, teamId, matchingMemberId, mismatchMemberId };
  } finally { db.close(); }
}

try {
  await waitForServer();

  const registration = await request('/api/auth/register', {
    method: 'POST',
    body: {
      username: 'public_test_player',
      password: 'PlayerSecure123!',
      passwordConfirmation: 'PlayerSecure123!',
    },
  });
  assert.equal(registration.response.status, 201);
  assert.equal(registration.payload.user.emailVerified, true);
  assert.equal(registration.payload.user.email, '');
  assert.equal(registration.payload.user.displayName, 'public_test_player');
  assert.equal(registration.payload.verificationRequired, false);
  const playerToken = registration.payload.token;
  const playerId = registration.payload.user.id;

  const db = new DatabaseSync(databasePath);
  const storedAccount = db.prepare('SELECT email,email_verified_at FROM users WHERE id=?').get(playerId);
  const challengeCount = db.prepare('SELECT COUNT(*) count FROM email_verification_challenges WHERE user_id=?').get(playerId).count;
  db.close();
  assert.match(storedAccount.email, /^[0-9a-f-]+@accounts\.rendezvu\.invalid$/i);
  assert.ok(storedAccount.email_verified_at);
  assert.equal(Number(challengeCount), 0, 'Registration must not create or send an email challenge.');

  const mismatchedRegistration = await request('/api/auth/register', {
    method: 'POST',
    body: { username: 'password_mismatch', password: 'PlayerSecure123!', passwordConfirmation: 'PlayerSecure456!' },
  });
  assert.equal(mismatchedRegistration.response.status, 400);
  assert.match(mismatchedRegistration.payload.error, /do not match/i);

  const verificationStatus = await request('/api/auth/email-verification', { token: playerToken });
  assert.equal(verificationStatus.response.status, 200);
  assert.equal(verificationStatus.payload.enabled, false);
  assert.equal(verificationStatus.payload.verified, true);
  assert.equal(verificationStatus.payload.challenge, null);

  const quickDraft = await request('/api/quick-draft-rooms', {
    token: playerToken,
    method: 'POST',
    body: { config: {
      sessionId: 'public-test-account-room', teamA: 'Blue', teamB: 'Red', format: 'BO1',
      seriesRule: 'normal', timerSeconds: 30, heroBans: 2, enableCoinFlip: false, enableDivineDraw: false,
    } },
  });
  assert.equal(quickDraft.response.status, 201);

  const savedStartgg = await request('/api/profile/external/manual', {
    token: playerToken,
    method: 'POST',
    body: { provider: 'startgg', profileUrl: 'https://www.start.gg/user/4bf3a5e0' },
  });
  assert.equal(savedStartgg.response.status, 201);
  assert.equal(savedStartgg.payload.profile.verificationStatus, 'unverified');
  assert.equal(savedStartgg.payload.profile.providerSlug, '4bf3a5e0');

  const savedTonamel = await request('/api/profile/external/manual', {
    token: playerToken,
    method: 'POST',
    body: { provider: 'tonamel', profileUrl: 'https://tonamel.com/player/test-player-tonamel' },
  });
  assert.equal(savedTonamel.response.status, 201);
  assert.equal(savedTonamel.payload.profile.verificationStatus, 'unverified');
  assert.equal(savedTonamel.payload.profile.providerSlug, 'test-player-tonamel');
  assert.equal(savedTonamel.payload.profile.displayName, 'test-player-tonamel');

  const savedChallonge = await request('/api/profile/external/manual', {
    token: playerToken,
    method: 'POST',
    body: { provider: 'challonge', profileUrl: 'https://challonge.com/users/test-player-challonge' },
  });
  assert.equal(savedChallonge.response.status, 201);
  assert.equal(savedChallonge.payload.profile.verificationStatus, 'unverified');
  assert.equal(savedChallonge.payload.profile.providerSlug, 'test-player-challonge');
  assert.equal(savedChallonge.payload.profile.displayName, 'test-player-challonge');

  const profiles = await request('/api/profile/external', { token: playerToken });
  assert.equal(profiles.response.status, 200);
  assert.equal(profiles.payload.providers.startgg.manual, true);
  assert.equal(profiles.payload.providers.startgg.oauth, false);
  assert.ok(profiles.payload.profiles.some(profile => profile.provider === 'startgg'));
  assert.ok(profiles.payload.profiles.some(profile => profile.provider === 'tonamel'));
  assert.ok(profiles.payload.profiles.some(profile => profile.provider === 'challonge'));

  const savedProfileSettings = await request('/api/profile/settings', {
    token: playerToken,
    method: 'PATCH',
    body: {
      displayName: 'Email Verified Player', gamerTag: 'VerifiedPlayer', bio: 'Tournament player profile.',
      profileVisibility: 'private', showExternalProfiles: true,
    },
  });
  assert.equal(savedProfileSettings.response.status, 200);
  assert.equal(savedProfileSettings.payload.profile.profileVisibility, 'private');
  const privateProfile = await request('/api/profiles/public_test_player');
  assert.equal(privateProfile.response.status, 403);

  const changedPassword = await request('/api/auth/change-password', {
    token: playerToken,
    method: 'POST',
    body: { currentPassword: 'PlayerSecure123!', newPassword: 'PlayerSecure456!' },
  });
  assert.equal(changedPassword.response.status, 200);

  const oldPasswordLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { identity: 'public_test_player', password: 'PlayerSecure123!' },
  });
  assert.equal(oldPasswordLogin.response.status, 401);
  const newPasswordLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { identity: 'public_test_player', password: 'PlayerSecure456!' },
  });
  assert.equal(newPasswordLogin.response.status, 200);

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { identity: 'account_admin', password: 'AdminSecure123!' },
  });
  assert.equal(adminLogin.response.status, 200);
  const adminId = adminLogin.payload.user.id;

  const seeded = seedStartggTournament({ hostUserId: adminId });
  const eligibility = await request('/api/tournaments/oauth-profile-cup/eligibility', { token: playerToken });
  assert.equal(eligibility.response.status, 200);
  assert.equal(eligibility.payload.eligible, true);
  assert.equal(eligibility.payload.requirements.emailVerified, true);
  assert.equal(eligibility.payload.requirements.providerVerified, true);
  assert.equal(eligibility.payload.requirements.entrantMatched, true);
  assert.equal(eligibility.payload.matchingMembers[0].id, seeded.matchingMemberId);

  const mismatchedJoin = await request('/api/tournaments/oauth-profile-cup/join-requests', {
    token: playerToken,
    method: 'POST',
    body: {
      teamId: seeded.teamId,
      memberId: seeded.mismatchMemberId,
      requestedRole: 'player',
      gamerTag: 'OtherPlayer',
    },
  });
  assert.equal(mismatchedJoin.response.status, 403);
  assert.match(mismatchedJoin.payload.error, /different start\.gg profile/i);

  const matchingJoin = await request('/api/tournaments/oauth-profile-cup/join-requests', {
    token: playerToken,
    method: 'POST',
    body: {
      teamId: seeded.teamId,
      memberId: seeded.matchingMemberId,
      requestedRole: 'player',
      gamerTag: 'VerifiedPlayer',
    },
  });
  assert.equal(matchingJoin.response.status, 201);
  assert.ok(matchingJoin.payload.request.external_profile_id);
  const snapshot = JSON.parse(matchingJoin.payload.request.provider_snapshot_json);
  assert.equal(snapshot.provider, 'startgg');
  assert.equal(snapshot.providerUserId, '');
  assert.equal(snapshot.providerSlug, '4bf3a5e0');

  const joinRequestId = matchingJoin.payload.request.id;
  const blockedReviewRemap = await request(`/api/tournaments/${seeded.tournamentId}/join-requests/${joinRequestId}/review`, {
    token: adminLogin.payload.token,
    method: 'POST',
    body: { decision: 'approve', teamId: seeded.teamId, memberId: seeded.mismatchMemberId },
  });
  assert.equal(blockedReviewRemap.response.status, 400);
  assert.match(blockedReviewRemap.payload.error, /different linked start\.gg profile/i);

  const approved = await request(`/api/tournaments/${seeded.tournamentId}/join-requests/${joinRequestId}/review`, {
    token: adminLogin.payload.token,
    method: 'POST',
    body: { decision: 'approve', teamId: seeded.teamId, memberId: seeded.matchingMemberId },
  });
  assert.equal(approved.response.status, 200);

  const disconnected = await request('/api/profile/external/tonamel', { token: playerToken, method: 'DELETE' });
  assert.equal(disconnected.response.status, 200);

  console.log('Public test account and manual tournament profile regression checks passed.');
} finally {
  await stopServer();
}

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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
const emailSecret = 'account-verification-email-secret-2026-strong';
const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    DATABASE_PATH: databasePath,
    UPLOAD_PATH: path.join(tempRoot, 'uploads'),
    AUTH_SECRET: authSecret,
    EMAIL_CODE_SECRET: emailSecret,
    EMAIL_DELIVERY_MODE: 'memory',
    REQUIRE_EMAIL_VERIFICATION_IN_TEST: 'true',
    ADMIN_USERNAME: 'account_admin',
    ADMIN_EMAIL: 'account-admin@test.local',
    ADMIN_PASSWORD: 'AdminSecure123!',
    ALLOW_MANUAL_TOURNAMENT_CREATION: 'true',
    API_RATE_LIMIT_PER_MINUTE: '10000',
    REGISTER_RATE_LIMIT_MAX: '10000',
    LOGIN_FAILURE_LIMIT: '10000',
    EMAIL_VERIFICATION_SEND_LIMIT: '10000',
    EMAIL_VERIFICATION_ATTEMPT_LIMIT: '10000',
    STARTGG_CLIENT_ID: 'test-startgg-client',
    STARTGG_CLIENT_SECRET: 'test-startgg-secret',
    STARTGG_REDIRECT_URI: `${base}/api/connections/startgg/callback`,
    STARTGG_TOKEN_ENCRYPTION_KEY: 'test-startgg-token-encryption-key-2026-strong',
    CHALLONGE_CLIENT_ID: 'test-challonge-client',
    CHALLONGE_CLIENT_SECRET: 'test-challonge-secret',
    CHALLONGE_REDIRECT_URI: `${base}/api/connections/challonge/callback`,
    CHALLONGE_TOKEN_ENCRYPTION_KEY: 'test-challonge-token-encryption-key-2026-strong',
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
function setKnownVerificationCode(userId, code) {
  const db = new DatabaseSync(databasePath);
  try {
    const hash = crypto.createHmac('sha256', emailSecret).update(`${userId}:${code}`).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const resendAvailableAt = new Date(Date.now() - 1000).toISOString();
    const changed = db.prepare(`UPDATE email_verification_challenges SET code_hash=?,attempts=0,used_at=NULL,
      expires_at=?,resend_available_at=?
      WHERE id=(SELECT id FROM email_verification_challenges WHERE user_id=? ORDER BY id DESC LIMIT 1)`)
      .run(hash, expiresAt, resendAvailableAt, userId);
    assert.equal(Number(changed.changes), 1, 'A pending email verification challenge must exist.');
  } finally { db.close(); }
}
function setKnownEmailChangeCode(userId, newEmail, code) {
  const db = new DatabaseSync(databasePath);
  try {
    const normalizedEmail = String(newEmail).trim().toLowerCase();
    const hash = crypto.createHmac('sha256', emailSecret).update(`${userId}:${normalizedEmail}:${code}`).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const changed = db.prepare(`UPDATE email_change_challenges SET code_hash=?,attempts=0,used_at=NULL,expires_at=?
      WHERE id=(SELECT id FROM email_change_challenges WHERE user_id=? ORDER BY id DESC LIMIT 1)`)
      .run(hash, expiresAt, userId);
    assert.equal(Number(changed.changes), 1, 'An active email-change challenge must exist.');
  } finally { db.close(); }
}

function seedStartggTournament({ hostUserId, playerUserId }) {
  const db = new DatabaseSync(databasePath);
  try {
    const tournamentId = Number(db.prepare(`INSERT INTO tournaments(
      host_user_id,name,slug,description,source_platform,source_url,source_external_id,source_sync_status,status,is_public
    ) VALUES (?,?,?,?,?,?,?,?,?,1)`).run(
      hostUserId, 'OAuth Profile Cup', 'oauth-profile-cup', 'start.gg profile eligibility test',
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
    db.prepare(`INSERT INTO external_profiles(
      user_id,provider,provider_user_id,provider_slug,profile_url,display_name,gamer_tag,verification_status,verified_at,metadata_json
    ) VALUES (?,'startgg',?,?,?,?,?,'verified',CURRENT_TIMESTAMP,'{}')`).run(
      playerUserId, '9988', '4bf3a5e0', 'https://www.start.gg/user/4bf3a5e0', 'VerifiedPlayer', 'VerifiedPlayer'
    );
    return { tournamentId, teamId, matchingMemberId, mismatchMemberId };
  } finally { db.close(); }
}

try {
  await waitForServer();

  const registration = await request('/api/auth/register', {
    method: 'POST',
    body: {
      username: 'email_pending_player',
      email: 'email-pending-player@gmail.com',
      displayName: 'Email Pending Player',
      password: 'PlayerSecure123!',
    },
  });
  assert.equal(registration.response.status, 201);
  assert.equal(registration.payload.user.emailVerified, false);
  assert.equal(registration.payload.verificationRequired, true);
  const playerToken = registration.payload.token;
  const playerId = registration.payload.user.id;

  const verificationStatus = await request('/api/auth/email-verification', { token: playerToken });
  assert.equal(verificationStatus.response.status, 200);
  assert.equal(verificationStatus.payload.verified, false);
  assert.equal(verificationStatus.payload.challenge.active, true);

  const blockedQuickDraft = await request('/api/quick-draft-rooms', {
    token: playerToken,
    method: 'POST',
    body: {},
  });
  assert.equal(blockedQuickDraft.response.status, 403);
  assert.equal(blockedQuickDraft.payload.code, 'EMAIL_VERIFICATION_REQUIRED');

  const blockedProfile = await request('/api/profile/external/manual', {
    token: playerToken,
    method: 'POST',
    body: { provider: 'tonamel', profileUrl: 'https://tonamel.com/u/pending-player' },
  });
  assert.equal(blockedProfile.response.status, 403);

  setKnownVerificationCode(playerId, '123456');
  const wrongCode = await request('/api/auth/verify-email', {
    token: playerToken,
    method: 'POST',
    body: { code: '654321' },
  });
  assert.equal(wrongCode.response.status, 400);
  assert.equal(wrongCode.payload.attemptsRemaining, 4);

  const verified = await request('/api/auth/verify-email', {
    token: playerToken,
    method: 'POST',
    body: { code: '123456' },
  });
  assert.equal(verified.response.status, 200);
  assert.equal(verified.payload.user.emailVerified, true);

  const reusedCode = await request('/api/auth/verify-email', {
    token: playerToken,
    method: 'POST',
    body: { code: '123456' },
  });
  assert.equal(reusedCode.response.status, 200);
  assert.equal(reusedCode.payload.alreadyVerified, true);

  const invalidManualStartgg = await request('/api/profile/external/manual', {
    token: playerToken,
    method: 'POST',
    body: { provider: 'startgg', profileUrl: 'https://www.start.gg/user/4bf3a5e0' },
  });
  assert.equal(invalidManualStartgg.response.status, 400, 'start.gg must be verified by OAuth, not a pasted URL.');

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
  assert.ok(profiles.payload.profiles.some(profile => profile.provider === 'tonamel'));
  assert.ok(profiles.payload.profiles.some(profile => profile.provider === 'challonge'));

  const oauthStart = await request('/api/connections/startgg?return=%2Fportal.html', {
    token: playerToken,
    redirect: 'manual',
  });
  assert.equal(oauthStart.response.status, 302);
  const authorizationUrl = new URL(oauthStart.response.headers.get('location'));
  assert.equal(authorizationUrl.hostname, 'start.gg');
  assert.equal(authorizationUrl.searchParams.get('scope'), 'user.identity');
  assert.ok(authorizationUrl.searchParams.get('state'));

  const challongeOauthStart = await request('/api/connections/challonge?return=%2Fportal.html', {
    token: playerToken,
    redirect: 'manual',
  });
  assert.equal(challongeOauthStart.response.status, 302);
  const challongeAuthorizationUrl = new URL(challongeOauthStart.response.headers.get('location'));
  assert.equal(challongeAuthorizationUrl.hostname, 'api.challonge.com');
  assert.equal(challongeAuthorizationUrl.searchParams.get('scope'), 'me');
  assert.ok(challongeAuthorizationUrl.searchParams.get('state'));

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
  const privateProfile = await request('/api/profiles/email_pending_player');
  assert.equal(privateProfile.response.status, 403);

  const changedEmail = 'email-changed-player@gmail.com';
  const requestedEmailChange = await request('/api/auth/change-email/request', {
    token: playerToken,
    method: 'POST',
    body: { currentPassword: 'PlayerSecure123!', newEmail: changedEmail },
  });
  assert.equal(requestedEmailChange.response.status, 200);
  setKnownEmailChangeCode(playerId, changedEmail, '234567');
  const confirmedEmailChange = await request('/api/auth/change-email/confirm', {
    token: playerToken,
    method: 'POST',
    body: { code: '234567' },
  });
  assert.equal(confirmedEmailChange.response.status, 200);
  assert.equal(confirmedEmailChange.payload.user.email, changedEmail);

  const changedPassword = await request('/api/auth/change-password', {
    token: playerToken,
    method: 'POST',
    body: { currentPassword: 'PlayerSecure123!', newPassword: 'PlayerSecure456!' },
  });
  assert.equal(changedPassword.response.status, 200);

  const oldPasswordLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { identity: changedEmail, password: 'PlayerSecure123!' },
  });
  assert.equal(oldPasswordLogin.response.status, 401);
  const newPasswordLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { identity: changedEmail, password: 'PlayerSecure456!' },
  });
  assert.equal(newPasswordLogin.response.status, 200);

  const adminLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { identity: 'account_admin', password: 'AdminSecure123!' },
  });
  assert.equal(adminLogin.response.status, 200);
  const adminId = adminLogin.payload.user.id;

  const seeded = seedStartggTournament({ hostUserId: adminId, playerUserId: playerId });
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
  assert.equal(snapshot.providerUserId, '9988');
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

  console.log('Account email verification and external tournament profile regression checks passed.');
} finally {
  await stopServer();
}

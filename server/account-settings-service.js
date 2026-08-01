const crypto = require('node:crypto');
const { db, transaction } = require('./db');
const { sendEmailChangeVerification } = require('./email-service');
const { parseStoredTimestamp } = require('./email-verification-service');

const EMAIL_CHANGE_TTL_MS = 10 * 60 * 1000;
const EMAIL_CHANGE_MAX_ATTEMPTS = 5;

function codeSecret() {
  const value = String(process.env.EMAIL_CODE_SECRET || process.env.AUTH_SECRET || '');
  if (value.length < 32) throw new Error('EMAIL_CODE_SECRET or AUTH_SECRET must contain at least 32 characters.');
  return value;
}
function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Enter a valid email address.');
  return email;
}
function hashEmailChangeCode(userId, newEmail, code) {
  return crypto.createHmac('sha256', codeSecret()).update(`${Number(userId)}:${normalizeEmail(newEmail)}:${String(code)}`).digest('hex');
}
function publicAccountSettings(userId) {
  const row = db.prepare(`SELECT id,username,email,display_name,gamer_tag,bio,profile_visibility,show_external_profiles,
    email_verified_at,created_at FROM users WHERE id=?`).get(userId);
  if (!row) throw new Error('Account not found.');
  return {
    id: row.id,
    username: row.username,
    email: /@accounts\.rendezvu\.invalid$/i.test(String(row.email || '')) ? '' : row.email,
    displayName: row.display_name,
    gamerTag: row.gamer_tag || '',
    bio: row.bio || '',
    profileVisibility: row.profile_visibility === 'private' ? 'private' : 'public',
    showExternalProfiles: Boolean(row.show_external_profiles),
    emailVerified: Boolean(row.email_verified_at),
    emailVerifiedAt: row.email_verified_at || null,
    createdAt: row.created_at,
  };
}
function updateProfileSettings(userId, input = {}) {
  const displayName = String(input.displayName || '').trim().slice(0, 100);
  const gamerTag = String(input.gamerTag || '').trim().slice(0, 80);
  const bio = String(input.bio || '').trim().slice(0, 500);
  const profileVisibility = String(input.profileVisibility || 'public') === 'private' ? 'private' : 'public';
  const showExternalProfiles = input.showExternalProfiles ? 1 : 0;
  if (!displayName) throw new Error('Display name is required.');
  db.prepare(`UPDATE users SET display_name=?,gamer_tag=?,bio=?,profile_visibility=?,show_external_profiles=? WHERE id=?`)
    .run(displayName, gamerTag, bio, profileVisibility, showExternalProfiles, userId);
  return publicAccountSettings(userId);
}
async function issueEmailChange({ userId, newEmail, locale = 'en' }) {
  const email = normalizeEmail(newEmail);
  const user = db.prepare('SELECT id,email FROM users WHERE id=?').get(userId);
  if (!user) throw new Error('Account not found.');
  if (String(user.email).toLowerCase() === email) throw new Error('This is already your current email address.');
  const conflict = db.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE AND id!=?').get(email, userId);
  if (conflict) throw new Error('This email address is already in use.');
  const code = crypto.randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_MS).toISOString();
  const result = transaction(() => {
    db.prepare(`UPDATE email_change_challenges SET used_at=COALESCE(used_at,CURRENT_TIMESTAMP)
      WHERE user_id=? AND used_at IS NULL`).run(userId);
    return db.prepare(`INSERT INTO email_change_challenges(user_id,new_email,code_hash,expires_at)
      VALUES (?,?,?,?)`).run(userId, email, hashEmailChangeCode(userId, email, code), expiresAt);
  });
  try {
    await sendEmailChangeVerification({
      email,
      code,
      locale,
      idempotencyKey: `change-email-${userId}-${Number(result.lastInsertRowid)}`,
    });
  } catch (error) {
    db.prepare('DELETE FROM email_change_challenges WHERE id=?').run(Number(result.lastInsertRowid));
    throw error;
  }
  return { sent: true, newEmail: email, expiresAt };
}
function confirmEmailChange({ userId, code, currentSessionId }) {
  const normalized = String(code || '').trim();
  if (!/^\d{6}$/.test(normalized)) throw new Error('Enter the six-digit confirmation code.');
  return transaction(() => {
    const challenge = db.prepare(`SELECT * FROM email_change_challenges
      WHERE user_id=? AND used_at IS NULL ORDER BY id DESC LIMIT 1`).get(userId);
    if (!challenge) throw new Error('No active email-change request was found.');
    if (parseStoredTimestamp(challenge.expires_at) <= Date.now()) {
      db.prepare('UPDATE email_change_challenges SET used_at=CURRENT_TIMESTAMP WHERE id=?').run(challenge.id);
      throw new Error('The email-change code has expired. Request a new code.');
    }
    if (Number(challenge.attempts || 0) >= EMAIL_CHANGE_MAX_ATTEMPTS) {
      db.prepare('UPDATE email_change_challenges SET used_at=CURRENT_TIMESTAMP WHERE id=?').run(challenge.id);
      throw new Error('Too many incorrect attempts. Request a new code.');
    }
    const expected = Buffer.from(String(challenge.code_hash), 'hex');
    const actual = Buffer.from(hashEmailChangeCode(userId, challenge.new_email, normalized), 'hex');
    const correct = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    if (!correct) {
      const attempts = Number(challenge.attempts || 0) + 1;
      db.prepare(`UPDATE email_change_challenges SET attempts=?,used_at=CASE WHEN ?>=? THEN CURRENT_TIMESTAMP ELSE used_at END WHERE id=?`)
        .run(attempts, attempts, EMAIL_CHANGE_MAX_ATTEMPTS, challenge.id);
      const error = new Error('The email-change code is incorrect.');
      error.code = 'INVALID_CODE';
      error.attemptsRemaining = Math.max(0, EMAIL_CHANGE_MAX_ATTEMPTS - attempts);
      throw error;
    }
    const conflict = db.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE AND id!=?').get(challenge.new_email, userId);
    if (conflict) throw new Error('This email address is already in use.');
    db.prepare('UPDATE email_change_challenges SET used_at=CURRENT_TIMESTAMP WHERE id=?').run(challenge.id);
    db.prepare('UPDATE users SET email=?,email_verified_at=CURRENT_TIMESTAMP WHERE id=?').run(challenge.new_email, userId);
    db.prepare(`UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP,revoke_reason='email_changed'
      WHERE user_id=? AND id!=? AND revoked_at IS NULL`).run(userId, currentSessionId);
    return publicAccountSettings(userId);
  });
}
function publicUserProfile(username, viewer = null) {
  const user = db.prepare(`SELECT id,username,display_name,gamer_tag,bio,profile_visibility,show_external_profiles,created_at
    FROM users WHERE username=? COLLATE NOCASE AND is_active=1`).get(String(username || '').trim());
  if (!user) return null;
  const owner = Number(viewer?.id || 0) === Number(user.id);
  const admin = viewer?.role === 'admin';
  if (user.profile_visibility === 'private' && !owner && !admin) return { private: true, username: user.username };
  const profile = {
    private: false,
    username: user.username,
    displayName: user.display_name,
    gamerTag: user.gamer_tag || '',
    bio: user.bio || '',
    createdAt: user.created_at,
    externalProfiles: [],
  };
  if (user.show_external_profiles || owner || admin) {
    profile.externalProfiles = db.prepare(`SELECT provider,profile_url,display_name,gamer_tag,verification_status,verified_at
      FROM external_profiles WHERE user_id=? ORDER BY provider`).all(user.id).map(row => ({
        provider: row.provider,
        profileUrl: row.profile_url,
        displayName: row.display_name,
        gamerTag: row.gamer_tag,
        verificationStatus: row.verification_status,
        verifiedAt: row.verified_at,
      }));
  }
  return profile;
}

module.exports = {
  EMAIL_CHANGE_MAX_ATTEMPTS,
  confirmEmailChange,
  hashEmailChangeCode,
  issueEmailChange,
  publicAccountSettings,
  publicUserProfile,
  updateProfileSettings,
};

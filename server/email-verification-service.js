const crypto = require('node:crypto');
const { db, transaction } = require('./db');
const { sendVerificationEmail } = require('./email-service');

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_DELAY_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

function codeSecret() {
  const value = String(process.env.EMAIL_CODE_SECRET || process.env.AUTH_SECRET || '');
  if (value.length < 32) throw new Error('EMAIL_CODE_SECRET or AUTH_SECRET must contain at least 32 characters.');
  return value;
}

function hashCode(userId, code) {
  return crypto.createHmac('sha256', codeSecret()).update(`${Number(userId)}:${String(code)}`).digest('hex');
}

function generateCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

// SQLite CURRENT_TIMESTAMP values do not include a timezone marker. Treat those values as UTC
// so verification behaves identically on Windows, Linux and every local timezone.
function parseStoredTimestamp(value) {
  const text = String(value || '').trim();
  if (!text) return NaN;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)
    ? `${text.replace(' ', 'T')}Z`
    : text;
  return Date.parse(normalized);
}

function latestChallenge(userId) {
  return db.prepare('SELECT * FROM email_verification_challenges WHERE user_id=? ORDER BY id DESC LIMIT 1').get(userId);
}

async function issueEmailVerification({ userId, email, locale = 'en', force = false }) {
  const user = db.prepare('SELECT id,email,email_verified_at FROM users WHERE id=?').get(userId);
  if (!user) throw new Error('Account not found.');
  if (user.email_verified_at) return { alreadyVerified: true };
  const latest = latestChallenge(user.id);
  if (!force && latest && !latest.used_at && parseStoredTimestamp(latest.resend_available_at) > Date.now()) {
    const error = new Error('Please wait before requesting another verification code.');
    error.code = 'RESEND_COOLDOWN';
    error.retryAfterSeconds = Math.max(1, Math.ceil((parseStoredTimestamp(latest.resend_available_at) - Date.now()) / 1000));
    throw error;
  }
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();
  const resendAvailableAt = new Date(Date.now() + RESEND_DELAY_MS).toISOString();
  const result = transaction(() => {
    db.prepare(`UPDATE email_verification_challenges SET used_at=COALESCE(used_at,CURRENT_TIMESTAMP)
      WHERE user_id=? AND used_at IS NULL`).run(user.id);
    return db.prepare(`INSERT INTO email_verification_challenges(user_id,code_hash,expires_at,resend_available_at)
      VALUES (?,?,?,?)`).run(user.id, hashCode(user.id, code), expiresAt, resendAvailableAt);
  });
  try {
    await sendVerificationEmail({
      email: user.email || email,
      code,
      locale,
      idempotencyKey: `verify-${user.id}-${Number(result.lastInsertRowid)}`,
    });
  } catch (error) {
    db.prepare('DELETE FROM email_verification_challenges WHERE id=?').run(Number(result.lastInsertRowid));
    throw error;
  }
  return { sent: true, expiresAt, resendAvailableAt };
}

function verifyEmailCode({ userId, code }) {
  const normalized = String(code || '').trim();
  if (!/^\d{6}$/.test(normalized)) throw new Error('Enter the six-digit verification code.');
  return transaction(() => {
    const user = db.prepare('SELECT id,email_verified_at FROM users WHERE id=?').get(userId);
    if (!user) throw new Error('Account not found.');
    if (user.email_verified_at) return { verified: true, alreadyVerified: true };
    const challenge = latestChallenge(user.id);
    if (!challenge || challenge.used_at) throw new Error('The verification code is invalid or has already been used.');
    if (parseStoredTimestamp(challenge.expires_at) <= Date.now()) {
      db.prepare('UPDATE email_verification_challenges SET used_at=CURRENT_TIMESTAMP WHERE id=?').run(challenge.id);
      throw new Error('The verification code has expired. Request a new code.');
    }
    if (Number(challenge.attempts || 0) >= MAX_ATTEMPTS) {
      db.prepare('UPDATE email_verification_challenges SET used_at=CURRENT_TIMESTAMP WHERE id=?').run(challenge.id);
      throw new Error('Too many incorrect attempts. Request a new code.');
    }
    const actual = Buffer.from(hashCode(user.id, normalized), 'hex');
    const expected = Buffer.from(String(challenge.code_hash), 'hex');
    const correct = actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    if (!correct) {
      const attempts = Number(challenge.attempts || 0) + 1;
      db.prepare(`UPDATE email_verification_challenges SET attempts=?,used_at=CASE WHEN ?>=? THEN CURRENT_TIMESTAMP ELSE used_at END WHERE id=?`)
        .run(attempts, attempts, MAX_ATTEMPTS, challenge.id);
      const error = new Error('The verification code is incorrect.');
      error.code = 'INVALID_CODE';
      error.attemptsRemaining = Math.max(0, MAX_ATTEMPTS - attempts);
      throw error;
    }
    db.prepare('UPDATE email_verification_challenges SET used_at=CURRENT_TIMESTAMP WHERE id=?').run(challenge.id);
    db.prepare('UPDATE users SET email_verified_at=CURRENT_TIMESTAMP WHERE id=?').run(user.id);
    return { verified: true, alreadyVerified: false };
  });
}

module.exports = { CODE_TTL_MS, MAX_ATTEMPTS, RESEND_DELAY_MS, hashCode, issueEmailVerification, parseStoredTimestamp, verifyEmailCode };

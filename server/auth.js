const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { db, transaction } = require('./db');
const { anonymize, clientIp, isProduction, securityLog } = require('./security');

const scryptAsync = promisify(crypto.scrypt);
const ACCESS_COOKIE = 'gs_access';
const REFRESH_COOKIE = 'gs_refresh';
const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SCRYPT_PARAMS = { cost: 16384, blockSize: 8, parallelization: 1, maxmem: 64 * 1024 * 1024 };

function authSecret() {
  const value = String(process.env.AUTH_SECRET || '');
  if (value.length < 32) throw new Error('AUTH_SECRET is required and must contain at least 32 characters.');
  return value;
}

function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 12) throw new Error('Password must contain at least 12 characters.');
  if (value.length > 128) throw new Error('Password must not exceed 128 characters.');
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    throw new Error('Password must include upper-case, lower-case, number and symbol characters.');
  }
  return value;
}

async function hashPassword(password) {
  const value = validatePassword(password);
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(value, salt, 64, SCRYPT_PARAMS);
  return `scrypt$v1$${SCRYPT_PARAMS.cost}$${SCRYPT_PARAMS.blockSize}$${SCRYPT_PARAMS.parallelization}$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

async function verifyPassword(password, stored) {
  const value = String(password || '');
  if (!value || value.length > 128) return false;
  const text = String(stored || '');
  try {
    if (text.startsWith('scrypt$v1$')) {
      const [, , costText, blockText, parallelText, saltText, hashText] = text.split('$');
      const cost = Number(costText);
      const blockSize = Number(blockText);
      const parallelization = Number(parallelText);
      if (!Number.isInteger(cost) || cost < 16384 || cost > 262144) return false;
      if (!Number.isInteger(blockSize) || blockSize < 8 || blockSize > 32) return false;
      if (!Number.isInteger(parallelization) || parallelization < 1 || parallelization > 4) return false;
      const expected = Buffer.from(hashText, 'base64url');
      if (expected.length !== 64) return false;
      const actual = await scryptAsync(value, Buffer.from(saltText, 'base64url'), expected.length, {
        cost, blockSize, parallelization, maxmem: 128 * 1024 * 1024,
      });
      return crypto.timingSafeEqual(expected, Buffer.from(actual));
    }

    // Legacy salt:hex rows are accepted once and rehashed after a successful login.
    const [salt, hashHex] = text.split(':');
    if (!salt || !/^[0-9a-f]+$/i.test(hashHex || '')) return false;
    const expected = Buffer.from(hashHex, 'hex');
    if (!expected.length) return false;
    const actual = await scryptAsync(value, salt, expected.length, SCRYPT_PARAMS);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, Buffer.from(actual));
  } catch {
    return false;
  }
}

async function burnPasswordCost(password) {
  const value = String(password || '').slice(0, 128);
  await scryptAsync(value, 'gekishin-invalid-user-salt', 64, SCRYPT_PARAMS);
}

function needsPasswordRehash(stored) {
  return !String(stored || '').startsWith('scrypt$v1$');
}

function randomToken() { return crypto.randomBytes(32).toString('base64url'); }
function tokenHash(token) {
  return crypto.createHmac('sha256', authSecret()).update(String(token || '')).digest('hex');
}

function parseCookies(header) {
  const result = {};
  String(header || '').split(';').forEach(part => {
    const index = part.indexOf('=');
    if (index < 0) return;
    const key = part.slice(0, index).trim();
    const raw = part.slice(index + 1).trim();
    if (!key) return;
    try { result[key] = decodeURIComponent(raw); }
    catch { result[key] = raw; }
  });
  return result;
}

function bearerToken(req) {
  const header = String(req.headers?.authorization || '');
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

function accessTokenFromRequest(req) {
  const cookies = parseCookies(req.headers?.cookie);
  return cookies[ACCESS_COOKIE] || bearerToken(req) || '';
}

function refreshTokenFromRequest(req) {
  return parseCookies(req.headers?.cookie)[REFRESH_COOKIE] || '';
}

function cookieValue(name, value, { maxAgeSeconds, path = '/' } = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    'HttpOnly',
    'SameSite=Strict',
    'Priority=High',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds || 0))}`,
  ];
  if (isProduction || process.env.COOKIE_SECURE === 'true') parts.push('Secure');
  return parts.join('; ');
}

function setSessionCookies(res, session) {
  res.append('Set-Cookie', cookieValue(ACCESS_COOKIE, session.accessToken, { maxAgeSeconds: ACCESS_TTL_MS / 1000 }));
  res.append('Set-Cookie', cookieValue(REFRESH_COOKIE, session.refreshToken, { maxAgeSeconds: REFRESH_TTL_MS / 1000, path: '/api/auth' }));
}

function clearSessionCookies(res) {
  res.append('Set-Cookie', cookieValue(ACCESS_COOKIE, '', { maxAgeSeconds: 0 }));
  res.append('Set-Cookie', cookieValue(REFRESH_COOKIE, '', { maxAgeSeconds: 0, path: '/api/auth' }));
}

function createSession(user, req = {}) {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const accessExpiresAt = new Date(Date.now() + ACCESS_TTL_MS).toISOString();
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS).toISOString();
  const ipHash = anonymize(clientIp(req));
  const userAgentHash = anonymize(req.headers?.['user-agent'] || '');
  const result = db.prepare(`INSERT INTO auth_sessions(
    user_id,access_token_hash,refresh_token_hash,access_expires_at,refresh_expires_at,ip_hash,user_agent_hash,last_seen_at
  ) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)`).run(
    user.id, tokenHash(accessToken), tokenHash(refreshToken), accessExpiresAt, refreshExpiresAt, ipHash, userAgentHash,
  );
  return { id: Number(result.lastInsertRowid), accessToken, refreshToken, accessExpiresAt, refreshExpiresAt };
}

function sessionByAccessToken(token) {
  if (!token) return null;
  return db.prepare(`SELECT s.*,u.username,u.email,u.display_name,u.gamer_tag,u.bio,u.profile_visibility,u.show_external_profiles,u.role,u.is_active,u.email_verified_at,u.created_at
    FROM auth_sessions s JOIN users u ON u.id=s.user_id
    WHERE s.access_token_hash=? AND s.revoked_at IS NULL AND datetime(s.access_expires_at)>datetime('now')
    LIMIT 1`).get(tokenHash(token));
}

function authenticateAccessToken(token) {
  const session = sessionByAccessToken(token);
  if (!session || !session.is_active) throw new Error('Authentication required.');
  db.prepare('UPDATE auth_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=?').run(session.id);
  return {
    sessionId: session.id,
    user: {
      id: session.user_id,
      username: session.username,
      email: session.email,
      display_name: session.display_name,
      gamer_tag: session.gamer_tag || '',
      bio: session.bio || '',
      profile_visibility: session.profile_visibility || 'public',
      show_external_profiles: session.show_external_profiles || 0,
      role: session.role,
      is_active: session.is_active,
      email_verified_at: session.email_verified_at,
      created_at: session.created_at,
    },
  };
}

function authRequired(req, res, next) {
  try {
    const auth = authenticateAccessToken(accessTokenFromRequest(req));
    req.user = auth.user;
    req.authSessionId = auth.sessionId;
    next();
  } catch {
    res.status(401).json({ error: 'Authentication required.' });
  }
}

function emailVerifiedRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
  if (!req.user.email_verified_at) {
    return res.status(403).json({ error: 'Verify your email before using this feature.', code: 'EMAIL_VERIFICATION_REQUIRED' });
  }
  next();
}

function rotateSession(refreshToken, req) {
  if (!refreshToken) throw new Error('Refresh session is invalid or expired.');
  const hash = tokenHash(refreshToken);
  return transaction(() => {
    const current = db.prepare(`SELECT s.*,u.* FROM auth_sessions s JOIN users u ON u.id=s.user_id
      WHERE s.refresh_token_hash=? LIMIT 1`).get(hash);
    if (!current || !current.is_active || Date.parse(current.refresh_expires_at) <= Date.now()) {
      throw new Error('Refresh session is invalid or expired.');
    }
    if (current.revoked_at) {
      if (current.revoke_reason === 'rotated') {
        revokeAllUserSessions(current.user_id, 'refresh_token_reuse_detected');
        securityLog('auth.refresh_reuse_detected', { userId: current.user_id }, 'error');
      }
      throw new Error('Refresh session is invalid or expired.');
    }

    const requestUserAgentHash = anonymize(req.headers?.['user-agent'] || '');
    if (current.user_agent_hash && current.user_agent_hash !== requestUserAgentHash) {
      db.prepare('UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP,revoke_reason=? WHERE id=?')
        .run('refresh_user_agent_mismatch', current.id);
      securityLog('auth.refresh_user_agent_mismatch', { userId: current.user_id, sessionId: current.id }, 'error');
      throw new Error('Refresh session is invalid or expired.');
    }
    const requestIpHash = anonymize(clientIp(req));
    if (current.ip_hash && current.ip_hash !== requestIpHash) {
      securityLog('auth.refresh_ip_changed', { userId: current.user_id, sessionId: current.id });
    }

    db.prepare('UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP,revoke_reason=? WHERE id=?')
      .run('rotated', current.id);
    return { session: createSession(current, req), user: current };
  });
}

function revokeSessionByRequest(req, reason = 'logout') {
  const access = accessTokenFromRequest(req);
  const refresh = refreshTokenFromRequest(req);
  if (!access && !refresh) return 0;
  const accessHash = access ? tokenHash(access) : '__none__';
  const refreshHash = refresh ? tokenHash(refresh) : '__none__';
  const result = db.prepare(`UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP,revoke_reason=?
    WHERE revoked_at IS NULL AND (access_token_hash=? OR refresh_token_hash=?)`).run(reason, accessHash, refreshHash);
  return Number(result.changes || 0);
}

function revokeAllUserSessions(userId, reason = 'user_revoked_all') {
  return Number(db.prepare(`UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP,revoke_reason=?
    WHERE user_id=? AND revoked_at IS NULL`).run(reason, userId).changes || 0);
}

function listUserSessions(userId, currentSessionId = null) {
  return db.prepare(`SELECT id,access_expires_at,refresh_expires_at,ip_hash,user_agent_hash,last_seen_at,created_at
    FROM auth_sessions WHERE user_id=? AND revoked_at IS NULL AND datetime(refresh_expires_at)>datetime('now')
    ORDER BY COALESCE(last_seen_at,created_at) DESC`).all(userId).map(row => ({
      id: row.id,
      current: Number(row.id) === Number(currentSessionId),
      accessExpiresAt: row.access_expires_at,
      refreshExpiresAt: row.refresh_expires_at,
      lastSeenAt: row.last_seen_at,
      createdAt: row.created_at,
      deviceFingerprint: row.user_agent_hash.slice(0, 12),
      networkFingerprint: row.ip_hash.slice(0, 12),
    }));
}

function revokeUserSession(userId, sessionId, reason = 'user_revoked_session') {
  return Number(db.prepare(`UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP,revoke_reason=?
    WHERE id=? AND user_id=? AND revoked_at IS NULL`).run(reason, sessionId, userId).changes || 0);
}

function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      securityLog('permission.denied', { userId: req.user?.id || null, requiredRoles: roles });
      return res.status(403).json({ error: 'You do not have permission for this action.' });
    }
    next();
  };
}

function canManageTournament(userId, tournamentId) {
  const row = db.prepare(`
    SELECT 1 AS allowed FROM tournaments WHERE id = ? AND host_user_id = ?
    UNION ALL
    SELECT 1 AS allowed FROM tournament_staff WHERE tournament_id = ? AND user_id = ?
    LIMIT 1
  `).get(tournamentId, userId, tournamentId, userId);
  return Boolean(row);
}

function developmentTokenResponse(session) {
  if (process.env.NODE_ENV !== 'test' && process.env.ALLOW_BEARER_TOKEN_RESPONSE !== 'true') return {};
  return { token: session.accessToken };
}

module.exports = {
  ACCESS_COOKIE,
  ACCESS_TTL_MS,
  REFRESH_COOKIE,
  REFRESH_TTL_MS,
  accessTokenFromRequest,
  allowRoles,
  authRequired,
  authenticateAccessToken,
  burnPasswordCost,
  canManageTournament,
  clearSessionCookies,
  createSession,
  developmentTokenResponse,
  emailVerifiedRequired,
  hashPassword,
  listUserSessions,
  needsPasswordRehash,
  refreshTokenFromRequest,
  revokeAllUserSessions,
  revokeSessionByRequest,
  revokeUserSession,
  rotateSession,
  setSessionCookies,
  tokenHash,
  validatePassword,
  verifyPassword,
};

const crypto = require('node:crypto');

const isProduction = process.env.NODE_ENV === 'production';

function securityLog(event, details = {}, level = 'warn') {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    type: 'security',
    event,
    ...details,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'info') console.info(line);
  else console.warn(line);
}

function clientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown').slice(0, 128);
}

function anonymize(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 20);
}

function parseOrigins(port) {
  const configured = String(process.env.APP_ORIGIN || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .map(value => {
      try { return new URL(value).origin; }
      catch { throw new Error(`APP_ORIGIN contains an invalid URL: ${value}`); }
    });

  if (isProduction) {
    if (!configured.length) throw new Error('APP_ORIGIN is required in production.');
    for (const origin of configured) {
      if (!origin.startsWith('https://')) throw new Error(`Production APP_ORIGIN must use HTTPS: ${origin}`);
    }
    return [...new Set(configured)];
  }

  return [...new Set([
    ...configured,
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ])];
}

function validateEnvironment(port) {
  const secret = String(process.env.AUTH_SECRET || '');
  if (secret.length < 32) {
    throw new Error('AUTH_SECRET is required and must contain at least 32 characters.');
  }
  if (isProduction && /replace-with|change-me|example|local-secret/i.test(secret)) {
    throw new Error('AUTH_SECRET still contains a placeholder or known development value.');
  }
  const adminPassword = String(process.env.ADMIN_PASSWORD || '');
  if (isProduction) {
    if (/replace-with|change-me|password|local[-_ ]?(demo|test|upcoming)/i.test(adminPassword)) {
      throw new Error('ADMIN_PASSWORD still uses a known or placeholder value.');
    }
    if (adminPassword.length < 12 || adminPassword.length > 128 || !/[a-z]/.test(adminPassword) || !/[A-Z]/.test(adminPassword) || !/\d/.test(adminPassword) || !/[^A-Za-z0-9]/.test(adminPassword)) {
      throw new Error('ADMIN_PASSWORD must be 12-128 characters and include upper-case, lower-case, number and symbol characters.');
    }
    const adminEmail = String(process.env.ADMIN_EMAIL || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail) || /example\.com$/i.test(adminEmail)) {
      throw new Error('ADMIN_EMAIL must be configured to a real non-placeholder address.');
    }
    if (process.env.ALLOW_DIRECT_HOST_REGISTRATION === 'true') {
      throw new Error('ALLOW_DIRECT_HOST_REGISTRATION must be false in production.');
    }
    const emailCodeSecret = String(process.env.EMAIL_CODE_SECRET || '');
    if (emailCodeSecret.length < 32 || /replace-with|change-me|example/i.test(emailCodeSecret)) {
      throw new Error('EMAIL_CODE_SECRET is required in production and must contain at least 32 non-placeholder characters.');
    }
    if (!String(process.env.RESEND_API_KEY || '').trim()) {
      throw new Error('RESEND_API_KEY is required in production for account verification email.');
    }
    const emailFrom = String(process.env.EMAIL_FROM || '').trim();
    if (!/^.+<[^\s@]+@[^\s@]+\.[^\s@]+>$/.test(emailFrom) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailFrom)) {
      throw new Error('EMAIL_FROM must be a valid verified sender address.');
    }
    const startggClientId = String(process.env.STARTGG_CLIENT_ID || '').trim();
    const startggClientSecret = String(process.env.STARTGG_CLIENT_SECRET || '').trim();
    if (Boolean(startggClientId) !== Boolean(startggClientSecret)) {
      throw new Error('STARTGG_CLIENT_ID and STARTGG_CLIENT_SECRET must be configured together.');
    }
    if (startggClientId) {
      const encryptionKey = String(process.env.STARTGG_TOKEN_ENCRYPTION_KEY || '');
      if (encryptionKey.length < 32 || /replace-with|change-me|example/i.test(encryptionKey)) {
        throw new Error('STARTGG_TOKEN_ENCRYPTION_KEY must contain at least 32 non-placeholder characters when start.gg OAuth is enabled.');
      }
    }
    const challongeClientId = String(process.env.CHALLONGE_CLIENT_ID || '').trim();
    const challongeClientSecret = String(process.env.CHALLONGE_CLIENT_SECRET || '').trim();
    if (Boolean(challongeClientId) !== Boolean(challongeClientSecret)) {
      throw new Error('CHALLONGE_CLIENT_ID and CHALLONGE_CLIENT_SECRET must be configured together.');
    }
    if (challongeClientId) {
      const encryptionKey = String(process.env.CHALLONGE_TOKEN_ENCRYPTION_KEY || '');
      if (encryptionKey.length < 32 || /replace-with|change-me|example/i.test(encryptionKey)) {
        throw new Error('CHALLONGE_TOKEN_ENCRYPTION_KEY must contain at least 32 non-placeholder characters when Challonge OAuth is enabled.');
      }
    }
  }
  const allowedOrigins = parseOrigins(port);
  if (isProduction && allowedOrigins.some(origin => /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(origin))) {
    throw new Error('Production APP_ORIGIN cannot use a loopback or wildcard host.');
  }
  return {
    allowedOrigins,
    canonicalOrigin: allowedOrigins[0],
    isProduction,
  };
}

function originAllowed(origin, allowedOrigins) {
  if (!origin) return true; // CLI/server-to-server clients do not always send Origin.
  try { return allowedOrigins.includes(new URL(origin).origin); }
  catch { return false; }
}

function corsMiddleware(allowedOrigins) {
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (!originAllowed(origin, allowedOrigins)) {
      securityLog('cors.denied', { ipHash: anonymize(clientIp(req)), origin: String(origin || '') });
      return res.status(403).json({ error: 'Origin is not allowed.' });
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-Requested-With');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Max-Age', '600');
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  };
}

function httpsEnforcement(req, res, next) {
  if (!isProduction || req.path === '/api/health') return next();
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (req.secure || forwardedProto === 'https') return next();
  const canonical = String(process.env.APP_ORIGIN || '').split(',')[0].trim();
  if (!canonical) return res.status(500).json({ error: 'HTTPS origin is not configured.' });
  const target = new URL(req.originalUrl || '/', new URL(canonical).origin);
  return res.redirect(308, target.toString());
}

class SlidingWindowLimiter {
  constructor({ windowMs, max, name, maxKeys = 10_000 }) {
    this.windowMs = windowMs;
    this.max = max;
    this.name = name;
    this.maxKeys = maxKeys;
    this.hits = new Map();
  }

  _active(key, now = Date.now()) {
    const cutoff = now - this.windowMs;
    const active = (this.hits.get(key) || []).filter(timestamp => timestamp > cutoff);
    if (active.length) this.hits.set(key, active);
    else this.hits.delete(key);
    return active;
  }

  prune(now = Date.now()) {
    for (const key of this.hits.keys()) this._active(key, now);
    while (this.hits.size > this.maxKeys) this.hits.delete(this.hits.keys().next().value);
  }

  status(key, now = Date.now()) {
    const active = this._active(key, now);
    if (active.length < this.max) {
      const resetSeconds = active.length
        ? Math.max(1, Math.ceil((active[0] + this.windowMs - now) / 1000))
        : Math.ceil(this.windowMs / 1000);
      return { allowed: true, remaining: this.max - active.length, resetSeconds };
    }
    const retryAfterSeconds = Math.max(1, Math.ceil((active[0] + this.windowMs - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds, resetSeconds: retryAfterSeconds };
  }

  record(key, now = Date.now()) {
    if (!this.hits.has(key) && this.hits.size >= this.maxKeys) this.prune(now);
    const active = this._active(key, now);
    active.push(now);
    this.hits.set(key, active);
    return this.status(key, now);
  }

  reset(key) { this.hits.delete(key); }
}

function rejectRateLimited(req, res, limiter, status, event, details = {}) {
  res.setHeader('Retry-After', String(status.retryAfterSeconds));
  res.setHeader('X-RateLimit-Limit', String(limiter.max));
  res.setHeader('X-RateLimit-Remaining', '0');
  res.setHeader('X-RateLimit-Reset', String(status.retryAfterSeconds));
  securityLog(event, {
    limiter: limiter.name,
    ipHash: anonymize(clientIp(req)),
    retryAfterSeconds: status.retryAfterSeconds,
    ...details,
  });
  return res.status(429).json({
    error: 'Too many requests. Try again later.',
    retryAfterSeconds: status.retryAfterSeconds,
  });
}

function rateLimitMiddleware(limiter, keyFn = req => clientIp(req)) {
  return (req, res, next) => {
    const key = keyFn(req);
    const before = limiter.status(key);
    if (!before.allowed) return rejectRateLimited(req, res, limiter, before, 'rate_limit.blocked');
    const after = limiter.record(key);
    res.setHeader('X-RateLimit-Limit', String(limiter.max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, after.remaining ?? 0)));
    res.setHeader('X-RateLimit-Reset', String(after.resetSeconds || Math.ceil(limiter.windowMs / 1000)));
    next();
  };
}

function sanitizeText(value, maxLength = 1000) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function isSafeExternalUrl(value, { allowEmpty = true } = {}) {
  const text = String(value || '').trim();
  if (!text) return allowEmpty;
  try {
    const url = new URL(text);
    if (url.username || url.password) return false;
    if (isProduction) return url.protocol === 'https:';
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function socketEventLimiter({ max = 60, windowMs = 10_000 } = {}) {
  const limiter = new SlidingWindowLimiter({ max, windowMs, name: 'socket-events', maxKeys: 20_000 });
  return socket => {
    const key = `${socket.handshake.address || 'unknown'}:${socket.id}`;
    const status = limiter.status(key);
    if (!status.allowed) return false;
    limiter.record(key);
    return true;
  };
}

module.exports = {
  SlidingWindowLimiter,
  anonymize,
  clientIp,
  corsMiddleware,
  httpsEnforcement,
  isProduction,
  isSafeExternalUrl,
  originAllowed,
  rateLimitMiddleware,
  rejectRateLimited,
  sanitizeText,
  securityLog,
  socketEventLimiter,
  validateEnvironment,
};

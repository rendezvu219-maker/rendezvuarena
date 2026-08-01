const SESSION_MARKER_KEY = 'gs_has_session';
const LEGACY_TOKEN_KEY = 'gs_auth_token';
const DEV_TOKEN_KEY = 'gs_dev_auth_token';

// Escape API-sourced text before inserting it into an HTML template or attribute.
export function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));
}

function devToken() { return sessionStorage.getItem(DEV_TOKEN_KEY) || ''; }

// Backward-compatible truthy session check. This is only a marker, never a credential.
export function getToken() { return devToken() || localStorage.getItem(SESSION_MARKER_KEY) || ''; }
export function setToken(value) {
  localStorage.removeItem(LEGACY_TOKEN_KEY);
  if (value) localStorage.setItem(SESSION_MARKER_KEY, '1');
  else {
    localStorage.removeItem(SESSION_MARKER_KEY);
    sessionStorage.removeItem(DEV_TOKEN_KEY);
    fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'X-CSRF-Token': '1' } }).catch(() => {});
  }
}

async function rawRequest(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = devToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const requestOptions = { ...options, headers, credentials: 'same-origin' };
  if (requestOptions.body && typeof requestOptions.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    requestOptions.body = JSON.stringify(requestOptions.body);
  }
  const method = String(requestOptions.method || 'GET').toUpperCase();
  // A custom header is required for state changes; strict CORS prevents hostile origins from adding it.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers['X-CSRF-Token'] = '1';
  if (method === 'GET' && requestOptions.cache == null) requestOptions.cache = 'no-store';
  return fetch(path, requestOptions);
}

export async function api(path, options = {}) {
  let response = await rawRequest(path, options);
  const mayRefresh = response.status === 401
    && !String(path).startsWith('/api/auth/login')
    && !String(path).startsWith('/api/auth/register')
    && !String(path).startsWith('/api/auth/refresh');
  if (mayRefresh && !devToken()) {
    const refresh = await rawRequest('/api/auth/refresh', { method: 'POST' });
    if (refresh.ok) {
      localStorage.setItem(SESSION_MARKER_KEY, '1');
      response = await rawRequest(path, options);
    }
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.retryAfterSeconds = Number(payload.retryAfterSeconds || response.headers.get('Retry-After') || 0);
    throw error;
  }
  return payload;
}

export function connectSocket(options = {}) {
  if (!window.io) return null;
  const token = devToken();
  return window.io({
    transports: ['websocket', 'polling'],
    withCredentials: true,
    auth: { ...(token ? { token } : {}), ...(options.auth || {}) },
  });
}

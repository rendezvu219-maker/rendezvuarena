import { api, getToken, setToken } from './api.js';

// Quick Draft allows direct access without requiring an account
export async function verify() {
  if (getToken()) {
    try { await api('/api/auth/me'); }
    catch { setToken(''); }
  }
}
verify();

import { api, getToken, setToken } from './api.js';
const gate = document.getElementById('quick-access-gate');
const hasSharedConfig = new URLSearchParams(location.search).has('config');
async function verify() {
  if (hasSharedConfig) return;
  if (!getToken()) { gate?.classList.remove('hidden'); return; }
  try { await api('/api/auth/me'); }
  catch { setToken(''); gate?.classList.remove('hidden'); }
}
verify();

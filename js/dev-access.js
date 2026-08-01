(async () => {
  const fragment = new URLSearchParams(location.hash.replace(/^#/, ''));
  const code = fragment.get('code') || '';
  const next = fragment.get('next') || '/portal.html';
  history.replaceState(null, '', '/dev-access.html');
  if (!code || !next.startsWith('/') || next.startsWith('//')) {
    document.body.textContent = 'Invalid test access link.';
    return;
  }
  try {
    const response = await fetch('/api/dev-test/access/exchange', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': '1' },
      body: JSON.stringify({ code }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Test access failed.');
    localStorage.setItem('gs_has_session', '1');
    location.replace(next);
  } catch (error) {
    document.body.textContent = error.message || 'Test access failed.';
  }
})();

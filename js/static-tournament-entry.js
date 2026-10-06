// Old organizer bookmarks still work on GitHub Pages. The server-backed
// dashboard/import tools remain unchanged on deployments with a backend.
(function () {
  const url = new URL(window.location.href);
  if (!url.hostname.endsWith('.github.io')) return;
  if (!/(?:dashboard|host-apply)\.html$/.test(url.pathname)) return;
  window.location.replace(new URL('tournament.html', url).href);
})();

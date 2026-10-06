import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const base = 'https://rendezvu219-maker.github.io/rendezvuarena/';
for (const file of ['index.html', 'heroes.html', 'quick-draft.html']) {
  const html = read(file);
  assert.match(html, /data-i18n="tournamentOps" href="dashboard\.html"/);
  assert.equal(new URL('dashboard.html', new URL(file, base)).href, `${base}dashboard.html`);
  assert.doesNotMatch(html, /href="\/?tournament\.html"/);
}
assert.match(read('js/mobile-nav.js'), /\['dashboard\.html', text\.ops/);
assert.match(read('js/preferences.js'), /new URL\('\.\/mobile-nav\.js[^']*', preferencesUrl\)/);
assert.match(read('js/preferences.js'), /new URL\('\.\.\/css\/mobile-nav\.css[^']*', preferencesUrl\)/);
assert.equal(new URL('mobile-nav.js', `${base}js/preferences.js?v=13`).href, `${base}js/mobile-nav.js`);
for (const file of ['dashboard.html', 'host-apply.html']) {
  assert.doesNotMatch(read(file), /static-tournament-entry/);
}
assert.match(read('js/dashboard.js'), /body: \{ linkAccess: true \}/);
assert.doesNotMatch(read('js/dashboard.js'), /CAPTAIN ACCOUNT REQUIRED/);
assert.match(read('js/dashboard.js'), /state.openMatchId === matchId/, 'A pending room response must not overwrite another match dialog.');
console.log('Original Operations navigation, repository prefix and no replacement redirects passed.');

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const base = 'https://rendezvu219-maker.github.io/rendezvuarena/';
for (const file of ['index.html', 'heroes.html', 'quick-draft.html']) {
  const html = read(file);
  assert.match(html, /data-i18n="tournamentOps" href="tournament\.html"/);
  assert.equal(new URL('tournament.html', new URL(file, base)).href, `${base}tournament.html`);
  assert.doesNotMatch(html, /href="\/?(?:dashboard|host-apply)\.html"/);
}
assert.match(read('js/mobile-nav.js'), /\['tournament\.html', text\.ops/);
assert.match(read('js/mobile-nav.js'), /\.static-nav > nav a/);
for (const file of ['tournament.html', 'bracket.html']) {
  assert.match(read(file), /css\/components\.css/);
  assert.match(read(file), /css\/i18n\.css/);
}
assert.match(read('css/static-arena.css'), /\.static-nav[^\n]*background:var\(--surface-base\)/);
assert.match(read('css/static-arena.css'), /\.mode-card,\.panel[^\n]*background:var\(--surface-base\)/);
assert.match(read('js/preferences.js'), /new URL\('\.\/mobile-nav\.js[^']*', preferencesUrl\)/);
assert.match(read('js/preferences.js'), /new URL\('\.\.\/css\/mobile-nav\.css[^']*', preferencesUrl\)/);
assert.equal(new URL('mobile-nav.js', `${base}js/preferences.js?v=13`).href, `${base}js/mobile-nav.js`);

const redirect = read('js/static-tournament-entry.js');
for (const file of ['dashboard.html', 'host-apply.html']) {
  assert.match(read(file), /js\/static-tournament-entry\.js/);
  let target;
  vm.runInNewContext(redirect, { URL, window: { location: { href: `${base}${file}?tournamentId=old`, replace: value => { target = value; } } } });
  assert.equal(target, `${base}tournament.html`);
  for (const origin of ['http://localhost:3186/', 'https://arena.example/', 'https://github.io.attacker.example/']) {
    target = null;
    vm.runInNewContext(redirect, { URL, window: { location: { href: `${origin}${file}`, replace: value => { target = value; } } } });
    assert.equal(target, null, 'Backend organizer tools must remain available.');
  }
}
let target = null;
vm.runInNewContext(redirect, { URL, window: { location: { href: `${base}tournament.html`, replace: value => { target = value; } } } });
assert.equal(target, null, 'The setup page must not redirect into a loop.');
console.log('Tournament setup navigation, GitHub Pages prefix and legacy entry tests passed.');

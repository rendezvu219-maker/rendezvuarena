import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const entryPages=fs.readdirSync(root).filter(file=>file.endsWith('.html')).sort();
const keyPages=['dashboard.html','draft-room.html','broadcast.html','portal.html','index.html','public.html','heroes.html'];

assert.ok(entryPages.length>=18,'The shared navigation audit must cover every root entry page.');
entryPages.forEach(file=>assert.match(read(file),/js\/preferences\.js/,
  `${file} must load the site-wide preferences bootstrap that installs mobile navigation.`));
keyPages.forEach(file=>assert.ok(entryPages.includes(file),`${file} must remain in the mobile navigation test matrix.`));

const preferences=read('js/preferences.js');
assert.match(preferences,/mobile-nav\.css/);
assert.match(preferences,/import\('\/js\/mobile-nav\.js/);

const component=read('js/mobile-nav.js');
for(const selector of ['#ops-tabs [data-tab]','.home-nav > nav a','.content-nav > nav a','.ops-top-actions a','.setup-actions a','#series-open-ops']){
  assert.ok(component.includes(selector),`Shared mobile navigation must discover ${selector}.`);
}
for(const capability of ['window.GSPreferences?.set','gs_locale','/api/auth/me','/api/auth/logout','X-CSRF-Token']){
  assert.ok(component.includes(capability),`Shared mobile navigation must reuse ${capability}.`);
}
for(const locale of ['en','ja','zh-CN','ko','es','vi'])assert.ok(component.includes(`${locale}:`)||component.includes(`'${locale}':`));

const styles=read('css/mobile-nav.css');
for(const token of ['--z-overlay','--surface-overlay','--surface-scrim','--border-strong','--duration-slow','--mobile-drawer-width']){
  assert.ok(styles.includes(`var(${token})`),`Mobile drawer styling must use ${token}.`);
}
assert.match(styles,/:root\[data-motion="reduced"\]/);
assert.match(styles,/\.draft-room-page \.mobile-nav-drawer,\.broadcast-page \.mobile-nav-drawer/);
assert.match(styles,/\.ops-tabs,/);
assert.doesNotMatch(read('css/home.css'),/\.home-nav nav\s*\{\s*display\s*:\s*none/i);
assert.doesNotMatch(read('css/content.css'),/\.content-nav nav\s*\{\s*display\s*:\s*none/i);

for(const file of ['dashboard.html','portal.html','public.html','profile.html','quick-draft.html','js/preferences.js','js/broadcast.js']){
  assert.doesNotMatch(read(file),/GEKISHIN(?: SQUADRA)?/i,`${file} still contains obsolete product-facing branding.`);
}
assert.match(read('DEPLOYMENT_VI.md'),/draftPresence[\s\S]*một instance\/replica|một instance\/replica[\s\S]*draftPresence/i);

console.log(`Shared token-based mobile navigation checks passed across ${entryPages.length} entry pages and all required page families.`);

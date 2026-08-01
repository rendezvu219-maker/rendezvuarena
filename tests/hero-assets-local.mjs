import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const heroes = await readFile(new URL('../js/heroes.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const page = await readFile(new URL('../js/heroes-page.js', import.meta.url), 'utf8');
const broadcast = await readFile(new URL('../js/broadcast.js', import.meta.url), 'utf8');
const rules = await readFile(new URL('../js/draft-rules-form.js', import.meta.url), 'utf8');
const downloader = await readFile(new URL('../scripts/download-hero-assets.mjs', import.meta.url), 'utf8');
const verifier = await readFile(new URL('../scripts/verify-hero-assets.mjs', import.meta.url), 'utf8');
const {
  getHeroDisplayImage, getHeroFullImg, getHeroImg, getHeroImgSp,
  heroMatchesSearch, imageWithFallback,
} = await import(new URL('../js/heroes.js', import.meta.url));

for (const runtime of [heroes, app, page, broadcast, rules]) {
  assert.doesNotMatch(runtime, /dbg-squadra\.bn-ent\.net\/assets\/images\/hero/);
}
assert.match(heroes, /\/assets\/heroes\/\$\{id\}\/btn_character\.webp/);
assert.match(heroes, /\/assets\/heroes\/\$\{id\}\/btn_character_sp\.webp/);
assert.match(heroes, /\/assets\/heroes\/\$\{heroId\}\/skill\/icon_\$\{skillId\}/);
assert.match(app, /getHeroImg\(h\.id\).*getHeroImgHover\(h\.id\)/s, 'Character Pool must keep default + hover artwork.');
assert.match(app, /getHeroImgSp\(hero\.id\)/, 'Draft result slots must use SP portraits.');
assert.match(app, /getHeroFullImg\(hero\.id\)/, 'Full-art preview/cinematic must remain unchanged.');
assert.equal(heroMatchesSearch({ id:'0017', name:'Son Goku (Mini)', role:'Damage' }, 'daima', 'Son Goku (Mini)', 'Damage'), false);
assert.match(broadcast, /getHeroImgSp\(hero\.id\)/, 'Broadcast result cards must use SP portraits.');
assert.match(broadcast, /image\.src = getHeroFullImg\(hero\.id\)/, 'Broadcast reveal must keep full art.');
assert.match(rules, /src=\"\$\{getHeroImgSp\(hero\.id\)\}/, 'Protection and Global Ban cards must use SP portraits.');
assert.doesNotMatch(rules, /\$\{role\.label\}/, 'Protection cards must not repeat role text beside the icon.');
assert.match(downloader, /btn_character_sp\.webp/);
assert.match(downloader, /isExpectedImage/);
assert.match(downloader, /sha256/);
assert.match(verifier, /btn_character_sp\.webp/);
assert.match(verifier, /SHA-256 mismatch/);
console.log('Local-only hero asset URL and validated downloader checks passed.');

assert.match(heroes, /getHeroTrailerUrls/);
assert.match(heroes, /getHeroTrailerPosterUrls/);
assert.match(heroes, /\/assets\/trailers\/\$\{heroId\}\.png/);
assert.match(app, /preview-hero-video/);

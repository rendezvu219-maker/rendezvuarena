import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const heroes = await readFile(new URL('../js/heroes.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const page = await readFile(new URL('../js/heroes-page.js', import.meta.url), 'utf8');
const broadcast = await readFile(new URL('../js/broadcast.js', import.meta.url), 'utf8');
const rules = await readFile(new URL('../js/draft-rules-form.js', import.meta.url), 'utf8');
const downloader = await readFile(new URL('../scripts/download-hero-assets.mjs', import.meta.url), 'utf8');
const verifier = await readFile(new URL('../scripts/verify-hero-assets.mjs', import.meta.url), 'utf8');
const {
  getHeroDisplayImage, getHeroFullImg, getHeroImg, getHeroImgSp,
  HEROES, heroMatchesSearch, imageWithFallback, isNikitaEasterEggSearch, NIKITA_EASTER_EGG,
} = await import(new URL('../js/heroes.js', import.meta.url));

for (const hero of HEROES) {
  const trailer = await stat(new URL(`../assets/trailers/${hero.id}.mp4`, import.meta.url));
  assert.ok(trailer.size > 100_000, `Trailer ${hero.id}.mp4 must be a non-empty deployable video.`);
}

for (const runtime of [heroes, app, page, broadcast, rules]) {
  assert.doesNotMatch(runtime, /dbg-squadra\.bn-ent\.net\/assets\/images\/hero/);
}
assert.match(heroes, /\/assets\/heroes\/\$\{id\}\/btn_character\.webp/);
assert.match(heroes, /\/assets\/heroes\/\$\{id\}\/btn_character_sp\.webp/);
assert.match(heroes, /\/assets\/heroes\/\$\{heroId\}\/skill\/icon_\$\{skillId\}/);
assert.match(app, /getHeroImg\(h\.id\).*getHeroImgHover\(h\.id\)/s, 'Character Pool must keep default + hover artwork.');
assert.match(app, /getHeroImgSp\(hero\.id\)/, 'Draft result slots must use SP portraits.');
assert.match(app, /getHeroFullImg\(hero\.id\)/, 'Full-art preview/cinematic must remain unchanged.');
assert.equal(getHeroDisplayImage('0017', 'daima', 'sp'), getHeroImgSp('0017'), 'Normal Daima search must keep the official SP portrait.');
assert.equal(getHeroDisplayImage('0017', 'daima', 'full'), getHeroFullImg('0017'), 'Daima search must not activate the Nikita artwork.');
assert.equal(getHeroDisplayImage('0017', 'nik', 'full'), NIKITA_EASTER_EGG.imagePath, 'The Nikita Easter egg must activate from nik onward.');
assert.equal(getHeroDisplayImage('0001', 'nikita', 'full'), getHeroFullImg('0001'), 'The Easter egg must never replace another hero.');
assert.equal(isNikitaEasterEggSearch('ni'), false);
for (const query of ['nik', 'niki', 'nikit', 'nikita', 'nikitaa', 'nikita arena']) assert.equal(isNikitaEasterEggSearch(query), true);
assert.equal(isNikitaEasterEggSearch('daima'), false, 'Daima must find Goku Mini without activating the Nikita Easter egg.');
for (const query of ['d', 'da', 'dai', 'daim', 'daima']) {
  assert.equal(heroMatchesSearch({ id:'0017', name:'Son Goku (Mini)', role:'Damage' }, query, 'Son Goku (Mini)', 'Damage'), true);
}
const fallbackMarkup = imageWithFallback(NIKITA_EASTER_EGG.imagePath, getHeroImg('0017'), 'Son Goku (Mini) <Nikita>', 'hero-detail-image');
assert.equal(fallbackMarkup, '<img class="hero-detail-image" src="/assets/easter-eggs/goku-mini-nikita.png" alt="Son Goku (Mini) &lt;Nikita&gt;" loading="lazy" data-fallback-src="/assets/heroes/0017/btn_character.webp">');
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

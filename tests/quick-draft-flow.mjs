import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const quick = read('quick-draft.html');
const draft = read('draft-room.html');
const broadcast = read('broadcast.html');
const app = read('js/app.js');
const server = read('server.js');
const broadcastJs = read('js/broadcast.js');
const rulesForm = read('js/draft-rules-form.js');
const hostSetup = read('js/host-setup.js');

assert.match(quick, /data-stage-preset="standard"/);
assert.match(quick, /data-stage-preset="tournament"/);
assert.match(quick, /id="quick-save-preset"/);
assert.match(quick, /id="quick-custom-preset-grid"/);
assert.match(quick, /id="quick-preset-detail"/);
assert.match(hostSetup, /gekishin\.quickDraft\.customPresets\.v1/);
assert.match(hostSetup, /snapshotPresetConfig/);
assert.match(hostSetup, /presetFacts/);
assert.match(hostSetup, /SAVE CURRENT AS PRESET|saveCurrentPreset/);
assert.match(quick, /<details class="advanced-settings"/);
assert.match(rulesForm, /\['all-random', 'All Random'/);
assert.match(rulesForm, /Host bans unwanted heroes first/);
assert.doesNotMatch(quick, /id="draft-view"/);
assert.doesNotMatch(quick, /id="broadcast-view"/);

assert.match(draft, /id="pre-draft-overlay"/);
assert.match(draft, /id="pre-draft-waiting-screen"/);
assert.match(draft, /id="draft-view"/);
assert.doesNotMatch(draft, /id="setup-view"/);

assert.match(broadcast, /id="broadcast-view"/);
assert.match(broadcastJs, /bc-team-ban-dock/);
assert.doesNotMatch(broadcastJs, /bc-ban-rail/);
assert.match(broadcastJs, /bc-lineup-dock/);
assert.match(broadcastJs, /teamALogoUrl/);
assert.match(broadcastJs, /getHeroTrailerUrls\(hero\.id/);
assert.match(draft, /id="preview-hero-video"/);
assert.match(draft, /id="preview-hero-poster"/);
assert.doesNotMatch(draft, /id="preview-hero-video"[^>]*\sloop(?:\s|>)/);
assert.match(app, /video\.onended = showPoster/);
assert.match(app, /showPreview\(hero, \{ playVideo: true \}\)/);
assert.match(app, /getHeroTrailerUrls\(hero\.id/);
assert.match(broadcastJs, /getHeroFullImg\(hero\.id\)/);

assert.match(app, /pre-draft-active/);
assert.match(app, /setPreDraftStage\(true, 'coin-flip-screen'\)/);
assert.match(app, /setPreDraftStage\(true, 'divine-draw-screen'\)/);
assert.match(app, /startAllRandomBanPhase/);

assert.match(app, /getHeroFullImg\(hero\.id\)/);
assert.match(app, /id=\"ban-phase-search\"/);
assert.match(app, /ban-phase-hero-role-label/);
assert.match(app, /localDraftUrl\(nextConfig, this\.roomRole\)/);
assert.match(app, /function serializableDraftConfig/);
assert.match(app, /const nextConfig = serializableDraftConfig\(this\.config\)/);
assert.match(app, /nextConfig,/);
assert.doesNotMatch(app, /team=preview`;/);

assert.match(server, /app\.get\('\/draft-room\.html'/);
assert.match(server, /app\.get\('\/broadcast\.html'/);
assert.match(server, /role === 'broadcaster' \? '\/broadcast\.html' : '\/draft-room\.html'/);

console.log('Quick Draft route separation and pre-draft isolation checks passed.');

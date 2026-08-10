import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BroadcastUI } from '../js/broadcast.js';

const script = await readFile(new URL('../js/broadcast.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../css/broadcast.css', import.meta.url), 'utf8');
const draftCss = await readFile(new URL('../css/draft.css', import.meta.url), 'utf8');
const page = await readFile(new URL('../js/broadcast-page.js', import.meta.url), 'utf8');
const heroes = await readFile(new URL('../js/heroes.js', import.meta.url), 'utf8');
const draftRoomApp = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const draftRoomHtml = await readFile(new URL('../draft-room.html', import.meta.url), 'utf8');
const broadcastHtml = await readFile(new URL('../broadcast.html', import.meta.url), 'utf8');

const aLineup = script.match(/<section class="bc-team-lineup bc-team-lineup-a">([\s\S]*?)<\/section>/)?.[1] || '';
const bLineup = script.match(/<section class="bc-team-lineup bc-team-lineup-b">([\s\S]*?)<\/section>/)?.[1] || '';
assert.ok(aLineup.indexOf('bc-team-a-picks') < aLineup.indexOf('bc-team-identity'), 'Team Blue picks must sit outside, with identity beside VS.');
assert.ok(bLineup.indexOf('bc-team-identity') < bLineup.indexOf('bc-team-b-picks'), 'Team Red identity must sit beside VS, before its outer picks.');
assert.match(script, /renderHostBans/);
assert.match(page, /all-random:bans/);
assert.match(css, /host-ban-rail/);
assert.match(css, /bc-team-ban-dock-a \{ grid-template-columns:minmax\(0,1fr\) minmax\(180px,36%\)/);
assert.match(css, /bc-team-ban-dock-b \{ grid-template-columns:minmax\(180px,36%\) minmax\(0,1fr\)/);

const eventBannerStart = script.indexOf('<header class="bc-event-banner"');
const heroStageStart = script.indexOf('<section class="bc-hero-stage"');
assert.ok(eventBannerStart >= 0 && eventBannerStart < heroStageStart, 'Tournament name must occupy the upper Broadcast rail.');
assert.match(script.slice(eventBannerStart, heroStageStart), /bc-tournament-name/);
assert.match(script, /resolveTournamentName/);

const matchCenterStart = script.indexOf('<div class="bc-match-center">');
const teamBStart = script.indexOf('<div class="bc-team-cluster bc-team-cluster-b">', matchCenterStart);
const centerMarkup = matchCenterStart >= 0 && teamBStart > matchCenterStart ? script.slice(matchCenterStart, teamBStart) : '';
assert.match(centerMarkup, /bc-live-meta/, 'Phase and timer must remain in the bottom center scoreboard.');
assert.doesNotMatch(centerMarkup, /bc-tournament-name/, 'Tournament name must not consume room beside phase/timer.');
assert.ok(centerMarkup.indexOf('bc-phase') < centerMarkup.indexOf('bc-timer'), 'Phase must have its own row above the countdown.');
assert.match(css, /bc-live-meta[^}]*grid-template-rows:auto auto/s);

assert.match(script, /configuredBanCount = Number\(this\.engine\.config\.heroBans \|\| 0\)/, 'Broadcast hero-ban boxes must follow heroBans only.');
assert.doesNotMatch(script, /configuredBanCount[^;]*divineBans/, 'Divine bans must not create Broadcast hero-ban boxes.');
assert.doesNotMatch(script, /teamA\.bans, \.\.\.this\.engine\.teamA\.divineBans/, 'Divine bans must not render into the hero-ban rail.');

assert.match(script, /getHeroTrailerUrls/);
assert.match(heroes, /\/assets\/trailers\/\$\{heroId\}\.mp4/);
assert.match(heroes, /\/assets\/trailers\/\$\{heroId\}\.png/);
assert.match(script, /const BROADCAST_HERO_HOLD_MS = 3000;/);
assert.match(script, /stage\.classList\.add\('media-switching'\)/);
assert.ok(script.indexOf("image.classList.remove('visible')") < script.indexOf('image.src = candidate.src'), 'The old poster must be hidden before the next hero image source is assigned.');
assert.match(script, /if \(!posterReady\) \{\s*heroHoldRequested = true;/, 'The held hero image must never show a stale frame while its new poster is still loading.');
assert.match(css, /\.bc-hero-stage\.media-switching \.bc-trailer-video,[\s\S]*opacity:0 !important; transition:none !important;/, 'Media switching must suppress stale video and poster frames without a fade.');
assert.match(script, /video\.onended = showLockedHero/);
assert.match(script, /this\.revealQueue\.push\(\{ hero, team, action \}\)/);
assert.match(script, /this\.revealHoldUntil = Date\.now\(\) \+ BROADCAST_HERO_HOLD_MS/);
assert.match(script, /this\.revealTimer = setTimeout\(\(\) => this\.scheduleNextHeroReveal\(\), delay\)/);
assert.match(script, /if \(this\.hasLockedHeroReveal\) \{\s*this\.pendingWaitingAction = action \|\| null;\s*return;/, 'Late state snapshots must not cancel active or queued hero reveals.');
assert.match(broadcastHtml, /broadcast-page\.js\?v=0\.6\.44-broadcast-reveal-queue/, 'Broadcast HTML must cache-bust the queued reveal controller.');
assert.match(broadcastHtml, /broadcast\.css\?v=0\.6\.44-broadcast-reveal-queue/, 'Broadcast HTML must cache-bust the media-switching styles.');
assert.doesNotMatch(script, /video\.currentTime >=/, 'Broadcast must play the full trailer instead of cutting it at three seconds.');
assert.match(script, /copy\.classList\.remove\('hidden'\)/);
assert.match(script, /this\.hasLockedHeroReveal = true/);
assert.match(script, /this\.engine\.state === 'active' && !this\.hasLockedHeroReveal/);
assert.doesNotMatch(script, /showPosterAndWait/);
assert.doesNotMatch(page, /type === 'draft:completed'[\s\S]{0,220}setStatusScreen/, 'The final hero reveal must not be covered by a completion status screen.');
assert.match(css, /\.bc-team-copy strong[^}]*overflow-wrap:anywhere[^}]*white-space:normal/s, 'Long Broadcast team names must wrap instead of being ellipsized.');
assert.match(script, /setTeamName\(root, value\)/, 'Broadcast must classify long team names for responsive font sizing.');
assert.match(css, /\.bc-team-copy strong\.is-very-long-team-name/, 'Very long Broadcast team names must use a compact multiline size.');
assert.match(css, /\.bc-side-card strong[^}]*overflow-wrap:anywhere[^}]*white-space:normal/s, 'Long side-selection team names must wrap.');
assert.match(draftCss, /\.team-name[^}]*overflow-wrap:\s*anywhere[^}]*white-space:\s*normal/s, 'Long Draft Room team names must wrap instead of being ellipsized.');
assert.match(draftRoomApp, /setTeamName\(root, value\)/, 'Draft Room must classify long team names for responsive font sizing.');
assert.match(draftCss, /\.team-name\.is-very-long-team-name/, 'Very long Draft Room team names must receive a denser font size.');
assert.match(draftRoomHtml, /data-no-i18n="true" id="team-a-name"/, 'Dynamic Blue team names must not be replaced by the translation observer.');
assert.match(draftRoomHtml, /data-no-i18n="true" id="team-b-name"/, 'Dynamic Red team names must not be replaced by the translation observer.');
assert.doesNotMatch(script, /id="bc-hero-video"[^>]*\sloop(?:\s|>)/);
assert.match(css, /bc-trailer-video[^}]*object-position: center -16px/s);
assert.doesNotMatch(heroes, /`\/trailers\/\$\{heroId\}/);



assert.match(script, /id="bc-side-assignment"/, 'Broadcast must own the neutral team side-assignment stage.');
assert.match(script, /orbitKeyframes/, 'Broadcast must animate the two team cards around an oval.');
assert.match(script, /const angle = startAngle - \(travel \* progress\)/, 'The oval must move counter-clockwise: top travels left, bottom travels right.');
assert.match(script, /const BROADCAST_SIDE_ORBIT_LOOPS = 4;/, 'Broadcast side reveal must complete four full oval revolutions.');
assert.match(script, /const fullOrbitTravel = BROADCAST_SIDE_ORBIT_LOOPS \* Math\.PI \* 2;/, 'Four-loop travel must be calculated independently from final side alignment.');
assert.match(script, /bc-side-card-flyer/, 'Broadcast cards must dock into the final Blue and Red setup.');
assert.match(page, /overlay\.renderPreDraftState\(state\.preDraft, entrants\)/, 'Broadcast must react to pre-draft side state.');
assert.match(css, /\.bc-side-orbit::before[^}]*border-radius: 50%/s, 'The side reveal must use a horizontal oval track.');
assert.match(css, /\.broadcast-view\.side-pending \.bc-lineup-dock/, 'Blue and Red setup must stay hidden before side selection.');
assert.doesNotMatch(draftRoomApp, /animateSideAssignment\(/, 'Team/Host Draft Room POV must not run the Broadcast oval animation.');

const queueHarness = Object.create(BroadcastUI.prototype);
Object.assign(queueHarness, {
  revealTimer: null,
  revealInProgress: false,
  revealHoldUntil: 0,
  revealQueue: [],
  played: [],
});
queueHarness.playHeroReveal = function playHeroReveal(item) {
  this.played.push(item.hero.id);
  this.revealInProgress = true;
};
queueHarness.revealHero({ id: 'first' }, 'A', 'pick');
queueHarness.revealHero({ id: 'second' }, 'B', 'pick');
assert.deepEqual(queueHarness.played, ['first'], 'A rapid second lock must not interrupt the active trailer.');
assert.deepEqual(queueHarness.revealQueue.map(item => item.hero.id), ['second']);
queueHarness.revealInProgress = false;
queueHarness.revealHoldUntil = Date.now() + 35;
queueHarness.scheduleNextHeroReveal();
assert.deepEqual(queueHarness.played, ['first'], 'The next trailer must wait through the poster hold.');
await new Promise(resolve => setTimeout(resolve, 55));
assert.deepEqual(queueHarness.played, ['first', 'second'], 'The queued trailer must start after the minimum hold.');

const snapshotHarness = Object.create(BroadcastUI.prototype);
Object.assign(snapshotHarness, {
  hasLockedHeroReveal: true,
  pendingWaitingAction: null,
  revealQueue: [{ hero: { id: 'queued' }, team: 'B', action: 'pick' }],
});
snapshotHarness.setWaitingForAction({ team: 'B', type: 'pick' });
assert.equal(snapshotHarness.revealQueue.length, 1, 'A late state snapshot must preserve queued locks.');

console.log('Broadcast event rail, side-orbit reveal, phase/timer separation, ban counts and local trailer paths passed.');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const script = await readFile(new URL('../js/broadcast.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../css/broadcast.css', import.meta.url), 'utf8');
const page = await readFile(new URL('../js/broadcast-page.js', import.meta.url), 'utf8');
const heroes = await readFile(new URL('../js/heroes.js', import.meta.url), 'utf8');
const draftRoomApp = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');

const aLineup = script.match(/<section class="bc-team-lineup bc-team-lineup-a">([\s\S]*?)<\/section>/)?.[1] || '';
const bLineup = script.match(/<section class="bc-team-lineup bc-team-lineup-b">([\s\S]*?)<\/section>/)?.[1] || '';
assert.ok(aLineup.indexOf('bc-team-a-picks') < aLineup.indexOf('bc-team-identity'), 'Team Blue picks must sit outside, with identity beside VS.');
assert.ok(bLineup.indexOf('bc-team-identity') < bLineup.indexOf('bc-team-b-picks'), 'Team Red identity must sit beside VS, before its outer picks.');
assert.match(script, /renderHostBans/);
assert.match(page, /all-random:bans/);
assert.match(css, /host-ban-rail/);
assert.match(css, /bc-team-ban-dock-a \{ grid-template-columns: minmax\(0, 1fr\)/);
assert.match(css, /bc-team-ban-dock-b \{ grid-template-columns: minmax\(150px, 31%\)/);

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
assert.match(script, /video\.onended = showPosterAndWait/);
assert.match(script, /preserveMedia: true/);
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

console.log('Broadcast event rail, side-orbit reveal, phase/timer separation, ban counts and local trailer paths passed.');

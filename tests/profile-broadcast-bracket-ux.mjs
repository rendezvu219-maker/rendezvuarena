import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const dashboard=read('js/dashboard.js');
const dashboardHtml=read('dashboard.html');
const dashboardCss=read('css/dashboard.css');
const broadcast=read('js/broadcast-page.js');
const devTest=read('server/dev-test-service.js');
const portal=read('portal.html');
const portalJs=read('js/portal.js');
const authHtml=read('auth.html');
const authJs=read('js/auth-page.js');
const profileJs=read('js/profile.js');
const server=read('server.js');
const external=read('server/external-profile-service.js');
const locales=JSON.parse(read('data/locales/ui-pages.json')).locales;

assert.match(dashboard,/HOW TO USE THIS PAGE/);
assert.match(dashboard,/Double round robin.*Every pair of teams plays twice/s);
assert.match(dashboard,/About GENERATE EARLY/);
assert.match(dashboard,/ops-standing-head/);
assert.match(dashboard,/OPEN MATCH/);
assert.match(dashboardCss,/BRACKET ONBOARDING \+ LARGE GROUP VIEW/);
assert.match(dashboardCss,/\.ops-standing-row\{[^}]*font-size:\.78rem/s);
assert.match(dashboardCss,/\.ops-group-matches \.ops-bracket-team-name[^}]*color:#f8faff/);
assert.match(dashboard,/ops-match-versus/);
assert.match(dashboard,/aria-label=\"\$\{escapeHtml\(`\$\{match\.team_a_name/);
assert.match(dashboardCss,/BRACKET MATCH PAIR CONTRAST/);
assert.match(dashboardCss,/\.ops-bracket-viewport \.ops-bracket-team\.side-a\{[^}]*linear-gradient/s);
assert.match(dashboardCss,/\.ops-bracket-viewport \.ops-bracket-team\.side-b\{[^}]*linear-gradient/s);
assert.match(dashboardCss,/\.ops-bracket-viewport \.ops-match-versus\{/);
assert.match(dashboardHtml,/dashboard\.css\?v=0\.6\.45-bracket-card-align/);
assert.match(dashboardHtml,/dashboard\.js\?v=0\.6\.48-account-dropdown/);
assert.match(dashboard,/const cardHeight=state\.bracketCompact\?104:136/);
assert.match(dashboard,/ops-match-footer-right/);
assert.match(dashboardCss,/BRACKET CARD HEIGHT \+ ALIGNMENT FIX/);
assert.match(dashboardCss,/grid-template-columns:minmax\(0,1fr\) auto minmax\(0,1fr\)/);
assert.match(dashboardCss,/BRACKET PAGE SCROLL FIX/);
assert.match(dashboardCss,/\.ops-bracket-controls \{ position:static;/);
assert.match(dashboardCss,/\.ops-bracket-viewport \{ position:relative; overflow-x:auto; overflow-y:hidden; min-height:420px; max-height:none;/);
assert.doesNotMatch(dashboardCss,/\.ops-bracket-viewport \{[^}]*max-height:72vh/);
assert.match(dashboard,/event\.shiftKey&&Math\.abs\(event\.deltaY\)>Math\.abs\(event\.deltaX\)/);
assert.match(dashboard,/if\(canPanVertically\(\)\)viewport\.scrollTop=top-\(event\.clientY-startY\)/);

assert.match(broadcast,/You select a <b>match<\/b>, not one team/);
assert.match(broadcast,/Grant Broadcast access/);
assert.match(broadcast,/SELECT &amp; WAIT/);
assert.match(broadcast,/broadcast-selector-refresh/);
assert.match(devTest,/user\.persona==='broadcaster'\)target='\/broadcast\.html'/);

for(const id of ['portal-profile-settings-form','portal-change-password-form','portal-show-external-profiles']){
  assert.match(portal,new RegExp(`id="${id}"`));
}
assert.doesNotMatch(portal,/id="portal-change-email-form"|id="portal-register-email"/);
assert.doesNotMatch(authHtml,/id="account-register-email"|id="account-register-display"|id="account-verify"/);
assert.match(authHtml,/id="account-register-password-confirm"/);
assert.match(authHtml,/class="public-test-warning"/);
assert.match(portal,/public-test-warning/);
assert.match(authJs,/passwordConfirmation/);
assert.match(server,/\/api\/profile\/settings/);
assert.match(server,/\/api\/profiles\/:username/);
assert.match(server,/\/api\/connections\/challonge/);
assert.match(external,/startgg: \{ oauth: false, manual: true/);
assert.match(external,/tonamel: \{ oauth: false, manual: true/);
assert.match(external,/challonge: \{ oauth: false, manual: true/);
assert.match(portalJs,/const manualCard=/);
assert.doesNotMatch(portalJs,/connectedProfileCard/);
assert.doesNotMatch(portalJs,/data-connect-provider|portal-email-verification/);
assert.match(dashboardCss,/ACCOUNT PROFILE \+ LINKED PLATFORMS LAYOUT/);
assert.match(dashboardCss,/#portal-profile-settings-form\{grid-row:span 2\}/);
assert.match(dashboardCss,/\.portal-settings-card,\.portal-provider-card\{display:grid;grid-template-columns:1fr/);
assert.match(dashboardCss,/\.portal-provider-card--startgg\{grid-column:1\/-1;grid-template-columns:1fr/);
assert.match(profileJs,/profile-provider-grid/);
assert.match(portal,/id="profile-settings"/);
assert.match(dashboardCss,/v0\.6\.47 PROFILE CARD INNER SPACING/);
assert.match(dashboardCss,/\.portal-settings-card \{[\s\S]*padding: 18px;/);

const requiredKeys=['profileAndPrivacy','manageYourProfile','changePasswordTitle','profileVisibility','showTournamentProfiles','tonamelManualProfileDesc','startggManualProfileDesc','privateProfileMessage','linkedTournamentProfiles','confirmPassword','registrationPasswordMismatch','publicTestWarningTitle','publicTestWarningBody','tournamentProfileLinks','linkThreePlatforms','tournamentProfileLinksDesc'];
for(const [locale,catalog] of Object.entries(locales)){
  for(const key of requiredKeys)assert.ok(String(catalog[key]||'').trim(),`${locale}.${key} must be translated.`);
}

console.log('Profile, Broadcast selector and bracket onboarding checks passed.');

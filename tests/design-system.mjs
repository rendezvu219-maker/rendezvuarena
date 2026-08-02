import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { THEMES, normalizeAuraId } from '../js/heroes.js';
import { normalizeDraftRules, renderDraftRulesForm } from '../js/draft-rules-form.js';

const variables = await readFile(new URL('../css/variables.css', import.meta.url), 'utf8');
const draftCss = await readFile(new URL('../css/draft.css', import.meta.url), 'utf8');
const preferences = await readFile(new URL('../js/preferences.js', import.meta.url), 'utf8');
const components = await readFile(new URL('../css/components.css', import.meta.url), 'utf8');
const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');

for (const token of [
  '--surface-canvas', '--surface-base', '--surface-raised', '--text-primary',
  '--team-left-primary', '--team-right-primary',
  '--role-damage', '--role-tank', '--role-tech', '--aura-accent',
]) assert.match(variables, new RegExp(token.replaceAll('-', '\\-')), `Missing ${token}.`);

assert.match(variables, /data-theme='dark'/);
assert.match(variables, /data-theme='light'/);
assert.match(variables, /data-contrast='high'/);
assert.match(variables, /data-palette='accessible'/);
assert.match(variables, /data-aura='beerus'/);
assert.match(variables, /data-aura='goku-black'/);
assert.doesNotMatch(draftCss, /theme-season6/);
assert.doesNotMatch(variables, /--team-blue|--team-red|--bg-dark|--accent-gold/);
assert.match(variables, /--team-left-primary:\s*#1593ff/i);
assert.match(variables, /--team-right-primary:\s*#ff334d/i);
assert.match(preferences, /prefers-color-scheme/);
assert.match(preferences, /prefers-reduced-motion/);
assert.match(preferences, /gs-global-menu/);
assert.match(preferences, /data-account-settings/);
assert.match(preferences, /data-public-profile/);
assert.match(preferences, /wireHomeBrands/);
assert.match(preferences, /wirePasswordVisibility/);
assert.match(preferences, /input\[type='password'\]/);
assert.match(preferences, /input\.type = visible \? 'text' : 'password'/);
assert.match(preferences, /aria-pressed/);
assert.match(components, /\.gs-global-menu-panel/);
assert.match(components, /\.gs-ops-home-brand/);
assert.match(components, /\.gs-password-toggle/);
assert.match(home, /data-i18n="tournamentOps" href="\/dashboard\.html">Tournament Ops<\/a>/);
assert.doesNotMatch(components, /\.btn:active\s*\{[^}]*translateY/s, 'Button activation must not shift the UI vertically.');
assert.match(components, /draft-rule-hero-grid[^}]*overflow-anchor:\s*none/s);

assert.match(draftCss, /#divine-draw-screen[\s\S]*max-width:\s*1080px/);
assert.match(draftCss, /\.divine-reel-item\s*\{[^}]*flex:\s*0 0 148px/s);
assert.match(draftCss, /\.ban-slot \.ban-name\s*\{\s*display:\s*none\s*!important;/);
assert.match(draftCss, /data-theme='light'[\s\S]*\.hero-card \.card-inner::after/);
assert.match(
  draftCss,
  /\.pick-slot\.filled \.slot-hero-img\s*\{[^}]*background-size:\s*contain;[^}]*background-repeat:\s*no-repeat;[^}]*background-position:\s*right center;/s,
  'Locked pick art must scale down proportionally instead of being cropped.',
);

assert.deepEqual(Object.keys(THEMES), ['beerus', 'goku-black']);
assert.equal(normalizeAuraId('gold'), 'beerus');
assert.equal(normalizeAuraId('rosé'), 'goku-black');
assert.equal(normalizeAuraId('season6'), 'beerus');

const rules = normalizeDraftRules({ draftStyle: 'all-random', timerSeconds: 75, protectList: ['0038', '0038'] });
assert.equal(rules.draftStyle, 'all-random');
assert.equal(rules.timerSeconds, 75);
assert.deepEqual(rules.protectList, ['0038']);
const html = renderDraftRulesForm(rules, { formId: 'test-rules', submitLabel: 'SAVE' });
assert.match(html, /data-rule-section="core"/);
assert.match(html, /data-rule-section="bans"/);
assert.match(html, /data-rule-section="protection"/);
assert.match(html, /data-rule-section="presentation"/);
assert.match(html, /39-hero roster/);
assert.match(html, /draft-rule-choice-icon/);
assert.match(html, /assets\/roles\/damage\.png/);
assert.match(html, /assets\/roles\/tank\.png/);
assert.match(html, /assets\/roles\/technical\.png/);
assert.doesNotMatch(html, /⟫|◆|◎|⚔|🎲|🪙|🛡|🎬|🎥|⚡/);
assert.match(html, /data-rule-field="draftStyle"/);
assert.match(html, /All Random/);
assert.match(html, /draft-rule-protection-layout/);

console.log('Design system tokens, preferences, aura isolation and shared Draft Rules component passed.');

import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import {
  DIVINE_RULES,
  buildDivineBanSequence,
  buildDivinePickBanSequence,
  entrantForSide,
  resolveSideAssignment,
  sideForEntrant,
} from '../js/pre-draft.js';
import { normalizeDraftRules, renderDraftRulesForm } from '../js/draft-rules-form.js';

const blueForWinner = resolveSideAssignment('teamA', 'A');
assert.deepEqual(blueForWinner, { A: 'teamA', B: 'teamB' });
assert.equal(sideForEntrant(blueForWinner, 'teamA'), 'A');
assert.equal(entrantForSide(blueForWinner, 'B'), 'teamB');

const redForWinner = resolveSideAssignment('teamA', 'B');
assert.deepEqual(redForWinner, { A: 'teamB', B: 'teamA' });
assert.equal(sideForEntrant(redForWinner, 'teamA'), 'B');
assert.equal(entrantForSide(redForWinner, 'A'), 'teamB');

for (const rule of DIVINE_RULES) {
  await access(new URL(`../divine/${rule.file}`, import.meta.url));
}

assert.deepEqual(buildDivineBanSequence(0), []);
assert.deepEqual(buildDivineBanSequence(1), [
  { team: 'A', action: 'ban' },
  { team: 'B', action: 'ban' },
]);
assert.deepEqual(buildDivineBanSequence(2), [
  { team: 'A', action: 'ban' },
  { team: 'B', action: 'ban' },
  { team: 'A', action: 'ban' },
  { team: 'B', action: 'ban' },
]);

for (const banCount of [0, 1, 2, 3]) {
  const sequence = buildDivinePickBanSequence(banCount);
  assert.equal(sequence.filter(step => step.action === 'ban' && step.team === 'A').length, banCount);
  assert.equal(sequence.filter(step => step.action === 'ban' && step.team === 'B').length, banCount);
  assert.deepEqual(sequence.slice(-2), [
    { team: 'B', action: 'pick' },
    { team: 'A', action: 'pick' },
  ]);
  assert.equal(sequence.filter(step => step.action === 'pick').length, 2, 'A match must activate exactly two Divine Draws total.');
  assert.equal(sequence.filter(step => step.action === 'pick' && step.team === 'A').length, 1);
  assert.equal(sequence.filter(step => step.action === 'pick' && step.team === 'B').length, 1);
}

assert.equal(normalizeDraftRules({ seriesRule: 'team_no_repeat' }).seriesRule, 'team_no_repeat');
assert.equal(normalizeDraftRules({ seriesRule: 'fearless' }).seriesRule, 'fearless');
assert.equal(normalizeDraftRules({ seriesRule: 'invalid' }).seriesRule, 'normal');
const rulesMarkup = renderDraftRulesForm({ seriesRule: 'fearless' }, { sections: ['core'] });
assert.match(rulesMarkup, /Team No Repeat/);
assert.match(rulesMarkup, /Fearless Draft/);
assert.match(rulesMarkup, /if your team used Goku in Game 1, your team cannot use Goku again—but the other team still can/i);
assert.match(rulesMarkup, /if either team used Goku in Game 1, neither team can use Goku again/i);
assert.match(rulesMarkup, /Easy way to remember/);
assert.match(rulesMarkup, /Banned heroes do not become permanently locked/);
assert.match(rulesMarkup, /name="seriesRule" value="fearless"[^>]*checked/);

const app = await readFile(new URL('../js/app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../draft-room.html', import.meta.url), 'utf8');
const server = await readFile(new URL('../server.js', import.meta.url), 'utf8');
assert.match(app, /!this\.config\.quickDraft && teamKey !== 'teamA'/, 'Tournament Team A must own the coin call.');
assert.match(app, /coinCaller === 'teamA'\s*\? 'teamB' : 'teamA'/, 'A lost call must transfer side choice to the opponent.');
assert.match(app, /divine\.drawnIndices = \[divine\.picks\.A, divine\.picks\.B\]/, 'Pick/Ban must resolve one Draw per side.');
assert.match(app, /winnerSide: winnerSideForApi/, 'Game results must map Blue/Red back to bracket Team A/Team B.');
assert.match(app, /restoreDraftVisuals\(\)[\s\S]*this\.updateCurrentActionUi\(\)/, 'Restored rooms must refresh the BAN/LOCK IN label from the current action.');
assert.match(html, /id="pre-draft-matchup-stage"/);
assert.match(html, /data-side-choice="A"/);
assert.match(html, /data-side-choice="B"/);
assert.match(server, /pre-draft:coin-call/);
assert.match(server, /preDraft/);
assert.match(server, /draftEngineTeamsByEntrant/);

console.log('Coin call, side assignment, two-Draw Divine flow and series-rule UI checks passed.');

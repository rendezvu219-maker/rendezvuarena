import assert from 'node:assert/strict';
import { normalizeRules, draftSequence, deriveDraft, createBracket, deriveBracket } from '../js/static-core.js';

const rules = normalizeRules({ bestOf: 3, mode: 'draft', banOrder: 'B A A B', pickOrder: 'A B B A B A A B' });
assert.equal(draftSequence(rules).length, 12);
assert.deepEqual(draftSequence(rules).slice(0, 4).map(action => action.side), ['B','A','A','B']);

const config = { teamA:'Cerydra', teamB:'Tribbie', rules };
const heroes = ['0001','0002','0003','0004','0005','0006','0007','0008','0012','0009','0014','0010'];
const events = {};
draftSequence(rules).forEach((action, step) => { events[String(step).padStart(3,'0')] = { ...action, heroId:heroes[step], step, game:1 }; });
const draft = deriveDraft(config, events);
assert.equal(draft.step, 12);
assert.equal(draft.complete, true);
assert.equal(draft.picks.A.length, 4);
assert.equal(draft.picks.B.length, 4);

const bracketConfig = { teams:['T1','T2','T3','T4','T5','T6','T7','T8'], rules };
assert.equal(createBracket(bracketConfig.teams).length, 7);
const bracketEvents = {
  a:{ type:'winner', matchId:'M1', side:'A' }, b:{ type:'winner', matchId:'M2', side:'B' },
  c:{ type:'winner', matchId:'M3', side:'A' }, d:{ type:'winner', matchId:'M4', side:'B' },
  e:{ type:'winner', matchId:'M5', side:'A' }, f:{ type:'winner', matchId:'M6', side:'B' },
  g:{ type:'winner', matchId:'M7', side:'A' },
};
let bracket = deriveBracket(bracketConfig, bracketEvents);
assert.equal(bracket.find(match => match.id === 'M5').teamA, 'T1');
assert.equal(bracket.find(match => match.id === 'M5').teamB, 'T4');
assert.equal(bracket.find(match => match.id === 'M7').winner, 'T1');

// Correcting an upstream result clears dependent winners until they are selected again.
bracketEvents.h = { type:'winner', matchId:'M1', side:'B' };
bracket = deriveBracket(bracketConfig, bracketEvents);
assert.equal(bracket.find(match => match.id === 'M5').teamA, 'T2');
assert.equal(bracket.find(match => match.id === 'M5').winner, null);
assert.equal(bracket.find(match => match.id === 'M7').winner, null);
assert.equal(bracket.find(match => match.id === 'M7').teamA, 'Winner M5');

console.log('Static Quick Match and tournament state tests passed.');

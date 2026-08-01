import assert from 'node:assert/strict';
import { DraftEngine, draftActionPresentation } from '../js/draft.js';
import { HEROES, generateDraftSequence } from '../js/heroes.js';

const summarize = sequence => sequence.map(step => `${step.team}${step.type === 'ban' ? 'B' : 'P'}`);

assert.deepEqual(draftActionPresentation({ type:'ban' }), { phaseKey:'banPhase', buttonKey:'ban', isBan:true });
assert.deepEqual(draftActionPresentation({ type:'divine-ban' }), { phaseKey:'divineBan', buttonKey:'ban', isBan:true });
assert.deepEqual(draftActionPresentation({ type:'pick' }), { phaseKey:'pickPhase', buttonKey:'lockIn', isBan:false });

const twoBan = generateDraftSequence(2, 1, 4);
assert.deepEqual(summarize(twoBan), [
  'AB','BB',
  'AP','BP','BP','AP',
  'AB','BB',
  'BP','AP','AP','BP',
]);
assert.equal(twoBan.filter(step => step.type === 'ban' && step.team === 'A').length, 2);
assert.equal(twoBan.filter(step => step.type === 'ban' && step.team === 'B').length, 2);
assert.equal(twoBan.filter(step => step.type === 'divine-ban').length, 0, 'Divine bans must not become hero-ban turns.');

const threeBan = generateDraftSequence(3, 2, 4);
assert.deepEqual(summarize(threeBan), [
  'AB','AB','BB','BB',
  'AP','BP','BP','AP',
  'AB','BB',
  'BP','AP','AP','BP',
]);
assert.equal(threeBan.filter(step => step.type === 'ban' && step.team === 'A').length, 3);
assert.equal(threeBan.filter(step => step.type === 'ban' && step.team === 'B').length, 3);

const firstByRole = role => HEROES.find(hero => hero.role === role);
const damage = firstByRole('Damage');
const tank = firstByRole('Tank');
const technical = firstByRole('Technical');
assert(damage && tank && technical);

function engine(mode) {
  return new DraftEngine({ mirrorPickMode: mode, heroBans: 0, divineBans: 0, timerAuthority: false });
}
function markTeamAPick(draft, hero) {
  draft.teamA.picks.push(hero.id);
  draft.teamA.roleCounts[hero.role] += 1;
  draft.refreshPickedStatus(hero.id);
}

for (const [mode, hero, allowed] of [
  ['none', tank, false],
  ['tank', tank, true],
  ['tank', damage, false],
  ['technical', technical, true],
  ['damage', damage, true],
  ['tank-technical', tank, true],
  ['tank-technical', technical, true],
  ['tank-technical', damage, false],
  ['all', damage, true],
]) {
  const draft = engine(mode);
  markTeamAPick(draft, hero);
  const reason = draft.getHeroUnavailableReason(hero.id, { type: 'pick', team: 'B' });
  assert.equal(reason === null, allowed, `${mode} should ${allowed ? 'allow' : 'block'} ${hero.role} mirror.`);
}

const sameTeam = engine('all');
markTeamAPick(sameTeam, tank);
assert.equal(sameTeam.getHeroUnavailableReason(tank.id, { type: 'pick', team: 'A' })?.code, 'same_team_duplicate');

const fixed = engine('all');
assert.deepEqual(fixed.config.roleLimits, { Damage: 2, Tank: 1, Technical: 1 });
fixed.teamA.roleCounts.Damage = 2;
assert.match(fixed.getRoleRestrictionReason(damage.id, { type: 'pick', team: 'A' }), /limit reached/i);

function roleSummary(ids) {
  return ids.reduce((summary, id) => {
    const hero = HEROES.find(item => item.id === id);
    summary[hero.role] += 1;
    return summary;
  }, { Damage: 0, Tank: 0, Technical: 0 });
}

function keepOnly(draft, ids) {
  const allowed = new Set(ids);
  draft.heroes.forEach(hero => {
    if (!allowed.has(hero.id)) hero.status = 'banned';
  });
}

// All Random must use the same fixed roles and explicitly respect Mirror Pick.
const randomNone = engine('none');
const randomNoneAssignments = randomNone.generateAllRandomAssignments({ rng: () => 0.314159 });
assert.deepEqual(roleSummary(randomNoneAssignments.A), { Damage: 2, Tank: 1, Technical: 1 });
assert.deepEqual(roleSummary(randomNoneAssignments.B), { Damage: 2, Tank: 1, Technical: 1 });
assert.equal(new Set(randomNoneAssignments.A).size, 4, 'A random team cannot contain duplicate heroes.');
assert.equal(new Set(randomNoneAssignments.B).size, 4, 'B random team cannot contain duplicate heroes.');
assert.equal(
  randomNoneAssignments.A.some(id => randomNoneAssignments.B.includes(id)),
  false,
  'No Mirror Picks must keep both random teams fully unique.'
);

const randomMirrorRoleAllowed = (mode, role) => (
  mode === 'all'
  || mode === role.toLowerCase()
  || (mode === 'tank-technical' && (role === 'Tank' || role === 'Technical'))
);
for (const mode of ['none', 'tank', 'technical', 'damage', 'tank-technical', 'all']) {
  const assignments = engine(mode).generateAllRandomAssignments({ rng: () => 0.424242 });
  for (const id of assignments.A.filter(heroId => assignments.B.includes(heroId))) {
    const role = HEROES.find(hero => hero.id === id)?.role;
    assert.equal(randomMirrorRoleAllowed(mode, role), true, `${mode} All Random created an illegal ${role} mirror.`);
  }
}

const fourDamage = HEROES.filter(hero => hero.role === 'Damage').slice(0, 4);
const oneTank = HEROES.filter(hero => hero.role === 'Tank').slice(0, 1);
const twoTechnical = HEROES.filter(hero => hero.role === 'Technical').slice(0, 2);
const tightPoolIds = [...fourDamage, ...oneTank, ...twoTechnical].map(hero => hero.id);

const randomTankMirror = engine('tank');
keepOnly(randomTankMirror, tightPoolIds);
const tankMirrorAssignments = randomTankMirror.generateAllRandomAssignments({ rng: () => 0.271828 });
assert.equal(
  tankMirrorAssignments.A.find(id => HEROES.find(hero => hero.id === id)?.role === 'Tank'),
  tankMirrorAssignments.B.find(id => HEROES.find(hero => hero.id === id)?.role === 'Tank'),
  'Tank Mirror must allow the only eligible Tank to appear for both random teams.'
);
for (const id of tankMirrorAssignments.A.filter(id => HEROES.find(hero => hero.id === id)?.role !== 'Tank')) {
  assert.equal(tankMirrorAssignments.B.includes(id), false, 'Non-Tank heroes must remain unique in Tank Mirror mode.');
}

const impossibleNoMirror = engine('none');
keepOnly(impossibleNoMirror, tightPoolIds);
assert.throws(
  () => impossibleNoMirror.generateAllRandomAssignments({ rng: () => 0.5 }),
  /too few unique Tank|No-Mirror randomization/i,
  'No Mirror mode must reject a pool containing only one eligible Tank.'
);

const allMirrorPool = engine('all');
keepOnly(allMirrorPool, [
  ...HEROES.filter(hero => hero.role === 'Damage').slice(0, 2),
  ...HEROES.filter(hero => hero.role === 'Tank').slice(0, 1),
  ...HEROES.filter(hero => hero.role === 'Technical').slice(0, 1),
].map(hero => hero.id));
const allMirrorAssignments = allMirrorPool.generateAllRandomAssignments({ rng: () => 0.123456 });
assert.deepEqual(new Set(allMirrorAssignments.A), new Set(allMirrorAssignments.B), 'All Role Mirror must permit both random teams to share the same limited pool.');

const repeatAvoidance = engine('none').generateAllRandomAssignments({
  rng: () => 0.618033,
  avoidHeroIds: ['0008', '0014'], // Zamasu and Super Uub
});
assert.equal(
  [...repeatAvoidance.A, ...repeatAvoidance.B].some(id => id === '0008' || id === '0014'),
  false,
  'The previous roll should be avoided when every role still has enough alternatives.'
);



// Timer is restricted to the supported 30s–90s range.
assert.equal(new DraftEngine({ timerSeconds: 10, timerAuthority: false }).config.timerSeconds, 30);
assert.equal(new DraftEngine({ timerSeconds: 120, timerAuthority: false }).config.timerSeconds, 90);
assert.equal(new DraftEngine({ timerSeconds: 75, timerAuthority: false }).config.timerSeconds, 75);

// Late-ban role protection targets the opponent's completed role slots.
const lateBan = engine('all');
lateBan.teamA.roleCounts.Technical = 1;
lateBan.teamA.picks.push(technical.id);
lateBan.refreshPickedStatus(technical.id);
const anotherTechnical = HEROES.find(hero => hero.role === 'Technical' && hero.id !== technical.id);
assert(anotherTechnical, 'A second Technical hero is required for the late-ban test.');
assert.equal(
  lateBan.getHeroUnavailableReason(anotherTechnical.id, { type: 'ban', team: 'B' })?.code,
  'target_role_complete',
  'Team B must not ban Technical after Team A completed its Technical slot.'
);
assert.equal(
  lateBan.getHeroUnavailableReason(anotherTechnical.id, { type: 'ban', team: 'A' }),
  null,
  'Team A may still ban Technical while Team B has not completed its Technical slot.'
);
lateBan.teamB.roleCounts.Damage = 1;
const anotherDamage = HEROES.find(hero => hero.role === 'Damage' && hero.id !== damage.id);
assert.equal(
  lateBan.getHeroUnavailableReason(anotherDamage.id, { type: 'ban', team: 'A' }),
  null,
  'One Damage pick is not enough to close the opponent\'s two Damage slots.'
);
lateBan.teamB.roleCounts.Damage = 2;
assert.equal(
  lateBan.getHeroUnavailableReason(anotherDamage.id, { type: 'ban', team: 'A' })?.code,
  'target_role_complete',
  'Damage bans must close only after the opponent completed both Damage slots.'
);


// Fearless starts from Game 2 by loading picks from completed earlier games.
const fearlessLockedHero = HEROES.find(hero => hero.id !== damage.id && hero.id !== tank.id && hero.id !== technical.id) || damage;
const fearless = new DraftEngine({
  seriesRule: 'fearless',
  gameNumber: 2,
  previousPicksA: [fearlessLockedHero.id],
  previousPicksB: [],
  timerAuthority: false,
});
assert.equal(
  fearless.getHeroUnavailableReason(fearlessLockedHero.id, { type: 'pick', team: 'B' })?.code,
  'fearless_lock',
  'A hero picked in Game 1 must be locked for both teams in a Fearless Game 2 draft.'
);
const normalLaterGame = new DraftEngine({
  seriesRule: 'normal',
  gameNumber: 2,
  previousPicksA: [fearlessLockedHero.id],
  timerAuthority: false,
});
assert.equal(
  normalLaterGame.getHeroUnavailableReason(fearlessLockedHero.id, { type: 'pick', team: 'B' }),
  null,
  'Normal series should allow earlier picks to be reused.'
);

console.log('Draft sequence, fixed roles, All Random Mirror Pick, fair rerolls, timer, Fearless and late-ban role rules passed.');

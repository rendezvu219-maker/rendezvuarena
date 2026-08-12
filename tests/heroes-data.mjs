import assert from 'node:assert/strict';
import { HEROES, getHeroFullImg } from '../js/heroes.js';
import { HEROES_DATA } from '../js/heroes-data.js';

const ids = HEROES.map(hero => hero.id);
assert.equal(new Set(ids).size, ids.length, 'Hero IDs must be unique.');
assert.equal(HEROES.length, 40, 'Current roster should contain 40 heroes.');

const jiren = HEROES.find(hero => hero.id === '0040');
assert.deepEqual(jiren, { id: '0040', name: 'Jiren (Full Power)', role: 'Tank', isNew: true });

const jirenData = HEROES_DATA['0040'];
assert.equal(jirenData.difficulty, '20');
assert.match(jirenData.description, /grows stronger the longer he fights/);
assert.equal(jirenData.skills.length, 7);
assert.equal(jirenData.skills[0].name, 'Strength Is Justice');
assert.equal(jirenData.skills[5].name, 'Omega Heatwall');
assert.equal(jirenData.skills[6].name, 'Full Power');

for (const hero of HEROES) {
  const detail = HEROES_DATA[hero.id];
  assert(detail, `Missing detail data for ${hero.id} ${hero.name}.`);
  assert.equal(detail.id, hero.id, `Detail ID mismatch for ${hero.name}.`);
  assert(Array.isArray(detail.skills) && detail.skills.length >= 5, `${hero.name} should have complete skill data.`);
}

const gokuBlack = HEROES.find(hero => hero.id === '0039');
assert(gokuBlack, 'Goku Black must be present in the hero pool.');
assert.equal(gokuBlack.name, 'Goku Black');
assert.equal(gokuBlack.role, 'Technical');
assert.equal(gokuBlack.isNew, true);

const gokuBlackData = HEROES_DATA['0039'];
assert.equal(gokuBlackData.description.startsWith('A dark hero'), true);
assert.deepEqual(gokuBlackData.skills.map(skill => skill.name), [
  'Path to the Divine',
  'Rush Attack',
  'Black Kamehameha',
  'Black Break',
  'Black Bind',
  'Black Power Ball',
]);
assert.match(getHeroFullImg('0039'), /0039\/image_character\.webp\?v=2$/);

console.log('Current hero roster, Jiren, and Goku Black data passed.');

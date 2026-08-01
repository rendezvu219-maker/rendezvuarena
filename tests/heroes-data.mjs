import assert from 'node:assert/strict';
import { HEROES, getHeroFullImg } from '../js/heroes.js';
import { HEROES_DATA } from '../js/heroes-data.js';

const ids = HEROES.map(hero => hero.id);
assert.equal(new Set(ids).size, ids.length, 'Hero IDs must be unique.');
assert.equal(HEROES.length, 39, 'Season 6.1 roster should contain 39 heroes.');

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

console.log('Season 6.1 hero roster and Goku Black data passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateBuildData } from '../js/character-builds.js';
const read = name => JSON.parse(fs.readFileSync(new URL(`../${name}`, import.meta.url)));
const data = read('data/character-builds.json');
validateBuildData(data);
const catalog = read('assets/divine-cards/catalog.json');
const rows = read('data/locales/divine-cards.json').translations;
for (const name of ['Lightning Swift','Super Snowball','Build Up']) {
  const card = data.cards.find(c => c.name === name);
  const canonical = catalog.find(c => c.id === card.id);
  assert.equal(card.effect, canonical.effect);
  assert.equal(card.note, canonical.note);
  for (const [locale, translated] of Object.entries(card.translations)) {
    if (name === 'Lightning Swift') {
      assert.match(translated.effect.replace(/[,.]/g, ''), /1200/);
      assert.match(translated.note, /15/);
      assert.doesNotMatch(translated.note, /\b6\b/);
    } else if (name === 'Super Snowball') {
      assert.match(translated.note, /10/);
      assert.doesNotMatch(translated.note, /8/);
    } else {
      assert.match(translated.note, /25/);
      assert.doesNotMatch(translated.note, /22/);
    }
    if (locale !== 'en') {
      const row = rows.find(r => r.cardId === card.id && r.locale === locale);
      assert.equal(row.effect, translated.effect);
      assert.equal(row.note, translated.note);
    }
  }
}
const build = data.cards.find(c => c.name === 'Build Up');
assert.match(build.note, /Maximum All Defense Up: 25/);
assert.doesNotMatch(build.note, /25.*per stack/, 'The user supplied a maximum, not 25 defense per stack.');
console.log('Combo Card balance changes match the user patch notes in all six locales.');

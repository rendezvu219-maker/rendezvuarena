import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { HEROES_DATA } from '../js/heroes-data.js';
import { FULL_HERO_DETAIL_OVERRIDES } from '../js/i18n-hero-details.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const readJson = relative => JSON.parse(fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8'));

const master = readJson('data/locales/vi-skill-name-master.json');
assert.equal(master.schemaVersion, 1);
assert.equal(master.locale, 'vi');
assert.equal(master.status, 'user-approved');
assert.equal(master.skills.length, 207);

const approved = new Map(master.skills.map(row => [row.english, row.vietnamese]));
assert.equal(approved.size, 207, 'The Master must contain 207 unique English skill names.');

const sourceCatalog = readJson('data/locales/official-hero-details.json').locales.vi;
const runtimeCatalog = FULL_HERO_DETAIL_OVERRIDES.vi;
let slotCount = 0;
for (const [heroId, hero] of Object.entries(HEROES_DATA)) {
  assert.ok(sourceCatalog[heroId], `Missing Vietnamese source record ${heroId}.`);
  assert.ok(runtimeCatalog[heroId], `Missing Vietnamese runtime record ${heroId}.`);
  for (const skill of hero.skills) {
    const expected = approved.get(skill.name);
    assert.ok(expected, `Master is missing ${skill.name}.`);
    assert.equal(sourceCatalog[heroId].skills[skill.id].name, expected, `Source Master mismatch at ${heroId}.${skill.id}.`);
    assert.equal(runtimeCatalog[heroId].skills[skill.id].name, expected, `Runtime Master mismatch at ${heroId}.${skill.id}.`);
    slotCount += 1;
  }
}
assert.equal(slotCount, 252);

const fixedNames = new Map([
  ['Kaioken', 'Giới Vương Quyền'],
  ['Spirit Bomb', 'Quả Cầu Khinh Khí'],
  ['Instant Transmission', 'Dịch Chuyển Tức Thời'],
  ['Solar Flare', 'Thái Dương Hạ San'],
]);
for (const [english, vietnamese] of fixedNames) assert.equal(approved.get(english), vietnamese);

const divine = readJson('data/locales/divine-cards.json');
const viRows = divine.translations.filter(row => row.locale === 'vi');
assert.equal(viRows.length, 18);
const vanishingRows = viRows.filter(row => /Vanishing Step/.test(`${row.description} ${row.effect} ${row.note}`));
assert.equal(vanishingRows.length, 4);
for (const row of vanishingRows) {
  const text = `${row.description} ${row.effect} ${row.note}`;
  assert.match(text, /Bộ Pháp Biến Mất \(Vanishing Step\)/);
  assert.doesNotMatch(text, /Bước Biến Ảnh/);
}

console.log(`Vietnamese Master passed: ${approved.size} unique names, ${slotCount} skill slots, ${vanishingRows.length} Vanishing Step Divine Cards.`);

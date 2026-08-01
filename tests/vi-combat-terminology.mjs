import assert from 'node:assert/strict';
import fs from 'node:fs';
import { UI } from '../js/i18n.js';

const readJson = relative => JSON.parse(fs.readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8'));
const heroCatalog = readJson('data/locales/official-hero-details.json').locales.vi;
const divine = readJson('data/locales/divine-cards.json');
const glossary = readJson('data/locales/vi-combat-terminology.json');

assert.equal(glossary.status, 'user-approved');
assert.equal(glossary.damageTypes.physical.damage, 'Sát Thương Vật Lý');
assert.equal(glossary.damageTypes.ki.damage, 'Sát Thương Ki');
assert.equal(UI.vi.energyRes, 'KHÁNG KI');
assert.equal(UI.vi.strikeRes, 'KHÁNG VẬT LÝ');
assert.equal(UI.vi.burstDamage, 'SÁT THƯƠNG BỘC PHÁ');
assert.equal(UI.vi.sustainedDamage, 'SÁT THƯƠNG DUY TRÌ');

const heroText = Object.values(heroCatalog).flatMap(hero => [
  hero.description || '',
  ...Object.values(hero.skills || {}).map(skill => skill.desc || ''),
]).join('\n');
const divineVi = divine.translations.filter(row => row.locale === 'vi');
const divineText = divineVi.flatMap(row => [row.description || '', row.effect || '', row.note || '']).join('\n');

for (const legacy of [
  /khí công/iu,
  /khí đạn/iu,
  /Phòng Ngự Đòn Đánh/u,
  /Công Kích Đòn Đánh/u,
  /sát thương năng lượng/iu,
  /KHÁNG KHÍ CÔNG/u,
  /KHÁNG ĐẢ KÍCH/u,
  /Phóng luồng khí/iu,
  /Giải phóng khí quanh bản thân/iu,
  /vụ nổ khí cực lớn/iu,
  /bùng nổ khí/iu,
  /lưới tơ khí/iu,
  /luồng năng lượng/iu,
]) {
  assert.doesNotMatch(`${heroText}\n${divineText}\n${JSON.stringify(UI.vi)}`, legacy, `Legacy Vietnamese combat term remains: ${legacy}`);
}

assert.match(heroText, /Sát Thương Vật Lý/u);
assert.match(heroText, /Sát Thương Ki/u);
assert.match(heroText, /Phòng Ngự Vật Lý/u);
assert.match(heroText, /Phòng Ngự Ki/u);
assert.match(heroText, /đạn Ki/u);
assert.match(heroText, /luồng Ki/u);
assert.match(divineText, /sát thương Ki/u);
assert.match(divineText, /Bộ Pháp Biến Mất \(Vanishing Step\)/u);

console.log(`Vietnamese combat terminology passed: heroes=${Object.keys(heroCatalog).length}, Divine Cards=${divineVi.length}.`);

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const rootUrl = new URL('../', import.meta.url);
const heroPath = fileURLToPath(new URL('data/locales/official-hero-details.json', rootUrl));
const divinePath = fileURLToPath(new URL('data/locales/divine-cards.json', rootUrl));
const divineCsvPath = fileURLToPath(new URL('data/locales/divine-card-i18n-template.csv', rootUrl));

const readJson = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const writeJson = (path, value) => fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

function normalizeVietnameseCombatText(value) {
  if (typeof value !== 'string' || !value) return value;
  let text = value;

  // Exact multi-word mechanics first so the generic replacements below stay grammatical.
  const exact = [
    ['Tăng Công Kích Đòn Đánh', 'Tăng Sát Thương Vật Lý'],
    ['Giảm Công Kích Đòn Đánh', 'Giảm Sát Thương Vật Lý'],
    ['Công Kích Đòn Đánh', 'Sát Thương Vật Lý'],
    ['Tăng Phòng Ngự Đòn Đánh', 'Tăng Phòng Ngự Vật Lý'],
    ['Giảm Phòng Ngự Đòn Đánh', 'Giảm Phòng Ngự Vật Lý'],
    ['Phòng Ngự Đòn Đánh', 'Phòng Ngự Vật Lý'],
    ['Tăng Phòng Ngự Khí Công', 'Tăng Phòng Ngự Ki'],
    ['Giảm Phòng Ngự Khí Công', 'Giảm Phòng Ngự Ki'],
    ['Phòng Ngự Khí Công', 'Phòng Ngự Ki'],
    ['Miễn Nhiễm Khí Công', 'Miễn Nhiễm Đòn Ki'],
    ['sát thương khí công', 'sát thương Ki'],
    ['Dùng khí công bao lấy', 'Dùng Ki bao lấy'],
    ['Sát Thương Khí Công', 'Sát Thương Ki'],
    ['một đòn khí công ba', 'một luồng Ki'],
    ['năm luồng khí công ba', 'năm luồng Ki'],
    ['hai luồng khí công ba', 'hai luồng Ki'],
    ['một lượng lớn khí công ba', 'một loạt luồng Ki'],
    ['khí công ba', 'luồng Ki'],
    ['Khí Công Ba', 'Luồng Ki'],
    ['Khí đạn', 'Đạn Ki'],
    ['khí đạn', 'đạn Ki'],
    ['đòn đánh vật lý', 'đòn Vật Lý'],
    ['Đòn Đánh Vật Lý', 'Đòn Vật Lý'],
    ['Tấn công bằng thể thuật với Như Ý Bổng.', 'Gây Sát Thương Vật Lý bằng Như Ý Bổng.'],
    ['Tấn công bằng thể thuật.', 'Gây Sát Thương Vật Lý.'],
    ['tấn công bằng thể thuật.', 'gây Sát Thương Vật Lý.'],
    ['cận chiến bằng thể thuật', 'cận chiến gây Sát Thương Vật Lý'],
    ['đòn cường hóa chuyển thành thể thuật', 'đòn cường hóa chuyển thành đòn Vật Lý'],
    ['Tấn công bằng đạn Ki.', 'Gây Sát Thương Ki.'],
    ['tấn công bằng đạn Ki.', 'gây Sát Thương Ki.'],
    ['Gamma 2: Gây Sát Thương Vật Lý.', 'Gamma 2: gây Sát Thương Vật Lý.'],
    ['Phóng khí công.', 'Phóng một đòn Ki.'],
    ['phóng khí công,', 'phóng một đòn Ki,'],
    ['đòn Khí Công', 'đòn Ki'],
    ['Khí Công', 'Ki'],
    ['khí công', 'Ki'],
    ['Giải phóng khí quanh bản thân.', 'Giải phóng Ki quanh bản thân.'],
    ['Phóng luồng khí', 'Phóng luồng Ki'],
    ['phóng luồng khí', 'phóng luồng Ki'],
    ['một luồng khí cực lớn', 'một luồng Ki cực lớn'],
    ['vụ nổ khí cực lớn', 'vụ nổ Ki cực lớn'],
    ['bùng nổ khí', 'bùng nổ Ki'],
    ['lưới tơ khí', 'lưới tơ Ki'],
    ['luồng năng lượng', 'luồng Ki'],
  ];
  for (const [from, to] of exact) text = text.replaceAll(from, to);

  // Repair combinations that can arise after replacing projectiles and attack-category labels.
  text = text
    .replaceAll('Phóng hai luồng luồng Ki', 'Phóng hai luồng Ki')
    .replaceAll('phóng năm luồng luồng Ki', 'phóng năm luồng Ki')
    .replaceAll('các luồng luồng Ki', 'các luồng Ki')
    .replaceAll('Phóng một đòn luồng Ki', 'Phóng một luồng Ki')
    .replaceAll('Phóng Ki.', 'Phóng một đòn Ki.')
    .replaceAll('phóng Ki,', 'phóng một đòn Ki,')
    .replaceAll('Dùng luồng Kio lấy', 'Dùng Ki bao lấy')
    .replaceAll('Phóng một đạn Ki', 'Phóng một viên đạn Ki')
    .replaceAll('Bắn một đạn Ki', 'Bắn một viên đạn Ki')
    .replaceAll('Đặt một đạn Ki', 'Đặt một viên đạn Ki')
    .replaceAll('Thả một đạn Ki', 'Thả một viên đạn Ki')
    .replaceAll('Đánh một đạn Ki xuống', 'Giáng một viên đạn Ki xuống')
    .replaceAll('tụ đạn Ki trong lòng bàn tay', 'tụ Ki trong lòng bàn tay');

  return text;
}

function updateHeroCatalog() {
  const catalog = readJson(heroPath);
  const vi = catalog?.locales?.vi;
  if (!vi || typeof vi !== 'object') throw new Error('Vietnamese hero locale is missing.');
  let changed = 0;
  for (const hero of Object.values(vi)) {
    const nextDescription = normalizeVietnameseCombatText(hero.description);
    if (nextDescription !== hero.description) { hero.description = nextDescription; changed += 1; }
    for (const skill of Object.values(hero.skills || {})) {
      const next = normalizeVietnameseCombatText(skill.desc);
      if (next !== skill.desc) { skill.desc = next; changed += 1; }
    }
  }
  writeJson(heroPath, catalog);
  return changed;
}

function updateDivineCards() {
  const catalog = readJson(divinePath);
  let changed = 0;
  for (const row of catalog.translations || []) {
    if (row.locale !== 'vi') continue;
    for (const key of ['description', 'effect', 'note']) {
      let next = normalizeVietnameseCombatText(row[key]);
      if (typeof next === 'string') next = next.replaceAll('sát thương năng lượng', 'sát thương Ki');
      if (next !== row[key]) { row[key] = next; changed += 1; }
    }
  }
  writeJson(divinePath, catalog);
  return changed;
}

function updateDivineCsv() {
  if (!fs.existsSync(divineCsvPath)) return 0;
  const before = fs.readFileSync(divineCsvPath, 'utf8');
  const after = normalizeVietnameseCombatText(before)
    .replaceAll('sát thương năng lượng', 'sát thương Ki');
  if (before === after) return 0;
  fs.writeFileSync(divineCsvPath, after);
  return 1;
}

const heroChanges = updateHeroCatalog();
const divineChanges = updateDivineCards();
const csvChanges = updateDivineCsv();
console.log(`Applied Vietnamese combat terminology: hero fields=${heroChanges}, Divine Card fields=${divineChanges}, CSV=${csvChanges}.`);

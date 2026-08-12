import fs from 'node:fs';
import { HEROES_DATA } from '../js/heroes-data.js';

const masterUrl = new URL('../data/locales/vi-skill-name-master.json', import.meta.url);
const catalogUrl = new URL('../data/locales/official-hero-details.json', import.meta.url);

function readJson(url) {
  return JSON.parse(fs.readFileSync(url, 'utf8'));
}

function writeJson(url, value) {
  fs.writeFileSync(url, `${JSON.stringify(value, null, 2)}\n`);
}

function replaceAllApprovedNames(value, replacements) {
  let output = String(value ?? '');
  for (const [previousName, approvedName] of replacements) {
    output = output.split(previousName).join(approvedName);
  }
  return output;
}

const master = readJson(masterUrl);
if (master?.schemaVersion !== 1 || master?.locale !== 'vi' || !['user-approved', 'user-approved-with-editorial-additions'].includes(master?.status)) {
  throw new Error('Vietnamese skill-name Master metadata is invalid.');
}

const rows = Array.isArray(master.skills) ? master.skills : [];
if (rows.length !== 212) throw new Error(`Expected 212 reviewed names, found ${rows.length}.`);

const approvedByEnglish = new Map();
const previousByEnglish = new Map();
for (const row of rows) {
  const english = String(row?.english || '').trim();
  const previous = String(row?.previousVietnamese || '').trim();
  const approved = String(row?.vietnamese || '').trim();
  if (!english || !previous || !approved) throw new Error(`Incomplete Master row: ${JSON.stringify(row)}`);
  if (approvedByEnglish.has(english)) throw new Error(`Duplicate English skill name in Master: ${english}`);
  approvedByEnglish.set(english, approved);
  previousByEnglish.set(english, previous);
}

const canonicalNames = new Set();
for (const hero of Object.values(HEROES_DATA)) {
  for (const skill of hero.skills) canonicalNames.add(skill.name);
}
const missing = [...canonicalNames].filter(name => !approvedByEnglish.has(name));
const extra = [...approvedByEnglish.keys()].filter(name => !canonicalNames.has(name));
if (canonicalNames.size !== 207 || missing.length || extra.length) {
  throw new Error(`Master/canonical mismatch. canonical=${canonicalNames.size}; missing=${missing.join(', ')}; extra=${extra.join(', ')}`);
}

// Longest previous names first prevents a base name from changing a longer variant
// before the longer variant can be replaced (for example Kamehameha variants).
const replacements = rows
  .filter(row => row.previousVietnamese !== row.vietnamese)
  .map(row => [row.previousVietnamese, row.vietnamese])
  .sort((a, b) => b[0].length - a[0].length || a[0].localeCompare(b[0], 'vi'));

const catalog = readJson(catalogUrl);
const vietnamese = catalog?.locales?.vi;
if (!vietnamese || typeof vietnamese !== 'object') throw new Error('Vietnamese hero-detail catalog is missing.');

let updatedSlots = 0;
let updatedTextFields = 0;
for (const [heroId, sourceHero] of Object.entries(HEROES_DATA)) {
  const record = vietnamese[heroId];
  if (!record) throw new Error(`Vietnamese hero record ${heroId} is missing.`);

  const nextDescription = replaceAllApprovedNames(record.description, replacements);
  if (nextDescription !== record.description) updatedTextFields += 1;
  record.description = nextDescription;

  for (const sourceSkill of sourceHero.skills) {
    const localizedSkill = record.skills?.[sourceSkill.id];
    if (!localizedSkill) throw new Error(`Vietnamese skill ${heroId}.${sourceSkill.id} is missing.`);
    const approvedName = approvedByEnglish.get(sourceSkill.name);
    if (!approvedName) throw new Error(`No approved Vietnamese name for ${sourceSkill.name}.`);
    localizedSkill.name = approvedName;
    updatedSlots += 1;

    const nextDesc = replaceAllApprovedNames(localizedSkill.desc, replacements);
    if (nextDesc !== localizedSkill.desc) updatedTextFields += 1;
    localizedSkill.desc = nextDesc;
  }

  record.translationStatus = 'editor-reviewed';
  record.sourceLocale = 'zh-CN';
  record.sourcePolicy = 'Tên chiến binh giữ nguyên tiếng Anh; 207 tên kỹ năng gốc dùng bộ Master tiếng Việt đã được người dùng duyệt; các tên bổ sung được đánh dấu biên tập; mô tả dựa trên bản tiếng Trung chính thức và đã đồng bộ toàn bộ tham chiếu tên kỹ năng.';
}

writeJson(catalogUrl, catalog);
console.log(`Applied 212 reviewed Vietnamese names to ${updatedSlots} skill slots and refreshed ${updatedTextFields} description fields.`);

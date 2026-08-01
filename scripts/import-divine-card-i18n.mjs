import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { db, transaction } = require('../server/db');
const { normalizeLocale, SUPPORTED_LOCALES } = require('../server/i18n-locale');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(item => item.trim());
  return rows
    .filter(items => items.some(Boolean))
    .map(items => Object.fromEntries(headers.map((key, index) => [key, items[index] ?? ''])));
}

function clean(value, max) { return String(value ?? '').trim().slice(0, max); }

function flattenCardMap(map) {
  const rows = [];
  for (const [locale, cards] of Object.entries(map || {})) {
    if (!cards || Array.isArray(cards) || typeof cards !== 'object') continue;
    for (const [cardId, value] of Object.entries(cards)) rows.push({ kind:'card', cardId, locale, ...value });
  }
  return rows;
}

function flattenPresetMap(map) {
  const rows = [];
  for (const [locale, presets] of Object.entries(map || {})) {
    if (!presets || Array.isArray(presets) || typeof presets !== 'object') continue;
    for (const [presetId, value] of Object.entries(presets)) rows.push({ kind:'preset', presetId, locale, ...value });
  }
  return rows;
}

function flattenJson(parsed) {
  if (Array.isArray(parsed)) return parsed;
  const rows = [];
  if (Array.isArray(parsed?.translations)) rows.push(...parsed.translations.map(item => ({ kind:item.kind || 'card', ...item })));
  if (Array.isArray(parsed?.cards)) rows.push(...parsed.cards.map(item => ({ kind:'card', ...item })));
  if (Array.isArray(parsed?.presets)) rows.push(...parsed.presets.map(item => ({ kind:'preset', ...item })));
  rows.push(...flattenCardMap(parsed?.locales || parsed?.cardLocales));
  rows.push(...flattenPresetMap(parsed?.presetLocales));
  if (!rows.length && parsed && typeof parsed === 'object') rows.push(...flattenCardMap(parsed));
  return rows;
}

function quoteCsv(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportTemplate(outputPath) {
  const cards = db.prepare('SELECT id,name,effect,note FROM divine_cards ORDER BY slot_pool,display_order,id').all();
  const locales = SUPPORTED_LOCALES.filter(locale => locale !== 'en');
  const header = ['kind','cardId','presetId','locale','name','description','effect','note','scenario','translationStatus'];
  const rows = [header.join(',')];
  for (const card of cards) for (const locale of locales) {
    rows.push(['card',card.id,'',locale,card.name,card.effect,card.effect,card.note,'','draft-native-review-required'].map(quoteCsv).join(','));
  }
  fs.writeFileSync(outputPath, `${rows.join('\n')}\n`);
  console.log(`Wrote ${cards.length * locales.length} translation rows to ${outputPath}.`);
}

const defaultPath = fileURLToPath(new URL('../data/locales/divine-cards.json', import.meta.url));
if (process.argv[2] === '--export-template') {
  const outputPath = path.resolve(process.argv[3] || 'divine-card-i18n-template.csv');
  exportTemplate(outputPath);
  process.exit(0);
}

const inputPath = path.resolve(process.argv[2] || defaultPath);
if (!fs.existsSync(inputPath)) throw new Error(`Translation file not found: ${inputPath}`);
const raw = fs.readFileSync(inputPath, 'utf8');
const inputRows = path.extname(inputPath).toLowerCase() === '.csv' ? parseCsv(raw) : flattenJson(JSON.parse(raw));
if (!inputRows.length) throw new Error('No Divine Card or preset translation rows were found.');

const validLocales = new Set(SUPPORTED_LOCALES);
const cards = new Set(db.prepare('SELECT id FROM divine_cards').all().map(row => String(row.id)));
const presets = new Set(db.prepare('SELECT id FROM divine_card_presets').all().map(row => String(row.id)));
const cardRows = [];
const presetRows = [];

inputRows.forEach((item, index) => {
  const kind = clean(item.kind || (item.presetId ?? item.preset_id ? 'preset' : 'card'), 20).toLowerCase();
  const locale = normalizeLocale(item.locale, '');
  if (!validLocales.has(locale) || locale === 'en') throw new Error(`Row ${index + 1}: locale must be ja, zh-CN, ko, es or vi.`);
  const status = clean(item.translationStatus ?? item.translation_status ?? 'draft-native-review-required', 80);

  if (kind === 'preset') {
    const presetId = clean(item.presetId ?? item.preset_id ?? item.id, 30);
    if (!presets.has(presetId)) throw new Error(`Row ${index + 1}: unknown preset ID ${presetId}.`);
    const name = clean(item.name, 140);
    const description = clean(item.description, 3000);
    const scenario = clean(item.scenario, 180);
    if (!name) throw new Error(`Row ${index + 1}: preset name is required.`);
    presetRows.push({ presetId:Number(presetId), locale, name, description, scenario, status });
    return;
  }

  if (kind !== 'card') throw new Error(`Row ${index + 1}: kind must be card or preset.`);
  const cardId = clean(item.cardId ?? item.card_id ?? item.id, 120);
  if (!cards.has(cardId)) throw new Error(`Row ${index + 1}: unknown card ID ${cardId}.`);
  const name = clean(item.name, 120);
  const description = clean(item.description ?? item.effect, 3000);
  const effect = clean(item.effect ?? item.description, 3000);
  const note = clean(item.note, 3000);
  if (!name || !effect) throw new Error(`Row ${index + 1}: card name and effect are required.`);
  cardRows.push({ cardId, locale, name, description, effect, note, status });
});

const upsertCard = db.prepare(`INSERT INTO divine_cards_i18n(
  card_id,locale,name,description,effect,note,translation_status,updated_at
) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
ON CONFLICT(card_id,locale) DO UPDATE SET
  name=excluded.name,description=excluded.description,effect=excluded.effect,note=excluded.note,
  translation_status=excluded.translation_status,updated_at=CURRENT_TIMESTAMP`);
const upsertPreset = db.prepare(`INSERT INTO divine_card_presets_i18n(
  preset_id,locale,name,description,scenario,translation_status,updated_at
) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)
ON CONFLICT(preset_id,locale) DO UPDATE SET
  name=excluded.name,description=excluded.description,scenario=excluded.scenario,
  translation_status=excluded.translation_status,updated_at=CURRENT_TIMESTAMP`);

transaction(() => {
  for (const row of cardRows) upsertCard.run(row.cardId, row.locale, row.name, row.description, row.effect, row.note, row.status);
  for (const row of presetRows) upsertPreset.run(row.presetId, row.locale, row.name, row.description, row.scenario, row.status);
});

console.log(`Imported ${cardRows.length} card translations and ${presetRows.length} preset translations from ${inputPath}.`);
console.table(db.prepare(`SELECT locale,COUNT(*) count FROM divine_cards_i18n GROUP BY locale ORDER BY locale`).all());
if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='divine_card_presets_i18n'").get()) {
  console.table(db.prepare(`SELECT locale,COUNT(*) count FROM divine_card_presets_i18n GROUP BY locale ORDER BY locale`).all());
}

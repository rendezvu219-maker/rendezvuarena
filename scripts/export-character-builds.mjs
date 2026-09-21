import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { validateBuildData } from '../js/character-builds.js';

const require = createRequire(import.meta.url);
require('dotenv').config({ quiet:true });
const root = fileURLToPath(new URL('../', import.meta.url));

// Read-only SQLite snapshot. Never import server/db: it migrates/seeds on load.
export function exportBuilds(databasePath, outputPath) {
  if (!fs.existsSync(databasePath)) throw new Error(`Source database does not exist: ${databasePath}`);
  if (fs.existsSync(outputPath)) throw new Error(`Export refused: ${outputPath} already exists. Export to a new file and compare before replacing it.`);
  const db = new DatabaseSync(databasePath, { readOnly:true });
  try {
    db.exec('BEGIN');
    const rows = table => db.prepare(`SELECT * FROM ${table}`).all();
    const catalog = JSON.parse(fs.readFileSync(path.join(root, 'assets/divine-cards/catalog.json'), 'utf8'));
    const cardRows = rows('divine_cards');
    const cardTranslations = rows('divine_cards_i18n');
    const presetRows = rows('divine_card_presets');
    const presetTranslations = rows('divine_card_presets_i18n');
    const slots = rows('divine_card_preset_slots');
    const swaps = rows('divine_card_preset_swaps');
    const assignments = rows('hero_divine_card_presets');
    const translationsFor = (translations, field, id) => Object.fromEntries(translations.filter(row => row[field] === id).map(row => [row.locale, {
      name:row.name, description:row.description,
      ...(field === 'card_id' ? { effect:row.effect, note:row.note } : { scenario:row.scenario }),
      translationStatus:row.translation_status, updatedAt:row.updated_at,
    }]));
    const data = {
      schemaVersion:1,
      updatedAt:new Date().toISOString(),
      migration:{ source:path.basename(databasePath), cards:cardRows.length, presets:presetRows.length, coreCards:slots.length, situationalCards:swaps.length, heroAssignments:assignments.length },
      cards:cardRows.map(row => {
        const canonical = catalog.find(item => item.id === row.id);
        return {
          id:row.id, imagePath:row.image_path.replace(/^\/+/, ''), name:row.name,
          description:row.description, effect:row.effect, note:row.note, cardType:row.card_type,
          // Correct only untouched bundled order to match screenshot 075411.
          displayOrder:row.updated_by == null && canonical ? canonical.displayOrder : row.display_order,
          slotPool:row.slot_pool, isActive:Boolean(row.is_active),
          createdAt:row.created_at, updatedAt:row.updated_at,
          translations:translationsFor(cardTranslations, 'card_id', row.id),
        };
      }),
      presets:presetRows.map(row => ({
        id:row.id, name:row.name, description:row.description, scenario:row.scenario,
        sourceKey:row.source_key, energyThreshold:row.energy_threshold, energyRate:row.energy_rate,
        createdAt:row.created_at, updatedAt:row.updated_at,
        slots:slots.filter(item => item.preset_id === row.id).map(item => ({ slot:item.slot_no, cardId:item.card_id })).sort((a,b) => a.slot - b.slot),
        swapOptions:swaps.filter(item => item.preset_id === row.id).map(item => ({ slot:item.slot_no, cardId:item.card_id, priority:item.priority, note:item.note })).sort((a,b) => a.slot - b.slot || a.priority - b.priority),
        heroAssignments:assignments.filter(item => item.preset_id === row.id).map(item => ({ heroId:item.hero_id, isDefault:Boolean(item.is_default), assignedAt:item.assigned_at })),
        translations:translationsFor(presetTranslations, 'preset_id', row.id),
      })),
    };
    validateBuildData(data);
    // No accounts, emails, sessions, password hashes or internal user IDs are exported.
    fs.mkdirSync(path.dirname(outputPath), { recursive:true });
    fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`, { flag:'wx' });
    const verified = validateBuildData(JSON.parse(fs.readFileSync(outputPath, 'utf8')));
    if (verified.presets.length !== presetRows.length || verified.presets.reduce((sum, p) => sum + p.slots.length + p.swapOptions.length, 0) !== slots.length + swaps.length) {
      throw new Error('Export verification failed; keep the source database.');
    }
    db.exec('COMMIT');
    return data.migration;
  } finally { db.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const databasePath = path.resolve(process.argv[2] || require('../server/storage-paths').resolveDatabasePath());
  const outputPath = path.resolve(process.argv[3] || path.join(root, 'data/character-builds.json'));
  console.log(JSON.stringify({ output:outputPath, ...exportBuilds(databasePath, outputPath) }, null, 2));
}

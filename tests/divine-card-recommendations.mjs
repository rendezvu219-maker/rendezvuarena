import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-card-recommendations-'));
process.env.DATABASE_PATH = path.join(tmp, 'test.sqlite');
const require = createRequire(import.meta.url);
const { db } = require('../server/db');
const cardService = require('../server/divine-card-service');
const recommendationService = require('../server/divine-card-recommendations');

try {
  db.prepare("INSERT INTO users(username,email,display_name,password_hash,role) VALUES ('admin','admin@example.test','Admin','x:y','admin')").run();
  const adminId = Number(db.prepare("SELECT id FROM users WHERE username='admin'").get().id);
  cardService.seedDivineCardAssets();
  const cards = cardService.adminBundle().cards;
  const core = [1, 2, 3].map(slot => cards.find(card => card.slotPool === slot));

  // Existing user-created builds must not be overwritten or lose Default status.
  const custom = cardService.savePreset(null, {
    name: 'My Uub build',
    slots: core.map((card, index) => ({ slot: index + 1, cardId: card.id })),
  }, adminId);
  cardService.assignPreset({ presetId: custom.id, heroIds: ['0014'], makeDefault: true, action: 'assign' });

  const first = recommendationService.seedRecommendedHeroBuilds();
  if (first.skipped) throw new Error(`Recommendation seed was skipped: ${first.reason || 'unknown reason'}`);
  if (first.assignedHeroes !== 37) throw new Error(`Expected recommendations for 37 spreadsheet heroes, got ${first.assignedHeroes}.`);
  if (first.createdPresets < 37) throw new Error('Every spreadsheet hero should receive at least one recommended build.');

  const seededRows = db.prepare("SELECT id,name,source_key FROM divine_card_presets WHERE source_key LIKE 'user-spreadsheet-v1:%'").all();
  if (seededRows.length !== first.createdPresets) throw new Error('Seeded preset count does not match the database.');
  const assignedHeroCount = Number(db.prepare(`SELECT COUNT(DISTINCT h.hero_id) count
    FROM hero_divine_card_presets h JOIN divine_card_presets p ON p.id=h.preset_id
    WHERE p.source_key LIKE 'user-spreadsheet-v1:%'`).get().count);
  if (assignedHeroCount !== 37) throw new Error('Not all spreadsheet heroes were assigned their recommendations.');

  const androidPreset = cardService.adminBundle().presets.find(preset => preset.sourceKey === 'user-spreadsheet-v1:0006:1');
  if (!androidPreset) throw new Error('Android 18 recommendation was not created.');
  const androidCore = androidPreset.slots.sort((a, b) => a.slot - b.slot).map(item => item.card.name);
  if (androidCore.join('|') !== 'Build Up|Giant Slayer|Defense Step') throw new Error(`Android 18 core build was resolved incorrectly: ${androidCore.join('|')}`);
  if (!androidPreset.swapOptions.some(item => item.slot === 2 && item.card.name === 'Solid Barrier')) throw new Error('Android 18 Slot 2 situational Barrier was not preserved.');

  const krillinPresets = cardService.adminBundle().presets.filter(preset => preset.sourceKey.startsWith('user-spreadsheet-v1:0003:'));
  if (krillinPresets.length !== 3) throw new Error(`Krillin Any-card recommendation should create three manageable variants, got ${krillinPresets.length}.`);
  const krillinSlotTwoCards = new Set();
  for (const preset of krillinPresets) {
    for (const item of preset.slots) if (item.slot === 2) krillinSlotTwoCards.add(item.card.id);
    for (const item of preset.swapOptions) if (item.slot === 2) krillinSlotTwoCards.add(item.card.id);
  }
  if (krillinSlotTwoCards.size !== 6) throw new Error('Krillin Slot 2 “Any” recommendation did not preserve all six cards across variants.');

  const uubAssignments = db.prepare(`SELECT h.preset_id,h.is_default,p.source_key
    FROM hero_divine_card_presets h JOIN divine_card_presets p ON p.id=h.preset_id
    WHERE h.hero_id='0014' ORDER BY h.preset_id`).all();
  const uubDefault = uubAssignments.find(item => item.is_default);
  if (!uubDefault || Number(uubDefault.preset_id) !== custom.id) throw new Error('Import replaced the user-created Uub default build.');
  if (!uubAssignments.some(item => String(item.source_key).startsWith('user-spreadsheet-v1:0014:'))) throw new Error('Uub spreadsheet recommendation was not added alongside the custom build.');


  // A manual unassignment is a user decision and must survive later restarts.
  const androidAssignment = db.prepare(`SELECT h.preset_id FROM hero_divine_card_presets h
    JOIN divine_card_presets p ON p.id=h.preset_id
    WHERE h.hero_id='0006' AND p.source_key='user-spreadsheet-v1:0006:1'`).get();
  cardService.assignPreset({ presetId: Number(androidAssignment.preset_id), heroIds: ['0006'], action: 'unassign' });
  const afterManualUnassignSeed = recommendationService.seedRecommendedHeroBuilds();
  if (afterManualUnassignSeed.createdPresets !== 0) throw new Error('Restart seed unexpectedly created duplicate recommendation presets.');
  const androidReassigned = db.prepare(`SELECT 1 FROM hero_divine_card_presets h
    JOIN divine_card_presets p ON p.id=h.preset_id
    WHERE h.hero_id='0006' AND p.source_key='user-spreadsheet-v1:0006:1'`).get();
  if (androidReassigned) throw new Error('A manually removed recommendation was re-assigned on restart.');

  const second = recommendationService.seedRecommendedHeroBuilds();
  if (second.createdPresets !== 0) throw new Error('Recommendation import is not idempotent.');
  const afterSecondCount = Number(db.prepare("SELECT COUNT(*) count FROM divine_card_presets WHERE source_key LIKE 'user-spreadsheet-v1:%'").get().count);
  if (afterSecondCount !== seededRows.length) throw new Error('Running the importer twice duplicated presets.');

  console.log(`Divine Card recommendation import tests passed (${seededRows.length} presets for 37 heroes).`);
} finally {
  try { db.close(); } catch {}
  fs.rmSync(tmp, { recursive: true, force: true });
}

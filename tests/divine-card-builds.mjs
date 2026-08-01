import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-divine-card-test-'));
process.env.DATABASE_PATH = path.join(tmp, 'test.sqlite');
const require = createRequire(import.meta.url);
const { db } = require('../server/db');
const service = require('../server/divine-card-service');

try {
  db.prepare("INSERT INTO users(username,email,display_name,password_hash,role) VALUES ('admin','admin@example.test','Admin','x:y','admin')").run();
  const adminId = Number(db.prepare("SELECT id FROM users WHERE username='admin'").get().id);
  service.seedDivineCardAssets();
  const cards = service.adminBundle().cards;
  if (cards.length !== 18) throw new Error(`Expected 18 seeded cards, got ${cards.length}.`);
  const expectedOrder = [
    'Lightning Swift','Super Snowball','Build Up','Too Easy!','Strategic Escape','GEKISHIN High',
    'Giant Slayer','Prepare to Die!','Steel Skin','Solid Barrier','Art of Decoy','Epic Hunter',
    'Wicked Warrior','Pursuer','Guardian Angel','Defense Step','Backstab','Limit-Breaking Jump',
  ];
  if (cards.map(card => card.name).join('|') !== expectedOrder.join('|')) throw new Error('Canonical in-game card order was not preserved.');
  const defenseStep = cards.find(card => card.name === 'Defense Step');
  if (!defenseStep?.note.includes('12 seconds')) throw new Error('Defense Step must use the current 12-second internal cooldown.');
  if (!cards.every(card => card.effect && card.note && card.cardType && card.displayOrder)) throw new Error('Card Effect, Note, type, or display order is missing.');

  const cataloged = cards.slice(0, 3).map((card, index) => service.updateCard(card.id, {
    name: `Test Card ${index + 1}`,
    effect: `Slot ${index + 1} test effect`,
    note: `Slot ${index + 1} test note`,
    cardType: ['attack','defense','technical'][index],
    slotPool: index + 1,
    isActive: true,
  }, adminId));

  const swapCards = cards.slice(3, 6).map((card, index) => service.updateCard(card.id, {
    name: `Swap Card ${index + 1}`,
    effect: `Slot ${index + 1} alternate effect`,
    note: `Slot ${index + 1} alternate note`,
    cardType: ['attack','defense','technical'][index],
    slotPool: index + 1,
    isActive: true,
  }, adminId));


  const secondSwapCards = cards.slice(6, 9).map((card, index) => service.updateCard(card.id, {
    name: `Second Swap Card ${index + 1}`,
    effect: `Slot ${index + 1} second alternate effect`,
    note: `Slot ${index + 1} second alternate note`,
    cardType: ['attack','defense','technical'][index],
    slotPool: index + 1,
    isActive: true,
  }, adminId));

  const thirdSlotOneSwap = service.updateCard(cards[9].id, {
    name: 'Third Slot 1 Swap', effect: 'Third alternate', note: 'For max-two validation',
    cardType: 'attack', slotPool: 1, isActive: true,
  }, adminId);

  const preset = service.savePreset(null, {
    name: 'Shared test build',
    scenario: 'Versus burst teams',
    description: 'One live preset assigned to multiple heroes.',
    energyThreshold: 120,
    energyRate: 1.5,
    slots: cataloged.map((card, index) => ({ slot: index + 1, cardId: card.id })),
    swapOptions: [
      ...swapCards.map((card, index) => ({ slot: index + 1, cardId: card.id, priority: 1 })),
      ...secondSwapCards.map((card, index) => ({ slot: index + 1, cardId: card.id, priority: 2 })),
    ],
  }, adminId);
  if (!preset || preset.slots.length !== 3) throw new Error('Preset did not save all three slots.');
  if (preset.scenario !== 'Versus burst teams') throw new Error('Build scenario was not saved.');
  if (preset.swapOptions.length !== 6) throw new Error('Cards 4–9 were not all saved.');
  if (!preset.swapOptions.every(item => [1,2].includes(item.priority))) throw new Error('Situational-card priority was not preserved.');

  service.assignPreset({ presetId: preset.id, heroIds: ['0001', '0002'], makeDefault: true, action: 'assign' });
  const publicPreset = service.publicBundle().presets.find(item => item.id === preset.id);
  if (!publicPreset) throw new Error('Completed preset was not public.');
  if (publicPreset.heroAssignments.length !== 2) throw new Error('Shared preset was not assigned to both heroes.');
  if (!publicPreset.heroAssignments.every(item => item.isDefault)) throw new Error('Default assignment was not preserved.');

  const alternatePreset = service.savePreset(null, {
    name: 'Anti-tank variant',
    scenario: 'Versus Tank-heavy teams',
    description: 'A second situational build for the same hero.',
    energyThreshold: 140,
    energyRate: 1,
    slots: cataloged.map((card, index) => ({ slot: index + 1, cardId: card.id })),
    swapOptions: [{ slot: 1, cardId: secondSwapCards[0].id, priority: 2 }],
  }, adminId);
  service.assignPreset({ presetId: alternatePreset.id, heroIds: ['0001'], makeDefault: false, action: 'assign' });
  const heroOneBuilds = service.publicBundle().presets.filter(item => item.heroAssignments.some(assignment => assignment.heroId === '0001'));
  if (heroOneBuilds.length !== 2) throw new Error('A hero could not keep multiple situational builds.');
  const defaultBuilds = heroOneBuilds.filter(item => item.heroAssignments.some(assignment => assignment.heroId === '0001' && assignment.isDefault));
  if (defaultBuilds.length !== 1 || defaultBuilds[0].id !== preset.id) throw new Error('Situational build assignment changed the hero default unexpectedly.');

  // Removing an accidentally assigned preset must work for one hero or many.
  // If the removed assignment was the default, one remaining build is promoted.
  service.assignPreset({ presetId: preset.id, heroIds: ['0001'], action: 'unassign' });
  const afterDefaultRemoval = service.publicBundle().presets.filter(item => item.heroAssignments.some(assignment => assignment.heroId === '0001'));
  if (afterDefaultRemoval.length !== 1 || afterDefaultRemoval[0].id !== alternatePreset.id) throw new Error('The mistaken preset was not removed from the hero.');
  if (!afterDefaultRemoval[0].heroAssignments.some(assignment => assignment.heroId === '0001' && assignment.isDefault)) throw new Error('A remaining build was not promoted after removing the default preset.');
  service.assignPreset({ presetId: preset.id, heroIds: ['0001'], makeDefault: true, action: 'assign' });

  service.assignPreset({ presetId: preset.id, heroIds: ['0002'], action: 'unassign' });
  const heroTwoStillAssigned = service.publicBundle().presets.some(item => item.id === preset.id && item.heroAssignments.some(assignment => assignment.heroId === '0002'));
  if (heroTwoStillAssigned) throw new Error('Bulk/single unassign did not detach the preset.');

  let mismatchRejected = false;
  try {
    service.savePreset(null, {
      name: 'Invalid build',
      slots: [
        { slot: 1, cardId: cataloged[1].id },
        { slot: 2, cardId: cataloged[0].id },
        { slot: 3, cardId: cataloged[2].id },
      ],
    }, adminId);
  } catch { mismatchRejected = true; }
  if (!mismatchRejected) throw new Error('Slot-pool mismatch was not rejected.');

  let startingCardSwapRejected = false;
  try {
    service.savePreset(null, {
      name: 'Invalid starting-card swap',
      slots: cataloged.map((card, index) => ({ slot: index + 1, cardId: card.id })),
      swapOptions: [{ slot: 1, cardId: cataloged[0].id }],
    }, adminId);
  } catch { startingCardSwapRejected = true; }
  if (!startingCardSwapRejected) throw new Error('Starting card was incorrectly accepted as its own swap option.');

  const priorityTwoOnly = service.adminBundle().presets.find(item => item.id === alternatePreset.id);
  if (priorityTwoOnly.swapOptions.length !== 1 || priorityTwoOnly.swapOptions[0].priority !== 2) {
    throw new Error('A preset containing only Card 7/8/9 position data was not preserved.');
  }

  const legacyThreeCardPreset = service.savePreset(null, {
    name: 'Legacy three-card preset',
    scenario: 'Created before situational cards were added',
    description: 'Regression fixture for editing an existing core-only preset.',
    slots: cataloged.map((card, index) => ({ slot: index + 1, cardId: card.id })),
    swapOptions: [],
  }, adminId);

  // Every Card 4–9 position is an independent situational choice. Updating an
  // old three-card preset with only one arbitrary position must preserve that
  // exact card number without requiring, filling, or compacting the others.
  const independentSituationCards = new Map([
    [4, swapCards[0]], [5, swapCards[1]], [6, swapCards[2]],
    [7, secondSwapCards[0]], [8, secondSwapCards[1]], [9, secondSwapCards[2]],
  ]);
  for (const [cardNumber, selectedCard] of independentSituationCards) {
    const situationalSlots = Object.fromEntries([4,5,6,7,8,9].map(number => [String(number), number === cardNumber ? selectedCard.id : null]));
    const updated = service.savePreset(legacyThreeCardPreset.id, {
      name: legacyThreeCardPreset.name,
      scenario: legacyThreeCardPreset.scenario,
      description: legacyThreeCardPreset.description,
      energyThreshold: legacyThreeCardPreset.energyThreshold,
      energyRate: legacyThreeCardPreset.energyRate,
      slots: cataloged.map((card, index) => ({ slot: index + 1, cardId: card.id })),
      situationalSlots,
    }, adminId);
    if (updated.slots.length !== 3) throw new Error(`Updating Card ${cardNumber} changed the three core cards.`);
    if (updated.swapOptions.length !== 1) throw new Error(`Adding only Card ${cardNumber} to a legacy preset was not persisted.`);
    for (const number of [4,5,6,7,8,9]) {
      const expected = number === cardNumber ? selectedCard.id : null;
      if (updated.situationalSlots[String(number)] !== expected) {
        throw new Error(`Card ${cardNumber} was compacted, moved, or caused Card ${number} to be populated.`);
      }
    }
    const reloaded = service.adminBundle().presets.find(item => item.id === legacyThreeCardPreset.id);
    if (reloaded?.situationalSlots?.[String(cardNumber)] !== selectedCard.id || reloaded.swapOptions.length !== 1) {
      throw new Error(`Card ${cardNumber} disappeared after reloading the updated legacy preset.`);
    }
  }

  const partialOptionsPreset = service.savePreset(null, {
    name: 'Partial optional positions',
    scenario: 'Only specific card changes are useful',
    description: 'Leaves the unused Card 4–9 positions empty on purpose.',
    slots: cataloged.map((card, index) => ({ slot: index + 1, cardId: card.id })),
    swapOptions: [
      { slot: 2, cardId: swapCards[1].id, priority: 1 },
      { slot: 3, cardId: secondSwapCards[2].id, priority: 2 },
    ],
  }, adminId);
  const partialReload = service.adminBundle().presets.find(item => item.id === partialOptionsPreset.id);
  const partialPositions = partialReload.swapOptions.map(item => `${item.slot}:${item.priority}`).sort();
  if (partialPositions.join(',') !== '2:1,3:2') {
    throw new Error(`Optional Card 5 / Card 9 positions were compacted or lost: ${partialPositions.join(',')}`);
  }

  let thirdAlternateRejected = false;
  try {
    service.savePreset(null, {
      name: 'Invalid ten-card build',
      slots: cataloged.map((card, index) => ({ slot: index + 1, cardId: card.id })),
      swapOptions: [
        { slot: 1, cardId: swapCards[0].id, priority: 1 },
        { slot: 1, cardId: secondSwapCards[0].id, priority: 2 },
        { slot: 1, cardId: thirdSlotOneSwap.id },
      ],
    }, adminId);
  } catch { thirdAlternateRejected = true; }
  if (!thirdAlternateRejected) throw new Error('A Slot incorrectly accepted more than Cards 4/7, 5/8, or 6/9.');

  let crossSlotSwapRejected = false;
  try {
    service.savePreset(null, {
      name: 'Invalid cross-slot swap',
      slots: cataloged.map((card, index) => ({ slot: index + 1, cardId: card.id })),
      swapOptions: [{ slot: 1, cardId: swapCards[1].id }],
    }, adminId);
  } catch { crossSlotSwapRejected = true; }
  if (!crossSlotSwapRejected) throw new Error('Cross-Slot swap option was not rejected.');

  console.log('Divine Card build tests passed.');
} finally {
  try { db.close(); } catch {}
  fs.rmSync(tmp, { recursive: true, force: true });
}

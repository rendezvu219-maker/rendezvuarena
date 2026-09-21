// Shared JSON model: keep the existing three core Slots, six fixed optional
// positions, reusable presets and heroAssignments. No database or API is needed.
export const BUILD_LOCALES = ['en', 'ja', 'zh-CN', 'ko', 'es', 'vi'];
export const SITUATIONAL_POSITIONS = [
  { cardNumber:4, slot:1, priority:1 }, { cardNumber:5, slot:2, priority:1 },
  { cardNumber:6, slot:3, priority:1 }, { cardNumber:7, slot:1, priority:2 },
  { cardNumber:8, slot:2, priority:2 }, { cardNumber:9, slot:3, priority:2 },
];

export function validateBuildData(data) {
  if (data?.schemaVersion !== 1 || !Array.isArray(data.cards) || !Array.isArray(data.presets)) {
    throw new Error('Invalid character build file. Restore or export the existing build data.');
  }
  const cards = new Map();
  for (const card of data.cards) {
    if (!card?.id || cards.has(card.id) || typeof card.imagePath !== 'string') throw new Error('Invalid or duplicate card.');
    cards.set(card.id, card);
  }
  const presets = new Set();
  const defaults = new Set();
  for (const preset of data.presets) {
    if (!Number.isSafeInteger(preset.id) || preset.id < 1 || presets.has(preset.id)) throw new Error('Invalid or duplicate preset.');
    presets.add(preset.id);
    if (!Array.isArray(preset.slots) || !Array.isArray(preset.swapOptions) || !Array.isArray(preset.heroAssignments)) throw new Error('Invalid preset structure.');
    const positions = new Set();
    for (const item of [...preset.slots, ...preset.swapOptions]) {
      const position = `${item.slot}:${item.priority || 0}`;
      if (!cards.has(item.cardId) || ![1,2,3].includes(item.slot) || positions.has(position)) throw new Error('Invalid card reference or duplicate Slot.');
      positions.add(position);
    }
    const heroes = new Set();
    for (const item of preset.heroAssignments) {
      if (!/^\d{4}$/.test(item.heroId) || heroes.has(item.heroId)) throw new Error('Invalid hero assignment.');
      heroes.add(item.heroId);
      if (item.isDefault) {
        if (defaults.has(item.heroId)) throw new Error('A hero can only have one default build.');
        defaults.add(item.heroId);
      }
    }
  }
  return data;
}

export function buildAssetUrl(imagePath, baseUrl) {
  const relative = String(imagePath || '').replace(/^\/+/, '');
  if (!/^assets\/divine-cards\/[a-zA-Z0-9_-]+\.png$/.test(relative)) throw new Error('Invalid Divine Card image path.');
  return baseUrl ? new URL(relative, baseUrl).href : relative;
}

function localized(record, locale, fields) {
  const translated = record.translations?.[locale] || {};
  const result = { ...record, locale };
  delete result.translations;
  for (const field of fields) result[field] = translated[field] || record[field] || '';
  result.translationStatus = translated.translationStatus || (locale === 'en' ? 'source' : 'fallback-en');
  return result;
}

export function resolveBuildBundle(data, { locale = 'en', admin = false, baseUrl } = {}) {
  validateBuildData(data);
  if (!BUILD_LOCALES.includes(locale)) locale = 'en';
  const cards = data.cards.map(record => {
    const card = localized(record, locale, ['name', 'description', 'effect', 'note']);
    return { ...card, imagePath:buildAssetUrl(card.imagePath, baseUrl) };
  }).sort((a,b) => (a.slotPool || 99) - (b.slotPool || 99) || a.displayOrder - b.displayOrder || a.id.localeCompare(b.id));
  const byId = new Map(cards.map(card => [card.id, card]));
  const presets = data.presets.map(record => {
    const preset = localized(record, locale, ['name', 'description', 'scenario']);
    preset.slots = record.slots.map(item => ({ ...item, card:byId.get(item.cardId) }));
    preset.swapOptions = record.swapOptions.map(item => ({ ...item, card:byId.get(item.cardId) }));
    preset.situationalSlots = Object.fromEntries(SITUATIONAL_POSITIONS.map(position => [String(position.cardNumber),
      record.swapOptions.find(item => item.slot === position.slot && item.priority === position.priority)?.cardId || null,
    ]));
    return preset;
  }).filter(preset => admin || (preset.slots.length === 3 && [...preset.slots, ...preset.swapOptions].every(item => item.card?.isActive && item.card.name)));
  return { locale, cards:cards.filter(card => admin || (card.isActive && card.name && [1,2,3].includes(card.slotPool))), presets };
}

export function buildsForHero(presets, heroId) {
  return presets.filter(preset => preset.heroAssignments.some(item => item.heroId === heroId))
    .sort((a,b) => Number(b.heroAssignments.find(item => item.heroId === heroId)?.isDefault) - Number(a.heroAssignments.find(item => item.heroId === heroId)?.isDefault) || a.name.localeCompare(b.name));
}

export async function loadStaticBuilds(locale, { moduleUrl = import.meta.url, fetcher = fetch } = {}) {
  const url = new URL('../data/character-builds.json', moduleUrl);
  const response = await fetcher(url, { cache:'no-store' });
  if (!response.ok) throw new Error(`Build data could not be loaded (${response.status}).`);
  return resolveBuildBundle(await response.json(), { locale, baseUrl:new URL('../', moduleUrl) });
}

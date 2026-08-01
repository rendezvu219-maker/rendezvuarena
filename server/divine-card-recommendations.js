const fs = require('node:fs');
const path = require('node:path');
const { db, transaction } = require('./db');

const SOURCE_PREFIX = 'user-spreadsheet-v1';
const dataPath = path.resolve(__dirname, '..', 'data', 'divine-card-hero-recommendations.json');
const heroNamesPath = path.resolve(__dirname, '..', 'data', 'locales', 'hero-names.json');
const PRESET_LOCALES = Object.freeze(['en', 'ja', 'zh-CN', 'ko', 'es', 'vi']);

const PRESET_COPY = Object.freeze({
  en: { recommended:'Recommended Build', set:'Set {current}', scenarioOne:'Recommended general build', scenarioMany:'Recommendation set {current} of {total}', imported:'Imported recommendation. {slots}', slot:'Slot {slot}: {cards}' },
  ja: { recommended:'おすすめビルド', set:'セット{current}', scenarioOne:'汎用おすすめビルド', scenarioMany:'おすすめセット {current}/{total}', imported:'おすすめ構成を取り込みました。{slots}', slot:'スロット{slot}：{cards}' },
  'zh-CN': { recommended:'推荐构筑', set:'方案{current}', scenarioOne:'通用推荐构筑', scenarioMany:'推荐方案 {current}/{total}', imported:'已导入推荐构筑。{slots}', slot:'槽位{slot}：{cards}' },
  ko: { recommended:'추천 빌드', set:'세트 {current}', scenarioOne:'범용 추천 빌드', scenarioMany:'추천 세트 {current}/{total}', imported:'추천 구성을 가져왔습니다. {slots}', slot:'슬롯 {slot}: {cards}' },
  es: { recommended:'Configuración recomendada', set:'Conjunto {current}', scenarioOne:'Configuración general recomendada', scenarioMany:'Conjunto recomendado {current} de {total}', imported:'Recomendación importada. {slots}', slot:'Espacio {slot}: {cards}' },
  vi: { recommended:'Bộ Thẻ Khuyến Nghị', set:'Bộ {current}', scenarioOne:'Bộ thẻ khuyến nghị tổng quát', scenarioMany:'Bộ khuyến nghị {current}/{total}', imported:'Đã nhập cấu hình khuyến nghị. {slots}', slot:'Ô {slot}: {cards}' },
});

const CARD_IDS = Object.freeze({
  'lightning swift': '00019789_000000007BBC8D61',
  'super snowball': '00019798_000000000CBBBDF7',
  'build up': '00019802_00000000B3D0DCEA',
  'too easy': '00019809_00000000C4D7EC7C',
  'strategic escape': '00019813_0000000002B03815',
  'gekishin high': '00019820_0000000075B70883',
  'giant slayer': '00019824_0000000095B2EC4D',
  'prepare to die': '00019828_00000000E2B5DCDB',
  'steel skin': '00019832_000000005DDEBDC6',
  'solid barrier': '00019836_000000002AD98D50',
  'art of decoy': '00019856_00000000ECBE5939',
  'epic hunter': '00019860_000000009BB969AF',
  'wicked warrior': '00019864_000000007CD14978',
  pursuer: '00019868_000000000BD679EE',
  'guardian angel': '00019873_00000000B4BD18F3',
  'defense step': '00019879_00000000C3BA2865',
  backstab: '00019883_0000000005DDFC0C',
  'limit-breaking jump': '00019887_0000000072DACC9A',
});

const EXACT_ALIASES = Object.freeze({
  buildup: 'build up',
  'build up': 'build up',
  snowball: 'super snowball',
  'super snowball': 'super snowball',
  strat: 'strategic escape',
  strategy: 'strategic escape',
  'strategic escape': 'strategic escape',
  gs: 'giant slayer',
  'giant slayer': 'giant slayer',
  barrier: 'solid barrier',
  'solid barrier': 'solid barrier',
  'art of decoy': 'art of decoy',
  'boss hunter': 'epic hunter',
  'epic hunter': 'epic hunter',
  'gekishin high': 'gekishin high',
  'wicked warrior': 'wicked warrior',
  pursuer: 'pursuer',
  'defense step': 'defense step',
  backstab: 'backstab',
  lbj: 'limit-breaking jump',
  'limit breaking jump': 'limit-breaking jump',
  'limit-breaking jump': 'limit-breaking jump',
});

const TYPE_ALIASES = Object.freeze({
  'red card': 'attack',
  red: 'attack',
  'green card': 'defense',
  green: 'defense',
  'blue card': 'technical',
  blue: 'technical',
});

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[!?.'’]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadRecommendations() {
  try {
    const parsed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    return Array.isArray(parsed?.heroes) ? parsed.heroes : [];
  } catch {
    return [];
  }
}

function loadHeroNames() {
  try {
    const parsed = JSON.parse(fs.readFileSync(heroNamesPath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function formatCopy(value, params = {}) {
  let result = String(value || '');
  for (const [key, replacement] of Object.entries(params)) result = result.replaceAll(`{${key}}`, String(replacement));
  return result;
}

function localizedCardName(cardId, locale, fallback = '') {
  if (locale === 'en') return fallback;
  return db.prepare(`SELECT COALESCE(NULLIF(i.name,''),c.name) name
    FROM divine_cards c LEFT JOIN divine_cards_i18n i ON i.card_id=c.id AND i.locale=? WHERE c.id=?`)
    .get(locale, cardId)?.name || fallback;
}

function upsertPresetTranslations({ presetId, entry, variant, index, count }) {
  const names = loadHeroNames();
  const statement = db.prepare(`INSERT INTO divine_card_presets_i18n(
      preset_id,locale,name,description,scenario,translation_status,updated_at
    ) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(preset_id,locale) DO UPDATE SET
      name=excluded.name,description=excluded.description,scenario=excluded.scenario,
      translation_status=excluded.translation_status,updated_at=CURRENT_TIMESTAMP`);
  for (const locale of PRESET_LOCALES) {
    const copy = PRESET_COPY[locale];
    const heroName = names?.[locale]?.[entry.heroId] || entry.heroName || entry.sourceName || entry.heroId;
    const suffix = count > 1 ? ` — ${formatCopy(copy.set, { current:index + 1 })}` : '';
    const name = `${heroName} ${copy.recommended}${suffix}`;
    const slots = [1, 2, 3].map(slot => {
      const cardNames = variant.get(slot).map(card => localizedCardName(card.id, locale, card.name)).join(' / ');
      return formatCopy(copy.slot, { slot, cards:cardNames });
    }).join(locale === 'ja' || locale === 'zh-CN' ? '｜' : ' | ');
    const description = formatCopy(copy.imported, { slots });
    const scenario = count > 1
      ? formatCopy(copy.scenarioMany, { current:index + 1, total:count })
      : copy.scenarioOne;
    statement.run(presetId, locale, name, description, scenario, locale === 'en' ? 'source' : 'draft-native-review-required');
  }
}

function activeCatalogBySlot() {
  const rows = db.prepare(`SELECT id,name,slot_pool,card_type,display_order
    FROM divine_cards WHERE is_active=1 AND slot_pool IN (1,2,3)
    ORDER BY slot_pool,display_order,id`).all();
  const bySlot = new Map([[1, []], [2, []], [3, []]]);
  for (const row of rows) bySlot.get(Number(row.slot_pool)).push(row);
  return bySlot;
}

function exactCardGroup(token, slot, catalog) {
  const canonicalName = EXACT_ALIASES[token];
  if (!canonicalName) return null;
  const id = CARD_IDS[canonicalName];
  const card = catalog.get(slot).find(item => item.id === id);
  return card ? [card] : null;
}

function groupsForToken(rawToken, slot, catalog) {
  const token = normalizeText(rawToken);
  if (!token) return [];

  const exact = exactCardGroup(token, slot, catalog);
  if (exact) return [exact];

  const type = TYPE_ALIASES[token];
  if (type) {
    const cards = catalog.get(slot).filter(item => item.card_type === type);
    return cards.length ? [cards] : [];
  }

  if (token === 'any') {
    return ['attack', 'defense', 'technical']
      .map(typeName => catalog.get(slot).filter(item => item.card_type === typeName))
      .filter(group => group.length);
  }

  throw new Error(`Unknown Divine Card recommendation token "${rawToken}" in Slot ${slot}.`);
}

function packGroups(groups, maxCards = 3) {
  const bins = [];
  let current = [];
  for (const group of groups) {
    const uniqueGroup = group.filter(card => !current.some(item => item.id === card.id));
    if (!uniqueGroup.length) continue;
    if (uniqueGroup.length > maxCards) throw new Error('A recommendation group is larger than the supported three cards per Slot.');
    if (current.length && current.length + uniqueGroup.length > maxCards) {
      bins.push(current);
      current = [];
    }
    for (const card of uniqueGroup) {
      if (!current.some(item => item.id === card.id)) current.push(card);
    }
  }
  if (current.length) bins.push(current);
  return bins;
}

function resolveSlot(rawValue, slot, catalog) {
  const tokens = String(rawValue || '').split('/').map(item => item.trim()).filter(Boolean);
  const groups = tokens.flatMap(token => groupsForToken(token, slot, catalog));
  const bins = packGroups(groups);
  if (!bins.length) throw new Error(`No Divine Card recommendations were resolved for Slot ${slot}.`);
  return bins;
}

function buildVariants(entry, catalog) {
  const slotBins = new Map();
  for (const slot of [1, 2, 3]) slotBins.set(slot, resolveSlot(entry.slots?.[String(slot)], slot, catalog));
  const variantCount = Math.max(...[1, 2, 3].map(slot => slotBins.get(slot).length));
  const variants = [];
  for (let index = 0; index < variantCount; index += 1) {
    const options = new Map();
    for (const slot of [1, 2, 3]) {
      const bins = slotBins.get(slot);
      options.set(slot, bins[index] || bins[0]);
    }
    variants.push(options);
  }
  return variants;
}

function cardNames(cards) {
  return cards.map(card => card.name).join(' / ');
}

function resolveOwnerId() {
  const configuredEmail = String(process.env.DIVINE_CARD_ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (configuredEmail) {
    const owner = db.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE AND role=\'admin\' AND is_active=1 LIMIT 1').get(configuredEmail);
    if (owner) return Number(owner.id);
  }
  const admin = db.prepare("SELECT id FROM users WHERE role='admin' AND is_active=1 ORDER BY id LIMIT 1").get();
  return admin ? Number(admin.id) : 0;
}

function insertVariant(entry, variant, index, count, ownerId) {
  const sourceKey = `${SOURCE_PREFIX}:${entry.heroId}:${index + 1}`;
  const existing = db.prepare('SELECT id FROM divine_card_presets WHERE source_key=?').get(sourceKey);
  if (existing) {
    const presetId = Number(existing.id);
    upsertPresetTranslations({ presetId, entry, variant, index, count });
    return { presetId, created: false };
  }

  const suffix = count > 1 ? ` — Set ${index + 1}` : '';
  const displayName = String(entry.heroName || entry.sourceName || entry.heroId).trim();
  const name = `${displayName} Recommended Build${suffix}`;
  const chosenSummary = [1, 2, 3].map(slot => `Slot ${slot}: ${cardNames(variant.get(slot))}`).join(' | ');
  const rawSummary = [1, 2, 3].map(slot => `S${slot} ${entry.slots[String(slot)]}`).join(' · ');
  const description = `Imported from the user-provided Divine Card spreadsheet. ${rawSummary}. Resolved cards: ${chosenSummary}.`;
  const scenario = count > 1 ? `Recommendation set ${index + 1} of ${count}` : 'Recommended general build';

  const result = db.prepare(`INSERT INTO divine_card_presets(
    name,description,scenario,energy_threshold,energy_rate,source_key,created_by,updated_by
  ) VALUES (?,?,?,?,?,?,?,?)`).run(name, description, scenario, 100, 1, sourceKey, ownerId, ownerId);
  const presetId = Number(result.lastInsertRowid);
  const insertSlot = db.prepare('INSERT INTO divine_card_preset_slots(preset_id,slot_no,card_id) VALUES (?,?,?)');
  const insertSwap = db.prepare('INSERT INTO divine_card_preset_swaps(preset_id,slot_no,card_id,priority,note) VALUES (?,?,?,?,?)');
  for (const slot of [1, 2, 3]) {
    const cards = variant.get(slot);
    insertSlot.run(presetId, slot, cards[0].id);
    for (let optionIndex = 1; optionIndex < cards.length; optionIndex += 1) {
      insertSwap.run(presetId, slot, cards[optionIndex].id, optionIndex, 'Situational option imported from the user spreadsheet.');
    }
  }
  upsertPresetTranslations({ presetId, entry, variant, index, count });
  return { presetId, created: true };
}

function assignVariants(entry, presetIds) {
  const currentDefault = db.prepare('SELECT preset_id FROM hero_divine_card_presets WHERE hero_id=? AND is_default=1 LIMIT 1').get(entry.heroId);
  const insert = db.prepare(`INSERT INTO hero_divine_card_presets(hero_id,preset_id,is_default) VALUES (?,?,?)
    ON CONFLICT(hero_id,preset_id) DO NOTHING`);
  presetIds.forEach((presetId, index) => insert.run(entry.heroId, presetId, !currentDefault && index === 0 ? 1 : 0));
}

function seedRecommendedHeroBuilds() {
  const entries = loadRecommendations();
  if (!entries.length) return { createdPresets: 0, assignedHeroes: 0, skipped: true };
  const ownerId = resolveOwnerId();
  if (!ownerId) return { createdPresets: 0, assignedHeroes: 0, skipped: true, reason: 'No active Admin account exists yet.' };
  const catalog = activeCatalogBySlot();
  if ([1, 2, 3].some(slot => catalog.get(slot).length !== 6)) {
    return { createdPresets: 0, assignedHeroes: 0, skipped: true, reason: 'The 18-card catalog is not ready.' };
  }

  let createdPresets = 0;
  const assignedHeroes = new Set();
  transaction(() => {
    for (const entry of entries) {
      if (!/^\d{4}$/.test(String(entry.heroId || ''))) throw new Error(`Invalid hero ID for ${entry.heroName || entry.sourceName}.`);
      const variants = buildVariants(entry, catalog);
      const results = variants.map((variant, index) => {
        const result = insertVariant(entry, variant, index, variants.length, ownerId);
        if (result.created) createdPresets += 1;
        return result;
      });
      const newlyCreatedPresetIds = results.filter(result => result.created).map(result => result.presetId);
      // Seed assignments only when a recommendation is first created. This keeps
      // later manual unassign/remove choices intact across server restarts.
      if (newlyCreatedPresetIds.length) assignVariants(entry, newlyCreatedPresetIds);
      assignedHeroes.add(entry.heroId);
    }
  });
  return { createdPresets, assignedHeroes: assignedHeroes.size, skipped: false };
}

module.exports = {
  SOURCE_PREFIX,
  seedRecommendedHeroBuilds,
  _test: { normalizeText, resolveSlot, buildVariants },
};

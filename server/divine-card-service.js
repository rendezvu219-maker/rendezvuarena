const fs = require('node:fs');
const path = require('node:path');
const { db, transaction } = require('./db');
const { normalizeLocale } = require('./i18n-locale');

const root = path.resolve(__dirname, '..');
const cardAssetDir = path.join(root, 'assets', 'divine-cards');
const catalogPath = path.join(cardAssetDir, 'catalog.json');
const bundledTranslationsPath = path.join(root, 'data', 'locales', 'divine-cards.json');
const PUBLIC_CARD_PREFIX = '/assets/divine-cards/';
const CARD_TYPES = new Set(['attack', 'defense', 'technical']);
const BUNDLED_TRANSLATION_STATUSES = new Set(['user-provided-source', 'translated-from-zh-CN']);
// Card 4–9 are independent optional positions. `priority` remains only as
// the legacy storage coordinate (1/2) inside each Slot, not a gameplay order.
const SITUATIONAL_POSITIONS = Object.freeze([
  { cardNumber: 4, slot: 1, priority: 1 },
  { cardNumber: 5, slot: 2, priority: 1 },
  { cardNumber: 6, slot: 3, priority: 1 },
  { cardNumber: 7, slot: 1, priority: 2 },
  { cardNumber: 8, slot: 2, priority: 2 },
  { cardNumber: 9, slot: 3, priority: 2 },
]);

function cleanText(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeSlot(value, allowNull = true) {
  if (value === null || value === undefined || value === '') {
    if (allowNull) return null;
    throw new Error('A Slot pool is required.');
  }
  const slot = Number(value);
  if (![1, 2, 3].includes(slot)) throw new Error('Slot pool must be Slot 1, Slot 2, or Slot 3.');
  return slot;
}

function normalizeCardType(value, allowBlank = true) {
  const type = cleanText(value, 20).toLowerCase();
  if (!type && allowBlank) return '';
  if (!CARD_TYPES.has(type)) throw new Error('Card type must be Attack, Defense, or Technical.');
  return type;
}

function normalizeDisplayOrder(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 && number <= 9999 ? number : fallback;
}

function normalizeEnergyThreshold(value) {
  const number = Number(value ?? 100);
  if (!Number.isFinite(number) || number < 1 || number > 100000) {
    throw new Error('Energy threshold must be between 1 and 100000.');
  }
  return Math.round(number);
}

function normalizeEnergyRate(value) {
  const number = Number(value ?? 1);
  if (!Number.isFinite(number) || number <= 0 || number > 1000) {
    throw new Error('Energy rate must be greater than 0 and no higher than 1000.');
  }
  return Math.round(number * 100) / 100;
}

function slugify(value, fallback = 'divine-card') {
  const slug = cleanText(value, 120)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function loadCatalog() {
  try {
    const rows = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function loadBundledCardTranslations() {
  try {
    const payload = JSON.parse(fs.readFileSync(bundledTranslationsPath, 'utf8'));
    return Array.isArray(payload?.translations) ? payload.translations : [];
  } catch {
    return [];
  }
}

function seedBundledCardTranslations() {
  const rows = loadBundledCardTranslations();
  if (!rows.length) return 0;

  const findCard = db.prepare('SELECT id,name FROM divine_cards WHERE id=?');
  const findExisting = db.prepare('SELECT translation_status FROM divine_cards_i18n WHERE card_id=? AND locale=?');
  const upsert = db.prepare(`INSERT INTO divine_cards_i18n(
      card_id,locale,name,description,effect,note,translation_status,updated_at
    ) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(card_id,locale) DO UPDATE SET
      name=excluded.name,description=excluded.description,effect=excluded.effect,note=excluded.note,
      translation_status=excluded.translation_status,updated_at=CURRENT_TIMESTAMP`);

  let imported = 0;
  transaction(() => {
    for (const item of rows) {
      const cardId = cleanText(item?.cardId, 120);
      const locale = normalizeLocale(item?.locale);
      if (!cardId || locale === 'en') continue;
      const card = findCard.get(cardId);
      if (!card) continue;

      const effect = cleanText(item?.effect ?? item?.description, 3000);
      const description = cleanText(item?.description ?? item?.effect, 3000);
      const note = cleanText(item?.note, 3000);
      if (!effect || !description || !note) continue;

      const existing = findExisting.get(cardId, locale);
      // Bundled translations are authoritative only for rows created from the
      // bundled source. A later Admin translation uses another status and is
      // intentionally preserved across restarts.
      if (existing && !BUNDLED_TRANSLATION_STATUSES.has(existing.translation_status)) continue;

      upsert.run(
        cardId,
        locale,
        cleanText(card.name, 120),
        description,
        effect,
        note,
        cleanText(item?.translationStatus || 'user-provided-source', 80),
      );
      imported += 1;
    }
  });
  return imported;
}

function publicFilename(imagePath) {
  return path.basename(String(imagePath || ''));
}

function uniqueFilename(baseName, currentFilename = '') {
  const base = slugify(baseName);
  let filename = `${base}.png`;
  let suffix = 2;
  while (filename !== currentFilename && fs.existsSync(path.join(cardAssetDir, filename))) {
    filename = `${base}-${suffix++}.png`;
  }
  return filename;
}


function serializeCard(row, locale = 'en') {
  const resolvedLocale = normalizeLocale(locale);
  const sourceEffect = row.effect || row.description || '';
  const localizedEffect = row.localized_effect || row.localized_description || '';
  const effect = localizedEffect || sourceEffect;
  return {
    id: row.id,
    imagePath: row.image_path,
    name: row.localized_name || row.name,
    description: effect,
    effect,
    note: row.localized_note || row.note || '',
    cardType: row.card_type || '',
    displayOrder: Number(row.display_order || 0),
    slotPool: row.slot_pool == null ? null : Number(row.slot_pool),
    isActive: Boolean(row.is_active),
    locale: resolvedLocale,
    translationStatus: row.translation_status || (resolvedLocale === 'en' ? 'source' : 'fallback-en'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function localizedCardSelect(locale = 'en') {
  const resolvedLocale = normalizeLocale(locale);
  return {
    locale: resolvedLocale,
    sql: `SELECT c.*,
      NULLIF(i.name,'') localized_name,
      NULLIF(i.description,'') localized_description,
      NULLIF(i.effect,'') localized_effect,
      NULLIF(i.note,'') localized_note,
      i.translation_status
    FROM divine_cards c
    LEFT JOIN divine_cards_i18n i ON i.card_id=c.id AND i.locale=?`,
  };
}

function upsertCardTranslation(cardId, locale, input, userId = null) {
  const resolvedLocale = normalizeLocale(locale);
  const card = db.prepare('SELECT id FROM divine_cards WHERE id=?').get(String(cardId));
  if (!card) throw new Error('Divine Card not found.');
  const name = cleanText(input.name, 120);
  const description = cleanText(input.description ?? input.effect, 3000);
  const effect = cleanText(input.effect ?? input.description, 3000);
  const note = cleanText(input.note, 3000);
  const status = resolvedLocale === 'en'
    ? 'source'
    : cleanText(input.translationStatus || 'draft-native-review-required', 80);
  db.prepare(`INSERT INTO divine_cards_i18n(
      card_id,locale,name,description,effect,note,translation_status,updated_by,updated_at
    ) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(card_id,locale) DO UPDATE SET
      name=excluded.name,description=excluded.description,effect=excluded.effect,note=excluded.note,
      translation_status=excluded.translation_status,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`)
    .run(card.id, resolvedLocale, name, description, effect, note, status, userId || null);
  return localizedCardById(card.id, resolvedLocale);
}

function localizedCardById(cardId, locale = 'en') {
  const selection = localizedCardSelect(locale);
  const row = db.prepare(`${selection.sql} WHERE c.id=?`).get(selection.locale, String(cardId));
  return row ? serializeCard(row, selection.locale) : null;
}
function seedDivineCardAssets() {
  fs.mkdirSync(cardAssetDir, { recursive: true });
  const catalog = loadCatalog();
  const insertCanonical = db.prepare(`INSERT OR IGNORE INTO divine_cards(
    id,image_path,name,description,effect,note,card_type,display_order,slot_pool,is_active
  ) VALUES (?,?,?,?,?,?,?,?,?,1)`);

  for (const item of catalog) {
    const id = cleanText(item.id, 120);
    const filename = path.basename(cleanText(item.filename, 160));
    if (!/^[a-zA-Z0-9_-]{4,120}$/.test(id) || !/^[a-z0-9][a-z0-9-]*\.png$/.test(filename)) continue;

    const legacyFilename = `${id}.png`;
    const legacyPath = path.join(cardAssetDir, legacyFilename);
    const canonicalPath = path.join(cardAssetDir, filename);
    if (!fs.existsSync(canonicalPath) && fs.existsSync(legacyPath)) fs.renameSync(legacyPath, canonicalPath);

    insertCanonical.run(
      id,
      `${PUBLIC_CARD_PREFIX}${filename}`,
      cleanText(item.name, 120),
      cleanText(item.effect, 3000),
      cleanText(item.effect, 3000),
      cleanText(item.note, 3000),
      normalizeCardType(item.cardType, true),
      normalizeDisplayOrder(item.displayOrder),
      normalizeSlot(item.slotPool, true),
    );

    const current = db.prepare('SELECT * FROM divine_cards WHERE id=?').get(id);
    if (!current) continue;
    const legacyPublicPath = `${PUBLIC_CARD_PREFIX}${legacyFilename}`;
    const imagePath = current.image_path === legacyPublicPath && fs.existsSync(canonicalPath)
      ? `${PUBLIC_CARD_PREFIX}${filename}`
      : current.image_path;
    const needsCatalogMigration = !current.effect && !current.note && !current.card_type && !Number(current.display_order || 0);
    db.prepare(`UPDATE divine_cards SET image_path=?,effect=?,note=?,card_type=?,display_order=? WHERE id=?`)
      .run(
        imagePath,
        needsCatalogMigration ? cleanText(item.effect, 3000) : current.effect,
        needsCatalogMigration ? cleanText(item.note, 3000) : current.note,
        needsCatalogMigration ? normalizeCardType(item.cardType, true) : current.card_type,
        needsCatalogMigration ? normalizeDisplayOrder(item.displayOrder) : current.display_order,
        id,
      );
  }

  const knownPaths = new Set(db.prepare('SELECT image_path FROM divine_cards').all().map(row => row.image_path));
  const insertLoose = db.prepare(`INSERT OR IGNORE INTO divine_cards(
    id,image_path,name,description,effect,note,card_type,display_order,slot_pool,is_active
  ) VALUES (?,?, '', '', '', '', '', 0, NULL, 1)`);
  for (const filename of fs.readdirSync(cardAssetDir).filter(name => name.toLowerCase().endsWith('.png')).sort()) {
    const imagePath = `${PUBLIC_CARD_PREFIX}${filename}`;
    if (knownPaths.has(imagePath)) continue;
    const id = path.basename(filename, path.extname(filename));
    if (!/^[a-zA-Z0-9_-]{4,120}$/.test(id)) continue;
    insertLoose.run(id, imagePath);
  }
  db.exec(`
    INSERT INTO divine_cards_i18n(card_id,locale,name,description,effect,note,translation_status)
    SELECT id,'en',name,description,effect,note,'source' FROM divine_cards WHERE 1
    ON CONFLICT(card_id,locale) DO UPDATE SET
      name=excluded.name,description=excluded.description,effect=excluded.effect,note=excluded.note,
      translation_status='source',updated_at=CURRENT_TIMESTAMP;
  `);
  seedBundledCardTranslations();
}

function listCards({ admin = false, locale = 'en' } = {}) {
  const selection = localizedCardSelect(locale);
  const where = admin ? '' : "WHERE c.is_active=1 AND c.name!='' AND c.slot_pool IN (1,2,3)";
  return db.prepare(`${selection.sql} ${where}
    ORDER BY CASE WHEN c.slot_pool IS NULL THEN 4 ELSE c.slot_pool END,
      CASE c.card_type WHEN 'attack' THEN 1 WHEN 'defense' THEN 2 WHEN 'technical' THEN 3 ELSE 4 END,
      c.display_order,COALESCE(NULLIF(i.name,''),c.name) COLLATE NOCASE,c.id`)
    .all(selection.locale).map(row => serializeCard(row, selection.locale));
}
function listPresets({ admin = false, locale = 'en' } = {}) {
  const resolvedLocale = normalizeLocale(locale);
  const rows = db.prepare(`SELECT p.*,u.display_name created_by_name,
      COALESCE(NULLIF(pi.name,''),p.name) localized_name,
      COALESCE(NULLIF(pi.description,''),p.description) localized_description,
      COALESCE(NULLIF(pi.scenario,''),p.scenario) localized_scenario,
      pi.translation_status
    FROM divine_card_presets p
    LEFT JOIN users u ON u.id=p.created_by
    LEFT JOIN divine_card_presets_i18n pi ON pi.preset_id=p.id AND pi.locale=?
    ORDER BY COALESCE(NULLIF(pi.name,''),p.name) COLLATE NOCASE,p.id`).all(resolvedLocale);
  const slots = db.prepare(`SELECT s.preset_id,s.slot_no,s.card_id,c.image_path,
      COALESCE(NULLIF(i.name,''),c.name) card_name,
      COALESCE(NULLIF(i.description,''),c.description) card_description,
      COALESCE(NULLIF(i.effect,''),c.effect) card_effect,
      COALESCE(NULLIF(i.note,''),c.note) card_note,c.card_type,c.display_order,c.slot_pool,c.is_active
    FROM divine_card_preset_slots s JOIN divine_cards c ON c.id=s.card_id
    LEFT JOIN divine_cards_i18n i ON i.card_id=c.id AND i.locale=?
    ORDER BY s.preset_id,s.slot_no`).all(resolvedLocale);
  const swaps = db.prepare(`SELECT s.preset_id,s.slot_no,s.card_id,s.priority,s.note,c.image_path,
      COALESCE(NULLIF(i.name,''),c.name) card_name,
      COALESCE(NULLIF(i.description,''),c.description) card_description,
      COALESCE(NULLIF(i.effect,''),c.effect) card_effect,
      COALESCE(NULLIF(i.note,''),c.note) card_note,c.card_type,c.display_order,c.slot_pool,c.is_active
    FROM divine_card_preset_swaps s JOIN divine_cards c ON c.id=s.card_id
    LEFT JOIN divine_cards_i18n i ON i.card_id=c.id AND i.locale=?
    ORDER BY s.preset_id,s.slot_no,s.priority,c.display_order,COALESCE(NULLIF(i.name,''),c.name) COLLATE NOCASE`).all(resolvedLocale);
  const assignments = db.prepare(`SELECT hero_id,preset_id,is_default FROM hero_divine_card_presets ORDER BY hero_id,preset_id`).all();
  const slotMap = new Map();
  for (const row of slots) {
    if (!slotMap.has(row.preset_id)) slotMap.set(row.preset_id, []);
    slotMap.get(row.preset_id).push({
      slot: Number(row.slot_no),
      card: {
        id: row.card_id,
        imagePath: row.image_path,
        name: row.card_name,
        description: row.card_effect || row.card_description || '',
        effect: row.card_effect || row.card_description || '',
        note: row.card_note || '',
        cardType: row.card_type || '',
        displayOrder: Number(row.display_order || 0),
        slotPool: Number(row.slot_pool),
        isActive: Boolean(row.is_active),
        locale: resolvedLocale,
      },
    });
  }
  const swapMap = new Map();
  for (const row of swaps) {
    if (!swapMap.has(row.preset_id)) swapMap.set(row.preset_id, []);
    swapMap.get(row.preset_id).push({
      slot: Number(row.slot_no),
      priority: Number(row.priority || 1),
      note: row.note || '',
      card: {
        id: row.card_id,
        imagePath: row.image_path,
        name: row.card_name,
        description: row.card_effect || row.card_description || '',
        effect: row.card_effect || row.card_description || '',
        note: row.card_note || '',
        cardType: row.card_type || '',
        displayOrder: Number(row.display_order || 0),
        slotPool: Number(row.slot_pool),
        isActive: Boolean(row.is_active),
        locale: resolvedLocale,
      },
    });
  }
  const assignmentMap = new Map();
  for (const row of assignments) {
    if (!assignmentMap.has(row.preset_id)) assignmentMap.set(row.preset_id, []);
    assignmentMap.get(row.preset_id).push({ heroId: row.hero_id, isDefault: Boolean(row.is_default) });
  }
  return rows.map(row => {
    const swapOptions = swapMap.get(row.id) || [];
    const situationalSlots = Object.fromEntries(SITUATIONAL_POSITIONS.map(position => {
      const match = swapOptions.find(item => item.slot === position.slot && item.priority === position.priority);
      return [String(position.cardNumber), match?.card?.id || null];
    }));
    return {
    id: Number(row.id),
    name: row.localized_name || row.name,
    description: row.localized_description || row.description,
    scenario: row.localized_scenario || row.scenario || '',
    locale: resolvedLocale,
    translationStatus: row.translation_status || (resolvedLocale === 'en' ? 'source' : 'fallback-en'),
    sourceKey: row.source_key || '',
    energyThreshold: Number(row.energy_threshold),
    energyRate: Number(row.energy_rate),
    slots: slotMap.get(row.id) || [],
    swapOptions,
    situationalSlots,
    heroAssignments: assignmentMap.get(row.id) || [],
    createdByName: admin ? (row.created_by_name || '') : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  }).filter(preset => admin || (
    preset.slots.length === 3
    && preset.slots.every(item => item.card.isActive && item.card.name)
    && preset.swapOptions.every(item => item.card.isActive && item.card.name)
  ));
}

function publicBundle(locale = 'en') {
  const resolvedLocale = normalizeLocale(locale);
  return { locale: resolvedLocale, cards: listCards({ locale: resolvedLocale }), presets: listPresets({ locale: resolvedLocale }) };
}

function adminBundle(locale = 'en') {
  const resolvedLocale = normalizeLocale(locale);
  return { locale: resolvedLocale, cards: listCards({ admin: true, locale: resolvedLocale }), presets: listPresets({ admin: true, locale: resolvedLocale }) };
}

function updateCard(cardId, input, userId) {
  const existing = db.prepare('SELECT * FROM divine_cards WHERE id=?').get(String(cardId));
  if (!existing) throw new Error('Divine Card not found.');
  const name = cleanText(input.name, 120);
  const effect = cleanText(input.effect ?? input.description, 3000);
  const note = cleanText(input.note, 3000);
  const cardType = normalizeCardType(input.cardType, true);
  const slotPool = normalizeSlot(input.slotPool, true);
  const isActive = input.isActive !== false ? 1 : 0;
  let displayOrder = normalizeDisplayOrder(input.displayOrder, Number(existing.display_order || 0));

  if (slotPool !== null) {
    const mismatch = db.prepare(`SELECT preset_id,slot_no FROM (
      SELECT preset_id,slot_no FROM divine_card_preset_slots WHERE card_id=?
      UNION ALL
      SELECT preset_id,slot_no FROM divine_card_preset_swaps WHERE card_id=?
    ) WHERE slot_no!=? LIMIT 1`).get(existing.id, existing.id, slotPool);
    if (mismatch) throw new Error(`This card is already used in Slot ${mismatch.slot_no}. Remove it from that preset before changing its Slot pool.`);
  } else {
    const used = db.prepare(`SELECT 1 FROM (
      SELECT card_id FROM divine_card_preset_slots WHERE card_id=?
      UNION ALL
      SELECT card_id FROM divine_card_preset_swaps WHERE card_id=?
    ) LIMIT 1`).get(existing.id, existing.id);
    if (used) throw new Error('Remove this card from every preset and swap plan before clearing its Slot pool.');
  }

  if (!displayOrder && slotPool) {
    const next = db.prepare('SELECT COALESCE(MAX(display_order),0)+1 value FROM divine_cards WHERE slot_pool=?').get(slotPool);
    displayOrder = Number(next.value || 1);
  }
  const imagePath = existing.image_path;
  const requestedLocale = normalizeLocale(input.locale || 'en');
  if (requestedLocale === 'en') {
    db.prepare(`UPDATE divine_cards SET image_path=?,name=?,description=?,effect=?,note=?,card_type=?,display_order=?,slot_pool=?,is_active=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(imagePath, name, effect, effect, note, cardType, displayOrder, slotPool, isActive, userId, existing.id);
    upsertCardTranslation(existing.id, 'en', { name, description: effect, effect, note, translationStatus:'source' }, userId);
    return localizedCardById(existing.id, 'en');
  }
  db.prepare(`UPDATE divine_cards SET image_path=?,card_type=?,display_order=?,slot_pool=?,is_active=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(imagePath, cardType, displayOrder, slotPool, isActive, userId, existing.id);
  return upsertCardTranslation(existing.id, requestedLocale, input, userId);
}

function parsePngDataUrl(dataUrl) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
  if (!match) throw new Error('Upload a PNG image.');
  const buffer = Buffer.from(match[1].replace(/\s/g, ''), 'base64');
  if (buffer.length < 100 || buffer.length > 2 * 1024 * 1024) throw new Error('PNG must be between 100 bytes and 2 MB.');
  const signature = buffer.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') throw new Error('The uploaded file is not a valid PNG.');
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width !== 288 || height !== 352) throw new Error('Divine Card images must be exactly 288 × 352 pixels.');
  return buffer;
}

function createCard(input, userId) {
  const buffer = parsePngDataUrl(input.imageBase64);
  const name = cleanText(input.name, 120);
  const effect = cleanText(input.effect ?? input.description, 3000);
  const note = cleanText(input.note, 3000);
  const cardType = normalizeCardType(input.cardType, true);
  const slotPool = normalizeSlot(input.slotPool, true);
  const base = slugify(name || cleanText(input.fileName, 120).replace(/\.png$/i, ''), `divine-card-${Date.now()}`);
  const filename = uniqueFilename(base);
  let id = base;
  let suffix = 2;
  while (db.prepare('SELECT 1 FROM divine_cards WHERE id=?').get(id)) id = `${base}-${suffix++}`;
  const displayOrder = slotPool ? Number(db.prepare('SELECT COALESCE(MAX(display_order),0)+1 value FROM divine_cards WHERE slot_pool=?').get(slotPool).value || 1) : 0;
  fs.writeFileSync(path.join(cardAssetDir, filename), buffer, { flag: 'wx' });
  try {
    db.prepare(`INSERT INTO divine_cards(
      id,image_path,name,description,effect,note,card_type,display_order,slot_pool,is_active,created_by,updated_by
    ) VALUES (?,?,?,?,?,?,?,?,?,1,?,?)`).run(
      id, `${PUBLIC_CARD_PREFIX}${filename}`, name, effect, effect, note, cardType, displayOrder, slotPool, userId, userId,
    );
  } catch (error) {
    fs.rmSync(path.join(cardAssetDir, filename), { force: true });
    throw error;
  }
  upsertCardTranslation(id, 'en', {
    name,
    description: effect,
    effect,
    note,
    translationStatus: 'source',
  }, userId);
  const requestedLocale = normalizeLocale(input.locale || 'en');
  if (requestedLocale !== 'en') {
    return upsertCardTranslation(id, requestedLocale, input, userId);
  }
  return localizedCardById(id, 'en');
}

function normalizePresetSlots(slotInput) {
  const source = Array.isArray(slotInput) ? slotInput : [];
  const bySlot = new Map();
  for (const item of source) {
    const slot = normalizeSlot(item.slot, false);
    const cardId = cleanText(item.cardId, 120);
    if (!cardId) throw new Error(`Choose a card for Slot ${slot}.`);
    bySlot.set(slot, cardId);
  }
  if (bySlot.size !== 3 || ![1, 2, 3].every(slot => bySlot.has(slot))) {
    throw new Error('A preset must contain one card in Slot 1, Slot 2, and Slot 3.');
  }
  const cards = db.prepare(`SELECT * FROM divine_cards WHERE id IN (?,?,?)`).all(bySlot.get(1), bySlot.get(2), bySlot.get(3));
  const cardMap = new Map(cards.map(card => [card.id, card]));
  for (const slot of [1, 2, 3]) {
    const card = cardMap.get(bySlot.get(slot));
    if (!card || !card.is_active) throw new Error(`The card selected for Slot ${slot} is unavailable.`);
    if (!card.name || Number(card.slot_pool) !== slot) throw new Error(`The card selected for Slot ${slot} is not cataloged for that Slot pool.`);
  }
  return bySlot;
}

function normalizePresetSwaps(swapInput, startingSlots, situationalInput) {
  // New clients send all six independent Card 4–9 positions as a fixed object. Keep the
  // legacy swapOptions array as a fallback so existing integrations continue
  // to work, while never compacting a lone Card 4/5/6/7/8/9 into another slot.
  const hasFixedPositions = situationalInput && typeof situationalInput === 'object' && !Array.isArray(situationalInput);
  const source = hasFixedPositions
    ? SITUATIONAL_POSITIONS.map(position => ({
        slot: position.slot,
        priority: position.priority,
        cardId: situationalInput[String(position.cardNumber)] ?? situationalInput[position.cardNumber] ?? null,
      }))
    : (Array.isArray(swapInput) ? swapInput : []);
  const rows = [];
  const seenCards = new Set();
  const usedPositions = new Set();
  const usedPrioritiesBySlot = new Map([[1, new Set()], [2, new Set()], [3, new Set()]]);

  for (const item of source) {
    const slot = normalizeSlot(item.slot, false);
    const cardId = cleanText(item.cardId, 120);
    if (!cardId) continue;

    const usedPriorities = usedPrioritiesBySlot.get(slot);
    let priority = Number(item.priority);
    if (![1, 2].includes(priority)) priority = [1, 2].find(value => !usedPriorities.has(value));
    if (![1, 2].includes(priority)) throw new Error(`Slot ${slot} can have at most two situational cards: Card ${slot + 3} and Card ${slot + 6}.`);

    const positionKey = `${slot}:${priority}`;
    if (usedPositions.has(positionKey)) throw new Error(`Card ${slot + (priority * 3)} already has a selected card.`);
    if (seenCards.has(cardId)) throw new Error('The same Divine Card cannot be used twice in one preset.');
    if (startingSlots.get(slot) === cardId) throw new Error(`Card ${slot + (priority * 3)} must be different from the core Card ${slot}.`);

    const card = db.prepare('SELECT * FROM divine_cards WHERE id=?').get(cardId);
    if (!card || !card.is_active || !card.name) throw new Error(`A situational card in Slot ${slot} is unavailable.`);
    if (Number(card.slot_pool) !== slot) throw new Error(`A situational card for Slot ${slot} must belong to the same Slot pool.`);

    usedPositions.add(positionKey);
    usedPriorities.add(priority);
    seenCards.add(cardId);
    rows.push({
      slot,
      cardId,
      priority,
      note: cleanText(item.note, 1000),
    });
  }
  return rows.sort((a, b) => a.slot - b.slot || a.priority - b.priority || a.cardId.localeCompare(b.cardId));
}

function upsertPresetTranslation(presetId, locale, input, userId = null) {
  const resolvedLocale = normalizeLocale(locale);
  const preset = db.prepare('SELECT id FROM divine_card_presets WHERE id=?').get(Number(presetId));
  if (!preset) throw new Error('Preset not found.');
  const name = cleanText(input.name, 140);
  const description = cleanText(input.description, 3000);
  const scenario = cleanText(input.scenario, 180);
  const status = resolvedLocale === 'en'
    ? 'source'
    : cleanText(input.translationStatus || 'draft-native-review-required', 80);
  db.prepare(`INSERT INTO divine_card_presets_i18n(
      preset_id,locale,name,description,scenario,translation_status,updated_by,updated_at
    ) VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
    ON CONFLICT(preset_id,locale) DO UPDATE SET
      name=excluded.name,description=excluded.description,scenario=excluded.scenario,
      translation_status=excluded.translation_status,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP`)
    .run(Number(presetId), resolvedLocale, name, description, scenario, status, userId || null);
  return listPresets({ admin:true, locale:resolvedLocale }).find(item => item.id === Number(presetId)) || null;
}

function savePreset(presetId, input, userId) {
  const requestedLocale = normalizeLocale(input.locale || 'en');
  const name = cleanText(input.name, 140);
  if (!name) throw new Error('Preset name is required.');
  const description = cleanText(input.description, 3000);
  const scenario = cleanText(input.scenario, 180);
  const energyThreshold = normalizeEnergyThreshold(input.energyThreshold);
  const energyRate = normalizeEnergyRate(input.energyRate);
  const slots = normalizePresetSlots(input.slots);
  const swapOptions = normalizePresetSwaps(input.swapOptions, slots, input.situationalSlots);

  const id = transaction(() => {
    let resolvedId = presetId ? Number(presetId) : 0;
    if (resolvedId) {
      const current = db.prepare('SELECT id FROM divine_card_presets WHERE id=?').get(resolvedId);
      if (!current) throw new Error('Preset not found.');
      if (requestedLocale === 'en') {
        db.prepare(`UPDATE divine_card_presets SET name=?,description=?,scenario=?,energy_threshold=?,energy_rate=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .run(name, description, scenario, energyThreshold, energyRate, userId, resolvedId);
      } else {
        db.prepare(`UPDATE divine_card_presets SET energy_threshold=?,energy_rate=?,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .run(energyThreshold, energyRate, userId, resolvedId);
      }
      db.prepare('DELETE FROM divine_card_preset_slots WHERE preset_id=?').run(resolvedId);
      db.prepare('DELETE FROM divine_card_preset_swaps WHERE preset_id=?').run(resolvedId);
    } else {
      const result = db.prepare(`INSERT INTO divine_card_presets(name,description,scenario,energy_threshold,energy_rate,created_by,updated_by)
        VALUES (?,?,?,?,?,?,?)`).run(name, description, scenario, energyThreshold, energyRate, userId, userId);
      resolvedId = Number(result.lastInsertRowid);
    }
    const insert = db.prepare('INSERT INTO divine_card_preset_slots(preset_id,slot_no,card_id) VALUES (?,?,?)');
    for (const slot of [1, 2, 3]) insert.run(resolvedId, slot, slots.get(slot));
    const insertSwap = db.prepare('INSERT INTO divine_card_preset_swaps(preset_id,slot_no,card_id,priority,note) VALUES (?,?,?,?,?)');
    for (const item of swapOptions) insertSwap.run(resolvedId, item.slot, item.cardId, item.priority, item.note);
    return resolvedId;
  });
  if (requestedLocale === 'en') upsertPresetTranslation(id, 'en', { name, description, scenario, translationStatus:'source' }, userId);
  else upsertPresetTranslation(id, requestedLocale, { name, description, scenario, translationStatus:input.translationStatus }, userId);
  return listPresets({ admin:true, locale:requestedLocale }).find(preset => preset.id === id);
}

function deletePreset(presetId) {
  const result = db.prepare('DELETE FROM divine_card_presets WHERE id=?').run(Number(presetId));
  if (!result.changes) throw new Error('Preset not found.');
}

function assignPreset(input) {
  const presetId = Number(input.presetId);
  const preset = db.prepare('SELECT id FROM divine_card_presets WHERE id=?').get(presetId);
  if (!preset) throw new Error('Preset not found.');
  const heroIds = [...new Set((Array.isArray(input.heroIds) ? input.heroIds : []).map(id => cleanText(id, 12)).filter(id => /^\d{4}$/.test(id)))];
  if (!heroIds.length) throw new Error('Choose at least one hero.');
  const action = input.action === 'unassign' ? 'unassign' : 'assign';
  const makeDefault = input.makeDefault === true;

  transaction(() => {
    for (const heroId of heroIds) {
      if (action === 'unassign') {
        const current = db.prepare('SELECT is_default FROM hero_divine_card_presets WHERE hero_id=? AND preset_id=?').get(heroId, presetId);
        db.prepare('DELETE FROM hero_divine_card_presets WHERE hero_id=? AND preset_id=?').run(heroId, presetId);
        // Keep the hero page useful after a mistaken default assignment is removed:
        // promote one remaining build instead of leaving multiple builds with no default.
        if (current?.is_default) {
          const fallback = db.prepare('SELECT preset_id FROM hero_divine_card_presets WHERE hero_id=? ORDER BY preset_id ASC LIMIT 1').get(heroId);
          if (fallback) db.prepare('UPDATE hero_divine_card_presets SET is_default=1 WHERE hero_id=? AND preset_id=?').run(heroId, fallback.preset_id);
        }
        continue;
      }
      if (makeDefault) db.prepare('UPDATE hero_divine_card_presets SET is_default=0 WHERE hero_id=?').run(heroId);
      db.prepare(`INSERT INTO hero_divine_card_presets(hero_id,preset_id,is_default) VALUES (?,?,?)
        ON CONFLICT(hero_id,preset_id) DO UPDATE SET is_default=excluded.is_default`).run(heroId, presetId, makeDefault ? 1 : 0);
    }
  });
  return listPresets({ admin: true }).find(item => item.id === presetId);
}

module.exports = {
  seedDivineCardAssets,
  seedBundledCardTranslations,
  publicBundle,
  adminBundle,
  updateCard,
  createCard,
  savePreset,
  deletePreset,
  assignPreset,
  listCards,
  listPresets,
  localizedCardById,
  upsertCardTranslation,
  upsertPresetTranslation,
};

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { BUILD_LOCALES, SITUATIONAL_POSITIONS, validateBuildData, resolveBuildBundle, buildAssetUrl } from '../js/character-builds.js';

const root = fileURLToPath(new URL('../', import.meta.url));
export const buildDataPath = path.resolve(process.env.CHARACTER_BUILDS_PATH || path.join(root, 'data/character-builds.json'));
const text = (value, max = 3000) => String(value ?? '').trim().slice(0, max);
const localeOf = input => BUILD_LOCALES.includes(input?.locale) ? input.locale : 'en';
const now = () => new Date().toISOString();
function slotOf(value) {
  if (value == null || value === '') return null;
  if (![1,2,3].includes(Number(value))) throw new Error('Slot pool must be Slot 1, Slot 2, or Slot 3.');
  return Number(value);
}
function typeOf(value) {
  if (!['', 'attack', 'defense', 'technical'].includes(value || '')) throw new Error('Invalid card type.');
  return value || '';
}
function bounded(value, fallback, min, max) {
  const result = Number(value ?? fallback);
  if (!Number.isFinite(result) || result < min || result > max) throw new Error(`Value must be between ${min} and ${max}.`);
  return result;
}
function translated(record, input, fields) {
  const locale = localeOf(input);
  const copy = Object.fromEntries(fields.map(field => [field, text(input[field], field === 'name' ? 140 : 3000)]));
  record.translations ||= {};
  if (locale === 'en') Object.assign(record, copy);
  record.translations[locale] = { ...copy, translationStatus:locale === 'en' ? 'source' : 'draft-native-review-required', updatedAt:now() };
  record.updatedAt = now();
}

export function createBuildStore(filePath = buildDataPath, assetDir = path.join(root, 'assets/divine-cards')) {
  function read() {
    // Missing/corrupt data is an error, never a reason to start with an empty file.
    return validateBuildData(JSON.parse(fs.readFileSync(filePath, 'utf8')));
  }
  function mutate(change) {
    const lockPath = `${filePath}.lock`;
    let lock;
    try { lock = fs.openSync(lockPath, 'wx'); }
    catch (error) {
      if (error.code === 'EEXIST') throw new Error('Another build save is in progress. Retry after it finishes.');
      throw error;
    }
    const temporary = `${filePath}.${randomUUID()}.tmp`;
    try {
      const data = read();
      const result = change(data);
      data.updatedAt = now();
      validateBuildData(data);
      const content = `${JSON.stringify(data, null, 2)}\n`;
      const descriptor = fs.openSync(temporary, 'wx');
      try { fs.writeFileSync(descriptor, content); fs.fsyncSync(descriptor); }
      finally { fs.closeSync(descriptor); }
      fs.copyFileSync(filePath, `${filePath}.bak`);
      fs.renameSync(temporary, filePath);
      return result;
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
      fs.closeSync(lock);
      fs.unlinkSync(lockPath);
    }
  }
  const bundle = (locale = 'en', admin = false) => resolveBuildBundle(read(), { locale, admin });
  const findPreset = (data, id) => {
    const preset = data.presets.find(item => item.id === Number(id));
    if (!preset) throw new Error('Preset not found.');
    return preset;
  };
  function updateCard(id, input) {
    mutate(data => {
      const card = data.cards.find(item => item.id === id);
      if (!card) throw new Error('Divine Card not found.');
      const slotPool = 'slotPool' in input ? slotOf(input.slotPool) : card.slotPool;
      if (data.presets.some(p => [...p.slots, ...p.swapOptions].some(item => item.cardId === id && item.slot !== slotPool))) {
        throw new Error('Remove this card from its current presets before changing its Slot pool.');
      }
      translated(card, { ...input, effect:input.effect ?? input.description, description:input.effect ?? input.description }, ['name', 'description', 'effect', 'note']);
      Object.assign(card, { slotPool, cardType:'cardType' in input ? typeOf(input.cardType) : card.cardType,
        displayOrder:Math.round(bounded(input.displayOrder, card.displayOrder, 0, 9999)),
        isActive:input.isActive ?? card.isActive });
    });
    return bundle(localeOf(input), true).cards.find(card => card.id === id);
  }
  function createCard(input) {
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/.exec(String(input.imageBase64 || ''));
    if (!match) throw new Error('Upload a PNG image.');
    const bytes = Buffer.from(match[1].replace(/\s/g, ''), 'base64');
    if (bytes.length < 100 || bytes.length > 2 * 1024 * 1024 || bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid PNG image (maximum 2 MB).');
    if (bytes.readUInt32BE(16) !== 288 || bytes.readUInt32BE(20) !== 352) throw new Error('Divine Card images must be exactly 288 × 352 pixels.');
    const slug = text(input.name || input.fileName, 80).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'divine-card';
    const id = `${slug}-${randomUUID().slice(0,8)}`;
    const imagePath = `assets/divine-cards/${id}.png`;
    buildAssetUrl(imagePath);
    fs.mkdirSync(assetDir, { recursive:true });
    const imageFile = path.join(assetDir, `${id}.png`);
    fs.writeFileSync(imageFile, bytes, { flag:'wx' });
    try {
      mutate(data => {
        const slotPool = slotOf(input.slotPool);
        const card = { id, imagePath, name:text(input.name, 120), effect:text(input.effect), description:text(input.effect), note:text(input.note),
          slotPool, cardType:typeOf(input.cardType), isActive:true,
          displayOrder:Math.max(0, ...data.cards.filter(item => item.slotPool === slotPool).map(item => item.displayOrder)) + 1,
          createdAt:now(), updatedAt:now(), translations:{} };
        translated(card, { ...input, description:input.effect }, ['name', 'description', 'effect', 'note']);
        data.cards.push(card);
      });
    } catch (error) { fs.unlinkSync(imageFile); throw error; }
    return bundle(localeOf(input), true).cards.find(card => card.id === id);
  }
  function savePreset(id, input) {
    if (!text(input.name, 140)) throw new Error('Preset name is required.');
    const savedId = mutate(data => {
      const old = id ? findPreset(data, id) : null;
      const chosen = new Set();
      const validateCard = (cardId, slot) => {
        const card = data.cards.find(item => item.id === cardId);
        if (!card?.isActive || !card.name || card.slotPool !== slot) throw new Error(`The card selected for Slot ${slot} is unavailable or belongs to another Slot.`);
        if (chosen.has(cardId)) throw new Error('The same Divine Card cannot be used twice in one preset.');
        chosen.add(cardId);
      };
      if (!Array.isArray(input.slots) || input.slots.length !== 3) throw new Error('Choose one card in each of Slot 1, Slot 2, and Slot 3.');
      const slots = [1,2,3].map(slot => {
        const items = input.slots.filter(item => Number(item.slot) === slot);
        if (items.length !== 1) throw new Error(`Choose exactly one core card for Slot ${slot}.`);
        const cardId = text(items[0].cardId, 120);
        validateCard(cardId, slot);
        return { slot, cardId };
      });
      const rawSwaps = Array.isArray(input.swapOptions) ? input.swapOptions : [];
      const fixed = input.situationalSlots && typeof input.situationalSlots === 'object' && !Array.isArray(input.situationalSlots);
      const candidates = fixed ? SITUATIONAL_POSITIONS.map(position => ({ ...position, cardId:input.situationalSlots[position.cardNumber] })) : rawSwaps;
      const used = new Set();
      const swapOptions = candidates.filter(item => item.cardId).map(item => {
        const slot = slotOf(item.slot);
        const priority = Number(item.priority);
        if (!slot || ![1,2].includes(priority) || used.has(`${slot}:${priority}`)) throw new Error('Invalid or duplicate situation card position.');
        used.add(`${slot}:${priority}`);
        const cardId = text(item.cardId, 120);
        validateCard(cardId, slot);
        const copy = rawSwaps.find(value => Number(value.slot) === slot && Number(value.priority) === priority && value.cardId === cardId);
        const previous = old?.swapOptions.find(value => value.slot === slot && value.priority === priority && value.cardId === cardId);
        return { slot, priority, cardId, note:text(copy?.note ?? previous?.note ?? '', 1000) };
      }).sort((a,b) => a.slot - b.slot || a.priority - b.priority);
      const preset = old || { id:Math.max(0, ...data.presets.map(item => item.id)) + 1, name:text(input.name, 140), description:text(input.description), scenario:text(input.scenario),
        sourceKey:'', createdAt:now(), heroAssignments:[], translations:{} };
      translated(preset, input, ['name', 'description', 'scenario']);
      Object.assign(preset, { slots, swapOptions,
        energyThreshold:Math.round(bounded(input.energyThreshold, preset.energyThreshold ?? 100, 1, 100000)),
        energyRate:bounded(input.energyRate, preset.energyRate ?? 1, 0.01, 1000) });
      if (!old) data.presets.push(preset);
      return preset.id;
    });
    return bundle(localeOf(input), true).presets.find(preset => preset.id === savedId);
  }
  function promoteDefault(data, heroId) {
    const assignments = data.presets.flatMap(p => p.heroAssignments.filter(item => item.heroId === heroId));
    if (assignments.length && !assignments.some(item => item.isDefault)) assignments[0].isDefault = true;
  }
  function deletePreset(id) {
    mutate(data => {
      const preset = findPreset(data, id);
      data.presets = data.presets.filter(item => item !== preset);
      preset.heroAssignments.forEach(item => promoteDefault(data, item.heroId));
    });
  }
  function assignPreset(input) {
    mutate(data => {
      const preset = findPreset(data, input.presetId);
      const heroIds = [...new Set(Array.isArray(input.heroIds) ? input.heroIds : [])];
      if (!heroIds.length || !heroIds.every(id => /^\d{4}$/.test(id) && Number(id) >= 1 && Number(id) <= 41)) throw new Error('Choose a valid hero.');
      for (const heroId of heroIds) {
        if (input.action === 'unassign') {
          preset.heroAssignments = preset.heroAssignments.filter(item => item.heroId !== heroId);
          promoteDefault(data, heroId);
        } else {
          if (input.makeDefault === true) for (const other of data.presets) for (const assignment of other.heroAssignments) if (assignment.heroId === heroId) assignment.isDefault = false;
          const assignment = preset.heroAssignments.find(item => item.heroId === heroId);
          if (assignment) assignment.isDefault = input.makeDefault === true;
          else preset.heroAssignments.push({ heroId, isDefault:input.makeDefault === true, assignedAt:now() });
          promoteDefault(data, heroId);
        }
      }
      preset.updatedAt = now();
    });
    return bundle(localeOf(input), true).presets.find(preset => preset.id === Number(input.presetId));
  }
  return { read, publicBundle:locale => bundle(locale), adminBundle:locale => bundle(locale, true), updateCard, createCard, savePreset, deletePreset, assignPreset };
}

export const store = createBuildStore();

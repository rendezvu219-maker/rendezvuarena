import fs from 'node:fs';

import { HEROES_DATA } from '../../js/heroes-data.js';
import { OFFICIAL_LOCALES } from './official-hero-catalog.mjs';

const defaultOverridesUrl = new URL('../../data/locales/in-game-hero-overrides.json', import.meta.url);

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}


export function loadInGameHeroOverrides(fileUrl = defaultOverridesUrl) {
  return JSON.parse(fs.readFileSync(fileUrl, 'utf8'));
}

export function validateInGameHeroOverrides(overrides) {
  const errors = [];
  if (overrides?.schemaVersion !== 1) errors.push(`schemaVersion must be 1, found ${overrides?.schemaVersion ?? 'missing'}.`);
  const locales = overrides?.locales || {};

  for (const [locale, records] of Object.entries(locales)) {
    if (!OFFICIAL_LOCALES.includes(locale)) {
      errors.push(`${locale}: in-game overrides are only supported for official locales (${OFFICIAL_LOCALES.join(', ')}).`);
      continue;
    }
    for (const [heroId, record] of Object.entries(records || {})) {
      const source = HEROES_DATA[heroId];
      if (!source) {
        errors.push(`${locale}.${heroId}: unknown hero id.`);
        continue;
      }
      if (record.officialName != null && !nonEmpty(record.officialName)) errors.push(`${locale}.${heroId}: officialName is blank.`);
      if (!Array.isArray(record.verification) || !record.verification.length) errors.push(`${locale}.${heroId}: at least one verification record is required.`);
      for (const [index, verification] of (record.verification || []).entries()) {
        if (verification?.source !== 'released-game-client') errors.push(`${locale}.${heroId}.verification[${index}]: source must be released-game-client.`);
        if (verification?.sourceMediaBundled !== false) errors.push(`${locale}.${heroId}.verification[${index}]: sourceMediaBundled must be false for the public package.`);
        if (!Array.isArray(verification?.verifiedFields) || !verification.verifiedFields.length) errors.push(`${locale}.${heroId}.verification[${index}]: verifiedFields is empty.`);
      }
      const skillIds = new Set(source.skills.map(skill => skill.id));
      for (const [skillId, patch] of Object.entries(record.skills || {})) {
        if (!skillIds.has(skillId)) {
          errors.push(`${locale}.${heroId}.${skillId}: unknown skill id.`);
          continue;
        }
        if (patch.name != null && !nonEmpty(patch.name)) errors.push(`${locale}.${heroId}.${skillId}: name is blank.`);
        if (patch.desc != null && typeof patch.desc !== 'string') errors.push(`${locale}.${heroId}.${skillId}: desc must be a string.`);
        if (patch.name == null && patch.desc == null) errors.push(`${locale}.${heroId}.${skillId}: override has no name or description.`);
      }
      if (!record.officialName && !Object.keys(record.skills || {}).length) errors.push(`${locale}.${heroId}: override has no fields.`);
    }
  }

  if (errors.length) {
    const error = new Error(`In-game hero override validation failed:\n- ${errors.join('\n- ')}`);
    error.validationErrors = errors;
    throw error;
  }
  return { localeCount: Object.keys(locales).length, recordCount: Object.values(locales).reduce((sum, records) => sum + Object.keys(records || {}).length, 0) };
}

export function applyInGameHeroOverride(snapshot, locale, heroId, overrides = loadInGameHeroOverrides()) {
  const patch = overrides?.locales?.[locale]?.[heroId];
  if (!patch) return structuredClone(snapshot);
  const next = structuredClone(snapshot);
  if (patch.officialName) next.officialName = patch.officialName;
  next.skills ||= {};
  for (const [skillId, skillPatch] of Object.entries(patch.skills || {})) {
    const merged = { ...(next.skills[skillId] || {}) };
    if (Object.hasOwn(skillPatch, 'name')) merged.name = skillPatch.name;
    if (Object.hasOwn(skillPatch, 'desc')) {
      merged.desc = skillPatch.desc;
      if (String(skillPatch.desc).trim()) delete merged.officialEmpty;
    }
    merged.verificationStatus = 'in-game-verified';
    next.skills[skillId] = merged;
  }
  next.translationStatus = 'official-site+in-game-verified';
  delete next.inGameEvidence;
  next.inGameVerification = (patch.verification || []).map(item => ({
    source: item.source,
    sourceMediaBundled: false,
    verifiedFields: [...item.verifiedFields],
  }));
  return next;
}

export function applyInGameHeroOverridesToCatalog(catalog, overrides = loadInGameHeroOverrides()) {
  validateInGameHeroOverrides(overrides);
  const next = structuredClone(catalog);
  for (const [locale, records] of Object.entries(overrides.locales || {})) {
    for (const heroId of Object.keys(records || {})) {
      const snapshot = next.locales?.[locale]?.[heroId];
      if (!snapshot) continue;
      next.locales[locale][heroId] = applyInGameHeroOverride(snapshot, locale, heroId, overrides);
    }
  }
  next.policy = 'Verified localized hero records may combine official-site snapshots with exact fields manually checked in the released game client. Temporary verification media is not distributed; only the reviewed fields and source type are retained. Synthetic text is forbidden.';
  return next;
}

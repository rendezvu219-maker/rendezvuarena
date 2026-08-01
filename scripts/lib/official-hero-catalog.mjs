import fs from 'node:fs';
import { HEROES_DATA } from '../../js/heroes-data.js';

export const OFFICIAL_LOCALES = Object.freeze(['ja', 'zh-CN', 'ko', 'es']);
export const EDITORIAL_LOCALES = Object.freeze(['vi']);
export const HERO_DETAIL_LOCALES = Object.freeze([...OFFICIAL_LOCALES, ...EDITORIAL_LOCALES]);

export function loadHeroI18nCatalog(fileUrl = new URL('../../data/locales/official-hero-details.json', import.meta.url)) {
  return JSON.parse(fs.readFileSync(fileUrl, 'utf8'));
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function validateHeroI18nCatalog(catalog, { requireFullOfficial = false, requireFullVietnamese = false } = {}) {
  const errors = [];
  if (catalog?.schemaVersion !== 2) errors.push(`schemaVersion must be 2, found ${catalog?.schemaVersion ?? 'missing'}.`);
  const heroIds = Object.keys(HEROES_DATA).sort();
  const locales = catalog?.locales || {};

  for (const locale of HERO_DETAIL_LOCALES) {
    const records = locales[locale] || {};
    for (const [heroId, record] of Object.entries(records)) {
      const source = HEROES_DATA[heroId];
      if (!source) {
        errors.push(`${locale}.${heroId}: unknown hero id.`);
        continue;
      }
      const allowedStatuses = OFFICIAL_LOCALES.includes(locale)
        ? new Set(['official-site-snapshot', 'official-site+in-game-verified'])
        : new Set(['editor-reviewed']);
      if (!allowedStatuses.has(record?.translationStatus)) {
        errors.push(`${locale}.${heroId}: translationStatus must be one of ${[...allowedStatuses].join(', ')}.`);
      }
      if (record?.translationStatus === 'official-site+in-game-verified' && !record?.inGameEvidence?.length) {
        errors.push(`${locale}.${heroId}: in-game-verified records require inGameEvidence.`);
      }
      if (OFFICIAL_LOCALES.includes(locale) && !/^https:\/\/dbg-squadra\.bn-ent\.net\//.test(record?.sourceUrl || '')) {
        errors.push(`${locale}.${heroId}: an official sourceUrl is required.`);
      }
      if (OFFICIAL_LOCALES.includes(locale) && !nonEmpty(record?.officialName)) errors.push(`${locale}.${heroId}: officialName is blank.`);
      if (locale === 'vi') {
        if (record?.sourceLocale !== 'zh-CN') errors.push(`${locale}.${heroId}: sourceLocale must be zh-CN.`);
        if (!nonEmpty(record?.officialName)) errors.push(`${locale}.${heroId}: English display name is blank.`);
        const vietnameseText = JSON.stringify({ description: record?.description, skills: record?.skills });
        if (/anh hùng|\btướng\b/iu.test(vietnameseText)) {
          errors.push(`${locale}.${heroId}: use “chiến binh”, not “anh hùng” or “tướng”.`);
        }
      }
      if (!nonEmpty(record?.description)) errors.push(`${locale}.${heroId}: description is blank.`);
      const expectedSkillIds = source.skills.map(skill => skill.id).sort();
      const actualSkillIds = Object.keys(record?.skills || {}).sort();
      if (JSON.stringify(actualSkillIds) !== JSON.stringify(expectedSkillIds)) {
        errors.push(`${locale}.${heroId}: skill ids do not match canonical data. Expected ${expectedSkillIds.join(', ')}, found ${actualSkillIds.join(', ')}.`);
      }
      for (const skillId of expectedSkillIds) {
        const skill = record?.skills?.[skillId];
        if (!nonEmpty(skill?.name)) errors.push(`${locale}.${heroId}.${skillId}: name is blank.`);
        const allowsOfficialEmpty = OFFICIAL_LOCALES.includes(locale) && skill?.officialEmpty === true;
        if (!nonEmpty(skill?.desc) && !allowsOfficialEmpty) {
          errors.push(`${locale}.${heroId}.${skillId}: description is blank without officialEmpty=true.`);
        }
        if (allowsOfficialEmpty && nonEmpty(skill?.desc)) {
          errors.push(`${locale}.${heroId}.${skillId}: officialEmpty=true is only valid for an empty official description.`);
        }
        if (skill?.verificationStatus && skill.verificationStatus !== 'in-game-verified') {
          errors.push(`${locale}.${heroId}.${skillId}: unknown verificationStatus ${skill.verificationStatus}.`);
        }
      }
      const serialized = JSON.stringify(record);
      if (/draft-native-review-required|mechanics-preserving|sourceName|"review"\s*:/i.test(serialized)) {
        errors.push(`${locale}.${heroId}: synthetic/review-placeholder fields are forbidden.`);
      }
    }

    const requireFull = OFFICIAL_LOCALES.includes(locale) ? requireFullOfficial : requireFullVietnamese;
    if (requireFull) {
      const missing = heroIds.filter(id => !records[id]);
      if (missing.length) errors.push(`${locale}: missing ${missing.length} hero snapshots (${missing.join(', ')}).`);
    }
  }

  if (errors.length) {
    const error = new Error(`Hero i18n catalog validation failed:\n- ${errors.join('\n- ')}`);
    error.validationErrors = errors;
    throw error;
  }

  const coverage = Object.fromEntries(HERO_DETAIL_LOCALES.map(locale => [locale, Object.keys(locales[locale] || {}).length]));
  return { heroCount: heroIds.length, coverage };
}

export function compiledOverrides(catalog) {
  // The browser bundle contains only display data and trust status. Provenance URLs
  // stay in the build-time source catalog so the runtime remains fully local.
  return Object.fromEntries(HERO_DETAIL_LOCALES.map(locale => [
    locale,
    Object.fromEntries(Object.entries(catalog.locales?.[locale] || {}).map(([heroId, record]) => {
      const {
        sourceUrl: _sourceUrl,
        officialName: _officialName,
        inGameEvidence: _inGameEvidence,
        sourceLocale: _sourceLocale,
        sourcePolicy: _sourcePolicy,
        ...runtimeRecord
      } = record;
      return [heroId, runtimeRecord];
    })),
  ]));
}

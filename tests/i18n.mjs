import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import {
  EN_HERO_NAMES,
  HERO_DETAIL_OVERRIDES,
  HERO_NAMES,
  LOCALES,
  UI,
  getLocale,
  heroName,
  localizeHeroDetail,
  setLocale,
  t,
  translateSourceText,
} from '../js/i18n.js';
import { PAGE_UI } from '../js/i18n-ui-pages.js';
import { HERO_I18N_METADATA } from '../js/i18n-hero-details.js';
import { LOCALIZED_HERO_NAMES } from '../js/i18n-hero-names.js';
import { parseOfficialHeroHtml, parseOfficialHeroText } from '../scripts/lib/official-hero-page-parser.mjs';
import { loadHeroI18nCatalog, validateHeroI18nCatalog } from '../scripts/lib/official-hero-catalog.mjs';
import { applyInGameHeroOverride, applyInGameHeroOverridesToCatalog, loadInGameHeroOverrides, validateInGameHeroOverrides } from '../scripts/lib/in-game-hero-overrides.mjs';
import { HEROES_DATA } from '../js/heroes-data.js';
import { HEROES } from '../js/heroes.js';
import { auditClientSourceI18n } from '../scripts/audit-i18n.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const locales = ['en', 'ja', 'zh-CN', 'ko', 'es', 'vi'];
const translatedLocales = locales.filter(locale => locale !== 'en');

// Locale catalog contract ----------------------------------------------------
assert.deepEqual(Object.keys(LOCALES), locales, 'The public locale order/contract changed unexpectedly.');
const basePageKeys = Object.keys(PAGE_UI.en).sort();
assert.ok(basePageKeys.length >= 620, `Expected the complete page catalog, found only ${basePageKeys.length} keys.`);
for (const locale of locales) {
  assert.deepEqual(Object.keys(PAGE_UI[locale] || {}).sort(), basePageKeys, `${locale} is missing page UI keys.`);
  for (const key of basePageKeys) assert.ok(String(PAGE_UI[locale][key]).trim(), `${locale}.${key} is blank.`);
}
const vietnameseUiText = JSON.stringify({ base: UI.vi, pages: PAGE_UI.vi });
assert.doesNotMatch(vietnameseUiText, /anh hùng|\btướng\b/iu, 'Vietnamese UI must consistently use “chiến binh”.');
assert.match(PAGE_UI.vi.pageTitleHeroes, /Chiến binh/);
assert.equal(UI.vi.heroes, 'Chiến binh');

// Hero names + source-authenticated hero details -----------------------------
const heroIds = HEROES.map(hero => hero.id).sort();
assert.equal(heroIds.length, 39, 'Expected the full 39-hero roster.');
assert.deepEqual(Object.keys(EN_HERO_NAMES).sort(), heroIds, 'English hero-name catalog is incomplete.');
for (const locale of ['ja', 'zh-CN', 'ko', 'es']) {
  assert.deepEqual(Object.keys(HERO_NAMES[locale] || {}).sort(), heroIds, `${locale} hero-name catalog is incomplete.`);
}
for (const locale of ['ja', 'zh-CN', 'ko', 'es']) {
  assert.deepEqual(HERO_NAMES[locale], LOCALIZED_HERO_NAMES[locale], `${locale} runtime hero names are stale.`);
}
for (const hero of HEROES) assert.equal(heroName(hero.id, hero.name, 'vi'), hero.name, `Vietnamese must keep the English hero name for ${hero.id}.`);

const vietnameseCatalog = JSON.parse(read('data/locales/official-hero-details.json')).locales.vi || {};
assert.deepEqual(Object.keys(vietnameseCatalog).sort(), heroIds, 'Vietnamese hero-detail catalog must cover all 39 heroes.');
let vietnameseSkillCount = 0;
for (const hero of HEROES) {
  const record = vietnameseCatalog[hero.id];
  assert.equal(record.officialName, hero.name, `Vietnamese must keep the English hero name for ${hero.id}.`);
  assert.equal(record.translationStatus, 'editor-reviewed', `Vietnamese ${hero.id} must be editor-reviewed.`);
  assert.equal(record.sourceLocale, 'zh-CN', `Vietnamese ${hero.id} must be translated from the official Simplified Chinese record.`);
  assert.doesNotMatch(JSON.stringify({ description: record.description, skills: record.skills }), /anh hùng|\btướng\b/iu, `Vietnamese ${hero.id} must use “chiến binh”.`);
  vietnameseSkillCount += Object.keys(record.skills || {}).length;
}
assert.equal(vietnameseSkillCount, 252, 'Vietnamese catalog must translate all 252 skills.');
const vietnameseSkillMaster = JSON.parse(read('data/locales/vi-skill-name-master.json'));
assert.equal(vietnameseSkillMaster.schemaVersion, 1);
assert.equal(vietnameseSkillMaster.status, 'user-approved');
assert.equal(vietnameseSkillMaster.skills.length, 207, 'Vietnamese skill-name Master must contain 207 unique names.');
const approvedVietnameseSkillNames = new Map(vietnameseSkillMaster.skills.map(row => [row.english, row.vietnamese]));
assert.equal(approvedVietnameseSkillNames.size, 207, 'Vietnamese skill-name Master contains duplicate English names.');
let approvedVietnameseSkillSlots = 0;
for (const [heroId, sourceHero] of Object.entries(HEROES_DATA)) {
  for (const sourceSkill of sourceHero.skills) {
    const approvedName = approvedVietnameseSkillNames.get(sourceSkill.name);
    assert.ok(approvedName, `Vietnamese Master is missing ${sourceSkill.name}.`);
    assert.equal(vietnameseCatalog[heroId].skills[sourceSkill.id].name, approvedName, `Vietnamese Master was not applied to ${heroId}.${sourceSkill.id}.`);
    approvedVietnameseSkillSlots += 1;
  }
}
assert.equal(approvedVietnameseSkillSlots, 252, 'Vietnamese Master must cover all 252 skill slots.');
assert.equal(vietnameseCatalog['0001'].skills.skill1.name, 'Kamehameha');
assert.equal(vietnameseCatalog['0001'].skills.super_attack1.name, 'Quả Cầu Khinh Khí');
assert.match(vietnameseCatalog['0015'].skills.rush_attack1.desc, /số lượng khí đạn/i);
assert.equal(vietnameseCatalog['0039'].skills.passive1.name, 'Con Đường Thành Thần');

const sourceHeroNames = JSON.parse(read('data/locales/hero-names.json'));
for (const locale of ['ja', 'zh-CN', 'ko', 'es']) assert.deepEqual(HERO_NAMES[locale], sourceHeroNames[locale], `${locale} generated hero-name module is stale.`);
const heroCatalog = loadHeroI18nCatalog();
const inGameOverrides = loadInGameHeroOverrides();
const overrideValidation = validateInGameHeroOverrides(inGameOverrides);
const officialSyncSource = read('scripts/sync-official-hero-i18n.mjs');
assert.match(officialSyncSource, /applyInGameHeroOverride/, 'Official sync must reapply exact in-game verification after every website fetch.');
assert.match(officialSyncSource, /data\/locales\/fixtures\/live/, 'Saved live fixtures must remain available for offline retry regression tests.');
assert.equal(overrideValidation.recordCount, 2, 'Expected the two retained in-game verification records.');
const effectiveHeroCatalog = applyInGameHeroOverridesToCatalog(heroCatalog, inGameOverrides);
const catalogValidation = validateHeroI18nCatalog(effectiveHeroCatalog);
for (const locale of ['ja', 'zh-CN', 'ko', 'es']) {
  for (const [heroId, record] of Object.entries(effectiveHeroCatalog.locales?.[locale] || {})) {
    assert.equal(sourceHeroNames[locale]?.[heroId], record.officialName, `${locale}.${heroId} name catalog does not match the official page snapshot.`);
  }
}
assert.deepEqual(HERO_I18N_METADATA.coverage, catalogValidation.coverage, 'Compiled hero i18n coverage is stale.');
const compiledHeroText = read('js/i18n-hero-details.js');
assert.doesNotMatch(compiledHeroText, /draft-native-review-required|mechanics-preserving drafts|sourceName|"review"\s*:/i, 'Synthetic hero translations must never ship.');
assert.doesNotMatch(read('scripts/generate-hero-i18n.mjs'), /function\s+(?:summary|heroDescription)\s*\(/, 'The old heuristic translation generator returned.');

for (const locale of translatedLocales) {
  const overrides = HERO_DETAIL_OVERRIDES[locale] || {};
  for (const [heroId, translated] of Object.entries(overrides)) {
    const source = HEROES_DATA[heroId];
    assert.ok(source, `${locale}.${heroId} references an unknown hero.`);
    const expectedStatuses = locale === 'vi'
      ? new Set(['editor-reviewed'])
      : new Set(['official-site-snapshot', 'official-site+in-game-verified']);
    assert.ok(expectedStatuses.has(translated.translationStatus), `${locale}.${heroId} has an untrusted translation status: ${translated.translationStatus}.`);
    if (locale !== 'vi') assert.equal(Object.hasOwn(translated, 'sourceUrl'), false, `${locale}.${heroId} must not ship a remote source URL in the browser bundle.`);
    assert.deepEqual(Object.keys(translated.skills || {}).sort(), source.skills.map(skill => skill.id).sort(), `${locale}.${heroId} skill ids do not match canonical data.`);
    const rendered = localizeHeroDetail(HEROES.find(hero => hero.id === heroId), source, locale);
    assert.equal(rendered.translationComplete, true, `${locale}.${heroId} should be marked translated.`);
  }
}

// Regression fixture: the cited official Spanish Goku Black page must be verbatim.
const officialEs0039 = HERO_DETAIL_OVERRIDES.es?.['0039'];
assert.ok(officialEs0039, 'The official Spanish Goku Black snapshot is missing.');
assert.equal(officialEs0039.description, 'Un héroe oscuro que combate generando áreas ventajosas para sí mismo.\n¡Debilita al enemigo, restringe su movimiento y toma el control del frente de combate creando tu zona ideal!');
assert.equal(officialEs0039.skills.passive1.name, 'Camino para ser un Dios');
assert.equal(officialEs0039.skills.skill1.name, 'Kamehameha Oscuro');
assert.equal(officialEs0039.skills.skill2.name, 'Ruptura Oscura');
assert.equal(officialEs0039.skills.skill3.name, 'Enlace Oscuro');
assert.equal(officialEs0039.skills.super_attack1.name, 'Bola de Poder Oscuro');
assert.match(officialEs0039.skills.skill3.desc, /El área que explotó desaparecerá/);
assert.equal(Object.hasOwn(officialEs0039, 'sourceUrl'), false, 'Runtime hero records must remain local-only.');
const sourceEs0039 = effectiveHeroCatalog.locales.es['0039'];
assert.equal(sourceEs0039.sourceUrl, 'https://dbg-squadra.bn-ent.net/es/hero/0039');

const parsedEsFixture = parseOfficialHeroText({
  text: read('data/locales/fixtures/es-0039.txt'),
  locale: 'es',
  heroId: '0039',
  heroName: 'Goku Oscuro',
  sourceDetail: HEROES_DATA['0039'],
  sourceUrl: sourceEs0039.sourceUrl,
});
assert.deepEqual(parsedEsFixture, sourceEs0039, 'Official page parser no longer reproduces the checked Spanish snapshot.');

assert.equal(parsedEsFixture.officialName, 'Goku Oscuro');

// Regression: stale local hero-name spellings must not abort an otherwise valid official page.
// Regression: empty duplicate/navigation type markers must be skipped in favor of the next
// complete official skill block (observed on Full Power Bojack 0015 in Korean/Spanish).
const duplicateMarkerFixture = [
  'Bojack máximo poder',
  'Dificultad',
  'Un héroe que domina el campo mediante tácticas de grupo y poderosas explosiones de ki.',
  '¡Dirige a tus subordinados y destruye a todos los enemigos que se interpongan!',
  'Técnica',
  '[[IMG:PASIVA]]',
  'Asesino galáctico',
  'Cuando una arremetida golpea a un enemigo dañado por tus técnicas, los subordinados realizan un ataque adicional.',
  '[[IMG:ARREMETIDA]]',
  '[[IMG:TÉCNICA]]',
  '[[IMG:ARREMETIDA]]',
  'Dispara balas de ki.',
  'La cantidad de disparos aumenta al usar el ataque de forma consecutiva.',
  '[[IMG:TÉCNICA]]',
  'Destructor galáctico',
  'Dispara dos balas de ki que explotan al impactar.',
  '[[IMG:TÉCNICA]]',
  'Floración cósmica',
  'Esparce orbes de ki que explotan al recibir un ataque de energía o al pasar cierto tiempo.',
  '[[IMG:TÉCNICA]]',
  'Hilo psíquico',
  'Invoca a los subordinados y extiende hilos de energía que dañan a los enemigos.',
  '[[IMG:TÉCNICA ESPECIAL]]',
  'Gran impacto gigante',
  'Los subordinados disparan cinco balas de ki que convergen en el centro.',
  '[[IMG:TRANSFORMACIÓN]]',
  'Máximo poder',
  'Puede transformarse al alcanzar el nivel 7 y mejora los ataques adicionales de sus subordinados.',
  '[[IMG:SELECCIÓN DE HÉROE]]',
].join('\n');
const parsedDuplicateMarker = parseOfficialHeroText({
  text: duplicateMarkerFixture,
  locale: 'es',
  heroId: '0015',
  heroName: 'Bojack de poder completo', // intentionally stale/wrong catalog value
  sourceDetail: HEROES_DATA['0015'],
  sourceUrl: 'https://dbg-squadra.bn-ent.net/es/hero/0015',
});
assert.equal(parsedDuplicateMarker.officialName, 'Bojack máximo poder');
assert.match(parsedDuplicateMarker.skills.rush_attack1.desc, /cantidad de disparos/i);
assert.equal(parsedDuplicateMarker.skills.skill1.name, 'Destructor galáctico');


// Regression: Full Power Bojack 0015 has localized pages where the detailed Rush
// block may expose the canonical image alt (rush_attack1) instead of the localized
// type label. Navigation copies of the same id are empty and must still be ignored.
const idMarkerFixtures = {
  es: [
    'Bojack máximo poder', 'Dificultad',
    'Un héroe que domina el campo mediante tácticas de grupo y poderosas explosiones de ki.',
    '¡Dirige a sus cuatro subordinados y elimina a todos los enemigos de la galaxia!',
    'Técnica',
    '[[IMG:passive1]]', '[[IMG:rush_attack1]]', '[[IMG:skill1]]', '[[IMG:skill2]]', '[[IMG:skill3]]', '[[IMG:super_attack1]]', '[[IMG:transformation1]]',
    '[[IMG:PASIVA]]', 'Asesino estelar',
    'Si usa una Arremetida contra un enemigo dañado por sus técnicas, sus subordinados realizan un ataque adicional.',
    '[[IMG:rush_attack1]]',
    'Dispara balas de ki.', 'La cantidad de disparos aumenta al usar el ataque de forma consecutiva.',
    '[[IMG:TÉCNICA]]', 'Destrozo galáctico', 'Dispara dos balas de ki que explotan al impactar.',
    '[[IMG:TÉCNICA]]', 'Resplandor cósmico', 'Esparce orbes de ki que explotan al recibir un ataque de energía o tras cierto tiempo.',
    '[[IMG:TÉCNICA]]', 'Hilo psíquico', 'Invoca a sus subordinados y extiende hilos de energía que dañan a los enemigos.',
    '[[IMG:TÉCNICA ESPECIAL]]', 'Gigagolpe aplastante', 'Sus subordinados disparan cinco balas de ki que convergen en el centro.',
    '[[IMG:TRANSFORMACIÓN]]', 'Máximo poder', 'Puede transformarse al alcanzar el nivel 7 y mejora los ataques adicionales de sus subordinados.',
    '[[IMG:SELECCIÓN DE HÉROE]]',
  ].join('\n'),
  ko: [
    '풀 파워 보자크', '난이도',
    '강력한 기탄과 폭발로 전장을 지배하며 집단 전술에 특화된 히어로입니다.',
    '네 명의 부하를 지휘하여 집중 포화를 퍼붓고 은하의 적을 모두 쓰러뜨리세요!',
    '스킬',
    '[[IMG:passive1]]', '[[IMG:rush_attack1]]', '[[IMG:skill1]]', '[[IMG:skill2]]', '[[IMG:skill3]]', '[[IMG:super_attack1]]', '[[IMG:transformation1]]',
    '[[IMG:패시브]]', '은하의 암살자',
    '스킬로 피해를 준 적에게 러시 공격을 사용하면 부하가 추가 공격을 합니다.',
    '러시 공격',
    '기탄을 연속으로 발사합니다.', '연속해서 사용할수록 발사되는 기탄의 수가 증가합니다.',
    '[[IMG:스킬]]', '갤럭틱 버스터', '명중하면 폭발하는 기탄 두 발을 발사합니다.',
    '[[IMG:스킬]]', '코스믹 블룸', '기 공격을 받거나 일정 시간이 지나면 폭발하는 기탄을 흩뿌립니다.',
    '[[IMG:스킬]]', '사이코 스레드', '부하를 불러 에너지 실을 내보내고 범위 안의 적에게 피해를 줍니다.',
    '[[IMG:필살기]]', '기가 그랜드 스매셔', '부하들과 함께 다섯 발의 기탄을 발사하여 중앙에 집결시킵니다.',
    '[[IMG:변신]]', '풀 파워', '레벨 7에 도달하면 변신할 수 있으며 부하의 추가 공격 피해가 강화됩니다.',
    '[[IMG:히어로 선택]]',
  ].join('\n'),
};
for (const locale of ['es', 'ko']) {
  const parsed = parseOfficialHeroText({
    text: idMarkerFixtures[locale], locale, heroId: '0015',
    heroName: sourceHeroNames[locale]['0015'], sourceDetail: HEROES_DATA['0015'],
    sourceUrl: `https://dbg-squadra.bn-ent.net/${locale === 'ko' ? 'ko' : 'es'}/hero/0015`,
  });
  assert.match(parsed.skills.rush_attack1.desc, locale === 'es' ? /cantidad de disparos/i : /기탄의 수/);
  assert.ok(parsed.skills.skill1.name.length > 2, `${locale}.0015 skill1 was shifted into the Rush block.`);
}


// Compatibility regression for older/localized templates where Rush paragraphs
// can be present without a usable detail marker. Preserve those exact paragraphs
// without inventing text.
const implicitRushFixtures = {
  es: [
    'Bojack máximo poder', 'Dificultad',
    'Un héroe que domina el campo mediante tácticas de grupo y poderosas explosiones de ki.',
    '¡Dirige a sus cuatro subordinados y elimina a todos los enemigos de la galaxia!',
    'Técnica',
    '[[IMG:passive1]]', '[[IMG:rush_attack1]]', '[[IMG:skill1]]', '[[IMG:skill2]]', '[[IMG:skill3]]', '[[IMG:super_attack1]]', '[[IMG:transformation1]]',
    '[[IMG:PASIVA]]', 'Asesino estelar',
    'Si usa una Arremetida contra un enemigo dañado por sus técnicas, sus subordinados realizan un ataque adicional.',
    // Rush icon has no alt in the live page, so only its localized paragraphs remain.
    'Dispara balas de ki.', 'La cantidad de disparos aumenta al usar el ataque de forma consecutiva.',
    '[[IMG:TÉCNICA]]', 'Destrozo galáctico', 'Dispara dos balas de ki que explotan al impactar.',
    '[[IMG:TÉCNICA]]', 'Resplandor cósmico', 'Esparce orbes de ki que explotan al recibir un ataque de energía o tras cierto tiempo.',
    '[[IMG:TÉCNICA]]', 'Hilo psíquico', 'Invoca a sus subordinados y extiende hilos de energía que dañan a los enemigos.',
    '[[IMG:TÉCNICA ESPECIAL]]', 'Gigagolpe aplastante', 'Sus subordinados disparan cinco balas de ki que convergen en el centro.',
    '[[IMG:TRANSFORMACIÓN]]', 'Máximo poder', 'Puede transformarse al alcanzar el nivel 7 y mejora los ataques adicionales de sus subordinados.',
    '[[IMG:SELECCIÓN DE HÉROE]]',
  ].join('\n'),
  ko: [
    '풀 파워 보자크', '난이도',
    '강력한 기탄과 폭발로 전장을 지배하며 집단 전술에 특화된 히어로입니다.',
    '네 명의 부하를 지휘하여 집중 포화를 퍼붓고 은하의 적을 모두 쓰러뜨리세요!',
    '스킬',
    '[[IMG:passive1]]', '[[IMG:rush_attack1]]', '[[IMG:skill1]]', '[[IMG:skill2]]', '[[IMG:skill3]]', '[[IMG:super_attack1]]', '[[IMG:transformation1]]',
    '[[IMG:패시브]]', '은하의 암살자',
    '스킬로 피해를 준 적에게 러시 공격을 사용하면 부하가 추가 공격을 합니다.',
    '기탄을 연속으로 발사합니다.', '연속해서 사용할수록 발사되는 기탄의 수가 증가합니다.',
    '[[IMG:스킬]]', '갤럭틱 버스터', '명중하면 폭발하는 기탄 두 발을 발사합니다.',
    '[[IMG:스킬]]', '코스믹 블룸', '기 공격을 받거나 일정 시간이 지나면 폭발하는 기탄을 흩뿌립니다.',
    '[[IMG:스킬]]', '사이코 스레드', '부하를 불러 에너지 실을 내보내고 범위 안의 적에게 피해를 줍니다.',
    '[[IMG:필살기]]', '기가 그랜드 스매셔', '부하들과 함께 다섯 발의 기탄을 발사하여 중앙에 집결시킵니다.',
    '[[IMG:변신]]', '풀 파워', '레벨 7에 도달하면 변신할 수 있으며 부하의 추가 공격 피해가 강화됩니다.',
    '[[IMG:히어로 선택]]',
  ].join('\n'),
};
for (const locale of ['es', 'ko']) {
  const parsed = parseOfficialHeroText({
    text: implicitRushFixtures[locale], locale, heroId: '0015',
    heroName: sourceHeroNames[locale]['0015'], sourceDetail: HEROES_DATA['0015'],
    sourceUrl: `https://dbg-squadra.bn-ent.net/${locale}/hero/0015`,
  });
  assert.equal(parsed.skills.passive1.desc.split('\n').length, 1, `${locale}.0015 implicit Rush leaked into passive1.`);
  assert.match(parsed.skills.rush_attack1.desc, locale === 'es' ? /cantidad de disparos/i : /기탄의 수/);
  assert.equal(parsed.skills.skill1.name, locale === 'es' ? 'Destrozo galáctico' : '갤럭틱 버스터');
}


// Same regression through raw HTML: an empty-alt Rush image must not cause the
// official localized paragraphs to disappear from the parsed result.
const esImplicitRushHtml = `<main>${implicitRushFixtures.es.split('\n').map(line => {
  const marker = /^\[\[IMG:(.*)\]\]$/.exec(line);
  if (!marker) return `<p>${line}</p>`;
  if (marker[1] === 'PASIVA') return '<img alt="PASIVA">';
  if (marker[1] === 'TÉCNICA') return '<img alt="TÉCNICA">';
  if (marker[1] === 'TÉCNICA ESPECIAL') return '<img alt="TÉCNICA ESPECIAL">';
  if (marker[1] === 'TRANSFORMACIÓN') return '<img alt="TRANSFORMACIÓN">';
  if (marker[1] === 'SELECCIÓN DE HÉROE') return '<img alt="SELECCIÓN DE HÉROE">';
  if (marker[1] === 'rush_attack1' && line === '[[IMG:rush_attack1]]') return '<img alt="rush_attack1">';
  return `<img alt="${marker[1]}">`;
}).join('')}</main>`
  // Replace the detailed Rush marker with the actual problematic shape.
  .replace('<img alt="PASIVA"><p>Asesino estelar</p>', '<img alt="PASIVA"><p>Asesino estelar</p>')
  .replace('<p>Dispara balas de ki.</p>', '<img alt=""><p>Dispara balas de ki.</p>');
const parsedImplicitHtml = parseOfficialHeroHtml({
  html: esImplicitRushHtml,
  locale: 'es', heroId: '0015', heroName: sourceHeroNames.es['0015'],
  sourceDetail: HEROES_DATA['0015'], sourceUrl: 'https://dbg-squadra.bn-ent.net/es/hero/0015',
});
assert.match(parsedImplicitHtml.skills.rush_attack1.desc, /cantidad de disparos/i);


const sourceMarkerHtml = esImplicitRushHtml.replace(
  '<img alt=""><p>Dispara balas de ki.</p>',
  '<img alt="" src="/assets/images/hero/0015/skills/rush_attack1.png"><p>Dispara balas de ki.</p>',
);
const parsedSourceMarkerHtml = parseOfficialHeroHtml({
  html: sourceMarkerHtml,
  locale: 'es', heroId: '0015', heroName: sourceHeroNames.es['0015'],
  sourceDetail: HEROES_DATA['0015'], sourceUrl: 'https://dbg-squadra.bn-ent.net/es/hero/0015',
});
assert.match(parsedSourceMarkerHtml.skills.rush_attack1.desc, /cantidad de disparos/i);

// Missing snapshots must fail closed to canonical English, never a fabricated locale summary.
// Use a synthetic id so this regression remains valid after all 39 official pages are synchronized.
const missingHeroFixture = { ...HEROES.find(hero => hero.id === '0039'), id: '9999', name: 'Missing Hero Fixture' };
const missingJapanese = localizeHeroDetail(missingHeroFixture, HEROES_DATA['0039'], 'ja');
assert.equal(missingJapanese.translationComplete, false);
assert.equal(missingJapanese.description, HEROES_DATA['0039'].description);
assert.equal(missingJapanese.skills[0].desc, HEROES_DATA['0039'].skills[0].desc);

// Static pages: data-i18n is the primary path, selector lives in real headers.
const pages = {
  home: 'index.html', heroes: 'heroes.html', quickDraft: 'quick-draft.html', draftRoom: 'draft-room.html',
  dashboard: 'dashboard.html', portal: 'portal.html', public: 'public.html', auth: 'auth.html',
  hostImport: 'host-apply.html', join: 'join-tournament.html', adminHosts: 'admin-hosts.html', devAccess: 'dev-access.html',
  broadcast: 'broadcast.html',
};
const mergedEnglishKeys = new Set([...Object.keys(UI.en), ...basePageKeys]);
const staticAllowed = /^(?:GS|GEKISHIN(?: SQUADRA)?|VS|BO[13579]|Aa|start\.gg|TONAMEL|CHALLONGE|DBGS|HTML)$/i;

function decodeEntities(text) {
  return text.replaceAll('&amp;', '&').replaceAll('&nbsp;', ' ').replaceAll('&#39;', "'").replaceAll('&quot;', '"');
}
function unannotatedVisibleText(html) {
  const tokens = html.match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[^>]+>|[^<]+/g) || [];
  const stack = [];
  const issues = [];
  for (const token of tokens) {
    if (token.startsWith('<!--') || /^<!/i.test(token)) continue;
    if (token.startsWith('</')) { stack.pop(); continue; }
    if (token.startsWith('<')) {
      const match = /^<\s*([\w-]+)([\s\S]*?)\/?\s*>$/.exec(token);
      if (!match) continue;
      const tag = match[1].toLowerCase();
      const attrs = match[2];
      const selfClosing = /\/$/.test(attrs) || ['meta','link','img','input','br','hr','source'].includes(tag);
      if (!selfClosing) stack.push({
        tag,
        translated: /\bdata-i18n(?:-[\w-]+)?\s*=/.test(attrs),
        ignored: /\bdata-no-i18n\s*=/.test(attrs),
      });
      continue;
    }
    const value = decodeEntities(token).replace(/\s+/g, ' ').trim();
    if (!value || !/[A-Za-z]{2}/.test(value)) continue;
    if (stack.some(item => ['script','style','template'].includes(item.tag))) continue;
    if (stack.some(item => item.translated || item.ignored)) continue;
    if (staticAllowed.test(value) || /^https?:\/\//i.test(value)) continue;
    issues.push(value);
  }
  return issues;
}


function unannotatedVisibleAttributes(html) {
  const issues = [];
  for (const tag of html.matchAll(/<([\w-]+)([^>]+)>/g)) {
    const attrs = tag[2];
    if (/\bdata-no-i18n\b/.test(attrs)) continue;
    for (const attribute of ['placeholder','title','aria-label','alt']) {
      const match = new RegExp(`\\b${attribute}="([^"]*[A-Za-z][^"]*)"`, 'i').exec(attrs);
      if (!match) continue;
      const dataName = `data-i18n-${attribute}`;
      if (!new RegExp(`\\b${dataName}="`).test(attrs)) issues.push(`${attribute}: ${match[1]}`);
    }
  }
  return issues;
}

for (const [pageName, filename] of Object.entries(pages)) {
  const html = read(filename);
  const slots = html.match(/data-language-slot=/g) || [];
  if (pageName === 'broadcast') assert.equal(slots.length, 0, 'Broadcast must stay control-free and use ?lang=.');
  else assert.equal(slots.length, 1, `${filename} must have exactly one in-header language slot.`);
  assert.ok(/<title\s+data-i18n=/.test(html), `${filename} title is not localized.`);
  assert.deepEqual(unannotatedVisibleText(html), [], `${filename} still has unannotated visible English text.`);
  assert.deepEqual(unannotatedVisibleAttributes(html), [], `${filename} still has unannotated visible English attributes.`);
  for (const match of html.matchAll(/data-i18n(?:-placeholder|-title|-aria-label|-alt)?="([^"]+)"/g)) {
    const key = match[1];
    assert.ok(mergedEnglishKeys.has(key) || t(key, {}, 'en') !== key, `${filename} references unknown i18n key ${key}.`);
  }
}
for (const filename of ['auth.html','host-apply.html','join-tournament.html','admin-hosts.html','dev-access.html']) {
  const html = read(filename);
  assert.match(html, /<header class="gs-standalone-nav">[\s\S]*data-language-slot=/, `${filename} selector is not in the standalone header.`);
}
assert.match(read('draft-room.html'), /<div class="draft-header-tools">[\s\S]*data-language-slot=/, 'Draft Room selector is not in its header tools row.');

const i18nSource = read('js/i18n.js');
const i18nCss = read('css/i18n.css');
const primaryTranslationIndex = i18nSource.indexOf('queryWithRoot(root, DATA_I18N_SELECTOR).forEach(translateDataElement)');
const legacyTranslationIndex = i18nSource.indexOf('Legacy/fallback path');
assert.ok(primaryTranslationIndex >= 0 && legacyTranslationIndex >= 0 && primaryTranslationIndex < legacyTranslationIndex, 'data-i18n must run before the legacy dynamic fallback.');
assert.match(i18nSource, /GENERATED_TEMPLATE_PATTERNS/, 'Dynamic parameterized copy needs a catalog-driven fallback.');
assert.match(i18nSource, /MutationObserver/, 'Dynamically rendered UI needs translation observation.');
assert.match(i18nSource, /if \(element\.getAttribute\(name\) !== next\) element\.setAttribute\(name, next\)/, 'Translated attributes must use idempotent writes or MutationObserver can loop forever.');
assert.match(i18nSource, /if \(element\.textContent !== next\) element\.textContent = next/, 'Translated text must use idempotent writes.');
assert.match(i18nSource, /observer\.disconnect\(\)/, 'Translation passes must pause the MutationObserver.');
assert.match(i18nSource, /observer\?\.takeRecords\(\)/, 'Self-generated mutation records must be discarded before reconnecting.');
assert.match(i18nSource, /queueMicrotask\(flushTranslationQueue\)/, 'Dynamic mutations must be batched instead of translating each record inline.');
assert.match(i18nSource, /scheduleSelectorRepair\(\)/, 'The language selector must repair itself after an account/header re-render.');
assert.match(i18nSource, /headerMayHaveChanged && !document\.querySelector\('\.gs-language-switcher'\)/, 'MutationObserver must detect when a header renderer removes the selector.');
assert.match(read('js/home.js'), /data-language-slot=\"true\"/, 'Home account rendering must preserve the language slot.');
assert.match(read('js/heroes-page.js'), /data-language-slot=\"true\"/, 'Heroes account rendering must preserve the language slot.');
const observerCallback = i18nSource.slice(i18nSource.indexOf('observer = new MutationObserver'), i18nSource.indexOf('startObserver();', i18nSource.indexOf('observer = new MutationObserver')));
assert.doesNotMatch(observerCallback, /applyTranslations\(/, 'MutationObserver must queue roots, not recursively translate inside its callback.');
assert.doesNotMatch(i18nSource, /createElement\('select'\)|<select/, 'Language selector must not use a browser-native select.');
assert.doesNotMatch(i18nCss, /\.gs-page-language-slot|position\s*:\s*fixed/, 'Language selector must not use the old viewport-fixed offset hack.');
assert.match(i18nCss, /\.gs-standalone-nav\s*\{/);
assert.match(i18nCss, /\.draft-header-tools\s*\{/);

// Dynamic copy contract: every major page path has exact/template translation.
const dynamicCases = {
  home: ['No public tournaments match this filter yet.', 'Loading public tournaments…'],
  heroes: ['No heroes match this search.', 'Hover or focus for details.', 'The Admin has not assigned a Divine Card preset to this hero.'],
  quickDraft: ['Standard Pick & Ban', '2 per team', '30 seconds', 'Setup could not load'],
  draftRoom: ['PICK 2', 'WAITING FOR TEAM BLUE...', 'Damage limit reached (2)', 'GAME 2 DRAFT COMPLETE'],
  dashboard: ['Tournament not found.', 'Start time not announced', 'No matches found.'],
  portal: ['Sign in or register with the invited account, then accept the Captain invitation.', 'No matches found.'],
  public: ['Missing tournament slug.', 'Loading public tournament data…'],
  auth: ['Account created. Redirecting…', 'Confirm password'],
  broadcast: ['DRAFT COMPLETE', 'FINAL TEAM COMPOSITIONS LOCKED', 'WAITING FOR TEAM RED...'],
};
for (const locale of translatedLocales) {
  setLocale(locale, { reload:false });
  assert.equal(getLocale(), locale);
  for (const [pageName, cases] of Object.entries(dynamicCases)) {
    for (const source of cases) {
      const translated = translateSourceText(source);
      assert.notEqual(translated, source, `${locale}/${pageName} leaves dynamic English unchanged: ${source}`);
    }
  }
}
setLocale('en', { reload:false });


// Client-source CI audit: scan every runtime JS module for known user-facing
// English literals and require the exact/template fallback catalog to cover them.
const sourceAuditIssues = auditClientSourceI18n({ root });
assert.deepEqual(sourceAuditIssues, [], `Client JS contains untranslated user-facing English: ${JSON.stringify(sourceAuditIssues, null, 2)}`);

// Divine Card translation files, migration, service and client locale plumbing.
const divineData = JSON.parse(read('data/locales/divine-cards.json'));
assert.equal(divineData.translations.length, 18 * 5, 'Divine Card translation seed must contain 18 cards × 5 translated locales.');
const divinePairs = new Set();
for (const row of divineData.translations) {
  assert.ok(translatedLocales.includes(row.locale), `Unsupported Divine Card locale ${row.locale}.`);
  assert.ok(row.cardId && row.name?.trim() && row.effect?.trim() && row.note?.trim(), `Incomplete Divine Card translation ${row.cardId}/${row.locale}.`);
  divinePairs.add(`${row.cardId}:${row.locale}`);
}
assert.equal(divinePairs.size, 90, 'Divine Card translation seed has duplicate/missing card-locale pairs.');
const vietnameseVanishingStepCards = divineData.translations.filter(row =>
  row.locale === 'vi' && /Vanishing Step/.test(`${row.description || ''} ${row.effect || ''} ${row.note || ''}`)
);
assert.equal(vietnameseVanishingStepCards.length, 4, 'Exactly four Vietnamese Divine Cards should reference Vanishing Step.');
for (const row of vietnameseVanishingStepCards) {
  const text = `${row.description || ''} ${row.effect || ''} ${row.note || ''}`;
  assert.match(text, /Bộ Pháp Biến Mất \(Vanishing Step\)/, `${row.name} must use the approved Vietnamese Vanishing Step term.`);
  assert.doesNotMatch(text, /Bước Biến Ảnh/, `${row.name} still uses the rejected Vanishing Step translation.`);
}

const dbSource = read('server/db.js');
const serviceSource = read('server/divine-card-service.js');
const serverSource = read('server.js');
const clientSource = read('js/heroes-page.js');
const migrationSource = read('scripts/migrate-divine-card-i18n.mjs');
const importSource = read('scripts/import-divine-card-i18n.mjs');
assert.match(dbSource, /CREATE TABLE IF NOT EXISTS divine_cards_i18n/);
assert.match(dbSource, /PRIMARY KEY\(card_id, locale\)/);
assert.match(dbSource, /CREATE TABLE IF NOT EXISTS divine_card_presets_i18n/);
assert.match(serviceSource, /LEFT JOIN divine_cards_i18n i ON i\.card_id=c\.id AND i\.locale=\?/);
assert.match(serviceSource, /COALESCE\(NULLIF\(pi\.name,''\),p\.name\)/);
assert.match(serverSource, /publicDivineCardBundle\(requestLocale\(req\)\)/);
assert.match(serverSource, /locale:req\.body\?\.locale\|\|requestLocale\(req\)/);
assert.match(clientSource, /divine-card-builds\?locale=\$\{encodeURIComponent\(getLocale\(\)\)\}/);
assert.match(clientSource, /locale:\s*getLocale\(\)/);
assert.match(migrationSource, /INSERT INTO divine_cards_i18n/);
assert.match(importSource, /--export-template/);
assert.match(importSource, /kind must be card or preset/);

// Execute the service against a disposable DB to prove locale fallback and non-destructive edits.
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gs-i18n-service-'));
process.env.DATABASE_PATH = path.join(tempDir, 'i18n.sqlite');
const require = createRequire(import.meta.url);
const { db } = require('../server/db');
const service = require('../server/divine-card-service');
try {
  db.prepare("INSERT INTO users(username,email,display_name,password_hash,role) VALUES ('i18n-admin','i18n-admin@example.test','I18N Admin','x:y','admin')").run();
  const adminId = Number(db.prepare("SELECT id FROM users WHERE username='i18n-admin'").get().id);
  service.seedDivineCardAssets();
  const sourceCards = service.adminBundle('en').cards;
  assert.equal(sourceCards.length, 18);
  const sourceCard = sourceCards[0];
  service.updateCard(sourceCard.id, {
    ...sourceCard,
    locale:'ja',
    name:'翻訳カード',
    effect:'翻訳された効果。',
    note:'翻訳された注記。',
  }, adminId);
  assert.equal(service.adminBundle('ja').cards.find(card => card.id === sourceCard.id).name, '翻訳カード');
  assert.equal(service.adminBundle('en').cards.find(card => card.id === sourceCard.id).name, sourceCard.name, 'Editing a translation overwrote canonical English card data.');
  const koLocalized = service.adminBundle('ko').cards.find(card => card.id === sourceCard.id);
  assert.equal(koLocalized.name, sourceCard.name, 'Localized Divine Card names must remain canonical English.');
  assert.notEqual(koLocalized.effect, sourceCard.effect, 'Bundled Korean Divine Card text was not imported into the active database.');
  assert.equal(koLocalized.translationStatus, 'user-provided-source');
  const viBuildUp = service.adminBundle('vi').cards.find(card => card.name === 'Build Up');
  assert.match(viBuildUp.effect, /phòng ngự/i, 'Bundled Vietnamese Divine Card text was not imported.');

  const core = [1,2,3].map(slot => sourceCards.find(card => card.slotPool === slot));
  const preset = service.savePreset(null, {
    locale:'en', name:'English preset', description:'English description', scenario:'English scenario',
    slots:core.map((card,index)=>({slot:index+1,cardId:card.id})),
  }, adminId);
  service.savePreset(preset.id, {
    locale:'ja', name:'日本語プリセット', description:'日本語の説明', scenario:'日本語シナリオ',
    slots:core.map((card,index)=>({slot:index+1,cardId:card.id})),
  }, adminId);
  assert.equal(service.adminBundle('ja').presets.find(item => item.id === preset.id).name, '日本語プリセット');
  assert.equal(service.adminBundle('en').presets.find(item => item.id === preset.id).name, 'English preset', 'Editing a preset translation overwrote canonical English data.');
} finally {
  try { db.close(); } catch {}
  fs.rmSync(tempDir, { recursive:true, force:true });
}

console.log(`i18n tests passed: ${heroIds.length} hero ids, verified hero snapshots ${JSON.stringify(catalogValidation.coverage)}, ${basePageKeys.length} page keys, 90 Divine Card translations.`);


// Real official 2026-07-29 snapshots supplied from the failed sync. In both
// Korean and Spanish, panel-rush_attack1 exists and its official description
// container is intentionally empty. This must be preserved as official empty,
// not treated as a parser failure and not filled with generated copy.
const realEmptyRushSnapshots = {};
for (const locale of ['es', 'ko']) {
  const parsed = parseOfficialHeroHtml({
    html: read(`data/locales/fixtures/live/${locale}-0015.html`),
    locale,
    heroId: '0015',
    heroName: sourceHeroNames[locale]['0015'],
    sourceDetail: HEROES_DATA['0015'],
    sourceUrl: `https://dbg-squadra.bn-ent.net/${locale}/hero/0015`,
  });
  realEmptyRushSnapshots[locale] = parsed;
  assert.equal(parsed.officialName, locale === 'es' ? 'Bojack máximo poder' : '풀 파워 보자크');
  assert.equal(parsed.skills.rush_attack1.name, locale === 'es' ? 'Arremetida' : '러시 공격');
  assert.equal(parsed.skills.rush_attack1.desc, '', `${locale}.0015 Rush description must match the empty official panel.`);
  assert.equal(parsed.skills.rush_attack1.officialEmpty, true, `${locale}.0015 Rush must be marked officialEmpty.`);
  assert.equal(parsed.skills.skill1.name, locale === 'es' ? 'Destrozo Galáctico' : '갤럭틱 버스터');
}
const catalogWithOfficialEmpty = structuredClone(heroCatalog);
for (const locale of ['es', 'ko']) {
  catalogWithOfficialEmpty.locales[locale] ||= {};
  catalogWithOfficialEmpty.locales[locale]['0015'] = realEmptyRushSnapshots[locale];
}
assert.doesNotThrow(() => validateHeroI18nCatalog(catalogWithOfficialEmpty), 'Catalog validation must accept explicitly empty official skill copy.');

// Exact fields manually verified in the released game client override only
// the corresponding website fields. Temporary source screenshots were removed
// after transcription and review, so the public repository retains no images.
const effectiveEs0015 = applyInGameHeroOverride(realEmptyRushSnapshots.es, 'es', '0015', inGameOverrides);
assert.equal(effectiveEs0015.translationStatus, 'official-site+in-game-verified');
assert.equal(effectiveEs0015.officialName, 'Bojack Máximo Poder');
assert.equal(effectiveEs0015.skills.passive1.name, 'Asesino Estelar');
assert.equal(effectiveEs0015.skills.passive1.desc, `Capacidad de ordenar a sus subordinados que efectúen ataques adicionales.
Estos se producen cuando un héroe enemigo recibe una Arremetida tras ser golpeado por técnicas.`);
assert.equal(effectiveEs0015.skills.rush_attack1.desc, '', 'The Spanish verification record does not verify a Rush description, so the website-empty description must stay empty.');
assert.equal(effectiveEs0015.skills.rush_attack1.officialEmpty, true);

const effectiveKo0015 = applyInGameHeroOverride(realEmptyRushSnapshots.ko, 'ko', '0015', inGameOverrides);
assert.equal(effectiveKo0015.translationStatus, 'official-site+in-game-verified');
assert.equal(effectiveKo0015.skills.rush_attack1.name, '러시 공격');
assert.equal(effectiveKo0015.skills.rush_attack1.desc, `기탄을 발사하는 공격
연속으로 발동하면 탄 수 증가`);
assert.equal(Object.hasOwn(effectiveKo0015.skills.rush_attack1, 'officialEmpty'), false, 'Verified in-game copy must replace the empty website marker.');
assert.equal(effectiveKo0015.skills.rush_attack1.verificationStatus, 'in-game-verified');

// The live fixtures above specifically test the official-empty Rush panel. The
// release catalog can also contain later, evidence-backed balance corrections
// in other skill fields, so freshness must be checked against the current
// source catalog rather than requiring every field to equal the older fixture.
const currentEffectiveEs0015 = applyInGameHeroOverride(heroCatalog.locales.es['0015'], 'es', '0015', inGameOverrides);
const currentEffectiveKo0015 = applyInGameHeroOverride(heroCatalog.locales.ko['0015'], 'ko', '0015', inGameOverrides);
assert.deepEqual(effectiveHeroCatalog.locales.es['0015'], currentEffectiveEs0015, 'Spanish 0015 effective catalog is stale.');
assert.deepEqual(effectiveHeroCatalog.locales.ko['0015'], currentEffectiveKo0015, 'Korean 0015 effective catalog is stale.');

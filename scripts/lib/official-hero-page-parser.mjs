const TYPE_ALIASES = Object.freeze({
  ja: { passive: ['PASSIVE', 'パッシブ'], rush_attack: ['RUSH ATTACK', 'ラッシュ攻撃'], skill: ['SKILL', '技', 'スキル'], super_attack: ['SUPER ATTACK', '必殺技'], transformation: ['TRANSFORMATION', '変身'] },
  'zh-CN': { passive: ['PASSIVE', '被动'], rush_attack: ['RUSH ATTACK', '突进攻击', '突進攻擊'], skill: ['SKILL', '技能'], super_attack: ['SUPER ATTACK', '必杀技', '必殺技'], transformation: ['TRANSFORMATION', '变身', '變身'] },
  ko: { passive: ['PASSIVE', '패시브'], rush_attack: ['RUSH ATTACK', '러시 공격', '러시 어택'], skill: ['SKILL', '스킬'], super_attack: ['SUPER ATTACK', '필살기'], transformation: ['TRANSFORMATION', '변신'] },
  es: { passive: ['PASSIVE', 'PASIVA'], rush_attack: ['RUSH ATTACK', 'ARREMETIDA'], skill: ['SKILL', 'TÉCNICA', 'TECNICA'], super_attack: ['SUPER ATTACK', 'TÉCNICA ESPECIAL', 'TECNICA ESPECIAL'], transformation: ['TRANSFORMATION', 'TRANSFORMACIÓN', 'TRANSFORMACION'] },
});

const RUSH_NAMES = Object.freeze({ ja: 'ラッシュ攻撃', 'zh-CN': '突进攻击', ko: '러시 공격', es: 'Arremetida' });
const DIFFICULTY_ALIASES = Object.freeze({ ja: ['難易度'], 'zh-CN': ['难度', '難度'], ko: ['난이도'], es: ['Dificultad'] });
const SKILLS_HEADINGS = Object.freeze({ ja: ['スキル', '技'], 'zh-CN': ['技能'], ko: ['스킬'], es: ['Técnica', 'Tecnica'] });
const STOP_PREFIXES = Object.freeze({
  ja: ['※掲載されている', '※ヒーローの性能', '*掲載されている'],
  'zh-CN': ['※所记载', '※所記載', '*所记载', '*所記載'],
  ko: ['※기재된', '*기재된'],
  es: ['*Las aptitudes', 'Las aptitudes indicadas'],
});
const HERO_SELECT_MARKERS = ['HERO SELECT', 'SELECCIÓN DE HÉROE', 'SELECCION DE HEROE', 'ヒーロー選択', '英雄选择', '英雄選擇', '히어로 선택'];

function decodeHtmlEntities(value) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…' };
  return String(value || '')
    .replace(/&#(x?[0-9a-f]+);/gi, (_, raw) => {
      const codePoint = raw[0].toLowerCase() === 'x' ? Number.parseInt(raw.slice(1), 16) : Number.parseInt(raw, 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _;
    })
    .replace(/&([a-z]+);/gi, (match, name) => named[name.toLowerCase()] ?? match);
}

function attrValue(tag, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return decodeHtmlEntities(match?.[1] ?? match?.[2] ?? match?.[3] ?? '');
}


function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function textFromHtmlFragment(fragment) {
  return decodeHtmlEntities(String(fragment || '')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect skill panels that the official site intentionally publishes without
 * written copy. Full Power Bojack (0015) currently has an empty Rush Attack
 * description in Korean and Spanish: the panel and video exist, but the
 * description div is empty. Detection is tied to the real panel DOM so empty
 * navigation markers can never be mistaken for official empty content.
 */
function findOfficialEmptySkillIds(html, sourceSkills) {
  const source = String(html || '');
  const emptyIds = new Set();
  for (const skill of sourceSkills || []) {
    const panelPattern = new RegExp(`\\bid\\s*=\\s*["']panel-${escapeRegExp(skill.id)}["']`, 'i');
    const panelMatch = panelPattern.exec(source);
    if (!panelMatch) continue;

    const panelStart = panelMatch.index;
    const nextPanelPattern = /\brole\s*=\s*["']tabpanel["']/gi;
    nextPanelPattern.lastIndex = panelStart + panelMatch[0].length;
    const nextPanel = nextPanelPattern.exec(source);
    const panelHtml = source.slice(panelStart, nextPanel?.index ?? source.length);
    const descriptionMatch = /<div\b[^>]*\bclass\s*=\s*["'][^"']*Skill_skill_detail_description__[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(panelHtml);
    if (descriptionMatch && !textFromHtmlFragment(descriptionMatch[1])) emptyIds.add(skill.id);
  }
  return emptyIds;
}


function extractOfficialHeroNameFromHtml(html) {
  const candidates = [];
  const pattern = /<div\b([^>]*)>([\s\S]*?)<\/div>/gi;
  for (const match of String(html || '').matchAll(pattern)) {
    const attributes = match[1] || '';
    if (!/Detail_name__/i.test(attributes)) continue;
    const name = textFromHtmlFragment(match[2]);
    if (!name) continue;
    const media = attrValue(`<div ${attributes}>`, 'data-media');
    candidates.push({ name, media });
  }
  return candidates.find(item => item.media === 'min-md')?.name
    || candidates.find(item => item.media === 'max-md')?.name
    || candidates[0]?.name
    || '';
}


function imageMarkerFromSource(value) {
  let source = String(value || '');
  try { source = decodeURIComponent(source); } catch { /* Keep the raw URL when percent-encoding is malformed. */ }
  source = source.toLowerCase();
  if (!source) return '';
  const canonical = /(?:^|[\/_.-])(passive\d+|rush[_-]?attack\d+|skill\d+|super[_-]?attack\d+|transformation\d+)(?=$|[\/_.?#-])/i.exec(source)?.[1];
  if (canonical) return canonical.replaceAll('-', '_');
  const type = /(?:^|[\/_.-])(rush[_-]?attack|super[_-]?attack|passive|transformation|skill)(?=$|[\/_.?#-])/i.exec(source)?.[1];
  return type ? type.replaceAll(/[_-]+/g, ' ').toUpperCase() : '';
}

function imageMarker(tag) {
  const alt = attrValue(tag, 'alt').trim();
  const source = attrValue(tag, 'src') || attrValue(tag, 'data-src') || attrValue(tag, 'data-original') || attrValue(tag, 'srcset');
  const fromSource = imageMarkerFromSource(source);
  const genericAlt = /^(?:image|imagen|画像|이미지)$/i.test(alt);
  return (!alt || genericAlt) && fromSource ? fromSource : (alt || fromSource);
}

export function htmlToOfficialText(html) {
  let source = String(html || '');
  source = source
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<img\b[^>]*>/gi, tag => {
      const marker = imageMarker(tag);
      return marker ? `\n[[IMG:${marker}]]\n` : '\n';
    })
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|section|article|li|ul|ol|h[1-6]|dt|dd|tr|td|th|button|a)>/gi, '\n')
    .replace(/<(?:p|div|section|article|li|ul|ol|h[1-6]|dt|dd|tr|td|th|button|a)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(source).replace(/\r/g, '').replace(/[\t\f\v ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function normalizeOfficialCompare(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase('en').replace(/[\s\p{P}\p{S}]+/gu, '');
}

function imageAlt(line) {
  const match = /^\[\[IMG:(.*)\]\]$/.exec(line);
  return match ? match[1].trim() : '';
}

function classifyTypeAlt(alt, locale, allowAffixes = false) {
  const normalized = normalizeOfficialCompare(alt);
  const entries = TYPE_ALIASES[locale] || {};
  for (const type of ['super_attack', 'transformation', 'rush_attack', 'passive', 'skill']) {
    if ((entries[type] || []).some(alias => {
      const token = normalizeOfficialCompare(alias);
      return normalized === token || (allowAffixes && (normalized.startsWith(token) || normalized.endsWith(token)));
    })) return type;
  }
  return '';
}

function isHeroSelect(line) {
  const normalized = normalizeOfficialCompare(imageAlt(line) || line);
  return HERO_SELECT_MARKERS.some(marker => normalized.includes(normalizeOfficialCompare(marker)));
}

function isStopLine(line, locale) {
  const text = String(line || '').trim();
  if (!text) return false;
  if (isHeroSelect(text)) return true;
  return (STOP_PREFIXES[locale] || []).some(prefix => text.startsWith(prefix));
}

function cleanContentLines(lines) {
  return lines.map(line => line.replace(/^[-*•]+\s*/, '').trim()).filter(Boolean).filter(line => !imageAlt(line)).filter(line => !/^https?:\/\//i.test(line));
}

function sentenceLike(line, locale) {
  const text = String(line || '').trim();
  if (!text || imageAlt(text)) return false;
  if (/[.!?¡¿。！？]$/.test(text)) return true;
  if (locale === 'es') return text.length >= 45;
  return text.length >= 22;
}

function findDifficultyIndex(lines, locale) {
  const difficulty = new Set((DIFFICULTY_ALIASES[locale] || []).map(normalizeOfficialCompare));
  const index = lines.findIndex(line => difficulty.has(normalizeOfficialCompare(line)));
  if (index < 0) throw new Error(`Could not find the localized difficulty label for ${locale}; the page may have redirected to another locale.`);
  return index;
}

function extractOfficialHeroName(lines, difficultyIndex, locale) {
  const ignored = new Set([
    ...(DIFFICULTY_ALIASES[locale] || []),
    ...(SKILLS_HEADINGS[locale] || []),
    ...Object.values(TYPE_ALIASES[locale] || {}).flat(),
  ].map(normalizeOfficialCompare));
  for (let index = difficultyIndex - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trim();
    if (!line || imageAlt(line) || ignored.has(normalizeOfficialCompare(line))) continue;
    return line;
  }
  throw new Error(`Could not extract the official hero name for ${locale}.`);
}

function extractDescription(lines, locale, officialName, difficultyIndex) {
  const headingSet = new Set((SKILLS_HEADINGS[locale] || []).map(normalizeOfficialCompare));
  let end = lines.length;
  for (let index = difficultyIndex + 1; index < lines.length; index += 1) {
    const alt = imageAlt(lines[index]);
    if (classifyTypeAlt(alt, locale) || headingSet.has(normalizeOfficialCompare(lines[index]))) { end = index; break; }
  }
  const heroToken = normalizeOfficialCompare(officialName);
  const candidates = [];
  for (const line of lines.slice(difficultyIndex + 1, end)) {
    if (!sentenceLike(line, locale)) continue;
    if (normalizeOfficialCompare(line) === heroToken) continue;
    candidates.push(line.trim());
    if (candidates.length >= 3) break;
  }
  if (!candidates.length) throw new Error(`Could not extract a hero description for ${locale}.`);
  return candidates.join('\n');
}

function classifyCanonicalSkillAlt(alt, sourceSkills) {
  const normalized = normalizeOfficialCompare(alt);
  if (!normalized) return null;
  for (const skill of sourceSkills || []) {
    if (normalizeOfficialCompare(skill.id) === normalized) {
      return { type: skill.type, skillId: skill.id };
    }
  }
  return null;
}

function findSkillMarkers(lines, locale, sourceSkills) {
  const markers = [];
  for (let index = 0; index < lines.length; index += 1) {
    const alt = imageAlt(lines[index]);
    if (alt) {
      const canonical = classifyCanonicalSkillAlt(alt, sourceSkills);
      if (canonical) {
        markers.push({ index, type: canonical.type, skillId: canonical.skillId, kind: 'skill-id', alt });
        continue;
      }

      const type = classifyTypeAlt(alt, locale, true);
      if (type) markers.push({ index, type, skillId: '', kind: 'image-type', alt });
      continue;
    }

    // A few official pages render the detail heading as text instead of an image alt.
    // Navigation copies are harmless because the following canonical id marker makes
    // their candidate block empty, so they are skipped by the normal completeness check.
    const type = classifyTypeAlt(lines[index], locale);
    if (type) markers.push({ index, type, skillId: '', kind: 'text-type', alt: lines[index] });
  }
  return markers;
}

function contentBetween(lines, start, end, locale) {
  const raw = [];
  for (let index = start; index < end; index += 1) {
    if (isStopLine(lines[index], locale)) break;
    raw.push(lines[index]);
  }
  return cleanContentLines(raw);
}

function parseSkillCandidate(lines, marker, nextMarkerIndex, locale, skill, officialEmptySkillIds = new Set()) {
  const content = contentBetween(lines, marker.index + 1, nextMarkerIndex, locale);
  if (!content.length) {
    // Only the localized detail heading is accepted as an intentionally empty
    // panel. Canonical skill-id markers also occur in navigation and stay invalid.
    if (officialEmptySkillIds.has(skill.id) && marker.kind === 'image-type') {
      return {
        name: skill.type === 'rush_attack' ? RUSH_NAMES[locale] : skill.name,
        desc: '',
        officialEmpty: true,
      };
    }
    return null;
  }
  if (skill.type === 'rush_attack') return { name: RUSH_NAMES[locale], desc: content.join('\n') };
  const [name, ...description] = content;
  if (!name || !description.length) return null;
  return { name, desc: description.join('\n') };
}

function sourceParagraphCount(skill) {
  return String(skill?.desc || '').split('\n').map(line => line.trim()).filter(Boolean).length || 1;
}

function markerMatchesSkill(marker, skill) {
  if (!marker || !skill) return false;
  return marker.skillId ? marker.skillId === skill.id : marker.type === skill.type;
}

/**
 * Some official 0015 pages render the visible Rush Attack icon without usable
 * alt text. htmlToOfficialText therefore keeps the localized Rush paragraphs,
 * but there is no marker between the passive block and skill1. Recover that
 * exact localized text by splitting the combined official block according to
 * the canonical paragraph structure. No text is translated or synthesized.
 */
function recoverImplicitRushAfterPassive({ lines, markers, locale, sourceSkills, passiveSkill, rushSkill, passiveMeta }) {
  if (!passiveMeta || passiveSkill?.type !== 'passive' || rushSkill?.type !== 'rush_attack') return null;
  const nextSkill = sourceSkills[sourceSkills.indexOf(rushSkill) + 1];
  if (!nextSkill) return null;

  let boundaryMarkerArrayIndex = -1;
  for (let index = passiveMeta.markerArrayIndex + 1; index < markers.length; index += 1) {
    const marker = markers[index];
    if (!markerMatchesSkill(marker, nextSkill)) continue;
    const nextMarkerLine = markers[index + 1]?.index ?? lines.length;
    if (!parseSkillCandidate(lines, marker, nextMarkerLine, locale, nextSkill)) continue;
    boundaryMarkerArrayIndex = index;
    break;
  }
  if (boundaryMarkerArrayIndex < 0) return null;

  // If an actual complete Rush marker exists, this is not the implicit-marker case.
  for (let index = passiveMeta.markerArrayIndex + 1; index < boundaryMarkerArrayIndex; index += 1) {
    const marker = markers[index];
    if (!markerMatchesSkill(marker, rushSkill)) continue;
    const nextMarkerLine = markers[index + 1]?.index ?? lines.length;
    if (parseSkillCandidate(lines, marker, nextMarkerLine, locale, rushSkill)) return null;
  }

  const boundaryLine = markers[boundaryMarkerArrayIndex].index;
  const combined = contentBetween(lines, passiveMeta.marker.index + 1, boundaryLine, locale);
  if (combined.length < 3) return null; // passive name + at least one passive line + one rush line

  const [passiveName, ...descriptionLines] = combined;
  const desiredRushLines = sourceParagraphCount(rushSkill);
  const desiredPassiveLines = sourceParagraphCount(passiveSkill);
  if (descriptionLines.length < 2) return null;

  // Prefer the canonical paragraph counts used by the official page templates.
  // When a locale combines paragraphs, preserve at least one line for each block.
  let rushLineCount = Math.min(desiredRushLines, descriptionLines.length - 1);
  let passiveLineCount = descriptionLines.length - rushLineCount;
  if (passiveLineCount < Math.min(desiredPassiveLines, descriptionLines.length - 1)) {
    passiveLineCount = Math.min(desiredPassiveLines, descriptionLines.length - 1);
    rushLineCount = descriptionLines.length - passiveLineCount;
  }
  if (passiveLineCount < 1 || rushLineCount < 1) return null;

  const passiveDescription = descriptionLines.slice(0, passiveLineCount);
  const rushDescription = descriptionLines.slice(passiveLineCount);
  if (!passiveDescription.length || !rushDescription.length) return null;

  return {
    passive: { name: passiveName, desc: passiveDescription.join('\n') },
    rush: { name: RUSH_NAMES[locale], desc: rushDescription.join('\n') },
    boundaryMarkerArrayIndex,
  };
}

export function parseOfficialHeroText({ text, locale, heroId, heroName = '', sourceDetail, sourceUrl = '', officialEmptySkillIds = new Set(), officialNameOverride = '' }) {
  if (!TYPE_ALIASES[locale]) throw new Error(`Unsupported official locale: ${locale}`);
  if (!sourceDetail?.skills?.length) throw new Error(`Missing canonical skill data for hero ${heroId}.`);
  const emptySkillIds = officialEmptySkillIds instanceof Set ? officialEmptySkillIds : new Set(officialEmptySkillIds || []);

  const lines = String(text || '').replace(/\r/g, '').split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const difficultyIndex = findDifficultyIndex(lines, locale);
  const officialName = officialNameOverride || extractOfficialHeroName(lines, difficultyIndex, locale);
  const description = extractDescription(lines, locale, officialName, difficultyIndex);
  const markers = findSkillMarkers(lines, locale, sourceDetail.skills);
  if (!markers.length) throw new Error(`No official skill detail markers were found for ${locale}.${heroId}.`);

  const skills = {};
  const parsedMeta = {};
  let markerCursor = 0;
  for (let skillIndex = 0; skillIndex < sourceDetail.skills.length; skillIndex += 1) {
    const skill = sourceDetail.skills[skillIndex];
    let parsed = null;
    let usedIndex = -1;
    for (let index = markerCursor; index < markers.length; index += 1) {
      const marker = markers[index];
      if (!markerMatchesSkill(marker, skill)) continue;
      const nextMarkerIndex = markers[index + 1]?.index ?? lines.length;
      const candidate = parseSkillCandidate(lines, marker, nextMarkerIndex, locale, skill, emptySkillIds);
      if (!candidate) continue; // Skip empty duplicate/navigation markers and keep searching.
      parsed = candidate;
      usedIndex = index;
      break;
    }

    if (!parsed && skill.type === 'rush_attack') {
      const passiveSkill = sourceDetail.skills[skillIndex - 1];
      const recovered = recoverImplicitRushAfterPassive({
        lines,
        markers,
        locale,
        sourceSkills: sourceDetail.skills,
        passiveSkill,
        rushSkill: skill,
        passiveMeta: parsedMeta[passiveSkill?.id],
      });
      if (recovered) {
        skills[passiveSkill.id] = recovered.passive;
        parsed = recovered.rush;
        usedIndex = recovered.boundaryMarkerArrayIndex - 1;
        markerCursor = recovered.boundaryMarkerArrayIndex;
      }
    }

    if (!parsed) throw new Error(`No complete official content found for ${skill.id} (${locale}).`);
    skills[skill.id] = parsed;
    if (usedIndex >= 0) {
      parsedMeta[skill.id] = { markerArrayIndex: usedIndex, marker: markers[usedIndex] };
      if (skill.type !== 'rush_attack' || markerCursor <= usedIndex) markerCursor = usedIndex + 1;
    }
  }

  return { officialName, description, skills, translationStatus: 'official-site-snapshot', sourceUrl };
}

export function parseOfficialHeroHtml(options) {
  const officialEmptySkillIds = findOfficialEmptySkillIds(options.html, options.sourceDetail?.skills);
  const officialNameOverride = extractOfficialHeroNameFromHtml(options.html);
  return parseOfficialHeroText({
    ...options,
    text: htmlToOfficialText(options.html),
    officialEmptySkillIds,
    officialNameOverride,
  });
}

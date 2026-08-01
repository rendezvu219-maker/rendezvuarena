import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { setLocale, translateSourceText } from '../js/i18n.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLIENT_DIR = path.join(ROOT, 'js');
const TARGET_LOCALES = ['ja', 'zh-CN', 'ko', 'es', 'vi'];
const EXCLUDED_FILES = new Set([
  'i18n.js', 'i18n-hero-details.js', 'i18n-ui-pages.js',
  'heroes-data.js', 'heroes.js',
]);

// User-facing English terms that should never remain as raw client copy.
// The audit intentionally targets known UI vocabulary rather than arbitrary
// identifiers, protocols, CSS values, URLs, file names, or game data.
const UI_ENGLISH = /\b(?:account|activity|admin|all|apply|approve|assigned|available|back|ban|bracket|broadcast|cancel|captain|card|check|choose|cleanup|close|complete|confirm|copy|correct|create|current|dashboard|default|delete|description|details|dispute|draft|edit|email|empty|error|event|evidence|failed|filter|final|finish|game|generate|global|hero|host|import|invalid|invite|join|language|link|live|load(?:ing)?|lock|login|logout|manage|match|message|missing|move|name|new|next|no|not|note|open|optional|owner|password|permission|pick|player|portal|preset|private|profile|public|quick|ready|reason|refresh|remove|reset|result|retry|role|roster|rule|save|search|seed|select|series|settings|sign|skill|slot|staff|start|status|submit|team|timer|tournament|unable|unavailable|update|upload|username|view|waiting|winner|write|wrong)\b/i;

const ALLOWED_EXACT = new Set([
  'GEKISHIN SQUADRA', 'RENDEZVU ARENA', 'DBGS', 'OBS', 'Socket.IO',
  'start.gg', 'Tonamel', 'Challonge', 'BO1', 'BO3', 'BO5', 'BO7',
  'Team Blue', 'Team Red', // translated by dynamic team state where displayed
  'General', // canonical stored preset scenario; localized at presentation time
]);

const ALLOWED_PATTERNS = [
  /^[.#].*$/,
  /^\/.*$/,
  /^[^\s]+\?(?:[^#]*&)?(?:config|team|slug)=/i,
  /^https?:\/\//i,
  /^\.?\/?(?:assets|css|js|divine|trailers|api)\//i,
  /\.(?:png|webp|jpe?g|gif|svg|mp4|webm|mov|json|html|css|js|mjs)$/i,
  /^[.#\[]?[a-z0-9_-]+(?:[.#:[\]="'()\s>+~-][a-z0-9_="'()\s.#:[\]>+~-]*)?$/i,
  /^(?:GET|POST|PUT|PATCH|DELETE|OPTIONS)$/,
  /^(?:en|ja|zh-CN|ko|es|vi)$/,
  /^(?:Damage|Tank|Technical)$/,
  /^(?:fulfilled|pending|rejected|connected|disconnected|open|closed)$/i,
  /^(?:true|false|null|undefined|auto|none|block|flex|grid|hidden|visible)$/i,
  /^\d+(?:px|rem|em|ms|s|%|vh|vw)?$/i,
  /^(?:application|image|video|text)\//i,
  /^(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|PRAGMA)\b/i,
  /^[A-Z0-9_:.\/-]+$/,
];

function isRegexStart(source, index, previousWord, previousChar) {
  if (source[index] !== '/') return false;
  if (!previousChar) return true;
  if ('([{:;,=!?&|+*-~%^<>'.includes(previousChar)) return true;
  return /^(?:return|throw|case|delete|void|typeof|instanceof|in|of|yield|await)$/.test(previousWord);
}

function skipRegex(source, start) {
  let inClass = false;
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '\\') { i += 1; continue; }
    if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) {
      while (/[a-z]/i.test(source[i + 1] || '')) i += 1;
      return i;
    }
  }
  return source.length - 1;
}

function decodeJsString(raw) {
  try { return JSON.parse(`"${raw.replaceAll('"', '\\"')}"`); }
  catch {
    return raw
      .replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
      .replace(/\\([\\'"`])/g, '$1');
  }
}

function scanString(source, start, quote) {
  let raw = '';
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '\\') {
      raw += ch + (source[i + 1] || '');
      i += 1;
      continue;
    }
    if (ch === quote) return { end: i, value: decodeJsString(raw) };
    if ((ch === '\n' || ch === '\r') && quote !== '`') return { end: i, value: raw };
    raw += ch;
  }
  return { end: source.length - 1, value: raw };
}

function skipTemplateExpression(source, start) {
  let depth = 1;
  let previousWord = '';
  let previousChar = '';
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') { i = source.indexOf('\n', i + 2); if (i < 0) return source.length - 1; continue; }
    if (ch === '/' && next === '*') { const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length - 1 : end + 1; continue; }
    if (ch === '"' || ch === "'") { i = scanString(source, i, ch).end; continue; }
    if (ch === '`') { i = scanTemplate(source, i).end; continue; }
    if (ch === '/' && isRegexStart(source, i, previousWord, previousChar)) { i = skipRegex(source, i); continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const match = /^[A-Za-z_$][\w$]*/.exec(source.slice(i));
      previousWord = match?.[0] || '';
      i += (match?.[0]?.length || 1) - 1;
      previousChar = 'w';
    } else if (!/\s/.test(ch)) {
      previousChar = ch;
      previousWord = '';
    }
  }
  return source.length - 1;
}

function scanTemplate(source, start) {
  const segments = [];
  let raw = '';
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '\\') { raw += ch + (source[i + 1] || ''); i += 1; continue; }
    if (ch === '`') { if (raw) segments.push(decodeJsString(raw)); return { end: i, values: segments }; }
    if (ch === '$' && source[i + 1] === '{') {
      if (raw) segments.push(decodeJsString(raw));
      raw = '';
      segments.push('2');
      i = skipTemplateExpression(source, i + 2);
      continue;
    }
    raw += ch;
  }
  if (raw) segments.push(raw);
  return { end: source.length - 1, values: segments };
}

export function extractJavaScriptStrings(source) {
  const values = [];
  let previousWord = '';
  let previousChar = '';
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') { i = source.indexOf('\n', i + 2); if (i < 0) break; previousWord = ''; previousChar = ''; continue; }
    if (ch === '/' && next === '*') { const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length - 1 : end + 1; previousWord = ''; previousChar = ''; continue; }
    if (ch === '"' || ch === "'") {
      const scanned = scanString(source, i, ch);
      values.push(scanned.value);
      i = scanned.end;
      previousWord = '';
      previousChar = 's';
      continue;
    }
    if (ch === '`') {
      const scanned = scanTemplate(source, i);
      values.push(scanned.values.join(''));
      i = scanned.end;
      previousWord = '';
      previousChar = 's';
      continue;
    }
    if (ch === '/' && isRegexStart(source, i, previousWord, previousChar)) {
      i = skipRegex(source, i);
      previousWord = '';
      previousChar = 'r';
      continue;
    }
    if (/[A-Za-z_$]/.test(ch)) {
      const match = /^[A-Za-z_$][\w$]*/.exec(source.slice(i));
      previousWord = match?.[0] || '';
      i += (match?.[0]?.length || 1) - 1;
      previousChar = 'w';
    } else if (!/\s/.test(ch)) {
      previousChar = ch;
      previousWord = '';
    }
  }
  return values;
}

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ');
}

function visibleFragments(value) {
  const normalized = String(value || '').replace(/\\n/g, '\n');
  const fragments = [];
  if (normalized.includes('<')) {
    for (const match of normalized.matchAll(/>([^<>]+)</g)) fragments.push(match[1]);
    for (const attr of normalized.matchAll(/(?:placeholder|title|aria-label|alt)=["']([^"']+)["']/gi)) fragments.push(attr[1]);
  } else {
    fragments.push(normalized);
  }
  return fragments
    .flatMap(fragment => decodeHtml(fragment).split(/\r?\n|\s{3,}/))
    .map(fragment => fragment.replace(/\$\{[^}]+\}/g, '2').replace(/assignment2\b/g, 'assignments').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function isTechnical(value) {
  if (!/[A-Za-z]{2}/.test(value) || value.length > 420) return true;
  if (ALLOWED_EXACT.has(value)) return true;
  if (ALLOWED_PATTERNS.some(pattern => pattern.test(value))) return true;
  if (/^[a-z][\w.-]*(?::[\w.-]+)+$/i.test(value)) return true;
  if (/^(?:data-|aria-|--|var\(|rgb\(|hsl\(|calc\()/i.test(value)) return true;
  if (/\b(?:SELECT|FROM|WHERE|JOIN|VALUES|FOREIGN KEY|PRIMARY KEY|REFERENCES)\b/i.test(value)) return true;
  return false;
}

export function auditClientSourceI18n({ root = ROOT } = {}) {
  const issues = [];
  const files = fs.readdirSync(path.join(root, 'js'))
    .filter(name => name.endsWith('.js') && !EXCLUDED_FILES.has(name))
    .sort();
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, 'js', file), 'utf8');
    const candidates = new Set(extractJavaScriptStrings(source).flatMap(visibleFragments));
    for (const candidate of candidates) {
      if (isTechnical(candidate) || !UI_ENGLISH.test(candidate)) continue;
      const untranslated = [];
      for (const locale of TARGET_LOCALES) {
        setLocale(locale, { reload:false });
        if (translateSourceText(candidate) === candidate) untranslated.push(locale);
      }
      if (untranslated.length) issues.push({ file:`js/${file}`, text:candidate, locales:untranslated });
    }
  }
  setLocale('en', { reload:false });
  return issues;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const issues = auditClientSourceI18n();
  if (issues.length) {
    console.error(`i18n source audit failed with ${issues.length} untranslated client strings:`);
    for (const issue of issues) console.error(`- ${issue.file}: ${JSON.stringify(issue.text)} [${issue.locales.join(', ')}]`);
    process.exitCode = 1;
  } else {
    console.log('i18n source audit passed: no known user-facing English literals are outside the locale catalogs.');
  }
}

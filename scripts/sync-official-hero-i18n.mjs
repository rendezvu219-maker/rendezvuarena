import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { HEROES_DATA } from '../js/heroes-data.js';
import { compileHeroI18n } from './generate-hero-i18n.mjs';
import { htmlToOfficialText, normalizeOfficialCompare, parseOfficialHeroHtml } from './lib/official-hero-page-parser.mjs';
import { OFFICIAL_LOCALES, loadHeroI18nCatalog, validateHeroI18nCatalog } from './lib/official-hero-catalog.mjs';
import { applyInGameHeroOverride, applyInGameHeroOverridesToCatalog, loadInGameHeroOverrides, validateInGameHeroOverrides } from './lib/in-game-hero-overrides.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const catalogPath = path.join(root, 'data/locales/official-hero-details.json');
const heroNamesPath = path.join(root, 'data/locales/hero-names.json');
const heroNames = JSON.parse(fs.readFileSync(heroNamesPath, 'utf8'));
const inGameOverrides = loadInGameHeroOverrides();
validateInGameHeroOverrides(inGameOverrides);
const failureDir = path.join(root, 'data/locales/sync-failures');
const routes = { ja: 'https://dbg-squadra.bn-ent.net/hero/{id}', 'zh-CN': 'https://dbg-squadra.bn-ent.net/cn/hero/{id}', ko: 'https://dbg-squadra.bn-ent.net/ko/hero/{id}', es: 'https://dbg-squadra.bn-ent.net/es/hero/{id}' };
const acceptLanguage = { ja: 'ja-JP,ja;q=0.9', 'zh-CN': 'zh-CN,zh;q=0.9', ko: 'ko-KR,ko;q=0.9', es: 'es-ES,es;q=0.9' };

function readArg(name) { const prefix = `--${name}=`; const value = process.argv.find(arg => arg.startsWith(prefix)); return value ? value.slice(prefix.length) : ''; }
function parseList(value, fallback) { return value ? [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))] : fallback; }
function validateRequested(locales, ids) {
  const badLocales = locales.filter(locale => !OFFICIAL_LOCALES.includes(locale));
  const badIds = ids.filter(id => !HEROES_DATA[id]);
  if (badLocales.length) throw new Error(`Unsupported official locales: ${badLocales.join(', ')}`);
  if (badIds.length) throw new Error(`Unknown hero ids: ${badIds.join(', ')}`);
}
function normalizedPath(url) { return new URL(url).pathname.replace(/\/+$/, ''); }
function validateFinalUrl(actualUrl, expectedUrl) {
  if (normalizedPath(actualUrl) !== normalizedPath(expectedUrl)) throw new Error(`Official page redirected to ${actualUrl} instead of ${expectedUrl}.`);
}
async function fetchHtml(url, locale, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'follow', headers: { 'accept-language': acceptLanguage[locale], 'cache-control': 'no-cache', 'user-agent': 'Mozilla/5.0 (compatible; RendezVu-Arena-I18n-Sync/1.0; local build tool)' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) throw new Error(`Unexpected content type: ${contentType || 'missing'}`);
      return { html: await response.text(), finalUrl: response.url };
    } catch (error) { lastError = error; if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 500 * attempt)); }
  }
  throw lastError;
}
async function mapConcurrent(items, limit, worker) {
  const results = new Array(items.length); let cursor = 0;
  async function run() { while (cursor < items.length) { const index = cursor++; results[index] = await worker(items[index], index); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run)); return results;
}

function writeFailureSnapshot(locale, heroId, html, sourceUrl, error) {
  if (!html) return '';
  fs.mkdirSync(failureDir, { recursive: true });
  const base = path.join(failureDir, `${locale}-${heroId}`);
  fs.writeFileSync(`${base}.html`, html);
  fs.writeFileSync(`${base}.txt`, `${htmlToOfficialText(html)}
`);
  fs.writeFileSync(`${base}.json`, `${JSON.stringify({ locale, heroId, sourceUrl, error: error.message, capturedAt: new Date().toISOString() }, null, 2)}
`);
  return path.relative(root, base).replaceAll('\\', '/');
}

const locales = parseList(readArg('locales'), [...OFFICIAL_LOCALES]);
const ids = parseList(readArg('ids'), Object.keys(HEROES_DATA).sort());
const fromDir = readArg('from-dir');
const retryFailures = process.argv.includes('--retry-failures');
const concurrency = Math.max(1, Math.min(8, Number(readArg('concurrency') || 4)));
const allowPartial = process.argv.includes('--allow-partial');
const dryRun = process.argv.includes('--dry-run');
validateRequested(locales, ids);

const jobs = locales.flatMap(locale => ids.map(heroId => ({ locale, heroId })));
const failures = [];
const snapshots = await mapConcurrent(jobs, concurrency, async ({ locale, heroId }) => {
  const url = routes[locale].replace('{id}', heroId);
  let html = ''; let finalUrl = url;
  try {
    if (retryFailures) {
      const failureHtml = path.join(failureDir, `${locale}-${heroId}.html`);
      const fixtureHtml = path.join(root, 'data/locales/fixtures/live', `${locale}-${heroId}.html`);
      const savedHtml = [failureHtml, fixtureHtml].find(candidate => fs.existsSync(candidate));
      if (!savedHtml) throw new Error(`Saved failure snapshot not found: ${path.relative(root, failureHtml).replaceAll('\\', '/')}`);
      html = fs.readFileSync(savedHtml, 'utf8');
    } else if (fromDir) html = fs.readFileSync(path.resolve(fromDir, locale, `${heroId}.html`), 'utf8');
    else { const fetched = await fetchHtml(url, locale); html = fetched.html; finalUrl = fetched.finalUrl; validateFinalUrl(finalUrl, url); }
    const officialSnapshot = parseOfficialHeroHtml({ html, locale, heroId, heroName: heroNames[locale]?.[heroId], sourceDetail: HEROES_DATA[heroId], sourceUrl: url });
    const snapshot = applyInGameHeroOverride(officialSnapshot, locale, heroId, inGameOverrides);
    if (snapshot.translationStatus === 'official-site+in-game-verified') {
      console.warn(`[GAME] ${locale}.${heroId}: applied exact in-game evidence overlay.`);
    }
    const previousName = heroNames[locale]?.[heroId] || '';
    if (previousName && normalizeOfficialCompare(previousName) !== normalizeOfficialCompare(snapshot.officialName)) {
      console.warn(`[NAME] ${locale}.${heroId}: catalog "${previousName}" -> official "${snapshot.officialName}"`);
    }
    for (const [skillId, skill] of Object.entries(snapshot.skills || {})) {
      if (skill.officialEmpty === true) {
        console.warn(`[EMPTY] ${locale}.${heroId}.${skillId}: the official page contains no written description; preserving it as empty.`);
      }
    }
    console.log(`[OK] ${locale}.${heroId} <- ${finalUrl}`);
    return { locale, heroId, snapshot };
  } catch (error) {
    const debugBase = writeFailureSnapshot(locale, heroId, html, finalUrl, error);
    const debugHint = debugBase ? ` [debug: ${debugBase}.{html,txt,json}]` : '';
    const message = `${locale}.${heroId}: ${error.message}${debugHint}`;
    failures.push(message); console.error(`[ERR] ${message}`); return null;
  }
});

if (failures.length && !allowPartial) throw new Error(`Official sync aborted without changing local data. ${failures.length} page(s) failed:\n- ${failures.join('\n- ')}`);

const catalog = loadHeroI18nCatalog();
const nextHeroNames = structuredClone(heroNames);
for (const result of snapshots.filter(Boolean)) {
  catalog.locales[result.locale] ||= {};
  catalog.locales[result.locale][result.heroId] = result.snapshot;
  nextHeroNames[result.locale] ||= {};
  nextHeroNames[result.locale][result.heroId] = result.snapshot.officialName;
}
const effectiveCatalog = applyInGameHeroOverridesToCatalog(catalog, inGameOverrides);
validateHeroI18nCatalog(effectiveCatalog);
if (dryRun) { console.log(`Dry run complete. Parsed ${snapshots.filter(Boolean).length}/${jobs.length} page(s); no files were changed.`); process.exit(0); }

const catalogTemp = `${catalogPath}.tmp`; const namesTemp = `${heroNamesPath}.tmp`;
fs.writeFileSync(catalogTemp, `${JSON.stringify(effectiveCatalog, null, 2)}\n`);
fs.writeFileSync(namesTemp, `${JSON.stringify(nextHeroNames, null, 2)}\n`);
fs.renameSync(catalogTemp, catalogPath);
fs.renameSync(namesTemp, heroNamesPath);
compileHeroI18n();
console.log(`Official hero sync complete: ${snapshots.filter(Boolean).length}/${jobs.length} page(s) imported.${failures.length ? ` ${failures.length} failed page(s) were left unchanged.` : ''}`);

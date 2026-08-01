import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { HEROES } from '../js/heroes.js';
import { HEROES_DATA } from '../js/heroes-data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_ROOT = path.join(ROOT, 'assets', 'heroes');
const SOURCE_ORIGIN = String(process.env.HERO_ASSET_SOURCE_ORIGIN || 'https://dbg-squadra.bn-ent.net').replace(/\/$/, '');
const CONCURRENCY = Math.max(1, Math.min(Number(process.env.HERO_ASSET_CONCURRENCY || 6), 12));
const TIMEOUT_MS = Math.max(3_000, Number(process.env.HERO_ASSET_TIMEOUT_MS || 20_000));
const RETRIES = Math.max(0, Math.min(Number(process.env.HERO_ASSET_RETRIES || 2), 5));
const FORCE = process.argv.includes('--force');

const WEBP_MAGIC = [
  bytes => bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP',
];
const PNG_MAGIC = [bytes => bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))];

function isExpectedImage(bytes, extension) {
  const validators = extension === '.png' ? PNG_MAGIC : WEBP_MAGIC;
  return validators.some(validate => validate(bytes));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function fileIsValid(filePath, extension) {
  try {
    const info = await stat(filePath);
    if (!info.isFile() || info.size <= 0) return false;
    return isExpectedImage(await readFile(filePath), extension);
  } catch {
    return false;
  }
}

async function fetchBytes(url) {
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'Accept': 'image/avif,image/webp,image/png,image/*,*/*;q=0.8',
          'User-Agent': 'GekishinSquadraTournamentOps/asset-preparation',
        },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const type = String(response.headers.get('content-type') || '').toLowerCase();
      if (!type.startsWith('image/')) throw new Error(`Unexpected Content-Type ${type || '(missing)'}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length) throw new Error('Empty response body');
      return { bytes, contentType: type };
    } catch (error) {
      lastError = error;
      if (attempt < RETRIES) await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function downloadOne({ url, output, extension, heroId, kind, skillId = null }) {
  if (!FORCE && await fileIsValid(output, extension)) {
    const bytes = await readFile(output);
    return { heroId, kind, skillId, file: path.relative(ROOT, output).replaceAll(path.sep, '/'), source: url, bytes: bytes.length, sha256: sha256(bytes), reused: true };
  }

  const { bytes, contentType } = await fetchBytes(url);
  if (!isExpectedImage(bytes, extension)) {
    throw new Error(`Invalid ${extension} magic bytes from ${url} (${contentType})`);
  }

  await mkdir(path.dirname(output), { recursive: true });
  const temporary = `${output}.part-${process.pid}-${Math.random().toString(16).slice(2)}`;
  await writeFile(temporary, bytes, { flag: 'wx' });
  await rename(temporary, output);
  return { heroId, kind, skillId, file: path.relative(ROOT, output).replaceAll(path.sep, '/'), source: url, bytes: bytes.length, sha256: sha256(bytes), reused: false };
}

function heroJobs(hero) {
  const base = `${SOURCE_ORIGIN}/assets/images/hero/${hero.id}`;
  const dir = path.join(OUTPUT_ROOT, hero.id);
  const jobs = [
    { heroId: hero.id, kind: 'portrait', url: `${base}/btn_character.webp`, output: path.join(dir, 'btn_character.webp'), extension: '.webp' },
    { heroId: hero.id, kind: 'portrait_sp', url: `${base}/btn_character_sp.webp`, output: path.join(dir, 'btn_character_sp.webp'), extension: '.webp' },
    { heroId: hero.id, kind: 'portrait_hover', url: `${base}/btn_character_hover.webp`, output: path.join(dir, 'btn_character_hover.webp'), extension: '.webp' },
    { heroId: hero.id, kind: 'full', url: `${base}/image_character.webp${hero.id === '0039' ? '?v=2' : ''}`, output: path.join(dir, 'image_character.webp'), extension: '.webp' },
  ];

  for (const skill of HEROES_DATA[hero.id]?.skills || []) {
    const skillBase = `${base}/skill/icon_${skill.id}`;
    jobs.push({
      heroId: hero.id,
      kind: 'skill',
      skillId: skill.id,
      candidates: [
        { url: `${skillBase}.png`, output: path.join(dir, 'skill', `icon_${skill.id}.png`), extension: '.png' },
        { url: `${skillBase}.webp`, output: path.join(dir, 'skill', `icon_${skill.id}.webp`), extension: '.webp' },
      ],
    });
  }
  return jobs;
}

async function runJob(job) {
  if (!job.candidates) return downloadOne(job);

  let lastError;
  for (const candidate of job.candidates) {
    try {
      const result = await downloadOne({ ...candidate, heroId: job.heroId, kind: job.kind, skillId: job.skillId });
      const other = job.candidates.find(item => item.output !== candidate.output);
      if (other) await rm(other.output, { force: true });
      return result;
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`No valid icon format for hero ${job.heroId}, skill ${job.skillId}: ${lastError?.message || lastError}`);
}

async function mapLimit(items, limit, worker) {
  const output = new Array(items.length);
  let cursor = 0;
  async function consume() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      output[index] = await worker(items[index], index);
      const marker = output[index].reused ? 'cached' : 'downloaded';
      console.log(`[${index + 1}/${items.length}] ${marker} ${output[index].file}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, consume));
  return output;
}

const jobs = HEROES.flatMap(heroJobs);
await mkdir(OUTPUT_ROOT, { recursive: true });
console.log(`Preparing ${jobs.length} local hero assets for ${HEROES.length} heroes (concurrency ${CONCURRENCY}).`);

try {
  const files = await mapLimit(jobs, CONCURRENCY, runJob);
  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceOrigin: SOURCE_ORIGIN,
    heroCount: HEROES.length,
    assetCount: files.length,
    files,
  };
  await writeFile(path.join(OUTPUT_ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Done: ${files.length} validated images. Manifest: assets/heroes/manifest.json`);
} catch (error) {
  console.error(`Hero asset preparation failed: ${error.stack || error}`);
  process.exitCode = 1;
}

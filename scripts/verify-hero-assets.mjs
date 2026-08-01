import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { HEROES } from '../js/heroes.js';
import { HEROES_DATA } from '../js/heroes-data.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = path.join(ROOT, 'assets', 'heroes');
const manifest = JSON.parse(await readFile(path.join(ASSETS, 'manifest.json'), 'utf8'));
const entries = new Map(manifest.files.map(entry => [entry.file, entry]));

function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function isWebp(bytes) { return bytes.length >= 12 && bytes.subarray(0,4).toString('ascii') === 'RIFF' && bytes.subarray(8,12).toString('ascii') === 'WEBP'; }
function isPng(bytes) { return bytes.length >= 8 && bytes.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])); }

const expected = [];
for (const hero of HEROES) {
  for (const name of ['btn_character.webp','btn_character_hover.webp','btn_character_sp.webp','image_character.webp']) expected.push(`assets/heroes/${hero.id}/${name}`);
  for (const skill of HEROES_DATA[hero.id]?.skills || []) {
    const png = `assets/heroes/${hero.id}/skill/icon_${skill.id}.png`;
    const webp = `assets/heroes/${hero.id}/skill/icon_${skill.id}.webp`;
    assert(entries.has(png) || entries.has(webp), `Manifest missing icon for ${hero.id}/${skill.id}`);
    expected.push(entries.has(png) ? png : webp);
  }
}

assert.equal(new Set(expected).size, expected.length, 'Expected asset paths contain duplicates');
assert.equal(entries.size, expected.length, `Manifest has unexpected/missing entries: expected ${expected.length}, got ${entries.size}`);

for (const file of expected) {
  const entry = entries.get(file);
  assert(entry, `Manifest missing ${file}`);
  const full = path.join(ROOT, file);
  const info = await stat(full);
  assert(info.isFile() && info.size > 0, `Missing or empty ${file}`);
  const bytes = await readFile(full);
  assert(file.endsWith('.png') ? isPng(bytes) : isWebp(bytes), `Invalid image signature: ${file}`);
  assert.equal(sha256(bytes), entry.sha256, `SHA-256 mismatch: ${file}`);
  assert.equal(bytes.length, entry.bytes, `Size mismatch: ${file}`);
}

console.log(`Hero assets verified: ${HEROES.length} heroes, ${expected.length} images.`);

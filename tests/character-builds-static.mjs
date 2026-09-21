import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createBuildStore } from '../server/character-build-store.mjs';
import { loadStaticBuilds, resolveBuildBundle, buildsForHero } from '../js/character-builds.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = JSON.parse(fs.readFileSync(path.join(root, 'data/character-builds.json'), 'utf8'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'rv-static-builds-'));
const file = path.join(temp, 'character-builds.json');
fs.writeFileSync(file, JSON.stringify(source));
const store = createBuildStore(file);
let server;
let child;

async function stopChild() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit');
  child.kill();
  await exited;
  child = null;
}

try {
  const bundle = store.publicBundle('en');
  const goku = buildsForHero(bundle.presets, '0001')[0];
  const vegeta = buildsForHero(bundle.presets, '0002');
  assert.ok(goku && vegeta.length, 'Export must retain the existing Goku and Vegeta builds.');
  assert.equal(goku.slots.length, 3);
  assert.deepEqual(buildsForHero(bundle.presets, '0038'), [], 'An unassigned hero must have an empty, safe build list.');
  assert.equal(bundle.presets.length, source.presets.length, 'All current complete presets, including unassigned builds, must survive export.');
  for (const [presetId, heroId] of [[45,'0007'], [46,'0011'], [47,'0001'], [48,'0041']]) {
    assert.ok(buildsForHero(bundle.presets, heroId).some(preset => preset.id === presetId), `Preset ${presetId} must be visible on its named hero ${heroId}.`);
  }

  const saved = store.savePreset(goku.id, { ...goku, name:'Goku persistence check', locale:'en',
    slots:goku.slots.map(item => ({ slot:item.slot, cardId:item.card.id })),
    situationalSlots:goku.situationalSlots,
  });
  assert.equal(saved.name, 'Goku persistence check');
  assert.deepEqual(buildsForHero(store.publicBundle().presets, '0002'), vegeta, 'Saving Goku must preserve every Vegeta field.');
  const untouched = source.presets.filter(p => p.id !== goku.id);
  assert.deepEqual(store.read().presets.filter(p => p.id !== goku.id), untouched, 'Every other preset and assignment must be unchanged.');
  assert.deepEqual(store.read().presets.find(p => p.id === goku.id).swapOptions, source.presets.find(p => p.id === goku.id).swapOptions, 'Fixed situation positions and notes must survive saving.');
  assert.equal(JSON.parse(fs.readFileSync(`${file}.bak`, 'utf8')).presets.length, source.presets.length);
  const reloaded = createBuildStore(file).publicBundle();
  assert.equal(reloaded.presets.find(p => p.id === goku.id).name, saved.name, 'Reloading the store must read saved disk data.');
  const restartCheck = execFileSync(process.execPath, ['--input-type=module', '-e',
    `import {createBuildStore} from ${JSON.stringify(new URL('../server/character-build-store.mjs', import.meta.url).href)}; console.log(createBuildStore(process.argv[1]).publicBundle().presets.find(p=>p.id===${goku.id}).name);`, file], { encoding:'utf8' });
  assert.equal(restartCheck.trim(), saved.name, 'A fresh process must retain saved builds.');

  const beforeFailure = fs.readFileSync(file, 'utf8');
  assert.throws(() => store.savePreset(goku.id, { ...goku, slots:[{ slot:1, cardId:'missing-card' }] }));
  assert.equal(fs.readFileSync(file, 'utf8'), beforeFailure, 'Invalid saves must not damage the file.');
  fs.writeFileSync(`${file}.lock`, '');
  assert.throws(() => store.deletePreset(goku.id), /save is in progress/);
  fs.unlinkSync(`${file}.lock`);
  fs.writeFileSync(file, '{invalid');
  assert.throws(() => store.deletePreset(goku.id));
  assert.equal(fs.readFileSync(file, 'utf8'), '{invalid', 'Malformed JSON must not be reset to an empty catalog.');
  fs.writeFileSync(file, beforeFailure);

  const originalGogeta = buildsForHero(store.publicBundle().presets, '0041');
  const created = store.savePreset(null, { ...goku, name:'Test optional positions', locale:'vi', slots:goku.slots.map(item => ({ slot:item.slot, cardId:item.card.id })) });
  store.assignPreset({ presetId:created.id, heroIds:['0041'], makeDefault:true });
  assert.equal(buildsForHero(store.publicBundle('vi').presets, '0041')[0].id, created.id);
  store.assignPreset({ presetId:created.id, heroIds:['0041'], action:'unassign' });
  assert.deepEqual(buildsForHero(store.publicBundle().presets, '0041'), originalGogeta, 'Unassigning the temporary preset must retain Gogeta’s saved build and restore its default.');
  store.deletePreset(created.id);
  assert.ok(!store.read().presets.some(p => p.id === created.id));

  // A static server under a repository prefix has no /api endpoints at all.
  const app = express();
  app.get('/rendezvu-test/data/character-builds.json', (_req,res) => res.sendFile(file));
  app.use('/rendezvu-test/assets', express.static(path.join(root, 'assets')));
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const requests = [];
  const staticBundle = await loadStaticBuilds('vi', { moduleUrl:`${origin}/rendezvu-test/js/character-builds.js`, fetcher:(url, options) => { requests.push(String(url)); return fetch(url, options); } });
  assert.deepEqual(requests, [`${origin}/rendezvu-test/data/character-builds.json`]);
  assert.ok(buildsForHero(staticBundle.presets, '0001').length);
  for (const card of staticBundle.cards) {
    assert.ok(card.imagePath.startsWith(`${origin}/rendezvu-test/assets/divine-cards/`));
    assert.equal((await fetch(card.imagePath)).status, 200);
  }
  for (const locale of ['en','ja','zh-CN','vi']) assert.equal(resolveBuildBundle(source, { locale }).cards.length, 18);
  await new Promise(resolve => server.close(resolve));
  server = null;

  // Exercise the actual local Admin routes against disposable files/database.
  const portServer = app.listen(0, '127.0.0.1');
  await once(portServer, 'listening');
  const port = portServer.address().port;
  await new Promise(resolve => portServer.close(resolve));
  const apiOrigin = `http://127.0.0.1:${port}`;
  let logs = '';
  child = spawn(process.execPath, ['server.js'], { cwd:root, env:{ ...process.env,
    PORT:String(port), DATABASE_PATH:path.join(temp, 'auth.sqlite'), CHARACTER_BUILDS_PATH:file,
    UPLOAD_PATH:path.join(temp, 'uploads'), ADMIN_EMAIL:'build-admin@example.test', ADMIN_USERNAME:'build-admin', ADMIN_PASSWORD:'Build-test-strong-password-2026!',
    PUBLIC_ORIGIN:apiOrigin, ALLOWED_ORIGINS:apiOrigin, NODE_ENV:'test',
  }, stdio:['ignore','pipe','pipe'], windowsHide:true });
  child.stdout.on('data', data => { logs += data; });
  child.stderr.on('data', data => { logs += data; });
  for (let retry = 0; retry < 80; retry++) {
    if (child.exitCode !== null) throw new Error(logs);
    try { if ((await fetch(`${apiOrigin}/data/character-builds.json`)).ok) break; } catch {}
    if (retry === 79) throw new Error(`Test server did not start: ${logs}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const login = await fetch(`${apiOrigin}/api/auth/login`, { method:'POST', headers:{ 'Content-Type':'application/json', 'X-CSRF-Token':'1', Origin:apiOrigin }, body:JSON.stringify({ identity:'build-admin', password:'Build-test-strong-password-2026!' }) });
  assert.equal(login.status, 200, await login.clone().text());
  const cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  const response = await fetch(`${apiOrigin}/api/admin/divine-card-presets/${goku.id}`, { method:'PUT', headers:{ 'Content-Type':'application/json', 'X-CSRF-Token':'1', Origin:apiOrigin, Cookie:cookie }, body:JSON.stringify({ ...saved, name:'Saved through Admin API', slots:saved.slots.map(item => ({ slot:item.slot, cardId:item.card.id })) }) });
  assert.equal(response.status, 200, await response.clone().text());
  assert.equal((await response.json()).preset.name, 'Saved through Admin API');
  const publicFile = await (await fetch(`${apiOrigin}/data/character-builds.json`)).json();
  assert.equal(publicFile.presets.find(p => p.id === goku.id).name, 'Saved through Admin API');
  assert.deepEqual(publicFile.presets.filter(p => p.id !== goku.id), untouched);
  assert.equal((await fetch(`${apiOrigin}/api/admin/divine-card-builds`)).status, 401);
  await stopChild();
  console.log('Static builds: hero selection, preservation, Admin save, reload/restart, invalid writes and GitHub Pages subpaths passed.');
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await stopChild();
  fs.rmSync(temp, { recursive:true, force:true });
}

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { P2PDraftSync } from '../js/p2p-sync.js';
import { DRAFT_LINK_VERSION, p2pDraftLinks, readDraftRoomLink, validateDraftRoomLink, copyDraftLink } from '../js/draft-links.js';

// No BroadcastChannel or shared client storage: each participant must use the
// remote protocol. The fake signalling/data network lets us exercise races.
const peers = new Map();
const options = [];
let serial = 0;
let snapshotDelay = 0;
let blackhole = false;
class Connection extends EventEmitter {
  open = false;
  closed = false;
  send(value) {
    assert.ok(this.open);
    const delay = JSON.parse(value).kind === 'init' ? snapshotDelay : 0;
    setTimeout(() => { if (!this.remote.closed) this.remote.emit('data', value); }, delay);
  }
  close() {
    if (this.closed) return;
    this.closed = true; this.open = false; this.emit('close');
    if (this.remote && !this.remote.closed) this.remote.close();
  }
}
class Peer extends EventEmitter {
  constructor(id, config) {
    super();
    if (typeof id === 'object') { config = id; id = `client-${++serial}`; }
    this.id = id; this.destroyed = false; this.disconnected = false; this.connections = [];
    options.push(config);
    queueMicrotask(() => {
      if (this.destroyed) return;
      if (peers.has(id)) return this.emit('error', { type:'unavailable-id', message:'Already in use' });
      peers.set(id, this); this.emit('open', id);
    });
  }
  connect(id) {
    const local = new Connection();
    this.connections.push(local);
    queueMicrotask(() => {
      if (this.destroyed || local.closed) return;
      const host = peers.get(id);
      if (!host) return this.emit('error', { type:'peer-unavailable' });
      if (blackhole) return;
      const remote = new Connection();
      local.remote = remote; remote.remote = local;
      host.connections.push(remote);
      host.emit('connection', remote);
      local.open = remote.open = true;
      remote.emit('open'); local.emit('open');
    });
    return local;
  }
  reconnect() { this.disconnected = false; queueMicrotask(() => this.emit('open', this.id)); }
  destroy() {
    this.destroyed = true;
    if (peers.get(this.id) === this) peers.delete(this.id);
    for (const conn of this.connections) conn.close();
  }
}
const savedWindow = globalThis.window;
const savedStorage = globalThis.localStorage;
const storage = new Map();
globalThis.window = { Peer, location:{ href:'https://example.test/project/draft-room.html' } };
globalThis.localStorage = { getItem:key => storage.get(key) || null, setItem:(key,value) => storage.set(key,value) };
const sessions = [];
const secrets = { host:'host-secret', teamA:'blue-secret', teamB:'red-secret', broadcaster:'watch-secret' };
const config = { teamA:'Blue QA', teamB:'Red QA', heroBans:3, enableCoinFlip:false, format:'BO5' };
function session(role, roomCode = 'QATEST', extra = {}) {
  const value = new P2PDraftSync({ roomCode, role, accessToken:secrets[role],
    connectTimeoutMs:1000, retryDelayMs:10, attemptTimeoutMs:100, ...extra });
  sessions.push(value);
  return value;
}
function seed(roomCode) {
  storage.set(`rv_config_${roomCode}`, JSON.stringify(config));
  storage.set(`rv_secrets_${roomCode}`, JSON.stringify(secrets));
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await pause(5); }
  assert.fail('Timed out waiting for protocol state');
}
try {
  const links = p2pDraftLinks(window.location.href, 'QATEST', 'rv-qatest', secrets);
  for (const [role, link] of Object.entries(links)) {
    const url = new URL(link), fragment = new URLSearchParams(url.hash.slice(1));
    assert.ok(url.pathname.startsWith('/project/'));
    assert.equal(url.searchParams.get('v'), DRAFT_LINK_VERSION, 'New invites must bypass stale room HTML.');
    assert.equal(fragment.get('access'), secrets[role]);
    assert.equal(fragment.get('role'), role);
    assert.equal(validateDraftRoomLink(readDraftRoomLink(link)).accessToken, secrets[role]);
  }
  const queryInvite = new URL(links.teamB);
  queryInvite.search = queryInvite.hash.slice(1); queryInvite.hash = '';
  assert.equal(validateDraftRoomLink(readDraftRoomLink(queryInvite)).accessToken, secrets.teamB, 'Query-string invites must retain credentials too.');
  const incomplete = 'https://example.test/project/draft-room.html#room=QATEST&role=teamB&host=rv-qatest';
  assert.throws(() => validateDraftRoomLink(readDraftRoomLink(incomplete)), /DRAFT_LINK_MISSING_ACCESS/);
  const mixed = new URL(incomplete); mixed.search = '?room=OTHER&access=other-secret';
  assert.throws(() => validateDraftRoomLink(readDraftRoomLink(mixed)), /DRAFT_LINK_MISSING_ACCESS/, 'Never borrow a credential from a different invitation.');
  assert.throws(() => p2pDraftLinks(window.location.href, 'QATEST', 'rv-qatest', { host:'only-host' }), /DRAFT_LINK_MISSING_ACCESS/);
  assert.throws(() => validateDraftRoomLink({ roomCode:'QATEST', accessToken:'secret', hostParam:'rv-qatest', role:'referee' }), /DRAFT_LINK_INVALID_ROLE/);

  let copiedText = '', selected = false, fallback = false;
  const copyButton = { textContent:'COPY' };
  const copyInput = { value:links.teamB, focus() {}, select() { selected = true; }, ownerDocument:{ execCommand() { fallback = true; return true; } } };
  assert.equal(await copyDraftLink(copyInput, copyButton, { async writeText(text) { copiedText = text; } }), true);
  assert.equal(copiedText, links.teamB);
  assert.equal(copyButton.textContent, 'COPIED');
  assert.equal(await copyDraftLink(copyInput, copyButton, { async writeText() { throw new Error('Permission denied'); } }), true);
  assert.ok(selected && fallback, 'Denied Clipboard API must try copying selected text.');
  copyInput.ownerDocument.execCommand = () => false;
  assert.equal(await copyDraftLink(copyInput, copyButton, {}), false);
  assert.equal(copyButton.textContent, 'PRESS CTRL+C', 'A blocked copy must not report success.');
  copyInput.value = incomplete; copiedText = '';
  assert.equal(await copyDraftLink(copyInput, copyButton, { async writeText(text) { copiedText = text; } }), false);
  assert.equal(copiedText, '', 'Do not put an incomplete invitation into the clipboard.');
  assert.equal(copyButton.textContent, 'INVALID LINK');
  seed('QATEST');
  const host = session('host'); await host.connect();
  assert.deepEqual(host.shareLinks, links);
  host.publishState({ engine:{ step:2 }, gameRollId:'same-room' });
  storage.clear(); // Joining browsers cannot see the Host's local room/secrets.
  snapshotDelay = 4200;
  const blue = session('teamA', 'QATEST', { connectTimeoutMs:6500, attemptTimeoutMs:6000 });
  let joined = false;
  const blueJoin = blue.connect().then(() => { joined = true; });
  await pause(4100); // Beyond the old four-second fake-success fallback.
  assert.equal(joined, false, 'Opening a channel/local cache cannot substitute for the Host snapshot');
  await blueJoin;
  assert.deepEqual(blue.config, config);
  assert.equal(blue.initialState.engine.step, 2);
  snapshotDelay = 0;
  const red = session('teamB'); await red.connect();
  await until(() => blue.presence.teamB === 1 && red.presence.teamA === 1);
  assert.equal(host.presence.teamA, 1);
  assert.equal(host.presence.teamB, 1);
  blue.hostConn.send(JSON.stringify({ kind:'hello', role:'teamA', accessToken:secrets.teamA }));
  await pause(10);
  assert.equal(host.presence.teamA, 1, 'Repeated hello must not count the same player twice');
  const commands = [];
  host.on('command', value => commands.push(value));
  blue.sendCommand('select', { heroId:'0001' });
  await until(() => commands.length === 1);
  assert.equal(commands[0].fromRole, 'teamA');
  const spectator = session('broadcaster'); await spectator.connect();
  spectator.sendCommand('lock', { heroId:'0001' });
  await pause(10);
  assert.equal(commands.length, 1, 'Spectators cannot submit draft commands');
  host.publishState({ engine:{ step:3 } });
  await until(() => blue.initialState.engine.step === 3 && red.initialState.engine.step === 3);
  const oldConn = blue.hostConn;
  oldConn.close();
  await until(() => blue.hostConn && blue.hostConn !== oldConn && blue.initialState.engine.step === 3 && host.presence.teamA === 1);
  blue.disconnect();
  const peerCount = peers.size;
  await pause(40);
  assert.equal(peers.size, peerCount, 'Disconnect must not create retry connections');

  // A team opens its link first; the host comes online after the first failed offer.
  const early = session('teamA', 'LATEHOST');
  const earlyJoin = early.connect();
  await pause(30); seed('LATEHOST');
  const lateHost = session('host', 'LATEHOST'); await lateHost.connect();
  await earlyJoin;
  assert.deepEqual(early.config, config);

  // Silent data-channel failure must retry and ultimately report a connection error.
  blackhole = true;
  const blocked = session('teamB', 'LATEHOST', { connectTimeoutMs:90, attemptTimeoutMs:20 });
  await assert.rejects(blocked.connect(), /connection failure, not a missing opponent/);
  assert.equal(blocked.config, null, 'Never invent a room configuration on timeout');
  assert.equal(blocked.peer, null);
  blackhole = false;
  await assert.rejects(session('teamA', 'QATEST', { accessToken:'' }).connect(), /Incomplete team link/);
  assert.ok(options.every(option => !('config' in option)), 'Do not override bundled TURN with STUN-only settings');
  const app = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
  assert.match(app, /linkA\.value = links\.teamA/);
  assert.doesNotMatch(app, /linkA\.value = .*hostPeerId/);
  assert.match(app, /copyDraftLink\(input, btn\)/);
  assert.match(app, /validateDraftRoomLink\(invitation\)/);
  const setup = fs.readFileSync(new URL('../js/host-setup.js', import.meta.url), 'utf8');
  assert.match(setup, /p2pDraftLinks\(window.location.href/);
  assert.match(setup, /copyDraftLink\(input, button\)/);
  const oldPage = fs.readFileSync(new URL('../quick-match.html', import.meta.url), 'utf8');
  assert.match(oldPage, /http-equiv="refresh" content="0;url=quick-draft.html"/);
  assert.doesNotMatch(oldPage, /quick-form/);
  console.log('P2P Draft: isolated participants, delayed snapshot/host, presence, commands, resync, timeout, relay defaults and role links passed.');
} finally {
  for (const value of sessions) value.disconnect();
  globalThis.window = savedWindow;
  if (savedStorage === undefined) delete globalThis.localStorage;
  else globalThis.localStorage = savedStorage;
}

import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { createBracket, deriveBracket } from '../js/static-core.js';
import { saveLocalTournament, prepareTournamentRoom, saveTournamentDraftGame,
  tournamentEvents, resumeTournamentConfig, restoreTournamentRoom } from '../js/tournament-draft.js';
import { P2PDraftSync } from '../js/p2p-sync.js';
import { DraftEngine } from '../js/draft.js';
import { TournamentBracketSync } from '../js/tournament-bracket-sync.js';
import { DIVINE_RULES, DISABLED_DIVINE_RULES, drawRandomDivineIndices } from '../js/pre-draft.js';

const peers = new Map(); let serial = 0;
class Connection extends EventEmitter {
  open = false;
  send(value) { queueMicrotask(() => { if (this.remote.open) this.remote.emit('data', structuredClone(value)); }); }
  close() { if (!this.open) return; this.open = false; this.emit('close'); this.remote.close(); }
}
class Peer extends EventEmitter {
  constructor(id) {
    super(); this.id = typeof id === 'string' ? id : `guest-${++serial}`; this.connections = [];
    queueMicrotask(() => { peers.set(this.id, this); this.emit('open', this.id); });
  }
  connect(id) {
    const conn = new Connection(); this.connections.push(conn);
    queueMicrotask(() => {
      const remote = new Connection(); conn.remote = remote; remote.remote = conn;
      const host = peers.get(id); assert.ok(host, `Host ${id} must exist`);
      host.connections.push(remote); host.emit('connection', remote);
      conn.open = remote.open = true; remote.emit('open'); conn.emit('open');
    });
    return conn;
  }
  destroy() { this.destroyed = true; peers.delete(this.id); this.connections.forEach(conn => conn.close()); }
}
const values = new Map();
const storage = { getItem:key => values.get(key) || null, setItem:(key, value) => values.set(key, value) };
const savedWindow = globalThis.window, savedStorage = globalThis.localStorage;
globalThis.window = { Peer, location: { href:'https://example.test/rendezvuarena/bracket.html' } };
globalThis.localStorage = storage;
const sessions = [];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) { for (let i=0; i<100; i++) { if (check()) return; await pause(5); } assert.fail('Timed out waiting for room snapshot'); }

try {
  const config = { id:'ISOLATION', name:'Eight teams', teams:['Phainon','Hyacine','Alpha','Beta','Gamma','Delta','Epsilon','Zeta'],
    rules:{ bestOf:3, seriesRule:'squadra_blast', enableCoinFlip:true, enableDivineDraw:true, banOrder:['B','A'], pickOrder:['A','B','B','A','B','A','A','B'] },
    roomIds:Object.fromEntries(Array.from({length:7},(_,i)=>[`M${i+1}`,`ROOM00${i+1}`])), createdAt:1 };
  const secrets = { O:'organizer-private-token', matches:Object.fromEntries(Object.keys(config.roomIds).map((id, i) => [id,
    { A:`blue-private-${i}`, B:`red-private-${i}`, O:`host-private-${i}`, S:`spec-${i}` }])) };
  saveLocalTournament(config, secrets);
  const matches = createBracket(config.teams, 3);
  const rooms = await Promise.all(matches.slice(0,4).map(match => prepareTournamentRoom(config, match, secrets, window.location.href)));
  assert.equal(new Set(rooms.map(room => room.roomCode)).size, 4);
  assert.equal(new Set(rooms.flatMap(room => Object.values(room.links))).size, 16);
  for (const room of rooms) {
    assert.equal(new URL(room.links.host).pathname, '/rendezvuarena/draft-room.html');
    assert.equal(new URL(room.links.broadcaster).pathname, '/rendezvuarena/broadcast.html');
    assert.ok(Object.values(room.links).every(link => link.includes('access=') && link.includes('host=')));
    assert.equal(room.config.quickDraft, true);
    assert.equal(JSON.stringify(room.config).includes(secrets.O), false);
    const host = new P2PDraftSync({ roomCode:room.roomCode, role:'host', accessToken:secrets.matches[room.config.tournamentMatchId].O });
    sessions.push(host); await host.connect();
    room.host = host; room.clients = {};
    for (const [role, key] of [['teamA','A'],['teamB','B'],['broadcaster','S']]) {
      const client = new P2PDraftSync({ roomCode:room.roomCode, role, accessToken:secrets.matches[room.config.tournamentMatchId][key], connectTimeoutMs:1000 });
      sessions.push(client); await client.connect(); room.clients[role] = client;
      assert.equal(client.config.teamA, room.config.teamA);
      assert.equal(client.config.teamB, room.config.teamB);
      assert.equal(JSON.stringify(client.config).includes(secrets.O), false);
    }
  }
  let firstCommand, otherCommand;
  rooms[0].host.on('command', command => { firstCommand = command; });
  rooms[1].host.on('command', command => { otherCommand = command; });
  rooms[0].clients.teamB.sendCommand('select', { heroId:'0029', team:'B' });
  await until(() => firstCommand);
  assert.equal(firstCommand.fromRole, 'teamB'); assert.equal(otherCommand, undefined);
  assert.equal(rooms[0].clients.broadcaster.sendCommand('lock', {}), false);
  let received, leaked;
  rooms[0].clients.teamA.on('state', state => { received = state; });
  rooms[1].clients.teamA.on('state', state => { leaked = state; });
  rooms[0].host.publishState({ gameNumber:1, marker:'M1 only' });
  await until(() => received); assert.equal(leaked, undefined);

  const engine = { state:'complete', teamA:{ picks:['0001','0002','0003','0004'], bans:['0039'] }, teamB:{ picks:['0029','0005','0006','0007'], bans:['0040'] } };
  const context = { config:rooms[0].config, roomCode:rooms[0].roomCode, hostToken:secrets.matches.M1.O, winnerSide:'A', engine,
    sideAssignment:{ A:'teamB', B:'teamA' }, chosenDivineRules:[DIVINE_RULES[4], DIVINE_RULES[5]] };
  const gameOne = await saveTournamentDraftGame(context);
  const before = values.get('rv_tournament_events_ISOLATION_M1');
  assert.equal((await saveTournamentDraftGame(context)).alreadyRecorded, true);
  assert.equal(values.get('rv_tournament_events_ISOLATION_M1'), before);
  await assert.rejects(saveTournamentDraftGame({ ...context, roomCode:rooms[1].roomCode }), /does not belong/);
  await assert.rejects(saveTournamentDraftGame({ ...context, hostToken:secrets.matches.M1.A }), /does not belong/);
  const resumed = await prepareTournamentRoom(config, matches[0], secrets, window.location.href);
  assert.deepEqual(resumed.links, rooms[0].links);
  assert.equal(resumed.config.gameNumber, 2);
  assert.deepEqual(resumed.config.previousPicksA, engine.teamB.picks);
  assert.deepEqual(resumed.config.previousPicksB, engine.teamA.picks);
  assert.deepEqual(resumed.config.previousBansA, ['0040']);
  assert.deepEqual(resumed.config.sideAssignment, context.sideAssignment);
  for (const other of rooms.slice(1)) assert.equal(JSON.parse(values.get(`rv_config_${other.roomCode}`)).gameNumber, 1);
  const gameTwo = await saveTournamentDraftGame({ ...context, config:resumed.config, winnerSide:'B' });
  const third = resumeTournamentConfig(resumed.config, [gameOne, gameTwo]);
  assert.deepEqual([third.seriesScoreA, third.seriesScoreB], [1,1]);
  assert.deepEqual(third.previousPicksA, []); assert.deepEqual(third.previousBansA, []);
  assert.deepEqual(restoreTournamentRoom(rooms[0].config), third);
  let bracket = deriveBracket(config, tournamentEvents(config));
  assert.deepEqual([bracket[0].scoreA,bracket[0].scoreB], [1,1]);
  assert.equal(bracket[1].scoreA, undefined); assert.equal(bracket[4].teamA, 'Winner M1');
  await saveTournamentDraftGame({ ...context, config:third, winnerSide:'A' });
  bracket = deriveBracket(config, tournamentEvents(config));
  assert.equal(bracket[0].winner, 'Phainon'); assert.deepEqual([bracket[0].scoreA,bracket[0].scoreB], [2,1]);
  assert.equal(bracket[4].teamA, 'Phainon'); assert.equal(bracket[4].teamB, 'Winner M2');
  await assert.rejects(prepareTournamentRoom(config, bracket[4], secrets, window.location.href), /Both teams/);
  const wrongWinner = await saveTournamentDraftGame({ ...context, config:rooms[1].config, roomCode:rooms[1].roomCode, hostToken:secrets.matches.M2.O, winnerSide:'B' });
  assert.equal(wrongWinner.matchId, 'M2');
  assert.equal(deriveBracket(config, tournamentEvents(config))[0].scoreA, 2);
  const otherNext = resumeTournamentConfig(rooms[1].config, [wrongWinner]);
  await saveTournamentDraftGame({ ...context, config:otherNext, roomCode:rooms[1].roomCode, hostToken:secrets.matches.M2.O, winnerSide:'B' });
  const semifinal = deriveBracket(config, tournamentEvents(config)).find(match => match.id === 'M5');
  const semifinalRoom = await prepareTournamentRoom(config, semifinal, secrets, window.location.href);
  assert.deepEqual([semifinalRoom.config.teamA, semifinalRoom.config.teamB], ['Phainon','Beta']);
  assert.equal(semifinalRoom.config.gameNumber, 1);
  assert.deepEqual(semifinalRoom.config.previousPicksA, []);
  assert.deepEqual(semifinalRoom.config.previousBansA, []);
  assert.deepEqual([semifinalRoom.config.seriesScoreA, semifinalRoom.config.seriesScoreB], [0,0]);
  for (const rule of ['fearless','team_no_repeat','normal']) {
    const next = resumeTournamentConfig({ ...rooms[0].config, seriesRule:rule }, [gameOne]);
    assert.deepEqual(next.previousPicksA, engine.teamB.picks); assert.deepEqual(next.previousBansA, []);
    const draft = new DraftEngine({ ...next, previousPicksA:next.previousPicksA, previousPicksB:next.previousPicksB });
    assert.equal(draft.seriesPickedByTeam.A.has('0029'), true);
  }
  const ordered = new DraftEngine({ ...rooms[0].config, gameNumber:1 });
  assert.deepEqual(ordered.sequence.slice(0,2), [{type:'ban',team:'B'},{type:'ban',team:'A'}]);
  assert.deepEqual(ordered.sequence.filter(step=>step.type==='pick').map(step=>step.team), config.rules.pickOrder);
  const blast = new DraftEngine({ ...resumed.config });
  assert.ok(blast.sequence.every(step => step.type === 'pick'));

  let publicSnapshot;
  const relay = new TournamentBracketSync({ id:config.id, host:true, PeerClass:Peer });
  sessions.push(relay); relay.connect(); await pause(0);
  relay.publish({ ...config, secrets }, tournamentEvents(config));
  const viewer = new TournamentBracketSync({ id:config.id, PeerClass:Peer, onSnapshot:state=>{ publicSnapshot=state; } });
  sessions.push(viewer); viewer.connect(); await until(()=>publicSnapshot);
  assert.equal(JSON.stringify(publicSnapshot).includes(secrets.O), false);
  assert.equal(publicSnapshot.events && deriveBracket(publicSnapshot.config, publicSnapshot.events)[0].scoreB, 1);
  assert.deepEqual(DIVINE_RULES.length, 8);
  assert.ok(!DIVINE_RULES.some(rule=>['Mystery HP','Super DMG Boost'].includes(rule.name)));
  assert.ok(DIVINE_RULES.some(rule=>rule.name==='Sparkly Stardust') && DIVINE_RULES.some(rule=>rule.name==='Super CD Vanishing Step'));
  for (const rule of [...DIVINE_RULES, ...DISABLED_DIVINE_RULES]) assert.ok(fs.existsSync(new URL(`../divine/${rule.file}`, import.meta.url)));
  for (let i=0;i<100;i++) assert.ok(drawRandomDivineIndices().every(index=>!DISABLED_DIVINE_RULES.some(rule=>rule.name===DIVINE_RULES[index].name)));
  console.log('Static bracket: four independent P2P rooms, team links, read-only spectator, scoped results/history, 1–1 score, side persistence, rejoin, custom turns and advancement passed. Seasonal Draw pool and retained disabled images passed.');
} finally {
  sessions.forEach(session=>session.disconnect());
  globalThis.window = savedWindow; globalThis.localStorage = savedStorage;
}

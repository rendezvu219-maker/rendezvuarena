import assert from 'node:assert/strict';
import { DraftEngine } from '../js/draft.js';
globalThis.document = { getElementById:() => null, addEventListener() {} };
const { DraftUI } = await import('../js/app.js');
const { resolvedSideConfig } = await import('../js/broadcast-page.js');

class HeadlessDraftUI extends DraftUI {
  init() {}
  renderEntrantCards() {}
  bindPreDraftControls() {}
  renderPreDraftState() {}
  schedulePreDraftAutomation() {}
  publishRoomState() {}
  updateSeriesScoreDisplay() {}
  applyAccessMode() {}
  setSeriesControlsBusy() {}
}
const swapped = { A:'teamB', B:'teamA' };
globalThis.window = { confirm:() => true, location:{ reload() {} } };
const game1 = new HeadlessDraftUI({
  gameNumber:1,gameRollId:'game-one',format:'BO3',seriesRule:'squadra_blast',seriesScoreA:0,seriesScoreB:0,
  teamA:'Entrant Alpha',teamB:'Entrant Beta',enableCoinFlip:true,
});
game1.applySideAssignment(swapped);
assert.deepEqual(game1.config.sideAssignment,swapped,'The chosen sides must be serializable, not only in transient pre-draft state.');
game1.engine = new DraftEngine({timerAuthority:false});
game1.engine.teamA.picks = ['0001']; // Blue is original Team B.
game1.engine.teamB.picks = ['0002']; // Red is original Team A.
game1.engine.teamA.bans = ['0003'];
game1.engine.teamB.bans = ['0004'];
let transition;
game1.sync = {publishState:state => { transition = structuredClone(state); }};
const realTimeout = globalThis.setTimeout;
try {
  globalThis.setTimeout = () => 0;
  await game1.recordGameWinner('A'); // Original Team A lost while playing red.
} finally { globalThis.setTimeout = realTimeout; }
assert.equal(transition.gameNumber,2);
assert.equal(transition.nextConfig.seriesScoreA,0);
assert.equal(transition.nextConfig.seriesScoreB,1);
assert.deepEqual(transition.nextConfig.sideAssignment,swapped);
assert.deepEqual(transition.nextConfig.previousPicksA,['0002']);
assert.deepEqual(transition.nextConfig.previousPicksB,['0001']);

// Round-trip through JSON, just like a P2P config or a local shared link.
for(const role of ['host','teamA','teamB']) for(const enableDivineDraw of [false,true]) {
  const next = JSON.parse(JSON.stringify(transition.nextConfig));
  const ui = new HeadlessDraftUI({...next,_roomRole:role,enableDivineDraw});
  assert.deepEqual(ui.sideAssignment,swapped,'Reload must restore sides before constructing the engine.');
  assert.equal(ui.sideForRole('teamA'),'B');
  assert.equal(ui.roleForSide('A'),'teamB');
  assert.equal(ui.teamForSide('A').name,'Entrant Beta');
  assert.equal(ui.scoreForSide('A'),1);
  assert.equal(ui.scoreForSide('B'),0);
  assert.deepEqual(ui.previousPicksForSide('B'),['0002']);
  ui.startPreDraft();
  assert.deepEqual(ui.preDraftState.sideAssignment,swapped,'Divine setup must not reset the carried sides.');
  assert.equal(ui.preDraftState.stage,enableDivineDraw?'divine':'complete');
  const spectator = resolvedSideConfig(ui.config,{gameNumber:2});
  assert.equal(spectator.teamA,'Entrant Beta');
  assert.equal(spectator.teamB,'Entrant Alpha');
  assert.equal(spectator.seriesScoreA,1);
  assert.deepEqual(spectator.previousPicksA,['0001']);
}
const fresh = new HeadlessDraftUI({gameNumber:1,enableCoinFlip:true,sideAssignment:swapped});
assert.equal(fresh.sideAssignment,null,'A new series with a coin flip must not inherit its prior side selection.');
fresh.startPreDraft();
assert.equal(fresh.preDraftState.stage,'coin-call');
assert.equal(fresh.preDraftState.sideAssignment,null);
const legacy = new HeadlessDraftUI({gameNumber:2,enableCoinFlip:false});
legacy.startPreDraft();
assert.deepEqual(legacy.sideAssignment,{A:'teamA',B:'teamB'},'Old configs without saved sides retain the default.');
console.log('Game 1 red-side loser stays red after Game 2 reload; scores, history, Divine setup and Spectator agree.');

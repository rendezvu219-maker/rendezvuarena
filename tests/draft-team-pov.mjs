import assert from 'node:assert/strict';
import { DraftEngine } from '../js/draft.js';
import { HEROES } from '../js/heroes.js';
import { DRAFT_LINK_VERSION } from '../js/draft-links.js';

function element() {
  return {
    children: [], dataset: {}, style: {}, events: {}, className: '',
    classList: { add() {}, remove() {}, toggle() {} },
    set innerHTML(value) { this.markup = value; this.children = []; },
    get innerHTML() { return this.markup || ''; },
    appendChild(child) { this.children.push(child); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    addEventListener(type, fn) { this.events[type] = fn; },
  };
}
const nodes = new Map();
globalThis.document = { getElementById:id => nodes.get(id) || null, createElement:element };
const { DraftUI } = await import('../js/app.js');
const { P2PDraftSync } = await import(`../js/p2p-sync.js?v=${DRAFT_LINK_VERSION}`);
const vegito = HEROES.find(hero => /vegito/i.test(hero.name));
assert.ok(vegito);
const opponentPick = HEROES.find(hero => hero.id !== vegito.id);
const ban = HEROES.find(hero => ![vegito.id, opponentPick.id].includes(hero.id));

function makeUI(role, assignment, gameNumber = 2, seriesRule = 'squadra_blast') {
  const ui = Object.create(DraftUI.prototype);
  Object.assign(ui, {
    config:{ gameNumber, seriesRule, previousPicksA:[vegito.id], previousPicksB:[opponentPick.id], previousBansA:[ban.id] },
    sync:{}, roomRole:role, sideAssignment:assignment, grid:element(), currentFilter:'all',
  });
  ui.engine = new DraftEngine({
    ...ui.config, timerAuthority:false,
    previousPicksA:ui.previousPicksForSide('A'), previousPicksB:ui.previousPicksForSide('B'),
    previousBansA:ui.previousBansForSide('A'), previousBansB:ui.previousBansForSide('B'),
  });
  return ui;
}
function card(ui, id) { return ui.grid.children.find(item => item.dataset.heroId === id); }
for (const assignment of [{A:'teamA',B:'teamB'}, {A:'teamB',B:'teamA'}]) {
  for (const turn of ['A','B']) {
    for (const role of ['teamA','teamB','host','broadcaster']) {
      const ui = makeUI(role, assignment);
      ui.engine.sequence = [{type:'pick',team:turn}];
      ui.renderGrid();
      const viewer = ['teamA','teamB'].includes(role) ? role : assignment[turn];
      assert.equal(card(ui,vegito.id).className.includes('unavailable'), viewer === 'teamA', `${role}/${turn}: Vegito must only lock for its original team.`);
      assert.equal(card(ui,opponentPick.id).className.includes('unavailable'), viewer === 'teamB');
      assert.ok(card(ui,ban.id).className.includes('unavailable'), 'Actual carried bans stay global.');
      if (['teamA','teamB'].includes(role) && assignment[turn] !== role) {
        assert.equal(ui.canControlCurrentAction(),false);
        assert.equal(ui.requestSelectHero(vegito.id),false, 'Own-team availability must not authorize an out-of-turn pick.');
        assert.equal(card(ui,vegito.id).events.click,undefined);
      }
      // Network snapshots must preserve per-team restrictions, not a union.
      ui.engine.importState(ui.engine.exportState());
      ui.renderGrid();
      assert.equal(card(ui,vegito.id).className.includes('unavailable'), viewer === 'teamA');
    }
  }
}
const blueRed = {A:'teamA',B:'teamB'};
const ui = makeUI('teamB',blueRed);
ui.engine.sequence = [{type:'pick',team:'A'},{type:'pick',team:'B'}];
ui.engine.state = 'active';
assert.equal(ui.engine.selectHero(vegito.id),false, 'A cannot reuse its Game 1 Vegito.');
ui.engine.currentStep = 1;
assert.equal(ui.engine.selectHero(vegito.id),true);
assert.equal(ui.engine.lockIn(),true, 'B can actually lock Vegito, not just view an unlocked card.');
assert.deepEqual(ui.engine.teamB.picks,[vegito.id]);
ui.engine.destroy();
for(const role of ['teamA','teamB']) {
  const reset = makeUI(role,blueRed,3);
  reset.renderGrid();
  assert.equal(card(reset,vegito.id).className.includes('unavailable'),false,'Game 3 resets history.');
  const fearless = makeUI(role,blueRed,2,'fearless');
  fearless.renderGrid();
  assert.equal(card(fearless,vegito.id).className.includes('unavailable'),true,'Fearless still locks for both teams.');
}

for(const id of ['waiting-links-container','waiting-link-a','waiting-link-b','waiting-link-spec','pre-draft-waiting-title','pre-draft-waiting-description']) nodes.set(id,element());
const waiting = Object.create(DraftUI.prototype);
Object.assign(waiting,{
  config:{gameNumber:1},roomRole:'host',isAuthoritativeHost:true,
  sync:new P2PDraftSync({roomCode:'QA'}),draftPresence:{teamA:0,teamB:0},
});
waiting.sync.shareLinks = {teamA:'a',teamB:'b',broadcaster:'spec'};
waiting.renderDraftWaitingMessage();
assert.equal(nodes.get('waiting-links-container').style.display,'flex');
for(const gameNumber of [2,3,5]) {
  waiting.config.gameNumber = gameNumber;
  waiting.renderDraftWaitingMessage();
  assert.equal(nodes.get('waiting-links-container').style.display,'none','Later games must not show invitations again.');
}
waiting.config.gameNumber = 1;
waiting.isAuthoritativeHost = false;
waiting.renderDraftWaitingMessage();
assert.equal(nodes.get('waiting-links-container').style.display,'none','Non-host views never show invitation controls.');
// Reconnecting game 2 still waits for real presence; hiding links is not a bypass.
waiting.config.gameNumber = 2;
waiting.isAuthoritativeHost = true;
waiting.initialDraftFlowStarted = false;
waiting.setPreDraftStage = (active,screen) => { waiting.screen = screen; };
waiting.startPreDraft = () => { waiting.started = true; };
waiting.config.enableDivineDraw = true;
waiting.beginInitialDraftFlow();
assert.equal(waiting.initialDraftFlowStarted,false);
assert.equal(waiting.screen,'pre-draft-waiting-screen');
waiting.draftPresence = {teamA:1,teamB:1};
waiting.beginInitialDraftFlow();
assert.equal(waiting.started,true,'Continue automatically once both teams reconnect.');
// Manual links are available throughout the series, but never open automatically.
for (const id of ['btn-rejoin-links','rejoin-links-dialog','btn-close-rejoin-links','rejoin-link-a','rejoin-link-b','rejoin-link-spec','rejoin-label-a','rejoin-label-b','rejoin-label-spec']) nodes.set(id, element());
const dialog = nodes.get('rejoin-links-dialog');
dialog.showModal = () => { dialog.open = true; };
dialog.close = () => { dialog.open = false; };
dialog.querySelectorAll = selector => selector === 'input' ? ['a','b','spec'].map(suffix => nodes.get(`rejoin-link-${suffix}`)) : [];
waiting.config.teamA = 'Original A';
waiting.sideAssignment = {A:'teamB',B:'teamA'};
for (const gameNumber of [1,2,3,5]) {
  waiting.config.gameNumber = gameNumber;
  waiting.bindRejoinLinks();
  assert.equal(nodes.get('btn-rejoin-links').hidden, false);
  assert.ok(!dialog.open, 'Binding must not open the share dialog automatically.');
  nodes.get('btn-rejoin-links').events.click();
  assert.equal(dialog.open, true);
  assert.equal(nodes.get('rejoin-link-a').value, 'a');
  assert.equal(nodes.get('rejoin-link-b').value, 'b');
  assert.equal(nodes.get('rejoin-link-spec').value, 'spec');
  assert.equal(nodes.get('rejoin-label-a').textContent, 'Team A · Original A');
  nodes.get('btn-close-rejoin-links').events.click();
  assert.equal(dialog.open, false);
}
for (const role of ['teamA','teamB','broadcaster','referee']) {
  waiting.roomRole = role;
  waiting.bindRejoinLinks();
  assert.equal(nodes.get('btn-rejoin-links').hidden, true);
  waiting.openRejoinLinks();
  assert.equal(dialog.open, false);
  assert.equal(nodes.get('rejoin-link-a').value, '');
}
console.log('Team-specific Squadra Blast UI, side swaps, invitation visibility and host-only manual rejoin links passed.');

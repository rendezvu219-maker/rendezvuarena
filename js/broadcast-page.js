import { DraftEngine } from './draft.js';
import { HEROES, PICKS_PER_TEAM } from './heroes.js';
import { BroadcastUI } from './broadcast.js?v=0.6.40-broadcast-side-orbit-4';
import { loadDraftConfigFromUrl } from './app.js';
import { api, escapeHtml } from './api.js';
import { entrantForSide, normalizeSideAssignment } from './pre-draft.js';

function originalEntrant(config, key) {
  if (key === 'teamB') {
    return {
      name: config.teamB || 'TEAM B',
      logo: config.teamBLogoUrl || config.teamBLogo || '',
      score: Number(config.seriesScoreB || 0),
      previousPicks: config.previousPicksB || [],
    };
  }
  return {
    name: config.teamA || 'TEAM A',
    logo: config.teamALogoUrl || config.teamALogo || '',
    score: Number(config.seriesScoreA || 0),
    previousPicks: config.previousPicksA || [],
  };
}

function originalEntrants(config) {
  return {
    teamA: originalEntrant(config, 'teamA'),
    teamB: originalEntrant(config, 'teamB'),
  };
}

function resolvedSideConfig(config, state = config._roomState) {
  const assignment = normalizeSideAssignment(state?.preDraft?.sideAssignment);
  if (!assignment) return { ...config };
  const blue = originalEntrant(config, entrantForSide(assignment, 'A'));
  const red = originalEntrant(config, entrantForSide(assignment, 'B'));
  return {
    ...config,
    teamA: blue.name,
    teamB: red.name,
    teamALogoUrl: blue.logo,
    teamBLogoUrl: red.logo,
    seriesScoreA: blue.score,
    seriesScoreB: red.score,
    previousPicksA: blue.previousPicks,
    previousPicksB: red.previousPicks,
  };
}

function applyResolvedIdentity(engine, overlay, config) {
  engine.config.teamA = config.teamA;
  engine.config.teamB = config.teamB;
  engine.teamA.name = config.teamA;
  engine.teamB.name = config.teamB;
  overlay.config = config;
}

function createEngine(config) {
  return new DraftEngine({
    teamA: config.teamA,
    teamB: config.teamB,
    heroBans: config.heroBans,
    divineBans: config.divineBans || 0,
    picksPerTeam: PICKS_PER_TEAM,
    timerSeconds: config.timerSeconds,
    timerAuthority: false,
    seriesRule: config.seriesRule || 'normal',
    gameNumber: Number(config.gameNumber || 1),
    previousPicksA: config.previousPicksA || [],
    previousPicksB: config.previousPicksB || [],
    protectList: config.enableProtect
      ? [
          ...(config.protectList || []),
          ...(config.protectNewest ? HEROES.filter(hero => hero.isNew).map(hero => hero.id) : []),
        ]
      : [],
    globalBanList: config.globalBanList || [],
    mirrorPickMode: config.mirrorPickMode || 'none',
  });
}

const BROADCAST_ROOM_POLL_MS = 3000;

function formatBroadcastTime(value) {
  if (!value) return 'Schedule not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function teamLogoMarkup(team) {
  const name = String(team?.name || 'Team');
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'TM';
  return `<span class="bc-selector-logo ${team?.logoUrl ? 'has-logo' : ''}">${team?.logoUrl
    ? `<img src="${escapeHtml(team.logoUrl)}" alt="${escapeHtml(name)} logo"><b>${escapeHtml(initials)}</b>`
    : `<b>${escapeHtml(initials)}</b>`}</span>`;
}

function selectorUrlForMatch(matchId) {
  const params = new URLSearchParams(window.location.search);
  params.delete('config');
  params.delete('team');
  params.set('watchMatch', String(matchId));
  return `${window.location.pathname}?${params.toString()}`;
}

function selectorHomeUrl() {
  const params = new URLSearchParams(window.location.search);
  params.delete('watchMatch');
  params.delete('match');
  params.delete('config');
  params.delete('team');
  const query = params.toString();
  return `${window.location.pathname}${query ? `?${query}` : ''}`;
}

function redirectToBroadcastRoom(rawUrl) {
  const target = new URL(rawUrl, window.location.origin);
  const current = new URLSearchParams(window.location.search);
  if (current.has('transparent')) target.searchParams.set('transparent', current.get('transparent'));
  window.location.replace(target.toString());
}

function renderBroadcastWaiting(match, message = 'Waiting for the Draft Room to open…') {
  const root = document.getElementById('broadcast-view');
  if (!root) return;
  root.classList.add('bc-selector-mode');
  root.innerHTML = `<main class="bc-match-selector bc-match-waiting">
    <div class="bc-selector-kicker">BROADCAST MATCH SELECTED</div>
    <h1>${escapeHtml(match?.teamA?.name || 'Team A')} <span>VS</span> ${escapeHtml(match?.teamB?.name || 'Team B')}</h1>
    <p>${escapeHtml(message)}</p>
    <div class="bc-selector-pulse" aria-hidden="true"></div>
    <small>Keep this page open. The overlay will connect automatically as soon as Blue or Red opens the Draft Room.</small>
    <a class="bc-selector-secondary" href="${escapeHtml(selectorHomeUrl())}">CHANGE MATCH</a>
  </main>`;
}

async function waitForBroadcastRoom(match) {
  renderBroadcastWaiting(match);
  let stopped = false;
  const stop = () => { stopped = true; };
  window.addEventListener('pagehide', stop, { once: true });
  while (!stopped) {
    try {
      const access = await api(`/api/matches/${encodeURIComponent(match.id)}/draft-room/access`);
      if (access?.url) {
        redirectToBroadcastRoom(access.url);
        return;
      }
    } catch (error) {
      if (error.status === 401 || error.status === 403) throw error;
      if (error.status !== 404) {
        renderBroadcastWaiting(match, error.message || 'Unable to check the Draft Room. Retrying…');
      }
    }
    await new Promise(resolve => setTimeout(resolve, BROADCAST_ROOM_POLL_MS));
  }
}

function renderBroadcastSelector(matches) {
  const root = document.getElementById('broadcast-view');
  if (!root) return;
  root.classList.add('bc-selector-mode');
  const cards = matches.map(match => {
    const ready = Boolean(match.draftRoomReady);
    return `<article class="bc-selector-match ${ready ? 'is-ready' : 'is-waiting'}" data-match-id="${Number(match.id)}">
      <header><span>${escapeHtml(match.tournamentName)}</span><b>${escapeHtml(match.roundName || match.stage || 'Match')}</b></header>
      <div class="bc-selector-versus">
        <div>${teamLogoMarkup(match.teamA)}<strong>${escapeHtml(match.teamA?.name || 'Team A')}</strong></div>
        <em>VS</em>
        <div>${teamLogoMarkup(match.teamB)}<strong>${escapeHtml(match.teamB?.name || 'Team B')}</strong></div>
      </div>
      <footer>
        <span>BO${Number(match.bestOf || 1)} · ${escapeHtml(formatBroadcastTime(match.effectiveScheduledAt))}</span>
        <button type="button" data-watch-match="${Number(match.id)}">${ready ? 'OPEN LIVE DRAFT' : 'SELECT & WAIT'}</button>
      </footer>
    </article>`;
  }).join('');
  root.innerHTML = `<main class="bc-match-selector">
    <div class="bc-selector-kicker">BROADCAST CONTROL</div>
    <h1>SELECT A MATCH TO BROADCAST</h1>
    <p>You select a <b>match</b>, not one team. The overlay then follows both teams and every live Draft action from that match.</p>
    <section class="bc-selector-howto" aria-label="How to test Broadcast">
      <article><i>1</i><div><b>Grant Broadcast access</b><span>In Staff &amp; Permissions, add this account as Broadcaster. You may also record it under a match’s “Assigned Broadcaster” field.</span></div></article>
      <article><i>2</i><div><b>Choose the match here</b><span><strong>OPEN LIVE DRAFT</strong> means the room already exists. <strong>SELECT &amp; WAIT</strong> watches it and connects automatically later.</span></div></article>
      <article><i>3</i><div><b>Let either team open Draft Room</b><span>As soon as Blue or Red opens the Draft Room, this page becomes the live Broadcast overlay. No Host button is required.</span></div></article>
    </section>
    <div class="bc-selector-legend"><span class="is-ready">READY NOW</span><span class="is-waiting">WAITING FOR ROOM</span><em>Tip: open this page in an incognito window or OBS Browser Source while teams use their own links.</em></div>
    <section class="bc-selector-grid">${cards || '<div class="bc-selector-empty"><b>No assigned matches yet.</b><span>Assign this Broadcast account to a match in Match Operations, then refresh this page.</span></div>'}</section>
    <div class="bc-selector-footer-actions"><button type="button" class="bc-selector-secondary" id="broadcast-selector-refresh">↻ REFRESH MATCHES</button><a class="bc-selector-secondary" href="/dashboard.html">TOURNAMENT OPERATIONS</a></div>
  </main>`;
  document.getElementById('broadcast-selector-refresh')?.addEventListener('click', () => openBroadcastSelector().catch(renderError));
  root.querySelectorAll('[data-watch-match]').forEach(button => button.addEventListener('click', () => {
    const match = matches.find(item => Number(item.id) === Number(button.dataset.watchMatch));
    if (!match) return;
    window.history.replaceState({}, '', selectorUrlForMatch(match.id));
    waitForBroadcastRoom(match).catch(renderError);
  }));
}

async function openBroadcastSelector() {
  const payload = await api('/api/broadcast/matches');
  const matches = Array.isArray(payload.matches) ? payload.matches : [];
  const params = new URLSearchParams(window.location.search);
  const requestedId = Number(params.get('watchMatch') || params.get('match') || 0);
  if (requestedId) {
    const match = matches.find(item => Number(item.id) === requestedId);
    if (!match) throw new Error('This match is no longer available to the Broadcast account.');
    await waitForBroadcastRoom(match);
    return;
  }
  renderBroadcastSelector(matches);
}

function renderError(error) {
  const root = document.getElementById('broadcast-view');
  if (!root) return;
  root.innerHTML = `<div class="bc-waiting"><div><div class="bc-waiting-kicker">OVERLAY ERROR</div><div class="bc-waiting-title">${escapeHtml(error?.message || error)}</div></div></div>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const params = new URLSearchParams(window.location.search);
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const hasRoomAccess = Boolean(fragment.get('room') && fragment.get('access'));
    const hasQuickDraftConfig = Boolean(params.get('config'));
    if (!hasRoomAccess && !hasQuickDraftConfig) {
      await openBroadcastSelector();
      return;
    }

    const config = await loadDraftConfigFromUrl();
    if (!config) throw new Error('No Broadcast configuration was provided.');

    document.getElementById('broadcast-view').dataset.transparent = String(['1', 'true', 'yes'].includes(String(params.get('transparent')).toLowerCase()));

    const entrants = originalEntrants(config);
    const sideConfig = resolvedSideConfig(config, config._roomState);
    const engine = createEngine(sideConfig);
    if (config._roomState?.engine) engine.importState(config._roomState.engine);
    const overlay = new BroadcastUI(engine, { config: sideConfig, originalEntrants: entrants });
    overlay.renderPreDraftState(config._roomState?.preDraft, entrants);
    let chosenDivineRules = Array.isArray(config._roomState?.chosenDivineRules) ? config._roomState.chosenDivineRules : [];
    if (chosenDivineRules.length >= 2) overlay.renderDivineResults(chosenDivineRules[0], chosenDivineRules[1]);
    const initialHostBans = config._roomState?.hostBannedHeroIds || config.hostBannedHeroIds || [];
    if (initialHostBans.length) overlay.renderHostBans(initialHostBans);

    const sync = config._sync;
    if (!sync) return;

    sync.on('event', ({ type, data = {} }) => {
      if (type === 'draft:started') {
        overlay.renderPreDraftState({ stage: 'complete' }, entrants);
        if (engine.state === 'waiting') engine.start();
      } else if (type === 'hero:locked' || type === 'hero:banned') {
        engine.applyLockedHero(data.heroId);
      } else if (type === 'timer:tick') {
        engine.setRemoteTimer(data.remaining);
      } else if (type === 'draft:paused') {
        engine.pause();
      } else if (type === 'draft:resumed') {
        engine.resume();
      } else if (type === 'divine:result') {
        chosenDivineRules = Array.isArray(data.rules) ? data.rules : [];
        if (chosenDivineRules.length >= 2) overlay.renderDivineResults(chosenDivineRules[0], chosenDivineRules[1]);
      } else if (type === 'all-random:bans') {
        overlay.renderHostBans(Array.isArray(data.heroIds) ? data.heroIds : []);
      } else if (type === 'draft:completed') {
        engine.state = 'complete';
        engine.stopTimer();
        overlay.setStatusScreen('DRAFT COMPLETE', 'FINAL TEAM COMPOSITIONS LOCKED');
      }
    });

    sync.on('state', state => {
      if (!state) return;
      if (Number.isFinite(Number(state.seriesScoreA))) config.seriesScoreA = Number(state.seriesScoreA);
      if (Number.isFinite(Number(state.seriesScoreB))) config.seriesScoreB = Number(state.seriesScoreB);
      if (state.engine) {
        const nextSideConfig = resolvedSideConfig(config, state);
        engine.importState(state.engine);
        applyResolvedIdentity(engine, overlay, nextSideConfig);
        chosenDivineRules = Array.isArray(state.chosenDivineRules) ? state.chosenDivineRules : chosenDivineRules;
        overlay.syncFromEngine();
        if (Array.isArray(state.hostBannedHeroIds) && state.hostBannedHeroIds.length) overlay.renderHostBans(state.hostBannedHeroIds);
        if (chosenDivineRules.length >= 2) overlay.renderDivineResults(chosenDivineRules[0], chosenDivineRules[1]);
      }
      overlay.renderPreDraftState(state.preDraft, entrants);
    });

    sync.on('connection', ({ status, attempt = 0 }) => {
      const root = document.getElementById('broadcast-view');
      if (root) root.dataset.realtimeStatus = status || 'unknown';
      if (status === 'reconnecting') overlay.setStatusScreen('RECONNECTING', `RESYNC ATTEMPT ${attempt}`);
      if (status === 'resynced') {
        overlay.syncFromEngine();
        overlay.setStatusScreen('', '');
      }
    });
    sync.on('error', error => console.warn(error?.message || error));
  } catch (error) {
    console.error(error);
    renderError(error);
  }
});

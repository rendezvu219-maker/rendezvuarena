import { HEROES, getHeroImgSp, getHeroFullImg, getHeroTrailerUrls, getHeroSkillIconUrls } from './heroes.js';
import { HEROES_DATA } from './heroes-data.js';
import { readValue, subscribeValue, connectionMessage, firebaseConfigured } from './firebase.js';
import { deriveDraft, deriveBracket, randomLineups, pageUrl } from './static-core.js';
import { createHostSession, createClientSession } from './p2p.js';

const params = new URLSearchParams(location.search);
const roomId = params.get('room');
const side = params.get('side') || 'S';
const token = params.get('token') || '';
const tournamentId = params.get('tournament');
const matchId = params.get('match');

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));

let config;
let events = {};
let tournamentEvents = {};
let selected = null;
let role = 'all';
let search = '';
let livePresence = { A: false, B: false };
let session = null;

function show(message, error = false) {
  $('#message').textContent = message;
  $('#message').className = `notice${error ? ' error' : ''}`;
  $('#message').classList.remove('hidden');
}

function hero(id) {
  return HEROES.find(item => item.id === id);
}

function matchNames() {
  if (!config.tournamentConfig) return { A: config.teamA, B: config.teamB };
  const match = deriveBracket(config.tournamentConfig, tournamentEvents).find(item => item.id === matchId);
  return { A: match?.teamA || 'Winner pending', B: match?.teamB || 'Winner pending' };
}

function slot(id, empty = '—') {
  const item = hero(id);
  return item
    ? `<div class="slot"><img src="${getHeroImgSp(item.id)}" alt=""><span>${esc(item.name)}</span></div>`
    : `<div class="slot text-muted">${empty}</div>`;
}

function renderSlots(root, values, total) {
  root.innerHTML = Array.from({ length: Math.max(total, values.length) }, (_, i) => slot(values[i])).join('');
}

// Host (side === 'O') has absolute authority to act on behalf of whichever side has the turn!
function canAct(state) {
  return Boolean(token && (side === 'O' || state.current?.side === side));
}

function render() {
  const state = deriveDraft(config, events);
  const names = matchNames();
  const mode = config.rules.mode;

  // 1. Check if waiting for teams / draft not started yet
  if (!state.started) {
    $('#waiting-room').classList.remove('hidden');
    $('#draft-app').classList.add('hidden');
    $('#coin-room').classList.add('hidden');

    $('#presence-name-a').textContent = names.A;
    $('#presence-name-b').textContent = names.B;

    const isOnlineA = livePresence.A || state.presence.A;
    const isOnlineB = livePresence.B || state.presence.B;
    const readyToStart = isOnlineA && isOnlineB;

    const dotA = $('#presence-dot-a');
    const statusA = $('#presence-status-a');
    if (isOnlineA) {
      dotA.classList.add('online');
      statusA.textContent = 'Ready in room';
      statusA.style.color = 'var(--status-success)';
    } else {
      dotA.classList.remove('online');
      statusA.textContent = 'Waiting to connect…';
      statusA.style.color = 'var(--text-muted)';
    }

    const dotB = $('#presence-dot-b');
    const statusB = $('#presence-status-b');
    if (isOnlineB) {
      dotB.classList.add('online');
      statusB.textContent = 'Ready in room';
      statusB.style.color = 'var(--status-success)';
    } else {
      dotB.classList.remove('online');
      statusB.textContent = 'Waiting to connect…';
      statusB.style.color = 'var(--text-muted)';
    }

    if (side === 'O') {
      $('#btn-start-draft').classList.remove('hidden');
      $('#btn-force-start').classList.remove('hidden');
      $('#waiting-hint').classList.add('hidden');
      if (readyToStart) {
        $('#btn-start-draft').textContent = 'START DRAFT (BOTH TEAMS READY)';
        $('#btn-start-draft').style.boxShadow = '0 0 16px rgba(54,179,126,0.5)';
      } else {
        $('#btn-start-draft').textContent = 'START DRAFT ROOM';
        $('#btn-start-draft').style.boxShadow = 'none';
      }
    } else {
      $('#btn-start-draft').classList.add('hidden');
      $('#btn-force-start').classList.add('hidden');
      $('#waiting-hint').classList.remove('hidden');
      if (['A', 'B'].includes(side)) {
        $('#waiting-hint').textContent = `You are connected as ${names[side]}. Waiting for Host to start the draft.`;
      } else {
        $('#waiting-hint').textContent = 'Spectator view. Waiting for teams to check in and Host to start.';
      }
    }
    return;
  }

  // 2. Draft started: Hide waiting room
  $('#waiting-room').classList.add('hidden');

  // 3. Pre-Draft Coin Flip (if enabled and coin not flipped for this game)
  if (config.rules.enableCoinFlip && Number(state.game || 1) <= 1 && !state.coin) {
    $('#coin-room').classList.remove('hidden');
    $('#draft-app').classList.add('hidden');
    $('#btn-flip-coin').classList.toggle('hidden', side !== 'O');
    $('#coin-desc').textContent = side === 'O'
      ? 'You are the Organizer. Click FLIP COIN to randomly decide the winner for this game.'
      : 'Waiting for the Organizer to flip the coin…';
    return;
  }
  $('#coin-room').classList.add('hidden');
  $('#draft-app').classList.remove('hidden');

  // 4. Active Draft View
  $('#host-banner').classList.toggle('hidden', side !== 'O');
  $('#team-a-name').textContent = names.A;
  $('#team-b-name').textContent = names.B;
  $('#side-a-title').textContent = names.A;
  $('#side-b-title').textContent = names.B;
  $('#score-a').textContent = state.score.A;
  $('#score-b').textContent = state.score.B;
  $('#room-meta').textContent = `${config.type === 'tournament' ? `TOURNAMENT · ${matchId}` : 'QUICK MATCH'} · GAME ${Math.min(state.game, config.rules.bestOf)} · BO${config.rules.bestOf}`;

  const picks = state.random || state.picks;
  renderSlots($('#picks-a'), picks.A, 4);
  renderSlots($('#picks-b'), picks.B, 4);
  renderSlots($('#bans-a'), state.bans.A, Math.max(1, Math.ceil(config.rules.banOrder.length / 2)));
  renderSlots($('#bans-b'), state.bans.B, Math.max(1, Math.floor(config.rules.banOrder.length / 2)));

  const currentName = state.current ? names[state.current.side] : '';
  const isHost = side === 'O';
  const turnPrefix = isHost ? `[HOST CONTROL] ` : '';

  $('#turn-label').textContent = state.score.complete
    ? `${names[state.score.winner]} wins the series!`
    : state.complete
      ? 'Draft complete. Organizer can report the game result below.'
      : mode === 'random'
        ? (state.random ? 'Random lineups locked.' : side === 'A' || isHost ? 'Ready to generate both lineups.' : `Waiting for ${names.A} or Host to randomize…`)
        : state.current
          ? `${turnPrefix}${currentName} · ${state.current.type.toUpperCase()} TURN`
          : 'Draft complete.';

  const availableToAct = mode === 'draft' && canAct(state) && !state.complete && !state.score.complete;
  $('#lock-button').classList.toggle('hidden', mode !== 'draft');
  $('#lock-button').disabled = !availableToAct || !selected;

  if (selected) {
    const actionLabel = state.current?.type === 'ban' ? 'BAN' : 'PICK';
    const forLabel = isHost && state.current ? ` FOR ${names[state.current.side]}` : '';
    $('#lock-button').textContent = `${actionLabel} ${hero(selected)?.name || ''}${forLabel}`;
  } else {
    $('#lock-button').textContent = 'SELECT A HERO';
  }

  $('#random-button').classList.toggle('hidden', mode !== 'random' || Boolean(state.random) || state.score.complete || !token || !['A', 'O'].includes(side));

  const report = isHost && state.complete && !state.score.complete;
  $('#game-a').classList.toggle('hidden', !report);
  $('#game-b').classList.toggle('hidden', !report);
  $('#game-a').textContent = `${names.A} WON GAME ${state.game}`;
  $('#game-b').textContent = `${names.B} WON GAME ${state.game}`;

  const eligible = HEROES.filter(item => (role === 'all' || item.role === role) && item.name.toLowerCase().includes(search.toLowerCase()));
  $('#hero-grid').innerHTML = eligible.map(item => {
    const isUsed = state.used.has(item.id);
    const isGloballyBanned = (state.globalBans || []).includes(item.id);
    const isProtected = (state.protectedHeroes || new Set()).has(item.id);
    const isLocked = state.current ? state.locked[state.current.side]?.has(item.id) : false;
    const isBanning = state.current?.type === 'ban';
    const cantBan = isBanning && isProtected;
    const isDisabled = isUsed || isGloballyBanned || isLocked || cantBan || mode === 'random';

    let badgeMarkup = '';
    if (isGloballyBanned) badgeMarkup = '<span class="hero-badge-tag global-ban">GLOBAL BAN</span>';
    else if (isProtected) badgeMarkup = '<span class="hero-badge-tag protected">PROTECTED</span>';

    return `<button class="hero-card ${selected === item.id ? 'selected' : ''}" data-hero="${item.id}" ${isDisabled ? 'disabled' : ''}>
      ${badgeMarkup}
      <img src="${getHeroImgSp(item.id)}" alt="">
      <span>${esc(item.name)}</span>
    </button>`;
  }).join('');

  $('#hero-grid').querySelectorAll('[data-hero]').forEach(button => button.addEventListener('click', () => openHero(button.dataset.hero)));
}

function openHero(id) {
  selected = id;
  const item = hero(id);
  const detail = HEROES_DATA[id] || {};
  const skills = detail.skills || [];
  $('#hero-detail').innerHTML = `<div class="hero-detail"><img src="${getHeroFullImg(id)}" alt="${esc(item.name)}"><div><span class="eyebrow">${esc(item.role)} · Difficulty ${esc(detail.difficulty || '—')}</span><h2>${esc(item.name)}</h2><p>${esc(detail.description || 'Hero information unavailable.').replace(/\n/g, '<br>')}</p><div class="skill-list">${skills.map(skill => { const icons = getHeroSkillIconUrls(id, skill.id); return `<div class="skill"><img src="${icons.primary}" onerror="this.src='${icons.fallback}'" alt=""><div><b>${esc(skill.name)}</b><p>${esc(skill.desc)}</p></div></div>`; }).join('')}</div></div></div>`;
  $('#modal-select').classList.toggle('hidden', config.rules.mode !== 'draft');
  $('#hero-trailer').classList.add('hidden');
  $('#hero-trailer').removeAttribute('src');
  $('#hero-modal').classList.remove('hidden');
  render();
}

async function act(event) {
  try {
    if (side === 'O' && session?.sendLocalAction) {
      session.sendLocalAction(event);
    } else if (session?.sendAction) {
      session.sendAction(event);
    } else {
      events[event.id || (Date.now() + '_' + Math.random().toString(36).slice(2, 6))] = { ...event, createdAt: Date.now() };
      render();
    }
    selected = null;
    $('#hero-modal').classList.add('hidden');
  } catch (error) {
    show(error.message, true);
  }
}

// Start draft button (Host only)
$('#btn-start-draft').addEventListener('click', () => act({ type: 'start', actor: 'O' }));
$('#btn-force-start').addEventListener('click', () => act({ type: 'start', actor: 'O' }));

// Coin flip button (Host only)
$('#btn-flip-coin').addEventListener('click', () => {
  const state = deriveDraft(config, events);
  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  const winner = Math.random() < 0.5 ? 'A' : 'B';
  $('#coin-display').textContent = result === 'heads' ? '🟡 HEADS' : '⚪ TAILS';
  act({ type: 'coin_flip', result, winner, game: state.game, actor: 'O' });
});

$('#lock-button').addEventListener('click', () => {
  const state = deriveDraft(config, events);
  if (selected && canAct(state) && state.current) {
    act({
      type: state.current.type,
      side: state.current.side,
      heroId: selected,
      step: state.step,
      game: state.game,
      actor: side === 'O' ? 'O' : side
    });
  }
});

$('#modal-select').addEventListener('click', () => $('#lock-button').click());
$('#close-modal').addEventListener('click', () => $('#hero-modal').classList.add('hidden'));

$('#trailer-button').addEventListener('click', () => {
  const video = $('#hero-trailer');
  video.src = getHeroTrailerUrls(selected)[0];
  video.classList.remove('hidden');
  video.play().catch(() => {});
});

$('#random-button').addEventListener('click', () => {
  const state = deriveDraft(config, events);
  const result = randomLineups(state.unavailableFor);
  act({ type: 'random', side: 'A', teamA: result.A, teamB: result.B, game: state.game, actor: side });
});

for (const target of ['A', 'B']) {
  $(`#game-${target.toLowerCase()}`).addEventListener('click', () => {
    const state = deriveDraft(config, events);
    act({ type: 'game_result', side: target, game: state.game, actor: 'O' });
  });
}

$('#hero-search').addEventListener('input', event => { search = event.target.value; render(); });
document.querySelectorAll('[data-role]').forEach(button => button.addEventListener('click', () => { role = button.dataset.role; render(); }));

async function start() {
  if (!roomId) return show('Missing room ID.', true);
  const hostPeerId = params.get('host') || `rv-${roomId.toLowerCase()}`;

  try {
    if (side === 'O') {
      show('Starting P2P Room Host…');
      // Load config from localStorage
      try {
        const stored = localStorage.getItem(`rv_config_${roomId}`);
        if (stored) config = JSON.parse(stored);
      } catch {}

      if (!config && firebaseConfigured()) {
        config = await readValue(`roomConfigs/${roomId}`).catch(() => null);
      }

      if (!config) {
        return show('Room configuration not found. Please create a new match from Quick Match.', true);
      }

      let initialEvents = {};
      try {
        const savedEvents = localStorage.getItem(`rv_events_${roomId}`);
        if (savedEvents) initialEvents = JSON.parse(savedEvents);
      } catch {}

      events = initialEvents;

      session = createHostSession({
        roomId,
        hostPeerId,
        config,
        initialEvents,
        onEvent: (ev, all) => {
          events = all;
          selected = null;
          render();
        },
        onPresenceChange: p => {
          livePresence = p;
          render();
        },
        onError: err => {
          console.warn('Host Peer error:', err);
        },
        onReady: () => {
          $('#message').classList.add('hidden');
          render();
        }
      });

      render();
    } else {
      // Client (Team A, Team B, Spectator)
      show('Connecting to Room Host…');

      session = createClientSession({
        hostPeerId,
        side,
        token,
        onInit: (initCfg, initEvents, initPresence) => {
          config = initCfg;
          events = initEvents;
          livePresence = initPresence;
          $('#message').classList.add('hidden');
          render();
        },
        onEvent: ev => {
          events[ev.id || (ev.step + '_' + Date.now())] = ev;
          selected = null;
          render();
        },
        onPresenceChange: p => {
          livePresence = p;
          render();
        },
        onStatus: status => {
          if (status === 'connecting') show('Connecting to Host…');
          else if (status === 'connected') $('#message').classList.add('hidden');
          else if (status === 'disconnected') show('Lost connection to Host. Waiting to reconnect…', true);
        },
        onError: err => {
          console.warn('Client Peer error:', err);
          show('Waiting for Host to connect: ' + err.message, true);
        }
      });
    }

    if (tournamentId && matchId) {
      const link = $('#bracket-link');
      link.href = pageUrl('bracket.html', { tournament: tournamentId, ...(side === 'O' ? { token } : {}) });
      link.classList.remove('hidden');
    }
  } catch (error) {
    show(error?.message || String(error), true);
  }
}

start();

// OBS Overlay Real-Time Controller
const params = new URLSearchParams(window.location.search);
const pathParts = window.location.pathname.split('/').filter(Boolean);
const matchIdParam = params.get('matchId') || (pathParts[0] === 'overlay' ? pathParts[1] : (pathParts[1] === 'overlay' ? pathParts[2] : null));
const isCompact = params.get('compact') === 'true' || params.get('compact') === '1';
const showDraft = params.get('showDraft') !== 'false' && params.get('showDraft') !== '0';
const theme = params.get('theme') || 'dark';

if (isCompact) document.body.classList.add('compact-mode');
if (!showDraft) {
  const draftPanel = document.getElementById('overlay-draft-panel');
  if (draftPanel) draftPanel.style.display = 'none';
}

let socket = null;
let currentMatch = null;
let currentDraft = null;

async function initOverlay() {
  if (!matchIdParam) {
    document.getElementById('overlay-tournament-name').textContent = 'WAITING FOR MATCH ID (?matchId=...)';
    return;
  }

  try {
    const res = await fetch(`/api/overlay/${matchIdParam}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderOverlay(data);
    setupSocket(data);
  } catch (err) {
    console.error('Failed to load overlay data:', err);
    document.getElementById('overlay-tournament-name').textContent = 'MATCH NOT FOUND';
  }
}

function renderOverlay(data) {
  const match = data.match;
  currentMatch = match;
  currentDraft = data.draft;

  // Render Tournament & Match Info
  document.getElementById('overlay-tournament-name').textContent = data.tournament?.name || 'RendezVu Arena';
  document.getElementById('overlay-round-badge').textContent = `${match.roundName || ('Round ' + match.roundNo)} · BO${match.bestOf || 3}`;

  // Render Teams
  const teamA = match.teamA || { name: 'Team A', tag: 'A', logoUrl: '' };
  const teamB = match.teamB || { name: 'Team B', tag: 'B', logoUrl: '' };

  document.getElementById('team-a-name').textContent = teamA.name;
  document.getElementById('team-a-tag').textContent = teamA.tag || 'TEAM A';
  document.getElementById('team-a-score').textContent = match.scoreA ?? 0;
  if (teamA.logoUrl) document.getElementById('team-a-logo').src = teamA.logoUrl;

  document.getElementById('team-b-name').textContent = teamB.name;
  document.getElementById('team-b-tag').textContent = teamB.tag || 'TEAM B';
  document.getElementById('team-b-score').textContent = match.scoreB ?? 0;
  if (teamB.logoUrl) document.getElementById('team-b-logo').src = teamB.logoUrl;

  // Render Draft Slots if draft room active
  if (showDraft && data.draft) {
    renderDraftState(data.draft.state, data.draft.config);
  }
}

function renderDraftState(state, config = {}) {
  if (!state) return;
  const engine = state.engine || state;
  const picksA = engine.teamA?.picks || [];
  const bansA = engine.teamA?.bans || [];
  const picksB = engine.teamB?.picks || [];
  const bansB = engine.teamB?.bans || [];

  renderHeroSlots('draft-picks-a', picksA, 'pick', 4);
  renderHeroSlots('draft-bans-a', bansA, 'ban', config.heroBans || 2);
  renderHeroSlots('draft-picks-b', picksB, 'pick', 4);
  renderHeroSlots('draft-bans-b', bansB, 'ban', config.heroBans || 2);

  const statusText = document.getElementById('draft-status-text');
  if (statusText) {
    if (state.status === 'complete' || engine.state === 'complete') {
      statusText.textContent = 'DRAFT COMPLETE';
      statusText.style.borderColor = '#22c55e';
      statusText.style.color = '#22c55e';
    } else if (state.status === 'in_progress') {
      statusText.textContent = `GAME ${state.gameNumber || 1} DRAFT`;
    } else {
      statusText.textContent = 'WAITING FOR DRAFT';
    }
  }
}

function renderHeroSlots(containerId, heroIds, type, totalSlots = 4) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  for (let i = 0; i < totalSlots; i++) {
    const heroId = heroIds[i];
    const slot = document.createElement('div');
    slot.className = `hero-slot ${type === 'ban' ? 'ban-slot' : ''}`;
    if (heroId) {
      const img = document.createElement('img');
      img.src = `/assets/heroes/${heroId}.webp`;
      img.alt = `Hero ${heroId}`;
      slot.appendChild(img);
    } else {
      slot.innerHTML = `<span style="color: #475569; font-size: 0.8rem;">—</span>`;
    }
    container.appendChild(slot);
  }
}

function setupSocket(data) {
  if (typeof io === 'undefined') return;
  socket = io();

  const tournamentId = data.tournament?.id;
  const roomCode = data.draft?.roomCode;

  socket.on('connect', () => {
    console.log('[OBS Overlay] Socket connected');
    if (tournamentId) socket.emit('tournament:join', { tournamentId });
    if (roomCode) socket.emit('draft:join', { roomCode });
  });

  socket.on('bracket:updated', payload => {
    if (!payload) return;
    const matches = payload.matches || [];
    const updated = matches.find(m => Number(m.id) === Number(matchIdParam));
    if (updated) {
      document.getElementById('team-a-score').textContent = updated.scoreA ?? 0;
      document.getElementById('team-b-score').textContent = updated.scoreB ?? 0;
    }
  });

  socket.on('draft:state', state => {
    if (state) renderDraftState(state, currentDraft?.config);
  });

  socket.on('timer:tick', data => {
    const timerBadge = document.getElementById('overlay-timer-badge');
    if (timerBadge && data && data.seconds !== undefined) {
      timerBadge.style.display = 'block';
      timerBadge.textContent = `${data.seconds}s`;
    }
  });
}

initOverlay();

import { HEROES, getHeroImgSp, getHeroFullImg, getHeroTrailerUrls, getHeroSkillIconUrls } from './heroes.js';
import { HEROES_DATA } from './heroes-data.js';
import { readValue, subscribeValue, appendProtectedEvent, connectionMessage } from './firebase.js';
import { deriveDraft, deriveBracket, randomLineups, pageUrl } from './static-core.js';

const params = new URLSearchParams(location.search); const roomId = params.get('room'); const side = params.get('side') || 'S'; const token = params.get('token') || '';
const tournamentId = params.get('tournament'); const matchId = params.get('match');
const $ = selector => document.querySelector(selector); const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
let config; let events = {}; let tournamentEvents = {}; let selected = null; let role = 'all'; let search = '';
function show(message, error = false) { $('#message').textContent = message; $('#message').className = `notice${error ? ' error' : ''}`; $('#message').classList.remove('hidden'); }
function hero(id) { return HEROES.find(item => item.id === id); }
function matchNames() {
  if (!config.tournamentConfig) return { A: config.teamA, B: config.teamB };
  const match = deriveBracket(config.tournamentConfig, tournamentEvents).find(item => item.id === matchId);
  return { A: match?.teamA || `Winner pending`, B: match?.teamB || `Winner pending` };
}
function slot(id, empty = '—') { const item = hero(id); return item ? `<div class="slot"><img src="${getHeroImgSp(item.id)}" alt=""><span>${esc(item.name)}</span></div>` : `<div class="slot text-muted">${empty}</div>`; }
function renderSlots(root, values, total) { root.innerHTML = Array.from({ length: Math.max(total, values.length) }, (_, i) => slot(values[i])).join(''); }
function canAct(state) { return Boolean(token && (side === 'O' || state.current?.side === side)); }
function render() {
  const state = deriveDraft(config, events); const names = matchNames(); const mode = config.rules.mode;
  $('#team-a-name').textContent = names.A; $('#team-b-name').textContent = names.B; $('#side-a-title').textContent = names.A; $('#side-b-title').textContent = names.B;
  $('#score-a').textContent = state.score.A; $('#score-b').textContent = state.score.B; $('#room-meta').textContent = `${config.type === 'tournament' ? `TOURNAMENT · ${matchId}` : 'QUICK MATCH'} · GAME ${Math.min(state.game, config.rules.bestOf)} · BO${config.rules.bestOf}`;
  const picks = state.random || state.picks; renderSlots($('#picks-a'), picks.A, 4); renderSlots($('#picks-b'), picks.B, 4); renderSlots($('#bans-a'), state.bans.A, config.rules.banOrder.length / 2); renderSlots($('#bans-b'), state.bans.B, config.rules.banOrder.length / 2);
  const currentName = state.current ? names[state.current.side] : '';
  $('#turn-label').textContent = state.score.complete ? `${names[state.score.winner]} wins the series.` : state.complete ? 'Draft complete. Organizer can report the game result.' : mode === 'random' ? (state.random ? 'Random lineups locked.' : side === 'A' || side === 'O' ? 'Ready to generate both lineups once.' : `Waiting for ${names.A} to randomize…`) : state.current ? `${currentName} · ${state.current.type.toUpperCase()} TURN` : 'Draft complete.';
  const availableToAct = mode === 'draft' && canAct(state) && !state.complete && !state.score.complete;
  $('#lock-button').classList.toggle('hidden', mode !== 'draft'); $('#lock-button').disabled = !availableToAct || !selected; $('#lock-button').textContent = selected ? `${state.current?.type === 'ban' ? 'BAN' : 'PICK'} ${hero(selected)?.name || ''}` : 'SELECT A HERO';
  $('#random-button').classList.toggle('hidden', mode !== 'random' || Boolean(state.random) || state.score.complete || !token || !['A','O'].includes(side));
  const report = side === 'O' && state.complete && !state.score.complete; $('#game-a').classList.toggle('hidden', !report); $('#game-b').classList.toggle('hidden', !report);
  const eligible = HEROES.filter(item => (role === 'all' || item.role === role) && item.name.toLowerCase().includes(search.toLowerCase()));
  $('#hero-grid').innerHTML = eligible.map(item => `<button class="hero-card ${selected === item.id ? 'selected' : ''}" data-hero="${item.id}" ${state.used.has(item.id) || mode === 'random' ? 'disabled' : ''}><img src="${getHeroImgSp(item.id)}" alt=""><span>${esc(item.name)}</span></button>`).join('');
  $('#hero-grid').querySelectorAll('[data-hero]').forEach(button => button.addEventListener('click', () => openHero(button.dataset.hero)));
}
function openHero(id) {
  selected = id; const item = hero(id); const detail = HEROES_DATA[id] || {}; const skills = detail.skills || [];
  $('#hero-detail').innerHTML = `<div class="hero-detail"><img src="${getHeroFullImg(id)}" alt="${esc(item.name)}"><div><span class="eyebrow">${esc(item.role)} · Difficulty ${esc(detail.difficulty || '—')}</span><h2>${esc(item.name)}</h2><p>${esc(detail.description || 'Hero information unavailable.').replace(/\n/g,'<br>')}</p><div class="skill-list">${skills.map(skill => { const icons = getHeroSkillIconUrls(id, skill.id); return `<div class="skill"><img src="${icons.primary}" onerror="this.src='${icons.fallback}'" alt=""><div><b>${esc(skill.name)}</b><p>${esc(skill.desc)}</p></div></div>`; }).join('')}</div></div></div>`;
  $('#modal-select').classList.toggle('hidden', config.rules.mode !== 'draft'); $('#hero-trailer').classList.add('hidden'); $('#hero-trailer').removeAttribute('src'); $('#hero-modal').classList.remove('hidden'); render();
}
async function act(event) { try { await appendProtectedEvent('rooms', roomId, token, event); selected = null; $('#hero-modal').classList.add('hidden'); } catch (error) { show(connectionMessage(error), true); } }
$('#lock-button').addEventListener('click', () => { const state = deriveDraft(config, events); if (selected && canAct(state) && state.current) act({ type:state.current.type, side:state.current.side, heroId:selected, step:state.step, game:state.game, actor:side }); });
$('#modal-select').addEventListener('click', () => $('#lock-button').click()); $('#close-modal').addEventListener('click', () => $('#hero-modal').classList.add('hidden'));
$('#trailer-button').addEventListener('click', () => { const video = $('#hero-trailer'); video.src = getHeroTrailerUrls(selected)[0]; video.classList.remove('hidden'); video.play().catch(() => {}); });
$('#random-button').addEventListener('click', () => { const state = deriveDraft(config, events); const result = randomLineups(); act({ type:'random', side:'A', teamA:result.A, teamB:result.B, game:state.game, actor:side }); });
for (const target of ['A','B']) $(`#game-${target.toLowerCase()}`).addEventListener('click', () => { const state = deriveDraft(config, events); act({ type:'game_result', side:target, game:state.game, actor:'O' }); });
$('#hero-search').addEventListener('input', event => { search = event.target.value; render(); }); document.querySelectorAll('[data-role]').forEach(button => button.addEventListener('click', () => { role = button.dataset.role; render(); }));

async function start() {
  if (!roomId) return show('Missing room ID.', true);
  try {
    config = await readValue(`roomConfigs/${roomId}`); if (!config) return show('Room does not exist or has expired.', true);
    if (!['A','B','O','S'].includes(side) || (side !== 'S' && !token)) return show('This participant link is invalid.', true);
    if (side !== 'S') {
      const grantedSide = await readValue(`roomAccess/${roomId}/${token}`).catch(() => null);
      if (grantedSide !== side) return show('Invalid participant token for this side.', true);
    }
    if (tournamentId && matchId) { config.tournamentConfig = await readValue(`tournamentConfigs/${tournamentId}`); const link = $('#bracket-link'); link.href = pageUrl('bracket.html', { tournament:tournamentId, ...(side === 'O' ? { token } : {}) }); link.classList.remove('hidden'); await subscribeValue(`tournaments/${tournamentId}/events`, value => { tournamentEvents = value || {}; render(); }); }
    $('#draft-app').classList.remove('hidden'); $('#message').classList.add('hidden'); render();
    await subscribeValue(`rooms/${roomId}/events`, value => { events = value || {}; selected = null; render(); }, error => show(connectionMessage(error), true));
  } catch (error) { show(connectionMessage(error), true); }
}
start();

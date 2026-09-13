import { readValue, subscribeValue, appendProtectedEvent, connectionMessage } from './firebase.js';
import { deriveBracket, pageUrl } from './static-core.js';

const params = new URLSearchParams(location.search); const id = params.get('tournament'); const token = params.get('token') || '';
const message = document.querySelector('#message'); const app = document.querySelector('#bracket-app'); let config; let events = {};
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
function show(text, error = false) { message.textContent = text; message.className = `notice${error ? ' error' : ''}`; message.classList.remove('hidden'); }
function roomLinks(match, roomId) {
  const base = { room: roomId, tournament: id, match: match.id };
  const secret = config.secrets?.[match.id] || {};
  return { A: pageUrl('draft.html', { ...base, side: 'A', token: secret.A }), B: pageUrl('draft.html', { ...base, side: 'B', token: secret.B }), S: pageUrl('draft.html', { ...base, side: 'S' }), O: pageUrl('draft.html', { ...base, side: 'O', token }) };
}
function render() {
  const matches = deriveBracket(config, events); const organizer = Boolean(token && config.organizer);
  document.querySelector('#tournament-name').textContent = config.name; document.querySelector('#access-label').textContent = organizer ? 'Organizer controls enabled. Private participant links are available per match.' : 'Spectator view · bracket updates automatically.';
  const rounds = [{ n:1,label:'QUARTERFINALS' },{ n:2,label:'SEMIFINALS' },{ n:3,label:'FINAL' }];
  document.querySelector('#bracket').innerHTML = rounds.map(round => `<section class="round ${round.n === 2 ? 'semifinal' : round.n === 3 ? 'final' : ''}"><h2>${round.label}</h2>${matches.filter(match => match.round === round.n).map(match => {
    const ready = !/^Winner /.test(match.teamA) && !/^Winner /.test(match.teamB); const links = roomLinks(match, config.roomIds[match.id]);
    return `<article class="match-card"><div class="match-head"><span>${match.id} · BO${match.bestOf}</span><span>${match.winner ? 'COMPLETE' : ready ? 'READY' : 'WAITING'}</span></div><div class="match-team ${match.winner === match.teamA ? 'winner' : ''}"><b>${esc(match.teamA)}</b><span>${match.scoreA ?? '—'}</span></div><div class="match-team b ${match.winner === match.teamB ? 'winner' : ''}"><b>${esc(match.teamB)}</b><span>${match.scoreB ?? '—'}</span></div><div class="match-actions">${ready ? `<a href="${links[organizer ? 'O' : 'S']}">OPEN MATCH</a>` : ''}${organizer && ready ? `<button data-win="${match.id}:A">TEAM A WINS</button><button data-win="${match.id}:B">TEAM B WINS</button><button data-copy="${links.A}">COPY A</button><button data-copy="${links.B}">COPY B</button><button data-copy="${links.S}">COPY SPECTATOR</button>` : ''}</div></article>`;
  }).join('')}</section>`).join('');
  const final = matches.find(match => match.id === 'M7'); document.querySelector('#champion').textContent = final.winner ? `CHAMPION · ${final.winner}` : '';
  document.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => { await navigator.clipboard.writeText(button.dataset.copy); button.textContent = 'COPIED'; }));
  document.querySelectorAll('[data-win]').forEach(button => button.addEventListener('click', async () => { const [matchId, side] = button.dataset.win.split(':'); button.disabled = true; try { await appendProtectedEvent('tournaments', id, token, { type:'winner', matchId, side, actor:'O' }); } catch (error) { show(connectionMessage(error), true); } finally { button.disabled = false; } }));
}
async function start() {
  if (!id) return show('Missing tournament ID.', true);
  try {
    config = await readValue(`tournamentConfigs/${id}`); if (!config) return show('Tournament not found.', true);
    // The token itself is the unguessable lookup key. Secrets are never part of public state.
    config.secrets = token ? await readValue(`tournamentLinks/${id}/${token}`).catch(() => null) : null;
    config.organizer = Boolean(config.secrets);
    app.classList.remove('hidden'); message.classList.add('hidden'); render();
    await subscribeValue(`tournaments/${id}/events`, value => { events = value || {}; render(); }, error => show(connectionMessage(error), true));
  } catch (error) { show(connectionMessage(error), true); }
}
start();

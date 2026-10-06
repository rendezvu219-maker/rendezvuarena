import { subscribeValue, appendProtectedEvent, connectionMessage, firebaseConfigured } from './firebase.js';
import { deriveBracket } from './static-core.js?v=0.7.16-dashboard-polish';
import { loadTournament, tournamentEvents, prepareTournamentRoom, appendLocalTournamentEvent,
  tournamentRoomAccess } from './tournament-draft.js?v=0.7.16-dashboard-polish';
import { p2pDraftLinks, copyDraftLink } from './draft-links.js?v=0.7.16-dashboard-polish';
import { TournamentBracketSync } from './tournament-bracket-sync.js';

const params = new URLSearchParams(location.search);
const id = params.get('tournament'), token = params.get('token') || '';
const message = document.querySelector('#message'), app = document.querySelector('#bracket-app');
let config, secrets, relay;
let events = {}, remoteEvents = {};
const links = new Map();
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
function show(text, error = false) { message.textContent = text; message.className = `notice${error ? ' error' : ''}`; message.classList.remove('hidden'); }
function refresh() {
  events = { ...remoteEvents, ...tournamentEvents(config) };
  if (secrets) config.spectatorLinks = Object.fromEntries([...links].map(([matchId, roomLinks]) => [matchId, roomLinks.broadcaster]));
  render(); relay?.publish(config, events);
}
function render() {
  const matches = deriveBracket(config, events), organizer = Boolean(secrets);
  document.querySelector('#tournament-name').textContent = config.name;
  document.querySelector('#access-label').textContent = organizer
    ? 'Open each matchup in its own Host tab, then send the Team A, Team B and Spectator links. Keep the Host room tabs open; keep this bracket open for live public updates.'
    : 'Spectator view · bracket updates automatically while the organizer is connected.';
  const rounds = [{ n:1,label:'QUARTERFINALS' },{ n:2,label:'SEMIFINALS' },{ n:3,label:'FINAL' }];
  document.querySelector('#bracket').innerHTML = rounds.map(round => `<section class="round ${round.n === 2 ? 'semifinal' : round.n === 3 ? 'final' : ''}"><h2>${round.label}</h2>${matches.filter(match => match.round === round.n).map(match => {
    const ready = !/^Winner /.test(match.teamA) && !/^Winner /.test(match.teamB), roomLinks = links.get(match.id);
    return `<article class="match-card"><div class="match-head"><span>${match.id} · BO${match.bestOf}</span><span>${match.winner ? 'COMPLETE' : ready ? 'READY' : 'WAITING'}</span></div><div class="match-team ${match.winner === match.teamA ? 'winner' : ''}"><b>${esc(match.teamA)}</b><span>${match.scoreA ?? '—'}</span></div><div class="match-team b ${match.winner === match.teamB ? 'winner' : ''}"><b>${esc(match.teamB)}</b><span>${match.scoreB ?? '—'}</span></div><div class="match-actions">${organizer && ready ? `<button data-open="${match.id}">${match.winner ? 'REOPEN DRAFT ROOM' : 'OPEN DRAFT ROOM'}</button><button data-win="${match.id}:A">TEAM A WINS</button><button data-win="${match.id}:B">TEAM B WINS</button>${roomLinks ? `<button data-copy-role="teamA" data-match="${match.id}">COPY A</button><button data-copy-role="teamB" data-match="${match.id}">COPY B</button><button data-copy-role="broadcaster" data-match="${match.id}">COPY SPECTATOR</button>` : ''}` : ready ? `<button data-watch="${match.id}">WATCH DRAFT</button>` : ''}</div></article>`;
  }).join('')}</section>`).join('');
  const final = matches.find(match => match.id === 'M7');
  document.querySelector('#champion').textContent = final.winner ? `CHAMPION · ${final.winner}` : '';
  document.querySelectorAll('[data-copy-role]').forEach(button => button.addEventListener('click', () => {
    const input = document.createElement('input'); input.value = links.get(button.dataset.match)?.[button.dataset.copyRole] || '';
    input.style.position = 'fixed'; input.style.left = '-9999px'; document.body.append(input);
    copyDraftLink(input, button).finally(() => input.remove());
  }));
  document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', async () => {
    const match = deriveBracket(config, events).find(item => item.id === button.dataset.open);
    const hostTab = window.open('about:blank', '_blank'); if (hostTab) hostTab.opener = null;
    try {
      const room = await prepareTournamentRoom(config, match, secrets, location.href);
      if (hostTab) hostTab.location.replace(room.links.host);
      else show('The browser blocked the new tab. Open the Host link below.');
      showRoomLinks(match, room.links);
    } catch (error) { hostTab?.close(); show(connectionMessage(error), true); }
  }));
  document.querySelectorAll('[data-watch]').forEach(button => button.addEventListener('click', () => {
    const url = config.spectatorLinks?.[button.dataset.watch];
    if (url) window.open(url, '_blank', 'noopener');
    else show('Open the Spectator link shared by the organizer for this match.');
  }));
  document.querySelectorAll('[data-win]').forEach(button => button.addEventListener('click', async () => {
    const [matchId, side] = button.dataset.win.split(':');
    if (!window.confirm(`Manually mark ${matchId} Team ${side} as the series winner?`)) return;
    button.disabled = true;
    try {
      const event = { type:'winner', matchId, side, actor:'O' };
      if (firebaseConfigured()) await appendProtectedEvent('tournaments', id, token, event);
      appendLocalTournamentEvent(config, token, event); refresh();
    } catch (error) { show(connectionMessage(error), true); }
    finally { button.disabled = false; }
  }));
}
function showRoomLinks(match, roomLinks) {
  let panel = document.querySelector('#match-links');
  if (!panel) { panel = document.createElement('section'); panel.id = 'match-links'; panel.className = 'panel'; app.append(panel); }
  panel.innerHTML = `<h2>${esc(match.teamA)} vs ${esc(match.teamB)}</h2><p>These links remain valid for every game in this match.</p>${['host','teamA','teamB','broadcaster'].map(role => `<label class="field"><span>${esc({ host:'Host', teamA:match.teamA, teamB:match.teamB, broadcaster:'Spectator' }[role])}</span><input readonly value="${esc(roomLinks[role])}"><a href="${esc(roomLinks[role])}" target="_blank" rel="noopener">OPEN</a><button type="button" data-link-copy="${role}">COPY</button></label>`).join('')}`;
  panel.querySelectorAll('[data-link-copy]').forEach(button => button.addEventListener('click', () => copyDraftLink(button.parentElement.querySelector('input'), button)));
}
async function start() {
  if (!id) return show('Missing tournament ID.', true);
  try {
    const loaded = await loadTournament(id, token); config = loaded.config; secrets = loaded.secrets;
    if (secrets) for (const [matchId, roomId] of Object.entries(config.roomIds)) {
      links.set(matchId, p2pDraftLinks(location.href, roomId, `rv-${roomId.toLowerCase()}`, await tournamentRoomAccess(secrets.matches[matchId], roomId)));
    }
    relay = new TournamentBracketSync({ id, host: Boolean(secrets), onSnapshot: snapshot => {
      config = snapshot.config; remoteEvents = snapshot.events || {};
      app.classList.remove('hidden'); message.classList.add('hidden'); refresh();
    }, onStatus: status => { if (status === 'live') message.classList.add('hidden'); else show(status); } }).connect();
    if (config) { app.classList.remove('hidden'); message.classList.add('hidden'); refresh(); }
    else show('Connecting to the organizer bracket…');
    window.addEventListener('storage', event => { if (config && event.key?.startsWith(`rv_tournament_events_${id}_`)) refresh(); });
    if (firebaseConfigured() && config) {
      await subscribeValue(`tournaments/${id}/events`, value => { remoteEvents = { ...remoteEvents, ...(value || {}) }; refresh(); }, error => show(connectionMessage(error), true));
      for (const [matchId, roomId] of Object.entries(config.roomIds)) await subscribeValue(`rooms/${roomId}/events`, value => {
        for (const [eventId, event] of Object.entries(value || {})) if (event.type === 'game_result') remoteEvents[`${matchId}:${eventId}`] = { ...event, matchId };
        refresh();
      }, error => show(connectionMessage(error), true));
    }
    window.addEventListener('pagehide', () => relay?.disconnect());
  } catch (error) { show(connectionMessage(error), true); }
}
start();

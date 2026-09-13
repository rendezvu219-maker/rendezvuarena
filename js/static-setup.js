import { firebaseConfigured, writeMany, connectionMessage } from './firebase.js';
import { normalizeRules, randomCode, randomSecret, pageUrl } from './static-core.js';

const notice = document.querySelector('#firebase-notice');
function show(message, kind = '') { if (!notice) return; notice.textContent = message; notice.className = `notice ${kind}`; }
function linksMarkup(links) { return Object.entries(links).map(([label, url]) => `<div class="share-row"><b>${label}</b><input readonly value="${url.replace(/"/g, '&quot;')}"><a class="secondary" href="${url}">OPEN</a><button class="secondary" data-copy="${url.replace(/"/g, '&quot;')}" type="button">COPY</button></div>`).join(''); }
function bindCopies(root) { root.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => { await navigator.clipboard.writeText(button.dataset.copy); button.textContent = 'COPIED'; setTimeout(() => { button.textContent = 'COPY'; }, 1200); })); }

if (!firebaseConfigured()) show('Realtime sharing is not connected yet. The complete setup UI is available below; add the Firebase Web App configuration to js/firebase-config.js to create cross-device A/B/Organizer/Spectator links.', 'error');

function rulesFromForm(form) {
  const values = Object.fromEntries(form);
  values.enableCoinFlip = form.has('enableCoinFlip');
  values.squadraBlastCarryBans = form.has('squadraBlastCarryBans');
  return normalizeRules(values);
}

function bindSeriesRuleControls(form) {
  const carry = form.querySelector('#squadra-carry-row');
  const update = () => {
    const selected = form.querySelector('[name="seriesRule"]:checked')?.value;
    carry?.classList.toggle('rule-dependent-hidden', selected !== 'squadra_blast');
  };
  form.querySelectorAll('[name="seriesRule"]').forEach(input => input.addEventListener('change', update));
  update();
}

document.querySelectorAll('#quick-form, #tournament-form').forEach(bindSeriesRuleControls);

const teamFields = document.querySelector('#team-fields');
if (teamFields) teamFields.innerHTML = Array.from({ length: 8 }, (_, i) => `<label class="field"><span>Team ${i + 1}</span><input name="team${i + 1}" value="Team ${i + 1}" required maxlength="60"></label>`).join('');

document.querySelector('#quick-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!firebaseConfigured()) return show('Configure Firebase first in js/firebase-config.js.', 'error');
  const form = new FormData(event.currentTarget); const roomId = randomCode();
  const tokens = { A: randomSecret(), B: randomSecret(), O: randomSecret() };
  const config = { id: roomId, type: 'quick_match', teamA: String(form.get('teamA')).trim(), teamB: String(form.get('teamB')).trim(), rules: rulesFromForm(form), createdAt: Date.now() };
  try {
    event.submitter.disabled = true; show('Creating the realtime room…');
    await writeMany({
      [`roomConfigs/${roomId}`]: config,
      [`roomSecrets/${roomId}`]: tokens,
      [`roomAccess/${roomId}/${tokens.A}`]: 'A',
      [`roomAccess/${roomId}/${tokens.B}`]: 'B',
      [`roomAccess/${roomId}/${tokens.O}`]: 'O',
    });
    const links = {
      'Team A': pageUrl('draft.html', { room: roomId, side: 'A', token: tokens.A }),
      'Team B': pageUrl('draft.html', { room: roomId, side: 'B', token: tokens.B }),
      Spectator: pageUrl('draft.html', { room: roomId, side: 'S' }),
      Organizer: pageUrl('draft.html', { room: roomId, side: 'O', token: tokens.O }),
    };
    const root = document.querySelector('#created'); root.classList.remove('hidden'); document.querySelector('#share-placeholder').textContent = `Room ${roomId} is ready. Keep the Organizer link private.`; document.querySelector('#quick-links').innerHTML = linksMarkup(links); bindCopies(root); show(`Room ${roomId} created. Save the organizer link.`, 'success'); root.scrollIntoView({ behavior: 'smooth' });
  } catch (error) { show(connectionMessage(error), 'error'); } finally { event.submitter.disabled = false; }
});

document.querySelector('#tournament-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!firebaseConfigured()) return show('Configure Firebase first in js/firebase-config.js.', 'error');
  const form = new FormData(event.currentTarget); const tournamentId = randomCode(10); const organizerToken = randomSecret();
  const teams = Array.from({ length: 8 }, (_, i) => String(form.get(`team${i + 1}`)).trim());
  const rules = rulesFromForm(form); const roomIds = {}; const writes = {};
  for (let i = 1; i <= 7; i += 1) {
    const matchId = `M${i}`; const roomId = randomCode(); const tokens = { A: randomSecret(), B: randomSecret(), O: organizerToken };
    roomIds[matchId] = { roomId, tokens };
    writes[`roomConfigs/${roomId}`] = { id: roomId, type: 'tournament', tournamentId, matchId, rules, createdAt: Date.now() };
    writes[`roomSecrets/${roomId}`] = tokens;
    writes[`roomAccess/${roomId}/${tokens.A}`] = 'A'; writes[`roomAccess/${roomId}/${tokens.B}`] = 'B'; writes[`roomAccess/${roomId}/${tokens.O}`] = 'O';
  }
  writes[`tournamentConfigs/${tournamentId}`] = { id: tournamentId, name: String(form.get('name')).trim(), teams, rules, roomIds: Object.fromEntries(Object.entries(roomIds).map(([id, value]) => [id, value.roomId])), createdAt: Date.now() };
  writes[`tournamentSecrets/${tournamentId}`] = { O: organizerToken, matches: Object.fromEntries(Object.entries(roomIds).map(([id, value]) => [id, value.tokens])) };
  writes[`tournamentLinks/${tournamentId}/${organizerToken}`] = Object.fromEntries(Object.entries(roomIds).map(([id, value]) => [id, value.tokens]));
  try { event.submitter.disabled = true; show('Creating bracket and seven realtime rooms…'); await writeMany(writes); location.href = pageUrl('bracket.html', { tournament: tournamentId, token: organizerToken }); }
  catch (error) { show(connectionMessage(error), 'error'); event.submitter.disabled = false; }
});

import { firebaseConfigured, writeMany, connectionMessage } from './firebase.js';
import { normalizeRules, generateBanOrder, randomCode, randomSecret, pageUrl } from './static-core.js';
import { HEROES } from './heroes.js';

const notice = document.querySelector('#firebase-notice');
function show(message, kind = '') { if (!notice) return; notice.textContent = message; notice.className = `notice ${kind}`; }
function linksMarkup(links) { return Object.entries(links).map(([label, url]) => `<div class="share-row"><b>${label}</b><input readonly value="${url.replace(/"/g, '&quot;')}"><a class="secondary" href="${url}" target="_blank">OPEN</a><button class="secondary" data-copy="${url.replace(/"/g, '&quot;')}" type="button">COPY</button></div>`).join(''); }
function bindCopies(root) { root.querySelectorAll('[data-copy]').forEach(button => button.addEventListener('click', async () => { await navigator.clipboard.writeText(button.dataset.copy); button.textContent = 'COPIED'; setTimeout(() => { button.textContent = 'COPY'; }, 1200); })); }

const teamFields = document.querySelector('#team-fields');
if (teamFields) teamFields.innerHTML = Array.from({ length: 8 }, (_, i) => `<label class="field"><span>Team ${i + 1}</span><input name="team${i + 1}" value="Team ${i + 1}" required maxlength="60"></label>`).join('');

// Populate Protect Heroes and Global Bans
const protectBox = document.querySelector('#protect-heroes-box');
const globalBox = document.querySelector('#global-bans-box');
if (protectBox && globalBox) {
  const sortedHeroes = [...HEROES].sort((a, b) => a.name.localeCompare(b.name));
  protectBox.innerHTML = sortedHeroes.map(h => `<label class="hero-picker-item"><input type="checkbox" name="protectHeroes" value="${h.id}"><span>${h.name} (${h.role[0]})</span></label>`).join('');
  globalBox.innerHTML = sortedHeroes.map(h => `<label class="hero-picker-item"><input type="checkbox" name="globalBans" value="${h.id}"><span>${h.name} (${h.role[0]})</span></label>`).join('');
}

// Bind Ban Count dropdown to auto-generate Ban Order
const banCountSelect = document.querySelector('#ban-count-select');
const banOrderInput = document.querySelector('#ban-order-input');
if (banCountSelect && banOrderInput) {
  banCountSelect.addEventListener('change', () => {
    const count = Number(banCountSelect.value);
    const order = generateBanOrder(count);
    banOrderInput.value = order.join(' → ');
  });
}

document.querySelector('#quick-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const roomId = randomCode(8);
  const hostPeerId = `rv-${roomId.toLowerCase()}`;
  const tokens = { A: randomSecret(16), B: randomSecret(16), O: randomSecret(16) };
  const rawForm = Object.fromEntries(form);
  rawForm.protectHeroes = Array.from(document.querySelectorAll('input[name="protectHeroes"]:checked')).map(cb => cb.value);
  rawForm.globalBans = Array.from(document.querySelectorAll('input[name="globalBans"]:checked')).map(cb => cb.value);
  const config = {
    id: roomId,
    hostPeerId,
    type: 'quick_match',
    teamA: String(form.get('teamA')).trim(),
    teamB: String(form.get('teamB')).trim(),
    rules: normalizeRules(rawForm),
    createdAt: Date.now()
  };

  try {
    event.submitter.disabled = true;
    // Store in localStorage for instant host access
    try {
      localStorage.setItem(`rv_config_${roomId}`, JSON.stringify(config));
      localStorage.setItem(`rv_secrets_${roomId}`, JSON.stringify(tokens));
    } catch {}

    // Optional Firebase sync if configured
    if (firebaseConfigured()) {
      await writeMany({
        [`roomConfigs/${roomId}`]: config,
        [`roomSecrets/${roomId}`]: tokens,
        [`roomAccess/${roomId}/${tokens.A}`]: 'A',
        [`roomAccess/${roomId}/${tokens.B}`]: 'B',
        [`roomAccess/${roomId}/${tokens.O}`]: 'O',
      }).catch(err => console.warn('Firebase optional write failed:', err));
    }

    const links = {
      'Host / Organizer': pageUrl('draft.html', { room: roomId, side: 'O', token: tokens.O, host: hostPeerId }),
      'Team A': pageUrl('draft.html', { room: roomId, side: 'A', token: tokens.A, host: hostPeerId }),
      'Team B': pageUrl('draft.html', { room: roomId, side: 'B', token: tokens.B, host: hostPeerId }),
      'Spectator': pageUrl('draft.html', { room: roomId, side: 'S', host: hostPeerId }),
    };

    const root = document.querySelector('#created');
    root.classList.remove('hidden');
    document.querySelector('#quick-links').innerHTML = linksMarkup(links);
    bindCopies(root);
    show(`Room ${roomId} created! Copy and send the links. Click 'OPEN' on Host to begin.`, 'success');
    root.scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    show(connectionMessage(error), 'error');
  } finally {
    event.submitter.disabled = false;
  }
});

document.querySelector('#tournament-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!firebaseConfigured()) return show('Configure Firebase first in js/firebase-config.js.', 'error');
  const form = new FormData(event.currentTarget); const tournamentId = randomCode(10); const organizerToken = randomSecret();
  const teams = Array.from({ length: 8 }, (_, i) => String(form.get(`team${i + 1}`)).trim());
  const rules = normalizeRules(Object.fromEntries(form)); const roomIds = {}; const writes = {};
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

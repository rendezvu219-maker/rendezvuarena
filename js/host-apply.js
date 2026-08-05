import { api, getToken } from './api.js';
import { discordInviteFromText } from './public-event-content.js';

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

let currentPreview = null;

function setMessage(message = '', error = false) {
  const el = $('#host-application-status');
  if (!message) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  el.textContent = message;
  el.classList.remove('hidden');
  el.classList.toggle('error', error);
}

function platformClass(platform) {
  return ['startgg', 'tonamel', 'challonge'].includes(platform) ? platform : 'external';
}

function renderPreview(payload) {
  currentPreview = payload.preview;
  const preview = payload.preview;
  const existing = payload.existingTournament;
  const warnings = preview.warnings || [];
  const previewEl = $('#tournament-import-preview');
  const alreadyImported = Boolean(existing);
  const detectedDiscordInvite = discordInviteFromText(preview.description);

  previewEl.innerHTML = `
    <div class="import-preview-head">
      <div>
        <span class="import-platform-badge ${platformClass(preview.platform)}">${escapeHtml(preview.platformLabel)}</span>
        <h2>${escapeHtml(preview.name)}</h2>
      </div>
      <span class="import-verified-status">${escapeHtml(preview.syncStatus.replaceAll('_', ' '))}</span>
    </div>
    <div class="import-preview-grid">
      <div><small>PLATFORM</small><b>${escapeHtml(preview.platformLabel)}</b></div>
      <div><small>EXTERNAL ID</small><b>${escapeHtml(preview.externalId)}</b></div>
      <div class="wide"><small>SOURCE URL</small><a href="${escapeHtml(preview.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(preview.sourceUrl)} ↗</a></div>
      <div class="wide"><small>TOURNAMENT NAME</small><input id="import-tournament-name" maxlength="160" value="${escapeHtml(preview.name)}"></div>
      <div class="wide"><small>Discord invite link</small><input id="import-discord-url" type="url" placeholder="https://discord.gg/..." value="${escapeHtml(detectedDiscordInvite)}"></div>
    </div>
    ${preview.description ? `<p class="import-preview-description">${escapeHtml(preview.description)}</p>` : ''}
    ${warnings.length ? `<div class="import-warning"><b>LIMITED METADATA</b>${warnings.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div>` : ''}
    ${alreadyImported ? `<div class="import-existing ${existing.ownedByCurrentUser ? 'owned' : ''}">
      <b>${existing.ownedByCurrentUser ? 'ALREADY IMPORTED BY YOU' : 'ALREADY CLAIMED'}</b>
      <span>${existing.ownedByCurrentUser
        ? 'This tournament is already in your Tournament Operations dashboard.'
        : 'Another account has already claimed this external tournament link.'}</span>
    </div>` : ''}
    <div class="import-preview-actions">
      <button class="btn btn-ghost" id="back-to-import-form" type="button">← CHANGE LINK</button>
      ${existing?.ownedByCurrentUser
        ? '<a class="btn btn-primary" href="/dashboard.html">OPEN TOURNAMENT OPS</a>'
        : alreadyImported
          ? ''
          : '<button class="btn btn-primary" id="confirm-tournament-import" type="button">IMPORT TOURNAMENT</button>'}
    </div>`;

  $('#tournament-import-form').classList.add('hidden');
  previewEl.classList.remove('hidden');
  $('#back-to-import-form').addEventListener('click', () => {
    currentPreview = null;
    previewEl.classList.add('hidden');
    $('#tournament-import-form').classList.remove('hidden');
    setMessage();
  });
  $('#confirm-tournament-import')?.addEventListener('click', importTournament);
}

async function previewTournament(event) {
  event.preventDefault();
  const button = $('#check-tournament-button');
  button.disabled = true;
  button.textContent = 'CHECKING…';
  setMessage();
  try {
    const payload = await api('/api/tournament-import/preview', {
      method: 'POST',
      body: { url: $('#tournament-source-url').value.trim() }
    });
    renderPreview(payload);
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = 'CHECK & PREVIEW';
  }
}

async function importTournament() {
  const button = $('#confirm-tournament-import');
  button.disabled = true;
  button.textContent = 'IMPORTING…';
  setMessage();
  try {
    const payload = await api('/api/tournament-import', {
      method: 'POST',
      body: {
        url: currentPreview.sourceUrl,
        name: $('#import-tournament-name').value.trim(),
        discordUrl: $('#import-discord-url').value.trim(),
        confirmOwnership: $('#tournament-owner-confirm').checked,
      }
    });
    localStorage.setItem('gs_active_tournament_id', String(payload.tournament.id));
    $('#tournament-import-preview').innerHTML = `
      <div class="import-success">
        <span class="import-success-icon">✓</span>
        <span class="home-eyebrow">IMPORT COMPLETE</span>
        <h2>${escapeHtml(payload.tournament.name)}</h2>
        <p>Your account is now the Owner of this tournament. Complete the missing rules, teams and schedule in Tournament Operations.</p>
        <div class="import-preview-actions">
          <a class="btn btn-primary" href="/dashboard.html">OPEN TOURNAMENT OPS</a>
          <a class="btn btn-ghost" href="/host-apply.html">IMPORT ANOTHER EVENT</a>
        </div>
      </div>`;
  } catch (error) {
    setMessage(error.message, true);
    button.disabled = false;
    button.textContent = 'IMPORT TOURNAMENT';
  }
}

async function bootstrap() {
  const form = $('#tournament-import-form');
  const required = $('#host-login-required');

  if (!getToken()) {
    form.classList.add('hidden');
    required.classList.remove('hidden');
    return;
  }

  try {
    await api('/api/auth/me');
  } catch {
    form.classList.add('hidden');
    required.classList.remove('hidden');
    return;
  }

  form.addEventListener('submit', previewTournament);
}

bootstrap();

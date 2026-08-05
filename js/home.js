import { api, getToken, setToken } from './api.js';
import { eventCardSummary } from './public-event-content.js';

const state = { events: [], filter: 'all', user: null };
const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

function eventKind(event) {
  const status = String(event.status || '').toLowerCase();
  if (['running','live','playing','in_progress'].includes(status)) return 'live';
  if (['completed','finalized','archived'].includes(status)) return 'completed';
  return 'upcoming';
}
function formatDate(value) {
  if (!value) return 'Schedule pending';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString([], { dateStyle:'medium', timeStyle:'short' });
}
function renderEvents() {
  const visible = state.events.filter(event => state.filter === 'all' || eventKind(event) === state.filter);
  $('#home-events').innerHTML = visible.length ? visible.map(event => {
    const kind = eventKind(event);
    const publicUrl = `/public.html?slug=${encodeURIComponent(event.slug)}`;
    const joinUrl = `/join-tournament.html?slug=${encodeURIComponent(event.slug)}`;
    return `<article class="home-event-card ${kind}"><span class="event-status"><i></i>${kind.toUpperCase()}</span><h3>${escapeHtml(event.name)}</h3><p>${escapeHtml(eventCardSummary(event.description))}</p><div class="event-meta"><span>${escapeHtml(formatDate(event.start_at))}</span><span>${escapeHtml(event.timezone || '')}</span></div><div class="event-actions"><a class="btn btn-primary btn-sm" href="${publicUrl}">VIEW EVENT</a>${kind!=='completed'?`<a class="btn btn-ghost btn-sm" href="${joinUrl}">JOIN / LINK ACCOUNT</a>`:''}${event.source_url ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(event.source_url)}" target="_blank" rel="noopener">${escapeHtml((event.source_platform||'source').toUpperCase())} ↗</a>` : ''}${event.public_stream_url ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(event.public_stream_url)}" target="_blank" rel="noopener">STREAM ↗</a>` : ''}</div></article>`;
  }).join('') : '<div class="home-event-empty">No public tournaments match this filter yet.</div>';
}
async function loadEvents() {
  $('#home-events').innerHTML = '<div class="home-event-empty">Loading public tournaments…</div>';
  try { state.events = (await api('/api/public/tournaments')).tournaments || []; renderEvents(); }
  catch (error) { $('#home-events').innerHTML = `<div class="home-event-empty">${escapeHtml(error.message)}</div>`; }
}
function renderAccount() {
  const box = $('#home-account');
  if (!box) return;
  let languageSlot = box.querySelector('[data-language-slot]');
  if (!languageSlot) {
    const slotTemplate = document.createElement('template');
    slotTemplate.innerHTML = '<div class="gs-language-slot" data-language-slot="true"></div>';
    languageSlot = slotTemplate.content.firstElementChild;
    box.appendChild(languageSlot);
  }
  [...box.children].forEach(child => {
    if (child !== languageSlot && !child.classList.contains('gs-global-menu')) child.remove();
  });
  window.GSGlobalMenu?.mount(box);
  window.GSGlobalMenu?.refresh();
}
async function bootstrap() {
  $('#refresh-events').addEventListener('click', loadEvents);
  document.querySelectorAll('#event-filters button').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('#event-filters button').forEach(x => x.classList.toggle('active', x === button)); state.filter = button.dataset.filter; renderEvents(); }));
  if (getToken()) { try { state.user = (await api('/api/auth/me')).user; } catch { setToken(''); } }
  renderAccount();
  loadEvents();
}
bootstrap();

import { api, getToken } from './api.js';
import { t } from './i18n.js';

const $ = selector => document.querySelector(selector);
const params = new URLSearchParams(location.search);
const slug = params.get('slug') || '';
const state = { options:null, me:null, eligibility:null };
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const label = value => String(value || '').replaceAll('_',' ').replace(/\b\w/g, c => c.toUpperCase());

function showError(message) {
  const box = $('#join-error');
  box.textContent = message;
  box.classList.remove('hidden');
}
function clearError() { $('#join-error').classList.add('hidden'); }
function selectedTeam() {
  const id = Number($('#join-team').value || 0);
  return state.options?.teams?.find(team => Number(team.id) === id) || null;
}
function renderMemberOptions() {
  const team = selectedTeam();
  const select = $('#join-member');
  const available = (team?.members || []).filter(member => !member.accountLinked);
  select.innerHTML = `<option value="">My roster name is not listed</option>${available.map(member => `<option value="${member.id}">${escapeHtml(member.gamerTag || member.displayName)} · ${escapeHtml(label(member.memberRole))}</option>`).join('')}`;
  $('#join-custom-team-wrap').classList.toggle('hidden', Boolean(team));
  $('#join-custom-team').required = !team;
}
function renderSource() {
  const tournament = state.options.tournament;
  const title = String(tournament.name || t('linkTournamentAccount')).trim();
  const titleElement = $('#join-title');
  titleElement.textContent = title;
  titleElement.classList.toggle('is-long', title.length > 24 && title.length <= 40);
  titleElement.classList.toggle('is-very-long', title.length > 40);
  $('#join-description').textContent = tournament.description || t('joinIntro');
  $('#join-source').innerHTML = tournament.source_url
    ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(tournament.source_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('registerViewOnProvider',{provider:(tournament.source_platform||'SOURCE').toUpperCase()}))}</a>`
    : `<span class="join-muted">${escapeHtml(t('noExternalRegistrationLink'))}</span>`;
}
function renderEligibility(){
  const panel=$('#join-requirements');
  const eligibility=state.eligibility;
  if(!eligibility){panel.classList.add('hidden');return false;}
  const requirements=eligibility.requirements||{};
  const provider=requirements.requiredProvider;
  const providerLabel=String(provider||'').toUpperCase();
  if(eligibility.eligible){
    panel.className='join-account-status approved';
    panel.innerHTML=`<span>${escapeHtml(t('requirementsReady'))}</span><h2>${escapeHtml(provider?t('providerProfileConnected',{provider:providerLabel}):t('emailVerifiedRequirement'))}</h2><p>${escapeHtml(provider==='startgg'&&requirements.entrantMatched===false?t('startggEntrantNoMatchDesc'):t('joinRequirementsReadyDesc'))}</p>`;
    panel.classList.remove('hidden');
    return true;
  }
  panel.className='join-account-status pending';
  if(provider){
    panel.innerHTML=`<span>${escapeHtml(t('actionRequired'))}</span><h2>${escapeHtml(t('addProviderProfile',{provider:providerLabel}))}</h2><p>${escapeHtml(t('providerProfileRequiredDesc'))}</p><a class="btn btn-primary" href="/portal.html">${escapeHtml(t('openTournamentProfiles'))}</a>`;
  }
  panel.classList.remove('hidden');
  return false;
}


function renderForm() {
  const teams = state.options.teams || [];
  $('#join-team').innerHTML = teams.length
    ? `${teams.map(team => `<option value="${team.id}">${escapeHtml(team.name)}${team.tag ? ` [${escapeHtml(team.tag)}]` : ''}${team.captainLinked ? ' · Captain linked' : ''}</option>`).join('')}<option value="">My team is not listed</option>`
    : '<option value="">Team list is not synced — enter it manually</option>';
  const matched=state.eligibility?.matchingMembers?.[0];
  if(matched&&teams.some(team=>Number(team.id)===Number(matched.team_id)))$('#join-team').value=String(matched.team_id);
  else if (teams.length) $('#join-team').value = String(teams[0].id);
  renderMemberOptions();
  if(matched&&[...$('#join-member').options].some(option=>Number(option.value)===Number(matched.id)))$('#join-member').value=String(matched.id);
  $('#join-form').classList.remove('hidden');
}
function renderStatus(payload) {
  const panel = $('#join-status');
  const membership = payload?.membership;
  const request = payload?.request;
  if (membership) {
    panel.className = 'join-account-status approved';
    panel.innerHTML = `<span>ACCOUNT LINKED</span><h2>${escapeHtml(membership.team_name)}</h2><p>You are linked as <b>${escapeHtml(label(membership.member_role))}</b>. Matches for this team are available in your portal.</p><a class="btn btn-primary" href="/portal.html">OPEN PLAYER & CAPTAIN PORTAL</a>`;
    panel.classList.remove('hidden');
    return true;
  }
  if (request?.status === 'pending') {
    panel.className = 'join-account-status pending';
    panel.innerHTML = `<span>REQUEST PENDING</span><h2>${escapeHtml(request.team_name || request.requested_team_name || 'Tournament join request')}</h2><p>The Host must confirm that this account matches the external entrant or roster.</p><button class="btn btn-ghost" id="cancel-join-request">CANCEL REQUEST</button>`;
    panel.classList.remove('hidden');
    $('#cancel-join-request').addEventListener('click', async () => {
      try { await api(`/api/tournaments/${encodeURIComponent(slug)}/join-requests/current`, { method:'DELETE' }); location.reload(); }
      catch (error) { showError(error.message); }
    });
    return true;
  }
  if (request?.status === 'rejected') {
    panel.className = 'join-account-status rejected';
    panel.innerHTML = `<span>PREVIOUS REQUEST REJECTED</span><h2>YOU MAY SUBMIT AGAIN</h2><p>${escapeHtml(request.review_note || 'Check the selected team and external gamer tag before submitting again.')}</p>`;
    panel.classList.remove('hidden');
  }
  return false;
}
async function bootstrap() {
  if (!slug) return showError(t('missingTournamentLink')||'Missing tournament link.');
  try {
    state.options = await api(`/api/public/tournaments/${encodeURIComponent(slug)}/join-options`);
    renderSource();
    $('#join-loading').classList.add('hidden');
    if (!state.options.tournament.canJoin) return showError(t('tournamentClosedJoin')||'This tournament is no longer accepting account-link requests.');
    if (!getToken()) {
      $('#join-auth-required').classList.remove('hidden');
      $('#join-login-link').href = `/auth.html?return=${encodeURIComponent(location.pathname + location.search)}`;
      return;
    }
    [state.me,state.eligibility] = await Promise.all([
      api(`/api/tournaments/${encodeURIComponent(slug)}/my-join`),
      api(`/api/tournaments/${encodeURIComponent(slug)}/eligibility`),
    ]);
    const blocked = renderStatus(state.me);
    const eligible = renderEligibility();
    if (!blocked && eligible) renderForm();
  } catch (error) {
    $('#join-loading').classList.add('hidden');
    showError(error.message);
  }
}

$('#join-team').addEventListener('change', renderMemberOptions);
$('#join-member').addEventListener('change', () => {
  const team = selectedTeam();
  const member = team?.members?.find(item => Number(item.id) === Number($('#join-member').value));
  if (member?.gamerTag) $('#join-gamer-tag').value = member.gamerTag;
});
$('#join-form').addEventListener('submit', async event => {
  event.preventDefault(); clearError();
  try {
    const teamId = Number($('#join-team').value || 0) || null;
    const memberId = Number($('#join-member').value || 0) || null;
    await api(`/api/tournaments/${encodeURIComponent(slug)}/join-requests`, {
      method:'POST',
      body:{
        requestedRole:$('#join-role').value,
        teamId,
        memberId,
        requestedTeamName:teamId ? '' : $('#join-custom-team').value.trim(),
        gamerTag:$('#join-gamer-tag').value.trim(),
        message:$('#join-message').value.trim(),
      },
    });
    location.reload();
  } catch (error) { showError(error.message); }
});

bootstrap();

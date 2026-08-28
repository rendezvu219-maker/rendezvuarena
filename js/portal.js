import { api, getToken, setToken, connectSocket, escapeHtml } from './api.js';
import { t } from './i18n.js';

const state = {
  user: null,
  teams: [],
  matches: [],
  allMatches: [],
  tournamentTeams: [],
  joinRequests: [],
  history: { stats: {}, participated: [], organized: [] },
  externalProfiles: [],
  providerCapabilities: {},
  profileSettings: null,
  openMatchId: null,
  socket: null,
  search: '',
  matchScope: 'my',
  knownDraftReady: new Set(),
  portalLoaded: false
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const inviteToken = new URLSearchParams(location.search).get('invite') || '';

function statusLabel(value) {
  return String(value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

function toast(message, error = false) {
  const el = $('#ops-toast');
  el.textContent = message;
  el.classList.toggle('error', error);
  el.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.add('hidden'), 4200);
}

function openExternal(url) {
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}

function showAuth() {
  $('#portal-auth').classList.remove('hidden');
  $('#portal-view').classList.add('hidden');
  $('#portal-logout').classList.add('hidden');
  window.GSGlobalMenu?.refresh();
  $('#invite-notice').textContent = inviteToken ? 'Sign in or register with the invited account, then accept the Captain invitation.' : '';
}

function showPortal() {
  $('#portal-auth').classList.add('hidden');
  $('#portal-view').classList.remove('hidden');
  $('#portal-logout').classList.remove('hidden');
  window.GSGlobalMenu?.refresh();
}

async function downloadFile(fileId, fileName = 'attachment') {
  try {
    const response = await fetch(`/api/files/${fileId}`, { credentials: 'same-origin' });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Download failed (${response.status})`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    toast(error.message, true);
  }
}

function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function chatAttachmentHtml(message) {
  if (!message.file_id || message.deleted_at) return '';
  const name = escapeHtml(message.file_name || 'Attachment');
  if (String(message.file_mime || '').startsWith('image/')) {
    return `<figure class="ops-chat-image"><img src="/api/files/${Number(message.file_id)}?inline=1" alt="${name}" loading="lazy"><figcaption>${name}</figcaption></figure>`;
  }
  return `<button type="button" class="ops-file-link" data-file-id="${Number(message.file_id)}" data-file-name="${name}">📎 ${name}</button>`;
}

async function bootstrap() {
  bindStatic();
  const params = new URLSearchParams(location.search);
  const startggStatus = params.get('startgg');
  const challongeStatus = params.get('challonge');
  if (startggStatus === 'connected') toast(t('startggConnectedToast'));
  else if (startggStatus === 'error') toast(t('startggConnectionFailedToast'), true);
  if (challongeStatus === 'connected') toast(t('challongeConnectedToast'));
  else if (challongeStatus === 'error') toast(t('challongeConnectionFailedToast'), true);

  if (!getToken()) return showAuth();
  try {
    state.user = (await api('/api/auth/me')).user;
    showPortal();
    connectRealtime();
    await loadPortal();
  } catch (error) {
    setToken('');
    showAuth();
    toast(error.message, true);
  }
}

function bindStatic() {
  $('#portal-login-form').addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const payload = await api('/api/auth/login', {
        method: 'POST',
        body: { identity: $('#portal-login-identity').value, password: $('#portal-login-password').value }
      });
      setToken('cookie-session');
      state.user = payload.user;
      showPortal();
      connectRealtime();
      await loadPortal();
    } catch (error) {
      toast(error.message, true);
    }
  });

  $('#portal-register-form').addEventListener('submit', async event => {
    event.preventDefault();
    const password = $('#portal-register-password').value;
    const passwordConfirmation = $('#portal-register-password-confirm').value;
    if (password !== passwordConfirmation) return toast(t('registrationPasswordMismatch'), true);
    try {
      const payload = await api('/api/auth/register', {
        method: 'POST',
        body: { username: $('#portal-register-username').value, password, passwordConfirmation, role: 'player' }
      });
      setToken('cookie-session');
      state.user = payload.user;
      showPortal();
      connectRealtime();
      await loadPortal();
    } catch (error) {
      toast(error.message, true);
    }
  });

  $('#portal-logout').addEventListener('click', () => {
    setToken('');
    state.socket?.disconnect();
    state.user = null;
    showAuth();
  });

  $('#portal-refresh').addEventListener('click', loadPortal);
  $('#portal-search').addEventListener('input', event => {
    state.search = event.target.value;
    renderMatches();
  });

  $('#scope-my-matches')?.addEventListener('click', () => {
    state.matchScope = 'my';
    $('#scope-my-matches').classList.add('active', 'btn-primary');
    $('#scope-my-matches').classList.remove('btn-ghost');
    $('#scope-all-matches').classList.remove('active', 'btn-primary');
    $('#scope-all-matches').classList.add('btn-ghost');
    renderMatches();
  });

  $('#scope-all-matches')?.addEventListener('click', () => {
    state.matchScope = 'all';
    $('#scope-all-matches').classList.add('active', 'btn-primary');
    $('#scope-all-matches').classList.remove('btn-ghost');
    $('#scope-my-matches').classList.remove('active', 'btn-primary');
    $('#scope-my-matches').classList.add('btn-ghost');
    renderMatches();
  });

  $('#portal-close-match').addEventListener('click', closeMatch);
  $('#portal-match-modal').addEventListener('click', event => {
    if (event.target.id === 'portal-match-modal') closeMatch();
  });
}

function connectRealtime() {
  state.socket?.disconnect();
  state.socket = connectSocket();
  if (!state.socket) return;
  state.socket.on('match:chat', payload => {
    if (Number(payload.matchId) === state.openMatchId) appendChat(payload.message);
  });
  state.socket.on('bracket:updated', () => loadPortal({ quiet: true }));
  state.socket.on('match:updated', () => loadPortal({ quiet: true }));
  state.socket.on('match:checkin', async payload => {
    const openMatchId = state.openMatchId;
    await loadPortal({ quiet: true });
    if (openMatchId === Number(payload?.matchId)) openMatch(openMatchId);
  });
}

async function loadPortal({ quiet = false } = {}) {
  try {
    const [payload, profilePayload, settingsPayload] = await Promise.all([
      api('/api/portal'),
      api('/api/profile/external'),
      api('/api/profile/settings')
    ]);
    const nextDraftReady=new Set((payload.matches||[]).filter(match=>match.draft_room_ready).map(match=>Number(match.id)));
    const newlyOpenedDrafts=[...nextDraftReady].filter(matchId=>!state.knownDraftReady.has(matchId));
    state.user = payload.user;
    state.teams = payload.teams || [];
    state.matches = payload.matches || [];
    state.allMatches = payload.allMatches || [];
    state.tournamentTeams = payload.tournamentTeams || [];
    state.joinRequests = payload.joinRequests || [];
    state.history = payload.history || { stats: {}, participated: [], organized: [] };
    state.externalProfiles = profilePayload.profiles || [];
    state.providerCapabilities = profilePayload.providers || {};
    state.profileSettings = settingsPayload.profile || null;
    showPortal();
    [...new Set(state.teams.map(team => team.tournament_id))].forEach(tournamentId => {
      state.socket?.emit('tournament:join', { tournamentId });
    });
    renderInvite();
    renderAccountSettings();
    renderExternalProfiles();
    renderHistory();
    renderTeams();
    renderMatches();
    if(state.portalLoaded&&newlyOpenedDrafts.length)toast('✓ Draft Room is open for your team. Use the large “OPEN MY TEAM DRAFT ROOM” button on your team card.');
    state.knownDraftReady=nextDraftReady;
    state.portalLoaded=true;
  } catch (error) {
    if (!quiet) toast(error.message, true);
  }
}

function renderExternalProfiles() {
  const container = $('#portal-external-profiles');
  if (!container) return;
  const profiles = new Map((state.externalProfiles || []).map(item => [item.provider, item]));
  const providerIdentity = profile => profile?.displayName || profile?.gamerTag || profile?.providerUserId || 'Connected';
  const statusBadge = profile => {
    if (!profile) return '';
    const verified = profile.verificationStatus === 'verified';
    return `<span class="portal-provider-status ${verified ? 'is-verified' : 'is-review'}">${escapeHtml(verified ? t('profileStatusVerified') : t('profileStatusNeedsReview'))}</span>`;
  };
  const currentProfile = profile => profile ? `<a class="portal-provider-current" href="${escapeHtml(profile.profileUrl)}" target="_blank" rel="noopener noreferrer"><span>${escapeHtml(providerIdentity(profile))}</span><small>${escapeHtml(profile.profileUrl)}</small><b aria-hidden="true">↗</b></a>` : '';
  const disconnectButton = provider => `<button class="btn btn-danger btn-sm" type="button" data-disconnect-provider="${provider}">${escapeHtml(t('disconnect'))}</button>`;

  const manualCard=(provider, label, profile, description) => `<form class="ops-form-card portal-provider-card portal-provider-card--manual portal-provider-card--${provider}" data-manual-provider="${provider}">
    <header class="portal-provider-head"><div class="portal-provider-brand"><span class="portal-provider-mark">${escapeHtml(label.slice(0,1).toUpperCase())}</span><div><b>${escapeHtml(label)}</b><small>${escapeHtml(description)}</small></div></div>${statusBadge(profile)}</header>
    ${currentProfile(profile)}
    ${profile && profile.verificationStatus !== 'verified' ? `<div class="portal-provider-review-note">${escapeHtml(t('manualProfileHostReview'))}</div>` : ''}
    <div class="portal-provider-fields">
      <label><span>${escapeHtml(t('profileUrlPlaceholder'))}</span><input name="profileUrl" type="url" value="${escapeHtml(profile?.profileUrl || '')}" placeholder="${escapeHtml(t('profileUrlPlaceholder'))}" required></label>
      <label><span>${escapeHtml(t('profileDisplayNamePlaceholder'))}</span><input name="displayName" value="${escapeHtml(profile?.displayName || profile?.gamerTag || '')}" placeholder="${escapeHtml(t('profileDisplayNamePlaceholder'))}"></label>
    </div>
    <div class="portal-provider-actions">${profile ? `<a class="btn btn-ghost btn-sm" href="${escapeHtml(profile.profileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t('openProfileExternal'))}</a>` : ''}<button class="btn btn-primary btn-sm">${escapeHtml(profile ? t('updateProfileLink') : t('saveProfile'))}</button>${profile ? disconnectButton(provider) : ''}</div>
  </form>`;

  const startgg = profiles.get('startgg');
  const tonamel = profiles.get('tonamel');
  const challonge = profiles.get('challonge');
  const startggCard = manualCard('startgg', 'start.gg', startgg, t('startggManualProfileDesc'));
  const tonamelCard = manualCard('tonamel', 'Tonamel', tonamel, t('tonamelManualProfileDesc'));
  const challongeCard = manualCard('challonge', 'Challonge', challonge, t('challongeManualProfileDesc'));

  container.innerHTML = startggCard + tonamelCard + challongeCard;
  document.querySelectorAll('[data-disconnect-provider]').forEach(button => button.addEventListener('click', async () => {
    const provider = button.dataset.disconnectProvider;
    if (!confirm(t('disconnectProviderConfirm', { provider }))) return;
    try {
      await api(`/api/profile/external/${provider}`, { method: 'DELETE' });
      toast(t('profileDisconnectedToast'));
      await loadPortal({ quiet: true });
    } catch (error) {
      toast(error.message, true);
    }
  }));
  document.querySelectorAll('[data-manual-provider]').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const data = new FormData(form);
      await api('/api/profile/external/manual', { method: 'POST', body: { provider: form.dataset.manualProvider, profileUrl: data.get('profileUrl'), displayName: data.get('displayName') } });
      toast(t('profileSavedReviewToast'));
      await loadPortal({ quiet: true });
    } catch (error) {
      toast(error.message, true);
    }
  }));
}

function renderAccountSettings() {
  const profile = state.profileSettings || {};
  if ($('#portal-profile-display-name')) $('#portal-profile-display-name').value = profile.displayName || state.user?.displayName || '';
  if ($('#portal-profile-gamer-tag')) $('#portal-profile-gamer-tag').value = profile.gamerTag || '';
  if ($('#portal-profile-bio')) $('#portal-profile-bio').value = profile.bio || '';
  if ($('#portal-profile-visibility')) $('#portal-profile-visibility').value = profile.profileVisibility === 'private' ? 'private' : 'public';
  if ($('#portal-view-profile')) $('#portal-view-profile').href = `/profile.html?user=${encodeURIComponent(profile.username || state.user?.username || '')}`;

  $('#portal-profile-settings-form').onsubmit = async event => {
    event.preventDefault();
    try {
      const payload = await api('/api/profile/settings', {
        method: 'PATCH',
        body: {
          displayName: $('#portal-profile-display-name').value,
          gamerTag: $('#portal-profile-gamer-tag').value,
          bio: $('#portal-profile-bio').value,
          profileVisibility: $('#portal-profile-visibility').value
        }
      });
      state.profileSettings = payload.profile;
      state.user.displayName = payload.profile.displayName;
      showPortal();
      toast(t('profileSettingsSaved'));
    } catch (error) {
      toast(error.message, true);
    }
  };

  $('#portal-change-password-form').onsubmit = async event => {
    event.preventDefault();
    const next = $('#portal-password-new').value;
    if (next !== $('#portal-password-confirm').value) return toast(t('passwordConfirmationMismatch'), true);
    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword: $('#portal-password-current').value, newPassword: next }
      });
      event.currentTarget.reset();
      toast(t('passwordChangedToast'));
    } catch (error) {
      toast(error.message, true);
    }
  };
}

function renderHistory() {
  const history = state.history || { stats: {}, participated: [], organized: [] };
  const stats = history.stats || {};
  if ($('#portal-history-stats')) {
    $('#portal-history-stats').innerHTML = `<div class="ops-stat"><div class="ops-stat-value">${Number(stats.participatedCount || 0)}</div><div class="ops-stat-label">Events Played</div></div><div class="ops-stat"><div class="ops-stat-value">${Number(stats.championships || 0)}</div><div class="ops-stat-label">Championships</div></div><div class="ops-stat"><div class="ops-stat-value">${Number(stats.podiums || 0)}</div><div class="ops-stat-label">Top Finishes</div></div><div class="ops-stat"><div class="ops-stat-value">${Number(stats.organizedCount || 0)}</div><div class="ops-stat-label">Events Organized</div></div>`;
  }
  if ($('#portal-participated-history')) {
    $('#portal-participated-history').innerHTML = (history.participated || []).length
      ? (history.participated || []).map(item => `<a class="portal-history-card achievement-${escapeHtml(item.achievement?.tone || 'neutral')}" href="/public.html?slug=${encodeURIComponent(item.tournamentSlug)}" target="_blank" rel="noopener"><div><b>${escapeHtml(item.tournamentName)}</b><span>${escapeHtml(item.teamName)}${item.isCaptain ? ' · Captain' : ''}</span></div><div class="portal-achievement"><strong>${escapeHtml(item.achievement?.label || 'Participant')}</strong><span>${escapeHtml(statusLabel(item.status))}</span></div></a>`).join('')
      : '<div class="portal-empty">No tournament participation recorded yet.</div>';
  }
  if ($('#portal-organized-history')) {
    $('#portal-organized-history').innerHTML = (history.organized || []).length
      ? (history.organized || []).map(item => `<a class="portal-history-card" href="/dashboard.html?tournamentId=${item.tournamentId}" target="_blank" rel="noopener"><div><b>${escapeHtml(item.tournamentName)}</b><span>${Number(item.teamCount || 0)} teams · ${Number(item.matchCount || 0)} matches</span></div><div class="portal-achievement"><strong>${escapeHtml(statusLabel(item.status))}</strong><span>${escapeHtml(formatDate(item.startAt || item.createdAt))}</span></div></a>`).join('')
      : '<div class="portal-empty">No organized tournaments recorded yet.</div>';
  }
}

function renderInvite() {
  const panel = $('#portal-invite-action');
  if (!inviteToken) {
    panel?.classList.add('hidden');
    return;
  }
  panel?.classList.remove('hidden');
  panel.innerHTML = `<div class="ops-section-header"><div><h3>Team Invitation</h3><div class="ops-list-meta">Accept to join the roster using the role selected by the Team Captain or Host.</div></div><button class="btn btn-primary" id="accept-invite">ACCEPT TEAM INVITATION</button></div>`;
  $('#accept-invite')?.addEventListener('click', async () => {
    try {
      const payload = await api('/api/team-invitations/accept', { method: 'POST', body: { token: inviteToken } });
      history.replaceState({}, '', location.pathname);
      toast(`Team invitation accepted as ${statusLabel(payload.role)}.`);
      await loadPortal();
    } catch (error) {
      toast(error.message, true);
    }
  });
}

function renderTeams() {
  const pending = state.joinRequests.filter(item => item.status === 'pending');
  $('#portal-teams').innerHTML = state.teams.length ? state.teams.map(team => {
    const members = Array.isArray(team.members) ? team.members : [];
    const isCaptain = Boolean(team.my_is_captain) || team.my_member_role === 'captain';
    const rosterPrivate = team.rosterPrivate === true;
    const rosterLock = team.roster_locked_at || team.tournament_roster_lock_at;
    const locked = rosterPrivate || Boolean(rosterLock && Date.parse(rosterLock) <= Date.now());
    const roster = members.map(member => `<div class="portal-roster-member"><div><b>${escapeHtml(member.display_name)}</b><span>${escapeHtml(member.gamer_tag || member.member_role || 'Player')} · ${escapeHtml(statusLabel(member.member_role || 'player'))}${member.is_captain ? ' · ★ Captain' : ''}${member.user_id ? ' · Account linked' : ' · Waiting for account link'}</span></div>${isCaptain && !member.is_captain && !locked ? `<div class="ops-toolbar"><button type="button" class="btn btn-ghost btn-xs portal-transfer-captain" data-team-id="${team.id}" data-member-id="${member.id}" data-member-name="${escapeHtml(member.display_name)}">MAKE CAPTAIN</button><button type="button" class="btn btn-danger btn-xs portal-remove-member" data-team-id="${team.id}" data-member-id="${member.id}">REMOVE</button></div>` : ''}</div>`).join('');
    return `<article class="ops-stat portal-team-card ${isCaptain ? 'captain-managed' : ''}"><div class="portal-team-heading"><div><div class="ops-stat-value">${escapeHtml(team.tag)}</div><div class="ops-stat-label">${escapeHtml(team.name)}</div></div><div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap"><a href="/public.html?slug=${encodeURIComponent(team.tournament_slug)}#bracket" target="_blank" rel="noopener" class="btn btn-ghost btn-xs">VIEW BRACKET ↗</a><span class="portal-captain-badge">${isCaptain ? 'CAPTAIN · DRAFT CONTROLLER' : 'ROSTER MEMBER · VIEW ONLY'}</span></div></div><div class="ops-list-meta">${escapeHtml(team.tournament_name)} · ${escapeHtml(statusLabel(team.my_member_role || 'player'))}${locked && !rosterPrivate ? ' · Roster locked' : ''}</div><div class="ops-list-meta">${isCaptain ? 'You alone check in the team, run coin flip and ban/pick, then submit or approve results. Teammates do not need to enter the Draft Room.' : 'Your roster slot completes the team. The linked Captain alone controls tournament Draft operations.'}</div><div class="portal-roster-list">${rosterPrivate ? `<div class="ops-list-meta">${escapeHtml(t('soloRosterPrivateUntilMatch'))}</div>` : (roster || '<div class="ops-list-meta">No roster members yet.</div>')}</div>${isCaptain ? rosterPrivate ? `<div class="ops-result-warning">${escapeHtml(t('soloRosterPrivateUntilMatch'))}</div>` : locked ? '<div class="ops-result-warning">Roster is locked. Ask the Host for any change.</div>' : `<form class="portal-invite-member-form" data-team-id="${team.id}"><div><b>Invite a registered member</b><span>They must accept the private invitation link before receiving access.</span></div><input name="identity" placeholder="Member username" required><select name="role"><option value="player">Player</option><option value="substitute">Substitute</option><option value="coach">Coach</option></select><button class="btn btn-primary btn-sm">CREATE INVITE</button></form><div class="portal-invite-output" data-invite-output="${team.id}"></div>` : ''}</article>`;
  }).join('') : `<div class="ops-section portal-empty">No team is linked to this account yet.${pending.length ? ` ${pending.length} join request(s) are waiting for Host confirmation.` : ' Use JOIN / LINK ACCOUNT on a public tournament page.'}</div>`;

  // Put the next captain action directly on the team card. A first-time
  // Captain should not need to discover that check-in lives inside a match.
  $$('.portal-team-card').forEach((card,index) => {
    const team=state.teams[index];
    const isCaptain=Boolean(team?.my_is_captain)||team?.my_member_role==='captain';
    if(!isCaptain)return;
    const teamMatches = state.matches.filter(item => Number(item.team_a_id) === Number(team.id) || Number(item.team_b_id) === Number(team.id));
    const match = teamMatches.find(item => item.result_status !== 'final' && item.match_status !== 'completed') || teamMatches.at(-1);
    const action = document.createElement('section');
    action.className = 'ops-result-warning';
    action.style.marginTop = '14px';
    if (!match) {
      action.innerHTML = '<b>NEXT STEP: WAIT FOR THE HOST</b><br><small>Your team is ready. The Host must generate the bracket and start the tournament first.</small>';
    } else if (match.result_status === 'final' || match.match_status === 'completed') {
      action.innerHTML = '<b>✓ TOURNAMENT RUN FINISHED</b><br><small>All scheduled matches for this team have completed.</small>';
    } else if (!match.team_a_id || !match.team_b_id) {
      action.innerHTML = '<b>NEXT STEP: WAITING FOR OPPONENT</b><br><small>Your team has advanced to the next round! Waiting for the opposing match to finish.</small>';
    } else {
      const checkinOpen = ['checkin_open'].includes(String(match.match_status || '')) && Number(match.round_no || 1) === 1;
      const draftReady = Boolean(match.draft_room_ready);
      if (draftReady) {
        action.innerHTML = `<b>✓ DRAFT ROOM IS OPEN</b><br><small>First, either Captain can create a game-room code and send it in Match Chat. Then enter as Captain of ${escapeHtml(team.tag)}.</small><div class="ops-toolbar" style="margin-top:10px"><button type="button" class="btn btn-ghost btn-sm portal-open-match-chat" data-match-id="${match.id}">SEND GAME ROOM CODE</button><button type="button" class="btn btn-primary btn-sm portal-team-draft" data-match-id="${match.id}">OPEN MY TEAM DRAFT ROOM</button></div>`;
      } else if (checkinOpen) {
        action.innerHTML = `<b>NEXT STEP: CHECK IN NOW</b><br><small>Click once. After both teams are checked in, the Host opens the Draft Room and this card will change to “DRAFT ROOM IS OPEN”.</small><div class="ops-toolbar" style="margin-top:10px"><button type="button" class="btn btn-primary btn-sm portal-team-checkin" data-match-id="${match.id}">CHECK IN MY TEAM NOW</button></div>`;
      } else {
        action.innerHTML = '<b>✓ READY FOR DRAFT</b><br><small>Both teams are set. Waiting for the Host to open the Draft Room.</small>';
      }
    }
    card.append(action);
  });
  $$('.portal-team-checkin').forEach(button=>button.addEventListener('click',async()=>{
    try{await api(`/api/matches/${button.dataset.matchId}/checkin`,{method:'POST',body:{}});toast('Your team is checked in. Waiting for the Host to open Draft.');await loadPortal({quiet:true});}
    catch(error){toast(error.message,true);}
  }));
  $$('.portal-team-draft').forEach(button=>button.addEventListener('click',async()=>{
    try{const payload=await api(`/api/matches/${button.dataset.matchId}/draft-room/access`);openExternal(payload.url);}
    catch(error){toast(error.message,true);}
  }));
  $$('.portal-open-match-chat').forEach(button=>button.addEventListener('click',()=>openMatch(Number(button.dataset.matchId))));

  $$('.portal-invite-member-form').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const teamId = Number(form.dataset.teamId);
    const data = new FormData(form);
    try {
      const payload = await api(`/api/portal/teams/${teamId}/invitations`, {
        method: 'POST',
        body: { identity: String(data.get('identity') || '').trim(), role: data.get('role') }
      });
      const output = document.querySelector(`[data-invite-output="${teamId}"]`);
      output.innerHTML = `<div class="portal-created-invite"><span>Send this private link to <b>${escapeHtml(payload.user.username)}</b>. It expires in 7 days.</span><input readonly value="${escapeHtml(payload.inviteLink)}"><button type="button" class="btn btn-ghost btn-xs">COPY INVITE</button></div>`;
      output.querySelector('button').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(payload.inviteLink);
          toast('Member invitation copied.');
        } catch {
          output.querySelector('input').select();
          document.execCommand('copy');
          toast('Member invitation copied.');
        }
      });
      form.reset();
    } catch (error) {
      toast(error.message, true);
    }
  }));

  $$('.portal-remove-member').forEach(button => button.addEventListener('click', async () => {
    if (!confirm('Remove this member from your tournament roster?')) return;
    try {
      await api(`/api/portal/teams/${button.dataset.teamId}/members/${button.dataset.memberId}`, { method: 'DELETE' });
      toast('Roster member removed.');
      await loadPortal({ quiet: true });
    } catch (error) {
      toast(error.message, true);
    }
  }));
  $$('.portal-transfer-captain').forEach(button => button.addEventListener('click', async () => {
    if (!confirm(`Transfer Captain control to ${button.dataset.memberName}? You will become a regular roster member.`)) return;
    try {
      await api(`/api/portal/teams/${button.dataset.teamId}/captain/transfer`, { method: 'POST', body: { memberId: Number(button.dataset.memberId) } });
      toast('Captain control transferred.');
      await loadPortal({ quiet: true });
    } catch (error) {
      toast(error.message, true);
    }
  }));
}

function myTeamForMatch(match) {
  return state.teams.find(team => team.id === match.team_a_id || team.id === match.team_b_id) || null;
}

function renderMatches() {
  const term = state.search.trim().toLowerCase();
  const sourceList = state.matchScope === 'all' && state.allMatches?.length ? state.allMatches : state.matches;
  const matches = sourceList.filter(match => !term || `${match.tournament_name} ${match.team_a_name} ${match.team_b_name} ${match.round_name}`.toLowerCase().includes(term));

  $('#portal-matches').innerHTML = matches.length ? matches.map(match => {
    const own = myTeamForMatch(match);
    const ownIsA = Number(match.team_a_id) === Number(own?.id);
    const opponent = ownIsA ? match.team_b_name : match.team_a_name;
    const isOwnMatch = Boolean(own);
    const side = (name, isOwnTeam, isReady) => `<span class="${isOwnTeam ? 'portal-own-team-side ' : ''}${isReady ? 'portal-team-ready-side' : ''}">${escapeHtml(name || 'TBD')}${isOwnTeam ? '<em>YOUR TEAM</em>' : ''}${isReady ? '<em>✓ CHECKED IN</em>' : ''}</span>`;

    return `<article class="portal-match-card ${isOwnMatch ? 'is-own-match' : ''}" data-match-id="${match.id}">
      <div class="ops-kicker">${escapeHtml(match.tournament_name)} · ${escapeHtml(match.round_name || match.stage)} ${!isOwnMatch ? '· <em style="color:var(--text-muted);font-style:normal">INSPECT LINEUPS</em>' : ''}</div>
      <div class="portal-versus">${side(match.team_a_name, ownIsA && isOwnMatch, Boolean(match.team_a_checked_in))}<b>VS</b>${side(match.team_b_name, !ownIsA && isOwnMatch, Boolean(match.team_b_checked_in))}</div>
      <div class="portal-match-meta">
        ${isOwnMatch ? `<span class="portal-own-team-label">✓ Your team: ${escapeHtml(own?.tag || '—')}</span><span>Opponent: ${escapeHtml(opponent || 'TBD')}</span>` : `<span>${escapeHtml(match.team_a_name || 'Team A')} vs ${escapeHtml(match.team_b_name || 'Team B')}</span>`}
        <span>BO${match.best_of}</span>
        <span>${escapeHtml(statusLabel(match.result_status))}</span>
      </div>
      <div class="portal-match-meta" style="margin-top:7px">
        <span>${escapeHtml(formatDate(match.effective_scheduled_at))}</span>
        <span>${match.draft_room_ready ? 'DRAFT ROOM READY' : 'WAITING FOR HOST'}</span>
        <a href="/public.html?slug=${encodeURIComponent(match.tournament_slug)}#bracket" target="_blank" rel="noopener" class="btn btn-ghost btn-xs" style="margin-left:auto" onclick="event.stopPropagation()">VIEW BRACKET ↗</a>
        ${match.stream_url ? '<span class="ops-live-badge">EXTERNAL STREAM ↗</span>' : ''}
      </div>
    </article>`;
  }).join('') : `<div class="portal-empty">${state.matchScope === 'all' ? 'No tournament matches found.' : 'No matches scheduled for your team yet.'}</div>`;

  $$('.portal-match-card').forEach(card => card.addEventListener('click', () => openMatch(Number(card.dataset.matchId))));
}

function closeMatch() {
  state.openMatchId = null;
  $('#portal-match-modal').classList.add('hidden');
  $('#portal-match-body').innerHTML = '';
}

async function openMatch(matchId) {
  const match = state.matches.find(item => item.id === matchId) || state.allMatches.find(item => item.id === matchId);
  if (!match) return;
  state.openMatchId = matchId;
  $('#portal-match-round').textContent = `${match.tournament_name} · ${match.round_name || match.stage}`;
  $('#portal-match-title').textContent = `${match.team_a_name || 'TBD'} vs ${match.team_b_name || 'TBD'}`;
  $('#portal-match-modal').classList.remove('hidden');
  $('#portal-match-body').innerHTML = '<div class="ops-empty" style="height:260px">Loading team operations…</div>';

  try {
    const [results, checkins, messages, games] = await Promise.all([
      api(`/api/matches/${matchId}/results`).catch(() => ({ submissions: [] })),
      api(`/api/matches/${matchId}/checkin`).catch(() => ({ checkins: [] })),
      api(`/api/matches/${matchId}/messages`).catch(() => ({ messages: [] })),
      api(`/api/matches/${matchId}/games`).catch(() => ({ games: [] }))
    ]);
    renderMatch(match, results, checkins.checkins || [], messages.messages || [], games);
  } catch (error) {
    $('#portal-match-body').innerHTML = `<div class="ops-empty" style="height:260px">${escapeHtml(error.message)}</div>`;
  }
}

function renderMatch(match, resultData, checkins, messages, gameData) {
  const own = myTeamForMatch(match);
  const ownIsA = Number(match.team_a_id) === Number(own?.id);
  const opponentName = ownIsA ? match.team_b_name : match.team_a_name;
  const opponentTag = ownIsA ? match.team_b_tag : match.team_a_tag;
  const ownMembers = ownIsA ? (match.team_a_members || own?.members || []) : (match.team_b_members || own?.members || []);
  const opponentMembers = ownIsA ? (match.team_b_members || []) : (match.team_a_members || []);

  const renderRosterList = list => list.length ? list.map(m => `
    <div class="portal-roster-member">
      <div>
        <b>${escapeHtml(m.display_name || m.displayName || 'Player')}</b>
        <span>${escapeHtml(m.gamer_tag || m.gamerTag || m.member_role || m.memberRole || 'Player')} · ${escapeHtml(statusLabel(m.member_role || m.memberRole || 'player'))}${m.is_captain || m.isCaptain ? ' · ★ Captain' : ''}</span>
      </div>
    </div>
  `).join('') : '<div class="ops-list-meta">No roster listed yet.</div>';

  // If viewing another tournament match that user is not part of:
  if (!own) {
    $('#portal-match-body').innerHTML = `
      <div class="ops-match-modal-grid portal-match-operations-grid">
        <section class="ops-match-settings">
          <div class="ops-fixed-start" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div><b>Start time: ${escapeHtml(formatDate(match.effective_scheduled_at))}</b><br><small>Tournament match lineup overview</small></div>
            <a href="/public.html?slug=${encodeURIComponent(match.tournament_slug)}#bracket" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">VIEW FULL BRACKET ↗</a>
          </div>
          <div class="ops-current-result">
            <b>${escapeHtml(match.tournament_name)} · ${escapeHtml(match.round_name || match.stage)}</b>
            <div>${escapeHtml(match.team_a_name || 'TBD')} ${match.score_a ?? 0} — ${match.score_b ?? 0} ${escapeHtml(match.team_b_name || 'TBD')}</div>
            <div class="ops-list-meta">Format: BO${match.best_of} · Status: ${escapeHtml(statusLabel(match.match_status))}</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:14px">
            <div class="portal-opponent-roster-box" style="padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px">
              <b>${escapeHtml(match.team_a_name || 'Team Blue')} ${match.team_a_tag ? `(${escapeHtml(match.team_a_tag)})` : ''}</b>
              <div class="portal-roster-list" style="margin-top:8px">${renderRosterList(match.team_a_members || [])}</div>
            </div>
            <div class="portal-opponent-roster-box" style="padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px">
              <b>${escapeHtml(match.team_b_name || 'Team Red')} ${match.team_b_tag ? `(${escapeHtml(match.team_b_tag)})` : ''}</b>
              <div class="portal-roster-list" style="margin-top:8px">${renderRosterList(match.team_b_members || [])}</div>
            </div>
          </div>
          ${match.stream_url ? `<div class="ops-toolbar" style="margin-top:14px"><button class="btn btn-primary btn-sm" id="spectate-open-stream">OPEN EXTERNAL STREAM ↗</button></div>` : ''}
        </section>
      </div>
    `;
    $('#spectate-open-stream')?.addEventListener('click', () => openExternal(match.stream_url));
    return;
  }

  const isCaptain = Boolean(own?.my_is_captain) || own?.my_member_role === 'captain';
  const isTeamA = Number(own?.id) === Number(match.team_a_id) && isCaptain;
  const isHost = state.user?.role === 'admin' || Boolean(state.user?.is_admin);
  const checkinOpen = ['checkin_open', 'ready'].includes(String(match.match_status || ''));
  const isChecked = checkins.some(item => item.actor_type === 'team' && Number(item.actor_id) === own?.id);
  const required = isCaptain && (resultData.requiredTeams || []).includes(own?.id);
  const hasGameFlow = Array.isArray(gameData.games) && gameData.games.length > 0;
  const workflow = hasGameFlow ? renderCaptainGameFlow(match, gameData, own, isCaptain) : renderResultActions(match, resultData, own, required, isCaptain);

  $('#portal-match-body').innerHTML = `
    <div class="portal-match-workflow">
      <div class="${isChecked ? 'done' : checkinOpen ? 'active' : 'waiting'}"><b>1</b><span>Captain check-in</span></div>
      <i></i>
      <div class="${match.draft_room_ready ? 'done' : 'waiting'}"><b>2</b><span>Captain opens Draft</span></div>
      <i></i>
      <div class="${gameData.draftComplete ? 'done' : 'waiting'}"><b>3</b><span>${escapeHtml(t('captainRunsDraft'))}</span></div>
      <i></i>
      <div class="${match.result_status === 'final' ? 'done' : gameData.draftComplete ? 'active' : 'waiting'}"><b>4</b><span>Captains verify result</span></div>
    </div>
    <div class="ops-match-modal-grid portal-match-operations-grid">
      <section class="ops-match-settings">
        <div class="ops-fixed-start" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div><b>Start time: ${escapeHtml(formatDate(match.effective_scheduled_at))}</b><br><small>Displayed in your browser's local timezone.</small></div>
          <a href="/public.html?slug=${encodeURIComponent(match.tournament_slug)}#bracket" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">VIEW FULL BRACKET ↗</a>
        </div>
        <div class="ops-current-result">
          <b>${escapeHtml(own?.name || 'Your team')}</b>
          <div>${escapeHtml(match.team_a_name || 'TBD')} ${match.score_a ?? 0} — ${match.score_b ?? 0} ${escapeHtml(match.team_b_name || 'TBD')}</div>
          <div class="ops-list-meta">${escapeHtml(t('portalRoleMatchBo', { role: statusLabel(own?.my_member_role || 'player'), status: statusLabel(match.match_status), bestOf: match.best_of }))}</div>
        </div>
        <div class="ops-toolbar">
          ${isCaptain?`<button class="btn ${isChecked ? 'btn-ghost' : checkinOpen ? 'btn-primary' : 'btn-ghost'} btn-sm" id="captain-checkin" ${checkinOpen ? '' : 'disabled'}>${isChecked ? '✓ CHECKED IN' : checkinOpen ? 'CHECK IN TEAM' : 'WAITING FOR HOST TO OPEN CHECK-IN'}</button><button class="btn ${match.draft_room_ready ? 'btn-primary' : 'btn-ghost'} btn-sm" id="captain-open-draft" ${match.draft_room_ready ? '' : 'disabled'}>${match.draft_room_ready ? 'OPEN & CONTROL MY TEAM DRAFT' : 'WAITING FOR HOST TO OPEN DRAFT'}</button>` : '<span class="portal-captain-badge">CAPTAIN-ONLY DRAFT CONTROL</span>'}
          ${match.stream_url ? '<button class="btn btn-ghost btn-sm" id="captain-open-stream">OPEN EXTERNAL STREAM ↗</button>' : ''}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:14px">
          <div class="portal-opponent-roster-box" style="padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px">
            <b>YOUR TEAM: ${escapeHtml(own?.name || 'Your team')} ${own?.tag ? `(${escapeHtml(own.tag)})` : ''}</b>
            <div class="portal-roster-list" style="margin-top:8px">${renderRosterList(ownMembers)}</div>
          </div>
          <div class="portal-opponent-roster-box" style="padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px">
            <b>OPPONENT: ${escapeHtml(opponentName || 'TBD')} ${opponentTag ? `(${escapeHtml(opponentTag)})` : ''}</b>
            <div class="portal-roster-list" style="margin-top:8px">${renderRosterList(opponentMembers)}</div>
          </div>
        </div>
        ${workflow}
      </section>

      <section class="ops-room-code-panel ops-section" style="margin-bottom:16px; background:var(--surface-sunken); border:1px solid var(--border-subtle); border-radius:var(--radius-md); padding:14px 18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h4 style="margin:0 0 4px; font-family:var(--font-display); letter-spacing:1px; color:var(--text-bright); font-size:0.95rem;">🎮 GAME ROOM CODE</h4>
            <div class="ops-list-meta" style="margin:0;">
              ${match.room_code ? '<span class="status-pill available" style="margin-right:6px;">✓ ROOM CODE SENT</span>' : '<span class="status-pill pending" style="margin-right:6px;">⏳ ROOM CODE PENDING</span>'}
              Rule: Upper team (<b>${escapeHtml(match.team_a_name)}</b>) creates the in-game room and sends the code to the opponent here.
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            ${match.room_code ? `
              <span class="room-code-display-tag" style="background:var(--surface-raised); border:1px solid var(--interactive-primary); padding:6px 14px; border-radius:4px; font-family:monospace; font-size:1.15rem; font-weight:bold; letter-spacing:2px; color:var(--interactive-primary);">${escapeHtml(match.room_code)}</span>
              <button type="button" class="btn btn-ghost btn-sm" id="btn-copy-portal-room-code" data-copy="${escapeHtml(match.room_code)}">📋 COPY ROOM CODE</button>
            ` : `
              <span class="ops-list-meta">${isTeamA ? 'Please create in-game room and enter the code below' : `Waiting for ${escapeHtml(match.team_a_name)} to send room code...`}</span>
            `}
          </div>
        </div>
        ${isTeamA || isHost ? `
          <form id="captain-room-code-main-form" class="ops-chat-compose" style="margin-top:12px; display:flex; gap:8px;">
            <input id="main-room-code-input" maxlength="80" placeholder="Enter in-game room code (e.g. 123456 / ABCXYZ)..." value="${escapeHtml(match.room_code || '')}" style="flex:1;">
            <button class="btn btn-primary btn-sm">${match.room_code ? 'UPDATE ROOM CODE' : 'SEND ROOM CODE TO OPPONENT'}</button>
          </form>
        ` : ''}
      </section>

      <section class="ops-match-chat-panel">
        <div class="ops-chat-header">
          <div><b>MATCH CHAT &amp; RESULT PROOF</b><small>Both Captains can chat here even when the Host is offline. One Captain can send the game-room code below; attach a screenshot as proof, then submit the result for the opposing Captain to approve.</small></div>
          <button class="btn btn-ghost btn-xs" id="captain-refresh-chat">↻</button>
        </div>
        ${isCaptain ? `<form class="ops-chat-compose" id="captain-room-code-form" style="margin-bottom:8px"><input id="captain-room-code" maxlength="80" placeholder="Create game-room code, e.g. ABC123"><button class="btn btn-ghost btn-sm">SEND ROOM CODE</button></form><div class="ops-list-meta" style="margin:-3px 0 9px">Either Captain creates this code and sends it to the opponent here. The Host is not required.</div>` : ''}
        <div class="ops-chat-messages" id="captain-chat"></div>
        <form class="ops-chat-compose" id="captain-chat-form">
          <input id="captain-chat-input" maxlength="1000" placeholder="Message Host or opponent…">
          <input id="captain-chat-file" type="file" accept="image/*,.pdf,.txt">
          <button class="btn btn-primary btn-sm">SEND</button>
        </form>
      </section>
    </div>
  `;

  $('#captain-checkin')?.addEventListener('click', async () => {
    try {
      await api(`/api/matches/${match.id}/checkin`, { method: 'POST', body: {} });
      toast('Team checked in.');
      await openMatch(match.id);
    } catch (error) {
      toast(error.message, true);
    }
  });

  $('#captain-open-draft')?.addEventListener('click', async () => {
    try {
      const payload = await api(`/api/matches/${match.id}/draft-room/access`);
      openExternal(payload.url);
    } catch (error) {
      toast(error.message, true);
    }
  });

  $('#captain-open-stream')?.addEventListener('click', () => openExternal(match.stream_url));
  if (hasGameFlow) bindCaptainGameFlow(match, gameData, own, isCaptain);
  else if (isCaptain) bindResultActions(match, resultData, own);
  $('#captain-refresh-chat')?.addEventListener('click', () => refreshChat(match.id));
  $('#captain-room-code-form')?.addEventListener('submit', event => sendGameRoomCode(event, match.id));
  $('#captain-room-code-main-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const code = $('#main-room-code-input')?.value.trim() || '';
    try {
      await api(`/api/matches/${match.id}/room-code`, { method: 'POST', body: { roomCode: code } });
      toast(code ? 'Room code sent to opponent.' : 'Room code removed.');
      await loadPortal({ quiet: true });
      await openMatch(match.id);
    } catch (error) {
      toast(error.message, true);
    }
  });
  $('#btn-copy-portal-room-code')?.addEventListener('click', () => {
    if (match.room_code) {
      navigator.clipboard.writeText(match.room_code);
      toast('Room code copied: ' + match.room_code);
    }
  });
  $('#captain-chat-form')?.addEventListener('submit', event => sendChat(event, match.id));
  messages.forEach(appendChat);
}

function renderCaptainGameFlow(match, gameData, own, isCaptain) {
  const games = Array.isArray(gameData.games) ? gameData.games : [];
  const current = Number(gameData.currentGameNumber || match.current_game_number || 1);
  const game = games.find(item => Number(item.game_number) === current) || games.at(-1) || {};
  const reportedWinner = Number(game.reported_winner_team_id) === Number(match.team_a_id) ? match.team_a_name : Number(game.reported_winner_team_id) === Number(match.team_b_id) ? match.team_b_name : '';
  const history = games.map(item => {
    const winner = Number(item.winner_team_id) === Number(match.team_a_id) ? match.team_a_name : Number(item.winner_team_id) === Number(match.team_b_id) ? match.team_b_name : Number(item.reported_winner_team_id) === Number(match.team_a_id) ? `${match.team_a_name} · pending` : Number(item.reported_winner_team_id) === Number(match.team_b_id) ? `${match.team_b_name} · pending` : '—';
    const label = item.status === 'completed' ? 'CONFIRMED' : item.result_status === 'disputed' ? 'DISPUTED' : item.result_status === 'awaiting_confirmation' ? 'WAITING CONFIRMATION' : item.status === 'draft_complete' ? 'READY TO REPORT' : 'DRAFT NOT FINISHED';
    
    // Enhanced display with win/loss indicators for each team
    const teamAWin = Number(item.winner_team_id) === Number(match.team_a_id) || Number(item.reported_winner_team_id) === Number(match.team_a_id);
    const teamBWin = Number(item.winner_team_id) === Number(match.team_b_id) || Number(item.reported_winner_team_id) === Number(match.team_b_id);
    const teamAResult = teamAWin ? '✓ WIN' : (teamBWin ? '✗ LOSS' : '—');
    const teamBResult = teamBWin ? '✓ WIN' : (teamAWin ? '✗ LOSS' : '—');
    
    return `<div class="portal-game-row">
      <span>GAME ${item.game_number}</span>
      <b>${escapeHtml(label)}</b>
      <div class="portal-game-teams">
        <span class="team-result ${teamAWin ? 'win' : teamBWin ? 'loss' : ''}">${escapeHtml(match.team_a_name)}: ${teamAResult}</span>
        <span class="team-result ${teamBWin ? 'win' : teamAWin ? 'loss' : ''}">${escapeHtml(match.team_b_name)}: ${teamBResult}</span>
      </div>
    </div>`;
  }).join('');

  if (match.result_status === 'final' || gameData.seriesComplete) return `<section class="ops-result-panel portal-game-flow"><h3>Series Complete</h3><div class="ops-result-warning">${escapeHtml(t('seriesCompleteVerifiedDesc'))}</div><div class="portal-result-summary"><strong>${escapeHtml(match.team_a_name)} ${gameData.scoreA} — ${gameData.scoreB} ${escapeHtml(match.team_b_name)}</strong></div><div class="portal-game-history">${history}</div></section>`;
  if (!isCaptain) return `<section class="ops-result-panel portal-game-flow"><h3>Game ${current} Result</h3><div class="ops-list-meta">Only the linked Captains can report or confirm a game winner. Players may follow the status here and use Match Chat.</div><div class="portal-game-history">${history}</div></section>`;

  let action = '';
  if (game.result_status === 'disputed') action = `<div class="ops-dispute">Game ${current} is disputed. The next Draft is paused until staff resolve it.</div><form id="captain-evidence-form" class="ops-toolbar"><input id="captain-evidence-file" type="file" accept="image/*,.pdf,.txt" required><button class="btn btn-primary btn-sm">UPLOAD EVIDENCE</button></form>`;
  else if (game.result_status === 'awaiting_confirmation' && Number(game.reported_by_team_id) === Number(own?.id)) action = `<div class="ops-result-warning">You reported <b>${escapeHtml(reportedWinner)}</b> as the Game ${current} winner. Waiting for the opposing Captain.</div>`;
  else if (game.result_status === 'awaiting_confirmation') action = `<div class="ops-result-warning">The opposing Captain submitted <b>${escapeHtml(reportedWinner)}</b> as the Game ${current} winner.</div><div class="portal-result-actions"><button class="btn btn-primary btn-sm" id="captain-confirm-game">APPROVE GAME ${current} RESULT</button><button class="btn btn-danger btn-sm" id="captain-reject-game">✕ BÁO SAI / VOTE LẠI</button></div>`;
  else if (gameData.draftComplete) action = `<div class="ops-result-warning">${escapeHtml(t('reportGameAfterPlaying', { game: current }))}</div><div class="portal-game-winner-buttons"><button class="btn btn-primary" data-game-winner-side="A">SUBMIT: ${escapeHtml(match.team_a_name)} WON GAME ${current}</button><button class="btn btn-primary" data-game-winner-side="B">SUBMIT: ${escapeHtml(match.team_b_name)} WON GAME ${current}</button></div>`;
  else action = `<div class="ops-list-meta">${escapeHtml(t('finishDraftBeforeReport', { game: current }))}</div>`;

  return `<section class="ops-result-panel portal-game-flow"><div class="ops-panel-header ops-section-header"><div><h3>Game-by-Game Result</h3><div class="ops-list-meta">${escapeHtml(t('gameByGameFlowShort'))}</div></div><span class="ops-result-lock">GAME ${current}</span></div><div class="portal-series-score"><span>${escapeHtml(match.team_a_name)} <b>${gameData.scoreA || 0}</b></span><strong>FIRST TO ${gameData.winsNeeded || Math.floor(match.best_of / 2) + 1}</strong><span><b>${gameData.scoreB || 0}</b> ${escapeHtml(match.team_b_name)}</span></div>${action}<div class="portal-game-history">${history}</div></section>`;
}

function bindCaptainGameFlow(match, gameData, own, isCaptain) {
  if (!isCaptain) return;
  $$('[data-game-winner-side]').forEach(button => button.addEventListener('click', async () => {
    const side = button.dataset.gameWinnerSide;
    const teamName = side === 'A' ? match.team_a_name : match.team_b_name;
    if (!confirm(t('reportGameWinnerConfirm', { team: teamName, game: gameData.currentGameNumber }))) return;
    try {
      const payload = await api(`/api/matches/${match.id}/games/current/report`, { method: 'POST', body: { winnerSide: side } });
      if (payload.autoConfirmed) {
        toast(payload.final ? 'Series finalized.' : t('openingNextGameDraft', { game: payload.currentGameNumber }));
        if (payload.nextDraftUrl) {
          window.location.assign(payload.nextDraftUrl);
          return;
        }
      } else {
        toast('Game result reported. Waiting for the opposing Captain.');
      }
      await loadPortal({ quiet: true });
      await openMatch(match.id);
    } catch (error) {
      toast(error.message, true);
    }
  }));

  $('#captain-confirm-game')?.addEventListener('click', async () => {
    try {
      const payload = await api(`/api/matches/${match.id}/games/current/confirm`, { method: 'POST', body: { decision: 'confirm' } });
      toast(payload.final ? 'Series finalized.' : t('openingNextGameDraft', { game: payload.currentGameNumber }));
      if (payload.nextDraftUrl) {
        window.location.assign(payload.nextDraftUrl);
        return;
      }
      await loadPortal({ quiet: true });
      await openMatch(match.id);
    } catch (error) {
      toast(error.message, true);
    }
  });

  $('#captain-reject-game')?.addEventListener('click', async () => {
    if (!confirm('Reject this result and allow both teams to re-vote?')) return;
    try {
      await api(`/api/matches/${match.id}/games/current/confirm`, { method: 'POST', body: { decision: 'reject', comment: 'Báo sai kết quả, yêu cầu vote lại' } });
      toast('Result rejected. Both teams may submit again.');
      await loadPortal({ quiet: true });
      await openMatch(match.id);
    } catch (error) {
      toast(error.message, true);
    }
  });

  $('#captain-evidence-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const file = $('#captain-evidence-file').files[0];
    if (!file) return;
    try {
      await api(`/api/matches/${match.id}/files`, {
        method: 'POST',
        body: {
          purpose: 'evidence',
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          dataBase64: await readFileBase64(file)
        }
      });
      toast('Evidence uploaded for staff review.');
      $('#captain-evidence-file').value = '';
    } catch (error) {
      toast(error.message, true);
    }
  });
}

function renderResultActions(match, data, own, required, isCaptain = true) {
  const current = data.currentSubmission;
  if (!isCaptain) return `<div class="ops-result-panel"><h3>Captain-only Operations</h3><div class="ops-list-meta">${escapeHtml(t('memberViewOnlyMatchHelp'))}</div></div>`;
  if (match.result_status === 'final') {
    const winner = Number(match.winner_team_id) === Number(match.team_a_id) ? match.team_a_name : match.team_b_name;
    return `<div class="ops-result-panel"><h3>Final Result</h3><div class="portal-result-summary"><span class="ops-result-lock">VERIFIED & ADVANCED</span><br><strong>${escapeHtml(winner || 'Winner')}</strong><br>${escapeHtml(match.team_a_name)} <b>${match.score_a}</b> — <b>${match.score_b}</b> ${escapeHtml(match.team_b_name)}<br><span class="ops-list-meta">Only the Host or Head Referee can undo this result within the correction window and before the next match starts.</span></div></div>`;
  }
  if (['disputed', 'under_review', 'recommended'].includes(match.result_status)) {
    return `<div class="ops-result-panel"><h3>Result Dispute</h3><div class="ops-dispute">The reports did not match or a Captain rejected the score. Upload evidence and continue the discussion in Match Chat while staff review it.</div><form id="captain-evidence-form" class="ops-toolbar" style="margin-top:10px"><input id="captain-evidence-file" type="file" accept="image/*,.pdf,.txt" required><button class="btn btn-primary btn-sm">UPLOAD EVIDENCE</button></form></div>`;
  }
  const submittedBy = current?.submitted_by_team_id === match.team_a_id ? match.team_a_name : current?.submitted_by_team_id === match.team_b_id ? match.team_b_name : current?.source_type;
  return `<div class="ops-result-panel"><h3>Submit & Approve Result</h3><div class="ops-result-warning">Team A or Team B submits the score. The opposing Captain approves it. Only then is the winner advanced.</div>${current ? `<div class="portal-result-summary">Proposed: <b>${escapeHtml(match.team_a_name)} ${current.score_a} — ${current.score_b} ${escapeHtml(match.team_b_name)}</b><br><span class="ops-list-meta">Submitted by ${escapeHtml(submittedBy || 'unknown')}. ${required ? 'Your approval is required.' : 'Waiting for the other Captain to approve.'}</span></div>` : '<div class="ops-list-meta">No result has been submitted yet.</div>'}${required ? `<div class="portal-result-actions"><button class="btn btn-primary btn-sm" id="captain-confirm-result">APPROVE RESULT</button><button class="btn btn-danger btn-sm" id="captain-reject-result">${escapeHtml(t('rejectOpenDispute'))}</button></div>` : ''}<form id="captain-submit-result" class="ops-result-form"><label>${escapeHtml(match.team_a_name || 'Team A')} score<input id="captain-score-a" type="number" min="0" value="${current?.score_a ?? 0}" required></label><label>${escapeHtml(match.team_b_name || 'Team B')} score<input id="captain-score-b" type="number" min="0" value="${current?.score_b ?? 0}" required></label><label class="ops-span-2">Note<input id="captain-result-note" placeholder="Optional note"></label><button class="btn btn-primary btn-sm ops-span-2">SUBMIT RESULT</button></form></div>`;
}

function bindResultActions(match, data, own) {
  $('#captain-submit-result')?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await api(`/api/matches/${match.id}/results/submit`, {
        method: 'POST',
        body: { scoreA: Number($('#captain-score-a').value), scoreB: Number($('#captain-score-b').value), note: $('#captain-result-note').value, sourceType: 'team', teamId: own.id }
      });
      toast('Result submitted.');
      await loadPortal({ quiet: true });
      await openMatch(match.id);
    } catch (error) {
      toast(error.message, true);
    }
  });

  $('#captain-confirm-result')?.addEventListener('click', async () => {
    try {
      await api(`/api/matches/${match.id}/results/confirm`, { method: 'POST', body: { decision: 'confirm' } });
      toast('Result confirmed.');
      await loadPortal({ quiet: true });
      await openMatch(match.id);
    } catch (error) {
      toast(error.message, true);
    }
  });

  $('#captain-reject-result')?.addEventListener('click', async () => {
    const comment = prompt('Why is this result incorrect?');
    if (!comment) return;
    try {
      await api(`/api/matches/${match.id}/results/confirm`, { method: 'POST', body: { decision: 'reject', comment } });
      toast('Dispute opened.');
      await loadPortal({ quiet: true });
      await openMatch(match.id);
    } catch (error) {
      toast(error.message, true);
    }
  });

  $('#captain-evidence-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const file = $('#captain-evidence-file').files[0];
    if (!file) return;
    try {
      await api(`/api/matches/${match.id}/files`, {
        method: 'POST',
        body: {
          purpose: 'evidence',
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          dataBase64: await readFileBase64(file)
        }
      });
      toast('Evidence uploaded for staff review.');
      $('#captain-evidence-file').value = '';
    } catch (error) {
      toast(error.message, true);
    }
  });
}

async function refreshChat(matchId) {
  try {
    const payload = await api(`/api/matches/${matchId}/messages`);
    const container = $('#captain-chat');
    if (container) {
      container.innerHTML = '';
      payload.messages.forEach(appendChat);
    }
  } catch (error) {
    toast(error.message, true);
  }
}

function appendChat(message) {
  const container = $('#captain-chat');
  if (!container || container.querySelector(`[data-message-id="${message.id}"]`)) return;
  const item = document.createElement('div');
  item.className = `ops-chat-message ${message.message_type === 'system' ? 'system' : ''} ${message.pinned ? 'pinned' : ''}`;
  item.dataset.messageId = message.id;
  item.innerHTML = `<div class="ops-chat-message-head"><b>${escapeHtml(message.sender_name || message.sender_role || 'Unknown')}</b><span>${formatDate(message.created_at)}${message.edited_at ? ' · edited' : ''}</span></div><div>${escapeHtml(message.deleted_at ? '[deleted]' : message.message || '')}</div>${chatAttachmentHtml(message)}`;
  container.appendChild(item);
  item.querySelector('.ops-file-link')?.addEventListener('click', event => downloadFile(Number(event.currentTarget.dataset.fileId), event.currentTarget.dataset.fileName));
  container.scrollTop = container.scrollHeight;
}

async function sendChat(event, matchId) {
  event.preventDefault();
  const input = $('#captain-chat-input'), fileInput = $('#captain-chat-file');
  try {
    let fileId = null;
    const file = fileInput.files[0];
    if (file) {
      const uploaded = await api(`/api/matches/${matchId}/files`, {
        method: 'POST',
        body: {
          purpose: 'chat_attachment',
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          dataBase64: await readFileBase64(file)
        }
      });
      fileId = uploaded.file.id;
    }
    const message = input.value.trim();
    if (!message && !fileId) return;
    await api(`/api/matches/${matchId}/messages`, { method: 'POST', body: { message, fileId } });
    input.value = '';
    fileInput.value = '';
    await refreshChat(matchId);
  } catch (error) {
    toast(error.message, true);
  }
}

async function sendGameRoomCode(event, matchId) {
  event.preventDefault();
  const input = $('#captain-room-code');
  const code = input?.value.trim();
  if (!code) return toast('Enter the game-room code first.', true);
  try {
    await api(`/api/matches/${matchId}/messages`, { method: 'POST', body: { message: `GAME ROOM CODE: ${code} — created by Captain. Opponent, please join this room.` } });
    input.value = '';
    toast('Game-room code sent to Match Chat.');
    await refreshChat(matchId);
  } catch (error) {
    toast(error.message, true);
  }
}

function bindGlobalErrorBoundary() {
  if (window.__gekishinErrorBoundaryBound) return;
  window.__gekishinErrorBoundaryBound = true;
  window.addEventListener('unhandledrejection', event => {
    event.preventDefault();
    const message = event.reason?.message || 'An unexpected operation failed.';
    console.error(event.reason);
    toast(message, true);
  });
  window.addEventListener('error', event => {
    if (!event.error) return;
    console.error(event.error);
    toast(event.error.message || 'An unexpected interface error occurred.', true);
  });
}

bindGlobalErrorBoundary();
bootstrap();

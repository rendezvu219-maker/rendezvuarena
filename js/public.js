import { canonicalDiscordInvite, renderPublicEventDescription } from './public-event-content.js';
import { t } from './i18n.js';

const $=selector=>document.querySelector(selector);
const $$=selector=>document.querySelectorAll(selector);
const state={payload:null,search:'',zoom:1,openMatchId:null};

function escapeHtml(value){return String(value??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function label(value){return String(value||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());}
function formatDate(value){if(!value)return 'Start time not announced';const date=new Date(value);return Number.isNaN(date.getTime())?String(value):date.toLocaleString();}

async function load(){
  const slug=new URLSearchParams(location.search).get('slug');
  if(!slug)return fail('Missing tournament slug.');
  try{
    const response=await fetch(`/api/public/tournaments/${encodeURIComponent(slug)}`);
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||`Request failed (${response.status})`);
    state.payload=payload;
    render();
  }catch(error){fail(error.message);}
}

function fail(message){
  $('#public-loading').classList.add('hidden');
  $('#public-content').classList.add('hidden');
  $('#public-error').textContent=message;
  $('#public-error').classList.remove('hidden');
}

function render(){
  const {tournament}=state.payload;
  document.title=`${tournament.name} — Public Bracket`;
  $('#public-loading').classList.add('hidden');
  $('#public-content').classList.remove('hidden');
  $('#public-name').textContent=tournament.name;
  $('#public-status').textContent=label(tournament.status);
  $('#public-description').innerHTML=renderPublicEventDescription(tournament.description);
  $('#public-time').textContent=`Tournament start: ${formatDate(tournament.start_at)} · ${tournament.timezone}`;
  $('#public-source').innerHTML=tournament.source_url?`<a class="ops-live-badge" href="${escapeHtml(tournament.source_url)}" target="_blank" rel="noopener noreferrer">SOURCE: ${escapeHtml((tournament.source_platform||'external').toUpperCase())} ↗</a>`:'';
  const joinable=!['completed','finalized','archived','cancelled'].includes(String(tournament.status||'').toLowerCase());
  $('#public-stream').innerHTML=`${joinable?`<a class="btn btn-primary" href="/join-tournament.html?slug=${encodeURIComponent(tournament.slug)}">JOIN / LINK ACCOUNT</a>`:''}${tournament.public_stream_url?`<a class="btn btn-ghost" style="margin-left:8px" href="${escapeHtml(tournament.public_stream_url)}" target="_blank" rel="noopener noreferrer">OPEN ${escapeHtml(tournament.public_stream_platform||'STREAM')} ↗</a><div class="ops-list-meta" style="margin-top:8px">The stream opens directly on the external platform.</div>`:'<div class="ops-list-meta" style="margin-top:8px">No external stream link is active.</div>'}`;
  
  renderGroups();
  renderTeams();
  renderBracket();
  
  $('#public-search').addEventListener('input',event=>{state.search=event.target.value.toLowerCase();renderBracket();});
  $('#public-fit').addEventListener('click',()=>{state.zoom=.8;renderBracket();});
  $('#public-fullscreen').addEventListener('click',()=>$('#public-bracket-viewport').requestFullscreen());
  $('#public-close-modal')?.addEventListener('click',closePublicMatch);
}

function renderGroups(){
  const groups=state.payload.groupStandings||[];
  const container=$('#public-groups');
  if(!groups.length){container.innerHTML='';return;}
  container.innerHTML=`<div class="ops-section"><div class="ops-section-header"><div><h3>Group Standings</h3><div class="ops-list-meta">Standings update after results become Final.</div></div></div><div class="ops-group-grid">${groups.map(group=>`<article class="ops-group-panel"><h3>GROUP ${escapeHtml(group.group)}</h3><div class="ops-standing-table">${group.standings.map(row=>`<div class="ops-standing-row ${row.rank<=2?'qualifying':''}"><b>${row.rank}</b><span>${escapeHtml(row.tag||row.name)}</span><span>${row.wins}-${row.losses}</span><span>${row.gameDiff>=0?'+':''}${row.gameDiff}</span><span>${row.overrideActive?'OVERRIDE':''}</span></div>`).join('')}</div></article>`).join('')}</div></div>`;
}

function renderTeams(){
  const teams=state.payload.teams||[];
  const container=$('#public-teams');
  if(!container||!teams.length){if(container)container.innerHTML='';return;}
  container.innerHTML=`<div class="ops-section"><div class="ops-section-header"><div><h3>Tournament Teams &amp; Rosters</h3><div class="ops-list-meta">All confirmed participating teams and player rosters.</div></div></div><div class="ops-stat-grid">${teams.map(team=>`<article class="ops-stat portal-team-card"><div class="portal-team-heading"><div><div class="ops-stat-value">${escapeHtml(team.tag||'TEAM')}</div><div class="ops-stat-label">${escapeHtml(team.name)}</div></div><span class="portal-captain-badge">SEED #${team.seed||'—'}</span></div><div class="portal-roster-list">${(team.members||[]).map(m=>`<div class="portal-roster-member"><div><b>${escapeHtml(m.display_name||m.displayName||'Player')}</b><span>${escapeHtml(m.gamer_tag||m.gamerTag||m.member_role||m.memberRole||'Player')} · ${escapeHtml(label(m.member_role||m.memberRole||'player'))}${m.is_captain||m.isCaptain?' · ★ Captain':''}</span></div></div>`).join('')||'<div class="ops-list-meta">No roster members listed yet.</div>'}</div></article>`).join('')}</div></div>`;
}

function publicMatchCard(match){
  const hay=`${match.teamA?.name||''} ${match.teamA?.tag||''} ${match.teamB?.name||''} ${match.teamB?.tag||''}`.toLowerCase();
  const hidden=state.search&&!hay.includes(state.search);
  if(hidden)return '';
  const teamAName=match.teamA?.name?`${escapeHtml(match.teamA.name)}${match.teamA.tag?` <small>(${escapeHtml(match.teamA.tag)})</small>`:''}`:(match.teamA?.tag||'TBD');
  const teamBName=match.teamB?.name?`${escapeHtml(match.teamB.name)}${match.teamB.tag?` <small>(${escapeHtml(match.teamB.tag)})</small>`:''}`:(match.teamB?.tag||'TBD');
  return `<article class="ops-match-card ${match.resultStatus==='final'?'final':''}" data-public-match-id="${match.id}" style="cursor:pointer"><div class="ops-match-id">#${match.position} · ${escapeHtml(label(match.matchStatus))} <span style="float:right;font-size:10px;opacity:.7">INSPECT ↗</span></div><div class="ops-match-team ${match.winnerTeamId===match.teamA?.id?'winner':''}"><span>${teamAName}</span><b>${match.scoreA??'—'}</b></div><div class="ops-match-team ${match.winnerTeamId===match.teamB?.id?'winner':''}"><span>${teamBName}</span><b>${match.scoreB??'—'}</b></div><div class="ops-match-footer"><span>BO${match.bestOf} · ${escapeHtml(label(match.resultStatus))}</span><span>${escapeHtml(formatDate(match.effectiveScheduledAt))}</span>${match.streamUrl?`<a class="ops-live-badge" href="${escapeHtml(match.streamUrl)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">STREAM ↗</a>`:''}</div>${match.publicNotes?`<div class="ops-list-meta" style="margin-top:7px">${escapeHtml(match.publicNotes)}</div>`:''}</article>`;
}

function renderBracket(){
  const matches=(state.payload.matches||[]).filter(match=>match.stage!=='group');
  const rounds=[...new Set(matches.map(match=>match.roundNo))].sort((a,b)=>a-b);
  $('#public-bracket').style.transform=`scale(${state.zoom})`;
  $('#public-bracket').innerHTML=rounds.length?rounds.map(round=>{
    const rows=matches.filter(match=>match.roundNo===round);
    return `<section class="ops-round"><div class="ops-round-header"><div class="ops-round-title">${escapeHtml(rows[0]?.roundName||`Round ${round}`)}</div></div><div class="ops-round-matches">${rows.map(publicMatchCard).join('')||'<div class="ops-list-meta">No matching teams.</div>'}</div></section>`;
  }).join(''):'<div class="portal-empty">The bracket has not been generated yet.</div>';

  $$('[data-public-match-id]').forEach(card=>{
    card.addEventListener('click',()=>openPublicMatch(Number(card.dataset.publicMatchId)));
  });
}

function openPublicMatch(matchId){
  const match=(state.payload.matches||[]).find(m=>m.id===matchId);
  if(!match)return;
  state.openMatchId=matchId;
  $('#public-modal-round').textContent=`${match.roundName||'Playoffs'} · Match #${match.position}`;
  $('#public-modal-title').textContent=`${match.teamA?.name||'TBD'} vs ${match.teamB?.name||'TBD'}`;
  
  const teamAMembers=match.teamAMembers||[];
  const teamBMembers=match.teamBMembers||[];
  
  const renderRoster=members=>(members.length?members.map(m=>`<div class="portal-roster-member"><div><b>${escapeHtml(m.display_name||m.displayName||'Player')}</b><span>${escapeHtml(m.gamer_tag||m.gamerTag||m.member_role||m.memberRole||'Player')} · ${escapeHtml(label(m.member_role||m.memberRole||'player'))}${m.is_captain||m.isCaptain?' · ★ Captain':''}</span></div></div>`).join(''):'<div class="ops-list-meta">No roster listed yet.</div>');
  
  $('#public-modal-body').innerHTML=`
    <div class="ops-match-settings">
      <div class="ops-current-result">
        <b>Match Score</b>
        <div>${escapeHtml(match.teamA?.name||'TBD')} <b>${match.scoreA??0}</b> — <b>${match.scoreB??0}</b> ${escapeHtml(match.teamB?.name||'TBD')}</div>
        <div class="ops-list-meta">Format: BO${match.bestOf} · Status: ${escapeHtml(label(match.matchStatus))} · Result: ${escapeHtml(label(match.resultStatus))}</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:16px">
        <div class="portal-opponent-roster-box" style="padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px">
          <b>${escapeHtml(match.teamA?.name||'Team Blue')} ${match.teamA?.tag?`(${escapeHtml(match.teamA.tag)})`:''}</b>
          <div class="portal-roster-list" style="margin-top:8px">${renderRoster(teamAMembers)}</div>
        </div>
        <div class="portal-opponent-roster-box" style="padding:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px">
          <b>${escapeHtml(match.teamB?.name||'Team Red')} ${match.teamB?.tag?`(${escapeHtml(match.teamB.tag)})`:''}</b>
          <div class="portal-roster-list" style="margin-top:8px">${renderRoster(teamBMembers)}</div>
        </div>
      </div>
    </div>
  `;
  $('#public-match-modal').classList.remove('hidden');
}

function closePublicMatch(){
  state.openMatchId=null;
  $('#public-match-modal').classList.add('hidden');
  $('#public-modal-body').innerHTML='';
}

function renderDedicatedDiscordInvite(){
  const container=$('#public-discord');
  if(!container)return;
  const invite=canonicalDiscordInvite(state.payload?.tournament?.discord_url);
  container.innerHTML=invite?`<a class="btn btn-discord" href="${escapeHtml(invite)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(t('joinDiscordServer'))}</a>`:'';
}

load().then(renderDedicatedDiscordInvite);

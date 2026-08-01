import { api, escapeHtml } from './api.js';
import { t } from './i18n.js';

const root=document.querySelector('#profile-public-view');
function formatDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?'':date.toLocaleDateString();}
function providerLabel(value){return value==='startgg'?'start.gg':value==='tonamel'?'Tonamel':'Challonge';}
function providerMark(value){return value==='startgg'?'S':value==='tonamel'?'T':'C';}
function profileIdentifier(item){
  if(item.gamerTag||item.displayName)return item.gamerTag||item.displayName;
  try{
    const parts=new URL(item.profileUrl).pathname.split('/').filter(Boolean);
    return decodeURIComponent(parts.at(-1)||item.profileUrl);
  }catch{return item.profileUrl||'';}
}
function profileInitials(profile){
  const source=String(profile.gamerTag||profile.displayName||profile.username||'GS').trim();
  const words=source.split(/\s+/).filter(Boolean);
  return (words.length>1?`${words[0][0]}${words.at(-1)[0]}`:source.slice(0,2)).toUpperCase();
}
async function load(){
  const username=new URLSearchParams(location.search).get('user')||'';
  if(!username){root.innerHTML=`<div class="ops-empty" style="height:280px">${escapeHtml(t('profileUsernameMissing'))}</div>`;return;}
  try{
    const {profile}=await api(`/api/profiles/${encodeURIComponent(username)}`);
    document.title=`${profile.displayName} — RendezVu Arena`;
    const links=(profile.externalProfiles||[]).map(item=>{
      const verified=item.verificationStatus==='verified';
      return `<a class="profile-provider-link profile-provider-link--${escapeHtml(item.provider)}" href="${escapeHtml(item.profileUrl)}" target="_blank" rel="noopener noreferrer"><span class="profile-provider-icon">${escapeHtml(providerMark(item.provider))}</span><span class="profile-provider-copy"><b>${escapeHtml(providerLabel(item.provider))}</b><small>${escapeHtml(profileIdentifier(item))}</small></span><em class="${verified?'is-verified':'is-review'}">${verified?escapeHtml(t('profileStatusVerified')):escapeHtml(t('profileStatusNeedsReview'))}</em><strong aria-hidden="true">↗</strong></a>`;
    }).join('');
    root.innerHTML=`<div class="profile-public-heading"><div class="profile-public-identity"><span class="profile-public-avatar">${escapeHtml(profileInitials(profile))}</span><div><div class="ops-kicker">@${escapeHtml(profile.username)}</div><h2>${escapeHtml(profile.displayName)}</h2>${profile.gamerTag?`<p>${escapeHtml(profile.gamerTag)}</p>`:''}</div></div><span>${escapeHtml(t('memberSince'))} ${escapeHtml(formatDate(profile.createdAt))}</span></div><div class="profile-public-content"><section class="profile-public-panel profile-public-about"><h3>${escapeHtml(t('bio'))}</h3><div class="profile-public-bio">${profile.bio?escapeHtml(profile.bio):escapeHtml(t('profileNoBio'))}</div></section><section class="profile-public-panel profile-public-links"><h3>${escapeHtml(t('linkedTournamentProfiles'))}</h3><div class="profile-provider-grid">${links||`<div class="ops-list-meta">${escapeHtml(t('noPublicTournamentProfiles'))}</div>`}</div></section></div>`;
  }catch(error){root.innerHTML=`<div class="ops-empty" style="height:280px">${escapeHtml(error.status===403?t('privateProfileMessage'):error.message)}</div>`;}
}
load();

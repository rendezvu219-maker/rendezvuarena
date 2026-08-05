const DISCORD_HOSTS = new Set(['discord.gg', 'discord.com', 'discordapp.com']);
const DESCRIPTION_HEADINGS = [
  'Start Time',
  'End Time',
  'How to Enter',
  'Tournament Rules',
  'Day of Event Procedures',
  'DC Procedure',
  'Late Policy',
  'TO Staff List',
];

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char]));
}

function normalizeDescription(value = '') {
  const headingPattern = DESCRIPTION_HEADINGS.map(heading => heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(new RegExp(`\\s+(?=(?:${headingPattern})\\s*:)`, 'gi'), '\n')
    .replace(/\s+-\s+(?=[A-Z0-9])/g, '\n- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function canonicalDiscordInvite(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (url.protocol !== 'https:' || !DISCORD_HOSTS.has(host) || url.username || url.password || url.port) return '';
    const parts = url.pathname.split('/').filter(Boolean);
    const code = host === 'discord.gg'
      ? (parts.length === 1 ? parts[0] : '')
      : (parts.length === 2 && parts[0].toLowerCase() === 'invite' ? parts[1] : '');
    if (!/^[A-Za-z0-9_-]{2,64}$/.test(code || '')) return '';
    return `https://discord.gg/${code}`;
  } catch {
    return '';
  }
}

export function discordInviteFromText(value = '') {
  const candidates = String(value || '').match(/(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/[^\s<>"']+/gi) || [];
  for (const candidate of candidates) {
    const safeInvite = canonicalDiscordInvite(candidate.replace(/[),.;!?]+$/g, ''));
    if (safeInvite) return safeInvite;
  }
  return '';
}

export function linkifyDiscordInvitesOnly(value = '') {
  const text = String(value ?? '');
  const urlPattern = /(?:https?:\/\/|(?:www\.)?(?:discord\.gg|discord(?:app)?\.com)\/)[^\s<>"']+/gi;
  let html = '';
  let cursor = 0;
  for (const match of text.matchAll(urlPattern)) {
    const index = match.index ?? 0;
    html += escapeHtml(text.slice(cursor, index));
    let displayed = match[0];
    let trailing = '';
    while (/[),.;!?]$/.test(displayed)) {
      trailing = displayed.slice(-1) + trailing;
      displayed = displayed.slice(0, -1);
    }
    const safeInvite = canonicalDiscordInvite(displayed);
    html += safeInvite
      ? `<a class="public-discord-invite" href="${escapeHtml(safeInvite)}" target="_blank" rel="noopener noreferrer nofollow">Join Discord server ↗</a>`
      : escapeHtml(displayed);
    html += escapeHtml(trailing);
    cursor = index + match[0].length;
  }
  return html + escapeHtml(text.slice(cursor));
}

export function eventCardSummary(value = '', maxLength = 180) {
  const normalized = normalizeDescription(value);
  if (!normalized) return 'Public tournament information and bracket updates.';
  const firstBlock = normalized.split(/\n(?=(?:-\s|[A-Za-z][^\n]{0,40}:))/)[0]
    .replace(/(?:https?:\/\/|www\.)\S+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (firstBlock.length <= maxLength) return firstBlock;
  const clipped = firstBlock.slice(0, Math.max(1, maxLength - 1));
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, lastSpace > maxLength * 0.6 ? lastSpace : clipped.length).trim()}…`;
}

export function renderPublicEventDescription(value = '') {
  const normalized = normalizeDescription(value);
  if (!normalized) return '<p>Full event information has not been provided yet.</p>';
  const headingPattern = new RegExp(`^(${DESCRIPTION_HEADINGS.join('|')}):\\s*(.*)$`, 'i');
  const lines = normalized.split(/\n+/).map(line => line.trim()).filter(Boolean);
  const output = ['<div class="public-event-description">'];
  let sectionOpen = false;
  let listOpen = false;
  const closeList = () => { if (listOpen) { output.push('</ul>'); listOpen = false; } };
  const closeSection = () => { if (sectionOpen) { output.push('</section>'); sectionOpen = false; } };

  for (const line of lines) {
    const heading = line.match(headingPattern);
    if (heading) {
      closeList();
      closeSection();
      output.push(`<section><h3>${escapeHtml(heading[1])}</h3>`);
      sectionOpen = true;
      if (heading[2]) output.push(`<p>${linkifyDiscordInvitesOnly(heading[2])}</p>`);
      continue;
    }
    if (/^-\s+/.test(line)) {
      if (!listOpen) { output.push('<ul>'); listOpen = true; }
      output.push(`<li>${linkifyDiscordInvitesOnly(line.replace(/^-\s+/, ''))}</li>`);
      continue;
    }
    closeList();
    output.push(`<p>${linkifyDiscordInvitesOnly(line)}</p>`);
  }
  closeList();
  closeSection();
  output.push('</div>');
  return output.join('');
}

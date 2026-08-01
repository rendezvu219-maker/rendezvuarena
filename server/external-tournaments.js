const dns = require('node:dns').promises;
const net = require('node:net');
const { importTournament, extractTournamentSlug } = require('./startgg');

const PLATFORM_LABELS = {
  startgg: 'start.gg',
  tonamel: 'Tonamel',
  challonge: 'Challonge',
};

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code) || 32))
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromIdentifier(value = '') {
  return decodeURIComponent(String(value))
    .replace(/[_.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, letter => letter.toUpperCase()) || 'Imported Tournament';
}

function detectTournamentPlatform(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || '').trim());
  } catch {
    return { valid: false, error: 'Please enter a valid tournament URL.' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { valid: false, error: 'Only HTTP and HTTPS tournament links are supported.' };
  }

  parsed.protocol = 'https:';
  parsed.hash = '';
  parsed.search = '';
  parsed.pathname = parsed.pathname.replace(/\/{2,}/g, '/').replace(/\/$/, '') || '/';

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const pathParts = parsed.pathname.split('/').filter(Boolean);

  if (hostname === 'start.gg' && pathParts[0]?.toLowerCase() === 'tournament' && pathParts[1]) {
    const externalId = pathParts[1];
    return {
      valid: true,
      platform: 'startgg',
      platformLabel: PLATFORM_LABELS.startgg,
      externalId,
      normalizedUrl: `https://www.start.gg/tournament/${encodeURIComponent(externalId)}`,
      fallbackName: titleFromIdentifier(externalId),
    };
  }

  if (hostname === 'tonamel.com' && pathParts[0]?.toLowerCase() === 'competition' && pathParts[1]) {
    const externalId = pathParts[1];
    return {
      valid: true,
      platform: 'tonamel',
      platformLabel: PLATFORM_LABELS.tonamel,
      externalId,
      normalizedUrl: `https://tonamel.com/competition/${encodeURIComponent(externalId)}`,
      fallbackName: `Tonamel Tournament ${externalId}`,
    };
  }

  if ((hostname === 'challonge.com' || hostname.endsWith('.challonge.com')) && pathParts.length) {
    const pathId = pathParts.join('/');
    const externalId = `${hostname}/${pathId}`;
    return {
      valid: true,
      platform: 'challonge',
      platformLabel: PLATFORM_LABELS.challonge,
      externalId,
      normalizedUrl: `https://${hostname}/${pathParts.map(encodeURIComponent).join('/')}`,
      fallbackName: titleFromIdentifier(pathParts[pathParts.length - 1]),
    };
  }

  return {
    valid: false,
    error: 'Use a public tournament link from start.gg, Tonamel or Challonge.',
  };
}

function readMeta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return '';
}

function isPrivateAddress(address) {
  const value = String(address || '').toLowerCase().replace(/^::ffff:/, '');
  if (!value) return true;
  if (net.isIPv4(value)) {
    const parts = value.split('.').map(Number);
    return parts[0] === 0 || parts[0] === 10 || parts[0] === 127
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
      || parts[0] >= 224;
  }
  if (net.isIPv6(value)) {
    return value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd')
      || /^fe[89ab]/.test(value) || value.startsWith('ff');
  }
  return true;
}

async function assertPublicNetworkTarget(rawUrl) {
  const target = new URL(rawUrl);
  if (target.protocol !== 'https:') throw new Error('Only HTTPS metadata targets are allowed.');
  if (/^(localhost|localhost\.)$/i.test(target.hostname)) throw new Error('Internal addresses are not allowed.');
  if (net.isIP(target.hostname)) {
    if (isPrivateAddress(target.hostname)) throw new Error('Internal addresses are not allowed.');
    return;
  }
  const resolved = await dns.lookup(target.hostname, { all: true, verbatim: true });
  if (!resolved.length || resolved.some(item => isPrivateAddress(item.address))) {
    throw new Error('The tournament hostname resolves to an internal or invalid address.');
  }
}

async function fetchPublicMetadata(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; GekishinSquadraTournamentImporter/0.6.21)',
    Accept: 'text/html,application/xhtml+xml',
    'Accept-Language': 'en-US,en;q=0.8',
  };
  try {
    let currentUrl = url;
    const MAX_REDIRECTS = 3;
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      const currentTarget = detectTournamentPlatform(currentUrl);
      if (!currentTarget.valid) throw new Error('The metadata target uses an unsupported domain.');
      currentUrl = currentTarget.normalizedUrl;
      // Validate DNS before every hop to reduce private-network and DNS-rebinding exposure.
      await assertPublicNetworkTarget(currentUrl);
      const response = await fetch(currentUrl, {
        redirect: 'manual',
        signal: controller.signal,
        headers,
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirectCount >= MAX_REDIRECTS) throw new Error('Too many redirects.');
        const location = response.headers.get('location');
        if (!location) throw new Error('Redirect without Location header.');
        const redirectTarget = new URL(location, currentUrl);
        const detectedRedirect = detectTournamentPlatform(redirectTarget.href);
        if (!detectedRedirect.valid) throw new Error('Redirect to unsupported domain.');
        currentUrl = detectedRedirect.normalizedUrl;
        await response.body?.cancel().catch(() => {});
        continue;
      }
      if (!response.ok) throw new Error(`Public page returned HTTP ${response.status}.`);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('text/html')) throw new Error('The public page did not return HTML metadata.');
      const html = (await response.text()).slice(0, 800_000);
      const titleTag = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
      return {
        title: readMeta(html, 'og:title') || readMeta(html, 'twitter:title') || titleTag,
        description: readMeta(html, 'og:description') || readMeta(html, 'description') || '',
        image: readMeta(html, 'og:image') || '',
        fetched: true,
      };
    }
    throw new Error('Too many redirects.');
  } finally {
    clearTimeout(timer);
  }
}

function cleanExternalTitle(title, platformLabel) {
  let value = String(title || '').trim();
  if (!value) return '';
  const suffixes = [
    /\s*\|\s*start\.gg.*$/i,
    /\s*[-|]\s*Challonge.*$/i,
    /\s*[-|]\s*Tonamel.*$/i,
  ];
  suffixes.forEach(pattern => { value = value.replace(pattern, '').trim(); });
  if (value.toLowerCase() === platformLabel.toLowerCase()) return '';
  return value.slice(0, 160);
}

async function previewExternalTournament(rawUrl) {
  const detected = detectTournamentPlatform(rawUrl);
  if (!detected.valid) throw new Error(detected.error);

  const warnings = [];
  let name = detected.fallbackName;
  let description = '';
  let startAt = null;
  let remoteMetadata = {};
  let syncStatus = 'linked';

  if (detected.platform === 'startgg' && process.env.STARTGG_API_TOKEN) {
    try {
      const imported = await importTournament(detected.normalizedUrl);
      name = imported.name || name;
      startAt = imported.startAt ? new Date(Number(imported.startAt) * 1000).toISOString() : null;
      description = [imported.city, imported.countryCode].filter(Boolean).join(', ');
      remoteMetadata = {
        providerTournamentId: imported.id ? String(imported.id) : '',
        providerSlug: imported.slug || extractTournamentSlug(detected.normalizedUrl),
        eventCount: Array.isArray(imported.events) ? imported.events.length : 0,
        entrantCount: Array.isArray(imported.events)
          ? imported.events.reduce((total, event) => total + Number(event.numEntrants || 0), 0)
          : 0,
      };
      syncStatus = 'api_verified';
    } catch (error) {
      warnings.push(`start.gg API metadata was unavailable: ${error.message}`);
    }
  }

  if (syncStatus !== 'api_verified') {
    try {
      const page = await fetchPublicMetadata(detected.normalizedUrl);
      const remoteTitle = cleanExternalTitle(page.title, detected.platformLabel);
      if (remoteTitle) name = remoteTitle;
      if (page.description) description = page.description.slice(0, 500);
      remoteMetadata = { ...remoteMetadata, pageImage: page.image || '', pageMetadataFetched: true };
      syncStatus = 'public_page_verified';
    } catch (error) {
      warnings.push('The URL format is valid, but automatic page metadata could not be read. You can still import it and edit the tournament name afterward.');
      remoteMetadata = { ...remoteMetadata, pageMetadataFetched: false, metadataError: error.message };
      syncStatus = 'url_verified';
    }
  }

  return {
    platform: detected.platform,
    platformLabel: detected.platformLabel,
    sourceUrl: detected.normalizedUrl,
    externalId: detected.externalId,
    name: String(name || detected.fallbackName).slice(0, 160),
    description: String(description || '').slice(0, 1000),
    startAt,
    syncStatus,
    warnings,
    metadata: remoteMetadata,
  };
}

module.exports = {
  PLATFORM_LABELS,
  detectTournamentPlatform,
  isPrivateAddress,
  assertPublicNetworkTarget,
  previewExternalTournament,
};

const crypto = require('node:crypto');
const { db, transaction, jsonParse } = require('./db');
const { isSafeExternalUrl } = require('./security');

const STARTGG_AUTHORIZE_URL = 'https://start.gg/oauth/authorize';
const STARTGG_TOKEN_URL = 'https://api.start.gg/oauth/access_token';
const STARTGG_GQL_URL = 'https://api.start.gg/gql/alpha';
const STARTGG_SCOPES = 'user.identity';
const CHALLONGE_AUTHORIZE_URL = 'https://api.challonge.com/oauth/authorize';
const CHALLONGE_TOKEN_URL = 'https://api.challonge.com/oauth/token';
const CHALLONGE_ME_URL = 'https://api.challonge.com/v2.1/me.json';
const CHALLONGE_SCOPES = 'me';
const SUPPORTED_PROVIDERS = new Set(['startgg', 'tonamel', 'challonge']);

function oauthSecret(provider = 'startgg') {
  const envName = provider === 'challonge' ? 'CHALLONGE_TOKEN_ENCRYPTION_KEY' : 'STARTGG_TOKEN_ENCRYPTION_KEY';
  const value = String(process.env[envName] || process.env.AUTH_SECRET || '');
  if (value.length < 32) throw new Error(`${envName} or AUTH_SECRET must contain at least 32 characters.`);
  return crypto.createHash('sha256').update(value).digest();
}
function stateHash(value) {
  return crypto.createHmac('sha256', String(process.env.AUTH_SECRET || '')).update(String(value || '')).digest('hex');
}
function encryptSecret(value, provider = 'startgg') {
  if (!value) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', oauthSecret(provider), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
}
function decryptSecret(value, provider = 'startgg') {
  if (!value) return '';
  const [ivText, tagText, dataText] = String(value).split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', oauthSecret(provider), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64url')), decipher.final()]).toString('utf8');
}
function safeReturnPath(returnTo = '/portal.html') {
  const value = String(returnTo || '/portal.html');
  return value.startsWith('/') && !value.startsWith('//') ? value : '/portal.html';
}
function callbackUri(provider, origin = '') {
  const prefix = provider === 'challonge' ? 'CHALLONGE' : 'STARTGG';
  const explicit = String(process.env[`${prefix}_REDIRECT_URI`] || '').trim();
  if (explicit) return explicit;
  const base = String(origin || process.env.APP_ORIGIN || '').split(',')[0].trim();
  if (!base) throw new Error(`${prefix}_REDIRECT_URI or APP_ORIGIN is required.`);
  return new URL(`/api/connections/${provider}/callback`, base).toString();
}
function providerCredentials(provider) {
  const prefix = provider === 'challonge' ? 'CHALLONGE' : 'STARTGG';
  const clientId = String(process.env[`${prefix}_CLIENT_ID`] || '').trim();
  const clientSecret = String(process.env[`${prefix}_CLIENT_SECRET`] || '').trim();
  if (!clientId || !clientSecret) throw new Error(`${provider} OAuth is not configured.`);
  return { clientId, clientSecret };
}
function providerOAuthConfiguration(provider, origin = '') {
  return { ...providerCredentials(provider), redirectUri: callbackUri(provider, origin) };
}
function providerCapabilities(origin = '') {
  return {
    startgg: { oauth: false, manual: true, ownershipVerifiedByOAuth: false },
    tonamel: { oauth: false, manual: true, ownershipVerifiedByOAuth: false },
    challonge: { oauth: false, manual: true, ownershipVerifiedByOAuth: false },
  };
}
function publicProfile(row) {
  return {
    id: row.id,
    provider: row.provider,
    providerUserId: row.provider_user_id,
    providerSlug: row.provider_slug,
    profileUrl: row.profile_url,
    displayName: row.display_name,
    gamerTag: row.gamer_tag,
    verificationStatus: row.verification_status,
    verifiedAt: row.verified_at,
    metadata: jsonParse(row.metadata_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function listExternalProfiles(userId) {
  return db.prepare(`SELECT * FROM external_profiles WHERE user_id=? ORDER BY provider`).all(userId).map(publicProfile);
}
function profileForProvider(userId, provider) {
  const row = db.prepare('SELECT * FROM external_profiles WHERE user_id=? AND provider=?').get(userId, provider);
  return row ? publicProfile(row) : null;
}
function normalizeManualProfile(provider, profileUrl, displayName = '') {
  const normalizedProvider = String(provider || '').trim().toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(normalizedProvider)) throw new Error('Choose start.gg, Tonamel or Challonge.');
  if (!isSafeExternalUrl(profileUrl, { allowEmpty: false })) throw new Error('Enter a valid HTTPS profile URL.');
  const url = new URL(profileUrl);
  const allowedHost = normalizedProvider === 'startgg' ? /(^|\.)start\.gg$/i
    : normalizedProvider === 'tonamel' ? /(^|\.)tonamel\.com$/i
      : /(^|\.)challonge\.com$/i;
  if (!allowedHost.test(url.hostname)) throw new Error(`The URL must be a ${normalizedProvider} profile URL.`);

  const pathParts = url.pathname.split('/').filter(Boolean);
  let providerSlug = '';
  if (normalizedProvider === 'startgg' && ['user', 'profile'].includes(pathParts[0]?.toLowerCase())) providerSlug = pathParts[1] || '';
  if (normalizedProvider === 'challonge' && pathParts[0]?.toLowerCase() === 'users') providerSlug = pathParts[1] || '';
  if (normalizedProvider === 'tonamel' && ['player', 'u'].includes(pathParts[0]?.toLowerCase())) providerSlug = pathParts[1] || '';
  providerSlug = decodeURIComponent(providerSlug).trim().slice(0, 120);

  const suppliedName = String(displayName || '').trim().slice(0, 100);
  const inferredName = providerSlug.slice(0, 100);
  return {
    provider: normalizedProvider,
    profileUrl: url.toString(),
    providerSlug,
    displayName: suppliedName || inferredName,
    gamerTag: suppliedName || inferredName,
  };
}
function saveManualProfile(userId, input) {
  const profile = normalizeManualProfile(input.provider, input.profileUrl, input.displayName);
  db.prepare(`INSERT INTO external_profiles(user_id,provider,provider_slug,profile_url,display_name,gamer_tag,verification_status,metadata_json)
    VALUES (?,?,?,?,?,?,'unverified','{}')
    ON CONFLICT(user_id,provider) DO UPDATE SET profile_url=excluded.profile_url,display_name=excluded.display_name,
      provider_user_id='',provider_slug=excluded.provider_slug,gamer_tag=excluded.gamer_tag,verification_status='unverified',verified_at=NULL,
      access_token_encrypted='',refresh_token_encrypted='',token_expires_at=NULL,metadata_json='{}',updated_at=CURRENT_TIMESTAMP`)
    .run(userId, profile.provider, profile.providerSlug, profile.profileUrl, profile.displayName, profile.gamerTag);
  return profileForProvider(userId, profile.provider);
}
function deleteExternalProfile(userId, provider) {
  const normalized = String(provider || '').toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(normalized)) throw new Error('Unsupported external provider.');
  return Number(db.prepare('DELETE FROM external_profiles WHERE user_id=? AND provider=?').run(userId, normalized).changes || 0);
}
function createOAuthState(userId, provider, redirectUri, returnTo) {
  const rawState = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const table = provider === 'startgg' ? 'oauth_states' : 'provider_oauth_states';
  db.prepare(`INSERT INTO ${table}(user_id,provider,state_hash,redirect_uri,return_to,expires_at)
    VALUES (?,?,?,?,?,?)`).run(userId, provider, stateHash(rawState), redirectUri, safeReturnPath(returnTo), expiresAt);
  return { rawState, expiresAt };
}
function consumeOAuthState(provider, rawState) {
  const table = provider === 'startgg' ? 'oauth_states' : 'provider_oauth_states';
  const row = db.prepare(`SELECT * FROM ${table} WHERE provider=? AND state_hash=? AND used_at IS NULL LIMIT 1`)
    .get(provider, stateHash(rawState));
  if (!row || Date.parse(row.expires_at) <= Date.now()) throw new Error(`The ${provider} connection request is invalid or expired.`);
  db.prepare(`UPDATE ${table} SET used_at=CURRENT_TIMESTAMP WHERE id=?`).run(row.id);
  return row;
}
function createStartggAuthorization(userId, { origin = '', returnTo = '/portal.html' } = {}) {
  const { clientId, redirectUri } = providerOAuthConfiguration('startgg', origin);
  const state = createOAuthState(userId, 'startgg', redirectUri, returnTo);
  const url = new URL(STARTGG_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', STARTGG_SCOPES);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state.rawState);
  return { authorizationUrl: url.toString(), expiresAt: state.expiresAt };
}
function createChallongeAuthorization(userId, { origin = '', returnTo = '/portal.html' } = {}) {
  const { clientId, redirectUri } = providerOAuthConfiguration('challonge', origin);
  const state = createOAuthState(userId, 'challonge', redirectUri, returnTo);
  const url = new URL(CHALLONGE_AUTHORIZE_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('scope', CHALLONGE_SCOPES);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state.rawState);
  return { authorizationUrl: url.toString(), expiresAt: state.expiresAt };
}
async function startggRequestToken(code, redirectUri) {
  const { clientId, clientSecret } = providerCredentials('startgg');
  const response = await fetch(STARTGG_TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'authorization_code', client_id: clientId, client_secret: clientSecret, code, scope: STARTGG_SCOPES, redirect_uri: redirectUri }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || `start.gg token exchange failed (${response.status}).`);
  return payload;
}
async function startggCurrentUser(accessToken) {
  const response = await fetch(STARTGG_GQL_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ query: `query ConnectedUser { currentUser { id slug name player { gamerTag } } }` }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length || !payload.data?.currentUser) throw new Error(payload.errors?.map(item => item.message).join('; ') || 'Unable to read the connected start.gg profile.');
  return payload.data.currentUser;
}
async function challongeRequestToken(code, redirectUri) {
  const { clientId, clientSecret } = providerCredentials('challonge');
  const form = new URLSearchParams({
    grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri,
  });
  const response = await fetch(CHALLONGE_TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || `Challonge token exchange failed (${response.status}).`);
  return payload;
}
async function challongeCurrentUser(accessToken) {
  const response = await fetch(CHALLONGE_ME_URL, {
    headers: { Accept: 'application/json', 'Authorization-Type': 'v2', Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.data?.id || !payload.data?.attributes?.username) throw new Error(payload.errors?.[0]?.detail || 'Unable to read the connected Challonge profile.');
  return payload.data;
}
function saveVerifiedOAuthProfile({ userId, provider, providerUserId, providerSlug, profileUrl, displayName, gamerTag = '', token, scopes, metadata = {} }) {
  const expiresAt = token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null;
  transaction(() => {
    const conflict = db.prepare(`SELECT id,user_id FROM external_profiles WHERE provider=? AND provider_user_id=? AND user_id!=?`).get(provider, providerUserId, userId);
    if (conflict) throw new Error(`This ${provider} profile is already connected to another website account.`);
    db.prepare(`INSERT INTO external_profiles(
      user_id,provider,provider_user_id,provider_slug,profile_url,display_name,gamer_tag,verification_status,verified_at,
      access_token_encrypted,refresh_token_encrypted,token_expires_at,metadata_json
    ) VALUES (?,?,?,?,?,?,?,'verified',CURRENT_TIMESTAMP,?,?,?,?)
    ON CONFLICT(user_id,provider) DO UPDATE SET provider_user_id=excluded.provider_user_id,provider_slug=excluded.provider_slug,
      profile_url=excluded.profile_url,display_name=excluded.display_name,gamer_tag=excluded.gamer_tag,
      verification_status='verified',verified_at=CURRENT_TIMESTAMP,access_token_encrypted=excluded.access_token_encrypted,
      refresh_token_encrypted=excluded.refresh_token_encrypted,token_expires_at=excluded.token_expires_at,
      metadata_json=excluded.metadata_json,updated_at=CURRENT_TIMESTAMP`)
      .run(userId, provider, providerUserId, providerSlug, profileUrl, displayName, gamerTag,
        encryptSecret(token.access_token, provider), encryptSecret(token.refresh_token || '', provider), expiresAt,
        JSON.stringify({ tokenType: token.token_type || 'Bearer', scopes, ...metadata }));
  });
  return profileForProvider(userId, provider);
}
async function completeStartggAuthorization({ state, code }) {
  if (!state || !code) throw new Error('Missing start.gg OAuth state or authorization code.');
  const row = consumeOAuthState('startgg', state);
  const token = await startggRequestToken(code, row.redirect_uri);
  const currentUser = await startggCurrentUser(token.access_token);
  const providerUserId = String(currentUser.id || '');
  const providerSlug = String(currentUser.slug || '').replace(/^user\//, '');
  if (!providerUserId || !providerSlug) throw new Error('The connected start.gg account has no public user identity.');
  const profile = saveVerifiedOAuthProfile({
    userId: row.user_id, provider: 'startgg', providerUserId, providerSlug,
    profileUrl: `https://www.start.gg/user/${encodeURIComponent(providerSlug)}`,
    displayName: String(currentUser.name || currentUser.player?.gamerTag || providerSlug).slice(0, 100),
    gamerTag: String(currentUser.player?.gamerTag || '').slice(0, 80), token, scopes: STARTGG_SCOPES,
  });
  return { userId: row.user_id, returnTo: row.return_to || '/portal.html', profile };
}
async function completeChallongeAuthorization({ state, code }) {
  if (!state || !code) throw new Error('Missing Challonge OAuth state or authorization code.');
  const row = consumeOAuthState('challonge', state);
  const token = await challongeRequestToken(code, row.redirect_uri);
  const currentUser = await challongeCurrentUser(token.access_token);
  const username = String(currentUser.attributes.username || '').trim();
  const profile = saveVerifiedOAuthProfile({
    userId: row.user_id, provider: 'challonge', providerUserId: String(currentUser.id), providerSlug: username,
    profileUrl: `https://challonge.com/users/${encodeURIComponent(username)}`,
    displayName: username, gamerTag: username, token, scopes: CHALLONGE_SCOPES,
    metadata: { imageUrl: String(currentUser.attributes.image_url || '') },
  });
  return { userId: row.user_id, returnTo: row.return_to || '/portal.html', profile };
}
function providerRequirement(tournament) {
  const provider = String(tournament?.source_platform || '').toLowerCase();
  if (!SUPPORTED_PROVIDERS.has(provider)) return { provider: '', required: false, verifiedRequired: false };
  // Public test accounts use pasted profile links. Tournament Hosts still review ownership.
  return { provider, required: true, verifiedRequired: false };
}
function tournamentEligibility(userId, tournament) {
  const requirement = providerRequirement(tournament);
  const profile = requirement.provider ? profileForProvider(userId, requirement.provider) : null;
  const providerConnected = Boolean(profile);
  const providerVerified = Boolean(profile && (!requirement.verifiedRequired || profile.verificationStatus === 'verified'));
  let matchingMembers = [];
  if (requirement.provider && profile) {
    matchingMembers = db.prepare(`SELECT tm.id,tm.team_id,tm.display_name,tm.gamer_tag FROM team_members tm
      JOIN teams t ON t.id=tm.team_id
      WHERE t.tournament_id=? AND tm.user_id IS NULL AND (
        (tm.external_provider=? AND tm.external_user_id!='' AND tm.external_user_id=?) OR
        (tm.external_provider=? AND tm.external_profile_slug!='' AND tm.external_profile_slug=? COLLATE NOCASE)
      ) ORDER BY tm.id`).all(tournament.id, requirement.provider, String(profile.providerUserId || ''), requirement.provider, String(profile.providerSlug || ''));
  }
  const emailVerified = true;
  const eligible = !requirement.required || providerVerified;
  return {
    eligible,
    requirements: {
      emailVerified,
      requiredProvider: requirement.provider || null,
      providerConnected,
      providerVerified,
      entrantMatched: requirement.provider ? matchingMembers.length > 0 : null,
    },
    profile,
    matchingMembers,
    nextAction: requirement.required && !providerConnected ? `connect_${requirement.provider}`
      : requirement.verifiedRequired && !providerVerified ? `verify_${requirement.provider}`
      : 'continue',
  };
}
function profileSnapshot(profile) {
  if (!profile) return null;
  return {
    provider: profile.provider, providerUserId: profile.providerUserId, providerSlug: profile.providerSlug,
    profileUrl: profile.profileUrl, displayName: profile.displayName, gamerTag: profile.gamerTag,
    verificationStatus: profile.verificationStatus, verifiedAt: profile.verifiedAt, capturedAt: new Date().toISOString(),
  };
}

module.exports = {
  completeChallongeAuthorization,
  completeStartggAuthorization,
  createChallongeAuthorization,
  createStartggAuthorization,
  decryptSecret,
  deleteExternalProfile,
  listExternalProfiles,
  normalizeManualProfile,
  profileForProvider,
  profileSnapshot,
  providerCapabilities,
  providerRequirement,
  saveManualProfile,
  tournamentEligibility,
};

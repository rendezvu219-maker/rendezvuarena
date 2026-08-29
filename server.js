require('dotenv').config();

const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const http = require('node:http');
const express = require('express');
const helmet = require('helmet');
const { Server } = require('socket.io');
const { version: appVersion } = require('./package.json');

const { db, transaction, jsonParse, dbPath } = require('./server/db');
const {
  accessTokenFromRequest, authRequired, allowRoles, burnPasswordCost, clearSessionCookies,
  createSession, developmentTokenResponse, emailVerifiedRequired, hashPassword, needsPasswordRehash, refreshTokenFromRequest,
  revokeAllUserSessions, revokeSessionByRequest, revokeUserSession, rotateSession, setSessionCookies, verifyPassword,
  authenticateAccessToken, listUserSessions,
} = require('./server/auth');
const {
  permissionsForUser, hasTournamentPermission, requireTournamentPermission,
  canAccessMatch, requireMatchAccess,
} = require('./server/permissions');
const {
  generateSingleElimination, generateGroupStage, generatePlayoffsFromGroups, calculateGroupStandings,
  listMatches, preflightTournament, randomizeUnlockedTeams, saveSeedingSnapshot, restoreLatestSeeding,
  listBracketSnapshots, restoreBracketSnapshot, processTeamTerminalState, applyFinalResultUnsafe,
} = require('./server/bracket-service');
const {
  submitResult, confirmResult, reviewDispute, recommendDispute, verifyDispute,
  reopenResult, correctFinalResult, requestResultReconfirmation, getResultContext,
} = require('./server/result-service');
const { saveFile, fileRecord, filePath, refreshTournamentRetention, cleanupExpiredFiles } = require('./server/file-service');
const { importTournament, extractTournamentSlug } = require('./server/startgg');
const { previewExternalTournament } = require('./server/external-tournaments');
const {
  seedDivineCardAssets, publicBundle: publicDivineCardBundle, adminBundle: adminDivineCardBundle,
  updateCard: updateDivineCard, createCard: createDivineCard, savePreset: saveDivineCardPreset,
  deletePreset: deleteDivineCardPreset, assignPreset: assignDivineCardPreset,
} = require('./server/divine-card-service');
const { seedRecommendedHeroBuilds } = require('./server/divine-card-recommendations');
const {
  consumeDevAccessCode, createTestSuite, listTestSuites, cleanupTestSuite,
  seedMock32Players, autoCheckinOtherTeams, cleanupMockData, create32PlayerTournament,
} = require('./server/dev-test-service');
const { userTournamentHistory } = require('./server/profile-service');
const {
  publicAccountSettings, publicUserProfile, updateProfileSettings,
} = require('./server/account-settings-service');
const {
  completeChallongeAuthorization, completeStartggAuthorization, createChallongeAuthorization, createStartggAuthorization,
  deleteExternalProfile, listExternalProfiles, profileForProvider, profileSnapshot, providerCapabilities,
  providerRequirement, saveManualProfile, tournamentEligibility,
} = require('./server/external-profile-service');
const { requestLocale } = require('./server/i18n-locale');
const { consumeDraftSocketTicket, issueDraftSocketTicket, purgeExpiredDraftTickets } = require('./server/draft-auth');
const {
  SlidingWindowLimiter, anonymize, clientIp, corsMiddleware, httpsEnforcement, isProduction,
  isSafeExternalUrl, originAllowed, rateLimitMiddleware, rejectRateLimited, sanitizeText, securityLog,
  socketEventLimiter, validateEnvironment,
} = require('./server/security');

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT || 3000);
const root = __dirname;
const securityConfig = validateEnvironment(port);
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);

const io = new Server(server, {
  // Leave headroom above the validated Draft state payload to avoid transport-overhead disconnects.
  maxHttpBufferSize: 128 * 1024,
  allowRequest(req, callback) {
    const origin = req.headers.origin;
    const allowed = originAllowed(origin, securityConfig.allowedOrigins);
    if (!allowed) securityLog('socket.origin_denied', { origin: String(origin || '') });
    callback(null, allowed);
  },
  cors: {
    credentials: true,
    origin(origin, callback) {
      if (originAllowed(origin, securityConfig.allowedOrigins)) return callback(null, true);
      securityLog('socket.cors_denied', { origin: String(origin || '') });
      return callback(new Error('Origin is not allowed.'));
    },
  },
});

app.use(httpsEnforcement);
app.use(corsMiddleware(securityConfig.allowedOrigins));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", ...securityConfig.allowedOrigins.map(origin => origin.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:'))],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  // HSTS is production-only so localhost development remains usable over HTTP.
  strictTransportSecurity: isProduction ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
}));
app.use(express.json({ limit: '5mb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

const RAW_INPUT_KEYS = new Set(['password','passwordConfirmation','currentPassword','newPassword','dataBase64','accessToken','draftTicket','token','code']);
function sanitizeRequestValue(value,key='',depth=0){
  if(depth>12)return null;
  if(typeof value==='string'){
    if(RAW_INPUT_KEYS.has(key))return value;
    return sanitizeText(value,10_000).replace(/[<>]/g,'');
  }
  if(Array.isArray(value))return value.slice(0,500).map(item=>sanitizeRequestValue(item,key,depth+1));
  if(value&&typeof value==='object'){
    const cleaned={};
    for(const [childKey,childValue] of Object.entries(value).slice(0,500))cleaned[childKey]=sanitizeRequestValue(childValue,childKey,depth+1);
    return cleaned;
  }
  return value;
}
app.use('/api',(req,_res,next)=>{
  if(req.body&&typeof req.body==='object')req.body=sanitizeRequestValue(req.body);
  next();
});

for(const paramName of ['id','matchId','teamId','userId','memberId','requestId','messageId','fileId','suiteId','sessionId','snapshotId']){
  app.param(paramName,(req,res,next,value)=>{
    if(!/^\d+$/.test(String(value))||Number(value)<=0)return res.status(400).json({error:`Invalid ${paramName}.`});
    next();
  });
}

const apiLimiter = new SlidingWindowLimiter({
  windowMs: 60 * 1000,
  max: Number(process.env.API_RATE_LIMIT_PER_MINUTE || 10_000),
  name: 'api-global',
});
const loginFailureLimiter = new SlidingWindowLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.LOGIN_FAILURE_LIMIT || (process.env.NODE_ENV === 'production' ? 5 : 10_000)),
  name: 'auth-login-failures',
});
const registerLimiter = new SlidingWindowLimiter({
  windowMs: 60 * 60 * 1000,
  max: Number(process.env.REGISTER_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 5 : 10_000)),
  name: 'auth-register',
});
app.use('/api', rateLimitMiddleware(apiLimiter));
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
    res.on('finish', () => securityLog('api.mutation', {
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode,
      userId: req.user?.id || null,
      ipHash: anonymize(clientIp(req)),
    }, res.statusCode >= 500 ? 'error' : 'info'));
  }
  next();
});

// CSRF: state-changing API requests must carry a non-simple custom header.
// Browsers cannot add this header cross-origin unless the origin passes our strict CORS allowlist.
const CSRF_EXEMPT_PATHS = new Set(['/api/auth/refresh']);
function csrfExempt(req) {
  const pathname = String(req.originalUrl || '').split('?')[0];
  return CSRF_EXEMPT_PATHS.has(pathname)
    || /^\/api\/public\/draft-rooms\/[^/]+\/access$/.test(pathname);
}
app.use('/api', (req, res, next) => {
  if (['GET','HEAD','OPTIONS'].includes(req.method) || csrfExempt(req)) return next();
  const csrf = req.headers['x-csrf-token'] || req.headers['x-requested-with'];
  if (csrf) return next();
  securityLog('csrf.missing_header', {
    method: req.method,
    path: req.path,
    ipHash: anonymize(clientIp(req)),
  });
  return res.status(403).json({ error: 'Missing CSRF token header.' });
});

const staticOptions = {
  setHeaders(res) {
    // Force no-cache for all environments to ensure updates are applied immediately
    // This is especially important for Railway deployment to avoid proxy cache issues
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  },
};
for (const folder of ['css', 'js', 'divine', 'trailers', 'assets']) {
  app.use(`/${folder}`, express.static(path.join(root, folder), staticOptions));
}
const htmlCacheHeaders = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
};

app.get('/', htmlCacheHeaders, (_req, res) => res.sendFile(path.join(root, 'index.html')));
app.get('/index.html', htmlCacheHeaders, (_req, res) => res.sendFile(path.join(root, 'index.html')));
app.get('/quick-draft.html', htmlCacheHeaders, (_req, res) => res.sendFile(path.join(root, 'quick-draft.html')));
app.get('/heroes.html', htmlCacheHeaders, (_req, res) => res.sendFile(path.join(root, 'heroes.html')));
app.get('/hero.html', htmlCacheHeaders, (_req, res) => res.sendFile(path.join(root, 'heroes.html')));
app.get('/draft-room.html', htmlCacheHeaders, (_req, res) => res.sendFile(path.join(root, 'draft-room.html')));
app.get('/broadcast.html', htmlCacheHeaders, (_req, res) => res.sendFile(path.join(root, 'broadcast.html')));
app.get('/auth.html', htmlCacheHeaders, (_req, res) => res.sendFile(path.join(root, 'auth.html')));
app.get('/host-apply.html', htmlCacheHeaders, (_req, res) => res.sendFile(path.join(root, 'host-apply.html')));
app.get('/dashboard.html', htmlCacheHeaders, (_req, res) => res.sendFile(path.join(root, 'dashboard.html')));
app.get('/portal.html', htmlCacheHeaders, (_req, res) => res.sendFile(path.join(root, 'portal.html')));
app.get('/profile.html', htmlCacheHeaders, (_req, res) => res.sendFile(path.join(root, 'profile.html')));
app.get('/public.html', htmlCacheHeaders, (_req, res) => res.sendFile(path.join(root, 'public.html')));
app.get('/join-tournament.html', htmlCacheHeaders, (_req, res) => res.sendFile(path.join(root, 'join-tournament.html')));
for (const [route, file] of [
  ['/copyright', 'copyright.html'], ['/copyright.html', 'copyright.html'],
  ['/privacy', 'privacy.html'], ['/privacy.html', 'privacy.html'],
  ['/terms', 'terms.html'], ['/terms.html', 'terms.html'],
  ['/support-development', 'support-development.html'], ['/support-development.html', 'support-development.html'],
]) app.get(route, htmlCacheHeaders, (_req, res) => res.sendFile(path.join(root, file)));
app.get('/dev-access.html', htmlCacheHeaders, (_req, res) => {
  if (isProduction && process.env.ENABLE_DEV_TEST_CONSOLE !== 'true') return res.status(404).send('Not found.');
  return res.sendFile(path.join(root, 'dev-access.html'));
});

async function ensureBootstrapAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  const username = String(process.env.ADMIN_USERNAME || 'admin').trim();
  if (!email || !password) return;
  const existing = db.prepare('SELECT id,role FROM users WHERE email=? COLLATE NOCASE OR username=? COLLATE NOCASE LIMIT 1').get(email,username);
  if (existing) {
    if (existing.role !== 'admin' || !existing.email_verified_at) db.prepare("UPDATE users SET role='admin',is_active=1,email_verified_at=COALESCE(email_verified_at,CURRENT_TIMESTAMP) WHERE id=?").run(existing.id);
    return;
  }
  const passwordHash = await hashPassword(password);
  db.prepare("INSERT INTO users(username,email,display_name,password_hash,role,password_changed_at,email_verified_at) VALUES (?,?,?,?, 'admin',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
    .run(username,email,'Platform Admin',passwordHash);
  securityLog('bootstrap_admin.created', { username }, 'info');
}

// The catalog owner receives only the narrow divine.manage capability.
function ensureDivineCardContentOwner() {
  const email = String(process.env.DIVINE_CARD_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email) return;
  const existing = db.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE LIMIT 1').get(email);
  if (existing) {
    db.prepare(`INSERT INTO user_permissions(user_id,permission) VALUES (?,'divine.manage')
      ON CONFLICT(user_id,permission) DO NOTHING`).run(existing.id);
    securityLog('divine_content_owner.capability_granted', { userId: existing.id }, 'info');
  }
}

function slugify(text) {
  return String(text || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || `tournament-${Date.now()}`;
}
function randomCode(length = 8) { return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length).toUpperCase(); }
function newDraftGameRollId() { return crypto.randomBytes(18).toString('base64url'); }
function validDraftGameRollId(value) { return /^[A-Za-z0-9_-]{16,80}$/.test(String(value || '')); }
function normalizeMirrorPickMode(rules = {}) {
  const allowed = new Set(['none','tank','technical','damage','tank-technical','all']);
  if (allowed.has(rules.mirrorPickMode)) return rules.mirrorPickMode;
  if (rules.duplicateMode === 'mirror' || rules.duplicateMode === 'unlimited' || rules.sameHeroAllowed === true) return 'all';
  return 'none';
}
function makeTeamTag(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'TEAM';
  if (words.length === 1) return words[0].replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase() || 'TEAM';
  return words.map(word => word.replace(/[^a-z0-9]/gi, '')[0] || '').join('').slice(0, 5).toUpperCase() || 'TEAM';
}
function isDivineCardAdmin(user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return Boolean(db.prepare(`SELECT 1 FROM user_permissions WHERE user_id=? AND permission='divine.manage'`).get(user.id));
}

function divineCardAdminRequired(req,res,next) {
  if (!isDivineCardAdmin(req.user)) return res.status(403).json({error:'Only the configured Divine Card content owner can edit this catalog.'});
  next();
}
function cleanUser(user) {
  const internalEmail=/@accounts\.rendezvu\.invalid$/i.test(String(user.email||''));
  return { id:user.id,username:user.username,email:internalEmail?'':user.email,displayName:user.display_name,role:user.role,isActive:Boolean(user.is_active),emailVerified:true,emailVerifiedAt:user.email_verified_at||null,gamerTag:user.gamer_tag||'',bio:user.bio||'',profileVisibility:user.profile_visibility==='private'?'private':'public',showExternalProfiles:Boolean(user.show_external_profiles),canOrganize:true,canManageDivineCards:isDivineCardAdmin(user),createdAt:user.created_at };
}
function normalizeDiscordInviteUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (url.protocol !== 'https:' || !['discord.gg','discord.com','discordapp.com'].includes(host) || url.username || url.password || url.port) return '';
    const parts = url.pathname.split('/').filter(Boolean);
    const code = host === 'discord.gg'
      ? (parts.length === 1 ? parts[0] : '')
      : (parts.length === 2 && parts[0].toLowerCase() === 'invite' ? parts[1] : '');
    return /^[A-Za-z0-9_-]{2,64}$/.test(code || '') ? `https://discord.gg/${code}` : '';
  } catch {
    return '';
  }
}
function discordInviteFromText(value = '') {
  const candidates=String(value||'').match(/(?:https?:\/\/)?(?:www\.)?(?:discord\.gg|discord(?:app)?\.com\/invite)\/[^\s<>"']+/gi)||[];
  for(const candidate of candidates){
    const cleaned=candidate.replace(/[),.;!?]+$/g,'');
    const normalized=normalizeDiscordInviteUrl(cleaned);
    if(normalized)return normalized;
  }
  return '';
}
function sourceVerificationFields(tournament) {
  const sourceSyncStatus=String(tournament?.source_sync_status||'');
  return {sourceSyncStatus,unverified:sourceSyncStatus==='url_verified'};
}
function normalizeRegistrationMode(value) {
  const mode=String(value||'team_or_solo');
  if(!['team_or_solo','solo_pool_only'].includes(mode))throw new Error('Choose team registration with optional solo signup, or Solo Pool only.');
  return mode;
}
function logAction({ tournamentId=null,matchId=null,userId=null,action,details={} }) {
  db.prepare('INSERT INTO audit_logs(tournament_id,match_id,user_id,action,details_json) VALUES (?,?,?,?,?)')
    .run(tournamentId,matchId,userId,action,JSON.stringify(details));
}
function clientErrorMessage(error, fallback='Request could not be completed.') {
  const message=sanitizeText(error?.message || '',300);
  if(!message)return fallback;
  if(!isProduction)return message;
  if(/SQLITE|ENOENT|EACCES|database|constraint failed|stack|\/mnt\/|[A-Z]:\\/i.test(message))return fallback;
  return message;
}
function assertLockedSeedMutationAllowed(user, team, nextSeed) {
  if (!team?.seed_locked || user?.role === 'admin') return;
  if (Number(team.seed) === Number(nextSeed)) return;
  const error = new Error(`Seed ${team.seed} for team ${team.id} is locked. Unlock and save the seed first, then change its position.`);
  error.code = 'LOCKED_SEED';
  throw error;
}
function addSystemMessage(matchId,message) {
  const match=db.prepare('SELECT tournament_id FROM matches WHERE id=?').get(matchId);if(!match)return null;
  const result=db.prepare(`INSERT INTO match_messages(match_id,sender_role,sender_name,message,message_type) VALUES (?,'system','System',?,'system')`).run(matchId,String(message).slice(0,1000));
  const saved=db.prepare(`SELECT mm.*,f.original_name file_name,f.mime_type file_mime FROM match_messages mm LEFT JOIN files f ON f.id=mm.file_id WHERE mm.id=?`).get(Number(result.lastInsertRowid));
  emitInternalTournamentEvent(match.tournament_id,'match:chat',{matchId,message:saved});
  const room=db.prepare('SELECT room_code FROM draft_rooms WHERE match_id=?').get(matchId);if(room)io.to(`draft:${room.room_code}`).emit('draft:chat',saved);
  return saved;
}
function teamForCaptain(userId,teamId) {
  // teams.captain_user_id is the canonical authority for Captain-only actions.
  // A stale roster flag must never let a former Captain check in or control a match.
  return db.prepare(`SELECT * FROM teams WHERE id=? AND captain_user_id=? AND team_status NOT IN ('withdrawn','disqualified')`).get(teamId,userId);
}
function assertCaptainRosterAccess(userId,teamId) {
  const team=teamForCaptain(userId,Number(teamId));
  if(!team){const error=new Error('Only the linked Captain can manage this team roster.');error.status=403;throw error;}
  const tournament=db.prepare('SELECT roster_lock_at FROM tournaments WHERE id=?').get(team.tournament_id);
  const effectiveLock=team.roster_locked_at||tournament?.roster_lock_at;
  if(effectiveLock&&Date.parse(effectiveLock)<=Date.now()){const error=new Error('Roster is locked. Ask the Host for an administrative change.');error.status=409;throw error;}
  return team;
}
function matchPermission(req, permission) {
  const match = req.match || canAccessMatch(req.user.id,Number(req.params.matchId)).match;
  return match && hasTournamentPermission(req.user.id,match.tournament_id,permission);
}
function serializePublicMatch(match) {
  return {
    id:match.id,stage:match.stage,groupName:match.group_name,roundNo:match.round_no,roundName:match.round_name,position:match.position,
    teamA:match.team_a_id?{id:match.team_a_id,name:match.team_a_name,tag:match.team_a_tag,logoUrl:match.team_a_logo}:null,
    teamB:match.team_b_id?{id:match.team_b_id,name:match.team_b_name,tag:match.team_b_tag,logoUrl:match.team_b_logo}:null,
    scoreA:match.score_a,scoreB:match.score_b,winnerTeamId:match.winner_team_id,bestOf:match.best_of,
    matchStatus:match.match_status,resultStatus:match.result_status,resolutionType:match.resolution_type,
    effectiveScheduledAt:match.effective_scheduled_at,streamUrl:match.stream_url,streamPlatform:match.stream_platform,
    publicNotes:match.public_notes,
  };
}
function publicTournamentRoom(tournamentId){return `tournament:public:${Number(tournamentId)}`;}
function internalTournamentRoom(tournamentId){return `tournament:internal:${Number(tournamentId)}`;}
function internalTeamRoom(teamId){return `team:internal:${Number(teamId)}`;}
function emitBracketUpdated(tournamentId,matches=listMatches(tournamentId),extra={}){
  io.to(publicTournamentRoom(tournamentId)).emit('bracket:updated',{
    tournamentId:Number(tournamentId),matches:matches.map(serializePublicMatch),...extra,
  });
  io.to(internalTournamentRoom(tournamentId)).emit('bracket:updated',{
    tournamentId:Number(tournamentId),matches,...extra,
  });
  const teamIds=db.prepare(`SELECT id FROM teams WHERE tournament_id=? AND team_status NOT IN ('withdrawn','disqualified')`).all(Number(tournamentId));
  teamIds.forEach(team=>io.to(internalTeamRoom(team.id)).emit('bracket:updated',{tournamentId:Number(tournamentId)}));
}
function emitMatchUpdated(match){
  if(!match)return;
  io.to(publicTournamentRoom(match.tournament_id)).emit('match:updated',serializePublicMatch(match));
  io.to(internalTournamentRoom(match.tournament_id)).emit('match:updated',match);
  if(match.team_a_id)io.to(internalTeamRoom(match.team_a_id)).emit('match:updated',serializePublicMatch(match));
  if(match.team_b_id&&Number(match.team_b_id)!==Number(match.team_a_id))io.to(internalTeamRoom(match.team_b_id)).emit('match:updated',serializePublicMatch(match));
}
function emitInternalTournamentEvent(tournamentId,event,payload){
  io.to(internalTournamentRoom(tournamentId)).emit(event,payload);
  if(payload?.matchId){
    const match=db.prepare('SELECT team_a_id,team_b_id FROM matches WHERE id=? AND tournament_id=?').get(Number(payload.matchId),Number(tournamentId));
    if(match?.team_a_id)io.to(internalTeamRoom(match.team_a_id)).emit(event,payload);
    if(match?.team_b_id&&Number(match.team_b_id)!==Number(match.team_a_id))io.to(internalTeamRoom(match.team_b_id)).emit(event,payload);
  }
}

const CLOSED_JOIN_STATUSES = new Set(['completed','finalized','archived','cancelled']);
function tournamentAllowsJoin(tournament) {
  return Boolean(tournament && tournament.is_public && !CLOSED_JOIN_STATUSES.has(String(tournament.status || '').toLowerCase()));
}
function existingTournamentMembership(userId, tournamentId) {
  return db.prepare(`SELECT tm.*,t.name team_name,t.tag team_tag,t.tournament_id
    FROM team_members tm JOIN teams t ON t.id=tm.team_id
    WHERE tm.user_id=? AND t.tournament_id=? AND tm.membership_status='active'
    ORDER BY tm.is_captain DESC,tm.id LIMIT 1`).get(userId,tournamentId);
}

// Captain identity has two deliberate representations: the authorization pointer
// on teams and the roster flag on team_members. Call inside the caller's existing
// transaction so transfers cannot expose one representation without the other.
function syncTeamCaptain(teamId,user,{gamerTag=''}={}){
  const userId=Number(user?.id);
  if(!Number.isInteger(userId)||userId<=0)throw new Error('A valid Captain account is required.');
  
  // Get current team status to preserve it
  const currentTeam=db.prepare('SELECT team_status,status,captain_user_id FROM teams WHERE id=?').get(teamId);
  if(!currentTeam)throw new Error('Team not found.');
  
  // Find all entries for this user in the team (including duplicates)
  const allUserEntries=db.prepare(`SELECT * FROM team_members WHERE team_id=? AND user_id=? ORDER BY membership_status='active' DESC,id`).all(teamId,userId);
  
  // Find placeholder captain entry (user_id IS NULL)
  const placeholder=db.prepare(`SELECT * FROM team_members WHERE team_id=? AND user_id IS NULL AND is_captain=1 ORDER BY id LIMIT 1`).get(teamId);
  
  // Determine which entry to use as the captain
  let memberToUse=null;
  if(allUserEntries.length>0){
    // Use the most recent active entry for this user
    memberToUse=allUserEntries[0];
  }else if(placeholder){
    // Use placeholder if no user entry exists
    memberToUse=placeholder;
  }
  
  // Clear every stale Captain flag before promoting the selected roster entry.
  // This also repairs teams created by older versions that left more than one
  // Captain-marked row after a transfer.
  db.prepare(`UPDATE team_members SET is_captain=0,
    member_role=CASE WHEN member_role='captain' THEN 'player' ELSE member_role END,
    updated_at=CURRENT_TIMESTAMP
    WHERE team_id=? AND user_id IS NOT NULL AND user_id!=?
      AND (is_captain=1 OR member_role='captain')`).run(teamId,userId);
  
  // Handle duplicate entries for the new captain
  if(allUserEntries.length>1){
    // Keep only the most recent entry, delete duplicates
    const entriesToDelete=allUserEntries.slice(1);
    entriesToDelete.forEach(entry=>{
      db.prepare(`DELETE FROM team_members WHERE id=?`).run(entry.id);
    });
  }
  
  if(memberToUse){
    if(placeholder && !allUserEntries.length){
      // Link user to placeholder
      db.prepare(`UPDATE team_members SET user_id=?,display_name=?,gamer_tag=?,member_role='captain',membership_status='active',is_captain=1,is_substitute=0,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(userId,user.display_name,String(gamerTag||user.gamer_tag||user.username||''),memberToUse.id);
    }else{
      // Update existing entry to captain
      db.prepare(`UPDATE team_members SET member_role='captain',membership_status='active',is_captain=1,is_substitute=0,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(memberToUse.id);
    }
  }else{
    // Create new captain entry
    db.prepare(`INSERT INTO team_members(team_id,user_id,display_name,gamer_tag,member_role,membership_status,is_captain,is_substitute) VALUES (?,?,?,?,'captain','active',1,0)`)
      .run(teamId,userId,user.display_name,String(gamerTag||user.gamer_tag||user.username||''));
  }
  
  // Update team captain reference while preserving team status
  db.prepare(`UPDATE teams SET captain_user_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(userId,teamId);
}

function soloRandomizerPool(tournamentId) {
  return db.prepare(`SELECT jr.id request_id,jr.user_id,jr.requested_role,jr.gamer_tag,u.display_name,u.username
    FROM tournament_join_requests jr JOIN users u ON u.id=jr.user_id AND u.is_active=1
    WHERE jr.tournament_id=? AND jr.status='approved' AND jr.team_id IS NULL AND jr.selected_member_id IS NULL
      AND jr.requested_role IN ('player','captain')
      AND NOT EXISTS (
        SELECT 1 FROM team_members tm JOIN teams t ON t.id=tm.team_id
        WHERE tm.user_id=jr.user_id AND tm.membership_status='active' AND t.tournament_id=jr.tournament_id
      )
    ORDER BY jr.id`).all(tournamentId);
}
function shuffledBySortKey(values) {
  return values.map(value=>({value,sort:Math.random()})).sort((a,b)=>a.sort-b.sort).map(item=>item.value);
}
function assertSoloFormationWindow(tournamentId) {
  const tournament=db.prepare('SELECT * FROM tournaments WHERE id=?').get(tournamentId);
  if(!tournament){const error=new Error('Tournament not found.');error.status=404;throw error;}
  if(tournament.roster_lock_at&&Date.parse(tournament.roster_lock_at)<=Date.now()){const error=new Error('The tournament roster is locked.');error.status=409;throw error;}
  const matchCount=Number(db.prepare('SELECT COUNT(*) count FROM matches WHERE tournament_id=?').get(tournamentId)?.count||0);
  if(matchCount){const error=new Error('Undo or regenerate the bracket before forming teams from solo signups.');error.status=409;throw error;}
  return tournament;
}
function uniqueSoloTeamNames(tournamentId, teamCount) {
  const used=new Set(db.prepare('SELECT name FROM teams WHERE tournament_id=?').all(tournamentId).map(team=>String(team.name).toLowerCase()));
  return Array.from({length:teamCount},(_,index)=>{
    const base=`Solo Team ${index+1}`;let name=base,suffix=2;
    while(used.has(name.toLowerCase()))name=`${base} ${suffix++}`;
    used.add(name.toLowerCase());return name;
  });
}
function buildSoloTeamPreview(tournamentId,{totalSlots,teamSize=4,captainMode='self_nominated',captainUserIds=[],targetTeamIds=[]}={}) {
  assertSoloFormationWindow(tournamentId);
  const pool=soloRandomizerPool(tournamentId);
  const slots=Number(totalSlots||pool.length);const size=Number(teamSize||4);
  if(!Number.isInteger(slots)||slots<2||slots>256)throw new Error('Total slots must be a whole number between 2 and 256.');
  if(!Number.isInteger(size)||size<2||size>16)throw new Error('Team size must be a whole number between 2 and 16.');
  if(slots!==pool.length)throw new Error(`Total slots must match the ${pool.length} approved teamless solo signups. No player will be dropped.`);
  if(slots%size!==0)throw new Error(`${slots} approved solo signups cannot be divided evenly into teams of ${size}.`);
  const teamCount=slots/size;
  const mode=String(captainMode||'self_nominated');
  if(!['self_nominated','host_selected','random_assigned'].includes(mode))throw new Error('Choose self-nominated, Host-selected, or Random Captains.');
  const byUserId=new Map(pool.map(player=>[Number(player.user_id),player]));
  let captains=[];
  if(mode==='self_nominated'){
    captains=pool.filter(player=>player.requested_role==='captain');
    if(captains.length!==teamCount)throw new Error(`Exactly ${teamCount} Captain signup(s) are required; ${captains.length} are approved. Captain slots are capped at one per team.`);
  }else if(mode==='host_selected'){
    const selected=[...new Set((Array.isArray(captainUserIds)?captainUserIds:[]).map(Number).filter(Number.isInteger))];
    if(selected.length!==teamCount)throw new Error(`Select exactly ${teamCount} Captain(s) for ${teamCount} teams.`);
    captains=selected.map(userId=>byUserId.get(userId));
    if(captains.some(player=>!player))throw new Error('Every selected Captain must be in the approved teamless solo pool.');
  }else if(mode==='random_assigned'){
    const nominated=shuffledBySortKey(pool.filter(player=>player.requested_role==='captain'));
    const nonNominated=shuffledBySortKey(pool.filter(player=>player.requested_role!=='captain'));
    captains=[...nominated,...nonNominated].slice(0,teamCount);
  }
  const captainIds=new Set(captains.map(player=>Number(player.user_id)));
  const requestedTargetIds=[...new Set((Array.isArray(targetTeamIds)?targetTeamIds:[]).map(Number))];
  if(requestedTargetIds.some(teamId=>!Number.isInteger(teamId)||teamId<=0))throw new Error('Every target team must have a valid ID.');
  let targets=[];
  if(requestedTargetIds.length){
    if(requestedTargetIds.length!==teamCount)throw new Error(`Select exactly ${teamCount} empty target team(s) for ${slots} players.`);
    const rows=db.prepare(`SELECT t.*,(SELECT COUNT(*) FROM team_members tm WHERE tm.team_id=t.id AND tm.membership_status='active') active_member_count
      FROM teams t WHERE t.tournament_id=? AND t.id IN (${requestedTargetIds.map(()=>'?').join(',')})`).all(tournamentId,...requestedTargetIds);
    const byId=new Map(rows.map(team=>[Number(team.id),team]));
    targets=requestedTargetIds.map(teamId=>byId.get(teamId));
    if(targets.some(team=>!team))throw new Error('Every target team must belong to this tournament.');
    if(targets.some(team=>['withdrawn','disqualified'].includes(team.team_status)||Number(team.active_member_count)>0||team.captain_user_id))throw new Error('Existing target teams must be active, empty and have no Captain assigned.');
  }else{
    targets=uniqueSoloTeamNames(tournamentId,teamCount).map((name,index)=>({id:null,name,tag:`S${String(index+1).padStart(2,'0')}`}));
  }
  const assignments=shuffledBySortKey(captains).map((captain,index)=>({
    teamId:targets[index].id?Number(targets[index].id):null,name:targets[index].name,tag:targets[index].tag,
    members:[{...captain,isCaptain:true}],
  }));
  shuffledBySortKey(pool.filter(player=>!captainIds.has(Number(player.user_id))))
    .forEach((player,index)=>assignments[index%teamCount].members.push({...player,isCaptain:false}));
  if(assignments.some(team=>team.members.length!==size))throw new Error('The solo pool could not be dealt into equal team sizes.');
  return {pool,totalSlots:slots,teamSize:size,teamCount,captainMode:mode,targetTeamIds:requestedTargetIds,assignments};
}
function soloPreviewPayload(row) {
  return {
    id:row.id,totalSlots:row.total_slots,teamSize:row.team_size,captainMode:row.captain_mode,
    expiresAt:row.expires_at,assignments:jsonParse(row.assignments_json,[]),
  };
}

app.get('/api/health', (_req,res) => res.json({status:'ok',version:appVersion}));
app.get('/api/public/site-config', (_req,res) => {
  const contactEmail = String(process.env.PUBLIC_CONTACT_EMAIL || 'rendezvous2193@gmail.com').trim();
  const supportUrl = String(process.env.PUBLIC_SUPPORT_URL || '').trim();
  res.json({
    contactEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) ? contactEmail : '',
    supportUrl: supportUrl && isSafeExternalUrl(supportUrl) ? supportUrl : '',
    accountVerification:{
      emailEnabled:false,
      startggOAuthEnabled:false,
    },
  });
});
app.get('/api/admin/diagnostics',authRequired,allowRoles('admin'),(_req,res)=>res.json({
  status:'ok',version:appVersion,database:dbPath,time:new Date().toISOString(),
}));

function rateLimitKey(req) { return clientIp(req); }
function accountLockStatus(user) {
  if (!user?.locked_until) return null;
  const remainingMs = Date.parse(user.locked_until) - Date.now();
  return remainingMs > 0 ? Math.max(1, Math.ceil(remainingMs / 1000)) : null;
}
function recordFailedLogin(user) {
  if (!user) return null;
  const failures = Number(user.failed_login_count || 0) + 1;
  let lockedUntil = null;
  if (failures >= 5) {
    const minutes = Math.min(24 * 60, 15 * (2 ** Math.min(6, failures - 5)));
    lockedUntil = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  }
  db.prepare('UPDATE users SET failed_login_count=?,locked_until=? WHERE id=?').run(failures,lockedUntil,user.id);
  return { failures, lockedUntil };
}

// Authentication
app.post('/api/auth/register', async (req,res) => {
  const limiterKey = rateLimitKey(req);
  const limitStatus = registerLimiter.status(limiterKey);
  if (!limitStatus.allowed) return rejectRateLimited(req,res,registerLimiter,limitStatus,'auth.register_rate_limited');
  let userId = null;
  try {
    const username=sanitizeText(req.body.username,60);
    const password=String(req.body.password||'');
    const passwordConfirmation=String(req.body.passwordConfirmation||'');
    const displayName=sanitizeText(req.body.displayName||username,100);
    const requestedRole=String(req.body.role||'player');
    const role=process.env.ALLOW_DIRECT_HOST_REGISTRATION==='true'&&requestedRole==='host'?'host':'player';
    if(!/^[A-Za-z0-9_.-]{3,60}$/.test(username))return res.status(400).json({error:'Username must be 3-60 characters and use letters, numbers, dot, dash or underscore.'});
    if(password!==passwordConfirmation)return res.status(400).json({error:'The two passwords do not match.'});
    const passwordHash=await hashPassword(password);
    const email=`${crypto.randomUUID()}@accounts.rendezvu.invalid`;
    const result=db.prepare(`INSERT INTO users(username,email,display_name,password_hash,role,password_changed_at,email_verified_at)
      VALUES (?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`).run(username,email,displayName,passwordHash,role);
    userId=Number(result.lastInsertRowid);
    const user=db.prepare('SELECT * FROM users WHERE id=?').get(userId);
    registerLimiter.record(limiterKey);
    const session=createSession(user,req);
    setSessionCookies(res,session);
    securityLog('auth.register_success',{userId:user.id,ipHash:anonymize(clientIp(req)),accountMode:'public_test'},'info');
    res.status(201).json({...developmentTokenResponse(session),user:cleanUser(user),accessExpiresAt:session.accessExpiresAt,verificationRequired:false});
  } catch(error){
    if(String(error.message).includes('UNIQUE'))return res.status(409).json({error:'Username already exists.'});
    if (/Password must/.test(error.message)) return res.status(400).json({error:clientErrorMessage(error)});
    securityLog('auth.register_error',{ipHash:anonymize(clientIp(req)),message:error.message},'error');
    res.status(500).json({error:'Unable to create account.'});
  }
});
app.post('/api/auth/login',async(req,res)=>{
  const limiterKey=rateLimitKey(req);
  const limitStatus=loginFailureLimiter.status(limiterKey);
  if(!limitStatus.allowed)return rejectRateLimited(req,res,loginFailureLimiter,limitStatus,'auth.login_rate_limited');
  const identity=String(req.body.identity||'').trim().slice(0,254);
  const password=String(req.body.password||'');
  const user=db.prepare('SELECT * FROM users WHERE (username=? COLLATE NOCASE OR email=? COLLATE NOCASE) AND is_active=1').get(identity,identity);
  const lockSeconds=accountLockStatus(user);
  if(lockSeconds){
    res.setHeader('Retry-After',String(lockSeconds));
    securityLog('auth.account_locked',{userId:user.id,ipHash:anonymize(clientIp(req)),retryAfterSeconds:lockSeconds});
    return res.status(429).json({error:'Account is temporarily locked after repeated failed logins.',retryAfterSeconds:lockSeconds});
  }
  const valid=user?await verifyPassword(password,user.password_hash):(await burnPasswordCost(password),false);
  if(!valid){
    const accountState=recordFailedLogin(user);
    loginFailureLimiter.record(limiterKey);
    securityLog('auth.login_failed',{userId:user?.id||null,identityHash:anonymize(identity.toLowerCase()),ipHash:anonymize(clientIp(req)),failures:accountState?.failures||null});
    return res.status(401).json({error:'Incorrect username or password.'});
  }
  if(needsPasswordRehash(user.password_hash)){
    const passwordHash=await hashPassword(password);
    db.prepare('UPDATE users SET password_hash=?,password_changed_at=CURRENT_TIMESTAMP WHERE id=?').run(passwordHash,user.id);
  }
  db.prepare('UPDATE users SET last_login_at=CURRENT_TIMESTAMP,failed_login_count=0,locked_until=NULL WHERE id=?').run(user.id);
  loginFailureLimiter.reset(limiterKey);
  const session=createSession(user,req);
  setSessionCookies(res,session);
  securityLog('auth.login_success',{userId:user.id,ipHash:anonymize(clientIp(req))},'info');
  res.json({...developmentTokenResponse(session),user:cleanUser(user),accessExpiresAt:session.accessExpiresAt});
});
app.post('/api/auth/refresh',(req,res)=>{
  try{
    const rotated=rotateSession(refreshTokenFromRequest(req),req);
    setSessionCookies(res,rotated.session);
    res.json({...developmentTokenResponse(rotated.session),user:cleanUser(rotated.user),accessExpiresAt:rotated.session.accessExpiresAt});
  }catch{
    clearSessionCookies(res);
    res.status(401).json({error:'Refresh session is invalid or expired.'});
  }
});
app.post('/api/auth/logout',(req,res)=>{
  revokeSessionByRequest(req);
  clearSessionCookies(res);
  res.json({ok:true});
});
app.get('/api/auth/sessions',authRequired,(req,res)=>{
  res.json({sessions:listUserSessions(req.user.id,req.authSessionId)});
});
app.delete('/api/auth/sessions/:sessionId',authRequired,(req,res)=>{
  const sessionId=Number(req.params.sessionId);
  if(!Number.isInteger(sessionId))return res.status(400).json({error:'Invalid session ID.'});
  const revoked=revokeUserSession(req.user.id,sessionId);
  if(!revoked)return res.status(404).json({error:'Active session not found.'});
  if(sessionId===req.authSessionId)clearSessionCookies(res);
  securityLog('auth.session_revoked',{userId:req.user.id,sessionId},'info');
  res.json({ok:true,revoked});
});
app.post('/api/auth/sessions/revoke-all',authRequired,(req,res)=>{
  const revoked=revokeAllUserSessions(req.user.id);
  clearSessionCookies(res);
  securityLog('auth.sessions_revoked_all',{userId:req.user.id,count:revoked},'info');
  res.json({ok:true,revoked});
});
app.get('/api/auth/me',authRequired,(req,res)=>res.json({user:cleanUser(req.user)}));

app.get('/api/auth/email-verification',authRequired,(_req,res)=>res.json({enabled:false,verified:true,verifiedAt:null,email:'',challenge:null}));
app.post('/api/auth/verify-email',authRequired,(_req,res)=>res.status(410).json({error:'Email verification is disabled for this public test website.'}));
app.post('/api/auth/resend-verification',authRequired,(_req,res)=>res.status(410).json({error:'Verification email delivery is disabled for this public test website.'}));

// Password changes require the existing password and revoke every other active session.
app.post('/api/auth/change-password',authRequired,async(req,res)=>{
  try{
    const currentPassword=String(req.body.currentPassword||'');
    const newPassword=String(req.body.newPassword||'');
    const user=db.prepare('SELECT id,password_hash FROM users WHERE id=?').get(req.user.id);
    if(!user)return res.status(404).json({error:'Account not found.'});
    if(!await verifyPassword(currentPassword,user.password_hash))return res.status(401).json({error:'Current password is incorrect.'});
    const passwordHash=await hashPassword(newPassword);
    transaction(()=>{
      db.prepare('UPDATE users SET password_hash=?,password_changed_at=CURRENT_TIMESTAMP,failed_login_count=0,locked_until=NULL WHERE id=?')
        .run(passwordHash,user.id);
      db.prepare(`UPDATE auth_sessions SET revoked_at=CURRENT_TIMESTAMP,revoke_reason='password_changed'
        WHERE user_id=? AND id!=? AND revoked_at IS NULL`).run(user.id,req.authSessionId);
    });
    securityLog('auth.password_changed',{userId:user.id,ipHash:anonymize(clientIp(req))},'info');
    res.json({ok:true});
  }catch(error){
    if(/Password must/.test(error.message))return res.status(400).json({error:error.message});
    securityLog('auth.password_change_error',{userId:req.user.id,message:error.message},'error');
    res.status(500).json({error:'Unable to change password.'});
  }
});

// Any signed-in account may claim one supported external tournament and becomes Owner of that event only.
app.get('/api/tournament-import/platforms', (_req,res) => {
  res.json({ platforms: [
    { id:'startgg', label:'start.gg', example:'https://www.start.gg/tournament/your-event' },
    { id:'tonamel', label:'Tonamel', example:'https://tonamel.com/competition/BGZfx' },
    { id:'challonge', label:'Challonge', example:'https://challonge.com/your-event' },
  ]});
});
app.post('/api/tournament-import/preview', authRequired, emailVerifiedRequired, async (req,res) => {
  try {
    const preview = await previewExternalTournament(req.body.url);
    const existing = db.prepare(`SELECT id,name,slug,host_user_id FROM tournaments
      WHERE source_url=? OR (source_platform=? AND source_external_id=?) LIMIT 1`)
      .get(preview.sourceUrl, preview.platform, preview.externalId);
    res.json({
      preview,
      existingTournament: existing ? {
        id: existing.id,
        name: existing.name,
        slug: existing.slug,
        ownedByCurrentUser: existing.host_user_id === req.user.id,
      } : null,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
app.post('/api/tournament-import', authRequired, emailVerifiedRequired, async (req,res) => {
  try {
    if (!req.body.confirmOwnership) {
      return res.status(400).json({ error:'Confirm that you are authorized to manage this tournament.' });
    }
    const preview = await previewExternalTournament(req.body.url);
    const existing = db.prepare(`SELECT id,name,slug,host_user_id FROM tournaments
      WHERE source_url=? OR (source_platform=? AND source_external_id=?) LIMIT 1`)
      .get(preview.sourceUrl, preview.platform, preview.externalId);
    if (existing) {
      const own = existing.host_user_id === req.user.id;
      return res.status(409).json({
        error: own
          ? 'You already imported this tournament. Open Tournament Operations instead.'
          : 'This external tournament has already been claimed by another account.',
        tournamentId: own ? existing.id : undefined,
        tournamentSlug: own ? existing.slug : undefined,
      });
    }

    const requestedName = String(req.body.name || '').trim();
    const name = (requestedName || preview.name || 'Imported Tournament').slice(0,160);
    let slug = slugify(name), suffix = 2;
    while (db.prepare('SELECT 1 FROM tournaments WHERE slug=?').get(slug)) slug = `${slugify(name)}-${suffix++}`;
    const startggUrl = preview.platform === 'startgg' ? preview.sourceUrl : null;
    const startggSlug = preview.platform === 'startgg' ? preview.externalId : null;
    const providerTournamentId = preview.platform === 'startgg'
      ? String(preview.metadata?.providerTournamentId || '') || null
      : null;
    const metadata = {
      ...preview.metadata,
      platformLabel: preview.platformLabel,
      warnings: preview.warnings,
      claimedByUserId: req.user.id,
      claimedAt: new Date().toISOString(),
    };
    const requestedDiscordUrl=String(req.body.discordUrl||'').trim();
    const normalizedDiscordUrl=normalizeDiscordInviteUrl(requestedDiscordUrl);
    if(requestedDiscordUrl&&!normalizedDiscordUrl)throw new Error('Discord invite must be a valid discord.gg or discord.com/invite HTTPS link.');
    const discordUrl=normalizedDiscordUrl||discordInviteFromText(preview.description);

    const result = transaction(() => {
      const inserted = db.prepare(`INSERT INTO tournaments(
        host_user_id,name,slug,description,discord_url,startgg_url,startgg_slug,startgg_tournament_id,
        source_platform,source_url,source_external_id,source_metadata_json,source_last_synced_at,source_sync_status,
        status,timezone,default_server,start_at,schedule_mode,is_public,rules_json
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        req.user.id,name,slug,preview.description || '',discordUrl,startggUrl,startggSlug,providerTournamentId,
        preview.platform,preview.sourceUrl,preview.externalId,JSON.stringify(metadata),new Date().toISOString(),preview.syncStatus,
        'preparing',String(req.body.timezone || 'Asia/Ho_Chi_Minh'),String(req.body.defaultServer || 'Asia'),preview.startAt || null,
        'fixed_tournament_start',0,'{}'
      );
      const tournamentId = Number(inserted.lastInsertRowid);
      logAction({ tournamentId,userId:req.user.id,action:'tournament.external_claimed',details:{
        platform:preview.platform,sourceUrl:preview.sourceUrl,externalId:preview.externalId,syncStatus:preview.syncStatus,
      }});
      return tournamentId;
    });
    const tournament = db.prepare('SELECT * FROM tournaments WHERE id=?').get(result);
    res.status(201).json({ tournament:{ ...tournament,...sourceVerificationFields(tournament),rules:jsonParse(tournament.rules_json),sourceMetadata:jsonParse(tournament.source_metadata_json) },requiresVerification:preview.syncStatus==='url_verified' });
  } catch (error) {
    if (/UNIQUE constraint/i.test(error.message)) return res.status(409).json({ error:'This external tournament has already been imported.' });
    res.status(400).json({ error:clientErrorMessage(error) });
  }
});

// Legacy Host-application endpoints were removed in v0.6.14. Tournament ownership is now granted per imported event.
app.get('/api/users/search',authRequired,(req,res)=>{
  const raw=sanitizeText(req.query.q,80);
  if(!raw)return res.json({users:[]});
  const q=`%${raw}%`;
  const tournamentId=Number(req.query.tournamentId||0);
  const canSearchFull=req.user.role==='admin'||req.user.role==='host'||(
    Number.isInteger(tournamentId)&&tournamentId>0&&(
      hasTournamentPermission(req.user.id,tournamentId,'team.edit')||hasTournamentPermission(req.user.id,tournamentId,'tournament.manage')
    )
  );
  const users=canSearchFull
    ?db.prepare(`SELECT id,username,email,display_name,role FROM users WHERE is_active=1 AND (username LIKE ? OR email LIKE ? OR display_name LIKE ?) ORDER BY username LIMIT 15`).all(q,q,q)
    :db.prepare(`SELECT id,username,display_name FROM users WHERE is_active=1 AND (username LIKE ? OR display_name LIKE ?) ORDER BY username LIMIT 15`).all(q,q);
  logAction({tournamentId:Number.isInteger(tournamentId)&&tournamentId>0?tournamentId:null,userId:req.user.id,action:'user.search',details:{queryHash:anonymize(raw.toLowerCase()),full:canSearchFull,resultCount:users.length}});
  res.json({users:users.map(user=>canSearchFull?{
    id:user.id,username:user.username,displayName:user.display_name,
    ...(req.user.role==='admin'||user.role!=='admin'?{email:user.email,role:user.role}:{}),
  }:{id:user.id,username:user.username,displayName:user.display_name})});
});

// Admin-only visual test fixtures. Production hides every fixture route unless explicitly enabled.
function devTestGate(_req,res,next){
  if(isProduction&&process.env.ENABLE_DEV_TEST_CONSOLE!=='true')return res.status(404).json({error:'Not found.'});
  next();
}
app.get('/api/dev-test/suites',authRequired,allowRoles('admin'),devTestGate,(_req,res)=>{
  try { res.json({suites:listTestSuites()}); }
  catch(error){res.status(500).json({error:clientErrorMessage(error)});}
});
app.post('/api/dev-test/suites',authRequired,allowRoles('admin'),devTestGate,async(req,res)=>{
  try {
    const result=await createTestSuite(req.user.id);
    logAction({userId:req.user.id,action:'dev_test_suite.created',details:{suiteId:result.suiteId}});
    res.status(201).json(result);
  } catch(error){res.status(400).json({error:clientErrorMessage(error)});}
});
app.post('/api/dev-test/access/exchange',devTestGate,(req,res)=>{
  const user=consumeDevAccessCode(String(req.body.code||''));
  if(!user)return res.status(403).json({error:'Invalid or expired test access code.'});
  const session=createSession(user,req);
  setSessionCookies(res,session);
  res.json({ok:true,...developmentTokenResponse(session),user:cleanUser(user)});
});
app.delete('/api/dev-test/suites/:suiteId',authRequired,allowRoles('admin'),devTestGate,(req,res)=>{
  try {
    const result=cleanupTestSuite(Number(req.params.suiteId));
    logAction({userId:req.user.id,action:'dev_test_suite.cleaned',details:{suiteId:Number(req.params.suiteId),...result}});
    res.json(result);
  } catch(error){res.status(400).json({error:clientErrorMessage(error)});}
});

app.post('/api/tournaments/:id/mock-data/seed-32', authRequired, requireTournamentPermission('team.edit'), devTestGate, async (req, res) => {
  try {
    const result = await seedMock32Players(Number(req.params.id), req.user.id);
    emitInternalTournamentEvent(Number(req.params.id), 'tournament:updated', {});
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: clientErrorMessage(error) });
  }
});

app.post('/api/tournaments/:id/mock-data/auto-checkin-others', authRequired, requireTournamentPermission('match.manage'), devTestGate, (req, res) => {
  try {
    const result = autoCheckinOtherTeams(Number(req.params.id));
    emitBracketUpdated(Number(req.params.id));
    emitInternalTournamentEvent(Number(req.params.id), 'tournament:updated', {});
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: clientErrorMessage(error) });
  }
});

app.delete('/api/tournaments/:id/mock-data/cleanup', authRequired, requireTournamentPermission('team.edit'), devTestGate, (req, res) => {
  try {
    const result = cleanupMockData(Number(req.params.id));
    emitInternalTournamentEvent(Number(req.params.id), 'tournament:updated', {});
    emitBracketUpdated(Number(req.params.id));
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: clientErrorMessage(error) });
  }
});

app.post('/api/mock-data/create-32-player-tournament', authRequired, devTestGate, async (req, res) => {
  try {
    const result = await create32PlayerTournament(req.user.id);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: clientErrorMessage(error) });
  }
});

app.get('/api/profile/history',authRequired,(req,res)=>{
  try { res.json(userTournamentHistory(req.user.id)); }
  catch(error){res.status(500).json({error:clientErrorMessage(error)});}
});

app.get('/api/profile/settings',authRequired,(req,res)=>{
  try{res.json({profile:publicAccountSettings(req.user.id)});}
  catch(error){res.status(500).json({error:clientErrorMessage(error)});}
});
app.patch('/api/profile/settings',authRequired,(req,res)=>{
  try{
    const profile=updateProfileSettings(req.user.id,req.body||{});
    logAction({userId:req.user.id,action:'profile.settings_updated',details:{profileVisibility:profile.profileVisibility,showExternalProfiles:profile.showExternalProfiles}});
    res.json({profile});
  }catch(error){res.status(400).json({error:clientErrorMessage(error)});}
});
app.post('/api/auth/change-email/request',authRequired,(_req,res)=>res.status(410).json({error:'Email addresses are not used by public test accounts.'}));
app.post('/api/auth/change-email/confirm',authRequired,(_req,res)=>res.status(410).json({error:'Email addresses are not used by public test accounts.'}));
app.get('/api/profiles/:username',(req,res)=>{
  let viewer=null;
  try{viewer=authenticateAccessToken(accessTokenFromRequest(req)).user;}catch{}
  const profile=publicUserProfile(req.params.username,viewer);
  if(!profile)return res.status(404).json({error:'Profile not found.'});
  if(profile.private)return res.status(403).json({error:'This profile is private.',profile});
  res.json({profile});
});

app.get('/api/profile/external',authRequired,(req,res)=>{
  try{res.json({profiles:listExternalProfiles(req.user.id),providers:providerCapabilities(`${req.protocol}://${req.get('host')}`)});}
  catch(error){res.status(500).json({error:clientErrorMessage(error)});}
});
app.post('/api/profile/external/manual',authRequired,emailVerifiedRequired,(req,res)=>{
  try{
    const profile=saveManualProfile(req.user.id,req.body||{});
    logAction({userId:req.user.id,action:'external_profile.saved',details:{provider:profile.provider,verificationStatus:profile.verificationStatus}});
    res.status(201).json({profile});
  }catch(error){res.status(400).json({error:clientErrorMessage(error)});}
});
app.delete('/api/profile/external/:provider',authRequired,emailVerifiedRequired,(req,res)=>{
  try{
    const provider=String(req.params.provider||'').toLowerCase();
    const deleted=deleteExternalProfile(req.user.id,provider);
    if(!deleted)return res.status(404).json({error:'Connected profile not found.'});
    logAction({userId:req.user.id,action:'external_profile.disconnected',details:{provider}});
    res.json({deleted:true});
  }catch(error){res.status(400).json({error:clientErrorMessage(error)});}
});
app.get('/api/connections/startgg',authRequired,emailVerifiedRequired,(req,res)=>{
  try{
    const result=createStartggAuthorization(req.user.id,{
      origin:`${req.protocol}://${req.get('host')}`,
      returnTo:String(req.query.return||'/portal.html'),
    });
    res.redirect(302,result.authorizationUrl);
  }catch(error){res.status(503).json({error:clientErrorMessage(error)});}
});
app.get('/api/connections/startgg/callback',async(req,res)=>{
  try{
    const result=await completeStartggAuthorization({state:String(req.query.state||''),code:String(req.query.code||'')});
    logAction({userId:result.userId,action:'external_profile.verified',details:{provider:'startgg',providerUserId:result.profile.providerUserId}});
    const target=new URL(result.returnTo||'/portal.html',securityConfig.canonicalOrigin||`${req.protocol}://${req.get('host')}`);
    target.searchParams.set('startgg','connected');
    res.redirect(303,target.pathname+target.search);
  }catch(error){
    securityLog('startgg.oauth_failed',{message:error.message,ipHash:anonymize(clientIp(req))},'error');
    res.redirect(303,'/portal.html?startgg=error');
  }
});
app.get('/api/connections/challonge',authRequired,emailVerifiedRequired,(req,res)=>{
  try{
    const result=createChallongeAuthorization(req.user.id,{
      origin:`${req.protocol}://${req.get('host')}`,
      returnTo:String(req.query.return||'/portal.html'),
    });
    res.redirect(302,result.authorizationUrl);
  }catch(error){res.status(503).json({error:clientErrorMessage(error)});}
});
app.get('/api/connections/challonge/callback',async(req,res)=>{
  try{
    const result=await completeChallongeAuthorization({state:String(req.query.state||''),code:String(req.query.code||'')});
    logAction({userId:result.userId,action:'external_profile.verified',details:{provider:'challonge',providerUserId:result.profile.providerUserId}});
    const target=new URL(result.returnTo||'/portal.html',securityConfig.canonicalOrigin||`${req.protocol}://${req.get('host')}`);
    target.searchParams.set('challonge','connected');
    res.redirect(303,target.pathname+target.search);
  }catch(error){
    securityLog('challonge.oauth_failed',{message:error.message,ipHash:anonymize(clientIp(req))},'error');
    res.redirect(303,'/portal.html?challonge=error');
  }
});

// Public tournament discovery for the homepage. No account is required.
// Public hero-build catalog. Editing is restricted to platform Admin accounts.
app.get('/api/public/divine-card-builds',(req,res)=>{
  try { res.json(publicDivineCardBundle(requestLocale(req))); }
  catch (error) { res.status(500).json({ error:clientErrorMessage(error) }); }
});
app.get('/api/admin/divine-card-builds',authRequired,divineCardAdminRequired,(req,res)=>{
  try { res.json(adminDivineCardBundle(requestLocale(req))); }
  catch (error) { res.status(500).json({ error:clientErrorMessage(error) }); }
});
app.put('/api/admin/divine-cards/:cardId',authRequired,divineCardAdminRequired,(req,res)=>{
  try {
    const card=updateDivineCard(req.params.cardId,{...req.body,locale:req.body?.locale||requestLocale(req)},req.user.id);
    logAction({userId:req.user.id,action:'divine_card.updated',details:{cardId:card.id,slotPool:card.slotPool}});
    res.json({card});
  } catch (error) { res.status(400).json({error:clientErrorMessage(error)}); }
});
app.post('/api/admin/divine-cards',authRequired,divineCardAdminRequired,(req,res)=>{
  try {
    const card=createDivineCard({...req.body,locale:req.body?.locale||requestLocale(req)},req.user.id);
    logAction({userId:req.user.id,action:'divine_card.created',details:{cardId:card.id,slotPool:card.slotPool}});
    res.status(201).json({card});
  } catch (error) { res.status(400).json({error:clientErrorMessage(error)}); }
});
app.post('/api/admin/divine-card-presets',authRequired,divineCardAdminRequired,(req,res)=>{
  try {
    const preset=saveDivineCardPreset(null,{...req.body,locale:req.body?.locale||requestLocale(req)},req.user.id);
    logAction({userId:req.user.id,action:'divine_card_preset.created',details:{presetId:preset.id}});
    res.status(201).json({preset});
  } catch (error) { res.status(400).json({error:clientErrorMessage(error)}); }
});
app.put('/api/admin/divine-card-presets/:presetId',authRequired,divineCardAdminRequired,(req,res)=>{
  try {
    const preset=saveDivineCardPreset(req.params.presetId,{...req.body,locale:req.body?.locale||requestLocale(req)},req.user.id);
    logAction({userId:req.user.id,action:'divine_card_preset.updated',details:{presetId:preset.id}});
    res.json({preset});
  } catch (error) { res.status(400).json({error:clientErrorMessage(error)}); }
});
app.delete('/api/admin/divine-card-presets/:presetId',authRequired,divineCardAdminRequired,(req,res)=>{
  try {
    deleteDivineCardPreset(req.params.presetId);
    logAction({userId:req.user.id,action:'divine_card_preset.deleted',details:{presetId:Number(req.params.presetId)}});
    res.json({ok:true});
  } catch (error) { res.status(400).json({error:clientErrorMessage(error)}); }
});
app.post('/api/admin/divine-card-assignments',authRequired,divineCardAdminRequired,(req,res)=>{
  try {
    const preset=assignDivineCardPreset(req.body);
    logAction({userId:req.user.id,action:`divine_card_preset.${req.body.action==='unassign'?'unassigned':'assigned'}`,details:{presetId:preset.id,heroIds:req.body.heroIds||[],makeDefault:req.body.makeDefault===true}});
    res.json({preset});
  } catch (error) { res.status(400).json({error:clientErrorMessage(error)}); }
});

app.get('/api/public/tournaments',(req,res)=>{
  // Offset pagination preserves the existing `tournaments` array while exposing navigation metadata.
  const limit=Math.min(60,Math.max(1,Number.parseInt(req.query.limit,10)||60));
  const offset=Math.max(0,Number.parseInt(req.query.offset,10)||0);
  const tournaments=db.prepare(`SELECT id,name,slug,description,discord_url,status,timezone,start_at,public_stream_platform,public_stream_url,public_stream_label,source_platform,source_url,updated_at FROM tournaments WHERE is_public=1 ORDER BY CASE status WHEN 'running' THEN 0 WHEN 'live' THEN 0 WHEN 'registration_open' THEN 1 WHEN 'preparing' THEN 2 WHEN 'completed' THEN 3 ELSE 2 END,start_at IS NULL,start_at DESC,updated_at DESC LIMIT ? OFFSET ?`).all(limit,offset);
  const total=Number(db.prepare('SELECT COUNT(*) count FROM tournaments WHERE is_public=1').get().count||0);
  res.json({tournaments,total,limit,offset});
});

// Public bracket and external stream links. No spectator account and no embedded watch page.
app.get('/api/public/tournaments/:slug',(req,res)=>{
  const tournament=db.prepare(`SELECT id,name,slug,description,discord_url,status,timezone,start_at,public_stream_platform,public_stream_url,public_stream_label,source_platform,source_url FROM tournaments WHERE slug=? AND is_public=1`).get(req.params.slug);
  if(!tournament)return res.status(404).json({error:'Tournament not found.'});
  res.json({tournament,matches:listMatches(tournament.id).map(serializePublicMatch),groupStandings:calculateGroupStandings(tournament.id)});
});


// Public event joining links a normal account to an already-listed external entrant/team.
app.get('/api/public/tournaments/:slug/join-options',(req,res)=>{
  const tournament=db.prepare(`SELECT id,name,slug,description,discord_url,status,timezone,start_at,is_public,source_platform,source_url,roster_lock_at,registration_mode FROM tournaments WHERE slug=? AND is_public=1`).get(req.params.slug);
  if(!tournament)return res.status(404).json({error:'Tournament not found.'});
  const soloPoolOnly=tournament.registration_mode==='solo_pool_only';
  const teams=soloPoolOnly?[]:db.prepare(`SELECT id,name,tag,logo_url,source,team_status,captain_user_id FROM teams WHERE tournament_id=? AND team_status NOT IN ('withdrawn','disqualified') AND COALESCE(formation_source,'')!='solo_randomizer' ORDER BY name`).all(tournament.id);
  const members=soloPoolOnly?[]:db.prepare(`SELECT tm.id,tm.team_id,tm.display_name,tm.gamer_tag,tm.member_role,tm.is_captain,tm.is_substitute,tm.user_id FROM team_members tm JOIN teams t ON t.id=tm.team_id WHERE t.tournament_id=? ORDER BY tm.team_id,tm.is_captain DESC,tm.id`).all(tournament.id);
  const grouped=new Map(teams.map(team=>[team.id,{...team,captainLinked:Boolean(team.captain_user_id),members:[]}])) ;
  members.forEach(member=>grouped.get(member.team_id)?.members.push({id:member.id,displayName:member.display_name,gamerTag:member.gamer_tag,memberRole:member.member_role,isCaptain:Boolean(member.is_captain),isSubstitute:Boolean(member.is_substitute),accountLinked:Boolean(member.user_id)}));
  const requirement=providerRequirement(tournament);
  res.json({tournament:{...tournament,canJoin:tournamentAllowsJoin(tournament),profileRequirement:requirement},teams:[...grouped.values()]});
});
app.get('/api/tournaments/:slug/eligibility',authRequired,(req,res)=>{
  const tournament=db.prepare(`SELECT * FROM tournaments WHERE slug=? AND is_public=1`).get(req.params.slug);
  if(!tournament)return res.status(404).json({error:'Tournament not found.'});
  res.json({...tournamentEligibility(req.user.id,tournament),providerCapabilities:providerCapabilities(`${req.protocol}://${req.get('host')}`)});
});
app.get('/api/tournaments/:id/eligibility',authRequired,(req,res)=>{
  const tournament=db.prepare('SELECT * FROM tournaments WHERE id=?').get(Number(req.params.id));
  if(!tournament)return res.status(404).json({error:'Tournament not found.'});
  if(!tournament.is_public&&!hasTournamentPermission(req.user.id,tournament.id,'tournament.read'))return res.status(403).json({error:'Tournament access denied.'});
  res.json({...tournamentEligibility(req.user.id,tournament),providerCapabilities:providerCapabilities(`${req.protocol}://${req.get('host')}`)});
});
app.get('/api/tournaments/:slug/my-join',authRequired,(req,res)=>{
  const tournament=db.prepare(`SELECT id,name,slug,status,is_public,source_platform,source_url FROM tournaments WHERE slug=? AND is_public=1`).get(req.params.slug);
  if(!tournament)return res.status(404).json({error:'Tournament not found.'});
  const membership=existingTournamentMembership(req.user.id,tournament.id);
  const request=db.prepare(`SELECT jr.*,t.name team_name,u.display_name reviewed_by_name FROM tournament_join_requests jr LEFT JOIN teams t ON t.id=jr.team_id LEFT JOIN users u ON u.id=jr.reviewed_by WHERE jr.tournament_id=? AND jr.user_id=? ORDER BY jr.id DESC LIMIT 1`).get(tournament.id,req.user.id);
  res.json({tournament,membership,request});
});
app.get('/api/tournaments/:id/my-team',authRequired,(req,res)=>{
  const tournamentId=Number(req.params.id);
  if(!Number.isInteger(tournamentId)||tournamentId<=0)return res.status(400).json({error:'Invalid tournament ID.'});
  const tournament=db.prepare('SELECT id,name,slug,status FROM tournaments WHERE id=?').get(tournamentId);
  if(!tournament)return res.status(404).json({error:'Tournament not found.'});
  const team=db.prepare(`SELECT t.id,t.name,t.tag,t.seed,t.team_status,tm.member_role,tm.is_captain
    FROM team_members tm JOIN teams t ON t.id=tm.team_id
    WHERE t.tournament_id=? AND tm.user_id=? AND tm.membership_status='active'
      AND t.team_status NOT IN ('withdrawn','disqualified')
    ORDER BY tm.is_captain DESC,tm.id LIMIT 1`).get(tournamentId,req.user.id);
  if(!team)return res.status(404).json({error:'No team is assigned to this account for the tournament.'});
  res.json({tournament,team:{
    id:team.id,name:team.name,tag:team.tag,seed:team.seed,teamStatus:team.team_status,
    myRole:team.member_role,isCaptain:Boolean(team.is_captain),
  }});
});
app.post('/api/tournaments/:slug/join-requests',authRequired,emailVerifiedRequired,(req,res)=>{
  try{
    const tournament=db.prepare(`SELECT * FROM tournaments WHERE slug=? AND is_public=1`).get(req.params.slug);
    if(!tournament)return res.status(404).json({error:'Tournament not found.'});
    if(!tournamentAllowsJoin(tournament))return res.status(409).json({error:'This tournament is no longer accepting account-link requests.'});
    if(tournament.roster_lock_at&&Date.parse(tournament.roster_lock_at)<=Date.now())return res.status(409).json({error:'The tournament roster is already locked.'});
    const eligibility=tournamentEligibility(req.user.id,tournament);
    if(!eligibility.eligible)return res.status(403).json({error:'Complete the required account and tournament profile verification before joining.',eligibility});
    const requiredProfile=eligibility.profile;
    const membership=existingTournamentMembership(req.user.id,tournament.id);
    if(membership)return res.status(409).json({error:`This account is already linked to ${membership.team_name}.`});
    const pending=db.prepare(`SELECT id FROM tournament_join_requests WHERE tournament_id=? AND user_id=? AND status='pending'`).get(tournament.id,req.user.id);
    if(pending)return res.status(409).json({error:'You already have a pending request for this tournament.'});
    const approved=db.prepare(`SELECT id FROM tournament_join_requests WHERE tournament_id=? AND user_id=? AND status='approved'`).get(tournament.id,req.user.id);
    if(approved)return res.status(409).json({error:'This account has already been approved for this tournament.'});
    const requestedRole=String(req.body.requestedRole||'player');
    if(!['player','captain','substitute','coach'].includes(requestedRole))return res.status(400).json({error:'Choose a valid tournament role.'});
    const soloSignup=req.body.soloSignup===true;
    if(tournament.registration_mode==='solo_pool_only'&&!soloSignup)return res.status(400).json({error:'This tournament accepts Solo Pool registrations only.'});
    if(soloSignup&&!['player','captain'].includes(requestedRole))return res.status(400).json({error:'Solo signups may register as a player or self-nominated Captain.'});
    const teamId=req.body.teamId?Number(req.body.teamId):null;
    const selectedMemberId=req.body.memberId?Number(req.body.memberId):null;
    const requestedTeamName=String(req.body.requestedTeamName||'').trim().slice(0,160);
    const gamerTag=String(req.body.gamerTag||'').trim().slice(0,80);
    const message=String(req.body.message||'').trim().slice(0,1000);
    let team=null,member=null;
    if(soloSignup&&(teamId||selectedMemberId||requestedTeamName))return res.status(400).json({error:'A solo signup cannot also select or request a formed team.'});
    if(teamId){team=db.prepare(`SELECT * FROM teams WHERE id=? AND tournament_id=? AND team_status NOT IN ('withdrawn','disqualified') AND COALESCE(formation_source,'')!='solo_randomizer'`).get(teamId,tournament.id);if(!team)return res.status(400).json({error:'Choose a valid team from this tournament.'});}
    if(selectedMemberId){
      member=db.prepare(`SELECT tm.* FROM team_members tm JOIN teams t ON t.id=tm.team_id WHERE tm.id=? AND t.tournament_id=?`).get(selectedMemberId,tournament.id);
      if(!member)return res.status(400).json({error:'The selected roster slot was not found.'});
      if(teamId&&Number(member.team_id)!==teamId)return res.status(400).json({error:'The roster slot does not belong to the selected team.'});
      if(member.user_id)return res.status(409).json({error:'That roster slot is already linked to another account.'});
      if(String(tournament.source_platform)==='startgg'&&member.external_provider==='startgg'){
        const comparableId=Boolean(member.external_user_id&&requiredProfile?.providerUserId);
        const comparableSlug=Boolean(member.external_profile_slug&&requiredProfile?.providerSlug);
        const idMatches=comparableId&&String(member.external_user_id)===String(requiredProfile.providerUserId);
        const slugMatches=comparableSlug&&String(member.external_profile_slug).toLowerCase()===String(requiredProfile.providerSlug).toLowerCase();
        if((member.external_user_id||member.external_profile_slug)&&!idMatches&&!slugMatches)return res.status(403).json({error:'The selected start.gg roster slot belongs to a different start.gg profile.'});
      }
    }
    if(!soloSignup&&!teamId&&!requestedTeamName)return res.status(400).json({error:'Choose your team, enter its external name, or select solo signup.'});
    if(!selectedMemberId&&!gamerTag)return res.status(400).json({error:'Enter the gamer tag used on the external tournament page.'});
    if(requestedRole==='captain'&&team?.captain_user_id)return res.status(409).json({error:'This team already has a linked Captain. Ask the Host to transfer Captain access.'});
    const snapshot=profileSnapshot(requiredProfile);
    const result=db.prepare(`INSERT INTO tournament_join_requests(
      tournament_id,team_id,selected_member_id,user_id,requested_role,requested_team_name,gamer_tag,message,external_profile_id,provider_snapshot_json
    ) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
      tournament.id,teamId,selectedMemberId,req.user.id,requestedRole,requestedTeamName,gamerTag,message,
      requiredProfile?.id||null,JSON.stringify(snapshot||{})
    );
    logAction({tournamentId:tournament.id,userId:req.user.id,action:'join.requested',details:{requestId:Number(result.lastInsertRowid),teamId,selectedMemberId,requestedRole,requestedTeamName,gamerTag,soloSignup}});
    res.status(201).json({request:db.prepare('SELECT * FROM tournament_join_requests WHERE id=?').get(Number(result.lastInsertRowid))});
  }catch(error){if(/UNIQUE constraint/i.test(error.message))return res.status(409).json({error:'You already have a pending request for this tournament.'});res.status(400).json({error:clientErrorMessage(error)});}
});
app.delete('/api/tournaments/:slug/join-requests/current',authRequired,(req,res)=>{
  const tournament=db.prepare(`SELECT id FROM tournaments WHERE slug=? AND is_public=1`).get(req.params.slug);if(!tournament)return res.status(404).json({error:'Tournament not found.'});
  const request=db.prepare(`SELECT * FROM tournament_join_requests WHERE tournament_id=? AND user_id=? AND status='pending' ORDER BY id DESC LIMIT 1`).get(tournament.id,req.user.id);if(!request)return res.status(404).json({error:'No pending request was found.'});
  db.prepare(`UPDATE tournament_join_requests SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(request.id);logAction({tournamentId:tournament.id,userId:req.user.id,action:'join.cancelled',details:{requestId:request.id}});res.json({cancelled:true});
});

// Tournament core
app.get('/api/tournaments',authRequired,(req,res)=>{
  const rows=req.user.role==='admin'?db.prepare("SELECT * FROM tournaments WHERE source_platform!='quick_draft' ORDER BY updated_at DESC").all():db.prepare(`
    SELECT DISTINCT t.* FROM tournaments t
    LEFT JOIN tournament_staff s ON s.tournament_id=t.id
    WHERE t.source_platform!='quick_draft' AND (t.host_user_id=? OR s.user_id=?) ORDER BY t.updated_at DESC`).all(req.user.id,req.user.id);
  res.json({tournaments:rows.map(row=>({...row,...sourceVerificationFields(row),rules:jsonParse(row.rules_json),permissionContext:permissionsForUser(req.user.id,row.id)}))});
});

app.get('/api/broadcast/matches',authRequired,(req,res)=>{
  const tournamentRows=req.user.role==='admin'
    ? db.prepare("SELECT id,name,slug,status,start_at FROM tournaments WHERE source_platform!='quick_draft' ORDER BY updated_at DESC").all()
    : db.prepare(`SELECT DISTINCT t.id,t.name,t.slug,t.status,t.start_at FROM tournaments t
        LEFT JOIN tournament_staff s ON s.tournament_id=t.id
        WHERE t.source_platform!='quick_draft' AND (t.host_user_id=? OR s.user_id=?)
        ORDER BY t.updated_at DESC`).all(req.user.id,req.user.id);
  const visibleStatuses=new Set(['available','checkin_open','ready','drafting','playing','paused','technical_issue']);
  const roomQuery=db.prepare('SELECT room_code,status FROM draft_rooms WHERE match_id=?');
  const matches=[];
  for(const tournament of tournamentRows){
    if(!hasTournamentPermission(req.user.id,tournament.id,'broadcast.control'))continue;
    for(const match of listMatches(tournament.id)){
      if(!match.team_a_id||!match.team_b_id||!visibleStatuses.has(String(match.match_status||'')))continue;
      const room=roomQuery.get(match.id);
      matches.push({
        id:match.id,
        tournamentId:tournament.id,
        tournamentName:tournament.name,
        tournamentSlug:tournament.slug,
        stage:match.stage,
        roundName:match.round_name||`Round ${match.round_no||1}`,
        position:match.position,
        bestOf:match.best_of,
        matchStatus:match.match_status,
        effectiveScheduledAt:match.effective_scheduled_at||match.scheduled_at||tournament.start_at||null,
        teamA:{id:match.team_a_id,name:match.team_a_name||'Team A',tag:match.team_a_tag||'',logoUrl:match.team_a_logo||''},
        teamB:{id:match.team_b_id,name:match.team_b_name||'Team B',tag:match.team_b_tag||'',logoUrl:match.team_b_logo||''},
        draftRoomReady:Boolean(room),
        draftRoomStatus:room?.status||'not_opened',
      });
    }
  }
  matches.sort((a,b)=>{
    const aLive=['drafting','playing','paused','technical_issue'].includes(a.matchStatus)?0:1;
    const bLive=['drafting','playing','paused','technical_issue'].includes(b.matchStatus)?0:1;
    if(aLive!==bLive)return aLive-bLive;
    return String(a.effectiveScheduledAt||'9999').localeCompare(String(b.effectiveScheduledAt||'9999'))||a.id-b.id;
  });
  res.json({matches});
});
app.post('/api/tournaments',authRequired,emailVerifiedRequired,allowRoles('host','admin'),(req,res)=>{
  try{
    if(req.user.role!=='admin'&&process.env.ALLOW_MANUAL_TOURNAMENT_CREATION!=='true')return res.status(403).json({error:'Public tournament creation requires a start.gg, Tonamel or Challonge link. Use Import Tournament.'});
    const name=String(req.body.name||'').trim();if(!name)return res.status(400).json({error:'Tournament name is required.'});
    let slug=slugify(req.body.slug||name),suffix=2;while(db.prepare('SELECT 1 FROM tournaments WHERE slug=?').get(slug))slug=`${slugify(name)}-${suffix++}`;
    const rules=req.body.rules&&typeof req.body.rules==='object'?req.body.rules:{};
    const requestedDiscordUrl=String(req.body.discordUrl||'').trim();
    const discordUrl=normalizeDiscordInviteUrl(requestedDiscordUrl);
    if(requestedDiscordUrl&&!discordUrl)return res.status(400).json({error:'Discord invite must be a valid discord.gg or discord.com/invite HTTPS link.'});
    const result=db.prepare(`INSERT INTO tournaments(host_user_id,name,slug,description,discord_url,startgg_url,startgg_slug,status,timezone,default_server,start_at,schedule_mode,is_public,rules_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(req.user.id,name,slug,String(req.body.description||''),discordUrl,req.body.startggUrl||null,req.body.startggUrl?extractTournamentSlug(req.body.startggUrl):null,String(req.body.status||'preparing'),String(req.body.timezone||'Asia/Ho_Chi_Minh'),String(req.body.defaultServer||'Asia'),req.body.startAt||null,'fixed_tournament_start',0,JSON.stringify(rules));
    const tournament=db.prepare('SELECT * FROM tournaments WHERE id=?').get(Number(result.lastInsertRowid));logAction({tournamentId:tournament.id,userId:req.user.id,action:'tournament.created',details:{name}});res.status(201).json({tournament:{...tournament,rules}});
  }catch(error){res.status(400).json({error:clientErrorMessage(error)});}
});
app.get('/api/tournaments/:id',authRequired,requireTournamentPermission('match.read'),(req,res)=>{
  const tournament=db.prepare('SELECT * FROM tournaments WHERE id=?').get(req.tournamentId);if(!tournament)return res.status(404).json({error:'Tournament not found.'});
  const canManageStaff=req.permissionContext?.permissions?.includes('*')||req.permissionContext?.permissions?.includes('tournament.manage');
  const teams=db.prepare(`SELECT t.*,u.username captain_username,u.display_name captain_display_name${canManageStaff?',u.email captain_email':''} FROM teams t LEFT JOIN users u ON u.id=t.captain_user_id WHERE t.tournament_id=? ORDER BY CASE WHEN t.seed IS NULL THEN 1 ELSE 0 END,t.seed,t.name`).all(req.tournamentId);
  const members=db.prepare(`SELECT tm.* FROM team_members tm JOIN teams t ON t.id=tm.team_id WHERE t.tournament_id=? ORDER BY tm.team_id,tm.is_captain DESC,tm.id`).all(req.tournamentId);
  const grouped=new Map(teams.map(team=>[team.id,{...team,members:[]}])) ;members.forEach(member=>grouped.get(member.team_id)?.members.push(member));
  const matches=listMatches(req.tournamentId).map(match=>serializeTournamentMatchForUser(match,req.permissionContext));
  const staff=db.prepare(`SELECT s.tournament_id,s.user_id,s.role,s.permissions_json,u.username,u.email,u.display_name FROM tournament_staff s JOIN users u ON u.id=s.user_id WHERE s.tournament_id=? ORDER BY s.role,u.display_name`).all(req.tournamentId).map(item=>({tournament_id:item.tournament_id,user_id:item.user_id,role:item.role,username:item.username,display_name:item.display_name,...(canManageStaff?{email:item.email}:{}),permissions:jsonParse(item.permissions_json,[])}));
  const unreadRows=db.prepare(`SELECT m.id match_id,MAX(0,COUNT(mm.id)-COALESCE((SELECT COUNT(*) FROM match_messages old WHERE old.match_id=m.id AND old.id<=COALESCE(r.last_message_id,0)),0)) unread_count FROM matches m LEFT JOIN match_messages mm ON mm.match_id=m.id AND mm.deleted_at IS NULL LEFT JOIN match_message_reads r ON r.match_id=m.id AND r.user_id=? WHERE m.tournament_id=? GROUP BY m.id`).all(req.user.id,req.tournamentId);
  const unread=new Map(unreadRows.map(row=>[row.match_id,row.unread_count]));
  const canReviewJoins=hasTournamentPermission(req.user.id,req.tournamentId,'team.edit');
  const joinRequests=canReviewJoins?db.prepare(`SELECT jr.*,u.username,u.email,u.display_name,t.name team_name,tm.display_name selected_member_name,tm.gamer_tag selected_member_tag FROM tournament_join_requests jr JOIN users u ON u.id=jr.user_id LEFT JOIN teams t ON t.id=jr.team_id LEFT JOIN team_members tm ON tm.id=jr.selected_member_id WHERE jr.tournament_id=? ORDER BY CASE jr.status WHEN 'pending' THEN 0 ELSE 1 END,jr.id DESC LIMIT 300`).all(req.tournamentId):[];
  res.json({tournament:{...tournament,...sourceVerificationFields(tournament),rules:jsonParse(tournament.rules_json)},teams:[...grouped.values()],matches:matches.map(match=>({...match,unread_count:unread.get(match.id)||0})),groupStandings:calculateGroupStandings(req.tournamentId),permissions:permissionsForUser(req.user.id,req.tournamentId),preflight:preflightTournament(req.tournamentId),bracketSnapshots:listBracketSnapshots(req.tournamentId),staff,joinRequests,mockToolsAvailable:process.env.NODE_ENV!=='production'});
});
app.post('/api/tournaments/:id/verify-source',authRequired,requireTournamentPermission('tournament.manage'),(req,res)=>{const current=db.prepare('SELECT * FROM tournaments WHERE id=?').get(req.tournamentId);if(!current)return res.status(404).json({error:'Tournament not found.'});if(!current.source_url)return res.status(400).json({error:'This tournament does not have an external source to verify.'});const name=req.body.name===undefined?current.name:String(req.body.name||'').trim().slice(0,160);const description=req.body.description===undefined?current.description:String(req.body.description||'').trim().slice(0,1000);if(!name)return res.status(400).json({error:'Tournament name is required.'});db.prepare(`UPDATE tournaments SET name=?,description=?,source_sync_status='host_confirmed',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(name,description,req.tournamentId);const tournament=db.prepare('SELECT * FROM tournaments WHERE id=?').get(req.tournamentId);logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'tournament.source_verified',details:{previousStatus:current.source_sync_status,sourceUrl:current.source_url,nameChanged:name!==current.name,descriptionChanged:description!==current.description}});res.json({tournament:{...tournament,...sourceVerificationFields(tournament),rules:jsonParse(tournament.rules_json)},requiresVerification:false});});
app.patch('/api/tournaments/:id',authRequired,requireTournamentPermission('tournament.manage'),(req,res)=>{
  const current=db.prepare('SELECT * FROM tournaments WHERE id=?').get(req.tournamentId);if(!current)return res.status(404).json({error:'Tournament not found.'});
  const rules=req.body.rules??jsonParse(current.rules_json);const status=req.body.status??current.status;
  let registrationMode;try{registrationMode=normalizeRegistrationMode(req.body.registrationMode??current.registration_mode);}catch(error){return res.status(400).json({error:clientErrorMessage(error)});}
  const finalizedAt=status==='completed'&&!current.finalized_at?new Date().toISOString():current.finalized_at;
  if(req.body.publicStreamUrl!==undefined&&!isSafeExternalUrl(req.body.publicStreamUrl))return res.status(400).json({error:isProduction?'Stream URL must use HTTPS.':'Stream URL must use HTTP or HTTPS.'});
  const requestedDiscordUrl=req.body.discordUrl===undefined?current.discord_url:String(req.body.discordUrl||'').trim();
  const discordUrl=normalizeDiscordInviteUrl(requestedDiscordUrl);
  if(requestedDiscordUrl&&!discordUrl)return res.status(400).json({error:'Discord invite must be a valid discord.gg or discord.com/invite HTTPS link.'});
  const isPublic=req.body.isPublic===undefined?Number(current.is_public):(req.body.isPublic?1:0);
  db.prepare(`UPDATE tournaments SET name=?,description=?,discord_url=?,status=?,timezone=?,default_server=?,start_at=?,schedule_mode=?,registration_mode=?,roster_lock_at=?,finalized_at=?,result_reopen_hours=?,evidence_retention_days=?,chat_retention_days=?,public_stream_platform=?,public_stream_url=?,public_stream_label=?,is_public=?,rules_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(sanitizeText(req.body.name??current.name,160),sanitizeText(req.body.description??current.description,2000),discordUrl,status,sanitizeText(req.body.timezone??current.timezone,80),sanitizeText(req.body.defaultServer??current.default_server,80),req.body.startAt===undefined?current.start_at:(req.body.startAt||null),req.body.scheduleMode??current.schedule_mode,registrationMode,req.body.rosterLockAt===undefined?current.roster_lock_at:(req.body.rosterLockAt||null),finalizedAt,Number(req.body.resultReopenHours??current.result_reopen_hours),Number(req.body.evidenceRetentionDays??current.evidence_retention_days),Number(req.body.chatRetentionDays??current.chat_retention_days),sanitizeText(req.body.publicStreamPlatform??current.public_stream_platform,40),String(req.body.publicStreamUrl??current.public_stream_url).trim(),sanitizeText(req.body.publicStreamLabel??current.public_stream_label,100),isPublic,JSON.stringify(rules),req.tournamentId);
  if(finalizedAt)refreshTournamentRetention(req.tournamentId);logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'tournament.updated',details:req.body});res.json({tournament:db.prepare('SELECT * FROM tournaments WHERE id=?').get(req.tournamentId)});
});
app.post('/api/tournaments/:id/publish',authRequired,requireTournamentPermission('tournament.manage'),(req,res)=>{
  const tournament=db.prepare('SELECT * FROM tournaments WHERE id=?').get(req.tournamentId);
  if(!tournament)return res.status(404).json({error:'Tournament not found.'});
  db.prepare('UPDATE tournaments SET is_public=1,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.tournamentId);
  logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'tournament.published',details:{confirmed:Boolean(req.body?.confirm)}});
  res.json({tournament:db.prepare('SELECT * FROM tournaments WHERE id=?').get(req.tournamentId)});
});
app.post('/api/tournaments/:id/unpublish',authRequired,requireTournamentPermission('tournament.manage'),(req,res)=>{
  const tournament=db.prepare('SELECT * FROM tournaments WHERE id=?').get(req.tournamentId);
  if(!tournament)return res.status(404).json({error:'Tournament not found.'});
  db.prepare('UPDATE tournaments SET is_public=0,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(req.tournamentId);
  logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'tournament.unpublished'});
  res.json({tournament:db.prepare('SELECT * FROM tournaments WHERE id=?').get(req.tournamentId)});
});
app.get('/api/tournaments/:id/preflight',authRequired,requireTournamentPermission('bracket.generate'),(req,res)=>res.json(preflightTournament(req.tournamentId)));
app.post('/api/tournaments/:id/start',authRequired,emailVerifiedRequired,requireTournamentPermission('tournament.manage'),(req,res)=>{
  const check=preflightTournament(req.tournamentId);
  if(!check.ok)return res.status(409).json({error:'Tournament preflight must pass before starting.',preflight:check});
  const matchCount=Number(db.prepare('SELECT COUNT(*) count FROM matches WHERE tournament_id=?').get(req.tournamentId)?.count||0);
  if(!matchCount)return res.status(409).json({error:'Generate the bracket before starting the tournament.'});
  let openedCheckinCount=0;
  transaction(()=>{
    db.prepare(`UPDATE tournaments SET status='ongoing',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(req.tournamentId);
    openedCheckinCount=Number(db.prepare(`UPDATE matches SET status='checkin_open',match_status='checkin_open',updated_at=CURRENT_TIMESTAMP
      WHERE tournament_id=? AND team_a_id IS NOT NULL AND team_b_id IS NOT NULL AND result_status!='final' AND match_status='available'`).run(req.tournamentId).changes||0);
    logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'tournament.started',details:{matchCount}});
  });
  const matches=listMatches(req.tournamentId);emitBracketUpdated(req.tournamentId,matches);
  res.json({tournament:db.prepare('SELECT * FROM tournaments WHERE id=?').get(req.tournamentId),matches,openedCheckinCount});
});
app.get('/api/tournaments/:id/audit',authRequired,requireTournamentPermission('tournament.manage'),(req,res)=>{
  const logs=db.prepare(`SELECT a.*,u.display_name user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE a.tournament_id=? ORDER BY a.id DESC LIMIT 300`).all(req.tournamentId).map(row=>({...row,details:jsonParse(row.details_json)}));res.json({logs});
});
app.get('/api/tournaments/:id/staff',authRequired,requireTournamentPermission('tournament.manage'),(req,res)=>{const staff=db.prepare(`SELECT s.*,u.username,u.email,u.display_name FROM tournament_staff s JOIN users u ON u.id=s.user_id WHERE s.tournament_id=? ORDER BY s.role,u.display_name`).all(req.tournamentId).map(item=>({...item,permissions:jsonParse(item.permissions_json,[])}));res.json({staff});});
app.post('/api/tournaments/:id/staff',authRequired,requireTournamentPermission('tournament.manage'),(req,res)=>{const identity=String(req.body.identity||'').trim();const role=String(req.body.role||'');if(!['host','referee','scheduler','scorekeeper','broadcaster'].includes(role))return res.status(400).json({error:'Invalid staff role.'});const user=db.prepare(`SELECT * FROM users WHERE is_active=1 AND username=? COLLATE NOCASE`).get(identity);if(!user)return res.status(404).json({error:'Staff account not found. Ask the person to register a username first.'});const permissions=Array.isArray(req.body.permissions)?req.body.permissions:[];db.prepare(`INSERT INTO tournament_staff(tournament_id,user_id,role,permissions_json) VALUES (?,?,?,?) ON CONFLICT(tournament_id,user_id,role) DO UPDATE SET permissions_json=excluded.permissions_json`).run(req.tournamentId,user.id,role,JSON.stringify(permissions));logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'staff.assigned',details:{staffUserId:user.id,role,permissions}});res.status(201).json({staff:{userId:user.id,displayName:user.display_name,username:user.username,role,permissions}});});
app.delete('/api/tournaments/:id/staff/:userId/:role',authRequired,requireTournamentPermission('tournament.manage'),(req,res)=>{db.prepare('DELETE FROM tournament_staff WHERE tournament_id=? AND user_id=? AND role=?').run(req.tournamentId,Number(req.params.userId),String(req.params.role));logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'staff.removed',details:{staffUserId:Number(req.params.userId),role:req.params.role}});res.json({removed:true});});

// start.gg import
app.post('/api/tournaments/:id/import-startgg',authRequired,emailVerifiedRequired,requireTournamentPermission('team.create'),async(req,res)=>{
  try{
    const url=req.body.url||db.prepare('SELECT startgg_url FROM tournaments WHERE id=?').get(req.tournamentId)?.startgg_url;const imported=await importTournament(url);const selected=req.body.eventId?String(req.body.eventId):null;const events=selected?imported.events.filter(event=>String(event.id)===selected):imported.events;let teamCount=0,memberCount=0;
    transaction(()=>{db.prepare(`UPDATE tournaments SET name=?,startgg_url=?,startgg_slug=?,startgg_tournament_id=?,source_platform='startgg',source_url=?,source_external_id=?,source_sync_status='api_verified',source_last_synced_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(imported.name,url,imported.slug,String(imported.id),url,imported.slug,req.tournamentId);
      for(const event of events)for(const entrant of event.entrants?.nodes||[]){const existing=db.prepare('SELECT * FROM teams WHERE tournament_id=? AND startgg_entrant_id=?').get(req.tournamentId,String(entrant.id));let teamId;if(existing){teamId=existing.id;db.prepare("UPDATE teams SET name=?,source='startgg',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(entrant.name,teamId);db.prepare('DELETE FROM team_members WHERE team_id=? AND startgg_participant_id IS NOT NULL AND user_id IS NULL').run(teamId);}else{const result=db.prepare(`INSERT INTO teams(tournament_id,name,tag,startgg_entrant_id,source,status,team_status) VALUES (?,?,?,?,'startgg','pending','captain_pending')`).run(req.tournamentId,entrant.name,makeTeamTag(entrant.name),String(entrant.id));teamId=Number(result.lastInsertRowid);teamCount++;}
        (entrant.participants||[]).forEach(participant=>{
          const profileSlug=String(participant.user?.slug||'').replace(/^user\//,'');
          const participantId=String(participant.id);const preserved=db.prepare('SELECT id FROM team_members WHERE team_id=? AND startgg_participant_id=?').get(teamId,participantId);
          if(preserved)db.prepare(`UPDATE team_members SET display_name=?,gamer_tag=?,external_provider='startgg',external_user_id=?,external_profile_slug=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
            participant.gamerTag||profileSlug||'Player',participant.gamerTag||'',participant.user?.id?String(participant.user.id):'',profileSlug,preserved.id
          );
          else db.prepare(`INSERT INTO team_members(
            team_id,display_name,gamer_tag,startgg_participant_id,external_provider,external_user_id,external_profile_slug,is_captain
          ) VALUES (?,?,?,?,'startgg',?,?,0)`).run(
            teamId,participant.gamerTag||profileSlug||'Player',participant.gamerTag||'',participantId,
            participant.user?.id?String(participant.user.id):'',profileSlug
          );
          memberCount++;
        });
        if(existing?.captain_user_id){const captain=db.prepare('SELECT * FROM users WHERE id=? AND is_active=1').get(existing.captain_user_id);if(captain)syncTeamCaptain(teamId,captain);}
      }}
    );logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'startgg.imported',details:{slug:imported.slug}});res.json({imported:{id:imported.id,name:imported.name,slug:imported.slug,events:imported.events.map(event=>({id:event.id,name:event.name,numEntrants:event.numEntrants}))},teamCount,memberCount});
  }catch(error){res.status(400).json({error:clientErrorMessage(error)});}
});

// Teams, captain accounts and roster
app.post('/api/tournaments/:id/teams',authRequired,requireTournamentPermission('team.create'),(req,res)=>{
  const name=String(req.body.name||'').trim();if(!name)return res.status(400).json({error:'Team name is required.'});const tag=String(req.body.tag||'').trim()||makeTeamTag(name);
  const result=db.prepare(`INSERT INTO teams(tournament_id,name,tag,logo_url,source,status,team_status,region) VALUES (?,?,?,?, 'manual','pending','captain_pending',?)`).run(req.tournamentId,name,tag,String(req.body.logoUrl||''),String(req.body.region||''));
  const team=db.prepare('SELECT * FROM teams WHERE id=?').get(Number(result.lastInsertRowid));logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'team.created',details:{teamId:team.id,name}});res.status(201).json({team});
});
app.patch('/api/tournaments/:id/teams/:teamId',authRequired,requireTournamentPermission('team.edit'),(req,res)=>{
  const team=db.prepare('SELECT * FROM teams WHERE id=? AND tournament_id=?').get(Number(req.params.teamId),req.tournamentId);if(!team)return res.status(404).json({error:'Team not found.'});
  const nextName=String(req.body.name??team.name).trim()||team.name;const requestedTag=req.body.tag===undefined?team.tag:String(req.body.tag||'').trim();const nextTag=requestedTag||makeTeamTag(nextName);
  const nextSeed=req.body.seed===''||req.body.seed==null?team.seed:Number(req.body.seed);
  try{assertLockedSeedMutationAllowed(req.user,team,nextSeed);}catch(error){return res.status(error.code==='LOCKED_SEED'?409:400).json({error:clientErrorMessage(error)});}
  let nextStatus=req.body.teamStatus??team.team_status;if(nextStatus==='ready'&&!team.captain_user_id)return res.status(400).json({error:'A team cannot be Ready until a Captain account is linked.'});
  db.prepare(`UPDATE teams SET name=?,tag=?,logo_url=?,seed=?,seed_locked=?,protected_seed_group=?,region=?,seeding_note=?,team_status=?,status=?,roster_locked_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(nextName,nextTag,req.body.logoUrl??team.logo_url,nextSeed,req.body.seedLocked===undefined?team.seed_locked:(req.body.seedLocked?1:0),req.body.protectedSeedGroup??team.protected_seed_group,req.body.region??team.region,req.body.seedingNote??team.seeding_note,nextStatus,nextStatus==='ready'?'approved':team.status,req.body.rosterLockedAt===undefined?team.roster_locked_at:(req.body.rosterLockedAt||null),team.id);
  res.json({team:db.prepare('SELECT * FROM teams WHERE id=?').get(team.id)});
});
app.post('/api/tournaments/:id/teams/:teamId/members',authRequired,requireTournamentPermission('team.edit'),(req,res)=>{
  const team=db.prepare('SELECT * FROM teams WHERE id=? AND tournament_id=?').get(Number(req.params.teamId),req.tournamentId);if(!team)return res.status(404).json({error:'Team not found.'});
  const effectiveLock=team.roster_locked_at||db.prepare('SELECT roster_lock_at FROM tournaments WHERE id=?').get(req.tournamentId)?.roster_lock_at;if(effectiveLock&&Date.parse(effectiveLock)<=Date.now())return res.status(409).json({error:'Roster is locked. Use an administrative override instead.'});
  const displayName=String(req.body.displayName||'').trim();if(!displayName)return res.status(400).json({error:'Member name is required.'});
  const result=db.prepare(`INSERT INTO team_members(team_id,user_id,display_name,gamer_tag,game_id,member_role,is_captain,is_substitute) VALUES (?,?,?,?,?,?,?,?)`).run(team.id,req.body.userId||null,displayName,String(req.body.gamerTag||''),String(req.body.gameId||''),String(req.body.memberRole||'player'),0,req.body.isSubstitute?1:0);
  res.status(201).json({member:db.prepare('SELECT * FROM team_members WHERE id=?').get(Number(result.lastInsertRowid))});
});
app.patch('/api/tournaments/:id/teams/:teamId/members/:memberId',authRequired,requireTournamentPermission('team.edit'),(req,res)=>{
  const team=db.prepare('SELECT * FROM teams WHERE id=? AND tournament_id=?').get(Number(req.params.teamId),req.tournamentId);if(!team)return res.status(404).json({error:'Team not found.'});
  const member=db.prepare('SELECT * FROM team_members WHERE id=? AND team_id=?').get(Number(req.params.memberId),team.id);if(!member)return res.status(404).json({error:'Roster member not found.'});
  const effectiveLock=team.roster_locked_at||db.prepare('SELECT roster_lock_at FROM tournaments WHERE id=?').get(req.tournamentId)?.roster_lock_at;if(effectiveLock&&Date.parse(effectiveLock)<=Date.now())return res.status(409).json({error:'Roster is locked. Use an administrative override instead.'});
  const displayName=String(req.body.displayName??member.display_name).trim();if(!displayName)return res.status(400).json({error:'Member name is required.'});
  const role=member.is_captain?'captain':String(req.body.memberRole ?? member.member_role ?? 'player');const isSubstitute=member.is_captain?0:(req.body.isSubstitute?1:0);
  db.prepare(`UPDATE team_members SET display_name=?,gamer_tag=?,game_id=?,member_role=?,is_substitute=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(displayName,String(req.body.gamerTag ?? member.gamer_tag ?? ''),String(req.body.gameId ?? member.game_id ?? ''),role,isSubstitute,member.id);
  logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'team.member_updated',details:{teamId:team.id,memberId:member.id}});res.json({member:db.prepare('SELECT * FROM team_members WHERE id=?').get(member.id)});
});
app.delete('/api/tournaments/:id/teams/:teamId/members/:memberId',authRequired,requireTournamentPermission('team.edit'),(req,res)=>{
  const team=db.prepare('SELECT * FROM teams WHERE id=? AND tournament_id=?').get(Number(req.params.teamId),req.tournamentId);if(!team)return res.status(404).json({error:'Team not found.'});
  const member=db.prepare('SELECT * FROM team_members WHERE id=? AND team_id=?').get(Number(req.params.memberId),team.id);if(!member)return res.status(404).json({error:'Roster member not found.'});if(member.is_captain||(team.captain_user_id&&member.user_id&&Number(member.user_id)===Number(team.captain_user_id)))return res.status(409).json({error:'Transfer the Captain role before removing this member.'});
  const effectiveLock=team.roster_locked_at||db.prepare('SELECT roster_lock_at FROM tournaments WHERE id=?').get(req.tournamentId)?.roster_lock_at;if(effectiveLock&&Date.parse(effectiveLock)<=Date.now())return res.status(409).json({error:'Roster is locked. Use an administrative override instead.'});
  db.prepare('DELETE FROM team_members WHERE id=?').run(member.id);logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'team.member_removed',details:{teamId:team.id,memberId:member.id,displayName:member.display_name}});res.json({deleted:true});
});
app.post('/api/portal/teams/:teamId/invitations',authRequired,emailVerifiedRequired,(req,res)=>{
  try{
    const team=assertCaptainRosterAccess(req.user.id,req.params.teamId);
    const identity=String(req.body.identity||'').trim();
    const role=['player','substitute','coach'].includes(String(req.body.role||''))?String(req.body.role):'player';
    if(!identity)return res.status(400).json({error:'Enter the member username to invite.'});
    const user=db.prepare(`SELECT * FROM users WHERE is_active=1 AND username=? COLLATE NOCASE`).get(identity);
    if(!user)return res.status(404).json({error:'Member account not found. Ask the player to register a username first.'});
    if(Number(user.id)===Number(req.user.id))return res.status(400).json({error:'The Captain is already linked to this team.'});
    const membership=existingTournamentMembership(user.id,team.tournament_id);
    if(membership)return res.status(409).json({error:`This account is already linked to ${membership.team_name}.`});
    db.prepare(`UPDATE team_invitations SET status='cancelled' WHERE team_id=? AND invited_user_id=? AND status='pending'`).run(team.id,user.id);
    const raw=randomCode(48);const hash=crypto.createHash('sha256').update(raw).digest('hex');const expires=new Date(Date.now()+7*86400000).toISOString();
    db.prepare(`INSERT INTO team_invitations(tournament_id,team_id,invited_user_id,email,role,token_hash,status,expires_at,created_by) VALUES (?,?,?,'',?,?,'pending',?,?)`)
      .run(team.tournament_id,team.id,user.id,role,hash,expires,req.user.id);
    const inviteLink=`${req.protocol}://${req.get('host')}/portal.html?invite=${encodeURIComponent(raw)}`;
    logAction({tournamentId:team.tournament_id,userId:req.user.id,action:'team.member_invited',details:{teamId:team.id,invitedUserId:user.id,role}});
    res.status(201).json({inviteLink,expiresAt:expires,user:{id:user.id,username:user.username,displayName:user.display_name},role});
  }catch(error){res.status(error.status||400).json({error:clientErrorMessage(error)});}
});
app.delete('/api/portal/teams/:teamId/members/:memberId',authRequired,emailVerifiedRequired,(req,res)=>{
  try{
    const team=assertCaptainRosterAccess(req.user.id,req.params.teamId);
    const member=db.prepare('SELECT * FROM team_members WHERE id=? AND team_id=?').get(Number(req.params.memberId),team.id);
    if(!member)return res.status(404).json({error:'Roster member not found.'});
    if(member.is_captain||(team.captain_user_id&&Number(member.user_id)===Number(team.captain_user_id)))return res.status(409).json({error:'The Captain cannot remove their own roster entry.'});
    db.prepare('DELETE FROM team_members WHERE id=?').run(member.id);
    logAction({tournamentId:team.tournament_id,userId:req.user.id,action:'team.member_removed_by_captain',details:{teamId:team.id,memberId:member.id,removedUserId:member.user_id||null}});
    res.json({deleted:true});
  }catch(error){res.status(error.status||400).json({error:clientErrorMessage(error)});}
});
app.post('/api/portal/teams/:teamId/captain/transfer',authRequired,emailVerifiedRequired,(req,res)=>{
  try{
    const team=assertCaptainRosterAccess(req.user.id,req.params.teamId);
    const effectiveLock=team.roster_locked_at||db.prepare('SELECT roster_lock_at FROM tournaments WHERE id=?').get(team.tournament_id)?.roster_lock_at;
    if(effectiveLock&&Date.parse(effectiveLock)<=Date.now())return res.status(409).json({error:'Roster is locked. Ask the Host to transfer Captain access.'});
    const member=db.prepare(`SELECT tm.*,u.id user_id,u.username,u.display_name,u.gamer_tag
      FROM team_members tm JOIN users u ON u.id=tm.user_id
      WHERE tm.id=? AND tm.team_id=? AND tm.membership_status='active'`).get(Number(req.body.memberId),team.id);
    if(!member)return res.status(404).json({error:'Choose an active roster member with a linked account.'});
    if(Number(member.user_id)===Number(req.user.id))return res.status(400).json({error:'This player is already the Captain.'});
    transaction(()=>syncTeamCaptain(team.id,member,{gamerTag:member.gamer_tag}));
    logAction({tournamentId:team.tournament_id,userId:req.user.id,action:'team.captain_transferred_by_captain',details:{teamId:team.id,newCaptainUserId:member.user_id}});
    res.json({team:db.prepare('SELECT * FROM teams WHERE id=?').get(team.id),captain:cleanUser(member)});
  }catch(error){res.status(error.status||400).json({error:clientErrorMessage(error)});}
});
app.post('/api/tournaments/:id/teams/:teamId/captain/assign',authRequired,requireTournamentPermission('team.transfer_captain'),(req,res)=>{
  const team=db.prepare('SELECT * FROM teams WHERE id=? AND tournament_id=?').get(Number(req.params.teamId),req.tournamentId);if(!team)return res.status(404).json({error:'Team not found.'});
  const identity=String(req.body.identity||'').trim();const user=db.prepare(`SELECT * FROM users WHERE is_active=1 AND username=? COLLATE NOCASE`).get(identity);if(!user)return res.status(404).json({error:'Captain account not found. Ask the Captain to register a username first.'});
  transaction(()=>syncTeamCaptain(team.id,user));
  logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'team.captain_assigned',details:{teamId:team.id,captainUserId:user.id}});res.json({team:db.prepare('SELECT * FROM teams WHERE id=?').get(team.id),captain:cleanUser(user)});
});
app.post('/api/tournaments/:id/teams/:teamId/captain/transfer',authRequired,requireTournamentPermission('team.transfer_captain'),(req,res)=>{
  try{
    const team=db.prepare('SELECT * FROM teams WHERE id=? AND tournament_id=?').get(Number(req.params.teamId),req.tournamentId);
    if(!team)return res.status(404).json({error:'Team not found.'});
    const member=db.prepare(`SELECT tm.*,u.id user_id,u.username,u.display_name,u.gamer_tag
      FROM team_members tm JOIN users u ON u.id=tm.user_id
      WHERE tm.id=? AND tm.team_id=? AND tm.membership_status='active'`).get(Number(req.body.memberId),team.id);
    if(!member)return res.status(404).json({error:'Choose an active roster member with a linked account.'});
    if(Number(member.user_id)===Number(team.captain_user_id))return res.status(400).json({error:'This player is already the Captain.'});
    transaction(()=>syncTeamCaptain(team.id,member,{gamerTag:member.gamer_tag}));
    logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'team.captain_transferred_by_host',details:{teamId:team.id,newCaptainUserId:member.user_id}});
    res.json({team:db.prepare('SELECT * FROM teams WHERE id=?').get(team.id),captain:cleanUser(member)});
  }catch(error){res.status(error.status||400).json({error:clientErrorMessage(error)});}
});
app.post('/api/tournaments/:id/teams/:teamId/captain/invite',authRequired,requireTournamentPermission('team.invite_captain'),(req,res)=>{
  const team=db.prepare('SELECT * FROM teams WHERE id=? AND tournament_id=?').get(Number(req.params.teamId),req.tournamentId);if(!team)return res.status(404).json({error:'Team not found.'});const identity=String(req.body.identity||'').trim();
  const user=db.prepare(`SELECT * FROM users WHERE is_active=1 AND username=? COLLATE NOCASE`).get(identity);if(!user)return res.status(400).json({error:'Enter an existing username.'});
  const raw=randomCode(48);const hash=crypto.createHash('sha256').update(raw).digest('hex');const expires=new Date(Date.now()+7*86400000).toISOString();
  db.prepare(`INSERT INTO team_invitations(tournament_id,team_id,invited_user_id,email,role,token_hash,status,expires_at,created_by) VALUES (?,?,?,'', 'captain',?,'pending',?,?)`).run(req.tournamentId,team.id,user.id,hash,expires,req.user.id);
  const base=`${req.protocol}://${req.get('host')}/portal.html?invite=${encodeURIComponent(raw)}`;res.status(201).json({inviteLink:base,expiresAt:expires,user:user?cleanUser(user):null});
});
app.post('/api/team-invitations/accept',authRequired,emailVerifiedRequired,(req,res)=>{
  const hash=crypto.createHash('sha256').update(String(req.body.token||'')).digest('hex');const invitation=db.prepare(`SELECT * FROM team_invitations WHERE token_hash=? AND status='pending' AND datetime(expires_at)>datetime('now')`).get(hash);if(!invitation)return res.status(400).json({error:'Invitation is invalid or expired.'});
  if(invitation.invited_user_id&&invitation.invited_user_id!==req.user.id)return res.status(403).json({error:'This invitation belongs to another account.'});if(invitation.email&&invitation.email.toLowerCase()!==req.user.email.toLowerCase())return res.status(403).json({error:'Use the invited email account.'});
  try{
    const team=db.prepare('SELECT * FROM teams WHERE id=? AND tournament_id=?').get(invitation.team_id,invitation.tournament_id);if(!team)throw new Error('Invited team no longer exists.');
    const effectiveLock=team.roster_locked_at||db.prepare('SELECT roster_lock_at FROM tournaments WHERE id=?').get(team.tournament_id)?.roster_lock_at;
    if(effectiveLock&&Date.parse(effectiveLock)<=Date.now())throw new Error('Roster is locked. Ask the Host for help.');
    const existing=existingTournamentMembership(req.user.id,team.tournament_id);
    if(existing&&Number(existing.team_id)!==Number(team.id))throw new Error(`This account is already linked to ${existing.team_name}.`);
    const invitedRole=['player','substitute','coach'].includes(String(invitation.role||''))?String(invitation.role):'captain';
    transaction(()=>{
      db.prepare(`UPDATE team_invitations SET status='accepted',accepted_at=CURRENT_TIMESTAMP,invited_user_id=? WHERE id=?`).run(req.user.id,invitation.id);
      const member=db.prepare('SELECT * FROM team_members WHERE team_id=? AND user_id=?').get(team.id,req.user.id);
      if(invitedRole==='captain'){
        syncTeamCaptain(team.id,req.user,{gamerTag:req.user.gamer_tag||req.user.username});
      }else if(member){
        db.prepare(`UPDATE team_members SET display_name=?,gamer_tag=?,member_role=?,membership_status='active',is_captain=0,is_substitute=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .run(req.user.display_name,req.user.gamer_tag||req.user.username,invitedRole,invitedRole==='substitute'?1:0,member.id);
      }else{
        db.prepare(`INSERT INTO team_members(team_id,user_id,display_name,gamer_tag,member_role,is_captain,is_substitute) VALUES (?,?,?,?,?,0,?)`)
          .run(team.id,req.user.id,req.user.display_name,req.user.gamer_tag||req.user.username,invitedRole,invitedRole==='substitute'?1:0);
      }
    });
    logAction({tournamentId:team.tournament_id,userId:req.user.id,action:'team.invitation_accepted',details:{teamId:team.id,role:invitedRole}});
    res.json({accepted:true,teamId:team.id,role:invitedRole});
  }catch(error){res.status(error.status||400).json({error:clientErrorMessage(error)});}
});
app.post('/api/tournaments/:id/teams/:teamId/terminal',authRequired,requireTournamentPermission('team.edit'),(req,res)=>{
  try{const team=processTeamTerminalState(Number(req.params.teamId),String(req.body.teamStatus),String(req.body.reason||''),req.user.id);emitBracketUpdated(req.tournamentId);res.json({team,matches:listMatches(req.tournamentId)});}catch(error){res.status(400).json({error:clientErrorMessage(error)});}
});
app.post('/api/tournaments/:id/join-requests/:requestId/review',authRequired,requireTournamentPermission('team.edit'),(req,res)=>{
  try{
    const request=db.prepare(`SELECT jr.*,u.display_name,u.username FROM tournament_join_requests jr JOIN users u ON u.id=jr.user_id WHERE jr.id=? AND jr.tournament_id=?`).get(Number(req.params.requestId),req.tournamentId);
    if(!request)return res.status(404).json({error:'Join request not found.'});
    if(request.status!=='pending')return res.status(409).json({error:'This request has already been reviewed.'});
    const decision=String(req.body.decision||'');const reviewNote=String(req.body.reviewNote||'').trim().slice(0,1000);
    if(!['approve','reject'].includes(decision))return res.status(400).json({error:'Choose approve or reject.'});
    if(decision==='reject'){
      db.prepare(`UPDATE tournament_join_requests SET status='rejected',review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(reviewNote,req.user.id,request.id);
      logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'join.rejected',details:{requestId:request.id,requestUserId:request.user_id,reviewNote}});return res.json({request:db.prepare('SELECT * FROM tournament_join_requests WHERE id=?').get(request.id)});
    }
    if(req.body.soloPool===true){
      if(request.team_id||request.requested_team_name)return res.status(400).json({error:'Only a teamless solo signup can enter the solo randomizer pool.'});
      if(!['player','captain'].includes(request.requested_role))return res.status(400).json({error:'The solo pool accepts players and self-nominated Captains only.'});
      if(existingTournamentMembership(request.user_id,req.tournamentId))return res.status(409).json({error:'This account is already linked to a tournament team.'});
      db.prepare(`UPDATE tournament_join_requests SET team_id=NULL,selected_member_id=NULL,status='approved',review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(reviewNote,req.user.id,request.id);
      logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'join.solo_pool_approved',details:{requestId:request.id,requestUserId:request.user_id,role:request.requested_role}});
      return res.json({request:db.prepare('SELECT * FROM tournament_join_requests WHERE id=?').get(request.id),soloPool:true});
    }
    let teamId=Number(req.body.teamId||request.team_id||0);let team=teamId?db.prepare(`SELECT * FROM teams WHERE id=? AND tournament_id=? AND team_status NOT IN ('withdrawn','disqualified')`).get(teamId,req.tournamentId):null;
    if(!team&&req.body.createTeam){const name=String(request.requested_team_name||'').trim();if(!name)throw new Error('A requested team name is required before creating a team.');const inserted=db.prepare(`INSERT INTO teams(tournament_id,name,tag,source,status,team_status) VALUES (?,?,?,'manual','pending','captain_pending')`).run(req.tournamentId,name,makeTeamTag(name));teamId=Number(inserted.lastInsertRowid);team=db.prepare('SELECT * FROM teams WHERE id=?').get(teamId);}
    if(!team)throw new Error('Select the team that this account should join.');
    const existing=existingTournamentMembership(request.user_id,req.tournamentId);if(existing&&Number(existing.team_id)!==teamId)throw new Error(`This account is already linked to ${existing.team_name}.`);
    const effectiveLock=team.roster_locked_at||db.prepare('SELECT roster_lock_at FROM tournaments WHERE id=?').get(req.tournamentId)?.roster_lock_at;if(effectiveLock&&Date.parse(effectiveLock)<=Date.now())throw new Error('Roster is locked. Unlock it before approving this request.');
    const providerSnapshot=jsonParse(request.provider_snapshot_json,{});
    const tournamentSource=String(db.prepare('SELECT source_platform FROM tournaments WHERE id=?').get(req.tournamentId)?.source_platform||'').toLowerCase();
    const tournamentSourceLabel={startgg:'start.gg',tonamel:'Tonamel',challonge:'Challonge'}[tournamentSource]||tournamentSource;
    const requestProvider=String(providerSnapshot.provider||'').toLowerCase();
    if(tournamentSource&&['startgg','tonamel','challonge'].includes(tournamentSource)&&requestProvider!==tournamentSource){
      throw new Error(`This request does not contain the required ${tournamentSourceLabel} profile snapshot.`);
    }
    let member=null;const memberId=Number(req.body.memberId||((Number(request.team_id)===teamId)?request.selected_member_id:0)||0);
    if(memberId){member=db.prepare('SELECT * FROM team_members WHERE id=? AND team_id=?').get(memberId,teamId);if(!member)throw new Error('The selected roster slot does not belong to this team.');if(member.user_id&&Number(member.user_id)!==Number(request.user_id))throw new Error('That roster slot is already linked to another account.');}
    if(!member&&request.gamer_tag){member=db.prepare(`SELECT * FROM team_members WHERE team_id=? AND user_id IS NULL AND gamer_tag=? COLLATE NOCASE ORDER BY id LIMIT 1`).get(teamId,request.gamer_tag);}
    if(member&&tournamentSource&&['startgg','tonamel','challonge'].includes(tournamentSource)){
      const comparableId=Boolean(member.external_user_id&&providerSnapshot.providerUserId);
      const comparableSlug=Boolean(member.external_profile_slug&&providerSnapshot.providerSlug);
      const idMatches=comparableId&&String(member.external_user_id)===String(providerSnapshot.providerUserId);
      const slugMatches=comparableSlug&&String(member.external_profile_slug).toLowerCase()===String(providerSnapshot.providerSlug).toLowerCase();
      if((member.external_user_id||member.external_profile_slug)&&!idMatches&&!slugMatches)throw new Error(`The selected ${tournamentSourceLabel} roster slot belongs to a different linked ${tournamentSourceLabel} profile.`);
    }
    transaction(()=>{
      if(!member){const inserted=db.prepare(`INSERT INTO team_members(
        team_id,user_id,display_name,gamer_tag,member_role,is_captain,is_substitute,external_provider,external_user_id,external_profile_slug
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
        teamId,request.user_id,request.display_name,request.gamer_tag,request.requested_role,
        request.requested_role==='captain'?1:0,request.requested_role==='substitute'?1:0,
        requestProvider,String(providerSnapshot.providerUserId||''),String(providerSnapshot.providerSlug||'')
      );member=db.prepare('SELECT * FROM team_members WHERE id=?').get(Number(inserted.lastInsertRowid));}
      else db.prepare(`UPDATE team_members SET user_id=?,membership_status='active',member_role=?,is_substitute=?,
        external_provider=CASE WHEN external_provider='' THEN ? ELSE external_provider END,
        external_user_id=CASE WHEN external_user_id='' THEN ? ELSE external_user_id END,
        external_profile_slug=CASE WHEN external_profile_slug='' THEN ? ELSE external_profile_slug END,
        updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(
          request.user_id,request.requested_role,request.requested_role==='substitute'?1:0,
          requestProvider,String(providerSnapshot.providerUserId||''),String(providerSnapshot.providerSlug||''),member.id
        );
      if(request.requested_role==='captain'){
        if(team.captain_user_id&&Number(team.captain_user_id)!==Number(request.user_id))throw new Error('This team already has a Captain. Transfer the role first.');
        syncTeamCaptain(teamId,{id:request.user_id,display_name:request.display_name,username:request.username},{gamerTag:request.gamer_tag});
      }
      db.prepare(`UPDATE tournament_join_requests SET team_id=?,selected_member_id=?,status='approved',review_note=?,reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(teamId,member.id,reviewNote,req.user.id,request.id);
    });
    logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'join.approved',details:{requestId:request.id,requestUserId:request.user_id,teamId,memberId:member.id,role:request.requested_role}});
    res.json({request:db.prepare('SELECT * FROM tournament_join_requests WHERE id=?').get(request.id),team:db.prepare('SELECT * FROM teams WHERE id=?').get(teamId)});
  }catch(error){res.status(400).json({error:clientErrorMessage(error)});}
});

app.delete('/api/tournaments/:id/solo-pool/:requestId',authRequired,requireTournamentPermission('team.edit'),(req,res)=>{
  try{
    const request=db.prepare(`SELECT jr.*,u.display_name,u.username FROM tournament_join_requests jr JOIN users u ON u.id=jr.user_id WHERE jr.id=? AND jr.tournament_id=?`).get(Number(req.params.requestId),req.tournamentId);
    if(!request)return res.status(404).json({error:'Join request not found.'});
    if(request.status!=='approved'||request.team_id||request.selected_member_id)return res.status(409).json({error:'This player is not in the solo signup pool.'});
    // Revert to pending so the host can re-review or the player is no longer in the pool
    db.prepare(`UPDATE tournament_join_requests SET status='pending',reviewed_by=NULL,reviewed_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tournament_id=?`).run(request.id,req.tournamentId);
    logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'join.solo_pool_removed',details:{requestId:request.id,requestUserId:request.user_id,displayName:request.display_name}});
    res.json({ok:true});
  }catch(error){res.status(400).json({error:clientErrorMessage(error)});}
});
app.post('/api/tournaments/:id/solo-pool/:requestId/assign',authRequired,requireTournamentPermission('team.edit'),(req,res)=>{
  try{
    const request=db.prepare(`SELECT jr.*,u.display_name,u.username,u.gamer_tag FROM tournament_join_requests jr JOIN users u ON u.id=jr.user_id WHERE jr.id=? AND jr.tournament_id=?`).get(Number(req.params.requestId),req.tournamentId);
    if(!request)return res.status(404).json({error:'Join request not found.'});
    if(request.status!=='approved'||request.team_id||request.selected_member_id)return res.status(409).json({error:'This player is not in the solo signup pool.'});
    const teamId=Number(req.body.teamId);
    if(!teamId)return res.status(400).json({error:'Team ID is required.'});
    const team=db.prepare('SELECT * FROM teams WHERE id=? AND tournament_id=?').get(teamId,req.tournamentId);
    if(!team)return res.status(404).json({error:'Team not found.'});
    const effectiveLock=team.roster_locked_at||db.prepare('SELECT roster_lock_at FROM tournaments WHERE id=?').get(req.tournamentId)?.roster_lock_at;
    if(effectiveLock&&Date.parse(effectiveLock)<=Date.now())return res.status(409).json({error:'Roster is locked. Ask the Host to make roster changes.'});
    let memberId;
    transaction(()=>{
      const insertResult=db.prepare(`INSERT INTO team_members (team_id,display_name,gamer_tag,game_id,member_role,is_substitute,membership_status,user_id,external_provider,external_user_id,external_profile_slug) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(
        teamId,request.display_name,request.gamer_tag||request.selected_member_tag||'',request.game_id||'',request.requested_role,request.requested_role==='substitute'?1:0,'active',request.user_id,request.external_provider||'',request.external_user_id||'',request.external_profile_slug||''
      );
      memberId=Number(insertResult.lastInsertRowid);
      if(request.requested_role==='captain'){
        if(team.captain_user_id&&Number(team.captain_user_id)!==Number(request.user_id))throw new Error('This team already has a Captain. Transfer the role first.');
        syncTeamCaptain(teamId,{id:request.user_id,display_name:request.display_name,username:request.username},{gamerTag:request.gamer_tag});
      }
      db.prepare(`UPDATE tournament_join_requests SET team_id=?,selected_member_id=?,status='approved',review_note='Assigned from solo pool by Host',reviewed_by=?,reviewed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(teamId,memberId,req.user.id,request.id);
    });
    logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'join.solo_pool_assigned',details:{requestId:request.id,requestUserId:request.user_id,teamId,memberId}});
    res.json({request:db.prepare('SELECT * FROM tournament_join_requests WHERE id=?').get(request.id),team:db.prepare('SELECT * FROM teams WHERE id=?').get(teamId)});
  }catch(error){res.status(400).json({error:clientErrorMessage(error)});}
});

app.post('/api/tournaments/:id/solo-randomizer/preview',authRequired,requireTournamentPermission('team.randomize_solo'),(req,res)=>{
  try{
    const built=buildSoloTeamPreview(req.tournamentId,req.body||{});
    const expiresAt=new Date(Date.now()+30*60*1000).toISOString();
    const row=transaction(()=>{
      db.prepare(`UPDATE solo_team_previews SET status='cancelled' WHERE tournament_id=? AND status='pending'`).run(req.tournamentId);
      const result=db.prepare(`INSERT INTO solo_team_previews(
        tournament_id,created_by,total_slots,team_size,captain_mode,assignments_json,request_ids_json,expires_at
      ) VALUES (?,?,?,?,?,?,?,?)`).run(
        req.tournamentId,req.user.id,built.totalSlots,built.teamSize,built.captainMode,
        JSON.stringify(built.assignments),JSON.stringify(built.pool.map(player=>player.request_id)),expiresAt
      );
      logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'solo_randomizer.previewed',details:{previewId:Number(result.lastInsertRowid),totalSlots:built.totalSlots,teamSize:built.teamSize,captainMode:built.captainMode,targetTeamIds:built.targetTeamIds}});
      return db.prepare('SELECT * FROM solo_team_previews WHERE id=?').get(Number(result.lastInsertRowid));
    });
    res.status(201).json({preview:soloPreviewPayload(row),poolSize:built.pool.length});
  }catch(error){res.status(error.status||400).json({error:clientErrorMessage(error)});}
});

app.post('/api/tournaments/:id/solo-randomizer/confirm',authRequired,requireTournamentPermission('team.randomize_solo'),(req,res)=>{
  try{
    assertSoloFormationWindow(req.tournamentId);
    const previewId=Number(req.body.previewId);
    const preview=db.prepare(`SELECT * FROM solo_team_previews WHERE id=? AND tournament_id=?`).get(previewId,req.tournamentId);
    if(!preview)return res.status(404).json({error:'Solo team preview not found.'});
    if(preview.status!=='pending')return res.status(409).json({error:'This solo team preview is no longer pending.'});
    if(Date.parse(preview.expires_at)<=Date.now()){
      db.prepare("UPDATE solo_team_previews SET status='expired' WHERE id=?").run(preview.id);
      return res.status(409).json({error:'This solo team preview expired. Preview again before confirming.'});
    }
    const assignments=jsonParse(preview.assignments_json,[]);
    const expectedRequestIds=jsonParse(preview.request_ids_json,[]).map(Number).sort((a,b)=>a-b);
    const currentPool=soloRandomizerPool(req.tournamentId);
    const currentRequestIds=currentPool.map(player=>Number(player.request_id)).sort((a,b)=>a-b);
    if(JSON.stringify(currentRequestIds)!==JSON.stringify(expectedRequestIds))return res.status(409).json({error:'The approved solo pool changed. Preview the teams again before confirming.'});
    const poolByRequest=new Map(currentPool.map(player=>[Number(player.request_id),player]));
    const requestSnapshots=db.prepare(`SELECT id,team_id,selected_member_id,status,review_note,reviewed_by,reviewed_at
      FROM tournament_join_requests WHERE tournament_id=? AND id IN (${expectedRequestIds.map(()=>'?').join(',')}) ORDER BY id`).all(req.tournamentId,...expectedRequestIds);
    const createdTeams=transaction(()=>{
      let nextSeed=Number(db.prepare(`SELECT COALESCE(MAX(seed),0)+1 next_seed FROM teams WHERE tournament_id=? AND team_status NOT IN ('withdrawn','disqualified')`).get(req.tournamentId)?.next_seed||1);
      const generated=[];
      for(const assignment of assignments){
        const members=Array.isArray(assignment.members)?assignment.members:[];
        if(members.length!==Number(preview.team_size)||members.filter(member=>member.isCaptain===true).length!==1)throw new Error('The preview no longer contains one Captain and the configured number of players per team.');
        const captain=members.find(member=>member.isCaptain===true);
        const captainPoolRecord=poolByRequest.get(Number(captain.request_id));
        if(!captainPoolRecord||Number(captainPoolRecord.user_id)!==Number(captain.user_id))throw new Error('A preview Captain is no longer in the approved solo pool.');
        const requestedTeamId=Number(assignment.teamId||0);let teamId,existingTeam=false,teamSnapshot=null;
        if(requestedTeamId){
          const target=db.prepare(`SELECT t.*,(SELECT COUNT(*) FROM team_members tm WHERE tm.team_id=t.id AND tm.membership_status='active') active_member_count
            FROM teams t WHERE t.id=? AND t.tournament_id=?`).get(requestedTeamId,req.tournamentId);
          if(!target||['withdrawn','disqualified'].includes(target.team_status)||Number(target.active_member_count)>0||target.captain_user_id)throw new Error('An existing target team changed after preview. Preview again before confirming.');
          existingTeam=true;teamId=target.id;
          teamSnapshot={formationSource:target.formation_source||'',status:target.status,teamStatus:target.team_status,captainUserId:target.captain_user_id||null};
          db.prepare(`UPDATE teams SET formation_source='solo_randomizer',status='approved',team_status='ready',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(teamId);
        }else{
          const inserted=db.prepare(`INSERT INTO teams(
            tournament_id,name,tag,source,formation_source,seed,status,team_status,captain_user_id
          ) VALUES (?,?,?,'manual','solo_randomizer',?,'approved','ready',?)`).run(
            req.tournamentId,String(assignment.name).slice(0,160),String(assignment.tag).slice(0,8),nextSeed++,captain.user_id
          );
          teamId=Number(inserted.lastInsertRowid);
        }
        const userIds=[];
        for(const previewMember of members){
          const poolRecord=poolByRequest.get(Number(previewMember.request_id));
          if(!poolRecord||Number(poolRecord.user_id)!==Number(previewMember.user_id))throw new Error('A preview player is no longer in the approved solo pool.');
          const isCaptain=previewMember.isCaptain===true;
          const memberResult=db.prepare(`INSERT INTO team_members(
            team_id,user_id,display_name,gamer_tag,member_role,membership_status,is_captain,is_substitute
          ) VALUES (?,?,?,?,?,'active',?,0)`).run(
            teamId,poolRecord.user_id,poolRecord.display_name,poolRecord.gamer_tag||poolRecord.username,isCaptain?'captain':'player',isCaptain?1:0
          );
          const memberId=Number(memberResult.lastInsertRowid);userIds.push(Number(poolRecord.user_id));
          db.prepare(`UPDATE tournament_join_requests SET team_id=?,selected_member_id=?,status='approved',reviewed_by=COALESCE(reviewed_by,?),reviewed_at=COALESCE(reviewed_at,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE id=? AND tournament_id=?`)
            .run(teamId,memberId,req.user.id,poolRecord.request_id,req.tournamentId);
        }
        syncTeamCaptain(teamId,{
          id:captainPoolRecord.user_id,
          display_name:captainPoolRecord.display_name,
          username:captainPoolRecord.username,
          gamer_tag:captainPoolRecord.gamer_tag,
        },{gamerTag:captainPoolRecord.gamer_tag});
        const captainCount=Number(db.prepare('SELECT COUNT(*) count FROM team_members WHERE team_id=? AND is_captain=1 AND user_id=?').get(teamId,captain.user_id)?.count||0);
        if(captainCount!==1)throw new Error('Captain assignment could not be synchronized.');
        generated.push({teamId,name:assignment.name,tag:assignment.tag,captainUserId:Number(captain.user_id),userIds,existingTeam,teamSnapshot});
      }
      const snapshot={previewId:preview.id,requests:requestSnapshots,generatedTeams:generated};
      const history=db.prepare(`INSERT INTO solo_team_history(tournament_id,user_id,snapshot_json,reason) VALUES (?,?,?,'Before confirming solo randomizer teams')`)
        .run(req.tournamentId,req.user.id,JSON.stringify(snapshot));
      db.prepare(`UPDATE solo_team_previews SET status='confirmed',confirmed_at=CURRENT_TIMESTAMP WHERE id=?`).run(preview.id);
      db.prepare(`UPDATE solo_team_previews SET status='cancelled' WHERE tournament_id=? AND status='pending' AND id!=?`).run(req.tournamentId,preview.id);
      logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'solo_randomizer.confirmed',details:{previewId:preview.id,historyId:Number(history.lastInsertRowid),teamIds:generated.map(team=>team.teamId),requestIds:expectedRequestIds}});
      return generated;
    });
    res.status(201).json({confirmed:true,teams:createdTeams});
  }catch(error){res.status(error.status||400).json({error:clientErrorMessage(error)});}
});

app.post('/api/tournaments/:id/solo-randomizer/undo',authRequired,requireTournamentPermission('team.randomize_solo'),(req,res)=>{
  try{
    const history=db.prepare(`SELECT * FROM solo_team_history WHERE tournament_id=? AND undone_at IS NULL ORDER BY id DESC LIMIT 1`).get(req.tournamentId);
    if(!history)return res.status(404).json({error:'No confirmed solo team randomizer snapshot is available to undo.'});
    const snapshot=jsonParse(history.snapshot_json,{});const generated=Array.isArray(snapshot.generatedTeams)?snapshot.generatedTeams:[];
    const teamIds=generated.map(team=>Number(team.teamId)).filter(Number.isInteger);
    if(!teamIds.length)throw new Error('The solo team snapshot does not contain generated teams.');
    const matchCount=Number(db.prepare(`SELECT COUNT(*) count FROM matches WHERE tournament_id=? AND (team_a_id IN (${teamIds.map(()=>'?').join(',')}) OR team_b_id IN (${teamIds.map(()=>'?').join(',')}))`).get(req.tournamentId,...teamIds,...teamIds)?.count||0);
    if(matchCount){const error=new Error('Solo teams cannot be undone after they are assigned to a match. Remove or regenerate the bracket first.');error.status=409;throw error;}
    for(const team of generated){
      const current=db.prepare('SELECT user_id,is_captain FROM team_members WHERE team_id=? AND membership_status=\'active\' ORDER BY user_id').all(team.teamId);
      const currentIds=current.map(member=>Number(member.user_id)).sort((a,b)=>a-b);
      const expectedIds=(team.userIds||[]).map(Number).sort((a,b)=>a-b);
      if(JSON.stringify(currentIds)!==JSON.stringify(expectedIds)){const error=new Error('A generated roster changed after confirmation. Restore it before using undo.');error.status=409;throw error;}
      const captain=current.find(member=>member.is_captain);
      if(Number(captain?.user_id)!==Number(team.captainUserId)){const error=new Error('A generated team Captain changed after confirmation. Restore the Captain before using undo.');error.status=409;throw error;}
    }
    const createdTeamIds=generated.filter(team=>!team.existingTeam).map(team=>Number(team.teamId));
    const existingTeamIds=generated.filter(team=>team.existingTeam).map(team=>Number(team.teamId));
    transaction(()=>{
      createdTeamIds.forEach(teamId=>db.prepare('DELETE FROM teams WHERE id=? AND tournament_id=? AND formation_source=\'solo_randomizer\'').run(teamId,req.tournamentId));
      generated.filter(team=>team.existingTeam).forEach(team=>{
        db.prepare('DELETE FROM team_members WHERE team_id=?').run(team.teamId);
        const before=team.teamSnapshot||{};
        db.prepare(`UPDATE teams SET captain_user_id=?,status=?,team_status=?,formation_source=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tournament_id=?`).run(
          before.captainUserId||null,before.status||'pending',before.teamStatus||'captain_pending',before.formationSource||'',team.teamId,req.tournamentId
        );
      });
      const restore=db.prepare(`UPDATE tournament_join_requests SET team_id=?,selected_member_id=?,status=?,review_note=?,reviewed_by=?,reviewed_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tournament_id=?`);
      (snapshot.requests||[]).forEach(request=>restore.run(request.team_id||null,request.selected_member_id||null,request.status,request.review_note||'',request.reviewed_by||null,request.reviewed_at||null,request.id,req.tournamentId));
      db.prepare('UPDATE solo_team_history SET undone_at=CURRENT_TIMESTAMP WHERE id=?').run(history.id);
      logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'solo_randomizer.undone',details:{historyId:history.id,teamIds,requestIds:(snapshot.requests||[]).map(request=>request.id)}});
    });
    res.json({undone:true,removedTeamIds:createdTeamIds,clearedTeamIds:existingTeamIds,restoredRequestIds:(snapshot.requests||[]).map(request=>request.id)});
  }catch(error){res.status(error.status||400).json({error:clientErrorMessage(error)});}
});

// Seeding and constraints
app.put('/api/tournaments/:id/seeding',authRequired,requireTournamentPermission('seeding.edit'),(req,res)=>{
  const seeds=Array.isArray(req.body.seeds)?req.body.seeds:[];try{transaction(()=>{saveSeedingSnapshot(req.tournamentId,req.user.id,'Before Save All');const seen=new Set();for(const entry of seeds){const teamId=Number(entry.teamId),seed=Number(entry.seed);if(!Number.isInteger(teamId)||!Number.isInteger(seed)||seed<1||seen.has(seed))throw new Error('Each team must have a unique positive seed number.');const team=db.prepare('SELECT id,seed,seed_locked FROM teams WHERE id=? AND tournament_id=?').get(teamId,req.tournamentId);if(!team)throw new Error(`Team ${teamId} does not belong to this tournament.`);assertLockedSeedMutationAllowed(req.user,team,seed);seen.add(seed);db.prepare(`UPDATE teams SET seed=?,seed_locked=?,protected_seed_group=?,region=?,seeding_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(seed,entry.seedLocked?1:0,String(entry.protectedSeedGroup||''),String(entry.region||''),String(entry.seedingNote||''),teamId);}});res.json({teams:db.prepare('SELECT * FROM teams WHERE tournament_id=? ORDER BY seed,name').all(req.tournamentId)});}catch(error){res.status(error.code==='LOCKED_SEED'?409:400).json({error:clientErrorMessage(error)});}
});
app.post('/api/tournaments/:id/seeding/randomize',authRequired,requireTournamentPermission('seeding.edit'),(req,res)=>{try{res.json({teams:randomizeUnlockedTeams(req.tournamentId,req.user.id)});}catch(error){res.status(400).json({error:clientErrorMessage(error)});}});
app.post('/api/tournaments/:id/seeding/undo',authRequired,requireTournamentPermission('seeding.edit'),(req,res)=>{try{res.json({teams:restoreLatestSeeding(req.tournamentId,req.user.id)});}catch(error){res.status(400).json({error:clientErrorMessage(error)});}});

// Bracket/group generation and snapshots
function bracketError(res,error){if(error.code==='CONSTRAINT_WARNINGS')return res.status(409).json({error:clientErrorMessage(error),warnings:error.warnings,requiresConfirmation:true});return res.status(400).json({error:clientErrorMessage(error)});}
app.post('/api/tournaments/:id/bracket/generate',authRequired,requireTournamentPermission('bracket.generate'),(req,res)=>{try{const tournament=db.prepare('SELECT rules_json FROM tournaments WHERE id=?').get(req.tournamentId);const rules=jsonParse(tournament?.rules_json);const bestOf=Number(req.body.bestOf||rules.playoffBestOf||3);let matches=generateSingleElimination(req.tournamentId,{randomize:Boolean(req.body.randomize),bestOf,userId:req.user.id,allowWarnings:Boolean(req.body.allowWarnings)});const finalRound=Math.max(...matches.filter(m=>m.stage==='playoff').map(m=>m.round_no));const finalBo=Number(rules.grandFinalBestOf||bestOf);if([1,3,5,7].includes(finalBo)&&finalBo!==bestOf){db.prepare(`UPDATE matches SET best_of=? WHERE tournament_id=? AND stage='playoff' AND round_no=?`).run(finalBo,req.tournamentId,finalRound);matches=listMatches(req.tournamentId);}logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'bracket.generated',details:{bestOf,finalBo}});emitBracketUpdated(req.tournamentId,matches);res.json({matches});}catch(error){bracketError(res,error);}});
app.post('/api/tournaments/:id/bracket/generate-groups',authRequired,requireTournamentPermission('bracket.generate'),(req,res)=>{try{const matches=generateGroupStage(req.tournamentId,{groupCount:Number(req.body.groupCount||2),bestOf:Number(req.body.bestOf||1),topPerGroup:Number(req.body.topPerGroup||2),doubleRoundRobin:Boolean(req.body.doubleRoundRobin),userId:req.user.id,allowWarnings:Boolean(req.body.allowWarnings)});const standings=calculateGroupStandings(req.tournamentId);logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'group_stage.generated',details:req.body});emitBracketUpdated(req.tournamentId,matches,{standings});res.json({matches,standings});}catch(error){bracketError(res,error);}});
app.post('/api/tournaments/:id/bracket/generate-playoffs',authRequired,requireTournamentPermission('bracket.generate'),(req,res)=>{try{const tournament=db.prepare('SELECT rules_json FROM tournaments WHERE id=?').get(req.tournamentId);const rules=jsonParse(tournament?.rules_json);let matches=generatePlayoffsFromGroups(req.tournamentId,{topPerGroup:Number(req.body.topPerGroup||rules.topPerGroup||2),bestOf:Number(req.body.bestOf||rules.playoffBestOf||3),force:Boolean(req.body.force),userId:req.user.id});const playoff=matches.filter(m=>m.stage==='playoff');const finalRound=Math.max(...playoff.map(m=>m.round_no));const finalBo=Number(rules.grandFinalBestOf||req.body.bestOf||3);if([1,3,5,7].includes(finalBo)){db.prepare(`UPDATE matches SET best_of=? WHERE tournament_id=? AND stage='playoff' AND round_no=?`).run(finalBo,req.tournamentId,finalRound);matches=listMatches(req.tournamentId);}emitBracketUpdated(req.tournamentId,matches);res.json({matches,standings:calculateGroupStandings(req.tournamentId)});}catch(error){res.status(400).json({error:clientErrorMessage(error)});}});
app.post('/api/tournaments/:id/bracket/restore/:snapshotId',authRequired,requireTournamentPermission('bracket.restore'),(req,res)=>{try{const matches=restoreBracketSnapshot(req.tournamentId,Number(req.params.snapshotId),req.user.id);emitBracketUpdated(req.tournamentId,matches);res.json({matches});}catch(error){res.status(400).json({error:clientErrorMessage(error)});}});
app.post('/api/tournaments/:id/standings/override',authRequired,requireTournamentPermission('bracket.generate'),(req,res)=>{try{const group=String(req.body.group||'');const teamId=Number(req.body.teamId),rank=Number(req.body.rank);const standings=calculateGroupStandings(req.tournamentId).find(item=>item.group===group);const row=standings?.standings.find(item=>item.teamId===teamId);if(!row)throw new Error('Team is not in this group.');if(!Number.isInteger(rank)||rank<1||rank>standings.standings.length)throw new Error('Invalid override rank.');const reason=String(req.body.reason||'').trim();if(!reason)throw new Error('Override reason is required.');db.prepare('UPDATE standings_overrides SET active=0,reverted_at=CURRENT_TIMESTAMP WHERE tournament_id=? AND group_name=? AND team_id=? AND active=1').run(req.tournamentId,group,teamId);db.prepare(`INSERT INTO standings_overrides(tournament_id,group_name,team_id,automatic_rank,override_rank,reason,created_by) VALUES (?,?,?,?,?,?,?)`).run(req.tournamentId,group,teamId,row.automaticRank,rank,reason,req.user.id);logAction({tournamentId:req.tournamentId,userId:req.user.id,action:'standings.overridden',details:{group,teamId,automaticRank:row.automaticRank,rank,reason}});res.json({standings:calculateGroupStandings(req.tournamentId)});}catch(error){res.status(400).json({error:clientErrorMessage(error)});}});
app.delete('/api/tournaments/:id/standings/override',authRequired,requireTournamentPermission('bracket.generate'),(req,res)=>{db.prepare('UPDATE standings_overrides SET active=0,reverted_at=CURRENT_TIMESTAMP WHERE tournament_id=? AND group_name=? AND team_id=? AND active=1').run(req.tournamentId,String(req.body.group||''),Number(req.body.teamId));res.json({standings:calculateGroupStandings(req.tournamentId)});});

// Match operations
app.get('/api/tournaments/:id/matches',authRequired,requireTournamentPermission('match.read'),(req,res)=>res.json({matches:listMatches(req.tournamentId)}));
app.patch('/api/matches/:matchId',authRequired,requireMatchAccess,(req,res)=>{
  const match=req.match;if(!hasTournamentPermission(req.user.id,match.tournament_id,'match.manage'))return res.status(403).json({error:'Permission required: match.manage'});
  if(req.body.streamUrl!==undefined&&!isSafeExternalUrl(req.body.streamUrl))return res.status(400).json({error:isProduction?'Stream URL must use HTTPS.':'Stream URL must use HTTP or HTTPS.'});
  if(req.body.teamALogoUrl!==undefined&&!isSafeExternalUrl(req.body.teamALogoUrl))return res.status(400).json({error:isProduction?'Team Blue logo URL must use HTTPS.':'Team Blue logo URL must use HTTP or HTTPS.'});
  if(req.body.teamBLogoUrl!==undefined&&!isSafeExternalUrl(req.body.teamBLogoUrl))return res.status(400).json({error:isProduction?'Team Red logo URL must use HTTPS.':'Team Red logo URL must use HTTP or HTTPS.'});
  const validateAssignedStaff=(userId,allowedRoles,label)=>{
    if(userId==null||userId==='')return null;
    const numericId=Number(userId);if(!Number.isInteger(numericId))throw new Error(`${label} account is invalid.`);
    const placeholders=allowedRoles.map(()=>'?').join(',');
    const assigned=db.prepare(`SELECT 1 FROM tournament_staff WHERE tournament_id=? AND user_id=? AND role IN (${placeholders})`).get(match.tournament_id,numericId,...allowedRoles);
    if(!assigned)throw new Error(`${label} must have an eligible tournament staff role.`);
    return numericId;
  };
  let assignedRefereeId,assignedBroadcasterId;
  try{
    assignedRefereeId=req.body.assignedRefereeId===undefined?match.assigned_referee_id:validateAssignedStaff(req.body.assignedRefereeId,['referee','host'],'Assigned Referee');
    assignedBroadcasterId=req.body.assignedBroadcasterId===undefined?match.assigned_broadcaster_id:validateAssignedStaff(req.body.assignedBroadcasterId,['broadcaster'],'Assigned Broadcaster');
  }catch(error){return res.status(400).json({error:clientErrorMessage(error)});}
  const old={server:match.server_region,roomCode:match.room_code,status:match.match_status};const nextStatus=req.body.matchStatus??req.body.status??match.match_status;
  db.prepare(`UPDATE matches SET best_of=?,series_rule=?,status=?,match_status=?,scheduled_at=?,timezone=?,estimated_duration_minutes=?,station_id=?,assigned_referee_id=?,assigned_broadcaster_id=?,server_region=?,room_code=?,room_code_status=?,stream_url=?,stream_platform=?,rules_json=?,notes=?,private_notes=?,public_notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(Number(req.body.bestOf??match.best_of),String(req.body.seriesRule??match.series_rule),nextStatus,nextStatus,req.body.scheduledAt===undefined?match.scheduled_at:(req.body.scheduledAt||null),req.body.timezone??match.timezone,req.body.estimatedDurationMinutes===undefined?match.estimated_duration_minutes:(req.body.estimatedDurationMinutes||null),req.body.stationId===undefined?match.station_id:(req.body.stationId||null),assignedRefereeId,assignedBroadcasterId,req.body.serverRegion??match.server_region,req.body.roomCode??match.room_code,req.body.roomCodeStatus??match.room_code_status,req.body.streamUrl??match.stream_url,req.body.streamPlatform??match.stream_platform,JSON.stringify(req.body.rules??jsonParse(match.rules_json)),req.body.notes??match.notes,req.body.privateNotes??match.private_notes,req.body.publicNotes??match.public_notes,match.id);
  if(req.body.teamALogoUrl!==undefined&&match.team_a_id)db.prepare('UPDATE teams SET logo_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(String(req.body.teamALogoUrl||''),match.team_a_id);
  if(req.body.teamBLogoUrl!==undefined&&match.team_b_id)db.prepare('UPDATE teams SET logo_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(String(req.body.teamBLogoUrl||''),match.team_b_id);
  const updated=db.prepare('SELECT * FROM matches WHERE id=?').get(match.id);if(old.server!==updated.server_region)addSystemMessage(match.id,`Server changed to ${updated.server_region}.`);if(old.roomCode!==updated.room_code)addSystemMessage(match.id,updated.room_code?'Room code was updated.':'Room code was removed.');if(old.status!==updated.match_status)addSystemMessage(match.id,`Match status changed to ${updated.match_status}.`);logAction({tournamentId:match.tournament_id,matchId:match.id,userId:req.user.id,action:'match.updated',details:req.body});emitMatchUpdated(updated);res.json({match:updated});
});
app.post('/api/tournaments/:id/matches/apply-best-of',authRequired,requireTournamentPermission('match.manage'),(req,res)=>{const bestOf=Number(req.body.bestOf),roundNo=req.body.roundNo==null?null:Number(req.body.roundNo),stage=req.body.stage||null;if(![1,3,5,7].includes(bestOf))return res.status(400).json({error:'Best-of must be BO1, BO3, BO5 or BO7.'});let sql=`UPDATE matches SET best_of=?,updated_at=CURRENT_TIMESTAMP WHERE tournament_id=? AND result_status!='final'`,params=[bestOf,req.tournamentId];if(roundNo!=null){sql+=' AND round_no=?';params.push(roundNo);}if(stage){sql+=' AND stage=?';params.push(stage);}db.prepare(sql).run(...params);const matches=listMatches(req.tournamentId);emitBracketUpdated(req.tournamentId,matches);res.json({matches});});
app.post('/api/matches/:matchId/checkin',authRequired,emailVerifiedRequired,requireMatchAccess,(req,res)=>{
  try{
    const match=req.match;
    let actorType=String(req.body?.actorType||'');
    let actorId=String(req.body?.actorId||'');
    if(req.matchTeamId){
      if(!teamForCaptain(req.user.id,req.matchTeamId))return res.status(403).json({error:'Only the linked Captain can check in the team.'});
      if(!['checkin_open','ready'].includes(String(match.match_status||'')))return res.status(409).json({error:'The Host has not opened Captain check-in for this match yet.'});
      if(actorType==='team'&&actorId&&actorId!==String(req.matchTeamId))return res.status(400).json({error:'actorId does not match your linked team; you can only check in your own team.'});
      actorType='team';actorId=String(req.matchTeamId);
    }else if(!hasTournamentPermission(req.user.id,match.tournament_id,'match.checkin')&&!hasTournamentPermission(req.user.id,match.tournament_id,'match.manage'))return res.status(403).json({error:'Check-in permission required.'});
    if(!actorType||!actorId)return res.status(400).json({error:'Check-in actor is required.'});
    db.prepare(`INSERT INTO match_checkins(match_id,actor_type,actor_id,status,checked_in_by) VALUES (?,?,?,'ready',?) ON CONFLICT(match_id,actor_type,actor_id) DO UPDATE SET status='ready',checked_in_by=excluded.checked_in_by,checked_in_at=CURRENT_TIMESTAMP`).run(match.id,actorType,actorId,req.user.id);
    addSystemMessage(match.id,`${req.user.display_name} checked in ${actorType} ${actorId}.`);
    const checkins=db.prepare('SELECT * FROM match_checkins WHERE match_id=?').all(match.id);
    const checkedTeamIds=new Set(checkins.filter(item=>item.actor_type==='team'&&item.status==='ready').map(item=>Number(item.actor_id)));
    const bothTeamsReady=Boolean(match.team_a_id&&match.team_b_id&&checkedTeamIds.has(Number(match.team_a_id))&&checkedTeamIds.has(Number(match.team_b_id)));
    if(bothTeamsReady&&['available','checkin_open'].includes(match.match_status)){
      db.prepare(`UPDATE matches SET status='ready',match_status='ready',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(match.id);
      addSystemMessage(match.id,'Both teams are checked in. The Host may now open the Draft Room.');
      emitMatchUpdated(listMatches(match.tournament_id).find(item=>Number(item.id)===Number(match.id)));
    }
    emitInternalTournamentEvent(match.tournament_id,'match:checkin',{tournamentId:match.tournament_id,matchId:match.id,actorType,actorId,status:'ready',checkedInBy:req.user.id,bothTeamsReady,checkins});
    res.json({checkins,bothTeamsReady});
  }catch(error){
    console.error('[MATCH_CHECKIN_ERROR]', error);
    res.status(400).json({error:clientErrorMessage(error)});
  }
});
app.get('/api/matches/:matchId/checkin',authRequired,requireMatchAccess,(req,res)=>res.json({checkins:db.prepare('SELECT * FROM match_checkins WHERE match_id=?').all(req.match.id)}));

// Result state machine
app.get('/api/matches/:matchId/results',authRequired,requireMatchAccess,(req,res)=>res.json(getResultContext(req.match.id)));
app.post('/api/matches/:matchId/results/submit',authRequired,emailVerifiedRequired,requireMatchAccess,(req,res)=>{
  try{
    const match=req.match;
    const room=db.prepare('SELECT status FROM draft_rooms WHERE match_id=?').get(match.id);
    if(room&&room.status!=='series_complete')return res.status(409).json({error:'Report and confirm the current game first. The full BO score is no longer submitted before all games are verified.'});
    let sourceType='team',teamId=req.matchTeamId;
    if(hasTournamentPermission(req.user.id,match.tournament_id,'result.verify')||hasTournamentPermission(req.user.id,match.tournament_id,'match.manage')){sourceType=req.user.role==='admin'?'admin':'host';teamId=null;}
    else if(!teamId||!teamForCaptain(req.user.id,teamId))return res.status(403).json({error:'Only the linked Captain or authorized staff can submit results.'});
    const payload=submitResult({matchId:match.id,userId:req.user.id,sourceType,submittedByTeamId:teamId,scoreA:req.body.scoreA,scoreB:req.body.scoreB,note:req.body.note});
    addSystemMessage(match.id,`Result submitted: ${req.body.scoreA}-${req.body.scoreB}.`);emitBracketUpdated(match.tournament_id);res.json(payload);
  }catch(error){res.status(400).json({error:clientErrorMessage(error)});}
});
// Backward-compatible endpoint: an authorized Host/Admin result is final immediately.
app.post('/api/matches/:matchId/result',authRequired,requireMatchAccess,(req,res)=>{if(!hasTournamentPermission(req.user.id,req.match.tournament_id,'result.submit'))return res.status(403).json({error:'Result submit permission required.'});try{const room=db.prepare('SELECT status FROM draft_rooms WHERE match_id=?').get(req.match.id);if(room&&room.status!=='series_complete')return res.status(409).json({error:'Report and confirm each game before submitting a full BO score.'});const payload=submitResult({matchId:req.match.id,userId:req.user.id,sourceType:'host',scoreA:req.body.scoreA,scoreB:req.body.scoreB,note:req.body.note});res.json({...payload,matches:listMatches(req.match.tournament_id)});}catch(error){res.status(400).json({error:clientErrorMessage(error)});}});
app.post('/api/matches/:matchId/results/confirm',authRequired,emailVerifiedRequired,requireMatchAccess,(req,res)=>{try{const teamId=req.matchTeamId||Number(req.body.teamId);if(!teamId||!teamForCaptain(req.user.id,teamId))return res.status(403).json({error:'Only the linked Captain can confirm this team result.'});const payload=confirmResult({matchId:req.match.id,userId:req.user.id,teamId,decision:req.body.decision,comment:req.body.comment});addSystemMessage(req.match.id,payload.final?'Result confirmed and finalized.':'Result confirmation was updated.');emitBracketUpdated(req.match.tournament_id);res.json(payload);}catch(error){res.status(400).json({error:clientErrorMessage(error)});}});
app.post('/api/matches/:matchId/results/review',authRequired,requireMatchAccess,(req,res)=>{if(!hasTournamentPermission(req.user.id,req.match.tournament_id,'dispute.review'))return res.status(403).json({error:'Dispute review permission required.'});try{res.json({dispute:reviewDispute({matchId:req.match.id,userId:req.user.id,status:'under_review',note:req.body.note})});}catch(error){res.status(400).json({error:clientErrorMessage(error)});}});
app.post('/api/matches/:matchId/results/recommend',authRequired,requireMatchAccess,(req,res)=>{if(!hasTournamentPermission(req.user.id,req.match.tournament_id,'result.recommend')&&!hasTournamentPermission(req.user.id,req.match.tournament_id,'result.verify'))return res.status(403).json({error:'Result recommendation permission required.'});try{res.json({dispute:recommendDispute({matchId:req.match.id,userId:req.user.id,scoreA:req.body.scoreA,scoreB:req.body.scoreB,recommendation:req.body.recommendation})});}catch(error){res.status(400).json({error:clientErrorMessage(error)});}});
app.post('/api/matches/:matchId/results/verify',authRequired,requireMatchAccess,(req,res)=>{if(!hasTournamentPermission(req.user.id,req.match.tournament_id,'result.verify'))return res.status(403).json({error:'Result verify permission required.'});try{const payload=verifyDispute({matchId:req.match.id,userId:req.user.id,scoreA:req.body.scoreA,scoreB:req.body.scoreB,resolutionNote:req.body.resolutionNote,resolutionType:req.body.resolutionType});addSystemMessage(req.match.id,'Administrative result was finalized.');emitBracketUpdated(req.match.tournament_id);res.json(payload);}catch(error){res.status(400).json({error:clientErrorMessage(error)});}});
app.post('/api/matches/:matchId/results/reopen',authRequired,requireMatchAccess,(req,res)=>{if(!hasTournamentPermission(req.user.id,req.match.tournament_id,'result.verify'))return res.status(403).json({error:'Result verify permission required.'});try{const match=reopenResult({matchId:req.match.id,userId:req.user.id,reason:req.body.reason});addSystemMessage(req.match.id,`Final result reopened: ${req.body.reason}`);emitBracketUpdated(req.match.tournament_id);res.json({match});}catch(error){res.status(400).json({error:clientErrorMessage(error)});}});
app.post('/api/matches/:matchId/results/correct',authRequired,requireMatchAccess,(req,res)=>{if(!hasTournamentPermission(req.user.id,req.match.tournament_id,'result.verify'))return res.status(403).json({error:'Result verify permission required.'});try{const payload=correctFinalResult({matchId:req.match.id,userId:req.user.id,reason:req.body.reason,scoreA:req.body.scoreA,scoreB:req.body.scoreB});addSystemMessage(req.match.id,`Final result correction submitted: ${req.body.scoreA}-${req.body.scoreB}.`);emitBracketUpdated(req.match.tournament_id);res.json(payload);}catch(error){res.status(400).json({error:clientErrorMessage(error)});}});
app.post('/api/matches/:matchId/results/request-reconfirmation',authRequired,emailVerifiedRequired,requireMatchAccess,(req,res)=>{
  if(!hasTournamentPermission(req.user.id,req.match.tournament_id,'result.verify'))return res.status(403).json({error:'Result verify permission required.'});
  try{
    const payload=requestResultReconfirmation({matchId:req.match.id,userId:req.user.id,reason:req.body.reason,scoreA:req.body.scoreA,scoreB:req.body.scoreB});
    addSystemMessage(req.match.id,`Host requested both Captains to confirm the result again: ${String(req.body.reason||'').trim()}`);
    emitBracketUpdated(req.match.tournament_id);
    res.json(payload);
  }catch(error){res.status(400).json({error:clientErrorMessage(error)});}
});

// Automatic Match Report Generator
function generateMatchReport(matchId) {
  const match = db.prepare(`
    SELECT m.*, t.name tournament_name, t.slug tournament_slug,
           a.name team_a_name, a.tag team_a_tag, b.name team_b_name, b.tag team_b_tag,
           w.name winner_team_name
    FROM matches m
    JOIN tournaments t ON t.id=m.tournament_id
    LEFT JOIN teams a ON a.id=m.team_a_id
    LEFT JOIN teams b ON b.id=m.team_b_id
    LEFT JOIN teams w ON w.id=m.winner_team_id
    WHERE m.id=?
  `).get(matchId);
  if (!match) return null;

  const games = db.prepare(`SELECT * FROM match_games WHERE match_id=? ORDER BY game_number ASC`).all(matchId);
  const draftRoom = db.prepare(`SELECT id, room_code, status FROM draft_rooms WHERE match_id=?`).get(matchId);
  const logs = draftRoom ? db.prepare(`SELECT * FROM draft_logs WHERE draft_room_id=? ORDER BY id ASC`).all(draftRoom.id) : [];
  const pinnedMessages = db.prepare(`SELECT * FROM match_messages WHERE match_id=? AND (pinned=1 OR is_pinned=1) ORDER BY id ASC`).all(matchId);

  const reportsDir = path.join(__dirname, 'reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Match Report #${match.id} — ${match.tournament_name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; }
    .container { max-width: 900px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 2rem; border: 1px solid #334155; }
    h1, h2, h3 { color: #38bdf8; margin-top: 0; }
    .header-box { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 1rem; margin-bottom: 1.5rem; }
    .score-card { display: flex; justify-content: space-around; background: #0f172a; border-radius: 8px; padding: 1.5rem; margin: 1.5rem 0; text-align: center; border: 1px solid #38bdf8; }
    .team-box { flex: 1; }
    .team-name { font-size: 1.5rem; font-weight: bold; color: #f8fafc; }
    .score { font-size: 2.5rem; font-weight: 900; color: #fbbf24; }
    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; background: #22c55e; color: #000; }
    .section { margin-top: 2rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; }
    th, td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #334155; }
    th { background: #0f172a; color: #94a3b8; }
    .log-entry { font-family: monospace; font-size: 0.85rem; background: #0f172a; padding: 0.5rem; border-radius: 4px; margin-bottom: 0.25rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header-box">
      <div>
        <h1>${match.tournament_name}</h1>
        <p style="color: #94a3b8; margin: 0;">Match ID: #${match.id} · ${match.round_name || 'Round ' + match.round_no} (BO${match.best_of}) · Stage: ${match.stage}</p>
      </div>
      <div>
        <span class="badge">STATUS: ${String(match.result_status || 'FINAL').toUpperCase()}</span>
      </div>
    </div>

    <div class="score-card">
      <div class="team-box">
        <div class="team-name">${match.team_a_name || 'Team A'}</div>
        <div class="score">${match.score_a ?? 0}</div>
      </div>
      <div style="display: flex; align-items: center; font-size: 1.5rem; color: #64748b;">VS</div>
      <div class="team-box">
        <div class="team-name">${match.team_b_name || 'Team B'}</div>
        <div class="score">${match.score_b ?? 0}</div>
      </div>
    </div>

    ${match.winner_team_name ? `<div style="text-align: center; margin-bottom: 2rem;"><span class="badge" style="background: #eab308; font-size: 1.1rem; padding: 0.5rem 1.5rem;">🏆 WINNER: ${match.winner_team_name}</span></div>` : ''}

    <div class="section">
      <h2>Game Results Breakdown</h2>
      <table>
        <thead>
          <tr>
            <th>Game #</th>
            <th>Winner Side / Team</th>
            <th>Status</th>
            <th>Picks / Bans</th>
          </tr>
        </thead>
        <tbody>
          ${games.map(g => `
            <tr>
              <td>Game ${g.game_number}</td>
              <td style="color: #38bdf8; font-weight: bold;">${g.winner_team_id === match.team_a_id ? match.team_a_name : (g.winner_team_id === match.team_b_id ? match.team_b_name : (g.winner_side || 'TBD'))}</td>
              <td>${g.result_status || g.status}</td>
              <td>Picks A: ${g.picks_a_json || '[]'} · Picks B: ${g.picks_b_json || '[]'}</td>
            </tr>
          `).join('') || '<tr><td colspan="4">No individual game details recorded.</td></tr>'}
        </tbody>
      </table>
    </div>

    ${pinnedMessages.length ? `
      <div class="section">
        <h2>Pinned Staff Messages & Decisions</h2>
        ${pinnedMessages.map(m => `
          <div class="log-entry" style="border-left: 3px solid #38bdf8;">
            <strong>[${m.sender_role.toUpperCase()}] ${m.sender_name}</strong> (${m.created_at}): ${m.message}
          </div>
        `).join('')}
      </div>
    ` : ''}

    ${logs.length ? `
      <div class="section">
        <h2>Draft Timeline & Logs (${logs.length} Events)</h2>
        <div style="max-height: 250px; overflow-y: auto; background: #0f172a; padding: 1rem; border-radius: 8px;">
          ${logs.map(l => `
            <div class="log-entry">
              <span style="color: #94a3b8;">${l.created_at}</span> · <strong style="color: #38bdf8;">${l.event_type}</strong>: ${l.event_data}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div class="section" style="border-top: 1px solid #334155; padding-top: 1rem; margin-top: 2rem; color: #64748b; font-size: 0.85rem; text-align: center;">
      Generated automatically by RendezVu Arena Match Operations System on ${new Date().toISOString()}.
    </div>
  </div>
</body>
</html>`;

  const filename = `match_${matchId}_${Date.now()}.html`;
  const filePath = path.join(reportsDir, filename);
  fs.writeFileSync(filePath, html, 'utf8');
  return { filename, filePath, html };
}

// Match Chat and shared attachment/evidence pipeline
app.get('/api/matches/:matchId/messages',authRequired,requireMatchAccess,(req,res)=>{
  const limit = Math.max(1, Math.min(500, parseInt(req.query.limit, 10) || 300));
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const raw = db.prepare(`SELECT mm.id,mm.sender_user_id,mm.sender_role,mm.sender_name,mm.message,mm.message_type,mm.file_id,mm.pinned,mm.is_pinned,mm.mentions_json,mm.edited_at,mm.deleted_at,mm.created_at,f.original_name file_name,f.mime_type file_mime FROM match_messages mm LEFT JOIN files f ON f.id=mm.file_id WHERE mm.match_id=? AND mm.deleted_at IS NULL ORDER BY mm.pinned DESC,mm.id ASC LIMIT ? OFFSET ?`).all(req.match.id, limit, offset);
  const messages = raw.map(m => ({ ...m, mentions: jsonParse(m.mentions_json, []), is_pinned: Boolean(m.pinned || m.is_pinned), pinned: Boolean(m.pinned || m.is_pinned) }));
  const pinnedMessages = messages.filter(m => m.is_pinned);
  const participants = db.prepare(`SELECT DISTINCT u.id, u.username, u.display_name, tm.team_id, tm.is_captain, tm.member_role FROM team_members tm JOIN users u ON u.id=tm.user_id WHERE tm.team_id IN (?,?) AND tm.membership_status='active'`).all(req.match.team_a_id || -1, req.match.team_b_id || -1);
  const last = messages.at(-1)?.id||0;
  if (last) db.prepare(`INSERT INTO match_message_reads(match_id,user_id,last_message_id) VALUES (?,?,?) ON CONFLICT(match_id,user_id) DO UPDATE SET last_message_id=excluded.last_message_id,updated_at=CURRENT_TIMESTAMP`).run(req.match.id,req.user.id,last);
  res.json({messages, pinnedMessages, participants});
});

app.post('/api/matches/:matchId/messages',authRequired,requireMatchAccess,(req,res)=>{
  if(!req.matchTeamId&&!matchPermission(req,'chat.send'))return res.status(403).json({error:'Chat permission required.'});
  const message=sanitizeText(req.body.message,1000);
  const fileId=req.body.fileId?Number(req.body.fileId):null;
  const mentions = Array.isArray(req.body.mentions) ? req.body.mentions.map(Number).filter(id => Number.isInteger(id) && id > 0) : [];
  const messageType = ['text', 'system', 'pin', 'user'].includes(req.body.messageType) ? req.body.messageType : 'user';
  if(!message&&!fileId)return res.status(400).json({error:'Message or attachment is required.'});
  let role=req.user.role;
  if(req.matchTeamId){
    const member=db.prepare(`SELECT member_role,is_captain FROM team_members WHERE team_id=? AND user_id=? AND membership_status='active' ORDER BY is_captain DESC,id LIMIT 1`).get(req.matchTeamId,req.user.id);
    role=member?.is_captain?'captain':(member?.member_role||'player');
  }
  const result=db.prepare(`INSERT INTO match_messages(match_id,sender_user_id,sender_role,sender_name,message,message_type,file_id,mentions_json,is_pinned,pinned) VALUES (?,?,?,?,?,?,?,?,0,0)`)
    .run(req.match.id,req.user.id,role,req.user.display_name,message,messageType,fileId,JSON.stringify(mentions));
  const saved=db.prepare(`SELECT mm.*,f.original_name file_name,f.mime_type file_mime FROM match_messages mm LEFT JOIN files f ON f.id=mm.file_id WHERE mm.id=?`).get(Number(result.lastInsertRowid));
  const formatted = { ...saved, mentions: jsonParse(saved.mentions_json, []), is_pinned: Boolean(saved.pinned || saved.is_pinned), pinned: Boolean(saved.pinned || saved.is_pinned) };
  emitInternalTournamentEvent(req.match.tournament_id,'match:chat',{matchId:req.match.id,message:formatted});
  io.to(internalTournamentRoom(req.match.tournament_id)).emit('chat:message', { matchId: req.match.id, message: formatted });
  const room=db.prepare('SELECT room_code FROM draft_rooms WHERE match_id=?').get(req.match.id);
  if(room){
    io.to(`draft:${room.room_code}`).emit('draft:chat',formatted);
    io.to(`draft:${room.room_code}`).emit('chat:message',formatted);
  }
  res.status(201).json({message:formatted});
});

app.post('/api/matches/:matchId/messages/:messageId/pin',authRequired,requireMatchAccess,(req,res)=>{
  if(!hasTournamentPermission(req.user.id,req.match.tournament_id,'chat.moderate'))return res.status(403).json({error:'Only staff can pin messages.'});
  const messageId=Number(req.params.messageId);
  const msg=db.prepare('SELECT * FROM match_messages WHERE id=? AND match_id=?').get(messageId,req.match.id);
  if(!msg)return res.status(404).json({error:'Message not found.'});
  const targetPin=req.body.pinned!==undefined?(req.body.pinned?1:0):(msg.is_pinned||msg.pinned?0:1);
  db.prepare('UPDATE match_messages SET pinned=?,is_pinned=?,edited_at=CURRENT_TIMESTAMP WHERE id=?').run(targetPin,targetPin,messageId);
  const updated=db.prepare(`SELECT mm.*,f.original_name file_name,f.mime_type file_mime FROM match_messages mm LEFT JOIN files f ON f.id=mm.file_id WHERE mm.id=?`).get(messageId);
  const formatted={ ...updated, mentions: jsonParse(updated.mentions_json, []), is_pinned: Boolean(updated.pinned || updated.is_pinned), pinned: Boolean(updated.pinned || updated.is_pinned) };
  emitInternalTournamentEvent(req.match.tournament_id,'match:chat_pin',{matchId:req.match.id,message:formatted,pinned:Boolean(targetPin)});
  io.to(internalTournamentRoom(req.match.tournament_id)).emit('chat:pin', { matchId: req.match.id, message: formatted, pinned: Boolean(targetPin) });
  const room=db.prepare('SELECT room_code FROM draft_rooms WHERE match_id=?').get(req.match.id);
  if(room){
    io.to(`draft:${room.room_code}`).emit('draft:chat_pin',formatted);
    io.to(`draft:${room.room_code}`).emit('chat:pin',formatted);
  }
  res.json({message:formatted,pinned:Boolean(targetPin)});
});

app.get('/api/matches/:matchId/report',authRequired,requireMatchAccess,(req,res)=>{
  const matchId=Number(req.params.matchId);
  const reportsDir=path.join(__dirname,'reports');
  let reportHtml=null;
  if(fs.existsSync(reportsDir)){
    const files=fs.readdirSync(reportsDir).filter(f=>f.startsWith(`match_${matchId}_`)).sort().reverse();
    if(files.length>0) reportHtml=fs.readFileSync(path.join(reportsDir,files[0]),'utf8');
  }
  if(!reportHtml){
    const generated=generateMatchReport(matchId);
    if(!generated)return res.status(404).json({error:'Match report could not be generated.'});
    reportHtml=generated.html;
  }
  if(req.query.download==='1'){
    res.setHeader('Content-Disposition',`attachment; filename="match_${matchId}_report.html"`);
  }
  res.type('html').send(reportHtml);
});

app.get('/api/draft-rooms/:roomId/logs',(req,res)=>{
  const roomIdParam=req.params.roomId;
  const limit=Math.max(1,Math.min(200,parseInt(req.query.limit,10)||100));
  const offset=Math.max(0,parseInt(req.query.offset,10)||0);
  const room=db.prepare('SELECT id,match_id,room_code FROM draft_rooms WHERE id=? OR room_code=?').get(roomIdParam,roomIdParam);
  if(!room)return res.status(404).json({error:'Draft room not found.'});
  const total=db.prepare('SELECT COUNT(*) count FROM draft_logs WHERE draft_room_id=?').get(room.id)?.count||0;
  const logs=db.prepare(`SELECT id,draft_room_id,match_id,event_type,event_data,created_at FROM draft_logs WHERE draft_room_id=? ORDER BY id ASC LIMIT ? OFFSET ?`)
    .all(room.id,limit,offset).map(row=>({...row,event_data:jsonParse(row.event_data,{})}));
  res.json({logs,total,limit,offset,roomCode:room.room_code});
});

app.get(['/broadcast/overlay','/broadcast/overlay/:matchId','/overlay/:matchId'],(req,res)=>{
  res.sendFile(path.join(__dirname,'overlay.html'));
});

app.get('/api/overlay/:matchId',(req,res)=>{
  const matchId=Number(req.params.matchId);
  const match=db.prepare(`
    SELECT m.*, t.name tournament_name, t.slug tournament_slug, t.rules_json tournament_rules_json,
           a.name team_a_name, a.tag team_a_tag, a.logo_url team_a_logo,
           b.name team_b_name, b.tag team_b_tag, b.logo_url team_b_logo,
           w.name winner_team_name
    FROM matches m
    JOIN tournaments t ON t.id=m.tournament_id
    LEFT JOIN teams a ON a.id=m.team_a_id
    LEFT JOIN teams b ON b.id=m.team_b_id
    LEFT JOIN teams w ON w.id=m.winner_team_id
    WHERE m.id=?
  `).get(matchId);
  if(!match)return res.status(404).json({error:'Match not found.'});
  const draftRoom=db.prepare('SELECT id, room_code, status, config_json, state_json FROM draft_rooms WHERE match_id=?').get(matchId);
  const games=db.prepare('SELECT * FROM match_games WHERE match_id=? ORDER BY game_number ASC').all(matchId);
  const miniBracket=listMatches(match.tournament_id);
  res.json({
    match:serializePublicMatch(match),
    tournament:{id:match.tournament_id,name:match.tournament_name,slug:match.tournament_slug},
    draft:draftRoom?{
      roomCode:draftRoom.room_code,
      status:draftRoom.status,
      config:jsonParse(draftRoom.config_json),
      state:jsonParse(draftRoom.state_json)
    }:null,
    games,
    miniBracket:miniBracket.map(serializePublicMatch)
  });
});

app.patch('/api/matches/:matchId/messages/:messageId',authRequired,requireMatchAccess,(req,res)=>{const message=db.prepare('SELECT * FROM match_messages WHERE id=? AND match_id=?').get(Number(req.params.messageId),req.match.id);if(!message)return res.status(404).json({error:'Message not found.'});const canModerate=hasTournamentPermission(req.user.id,req.match.tournament_id,'chat.moderate');if(message.sender_user_id!==req.user.id&&!canModerate)return res.status(403).json({error:'You cannot edit this message.'});if(req.body.pinned!==undefined&&!canModerate)return res.status(403).json({error:'Only staff can pin messages.'});if(req.body.message!==undefined){if(message.message_type==='system')return res.status(400).json({error:'System messages cannot be edited.'});db.prepare('UPDATE match_messages SET message=?,edited_at=CURRENT_TIMESTAMP WHERE id=?').run(String(req.body.message||'').trim().slice(0,1000),message.id);}if(req.body.pinned!==undefined)db.prepare('UPDATE match_messages SET pinned=?,is_pinned=? WHERE id=?').run(req.body.pinned?1:0,req.body.pinned?1:0,message.id);res.json({message:db.prepare('SELECT * FROM match_messages WHERE id=?').get(message.id)});});
app.delete('/api/matches/:matchId/messages/:messageId',authRequired,requireMatchAccess,(req,res)=>{const message=db.prepare('SELECT * FROM match_messages WHERE id=? AND match_id=?').get(Number(req.params.messageId),req.match.id);if(!message)return res.status(404).json({error:'Message not found.'});const canModerate=hasTournamentPermission(req.user.id,req.match.tournament_id,'chat.moderate');if(message.sender_user_id!==req.user.id&&!canModerate)return res.status(403).json({error:'You cannot delete this message.'});if(message.message_type==='system')return res.status(400).json({error:'System messages cannot be deleted.'});db.prepare('UPDATE match_messages SET deleted_at=CURRENT_TIMESTAMP,message=\'[deleted]\' WHERE id=?').run(message.id);res.json({deleted:true});});
app.post('/api/matches/:matchId/files',authRequired,requireMatchAccess,(req,res)=>{try{const purpose=String(req.body.purpose||'evidence');let entityType='match',entityId=req.match.id,visibility='match_members';if(purpose==='evidence'){if(!req.matchTeamId&&!hasTournamentPermission(req.user.id,req.match.tournament_id,'evidence.read'))return res.status(403).json({error:'Evidence permission required.'});const dispute=db.prepare(`SELECT id FROM disputes WHERE match_id=? AND status IN ('open','under_review','recommended') ORDER BY id DESC LIMIT 1`).get(req.match.id);if(!dispute)return res.status(409).json({error:'Evidence can only be uploaded while a dispute is open.'});entityType='dispute';entityId=dispute.id;visibility='staff_only';}else if(purpose!=='chat_attachment')return res.status(400).json({error:'Unsupported file purpose.'});const file=saveFile({userId:req.user.id,tournamentId:req.match.tournament_id,entityType,entityId,purpose,originalName:req.body.originalName,mimeType:req.body.mimeType,dataBase64:req.body.dataBase64,visibility});res.status(201).json({file:{id:file.id,originalName:file.original_name,mimeType:file.mime_type,sizeBytes:file.size_bytes,visibility:file.visibility}});}catch(error){res.status(400).json({error:clientErrorMessage(error)});}});
app.get('/api/files/:fileId',authRequired,(req,res)=>{const file=fileRecord(Number(req.params.fileId));if(!file)return res.status(404).json({error:'File not found.'});let allowed=false;if(file.entity_type==='match'||file.entity_type==='dispute'||file.entity_type==='match_chat_message'){const matchId=file.entity_type==='match'?file.entity_id:file.entity_type==='dispute'?db.prepare('SELECT match_id FROM disputes WHERE id=?').get(file.entity_id)?.match_id:db.prepare('SELECT match_id FROM match_messages WHERE id=?').get(file.entity_id)?.match_id;const context=canAccessMatch(req.user.id,matchId);allowed=context.allowed&&(file.visibility!=='staff_only'||hasTournamentPermission(req.user.id,context.match.tournament_id,'evidence.read'));}if(!allowed)return res.status(403).json({error:'File access denied.'});const full=filePath(file);if(!full||!fs.existsSync(full))return res.status(410).json({error:'File has expired or was removed.'});const fileName=String(file.original_name).replace(/["\r\n]/g,'');const inline=req.query.inline==='1'&&String(file.mime_type||'').startsWith('image/');res.type(file.mime_type);res.setHeader('Content-Disposition',`${inline?'inline':'attachment'}; filename="${fileName}"`);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");res.setHeader('Cache-Control','private, max-age=300');res.setHeader('Content-Length',String(file.size_bytes));res.sendFile(full);});

// Player & Captain portal
app.get('/api/portal',authRequired,(req,res)=>{
  // Find teams where user is either a team member OR the captain
  const teams=db.prepare(`SELECT DISTINCT t.*,tr.name tournament_name,tr.slug tournament_slug,tr.roster_lock_at tournament_roster_lock_at,
    CASE WHEN t.captain_user_id=? THEN 'captain' ELSE COALESCE(tm.member_role, 'player') END my_member_role,
    CASE WHEN t.captain_user_id=? THEN 1 ELSE 0 END my_is_captain
    FROM teams t 
    JOIN tournaments tr ON tr.id=t.tournament_id 
    LEFT JOIN team_members tm ON tm.team_id=t.id AND tm.user_id=? AND tm.membership_status='active'
    WHERE tm.user_id=? OR t.captain_user_id=?
    ORDER BY tr.updated_at DESC`).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);
  const teamIds=teams.map(team=>team.id);let matches=[];
  if(teamIds.length){
    const placeholders=teamIds.map(()=>'?').join(',');
    matches=db.prepare(`SELECT m.*,a.name team_a_name,a.tag team_a_tag,b.name team_b_name,b.tag team_b_tag,t.name tournament_name,t.slug tournament_slug,
      COALESCE(m.scheduled_at,ss.scheduled_at,t.start_at) effective_scheduled_at,
      EXISTS(SELECT 1 FROM draft_rooms dr WHERE dr.match_id=m.id) draft_room_ready
      FROM matches m JOIN tournaments t ON t.id=m.tournament_id LEFT JOIN stage_schedules ss ON ss.tournament_id=m.tournament_id AND ss.stage_key=m.stage
      LEFT JOIN teams a ON a.id=m.team_a_id LEFT JOIN teams b ON b.id=m.team_b_id
      WHERE m.team_a_id IN (${placeholders}) OR m.team_b_id IN (${placeholders}) ORDER BY m.updated_at DESC`).all(...teamIds,...teamIds)
      .map(match=>serializeTournamentMatchForUser(match,permissionsForUser(req.user.id,match.tournament_id)));
    const matchedTeamIds=new Set(matches.flatMap(match=>[Number(match.team_a_id),Number(match.team_b_id)]));
    const members=db.prepare(`SELECT id,team_id,user_id,display_name,gamer_tag,member_role,membership_status,is_captain,is_substitute
      FROM team_members WHERE team_id IN (${placeholders}) ORDER BY team_id,is_captain DESC,id`).all(...teamIds);
    teams.forEach(team=>{
      const rosterVisible=team.formation_source!=='solo_randomizer'||matchedTeamIds.has(Number(team.id));
      const teamMembers=members.filter(member=>Number(member.team_id)===Number(team.id));
      
      // For captains without team_members entry, create a temporary entry
      if(teamMembers.length===0 && Number(team.captain_user_id)===Number(req.user.id)){
        const captainUser=db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
        if(captainUser){
          teamMembers.push({
            id:0,
            team_id:team.id,
            user_id:captainUser.id,
            display_name:captainUser.display_name,
            gamer_tag:captainUser.gamer_tag||captainUser.username,
            member_role:'captain',
            membership_status:'active',
            is_captain:1,
            is_substitute:0
          });
        }
      }
      
      team.members=rosterVisible?teamMembers:[];
      team.rosterPrivate=!rosterVisible;
    });
  }
  const joinRequests=db.prepare(`SELECT jr.*,t.name tournament_name,tm.name team_name FROM tournament_join_requests jr JOIN tournaments t ON t.id=jr.tournament_id LEFT JOIN teams tm ON tm.id=jr.team_id WHERE jr.user_id=? ORDER BY jr.id DESC LIMIT 50`).all(req.user.id);
  res.json({user:cleanUser(req.user),teams,matches,joinRequests,history:userTournamentHistory(req.user.id)});
});

// Draft rooms and series game progression
function findDraftRoom(roomCode) {
  const room = db.prepare('SELECT * FROM draft_rooms WHERE room_code=?').get(String(roomCode || '').toUpperCase());
  return room ? ensureDraftRoomRollIdentity(room) : room;
}

function ensureDraftRoomRollIdentity(room) {
  if (!room) return room;
  const match = db.prepare('SELECT current_game_number FROM matches WHERE id=?').get(room.match_id);
  if (!match) return room;
  const currentGameNumber = Number(match.current_game_number || 1);
  let config = jsonParse(room.config_json);
  let state = jsonParse(room.state_json);
  const configGameNumber = Number(config.gameNumber || currentGameNumber);
  const previousRollId = configGameNumber === currentGameNumber && validDraftGameRollId(config.gameRollId)
    ? config.gameRollId
    : null;
  const gameRollId = previousRollId || newDraftGameRollId();
  config = { ...config, gameNumber: currentGameNumber, gameRollId };

  const stateGameNumber = Number(state.gameNumber || state.engine?.gameNumber || currentGameNumber);
  if (stateGameNumber !== currentGameNumber) {
    state = { status: 'waiting', gameNumber: currentGameNumber, gameRollId, reloadRequired: true };
  } else {
    state = { ...state, gameNumber: currentGameNumber, gameRollId };
    if (state.preDraft && typeof state.preDraft === 'object' && !Array.isArray(state.preDraft)) {
      state.preDraft = { ...state.preDraft, gameNumber: currentGameNumber, gameRollId };
      if (state.preDraft.divine && typeof state.preDraft.divine === 'object' && !Array.isArray(state.preDraft.divine)) {
        state.preDraft.divine = { ...state.preDraft.divine, gameNumber: currentGameNumber, gameRollId };
      }
    }
  }

  const configJson = JSON.stringify(config);
  const stateJson = JSON.stringify(state);
  if (configJson !== room.config_json || stateJson !== room.state_json) {
    db.prepare('UPDATE draft_rooms SET config_json=?,state_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
      .run(configJson, stateJson, room.id);
    return db.prepare('SELECT * FROM draft_rooms WHERE id=?').get(room.id);
  }
  return room;
}

function resolveDraftRole(room, accessToken) {
  const access = jsonParse(room.access_json);
  return Object.entries(access).find(([, token]) => token === accessToken)?.[0] || null;
}

function tournamentHasMockPlayers(tournamentId) {
  if (!tournamentId) return false;
  try {
    const count = db.prepare(`SELECT COUNT(*) as count FROM users u JOIN tournament_join_requests jr ON jr.user_id=u.id WHERE jr.tournament_id=? AND (u.username LIKE '%_bot_%' OR u.username LIKE 'mock_%' OR u.username LIKE 'solo_bot_%')`).get(tournamentId)?.count;
    return Number(count || 0) > 0;
  } catch {
    return false;
  }
}

function aggregateSeriesPicks(matchId) {
  const games = db.prepare(`SELECT * FROM match_games WHERE match_id=? AND status IN ('draft_complete','completed') ORDER BY game_number`).all(matchId);
  const picksA = [];
  const picksB = [];
  games.forEach(game => {
    picksA.push(...jsonParse(game.picks_a_json, []));
    picksB.push(...jsonParse(game.picks_b_json, []));
  });
  return { games, picksA, picksB };
}
function serializeTournamentMatchForUser(match,permissionContext) {
  const permissions=permissionContext?.permissions||[];
  if(permissions.includes('*')||permissions.includes('match.notes.private.read'))return match;
  const {private_notes:_privateNotes,notes:_notes,...safe}=match;
  return safe;
}

function squadraBlastPhase(gameNumber = 1) {
  const normalized = Math.max(1, Math.floor(Number(gameNumber) || 1));
  return ((normalized - 1) % 3) + 1;
}

function seriesDraftHistory(matchId, seriesRule, gameNumber) {
  if (seriesRule !== 'squadra_blast') {
    const history = aggregateSeriesPicks(matchId);
    return { ...history, bansA: [], bansB: [] };
  }
  if (squadraBlastPhase(gameNumber) !== 2) {
    return { games: [], picksA: [], picksB: [], bansA: [], bansB: [] };
  }
  const previousGame = db.prepare(`
    SELECT * FROM match_games
    WHERE match_id=? AND game_number=? AND status IN ('draft_complete','completed')
  `).get(matchId, Math.max(1, Number(gameNumber) - 1));
  if (!previousGame) return { games: [], picksA: [], picksB: [], bansA: [], bansB: [] };
  return {
    games: [previousGame],
    picksA: jsonParse(previousGame.picks_a_json, []),
    picksB: jsonParse(previousGame.picks_b_json, []),
    bansA: jsonParse(previousGame.bans_a_json, []),
    bansB: jsonParse(previousGame.bans_b_json, []),
  };
}

function seriesGameScore(match) {
  const games = db.prepare(`SELECT * FROM match_games WHERE match_id=? ORDER BY game_number`).all(match.id);
  let scoreA = 0;
  let scoreB = 0;
  games.forEach(game => {
    if (game.status !== 'completed' || !game.winner_team_id) return;
    if (Number(game.winner_team_id) === Number(match.team_a_id)) scoreA += 1;
    if (Number(game.winner_team_id) === Number(match.team_b_id)) scoreB += 1;
  });
  return { games, scoreA, scoreB };
}

function draftRoomPayload(req, room, access) {
  const base = `${req.protocol}://${req.get('host')}`;
  const links = Object.fromEntries(Object.entries(access).map(([role, token]) => {
    const route = role === 'broadcaster' ? '/broadcast.html' : '/draft-room.html';
    return [role, `${base}${route}#room=${encodeURIComponent(room.room_code)}&access=${encodeURIComponent(token)}`];
  }));
  return {
    id: room.id,
    roomCode: room.room_code,
    status: room.status,
    config: jsonParse(room.config_json),
    links,
  };
}

function draftRoomAccessForRequest(req, room, access, { requestedRole = null } = {}) {
  let role = null;
  if (requestedRole === 'broadcaster') {
    const canWatch = hasTournamentPermission(req.user.id, req.match.tournament_id, 'draft.control')
      || hasTournamentPermission(req.user.id, req.match.tournament_id, 'broadcast.control');
    if (canWatch) role = 'broadcaster';
  } else if (hasTournamentPermission(req.user.id, req.match.tournament_id, 'draft.control')) role = 'host';
  else if (hasTournamentPermission(req.user.id, req.match.tournament_id, 'dispute.review')) role = 'referee';
  else if (hasTournamentPermission(req.user.id, req.match.tournament_id, 'broadcast.control')) role = 'broadcaster';
  else if (Number(req.matchTeamId) === Number(req.match?.team_a_id) && teamForCaptain(req.user.id, req.matchTeamId)) role = 'teamA';
  else if (Number(req.matchTeamId) === Number(req.match?.team_b_id) && teamForCaptain(req.user.id, req.matchTeamId)) role = 'teamB';
  if (!role || !access[role]) return null;
  const route = role === 'broadcaster' ? '/broadcast.html' : '/draft-room.html';
  return {
    roomCode: room.room_code,
    role,
    url: `${req.protocol}://${req.get('host')}${route}#room=${encodeURIComponent(room.room_code)}&access=${encodeURIComponent(access[role])}`,
  };
}

function draftRoomResultPayload(room) {
  return {
    id: room.id,
    roomCode: room.room_code,
    status: room.status,
    config: jsonParse(room.config_json),
  };
}

function quickDraftConfig(input = {}) {
  const cleanIds = value => [...new Set((Array.isArray(value) ? value : [])
    .map(item => String(item || '').trim())
    .filter(item => /^\d{4}$/.test(item))
    .slice(0, 80))];
  const format = ['BO1','BO3','BO5','BO7'].includes(String(input.format || '').toUpperCase())
    ? String(input.format).toUpperCase() : 'BO3';
  const seriesRule = ['normal','fearless','team_no_repeat','squadra_blast'].includes(String(input.seriesRule || ''))
    ? String(input.seriesRule) : 'normal';
  const mirrorPickMode = normalizeMirrorPickMode(input);
  const draftStyle = input.draftStyle === 'all-random' ? 'all-random' : 'standard';
  const divineDrawMode = ['random','pickban','ban-random'].includes(String(input.divineDrawMode || ''))
    ? String(input.divineDrawMode) : 'random';
  const sessionId = String(input.sessionId || '').trim().slice(0, 120);
  if (!/^[A-Za-z0-9_-]{8,120}$/.test(sessionId)) throw new Error('Quick Draft session ID is invalid. Reset the form and try again.');
  return {
    sessionId,
    teamA: sanitizeText(input.teamA || 'TEAM BLUE', 60) || 'TEAM BLUE',
    teamB: sanitizeText(input.teamB || 'TEAM RED', 60) || 'TEAM RED',
    teamALogoUrl: isSafeExternalUrl(input.teamALogoUrl) ? String(input.teamALogoUrl).slice(0, 1000) : '',
    teamBLogoUrl: isSafeExternalUrl(input.teamBLogoUrl) ? String(input.teamBLogoUrl).slice(0, 1000) : '',
    format,
    gameNumber: Math.max(1, Math.min(99, Number(input.gameNumber || 1))),
    seriesRule,
    seriesScoreA: Math.max(0, Math.min(99, Number(input.seriesScoreA || 0))),
    seriesScoreB: Math.max(0, Math.min(99, Number(input.seriesScoreB || 0))),
    previousPicksA: cleanIds(input.previousPicksA),
    previousPicksB: cleanIds(input.previousPicksB),
    previousBansA: cleanIds(input.previousBansA),
    previousBansB: cleanIds(input.previousBansB),
    squadraBlastCarryBans: input.squadraBlastCarryBans !== false,
    timerSeconds: Math.max(10, Math.min(90, Number(input.timerSeconds || 30))),
    heroBans: Math.max(0, Math.min(12, Number(input.heroBans || 0))),
    divineBans: Math.max(0, Math.min(12, Number(input.divineBans || 0))),
    separateBanPool: input.separateBanPool === true,
    sameHeroAllowed: mirrorPickMode !== 'none',
    globalPick: input.globalPick === true,
    mirrorPickMode,
    enableProtect: input.enableProtect === true,
    protectNewest: input.protectNewest === true,
    protectList: cleanIds(input.protectList),
    globalBanList: cleanIds(input.globalBanList),
    heroRuleScope: ['game','match','tournament'].includes(String(input.heroRuleScope || '')) ? String(input.heroRuleScope) : 'match',
    enableTrailer: input.enableTrailer !== false,
    cinematicLockIn: input.cinematicLockIn !== false,
    dualHover: input.dualHover !== false,
    flashAndShake: input.flashAndShake === true,
    theme: sanitizeText(input.theme || 'beerus', 40) || 'beerus',
    draftStyle,
    enableCoinFlip: input.enableCoinFlip !== false,
    enableDivineDraw: input.enableDivineDraw !== false,
    divineDrawMode,
    roomMode: 'bandai-tool',
    roomCode: sanitizeText(input.roomCode || '', 80),
    quickDraft: true,
  };
}

// Quick Draft uses the same server-authoritative Draft Room and role capability
// system as tournament matches. The hidden backing event is deliberately
// excluded from Tournament Operations and profile history.
app.post('/api/quick-draft-rooms', authRequired, emailVerifiedRequired, (req, res) => {
  try {
    let config = quickDraftConfig(req.body?.config || req.body || {});
    let externalId = `quick:${req.user.id}:${config.sessionId}`;
    let tournament = db.prepare(`SELECT * FROM tournaments
      WHERE source_platform='quick_draft' AND source_external_id=? AND host_user_id=? LIMIT 1`)
      .get(externalId, req.user.id);
    let room;
    let access;

    if (tournament) {
      const existingMatch = db.prepare(`SELECT * FROM matches
        WHERE tournament_id=? AND stage='quick' ORDER BY id LIMIT 1`).get(tournament.id);
      const existingRoom = existingMatch
        ? db.prepare('SELECT * FROM draft_rooms WHERE match_id=?').get(existingMatch.id)
        : null;
      const existingState = existingRoom ? jsonParse(existingRoom.state_json) : {};
      const pristine = existingMatch
        && existingRoom
        && Number(existingMatch.current_game_number || 1) === 1
        && Number(existingMatch.score_a || 0) === 0
        && Number(existingMatch.score_b || 0) === 0
        && existingRoom.status === 'waiting'
        && existingState.status === 'waiting'
        && !existingState.engine
        && !existingState.preDraft
        && !Array.isArray(existingState.chosenDivineRules);
      if (!pristine) {
        config = {
          ...config,
          sessionId: `${config.sessionId.slice(0, 96)}-${randomCode(16)}`,
          gameNumber: 1,
          seriesScoreA: 0,
          seriesScoreB: 0,
          previousPicksA: [],
          previousPicksB: [],
          previousBansA: [],
          previousBansB: [],
        };
        externalId = `quick:${req.user.id}:${config.sessionId}`;
        tournament = null;
      }
    }

    transaction(() => {
      if (!tournament) {
        let slug = `quick-${req.user.id}-${randomCode(10).toLowerCase()}`;
        while (db.prepare('SELECT 1 FROM tournaments WHERE slug=?').get(slug)) slug = `quick-${req.user.id}-${randomCode(10).toLowerCase()}`;
        const tournamentId = Number(db.prepare(`INSERT INTO tournaments(
          host_user_id,name,slug,description,source_platform,source_external_id,source_sync_status,status,timezone,default_server,is_public,rules_json
        ) VALUES (?,?,?,?,?,?,?,'running','Asia/Ho_Chi_Minh','Asia',0,?)`)
          .run(req.user.id, `Quick Draft: ${config.teamA} vs ${config.teamB}`, slug,
            'Private server-backed Quick Draft room.', 'quick_draft', externalId, 'internal', JSON.stringify(config)).lastInsertRowid);
        const teamAId = Number(db.prepare(`INSERT INTO teams(tournament_id,name,tag,logo_url,source,status,team_status,seed)
          VALUES (?,?,?,?, 'manual','approved','ready',1)`)
          .run(tournamentId, config.teamA, makeTeamTag(config.teamA), config.teamALogoUrl).lastInsertRowid);
        const teamBId = Number(db.prepare(`INSERT INTO teams(tournament_id,name,tag,logo_url,source,status,team_status,seed)
          VALUES (?,?,?,?, 'manual','approved','ready',2)`)
          .run(tournamentId, config.teamB, makeTeamTag(config.teamB), config.teamBLogoUrl).lastInsertRowid);
        const bestOf = Number(config.format.replace(/\D/g, '')) || 3;
        const matchId = Number(db.prepare(`INSERT INTO matches(
          tournament_id,bracket_type,bracket_side,stage,round_no,round_name,position,team_a_id,team_b_id,best_of,series_rule,
          current_game_number,status,match_status,result_status,timezone,server_region,rules_json
        ) VALUES (?,'single','winners','quick',1,'Quick Draft',1,?,?,?,?,1,'available','available','none','Asia/Ho_Chi_Minh','Asia',?)`)
          .run(tournamentId, teamAId, teamBId, bestOf, config.seriesRule, JSON.stringify(config)).lastInsertRowid);
        db.prepare(`INSERT INTO match_games(match_id,game_number,status,server_region,room_code)
          VALUES (?,1,'waiting_draft','Asia','')`).run(matchId);
        access = { host: randomCode(32), teamA: randomCode(32), teamB: randomCode(32), broadcaster: randomCode(32) };
        const roomCode = randomCode(8);
        const gameRollId = newDraftGameRollId();
        const storedConfig = { ...config, matchId, tournamentId, roundName: 'Quick Draft', gameRollId };
        const roomId = Number(db.prepare(`INSERT INTO draft_rooms(match_id,room_code,config_json,state_json,access_json,created_by)
          VALUES (?,?,?,?,?,?)`).run(matchId, roomCode, JSON.stringify(storedConfig),
            JSON.stringify({ status:'waiting', gameNumber:1, gameRollId, seriesScoreA:0, seriesScoreB:0 }), JSON.stringify(access), req.user.id).lastInsertRowid);
        tournament = db.prepare('SELECT * FROM tournaments WHERE id=?').get(tournamentId);
        room = db.prepare('SELECT * FROM draft_rooms WHERE id=?').get(roomId);
      } else {
        const match = db.prepare(`SELECT m.*,a.id team_a_id_existing,b.id team_b_id_existing
          FROM matches m LEFT JOIN teams a ON a.id=m.team_a_id LEFT JOIN teams b ON b.id=m.team_b_id
          WHERE m.tournament_id=? AND m.stage='quick' ORDER BY m.id LIMIT 1`).get(tournament.id);
        if (!match) throw new Error('Quick Draft backing match is missing. Reset the form and create a new room.');
        const bestOf = Number(config.format.replace(/\D/g, '')) || 3;
        db.prepare(`UPDATE tournaments SET name=?,rules_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .run(`Quick Draft: ${config.teamA} vs ${config.teamB}`, JSON.stringify(config), tournament.id);
        db.prepare(`UPDATE teams SET name=?,tag=?,logo_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .run(config.teamA, makeTeamTag(config.teamA), config.teamALogoUrl, match.team_a_id);
        db.prepare(`UPDATE teams SET name=?,tag=?,logo_url=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .run(config.teamB, makeTeamTag(config.teamB), config.teamBLogoUrl, match.team_b_id);
        db.prepare(`UPDATE matches SET best_of=?,series_rule=?,rules_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .run(bestOf, config.seriesRule, JSON.stringify(config), match.id);
        room = db.prepare('SELECT * FROM draft_rooms WHERE match_id=?').get(match.id);
        if (!room) throw new Error('Quick Draft room is missing. Reset the form and create a new room.');
        access = jsonParse(room.access_json);
        const oldConfig = jsonParse(room.config_json);
        const gameRollId = validDraftGameRollId(oldConfig.gameRollId) ? oldConfig.gameRollId : newDraftGameRollId();
        const storedConfig = {
          ...config,
          matchId: match.id,
          tournamentId: tournament.id,
          roundName: 'Quick Draft',
          gameNumber: Number(oldConfig.gameNumber || config.gameNumber || 1),
          seriesScoreA: Number(oldConfig.seriesScoreA || 0),
          seriesScoreB: Number(oldConfig.seriesScoreB || 0),
          previousPicksA: oldConfig.previousPicksA || config.previousPicksA,
          previousPicksB: oldConfig.previousPicksB || config.previousPicksB,
          previousBansA: oldConfig.previousBansA || config.previousBansA,
          previousBansB: oldConfig.previousBansB || config.previousBansB,
          gameRollId,
        };
        const oldState = jsonParse(room.state_json);
        const storedState = {
          ...oldState,
          gameNumber: Number(oldConfig.gameNumber || 1),
          gameRollId,
        };
        db.prepare(`UPDATE draft_rooms SET config_json=?,state_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
          .run(JSON.stringify(storedConfig), JSON.stringify(storedState), room.id);
        room = db.prepare('SELECT * FROM draft_rooms WHERE id=?').get(room.id);
      }
    });

    res.status(201).json({ room: draftRoomPayload(req, room, access) });
  } catch (error) {
    res.status(400).json({ error: clientErrorMessage(error, 'Quick Draft room could not be created.') });
  }
});

function draftMatchContext(matchId) {
  return db.prepare(`
    SELECT m.*,a.name team_a_name,b.name team_b_name,a.logo_url team_a_logo,b.logo_url team_b_logo,
      t.name tournament_name,t.start_at tournament_start_at,t.rules_json tournament_rules_json
    FROM matches m
    JOIN tournaments t ON t.id=m.tournament_id
    LEFT JOIN teams a ON a.id=m.team_a_id
    LEFT JOIN teams b ON b.id=m.team_b_id
    WHERE m.id=?
  `).get(matchId);
}

function draftEngineTeamsByEntrant(state = {}) {
  const engine = state.engine || {};
  const assignment = state.preDraft?.sideAssignment;
  const swapped = assignment?.A === 'teamB' && assignment?.B === 'teamA';
  return swapped
    ? { teamA: engine.teamB || {}, teamB: engine.teamA || {} }
    : { teamA: engine.teamA || {}, teamB: engine.teamB || {} };
}

function draftSideForRoomRole(room, role) {
  if (!['teamA', 'teamB'].includes(role)) return null;
  const state = jsonParse(room?.state_json);
  const assignment = state?.preDraft?.sideAssignment;
  if (assignment?.A === role) return 'A';
  if (assignment?.B === role) return 'B';
  return role === 'teamB' ? 'B' : 'A';
}

function saveDraftSnapshotToGame({ match, room, state, winnerTeamId = null, status = 'draft_complete' }) {
  const engine = draftEngineTeamsByEntrant(state);
  db.prepare(`
    UPDATE match_games SET
      status=?,winner_team_id=?,picks_a_json=?,picks_b_json=?,bans_a_json=?,bans_b_json=?,
      divine_json=?,draft_snapshot_json=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP
    WHERE match_id=? AND game_number=?
  `).run(
    status,
    winnerTeamId,
    JSON.stringify(engine.teamA?.picks || []),
    JSON.stringify(engine.teamB?.picks || []),
    JSON.stringify(engine.teamA?.bans || []),
    JSON.stringify(engine.teamB?.bans || []),
    JSON.stringify(state.chosenDivineRules || []),
    JSON.stringify(state),
    match.id,
    Number(match.current_game_number || 1),
  );
}

function refreshedDraftConfig(match, room) {
  const config = jsonParse(room.config_json);
  const effectiveRules = { ...jsonParse(match.tournament_rules_json), ...jsonParse(match.rules_json) };
  const series = seriesDraftHistory(match.id, match.series_rule, match.current_game_number);
  const score = seriesGameScore(match);
  const squadraBlastCarryBans = config.squadraBlastCarryBans !== false;
  const currentGameNumber = Number(match.current_game_number || 1);
  const gameRollId = Number(config.gameNumber || 0) === currentGameNumber && validDraftGameRollId(config.gameRollId)
    ? config.gameRollId
    : newDraftGameRollId();
  Object.assign(config, {
    teamA: match.team_a_name,
    teamB: match.team_b_name,
    teamAId: match.team_a_id,
    teamBId: match.team_b_id,
    teamALogoUrl: match.team_a_logo || '',
    teamBLogoUrl: match.team_b_logo || '',
    format: `BO${match.best_of}`,
    gameNumber: currentGameNumber,
    gameRollId,
    seriesRule: match.series_rule,
    squadraBlastCarryBans,
    seriesScoreA: score.scoreA,
    seriesScoreB: score.scoreB,
    previousPicksA: series.picksA,
    previousPicksB: series.picksB,
    previousBansA: squadraBlastCarryBans ? series.bansA : [],
    previousBansB: squadraBlastCarryBans ? series.bansB : [],
    enableCoinFlip: currentGameNumber > 1 ? false : (effectiveRules.enableCoinFlip !== false && config.enableCoinFlip !== false),
    enableDivineDraw: effectiveRules.enableDivineDraw !== false && config.enableDivineDraw !== false,
    mockAutoOpponent: tournamentHasMockPlayers(match.tournament_id),
    roomCode: match.room_code || config.roomCode || '',
  });
  return config;
}

function recordDraftGameWinner(req, winnerSide, { nextDraftUrl = null, expectedGameNumber = null } = {}) {
  const match = draftMatchContext(req.match.id);
  if (!match) throw new Error('Match not found.');
  if (!match.team_a_id || !match.team_b_id) throw new Error('Both teams must be assigned.');

  const side = String(winnerSide || '').toUpperCase();
  if (!['A', 'B'].includes(side)) throw new Error('Choose Team A or Team B as the game winner.');

  const room = db.prepare('SELECT * FROM draft_rooms WHERE match_id=?').get(match.id);
  if (!room) throw new Error('Create the Draft Room first.');
  const state = jsonParse(room.state_json);
  const config = jsonParse(room.config_json);
  const currentGameNumber = Number(match.current_game_number || 1);
  const requestedGameNumber = Number(expectedGameNumber);
  const roomGameNumber = Number(config.gameNumber || state.gameNumber || state.engine?.gameNumber || currentGameNumber);
  const stateGameNumber = Number(state.gameNumber || state.engine?.gameNumber || roomGameNumber);
  if (!Number.isInteger(requestedGameNumber) || requestedGameNumber <= 0) {
    const error = new Error('The current game number is required when recording a Draft result.');
    error.status = 400;
    throw error;
  }
  if (requestedGameNumber !== currentGameNumber || roomGameNumber !== currentGameNumber || stateGameNumber !== currentGameNumber) {
    const error = new Error(`Game ${requestedGameNumber} is stale; the Draft Room is on Game ${currentGameNumber}. Reload before recording a result.`);
    error.status = 409;
    throw error;
  }
  if (state.engine?.state !== 'complete' && !req.body.force) {
    throw new Error('The current ban/pick must be complete before recording the game winner.');
  }

  const currentGame = db.prepare('SELECT * FROM match_games WHERE match_id=? AND game_number=?').get(match.id, currentGameNumber);
  if (!currentGame) throw new Error('Current game record was not found.');
  if (currentGame.status === 'completed' && currentGame.winner_team_id) {
    throw new Error(`Game ${currentGameNumber} already has a winner.`);
  }

  const winnerTeamId = side === 'A' ? Number(match.team_a_id) : Number(match.team_b_id);
  saveDraftSnapshotToGame({ match, room, state, winnerTeamId, status: 'completed' });

  const score = seriesGameScore(match);
  const winsNeeded = Math.floor(Number(match.best_of) / 2) + 1;
  const seriesComplete = score.scoreA >= winsNeeded || score.scoreB >= winsNeeded;
  const access = jsonParse(room.access_json);
  const refreshedConfig = refreshedDraftConfig(match, room);
  refreshedConfig.seriesScoreA = score.scoreA;
  refreshedConfig.seriesScoreB = score.scoreB;

  if (seriesComplete) {
    const finalState = {
      ...state,
      status: 'series_complete',
      seriesComplete: true,
      seriesScoreA: score.scoreA,
      seriesScoreB: score.scoreB,
      winnerTeamId,
    };
    db.prepare(`UPDATE matches SET score_a=?,score_b=?,status='completed',match_status='completed',updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(score.scoreA, score.scoreB, match.id);
    db.prepare(`UPDATE draft_rooms SET config_json=?,state_json=?,status='series_complete',updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(JSON.stringify(refreshedConfig), JSON.stringify(finalState), room.id);
    addSystemMessage(match.id, `Series score updated: ${match.team_a_name} ${score.scoreA} - ${score.scoreB} ${match.team_b_name}. The BO series is complete.`);
    io.to(`draft:${room.room_code}`).emit('draft:state', finalState);
    emitBracketUpdated(match.tournament_id);
    const savedRoom = db.prepare('SELECT * FROM draft_rooms WHERE id=?').get(room.id);
    return {
      room: draftRoomResultPayload(savedRoom),
      seriesComplete: true,
      currentGameNumber,
      scoreA: score.scoreA,
      scoreB: score.scoreB,
      winsNeeded,
      winnerTeamId,
    };
  }

  const nextGameNumber = currentGameNumber + 1;
  if (nextGameNumber > Number(match.best_of)) throw new Error(`BO${match.best_of} cannot have more than ${match.best_of} games.`);

  db.prepare(`
    INSERT INTO match_games(match_id,game_number,status,server_region,room_code)
    VALUES (?,?,'waiting_draft',?,?)
    ON CONFLICT(match_id,game_number) DO NOTHING
  `).run(match.id, nextGameNumber, match.server_region, match.room_code || '');
  db.prepare(`UPDATE matches SET score_a=?,score_b=?,current_game_number=?,status='drafting',match_status='drafting',updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(score.scoreA, score.scoreB, nextGameNumber, match.id);

  const updatedMatch = draftMatchContext(match.id);
  const nextConfig = refreshedDraftConfig(updatedMatch, room);
  nextConfig.gameNumber = nextGameNumber;
  nextConfig.seriesScoreA = score.scoreA;
  nextConfig.seriesScoreB = score.scoreB;
  const nextState = {
    status: 'waiting',
    gameNumber: nextGameNumber,
    gameRollId: nextConfig.gameRollId,
    seriesScoreA: score.scoreA,
    seriesScoreB: score.scoreB,
    seriesRule: updatedMatch.series_rule,
    reloadRequired: true,
  };

  db.prepare(`UPDATE draft_rooms SET config_json=?,state_json=?,status='waiting',updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(JSON.stringify(nextConfig), JSON.stringify(nextState), room.id);
  addSystemMessage(match.id, `Game ${currentGameNumber} winner recorded. Score: ${match.team_a_name} ${score.scoreA} - ${score.scoreB} ${match.team_b_name}. Draft Room prepared for Game ${nextGameNumber}; ${updatedMatch.series_rule} history is active.`);
  io.to(`draft:${room.room_code}`).emit('draft:state', nextState);
  emitBracketUpdated(match.tournament_id);
  const savedRoom = db.prepare('SELECT * FROM draft_rooms WHERE id=?').get(room.id);
  const nextAccess = nextDraftUrl ? { url: nextDraftUrl } : draftRoomAccessForRequest(req, savedRoom, access);
  return {
    room: draftRoomResultPayload(savedRoom),
    seriesComplete: false,
    currentGameNumber,
    nextGameNumber,
    scoreA: score.scoreA,
    scoreB: score.scoreB,
    winsNeeded,
    winnerTeamId,
    nextDraftUrl: nextAccess?.url || null,
  };
}


function finalizeSeriesFromVerifiedGames(req, payload) {
  if (!payload?.seriesComplete) return payload;
  const match = draftMatchContext(req.match.id);
  if (!match || match.result_status === 'final') return { ...payload, final: match?.result_status === 'final' };
  const winnerTeamId = Number(payload.scoreA) > Number(payload.scoreB) ? Number(match.team_a_id) : Number(match.team_b_id);
  const actorUserId = Number(req.user?.id || req.draftActorUserId || 0) || null;
  const finalized = transaction(() => {
    db.prepare(`UPDATE result_submissions SET active=0,superseded_at=COALESCE(superseded_at,CURRENT_TIMESTAMP) WHERE match_id=?`).run(match.id);
    const revision = Number(db.prepare('SELECT COALESCE(MAX(revision),0)+1 revision FROM result_submissions WHERE match_id=?').get(match.id).revision);
    const inserted = db.prepare(`INSERT INTO result_submissions(
      match_id,revision,submitted_by_user_id,source_type,score_a,score_b,winner_team_id,note,active
    ) VALUES (?,?,?,'verified_games',?,?,?,?,1)`).run(
      match.id, revision, actorUserId, Number(payload.scoreA), Number(payload.scoreB), winnerTeamId,
      'Automatically finalized from verified game results.'
    );
    return applyFinalResultUnsafe(match, {
      scoreA: Number(payload.scoreA),
      scoreB: Number(payload.scoreB),
      winnerTeamId,
      resolutionType: 'verified_games',
      resolutionReason: 'Every game result was verified before the next game opened.',
      submissionId: Number(inserted.lastInsertRowid),
      userId: actorUserId,
    });
  });
  addSystemMessage(match.id, `Series finalized from confirmed game results: ${match.team_a_name} ${payload.scoreA} - ${payload.scoreB} ${match.team_b_name}.`);
  emitBracketUpdated(match.tournament_id);
  return { ...payload, final: true, match: finalized };
}

function currentMatchGame(match) {
  return db.prepare('SELECT * FROM match_games WHERE match_id=? AND game_number=?')
    .get(match.id, Number(match.current_game_number || 1));
}

function assertCaptainGameReporter(req) {
  const teamId = Number(req.matchTeamId || 0);
  if (!teamId || !teamForCaptain(req.user.id, teamId)) {
    const error = new Error('Only the linked Captain can report or confirm the current game result.');
    error.status = 403;
    throw error;
  }
  return teamId;
}

function isMockUsername(username) {
  const name = String(username || '');
  return name.includes('_bot_') || name.startsWith('mock_') || name.startsWith('solo_bot_');
}

function opposingCaptainIsMock(match, reportingTeamId) {
  const otherTeamId = Number(reportingTeamId) === Number(match.team_a_id) ? match.team_b_id : match.team_a_id;
  const row = db.prepare('SELECT u.username FROM teams t JOIN users u ON u.id=t.captain_user_id WHERE t.id=?').get(otherTeamId);
  return isMockUsername(row?.username);
}

function applyConfirmedCurrentGameWinner(req, match, game, winnerSide) {
  req.body.winnerSide = winnerSide;
  let payload = recordDraftGameWinner(req, winnerSide, { expectedGameNumber: game.game_number });
  if (!payload.seriesComplete) {
    db.prepare(`UPDATE matches SET result_status='none',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(match.id);
  }
  return finalizeSeriesFromVerifiedGames(req, payload);
}

function assertCurrentGameReadyForReport(match, game) {
  if (!game) throw new Error('Current game record was not found.');
  if (game.status === 'completed' && game.winner_team_id) {
    const error = new Error(`Game ${game.game_number} is already complete.`);
    error.status = 409;
    throw error;
  }
  const room = db.prepare('SELECT * FROM draft_rooms WHERE match_id=?').get(match.id);
  if (!room) throw new Error('Create the Draft Room first.');
  const state = jsonParse(room.state_json);
  const config = jsonParse(room.config_json);
  const currentGameNumber = Number(match.current_game_number || 1);
  const roomGameNumber = Number(config.gameNumber || state.gameNumber || state.engine?.gameNumber || currentGameNumber);
  const stateGameNumber = Number(state.gameNumber || state.engine?.gameNumber || roomGameNumber);
  
  console.log('[ASSERT_GAME_READY] Game readiness check', {
    matchId: match.id,
    currentGameNumber,
    gameNumber: game.game_number,
    roomGameNumber,
    stateGameNumber,
    configGameNumber: config.gameNumber,
    stateGameNumberFromState: state.gameNumber,
    engineGameNumber: state.engine?.gameNumber,
    engineState: state.engine?.state,
    gameStatus: game.status,
    roomStatus: room.status
  });
  
  if (Number(game.game_number) !== currentGameNumber || roomGameNumber !== currentGameNumber || stateGameNumber !== currentGameNumber) {
    const error = new Error(`The Draft Room game sequence is stale. Reload Game ${currentGameNumber} before continuing.`);
    error.status = 409;
    throw error;
  }
  if (state.engine?.state !== 'complete') {
    const error = new Error(`Finish the Game ${game.game_number} draft before reporting its winner.`);
    error.status = 409;
    throw error;
  }
  return room;
}

function sideForWinnerTeam(match, winnerTeamId) {
  if (Number(winnerTeamId) === Number(match.team_a_id)) return 'A';
  if (Number(winnerTeamId) === Number(match.team_b_id)) return 'B';
  throw new Error('The selected winner is not part of this match.');
}

app.get('/api/matches/:matchId/draft-room/access', authRequired, emailVerifiedRequired, requireMatchAccess, (req, res) => {
  const hasRequestedRole = req.query.as !== undefined;
  const requestedRole = hasRequestedRole ? String(req.query.as).trim().toLowerCase() : null;
  if (hasRequestedRole && requestedRole !== 'broadcaster') {
    return res.status(400).json({ error: 'Only the broadcaster read-only downgrade may be requested.' });
  }
  let room = db.prepare('SELECT * FROM draft_rooms WHERE match_id=?').get(req.match.id);
  if (!room) return res.status(404).json({ error: 'Draft Room has not been opened by the Host yet.' });
  room = ensureDraftRoomRollIdentity(room);
  const access = jsonParse(room.access_json);
  const result = draftRoomAccessForRequest(req, room, access, { requestedRole });
  if (!result) {
    const error = requestedRole === 'broadcaster'
      ? 'Draft control or Broadcast permission is required for read-only watch mode.'
      : 'Only the linked Team Captain can enter and control this team Draft Room.';
    return res.status(403).json({ error });
  }
  res.json(result);
});

app.get('/api/matches/:matchId/draft-room/actions', authRequired, requireMatchAccess, (req, res) => {
  if (!hasTournamentPermission(req.user.id, req.match.tournament_id, 'draft.audit.read')) {
    return res.status(403).json({ error: 'Draft audit permission required.' });
  }
  const room = db.prepare('SELECT * FROM draft_rooms WHERE match_id=?').get(req.match.id);
  if (!room) return res.json({ actions: [] });
  const config = jsonParse(room.config_json);
  const roleNames = {
    host: 'Host', referee: 'Referee', broadcaster: 'Broadcaster',
    teamA: config.teamA || 'Team A', teamB: config.teamB || 'Team B',
  };
  const actions = db.prepare(`SELECT da.id,da.actor_user_id,da.actor_role,da.action_type,da.payload_json,da.created_at,
      COALESCE(u.display_name,u.username) actor_account_name
    FROM draft_actions da LEFT JOIN users u ON u.id=da.actor_user_id
    WHERE da.draft_room_id=? ORDER BY da.id ASC LIMIT 1000`).all(room.id).map(action => ({
      id: action.id,
      actorUserId: action.actor_user_id || null,
      actorRole: action.actor_role,
      actorName: action.actor_account_name || roleNames[action.actor_role] || action.actor_role,
      actionType: action.action_type,
      payload: jsonParse(action.payload_json),
      createdAt: action.created_at,
    }));
  res.json({ actions });
});

// Debug endpoint to check draft room state and diagnose submission issues
app.get('/api/matches/:matchId/draft-room/debug', authRequired, requireMatchAccess, (req, res) => {
  const room = db.prepare('SELECT * FROM draft_rooms WHERE match_id=?').get(req.match.id);
  if (!room) return res.status(404).json({ error: 'Draft room not found.' });
  
  const state = jsonParse(room.state_json);
  const config = jsonParse(room.config_json);
  const match = draftMatchContext(req.match.id);
  const game = currentMatchGame(match);
  const authority = draftAuthority(room.room_code);
  
  const stateSize = Buffer.byteLength(JSON.stringify(state), 'utf8');
  const engineSize = state.engine ? Buffer.byteLength(JSON.stringify(state.engine), 'utf8') : 0;
  const preDraftSize = state.preDraft ? Buffer.byteLength(JSON.stringify(state.preDraft), 'utf8') : 0;
  
  const stateGameNumber = Number(state.gameNumber || state.engine?.gameNumber || 0);
  const configGameNumber = Number(config.gameNumber || match?.current_game_number || 1);
  const stateRollMatches = validDraftGameRollId(state.gameRollId) && state.gameRollId === config.gameRollId;
  const preDraftRollMatches = !state.preDraft || (
    Number(state.preDraft.gameNumber) === stateGameNumber &&
    state.preDraft.gameRollId === state.gameRollId &&
    (!state.preDraft.divine || (Number(state.preDraft.divine.gameNumber) === stateGameNumber && state.preDraft.divine.gameRollId === state.gameRollId))
  );
  
  res.json({
    room: {
      id: room.id,
      roomCode: room.room_code,
      status: room.status,
      configGameNumber: config.gameNumber,
      configGameRollId: config.gameRollId,
    },
    state: {
      status: state.status,
      gameNumber: state.gameNumber,
      gameRollId: state.gameRollId,
      engineState: state.engine?.state,
      engineGameNumber: state.engine?.gameNumber,
      seriesComplete: state.seriesComplete,
    },
    match: {
      id: match.id,
      currentGameNumber: match.current_game_number,
      status: match.status,
      matchStatus: match.match_status,
    },
    game: {
      gameNumber: game?.game_number,
      status: game?.status,
      resultStatus: game?.result_status,
      winnerTeamId: game?.winner_team_id,
    },
    sizes: {
      stateTotal: stateSize,
      engine: engineSize,
      preDraft: preDraftSize,
    },
    validation: {
      stateGameNumber,
      configGameNumber,
      stateRollMatches,
      preDraftRollMatches,
      engineStateComplete: state.engine?.state === 'complete',
      authority: authority ? { role: authority.role, socketId: authority.socketId } : null,
    },
    preDraftDetails: state.preDraft ? {
      gameNumber: state.preDraft.gameNumber,
      gameRollId: state.preDraft.gameRollId,
      stage: state.preDraft.stage,
      divineGameNumber: state.preDraft.divine?.gameNumber,
      divineGameRollId: state.preDraft.divine?.gameRollId,
    } : null,
  });
});

app.get('/api/matches/:matchId/games', authRequired, requireMatchAccess, (req, res) => {
  const match = draftMatchContext(req.match.id);
  const room = db.prepare('SELECT * FROM draft_rooms WHERE match_id=?').get(req.match.id);
  const score = seriesGameScore(match);
  const roomState = room ? jsonParse(room.state_json) : {};
  res.json({
    games: score.games,
    scoreA: score.scoreA,
    scoreB: score.scoreB,
    currentGameNumber: Number(match.current_game_number || 1),
    winsNeeded: Math.floor(Number(match.best_of) / 2) + 1,
    seriesRule: match.series_rule,
    draftComplete: roomState.engine?.state === 'complete',
    seriesComplete: room?.status === 'series_complete',
  });
});

app.post('/api/matches/:matchId/room-code', authRequired, emailVerifiedRequired, requireMatchAccess, (req, res) => {
  try {
    const match = draftMatchContext(req.match.id);
    const isTeamA = Number(req.matchTeamId) === Number(match.team_a_id) && Boolean(teamForCaptain(req.user.id, match.team_a_id));
    const isTeamB = Number(req.matchTeamId) === Number(match.team_b_id) && Boolean(teamForCaptain(req.user.id, match.team_b_id));
    const isStaff = hasTournamentPermission(req.user.id, match.tournament_id, 'match.manage') || hasTournamentPermission(req.user.id, match.tournament_id, 'draft.control');
    if (!isTeamA && !isTeamB && !isStaff) {
      return res.status(403).json({ error: 'Only Team Captains or Host can set the game room code.' });
    }
    const code = String(req.body.roomCode || '').trim();
    if (code.length > 80) return res.status(400).json({ error: 'Room code cannot exceed 80 characters.' });
    
    db.prepare('UPDATE matches SET room_code=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(code, match.id);
    db.prepare("UPDATE match_games SET room_code=? WHERE match_id=? AND status <> 'completed'").run(code, match.id);
    
    const draftRoom = db.prepare('SELECT * FROM draft_rooms WHERE match_id=?').get(match.id);
    if (draftRoom) {
      const config = jsonParse(draftRoom.config_json);
      config.roomCode = code;
      db.prepare('UPDATE draft_rooms SET config_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(JSON.stringify(config), draftRoom.id);
      io.to(`draft:${draftRoom.room_code}`).emit('draft:room_code', { roomCode: code });
    }
    
    const senderName = isTeamA ? match.team_a_name : isTeamB ? match.team_b_name : 'Host';
    if (code) {
      addSystemMessage(match.id, `🎮 ${senderName} sent game room code: ${code}`);
    } else {
      addSystemMessage(match.id, `Game room code was cleared.`);
    }
    const updated = draftMatchContext(match.id);
    emitMatchUpdated(updated);
    res.json({ success: true, roomCode: code, match: serializeTournamentMatchForUser(updated, permissionsForUser(req.user.id, match.tournament_id)) });
  } catch (error) {
    res.status(error.status || 400).json({ error: clientErrorMessage(error) });
  }
});

app.post('/api/matches/:matchId/games/:gameNumber/edit-winner', authRequired, emailVerifiedRequired, requireMatchAccess, (req, res) => {
  try {
    const match = draftMatchContext(req.match.id);
    if (!hasTournamentPermission(req.user.id, match.tournament_id, 'result.verify') && !hasTournamentPermission(req.user.id, match.tournament_id, 'draft.control')) {
      return res.status(403).json({ error: 'Permission required to adjust game winner.' });
    }
    const targetGameNumber = Number(req.params.gameNumber);
    const targetGame = db.prepare('SELECT * FROM match_games WHERE match_id=? AND game_number=?').get(match.id, targetGameNumber);
    if (!targetGame) return res.status(404).json({ error: `Game ${targetGameNumber} not found.` });

    const side = String(req.body.winnerSide || '').toUpperCase();
    if (!['A', 'B'].includes(side)) return res.status(400).json({ error: 'Choose Team A or Team B as winner.' });
    const winnerTeamId = side === 'A' ? Number(match.team_a_id) : Number(match.team_b_id);
    const winnerName = side === 'A' ? match.team_a_name : match.team_b_name;
    const reason = String(req.body.reason || '').trim();
    const isCurrentOpenGame = Number(targetGame.game_number) === Number(match.current_game_number)
      && !(targetGame.status === 'completed' && targetGame.winner_team_id);

    if (isCurrentOpenGame) {
      const game = currentMatchGame(match);
      assertCurrentGameReadyForReport(match, game);
      db.prepare(`UPDATE match_games SET result_status='confirmed',reported_winner_team_id=?,reported_by_user_id=?,reported_by_team_id=NULL,reported_at=CURRENT_TIMESTAMP,confirmed_by_user_id=?,confirmed_by_team_id=NULL,confirmed_at=CURRENT_TIMESTAMP,dispute_reason='',updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(winnerTeamId, req.user.id, req.user.id, game.id);
      db.prepare(`UPDATE disputes SET status='resolved',resolved_by_user_id=?,resolution_note='Host game winner correction',resolved_at=CURRENT_TIMESTAMP WHERE match_id=? AND status IN ('open','under_review','recommended')`)
        .run(req.user.id, match.id);
      let payload = applyConfirmedCurrentGameWinner(req, match, game, side);
      addSystemMessage(match.id, `🔧 Host recorded Game ${targetGameNumber}: ${winnerName} won.${reason ? ` Reason: ${reason}` : ''}`);
      emitMatchUpdated(draftMatchContext(match.id));
      return res.json(payload);
    }

    db.prepare(`UPDATE match_games SET winner_team_id=?, reported_winner_team_id=?, result_status='confirmed', status='completed', confirmed_by_user_id=?, confirmed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(winnerTeamId, winnerTeamId, req.user.id, targetGame.id);

    const score = seriesGameScore(match);
    const winsNeeded = Math.floor(Number(match.best_of) / 2) + 1;
    const seriesComplete = score.scoreA >= winsNeeded || score.scoreB >= winsNeeded;

    db.prepare(`UPDATE matches SET score_a=?, score_b=?, status=?, match_status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(score.scoreA, score.scoreB, seriesComplete ? 'completed' : match.match_status, seriesComplete ? 'completed' : match.match_status, match.id);

    const room = db.prepare('SELECT * FROM draft_rooms WHERE match_id=?').get(match.id);
    if (room) {
      const config = jsonParse(room.config_json);
      const state = jsonParse(room.state_json);
      config.seriesScoreA = score.scoreA;
      config.seriesScoreB = score.scoreB;
      state.seriesScoreA = score.scoreA;
      state.seriesScoreB = score.scoreB;
      if (seriesComplete) {
        state.status = 'series_complete';
        state.seriesComplete = true;
      }
      db.prepare('UPDATE draft_rooms SET config_json=?, state_json=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .run(JSON.stringify(config), JSON.stringify(state), seriesComplete ? 'series_complete' : room.status, room.id);
      io.to(`draft:${room.room_code}`).emit('draft:state', state);
    }

    addSystemMessage(match.id, `🔧 Host adjusted Game ${targetGameNumber} result: ${winnerName} won. Series score: ${match.team_a_name} ${score.scoreA} - ${score.scoreB} ${match.team_b_name}.${reason ? ` Reason: ${reason}` : ''} Later-game picks, bans and Divine cards were kept.`);
    let payload = {
      success: true,
      gameNumber: targetGameNumber,
      scoreA: score.scoreA,
      scoreB: score.scoreB,
      seriesComplete,
    };
    if (seriesComplete) payload = finalizeSeriesFromVerifiedGames(req, payload);
    emitBracketUpdated(match.tournament_id);
    const updatedMatch = draftMatchContext(match.id);
    emitMatchUpdated(updatedMatch);
    res.json({ ...payload, match: updatedMatch });
  } catch (error) {
    res.status(error.status || 400).json({ error: clientErrorMessage(error) });
  }
});

app.post('/api/matches/:matchId/games/current/report', authRequired, emailVerifiedRequired, requireMatchAccess, (req, res) => {
  try {
    const match = draftMatchContext(req.match.id);
    const reportingTeamId = assertCaptainGameReporter(req);
    const game = currentMatchGame(match);
    assertCurrentGameReadyForReport(match, game);
    if (game.result_status === 'disputed') {
      return res.status(409).json({ error: 'This game result is disputed. Staff must resolve it before the series can continue.' });
    }
    if (game.result_status === 'awaiting_confirmation' && Number(game.reported_by_team_id) !== reportingTeamId) {
      return res.status(409).json({ error: 'The other Captain already submitted this game. Confirm or reject that report instead of replacing it.' });
    }
    const winnerSide = String(req.body.winnerSide || '').toUpperCase();
    if (!['A', 'B'].includes(winnerSide)) return res.status(400).json({ error: 'Choose Team A or Team B as the game winner.' });
    const winnerTeamId = winnerSide === 'A' ? Number(match.team_a_id) : Number(match.team_b_id);
    db.prepare(`UPDATE match_games SET result_status='awaiting_confirmation',reported_winner_team_id=?,reported_by_user_id=?,reported_by_team_id=?,reported_at=CURRENT_TIMESTAMP,confirmed_by_user_id=NULL,confirmed_by_team_id=NULL,confirmed_at=NULL,dispute_reason='',updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(winnerTeamId, req.user.id, reportingTeamId, game.id);
    db.prepare(`UPDATE matches SET result_status='game_confirmation',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(match.id);
    const winnerName = winnerTeamId === Number(match.team_a_id) ? match.team_a_name : match.team_b_name;
    if (opposingCaptainIsMock(match, reportingTeamId)) {
      db.prepare(`UPDATE match_games SET result_status='confirmed',confirmed_by_user_id=?,confirmed_by_team_id=NULL,confirmed_at=CURRENT_TIMESTAMP,dispute_reason='',updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(req.user.id, game.id);
      const payload = applyConfirmedCurrentGameWinner(req, match, game, winnerSide);
      addSystemMessage(match.id, `${req.user.display_name} reported ${winnerName} as the winner of Game ${game.game_number}. Mock opponent auto-confirmed.`);
      emitMatchUpdated(draftMatchContext(match.id));
      return res.json({ ...payload, autoConfirmed: true });
    }
    addSystemMessage(match.id, `${req.user.display_name} reported ${winnerName} as the winner of Game ${game.game_number}. Waiting for the opposing Captain.`);
    emitBracketUpdated(match.tournament_id);
    emitMatchUpdated(draftMatchContext(match.id));
    res.json({ game: currentMatchGame(match), waitingForTeamId: reportingTeamId === Number(match.team_a_id) ? Number(match.team_b_id) : Number(match.team_a_id), autoConfirmed: false });
  } catch (error) {
    res.status(error.status || 400).json({ error: clientErrorMessage(error) });
  }
});

app.post('/api/matches/:matchId/games/current/confirm', authRequired, emailVerifiedRequired, requireMatchAccess, (req, res) => {
  try {
    const match = draftMatchContext(req.match.id);
    const confirmingTeamId = assertCaptainGameReporter(req);
    const game = currentMatchGame(match);
    assertCurrentGameReadyForReport(match, game);
    if (game.result_status !== 'awaiting_confirmation' || !game.reported_winner_team_id) {
      return res.status(409).json({ error: 'No current game report is waiting for confirmation.' });
    }
    if (Number(game.reported_by_team_id) === confirmingTeamId) {
      return res.status(403).json({ error: 'The Captain who submitted the report cannot also confirm it.' });
    }
    const decision = req.body.decision === 'reject' ? 'reject' : 'confirm';
    const comment = String(req.body.comment || '').trim();
    if (decision === 'reject') {
      if (!comment) return res.status(400).json({ error: 'A reason is required when rejecting a game result.' });
      db.prepare(`UPDATE match_games SET result_status='none',reported_winner_team_id=NULL,reported_by_user_id=NULL,reported_by_team_id=NULL,reported_at=NULL,confirmed_by_user_id=NULL,confirmed_by_team_id=NULL,confirmed_at=NULL,dispute_reason=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
        .run(comment, game.id);
      db.prepare(`UPDATE matches SET result_status='none',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(match.id);
      addSystemMessage(match.id, `Game ${game.game_number} result was rejected. Both Captains may report the winner again.`);
      emitBracketUpdated(match.tournament_id);
      emitMatchUpdated(draftMatchContext(match.id));
      return res.json({ reopened: true, disputed: false, game: currentMatchGame(match) });
    }
    db.prepare(`UPDATE match_games SET result_status='confirmed',confirmed_by_user_id=?,confirmed_by_team_id=?,confirmed_at=CURRENT_TIMESTAMP,dispute_reason='',updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(req.user.id, confirmingTeamId, game.id);
    const payload = applyConfirmedCurrentGameWinner(req, match, game, sideForWinnerTeam(match, game.reported_winner_team_id));
    addSystemMessage(match.id, `Game ${game.game_number} result confirmed by both sides.`);
    res.json(payload);
  } catch (error) {
    res.status(error.status || 400).json({ error: clientErrorMessage(error) });
  }
});

app.post('/api/matches/:matchId/draft-room', authRequired, requireMatchAccess, (req, res) => {
  const match = draftMatchContext(req.match.id);
  if (!hasTournamentPermission(req.user.id, match.tournament_id, 'draft.control')) return res.status(403).json({ error: 'Draft control permission required.' });
  if (!match.team_a_id || !match.team_b_id) return res.status(400).json({ error: 'Both teams must be assigned before opening a draft room.' });

  let room = db.prepare('SELECT * FROM draft_rooms WHERE match_id=?').get(match.id);
  let access;
  if (!room) {
    const tournament = db.prepare('SELECT source_platform FROM tournaments WHERE id=?').get(match.tournament_id);
    const isMockTournament = tournamentHasMockPlayers(match.tournament_id);
    if (tournament?.source_platform !== 'quick_draft' && !isMockTournament) {
      const checkins = db.prepare(`SELECT actor_id FROM match_checkins WHERE match_id=? AND actor_type='team' AND status='ready'`).all(match.id);
      const checkedTeamIds = new Set(checkins.map(item => Number(item.actor_id)));
      if (!checkedTeamIds.has(Number(match.team_a_id)) || !checkedTeamIds.has(Number(match.team_b_id))) {
        return res.status(409).json({ error: 'Both Team Captains must check in before the Host opens the Draft Room.' });
      }
    }
    const roomCode = randomCode(8);
    access = { host: randomCode(32), teamA: randomCode(32), teamB: randomCode(32), referee: randomCode(32), broadcaster: randomCode(32) };
    const effectiveRules = { ...jsonParse(match.tournament_rules_json), ...jsonParse(match.rules_json) };
    const series = seriesDraftHistory(match.id, match.series_rule, match.current_game_number);
    const score = seriesGameScore(match);
    const game = db.prepare(`
      INSERT INTO match_games(match_id,game_number,status,server_region,room_code)
      VALUES (?,?,'waiting_draft',?,?)
      ON CONFLICT(match_id,game_number) DO UPDATE SET server_region=excluded.server_region
      RETURNING *
    `).get(match.id, match.current_game_number, match.server_region, match.room_code || '');
    const banDuration = Math.min(600, Math.max(5, Math.floor(Number(req.body?.ban_duration || effectiveRules.ban_duration || effectiveRules.timerSeconds || 30))));
    const pickDuration = Math.min(600, Math.max(5, Math.floor(Number(req.body?.pick_duration || effectiveRules.pick_duration || 60))));
    const extraTime = Math.min(600, Math.max(0, Math.floor(Number(req.body?.extra_time ?? effectiveRules.extra_time ?? 15))));
    const config = {
      teamA: match.team_a_name,
      teamB: match.team_b_name,
      teamAId: match.team_a_id,
      teamBId: match.team_b_id,
      teamALogoUrl: match.team_a_logo || '',
      teamBLogoUrl: match.team_b_logo || '',
      format: `BO${match.best_of}`,
      gameNumber: game.game_number,
      seriesRule: match.series_rule,
      squadraBlastCarryBans: effectiveRules.squadraBlastCarryBans !== false,
      seriesScoreA: score.scoreA,
      seriesScoreB: score.scoreB,
      previousPicksA: series.picksA,
      previousPicksB: series.picksB,
      previousBansA: effectiveRules.squadraBlastCarryBans === false ? [] : series.bansA,
      previousBansB: effectiveRules.squadraBlastCarryBans === false ? [] : series.bansB,
      ban_duration: banDuration,
      pick_duration: pickDuration,
      extra_time: extraTime,
      timerSeconds: banDuration,
      heroBans: Number(effectiveRules.heroBans ?? 2),
      divineBans: Number(effectiveRules.divineBans ?? 0),
      draftStyle: effectiveRules.draftStyle === 'all-random' ? 'all-random' : 'standard',
      mirrorPickMode: normalizeMirrorPickMode(effectiveRules),
      enableCoinFlip: effectiveRules.enableCoinFlip !== false,
      enableDivineDraw: effectiveRules.enableDivineDraw !== false,
      divineDrawMode: effectiveRules.divineDrawMode || 'random',
      enableProtect: effectiveRules.enableProtect === true,
      protectNewest: effectiveRules.protectNewest === true,
      protectList: Array.isArray(effectiveRules.protectList) ? effectiveRules.protectList : [],
      globalBanList: Array.isArray(effectiveRules.globalBanList) ? effectiveRules.globalBanList : [],
      heroRuleScope: effectiveRules.heroRuleScope || 'match',
      cinematicLockIn: effectiveRules.cinematicLockIn !== false,
      flashAndShake: effectiveRules.flashAndShake === true,
      theme: effectiveRules.theme || 'beerus',
      matchId: match.id,
      tournamentId: match.tournament_id,
      tournamentName: match.tournament_name,
      roundName: match.round_name,
      serverRegion: match.server_region,
      scheduledAt: match.scheduled_at || match.tournament_start_at,
      roomMode: 'bandai-tool',
      roomCode: match.room_code || '',
      gameRollId: newDraftGameRollId(),
      mockAutoOpponent: tournamentHasMockPlayers(match.tournament_id),
    };
    const gameRollId = config.gameRollId;
    const result = db.prepare(`INSERT INTO draft_rooms(match_id,room_code,config_json,state_json,access_json,created_by) VALUES (?,?,?,?,?,?)`)
      .run(match.id, roomCode, JSON.stringify(config), JSON.stringify({ status: 'waiting', gameNumber: game.game_number, gameRollId, seriesScoreA: score.scoreA, seriesScoreB: score.scoreB }), JSON.stringify(access), req.user.id);
    room = db.prepare('SELECT * FROM draft_rooms WHERE id=?').get(Number(result.lastInsertRowid));
    addSystemMessage(match.id, `Draft Room opened for Game ${game.game_number}.`);
  } else {
    access = jsonParse(room.access_json);
    const config = refreshedDraftConfig(match, room);
    db.prepare('UPDATE draft_rooms SET config_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(JSON.stringify(config), room.id);
    room = ensureDraftRoomRollIdentity(db.prepare('SELECT * FROM draft_rooms WHERE id=?').get(room.id));
  }
  res.json({ room: draftRoomPayload(req, room, access) });
});

// Rotate every role capability after accidental link disclosure; old links and pending tickets become invalid.
app.post('/api/matches/:matchId/draft-room/rotate-access', authRequired, requireMatchAccess, (req, res) => {
  if (!hasTournamentPermission(req.user.id, req.match.tournament_id, 'draft.control')) return res.status(403).json({ error: 'Draft control permission required.' });
  const room = db.prepare('SELECT * FROM draft_rooms WHERE match_id=?').get(req.match.id);
  if (!room) return res.status(404).json({ error: 'Draft Room has not been opened by the Host yet.' });
  const access = { host: randomCode(32), teamA: randomCode(32), teamB: randomCode(32), referee: randomCode(32), broadcaster: randomCode(32) };
  transaction(() => {
    db.prepare('UPDATE draft_rooms SET access_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(JSON.stringify(access), room.id);
    db.prepare('DELETE FROM draft_socket_tickets WHERE draft_room_id=?').run(room.id);
  });
  // Force every connected role to obtain a new short-lived ticket from the rotated capability.
  io.in(`draft:${room.room_code}`).disconnectSockets(true);
  addSystemMessage(req.match.id, 'Draft Room access links were rotated by tournament staff.');
  logAction({ tournamentId: req.match.tournament_id, matchId: req.match.id, userId: req.user.id, action: 'draft_room.access_rotated', details: { roomId: room.id } });
  const updated = db.prepare('SELECT * FROM draft_rooms WHERE id=?').get(room.id);
  res.json({ room: draftRoomPayload(req, updated, access) });
});

function canDirectlyRecordDraftGame(req) {
  const tournament = db.prepare('SELECT source_platform FROM tournaments WHERE id=?').get(req.match.tournament_id);
  if (tournament?.source_platform === 'quick_draft') {
    return hasTournamentPermission(req.user.id, req.match.tournament_id, 'draft.control');
  }
  return hasTournamentPermission(req.user.id, req.match.tournament_id, 'result.verify')
    || hasTournamentPermission(req.user.id, req.match.tournament_id, 'draft.control');
}

app.post('/api/matches/:matchId/draft-room/game-result', authRequired, requireMatchAccess, (req, res) => {
  if (!canDirectlyRecordDraftGame(req)) return res.status(403).json({ error: 'Only an authorized Host or Admin may directly confirm a tournament game result. Quick Draft creators may record their own games.' });
  try {
    const match = draftMatchContext(req.match.id);
    const game = currentMatchGame(match);
    
    // Allow force mode for emergency situations where draft state is stuck
    const forceMode = req.body.force === true && hasTournamentPermission(req.user.id, req.match.tournament_id, 'draft.control');
    
    if (!forceMode) {
      assertCurrentGameReadyForReport(match, game);
    } else {
      console.log('[FORCE_GAME_RESULT] Host forcing game result', { 
        matchId: match.id, 
        userId: req.user.id, 
        gameNumber: game.game_number,
        engineState: jsonParse(db.prepare('SELECT state_json FROM draft_rooms WHERE match_id=?').get(match.id)?.state_json || '{}')?.engine?.state
      });
    }
    
    if (Number(req.body.gameNumber) !== Number(game.game_number)) {
      return res.status(409).json({ error: `Game ${req.body.gameNumber || '?'} is stale; reload Game ${game.game_number} before recording a result.` });
    }
    const winnerSide = String(req.body.winnerSide || '').toUpperCase();
    const winnerTeamId = winnerSide === 'A' ? Number(match.team_a_id) : winnerSide === 'B' ? Number(match.team_b_id) : null;
    if (!winnerTeamId) return res.status(400).json({ error: 'Choose Team A or Team B as the game winner.' });
    db.prepare(`UPDATE match_games SET result_status='confirmed',reported_winner_team_id=?,reported_by_user_id=?,reported_by_team_id=NULL,reported_at=CURRENT_TIMESTAMP,confirmed_by_user_id=?,confirmed_by_team_id=NULL,confirmed_at=CURRENT_TIMESTAMP,dispute_reason='',updated_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(winnerTeamId, req.user.id, req.user.id, game.id);
    db.prepare(`UPDATE disputes SET status='resolved',resolved_by_user_id=?,resolution_note='Administrative game result override',resolved_at=CURRENT_TIMESTAMP WHERE match_id=? AND status IN ('open','under_review','recommended')`)
      .run(req.user.id, match.id);
    const payload = applyConfirmedCurrentGameWinner(req, match, game, winnerSide);
    res.json(payload);
  } catch (error) {
    console.log('[GAME_RESULT_ERROR] Error recording game result', { 
      matchId: req.match.id, 
      userId: req.user?.id, 
      error: error.message, 
      status: error.status 
    });
    res.status(error.status || 400).json({ error: clientErrorMessage(error) });
  }
});

// Backward-compatible administrative route. Host/Admin confirmation is direct; Captain fallback uses report + opponent confirmation.
app.post('/api/matches/:matchId/draft-room/next-game', authRequired, requireMatchAccess, (req, res) => {
  if (!canDirectlyRecordDraftGame(req)) return res.status(403).json({ error: 'Only an authorized Host or Admin may directly confirm a tournament game result. Quick Draft creators may record their own games.' });
  try {
    let payload = recordDraftGameWinner(req, req.body.winnerSide, { expectedGameNumber: req.body.gameNumber });
    payload = finalizeSeriesFromVerifiedGames(req, payload);
    res.json(payload);
  } catch (error) {
    res.status(error.status || 400).json({ error: clientErrorMessage(error) });
  }
});
function canUseTournamentDraftRole(userId,room,role){
  const match=canAccessMatch(userId,room.match_id);
  if(!match.match)return false;
  if(role==='teamA')return Boolean(teamForCaptain(userId,match.match.team_a_id));
  if(role==='teamB')return Boolean(teamForCaptain(userId,match.match.team_b_id));
  if(role==='host')return hasTournamentPermission(userId,match.match.tournament_id,'draft.control');
  if(role==='referee')return hasTournamentPermission(userId,match.match.tournament_id,'dispute.review');
  if(role==='broadcaster')return hasTournamentPermission(userId,match.match.tournament_id,'broadcast.control')
    || hasTournamentPermission(userId,match.match.tournament_id,'draft.control');
  return false;
}
app.post('/api/public/draft-rooms/:roomCode/access',(req,res)=>{
  let room=db.prepare(`SELECT dr.*,m.tournament_id,t.source_platform FROM draft_rooms dr JOIN matches m ON m.id=dr.match_id JOIN tournaments t ON t.id=m.tournament_id WHERE dr.room_code=?`)
    .get(String(req.params.roomCode||'').toUpperCase());
  if(!room)return res.status(404).json({error:'Draft room not found.'});
  room={...room,...ensureDraftRoomRollIdentity(room)};
  const accessToken=String(req.body.accessToken||'');
  const role=resolveDraftRole(room,accessToken);
  if(!role){
    securityLog('draft.access_denied',{roomCodeHash:anonymize(req.params.roomCode),ipHash:anonymize(clientIp(req))});
    return res.status(403).json({error:'Invalid draft-room access link.'});
  }
  let userId=null;
  if(room.source_platform!=='quick_draft'){
    let auth=null;
    try{auth=authenticateAccessToken(accessTokenFromRequest(req));}catch{}
    if(!auth)return res.status(401).json({error:'Sign in with the account assigned to this tournament Draft role.'});
    if(!canUseTournamentDraftRole(auth.user.id,room,role)){
      securityLog('draft.account_role_denied',{roomId:room.id,role,userId:auth.user.id});
      return res.status(403).json({error:role==='teamA'||role==='teamB'?'Only the linked Team Captain can use this team Draft link.':'This tournament Draft role is not assigned to your account.'});
    }
    userId=auth.user.id;
  }
  const ticket=issueDraftSocketTicket({roomId:room.id,role,userId});
  const messages=db.prepare(`SELECT id,sender_role,sender_name,message,message_type,file_id,pinned,created_at
    FROM match_messages WHERE match_id=? AND deleted_at IS NULL ORDER BY id ASC LIMIT 300`).all(room.match_id);
  res.json({
    socketTicket:ticket.token,
    socketTicketExpiresAt:ticket.expiresAt,
    room:{roomCode:room.room_code,role,matchId:room.match_id,tournamentId:room.tournament_id,status:room.status,
      config:jsonParse(room.config_json),state:jsonParse(room.state_json),messages},
  });
});
app.post('/api/public/draft-rooms/:roomCode/game-result',(req,res)=>{
  const room=db.prepare(`SELECT dr.*,m.tournament_id,t.source_platform FROM draft_rooms dr JOIN matches m ON m.id=dr.match_id JOIN tournaments t ON t.id=m.tournament_id WHERE dr.room_code=?`)
    .get(String(req.params.roomCode||'').toUpperCase());
  if(!room)return res.status(404).json({error:'Draft room not found.'});
  if(room.source_platform!=='quick_draft')return res.status(403).json({error:'Tournament game results must be reported by Captains in Player Portal.'});
  const accessToken=String(req.body.accessToken||'');
  const role=resolveDraftRole(room,accessToken);
  if(!['host','teamA','teamB'].includes(role||''))return res.status(403).json({error:'A controlling Quick Draft link is required to record the game winner.'});
  const authority=draftAuthority(room.room_code);
  if(!authority||authority.role!==role)return res.status(409).json({error:'Only the Quick Draft link currently controlling this room can record the game winner.'});
  try{
    req.match=draftMatchContext(room.match_id);
    req.draftActorUserId=room.created_by;
    const nextDraftUrl=draftRoomPayload(req,room,{[role]:accessToken}).links[role];
    let payload=recordDraftGameWinner(req,req.body.winnerSide,{nextDraftUrl,expectedGameNumber:req.body.gameNumber});
    payload=finalizeSeriesFromVerifiedGames(req,payload);
    securityLog('quick_draft.game_result_recorded',{roomId:room.id,role,gameNumber:payload.currentGameNumber,seriesComplete:Boolean(payload.seriesComplete)},'info');
    res.json(payload);
  }catch(error){res.status(error.status||400).json({error:clientErrorMessage(error)});}
});
app.post('/api/public/draft-rooms/:roomCode/room-code', (req, res) => {
  const room = db.prepare(`SELECT dr.*, m.id as match_id, m.tournament_id, m.team_a_name, m.team_b_name, t.source_platform FROM draft_rooms dr LEFT JOIN matches m ON m.id=dr.match_id LEFT JOIN tournaments t ON t.id=m.tournament_id WHERE dr.room_code=?`)
    .get(String(req.params.roomCode || '').toUpperCase());
  if (!room) return res.status(404).json({ error: 'Draft room not found.' });
  const accessToken = String(req.body.accessToken || '');
  const role = resolveDraftRole(room, accessToken);
  if (!['host', 'teamA', 'teamB'].includes(role || '')) {
    return res.status(403).json({ error: 'Only Team Captains or Host can set the game room code.' });
  }
  const code = String(req.body.roomCode || '').trim();
  if (code.length > 80) return res.status(400).json({ error: 'Room code cannot exceed 80 characters.' });

  if (room.match_id) {
    db.prepare('UPDATE matches SET room_code=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(code, room.match_id);
    db.prepare("UPDATE match_games SET room_code=? WHERE match_id=? AND status <> 'completed'").run(code, room.match_id);
  }

  const config = jsonParse(room.config_json);
  config.roomCode = code;
  db.prepare('UPDATE draft_rooms SET config_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(JSON.stringify(config), room.id);
  io.to(`draft:${room.room_code}`).emit('draft:room_code', { roomCode: code });

  if (room.match_id) {
    const senderName = role === 'teamA' ? (room.team_a_name || 'Team A') : role === 'teamB' ? (room.team_b_name || 'Team B') : 'Host';
    if (code) {
      addSystemMessage(room.match_id, `🎮 ${senderName} sent game room code: ${code}`);
    } else {
      addSystemMessage(room.match_id, `Game room code was cleared.`);
    }
  }
  if (room.tournament_id) {
    emitBracketUpdated(room.tournament_id);
  }
  res.json({ success: true, roomCode: code });
});
app.get('/api/public/draft-rooms/:roomCode',(_req,res)=>res.status(405).json({error:'Use POST access exchange; credentials are not accepted in URL query strings.'}));

// Realtime
function socketRequestLike(socket){
  return {headers:socket.handshake.headers,ip:socket.handshake.address,socket:{remoteAddress:socket.handshake.address}};
}
function resolveDraftRoleForUser(room,userId){
  const match=canAccessMatch(userId,room.match_id);
  if(!match.allowed)return null;
  if(hasTournamentPermission(userId,match.match.tournament_id,'draft.control'))return 'host';
  if(hasTournamentPermission(userId,match.match.tournament_id,'dispute.review'))return 'referee';
  if(hasTournamentPermission(userId,match.match.tournament_id,'broadcast.control'))return 'broadcaster';
  if(match.teamId===match.match.team_a_id&&teamForCaptain(userId,match.teamId))return 'teamA';
  if(match.teamId===match.match.team_b_id&&teamForCaptain(userId,match.teamId))return 'teamB';
  return null;
}
function validSocketObject(value,maxBytes=32*1024){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  try{return Buffer.byteLength(JSON.stringify(value),'utf8')<=maxBytes;}catch{return false;}
}
function hasOnlyKeys(value,allowed,maxBytes=32*1024){
  return validSocketObject(value,maxBytes)&&Object.keys(value).every(key=>allowed.has(key));
}
function validRoomCode(value){return /^[A-Z0-9_-]{4,32}$/.test(String(value||'').toUpperCase());}
function validHeroId(value){return /^[A-Za-z0-9_-]{1,80}$/.test(String(value||''));}
const EMPTY_KEYS=new Set();
const DRAFT_COMMAND_KEYS=new Set(['roomCode','action','data']);
const DRAFT_EVENT_KEYS=new Set(['roomCode','type','data']);
const DRAFT_CHAT_KEYS=new Set(['roomCode','message']);
const DRAFT_STATE_KEYS=new Set(['roomCode','state']);
const PUBLIC_JOIN_KEYS=new Set(['tournamentId']);
const SELECT_DATA_KEYS=new Set(['heroId','team','actionType']);
const TIMER_DATA_KEYS=new Set(['remaining']);
const START_DATA_KEYS=new Set(['action']);
const DIVINE_DATA_KEYS=new Set(['rules','gameNumber','gameRollId']);
const RANDOM_RESULT_DATA_KEYS=new Set(['assignments','gameNumber','gameRollId']);
const RANDOM_ASSIGNMENT_KEYS=new Set(['A','B']);
const RANDOM_BAN_DATA_KEYS=new Set(['heroIds']);
const PRE_COIN_CALL_DATA_KEYS=new Set(['face','teamKey']);
const PRE_COIN_FLIP_DATA_KEYS=new Set(['teamKey']);
const PRE_SIDE_SELECT_DATA_KEYS=new Set(['side','teamKey']);
const PRE_DIVINE_SELECT_DATA_KEYS=new Set(['index','teamSide']);
const STATE_KEYS=new Set(['status','engine','chosenDivineRules','hostBannedHeroIds','preDraft','seriesComplete','gameNumber','gameRollId','seriesScoreA','seriesScoreB','seriesRule','reloadRequired','nextConfig']);
const ENGINE_STATE_KEYS=new Set(['version','state','currentStep','sequence','selectedHero','timerRemaining','teamA','teamB','heroStatuses','seriesRule','gameNumber','squadraBlastCarryBans','previousPicksA','previousPicksB','previousBansA','previousBansB','protectList','globalBanList','mirrorPickMode','roleLimits']);
function validDraftCommandPayload(payload){
  if(!hasOnlyKeys(payload,DRAFT_COMMAND_KEYS)||!validRoomCode(payload.roomCode)||typeof payload.action!=='string')return false;
  const data=payload.data??{};
  if(!validSocketObject(data,16*1024))return false;
  if(['select','lock'].includes(payload.action)){
    return hasOnlyKeys(data,SELECT_DATA_KEYS)&&validHeroId(data.heroId)&&['A','B',undefined].includes(data.team)&&['pick','ban','divine-ban',undefined].includes(data.actionType);
  }
  if(payload.action==='pre-draft:coin-call'){
    return hasOnlyKeys(data,PRE_COIN_CALL_DATA_KEYS)&&['HEADS','TAILS'].includes(String(data.face||'').toUpperCase())&&['teamA','teamB'].includes(data.teamKey);
  }
  if(payload.action==='pre-draft:coin-flip'){
    return hasOnlyKeys(data,PRE_COIN_FLIP_DATA_KEYS)&&['teamA','teamB'].includes(data.teamKey);
  }
  if(payload.action==='pre-draft:side-select'){
    return hasOnlyKeys(data,PRE_SIDE_SELECT_DATA_KEYS)&&['A','B'].includes(data.side)&&['teamA','teamB'].includes(data.teamKey);
  }
  if(payload.action==='pre-draft:divine-select'){
    return hasOnlyKeys(data,PRE_DIVINE_SELECT_DATA_KEYS)&&Number.isInteger(Number(data.index))&&Number(data.index)>=0&&Number(data.index)<8&&['A','B'].includes(data.teamSide);
  }
  if(payload.action==='pre-draft:complete')return hasOnlyKeys(data,EMPTY_KEYS);
  return ['start','pause','resume','reset'].includes(payload.action)&&hasOnlyKeys(data,EMPTY_KEYS);
}
function validDraftEventPayload(payload){
  if(!hasOnlyKeys(payload,DRAFT_EVENT_KEYS)||!validRoomCode(payload.roomCode)||typeof payload.type!=='string')return false;
  const data=payload.data??{};
  if(!validSocketObject(data,24*1024))return false;
  if(['hero:locked','hero:banned'].includes(payload.type))return hasOnlyKeys(data,SELECT_DATA_KEYS)&&validHeroId(data.heroId)&&['A','B'].includes(data.team)&&['pick','ban','divine-ban'].includes(data.actionType);
  if(['timer:tick','draft:paused','draft:resumed'].includes(payload.type))return hasOnlyKeys(data,TIMER_DATA_KEYS)&&Number.isFinite(Number(data.remaining))&&Number(data.remaining)>=0&&Number(data.remaining)<=3600;
  if(payload.type==='draft:started')return hasOnlyKeys(data,START_DATA_KEYS)&&validSocketObject(data.action||{},8*1024);
  if(payload.type==='divine:result')return hasOnlyKeys(data,DIVINE_DATA_KEYS)&&Array.isArray(data.rules)&&data.rules.length<=20
    &&Number.isInteger(Number(data.gameNumber))&&Number(data.gameNumber)>0&&validDraftGameRollId(data.gameRollId);
  if(payload.type==='all-random:result')return hasOnlyKeys(data,RANDOM_RESULT_DATA_KEYS)
    &&hasOnlyKeys(data.assignments,RANDOM_ASSIGNMENT_KEYS)
    &&['A','B'].every(side=>Array.isArray(data.assignments[side])&&data.assignments[side].length===4&&data.assignments[side].every(validHeroId))
    &&Number.isInteger(Number(data.gameNumber))&&Number(data.gameNumber)>0&&validDraftGameRollId(data.gameRollId);
  if(payload.type==='all-random:bans')return hasOnlyKeys(data,RANDOM_BAN_DATA_KEYS)&&Array.isArray(data.heroIds)&&data.heroIds.length<=100&&data.heroIds.every(validHeroId);
  if(['draft:completed','draft:reset'].includes(payload.type))return hasOnlyKeys(data,EMPTY_KEYS);
  return false;
}
function validDraftStatePayload(payload){
  if(!hasOnlyKeys(payload,DRAFT_STATE_KEYS,128*1024)||!validRoomCode(payload.roomCode)||!validSocketObject(payload.state,96*1024))return false;
  const state=payload.state;
  if(!hasOnlyKeys(state,STATE_KEYS,96*1024))return false;
  if(state.engine!==undefined&&(!validSocketObject(state.engine,48*1024)||!hasOnlyKeys(state.engine,ENGINE_STATE_KEYS,48*1024)))return false;
  if(state.chosenDivineRules!==undefined&&(!Array.isArray(state.chosenDivineRules)||state.chosenDivineRules.length>20))return false;
  if(state.hostBannedHeroIds!==undefined&&(!Array.isArray(state.hostBannedHeroIds)||state.hostBannedHeroIds.length>100||!state.hostBannedHeroIds.every(validHeroId)))return false;
  if(state.preDraft!==undefined&&!validSocketObject(state.preDraft,32*1024))return false;
  if(state.nextConfig!==undefined&&!validSocketObject(state.nextConfig,32*1024))return false;
  return true;
}
function rejectSocketPayload(socket,event){
  securityLog('socket.payload_rejected',{socketId:socket.id,event,userId:socket.user?.id||null});
  socket.emit('draft:error',{message:'Invalid or oversized realtime payload.'});
}
const permitSocketEvent=socketEventLimiter({max:60,windowMs:10_000});

io.use((socket,next)=>{
  try{
    const ticket=consumeDraftSocketTicket(socket.handshake.auth?.draftTicket);
    if(ticket){
      socket.data.ticket=ticket;
      socket.data.authType='draft-ticket';
      return next();
    }
    const token=String(socket.handshake.auth?.token||'')||accessTokenFromRequest(socketRequestLike(socket));
    const auth=authenticateAccessToken(token);
    socket.user=auth.user;
    socket.data.authSessionId=auth.sessionId;
    socket.data.authType='account';
    return next();
  }catch{
    securityLog('socket.authentication_failed',{ipHash:anonymize(socket.handshake.address)});
    return next(new Error('Authentication required.'));
  }
});
function recordDraftAction(roomId,role,actionType,payload={},actorUserId=null){
  const room = typeof roomId === 'number' 
    ? db.prepare('SELECT id, match_id FROM draft_rooms WHERE id=?').get(roomId)
    : db.prepare('SELECT id, match_id FROM draft_rooms WHERE room_code=?').get(String(roomId));
  const rId = room ? room.id : roomId;
  const mId = room ? room.match_id : null;

  db.prepare('INSERT INTO draft_actions(draft_room_id,actor_user_id,actor_role,action_type,payload_json) VALUES (?,?,?,?,?)')
    .run(rId,actorUserId||null,role||'unknown',String(actionType||'').slice(0,80),JSON.stringify(payload));

  try {
    db.prepare('INSERT INTO draft_logs(draft_room_id,match_id,event_type,event_data) VALUES (?,?,?,?)')
      .run(rId,mId,String(actionType||''),JSON.stringify(payload));
  } catch (err) {
    console.error('[DRAFT_LOG_ERROR]', err);
  }
}

// Draft Rooms elect one authoritative connected controller. Tournament Host is
// preferred, then Team A, then Team B. This lets the teams run their own draft
// when the organizer is not sitting in the room, without allowing two clients
// to publish competing timers or states.
const draftPresence = new Map();
function draftPresenceBucket(roomCode){
  const key=String(roomCode||'').toUpperCase();
  if(!draftPresence.has(key))draftPresence.set(key,new Map());
  return draftPresence.get(key);
}
function draftPresenceSnapshot(roomCode){
  const bucket=draftPresence.get(String(roomCode||'').toUpperCase());
  return Object.fromEntries(['host','teamA','teamB','referee','broadcaster','spectator'].map(role=>[role,bucket?.get(role)?.size||0]));
}
function addDraftPresence(socket,roomCode,role){
  removeDraftPresence(socket,{emit:false});
  const key=String(roomCode||'').toUpperCase();
  const bucket=draftPresenceBucket(key);
  const sockets=bucket.get(role)||new Set();
  sockets.add(socket.id);bucket.set(role,sockets);
  socket.data.presenceDraftRoomCode=key;
  socket.data.presenceDraftRole=role;
}
function removeDraftPresence(socket,{emit=true}={}){
  const key=socket.data.presenceDraftRoomCode;
  const role=socket.data.presenceDraftRole;
  if(!key||!role)return;
  const bucket=draftPresence.get(key);
  const sockets=bucket?.get(role);
  sockets?.delete(socket.id);
  if(sockets&&!sockets.size)bucket.delete(role);
  if(bucket&&!bucket.size)draftPresence.delete(key);
  socket.data.presenceDraftRoomCode=null;
  socket.data.presenceDraftRole=null;
  if(emit)emitDraftAuthority(key);
}
function draftAuthority(roomCode){
  const bucket=draftPresence.get(String(roomCode||'').toUpperCase());
  if(!bucket)return null;
  for(const role of ['host','teamA','teamB']){
    const socketId=bucket.get(role)?.values().next().value;
    if(socketId)return {role,socketId};
  }
  return null;
}
function emitDraftAuthority(roomCode){
  const key=String(roomCode||'').toUpperCase();
  const authority=draftAuthority(key);
  io.to(`draft:${key}`).emit('draft:authority',{
    role:authority?.role||null,
    socketId:authority?.socketId||null,
  });
  return authority;
}

io.on('connection',socket=>{
  socket.on('tournament:join',(payload={},ack=()=>{})=>{
    if(!permitSocketEvent(socket))return ack({ok:false,error:'Realtime rate limit exceeded.'});
    if(!hasOnlyKeys(payload,PUBLIC_JOIN_KEYS))return ack({ok:false,error:'Invalid realtime payload.'});
    const tournamentId=Number(payload.tournamentId);
    if(!Number.isInteger(tournamentId)||tournamentId<=0||!socket.user)return ack({ok:false,error:'Authenticated account required.'});
    const tournament=db.prepare('SELECT id,is_public FROM tournaments WHERE id=?').get(tournamentId);
    if(!tournament)return ack({ok:false,error:'Tournament not found.'});
    let role='spectator';
    if(tournament.is_public)socket.join(publicTournamentRoom(tournamentId));
    const context=permissionsForUser(socket.user.id,tournamentId);
    const memberships=db.prepare(`SELECT DISTINCT tm.team_id FROM team_members tm JOIN teams t ON t.id=tm.team_id
      WHERE tm.user_id=? AND t.tournament_id=? AND tm.membership_status='active'`).all(socket.user.id,tournamentId);
    const staffAccess=context.permissions.includes('*')||context.permissions.includes('match.read');
    if(staffAccess){
      socket.join(internalTournamentRoom(tournamentId));
      role=context.roles[0]||'player';
    }else if(memberships.length){
      memberships.forEach(member=>socket.join(internalTeamRoom(member.team_id)));
      role=context.roles.includes('captain')?'captain':'player';
    }else if(!tournament.is_public)return ack({ok:false,error:'Tournament access denied.'});
    ack({ok:true,role,public:Boolean(tournament.is_public),internal:staffAccess||memberships.length>0});
  });

  socket.on('draft:join',(payload={},ack=()=>{})=>{
    if(!permitSocketEvent(socket))return ack({ok:false,error:'Realtime rate limit exceeded.'});
    if(!hasOnlyKeys(payload,new Set(['roomCode']))||!validRoomCode(payload.roomCode))return ack({ok:false,error:'Invalid realtime payload.'});
    const room=findDraftRoom(payload.roomCode);
    if(!room)return ack({ok:false,error:'Draft room not found.'});
    let role=null;
    if(socket.data.ticket){
      if(Number(socket.data.ticket.draft_room_id)!==Number(room.id))return ack({ok:false,error:'Socket ticket is for another room.'});
      role=socket.data.ticket.role;
    }else if(socket.user){role=resolveDraftRoleForUser(room,socket.user.id);}
    if(!role) role='spectator';
    socket.data.draftRoomId=room.id;
    socket.data.draftRoomCode=room.room_code;
    socket.data.draftRole=role;
    socket.join(`draft:${room.room_code}`);
    socket.join(`draft:${room.room_code}:${role}`);
    addDraftPresence(socket,room.room_code,role);
    const authority=draftAuthority(room.room_code);
    const messages=db.prepare(`SELECT id,sender_role,sender_name,message,message_type,file_id,pinned,is_pinned,mentions_json,created_at
      FROM match_messages WHERE match_id=? AND deleted_at IS NULL ORDER BY id ASC LIMIT 300`).all(room.match_id).map(m=>({...m,mentions:jsonParse(m.mentions_json,[]),is_pinned:Boolean(m.is_pinned||m.pinned)}));
    const presence=draftPresenceSnapshot(room.room_code);
    const config=jsonParse(room.config_json);
    const state=jsonParse(room.state_json);
    let remaining_time=null;
    if(state.timer_started_at&&state.timer_duration){
      const elapsed=Math.floor((Date.now()-state.timer_started_at)/1000);
      remaining_time=Math.max(0,state.timer_duration-elapsed);
    }
    const syncPayload={ok:true,role,authorityRole:authority?.role||null,authoritySocketId:authority?.socketId||null,presence,config,state,remaining_time,messages,resynced:true};
    ack(syncPayload);
    socket.emit('draft:state_sync',syncPayload);
    io.to(`draft:${room.room_code}`).emit('draft:presence',{role,connected:true,presence});
    emitDraftAuthority(room.room_code);
  });

  socket.on('draft:command',(payload={})=>{
    if(!permitSocketEvent(socket)||!validDraftCommandPayload(payload))return rejectSocketPayload(socket,'draft:command');
    const {roomCode,action,data={}}=payload;
    const room=findDraftRoom(roomCode);
    if(!room||socket.data.draftRoomId!==room.id)return;
    const role=socket.data.draftRole;
    const preDraftActions=['pre-draft:coin-call','pre-draft:coin-flip','pre-draft:side-select','pre-draft:divine-select','pre-draft:complete'];
    const allowed={
      host:['select','lock','start','pause','resume','reset',...preDraftActions],
      teamA:['select','lock',...preDraftActions],
      teamB:['select','lock',...preDraftActions],
      referee:['pause','resume'],
      broadcaster:[],
      spectator:[],
    };
    if(!(allowed[role]||[]).includes(action))return socket.emit('draft:error',{message:'This room role cannot perform that action.'});
    const expected=draftSideForRoomRole(room,role);
    if(expected&&data.team&&data.team!==expected)return socket.emit('draft:error',{message:'You cannot control the other team.'});
    const authority=draftAuthority(room.room_code);
    if(!authority)return socket.emit('draft:error',{message:'No Team or Host is connected to control this Draft Room.'});
    recordDraftAction(room.id,role,`command.${action}`,data,socket.user?.id||socket.data.ticket?.user_id||null);
    io.to(authority.socketId).emit('draft:command',{action,data,fromRole:role});
  });

  socket.on('draft:event',(payload={})=>{
    if(!permitSocketEvent(socket)||!validDraftEventPayload(payload))return rejectSocketPayload(socket,'draft:event');
    const {roomCode,type,data={}}=payload;
    const room=findDraftRoom(roomCode);
    if(!room||socket.data.draftRoomId!==room.id)return;
    const role=socket.data.draftRole;
    const authority=draftAuthority(room.room_code);
    const authorityEvents=['draft:started','hero:locked','hero:banned','timer:tick','draft:paused','draft:resumed','divine:result','all-random:result','all-random:bans','draft:completed','draft:reset'];
    if(!authority||socket.id!==authority.socketId||!authorityEvents.includes(type))return;
    if(['divine:result','all-random:result'].includes(type)){
      const config=jsonParse(room.config_json);
      const match=db.prepare('SELECT current_game_number FROM matches WHERE id=?').get(room.match_id);
      if(!match||Number(data.gameNumber)!==Number(match.current_game_number||1)||Number(data.gameNumber)!==Number(config.gameNumber||1)||data.gameRollId!==config.gameRollId){
        return socket.emit('draft:error',{message:'Stale random result ignored. Reload the current game before rolling again.'});
      }
    }
    recordDraftAction(room.id,role,type,data,socket.user?.id||socket.data.ticket?.user_id||null);
    socket.to(`draft:${room.room_code}`).emit('draft:event',{type,data,by:role});
  });

  socket.on('draft:chat',(payload={})=>{
    if(!permitSocketEvent(socket)||!hasOnlyKeys(payload,DRAFT_CHAT_KEYS)||!validRoomCode(payload.roomCode)||typeof payload.message!=='string'||Buffer.byteLength(payload.message,'utf8')>4000)return rejectSocketPayload(socket,'draft:chat');
    const room=findDraftRoom(payload.roomCode);
    if(!room||socket.data.draftRoomId!==room.id)return;
    const role=socket.data.draftRole;
    if(!['host','teamA','teamB','referee'].includes(role))return socket.emit('draft:error',{message:'This room role cannot send chat messages.'});
    const text=sanitizeText(payload.message,1000);
    if(!text)return;
    const config=jsonParse(room.config_json);
    const names={host:'Host',teamA:config.teamA||'Team A',teamB:config.teamB||'Team B',referee:'Referee'};
    const result=db.prepare(`INSERT INTO match_messages(match_id,sender_role,sender_name,message) VALUES (?,?,?,?)`)
      .run(room.match_id,role,names[role]||role,text);
    const saved=db.prepare('SELECT * FROM match_messages WHERE id=?').get(Number(result.lastInsertRowid));
    io.to(`draft:${room.room_code}`).emit('draft:chat',saved);
    const tournament=db.prepare('SELECT tournament_id FROM matches WHERE id=?').get(room.match_id);
    if(tournament)emitInternalTournamentEvent(tournament.tournament_id,'match:chat',{matchId:room.match_id,message:saved});
  });

  socket.on('draft:state',(payload={})=>{
    if(!permitSocketEvent(socket)||!validDraftStatePayload(payload)){
      console.log('[DRAFT:STATE_REJECTED] Invalid payload or rate limit', { socketId: socket.id, userId: socket.user?.id });
      return rejectSocketPayload(socket,'draft:state');
    }
    const room=findDraftRoom(payload.roomCode);
    const authority=room?draftAuthority(room.room_code):null;
    if(!room||socket.data.draftRoomId!==room.id||!authority||socket.id!==authority.socketId){
      console.log('[DRAFT:STATE_REJECTED] Authority check failed', { 
        socketId: socket.id, 
        userId: socket.user?.id, 
        hasRoom: !!room, 
        draftRoomId: socket.data.draftRoomId, 
        roomId: room?.id, 
        hasAuthority: !!authority, 
        authoritySocketId: authority?.socketId 
      });
      return;
    }
    const safe=payload.state;
    const status=sanitizeText(safe.status||room.status,40);
    const config=jsonParse(room.config_json);
    const match=db.prepare('SELECT current_game_number FROM matches WHERE id=?').get(room.match_id);
    const configGameNumber=Number(config.gameNumber||match?.current_game_number||1);
    const stateGameNumber=Number(safe.gameNumber||safe.engine?.gameNumber||0);
    const stateRollMatches=validDraftGameRollId(safe.gameRollId)&&safe.gameRollId===config.gameRollId;
    const preDraftRollMatches=!safe.preDraft
      ||(Number(safe.preDraft.gameNumber)===stateGameNumber
        &&safe.preDraft.gameRollId===safe.gameRollId
        &&(!safe.preDraft.divine||(Number(safe.preDraft.divine.gameNumber)===stateGameNumber&&safe.preDraft.divine.gameRollId===safe.gameRollId)));
    
    if(!match||!Number.isInteger(stateGameNumber)||stateGameNumber!==configGameNumber||stateGameNumber!==Number(match.current_game_number||1)||!stateRollMatches||!preDraftRollMatches){
      console.log('[DRAFT:STATE_REJECTED] Stale state check failed', { 
        socketId: socket.id, 
        userId: socket.user?.id, 
        hasMatch: !!match, 
        stateGameNumber, 
        configGameNumber, 
        matchGameNumber: match?.current_game_number, 
        stateRollMatches, 
        preDraftRollMatches,
        stateGameRollId: safe.gameRollId,
        configGameRollId: config.gameRollId,
        preDraftGameNumber: safe.preDraft?.gameNumber,
        preDraftGameRollId: safe.preDraft?.gameRollId,
        divineGameNumber: safe.preDraft?.divine?.gameNumber,
        divineGameRollId: safe.preDraft?.divine?.gameRollId,
        engineState: safe.engine?.state
      });
      socket.emit('draft:error',{message:`Stale Draft state ignored. This room is on Game ${Number(match?.current_game_number||configGameNumber)}.`});
      socket.emit('draft:state',jsonParse(room.state_json));
      return;
    }
    transaction(()=>{
      db.prepare('UPDATE draft_rooms SET state_json=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?')
        .run(JSON.stringify(safe),status,room.id);
      if(safe.engine?.state==='complete'){
        const entrantTeams=draftEngineTeamsByEntrant(safe);
        db.prepare(`UPDATE match_games SET status='draft_complete',picks_a_json=?,picks_b_json=?,bans_a_json=?,bans_b_json=?,divine_json=?,draft_snapshot_json=?,completed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE match_id=? AND game_number=? AND status<>'completed'`)
          .run(JSON.stringify(entrantTeams.teamA?.picks||[]),JSON.stringify(entrantTeams.teamB?.picks||[]),JSON.stringify(entrantTeams.teamA?.bans||[]),JSON.stringify(entrantTeams.teamB?.bans||[]),JSON.stringify(safe.chosenDivineRules||[]),JSON.stringify(safe),room.match_id,stateGameNumber);
      }
    });
    socket.to(`draft:${room.room_code}`).emit('draft:state',safe);
  });

  socket.on('disconnect',()=>{
    if(socket.data.draftRoomCode&&socket.data.draftRole){
      const roomCode=socket.data.draftRoomCode;
      const role=socket.data.draftRole;
      removeDraftPresence(socket,{emit:false});
      socket.to(`draft:${roomCode}`).emit('draft:presence',{role,connected:false,presence:draftPresenceSnapshot(roomCode)});
      emitDraftAuthority(roomCode);
      return;
    }
    removeDraftPresence(socket);
  });
});

// Backward-compatible API versioning bridge. Existing /api routes remain canonical in v0.6,
// while clients can adopt /api/v1 now; 307 preserves the original HTTP method and request body.
app.all(/^\/api\/v1(?:\/(.*))?$/, (req,res) => {
  const suffix = req.params[0] ? `/${req.params[0]}` : '';
  const queryIndex = req.originalUrl.indexOf('?');
  const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
  res.redirect(307, `/api${suffix}${query}`);
});

// Periodic retention cleanup is intentionally conservative and never removes legal-hold/open-dispute evidence.
setInterval(()=>{try{
  cleanupExpiredFiles();
  purgeExpiredDraftTickets();
  db.prepare(`DELETE FROM tournaments
    WHERE source_platform='quick_draft' AND datetime(updated_at)<=datetime('now','-30 days')`).run();
  db.prepare(`DELETE FROM auth_sessions WHERE datetime(refresh_expires_at)<=datetime('now') OR (revoked_at IS NOT NULL AND datetime(revoked_at)<=datetime('now','-30 days'))`).run();
  db.prepare(`DELETE FROM email_verification_challenges WHERE id IN (
    SELECT id FROM email_verification_challenges
    WHERE datetime(expires_at)<=datetime('now','-1 day') OR (used_at IS NOT NULL AND datetime(used_at)<=datetime('now','-1 day'))
    ORDER BY id LIMIT 1000
  )`).run();
  db.prepare(`DELETE FROM oauth_states WHERE id IN (
    SELECT id FROM oauth_states
    WHERE datetime(expires_at)<=datetime('now','-1 day') OR (used_at IS NOT NULL AND datetime(used_at)<=datetime('now','-1 day'))
    ORDER BY id LIMIT 1000
  )`).run();
  db.prepare(`DELETE FROM provider_oauth_states WHERE id IN (
    SELECT id FROM provider_oauth_states
    WHERE datetime(expires_at)<=datetime('now','-1 day') OR (used_at IS NOT NULL AND datetime(used_at)<=datetime('now','-1 day'))
    ORDER BY id LIMIT 1000
  )`).run();
  db.prepare(`DELETE FROM email_change_challenges WHERE id IN (
    SELECT id FROM email_change_challenges
    WHERE datetime(expires_at)<=datetime('now','-1 day') OR (used_at IS NOT NULL AND datetime(used_at)<=datetime('now','-1 day'))
    ORDER BY id LIMIT 1000
  )`).run();
  db.prepare(`DELETE FROM dev_access_tokens WHERE id IN (SELECT id FROM dev_access_tokens WHERE datetime(expires_at)<=datetime('now') OR used_at IS NOT NULL ORDER BY id LIMIT 1000)`).run();
}catch(error){securityLog('maintenance.cleanup_failed',{message:error.message},'error');}},15*60*1000).unref();

app.use((error,_req,res,_next)=>{
  securityLog('http.unhandled_error',{message:error.message,stack:isProduction?undefined:error.stack},'error');
  res.status(500).json({error:'Unexpected server error.'});
});

process.on('unhandledRejection',(reason)=>{
  // Log unexpected async failures so process supervisors can alert and restart safely.
  securityLog('process.unhandled_rejection',{message:String(reason?.message||reason)},'error');
});

async function startApplication(){
  await ensureBootstrapAdmin();
  ensureDivineCardContentOwner();
  seedDivineCardAssets();
  const recommendationSeed=seedRecommendedHeroBuilds();
  if(recommendationSeed.createdPresets){
    console.log(`Imported ${recommendationSeed.createdPresets} recommended Divine Card builds for ${recommendationSeed.assignedHeroes} heroes.`);
  }
  server.listen(port, '0.0.0.0', ()=>{
    console.log(`RendezVu Arena v${appVersion} listening on 0.0.0.0:${port}`);
    if (securityConfig.canonicalOrigin) console.log(`Public origin: ${securityConfig.canonicalOrigin}`);
    console.log(`Allowed origins: ${securityConfig.allowedOrigins.join(', ')}`);
  });
}
startApplication().catch(error=>{
  securityLog('startup.failed',{message:error.message,stack:isProduction?undefined:error.stack},'error');
  process.exit(1);
});

let shuttingDown=false;
function gracefulShutdown(signal){
  if(shuttingDown)return;shuttingDown=true;console.log(`${signal} received. Saving SQLite state before shutdown…`);
  const forceTimer=setTimeout(()=>process.exit(1),5000);forceTimer.unref();
  io.close(()=>server.close(()=>{
    try{db.exec('PRAGMA wal_checkpoint(TRUNCATE);');db.close();}
    catch(error){console.error('Database shutdown warning:',error.message);}
    clearTimeout(forceTimer);process.exit(0);
  }));
}
process.once('SIGINT',()=>gracefulShutdown('SIGINT'));
process.once('SIGTERM',()=>gracefulShutdown('SIGTERM'));

const { db, jsonParse } = require('./db');

const ROLE_PERMISSIONS = {
  owner: ['*'],
  admin: ['*'],
  host: [
    'tournament.manage','team.create','team.edit','team.invite_captain','team.transfer_captain','team.randomize_solo',
    'seeding.edit','bracket.generate','bracket.restore','match.read','match.manage','match.notes.private.read',
    'result.submit','result.verify','dispute.review','evidence.read','chat.moderate','draft.control','draft.audit.read','broadcast.control'
  ],
  referee: [
    'match.read','match.checkin','match.notes.private.read','result.submit','dispute.review',
    'result.recommend','evidence.read','chat.send','draft.pause','draft.audit.read'
  ],
  scheduler: ['match.read','match.schedule','match.manage'],
  scorekeeper: ['match.read','result.submit'],
  broadcaster: ['match.read','broadcast.control'],
  // Captains receive match access through their linked team, not across the
  // entire tournament. This prevents a Captain from reading another team's
  // private Match Operations data by guessing an ID.
  captain: ['team.checkin','result.submit','result.confirm','dispute.create','chat.send','draft.assign'],
  player: ['match.read','chat.send','draft.play'],
};

function includesPermission(list, permission) {
  return list.includes('*') || list.includes(permission);
}

function tournamentRoles(userId, tournamentId) {
  const roles = [];
  const tournament = db.prepare('SELECT host_user_id FROM tournaments WHERE id = ?').get(tournamentId);
  if (tournament?.host_user_id === userId) roles.push('owner');

  const user = db.prepare('SELECT role FROM users WHERE id = ? AND is_active = 1').get(userId);
  if (user?.role === 'admin') roles.push('admin');

  const staff = db.prepare('SELECT role, permissions_json FROM tournament_staff WHERE tournament_id = ? AND user_id = ?').all(tournamentId, userId);
  staff.forEach(item => roles.push(item.role));

  // teams.captain_user_id is the canonical Captain authority. Roster flags are
  // presentation data and may be stale in databases created by older releases.
  const captain = db.prepare(`SELECT id FROM teams WHERE tournament_id = ? AND captain_user_id = ? AND team_status NOT IN ('withdrawn','disqualified') LIMIT 1`).get(tournamentId, userId);
  if (captain) roles.push('captain');

  return { roles: [...new Set(roles)], staff };
}

function permissionsForUser(userId, tournamentId) {
  const { roles, staff } = tournamentRoles(userId, tournamentId);
  const permissions = new Set();
  roles.forEach(role => (ROLE_PERMISSIONS[role] || []).forEach(permission => permissions.add(permission)));
  staff.forEach(item => jsonParse(item.permissions_json, []).forEach(permission => permissions.add(permission)));
  return { roles, permissions: [...permissions] };
}

function hasTournamentPermission(userId, tournamentId, permission) {
  const context = permissionsForUser(userId, tournamentId);
  return includesPermission(context.permissions, permission);
}

function requireTournamentPermission(permission) {
  return (req, res, next) => {
    const tournamentId = Number(req.params.id || req.params.tournamentId || req.body.tournamentId);
    if (!Number.isInteger(tournamentId)) return res.status(400).json({ error: 'Invalid tournament ID.' });
    if (!hasTournamentPermission(req.user.id, tournamentId, permission)) {
      return res.status(403).json({ error: `Permission required: ${permission}` });
    }
    req.tournamentId = tournamentId;
    req.permissionContext = permissionsForUser(req.user.id, tournamentId);
    next();
  };
}

function matchContext(matchId) {
  return db.prepare(`
    SELECT m.*, ta.captain_user_id team_a_captain_user_id, tb.captain_user_id team_b_captain_user_id
    FROM matches m
    LEFT JOIN teams ta ON ta.id=m.team_a_id
    LEFT JOIN teams tb ON tb.id=m.team_b_id
    WHERE m.id=?
  `).get(matchId);
}

function captainTeamForMatch(userId, match) {
  if (!match) return null;
  if (match.team_a_captain_user_id === userId) return match.team_a_id;
  if (match.team_b_captain_user_id === userId) return match.team_b_id;
  return null;
}

function canAccessMatch(userId, matchId) {
  const numericMatchId = Number(matchId);
  if (!Number.isInteger(numericMatchId)) return { allowed: false, match: null, teamId: null, permissions: [] };
  const match = matchContext(numericMatchId);
  if (!match) return { allowed: false, match: null, teamId: null, permissions: [] };
  const context = permissionsForUser(userId, match.tournament_id);
  const teamId = captainTeamForMatch(userId, match);
  const linkedMember = db.prepare(`
    SELECT tm.team_id FROM team_members tm
    WHERE tm.user_id=? AND tm.membership_status='active' AND tm.team_id IN (?,?) LIMIT 1
  `).get(userId, match.team_a_id || -1, match.team_b_id || -1);
  const allowed = includesPermission(context.permissions, 'match.read') || Boolean(teamId || linkedMember);
  return { allowed, match, teamId: teamId || linkedMember?.team_id || null, permissions: context.permissions, roles: context.roles };
}

function requireMatchAccess(req, res, next) {
  const matchId = Number(req.params.matchId);
  const context = canAccessMatch(req.user.id, matchId);
  if (!context.match) return res.status(404).json({ error: 'Match not found.' });
  if (!context.allowed) return res.status(403).json({ error: 'Match access required.' });
  req.match = context.match;
  req.matchTeamId = context.teamId;
  req.permissionContext = context;
  next();
}

module.exports = {
  ROLE_PERMISSIONS,
  permissionsForUser,
  hasTournamentPermission,
  requireTournamentPermission,
  matchContext,
  captainTeamForMatch,
  canAccessMatch,
  requireMatchAccess,
};

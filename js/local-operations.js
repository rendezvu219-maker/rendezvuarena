// Account-free storage adapter for the existing Operations UI, not a second UI.
import { randomCode, randomSecret, generateBanOrder, orderedEvents } from './static-core.js';
import { saveLocalTournament, prepareTournamentRoom, saveTournamentDraftGame } from './tournament-draft.js?v=0.7.16-dashboard-polish';
import { t } from './i18n.js';

export const OPERATIONS_STORAGE_KEY = 'rv_local_operations_v1';
const clone = value => structuredClone(value);
const read = (storage, key, fallback = {}) => JSON.parse(storage.getItem(key) || JSON.stringify(fallback));
const now = () => new Date().toISOString();
function fail(code) {
  const messages = {
    OPS_BACKEND_FEATURE: t('guestOpsBackendRequired'),
    OPS_NOT_FOUND: 'This tournament is not saved in this browser. Open the Host browser where it was created.',
    OPS_BRACKET_REQUIRED: t('guestOpsBracketRequired'),
    OPS_TEAMS_NOT_DECIDED: 'Both teams must be decided before opening this match.',
    OPS_INVALID_SCORE: 'Enter a valid final score for this best-of series.',
    OPS_BRACKET_ALREADY_EXISTS: 'Restore the team setup before generating a bracket to change randomized teams.',
  };
  const error = new Error(`${code}: ${messages[code] || 'Check the entered tournament values and try again.'}`);
  error.status = 400; throw error;
}
const shuffled = values => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
};

export class LocalOperations {
  constructor({ storage = localStorage, baseUrl = location.href } = {}) {
    this.storage = storage; this.baseUrl = baseUrl;
    this.user = { id: 0, role: 'organizer', displayName: 'Host', isGuestOrganizer: true };
  }
  load() { return read(this.storage, OPERATIONS_STORAGE_KEY, { nextId: Date.now(), tournaments: [] }); }
  save(store) { this.storage.setItem(OPERATIONS_STORAGE_KEY, JSON.stringify(store)); }
  id(store) { return ++store.nextId; }
  audit(event, action, details = {}) { event.logs.unshift({ id: event.logs.length + 1, action, details, user_name: 'Host', created_at: now() }); }
  activeTeams(event) { return event.teams.filter(team => !['withdrawn', 'disqualified'].includes(team.team_status)); }
  preflight(event) {
    const teams = this.activeTeams(event), blockers = [];
    if (teams.length < 2) blockers.push('Add at least two teams before generating the bracket.');
    if (teams.some(team => !team.name.trim())) blockers.push('Every team needs a name.');
    return { ok: !blockers.length, blockers, warnings: [] };
  }
  refresh(event) {
    for (const match of event.matches) {
      const events = read(this.storage, `rv_tournament_events_${event.tournament.id}_${match.id}`);
      const games = orderedEvents(events).filter(entry => entry.type === 'game_result');
      if (games.length && !match.manualResult) {
        const latest = games.at(-1);
        match.score_a = latest.scoreA; match.score_b = latest.scoreB;
        match.current_game_number = latest.seriesComplete ? latest.game : latest.game + 1;
        if (latest.seriesComplete) { match.winner_team_id = latest.scoreA > latest.scoreB ? match.team_a_id : match.team_b_id; match.result_status = 'final'; match.match_status = 'completed'; }
      }
      const room = event.rooms[match.id];
      match.draft_room_ready = Boolean(room);
      if (room && match.result_status !== 'final') {
        const state = read(this.storage, `gs-quick-draft-state:${room.roomId}`);
        if (state.status === 'complete') match.match_status = 'playing';
      }
    }
    // Parents are generated after their children, so one pass propagates winners.
    for (const match of event.matches) {
      if (!match.next_match_id) continue;
      const next = event.matches.find(item => item.id === match.next_match_id);
      const field = match.next_match_side === 'B' ? 'team_b_id' : 'team_a_id';
      const winner = match.result_status === 'final' ? match.winner_team_id : null;
      if (next[field] !== winner) {
        next[field] = winner; next.winner_team_id = null; next.score_a = null; next.score_b = null;
        next.result_status = 'none'; next.match_status = 'available'; next.manualResult = false;
        if (event.rooms[next.id]) {
          // A changed matchup must not reuse its predecessor's capabilities/history.
          const oldRoom = event.rooms[next.id].roomId;
          const context = read(this.storage, `rv_tournament_room_${oldRoom}`);
          this.storage.setItem(`rv_tournament_room_${oldRoom}`, JSON.stringify({ ...context, revoked: true }));
          delete event.rooms[next.id];
          this.storage.removeItem(`rv_tournament_events_${event.tournament.id}_${next.id}`);
        }
      }
    }
    for (const match of event.matches) {
      for (const side of ['a', 'b']) {
        const team = event.teams.find(item => item.id === match[`team_${side}_id`]);
        match[`team_${side}_name`] = team?.name || null; match[`team_${side}_tag`] = team?.tag || '';
        match[`team_${side}_logo`] = team?.logo_url || '';
      }
      match.status = match.match_status; match.unread_count = 0;
      match.effective_scheduled_at = match.scheduled_at || event.tournament.start_at;
      match.tournament_id = event.tournament.id;
    }
    return event;
  }
  details(event) {
    this.refresh(event);
    return { tournament: clone(event.tournament), teams: clone(event.teams), matches: clone(event.matches),
      permissions: { roles: ['owner'], permissions: ['*'] }, preflight: this.preflight(event),
      groupStandings: this.standings(event), bracketSnapshots: clone(event.snapshots), staff: clone(event.staff),
      joinRequests: [], mockToolsAvailable: false, localOperations: true };
  }
  newTeam(store, event, input) {
    const name = String(input.name || '').trim(); if (!name) fail('OPS_TEAM_NAME_REQUIRED');
    return { id: this.id(store), tournament_id: event.tournament.id, name, tag: String(input.tag || name.slice(0, 4)).toUpperCase(),
      region: input.region || '', team_status: 'ready', seed: event.teams.length + 1, seed_locked: false,
      captain_user_id: null, members: [], logo_url: '', formation_source: 'manual', source: 'manual' };
  }
  newMatch(store, event, input = {}) {
    return { id: this.id(store), tournament_id: event.tournament.id, stage: 'playoff', round_no: 1, position: 1,
      team_a_id: null, team_b_id: null, winner_team_id: null, score_a: null, score_b: null, result_status: 'none',
      current_game_number: 1, match_status: 'available', best_of: Number(event.tournament.rules.playoffBestOf || 3),
      series_rule: event.tournament.rules.seriesRule || 'normal', server_region: event.tournament.default_server,
      round_name: '', round_label: '', group_name: null, next_match_id: null, next_match_side: null,
      public_notes: '', private_notes: '', room_code: '', rules: {}, ...input };
  }
  snapshot(store, event) {
    event.snapshots.push({ id: this.id(store), created_at: now(), reason: 'Host', matches: clone(event.matches), rooms: clone(event.rooms) });
  }
  knockout(store, event, teams, bestOf, preserveGroups = false) {
    if (teams.length < 2) fail('OPS_NEEDS_TWO_TEAMS');
    this.snapshot(store, event);
    event.matches = preserveGroups ? event.matches.filter(match => match.stage === 'group') : [];
    let size = 2; while (size < teams.length) size *= 2;
    let positions = [1, 2]; while (positions.length < size) positions = positions.flatMap(seed => [seed, positions.length * 2 + 1 - seed]);
    let previous = [];
    for (let round = 1, count = size / 2; count >= 1; round++, count /= 2) {
      const label = count === 1 ? 'Grand Final' : count === 2 ? 'Semi Final' : count === 4 ? 'Quarter Final' : `Round ${round}`;
      const current = Array.from({ length: count }, (_, index) => this.newMatch(store, event, {
        round_no: round, round_name: label, round_label: label, position: index + 1,
        best_of: count === 1 ? Number(event.tournament.rules.grandFinalBestOf || bestOf) : Number(bestOf),
        team_a_id: round === 1 ? teams[positions[index * 2] - 1]?.id || null : null,
        team_b_id: round === 1 ? teams[positions[index * 2 + 1] - 1]?.id || null : null,
      }));
      previous.forEach((match, index) => { match.next_match_id = current[Math.floor(index / 2)].id; match.next_match_side = index % 2 ? 'B' : 'A'; });
      if (round === 1) current.filter(match => Boolean(match.team_a_id) !== Boolean(match.team_b_id)).forEach(match => {
        match.winner_team_id = match.team_a_id || match.team_b_id; match.result_status = 'final'; match.match_status = 'completed'; match.manualResult = true;
      });
      event.matches.push(...current); previous = current;
    }
    this.refresh(event); return { matches: clone(event.matches) };
  }
  standings(event) {
    return [...new Set(event.matches.filter(match => match.stage === 'group').map(match => match.group_name))].map(name => {
      const matches = event.matches.filter(match => match.group_name === name);
      const ids = [...new Set(matches.flatMap(match => [match.team_a_id, match.team_b_id]))];
      const rows = ids.map(id => {
        const team = event.teams.find(item => item.id === id), played = matches.filter(match => match.result_status === 'final' && [match.team_a_id, match.team_b_id].includes(id));
        const wins = played.filter(match => match.winner_team_id === id).length;
        const gameWins = played.reduce((sum, match) => sum + Number(match.team_a_id === id ? match.score_a : match.score_b), 0);
        const gameLosses = played.reduce((sum, match) => sum + Number(match.team_a_id === id ? match.score_b : match.score_a), 0);
        return { team_id: id, teamId: id, team_name: team.name, name: team.name, team_tag: team.tag, tag: team.tag, seed: team.seed, played: played.length, wins, losses: played.length - wins, gameWins, gameLosses, gameDiff: gameWins - gameLosses };
      }).sort((a, b) => b.wins - a.wins || b.gameDiff - a.gameDiff || a.seed - b.seed).map((row, index) => ({ ...row, rank: index + 1 }));
      return { group: name, groupName: name, rows, standings: rows, matches, complete: matches.every(match => match.result_status === 'final') };
    });
  }
  async room(event, match) {
    if (!match.team_a_id || !match.team_b_id) fail('OPS_TEAMS_NOT_DECIDED');
    const rules = { ...event.tournament.rules, ...match.rules };
    if (!event.rooms[match.id]) event.rooms[match.id] = { roomId: randomCode(), tokens: { A: randomSecret(), B: randomSecret(), O: randomSecret(), S: randomSecret() } };
    const roomRules = { ...rules, bestOf: match.best_of, seriesRule: match.series_rule,
      banCount: rules.heroBans ?? 2, banOrder: (rules.customBanOrder || generateBanOrder(rules.heroBans ?? 2)).join(' '),
      pickOrder: (rules.customPickOrder || ['A','B','B','A','B','A','A','B']).join(' '), mode: rules.draftStyle === 'all-random' ? 'random' : 'draft',
      protectHeroes: rules.enableProtect ? rules.protectList || [] : [], globalBans: rules.globalBanList || [], operationsRoom: true };
    const tournament = { id: String(event.tournament.id), name: event.tournament.name, rules: roomRules,
      roomIds: Object.fromEntries(Object.entries(event.rooms).map(([id, value]) => [id, value.roomId])) };
    const secrets = { O: event.organizerToken, matches: Object.fromEntries(Object.entries(event.rooms).map(([id, value]) => [id, value.tokens])) };
    saveLocalTournament(tournament, secrets, this.storage);
    const prepared = await prepareTournamentRoom(tournament, { id: String(match.id), teamA: match.team_a_name, teamB: match.team_b_name, bestOf: match.best_of }, secrets, this.baseUrl, this.storage);
    return { roomCode: prepared.roomCode, config: prepared.config, links: prepared.links, status: 'waiting' };
  }
  games(event, match) {
    const room = event.rooms[match.id]; const state = room ? read(this.storage, `gs-quick-draft-state:${room.roomId}`) : {};
    const entries = orderedEvents(read(this.storage, `rv_tournament_events_${event.tournament.id}_${match.id}`)).filter(entry => entry.type === 'game_result');
    const games = entries.map(entry => ({ id: entry.id, game_number: entry.game, status: 'completed', winner_team_id: entry.side === 'A' ? match.team_a_id : match.team_b_id,
      picks_a_json: JSON.stringify(entry.picksA), picks_b_json: JSON.stringify(entry.picksB) }));
    return { games, currentGameNumber: match.current_game_number, scoreA: Number(match.score_a || 0), scoreB: Number(match.score_b || 0),
      winsNeeded: Math.floor(match.best_of / 2) + 1, seriesRule: match.series_rule, seriesComplete: match.result_status === 'final', draftComplete: state.engine?.state === 'complete' };
  }
  request(route, options = {}) {
    const operation = (this.pending || Promise.resolve()).then(() => this.performRequest(route, options));
    this.pending = operation.catch(() => {});
    return operation;
  }
  async performRequest(route, options = {}) {
    const store = this.load(), url = new URL(route, this.baseUrl), parts = url.pathname.split('/').filter(Boolean);
    const method = String(options.method || 'GET').toUpperCase(), body = options.body || {};
    const finish = (event, payload) => { if (event && method !== 'GET') this.audit(event, parts.slice(2).join('.'), body); this.save(store); return clone(payload); };
    if (parts[1] === 'tournaments' && parts.length === 2) {
      if (method === 'GET') return { tournaments: store.tournaments.filter(event => !event.deletedAt).map(event => clone(event.tournament)), trash: store.tournaments.filter(event=>event.deletedAt).map(event=>({...clone(event.tournament),deletedAt:event.deletedAt})) };
      const name = String(body.name || '').trim(); if (!name) fail('OPS_NAME_REQUIRED');
      const id = this.id(store), rules = { seriesRule: 'normal', heroBans: 2, timerSeconds: 30, enableCoinFlip: true, enableDivineDraw: true, playoffBestOf: 3, grandFinalBestOf: 3, ...body.rules };
      const tournament = { id, name, slug: `local-${id}`, description: '', status: 'preparing', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', default_server: 'Asia',
        source_platform: 'manual', source_sync_status: 'host_confirmed', schedule_mode: 'fixed_tournament_start', is_public: false, registration_mode: 'open', result_reopen_hours: 72, evidence_retention_days: 30, chat_retention_days: 30, created_at: now(), rules, localOperations: true };
      const event = { tournament, teams: [], matches: [], rooms: {}, organizerToken: randomSecret(), snapshots: [], staff: [], logs: [], messages: {}, results: {}, files: {} };
      store.tournaments.push(event); return finish(event, { tournament });
    }
    const event = parts[1] === 'matches' ? store.tournaments.find(item => item.matches.some(match => match.id === Number(parts[2]))) : store.tournaments.find(item => item.tournament.id === Number(parts[2]));
    if (!event) fail('OPS_NOT_FOUND');
    if (parts[1] === 'tournaments' && parts.length === 3 && method === 'DELETE') {
      if (!event.deletedAt) {
        event.deletedAt = now();
        for (const {roomId} of Object.values(event.rooms)) {
          const key = `rv_tournament_room_${roomId}`, context = read(this.storage,key);
          this.storage.setItem(key,JSON.stringify({...context,revokedBeforeDelete:Boolean(context.revoked),revoked:true,deletedTournament:true}));
        }
      }
      return finish(event,{deleted:true,recoverable:true});
    }
    if (parts[1] === 'tournaments' && parts[3] === 'restore' && parts.length === 4 && method === 'POST') {
      delete event.deletedAt;
      for (const {roomId} of Object.values(event.rooms)) {
        const key = `rv_tournament_room_${roomId}`, context = read(this.storage,key);
        if (context.deletedTournament) {
          context.revoked = Boolean(context.revokedBeforeDelete);
          delete context.deletedTournament; delete context.revokedBeforeDelete;
          this.storage.setItem(key,JSON.stringify(context));
        }
      }
      return finish(event,{restored:true,tournament:event.tournament});
    }
    if (event.deletedAt) fail('OPS_NOT_FOUND');
    this.refresh(event);
    if (parts[1] === 'matches') {
      const match = event.matches.find(item => item.id === Number(parts[2])), tail = parts.slice(3).join('/');
      if (!tail) {
        const fields = { bestOf: 'best_of', seriesRule: 'series_rule', matchStatus: 'match_status', serverRegion: 'server_region', roomCode: 'room_code', publicNotes: 'public_notes', privateNotes: 'private_notes', stationId: 'station_id', assignedRefereeId: 'assigned_referee_id', assignedBroadcasterId: 'assigned_broadcaster_id', estimatedDurationMinutes: 'estimated_duration_minutes', streamPlatform: 'stream_platform', streamUrl: 'stream_url', teamALogoUrl: 'team_a_logo', teamBLogoUrl: 'team_b_logo' };
        for (const [key, value] of Object.entries(body)) if (fields[key]) match[fields[key]] = value;
        return finish(event, { match });
      }
      if (tail === 'draft-room') return finish(event, { room: await this.room(event, match) });
      if (tail === 'draft-room/access') { const room = await this.room(event, match); return finish(event, { url: room.links.broadcaster }); }
      if (tail === 'draft-room/actions') return { actions: [] };
      if (tail === 'games') return this.games(event, match);
      if (tail === 'checkin') return { checkins: [] };
      if (tail === 'draft-room/game-result') {
        const room = await this.room(event, match), state = read(this.storage, `gs-quick-draft-state:${room.roomCode}`), cfg = read(this.storage, `rv_config_${room.roomCode}`);
        if (Number(body.gameNumber) !== Number(cfg.gameNumber)) fail('OPS_STALE_GAME');
        const result = await saveTournamentDraftGame({ config: cfg, roomCode: room.roomCode, hostToken: event.rooms[match.id].tokens.O,
          winnerSide: body.winnerSide, engine: state.engine || {}, sideAssignment: state.preDraft?.sideAssignment || cfg.sideAssignment }, this.storage);
        this.refresh(event); return finish(event, { ...result, currentGameNumber: match.current_game_number });
      }
      if (tail === 'results' && method === 'GET') return { submissions: event.results[match.id] || [], confirmations: [], currentSubmission: (event.results[match.id] || []).at(-1) || null, disputes: [] };
      if (tail.startsWith('results/')) {
        if (tail.endsWith('/reopen')) { match.manualResult = true; match.result_status = 'none'; match.winner_team_id = null; match.score_a = null; match.score_b = null; }
        else {
          const a = Number(body.scoreA), b = Number(body.scoreB), needed = Math.floor(match.best_of / 2) + 1;
          if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || Math.max(a, b) !== needed || Math.min(a, b) >= needed) fail('OPS_INVALID_SCORE');
          match.manualResult = true; match.score_a = a; match.score_b = b; match.winner_team_id = a > b ? match.team_a_id : match.team_b_id; match.result_status = 'final'; match.match_status = 'completed';
          (event.results[match.id] ||= []).push({ revision: (event.results[match.id]?.length || 0) + 1, score_a: a, score_b: b, source_type: 'host', submitted_by_name: 'Host', created_at: now() });
        }
        this.refresh(event); return finish(event, { autoFinalized: true, match });
      }
      if (tail === 'messages') {
        if (method !== 'GET') (event.messages[match.id] ||= []).push({ id: this.id(store), sender_name: 'Host', sender_role: 'host', message: String(body.message || ''), file_id: body.fileId, created_at: now() });
        return finish(event, { messages: event.messages[match.id] || [] });
      }
      if (tail === 'files') { if (String(body.dataBase64 || '').length > 1024 * 1024) fail('OPS_ATTACHMENT_TOO_LARGE'); const file = { id: this.id(store), ...body }; event.files[file.id] = file; return finish(event, { file }); }
      fail('OPS_BACKEND_FEATURE');
    }
    const tail = parts.slice(3).join('/');
    if (!tail && method === 'GET') return finish(null, this.details(event));
    if (!tail) {
      const fields = { defaultServer: 'default_server', startAt: 'start_at', registrationMode: 'registration_mode', rosterLockAt: 'roster_lock_at', resultReopenHours: 'result_reopen_hours', evidenceRetentionDays: 'evidence_retention_days', chatRetentionDays: 'chat_retention_days', publicStreamPlatform: 'public_stream_platform', publicStreamUrl: 'public_stream_url', publicStreamLabel: 'public_stream_label', discordUrl: 'discord_url' };
      const allowed = new Set(['name','description','status','timezone','rules']);
      for (const [key, value] of Object.entries(body)) if (fields[key] || allowed.has(key)) event.tournament[fields[key] || key] = value;
      return finish(event, { tournament: event.tournament });
    }
    if (tail === 'preflight') return this.preflight(event);
    if (tail === 'start') { if (!this.preflight(event).ok || !event.matches.length) fail('OPS_BRACKET_REQUIRED'); event.tournament.status = 'ongoing'; return finish(event, { tournament: event.tournament }); }
    if (tail === 'audit') return { logs: clone(event.logs) };
    if (tail === 'teams') { const team = this.newTeam(store, event, body); event.teams.push(team); return finish(event, { team }); }
    if (parts[3] === 'teams') {
      const team = event.teams.find(item => item.id === Number(parts[4])); if (!team) fail('OPS_NOT_FOUND');
      if (parts.length === 5) { const fields = { teamStatus: 'team_status', logoUrl: 'logo_url', seedLocked: 'seed_locked', protectedSeedGroup: 'protected_seed_group', seedingNote: 'seeding_note' }; for (const key of ['name','tag','region','seed','teamStatus','logoUrl','seedLocked','protectedSeedGroup','seedingNote']) if (body[key] !== undefined) team[fields[key] || key] = body[key]; }
      else if (parts[5] === 'members') {
        if (method === 'POST') team.members.push({ id: this.id(store), display_name: body.displayName, gamer_tag: body.gamerTag || '', game_id: body.gameId || '', member_role: body.memberRole || 'player', is_substitute: Boolean(body.isSubstitute), membership_status: 'active', is_captain: false });
        else { const member = team.members.find(item => item.id === Number(parts[6])); if (method === 'DELETE') team.members = team.members.filter(item => item !== member); else if (member) { member.display_name = body.displayName ?? member.display_name; member.gamer_tag = body.gamerTag ?? member.gamer_tag; member.game_id = body.gameId ?? member.game_id; member.member_role = body.memberRole ?? member.member_role; member.is_substitute = body.isSubstitute ?? member.is_substitute; } }
      } else if (parts[5] === 'terminal') team.team_status = body.teamStatus;
      else fail('OPS_BACKEND_FEATURE');
      return finish(event, { team });
    }
    if (tail === 'seeding' && method === 'PUT') { for (const seed of body.seeds || []) { const team = event.teams.find(item => item.id === Number(seed.teamId)); if (team) Object.assign(team, { seed: seed.seed, seed_locked: Boolean(seed.seedLocked) }); } return finish(event, { teams: event.teams }); }
    if (tail === 'seeding/randomize') { event.seedUndo = clone(event.teams); const unlocked = shuffled(event.teams.filter(team => !team.seed_locked)); const seeds = event.teams.filter(team => !team.seed_locked).map(team => team.seed).sort((a,b) => a-b); unlocked.forEach((team,i) => { team.seed = seeds[i]; }); event.teams.sort((a,b) => a.seed-b.seed); return finish(event, { teams: event.teams }); }
    if (tail === 'seeding/undo') { if (event.seedUndo) event.teams = event.seedUndo; return finish(event, { teams: event.teams }); }
    if (tail === 'bracket/generate') { if (!this.preflight(event).ok) fail('OPS_NEEDS_TWO_TEAMS'); return finish(event, this.knockout(store, event, this.activeTeams(event).sort((a,b) => a.seed-b.seed), body.bestOf || 3)); }
    if (tail === 'bracket/generate-groups') {
      const teams = this.activeTeams(event).sort((a,b) => a.seed-b.seed), count = Number(body.groupCount || 2); if (count < 1 || count > teams.length / 2) fail('OPS_INVALID_GROUP_COUNT');
      this.snapshot(store, event); event.matches = [];
      for (let group = 0; group < count; group++) { const members = teams.filter((_,i) => i % count === group); for (let a = 0; a < members.length; a++) for (let b = a+1; b < members.length; b++) for (let leg = 0; leg < (body.doubleRoundRobin ? 2 : 1); leg++) event.matches.push(this.newMatch(store,event,{stage:'group', group_name:String.fromCharCode(65+group), round_name:`Group ${String.fromCharCode(65+group)}`, team_a_id:members[leg?b:a].id, team_b_id:members[leg?a:b].id, best_of:Number(body.bestOf||1), position:event.matches.length+1})); }
      return finish(event, { matches: event.matches });
    }
    if (tail === 'bracket/generate-playoffs') { const groups = this.standings(event); if (!body.force && groups.some(group => !group.complete)) fail('OPS_GROUPS_UNFINISHED'); const ids = groups.flatMap(group => group.rows.slice(0, Number(body.topPerGroup || 2)).map(row => row.team_id)); return finish(event, this.knockout(store,event,ids.map(id=>event.teams.find(team=>team.id===id)),body.bestOf||3,true)); }
    if (tail.startsWith('bracket/restore/')) { const snapshot = event.snapshots.find(item => item.id === Number(parts[5])); if (!snapshot) fail('OPS_NOT_FOUND'); event.matches = clone(snapshot.matches); event.rooms = clone(snapshot.rooms); return finish(event, { matches: event.matches }); }
    if (tail === 'matches/apply-best-of') { for (const match of event.matches) if (match.result_status !== 'final' && (!body.roundNo || match.round_no === Number(body.roundNo))) match.best_of = Number(body.bestOf); return finish(event, { matches: event.matches }); }
    if (tail === 'manual-randomizer/preview') {
      const names = shuffled((body.manualNames || []).map(name => String(name).trim()).filter(Boolean)), size = Number(body.teamSize || 4); if (size < 2 || names.length < size * 2 || names.length % size) fail('OPS_INVALID_TEAM_SIZE');
      event.preview = { id: this.id(store), totalPlayers: names.length, totalSlots: names.length, teamSize: size, assignments: Array.from({ length: names.length / size }, (_, i) => ({ name: `Team ${i+1}`, tag: `T${i+1}`, members: names.slice(i*size,(i+1)*size).map((name,j)=>({displayName:name,display_name:name,gamerTag:name,gamer_tag:name,isCaptain:false,source:'manual'})) })) };
      return finish(event, { preview: event.preview });
    }
    if (tail === 'manual-randomizer/confirm') { if (Number(body.previewId) !== event.preview?.id) fail('OPS_STALE_PREVIEW'); if (event.matches.length) fail('OPS_BRACKET_ALREADY_EXISTS'); event.teamUndo = clone(event.teams); for (const assignment of event.preview.assignments) { const team = this.newTeam(store,event,assignment); team.members = assignment.members.map(member => ({id:this.id(store),display_name:member.displayName,gamer_tag:member.gamerTag,is_captain:member.isCaptain,membership_status:'active',member_role:'player'})); event.teams.push(team); } delete event.preview; return finish(event, { teams: event.teams }); }
    if (tail === 'manual-randomizer/undo') { if (event.matches.length) fail('OPS_BRACKET_ALREADY_EXISTS'); if (event.teamUndo) event.teams = event.teamUndo; return finish(event, { teams: event.teams }); }
    if (tail === 'staff' && method === 'GET') return { staff: event.staff };
    if (tail === 'staff') { const staff = { user_id:this.id(store), username:String(body.identity||''), display_name:String(body.identity||''), role:body.role, permissions:[] }; event.staff.push(staff); return finish(event, { staff }); }
    if (parts[3] === 'staff' && method === 'DELETE') { event.staff = event.staff.filter(item=>!(item.user_id===Number(parts[4])&&item.role===parts[5])); return finish(event,{removed:true}); }
    fail('OPS_BACKEND_FEATURE');
  }
}

export function enableLocalOperations(options) {
  const service = new LocalOperations(options);
  window.GSLocalOperations = service;
  return service;
}

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { io } = require('socket.io-client');

const root = path.resolve(__dirname, '..');
const port = 3117;
const base = `http://127.0.0.1:${port}`;
const dbPath = path.join(root, 'data', 'smoke.sqlite');
const uploadPath = path.join(root, 'data', 'smoke-uploads');
fs.rmSync(uploadPath, { recursive: true, force: true });
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${dbPath}${suffix}`, { force: true });

const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: { ...process.env, NODE_ENV:'test', PORT: String(port), DATABASE_PATH: dbPath, UPLOAD_PATH: uploadPath, AUTH_SECRET: 'smoke-secret-32-characters-long-enough', ALLOW_DIRECT_HOST_REGISTRATION: 'true', ALLOW_MANUAL_TOURNAMENT_CREATION: 'true' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', chunk => process.stdout.write(chunk));
child.stderr.on('data', chunk => process.stderr.write(chunk));

function assert(condition, message) { if (!condition) throw new Error(message); }
async function request(url, { token, method = 'GET', body, expectError = false } = {}) {
  const response = await fetch(`${base}${url}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(!['GET','HEAD','OPTIONS'].includes(String(method).toUpperCase()) ? { 'X-CSRF-Token': '1' } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (expectError) return { response, payload };
  if (!response.ok) throw new Error(`${method} ${url}: ${payload.error || response.status}`);
  return payload;
}
async function rawRequest(url, token) {
  const response = await fetch(`${base}${url}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) throw new Error(`GET ${url}: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { await request('/api/health'); return; } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
  }
  throw new Error('Server did not start.');
}
async function register(index, role = 'player') {
  const name = role === 'host' ? 'smokehost' : `captain${index}`;
  return request('/api/auth/register', {
    method: 'POST',
    body: { displayName: `Smoke ${name}`, username: name, password: 'Password123!', passwordConfirmation: 'Password123!', role },
  });
}
async function connectRoom(roomCode, accessToken) {
  const exchanged = await request(`/api/public/draft-rooms/${encodeURIComponent(roomCode)}/access`, {
    method: 'POST', body: { accessToken },
  });
  return new Promise((resolve, reject) => {
    const socket = io(base, { transports: ['websocket'], auth: { draftTicket: exchanged.socketTicket } });
    socket.once('connect_error', reject);
    socket.once('connect', () => socket.emit('draft:join', { roomCode }, result => {
      if (!result?.ok) return reject(new Error(result?.error || 'join failed'));
      resolve({ socket, result });
    }));
  });
}
function accessFromFragment(url) {
  return new URLSearchParams(new URL(url, base).hash.slice(1)).get('access');
}

(async () => {
  const sockets = [];
  try {
    await waitForServer();
    const host = await register(0, 'host');
    const hostToken = host.token;
    const captains = [];
    for (let i = 1; i <= 6; i++) captains.push(await register(i));
    const referee = await request('/api/auth/register', {
      method: 'POST',
      body: { displayName: 'Smoke Referee', username: 'smokeref', password: 'Password123!', passwordConfirmation: 'Password123!', role: 'player' },
    });
    const broadcaster = await request('/api/auth/register', {
      method: 'POST',
      body: { displayName: 'Smoke Broadcaster', username: 'smokecast', password: 'Password123!', passwordConfirmation: 'Password123!', role: 'player' },
    });

    const created = await request('/api/tournaments', {
      token: hostToken, method: 'POST',
      body: {
        name: 'Smoke Cup v0.6', timezone: 'Asia/Ho_Chi_Minh', defaultServer: 'Asia', startAt: '2026-07-20T19:00',
        rules: { timerSeconds: 25, heroBans: 1, divineBans: 0, enableCoinFlip: false, enableDivineDraw: false, seriesRule: 'fearless', groupBestOf: 1, playoffBestOf: 3, mirrorPickMode: 'tank-technical', enableProtect: true, protectList: ['0001'], globalBanList: ['0038'], heroRuleScope: 'tournament' },
      },
    });
    const tournamentId = created.tournament.id;
    const slug = created.tournament.slug;
    await request(`/api/tournaments/${tournamentId}/publish`, { token: hostToken, method: 'POST' });

    await request(`/api/tournaments/${tournamentId}/staff`, {
      token: hostToken, method: 'POST', body: { identity: 'smokeref', role: 'referee' },
    });
    await request(`/api/tournaments/${tournamentId}/staff`, {
      token: hostToken, method: 'POST', body: { identity: 'smokecast', role: 'broadcaster' },
    });
    let staffPayload = await request(`/api/tournaments/${tournamentId}/staff`, { token: hostToken });
    assert(staffPayload.staff.some(item => item.user_id === referee.user.id && item.role === 'referee'), 'Host should be able to assign a Referee account.');
    assert(staffPayload.staff.some(item => item.user_id === broadcaster.user.id && item.role === 'broadcaster'), 'Host should be able to assign a Broadcaster account.');

    const teams = [];
    for (let i = 1; i <= 6; i++) {
      const payload = await request(`/api/tournaments/${tournamentId}/teams`, {
        token: hostToken, method: 'POST', body: { name: `Team ${i}`, tag: `T${i}`, region: i <= 2 ? 'SEA' : 'JP' },
      });
      const team = payload.team;
      await request(`/api/tournaments/${tournamentId}/teams/${team.id}/captain/assign`, {
        token: hostToken, method: 'POST', body: { identity: `captain${i}` },
      });
      teams.push({ ...team, captainToken: captains[i - 1].token, captainUser: captains[i - 1].user });
    }

    const rosterMember = await request(`/api/tournaments/${tournamentId}/teams/${teams[0].id}/members`, {
      token: hostToken, method: 'POST', body: { displayName: 'Roster Test', gamerTag: 'RT', gameId: 'game-1', memberRole: 'player' },
    });
    const updatedMember = await request(`/api/tournaments/${tournamentId}/teams/${teams[0].id}/members/${rosterMember.member.id}`, {
      token: hostToken, method: 'PATCH', body: { displayName: 'Roster Test Updated', gamerTag: 'RT2', gameId: 'game-2', memberRole: 'substitute', isSubstitute: true },
    });
    assert(updatedMember.member.display_name === 'Roster Test Updated' && updatedMember.member.is_substitute === 1, 'Team Detail roster edits should persist.');
    await request(`/api/tournaments/${tournamentId}/teams/${teams[0].id}/members/${rosterMember.member.id}`, { token: hostToken, method: 'DELETE' });

    await request(`/api/tournaments/${tournamentId}/seeding`, {
      token: hostToken, method: 'PUT',
      body: { seeds: teams.map((team, index) => ({ teamId: team.id, seed: index + 1, seedLocked: index < 2, region: index <= 1 ? 'SEA' : 'JP' })) },
    });
    const preflight = await request(`/api/tournaments/${tournamentId}/preflight`, { token: hostToken });
    assert(preflight.ok, `Preflight should pass: ${preflight.blockers?.join(' | ')}`);

    await request(`/api/tournaments/${tournamentId}/seeding/randomize`, { token: hostToken, method: 'POST' });
    let tournament = await request(`/api/tournaments/${tournamentId}`, { token: hostToken });
    assert(tournament.teams.find(team => team.id === teams[0].id).seed === 1, 'Locked seed 1 must remain fixed.');
    assert(tournament.teams.find(team => team.id === teams[1].id).seed === 2, 'Locked seed 2 must remain fixed.');

    const bracket = await request(`/api/tournaments/${tournamentId}/bracket/generate`, {
      token: hostToken, method: 'POST', body: { bestOf: 3, randomize: false, allowWarnings: true },
    });
    assert(bracket.matches.filter(match => match.stage === 'playoff').length === 7, 'Six-team single elimination should reserve seven matches.');
    tournament = await request(`/api/tournaments/${tournamentId}`, { token: hostToken });
    const playable = tournament.matches.find(match => match.team_a_id && match.team_b_id && match.result_status !== 'final');
    assert(playable, 'A playable match should exist.');
    assert(playable.effective_scheduled_at === '2026-07-20T19:00', 'Fixed tournament start should be inherited by matches.');

    await request(`/api/matches/${playable.id}`, {
      token: hostToken, method: 'PATCH',
      body: { matchStatus: 'checkin_open', serverRegion: 'Japan', roomCode: 'PRIVATE123', stationId: 'Station A', estimatedDurationMinutes: 40, assignedRefereeId: referee.user.id, assignedBroadcasterId: broadcaster.user.id, streamPlatform: 'Twitch', streamUrl: 'https://twitch.tv/example', publicNotes: 'Public note', privateNotes: 'Never leak this note' },
    });
    tournament = await request(`/api/tournaments/${tournamentId}`, { token: hostToken });
    const assignedMatch = tournament.matches.find(match => match.id === playable.id);
    assert(assignedMatch.station_id === 'Station A' && assignedMatch.assigned_referee_id === referee.user.id && assignedMatch.assigned_broadcaster_id === broadcaster.user.id, 'Match station and staff assignments should persist.');
    const refereeView = await request(`/api/tournaments/${tournamentId}`, { token: referee.token });
    assert(refereeView.staff.some(item => item.user_id === referee.user.id) && !refereeView.staff.some(item => Object.prototype.hasOwnProperty.call(item, 'email')), 'Non-managing staff may view assignments without staff email addresses.');
    const publicPayload = await request(`/api/public/tournaments/${slug}`);
    const publicMatch = publicPayload.matches.find(match => match.id === playable.id);
    assert(publicMatch.streamUrl === 'https://twitch.tv/example', 'Public API should expose the external stream URL.');
    assert(!Object.prototype.hasOwnProperty.call(publicMatch, 'room_code'), 'Public API must not expose the room code.');
    assert(!Object.prototype.hasOwnProperty.call(publicMatch, 'private_notes'), 'Public API must not expose staff notes.');

    // Host submission requires both linked Captains.
    let result = await request(`/api/matches/${playable.id}/results/submit`, {
      token: hostToken, method: 'POST', body: { scoreA: 2, scoreB: 1, sourceType: 'host' },
    });
    assert(result.match.result_status === 'awaiting_confirmation' && result.requiredTeams.length === 2, 'Host result must wait for both Captains.');
    const teamAToken = teams.find(team => team.id === playable.team_a_id).captainToken;
    const teamBToken = teams.find(team => team.id === playable.team_b_id).captainToken;
    await request(`/api/matches/${playable.id}/results/confirm`, { token: teamAToken, method: 'POST', body: { decision: 'confirm' } });
    result = await request(`/api/matches/${playable.id}/results/confirm`, { token: teamBToken, method: 'POST', body: { decision: 'confirm' } });
    assert(result.final && result.match.result_status === 'final', 'Matching Captain confirmations should auto-finalize without referee review.');

    // Correct a final result while the dependent match has not started.
    const wrongWinner = result.match.winner_team_id;
    const corrected = await request(`/api/matches/${playable.id}/results/correct`, {
      token: hostToken, method: 'POST', body: { scoreA: 0, scoreB: 2, reason: 'Host entered the winner incorrectly.' },
    });
    assert(corrected.match.result_status === 'awaiting_confirmation', 'Correct Final should reopen and create a new host submission.');
    await request(`/api/matches/${playable.id}/results/confirm`, { token: teamAToken, method: 'POST', body: { decision: 'confirm' } });
    result = await request(`/api/matches/${playable.id}/results/confirm`, { token: teamBToken, method: 'POST', body: { decision: 'confirm' } });
    assert(result.match.winner_team_id !== wrongWinner, 'Corrected final should replace the bracket winner.');

    tournament = await request(`/api/tournaments/${tournamentId}`, { token: hostToken });
    const child = tournament.matches.find(match => match.id === (playable.feeds_into_winner_match_id || playable.next_match_id));
    if (child) {
      await request(`/api/matches/${child.id}`, { token: hostToken, method: 'PATCH', body: { matchStatus: 'playing' } });
      const blocked = await request(`/api/matches/${playable.id}/results/reopen`, { token: hostToken, method: 'POST', body: { reason: 'Should be blocked' }, expectError: true });
      assert(blocked.response.status === 400 && /dependent match/i.test(blocked.payload.error), 'Reopen must be blocked after a dependent match starts.');
      await request(`/api/matches/${child.id}`, { token: hostToken, method: 'PATCH', body: { matchStatus: 'available' } });
    }

    const draftMatch = tournament.matches.find(match => match.team_a_id && match.team_b_id && match.id !== playable.id && match.result_status !== 'final');
    assert(draftMatch, 'Another playable match should exist for Draft Room tests.');
    await request(`/api/matches/${draftMatch.id}`, { token: hostToken, method: 'PATCH', body: { seriesRule: 'fearless', bestOf: 3 } });
    const draft = await request(`/api/matches/${draftMatch.id}/draft-room`, { token: hostToken, method: 'POST' });
    assert(draft.room.config.seriesRule === 'fearless', 'Series rule should flow into Draft Room config.');
    assert(draft.room.config.protectList.includes('0001'), 'Protected hero rules should flow into Draft Room config.');
    assert(draft.room.config.globalBanList.includes('0038'), 'Global Ban rules should flow into Draft Room config.');
    assert(draft.room.config.mirrorPickMode === 'tank-technical', 'Mirror-pick role mode should flow into Draft Room config.');
    assert(!Object.prototype.hasOwnProperty.call(draft.room.config, 'rolePreset'), 'Role composition presets must not be emitted; composition is fixed by the game.');
    assert(draft.room.config.draftStyle !== 'random-draft', 'Removed Random Draft mode must never be emitted.');
    assert(!draft.room.links.spectator, 'Draft Room must not create a spectator account/link.');
    const hostAccess = accessFromFragment(draft.room.links.host);
    const teamAAccess = accessFromFragment(draft.room.links.teamA);
    const hostSocket = await connectRoom(draft.room.roomCode, hostAccess);
    const teamASocket = await connectRoom(draft.room.roomCode, teamAAccess);
    sockets.push(hostSocket.socket, teamASocket.socket);
    assert(hostSocket.result.role === 'host' && teamASocket.result.role === 'teamA', 'Draft roles should resolve correctly.');

    const commandPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Host did not receive team command.')), 2000);
      hostSocket.socket.once('draft:command', payload => { clearTimeout(timer); resolve(payload); });
    });
    teamASocket.socket.emit('draft:command', { roomCode: draft.room.roomCode, action: 'select', data: { heroId: '0001', team: 'A' } });
    assert((await commandPromise).fromRole === 'teamA', 'Team command should route only to Host control.');

    hostSocket.socket.emit('draft:state', {
      roomCode: draft.room.roomCode,
      state: { status: 'complete', engine: { state: 'complete', teamA: { picks: ['0001'], bans: ['0005'] }, teamB: { picks: ['0002'], bans: ['0006'] } }, chosenDivineRules: [] },
    });
    await new Promise(resolve => setTimeout(resolve, 150));
    const draftTeamAToken = teams.find(team => team.id === draftMatch.team_a_id).captainToken;
    const draftTeamBToken = teams.find(team => team.id === draftMatch.team_b_id).captainToken;
    const gameReport = await request(`/api/matches/${draftMatch.id}/games/current/report`, { token: draftTeamAToken, method: 'POST', body: { winnerSide: 'A' } });
    assert(gameReport.game.result_status === 'awaiting_confirmation', 'Game 1 should wait for the opposing Captain confirmation.');
    const nextDraft = await request(`/api/matches/${draftMatch.id}/games/current/confirm`, { token: draftTeamBToken, method: 'POST', body: { decision: 'confirm' } });
    assert(nextDraft.scoreA === 1 && nextDraft.scoreB === 0, 'Confirming Game 1 should update the live BO score.');
    assert(nextDraft.room.config.gameNumber === 2, 'Recording Game 1 should prepare Game 2 automatically.');
    assert(nextDraft.room.config.seriesScoreA === 1 && nextDraft.room.config.seriesScoreB === 0, 'Draft Room config should carry the current series score.');
    assert(nextDraft.room.config.previousPicksA.includes('0001') && nextDraft.room.config.previousPicksB.includes('0002'), 'Fearless history should accumulate picked heroes.');
    assert(!nextDraft.room.config.previousPicksA.includes('0005') && !nextDraft.room.config.previousPicksB.includes('0006'), 'Banned heroes must not persist into Fearless history.');
    const gamesAfterScore = await request(`/api/matches/${draftMatch.id}/games`, { token: hostToken });
    assert(gamesAfterScore.games.find(game => game.game_number === 1)?.winner_team_id === draftMatch.team_a_id, 'Game history should store the winning team.');

    const captainAccess = await request(`/api/matches/${draftMatch.id}/draft-room/access`, { token: draftTeamAToken });
    assert(captainAccess.role === 'teamA' && captainAccess.url.includes('access='), 'Linked Captain should receive only their team Draft Room link.');

    const chat = await request(`/api/matches/${draftMatch.id}/messages`, {
      token: draftTeamAToken,
      method: 'POST', body: { message: 'Captain is ready.' },
    });
    assert(chat.message.sender_role === 'captain', 'Captain Match Chat should be authenticated by account.');

    // A rejected per-game report opens the dispute before evidence can be uploaded.
    hostSocket.socket.emit('draft:state', {
      roomCode: draft.room.roomCode,
      state: { status: 'complete', engine: { state: 'complete', teamA: { picks: ['0003'], bans: [] }, teamB: { picks: ['0004'], bans: [] } }, chosenDivineRules: [] },
    });
    await new Promise(resolve => setTimeout(resolve, 150));
    await request(`/api/matches/${draftMatch.id}/games/current/report`, { token: draftTeamAToken, method: 'POST', body: { winnerSide: 'A' } });
    await request(`/api/matches/${draftMatch.id}/games/current/confirm`, { token: draftTeamBToken, method: 'POST', body: { decision: 'reject', comment: 'The recorded Game 2 winner is incorrect.' } });
    const fileText = Buffer.from('evidence test', 'utf8');
    const upload = await request(`/api/matches/${draftMatch.id}/files`, {
      token: draftTeamAToken,
      method: 'POST', body: { purpose: 'evidence', originalName: 'evidence.txt', mimeType: 'text/plain', dataBase64: fileText.toString('base64') },
    });
    assert(upload.file.visibility === 'staff_only', 'Dispute evidence must default to staff-only visibility.');
    const downloaded = await rawRequest(`/api/files/${upload.file.id}`, hostToken);
    assert(downloaded.toString() === 'evidence test', 'Authorized staff should be able to retrieve evidence.');

    // Group stage + matching team submissions auto-finalize without a referee bottleneck.
    const groups = await request(`/api/tournaments/${tournamentId}/bracket/generate-groups`, {
      token: hostToken, method: 'POST', body: { groupCount: 2, topPerGroup: 2, bestOf: 1, allowWarnings: true },
    });
    const groupMatches = groups.matches.filter(match => match.stage === 'group');
    assert(groupMatches.length === 6, 'Two groups of three should create six round-robin matches.');
    for (const match of groupMatches) {
      const aToken = teams.find(team => team.id === match.team_a_id).captainToken;
      const bToken = teams.find(team => team.id === match.team_b_id).captainToken;
      await request(`/api/matches/${match.id}/results/submit`, { token: aToken, method: 'POST', body: { scoreA: 1, scoreB: 0 } });
      const matched = await request(`/api/matches/${match.id}/results/submit`, { token: bToken, method: 'POST', body: { scoreA: 1, scoreB: 0 } });
      assert(matched.autoFinalized, 'Matching Captain submissions should auto-finalize a group match.');
    }
    tournament = await request(`/api/tournaments/${tournamentId}`, { token: hostToken });
    assert(tournament.groupStandings.length === 2 && tournament.groupStandings.every(group => group.complete), 'Group standings should complete after all results are final.');
    const playoffs = await request(`/api/tournaments/${tournamentId}/bracket/generate-playoffs`, {
      token: hostToken, method: 'POST', body: { topPerGroup: 2, bestOf: 3 },
    });
    assert(playoffs.matches.filter(match => match.stage === 'playoff').length === 3, 'Four qualifiers should create a three-match playoff bracket.');

    const portal = await request('/api/portal', { token: captains[0].token });
    assert(portal.teams.some(team => team.id === teams[0].id), 'Captain Portal should list teams linked to the account.');
    assert(!('watchUrl' in portal), 'Captain Portal must not expose an embedded watch-page concept.');

    console.log('SMOKE TEST PASSED');
  } finally {
    sockets.forEach(socket => socket.disconnect());
    child.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 150));
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${dbPath}${suffix}`, { force: true });
    fs.rmSync(uploadPath, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

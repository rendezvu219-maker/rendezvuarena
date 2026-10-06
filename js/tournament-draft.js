import { normalizeRules, randomSecret, orderedEvents } from './static-core.js';
import { p2pDraftLinks } from './draft-links.js?v=0.7.16-dashboard-polish';
import { firebaseConfigured, readValue, writeMany, appendProtectedEvent } from './firebase.js';

const configKey = id => `rv_tournament_config_${id}`;
const accessKey = id => `rv_tournament_access_${id}`;
const eventKey = (id, matchId) => `rv_tournament_events_${id}_${matchId}`;
const read = (storage, key, fallback = null) => JSON.parse(storage.getItem(key) || JSON.stringify(fallback));

export function saveLocalTournament(config, secrets, storage = localStorage) {
  storage.setItem(configKey(config.id), JSON.stringify(config));
  storage.setItem(accessKey(config.id), JSON.stringify(secrets));
}

export async function loadTournament(id, token, storage = localStorage) {
  let config = read(storage, configKey(id));
  let secrets = read(storage, accessKey(id));
  if (!config && firebaseConfigured()) {
    config = await readValue(`tournamentConfigs/${id}`);
    const matches = token ? await readValue(`tournamentLinks/${id}/${token}`) : null;
    if (matches) secrets = { O: token, matches };
    if (config) storage.setItem(configKey(id), JSON.stringify(config));
    if (secrets) storage.setItem(accessKey(id), JSON.stringify(secrets));
  }
  if (config && token && secrets?.O !== token && firebaseConfigured()) {
    const matches = await readValue(`tournamentLinks/${id}/${token}`);
    if (matches) { secrets = { O: token, matches }; storage.setItem(accessKey(id), JSON.stringify(secrets)); }
  }
  return { config, secrets: secrets?.O === token ? secrets : null };
}

export function tournamentEvents(config, storage = localStorage) {
  return Object.assign({}, ...Object.keys(config.roomIds).map(matchId => read(storage, eventKey(config.id, matchId), {})));
}

export async function tournamentRoomAccess(secret, roomId) {
  if (!secret?.A || !secret?.B || !secret?.O) throw new Error('This match is missing its private links. Open the organizer bracket link.');
  // Existing Firebase brackets predate spectator capabilities. Derive a stable
  // read-only capability without including either team token in the invitation.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`spectator:${roomId}:${secret.A}`));
  const broadcaster = secret.S || Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  return { host: secret.O, teamA: secret.A, teamB: secret.B, broadcaster };
}

export function quickDraftTournamentConfig(tournament, match) {
  const rules = normalizeRules(tournament.rules);
  return {
    ...tournament.rules,
    teamA: match.teamA, teamB: match.teamB, format: `BO${match.bestOf}`,
    seriesRule: rules.seriesRule, squadraBlastCarryBans: rules.squadraBlastCarryBans,
    heroBans: rules.banOrder.length / 2, customBanOrder: rules.banOrder, customPickOrder: rules.pickOrder,
    draftStyle: rules.mode === 'random' ? 'all-random' : 'standard',
    enableCoinFlip: rules.enableCoinFlip, enableDivineDraw: tournament.rules.enableDivineDraw !== false,
    enableProtect: rules.protectHeroes.length > 0, protectList: rules.protectHeroes, globalBanList: rules.globalBans,
    enableTrailer: true, cinematicLockIn: true, timerSeconds: Number(tournament.rules.timerSeconds || 30),
    gameNumber: 1, seriesScoreA: 0, seriesScoreB: 0, previousPicksA: [], previousPicksB: [],
    previousBansA: [], previousBansB: [], quickDraft: true, tournamentRoom: true,
    tournamentId: tournament.id, tournamentMatchId: match.id, tournamentName: tournament.name,
    roomMode: 'bandai-tool',
  };
}

export async function prepareTournamentRoom(tournament, match, secrets, baseUrl, storage = localStorage) {
  if (!match.teamA || !match.teamB || /^Winner /.test(match.teamA) || /^Winner /.test(match.teamB)) throw new Error('Both teams must be decided before opening this room.');
  const roomCode = tournament.roomIds[match.id];
  if (!roomCode) throw new Error('This match has no room ID.');
  const access = await tournamentRoomAccess(secrets.matches[match.id], roomCode);
  const existing = read(storage, `rv_config_${roomCode}`);
  if (existing?.tournamentRoom && (existing.tournamentId !== tournament.id || existing.tournamentMatchId !== match.id)) throw new Error('This room belongs to another match.');
  let config = existing?.tournamentRoom ? existing : {
    ...quickDraftTournamentConfig(tournament, match), roomCode, hostPeerId: `rv-${roomCode.toLowerCase()}`,
  };
  const games = orderedEvents(read(storage, eventKey(tournament.id, match.id), {})).filter(event => event.type === 'game_result');
  if (games.length) config = resumeTournamentConfig(config, games);
  storage.setItem(`rv_config_${roomCode}`, JSON.stringify(config));
  storage.setItem(`rv_secrets_${roomCode}`, JSON.stringify(access));
  // The organizer proof remains in the Host browser, never in the P2P snapshot.
  storage.setItem(`rv_tournament_room_${roomCode}`, JSON.stringify({ tournamentId: tournament.id, matchId: match.id, organizerToken: secrets.O, hostToken: access.host }));
  if (games.at(-1)?.seriesComplete) storage.setItem(`gs-quick-draft-state:${roomCode}`, JSON.stringify({
    status: 'series_complete', seriesComplete: true, gameNumber: config.gameNumber,
    seriesScoreA: config.seriesScoreA, seriesScoreB: config.seriesScoreB,
  }));
  return { roomCode, config, links: p2pDraftLinks(baseUrl, roomCode, config.hostPeerId, access) };
}

export function resumeTournamentConfig(config, games) {
  const latest = games.at(-1);
  const gameNumber = latest.seriesComplete ? Number(latest.game) : Number(latest.game) + 1;
  const phaseTwo = config.seriesRule === 'squadra_blast' && ((gameNumber - 1) % 3) + 1 === 2;
  const history = config.seriesRule === 'squadra_blast' ? (phaseTwo ? [latest] : []) : games;
  const unique = field => [...new Set(history.flatMap(game => game[field] || []))];
  return { ...config, gameNumber, seriesComplete: latest.seriesComplete, seriesScoreA: latest.scoreA, seriesScoreB: latest.scoreB,
    enableCoinFlip: gameNumber > 1 ? false : config.enableCoinFlip,
    sideAssignment: latest.sideAssignment || config.sideAssignment,
    previousPicksA: unique('picksA'), previousPicksB: unique('picksB'),
    previousBansA: phaseTwo && config.squadraBlastCarryBans !== false ? unique('bansA') : [],
    previousBansB: phaseTwo && config.squadraBlastCarryBans !== false ? unique('bansB') : [] };
}

export function restoreTournamentRoom(config, storage = localStorage) {
  const games = orderedEvents(read(storage, eventKey(config.tournamentId, config.tournamentMatchId), {}))
    .filter(event => event.type === 'game_result');
  return games.length ? resumeTournamentConfig(config, games) : config;
}

export function appendLocalTournamentEvent(config, token, event, storage = localStorage) {
  const secrets = read(storage, accessKey(config.id));
  if (!token || secrets?.O !== token) throw new Error('Open the organizer bracket link to change results.');
  if (!config.roomIds[event.matchId]) throw new Error('Unknown tournament match.');
  const key = eventKey(config.id, event.matchId);
  const events = read(storage, key, {});
  const createdAt = Math.max(Date.now(), ...Object.values(events).map(item => Number(item.createdAt || 0) + 1));
  const id = `${createdAt.toString().padStart(16, '0')}-${randomSecret(6)}`;
  events[id] = { ...event, actor: 'O', createdAt };
  storage.setItem(key, JSON.stringify(events));
  return id;
}

export async function saveTournamentDraftGame({ config, roomCode, hostToken, winnerSide, engine, sideAssignment, chosenDivineRules }, storage = localStorage) {
  const context = read(storage, `rv_tournament_room_${roomCode}`);
  if (!context || context.revoked || context.hostToken !== hostToken || context.tournamentId !== config.tournamentId || context.matchId !== config.tournamentMatchId) throw new Error('This Host link does not belong to the tournament match.');
  const tournament = read(storage, configKey(context.tournamentId));
  const key = eventKey(context.tournamentId, context.matchId);
  const events = read(storage, key, {});
  const games = orderedEvents(events).filter(event => event.type === 'game_result');
  const game = Number(config.gameNumber || 1);
  const existing = games.find(event => Number(event.game) === game);
  if (existing) {
    if (existing.side === winnerSide) return { ...existing, alreadyRecorded: true };
    throw new Error(`Game ${game} already has a different result.`);
  }
  if (game !== games.length + 1 || engine.state !== 'complete') throw new Error('Finish the current draft before saving its result.');
  const score = { A: 0, B: 0 };
  games.forEach(event => { score[event.side]++; });
  const bestOf = Number(String(config.format).replace(/\D/g, ''));
  const needed = Math.floor(bestOf / 2) + 1;
  if (!['A','B'].includes(winnerSide) || score.A >= needed || score.B >= needed) throw new Error('This series is already complete or its winner is invalid.');
  score[winnerSide]++;
  const swap = sideAssignment?.A === 'teamB';
  const entry = {
    type: 'game_result', matchId: context.matchId, side: winnerSide, actor: 'O', game,
    scoreA: score.A, scoreB: score.B, seriesComplete: score.A >= needed || score.B >= needed,
    picksA: (swap ? engine.teamB : engine.teamA).picks || [], picksB: (swap ? engine.teamA : engine.teamB).picks || [],
    bansA: (swap ? engine.teamB : engine.teamA).bans || [], bansB: (swap ? engine.teamA : engine.teamB).bans || [],
    sideAssignment, chosenDivineRules: chosenDivineRules || [],
  };
  if (firebaseConfigured() && !config.operationsRoom) {
    await appendProtectedEvent('rooms', roomCode, hostToken, entry);
    if (entry.seriesComplete) await appendProtectedEvent('tournaments', context.tournamentId, context.organizerToken, {
      type: 'winner', matchId: context.matchId, side: score.A > score.B ? 'A' : 'B', scoreA: score.A, scoreB: score.B, actor: 'O',
    });
  }
  appendLocalTournamentEvent(tournament, context.organizerToken, entry, storage);
  return entry;
}

export async function createTournamentRecord(config, secrets, storage = localStorage) {
  if (firebaseConfigured()) {
    const writes = {
      [`tournamentConfigs/${config.id}`]: config,
      [`tournamentSecrets/${config.id}`]: secrets,
      [`tournamentLinks/${config.id}/${secrets.O}`]: secrets.matches,
    };
    for (const [matchId, roomId] of Object.entries(config.roomIds)) {
      const tokens = secrets.matches[matchId];
      writes[`roomConfigs/${roomId}`] = { id: roomId, type: 'tournament', tournamentId: config.id, matchId, rules: config.rules, createdAt: config.createdAt };
      writes[`roomSecrets/${roomId}`] = tokens;
      for (const role of ['A','B','O']) writes[`roomAccess/${roomId}/${tokens[role]}`] = role;
    }
    await writeMany(writes);
  }
  saveLocalTournament(config, secrets, storage);
}

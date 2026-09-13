import { HEROES } from './heroes.js';

export const DEFAULT_BAN_ORDER = ['B', 'A', 'A', 'B'];
export const DEFAULT_PICK_ORDER = ['A', 'B', 'B', 'A', 'B', 'A', 'A', 'B'];
export const BEST_OF = [1, 3, 5, 7];

export function randomSecret(bytes = 24) {
  const values = new Uint8Array(bytes);
  crypto.getRandomValues(values);
  return Array.from(values, value => value.toString(16).padStart(2, '0')).join('');
}

export function randomCode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, value => alphabet[value % alphabet.length]).join('');
}

export function parseOrder(value, fallback) {
  const sides = String(value || '').toUpperCase().match(/[AB]/g) || [];
  return sides.length ? sides : [...fallback];
}

export function normalizeRules(input = {}) {
  const bestOf = BEST_OF.includes(Number(input.bestOf)) ? Number(input.bestOf) : 3;
  return {
    bestOf,
    mode: input.mode === 'random' ? 'random' : 'draft',
    banOrder: parseOrder(input.banOrder, DEFAULT_BAN_ORDER),
    pickOrder: parseOrder(input.pickOrder, DEFAULT_PICK_ORDER),
  };
}

export function draftSequence(rules) {
  const normalized = normalizeRules(rules);
  return [
    ...normalized.banOrder.map(side => ({ type: 'ban', side })),
    ...normalized.pickOrder.map(side => ({ type: 'pick', side })),
  ];
}

export function orderedEvents(events) {
  return Object.entries(events || {}).sort(([a], [b]) => a.localeCompare(b)).map(([id, event]) => ({ id, ...event }));
}

export function seriesScore(config, events) {
  const wins = { A: 0, B: 0 };
  const needed = Math.floor(normalizeRules(config.rules).bestOf / 2) + 1;
  for (const event of orderedEvents(events)) {
    if (event.type !== 'game_result' || !['A', 'B'].includes(event.side) || wins.A >= needed || wins.B >= needed) continue;
    const expectedGame = wins.A + wins.B + 1;
    if (Number(event.game) !== expectedGame) continue;
    wins[event.side] += 1;
  }
  return { ...wins, needed, game: wins.A + wins.B + 1, complete: wins.A >= needed || wins.B >= needed, winner: wins.A >= needed ? 'A' : wins.B >= needed ? 'B' : null };
}

export function deriveDraft(config, events) {
  const score = seriesScore(config, events);
  const game = Math.min(score.game, normalizeRules(config.rules).bestOf);
  const sequence = draftSequence(config.rules);
  const bans = { A: [], B: [] };
  const picks = { A: [], B: [] };
  const used = new Set();
  let step = 0;
  let random = null;
  for (const event of orderedEvents(events)) {
    if (Number(event.game || 1) !== game) continue;
    if (event.type === 'random' && config.rules.mode === 'random' && !random && event.side === 'A') {
      const all = [...(event.teamA || []), ...(event.teamB || [])];
      if (all.length === 8 && new Set(all).size === 8 && all.every(id => HEROES.some(hero => hero.id === id))) random = { A: event.teamA, B: event.teamB };
      continue;
    }
    const expected = sequence[step];
    if (!expected || event.type !== expected.type || event.side !== expected.side || Number(event.step) !== step) continue;
    const hero = HEROES.find(item => item.id === String(event.heroId));
    if (!hero || used.has(hero.id)) continue;
    if (event.type === 'pick' && picks[event.side].filter(id => HEROES.find(item => item.id === id)?.role === hero.role).length >= ({ Damage: 2, Tank: 1, Technical: 1 }[hero.role] || 0)) continue;
    used.add(hero.id);
    (event.type === 'ban' ? bans : picks)[event.side].push(hero.id);
    step += 1;
  }
  return { game, score, sequence, step, current: sequence[step] || null, bans, picks, used, random, complete: Boolean(random) || step >= sequence.length };
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const random = new Uint32Array(1); crypto.getRandomValues(random);
    const j = random[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function randomLineups() {
  const byRole = role => shuffle(HEROES.filter(hero => hero.role === role)).map(hero => hero.id);
  const damage = byRole('Damage'); const tank = byRole('Tank'); const technical = byRole('Technical');
  return { A: [damage[0], damage[1], tank[0], technical[0]], B: [damage[2], damage[3], tank[1], technical[1]] };
}

export function createBracket(teams, bestOf = 3) {
  const clean = teams.map((name, index) => String(name || '').trim() || `Team ${index + 1}`);
  return [
    { id: 'M1', round: 1, slot: 1, teamA: clean[0], teamB: clean[1], bestOf },
    { id: 'M2', round: 1, slot: 2, teamA: clean[2], teamB: clean[3], bestOf },
    { id: 'M3', round: 1, slot: 3, teamA: clean[4], teamB: clean[5], bestOf },
    { id: 'M4', round: 1, slot: 4, teamA: clean[6], teamB: clean[7], bestOf },
    { id: 'M5', round: 2, slot: 1, sourceA: 'M1', sourceB: 'M2', teamA: 'Winner M1', teamB: 'Winner M2', bestOf },
    { id: 'M6', round: 2, slot: 2, sourceA: 'M3', sourceB: 'M4', teamA: 'Winner M3', teamB: 'Winner M4', bestOf },
    { id: 'M7', round: 3, slot: 1, sourceA: 'M5', sourceB: 'M6', teamA: 'Winner M5', teamB: 'Winner M6', bestOf },
  ];
}

export function deriveBracket(config, events) {
  const matches = createBracket(config.teams, normalizeRules(config.rules).bestOf);
  const byId = Object.fromEntries(matches.map(match => [match.id, match]));
  const clearAfter = matchId => {
    for (const match of matches) if (match.sourceA === matchId || match.sourceB === matchId) {
      if (match.sourceA === matchId) match.teamA = `Winner ${matchId}`;
      if (match.sourceB === matchId) match.teamB = `Winner ${matchId}`;
      match.winner = null; match.scoreA = null; match.scoreB = null; clearAfter(match.id);
    }
  };
  for (const event of orderedEvents(events)) {
    if (event.type !== 'winner' || !['A', 'B'].includes(event.side)) continue;
    const match = byId[event.matchId];
    if (!match || !match.teamA || !match.teamB || /^Winner /.test(match.teamA) || /^Winner /.test(match.teamB)) continue;
    match.winner = event.side === 'A' ? match.teamA : match.teamB;
    match.scoreA = event.side === 'A' ? Math.floor(match.bestOf / 2) + 1 : 0;
    match.scoreB = event.side === 'B' ? Math.floor(match.bestOf / 2) + 1 : 0;
    clearAfter(match.id);
    for (const next of matches) {
      if (next.sourceA === match.id) next.teamA = match.winner;
      if (next.sourceB === match.id) next.teamB = match.winner;
    }
  }
  return matches;
}

export function pageUrl(page, params = {}) {
  const url = new URL(page, location.href);
  url.search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== null)).toString();
  return url.href;
}

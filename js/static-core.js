import { HEROES } from './heroes.js';

export const DEFAULT_BAN_ORDER = ['B', 'A', 'A', 'B'];
export const DEFAULT_PICK_ORDER = ['A', 'B', 'B', 'A', 'B', 'A', 'A', 'B'];
export const BEST_OF = [1, 3, 5, 7];
export const SERIES_RULES = Object.freeze(['normal', 'team_no_repeat', 'fearless', 'squadra_blast']);

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

export function generateBanOrder(count) {
  const n = Math.max(0, Math.min(6, Number(count ?? 2)));
  if (n === 0) return [];
  if (n === 1) return ['B', 'A'];
  if (n === 2) return ['B', 'A', 'A', 'B'];
  if (n === 3) return ['B', 'A', 'B', 'A', 'A', 'B'];
  const order = [];
  for (let i = 0; i < n; i++) {
    order.push(i % 2 === 0 ? 'B' : 'A');
  }
  for (let i = 0; i < n; i++) {
    order.push(i % 2 === 0 ? 'A' : 'B');
  }
  return order;
}

export function normalizeRules(input = {}) {
  const bestOf = BEST_OF.includes(Number(input.bestOf)) ? Number(input.bestOf) : 3;
  const seriesRule = SERIES_RULES.includes(input.seriesRule) ? input.seriesRule : 'normal';
  const banCount = input.banCount !== undefined && input.banCount !== '' ? Math.max(0, Math.min(6, Number(input.banCount))) : null;
  const banOrderFallback = banCount !== null ? generateBanOrder(banCount) : DEFAULT_BAN_ORDER;
  const parseList = val => Array.isArray(val) ? val.map(String) : String(val || '').split(',').map(s => s.trim()).filter(Boolean);
  return {
    bestOf,
    mode: input.mode === 'random' ? 'random' : 'draft',
    seriesRule,
    enableCoinFlip: input.enableCoinFlip === true || input.enableCoinFlip === 'on' || input.enableCoinFlip === 'true',
    squadraBlastCarryBans: input.squadraBlastCarryBans !== false && input.squadraBlastCarryBans !== 'false',
    banOrder: input.banOrder ? parseOrder(input.banOrder, banOrderFallback) : banOrderFallback,
    pickOrder: parseOrder(input.pickOrder, DEFAULT_PICK_ORDER),
    protectHeroes: parseList(input.protectHeroes),
    globalBans: parseList(input.globalBans),
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
  const rules = normalizeRules(config.rules);
  const ordered = orderedEvents(events);
  const score = seriesScore(config, events);
  const game = Math.min(score.game, rules.bestOf);
  const sequence = draftSequence(rules);
  const bans = { A: [], B: [] };
  const picks = { A: [], B: [] };
  const used = new Set();
  const previousPicks = { A: new Set(), B: new Set() };
  const previousBans = new Set();
  const previousGames = new Map();
  for (const event of ordered) {
    const eventGame = Number(event.game || 1);
    if (eventGame >= game || !['ban', 'pick'].includes(event.type) || !['A', 'B'].includes(event.side)) continue;
    const bucket = previousGames.get(eventGame) || { A: new Set(), B: new Set(), bans: new Set() };
    if (event.type === 'pick') bucket[event.side].add(String(event.heroId));
    else bucket.bans.add(String(event.heroId));
    previousGames.set(eventGame, bucket);
  }
  for (const bucket of previousGames.values()) {
    for (const side of ['A', 'B']) for (const id of bucket[side]) previousPicks[side].add(id);
    for (const id of bucket.bans) previousBans.add(id);
  }
  const locked = { A: new Set(), B: new Set() };
  for (const id of (rules.globalBans || [])) { locked.A.add(id); locked.B.add(id); }
  const protectedHeroes = new Set(rules.protectHeroes || []);
  if (rules.seriesRule === 'team_no_repeat') {
    for (const side of ['A', 'B']) for (const id of previousPicks[side]) locked[side].add(id);
  } else if (rules.seriesRule === 'fearless') {
    for (const id of [...previousPicks.A, ...previousPicks.B]) { locked.A.add(id); locked.B.add(id); }
  } else if (rules.seriesRule === 'squadra_blast' && ((game - 1) % 3) + 1 === 2) {
    const prior = previousGames.get(game - 1) || { A: new Set(), B: new Set(), bans: new Set() };
    for (const side of ['A', 'B']) for (const id of prior[side]) locked[side].add(id);
    if (rules.squadraBlastCarryBans) for (const id of prior.bans) { locked.A.add(id); locked.B.add(id); }
  }
  const presence = { A: false, B: false };
  let started = false;
  for (const event of ordered) {
    if (event.type === 'presence' && ['A', 'B'].includes(event.side)) presence[event.side] = true;
    if (event.type === 'start' || ['ban', 'pick', 'random', 'coin_flip'].includes(event.type)) started = true;
  }
  const coin = (rules.enableCoinFlip && game <= 1)
    ? ordered.find(event => event.type === 'coin_flip' && Number(event.game || 1) === game && ['heads', 'tails'].includes(event.result) && ['A', 'B'].includes(event.winner)) || null
    : null;
  const preDraftComplete = started && (!rules.enableCoinFlip || game > 1 || Boolean(coin));
  let step = 0;
  let random = null;
  for (const event of ordered) {
    if (Number(event.game || 1) !== game) continue;
    if (event.type === 'random' && rules.mode === 'random' && preDraftComplete && !random && (event.side === 'A' || event.actor === 'O')) {
      const all = [...(event.teamA || []), ...(event.teamB || [])];
      const respectsLocks = (event.teamA || []).every(id => !locked.A.has(id)) && (event.teamB || []).every(id => !locked.B.has(id));
      if (all.length === 8 && new Set(all).size === 8 && respectsLocks && all.every(id => HEROES.some(hero => hero.id === id))) random = { A: event.teamA, B: event.teamB };
      continue;
    }
    const expected = sequence[step];
    if (!expected || event.type !== expected.type || event.side !== expected.side || Number(event.step) !== step) continue;
    const hero = HEROES.find(item => item.id === String(event.heroId));
    if (!preDraftComplete || !hero || used.has(hero.id) || locked[event.side].has(hero.id)) continue;
    if (event.type === 'ban' && protectedHeroes.has(hero.id)) continue;
    if (event.type === 'pick' && picks[event.side].filter(id => HEROES.find(item => item.id === id)?.role === hero.role).length >= ({ Damage: 2, Tank: 1, Technical: 1 }[hero.role] || 0)) continue;
    used.add(hero.id);
    (event.type === 'ban' ? bans : picks)[event.side].push(hero.id);
    step += 1;
  }
  const unavailableFor = {
    A: new Set([...used, ...locked.A]),
    B: new Set([...used, ...locked.B]),
  };
  return {
    game, score, sequence, step,
    current: preDraftComplete ? sequence[step] || null : null,
    bans, picks, used, locked, unavailableFor, previousPicks, previousBans,
    random, coin, preDraftComplete, rules, presence, started, readyToStart: presence.A && presence.B,
    protectedHeroes, globalBans: rules.globalBans,
    complete: preDraftComplete && (Boolean(random) || step >= sequence.length),
  };
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

export function randomLineups(unavailableFor = { A: new Set(), B: new Set() }) {
  const result = { A: [], B: [] };
  const chosen = new Set();
  for (const side of ['A', 'B']) {
    for (const [role, count] of [['Damage', 2], ['Tank', 1], ['Technical', 1]]) {
      const blocked = unavailableFor[side] || new Set();
      const pool = shuffle(HEROES.filter(hero => hero.role === role && !blocked.has(hero.id) && !chosen.has(hero.id)));
      if (pool.length < count) throw new Error(`Not enough ${role} heroes remain for ${side}.`);
      for (const hero of pool.slice(0, count)) { result[side].push(hero.id); chosen.add(hero.id); }
    }
  }
  return result;
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

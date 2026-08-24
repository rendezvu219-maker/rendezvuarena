// Draft Engine - 4v4 State Management
import { HEROES, generateDraftSequence } from './heroes.js';

const MIRROR_PICK_MODES = new Set([
  'none',
  'tank',
  'technical',
  'damage',
  'tank-technical',
  'all',
]);

const FIXED_ROLE_LIMITS = Object.freeze({
  Damage: 2,
  Tank: 1,
  Technical: 1,
});

const SERIES_RULES = new Set(['normal', 'team_no_repeat', 'fearless', 'squadra_blast']);

export function squadraBlastPhase(gameNumber = 1) {
  const normalized = Math.max(1, Math.floor(Number(gameNumber) || 1));
  return ((normalized - 1) % 3) + 1;
}

export function seriesHeroBanCount(seriesRule, gameNumber, configuredCount = 2) {
  const count = Math.min(4, Math.max(0, Math.floor(Number(configuredCount ?? 2))));
  if (seriesRule === 'squadra_blast') return squadraBlastPhase(gameNumber) === 1 ? count : 0;
  return count;
}

export function shouldRestartDraftFlowOnAuthorityGain({
  wasAuthority = false,
  isAuthority = false,
  engineState = 'waiting',
  initialFlowStarted = false,
  missingEntrants = 0,
} = {}) {
  return !wasAuthority
    && isAuthority
    && engineState === 'waiting'
    && initialFlowStarted
    && Number(missingEntrants) === 0;
}

export function draftActionPresentation(action = null) {
  const type = String(action?.type || 'pick');
  const isBan = type === 'ban' || type === 'divine-ban';
  return {
    phaseKey: type === 'ban' ? 'banPhase' : type === 'divine-ban' ? 'divineBan' : 'pickPhase',
    buttonKey: isBan ? 'ban' : 'lockIn',
    isBan,
  };
}

function normalizeMirrorPickMode(config = {}) {
  if (MIRROR_PICK_MODES.has(config.mirrorPickMode)) return config.mirrorPickMode;

  // Backward compatibility for settings saved by v0.6.4 and older.
  if (config.duplicateMode === 'mirror' || config.duplicateMode === 'unlimited' || config.sameHeroAllowed === true) {
    return 'all';
  }
  return 'none';
}

function mirrorModeAllowsRole(mode, role) {
  if (mode === 'all') return true;
  if (mode === 'tank-technical') return role === 'Tank' || role === 'Technical';
  if (mode === 'tank') return role === 'Tank';
  if (mode === 'technical') return role === 'Technical';
  if (mode === 'damage') return role === 'Damage';
  return false;
}

function normalizedRandom(rng = Math.random) {
  const value = Number(rng());
  if (!Number.isFinite(value)) return Math.random();
  return Math.min(0.9999999999999999, Math.max(0, value));
}

function shuffleWithRng(items, rng = Math.random) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(normalizedRandom(rng) * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function orderedRandomPool(pool, avoidHeroIds, rng = Math.random) {
  const fresh = [];
  const recent = [];
  pool.forEach(hero => (avoidHeroIds.has(hero.id) ? recent : fresh).push(hero));
  return [...shuffleWithRng(fresh, rng), ...shuffleWithRng(recent, rng)];
}

function combinationsOf(items, count, startIndex = 0, current = [], output = []) {
  if (current.length === count) {
    output.push([...current]);
    return output;
  }
  const remainingNeeded = count - current.length;
  for (let index = startIndex; index <= items.length - remainingNeeded; index++) {
    current.push(items[index]);
    combinationsOf(items, count, index + 1, current, output);
    current.pop();
  }
  return output;
}

export class DraftEngine {
  constructor(config = {}) {
    const picksPerTeam = config.picksPerTeam ?? 4;
    const mirrorPickMode = normalizeMirrorPickMode(config);
    const seriesRule = SERIES_RULES.has(config.seriesRule) ? config.seriesRule : 'normal';
    const gameNumber = Math.max(1, Number(config.gameNumber || 1));
    const blastHistoryActive = seriesRule === 'squadra_blast' && squadraBlastPhase(gameNumber) === 2;
    const squadraBlastCarryBans = config.squadraBlastCarryBans !== false;

    this.config = {
      teamA: config.teamA || 'TEAM A',
      teamB: config.teamB || 'TEAM B',
      heroBans: seriesHeroBanCount(seriesRule, gameNumber, config.heroBans),
      divineBans: config.divineBans ?? 0,
      picksPerTeam,
      timerSeconds: Math.min(90, Math.max(30, Math.floor(Number(config.timerSeconds ?? 30)))),
      timerAuthority: config.timerAuthority !== false,
      seriesRule,
      gameNumber,
      squadraBlastCarryBans,
      previousPicksA: Array.isArray(config.previousPicksA) && (seriesRule !== 'squadra_blast' || blastHistoryActive) ? [...new Set(config.previousPicksA)] : [],
      previousPicksB: Array.isArray(config.previousPicksB) && (seriesRule !== 'squadra_blast' || blastHistoryActive) ? [...new Set(config.previousPicksB)] : [],
      previousBansA: Array.isArray(config.previousBansA) && blastHistoryActive && squadraBlastCarryBans ? [...new Set(config.previousBansA)] : [],
      previousBansB: Array.isArray(config.previousBansB) && blastHistoryActive && squadraBlastCarryBans ? [...new Set(config.previousBansB)] : [],
      protectList: Array.isArray(config.protectList) ? [...new Set(config.protectList)] : [],
      globalBanList: Array.isArray(config.globalBanList) ? [...new Set(config.globalBanList)] : [],
      mirrorPickMode,
      roleLimits: { ...FIXED_ROLE_LIMITS },
    };

    this.teamA = this.makeTeam(this.config.teamA);
    this.teamB = this.makeTeam(this.config.teamB);
    this.sequence = generateDraftSequence(
      this.config.heroBans,
      this.config.divineBans,
      this.config.picksPerTeam
    );

    this.currentStep = 0;
    this.timer = this.config.timerSeconds;
    this.timerRemaining = this.timer;
    this.timerInterval = null;
    this.state = 'waiting';
    this.selectedHero = null;
    this.listeners = {};
    this.heroes = HEROES.map(hero => ({ ...hero, status: 'available' }));
    this.seriesPickedByTeam = {
      A: new Set(this.config.previousPicksA),
      B: new Set(this.config.previousPicksB),
    };
    this.seriesPickedAll = new Set([...this.seriesPickedByTeam.A, ...this.seriesPickedByTeam.B]);
    this.protectedHeroes = new Set(this.config.protectList);
    this.globalBannedHeroes = new Set(this.config.globalBanList);
    this.blastBannedHeroes = new Set([
      ...this.config.previousBansA,
      ...this.config.previousBansB,
    ]);
    if (this.config.seriesRule === 'squadra_blast' && this.blastBannedHeroes.size) {
      this.teamA.bans = [...this.config.previousBansA];
      this.teamB.bans = [...this.config.previousBansB];
      this.heroes.forEach(hero => {
        if (this.blastBannedHeroes.has(hero.id)) hero.status = 'banned';
      });
    }
  }

  makeTeam(name) {
    return {
      name,
      bans: [],
      divineBans: [],
      picks: [],
      roleCounts: { Damage: 0, Tank: 0, Technical: 0 },
    };
  }

  on(event, callback) {
    (this.listeners[event] = this.listeners[event] || []).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(item => item !== callback);
  }

  emit(event, data) {
    (this.listeners[event] || []).forEach(callback => callback(data));
  }

  get currentAction() {
    return this.sequence[this.currentStep] || null;
  }

  get currentTeam() {
    if (!this.currentAction) return null;
    return this.currentAction.team === 'A' ? this.teamA : this.teamB;
  }

  get phase() {
    return this.currentAction?.type || 'complete';
  }

  picksForTeam(teamKey) {
    return teamKey === 'B' ? this.teamB.picks : this.teamA.picks;
  }

  pickCounts(heroId) {
    return {
      A: this.teamA.picks.filter(id => id === heroId).length,
      B: this.teamB.picks.filter(id => id === heroId).length,
    };
  }

  getHeroUnavailableReason(heroId, action = this.currentAction) {
    const hero = this.heroes.find(item => item.id === heroId);
    if (!hero) return { code: 'missing', label: 'Unavailable' };

    if (this.blastBannedHeroes.has(heroId)) {
      return { code: 'blast_ban', label: 'blast_ban' };
    }

    if (this.globalBannedHeroes.has(heroId)) {
      return { code: 'global_ban', label: 'Global Ban — unavailable to both teams' };
    }

    if (action?.type === 'ban' && this.protectedHeroes.has(heroId)) {
      return { code: 'protected_hero', label: 'Protected — cannot be banned' };
    }

    if (hero.status === 'banned') {
      return { code: 'current_game_ban', label: 'Banned — current game' };
    }

    const counts = this.pickCounts(heroId);
    const pickedByEither = counts.A > 0 || counts.B > 0;

    // During the second ban phase, a team may only target roles the opponent
    // still needs to complete. Example: when Team A already has its one
    // Technical hero, Team B can no longer ban other Technical heroes.
    if (action?.type === 'ban') {
      const targetTeam = action.team === 'A' ? this.teamB : this.teamA;
      const roleLimit = Number(this.config.roleLimits[hero.role] ?? this.config.picksPerTeam);
      if (targetTeam.roleCounts[hero.role] >= roleLimit) {
        return {
          code: 'target_role_complete',
          label: `Opponent completed ${hero.role} — this role can no longer be banned`,
        };
      }
    }

    // A hero that has already been picked cannot be banned later in the same game.
    if ((action?.type === 'ban' || action?.type === 'divine-ban') && pickedByEither) {
      return { code: 'current_game_pick', label: 'Already picked — cannot be banned' };
    }

    if (action?.type === 'pick') {
      const teamKey = action.team === 'B' ? 'B' : 'A';
      const opponentKey = teamKey === 'A' ? 'B' : 'A';

      // Mirror Pick only applies between teams. A team can never select the same hero twice.
      if (counts[teamKey] > 0) {
        return { code: 'same_team_duplicate', label: 'Your team already selected this hero' };
      }

      if (counts[opponentKey] > 0 && !mirrorModeAllowsRole(this.config.mirrorPickMode, hero.role)) {
        return {
          code: 'mirror_not_allowed',
          label: `${hero.role} Mirror Pick is disabled`,
        };
      }
    }

    // Preserve compatibility with snapshots that stored a generic unavailable state.
    if (!['available', 'pickedA', 'pickedB', 'pickedBoth'].includes(hero.status)) {
      return { code: 'unavailable', label: 'Unavailable' };
    }

    if (this.config.seriesRule === 'fearless' && this.seriesPickedAll.has(heroId)) {
      return { code: 'fearless_lock', label: 'Series Lock — picked in an earlier game' };
    }

    // Team No Repeat only prevents the same team from PICKING the hero again.
    // A team may still ban its old hero to stop the opponent from selecting it.
    if (['team_no_repeat', 'squadra_blast'].includes(this.config.seriesRule) && action?.type === 'pick') {
      const teamKey = action.team === 'B' ? 'B' : 'A';
      if (this.seriesPickedByTeam[teamKey].has(heroId)) {
        return { code: 'team_lock', label: 'Team Lock — your team picked this hero earlier' };
      }
    }
    return null;
  }

  isHeroAvailable(heroId) {
    return this.getHeroUnavailableReason(heroId) === null;
  }

  getRoleRestrictionReason(heroId, action = this.currentAction) {
    if (!action || action.type !== 'pick') return null;
    const hero = this.heroes.find(item => item.id === heroId);
    if (!hero) return 'Unavailable';
    const team = action.team === 'A' ? this.teamA : this.teamB;
    const limit = Number(this.config.roleLimits[hero.role] ?? this.config.picksPerTeam);
    if (team.roleCounts[hero.role] >= limit) return `${hero.role} limit reached (${limit})`;
    return null;
  }

  canPickRole(heroId) {
    return this.getRoleRestrictionReason(heroId) === null;
  }

  getAllRandomRolePool(teamKey, role) {
    const action = { type: 'pick', team: teamKey === 'B' ? 'B' : 'A' };
    return this.heroes.filter(hero => (
      hero.role === role
      && this.getHeroUnavailableReason(hero.id, action) === null
    ));
  }

  generateAllRandomAssignments({ rng = Math.random, avoidHeroIds = [] } = {}) {
    if (this.teamA.picks.length || this.teamB.picks.length) {
      throw new Error('All Random assignments can only be generated before either team has picked.');
    }

    const avoidSet = new Set(Array.isArray(avoidHeroIds) ? avoidHeroIds : []);
    const assignments = { A: [], B: [] };

    for (const role of Object.keys(FIXED_ROLE_LIMITS)) {
      const required = Number(FIXED_ROLE_LIMITS[role] || 0);
      const poolA = this.getAllRandomRolePool('A', role);
      const poolB = this.getAllRandomRolePool('B', role);
      const mirrorAllowed = mirrorModeAllowsRole(this.config.mirrorPickMode, role);

      if (poolA.length < required || poolB.length < required) {
        throw new Error(`Not enough eligible ${role} heroes to create both random teams.`);
      }

      if (mirrorAllowed) {
        assignments.A.push(...orderedRandomPool(poolA, avoidSet, rng).slice(0, required).map(hero => hero.id));
        assignments.B.push(...orderedRandomPool(poolB, avoidSet, rng).slice(0, required).map(hero => hero.id));
        continue;
      }

      let roleAssignment = null;
      const teamOrders = normalizedRandom(rng) < 0.5
        ? [['A', 'B'], ['B', 'A']]
        : [['B', 'A'], ['A', 'B']];
      const validPlans = [];

      for (const [firstTeam, secondTeam] of teamOrders) {
        const firstPool = firstTeam === 'A' ? poolA : poolB;
        const secondPool = secondTeam === 'A' ? poolA : poolB;
        const firstCombinations = shuffleWithRng(combinationsOf(firstPool, required), rng)
          .sort((left, right) => (
            left.filter(hero => avoidSet.has(hero.id)).length
            - right.filter(hero => avoidSet.has(hero.id)).length
          ));

        for (const firstPicks of firstCombinations) {
          const usedIds = new Set(firstPicks.map(hero => hero.id));
          const secondCandidates = secondPool.filter(hero => !usedIds.has(hero.id));
          if (secondCandidates.length < required) continue;
          const secondPicks = orderedRandomPool(secondCandidates, avoidSet, rng).slice(0, required);
          validPlans.push({
            repeatCount: [...firstPicks, ...secondPicks].filter(hero => avoidSet.has(hero.id)).length,
            picks: {
              [firstTeam]: firstPicks.map(hero => hero.id),
              [secondTeam]: secondPicks.map(hero => hero.id),
            },
          });
        }
      }

      if (validPlans.length) {
        const minimumRepeats = Math.min(...validPlans.map(plan => plan.repeatCount));
        const bestPlans = validPlans.filter(plan => plan.repeatCount === minimumRepeats);
        roleAssignment = bestPlans[Math.floor(normalizedRandom(rng) * bestPlans.length)].picks;
      }

      if (!roleAssignment) {
        throw new Error(`The current bans and series rules leave too few unique ${role} heroes for No-Mirror randomization.`);
      }

      assignments.A.push(...roleAssignment.A);
      assignments.B.push(...roleAssignment.B);
    }

    assignments.A = shuffleWithRng(assignments.A, rng);
    assignments.B = shuffleWithRng(assignments.B, rng);
    return assignments;
  }

  selectHero(heroId) {
    if (this.state !== 'active' || !this.isHeroAvailable(heroId)) return false;

    if (this.currentAction?.type === 'pick' && !this.canPickRole(heroId)) {
      const hero = this.heroes.find(item => item.id === heroId);
      this.emit('roleLimitReached', {
        heroId,
        role: hero?.role,
        reason: this.getRoleRestrictionReason(heroId),
      });
      return false;
    }

    this.selectedHero = heroId;
    this.emit('heroSelected', { heroId, action: this.currentAction });
    return true;
  }

  hoverHero(heroId) {
    if (this.selectedHero !== null) return;
    this.emit('heroHovered', { heroId, team: this.currentAction?.team });
  }

  refreshPickedStatus(heroId) {
    const hero = this.heroes.find(item => item.id === heroId);
    if (!hero || hero.status === 'banned') return;
    const counts = this.pickCounts(heroId);
    if (counts.A > 0 && counts.B > 0) {
      hero.status = 'pickedBoth';
    } else if (counts.A > 0) {
      hero.status = 'pickedA';
    } else if (counts.B > 0) {
      hero.status = 'pickedB';
    } else {
      hero.status = 'available';
    }
  }

  lockIn() {
    if (this.state !== 'active' || !this.selectedHero) return false;

    const action = this.currentAction;
    const hero = this.heroes.find(item => item.id === this.selectedHero);
    if (!action || !hero) return false;

    const team = action.team === 'A' ? this.teamA : this.teamB;

    if (action.type === 'ban') {
      hero.status = 'banned';
      team.bans.push(hero.id);
      this.emit('heroBanned', {
        hero,
        heroId: hero.id,
        team: action.team,
        actionType: 'ban',
        step: this.currentStep,
      });
    } else if (action.type === 'divine-ban') {
      hero.status = 'banned';
      team.divineBans.push(hero.id);
      this.emit('heroBanned', {
        hero,
        heroId: hero.id,
        team: action.team,
        actionType: 'divine-ban',
        step: this.currentStep,
        isDivine: true,
      });
    } else {
      team.picks.push(hero.id);
      team.roleCounts[hero.role]++;
      this.refreshPickedStatus(hero.id);
      this.emit('heroPicked', {
        hero,
        heroId: hero.id,
        team: action.team,
        actionType: 'pick',
        step: this.currentStep,
        pickNumber: team.picks.length,
        mirrorPickMode: this.config.mirrorPickMode,
      });
    }

    this.selectedHero = null;
    this.currentStep++;
    this.stopTimer();

    if (this.currentStep >= this.sequence.length) {
      this.state = 'complete';
      this.emit('draftComplete', { teamA: this.teamA, teamB: this.teamB });
    } else {
      this.emit('nextTurn', { action: this.currentAction, step: this.currentStep });
      this.startTimer();
    }
    return true;
  }

  applyLockedHero(heroId) {
    if (this.state !== 'active') return false;
    if (this.selectedHero !== heroId && !this.selectHero(heroId)) return false;
    return this.lockIn();
  }

  autoLock() {
    if (this.selectedHero) return this.lockIn();

    const action = this.currentAction;
    const available = this.heroes.filter(hero => {
      if (!this.isHeroAvailable(hero.id)) return false;
      if (action?.type === 'pick') return this.canPickRole(hero.id);
      return true;
    });

    if (!available.length) return false;
    this.selectedHero = available[Math.floor(Math.random() * available.length)].id;
    return this.lockIn();
  }

  start() {
    if (this.state === 'active') return;
    this.state = 'active';
    this.emit('draftStarted', { action: this.currentAction });
    this.emit('nextTurn', { action: this.currentAction, step: this.currentStep });
    this.startTimer();
  }

  pause() {
    if (this.state !== 'active') return false;
    this.stopTimer();
    this.state = 'paused';
    this.emit('draftPaused', { remaining: this.timerRemaining });
    return true;
  }

  resume() {
    if (this.state !== 'paused') return false;
    this.state = 'active';
    this.emit('draftResumed', { remaining: this.timerRemaining });
    this.startTimer({ reset: false });
    return true;
  }

  startTimer({ reset = true } = {}) {
    this.stopTimer();
    if (reset) this.timerRemaining = this.timer;
    this.emit('timerTick', { remaining: this.timerRemaining });

    if (!this.config.timerAuthority || this.state !== 'active') return;

    this.timerInterval = setInterval(() => {
      this.timerRemaining--;
      this.emit('timerTick', { remaining: this.timerRemaining });
      if (this.timerRemaining <= 0) {
        this.stopTimer();
        this.autoLock();
      }
    }, 1000);
  }

  setRemoteTimer(remaining) {
    const value = Number(remaining);
    if (!Number.isFinite(value)) return;
    this.timerRemaining = Math.max(0, Math.floor(value));
    this.emit('timerTick', { remaining: this.timerRemaining, remote: true });
  }

  stopTimer() {
    if (!this.timerInterval) return;
    clearInterval(this.timerInterval);
    this.timerInterval = null;
  }

  getHero(id) {
    return this.heroes.find(hero => hero.id === id);
  }

  exportState() {
    return {
      version: 4,
      state: this.state,
      currentStep: this.currentStep,
      sequence: structuredClone(this.sequence),
      selectedHero: this.selectedHero,
      timerRemaining: this.timerRemaining,
      teamA: structuredClone(this.teamA),
      teamB: structuredClone(this.teamB),
      heroStatuses: Object.fromEntries(this.heroes.map(hero => [hero.id, hero.status])),
      seriesRule: this.config.seriesRule,
      gameNumber: this.config.gameNumber,
      squadraBlastCarryBans: this.config.squadraBlastCarryBans,
      previousPicksA: [...this.seriesPickedByTeam.A],
      previousPicksB: [...this.seriesPickedByTeam.B],
      previousBansA: [...this.config.previousBansA],
      previousBansB: [...this.config.previousBansB],
      protectList: [...this.protectedHeroes],
      globalBanList: [...this.globalBannedHeroes],
      mirrorPickMode: this.config.mirrorPickMode,
      roleLimits: structuredClone(this.config.roleLimits),
    };
  }

  importState(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return false;

    this.stopTimer();
    this.state = ['waiting', 'active', 'paused', 'complete'].includes(snapshot.state)
      ? snapshot.state
      : 'waiting';
    if (Array.isArray(snapshot.sequence) && snapshot.sequence.length) {
      this.sequence = structuredClone(snapshot.sequence);
    }

    this.currentStep = Math.min(
      Math.max(Number(snapshot.currentStep) || 0, 0),
      this.sequence.length
    );
    this.selectedHero = snapshot.selectedHero || null;
    this.timerRemaining = Number.isFinite(Number(snapshot.timerRemaining))
      ? Number(snapshot.timerRemaining)
      : this.timer;

    if (snapshot.teamA) this.teamA = structuredClone(snapshot.teamA);
    if (snapshot.teamB) this.teamB = structuredClone(snapshot.teamB);

    if (SERIES_RULES.has(snapshot.seriesRule)) this.config.seriesRule = snapshot.seriesRule;
    if (Number.isInteger(Number(snapshot.gameNumber))) this.config.gameNumber = Math.max(1, Number(snapshot.gameNumber));
    if (typeof snapshot.squadraBlastCarryBans === 'boolean') this.config.squadraBlastCarryBans = snapshot.squadraBlastCarryBans;
    if (Array.isArray(snapshot.previousPicksA)) this.seriesPickedByTeam.A = new Set(snapshot.previousPicksA);
    if (Array.isArray(snapshot.previousPicksB)) this.seriesPickedByTeam.B = new Set(snapshot.previousPicksB);
    if (this.config.seriesRule === 'squadra_blast' && squadraBlastPhase(this.config.gameNumber) !== 2) {
      this.seriesPickedByTeam.A.clear();
      this.seriesPickedByTeam.B.clear();
    }
    this.seriesPickedAll = new Set([...this.seriesPickedByTeam.A, ...this.seriesPickedByTeam.B]);
    if (Array.isArray(snapshot.previousBansA)) this.config.previousBansA = [...new Set(snapshot.previousBansA)];
    if (Array.isArray(snapshot.previousBansB)) this.config.previousBansB = [...new Set(snapshot.previousBansB)];
    const blastCarryDisabled = this.config.seriesRule === 'squadra_blast'
      && squadraBlastPhase(this.config.gameNumber) === 2
      && !this.config.squadraBlastCarryBans;
    if (this.config.seriesRule !== 'squadra_blast' || squadraBlastPhase(this.config.gameNumber) !== 2 || blastCarryDisabled) {
      this.config.previousBansA = [];
      this.config.previousBansB = [];
      if (blastCarryDisabled) {
        this.teamA.bans = [];
        this.teamB.bans = [];
      }
    }
    this.blastBannedHeroes = new Set([
      ...(this.config.previousBansA || []),
      ...(this.config.previousBansB || []),
    ]);
    if (Array.isArray(snapshot.protectList)) this.protectedHeroes = new Set(snapshot.protectList);
    if (Array.isArray(snapshot.globalBanList)) this.globalBannedHeroes = new Set(snapshot.globalBanList);
    this.config.mirrorPickMode = normalizeMirrorPickMode(snapshot);
    this.config.roleLimits = { ...FIXED_ROLE_LIMITS };

    const statuses = snapshot.heroStatuses || {};
    this.heroes.forEach(hero => {
      hero.status = statuses[hero.id] || 'available';
      if (blastCarryDisabled && hero.status === 'banned' && !this.globalBannedHeroes.has(hero.id)) hero.status = 'available';
      if (hero.status !== 'banned') this.refreshPickedStatus(hero.id);
    });

    this.emit('stateRestored', { snapshot: this.exportState() });
    return true;
  }

  destroy() {
    this.stopTimer();
    this.listeners = {};
  }
}

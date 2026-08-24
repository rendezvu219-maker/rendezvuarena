import { DraftEngine, draftActionPresentation, shouldRestartDraftFlowOnAuthorityGain, squadraBlastPhase } from './draft.js';
import { HEROES, ROLES, PICKS_PER_TEAM, THEMES, getHeroImg, getHeroImgSp, getHeroImgHover, getHeroFullImg, getHeroTrailerUrls, getHeroTrailerPosterUrls, getHeroSkillIconUrls, applyTheme, roleIconMarkup } from './heroes.js';
import { HEROES_DATA } from './heroes-data.js';
import { DraftRoomSync } from './realtime.js';
import { LocalDraftSync } from './local-draft-sync.js';
import { api, escapeHtml } from './api.js';
import { heroName, roleLabel, localizeHeroDetail, localizeDraftReason, t } from './i18n.js';
import { DIVINE_RULES, buildDivineBanSequence, buildDivinePickBanSequence, drawRandomDivineIndices, entrantForSide, isValidDivineIndex, normalizeSideAssignment, resolveSideAssignment, secureRandomUnit, sideForEntrant } from './pre-draft.js';

export class DraftUI {
  constructor(config) {
    this.config = config;
    this.engine = null;
    this.grid = document.getElementById('hero-grid');
    this.roleFilters = document.getElementById('role-filters');
    this.btnLock = document.getElementById('btn-lock');
    this.timerEl = document.getElementById('draft-timer');
    this.banner = document.getElementById('phase-banner');
    this.previewImg = document.getElementById('preview-hero-img');
    this.previewVideo = document.getElementById('preview-hero-video');
    this.previewPoster = document.getElementById('preview-hero-poster');
    this.previewVideoContainer = document.getElementById('preview-video-container');
    this.previewVideoRequest = 0;
    this.previewName = document.getElementById('preview-hero-name');
    this.previewContainer = document.getElementById('preview-container');
    this.previewContentGrid = document.getElementById('preview-content-grid');
    this.previewPlaceholder = document.getElementById('preview-placeholder');
    this.phaseIndicator = document.getElementById('phase-indicator');
    this.slotsA = document.getElementById('team-a-picks');
    this.bansA = document.getElementById('team-a-bans');
    this.slotsB = document.getElementById('team-b-picks');
    this.bansB = document.getElementById('team-b-bans');
    this.cinematicOverlay = document.getElementById('cinematic-overlay');
    this.cinematicTimeout = null;
    this.seriesControlOverlay = document.getElementById('series-control-overlay');
    this.seriesControlButton = document.getElementById('btn-series-control');
    this.seriesControlStatus = document.getElementById('series-control-status');
    this.chosenDivineRules = [];
    this.sync = config._sync || null;
    this.roomRole = config._roomRole || (config._team === 'A' ? 'teamA' : config._team === 'B' ? 'teamB' : config._team || 'host');
    this.authorityRole = config._draftAuthorityRole || this.sync?.authorityRole || (this.roomRole === 'host' ? 'host' : null);
    this.isAuthoritativeHost = !this.sync
      || (this.sync instanceof LocalDraftSync
        ? this.roomRole === 'host'
        : Boolean(config._isDraftAuthority ?? this.sync?.isAuthority));
    this.isApplyingRemote = false;
    this.initialRoomState = config._roomState || null;
    this.gameRollId = String(
      config.gameRollId
      || this.initialRoomState?.gameRollId
      || globalThis.crypto?.randomUUID?.()
      || `client-roll-${Date.now()}`
    );
    this.preDraftState = this.initialRoomState?.preDraft?.gameRollId === this.gameRollId
      && Number(this.initialRoomState?.preDraft?.gameNumber) === Number(config.gameNumber || 1)
      ? this.initialRoomState.preDraft
      : null;
    this.sideAssignment = normalizeSideAssignment(this.preDraftState?.sideAssignment);
    this.preDraftTimers = new Map();
    this.sideAnimationSignature = '';
    this.preDraftControlsBound = false;
    this.lastStatePublish = 0;
    this.draftPresence = { host: 0, teamA: 0, teamB: 0, referee: 0, broadcaster: 0, ...(config._draftPresence || {}) };
    this.initialDraftFlowStarted = false;
    if (this.cinematicOverlay) {
      this.cinematicOverlay.addEventListener('click', () => {
        if (this.cinematicOverlay.classList.contains('show')) {
          this.cinematicOverlay.classList.remove('show');
          if (this.cinematicTimeout) {
            clearTimeout(this.cinematicTimeout);
            this.cinematicTimeout = null;
          }
        }
      });
    }
    this.currentFilter = 'all';
    if (config.theme) applyTheme(config.theme);
    this.init();
  }

  setPreDraftStage(active, screen = null) {
    const draftView = document.getElementById('draft-view');
    const overlay = document.getElementById('pre-draft-overlay');
    if (!draftView || !overlay) return;

    draftView.classList.toggle('pre-draft-active', Boolean(active));
    overlay.classList.toggle('hidden', !active);
    overlay.setAttribute('aria-hidden', String(!active));

    if (!active) return;
    ['coin-flip-screen', 'divine-draw-screen', 'pre-draft-waiting-screen'].forEach(id => {
      document.getElementById(id)?.classList.toggle('hidden', id !== screen);
    });
    if (screen === 'pre-draft-waiting-screen') this.renderDraftWaitingMessage();
  }

  missingDraftEntrants() {
    if (!(this.sync instanceof DraftRoomSync)) return [];
    if (this.roomRole === 'teamA') return this.draftPresence.teamB > 0 ? [] : [this.entrant('teamB').name];
    if (this.roomRole === 'teamB') return this.draftPresence.teamA > 0 ? [] : [this.entrant('teamA').name];
    return ['teamA', 'teamB'].filter(role => !(this.draftPresence[role] > 0)).map(role => this.entrant(role).name);
  }

  renderDraftWaitingMessage() {
    const missing = this.missingDraftEntrants();
    const team = missing.join(' / ');
    const title = document.getElementById('pre-draft-waiting-title');
    const description = document.getElementById('pre-draft-waiting-description');
    if (title) title.textContent = missing.length ? t('waitingForTeamJoin', { team }) : t('preDraftInProgress');
    if (description) description.textContent = missing.length ? t('waitingForTeamJoinDesc') : t('preDraftDesc');
  }

  beginInitialDraftFlow() {
    if (this.initialDraftFlowStarted) return;
    const missing = this.missingDraftEntrants();
    if (missing.length) {
      this.setPreDraftStage(true, 'pre-draft-waiting-screen');
      return;
    }
    this.initialDraftFlowStarted = true;
    if (this.config.enableCoinFlip || this.config.enableDivineDraw) {
      this.startPreDraft();
    } else if (this.config.draftStyle === 'all-random') {
      if (this.isAuthoritativeHost) {
        this.setPreDraftStage(true);
        setTimeout(() => this.startAllRandomBanPhase(), 600);
      } else {
        this.setPreDraftStage(true, 'pre-draft-waiting-screen');
      }
    } else if (this.isAuthoritativeHost) {
      setTimeout(() => this.startDraftEngine(), 1200);
    } else {
      this.setPreDraftStage(true, 'pre-draft-waiting-screen');
    }
  }

  entrant(teamKey) {
    const key = teamKey === 'teamB' ? 'teamB' : 'teamA';
    return key === 'teamA'
      ? { key, name: this.config.teamA || 'TEAM A', logo: this.config.teamALogoUrl || this.config.teamALogo || '' }
      : { key, name: this.config.teamB || 'TEAM B', logo: this.config.teamBLogoUrl || this.config.teamBLogo || '' };
  }

  teamForSide(side) {
    return this.entrant(entrantForSide(this.sideAssignment, side));
  }

  roleForSide(side) {
    return entrantForSide(this.sideAssignment, side);
  }

  sideForRole(role) {
    if (role === 'teamA' || role === 'teamB') return sideForEntrant(this.sideAssignment, role);
    return null;
  }

  scoreForSide(side) {
    const entrantKey = entrantForSide(this.sideAssignment, side);
    return Math.max(0, Number(entrantKey === 'teamA' ? this.config.seriesScoreA || 0 : this.config.seriesScoreB || 0));
  }

  previousPicksForSide(side) {
    if (this.config.seriesRule === 'squadra_blast' && squadraBlastPhase(this.config.gameNumber) !== 2) return [];
    const entrantKey = entrantForSide(this.sideAssignment, side);
    return entrantKey === 'teamA' ? (this.config.previousPicksA || []) : (this.config.previousPicksB || []);
  }

  previousBansForSide(side) {
    if (this.config.seriesRule !== 'squadra_blast' || squadraBlastPhase(this.config.gameNumber) !== 2) return [];
    if (this.config.squadraBlastCarryBans === false) return [];
    const entrantKey = entrantForSide(this.sideAssignment, side);
    return entrantKey === 'teamA' ? (this.config.previousBansA || []) : (this.config.previousBansB || []);
  }

  initials(name) {
    const parts = String(name || 'TEAM').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'TM';
    return (parts.length === 1 ? parts[0].slice(0, 2) : parts.slice(0, 2).map(part => part[0]).join('')).toUpperCase();
  }

  setTeamName(root, value) {
    if (!root) return;
    const name = String(value || 'TEAM').trim() || 'TEAM';
    const length = [...name].length;
    root.textContent = name;
    root.title = name;
    root.classList.toggle('is-long-team-name', length > 22);
    root.classList.toggle('is-very-long-team-name', length > 38);
  }

  setLogo(root, url, name) {
    if (!root) return;
    const image = root.querySelector('img');
    const fallback = root.querySelector('span');
    if (fallback) fallback.textContent = this.initials(name);
    root.classList.remove('has-logo');
    if (!image) return;
    image.removeAttribute('src');
    image.alt = `${name} logo`;
    if (!url) return;
    image.onload = () => root.classList.add('has-logo');
    image.onerror = () => root.classList.remove('has-logo');
    image.src = url;
  }

  renderEntrantCards() {
    for (const teamKey of ['teamA', 'teamB']) {
      const entrant = this.entrant(teamKey);
      const name = document.getElementById(`pre-draft-name-${teamKey}`);
      this.setTeamName(name, entrant.name);
      this.setLogo(document.getElementById(`pre-draft-logo-${teamKey}`), entrant.logo, entrant.name);
    }
  }

  applySideAssignment(assignment, { revealHeader = true } = {}) {
    const normalized = normalizeSideAssignment(assignment);
    if (!normalized) return false;
    this.sideAssignment = normalized;
    if (this.preDraftState) this.preDraftState.sideAssignment = normalized;

    const blue = this.teamForSide('A');
    const red = this.teamForSide('B');
    if (this.engine) {
      this.engine.config.teamA = blue.name;
      this.engine.config.teamB = red.name;
      this.engine.teamA.name = blue.name;
      this.engine.teamB.name = red.name;
      if (this.engine.state === 'waiting') {
        const previousA = this.previousPicksForSide('A');
        const previousB = this.previousPicksForSide('B');
        this.engine.config.previousPicksA = [...previousA];
        this.engine.config.previousPicksB = [...previousB];
        this.engine.seriesPickedByTeam.A = new Set(previousA);
        this.engine.seriesPickedByTeam.B = new Set(previousB);
        this.engine.seriesPickedAll = new Set([...previousA, ...previousB]);
        const previousBansA = this.previousBansForSide('A');
        const previousBansB = this.previousBansForSide('B');
        this.engine.config.previousBansA = [...previousBansA];
        this.engine.config.previousBansB = [...previousBansB];
        this.engine.teamA.bans = [...previousBansA];
        this.engine.teamB.bans = [...previousBansB];
        this.engine.blastBannedHeroes = new Set([...previousBansA, ...previousBansB]);
        this.engine.heroes.forEach(hero => {
          hero.status = this.engine.blastBannedHeroes.has(hero.id) ? 'banned' : 'available';
        });
      }
    }

    const nameA = document.getElementById('team-a-name');
    const nameB = document.getElementById('team-b-name');
    this.setTeamName(nameA, blue.name);
    this.setTeamName(nameB, red.name);
    this.setLogo(document.getElementById('header-team-a-logo'), blue.logo, blue.name);
    this.setLogo(document.getElementById('header-team-b-logo'), red.logo, red.name);
    document.getElementById('draft-view')?.classList.toggle('side-pending', !revealHeader);
    this.updateSeriesScoreDisplay();
    this.applyAccessMode();
    return true;
  }

  setSidePending(pending) {
    document.getElementById('draft-view')?.classList.toggle('side-pending', Boolean(pending));
  }

  canControlCurrentAction() {
    const action = this.engine?.currentAction;
    if (!action) return false;
    if (!this.sync) return true;
    if (this.roomRole === 'host') return true;
    if (this.roomRole === 'teamA' || this.roomRole === 'teamB') return action.team === this.sideForRole(this.roomRole);
    return false;
  }

  applyAccessMode() {
    document.body.dataset.draftRole = this.roomRole;
    const accessBadge = document.getElementById('draft-access-badge');
    if (accessBadge) {
      const teamASide = this.sideForRole('teamA');
      const teamBSide = this.sideForRole('teamB');
      const sidesResolved = Boolean(normalizeSideAssignment(this.sideAssignment)) || !this.config.enableCoinFlip;
      const pendingTeamALabel = this.config.quickDraft ? 'COIN CALL AVAILABLE' : 'COIN CALL';
      const labels = {
        host: sidesResolved ? 'HOST · BOTH TEAMS' : 'HOST · SIDE SELECTION',
        teamA: `${this.config.teamA || 'TEAM A'} · ${sidesResolved ? `${teamASide === 'B' ? 'RED' : 'BLUE'} CONTROL` : pendingTeamALabel}`,
        teamB: `${this.config.teamB || 'TEAM B'} · ${sidesResolved ? `${teamBSide === 'A' ? 'BLUE' : 'RED'} CONTROL` : this.config.quickDraft ? 'COIN CALL AVAILABLE' : 'SIDE PENDING'}`,
        referee: 'REFEREE · VIEW / PAUSE',
        broadcaster: 'BROADCAST · VIEW ONLY',
        preview: 'VIEW ONLY',
      };
      accessBadge.textContent = labels[this.roomRole] || String(this.roomRole || 'VIEW ONLY').toUpperCase();
      accessBadge.dataset.role = this.roomRole;
    }
    const readOnly = ['broadcaster', 'referee', 'preview'].includes(this.roomRole);
    if (readOnly) {
      this.btnLock.disabled = true;
      this.btnLock.classList.remove('ready');
      this.btnLock.setAttribute('data-i18n', 'viewOnly');
      this.btnLock.textContent = t('viewOnly');
    }
    this.updateDraftWatchPresence();
    this.renderGrid();
  }

  updateDraftWatchPresence() {
    const indicator = document.getElementById('draft-watch-presence');
    if (!indicator) return;
    const watching = Number(this.draftPresence?.broadcaster || 0) > 0;
    indicator.classList.toggle('hidden', !watching);
    indicator.textContent = t('hostWatchingReadOnly');
  }

  requestSelectHero(heroId) {
    if (!this.canControlCurrentAction()) return false;

    // The selecting team applies its preview locally. It is not revealed to
    // opponents or the broadcast until LOCK IN / BAN is confirmed.
    const selected = this.engine.selectHero(heroId);
    if (!selected || !this.sync || this.isAuthoritativeHost) return selected;

    this.sync.sendCommand('select', {
      heroId,
      team: this.engine.currentAction?.team,
      actionType: this.engine.currentAction?.type,
    });
    return true;
  }

  requestLockIn() {
    if (!this.canControlCurrentAction() || !this.engine.selectedHero) return false;

    if (!this.sync || this.isAuthoritativeHost) {
      return this.engine.lockIn();
    }

    // A non-authoritative team waits for the elected Draft authority to confirm the lock.
    return this.sync.sendCommand('lock', {
      heroId: this.engine.selectedHero,
      team: this.engine.currentAction?.team,
      actionType: this.engine.currentAction?.type,
    });
  }

  startDraftEngine() {
    if (this.engine.state === 'active') return;
    this.engine.start();
  }

  setDraftAuthority({ role = null, isAuthority = false } = {}) {
    const wasAuthority = this.isAuthoritativeHost;
    this.authorityRole = role || null;
    this.isAuthoritativeHost = this.sync instanceof LocalDraftSync
      ? this.roomRole === 'host'
      : Boolean(isAuthority);
    document.body.dataset.draftAuthority = this.authorityRole || 'none';
    document.body.dataset.isDraftAuthority = String(this.isAuthoritativeHost);

    if (this.engine) {
      this.engine.config.timerAuthority = this.isAuthoritativeHost;
      if (wasAuthority && !this.isAuthoritativeHost) this.engine.stopTimer();
      if (!wasAuthority && this.isAuthoritativeHost) {
        if (this.engine.state === 'active') this.engine.startTimer({ reset: false });
        if (shouldRestartDraftFlowOnAuthorityGain({
          wasAuthority,
          isAuthority: this.isAuthoritativeHost,
          engineState: this.engine.state,
          initialFlowStarted: this.initialDraftFlowStarted,
          missingEntrants: this.missingDraftEntrants().length,
        })) {
          // During a page transition the replacement socket can join before
          // the old authority disconnects. Its initial waiting flow has
          // already yielded, so explicitly restart Game N after the handoff.
          this.initialDraftFlowStarted = false;
          this.beginInitialDraftFlow();
        }
        this.schedulePreDraftAutomation();
        this.publishRoomState(true);
        this.showRoomNotice('Draft control transferred to this view.');
      }
    }
    this.applyAccessMode();
  }

  bindRealtime() {
    if (!this.sync) return;

    this.sync.on('connection', ({ status, attempt = 0 }) => {
      document.body.dataset.realtimeStatus = status || 'unknown';
      if (status === 'reconnecting') this.showRoomNotice(`Connection lost. Resynchronizing… (attempt ${attempt})`);
      else if (status === 'resynced') this.showRoomNotice('Draft Room reconnected and synchronized with the server.');
      else if (status === 'disconnected') this.showRoomNotice('Realtime connection interrupted. Changes are temporarily disabled.');
    });

    this.sync.on('authority', authority => this.setDraftAuthority(authority));

    this.sync.on('presence', payload => {
      if (payload?.presence && typeof payload.presence === 'object') this.draftPresence = { ...this.draftPresence, ...payload.presence };
      this.updateDraftWatchPresence();
      if (!this.initialDraftFlowStarted) this.beginInitialDraftFlow();
    });

    this.sync.on('resync', ({ messages = [] } = {}) => {
      this.initialRoomMessages = Array.isArray(messages) ? messages : this.initialRoomMessages;
    });

    this.sync.on('command', ({ action, data = {}, fromRole }) => {
      if (!this.isAuthoritativeHost) return;
      if (String(action || '').startsWith('pre-draft:')) {
        this.handlePreDraftCommand(action, data, fromRole);
        return;
      }

      const current = this.engine.currentAction;
      const expectedRole = current ? this.roleForSide(current.team) : null;
      if (['teamA', 'teamB'].includes(fromRole) && fromRole !== expectedRole) return;

      if (action === 'select' && data.heroId) {
        this.engine.selectHero(data.heroId);
      } else if (action === 'lock') {
        if (data.heroId && this.engine.selectedHero !== data.heroId) {
          this.engine.selectHero(data.heroId);
        }
        this.engine.lockIn();
      } else if (action === 'pause') {
        this.engine.pause();
      } else if (action === 'resume') {
        this.engine.resume();
      }
    });

    this.sync.on('event', ({ type, data = {} }) => this.applyRemoteEvent(type, data));

    this.sync.on('state', state => {
      if (!state || typeof state !== 'object') return;

      if (Number.isFinite(Number(state.seriesScoreA))) this.config.seriesScoreA = Number(state.seriesScoreA);
      if (Number.isFinite(Number(state.seriesScoreB))) this.config.seriesScoreB = Number(state.seriesScoreB);
      this.updateSeriesScoreDisplay();

      if (state.seriesComplete) {
        this.showSeriesControl({ seriesComplete: true });
        return;
      }

      if (state.reloadRequired) {
        this.showRoomNotice(`Game ${state.gameNumber} is ready. Loading ${String(state.seriesRule || this.config.seriesRule).replaceAll('_', ' ')} rules…`);
        setTimeout(() => {
          if (state.nextConfig && this.sync instanceof LocalDraftSync) {
            window.location.assign(localDraftUrl(state.nextConfig, this.roomRole));
          } else {
            window.location.reload();
          }
        }, 700);
        return;
      }

      if (state.preDraft && typeof state.preDraft === 'object') {
        this.preDraftState = state.preDraft;
        if (state.preDraft.sideAssignment) this.applySideAssignment(state.preDraft.sideAssignment, { revealHeader: state.preDraft.stage !== 'side-reveal' });
        this.renderPreDraftState();
      }

      if (this.isAuthoritativeHost || !state.engine) return;
      this.isApplyingRemote = true;
      this.engine.importState(state.engine);
      this.chosenDivineRules = Array.isArray(state.chosenDivineRules) ? state.chosenDivineRules : this.chosenDivineRules;
      if (Array.isArray(state.hostBannedHeroIds)) this._allRandomBannedIds = [...state.hostBannedHeroIds];
      this.isApplyingRemote = false;
      this.restoreDraftVisuals();
      this.renderDivineHeader();
      if (this.engine.state === 'complete') this.showSeriesControl();
    });

    this.sync.on('error', error => {
      console.warn(error?.message || error);
      this.showRoomNotice(error?.message || 'Draft room synchronization error.');
    });
  }

  applyRemoteEvent(type, data) {
    if (this.isAuthoritativeHost) return;
    this.isApplyingRemote = true;
    try {
      if (type === 'draft:started') {
        this.setPreDraftStage(false);
        this.startDraftEngine();
      } else if (type === 'hero:locked' || type === 'hero:banned') {
        this.engine.applyLockedHero(data.heroId);
      } else if (type === 'timer:tick') {
        this.engine.setRemoteTimer(data.remaining);
      } else if (type === 'draft:paused') {
        this.engine.pause();
      } else if (type === 'draft:resumed') {
        this.engine.resume();
      } else if (type === 'divine:result') {
        this.chosenDivineRules = Array.isArray(data.rules) ? data.rules : [];
        this.renderDivineHeader();
      } else if (type === 'all-random:bans') {
        this._allRandomBannedIds = Array.isArray(data.heroIds) ? [...data.heroIds] : [];
      } else if (type === 'draft:completed') {
        this.engine.state = 'complete';
        this.engine.stopTimer();
        this.showSeriesControl();
      }
    } finally {
      this.isApplyingRemote = false;
    }
  }

  publishRoomEvent(type, data = {}) {
    if (!this.sync || !this.isAuthoritativeHost || this.isApplyingRemote) return;
    this.sync.publishEvent(type, data);
  }

  publishRoomState(force = false) {
    if (!this.sync || !this.isAuthoritativeHost || this.isApplyingRemote) return;
    const now = Date.now();
    if (!force && now - this.lastStatePublish < 1000) return;
    this.lastStatePublish = now;
    this.sync.publishState({
      status: this.engine.state,
      gameNumber: Number(this.config.gameNumber || 1),
      gameRollId: this.gameRollId,
      engine: this.engine.exportState(),
      chosenDivineRules: this.chosenDivineRules,
      hostBannedHeroIds: this._allRandomBannedIds || [],
      preDraft: this.preDraftState || undefined,
    });
  }

  renderDivineHeader() {
    const headerDivine = document.getElementById('header-divine-rules');
    if (!headerDivine || !this.chosenDivineRules.length) return;
    headerDivine.innerHTML = this.chosenDivineRules.map(rule => `
      <div class="divine-header-circle">
        <img src="divine/${escapeHtml(rule.file)}" alt="${escapeHtml(rule.name)}">
        <div class="divine-header-tooltip">${escapeHtml(rule.name)}</div>
      </div>
    `).join('');
    headerDivine.style.display = 'flex';
  }

  restoreDraftVisuals() {
    this.createSlots();

    const fillPick = (teamId, heroId, index) => {
      const slot = document.getElementById(`slot-pick-${teamId}-${index}`);
      const hero = this.engine.getHero(heroId);
      if (!slot || !hero) return;
      slot.classList.add('filled');
      const image = slot.querySelector('.slot-hero-img');
      const name = slot.querySelector('.slot-hero-name');
      if (image) {
        image.style.backgroundImage = `url(${getHeroImgSp(hero.id)})`;
        image.style.opacity = '1';
      }
      if (name) name.textContent = heroName(hero.id, hero.name);
    };

    const fillBan = (teamId, heroId, index, type = 'ban') => {
      const slot = document.getElementById(`slot-${type}-${teamId}-${index}`);
      const hero = this.engine.getHero(heroId);
      if (!slot || !hero) return;
      slot.classList.add('filled');
      const image = slot.querySelector('.ban-img');
      if (image) {
        image.style.backgroundImage = `url(${getHeroImgSp(hero.id)})`;
        image.style.opacity = '1';
      }
    };

    this.engine.teamA.picks.forEach((id, index) => fillPick('A', id, index));
    this.engine.teamB.picks.forEach((id, index) => fillPick('B', id, index));
    this.engine.teamA.bans.forEach((id, index) => fillBan('A', id, index));
    this.engine.teamB.bans.forEach((id, index) => fillBan('B', id, index));
    this.engine.teamA.divineBans.forEach((id, index) => fillBan('A', id, index, 'divine-ban'));
    this.engine.teamB.divineBans.forEach((id, index) => fillBan('B', id, index, 'divine-ban'));

    this.timerEl.textContent = this.engine.state === 'complete' ? '—' : this.engine.timerRemaining;
    if (['active', 'paused', 'complete'].includes(this.engine.state)) {
      this.setPreDraftStage(false);
    }
    this.updateCurrentActionUi();
    this.updateActiveSlot();
    this.renderGrid();
    this.renderDivineHeader();
    this.applyAccessMode();
  }

  showRoomNotice(message) {
    const notice = document.createElement('div');
    notice.className = 'room-sync-notice';
    notice.textContent = message;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 3500);
  }

  init() {
    const initialBlue = this.teamForSide('A');
    const initialRed = this.teamForSide('B');
    this.engine = new DraftEngine({
      teamA: initialBlue.name,
      teamB: initialRed.name,
      heroBans: this.config.heroBans,
      divineBans: this.config.divineBans || 0,
      picksPerTeam: PICKS_PER_TEAM,
      timerSeconds: this.config.timerSeconds,
      timerAuthority: this.isAuthoritativeHost,
      seriesRule: this.config.seriesRule || 'normal',
      gameNumber: Number(this.config.gameNumber || 1),
      squadraBlastCarryBans: this.config.squadraBlastCarryBans !== false,
      previousPicksA: this.previousPicksForSide('A'),
      previousPicksB: this.previousPicksForSide('B'),
      previousBansA: this.previousBansForSide('A'),
      previousBansB: this.previousBansForSide('B'),
      protectList: this.config.enableProtect
        ? [
            ...(this.config.protectList || []),
            ...(this.config.protectNewest ? HEROES.filter(hero => hero.isNew).map(hero => hero.id) : []),
          ]
        : [],
      globalBanList: this.config.globalBanList || [],
      mirrorPickMode: this.config.mirrorPickMode || ((this.config.duplicateMode === 'mirror' || this.config.duplicateMode === 'unlimited' || this.config.sameHeroAllowed) ? 'all' : 'none'),
    });

    // All-random with host ban phase: mark for later
    if (this.config.draftStyle === 'all-random') {
      this.engine.config.divineBans = 0;
      this._allRandomBannedIds = [
        ...new Set(
          (Array.isArray(this.initialRoomState?.hostBannedHeroIds)
            ? this.initialRoomState.hostBannedHeroIds
            : Array.isArray(this.config.hostBannedHeroIds) ? this.config.hostBannedHeroIds : [])
            .filter(id => HEROES.some(hero => hero.id === id))
        ),
      ];
    }

    if (this.sideAssignment) this.applySideAssignment(this.sideAssignment);
    else {
      this.setSidePending(Boolean(this.config.enableCoinFlip));
      this.setTeamName(document.getElementById('team-a-name'), this.config.enableCoinFlip ? 'SIDE PENDING' : this.engine.config.teamA);
      this.setTeamName(document.getElementById('team-b-name'), this.config.enableCoinFlip ? 'SIDE PENDING' : this.engine.config.teamB);
    }
    document.getElementById('match-stage-text').textContent = `${this.config.format} — ${t('game')} ${Number(this.config.gameNumber || 1)} · ${this.config.seriesRule === 'normal' ? t('normal') : String(this.config.seriesRule || '').replaceAll('_', ' ').toUpperCase()}`;
    this.updateSeriesScoreDisplay();
    this.bindSeriesControl();
    this.bindEvents();
    this.createSlots();
    if (this.engine.teamA.bans.length || this.engine.teamB.bans.length) this.restoreDraftVisuals();
    this.bindRealtime();

    if (this.initialRoomState?.engine) {
      this.isApplyingRemote = true;
      this.engine.importState(this.initialRoomState.engine);
      this.chosenDivineRules = Array.isArray(this.initialRoomState.chosenDivineRules)
        ? this.initialRoomState.chosenDivineRules
        : [];
      this.isApplyingRemote = false;
      this.restoreDraftVisuals();
    } else {
      this.renderGrid();
    }

    // Always wire the chat sidebar
    this.initChatSidebar();
    this.applyAccessMode();
    if (this.initialRoomState?.seriesComplete || this.initialRoomState?.status === 'series_complete') {
      this.showSeriesControl({ seriesComplete: true });
    } else if (this.engine.state === 'complete') {
      this.showSeriesControl();
    }

    // A restored active room must not run the pre-draft flow again.
    if (this.initialRoomState?.engine && this.engine.state !== 'waiting') return;

    this.beginInitialDraftFlow();
  }


  updateCurrentActionUi(action = this.engine?.currentAction, { showBanner = false } = {}) {
    if (!action) return;
    const presentation = draftActionPresentation(action);
    const phaseText = t(presentation.phaseKey);
    if (showBanner) this.showPhaseBanner(phaseText, action.team);
    this.phaseIndicator.setAttribute('data-i18n', presentation.phaseKey);
    this.phaseIndicator.textContent = phaseText;
    this.btnLock.setAttribute('data-i18n', presentation.buttonKey);
    this.btnLock.textContent = t(presentation.buttonKey);
    this.btnLock.style.background = presentation.isBan
      ? 'linear-gradient(135deg, #8b0000, #cc0000)'
      : '';
  }

  bindEvents() {
    this.engine.on('timerTick', ({ remaining, remote }) => {
      this.timerEl.textContent = remaining;
      this.timerEl.className = 'timer';
      if (remaining <= 10) this.timerEl.classList.add('warning');
      if (remaining <= 5) this.timerEl.classList.add('danger');
      if (!remote) {
        this.publishRoomEvent('timer:tick', { remaining });
        if (remaining % 5 === 0) this.publishRoomState();
      }
    });

    this.engine.on('draftStarted', () => {
      this.publishRoomEvent('draft:started', { action: this.engine.currentAction });
      this.publishRoomState(true);
    });

    this.engine.on('nextTurn', ({ action }) => {
      if (!action) return;
      this.updateCurrentActionUi(action, { showBanner: true });
      this.updateActiveSlot();
      this.renderGrid();
      this.btnLock.disabled = true;
      this.btnLock.classList.remove('ready');
      this.clearPreview();
      this.applyAccessMode();
      this.publishRoomState(true);
    });

    this.engine.on('heroSelected', ({ heroId }) => {
      const canLock = this.canControlCurrentAction();
      this.btnLock.disabled = !canLock;
      this.btnLock.classList.toggle('ready', canLock);
      const hero = this.engine.getHero(heroId);
      this.showPreview(hero, { playVideo: true });
      this.updateActiveSlotPreview(hero);
      this.grid.querySelectorAll('.hero-card').forEach(c => c.classList.remove('selected-card'));
      const card = this.grid.querySelector(`[data-hero-id="${heroId}"]`);
      if (card) card.classList.add('selected-card');
    });

    this.engine.on('heroPicked', ({ hero, team }) => {
      if (this.config.cinematicLockIn) {
        this.playCinematicLockIn(hero, team);
      } else {
        this.playLockInAnimation(hero, team, 'pick');
      }
      this.publishRoomEvent('hero:locked', { heroId: hero.id, team, actionType: 'pick' });
      this.publishRoomState(true);
    });

    this.engine.on('heroBanned', ({ hero, team, isDivine }) => {
      this.playLockInAnimation(hero, team, isDivine ? 'divine-ban' : 'ban');
      this.publishRoomEvent('hero:banned', {
        heroId: hero.id,
        team,
        actionType: isDivine ? 'divine-ban' : 'ban',
      });
      this.publishRoomState(true);
    });

    this.engine.on('roleLimitReached', ({ role, reason }) => {
      this.showRoleLimitWarning(role, reason);
    });

    this.engine.on('draftPaused', ({ remaining }) => {
      this.phaseIndicator.setAttribute('data-i18n', 'paused');
      this.phaseIndicator.textContent = t('paused');
      this.publishRoomEvent('draft:paused', { remaining });
      this.publishRoomState(true);
    });

    this.engine.on('draftResumed', ({ remaining }) => {
      this.publishRoomEvent('draft:resumed', { remaining });
      this.publishRoomState(true);
    });

    this.engine.on('draftComplete', () => {
      this.showPhaseBanner(t('draftComplete'), null);
      this.phaseIndicator.setAttribute('data-i18n', 'complete');
      this.phaseIndicator.textContent = t('complete');
      this.timerEl.textContent = '—';
      this.btnLock.disabled = true;
      this.publishRoomEvent('draft:completed', {});
      this.publishRoomState(true);

      // Do not interrupt the draft screen with the winner dialog.
      // Highlight a dedicated action instead; the Host opens it when the game actually ends.
      this.seriesControlOverlay?.classList.add('hidden');
      if (this.seriesControlButton) {
        this.seriesControlButton.textContent = t('gameFinishedSetWinner');
        this.seriesControlButton.classList.remove('hidden');
        this.seriesControlButton.classList.add('needs-attention');
      }
      document.querySelector('.action-bar')?.classList.add('result-ready');
    });

    this.roleFilters.addEventListener('click', (e) => {
      const btn = e.target.closest('.role-btn');
      if (!btn) return;
      document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      this.currentFilter = btn.dataset.role;
      this.renderGrid();
    });

    this.btnLock.addEventListener('click', () => this.requestLockIn());
  }

  createSlots() {
    const makePickSlots = (teamId) => {
      let html = '';
      for (let i = 0; i < PICKS_PER_TEAM; i++) {
        html += `<div class="pick-slot slot" id="slot-pick-${teamId}-${i}">
          <div class="slot-number">${escapeHtml(t('pickNumber', { number: i + 1 }))}</div>
          <div class="slot-hero-img"></div>
          <div class="slot-hero-name"></div>
        </div>`;
      }
      return html;
    };
    const makeBanSlots = (teamId, count, type = 'ban') => {
      let html = '';
      for (let i = 0; i < count; i++) {
        const cls = type === 'divine-ban' ? 'ban-slot divine-ban' : 'ban-slot';
        html += `<div class="${cls} slot" id="slot-${type}-${teamId}-${i}">
          <div class="ban-img"></div>
          <div class="ban-cross">${type === 'divine-ban' ? '✦' : '✕'}</div>
        </div>`;
      }
      return html;
    };
    this.slotsA.innerHTML = makePickSlots('A');
    this.slotsB.innerHTML = makePickSlots('B');
    // Divine Draw bans belong to the separate Divine Draw screen and must not
    // appear as extra hero-ban slots. This keeps 2 hero bans displayed as 2.
    const visibleBanCount = Math.max(
      this.engine.config.heroBans,
      this.engine.teamA.bans.length,
      this.engine.teamB.bans.length,
    );
    this.bansA.innerHTML = makeBanSlots('A', visibleBanCount);
    this.bansB.innerHTML = makeBanSlots('B', visibleBanCount);
  }

  renderGrid() {
    this.grid.innerHTML = '';
    const heroes = this.currentFilter === 'all'
      ? this.engine.heroes
      : this.engine.heroes.filter(h => h.role === this.currentFilter);

    const action = this.engine.currentAction;
    const canInteract = this.canControlCurrentAction();
    heroes.forEach(h => {
      const localizedName = heroName(h.id, h.name);
      const unavailableReason = this.engine.getHeroUnavailableReason(h.id);
      const isAvail = unavailableReason === null;
      const roleData = ROLES[h.role];
      // Enforce the game's fixed 2 Damage / 1 Tank / 1 Technical composition.
      let roleFull = false;
      let roleRestriction = null;
      if (isAvail && action?.type === 'pick') {
        roleRestriction = this.engine.getRoleRestrictionReason(h.id);
        roleFull = Boolean(roleRestriction);
      }
      const pickCounts = this.engine.pickCounts(h.id);
      const totalPickCount = pickCounts.A + pickCounts.B;
      const card = document.createElement('div');
      card.className = `hero-card ${!isAvail ? 'unavailable' : ''} ${roleFull ? 'role-full' : ''} ${!canInteract ? 'view-only-card' : ''} role-${h.role.toLowerCase()}`;
      card.dataset.role = h.role;
      card.dataset.heroId = h.id;

// Giữ hiệu ứng sáng cho nhân vật đang được chọn
if (this.engine.selectedHero === h.id) {
  card.classList.add('selected-card');
}
      card.innerHTML = `
        <div class="card-border" style="--role-color:${roleData.color}">
          <div class="card-inner">
            <div class="card-role-icon" style="--role-color:${roleData.color}">${roleIconMarkup(h.role, 'draft-role-icon')}</div>
            <span class="card-name">${escapeHtml(localizedName)}</span>
            ${h.isNew ? `<span class="card-new">${escapeHtml(t('newHero'))}</span>` : ''}
            ${totalPickCount ? `<span class="hero-pick-count">${pickCounts.A ? `A×${pickCounts.A}` : ''}${pickCounts.A && pickCounts.B ? ' · ' : ''}${pickCounts.B ? `B×${pickCounts.B}` : ''}</span>` : ''}
            ${unavailableReason ? `<span class="hero-unavailable-reason reason-${escapeHtml(unavailableReason.code)}">${escapeHtml(localizeDraftReason(unavailableReason, h.role))}</span>` : ''}
            ${!unavailableReason && roleRestriction ? `<span class="hero-unavailable-reason reason-role_restriction">${escapeHtml((() => { const match = roleRestriction.match(/\((\d+)\)/); return t('roleLimitReached', { role: roleLabel(h.role), limit: match?.[1] || '' }); })())}</span>` : ''}
            <img class="card-img" src="${escapeHtml(getHeroImg(h.id))}" alt="${escapeHtml(localizedName)}"
                 data-hover="${escapeHtml(getHeroImgHover(h.id))}"
                 onerror="this.style.display='none'">
          </div>
        </div>
      `;

      if (isAvail && !roleFull) {
  const img = card.querySelector('.card-img');

  // Rê chuột chỉ thay đổi thông tin khi chưa click chọn nhân vật
  card.addEventListener('mouseenter', () => {
    if (this.engine.selectedHero === null) {
      this.engine.hoverHero(h.id);
      this.showPreview(h, { playVideo: false });
    }

    // Vẫn giữ hiệu ứng ảnh khi hover trên thẻ
    if (img && img.dataset.hover) {
      img.dataset.origSrc = img.src;
      img.src = img.dataset.hover;
    }
  });

  card.addEventListener('mouseleave', () => {
    if (img && img.dataset.origSrc) {
      img.src = img.dataset.origSrc;
    }
  });

  // Only the team whose turn it is (or the host) can select.
  if (canInteract) {
    card.addEventListener('click', () => {
      this.requestSelectHero(h.id);
    });
  }
}
      this.grid.appendChild(card);
    });
  }

  configuredHeroTrailer(heroId) {
    const sources = this.config.heroTrailerUrls || this.config.heroVideos || this.config.trailers || {};
    return typeof sources === 'object' && sources ? String(sources[heroId] || '') : '';
  }

  configuredHeroTrailerPoster(heroId) {
    const sources = this.config.heroTrailerPosterUrls || this.config.heroPosterUrls || this.config.trailerPosters || {};
    return typeof sources === 'object' && sources ? String(sources[heroId] || '') : '';
  }

  stopPreviewVideo() {
    this.previewVideoRequest += 1;
    this.previewContainer?.classList.remove('video-playing');
    this.previewVideoContainer?.classList.remove('playing', 'showing-poster');
    if (this.previewPoster) {
      this.previewPoster.onerror = null;
      this.previewPoster.removeAttribute('src');
    }
    if (!this.previewVideo) return;
    this.previewVideo.pause();
    this.previewVideo.loop = false;
    this.previewVideo.oncanplay = null;
    this.previewVideo.onended = null;
    this.previewVideo.onerror = null;
    this.previewVideo.removeAttribute('src');
    this.previewVideo.load();
  }

  showPreviewPoster(hero, requestId) {
    if (!this.previewPoster || !this.previewVideoContainer || !hero || requestId !== this.previewVideoRequest) {
      this.previewVideoContainer?.classList.remove('playing', 'showing-poster');
      this.previewContainer?.classList.remove('video-playing');
      return;
    }

    const poster = this.previewPoster;
    const container = this.previewVideoContainer;
    const sources = [
      ...getHeroTrailerPosterUrls(hero.id, this.configuredHeroTrailerPoster(hero.id)),
      getHeroFullImg(hero.id),
    ];
    let sourceIndex = 0;

    const useNextPoster = () => {
      if (requestId !== this.previewVideoRequest) return;
      const source = sources[sourceIndex++];
      if (!source) {
        poster.onerror = null;
        container.classList.remove('playing', 'showing-poster');
        this.previewContainer.classList.remove('video-playing');
        return;
      }
      poster.dataset.fullArtFallback = source === getHeroFullImg(hero.id) ? 'true' : 'false';
      poster.src = source;
    };

    poster.onerror = useNextPoster;
    poster.onload = () => {
      if (requestId !== this.previewVideoRequest) return;
      container.classList.remove('playing');
      container.classList.add('showing-poster');
      this.previewContainer.classList.add('video-playing');
    };
    useNextPoster();
  }

  playPreviewVideo(hero) {
    if (!this.previewVideo || !this.previewVideoContainer || !hero) return;
    const requestId = ++this.previewVideoRequest;
    const video = this.previewVideo;
    const container = this.previewVideoContainer;
    const sources = getHeroTrailerUrls(hero.id, this.configuredHeroTrailer(hero.id));
    let sourceIndex = 0;

    this.previewContainer.classList.remove('video-playing');
    container.classList.remove('playing', 'showing-poster');
    if (this.previewPoster) {
      this.previewPoster.onerror = null;
      this.previewPoster.onload = null;
      this.previewPoster.removeAttribute('src');
    }
    video.pause();
    video.loop = false;
    video.removeAttribute('src');
    video.load();

    const showPoster = () => this.showPreviewPoster(hero, requestId);
    const tryNext = () => {
      if (requestId !== this.previewVideoRequest) return;
      const source = sources[sourceIndex++];
      if (!source) {
        showPoster();
        return;
      }
      video.src = source;
      video.load();
    };
    video.onerror = tryNext;
    video.onended = showPoster;
    video.oncanplay = () => {
      if (requestId !== this.previewVideoRequest) return;
      video.oncanplay = null;
      video.currentTime = 0;
      video.play().then(() => {
        if (requestId !== this.previewVideoRequest) return;
        video.onerror = showPoster;
        container.classList.remove('showing-poster');
        container.classList.add('playing');
        this.previewContainer.classList.add('video-playing');
      }).catch(showPoster);
    };
    tryNext();
  }

  showPreview(hero, { playVideo = false } = {}) {
    if (!hero) return;
    const roleData = ROLES[hero.role];
    const sourceHeroData = HEROES_DATA[hero.id] || {};
    const heroData = localizeHeroDetail(hero, sourceHeroData);

    // Keep the official full-body art as an immediate and reliable fallback.
    this.stopPreviewVideo();
    this.previewImg.src = getHeroFullImg(hero.id);
    this.previewImg.style.display = '';
    this.previewContainer.classList.add('active');
    this.previewContainer.style.borderColor = roleData.color;
    if (playVideo) this.playPreviewVideo(hero);

    // Toggle visibility
    if (this.previewPlaceholder) this.previewPlaceholder.style.display = 'none';
    if (this.previewContentGrid) this.previewContentGrid.style.display = 'flex';

    // Hero name
    this.previewName.textContent = heroData.name;

    // Role badge
    const badge = document.getElementById('preview-hero-role-badge');
    if (badge) {
      badge.innerHTML = `${roleIconMarkup(hero.role, 'preview-role-icon')}<span>${escapeHtml(roleLabel(hero.role).toUpperCase())}</span>`;
      badge.style.setProperty('--role-color', roleData.color);
      badge.style.color = '#fff';
    }

    // Difficulty bar
    const diffFill = document.getElementById('preview-difficulty-fill');
    if (diffFill && heroData) {
      diffFill.style.width = heroData.difficulty + '%';
    }

    // Description
    const descEl = document.getElementById('preview-hero-desc');
    if (descEl && heroData) {
      descEl.innerHTML = escapeHtml(heroData.description).replace(/\n/g, '<br>');
    } else if (descEl) {
      descEl.textContent = '';
    }

    // Radar chart
    const radarPath = document.getElementById('radar-stats-path');
    if (radarPath && heroData && heroData.statsPath) {
      radarPath.setAttribute('d', heroData.statsPath);
    }

    // Skills icons from official site
    const skillsContainer = document.getElementById('preview-skills-icons');
    const skillDetailName = document.getElementById('skill-detail-name');
    const skillDetailDesc = document.getElementById('skill-detail-desc');

    if (skillsContainer && heroData && heroData.skills) {
      const typeLabels = {
        passive: 'P',
        rush_attack: 'RA',
        skill: 'S',
        super_attack: 'SA',
        transformation: 'T'
      };
      const typeColors = {
        passive: '#4CAF50',
        rush_attack: '#2196F3',
        skill: '#2196F3',
        super_attack: '#FF9800',
        transformation: '#E91E63'
      };

      skillsContainer.innerHTML = heroData.skills.map((sk, i) => {
        const { primary: pngUrl, fallback: webpUrl } = getHeroSkillIconUrls(hero.id, sk.id);
        const label = typeLabels[sk.type] || 'S';
        return `<div class="skill-icon-btn ${i === 0 ? 'active' : ''}" data-idx="${i}" title="${escapeHtml(sk.name)}">
          <img src="${escapeHtml(pngUrl)}" alt="${escapeHtml(sk.name)}" data-fallback="${escapeHtml(webpUrl)}">
          <span class="skill-icon-label" style="background:${typeColors[sk.type] || '#555'}">${escapeHtml(label)}</span>
        </div>`;
      }).join('');

      skillsContainer.querySelectorAll('.skill-icon-btn img').forEach(image => {
        image.addEventListener('error', () => {
          const fallback = image.dataset.fallback;
          if (fallback && image.src !== new URL(fallback, location.href).href) image.src = fallback;
          else image.hidden = true;
        });
      });

      // Show first skill by default
      if (heroData.skills.length > 0) {
        const first = heroData.skills[0];
        if (skillDetailName) skillDetailName.textContent = first.name;
        if (skillDetailDesc) skillDetailDesc.innerHTML = escapeHtml(first.desc).replace(/\n/g, '<br>');
      }

      // Wire up click on skill icons
      skillsContainer.querySelectorAll('.skill-icon-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          skillsContainer.querySelectorAll('.skill-icon-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const idx = +btn.dataset.idx;
          const sk = heroData.skills[idx];
          if (sk) {
            if (skillDetailName) skillDetailName.textContent = sk.name;
            if (skillDetailDesc) skillDetailDesc.innerHTML = escapeHtml(sk.desc).replace(/\n/g, '<br>');
          }
        });
      });
    }
  }

  clearPreview() {
    this.stopPreviewVideo();
    this.previewName.textContent = t('selectHero');
    this.previewImg.style.display = 'none';
    this.previewContainer.classList.remove('active');
    this.previewContainer.style.borderColor = '';
    if (this.previewContentGrid) this.previewContentGrid.style.display = 'none';
    if (this.previewPlaceholder) this.previewPlaceholder.style.display = '';
  }

  updateActiveSlot() {
    document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
    const action = this.engine.currentAction;
    if (!action) return;
    const prefix = `slot-${action.type}-${action.team}-`;
    const slots = document.querySelectorAll(`[id^="${prefix}"]`);
    for (const s of slots) {
      if (!s.classList.contains('filled')) {
        s.classList.add('active');
        break;
      }
    }
  }

  updateActiveSlotPreview(hero) {
    const activeSlot = document.querySelector('.slot.active');
    if (!activeSlot) return;
    const imgEl = activeSlot.querySelector('.slot-hero-img, .ban-img');
    if (imgEl) {
      imgEl.style.backgroundImage = `url(${getHeroImgSp(hero.id)})`;
      imgEl.style.opacity = '0.5';
    }
  }

  playLockInAnimation(hero, team, type) {
    const activeSlot = document.querySelector('.slot.active');
    if (!activeSlot) return;
    const roleData = ROLES[hero.role];

    activeSlot.classList.remove('active');
    activeSlot.classList.add('filled', 'lock-anim');
    activeSlot.style.setProperty('--fill-color', roleData.color);

    if (type === 'pick') {
      const imgEl = activeSlot.querySelector('.slot-hero-img');
      const nameEl = activeSlot.querySelector('.slot-hero-name');
      if (imgEl) { imgEl.style.backgroundImage = `url(${getHeroImgSp(hero.id)})`; imgEl.style.opacity = '1'; }
      if (nameEl) nameEl.textContent = heroName(hero.id, hero.name);
      // Show role color stripe on filled slot
      activeSlot.style.borderLeftColor = roleData.color;
      activeSlot.style.borderLeftWidth = '3px';
    } else {
      // Ban slot: show only the portrait and ban mark.
      const imgEl = activeSlot.querySelector('.ban-img');
      if (imgEl) { imgEl.style.backgroundImage = `url(${getHeroImgSp(hero.id)})`; imgEl.style.opacity = '1'; }
      const crossEl = activeSlot.querySelector('.ban-cross');
      if (crossEl) crossEl.style.display = 'flex';
    }

    // Optional accessibility setting: global flash and screen shake.
    // It is OFF by default and only runs when enabled in Draft Experience.
    if (this.config.flashAndShake === true) {
      const flash = document.createElement('div');
      flash.className = 'flash-overlay';
      flash.style.background =
        (type === 'ban' || type === 'divine-ban')
          ? '#ff3030'
          : roleData.color;

      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 240);

      // Keep screen shake for bans only, but make it much softer.
      if (type === 'ban' || type === 'divine-ban') {
        document.body.classList.remove('anim-shake');
        void document.body.offsetWidth;
        document.body.classList.add('anim-shake');
        setTimeout(() => document.body.classList.remove('anim-shake'), 200);
      }
    }

    setTimeout(() => activeSlot.classList.remove('lock-anim'), 420);
  }

  playCinematicLockIn(hero, team) {
    this.playLockInAnimation(hero, team, 'pick');
    const overlay = this.cinematicOverlay;
    const teamColor = team === 'A' ? 'var(--team-left-primary)' : 'var(--team-right-secondary)';
    const teamName = team === 'A' ? this.config.teamA : this.config.teamB;
    const roleData = ROLES[hero.role];
    document.getElementById('cinematic-img').src = getHeroFullImg(hero.id);
    document.getElementById('cinematic-name').textContent = heroName(hero.id, hero.name);
    document.getElementById('cinematic-name').style.color = roleData.color;
    document.getElementById('cinematic-team').textContent = teamName;
    document.getElementById('cinematic-team').style.color = teamColor;
    document.getElementById('cinematic-bar-left').style.setProperty('--team-color', teamColor);
    document.getElementById('cinematic-bar-right').style.setProperty('--team-color', teamColor);
    overlay.style.setProperty('--hero-glow', roleData.glow);
    overlay.classList.add('show');
    if (this.cinematicTimeout) clearTimeout(this.cinematicTimeout);
    this.cinematicTimeout = setTimeout(() => {
      overlay.classList.remove('show');
      this.cinematicTimeout = null;
    this.seriesControlOverlay = document.getElementById('series-control-overlay');
    this.seriesControlButton = document.getElementById('btn-series-control');
    this.seriesControlStatus = document.getElementById('series-control-status');
    }, 2000);
  }

  showPhaseBanner(text, team) {
    // This banner contains runtime phase text. A static data-i18n="banPhase"
    // attribute would let the i18n observer overwrite PICK PHASE after bans.
    this.banner.removeAttribute('data-i18n');
    this.banner.textContent = text;
    this.banner.className = 'phase-banner';
    if (team === 'A') this.banner.style.color = 'var(--team-left-primary)';
    else if (team === 'B') this.banner.style.color = 'var(--team-right-secondary)';
    else this.banner.style.color = 'var(--interactive-primary)';
    setTimeout(() => {
      this.banner.classList.add('show');
      setTimeout(() => {
        this.banner.classList.remove('show');
        this.banner.classList.add('hide');
      }, 1500);
    }, 100);
  }

  showRoleLimitWarning(role, reason = '') {
    const roleData = ROLES[role] || { color: 'var(--interactive-primary)' };
    const warn = document.createElement('div');
    warn.style.cssText = `position:fixed;top:20%;left:50%;transform:translateX(-50%);
      padding:12px 30px;background:rgba(0,0,0,0.9);border:2px solid ${roleData.color};
      color:${roleData.color};font-family:var(--font-display);font-size:0.78rem;
      letter-spacing:1.4px;z-index:9999;border-radius:4px;pointer-events:none;
      animation:fadeInUp 0.3s ease forwards;`;
    warn.textContent = String(reason ? localizeDraftReason(reason, role) : t('roleNotAllowed', { role: roleLabel(role) })).toUpperCase();
    document.body.appendChild(warn);
    setTimeout(() => warn.remove(), 2200);
  }

  startPreDraft() {
    this.renderEntrantCards();
    this.bindPreDraftControls();

    if (!this.preDraftState) {
      const defaultAssignment = { A: 'teamA', B: 'teamB' };
      this.preDraftState = this.config.enableCoinFlip
        ? {
            version: 2,
            gameNumber: Number(this.config.gameNumber || 1),
            gameRollId: this.gameRollId,
            stage: 'coin-call',
            coinCaller: null,
            coinChoice: null,
            coinResult: null,
            sideChooser: null,
            sideChoice: null,
            sideAssignment: null,
            divine: null,
          }
        : {
            version: 2,
            gameNumber: Number(this.config.gameNumber || 1),
            gameRollId: this.gameRollId,
            stage: this.config.enableDivineDraw ? 'divine' : 'complete',
            coinCaller: null,
            coinChoice: null,
            coinResult: null,
            sideChooser: null,
            sideChoice: 'A',
            sideAssignment: defaultAssignment,
            divine: null,
          };
      if (this.isAuthoritativeHost) this.publishRoomState(true);
    }

    if (this.preDraftState.sideAssignment) {
      this.applySideAssignment(this.preDraftState.sideAssignment, { revealHeader: this.preDraftState.stage !== 'side-reveal' });
    } else {
      this.setSidePending(Boolean(this.config.enableCoinFlip));
    }

    this.renderPreDraftState();
    if (this.isAuthoritativeHost) this.schedulePreDraftAutomation();
  }

  bindPreDraftControls() {
    if (this.preDraftControlsBound) return;
    this.preDraftControlsBound = true;

    document.getElementById('coin-flip-screen')?.addEventListener('click', event => {
      const faceButton = event.target.closest('[data-coin-face]');
      if (faceButton && !faceButton.disabled) {
        this.requestPreDraftCommand('pre-draft:coin-call', {
          face: faceButton.dataset.coinFace,
          teamKey: faceButton.dataset.teamKey,
        });
        return;
      }
      const sideButton = event.target.closest('[data-side-choice]');
      if (sideButton && !sideButton.disabled) {
        this.requestPreDraftCommand('pre-draft:side-select', {
          side: sideButton.dataset.sideChoice,
          teamKey: this.preDraftState?.sideChooser || null,
        });
      }
    });

    document.getElementById('btn-flip-coin')?.addEventListener('click', event => {
      if (event.currentTarget.disabled) return;
      this.requestPreDraftCommand('pre-draft:coin-flip', {
        teamKey: this.preDraftState?.coinCaller || null,
      });
    });

    document.getElementById('divine-cards-container')?.addEventListener('click', event => {
      const card = event.target.closest('[data-divine-index]');
      if (!card || card.getAttribute('aria-disabled') === 'true') return;
      const step = this.preDraftState?.divine?.sequence?.[this.preDraftState?.divine?.stepIndex || 0];
      this.requestPreDraftCommand('pre-draft:divine-select', {
        index: Number(card.dataset.divineIndex),
        teamSide: step?.team || null,
      });
    });

    document.getElementById('btn-start-pickban')?.addEventListener('click', event => {
      if (event.currentTarget.disabled) return;
      this.requestPreDraftCommand('pre-draft:complete', {});
    });
  }

  requestPreDraftCommand(action, data = {}) {
    if (this.sync) return this.sync.sendCommand(action, data);
    if (!this.isAuthoritativeHost) return false;
    this.handlePreDraftCommand(action, data, 'host');
    return true;
  }

  actorTeamKey(fromRole, data = {}) {
    if (fromRole === 'teamA' || fromRole === 'teamB') return fromRole;
    return data.teamKey === 'teamB' ? 'teamB' : data.teamKey === 'teamA' ? 'teamA' : null;
  }

  actorSide(fromRole, data = {}) {
    if (fromRole === 'teamA' || fromRole === 'teamB') return this.sideForRole(fromRole);
    return data.teamSide === 'B' ? 'B' : data.teamSide === 'A' ? 'A' : null;
  }

  commitPreDraftState() {
    this.publishRoomState(true);
    this.renderPreDraftState();
    this.schedulePreDraftAutomation();
  }

  handlePreDraftCommand(action, data = {}, fromRole = 'host') {
    if (!this.isAuthoritativeHost || !this.preDraftState) return;
    const state = this.preDraftState;

    if (action === 'pre-draft:coin-call') {
      if (state.stage !== 'coin-call' || state.coinCaller) return;
      const teamKey = this.actorTeamKey(fromRole, data);
      const face = String(data.face || '').toUpperCase();
      if (!teamKey || !['HEADS', 'TAILS'].includes(face)) return;
      if (!this.config.quickDraft && teamKey !== 'teamA') return;
      state.coinCaller = teamKey;
      state.coinChoice = face;
      state.stage = 'coin-ready';
      this.commitPreDraftState();
      return;
    }

    if (action === 'pre-draft:coin-flip') {
      if (state.stage !== 'coin-ready' || !state.coinCaller || !state.coinChoice) return;
      const actor = this.actorTeamKey(fromRole, data);
      if (fromRole !== 'host' && actor !== state.coinCaller) return;
      state.stage = 'coin-flipping';
      state.coinResult = null;
      state.sideChooser = null;
      this.commitPreDraftState();
      return;
    }

    if (action === 'pre-draft:side-select') {
      if (state.stage !== 'side-select' || !state.sideChooser) return;
      const actor = this.actorTeamKey(fromRole, data);
      if (fromRole !== 'host' && actor !== state.sideChooser) return;
      const side = data.side === 'B' ? 'B' : data.side === 'A' ? 'A' : null;
      if (!side) return;
      state.sideChoice = side;
      state.sideAssignment = resolveSideAssignment(state.sideChooser, side);
      state.stage = 'side-reveal';
      state.transitionToken = globalThis.crypto?.randomUUID?.()
        || `${Date.now()}-${Math.floor(secureRandomUnit() * 0x100000000).toString(36)}`;
      this.applySideAssignment(state.sideAssignment, { revealHeader: false });
      this.commitPreDraftState();
      return;
    }

    if (action === 'pre-draft:divine-select') {
      this.handleDivineSelection(data, fromRole);
      return;
    }

    if (action === 'pre-draft:complete') {
      if (!['host', 'teamA', 'teamB'].includes(fromRole)
        || state.stage !== 'divine'
        || state.divine?.phase !== 'complete') return;
      this.finishPreDraft();
    }
  }

  scheduleTimer(key, delay, callback) {
    if (this.preDraftTimers.has(key)) return;
    const timer = setTimeout(() => {
      this.preDraftTimers.delete(key);
      callback();
    }, delay);
    this.preDraftTimers.set(key, timer);
  }

  schedulePreDraftAutomation() {
    if (!this.isAuthoritativeHost || !this.preDraftState) return;
    const state = this.preDraftState;

    if (state.stage === 'coin-flipping' && !state.coinResult) {
      this.scheduleTimer('coin-result', 1900, () => {
        if (this.preDraftState?.stage !== 'coin-flipping') return;
        const result = secureRandomUnit() < 0.5 ? 'HEADS' : 'TAILS';
        const callerWon = result === this.preDraftState.coinChoice;
        this.preDraftState.coinResult = result;
        this.preDraftState.sideChooser = callerWon
          ? this.preDraftState.coinCaller
          : this.preDraftState.coinCaller === 'teamA' ? 'teamB' : 'teamA';
        this.preDraftState.stage = 'side-select';
        this.commitPreDraftState();
      });
      return;
    }

    if (state.stage === 'side-reveal' && state.sideAssignment) {
      const token = state.transitionToken || JSON.stringify(state.sideAssignment);
      this.scheduleTimer(`side-reveal:${token}`, 1850, () => {
        if (this.preDraftState?.stage !== 'side-reveal') return;
        this.applySideAssignment(this.preDraftState.sideAssignment, { revealHeader: true });
        this.preDraftState.stage = this.config.enableDivineDraw ? 'divine' : 'complete';
        this.commitPreDraftState();
        if (this.preDraftState.stage === 'complete') this.finishPreDraft({ alreadyCommitted: true });
      });
      return;
    }

    if (state.stage === 'divine') {
      if (!state.divine) {
        state.divine = this.createDivineState();
        this.commitPreDraftState();
        return;
      }
      if (state.divine.phase === 'spinning') {
        this.scheduleTimer('divine-random', 3000, () => this.drawDivineRules());
      } else if (state.divine.phase === 'shuffling') {
        this.scheduleTimer('divine-ban-random', 1600, () => this.drawDivineRules(state.divine.bannedIndices || []));
      }
    }
  }

  createDivineState() {
    const mode = ['random', 'pickban', 'ban-random'].includes(this.config.divineDrawMode)
      ? this.config.divineDrawMode : 'random';
    const bansPerTeam = Math.max(0, Math.min(3, Math.floor(Number(this.config.divineBans) || 0)));
    if (mode === 'random') {
      return { mode, phase: 'spinning', gameNumber: Number(this.config.gameNumber || 1), gameRollId: this.gameRollId, sequence: [], stepIndex: 0, bannedIndices: [], picks: { A: null, B: null }, drawnIndices: [] };
    }
    const sequence = mode === 'pickban'
      ? buildDivinePickBanSequence(bansPerTeam)
      : buildDivineBanSequence(bansPerTeam);
    return {
      mode,
      phase: sequence.length ? 'selecting' : 'shuffling',
      gameNumber: Number(this.config.gameNumber || 1),
      gameRollId: this.gameRollId,
      sequence,
      stepIndex: 0,
      bannedIndices: [],
      picks: { A: null, B: null },
      drawnIndices: [],
    };
  }

  handleDivineSelection(data = {}, fromRole = 'host') {
    const divine = this.preDraftState?.divine;
    if (this.preDraftState?.stage !== 'divine' || !divine || divine.phase !== 'selecting') return;
    const index = Number(data.index);
    if (!isValidDivineIndex(index)) return;
    const step = divine.sequence[divine.stepIndex];
    if (!step) return;
    const actorSide = this.actorSide(fromRole, data);
    if (fromRole !== 'host' && actorSide !== step.team) return;
    if (divine.bannedIndices.includes(index) || Object.values(divine.picks).includes(index)) return;

    if (step.action === 'ban') divine.bannedIndices.push(index);
    else divine.picks[step.team] = index;
    divine.stepIndex += 1;

    if (divine.stepIndex >= divine.sequence.length) {
      if (divine.mode === 'pickban') {
        // Exactly two active Divine Draws total: one selected by Blue and one by Red.
        divine.drawnIndices = [divine.picks.A, divine.picks.B].filter(isValidDivineIndex);
        divine.phase = 'complete';
        this.chosenDivineRules = divine.drawnIndices.map(indexValue => DIVINE_RULES[indexValue]);
      } else {
        divine.phase = 'shuffling';
      }
    }
    this.commitPreDraftState();
  }

  drawDivineRules(excludedIndices = []) {
    const divine = this.preDraftState?.divine;
    if (!divine || !['spinning', 'shuffling'].includes(divine.phase)) return;
    divine.drawnIndices = drawRandomDivineIndices(excludedIndices);
    divine.phase = 'complete';
    this.chosenDivineRules = divine.drawnIndices.map(index => DIVINE_RULES[index]);
    this.commitPreDraftState();
  }

  renderPreDraftState() {
    const state = this.preDraftState;
    if (!state) return;
    if (state.sideAssignment) this.applySideAssignment(state.sideAssignment, { revealHeader: state.stage !== 'side-reveal' });

    if (['coin-call', 'coin-ready', 'coin-flipping', 'side-select', 'side-reveal'].includes(state.stage)) {
      this.setPreDraftStage(true, 'coin-flip-screen');
      this.renderCoinFlow();
      // The oval side-assignment animation is a Broadcast-only presentation.
      // Team, Host and Referee POVs reveal the resolved side immediately so
      // their interactive controls never move or become difficult to follow.
      if (state.stage === 'side-reveal') this.setSidePending(false);
      return;
    }
    if (state.stage === 'divine') {
      this.setPreDraftStage(true, 'divine-draw-screen');
      this.renderDivineDraw();
      return;
    }
    if (state.stage === 'complete') {
      this.setSidePending(false);
      this.setPreDraftStage(false);
    }
  }

  canActAsEntrant(teamKey) {
    return this.roomRole === 'host' || this.roomRole === teamKey;
  }

  renderCoinFlow() {
    const state = this.preDraftState;
    if (!state) return;
    this.renderEntrantCards();
    const quick = this.config.quickDraft === true;
    const resultText = document.getElementById('coin-result-text');
    const flipButton = document.getElementById('btn-flip-coin');
    const sidePanel = document.getElementById('side-choice-panel');
    const sideTitle = document.getElementById('side-choice-title');
    const coin = document.getElementById('spinning-coin');
    const desc = document.getElementById('coin-flow-desc');

    if (desc) desc.textContent = quick
      ? 'Either team may call first. The coin winner chooses Blue or Red side.'
      : `${this.config.teamA} is the upper bracket team and calls the coin. The winner chooses side.`;
    const noteA = document.getElementById('pre-draft-note-teamA');
    const noteB = document.getElementById('pre-draft-note-teamB');
    if (noteA) noteA.textContent = quick ? 'EITHER TEAM MAY CALL' : 'UPPER TEAM · COIN CALL';
    if (noteB) noteB.textContent = quick ? 'EITHER TEAM MAY CALL' : 'LOWER TEAM';

    for (const teamKey of ['teamA', 'teamB']) {
      const entrant = this.entrant(teamKey);
      const title = document.getElementById(`coin-${teamKey}-title`);
      const help = document.getElementById(`coin-${teamKey}-help`);
      if (title) title.textContent = entrant.name;
      const eligible = quick || teamKey === 'teamA';
      const panel = document.querySelector(`[data-coin-team="${teamKey}"]`);
      panel?.classList.toggle('is-caller', state.coinCaller === teamKey);
      panel?.classList.toggle('is-locked', Boolean(state.coinCaller && state.coinCaller !== teamKey) || !eligible);
      if (help) {
        if (!eligible) help.textContent = 'The upper bracket team owns the coin call.';
        else if (state.coinCaller === teamKey) help.textContent = `${state.coinChoice} called.`;
        else if (state.coinCaller) help.textContent = 'Waiting for the coin result.';
        else help.textContent = quick ? 'First valid call claims the coin.' : 'Choose HEADS or TAILS.';
      }
      document.querySelectorAll(`[data-coin-team="${teamKey}"] [data-coin-face]`).forEach(button => {
        const canCall = state.stage === 'coin-call' && !state.coinCaller && eligible && this.canActAsEntrant(teamKey);
        button.disabled = !canCall;
        button.classList.toggle('is-selected', state.coinCaller === teamKey && state.coinChoice === button.dataset.coinFace);
      });
    }

    if (coin) {
      coin.classList.toggle('spinning', state.stage === 'coin-flipping');
      if (state.coinResult && state.stage !== 'coin-flipping') coin.style.transform = state.coinResult === 'TAILS' ? 'rotateY(180deg)' : 'rotateY(0deg)';
    }

    const caller = state.coinCaller ? this.entrant(state.coinCaller) : null;
    const chooser = state.sideChooser ? this.entrant(state.sideChooser) : null;
    if (flipButton) {
      flipButton.disabled = !(state.stage === 'coin-ready' && state.coinCaller && this.canActAsEntrant(state.coinCaller));
      flipButton.textContent = state.stage === 'coin-flipping' ? 'FLIPPING…' : 'FLIP COIN';
    }

    sidePanel?.classList.toggle('hidden', state.stage !== 'side-select');
    if (sideTitle && chooser) sideTitle.textContent = `${chooser.name} WON — CHOOSE SIDE`;
    document.querySelectorAll('[data-side-choice]').forEach(button => {
      button.disabled = !(state.stage === 'side-select' && state.sideChooser && this.canActAsEntrant(state.sideChooser));
    });

    if (!resultText) return;
    if (state.stage === 'coin-call') {
      resultText.textContent = quick ? 'Waiting for either team to call the coin…' : `${this.config.teamA} must call HEADS or TAILS.`;
    } else if (state.stage === 'coin-ready') {
      resultText.textContent = `${caller?.name || 'Team'} called ${state.coinChoice}.`;
    } else if (state.stage === 'coin-flipping') {
      resultText.textContent = 'The coin is in the air…';
    } else if (state.stage === 'side-select') {
      resultText.textContent = `RESULT: ${state.coinResult}. ${chooser?.name || 'Winner'} chooses Blue or Red.`;
    } else if (state.stage === 'side-reveal') {
      resultText.textContent = `${this.teamForSide('A').name} → BLUE · ${this.teamForSide('B').name} → RED`;
    }
  }


  renderDivineDraw() {
    const state = this.preDraftState;
    const divine = state?.divine;
    const status = document.getElementById('divine-draw-status');
    const actions = document.getElementById('divine-actions');
    const button = document.getElementById('btn-start-pickban');
    const modeDesc = document.getElementById('divine-draw-mode-desc');
    const roulette = document.getElementById('divine-roulette-container');
    const reel = document.getElementById('divine-reel');
    const cards = document.getElementById('divine-cards-container');
    if (!divine || !status || !actions || !button || !modeDesc || !roulette || !cards) {
      if (status) status.textContent = 'Waiting for either team to prepare Divine Draw…';
      return;
    }

    actions.classList.toggle('hidden', divine.phase !== 'complete');
    const canProceed = ['host', 'teamA', 'teamB'].includes(this.roomRole);
    button.disabled = !canProceed || divine.phase !== 'complete';
    button.textContent = canProceed ? 'PROCEED TO DRAFT' : 'WAITING FOR TEAMS';

    if (divine.phase === 'complete') {
      roulette.classList.add('hidden');
      cards.style.display = 'flex';
      cards.className = 'divine-shuffle-results';
      const selected = divine.drawnIndices.map(index => DIVINE_RULES[index]).filter(Boolean).slice(0, 2);
      this.chosenDivineRules = selected;
      cards.innerHTML = selected.map((rule, index) => `
        <div class="divine-card flipped ${index === 0 ? 'team-a-divine' : 'team-b-divine'}">
          <div class="divine-card-inner"><div class="divine-card-back">✦</div><div class="divine-card-front"><img src="divine/${escapeHtml(rule.file)}" alt="${escapeHtml(rule.name)}"><div class="divine-card-name">${escapeHtml(rule.name)}</div></div></div>
        </div>`).join('');
      status.innerHTML = `✦ <span style="color:var(--team-left-primary)">${escapeHtml(selected[0]?.name || '—')}</span> &amp; <span style="color:var(--team-right-secondary)">${escapeHtml(selected[1]?.name || '—')}</span> — 2 Divine Draws active for this match.`;
      modeDesc.textContent = divine.mode === 'pickban'
        ? 'Each side selected one Divine Draw. The match total is locked at two.'
        : 'Two Divine Draws were selected for the entire match.';
      return;
    }

    if (divine.mode === 'random' && divine.phase === 'spinning') {
      modeDesc.textContent = 'Two Divine Draws will be randomly selected for the entire match.';
      cards.style.display = 'none';
      roulette.classList.remove('hidden');
      if (reel) {
        reel.innerHTML = [...DIVINE_RULES, ...DIVINE_RULES, ...DIVINE_RULES].map(rule => `<div class="divine-reel-item"><img src="divine/${escapeHtml(rule.file)}" alt="${escapeHtml(rule.name)}"><div class="divine-reel-name">${escapeHtml(rule.name)}</div></div>`).join('');
        reel.style.transform = 'translateX(0)';
        requestAnimationFrame(() => { reel.style.transform = 'translateX(-950px)'; });
      }
      status.textContent = 'Spinning the Divine Draw reel…';
      return;
    }

    if (divine.phase === 'shuffling') {
      roulette.classList.add('hidden');
      cards.style.display = 'flex';
      cards.className = 'divine-shuffle-stack';
      const banned = new Set(divine.bannedIndices || []);
      cards.innerHTML = DIVINE_RULES.map((rule, index) => banned.has(index) ? '' : `<div class="divine-shuffle-card shuffle-anim-${index}"><div class="divine-pool-card-img"><img src="divine/${escapeHtml(rule.file)}" alt="${escapeHtml(rule.name)}"></div><div class="divine-pool-card-name">${escapeHtml(rule.name)}</div></div>`).join('');
      status.textContent = 'Shuffling the remaining Divine Draws…';
      modeDesc.textContent = 'Both sides completed their configured bans. Two remaining Draws will be activated.';
      return;
    }

    roulette.classList.add('hidden');
    cards.style.display = '';
    cards.className = 'divine-pool-grid';
    const banned = new Set(divine.bannedIndices || []);
    const picked = divine.picks || { A: null, B: null };
    const step = divine.sequence[divine.stepIndex];
    const canChoose = Boolean(step) && (this.roomRole === 'host' || this.sideForRole(this.roomRole) === step.team);
    const pickedByIndex = new Map(Object.entries(picked).filter(([, index]) => isValidDivineIndex(index)).map(([side, index]) => [Number(index), side]));
    cards.innerHTML = `<div class="divine-pool-header"><span class="divine-pool-label">${divine.mode === 'pickban' ? 'DIVINE PICK / BAN' : 'BAN DIVINE DRAWS'}</span></div><div class="divine-pool-cards divine-pool-cards-4col">${DIVINE_RULES.map((rule, index) => {
      const pickedSide = pickedByIndex.get(index);
      const unavailable = banned.has(index) || Boolean(pickedSide);
      return `<div class="divine-pool-card ${banned.has(index) ? 'divine-banned' : ''} ${pickedSide ? 'divine-picked' : ''}" data-divine-index="${index}" aria-disabled="${String(unavailable || !canChoose)}"><div class="divine-pool-card-img"><img src="divine/${escapeHtml(rule.file)}" alt="${escapeHtml(rule.name)}"></div><div class="divine-pool-card-name">${escapeHtml(rule.name)}</div><div class="divine-pool-card-overlay" style="${banned.has(index) ? 'display:block;background:rgba(180,0,0,.55)' : ''}"></div><div class="divine-pool-card-ban-x" style="${banned.has(index) ? 'display:flex' : ''}">✕</div><div class="divine-pool-card-pick-label" style="${pickedSide ? `display:block;color:${pickedSide === 'A' ? 'var(--team-left-primary)' : 'var(--team-right-secondary)'}` : ''}">${pickedSide ? escapeHtml(this.teamForSide(pickedSide).name) : ''}</div></div>`;
    }).join('')}</div>`;

    if (!step) {
      status.textContent = 'Resolving Divine Draw…';
      return;
    }
    const team = this.teamForSide(step.team);
    const actionLabel = step.action === 'ban' ? 'BAN a Divine Draw' : 'PICK one Divine Draw';
    status.innerHTML = `<span style="color:${step.team === 'A' ? 'var(--team-left-primary)' : 'var(--team-right-secondary)'}">${escapeHtml(team.name)}</span> — ${actionLabel} (${divine.stepIndex + 1}/${divine.sequence.length})`;
    modeDesc.textContent = divine.mode === 'pickban'
      ? `Each side bans ${Math.max(0, Number(this.config.divineBans || 0))} and picks exactly one. Only two Draws activate in the match.`
      : `Each side bans ${Math.max(0, Number(this.config.divineBans || 0))}. Two Draws are then selected from the remaining pool.`;
  }

  finishPreDraft({ alreadyCommitted = false } = {}) {
    if (!this.isAuthoritativeHost || !this.preDraftState) return;
    this.preDraftState.stage = 'complete';
    this.applySideAssignment(this.preDraftState.sideAssignment || { A: 'teamA', B: 'teamB' }, { revealHeader: true });
    if (!alreadyCommitted) this.publishRoomState(true);
    this.setPreDraftStage(false);
    if (this.chosenDivineRules.length === 2) {
      this.publishRoomEvent('divine:result', {
        rules: this.chosenDivineRules,
        gameNumber: Number(this.config.gameNumber || 1),
        gameRollId: this.gameRollId,
      });
      this.renderDivineHeader();
    }
    if (this.config.draftStyle === 'all-random') this.startAllRandomBanPhase();
    else this.startDraftEngine();
  }

  initChatSidebar() {
    const toggleBtn = document.getElementById('btn-toggle-chat');
    const closeBtn  = document.getElementById('btn-close-chat');
    const sidebar   = document.getElementById('chat-sidebar');
    const sendBtn   = document.getElementById('btn-chat-send');
    const input     = document.getElementById('chat-input');
    const messages  = document.getElementById('chat-messages');
    const roomBox   = document.getElementById('room-code-box');
    const roomDisp  = document.getElementById('room-code-display');

    if (!toggleBtn) return;

    if (this.config.roomMode === 'bandai-tool' && this.config.roomCode) {
      if (roomBox) roomBox.style.display = 'block';
      if (roomDisp) {
        roomDisp.textContent = this.config.roomCode;
        roomDisp.onclick = () => {
          navigator.clipboard.writeText(this.config.roomCode);
          roomDisp.textContent = '✓ Copied!';
          setTimeout(() => { roomDisp.textContent = this.config.roomCode; }, 1500);
        };
      }
    }

    const toggle = () => sidebar?.classList.toggle('hidden');
    toggleBtn.addEventListener('click', toggle);
    if (closeBtn) closeBtn.addEventListener('click', () => sidebar?.classList.add('hidden'));

    const addMessage = (sender, text, meta = '') => {
      if (!messages) return;
      const el = document.createElement('div');
      el.className = 'chat-message';
      const senderEl = document.createElement('div');
      senderEl.className = 'chat-sender';
      senderEl.textContent = sender || 'Unknown';
      const textEl = document.createElement('div');
      textEl.textContent = text || '';
      el.append(senderEl, textEl);
      if (meta) {
        const metaEl = document.createElement('div');
        metaEl.className = 'chat-meta';
        metaEl.textContent = meta;
        el.appendChild(metaEl);
      }
      messages.appendChild(el);
      messages.scrollTop = messages.scrollHeight;
    };

    const initialMessages = this.config._roomMessages || this.sync?.initialMessages || [];
    if (initialMessages.length) {
      initialMessages.forEach(message => addMessage(
        message.sender_name || message.sender_role,
        message.message,
        message.created_at ? new Date(message.created_at).toLocaleString() : ''
      ));
    } else {
      addMessage('System', `Draft room opened. Match: ${this.config.teamA} vs ${this.config.teamB}`);
    }

    this.sync?.on('chat', message => {
      addMessage(
        message.sender_name || message.sender_role,
        message.message,
        message.created_at ? new Date(message.created_at).toLocaleTimeString() : ''
      );
    });

    if (sendBtn && input) {
      const canChat = true;
      sendBtn.disabled = false;
      input.disabled = false;

      const doSend = () => {
        const val = input.value.trim();
        if (!val || !canChat) return;
        if (this.sync) {
          this.sync.sendChat(val);
        } else {
          addMessage('Host', val);
        }
        input.value = '';
      };
      sendBtn.addEventListener('click', doSend);
      input.addEventListener('keydown', event => { if (event.key === 'Enter') doSend(); });
    }
  }


  startAllRandomBanPhase() {
    // Show a dedicated catalog-style ban screen before the two-team random roll.
    // Full character art is used with object-fit: contain so faces are not cropped.
    const overlay = document.getElementById('pre-draft-overlay');
    this.setPreDraftStage(true);

    document.getElementById('all-random-ban-screen')?.remove();

    const coinFlipScreen = document.getElementById('coin-flip-screen');
    const divineDrawScreen = document.getElementById('divine-draw-screen');
    coinFlipScreen?.classList.add('hidden');
    divineDrawScreen?.classList.add('hidden');

    const mirrorLabels = {
      none: 'No Mirror Picks',
      tank: 'Tank Mirror',
      technical: 'Technical Mirror',
      damage: 'Damage Mirror',
      'tank-technical': 'Tank + Technical Mirror',
      all: 'All Role Mirror',
    };
    const activeMirrorLabel = mirrorLabels[this.engine.config.mirrorPickMode] || mirrorLabels.none;

    const banScreen = document.createElement('section');
    banScreen.className = 'pre-draft-modal pre-draft-modal-wide all-random-ban-modal';
    banScreen.id = 'all-random-ban-screen';
    banScreen.setAttribute('aria-labelledby', 'all-random-ban-title');
    banScreen.innerHTML = `
      <header class="ban-phase-heading">
        <div>
          <span class="ban-phase-kicker">ALL RANDOM · PRE-DRAFT</span>
          <h2 class="pre-draft-title" id="all-random-ban-title">HOST BAN PHASE</h2>
          <p class="pre-draft-desc">Choose any heroes you do not want in this roll. Every card shows the hero name and role.</p>
        </div>
        <div class="ban-phase-rule-note">
          <strong>${escapeHtml(activeMirrorLabel)}</strong>
          <span>${escapeHtml(t('mirrorEnabledHelp'))}</span>
        </div>
      </header>
      <div class="ban-phase-toolbar">
        <label class="ban-phase-search-field">
          <span>SEARCH HERO</span>
          <input id="ban-phase-search" type="search" autocomplete="off" placeholder="Type Goku, Vegeta, Tank…" aria-label="Search heroes to ban">
        </label>
        <div class="ban-phase-role-filters" id="ban-phase-role-filters" aria-label="Filter heroes by role">
          <button type="button" class="ban-phase-filter active" data-role="all">ALL</button>
          <button type="button" class="ban-phase-filter" data-role="Damage">${roleIconMarkup('Damage', 'ban-filter-role-icon')} DAMAGE</button>
          <button type="button" class="ban-phase-filter" data-role="Tank">${roleIconMarkup('Tank', 'ban-filter-role-icon')} TANK</button>
          <button type="button" class="ban-phase-filter" data-role="Technical">${roleIconMarkup('Technical', 'ban-filter-role-icon')} TECHNICAL</button>
        </div>
      </div>
      <div class="ban-phase-summary">
        <strong id="ban-phase-status">0 HEROES BANNED</strong>
        <span id="ban-phase-visible-count"></span>
      </div>
      <div id="ban-phase-grid" class="ban-phase-hero-grid" role="list"></div>
      <footer class="ban-phase-actions">
        <span>Selected heroes will be excluded before both teams receive 2 Damage, 1 Tank and 1 Technical.</span>
        <button class="btn btn-primary btn-lg" id="btn-confirm-bans" type="button">RANDOMIZE PICKS</button>
      </footer>
    `;
    overlay?.appendChild(banScreen);

    const grid = banScreen.querySelector('#ban-phase-grid');
    const searchInput = banScreen.querySelector('#ban-phase-search');
    const statusEl = banScreen.querySelector('#ban-phase-status');
    const visibleCountEl = banScreen.querySelector('#ban-phase-visible-count');
    const filterButtons = [...banScreen.querySelectorAll('.ban-phase-filter')];
    const bannedSet = new Set(this._allRandomBannedIds || []);
    const eligibleHeroes = this.engine.heroes.filter(hero => (
      hero.status === 'available'
      && !this.engine.globalBannedHeroes.has(hero.id)
      && !this.engine.protectedHeroes.has(hero.id)
    ));
    let activeRole = 'all';

    const updateStatus = () => {
      statusEl.textContent = `${bannedSet.size} HERO${bannedSet.size === 1 ? '' : 'ES'} BANNED`;
      const visible = [...grid.querySelectorAll('.ban-phase-hero-card')].filter(card => !card.hidden).length;
      visibleCountEl.textContent = `Showing ${visible} of ${eligibleHeroes.length} eligible heroes`;
    };

    const applyFilters = () => {
      const query = String(searchInput.value || '').trim().toLowerCase();
      grid.querySelectorAll('.ban-phase-hero-card').forEach(card => {
        const roleMatches = activeRole === 'all' || card.dataset.role === activeRole;
        const textMatches = !query || card.dataset.search.includes(query);
        card.hidden = !(roleMatches && textMatches);
      });
      updateStatus();
    };

    eligibleHeroes.forEach(hero => {
      const roleData = ROLES[hero.role];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `ban-phase-hero-card role-${hero.role.toLowerCase()}`;
      card.dataset.heroId = hero.id;
      card.dataset.role = hero.role;
      card.dataset.search = `${heroName(hero.id, hero.name)} ${hero.name} ${roleLabel(hero.role)} ${hero.role} ${hero.id}`.toLowerCase();
      card.setAttribute('role', 'listitem');
      card.setAttribute('aria-label', `${heroName(hero.id, hero.name)}, ${roleLabel(hero.role)}`);

      const portrait = document.createElement('span');
      portrait.className = 'ban-phase-portrait';
      portrait.style.setProperty('--role-color', roleData.color);

      const fallback = document.createElement('span');
      fallback.className = 'ban-phase-image-fallback';
      fallback.textContent = heroName(hero.id, hero.name).split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();

      const image = document.createElement('img');
      image.src = getHeroImgSp(hero.id);
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.dataset.fallbackUsed = 'false';
      image.addEventListener('load', () => portrait.classList.add('has-image'));
      image.addEventListener('error', () => {
        if (image.dataset.fallbackUsed === 'false') {
          image.dataset.fallbackUsed = 'true';
          image.src = getHeroImg(hero.id);
          return;
        }
        image.hidden = true;
        portrait.classList.remove('has-image');
      });

      portrait.append(fallback, image);
      portrait.insertAdjacentHTML('beforeend', `
        <span class="ban-phase-card-role" title="${escapeHtml(roleData.name)}">${roleIconMarkup(hero.role, 'ban-phase-role-icon')}<b>${escapeHtml(roleData.label)}</b></span>
        <span class="ban-phase-ban-mark" aria-hidden="true"><b>✕</b><em>BANNED</em></span>
      `);

      const meta = document.createElement('span');
      meta.className = 'ban-phase-hero-meta';
      meta.innerHTML = `
        <strong class="ban-phase-hero-name">${escapeHtml(heroName(hero.id, hero.name))}</strong>
        <span class="ban-phase-hero-role-label" style="--role-color:${roleData.color}">${escapeHtml(roleData.name)}<small>#${escapeHtml(hero.id)}</small></span>
      `;

      card.append(portrait, meta);
      if (bannedSet.has(hero.id)) {
        card.classList.add('host-banned');
        card.setAttribute('aria-pressed', 'true');
      } else {
        card.setAttribute('aria-pressed', 'false');
      }

      card.addEventListener('click', () => {
        const isBanned = card.classList.toggle('host-banned');
        card.setAttribute('aria-pressed', String(isBanned));
        if (isBanned) bannedSet.add(hero.id);
        else bannedSet.delete(hero.id);
        updateStatus();
      });
      grid.appendChild(card);
    });

    searchInput.addEventListener('input', applyFilters);
    filterButtons.forEach(button => button.addEventListener('click', () => {
      activeRole = button.dataset.role || 'all';
      filterButtons.forEach(item => item.classList.toggle('active', item === button));
      applyFilters();
    }));
    updateStatus();

    banScreen.querySelector('#btn-confirm-bans').addEventListener('click', () => {
      bannedSet.forEach(id => {
        const hero = this.engine.heroes.find(item => item.id === id);
        if (hero) hero.status = 'banned';
      });
      this._allRandomBannedIds = [...bannedSet];
      this.publishRoomEvent('all-random:bans', { heroIds: this._allRandomBannedIds });
      this.publishRoomState(true);
      banScreen.remove();
      this.setPreDraftStage(false);
      this.runAllRandom();
    });
  }

  updateSeriesScoreDisplay() {
    // The database keeps scores by original bracket entrant (teamA/teamB),
    // while the draft UI renders the resolved Blue/Red sides (A/B).
    const scoreA = this.scoreForSide('A');
    const scoreB = this.scoreForSide('B');
    const pairs = [
      ['team-a-score', scoreA],
      ['team-b-score', scoreB],
      ['series-team-a-score', scoreA],
      ['series-team-b-score', scoreB],
    ];
    pairs.forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = String(value);
    });
    const nameA = document.getElementById('series-team-a-name');
    const nameB = document.getElementById('series-team-b-name');
    this.setTeamName(nameA, this.teamForSide('A').name);
    this.setTeamName(nameB, this.teamForSide('B').name);
  }

  bindSeriesControl() {
    document.getElementById('series-control-close')?.addEventListener('click', () => {
      this.seriesControlOverlay?.classList.add('hidden');
      if (this.engine?.state === 'complete') {
        this.seriesControlButton?.classList.remove('hidden');
        this.seriesControlButton?.classList.add('needs-attention');
      }
    });
    this.seriesControlButton?.addEventListener('click', () => this.showSeriesControl());
    document.getElementById('series-winner-a')?.addEventListener('click', () => this.recordGameWinner('A'));
    document.getElementById('series-winner-b')?.addEventListener('click', () => this.recordGameWinner('B'));
  }

  seriesRuleDescription() {
    const gameNumber = Math.max(1, Number(this.config.gameNumber || 1));
    const previousCount = new Set([
      ...(this.config.previousPicksA || []),
      ...(this.config.previousPicksB || []),
    ]).size;
    if (this.config.seriesRule === 'fearless') {
      if (gameNumber <= 1) return 'FEARLESS is enabled. After the Game 1 winner is recorded, every hero picked in Game 1 will be locked for both teams in Game 2.';
      return `FEARLESS is active for Game ${gameNumber}. ${previousCount} previously picked hero${previousCount === 1 ? '' : 'es'} are locked for both teams.`;
    }
    if (this.config.seriesRule === 'team_no_repeat') {
      return gameNumber <= 1
        ? 'TEAM NO REPEAT is enabled. From Game 2 onward, each team cannot reuse its own earlier picks.'
        : `TEAM NO REPEAT is active for Game ${gameNumber}. Each team is locked out of its own previous picks.`;
    }
    if (this.config.seriesRule === 'squadra_blast') {
      const phase = squadraBlastPhase(gameNumber);
      const carryBans = this.config.squadraBlastCarryBans !== false;
      if (phase === 1) return t(carryBans ? 'squadraBlastGame1' : 'squadraBlastGame1NoCarry');
      if (phase === 2) return t(carryBans ? 'squadraBlastGame2' : 'squadraBlastGame2NoCarry');
      return t('squadraBlastGame3');
    }
    return 'NORMAL series rule is active. Heroes may be picked again in later games.';
  }

  showSeriesControl({ seriesComplete = false } = {}) {
    if (!this.seriesControlOverlay) return;
    this.updateSeriesScoreDisplay();
    const gameNumber = Math.max(1, Number(this.config.gameNumber || 1));
    const kicker = document.getElementById('series-control-kicker');
    const title = document.getElementById('series-control-title');
    const rule = document.getElementById('series-control-rule');
    const buttonA = document.getElementById('series-winner-a');
    const buttonB = document.getElementById('series-winner-b');
    const openOps = document.getElementById('series-open-ops');
    const tournamentSeries = Boolean(this.sync && this.config.matchId && !this.config.quickDraft);
    const canRecord = this.isAuthoritativeHost && !seriesComplete && !tournamentSeries;

    if (kicker) kicker.textContent = seriesComplete ? 'BO SERIES COMPLETE' : `GAME ${gameNumber} DRAFT COMPLETE`;
    if (title) title.textContent = seriesComplete ? 'SERIES SCORE VERIFIED' : tournamentSeries ? t('playGameThenReportTitle') : 'RECORD GAME WINNER';
    if (rule) rule.textContent = seriesComplete
      ? `${this.teamForSide('A').name} ${this.scoreForSide('A')} - ${this.scoreForSide('B')} ${this.teamForSide('B').name}. The confirmed game results already form the official match result.`
      : tournamentSeries
        ? `${this.seriesRuleDescription()} ${t('tournamentGameReportDesc')}`
        : this.seriesRuleDescription();

    [buttonA, buttonB].forEach(button => {
      if (!button) return;
      button.disabled = !canRecord;
      button.classList.toggle('is-view-only', !canRecord);
    });
    if (buttonA?.querySelector('em')) buttonA.querySelector('em').textContent = canRecord ? `${this.teamForSide('A').name} WON THIS GAME` : tournamentSeries ? 'CAPTAINS REPORT IN PORTAL' : 'VIEW ONLY';
    if (buttonB?.querySelector('em')) buttonB.querySelector('em').textContent = canRecord ? `${this.teamForSide('B').name} WON THIS GAME` : tournamentSeries ? 'CAPTAINS REPORT IN PORTAL' : 'VIEW ONLY';

    if (this.seriesControlStatus) {
      this.seriesControlStatus.className = `series-control-status${seriesComplete ? ' success' : ''}`;
      this.seriesControlStatus.textContent = seriesComplete
        ? 'The series is final because every game result was confirmed before the next Draft opened.'
        : tournamentSeries
          ? t('playGameThenReportNext', { game: gameNumber, nextGame: gameNumber + 1 })
          : canRecord
            ? 'After the game finishes, click the winning team. The score and next draft game will update automatically.'
            : 'Only the Quick Draft authority can record the local game winner.';
    }
    if (openOps && this.config.matchId) {
      openOps.href = this.roomRole === 'host' ? `/dashboard.html?tournamentId=${encodeURIComponent(this.config.tournamentId || '')}` : '/portal.html';
      openOps.textContent = this.roomRole === 'host' ? 'OPEN TOURNAMENT OPS' : 'OPEN PLAYER PORTAL';
    }
    openOps?.classList.toggle('hidden', !this.config.matchId || (!tournamentSeries && !seriesComplete));
    this.seriesControlButton?.classList.add('hidden');
    this.seriesControlButton?.classList.remove('needs-attention');
    document.querySelector('.action-bar')?.classList.remove('result-ready');
    this.seriesControlOverlay.classList.remove('hidden');
  }

  setSeriesControlsBusy(busy) {
    ['series-winner-a', 'series-winner-b'].forEach(id => {
      const button = document.getElementById(id);
      if (button) button.disabled = Boolean(busy);
    });
  }

  async recordGameWinner(side) {
    if (!this.isAuthoritativeHost) return;
    if (this.sync && this.config.matchId && !this.config.quickDraft) {
      if (this.seriesControlStatus) {
        this.seriesControlStatus.className = 'series-control-status';
        this.seriesControlStatus.textContent = 'Tournament games are reported by Captains in Player Portal, not from Draft Room.';
      }
      return;
    }
    const visualSide = side === 'B' ? 'B' : 'A';
    const winnerEntrantKey = entrantForSide(this.sideAssignment, visualSide);
    const winnerSideForApi = winnerEntrantKey === 'teamB' ? 'B' : 'A';
    const teamName = this.teamForSide(visualSide).name;
    if (!window.confirm(`Record ${teamName} as the winner of Game ${this.config.gameNumber || 1}?`)) return;
    this.setSeriesControlsBusy(true);
    if (this.seriesControlStatus) {
      this.seriesControlStatus.className = 'series-control-status';
      this.seriesControlStatus.textContent = 'Saving the game winner and preparing the next draft…';
    }

    try {
      if (this.sync && this.config.matchId) {
        const quickSharedRoom = this.config.quickDraft === true && this.sync instanceof DraftRoomSync;
        const endpoint = quickSharedRoom
          ? `/api/public/draft-rooms/${encodeURIComponent(this.sync.roomCode)}/game-result`
          : `/api/matches/${this.config.matchId}/draft-room/game-result`;
        const payload = await api(endpoint, {
          method: 'POST',
          // The server records the original bracket Team A / Team B, not the
          // temporary Blue / Red placement selected after the coin toss.
          body: { winnerSide: winnerSideForApi, gameNumber: Number(this.config.gameNumber || 1), ...(quickSharedRoom ? { accessToken: this.sync.accessToken } : {}) },
        });
        this.config.seriesScoreA = Number(payload.scoreA || 0);
        this.config.seriesScoreB = Number(payload.scoreB || 0);
        this.updateSeriesScoreDisplay();
        if (payload.seriesComplete) {
          this.showSeriesControl({ seriesComplete: true });
          return;
        }
        if (this.seriesControlStatus) {
          this.seriesControlStatus.className = 'series-control-status success';
          this.seriesControlStatus.textContent = `Score saved. Loading Game ${payload.nextGameNumber} with ${String(this.config.seriesRule).replaceAll('_', ' ')} history…`;
        }
        setTimeout(() => {
          if (payload.nextDraftUrl) window.location.assign(payload.nextDraftUrl);
          else window.location.reload();
        }, 900);
        return;
      }

      // Quick Draft local series flow. Scores and reuse history stay attached
      // to the original entrant even when that entrant chose Red side.
      if (winnerEntrantKey === 'teamA') this.config.seriesScoreA = Number(this.config.seriesScoreA || 0) + 1;
      else this.config.seriesScoreB = Number(this.config.seriesScoreB || 0) + 1;
      const bestOf = Math.max(1, Number(String(this.config.format || 'BO3').replace(/\D/g, '')) || 3);
      const winsNeeded = Math.floor(bestOf / 2) + 1;
      const seriesComplete = this.config.seriesScoreA >= winsNeeded || this.config.seriesScoreB >= winsNeeded;
      this.updateSeriesScoreDisplay();
      if (seriesComplete) {
        this.sync?.publishState({
          status: 'series_complete',
          seriesComplete: true,
          gameNumber: Number(this.config.gameNumber || 1),
          seriesScoreA: this.config.seriesScoreA,
          seriesScoreB: this.config.seriesScoreB,
          seriesRule: this.config.seriesRule || 'normal',
        });
        this.showSeriesControl({ seriesComplete: true });
        return;
      }

      const sideAPicks = this.engine.teamA.picks || [];
      const sideBPicks = this.engine.teamB.picks || [];
      const entrantAPicks = entrantForSide(this.sideAssignment, 'A') === 'teamA' ? sideAPicks : sideBPicks;
      const entrantBPicks = entrantForSide(this.sideAssignment, 'A') === 'teamB' ? sideAPicks : sideBPicks;
      const sideABans = this.engine.teamA.bans || [];
      const sideBBans = this.engine.teamB.bans || [];
      const entrantABans = entrantForSide(this.sideAssignment, 'A') === 'teamA' ? sideABans : sideBBans;
      const entrantBBans = entrantForSide(this.sideAssignment, 'A') === 'teamB' ? sideABans : sideBBans;
      const nextGameNumber = Number(this.config.gameNumber || 1) + 1;
      if (this.config.seriesRule === 'squadra_blast') {
        if (squadraBlastPhase(nextGameNumber) === 2) {
          this.config.previousPicksA = [...new Set(entrantAPicks)];
          this.config.previousPicksB = [...new Set(entrantBPicks)];
          this.config.previousBansA = this.config.squadraBlastCarryBans === false ? [] : [...new Set(entrantABans)];
          this.config.previousBansB = this.config.squadraBlastCarryBans === false ? [] : [...new Set(entrantBBans)];
        } else {
          this.config.previousPicksA = [];
          this.config.previousPicksB = [];
          this.config.previousBansA = [];
          this.config.previousBansB = [];
        }
      } else {
        this.config.previousPicksA = [...new Set([...(this.config.previousPicksA || []), ...entrantAPicks])];
        this.config.previousPicksB = [...new Set([...(this.config.previousPicksB || []), ...entrantBPicks])];
      }
      this.config.gameNumber = nextGameNumber;

      const nextConfig = serializableDraftConfig(this.config);
      this.sync?.publishState({
        status: 'waiting',
        gameNumber: nextConfig.gameNumber,
        seriesScoreA: nextConfig.seriesScoreA,
        seriesScoreB: nextConfig.seriesScoreB,
        seriesRule: nextConfig.seriesRule,
        reloadRequired: true,
        nextConfig,
      });
      window.location.assign(localDraftUrl(nextConfig, this.roomRole));
    } catch (error) {
      this.setSeriesControlsBusy(false);
      if (this.seriesControlStatus) {
        this.seriesControlStatus.className = 'series-control-status error';
        this.seriesControlStatus.textContent = error.message || String(error);
      }
    }
  }

  runAllRandom() {
    let assignments;
    try {
      assignments = this.engine.generateAllRandomAssignments();
    } catch (error) {
      this.timerEl.textContent = 'ERR';
      this.phaseIndicator.textContent = 'RANDOMIZATION ERROR';
      this.showRoomNotice(error.message || 'Unable to create valid random teams.');
      console.error('All Random assignment failed:', error);
      return;
    }

    this.publishRoomEvent('all-random:result', {
      assignments,
      gameNumber: Number(this.config.gameNumber || 1),
      gameRollId: this.gameRollId,
    });
    this.btnLock.style.display = 'none';
    this.timerEl.textContent = 'AUTO';
    this.engine.state = 'active';

    // Remove ban steps from sequence (all-random has no ban phase in engine)
    this.engine.sequence = this.engine.sequence.filter(s => s.type === 'pick');
    this.engine.currentStep = 0;

    this.engine.emit('draftStarted', { action: this.engine.currentAction });
    this.engine.emit('nextTurn', { action: this.engine.currentAction, step: 0 });

    this.renderGrid();

    if (this.allRandomInterval) clearInterval(this.allRandomInterval);
    const queues = { A: [...assignments.A], B: [...assignments.B] };

    this.allRandomInterval = setInterval(() => {
      if (this.engine.state === 'complete') {
        clearInterval(this.allRandomInterval);
        this.allRandomInterval = null;
        return;
      }

      const action = this.engine.currentAction;
      const heroId = action ? queues[action.team]?.shift() : null;
      if (!heroId || !this.engine.applyLockedHero(heroId)) {
        clearInterval(this.allRandomInterval);
        this.allRandomInterval = null;
        this.timerEl.textContent = 'ERR';
        this.phaseIndicator.textContent = 'RANDOMIZATION ERROR';
        this.showRoomNotice('The generated roll became invalid. Please review the bans and try again.');
      }
    }, 800);
  }
}

// ===== DRAFT ROOM BOOTSTRAP =====
export function encodeDraftConfig(config) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(config))));
}

export function decodeDraftConfig(encoded) {
  return JSON.parse(decodeURIComponent(escape(atob(encoded))));
}

function localRoleFromParams(teamParam) {
  if (teamParam === 'A') return 'teamA';
  if (teamParam === 'B') return 'teamB';
  if (teamParam === 'broadcaster') return 'broadcaster';
  if (teamParam === 'referee') return 'referee';
  return teamParam === 'host' ? 'host' : 'preview';
}

function localTeamParamFromRole(role) {
  if (role === 'teamA') return 'A';
  if (role === 'teamB') return 'B';
  if (role === 'broadcaster') return 'broadcaster';
  if (role === 'referee') return 'referee';
  if (role === 'host') return 'host';
  return 'preview';
}

function serializableDraftConfig(config = {}) {
  // Runtime synchronization objects contain BroadcastChannel/Socket instances
  // and cannot be cloned or encoded into the next Quick Draft URL.
  const {
    _sync,
    _roomRole,
    _roomState,
    _roomMessages,
    _draftAuthorityRole,
    _isDraftAuthority,
    _draftPresence,
    ...serializable
  } = config || {};
  return serializable;
}

function localDraftUrl(config, role = 'host') {
  const encoded = encodeDraftConfig(serializableDraftConfig(config));
  return `${window.location.pathname}?config=${encodeURIComponent(encoded)}&team=${encodeURIComponent(localTeamParamFromRole(role))}`;
}

export async function loadDraftConfigFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const roomCode = fragment.get('room') || params.get('room');
  const accessToken = fragment.get('access');

  if (roomCode && accessToken) {
    // The role capability stays in the URL fragment so a manual refresh can re-exchange a short-lived, single-use Socket ticket.
    // Fragments are not sent in HTTP requests, Referer headers, reverse-proxy logs or Socket handshakes.
    const sync = new DraftRoomSync({ roomCode, accessToken });
    await sync.connect();
    return {
      ...sync.config,
      roomCode: sync.roomCode,
      _sync: sync,
      _roomRole: sync.role,
      _roomState: sync.initialState,
      _roomMessages: sync.initialMessages,
      _draftAuthorityRole: sync.authorityRole,
      _isDraftAuthority: sync.isAuthority,
      _draftPresence: sync.presence,
    };
  }

  const configParam = params.get('config');
  const teamParam = params.get('team') || 'host';
  if (!configParam) return null;

  const config = decodeDraftConfig(configParam);
  const role = localRoleFromParams(teamParam);
  const sessionId = String(config.sessionId || '').trim();
  if (!sessionId) throw new Error('This Quick Draft link is missing its live session ID. Create a new room from Quick Draft.');
  const sync = new LocalDraftSync({ sessionId, role, config });
  await sync.connect();
  const storedNextConfig = sync.initialState?.nextConfig;
  const effectiveConfig = storedNextConfig
    && Number(storedNextConfig.gameNumber || 0) >= Number(config.gameNumber || 0)
      ? storedNextConfig
      : config;
  const initialState = storedNextConfig
    ? { ...sync.initialState, reloadRequired: false }
    : sync.initialState;
  return {
    ...effectiveConfig,
    roomCode: sync.roomCode,
    _sync: sync,
    _roomRole: role,
    _roomState: initialState,
    _roomMessages: sync.initialMessages,
  };
}

function showBootstrapError(error) {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = `<div class="route-error-state">
    <div class="route-error-card">
      <span class="state-icon" aria-hidden="true">!</span>
      <h1>DRAFT ROOM ERROR</h1>
      <p>${escapeHtml(error?.message || error)}</p>
      <div class="route-error-actions">
        <a class="btn btn-primary" href="/quick-draft.html">OPEN QUICK DRAFT</a>
        <a class="btn btn-ghost" href="/dashboard.html">TOURNAMENT OPERATIONS</a>
      </div>
    </div>
  </div>`;
}

if (document.getElementById('draft-view')) {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      const config = await loadDraftConfigFromUrl();
      if (!config) throw new Error('No Draft Room configuration was provided.');
      document.getElementById('draft-view')?.classList.remove('hidden');
      window.draftApp = new DraftUI(config);
    } catch (error) {
      console.error(error);
      showBootstrapError(error);
    }
  });
}

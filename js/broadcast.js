// OBS-first pick/ban overlay.
// Layout: center reveal stage, with each team's ban strip attached directly above its own bottom pick row.
// Trailer playback uses local /assets/trailers/{heroId}.* files and falls back to full hero art.
import { getHeroImgSp, getHeroFullImg, getHeroTrailerUrls, getHeroTrailerPosterUrls } from './heroes.js';
import { heroName, roleLabel, t } from './i18n.js';
import { normalizeSideAssignment, sideForEntrant } from './pre-draft.js';

const BROADCAST_SIDE_ORBIT_LOOPS = 4;
const BROADCAST_SIDE_ORBIT_DURATION_MS = 2400;
const BROADCAST_SIDE_ALIGNMENT_DURATION_MS = 360;
const BROADCAST_HERO_REVEAL_SECONDS = 3;

function initials(name) {
  const parts = String(name || 'TEAM').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'TM';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts.slice(0, 2).map(part => part[0]).join('')).toUpperCase();
}

function resolveTournamentName(config = {}) {
  return String(
    config.tournamentName
    || config.eventName
    || config.tournament?.name
    || config.competitionName
    || 'GEKISHIN SQUADRA'
  ).trim() || 'GEKISHIN SQUADRA';
}

export class BroadcastUI {
  constructor(engine, options = {}) {
    this.engine = engine;
    this.config = options.config || {};
    this.revealTimer = null;
    this.revealRequest = 0;
    this.hasLockedHeroReveal = false;
    this.pendingWaitingAction = null;
    this.hostBannedHeroIds = Array.isArray(this.config.hostBannedHeroIds) ? this.config.hostBannedHeroIds : [];
    this.originalEntrants = options.originalEntrants || {};
    this.sideRevealSignature = '';
    this.sideRevealAnimating = false;
    this.sideRevealRun = 0;
    this.initDOM();
    this.bindEvents();
    this.renderInitialState();
  }

  initDOM() {
    const view = document.getElementById('broadcast-view');
    if (!view) throw new Error('Missing #broadcast-view container.');

    view.innerHTML = `
      <div class="bc-background" aria-hidden="true"></div>
      <main class="bc-overlay-shell">
        <header class="bc-event-banner" aria-label="Tournament name">
          <div class="bc-tournament-name" id="bc-tournament-name">GEKISHIN SQUADRA</div>
        </header>
        <section class="bc-hero-stage" id="bc-hero-stage" aria-live="polite">
          <video class="bc-trailer-video" id="bc-hero-video" muted playsinline preload="auto"></video>
          <img class="bc-hero-fallback" id="bc-hero-image" alt="">
          <div class="bc-hero-shade" aria-hidden="true"></div>
          <div class="bc-waiting" id="bc-waiting">
            <div class="bc-waiting-kicker" id="bc-waiting-kicker">DRAFT ROOM</div>
            <div class="bc-waiting-title" id="bc-waiting-title">WAITING FOR HOST</div>
          </div>
          <div class="bc-reveal-copy hidden" id="bc-reveal-copy">
            <div class="bc-reveal-action" id="bc-reveal-action"></div>
            <div class="bc-reveal-name" id="bc-reveal-name"></div>
            <div class="bc-reveal-role" id="bc-reveal-role"></div>
          </div>
          <div class="bc-stage-divine" id="bc-divine-results"></div>
        </section>

        <section class="bc-side-assignment hidden" id="bc-side-assignment" aria-live="polite">
          <div class="bc-side-assignment-copy">
            <small id="bc-side-assignment-kicker">SIDE SELECTION</small>
            <strong id="bc-side-assignment-title">WAITING FOR COIN TOSS</strong>
          </div>
          <div class="bc-side-orbit" id="bc-side-orbit">
            <article class="bc-side-card" data-entrant="teamA" id="bc-side-card-teamA">
              <div class="bc-side-card-logo" id="bc-side-logo-teamA"><img alt=""><span>TA</span></div>
              <div><small>UPPER TEAM</small><strong id="bc-side-name-teamA">TEAM A</strong></div>
            </article>
            <article class="bc-side-card" data-entrant="teamB" id="bc-side-card-teamB">
              <div class="bc-side-card-logo" id="bc-side-logo-teamB"><img alt=""><span>TB</span></div>
              <div><small>LOWER TEAM</small><strong id="bc-side-name-teamB">TEAM B</strong></div>
            </article>
          </div>
        </section>

        <footer class="bc-lineup-dock">
          <div class="bc-team-cluster bc-team-cluster-a">
            <div class="bc-team-ban-dock bc-team-ban-dock-a" aria-label="Team Blue banned heroes">
              <div class="bc-team-bans bc-team-bans-a" id="bc-team-a-bans"></div>
              <div class="bc-ban-spacer" aria-hidden="true"></div>
            </div>
            <section class="bc-team-lineup bc-team-lineup-a">
              <div class="bc-team-picks" id="bc-team-a-picks"></div>
              <div class="bc-team-identity">
                <div class="bc-team-logo" id="bc-team-a-logo"><img alt=""><span></span></div>
                <div class="bc-team-copy"><small>TEAM BLUE</small><strong id="bc-team-a-name">TEAM BLUE</strong></div>
                <div class="bc-team-score" id="bc-score-a">0</div>
              </div>
            </section>
          </div>

          <div class="bc-match-center">
            <section class="bc-live-meta" aria-label="Draft status">
              <span class="bc-phase" id="bc-phase">WAITING</span>
              <strong class="bc-timer" id="bc-timer">—</strong>
            </section>
            <span>VS</span>
            <small class="bc-match-meta" id="bc-match-meta">4v4 DRAFT</small>
          </div>

          <div class="bc-team-cluster bc-team-cluster-b">
            <div class="bc-team-ban-dock bc-team-ban-dock-b" aria-label="Team Red banned heroes">
              <div class="bc-ban-spacer" aria-hidden="true"></div>
              <div class="bc-team-bans bc-team-bans-b" id="bc-team-b-bans"></div>
            </div>
            <section class="bc-team-lineup bc-team-lineup-b">
              <div class="bc-team-identity bc-team-identity-b">
                <div class="bc-team-score" id="bc-score-b">0</div>
                <div class="bc-team-copy"><small>TEAM RED</small><strong id="bc-team-b-name">TEAM RED</strong></div>
                <div class="bc-team-logo" id="bc-team-b-logo"><img alt=""><span></span></div>
              </div>
              <div class="bc-team-picks" id="bc-team-b-picks"></div>
            </section>
          </div>
        </footer>
      </main>`;

    this.renderSlots();
    this.renderTeamIdentity();
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

  setSidePreviewEntrants(entrants = {}) {
    this.originalEntrants = entrants || this.originalEntrants || {};
    for (const teamKey of ['teamA', 'teamB']) {
      const entrant = this.originalEntrants[teamKey] || {};
      const name = String(entrant.name || (teamKey === 'teamA' ? 'TEAM A' : 'TEAM B'));
      const nameRoot = document.getElementById(`bc-side-name-${teamKey}`);
      this.setTeamName(nameRoot, name);
      const logoRoot = document.getElementById(`bc-side-logo-${teamKey}`);
      if (!logoRoot) continue;
      const image = logoRoot.querySelector('img');
      const fallback = logoRoot.querySelector('span');
      if (fallback) fallback.textContent = initials(name);
      logoRoot.classList.remove('has-logo');
      if (!image) continue;
      image.removeAttribute('src');
      image.alt = `${name} logo`;
      const logo = entrant.logo || '';
      if (!logo) continue;
      image.onload = () => logoRoot.classList.add('has-logo');
      image.onerror = () => logoRoot.classList.remove('has-logo');
      image.src = logo;
    }
  }

  renderPreDraftState(preDraft, entrants = this.originalEntrants) {
    this.setSidePreviewEntrants(entrants);
    const overlay = document.getElementById('bc-side-assignment');
    const root = document.getElementById('broadcast-view');
    const title = document.getElementById('bc-side-assignment-title');
    const kicker = document.getElementById('bc-side-assignment-kicker');
    if (!overlay || !root) return;

    const stage = String(preDraft?.stage || '');
    const coinStages = new Set(['coin-call', 'coin-ready', 'coin-flipping', 'side-select', 'side-reveal']);
    if (!coinStages.has(stage)) {
      if (!this.sideRevealAnimating) {
        overlay.classList.add('hidden');
        overlay.classList.remove('is-revealing', 'is-docking');
        root.classList.remove('side-pending');
      }
      return;
    }

    overlay.classList.remove('hidden');
    root.classList.add('side-pending');
    if (kicker) kicker.textContent = stage === 'side-reveal' ? 'SIDE ASSIGNMENT' : 'COIN TOSS';
    if (title) {
      title.textContent = stage === 'coin-call' ? 'WAITING FOR A COIN CALL'
        : stage === 'coin-ready' ? 'COIN FACE LOCKED'
        : stage === 'coin-flipping' ? 'THE COIN IS IN THE AIR'
        : stage === 'side-select' ? 'WINNER CHOOSES BLUE OR RED'
        : 'BLUE AND RED SIDES LOCKED';
    }

    if (stage === 'side-reveal' && preDraft?.sideAssignment) {
      this.animateBroadcastSideAssignment(preDraft);
    }
  }

  orbitKeyframes(startAngle, travel, radiusX, radiusY) {
    const frames = [];
    // Keep roughly 24 samples per full orbit so four revolutions remain smooth.
    const orbitCount = Math.abs(travel) / (Math.PI * 2);
    const total = Math.max(28, Math.ceil(orbitCount * 24) + 1);
    for (let index = 0; index < total; index += 1) {
      const progress = index / (total - 1);
      // Counter-clockwise in screen coordinates: the upper path moves left
      // and the lower path moves right, matching the requested horizontal oval.
      const angle = startAngle - (travel * progress);
      const x = Math.cos(angle) * radiusX;
      const y = Math.sin(angle) * radiusY;
      const tilt = Math.sin(angle) * -5;
      frames.push({
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${tilt}deg)`,
        offset: progress,
      });
    }
    return frames;
  }

  async animateBroadcastSideAssignment(preDraft) {
    const assignment = normalizeSideAssignment(preDraft?.sideAssignment);
    if (!assignment) return;
    const signature = `${preDraft?.transitionToken || ''}:${assignment.A}:${assignment.B}`;
    if (this.sideRevealSignature === signature || this.sideRevealAnimating) return;
    this.sideRevealSignature = signature;
    this.sideRevealAnimating = true;
    const run = ++this.sideRevealRun;

    const overlay = document.getElementById('bc-side-assignment');
    const root = document.getElementById('broadcast-view');
    const title = document.getElementById('bc-side-assignment-title');
    if (!overlay || !root) return;
    overlay.classList.add('is-revealing');
    if (title) title.textContent = 'TEAMS ARE MOVING TO THEIR SIDES';

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.dataset.motion === 'reduced';
    if (reducedMotion) {
      root.classList.remove('side-pending');
      await new Promise(resolve => setTimeout(resolve, 180));
      if (run !== this.sideRevealRun) return;
      overlay.classList.add('hidden');
      overlay.classList.remove('is-revealing');
      this.sideRevealAnimating = false;
      return;
    }

    const radiusX = Math.max(180, Math.min(window.innerWidth * .25, 340));
    const radiusY = Math.max(72, Math.min(window.innerHeight * .12, 128));
    const swapped = assignment.A === 'teamB';
    const fullOrbitTravel = BROADCAST_SIDE_ORBIT_LOOPS * Math.PI * 2;
    const starts = { teamA: Math.PI, teamB: 0 };
    const cards = ['teamA', 'teamB'].map(teamKey => ({
      teamKey,
      side: sideForEntrant(assignment, teamKey),
      card: document.getElementById(`bc-side-card-${teamKey}`),
    })).filter(item => item.card);

    // Both logos always complete four full counter-clockwise oval revolutions.
    await Promise.all(cards.map(({ teamKey, card }) => card.animate(
      this.orbitKeyframes(starts[teamKey], fullOrbitTravel, radiusX, radiusY),
      {
        duration: BROADCAST_SIDE_ORBIT_DURATION_MS,
        easing: 'cubic-bezier(.42,.04,.24,1)',
        fill: 'forwards',
      },
    ).finished.catch(() => undefined)));
    if (run !== this.sideRevealRun) return;

    // When the teams swap sides, use a short final half-orbit only to align them
    // with their selected Blue/Red destinations after the four complete loops.
    if (swapped) {
      await Promise.all(cards.map(({ teamKey, card }) => card.animate(
        this.orbitKeyframes(starts[teamKey] - fullOrbitTravel, Math.PI, radiusX, radiusY),
        {
          duration: BROADCAST_SIDE_ALIGNMENT_DURATION_MS,
          easing: 'cubic-bezier(.35,.05,.2,1)',
          fill: 'forwards',
        },
      ).finished.catch(() => undefined)));
      if (run !== this.sideRevealRun) return;
    }

    overlay.classList.add('is-docking');
    if (title) title.textContent = `${this.engine.teamA.name} → BLUE · ${this.engine.teamB.name} → RED`;

    const dock = document.querySelector('.bc-lineup-dock');
    const dockTransform = dock ? getComputedStyle(dock).transform : 'none';
    let dockOffsetX = 0;
    let dockOffsetY = 0;
    if (dockTransform && dockTransform !== 'none') {
      const values = dockTransform.match(/matrix(?:3d)?\(([^)]+)\)/)?.[1]?.split(',').map(Number) || [];
      if (values.length === 6) {
        dockOffsetX = values[4] || 0;
        dockOffsetY = values[5] || 0;
      } else if (values.length === 16) {
        dockOffsetX = values[12] || 0;
        dockOffsetY = values[13] || 0;
      }
    }

    const flyers = cards.map(({ teamKey, side, card }) => {
      const startRect = card.getBoundingClientRect();
      const target = document.querySelector(`.bc-team-lineup-${side.toLowerCase()} .bc-team-identity`);
      const targetRect = target?.getBoundingClientRect();
      if (!targetRect) return null;
      const flyer = card.cloneNode(true);
      flyer.removeAttribute('id');
      flyer.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      flyer.classList.add('bc-side-card-flyer');
      Object.assign(flyer.style, {
        position: 'fixed',
        left: `${startRect.left}px`,
        top: `${startRect.top}px`,
        width: `${startRect.width}px`,
        height: `${startRect.height}px`,
        margin: '0',
        transform: 'none',
      });
      document.body.appendChild(flyer);
      card.style.visibility = 'hidden';
      const targetCenterX = targetRect.left + targetRect.width / 2 - dockOffsetX;
      const targetCenterY = targetRect.top + targetRect.height / 2 - dockOffsetY;
      const dx = targetCenterX - (startRect.left + startRect.width / 2);
      const dy = targetCenterY - (startRect.top + startRect.height / 2);
      const scale = Math.min(.62, targetRect.width / startRect.width, targetRect.height / startRect.height);
      return {
        flyer,
        animation: flyer.animate([
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
          { transform: `translate(${dx * .72}px, ${dy * .55}px) scale(.82)`, opacity: 1, offset: .58 },
          { transform: `translate(${dx}px, ${dy}px) scale(${Math.max(.28, scale)})`, opacity: .08 },
        ], { duration: 520, easing: 'cubic-bezier(.18,.78,.22,1)', fill: 'forwards' }),
      };
    }).filter(Boolean);

    // Reveal the final Broadcast draft setup while the two neutral cards dock
    // into the resolved Blue and Red identity areas.
    root.classList.remove('side-pending');
    await Promise.all(flyers.map(item => item.animation.finished.catch(() => undefined)));
    if (run !== this.sideRevealRun) return;

    flyers.forEach(({ flyer }) => flyer.remove());
    cards.forEach(({ card }) => {
      card.getAnimations().forEach(animation => animation.cancel());
      card.style.removeProperty('visibility');
    });
    overlay.classList.add('hidden');
    overlay.classList.remove('is-revealing', 'is-docking');
    this.sideRevealAnimating = false;
  }

  renderTeamIdentity() {
    const teamA = this.engine.teamA.name;
    const teamB = this.engine.teamB.name;
    this.setTeamName(document.getElementById('bc-team-a-name'), teamA);
    this.setTeamName(document.getElementById('bc-team-b-name'), teamB);
    document.getElementById('bc-score-a').textContent = String(Number(this.config.seriesScoreA || 0));
    document.getElementById('bc-score-b').textContent = String(Number(this.config.seriesScoreB || 0));
    this.setLogo('A', this.config.teamALogoUrl || this.config.teamALogo || '', teamA);
    this.setLogo('B', this.config.teamBLogoUrl || this.config.teamBLogo || '', teamB);
  }

  setLogo(team, url, name) {
    const root = document.getElementById(`bc-team-${team.toLowerCase()}-logo`);
    if (!root) return;
    const image = root.querySelector('img');
    const fallback = root.querySelector('span');
    fallback.textContent = initials(name);
    root.classList.remove('has-logo');
    image.removeAttribute('src');
    image.alt = `${name} logo`;
    if (!url) return;
    image.onload = () => root.classList.add('has-logo');
    image.onerror = () => root.classList.remove('has-logo');
    image.src = url;
  }

  renderSlots() {
    const picks = team => Array.from({ length: 4 }, (_, index) => `
      <div class="bc-pick-card" id="bc-slot-${team}-${index}">
        <div class="bc-pick-img"></div>
        <div class="bc-pick-shade"></div>
        <div class="bc-pick-name">PICK ${index + 1}</div>
      </div>`).join('');

    // Divine Draw bans are a separate pre-draft rule phase and must never create
    // extra hero-ban boxes on the Broadcast overlay.
    const configuredBanCount = Number(this.engine.config.heroBans || 0);
    const recordedBanCount = Math.max(
      this.engine.teamA.bans?.length || 0,
      this.engine.teamB.bans?.length || 0,
    );
    const banCount = Math.max(0, configuredBanCount, recordedBanCount);
    const bans = team => Array.from({ length: banCount }, (_, index) => `
      <div class="bc-ban-card" id="bc-ban-${team}-${index}" aria-label="Empty ban ${index + 1}">
        <div class="bc-ban-img"></div>
        <div class="bc-ban-muted"></div>
        <div class="bc-ban-x">╱</div>
      </div>`).join('');

    document.getElementById('bc-team-a-picks').innerHTML = picks('A');
    document.getElementById('bc-team-b-picks').innerHTML = picks('B');
    document.getElementById('bc-team-a-bans').innerHTML = bans('A');
    document.getElementById('bc-team-b-bans').innerHTML = bans('B');
  }

  renderHostBans(heroIds = []) {
    this.hostBannedHeroIds = [...new Set((Array.isArray(heroIds) ? heroIds : []).filter(Boolean))];
    if (!this.hostBannedHeroIds.length) return;
    const midpoint = Math.ceil(this.hostBannedHeroIds.length / 2);
    const byTeam = { A: this.hostBannedHeroIds.slice(0, midpoint), B: this.hostBannedHeroIds.slice(midpoint) };
    for (const team of ['A', 'B']) {
      const root = document.getElementById(`bc-team-${team.toLowerCase()}-bans`);
      if (!root) continue;
      root.classList.add('host-ban-rail');
      root.dataset.label = 'HOST BANS';
      root.innerHTML = byTeam[team].map((id, index) => {
        const hero = this.engine.getHero(id);
        if (!hero) return '';
        return `<div class="bc-ban-card filled host-ban" aria-label="${hero.name} host banned" title="${hero.name}"><div class="bc-ban-img" style="background-image:url(${getHeroImgSp(hero.id)})"></div><div class="bc-ban-muted"></div><div class="bc-ban-x">╱</div></div>`;
      }).join('');
    }
  }

  bindEvents() {
    document.getElementById('bc-tournament-name').textContent = resolveTournamentName(this.config);
    document.getElementById('bc-match-meta').textContent = [
      this.config.roundName,
      this.config.format || '4v4 DRAFT',
      this.config.serverRegion,
    ].filter(Boolean).join(' · ');

    this.engine.on('draftStarted', () => this.setWaitingForAction(this.engine.currentAction));
    this.engine.on('nextTurn', ({ action }) => {
      this.updateActiveSlot(action);
      this.updatePhase(action);
      this.scheduleWaiting(action);
    });
    this.engine.on('timerTick', ({ remaining }) => {
      const timer = document.getElementById('bc-timer');
      timer.textContent = remaining;
      timer.classList.toggle('danger', remaining <= 5);
    });
    this.engine.on('heroPicked', ({ hero, team }) => {
      this.fillPick(hero, team);
      this.revealHero(hero, team, 'pick');
    });
    this.engine.on('heroBanned', ({ hero, team }) => {
      this.fillBan(hero, team);
      this.revealHero(hero, team, 'ban');
    });
    this.engine.on('draftPaused', () => this.setStatusScreen(t('technicalPause'), t('draftTimerPaused')));
    this.engine.on('draftResumed', () => this.setWaitingForAction(this.engine.currentAction));
    this.engine.on('draftComplete', () => {
      // The final locked hero has no following pick to replace it, so keep that
      // reveal on screen instead of immediately covering it with a status card.
      this.updatePhase(null);
      document.getElementById('bc-timer').textContent = '—';
    });
  }

  clearSlots() {
    this.renderSlots();
  }

  renderInitialState() {
    this.engine.teamA.picks.forEach(id => this.fillPick(this.engine.getHero(id), 'A'));
    this.engine.teamB.picks.forEach(id => this.fillPick(this.engine.getHero(id), 'B'));
    this.engine.teamA.bans.forEach(id => this.fillBan(this.engine.getHero(id), 'A'));
    this.engine.teamB.bans.forEach(id => this.fillBan(this.engine.getHero(id), 'B'));
    this.updateActiveSlot(this.engine.currentAction);
    this.updatePhase(this.engine.currentAction);
    document.getElementById('bc-timer').textContent = this.engine.state === 'waiting' ? '—' : String(this.engine.timerRemaining ?? '—');
    if (this.hostBannedHeroIds.length) this.renderHostBans(this.hostBannedHeroIds);
    if (this.engine.state === 'active' && !this.hasLockedHeroReveal) this.setWaitingForAction(this.engine.currentAction);
    else if (this.engine.state === 'complete' && !this.hasLockedHeroReveal) this.setStatusScreen(t('draftComplete'), t('finalLocked'));
  }

  syncFromEngine() {
    this.clearSlots();
    this.renderTeamIdentity();
    this.renderInitialState();
  }

  updatePhase(action) {
    const phase = document.getElementById('bc-phase');
    if (!action) {
      phase.textContent = this.engine.state === 'waiting' ? t('waiting') : t('complete');
      return;
    }
    phase.textContent = action.type === 'pick' ? t('pickPhase') : action.type === 'ban' ? t('banPhase') : t('divineBan');
  }

  updateActiveSlot(action) {
    document.querySelectorAll('.bc-pick-card,.bc-ban-card').forEach(card => card.classList.remove('active'));
    if (!action) return;
    const selector = action.type === 'pick' ? `.bc-pick-card[id^="bc-slot-${action.team}-"]` : `.bc-ban-card[id^="bc-ban-${action.team}-"]`;
    [...document.querySelectorAll(selector)].find(item => !item.classList.contains('filled'))?.classList.add('active');
  }

  fillPick(hero, team) {
    if (!hero) return;
    const card = [...document.querySelectorAll(`.bc-pick-card[id^="bc-slot-${team}-"]`)].find(item => !item.classList.contains('filled'));
    if (!card) return;
    card.classList.remove('active');
    card.classList.add('filled');
    card.querySelector('.bc-pick-img').style.backgroundImage = `url(${getHeroImgSp(hero.id)})`;
    card.querySelector('.bc-pick-name').textContent = heroName(hero.id, hero.name);
  }

  fillBan(hero, team) {
    if (!hero) return;
    const card = [...document.querySelectorAll(`.bc-ban-card[id^="bc-ban-${team}-"]`)].find(item => !item.classList.contains('filled'));
    if (!card) return;
    card.classList.remove('active');
    card.classList.add('filled');
    card.setAttribute('aria-label', `${heroName(hero.id, hero.name)} banned`);
    card.querySelector('.bc-ban-img').style.backgroundImage = `url(${getHeroImgSp(hero.id)})`;
  }

  configuredHeroTrailer(heroId) {
    const sources = this.config.heroTrailerUrls || this.config.heroVideos || this.config.trailers || {};
    return typeof sources === 'object' && sources ? String(sources[heroId] || '') : '';
  }

  configuredHeroTrailerPoster(heroId) {
    const sources = this.config.heroTrailerPosterUrls || this.config.heroPosterUrls || this.config.trailerPosters || {};
    return typeof sources === 'object' && sources ? String(sources[heroId] || '') : '';
  }

  revealHero(hero, team, action) {
    clearTimeout(this.revealTimer);
    this.revealTimer = null;
    const requestId = ++this.revealRequest;
    this.hasLockedHeroReveal = true;
    const stage = document.getElementById('bc-hero-stage');
    const video = document.getElementById('bc-hero-video');
    const image = document.getElementById('bc-hero-image');
    const waiting = document.getElementById('bc-waiting');
    const copy = document.getElementById('bc-reveal-copy');
    stage.classList.remove('waiting-with-poster');
    stage.classList.toggle('ban-reveal', action === 'ban');
    stage.dataset.revealTeam = team;
    waiting.classList.add('hidden');
    copy.classList.add('hidden');
    document.getElementById('bc-reveal-action').textContent = `${action === 'pick' ? t('currentPick') : t('currentBan')} · ${team === 'A' ? t('teamBlue') : t('teamRed')}`;
    document.getElementById('bc-reveal-name').textContent = heroName(hero.id, hero.name);
    document.getElementById('bc-reveal-role').textContent = roleLabel(hero.role);

    image.onerror = null;
    image.onload = null;
    image.classList.remove('poster-frame');
    image.src = getHeroFullImg(hero.id);
    image.alt = heroName(hero.id, hero.name);
    image.classList.remove('visible');

    video.classList.remove('visible');
    video.pause();
    video.loop = false;
    video.oncanplay = null;
    video.ontimeupdate = null;
    video.onended = null;
    video.onerror = null;
    video.removeAttribute('src');
    video.load();

    const posterSources = [
      ...getHeroTrailerPosterUrls(hero.id, this.configuredHeroTrailerPoster(hero.id)).map(src => ({ src, poster: true })),
      { src: getHeroFullImg(hero.id), poster: false },
    ];
    let posterIndex = 0;
    const loadPoster = () => {
      if (requestId !== this.revealRequest) return;
      const candidate = posterSources[posterIndex++];
      if (!candidate) return;
      image.classList.toggle('poster-frame', candidate.poster);
      image.onerror = loadPoster;
      image.src = candidate.src;
    };
    loadPoster();

    const showLockedHero = () => {
      if (requestId !== this.revealRequest) return;
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
      video.pause();
      video.ontimeupdate = null;
      video.classList.remove('visible');
      image.classList.add('visible');
      waiting.classList.add('hidden');
      copy.classList.remove('hidden');
    };

    const sources = getHeroTrailerUrls(hero.id, this.configuredHeroTrailer(hero.id));
    let sourceIndex = 0;
    const tryNextVideo = () => {
      if (requestId !== this.revealRequest) return;
      const source = sources[sourceIndex++];
      if (!source) {
        showLockedHero();
        return;
      }
      video.src = source;
      video.load();
    };
    video.oncanplay = () => {
      if (requestId !== this.revealRequest) return;
      video.oncanplay = null;
      video.currentTime = 0;
      video.play().then(() => {
        if (requestId !== this.revealRequest) return;
        video.onerror = showLockedHero;
        image.classList.remove('visible');
        copy.classList.add('hidden');
        waiting.classList.add('hidden');
        video.classList.add('visible');
        video.ontimeupdate = () => {
          if (video.currentTime >= BROADCAST_HERO_REVEAL_SECONDS) showLockedHero();
        };
        this.revealTimer = setTimeout(showLockedHero, BROADCAST_HERO_REVEAL_SECONDS * 1000);
      }).catch(showLockedHero);
    };
    video.onended = showLockedHero;
    video.onerror = tryNextVideo;
    tryNextVideo();
  }

  scheduleWaiting(action) {
    // nextTurn fires directly after heroPicked/heroBanned. Remember the next
    // side, but do not interrupt the three-second reveal or restore WAITING.
    this.pendingWaitingAction = action || null;
  }

  setWaitingForAction(action, { preserveMedia = false, requestId = null } = {}) {
    if (requestId !== null && requestId !== this.revealRequest) return;
    const video = document.getElementById('bc-hero-video');
    const image = document.getElementById('bc-hero-image');
    const waiting = document.getElementById('bc-waiting');
    const copy = document.getElementById('bc-reveal-copy');
    const stage = document.getElementById('bc-hero-stage');
    clearTimeout(this.revealTimer);
    this.revealTimer = null;
    this.hasLockedHeroReveal = false;
    stage.classList.remove('ban-reveal');
    stage.classList.toggle('waiting-with-poster', preserveMedia);
    delete stage.dataset.revealTeam;
    video.pause();
    video.ontimeupdate = null;
    video.classList.remove('visible');
    if (!preserveMedia) image.classList.remove('visible');
    else image.classList.add('visible');
    copy.classList.add('hidden');
    waiting.classList.remove('hidden');

    if (!action) {
      document.getElementById('bc-waiting-kicker').textContent = t('draftRoom');
      document.getElementById('bc-waiting-title').textContent = t('waitingForHost');
      return;
    }
    const teamLabel = action.team === 'A' ? t('teamBlue') : t('teamRed');
    document.getElementById('bc-waiting-kicker').textContent = action.type === 'pick' ? t('currentPick') : t('currentBan');
    document.getElementById('bc-waiting-title').textContent = t('waitingFor', { team: teamLabel });
  }

  setStatusScreen(kicker, title) {
    clearTimeout(this.revealTimer);
    this.revealTimer = null;
    this.hasLockedHeroReveal = false;
    this.revealRequest += 1;
    const stage = document.getElementById('bc-hero-stage');
    const video = document.getElementById('bc-hero-video');
    const image = document.getElementById('bc-hero-image');
    stage.classList.remove('waiting-with-poster', 'ban-reveal');
    video.pause();
    video.loop = false;
    video.oncanplay = null;
    video.ontimeupdate = null;
    video.onended = null;
    video.onerror = null;
    video.classList.remove('visible');
    image.onerror = null;
    image.onload = null;
    image.classList.remove('visible', 'poster-frame');
    document.getElementById('bc-reveal-copy').classList.add('hidden');
    document.getElementById('bc-waiting').classList.remove('hidden');
    document.getElementById('bc-waiting-kicker').textContent = kicker;
    document.getElementById('bc-waiting-title').textContent = title;
  }

  renderDivineResults(rule1, rule2) {
    const container = document.getElementById('bc-divine-results');
    if (!container || !rule1 || !rule2) return;
    container.innerHTML = [rule1, rule2].map(rule => `
      <div class="bc-divine-badge" title="${rule.name}">
        <img src="divine/${rule.file}" alt="${rule.name}"><span>${rule.name}</span>
      </div>`).join('');
  }
}

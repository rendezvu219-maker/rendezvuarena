import { api, getToken, setToken } from './api.js';
import { HEROES, ROLES, getHeroImg, getHeroImgSp, getHeroFullImg, getHeroSkillIconUrls, roleIconMarkup, heroMatchesSearch, isNikitaEasterEggSearch, getHeroDisplayImage, getHeroDisplayName, getHeroDisplayDescription, imageWithFallback } from './heroes.js';
import { HEROES_DATA } from './heroes-data.js';
import { getLocale, heroName, roleLabel, localizeHeroDetail, t } from './i18n.js';

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const state = {
  user: null,
  heroId: new URLSearchParams(location.search).get('id') || HEROES[0]?.id,
  search: '',
  role: 'all',
  publicCards: [],
  publicPresets: [],
  adminCards: [],
  adminPresets: [],
  activeBuildId: null,
  activeSkillIndex: 0,
  adminLoaded: false,
  builderPresetId: null,
  builderSlots: { 1:null, 2:null, 3:null },
  builderSwaps: { 1:[null, null], 2:[null, null], 3:[null, null] },
  builderTarget: { slot:1, kind:'start' },
  builderInspectCardId: null,
  assignmentRole: 'all',
  assignmentSearch: '',
  assignmentSelected: new Set(),
};

const CARD_TYPE_LABELS = { attack:'Attack', defense:'Defense', technical:'Technical' };
const CARD_TYPE_ORDER = { attack:1, defense:2, technical:3 };
// Card 4–9 are six independent situational choices. `priority` is only the
// legacy database coordinate within a Slot; it is not a gameplay priority.
const SITUATIONAL_POSITIONS = Object.freeze([
  { cardNumber:4, slot:1, priority:1 },
  { cardNumber:5, slot:2, priority:1 },
  { cardNumber:6, slot:3, priority:1 },
  { cardNumber:7, slot:1, priority:2 },
  { cardNumber:8, slot:2, priority:2 },
  { cardNumber:9, slot:3, priority:2 },
]);

function captureAdminScroll() {
  const content = $('#build-admin-drawer .build-admin-content');
  const builder = $('#preset-builder');
  return {
    windowX: window.scrollX,
    windowY: window.scrollY,
    contentTop: content?.scrollTop || 0,
    contentLeft: content?.scrollLeft || 0,
    builderTop: builder?.scrollTop || 0,
    builderLeft: builder?.scrollLeft || 0,
  };
}

function restoreAdminScroll(snapshot) {
  if (!snapshot) return;
  requestAnimationFrame(() => {
    const content = $('#build-admin-drawer .build-admin-content');
    const builder = $('#preset-builder');
    if (content) {
      content.scrollTop = snapshot.contentTop;
      content.scrollLeft = snapshot.contentLeft;
    }
    if (builder) {
      builder.scrollTop = snapshot.builderTop;
      builder.scrollLeft = snapshot.builderLeft;
    }
    window.scrollTo(snapshot.windowX, snapshot.windowY);
  });
}

function builderSwapOptionsPayload() {
  const rows = [];
  for (const slot of [1, 2, 3]) {
    for (const priority of [1, 2]) {
      const cardId = state.builderSwaps[slot]?.[priority - 1] || null;
      if (cardId) rows.push({ slot, cardId, priority });
    }
  }
  return rows;
}

function builderSituationalSlotsPayload() {
  return Object.fromEntries(SITUATIONAL_POSITIONS.map(position => [
    String(position.cardNumber),
    state.builderSwaps[position.slot]?.[position.priority - 1] || null,
  ]));
}

function assertSituationalSlotsMatch(expected, actual, context = 'saved preset') {
  for (const position of SITUATIONAL_POSITIONS) {
    const key = String(position.cardNumber);
    const expectedCardId = expected?.[key] || null;
    const actualCardId = actual?.[key] || null;
    if (actualCardId !== expectedCardId) {
      throw new Error(`Card ${key} was not preserved in the ${context}. Expected ${expectedCardId ? 'the selected card' : 'an empty position'}.`);
    }
  }
}

function mergeSavedPreset(savedPreset) {
  if (!savedPreset?.id) return;
  const index = state.adminPresets.findIndex(preset => preset.id === savedPreset.id);
  if (index >= 0) state.adminPresets.splice(index, 1, savedPreset);
  else state.adminPresets.push(savedPreset);
}

function orderedCards(cards) {
  return [...cards].sort((a, b) => Number(a.slotPool || 99) - Number(b.slotPool || 99)
    || (CARD_TYPE_ORDER[a.cardType] || 9) - (CARD_TYPE_ORDER[b.cardType] || 9)
    || Number(a.displayOrder || 0) - Number(b.displayOrder || 0)
    || String(a.name || '').localeCompare(String(b.name || '')));
}

function cardTypeLabel(card) {
  return CARD_TYPE_LABELS[card?.cardType] || t('unassigned');
}

function cardTooltipAttributes(card) {
  if (!card?.id) return '';
  return `data-card-tooltip data-card-id="${escapeHtml(card.id)}"`;
}

function cardTooltipLabel(card) {
  return `${card.name}. ${cardTypeLabel(card)} card for Slot ${card.slotPool || 'unassigned'}. Hover or focus for details.`;
}

function findCardById(cardId) {
  return [...state.adminCards, ...state.publicCards].find(card => String(card.id) === String(cardId)) || null;
}

const cardPreviewState = {
  pinned: false,
  cardId: null,
  trigger: null,
};

function ensureCardTooltip() {
  let tooltip = $('#divine-card-tooltip');
  if (tooltip) return tooltip;
  tooltip = document.createElement('aside');
  tooltip.id = 'divine-card-tooltip';
  tooltip.className = 'divine-card-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.setAttribute('aria-live', 'polite');
  tooltip.hidden = true;
  document.body.appendChild(tooltip);
  return tooltip;
}

function clearCardPreviewTrigger() {
  document.querySelectorAll('.is-card-preview-active').forEach(item => item.classList.remove('is-card-preview-active'));
}

function positionCardTooltip(trigger, tooltip) {
  if (!trigger?.isConnected) return;
  const triggerRect = trigger.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const margin = 14;
  const rightCandidate = triggerRect.right + margin;
  const leftCandidate = triggerRect.left - tooltipRect.width - margin;
  let left;
  if (rightCandidate + tooltipRect.width <= window.innerWidth - margin) left = rightCandidate;
  else if (leftCandidate >= margin) left = leftCandidate;
  else left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
  left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));

  let top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
  top = Math.max(margin, Math.min(top, window.innerHeight - tooltipRect.height - margin));
  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
}

function renderCardTooltip(card, pinned) {
  const pinMessage = pinned
    ? `<span class="divine-card-tooltip-pin">${escapeHtml(t('pinned'))}</span>`
    : `<span class="divine-card-tooltip-hint">${escapeHtml(t('clickKeepOpen'))}</span>`;
  return `<div class="divine-card-tooltip-media"><img src="${escapeHtml(card.imagePath)}" alt="${escapeHtml(card.name)} enlarged Divine Card"></div>
    <div class="divine-card-tooltip-content">
      <div class="divine-card-tooltip-head"><span>${escapeHtml(card.slotPool ? `Slot ${card.slotPool}` : 'Unassigned')} · ${escapeHtml(cardTypeLabel(card))}</span><h3>${escapeHtml(card.name)}</h3>${pinMessage}</div>
      <div class="divine-card-tooltip-section"><b>${escapeHtml(t('effect'))}</b><p>${escapeHtml(card.effect || card.description || t('noEffect'))}</p></div>
      ${card.note ? `<div class="divine-card-tooltip-section note"><b>${escapeHtml(t('noteConditions'))}</b><p>${escapeHtml(card.note)}</p></div>` : ''}
    </div>`;
}

function showCardTooltip(trigger, { pinned = false } = {}) {
  const card = findCardById(trigger?.dataset.cardId);
  if (!card) return;
  if (cardPreviewState.pinned && !pinned) return;

  const tooltip = ensureCardTooltip();
  clearCardPreviewTrigger();
  trigger.classList.add('is-card-preview-active');
  cardPreviewState.pinned = pinned;
  cardPreviewState.cardId = String(card.id);
  cardPreviewState.trigger = trigger;

  tooltip.innerHTML = renderCardTooltip(card, pinned);
  tooltip.hidden = false;
  tooltip.classList.toggle('is-pinned', pinned);
  tooltip.setAttribute('role', pinned ? 'dialog' : 'tooltip');
  tooltip.setAttribute('aria-label', pinned ? `${card.name} card details, pinned` : `${card.name} card details`);
  requestAnimationFrame(() => positionCardTooltip(trigger, tooltip));
}

function hideCardTooltip({ force = false } = {}) {
  if (cardPreviewState.pinned && !force) return;
  const tooltip = $('#divine-card-tooltip');
  if (tooltip) {
    tooltip.hidden = true;
    tooltip.classList.remove('is-pinned');
    tooltip.removeAttribute('style');
    tooltip.innerHTML = '';
    tooltip.setAttribute('role', 'tooltip');
  }
  clearCardPreviewTrigger();
  cardPreviewState.pinned = false;
  cardPreviewState.cardId = null;
  cardPreviewState.trigger = null;
}

function bindCardTooltips() {
  document.addEventListener('pointerover', event => {
    const trigger = event.target.closest('[data-card-tooltip]');
    if (!trigger || trigger.contains(event.relatedTarget) || cardPreviewState.pinned) return;
    showCardTooltip(trigger);
  });
  document.addEventListener('pointerout', event => {
    const trigger = event.target.closest('[data-card-tooltip]');
    if (!trigger || trigger.contains(event.relatedTarget) || cardPreviewState.pinned) return;
    hideCardTooltip();
  });
  document.addEventListener('focusin', event => {
    const trigger = event.target.closest('[data-card-tooltip]');
    if (trigger && !cardPreviewState.pinned) showCardTooltip(trigger);
  });
  document.addEventListener('focusout', event => {
    const trigger = event.target.closest('[data-card-tooltip]');
    if (trigger && !trigger.contains(event.relatedTarget) && !cardPreviewState.pinned) hideCardTooltip();
  });
  document.addEventListener('click', event => {
    const tooltip = event.target.closest('#divine-card-tooltip');
    const ignoredControl = event.target.closest('[data-remove-card]');
    const trigger = ignoredControl ? null : event.target.closest('[data-card-tooltip]');
    if (trigger) {
      showCardTooltip(trigger, { pinned:true });
      return;
    }
    if (!tooltip && cardPreviewState.pinned) hideCardTooltip({ force:true });
  }, { capture:true });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideCardTooltip({ force:true });
  });
  window.addEventListener('resize', () => {
    const tooltip = $('#divine-card-tooltip');
    if (cardPreviewState.pinned && tooltip && !tooltip.hidden && cardPreviewState.trigger?.isConnected) {
      positionCardTooltip(cardPreviewState.trigger, tooltip);
    } else if (!cardPreviewState.pinned) hideCardTooltip();
  }, { passive:true });
  window.addEventListener('scroll', () => {
    const tooltip = $('#divine-card-tooltip');
    if (cardPreviewState.pinned && tooltip && !tooltip.hidden && cardPreviewState.trigger?.isConnected) {
      positionCardTooltip(cardPreviewState.trigger, tooltip);
    } else if (!cardPreviewState.pinned) hideCardTooltip();
  }, { passive:true, capture:true });
}

function currentHero() {
  return HEROES.find(hero => hero.id === state.heroId) || HEROES[0];
}

function roleStyle(hero) {
  return `--role-color:${ROLES[hero.role]?.color || 'var(--text-secondary)'}`;
}

function heroNameClass(name) {
  const value = String(name || '');
  const classes = ['hero-detail-name'];
  if (/\bSuper Saiyan\b/i.test(value)) classes.push('is-super-saiyan');
  if (value.length >= 26) classes.push('is-extra-long');
  else if (value.length >= 20) classes.push('is-long');
  return classes.join(' ');
}

// Visible alpha bounds for the official full-body artwork. The page uses these
// bounds to remove transparent canvas padding while keeping every visible part
// of the character inside the responsive detail-art frame.
const HERO_DETAIL_ART_BOUNDS = Object.freeze({
  '0001': [374, 43, 926, 1157],
  '0002': [421, 71, 920, 1128],
  '0003': [367, 190, 988, 1052],
  '0004': [424, 57, 962, 1143],
  '0005': [409, 24, 954, 1218],
  '0006': [508, 99, 878, 1144],
  '0007': [25, 27, 1176, 1216],
  '0008': [457, 68, 917, 1174],
  '0009': [441, 243, 914, 1000],
  '0010': [393, 139, 960, 1104],
  '0011': [312, 209, 1060, 1033],
  '0012': [250, 52, 1158, 1211],
  '0013': [320, 25, 1084, 1217],
  '0014': [380, 97, 966, 1145],
  '0015': [328, 2, 1167, 1197],
  '0016': [440, 42, 929, 1158],
  '0017': [430, 104, 928, 861],
  '0017-nikita': [430, 107, 969, 933],
  '0018': [256, 31, 922, 1211],
  '0019': [474, 71, 885, 1175],
  '0020': [464, 82, 939, 1172],
  '0021': [373, 32, 1000, 1218],
  '0022': [285, 59, 1054, 1151],
  '0023': [183, 31, 898, 1188],
  '0024': [340, 201, 1161, 1013],
  '0025': [185, 24, 1041, 1195],
  '0026': [234, 43, 931, 1177],
  '0027': [391, 34, 925, 1183],
  '0028': [237, 11, 1021, 1210],
  '0029': [346, 10, 888, 1217],
  '0030': [405, 25, 985, 1215],
  '0031': [453, 86, 886, 1129],
  '0032': [257, 21, 1035, 1199],
  '0033': [196, 2, 911, 1217],
  '0034': [383, 125, 967, 1070],
  '0035': [275, 69, 1024, 1170],
  '0036': [92, 82, 1035, 1073],
  '0037': [0, 104, 995, 1102],
  '0038': [36, 60, 913, 1000],
  '0039': [319, 4, 946, 1214],
  '0040': [292, 60, 1086, 1188],
});

let heroDetailArtResizeObserver = null;

function bindHeroDetailArtFraming(root = document) {
  heroDetailArtResizeObserver?.disconnect();
  heroDetailArtResizeObserver = null;

  const art = root.querySelector('.hero-detail-art[data-hero-id]');
  const image = art?.querySelector('img');
  const bounds = HERO_DETAIL_ART_BOUNDS[art?.dataset.artProfile || art?.dataset.heroId];
  if (!art || !image || !bounds) return;

  const resetToFallbackLayout = () => {
    art.classList.remove('is-framed');
    Object.assign(image.style, { left:'0px', top:'0px', width:'100%', height:'100%' });
  };

  const frame = () => {
    if (!art.isConnected || !image.naturalWidth || !image.naturalHeight || image.dataset.usedFallback) {
      resetToFallbackLayout();
      return;
    }
    const width = art.clientWidth;
    const height = art.clientHeight;
    if (!width || !height) return;

    const [x0, y0, x1, y1] = bounds;
    const visibleWidth = x1 - x0;
    const visibleHeight = y1 - y0;
    const topSafe = Math.max(24, height * .06);
    const bottomSafe = Math.max(10, height * .025);
    const availableHeight = Math.max(1, height - topSafe - bottomSafe);
    const scale = Math.min((width * .88) / visibleWidth, availableHeight / visibleHeight);
    const renderedWidth = image.naturalWidth * scale;
    const renderedHeight = image.naturalHeight * scale;
    const left = ((width - (visibleWidth * scale)) / 2) - (x0 * scale);
    const top = (height - bottomSafe) - (y1 * scale);

    art.classList.add('is-framed');
    Object.assign(image.style, {
      left: `${left}px`,
      top: `${top}px`,
      width: `${renderedWidth}px`,
      height: `${renderedHeight}px`,
    });
  };

  image.addEventListener('load', frame);
  if (image.complete) requestAnimationFrame(frame);
  if ('ResizeObserver' in window) {
    heroDetailArtResizeObserver = new ResizeObserver(() => requestAnimationFrame(frame));
    heroDetailArtResizeObserver.observe(art);
  } else {
    window.addEventListener('resize', frame, { passive:true, once:true });
  }
}

function bindImageFallbacks(root = document) {
  root.querySelectorAll('img[data-fallback-src]:not([data-fallback-bound])').forEach(image => {
    image.dataset.fallbackBound = '1';
    image.addEventListener('error', () => {
      const fallback = image.dataset.fallbackSrc;
      if (fallback && image.src !== new URL(fallback, location.href).href && !image.dataset.usedFallback) {
        image.dataset.usedFallback = '1';
        image.src = fallback;
      } else {
        image.hidden = true;
      }
    });
  });
}

function renderAccount() {
  const box = $('#heroes-account');
  if (!box) return;
  let languageSlot = box.querySelector('[data-language-slot]');
  if (!languageSlot) {
    const slotTemplate = document.createElement('template');
    slotTemplate.innerHTML = '<div class="gs-language-slot" data-language-slot="true"></div>';
    languageSlot = slotTemplate.content.firstElementChild;
    box.appendChild(languageSlot);
  }
  [...box.children].forEach(child => {
    if (child !== languageSlot && !child.classList.contains('gs-global-menu')) child.remove();
  });
  window.GSGlobalMenu?.mount(box);
  window.GSGlobalMenu?.refresh();
}

function filteredHeroes() {
  return HEROES.filter(hero => {
    const localizedName = heroName(hero.id, hero.name);
    return (state.role === 'all' || hero.role === state.role)
      && heroMatchesSearch(hero, state.search, localizedName, roleLabel(hero.role));
  });
}

function renderRoster() {
  const list = $('#hero-roster-list');
  const heroes = filteredHeroes();
  list.innerHTML = heroes.length ? heroes.map(hero => {
    const localizedName = heroName(hero.id, hero.name);
    const portrait = getHeroImgSp(hero.id);
    return `<button class="hero-roster-item ${hero.id === state.heroId ? 'active' : ''}" type="button" data-hero-id="${hero.id}" style="${roleStyle(hero)}">
      <span class="hero-roster-thumb">${imageWithFallback(portrait, getHeroImg(hero.id), localizedName)}</span>
      <span class="hero-roster-copy"><b>${escapeHtml(localizedName)}</b><span class="hero-roster-meta">${roleIconMarkup(hero.role, 'inline-role-icon')}<span>${hero.id}</span></span></span>
    </button>`;
  }).join('') : `<div class="empty-state"><p>${escapeHtml(t('noHeroesMatch'))}</p></div>`;
  list.querySelectorAll('[data-hero-id]').forEach(button => button.addEventListener('click', () => selectHero(button.dataset.heroId)));
  bindImageFallbacks(list);
}

function skillTypeLabel(skill) {
  const labels = { passive:'passive', rush_attack:'rushAttack', skill:'skill', super_attack:'superAttack', transformation:'transformation' };
  return t(labels[skill.type] || 'skill');
}

function skillTypeShort(skill) {
  return ({ passive:'P', rush_attack:'RA', skill:'S', super_attack:'SA', transformation:'T' })[skill?.type] || 'S';
}


function skillIconMarkup(hero, skill, className = '') {
  const urls = getHeroSkillIconUrls(hero.id, skill.id);
  return `<span class="hero-skill-icon ${className}" data-skill-icon-wrap><img src="${escapeHtml(urls.primary)}" data-fallback-src="${escapeHtml(urls.fallback)}" alt="${escapeHtml(skill.name)}"><span class="hero-skill-icon-fallback">${escapeHtml(skillTypeShort(skill))}</span></span>`;
}

function bindSkillIconFallbacks(root = document) {
  root.querySelectorAll('[data-skill-icon-wrap]:not([data-skill-icon-bound])').forEach(wrapper => {
    wrapper.dataset.skillIconBound = '1';
    const image = wrapper.querySelector('img');
    if (!image) return;
    image.addEventListener('error', () => {
      const fallback = image.dataset.fallbackSrc;
      if (fallback && !image.dataset.usedFallback) {
        image.dataset.usedFallback = '1';
        image.src = fallback;
        return;
      }
      image.hidden = true;
      wrapper.classList.add('fallback-only');
    });
  });
}

function radarChartMarkup(detail, hero, localizedName = heroName(hero.id, hero.name)) {
  if (!detail?.statsPath) return `<div class="hero-radar-empty">${escapeHtml(t('noStatProfile'))}</div>`;
  return `<svg class="hero-radar-svg" viewBox="-40 -20 280 240" role="img" aria-label="${escapeHtml(localizedName)} stat radar chart">
    <g class="hero-radar-grid">
      <polygon points="100,0 178.2,37.7 197.5,122.3 143.4,190.1 56.6,190.1 2.5,122.3 21.8,37.7"></polygon>
      <polygon points="100,20 162.5,50.1 178,117.8 134.7,172.1 65.3,172.1 22,117.8 37.5,50.1"></polygon>
      <polygon points="100,40 146.9,62.6 158.5,113.4 126,154.1 74,154.1 41.5,113.4 53.1,62.6"></polygon>
      <polygon points="100,60 131.3,75.1 139,108.9 117.4,136 82.6,136 61,108.9 68.7,75.1"></polygon>
      <line x1="100" y1="100" x2="100" y2="0"></line><line x1="100" y1="100" x2="178.2" y2="37.7"></line><line x1="100" y1="100" x2="197.5" y2="122.3"></line><line x1="100" y1="100" x2="143.4" y2="190.1"></line><line x1="100" y1="100" x2="56.6" y2="190.1"></line><line x1="100" y1="100" x2="2.5" y2="122.3"></line><line x1="100" y1="100" x2="21.8" y2="37.7"></line>
    </g>
    <path class="hero-radar-value" d="${escapeHtml(detail.statsPath)}"></path>
    <g class="hero-radar-labels"><text x="100" y="-7">${escapeHtml(t('burstDamage'))}</text><text x="188" y="31" text-anchor="start">${escapeHtml(t('sustainedDamage'))}</text><text x="205" y="127" text-anchor="start">${escapeHtml(t('range'))}</text><text x="151" y="207">${escapeHtml(t('support'))}</text><text x="49" y="207">${escapeHtml(t('mobility'))}</text><text x="-7" y="127" text-anchor="end">${escapeHtml(t('energyRes'))}</text><text x="12" y="31" text-anchor="end">${escapeHtml(t('strikeRes'))}</text></g>
  </svg>`;
}

function heroPresets(heroId) {
  return state.publicPresets
    .filter(preset => preset.heroAssignments.some(item => item.heroId === heroId))
    .sort((a, b) => Number(b.heroAssignments.find(item => item.heroId === heroId)?.isDefault) - Number(a.heroAssignments.find(item => item.heroId === heroId)?.isDefault) || a.name.localeCompare(b.name));
}

function renderBuildCards(preset) {
  return [1,2,3].map(slot => {
    const item = preset.slots.find(entry => entry.slot === slot);
    const alternates = (preset.swapOptions || [])
      .filter(entry => entry.slot === slot)
      .sort((a, b) => a.priority - b.priority);
    const optionNumbers = [slot + 3, slot + 6];
    if (!item) return `<article class="divine-build-lane"><span class="divine-slot-label">Slot ${slot}</span><div class="divine-build-card empty"><b>Empty starting card</b></div></article>`;

    const optionMarkup = [1, 2].map(priority => {
      const alternate = alternates.find(entry => Number(entry.priority) === priority);
      const cardNumber = optionNumbers[priority - 1];
      return alternate
        ? `<figure class="divine-build-pair-card is-situation priority-${priority}" tabindex="0" ${cardTooltipAttributes(alternate.card)} aria-label="${escapeHtml(cardTooltipLabel(alternate.card))}"><span>SITUATION CARD ${cardNumber}</span><img src="${escapeHtml(alternate.card.imagePath)}" alt="${escapeHtml(alternate.card.name)}"></figure>`
        : `<div class="divine-build-pair-card is-empty"><span>SITUATION CARD ${cardNumber}</span><b>OPTIONAL</b><small>No card selected</small></div>`;
    }).join('');

    return `<article class="divine-build-lane card-type-${escapeHtml(item.card.cardType || 'unassigned')}">
      <header><span class="divine-slot-label">SLOT ${slot}</span><small>Core Card ${slot} · optional Cards ${slot + 3} and ${slot + 6}</small></header>
      <div class="divine-build-pair divine-build-triple">
        <figure class="divine-build-pair-card is-core" tabindex="0" ${cardTooltipAttributes(item.card)} aria-label="${escapeHtml(cardTooltipLabel(item.card))}"><span>CORE · CARD ${slot}</span><img src="${escapeHtml(item.card.imagePath)}" alt="${escapeHtml(item.card.name)}"></figure>
        <div class="divine-build-pair-arrow" aria-hidden="true">→</div>
        ${optionMarkup}
      </div>
    </article>`;
  }).join('');
}

function renderHeroDetail() {
  hideCardTooltip();
  const hero = currentHero();
  if (!hero) return;
  const sourceDetail = HEROES_DATA[hero.id] || {};
  const detail = localizeHeroDetail(hero, sourceDetail);
  const localizedName = detail.name || heroName(hero.id, hero.name);
  const presets = heroPresets(hero.id);
  if (!presets.some(preset => preset.id === state.activeBuildId)) state.activeBuildId = presets[0]?.id || null;
  const activePreset = presets.find(preset => preset.id === state.activeBuildId) || presets[0];
  const skills = Array.isArray(detail.skills) ? detail.skills : [];
  state.activeSkillIndex = Math.min(Math.max(0, state.activeSkillIndex), Math.max(0, skills.length - 1));
  const activeSkill = skills[state.activeSkillIndex] || skills[0];
  const difficultyValue = Number(detail.difficulty);
  const difficulty = Number.isFinite(difficultyValue) ? `${difficultyValue}/100` : t('notRated');
  const difficultyWidth = Number.isFinite(difficultyValue) ? Math.max(0, Math.min(100, difficultyValue)) : 0;
  const easterEgg = hero.id === '0017' && isNikitaEasterEggSearch(state.search);
  const displayName = getHeroDisplayName(hero.id, localizedName, state.search);
  const description = getHeroDisplayDescription(hero.id, detail.description || t('detailUnavailable'), state.search, getLocale());
  const heroArt = getHeroDisplayImage(hero.id, state.search, 'full');

  $('#hero-detail-panel').innerHTML = `
    <section class="hero-detail-hero" style="${roleStyle(hero)}">
      <div class="hero-detail-art ${easterEgg ? 'is-nikita-easter-egg' : ''}" data-hero-id="${escapeHtml(hero.id)}" data-art-profile="${easterEgg ? '0017-nikita' : escapeHtml(hero.id)}">${imageWithFallback(heroArt, getHeroImg(hero.id), localizedName)}</div>
      <div class="hero-detail-copy">
        <div class="hero-detail-identity">
          <span class="hero-detail-tag role">${roleIconMarkup(hero.role, 'inline-role-icon')} ${escapeHtml(detail.roleLabel || roleLabel(hero.role))}</span>
          <span class="hero-detail-tag">${escapeHtml(t('heroId', { id: hero.id }))}</span>
        </div>
        <h2 class="${heroNameClass(displayName)}">${escapeHtml(displayName)}</h2><p>${escapeHtml(description).replace(/\n/g, '<br>')}</p>
        <div class="hero-difficulty" aria-label="${escapeHtml(t('difficulty'))} ${escapeHtml(difficulty)}">
          <div class="hero-difficulty-head"><span>${escapeHtml(t('difficulty'))}</span><b>${escapeHtml(difficulty)}</b></div>
          <div class="hero-difficulty-track"><span style="width:${difficultyWidth}%"></span></div>
        </div>
      </div>
      <aside class="hero-stat-radar"><span class="content-kicker">${escapeHtml(t('combatProfile'))}</span>${radarChartMarkup(detail, hero, localizedName)}</aside>
    </section>
    <div class="hero-detail-content">
      <section>
        <div class="hero-detail-section-head"><div><span class="content-kicker">${escapeHtml(t('abilityData'))}</span><h3>${escapeHtml(t('skills'))}</h3></div><p>${escapeHtml(t('entriesFromDb', { count: skills.length }))}</p></div>
        ${skills.length ? `<div class="hero-skill-browser">
          <div class="hero-skill-icon-rail" role="tablist" aria-label="${escapeHtml(localizedName)} ${escapeHtml(t('skills'))}">
            ${skills.map((skill, index) => `<button type="button" role="tab" aria-selected="${index === state.activeSkillIndex}" class="hero-skill-icon-button ${index === state.activeSkillIndex ? 'active' : ''}" data-skill-index="${index}" title="${escapeHtml(skill.name)}">${skillIconMarkup(hero, skill)}<span>${escapeHtml(skillTypeShort(skill))}</span></button>`).join('')}
          </div>
          <article class="hero-active-skill" style="${roleStyle(hero)}">
            <div class="hero-active-skill-icon">${skillIconMarkup(hero, activeSkill, 'large')}</div>
            <div><header><span class="hero-skill-type">${escapeHtml(skillTypeLabel(activeSkill))}</span><h4>${escapeHtml(activeSkill.name)}</h4></header><p>${escapeHtml(activeSkill.desc)}</p></div>
          </article>
          <div class="hero-skills-grid">${skills.map((skill, index) => `<button type="button" class="hero-skill-card ${index === state.activeSkillIndex ? 'active' : ''}" data-skill-index="${index}" style="${roleStyle(hero)}"><span class="hero-skill-card-icon">${skillIconMarkup(hero, skill)}</span><span class="hero-skill-card-copy"><span class="hero-skill-type">${escapeHtml(skillTypeLabel(skill))}</span><b>${escapeHtml(skill.name)}</b><small>${escapeHtml(skill.desc)}</small></span></button>`).join('')}</div>
        </div>` : `<div class="empty-state"><p>${escapeHtml(t('noSkillData'))}</p></div>`}
      </section>
      <section>
        <div class="hero-detail-section-head"><div><span class="content-kicker">${escapeHtml(t('recommendedLoadout'))}</span><h3>${escapeHtml(t('divineCardBuilds'))}</h3></div><p>${escapeHtml(t('loadoutHint'))}</p></div>
        ${presets.length ? `<div class="hero-build-tabs">${presets.map(preset => `<button type="button" class="${preset.id === activePreset?.id ? 'active' : ''}" data-build-id="${preset.id}"><span>${escapeHtml(preset.scenario || 'General')}</span>${escapeHtml(preset.name)}${preset.heroAssignments.find(item => item.heroId === hero.id)?.isDefault ? ' · DEFAULT' : ''}</button>`).join('')}</div>
          <div class="hero-build-summary"><div class="hero-build-meta"><div><span class="build-scenario">${escapeHtml(activePreset.scenario || 'GENERAL BUILD')}</span><h4>${escapeHtml(activePreset.name)}</h4><p>${escapeHtml(activePreset.description || 'No preset description.')}</p></div><div class="energy-rule"><span>Full gauge ${activePreset.energyThreshold}</span><span>Gain ×${activePreset.energyRate}</span></div></div>
          <div class="card-swap-rule"><b>CARD CHANGE RULE</b><span>Equip Cards 1–3 first.</span><span>At a full gauge, change exactly 1 Slot to an assigned Card 4–9 option from the same Slot.</span><span>After the change, the gauge resets to 0 and must fill again.</span></div>
          <div class="hero-build-cards">${renderBuildCards(activePreset)}</div></div>` : '<div class="empty-state"><h4>No recommended build yet</h4><p>The Admin has not assigned a Divine Card preset to this hero.</p></div>'}
      </section>
    </div>`;
  $('#hero-detail-panel').querySelectorAll('[data-build-id]').forEach(button => button.addEventListener('click', () => { state.activeBuildId = Number(button.dataset.buildId); renderHeroDetail(); }));
  $('#hero-detail-panel').querySelectorAll('[data-skill-index]').forEach(button => button.addEventListener('click', () => {
    const nextIndex = Number(button.dataset.skillIndex);
    if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= skills.length || nextIndex === state.activeSkillIndex) return;
    state.activeSkillIndex = nextIndex;
    renderHeroDetail();
  }));
  bindImageFallbacks($('#hero-detail-panel'));
  bindHeroDetailArtFraming($('#hero-detail-panel'));
  bindSkillIconFallbacks($('#hero-detail-panel'));
}

function renderPublicLibrary() {
  hideCardTooltip();
  const library = $('#divine-public-library');
  const cards = orderedCards(state.publicCards);
  if (!cards.length) {
    library.innerHTML = '<div class="empty-state"><p>Card names and Slot pools have not been cataloged yet.</p></div>';
    return;
  }
  library.innerHTML = [1,2,3].map(slot => {
    const slotCards = cards.filter(card => card.slotPool === slot);
    return `<section class="divine-library-row"><header><span>Slot ${slot}</span><small>Attack · Defense · Technical</small></header><div class="divine-library-row-cards">${slotCards.map(card => `<article class="divine-library-card card-type-${escapeHtml(card.cardType || 'unassigned')}" tabindex="0" ${cardTooltipAttributes(card)} aria-label="${escapeHtml(cardTooltipLabel(card))}"><img src="${escapeHtml(card.imagePath)}" alt="${escapeHtml(card.name)}" loading="lazy"><span class="divine-library-card-type">${escapeHtml(cardTypeLabel(card))}</span></article>`).join('')}</div></section>`;
  }).join('');
}

function selectHero(heroId) {
  if (!HEROES.some(hero => hero.id === heroId)) return;
  state.heroId = heroId;
  state.activeBuildId = null;
  state.activeSkillIndex = 0;
  const url = new URL(location.href);
  url.searchParams.set('id', heroId);
  history.replaceState(null, '', `${url.pathname}${url.search}`);
  renderRoster();
  renderHeroDetail();
}

async function loadPublicBuilds() {
  try {
    const payload = await api(`/api/public/divine-card-builds?locale=${encodeURIComponent(getLocale())}`);
    state.publicCards = payload.cards || [];
    state.publicPresets = payload.presets || [];
  } catch (error) {
    console.error(error);
    state.publicCards = [];
    state.publicPresets = [];
  }
  renderHeroDetail();
  renderPublicLibrary();
}

function adminMessage(element, message, type = '') {
  if (!element) return;
  element.textContent = message;
  element.className = `form-message ${type}`.trim();
}

async function loadAdminBuilds() {
  const payload = await api(`/api/admin/divine-card-builds?locale=${encodeURIComponent(getLocale())}`);
  state.adminCards = payload.cards || [];
  state.adminPresets = payload.presets || [];
  state.adminLoaded = true;
  renderCatalog();
  renderPresetAdmin();
  renderAssignmentAdmin();
}

function renderCatalog() {
  const grid = $('#card-catalog-grid');
  if (!grid) return;
  const cards = orderedCards(state.adminCards);
  const sections = [1,2,3,null].map(slot => {
    const slotCards = cards.filter(card => slot === null ? card.slotPool == null : card.slotPool === slot);
    if (!slotCards.length) return '';
    const heading = slot === null ? 'Unassigned cards' : `Slot ${slot}`;
    return `<section class="catalog-slot-group"><header><h4>${heading}</h4><small>${slot === null ? 'Finish cataloging before using these cards' : 'Attack · Defense · Technical'}</small></header><div class="catalog-slot-cards">${slotCards.map(card => `<article class="catalog-card ${!card.name || !card.slotPool || !card.cardType ? 'uncataloged' : ''}" data-card-id="${escapeHtml(card.id)}">
      <img src="${escapeHtml(card.imagePath)}" alt="${escapeHtml(card.name || 'Divine Card')}">
      <div class="catalog-card-fields">
        <input data-card-field="name" value="${escapeHtml(card.name)}" maxlength="120" placeholder="Card name" aria-label="Card name">
        <div class="catalog-card-classification">
          <select data-card-field="slotPool" aria-label="Slot pool"><option value="" ${card.slotPool == null ? 'selected' : ''}>Unassigned Slot</option><option value="1" ${card.slotPool === 1 ? 'selected' : ''}>Slot 1 pool</option><option value="2" ${card.slotPool === 2 ? 'selected' : ''}>Slot 2 pool</option><option value="3" ${card.slotPool === 3 ? 'selected' : ''}>Slot 3 pool</option></select>
          <select data-card-field="cardType" aria-label="Card type"><option value="" ${!card.cardType ? 'selected' : ''}>Unassigned Type</option><option value="attack" ${card.cardType === 'attack' ? 'selected' : ''}>Attack · Red</option><option value="defense" ${card.cardType === 'defense' ? 'selected' : ''}>Defense · Green</option><option value="technical" ${card.cardType === 'technical' ? 'selected' : ''}>Technical · Blue</option></select>
        </div>
        <label><span>Effect</span><textarea data-card-field="effect" rows="4" maxlength="3000" placeholder="Card effect">${escapeHtml(card.effect || card.description || '')}</textarea></label>
        <label><span>Note / activation</span><textarea data-card-field="note" rows="4" maxlength="3000" placeholder="Activation condition, cooldown, limits…">${escapeHtml(card.note || '')}</textarea></label>
        <div class="catalog-card-status"><label><input type="checkbox" data-card-field="isActive" ${card.isActive ? 'checked' : ''}> Active</label><button class="btn btn-primary btn-xs" type="button" data-save-card>SAVE</button></div><span class="form-message" data-card-message></span>
      </div></article>`).join('')}</div></section>`;
  }).join('');
  grid.innerHTML = sections || '<div class="empty-state"><p>No Divine Card images found.</p></div>';
  grid.querySelectorAll('[data-save-card]').forEach(button => button.addEventListener('click', async () => {
    const cardEl = button.closest('[data-card-id]');
    const message = cardEl.querySelector('[data-card-message]');
    button.disabled = true;
    adminMessage(message, 'Saving…');
    try {
      await api(`/api/admin/divine-cards/${encodeURIComponent(cardEl.dataset.cardId)}`, { method:'PUT', body:{
        name: cardEl.querySelector('[data-card-field="name"]').value,
        effect: cardEl.querySelector('[data-card-field="effect"]').value,
        note: cardEl.querySelector('[data-card-field="note"]').value,
        cardType: cardEl.querySelector('[data-card-field="cardType"]').value,
        slotPool: cardEl.querySelector('[data-card-field="slotPool"]').value || null,
        isActive: cardEl.querySelector('[data-card-field="isActive"]').checked,
        locale: getLocale(),
      }});
      adminMessage(message, 'Saved.', 'success');
      await refreshAllBuildData({ preserveTab:true });
    } catch (error) { adminMessage(message, error.message, 'error'); }
    finally { button.disabled = false; }
  }));
}

function resetBuilder(preset = null) {
  const form = $('#preset-builder');
  state.builderPresetId = preset?.id || null;
  state.builderSlots = { 1:null, 2:null, 3:null };
  state.builderSwaps = { 1:[null, null], 2:[null, null], 3:[null, null] };
  state.builderTarget = { slot:1, kind:'start' };
  if (preset) {
    preset.slots.forEach(item => { state.builderSlots[item.slot] = item.card.id; });
    if (preset.situationalSlots && typeof preset.situationalSlots === 'object') {
      for (const position of SITUATIONAL_POSITIONS) {
        const cardId = preset.situationalSlots[String(position.cardNumber)] || null;
        state.builderSwaps[position.slot][position.priority - 1] = cardId;
      }
    } else {
      (preset.swapOptions || []).sort((a,b) => a.priority - b.priority).forEach(item => {
        const priority = Number(item.priority);
        if ([1, 2].includes(priority)) state.builderSwaps[item.slot][priority - 1] = item.card.id;
      });
    }
  }
  state.builderInspectCardId = preset?.slots?.[0]?.card?.id || state.builderInspectCardId;
  form.elements.presetId.value = preset?.id || '';
  form.elements.name.value = preset?.name || '';
  form.elements.description.value = preset?.description || '';
  form.elements.scenario.value = preset?.scenario || '';
  form.elements.energyThreshold.value = preset?.energyThreshold || 100;
  form.elements.energyRate.value = preset?.energyRate || 1;
  $('#delete-preset').classList.toggle('hidden', !preset);
  renderPresetAdmin();
}

function renderPresetList() {
  const list = $('#preset-admin-list');
  list.innerHTML = state.adminPresets.length ? state.adminPresets.map(preset => `<button class="preset-list-item ${preset.id === state.builderPresetId ? 'active' : ''}" type="button" data-preset-id="${preset.id}"><span>${escapeHtml(preset.scenario || 'General')}</span><b>${escapeHtml(preset.name)}</b><small>${preset.heroAssignments.length} hero assignment${preset.heroAssignments.length === 1 ? '' : 's'} · ${Math.min(6, (preset.swapOptions || []).length)}/6 situational cards</small></button>`).join('') : '<div class="empty-state"><p>No presets yet.</p></div>';
  list.querySelectorAll('[data-preset-id]').forEach(button => button.addEventListener('click', () => resetBuilder(state.adminPresets.find(preset => preset.id === Number(button.dataset.presetId)))));
}

function renderPresetInspector() {
  const inspector = $('#preset-card-inspector');
  if (!inspector) return;
  const fallbackId = state.builderSlots[1] || state.builderSlots[2] || state.builderSlots[3] || orderedCards(state.adminCards).find(card => card.isActive && card.name && card.slotPool)?.id;
  const card = state.adminCards.find(item => item.id === (state.builderInspectCardId || fallbackId));
  if (!card) {
    inspector.innerHTML = '<div class="empty-state"><p>Select a card to inspect its Effect and activation Note.</p></div>';
    return;
  }
  state.builderInspectCardId = card.id;
  inspector.innerHTML = `<div class="preset-inspector-art card-type-${escapeHtml(card.cardType || 'unassigned')}"><img src="${escapeHtml(card.imagePath)}" alt="${escapeHtml(card.name)}"><span>${card.slotPool ? `Slot ${card.slotPool}` : 'Unassigned'} · ${escapeHtml(cardTypeLabel(card))}</span></div>
    <div class="preset-inspector-copy"><h3>${escapeHtml(card.name)}</h3><div class="preset-inspector-section"><b>${escapeHtml(t('effect'))}</b><p>${escapeHtml(card.effect || card.description || t('noEffect'))}</p></div><div class="preset-inspector-section"><b>${escapeHtml(t('noteConditions'))}</b><p>${escapeHtml(card.note || 'No activation note recorded.')}</p></div></div>`;
}

function renderPresetBoard() {
  hideCardTooltip();
  const board = $('#preset-game-board');
  if (!board) return;
  const cards = orderedCards(state.adminCards.filter(card => card.isActive && card.name && card.slotPool));
  if (!cards.length) {
    board.innerHTML = '<div class="empty-state"><p>Catalog card names, types, and Slot pools first.</p></div>';
    return;
  }

  const targetMeta = (slot, kind) => {
    if (kind === 'start') return { cardNumber:slot, label:'CORE', index:null };
    const priority = kind === 'alternate2' ? 2 : 1;
    return { cardNumber:slot + (priority * 3), label:'SITUATION', index:priority - 1 };
  };
  const targetMarkup = (card, slot, kind) => {
    const meta = targetMeta(slot, kind);
    const armed = state.builderTarget.slot === slot && state.builderTarget.kind === kind;
    return `<div class="preset-loadout-target ${card ? 'filled' : ''} ${armed ? 'armed' : ''}" data-card-target data-target-slot="${slot}" data-target-kind="${kind}" tabindex="0" role="button" ${card ? cardTooltipAttributes(card) : ''} aria-label="${card ? escapeHtml(`${meta.label} Card ${meta.cardNumber}: ${card.name}. Hover or focus for details.`) : `Choose Card ${meta.cardNumber}`}">
      <span class="preset-loadout-target-label">${meta.label} · CARD ${meta.cardNumber}</span>
      ${card ? `<img src="${escapeHtml(card.imagePath)}" alt="${escapeHtml(card.name)}"><button type="button" data-remove-card data-remove-slot="${slot}" data-remove-kind="${kind}" aria-label="Remove ${escapeHtml(card.name)}">REMOVE</button>` : `<div class="preset-empty-card"><strong>${meta.cardNumber}</strong><small>${kind === 'start' ? 'Required starting card' : 'Optional situation card'}</small></div>`}
    </div>`;
  };

  board.innerHTML = [1,2,3].map(slot => {
    const core = state.adminCards.find(card => card.id === state.builderSlots[slot]);
    const alternateOneId = state.builderSwaps[slot]?.[0] || null;
    const alternateTwoId = state.builderSwaps[slot]?.[1] || null;
    const alternateOne = state.adminCards.find(card => card.id === alternateOneId);
    const alternateTwo = state.adminCards.find(card => card.id === alternateTwoId);
    const slotCards = cards.filter(card => card.slotPool === slot);
    return `<section class="preset-slot-row" data-slot-row="${slot}">
      <div class="preset-loadout-pair preset-loadout-triple">
        ${targetMarkup(core, slot, 'start')}
        <div class="preset-loadout-arrow" aria-hidden="true">→</div>
        ${targetMarkup(alternateOne, slot, 'alternate1')}
        <div class="preset-loadout-arrow" aria-hidden="true">/</div>
        ${targetMarkup(alternateTwo, slot, 'alternate2')}
      </div>
      <div class="preset-slot-options" aria-label="Slot ${slot} cards">${slotCards.map(card => {
        const isCore = state.builderSlots[slot] === card.id;
        const alternateIndex = state.builderSwaps[slot]?.findIndex(id => id === card.id) ?? -1;
        const alternateNumber = alternateIndex >= 0 ? slot + ((alternateIndex + 1) * 3) : null;
        return `<button class="preset-game-card card-type-${escapeHtml(card.cardType || 'unassigned')} ${isCore ? 'is-core' : ''} ${alternateIndex >= 0 ? `is-alternate priority-${alternateIndex + 1}` : ''}" type="button" draggable="true" data-source-card="${escapeHtml(card.id)}" data-card-slot="${slot}" ${cardTooltipAttributes(card)} aria-label="${escapeHtml(cardTooltipLabel(card))}"><img src="${escapeHtml(card.imagePath)}" alt="${escapeHtml(card.name)}"><span class="preset-card-state">${isCore ? `CARD ${slot}` : alternateNumber ? `CARD ${alternateNumber}` : ''}</span></button>`;
      }).join('')}</div>
    </section>`;
  }).join('');

  board.querySelectorAll('[data-card-target]').forEach(target => {
    const arm = () => {
      state.builderTarget = { slot:Number(target.dataset.targetSlot), kind:target.dataset.targetKind };
      renderPresetBoard();
    };
    target.addEventListener('click', event => { if (!event.target.closest('[data-remove-card]')) arm(); });
    target.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); arm(); } });
    target.addEventListener('dragover', event => { event.preventDefault(); target.classList.add('drag-over'); });
    target.addEventListener('dragleave', () => target.classList.remove('drag-over'));
    target.addEventListener('drop', event => {
      event.preventDefault();
      target.classList.remove('drag-over');
      placeCard(event.dataTransfer.getData('text/divine-card-id'), Number(target.dataset.targetSlot), target.dataset.targetKind);
    });
  });

  board.querySelectorAll('[data-source-card]').forEach(cardEl => {
    const showDetails = () => { state.builderInspectCardId = cardEl.dataset.sourceCard; renderPresetInspector(); };
    cardEl.addEventListener('mouseenter', showDetails);
    cardEl.addEventListener('focus', showDetails);
    cardEl.addEventListener('dragstart', event => {
      state.builderInspectCardId = cardEl.dataset.sourceCard;
      renderPresetInspector();
      event.dataTransfer.setData('text/divine-card-id', cardEl.dataset.sourceCard);
      event.dataTransfer.effectAllowed = 'copy';
    });
    cardEl.addEventListener('click', () => {
      const slot = Number(cardEl.dataset.cardSlot);
      let target = state.builderTarget.slot === slot ? state.builderTarget : null;
      if (!target) {
        const firstEmptyAlternate = state.builderSwaps[slot]?.[0] ? 'alternate2' : 'alternate1';
        target = { slot, kind:state.builderSlots[slot] ? firstEmptyAlternate : 'start' };
      }
      placeCard(cardEl.dataset.sourceCard, slot, target.kind);
    });
  });

  board.querySelectorAll('[data-remove-card]').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    const slot = Number(button.dataset.removeSlot);
    const kind = button.dataset.removeKind;
    if (kind === 'start') state.builderSlots[slot] = null;
    else state.builderSwaps[slot][kind === 'alternate2' ? 1 : 0] = null;
    renderPresetAdmin();
  }));
}

function placeCard(cardId, slot, kind = 'start') {
  const card = state.adminCards.find(item => item.id === cardId);
  if (!card || !card.isActive || !card.name || card.slotPool !== slot) {
    adminMessage($('#preset-builder [data-preset-message]'), `This card does not belong to Slot ${slot}.`, 'error');
    return;
  }

  if (kind === 'alternate1' || kind === 'alternate2') {
    const priority = kind === 'alternate2' ? 2 : 1;
    const targetIndex = priority - 1;
    const cardNumber = slot + (priority * 3);
    if (state.builderSlots[slot] === cardId) {
      adminMessage($('#preset-builder [data-preset-message]'), `Card ${cardNumber} must be different from core Card ${slot}.`, 'error');
      return;
    }
    const duplicateIndex = state.builderSwaps[slot].findIndex((id, index) => index !== targetIndex && id === cardId);
    if (duplicateIndex >= 0) {
      adminMessage($('#preset-builder [data-preset-message]'), `${card.name} is already selected as Card ${slot + ((duplicateIndex + 1) * 3)}.`, 'error');
      return;
    }
    state.builderSwaps[slot][targetIndex] = cardId;
  } else {
    state.builderSlots[slot] = cardId;
    state.builderSwaps[slot] = [0, 1].map(index => state.builderSwaps[slot]?.[index] === cardId ? null : (state.builderSwaps[slot]?.[index] || null));
  }
  state.builderTarget = { slot, kind };
  state.builderInspectCardId = cardId;
  adminMessage($('#preset-builder [data-preset-message]'), '');
  renderPresetAdmin();
}

function renderPresetAdmin() {
  if (!state.adminLoaded) return;
  renderPresetList();
  renderPresetInspector();
  renderPresetBoard();
}

function updateAssignmentActionState(assignments = null) {
  const selectedCount = state.assignmentSelected.size;
  const assignButton = $('#assign-preset');
  const removeButton = $('#unassign-preset');
  if (assignButton) assignButton.disabled = selectedCount === 0 || state.adminPresets.length === 0;
  if (removeButton) {
    const selectedPreset = state.adminPresets.find(preset => preset.id === Number($('#assignment-preset')?.value));
    const assignedIds = assignments || new Map((selectedPreset?.heroAssignments || []).map(item => [item.heroId, item]));
    const removableCount = [...state.assignmentSelected].filter(heroId => assignedIds.has(heroId)).length;
    removeButton.disabled = removableCount === 0;
    removeButton.textContent = removableCount > 0 ? `REMOVE FROM SELECTED (${removableCount})` : 'REMOVE FROM SELECTED';
  }
}

async function updatePresetAssignments(action, heroIds, { clearSelection = true } = {}) {
  const presetId = Number($('#assignment-preset').value);
  const selectedPreset = state.adminPresets.find(preset => preset.id === presetId);
  const uniqueHeroIds = [...new Set((heroIds || []).filter(Boolean))];
  const message = $('#assignment-message');
  if (!presetId || !selectedPreset) {
    adminMessage(message, 'Choose a preset first.', 'error');
    return false;
  }
  if (!uniqueHeroIds.length) {
    adminMessage(message, action === 'unassign' ? 'Choose at least one assigned hero to remove.' : 'Choose at least one hero.', 'error');
    return false;
  }
  try {
    adminMessage(message, action === 'unassign' ? 'Removing…' : 'Assigning…');
    await api('/api/admin/divine-card-assignments', {
      method:'POST',
      body:{
        presetId,
        heroIds:uniqueHeroIds,
        action,
        makeDefault:action === 'assign' && $('#assignment-default').checked,
      },
    });
    adminMessage(message, action === 'unassign'
      ? `Preset removed from ${uniqueHeroIds.length} hero${uniqueHeroIds.length === 1 ? '' : 'es'}.`
      : `Preset assigned to ${uniqueHeroIds.length} hero${uniqueHeroIds.length === 1 ? '' : 'es'}.`, 'success');
    if (clearSelection) state.assignmentSelected.clear();
    else uniqueHeroIds.forEach(heroId => state.assignmentSelected.delete(heroId));
    await refreshAllBuildData({ preserveTab:true });
    return true;
  } catch (error) {
    adminMessage(message, error.message, 'error');
    return false;
  }
}

function renderAssignmentAdmin() {
  const select = $('#assignment-preset');
  const current = Number(select.value) || state.adminPresets[0]?.id || 0;
  select.innerHTML = state.adminPresets.length ? state.adminPresets.map(preset => `<option value="${preset.id}" ${preset.id === current ? 'selected' : ''}>${escapeHtml(preset.scenario ? `${preset.scenario} · ${preset.name}` : preset.name)}</option>`).join('') : '<option value="">No presets available</option>';
  const selectedPreset = state.adminPresets.find(preset => preset.id === Number(select.value));
  const assignments = new Map((selectedPreset?.heroAssignments || []).map(item => [item.heroId, item]));
  const term = state.assignmentSearch.trim().toLowerCase();
  const heroes = HEROES.filter(hero => (state.assignmentRole === 'all' || hero.role === state.assignmentRole) && heroMatchesSearch(hero, term, heroName(hero.id, hero.name), roleLabel(hero.role)));
  const grid = $('#assignment-hero-grid');
  grid.innerHTML = heroes.length ? heroes.map(hero => {
    const assigned = assignments.get(hero.id);
    const buildCount = state.adminPresets.filter(preset => preset.heroAssignments.some(item => item.heroId === hero.id)).length;
    return `<div class="assignment-hero-card ${assigned ? 'assigned' : ''} ${assigned?.isDefault ? 'default' : ''}" style="${roleStyle(hero)}">
      <label class="assignment-hero-select">
        <input type="checkbox" value="${hero.id}" ${state.assignmentSelected.has(hero.id) ? 'checked' : ''}>
        <span class="assignment-role-mark">${roleIconMarkup(hero.role, 'inline-role-icon')}</span>
        <span class="assignment-hero-copy"><b>${escapeHtml(heroName(hero.id, hero.name))}</b><small>${escapeHtml(roleLabel(hero.role))} · ${buildCount} build${buildCount === 1 ? '' : 's'}${assigned ? assigned.isDefault ? ' · Default here' : ' · Assigned here' : ''}</small></span>
      </label>
      ${assigned ? `<button class="assignment-remove-one" type="button" data-unassign-hero="${hero.id}" aria-label="Remove ${escapeHtml(selectedPreset.name)} from ${escapeHtml(heroName(hero.id, hero.name))}">REMOVE</button>` : ''}
    </div>`;
  }).join('') : `<div class="empty-state"><p>${escapeHtml(t('noHeroesFilter'))}</p></div>`;
  $('#assignment-visible-count').textContent = `${heroes.length} SHOWN · ${state.assignmentSelected.size} SELECTED`;
  $('#assignment-role-filters').querySelectorAll('[data-assignment-role]').forEach(button => button.classList.toggle('active', button.dataset.assignmentRole === state.assignmentRole));
  grid.querySelectorAll('input[type="checkbox"]').forEach(input => input.addEventListener('change', () => {
    if (input.checked) state.assignmentSelected.add(input.value); else state.assignmentSelected.delete(input.value);
    $('#assignment-visible-count').textContent = `${heroes.length} SHOWN · ${state.assignmentSelected.size} SELECTED`;
    updateAssignmentActionState(assignments);
  }));
  grid.querySelectorAll('[data-unassign-hero]').forEach(button => button.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();
    const heroId = button.dataset.unassignHero;
    const hero = HEROES.find(item => item.id === heroId);
    if (!selectedPreset || !hero) return;
    if (!confirm(`Remove “${selectedPreset.name}” from ${heroName(hero.id, hero.name)}?`)) return;
    await updatePresetAssignments('unassign', [heroId], { clearSelection:false });
  }));
  updateAssignmentActionState(assignments);
}

async function refreshAllBuildData({ preserveTab = false, preserveScroll = true } = {}) {
  const currentTab = preserveTab ? document.querySelector('[data-admin-tab].active')?.dataset.adminTab : null;
  const scrollSnapshot = preserveScroll ? captureAdminScroll() : null;
  await Promise.all([loadPublicBuilds(), loadAdminBuilds()]);
  if (currentTab) switchAdminTab(currentTab);
  restoreAdminScroll(scrollSnapshot);
}

function switchAdminTab(tab) {
  document.querySelectorAll('[data-admin-tab]').forEach(button => button.classList.toggle('active', button.dataset.adminTab === tab));
  document.querySelectorAll('[data-admin-pane]').forEach(pane => pane.classList.toggle('active', pane.dataset.adminPane === tab));
}

function openAdmin() {
  $('#build-admin-backdrop').classList.remove('hidden');
  $('#build-admin-drawer').classList.remove('hidden');
  $('#build-admin-drawer').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  if (!state.adminLoaded) loadAdminBuilds().catch(error => alert(error.message));
}

function closeAdmin() {
  $('#build-admin-backdrop').classList.add('hidden');
  $('#build-admin-drawer').classList.add('hidden');
  $('#build-admin-drawer').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function bindAdminEvents() {
  $('#open-build-admin').addEventListener('click', openAdmin);
  $('#close-build-admin').addEventListener('click', closeAdmin);
  $('#build-admin-backdrop').addEventListener('click', closeAdmin);
  document.querySelectorAll('[data-admin-tab]').forEach(button => button.addEventListener('click', () => switchAdminTab(button.dataset.adminTab)));
  $('#toggle-card-upload').addEventListener('click', () => $('#card-upload-form').classList.toggle('hidden'));
  $('#card-upload-form').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const file = form.elements.image.files[0];
    const message = form.querySelector('[data-upload-message]');
    if (!file) return adminMessage(message, 'Choose a PNG image.', 'error');
    try {
      const imageBase64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read the image.')); reader.readAsDataURL(file); });
      adminMessage(message, 'Uploading…');
      await api('/api/admin/divine-cards', { method:'POST', body:{ fileName:file.name, imageBase64, name:form.elements.name.value, effect:form.elements.effect.value, note:form.elements.note.value, cardType:form.elements.cardType.value, slotPool:form.elements.slotPool.value || null, locale:getLocale() } });
      form.reset();
      adminMessage(message, 'Card uploaded.', 'success');
      await refreshAllBuildData({ preserveTab:true });
    } catch (error) { adminMessage(message, error.message, 'error'); }
  });
  $('#new-preset').addEventListener('click', () => resetBuilder());
  $('#preset-builder').addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = form.querySelector('[data-preset-message]');
    const body = {
      name: form.elements.name.value,
      description: form.elements.description.value,
      scenario: form.elements.scenario.value,
      energyThreshold: form.elements.energyThreshold.value,
      energyRate: form.elements.energyRate.value,
      slots: [1,2,3].map(slot => ({ slot, cardId:state.builderSlots[slot] })),
      // Send both formats during the compatibility window. situationalSlots is
      // authoritative because it keeps Card 4–9 as six fixed, nullable positions.
      situationalSlots: builderSituationalSlotsPayload(),
      swapOptions: builderSwapOptionsPayload(),
      locale: getLocale(),
    };
    try {
      adminMessage(message, 'Saving…');
      const path = state.builderPresetId ? `/api/admin/divine-card-presets/${state.builderPresetId}` : '/api/admin/divine-card-presets';
      const method = state.builderPresetId ? 'PUT' : 'POST';
      const payload = await api(path, { method, body });
      const savedPreset = payload.preset;
      if (!savedPreset?.id) throw new Error('The server did not return the saved preset.');

      const expectedPositions = Object.entries(body.situationalSlots).filter(([, cardId]) => Boolean(cardId));
      // Verify every Card 4–9 position, including empty positions. This prevents
      // any situational choice from being compacted, cleared, or moved to a
      // different card number when an older preset is updated.
      assertSituationalSlotsMatch(body.situationalSlots, savedPreset.situationalSlots, 'save response');

      state.builderPresetId = savedPreset.id;
      mergeSavedPreset(savedPreset);
      resetBuilder(savedPreset);
      adminMessage(message, `Preset saved with ${expectedPositions.length} situational card${expectedPositions.length === 1 ? '' : 's'}.`, 'success');

      // Re-fetch after showing the authoritative PUT response. GET requests are
      // no-store, so an older three-card response can no longer overwrite it.
      await refreshAllBuildData({ preserveTab:true });
      const reloadedPreset = state.adminPresets.find(preset => preset.id === state.builderPresetId);
      if (reloadedPreset) {
        assertSituationalSlotsMatch(body.situationalSlots, reloadedPreset.situationalSlots, 'reloaded preset');
        resetBuilder(reloadedPreset);
      }
    } catch (error) { adminMessage(message, error.message, 'error'); }
  });
  $('#delete-preset').addEventListener('click', async () => {
    if (!state.builderPresetId || !confirm('Delete this shared preset from every assigned hero?')) return;
    try { await api(`/api/admin/divine-card-presets/${state.builderPresetId}`, { method:'DELETE' }); state.builderPresetId = null; await refreshAllBuildData({ preserveTab:true }); resetBuilder(); }
    catch (error) { adminMessage($('#preset-builder [data-preset-message]'), error.message, 'error'); }
  });
  $('#assignment-preset').addEventListener('change', () => { state.assignmentSelected.clear(); renderAssignmentAdmin(); });
  $('#assignment-hero-search').addEventListener('input', event => { state.assignmentSearch = event.target.value; renderAssignmentAdmin(); });
  $('#assignment-role-filters').querySelectorAll('[data-assignment-role]').forEach(button => button.addEventListener('click', () => { state.assignmentRole = button.dataset.assignmentRole; renderAssignmentAdmin(); }));
  $('#select-assigned-heroes').addEventListener('click', () => {
    const preset = state.adminPresets.find(item => item.id === Number($('#assignment-preset').value));
    const visibleHeroIds = new Set([...$('#assignment-hero-grid').querySelectorAll('input[type="checkbox"]')].map(input => input.value));
    (preset?.heroAssignments || []).forEach(item => { if (visibleHeroIds.has(item.heroId)) state.assignmentSelected.add(item.heroId); });
    renderAssignmentAdmin();
  });
  $('#select-all-heroes').addEventListener('click', () => { $('#assignment-hero-grid').querySelectorAll('input').forEach(input => state.assignmentSelected.add(input.value)); renderAssignmentAdmin(); });
  $('#clear-all-heroes').addEventListener('click', () => { state.assignmentSelected.clear(); renderAssignmentAdmin(); });
  $('#assign-preset').addEventListener('click', () => updatePresetAssignments('assign', [...state.assignmentSelected]));
  $('#unassign-preset').addEventListener('click', () => {
    const preset = state.adminPresets.find(item => item.id === Number($('#assignment-preset').value));
    const assignedIds = new Set((preset?.heroAssignments || []).map(item => item.heroId));
    const heroIds = [...state.assignmentSelected].filter(heroId => assignedIds.has(heroId));
    if (!heroIds.length) return adminMessage($('#assignment-message'), 'Select at least one hero currently using this preset.', 'error');
    if (!confirm(`Remove “${preset.name}” from ${heroIds.length} selected hero${heroIds.length === 1 ? '' : 'es'}?`)) return;
    updatePresetAssignments('unassign', heroIds);
  });
}

async function bootstrap() {
  bindCardTooltips();
  $('#hero-search').addEventListener('input', event => {
    state.search = event.target.value;
    if (isNikitaEasterEggSearch(state.search) && state.heroId !== '0017') {
      selectHero('0017');
      return;
    }
    renderRoster();
    renderHeroDetail();
  });
  $('#hero-role-filters').querySelectorAll('[data-role]').forEach(button => button.addEventListener('click', () => {
    state.role = button.dataset.role;
    $('#hero-role-filters').querySelectorAll('[data-role]').forEach(item => item.classList.toggle('active', item === button));
    renderRoster();
  }));
  renderRoster();
  renderHeroDetail();
  renderPublicLibrary();
  bindAdminEvents();
  if (getToken()) {
    try { state.user = (await api('/api/auth/me')).user; } catch { setToken(''); }
  }
  renderAccount();
  if (state.user?.canManageDivineCards) $('#open-build-admin').classList.remove('hidden');
  await loadPublicBuilds();
}

bootstrap().catch(error => {
  console.error(error);
  $('#hero-detail-panel').innerHTML = `<div class="empty-state"><h3>Could not load Heroes</h3><p>${escapeHtml(error.message)}</p></div>`;
});

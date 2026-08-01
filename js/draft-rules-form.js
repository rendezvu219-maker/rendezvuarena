import { HEROES, ROLES, getHeroImg, getHeroImgSp, roleIconMarkup } from './heroes.js';

const SECTIONS = new Set(['core', 'bans', 'protection', 'presentation']);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function checked(value) { return value ? 'checked' : ''; }
function selected(current, value) { return current === value ? 'selected' : ''; }

function mirrorRoleIcon(mode) {
  const roleMap = {
    none: ['Damage', 'Tank', 'Technical'],
    damage: ['Damage'],
    tank: ['Tank'],
    technical: ['Technical'],
    'tank-technical': ['Tank', 'Technical'],
    all: ['Damage', 'Tank', 'Technical'],
  };
  const roles = roleMap[mode] || [];
  const stackClass = roles.length === 2 ? 'pair' : roles.length === 3 ? 'triangle' : '';
  const blockedClass = mode === 'none' ? ' mirror-none-stack' : '';
  return `<span class="draft-rule-choice-icon" aria-hidden="true"><span class="mirror-role-stack ${stackClass}${blockedClass}">${roles.map(role => roleIconMarkup(role, 'mirror-role-icon', role)).join('')}</span></span>`;
}

export function normalizeDraftRules(input = {}) {
  const legacyMirror = !input.mirrorPickMode && ['mirror', 'unlimited'].includes(input.duplicateMode) ? 'all' : 'none';
  return {
    draftStyle: input.draftStyle === 'all-random' ? 'all-random' : 'standard',
    timerSeconds: [30, 45, 60, 75, 90].includes(Number(input.timerSeconds)) ? Number(input.timerSeconds) : 30,
    heroBans: Math.min(4, Math.max(0, Number(input.heroBans ?? 2))),
    divineBans: Math.min(3, Math.max(0, Number(input.divineBans ?? 0))),
    divineDrawMode: ['random', 'pickban', 'ban-random'].includes(input.divineDrawMode) ? input.divineDrawMode : 'random',
    seriesRule: ['normal', 'team_no_repeat', 'fearless'].includes(input.seriesRule) ? input.seriesRule : 'normal',
    mirrorPickMode: ['none', 'tank', 'technical', 'damage', 'tank-technical', 'all'].includes(input.mirrorPickMode) ? input.mirrorPickMode : legacyMirror,
    enableCoinFlip: input.enableCoinFlip !== false,
    enableDivineDraw: input.enableDivineDraw !== false,
    cinematicLockIn: input.cinematicLockIn !== false,
    flashAndShake: input.flashAndShake === true,
    enableProtect: input.enableProtect === true,
    protectNewest: input.protectNewest === true,
    protectList: Array.isArray(input.protectList) ? [...new Set(input.protectList.map(String))] : [],
    globalBanList: Array.isArray(input.globalBanList) ? [...new Set(input.globalBanList.map(String))] : [],
    heroRuleScope: ['match', 'series', 'stage', 'tournament'].includes(input.heroRuleScope) ? input.heroRuleScope : 'match',
  };
}

export function renderDraftRulesForm(input = {}, options = {}) {
  const rules = normalizeDraftRules(input);
  const sections = new Set((options.sections || [...SECTIONS]).filter(section => SECTIONS.has(section)));
  const formId = options.formId || 'shared-draft-rules-form';
  const submitLabel = options.submitLabel || '';
  const className = options.className || '';

  return `<form id="${escapeHtml(formId)}" class="draft-rules-form ${escapeHtml(className)}" data-shared-draft-rules novalidate>
    ${sections.has('core') ? coreSection(rules) : ''}
    ${sections.has('bans') ? banSection(rules) : ''}
    ${sections.has('protection') ? protectionSection(rules) : ''}
    ${sections.has('presentation') ? presentationSection(rules) : ''}
    ${submitLabel ? `<div class="draft-rules-actions"><button class="btn btn-primary" type="submit">${escapeHtml(submitLabel)}</button></div>` : ''}
  </form>`;
}

function sectionHead(kicker, title, description) {
  return `<div class="draft-rule-section-head"><div><span class="draft-rule-kicker">${kicker}</span><h3>${title}</h3><p>${description}</p></div></div>`;
}

function coreSection(rules) {
  const draftModes = [
    ['standard', 'Standard Pick & Ban', 'Teams manually ban and pick heroes through the competitive turn sequence.'],
    ['all-random', 'All Random', 'The Host bans unwanted heroes first, then the system assigns a valid 2 Damage · 1 Tank · 1 Technical lineup to both teams.'],
  ];
  const seriesOptions = [
    ['normal', 'Normal', 'Every game starts fresh. Both teams may reuse heroes from earlier games in the same BO series.'],
    ['team_no_repeat', 'Team No Repeat', 'Each team blocks only its own earlier picks. Example: if your team used Goku in Game 1, your team cannot use Goku again—but the other team still can.'],
    ['fearless', 'Fearless Draft', 'Both teams share one used-hero list. Example: if either team used Goku in Game 1, neither team can use Goku again later in the series.'],
  ];
  const mirrorOptions = [
    ['none', 'No Mirror Picks', 'Every hero remains unique across both teams.'],
    ['tank', 'Tank Mirror', 'Only Tank may mirror across teams.'],
    ['technical', 'Technical Mirror', 'Only Technical may mirror across teams.'],
    ['damage', 'Damage Mirror', 'Only Damage may mirror across teams.'],
    ['tank-technical', 'Tank + Technical', 'Tank and Technical may mirror.'],
    ['all', 'All Roles', 'Every role may mirror across teams.'],
  ];
  return `<section class="draft-rule-section" data-rule-section="core">
    ${sectionHead('Draft rules', 'Turn flow & Mirror Pick', 'Choose manual drafting or the existing two-team randomizer. Team composition remains 2 Damage, 1 Tank and 1 Technical.')}
    <fieldset class="draft-rule-choice-fieldset draft-rule-mode-fieldset"><legend>Draft mode</legend><div class="draft-rule-mode-grid">
      ${draftModes.map(([value, label, desc]) => `<label class="draft-rule-choice draft-rule-mode-choice"><input type="radio" name="draftStyle" value="${value}" data-rule-field="draftStyle" ${checked(rules.draftStyle === value)}><span><b>${label}</b><small>${desc}</small></span></label>`).join('')}
    </div></fieldset>
    <div class="draft-rule-grid">
      <label class="draft-rule-field"><span>Ban / Pick timer</span><select data-rule-field="timerSeconds">
        ${[30,45,60,75,90].map(value => `<option value="${value}" ${selected(rules.timerSeconds, value)}>${value < 60 ? `${value} seconds` : value === 60 ? '1 minute' : `1 minute ${value - 60} seconds`}</option>`).join('')}
      </select><small>Applied to every hero ban and pick turn.</small></label>
      <div class="draft-rule-toggle-stack">
        ${toggle('enableCoinFlip', 'Coin flip', 'Choose the first side before drafting.', rules.enableCoinFlip)}
        ${toggle('enableDivineDraw', 'Divine Draw', 'Run the existing team rule draw before hero drafting.', rules.enableDivineDraw)}
      </div>
    </div>
    <fieldset class="draft-rule-choice-fieldset"><legend>BO series reuse rule</legend><div class="draft-rule-choice-grid draft-rule-series-grid">
      ${seriesOptions.map(([value, label, desc]) => `<label class="draft-rule-choice"><input type="radio" name="seriesRule" value="${value}" data-rule-field="seriesRule" ${checked(rules.seriesRule === value)}><span><b>${label}</b><small>${desc}</small></span></label>`).join('')}
    </div>
    <div class="draft-rule-beginner-note" role="note">
      <strong>Easy way to remember</strong>
      <span><b>Team No Repeat:</b> your team loses only the heroes your team already used.</span>
      <span><b>Fearless Draft:</b> both teams lose every hero that either team already used.</span>
      <small>Only completed picks carry into the next game. Banned heroes do not become permanently locked.</small>
    </div></fieldset>
    <fieldset class="draft-rule-choice-fieldset"><legend>Cross-team Mirror Pick</legend><div class="draft-rule-choice-grid">
      ${mirrorOptions.map(([value, label, desc]) => `<label class="draft-rule-choice"><input type="radio" name="mirrorPickMode" value="${value}" data-rule-field="mirrorPickMode" ${checked(rules.mirrorPickMode === value)}><span>${mirrorRoleIcon(value)}<b>${label}</b><small>${desc}</small></span></label>`).join('')}
    </div></fieldset>
  </section>`;
}

function banSection(rules) {
  return `<section class="draft-rule-section" data-rule-section="bans">
    ${sectionHead('Ban rules', 'Hero bans & Divine Draw mode', 'Divine bans belong to the separate Divine Draw phase and never create extra hero-ban turns.')}
    <div class="draft-rule-grid three">
      ${numberField('heroBans', 'Hero bans per team', rules.heroBans, 0, 4, 'Used by the hero draft sequence.')}
      ${numberField('divineBans', 'Divine bans per team', rules.divineBans, 0, 3, 'Used only inside Divine Draw.')}
      <label class="draft-rule-field"><span>Divine Draw mode</span><select data-rule-field="divineDrawMode">
        <option value="random" ${selected(rules.divineDrawMode, 'random')}>Random roulette</option>
        <option value="pickban" ${selected(rules.divineDrawMode, 'pickban')}>Pick / Ban</option>
        <option value="ban-random" ${selected(rules.divineDrawMode, 'ban-random')}>Ban + Random</option>
      </select><small>Does not modify the hero draft pool.</small></label>
    </div>
  </section>`;
}

function protectionSection(rules) {
  return `<section class="draft-rule-section" data-rule-section="protection">
    ${sectionHead('Hero availability', 'Protection & Global Ban', 'Protection prevents a hero from being banned. Global Ban removes a hero from picks and bans. A hero cannot hold both states.')}
    <div class="draft-rule-protection-layout">
      <div class="draft-rule-protection-controls">
        ${toggle('enableProtect', 'Enable protected heroes', 'Protected heroes remain pickable but cannot be banned.', rules.enableProtect)}
        ${toggle('protectNewest', 'Auto-protect NEW heroes', 'Automatically protects every hero marked NEW.', rules.protectNewest)}
      </div>
      <div class="draft-rule-protection-meta">
        <label class="draft-rule-field draft-rule-scope-card"><span>Rule scope</span><select data-rule-field="heroRuleScope">
          <option value="match" ${selected(rules.heroRuleScope, 'match')}>This match / match default</option>
          <option value="series" ${selected(rules.heroRuleScope, 'series')}>Entire BO series</option>
          <option value="stage" ${selected(rules.heroRuleScope, 'stage')}>Current tournament stage</option>
          <option value="tournament" ${selected(rules.heroRuleScope, 'tournament')}>Entire tournament</option>
        </select><small>The saved scope is explicit instead of being inferred.</small></label>
        <div class="draft-rule-summary" aria-live="polite"><div><b data-protected-count>0</b><span>Protected</span></div><div class="global"><b data-global-count>0</b><span>Global Ban</span></div><button type="button" class="btn btn-ghost btn-sm" data-toggle-hero-editor>Manage heroes</button></div>
      </div>
    </div>
    <div class="draft-rule-hero-editor hidden" data-hero-editor>
      <div class="draft-rule-hero-toolbar"><label><span class="sr-only">Search heroes</span><input type="search" data-hero-search placeholder="Search the 39-hero roster by name or role…"></label><button type="button" class="btn btn-ghost btn-xs" data-clear-hero-rules>Clear all</button></div>
      <div class="draft-rule-hero-grid" data-hero-grid></div>
    </div>
  </section>`;
}

function presentationSection(rules) {
  return `<section class="draft-rule-section" data-rule-section="presentation">
    ${sectionHead('Presentation & Cinematic FX', 'Lock-in presentation', 'Accessibility preferences always override decorative motion. Reduced Motion disables shake and compresses cinematic transitions.')}
    <div class="draft-rule-grid two">
      ${toggle('cinematicLockIn', 'Cinematic lock-in', 'Show the selected hero art or trailer when a turn locks.', rules.cinematicLockIn)}
      ${toggle('flashAndShake', 'Flash & shake', 'Optional impact effect. It is suppressed when Reduced Motion is active.', rules.flashAndShake)}
    </div>
  </section>`;
}

function numberField(field, label, value, min, max, desc) {
  return `<label class="draft-rule-field"><span>${label}</span><input type="number" min="${min}" max="${max}" step="1" value="${value}" data-rule-field="${field}"><small>${desc}</small></label>`;
}

function toggle(field, label, desc, value) {
  return `<label class="draft-rule-toggle"><span class="draft-rule-toggle-copy"><span><b>${label}</b><small>${desc}</small></span></span><span class="switch"><input type="checkbox" data-rule-field="${field}" ${checked(value)}><span class="slider" aria-hidden="true"></span></span></label>`;
}

export function bindDraftRulesForm(root, options = {}) {
  const form = root?.matches?.('[data-shared-draft-rules]') ? root : root?.querySelector?.('[data-shared-draft-rules]');
  if (!form) throw new Error('Shared Draft Rules form was not found.');

  const rules = normalizeDraftRules(options.rules || {});
  const protectedHeroes = new Set(rules.protectList);
  const globalBannedHeroes = new Set(rules.globalBanList);
  const newHeroIds = new Set(HEROES.filter(hero => hero.isNew).map(hero => hero.id));
  let search = '';

  const emit = () => {
    rules.protectList = [...protectedHeroes];
    rules.globalBanList = [...globalBannedHeroes];
    options.onChange?.({ ...rules, protectList: [...rules.protectList], globalBanList: [...rules.globalBanList] });
  };

  const readField = input => {
    const field = input.dataset.ruleField;
    if (!field) return;
    if (input.type === 'radio' && !input.checked) return;
    if (input.type === 'checkbox') rules[field] = input.checked;
    else if (input.type === 'number' || field === 'timerSeconds') rules[field] = Number(input.value);
    else rules[field] = input.value;

    if (field === 'mirrorPickMode') rules.sameHeroAllowed = rules.mirrorPickMode !== 'none';
    if (field === 'protectNewest' && input.checked) {
      newHeroIds.forEach(id => globalBannedHeroes.delete(id));
      rules.enableProtect = true;
      const protectToggle = form.querySelector('[data-rule-field="enableProtect"]');
      if (protectToggle) protectToggle.checked = true;
    }
    renderHeroEditor();
    emit();
  };

  form.querySelectorAll('[data-rule-field]').forEach(input => input.addEventListener('change', () => readField(input)));

  const editor = form.querySelector('[data-hero-editor]');
  const grid = form.querySelector('[data-hero-grid]');
  const searchInput = form.querySelector('[data-hero-search]');

  function effectiveProtected(hero) {
    return protectedHeroes.has(hero.id) || (rules.protectNewest && newHeroIds.has(hero.id));
  }

  function renderHeroEditor() {
    const hadRenderedGrid = Boolean(grid?.childElementCount);
    const previousGridTop = grid?.scrollTop || 0;
    const previousGridLeft = grid?.scrollLeft || 0;
    const previousWindowX = window.scrollX;
    const previousWindowY = window.scrollY;
    const protectedCount = rules.enableProtect ? HEROES.filter(effectiveProtected).length : 0;
    const protectedCountEl = form.querySelector('[data-protected-count]');
    const globalCountEl = form.querySelector('[data-global-count]');
    if (protectedCountEl) protectedCountEl.textContent = String(protectedCount);
    if (globalCountEl) globalCountEl.textContent = String(globalBannedHeroes.size);
    if (!grid) return;

    const term = search.trim().toLowerCase();
    const heroes = HEROES.filter(hero => !term || hero.name.toLowerCase().includes(term) || hero.role.toLowerCase().includes(term));
    grid.innerHTML = heroes.map(hero => {
      const role = ROLES[hero.role];
      const manual = protectedHeroes.has(hero.id);
      const auto = rules.protectNewest && newHeroIds.has(hero.id);
      const global = globalBannedHeroes.has(hero.id);
      const fallback = getHeroImg(hero.id);
      return `<article class="draft-rule-hero-card ${manual || auto ? 'protected' : ''} ${global ? 'global' : ''}">
        <div class="draft-rule-hero-portrait"><img src="${getHeroImgSp(hero.id)}" alt="${escapeHtml(hero.name)}" loading="lazy" onerror="if(!this.dataset.fallback){this.dataset.fallback='1';this.src='${fallback}';}else{this.style.display='none';}"><span style="--role-color:${role.color}">${roleIconMarkup(hero.role, 'inline-role-icon')}</span>${hero.isNew ? '<em>NEW</em>' : ''}</div>
        <b>${escapeHtml(hero.name)}</b>
        <div class="draft-rule-hero-actions"><button type="button" data-hero-action="protect" data-hero-id="${hero.id}" ${auto ? 'disabled' : ''}>${auto ? 'Auto protected' : manual ? 'Remove protect' : 'Protect'}</button><button type="button" data-hero-action="global" data-hero-id="${hero.id}" ${auto ? 'disabled' : ''}>${global ? 'Remove global' : 'Global ban'}</button></div>
      </article>`;
    }).join('') || '<div class="empty-state"><p>No heroes match this search.</p></div>';

    grid.querySelectorAll('[data-hero-action]').forEach(button => button.addEventListener('click', event => {
      event.preventDefault();
      const id = button.dataset.heroId;
      if (button.dataset.heroAction === 'protect') {
        if (protectedHeroes.has(id)) protectedHeroes.delete(id);
        else { protectedHeroes.add(id); globalBannedHeroes.delete(id); rules.enableProtect = true; }
      } else if (globalBannedHeroes.has(id)) globalBannedHeroes.delete(id);
      else { globalBannedHeroes.add(id); protectedHeroes.delete(id); }
      const protectToggle = form.querySelector('[data-rule-field="enableProtect"]');
      if (protectToggle) protectToggle.checked = rules.enableProtect;
      renderHeroEditor();
      emit();
    }));

    if (hadRenderedGrid) {
      requestAnimationFrame(() => {
        grid.scrollTop = previousGridTop;
        grid.scrollLeft = previousGridLeft;
        window.scrollTo(previousWindowX, previousWindowY);
      });
    }
  }

  form.querySelector('[data-toggle-hero-editor]')?.addEventListener('click', event => {
    event.preventDefault();
    editor?.classList.toggle('hidden');
    if (editor && !editor.classList.contains('hidden')) searchInput?.focus();
    renderHeroEditor();
  });
  searchInput?.addEventListener('input', event => { search = event.target.value; renderHeroEditor(); });
  form.querySelector('[data-clear-hero-rules]')?.addEventListener('click', event => {
    event.preventDefault();
    protectedHeroes.clear();
    globalBannedHeroes.clear();
    renderHeroEditor();
    emit();
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    emit();
    options.onSubmit?.({ ...rules, protectList: [...protectedHeroes], globalBanList: [...globalBannedHeroes] }, event);
  });

  renderHeroEditor();
  return {
    getRules: () => ({ ...rules, protectList: [...protectedHeroes], globalBanList: [...globalBannedHeroes] }),
  };
}

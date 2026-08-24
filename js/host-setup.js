// Host Setup - Tab Content Renderer
import { HEROES, STAGE_PRESETS, THEMES, applyTheme } from './heroes.js';
import { bindDraftRulesForm, renderDraftRulesForm } from './draft-rules-form.js';
import { t } from './i18n.js';
import { api } from './api.js';

function escapeAttribute(value) {
  return String(value ?? '').replace(/[&<>\"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' }[char]));
}


const QUICK_PRESET_STORAGE_KEY = 'gekishin.quickDraft.customPresets.v1';
const QUICK_PRESET_FIELDS = Object.freeze([
  'format', 'seriesRule', 'timerSeconds', 'heroBans', 'divineBans', 'separateBanPool',
  'sameHeroAllowed', 'globalPick', 'mirrorPickMode', 'enableProtect', 'protectNewest',
  'protectList', 'globalBanList', 'heroRuleScope', 'enableTrailer', 'cinematicLockIn',
  'dualHover', 'flashAndShake', 'theme', 'draftStyle', 'enableCoinFlip',
  'enableDivineDraw', 'divineDrawMode', 'roomMode',
]);
const MIRROR_LABELS = Object.freeze({
  none: 'No Mirror Picks', tank: 'Tank only', technical: 'Technical only', damage: 'Damage only',
  'tank-technical': 'Tank + Technical', all: 'All roles',
});
const DIVINE_DRAW_LABELS = Object.freeze({ random: 'Random roulette', pickban: 'Pick / Ban', 'ban-random': 'Ban + Random' });

function clonePresetValue(value) {
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === 'object') return { ...value };
  return value;
}

export class HostSetup {
  constructor(onStart) {
    this.onStart = onStart;
    this.config = this.getDefaults();
    this.contentEl = document.getElementById('setup-content');
    if (!this.contentEl) throw new Error('Missing #setup-content container.');
    this.customPresets = this.loadCustomPresets();
    this.activePreset = 'standard';
    this.liveRoom = null;
    this.liveRoomRequest = null;
    this.bindSidebar();
    this.bindQuickStart();
    this.bindStartButtons();
    this.showTab('picks');
    this.renderCustomPresets();
    this.syncQuickStart();
  }

  getDefaults() {
    return {
      teamA: t('teamBlue'), teamB: t('teamRed'), teamALogoUrl: '', teamBLogoUrl: '',
      sessionId: crypto.randomUUID ? crypto.randomUUID() : `quick-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      format: 'BO3', gameNumber: 1, seriesRule: 'normal', seriesScoreA: 0, seriesScoreB: 0, timerSeconds: 30,
      heroBans: 2, divineBans: 0,
      separateBanPool: false,
      sameHeroAllowed: false, globalPick: false,
      mirrorPickMode: 'none', // none, tank, technical, damage, tank-technical, all
      enableProtect: false, protectNewest: false, protectList: [],
      globalBanList: [], heroRuleScope: 'match',
      enableTrailer: true, cinematicLockIn: true, dualHover: true,
      flashAndShake: false, // Accessibility: disabled by default
      theme: 'beerus',
      draftStyle: 'standard', // 'standard' or 'all-random'
      enableCoinFlip: true,
      enableDivineDraw: true,
      divineDrawMode: 'random', // 'random' (roulette spin) or 'pickban' (teams choose)
      roomMode: 'bandai-tool', // 'bandai-tool' (host posts code) or 'form' (teams submit form)
      roomCode: '',
    };
  }

  bindQuickStart() {
    document.getElementById('quick-preset-grid')?.addEventListener('click', event => {
      const card = event.target.closest('[data-stage-preset]');
      if (card) this.applyPreset(card.dataset.stagePreset);
    });

    document.getElementById('quick-custom-preset-grid')?.addEventListener('click', event => {
      const remove = event.target.closest('[data-delete-custom-preset]');
      if (remove) {
        event.stopPropagation();
        const id = remove.dataset.deleteCustomPreset;
        const preset = this.customPresets.find(item => item.id === id);
        if (!preset || !window.confirm(`Delete the custom preset “${preset.name}”?`)) return;
        this.customPresets = this.customPresets.filter(item => item.id !== id);
        this.saveCustomPresets();
        if (this.activePreset === `custom:${id}`) this.activePreset = 'customized';
        this.renderCustomPresets();
        this.syncQuickStart();
        return;
      }
      const card = event.target.closest('[data-custom-preset]');
      if (card) this.applyPreset(`custom:${card.dataset.customPreset}`);
    });

    document.getElementById('quick-save-preset')?.addEventListener('click', () => this.openSavePresetDialog());
    document.getElementById('quick-confirm-save-preset')?.addEventListener('click', () => this.saveCurrentPreset());
    document.getElementById('quick-close-preset-dialog')?.addEventListener('click', () => document.getElementById('quick-preset-dialog')?.close());
    document.getElementById('quick-preset-form')?.addEventListener('submit', event => event.preventDefault());

    const bindings = [
      ['quick-team-a', 'teamA'], ['quick-team-b', 'teamB'],
      ['quick-team-a-logo', 'teamALogoUrl'], ['quick-team-b-logo', 'teamBLogoUrl'],
    ];
    bindings.forEach(([id, key]) => {
      document.getElementById(id)?.addEventListener('input', event => {
        this.config[key] = event.target.value;
        this.updateQuickSummary();
      });
    });
  }

  loadCustomPresets() {
    try {
      const parsed = JSON.parse(localStorage.getItem(QUICK_PRESET_STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(item => item && typeof item.id === 'string' && typeof item.name === 'string' && item.config && typeof item.config === 'object').slice(0, 30);
    } catch {
      return [];
    }
  }

  saveCustomPresets() {
    try { localStorage.setItem(QUICK_PRESET_STORAGE_KEY, JSON.stringify(this.customPresets)); }
    catch (error) { console.warn('Could not save Quick Draft presets:', error); }
  }

  snapshotPresetConfig() {
    return Object.fromEntries(QUICK_PRESET_FIELDS.map(key => [key, clonePresetValue(this.config[key])]));
  }

  getPresetRecord(presetId = this.activePreset) {
    if (STAGE_PRESETS[presetId]) return { id:presetId, builtIn:true, ...STAGE_PRESETS[presetId], config:STAGE_PRESETS[presetId].config || {} };
    if (String(presetId).startsWith('custom:')) {
      const id = String(presetId).slice(7);
      const preset = this.customPresets.find(item => item.id === id);
      if (preset) return { ...preset, id:`custom:${id}`, builtIn:false };
    }
    return {
      id:'customized', builtIn:false, name:t('unsavedCustom'),
      description:t('unsavedCustomDesc'),
      config:this.snapshotPresetConfig(),
    };
  }

  applyPreset(presetId) {
    const record = this.getPresetRecord(presetId);
    if (!record || record.id === 'customized') return;
    const sourceConfig = record.builtIn ? { ...this.getDefaults(), ...(record.config || {}) } : (record.config || {});
    Object.entries(sourceConfig).forEach(([key, value]) => {
      if (QUICK_PRESET_FIELDS.includes(key)) this.config[key] = clonePresetValue(value);
    });
    this.config.sameHeroAllowed = this.config.mirrorPickMode !== 'none';
    this.activePreset = record.id;
    this.renderCustomPresets();
    this.syncQuickStart();
    const active = document.querySelector('.sidebar-item.active');
    if (active) this.showTab(active.dataset.tab);
  }

  markPresetCustomized() {
    this.activePreset = 'customized';
    this.renderCustomPresets();
    this.syncQuickStart();
  }

  presetFacts(config = this.config) {
    const mirrorKeys = { none:'noMirrorPicks', tank:'tank', technical:'technical', damage:'damage', 'tank-technical':'tankTechnical', all:'allRoles' };
    const drawKeys = { random:'randomRoulette', pickban:'pickBan', 'ban-random':'banRandom' };
    return [
      [t('series'), config.format || 'BO3'],
      [t('draft'), config.draftStyle === 'all-random' ? t('allRandom') : t('standardPickBan')],
      [t('heroBans'), t('perTeam', { count: Number(config.heroBans || 0) })],
      [t('turnTimer'), t('seconds', { count: Number(config.timerSeconds || 30) })],
      [t('mirrorPick'), t(mirrorKeys[config.mirrorPickMode] || 'noMirrorPicks')],
      [t('divineDraw'), config.enableDivineDraw ? t(drawKeys[config.divineDrawMode] || 'on') : t('off')],
      [t('coinFlip'), config.enableCoinFlip ? t('on') : t('off')],
      [t('protection'), config.enableProtect ? `${t('manual', { count: (config.protectList || []).length })}${config.protectNewest ? ` + ${t('newHeroes')}` : ''}` : t('off')],
      [t('globalBans'), t('heroesCount', { count: (config.globalBanList || []).length })],
    ];
  }

  factsMarkup(config, compact = false) {
    const facts = this.presetFacts(config);
    return `<dl class="quick-preset-detail-grid">${facts.slice(0, compact ? 6 : facts.length).map(([label, value]) => `<div><dt>${escapeAttribute(label)}</dt><dd title="${escapeAttribute(value)}">${escapeAttribute(value)}</dd></div>`).join('')}</dl>`;
  }

  localizedPresetName(record) {
    if (record?.id === 'standard') return t('standard');
    if (record?.id === 'tournament') return t('tournament');
    return record?.name || t('custom');
  }

  localizedPresetDescription(record) {
    if (record?.id === 'standard') return t('balancedBo3');
    if (record?.id === 'tournament') return t('longerBo5');
    return record?.description || t('noDescription');
  }

  renderCustomPresets() {
    const grid = document.getElementById('quick-custom-preset-grid');
    if (!grid) return;
    grid.innerHTML = this.customPresets.length ? this.customPresets.map(preset => {
      const selected = this.activePreset === `custom:${preset.id}`;
      return `<article class="quick-custom-preset-card ${selected ? 'selected' : ''}">
        <button class="quick-custom-preset-select" type="button" data-custom-preset="${escapeAttribute(preset.id)}" aria-pressed="${selected}">
          <span>${escapeAttribute(preset.config?.format || 'CUSTOM')}</span><b>${escapeAttribute(preset.name)}</b><small>${escapeAttribute(preset.description || t('personalRules'))}</small>
        </button>
        <button class="quick-custom-preset-delete" type="button" data-delete-custom-preset="${escapeAttribute(preset.id)}" aria-label="${escapeAttribute(t('close'))} ${escapeAttribute(preset.name)}">DEL</button>
      </article>`;
    }).join('') : `<div class="quick-custom-preset-empty">${escapeAttribute(t('noPersonalPresets'))}</div>`;
  }

  renderPresetDetail() {
    const detail = document.getElementById('quick-preset-detail');
    if (!detail) return;
    const record = this.getPresetRecord();
    const config = record.config || this.snapshotPresetConfig();
    detail.innerHTML = `<div><span class="eyebrow">${record.builtIn ? t('builtInPreset') : record.id === 'customized' ? t('currentRules') : t('myPreset')}</span><h3>${escapeAttribute(this.localizedPresetName(record))}</h3><p>${escapeAttribute(this.localizedPresetDescription(record))}</p></div>${this.factsMarkup(config)}`;
  }

  openSavePresetDialog() {
    const dialog = document.getElementById('quick-preset-dialog');
    const form = document.getElementById('quick-preset-form');
    if (!dialog || !form) return;
    form.reset();
    const selected = this.getPresetRecord();
    form.elements.name.value = selected.id === 'customized' ? '' : `${selected.name} Copy`;
    form.elements.description.value = selected.id === 'customized' ? '' : selected.description || '';
    document.getElementById('quick-preset-dialog-preview').innerHTML = this.factsMarkup(this.config, true);
    form.querySelector('[data-custom-preset-message]').textContent = '';
    dialog.showModal();
    form.elements.name.focus();
  }

  saveCurrentPreset() {
    const dialog = document.getElementById('quick-preset-dialog');
    const form = document.getElementById('quick-preset-form');
    const message = form?.querySelector('[data-custom-preset-message]');
    const name = String(form?.elements.name.value || '').trim();
    if (!name) {
      if (message) message.textContent = t('enterPresetName');
      form?.elements.name.focus();
      return;
    }
    const id = crypto.randomUUID ? crypto.randomUUID() : `preset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const record = {
      id, name:name.slice(0,80), description:String(form.elements.description.value || '').trim().slice(0,300),
      config:this.snapshotPresetConfig(), createdAt:new Date().toISOString(),
    };
    this.customPresets.unshift(record);
    this.customPresets = this.customPresets.slice(0,30);
    this.saveCustomPresets();
    this.activePreset = `custom:${id}`;
    this.renderCustomPresets();
    this.syncQuickStart();
    dialog?.close();
  }

  syncQuickStart() {
    const values = {
      'quick-team-a': this.config.teamA, 'quick-team-b': this.config.teamB,
      'quick-team-a-logo': this.config.teamALogoUrl || '', 'quick-team-b-logo': this.config.teamBLogoUrl || '',
    };
    Object.entries(values).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input && input.value !== String(value ?? '')) input.value = String(value ?? '');
    });
    document.querySelectorAll('[data-stage-preset]').forEach(card => {
      const selected = card.dataset.stagePreset === this.activePreset;
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    });
    this.renderCustomPresets();
    this.renderPresetDetail();
    this.updateQuickSummary();
  }

  updateQuickSummary() {
    const summary = document.getElementById('quick-config-summary');
    if (!summary) return;
    const record = this.getPresetRecord();
    summary.innerHTML = `<strong>${escapeAttribute(this.localizedPresetName(record))}</strong><span>${escapeAttribute(this.config.format)}</span><span>${escapeAttribute(this.config.draftStyle === 'all-random' ? t('allRandom') : t('standardPickBan'))}</span><span>${escapeAttribute(t('bansCount', { count: this.config.heroBans }))}</span><span>${escapeAttribute(t('turnsCount', { count: this.config.timerSeconds }))}</span><span>${escapeAttribute(this.config.enableDivineDraw ? t('divineDrawOn') : t('divineDrawOff'))}</span>`;
  }


  bindSidebar() {
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        this.showTab(item.dataset.tab);
      });
    });
  }

  bindStartButtons() {
    document.getElementById('btn-start-draft')?.addEventListener('click', () => this.startDraft());
    document.getElementById('btn-start-topbar')?.addEventListener('click', () => this.startDraft());
    document.getElementById('btn-reset-config')?.addEventListener('click', () => {
      if (!window.confirm(t('resetConfirm'))) return;
      this.config = this.getDefaults();
      this.activePreset = 'standard';
      this.syncQuickStart();
      const active = document.querySelector('.sidebar-item.active');
      this.showTab(active?.dataset.tab || 'picks');
    });
  }

  async ensureServerRoom() {
    if (this.liveRoomRequest) return this.liveRoomRequest;
    this.liveRoomRequest = api('/api/quick-draft-rooms', {
      method: 'POST',
      body: { config: this.config },
    }).then(payload => {
      this.liveRoom = payload.room;
      return payload.room;
    }).finally(() => {
      this.liveRoomRequest = null;
    });
    return this.liveRoomRequest;
  }

  setStartBusy(busy) {
    ['btn-start-draft', 'btn-start-topbar'].forEach(id => {
      const button = document.getElementById(id);
      if (!button) return;
      button.disabled = Boolean(busy);
      button.dataset.loading = String(Boolean(busy));
    });
  }

  async startDraft() {
    this.config.teamA = String(document.getElementById('quick-team-a')?.value || this.config.teamA || t('teamBlue')).trim() || t('teamBlue');
    this.config.teamB = String(document.getElementById('quick-team-b')?.value || this.config.teamB || t('teamRed')).trim() || t('teamRed');
    this.config.teamALogoUrl = String(document.getElementById('quick-team-a-logo')?.value || '').trim();
    this.config.teamBLogoUrl = String(document.getElementById('quick-team-b-logo')?.value || '').trim();
    this.config.gameNumber = Math.max(1, Number(this.config.gameNumber || 1));
    this.config.sessionId = this.config.sessionId || (crypto.randomUUID ? crypto.randomUUID() : `quick-${Date.now()}`);
    if (this.onStart) return this.onStart(this.config);
    this.setStartBusy(true);
    try {
      const room = await this.ensureServerRoom();
      if (!room?.links?.host) throw new Error('The Host Draft Room link was not returned.');
      const destination = room.links.host;
      this.config = {
        ...this.config,
        sessionId: crypto.randomUUID ? crypto.randomUUID() : `quick-${Date.now()}`,
        gameNumber: 1,
        seriesScoreA: 0,
        seriesScoreB: 0,
        previousPicksA: [],
        previousPicksB: [],
        previousBansA: [],
        previousBansB: [],
      };
      this.liveRoom = null;
      this.liveRoomRequest = null;
      window.location.href = destination;
    } catch (error) {
      this.setStartBusy(false);
      window.alert(error?.message || String(error));
    }
  }

  showTab(tab) {
    const tabs = {
      picks: () => this.renderPicks(),
      bans: () => this.renderBans(),
      protect: () => this.renderProtect(),
      experience: () => this.renderExperience(),
      theme: () => this.renderTheme(),
      sharing: () => this.renderSharing(),
    };
    this.contentEl.innerHTML = '';
    try {
      if (tabs[tab]) tabs[tab]();
      else this.renderPicks();
      this.contentEl.classList.remove('setup-animate-in');
      void this.contentEl.offsetWidth;
      this.contentEl.classList.add('setup-animate-in');
    } catch (error) {
      console.error('Host setup render failed:', error);
      this.contentEl.innerHTML = `
        <div class="content-header"><h2>${escapeAttribute(t('setupCouldNotLoad'))}</h2><p>${String(error?.message || error)}</p></div>
        <button class="btn btn-primary" id="retry-setup">${escapeAttribute(t('retry'))}</button>`;
      this.contentEl.querySelector('#retry-setup')?.addEventListener('click', () => this.showTab('picks'));
    }
  }

  renderRulesSection(section, title, description) {
    this.contentEl.innerHTML = `
      <div class="content-header"><h2>${title}</h2><p>${description}</p></div>
      ${renderDraftRulesForm(this.config, { sections: [section], formId: `quick-${section}-rules` })}`;
    bindDraftRulesForm(this.contentEl, {
      rules: this.config,
      onChange: rules => {
        Object.assign(this.config, rules);
        this.config.sameHeroAllowed = this.config.mirrorPickMode !== 'none';
        this.markPresetCustomized();
      },
    });
  }

  // ===== BANS =====
  renderBans() {
    this.renderRulesSection('bans', t('banRules'), 'Configure hero bans and the separate Divine Draw ban phase with the same component used by Tournament Operations.');
  }

  // ===== PICKS =====
  renderPicks() {
    this.renderRulesSection('core', t('draftRules'), 'Configure turn timing, pre-draft steps and cross-team Mirror Pick.');
  }

  // ===== PROTECTION & GLOBAL BAN =====
  renderProtect() {
    this.renderRulesSection('protection', t('protectionGlobalBan'), `Manage hero availability with an explicit scope and a searchable ${HEROES.length}-hero roster.`);
  }

  // ===== PRESENTATION =====
  renderExperience() {
    this.renderRulesSection('presentation', t('presentationFx'), 'Configure lock-in presentation without overriding the user’s Reduced Motion preference.');
  }

  // ===== COSMETIC AURA =====
  renderTheme() {
    this.config.theme = applyTheme(this.config.theme);
    this.contentEl.innerHTML = `
      <div class="content-header"><h2>${escapeAttribute(t('heroAuraAccent'))}</h2><p>${escapeAttribute(t('heroAuraDesc'))}</p></div>
      <div class="preset-grid stagger-children" id="theme-grid">
        ${Object.entries(THEMES).map(([id, theme]) => `
          <button type="button" class="preset-card ${this.config.theme === id ? 'selected' : ''}" data-aura-choice="${id}" aria-pressed="${this.config.theme === id}">
            <span class="aura-swatch" style="--aura-preview:${theme.accent};--aura-preview-glow:${theme.accentGlow}"></span>
            <span class="preset-title">${theme.name}</span>
            <span class="preset-desc">${theme.desc}</span>
            <span class="aura-boundary-note">${escapeAttribute(t('cosmeticOnly'))}</span>
          </button>`).join('')}
      </div>`;
    this.contentEl.querySelectorAll('[data-aura-choice]').forEach(card => {
      card.addEventListener('click', () => {
        this.config.theme = applyTheme(card.dataset.auraChoice);
        this.markPresetCustomized();
        this.renderTheme();
      });
    });
  }

  // ===== SHARING =====
  renderSharing() {
    this.contentEl.innerHTML = `
      <div class="content-header"><h2>${escapeAttribute(t('shareLinks'))}</h2><p>${escapeAttribute(t('shareLinksDesc'))}</p></div>
      <div class="quick-live-link-status" id="quick-live-link-status">Creating secure server-backed links…</div>
      <div class="settings-grid" id="quick-live-link-grid"></div>`;
    this.loadSharingLinks();
  }

  async loadSharingLinks() {
    const status = document.getElementById('quick-live-link-status');
    const grid = document.getElementById('quick-live-link-grid');
    if (!status || !grid) return;
    try {
      const room = await this.ensureServerRoom();
      if (!document.body.contains(grid)) return;
      const rows = [
        { key:'teamA', input:'link-a', tone:'blue', icon:'🔵', title:t('teamALink'), desc:t('sendTo', { team:this.config.teamA }) },
        { key:'teamB', input:'link-b', tone:'red', icon:'🔴', title:t('teamBLink'), desc:t('sendTo', { team:this.config.teamB }) },
        { key:'broadcaster', input:'link-spec', tone:'gold', icon:'📺', title:t('broadcastPreviewLink'), desc:t('broadcastPreviewDesc'), full:true },
      ];
      grid.innerHTML = rows.map(row => `
        <div class="setting-card ${row.full ? 'full-width' : ''}">
          <div class="card-header"><div class="card-icon ${row.tone}">${row.icon}</div><div><div class="card-title">${escapeAttribute(row.title)}</div><div class="card-desc">${escapeAttribute(row.desc)}</div></div></div>
          <div class="card-body"><div style="display:flex;gap:8px">
            <input class="form-control" id="${row.input}" value="${escapeAttribute(room.links?.[row.key] || '')}" readonly style="font-size:0.72rem">
            <button class="btn ${row.tone === 'blue' ? 'btn-blue' : row.tone === 'red' ? 'btn-red' : 'btn-ghost'} btn-sm" data-copy-link="${row.input}" type="button">COPY</button>
          </div></div>
        </div>`).join('');
      grid.querySelectorAll('[data-copy-link]').forEach(button => button.addEventListener('click', async () => {
        const input = document.getElementById(button.dataset.copyLink);
        if (!input?.value) return;
        await navigator.clipboard.writeText(input.value);
        const original = button.textContent;
        button.textContent = 'COPIED';
        setTimeout(() => { button.textContent = original; }, 1500);
      }));
      status.textContent = `LIVE ROOM ${room.roomCode} · Team links control only their own turns. Broadcast is view-only.`;
      status.classList.add('success');
    } catch (error) {
      status.textContent = error?.message || String(error);
      status.classList.add('error');
      grid.innerHTML = '';
    }
  }

}

const MOBILE_BREAKPOINT = 900;

const COPY = Object.freeze({
  en: { menu:'Menu', close:'Close menu', navigation:'Navigation', appearance:'Appearance & accessibility', language:'Language', account:'Account', profile:'Profile settings', publicProfile:'Public profile', loading:'Loading account…', home:'Home', portal:'Player & Captain Portal', ops:'Tournament Operations', login:'Log in', register:'Create account', logout:'Log out', theme:'Theme', system:'System', dark:'Dark', light:'Light', contrast:'Contrast', standard:'Standard', high:'High', palette:'Role palette', default:'Default', accessible:'Color-safe', motion:'Motion', full:'Full', reduced:'Reduced' },
  ja: { menu:'メニュー', close:'メニューを閉じる', navigation:'ナビゲーション', appearance:'表示とアクセシビリティ', language:'言語', account:'アカウント', profile:'プロフィール設定', publicProfile:'公開プロフィール', loading:'アカウントを読み込み中…', home:'ホーム', portal:'プレイヤー＆キャプテンポータル', ops:'大会運営', login:'ログイン', register:'アカウント作成', logout:'ログアウト', theme:'テーマ', system:'システム', dark:'ダーク', light:'ライト', contrast:'コントラスト', standard:'標準', high:'高', palette:'ロール配色', default:'デフォルト', accessible:'色覚対応', motion:'モーション', full:'フル', reduced:'低減' },
  'zh-CN': { menu:'菜单', close:'关闭菜单', navigation:'导航', appearance:'界面与无障碍', language:'语言', account:'账号', profile:'资料设置', publicProfile:'公开资料', loading:'正在加载账号…', home:'首页', portal:'玩家与队长入口', ops:'赛事运营', login:'登录', register:'创建账号', logout:'退出登录', theme:'主题', system:'跟随系统', dark:'深色', light:'浅色', contrast:'对比度', standard:'标准', high:'高', palette:'定位配色', default:'默认', accessible:'色觉友好', motion:'动态效果', full:'完整', reduced:'减少' },
  ko: { menu:'메뉴', close:'메뉴 닫기', navigation:'탐색', appearance:'화면 및 접근성', language:'언어', account:'계정', profile:'프로필 설정', publicProfile:'공개 프로필', loading:'계정 불러오는 중…', home:'홈', portal:'플레이어 및 캡틴 포털', ops:'대회 운영', login:'로그인', register:'계정 만들기', logout:'로그아웃', theme:'테마', system:'시스템', dark:'다크', light:'라이트', contrast:'대비', standard:'표준', high:'높음', palette:'역할 색상', default:'기본', accessible:'색각 보정', motion:'모션', full:'전체', reduced:'줄이기' },
  es: { menu:'Menú', close:'Cerrar menú', navigation:'Navegación', appearance:'Apariencia y accesibilidad', language:'Idioma', account:'Cuenta', profile:'Ajustes del perfil', publicProfile:'Perfil público', loading:'Cargando cuenta…', home:'Inicio', portal:'Portal de jugadores y capitanes', ops:'Operaciones del torneo', login:'Iniciar sesión', register:'Crear cuenta', logout:'Cerrar sesión', theme:'Tema', system:'Sistema', dark:'Oscuro', light:'Claro', contrast:'Contraste', standard:'Estándar', high:'Alto', palette:'Paleta de roles', default:'Predeterminada', accessible:'Apta para daltonismo', motion:'Movimiento', full:'Completo', reduced:'Reducido' },
  vi: { menu:'Menu', close:'Đóng menu', navigation:'Điều hướng', appearance:'Giao diện & khả năng truy cập', language:'Ngôn ngữ', account:'Tài khoản', profile:'Cài đặt hồ sơ', publicProfile:'Hồ sơ công khai', loading:'Đang tải tài khoản…', home:'Trang chủ', portal:'Cổng Người chơi & Đội trưởng', ops:'Vận hành giải đấu', login:'Đăng nhập', register:'Tạo tài khoản', logout:'Đăng xuất', theme:'Giao diện', system:'Theo hệ thống', dark:'Tối', light:'Sáng', contrast:'Độ tương phản', standard:'Tiêu chuẩn', high:'Cao', palette:'Bảng màu vai trò', default:'Mặc định', accessible:'Dễ phân biệt màu', motion:'Chuyển động', full:'Đầy đủ', reduced:'Giảm' },
});

const LOCALES = Object.freeze({ en:'English', ja:'日本語', 'zh-CN':'简体中文', ko:'한국어', es:'Español', vi:'Tiếng Việt' });

function localeKey() {
  let saved = '';
  try { saved = localStorage.getItem('gs_locale') || ''; } catch { /* Storage may be unavailable. */ }
  const raw = String(saved || document.documentElement.lang || navigator.language || 'en').toLowerCase();
  if (raw.startsWith('ja')) return 'ja';
  if (raw.startsWith('zh')) return 'zh-CN';
  if (raw.startsWith('ko')) return 'ko';
  if (raw.startsWith('es')) return 'es';
  if (raw.startsWith('vi')) return 'vi';
  return 'en';
}

function copy() { return COPY[localeKey()] || COPY.en; }

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;',
  }[character]));
}

function i18nAttribute(element, key) {
  element.dataset.i18n = key;
  return element;
}

function navigationSources() {
  const selectors = [
    '#ops-tabs [data-tab]',
    '.home-nav > nav a',
    '.content-nav > nav a',
    '.ops-top-actions a',
    '.setup-actions a',
    '.gs-standalone-nav > a',
    '.legal-top > a',
    '.legal-footer a',
    '#series-open-ops',
  ];
  return [...document.querySelectorAll(selectors.join(','))]
    .filter(element => !element.closest('.mobile-nav-root, .gs-global-menu'));
}

function sourceKey(source) {
  if (source.dataset.tab) return `tab:${source.dataset.tab}`;
  const href = source.getAttribute('href') || '';
  return `href:${href}`;
}

function copyTranslationMetadata(source, target) {
  ['i18n','i18nAriaLabel','noI18n'].forEach(key => {
    if (source.dataset[key] !== undefined) target.dataset[key] = source.dataset[key];
  });
}

function createMobileNav() {
  if (document.querySelector('.mobile-nav-root')) return;
  const text = copy();
  const root = document.createElement('div');
  root.className = 'mobile-nav-root';
  root.innerHTML = `
    <button class="mobile-nav-toggle" type="button" aria-controls="mobile-nav-drawer" aria-expanded="false" aria-label="${escapeHtml(text.menu)}" data-i18n-aria-label="mobileMenu">
      <span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>
    </button>
    <div class="mobile-nav-backdrop" hidden></div>
    <aside class="mobile-nav-drawer" id="mobile-nav-drawer" aria-hidden="true" aria-labelledby="mobile-nav-title" tabindex="-1">
      <header class="mobile-nav-head"><div><span aria-hidden="true">RA</span><b id="mobile-nav-title">RENDEZVU ARENA</b></div><button type="button" class="mobile-nav-close" aria-label="${escapeHtml(text.close)}" data-i18n-aria-label="mobileClose">×</button></header>
      <div class="mobile-nav-scroll">
        <section><h2 data-i18n="mobileNavigation">${escapeHtml(text.navigation)}</h2><div class="mobile-nav-list" data-mobile-navigation></div></section>
        <section><h2 data-i18n="mobileAppearance">${escapeHtml(text.appearance)}</h2><div class="mobile-nav-preferences" data-mobile-preferences></div></section>
        <section><h2 data-i18n="mobileLanguage">${escapeHtml(text.language)}</h2><div class="mobile-nav-language" data-mobile-language></div></section>
        <section><h2 data-i18n="mobileAccount">${escapeHtml(text.account)}</h2><div class="mobile-nav-account" data-mobile-account><span>${escapeHtml(text.loading)}</span></div></section>
      </div>
    </aside>`;
  document.body.appendChild(root);

  const toggle = root.querySelector('.mobile-nav-toggle');
  const drawer = root.querySelector('.mobile-nav-drawer');
  const backdrop = root.querySelector('.mobile-nav-backdrop');
  const navigation = root.querySelector('[data-mobile-navigation]');
  const account = root.querySelector('[data-mobile-account]');
  let previousFocus = null;

  function renderNavigation() {
    navigation.replaceChildren();
    const seen = new Set();
    navigationSources().forEach(source => {
      const key = sourceKey(source);
      if (seen.has(key) || source.classList.contains('hidden')) return;
      seen.add(key);
      const item = document.createElement(source.dataset.tab ? 'button' : 'a');
      item.className = 'mobile-nav-item';
      item.textContent = source.textContent.trim();
      copyTranslationMetadata(source, item);
      if (source.dataset.tab) {
        item.type = 'button';
        item.classList.toggle('active', source.classList.contains('active'));
        item.addEventListener('click', () => {
          source.click();
          closeDrawer();
        });
      } else {
        item.href = source.getAttribute('href') || '/';
        if (source.getAttribute('target')) item.target = source.getAttribute('target');
        item.addEventListener('click', closeDrawer);
      }
      navigation.appendChild(item);
    });

    const fallbacks = [
      ['href:/', '/', text.home, 'home'],
      ['href:/portal.html', '/portal.html', text.portal, 'playerPortalLink'],
      ['href:/dashboard.html', '/dashboard.html', text.ops, 'tournamentOps'],
    ];
    fallbacks.forEach(([key, href, label, i18nKey]) => {
      if (seen.has(key)) return;
      const item = i18nAttribute(document.createElement('a'), i18nKey);
      item.className = 'mobile-nav-item';
      item.href = href;
      item.textContent = label;
      item.addEventListener('click', closeDrawer);
      navigation.appendChild(item);
    });
  }

  const preferenceGroups = [
    ['theme','mobileTheme',text.theme,[['system','mobileSystem',text.system],['dark','mobileDark',text.dark],['light','mobileLight',text.light]]],
    ['contrast','mobileContrast',text.contrast,[['normal','mobileStandard',text.standard],['high','mobileHigh',text.high]]],
    ['palette','mobilePalette',text.palette,[['default','mobileDefault',text.default],['accessible','mobileAccessible',text.accessible]]],
    ['motion','mobileMotion',text.motion,[['system','mobileSystem',text.system],['full','mobileFull',text.full],['reduced','mobileReduced',text.reduced]]],
  ];
  const preferenceRoot = root.querySelector('[data-mobile-preferences]');
  preferenceGroups.forEach(([key,labelKey,label,options]) => {
    const field = document.createElement('div');
    field.className = 'mobile-nav-preference-field';
    const title = i18nAttribute(document.createElement('span'), labelKey);
    title.textContent = label;
    const choices = document.createElement('div');
    options.forEach(([value,optionKey,optionLabel]) => {
      const button = i18nAttribute(document.createElement('button'), optionKey);
      button.type = 'button';
      button.dataset.preferenceKey = key;
      button.dataset.preferenceValue = value;
      button.textContent = optionLabel;
      button.addEventListener('click', () => {
        window.GSPreferences?.set(key, value);
        syncPreferences();
      });
      choices.appendChild(button);
    });
    field.append(title, choices);
    preferenceRoot.appendChild(field);
  });

  function syncPreferences() {
    const state = window.GSPreferences?.get?.() || {};
    root.querySelectorAll('[data-preference-key]').forEach(button => {
      button.setAttribute('aria-pressed', String(state[button.dataset.preferenceKey] === button.dataset.preferenceValue));
    });
  }

  const languageRoot = root.querySelector('[data-mobile-language]');
  Object.entries(LOCALES).forEach(([code,label]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.noI18n = 'true';
    button.dataset.locale = code;
    button.textContent = label;
    button.setAttribute('aria-pressed', String(localeKey() === code));
    button.addEventListener('click', () => {
      try { localStorage.setItem('gs_locale', code); } catch { /* Storage may be unavailable. */ }
      window.location.reload();
    });
    languageRoot.appendChild(button);
  });

  async function fetchCurrentUser() {
    if (window.GSGlobalMenu?.refresh) return window.GSGlobalMenu.refresh();
    const headers = {};
    try {
      const devToken = sessionStorage.getItem('gs_dev_auth_token');
      if (devToken) headers.Authorization = `Bearer ${devToken}`;
    } catch { /* Session storage may be unavailable. */ }
    const response = await fetch('/api/auth/me', { credentials:'same-origin', cache:'no-store', headers });
    if (!response.ok) return null;
    return (await response.json().catch(() => ({}))).user || null;
  }

  function accountLink(href, label, key) {
    const link = i18nAttribute(document.createElement('a'), key);
    link.href = href;
    link.textContent = label;
    link.addEventListener('click', closeDrawer);
    return link;
  }

  async function logout() {
    try { await fetch('/api/auth/logout', { method:'POST', credentials:'same-origin', headers:{ 'X-CSRF-Token':'1' } }); } catch { /* Continue local logout. */ }
    try { localStorage.removeItem('gs_has_session'); } catch { /* Storage may be unavailable. */ }
    try { sessionStorage.removeItem('gs_dev_auth_token'); } catch { /* Session storage may be unavailable. */ }
    window.location.href = '/';
  }

  async function renderAccount() {
    account.innerHTML = `<span data-i18n="mobileAccountLoading">${escapeHtml(text.loading)}</span>`;
    let user = null;
    try { user = await fetchCurrentUser(); } catch { user = null; }
    account.replaceChildren();
    if (user) {
      const identity = document.createElement('div');
      identity.className = 'mobile-nav-identity';
      identity.innerHTML = `<b>${escapeHtml(user.displayName || user.username || text.account)}</b><span>@${escapeHtml(user.username || '')}</span>`;
      account.append(
        identity,
        accountLink('/portal.html#profile-settings', text.profile, 'mobileProfile'),
        accountLink(`/profile.html?user=${encodeURIComponent(user.username || '')}`, text.publicProfile, 'mobilePublicProfile'),
      );
      const button = i18nAttribute(document.createElement('button'), 'logout');
      button.type = 'button';
      button.textContent = text.logout;
      button.addEventListener('click', logout);
      account.appendChild(button);
    } else {
      account.append(
        accountLink('/auth.html', text.login, 'login'),
        accountLink('/auth.html?mode=register', text.register, 'createAccount'),
      );
    }
  }

  function openDrawer() {
    if (window.innerWidth > MOBILE_BREAKPOINT) return;
    previousFocus = document.activeElement;
    renderNavigation();
    syncPreferences();
    renderAccount();
    backdrop.hidden = false;
    root.classList.add('open');
    document.body.classList.add('mobile-nav-open');
    toggle.setAttribute('aria-expanded', 'true');
    drawer.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => drawer.focus({ preventScroll:true }));
  }

  function closeDrawer() {
    root.classList.remove('open');
    document.body.classList.remove('mobile-nav-open');
    toggle.setAttribute('aria-expanded', 'false');
    drawer.setAttribute('aria-hidden', 'true');
    backdrop.hidden = true;
    previousFocus?.focus?.({ preventScroll:true });
  }

  toggle.addEventListener('click', () => root.classList.contains('open') ? closeDrawer() : openDrawer());
  root.querySelector('.mobile-nav-close').addEventListener('click', closeDrawer);
  backdrop.addEventListener('click', closeDrawer);
  window.addEventListener('resize', () => { if (window.innerWidth > MOBILE_BREAKPOINT) closeDrawer(); });
  window.addEventListener('gs:preferences-changed', syncPreferences);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && root.classList.contains('open')) closeDrawer();
    if (event.key !== 'Tab' || !root.classList.contains('open')) return;
    const focusable = [
      ...drawer.querySelectorAll('a[href]'),
      ...drawer.querySelectorAll('button:not([disabled])'),
      ...drawer.querySelectorAll('[tabindex="0"]'),
    ];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createMobileNav, { once:true });
else createMobileNav();

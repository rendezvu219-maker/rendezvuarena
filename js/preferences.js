(function () {
  'use strict';

  const root = document.documentElement;
  const storage = {
    get(key, fallback) {
      try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch { /* Storage may be unavailable in private embeds. */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch { /* Ignore unavailable storage. */ }
    },
  };

  const mediaDark = window.matchMedia('(prefers-color-scheme: dark)');
  const mediaReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  const allowed = {
    theme: new Set(['system', 'dark', 'light']),
    contrast: new Set(['normal', 'high']),
    palette: new Set(['default', 'accessible']),
    motion: new Set(['system', 'full', 'reduced']),
  };

  const state = {
    theme: storage.get('gs_ui_theme', 'system'),
    contrast: storage.get('gs_ui_contrast', 'normal'),
    palette: storage.get('gs_ui_palette', 'default'),
    motion: storage.get('gs_ui_motion', 'system'),
  };

  for (const [key, values] of Object.entries(allowed)) {
    if (!values.has(state[key])) state[key] = key === 'theme' || key === 'motion' ? 'system' : key === 'contrast' ? 'normal' : 'default';
  }

  const COPY = {
    en: {
      home: 'Home', portal: 'Manage Your Profile', publicProfile: 'View public profile', appearance: 'Appearance settings',
      login: 'Log in', register: 'Create account', logout: 'Log out', guest: 'Guest', accountMenu: 'Open account menu',
      appearanceTitle: 'Appearance & Accessibility', appearanceDesc: 'These settings apply across every RendezVu Arena page.',
      close: 'Close settings', theme: 'Theme', system: 'System', dark: 'Dark', light: 'Light', contrast: 'Contrast',
      standard: 'Standard', high: 'High contrast', palette: 'Role palette', default: 'Default', accessible: 'Color-safe',
      motion: 'Motion', full: 'Full', reduced: 'Reduced', note: 'Role icons and text labels remain visible in every palette. Reduced motion disables shake, flash-heavy transitions and decorative looping animation.',
      homeTitle: 'Go to home page', accountUnavailable: 'Account details unavailable',
    },
    vi: {
      home: 'Trang chủ', portal: 'Hồ sơ & cài đặt tài khoản', publicProfile: 'Xem hồ sơ công khai', appearance: 'Cài đặt giao diện',
      login: 'Đăng nhập', register: 'Tạo tài khoản', logout: 'Đăng xuất', guest: 'Khách', accountMenu: 'Mở menu tài khoản',
      appearanceTitle: 'Giao diện & khả năng truy cập', appearanceDesc: 'Các cài đặt này được áp dụng trên toàn bộ trang RendezVu Arena.',
      close: 'Đóng cài đặt', theme: 'Giao diện', system: 'Theo hệ thống', dark: 'Tối', light: 'Sáng', contrast: 'Độ tương phản',
      standard: 'Tiêu chuẩn', high: 'Tương phản cao', palette: 'Bảng màu vai trò', default: 'Mặc định', accessible: 'Dễ phân biệt màu',
      motion: 'Chuyển động', full: 'Đầy đủ', reduced: 'Giảm chuyển động', note: 'Biểu tượng và nhãn vai trò luôn được hiển thị. Chế độ giảm chuyển động sẽ tắt rung, nháy mạnh và hoạt ảnh trang trí lặp lại.',
      homeTitle: 'Về trang chủ', accountUnavailable: 'Không tải được thông tin tài khoản',
    },
    ja: {
      home: 'ホーム', portal: 'プロフィール・アカウント設定', publicProfile: '公開プロフィールを見る', appearance: '表示設定',
      login: 'ログイン', register: 'アカウント作成', logout: 'ログアウト', guest: 'ゲスト', accountMenu: 'アカウントメニューを開く',
      appearanceTitle: '表示とアクセシビリティ', appearanceDesc: 'この設定は RendezVu Arena の全ページに適用されます。',
      close: '設定を閉じる', theme: 'テーマ', system: 'システム', dark: 'ダーク', light: 'ライト', contrast: 'コントラスト',
      standard: '標準', high: 'ハイコントラスト', palette: 'ロール配色', default: 'デフォルト', accessible: '色覚対応',
      motion: 'モーション', full: 'フル', reduced: '低減', note: 'ロールのアイコンとラベルは常に表示されます。モーション低減では揺れ、強い点滅、装飾ループを無効にします。',
      homeTitle: 'ホームへ戻る', accountUnavailable: 'アカウント情報を取得できません',
    },
    'zh-CN': {
      home: '主页', portal: '个人资料与账号设置', publicProfile: '查看公开资料', appearance: '界面设置',
      login: '登录', register: '创建账号', logout: '退出登录', guest: '访客', accountMenu: '打开账号菜单',
      appearanceTitle: '界面与无障碍', appearanceDesc: '这些设置会应用到 RendezVu Arena 的所有页面。',
      close: '关闭设置', theme: '主题', system: '跟随系统', dark: '深色', light: '浅色', contrast: '对比度',
      standard: '标准', high: '高对比度', palette: '定位配色', default: '默认', accessible: '色觉友好',
      motion: '动态效果', full: '完整', reduced: '减少动态', note: '所有配色都会保留定位图标和文字标签。减少动态会关闭抖动、强闪烁和循环装饰动画。',
      homeTitle: '返回主页', accountUnavailable: '无法读取账号信息',
    },
    ko: {
      home: '홈', portal: '프로필 및 계정 설정', publicProfile: '공개 프로필 보기', appearance: '화면 설정',
      login: '로그인', register: '계정 만들기', logout: '로그아웃', guest: '게스트', accountMenu: '계정 메뉴 열기',
      appearanceTitle: '화면 및 접근성', appearanceDesc: '이 설정은 RendezVu Arena의 모든 페이지에 적용됩니다.',
      close: '설정 닫기', theme: '테마', system: '시스템', dark: '다크', light: '라이트', contrast: '대비',
      standard: '표준', high: '고대비', palette: '역할 색상', default: '기본', accessible: '색각 보정',
      motion: '모션', full: '전체', reduced: '줄이기', note: '모든 색상 설정에서 역할 아이콘과 텍스트 라벨이 유지됩니다. 모션 줄이기는 흔들림, 강한 점멸, 반복 장식 애니메이션을 끕니다.',
      homeTitle: '홈으로 이동', accountUnavailable: '계정 정보를 불러올 수 없습니다',
    },
    es: {
      home: 'Inicio', portal: 'Perfil y ajustes de cuenta', publicProfile: 'Ver perfil público', appearance: 'Ajustes de apariencia',
      login: 'Iniciar sesión', register: 'Crear cuenta', logout: 'Cerrar sesión', guest: 'Invitado', accountMenu: 'Abrir menú de cuenta',
      appearanceTitle: 'Apariencia y accesibilidad', appearanceDesc: 'Estos ajustes se aplican a todas las páginas de RendezVu Arena.',
      close: 'Cerrar ajustes', theme: 'Tema', system: 'Sistema', dark: 'Oscuro', light: 'Claro', contrast: 'Contraste',
      standard: 'Estándar', high: 'Alto contraste', palette: 'Paleta de roles', default: 'Predeterminada', accessible: 'Apta para daltonismo',
      motion: 'Movimiento', full: 'Completo', reduced: 'Reducido', note: 'Los iconos y etiquetas de rol siempre permanecen visibles. El movimiento reducido desactiva sacudidas, destellos intensos y animaciones decorativas repetitivas.',
      homeTitle: 'Ir a la página de inicio', accountUnavailable: 'No se pudo cargar la cuenta',
    },
  };

  function localeKey() {
    const saved = storage.get('gs_locale', '');
    const raw = saved || root.lang || navigator.language || 'en';
    if (String(raw).toLowerCase().startsWith('vi')) return 'vi';
    if (String(raw).toLowerCase().startsWith('ja')) return 'ja';
    if (String(raw).toLowerCase().startsWith('zh')) return 'zh-CN';
    if (String(raw).toLowerCase().startsWith('ko')) return 'ko';
    if (String(raw).toLowerCase().startsWith('es')) return 'es';
    return 'en';
  }

  function text() { return COPY[localeKey()] || COPY.en; }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    }[character]));
  }

  function apply() {
    root.dataset.theme = state.theme === 'system' ? (mediaDark.matches ? 'dark' : 'light') : state.theme;
    root.dataset.themePreference = state.theme;
    root.dataset.contrast = state.contrast;
    root.dataset.palette = state.palette;
    root.dataset.motion = state.motion === 'system' ? (mediaReduced.matches ? 'reduced' : 'full') : state.motion;
    root.dataset.motionPreference = state.motion;
    root.style.colorScheme = root.dataset.theme;
    window.dispatchEvent(new CustomEvent('gs:preferences-changed', { detail: { ...state, resolvedTheme: root.dataset.theme, resolvedMotion: root.dataset.motion } }));
  }

  function setPreference(key, value) {
    if (!allowed[key]?.has(value)) return;
    state[key] = value;
    storage.set(`gs_ui_${key}`, value);
    apply();
    syncButtons();
  }

  function syncButtons() {
    document.querySelectorAll('[data-preference-key][data-preference-value]').forEach(button => {
      const selected = state[button.dataset.preferenceKey] === button.dataset.preferenceValue;
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function field(label, key, options, two = false) {
    const buttons = options.map(([value, labelText]) => `<button type="button" data-preference-key="${key}" data-preference-value="${value}" aria-pressed="false">${escapeHtml(labelText)}</button>`).join('');
    return `<div class="ui-preferences-field"><span>${escapeHtml(label)}</span><div class="ui-preferences-options${two ? ' two' : ''}">${buttons}</div></div>`;
  }

  function makeHomeClickable(element) {
    if (!element || element.matches('a')) return;
    element.classList.add('gs-home-brand-clickable');
    element.setAttribute('role', 'link');
    element.setAttribute('tabindex', '0');
    element.setAttribute('title', text().homeTitle);
    const goHome = () => { window.location.href = '/'; };
    element.addEventListener('click', goHome);
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        goHome();
      }
    });
  }

  function wireHomeBrands() {
    document.querySelectorAll('.setup-logo, .auth-promo .home-brand, .quick-access-card > .logo-icon').forEach(makeHomeClickable);

    document.querySelectorAll('.ops-topbar').forEach(topbar => {
      if (topbar.querySelector(':scope > .gs-ops-home-brand')) return;
      const titleBlock = topbar.firstElementChild;
      if (!titleBlock || titleBlock.classList.contains('ops-top-actions') || titleBlock.classList.contains('gs-language-slot')) return;
      const anchor = document.createElement('a');
      anchor.className = 'gs-ops-home-brand';
      anchor.href = '/';
      anchor.title = text().homeTitle;
      const mark = document.createElement('span');
      mark.className = 'gs-ops-home-mark';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = 'GS';
      titleBlock.replaceWith(anchor);
      anchor.append(mark, titleBlock);
    });

    document.querySelectorAll('.gs-standalone-nav').forEach(nav => {
      if (nav.querySelector('.gs-standalone-brand')) return;
      const brand = document.createElement('a');
      brand.className = 'gs-standalone-brand';
      brand.href = '/';
      brand.title = text().homeTitle;
      brand.innerHTML = '<span aria-hidden="true">GS</span><b>GEKISHIN</b>';
      nav.prepend(brand);
    });

    const draftTools = document.querySelector('.draft-header-tools');
    if (draftTools && !draftTools.querySelector('.draft-home-brand')) {
      const home = document.createElement('a');
      home.className = 'draft-home-brand';
      home.href = '/';
      home.title = text().homeTitle;
      home.setAttribute('aria-label', text().homeTitle);
      home.textContent = 'GS';
      draftTools.prepend(home);
    }
  }

  function wirePasswordVisibility() {
    const labels = {
      en: { show: 'Show password', hide: 'Hide password' },
      vi: { show: 'Hiện mật khẩu', hide: 'Ẩn mật khẩu' },
      ja: { show: 'パスワードを表示', hide: 'パスワードを隠す' },
      'zh-CN': { show: '显示密码', hide: '隐藏密码' },
      ko: { show: '비밀번호 표시', hide: '비밀번호 숨기기' },
      es: { show: 'Mostrar contraseña', hide: 'Ocultar contraseña' },
    };
    const copy = labels[localeKey()] || labels.en;

    document.querySelectorAll("input[type='password']").forEach(input => {
      if (input.closest('.gs-password-field')) return;
      const field = document.createElement('span');
      field.className = 'gs-password-field';
      input.before(field);
      field.appendChild(input);

      const button = document.createElement('button');
      button.className = 'gs-password-toggle';
      button.type = 'button';
      button.setAttribute('data-no-i18n', 'true');
      button.setAttribute('aria-pressed', 'false');
      if (input.id) button.setAttribute('aria-controls', input.id);
      button.setAttribute('aria-label', copy.show);
      button.title = copy.show;
      button.innerHTML = `
        <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
          <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"></path>
          <circle cx="12" cy="12" r="2.75"></circle>
          <path class="gs-password-toggle-slash" d="m4 4 16 16"></path>
        </svg>`;
      button.addEventListener('click', () => {
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        button.setAttribute('aria-pressed', String(visible));
        button.setAttribute('aria-label', visible ? copy.hide : copy.show);
        button.title = visible ? copy.hide : copy.show;
        input.focus({ preventScroll: true });
        const caret = input.value.length;
        input.setSelectionRange?.(caret, caret);
      });
      field.appendChild(button);
    });
  }

  async function fetchCurrentUser() {
    const headers = {};
    try {
      const devToken = sessionStorage.getItem('gs_dev_auth_token');
      if (devToken) headers.Authorization = `Bearer ${devToken}`;
    } catch { /* Ignore unavailable session storage. */ }
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store', headers });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({}));
    return payload.user || null;
  }

  function initials(user) {
    const source = String(user?.displayName || user?.username || 'GS').trim();
    const words = source.split(/\s+/).filter(Boolean);
    return (words.length > 1 ? `${words[0][0]}${words.at(-1)[0]}` : source.slice(0, 2)).toUpperCase();
  }

  function createUi() {
    wirePasswordVisibility();
    if (document.querySelector('.gs-global-menu')) return;
    wireHomeBrands();

    // Broadcast pages are clean OBS overlays and intentionally do not receive interactive site controls.
    if (document.body.classList.contains('broadcast-page')) return;

    const copy = text();
    const dialog = document.createElement('dialog');
    dialog.className = 'ui-preferences-dialog';
    dialog.setAttribute('aria-labelledby', 'ui-preferences-title');
    dialog.innerHTML = `
      <div class="ui-preferences-card">
        <div class="ui-preferences-head">
          <div><h2 id="ui-preferences-title">${escapeHtml(copy.appearanceTitle)}</h2><p>${escapeHtml(copy.appearanceDesc)}</p></div>
          <button class="ui-preferences-close" type="button" aria-label="${escapeHtml(copy.close)}">✕</button>
        </div>
        <div class="ui-preferences-grid">
          ${field(copy.theme, 'theme', [['system', copy.system], ['dark', copy.dark], ['light', copy.light]])}
          ${field(copy.contrast, 'contrast', [['normal', copy.standard], ['high', copy.high]], true)}
          ${field(copy.palette, 'palette', [['default', copy.default], ['accessible', copy.accessible]], true)}
          ${field(copy.motion, 'motion', [['system', copy.system], ['full', copy.full], ['reduced', copy.reduced]])}
        </div>
        <p class="ui-preferences-note">${escapeHtml(copy.note)}</p>
      </div>`;

    const menu = document.createElement('div');
    menu.className = 'gs-global-menu';
    menu.innerHTML = `
      <button class="gs-global-menu-trigger" type="button" aria-expanded="false" aria-haspopup="menu" aria-label="${escapeHtml(copy.accountMenu)}" title="${escapeHtml(copy.accountMenu)}">
        <span class="gs-global-menu-avatar" aria-hidden="true">GS</span>
        <span class="gs-global-menu-trigger-copy"><b data-trigger-name>${escapeHtml(copy.guest)}</b><small data-trigger-meta>GEKISHIN SQUADRA</small></span>
        <span class="gs-global-menu-chevron" aria-hidden="true">⌄</span>
      </button>
      <div class="gs-global-menu-panel" role="menu" hidden>
        <div class="gs-global-menu-user"><span class="gs-global-menu-user-avatar">GS</span><div><b>${escapeHtml(copy.guest)}</b><small>GEKISHIN SQUADRA</small></div></div>
        <div class="gs-global-menu-links">
          <a data-public-profile href="/auth.html" role="menuitem"><span aria-hidden="true">◉</span>${escapeHtml(copy.publicProfile)}</a>
          <a data-account-settings href="/portal.html#profile-settings" role="menuitem"><span aria-hidden="true">⚙</span>${escapeHtml(copy.portal)}</a>
          <button data-open-preferences type="button" role="menuitem"><span aria-hidden="true">Aa</span>${escapeHtml(copy.appearance)}</button>
          <a href="/" role="menuitem"><span aria-hidden="true">⌂</span>${escapeHtml(copy.home)}</a>
        </div>
        <div class="gs-global-menu-auth">
          <a data-login href="/auth.html" role="menuitem">${escapeHtml(copy.login)}</a>
          <a data-register class="is-primary" href="/auth.html?mode=register" role="menuitem">${escapeHtml(copy.register)}</a>
          <button data-logout type="button" role="menuitem" hidden>${escapeHtml(copy.logout)}</button>
        </div>
      </div>`;

    function accountMount() {
      return document.querySelector('#ops-user, #portal-user, #home-account, #heroes-account, [data-global-account-slot]')
        || document.querySelector('.ops-top-actions, .setup-actions, .content-account, .home-account, .gs-standalone-nav, .draft-header-tools, .legal-top');
    }

    function mountMenu(preferredMount = null) {
      const mount = preferredMount || accountMount();
      menu.classList.toggle('is-floating', !mount);
      if (!mount) {
        if (menu.parentElement !== document.body) document.body.appendChild(menu);
        return;
      }

      menu.classList.remove('is-floating');
      if (mount.matches('#home-account, #heroes-account')) {
        mount.querySelectorAll(':scope > a, :scope > button, :scope > .home-user-chip, :scope > .home-user-menu, :scope > .content-user').forEach(element => element.remove());
      }
      const languageSlot = [...mount.children].find(child => child.hasAttribute('data-language-slot')) || null;
      if (languageSlot) mount.insertBefore(menu, languageSlot);
      else if (menu.parentElement !== mount) mount.appendChild(menu);
    }

    document.body.append(dialog);
    mountMenu();
    document.querySelectorAll('#btn-logout, #portal-logout').forEach(button => button.classList.add('gs-legacy-account-action'));
    const trigger = menu.querySelector('.gs-global-menu-trigger');
    const panel = menu.querySelector('.gs-global-menu-panel');
    const appearanceButton = menu.querySelector('[data-open-preferences]');
    let currentUser = null;
    let loadingAccount = false;

    function closeMenu() {
      panel.hidden = true;
      trigger.setAttribute('aria-expanded', 'false');
    }

    function renderUser(user, failed = false) {
      currentUser = user;
      const avatarText = user ? initials(user) : 'GS';
      const displayName = user?.displayName || user?.username || copy.guest;
      const accountMeta = failed ? copy.accountUnavailable : (user ? String(user.username || '') : 'GEKISHIN SQUADRA');
      menu.querySelector('.gs-global-menu-avatar').textContent = avatarText;
      menu.querySelector('.gs-global-menu-user-avatar').textContent = avatarText;
      menu.querySelector('[data-trigger-name]').textContent = displayName;
      menu.querySelector('[data-trigger-meta]').textContent = accountMeta;
      menu.querySelector('.gs-global-menu-user b').textContent = displayName;
      menu.querySelector('.gs-global-menu-user small').textContent = accountMeta;
      menu.querySelector('[data-public-profile]').href = user ? `/profile.html?user=${encodeURIComponent(user.username)}` : '/auth.html';
      menu.querySelector('[data-account-settings]').href = user ? '/portal.html#profile-settings' : '/auth.html?return=/portal.html%23profile-settings';
      menu.querySelector('[data-login]').hidden = Boolean(user);
      menu.querySelector('[data-register]').hidden = Boolean(user);
      menu.querySelector('[data-logout]').hidden = !user;
    }

    async function refreshAccount() {
      if (loadingAccount) return currentUser;
      loadingAccount = true;
      try {
        const user = await fetchCurrentUser();
        renderUser(user);
        return user;
      } catch {
        renderUser(null, true);
        return null;
      } finally {
        loadingAccount = false;
      }
    }

    trigger.addEventListener('click', async () => {
      const willOpen = panel.hidden;
      if (!willOpen) { closeMenu(); return; }
      panel.hidden = false;
      trigger.setAttribute('aria-expanded', 'true');
      await refreshAccount();
    });
    appearanceButton.addEventListener('click', () => {
      closeMenu();
      dialog.showModal();
    });
    menu.querySelector('[data-logout]').addEventListener('click', async () => {
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': '1' } }); } catch { /* Continue local logout. */ }
      storage.remove('gs_has_session');
      try { sessionStorage.removeItem('gs_dev_auth_token'); } catch { /* Ignore unavailable storage. */ }
      window.location.href = '/';
    });
    document.addEventListener('click', event => {
      if (!menu.contains(event.target)) closeMenu();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !panel.hidden) closeMenu();
    });
    window.addEventListener('focus', () => { if (!panel.hidden) refreshAccount(); });
    window.addEventListener('gs:auth-changed', refreshAccount);

    dialog.querySelector('.ui-preferences-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('keydown', event => { if (event.key === 'Escape') dialog.close(); });
    dialog.querySelectorAll('[data-preference-key]').forEach(button => {
      button.addEventListener('click', () => setPreference(button.dataset.preferenceKey, button.dataset.preferenceValue));
    });

    renderUser(null);
    refreshAccount();
    syncButtons();

    window.GSGlobalMenu = Object.freeze({ refresh: refreshAccount, close: closeMenu, mount: mountMenu });
  }

  mediaDark.addEventListener?.('change', () => { if (state.theme === 'system') apply(); });
  mediaReduced.addEventListener?.('change', () => { if (state.motion === 'system') apply(); });

  apply();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', createUi, { once: true });
  else createUi();

  window.GSPreferences = Object.freeze({
    get: () => ({ ...state, resolvedTheme: root.dataset.theme, resolvedMotion: root.dataset.motion }),
    set: setPreference,
  });
})();

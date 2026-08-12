// Dragon Ball RendezVu Arena - Hero Database (current official roster)

export const ROLES = {
  Damage:    { name: 'Damage',    color: 'var(--role-damage)', glow: 'var(--role-damage-glow)',   icon: 'DMG', label: 'DMG',  max: 2, iconPath: 'assets/roles/damage.png' },
  Tank:      { name: 'Tank',      color: 'var(--role-tank)', glow: 'var(--role-tank-glow)',   icon: 'TANK', label: 'TANK', max: 1, iconPath: 'assets/roles/tank.png' },
  Technical: { name: 'Technical', color: 'var(--role-tech)', glow: 'var(--role-tech-glow)',  icon: 'TECH', label: 'TECH', max: 1, iconPath: 'assets/roles/technical.png' },
};

export function roleIconMarkup(roleName, className = 'role-icon-image', alt = '') {
  const role = ROLES[roleName];
  if (!role) return '';
  const safeAlt = String(alt || role.name).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  return `<span class="${className} role-icon-mark" role="img" aria-label="${safeAlt}"><img src="${role.iconPath}" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="role-icon-fallback" hidden aria-hidden="true">${role.icon}</span></span>`;
}

// Cosmetic draft aura accents. These never redefine app surfaces, team-side colors or role colors.
export const THEMES = {
  beerus: {
    name: 'Beerus Aura',
    accent: 'var(--aura-beerus-accent)',
    accentGlow: 'var(--aura-beerus-glow)',
    desc: 'Restrained gold aura for hero previews and cinematic lock-ins.',
  },
  'goku-black': {
    name: 'Goku Black Aura',
    accent: 'var(--aura-goku-black-accent)',
    accentGlow: 'var(--aura-goku-black-glow)',
    desc: 'Rosé aura for hero previews and cinematic lock-ins.',
  },
};

const LEGACY_AURA_IDS = Object.freeze({
  base: 'beerus',
  blue: 'beerus',
  mui: 'beerus',
  gold: 'beerus',
  'rosé': 'goku-black',
  rose: 'goku-black',
  season6: 'beerus',
});

export function normalizeAuraId(themeId) {
  const requested = String(themeId || '').trim().toLowerCase();
  const normalized = LEGACY_AURA_IDS[requested] || requested;
  return THEMES[normalized] ? normalized : 'beerus';
}

export function getHeroImg(id) {
  return `/assets/heroes/${id}/btn_character.webp`;
}
export function getHeroImgSp(id) {
  return `/assets/heroes/${id}/btn_character_sp.webp`;
}
export function getHeroImgHover(id) {
  return `/assets/heroes/${id}/btn_character_hover.webp`;
}
const HERO_FULL_IMAGE_VERSIONS = {
  '0039': '2',
};

export function getHeroFullImg(id) {
  const version = HERO_FULL_IMAGE_VERSIONS[id];
  const query = version ? `?v=${version}` : '';
  return `/assets/heroes/${id}/image_character.webp${query}`;
}

export function imageWithFallback(primary, fallback, alt, className = '') {
  const escapeAttribute = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  }[char]));
  return `<img class="${escapeAttribute(className)}" src="${escapeAttribute(primary)}" alt="${escapeAttribute(alt)}" loading="lazy" data-fallback-src="${escapeAttribute(fallback)}">`;
}


export const NIKITA_EASTER_EGG = Object.freeze({
  heroId: '0017',
  trigger: 'nikita',
  minimumTriggerLength: 3,
  searchAliases: Object.freeze(['nikita', 'daima']),
  imagePath: '/assets/easter-eggs/goku-mini-nikita.png',
  descriptions: Object.freeze({
    en: "A hero who... wait, why is he pink? ...Anyway—\nA hero who skillfully keeps enemies at mid-range! Rush in with a flurry of Power Pole attacks and maneuver alongside Panzy and Glorio!\nNikita's Daima Goku wears his signature pink skin—the one he always plays best in. Word has it Indomie noodles might as well be his second weapon.",
    vi: 'Một chiến binh... khoan, sao cậu ấy lại mặc đồ hồng? ...Dù sao thì—\nMột chiến binh khéo léo giữ kẻ địch ở tầm trung! Hãy lao vào bằng chuỗi đòn Gậy Như Ý dồn dập và phối hợp cùng Panzy và Glorio!\nGoku Daima của Nikita sử dụng bộ skin hồng đặc trưng—cũng chính là skin mà anh ấy luôn chơi hay nhất. Nghe đồn mì Indome chẳng khác nào vũ khí thứ hai của anh ấy.',
    ja: '敵との間合いを保って闘う中距離型ヒーロー！\n怒涛の如意棒ラッシュでパンジやグロリオと大暴れしよう！\nピンクの服を着たDAIMA悟空とインドミーが大好きなニキータのための特別バージョン！',
    'zh-CN': '一名擅长与敌人保持距离的中距离英雄！\n施展猛烈的如意棒连击，与庞吉和古罗里奥一起大闹战场吧！\n这是为尼基塔准备的粉色特别版——他最喜欢粉衣DAIMA悟空和Indomie方便面！',
    ko: '적과 거리를 유지하며 싸우는 중거리형 히어로!\n맹렬한 여의봉 연타로 팬지, 글로리오와 함께 전장을 휘저어 보자!\n분홍색 DAIMA 오공과 인도미 라면을 좋아하는 니키타를 위한 특별 버전!',
    es: '¡Un héroe de media distancia que mantiene a sus enemigos a raya!\n¡Ataca con una ráfaga del Bastón de Poder y maniobra junto a Panzy y Glorio!\nUna versión especial para Nikita: Goku de DAIMA vestido de rosa y con energía de fideos Indomie.',
  }),
});

function normalizeHeroSearch(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase();
}

export function isNikitaEasterEggSearch(value = '') {
  const tokens = normalizeHeroSearch(value).split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.some(token => (
    token.length >= NIKITA_EASTER_EGG.minimumTriggerLength
    && token.startsWith(NIKITA_EASTER_EGG.trigger.slice(0, NIKITA_EASTER_EGG.minimumTriggerLength))
  ));
}

export function getHeroSearchText(hero, localizedName = '', localizedRole = '') {
  if (!hero) return '';
  const aliases = hero.id === NIKITA_EASTER_EGG.heroId
    ? ` ${NIKITA_EASTER_EGG.searchAliases.join(' ')}`
    : '';
  return normalizeHeroSearch(`${localizedName} ${hero.name || ''} ${localizedRole} ${hero.role || ''} ${hero.id || ''}${aliases}`);
}

export function heroMatchesSearch(hero, query = '', localizedName = '', localizedRole = '') {
  const normalizedQuery = normalizeHeroSearch(query);
  if (!normalizedQuery) return true;
  if (String(hero?.id) === NIKITA_EASTER_EGG.heroId && isNikitaEasterEggSearch(normalizedQuery)) return true;
  const haystack = getHeroSearchText(hero, localizedName, localizedRole);
  return normalizedQuery.split(/\s+/).filter(Boolean).every(token => haystack.includes(token));
}

export function getHeroDisplayImage(id, search = '', variant = 'full') {
  if (String(id) === NIKITA_EASTER_EGG.heroId && isNikitaEasterEggSearch(search)) {
    return NIKITA_EASTER_EGG.imagePath;
  }
  if (variant === 'sp') return getHeroImgSp(id);
  if (variant === 'hover') return getHeroImgHover(id);
  if (variant === 'card') return getHeroImg(id);
  return getHeroFullImg(id);
}

export function getHeroDisplayName(id, fallback = '', search = '') {
  if (String(id) === NIKITA_EASTER_EGG.heroId && isNikitaEasterEggSearch(search)) {
    return `${fallback} (Nikita?!)`;
  }
  return fallback;
}

export function getHeroDisplayDescription(id, fallback = '', search = '', locale = 'en') {
  if (String(id) !== NIKITA_EASTER_EGG.heroId || !isNikitaEasterEggSearch(search)) return fallback;
  const requested = String(locale || 'en');
  const key = requested.toLowerCase().startsWith('zh')
    ? 'zh-CN'
    : requested.toLowerCase().startsWith('vi')
      ? 'vi'
      : requested.toLowerCase().startsWith('ja')
        ? 'ja'
        : requested.toLowerCase().startsWith('ko')
          ? 'ko'
          : requested.toLowerCase().startsWith('es')
            ? 'es'
            : 'en';
  return NIKITA_EASTER_EGG.descriptions[key] || NIKITA_EASTER_EGG.descriptions.en;
}

export function getHeroTrailerUrls(id, configuredUrl = '') {
  const heroId = String(id || '').padStart(4, '0');
  return [...new Set([
    configuredUrl,
    `/assets/trailers/${heroId}.mp4`,
    `/assets/trailers/${heroId}.webm`,
    `/assets/trailers/${heroId}.mov`,
  ].filter(Boolean))];
}

export function getHeroTrailerPosterUrls(id, configuredUrl = '') {
  const heroId = String(id || '').padStart(4, '0');
  return [...new Set([
    configuredUrl,
    `/assets/trailers/${heroId}.png`,
    `/assets/trailers/${heroId}.webp`,
    `/assets/trailers/${heroId}.jpg`,
    `/assets/trailers/${heroId}.jpeg`,
  ].filter(Boolean))];
}
export function getHeroSkillIconUrls(heroId, skillId) {
  const base = `/assets/heroes/${heroId}/skill/icon_${skillId}`;
  return { primary: `${base}.png`, fallback: `${base}.webp` };
}

// Full roster (scraped from the official site)
export const HEROES = [
  { id: '0040', name: 'Jiren (Full Power)',             role: 'Tank',      isNew: true  },
  { id: '0039', name: 'Goku Black',                     role: 'Technical', isNew: true  },
  { id: '0038', name: 'Beerus',                        role: 'Damage',    isNew: true  },
  { id: '0001', name: 'Super Saiyan Son Goku',         role: 'Damage',    isNew: false },
  { id: '0002', name: 'Super Saiyan Vegeta',           role: 'Tank',      isNew: false },
  { id: '0003', name: 'Krillin',                       role: 'Technical', isNew: false },
  { id: '0004', name: 'Super Saiyan Trunks (Teen)',    role: 'Damage',    isNew: false },
  { id: '0005', name: 'Piccolo',                       role: 'Damage',    isNew: false },
  { id: '0006', name: 'Android 18',                    role: 'Damage',    isNew: false },
  { id: '0007', name: 'Majin Buu (Good)',              role: 'Technical', isNew: false },
  { id: '0008', name: 'Zamasu',                        role: 'Tank',      isNew: false },
  { id: '0009', name: 'Son Gohan (Kid)',               role: 'Technical', isNew: false },
  { id: '0010', name: 'Baby (Young Body)',             role: 'Tank',      isNew: false },
  { id: '0011', name: 'Frieza (First Form)',           role: 'Technical', isNew: false },
  { id: '0012', name: 'Dabura',                        role: 'Damage',    isNew: false },
  { id: '0013', name: 'Cooler (Final Form)',           role: 'Tank',      isNew: false },
  { id: '0014', name: 'Super Uub',                     role: 'Damage',    isNew: false },
  { id: '0015', name: 'Full Power Bojack',             role: 'Damage',    isNew: false },
  { id: '0016', name: 'Super Saiyan 2 Caulifla',      role: 'Tank',      isNew: false },
  { id: '0017', name: 'Son Goku (Mini)',               role: 'Damage',    isNew: false },
  { id: '0018', name: 'Cell (Perfect Form)',           role: 'Tank',      isNew: false },
  { id: '0019', name: 'Android 17',                    role: 'Technical', isNew: false },
  { id: '0020', name: 'Hit',                           role: 'Technical', isNew: false },
  { id: '0021', name: 'Super Saiyan Kale (Berserk)',   role: 'Damage',    isNew: false },
  { id: '0022', name: 'Gamma 1 & Gamma 2',            role: 'Damage',    isNew: false },
  { id: '0023', name: 'Super Saiyan 3 Son Goku',      role: 'Damage',    isNew: false },
  { id: '0024', name: 'Super Saiyan Gotenks',          role: 'Technical', isNew: false },
  { id: '0025', name: 'God of Destruction Toppo',      role: 'Damage',    isNew: false },
  { id: '0026', name: 'Super Saiyan 4 Vegeta',        role: 'Tank',      isNew: false },
  { id: '0027', name: 'Ultimate Gohan',                role: 'Technical', isNew: false },
  { id: '0028', name: 'Legendary Super Saiyan Broly',  role: 'Damage',    isNew: false },
  { id: '0029', name: 'Super Vegito',                  role: 'Damage',    isNew: false },
  { id: '0030', name: 'Super Saiyan Bardock',          role: 'Tank',      isNew: false },
  { id: '0031', name: 'Super Saiyan 2 Kefla',         role: 'Damage',    isNew: false },
  { id: '0032', name: 'Super Saiyan God Son Goku',     role: 'Damage',    isNew: false },
  { id: '0033', name: 'Super Saiyan God Vegeta',       role: 'Tank',      isNew: false },
  { id: '0034', name: 'Majin Buu (Pure)',              role: 'Technical', isNew: false },
  { id: '0035', name: 'Frieza (Fourth Form)',          role: 'Technical', isNew: false },
  { id: '0036', name: 'Son Goku (Youth)',              role: 'Damage',    isNew: false },
  { id: '0037', name: 'Bulma (Youth)',                 role: 'Tank',      isNew: false },
];

// 4 generic slots per team (no forced role order)
export const PICKS_PER_TEAM = 4;

// Role limits: max heroes of each role per team
export const ROLE_LIMITS = { Damage: 2, Tank: 1, Technical: 1 };

// Draft sequence generator with divine draw bans
export function generateDraftSequence(heroBans = 2, _divineBans = 0, picksPerTeam = 4) {
  const seq = [];
  const bansPerTeam = Math.min(4, Math.max(0, Math.floor(Number(heroBans) || 0)));
  const picks = Math.max(1, Math.floor(Number(picksPerTeam) || 4));

  const addTeamActions = (type, team, count) => {
    for (let i = 0; i < count; i++) seq.push({ type, team });
  };

  // Divine Draw bans are handled in the separate pre-draft Divine Draw screen.
  // They must never create extra hero-ban slots or hero-ban turns here.
  if (bansPerTeam >= 2 && picks === 4) {
    const openingBans = Math.ceil(bansPerTeam / 2);
    const secondBans = bansPerTeam - openingBans;

    // Ban phase 1: Team A completes its bans, then Team B.
    addTeamActions('ban', 'A', openingBans);
    addTeamActions('ban', 'B', openingBans);

    // Pick phase 1: A1 -> B2 -> A1.
    ['A', 'B', 'B', 'A'].forEach(team => seq.push({ type: 'pick', team }));

    // Ban phase 2: Team A completes its remaining bans, then Team B.
    addTeamActions('ban', 'A', secondBans);
    addTeamActions('ban', 'B', secondBans);

    // Pick phase 2: B1 -> A2 -> B1.
    ['B', 'A', 'A', 'B'].forEach(team => seq.push({ type: 'pick', team }));
    return seq;
  }

  // Zero/one-ban mode keeps a simple opening ban phase.
  addTeamActions('ban', 'A', bansPerTeam);
  addTeamActions('ban', 'B', bansPerTeam);

  // Standard snake order. For the normal 4-player team this is A B B A A B B A.
  const pattern = ['A', 'B', 'B', 'A', 'A', 'B', 'B', 'A'];
  for (let i = 0; i < picks * 2; i++) {
    seq.push({ type: 'pick', team: pattern[i] || (i % 4 < 2 ? 'A' : 'B') });
  }
  return seq;
}

export const STAGE_PRESETS = {
  standard: {
    name: 'Standard',
    description: 'Balanced BO3 rules for casual or practice drafts.',
    format: 'BO3',
    heroBans: 2,
    picksPerTeam: 4,
    config: {
      format: 'BO3', timerSeconds: 30, heroBans: 2, divineBans: 0,
      draftStyle: 'standard', mirrorPickMode: 'none', seriesRule: 'normal',
      enableCoinFlip: true, enableDivineDraw: true, divineDrawMode: 'random',
      enableProtect: false, protectNewest: false, protectList: [], globalBanList: [], heroRuleScope: 'match',
      cinematicLockIn: true, flashAndShake: false, theme: 'beerus',
    },
  },
  tournament: {
    name: 'Tournament',
    description: 'Longer BO5 series with three hero bans per team and deliberate turn timing.',
    format: 'BO5',
    heroBans: 3,
    picksPerTeam: 4,
    config: {
      format: 'BO5', timerSeconds: 45, heroBans: 3, divineBans: 0,
      draftStyle: 'standard', mirrorPickMode: 'none', seriesRule: 'normal',
      enableCoinFlip: true, enableDivineDraw: true, divineDrawMode: 'random',
      enableProtect: false, protectNewest: false, protectList: [], globalBanList: [], heroRuleScope: 'series',
      cinematicLockIn: true, flashAndShake: false, theme: 'beerus',
    },
  },
};

// Backward-compatible name retained for existing draft config payloads.
// The implementation now sets one isolated cosmetic data attribute only.
export function applyTheme(themeId) {
  const auraId = normalizeAuraId(themeId);
  document.documentElement.dataset.aura = auraId;
  return auraId;
}

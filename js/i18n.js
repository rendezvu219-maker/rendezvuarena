import { FULL_HERO_DETAIL_OVERRIDES } from './i18n-hero-details.js?v=0.6.36-vi-skill-master-1';
import { PAGE_UI } from './i18n-ui-pages.js?v=0.6.36-vi-skill-master-1';
import { LOCALIZED_HERO_NAMES } from './i18n-hero-names.js?v=0.6.36-vi-skill-master-1';
import { HEROES } from './heroes.js';

const STORAGE_KEY = 'gs_locale';

export const LOCALES = Object.freeze({
  en: { label: 'English', shortLabel: 'EN', htmlLang: 'en' },
  ja: { label: '日本語', shortLabel: '日本語', htmlLang: 'ja' },
  'zh-CN': { label: '简体中文', shortLabel: '简中', htmlLang: 'zh-CN' },
  ko: { label: '한국어', shortLabel: '한국어', htmlLang: 'ko' },
  es: { label: 'Español', shortLabel: 'ES', htmlLang: 'es' },
  vi: { label: 'Tiếng Việt', shortLabel: 'VI', htmlLang: 'vi' },
});

export const HERO_NAMES = LOCALIZED_HERO_NAMES;
export const EN_HERO_NAMES = Object.freeze(Object.fromEntries(HEROES.map(hero => [hero.id, hero.name])));
const HERO_ID_BY_EN_NAME = Object.freeze(Object.fromEntries(
  Object.entries(EN_HERO_NAMES).map(([id, name]) => [name, id]),
));
export const UI = Object.freeze({"en":{"home":"Home","heroes":"Heroes","quickDraft":"Quick Draft","tournamentOps":"Tournament Ops","login":"LOG IN","backHome":"BACK TO HOME","reset":"Reset","startDraft":"START DRAFT","startDraftRoom":"START DRAFT ROOM","all":"All","damage":"Damage","tank":"Tank","technical":"Technical","language":"Language","selectLanguage":"Select language","close":"CLOSE","waiting":"WAITING","complete":"COMPLETE","pickPhase":"PICK PHASE","banPhase":"BAN PHASE","divineBan":"DIVINE BAN","currentPick":"CURRENT PICK","currentBan":"CURRENT BAN","draftRoom":"DRAFT ROOM","waitingForHost":"WAITING FOR HOST...","waitingFor":"WAITING FOR {team}...","teamBlue":"TEAM BLUE","teamRed":"TEAM RED","draftComplete":"DRAFT COMPLETE","finalLocked":"FINAL TEAM COMPOSITIONS LOCKED","technicalPause":"TECHNICAL PAUSE","draftTimerPaused":"DRAFT TIMER PAUSED","paused":"PAUSED","lockIn":"LOCK IN","ban":"BAN","picks":"PICKS","bans":"BANS","selectHero":"SELECT HERO","selectHeroDetails":"Select Hero to View Details","newHero":"NEW","pickNumber":"PICK {number}","setGameWinner":"SET GAME WINNER","gameFinishedSetWinner":"GAME FINISHED? SET WINNER","fourVFourDraft":"4v4 DRAFT","difficulty":"DIFFICULTY","skills":"SKILLS","combatProfile":"COMBAT PROFILE","burstDamage":"BURST DMG","sustainedDamage":"SUSTAINED DMG","range":"RANGE","support":"SUPPORT","mobility":"MOBILITY","energyRes":"ENERGY RES","strikeRes":"STRIKE RES","passive":"PASSIVE","rushAttack":"RUSH ATTACK","skill":"SKILL","superAttack":"SUPER ATTACK","transformation":"TRANSFORMATION","searchHero":"Search hero name…","heroRoster":"39-HERO ROSTER","heroBuilds":"HEROES & DIVINE CARD BUILDS","divineCards":"DIVINE CARDS","cardLibrary":"CARD LIBRARY","loadingHero":"Loading hero data…","abilityData":"ABILITY DATA","entriesFromDb":"{count} entries from the hero database","heroId":"HERO {id}","noHeroesMatch":"No heroes match this search.","noStatProfile":"No stat profile available.","notRated":"Not rated","detailUnavailable":"Detailed hero data is not available yet.","noSkillData":"No skill data is available for this hero.","recommendedLoadout":"RECOMMENDED LOADOUT","divineCardBuilds":"DIVINE CARD BUILDS","quickDraftAccount":"QUICK DRAFT ACCOUNT","quickDraftAccountDesc":"Create one normal account to configure custom rooms. Shared Team Blue, Team Red and Broadcast links can still open directly.","loginOrCreate":"LOG IN OR CREATE ACCOUNT","playForFun":"PLAY FOR FUN","startFewClicks":"START IN A FEW CLICKS","quickIntro":"Choose a proven preset, name both teams and open the room. Detailed rules stay out of the way until you need them.","standard":"STANDARD","tournament":"TOURNAMENT","twoBans30":"2 hero bans · 30 second turns","threeBansLonger":"3 hero bans · longer series","myPresets":"MY PRESETS","myPresetsDesc":"Save the current Advanced Settings as your own reusable Quick Draft preset.","saveCurrentPreset":"SAVE CURRENT AS PRESET","optionalLogoUrl":"Optional logo URL","advancedSettings":"ADVANCED SETTINGS","advancedSettingsDesc":"Draft rules, bans, protection, presentation and share links","configuration":"Configuration","draftRules":"Draft Rules","banRules":"Ban Rules","protectionGlobalBan":"Protection & Global Ban","presentationFx":"Presentation & FX","heroAura":"Hero Aura","sharing":"Sharing","shareLinks":"Share Links","customQuickDraft":"CUSTOM QUICK DRAFT","saveCurrentSettings":"SAVE CURRENT SETTINGS","presetName":"Preset name","description":"Description","presetNameExample":"e.g. Community BO3","presetDescHelp":"Explain when this preset should be used.","savePreset":"SAVE PRESET","builtInPreset":"BUILT-IN PRESET","currentRules":"CURRENT RULES","myPreset":"MY PRESET","custom":"Custom","noDescription":"No description was added.","unsavedCustom":"Unsaved custom settings","unsavedCustomDesc":"These rules differ from the selected preset. Save them to reuse this exact setup later.","personalRules":"Personal Quick Draft rules","noPersonalPresets":"No personal presets yet. Configure Advanced Settings, then save the current setup.","series":"Series","draft":"Draft","heroBans":"Hero bans","turnTimer":"Turn timer","mirrorPick":"Mirror Pick","divineDraw":"Divine Draw","coinFlip":"Coin flip","protection":"Protection","globalBans":"Global bans","standardPickBan":"Standard Pick & Ban","allRandom":"All Random","noMirrorPicks":"No Mirror Picks","randomRoulette":"Random roulette","pickBan":"Pick / Ban","banRandom":"Ban + Random","on":"On","off":"Off","perTeam":"{count} per team","seconds":"{count} seconds","manual":"{count} manual","newHeroes":"NEW heroes","heroesCount":"{count} heroes","bansCount":"{count} bans","turnsCount":"{count}s turns","divineDrawOn":"Divine Draw on","divineDrawOff":"Divine Draw off","balancedBo3":"Balanced BO3 rules for casual or practice drafts.","longerBo5":"Longer BO5 series with three hero bans per team and deliberate turn timing.","setupCouldNotLoad":"Setup could not load","retry":"RETRY","heroAuraAccent":"Hero Aura Accent","heroAuraDesc":"This cosmetic accent is limited to hero previews and cinematic lock-ins. It never changes app theme, faction colors or role colors.","cosmeticOnly":"Cosmetic only","shareLinksDesc":"Send these links to each team so they can join the draft directly.","teamALink":"Team A Link","teamBLink":"Team B Link","sendTo":"Send to {team}","broadcastPreviewLink":"Broadcast Preview Link","broadcastPreviewDesc":"For the producer or OBS preview, not a public watch page","copy":"Copy","copied":"Copied!","resetConfirm":"Reset every Quick Draft setting to its defaults? This cannot be undone.","enterPresetName":"Enter a preset name.","preDraftInProgress":"PRE-DRAFT IN PROGRESS","preDraftDesc":"The two teams are resolving side selection, Divine Draw or pre-roll bans. The Draft Room will appear when this stage is complete.","decideSide":"DECIDE SIDE — COIN FLIP","coinFlipDesc":"Select a coin face to determine who gets first-pick advantage!","teamChoice":"{team} Choice","heads":"HEADS","tails":"TAILS","flipCoin":"FLIP COIN","divineDrawPhase":"✦ DIVINE DRAW PHASE ✦","twoDivineRules":"Two divine rules will be drawn for this match.","proceedDraft":"PROCEED TO DRAFT","gameDraftComplete":"GAME {game} DRAFT COMPLETE","recordGameWinner":"RECORD GAME WINNER","afterGameRule":"After the game finishes, select the winning team. The next Fearless draft will load automatically.","teamWon":"{team} WON THIS GAME","boSeries":"BO SERIES","waitingHostWinner":"Waiting for the Host to record the game winner.","openTournamentOps":"OPEN TOURNAMENT OPS","chat":"CHAT","roomCode":"Room Code","clickCopy":"Click to copy","typeMessage":"Type message or room code…","unavailable":"Unavailable","globalBanReason":"Global Ban — unavailable to both teams","protectedReason":"Protected — cannot be banned","currentGameBanReason":"Banned — current game","currentGamePickReason":"Already picked — cannot be banned","sameTeamDuplicateReason":"Your team already selected this hero","mirrorDisabledReason":"{role} Mirror Pick is disabled","fearlessLockReason":"Series Lock — picked in an earlier game","teamLockReason":"Team Lock — your team picked this hero earlier","roleBanReason":"Opponent completed {role} — this role can no longer be banned"},"ja":{"home":"ホーム","heroes":"ヒーロー","quickDraft":"クイックドラフト","tournamentOps":"大会運営","login":"ログイン","backHome":"ホームへ戻る","reset":"リセット","startDraft":"ドラフト開始","startDraftRoom":"ドラフトルームを開始","all":"すべて","damage":"ダメージ","tank":"タンク","technical":"テクニカル","language":"言語","selectLanguage":"言語を選択","close":"閉じる","waiting":"待機中","complete":"完了","pickPhase":"ピックフェーズ","banPhase":"BANフェーズ","divineBan":"ディバインBAN","currentPick":"現在のピック","currentBan":"現在のBAN","draftRoom":"ドラフトルーム","waitingForHost":"ホストを待っています…","waitingFor":"{team}を待っています…","teamBlue":"チームブルー","teamRed":"チームレッド","draftComplete":"ドラフト完了","finalLocked":"最終チーム構成を確定しました","technicalPause":"テクニカルポーズ","draftTimerPaused":"ドラフトタイマー停止中","paused":"一時停止","lockIn":"確定","ban":"BAN","picks":"ピック","bans":"BAN","selectHero":"ヒーローを選択","selectHeroDetails":"ヒーローを選択すると詳細が表示されます","newHero":"NEW","pickNumber":"ピック {number}","setGameWinner":"勝者を設定","gameFinishedSetWinner":"試合終了？ 勝者を設定","fourVFourDraft":"4v4 ドラフト","difficulty":"難易度","skills":"スキル","combatProfile":"戦闘プロフィール","burstDamage":"瞬間火力","sustainedDamage":"継続火力","range":"攻撃範囲","support":"補助","mobility":"機動力","energyRes":"気功波耐久","strikeRes":"打撃耐久","passive":"パッシブ","rushAttack":"ラッシュ攻撃","skill":"技","superAttack":"必殺技","transformation":"変身","searchHero":"ヒーロー名を検索…","heroRoster":"39体のヒーロー","heroBuilds":"ヒーロー＆ディバインカードビルド","divineCards":"ディバインカード","cardLibrary":"カードライブラリ","loadingHero":"ヒーローデータを読み込み中…","abilityData":"アビリティデータ","entriesFromDb":"ヒーローデータベースから {count} 件","heroId":"ヒーロー {id}","noHeroesMatch":"条件に一致するヒーローはいません。","noStatProfile":"能力プロフィールはありません。","notRated":"未評価","detailUnavailable":"ヒーローの詳細データはまだありません。","noSkillData":"このヒーローのスキルデータはありません。","recommendedLoadout":"おすすめ構成","divineCardBuilds":"ディバインカードビルド","quickDraftAccount":"クイックドラフトアカウント","quickDraftAccountDesc":"通常アカウントを1つ作成するとカスタムルームを設定できます。チームブルー、チームレッド、配信用リンクは引き続き直接開けます。","loginOrCreate":"ログイン／アカウント作成","playForFun":"気軽にプレイ","startFewClicks":"数クリックで開始","quickIntro":"実績のあるプリセットを選び、両チーム名を入力してルームを開きます。詳細ルールは必要なときだけ設定できます。","standard":"スタンダード","tournament":"トーナメント","twoBans30":"ヒーローBAN 2体・1ターン30秒","threeBansLonger":"ヒーローBAN 3体・長期シリーズ","myPresets":"マイプリセット","myPresetsDesc":"現在の詳細設定を再利用可能なクイックドラフトプリセットとして保存します。","saveCurrentPreset":"現在の設定を保存","optionalLogoUrl":"任意のロゴURL","advancedSettings":"詳細設定","advancedSettingsDesc":"ドラフトルール、BAN、保護、演出、共有リンク","configuration":"設定","draftRules":"ドラフトルール","banRules":"BANルール","protectionGlobalBan":"保護＆グローバルBAN","presentationFx":"演出＆FX","heroAura":"ヒーローオーラ","sharing":"共有","shareLinks":"共有リンク","customQuickDraft":"カスタムクイックドラフト","saveCurrentSettings":"現在の設定を保存","presetName":"プリセット名","description":"説明","presetNameExample":"例：コミュニティBO3","presetDescHelp":"このプリセットを使う場面を説明してください。","savePreset":"プリセットを保存","builtInPreset":"標準プリセット","currentRules":"現在のルール","myPreset":"マイプリセット","custom":"カスタム","noDescription":"説明はありません。","unsavedCustom":"未保存のカスタム設定","unsavedCustomDesc":"選択中のプリセットと異なるルールです。後で同じ設定を使うには保存してください。","personalRules":"個人用クイックドラフトルール","noPersonalPresets":"個人プリセットはまだありません。詳細設定を行い、現在の設定を保存してください。","series":"シリーズ","draft":"ドラフト","heroBans":"ヒーローBAN","turnTimer":"ターン時間","mirrorPick":"ミラーピック","divineDraw":"ディバインドロー","coinFlip":"コイントス","protection":"保護","globalBans":"グローバルBAN","standardPickBan":"標準ピック＆BAN","allRandom":"オールランダム","noMirrorPicks":"ミラーピックなし","randomRoulette":"ランダムルーレット","pickBan":"ピック／BAN","banRandom":"BAN＋ランダム","on":"オン","off":"オフ","perTeam":"各チーム {count}","seconds":"{count}秒","manual":"手動 {count}体","newHeroes":"NEWヒーロー","heroesCount":"{count}体","bansCount":"BAN {count}体","turnsCount":"1ターン {count}秒","divineDrawOn":"ディバインドロー：オン","divineDrawOff":"ディバインドロー：オフ","balancedBo3":"カジュアルや練習向けのバランス型BO3ルール。","longerBo5":"各チーム3体BANと余裕のあるターン時間を採用したBO5。","setupCouldNotLoad":"設定を読み込めませんでした","retry":"再試行","heroAuraAccent":"ヒーローオーラのアクセント","heroAuraDesc":"この装飾はヒーロープレビューと確定演出のみに適用され、アプリテーマ、陣営色、ロール色は変更しません。","cosmeticOnly":"装飾のみ","shareLinksDesc":"各チームがドラフトへ直接参加できるリンクを送信します。","teamALink":"チームAリンク","teamBLink":"チームBリンク","sendTo":"{team}へ送信","broadcastPreviewLink":"配信プレビューリンク","broadcastPreviewDesc":"プロデューサーまたはOBSプレビュー用。公開視聴ページではありません。","copy":"コピー","copied":"コピー済み","resetConfirm":"クイックドラフト設定を初期状態に戻しますか？ この操作は取り消せません。","enterPresetName":"プリセット名を入力してください。","preDraftInProgress":"プレドラフト進行中","preDraftDesc":"両チームが陣営選択、ディバインドロー、事前BANを進めています。完了するとドラフトルームが表示されます。","decideSide":"陣営決定 — コイントス","coinFlipDesc":"コインの面を選び、先行ピック権を決めます。","teamChoice":"{team}の選択","heads":"表","tails":"裏","flipCoin":"コインを投げる","divineDrawPhase":"✦ ディバインドローフェーズ ✦","twoDivineRules":"この試合で2つのディバインルールを抽選します。","proceedDraft":"ドラフトへ進む","gameDraftComplete":"ゲーム {game} ドラフト完了","recordGameWinner":"試合勝者を記録","afterGameRule":"試合終了後、勝利チームを選択してください。次のフィアレスドラフトが自動的に読み込まれます。","teamWon":"{team}がこの試合に勝利","boSeries":"BOシリーズ","waitingHostWinner":"ホストによる試合勝者の記録を待っています。","openTournamentOps":"大会運営を開く","chat":"チャット","roomCode":"ルームコード","clickCopy":"クリックしてコピー","typeMessage":"メッセージまたはルームコードを入力…","unavailable":"使用不可","globalBanReason":"グローバルBAN — 両チーム使用不可","protectedReason":"保護対象 — BAN不可","currentGameBanReason":"現在のゲームでBAN済み","currentGamePickReason":"選択済み — BAN不可","sameTeamDuplicateReason":"自チームがすでにこのヒーローを選択済み","mirrorDisabledReason":"{role}のミラーピックは無効","fearlessLockReason":"シリーズロック — 前のゲームで選択済み","teamLockReason":"チームロック — 自チームが以前選択済み","roleBanReason":"相手が{role}構成を完成 — このロールはBAN不可"},"zh-CN":{"home":"首页","heroes":"英雄","quickDraft":"快速选人","tournamentOps":"赛事管理","login":"登录","backHome":"返回首页","reset":"重置","startDraft":"开始选人","startDraftRoom":"进入选人房间","all":"全部","damage":"攻坚","tank":"承伤","technical":"技巧","language":"语言","selectLanguage":"选择语言","close":"关闭","waiting":"等待中","complete":"已完成","pickPhase":"选人阶段","banPhase":"禁用阶段","divineBan":"神圣禁用","currentPick":"当前选人","currentBan":"当前禁用","draftRoom":"选人房间","waitingForHost":"等待主持人…","waitingFor":"等待{team}…","teamBlue":"蓝队","teamRed":"红队","draftComplete":"选人完成","finalLocked":"最终阵容已锁定","technicalPause":"技术暂停","draftTimerPaused":"选人计时已暂停","paused":"已暂停","lockIn":"锁定","ban":"禁用","picks":"已选","bans":"禁用","selectHero":"选择英雄","selectHeroDetails":"选择英雄查看详细信息","newHero":"新","pickNumber":"选位 {number}","setGameWinner":"设置本局胜者","gameFinishedSetWinner":"比赛结束？设置胜者","fourVFourDraft":"4v4 选人","difficulty":"难度","skills":"技能","combatProfile":"战斗能力","burstDamage":"爆发伤害","sustainedDamage":"持续伤害","range":"攻击范围","support":"辅助","mobility":"机动性","energyRes":"气功波耐性","strikeRes":"打击耐性","passive":"被动","rushAttack":"突进攻击","skill":"技能","superAttack":"必杀技","transformation":"变身","searchHero":"搜索英雄名称…","heroRoster":"39名英雄","heroBuilds":"英雄与神圣卡组","divineCards":"神圣卡片","cardLibrary":"卡片库","loadingHero":"正在载入英雄数据…","abilityData":"能力数据","entriesFromDb":"英雄数据库中的 {count} 项","heroId":"英雄 {id}","noHeroesMatch":"没有符合条件的英雄。","noStatProfile":"暂无能力雷达数据。","notRated":"未评级","detailUnavailable":"该英雄的详细数据尚未收录。","noSkillData":"该英雄暂无技能数据。","recommendedLoadout":"推荐配置","divineCardBuilds":"神圣卡组","quickDraftAccount":"快速选人账号","quickDraftAccountDesc":"创建一个普通账号即可配置自定义房间。蓝队、红队和直播链接仍可直接打开。","loginOrCreate":"登录或创建账号","playForFun":"轻松开局","startFewClicks":"几步即可开始","quickIntro":"选择成熟的预设，填写双方队名并打开房间。需要时再展开详细规则。","standard":"标准","tournament":"赛事","twoBans30":"每队禁用2名英雄 · 每回合30秒","threeBansLonger":"每队禁用3名英雄 · 更长赛制","myPresets":"我的预设","myPresetsDesc":"将当前高级设置保存为可重复使用的快速选人预设。","saveCurrentPreset":"保存当前预设","optionalLogoUrl":"可选队徽URL","advancedSettings":"高级设置","advancedSettingsDesc":"选人规则、禁用、保护、演出和分享链接","configuration":"配置","draftRules":"选人规则","banRules":"禁用规则","protectionGlobalBan":"保护与全局禁用","presentationFx":"演出与特效","heroAura":"英雄光效","sharing":"分享","shareLinks":"分享链接","customQuickDraft":"自定义快速选人","saveCurrentSettings":"保存当前设置","presetName":"预设名称","description":"说明","presetNameExample":"例如：社区BO3","presetDescHelp":"说明该预设适合在什么情况下使用。","savePreset":"保存预设","builtInPreset":"内置预设","currentRules":"当前规则","myPreset":"我的预设","custom":"自定义","noDescription":"未添加说明。","unsavedCustom":"未保存的自定义设置","unsavedCustomDesc":"这些规则与当前预设不同。保存后可再次使用同一套设置。","personalRules":"个人快速选人规则","noPersonalPresets":"暂无个人预设。请先配置高级设置，再保存当前方案。","series":"赛制","draft":"选人模式","heroBans":"英雄禁用","turnTimer":"回合时间","mirrorPick":"镜像选择","divineDraw":"神圣抽选","coinFlip":"掷硬币","protection":"保护","globalBans":"全局禁用","standardPickBan":"标准禁选","allRandom":"全随机","noMirrorPicks":"禁止镜像选择","randomRoulette":"随机轮盘","pickBan":"选择／禁用","banRandom":"禁用＋随机","on":"开启","off":"关闭","perTeam":"每队 {count}","seconds":"{count}秒","manual":"手动 {count}名","newHeroes":"新英雄","heroesCount":"{count}名英雄","bansCount":"禁用 {count}名","turnsCount":"每回合 {count}秒","divineDrawOn":"神圣抽选：开启","divineDrawOff":"神圣抽选：关闭","balancedBo3":"适合休闲或练习的均衡BO3规则。","longerBo5":"每队禁用3名英雄并采用更充裕回合时间的BO5赛制。","setupCouldNotLoad":"设置加载失败","retry":"重试","heroAuraAccent":"英雄光效强调色","heroAuraDesc":"该装饰仅用于英雄预览与锁定演出，不会改变应用主题、阵营颜色或职业颜色。","cosmeticOnly":"仅装饰","shareLinksDesc":"将以下链接发送给双方，使其可直接加入选人房间。","teamALink":"A队链接","teamBLink":"B队链接","sendTo":"发送给{team}","broadcastPreviewLink":"直播预览链接","broadcastPreviewDesc":"供导播或OBS预览使用，并非公开观看页面","copy":"复制","copied":"已复制","resetConfirm":"确定将所有快速选人设置恢复默认值吗？此操作无法撤销。","enterPresetName":"请输入预设名称。","preDraftInProgress":"选人前阶段进行中","preDraftDesc":"双方队伍正在进行阵营选择、神圣抽选或赛前禁用。完成后将显示选人房间。","decideSide":"决定阵营 — 掷硬币","coinFlipDesc":"选择硬币正反面，决定哪一方获得先选优势。","teamChoice":"{team}选择","heads":"正面","tails":"反面","flipCoin":"掷硬币","divineDrawPhase":"✦ 神圣抽选阶段 ✦","twoDivineRules":"本场比赛将随机抽取两条神圣规则。","proceedDraft":"进入选人","gameDraftComplete":"第 {game} 局选人完成","recordGameWinner":"记录本局胜者","afterGameRule":"比赛结束后请选择获胜队伍，下一局无畏选人将自动载入。","teamWon":"{team}赢得本局","boSeries":"BO系列赛","waitingHostWinner":"等待主持人记录本局胜者。","openTournamentOps":"打开赛事管理","chat":"聊天","roomCode":"房间码","clickCopy":"点击复制","typeMessage":"输入消息或房间码…","unavailable":"不可用","globalBanReason":"全局禁用 — 双方均不可用","protectedReason":"受保护 — 不可禁用","currentGameBanReason":"本局已禁用","currentGamePickReason":"已选择 — 不可禁用","sameTeamDuplicateReason":"本队已选择该英雄","mirrorDisabledReason":"{role}职业禁止镜像选择","fearlessLockReason":"系列锁定 — 之前对局已选择","teamLockReason":"队伍锁定 — 本队之前已选择","roleBanReason":"对方已完成{role}配置 — 该职业不可再禁用"},"ko":{"home":"홈","heroes":"히어로","quickDraft":"빠른 드래프트","tournamentOps":"대회 운영","login":"로그인","backHome":"홈으로","reset":"초기화","startDraft":"드래프트 시작","startDraftRoom":"드래프트 룸 시작","all":"전체","damage":"데미지","tank":"탱크","technical":"테크니컬","language":"언어","selectLanguage":"언어 선택","close":"닫기","waiting":"대기 중","complete":"완료","pickPhase":"픽 단계","banPhase":"밴 단계","divineBan":"디바인 밴","currentPick":"현재 픽","currentBan":"현재 밴","draftRoom":"드래프트 룸","waitingForHost":"호스트 대기 중…","waitingFor":"{team} 대기 중…","teamBlue":"팀 블루","teamRed":"팀 레드","draftComplete":"드래프트 완료","finalLocked":"최종 팀 구성이 확정되었습니다","technicalPause":"테크니컬 일시정지","draftTimerPaused":"드래프트 타이머 일시정지","paused":"일시정지","lockIn":"확정","ban":"밴","picks":"픽","bans":"밴","selectHero":"히어로 선택","selectHeroDetails":"히어로를 선택하면 상세 정보가 표시됩니다","newHero":"신규","pickNumber":"픽 {number}","setGameWinner":"게임 승자 설정","gameFinishedSetWinner":"게임 종료? 승자 설정","fourVFourDraft":"4v4 드래프트","difficulty":"난이도","skills":"스킬","combatProfile":"전투 프로필","burstDamage":"순간 화력","sustainedDamage":"지속 화력","range":"공격 범위","support":"지원","mobility":"기동력","energyRes":"기공파 내구","strikeRes":"타격 내구","passive":"패시브","rushAttack":"러시 공격","skill":"스킬","superAttack":"필살기","transformation":"변신","searchHero":"히어로 이름 검색…","heroRoster":"39 히어로 로스터","heroBuilds":"히어로 & 디바인 카드 빌드","divineCards":"디바인 카드","cardLibrary":"카드 라이브러리","loadingHero":"히어로 데이터 불러오는 중…","abilityData":"어빌리티 데이터","entriesFromDb":"히어로 데이터베이스 {count}개 항목","heroId":"히어로 {id}","noHeroesMatch":"검색 조건에 맞는 히어로가 없습니다.","noStatProfile":"능력치 프로필이 없습니다.","notRated":"평가 없음","detailUnavailable":"상세 히어로 데이터가 아직 없습니다.","noSkillData":"이 히어로의 스킬 데이터가 없습니다.","recommendedLoadout":"추천 세팅","divineCardBuilds":"디바인 카드 빌드","quickDraftAccount":"빠른 드래프트 계정","quickDraftAccountDesc":"일반 계정 하나를 만들면 커스텀 룸을 설정할 수 있습니다. 팀 블루, 팀 레드 및 방송 링크는 계속 바로 열 수 있습니다.","loginOrCreate":"로그인 또는 계정 만들기","playForFun":"가볍게 플레이","startFewClicks":"몇 번의 클릭으로 시작","quickIntro":"검증된 프리셋을 선택하고 양 팀 이름을 입력해 룸을 여세요. 상세 규칙은 필요할 때만 설정하면 됩니다.","standard":"스탠다드","tournament":"토너먼트","twoBans30":"히어로 2명 밴 · 턴당 30초","threeBansLonger":"히어로 3명 밴 · 장기 시리즈","myPresets":"내 프리셋","myPresetsDesc":"현재 고급 설정을 재사용 가능한 빠른 드래프트 프리셋으로 저장합니다.","saveCurrentPreset":"현재 설정 저장","optionalLogoUrl":"선택 로고 URL","advancedSettings":"고급 설정","advancedSettingsDesc":"드래프트 규칙, 밴, 보호, 연출 및 공유 링크","configuration":"설정","draftRules":"드래프트 규칙","banRules":"밴 규칙","protectionGlobalBan":"보호 및 글로벌 밴","presentationFx":"연출 및 FX","heroAura":"히어로 오라","sharing":"공유","shareLinks":"공유 링크","customQuickDraft":"커스텀 빠른 드래프트","saveCurrentSettings":"현재 설정 저장","presetName":"프리셋 이름","description":"설명","presetNameExample":"예: 커뮤니티 BO3","presetDescHelp":"이 프리셋을 언제 사용할지 설명하세요.","savePreset":"프리셋 저장","builtInPreset":"기본 프리셋","currentRules":"현재 규칙","myPreset":"내 프리셋","custom":"커스텀","noDescription":"설명이 없습니다.","unsavedCustom":"저장되지 않은 커스텀 설정","unsavedCustomDesc":"선택한 프리셋과 다른 규칙입니다. 동일한 설정을 다시 쓰려면 저장하세요.","personalRules":"개인 빠른 드래프트 규칙","noPersonalPresets":"개인 프리셋이 없습니다. 고급 설정을 구성한 뒤 현재 설정을 저장하세요.","series":"시리즈","draft":"드래프트","heroBans":"히어로 밴","turnTimer":"턴 타이머","mirrorPick":"미러 픽","divineDraw":"디바인 드로우","coinFlip":"코인 플립","protection":"보호","globalBans":"글로벌 밴","standardPickBan":"표준 픽 & 밴","allRandom":"전체 랜덤","noMirrorPicks":"미러 픽 없음","randomRoulette":"랜덤 룰렛","pickBan":"픽 / 밴","banRandom":"밴 + 랜덤","on":"켜짐","off":"꺼짐","perTeam":"팀당 {count}","seconds":"{count}초","manual":"수동 {count}명","newHeroes":"신규 히어로","heroesCount":"히어로 {count}명","bansCount":"밴 {count}명","turnsCount":"턴당 {count}초","divineDrawOn":"디바인 드로우 켜짐","divineDrawOff":"디바인 드로우 꺼짐","balancedBo3":"캐주얼 또는 연습 드래프트용 균형 잡힌 BO3 규칙.","longerBo5":"팀당 히어로 3명 밴과 여유 있는 턴 시간을 적용한 BO5 시리즈.","setupCouldNotLoad":"설정을 불러오지 못했습니다","retry":"다시 시도","heroAuraAccent":"히어로 오라 강조색","heroAuraDesc":"이 장식은 히어로 미리보기와 확정 연출에만 적용되며 앱 테마, 진영 색상, 역할 색상은 변경하지 않습니다.","cosmeticOnly":"장식 전용","shareLinksDesc":"각 팀이 드래프트에 바로 참가할 수 있도록 링크를 보내세요.","teamALink":"팀 A 링크","teamBLink":"팀 B 링크","sendTo":"{team}에게 전송","broadcastPreviewLink":"방송 미리보기 링크","broadcastPreviewDesc":"프로듀서 또는 OBS 미리보기용이며 공개 시청 페이지가 아닙니다","copy":"복사","copied":"복사됨","resetConfirm":"모든 빠른 드래프트 설정을 기본값으로 초기화할까요? 이 작업은 되돌릴 수 없습니다.","enterPresetName":"프리셋 이름을 입력하세요.","preDraftInProgress":"프리드래프트 진행 중","preDraftDesc":"양 팀이 진영 선택, 디바인 드로우 또는 사전 밴을 진행 중입니다. 완료되면 드래프트 룸이 표시됩니다.","decideSide":"진영 결정 — 코인 플립","coinFlipDesc":"동전 면을 선택해 선픽 우선권을 결정하세요.","teamChoice":"{team} 선택","heads":"앞면","tails":"뒷면","flipCoin":"동전 던지기","divineDrawPhase":"✦ 디바인 드로우 단계 ✦","twoDivineRules":"이번 경기에는 디바인 규칙 2개가 무작위로 선택됩니다.","proceedDraft":"드래프트로 이동","gameDraftComplete":"게임 {game} 드래프트 완료","recordGameWinner":"게임 승자 기록","afterGameRule":"게임 종료 후 승리 팀을 선택하세요. 다음 피어리스 드래프트가 자동으로 로드됩니다.","teamWon":"{team}이(가) 이번 게임 승리","boSeries":"BO 시리즈","waitingHostWinner":"호스트가 게임 승자를 기록하기를 기다리는 중입니다.","openTournamentOps":"대회 운영 열기","chat":"채팅","roomCode":"룸 코드","clickCopy":"클릭하여 복사","typeMessage":"메시지 또는 룸 코드 입력…","unavailable":"사용 불가","globalBanReason":"글로벌 밴 — 양 팀 모두 사용 불가","protectedReason":"보호 대상 — 밴 불가","currentGameBanReason":"현재 게임에서 밴됨","currentGamePickReason":"이미 선택됨 — 밴 불가","sameTeamDuplicateReason":"우리 팀이 이미 이 히어로를 선택했습니다","mirrorDisabledReason":"{role} 미러 픽 비활성화","fearlessLockReason":"시리즈 잠금 — 이전 게임에서 선택됨","teamLockReason":"팀 잠금 — 우리 팀이 이전에 선택함","roleBanReason":"상대가 {role} 구성을 완료해 더 이상 이 역할을 밴할 수 없습니다"},"es":{"home":"Inicio","heroes":"Héroes","quickDraft":"Draft rápido","tournamentOps":"Gestión del torneo","login":"INICIAR SESIÓN","backHome":"VOLVER AL INICIO","reset":"Restablecer","startDraft":"INICIAR DRAFT","startDraftRoom":"INICIAR SALA DE DRAFT","all":"Todos","damage":"Daño","tank":"Tanque","technical":"Especialista","language":"Idioma","selectLanguage":"Seleccionar idioma","close":"CERRAR","waiting":"ESPERANDO","complete":"COMPLETO","pickPhase":"FASE DE ELECCIÓN","banPhase":"FASE DE BLOQUEO","divineBan":"BLOQUEO DIVINO","currentPick":"ELECCIÓN ACTUAL","currentBan":"BLOQUEO ACTUAL","draftRoom":"SALA DE DRAFT","waitingForHost":"ESPERANDO AL HOST…","waitingFor":"ESPERANDO A {team}…","teamBlue":"EQUIPO AZUL","teamRed":"EQUIPO ROJO","draftComplete":"DRAFT COMPLETO","finalLocked":"COMPOSICIONES FINALES BLOQUEADAS","technicalPause":"PAUSA TÉCNICA","draftTimerPaused":"TEMPORIZADOR DEL DRAFT PAUSADO","paused":"PAUSADO","lockIn":"CONFIRMAR","ban":"BLOQUEAR","picks":"ELECCIONES","bans":"BLOQUEOS","selectHero":"SELECCIONAR HÉROE","selectHeroDetails":"Selecciona un héroe para ver sus detalles","newHero":"NUEVO","pickNumber":"ELECCIÓN {number}","setGameWinner":"FIJAR GANADOR","gameFinishedSetWinner":"¿TERMINÓ LA PARTIDA? FIJAR GANADOR","fourVFourDraft":"DRAFT 4v4","difficulty":"DIFICULTAD","skills":"HABILIDADES","combatProfile":"PERFIL DE COMBATE","burstDamage":"DAÑO EXPLOSIVO","sustainedDamage":"DAÑO CONTINUO","range":"ALCANCE","support":"APOYO","mobility":"MOVILIDAD","energyRes":"RES. DE ENERGÍA","strikeRes":"RES. DE GOLPE","passive":"PASIVA","rushAttack":"ATAQUE RÁPIDO","skill":"HABILIDAD","superAttack":"ATAQUE ESPECIAL","transformation":"TRANSFORMACIÓN","searchHero":"Buscar nombre del héroe…","heroRoster":"PLANTEL DE 39 HÉROES","heroBuilds":"HÉROES Y BARAJAS DE CARTAS DIVINAS","divineCards":"CARTAS DIVINAS","cardLibrary":"BIBLIOTECA DE CARTAS","loadingHero":"Cargando datos del héroe…","abilityData":"DATOS DE HABILIDADES","entriesFromDb":"{count} entradas de la base de héroes","heroId":"HÉROE {id}","noHeroesMatch":"Ningún héroe coincide con la búsqueda.","noStatProfile":"No hay perfil de estadísticas disponible.","notRated":"Sin valoración","detailUnavailable":"Todavía no hay datos detallados para este héroe.","noSkillData":"No hay datos de habilidades para este héroe.","recommendedLoadout":"CONFIGURACIÓN RECOMENDADA","divineCardBuilds":"BARAJAS DE CARTAS DIVINAS","quickDraftAccount":"CUENTA DE DRAFT RÁPIDO","quickDraftAccountDesc":"Crea una cuenta normal para configurar salas personalizadas. Los enlaces de Equipo Azul, Equipo Rojo y Broadcast se pueden abrir directamente.","loginOrCreate":"INICIAR SESIÓN O CREAR CUENTA","playForFun":"JUEGA POR DIVERSIÓN","startFewClicks":"EMPIEZA EN UNOS CLICS","quickIntro":"Elige un preset probado, asigna nombres a ambos equipos y abre la sala. Las reglas detalladas quedan ocultas hasta que las necesites.","standard":"ESTÁNDAR","tournament":"TORNEO","twoBans30":"2 bloqueos de héroe · turnos de 30 segundos","threeBansLonger":"3 bloqueos de héroe · serie más larga","myPresets":"MIS PRESETS","myPresetsDesc":"Guarda los ajustes avanzados actuales como un preset reutilizable de Draft rápido.","saveCurrentPreset":"GUARDAR COMO PRESET","optionalLogoUrl":"URL opcional del logo","advancedSettings":"AJUSTES AVANZADOS","advancedSettingsDesc":"Reglas del draft, bloqueos, protección, presentación y enlaces","configuration":"Configuración","draftRules":"Reglas del draft","banRules":"Reglas de bloqueo","protectionGlobalBan":"Protección y bloqueo global","presentationFx":"Presentación y FX","heroAura":"Aura del héroe","sharing":"Compartir","shareLinks":"Enlaces para compartir","customQuickDraft":"DRAFT RÁPIDO PERSONALIZADO","saveCurrentSettings":"GUARDAR AJUSTES ACTUALES","presetName":"Nombre del preset","description":"Descripción","presetNameExample":"p. ej., BO3 de comunidad","presetDescHelp":"Explica cuándo debería usarse este preset.","savePreset":"GUARDAR PRESET","builtInPreset":"PRESET INCLUIDO","currentRules":"REGLAS ACTUALES","myPreset":"MI PRESET","custom":"Personalizado","noDescription":"No se añadió una descripción.","unsavedCustom":"Ajustes personalizados sin guardar","unsavedCustomDesc":"Estas reglas difieren del preset seleccionado. Guárdalas para reutilizar esta configuración.","personalRules":"Reglas personales de Draft rápido","noPersonalPresets":"Todavía no hay presets personales. Configura los Ajustes avanzados y guarda la configuración actual.","series":"Serie","draft":"Draft","heroBans":"Bloqueos de héroe","turnTimer":"Tiempo de turno","mirrorPick":"Elección espejo","divineDraw":"Sorteo divino","coinFlip":"Lanzamiento de moneda","protection":"Protección","globalBans":"Bloqueos globales","standardPickBan":"Elección y bloqueo estándar","allRandom":"Todo aleatorio","noMirrorPicks":"Sin elecciones espejo","randomRoulette":"Ruleta aleatoria","pickBan":"Elegir / Bloquear","banRandom":"Bloquear + Aleatorio","on":"Activado","off":"Desactivado","perTeam":"{count} por equipo","seconds":"{count} segundos","manual":"{count} manuales","newHeroes":"héroes NUEVOS","heroesCount":"{count} héroes","bansCount":"{count} bloqueos","turnsCount":"turnos de {count}s","divineDrawOn":"Sorteo divino activado","divineDrawOff":"Sorteo divino desactivado","balancedBo3":"Reglas BO3 equilibradas para drafts casuales o de práctica.","longerBo5":"Serie BO5 más larga con tres bloqueos por equipo y más tiempo de decisión.","setupCouldNotLoad":"No se pudo cargar la configuración","retry":"REINTENTAR","heroAuraAccent":"Acento del aura del héroe","heroAuraDesc":"Este acento cosmético solo afecta a las vistas previas y animaciones de confirmación. No cambia el tema, los colores de facción ni los colores de rol.","cosmeticOnly":"Solo cosmético","shareLinksDesc":"Envía estos enlaces para que cada equipo entre directamente al draft.","teamALink":"Enlace del Equipo A","teamBLink":"Enlace del Equipo B","sendTo":"Enviar a {team}","broadcastPreviewLink":"Enlace de vista previa de Broadcast","broadcastPreviewDesc":"Para el productor o la vista previa de OBS; no es una página pública","copy":"Copiar","copied":"¡Copiado!","resetConfirm":"¿Restablecer todos los ajustes de Draft rápido? Esta acción no se puede deshacer.","enterPresetName":"Introduce un nombre para el preset.","preDraftInProgress":"PREDRAFT EN CURSO","preDraftDesc":"Los dos equipos están resolviendo la selección de lado, el Sorteo divino o los bloqueos previos. La sala aparecerá al terminar.","decideSide":"DECIDIR LADO — MONEDA","coinFlipDesc":"Elige una cara para decidir qué equipo obtiene la primera elección.","teamChoice":"Elección de {team}","heads":"CARA","tails":"CRUZ","flipCoin":"LANZAR MONEDA","divineDrawPhase":"✦ FASE DE SORTEO DIVINO ✦","twoDivineRules":"Se sortearán dos reglas divinas para esta partida.","proceedDraft":"CONTINUAR AL DRAFT","gameDraftComplete":"DRAFT DE LA PARTIDA {game} COMPLETO","recordGameWinner":"REGISTRAR GANADOR","afterGameRule":"Cuando termine la partida, selecciona al equipo ganador. El siguiente draft Fearless se cargará automáticamente.","teamWon":"{team} GANÓ ESTA PARTIDA","boSeries":"SERIE BO","waitingHostWinner":"Esperando a que el host registre al ganador.","openTournamentOps":"ABRIR GESTIÓN DEL TORNEO","chat":"CHAT","roomCode":"Código de sala","clickCopy":"Haz clic para copiar","typeMessage":"Escribe un mensaje o código de sala…","unavailable":"No disponible","globalBanReason":"Bloqueo global — no disponible para ambos equipos","protectedReason":"Protegido — no se puede bloquear","currentGameBanReason":"Bloqueado en la partida actual","currentGamePickReason":"Ya elegido — no se puede bloquear","sameTeamDuplicateReason":"Tu equipo ya seleccionó este héroe","mirrorDisabledReason":"La elección espejo de {role} está desactivada","fearlessLockReason":"Bloqueo de serie — elegido en una partida anterior","teamLockReason":"Bloqueo de equipo — tu equipo lo eligió anteriormente","roleBanReason":"El rival completó {role}; ya no se puede bloquear ese rol"},"vi":{"home":"Trang chủ","heroes":"Chiến binh","quickDraft":"Cấm chọn nhanh","tournamentOps":"Vận hành giải đấu","login":"ĐĂNG NHẬP","backHome":"VỀ TRANG CHỦ","reset":"Đặt lại","startDraft":"BẮT ĐẦU CẤM CHỌN","startDraftRoom":"MỞ PHÒNG CẤM CHỌN","all":"Tất cả","damage":"Công kích","tank":"Đỡ đòn","technical":"Kỹ thuật","language":"Ngôn ngữ","selectLanguage":"Chọn ngôn ngữ","close":"ĐÓNG","waiting":"ĐANG CHỜ","complete":"HOÀN TẤT","pickPhase":"GIAI ĐOẠN CHỌN","banPhase":"GIAI ĐOẠN CẤM","divineBan":"CẤM THẦN LUẬT","currentPick":"LƯỢT CHỌN HIỆN TẠI","currentBan":"LƯỢT CẤM HIỆN TẠI","draftRoom":"PHÒNG CẤM CHỌN","waitingForHost":"ĐANG CHỜ HOST…","waitingFor":"ĐANG CHỜ {team}…","teamBlue":"ĐỘI XANH","teamRed":"ĐỘI ĐỎ","draftComplete":"CẤM CHỌN HOÀN TẤT","finalLocked":"ĐỘI HÌNH CUỐI ĐÃ KHÓA","technicalPause":"TẠM DỪNG KỸ THUẬT","draftTimerPaused":"ĐỒNG HỒ CẤM CHỌN ĐÃ TẠM DỪNG","paused":"TẠM DỪNG","lockIn":"KHÓA CHỌN","ban":"CẤM","picks":"ĐÃ CHỌN","bans":"ĐÃ CẤM","selectHero":"CHỌN CHIẾN BINH","selectHeroDetails":"Chọn chiến binh để xem thông tin chi tiết","newHero":"MỚI","pickNumber":"CHỌN {number}","setGameWinner":"ĐẶT ĐỘI THẮNG","gameFinishedSetWinner":"TRẬN ĐÃ XONG? ĐẶT ĐỘI THẮNG","fourVFourDraft":"CẤM CHỌN 4v4","difficulty":"ĐỘ KHÓ","skills":"KỸ NĂNG","combatProfile":"HỒ SƠ CHIẾN ĐẤU","burstDamage":"BỘC PHÁ SÁT THƯƠNG","sustainedDamage":"DUY TRÌ SÁT THƯƠNG","range":"PHẠM VI","support":"HỖ TRỢ","mobility":"CƠ ĐỘNG","energyRes":"KHÁNG KHÍ CÔNG","strikeRes":"KHÁNG ĐẢ KÍCH","passive":"NỘI TẠI","rushAttack":"ĐỘT KÍCH","skill":"KỸ NĂNG","superAttack":"TUYỆT KỸ","transformation":"BIẾN THÂN","searchHero":"Tìm tên chiến binh…","heroRoster":"DANH SÁCH 39 CHIẾN BINH","heroBuilds":"CHIẾN BINH & BỘ THẺ THẦN THÁNH","divineCards":"THẺ THẦN THÁNH","cardLibrary":"THƯ VIỆN THẺ","loadingHero":"Đang tải dữ liệu chiến binh…","abilityData":"DỮ LIỆU NĂNG LỰC","entriesFromDb":"{count} mục từ cơ sở dữ liệu chiến binh","heroId":"CHIẾN BINH {id}","noHeroesMatch":"Không có chiến binh phù hợp với tìm kiếm.","noStatProfile":"Chưa có hồ sơ chỉ số.","notRated":"Chưa xếp hạng","detailUnavailable":"Chưa có dữ liệu chi tiết cho chiến binh này.","noSkillData":"Chưa có dữ liệu kỹ năng cho chiến binh này.","recommendedLoadout":"CẤU HÌNH ĐỀ XUẤT","divineCardBuilds":"BỘ THẺ THẦN THÁNH","quickDraftAccount":"TÀI KHOẢN CẤM CHỌN NHANH","quickDraftAccountDesc":"Tạo một tài khoản thường để cấu hình phòng tùy chỉnh. Liên kết Đội Xanh, Đội Đỏ và Broadcast vẫn có thể mở trực tiếp.","loginOrCreate":"ĐĂNG NHẬP HOẶC TẠO TÀI KHOẢN","playForFun":"CHƠI GIẢI TRÍ","startFewClicks":"BẮT ĐẦU CHỈ VỚI VÀI CÚ NHẤP","quickIntro":"Chọn một thiết lập có sẵn, đặt tên hai đội rồi mở phòng. Các luật chi tiết chỉ xuất hiện khi bạn cần.","standard":"TIÊU CHUẨN","tournament":"GIẢI ĐẤU","twoBans30":"Cấm 2 chiến binh · 30 giây mỗi lượt","threeBansLonger":"Cấm 3 chiến binh · loạt trận dài hơn","myPresets":"THIẾT LẬP CỦA TÔI","myPresetsDesc":"Lưu Cài đặt nâng cao hiện tại thành thiết lập Cấm chọn nhanh có thể dùng lại.","saveCurrentPreset":"LƯU THIẾT LẬP HIỆN TẠI","optionalLogoUrl":"URL logo tùy chọn","advancedSettings":"CÀI ĐẶT NÂNG CAO","advancedSettingsDesc":"Luật cấm chọn, cấm chiến binh, bảo hộ, trình diễn và liên kết chia sẻ","configuration":"Cấu hình","draftRules":"Luật cấm chọn","banRules":"Luật cấm","protectionGlobalBan":"Bảo hộ & Cấm toàn cục","presentationFx":"Trình diễn & Hiệu ứng","heroAura":"Khí Quang Chiến Binh","sharing":"Chia sẻ","shareLinks":"Liên kết chia sẻ","customQuickDraft":"CẤM CHỌN NHANH TÙY CHỈNH","saveCurrentSettings":"LƯU CÀI ĐẶT HIỆN TẠI","presetName":"Tên thiết lập","description":"Mô tả","presetNameExample":"ví dụ: BO3 cộng đồng","presetDescHelp":"Giải thích khi nào nên dùng thiết lập này.","savePreset":"LƯU THIẾT LẬP","builtInPreset":"THIẾT LẬP CÓ SẴN","currentRules":"LUẬT HIỆN TẠI","myPreset":"THIẾT LẬP CỦA TÔI","custom":"Tùy chỉnh","noDescription":"Chưa thêm mô tả.","unsavedCustom":"Cài đặt tùy chỉnh chưa lưu","unsavedCustomDesc":"Các luật này khác thiết lập đang chọn. Hãy lưu để dùng lại chính xác cấu hình này.","personalRules":"Luật Cấm chọn nhanh cá nhân","noPersonalPresets":"Chưa có thiết lập cá nhân. Hãy cấu hình Cài đặt nâng cao rồi lưu thiết lập hiện tại.","series":"Loạt trận","draft":"Cấm chọn","heroBans":"Số chiến binh cấm","turnTimer":"Thời gian lượt","mirrorPick":"Chọn trùng đối thủ","divineDraw":"Rút Thần Luật","coinFlip":"Tung đồng xu","protection":"Bảo hộ","globalBans":"Cấm toàn cục","standardPickBan":"Cấm chọn tiêu chuẩn","allRandom":"Ngẫu nhiên toàn bộ","noMirrorPicks":"Không cho chọn trùng","randomRoulette":"Vòng quay ngẫu nhiên","pickBan":"Chọn / Cấm","banRandom":"Cấm + Ngẫu nhiên","on":"Bật","off":"Tắt","perTeam":"{count} mỗi đội","seconds":"{count} giây","manual":"{count} chiến binh thủ công","newHeroes":"chiến binh MỚI","heroesCount":"{count} chiến binh","bansCount":"{count} lượt cấm","turnsCount":"{count} giây/lượt","divineDrawOn":"Rút Thần Luật: Bật","divineDrawOff":"Rút Thần Luật: Tắt","balancedBo3":"Luật BO3 cân bằng cho đấu vui hoặc luyện tập.","longerBo5":"Loạt BO5 dài hơn, mỗi đội cấm 3 chiến binh và có thêm thời gian quyết định.","setupCouldNotLoad":"Không thể tải phần thiết lập","retry":"THỬ LẠI","heroAuraAccent":"Màu nhấn Khí Quang Chiến Binh","heroAuraDesc":"Hiệu ứng trang trí này chỉ áp dụng cho phần xem trước và hoạt cảnh khóa chọn; không thay đổi giao diện, màu phe hay màu vai trò.","cosmeticOnly":"Chỉ trang trí","shareLinksDesc":"Gửi các liên kết này để từng đội vào thẳng phòng cấm chọn.","teamALink":"Liên kết Đội A","teamBLink":"Liên kết Đội B","sendTo":"Gửi cho {team}","broadcastPreviewLink":"Liên kết xem trước Broadcast","broadcastPreviewDesc":"Dành cho đạo diễn hình hoặc OBS, không phải trang xem công khai","copy":"Sao chép","copied":"Đã sao chép!","resetConfirm":"Đặt lại toàn bộ cài đặt Cấm chọn nhanh về mặc định? Thao tác này không thể hoàn tác.","enterPresetName":"Hãy nhập tên thiết lập.","preDraftInProgress":"GIAI ĐOẠN TIỀN CẤM CHỌN","preDraftDesc":"Hai đội đang xử lý chọn bên, Rút Thần Luật hoặc lượt cấm trước. Phòng cấm chọn sẽ hiện khi giai đoạn này hoàn tất.","decideSide":"QUYẾT ĐỊNH BÊN — TUNG ĐỒNG XU","coinFlipDesc":"Chọn một mặt đồng xu để xác định đội có quyền chọn trước.","teamChoice":"Lựa chọn của {team}","heads":"NGỬA","tails":"SẤP","flipCoin":"TUNG ĐỒNG XU","divineDrawPhase":"✦ GIAI ĐOẠN RÚT THẦN LUẬT ✦","twoDivineRules":"Hai Thần Luật sẽ được rút ngẫu nhiên cho trận này.","proceedDraft":"TIẾP TỤC CẤM CHỌN","gameDraftComplete":"CẤM CHỌN VÁN {game} HOÀN TẤT","recordGameWinner":"GHI NHẬN ĐỘI THẮNG","afterGameRule":"Sau khi ván đấu kết thúc, hãy chọn đội thắng. Lượt cấm chọn Fearless tiếp theo sẽ tự động tải.","teamWon":"{team} THẮNG VÁN NÀY","boSeries":"LOẠT BO","waitingHostWinner":"Đang chờ Host ghi nhận đội thắng ván.","openTournamentOps":"MỞ VẬN HÀNH GIẢI ĐẤU","chat":"TRÒ CHUYỆN","roomCode":"Mã phòng","clickCopy":"Nhấp để sao chép","typeMessage":"Nhập tin nhắn hoặc mã phòng…","unavailable":"Không khả dụng","globalBanReason":"Cấm toàn cục — cả hai đội đều không thể dùng","protectedReason":"Được bảo hộ — không thể cấm","currentGameBanReason":"Đã bị cấm trong ván hiện tại","currentGamePickReason":"Đã được chọn — không thể cấm","sameTeamDuplicateReason":"Đội bạn đã chọn chiến binh này","mirrorDisabledReason":"Không cho phép chọn trùng vai trò {role}","fearlessLockReason":"Khóa loạt — đã chọn ở ván trước","teamLockReason":"Khóa đội — đội bạn đã chọn chiến binh này trước đó","roleBanReason":"Đối thủ đã hoàn tất vai trò {role} — không thể cấm thêm vai trò này"}});
export const SOURCE_TO_KEY = Object.freeze({"Home":"home","⌂ Home":"home","Heroes":"heroes","Quick Draft":"quickDraft","Tournament Ops":"tournamentOps","🏆 Tournament Ops":"tournamentOps","LOG IN":"login","BACK TO HOME":"backHome","↻ Reset":"reset","▶ START DRAFT":"startDraft","START DRAFT ROOM":"startDraftRoom","All":"all","ALL":"all","Damage":"damage","DAMAGE":"damage","Tank":"tank","TANK":"tank","Technical":"technical","TECHNICAL":"technical","WAITING":"waiting","COMPLETE":"complete","PICK PHASE":"pickPhase","BAN PHASE":"banPhase","DIVINE BAN":"divineBan","CURRENT PICK":"currentPick","CURRENT BAN":"currentBan","DRAFT ROOM":"draftRoom","WAITING FOR HOST":"waitingForHost","WAITING FOR HOST...":"waitingForHost","DRAFT COMPLETE":"draftComplete","FINAL TEAM COMPOSITIONS LOCKED":"finalLocked","TECHNICAL PAUSE":"technicalPause","DRAFT TIMER PAUSED":"draftTimerPaused","PAUSED":"paused","LOCK IN":"lockIn","BAN":"ban","PICKS":"picks","BANS":"bans","SELECT HERO":"selectHero","Select Hero to View Details":"selectHeroDetails","SET GAME WINNER":"setGameWinner","GAME FINISHED? SET WINNER":"gameFinishedSetWinner","4v4 DRAFT":"fourVFourDraft","DIFFICULTY":"difficulty","Difficulty":"difficulty","SKILLS":"skills","Skills":"skills","COMBAT PROFILE":"combatProfile","Burst DMG":"burstDamage","BURST DMG":"burstDamage","Sustained DMG":"sustainedDamage","SUSTAINED DMG":"sustainedDamage","Range":"range","RANGE":"range","Support":"support","SUPPORT":"support","Mobility":"mobility","MOBILITY":"mobility","Energy Res":"energyRes","ENERGY RES":"energyRes","Strike Res":"strikeRes","STRIKE RES":"strikeRes","PASSIVE":"passive","RUSH ATTACK":"rushAttack","SKILL":"skill","SUPER ATTACK":"superAttack","TRANSFORMATION":"transformation","39-HERO ROSTER":"heroRoster","HEROES & DIVINE CARD BUILDS":"heroBuilds","DIVINE CARDS":"divineCards","CARD LIBRARY":"cardLibrary","Loading hero data…":"loadingHero","ABILITY DATA":"abilityData","RECOMMENDED LOADOUT":"recommendedLoadout","DIVINE CARD BUILDS":"divineCardBuilds","QUICK DRAFT ACCOUNT":"quickDraftAccount","Create one normal account to configure custom rooms. Shared Team Blue, Team Red and Broadcast links can still open directly.":"quickDraftAccountDesc","LOG IN OR CREATE ACCOUNT":"loginOrCreate","PLAY FOR FUN":"playForFun","START IN A FEW CLICKS":"startFewClicks","Choose a proven preset, name both teams and open the room. Detailed rules stay out of the way until you need them.":"quickIntro","STANDARD":"standard","TOURNAMENT":"tournament","2 hero bans · 30 second turns":"twoBans30","3 hero bans · longer series":"threeBansLonger","MY PRESETS":"myPresets","Save the current Advanced Settings as your own reusable Quick Draft preset.":"myPresetsDesc","SAVE CURRENT AS PRESET":"saveCurrentPreset","Optional logo URL":"optionalLogoUrl","ADVANCED SETTINGS":"advancedSettings","Draft rules, bans, protection, presentation and share links":"advancedSettingsDesc","Configuration":"configuration","Draft Rules":"draftRules","Ban Rules":"banRules","Protection & Global Ban":"protectionGlobalBan","Presentation & FX":"presentationFx","Hero Aura":"heroAura","Sharing":"sharing","Share Links":"shareLinks","CUSTOM QUICK DRAFT":"customQuickDraft","SAVE CURRENT SETTINGS":"saveCurrentSettings","CLOSE":"close","Preset name":"presetName","Description":"description","SAVE PRESET":"savePreset","BUILT-IN PRESET":"builtInPreset","CURRENT RULES":"currentRules","MY PRESET":"myPreset","No description was added.":"noDescription","Unsaved custom settings":"unsavedCustom","These rules differ from the selected preset. Save them to reuse this exact setup later.":"unsavedCustomDesc","Personal Quick Draft rules":"personalRules","No personal presets yet. Configure Advanced Settings, then save the current setup.":"noPersonalPresets","Series":"series","Draft":"draft","Hero bans":"heroBans","Turn timer":"turnTimer","Mirror Pick":"mirrorPick","Divine Draw":"divineDraw","Coin flip":"coinFlip","Protection":"protection","Global bans":"globalBans","Standard Pick & Ban":"standardPickBan","All Random":"allRandom","No Mirror Picks":"noMirrorPicks","Random roulette":"randomRoulette","Pick / Ban":"pickBan","Ban + Random":"banRandom","On":"on","Off":"off","Balanced BO3 rules for casual or practice drafts.":"balancedBo3","Longer BO5 series with three hero bans per team and deliberate turn timing.":"longerBo5","Setup could not load":"setupCouldNotLoad","RETRY":"retry","Hero Aura Accent":"heroAuraAccent","This cosmetic accent is limited to hero previews and cinematic lock-ins. It never changes app theme, faction colors or role colors.":"heroAuraDesc","Cosmetic only":"cosmeticOnly","Send these links to each team so they can join the draft directly.":"shareLinksDesc","Team A Link":"teamALink","Team B Link":"teamBLink","Broadcast Preview Link":"broadcastPreviewLink","For the producer or OBS preview, not a public watch page":"broadcastPreviewDesc","Copy":"copy","Copied!":"copied","PRE-DRAFT IN PROGRESS":"preDraftInProgress","The two teams are resolving side selection, Divine Draw or pre-roll bans. The Draft Room will appear when this stage is complete.":"preDraftDesc","DECIDE SIDE — COIN FLIP":"decideSide","Select a coin face to determine who gets first-pick advantage!":"coinFlipDesc","HEADS":"heads","TAILS":"tails","FLIP COIN":"flipCoin","✦ DIVINE DRAW PHASE ✦":"divineDrawPhase","Two divine rules will be drawn for this match.":"twoDivineRules","PROCEED TO DRAFT":"proceedDraft","RECORD GAME WINNER":"recordGameWinner","After the game finishes, select the winning team. The next Fearless draft will load automatically.":"afterGameRule","BO SERIES":"boSeries","Waiting for the Host to record the game winner.":"waitingHostWinner","OPEN TOURNAMENT OPS":"openTournamentOps","💬 CHAT":"chat","Room Code":"roomCode","Click to copy":"clickCopy","TEAM BLUE":"teamBlue","TEAM RED":"teamRed","TEAM A":"teamA","TEAM B":"teamB","START DRAFT":"startDraft"});
export const HERO_DETAIL_OVERRIDES = FULL_HERO_DETAIL_OVERRIDES;
export const EXACT_GAME_TEXT = Object.freeze({ ja: {}, 'zh-CN': {}, ko: {}, es: {}, vi: {} }); // Deprecated: verified hero records replace phrase-level guesses.
const ROLE_KEYS = Object.freeze({ Damage:'damage', Tank:'tank', Technical:'technical' });

const UI_EXTRA = Object.freeze({
  "en": {
    "viewOnly": "VIEW ONLY",
    "game": "GAME",
    "normal": "NORMAL",
    "roleNotAllowed": "{role} is not allowed by the current composition preset",
    "teamA": "TEAM A",
    "teamB": "TEAM B",
    "noHeroesFilter": "No heroes match this filter.",
    "loadoutHint": "Three core Slots · hover or focus any card for full details",
    "unassigned": "Unassigned",
    "effect": "Effect",
    "noEffect": "No effect recorded.",
    "noteConditions": "Note / Activation Conditions",
    "pinned": "PINNED · CLICK OUTSIDE TO CLOSE",
    "clickKeepOpen": "CLICK THE CARD TO KEEP THIS OPEN",
    "tankTechnical": "Tank + Technical",
    "allRoles": "All roles",
    "roleLimitReached": "{role} limit reached ({limit})",
    "squadraBlast": "Squadra Blast",
    "squadraBlastOption": "Squadra Blast — own Game 1 picks affect Game 2; ban carry-over is configurable; Game 3 resets",
    "squadraBlastRuleDesc": "Game 1 uses the configured bans. Game 2 adds no new bans: each team cannot reuse only its own Game 1 picks, while a separate toggle controls whether Game 1 bans stay active for both teams. Game 3 resets both.",
    "squadraBlastRemember": "Each team’s own Game 1 picks always affect Game 2; carrying Game 1 bans is optional; Game 3 starts fresh.",
    "squadraBlastBanException": "Outside Squadra Blast, banned heroes do not carry into later games.",
    "squadraBlastGame1": "SQUADRA BLAST · Game 1 uses the configured bans. Those bans and each team’s own picks carry into Game 2.",
    "squadraBlastGame2": "SQUADRA BLAST · No new bans. Game 1 bans still affect both teams, while each team is locked only from its own Game 1 picks.",
    "squadraBlastGame3": "SQUADRA BLAST · Game 3 resets the earlier bans and picks. Only the configured Mirror Pick rule remains.",
    "squadraBlastPanel": "Squadra Blast: each team loses only its own Game 1 picks in Game 2; the Host can choose whether Game 1 bans also stay active. Game 3 resets both histories.",
    "blastBanReason": "Squadra Blast Ban — active through this game",
    "squadraBlastCarryBans": "Carry Game 1 bans into Game 2",
    "squadraBlastCarryBansDesc": "Squadra Blast only. Turn this off to make Game 1 bans usable again in Game 2; each team’s own Game 1 picks still remain locked.",
    "squadraBlastGame1NoCarry": "SQUADRA BLAST · Game 1 uses the configured bans. Only each team’s own picks carry into Game 2; these bans do not.",
    "squadraBlastGame2NoCarry": "SQUADRA BLAST · No new bans. Game 1 bans are available again, while each team is locked only from its own Game 1 picks.",
    "discordInviteField": "Discord invite link",
    "joinDiscordServer": "Join Discord server ↗",
    "startTournamentConfirm": "Start this tournament and open check-in for every playable match?",
    "broadcasterRoleLabel": "BROADCASTER · VIEW ONLY",
    "broadcastReadOnlyPermissions": "This account can view either team and the live Draft state, but cannot change the bracket, Draft, chat or result.",
    "resultReconfirmConfirm": "Return this result to both Captains and require fresh approval?",
    "portalYourTeamTag": "✓ Your team: {tag}",
    "submitApproveResultStep": "Submit & approve result",
    "submitApproveResultTitle": "Submit & Approve Result",
    "matchChatScreenshotDesc": "Captains, Host, linked players and assigned referee. Result screenshots appear directly in chat.",
    "captainStartTitle": "Start Tournament & Captain Check-in",
    "captainStartDescription": "Follow these steps in order. Starting opens check-in for every currently playable match; only each team's linked Captain checks in.",
    "startOpenCaptainCheckinStep": "Start & open check-in",
    "captainAccountRequirement": "Only one active Captain account per team is required for check-in, coin flip, Draft control and results. Other roster slots do not need linked accounts or Draft Room presence.",
    "captainRunsDraft": "Captain runs ban/pick",
    "memberViewOnlyMatchHelp": "You can view this match and use Match Chat. Only the linked Captain can check in, enter or control the Draft Room, run coin flip, and submit or verify results.",
    "startTournamentButton": "START TOURNAMENT & OPEN CHECK-IN",
    "generateBracketFirst": "Generate the bracket first",
    "resolvePreflightBlockers": "Resolve {count} preflight blocker(s)",
    "waitingHostStartTournament": "Waiting for the Host to start this tournament",
    "waitingForTeamJoin": "Waiting for {team} to join",
    "waitingForTeamJoinDesc": "The Draft Room will begin automatically when the missing Captain connects. The Host does not need to take control.",
    "tournamentStartedStatus": "TOURNAMENT STARTED · {checkin} CHECK-IN · {ready} READY",
    "draftActionLog": "Draft Action Log",
    "draftActionLogDesc": "Ordered commands and events saved for this Draft Room, including the actor, payload and timestamp.",
    "noDraftActions": "No Draft actions have been recorded yet.",
    "soloSignupOption": "Solo signup — assign me to a team",
    "soloAssignmentPending": "Solo team assignment",
    "hostConfirmsRosterLink": "The Host must confirm that this account matches the requested external roster.",
    "hostApprovesSoloPool": "The Host must approve this account for the private solo assignment pool.",
    "approveSoloPool": "Approve for solo pool",
    "soloPoolApproved": "Signup approved for the solo pool.",
    "soloRandomizer": "Randomize Solo Signups",
    "soloRandomizerDesc": "Preview equal private teams from approved, teamless signups. Confirmation creates the teams; previewing alone saves nothing.",
    "approvedSoloPool": "{count} APPROVED SOLO",
    "totalSlots": "Total slots",
    "teamSize": "Team size",
    "captainSelection": "Captain selection",
    "selfNominatedCaptains": "Self-nominated at signup",
    "hostSelectedCaptains": "Selected by Host",
    "selfNominatedCount": "self-nominated Captains",
    "selectHostCaptains": "Select exactly one Captain per generated team",
    "noApprovedSoloSignups": "No approved teamless solo signups are ready.",
    "previewSoloTeams": "PREVIEW SOLO TEAMS",
    "undoSoloTeams": "UNDO SOLO TEAMS",
    "previewAssignments": "Preview assignments",
    "previewOnlyNotSaved": "Not saved yet. Re-roll freely, then confirm one preview.",
    "rerollTeams": "RE-ROLL",
    "confirmTeams": "CONFIRM TEAMS",
    "confirmSoloTeamsPrompt": "Create these teams and assign every approved solo signup?",
    "soloTeamsConfirmed": "Solo teams created. Captain records were synchronized.",
    "undoSoloTeamsPrompt": "Undo the latest confirmed solo team assignment?",
    "soloTeamsUndone": "Solo team assignment undone; signups returned to the approved pool.",
    "soloRosterPrivateUntilMatch": "Roster members stay private until this team is assigned to a match.",
    "watchReadOnly": "WATCH (READ-ONLY)",
    "hostWatchingReadOnly": "HOST IS WATCHING · READ ONLY",
    "mobileMenu": "Open menu",
    "mobileClose": "Close menu",
    "mobileNavigation": "Navigation",
    "mobileAppearance": "Appearance & accessibility",
    "mobileLanguage": "Language",
    "mobileAccount": "Account",
    "mobileProfile": "Profile settings",
    "mobilePublicProfile": "Public profile",
    "mobileAccountLoading": "Loading account…",
    "mobileTheme": "Theme",
    "mobileSystem": "System",
    "mobileDark": "Dark",
    "mobileLight": "Light",
    "mobileContrast": "Contrast",
    "mobileStandard": "Standard",
    "mobileHigh": "High",
    "mobilePalette": "Role palette",
    "mobileDefault": "Default",
    "mobileAccessible": "Color-safe",
    "mobileMotion": "Motion",
    "mobileFull": "Full",
    "mobileReduced": "Reduced"
  },
  "ja": {
    "viewOnly": "閲覧のみ",
    "game": "ゲーム",
    "normal": "ノーマル",
    "roleNotAllowed": "現在の編成ルールでは{role}を選択できません",
    "teamA": "チームA",
    "teamB": "チームB",
    "noHeroesFilter": "条件に一致するヒーローはいません。",
    "loadoutHint": "基本3スロット · カードにカーソルを合わせるかフォーカスすると詳細を表示",
    "unassigned": "未割り当て",
    "effect": "効果",
    "noEffect": "効果は登録されていません。",
    "noteConditions": "注記／発動条件",
    "pinned": "固定中 · 外側をクリックして閉じる",
    "clickKeepOpen": "クリックすると表示を固定",
    "tankTechnical": "タンク＋テクニカル",
    "allRoles": "すべてのロール",
    "roleLimitReached": "{role}の上限に達しました（{limit}）",
    "squadraBlast": "Squadra Blast",
    "squadraBlastOption": "Squadra Blast — 自チームのゲーム1ピックはゲーム2に適用、BANの持ち越しは設定可能、ゲーム3でリセット",
    "squadraBlastRuleDesc": "ゲーム1では設定されたBANを行います。ゲーム2では新たなBANはなく、各チームはゲーム1で自分が選んだヒーローだけ再選択できません。ゲーム1のBANを両チームに継続するかは別のスイッチで設定できます。ゲーム3ですべてリセットされます。",
    "squadraBlastRemember": "各チーム自身のゲーム1ピックは常にゲーム2へ適用され、ゲーム1のBAN持ち越しは任意です。ゲーム3は新しく開始します。",
    "squadraBlastBanException": "Squadra Blast以外では、BANされたヒーローは次のゲームに持ち越されません。",
    "squadraBlastGame1": "SQUADRA BLAST · ゲーム1では設定されたBANを行い、そのBANと各チーム自身のピックがゲーム2に持ち越されます。",
    "squadraBlastGame2": "SQUADRA BLAST · 新たなBANはありません。ゲーム1のBANは両チームに継続し、各チームはゲーム1で自分が選んだヒーローだけ使用できません。",
    "squadraBlastGame3": "SQUADRA BLAST · ゲーム3では以前のBANとピック履歴をリセットし、設定されたミラーピックルールだけが残ります。",
    "squadraBlastPanel": "Squadra Blast：ゲーム2では各チームがゲーム1で自分が選んだヒーローだけ使用できず、ゲーム1のBANを継続するかはホストが選べます。ゲーム3ですべてリセットされます。",
    "blastBanReason": "Squadra Blast BAN — このゲーム終了まで有効",
    "squadraBlastCarryBans": "ゲーム1のBANをゲーム2へ持ち越す",
    "squadraBlastCarryBansDesc": "Squadra Blast専用。オフにするとゲーム1のBANはゲーム2で再使用できますが、各チーム自身のゲーム1ピックは引き続き使用できません。",
    "squadraBlastGame1NoCarry": "SQUADRA BLAST · ゲーム1では設定されたBANを行います。ゲーム2へ持ち越されるのは各チーム自身のピックだけで、BANは持ち越されません。",
    "squadraBlastGame2NoCarry": "SQUADRA BLAST · 新たなBANはありません。ゲーム1のBANは再び使用でき、各チームは自分がゲーム1で選んだヒーローだけ使用できません。",
    "discordInviteField": "Discord招待リンク",
    "joinDiscordServer": "Discordサーバーに参加 ↗",
    "startTournamentConfirm": "この大会を開始し、対戦可能な全試合のチェックインを開きますか？",
    "broadcasterRoleLabel": "配信担当 · 閲覧のみ",
    "broadcastReadOnlyPermissions": "このアカウントは両チームとライブDraftを閲覧できますが、ブラケット、Draft、チャット、結果は変更できません。",
    "resultReconfirmConfirm": "この結果を両キャプテンへ戻し、再承認を求めますか？",
    "portalYourTeamTag": "✓ あなたのチーム: {tag}",
    "submitApproveResultStep": "結果を送信・承認",
    "submitApproveResultTitle": "結果の送信と承認",
    "matchChatScreenshotDesc": "キャプテン、Host、連携済み選手、担当審判が参加できます。結果画像はチャット内に直接表示されます。",
    "captainStartTitle": "トーナメント開始とキャプテンチェックイン",
    "captainStartDescription": "手順に沿って進めてください。開始すると、現在対戦可能なすべての試合でチェックインが開き、各チームの連携済みキャプテンのみがチェックインします。",
    "startOpenCaptainCheckinStep": "開始してチェックインを開く",
    "captainAccountRequirement": "各チームで必要なのは有効なキャプテンアカウント1つだけです。チェックイン、コイントス、ドラフト操作、結果処理はキャプテンが行います。他のロースター枠はアカウント連携もドラフトルームへの参加も不要です。",
    "captainRunsDraft": "キャプテンがBAN/PICKを操作",
    "memberViewOnlyMatchHelp": "この試合の閲覧とマッチチャットの利用は可能です。チェックイン、ドラフトルームへの入室と操作、コイントス、結果の送信・確認は連携済みキャプテンのみ行えます。",
    "startTournamentButton": "大会を開始してチェックインを開く",
    "generateBracketFirst": "先にブラケットを生成してください",
    "resolvePreflightBlockers": "プレフライトの問題 {count} 件を解決してください",
    "waitingHostStartTournament": "Host がこの大会を開始するのを待っています",
    "waitingForTeamJoin": "{team} の参加を待っています",
    "waitingForTeamJoinDesc": "不足しているキャプテンが接続すると、ドラフトルームが自動的に始まります。Host が操作を引き継ぐ必要はありません。",
    "tournamentStartedStatus": "大会開始済み · チェックイン {checkin} · 準備完了 {ready}",
    "draftActionLog": "ドラフト操作ログ",
    "draftActionLogDesc": "このドラフトルームに保存されたコマンドとイベントを、実行者、内容、時刻とともに順番で表示します。",
    "noDraftActions": "ドラフト操作はまだ記録されていません。",
    "soloSignupOption": "個人参加 — チームに自動割り当て",
    "soloAssignmentPending": "個人参加のチーム割り当て",
    "hostConfirmsRosterLink": "Hostがこのアカウントと申請ロスターの一致を確認します。",
    "hostApprovesSoloPool": "Hostがこのアカウントを非公開の個人参加プールに承認します。",
    "approveSoloPool": "個人参加プールに承認",
    "soloPoolApproved": "個人参加プールに承認しました。",
    "soloRandomizer": "個人参加をランダム編成",
    "soloRandomizerDesc": "承認済みでチーム未所属の参加者から均等な非公開チームをプレビューします。確定するまで保存されません。",
    "approvedSoloPool": "承認済み個人参加 {count}名",
    "totalSlots": "総枠数",
    "teamSize": "チーム人数",
    "captainSelection": "キャプテン選出",
    "selfNominatedCaptains": "申請時の自己推薦",
    "hostSelectedCaptains": "Hostが選択",
    "selfNominatedCount": "自己推薦キャプテン",
    "selectHostCaptains": "生成する各チームにつきキャプテンを1名選択",
    "noApprovedSoloSignups": "承認済みのチーム未所属参加者はいません。",
    "previewSoloTeams": "チームをプレビュー",
    "undoSoloTeams": "個人チームを元に戻す",
    "previewAssignments": "割り当てプレビュー",
    "previewOnlyNotSaved": "まだ保存されていません。再抽選してから1つを確定してください。",
    "rerollTeams": "再抽選",
    "confirmTeams": "チームを確定",
    "confirmSoloTeamsPrompt": "このチームを作成し、承認済みの個人参加者を全員割り当てますか？",
    "soloTeamsConfirmed": "個人チームを作成し、キャプテン情報を同期しました。",
    "undoSoloTeamsPrompt": "直近の個人チーム割り当てを元に戻しますか？",
    "soloTeamsUndone": "割り当てを元に戻し、参加者を承認済みプールへ戻しました。",
    "soloRosterPrivateUntilMatch": "このチームが試合に割り当てられるまで、ロスターは非公開です。",
    "watchReadOnly": "閲覧する（読み取り専用）",
    "hostWatchingReadOnly": "ホストが閲覧中 · 読み取り専用",
    "mobileMenu": "メニューを開く",
    "mobileClose": "メニューを閉じる",
    "mobileNavigation": "ナビゲーション",
    "mobileAppearance": "表示とアクセシビリティ",
    "mobileLanguage": "言語",
    "mobileAccount": "アカウント",
    "mobileProfile": "プロフィール設定",
    "mobilePublicProfile": "公開プロフィール",
    "mobileAccountLoading": "アカウントを読み込み中…",
    "mobileTheme": "テーマ",
    "mobileSystem": "システム",
    "mobileDark": "ダーク",
    "mobileLight": "ライト",
    "mobileContrast": "コントラスト",
    "mobileStandard": "標準",
    "mobileHigh": "高",
    "mobilePalette": "ロール配色",
    "mobileDefault": "デフォルト",
    "mobileAccessible": "色覚対応",
    "mobileMotion": "モーション",
    "mobileFull": "フル",
    "mobileReduced": "低減"
  },
  "zh-CN": {
    "viewOnly": "仅查看",
    "game": "第{number}局",
    "normal": "普通",
    "roleNotAllowed": "当前阵容规则不允许选择{role}",
    "teamA": "A队",
    "teamB": "B队",
    "noHeroesFilter": "没有符合筛选条件的英雄。",
    "loadoutHint": "3个核心槽位 · 悬停或聚焦卡片可查看完整详情",
    "unassigned": "未分配",
    "effect": "效果",
    "noEffect": "尚未记录效果。",
    "noteConditions": "备注／发动条件",
    "pinned": "已固定 · 点击外部关闭",
    "clickKeepOpen": "点击卡片可保持展开",
    "tankTechnical": "坦克＋技巧",
    "allRoles": "全部职责",
    "roleLimitReached": "{role}已达到上限（{limit}）",
    "squadraBlast": "Squadra Blast",
    "squadraBlastOption": "Squadra Blast — 本队第1局选择影响第2局；禁用延续可配置；第3局重置",
    "squadraBlastRuleDesc": "第1局使用已配置的禁用次数。第2局不新增禁用，每队只能被限制自己在第1局选择过的英雄；第1局禁用是否继续对双方生效由单独开关控制。第3局全部重置。",
    "squadraBlastRemember": "各队自己的第1局选择始终影响第2局；第1局禁用是否延续可选；第3局重新开始。",
    "squadraBlastBanException": "除Squadra Blast外，被禁用的英雄不会延续到后续对局。",
    "squadraBlastGame1": "SQUADRA BLAST · 第1局使用已配置的禁用；这些禁用和各队自己的选择会延续到第2局。",
    "squadraBlastGame2": "SQUADRA BLAST · 不新增禁用。第1局禁用继续对双方生效，每队只会被限制自己在第1局选择过的英雄。",
    "squadraBlastGame3": "SQUADRA BLAST · 第3局重置此前的禁用和选择记录，只保留已配置的镜像选择规则。",
    "squadraBlastPanel": "Squadra Blast：第2局每队只失去自己在第1局选择过的英雄；主持人可选择第1局禁用是否继续生效。第3局重置两类记录。",
    "blastBanReason": "Squadra Blast禁用 — 本局结束前持续生效",
    "squadraBlastCarryBans": "将第1局禁用延续到第2局",
    "squadraBlastCarryBansDesc": "仅适用于Squadra Blast。关闭后，第1局禁用的英雄可在第2局重新使用，但每队自己在第1局选择的英雄仍会被锁定。",
    "squadraBlastGame1NoCarry": "SQUADRA BLAST · 第1局使用已配置的禁用。第2局只延续各队自己的选择，不延续禁用。",
    "squadraBlastGame2NoCarry": "SQUADRA BLAST · 不新增禁用。第1局禁用的英雄可再次使用，每队仍只会被限制自己在第1局选择过的英雄。",
    "discordInviteField": "Discord邀请链接",
    "joinDiscordServer": "加入Discord服务器 ↗",
    "startTournamentConfirm": "开始本次赛事并为所有可进行的比赛开放签到吗？",
    "broadcasterRoleLabel": "直播员 · 仅查看",
    "broadcastReadOnlyPermissions": "此账号可查看双方队伍和实时 Draft 状态，但不能修改对阵、Draft、聊天或结果。",
    "resultReconfirmConfirm": "将此结果退回双方队长并要求重新批准吗？",
    "portalYourTeamTag": "✓ 你的队伍：{tag}",
    "submitApproveResultStep": "提交并批准结果",
    "submitApproveResultTitle": "提交与批准结果",
    "matchChatScreenshotDesc": "队长、Host、已关联选手和指定裁判可参与。结果截图会直接显示在聊天中。",
    "captainStartTitle": "开始赛事与队长签到",
    "captainStartDescription": "请按顺序完成这些步骤。开始赛事后，当前可进行的所有比赛都会开放签到，并且只有各队已关联的队长可以签到。",
    "startOpenCaptainCheckinStep": "开始并开放签到",
    "captainAccountRequirement": "每队只需要一个有效的队长账号来完成签到、抛硬币、选禁操作和结果处理。其他阵容名额无需关联账号，也无需进入选禁房间。",
    "captainRunsDraft": "队长操作选禁",
    "memberViewOnlyMatchHelp": "你可以查看本场比赛并使用比赛聊天。只有已关联的队长可以签到、进入或操作选禁房间、进行抛硬币，以及提交或确认结果。",
    "startTournamentButton": "开始赛事并开放签到",
    "generateBracketFirst": "请先生成对阵表",
    "resolvePreflightBlockers": "请解决 {count} 个赛前检查阻塞项",
    "waitingHostStartTournament": "正在等待 Host 开始本次赛事",
    "waitingForTeamJoin": "正在等待 {team} 加入",
    "waitingForTeamJoinDesc": "缺席的队长连接后，选禁房间将自动开始。Host 无需接管操作。",
    "tournamentStartedStatus": "赛事已开始 · {checkin} 场签到 · {ready} 场就绪",
    "draftActionLog": "选禁操作日志",
    "draftActionLogDesc": "按顺序显示此选禁房间保存的命令和事件，包括操作者、内容与时间。",
    "noDraftActions": "尚未记录任何选禁操作。",
    "soloSignupOption": "个人报名 — 由系统分配队伍",
    "soloAssignmentPending": "个人报名队伍分配",
    "hostConfirmsRosterLink": "主办方必须确认该账号与申请的外部阵容一致。",
    "hostApprovesSoloPool": "主办方必须批准该账号进入私密个人分队池。",
    "approveSoloPool": "批准进入个人池",
    "soloPoolApproved": "已批准进入个人分队池。",
    "soloRandomizer": "随机分配个人报名",
    "soloRandomizerDesc": "从已批准且未入队的报名中预览人数相等的私密队伍；确认前不会保存。",
    "approvedSoloPool": "已批准个人报名 {count} 人",
    "totalSlots": "总名额",
    "teamSize": "每队人数",
    "captainSelection": "队长选择",
    "selfNominatedCaptains": "报名时自荐",
    "hostSelectedCaptains": "主办方指定",
    "selfNominatedCount": "名自荐队长",
    "selectHostCaptains": "为每支生成队伍准确选择一名队长",
    "noApprovedSoloSignups": "暂无已批准且未入队的个人报名。",
    "previewSoloTeams": "预览个人队伍",
    "undoSoloTeams": "撤销个人队伍",
    "previewAssignments": "分配预览",
    "previewOnlyNotSaved": "尚未保存。可以重新随机，再确认一个预览。",
    "rerollTeams": "重新随机",
    "confirmTeams": "确认队伍",
    "confirmSoloTeamsPrompt": "创建这些队伍并分配所有已批准的个人报名吗？",
    "soloTeamsConfirmed": "个人队伍已创建，队长记录已同步。",
    "undoSoloTeamsPrompt": "撤销最近确认的个人队伍分配吗？",
    "soloTeamsUndone": "已撤销分配，报名者已返回批准池。",
    "soloRosterPrivateUntilMatch": "在该队被分配到比赛前，完整阵容保持私密。",
    "watchReadOnly": "观看（只读）",
    "hostWatchingReadOnly": "主持人正在观看 · 只读",
    "mobileMenu": "打开菜单",
    "mobileClose": "关闭菜单",
    "mobileNavigation": "导航",
    "mobileAppearance": "界面与无障碍",
    "mobileLanguage": "语言",
    "mobileAccount": "账号",
    "mobileProfile": "资料设置",
    "mobilePublicProfile": "公开资料",
    "mobileAccountLoading": "正在加载账号…",
    "mobileTheme": "主题",
    "mobileSystem": "跟随系统",
    "mobileDark": "深色",
    "mobileLight": "浅色",
    "mobileContrast": "对比度",
    "mobileStandard": "标准",
    "mobileHigh": "高",
    "mobilePalette": "定位配色",
    "mobileDefault": "默认",
    "mobileAccessible": "色觉友好",
    "mobileMotion": "动态效果",
    "mobileFull": "完整",
    "mobileReduced": "减少"
  },
  "ko": {
    "viewOnly": "보기 전용",
    "game": "게임",
    "normal": "일반",
    "roleNotAllowed": "현재 조합 규칙에서는 {role} 역할을 선택할 수 없습니다",
    "teamA": "팀 A",
    "teamB": "팀 B",
    "noHeroesFilter": "필터와 일치하는 영웅이 없습니다.",
    "loadoutHint": "핵심 슬롯 3개 · 카드에 마우스를 올리거나 포커스하면 전체 세부 정보 표시",
    "unassigned": "미지정",
    "effect": "효과",
    "noEffect": "등록된 효과가 없습니다.",
    "noteConditions": "참고 / 발동 조건",
    "pinned": "고정됨 · 바깥을 클릭해 닫기",
    "clickKeepOpen": "카드를 클릭하면 계속 열어 둡니다",
    "tankTechnical": "탱커 + 테크니컬",
    "allRoles": "모든 역할",
    "roleLimitReached": "{role} 한도 도달 ({limit})",
    "squadraBlast": "Squadra Blast",
    "squadraBlastOption": "Squadra Blast — 각 팀의 게임 1 픽은 게임 2에 적용, 밴 유지 여부 설정 가능, 게임 3 초기화",
    "squadraBlastRuleDesc": "게임 1에서는 설정된 밴을 진행합니다. 게임 2에는 새 밴이 없고 각 팀은 게임 1에서 자신이 선택한 영웅만 다시 고를 수 없습니다. 게임 1 밴을 양 팀에 유지할지는 별도 스위치로 정합니다. 게임 3에서 모두 초기화됩니다.",
    "squadraBlastRemember": "각 팀 자신의 게임 1 픽은 항상 게임 2에 적용되고, 게임 1 밴 유지 여부는 선택할 수 있습니다. 게임 3은 새로 시작합니다.",
    "squadraBlastBanException": "Squadra Blast 외 규칙에서는 밴된 영웅이 다음 게임으로 이어지지 않습니다.",
    "squadraBlastGame1": "SQUADRA BLAST · 게임 1에서 설정된 밴을 진행하며, 그 밴과 각 팀 자신의 픽이 게임 2로 이어집니다.",
    "squadraBlastGame2": "SQUADRA BLAST · 새 밴은 없습니다. 게임 1 밴은 양 팀에 유지되고 각 팀은 게임 1에서 자신이 선택한 영웅만 사용할 수 없습니다.",
    "squadraBlastGame3": "SQUADRA BLAST · 게임 3에서 이전 밴과 픽 기록을 초기화하고 설정된 미러 픽 규칙만 유지합니다.",
    "squadraBlastPanel": "Squadra Blast: 게임 2에서 각 팀은 게임 1의 자기 픽만 잃고, 게임 1 밴 유지 여부는 호스트가 선택합니다. 게임 3에서 두 기록을 모두 초기화합니다.",
    "blastBanReason": "Squadra Blast 밴 — 이번 게임 종료까지 적용",
    "squadraBlastCarryBans": "게임 1 밴을 게임 2에 유지",
    "squadraBlastCarryBansDesc": "Squadra Blast 전용입니다. 끄면 게임 1 밴 영웅을 게임 2에서 다시 사용할 수 있지만 각 팀의 게임 1 픽은 계속 잠깁니다.",
    "squadraBlastGame1NoCarry": "SQUADRA BLAST · 게임 1에서 설정된 밴을 진행합니다. 게임 2에는 각 팀 자신의 픽만 이어지고 밴은 이어지지 않습니다.",
    "squadraBlastGame2NoCarry": "SQUADRA BLAST · 새 밴은 없습니다. 게임 1 밴 영웅은 다시 사용할 수 있고 각 팀은 자신이 게임 1에서 선택한 영웅만 사용할 수 없습니다.",
    "discordInviteField": "Discord 초대 링크",
    "joinDiscordServer": "Discord 서버 참가 ↗",
    "startTournamentConfirm": "이 대회를 시작하고 진행 가능한 모든 경기의 체크인을 열까요?",
    "broadcasterRoleLabel": "방송 담당 · 보기 전용",
    "broadcastReadOnlyPermissions": "이 계정은 양 팀과 실시간 Draft 상태를 볼 수 있지만 대진표, Draft, 채팅 또는 결과를 변경할 수 없습니다.",
    "resultReconfirmConfirm": "이 결과를 양 팀 주장에게 돌려보내 새 승인을 요청할까요?",
    "portalYourTeamTag": "✓ 내 팀: {tag}",
    "submitApproveResultStep": "결과 제출 및 승인",
    "submitApproveResultTitle": "결과 제출과 승인",
    "matchChatScreenshotDesc": "주장, Host, 연결된 선수와 배정된 심판이 참여합니다. 결과 스크린샷은 채팅에 바로 표시됩니다.",
    "captainStartTitle": "토너먼트 시작 및 주장 체크인",
    "captainStartDescription": "단계를 순서대로 진행하세요. 시작하면 현재 진행 가능한 모든 경기에 체크인이 열리며, 각 팀에 연결된 주장만 체크인합니다.",
    "startOpenCaptainCheckinStep": "시작하고 체크인 열기",
    "captainAccountRequirement": "팀마다 활성 주장 계정 하나만 있으면 체크인, 동전 던지기, 드래프트 조작과 결과 처리를 할 수 있습니다. 다른 로스터 슬롯은 계정 연결이나 드래프트 룸 입장이 필요하지 않습니다.",
    "captainRunsDraft": "주장이 밴/픽 진행",
    "memberViewOnlyMatchHelp": "이 경기를 보고 매치 채팅을 사용할 수 있습니다. 체크인, 드래프트 룸 입장 및 조작, 동전 던지기, 결과 제출 또는 확인은 연결된 주장만 할 수 있습니다.",
    "startTournamentButton": "대회 시작 및 체크인 열기",
    "generateBracketFirst": "먼저 대진표를 생성하세요",
    "resolvePreflightBlockers": "프리플라이트 차단 항목 {count}개를 해결하세요",
    "waitingHostStartTournament": "Host가 이 대회를 시작하기를 기다리는 중",
    "waitingForTeamJoin": "{team} 참가를 기다리는 중",
    "waitingForTeamJoinDesc": "아직 접속하지 않은 주장이 연결되면 드래프트 룸이 자동으로 시작됩니다. Host가 제어권을 가져올 필요는 없습니다.",
    "tournamentStartedStatus": "대회 시작됨 · 체크인 {checkin} · 준비 {ready}",
    "draftActionLog": "드래프트 작업 로그",
    "draftActionLogDesc": "이 드래프트 룸에 저장된 명령과 이벤트를 실행자, 내용, 시간과 함께 순서대로 표시합니다.",
    "noDraftActions": "기록된 드래프트 작업이 아직 없습니다.",
    "soloSignupOption": "개인 참가 — 팀 자동 배정",
    "soloAssignmentPending": "개인 참가 팀 배정",
    "hostConfirmsRosterLink": "Host가 이 계정과 신청한 외부 로스터가 일치하는지 확인해야 합니다.",
    "hostApprovesSoloPool": "Host가 이 계정을 비공개 개인 배정 풀에 승인해야 합니다.",
    "approveSoloPool": "개인 풀 승인",
    "soloPoolApproved": "개인 배정 풀에 승인했습니다.",
    "soloRandomizer": "개인 참가 무작위 팀 편성",
    "soloRandomizerDesc": "승인된 무소속 참가자로 같은 인원의 비공개 팀을 미리 봅니다. 확정 전에는 저장되지 않습니다.",
    "approvedSoloPool": "승인된 개인 참가 {count}명",
    "totalSlots": "전체 슬롯",
    "teamSize": "팀 인원",
    "captainSelection": "주장 선택",
    "selfNominatedCaptains": "신청 시 자원",
    "hostSelectedCaptains": "Host 직접 선택",
    "selfNominatedCount": "명의 자원 주장",
    "selectHostCaptains": "생성할 각 팀에 주장 한 명씩 선택",
    "noApprovedSoloSignups": "승인된 무소속 개인 참가자가 없습니다.",
    "previewSoloTeams": "개인 팀 미리 보기",
    "undoSoloTeams": "개인 팀 되돌리기",
    "previewAssignments": "배정 미리 보기",
    "previewOnlyNotSaved": "아직 저장되지 않았습니다. 다시 섞은 뒤 하나를 확정하세요.",
    "rerollTeams": "다시 섞기",
    "confirmTeams": "팀 확정",
    "confirmSoloTeamsPrompt": "이 팀을 만들고 승인된 모든 개인 참가자를 배정할까요?",
    "soloTeamsConfirmed": "개인 팀을 만들고 주장 기록을 동기화했습니다.",
    "undoSoloTeamsPrompt": "최근 확정한 개인 팀 배정을 되돌릴까요?",
    "soloTeamsUndone": "배정을 되돌리고 참가자를 승인 풀로 복원했습니다.",
    "soloRosterPrivateUntilMatch": "이 팀이 경기에 배정될 때까지 전체 로스터는 비공개입니다.",
    "watchReadOnly": "시청 (읽기 전용)",
    "hostWatchingReadOnly": "호스트 시청 중 · 읽기 전용",
    "mobileMenu": "메뉴 열기",
    "mobileClose": "메뉴 닫기",
    "mobileNavigation": "탐색",
    "mobileAppearance": "화면 및 접근성",
    "mobileLanguage": "언어",
    "mobileAccount": "계정",
    "mobileProfile": "프로필 설정",
    "mobilePublicProfile": "공개 프로필",
    "mobileAccountLoading": "계정 불러오는 중…",
    "mobileTheme": "테마",
    "mobileSystem": "시스템",
    "mobileDark": "다크",
    "mobileLight": "라이트",
    "mobileContrast": "대비",
    "mobileStandard": "표준",
    "mobileHigh": "높음",
    "mobilePalette": "역할 색상",
    "mobileDefault": "기본",
    "mobileAccessible": "색각 보정",
    "mobileMotion": "모션",
    "mobileFull": "전체",
    "mobileReduced": "줄이기"
  },
  "es": {
    "viewOnly": "SOLO LECTURA",
    "game": "PARTIDA",
    "normal": "NORMAL",
    "roleNotAllowed": "La composición actual no permite seleccionar {role}",
    "teamA": "EQUIPO A",
    "teamB": "EQUIPO B",
    "noHeroesFilter": "No hay héroes que coincidan con este filtro.",
    "loadoutHint": "Tres espacios principales · pasa el cursor o enfoca una carta para ver todos los detalles",
    "unassigned": "Sin asignar",
    "effect": "Efecto",
    "noEffect": "No hay ningún efecto registrado.",
    "noteConditions": "Nota / Condiciones de activación",
    "pinned": "FIJADO · HAZ CLIC FUERA PARA CERRAR",
    "clickKeepOpen": "HAZ CLIC EN LA CARTA PARA MANTENERLA ABIERTA",
    "tankTechnical": "Tanque + Técnico",
    "allRoles": "Todos los roles",
    "roleLimitReached": "Se alcanzó el límite de {role} ({limit})",
    "squadraBlast": "Squadra Blast",
    "squadraBlastOption": "Squadra Blast — las elecciones propias de la partida 1 afectan a la 2; mantener los bloqueos es configurable; la 3 se reinicia",
    "squadraBlastRuleDesc": "La partida 1 usa los bloqueos configurados. En la partida 2 no hay bloqueos nuevos y cada equipo solo pierde sus propias elecciones de la partida 1; un interruptor aparte decide si los bloqueos de la partida 1 siguen activos para ambos. La partida 3 reinicia ambos historiales.",
    "squadraBlastRemember": "Las elecciones propias de cada equipo en la partida 1 siempre afectan a la 2; mantener los bloqueos es opcional; la partida 3 empieza de cero.",
    "squadraBlastBanException": "Fuera de Squadra Blast, los héroes bloqueados no pasan a partidas posteriores.",
    "squadraBlastGame1": "SQUADRA BLAST · La partida 1 usa los bloqueos configurados; esos bloqueos y las elecciones propias de cada equipo pasan a la partida 2.",
    "squadraBlastGame2": "SQUADRA BLAST · No hay bloqueos nuevos. Los de la partida 1 siguen activos para ambos equipos y cada equipo solo pierde sus propias elecciones de la partida 1.",
    "squadraBlastGame3": "SQUADRA BLAST · La partida 3 reinicia los bloqueos y elecciones anteriores; solo permanece la regla de elección espejo configurada.",
    "squadraBlastPanel": "Squadra Blast: en la partida 2 cada equipo solo pierde sus propias elecciones de la partida 1; el Host decide si los bloqueos también siguen activos. La partida 3 reinicia ambos historiales.",
    "blastBanReason": "Bloqueo Squadra Blast — activo hasta terminar esta partida",
    "squadraBlastCarryBans": "Mantener los bloqueos de la partida 1 en la 2",
    "squadraBlastCarryBansDesc": "Solo para Squadra Blast. Al desactivarlo, los héroes bloqueados en la partida 1 vuelven a estar disponibles en la 2; las elecciones propias de cada equipo siguen bloqueadas.",
    "squadraBlastGame1NoCarry": "SQUADRA BLAST · La partida 1 usa los bloqueos configurados. Solo las elecciones propias pasan a la partida 2; los bloqueos no.",
    "squadraBlastGame2NoCarry": "SQUADRA BLAST · No hay bloqueos nuevos. Los bloqueos de la partida 1 vuelven a estar disponibles y cada equipo solo pierde sus propias elecciones de la partida 1.",
    "discordInviteField": "Enlace de invitación de Discord",
    "joinDiscordServer": "Unirse al servidor de Discord ↗",
    "startTournamentConfirm": "¿Iniciar este torneo y abrir el check-in de todos los partidos disponibles?",
    "broadcasterRoleLabel": "BROADCASTER · SOLO LECTURA",
    "broadcastReadOnlyPermissions": "Esta cuenta puede ver ambos equipos y el estado del Draft en directo, pero no puede cambiar el bracket, el Draft, el chat ni el resultado.",
    "resultReconfirmConfirm": "¿Devolver este resultado a ambos Capitanes y exigir una nueva aprobación?",
    "portalYourTeamTag": "✓ Tu equipo: {tag}",
    "submitApproveResultStep": "Enviar y aprobar resultado",
    "submitApproveResultTitle": "Enviar y aprobar resultado",
    "matchChatScreenshotDesc": "Capitanes, Host, jugadores vinculados y árbitro asignado. Las capturas del resultado aparecen directamente en el chat.",
    "captainStartTitle": "Iniciar torneo y check-in de capitanes",
    "captainStartDescription": "Sigue estos pasos en orden. Al iniciar se abre el check-in de todos los partidos disponibles; solo entra el Capitán vinculado de cada equipo.",
    "startOpenCaptainCheckinStep": "Iniciar y abrir check-in",
    "captainAccountRequirement": "Solo se requiere una cuenta de Capitán activa por equipo para el check-in, el lanzamiento de moneda, el control del Draft y los resultados. Los demás puestos del roster no necesitan una cuenta vinculada ni entrar en la sala de Draft.",
    "captainRunsDraft": "El Capitán controla bans/picks",
    "memberViewOnlyMatchHelp": "Puedes ver este partido y usar el chat. Solo el Capitán vinculado puede hacer check-in, entrar o controlar la sala de Draft, lanzar la moneda y enviar o verificar resultados.",
    "startTournamentButton": "INICIAR TORNEO Y ABRIR CHECK-IN",
    "generateBracketFirst": "Genera primero el bracket",
    "resolvePreflightBlockers": "Resuelve {count} bloqueo(s) de la comprobación previa",
    "waitingHostStartTournament": "Esperando a que el Host inicie este torneo",
    "waitingForTeamJoin": "Esperando a que se una {team}",
    "waitingForTeamJoinDesc": "La sala de Draft comenzará automáticamente cuando se conecte el Capitán que falta. El Host no necesita tomar el control.",
    "tournamentStartedStatus": "TORNEO INICIADO · {checkin} CHECK-IN · {ready} LISTOS",
    "draftActionLog": "Registro de acciones del Draft",
    "draftActionLogDesc": "Comandos y eventos guardados en orden para esta sala de Draft, con actor, contenido y hora.",
    "noDraftActions": "Todavía no se ha registrado ninguna acción del Draft.",
    "soloSignupOption": "Inscripción individual — asignarme a un equipo",
    "soloAssignmentPending": "Asignación de equipo individual",
    "hostConfirmsRosterLink": "El Host debe confirmar que esta cuenta coincide con la plantilla externa solicitada.",
    "hostApprovesSoloPool": "El Host debe aprobar esta cuenta para el grupo privado de asignación individual.",
    "approveSoloPool": "Aprobar para grupo individual",
    "soloPoolApproved": "Inscripción aprobada para el grupo individual.",
    "soloRandomizer": "Aleatorizar inscripciones individuales",
    "soloRandomizerDesc": "Previsualiza equipos privados y equilibrados con inscripciones aprobadas sin equipo. Nada se guarda hasta confirmar.",
    "approvedSoloPool": "{count} INDIVIDUALES APROBADOS",
    "totalSlots": "Plazas totales",
    "teamSize": "Tamaño del equipo",
    "captainSelection": "Selección de capitán",
    "selfNominatedCaptains": "Autonominado al inscribirse",
    "hostSelectedCaptains": "Elegido por el Host",
    "selfNominatedCount": "capitanes autonominados",
    "selectHostCaptains": "Elige exactamente un capitán por equipo generado",
    "noApprovedSoloSignups": "No hay inscripciones individuales aprobadas sin equipo.",
    "previewSoloTeams": "PREVISUALIZAR EQUIPOS",
    "undoSoloTeams": "DESHACER EQUIPOS",
    "previewAssignments": "Vista previa de asignaciones",
    "previewOnlyNotSaved": "Aún no está guardado. Vuelve a sortear y confirma una vista previa.",
    "rerollTeams": "VOLVER A SORTEAR",
    "confirmTeams": "CONFIRMAR EQUIPOS",
    "confirmSoloTeamsPrompt": "¿Crear estos equipos y asignar todas las inscripciones individuales aprobadas?",
    "soloTeamsConfirmed": "Equipos creados y registros de capitanes sincronizados.",
    "undoSoloTeamsPrompt": "¿Deshacer la última asignación confirmada de equipos individuales?",
    "soloTeamsUndone": "Asignación deshecha; las inscripciones volvieron al grupo aprobado.",
    "soloRosterPrivateUntilMatch": "La plantilla completa permanece privada hasta que el equipo tenga un partido asignado.",
    "watchReadOnly": "VER (SOLO LECTURA)",
    "hostWatchingReadOnly": "EL HOST ESTÁ MIRANDO · SOLO LECTURA",
    "mobileMenu": "Abrir menú",
    "mobileClose": "Cerrar menú",
    "mobileNavigation": "Navegación",
    "mobileAppearance": "Apariencia y accesibilidad",
    "mobileLanguage": "Idioma",
    "mobileAccount": "Cuenta",
    "mobileProfile": "Ajustes del perfil",
    "mobilePublicProfile": "Perfil público",
    "mobileAccountLoading": "Cargando cuenta…",
    "mobileTheme": "Tema",
    "mobileSystem": "Sistema",
    "mobileDark": "Oscuro",
    "mobileLight": "Claro",
    "mobileContrast": "Contraste",
    "mobileStandard": "Estándar",
    "mobileHigh": "Alto",
    "mobilePalette": "Paleta de roles",
    "mobileDefault": "Predeterminada",
    "mobileAccessible": "Apta para daltonismo",
    "mobileMotion": "Movimiento",
    "mobileFull": "Completo",
    "mobileReduced": "Reducido"
  },
  "vi": {
    "viewOnly": "CHỈ XEM",
    "game": "VÁN",
    "normal": "THƯỜNG",
    "roleNotAllowed": "Đội hình hiện tại không cho phép chọn vai trò {role}",
    "teamA": "ĐỘI A",
    "teamB": "ĐỘI B",
    "noHeroesFilter": "Không có chiến binh phù hợp bộ lọc này.",
    "loadoutHint": "Ba ô cốt lõi · rê chuột hoặc focus vào thẻ để xem đầy đủ chi tiết",
    "unassigned": "Chưa phân loại",
    "effect": "Hiệu ứng",
    "noEffect": "Chưa có hiệu ứng được ghi nhận.",
    "noteConditions": "Ghi chú / Điều kiện kích hoạt",
    "pinned": "ĐÃ GHIM · NHẤP BÊN NGOÀI ĐỂ ĐÓNG",
    "clickKeepOpen": "NHẤP VÀO THẺ ĐỂ GIỮ BẢNG NÀY MỞ",
    "tankTechnical": "Đỡ đòn + Kỹ thuật",
    "allRoles": "Tất cả vai trò",
    "roleLimitReached": "Đã đạt giới hạn {role} ({limit})",
    "squadraBlast": "Squadra Blast",
    "squadraBlastOption": "Squadra Blast — lựa chọn riêng ở Ván 1 áp dụng cho Ván 2; lượt cấm có thể bật/tắt duy trì; Ván 3 đặt lại",
    "squadraBlastRuleDesc": "Ván 1 dùng số lượt cấm đã cấu hình. Ván 2 không có lượt cấm mới và mỗi đội chỉ không được dùng lại các tướng chính mình đã chọn ở Ván 1; một công tắc riêng quyết định lượt cấm Ván 1 có tiếp tục áp dụng cho cả hai đội hay không. Ván 3 đặt lại cả hai.",
    "squadraBlastRemember": "Lựa chọn riêng của mỗi đội ở Ván 1 luôn áp dụng cho Ván 2; duy trì lượt cấm Ván 1 là tùy chọn; Ván 3 bắt đầu lại.",
    "squadraBlastBanException": "Ngoài Squadra Blast, chiến binh bị cấm không bị khóa sang các ván sau.",
    "squadraBlastGame1": "SQUADRA BLAST · Ván 1 dùng số lượt cấm đã cấu hình; các lượt cấm đó và lựa chọn riêng của mỗi đội sẽ áp dụng cho Ván 2.",
    "squadraBlastGame2": "SQUADRA BLAST · Không có lượt cấm mới. Lượt cấm Ván 1 vẫn áp dụng cho cả hai đội, còn mỗi đội chỉ bị khóa các lựa chọn của chính mình ở Ván 1.",
    "squadraBlastGame3": "SQUADRA BLAST · Ván 3 xóa lịch sử cấm và chọn trước đó; chỉ còn luật chọn trùng đối thủ đã cấu hình.",
    "squadraBlastPanel": "Squadra Blast: ở Ván 2 mỗi đội chỉ mất lựa chọn của chính mình từ Ván 1; Host quyết định lượt cấm Ván 1 có tiếp tục áp dụng hay không. Ván 3 xóa cả hai lịch sử.",
    "blastBanReason": "Cấm Squadra Blast — áp dụng đến hết ván này",
    "squadraBlastCarryBans": "Áp dụng lượt cấm Ván 1 sang Ván 2",
    "squadraBlastCarryBansDesc": "Chỉ dành cho Squadra Blast. Tắt mục này để các tướng bị cấm ở Ván 1 được dùng lại trong Ván 2; các tướng do chính mỗi đội chọn ở Ván 1 vẫn bị khóa.",
    "squadraBlastGame1NoCarry": "SQUADRA BLAST · Ván 1 dùng số lượt cấm đã cấu hình. Sang Ván 2 chỉ giữ khóa lựa chọn riêng của mỗi đội, không giữ lượt cấm.",
    "squadraBlastGame2NoCarry": "SQUADRA BLAST · Không có lượt cấm mới. Tướng bị cấm ở Ván 1 được dùng lại, còn mỗi đội chỉ bị khóa các tướng chính mình đã chọn ở Ván 1.",
    "discordInviteField": "Link mời Discord",
    "joinDiscordServer": "Vào server Discord ↗",
    "startTournamentConfirm": "Bắt đầu giải và mở check-in cho tất cả trận có thể thi đấu?",
    "broadcasterRoleLabel": "BROADCASTER · CHỈ XEM",
    "broadcastReadOnlyPermissions": "Tài khoản này được xem hai đội và trạng thái Draft trực tiếp, nhưng không thể sửa bracket, Draft, chat hoặc kết quả.",
    "resultReconfirmConfirm": "Trả kết quả này về cho cả hai Đội trưởng và yêu cầu duyệt lại?",
    "portalYourTeamTag": "✓ Đội của bạn: {tag}",
    "submitApproveResultStep": "Gửi và duyệt kết quả",
    "submitApproveResultTitle": "Gửi & Duyệt kết quả",
    "matchChatScreenshotDesc": "Đội trưởng, Host, thành viên đã liên kết và trọng tài được chỉ định. Ảnh kết quả sẽ hiện trực tiếp trong chat.",
    "captainStartTitle": "Bắt đầu giải & Check-in Đội trưởng",
    "captainStartDescription": "Làm lần lượt theo các bước này. Khi bắt đầu giải, mọi trận hiện có thể thi đấu sẽ mở check-in; chỉ Đội trưởng đã liên kết của mỗi đội được check-in.",
    "startOpenCaptainCheckinStep": "Bắt đầu & mở check-in",
    "captainAccountRequirement": "Mỗi đội chỉ cần một tài khoản Đội trưởng đang hoạt động để check-in, tung đồng xu, điều khiển Draft và xử lý kết quả. Các vị trí thành viên còn lại không cần liên kết tài khoản hoặc có mặt trong Draft Room.",
    "captainRunsDraft": "Đội trưởng điều khiển ban/pick",
    "memberViewOnlyMatchHelp": "Bạn có thể xem trận và dùng Match Chat. Chỉ Đội trưởng đã liên kết mới được check-in, vào hoặc điều khiển Draft Room, tung đồng xu và gửi hoặc xác nhận kết quả.",
    "startTournamentButton": "BẮT ĐẦU GIẢI & MỞ CHECK-IN",
    "generateBracketFirst": "Hãy tạo bracket trước",
    "resolvePreflightBlockers": "Xử lý {count} mục chặn preflight",
    "waitingHostStartTournament": "Đang chờ Host bắt đầu giải đấu này",
    "waitingForTeamJoin": "Đang chờ {team} tham gia",
    "waitingForTeamJoinDesc": "Draft Room sẽ tự bắt đầu khi Đội trưởng còn thiếu kết nối. Host không cần giành quyền điều khiển.",
    "tournamentStartedStatus": "GIẢI ĐÃ BẮT ĐẦU · {checkin} CHECK-IN · {ready} SẴN SÀNG",
    "draftActionLog": "Nhật ký thao tác Draft",
    "draftActionLogDesc": "Các lệnh và sự kiện đã lưu theo thứ tự cho Draft Room này, gồm người thực hiện, nội dung và thời gian.",
    "noDraftActions": "Chưa ghi nhận thao tác Draft nào.",
    "soloSignupOption": "Đăng ký cá nhân — xếp tôi vào một đội",
    "soloAssignmentPending": "Phân đội cho đăng ký cá nhân",
    "hostConfirmsRosterLink": "Host phải xác nhận tài khoản này khớp với roster bên ngoài đã yêu cầu.",
    "hostApprovesSoloPool": "Host phải duyệt tài khoản này vào nhóm phân đội cá nhân riêng tư.",
    "approveSoloPool": "Duyệt vào nhóm cá nhân",
    "soloPoolApproved": "Đã duyệt đăng ký vào nhóm phân đội cá nhân.",
    "soloRandomizer": "Chia đội ngẫu nhiên cho đăng ký cá nhân",
    "soloRandomizerDesc": "Xem trước các đội riêng tư có quân số bằng nhau từ những đăng ký đã duyệt nhưng chưa có đội. Chỉ lưu khi xác nhận.",
    "approvedSoloPool": "{count} CÁ NHÂN ĐÃ DUYỆT",
    "totalSlots": "Tổng số chỗ",
    "teamSize": "Quân số mỗi đội",
    "captainSelection": "Cách chọn Đội trưởng",
    "selfNominatedCaptains": "Tự ứng cử khi đăng ký",
    "hostSelectedCaptains": "Host tự chọn",
    "selfNominatedCount": "Đội trưởng tự ứng cử",
    "selectHostCaptains": "Chọn đúng một Đội trưởng cho mỗi đội sẽ tạo",
    "noApprovedSoloSignups": "Chưa có đăng ký cá nhân chưa có đội nào được duyệt.",
    "previewSoloTeams": "XEM TRƯỚC ĐỘI",
    "undoSoloTeams": "HOÀN TÁC CHIA ĐỘI",
    "previewAssignments": "Xem trước phân đội",
    "previewOnlyNotSaved": "Chưa lưu. Có thể chia lại nhiều lần rồi xác nhận một bản xem trước.",
    "rerollTeams": "CHIA LẠI",
    "confirmTeams": "XÁC NHẬN ĐỘI",
    "confirmSoloTeamsPrompt": "Tạo các đội này và xếp toàn bộ đăng ký cá nhân đã duyệt?",
    "soloTeamsConfirmed": "Đã tạo đội và đồng bộ dữ liệu Đội trưởng.",
    "undoSoloTeamsPrompt": "Hoàn tác lần chia đội cá nhân đã xác nhận gần nhất?",
    "soloTeamsUndone": "Đã hoàn tác; các đăng ký trở lại nhóm đã duyệt.",
    "soloRosterPrivateUntilMatch": "Roster đầy đủ được giữ riêng tư cho đến khi đội được xếp vào một trận.",
    "watchReadOnly": "XEM (CHỈ ĐỌC)",
    "hostWatchingReadOnly": "HOST ĐANG XEM · CHỈ ĐỌC",
    "mobileMenu": "Mở menu",
    "mobileClose": "Đóng menu",
    "mobileNavigation": "Điều hướng",
    "mobileAppearance": "Giao diện & khả năng truy cập",
    "mobileLanguage": "Ngôn ngữ",
    "mobileAccount": "Tài khoản",
    "mobileProfile": "Cài đặt hồ sơ",
    "mobilePublicProfile": "Hồ sơ công khai",
    "mobileAccountLoading": "Đang tải tài khoản…",
    "mobileTheme": "Giao diện",
    "mobileSystem": "Theo hệ thống",
    "mobileDark": "Tối",
    "mobileLight": "Sáng",
    "mobileContrast": "Độ tương phản",
    "mobileStandard": "Tiêu chuẩn",
    "mobileHigh": "Cao",
    "mobilePalette": "Bảng màu vai trò",
    "mobileDefault": "Mặc định",
    "mobileAccessible": "Dễ phân biệt màu",
    "mobileMotion": "Chuyển động",
    "mobileFull": "Đầy đủ",
    "mobileReduced": "Giảm"
  }
});


const GENERATED_SOURCE_TO_KEY = Object.freeze(Object.fromEntries(
  Object.entries({ ...UI.en, ...UI_EXTRA.en, ...PAGE_UI.en })
    .filter(([, value]) => typeof value === 'string' && !value.includes('{'))
    .map(([key, value]) => [value, key])
));

const GENERATED_TEMPLATE_PATTERNS = Object.freeze(
  Object.entries({ ...UI.en, ...UI_EXTRA.en, ...PAGE_UI.en })
    .filter(([, value]) => typeof value === 'string' && /\{[a-zA-Z][a-zA-Z0-9_]*\}/.test(value))
    .map(([key, value]) => {
      const names = [];
      const chunks = String(value).split(/(\{[a-zA-Z][a-zA-Z0-9_]*\})/g);
      const source = chunks.map(chunk => {
        const match = /^\{([a-zA-Z][a-zA-Z0-9_]*)\}$/.exec(chunk);
        if (match) { names.push(match[1]); return '(.+?)'; }
        return chunk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }).join('');
      return { key, names, regex: new RegExp(`^${source}$`, 'i'), specificity: value.length };
    })
    .sort((a, b) => b.specificity - a.specificity)
);

function translateTemplateSource(trimmed) {
  for (const template of GENERATED_TEMPLATE_PATTERNS) {
    const match = template.regex.exec(trimmed);
    if (!match) continue;
    const params = Object.fromEntries(template.names.map((name, index) => [name, match[index + 1]]));
    return t(template.key, params);
  }
  return null;
}

export function normalizeLocale(value) {
  const raw = String(value || '').trim();
  if (LOCALES[raw]) return raw;
  const lower = raw.toLowerCase();
  if (lower.startsWith('ja')) return 'ja';
  if (lower.startsWith('zh')) return 'zh-CN';
  if (lower.startsWith('ko')) return 'ko';
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('vi')) return 'vi';
  return 'en';
}

const HAS_DOM = typeof window !== 'undefined' && typeof document !== 'undefined';
const runtimeSearch = typeof location !== 'undefined' ? location.search : '';
const runtimeLanguage = typeof navigator !== 'undefined' ? navigator.language : 'en';
const storedLocale = (() => {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : ''; }
  catch { return ''; }
})();
let locale = normalizeLocale(new URLSearchParams(runtimeSearch).get('lang') || storedLocale || runtimeLanguage);
let selectorRepairScheduled = false;

export function getLocale() { return locale; }
export function setLocale(next, { reload = true } = {}) {
  locale = normalizeLocale(next);
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, locale); } catch { /* storage may be blocked */ }
  if (reload && typeof location !== 'undefined' && typeof location.reload === 'function') location.reload();
  else if (HAS_DOM) {
    applyTranslations(document);
    window.dispatchEvent(new CustomEvent('gs:locale-change', { detail: { locale } }));
  }
}

export function t(key, params = {}, explicitLocale = locale) {
  const table = UI[explicitLocale] || UI.en;
  let value = PAGE_UI[explicitLocale]?.[key] ?? UI_EXTRA[explicitLocale]?.[key] ?? table[key] ?? PAGE_UI.en[key] ?? UI_EXTRA.en[key] ?? UI.en[key] ?? key;
  const replacements = ['heroRoster', 'heroesShown', 'search39Roster'].includes(key) && params.count == null
    ? { ...params, count: HEROES.length }
    : params;
  for (const [name, replacement] of Object.entries(replacements)) value = String(value).replaceAll(`{${name}}`, String(replacement));
  return value;
}

export function heroName(id, fallback = '', explicitLocale = locale) {
  const heroId = String(id || '').padStart(4, '0');
  if (explicitLocale === 'en') return fallback || EN_HERO_NAMES[heroId] || heroId;
  return HERO_NAMES[explicitLocale]?.[heroId] || fallback || EN_HERO_NAMES[heroId] || heroId;
}

export function roleLabel(role, explicitLocale = locale) {
  return t(ROLE_KEYS[role] || String(role || '').toLowerCase(), {}, explicitLocale);
}

export function translateHeroText(source, targetLocale = locale) {
  const text = String(source || '');
  if (!text || targetLocale === 'en') return text;
  return EXACT_GAME_TEXT[targetLocale]?.[text] || text;
}

export function localizeHeroDetail(hero, detail = {}, explicitLocale = locale) {
  const heroId = String(hero?.id || '').padStart(4, '0');
  const override = HERO_DETAIL_OVERRIDES[explicitLocale]?.[heroId];
  // Fail closed: a hero detail is localized only when a complete, source-verified
  // record exists. Mixing exact English mechanics with phrase-dictionary guesses
  // produced copy that did not match the official game text.
  const skills = Array.isArray(detail.skills) ? detail.skills.map(skill => {
    const localized = override?.skills?.[skill.id];
    return override ? { ...skill, name: localized.name, desc: localized.desc } : { ...skill };
  }) : [];
  return {
    ...detail,
    name: heroName(heroId, hero?.name, explicitLocale),
    roleLabel: roleLabel(hero?.role, explicitLocale),
    description: override ? override.description : detail.description,
    skills,
    translationComplete: Boolean(override),
    translationStatus: override?.translationStatus || 'english-fallback',
    translationSource: override?.translationStatus || '',
  };
}

export function localizeDraftReason(reason, role = '') {
  if (!reason) return '';
  const code = typeof reason === 'string' ? reason : reason.code;
  const label = typeof reason === 'string' ? reason : reason.label;
  const keys = { missing:'unavailable', unavailable:'unavailable', global_ban:'globalBanReason', protected_hero:'protectedReason', current_game_ban:'currentGameBanReason', current_game_pick:'currentGamePickReason', same_team_duplicate:'sameTeamDuplicateReason', mirror_disabled:'mirrorDisabledReason', mirror_not_allowed:'mirrorDisabledReason', fearless_lock:'fearlessLockReason', team_lock:'teamLockReason', blast_ban:'blastBanReason', role_complete_ban:'roleBanReason', target_role_complete:'roleBanReason' };
  const key = keys[code];
  return key ? t(key, { role: roleLabel(role || String(label || '').split(' ')[0]) }) : label;
}

function translatePattern(trimmed) {
  let match;
  if ((match = trimmed.match(/^WAITING FOR (.+?)(?:\.\.\.)?$/i))) return t('waitingFor', { team: translateSourceText(match[1]) });
  if ((match = trimmed.match(/^PICK\s+(\d+)$/i))) return t('pickNumber', { number: match[1] });
  if ((match = trimmed.match(/^HERO\s+(\d{4})$/i))) return t('heroId', { id: match[1] });
  if ((match = trimmed.match(/^(\d+) entries from the hero database$/i))) return t('entriesFromDb', { count: match[1] });
  if ((match = trimmed.match(/^(\d+) per team$/i))) return t('perTeam', { count: match[1] });
  if ((match = trimmed.match(/^(\d+) seconds$/i))) return t('seconds', { count: match[1] });
  if ((match = trimmed.match(/^(\d+) heroes$/i))) return t('heroesCount', { count: match[1] });
  if ((match = trimmed.match(/^(\d+) bans$/i))) return t('bansCount', { count: match[1] });
  if ((match = trimmed.match(/^(\d+)s turns$/i))) return t('turnsCount', { count: match[1] });
  if ((match = trimmed.match(/^Send to (.+)$/i))) return t('sendTo', { team: match[1] });
  if ((match = trimmed.match(/^GAME (\d+) DRAFT COMPLETE$/i))) return t('gameDraftComplete', { game: match[1] });
  if ((match = trimmed.match(/^(.+) WON THIS GAME$/i))) return t('teamWon', { team: translateSourceText(match[1]) });
  if ((match = trimmed.match(/^(.+) Choice$/i))) return t('teamChoice', { team: translateSourceText(match[1]) });
  if ((match = trimmed.match(/^(Damage|Tank|Technical) limit reached \((\d+)\)$/i))) return t('roleLimitReached', { role: roleLabel(match[1][0].toUpperCase() + match[1].slice(1).toLowerCase()), limit: match[2] });
  return null;
}

export function translateSourceText(source) {
  const text = String(source || '');
  const trimmed = text.trim();
  if (!trimmed) return source;
  const key = GENERATED_SOURCE_TO_KEY[trimmed] || SOURCE_TO_KEY[trimmed];
  if (key) return text.replace(trimmed, t(key));
  const generatedTemplate = translateTemplateSource(trimmed);
  if (generatedTemplate != null) return text.replace(trimmed, generatedTemplate);
  const pattern = translatePattern(trimmed);
  if (pattern != null) return text.replace(trimmed, pattern);
  const heroId = HERO_ID_BY_EN_NAME[trimmed];
  if (heroId) return text.replace(trimmed, heroName(heroId, trimmed));
  return source;
}

const ORIGINAL_TEXT = new WeakMap();
const ORIGINAL_ATTRS = new WeakMap();
const DATA_I18N_SELECTOR = '[data-i18n],[data-i18n-placeholder],[data-i18n-title],[data-i18n-aria-label],[data-i18n-alt]';
const LEGACY_ATTRIBUTE_SELECTOR = '[placeholder],[title],[aria-label]';
const OBSERVER_OPTIONS = Object.freeze({
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['placeholder','title','aria-label','data-i18n','data-i18n-params','data-i18n-placeholder','data-i18n-title','data-i18n-aria-label','data-i18n-alt'],
  subtree: true,
});

let observer;
let applyingTranslations = false;
let observerStarted = false;
let flushScheduled = false;
const pendingRoots = new Set();

function setNodeValue(node, value) {
  const next = String(value ?? '');
  if (node.nodeValue !== next) node.nodeValue = next;
}

function setElementText(element, value) {
  const next = String(value ?? '');
  // textContent is destructive: writing the same value still replaces child nodes in
  // several browsers and feeds the MutationObserver again. Only write on change.
  if (element.textContent !== next) element.textContent = next;
}

function setElementHtml(element, value) {
  const next = String(value ?? '');
  if (element.innerHTML !== next) element.innerHTML = next;
}

function setElementAttribute(element, name, value) {
  const next = String(value ?? '');
  if (element.getAttribute(name) !== next) element.setAttribute(name, next);
}

function translateTextNode(node) {
  if (!node || !node.nodeValue) return;
  if (!ORIGINAL_TEXT.has(node)) ORIGINAL_TEXT.set(node, node.nodeValue);
  setNodeValue(node, translateSourceText(ORIGINAL_TEXT.get(node)));
}

function translateAttributes(element) {
  if (!ORIGINAL_ATTRS.has(element)) ORIGINAL_ATTRS.set(element, {});
  const originals = ORIGINAL_ATTRS.get(element);
  for (const attr of ['placeholder','title','aria-label']) {
    if (!element.hasAttribute(attr)) continue;
    if (!(attr in originals)) originals[attr] = element.getAttribute(attr);
    const source = originals[attr];
    let translated;
    if (attr === 'placeholder' && source === 'Search hero name…') translated = t('searchHero');
    else if (attr === 'placeholder' && source === 'Type message or room code…') translated = t('typeMessage');
    else if (attr === 'placeholder' && source === 'e.g. Community BO3') translated = t('presetNameExample');
    else if (attr === 'placeholder' && source === 'Explain when this preset should be used.') translated = t('presetDescHelp');
    else translated = translateSourceText(source);
    setElementAttribute(element, attr, translated);
  }
}

function parseI18nParams(element) {
  const raw = element.getAttribute('data-i18n-params');
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function translateDataElement(element) {
  const params = parseI18nParams(element);
  const key = element.getAttribute('data-i18n');
  if (key) {
    const value = t(key, params);
    if (element.hasAttribute('data-i18n-html')) setElementHtml(element, value);
    else setElementText(element, value);
  }
  for (const [attribute, keyName] of [
    ['placeholder', element.getAttribute('data-i18n-placeholder')],
    ['title', element.getAttribute('data-i18n-title')],
    ['aria-label', element.getAttribute('data-i18n-aria-label')],
    ['alt', element.getAttribute('data-i18n-alt')],
  ]) {
    if (keyName) setElementAttribute(element, attribute, t(keyName, params));
  }
}

function isElement(value) {
  return typeof Element !== 'undefined' && value instanceof Element;
}

function queryWithRoot(root, selector) {
  if (isElement(root)) {
    const nodes = root.matches(selector) ? [root] : [];
    return nodes.concat([...root.querySelectorAll(selector)]);
  }
  return [...document.querySelectorAll(selector)];
}

function translateRoot(root) {
  if (!root?.isConnected && root !== document) return;
  if (document.documentElement.lang !== (LOCALES[locale]?.htmlLang || 'en')) {
    document.documentElement.lang = LOCALES[locale]?.htmlLang || 'en';
  }
  if (document.documentElement.dataset.locale !== locale) {
    document.documentElement.dataset.locale = locale;
  }

  queryWithRoot(root, DATA_I18N_SELECTOR).forEach(translateDataElement);

  // Legacy/fallback path for content generated by JavaScript. Static HTML uses
  // data-i18n, so this walk is limited to the newly rendered subtree.
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      const parent = node.parentElement;
      if (!parent || ['SCRIPT','STYLE','TEXTAREA','CODE','PRE','OPTION'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest('[data-no-i18n],[data-i18n]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  while (walker.nextNode()) translateTextNode(walker.currentNode);

  queryWithRoot(root, LEGACY_ATTRIBUTE_SELECTOR)
    .filter(element => !element.closest('[data-no-i18n],[data-i18n]'))
    .forEach(translateAttributes);
}

function startObserver() {
  if (!observer || observerStarted || !document.body) return;
  observer.observe(document.body, OBSERVER_OPTIONS);
  observerStarted = true;
}

function stopObserver() {
  if (!observer || !observerStarted) return;
  observer.disconnect();
  observerStarted = false;
}

export function applyTranslations(root = HAS_DOM ? document : null) {
  if (!HAS_DOM || !root || applyingTranslations) return;
  const shouldResume = observerStarted;
  if (shouldResume) stopObserver();
  applyingTranslations = true;
  try {
    translateRoot(root);
    // Discard mutations caused by our own idempotent writes before reconnecting.
    observer?.takeRecords();
  } finally {
    applyingTranslations = false;
    if (shouldResume) startObserver();
  }
}

function queueTranslationRoot(node) {
  let root = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  if (!root || root.nodeType !== Node.ELEMENT_NODE || root.closest?.('[data-no-i18n]')) return;

  // If a parent is already queued, this subtree is already covered. Conversely,
  // replace queued descendants with their newly queued parent.
  for (const queued of pendingRoots) {
    if (queued === root || queued.contains?.(root)) return;
    if (root.contains?.(queued)) pendingRoots.delete(queued);
  }
  pendingRoots.add(root);
  if (flushScheduled) return;
  flushScheduled = true;
  queueMicrotask(flushTranslationQueue);
}

function flushTranslationQueue() {
  flushScheduled = false;
  if (!pendingRoots.size) return;
  const roots = [...pendingRoots];
  pendingRoots.clear();

  const shouldResume = observerStarted;
  if (shouldResume) stopObserver();
  applyingTranslations = true;
  try {
    roots.forEach(translateRoot);
    observer?.takeRecords();
  } finally {
    applyingTranslations = false;
    if (shouldResume) startObserver();
  }
}

function languageHost() {
  const explicit = document.querySelector('[data-language-slot]');
  if (explicit) return explicit;
  const account = document.querySelector('.home-nav .home-account, .content-nav .content-account, .dashboard-nav .home-account, .dashboard-header .home-account, header .home-account, header .content-account, header nav + div, header');
  if (!account) return null;
  const slot = document.createElement('div');
  slot.className = 'gs-language-slot';
  slot.dataset.languageSlot = 'true';
  account.appendChild(slot);
  return slot;
}

function isBroadcastOverlay() {
  return document.body?.classList.contains('broadcast-page');
}

function installSelector() {
  if (isBroadcastOverlay() || document.querySelector('.gs-language-switcher')) return;
  const host = languageHost();
  if (!host) return;
  const switcher = document.createElement('div');
  switcher.className = 'gs-language-switcher';
  switcher.dataset.noI18n = 'true';
  switcher.innerHTML = `<button class="gs-language-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-label="${t('selectLanguage')}"><span class="gs-language-glyph" aria-hidden="true">文/A</span><span class="gs-language-current">${LOCALES[locale].shortLabel}</span><span class="gs-language-chevron" aria-hidden="true">⌄</span></button><div class="gs-language-menu" role="listbox" aria-label="${t('selectLanguage')}">${Object.entries(LOCALES).map(([code, item]) => `<button type="button" role="option" aria-selected="${code === locale}" data-locale="${code}"><span>${item.label}</span><small>${item.shortLabel}</small></button>`).join('')}</div>`;
  const trigger = switcher.querySelector('.gs-language-trigger');
  const menu = switcher.querySelector('.gs-language-menu');
  const close = () => { switcher.classList.remove('open'); trigger.setAttribute('aria-expanded','false'); };
  trigger.addEventListener('click', event => { event.stopPropagation(); const open = switcher.classList.toggle('open'); trigger.setAttribute('aria-expanded', String(open)); });
  menu.addEventListener('click', event => { const option = event.target.closest('[data-locale]'); if (option) setLocale(option.dataset.locale); });
  document.addEventListener('click', event => { if (!switcher.contains(event.target)) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  host.appendChild(switcher);
}

function scheduleSelectorRepair() {
  if (isBroadcastOverlay() || selectorRepairScheduled) return;
  selectorRepairScheduled = true;
  queueMicrotask(() => {
    selectorRepairScheduled = false;
    if (document.querySelector('.gs-language-switcher')) return;

    // Account/header renderers may replace their innerHTML after i18n initializes.
    // Reinstall the selector into the current header without letting our own DOM
    // writes feed back into the translation observer.
    const shouldResume = observerStarted;
    if (shouldResume) stopObserver();
    try {
      installSelector();
      observer?.takeRecords();
    } finally {
      if (shouldResume) startObserver();
    }
  });
}

function init() {
  applyTranslations(document);
  installSelector();
  // Translate the selector after it is inserted, then start observing application
  // renders. The observer callback only queues roots; it never translates inline.
  applyTranslations(document.querySelector('[data-language-slot]') || document);
  observer = new MutationObserver(records => {
    if (applyingTranslations) return;
    let headerMayHaveChanged = false;
    for (const record of records) {
      if (record.type === 'characterData') {
        queueTranslationRoot(record.target);
        continue;
      }
      if (record.type === 'attributes') {
        queueTranslationRoot(record.target);
        continue;
      }
      headerMayHaveChanged = true;
      for (const node of record.addedNodes) queueTranslationRoot(node);
    }
    if (headerMayHaveChanged && !document.querySelector('.gs-language-switcher')) {
      scheduleSelectorRepair();
    }
  });
  startObserver();
  window.dispatchEvent(new CustomEvent('gs:locale-ready', { detail: { locale } }));
}

if (HAS_DOM) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}

const crypto = require('node:crypto');
const { db, transaction, jsonParse } = require('./db');
const { hashPassword, tokenHash } = require('./auth');
const { generateSingleElimination, listMatches } = require('./bracket-service');
const { submitResult } = require('./result-service');

const TEAM_BLUEPRINTS = [
  ['Blue Comets','BLUE'],['Red Dragons','RED'],['Green Guardians','GRN'],['Golden Saiyans','GOLD'],
  ['Violet Gods','VIO'],['Rose Reapers','ROSE'],['Azure Fusions','AZUR'],['Crimson Pride','CRIM'],
];

function randomSuffix() {
  return `${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`.toLowerCase();
}

function randomPassword() {
  return `Test-${crypto.randomBytes(5).toString('base64url')}9!`;
}

function randomCode(length = 12) {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length).toUpperCase();
}

async function insertUser({ suiteId, suffix, persona, displayName, role='player', password }) {
  const safePersona = persona.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
  const username = `test_${safePersona}_${suffix}`.slice(0, 60);
  const email = `${username}@fixture.local`;
  const result = db.prepare(`INSERT INTO users(username,email,display_name,password_hash,role,is_active,email_verified_at)
    VALUES (?,?,?,?,?,1,CURRENT_TIMESTAMP)`).run(username,email,displayName,await hashPassword(password),role);
  const userId = Number(result.lastInsertRowid);
  db.prepare('INSERT INTO dev_test_suite_users(suite_id,user_id,persona) VALUES (?,?,?)').run(suiteId,userId,persona);
  return db.prepare('SELECT * FROM users WHERE id=?').get(userId);
}

function insertTournament({ suiteId, scenario, hostUserId, suffix, name, status, startOffsetHours=0, description='' }) {
  const startAt = new Date(Date.now() + startOffsetHours * 3600000).toISOString();
  const slug = `test-${scenario}-${suffix}`;
  const rules = {
    structure:'single', playoffBestOf:3, grandFinalBestOf:3, timerSeconds:30, heroBans:2,
    divineBans:0, draftStyle:'standard', mirrorPickMode:'none', enableCoinFlip:true,
    enableDivineDraw:true, divineDrawMode:'random', cinematicLockIn:true, flashAndShake:false,
  };
  const result = db.prepare(`INSERT INTO tournaments(
      host_user_id,name,slug,description,status,timezone,default_server,start_at,schedule_mode,
      source_platform,source_url,source_external_id,source_metadata_json,source_sync_status,is_public,rules_json
    ) VALUES (?,?,?,?,?,'Asia/Ho_Chi_Minh','Asia',?,'fixed_tournament_start','test-fixture','','',?,'ready',1,?)`)
    .run(hostUserId,name,slug,description,status,startAt,JSON.stringify({fixture:true,scenario}),JSON.stringify(rules));
  const tournamentId = Number(result.lastInsertRowid);
  db.prepare('INSERT INTO dev_test_suite_tournaments(suite_id,tournament_id,scenario) VALUES (?,?,?)').run(suiteId,tournamentId,scenario);
  return db.prepare('SELECT * FROM tournaments WHERE id=?').get(tournamentId);
}

function addStaff(tournamentId, userId, role) {
  db.prepare(`INSERT INTO tournament_staff(tournament_id,user_id,role,permissions_json)
    VALUES (?,?,?,'[]') ON CONFLICT(tournament_id,user_id,role) DO NOTHING`).run(tournamentId,userId,role);
}

function insertTeam({ tournamentId, name, tag, seed=null, captain=null, player=null, ready=true, createOpenSlots=false }) {
  const result = db.prepare(`INSERT INTO teams(
      tournament_id,name,tag,source,seed,status,team_status,captain_user_id,region,updated_at
    ) VALUES (?,?,?,'manual',?,?,?,?,?,CURRENT_TIMESTAMP)`)
    .run(tournamentId,name,tag,seed,ready?'ready':'pending',ready?'ready':'captain_pending',captain?.id||null,seed && seed % 2 ? 'Asia East' : 'Asia West');
  const teamId = Number(result.lastInsertRowid);
  if (captain) {
    db.prepare(`INSERT INTO team_members(team_id,user_id,display_name,gamer_tag,game_id,member_role,membership_status,is_captain)
      VALUES (?,?,?,?,?,'captain','active',1)`).run(teamId,captain.id,captain.display_name,`${tag}-CAP`,`${tag}-1001`);
  } else if (createOpenSlots) {
    db.prepare(`INSERT INTO team_members(team_id,user_id,display_name,gamer_tag,game_id,member_role,membership_status,is_captain)
      VALUES (?,NULL,?,?,?,'captain','active',1)`).run(teamId,`${name} Captain Slot`,`${tag}-CAP`,`${tag}-1001`);
  }
  if (player) {
    db.prepare(`INSERT INTO team_members(team_id,user_id,display_name,gamer_tag,game_id,member_role,membership_status,is_captain)
      VALUES (?,?,?,?,?,'player','active',0)`).run(teamId,player.id,player.display_name,`${tag}-P1`,`${tag}-2001`);
  } else if (createOpenSlots) {
    db.prepare(`INSERT INTO team_members(team_id,user_id,display_name,gamer_tag,game_id,member_role,membership_status,is_captain)
      VALUES (?,NULL,?,?,?,'player','active',0)`).run(teamId,`${name} Player Slot`,`${tag}-P1`,`${tag}-2001`);
  }
  return db.prepare('SELECT * FROM teams WHERE id=?').get(teamId);
}

function assignMatchStaff(tournamentId, refereeId, broadcasterId) {
  db.prepare(`UPDATE matches SET assigned_referee_id=?,assigned_broadcaster_id=?,scheduled_at=COALESCE(scheduled_at,datetime('now','+30 minutes')),
    room_code=CASE WHEN room_code='' THEN printf('TEST%04d',id) ELSE room_code END,updated_at=CURRENT_TIMESTAMP
    WHERE tournament_id=?`).run(refereeId,broadcasterId,tournamentId);
}

function createDraftRoomForFirstMatch(tournamentId, hostUserId) {
  const match = db.prepare(`SELECT m.*,a.name team_a_name,b.name team_b_name,a.logo_url team_a_logo,b.logo_url team_b_logo,t.name tournament_name,t.rules_json tournament_rules_json
    FROM matches m JOIN tournaments t ON t.id=m.tournament_id
    LEFT JOIN teams a ON a.id=m.team_a_id LEFT JOIN teams b ON b.id=m.team_b_id
    WHERE m.tournament_id=? AND m.team_a_id IS NOT NULL AND m.team_b_id IS NOT NULL ORDER BY m.round_no,m.position LIMIT 1`).get(tournamentId);
  if (!match) return null;
  const roomCode = randomCode(8);
  const access = { host:randomCode(32),teamA:randomCode(32),teamB:randomCode(32),referee:randomCode(32),broadcaster:randomCode(32) };
  const rules = jsonParse(match.tournament_rules_json,{});
  const config = {
    teamA:match.team_a_name,teamB:match.team_b_name,teamAId:match.team_a_id,teamBId:match.team_b_id,
    teamALogoUrl:match.team_a_logo||'',teamBLogoUrl:match.team_b_logo||'',format:`BO${match.best_of}`,
    gameNumber:1,seriesRule:match.series_rule,seriesScoreA:0,seriesScoreB:0,previousPicksA:[],previousPicksB:[],
    timerSeconds:Number(rules.timerSeconds||30),heroBans:Number(rules.heroBans||2),divineBans:Number(rules.divineBans||0),
    draftStyle:rules.draftStyle||'standard',mirrorPickMode:rules.mirrorPickMode||'none',enableCoinFlip:rules.enableCoinFlip!==false,
    enableDivineDraw:rules.enableDivineDraw!==false,divineDrawMode:rules.divineDrawMode||'random',enableProtect:false,
    protectNewest:false,protectList:[],globalBanList:[],heroRuleScope:'match',cinematicLockIn:true,flashAndShake:false,
    theme:'beerus',matchId:match.id,tournamentId, tournamentName:match.tournament_name,roundName:match.round_name,
    serverRegion:match.server_region,scheduledAt:match.scheduled_at,roomMode:'bandai-tool',roomCode:match.room_code||'',
  };
  db.prepare(`INSERT INTO match_games(match_id,game_number,status,server_region,room_code) VALUES (?,1,'waiting_draft',?,?)
    ON CONFLICT(match_id,game_number) DO NOTHING`).run(match.id,match.server_region,match.room_code||'');
  db.prepare(`INSERT INTO draft_rooms(match_id,room_code,status,config_json,state_json,access_json,created_by)
    VALUES (?,?,'waiting',?,?,?,?)`).run(match.id,roomCode,JSON.stringify(config),JSON.stringify({status:'waiting',gameNumber:1,seriesScoreA:0,seriesScoreB:0}),JSON.stringify(access),hostUserId);
  return { matchId:match.id, roomCode, access };
}

function completeTournament(tournamentId, refereeUserId) {
  let guard = 0;
  while (guard++ < 30) {
    const open = db.prepare(`SELECT m.*,a.seed seed_a,b.seed seed_b FROM matches m
      LEFT JOIN teams a ON a.id=m.team_a_id LEFT JOIN teams b ON b.id=m.team_b_id
      WHERE m.tournament_id=? AND m.result_status!='final' AND m.team_a_id IS NOT NULL AND m.team_b_id IS NOT NULL
      ORDER BY m.round_no,m.position`).all(tournamentId);
    if (!open.length) break;
    let progressed = false;
    for (const match of open) {
      const winnerA = Number(match.seed_a||999) <= Number(match.seed_b||999);
      const wins = Math.floor(Number(match.best_of||3)/2)+1;
      submitResult({
        matchId:match.id,userId:refereeUserId,sourceType:'referee_ruling',
        scoreA:winnerA?wins:0,scoreB:winnerA?0:wins,note:'Generated by Dev/Test Console',
      });
      progressed = true;
    }
    if (!progressed) break;
  }
  const unfinished = db.prepare(`SELECT COUNT(*) count FROM matches WHERE tournament_id=? AND team_a_id IS NOT NULL AND team_b_id IS NOT NULL AND result_status!='final'`).get(tournamentId).count;
  if (unfinished) throw new Error('Could not complete every generated fixture match.');
  db.prepare(`UPDATE tournaments SET status='completed',finalized_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(tournamentId);
}

function cleanupTestSuite(suiteId) {
  const suite = db.prepare('SELECT * FROM dev_test_suites WHERE id=?').get(Number(suiteId));
  if (!suite) throw new Error('Test suite not found.');
  const tournamentIds = db.prepare('SELECT tournament_id FROM dev_test_suite_tournaments WHERE suite_id=?').all(suite.id).map(row=>row.tournament_id);
  const userIds = db.prepare('SELECT user_id FROM dev_test_suite_users WHERE suite_id=?').all(suite.id).map(row=>row.user_id);
  transaction(()=>{
    for (const id of tournamentIds) db.prepare('DELETE FROM tournaments WHERE id=?').run(id);
    db.prepare('DELETE FROM dev_test_suites WHERE id=?').run(suite.id);
    for (const id of userIds) {
      const external = db.prepare(`SELECT 1 FROM team_members tm JOIN teams t ON t.id=tm.team_id
        WHERE tm.user_id=? AND t.tournament_id NOT IN (SELECT tournament_id FROM dev_test_suite_tournaments WHERE suite_id=?) LIMIT 1`).get(id,suite.id);
      if (!external) db.prepare('DELETE FROM users WHERE id=?').run(id);
    }
  });
  return { removed:true, tournamentCount:tournamentIds.length, userCount:userIds.length };
}

async function createTestSuite(adminUserId) {
  const suffix = randomSuffix();
  const password = randomPassword();
  const suiteResult = db.prepare('INSERT INTO dev_test_suites(name,created_by) VALUES (?,?)').run(`Full Tournament Test Suite ${suffix.toUpperCase()}`,adminUserId);
  const suiteId = Number(suiteResult.lastInsertRowid);
  try {
    const host = await insertUser({suiteId,suffix,persona:'host',displayName:'Test Host',role:'host',password});
    const referee = await insertUser({suiteId,suffix,persona:'referee',displayName:'Test Referee',role:'referee',password});
    const broadcaster = await insertUser({suiteId,suffix,persona:'broadcaster',displayName:'Test Broadcaster',role:'broadcaster',password});
    const captains=[]; const players=[];
    for(let i=0;i<8;i++){
      captains.push(await insertUser({suiteId,suffix,persona:`captain_${i+1}`,displayName:`Test Captain ${i+1}`,password}));
      players.push(await insertUser({suiteId,suffix,persona:`player_${i+1}`,displayName:`Test Player ${i+1}`,password}));
    }
    const applicantCaptain=await insertUser({suiteId,suffix,persona:'applicant_captain',displayName:'Captain Applicant',password});
    const applicantPlayer=await insertUser({suiteId,suffix,persona:'applicant_player',displayName:'Player Applicant',password});

    const registration = insertTournament({suiteId,scenario:'registration',hostUserId:host.id,suffix,name:'TEST · Registration & Join Lab',status:'registration_open',startOffsetHours:72,description:'Test player join requests, captain linking, roster review and team approval.'});
    addStaff(registration.id,referee.id,'referee'); addStaff(registration.id,broadcaster.id,'broadcaster');
    const registrationTeams=[];
    for(let i=0;i<4;i++) registrationTeams.push(insertTeam({tournamentId:registration.id,name:`Open ${TEAM_BLUEPRINTS[i][0]}`,tag:`O${TEAM_BLUEPRINTS[i][1]}`.slice(0,5),seed:i+1,ready:false,createOpenSlots:true}));
    const openMember=db.prepare(`SELECT id FROM team_members WHERE team_id=? AND member_role='player' LIMIT 1`).get(registrationTeams[0].id);
    db.prepare(`INSERT INTO tournament_join_requests(tournament_id,team_id,selected_member_id,user_id,requested_role,gamer_tag,message,status)
      VALUES (?,?,?,?,?,'APPLICANT-P1','Pre-created pending request for Host review.','pending')`)
      .run(registration.id,registrationTeams[0].id,openMember.id,applicantPlayer.id,'player');

    const bracket = insertTournament({suiteId,scenario:'bracket',hostUserId:host.id,suffix,name:'TEST · Bracket Generation Lab',status:'preparing',startOffsetHours:24,description:'Eight ready teams with valid seeds and no matches yet. Run Preflight, edit seeding and generate the bracket manually.'});
    addStaff(bracket.id,referee.id,'referee'); addStaff(bracket.id,broadcaster.id,'broadcaster');
    for(let i=0;i<8;i++) insertTeam({tournamentId:bracket.id,name:`Bracket ${TEAM_BLUEPRINTS[i][0]}`,tag:`B${TEAM_BLUEPRINTS[i][1]}`.slice(0,5),seed:i+1,captain:captains[i],player:players[i],ready:true});

    const live = insertTournament({suiteId,scenario:'live',hostUserId:host.id,suffix,name:'TEST · Captain Check-in & Live Bracket',status:'checkin_open',startOffsetHours:1,description:'Test bracket generation, Captain check-in, match chat, Draft Room, Referee and Broadcast views.'});
    addStaff(live.id,referee.id,'referee'); addStaff(live.id,broadcaster.id,'broadcaster');
    for(let i=0;i<8;i++) insertTeam({tournamentId:live.id,name:TEAM_BLUEPRINTS[i][0],tag:TEAM_BLUEPRINTS[i][1],seed:i+1,captain:captains[i],player:players[i],ready:true});
    generateSingleElimination(live.id,{bestOf:3,userId:host.id,allowWarnings:true});
    db.prepare(`UPDATE matches SET status='checkin_open',match_status='checkin_open' WHERE tournament_id=? AND team_a_id IS NOT NULL AND team_b_id IS NOT NULL AND match_status='available'`).run(live.id);
    assignMatchStaff(live.id,referee.id,broadcaster.id);
    const draft = createDraftRoomForFirstMatch(live.id,host.id);

    const completed = insertTournament({suiteId,scenario:'completed',hostUserId:host.id,suffix,name:'TEST · Completed Championship History',status:'running',startOffsetHours:-168,description:'Completed fixture used to verify profile history, achievements and organizer totals.'});
    addStaff(completed.id,referee.id,'referee'); addStaff(completed.id,broadcaster.id,'broadcaster');
    for(let i=0;i<8;i++) insertTeam({tournamentId:completed.id,name:`Legacy ${TEAM_BLUEPRINTS[i][0]}`,tag:`L${TEAM_BLUEPRINTS[i][1]}`.slice(0,5),seed:i+1,captain:captains[i],player:players[i],ready:true});
    generateSingleElimination(completed.id,{bestOf:3,userId:host.id,allowWarnings:true});
    assignMatchStaff(completed.id,referee.id,broadcaster.id);
    completeTournament(completed.id,referee.id);

    db.prepare(`INSERT INTO audit_logs(tournament_id,user_id,action,details_json) VALUES (?,?,?,?)`).run(registration.id,adminUserId,'dev_fixture.created',JSON.stringify({suiteId,scenario:'registration'}));
    db.prepare(`INSERT INTO audit_logs(tournament_id,user_id,action,details_json) VALUES (?,?,?,?)`).run(bracket.id,adminUserId,'dev_fixture.created',JSON.stringify({suiteId,scenario:'bracket'}));
    db.prepare(`INSERT INTO audit_logs(tournament_id,user_id,action,details_json) VALUES (?,?,?,?)`).run(live.id,adminUserId,'dev_fixture.created',JSON.stringify({suiteId,scenario:'live'}));
    db.prepare(`INSERT INTO audit_logs(tournament_id,user_id,action,details_json) VALUES (?,?,?,?)`).run(completed.id,adminUserId,'dev_fixture.created',JSON.stringify({suiteId,scenario:'completed'}));

    return { suiteId, password, draft, suite:listTestSuites().find(item=>item.id===suiteId) };
  } catch (error) {
    try { cleanupTestSuite(suiteId); } catch {}
    throw error;
  }
}

function accessLink(user, target) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO dev_access_tokens(token_hash,user_id,expires_at) VALUES (?,?,?)`)
    .run(tokenHash(token),user.id,expiresAt);
  return `/dev-access.html#code=${encodeURIComponent(token)}&next=${encodeURIComponent(target)}`;
}

function consumeDevAccessCode(code) {
  const row = db.prepare(`SELECT t.*,u.* FROM dev_access_tokens t JOIN users u ON u.id=t.user_id
    WHERE t.token_hash=? AND t.used_at IS NULL AND datetime(t.expires_at)>datetime('now') LIMIT 1`).get(tokenHash(code));
  if (!row) return null;
  const used = db.prepare('UPDATE dev_access_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=? AND used_at IS NULL').run(row.id);
  return used.changes ? row : null;
}

function listTestSuites() {
  const suites = db.prepare(`SELECT s.*,u.display_name created_by_name FROM dev_test_suites s JOIN users u ON u.id=s.created_by ORDER BY s.id DESC`).all();
  return suites.map(suite=>{
    const users=db.prepare(`SELECT su.persona,u.id,u.username,u.email,u.display_name,u.role FROM dev_test_suite_users su JOIN users u ON u.id=su.user_id WHERE su.suite_id=? ORDER BY su.persona`).all(suite.id);
    const tournaments=db.prepare(`SELECT st.scenario,t.id,t.name,t.slug,t.status,t.start_at FROM dev_test_suite_tournaments st JOIN tournaments t ON t.id=st.tournament_id WHERE st.suite_id=? ORDER BY CASE st.scenario WHEN 'registration' THEN 1 WHEN 'bracket' THEN 2 WHEN 'live' THEN 3 ELSE 4 END`).all(suite.id);
    const byPersona=new Map(users.map(user=>[user.persona,user]));
    const byScenario=new Map(tournaments.map(t=>[t.scenario,t]));
    const host=byPersona.get('host');const referee=byPersona.get('referee');const broadcaster=byPersona.get('broadcaster');
    const live=byScenario.get('live');const registration=byScenario.get('registration');const bracket=byScenario.get('bracket');
    const firstLiveMatch=live?db.prepare(`SELECT id FROM matches WHERE tournament_id=? AND team_a_id IS NOT NULL AND team_b_id IS NOT NULL ORDER BY round_no,position LIMIT 1`).get(live.id):null;
    const room=firstLiveMatch?db.prepare('SELECT room_code,access_json FROM draft_rooms WHERE match_id=?').get(firstLiveMatch.id):null;
    const roomAccess=room?jsonParse(room.access_json,{}):{};
    const personas=users.map(user=>{
      let target='/portal.html';
      if(user.persona==='host')target=`/dashboard.html?tournamentId=${live?.id||''}`;
      else if(user.persona==='referee')target=`/dashboard.html?tournamentId=${live?.id||''}`;
      else if(user.persona==='broadcaster')target='/broadcast.html';
      return {...user,accessUrl:accessLink(user,target)};
    });
    const quickLinks={
      host:host?accessLink(host,`/dashboard.html?tournamentId=${live?.id||''}`):'',
      hostImport:host?accessLink(host,'/host-apply.html'):'',
      bracketHost:host?accessLink(host,`/dashboard.html?tournamentId=${bracket?.id||''}`):'',
      applicant:byPersona.get('applicant_player')&&registration?accessLink(byPersona.get('applicant_player'),`/join-tournament.html?slug=${encodeURIComponent(registration.slug)}`):'',
      captainA:byPersona.get('captain_1')?accessLink(byPersona.get('captain_1'),'/portal.html'):'',
      captainB:byPersona.get('captain_8')?accessLink(byPersona.get('captain_8'),'/portal.html'):'',
      referee:referee?accessLink(referee,`/dashboard.html?tournamentId=${live?.id||''}`):'',
      broadcaster:broadcaster?accessLink(broadcaster,'/broadcast.html'):'',
      draftHost:room&&roomAccess.host?`/draft-room.html#room=${encodeURIComponent(room.room_code)}&access=${encodeURIComponent(roomAccess.host)}`:'',
      draftTeamA:room&&roomAccess.teamA?`/draft-room.html#room=${encodeURIComponent(room.room_code)}&access=${encodeURIComponent(roomAccess.teamA)}`:'',
      draftTeamB:room&&roomAccess.teamB?`/draft-room.html#room=${encodeURIComponent(room.room_code)}&access=${encodeURIComponent(roomAccess.teamB)}`:'',
      broadcast:room&&roomAccess.broadcaster?`/broadcast.html#room=${encodeURIComponent(room.room_code)}&access=${encodeURIComponent(roomAccess.broadcaster)}`:'',
    };
    return {id:suite.id,name:suite.name,createdAt:suite.created_at,createdBy:suite.created_by_name,tournaments,users:personas,quickLinks};
  });
}

async function seedMock32Players(tournamentId) {
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id=?').get(tournamentId);
  if (!tournament) throw new Error('Tournament not found.');

  const passwordHash = await hashPassword('MockPassword123!');
  const suffix = Date.now().toString(36);
  let seeded = 0;

  transaction(() => {
    for (let i = 1; i <= 31; i++) {
      const isCaptain = i <= 7;
      const username = `solo_bot_${i}_${suffix}`.slice(0, 60);
      const displayName = `Solo Bot ${i} ${isCaptain ? '★' : ''}`.trim();
      const email = `${username}@mock.local`;
      const requestedRole = isCaptain ? 'captain' : 'player';

      const userRes = db.prepare(`INSERT INTO users(username,email,display_name,password_hash,role,is_active,email_verified_at)
        VALUES (?,?,?,?,'player',1,CURRENT_TIMESTAMP)`).run(username, email, displayName, passwordHash);
      const userId = Number(userRes.lastInsertRowid);

      db.prepare(`INSERT INTO tournament_join_requests(
        tournament_id,user_id,requested_role,status,gamer_tag,message,created_at,updated_at
      ) VALUES (?,?,?,'approved',?,'Mock Solo Player',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
        .run(tournamentId, userId, requestedRole, `BOT#${1000 + i}`);
      seeded++;
    }
  });

  return { success: true, count: seeded, message: `Successfully seeded ${seeded} mock players (7 captains + 24 players) into Solo Pool!` };
}

function autoCheckinOtherTeams(tournamentId) {
  const matches = db.prepare(`SELECT * FROM matches WHERE tournament_id=? AND result_status != 'final'`).all(tournamentId);
  let checkinCount = 0;
  transaction(() => {
    matches.forEach(match => {
      [match.team_a_id, match.team_b_id].forEach(teamId => {
        if (!teamId) return;
        db.prepare(`INSERT INTO match_checkins(match_id,actor_type,actor_id,status,checked_in_at)
          VALUES (?,'team',?,'ready',CURRENT_TIMESTAMP)
          ON CONFLICT(match_id,actor_type,actor_id) DO UPDATE SET status='ready',checked_in_at=CURRENT_TIMESTAMP`)
          .run(match.id, String(teamId));
        checkinCount++;
      });
      if (match.team_a_id && match.team_b_id) {
        db.prepare(`UPDATE matches SET status='ready',match_status='ready',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(match.id);
      }
    });
  });
  return { success: true, count: checkinCount, message: `Auto checked-in all mock teams for all active matches!` };
}

function cleanupMockData(tournamentId) {
  let cleanedCount = 0;
  transaction(() => {
    const mockJoinRequests = db.prepare(`SELECT jr.id, jr.user_id FROM tournament_join_requests jr
      JOIN users u ON u.id=jr.user_id
      WHERE jr.tournament_id=? AND (u.username LIKE 'solo_bot_%' OR u.username LIKE '%_bot_%' OR u.username LIKE 'mock_%')`).all(tournamentId);
    
    mockJoinRequests.forEach(req => {
      db.prepare('DELETE FROM tournament_join_requests WHERE id=?').run(req.id);
      db.prepare('DELETE FROM team_members WHERE user_id=?').run(req.user_id);
      db.prepare('DELETE FROM users WHERE id=?').run(req.user_id);
      cleanedCount++;
    });

    db.prepare(`DELETE FROM teams WHERE tournament_id=? AND formation_source='solo_randomizer'`).run(tournamentId);
    db.prepare(`DELETE FROM matches WHERE tournament_id=?`).run(tournamentId);
    db.prepare(`UPDATE tournaments SET status='preparing', updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(tournamentId);
  });
  return { success: true, cleanedUsers: cleanedCount, message: 'Cleaned up all mock bot data and reset solo bracket!' };
}

async function create32PlayerTournament(hostUserId) {
  const suffix = Date.now().toString(36);
  const slug = `rendezvu-32p-demo-${suffix}`;
  const name = 'RendezVu 32-Player Demo Championship';
  const rules = {
    structure: 'single',
    playoffBestOf: 3,
    grandFinalBestOf: 3,
    timerSeconds: 30,
    heroBans: 2,
    divineBans: 0,
    draftStyle: 'standard',
    mirrorPickMode: 'none',
    enableCoinFlip: true,
    enableDivineDraw: true,
    divineDrawMode: 'random',
    cinematicLockIn: true,
  };
  const startAt = new Date().toISOString();
  const res = db.prepare(`INSERT INTO tournaments(
      host_user_id,name,slug,description,status,timezone,default_server,start_at,schedule_mode,
      source_platform,source_url,source_external_id,source_metadata_json,source_sync_status,is_public,rules_json
    ) VALUES (?,?,?,?,'preparing','Asia/Ho_Chi_Minh','Asia',?,'fixed_tournament_start','custom','','','{}','ready',1,?)`)
    .run(hostUserId, name, slug, 'Auto-generated 32-player tournament for testing', startAt, JSON.stringify(rules));
  const tournamentId = Number(res.lastInsertRowid);
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id=?').get(tournamentId);
  return { success: true, tournament };
}

module.exports = {
  consumeDevAccessCode,
  createTestSuite,
  listTestSuites,
  cleanupTestSuite,
  seedMock32Players,
  autoCheckinOtherTeams,
  cleanupMockData,
  create32PlayerTournament,
};

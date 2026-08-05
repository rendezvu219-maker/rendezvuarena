const { db, transaction, jsonParse } = require('./db');

const STARTED_MATCH_STATUSES = new Set(['drafting', 'playing', 'completed']);

function nextPowerOfTwo(value) {
  let result = 1;
  while (result < value) result *= 2;
  return result;
}

function seedPositions(size) {
  if (size === 1) return [1];
  let positions = [1, 2];
  while (positions.length < size) {
    const sum = positions.length * 2 + 1;
    positions = positions.flatMap(seed => [seed, sum - seed]);
  }
  return positions;
}

function roundName(roundNo, totalRounds) {
  const remaining = totalRounds - roundNo + 1;
  if (remaining === 1) return 'Grand Final';
  if (remaining === 2) return 'Semi Final';
  if (remaining === 3) return 'Quarter Final';
  return `Round ${roundNo}`;
}

function eligibleTeams(tournamentId) {
  return db.prepare(`
    SELECT t.*, u.is_active captain_active
    FROM teams t
    LEFT JOIN users u ON u.id=t.captain_user_id
    WHERE t.tournament_id=? AND t.team_status='ready'
      AND t.captain_user_id IS NOT NULL AND COALESCE(u.is_active,0)=1
    ORDER BY CASE WHEN t.seed IS NULL THEN 1 ELSE 0 END, t.seed ASC, t.id ASC
  `).all(tournamentId);
}

function allNonTerminalTeams(tournamentId) {
  return db.prepare(`
    SELECT * FROM teams WHERE tournament_id=? AND team_status NOT IN ('withdrawn','disqualified')
    ORDER BY CASE WHEN seed IS NULL THEN 1 ELSE 0 END, seed, id
  `).all(tournamentId);
}

function validateFinalScore(match, scoreA, scoreB) {
  scoreA = Number(scoreA); scoreB = Number(scoreB);
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0 || scoreA === scoreB) {
    throw new Error('Scores must be non-negative whole numbers and cannot be tied.');
  }
  const winsNeeded = Math.floor(Number(match.best_of) / 2) + 1;
  const winnerScore = Math.max(scoreA, scoreB);
  const loserScore = Math.min(scoreA, scoreB);
  if (winnerScore !== winsNeeded || loserScore >= winsNeeded) {
    throw new Error(`A BO${match.best_of} result must end when one team reaches exactly ${winsNeeded} wins.`);
  }
  return { scoreA, scoreB, winnerTeamId: scoreA > scoreB ? match.team_a_id : match.team_b_id };
}

function deleteDraftRoomsForMatches(whereSql, params) {
  db.prepare(`DELETE FROM draft_rooms WHERE match_id IN (SELECT id FROM matches WHERE ${whereSql})`).run(...params);
}

function captureBracketSnapshot(tournamentId, userId = null, label = 'Before bracket regeneration') {
  const matches = db.prepare('SELECT * FROM matches WHERE tournament_id=? ORDER BY id').all(tournamentId);
  if (!matches.length) return null;
  const games = db.prepare(`SELECT mg.* FROM match_games mg JOIN matches m ON m.id=mg.match_id WHERE m.tournament_id=? ORDER BY mg.id`).all(tournamentId);
  const snapshot = { version: 1, matches, games };
  const result = db.prepare('INSERT INTO bracket_snapshots(tournament_id,user_id,label,snapshot_json) VALUES (?,?,?,?)')
    .run(tournamentId, userId, label, JSON.stringify(snapshot));
  return Number(result.lastInsertRowid);
}

function listBracketSnapshots(tournamentId) {
  return db.prepare(`SELECT id,label,created_at,user_id FROM bracket_snapshots WHERE tournament_id=? ORDER BY id DESC LIMIT 20`).all(tournamentId);
}

function restoreBracketSnapshot(tournamentId, snapshotId, userId = null) {
  return transaction(() => {
    const row = db.prepare('SELECT * FROM bracket_snapshots WHERE id=? AND tournament_id=?').get(snapshotId, tournamentId);
    if (!row) throw new Error('Bracket snapshot not found.');
    const snapshot = jsonParse(row.snapshot_json, {});
    const matches = Array.isArray(snapshot.matches) ? snapshot.matches : [];
    if (!matches.length) throw new Error('This snapshot has no matches.');

    const started = db.prepare(`SELECT COUNT(*) count FROM matches WHERE tournament_id=? AND match_status IN ('drafting','playing','completed')`).get(tournamentId).count;
    if (started) throw new Error('Cannot restore a bracket after a current match has started or completed.');

    deleteDraftRoomsForMatches('tournament_id=?', [tournamentId]);
    db.prepare('DELETE FROM matches WHERE tournament_id=?').run(tournamentId);

    const relationshipColumns = new Set(['next_match_id','feeds_into_winner_match_id','feeds_into_loser_match_id','reset_of_match_id']);
    const columns = Object.keys(matches[0]).filter(column => !relationshipColumns.has(column));
    const placeholders = columns.map(() => '?').join(',');
    const insert = db.prepare(`INSERT INTO matches(${columns.join(',')}) VALUES (${placeholders})`);
    matches.forEach(match => insert.run(...columns.map(column => match[column])));
    const update = db.prepare(`UPDATE matches SET next_match_id=?,feeds_into_winner_match_id=?,feeds_into_loser_match_id=?,reset_of_match_id=? WHERE id=?`);
    matches.forEach(match => update.run(match.next_match_id, match.feeds_into_winner_match_id, match.feeds_into_loser_match_id, match.reset_of_match_id, match.id));

    const games = Array.isArray(snapshot.games) ? snapshot.games : [];
    if (games.length) {
      const gameColumns = Object.keys(games[0]);
      const gameInsert = db.prepare(`INSERT INTO match_games(${gameColumns.join(',')}) VALUES (${gameColumns.map(() => '?').join(',')})`);
      games.forEach(game => gameInsert.run(...gameColumns.map(column => game[column])));
    }
    db.prepare('INSERT INTO audit_logs(tournament_id,user_id,action,details_json) VALUES (?,?,?,?)')
      .run(tournamentId, userId, 'bracket.snapshot_restored', JSON.stringify({ snapshotId }));
    return listMatches(tournamentId);
  });
}

function analyzeSeedConstraints(tournamentId, teams = allNonTerminalTeams(tournamentId)) {
  const blockers = [];
  const warnings = [];
  const lockedSeeds = new Map();
  for (const team of teams) {
    if (!team.seed_locked) continue;
    if (!Number.isInteger(Number(team.seed)) || Number(team.seed) < 1) blockers.push(`Locked team ${team.name} needs a valid seed.`);
    else if (lockedSeeds.has(Number(team.seed))) blockers.push(`Locked seed #${team.seed} is used by both ${lockedSeeds.get(Number(team.seed))} and ${team.name}.`);
    else lockedSeeds.set(Number(team.seed), team.name);
  }

  const seeded = teams.filter(team => Number.isInteger(Number(team.seed))).sort((a,b) => a.seed-b.seed);
  if (seeded.length >= 2) {
    const size = nextPowerOfTwo(seeded.length);
    const positions = seedPositions(size);
    const bySeed = new Map(seeded.map(team => [Number(team.seed), team]));
    for (let i=0;i<positions.length;i+=2) {
      const a = bySeed.get(positions[i]); const b = bySeed.get(positions[i+1]);
      if (!a || !b) continue;
      if (a.region && b.region && a.region.toLowerCase() === b.region.toLowerCase()) {
        warnings.push(`First-round regional conflict: ${a.name} and ${b.name} are both ${a.region}.`);
      }
      if (a.protected_seed_group && a.protected_seed_group === b.protected_seed_group) {
        warnings.push(`Protected group conflict: ${a.name} and ${b.name} are both in ${a.protected_seed_group}.`);
      }
    }
  }
  return { blockers, warnings };
}

function preflightTournament(tournamentId) {
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id=?').get(tournamentId);
  if (!tournament) throw new Error('Tournament not found.');
  const teams = db.prepare(`SELECT t.*,u.is_active captain_active,(SELECT COUNT(*) FROM team_members tm WHERE tm.team_id=t.id AND tm.membership_status='active') member_count FROM teams t LEFT JOIN users u ON u.id=t.captain_user_id WHERE t.tournament_id=?`).all(tournamentId);
  const blockers = [];
  const warnings = [];
  const active = teams.filter(team => !['withdrawn','disqualified'].includes(team.team_status));

  if (active.length < 2) blockers.push('At least two active teams are required.');
  for (const team of active) {
    if (!team.captain_user_id || !team.captain_active) blockers.push(`${team.name}: Captain account is not linked or active.`);
    if (team.team_status !== 'ready') blockers.push(`${team.name}: Team status must be Ready.`);
    if (!team.member_count) warnings.push(`${team.name}: Roster has no members.`);
  }
  const seedValues = active.map(team => Number(team.seed));
  if (seedValues.some(seed => !Number.isInteger(seed) || seed < 1)) blockers.push('Every active team needs a positive seed number.');
  if (new Set(seedValues).size !== seedValues.length) blockers.push('Seed numbers cannot be duplicated.');
  const duplicateNames = db.prepare(`SELECT lower(name) key,COUNT(*) count FROM teams WHERE tournament_id=? AND team_status NOT IN ('withdrawn','disqualified') GROUP BY lower(name) HAVING COUNT(*)>1`).all(tournamentId);
  duplicateNames.forEach(() => warnings.push('Duplicate team names were detected.'));
  const duplicateTags = db.prepare(`SELECT lower(tag) key,COUNT(*) count FROM teams WHERE tournament_id=? AND tag!='' AND team_status NOT IN ('withdrawn','disqualified') GROUP BY lower(tag) HAVING COUNT(*)>1`).all(tournamentId);
  duplicateTags.forEach(() => warnings.push('Duplicate team tags were detected.'));
  if (!tournament.start_at) warnings.push('Tournament start time is not set.');
  const constraints = analyzeSeedConstraints(tournamentId, active);
  blockers.push(...constraints.blockers); warnings.push(...constraints.warnings);
  return { ok: blockers.length === 0, blockers, warnings, counts: { activeTeams: active.length, readyTeams: active.filter(team => team.team_status==='ready').length } };
}

function createKnockout(tournamentId, teams, { bestOf = 3, preserveGroups = false, userId = null } = {}) {
  return transaction(() => {
    if (teams.length < 2) throw new Error('At least two qualified teams are required.');
    captureBracketSnapshot(tournamentId, userId, preserveGroups ? 'Before playoff regeneration' : 'Before bracket regeneration');

    if (preserveGroups) {
      deleteDraftRoomsForMatches("tournament_id=? AND stage='playoff'", [tournamentId]);
      db.prepare("DELETE FROM matches WHERE tournament_id=? AND stage='playoff'").run(tournamentId);
    } else {
      deleteDraftRoomsForMatches('tournament_id=?', [tournamentId]);
      db.prepare('DELETE FROM matches WHERE tournament_id=?').run(tournamentId);
    }

    const seededTeams = teams.map((team, index) => ({ ...team, bracket_seed: index + 1 }));
    const size = nextPowerOfTwo(seededTeams.length);
    const totalRounds = Math.log2(size);
    const roundIds = new Map();

    for (let round=totalRounds; round>=1; round--) {
      const count = size / (2 ** round);
      for (let position=1; position<=count; position++) {
        const result = db.prepare(`
          INSERT INTO matches(tournament_id,bracket_type,bracket_side,stage,round_no,round_name,position,best_of,status,match_status,result_status,timezone,server_region)
          SELECT ?,'single','winners','playoff',?,?,?,?, 'available','available','none',timezone,default_server FROM tournaments WHERE id=?
        `).run(tournamentId, round, roundName(round,totalRounds), position, bestOf, tournamentId);
        roundIds.set(`${round}:${position}`, Number(result.lastInsertRowid));
      }
    }

    for (let round=1; round<totalRounds; round++) {
      const count = size/(2**round);
      for (let position=1; position<=count; position++) {
        const currentId = roundIds.get(`${round}:${position}`);
        const nextPosition = Math.ceil(position/2);
        const nextId = roundIds.get(`${round+1}:${nextPosition}`);
        const nextSlot = position%2===1?'A':'B';
        db.prepare(`UPDATE matches SET next_match_id=?,next_slot=?,feeds_into_winner_match_id=?,feeds_into_winner_slot=? WHERE id=?`)
          .run(nextId,nextSlot,nextId,nextSlot,currentId);
      }
    }

    const positions = seedPositions(size);
    const teamBySeed = new Map(seededTeams.map(team => [team.bracket_seed,team]));
    for (let matchPosition=1; matchPosition<=size/2; matchPosition++) {
      const teamA = teamBySeed.get(positions[(matchPosition-1)*2]) || null;
      const teamB = teamBySeed.get(positions[(matchPosition-1)*2+1]) || null;
      const matchId = roundIds.get(`1:${matchPosition}`);
      const matchStatus = teamA && teamB ? 'available' : 'completed';
      db.prepare('UPDATE matches SET team_a_id=?,team_b_id=?,status=?,match_status=? WHERE id=?')
        .run(teamA?.id||null,teamB?.id||null,teamA&&teamB?'available':'bye',matchStatus,matchId);
    }

    autoAdvanceByes(tournamentId);
    return listMatches(tournamentId);
  });
}

function generateSingleElimination(tournamentId, { randomize=false, bestOf=3, userId=null, allowWarnings=false }={}) {
  const preflight = preflightTournament(tournamentId);
  if (!preflight.ok) throw new Error(`Preflight failed: ${preflight.blockers.join(' | ')}`);
  if (preflight.warnings.length && !allowWarnings) {
    const error = new Error(`Constraint warnings require confirmation: ${preflight.warnings.join(' | ')}`);
    error.code = 'CONSTRAINT_WARNINGS'; error.warnings = preflight.warnings; throw error;
  }
  let teams = eligibleTeams(tournamentId);
  if (randomize) teams = randomizeUnlockedTeams(tournamentId, userId);
  return createKnockout(tournamentId, teams, { bestOf, preserveGroups:false, userId });
}

function saveSeedingSnapshot(tournamentId, userId=null, reason='') {
  const teams = db.prepare(`SELECT id,seed,seed_locked,protected_seed_group,region,seeding_note FROM teams WHERE tournament_id=? ORDER BY id`).all(tournamentId);
  const result = db.prepare('INSERT INTO seeding_history(tournament_id,user_id,snapshot_json,reason) VALUES (?,?,?,?)')
    .run(tournamentId,userId,JSON.stringify(teams),reason);
  return Number(result.lastInsertRowid);
}

function randomizeUnlockedTeams(tournamentId, userId=null) {
  return transaction(() => {
    saveSeedingSnapshot(tournamentId,userId,'Before randomize unlocked seeds');
    const teams = allNonTerminalTeams(tournamentId);
    const total = teams.length;
    const occupied = new Set(teams.filter(t=>t.seed_locked && Number.isInteger(Number(t.seed))).map(t=>Number(t.seed)));
    const availableSeeds = Array.from({length:total},(_,i)=>i+1).filter(seed=>!occupied.has(seed));
    const unlocked = teams.filter(t=>!t.seed_locked).map(value=>({value,sort:Math.random()})).sort((a,b)=>a.sort-b.sort).map(item=>item.value);
    unlocked.forEach((team,index)=>db.prepare('UPDATE teams SET seed=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(availableSeeds[index],team.id));
    return eligibleTeams(tournamentId);
  });
}

function restoreLatestSeeding(tournamentId,userId=null) {
  return transaction(() => {
    const row = db.prepare('SELECT * FROM seeding_history WHERE tournament_id=? ORDER BY id DESC LIMIT 1').get(tournamentId);
    if (!row) throw new Error('No seeding history is available.');
    const snapshot = jsonParse(row.snapshot_json,[]);
    const update = db.prepare('UPDATE teams SET seed=?,seed_locked=?,protected_seed_group=?,region=?,seeding_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND tournament_id=?');
    snapshot.forEach(team=>update.run(team.seed,team.seed_locked,team.protected_seed_group,team.region,team.seeding_note,team.id,tournamentId));
    db.prepare('INSERT INTO audit_logs(tournament_id,user_id,action,details_json) VALUES (?,?,?,?)').run(tournamentId,userId,'seeding.restored',JSON.stringify({historyId:row.id}));
    return db.prepare('SELECT * FROM teams WHERE tournament_id=? ORDER BY seed,name').all(tournamentId);
  });
}

function snakeGroups(teams,groupCount) {
  const groups=Array.from({length:groupCount},()=>[]);
  teams.forEach((team,index)=>{const row=Math.floor(index/groupCount);const column=index%groupCount;const groupIndex=row%2===0?column:groupCount-1-column;groups[groupIndex].push(team);});
  return groups;
}

function generateGroupStage(tournamentId,{groupCount=2,bestOf=1,topPerGroup=2,userId=null,allowWarnings=false,doubleRoundRobin=false}={}) {
  const preflight=preflightTournament(tournamentId);
  if(!preflight.ok) throw new Error(`Preflight failed: ${preflight.blockers.join(' | ')}`);
  if(preflight.warnings.length&&!allowWarnings){const error=new Error(`Constraint warnings require confirmation: ${preflight.warnings.join(' | ')}`);error.code='CONSTRAINT_WARNINGS';error.warnings=preflight.warnings;throw error;}
  return transaction(()=>{
    const teams=eligibleTeams(tournamentId);
    groupCount=Number(groupCount);topPerGroup=Number(topPerGroup);bestOf=Number(bestOf);
    if(![1,3,5,7].includes(bestOf)) throw new Error('Group-stage format must be BO1, BO3, BO5 or BO7.');
    if(!Number.isInteger(groupCount)||groupCount<1||groupCount>8) throw new Error('Group count must be between 1 and 8.');
    if(teams.length<groupCount*2) throw new Error('Each group needs at least two teams.');
    if(!Number.isInteger(topPerGroup)||topPerGroup<1) throw new Error('Top qualifiers per group must be a positive whole number.');
    captureBracketSnapshot(tournamentId,userId,'Before group-stage regeneration');
    deleteDraftRoomsForMatches('tournament_id=?',[tournamentId]);
    db.prepare('DELETE FROM matches WHERE tournament_id=?').run(tournamentId);
    const groups=snakeGroups(teams,groupCount);let position=1;
    groups.forEach((groupTeams,groupIndex)=>{
      const groupName=String.fromCharCode(65+groupIndex);
      if(topPerGroup>=groupTeams.length) throw new Error(`Group ${groupName} must eliminate at least one team.`);
      const legs=doubleRoundRobin?2:1;
      for(let leg=1;leg<=legs;leg++) for(let a=0;a<groupTeams.length;a++) for(let b=a+1;b<groupTeams.length;b++) {
        const first=leg===1?groupTeams[a]:groupTeams[b];const second=leg===1?groupTeams[b]:groupTeams[a];
        db.prepare(`INSERT INTO matches(tournament_id,bracket_type,bracket_side,stage,group_name,round_no,round_name,position,team_a_id,team_b_id,best_of,status,match_status,result_status,timezone,server_region)
          SELECT ?,'group','group','group',?,0,?,?,?,?,?,'available','available','none',timezone,default_server FROM tournaments WHERE id=?`)
          .run(tournamentId,groupName,`Group ${groupName}${doubleRoundRobin?` · Leg ${leg}`:''}`,position++,first.id,second.id,bestOf,tournamentId);
      }
    });
    const tournament=db.prepare('SELECT rules_json FROM tournaments WHERE id=?').get(tournamentId);const rules=jsonParse(tournament?.rules_json);
    Object.assign(rules,{structure:'groups-playoffs',groupCount,topPerGroup,groupBestOf:bestOf,doubleRoundRobin:Boolean(doubleRoundRobin)});
    db.prepare('UPDATE tournaments SET rules_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(JSON.stringify(rules),tournamentId);
    return listMatches(tournamentId);
  });
}

function headToHeadResult(matches,teamA,teamB) {
  const match=matches.find(item=>item.result_status==='final'&&((item.team_a_id===teamA&&item.team_b_id===teamB)||(item.team_a_id===teamB&&item.team_b_id===teamA)));
  if(!match) return 0;
  return match.winner_team_id===teamA?-1:1;
}

function calculateGroupStandings(tournamentId) {
  const tournament=db.prepare('SELECT rules_json FROM tournaments WHERE id=?').get(tournamentId);const rules=jsonParse(tournament?.rules_json);
  const tieOrder=Array.isArray(rules.tieBreakOrder)?rules.tieBreakOrder:['wins','gameDiff','headToHead','gameWins','seed'];
  const matches=db.prepare(`SELECT m.*,a.name team_a_name,a.tag team_a_tag,a.seed team_a_seed,b.name team_b_name,b.tag team_b_tag,b.seed team_b_seed FROM matches m LEFT JOIN teams a ON a.id=m.team_a_id LEFT JOIN teams b ON b.id=m.team_b_id WHERE m.tournament_id=? AND m.stage='group' ORDER BY m.group_name,m.position`).all(tournamentId);
  const groups=new Map();
  for(const match of matches){const key=match.group_name||'?';if(!groups.has(key))groups.set(key,{group:key,rows:new Map(),matches:[],totalMatches:0,completedMatches:0});const group=groups.get(key);group.matches.push(match);group.totalMatches++;
    for(const side of ['a','b']){const id=match[`team_${side}_id`];if(!id||group.rows.has(id))continue;group.rows.set(id,{teamId:id,name:match[`team_${side}_name`],tag:match[`team_${side}_tag`],seed:match[`team_${side}_seed`]??9999,played:0,wins:0,losses:0,gameWins:0,gameLosses:0,gameDiff:0});}
    if(match.result_status!=='final'||!match.winner_team_id)continue;group.completedMatches++;const a=group.rows.get(match.team_a_id);const b=group.rows.get(match.team_b_id);a.played++;b.played++;a.gameWins+=Number(match.score_a||0);a.gameLosses+=Number(match.score_b||0);b.gameWins+=Number(match.score_b||0);b.gameLosses+=Number(match.score_a||0);if(match.winner_team_id===match.team_a_id){a.wins++;b.losses++;}else{b.wins++;a.losses++;}}
  return [...groups.values()].sort((a,b)=>a.group.localeCompare(b.group)).map(group=>{
    const comparator=(a,b)=>{for(const key of tieOrder){let diff=0;if(key==='wins')diff=b.wins-a.wins;else if(key==='gameDiff')diff=(b.gameWins-b.gameLosses)-(a.gameWins-a.gameLosses);else if(key==='headToHead'&&a.wins===b.wins&&a.gameDiff===b.gameDiff)diff=headToHeadResult(group.matches,a.teamId,b.teamId);else if(key==='gameWins')diff=b.gameWins-a.gameWins;else if(key==='seed')diff=a.seed-b.seed;if(diff)return diff;}return a.name.localeCompare(b.name);};
    let standings=[...group.rows.values()].map(row=>({...row,gameDiff:row.gameWins-row.gameLosses})).sort(comparator).map((row,index)=>({...row,automaticRank:index+1,rank:index+1,overrideActive:false}));
    const overrides=db.prepare(`SELECT * FROM standings_overrides WHERE tournament_id=? AND group_name=? AND active=1 ORDER BY override_rank`).all(tournamentId,group.group);
    if(overrides.length){const byTeam=new Map(overrides.map(item=>[item.team_id,item]));standings=standings.map(row=>{const override=byTeam.get(row.teamId);return override?{...row,rank:override.override_rank,overrideActive:true,overrideReason:override.reason}:row;}).sort((a,b)=>a.rank-b.rank||a.automaticRank-b.automaticRank).map((row,index)=>({...row,rank:index+1}));}
    return{group:group.group,standings,totalMatches:group.totalMatches,completedMatches:group.completedMatches,complete:group.totalMatches>0&&group.completedMatches===group.totalMatches,tieBreakOrder:tieOrder};
  });
}

function generatePlayoffsFromGroups(tournamentId,{topPerGroup=2,bestOf=3,force=false,userId=null}={}) {
  const groups=calculateGroupStandings(tournamentId);if(!groups.length)throw new Error('Generate a group stage first.');if(!force&&groups.some(group=>!group.complete))throw new Error('All group matches must be final before generating playoffs.');
  const qualifiers=[];groups.forEach(group=>group.standings.slice(0,topPerGroup).forEach(row=>qualifiers.push({...db.prepare('SELECT * FROM teams WHERE id=?').get(row.teamId),source_group:group.group,group_rank:row.rank})));
  if(qualifiers.length<2)throw new Error('Not enough qualified teams.');
  // Pair winners with runners-up from other groups when possible.
  let ordered=[];
  if(topPerGroup===2&&groups.length>=2){const first=groups.map(group=>qualifiers.find(team=>team.source_group===group.group&&team.group_rank===1));const second=[...groups].reverse().map(group=>qualifiers.find(team=>team.source_group===group.group&&team.group_rank===2));for(let i=0;i<first.length;i++){if(first[i])ordered.push(first[i]);if(second[i])ordered.push(second[i]);}}
  else ordered=qualifiers.sort((a,b)=>a.group_rank-b.group_rank||a.seed-b.seed);
  return createKnockout(tournamentId,ordered,{bestOf,preserveGroups:true,userId});
}

function advanceWinner(match,winnerTeamId) {
  const nextId=match.feeds_into_winner_match_id||match.next_match_id;const slot=match.feeds_into_winner_slot||match.next_slot;if(!nextId||!slot)return;
  const column=slot==='A'?'team_a_id':'team_b_id';db.prepare(`UPDATE matches SET ${column}=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(winnerTeamId,nextId);
  db.prepare(`UPDATE matches SET status=CASE WHEN team_a_id IS NOT NULL AND team_b_id IS NOT NULL THEN 'available' ELSE status END,match_status=CASE WHEN team_a_id IS NOT NULL AND team_b_id IS NOT NULL THEN 'available' ELSE match_status END WHERE id=?`).run(nextId);
}

function advanceLoser(match,loserTeamId) {
  if(!match.feeds_into_loser_match_id||!match.feeds_into_loser_slot)return;const column=match.feeds_into_loser_slot==='A'?'team_a_id':'team_b_id';db.prepare(`UPDATE matches SET ${column}=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(loserTeamId,match.feeds_into_loser_match_id);
}

function applyFinalResultUnsafe(match,{scoreA,scoreB,winnerTeamId,resolutionType='normal',resolutionReason='',submissionId=null,userId=null}) {
  const loserTeamId=winnerTeamId===match.team_a_id?match.team_b_id:match.team_a_id;
  db.prepare(`UPDATE matches SET score_a=?,score_b=?,winner_team_id=?,status='completed',match_status='completed',result_status='final',resolution_type=?,resolution_reason=?,result_finalized_at=CURRENT_TIMESTAMP,final_submission_id=?,room_code_status='archived',room_code_archived_at=CURRENT_TIMESTAMP,room_code_expires_at=datetime('now','+72 hours'),updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(scoreA,scoreB,winnerTeamId,resolutionType,resolutionReason,submissionId,match.id);
  if(match.stage==='playoff'){advanceWinner(match,winnerTeamId);advanceLoser(match,loserTeamId);}
  db.prepare('INSERT INTO audit_logs(tournament_id,match_id,user_id,action,details_json) VALUES (?,?,?,?,?)').run(match.tournament_id,match.id,userId,'match.result_finalized',JSON.stringify({scoreA,scoreB,winnerTeamId,resolutionType,resolutionReason,submissionId}));
  autoAdvanceByes(match.tournament_id);
  return db.prepare('SELECT * FROM matches WHERE id=?').get(match.id);
}

function applyFinalResult(matchId,payload) {
  return transaction(()=>{const match=db.prepare('SELECT * FROM matches WHERE id=?').get(matchId);if(!match)throw new Error('Match not found.');if(!match.team_a_id||!match.team_b_id)throw new Error('Both teams must be assigned.');const validated=payload.resolutionType==='normal'?validateFinalScore(match,payload.scoreA,payload.scoreB):{scoreA:Number(payload.scoreA),scoreB:Number(payload.scoreB),winnerTeamId:Number(payload.winnerTeamId)};return applyFinalResultUnsafe(match,{...payload,...validated});});
}

function dependentMatches(match) {
  const ids=[match.feeds_into_winner_match_id||match.next_match_id,match.feeds_into_loser_match_id].filter(Boolean);
  return ids.map(id=>db.prepare('SELECT * FROM matches WHERE id=?').get(id)).filter(Boolean);
}

function canReopenMatch(match) {
  const dependencies=dependentMatches(match);const blocking=dependencies.filter(child=>STARTED_MATCH_STATUSES.has(child.match_status));return{allowed:blocking.length===0,blocking};
}

function rollbackFinalResultUnsafe(match,userId=null) {
  const check=canReopenMatch(match);if(!check.allowed)throw new Error(`Cannot reopen: dependent match #${check.blocking[0].position} has already ${check.blocking[0].match_status}.`);
  const winnerId=match.winner_team_id;for(const child of dependentMatches(match)){let changed=false;if(child.team_a_id===winnerId){db.prepare('UPDATE matches SET team_a_id=NULL WHERE id=?').run(child.id);changed=true;}if(child.team_b_id===winnerId){db.prepare('UPDATE matches SET team_b_id=NULL WHERE id=?').run(child.id);changed=true;}if(changed){db.prepare(`UPDATE matches SET match_status='waiting_for_stage',status='waiting',score_a=NULL,score_b=NULL,winner_team_id=NULL,result_status='none',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(child.id);db.prepare('DELETE FROM draft_rooms WHERE match_id=?').run(child.id);}}
  db.prepare(`UPDATE matches SET score_a=NULL,score_b=NULL,winner_team_id=NULL,result_status='reopened',resolution_type='normal',resolution_reason='',result_finalized_at=NULL,final_submission_id=NULL,reopened_at=CURRENT_TIMESTAMP,reopened_by=?,room_code_status='active',room_code_archived_at=NULL,room_code_expires_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(userId,match.id);
  db.prepare('INSERT INTO audit_logs(tournament_id,match_id,user_id,action,details_json) VALUES (?,?,?,?,?)').run(match.tournament_id,match.id,userId,'match.result_reopened',JSON.stringify({previousWinner:winnerId}));
}

function autoAdvanceByes(tournamentId) {
  let changed=true;while(changed){changed=false;const matches=db.prepare(`SELECT * FROM matches WHERE tournament_id=? AND stage='playoff' AND winner_team_id IS NULL ORDER BY round_no,position`).all(tournamentId);for(const match of matches){const only=match.team_a_id||match.team_b_id;if(!only||(match.team_a_id&&match.team_b_id))continue;const feeders=db.prepare(`SELECT result_status FROM matches WHERE tournament_id=? AND (feeds_into_winner_match_id=? OR next_match_id=?)`).all(tournamentId,match.id,match.id);if(feeders.length&&feeders.some(feeder=>feeder.result_status!=='final'))continue;applyFinalResultUnsafe(match,{scoreA:match.team_a_id?1:0,scoreB:match.team_b_id?1:0,winnerTeamId:only,resolutionType:'bye',resolutionReason:'Automatic bye'});changed=true;}}
}

function processTeamTerminalState(teamId,teamStatus,reason,userId=null) {
  if(!['withdrawn','disqualified'].includes(teamStatus))throw new Error('Invalid terminal team status.');
  return transaction(()=>{
    const team=db.prepare('SELECT * FROM teams WHERE id=?').get(teamId);if(!team)throw new Error('Team not found.');
    db.prepare(`UPDATE teams SET team_status=?,status=?,terminal_reason=?,withdrawn_at=CASE WHEN ?='withdrawn' THEN CURRENT_TIMESTAMP ELSE withdrawn_at END,disqualified_at=CASE WHEN ?='disqualified' THEN CURRENT_TIMESTAMP ELSE disqualified_at END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(teamStatus,teamStatus,reason,teamStatus,teamStatus,teamId);
    const matches=db.prepare(`SELECT * FROM matches WHERE tournament_id=? AND result_status!='final' AND (team_a_id=? OR team_b_id=?)`).all(team.tournament_id,teamId,teamId);
    for(const match of matches){const opponent=match.team_a_id===teamId?match.team_b_id:match.team_a_id;if(!opponent)continue;const winnerIsA=match.team_a_id===opponent;const winsNeeded=Math.floor(match.best_of/2)+1;applyFinalResultUnsafe(match,{scoreA:winnerIsA?winsNeeded:0,scoreB:winnerIsA?0:winsNeeded,winnerTeamId:opponent,resolutionType:teamStatus==='disqualified'?'disqualification':'walkover',resolutionReason:`Opponent ${teamStatus}: ${reason}`,userId});}
    db.prepare('INSERT INTO audit_logs(tournament_id,user_id,action,details_json) VALUES (?,?,?,?)').run(team.tournament_id,userId,`team.${teamStatus}`,JSON.stringify({teamId,reason}));
    return db.prepare('SELECT * FROM teams WHERE id=?').get(teamId);
  });
}

function listMatches(tournamentId) {
  return db.prepare(`
    SELECT m.*,a.name team_a_name,a.tag team_a_tag,a.logo_url team_a_logo,b.name team_b_name,b.tag team_b_tag,b.logo_url team_b_logo,w.name winner_name,
      COALESCE(m.scheduled_at,ss.scheduled_at,t.start_at) effective_scheduled_at,
      (SELECT COUNT(*) FROM match_messages mm WHERE mm.match_id=m.id AND mm.deleted_at IS NULL) message_count,
      EXISTS(SELECT 1 FROM draft_rooms dr WHERE dr.match_id=m.id) draft_room_ready
    FROM matches m
    JOIN tournaments t ON t.id=m.tournament_id
    LEFT JOIN stage_schedules ss ON ss.tournament_id=m.tournament_id AND ss.stage_key=m.stage
    LEFT JOIN teams a ON a.id=m.team_a_id LEFT JOIN teams b ON b.id=m.team_b_id LEFT JOIN teams w ON w.id=m.winner_team_id
    WHERE m.tournament_id=?
    ORDER BY CASE WHEN m.stage='group' THEN 0 ELSE 1 END,m.group_name,m.round_no,m.position
  `).all(tournamentId);
}

module.exports={
  generateSingleElimination,generateGroupStage,generatePlayoffsFromGroups,calculateGroupStandings,
  applyFinalResult,applyFinalResultUnsafe,rollbackFinalResultUnsafe,canReopenMatch,validateFinalScore,
  listMatches,nextPowerOfTwo,seedPositions,preflightTournament,analyzeSeedConstraints,
  randomizeUnlockedTeams,saveSeedingSnapshot,restoreLatestSeeding,
  captureBracketSnapshot,listBracketSnapshots,restoreBracketSnapshot,
  processTeamTerminalState,eligibleTeams,advanceWinner,
};

const { db } = require('./db');

function achievementForTeam(tournamentId, teamId, tournamentStatus) {
  const final = db.prepare(`SELECT * FROM matches WHERE tournament_id=? AND stage!='group' AND result_status='final'
    ORDER BY round_no DESC,is_reset_match DESC,position DESC LIMIT 1`).get(tournamentId);
  if (!final) {
    if (['completed','finalized','archived'].includes(String(tournamentStatus))) return {label:'Participant',rank:null,tone:'neutral'};
    const checkedIn = db.prepare(`SELECT 1 FROM match_checkins mc JOIN matches m ON m.id=mc.match_id
      WHERE m.tournament_id=? AND mc.actor_type='team' AND mc.actor_id=? LIMIT 1`).get(tournamentId,String(teamId));
    return checkedIn ? {label:'Checked in',rank:null,tone:'info'} : {label:'Registered',rank:null,tone:'neutral'};
  }
  if (Number(final.winner_team_id) === Number(teamId)) return {label:'Champion',rank:1,tone:'gold'};
  if ([Number(final.team_a_id),Number(final.team_b_id)].includes(Number(teamId))) return {label:'Runner-up',rank:2,tone:'silver'};
  const loss = db.prepare(`SELECT * FROM matches WHERE tournament_id=? AND result_status='final'
    AND (team_a_id=? OR team_b_id=?) AND winner_team_id!=? ORDER BY round_no DESC LIMIT 1`).get(tournamentId,teamId,teamId,teamId);
  if (!loss) return {label:'Participant',rank:null,tone:'neutral'};
  const maxRound = Number(final.round_no||1);
  const distance = maxRound - Number(loss.round_no||0);
  if (distance === 1) return {label:'Top 4',rank:4,tone:'bronze'};
  if (distance === 2) return {label:'Top 8',rank:8,tone:'neutral'};
  return {label:loss.round_name || 'Participant',rank:null,tone:'neutral'};
}

function userTournamentHistory(userId) {
  const participationRows = db.prepare(`
    SELECT DISTINCT tr.id tournament_id,tr.name tournament_name,tr.slug tournament_slug,tr.status tournament_status,
      tr.start_at,tr.finalized_at,tr.created_at,tr.updated_at,t.id team_id,t.name team_name,t.tag team_tag,
      MAX(tm.is_captain) is_captain
    FROM team_members tm
    JOIN teams t ON t.id=tm.team_id
    JOIN tournaments tr ON tr.id=t.tournament_id
    WHERE tm.user_id=? AND tm.membership_status='active'
    GROUP BY tr.id,t.id
    ORDER BY COALESCE(tr.start_at,tr.created_at) DESC
  `).all(userId);
  const participated = participationRows.map(row=>({
    tournamentId:row.tournament_id,tournamentName:row.tournament_name,tournamentSlug:row.tournament_slug,
    status:row.tournament_status,startAt:row.start_at,finalizedAt:row.finalized_at,teamId:row.team_id,
    teamName:row.team_name,teamTag:row.team_tag,isCaptain:Boolean(row.is_captain),
    achievement:achievementForTeam(row.tournament_id,row.team_id,row.tournament_status),
  }));
  const organized = db.prepare(`SELECT id tournament_id,name tournament_name,slug tournament_slug,status,start_at,finalized_at,created_at,
    (SELECT COUNT(*) FROM teams WHERE tournament_id=tournaments.id AND team_status NOT IN ('withdrawn','disqualified')) team_count,
    (SELECT COUNT(*) FROM matches WHERE tournament_id=tournaments.id) match_count
    FROM tournaments WHERE host_user_id=? AND source_platform!='quick_draft' ORDER BY COALESCE(start_at,created_at) DESC`).all(userId).map(row=>({
      tournamentId:row.tournament_id,tournamentName:row.tournament_name,tournamentSlug:row.tournament_slug,
      status:row.status,startAt:row.start_at,finalizedAt:row.finalized_at,createdAt:row.created_at,
      teamCount:Number(row.team_count||0),matchCount:Number(row.match_count||0),
    }));
  const championships=participated.filter(item=>item.achievement.rank===1).length;
  const podiums=participated.filter(item=>[1,2,3,4].includes(item.achievement.rank)).length;
  return {
    stats:{
      participatedCount:participated.length,
      captainCount:participated.filter(item=>item.isCaptain).length,
      championships,
      podiums,
      organizedCount:organized.length,
      organizedCompleted:organized.filter(item=>['completed','finalized','archived'].includes(item.status)).length,
    },
    participated,
    organized,
  };
}

module.exports = { userTournamentHistory, achievementForTeam };

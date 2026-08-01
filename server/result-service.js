const { db, transaction } = require('./db');
const {
  validateFinalScore, applyFinalResultUnsafe, rollbackFinalResultUnsafe, canReopenMatch,
} = require('./bracket-service');

function getMatch(matchId) {
  return db.prepare(`
    SELECT m.*,ta.captain_user_id team_a_captain_user_id,tb.captain_user_id team_b_captain_user_id,
      t.result_reopen_hours,t.finalized_at tournament_finalized_at
    FROM matches m
    JOIN tournaments t ON t.id=m.tournament_id
    LEFT JOIN teams ta ON ta.id=m.team_a_id
    LEFT JOIN teams tb ON tb.id=m.team_b_id
    WHERE m.id=?
  `).get(matchId);
}

function activeSubmission(matchId) {
  return db.prepare(`SELECT * FROM result_submissions WHERE match_id=? AND active=1 ORDER BY revision DESC LIMIT 1`).get(matchId);
}

function requiredConfirmationTeams(match, submission) {
  if (submission.source_type === 'host' || submission.source_type === 'admin') {
    return [match.team_a_id, match.team_b_id].filter(Boolean);
  }
  if (submission.source_type === 'team') {
    return [match.team_a_id, match.team_b_id].filter(id => id && id !== submission.submitted_by_team_id);
  }
  return [];
}

function createDisputeUnsafe(match, submission, { userId=null, teamId=null, reason='' }={}) {
  const existing = db.prepare(`SELECT * FROM disputes WHERE match_id=? AND status IN ('open','under_review','recommended') ORDER BY id DESC LIMIT 1`).get(match.id);
  if (existing) return existing;
  const result = db.prepare(`INSERT INTO disputes(match_id,result_submission_id,opened_by_user_id,opened_by_team_id,status,reason) VALUES (?,?,?,?, 'open',?)`)
    .run(match.id, submission?.id || null, userId, teamId, reason || 'Result confirmation was rejected or did not match.');
  db.prepare(`UPDATE matches SET result_status='disputed',room_code_status='under_review',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(match.id);
  db.prepare('INSERT INTO audit_logs(tournament_id,match_id,user_id,action,details_json) VALUES (?,?,?,?,?)')
    .run(match.tournament_id,match.id,userId,'result.disputed',JSON.stringify({submissionId:submission?.id,teamId,reason}));
  return db.prepare('SELECT * FROM disputes WHERE id=?').get(Number(result.lastInsertRowid));
}

function finalizeSubmissionUnsafe(match, submission, userId=null) {
  const finalized = applyFinalResultUnsafe(match, {
    scoreA: submission.score_a,
    scoreB: submission.score_b,
    winnerTeamId: submission.winner_team_id,
    resolutionType: 'normal',
    resolutionReason: '',
    submissionId: submission.id,
    userId,
  });
  db.prepare('UPDATE result_submissions SET active=CASE WHEN id=? THEN 1 ELSE 0 END,superseded_at=CASE WHEN id=? THEN superseded_at ELSE COALESCE(superseded_at,CURRENT_TIMESTAMP) END WHERE match_id=?')
    .run(submission.id,submission.id,match.id);
  return finalized;
}

function submitResult({matchId,userId,sourceType='team',submittedByTeamId=null,scoreA,scoreB,note=''}) {
  return transaction(() => {
    const match = getMatch(matchId);
    if (!match) throw new Error('Match not found.');
    if (!match.team_a_id || !match.team_b_id) throw new Error('Both teams must be assigned.');
    if (match.result_status === 'final') throw new Error('This result is final. Use Reopen & Correct Result.');
    if (['disputed','under_review','recommended'].includes(match.result_status)) throw new Error('This match has an open dispute. Use the review/recommend/verify workflow instead of replacing the submission.');
    const validated = validateFinalScore(match, Number(scoreA), Number(scoreB));

    if (sourceType === 'team' && ![match.team_a_id,match.team_b_id].includes(Number(submittedByTeamId))) {
      throw new Error('The submitting team is not part of this match.');
    }

    const current = activeSubmission(matchId);
    if (current && sourceType === 'team' && current.submitted_by_team_id && current.submitted_by_team_id !== Number(submittedByTeamId)) {
      if (current.score_a === validated.scoreA && current.score_b === validated.scoreB) {
        db.prepare(`INSERT INTO result_confirmations(result_submission_id,match_id,team_id,confirmed_by_user_id,decision,comment)
          VALUES (?,?,?,?, 'confirm','Submitted the same result')
          ON CONFLICT(result_submission_id,team_id) DO UPDATE SET confirmed_by_user_id=excluded.confirmed_by_user_id,decision='confirm',comment=excluded.comment,created_at=CURRENT_TIMESTAMP`)
          .run(current.id,match.id,Number(submittedByTeamId),userId);
        const updated = finalizeSubmissionUnsafe(match,current,userId);
        db.prepare('INSERT INTO audit_logs(tournament_id,match_id,user_id,action,details_json) VALUES (?,?,?,?,?)')
          .run(match.tournament_id,match.id,userId,'result.matched_submission',JSON.stringify({submissionId:current.id,teamId:submittedByTeamId}));
        return { match: updated, submission: current, autoFinalized: true };
      }
      const revision = Number(db.prepare('SELECT COALESCE(MAX(revision),0)+1 revision FROM result_submissions WHERE match_id=?').get(match.id).revision);
      const conflictResult = db.prepare(`INSERT INTO result_submissions(match_id,revision,submitted_by_user_id,submitted_by_team_id,source_type,score_a,score_b,winner_team_id,note,active) VALUES (?,?,?,?,?,?,?,?,?,1)`)
        .run(match.id,revision,userId,Number(submittedByTeamId),'team',validated.scoreA,validated.scoreB,validated.winnerTeamId,String(note||''));
      const conflict = db.prepare('SELECT * FROM result_submissions WHERE id=?').get(Number(conflictResult.lastInsertRowid));
      createDisputeUnsafe(match,current,{userId,teamId:Number(submittedByTeamId),reason:`Conflicting result submitted: ${validated.scoreA}-${validated.scoreB}`});
      return { match:getMatch(match.id),submission:conflict,disputed:true };
    }

    if (current) {
      db.prepare(`UPDATE result_submissions SET active=0,superseded_at=CURRENT_TIMESTAMP WHERE match_id=? AND active=1`).run(match.id);
      db.prepare(`DELETE FROM result_confirmations WHERE result_submission_id=?`).run(current.id);
    }
    db.prepare(`UPDATE matches SET result_status='submitted',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(match.id);
    const revision = Number(db.prepare('SELECT COALESCE(MAX(revision),0)+1 revision FROM result_submissions WHERE match_id=?').get(match.id).revision);
    const result = db.prepare(`INSERT INTO result_submissions(match_id,revision,submitted_by_user_id,submitted_by_team_id,source_type,score_a,score_b,winner_team_id,note,active) VALUES (?,?,?,?,?,?,?,?,?,1)`)
      .run(match.id,revision,userId,submittedByTeamId,sourceType,validated.scoreA,validated.scoreB,validated.winnerTeamId,String(note||''));
    const submission = db.prepare('SELECT * FROM result_submissions WHERE id=?').get(Number(result.lastInsertRowid));
    const required = requiredConfirmationTeams(match,submission);

    if (!required.length) {
      const updated = finalizeSubmissionUnsafe(match,submission,userId);
      return { match:updated,submission,autoFinalized:true,requiredTeams:[] };
    }
    db.prepare(`UPDATE matches SET result_status='awaiting_confirmation',match_status='completed',status='completed',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(match.id);
    db.prepare('INSERT INTO audit_logs(tournament_id,match_id,user_id,action,details_json) VALUES (?,?,?,?,?)')
      .run(match.tournament_id,match.id,userId,'result.submitted',JSON.stringify({submissionId:submission.id,sourceType,submittedByTeamId,scoreA:validated.scoreA,scoreB:validated.scoreB,requiredTeams:required}));
    return { match:getMatch(match.id),submission,requiredTeams:required };
  });
}

function confirmResult({matchId,userId,teamId,decision='confirm',comment=''}) {
  return transaction(() => {
    const match = getMatch(matchId); if(!match) throw new Error('Match not found.');
    if(match.result_status!=='awaiting_confirmation') throw new Error('This result is not waiting for confirmation.');
    const submission=activeSubmission(match.id);if(!submission)throw new Error('No active result submission found.');
    const required=requiredConfirmationTeams(match,submission);
    if(!required.includes(Number(teamId)))throw new Error('This team is not required to confirm the result.');
    const normalizedDecision=decision==='confirm'?'confirm':'reject';
    const normalizedComment=String(comment||'').trim();
    if(normalizedDecision==='reject'&&!normalizedComment)throw new Error('A reason is required when rejecting a result.');
    const duplicateVerifier=db.prepare(`SELECT team_id FROM result_confirmations WHERE result_submission_id=? AND confirmed_by_user_id=? AND team_id!=? AND decision='confirm' LIMIT 1`)
      .get(submission.id,userId,Number(teamId));
    if(duplicateVerifier)throw new Error('The same account cannot confirm the result for both teams.');
    db.prepare(`INSERT INTO result_confirmations(result_submission_id,match_id,team_id,confirmed_by_user_id,decision,comment) VALUES (?,?,?,?,?,?)
      ON CONFLICT(result_submission_id,team_id) DO UPDATE SET confirmed_by_user_id=excluded.confirmed_by_user_id,decision=excluded.decision,comment=excluded.comment,created_at=CURRENT_TIMESTAMP`)
      .run(submission.id,match.id,Number(teamId),userId,normalizedDecision,normalizedComment);
    db.prepare('INSERT INTO audit_logs(tournament_id,match_id,user_id,action,details_json) VALUES (?,?,?,?,?)')
      .run(match.tournament_id,match.id,userId,normalizedDecision==='confirm'?'result.confirmed':'result.rejected',JSON.stringify({submissionId:submission.id,teamId:Number(teamId),comment:normalizedComment}));
    if(normalizedDecision!=='confirm'){
      const dispute=createDisputeUnsafe(match,submission,{userId,teamId:Number(teamId),reason:normalizedComment});
      return{match:getMatch(match.id),submission,dispute};
    }
    const confirmations=db.prepare(`SELECT team_id,decision FROM result_confirmations WHERE result_submission_id=?`).all(submission.id);
    const confirmed=new Set(confirmations.filter(item=>item.decision==='confirm').map(item=>item.team_id));
    if(required.every(id=>confirmed.has(id))){const updated=finalizeSubmissionUnsafe(match,submission,userId);return{match:updated,submission,final:true};}
    return{match:getMatch(match.id),submission,remainingTeams:required.filter(id=>!confirmed.has(id))};
  });
}

function reviewDispute({matchId,userId,status='under_review',note=''}) {
  return transaction(()=>{
    const match=getMatch(matchId);if(!match)throw new Error('Match not found.');
    const dispute=db.prepare(`SELECT * FROM disputes WHERE match_id=? AND status IN ('open','under_review','recommended') ORDER BY id DESC LIMIT 1`).get(matchId);
    if(!dispute)throw new Error('No open dispute found.');
    const next=status==='under_review'?'under_review':'open';
    db.prepare('UPDATE disputes SET status=? WHERE id=?').run(next,dispute.id);
    db.prepare(`UPDATE matches SET result_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(next==='under_review'?'under_review':'disputed',matchId);
    db.prepare('INSERT INTO audit_logs(tournament_id,match_id,user_id,action,details_json) VALUES (?,?,?,?,?)').run(match.tournament_id,matchId,userId,'dispute.reviewed',JSON.stringify({status:next,note}));
    return db.prepare('SELECT * FROM disputes WHERE id=?').get(dispute.id);
  });
}

function recommendDispute({matchId,userId,scoreA,scoreB,recommendation=''}) {
  return transaction(()=>{
    const match=getMatch(matchId);if(!match)throw new Error('Match not found.');const validated=validateFinalScore(match,Number(scoreA),Number(scoreB));
    const dispute=db.prepare(`SELECT * FROM disputes WHERE match_id=? AND status IN ('open','under_review','recommended') ORDER BY id DESC LIMIT 1`).get(matchId);if(!dispute)throw new Error('No open dispute found.');
    db.prepare(`UPDATE disputes SET status='recommended',referee_recommendation=?,recommended_score_a=?,recommended_score_b=?,recommended_by_user_id=?,recommended_at=CURRENT_TIMESTAMP WHERE id=?`)
      .run(String(recommendation||''),validated.scoreA,validated.scoreB,userId,dispute.id);
    db.prepare(`UPDATE matches SET result_status='recommended',updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(matchId);
    return db.prepare('SELECT * FROM disputes WHERE id=?').get(dispute.id);
  });
}

function verifyDispute({matchId,userId,scoreA,scoreB,resolutionNote='',resolutionType='administrative_award'}) {
  return transaction(()=>{
    const match=getMatch(matchId);if(!match)throw new Error('Match not found.');const validated=validateFinalScore(match,Number(scoreA),Number(scoreB));
    const dispute=db.prepare(`SELECT * FROM disputes WHERE match_id=? AND status IN ('open','under_review','recommended') ORDER BY id DESC LIMIT 1`).get(matchId);if(!dispute)throw new Error('No open dispute found.');
    const revision=Number(db.prepare('SELECT COALESCE(MAX(revision),0)+1 revision FROM result_submissions WHERE match_id=?').get(match.id).revision);
    db.prepare('UPDATE result_submissions SET active=0,superseded_at=COALESCE(superseded_at,CURRENT_TIMESTAMP) WHERE match_id=?').run(match.id);
    const result=db.prepare(`INSERT INTO result_submissions(match_id,revision,submitted_by_user_id,source_type,score_a,score_b,winner_team_id,note,active) VALUES (?,?,?,'referee_ruling',?,?,?,?,1)`)
      .run(match.id,revision,userId,validated.scoreA,validated.scoreB,validated.winnerTeamId,String(resolutionNote||''));
    const submissionId=Number(result.lastInsertRowid);
    const updated=applyFinalResultUnsafe(match,{...validated,resolutionType,resolutionReason:String(resolutionNote||''),submissionId,userId});
    db.prepare(`UPDATE disputes SET status='resolved',resolved_by_user_id=?,resolution_note=?,resolved_at=CURRENT_TIMESTAMP WHERE id=?`).run(userId,String(resolutionNote||''),dispute.id);
    return{match:updated,dispute:db.prepare('SELECT * FROM disputes WHERE id=?').get(dispute.id)};
  });
}

function reopenResult({matchId,userId,reason=''}) {
  return transaction(()=>{
    const match=getMatch(matchId);if(!match)throw new Error('Match not found.');if(match.result_status!=='final')throw new Error('Only a final result can be reopened.');
    const finalizedAt=Date.parse(match.result_finalized_at||'');const maxHours=Number(match.result_reopen_hours||24);if(!Number.isFinite(finalizedAt)||Date.now()-finalizedAt>maxHours*3600000)throw new Error(`The ${maxHours}-hour correction window has expired.`);
    const dependency=canReopenMatch(match);if(!dependency.allowed)throw new Error(`Cannot reopen because a dependent match has already ${dependency.blocking[0].match_status}.`);
    if(!String(reason||'').trim())throw new Error('A correction reason is required.');
    rollbackFinalResultUnsafe(match,userId);
    db.prepare('UPDATE result_submissions SET active=0,superseded_at=COALESCE(superseded_at,CURRENT_TIMESTAMP) WHERE match_id=?').run(match.id);
    db.prepare('INSERT INTO audit_logs(tournament_id,match_id,user_id,action,details_json) VALUES (?,?,?,?,?)').run(match.tournament_id,match.id,userId,'result.reopen_reason',JSON.stringify({reason}));
    return getMatch(match.id);
  });
}

function correctFinalResult({matchId,userId,reason,scoreA,scoreB}) {
  // Keep the reopened state visible in audit, then create a new host submission.
  reopenResult({matchId,userId,reason});
  return submitResult({matchId,userId,sourceType:'host',scoreA,scoreB,note:`Correction: ${reason}`});
}

function getResultContext(matchId) {
  const match=getMatch(matchId);if(!match)return null;
  const submissions=db.prepare(`SELECT rs.*,u.display_name submitted_by_name,t.name submitted_by_team_name FROM result_submissions rs LEFT JOIN users u ON u.id=rs.submitted_by_user_id LEFT JOIN teams t ON t.id=rs.submitted_by_team_id WHERE rs.match_id=? ORDER BY rs.revision DESC`).all(matchId);
  const confirmations=db.prepare(`SELECT rc.*,u.display_name confirmed_by_name,t.name team_name FROM result_confirmations rc LEFT JOIN users u ON u.id=rc.confirmed_by_user_id LEFT JOIN teams t ON t.id=rc.team_id WHERE rc.match_id=? ORDER BY rc.id`).all(matchId);
  const dispute=db.prepare(`SELECT d.*,u.display_name recommended_by_name,r.display_name resolved_by_name FROM disputes d LEFT JOIN users u ON u.id=d.recommended_by_user_id LEFT JOIN users r ON r.id=d.resolved_by_user_id WHERE d.match_id=? ORDER BY d.id DESC LIMIT 1`).get(matchId)||null;
  const current=activeSubmission(matchId)||null;
  return{match,currentSubmission:current,submissions,confirmations,dispute,requiredTeams:current?requiredConfirmationTeams(match,current):[]};
}

module.exports={
  getMatch,submitResult,confirmResult,reviewDispute,recommendDispute,verifyDispute,reopenResult,correctFinalResult,getResultContext,createDisputeUnsafe,
};

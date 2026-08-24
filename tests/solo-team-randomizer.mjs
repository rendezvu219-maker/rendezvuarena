import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'rendezvu-solo-randomizer-'));
const databasePath=path.join(tempRoot,'solo.sqlite');
const port=3166;
const base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server.js'],{
  cwd:root,
  env:{
    ...process.env,NODE_ENV:'test',PORT:String(port),DATABASE_PATH:databasePath,
    UPLOAD_PATH:path.join(tempRoot,'uploads'),AUTH_SECRET:'solo-randomizer-regression-secret-2026',
    ADMIN_USERNAME:'solo_admin',ADMIN_EMAIL:'solo-admin@test.local',ADMIN_PASSWORD:'AdminSecure123!',
    ENABLE_DEV_TEST_CONSOLE:'true',API_RATE_LIMIT_PER_MINUTE:'10000',REGISTER_RATE_LIMIT_MAX:'10000',LOGIN_FAILURE_LIMIT:'10000',
  },
  stdio:['ignore','pipe','pipe'],
});
let output='';let db=null;
child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});

async function request(url,{token,method='GET',body,allowError=false}={}){
  const response=await fetch(`${base}${url}`,{method,headers:{
    ...(token?{Authorization:`Bearer ${token}`}:{ }),
    ...(!['GET','HEAD','OPTIONS'].includes(method)?{'X-CSRF-Token':'1'}:{}),
    ...(body===undefined?{}:{'Content-Type':'application/json'}),
  },body:body===undefined?undefined:JSON.stringify(body)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok&&!allowError)throw new Error(`${method} ${url}: ${payload.error||response.status}`);
  return {response,payload};
}
async function waitForServer(){for(let attempt=0;attempt<120;attempt+=1){try{const response=await fetch(`${base}/api/health`);if(response.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,60));}throw new Error(`Solo randomizer server did not start.\n${output}`);}
function accessCode(url){return new URLSearchParams(new URL(url,base).hash.slice(1)).get('code');}
async function tokenFromAccessUrl(url){const exchanged=await request('/api/dev-test/access/exchange',{method:'POST',body:{code:accessCode(url)}});return exchanged.payload.token;}
async function stopServer(){if(!child.killed)child.kill('SIGTERM');await new Promise(resolve=>{const timer=setTimeout(resolve,1500);child.once('exit',()=>{clearTimeout(timer);resolve();});});fs.rmSync(tempRoot,{recursive:true,force:true});}

try{
  await waitForServer();
  const adminLogin=await request('/api/auth/login',{method:'POST',body:{identity:'solo_admin',password:'AdminSecure123!'}});
  const created=await request('/api/dev-test/suites',{token:adminLogin.payload.token,method:'POST'});
  const suite=created.payload.suite;
  const registration=suite.tournaments.find(tournament=>tournament.scenario==='registration');
  assert.ok(registration,'A registration tournament is required.');
  const persona=name=>suite.users.find(user=>user.persona===name);
  const hostToken=await tokenFromAccessUrl(persona('host').accessUrl);
  const applicantCaptain=persona('applicant_captain');
  const applicantToken=await tokenFromAccessUrl(applicantCaptain.accessUrl);
  const outsiderToken=await tokenFromAccessUrl(persona('captain_8').accessUrl);

  db=new DatabaseSync(databasePath);
  const formationColumn=db.prepare('PRAGMA table_info(teams)').all().find(column=>column.name==='formation_source');
  assert.ok(formationColumn,'The normal migration path must add solo-team provenance.');
  const registrationModeColumn=db.prepare('PRAGMA table_info(tournaments)').all().find(column=>column.name==='registration_mode');
  assert.ok(registrationModeColumn,'The normal migration path must add the per-tournament registration mode.');
  assert.equal(db.prepare('SELECT registration_mode FROM tournaments WHERE id=?').get(registration.id).registration_mode,'team_or_solo');

  const invalidMode=await request(`/api/tournaments/${registration.id}`,{
    token:hostToken,method:'PATCH',body:{registrationMode:'unknown_mode'},allowError:true,
  });
  assert.equal(invalidMode.response.status,400,'Unknown registration modes must be rejected.');
  const soloOnly=await request(`/api/tournaments/${registration.id}`,{
    token:hostToken,method:'PATCH',body:{registrationMode:'solo_pool_only'},
  });
  assert.equal(soloOnly.payload.tournament.registration_mode,'solo_pool_only');
  const soloOnlyOptions=await request(`/api/public/tournaments/${registration.slug}/join-options`);
  assert.equal(soloOnlyOptions.payload.tournament.registration_mode,'solo_pool_only');
  assert.deepEqual(soloOnlyOptions.payload.teams,[],'Solo-only registration must not expose team choices.');
  const existingTeam=db.prepare('SELECT id FROM teams WHERE tournament_id=? ORDER BY id LIMIT 1').get(registration.id);
  const blockedTeamSignup=await request(`/api/tournaments/${registration.slug}/join-requests`,{
    token:applicantToken,method:'POST',body:{requestedRole:'player',teamId:existingTeam?.id||null,requestedTeamName:existingTeam?'':'Bypass Team',gamerTag:'BYPASS'},allowError:true,
  });
  assert.equal(blockedTeamSignup.response.status,400,'Solo-only mode must reject direct team registration even when the API is called manually.');
  assert.match(blockedTeamSignup.payload.error,/Solo Pool registrations only/i);

  const submitted=await request(`/api/tournaments/${registration.slug}/join-requests`,{
    token:applicantToken,method:'POST',body:{requestedRole:'captain',soloSignup:true,gamerTag:'SOLO-CAPTAIN',message:'Please assign me.'},
  });
  assert.equal(submitted.response.status,201);
  assert.equal(submitted.payload.request.team_id,null);
  const approved=await request(`/api/tournaments/${registration.id}/join-requests/${submitted.payload.request.id}/review`,{
    token:hostToken,method:'POST',body:{decision:'approve',soloPool:true},
  });
  assert.equal(approved.payload.soloPool,true);
  assert.equal(approved.payload.request.status,'approved');
  assert.equal(approved.payload.request.team_id,null);

  const poolPersonas=[persona('captain_1'),...Array.from({length:6},(_,index)=>persona(`player_${index+1}`))];
  const insertRequest=db.prepare(`INSERT INTO tournament_join_requests(
    tournament_id,user_id,requested_role,gamer_tag,status,reviewed_by,reviewed_at
  ) VALUES (?,?,?,?, 'approved',?,CURRENT_TIMESTAMP)`);
  poolPersonas.forEach((user,index)=>insertRequest.run(registration.id,user.id,index===0?'captain':'player',`SOLO-${index+1}`,persona('host').id));

  const deniedPreview=await request(`/api/tournaments/${registration.id}/solo-randomizer/preview`,{
    token:outsiderToken,method:'POST',body:{totalSlots:8,teamSize:4,captainMode:'self_nominated'},allowError:true,
  });
  assert.equal(deniedPreview.response.status,403,'Players cannot invoke a Host-only team formation action.');
  const uneven=await request(`/api/tournaments/${registration.id}/solo-randomizer/preview`,{
    token:hostToken,method:'POST',body:{totalSlots:8,teamSize:3,captainMode:'self_nominated'},allowError:true,
  });
  assert.equal(uneven.response.status,400);
  assert.match(uneven.payload.error,/cannot be divided evenly/i,'Uneven counts must warn instead of dropping a player.');

  const firstPreview=await request(`/api/tournaments/${registration.id}/solo-randomizer/preview`,{
    token:hostToken,method:'POST',body:{totalSlots:8,teamSize:4,captainMode:'self_nominated'},
  });
  assert.equal(firstPreview.payload.preview.assignments.length,2);
  firstPreview.payload.preview.assignments.forEach(team=>{
    assert.equal(team.members.length,4);
    assert.equal(team.members.filter(member=>member.isCaptain).length,1);
  });
  const rerolled=await request(`/api/tournaments/${registration.id}/solo-randomizer/preview`,{
    token:hostToken,method:'POST',body:{totalSlots:8,teamSize:4,captainMode:'self_nominated'},
  });
  assert.notEqual(rerolled.payload.preview.id,firstPreview.payload.preview.id);
  assert.equal(db.prepare('SELECT status FROM solo_team_previews WHERE id=?').get(firstPreview.payload.preview.id).status,'cancelled');

  const confirmed=await request(`/api/tournaments/${registration.id}/solo-randomizer/confirm`,{
    token:hostToken,method:'POST',body:{previewId:rerolled.payload.preview.id},
  });
  assert.equal(confirmed.response.status,201);
  assert.equal(confirmed.payload.teams.length,2);
  const generatedIds=confirmed.payload.teams.map(team=>team.teamId);
  generatedIds.forEach(teamId=>{
    const team=db.prepare('SELECT * FROM teams WHERE id=?').get(teamId);
    const members=db.prepare('SELECT * FROM team_members WHERE team_id=? ORDER BY id').all(teamId);
    assert.equal(team.source,'manual','The immutable source CHECK remains unchanged.');
    assert.equal(team.formation_source,'solo_randomizer');
    assert.equal(members.length,4);
    assert.equal(members.filter(member=>member.is_captain).length,1);
    assert.equal(Number(members.find(member=>member.is_captain).user_id),Number(team.captain_user_id),'Both Captain fields must agree.');
  });
  const linkedRequests=db.prepare(`SELECT * FROM tournament_join_requests WHERE tournament_id=? AND id IN (${[submitted.payload.request.id,...poolPersonas.map(user=>db.prepare('SELECT id FROM tournament_join_requests WHERE tournament_id=? AND user_id=?').get(registration.id,user.id).id)].map(()=>'?').join(',')})`).all(registration.id,submitted.payload.request.id,...poolPersonas.map(user=>db.prepare('SELECT id FROM tournament_join_requests WHERE tournament_id=? AND user_id=?').get(registration.id,user.id).id));
  assert.equal(linkedRequests.length,8);
  assert.ok(linkedRequests.every(request=>request.status==='approved'&&request.team_id&&request.selected_member_id));

  const myTeam=await request(`/api/tournaments/${registration.id}/my-team`,{token:applicantToken});
  assert.equal(myTeam.response.status,200);
  assert.ok(generatedIds.includes(myTeam.payload.team.id));
  assert.equal(Object.hasOwn(myTeam.payload.team,'members'),false,'The narrow privacy path must never expose the roster.');
  const outsiderTeam=await request(`/api/tournaments/${registration.id}/my-team`,{token:outsiderToken,allowError:true});
  assert.equal(outsiderTeam.response.status,404,'An unassigned player cannot discover a generated team.');
  const publicOptions=await request(`/api/public/tournaments/${registration.slug}/join-options`);
  assert.ok(publicOptions.payload.teams.every(team=>!generatedIds.includes(team.id)),'Private generated teams must not enter the public join list.');
  const privatePortal=await request('/api/portal',{token:applicantToken});
  const portalTeam=privatePortal.payload.teams.find(team=>team.id===myTeam.payload.team.id);
  assert.equal(portalTeam.rosterPrivate,true);
  assert.deepEqual(portalTeam.members,[],'The existing portal must not leak a pre-match generated roster.');
  const staffTournament=await request(`/api/tournaments/${registration.id}`,{token:hostToken});
  assert.equal(staffTournament.payload.teams.find(team=>team.id===myTeam.payload.team.id).members.length,4,'Staff roster visibility stays unchanged.');

  const matchResult=db.prepare(`INSERT INTO matches(
    tournament_id,stage,round_no,round_name,position,team_a_id,team_b_id,best_of,series_rule,status,match_status,result_status
  ) VALUES (?,'solo_privacy',1,'Solo Privacy',1,?,?,3,'normal','available','available','none')`).run(registration.id,generatedIds[0],generatedIds[1]);
  const matchId=Number(matchResult.lastInsertRowid);
  const matchAccess=await request(`/api/matches/${matchId}/messages`,{token:applicantToken});
  assert.equal(matchAccess.response.status,200,'Generated members must flow through existing match authorization.');
  const matchPortal=await request('/api/portal',{token:applicantToken});
  const visibleRoster=matchPortal.payload.teams.find(team=>team.id===myTeam.payload.team.id);
  assert.equal(visibleRoster.rosterPrivate,false);
  assert.equal(visibleRoster.members.length,4,'The roster becomes available only after existing match access applies.');
  const stillNarrow=await request(`/api/tournaments/${registration.id}/my-team`,{token:applicantToken});
  assert.equal(Object.hasOwn(stillNarrow.payload.team,'members'),false);

  const blockedUndo=await request(`/api/tournaments/${registration.id}/solo-randomizer/undo`,{token:hostToken,method:'POST',body:{},allowError:true});
  assert.equal(blockedUndo.response.status,409,'Undo must not delete teams referenced by a match.');
  db.prepare('DELETE FROM matches WHERE id=?').run(matchId);
  const undone=await request(`/api/tournaments/${registration.id}/solo-randomizer/undo`,{token:hostToken,method:'POST',body:{}});
  assert.equal(undone.response.status,200);
  assert.deepEqual(undone.payload.removedTeamIds.sort((a,b)=>a-b),generatedIds.sort((a,b)=>a-b));
  assert.equal(Number(db.prepare(`SELECT COUNT(*) count FROM teams WHERE id IN (${generatedIds.map(()=>'?').join(',')})`).get(...generatedIds).count),0);
  const restored=db.prepare(`SELECT * FROM tournament_join_requests WHERE tournament_id=? AND user_id IN (${[applicantCaptain,...poolPersonas].map(()=>'?').join(',')}) ORDER BY id`).all(registration.id,applicantCaptain.id,...poolPersonas.map(user=>user.id));
  assert.equal(restored.length,8);
  assert.ok(restored.every(request=>request.status==='approved'&&!request.team_id&&!request.selected_member_id));

  const hostCaptainIds=[poolPersonas[1].id,poolPersonas[2].id];
  const handPicked=await request(`/api/tournaments/${registration.id}/solo-randomizer/preview`,{
    token:hostToken,method:'POST',body:{totalSlots:8,teamSize:4,captainMode:'host_selected',captainUserIds:hostCaptainIds},
  });
  const pickedIds=handPicked.payload.preview.assignments.map(team=>Number(team.members.find(member=>member.isCaptain).user_id)).sort((a,b)=>a-b);
  assert.deepEqual(pickedIds,hostCaptainIds.sort((a,b)=>a-b),'Host-selected mode must use exactly the chosen Captains.');

  const dashboard=fs.readFileSync(path.join(root,'js','dashboard.js'),'utf8');
  const joinPage=fs.readFileSync(path.join(root,'js','join-tournament.js'),'utf8');
  assert.match(dashboard,/solo-randomizer\/preview/);
  assert.match(dashboard,/confirmSoloTeams/);
  assert.match(dashboard,/registrationMode/);
  assert.match(joinPage,/soloSignup/);
  assert.match(joinPage,/soloPoolOnly/);
  console.log('Solo-only registration, preview/confirm, Captain-safe teams, privacy, match access and undo snapshot checks passed.');
}finally{
  try{db?.close();}catch{}
  await stopServer();
}

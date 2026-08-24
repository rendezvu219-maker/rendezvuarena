import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'rendezvu-captain-consistency-'));
const databasePath=path.join(tempRoot,'captains.sqlite');
const port=3151;
const base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server.js'],{
  cwd:root,
  env:{...process.env,NODE_ENV:'test',PORT:String(port),DATABASE_PATH:databasePath,UPLOAD_PATH:path.join(tempRoot,'uploads'),AUTH_SECRET:'captain-consistency-regression-secret-2026',ADMIN_EMAIL:'captain-admin@test.local',ADMIN_PASSWORD:'AdminPass123!',ADMIN_USERNAME:'captain_admin'},
  stdio:['ignore','pipe','pipe'],
});
let output='';child.stdout.on('data',chunk=>{output+=chunk;});child.stderr.on('data',chunk=>{output+=chunk;});

async function request(url,{token,method='GET',body}={}){
  const response=await fetch(`${base}${url}`,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(!['GET','HEAD','OPTIONS'].includes(method)?{'X-CSRF-Token':'1'}:{ }),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`${method} ${url}: ${payload.error||response.status}`);
  return payload;
}
async function waitForServer(){for(let i=0;i<100;i+=1){try{await request('/api/health');return;}catch{await new Promise(resolve=>setTimeout(resolve,60));}}throw new Error(`Server did not start.\n${output}`);}
async function tokenFromAccessUrl(url){const parsed=new URL(url,base);const code=new URLSearchParams(parsed.hash.slice(1)).get('code');return (await request('/api/dev-test/access/exchange',{method:'POST',body:{code}})).token;}

let db;
try{
  await waitForServer();
  const admin=(await request('/api/auth/login',{method:'POST',body:{identity:'captain_admin',password:'AdminPass123!'}})).token;
  const created=await request('/api/dev-test/suites',{token:admin,method:'POST'});
  const suite=created.suite;const host=await tokenFromAccessUrl(suite.users.find(user=>user.persona==='host').accessUrl);
  const live=suite.tournaments.find(tournament=>tournament.scenario==='live');
  const registration=suite.tournaments.find(tournament=>tournament.scenario==='registration');
  const liveData=await request(`/api/tournaments/${live.id}`,{token:host});
  const transferTeam=liveData.teams.find(team=>team.captain_user_id&&team.members.some(member=>member.user_id&&!member.is_captain));
  const oldCaptainId=Number(transferTeam.captain_user_id);
  const nextCaptainMember=transferTeam.members.find(member=>member.user_id&&!member.is_captain);
  const nextCaptain=suite.users.find(user=>Number(user.id)===Number(nextCaptainMember.user_id));
  assert.ok(nextCaptain,'A linked player is required for the Captain transfer audit.');

  await request(`/api/tournaments/${live.id}/teams/${transferTeam.id}/captain/assign`,{token:host,method:'POST',body:{identity:nextCaptain.username}});
  db=new DatabaseSync(databasePath);
  const transferred=db.prepare('SELECT captain_user_id FROM teams WHERE id=?').get(transferTeam.id);
  assert.equal(Number(transferred.captain_user_id),Number(nextCaptain.id));
  const flags=db.prepare('SELECT user_id,is_captain,member_role FROM team_members WHERE team_id=? AND user_id IN (?,?) ORDER BY user_id').all(transferTeam.id,oldCaptainId,nextCaptain.id);
  assert.equal(flags.find(member=>Number(member.user_id)===Number(nextCaptain.id)).is_captain,1);
  assert.equal(flags.find(member=>Number(member.user_id)===Number(nextCaptain.id)).member_role,'captain');
  assert.equal(flags.find(member=>Number(member.user_id)===oldCaptainId).is_captain,0);
  assert.equal(flags.find(member=>Number(member.user_id)===oldCaptainId).member_role,'player','A transfer must demote the former Captain roster role too.');

  const registrationData=await request(`/api/tournaments/${registration.id}`,{token:host});
  const openTeam=registrationData.teams.find(team=>!team.captain_user_id&&team.members.some(member=>member.is_captain&&!member.user_id));
  const placeholderBefore=db.prepare('SELECT id FROM team_members WHERE team_id=? AND is_captain=1 AND user_id IS NULL').get(openTeam.id);
  const applicant=suite.users.find(user=>user.persona==='applicant_captain');
  await request(`/api/tournaments/${registration.id}/teams/${openTeam.id}/captain/assign`,{token:host,method:'POST',body:{identity:applicant.username}});
  const placeholderAfter=db.prepare('SELECT id,user_id,is_captain,member_role FROM team_members WHERE id=?').get(placeholderBefore.id);
  assert.equal(Number(placeholderAfter.user_id),Number(applicant.id),'Assigning a Captain must fill the existing Captain slot instead of adding a duplicate.');
  assert.equal(placeholderAfter.is_captain,1);
  assert.equal(placeholderAfter.member_role,'captain');

  const mismatches=db.prepare(`SELECT t.id FROM teams t WHERE t.captain_user_id IS NOT NULL AND (
    (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id=t.id AND tm.user_id=t.captain_user_id AND tm.is_captain=1 AND tm.member_role='captain' AND tm.membership_status='active')!=1
    OR (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id=t.id AND tm.is_captain=1 AND tm.user_id IS NOT NULL)!=1
  )`).all();
  assert.deepEqual(mismatches,[],'Every linked Captain must agree across teams.captain_user_id and team_members.is_captain.');
  const serverSource=fs.readFileSync(path.join(root,'server.js'),'utf8');
  assert.match(serverSource,/startgg_participant_id IS NOT NULL AND user_id IS NULL/,'External roster refresh must preserve linked Captain rows.');

  db.close();db=null;
  await request(`/api/dev-test/suites/${created.suiteId}`,{token:admin,method:'DELETE'});
  console.log('Captain transfer, placeholder assignment, external-sync preservation and dual-field consistency checks passed.');
}finally{
  try{db?.close();}catch{}
  if(!child.killed)child.kill('SIGTERM');
  await new Promise(resolve=>{const timer=setTimeout(resolve,1500);child.once('exit',()=>{clearTimeout(timer);resolve();});});
  fs.rmSync(tempRoot,{recursive:true,force:true});
}

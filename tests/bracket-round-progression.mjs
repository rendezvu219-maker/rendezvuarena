import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'gekishin-bracket-progress-'));
const port=3130;
const base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server.js'],{
  cwd:root,
  env:{...process.env,NODE_ENV:'test',PORT:String(port),DATABASE_PATH:path.join(tempDir,'progress.sqlite'),AUTH_SECRET:'bracket-progress-secret-32-characters!!',ADMIN_EMAIL:'progress_admin@test.local',ADMIN_PASSWORD:'AdminPass123!',ADMIN_USERNAME:'progress_admin',ALLOW_MANUAL_TOURNAMENT_CREATION:'true'},
  stdio:['ignore','pipe','pipe'],
});
let serverOutput='';
child.stdout.on('data',chunk=>{serverOutput+=chunk;});
child.stderr.on('data',chunk=>{serverOutput+=chunk;});

async function request(url,{token,method='GET',body}={}){
  const response=await fetch(`${base}${url}`,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,...(!['GET','HEAD','OPTIONS'].includes(String(method).toUpperCase())?{'X-CSRF-Token':'1'}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`${method} ${url}: ${payload.error||response.status}`);
  return payload;
}
async function waitForServer(){for(let i=0;i<80;i++){try{await request('/api/health');return;}catch{await new Promise(resolve=>setTimeout(resolve,75));}}throw new Error(`Bracket progression test server did not start.\n${serverOutput}`);}
async function play(match,captainTokens,{scoreA=1,scoreB=0}={}){const a=Number(match.team_a_id),b=Number(match.team_b_id);await request(`/api/matches/${match.id}/results/submit`,{token:captainTokens.get(a),method:'POST',body:{scoreA,scoreB,note:'Regression test result.'}});const confirmed=await request(`/api/matches/${match.id}/results/confirm`,{token:captainTokens.get(b),method:'POST',body:{decision:'confirm'}});assert.equal(confirmed.final,true);}
async function playHostVerified(match,adminToken,captainTokens){const a=Number(match.team_a_id),b=Number(match.team_b_id);await request(`/api/matches/${match.id}/results/submit`,{token:adminToken,method:'POST',body:{sourceType:'host',scoreA:1,scoreB:0,note:'Host-submitted result requires both Captains.'}});const afterA=await request(`/api/matches/${match.id}/results/confirm`,{token:captainTokens.get(a),method:'POST',body:{decision:'confirm'}});assert.notEqual(afterA.final,true,'One Captain must not finalize a Host report.');const afterB=await request(`/api/matches/${match.id}/results/confirm`,{token:captainTokens.get(b),method:'POST',body:{decision:'confirm'}});assert.equal(afterB.final,true);}

try{
  await waitForServer();
  const admin=(await request('/api/auth/login',{method:'POST',body:{identity:'progress_admin',password:'AdminPass123!'}})).token;
  const tournament=(await request('/api/tournaments',{token:admin,method:'POST',body:{name:'Bracket progression regression',status:'preparing',startAt:'2026-01-01T00:00:00.000Z',rules:{playoffBestOf:1,grandFinalBestOf:1}}})).tournament;
  const captainTokensByUser=new Map();
  const captainTokensByTeam=new Map();
  for(let i=1;i<=4;i++){
    const registered=await request('/api/auth/register',{method:'POST',body:{username:`progress_captain_${i}`,email:`progress_captain_${i}@test.local`,displayName:`Progress Captain ${i}`,password:'CaptainPass123!'}});
    captainTokensByUser.set(registered.user.username,registered.token);
    const team=(await request(`/api/tournaments/${tournament.id}/teams`,{token:admin,method:'POST',body:{name:`Progress Team ${i}`,tag:`P${i}`}})).team;
    await request(`/api/tournaments/${tournament.id}/teams/${team.id}/captain/assign`,{token:admin,method:'POST',body:{identity:registered.user.username}});
    await request(`/api/tournaments/${tournament.id}/teams/${team.id}`,{token:admin,method:'PATCH',body:{seed:i,seedLocked:true,teamStatus:'ready'}});
    captainTokensByTeam.set(Number(team.id),registered.token);
  }
  const generated=await request(`/api/tournaments/${tournament.id}/bracket/generate`,{token:admin,method:'POST',body:{bestOf:1,allowWarnings:true}});
  assert.equal(generated.matches.length,3);
  let detail=await request(`/api/tournaments/${tournament.id}`,{token:admin});
  const semis=detail.matches.filter(match=>match.round_no===1).sort((a,b)=>a.position-b.position);
  const final=detail.matches.find(match=>match.round_no===2);
  await playHostVerified(semis[0],admin,captainTokensByTeam);
  detail=await request(`/api/tournaments/${tournament.id}`,{token:admin});
  let waitingFinal=detail.matches.find(match=>match.id===final.id);
  assert.notEqual(waitingFinal.result_status,'final','Final must not auto-complete after only one semifinal finishes.');
  assert.equal(Boolean(waitingFinal.team_a_id)+Boolean(waitingFinal.team_b_id),1,'Final should contain exactly one semifinal winner while waiting.');
  await request(`/api/matches/${semis[0].id}/results/reopen`,{token:admin,method:'POST',body:{reason:'Regression test: wrong winner selected.'}});
  detail=await request(`/api/tournaments/${tournament.id}`,{token:admin});
  const reopenedSemi=detail.matches.find(match=>match.id===semis[0].id);
  waitingFinal=detail.matches.find(match=>match.id===final.id);
  assert.equal(reopenedSemi.result_status,'reopened','Undo must reopen the finalized match.');
  assert.equal(Boolean(waitingFinal.team_a_id)+Boolean(waitingFinal.team_b_id),0,'Undo must remove the previously advanced winner.');
  await play(reopenedSemi,captainTokensByTeam,{scoreA:0,scoreB:1});
  await play(semis[1],captainTokensByTeam);
  detail=await request(`/api/tournaments/${tournament.id}`,{token:admin});
  const playableFinal=detail.matches.find(match=>match.id===final.id);
  assert.ok(playableFinal.team_a_id&&playableFinal.team_b_id,'Final must receive both semifinal winners.');
  assert.notEqual(playableFinal.result_status,'final');
  await play(playableFinal,captainTokensByTeam);
  detail=await request(`/api/tournaments/${tournament.id}`,{token:admin});
  assert.equal(detail.matches.filter(match=>match.result_status==='final').length,3,'All three matches must be finalized through submit + confirm.');
  console.log('Bracket progression, dual verification, and undo advancement regression passed.');
} finally {
  if(!child.killed)child.kill('SIGTERM');
  await new Promise(resolve=>{const timer=setTimeout(resolve,1500);child.once('exit',()=>{clearTimeout(timer);resolve();});});
  fs.rmSync(tempDir,{recursive:true,force:true});
}

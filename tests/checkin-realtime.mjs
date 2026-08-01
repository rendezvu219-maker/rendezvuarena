import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const {io}=require('socket.io-client');

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'gekishin-checkin-realtime-'));
const port=3128;
const base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server.js'],{
  cwd:root,
  env:{...process.env,NODE_ENV:'test',PORT:String(port),DATABASE_PATH:path.join(tempDir,'checkin.sqlite'),AUTH_SECRET:'checkin-test-secret-32-characters-long!',ADMIN_EMAIL:'checkin_admin@test.local',ADMIN_PASSWORD:'AdminPass123!',ADMIN_USERNAME:'checkin_admin'},
  stdio:['ignore','pipe','pipe'],
});
let serverOutput='';
child.stdout.on('data',chunk=>{serverOutput+=chunk;});
child.stderr.on('data',chunk=>{serverOutput+=chunk;});

async function request(url,{token,method='GET',body,allowError=false}={}){
  const response=await fetch(`${base}${url}`,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,...(!['GET','HEAD','OPTIONS'].includes(String(method).toUpperCase())?{'X-CSRF-Token':'1'}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok&&!allowError)throw new Error(`${method} ${url}: ${payload.error||response.status}`);
  return {response,payload};
}
async function waitForServer(){for(let i=0;i<80;i++){try{await request('/api/health');return;}catch{await new Promise(resolve=>setTimeout(resolve,75));}}throw new Error(`Check-in test server did not start.\n${serverOutput}`);}
async function tokenFromAccessUrl(url){const parsed=new URL(url,base);const code=new URLSearchParams(parsed.hash.slice(1)).get('code');const exchanged=await request('/api/dev-test/access/exchange',{method:'POST',body:{code}});return exchanged.payload.token;}
function waitForEvent(socket,eventName,timeout=3000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.off(eventName,handler);reject(new Error(`Timed out waiting for ${eventName}.`));},timeout);const handler=payload=>{clearTimeout(timer);resolve(payload);};socket.once(eventName,handler);});}

let socket;
try{
  await waitForServer();
  const login=await request('/api/auth/login',{method:'POST',body:{identity:'checkin_admin',password:'AdminPass123!'}});
  const adminToken=login.payload.token;
  const created=await request('/api/dev-test/suites',{token:adminToken,method:'POST'});
  const suite=created.payload.suite;
  const live=suite.tournaments.find(item=>item.scenario==='live');
  const hostToken=await tokenFromAccessUrl(suite.users.find(item=>item.persona==='host').accessUrl);
  const captainAToken=await tokenFromAccessUrl(suite.users.find(item=>item.persona==='captain_1').accessUrl);
  const tournament=await request(`/api/tournaments/${live.id}`,{token:hostToken});
  const match=tournament.payload.matches.find(item=>item.team_a_id&&item.team_b_id&&item.result_status!=='final');
  assert.ok(match,'Live fixture must contain a playable match.');

  const mismatch=await request(`/api/matches/${match.id}/checkin`,{token:captainAToken,method:'POST',body:{actorType:'team',actorId:match.team_b_id},allowError:true});
  assert.equal(mismatch.response.status,400,'Captain must receive 400 when actorId names the opposing team.');
  assert.match(mismatch.payload.error,/does not match your linked team/i);

  socket=io(base,{auth:{token:hostToken},transports:['websocket']});
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
  socket.emit('tournament:join',{tournamentId:live.id});
  const eventPromise=waitForEvent(socket,'match:checkin');
  const checkedIn=await request(`/api/matches/${match.id}/checkin`,{token:captainAToken,method:'POST',body:{}});
  assert.ok(checkedIn.payload.checkins.some(item=>Number(item.actor_id)===Number(match.team_a_id)&&item.status==='ready'));
  const event=await eventPromise;
  assert.equal(Number(event.tournamentId),Number(live.id));
  assert.equal(Number(event.matchId),Number(match.id));
  assert.equal(event.actorType,'team');
  assert.equal(Number(event.actorId),Number(match.team_a_id));
  assert.equal(event.status,'ready');
  assert.ok(event.checkedInBy);
  assert.ok(event.checkins.some(item=>Number(item.actor_id)===Number(match.team_a_id)&&item.status==='ready'),'Realtime payload must include the latest match check-ins.');
  await request(`/api/dev-test/suites/${created.payload.suiteId}`,{token:adminToken,method:'DELETE'});
  console.log('Check-in actor validation and realtime tournament event tests passed.');
} finally {
  socket?.disconnect();
  if(!child.killed)child.kill('SIGTERM');
  await new Promise(resolve=>{const timer=setTimeout(resolve,1500);child.once('exit',()=>{clearTimeout(timer);resolve();});});
  fs.rmSync(tempDir,{recursive:true,force:true});
}

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { detectTournamentPlatform, isPrivateAddress, assertPublicNetworkTarget } = require('../server/external-tournaments');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

const startgg = detectTournamentPlatform('https://www.start.gg/tournament/rising-squadra-asia-tournament-s6/details');
assert.ok(startgg.valid && startgg.platform === 'startgg', 'start.gg URL should be detected.');
assert.equal(startgg.externalId,'rising-squadra-asia-tournament-s6','start.gg slug should be extracted.');

const tonamel = detectTournamentPlatform('https://tonamel.com/competition/BGZfx');
assert.ok(tonamel.valid && tonamel.platform === 'tonamel', 'Tonamel URL should be detected.');
assert.equal(tonamel.externalId,'BGZfx','Tonamel competition ID should be extracted.');

const challonge = detectTournamentPlatform('https://community.challonge.com/rising_squadra');
assert.ok(challonge.valid && challonge.platform === 'challonge', 'Challonge subdomain URL should be detected.');
assert.equal(challonge.externalId,'community.challonge.com/rising_squadra','Challonge external ID should include subdomain and path.');

assert.equal(detectTournamentPlatform('https://start.gg.fake-site.example/tournament/test').valid,false,'Lookalike start.gg hostname must be rejected.');
assert.equal(detectTournamentPlatform('https://example.com/tournament/test').valid,false,'Unsupported providers must be rejected.');

assert.equal(isPrivateAddress('127.0.0.1'),true,'Loopback IPv4 must be blocked.');
assert.equal(isPrivateAddress('10.1.2.3'),true,'Private IPv4 must be blocked.');
assert.equal(isPrivateAddress('169.254.169.254'),true,'Link-local metadata IPv4 must be blocked.');
assert.equal(isPrivateAddress('::1'),true,'Loopback IPv6 must be blocked.');
assert.equal(isPrivateAddress('8.8.8.8'),false,'Public IPv4 must remain allowed.');
await assert.rejects(() => assertPublicNetworkTarget('https://127.0.0.1/internal'), /Internal addresses/i);
await assert.rejects(() => assertPublicNetworkTarget('http://challonge.com/test'), /Only HTTPS/i);
const externalSource=fs.readFileSync(path.join(root,'server','external-tournaments.js'),'utf8');
assert.match(externalSource,/redirect:\s*'manual'/,'External metadata fetch must manually validate every redirect.');
assert.doesNotMatch(externalSource,/redirect:\s*'follow'/,'Automatic redirect following must stay disabled.');

const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'gekishin-external-import-'));
const dbPath=path.join(tempDir,'external.sqlite');
const preloadPath=path.join(tempDir,'reject-fetch.cjs');
fs.writeFileSync(preloadPath,"global.fetch=async()=>{throw new Error('Mock metadata fetch unavailable.');};\n");
const port=3127;
const base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['server.js'],{
  cwd:root,
  env:{...process.env,NODE_ENV:'test',PORT:String(port),DATABASE_PATH:dbPath,AUTH_SECRET:'external-test-secret-32-characters-long!!',NODE_OPTIONS:`--require=${preloadPath}`,STARTGG_API_TOKEN:''},
  stdio:['ignore','pipe','pipe'],
});
let serverOutput='';
child.stdout.on('data',chunk=>{serverOutput+=chunk;});
child.stderr.on('data',chunk=>{serverOutput+=chunk;});

async function request(url,{token,method='GET',body}={}){
  const response=await fetch(`${base}${url}`,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,...(!['GET','HEAD','OPTIONS'].includes(String(method).toUpperCase())?{'X-CSRF-Token':'1'}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(`${method} ${url}: ${payload.error||response.status}`);
  return {response,payload};
}
async function waitForServer(){for(let i=0;i<80;i++){try{await request('/api/health');return;}catch{await new Promise(resolve=>setTimeout(resolve,75));}}throw new Error(`External import test server did not start.\n${serverOutput}`);}

try{
  await waitForServer();
  const registered=await request('/api/auth/register',{method:'POST',body:{username:'external_owner',displayName:'External Owner',password:'Password123!',passwordConfirmation:'Password123!'}});
  const token=registered.payload.token;
  const preview=await request('/api/tournament-import/preview',{token,method:'POST',body:{url:'https://tonamel.com/competition/UNVERIFIED-TEST'}});
  assert.equal(preview.payload.preview.syncStatus,'url_verified','Failed metadata fetch must remain importable but explicitly unverified.');
  const imported=await request('/api/tournament-import',{token,method:'POST',body:{url:'https://tonamel.com/competition/UNVERIFIED-TEST',confirmOwnership:true}});
  assert.equal(imported.response.status,201);
  assert.equal(imported.payload.requiresVerification,true,'Import response must tell the client that Host verification is required.');
  assert.equal(imported.payload.tournament.source_sync_status,'url_verified');
  assert.equal(imported.payload.tournament.unverified,true);
  const tournamentId=imported.payload.tournament.id;
  const listed=await request('/api/tournaments',{token});
  const listItem=listed.payload.tournaments.find(item=>item.id===tournamentId);
  assert.equal(listItem.unverified,true,'Tournament list must expose the unverified marker.');
  const detail=await request(`/api/tournaments/${tournamentId}`,{token});
  assert.equal(detail.payload.tournament.unverified,true,'Tournament detail must expose the unverified marker.');
  const verified=await request(`/api/tournaments/${tournamentId}/verify-source`,{token,method:'POST',body:{name:'Host Confirmed Cup',description:'Verified manually by the owner.'}});
  assert.equal(verified.payload.requiresVerification,false);
  assert.equal(verified.payload.tournament.source_sync_status,'host_confirmed');
  assert.equal(verified.payload.tournament.unverified,false);
  assert.equal(verified.payload.tournament.name,'Host Confirmed Cup');
  const verifiedDetail=await request(`/api/tournaments/${tournamentId}`,{token});
  assert.equal(verifiedDetail.payload.tournament.sourceSyncStatus,'host_confirmed');
  assert.equal(verifiedDetail.payload.tournament.unverified,false);
  const audit=await request(`/api/tournaments/${tournamentId}/audit`,{token});
  assert.ok(audit.payload.logs.some(log=>log.action==='tournament.source_verified'),'Host verification must create an audit entry.');
  console.log('External tournament URL, unverified import and Host verification tests passed.');
} finally {
  if(!child.killed)child.kill('SIGTERM');
  await new Promise(resolve=>{const timer=setTimeout(resolve,1500);child.once('exit',()=>{clearTimeout(timer);resolve();});});
  fs.rmSync(tempDir,{recursive:true,force:true});
}

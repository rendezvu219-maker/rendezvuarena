const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const port = 3121;
const base = `http://127.0.0.1:${port}`;
const dbPath = path.join(root, 'data', 'join-flow.sqlite');
for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${dbPath}${suffix}`, { force: true });

const child = spawn(process.execPath, ['server.js'], {
  cwd: root,
  env: { ...process.env, NODE_ENV:'test', PORT:String(port), DATABASE_PATH:dbPath, AUTH_SECRET:'join-flow-secret-32-characters-long!!!', ALLOW_DIRECT_HOST_REGISTRATION:'true', ALLOW_MANUAL_TOURNAMENT_CREATION:'true' },
  stdio:['ignore','pipe','pipe'],
});
child.stdout.on('data', chunk => process.stdout.write(chunk));
child.stderr.on('data', chunk => process.stderr.write(chunk));

function assert(value, message) { if (!value) throw new Error(message); }
async function request(url, { token, method='GET', body, expectError=false }={}) {
  const response = await fetch(`${base}${url}`, { method, headers:{ ...(token?{Authorization:`Bearer ${token}`}:{ }), ...(!['GET','HEAD','OPTIONS'].includes(String(method).toUpperCase())?{'X-CSRF-Token':'1'}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}) }, body:body!==undefined?JSON.stringify(body):undefined });
  const payload = await response.json().catch(()=>({}));
  if (expectError) return { response, payload };
  if (!response.ok) throw new Error(`${method} ${url}: ${payload.error || response.status}`);
  return payload;
}
async function wait() { for(let i=0;i<60;i++){try{await request('/api/health');return;}catch{await new Promise(r=>setTimeout(r,100));}}throw new Error('Server did not start.'); }

(async()=>{
  try {
    await wait();
    const host = await request('/api/auth/register',{method:'POST',body:{displayName:'Join Host',username:'joinhost',email:'joinhost@example.com',password:'Password123!',role:'host'}});
    const player = await request('/api/auth/register',{method:'POST',body:{displayName:'Join Player',username:'joinplayer',email:'joinplayer@example.com',password:'Password123!'}});
    const created = await request('/api/tournaments',{token:host.token,method:'POST',body:{name:'Join Flow Cup',status:'registration_open'}});
    const tournamentId=created.tournament.id, slug=created.tournament.slug;
    await request(`/api/tournaments/${tournamentId}/publish`,{token:host.token,method:'POST'});
    const team = (await request(`/api/tournaments/${tournamentId}/teams`,{token:host.token,method:'POST',body:{name:'Team Link',tag:'LINK'}})).team;
    const member = (await request(`/api/tournaments/${tournamentId}/teams/${team.id}/members`,{token:host.token,method:'POST',body:{displayName:'Join Player',gamerTag:'ExternalTag',memberRole:'player'}})).member;

    const options=await request(`/api/public/tournaments/${slug}/join-options`);
    assert(options.tournament.canJoin===true,'Registration-open tournament should accept account-link requests.');
    assert(options.teams.some(item=>item.id===team.id),'Public join page should list tournament teams.');

    await request(`/api/tournaments/${slug}/join-requests`,{token:player.token,method:'POST',body:{teamId:team.id,memberId:member.id,requestedRole:'player',gamerTag:'ExternalTag',message:'This is my external roster account.'}});
    let detail=await request(`/api/tournaments/${tournamentId}`,{token:host.token});
    const pending=detail.joinRequests.find(item=>item.user_id===player.user.id&&item.status==='pending');
    assert(pending,'Host should see the pending join request.');

    await request(`/api/tournaments/${tournamentId}/join-requests/${pending.id}/review`,{token:host.token,method:'POST',body:{decision:'approve',teamId:team.id}});
    const portal=await request('/api/portal',{token:player.token});
    assert(portal.teams.some(item=>item.id===team.id&&item.my_member_role==='player'),'Approved player should see the linked team in the portal.');
    const myJoin=await request(`/api/tournaments/${slug}/my-join`,{token:player.token});
    assert(myJoin.membership?.team_id===team.id,'Join page should show the approved membership.');

    console.log('Tournament join/link flow tests passed.');
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve=>child.once('exit',resolve));
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${dbPath}${suffix}`, { force:true });
  }
})().catch(error=>{console.error(error);child.kill('SIGTERM');process.exitCode=1;});

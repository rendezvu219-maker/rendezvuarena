import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const tempDir=fs.mkdtempSync(path.join(os.tmpdir(),'gekishin-dev-suite-'));
process.env.DATABASE_PATH=path.join(tempDir,'fixture.sqlite');
process.env.AUTH_SECRET='test-fixture-secret-32-characters-long';
const require=createRequire(import.meta.url);
const {db}=require('../server/db');
const {hashPassword}=require('../server/auth');
const {createTestSuite,listTestSuites,cleanupTestSuite}=require('../server/dev-test-service');
const {userTournamentHistory}=require('../server/profile-service');

try{
  const adminId=Number(db.prepare("INSERT INTO users(username,email,display_name,password_hash,role) VALUES ('fixture_admin','fixture_admin@test.local','Fixture Admin',?,'admin')").run(await hashPassword('FixturePass123!')).lastInsertRowid);
  const created=await createTestSuite(adminId);
  assert.equal(created.suite.tournaments.length,4,'suite must create four tournament scenarios');
  assert.equal(created.suite.users.length,21,'suite must create all test personas');
  assert.ok(created.password.length>=8,'shared test password is returned only at creation');
  const scenarios=Object.fromEntries(created.suite.tournaments.map(item=>[item.scenario,item]));
  assert.equal(scenarios.registration.status,'registration_open');
  assert.equal(scenarios.bracket.status,'preparing');
  assert.equal(db.prepare('SELECT COUNT(*) count FROM matches WHERE tournament_id=?').get(scenarios.bracket.id).count,0,'bracket lab starts without generated matches');
  assert.equal(scenarios.live.status,'checkin_open');
  assert.equal(scenarios.completed.status,'completed');
  assert.equal(db.prepare('SELECT COUNT(*) count FROM matches WHERE tournament_id=?').get(scenarios.live.id).count,7);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM matches WHERE tournament_id=? AND result_status='final'").get(scenarios.completed.id).count,7);
  assert.ok(created.suite.quickLinks.host.includes('/dev-access.html#code='));
  assert.ok(created.suite.quickLinks.draftTeamA.includes('/draft-room.html#room='));
  const captain=db.prepare("SELECT u.id FROM users u JOIN dev_test_suite_users su ON su.user_id=u.id WHERE su.suite_id=? AND su.persona='captain_1'").get(created.suiteId);
  const host=db.prepare("SELECT u.id FROM users u JOIN dev_test_suite_users su ON su.user_id=u.id WHERE su.suite_id=? AND su.persona='host'").get(created.suiteId);
  const captainHistory=userTournamentHistory(captain.id);
  assert.equal(captainHistory.stats.participatedCount,3);
  assert.equal(captainHistory.stats.championships,1);
  assert.equal(captainHistory.participated.find(item=>item.status==='completed').achievement.label,'Champion');
  const expectedPlacements={captain_1:'Champion',captain_2:'Runner-up',captain_3:'Top 4',captain_4:'Top 4',captain_5:'Top 8',captain_6:'Top 8',captain_7:'Top 8',captain_8:'Top 8'};
  for(const [persona,label] of Object.entries(expectedPlacements)){const user=db.prepare('SELECT u.id FROM users u JOIN dev_test_suite_users su ON su.user_id=u.id WHERE su.suite_id=? AND su.persona=?').get(created.suiteId,persona);assert.equal(userTournamentHistory(user.id).participated.find(item=>item.status==='completed').achievement.label,label,`${persona} fixture placement must remain ${label}`);}
  assert.equal(userTournamentHistory(host.id).stats.organizedCount,4);
  assert.equal(listTestSuites().length,1);
  cleanupTestSuite(created.suiteId);
  assert.equal(listTestSuites().length,0);
  assert.equal(db.prepare("SELECT COUNT(*) count FROM tournaments WHERE source_platform='test-fixture'").get().count,0);
  console.log('Dev/Test Console fixtures and profile history passed.');
} finally {
  try{db.close();}catch{}
  fs.rmSync(tempDir,{recursive:true,force:true});
}

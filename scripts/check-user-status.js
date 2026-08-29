const { connectDatabase, logSection } = require('./database-utils');

async function main() {
  const displayName = process.argv[2] || 'Yuu';
  
  console.log(`Checking user status for: ${displayName}`);
  
  try {
    const db = connectDatabase();
    
    logSection('Finding user');
    const user = db.prepare(`
      SELECT * FROM users 
      WHERE display_name LIKE ? OR username LIKE ? OR gamer_tag LIKE ?
    `).get(`%${displayName}%`, `%${displayName}%`, `%${displayName}%`);
    
    if (!user) {
      console.log(`User not found: ${displayName}`);
      process.exit(0);
    }
    
    console.log(`Found user: ${user.display_name} (ID: ${user.id}, username: ${user.username})`);
    
    logSection('Team memberships');
    const memberships = db.prepare(`
      SELECT tm.*, t.name team_name, t.tag team_tag, t.tournament_id, t.captain_user_id, t.team_status,
             tr.name tournament_name, tr.slug tournament_slug
      FROM team_members tm
      JOIN teams t ON t.id = tm.team_id
      JOIN tournaments tr ON tr.id = t.tournament_id
      WHERE tm.user_id = ? AND tm.membership_status = 'active'
      ORDER BY tm.is_captain DESC, tr.id DESC
    `).all(user.id);
    
    if (memberships.length === 0) {
      console.log('No active team memberships found');
    } else {
      console.log(`Found ${memberships.length} active team membership(s):\n`);
      memberships.forEach(m => {
        console.log(`- Team: ${m.team_name} [${m.team_tag || 'N/A'}]`);
        console.log(`  Tournament: ${m.tournament_name} (${m.tournament_slug})`);
        console.log(`  Role: ${m.member_role} (Captain: ${m.is_captain ? 'Yes' : 'No'})`);
        console.log(`  Team captain_user_id: ${m.captain_user_id || 'None'}`);
        console.log(`  Team status: ${m.team_status || 'unknown'}`);
        console.log(`  Member ID: ${m.id}`);
        console.log('');
      });
    }
    
    logSection('Join requests');
    const joinRequests = db.prepare(`
      SELECT jr.*, t.name team_name, tr.name tournament_name, tr.slug tournament_slug
      FROM tournament_join_requests jr
      LEFT JOIN teams t ON t.id = jr.team_id
      LEFT JOIN tournaments tr ON tr.id = jr.tournament_id
      WHERE jr.user_id = ?
      ORDER BY jr.id DESC
    `).all(user.id);
    
    if (joinRequests.length === 0) {
      console.log('No join requests found');
    } else {
      console.log(`Found ${joinRequests.length} join request(s):\n`);
      joinRequests.forEach(jr => {
        console.log(`- Tournament: ${jr.tournament_name} (${jr.tournament_slug})`);
        console.log(`  Status: ${jr.status}`);
        console.log(`  Requested role: ${jr.requested_role}`);
        console.log(`  Team: ${jr.team_name || 'Solo/Not specified'}`);
        console.log(`  Created: ${jr.created_at}`);
        if (jr.status === 'approved') {
          console.log(`  ⚠️  This request is APPROVED but no team membership found!`);
        }
        console.log('');
      });
    }
    
    logSection('Captain consistency check');
    memberships.forEach(m => {
      if (m.is_captain) {
        if (m.captain_user_id !== user.id) {
          console.log(`⚠️  INCONSISTENCY: User is captain in team_members but team.captain_user_id is ${m.captain_user_id}`);
        } else {
          console.log(`✓ Captain role consistent for team ${m.team_name}`);
        }
      }
    });
    
    db.close();
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
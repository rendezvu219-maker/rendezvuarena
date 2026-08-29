const { connectDatabase, confirmAction, logSection } = require('./database-utils');

async function main() {
  console.log('Finding ghost approvals (approved join requests without team membership)...');
  
  try {
    const db = connectDatabase();
    
    logSection('Finding inconsistent approvals');
    
    // Find approved join requests that don't have corresponding team membership
    const ghostApprovals = db.prepare(`
      SELECT jr.*, t.name team_name, tr.name tournament_name, tr.slug tournament_slug, tr.id tournament_id
      FROM tournament_join_requests jr
      LEFT JOIN teams t ON t.id = jr.team_id
      LEFT JOIN tournaments tr ON tr.id = jr.tournament_id
      WHERE jr.status = 'approved'
      AND jr.team_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM team_members tm 
        WHERE tm.team_id = jr.team_id 
        AND tm.user_id = jr.user_id 
        AND tm.membership_status = 'active'
      )
      ORDER BY jr.id DESC
    `).all();
    
    console.log(`Found ${ghostApprovals.length} ghost approval(s):\n`);
    
    if (ghostApprovals.length === 0) {
      console.log('No ghost approvals found. Database is consistent.');
      db.close();
      process.exit(0);
    }
    
    ghostApprovals.forEach((jr, index) => {
      console.log(`${index + 1}. User: ${jr.display_name} (ID: ${jr.user_id})`);
      console.log(`   Tournament: ${jr.tournament_name} (${jr.tournament_slug})`);
      console.log(`   Team: ${jr.team_name || 'Not specified'} (ID: ${jr.team_id})`);
      console.log(`   Requested role: ${jr.requested_role}`);
      console.log(`   Request ID: ${jr.id}`);
      console.log(`   Status: ${jr.status}`);
      console.log(`   ⚠️  No active team membership found despite approval!`);
      console.log('');
    });
    
    logSection('Available actions');
    console.log('1. Create missing team membership from join request');
    console.log('2. Revert approval to pending status');
    console.log('3. Delete the join request entirely');
    console.log('4. Do nothing (exit)');
    
    // Simple prompt for action
    const readline = require('node:readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const action = await new Promise(resolve => {
      rl.question('Choose action (1-4): ', answer => {
        rl.close();
        resolve(answer.trim());
      });
    });
    
    if (action === '1') {
      logSection('Creating team memberships from join requests');
      let fixedCount = 0;
      
      for (const jr of ghostApprovals) {
        console.log(`Processing: ${jr.display_name} for team ${jr.team_name}`);
        
        try {
          const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(jr.team_id);
          if (!team) {
            console.log(`  Skipping: Team ${jr.team_id} not found`);
            continue;
          }
          
          // Check if team has roster lock
          const effectiveLock = team.roster_locked_at || db.prepare('SELECT roster_lock_at FROM tournaments WHERE id = ?').get(jr.tournament_id)?.roster_lock_at;
          if (effectiveLock && Date.parse(effectiveLock) <= Date.now()) {
            console.log(`  Skipping: Tournament roster is locked`);
            continue;
          }
          
          // Create team member
          const insertResult = db.prepare(`
            INSERT INTO team_members (team_id, user_id, display_name, gamer_tag, game_id, member_role, is_substitute, membership_status, external_provider, external_user_id, external_profile_slug)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
          `).run(
            jr.team_id,
            jr.user_id,
            jr.display_name,
            jr.gamer_tag || '',
            jr.game_id || '',
            jr.requested_role,
            jr.requested_role === 'substitute' ? 1 : 0,
            jr.external_provider || '',
            jr.external_user_id || '',
            jr.external_profile_slug || ''
          );
          
          const memberId = Number(insertResult.lastInsertRowid);
          
          // If captain role, sync captain
          if (jr.requested_role === 'captain') {
            if (team.captain_user_id && Number(team.captain_user_id) !== Number(jr.user_id)) {
              console.log(`  Warning: Team already has captain ${team.captain_user_id}, not syncing captain role`);
            } else {
              db.prepare('UPDATE teams SET captain_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(jr.user_id, jr.team_id);
              console.log(`  Set as team captain`);
            }
          }
          
          console.log(`  ✓ Created team member (ID: ${memberId})`);
          fixedCount++;
          
        } catch (error) {
          console.log(`  ✗ Error: ${error.message}`);
        }
      }
      
      console.log(`\n=== Created ${fixedCount} team memberships ===`);
      
    } else if (action === '2') {
      logSection('Reverting approvals to pending');
      const confirmed = await confirmAction(`Revert ${ghostApprovals.length} approvals to pending?`);
      
      if (confirmed) {
        ghostApprovals.forEach(jr => {
          db.prepare(`
            UPDATE tournament_join_requests 
            SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(jr.id);
          console.log(`✓ Reverted: ${jr.display_name} (Request ID: ${jr.id})`);
        });
        console.log(`\n=== Reverted ${ghostApprovals.length} approvals to pending ===`);
      } else {
        console.log('Operation cancelled.');
      }
      
    } else if (action === '3') {
      logSection('Deleting join requests');
      const confirmed = await confirmAction(`Delete ${ghostApprovals.length} join requests?`);
      
      if (confirmed) {
        ghostApprovals.forEach(jr => {
          db.prepare('DELETE FROM tournament_join_requests WHERE id = ?').run(jr.id);
          console.log(`✓ Deleted: ${jr.display_name} (Request ID: ${jr.id})`);
        });
        console.log(`\n=== Deleted ${ghostApprovals.length} join requests ===`);
      } else {
        console.log('Operation cancelled.');
      }
      
    } else {
      console.log('No action taken.');
    }
    
    db.close();
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
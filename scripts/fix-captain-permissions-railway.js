const { connectDatabase, confirmAction, logSection, railwayVolumeMountPath, resolveDatabasePath } = require('./database-utils');

async function main() {
  console.log('Fixing captain permissions on Railway...');
  console.log('Railway volume mount path:', railwayVolumeMountPath());

  try {
    const db = connectDatabase();
    console.log('Database connected successfully');

  // Find inconsistent captain data
  logSection('Finding inconsistent captain data');

  // Case 1: Users with captain role in team_members but not as team captain_user_id
  const inconsistentCaptains = db.prepare(`
    SELECT tm.id as member_id, tm.team_id, tm.user_id, tm.display_name, tm.member_role, tm.is_captain,
           t.captain_user_id as team_captain_id, t.name as team_name
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.is_captain = 1 
    AND tm.membership_status = 'active'
    AND (tm.user_id != t.captain_user_id OR t.captain_user_id IS NULL)
  `).all();

  console.log(`Found ${inconsistentCaptains.length} inconsistent captain entries`);

  // Case 2: Duplicate user entries in same team
  const duplicateUsers = db.prepare(`
    SELECT team_id, user_id, COUNT(*) as count
    FROM team_members
    WHERE user_id IS NOT NULL AND membership_status = 'active'
    GROUP BY team_id, user_id
    HAVING COUNT(*) > 1
  `).all();

  console.log(`Found ${duplicateUsers.length} teams with duplicate user entries`);

  // Case 3: Team captains without proper team_members entry
  const orphanCaptains = db.prepare(`
    SELECT t.id as team_id, t.name as team_name, t.captain_user_id
    FROM teams t
    WHERE t.captain_user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM team_members tm 
      WHERE tm.team_id = t.id 
      AND tm.user_id = t.captain_user_id 
      AND tm.is_captain = 1 
      AND tm.membership_status = 'active'
    )
  `).all();

  console.log(`Found ${orphanCaptains.length} orphan team captains`);

  // Show summary
  const totalIssues = inconsistentCaptains.length + duplicateUsers.length + orphanCaptains.length;
  console.log(`\nTotal issues found: ${totalIssues}`);

  if (totalIssues === 0) {
    console.log('No issues found. Database is consistent.');
    db.close();
    process.exit(0);
  }

  // Ask for confirmation
  const confirmed = await confirmAction('Do you want to fix these issues?');
  if (!confirmed) {
    console.log('Operation cancelled by user.');
    db.close();
    process.exit(0);
  }

  // Fix inconsistencies
  logSection('Fixing inconsistencies');

  let fixedCount = 0;

  // Fix Case 1: Sync team captain_user_id with team_members
  inconsistentCaptains.forEach(inconsistent => {
    console.log(`Fixing: ${inconsistent.display_name} in team ${inconsistent.team_name}`);
    
    // Update team captain_user_id to match team_members
    db.prepare(`
      UPDATE teams 
      SET captain_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(inconsistent.user_id, inconsistent.team_id);
    
    fixedCount++;
  });

  // Fix Case 2: Remove duplicate user entries, keep most recent
  duplicateUsers.forEach(duplicate => {
    const entries = db.prepare(`
      SELECT * FROM team_members
      WHERE team_id = ? AND user_id = ? AND membership_status = 'active'
      ORDER BY id DESC
    `).all(duplicate.team_id, duplicate.user_id);

    if (entries.length > 1) {
      const keepEntry = entries[0];
      const deleteEntries = entries.slice(1);
      
      console.log(`Removing ${deleteEntries.length} duplicate entries for user ${duplicate.user_id} in team ${duplicate.team_id}`);
      
      deleteEntries.forEach(entry => {
        db.prepare(`DELETE FROM team_members WHERE id = ?`).run(entry.id);
      });
      
      fixedCount++;
    }
  });

  // Fix Case 3: Create proper team_members entry for orphan captains
  orphanCaptains.forEach(orphan => {
    console.log(`Creating team_members entry for orphan captain in team ${orphan.team_name}`);
    
    const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(orphan.captain_user_id);
    if (user) {
      db.prepare(`
        INSERT INTO team_members(team_id, user_id, display_name, gamer_tag, member_role, membership_status, is_captain, is_substitute)
        VALUES (?, ?, ?, ?, 'captain', 'active', 1, 0)
      `).run(orphan.team_id, orphan.captain_user_id, user.display_name, user.gamer_tag || user.username);
      
      fixedCount++;
    }
  });

  // Verify team status for all teams with captains
  console.log('\n=== Verifying team statuses ===');
  const teamsWithIssues = db.prepare(`
    SELECT t.id, t.name, t.team_status, t.status, t.captain_user_id
    FROM teams t
    WHERE t.captain_user_id IS NOT NULL
    AND (t.team_status = 'withdrawn' OR t.team_status = 'disqualified' OR t.status = 'cancelled')
  `).all();

  if (teamsWithIssues.length > 0) {
    console.log(`Found ${teamsWithIssues.length} teams with problematic statuses`);
    teamsWithIssues.forEach(team => {
      console.log(`- ${team.name} (ID: ${team.id}): team_status=${team.team_status}, status=${team.status}`);
    });
  }

  console.log(`\n=== Fixed ${fixedCount} issues ===`);
  console.log('Captain permissions fix completed successfully!');

  db.close();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
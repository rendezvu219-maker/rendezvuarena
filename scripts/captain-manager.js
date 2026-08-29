const { connectDatabase, confirmAction, validateCaptainTransfer, logSection } = require('./database-utils');

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    printUsage();
    process.exit(1);
  }

  try {
    const db = connectDatabase();
    console.log('Database connected successfully');

    switch (command) {
      case 'list':
        await listTeams(db);
        break;
      case 'check':
        await checkTeam(db, args[1]);
        break;
      case 'transfer':
        await transferCaptain(db, args[1], args[2], args[3]);
        break;
      case 'fix':
        await fixInconsistencies(db);
        break;
      case 'validate':
        await validatePermissions(db);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }

    db.close();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

function printUsage() {
  console.log(`
Captain Management Script
Usage: node captain-manager.js <command> [arguments]

Commands:
  list                    List all teams and their captains
  check <team_id>         Check captain status for a specific team
  transfer <team_id> <from_user_id> <to_user_id>
                          Transfer captain role from one user to another
  fix                     Fix captain permission inconsistencies
  validate                Validate captain permissions without making changes

Examples:
  node captain-manager.js list
  node captain-manager.js check 123
  node captain-manager.js transfer 123 456 789
  node captain-manager.js fix
  node captain-manager.js validate

Environment Variables:
  DATABASE_PATH           Path to SQLite database file
  AUTO_CONFIRM=true       Skip confirmation prompts
  `);
}

async function listTeams(db) {
  logSection('Listing all teams');
  
  const teams = db.prepare(`
    SELECT id, name, tag, captain_user_id, team_status, status
    FROM teams 
    ORDER BY name
  `).all();

  console.log(`Found ${teams.length} teams:\n`);

  teams.forEach(team => {
    const captainInfo = team.captain_user_id 
      ? `Captain ID: ${team.captain_user_id}` 
      : 'No captain assigned';
    
    const statusInfo = `Status: ${team.team_status || team.status || 'unknown'}`;
    
    console.log(`- ${team.name} (ID: ${team.id})`);
    console.log(`  Tag: ${team.tag || 'N/A'}`);
    console.log(`  ${captainInfo}`);
    console.log(`  ${statusInfo}`);
    console.log('');
  });
}

async function checkTeam(db, teamId) {
  if (!teamId) {
    console.error('Team ID is required for check command');
    process.exit(1);
  }

  logSection(`Checking team ${teamId}`);

  const team = db.prepare(`
    SELECT * FROM teams WHERE id = ?
  `).get(teamId);

  if (!team) {
    console.error(`Team with ID ${teamId} not found`);
    process.exit(1);
  }

  console.log(`Team: ${team.name} (ID: ${team.id})`);
  console.log(`Captain user_id: ${team.captain_user_id || 'None'}`);
  console.log(`Team status: ${team.team_status || team.status || 'unknown'}`);

  // Get team members
  const members = db.prepare(`
    SELECT * FROM team_members 
    WHERE team_id = ? AND membership_status = 'active'
    ORDER BY is_captain DESC, display_name
  `).all(teamId);

  console.log(`\nActive members (${members.length}):`);
  members.forEach(member => {
    const role = member.is_captain ? 'CAPTAIN' : member.member_role || 'player';
    const substitute = member.is_substitute ? ' [substitute]' : '';
    console.log(`- ${member.display_name} (${role}${substitute})`);
    console.log(`  User ID: ${member.user_id || 'Not linked'}`);
    console.log(`  Member ID: ${member.id}`);
    console.log('');
  });

  // Check for inconsistencies
  const captainMember = members.find(m => m.is_captain);
  
  if (team.captain_user_id && !captainMember) {
    console.warn('⚠️  INCONSISTENCY: Team has captain_user_id but no captain member');
  } else if (captainMember && captainMember.user_id !== team.captain_user_id) {
    console.warn('⚠️  INCONSISTENCY: Captain member user_id does not match team captain_user_id');
  } else if (!team.captain_user_id && !captainMember) {
    console.warn('⚠️  WARNING: Team has no captain assigned');
  } else {
    console.log('✓ Captain permissions are consistent');
  }
}

async function transferCaptain(db, teamId, fromUserId, toUserId) {
  if (!teamId || !fromUserId || !toUserId) {
    console.error('Team ID, from_user_id, and to_user_id are required for transfer command');
    console.log('Usage: node captain-manager.js transfer <team_id> <from_user_id> <to_user_id>');
    process.exit(1);
  }

  logSection('Captain transfer setup');

  // Get team info
  const team = db.prepare(`
    SELECT * FROM teams WHERE id = ?
  `).get(teamId);

  if (!team) {
    console.error(`Team with ID ${teamId} not found`);
    process.exit(1);
  }

  console.log(`Team: ${team.name} (ID: ${team.id})`);

  // Get from member
  const fromMember = db.prepare(`
    SELECT * FROM team_members 
    WHERE team_id = ? AND user_id = ? AND membership_status = 'active'
  `).get(teamId, fromUserId);

  if (!fromMember) {
    console.error(`Member with user_id ${fromUserId} not found in team`);
    process.exit(1);
  }

  console.log(`From: ${fromMember.display_name} (user_id: ${fromUserId})`);

  // Get to member
  const toMember = db.prepare(`
    SELECT * FROM team_members 
    WHERE team_id = ? AND user_id = ? AND membership_status = 'active'
  `).get(teamId, toUserId);

  if (!toMember) {
    console.error(`Member with user_id ${toUserId} not found in team`);
    process.exit(1);
  }

  console.log(`To: ${toMember.display_name} (user_id: ${toUserId})`);

  // Validate transfer
  const validationErrors = validateCaptainTransfer(fromMember, toMember, team);
  if (validationErrors.length > 0) {
    console.error('Validation errors:');
    validationErrors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log('Validation passed');

  // Confirm
  const confirmed = await confirmAction('Do you want to proceed with this captain transfer?');
  if (!confirmed) {
    console.log('Transfer cancelled by user.');
    process.exit(0);
  }

  // Execute transfer
  logSection('Executing captain transfer');

  db.prepare('BEGIN TRANSACTION').run();

  try {
    // Remove captain role from from member
    db.prepare(`
      UPDATE team_members 
      SET is_captain = 0, member_role = 'player', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(fromMember.id);

    // Set captain role for to member
    db.prepare(`
      UPDATE team_members 
      SET is_captain = 1, member_role = 'captain', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(toMember.id);

    // Update team captain_user_id
    db.prepare(`
      UPDATE teams 
      SET captain_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(toUserId, teamId);

    db.prepare('COMMIT').run();

    console.log('✓ Captain transfer completed successfully!');
    console.log(`New captain: ${toMember.display_name} (user_id: ${toUserId})`);
    console.log(`Previous captain is now player: ${fromMember.display_name}`);

  } catch (error) {
    db.prepare('ROLLBACK').run();
    throw error;
  }
}

async function fixInconsistencies(db) {
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

  const totalIssues = inconsistentCaptains.length + duplicateUsers.length + orphanCaptains.length;
  console.log(`\nTotal issues found: ${totalIssues}`);

  if (totalIssues === 0) {
    console.log('No issues found. Database is consistent.');
    return;
  }

  const confirmed = await confirmAction('Do you want to fix these issues?');
  if (!confirmed) {
    console.log('Operation cancelled by user.');
    return;
  }

  logSection('Fixing inconsistencies');

  let fixedCount = 0;

  // Fix Case 1: Sync team captain_user_id with team_members
  inconsistentCaptains.forEach(inconsistent => {
    console.log(`Fixing: ${inconsistent.display_name} in team ${inconsistent.team_name}`);
    
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

  console.log(`\n=== Fixed ${fixedCount} issues ===`);
  console.log('Captain permissions fix completed successfully!');
}

async function validatePermissions(db) {
  logSection('Validating captain permissions');

  const issues = [];

  // Check 1: Teams with captain_user_id but no captain member
  const teamsWithoutCaptainMember = db.prepare(`
    SELECT t.id, t.name, t.captain_user_id
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

  if (teamsWithoutCaptainMember.length > 0) {
    issues.push({
      type: 'Team has captain_user_id but no captain member',
      count: teamsWithoutCaptainMember.length,
      details: teamsWithoutCaptainMember
    });
  }

  // Check 2: Captain members with mismatched team captain_user_id
  const mismatchedCaptains = db.prepare(`
    SELECT tm.id as member_id, tm.team_id, tm.user_id, tm.display_name,
           t.captain_user_id as team_captain_id, t.name as team_name
    FROM team_members tm
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.is_captain = 1 
    AND tm.membership_status = 'active'
    AND tm.user_id != t.captain_user_id
  `).all();

  if (mismatchedCaptains.length > 0) {
    issues.push({
      type: 'Captain member user_id does not match team captain_user_id',
      count: mismatchedCaptains.length,
      details: mismatchedCaptains
    });
  }

  // Check 3: Duplicate user entries in same team
  const duplicateUsers = db.prepare(`
    SELECT team_id, user_id, COUNT(*) as count
    FROM team_members
    WHERE user_id IS NOT NULL AND membership_status = 'active'
    GROUP BY team_id, user_id
    HAVING COUNT(*) > 1
  `).all();

  if (duplicateUsers.length > 0) {
    issues.push({
      type: 'Duplicate user entries in same team',
      count: duplicateUsers.length,
      details: duplicateUsers
    });
  }

  // Check 4: Teams without any captain
  const teamsWithoutCaptain = db.prepare(`
    SELECT t.id, t.name
    FROM teams t
    WHERE NOT EXISTS (
      SELECT 1 FROM team_members tm 
      WHERE tm.team_id = t.id 
      AND tm.is_captain = 1 
      AND tm.membership_status = 'active'
    )
  `).all();

  if (teamsWithoutCaptain.length > 0) {
    issues.push({
      type: 'Teams without any captain',
      count: teamsWithoutCaptain.length,
      details: teamsWithoutCaptain
    });
  }

  if (issues.length === 0) {
    console.log('✓ No validation issues found. Captain permissions are consistent.');
  } else {
    console.log(`Found ${issues.length} types of validation issues:\n`);
    
    issues.forEach(issue => {
      console.log(`⚠️  ${issue.type} (${issue.count} occurrences)`);
      if (issue.details && issue.details.length <= 5) {
        issue.details.forEach(detail => {
          console.log(`   - ${JSON.stringify(detail)}`);
        });
      } else if (issue.details && issue.details.length > 5) {
        console.log(`   - Showing first 5 of ${issue.details.length} occurrences`);
        issue.details.slice(0, 5).forEach(detail => {
          console.log(`   - ${JSON.stringify(detail)}`);
        });
      }
      console.log('');
    });
  }
}

main();

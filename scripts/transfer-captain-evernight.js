const { connectDatabase, confirmAction, validateCaptainTransfer, logSection } = require('./database-utils');

async function main() {
  console.log('Captain transfer script for Team Evernight...');

  try {
    const db = connectDatabase();
    console.log('Database connected successfully');

  // Find Team Evernight
  const team = db.prepare(`
    SELECT * FROM teams 
    WHERE name LIKE '%Evernight%' OR tag LIKE '%Evernight%'
  `).get();

  if (!team) {
    console.error('Team Evernight not found');
    process.exit(1);
  }

  console.log('Found team:', team.name, '(ID:', team.id, ')');
  console.log('Current captain_user_id:', team.captain_user_id);

  // Find VKON member
  const vkonMember = db.prepare(`
    SELECT * FROM team_members 
    WHERE team_id = ? AND (display_name LIKE '%VKON%' OR gamer_tag LIKE '%VKON%')
  `).get(team.id);

  if (!vkonMember) {
    console.error('VKON member not found in team');
    process.exit(1);
  }

  console.log('Found VKON member:', vkonMember.display_name, '(ID:', vkonMember.id, ', user_id:', vkonMember.user_id, ')');

  // Find SonGoku Goku_VN member
  const songokuMember = db.prepare(`
    SELECT * FROM team_members 
    WHERE team_id = ? AND (display_name LIKE '%SonGoku%' OR gamer_tag LIKE '%SonGoku%' OR display_name LIKE '%Goku_VN%')
  `).get(team.id);

  if (!songokuMember) {
    console.error('SonGoku Goku_VN member not found in team');
    process.exit(1);
  }

  console.log('Found SonGoku member:', songokuMember.display_name, '(ID:', songokuMember.id, ', user_id:', songokuMember.user_id, ')');

  // Check if SonGoku is currently the captain
  if (!songokuMember.is_captain) {
    console.warn('Warning: SonGoku is not currently marked as captain (is_captain = 0)');
    console.log('Proceeding anyway with the transfer...');
  }

  // Validate the transfer
  logSection('Validating captain transfer');
  const validationErrors = validateCaptainTransfer(songokuMember, vkonMember, team);
  
  if (validationErrors.length > 0) {
    console.error('Validation errors:');
    validationErrors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }
  
  console.log('Validation passed');
  console.log(`Transfer from: ${songokuMember.display_name} (user_id: ${songokuMember.user_id})`);
  console.log(`Transfer to: ${vkonMember.display_name} (user_id: ${vkonMember.user_id})`);

  // Ask for confirmation
  const confirmed = await confirmAction('Do you want to proceed with this captain transfer?');
  if (!confirmed) {
    console.log('Transfer cancelled by user.');
    db.close();
    process.exit(0);
  }

  // Start transaction
  logSection('Starting captain transfer');
  
  // Remove captain role from SonGoku
  db.prepare(`
    UPDATE team_members 
    SET is_captain = 0, member_role = 'player', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(songokuMember.id);

  // Set VKON as captain
  db.prepare(`
    UPDATE team_members 
    SET is_captain = 1, member_role = 'captain', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(vkonMember.id);

  // Update team captain_user_id
  db.prepare(`
    UPDATE teams 
    SET captain_user_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(vkonMember.user_id, team.id);

  console.log('Captain transfer completed successfully!');
  console.log('New captain:', vkonMember.display_name, '(user_id:', vkonMember.user_id, ')');
  console.log('Previous captain is now player:', songokuMember.display_name);

  db.close();
  console.log('Database connection closed.');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
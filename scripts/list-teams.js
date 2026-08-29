const { connectDatabase, logSection } = require('./database-utils');

async function main() {
  console.log('Listing teams and members...');

  try {
    const db = connectDatabase();
    console.log('Database connected successfully');

  // List all teams
  const teams = db.prepare(`
    SELECT id, name, tag, captain_user_id 
    FROM teams 
    ORDER BY name
  `).all();

  console.log('All teams in database:');
  teams.forEach(team => {
    console.log(`- ${team.name} (tag: ${team.tag || 'N/A'}, ID: ${team.id}, captain_user_id: ${team.captain_user_id})`);
  });

  // Search for teams containing "Evernight" or similar
  const evernightTeams = teams.filter(t => 
    t.name.toLowerCase().includes('evernight') || 
    (t.tag && t.tag.toLowerCase().includes('evernight'))
  );

  if (evernightTeams.length > 0) {
    console.log('\nFound teams matching "Evernight":');
    evernightTeams.forEach(team => {
      console.log(`- ${team.name} (ID: ${team.id})`);
    });
  }

  // Search for VKON and SonGoku in all team members
  console.log('\nSearching for VKON in team members:');
  const vkonMembers = db.prepare(`
    SELECT tm.*, t.name as team_name 
    FROM team_members tm 
    JOIN teams t ON t.id = tm.team_id 
    WHERE tm.display_name LIKE '%VKON%' OR tm.gamer_tag LIKE '%VKON%'
  `).all();

  vkonMembers.forEach(member => {
    console.log(`- ${member.display_name} in team: ${member.team_name} (team_id: ${member.team_id}, member_id: ${member.id}, user_id: ${member.user_id})`);
  });

  console.log('\nSearching for SonGoku/Goku_VN in team members:');
  const songokuMembers = db.prepare(`
    SELECT tm.*, t.name as team_name 
    FROM team_members tm 
    JOIN teams t ON t.id = tm.team_id 
    WHERE tm.display_name LIKE '%SonGoku%' OR tm.gamer_tag LIKE '%SonGoku%' OR tm.display_name LIKE '%Goku_VN%'
  `).all();

  songokuMembers.forEach(member => {
    console.log(`- ${member.display_name} in team: ${member.team_name} (team_id: ${member.team_id}, member_id: ${member.id}, user_id: ${member.user_id})`);
  });

  db.close();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
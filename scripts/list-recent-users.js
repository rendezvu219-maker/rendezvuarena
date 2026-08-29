const { connectDatabase, logSection } = require('./database-utils');

async function main() {
  console.log('Listing recent users...');
  
  try {
    const db = connectDatabase();
    
    logSection('Recent users');
    const users = db.prepare(`
      SELECT id, username, display_name, gamer_tag, email, created_at, is_active
      FROM users 
      ORDER BY created_at DESC
      LIMIT 20
    `).all();
    
    console.log(`Found ${users.length} recent users:\n`);
    users.forEach(user => {
      console.log(`- ${user.display_name || user.username} (ID: ${user.id})`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Gamer tag: ${user.gamer_tag || 'N/A'}`);
      console.log(`  Email: ${user.email || 'N/A'}`);
      console.log(`  Active: ${user.is_active ? 'Yes' : 'No'}`);
      console.log(`  Created: ${user.created_at}`);
      console.log('');
    });
    
    db.close();
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
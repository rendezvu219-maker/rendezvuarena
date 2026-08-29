const { connectDatabase, logSection } = require('./database-utils');

async function main() {
  const searchTerm = process.argv[2] || '';
  
  if (!searchTerm) {
    console.log('Usage: node search-user.js <search_term>');
    console.log('Searches for users by display_name, username, or gamer_tag');
    process.exit(1);
  }
  
  console.log(`Searching for users matching: ${searchTerm}`);
  
  try {
    const db = connectDatabase();
    
    logSection('User search results');
    const users = db.prepare(`
      SELECT id, username, display_name, gamer_tag, email, created_at, is_active
      FROM users 
      WHERE display_name LIKE ? OR username LIKE ? OR gamer_tag LIKE ? OR email LIKE ?
      ORDER BY created_at DESC
      LIMIT 10
    `).all(`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`);
    
    if (users.length === 0) {
      console.log('No users found matching the search term.');
    } else {
      console.log(`Found ${users.length} user(s):\n`);
      users.forEach(user => {
        console.log(`- ${user.display_name || user.username} (ID: ${user.id})`);
        console.log(`  Username: ${user.username}`);
        console.log(`  Gamer tag: ${user.gamer_tag || 'N/A'}`);
        console.log(`  Email: ${user.email || 'N/A'}`);
        console.log(`  Active: ${user.is_active ? 'Yes' : 'No'}`);
        console.log(`  Created: ${user.created_at}`);
        console.log('');
      });
    }
    
    db.close();
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
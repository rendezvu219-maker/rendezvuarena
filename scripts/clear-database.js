const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = process.env.DATABASE_PATH || './data/rendezvu-arena.sqlite';

console.log('Clearing database data while preserving structure...');

try {
  if (!fs.existsSync(dbPath)) {
    console.log('Database file does not exist. Nothing to clear.');
    process.exit(0);
  }

  const db = new DatabaseSync(dbPath);
  
  // Get all table names
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  
  console.log(`Found ${tables.length} tables to clear.`);
  
  // Clear each table while preserving structure
  for (const table of tables) {
    const tableName = table.name;
    try {
      db.prepare(`DELETE FROM ${tableName}`).run();
      console.log(`✓ Cleared table: ${tableName}`);
    } catch (error) {
      console.log(`✗ Failed to clear table ${tableName}: ${error.message}`);
    }
  }
  
  // Reset autoincrement sequences
  db.prepare("DELETE FROM sqlite_sequence").run();
  console.log('✓ Reset autoincrement sequences');
  
  db.close();
  
  console.log('Database cleared successfully!');
  console.log('Database structure preserved.');
  console.log('All test data removed.');
  
} catch (error) {
  console.error('Error clearing database:', error.message);
  process.exit(1);
}
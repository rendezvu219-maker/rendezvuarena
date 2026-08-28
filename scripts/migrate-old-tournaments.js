const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

// Database setup
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'rendezvu-arena.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');

console.log('Starting migration for old tournaments...');

try {
  // Check if migration needed
  const schemaVersion = db.prepare('SELECT value FROM app_meta WHERE key = ?').get('schema_version');
  const currentVersion = schemaVersion ? Number(schemaVersion.value) : 0;
  
  if (currentVersion >= 1) {
    console.log('Migration already completed (version ' + currentVersion + ').');
    process.exit(0);
  }

  console.log('Current schema version:', currentVersion);
  console.log('Updating to version 1...');

  // Migration tasks
  let updatedCount = 0;

  // 1. Ensure all team_members have proper member_role and is_captain flags
  console.log('Updating team_members table...');
  const memberUpdate = db.prepare(`
    UPDATE team_members 
    SET member_role = CASE 
      WHEN is_captain = 1 THEN 'captain' 
      ELSE 'player' 
    END,
    membership_status = CASE 
      WHEN membership_status IS NULL OR membership_status = '' THEN 'active' 
      ELSE membership_status 
    END
    WHERE member_role IS NULL OR member_role = ''
  `);
  memberUpdate.run();
  updatedCount += memberUpdate.changes;

  // 2. Ensure all teams have proper team_status
  console.log('Updating teams table...');
  const teamUpdate = db.prepare(`
    UPDATE teams 
    SET team_status = CASE 
      WHEN team_status IS NULL OR team_status = '' THEN 'ready' 
      ELSE team_status 
    END
    WHERE team_status IS NULL OR team_status = ''
  `);
  teamUpdate.run();
  updatedCount += teamUpdate.changes;

  // 3. Ensure all tournaments have proper status values
  console.log('Updating tournaments table...');
  const tournamentUpdate = db.prepare(`
    UPDATE tournaments 
    SET status = CASE 
      WHEN status IS NULL OR status = '' THEN 'preparing' 
      ELSE status 
    END
    WHERE status IS NULL OR status = ''
  `);
  tournamentUpdate.run();
  updatedCount += tournamentUpdate.changes;

  // 4. Add missing columns if they don't exist (for future compatibility)
  try {
    db.exec(`ALTER TABLE teams ADD COLUMN formation_source TEXT DEFAULT 'manual'`);
    console.log('Added formation_source column to teams');
  } catch (e) {
    // Column already exists, that's fine
  }

  try {
    db.exec(`ALTER TABLE teams ADD COLUMN roster_private INTEGER DEFAULT 0`);
    console.log('Added roster_private column to teams');
  } catch (e) {
    // Column already exists, that's fine
  }

  try {
    db.exec(`ALTER TABLE teams ADD COLUMN roster_locked_at TEXT`);
    console.log('Added roster_locked_at column to teams');
  } catch (e) {
    // Column already exists, that's fine
  }

  try {
    db.exec(`ALTER TABLE teams ADD COLUMN tournament_roster_lock_at TEXT`);
    console.log('Added tournament_roster_lock_at column to teams');
  } catch (e) {
    // Column already exists, that's fine
  }

  // 5. Update schema version
  db.prepare(`
    INSERT INTO app_meta(key, value, updated_at) 
    VALUES ('schema_version', '1', CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = '1', updated_at = CURRENT_TIMESTAMP
  `).run();

  console.log('Migration completed successfully!');
  console.log('Total updates performed:', updatedCount);
  console.log('Schema version updated to: 1');

} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
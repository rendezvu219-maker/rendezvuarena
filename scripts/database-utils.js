const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

/**
 * Database utilities for captain management scripts
 */

function railwayVolumeMountPath() {
  return String(process.env.RAILWAY_VOLUME_MOUNT_PATH || '').trim();
}

function resolveDatabasePath() {
  const mountPath = railwayVolumeMountPath();
  return path.resolve(
    process.env.DATABASE_PATH || 
    (mountPath ? path.join(mountPath, 'rendezvu-arena.sqlite') : './data/rendezvu-arena.sqlite')
  );
}

function connectDatabase(dbPath) {
  const resolvedPath = dbPath || resolveDatabasePath();
  
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Database file not found: ${resolvedPath}`);
  }
  
  return new DatabaseSync(resolvedPath);
}

function confirmAction(message) {
  if (process.env.AUTO_CONFIRM === 'true') {
    return true;
  }
  
  process.stdout.write(`${message} (y/N): `);
  const readline = require('node:readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('', (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

function validateCaptainTransfer(fromMember, toMember, team) {
  const errors = [];
  
  if (!fromMember || !fromMember.user_id) {
    errors.push('Current captain must have a linked user account');
  }
  
  if (!toMember || !toMember.user_id) {
    errors.push('New captain must have a linked user account');
  }
  
  if (!team) {
    errors.push('Team not found');
  }
  
  if (fromMember && toMember && fromMember.user_id === toMember.user_id) {
    errors.push('Cannot transfer captain to the same user');
  }
  
  return errors;
}

function logSection(title) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(50));
}

module.exports = {
  railwayVolumeMountPath,
  resolveDatabasePath,
  connectDatabase,
  confirmAction,
  validateCaptainTransfer,
  logSection
};

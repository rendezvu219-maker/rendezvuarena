import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const { resolveDatabasePath, resolveUploadPath } = require('../server/storage-paths.js');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const railway = JSON.parse(fs.readFileSync(path.join(root, 'railway.json'), 'utf8'));

assert.equal(packageJson.scripts.start, 'node server.js');
assert.equal(railway.deploy.startCommand, 'npm start');
assert.equal(railway.deploy.healthcheckPath, '/api/health');
assert.equal(railway.deploy.overlapSeconds, 0);

const previous = { ...process.env };
try {
  delete process.env.DATABASE_PATH;
  delete process.env.UPLOAD_PATH;
  process.env.RAILWAY_VOLUME_MOUNT_PATH = '/data';
  assert.equal(resolveDatabasePath(), path.resolve('/data/rendezvu-arena.sqlite'));
  assert.equal(resolveUploadPath(), path.resolve('/data/uploads'));

  process.env.DATABASE_PATH = '/custom/db.sqlite';
  process.env.UPLOAD_PATH = '/custom/uploads';
  assert.equal(resolveDatabasePath(), path.resolve('/custom/db.sqlite'));
  assert.equal(resolveUploadPath(), path.resolve('/custom/uploads'));
} finally {
  process.env = previous;
}

const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
assert.match(serverSource, /server\.listen\(port,\s*'0\.0\.0\.0'/);
assert.match(serverSource, /\/api\/public\/site-config/);
for (const name of ['copyright.html', 'privacy.html', 'terms.html', 'support-development.html']) {
  assert.ok(fs.existsSync(path.join(root, name)), `${name} must exist`);
}
console.log('Railway deployment regression checks passed.');

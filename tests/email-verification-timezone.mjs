import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'gekishin-email-timezone-'));
process.env.TZ='Asia/Ho_Chi_Minh';
process.env.DATABASE_PATH=path.join(tempRoot,'timezone.sqlite');
process.env.AUTH_SECRET='email-timezone-auth-secret-2026-strong';
process.env.EMAIL_CODE_SECRET='email-timezone-code-secret-2026-strong';
process.env.EMAIL_DELIVERY_MODE='memory';

const require=createRequire(import.meta.url);
const { parseStoredTimestamp }=require('../server/email-verification-service.js');
const { db }=require('../server/db.js');

try{
  assert.equal(
    parseStoredTimestamp('2026-07-31 08:00:00'),
    Date.parse('2026-07-31T08:00:00Z'),
    'SQLite CURRENT_TIMESTAMP text must be interpreted as UTC, even on a UTC+7 Windows machine.',
  );
  const future=new Date(Date.now()+60_000).toISOString();
  assert.ok(parseStoredTimestamp(future)>Date.now(),'ISO OTP expiry must remain active.');
  console.log('Email verification timestamp timezone regression checks passed.');
}finally{
  db.close();
  fs.rmSync(tempRoot,{recursive:true,force:true});
}

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { db } = require('./db');
const { resolveUploadPath } = require('./storage-paths');

const uploadRoot = resolveUploadPath();
fs.mkdirSync(uploadRoot, { recursive: true });
const MAX_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 3 * 1024 * 1024);
const ALLOWED_MIME = new Set(['image/png','image/jpeg','image/webp','image/gif','application/pdf','text/plain']);
const EXTENSIONS = {'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','image/gif':'.gif','application/pdf':'.pdf','text/plain':'.txt'};

function decodeBase64Strict(value) {
  const text = String(value || '').trim();
  const comma = text.indexOf(',');
  const encoded = (comma >= 0 ? text.slice(comma + 1) : text).replace(/\s+/g, '');
  if (!encoded || encoded.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) {
    throw new Error('Invalid base64 file data.');
  }
  const buffer = Buffer.from(encoded, 'base64');
  const normalizedInput = encoded.replace(/=+$/,'');
  const normalizedOutput = buffer.toString('base64').replace(/=+$/,'');
  if (!buffer.length || normalizedInput !== normalizedOutput) throw new Error('Invalid base64 file data.');
  return buffer;
}

function startsWith(buffer, bytes) {
  return buffer.length >= bytes.length && bytes.every((value,index)=>buffer[index]===value);
}

function detectedMime(buffer) {
  if (startsWith(buffer,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])) return 'image/png';
  if (startsWith(buffer,[0xff,0xd8,0xff])) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.subarray(0,4).toString('ascii')==='RIFF' && buffer.subarray(8,12).toString('ascii')==='WEBP') return 'image/webp';
  const gif = buffer.subarray(0,6).toString('ascii');
  if (gif==='GIF87a'||gif==='GIF89a') return 'image/gif';
  if (buffer.subarray(0,5).toString('ascii')==='%PDF-') return 'application/pdf';
  if (!buffer.includes(0x00)) {
    const decoded=buffer.toString('utf8');
    if (!decoded.includes('\uFFFD')) return 'text/plain';
  }
  return 'application/octet-stream';
}

function assertMimeMatches(buffer, declaredMime) {
  const actual = detectedMime(buffer);
  if (actual !== declaredMime) {
    throw new Error(`File content does not match declared MIME type (${declaredMime}).`);
  }
  return actual;
}

function retentionFor(tournament, purpose) {
  const days = purpose === 'chat_attachment' ? Number(tournament.chat_retention_days || 30) : Number(tournament.evidence_retention_days || 90);
  if (!tournament.finalized_at) return { days, expiresAt: null };
  const expires = new Date(Date.parse(tournament.finalized_at) + days * 86400000);
  return { days, expiresAt: Number.isNaN(expires.getTime()) ? null : expires.toISOString() };
}

function saveFile({userId,tournamentId,entityType,entityId,purpose='evidence',originalName,mimeType,dataBase64,visibility}) {
  mimeType = String(mimeType || '').toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) throw new Error('Unsupported file type. Use PNG, JPG, WEBP, GIF, PDF or TXT.');
  const buffer = decodeBase64Strict(dataBase64);
  if (buffer.length > MAX_BYTES) throw new Error(`File is too large. Maximum is ${Math.floor(MAX_BYTES/1024/1024)} MB.`);
  assertMimeMatches(buffer,mimeType);
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id=?').get(tournamentId);
  if (!tournament) throw new Error('Tournament not found.');
  const key = `${crypto.randomUUID()}${EXTENSIONS[mimeType] || ''}`;
  const fullPath = path.resolve(uploadRoot, key);
  if (!fullPath.startsWith(`${uploadRoot}${path.sep}`)) throw new Error('Invalid storage path.');
  fs.writeFileSync(fullPath, buffer, { flag: 'wx', mode: 0o600 });
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
  const retention = retentionFor(tournament,purpose);
  const effectiveVisibility = visibility || (purpose === 'chat_attachment' ? 'match_members' : 'staff_only');
  try {
    const result = db.prepare(`INSERT INTO files(uploader_user_id,storage_key,original_name,mime_type,size_bytes,visibility,retention_policy,retention_anchor,expires_at,checksum) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(userId,key,String(originalName||'upload').replace(/[\u0000-\u001f\u007f]/g,'').slice(0,180),mimeType,buffer.length,effectiveVisibility,purpose,'tournament_final',retention.expiresAt,checksum);
    const fileId = Number(result.lastInsertRowid);
    db.prepare('INSERT INTO file_links(file_id,entity_type,entity_id,purpose) VALUES (?,?,?,?)').run(fileId,entityType,entityId,purpose);
    return db.prepare('SELECT * FROM files WHERE id=?').get(fileId);
  } catch (error) {
    fs.rmSync(fullPath,{force:true});
    throw error;
  }
}

function fileRecord(fileId) {
  return db.prepare(`SELECT f.*,fl.entity_type,fl.entity_id,fl.purpose FROM files f LEFT JOIN file_links fl ON fl.file_id=f.id WHERE f.id=? AND f.deleted_at IS NULL`).get(fileId);
}

function filePath(record) {
  if (!record) return null;
  const resolved = path.resolve(uploadRoot, String(record.storage_key || ''));
  return resolved.startsWith(`${uploadRoot}${path.sep}`) ? resolved : null;
}

function refreshTournamentRetention(tournamentId) {
  const tournament = db.prepare('SELECT * FROM tournaments WHERE id=?').get(tournamentId);
  if (!tournament?.finalized_at) return 0;
  const files = db.prepare(`SELECT DISTINCT f.id,fl.purpose FROM files f JOIN file_links fl ON fl.file_id=f.id
    WHERE f.deleted_at IS NULL AND (
      (fl.entity_type='match' AND fl.entity_id IN (SELECT id FROM matches WHERE tournament_id=?))
      OR (fl.entity_type='dispute' AND fl.entity_id IN (SELECT d.id FROM disputes d JOIN matches m ON m.id=d.match_id WHERE m.tournament_id=?))
      OR (fl.entity_type='match_chat_message' AND fl.entity_id IN (SELECT mm.id FROM match_messages mm JOIN matches m ON m.id=mm.match_id WHERE m.tournament_id=?))
    )`).all(tournamentId,tournamentId,tournamentId);
  const update = db.prepare('UPDATE files SET expires_at=? WHERE id=? AND legal_hold=0');
  for (const file of files) update.run(retentionFor(tournament,file.purpose).expiresAt,file.id);
  return files.length;
}

function cleanupExpiredFiles() {
  const expired = db.prepare(`SELECT * FROM files WHERE deleted_at IS NULL AND legal_hold=0 AND expires_at IS NOT NULL AND datetime(expires_at)<=datetime('now')`).all();
  for (const file of expired) {
    db.prepare('UPDATE files SET deleted_at=CURRENT_TIMESTAMP WHERE id=?').run(file.id);
    const full = filePath(file);
    if (full) fs.rmSync(full,{force:true});
  }
  return expired.length;
}

module.exports = {
  ALLOWED_MIME, MAX_BYTES, assertMimeMatches, cleanupExpiredFiles, decodeBase64Strict, detectedMime,
  filePath, fileRecord, refreshTournamentRetention, saveFile, uploadRoot,
};

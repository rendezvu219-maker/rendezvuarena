const path = require('node:path');

function railwayVolumeMountPath() {
  return String(process.env.RAILWAY_VOLUME_MOUNT_PATH || '').trim();
}

function resolveDatabasePath() {
  const mountPath = railwayVolumeMountPath();
  return path.resolve(process.env.DATABASE_PATH || (mountPath ? path.join(mountPath, 'rendezvu-arena.sqlite') : './data/rendezvu-arena.sqlite'));
}

function resolveUploadPath() {
  const mountPath = railwayVolumeMountPath();
  return path.resolve(process.env.UPLOAD_PATH || (mountPath ? path.join(mountPath, 'uploads') : './data/uploads'));
}

module.exports = { railwayVolumeMountPath, resolveDatabasePath, resolveUploadPath };

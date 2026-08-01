const crypto = require('node:crypto');
const { db } = require('./db');
const { tokenHash } = require('./auth');

const TICKET_TTL_MS = 5 * 60 * 1000;

function issueDraftSocketTicket({ roomId, role, userId = null }) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + TICKET_TTL_MS).toISOString();
  db.prepare(`INSERT INTO draft_socket_tickets(token_hash,draft_room_id,role,user_id,expires_at)
    VALUES (?,?,?,?,?)`).run(tokenHash(token), roomId, role, userId, expiresAt);
  return { token, expiresAt };
}

function consumeDraftSocketTicket(token) {
  if (!token) return null;
  const row = db.prepare(`SELECT t.*,dr.room_code,dr.match_id,m.tournament_id
    FROM draft_socket_tickets t
    JOIN draft_rooms dr ON dr.id=t.draft_room_id
    JOIN matches m ON m.id=dr.match_id
    WHERE t.token_hash=? AND t.used_at IS NULL AND datetime(t.expires_at)>datetime('now') LIMIT 1`).get(tokenHash(token));
  if (!row) return null;
  const used = db.prepare(`UPDATE draft_socket_tickets SET used_at=CURRENT_TIMESTAMP
    WHERE id=? AND used_at IS NULL`).run(row.id);
  if (!used.changes) return null;
  return row;
}

function purgeExpiredDraftTickets() {
  return Number(db.prepare(`DELETE FROM draft_socket_tickets
    WHERE datetime(expires_at)<=datetime('now') OR used_at IS NOT NULL`).run().changes || 0);
}

module.exports = { TICKET_TTL_MS, consumeDraftSocketTicket, issueDraftSocketTicket, purgeExpiredDraftTickets };

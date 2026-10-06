// Public bracket relay. Only a read-only snapshot crosses this connection.
export class TournamentBracketSync {
  constructor({ id, host = false, onSnapshot, onStatus, PeerClass = window.Peer }) {
    Object.assign(this, { id, host, onSnapshot, onStatus, PeerClass });
    this.clients = new Set(); this.snapshot = null; this.closed = false;
  }
  connect() {
    if (!this.PeerClass) throw new Error('PeerJS could not load. Reload this bracket page.');
    const peerId = `rv-bracket-${this.id.toLowerCase()}`;
    this.peer = this.host ? new this.PeerClass(peerId, { debug: 1 }) : new this.PeerClass({ debug: 1 });
    this.peer.on('open', () => {
      if (!this.closed) { if (this.host) this.onStatus?.('live'); else this.connectViewer(peerId); }
    });
    this.peer.on('disconnected', () => { if (!this.closed) this.peer.reconnect(); });
    this.peer.on('error', error => {
      this.onStatus?.(error.type === 'unavailable-id' ? 'Another organizer bracket tab is already open.' : 'Waiting for the organizer bracket connection…');
      if (!this.host) this.retry(peerId);
    });
    if (this.host) this.peer.on('connection', conn => {
      conn.on('open', () => { this.clients.add(conn); if (this.snapshot) conn.send(this.snapshot); });
      conn.on('close', () => this.clients.delete(conn));
      conn.on('error', () => this.clients.delete(conn));
      // No data handler: spectators cannot submit commands or results.
    });
    return this;
  }
  connectViewer(peerId) {
    this.conn?.close();
    this.conn = this.peer.connect(peerId, { reliable: true });
    this.conn.on('data', snapshot => {
      if (snapshot?.type !== 'bracket' || snapshot?.config?.id !== this.id || !Array.isArray(snapshot.config.teams)) return;
      this.onSnapshot?.(snapshot); this.onStatus?.('live');
    });
    this.conn.on('close', () => this.retry(peerId));
    this.conn.on('error', () => this.retry(peerId));
  }
  retry(peerId) {
    if (this.closed || this.retryTimer) return;
    this.retryTimer = setTimeout(() => { this.retryTimer = null; if (!this.closed && !this.peer.destroyed) this.connectViewer(peerId); }, 3000);
  }
  publish(config, events) {
    if (!this.host) return;
    this.snapshot = { type: 'bracket', config: { id: config.id, name: config.name,
      teams: config.teams, rules: config.rules, roomIds: config.roomIds,
      spectatorLinks: config.spectatorLinks || {}, createdAt: config.createdAt }, events };
    for (const conn of this.clients) { if (conn.open) conn.send(this.snapshot); }
  }
  disconnect() {
    this.closed = true; clearTimeout(this.retryTimer); this.conn?.close(); this.peer?.destroy(); this.clients.clear();
  }
}

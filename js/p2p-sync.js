// P2P Synchronization Adapter for RendezVu Arena Draft Room
// Uses the same WebRTC handshake for same-browser tabs and remote browsers.
// Zero-backend: 100% client-side, runs entirely on GitHub Pages without server or accounts.

import { p2pDraftLinks } from './draft-links.js';
// Keep the bundled PeerJS ICE defaults, including TURN relay support.

export class P2PDraftSync {
  constructor({ roomCode, role = 'host', hostPeerId = null, accessToken = '', config = null,
    connectTimeoutMs = 30000, retryDelayMs = 1500, attemptTimeoutMs = 10000 }) {
    this.roomCode = String(roomCode || '').toUpperCase();
    this.role = role || 'host';
    this.hostPeerId = hostPeerId || `rv-${this.roomCode.toLowerCase()}`;
    this.accessToken = String(accessToken || '');
    this.config = config;
    this.isAuthority = (this.role === 'host');
    this.authorityRole = 'host';
    this.presence = { host: 0, teamA: 0, teamB: 0, referee: 0, broadcaster: 0 };
    this.initialState = null;
    this.initialMessages = [];
    this.listeners = new Map();
    this.peer = null;
    this.hostConn = null;
    this.clientConns = new Set();
    this.shareLinks = {};
    this.manualClose = false;
    this.connectTimeoutMs = connectTimeoutMs;
    this.retryDelayMs = retryDelayMs;
    this.attemptTimeoutMs = attemptTimeoutMs;
    this.retryTimer = null;
    this.attemptTimer = null;
    this.startupTimer = null;
    this.storageKey = `gs-quick-draft-state:${this.roomCode}`;
    this.messagesKey = `gs-quick-draft-chat:${this.roomCode}`;
  }

  getPeerClass() {
    if (typeof window !== 'undefined' && window.Peer) return window.Peer;
    return null;
  }

  on(type, callback) {
    const callbacks = this.listeners.get(type) || [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
    return () => this.off(type, callback);
  }

  off(type, callback) {
    const callbacks = this.listeners.get(type) || [];
    this.listeners.set(type, callbacks.filter(item => item !== callback));
  }

  emitLocal(type, data) {
    (this.listeners.get(type) || []).forEach(callback => {
      try { callback(data); } catch (err) { console.error(`[P2P listener error for ${type}]:`, err); }
    });
  }

  broadcast(payload) {
    // Every participant receives authoritative state through WebRTC.
    const json = JSON.stringify(payload);
    for (const conn of this.clientConns) {
      if (conn.open) {
        try { conn.send(json); } catch (err) { console.warn('[P2P WebRTC broadcast error]:', err); }
      }
    }
  }


  async connect() {
    if (this.isAuthority) {
      return this.connectAsHost();
    } else {
      return this.connectAsClient();
    }
  }

  async connectAsHost() {
    if (!this.config) {
      try {
        const stored = localStorage.getItem(`rv_config_${this.roomCode}`);
        if (stored) this.config = JSON.parse(stored);
      } catch {}
    }
    if (!this.config) throw new Error('Host configuration is missing. Open the Host link in the browser that created this Quick Draft.');
    const access = JSON.parse(localStorage.getItem(`rv_secrets_${this.roomCode}`) || '{}');
    if (!access.host || access.host !== this.accessToken) throw new Error('Invalid Host link. Open the original Host link from Quick Draft.');
    this.shareLinks = p2pDraftLinks(window.location.href, this.roomCode, this.hostPeerId, access);
    try {
      this.initialState = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
    } catch {
      this.initialState = null;
    }
    try {
      this.initialMessages = JSON.parse(localStorage.getItem(this.messagesKey) || '[]');
    } catch {
      this.initialMessages = [];
    }

    this.presence.host = 1;

    const PeerClass = this.getPeerClass();
    if (!PeerClass) {
      throw new Error('PeerJS could not load. Reload this page; remote teams cannot connect without it.');
    }

    return new Promise((resolve, reject) => {
      this.startupTimer = setTimeout(() => {
        this.disconnect();
        reject(new Error('Could not start the Quick Draft Host connection. Check access to PeerJS and WebRTC, then retry.'));
      }, this.connectTimeoutMs);

      try {
        this.peer = new PeerClass(this.hostPeerId, {
          debug: 1,
        });

        this.peer.on('open', id => {
          clearTimeout(this.startupTimer);
          console.log('[P2P Host] Initialized with peer ID:', id);
          this.emitLocal('connection', { status: 'connected' });
          this.emitLocal('authority', { role: 'host', isAuthority: true });
          this.emitLocal('presence', { presence: { ...this.presence } });
          resolve(this);
        });

        this.peer.on('error', err => {
          console.warn('[P2P Host Peer Warning]:', err);
          clearTimeout(this.startupTimer);
          const error = new Error(err.type === 'unavailable-id'
            ? 'This Host room is already open. Keep only one Host tab open.'
            : `Could not connect the Host to PeerJS: ${err.message || err.type}`);
          this.emitLocal('error', error);
          reject(error);
        });
        this.peer.on('disconnected', () => this.scheduleReconnect());

        this.peer.on('connection', conn => {
          let clientRole = null;

          conn.on('data', raw => {
            try {
              const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
              if (msg.kind === 'hello') {
                if (clientRole) return;
                if (!['teamA', 'teamB', 'broadcaster'].includes(msg.role) || !access[msg.role] || msg.accessToken !== access[msg.role]) {
                  conn.send(JSON.stringify({ kind:'error', message:'Invalid team link. Copy a fresh link from the Host room.' }));
                  conn.close();
                  return;
                }
                clientRole = msg.role;
                this.clientConns.add(conn);
                this.presence[clientRole] = (this.presence[clientRole] || 0) + 1;
                this.broadcast({ kind: 'presence', presence: { ...this.presence } });
                this.emitLocal('presence', { presence: { ...this.presence } });
                conn.send(JSON.stringify({ kind:'init', config:this.config, state:this.initialState,
                  messages:this.initialMessages, presence:{ ...this.presence } }));
              } else if (msg.kind === 'command') {
                if (!['teamA', 'teamB'].includes(clientRole)) return;
                this.emitLocal('command', {
                  action: msg.action,
                  data: msg.data || {},
                  fromRole: clientRole,
                });
              } else if (msg.kind === 'chat') {
                if (!clientRole) return;
                const chatMsg = msg.message;
                this.initialMessages.push(chatMsg);
                this.initialMessages = this.initialMessages.slice(-100);
                try { localStorage.setItem(this.messagesKey, JSON.stringify(this.initialMessages)); } catch {}
                this.broadcast({ kind: 'chat', message: chatMsg });
                this.emitLocal('chat', chatMsg);
              }
            } catch (err) {
              console.error('[P2P Host msg error]:', err);
            }
          });

          conn.on('close', () => {
            this.clientConns.delete(conn);
            if (!clientRole) return;
            this.presence[clientRole] = Math.max(0, (this.presence[clientRole] || 1) - 1);
            this.broadcast({ kind: 'presence', presence: { ...this.presence } });
            this.emitLocal('presence', { presence: { ...this.presence } });
          });
        });
      } catch (err) {
        console.warn('[P2P Host peer instantiation failed]:', err);
        clearTimeout(this.startupTimer);
        this.disconnect();
        reject(err);
      }
    });
  }

  async connectAsClient() {
    if (!['teamA', 'teamB', 'broadcaster'].includes(this.role) || !this.accessToken)
      throw new Error('Incomplete team link. Copy a fresh Team link from the Host room.');
    const PeerClass = this.getPeerClass();
    if (!PeerClass) throw new Error('PeerJS could not load. Reload this page before joining Quick Draft.');

    // Receiving an actual Host snapshot is the only successful join condition.
    // A local cache or elapsed timeout must never create an independent room.
    return new Promise((resolve, reject) => {
      this.finishConnect = () => {
        if (!this.config) return;
        clearTimeout(this.startupTimer);
        clearTimeout(this.attemptTimer);
        this.finishConnect = null;
        this.rejectConnect = null;
        resolve(this);
      };
      this.rejectConnect = reject;
      this.startupTimer = setTimeout(() => {
        this.disconnect();
        reject(new Error('Could not connect to the Quick Draft Host. Keep the Host tab open, then retry this link. Check whether the browser/network blocks WebRTC or PeerJS. This is a connection failure, not a missing opponent.'));
      }, this.connectTimeoutMs);
      try {
        this.peer = new PeerClass({ debug:1 });
        this.peer.on('open', () => this.attemptHostConnection());
        this.peer.on('disconnected', () => this.scheduleReconnect());
        this.peer.on('error', err => {
          if (this.manualClose) return;
          if (['peer-unavailable', 'network', 'disconnected', 'socket-error', 'socket-closed'].includes(err.type)) {
            if (!this.hostConn?.open) this.dropHostConnection();
            this.scheduleReconnect();
          } else {
            this.emitLocal('error', { message:err.message || String(err) });
            this.disconnect();
            reject(err);
          }
        });
      } catch (err) { this.disconnect(); reject(err); }
    });
  }

  dropHostConnection() {
    clearTimeout(this.attemptTimer);
    const old = this.hostConn;
    this.hostConn = null;
    old?.close();
  }

  scheduleReconnect() {
    if (this.manualClose || this.retryTimer) return;
    this.emitLocal('connection', { status:'reconnecting' });
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.manualClose || !this.peer || this.peer.destroyed) return;
      if (this.peer.disconnected) {
        try { this.peer.reconnect(); } catch { this.scheduleReconnect(); }
      } else if (!this.isAuthority) this.attemptHostConnection();
    }, this.retryDelayMs);
  }

  attemptHostConnection() {
    if (this.manualClose || !this.peer || this.peer.destroyed || this.hostConn) return;
    try {
      const conn = this.hostConn = this.peer.connect(this.hostPeerId, { reliable:true });
      const retry = () => {
        if (this.manualClose || this.hostConn !== conn) return;
        this.dropHostConnection();
        this.emitLocal('connection', { status:'disconnected' });
        this.scheduleReconnect();
      };
      this.attemptTimer = setTimeout(retry, this.attemptTimeoutMs);
      conn.on('open', () => {
        conn.send(JSON.stringify({ kind:'hello', role:this.role, accessToken:this.accessToken }));
      });
      conn.on('data', raw => {
        if (this.manualClose || this.hostConn !== conn) return;
        let msg;
        try { msg = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }
        if (msg.kind === 'init') {
          if (!msg.config) return;
          this.config = msg.config;
          this.initialState = msg.state;
          this.initialMessages = msg.messages || [];
          this.presence = msg.presence || this.presence;
          clearTimeout(this.attemptTimer);
          this.finishConnect?.();
          this.emitLocal('connection', { status:'resynced' });
          this.emitLocal('authority', { role:'host', isAuthority:false });
          this.emitLocal('presence', { presence:{ ...this.presence } });
          if (this.initialState) this.emitLocal('state', this.initialState);
        } else if (msg.kind === 'state') {
          this.initialState = msg.state;
          this.emitLocal('state', msg.state);
        } else if (msg.kind === 'event') this.emitLocal('event', { type:msg.eventType, data:msg.data || {} });
        else if (msg.kind === 'presence') {
          this.presence = msg.presence || this.presence;
          this.emitLocal('presence', { presence:{ ...this.presence } });
        } else if (msg.kind === 'chat') this.emitLocal('chat', msg.message);
        else if (msg.kind === 'error') {
          const error = new Error(msg.message);
          const reject = this.rejectConnect;
          this.emitLocal('error', error);
          this.disconnect();
          reject?.(error);
        }
      });
      conn.on('close', retry);
      conn.on('error', retry);
    } catch { this.dropHostConnection(); this.scheduleReconnect(); }
  }

  sendCommand(action, data = {}) {
    if (this.isAuthority) {
      this.emitLocal('command', { action, data, fromRole: this.role });
      return true;
    }
    const payload = { kind: 'command', action, data, fromRole: this.role };
    if (this.hostConn && this.hostConn.open) {
      try { this.hostConn.send(JSON.stringify(payload)); } catch {}
      return true;
    }
    return false;
  }

  publishEvent(type, data = {}) {
    if (!this.isAuthority) return false;
    this.broadcast({ kind: 'event', eventType: type, data });
    return true;
  }

  publishState(state) {
    if (!this.isAuthority) return false;
    this.initialState = state;
    try { localStorage.setItem(this.storageKey, JSON.stringify(state)); } catch {}
    this.broadcast({ kind: 'state', state });
    return true;
  }

  sendChat(message) {
    const text = String(message || '').trim();
    if (!text) return false;
    const names = {
      host: 'Host',
      teamA: this.config?.teamA || 'Team Blue',
      teamB: this.config?.teamB || 'Team Red',
      referee: 'Referee',
      broadcaster: 'Broadcaster',
    };
    const chatMsg = {
      id: `p2p-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender_role: this.role,
      sender_name: names[this.role] || this.role,
      message: text,
      created_at: new Date().toISOString(),
    };

    if (this.isAuthority) {
      this.initialMessages.push(chatMsg);
      this.initialMessages = this.initialMessages.slice(-100);
      try { localStorage.setItem(this.messagesKey, JSON.stringify(this.initialMessages)); } catch {}
      this.broadcast({ kind: 'chat', message: chatMsg });
      this.emitLocal('chat', chatMsg);
    } else {
      if (this.hostConn && this.hostConn.open) {
        try { this.hostConn.send(JSON.stringify({ kind: 'chat', message: chatMsg })); } catch {}
      }
      this.emitLocal('chat', chatMsg);
    }
    return true;
  }

  disconnect() {
    this.manualClose = true;
    clearTimeout(this.startupTimer);
    clearTimeout(this.retryTimer);
    clearTimeout(this.attemptTimer);
    this.finishConnect = null;
    if (this.isAuthority) {
      for (const conn of this.clientConns) conn.close();
      this.clientConns.clear();
    } else if (this.hostConn) {
      this.hostConn.close();
      this.hostConn = null;
    }
    this.peer?.destroy();
    this.peer = null;
    this.listeners.clear();
  }
}

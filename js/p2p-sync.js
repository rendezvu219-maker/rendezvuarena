// P2P Synchronization Adapter for RendezVu Arena Draft Room
// Provides hybrid WebRTC (PeerJS) + BroadcastChannel synchronization.
// Zero-backend: 100% client-side, runs entirely on GitHub Pages without server or accounts.

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

export class P2PDraftSync {
  constructor({ roomCode, role = 'host', hostPeerId = null, accessToken = '', config = null }) {
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
    this.storageKey = `gs-quick-draft-state:${this.roomCode}`;
    this.messagesKey = `gs-quick-draft-chat:${this.roomCode}`;
    this.bc = typeof window !== 'undefined' && 'BroadcastChannel' in window
      ? new BroadcastChannel(`gs-rv-sync:${this.roomCode}`)
      : null;

    if (this.bc) {
      this.bc.onmessage = event => this.handleBroadcastMessage(event.data || {});
    }
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
    // 1. Send via local BroadcastChannel (cross-tab on same machine)
    try { this.bc?.postMessage(payload); } catch {}

    // 2. Send via PeerJS WebRTC data channels (remote machines)
    const json = JSON.stringify(payload);
    for (const conn of this.clientConns) {
      if (conn.open) {
        try { conn.send(json); } catch (err) { console.warn('[P2P WebRTC broadcast error]:', err); }
      }
    }
  }

  handleBroadcastMessage(msg) {
    if (!msg || typeof msg !== 'object') return;
    if (this.isAuthority) {
      // Host handles client messages
      if (msg.kind === 'hello') {
        const clientRole = msg.role || 'broadcaster';
        this.presence[clientRole] = (this.presence[clientRole] || 0) + 1;
        this.broadcast({ kind: 'presence', presence: { ...this.presence } });
        this.emitLocal('presence', { presence: { ...this.presence } });
        // Reply with snapshot
        this.bc?.postMessage({
          kind: 'init',
          config: this.config,
          state: this.initialState,
          messages: this.initialMessages,
          presence: { ...this.presence },
        });
      } else if (msg.kind === 'command') {
        this.emitLocal('command', { action: msg.action, data: msg.data || {}, fromRole: msg.fromRole });
      } else if (msg.kind === 'chat') {
        const chatMsg = msg.message;
        this.initialMessages.push(chatMsg);
        this.initialMessages = this.initialMessages.slice(-100);
        try { localStorage.setItem(this.messagesKey, JSON.stringify(this.initialMessages)); } catch {}
        this.broadcast({ kind: 'chat', message: chatMsg });
        this.emitLocal('chat', chatMsg);
      }
    } else {
      // Client handles host messages
      if (msg.kind === 'init') {
        if (!this.config || Object.keys(this.config).length === 0) this.config = msg.config;
        this.initialState = msg.state;
        this.initialMessages = msg.messages || [];
        this.presence = msg.presence || this.presence;
        this.emitLocal('authority', { role: 'host', isAuthority: false });
        this.emitLocal('presence', { presence: { ...this.presence } });
        if (this.initialState) this.emitLocal('state', this.initialState);
      } else if (msg.kind === 'state') {
        this.initialState = msg.state;
        this.emitLocal('state', msg.state);
      } else if (msg.kind === 'event') {
        this.emitLocal('event', { type: msg.eventType, data: msg.data || {} });
      } else if (msg.kind === 'presence') {
        this.presence = msg.presence || this.presence;
        this.emitLocal('presence', { presence: { ...this.presence } });
      } else if (msg.kind === 'chat') {
        this.emitLocal('chat', msg.message);
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
      console.warn('[P2P Host] PeerJS not loaded, operating in BroadcastChannel mode.');
      this.emitLocal('connection', { status: 'connected' });
      this.emitLocal('authority', { role: 'host', isAuthority: true });
      this.emitLocal('presence', { presence: { ...this.presence } });
      return this;
    }

    return new Promise(resolve => {
      const timeout = setTimeout(() => {
        resolve(this);
      }, 4000);

      try {
        this.peer = new PeerClass(this.hostPeerId, {
          config: { iceServers: DEFAULT_ICE_SERVERS },
          debug: 1,
        });

        this.peer.on('open', id => {
          clearTimeout(timeout);
          console.log('[P2P Host] Initialized with peer ID:', id);
          this.emitLocal('connection', { status: 'connected' });
          this.emitLocal('authority', { role: 'host', isAuthority: true });
          this.emitLocal('presence', { presence: { ...this.presence } });
          resolve(this);
        });

        this.peer.on('error', err => {
          console.warn('[P2P Host Peer Warning]:', err);
          clearTimeout(timeout);
          resolve(this);
        });

        this.peer.on('connection', conn => {
          this.clientConns.add(conn);
          let clientRole = 'broadcaster';

          conn.on('open', () => {
            conn.send(JSON.stringify({
              kind: 'init',
              config: this.config,
              state: this.initialState,
              messages: this.initialMessages,
              presence: { ...this.presence },
            }));
          });

          conn.on('data', raw => {
            try {
              const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
              if (msg.kind === 'hello') {
                clientRole = msg.role || 'broadcaster';
                this.presence[clientRole] = (this.presence[clientRole] || 0) + 1;
                this.broadcast({ kind: 'presence', presence: { ...this.presence } });
                this.emitLocal('presence', { presence: { ...this.presence } });
              } else if (msg.kind === 'command') {
                this.emitLocal('command', {
                  action: msg.action,
                  data: msg.data || {},
                  fromRole: clientRole,
                });
              } else if (msg.kind === 'chat') {
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
            this.presence[clientRole] = Math.max(0, (this.presence[clientRole] || 1) - 1);
            this.broadcast({ kind: 'presence', presence: { ...this.presence } });
            this.emitLocal('presence', { presence: { ...this.presence } });
          });
        });
      } catch (err) {
        console.warn('[P2P Host peer instantiation failed]:', err);
        clearTimeout(timeout);
        resolve(this);
      }
    });
  }

  async connectAsClient() {
    // Try to load config from local storage first (same machine/browser)
    if (!this.config) {
      try {
        const stored = localStorage.getItem(`rv_config_${this.roomCode}`);
        if (stored) this.config = JSON.parse(stored);
      } catch {}
    }

    // Ping Host over local BroadcastChannel
    if (this.bc) {
      this.bc.postMessage({ kind: 'hello', role: this.role, accessToken: this.accessToken });
    }

    const PeerClass = this.getPeerClass();
    if (!PeerClass) {
      this.ensureFallbackConfig();
      return this;
    }

    // Connect via PeerJS WebRTC
    return new Promise(resolve => {
      let resolved = false;
      const finish = () => {
        if (!resolved) {
          resolved = true;
          this.ensureFallbackConfig();
          resolve(this);
        }
      };

      // If already has config from localStorage or broadcast, resolve quickly
      if (this.config) {
        setTimeout(finish, 300);
      } else {
        // Give 4 seconds to connect to Host, otherwise proceed with fallback and keep connecting
        setTimeout(finish, 4000);
      }

      try {
        this.peer = new PeerClass({
          config: { iceServers: DEFAULT_ICE_SERVERS },
          debug: 1,
        });

        this.peer.on('open', id => {
          this.attemptHostConnection();
        });

        this.peer.on('error', err => {
          console.warn('[P2P Client Peer Warning]:', err);
          finish();
        });
      } catch (err) {
        console.warn('[P2P Client Init Error]:', err);
        finish();
      }
    });
  }

  ensureFallbackConfig() {
    if (!this.config) {
      this.config = {
        format: 'BO3',
        gameNumber: 1,
        seriesRule: 'normal',
        teamA: 'TEAM BLUE',
        teamB: 'TEAM RED',
        enableCoinFlip: true,
        enableDivineDraw: false,
        timerSeconds: 30,
        heroBans: 2,
        draftStyle: 'standard',
        quickDraft: true,
      };
    }
  }

  attemptHostConnection() {
    if (!this.peer || this.peer.destroyed) return;
    try {
      this.hostConn = this.peer.connect(this.hostPeerId, { reliable: true });

      this.hostConn.on('open', () => {
        console.log('[P2P Client] Connected to Host peer:', this.hostPeerId);
        this.emitLocal('connection', { status: 'connected' });
        this.hostConn.send(JSON.stringify({
          kind: 'hello',
          role: this.role,
          accessToken: this.accessToken,
        }));
      });

      this.hostConn.on('data', raw => {
        try {
          const msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (msg.kind === 'init') {
            if (msg.config) this.config = msg.config;
            this.initialState = msg.state;
            this.initialMessages = msg.messages || [];
            this.presence = msg.presence || this.presence;
            this.emitLocal('authority', { role: 'host', isAuthority: false });
            this.emitLocal('presence', { presence: { ...this.presence } });
            if (this.initialState) this.emitLocal('state', this.initialState);
          } else if (msg.kind === 'state') {
            this.initialState = msg.state;
            this.emitLocal('state', msg.state);
          } else if (msg.kind === 'event') {
            this.emitLocal('event', { type: msg.eventType, data: msg.data || {} });
          } else if (msg.kind === 'presence') {
            this.presence = msg.presence || this.presence;
            this.emitLocal('presence', { presence: { ...this.presence } });
          } else if (msg.kind === 'chat') {
            this.emitLocal('chat', msg.message);
          }
        } catch (err) {
          console.error('[P2P Client msg parse error]:', err);
        }
      });

      this.hostConn.on('close', () => {
        this.emitLocal('connection', { status: 'disconnected' });
        // Retry connection after 3 seconds
        setTimeout(() => this.attemptHostConnection(), 3000);
      });

      this.hostConn.on('error', () => {
        // Retry connection after 4 seconds
        setTimeout(() => this.attemptHostConnection(), 4000);
      });
    } catch {}
  }

  sendCommand(action, data = {}) {
    if (this.isAuthority) {
      this.emitLocal('command', { action, data, fromRole: this.role });
      return true;
    }
    const payload = { kind: 'command', action, data, fromRole: this.role };
    try { this.bc?.postMessage(payload); } catch {}
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
      try { this.bc?.postMessage({ kind: 'chat', message: chatMsg }); } catch {}
      if (this.hostConn && this.hostConn.open) {
        try { this.hostConn.send(JSON.stringify({ kind: 'chat', message: chatMsg })); } catch {}
      }
      this.emitLocal('chat', chatMsg);
    }
    return true;
  }

  disconnect() {
    this.bc?.close();
    this.bc = null;
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

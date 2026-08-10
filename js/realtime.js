// Socket.IO synchronization for a server-backed draft room.
export class DraftRoomSync {
  constructor({ roomCode, accessToken }) {
    this.roomCode = String(roomCode || '').toUpperCase();
    this.accessToken = String(accessToken || '');
    this.socket = null;
    this.role = null;
    this.config = null;
    this.initialState = null;
    this.initialMessages = [];
    this.authorityRole = null;
    this.isAuthority = false;
    this.listeners = new Map();
    this.manualClose = false;
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.connecting = null;
  }

  static async exchangeAccess(roomCode, accessToken) {
    const url = `/api/public/draft-rooms/${encodeURIComponent(roomCode)}/access`;
    const devToken = (() => { try { return sessionStorage.getItem('gs_dev_auth_token') || ''; } catch { return ''; } })();
    const options = {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(devToken ? { Authorization: `Bearer ${devToken}` } : {}) },
      body: JSON.stringify({ accessToken }),
    };
    let response = await fetch(url, options);
    if (response.status === 401 && !devToken) {
      const refreshed = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' });
      if (refreshed.ok) response = await fetch(url, options);
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Unable to open draft room.');
    return payload;
  }

  static async loadRoom(roomCode, accessToken) {
    return (await DraftRoomSync.exchangeAccess(roomCode, accessToken)).room;
  }

  async exchangeTicket() {
    const payload = await DraftRoomSync.exchangeAccess(this.roomCode, this.accessToken);
    const room = payload.room || {};
    this.role = room.role || this.role;
    this.config = room.config || {};
    this.initialState = room.state || {};
    this.initialMessages = room.messages || [];
    return payload.socketTicket;
  }

  createSocket() {
    if (this.socket) return;
    this.socket = window.io({
      autoConnect: false,
      reconnection: false,
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    this.socket.on('draft:event', payload => this.emitLocal('event', payload));
    this.socket.on('draft:command', payload => this.emitLocal('command', payload));
    this.socket.on('draft:state', state => this.emitLocal('state', state));
    this.socket.on('draft:presence', presence => this.emitLocal('presence', presence));
    this.socket.on('draft:authority', payload => {
      this.authorityRole = payload?.role || null;
      this.isAuthority = Boolean(payload?.socketId && payload.socketId === this.socket?.id);
      this.emitLocal('authority', { role: this.authorityRole, isAuthority: this.isAuthority });
    });
    this.socket.on('draft:error', error => this.emitLocal('error', error));
    this.socket.on('draft:chat', message => this.emitLocal('chat', message));
    this.socket.on('disconnect', reason => {
      this.emitLocal('connection', { status: 'disconnected', reason });
      if (!this.manualClose) this.scheduleReconnect();
    });
  }

  async joinAuthoritativeRoom() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out while joining the draft room.')), 8000);
      this.socket.emit('draft:join', { roomCode: this.roomCode }, result => {
        clearTimeout(timeout);
        if (!result?.ok) return reject(new Error(result?.error || 'Could not join the draft room.'));
        this.role = result.role;
        this.config = result.config || {};
        this.initialState = result.state || {};
        this.initialMessages = result.messages || [];
        this.authorityRole = result.authorityRole || null;
        this.isAuthority = Boolean(result.authoritySocketId && result.authoritySocketId === this.socket?.id);
        this.emitLocal('authority', { role: this.authorityRole, isAuthority: this.isAuthority });
        resolve(result);
      });
    });
  }

  async connectAndJoin({ initial = false } = {}) {
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const ticket = await this.exchangeTicket();
      this.createSocket();
      this.socket.auth = { draftTicket: ticket };
      if (!this.socket.connected) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Timed out while connecting to realtime server.')), 8000);
          const onConnect = () => { cleanup(); resolve(); };
          const onError = error => { cleanup(); reject(error); };
          const cleanup = () => {
            clearTimeout(timeout);
            this.socket.off('connect', onConnect);
            this.socket.off('connect_error', onError);
          };
          this.socket.once('connect', onConnect);
          this.socket.once('connect_error', onError);
          this.socket.connect();
        });
      }
      const result = await this.joinAuthoritativeRoom();
      this.reconnectAttempt = 0;
      this.emitLocal('connection', { status: initial ? 'connected' : 'resynced' });
      if (!initial) {
        this.emitLocal('resync', {
          role: this.role,
          config: this.config,
          state: this.initialState,
          messages: this.initialMessages,
        });
        this.emitLocal('state', this.initialState);
      }
      return result;
    })();
    try { return await this.connecting; }
    finally { this.connecting = null; }
  }

  async connect() {
    if (!window.io) throw new Error('Socket.IO client is unavailable. Start the Node.js server instead of opening the HTML file directly.');
    if (this.socket?.connected) return this;
    this.manualClose = false;
    await this.connectAndJoin({ initial: true });
    return this;
  }

  scheduleReconnect() {
    if (this.manualClose || this.reconnectTimer) return;
    this.reconnectAttempt += 1;
    const delay = Math.min(10_000, 500 * (2 ** Math.min(5, this.reconnectAttempt - 1)));
    this.emitLocal('connection', { status: 'reconnecting', attempt: this.reconnectAttempt, delay });
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try { await this.connectAndJoin({ initial: false }); }
      catch (error) {
        this.emitLocal('error', { message: error.message || 'Realtime resync failed.' });
        this.scheduleReconnect();
      }
    }, delay);
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
    (this.listeners.get(type) || []).forEach(callback => callback(data));
  }

  sendCommand(action, data = {}) {
    if (!this.socket?.connected) return false;
    this.socket.emit('draft:command', { roomCode: this.roomCode, action, data });
    return true;
  }

  publishEvent(type, data = {}) {
    if (!this.socket?.connected) return false;
    this.socket.emit('draft:event', { roomCode: this.roomCode, type, data });
    return true;
  }

  publishState(state) {
    if (!this.socket?.connected) return false;
    this.socket.emit('draft:state', { roomCode: this.roomCode, state });
    return true;
  }

  sendChat(message) {
    if (!this.socket?.connected) return false;
    const text = String(message || '').trim();
    if (!text) return false;
    this.socket.emit('draft:chat', { roomCode: this.roomCode, message: text });
    return true;
  }

  disconnect() {
    this.manualClose = true;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.socket?.disconnect();
    this.socket = null;
    this.listeners.clear();
  }
}

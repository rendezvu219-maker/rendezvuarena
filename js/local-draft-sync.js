// Cross-tab synchronization for Quick Draft rooms.
// Uses BroadcastChannel for live updates and localStorage for late joiners.
export class LocalDraftSync {
  constructor({ sessionId, role = 'host', config = {} }) {
    this.sessionId = String(sessionId || '').trim();
    this.role = role;
    this.config = config;
    this.roomCode = this.sessionId.slice(0, 8).toUpperCase();
    this.senderId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.initialState = null;
    this.initialMessages = [];
    this.listeners = new Map();
    this.channel = null;
    this.storageKey = `gs-quick-draft-state:${this.sessionId}`;
    this.messagesKey = `gs-quick-draft-chat:${this.sessionId}`;
  }

  async connect() {
    if (!this.sessionId) throw new Error('Quick Draft session ID is missing.');
    if (!('BroadcastChannel' in window)) {
      throw new Error('This browser does not support live Quick Draft tabs. Use a current Chrome, Edge or Firefox build.');
    }

    this.channel = new BroadcastChannel(`gs-quick-draft:${this.sessionId}`);
    this.channel.onmessage = event => this.handleMessage(event.data || {});

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

    this.channel.postMessage({ kind: 'presence', role: this.role, at: Date.now() });
    return this;
  }

  handleMessage(payload) {
    if (!payload || payload.senderId === this.senderId) return;
    if (payload.kind === 'event') this.emitLocal('event', { type: payload.type, data: payload.data || {} });
    else if (payload.kind === 'command' && this.role === 'host') {
      this.emitLocal('command', { action: payload.action, data: payload.data || {}, fromRole: payload.fromRole });
    } else if (payload.kind === 'state') this.emitLocal('state', payload.state || {});
    else if (payload.kind === 'chat') this.emitLocal('chat', payload.message);
    else if (payload.kind === 'presence') this.emitLocal('presence', payload);
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

  post(payload) {
    if (!this.channel) return false;
    this.channel.postMessage({ ...payload, fromRole: this.role, senderId: this.senderId, at: Date.now() });
    return true;
  }

  sendCommand(action, data = {}) {
    if (this.role === 'host') {
      this.emitLocal('command', { action, data, fromRole: this.role });
      return true;
    }
    return this.post({ kind: 'command', action, data });
  }

  publishEvent(type, data = {}) {
    if (this.role !== 'host') return false;
    return this.post({ kind: 'event', type, data });
  }

  publishState(state) {
    if (this.role !== 'host') return false;
    try { localStorage.setItem(this.storageKey, JSON.stringify(state)); } catch {}
    return this.post({ kind: 'state', state });
  }

  sendChat(message) {
    const text = String(message || '').trim();
    if (!text) return false;
    const names = {
      host: 'Host', teamA: this.config.teamA || 'Team Blue', teamB: this.config.teamB || 'Team Red',
      referee: 'Referee', broadcaster: 'Broadcaster', preview: 'Viewer',
    };
    const chatMessage = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sender_role: this.role,
      sender_name: names[this.role] || this.role,
      message: text,
      created_at: new Date().toISOString(),
    };
    let messages = [];
    try { messages = JSON.parse(localStorage.getItem(this.messagesKey) || '[]'); } catch {}
    messages.push(chatMessage);
    messages = messages.slice(-100);
    try { localStorage.setItem(this.messagesKey, JSON.stringify(messages)); } catch {}
    this.emitLocal('chat', chatMessage);
    return this.post({ kind: 'chat', message: chatMessage });
  }

  disconnect() {
    this.channel?.close();
    this.channel = null;
    this.listeners.clear();
  }
}

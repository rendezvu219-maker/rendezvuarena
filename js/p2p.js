// RendezVu Arena - Zero-Backend P2P Synchronization via WebRTC
// Uses PeerJS and public Google/Twilio STUN servers. No account, Firebase, or Node.js required.

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

export function getPeerConstructor() {
  if (typeof window !== 'undefined' && window.Peer) return window.Peer;
  throw new Error('PeerJS is not loaded. Ensure js/vendor/peerjs.min.js is included.');
}

/**
 * Host controller (Side === 'O')
 * Authoritative peer that holds match config, validates actions, and broadcasts state to all peers.
 */
export function createHostSession({
  roomId,
  hostPeerId,
  config,
  secrets = {},
  initialEvents = {},
  onEvent,
  onPresenceChange,
  onError,
  onReady,
}) {
  const PeerClass = getPeerConstructor();
  const peer = new PeerClass(hostPeerId, {
    config: { iceServers: DEFAULT_ICE_SERVERS },
    debug: 1,
  });

  const clients = new Set();
  const events = { ...initialEvents };
  const presence = { A: false, B: false };

  function broadcast(data) {
    const payload = JSON.stringify(data);
    for (const conn of clients) {
      if (conn.open) {
        try { conn.send(payload); } catch (err) { console.warn('Broadcast error:', err); }
      }
    }
  }

  peer.on('open', id => {
    console.log('[P2P Host] Room open with peer ID:', id);
    if (onReady) onReady(id);
  });

  peer.on('error', err => {
    console.error('[P2P Host Error]:', err);
    if (onError) onError(err);
  });

  peer.on('connection', conn => {
    clients.add(conn);
    let clientSide = null;

    conn.on('open', () => {
      // Send initial room snapshot
      conn.send(JSON.stringify({
        type: 'init',
        config,
        events,
        presence,
      }));
    });

    conn.on('data', rawData => {
      try {
        const msg = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        if (msg.type === 'hello') {
          clientSide = msg.side;
          if (['A', 'B'].includes(clientSide)) {
            presence[clientSide] = true;
            if (onPresenceChange) onPresenceChange({ ...presence });
            broadcast({ type: 'presence', presence: { ...presence } });
          }
        } else if (msg.type === 'action' && msg.event) {
          const actionEvent = msg.event;
          // Security: A client can only act for their own side unless they are Host (O)
          if (['A', 'B'].includes(clientSide) && actionEvent.actor !== clientSide) {
            console.warn('[P2P Security] Blocked spoofed action from', clientSide, actionEvent);
            return;
          }
          const eventId = String(actionEvent.step ?? Date.now()) + '_' + Math.random().toString(36).slice(2, 6);
          events[eventId] = { ...actionEvent, id: eventId, createdAt: Date.now() };

          // Persist to local storage
          try {
            localStorage.setItem('rv_events_' + roomId, JSON.stringify(events));
          } catch {}

          if (onEvent) onEvent(events[eventId], { ...events });
          broadcast({ type: 'event', event: events[eventId] });
        }
      } catch (err) {
        console.error('[P2P Host] Invalid message:', err);
      }
    });

    conn.on('close', () => {
      clients.delete(conn);
      if (['A', 'B'].includes(clientSide)) {
        presence[clientSide] = false;
        if (onPresenceChange) onPresenceChange({ ...presence });
        broadcast({ type: 'presence', presence: { ...presence } });
      }
    });
  });

  return {
    peer,
    events,
    getPresence: () => ({ ...presence }),
    sendLocalAction: actionEvent => {
      const eventId = String(actionEvent.step ?? Date.now()) + '_' + Math.random().toString(36).slice(2, 6);
      events[eventId] = { ...actionEvent, id: eventId, createdAt: Date.now(), actor: 'O' };
      try {
        localStorage.setItem('rv_events_' + roomId, JSON.stringify(events));
      } catch {}
      if (onEvent) onEvent(events[eventId], { ...events });
      broadcast({ type: 'event', event: events[eventId] });
    },
    destroy: () => {
      for (const conn of clients) conn.close();
      peer.destroy();
    }
  };
}

/**
 * Client controller (Side === 'A' | 'B' | 'S')
 * Connects directly to the Host peer via WebRTC data channel.
 */
export function createClientSession({
  hostPeerId,
  side,
  token,
  onInit,
  onEvent,
  onPresenceChange,
  onStatus,
  onError,
}) {
  const PeerClass = getPeerConstructor();
  const peer = new PeerClass({
    config: { iceServers: DEFAULT_ICE_SERVERS },
    debug: 1,
  });

  let conn = null;

  peer.on('open', id => {
    console.log('[P2P Client] Peer initialized with ID:', id, 'Connecting to host:', hostPeerId);
    if (onStatus) onStatus('connecting');

    conn = peer.connect(hostPeerId, { reliable: true });

    conn.on('open', () => {
      console.log('[P2P Client] Connected to Host!');
      if (onStatus) onStatus('connected');
      conn.send(JSON.stringify({ type: 'hello', side, token }));
    });

    conn.on('data', rawData => {
      try {
        const msg = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        if (msg.type === 'init') {
          if (onInit) onInit(msg.config, msg.events || {}, msg.presence || {});
        } else if (msg.type === 'event') {
          if (onEvent) onEvent(msg.event);
        } else if (msg.type === 'presence') {
          if (onPresenceChange) onPresenceChange(msg.presence);
        }
      } catch (err) {
        console.error('[P2P Client] Data parse error:', err);
      }
    });

    conn.on('close', () => {
      console.warn('[P2P Client] Connection to host closed.');
      if (onStatus) onStatus('disconnected');
    });

    conn.on('error', err => {
      console.error('[P2P Client Connection Error]:', err);
      if (onError) onError(err);
    });
  });

  peer.on('error', err => {
    console.error('[P2P Client Peer Error]:', err);
    if (onError) onError(err);
  });

  return {
    peer,
    sendAction: actionEvent => {
      if (conn && conn.open) {
        conn.send(JSON.stringify({
          type: 'action',
          event: { ...actionEvent, actor: side, side: actionEvent.side || side },
        }));
      } else {
        throw new Error('Not connected to Host. Please wait for connection or refresh.');
      }
    },
    destroy: () => {
      if (conn) conn.close();
      peer.destroy();
    }
  };
}

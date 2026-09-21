// Keep repository prefixes and never mix server-backed and P2P room links.
export function p2pDraftLinks(baseUrl, roomCode, hostPeerId, access) {
  return Object.fromEntries(['host', 'teamA', 'teamB', 'broadcaster'].map(role => {
    const url = new URL(role === 'broadcaster' ? 'broadcast.html' : 'draft-room.html', baseUrl);
    url.search = '';
    url.hash = new URLSearchParams({ room:roomCode, role, access:access[role], host:hostPeerId }).toString();
    return [role, url.href];
  }));
}

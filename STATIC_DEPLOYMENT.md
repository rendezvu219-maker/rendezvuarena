# Static GitHub Pages + Firebase deployment

Character Build Guides on `heroes.html` read the committed `data/character-builds.json` directly. This feature needs neither Firebase nor a production Node/SQLite server. Edit through the local Admin, then commit and push the JSON and any new card images. See [BUILD_GUIDE_VI.md](BUILD_GUIDE_VI.md) for migration, editing, and deployment details.

Quick Draft is the only quick-play entry point: `quick-draft.html` → `draft-room.html`. The old `quick-match.html` URL redirects there. On GitHub Pages, Quick Draft uses PeerJS/WebRTC; keep the original Host tab open. Participant links include their role token and host peer ID. Every browser waits for a real Host snapshot before opening the room; there is no local-cache/default-room fallback. PeerJS's bundled STUN/TURN configuration is preserved, and temporary connection failures are retried. A blocked connection produces an explicit error with Retry instead of an endless opponent-wait screen.

The tournament pages `tournament.html`, `bracket.html`, and `draft.html` use the Firebase configuration below. The legacy Tournament Operations dashboard uses the Node server. When a server-backed Quick Draft or Tournament Operations room is used, copied links retain the server-issued access token and must not be converted into P2P links. Tournament account/role checks remain unchanged.

After deploying the Quick Draft connection fix, reload the Host page and copy fresh participant links (old waiting-room links omitted access tokens). Keep one Host tab open; the Host link needs the local room configuration in the browser that created it. Players can use separate browsers with their own Team links. If joining fails, use Retry Connection after checking network access. No browser-security settings are changed automatically. PeerJS still depends on its signalling/relay services; static hosting does not mean offline multiplayer. See the [PeerJS networking FAQ](https://peerjs.com/client/faq).

Regression coverage: `node tests/p2p-draft-sync.mjs` checks participants without shared storage/BroadcastChannel, delayed snapshots, late Host startup, reconnect, timeout, role links and preserved TURN defaults. `node tests/quick-draft-server-roles.mjs` verifies server links and role privacy. Browser QA passed with Host, Team A and Team B on three separate loopback origins (independent storage) in the in-app Chromium browser: both teams joined, shared the coin call/result and side choice, received the same Divine Draws, and entered the ban/pick screen. This does not replace a real Brave/Chrome or different-network test; those environments were not available for automation.

## 1. Configure Firebase

1. Create a Firebase project and a Web app.
2. In **Build > Realtime Database**, create a database.
3. Copy the Web app configuration into `js/firebase-config.js`. `databaseURL` is required.
4. In **Realtime Database > Rules**, replace the rules with `firebase-database.rules.json` and publish.

Firebase client configuration is intentionally public. Authorization comes from the database rules and the unguessable tokens in participant/organizer links. Public spectators can read configs and event logs; token proofs and token stores cannot be read.

## 2. Deploy GitHub Pages

1. Push the repository to GitHub.
2. Open **Settings > Pages**.
3. Choose **Deploy from a branch**, select the default branch and `/ (root)`, then save.
4. Open the published repository URL, for example `https://USERNAME.github.io/rendezvuarena/`.

All new navigation and assets use relative URLs, so repository subpath hosting works. Keep static hero images and trailers in `assets/`; do not upload them to Firebase.

## Data model

- `roomConfigs`: public immutable match rules and metadata.
- `roomSecrets`: unreadable Team A, Team B, and organizer tokens.
- `roomAccess`: token-keyed role checks used when a participant opens a link.
- `rooms/*/events`: public append-only draft/random/game-result events.
- `tournamentConfigs`: public immutable teams, rules, and room IDs.
- `tournamentSecrets`: unreadable organizer and match tokens.
- `tournamentLinks`: organizer-token-keyed participant links.
- `tournaments/*/events`: public append-only winner events.

Because this version deliberately has no trusted backend, room/tournament creation is public. Random IDs make accidental collisions impractical. For stronger abuse prevention, add Firebase App Check or a small trusted creation endpoint later; neither is required for normal operation.

# Static GitHub Pages + Firebase deployment

Character Build Guides on `heroes.html` read the committed `data/character-builds.json` directly. This feature needs neither Firebase nor a production Node/SQLite server. Edit through the local Admin, then commit and push the JSON and any new card images. See [BUILD_GUIDE_VI.md](BUILD_GUIDE_VI.md) for migration, editing, and deployment details.

Quick Draft is the only quick-play entry point: `quick-draft.html` → `draft-room.html`. The old `quick-match.html` URL redirects there. On GitHub Pages, Quick Draft uses PeerJS/WebRTC; keep the original Host tab open. Participant links include their role token and host peer ID. Every browser waits for a real Host snapshot before opening the room; there is no local-cache/default-room fallback. PeerJS's bundled STUN/TURN configuration is preserved, and temporary connection failures are retried. A blocked connection produces an explicit error with Retry instead of an endless opponent-wait screen.

The tournament pages `tournament.html`, `bracket.html`, and `draft.html` use the Firebase configuration below. The legacy Tournament Operations dashboard uses the Node server. When a server-backed Quick Draft or Tournament Operations room is used, copied links retain the server-issued access token and must not be converted into P2P links. Tournament account/role checks remain unchanged.

After deploying the Quick Draft connection fix, reload the Host page and copy fresh participant links (old waiting-room links omitted access tokens). Keep one Host tab open; the Host link needs the local room configuration in the browser that created it. Players can use separate browsers with their own Team links. If joining fails, use Retry Connection after checking network access. No browser-security settings are changed automatically. PeerJS still depends on its signalling/relay services; static hosting does not mean offline multiplayer. See the [PeerJS networking FAQ](https://peerjs.com/client/faq).

Regression coverage: `node tests/p2p-draft-sync.mjs` checks participants without shared storage/BroadcastChannel, delayed snapshots, late Host startup, reconnect, timeout, role links and preserved TURN defaults. `node tests/quick-draft-server-roles.mjs` verifies server links and role privacy. Browser QA passed with Host, Team A and Team B on three separate loopback origins (independent storage) in the in-app Chromium browser: both teams joined, shared the coin call/result and side choice, received the same Divine Draws, and entered the ban/pick screen. This does not replace a real Brave/Chrome or different-network test; those environments were not available for automation.

## Quick Draft invitation follow-up (0.7.4-link-check)

Setup and Host waiting-room links now share one validated builder and include a page-version query to avoid stale room HTML. Both entry modules and their invitation dependencies are versioned. The invitation reader accepts a complete query-string or fragment invitation without mixing credentials between them. Missing access codes remain rejected; no token is invented or recovered from another browser's storage.

Both COPY controls validate the invitation before writing it. When Clipboard API access is denied, they try copying selected text; if that also fails, they select the full link and explicitly request Ctrl+C rather than silently leaving an old clipboard value. The error page displays the application version and distinguishes missing access from an invalid role.

Follow-up verification: automated tests cover both URL forms, incomplete links, cross-room credential mixing, missing generated tokens, Clipboard API denial and manual-copy fallback. Local browser QA on three separate loopback origins reached the coin-flip stage for both URL forms; the tokenless form reported `DRAFT_LINK_MISSING_ACCESS`. The user's precise Brave/Chrome failure has not been reproduced; this release hardens invitation handling and makes the next failure diagnosable. It is not proof that all cross-browser/network issues are resolved.

## Spectator media (0.7.5-fast-trailers)

Source trailers and artwork remain in `assets/trailers/`. The site prefers generated H.264/30fps faststart videos and lightweight WebP posters in `assets/trailers/web/`; originals remain available as fallbacks. Content-hashed filenames prevent an updated video or picture from reusing an old cached asset. The September update includes the replacement videos and posters for 0040 and 0041.

After replacing source media, run `npm run assets:trailers -- /path/to/ffmpeg` (or set `FFMPEG_PATH`). Commit the source files, generated assets and `js/trailer-assets.js` together. FFmpeg is only a local build tool; GitHub Pages requires no runtime transcoding or server. Generated versions are compressed, not lossless replacements for the source files.

Broadcast starts playback immediately, buffers only the next confirmed pick/ban, and keeps the video-then-picture sequence. When other reveals are queued, the picture hold is 750ms instead of 3 seconds; healthy clips still play in full. A video with no progress for 8 seconds or a poster that fails to load cannot indefinitely block later reveals. Private team previews are not shared or preloaded for spectators.

Verification: `npm run check` and `npm test` passed locally. Browser QA played the new 0040 and 0041 videos sequentially through the actual Broadcast UI and displayed both matching posters afterward. This verifies local playback, not a guaranteed latency on every network. Media tests verify source hashes, H.264 encoding, faststart metadata, cancellation, stalled playback and poster revisions.

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

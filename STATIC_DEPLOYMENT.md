# Static GitHub Pages + Firebase deployment

The primary competitive flow is now static: `index.html`, `quick-match.html`, `tournament.html`, `bracket.html`, and `draft.html`. Express, Socket.IO, SQLite, Railway, accounts, and Divine Cards are not used by these pages. The legacy files remain in the repository for reference and do not need to be deployed as a server.

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

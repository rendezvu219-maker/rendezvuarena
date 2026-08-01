# RendezVu Arena

RendezVu Arena is an independent community tournament platform with draft rooms, public brackets, match operations, result confirmation, chat, evidence handling and OBS broadcast overlays.

The current ruleset and reference data are designed for community events using **DRAGON BALL GEKISHIN SQUADRA**, but the product name and domain are deliberately neutral. References to the game identify compatibility only.

> Unofficial community project. Not affiliated with, sponsored by or endorsed by Bandai Namco Entertainment, Shueisha, BIRD STUDIO or Toei Animation.

## Release status

This package is cleaned for a **private GitHub repository**:

- no `.env` file;
- no SQLite database, WAL/SHM files or uploaded evidence;
- no bundled `node_modules`;
- no local admin account or personal profile links;
- development reports and demo databases removed;
- production legal pages and a monitored-contact requirement added;
- GitHub Actions CI and Dependabot configuration added.

The project uses character/skill names and gameplay facts as descriptive compatibility data for tournament and reference functions. The repository also contains game-related artwork; public visibility of that artwork on an official site is not, by itself, a redistribution licence. Read `LEGAL_REVIEW_VI.md` and `THIRD_PARTY_NOTICES.md` before publishing a repository that includes the asset files.

## Stack

- Node.js 22.5+
- Express 5
- SQLite
- Socket.IO
- HTML, CSS and vanilla JavaScript

## Local start

```bash
cp .env.example .env
npm ci
npm start
```

Windows:

```bat
copy .env.example .env
npm ci
npm start
```

Open `http://localhost:3000`.

Before first production start, replace every placeholder in `.env`. Never commit `.env`.

## Tests

```bash
npm run check
npm test
npm run deploy:check
```

## GitHub and deployment

GitHub is used for source control and CI. **GitHub Pages cannot run this application**, because the project requires a persistent Node.js server, SQLite and Socket.IO.

Recommended flow:

1. Create an empty **private** GitHub repository named `rendezvu-arena`.
2. Run `PUBLISH_TO_GITHUB_WINDOWS.bat <repository-url>` or `./PUBLISH_TO_GITHUB_LINUX_MAC.sh <repository-url>`.
3. Connect the private repository to Railway or another Node.js host.
4. Attach persistent storage for SQLite and uploads.
5. Configure production environment variables and a custom domain.

Detailed steps are in `DEPLOYMENT_VI.md`.

## Product and domain name

Primary product name: **RendezVu Arena**.

Candidate domains to check with a registrar immediately before purchase:

- `rendezvu.gg`
- `rendezvu.app`
- `rendezvu-arena.com`
- `playrendezvu.com`

A search result showing no website is not proof that a domain is available. Confirm availability and trademark conflicts through the registrar before buying.

## Security reports

Do not open public issues containing credentials, access links, private tournament notes or personal data. Follow `SECURITY.md`.

## Licence

Original project code is all rights reserved unless the operator later adopts a separate open-source licence. Third-party game content is excluded from any code licence. See `LICENSE.md` and `THIRD_PARTY_NOTICES.md`.

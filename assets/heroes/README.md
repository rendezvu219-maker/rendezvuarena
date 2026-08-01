# Local hero assets

Runtime code only loads hero artwork from this directory. It does not hotlink the Bandai Namco website.

Populate the directory before production deployment:

```bash
npm run assets:heroes
npm run assets:heroes:verify
```

Expected layout:

- `assets/heroes/<hero-id>/btn_character.webp`
- `assets/heroes/<hero-id>/btn_character_hover.webp`
- `assets/heroes/<hero-id>/btn_character_sp.webp`
- `assets/heroes/<hero-id>/image_character.webp`
- `assets/heroes/<hero-id>/skill/icon_<skill-id>.png` or `.webp`
- `assets/heroes/manifest.json`

Downloading or redistributing third-party artwork does not itself grant a licence. Confirm usage and redistribution rights before public deployment.

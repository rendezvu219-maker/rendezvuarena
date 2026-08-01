# Asset and Rights Inventory

Updated: 1 August 2026

This inventory separates original project material, factual compatibility data and third-party visual material. It is a release checklist, not a legal opinion.

| Location | Contents | Current treatment | Public-release assessment |
|---|---|---|---|
| `server/`, `js/`, `css/`, root HTML | Original application code and UI | Included under `LICENSE.md` | May be published by the project owner, subject to dependency and contributor rights |
| `assets/heroes/` | 408 character/skill/reference images plus 2 local manifest/README files | Third-party game artwork; excluded from the project-code licence | Main copyright-risk category. Public availability does not itself grant redistribution rights; limit use, keep attribution/removal process, or obtain permission/replace assets |
| `assets/divine-cards/` | 36 card images plus 1 local catalog file | Third-party game artwork; excluded from the project-code licence | Same treatment as other artwork; avoid presenting the repository as an asset download archive |
| `assets/roles/` | 3 role icons | Game-related visual assets unless provenance proves otherwise | Confirm provenance or replace with original icons when practical |
| `data/locales/official-hero-details.json`, generated locale modules | Character names, skill names, gameplay facts and localized descriptions | Compatibility/reference data | Names, short labels and factual mechanics are lower copyright risk. Avoid claiming ownership; paraphrase or narrowly quote longer expressive descriptions and identify the official source |
| `data/locales/in-game-hero-overrides.json` | Exact localized fields manually checked in the released game client | Text-only verification metadata | Temporary source screenshots were deleted; no game screenshot or media evidence is distributed |
| `data/divine-card-hero-recommendations.json` | Project-created recommendations referencing game cards | Original analysis mixed with third-party card names | Original analysis may remain; card names are used descriptively |
| User uploads at runtime | Tournament evidence and attachments | Not included in this package | Configure retention, access control and deletion before launch |

## Current counts

- Hero/skill/reference images: 408 (410 total files including `README.md` and `manifest.json`)
- Divine Card images: 36 (37 total files including `catalog.json`)
- Role icon files: 3
- In-game translation-evidence screenshots: **0**
- Bundled video files: 0

A disclaimer identifies the project and rights holders but is not, by itself, a licence. Likewise, public visibility of an image is not the same as permission to redistribute its file.

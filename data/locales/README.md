# Localized content architecture

The application ships six offline locales: `en`, `ja`, `zh-CN`, `ko`, `es`, and `vi`.
The browser does not fetch translated hero or Divine Card copy from the Bandai Namco site at runtime.

## Hero content — verified source priority

`js/heroes-data.js` remains the canonical English mechanics database. Localized hero names are stored in
`data/locales/hero-names.json`. Localized descriptions and skill copy are sourced from
`data/locales/official-hero-details.json`. Exact fields captured from the released game client live in
`data/locales/in-game-hero-overrides.json` and take priority over the corresponding website fields. The effective
catalog is compiled into `js/i18n-hero-details.js`.

The former heuristic generator has been removed. It created plausible-sounding summaries from English keywords,
but those summaries did not match the wording used by the game or the official site. The replacement policy is
fail-closed:

- `ja`, `zh-CN`, `ko`, and `es` accept verified website snapshots. When exact in-game verification exists, only the
  fields manually checked in the released game client are overlaid and the record is marked `official-site+in-game-verified`. Temporary screenshots are removed after transcription and are not part of the public package.
- In-game evidence has higher priority than the website because the website can omit text that is present in the
  released client. Evidence files are SHA-256 pinned and validated during build/test.
- `vi` accepts only manually edited records marked `editor-reviewed`; hero names remain English.
- A missing record displays the complete canonical English detail. The runtime never mixes English mechanics with
  phrase-dictionary guesses.
- A record is rejected unless its skill IDs exactly match `js/heroes-data.js`. No missing text is inferred.

Official routes:

- Japanese: `https://dbg-squadra.bn-ent.net/hero/{id}`
- Simplified Chinese: `https://dbg-squadra.bn-ent.net/cn/hero/{id}`
- Korean: `https://dbg-squadra.bn-ent.net/ko/hero/{id}`
- Spanish: `https://dbg-squadra.bn-ent.net/es/hero/{id}`

Fetch all 39 pages for all four official locales, validate them, write the local snapshot, and compile the browser
module:

```bash
npm run i18n:heroes:sync
```

Useful partial sync examples:

```bash
npm run i18n:heroes:sync -- --locales=es --ids=0039
npm run i18n:heroes:sync -- --locales=ja,zh-CN --concurrency=2
```

The sync is atomic by default: if one requested page fails, no local data is changed. `--allow-partial` is available
for editorial work. If direct network access is unavailable, save HTML files as `<folder>/<locale>/<id>.html` and
run:

```bash
npm run i18n:heroes:sync -- --from-dir=./official-pages
```

Compile an already edited source catalog without network access:

```bash
npm run i18n:heroes:generate
```

Validate source integrity:

```bash
npm run i18n:heroes:verify
```

Before a release, require all 39 official snapshots for Japanese, Simplified Chinese, Korean, and Spanish:

```bash
npm run i18n:heroes:verify:full
```

The repository includes the official Spanish `0039` snapshot as a parser regression fixture. Other records must be
created by the sync command or by an explicitly reviewed editorial import; generated approximations are forbidden.

## Static and dynamic UI copy

Static HTML uses `data-i18n="key"` (and the attribute variants such as `data-i18n-placeholder`).
`applyTranslations()` resolves these keys first. Exact English matching is retained only as a compatibility
fallback for JavaScript-created content.

Page/UI catalog source:

- `data/locales/ui-pages.json`
- compiled browser module: `js/i18n-ui-pages.js`

Run the source audit to detect known user-facing English literals in client JavaScript that are not covered
by the catalogs:

```bash
npm run i18n:audit
```

## Divine Cards

Canonical English card rows remain in `divine_cards`. Translated fields are stored without destructive
schema changes in:

- `divine_cards_i18n(card_id, locale, name, description, effect, note, translation_status)`
- `divine_card_presets_i18n(preset_id, locale, name, description, scenario, translation_status)`

The service returns the requested locale and falls back field-by-field to canonical English when a
translation is missing. The client sends the active locale in both query strings and admin mutation bodies.

Migrate an existing database without deleting English data:

```bash
npm run i18n:divine:migrate
```

Import translations from JSON or CSV:

```bash
npm run i18n:divine:import -- data/locales/divine-cards.json
npm run i18n:divine:import -- path/to/translations.csv
```

Generate a 90-row CSV template (18 cards × 5 translated locales):

```bash
npm run i18n:divine:template
```

## Locale selection

Normal pages provide one language slot inside their real header/navigation flex layout. The selector is not
fixed to the viewport. `broadcast.html` remains control-free and accepts the saved locale or a query string:

- `broadcast.html?lang=ja`
- `broadcast.html?lang=zh-CN`
- `broadcast.html?lang=ko`
- `broadcast.html?lang=es`
- `broadcast.html?lang=vi`

### Official sync robustness

The official site occasionally changes localized hero spelling, punctuation, or spacing without updating the
repository's previous name catalog. The sync tool therefore extracts the hero name from the page itself and writes
it back to both `data/locales/hero-names.json` and the generated browser module
`js/i18n-hero-names.js`. A stale local spelling is logged as `[NAME]`, but it no longer aborts a valid page.

Some official pages also contain empty duplicate skill-type markers in navigation/accessibility markup. The parser
skips an empty duplicate marker and continues to the next complete block of the same type. It still fails closed if
no complete official block exists, so it never invents missing skill text.


### Canonical skill-id markers and failure snapshots

The localized site may use the canonical image alt (`passive1`, `rush_attack1`, `skill1`, and so on) inside the
detail panel instead of a translated type alt. The parser accepts these exact canonical ids as a strict fallback and can also read an exact localized text heading when the page does not expose a useful image alt.
Empty copies in the tab/navigation list are ignored because they have no complete content block.

When a downloaded page fails parsing, diagnostic files are written under `data/locales/sync-failures/`. The HTML
and flattened text can be used with `--from-dir` or supplied for a parser regression test. These files are ignored
by Git and do not alter `official-hero-details.json`.


### Retrying saved parser failures

When `data/locales/sync-failures/<locale>-<heroId>.html` already exists, test a parser fix against the exact downloaded page without fetching it again:

```bash
npm run i18n:heroes:sync -- --locales=ko,es --ids=0015 --retry-failures
```

For hero `0015`, Korean and Spanish may omit a usable `alt` on the detailed Rush Attack image. The parser first tries the image source path for a canonical marker; if the source is also opaque, it splits the untouched localized paragraphs found between the Passive section and Skill 1 according to the canonical section structure. It does not generate or translate text.

### Official skill panels with no written description

The sync tool preserves the official page exactly. If a skill panel exists but its
`Skill_skill_detail_description` element is empty, the imported skill is stored as:

```json
{
  "name": "Localized skill label",
  "desc": "",
  "officialEmpty": true
}
```

This represents the website snapshot only. If fields are later checked directly in the released game client,
`in-game-hero-overrides.json` may supply only those reviewed fields without changing or inventing the remaining copy.
For Full Power Bojack (`0015`), the Korean client check supplies the missing Rush Attack description. The Spanish
verification record covers Passive and visible labels only, so Spanish Rush remains website-empty.


## In-game verification overlays

Validate the text-only verification records, hero IDs and skill IDs:

```bash
npm run i18n:heroes:verify-game
```

Current verified records:

- `es.0015.passive1`: exact Spanish game-client name and description; visible Spanish skill names and hero title.
- `ko.0015.rush_attack1`: exact Korean game-client name and the two Rush Attack description lines; visible Korean skill names and hero title.

Temporary screenshots used during review have been deleted and are not distributed. Source precedence is field-level:

1. fields manually verified in the released game client;
2. official website snapshot;
3. complete canonical English fallback when no localized record exists.

The Spanish `0015` verification record does not cover a Rush description and must never be treated as proof of one.

## Vietnamese editorial policy

Vietnamese hero records are editor-reviewed derivatives of the synchronized official Simplified Chinese (`zh-CN`) records.

- Hero display names remain the canonical English names.
- Skill names use consistent Sino-Vietnamese terminology where a natural Dragon Ball term exists.
- Descriptions use clear modern Vietnamese while preserving established mechanical terms such as Khí Công, Đột Kích, Nội Tại, Cường Hóa, Khống Chế, Bá Thể and Biến Thân.
- The UI term `Hero` is rendered as `Chiến binh`; `Anh hùng` and `Tướng` are rejected by validation/tests.
- Every Vietnamese record must have `translationStatus: "editor-reviewed"` and `sourceLocale: "zh-CN"`.

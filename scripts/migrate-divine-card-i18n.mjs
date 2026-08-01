import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { db, transaction, dbPath } = require('../server/db');

transaction(() => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS divine_cards_i18n (
      card_id TEXT NOT NULL,
      locale TEXT NOT NULL CHECK(locale IN ('en','ja','zh-CN','ko','es','vi')),
      name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      effect TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      translation_status TEXT NOT NULL DEFAULT 'draft-native-review-required',
      updated_by INTEGER,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(card_id, locale),
      FOREIGN KEY(card_id) REFERENCES divine_cards(id) ON DELETE CASCADE,
      FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_divine_cards_i18n_locale ON divine_cards_i18n(locale,card_id);
    CREATE TABLE IF NOT EXISTS divine_card_presets_i18n (
      preset_id INTEGER NOT NULL,
      locale TEXT NOT NULL CHECK(locale IN ('en','ja','zh-CN','ko','es','vi')),
      name TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      scenario TEXT NOT NULL DEFAULT '',
      translation_status TEXT NOT NULL DEFAULT 'draft-native-review-required',
      updated_by INTEGER,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(preset_id, locale),
      FOREIGN KEY(preset_id) REFERENCES divine_card_presets(id) ON DELETE CASCADE,
      FOREIGN KEY(updated_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_divine_card_presets_i18n_locale ON divine_card_presets_i18n(locale,preset_id);
  `);
  db.exec(`
    INSERT INTO divine_cards_i18n(card_id,locale,name,description,effect,note,translation_status)
    SELECT id,'en',name,description,effect,note,'source' FROM divine_cards WHERE 1
    ON CONFLICT(card_id,locale) DO UPDATE SET
      name=excluded.name,description=excluded.description,effect=excluded.effect,note=excluded.note,
      translation_status='source',updated_at=CURRENT_TIMESTAMP;
  `);
  db.exec(`
    INSERT INTO divine_card_presets_i18n(preset_id,locale,name,description,scenario,translation_status)
    SELECT id,'en',name,description,scenario,'source' FROM divine_card_presets WHERE 1
    ON CONFLICT(preset_id,locale) DO UPDATE SET
      name=excluded.name,description=excluded.description,scenario=excluded.scenario,
      translation_status='source',updated_at=CURRENT_TIMESTAMP;
  `);
});

const counts = db.prepare(`SELECT locale,COUNT(*) count FROM divine_cards_i18n GROUP BY locale ORDER BY locale`).all();
console.log(`Divine Card i18n migration complete: ${dbPath}`);
console.table(counts);

import { loadHeroI18nCatalog, validateHeroI18nCatalog } from './lib/official-hero-catalog.mjs';
import { applyInGameHeroOverridesToCatalog, loadInGameHeroOverrides, validateInGameHeroOverrides } from './lib/in-game-hero-overrides.mjs';

const requireFullOfficial = process.argv.includes('--require-full-official');
const requireFullVietnamese = process.argv.includes('--require-full-vi');
const inGameOverrides = loadInGameHeroOverrides();
validateInGameHeroOverrides(inGameOverrides);
const effectiveCatalog = applyInGameHeroOverridesToCatalog(loadHeroI18nCatalog(), inGameOverrides);
const result = validateHeroI18nCatalog(effectiveCatalog, { requireFullOfficial, requireFullVietnamese });
console.log(`Verified hero i18n catalog: ${Object.entries(result.coverage).map(([locale, count]) => `${locale}=${count}/${result.heroCount}`).join(', ')}.`);

import { loadInGameHeroOverrides, validateInGameHeroOverrides } from './lib/in-game-hero-overrides.mjs';

const result = validateInGameHeroOverrides(loadInGameHeroOverrides());
console.log(`Verified in-game hero metadata: ${result.recordCount} record(s) across ${result.localeCount} locale(s).`);

import { loadInGameHeroOverrides, validateInGameHeroOverrides } from './lib/in-game-hero-overrides.mjs';

const result = validateInGameHeroOverrides(loadInGameHeroOverrides());
console.log(`Verified in-game hero evidence: ${result.recordCount} record(s) across ${result.localeCount} locale(s).`);

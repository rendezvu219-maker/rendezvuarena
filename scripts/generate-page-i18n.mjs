import fs from 'node:fs';

const sourceUrl = new URL('../data/locales/ui-pages.json', import.meta.url);
const outputUrl = new URL('../js/i18n-ui-pages.js', import.meta.url);
const source = JSON.parse(fs.readFileSync(sourceUrl, 'utf8'));

if (!source?.locales || typeof source.locales !== 'object') {
  throw new Error('data/locales/ui-pages.json must contain a locales object.');
}

const output = `export const PAGE_UI = Object.freeze(${JSON.stringify(source.locales)});\n`;
fs.writeFileSync(outputUrl, output);
console.log(`Compiled page UI translations for ${Object.keys(source.locales).length} locales.`);

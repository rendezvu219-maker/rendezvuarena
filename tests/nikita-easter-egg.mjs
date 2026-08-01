import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import {
  HEROES,
  NIKITA_EASTER_EGG,
  getHeroDisplayDescription,
  getHeroDisplayImage,
  getHeroDisplayName,
  heroMatchesSearch,
  isNikitaEasterEggSearch,
} from '../js/heroes.js';
import { HEROES_DATA } from '../js/heroes-data.js';

const gokuMini = HEROES.find(hero => hero.id === '0017');
const vegeta = HEROES.find(hero => hero.id === '0002');
assert.ok(gokuMini);
assert.equal(isNikitaEasterEggSearch('Nik'), true);
assert.equal(isNikitaEasterEggSearch('Niki'), true);
assert.equal(isNikitaEasterEggSearch('Nikit'), true);
assert.equal(isNikitaEasterEggSearch('Nikita'), true);
assert.equal(isNikitaEasterEggSearch('Nikita arena'), true);
assert.equal(isNikitaEasterEggSearch('nikitaa'), true);
assert.equal(isNikitaEasterEggSearch('ni'), false);
assert.equal(isNikitaEasterEggSearch('nike'), true);
assert.equal(heroMatchesSearch(gokuMini, 'nik'), true);
assert.equal(heroMatchesSearch(gokuMini, 'nikit'), true);
assert.equal(heroMatchesSearch(gokuMini, 'nikita'), true);
assert.equal(heroMatchesSearch(gokuMini, 'nikitaa'), true);
assert.equal(heroMatchesSearch(gokuMini, 'nikita arena'), true);
assert.equal(heroMatchesSearch(gokuMini, 'd'), true);
assert.equal(heroMatchesSearch(gokuMini, 'da'), true);
assert.equal(heroMatchesSearch(gokuMini, 'dai'), true);
assert.equal(heroMatchesSearch(gokuMini, 'daim'), true);
assert.equal(heroMatchesSearch(gokuMini, 'daima'), true);
assert.equal(isNikitaEasterEggSearch('daima'), false);
assert.equal(heroMatchesSearch(vegeta, 'nik'), false);
assert.equal(getHeroDisplayImage('0017', 'Nik', 'full'), NIKITA_EASTER_EGG.imagePath);
assert.equal(getHeroDisplayImage('0017', '', 'full'), '/assets/heroes/0017/image_character.webp');
assert.match(getHeroDisplayDescription('0017', 'fallback', 'Nikita', 'vi'), /Nikita/);
assert.match(getHeroDisplayDescription('0017', 'fallback', 'Nikita', 'vi'), /bộ skin hồng đặc trưng—cũng chính là skin mà anh ấy luôn chơi hay nhất\./);
assert.match(getHeroDisplayDescription('0017', 'fallback', 'Nikita', 'vi'), /Nghe đồn mì Indome chẳng khác nào vũ khí thứ hai của anh ấy\./);
assert.doesNotMatch(getHeroDisplayDescription('0017', 'fallback', 'Nikita', 'vi'), /Indomie/);
assert.match(getHeroDisplayDescription('0017', 'fallback', 'Nikita', 'en'), /wears his signature pink skin—the one he always plays best in\./);
assert.match(getHeroDisplayDescription('0017', 'fallback', 'Nikita', 'en'), /Word has it Indomie noodles might as well be his second weapon\./);
assert.doesNotMatch(getHeroDisplayDescription('0017', 'fallback', 'Nikita', 'en'), /Indome noodles/);
assert.equal(getHeroDisplayName('0017', 'Son Goku (Mini)', 'Nikit'), 'Son Goku (Mini) (Nikita?!)');
assert.equal(getHeroDisplayName('0017', 'Son Goku (Mini)', 'daima'), 'Son Goku (Mini)');
assert.equal(getHeroDisplayDescription('0017', 'fallback', '', 'vi'), 'fallback');
assert.match(HEROES_DATA['0017'].description, /Panzy and Glorio/);
await access(new URL('../assets/easter-eggs/goku-mini-nikita.png', import.meta.url));

const pageScript = await readFile(new URL('../js/heroes-page.js', import.meta.url), 'utf8');
assert.match(pageScript, /selectHero\('0017'\)/);
assert.match(pageScript, /getHeroDisplayDescription/);
assert.match(pageScript, /getHeroDisplayName/);
assert.match(pageScript, /const portrait = getHeroImgSp\(hero\.id\)/);
console.log('Nikita Easter egg regression test passed.');

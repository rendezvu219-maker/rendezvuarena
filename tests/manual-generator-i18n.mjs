import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { setLocale, t } from '../js/i18n.js';
import { PAGE_UI } from '../js/i18n-ui-pages.js';
import { escapeHtml } from '../js/api.js';

const source = fs.readFileSync(new URL('../js/dashboard.js',import.meta.url),'utf8');
const generator = source.slice(source.indexOf('function renderManualRandomizer('));
assert.doesNotMatch(generator,/Nhập|người|đội|Xác nhận|Hoàn tác|Đã |Xem trước|RANDOM LẠI/u,'Generator copy must use locale keys.');
const keys = Object.keys(PAGE_UI.en).filter(key=>key.startsWith('manualGenerator'));
assert.ok(keys.length>=38);
for(const locale of ['en','ja','zh-CN','ko','es','vi']) {
  setLocale(locale,{reload:false});
  for(const key of keys) {
    assert.ok(PAGE_UI[locale][key]);
    assert.doesNotMatch(t(key,{count:8,size:4,manual:12,pool:20}),/\{\w+\}/);
  }
  const elements = new Map();
  const element = key => {
    if(!elements.has(key))elements.set(key,{value:'',textContent:'',innerHTML:'',style:{},classList:{toggle(){}},addEventListener(){}});
    return elements.get(key);
  };
  let selectedPool = [], messages = [];
  const context = vm.createContext({t,escapeHtml,state:{},
    $:element,$$:selector=>selector.includes(':checked')?selectedPool:[],
    toast:(message,error)=>messages.push({message,error}),
  });
  vm.runInContext(generator,context);
  const markup = context.renderManualRandomizer([]);
  assert.ok(markup.includes(escapeHtml(t('manualGeneratorTitle'))));
  assert.ok(markup.includes('data-no-i18n="true"'),'User names and explicit translations must not be auto-translated.');
  assert.ok(markup.includes(escapeHtml(t('manualGeneratorPlaceholder'))));
  element('#manual-team-size').value='4';
  context.updateManualPlayerCount();
  assert.equal(element('#manual-count-hint').textContent,t('manualGeneratorCountEmpty',{size:4}));
  element('#manual-players-input').value=Array.from({length:32},(_,i)=>`Player ${i+1}`).join('\n');
  context.updateManualPlayerCount();
  assert.equal(element('#manual-count-hint').textContent,t('manualGeneratorCountReady32'));
  assert.equal(element('#manual-calc-teams').textContent,t('manualGeneratorTeamCount',{count:8}));
  element('#manual-players-input').value='User one\nUser two\nUser three';
  context.updateManualPlayerCount();
  assert.equal(element('#manual-count-hint').textContent,t('manualGeneratorCountNeeded',{count:1,size:4}));
  await context.previewManualTeams();
  assert.equal(messages.at(-1).message,t('manualGeneratorTooFew',{count:3,size:4}));
  element('#manual-players-input').value='1\n2\n3\n4\n5';
  await context.previewManualTeams();
  assert.equal(messages.at(-1).message,t('manualGeneratorNotDivisible',{count:5,size:4}));
  selectedPool=[{value:'1'},{value:'2'},{value:'3'}];
  context.updateManualPlayerCount();
  assert.equal(element('#manual-count-badge').textContent,t('manualGeneratorMixedCount',{count:8,manual:5,pool:3}));
  assert.equal(element('#manual-count-hint').textContent,t('manualGeneratorCountValid',{count:2,size:4}));
  context.renderManualPreview({totalSlots:4,assignments:[{name:'<User team>',tag:'T1',members:[{display_name:'<Player>',isCaptain:false,type:'solo_pool'}]}]});
  const preview=element('#manual-randomizer-preview').innerHTML;
  assert.ok(preview.includes(escapeHtml(t('manualGeneratorPreviewTitle',{count:1}))));
  assert.ok(preview.includes(escapeHtml(t('manualGeneratorConfirm'))));
  assert.ok(preview.includes('&lt;Player&gt;'));
  assert.ok(preview.includes(escapeHtml(t('manualGeneratorPoolMember'))));
}
setLocale('en',{reload:false});
console.log('Team generator labels, six locales, empty/valid/mixed/invalid counters, preview, validation and escaping passed.');

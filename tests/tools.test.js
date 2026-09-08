const test = require('node:test');
const assert = require('node:assert/strict');

let tools;
test.before(async () => { tools = await import('../tools/sync_from_sheet.mjs'); });

test('parseCsv handles quoted newlines, commas, escaped quotes and BOM', () => {
  const csv = '﻿"a","b\nc","d,e","f""g"\n1,2,3,4\n';
  assert.deepEqual(tools.parseCsv(csv), [['a', 'b\nc', 'd,e', 'f"g'], ['1', '2', '3', '4']]);
});

test('parseCsv keeps interior blank rows so warning row numbers match the sheet', () => {
  const rows = tools.parseCsv('h1,h2\nA,1\n,\nB,2\n');
  assert.equal(rows.length, 4);
  assert.deepEqual(rows[2], ['', '']);
  assert.deepEqual(rows[3], ['B', '2']);
});

test('parseCsv drops only trailing blank rows and handles CRLF', () => {
  const rows = tools.parseCsv('h1,h2\r\nA,1\r\n,\r\n,\r\n');
  assert.deepEqual(rows, [['h1', 'h2'], ['A', '1']]);
});

test('applySeed fills only empty keywords, matching on either title language', () => {
  const seed = {
    [require('../apps-script/lib.js').normalizeTitle('타일링과 스케줄링')]: { title: '타일링과 스케줄링', keywords: 'Tiling · Scheduling' },
    [require('../apps-script/lib.js').normalizeTitle('Async Queue')]: { title: 'Async Queue', keywords: 'Edge AI' },
  };
  const pubs = [
    { titleKo: '타일링과 스케줄링', titleEn: '', keywords: '' },
    { titleKo: '', titleEn: 'Async Queue', keywords: '' },
    { titleKo: '타일링과 스케줄링', titleEn: '', keywords: '기존 값' },
    { titleKo: '없는 논문', titleEn: '', keywords: '' },
  ];
  assert.equal(tools.applySeed(pubs, seed), 2);
  assert.deepEqual(pubs.map(p => p.keywords), ['Tiling · Scheduling', 'Edge AI', '기존 값', '']);
});

test('loadSeed reads the committed seed file', () => {
  const seed = tools.loadSeed();
  assert.ok(Object.keys(seed).length >= 40);
});

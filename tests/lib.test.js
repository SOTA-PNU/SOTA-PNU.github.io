const test = require('node:test');
const assert = require('node:assert/strict');
const lib = require('../apps-script/lib.js');

// 시트 헤더 (실제 시트와 동일: 일부 헤더에 줄바꿈/공백이 있음) + 홈페이지용 7열
const H = [
  '검증', 'Publish', 'SCI/학회', '발표일자', '저널명/학회명', '학술지 상위(%)', '기관',
  '제목(한글)', '제목(영어)', '호 \n(SCI 경우)', 'ISSN \n등록번호', '출판국/\n개최국',
  '1저자', '공동', '교신', '실적기관', 'mrnIF(2024)', '비고', '사사 문구', '사사 비율', 'PDF',
  '홈페이지 제외', '구분', '약칭', '키워드', 'Paper 링크', 'Code 링크', '수상',
];
const COL = { publish: 1, type: 2, date: 3, venue: 4, ko: 7, en: 8, country: 11, first: 12, co: 13, corr: 14,
  exclude: 21, kind: 22, short: 23, kw: 24, paper: 25, code: 26, award: 27 };
function row(o) {
  const r = new Array(H.length).fill('');
  for (const k of Object.keys(o)) r[COL[k]] = o[k];
  return r;
}
module.exports = { H, COL, row };

test('normalizeHeader strips all whitespace', () => {
  assert.equal(lib.normalizeHeader('호 \n(SCI 경우)'), '호(SCI경우)');
  assert.equal(lib.normalizeHeader(' Paper 링크 '), 'Paper링크');
  assert.equal(lib.normalizeHeader(null), '');
});

test('headerIndex maps normalized headers to first index', () => {
  const idx = lib.headerIndex(H);
  assert.equal(idx['Publish'], 1);
  assert.equal(idx['출판국/개최국'], 11);
  assert.equal(idx['Paper링크'], 25);
  assert.equal(lib.headerIndex(['a', 'a'])['a'], 0);
});

test('cell reads by header name, tolerant of missing columns', () => {
  const idx = lib.headerIndex(H);
  const r = row({ ko: '제목', paper: 'https://x' });
  assert.equal(lib.cell(r, idx, '제목(한글)'), '제목');
  assert.equal(lib.cell(r, idx, 'Paper 링크'), 'https://x');
  assert.equal(lib.cell(r, idx, '없는 열'), '');
  assert.equal(lib.cell([], idx, 'Publish'), '');
});

test('str trims and stringifies', () => {
  assert.equal(lib.str('  a '), 'a');
  assert.equal(lib.str(null), '');
  assert.equal(lib.str(3), '3');
});

test('isTruthy accepts checkbox booleans, numbers and TRUE/1 strings', () => {
  for (const v of [true, 1, 2, '1', 'TRUE', 'true', ' yes ', 'Y']) assert.equal(lib.isTruthy(v), true, String(v));
  for (const v of [false, 0, '0', 'FALSE', '', null, undefined, 'no']) assert.equal(lib.isTruthy(v), false, String(v));
});

test('COLUMNS / REQUIRED_HEADERS / WEBSITE_HEADERS', () => {
  assert.equal(lib.COLUMNS.publish, 'Publish');
  assert.deepEqual(lib.REQUIRED_HEADERS, ['Publish', '발표일자', '제목(한글)', '제목(영어)', '1저자']);
  assert.deepEqual(lib.WEBSITE_HEADERS, ['홈페이지 제외', '구분', '약칭', '키워드', 'Paper 링크', 'Code 링크', '수상']);
});

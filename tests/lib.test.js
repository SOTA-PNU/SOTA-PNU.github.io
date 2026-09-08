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

test('parseDate: Date object (local getters)', () => {
  assert.deepEqual(lib.parseDate(new Date(2026, 4, 13)), { year: 2026, iso: '2026-05-13' });
  assert.equal(lib.parseDate(new Date('invalid')), null);
});

test('parseDate: spreadsheet serial number (1899-12-30 epoch)', () => {
  assert.deepEqual(lib.parseDate(44014), { year: 2020, iso: '2020-07-02' });
  assert.deepEqual(lib.parseDate(45047), { year: 2023, iso: '2023-05-01' });
});

test('parseDate: strings in Korean/ISO formats, partial dates, trailing text', () => {
  assert.deepEqual(lib.parseDate('2026. 09. 28'), { year: 2026, iso: '2026-09-28' });
  assert.deepEqual(lib.parseDate('2026.9.5'), { year: 2026, iso: '2026-09-05' });
  assert.deepEqual(lib.parseDate('2026-04-01'), { year: 2026, iso: '2026-04-01' });
  assert.deepEqual(lib.parseDate('2026/04/01 (예정)'), { year: 2026, iso: '2026-04-01' });
  assert.deepEqual(lib.parseDate('2026년 4월 1일'), { year: 2026, iso: '2026-04-01' });
  assert.deepEqual(lib.parseDate('2026.04'), { year: 2026, iso: '2026-04' });
  assert.deepEqual(lib.parseDate('2026'), { year: 2026, iso: '2026' });
  assert.equal(lib.parseDate(''), null);
  assert.equal(lib.parseDate('미정'), null);
  assert.equal(lib.parseDate('2026.13.01'), null);
});

test('splitAuthors splits on comma/semicolon/slash/newline and trims', () => {
  assert.deepEqual(lib.splitAuthors('김영주, 유미선;이제민\n김태호 / Guido Araujo'),
    ['김영주', '유미선', '이제민', '김태호', 'Guido Araujo']);
  assert.deepEqual(lib.splitAuthors(''), []);
});

test('mergeAuthors keeps first→co→corr order and dedupes (first occurrence wins)', () => {
  assert.deepEqual(lib.mergeAuthors('권용인', '김영주,유미선,이제민,김태호', '권용인'),
    ['권용인', '김영주', '유미선', '이제민', '김태호']);
  assert.deepEqual(lib.mergeAuthors('조현준', '이지호,차주형', '권용인'), ['조현준', '이지호', '차주형', '권용인']);
  assert.deepEqual(lib.mergeAuthors('', '', ''), []);
});

test('isDomestic: 국내* type or Korea country', () => {
  assert.equal(lib.isDomestic('국내학술', ''), true);
  assert.equal(lib.isDomestic('국내저널', '한국'), true);
  assert.equal(lib.isDomestic('SCI Q3', '한국'), true);
  assert.equal(lib.isDomestic('국제학술', 'Korea'), true);
  assert.equal(lib.isDomestic('SCI Q1', '미국'), false);
  assert.equal(lib.isDomestic('국제학술, BK IF 1', ''), false);
  assert.equal(lib.isDomestic('', ''), false);
});

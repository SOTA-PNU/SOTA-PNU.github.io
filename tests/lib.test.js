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

test('detectKind: explicit 구분 wins (case-insensitive)', () => {
  assert.equal(lib.detectKind('Journal', '국내학술', 'anything'), 'journal');
  assert.equal(lib.detectKind('workshop', 'SCI Q1', 'x'), 'workshop');
  assert.equal(lib.detectKind('Conference', 'SCI Q1', 'Transactions on X'), 'conference');
});

test('detectKind: journal hints in type or venue', () => {
  assert.equal(lib.detectKind('', 'SCI Q2', 'ACM Transactions on Embedded Computing Systems'), 'journal');
  assert.equal(lib.detectKind('', 'KCI 우수', '전자공학회논문지'), 'journal');
  assert.equal(lib.detectKind('', '국내학술', '전자공학회논문지'), 'journal');
  assert.equal(lib.detectKind('', '국내저널', '한국정보처리학회'), 'journal');
  assert.equal(lib.detectKind('', 'SCI Q3', 'ETRI Journal'), 'journal');
});

test('detectKind: workshop hints, else conference; "Science" is not SCI', () => {
  assert.equal(lib.detectKind('', '국제학술', 'NeurIPS-W ML4SYS 2024'), 'workshop');
  assert.equal(lib.detectKind('', '국제학술', 'CASES 2025 WIP'), 'workshop');
  assert.equal(lib.detectKind('', '국제학술', 'ICCV Workshop on ACVR'), 'workshop');
  assert.equal(lib.detectKind('', '국내학술', 'IEMEK Symposium on Embedded Technology (ISET) 2026'), 'conference');
  assert.equal(lib.detectKind('', '국제학술', 'Conference on Computer Science 2025'), 'conference');
  assert.equal(lib.detectKind('', 'BK IF 4', 'IJCAI 2025'), 'conference');
});

test('detectVenueShort: override → map → parenthesized acronym → first word', () => {
  assert.equal(lib.detectVenueShort('MyPill', 'NeurIPS 2025'), 'MyPill');
  assert.equal(lib.detectVenueShort('', 'IEMEK Symposium on Embedded Technology (ISET) 2026'), 'IEMEK');
  assert.equal(lib.detectVenueShort('', '대한임베디드공학회 학술 대회 (추계) 2024'), 'IEMEK');
  assert.equal(lib.detectVenueShort('', 'Annual Symposium of KIPS (ASK) 2026'), 'KIPS');
  assert.equal(lib.detectVenueShort('', '한국정보처리학회 학술 발표회'), 'KIPS');
  assert.equal(lib.detectVenueShort('', 'NeurIPS-W ML4SYS 2024'), 'NeurIPS');
  assert.equal(lib.detectVenueShort('', 'FUTURE GENERATION COMPUTER SYSTEMS'), 'FGCS');
  assert.equal(lib.detectVenueShort('', 'ACM Transactions on Embedded Computing Systems'), 'TECS');
  assert.equal(lib.detectVenueShort('', 'Transactions on Mobile Computing'), 'TMC');
  assert.equal(lib.detectVenueShort('', 'ETRI Journal'), 'ETRI Journal');
  assert.equal(lib.detectVenueShort('', 'Journal of Parallel and Distributed Computing'), 'JPDC');
  assert.equal(lib.detectVenueShort('', 'IEEE Internet of Things Journal'), 'IEEE IoT-J');
  assert.equal(lib.detectVenueShort('', '전자공학회논문지'), 'IEIE');
  assert.equal(lib.detectVenueShort('', '한국 컴퓨터 종합 학술 대회 2020'), 'KCC');
  assert.equal(lib.detectVenueShort('', '한국통신학회 종합 학술 발표회 (동계) 2023'), 'KICS');
  assert.equal(lib.detectVenueShort('', 'CGO-W C4ML 2025'), 'CGO');
  assert.equal(lib.detectVenueShort('', 'Some New Venue (SNV) 2025'), 'SNV');
  assert.equal(lib.detectVenueShort('', 'Unknown Venue Name'), 'Unknown');
  assert.equal(lib.detectVenueShort('', ''), '');
});

test('slugify: lowercase, hangul kept, punctuation → dash, max 60 chars', () => {
  assert.equal(lib.slugify('AgenticShop: Benchmarking Agentic Product Curation'), 'agenticshop-benchmarking-agentic-product-curation');
  assert.equal(lib.slugify('타일링과 스케줄링: 딥러닝 가속'), '타일링과-스케줄링-딥러닝-가속');
  assert.equal(lib.slugify('x'.repeat(100)).length, 60);
  assert.equal(lib.slugify('  --a--  '), 'a');
});

test('normalizeTitle: NFKC, lowercase, only alnum+hangul', () => {
  assert.equal(lib.normalizeTitle(' Tiling and Scheduling: Machine code! '), 'tilingandschedulingmachinecode');
  assert.equal(lib.normalizeTitle('타일링과 스케줄링: 딥러닝'), '타일링과스케줄링딥러닝');
  assert.equal(lib.normalizeTitle(null), '');
});

test('checkUrl: only http(s)', () => {
  assert.equal(lib.checkUrl(' https://arxiv.org/abs/1 '), 'https://arxiv.org/abs/1');
  assert.equal(lib.checkUrl('http://x.y'), 'http://x.y');
  assert.equal(lib.checkUrl('arxiv.org/abs/1'), '');
  assert.equal(lib.checkUrl('javascript:alert(1)'), '');
  assert.equal(lib.checkUrl(''), '');
});

const TODAY = new Date(2026, 8, 8);
const conv = (rows) => lib.convertRows(H, rows, { today: TODAY });
const base = { publish: true, type: '국내학술', date: new Date(2026, 4, 13), venue: 'IEMEK Symposium on Embedded Technology (ISET) 2026',
  ko: '비동기 큐 파이프라인', en: 'Async Queue Pipelining', country: '한국', first: '조현준', co: '이지호,차주형', corr: '권용인' };

test('convertRows: publish gating and exclusion', () => {
  assert.equal(conv([row({ ...base, publish: true })]).publications.length, 1);
  assert.equal(conv([row({ ...base, publish: 'TRUE' })]).publications.length, 1);
  assert.equal(conv([row({ ...base, publish: 1 })]).publications.length, 1);
  assert.equal(conv([row({ ...base, publish: false })]).publications.length, 0);
  assert.equal(conv([row({ ...base, publish: '' })]).publications.length, 0);
  assert.equal(conv([row({ ...base, exclude: true })]).publications.length, 0);
});

test('convertRows: record shape, key order, derived fields (domestic)', () => {
  const [p] = conv([row(base)]).publications;
  assert.deepEqual(Object.keys(p), ['id', 'year', 'date', 'type', 'tier', 'venue', 'venueShort', 'title', 'titleKo', 'titleEn',
    'authors', 'keywords', 'paperUrl', 'codeUrl', 'award']);
  assert.equal(p.id, '2026-비동기-큐-파이프라인');
  assert.equal(p.year, 2026);
  assert.equal(p.date, '2026-05-13');
  assert.equal(p.type, 'conference');
  assert.equal(p.tier, 'normal');
  assert.equal(p.venueShort, 'IEMEK');
  assert.equal(p.title, '비동기 큐 파이프라인');
  assert.deepEqual(p.authors, ['조현준', '이지호', '차주형', '권용인']);
  assert.equal(p.keywords, '');
});

test('convertRows: international → English title, tier top; falls back to other language', () => {
  const intl = { ...base, type: 'SCI Q1', country: '미국', venue: 'Transactions on Mobile Computing' };
  let [p] = conv([row(intl)]).publications;
  assert.equal(p.title, 'Async Queue Pipelining');
  assert.equal(p.tier, 'top');
  assert.equal(p.type, 'journal');
  [p] = conv([row({ ...intl, en: '' })]).publications;
  assert.equal(p.title, '비동기 큐 파이프라인');
  [p] = conv([row({ ...base, ko: '' })]).publications;
  assert.equal(p.title, 'Async Queue Pipelining');
});

test('convertRows: website override columns pass through', () => {
  const [p] = conv([row({ ...base, kind: 'Workshop', short: 'ISET', kw: 'Edge AI · NPU',
    paper: 'https://a.b/p', code: 'https://a.b/c', award: '⭐ Best Paper' })]).publications;
  assert.equal(p.type, 'workshop');
  assert.equal(p.venueShort, 'ISET');
  assert.equal(p.keywords, 'Edge AI · NPU');
  assert.equal(p.paperUrl, 'https://a.b/p');
  assert.equal(p.codeUrl, 'https://a.b/c');
  assert.equal(p.award, '⭐ Best Paper');
});

test('convertRows: warnings — no title (excluded), no date (kept, current year), bad url (dropped), no venue (kept)', () => {
  const r = conv([
    row({ ...base, ko: '', en: '' }),
    row({ ...base, date: '' }),
    row({ ...base, paper: 'arxiv.org/abs/1' }),
    row({ ...base, venue: '' }),
  ]);
  assert.equal(r.publications.length, 3);
  assert.equal(r.publications.find(p => p.date === '').year, 2026);
  assert.equal(r.warnings.length, 4);
  assert.match(r.warnings[0], /^2행: 제목 없음/);
  assert.match(r.warnings[1], /^3행 .*발표일자 없음 → 2026년/);
  assert.match(r.warnings[2], /^4행: Paper 링크 형식 오류/);
  assert.match(r.warnings[3], /^5행 .*저널명\/학회명 없음/);
  assert.equal(r.publications.find(p => p.venue === '').venueShort, '');
  // 정렬 결과: [4행(bad url), 5행(no venue), 3행(no date)] — 같은 날짜는 시트 순서
  assert.equal(r.publications[0].paperUrl, '');
});

test('convertRows: sorting year desc, date desc, empty date last, then sheet order', () => {
  const r = conv([
    row({ ...base, ko: 'A', date: '2025-01-01' }),
    row({ ...base, ko: 'B', date: '2026-01-01' }),
    row({ ...base, ko: 'C', date: '' }),           // year 2026 (today), no date → last within 2026
    row({ ...base, ko: 'D', date: '2026-06-01' }),
    row({ ...base, ko: 'E', date: '2025-01-01' }),
  ]);
  assert.deepEqual(r.publications.map(p => p.title), ['D', 'B', 'C', 'A', 'E']);
});

test('convertRows: duplicate ids get -2, -3 suffixes', () => {
  const r = conv([row(base), row(base), row(base)]);
  assert.deepEqual(r.publications.map(p => p.id),
    ['2026-비동기-큐-파이프라인', '2026-비동기-큐-파이프라인-2', '2026-비동기-큐-파이프라인-3']);
});

test('convertRows: missing required header throws', () => {
  const bad = H.filter(h => h !== '발표일자');
  assert.throws(() => lib.convertRows(bad, [], { today: TODAY }), /필수 헤더 없음: 발표일자/);
});

test('buildDocument / serialize / samePublications', () => {
  const r = conv([row(base)]);
  const doc = lib.buildDocument(r, { generatedAt: '2026-09-08T00:00:00.000Z', source: '논문 등록' });
  assert.deepEqual(Object.keys(doc), ['schemaVersion', 'generatedAt', 'source', 'count', 'publications']);
  assert.equal(doc.schemaVersion, 1);
  assert.equal(doc.count, 1);
  const text = lib.serialize(doc);
  assert.ok(text.endsWith('}\n'));
  assert.deepEqual(JSON.parse(text), doc);
  const doc2 = lib.buildDocument(conv([row(base)]), { generatedAt: 'other', source: 'x' });
  assert.equal(lib.samePublications(doc, doc2), true);
  const doc3 = lib.buildDocument(conv([row({ ...base, ko: 'changed' })]), { generatedAt: 'other' });
  assert.equal(lib.samePublications(doc, doc3), false);
  assert.equal(lib.samePublications(doc, null), false);
});

// Publications 국제/국내 버튼과, 그 데이터를 만드는 시트 갱신 경로의 회귀 테스트.
// 필터 동작 자체는 tests/browser-entry.test.js, 판정 규칙은 tests/lib.test.js 에 있다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const lib = require('../apps-script/lib.js');

// 실제 '논문 등록' 탭 헤더 (2행). tests/lib.test.js 와 같은 목록 — 그 파일을 require 하면 테스트가 두 번 돈다.
const H = [
  '검증', 'Publish', 'SCI/학회', '발표일자', '저널명/학회명', '학술지 상위(%)', '기관',
  '제목(한글)', '제목(영어)', '호 \n(SCI 경우)', 'ISSN \n등록번호', '출판국/\n개최국',
  '1저자', '공동', '교신', '실적기관', 'mrnIF(2024)', '비고', '사사 문구', '사사 비율', 'PDF',
  '홈페이지 제외', '구분', '약칭', '키워드', 'Paper 링크', 'Code 링크', '수상',
];
const COL = { publish: 1, type: 2, date: 3, venue: 4, ko: 7, en: 8, first: 12 };
function row(o) {
  const r = new Array(H.length).fill('');
  for (const k of Object.keys(o)) r[COL[k]] = o[k];
  return r;
}

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const code = read('apps-script/Code.gs');

let tools;
test.before(async () => { tools = await import('../tools/sync_from_sheet.mjs'); });

function fnBody(name) {
  const start = code.indexOf('function ' + name + '(');
  assert.ok(start >= 0, `Code.gs has no ${name}()`);
  const next = code.indexOf('\nfunction ', start + 1);
  return code.slice(start, next < 0 ? undefined : next);
}

// 시트 행 배열 → CSV (export?format=csv 가 내려주는 모양)
const csvOf = (rows) => rows.map((r) => r.map((v) => {
  const s = v instanceof Date ? `${v.getFullYear()}. ${v.getMonth() + 1}. ${v.getDate()}` : String(v === true ? 'TRUE' : v === false ? 'FALSE' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}).join(',')).join('\n') + '\n';

test('publications.html: All, then a region group and a type group of toggle chips', () => {
  const html = read('publications.html').replace(/<!--[\s\S]*?-->/g, '');
  const start = html.indexOf('id="pubFilters"');
  const bar = html.slice(html.lastIndexOf('<div', start), html.indexOf('id="pubList"'));
  assert.ok(start > 0, '#pubFilters is missing');
  assert.match(bar, /^<div class="pnu-pub-filters" id="pubFilters" role="group" aria-label="[^"]+">/);

  const buttons = bar.match(/<button\b[^>]*>[^<]*<\/button>/g) || [];
  assert.deepEqual(buttons.map((b) => b.replace(/<[^>]+>/g, '')),
    ['All', 'International', 'Domestic', 'Conference', 'Journal', 'Awarded']);
  for (const b of buttons) assert.match(b, /type="button"/);
  // All 은 '전체 보기' 버튼: 누른 상태를 갖는 토글이 아니다
  assert.doesNotMatch(buttons[0], /aria-pressed/);
  for (const b of buttons.slice(1)) assert.match(b, /aria-pressed="false"/);

  // 묶음은 각각 이름 붙은 그룹이다 (스크린리더가 묶음을 알 수 있고, 좁은 화면에서 묶음 단위로 줄이 바뀐다)
  const groups = [...bar.matchAll(/<div class="pnu-chip-group" role="group" aria-label="([^"]+)">([\s\S]*?)<\/div>/g)];
  assert.equal(groups.length, 2);
  assert.deepEqual([...groups[0][2].matchAll(/data-region="(\w+)"/g)].map((m) => m[1]), ['international', 'domestic']);
  assert.deepEqual([...groups[1][2].matchAll(/data-filter="(\w+)"/g)].map((m) => m[1]), ['conference', 'journal', 'awarded']);
  assert.doesNotMatch(bar, /pnu-chip-sep/, 'separators dangled at line ends; groups replace them');
});

test('publications.html: the result status region is always in the page', () => {
  const html = read('publications.html').replace(/<!--[\s\S]*?-->/g, '');
  // role=status 영역이 hidden 이면 나타나는 순간을 스크린리더가 놓칠 수 있다
  assert.match(html, /<p class="pnu-sr-only[^"]*" id="pubStatus" role="status"><\/p>/);
  assert.doesNotMatch(html, /id="pubEmpty"/);
});

test('css: chip groups, a clearly different selected chip, hidden year blocks, screen-reader text', () => {
  const css = read('css/redesign.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(css, /\.pnu-chip-group\s*\{/);
  assert.match(css, /\.pnu-pub-filters\s*\{[^}]*column-gap/);
  assert.match(css, /\.pnu-year-block\[hidden\]\s*\{\s*display:\s*none/);
  assert.match(css, /\.pnu-sr-only\s*\{[^}]*clip:/);
  assert.match(css, /@media \(forced-colors: active\)\s*\{\s*\.pnu-chip\.is-active\s*\{[^}]*Highlight/);
  assert.doesNotMatch(css, /\.pnu-chip-sep/);
});

test('the publication sync finds the header row instead of assuming row 1', () => {
  // 실제로 생긴 일: '논문 등록' 탭 맨 위에 빈 행이 생겨 헤더가 2행으로 내려갔다.
  // 1행을 헤더로 읽으면 갱신이 "필수 헤더 없음" 으로 멈춘다.
  const readRows = fnBody('readPublicationRows_');
  assert.match(readRows, /PubLib\.findHeaderRow\(values\)/);
  assert.match(readRows, /PubLib\.guessHeaderRow\(values\)/, 'when not found, name only the headers really missing');
  assert.doesNotMatch(readRows, /headers:\s*values\[0\]/);
  assert.match(fnBody('buildPublications_'), /headerRow:\s*data\.headerRow/, 'warnings must name the real sheet row');
});

test('the column setup and keyword fill write below the header row it found', () => {
  const setup = fnBody('setupWebsiteColumns');
  assert.match(setup, /PubLib\.findHeaderRow\(/);
  assert.match(setup, /PubLib\.guessHeaderRow\(/);
  for (const fn of ['setupWebsiteColumns', 'seedKeywords_']) {
    // 1행·2행을 박아 두면 헤더가 내려갔을 때 헤더 이름을 데이터 칸에, 체크박스를 헤더 칸에 쓴다
    assert.doesNotMatch(fnBody(fn), /getRange\(2,|getRange\(1, 1, 1,|getRange\(1, lastCol\)/, `${fn} hardcodes a sheet row`);
  }
});

test('emergency sync: the CSV export with a blank first row converts like Apps Script does', () => {
  const blank = new Array(H.length).fill('');
  const base = { publish: 'TRUE', type: '국내학술', date: '2026. 5. 13', venue: 'IEMEK Symposium on Embedded Technology (ISET) 2026',
    ko: '비동기 큐 파이프라인', en: 'Async Queue Pipelining', first: '조현준' };
  const csv = csvOf([blank, H, row(base), row({ ...base, ko: '날짜 없음', date: '' }),
    row({ ...base, type: 'SCI Q1', venue: 'Transactions on Mobile Computing', ko: 'TMC 논문' })]);
  const r = tools.convertCsv(csv, new Date(2026, 9, 20));
  assert.equal(r.publications.length, 3);
  assert.deepEqual(r.publications.map((p) => p.region).sort(), ['domestic', 'domestic', 'international']);
  // 헤더가 2행이므로 첫 데이터는 3행, 날짜 없는 행은 4행
  assert.match(r.warnings[0], /^4행 .*발표일자 없음/);
});

test('emergency sync: a renamed header is reported by name and row, not as all five missing', () => {
  const blank = new Array(H.length).fill('');
  const renamed = H.map((h) => (h === '1저자' ? '제1저자' : h));
  assert.throws(() => tools.convertCsv(csvOf([blank, renamed, row({ publish: 'TRUE' })]), new Date()),
    /^Error: 필수 헤더 없음: 1저자 \(2행을 헤더로 읽음\)$/);
});

test('emergency sync: the tab number is found by tab name in the sheet htmlview', () => {
  const html = 'items.push({name: "연구성과관리", pageUrl: "x", gid: "0", initialSheet: true});' +
    'items.push({name: "논문 등록", pageUrl: "y", gid: "1457834057", initialSheet: false});';
  assert.equal(tools.findTabGid(html, '논문 등록'), '1457834057');
  assert.equal(tools.findTabGid(html, '연구성과관리'), '0');
  assert.equal(tools.findTabGid(html, '없는 탭'), '');
  assert.equal(tools.findTabGid('', '논문 등록'), '');
});

test('guessHeaderRow picks the row with the most required headers', () => {
  const blank = new Array(H.length).fill('');
  const renamed = H.map((h) => (h === '1저자' ? '제1저자' : h));
  assert.equal(lib.findHeaderRow([blank, renamed]), -1);
  assert.equal(lib.guessHeaderRow([blank, renamed]), 1);
  assert.equal(lib.guessHeaderRow([blank, blank]), -1);
  assert.equal(lib.guessHeaderRow([]), -1);
});

test('the README tells people where International / Domestic comes from and how to fix one', () => {
  const readme = read('apps-script/README.md');
  assert.match(readme, /International/);
  assert.match(readme, /Domestic/);
  assert.match(readme, /SCI\/학회/);
  assert.match(readme, /한글이 있으면 `SCI\/학회` 와 상관없이 국내/, 'the Hangul-venue rule is spelled out');
  assert.match(readme, /위쪽 10행/, 'the header row search is documented');
  assert.match(readme, /SOTA_SHEET_GID/, 'the manual sync tab number is documented');
  // 메뉴 이름은 Code.gs 와 같아야 한다
  const label = /addItem\('(초기 설정[^']*)', 'setupWebsiteColumns'\)/.exec(code)[1];
  assert.ok(readme.includes(label), `README should call the menu item "${label}"`);
});

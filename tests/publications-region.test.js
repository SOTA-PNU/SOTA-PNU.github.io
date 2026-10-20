// Publications 국제/국내 버튼과, 그 데이터를 만드는 시트 갱신 경로의 회귀 테스트.
// 필터 동작 자체는 tests/browser-entry.test.js, 판정 규칙은 tests/lib.test.js 에 있다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const code = read('apps-script/Code.gs');

function fnBody(name) {
  const start = code.indexOf('function ' + name + '(');
  assert.ok(start >= 0, `Code.gs has no ${name}()`);
  const next = code.indexOf('\nfunction ', start + 1);
  return code.slice(start, next < 0 ? undefined : next);
}

test('publications.html: International / Domestic chips sit beside the type chips as toggle buttons', () => {
  const html = read('publications.html').replace(/<!--[\s\S]*?-->/g, '');
  const bar = /<div[^>]*id="pubFilters"[^>]*>([\s\S]*?)<\/div>/.exec(html);
  assert.ok(bar, '#pubFilters is missing');
  const buttons = bar[1].match(/<button\b[^>]*>[^<]*<\/button>/g) || [];
  const label = (b) => b.replace(/<[^>]+>/g, '');
  assert.deepEqual(buttons.map(label), ['All', 'International', 'Domestic', 'Conference', 'Journal', 'Awarded']);
  assert.match(buttons[0], /data-filter="all" aria-pressed="true"/);
  assert.match(buttons[1], /data-region="international" aria-pressed="false"/);
  assert.match(buttons[2], /data-region="domestic" aria-pressed="false"/);
  for (const b of buttons) assert.match(b, /type="button"/);
  assert.match(bar[0], /role="group" aria-label="[^"]+"/);
  // 조합 결과가 0건일 때 빈 화면 대신 안내가 보여야 한다
  assert.match(html, /<p class="[^"]*" id="pubEmpty" role="status" hidden>[^<]+<\/p>/);
  assert.match(read('css/redesign.css'), /\.pnu-chip-sep\s*\{/);
});

test('the publication sync finds the header row instead of assuming row 1', () => {
  // 실제로 생긴 일: '논문 등록' 탭 맨 위에 빈 행이 생겨 헤더가 2행으로 내려갔다.
  // 1행을 헤더로 읽으면 갱신이 "필수 헤더 없음" 으로 멈춘다.
  const readRows = fnBody('readPublicationRows_');
  assert.match(readRows, /PubLib\.findHeaderRow\(values\)/);
  assert.doesNotMatch(readRows, /headers:\s*values\[0\]/);
  assert.match(fnBody('buildPublications_'), /headerRow:\s*data\.headerRow/, 'warnings must name the real sheet row');
});

test('the column setup and keyword fill write below the header row it found', () => {
  assert.match(fnBody('setupWebsiteColumns'), /PubLib\.findHeaderRow\(/);
  for (const fn of ['setupWebsiteColumns', 'seedKeywords_']) {
    // 1행·2행을 박아 두면 헤더가 내려갔을 때 헤더 이름을 데이터 칸에, 체크박스를 헤더 칸에 쓴다
    assert.doesNotMatch(fnBody(fn), /getRange\(2,|getRange\(1, 1, 1,|getRange\(1, lastCol\)/, `${fn} hardcodes a sheet row`);
  }
});

test('the README tells people where International / Domestic comes from and how to fix one', () => {
  const readme = read('apps-script/README.md');
  assert.match(readme, /International/);
  assert.match(readme, /Domestic/);
  assert.match(readme, /SCI\/학회/);
  assert.match(readme, /위쪽 10행/, 'the header row search is documented');
});

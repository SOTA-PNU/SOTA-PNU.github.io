# Sheet → GitHub Publications Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A lab member registers a paper in the Google Sheet `논문 등록` tab, clicks a sheet menu, and `sota.pusan.ac.kr/publications.html` shows it within ~1 minute — no hand-editing of HTML.

**Architecture:** Apps Script (bound to the sheet) converts rows → `data/publications.json` with a pure, shared conversion library (`apps-script/lib.js`) and commits the file through the GitHub Contents API. `publications.html` becomes a shell: `js/publications.js` fetches the JSON and renders the exact same card markup, then binds the existing filter chips. A Node tool can produce the same JSON from the sheet's public CSV export as a manual fallback and to bootstrap the first `data/publications.json`.

**Tech Stack:** Plain JS (ES2017-compatible for Apps Script V8 runtime + browsers), Node 24 built-in `node:test` (no npm deps), Google Apps Script (`SpreadsheetApp`, `UrlFetchApp`, `PropertiesService`), GitHub REST Contents API.

**Spec:** `docs/superpowers/specs/2026-09-08-sheet-publications-sync-design.md`

## Spec amendments decided while planning (apply these; they supersede the spec where they differ)

1. **`구분` has three values:** `Conference` / `Journal` / `Workshop`. JSON `type` ∈ `conference|journal|workshop`. Workshop cards get `data-tags="conference,workshop"` and the venue-meta label `Workshop` (the current site already labels 7 cards "Workshop"). Auto-detect workshop when the venue matches `/workshop|-W\b|\bWIP\b/i` and no journal hint matched.
2. **Tier rule:** `tier = "top"` (blue pill) when the paper is **international** (not domestic), else `"normal"`. Domestic = `SCI/학회` starts with `국내` OR `출판국/개최국` contains `한국`/`korea`. (The old "BK IF / SCI Q1" rule disagreed with the current site on 13/51 cards; this rule agrees on 48/51.)
3. **Seed fills `키워드` only.** The current site has no Paper/Code links, awards, or bold authors on live cards, and its pill texts are inconsistent (`IEMEK` / `ISET` / `대한임베디드공학회 2024` for the same society). Pills are therefore always auto-derived (override via `약칭` column). Seed = `{normalizedTitle → {keywords, title}}` extracted from the current `publications.html`.
4. **Partial dates allowed:** `date` may be `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` (string sort still works). Missing/unparseable → warning + `year = today.getFullYear()`, `date = ""`.
5. **`Publish` truthiness:** boolean `true`, number ≠ 0, or string `true`/`1`/`y`/`yes` (case-insensitive). Apps Script `getValues()` returns booleans for checkboxes; the CSV export returns `"TRUE"`.

## Global Constraints

- Apps Script V8 runtime: `lib.js` must not use ES modules, optional chaining, or `??`. Arrow functions, `const/let`, template literals, `Array.prototype.includes`, `String.prototype.normalize` are fine. Export pattern: `var PubLib = (function(){ ... })(); if (typeof module !== 'undefined' && module.exports) module.exports = PubLib;`
- No npm dependencies. Tests run with `node --test tests/*.test.js` on Node ≥ 20.
- Card markup/classes must equal the current `publications.html` cards exactly (class names: `pnu-year-block`, `pnu-year-badge`, `pnu-pub-list`, `pnu-pub-card`, `pnu-pub-awarded`, `pnu-pub-side`, `pnu-venue-pill`, `pnu-venue-conf`, `pnu-venue-top`, `pnu-venue-meta`, `pnu-pub-main`, `pnu-pub-top`, `pnu-badges`, `pnu-badge`, `pnu-badge-award`, `pnu-links`, `pnu-link`, `pnu-link-paper`, `pnu-link-code`, `pnu-title`, `pnu-authors`, `pnu-meta-row`, `pnu-meta`, `pnu-dot`).
- Repo constants: repo `SOTA-PNU/SOTA-PNU.github.io`, branch `main`, path `data/publications.json`, sheet id `1Iz3_QLSXu6Ovww27wobo3JcsCSPZrhWN-OwEQnwjnc4`, tab `논문 등록`, log tab `홈페이지 갱신 로그`.
- GitHub token lives only in Apps Script **Script Properties** key `GITHUB_TOKEN`. Never written to a cell, log, or repo.
- All text rendered into HTML goes through `esc()`; URLs must match `/^https?:\/\//i` or are dropped.
- Shell: this session's harness rejects compound shell commands inside the worktree. Run **one simple command per Bash call** (no `&&` chains, no `cd`, no heredocs). Write scripts to files first, then run them.
- Commit after every task. Commit message trailer (exact):
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01FxC7CxtmD3t63KpSGmbtMZ
  ```

## File structure

| Path | Responsibility |
|---|---|
| `package.json` | `npm test` → `node --test tests/*.test.js`; `npm run sync` → manual JSON build. No deps. |
| `apps-script/lib.js` | Pure conversion library `PubLib` (rows → publication records, document build/serialize/compare). Shared by Apps Script, Node tool, tests. |
| `apps-script/seed.js` | Generated `var PUB_SEED = {...}` (normalized title → keywords). Used once by "초기 설정". |
| `apps-script/Code.gs` | Apps Script glue: menu, read sheet, preview/sync dialogs, GitHub API, log tab, column setup, token config. |
| `apps-script/README.md` | Install + operate + troubleshoot guide (Korean). |
| `js/publications.js` | Browser renderer `PnuPublications` (+ CommonJS export for tests): fetch JSON → cards → filters. |
| `publications.html` | Header + filter chips kept; card list replaced by `#pubList` mount; inline filter script removed; loads `js/publications.js`. |
| `data/publications.json` | Data file the site reads. Bootstrapped from the sheet via `tools/sync_from_sheet.mjs`. |
| `tools/extract_seed.mjs` | One-time: old `publications.html` → `apps-script/seed.js`. |
| `tools/sync_from_sheet.mjs` | Manual fallback: sheet CSV export → `data/publications.json` using `lib.js`. |
| `tests/lib.test.js`, `tests/render.test.js`, `tests/seed.test.js`, `tests/data.test.js` | Unit tests. |
| `README.md` | Add a short "홈페이지 유지보수" pointer to `apps-script/README.md`. |

---

### Task 1: Scaffold + header utilities in `lib.js`

**Files:**
- Create: `package.json`
- Create: `apps-script/lib.js`
- Test: `tests/lib.test.js`

**Interfaces:**
- Produces: `PubLib.COLUMNS` (object of logical name → sheet header), `PubLib.REQUIRED_HEADERS` (array), `PubLib.WEBSITE_HEADERS` (array of the 7 website headers in column order), `PubLib.normalizeHeader(h) → string`, `PubLib.headerIndex(headers) → {normalizedHeader: index}`, `PubLib.cell(row, idx, headerName) → raw value or ''`, `PubLib.str(v) → trimmed string`, `PubLib.isTruthy(v) → boolean`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "sota-pnu-site",
  "private": true,
  "description": "SOTA Lab homepage (GitHub Pages) + Google Sheet → publications sync tooling",
  "scripts": {
    "test": "node --test tests/*.test.js",
    "sync": "node tools/sync_from_sheet.mjs"
  }
}
```

- [ ] **Step 2: Write the failing tests**

Create `tests/lib.test.js`:

```js
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tests/*.test.js`
Expected: FAIL — `Cannot find module '../apps-script/lib.js'`

- [ ] **Step 4: Create `apps-script/lib.js` with the utilities**

```js
/*
 * apps-script/lib.js — 시트 행 → 홈페이지 논문 레코드 변환 (순수 로직)
 *
 * Google Apps Script(V8)와 Node.js 양쪽에서 그대로 실행된다.
 *  - Apps Script: 이 파일을 lib.gs 로 붙여넣으면 전역 PubLib 로 접근
 *  - Node: require('./lib.js')
 * 시트 셀 값 이외의 외부 상태(시각, 네트워크)에 의존하지 않는다.
 */
var PubLib = (function () {
  'use strict';

  // 논리 이름 → 시트 헤더 (헤더는 공백/줄바꿈을 제거한 뒤 비교한다)
  var COLUMNS = {
    publish: 'Publish',
    type: 'SCI/학회',
    date: '발표일자',
    venue: '저널명/학회명',
    titleKo: '제목(한글)',
    titleEn: '제목(영어)',
    country: '출판국/개최국',
    first: '1저자',
    co: '공동',
    corr: '교신',
    // 홈페이지용 열 (초기 설정에서 추가)
    exclude: '홈페이지 제외',
    kind: '구분',
    venueShort: '약칭',
    keywords: '키워드',
    paperUrl: 'Paper 링크',
    codeUrl: 'Code 링크',
    award: '수상'
  };
  var REQUIRED_HEADERS = [COLUMNS.publish, COLUMNS.date, COLUMNS.titleKo, COLUMNS.titleEn, COLUMNS.first];
  var WEBSITE_HEADERS = [COLUMNS.exclude, COLUMNS.kind, COLUMNS.venueShort, COLUMNS.keywords,
    COLUMNS.paperUrl, COLUMNS.codeUrl, COLUMNS.award];

  function str(v) {
    return String(v == null ? '' : v).trim();
  }

  function normalizeHeader(h) {
    return String(h == null ? '' : h).replace(/\s+/g, '');
  }

  function headerIndex(headers) {
    var map = {};
    (headers || []).forEach(function (h, i) {
      var k = normalizeHeader(h);
      if (k && !(k in map)) map[k] = i;
    });
    return map;
  }

  function cell(row, idx, headerName) {
    var i = idx[normalizeHeader(headerName)];
    if (i == null || !row || i >= row.length) return '';
    var v = row[i];
    return v == null ? '' : v;
  }

  function isTruthy(v) {
    if (v === true) return true;
    if (typeof v === 'number') return v !== 0;
    var s = str(v).toLowerCase();
    return s === 'true' || s === '1' || s === 'y' || s === 'yes';
  }

  return {
    COLUMNS: COLUMNS,
    REQUIRED_HEADERS: REQUIRED_HEADERS,
    WEBSITE_HEADERS: WEBSITE_HEADERS,
    str: str,
    normalizeHeader: normalizeHeader,
    headerIndex: headerIndex,
    cell: cell,
    isTruthy: isTruthy
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PubLib;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tests/*.test.js`
Expected: all 6 tests PASS.

- [ ] **Step 6: Commit**

```
git add package.json apps-script/lib.js tests/lib.test.js
git commit -m "feat(sync): scaffold PubLib with header utilities"
```
(append the trailer from Global Constraints)

---

### Task 2: Dates, authors, domestic detection

**Files:**
- Modify: `apps-script/lib.js`
- Test: `tests/lib.test.js`

**Interfaces:**
- Produces: `PubLib.parseDate(v) → {year:number, iso:string} | null`, `PubLib.splitAuthors(v) → string[]`, `PubLib.mergeAuthors(first, co, corr) → string[]`, `PubLib.isDomestic(typeCell, countryCell) → boolean`.

- [ ] **Step 1: Append failing tests to `tests/lib.test.js`**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/*.test.js`
Expected: new tests FAIL with `lib.parseDate is not a function` etc.

- [ ] **Step 3: Implement in `lib.js`** (insert before the `return {` block; add the names to the returned object)

```js
  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function ymd(y, m, d) {
    // m/d 는 null 허용 (부분 날짜). 범위 검사 후 {year, iso} 또는 null
    if (!(y >= 1900 && y <= 2100)) return null;
    if (m != null && !(m >= 1 && m <= 12)) return null;
    if (d != null && !(d >= 1 && d <= 31)) return null;
    var iso = String(y);
    if (m != null) iso += '-' + pad2(m);
    if (m != null && d != null) iso += '-' + pad2(d);
    return { year: y, iso: iso };
  }

  function parseDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) {
      if (isNaN(v.getTime())) return null;
      return ymd(v.getFullYear(), v.getMonth() + 1, v.getDate());
    }
    if (typeof v === 'number') {
      // 스프레드시트 시리얼: 1899-12-30 기준 일수
      var ms = Date.UTC(1899, 11, 30) + Math.round(v) * 86400000;
      var dt = new Date(ms);
      return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }
    var s = str(v);
    var m = s.match(/^(\d{4})(?:\s*[.\-\/년]\s*(\d{1,2})(?:\s*[.\-\/월]\s*(\d{1,2}))?)?/);
    if (!m) return null;
    return ymd(Number(m[1]), m[2] != null ? Number(m[2]) : null, m[3] != null ? Number(m[3]) : null);
  }

  function splitAuthors(v) {
    return str(v).split(/[,;\/\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function mergeAuthors(first, co, corr) {
    var out = [];
    var seen = {};
    [first, co, corr].forEach(function (v) {
      splitAuthors(v).forEach(function (a) {
        var k = a.replace(/\s+/g, '').toLowerCase();
        if (!seen[k]) { seen[k] = true; out.push(a); }
      });
    });
    return out;
  }

  function isDomestic(typeCell, countryCell) {
    return /^국내/.test(str(typeCell)) || /한국|korea/i.test(str(countryCell));
  }
```
Add to the return object: `parseDate: parseDate, splitAuthors: splitAuthors, mergeAuthors: mergeAuthors, isDomestic: isDomestic`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/*.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```
git add apps-script/lib.js tests/lib.test.js
git commit -m "feat(sync): date parsing, author merge, domestic detection"
```

---

### Task 3: Kind, venue abbreviation, slug, title normalization, URL check

**Files:**
- Modify: `apps-script/lib.js`
- Test: `tests/lib.test.js`

**Interfaces:**
- Produces: `PubLib.detectKind(kindCell, typeCell, venueCell) → 'conference'|'journal'|'workshop'`, `PubLib.detectVenueShort(shortCell, venueCell) → string`, `PubLib.slugify(title) → string`, `PubLib.normalizeTitle(title) → string`, `PubLib.checkUrl(v) → string` ('' when invalid), `PubLib.VENUE_SHORT_MAP` (array of `[RegExp, string]`).

- [ ] **Step 1: Append failing tests**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/*.test.js`
Expected: FAIL — `lib.detectKind is not a function` etc.

- [ ] **Step 3: Implement in `lib.js`** (before the `return {`; add exports `detectKind, detectVenueShort, slugify, normalizeTitle, checkUrl, VENUE_SHORT_MAP`)

```js
  // 약칭 매핑표: 저널명/학회명에 대해 위에서부터 첫 매칭. 추가/수정은 여기서.
  var VENUE_SHORT_MAP = [
    [/IEMEK|임베디드공학회/i, 'IEMEK'],
    [/\bKIPS\b|정보처리학회|\bASK\b/i, 'KIPS'],
    [/NeurIPS/i, 'NeurIPS'],
    [/\bICCV\b|ICCV-W/i, 'ICCV'],
    [/\bECCV\b|ECCV-W/i, 'ECCV'],
    [/\bCGO\b|CGO-W/i, 'CGO'],
    [/\bLCTES\b/i, 'LCTES'],
    [/\bCASES\b/i, 'CASES'],
    [/\bIJCAI\b/i, 'IJCAI'],
    [/\bIROS\b/i, 'IROS'],
    [/\bICRA\b/i, 'ICRA'],
    [/Future Generation Computer Systems/i, 'FGCS'],
    [/Transactions on Embedded Computing/i, 'TECS'],
    [/Transactions on Mobile Computing/i, 'TMC'],
    [/ETRI\s*Journal/i, 'ETRI Journal'],
    [/Parallel and Distributed Computing/i, 'JPDC'],
    [/Internet of Things Journal/i, 'IEEE IoT-J'],
    [/전자공학회/i, 'IEIE'],
    [/한국\s*컴퓨터\s*종합/i, 'KCC'],
    [/통신학회/i, 'KICS'],
    [/기계학회/i, 'KSME'],
    [/AICompS/i, 'AICompS'],
    [/\bACK\b/i, 'ACK'],
    [/Workload Characterization|\bIISWC\b/i, 'IISWC']
  ];
  var TYPE_JOURNAL_HINT = /\bSCI\b|\bKCI\b|저널|논문지|학회지|\bjournal\b/i;
  var VENUE_JOURNAL_HINT = /저널|논문지|학회지|\bjournal\b|\btransactions\b/i;
  var WORKSHOP_HINT = /workshop|-W\b|\bWIP\b/i;

  function detectKind(kindCell, typeCell, venueCell) {
    var k = str(kindCell).toLowerCase();
    if (k === 'conference' || k === 'journal' || k === 'workshop') return k;
    if (TYPE_JOURNAL_HINT.test(str(typeCell)) || VENUE_JOURNAL_HINT.test(str(venueCell))) return 'journal';
    if (WORKSHOP_HINT.test(str(venueCell))) return 'workshop';
    return 'conference';
  }

  function detectVenueShort(shortCell, venueCell) {
    var s = str(shortCell);
    if (s) return s;
    var v = str(venueCell);
    if (!v) return '';
    for (var i = 0; i < VENUE_SHORT_MAP.length; i++) {
      if (VENUE_SHORT_MAP[i][0].test(v)) return VENUE_SHORT_MAP[i][1];
    }
    var m = v.match(/\(([A-Z][A-Za-z0-9-]{1,10})\)/);
    if (m) return m[1];
    return v.split(/\s+/)[0].replace(/[,:;]+$/, '');
  }

  function slugify(title) {
    return str(title).toLowerCase()
      .replace(/[^0-9a-z가-힣]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '');
  }

  function normalizeTitle(title) {
    return str(title).normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]+/g, '');
  }

  function checkUrl(v) {
    var u = str(v);
    return /^https?:\/\//i.test(u) ? u : '';
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/*.test.js`
Expected: all PASS. (If `Unknown Venue Name` → `Unknown` fails because a map entry matched, fix the regex word boundaries, not the test.)

- [ ] **Step 5: Commit**

```
git add apps-script/lib.js tests/lib.test.js
git commit -m "feat(sync): kind/venue-short/slug/title-normalize/url helpers"
```

---

### Task 4: `convertRows`, document build, serialize, compare

**Files:**
- Modify: `apps-script/lib.js`
- Test: `tests/lib.test.js`

**Interfaces:**
- Produces:
  - `PubLib.convertRows(headers, rows, {today: Date}) → { publications: Record[], warnings: string[] }`; throws `Error('필수 헤더 없음: …')`.
  - `Record` key order: `id, year, date, type, tier, venue, venueShort, title, titleKo, titleEn, authors, keywords, paperUrl, codeUrl, award`.
  - `PubLib.buildDocument(result, {generatedAt, source}) → { schemaVersion:1, generatedAt, source, count, publications }`
  - `PubLib.serialize(doc) → string` (2-space JSON + trailing newline)
  - `PubLib.samePublications(docA, docB) → boolean` (compares `publications` arrays only)

- [ ] **Step 1: Append failing tests**

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/*.test.js`
Expected: FAIL — `lib.convertRows is not a function`.

- [ ] **Step 3: Implement in `lib.js`** (before `return {`; export `convertRows, buildDocument, serialize, samePublications`)

```js
  function compareDateDesc(a, b) {
    if (a === b) return 0;
    if (!a) return 1;   // 빈 날짜는 뒤로
    if (!b) return -1;
    return a < b ? 1 : -1;
  }

  /**
   * 시트 행 → 게시 레코드.
   * @param {Array} headers 1행 헤더
   * @param {Array<Array>} rows 2행부터의 값 (getValues() 결과)
   * @param {{today?: Date}} opts today: 날짜 없는 행의 연도 기준
   * @returns {{publications: Array, warnings: string[]}}
   */
  function convertRows(headers, rows, opts) {
    opts = opts || {};
    var today = opts.today instanceof Date ? opts.today : new Date();
    var idx = headerIndex(headers);
    var missing = REQUIRED_HEADERS.filter(function (h) { return idx[normalizeHeader(h)] == null; });
    if (missing.length) throw new Error('필수 헤더 없음: ' + missing.join(', '));

    var pubs = [];
    var warnings = [];
    (rows || []).forEach(function (row, i) {
      var rowNo = i + 2; // 시트 행 번호 (1행 = 헤더)
      var get = function (name) { return cell(row, idx, name); };
      if (!isTruthy(get(COLUMNS.publish))) return;
      if (isTruthy(get(COLUMNS.exclude))) return;

      var titleKo = str(get(COLUMNS.titleKo));
      var titleEn = str(get(COLUMNS.titleEn));
      if (!titleKo && !titleEn) { warnings.push(rowNo + '행: 제목 없음 → 제외'); return; }

      var domestic = isDomestic(get(COLUMNS.type), get(COLUMNS.country));
      var title = domestic ? (titleKo || titleEn) : (titleEn || titleKo);

      var parsed = parseDate(get(COLUMNS.date));
      var year, date;
      if (parsed) { year = parsed.year; date = parsed.iso; }
      else {
        year = today.getFullYear(); date = '';
        warnings.push(rowNo + '행 "' + title.slice(0, 30) + '": 발표일자 없음 → ' + year + '년으로 배치');
      }

      var paperRaw = str(get(COLUMNS.paperUrl)), codeRaw = str(get(COLUMNS.codeUrl));
      var paperUrl = checkUrl(paperRaw), codeUrl = checkUrl(codeRaw);
      if (paperRaw && !paperUrl) warnings.push(rowNo + '행: Paper 링크 형식 오류(http/https 필요) → 무시');
      if (codeRaw && !codeUrl) warnings.push(rowNo + '행: Code 링크 형식 오류(http/https 필요) → 무시');

      var venue = str(get(COLUMNS.venue));
      if (!venue) warnings.push(rowNo + '행 "' + title.slice(0, 30) + '": 저널명/학회명 없음 → 카드에 학회명이 비어 보임');

      pubs.push({
        id: '',
        year: year,
        date: date,
        type: detectKind(get(COLUMNS.kind), get(COLUMNS.type), get(COLUMNS.venue)),
        tier: domestic ? 'normal' : 'top',
        venue: venue,
        venueShort: detectVenueShort(get(COLUMNS.venueShort), venue),
        title: title,
        titleKo: titleKo,
        titleEn: titleEn,
        authors: mergeAuthors(get(COLUMNS.first), get(COLUMNS.co), get(COLUMNS.corr)),
        keywords: str(get(COLUMNS.keywords)),
        paperUrl: paperUrl,
        codeUrl: codeUrl,
        award: str(get(COLUMNS.award)),
        _order: i
      });
    });

    pubs.sort(function (a, b) {
      return (b.year - a.year) || compareDateDesc(a.date, b.date) || (a._order - b._order);
    });

    var used = {};
    pubs.forEach(function (p) {
      var base = p.year + '-' + slugify(p.title);
      var id = base, n = 1;
      while (used[id]) id = base + '-' + (++n);
      used[id] = true;
      p.id = id;
      delete p._order;
    });

    return { publications: pubs, warnings: warnings };
  }

  function buildDocument(result, meta) {
    meta = meta || {};
    return {
      schemaVersion: 1,
      generatedAt: meta.generatedAt || '',
      source: meta.source || '논문 등록',
      count: result.publications.length,
      publications: result.publications
    };
  }

  function serialize(doc) {
    return JSON.stringify(doc, null, 2) + '\n';
  }

  function samePublications(a, b) {
    if (!a || !b || !a.publications || !b.publications) return false;
    return JSON.stringify(a.publications) === JSON.stringify(b.publications);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/*.test.js`
Expected: all PASS.

- [ ] **Step 5: Commit**

```
git add apps-script/lib.js tests/lib.test.js
git commit -m "feat(sync): convertRows + document build/serialize/compare"
```

---

### Task 5: Seed extraction tool → `apps-script/seed.js`

Run this task **before Task 8** (it reads the current hand-written `publications.html`).

**Files:**
- Create: `tools/extract_seed.mjs`
- Create (generated): `apps-script/seed.js`
- Test: `tests/seed.test.js`

**Interfaces:**
- Produces: `apps-script/seed.js` defining global `var PUB_SEED = { [normalizedTitle]: { title: string, keywords: string } }`.
- Consumes: `PubLib.normalizeTitle`.

- [ ] **Step 1: Write the failing test** — `tests/seed.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const lib = require('../apps-script/lib.js');

function loadSeed() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'seed.js'), 'utf8');
  return vm.runInNewContext(src + ';PUB_SEED', {});
}

test('seed.js defines PUB_SEED with normalized keys and non-empty keywords', () => {
  const seed = loadSeed();
  const keys = Object.keys(seed);
  assert.ok(keys.length >= 40, `expected ≥40 seed entries, got ${keys.length}`);
  for (const k of keys) {
    assert.equal(k, lib.normalizeTitle(k), `key not normalized: ${k}`);
    assert.ok(seed[k].keywords && seed[k].keywords.trim(), `empty keywords for ${k}`);
    assert.ok(seed[k].title, `missing title for ${k}`);
  }
});

test('seed matches known sheet titles', () => {
  const seed = loadSeed();
  const hit = seed[lib.normalizeTitle('타일링과 스케줄링: 딥러닝 가속 하드웨어의 실행 코드 최적화')];
  assert.ok(hit, 'expected the 2020 KCC paper in seed');
  assert.equal(hit.keywords, 'Tiling · Scheduling Optimization');
  const hit2 = seed[lib.normalizeTitle('비동기 큐 파이프라인 기법을 통한 임베디드 환경에서 추론 처리량 개선')];
  assert.equal(hit2.keywords, 'Edge AI · NPU · Asynchronous Queue');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/seed.test.js`
Expected: FAIL — `ENOENT … apps-script/seed.js`.

- [ ] **Step 3: Write `tools/extract_seed.mjs`**

```js
#!/usr/bin/env node
/*
 * tools/extract_seed.mjs — 손으로 작성된 publications.html 에서 (제목 → 키워드) 를 뽑아
 * apps-script/seed.js 를 생성한다. "초기 설정" 메뉴가 시트의 빈 '키워드' 셀을 채울 때 사용.
 *
 * 사용법: node tools/extract_seed.mjs <publications.html 경로> [출력 경로]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lib = require('../apps-script/lib.js');
const here = path.dirname(fileURLToPath(import.meta.url));

const input = process.argv[2];
const output = process.argv[3] || path.join(here, '..', 'apps-script', 'seed.js');
if (!input) {
  console.error('사용법: node tools/extract_seed.mjs <publications.html> [seed.js]');
  process.exit(1);
}

const text = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const html = fs.readFileSync(input, 'utf8').replace(/<!--[\s\S]*?-->/g, ''); // 주석 처리된 예시 카드 제외

const seed = {};
const cardRe = /<article class="pnu-pub-card[^"]*"[\s\S]*?<\/article>/g;
for (const [card] of html.matchAll(cardRe)) {
  const title = card.match(/<h3 class="pnu-title">([\s\S]*?)<\/h3>/);
  const metas = [...card.matchAll(/<span class="pnu-meta">([\s\S]*?)<\/span>/g)].map(m => text(m[1]));
  if (!title) continue;
  const t = text(title[1]);
  const keywords = metas[1] || '';
  if (!keywords) continue;
  seed[lib.normalizeTitle(t)] = { title: t, keywords };
}

const body = JSON.stringify(seed, null, 2);
const out = `/*
 * apps-script/seed.js — 생성 파일 (tools/extract_seed.mjs). 손으로 편집하지 말 것.
 * 초기 설정(setupWebsiteColumns)에서 시트의 빈 '키워드' 셀을 채우는 데만 사용한다.
 * 키: PubLib.normalizeTitle(제목)
 */
var PUB_SEED = ${body};
`;
fs.writeFileSync(output, out);
console.log(`${Object.keys(seed).length} entries → ${path.relative(process.cwd(), output)}`);
```

- [ ] **Step 4: Generate the seed**

Run: `node tools/extract_seed.mjs publications.html`
Expected: `51 entries → apps-script/seed.js`

- [ ] **Step 5: Run the seed tests**

Run: `node --test tests/seed.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```
git add tools/extract_seed.mjs apps-script/seed.js tests/seed.test.js
git commit -m "feat(sync): seed extraction tool + generated keyword seed"
```

---

### Task 6: Manual sync tool + bootstrap `data/publications.json`

**Files:**
- Create: `tools/sync_from_sheet.mjs`
- Create (generated): `data/publications.json`
- Test: `tests/data.test.js`

**Interfaces:**
- Consumes: `PubLib.convertRows`, `PubLib.buildDocument`, `PubLib.serialize`.
- Produces: `data/publications.json` per the schema in Task 4.

- [ ] **Step 1: Write the failing test** — `tests/data.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', 'data', 'publications.json');
const KEYS = ['id', 'year', 'date', 'type', 'tier', 'venue', 'venueShort', 'title', 'titleKo', 'titleEn',
  'authors', 'keywords', 'paperUrl', 'codeUrl', 'award'];

test('data/publications.json exists and matches the schema', () => {
  const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  assert.equal(doc.schemaVersion, 1);
  assert.ok(Array.isArray(doc.publications));
  assert.equal(doc.count, doc.publications.length);
  assert.ok(doc.count >= 50, `expected ≥50 publications, got ${doc.count}`);
  const ids = new Set();
  let prev = null;
  for (const p of doc.publications) {
    assert.deepEqual(Object.keys(p), KEYS, `key order for ${p.id}`);
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`); ids.add(p.id);
    assert.ok(['conference', 'journal', 'workshop'].includes(p.type), p.id);
    assert.ok(['top', 'normal'].includes(p.tier), p.id);
    assert.ok(p.title && p.authors.length > 0, `incomplete ${p.id}`);
    assert.equal(typeof p.venueShort, 'string'); // 저널명이 비어 있는 행은 '' 허용 (갱신 시 경고로 안내)
    if (prev) assert.ok(prev.year >= p.year, 'sorted by year desc');
    prev = p;
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/data.test.js`
Expected: FAIL — `ENOENT … data/publications.json`.

- [ ] **Step 3: Write `tools/sync_from_sheet.mjs`**

```js
#!/usr/bin/env node
/*
 * tools/sync_from_sheet.mjs — Google 시트('논문 등록' 탭)를 읽어 data/publications.json 을 만든다.
 * Apps Script 없이 수동으로 갱신할 때(또는 최초 생성) 사용. 시트가 "링크가 있는 모든 사용자에게 보기 허용"
 * 상태여야 한다. 이후 `git add data/publications.json && git commit && git push`.
 *
 * 사용법: node tools/sync_from_sheet.mjs [--out data/publications.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lib = require('../apps-script/lib.js');
const here = path.dirname(fileURLToPath(import.meta.url));

const SHEET_ID = '1Iz3_QLSXu6Ovww27wobo3JcsCSPZrhWN-OwEQnwjnc4';
const TAB = '논문 등록';
const URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(TAB)}`;

const outArg = process.argv.indexOf('--out');
const outFile = outArg > -1 ? path.resolve(process.argv[outArg + 1]) : path.join(here, '..', 'data', 'publications.json');

// RFC 4180 CSV (따옴표 안의 줄바꿈/쉼표/"" 처리)
export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => v !== ''));
}

async function main() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`시트 다운로드 실패: HTTP ${res.status} (시트 공유 설정이 "링크가 있는 모든 사용자"인지 확인)`);
  const rows = parseCsv(await res.text());
  if (rows.length < 2) throw new Error('시트에 데이터가 없습니다.');
  const [headers, ...data] = rows;
  const result = lib.convertRows(headers, data, { today: new Date() });
  const doc = lib.buildDocument(result, { generatedAt: new Date().toISOString(), source: TAB });
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, lib.serialize(doc));
  console.log(`${doc.count}건 → ${path.relative(process.cwd(), outFile)}`);
  for (const w of result.warnings) console.warn('⚠', w);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error('오류:', err.message); process.exit(1); });
}
```

- [ ] **Step 4: Generate the data file**

Run: `node tools/sync_from_sheet.mjs`
Expected: `58건 → data/publications.json` (±: whatever `Publish`-checked rows exist at run time) and one warning like `⚠ N행 "Validity-Aware …": 발표일자 없음 → 2026년으로 배치`.

- [ ] **Step 5: Inspect the output quickly**

Run: `node -e "const d=require('./data/publications.json');console.log(d.count);for(const p of d.publications.slice(0,5))console.log(p.year,p.type,p.tier,p.venueShort,'|',p.title.slice(0,50))"`
Expected: newest first; 2026 rows; `IEMEK`/`KIPS`/`TMC` style pills; titles in Korean for domestic, English for international.

Also count by type: `node -e "const d=require('./data/publications.json');const c={};for(const p of d.publications)c[p.type]=(c[p.type]||0)+1;console.log(c)"`

- [ ] **Step 6: Run data tests**

Run: `node --test tests/data.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```
git add tools/sync_from_sheet.mjs data/publications.json tests/data.test.js
git commit -m "feat(sync): manual sheet→json tool + bootstrap data/publications.json"
```

---

### Task 7: Renderer `js/publications.js`

**Files:**
- Create: `js/publications.js`
- Test: `tests/render.test.js`

**Interfaces:**
- Produces (CommonJS export + `window.PnuPublications`): `esc(s)`, `safeUrl(u)`, `tagsFor(p)`, `cardHtml(p)`, `buildPublicationsHtml(doc)`, `initFilters(doc)`; browser entry point auto-runs when `document` exists and `#pubList` is present.

- [ ] **Step 1: Write the failing tests** — `tests/render.test.js`

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/publications.js');

const P = (o) => ({ id: '2026-x', year: 2026, date: '2026-05-13', type: 'conference', tier: 'normal',
  venue: 'IEMEK ISET 2026', venueShort: 'IEMEK', title: 'Title', titleKo: '', titleEn: '',
  authors: ['A', 'B'], keywords: '', paperUrl: '', codeUrl: '', award: '', ...o });

test('esc escapes HTML special chars', () => {
  assert.equal(R.esc(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
});

test('tagsFor: conference / journal / workshop / awarded', () => {
  assert.equal(R.tagsFor(P({})), 'conference');
  assert.equal(R.tagsFor(P({ type: 'journal' })), 'journal');
  assert.equal(R.tagsFor(P({ type: 'workshop' })), 'conference,workshop');
  assert.equal(R.tagsFor(P({ type: 'journal', award: 'Best' })), 'journal,awarded');
});

test('cardHtml: basic card structure and classes', () => {
  const h = R.cardHtml(P({}));
  assert.match(h, /^<article class="pnu-pub-card" data-tags="conference" id="2026-x">/);
  assert.match(h, /<div class="pnu-venue-pill pnu-venue-conf">IEMEK<\/div>/);
  assert.match(h, /<div class="pnu-venue-meta">Conference<\/div>/);
  assert.match(h, /<h3 class="pnu-title">Title<\/h3>/);
  assert.match(h, /<p class="pnu-authors">A, B<\/p>/);
  assert.match(h, /<span class="pnu-meta">IEMEK ISET 2026<\/span>/);
  assert.doesNotMatch(h, /pnu-pub-top/);
  assert.doesNotMatch(h, /pnu-dot/);
});

test('cardHtml: tier top, journal/workshop labels, keywords with separator', () => {
  const h = R.cardHtml(P({ tier: 'top', type: 'journal', keywords: 'Edge AI · NPU' }));
  assert.match(h, /pnu-venue-pill pnu-venue-top/);
  assert.match(h, /<div class="pnu-venue-meta">Journal<\/div>/);
  assert.match(h, /<span class="pnu-dot">\|<\/span><span class="pnu-meta">Edge AI · NPU<\/span>/);
  assert.match(R.cardHtml(P({ type: 'workshop' })), /<div class="pnu-venue-meta">Workshop<\/div>/);
  assert.match(R.cardHtml(P({ venueShort: '' })), /<div class="pnu-venue-pill pnu-venue-conf">—<\/div>/);
});

test('cardHtml: award badge + awarded class; links only for valid http(s) URLs', () => {
  const h = R.cardHtml(P({ award: '⭐ Best Paper', paperUrl: 'https://a/p', codeUrl: 'javascript:alert(1)' }));
  assert.match(h, /<article class="pnu-pub-card pnu-pub-awarded" data-tags="conference,awarded"/);
  assert.match(h, /<span class="pnu-badge pnu-badge-award">⭐ Best Paper<\/span>/);
  assert.match(h, /<a class="pnu-link pnu-link-paper" href="https:\/\/a\/p" target="_blank" rel="noreferrer">Paper<\/a>/);
  assert.doesNotMatch(h, /pnu-link-code/);
  const h2 = R.cardHtml(P({ codeUrl: 'https://g/h' }));
  assert.match(h2, /<div class="pnu-pub-top"><div class="pnu-badges"><\/div><div class="pnu-links">/);
  assert.match(h2, /pnu-link-code/);
});

test('cardHtml escapes user text (no script injection)', () => {
  const h = R.cardHtml(P({ title: '<script>alert(1)</script>', venueShort: '<b>', authors: ['<i>'] }));
  assert.doesNotMatch(h, /<script>/);
  assert.match(h, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(h, /pnu-venue-conf">&lt;b&gt;</);
  assert.match(h, /pnu-authors">&lt;i&gt;</);
});

test('buildPublicationsHtml groups by year (desc) with the year badge markup', () => {
  const html = R.buildPublicationsHtml({ publications: [P({ year: 2025, id: 'a' }), P({ year: 2026, id: 'b' }), P({ year: 2025, id: 'c' })] });
  const blocks = html.match(/<div class="pnu-year-block">/g);
  assert.equal(blocks.length, 2);
  assert.ok(html.indexOf('>2026</div>') < html.indexOf('>2025</div>'));
  assert.match(html, /<div class="pnu-year-badge"><div class="text-sm text-slate-500 font-semibold">Year<\/div><div class="text-3xl font-extrabold tracking-tight text-slate-900">2026<\/div><\/div><div class="pnu-pub-list">/);
  assert.equal((html.match(/<article /g) || []).length, 3);
  assert.equal(R.buildPublicationsHtml({ publications: [] }), '');
  assert.equal(R.buildPublicationsHtml(null), '');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test tests/render.test.js`
Expected: FAIL — `Cannot find module '../js/publications.js'`.

- [ ] **Step 3: Write `js/publications.js`**

```js
/*
 * js/publications.js — data/publications.json → 논문 카드 렌더링 + 필터
 *
 * 데이터는 Google 시트('논문 등록')에서 Apps Script가 GitHub에 커밋한다 (apps-script/README.md 참고).
 * 카드 마크업/클래스는 css/redesign.css 의 .pnu-pub-* 스타일과 1:1 이므로 바꿀 때 CSS 도 함께 볼 것.
 * Node 테스트(tests/render.test.js)에서도 require 되므로 브라우저 전용 코드는 아래 진입점 안에만 둔다.
 */
(function (root) {
  'use strict';

  var KIND_LABEL = { conference: 'Conference', journal: 'Journal', workshop: 'Workshop' };
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  }

  function safeUrl(u) {
    u = String(u == null ? '' : u).trim();
    return /^https?:\/\//i.test(u) ? u : '';
  }

  function tagsFor(p) {
    var tags = p.type === 'journal' ? ['journal'] : p.type === 'workshop' ? ['conference', 'workshop'] : ['conference'];
    if (p.award) tags.push('awarded');
    return tags.join(',');
  }

  function cardHtml(p) {
    var paper = safeUrl(p.paperUrl);
    var code = safeUrl(p.codeUrl);
    var top = '';
    if (p.award || paper || code) {
      top = '<div class="pnu-pub-top">' +
        '<div class="pnu-badges">' + (p.award ? '<span class="pnu-badge pnu-badge-award">' + esc(p.award) + '</span>' : '') + '</div>' +
        ((paper || code)
          ? '<div class="pnu-links">' +
            (paper ? '<a class="pnu-link pnu-link-paper" href="' + esc(paper) + '" target="_blank" rel="noreferrer">Paper</a>' : '') +
            (code ? '<a class="pnu-link pnu-link-code" href="' + esc(code) + '" target="_blank" rel="noreferrer">Code</a>' : '') +
            '</div>'
          : '') +
        '</div>';
    }
    var meta = '<span class="pnu-meta">' + esc(p.venue) + '</span>' +
      (p.keywords ? '<span class="pnu-dot">|</span><span class="pnu-meta">' + esc(p.keywords) + '</span>' : '');
    return '<article class="pnu-pub-card' + (p.award ? ' pnu-pub-awarded' : '') + '" data-tags="' + tagsFor(p) + '" id="' + esc(p.id) + '">' +
      '<div class="pnu-pub-side">' +
        '<div class="pnu-venue-pill ' + (p.tier === 'top' ? 'pnu-venue-top' : 'pnu-venue-conf') + '">' + (esc(p.venueShort) || '—') + '</div>' +
        '<div class="pnu-venue-meta">' + (KIND_LABEL[p.type] || 'Conference') + '</div>' +
      '</div>' +
      '<div class="pnu-pub-main">' + top +
        '<h3 class="pnu-title">' + esc(p.title) + '</h3>' +
        '<p class="pnu-authors">' + esc((p.authors || []).join(', ')) + '</p>' +
        '<div class="pnu-meta-row">' + meta + '</div>' +
      '</div>' +
    '</article>';
  }

  function buildPublicationsHtml(doc) {
    var pubs = (doc && doc.publications) || [];
    var years = [];
    var byYear = {};
    pubs.forEach(function (p) {
      if (!byYear[p.year]) { byYear[p.year] = []; years.push(p.year); }
      byYear[p.year].push(p);
    });
    years.sort(function (a, b) { return b - a; });
    return years.map(function (y) {
      return '<div class="pnu-year-block">' +
        '<div class="pnu-year-badge"><div class="text-sm text-slate-500 font-semibold">Year</div>' +
        '<div class="text-3xl font-extrabold tracking-tight text-slate-900">' + y + '</div></div>' +
        '<div class="pnu-pub-list">' + byYear[y].map(cardHtml).join('') + '</div>' +
      '</div>';
    }).join('');
  }

  // 필터 칩 (#pubFilters [data-filter]) — 기존 publications.html 인라인 스크립트와 동일한 동작
  function initFilters(doc) {
    var filterBar = doc.getElementById('pubFilters');
    if (!filterBar) return;
    var chips = Array.prototype.slice.call(filterBar.querySelectorAll('[data-filter]'));
    var cards = Array.prototype.slice.call(doc.querySelectorAll('.pnu-pub-card'));
    var yearBlocks = Array.prototype.slice.call(doc.querySelectorAll('.pnu-year-block'));

    function normalizeTags(tagStr) {
      return (tagStr || '').split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    }
    function applyFilter(filterKey) {
      chips.forEach(function (c) { c.classList.toggle('is-active', c.dataset.filter === filterKey); });
      cards.forEach(function (card) {
        var tags = normalizeTags(card.getAttribute('data-tags'));
        card.style.display = (filterKey === 'all' || tags.indexOf(filterKey) !== -1) ? '' : 'none';
      });
      yearBlocks.forEach(function (block) {
        var visible = Array.prototype.slice.call(block.querySelectorAll('.pnu-pub-card'))
          .filter(function (c) { return c.style.display !== 'none'; });
        block.style.display = visible.length ? '' : 'none';
      });
    }
    if (!filterBar.__pnuBound) {
      filterBar.__pnuBound = true;
      filterBar.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-filter]');
        if (btn) applyFilter(btn.dataset.filter);
      });
    }
    applyFilter('all');
  }

  var api = { esc: esc, safeUrl: safeUrl, tagsFor: tagsFor, cardHtml: cardHtml,
    buildPublicationsHtml: buildPublicationsHtml, initFilters: initFilters };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // ---- 브라우저 진입점 ----
  if (typeof document !== 'undefined') {
    root.PnuPublications = api;
    var run = function () {
      var mount = document.getElementById('pubList');
      if (!mount) return;
      fetch('data/publications.json', { cache: 'no-cache' })
        .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .then(function (data) {
          var html = buildPublicationsHtml(data);
          mount.innerHTML = html || '<p class="text-slate-500">등록된 논문이 없습니다.</p>';
          initFilters(document);
        })
        .catch(function (err) {
          console.error('[publications] load failed:', err);
          mount.innerHTML = '<p class="text-slate-600">논문 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>';
        });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/render.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```
git add js/publications.js tests/render.test.js
git commit -m "feat(site): render publications from data/publications.json"
```

---

### Task 8: Swap `publications.html` to the JSON-driven list

**Files:**
- Modify: `publications.html` (lines 56–1295: the `<!-- Year block -->` list; lines 1300–1346: scripts)
- Create (temporary, not committed): `$CLAUDE_JOB_DIR/tmp/swap_publications.mjs`

**Interfaces:**
- Consumes: `js/publications.js` browser entry (mount `#pubList`, filter bar `#pubFilters`).

- [ ] **Step 1: Confirm the region boundaries**

Run: `grep -n 'Year block\|class="space-y-12"\|</section>\|<script\|</script>' publications.html`
Expected: `56: <!-- Year block -->`, `57: <div class="space-y-12">`, `1296: </section>`, `1300–1301` script tags for main.js/layout.js, `1302 <script>` … `1346 </script>`.

- [ ] **Step 2: Write the swap script** to `/Users/jun/.claude/jobs/21e201e1/tmp/swap_publications.mjs`

```js
import fs from 'node:fs';
const file = process.argv[2];
let html = fs.readFileSync(file, 'utf8');

// 1) 카드 목록 → 마운트 포인트
const start = html.indexOf('                <!-- Year block -->');
const end = html.indexOf('            </section>', start);
if (start < 0 || end < 0) throw new Error('year block region not found');
const mount = `                <!-- 논문 목록: data/publications.json 을 js/publications.js 가 렌더링합니다.
                     데이터는 Google 시트('논문 등록') → 메뉴 "🌐 홈페이지 ▸ 논문 목록 갱신" 으로 갱신 (apps-script/README.md).
                     이 HTML 을 직접 편집하지 마세요. -->
                <div class="space-y-12" id="pubList" aria-live="polite">
                    <p class="text-slate-500">논문 목록을 불러오는 중…</p>
                </div>
                <noscript><p class="text-slate-600">논문 목록을 보려면 JavaScript 를 켜 주세요.</p></noscript>
`;
html = html.slice(0, start) + mount + html.slice(end);

// 2) 인라인 필터 스크립트 제거 → js/publications.js 로드
const sStart = html.indexOf('    <script>\n        (function () {\n            const filterBar');
const sEnd = html.indexOf('    </script>\n', sStart) + '    </script>\n'.length;
if (sStart < 0) throw new Error('inline filter script not found');
html = html.slice(0, sStart) + html.slice(sEnd);
html = html.replace('    <script src="js/layout.js"></script>\n', '    <script src="js/layout.js"></script>\n    <script src="js/publications.js"></script>\n');
fs.writeFileSync(file, html);
console.log('ok', html.split('\n').length, 'lines');
```

- [ ] **Step 3: Run it**

Run: `node /Users/jun/.claude/jobs/21e201e1/tmp/swap_publications.mjs publications.html`
Expected: `ok ~70 lines`.

- [ ] **Step 4: Verify the result**

Run: `grep -n 'pubList\|publications.js\|pnu-pub-card\|<script' publications.html`
Expected: `id="pubList"` present, `js/publications.js` loaded after `js/layout.js`, **no** `pnu-pub-card` occurrences, no inline `<script>` block other than the tailwind CDN + 3 `src` scripts. `grep -c 'ㅌㄴ' publications.html` → 0.

- [ ] **Step 5: Browser smoke test (local static server)**

Run (background): `python3 -m http.server 8765 --bind 127.0.0.1` from the worktree root, then
Run: `curl -s http://127.0.0.1:8765/data/publications.json | head -c 300`
Expected: JSON begins with `{ "schemaVersion": 1`.
Then use the Chrome tools (or `open http://127.0.0.1:8765/publications.html`) to load the page: year blocks render, clicking `Journal` hides conference cards and empty year blocks, `Awarded` shows an empty list (no awards yet), `All` restores. Take a screenshot for the final report if the Chrome tools are available. Stop the server afterwards.

- [ ] **Step 6: Commit**

```
git add publications.html
git commit -m "feat(site): publications page renders from data/publications.json"
```

---

### Task 9: Apps Script glue `apps-script/Code.gs`

**Files:**
- Create: `apps-script/Code.gs`

**Interfaces:**
- Consumes: global `PubLib` (lib.js pasted as `lib.gs`), global `PUB_SEED` (seed.js pasted as `seed.gs`).
- Produces: menu functions `syncPublicationsToGitHub`, `previewPublications`, `setupWebsiteColumns`, `configureGitHubToken`, `addWebsiteMenu`, `onOpen`.

- [ ] **Step 1: Write `apps-script/Code.gs`**

```js
/*
 * apps-script/Code.gs — Google 시트 → GitHub(data/publications.json) 업로드
 *
 * 설치: 이 파일 + lib.js(→ lib.gs) + seed.js(→ seed.gs) 를 시트의 Apps Script 프로젝트에 붙여넣는다.
 * 자세한 절차는 apps-script/README.md.
 *
 * 이미 프로젝트에 onOpen() 이 있으면 아래 onOpen 을 지우고 기존 onOpen 안에 addWebsiteMenu(); 한 줄을 추가한다.
 */
var CONFIG = {
  sheetName: '논문 등록',
  logSheetName: '홈페이지 갱신 로그',
  repo: 'SOTA-PNU/SOTA-PNU.github.io',
  branch: 'main',
  path: 'data/publications.json',
  siteUrl: 'https://sota.pusan.ac.kr/publications.html'
};
var TOKEN_KEY = 'GITHUB_TOKEN';

function onOpen() {
  addWebsiteMenu();
}

function addWebsiteMenu() {
  SpreadsheetApp.getUi().createMenu('🌐 홈페이지')
    .addItem('논문 목록 갱신 → GitHub 업로드', 'syncPublicationsToGitHub')
    .addItem('미리보기 (검증만, 업로드 없음)', 'previewPublications')
    .addSeparator()
    .addItem('초기 설정 (홈페이지 열 추가)', 'setupWebsiteColumns')
    .addItem('GitHub 토큰 설정', 'configureGitHubToken')
    .addToUi();
}

// ---------------------------------------------------------------- 시트 읽기

function readPublicationRows_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetName);
  if (!sh) throw new Error('"' + CONFIG.sheetName + '" 탭을 찾을 수 없습니다.');
  var values = sh.getDataRange().getValues();
  if (values.length < 2) throw new Error('"' + CONFIG.sheetName + '" 탭에 데이터가 없습니다.');
  return { headers: values[0], rows: values.slice(1) };
}

function buildPublications_() {
  var data = readPublicationRows_();
  var result = PubLib.convertRows(data.headers, data.rows, { today: new Date() });
  var doc = PubLib.buildDocument(result, { generatedAt: new Date().toISOString(), source: CONFIG.sheetName });
  return { doc: doc, warnings: result.warnings };
}

function summarize_(doc, warnings) {
  var byYear = {};
  doc.publications.forEach(function (p) { byYear[p.year] = (byYear[p.year] || 0) + 1; });
  var years = Object.keys(byYear).sort(function (a, b) { return b - a; })
    .map(function (y) { return y + '년 ' + byYear[y] + '건'; }).join(', ');
  var s = '게시 대상: ' + doc.count + '건\n' + years + '\n';
  if (warnings.length) {
    s += '\n⚠ 경고 ' + warnings.length + '건\n' + warnings.slice(0, 15).join('\n') + (warnings.length > 15 ? '\n…' : '');
  } else {
    s += '\n경고 없음';
  }
  return s;
}

// ---------------------------------------------------------------- 메뉴 동작

function previewPublications() {
  var ui = SpreadsheetApp.getUi();
  try {
    var b = buildPublications_();
    ui.alert('미리보기', summarize_(b.doc, b.warnings), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('오류', String(e.message || e), ui.ButtonSet.OK);
  }
}

function syncPublicationsToGitHub() {
  var ui = SpreadsheetApp.getUi();
  var user = getUserEmail_();
  var started = new Date();
  try {
    var token = getToken_();
    if (!token) {
      ui.alert('GitHub 토큰이 없습니다', '메뉴 🌐 홈페이지 ▸ "GitHub 토큰 설정" 을 먼저 실행하세요.', ui.ButtonSet.OK);
      return;
    }
    var b = buildPublications_();
    if (b.warnings.length) {
      var answer = ui.alert('경고 ' + b.warnings.length + '건', summarize_(b.doc, b.warnings) + '\n\n계속 업로드할까요?', ui.ButtonSet.YES_NO);
      if (answer !== ui.Button.YES) { log_(started, user, b.doc.count, '취소 (경고 확인)', b.warnings); return; }
    }
    var remote = githubGetFile_(token);
    if (remote && remote.doc && PubLib.samePublications(remote.doc, b.doc)) {
      SpreadsheetApp.getActiveSpreadsheet().toast('홈페이지 데이터가 이미 최신입니다 (변경 없음).', '🌐 홈페이지', 8);
      log_(started, user, b.doc.count, '변경 없음', b.warnings);
      return;
    }
    var message = 'chore(publications): sync ' + b.doc.count + ' papers from sheet' + (user ? '\n\nTriggered-by: ' + user : '');
    var commit = githubPutFile_(token, PubLib.serialize(b.doc), message, remote ? remote.sha : null);
    log_(started, user, b.doc.count, commit.html_url, b.warnings);
    ui.alert('완료', '업로드했습니다. 1~2분 후 홈페이지에 반영됩니다.\n\n' + CONFIG.siteUrl + '\n커밋: ' + commit.html_url, ui.ButtonSet.OK);
  } catch (e) {
    log_(started, user, '', '실패: ' + String(e.message || e), []);
    ui.alert('업로드 실패', String(e.message || e), ui.ButtonSet.OK);
  }
}

function configureGitHubToken() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('GitHub 토큰 설정',
    'GitHub fine-grained Personal Access Token 을 붙여넣으세요.\n' +
    '(저장소: ' + CONFIG.repo + ' / 권한: Contents — Read and write)\n' +
    '토큰은 이 스크립트의 속성 저장소에만 보관되며 시트에는 기록되지 않습니다.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var token = r.getResponseText().trim();
  if (!token) { ui.alert('토큰이 비어 있습니다.'); return; }
  var check = githubApi_(token, 'get', '/repos/' + CONFIG.repo);
  if (check.status !== 200) { ui.alert('토큰 확인 실패', explainStatus_(check), ui.ButtonSet.OK); return; }
  var perms = JSON.parse(check.body).permissions || {};
  if (perms.push === false) {
    ui.alert('토큰 확인 실패', '이 토큰(계정)으로는 저장소에 쓸 수 없습니다. 저장소 쓰기 권한이 있는 계정으로 Contents: Read and write 토큰을 발급하세요.', ui.ButtonSet.OK);
    return;
  }
  PropertiesService.getScriptProperties().setProperty(TOKEN_KEY, token);
  ui.alert('저장 완료', '토큰을 저장했습니다. 저장소 ' + CONFIG.repo + ' 접근이 확인되었습니다.\n첫 "논문 목록 갱신" 실행에서 쓰기 권한이 최종 확인됩니다.', ui.ButtonSet.OK);
}

function setupWebsiteColumns() {
  var ui = SpreadsheetApp.getUi();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetName);
  if (!sh) { ui.alert('"' + CONFIG.sheetName + '" 탭이 없습니다.'); return; }

  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var idx = PubLib.headerIndex(headers);
  var added = [];
  PubLib.WEBSITE_HEADERS.forEach(function (name) {
    if (idx[PubLib.normalizeHeader(name)] != null) return;
    lastCol += 1;
    sh.getRange(1, lastCol).setValue(name).setFontWeight('bold').setBackground('#e8f0fe');
    idx[PubLib.normalizeHeader(name)] = lastCol - 1;
    added.push(name);
  });

  var n = Math.max(sh.getLastRow() - 1, 1);
  var C = PubLib.COLUMNS;
  if (added.indexOf(C.exclude) !== -1) {
    // insertCheckboxes 는 값을 false 로 초기화하므로 새로 만든 열에만 적용
    sh.getRange(2, idx[PubLib.normalizeHeader(C.exclude)] + 1, n, 1).insertCheckboxes();
  }
  var kindRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Conference', 'Journal', 'Workshop'], true).setAllowInvalid(true).build();
  sh.getRange(2, idx[PubLib.normalizeHeader(C.kind)] + 1, n, 1).setDataValidation(kindRule);

  var filled = seedKeywords_(sh, idx, n);
  ui.alert('초기 설정 완료',
    (added.length ? '추가된 열: ' + added.join(', ') : '홈페이지용 열이 이미 있어 추가하지 않았습니다.') +
    '\n키워드 자동 채움: ' + filled + '건 (빈 셀만)', ui.ButtonSet.OK);
}

function seedKeywords_(sh, idx, n) {
  if (typeof PUB_SEED === 'undefined') return 0;
  var C = PubLib.COLUMNS;
  var koCol = idx[PubLib.normalizeHeader(C.titleKo)];
  var enCol = idx[PubLib.normalizeHeader(C.titleEn)];
  var kwCol = idx[PubLib.normalizeHeader(C.keywords)];
  if (koCol == null || enCol == null || kwCol == null) return 0;
  var values = sh.getRange(2, 1, n, sh.getLastColumn()).getValues();
  var kwRange = sh.getRange(2, kwCol + 1, n, 1);
  var kws = kwRange.getValues();
  var filled = 0;
  for (var i = 0; i < n; i++) {
    if (PubLib.str(kws[i][0])) continue;
    var hit = PUB_SEED[PubLib.normalizeTitle(values[i][koCol])] || PUB_SEED[PubLib.normalizeTitle(values[i][enCol])];
    if (hit && hit.keywords) { kws[i][0] = hit.keywords; filled++; }
  }
  if (filled) kwRange.setValues(kws);
  return filled;
}

// ---------------------------------------------------------------- GitHub API

function githubApi_(token, method, path, payload) {
  var options = {
    method: method,
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  };
  if (payload) options.payload = JSON.stringify(payload);
  var res = UrlFetchApp.fetch('https://api.github.com' + path, options);
  return { status: res.getResponseCode(), body: res.getContentText() };
}

function contentsPath_() {
  return '/repos/' + CONFIG.repo + '/contents/' + CONFIG.path;
}

function githubGetFile_(token) {
  var r = githubApi_(token, 'get', contentsPath_() + '?ref=' + encodeURIComponent(CONFIG.branch));
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error(explainStatus_(r));
  var json = JSON.parse(r.body);
  var text = Utilities.newBlob(Utilities.base64Decode(String(json.content || '').replace(/\n/g, ''))).getDataAsString('UTF-8');
  var doc = null;
  try { doc = JSON.parse(text); } catch (e) { doc = null; }
  return { sha: json.sha, doc: doc };
}

function githubPutFile_(token, content, message, sha) {
  var payload = {
    message: message,
    content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
    branch: CONFIG.branch
  };
  if (sha) payload.sha = sha;
  var r = githubApi_(token, 'put', contentsPath_(), payload);
  if (r.status === 409 || r.status === 422) {
    // sha 불일치(다른 사람이 방금 커밋) → 최신 sha 로 1회 재시도
    var latest = githubGetFile_(token);
    if (latest) payload.sha = latest.sha; else delete payload.sha;
    r = githubApi_(token, 'put', contentsPath_(), payload);
  }
  if (r.status !== 200 && r.status !== 201) throw new Error(explainStatus_(r));
  return JSON.parse(r.body).commit;
}

function explainStatus_(r) {
  var hints = {
    401: '토큰이 만료되었거나 잘못되었습니다 → 메뉴 "GitHub 토큰 설정" 에서 다시 설정하세요.',
    403: '토큰에 권한이 없습니다 (Contents: Read and write 필요) → 토큰을 다시 발급하세요.',
    404: '저장소 또는 파일 경로를 찾을 수 없습니다 → CONFIG.repo / CONFIG.path 와 토큰의 저장소 접근 범위를 확인하세요.'
  };
  var msg = '';
  try { msg = JSON.parse(r.body).message || ''; } catch (e) { msg = String(r.body || '').slice(0, 200); }
  return 'GitHub API ' + r.status + (hints[r.status] ? ' — ' + hints[r.status] : '') + (msg ? '\n(' + msg + ')' : '');
}

// ---------------------------------------------------------------- 기타

function getToken_() {
  return PropertiesService.getScriptProperties().getProperty(TOKEN_KEY) || '';
}

function getUserEmail_() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}

function log_(started, user, count, result, warnings) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONFIG.logSheetName);
    if (!sh) {
      sh = ss.insertSheet(CONFIG.logSheetName);
      sh.appendRow(['시각', '실행자', '게시 건수', '결과', '경고']);
      sh.getRange(1, 1, 1, 5).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    sh.appendRow([started, user, count, result, (warnings || []).join('\n')]);
  } catch (e) {
    console.error('log_ failed: ' + e);
  }
}
```

- [ ] **Step 2: Syntax-check with Node** (GAS globals are not needed to parse)

Run: `cp apps-script/Code.gs /Users/jun/.claude/jobs/21e201e1/tmp/Code.check.js`
Run: `node --check /Users/jun/.claude/jobs/21e201e1/tmp/Code.check.js`
Expected: no output (parses cleanly).

- [ ] **Step 3: Static sanity — every menu target exists**

Run: `grep -c "^function syncPublicationsToGitHub\|^function previewPublications\|^function setupWebsiteColumns\|^function configureGitHubToken\|^function addWebsiteMenu\|^function onOpen" apps-script/Code.gs`
Expected: `6`.

- [ ] **Step 4: Commit**

```
git add apps-script/Code.gs
git commit -m "feat(sync): Apps Script menu, GitHub upload, column setup, token config"
```

---

### Task 10: Documentation (install/operate guide, root README pointer, spec amendments)

**Files:**
- Create: `apps-script/README.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-08-sheet-publications-sync-design.md` (append an "변경 이력" section listing the 5 amendments from this plan)

- [ ] **Step 1: Write `apps-script/README.md`**

```markdown
# 홈페이지 논문 목록 자동 갱신 (Google 시트 → GitHub)

`논문 등록` 탭에 논문을 등록하고 시트 메뉴 **🌐 홈페이지 ▸ 논문 목록 갱신 → GitHub 업로드** 를 누르면
`data/publications.json` 이 GitHub 에 커밋되고, 1~2분 뒤 https://sota.pusan.ac.kr/publications.html 에 반영됩니다.
`publications.html` 을 직접 편집할 필요가 없습니다.

```
[시트: 논문 등록] → (메뉴 클릭, Apps Script) → GitHub data/publications.json → GitHub Pages 자동 빌드 → 홈페이지
```

## 1. 최초 설치 (한 번만, 저장소 쓰기 권한이 있는 사람이)

### 1-1. GitHub 토큰 발급
1. GitHub → 우측 상단 프로필 → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
2. 설정
   - Token name: `sota-sheet-sync`
   - Expiration: 1 year (만료되면 4단계 "GitHub 토큰 설정" 으로 교체)
   - Resource owner: **SOTA-PNU** (조직). 목록에 없으면 조직 Settings → Third-party Access → Personal access tokens 에서 fine-grained 토큰 허용 필요. 허용이 어려우면 **Tokens (classic)** 에서 `public_repo` 스코프로 발급해도 됩니다.
   - Repository access: **Only select repositories** → `SOTA-PNU.github.io`
   - Permissions → Repository permissions → **Contents: Read and write** (Metadata 는 자동으로 Read)
3. **Generate token** → 토큰 문자열을 복사 (다시 볼 수 없으니 바로 4단계에 붙여넣기)

### 1-2. Apps Script 코드 넣기
1. 시트 상단 메뉴 **확장 프로그램 → Apps Script**
2. 파일 3개를 만들고 저장소의 파일 내용을 그대로 붙여넣기 (`+` → 스크립트)
   | Apps Script 파일 | 저장소 파일 |
   |---|---|
   | `lib.gs` | `apps-script/lib.js` |
   | `seed.gs` | `apps-script/seed.js` |
   | `Code.gs` | `apps-script/Code.gs` |
3. 프로젝트에 이미 `onOpen` 함수가 있으면(대시보드 `[갱신]` 버튼용 스크립트 등) `Code.gs` 의 `onOpen` 을 지우고, 기존 `onOpen` 안에 `addWebsiteMenu();` 한 줄을 추가
4. 저장(💾) 후 시트 탭을 새로고침 → 메뉴에 **🌐 홈페이지** 가 보이면 성공
5. 메뉴를 처음 실행하면 Google 권한 승인 창이 뜹니다: **권한 검토 → 계정 선택 → "고급" → "…(안전하지 않음)으로 이동" → 허용**. (외부 URL 접근 = GitHub API 호출 권한)

### 1-3. 초기 설정
메뉴 **🌐 홈페이지 ▸ 초기 설정 (홈페이지 열 추가)** → `논문 등록` 탭 오른쪽 끝에 아래 열이 생깁니다. 기존 열/수식은 건드리지 않습니다.
현재 홈페이지에 있던 키워드는 제목 매칭으로 자동 채워집니다(빈 셀만).

| 열 | 의미 | 비우면 |
|---|---|---|
| 홈페이지 제외 | ☑ 이면 게시 안 함 | 게시 |
| 구분 | Conference / Journal / Workshop | 자동 판정 (SCI·KCI·저널·논문지·Journal·Transactions → Journal, `-W`/Workshop/WIP → Workshop) |
| 약칭 | 카드 왼쪽 pill 텍스트 (예: `NeurIPS`, `IEMEK`) | 자동 판정 (매핑표 → 괄호 약어 → 첫 단어) |
| 키워드 | 카드 아래 회색 텍스트 (예: `Edge AI · NPU`) | 표시 안 함 |
| Paper 링크 / Code 링크 | `https://…` | 버튼 없음 |
| 수상 | 예: `⭐ Best Paper` | 배지 없음 (Awarded 필터에 안 잡힘) |

### 1-4. 토큰 저장
메뉴 **🌐 홈페이지 ▸ GitHub 토큰 설정** → 1-1 에서 복사한 토큰 붙여넣기. 저장소 접근이 확인되면 저장됩니다.
토큰은 Apps Script 의 "스크립트 속성"에만 저장되며 시트 셀에는 기록되지 않습니다. (시트 편집 권한이 있는 사람은 누구나 이 메뉴로 업로드할 수 있습니다.)

### 1-5. 첫 갱신
1. **미리보기 (검증만)** 로 게시 건수와 경고를 확인 (예: "발표일자 없음" 행은 날짜를 채우면 해결)
2. **논문 목록 갱신 → GitHub 업로드** → 완료 창의 커밋 링크 확인 → 1~2분 뒤 홈페이지 확인

## 2. 평소 사용법

- **새 논문**: `논문 등록` 탭에 행 추가 → `Publish` 체크 → (선택) 키워드/링크/수상 입력 → **논문 목록 갱신**
- **수정/삭제**: 셀을 고치거나 `Publish` 를 해제(또는 `홈페이지 제외` 체크) → **논문 목록 갱신**
- 게시 조건: `Publish` 체크 ∧ `홈페이지 제외` 미체크 ∧ 제목(한글 또는 영어) 있음
- 표시 규칙
  - 제목: 국내(`SCI/학회` 가 `국내…` 이거나 개최국이 한국)면 한글 제목, 아니면 영어 제목 (없는 쪽은 다른 언어로 대체)
  - 저자: `1저자` → `공동` → `교신` 순서, 중복 제거
  - 연도: `발표일자` 기준. 없으면 경고 후 올해로 배치
  - pill 색: 국제 학회/저널은 파랑, 국내는 초록
- 변경이 없으면 커밋하지 않고 "변경 없음" 으로 끝납니다.
- 실행 기록은 `홈페이지 갱신 로그` 탭에 남습니다.

## 3. 대시보드 `[갱신]` 버튼과 합치기 (선택)
기존 재계산 함수의 마지막 줄에 `syncPublicationsToGitHub();` 를 추가하면 버튼 하나로 대시보드 재계산 + 홈페이지 업로드가 됩니다.

## 4. Apps Script 없이 수동 갱신 (비상용)
시트가 "링크가 있는 모든 사용자 보기" 상태이면 로컬에서도 만들 수 있습니다.
```bash
node tools/sync_from_sheet.mjs        # → data/publications.json
git add data/publications.json
git commit -m "chore(publications): manual sync"
git push
```
`data/publications.json` 을 GitHub 웹에서 직접 편집해도 됩니다(다음 시트 갱신 때 덮어써짐).

## 5. 문제 해결

| 증상 | 원인 / 조치 |
|---|---|
| 메뉴가 안 보임 | 시트 새로고침. 그래도 없으면 Apps Script 에서 `onOpen` 이 두 개인지 확인 (1-2의 3번) |
| "GitHub API 401" | 토큰 만료/오타 → 새 토큰 발급 후 **GitHub 토큰 설정** |
| "GitHub API 403" | 토큰 권한 부족 → Contents: Read and write 로 재발급. 조직이 fine-grained 를 막았으면 classic `public_repo` |
| "GitHub API 404" | 토큰의 Repository access 에 `SOTA-PNU.github.io` 가 없음, 또는 `Code.gs` 의 `CONFIG.repo` 오타 |
| "필수 헤더 없음: …" | `논문 등록` 1행 헤더 이름이 바뀜 (`Publish`, `발표일자`, `제목(한글)`, `제목(영어)`, `1저자` 필요). 헤더를 되돌리거나 `lib.js` 의 `COLUMNS` 수정 |
| 홈페이지에 반영이 안 됨 | 커밋 링크가 열리는지 확인 → GitHub 저장소 **Actions** 탭의 `pages build and deployment` 가 초록인지 확인 → 브라우저 강력 새로고침 |
| 홈페이지에 "불러오지 못했습니다" | `data/publications.json` 이 잘못된 JSON. 수동으로 만든 경우 `npm test` 로 검사 |
| 카드 모양/문구 수정 | `js/publications.js` (`cardHtml`), 스타일은 `css/redesign.css` 의 `.pnu-pub-*` |
| 약칭/구분 자동 판정 규칙 수정 | `apps-script/lib.js` 의 `VENUE_SHORT_MAP`, `detectKind` → 수정 후 `lib.gs` 에도 다시 붙여넣기 |

## 6. 개발자용
- 테스트: `npm test` (Node ≥ 20, 의존성 없음)
- 변환 규칙과 데이터 스키마: `docs/superpowers/specs/2026-09-08-sheet-publications-sync-design.md`
- `apps-script/seed.js` 는 `tools/extract_seed.mjs` 로 생성된 파일 (초기 설정 후에는 더 이상 필요 없음)
```

- [ ] **Step 2: Add pointer to root `README.md`** (append)

```markdown

## 홈페이지 유지보수

- **논문 목록**은 Google 시트(`논문 등록` 탭)에서 관리합니다. 시트 메뉴 **🌐 홈페이지 ▸ 논문 목록 갱신** 을 누르면 `data/publications.json` 이 커밋되고 홈페이지에 반영됩니다. 설치·사용법: [`apps-script/README.md`](apps-script/README.md)
- `publications.html` 은 직접 편집하지 마세요 (`js/publications.js` 가 JSON 을 렌더링합니다).
- 테스트: `npm test`
```

- [ ] **Step 3: Append the amendments to the spec** — add this section at the end of `docs/superpowers/specs/2026-09-08-sheet-publications-sync-design.md`:

```markdown

## 11. 변경 이력

### 2026-09-08 — 구현 계획 수립 중 확정한 변경 (계획 문서와 동일)
1. **`구분` 값 3종**: `Conference` / `Journal` / `Workshop`. JSON `type` ∈ `conference|journal|workshop`. Workshop 카드는 `data-tags="conference,workshop"`, 라벨 `Workshop`. 자동 판정: 저널 힌트가 없고 저널명이 `/workshop|-W\b|\bWIP\b/i` 에 맞으면 workshop.
2. **tier 규칙**: 국제(국내가 아님) → `top`(파란 pill), 국내 → `normal`. 국내 = `SCI/학회` 가 `국내` 로 시작 또는 `출판국/개최국` 에 `한국`/`korea`. (기존 "BK IF / SCI Q1" 규칙은 현 사이트와 13/51 불일치, 이 규칙은 48/51 일치)
3. **seed 는 `키워드` 만 채움**: 현 사이트 카드에는 링크·수상·굵은 저자가 없고 pill 텍스트가 일관되지 않아, 약칭은 항상 자동 판정(`약칭` 열로 override).
4. **부분 날짜 허용**: `date` 는 `YYYY` / `YYYY-MM` / `YYYY-MM-DD`. 없거나 해석 불가 → 경고 + 올해, `date=""`.
5. **`Publish` 판정**: boolean true, 0이 아닌 숫자, 문자열 `true`/`1`/`y`/`yes`(대소문자 무시). 저널명이 비어 있으면 경고를 내고 게시는 유지(pill 은 `—`).
```

- [ ] **Step 4: Commit**

```
git add apps-script/README.md README.md docs/superpowers/specs/2026-09-08-sheet-publications-sync-design.md
git commit -m "docs: sheet→GitHub publications sync guide and spec amendments"
```

---

### Task 11: Final verification, site↔sheet diff report, push + draft PR

**Files:** none new (report goes to the final message).

- [ ] **Step 1: Full test run**

Run: `npm test`
Expected: all tests pass, 0 failures. Record the count.

- [ ] **Step 2: Seed determinism check** (the seed must be reproducible from the pre-swap HTML)

Run: `git log --oneline` and note the hash of the commit **before** "feat(site): publications page renders from data/publications.json" (call it `<PRE>`).
Run: `git show <PRE>:publications.html > /Users/jun/.claude/jobs/21e201e1/tmp/old_publications.html`
Run: `node tools/extract_seed.mjs /Users/jun/.claude/jobs/21e201e1/tmp/old_publications.html /Users/jun/.claude/jobs/21e201e1/tmp/seed_check.js`
Run: `diff apps-script/seed.js /Users/jun/.claude/jobs/21e201e1/tmp/seed_check.js`
Expected: no output (identical).

- [ ] **Step 3: Site ↔ sheet diff for the report**

Write `/Users/jun/.claude/jobs/21e201e1/tmp/diff_report.mjs`:
```js
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const lib = require(process.cwd() + '/apps-script/lib.js');
const seed = (await import('node:vm')).runInNewContext(fs.readFileSync('apps-script/seed.js', 'utf8') + ';PUB_SEED', {});
const doc = JSON.parse(fs.readFileSync('data/publications.json', 'utf8'));
const inSheet = new Set();
for (const p of doc.publications) { inSheet.add(lib.normalizeTitle(p.titleKo)); inSheet.add(lib.normalizeTitle(p.titleEn)); }
const onlySite = Object.values(seed).filter(s => !inSheet.has(lib.normalizeTitle(s.title)));
const onlySheet = doc.publications.filter(p => !seed[lib.normalizeTitle(p.titleKo)] && !seed[lib.normalizeTitle(p.titleEn)]);
console.log('site-only (will disappear):', onlySite.length); onlySite.forEach(s => console.log('  -', s.title));
console.log('sheet-only (newly shown):', onlySheet.length); onlySheet.forEach(p => console.log('  +', p.year, p.venueShort, '|', p.title));
```
Run: `node /Users/jun/.claude/jobs/21e201e1/tmp/diff_report.mjs`
Expected: `site-only: 0` (all 51 matched during planning), `sheet-only: 8`. Keep the list for the final report.

- [ ] **Step 4: Push and open a draft PR**

Run: `git push -u origin worktree-feat-sheet-publications-sync`
Run: `gh pr create --draft --title "Google 시트 → GitHub 논문 목록 자동 동기화" --body-file /Users/jun/.claude/jobs/21e201e1/tmp/pr_body.md`
where `pr_body.md` contains: summary (flow diagram), what changed (files), how to install (link to `apps-script/README.md`), the site↔sheet diff, verification (`npm test` count, local render check), and the required footer:
```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01FxC7CxtmD3t63KpSGmbtMZ
```

- [ ] **Step 5: Final report to the user** (Korean): what was built, PR link, the 5-step install checklist, the sheet-only rows that will newly appear, the undated row to fix, and the note that Apps Script → GitHub was not executed end-to-end (needs their Google account).

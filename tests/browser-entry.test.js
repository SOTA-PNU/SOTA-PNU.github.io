// 브라우저 진입점(fetch → 렌더 → 필터) 통합 테스트: 최소한의 가짜 DOM 으로 js/publications.js 를 실제로 실행한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DATA = path.join(__dirname, '..', 'data', 'publications.json');

function fakeEl(attrs) {
  const classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
  return {
    attrs, style: {},
    classList: {
      toggle(c, on) { on ? classes.add(c) : classes.delete(c); },
      contains(c) { return classes.has(c); },
    },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    setAttribute(k, v) { attrs[k] = String(v); },
    children: [],
    querySelectorAll(sel) { return sel === '.pnu-pub-card' ? this.children : []; },
  };
}

// publications.html 의 #pubFilters 와 같은 칩 구성
const CHIPS = [
  { 'data-filter': 'all' },
  { 'data-region': 'international' }, { 'data-region': 'domestic' },
  { 'data-filter': 'conference' }, { 'data-filter': 'journal' }, { 'data-filter': 'awarded' },
];

function buildFakeDom() {
  const chips = CHIPS.map((a) => fakeEl({ ...a, class: a['data-filter'] === 'all' ? 'pnu-chip is-active' : 'pnu-chip' }));
  const listeners = {};
  const filterBar = {
    querySelectorAll: () => chips,
    addEventListener: (ev, fn) => { listeners[ev] = fn; },
  };
  const mount = { _html: '', set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; } };
  const empty = { hidden: true };
  const state = { cards: [], blocks: [] };
  const document = {
    readyState: 'complete',
    getElementById: (id) => ({ pubList: mount, pubFilters: filterBar, pubEmpty: empty }[id] || null),
    querySelectorAll: (sel) => (sel === '.pnu-pub-card' ? state.cards : sel === '.pnu-year-block' ? state.blocks : []),
    addEventListener: () => {},
  };
  return { document, mount, chips, listeners, state, empty };
}

// 렌더된 HTML 문자열에서 카드/연도 블록 가짜 요소를 만든다 (initFilters 가 DOM 을 순회할 수 있도록)
function hydrate(html, state) {
  state.cards = []; state.blocks = [];
  for (const block of html.split('<div class="pnu-year-block">').slice(1)) {
    const b = fakeEl({ class: 'pnu-year-block' });
    for (const m of block.matchAll(/<article class="([^"]*)" data-tags="([^"]*)" data-region="([^"]*)"/g)) {
      const c = fakeEl({ class: m[1], 'data-tags': m[2], 'data-region': m[3] });
      b.children.push(c); state.cards.push(c);
    }
    state.blocks.push(b);
  }
}

// 모듈을 새로 불러 진입점을 실행하고, 렌더가 끝나면 카드를 가짜 DOM 에 채운다
async function boot() {
  const dom = buildFakeDom();
  global.window = { document: dom.document };
  global.document = dom.document;
  global.fetch = async (url, opts) => {
    assert.equal(url, 'data/publications.json');
    assert.equal(opts.cache, 'no-cache');
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(DATA, 'utf8')) };
  };
  delete require.cache[require.resolve('../js/publications.js')];
  const R = require('../js/publications.js');
  for (let i = 0; i < 10 && !dom.mount.innerHTML.includes('<article'); i++) await new Promise((r) => setImmediate(r));
  hydrate(dom.mount.innerHTML, dom.state);
  const chip = (attr, value) => dom.chips.find((c) => c.getAttribute(attr) === value);
  const click = (c) => dom.listeners.click({ target: { closest: () => c } });
  const shown = () => dom.state.cards.filter((c) => c.style.display !== 'none');
  const doc = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  return { dom, R, chip, click, shown, doc };
}

function assertBlocksFollowCards(dom) {
  for (const b of dom.state.blocks) {
    const visible = b.children.some((c) => c.style.display !== 'none');
    assert.equal(b.style.display, visible ? '' : 'none', 'year block hidden iff no visible cards');
  }
}

test('browser entry renders data/publications.json into #pubList and filters work', async () => {
  const { dom, R, chip, click, shown, doc } = await boot();
  assert.ok(global.window.PnuPublications === R);

  const html = dom.mount.innerHTML;
  assert.equal((html.match(/<article /g) || []).length, doc.count, 'every publication rendered');
  assert.equal((html.match(/pnu-year-block/g) || []).length, new Set(doc.publications.map((p) => p.year)).size);
  assert.ok(html.indexOf('>2026</div>') < html.indexOf('>2025</div>'), 'newest year first');

  // 필터: initFilters 는 진입점에서 이미 바인딩됐다 (그 시점엔 가짜 DOM 에 카드가 없었다).
  // 진입점이 등록한 클릭 리스너로 Journal 클릭을 흉내 낸다
  // → 리스너가 카드 목록을 클릭 시점에 조회해야 통과한다 (재렌더 후에도 동작해야 함).
  assert.equal(typeof dom.listeners.click, 'function', 'click listener bound by the entry point');
  click(chip('data-filter', 'journal'));
  assert.ok(chip('data-filter', 'journal').classList.contains('is-active'));
  assert.ok(!chip('data-filter', 'all').classList.contains('is-active'), 'All chip deactivated');
  assert.ok(shown().length > 0 && shown().length < dom.state.cards.length);
  assert.ok(shown().every((c) => c.getAttribute('data-tags').includes('journal')));
  assertBlocksFollowCards(dom);

  // 유형끼리는 하나만: Awarded 를 누르면 Journal 은 꺼진다
  click(chip('data-filter', 'awarded'));
  assert.ok(!chip('data-filter', 'journal').classList.contains('is-active'));
  assert.equal(shown().length, doc.publications.filter((p) => p.award).length);
  assert.equal(dom.empty.hidden, shown().length > 0, 'the empty message shows exactly when nothing matches');

  // All 로 복귀
  click(chip('data-filter', 'all'));
  assert.ok(dom.state.cards.every((c) => c.style.display === ''));
  assert.ok(dom.state.blocks.every((b) => b.style.display === ''));
  assert.equal(dom.empty.hidden, true);
});

test('International / Domestic combine with the type filter and toggle off', async () => {
  const { dom, R, chip, click, shown, doc } = await boot();
  const count = (pred) => doc.publications.filter(pred).length;
  const intl = (p) => R.regionOf(p) === 'international';
  const dom_ = (p) => R.regionOf(p) === 'domestic';
  const pressed = (c) => c.getAttribute('aria-pressed');
  assert.ok(count(intl) > 0 && count(dom_) > 0, 'the data has both kinds');
  assert.equal(count(intl) + count(dom_), doc.count, 'every paper is one or the other');

  click(chip('data-region', 'international'));
  assert.equal(shown().length, count(intl));
  assert.ok(shown().every((c) => c.getAttribute('data-region') === 'international'));
  assert.equal(pressed(chip('data-region', 'international')), 'true');
  assert.equal(pressed(chip('data-filter', 'all')), 'false');
  assertBlocksFollowCards(dom);

  // 국제 + Journal: 두 조건이 함께 걸린다
  click(chip('data-filter', 'journal'));
  assert.equal(shown().length, count((p) => intl(p) && p.type === 'journal'));
  assert.ok(chip('data-region', 'international').classList.contains('is-active'));
  assert.ok(chip('data-filter', 'journal').classList.contains('is-active'));

  // 켜진 Journal 을 다시 누르면 유형 조건만 풀리고 국제는 남는다
  click(chip('data-filter', 'journal'));
  assert.equal(shown().length, count(intl));
  assert.equal(pressed(chip('data-filter', 'journal')), 'false');

  // 국내로 바꾸면 국제는 꺼진다
  click(chip('data-region', 'domestic'));
  assert.equal(shown().length, count(dom_));
  assert.equal(pressed(chip('data-region', 'international')), 'false');
  assert.ok(shown().every((c) => c.getAttribute('data-region') === 'domestic'));

  // 국내 + Conference
  click(chip('data-filter', 'conference'));
  assert.equal(shown().length, count((p) => dom_(p) && p.type !== 'journal'));

  // 국내 + Awarded: 결과가 없으면 안내 문구가 보이고 연도 블록은 모두 숨는다
  click(chip('data-filter', 'awarded'));
  const n = count((p) => dom_(p) && p.award);
  assert.equal(shown().length, n);
  assert.equal(dom.empty.hidden, n > 0);
  assertBlocksFollowCards(dom);

  // 켜진 국내를 다시 누르면 국가 조건만 풀린다
  click(chip('data-region', 'domestic'));
  assert.equal(shown().length, count((p) => p.award));

  // All 은 모든 조건을 푼다
  click(chip('data-filter', 'all'));
  assert.equal(shown().length, doc.count);
  assert.equal(pressed(chip('data-filter', 'all')), 'true');
  assert.ok(dom.chips.filter((c) => c.getAttribute('data-filter') !== 'all').every((c) => pressed(c) === 'false'));
  assert.equal(dom.empty.hidden, true);
});

test('browser entry shows an error message when the JSON cannot be loaded', async () => {
  const dom = buildFakeDom();
  global.window = { document: dom.document };
  global.document = dom.document;
  global.fetch = async () => ({ ok: false, status: 404 });
  const origError = console.error; console.error = () => {};
  delete require.cache[require.resolve('../js/publications.js')];
  require('../js/publications.js');
  for (let i = 0; i < 10 && !dom.mount.innerHTML; i++) await new Promise((r) => setImmediate(r));
  console.error = origError;
  assert.match(dom.mount.innerHTML, /불러오지 못했습니다/);
});

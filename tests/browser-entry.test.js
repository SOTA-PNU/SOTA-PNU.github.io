// 브라우저 진입점(fetch → 렌더 → 필터) 통합 테스트: 최소한의 가짜 DOM 으로 js/publications.js 를 실제로 실행한다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const DATA = path.join(__dirname, '..', 'data', 'publications.json');

function fakeEl(attrs) {
  const classes = new Set((attrs.class || '').split(/\s+/).filter(Boolean));
  return {
    attrs, style: {}, dataset: { filter: attrs['data-filter'] },
    classList: {
      toggle(c, on) { on ? classes.add(c) : classes.delete(c); },
      contains(c) { return classes.has(c); },
    },
    getAttribute(k) { return attrs[k]; },
    children: [],
    querySelectorAll(sel) { return sel === '.pnu-pub-card' ? this.children : []; },
  };
}

function buildFakeDom() {
  const chips = ['all', 'conference', 'journal', 'awarded'].map(f => fakeEl({ 'data-filter': f, class: f === 'all' ? 'pnu-chip is-active' : 'pnu-chip' }));
  const listeners = {};
  const filterBar = {
    __pnuBound: false,
    querySelectorAll: () => chips,
    addEventListener: (ev, fn) => { listeners[ev] = fn; },
  };
  const mount = { _html: '', set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; } };
  const state = { cards: [], blocks: [] };
  const document = {
    readyState: 'complete',
    getElementById: (id) => (id === 'pubList' ? mount : id === 'pubFilters' ? filterBar : null),
    querySelectorAll: (sel) => (sel === '.pnu-pub-card' ? state.cards : sel === '.pnu-year-block' ? state.blocks : []),
    addEventListener: () => {},
  };
  return { document, mount, chips, listeners, state };
}

// 렌더된 HTML 문자열에서 카드/연도 블록 가짜 요소를 만든다 (initFilters 가 DOM 을 순회할 수 있도록)
function hydrate(html, state) {
  state.cards = []; state.blocks = [];
  for (const block of html.split('<div class="pnu-year-block">').slice(1)) {
    const b = fakeEl({ class: 'pnu-year-block' });
    for (const m of block.matchAll(/<article class="([^"]*)" data-tags="([^"]*)"/g)) {
      const c = fakeEl({ class: m[1], 'data-tags': m[2] });
      b.children.push(c); state.cards.push(c);
    }
    state.blocks.push(b);
  }
}

test('browser entry renders data/publications.json into #pubList and filters work', async () => {
  const dom = buildFakeDom();
  global.window = { document: dom.document };
  global.document = dom.document;
  global.fetch = async (url, opts) => {
    assert.equal(url, 'data/publications.json');
    assert.equal(opts.cache, 'no-cache');
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(DATA, 'utf8')) };
  };
  // 가짜 DOM 이 준비된 뒤 모듈을 로드하면 진입점이 즉시 실행된다 (readyState: complete)
  const R = require('../js/publications.js');
  assert.ok(global.window.PnuPublications === R);

  // fetch/then 체인이 끝날 때까지 대기
  for (let i = 0; i < 10 && !dom.mount.innerHTML.includes('<article'); i++) await new Promise(r => setImmediate(r));

  const doc = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const html = dom.mount.innerHTML;
  assert.equal((html.match(/<article /g) || []).length, doc.count, 'every publication rendered');
  assert.equal((html.match(/pnu-year-block/g) || []).length, new Set(doc.publications.map(p => p.year)).size);
  assert.ok(html.indexOf('>2026</div>') < html.indexOf('>2025</div>'), 'newest year first');

  // 필터: initFilters 는 진입점에서 이미 바인딩됐다 (그 시점엔 가짜 DOM 에 카드가 없었다).
  // 렌더 결과로 가짜 카드 요소를 만든 뒤, 진입점이 등록한 클릭 리스너로 Journal 클릭을 흉내 낸다.
  // → 리스너가 카드 목록을 클릭 시점에 조회해야 통과한다 (재렌더 후에도 동작해야 함).
  hydrate(html, dom.state);
  assert.equal(typeof dom.listeners.click, 'function', 'click listener bound by the entry point');

  const journalChip = dom.chips.find(c => c.dataset.filter === 'journal');
  dom.listeners.click({ target: { closest: () => journalChip } });
  assert.ok(journalChip.classList.contains('is-active'));
  assert.ok(!dom.chips[0].classList.contains('is-active'), 'All chip deactivated');
  const shown = dom.state.cards.filter(c => c.style.display !== 'none');
  assert.ok(shown.length > 0 && shown.length < dom.state.cards.length);
  assert.ok(shown.every(c => c.getAttribute('data-tags').includes('journal')));
  for (const b of dom.state.blocks) {
    const visible = b.children.some(c => c.style.display !== 'none');
    assert.equal(b.style.display, visible ? '' : 'none', 'year block hidden iff no visible cards');
  }

  // Awarded: 아직 수상 데이터가 없으면 모든 블록이 숨겨진다
  const awardedChip = dom.chips.find(c => c.dataset.filter === 'awarded');
  dom.listeners.click({ target: { closest: () => awardedChip } });
  const awarded = dom.state.cards.filter(c => c.style.display !== 'none');
  assert.equal(awarded.length, doc.publications.filter(p => p.award).length);

  // All 로 복귀
  dom.listeners.click({ target: { closest: () => dom.chips[0] } });
  assert.ok(dom.state.cards.every(c => c.style.display === ''));
  assert.ok(dom.state.blocks.every(b => b.style.display === ''));
});

test('browser entry shows an error message when the JSON cannot be loaded', async () => {
  const dom = buildFakeDom();
  global.window = { document: dom.document };
  global.document = dom.document;
  global.fetch = async () => ({ ok: false, status: 404 });
  const origError = console.error; console.error = () => {};
  delete require.cache[require.resolve('../js/publications.js')];
  require('../js/publications.js');
  for (let i = 0; i < 10 && !dom.mount.innerHTML; i++) await new Promise(r => setImmediate(r));
  console.error = origError;
  assert.match(dom.mount.innerHTML, /불러오지 못했습니다/);
});

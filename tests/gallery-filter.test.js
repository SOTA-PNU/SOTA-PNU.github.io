// 필터 동작 테스트: buildGalleryHtml 이 만든 실제 마크업을 최소 DOM 모형으로 바꿔 applyFilter 를 돌린다.
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/gallery.js');

function el(tag, attrs, children) {
  const classes = new Set(String((attrs && attrs.class) || '').split(/\s+/).filter(Boolean));
  return {
    tag, attrs: attrs || {}, children: children || [], style: {}, textContent: '', innerHTML: '',
    hidden: false,
    get id() { return this.attrs.id || ''; },
    dataset: { filter: attrs && attrs['data-filter'] },
    classList: {
      toggle(c, on) { on ? classes.add(c) : classes.delete(c); },
      contains(c) { return classes.has(c); },
    },
    parentNode: null,
    getAttribute(k) { return this.attrs[k]; },
    querySelectorAll(sel) { return descendants(this).filter((n) => matches(n, sel)); },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    insertAdjacentHTML(_pos, html) { this.append(parseEmpty(html)); },
    append(node) { node.parentNode = this; this.children.push(node); },
    removeChild(node) {
      const i = this.children.indexOf(node);
      if (i === -1) throw new Error('removeChild: not a child');
      this.children.splice(i, 1);
      node.parentNode = null;
      return node;
    },
    addEventListener() {},
  };
}
function descendants(node) {
  return node.children.flatMap((c) => [c, ...descendants(c)]);
}
function matches(node, sel) {
  if (sel.startsWith('.')) return String(node.attrs.class || '').split(/\s+/).includes(sel.slice(1));
  if (sel.startsWith('[') && sel.endsWith(']')) return sel.slice(1, -1) in node.attrs;
  return false;
}
function parseEmpty(html) {
  const label = (html.match(/No albums in ([^<]*)</) || [])[1] || '';
  const n = el('div', { class: 'pnu-gallery-empty' });
  n.textContent = label;
  return n;
}

// 렌더된 HTML → 모형 (연도 블록 / 앨범 / 연도 카운트 줄만 있으면 충분하다)
function buildModel(albums) {
  const html = G.buildGalleryHtml({ albums });
  const list = el('div', { id: 'galleryList' });
  for (const chunk of html.split('<div class="pnu-year-block"').slice(1)) {
    const year = (chunk.match(/id="year-(\d+)"/) || [])[1];
    const block = el('div', { class: 'pnu-year-block', id: 'year-' + year });
    const count = el('div', { class: 'pnu-gallery-year-count', 'data-year-count': '' });
    block.append(count);
    for (const m of chunk.matchAll(/<article class="pnu-gallery-item" id="album-([^"]+)" data-album="[^"]*" data-tags="([^"]+)" data-photos="(\d+)"/g)) {
      block.append(el('article', { class: 'pnu-gallery-item', id: 'album-' + m[1], 'data-tags': m[2], 'data-photos': m[3] }));
    }
    list.append(block);
  }
  const filters = el('div', { id: 'galleryFilters' });
  for (const f of ['all'].concat(G.CATEGORIES)) {
    filters.append(el('button', { 'data-filter': f, class: f === 'all' ? 'pnu-chip is-active' : 'pnu-chip' }));
  }
  // textContent 는 칩 이름 (필터-빈 상태 문구에 쓰인다)
  filters.children.forEach((c) => { c.textContent = c.dataset.filter === 'all' ? 'All' : G.CATEGORY_LABEL[c.dataset.filter]; });
  const jump = el('nav', { id: 'galleryJump' });
  const status = el('p', { id: 'galleryStatus' });
  return { list, filters, jump, status };
}

const ALBUMS = [
  { id: 'a', title: 'A', date: '2026-05-13', year: 2026, category: 'conference', cover: 'x.jpg', photos: ['x.jpg', 'y.jpg'] },
  { id: 'b', title: 'B', date: '2026-03-01', year: 2026, category: 'lab', cover: 'x.jpg', photos: ['x.jpg'] },
  { id: 'c', title: 'C', date: '2025-11-01', year: 2025, category: 'conference', cover: 'x.jpg', photos: ['x.jpg', 'y.jpg', 'z.jpg'] },
];
const visibleItems = (ctx) => ctx.list.querySelectorAll('.pnu-gallery-item').filter((i) => i.style.display !== 'none');
const visibleBlocks = (ctx) => ctx.list.querySelectorAll('.pnu-year-block').filter((b) => b.style.display !== 'none');

test('All shows every album and both year blocks', () => {
  const ctx = buildModel(ALBUMS);
  assert.equal(G.applyFilter('all', ctx), 3);
  assert.equal(visibleItems(ctx).length, 3);
  assert.equal(visibleBlocks(ctx).length, 2);
  assert.equal(ctx.status.textContent, '3 albums');
});

test('a category filter hides other albums and empties the year block that has none left', () => {
  const ctx = buildModel(ALBUMS);
  assert.equal(G.applyFilter('lab', ctx), 1);
  assert.equal(visibleItems(ctx).length, 1);
  assert.equal(visibleItems(ctx)[0].id, 'album-b');
  assert.equal(visibleBlocks(ctx).length, 1, '2025 has no lab album, so its block hides');
  assert.equal(ctx.status.textContent, '1 album');
});

test('year counts are recomputed from what is actually visible', () => {
  const ctx = buildModel(ALBUMS);
  G.applyFilter('all', ctx);
  assert.deepEqual(ctx.list.querySelectorAll('[data-year-count]').map((n) => n.textContent),
    ['2 albums · 3 photos', '1 album · 3 photos']);
  G.applyFilter('conference', ctx);
  assert.deepEqual(ctx.list.querySelectorAll('[data-year-count]').map((n) => n.textContent),
    ['1 album · 2 photos', '1 album · 3 photos']);
});

test('the active chip follows the filter', () => {
  const ctx = buildModel(ALBUMS);
  G.applyFilter('award', ctx);
  const active = ctx.filters.querySelectorAll('[data-filter]').filter((c) => c.classList.contains('is-active'));
  assert.equal(active.length, 1);
  assert.equal(active[0].dataset.filter, 'award');
});

test('a filter that matches nothing shows the named empty panel, and All clears it', () => {
  const ctx = buildModel(ALBUMS);
  assert.equal(G.applyFilter('award', ctx), 0);
  assert.equal(visibleItems(ctx).length, 0);
  assert.equal(visibleBlocks(ctx).length, 0);
  const panel = ctx.list.querySelector('.pnu-gallery-empty');
  assert.ok(panel, 'empty panel was not inserted');
  assert.equal(panel.textContent, 'Award', 'panel should name the active filter');
  assert.equal(ctx.status.textContent, '0 albums');

  G.applyFilter('all', ctx);
  assert.equal(ctx.list.querySelector('.pnu-gallery-empty'), null, 'stale empty panel left behind');
  assert.equal(visibleItems(ctx).length, 3);
});

test('jump links appear only when more than one year is visible', () => {
  const ctx = buildModel(ALBUMS);
  G.applyFilter('all', ctx);
  assert.equal(ctx.jump.hidden, false);
  assert.match(ctx.jump.innerHTML, /href="#year-2026"/);
  assert.match(ctx.jump.innerHTML, /href="#year-2025"/);

  G.applyFilter('lab', ctx);
  assert.equal(ctx.jump.hidden, true, 'one visible year needs no jump nav');
});

test('a single-album gallery still renders one deliberate row', () => {
  const ctx = buildModel([ALBUMS[1]]);
  assert.equal(G.applyFilter('all', ctx), 1);
  assert.equal(visibleBlocks(ctx).length, 1);
  assert.equal(ctx.list.querySelector('[data-year-count]').textContent, '1 album · 1 photo');
  assert.equal(ctx.jump.hidden, true);
});

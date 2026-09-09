// 페이지 HTML 과 스크립트가 실제로 맞물리는지 확인한다.
// 브라우저 없이 잡을 수 있는 가장 흔한 사고: id 오타, 스크립트 누락, 마운트 지점 실종.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const idsIn = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const lookupsIn = (js) => [...js.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);

for (const [page, script] of [['gallery.html', 'js/gallery.js'], ['publications.html', 'js/publications.js']]) {
  test(`${page}: every getElementById in ${script} exists in the page`, () => {
    const ids = idsIn(read(page));
    for (const id of new Set(lookupsIn(read(script)))) {
      assert.ok(ids.has(id), `${script} looks up #${id}, which ${page} does not define`);
    }
  });

  test(`${page}: loads layout.js and its own script, in that order`, () => {
    const html = read(page);
    // 주석에도 파일명이 나오므로 <script src="..."> 태그 위치로만 비교한다
    const tag = (src) => html.indexOf(`<script src="${src}"></script>`);
    const layout = tag('js/layout.js');
    const own = tag(script);
    assert.ok(layout > -1, `${page} does not load js/layout.js`);
    assert.ok(own > -1, `${page} does not load ${script}`);
    assert.ok(layout < own, `${page} must load ${script} after js/layout.js`);
    assert.match(html, /<div id="siteHeader"><\/div>/);
    assert.match(html, /<div id="siteFooter"><\/div>/);
  });
}

test('gallery.html: no category filters and no subtitle line', () => {
  const html = read('gallery.html');
  assert.doesNotMatch(html, /data-filter=/, 'category filter chips were removed on purpose');
  assert.doesNotMatch(html, /pnu-chip/, 'category filter chips were removed on purpose');
  assert.doesNotMatch(html, /연도순 기록입니다/, 'the subtitle line was removed on purpose');
});

test('gallery.html: the album modal has every part the viewer fills in', () => {
  const html = read('gallery.html');
  for (const id of ['galleryLightbox', 'galleryLbPanel|pnu-gallery-lb-panel', 'galleryLbTitle', 'galleryLbSub',
    'galleryLbDesc', 'galleryLbCaption', 'galleryLbImg', 'galleryLbPrev', 'galleryLbNext', 'galleryLbCount', 'galleryLbRail',
    'galleryLbClose']) {
    const ok = id.split('|').some((token) => html.includes(token));
    assert.ok(ok, `gallery.html is missing ${id}`);
  }
  assert.match(html, /role="dialog"[^>]*aria-modal="true"/, 'the panel must be a modal dialog');
});

test('gallery.html: the section is scoped with .pnu-gallery so the mesh variable resolves', () => {
  assert.match(read('gallery.html'), /<section class="[^"]*\bpnu-gallery\b/);
});

test('gallery.html: no leftover markup from the imported template', () => {
  const html = read('gallery.html');
  assert.doesNotMatch(html, /cdn\.sanity\.io/, 'still points at another site’s image CDN');
  assert.doesNotMatch(html, /_next\/static/, 'still loads the imported Next.js bundle');
  assert.doesNotMatch(html, /cursor-pointer/, 'still contains hand-written template cards');
});

test('Gallery is reachable from the navigation', () => {
  for (const p of ['partials/header.html', 'index.html']) {
    const html = read(p);
    assert.match(html, /<li><a href="gallery\.html" class="pnu-nav-link">Gallery<\/a><\/li>/, `${p} desktop nav`);
    assert.match(html, /<a class="pnu-mobile-link" href="gallery\.html">Gallery<\/a>/, `${p} mobile nav`);
  }
});

test('css/redesign.css defines the gallery classes the renderer emits', () => {
  const css = read('css/redesign.css');
  for (const cls of ['pnu-gallery', 'pnu-gallery-item', 'pnu-gallery-card', 'pnu-gallery-cover',
    'pnu-gallery-count', 'pnu-gallery-body', 'pnu-gallery-meta', 'pnu-gallery-date', 'pnu-gallery-title',
    'pnu-gallery-place', 'pnu-gallery-desc', 'pnu-gallery-strip', 'pnu-gallery-thumb',
    'pnu-gallery-more', 'pnu-gallery-track', 'pnu-gallery-year-badge', 'pnu-gallery-year-count',
    'pnu-gallery-jump', 'pnu-gallery-empty', 'pnu-gallery-empty-title', 'pnu-gallery-empty-text',
    'pnu-gallery-lightbox', 'pnu-gallery-lb-panel', 'pnu-gallery-lb-bar', 'pnu-gallery-lb-stage',
    'pnu-gallery-lb-info', 'pnu-gallery-lb-desc', 'pnu-gallery-lb-caption', 'pnu-gallery-lb-rail', 'pnu-gallery-lb-nav',
    'pnu-gallery-lb-close']) {
    assert.ok(css.includes('.' + cls), `css/redesign.css has no rule for .${cls}`);
  }
});

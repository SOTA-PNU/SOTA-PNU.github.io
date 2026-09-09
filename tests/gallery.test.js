const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../js/gallery.js');

const A = (o) => ({ id: 'a1', title: 'ISET 2026', date: '2026-05-13', year: 2026, category: 'conference',
  place: '제주', description: '학술대회 발표', cover: 'assets/images/gallery/a/1.jpg',
  photos: ['assets/images/gallery/a/1.jpg', 'assets/images/gallery/a/2.jpg'], ...o });

test('safeSrc allows repo-relative paths and https, rejects other schemes', () => {
  assert.equal(G.safeSrc('assets/images/gallery/a/1.jpg'), 'assets/images/gallery/a/1.jpg');
  assert.equal(G.safeSrc('teamX.png'), 'teamX.png');
  assert.equal(G.safeSrc('https://x.y/a.jpg'), 'https://x.y/a.jpg');
  assert.equal(G.safeSrc('javascript:alert(1)'), '');
  assert.equal(G.safeSrc('data:image/png;base64,AAA'), '');
  assert.equal(G.safeSrc('http://x.y/a.jpg'), '');
  assert.equal(G.safeSrc('//evil.com/a.jpg'), '');
  assert.equal(G.safeSrc(''), '');
});

test('safeSrc percent-encodes spaces, Hangul and #', () => {
  assert.equal(G.safeSrc('assets/images/gallery/2026 워크숍/사진 1.jpg'),
    'assets/images/gallery/2026%20%EC%9B%8C%ED%81%AC%EC%88%8D/%EC%82%AC%EC%A7%84%201.jpg');
  assert.equal(G.safeSrc('a/b#c.jpg'), 'a/b%23c.jpg');
});

test('photosOf puts the cover first and removes duplicates', () => {
  assert.deepEqual(G.photosOf(A()), ['assets/images/gallery/a/1.jpg', 'assets/images/gallery/a/2.jpg']);
  assert.deepEqual(G.photosOf({ cover: '', photos: [] }), []);
  assert.deepEqual(G.photosOf({ cover: 'c.jpg', photos: ['javascript:x', 'd.jpg'] }), ['c.jpg', 'd.jpg']);
});

test('categoryOf whitelists, falling back to lab', () => {
  assert.equal(G.categoryOf({ category: 'Conference' }), 'conference');
  assert.equal(G.categoryOf({ category: ' award ' }), 'award');
  assert.equal(G.categoryOf({ category: 'made-up' }), 'lab');
  assert.equal(G.categoryOf({}), 'lab');
});

test('dateLabel formats full, partial and missing dates', () => {
  assert.equal(G.dateLabel({ date: '2026-05-13', year: 2026 }), '2026.05.13');
  assert.equal(G.dateLabel({ date: '2026-05', year: 2026 }), '2026.05');
  assert.equal(G.dateLabel({ date: '', year: 2026 }), '2026');
  assert.equal(G.dateLabel({ date: 'nonsense', year: 2025 }), '2025');
});

test('sort is newest first; missing dates fall to the end of their year', () => {
  const list = [
    A({ id: 'x', title: 'X', date: '2025-01-01', year: 2025 }),
    A({ id: 'y', title: 'Y', date: '', year: 2026 }),
    A({ id: 'z', title: 'Z', date: '2026-06-01', year: 2026 }),
  ].map(G.normalize);
  assert.deepEqual(G.sortAlbums(list).map((a) => a.title), ['Z', 'Y', 'X']);
  const groups = G.groupByYear(list);
  assert.deepEqual(groups.map((g) => g.year), [2026, 2025]);
  assert.equal(groups[0].albums.length, 2);
});

test('countLine handles singular and plural', () => {
  assert.equal(G.countLine([G.normalize(A({ photos: ['a.jpg'], cover: 'a.jpg' }))]), '1 album · 1 photo');
  assert.equal(G.countLine([G.normalize(A()), G.normalize(A())]), '2 albums · 4 photos');
});

test('cardHtml: cover button, category tag, count pill and filmstrip', () => {
  const h = G.cardHtml(A());
  assert.match(h, /^<article class="pnu-gallery-item" id="album-a1" data-album="a1" data-tags="conference" data-photos="2">/);
  assert.match(h, /<button class="pnu-gallery-cover" type="button" data-index="0"/);
  assert.match(h, /<span class="pnu-gallery-count">2 photos<\/span>/);
  assert.match(h, /<span class="pnu-badge pnu-gallery-cat" data-cat="conference">Conference<\/span>/);
  assert.match(h, /<span class="pnu-gallery-date">2026\.05\.13<\/span>/);
  assert.match(h, /<h3 class="pnu-gallery-title">ISET 2026<\/h3>/);
  assert.match(h, /<p class="pnu-gallery-place">제주<\/p>/);
  assert.match(h, /class="pnu-gallery-thumb" type="button" data-index="1"/);
  assert.match(h, /loading="lazy" decoding="async"/);
});

test('cardHtml: a single-photo album gets no count pill and no filmstrip', () => {
  const h = G.cardHtml(A({ photos: ['assets/images/gallery/a/1.jpg'] }));
  assert.doesNotMatch(h, /pnu-gallery-count/);
  assert.doesNotMatch(h, /pnu-gallery-strip/);
  assert.match(h, /data-photos="1"/);
});

test('cardHtml: an album with no photos renders the mesh frame, not a button', () => {
  const h = G.cardHtml(A({ cover: '', photos: [] }));
  assert.match(h, /<div class="pnu-gallery-cover is-empty" aria-hidden="true"><\/div>/);
  assert.doesNotMatch(h, /pnu-gallery-cover" type="button"/);
});

test('cardHtml: strip caps at six thumbs and adds a +N button pointing past them', () => {
  const photos = Array.from({ length: 12 }, (_, i) => `assets/images/gallery/a/${i}.jpg`);
  const h = G.cardHtml(A({ cover: photos[0], photos }));
  assert.equal((h.match(/class="pnu-gallery-thumb"/g) || []).length, 6);
  assert.match(h, /<button class="pnu-gallery-more" type="button" data-index="7"[^>]*>\+5<\/button>/);
});

test('cardHtml escapes every text field', () => {
  const h = G.cardHtml(A({ title: '<script>alert(1)</script>', place: '<b>', description: '"x"' }));
  assert.doesNotMatch(h, /<script>/);
  assert.match(h, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(h, /pnu-gallery-place">&lt;b&gt;</);
});

test('buildGalleryHtml groups into year blocks, newest first', () => {
  const html = G.buildGalleryHtml({ albums: [
    A({ id: 'a', year: 2025, date: '2025-03-01' }),
    A({ id: 'b', year: 2026, date: '2026-03-01' }),
    A({ id: 'c', year: 2026, date: '2026-09-01' }),
  ] });
  assert.equal((html.match(/pnu-year-block/g) || []).length, 2);
  assert.ok(html.indexOf('id="year-2026"') < html.indexOf('id="year-2025"'));
  assert.match(html, /<div class="pnu-gallery-year-count" data-year-count>2 albums · 4 photos<\/div>/);
  assert.equal((html.match(/<article /g) || []).length, 3);
  assert.equal(G.buildGalleryHtml({ albums: [] }), '');
  assert.equal(G.buildGalleryHtml(null), '');
});

test('empty-state copy names the active filter and offers a way back', () => {
  assert.match(G.EMPTY_HTML, /No albums yet/);
  assert.match(G.EMPTY_HTML, /sota@sota\.dooray\.com/);
  const f = G.filterEmptyHtml('Award');
  assert.match(f, /No albums in Award/);
  assert.match(f, /class="pnu-gallery-empty-reset" type="button" data-filter="all"/);
});

test('data/gallery.json matches the schema the renderer expects', () => {
  const doc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'gallery.json'), 'utf8'));
  assert.equal(doc.schemaVersion, 1);
  assert.ok(Array.isArray(doc.albums));
  assert.equal(doc.count, doc.albums.length);
  const ids = new Set();
  for (const a of doc.albums) {
    assert.ok(a.id && !ids.has(a.id), `id missing or duplicated: ${a.id}`); ids.add(a.id);
    assert.ok(a.title, `title missing on ${a.id}`);
    assert.ok(G.CATEGORIES.includes(a.category), `bad category on ${a.id}: ${a.category}`);
    assert.match(String(a.date), /^\d{4}(-\d{2}(-\d{2})?)?$/, `bad date on ${a.id}`);
    assert.equal(G.normalize(a).year, Number(a.year), `year disagrees with date on ${a.id}`);
    for (const p of G.photosOf(a)) assert.ok(p, `unsafe photo path on ${a.id}`);
  }
});

test('every photo referenced by data/gallery.json exists on disk with matching case', () => {
  const root = path.join(__dirname, '..');
  const doc = JSON.parse(fs.readFileSync(path.join(root, 'data', 'gallery.json'), 'utf8'));
  for (const a of doc.albums) {
    for (const raw of [a.cover].concat(a.photos || [])) {
      if (!raw) continue;
      const rel = decodeURI(raw);
      if (/^https:/i.test(rel)) continue;
      const full = path.join(root, rel);
      assert.ok(fs.existsSync(full), `missing file for ${a.id}: ${rel}`);
      // GitHub Pages 는 대소문자를 구분한다 (macOS 는 안 함) — 실제 파일명과 정확히 같아야 한다
      const dir = path.dirname(full);
      assert.ok(fs.readdirSync(dir).includes(path.basename(full)),
        `case mismatch for ${a.id}: ${rel}`);
    }
  }
});

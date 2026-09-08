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

test('cardHtml: tier top, journal/workshop labels, keywords with separator, empty pill fallback', () => {
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

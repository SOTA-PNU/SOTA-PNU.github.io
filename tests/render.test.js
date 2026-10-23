const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../js/publications.js');
const { view } = require('./helpers/lang-view.js');

const P = (o) => ({ id: '2026-x', year: 2026, date: '2026-05-13', type: 'conference', tier: 'normal',
  venue: 'IEMEK ISET 2026', venueShort: 'IEMEK', title: 'Title', titleKo: '', titleEn: '',
  authors: ['A', 'B'], keywords: '', paperUrl: '', codeUrl: '', award: '', ...o });
// 카드 HTML 은 두 언어를 함께 담는다. 각 언어로 보이는 모습을 따로 확인한다.
const ko = (h) => view(h, 'ko');
const en = (h) => view(h, 'en');

test('esc escapes HTML special chars', () => {
  assert.equal(R.esc(`<a href="x">&'`), '&lt;a href=&quot;x&quot;&gt;&amp;&#39;');
});

test('tagsFor: conference / journal / workshop / awarded', () => {
  assert.equal(R.tagsFor(P({})), 'conference');
  assert.equal(R.tagsFor(P({ type: 'journal' })), 'journal');
  assert.equal(R.tagsFor(P({ type: 'workshop' })), 'conference,workshop');
  assert.equal(R.tagsFor(P({ type: 'journal', award: 'Best' })), 'journal,awarded');
});

test('regionOf: the region the sync wrote wins; older JSON without it falls back to tier', () => {
  assert.equal(R.regionOf(P({ region: 'international', tier: 'normal' })), 'international');
  assert.equal(R.regionOf(P({ region: 'domestic', tier: 'top' })), 'domestic');
  // 스크립트를 다시 붙여넣기 전의 JSON: region 이 없고 tier 만 있다
  assert.equal(R.regionOf(P({ tier: 'top' })), 'international');
  assert.equal(R.regionOf(P({ tier: 'normal' })), 'domestic');
  assert.equal(R.regionOf(P({ region: 'nonsense', tier: 'top' })), 'international');
});

test('cardHtml: every card says whether it is international or domestic', () => {
  assert.match(R.cardHtml(P({ tier: 'top' })), /data-region="international"/);
  assert.match(R.cardHtml(P({ tier: 'normal' })), /data-region="domestic"/);
  assert.match(R.cardHtml(P({ region: 'domestic', tier: 'top' })), /data-region="domestic"/);
  // pill 색도 같은 값을 따른다 — 필터에는 국내로 잡히는데 pill 은 국제 색인 카드가 없도록
  assert.match(R.cardHtml(P({ region: 'domestic', tier: 'top' })), /pnu-venue-pill pnu-venue-conf/);
  assert.match(R.cardHtml(P({ region: 'international', tier: 'normal' })), /pnu-venue-pill pnu-venue-top/);
});

test('cardHtml: basic card structure and classes', () => {
  const h = R.cardHtml(P({}));
  assert.match(h, /^<article class="pnu-pub-card" data-tags="conference" data-region="domestic" id="2026-x">/);
  assert.match(h, /<div class="pnu-venue-pill pnu-venue-conf">IEMEK<\/div>/);
  assert.match(ko(h), /<div class="pnu-venue-meta"><span data-ko>학술대회<\/span><\/div>/);
  assert.match(en(h), /<div class="pnu-venue-meta"><span data-en>Conference<\/span><\/div>/);
  assert.match(h, /<h3 class="pnu-title">Title<\/h3>/);
  assert.match(h, /<p class="pnu-authors">A, B<\/p>/);
  assert.match(h, /<span class="pnu-meta">IEMEK ISET 2026<\/span>/);
  assert.doesNotMatch(h, /pnu-pub-top/);
  assert.doesNotMatch(h, /pnu-dot/);
});

test('cardHtml: tier top, journal/workshop labels in both languages, keywords with separator, empty pill fallback', () => {
  const h = R.cardHtml(P({ tier: 'top', type: 'journal', keywords: 'Edge AI · NPU' }));
  assert.match(h, /pnu-venue-pill pnu-venue-top/);
  assert.match(ko(h), /pnu-venue-meta"><span data-ko>저널</);
  assert.match(en(h), /pnu-venue-meta"><span data-en>Journal</);
  assert.match(h, /<span class="pnu-dot">\|<\/span><span class="pnu-meta">Edge AI · NPU<\/span>/);
  const w = R.cardHtml(P({ type: 'workshop' }));
  assert.match(ko(w), /pnu-venue-meta"><span data-ko>워크숍</);
  assert.match(en(w), /pnu-venue-meta"><span data-en>Workshop</);
  assert.match(R.cardHtml(P({ venueShort: '' })), /<div class="pnu-venue-pill pnu-venue-conf">—<\/div>/);
});

test('cardHtml: the English view shows the English title when the paper has one', () => {
  // 국내 논문: 한국어 화면은 한글 제목, 영어 화면은 영문 제목
  const dom = R.cardHtml(P({ title: '비동기 큐 파이프라인', titleKo: '비동기 큐 파이프라인', titleEn: 'Async Queue Pipelining' }));
  assert.match(ko(dom), /<h3 class="pnu-title"><span data-ko>비동기 큐 파이프라인<\/span><\/h3>/);
  assert.match(en(dom), /<h3 class="pnu-title"><span data-en>Async Queue Pipelining<\/span><\/h3>/);
  // 영문 제목이 없거나 같으면 한 벌만 낸다
  assert.match(R.cardHtml(P({ title: '한글 제목', titleEn: '' })), /<h3 class="pnu-title">한글 제목<\/h3>/);
  assert.match(R.cardHtml(P({ title: 'Same', titleEn: 'Same' })), /<h3 class="pnu-title">Same<\/h3>/);
});

test('cardHtml: award badge + awarded class; links only for valid http(s) URLs, labelled in both languages', () => {
  const h = R.cardHtml(P({ award: '⭐ Best Paper', paperUrl: 'https://a/p', codeUrl: 'javascript:alert(1)' }));
  assert.match(h, /<article class="pnu-pub-card pnu-pub-awarded" data-tags="conference,awarded"/);
  assert.match(h, /<span class="pnu-badge pnu-badge-award">⭐ Best Paper<\/span>/);
  assert.match(h, /<a class="pnu-link pnu-link-paper" href="https:\/\/a\/p" target="_blank" rel="noreferrer">/);
  assert.match(ko(h), /pnu-link-paper[^>]*><span data-ko>논문<\/span><\/a>/);
  assert.match(en(h), /pnu-link-paper[^>]*><span data-en>Paper<\/span><\/a>/);
  assert.doesNotMatch(h, /pnu-link-code/);
  const h2 = R.cardHtml(P({ codeUrl: 'https://g/h' }));
  assert.match(h2, /<div class="pnu-pub-top"><div class="pnu-badges"><\/div><div class="pnu-links">/);
  assert.match(en(h2), /pnu-link-code[^>]*><span data-en>Code<\/span><\/a>/);
});

test('cardHtml escapes user text (no script injection)', () => {
  const h = R.cardHtml(P({ title: '<script>alert(1)</script>', titleEn: '<img src=x onerror=1>', venueShort: '<b>', authors: ['<i>'] }));
  assert.doesNotMatch(h, /<script>/);
  assert.doesNotMatch(h, /<img/);
  assert.match(h, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(h, /pnu-venue-conf">&lt;b&gt;</);
  assert.match(h, /pnu-authors">&lt;i&gt;</);
});

test('buildPublicationsHtml groups by year (desc) with the year badge markup', () => {
  const html = R.buildPublicationsHtml({ publications: [P({ year: 2025, id: 'a' }), P({ year: 2026, id: 'b' }), P({ year: 2025, id: 'c' })] });
  const blocks = html.match(/<div class="pnu-year-block">/g);
  assert.equal(blocks.length, 2);
  assert.ok(html.indexOf('>2026</div>') < html.indexOf('>2025</div>'));
  assert.match(en(html), /<div class="pnu-year-badge"><div class="text-sm text-slate-500 font-semibold"><span data-en>Year<\/span><\/div><div class="text-3xl font-extrabold tracking-tight text-slate-900">2026<\/div><\/div><div class="pnu-pub-list">/);
  assert.match(ko(html), /font-semibold"><span data-ko>연도<\/span><\/div>/);
  assert.equal((html.match(/<article /g) || []).length, 3);
  assert.equal(R.buildPublicationsHtml({ publications: [] }), '');
  assert.equal(R.buildPublicationsHtml(null), '');
});

test('every card label has both languages', () => {
  for (const [type, [k, e]] of Object.entries(R.KIND_LABEL)) {
    assert.match(k, /[가-힣]/, `${type} needs a Korean label`);
    assert.doesNotMatch(e, /[가-힣]/, `${type} needs an English label`);
  }
});

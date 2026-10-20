const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FILE = path.join(__dirname, '..', 'data', 'publications.json');
const KEYS = ['id', 'year', 'date', 'type', 'tier', 'region', 'venue', 'venueShort', 'title', 'titleKo', 'titleEn',
  'authors', 'keywords', 'paperUrl', 'codeUrl', 'award'];
// region 은 2026-10 에 추가됐다. 갱신 스크립트(pubLib.gs)를 다시 붙여넣고 갱신하기 전의 JSON 에는 없다.
const KEYS_BEFORE_REGION = KEYS.filter((k) => k !== 'region');

test('data/publications.json exists and matches the schema', () => {
  const doc = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  assert.equal(doc.schemaVersion, 1);
  assert.ok(Array.isArray(doc.publications));
  assert.equal(doc.count, doc.publications.length);
  assert.ok(doc.count >= 50, `expected ≥50 publications, got ${doc.count}`);
  const ids = new Set();
  let prev = null;
  for (const p of doc.publications) {
    assert.deepEqual(Object.keys(p), 'region' in p ? KEYS : KEYS_BEFORE_REGION, `key order for ${p.id}`);
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`); ids.add(p.id);
    assert.ok(['conference', 'journal', 'workshop'].includes(p.type), p.id);
    assert.ok(['top', 'normal'].includes(p.tier), p.id);
    if ('region' in p) {
      // 둘 다 같은 국내 판정에서 나온다: 국제 = top, 국내 = normal
      assert.equal(p.region, p.tier === 'top' ? 'international' : 'domestic', `region disagrees with tier on ${p.id}`);
    }
    assert.ok(p.title && p.authors.length > 0, `incomplete ${p.id}`);
    assert.equal(typeof p.venueShort, 'string'); // 저널명이 비어 있는 행은 '' 허용 (갱신 시 경고로 안내)
    if (prev) assert.ok(prev.year >= p.year, 'sorted by year desc');
    prev = p;
  }
});

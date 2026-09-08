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

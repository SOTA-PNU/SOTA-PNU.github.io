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

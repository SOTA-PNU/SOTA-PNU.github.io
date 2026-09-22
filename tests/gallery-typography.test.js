// 갤러리 글자 굵기 회귀 테스트.
// 실제로 있었던 일: 설명 문단만 font-weight 선언이 없어 400 으로 떨어졌고, 글꼴은 다 같은
// Pretendard 인데도 행사명(900)·날짜(800) 옆에서 혼자 얇아 다른 서체처럼 보였다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(path.join(__dirname, '..', 'css', 'redesign.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '');

function weightOf(cls) {
  const rule = new RegExp('\\.' + cls + '\\s*\\{([^}]*)\\}').exec(CSS);
  assert.ok(rule, `css/redesign.css has no rule for .${cls}`);
  const w = /font-weight:\s*(\d+)/.exec(rule[1]);
  assert.ok(w, `.${cls} declares no font-weight, so it inherits 400 and reads as a different face`);
  return Number(w[1]);
}

test('every gallery text style declares a weight of 700 or heavier', () => {
  for (const cls of ['pnu-gallery-date', 'pnu-gallery-title', 'pnu-gallery-place', 'pnu-gallery-desc',
    'pnu-gallery-lb-title', 'pnu-gallery-lb-sub', 'pnu-gallery-lb-caption', 'pnu-gallery-lb-desc']) {
    const w = weightOf(cls);
    assert.ok(w >= 700, `.${cls} is ${w}; gallery text stays at 700 or heavier`);
  }
});

test('the description sits in the same weight family as the event name and date', () => {
  const title = weightOf('pnu-gallery-title');
  const date = weightOf('pnu-gallery-date');
  const desc = weightOf('pnu-gallery-desc');
  assert.ok(desc <= date && date <= title, `설명 ${desc} · 날짜 ${date} · 행사명 ${title}: 설명이 가장 가볍고 행사명이 가장 굵어야 한다`);
  assert.ok(title - desc <= 200, `설명(${desc})이 행사명(${title})과 너무 벌어져 다른 서체처럼 보인다`);
});

test('no gallery rule overrides the page font stack', () => {
  // 글꼴 자체는 <body> 인라인 스타일의 Pretendard 하나뿐이어야 한다. 여기에 font-family 가 끼면
  // "설명만 글꼴이 다르다"는 문제가 굵기와 무관하게 되살아난다.
  const galleryRules = [...CSS.matchAll(/\.pnu-gallery[\w-]*\s*\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(galleryRules.length > 10, 'gallery rules should be present in the stylesheet');
  for (const body of galleryRules) assert.doesNotMatch(body, /font-family/);
});

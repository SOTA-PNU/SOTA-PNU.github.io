// research.html 구조 테스트. 연구 섹션은 사람이 손으로 추가하는 HTML 이라
// 앵커 오타, id 중복, 빠진 CSS 가 생기기 쉽다. 섹션을 더할 때마다 여기서 잡는다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'research.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const CSS = fs.readFileSync(path.join(ROOT, 'css', 'redesign.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const ids = [...HTML.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

// 연구 섹션은 서로 중첩되지 않으므로, 여는 태그부터 다음 </section> 까지가 한 섹션이다
function sectionById(id) {
  const open = new RegExp('<section\\b[^>]*\\sid="' + id + '"[^>]*>').exec(HTML);
  assert.ok(open, `research.html has no <section id="${id}">`);
  const end = HTML.indexOf('</section>', open.index);
  assert.ok(end > open.index, `<section id="${id}"> is not closed`);
  return { tag: open[0], body: HTML.slice(open.index + open[0].length, end) };
}
const count = (s, re) => (s.match(re) || []).length;

test('every id on the research page is unique', () => {
  const seen = new Set();
  for (const id of ids) {
    assert.ok(!seen.has(id), `duplicate id="${id}"`);
    seen.add(id);
  }
});

test('in-page links and aria-labelledby point at ids that exist', () => {
  for (const m of HTML.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(m[1]), `href="#${m[1]}" has no target`);
  for (const m of HTML.matchAll(/aria-labelledby="([^"]+)"/g)) {
    for (const ref of m[1].split(/\s+/)) assert.ok(ids.includes(ref), `aria-labelledby="${ref}" has no target`);
  }
});

test('links that open a new tab are https and carry rel="noopener noreferrer"', () => {
  for (const m of HTML.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
    assert.match(m[0], /rel="noopener noreferrer"/, `missing rel on ${m[0]}`);
    assert.match(m[0], /href="https:\/\//, `external link must be https: ${m[0]}`);
  }
});

test('the research sections appear in order: compiler, KV serving, agentic AI', () => {
  const order = ['research', 'research-kv-serving', 'research-agent-ai'].map((id) => HTML.indexOf(`id="${id}"`));
  for (const i of order) assert.ok(i > 0);
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test('the agentic AI section follows the KV section layout', () => {
  const { tag, body } = sectionById('research-agent-ai');
  assert.match(tag, /class="pnu-research pnu-research--agent"/);
  assert.match(tag, /aria-labelledby="research-agent-ai-title"/);
  assert.equal(count(body, /<h2\b/g), 1, 'one h2 per section');
  assert.match(body, /<h2 id="research-agent-ai-title">[^<]+<\/h2>/);
  assert.doesNotMatch(body, /<h4\b/, 'cards use h3 under the section h2, as the KV section does');
  assert.doesNotMatch(body, /\sstyle="/, 'layout lives in css/redesign.css, not inline styles');

  assert.equal(count(body, /<div class="hero">/g), 1);
  assert.equal(count(body, /<div class="grid">/g), 2, 'goal grid and roadmap grid');
  assert.equal(count(body, /<h3 class="pill">/g), 6, 'three goal cards and three roadmap stages');
  assert.equal(count(body, /<div class="step">/g), 3);
  assert.equal(count(body, /<div class="num" aria-hidden="true">\d<\/div>/g), 3);
  assert.match(body, /<ol class="agent-flow" aria-label="[^"]+" data-en-aria-label="[^"]+">/);
  assert.ok(count(body, /<li>/g) >= 3, 'the flow has at least three stages');
  assert.match(body, /<div class="mini">Metrics: <span data-ko>[^<]+<\/span><span data-en>[^<]+<\/span><\/div>/);
  assert.match(body, /<a class="btn" href="#research-agent-ai-roadmap">Roadmap ↓<\/a>/);
  assert.match(body, /<div class="card" id="research-agent-ai-roadmap">/);

  const refs = /<div class="agent-references mini">([\s\S]*?)<\/div>/.exec(body);
  assert.ok(refs, 'reference ecosystem row');
  const links = [...refs[1].matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(links.length >= 3 && links.length <= 6, `3-6 reference links, got ${links.length}`);
  const kv = sectionById('research-kv-serving').body;
  for (const href of links) assert.ok(!kv.includes(`href="${href}"`), `${href} already listed in the KV section`);
});

test('every class used in the agentic AI section has a style rule', () => {
  const { body } = sectionById('research-agent-ai');
  const used = new Set([...body.matchAll(/class="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/)));
  used.add('pnu-research');
  for (const cls of used) {
    const styled = new RegExp('\\.' + cls.replace(/[-]/g, '\\-') + '(?![\\w-])').test(CSS);
    assert.ok(styled, `.${cls} is used in the agentic AI section but css/redesign.css never styles it`);
  }
  assert.match(CSS, /#research-agent-ai\s*\{[^}]*--acc:/, 'section-local accent colors');
  assert.match(CSS, /#research-agent-ai #research-agent-ai-roadmap\s*\{[^}]*scroll-margin-top/, 'roadmap anchor clears the fixed header');
});

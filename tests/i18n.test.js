// 한국어(기본) / English 전환 테스트.
// 페이지마다 영어 화면에 한국어가 남지 않는지, 두 언어 문구가 나란히 있는지, 전환 스크립트가 제대로 도는지 본다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { view, visibleText, body, stripComments } = require('./helpers/lang-view.js');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const PAGES = ['index.html', 'members.html', 'research.html', 'publications.html', 'gallery.html', 'apply.html'];
const PARTS = ['partials/header.html', 'partials/footer.html'];

// ------------------------------------------------------------------ 페이지 문구

for (const page of [...PAGES, ...PARTS]) {
  test(`${page}: the English view has no Korean left`, () => {
    const en = view(body(read(page)), 'en');
    const hangul = visibleText(en).match(/\S*[가-힣]\S*/g) || [];
    assert.deepEqual(hangul, [], `${page} shows Korean in English: ${hangul.slice(0, 8).join(' | ')}`);
    // 한국어로 된 버튼 설명·이미지 설명에는 영어 짝(data-en-<속성>)이 있어야 한다
    for (const m of en.matchAll(/<[a-zA-Z][^>]*>/g)) {
      if (/\sdata-set-lang=/.test(m[0])) continue; // KO 버튼의 title="한국어" 는 언어 이름이라 그대로 둔다
      for (const a of m[0].matchAll(/\s(aria-label|alt|title|placeholder)="([^"]*[가-힣][^"]*)"/g)) {
        assert.match(m[0], new RegExp('\\sdata-en-' + a[1] + '="[^"]+"'), `${page}: ${a[1]}="${a[2]}" has no English`);
      }
    }
  });

  test(`${page}: every Korean phrase sits right next to its English one`, () => {
    const html = stripComments(read(page));
    const ko = [...html.matchAll(/<([a-zA-Z][\w-]*)\b[^>]*\sdata-ko(?=[\s>])[^>]*>/g)];
    const en = [...html.matchAll(/<([a-zA-Z][\w-]*)\b[^>]*\sdata-en(?=[\s>])[^>]*>/g)];
    assert.equal(ko.length, en.length, `${page}: ${ko.length} Korean vs ${en.length} English pieces`);
    for (const m of ko) {
      // 짝이 되는 닫는 태그 바로 뒤(공백만 허용)에 같은 태그의 data-en 이 와야 한다
      const tag = m[1];
      const re = new RegExp('<(/?)' + tag + '\\b[^>]*?>', 'g');
      re.lastIndex = m.index + m[0].length;
      let depth = 1, n;
      while (depth && (n = re.exec(html))) depth += n[1] ? -1 : 1;
      const after = html.slice(re.lastIndex).replace(/^\s+/, '');
      assert.match(after, new RegExp('^<' + tag + '\\b[^>]*\\sdata-en(?=[\\s>])'),
        `${page}: <${tag} data-ko> near "${html.slice(m.index, m.index + 60)}" is not followed by <${tag} data-en>`);
    }
  });
}

test('every page decides the language in <head> and loads js/i18n.js before js/layout.js', () => {
  for (const page of PAGES) {
    const html = read(page);
    const head = html.slice(0, html.indexOf('</head>'));
    assert.match(head, /<script>\(function\(\)\{try\{var q=new URLSearchParams\(location\.search\)\.get\('lang'\)/, `${page} has no language bootstrap`);
    const i18n = html.indexOf('<script src="js/i18n.js"></script>');
    const layout = html.indexOf('<script src="js/layout.js"></script>');
    assert.ok(i18n > 0 && i18n < layout, `${page} must load js/i18n.js before js/layout.js`);
  }
});

test('the header (partial and the homepage copy) has the KO / EN switch', () => {
  for (const p of ['partials/header.html', 'index.html']) {
    const html = read(p);
    assert.match(html, /<div class="pnu-lang" role="group" aria-label="언어" data-en-aria-label="Language">/, p);
    assert.match(html, /<button type="button" class="pnu-lang-btn" data-set-lang="ko" lang="ko" aria-pressed="true"[^>]*>KO<\/button>/, p);
    assert.match(html, /<button type="button" class="pnu-lang-btn" data-set-lang="en" lang="en" aria-pressed="false"[^>]*>EN<\/button>/, p);
  }
});

test('css shows only the current language, Korean by default', () => {
  const css = read('css/redesign.css');
  assert.match(css, /html:not\(\[data-lang="en"\]\) \[data-en\],\s*html\[data-lang="en"\] \[data-ko\]\{ display:none !important; \}/);
});

// ------------------------------------------------------------------ <head> 의 언어 결정

function runBootstrap({ search = '', stored = null } = {}) {
  const head = read('index.html');
  const code = /<script>(\(function\(\)\{try\{var q=new URLSearchParams[\s\S]*?)<\/script>/.exec(head)[1];
  const attrs = {};
  const store = new Map(stored ? [['sota-lang', stored]] : []);
  const documentElement = {
    setAttribute(k, v) { attrs[k] = v; },
    set lang(v) { attrs.lang = v; },
  };
  vm.runInNewContext(code, {
    URLSearchParams,
    location: { search },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) },
    document: { documentElement },
  });
  return { lang: attrs['data-lang'] || 'ko', htmlLang: attrs.lang, stored: store.get('sota-lang') || null };
}

test('head bootstrap: Korean unless asked otherwise; ?lang wins and is remembered', () => {
  assert.deepEqual(runBootstrap(), { lang: 'ko', htmlLang: undefined, stored: null });
  assert.deepEqual(runBootstrap({ stored: 'en' }), { lang: 'en', htmlLang: 'en', stored: 'en' });
  assert.deepEqual(runBootstrap({ search: '?lang=en' }), { lang: 'en', htmlLang: 'en', stored: 'en' });
  // 링크로 한국어를 고르면 저장된 영어보다 우선하고, 그 선택을 기억한다
  assert.deepEqual(runBootstrap({ search: '?lang=ko', stored: 'en' }), { lang: 'ko', htmlLang: undefined, stored: 'ko' });
  // 모르는 값은 무시한다
  assert.deepEqual(runBootstrap({ search: '?lang=fr', stored: 'en' }), { lang: 'en', htmlLang: 'en', stored: 'en' });
  assert.deepEqual(runBootstrap({ stored: 'xx' }), { lang: 'ko', htmlLang: undefined, stored: 'xx' });
});

// ------------------------------------------------------------------ js/i18n.js

function fakeEl(attrs = {}, text = '') {
  return {
    attrs: { ...attrs },
    textContent: text,
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    hasAttribute(k) { return k in this.attrs; },
    closest(sel) { const a = /^\[([\w-]+)\]$/.exec(sel); return a && this.hasAttribute(a[1]) ? this : null; },
  };
}

function bootI18n(elements, stored) {
  const html = fakeEl({ lang: 'ko' });
  const listeners = {};
  const store = new Map(stored ? [['sota-lang', stored]] : []);
  const events = [];
  const document = {
    documentElement: html,
    readyState: 'complete',
    querySelectorAll(sel) {
      const a = /^\[([\w-]+)\]$/.exec(sel);
      return a ? elements.filter((e) => e.hasAttribute(a[1])) : [];
    },
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    dispatchEvent(ev) { events.push(ev); (listeners[ev.type] || []).forEach((fn) => fn(ev)); },
  };
  class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } }
  const win = {
    document,
    CustomEvent,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) },
  };
  vm.runInNewContext(read('js/i18n.js'), { window: win });
  const click = (el) => (listeners.click || []).forEach((fn) => fn({ target: el }));
  return { win, html, store, events, click, listeners };
}

test('i18n.js switches language, swaps attributes both ways, updates the buttons and remembers the choice', () => {
  const close = fakeEl({ 'aria-label': '닫기', 'data-en-aria-label': 'Close' });
  const photo = fakeEl({ alt: '권용인', 'data-en-alt': 'Yongin Kwon' });
  const title = fakeEl({ 'data-en-text': 'SOTA Lab' }, 'SOTA 연구실');
  const ko = fakeEl({ 'data-set-lang': 'ko', 'aria-pressed': 'true' });
  const en = fakeEl({ 'data-set-lang': 'en', 'aria-pressed': 'false' });
  const { win, html, store, events, click } = bootI18n([close, photo, title, ko, en]);
  const I = win.SOTA_I18N;

  assert.equal(I.lang(), 'ko');
  assert.equal(I.t('사진', 'Photos'), '사진');

  click(en);
  assert.equal(html.getAttribute('data-lang'), 'en');
  assert.equal(html.getAttribute('lang'), 'en');
  assert.equal(store.get('sota-lang'), 'en');
  assert.equal(close.getAttribute('aria-label'), 'Close');
  assert.equal(photo.getAttribute('alt'), 'Yongin Kwon');
  assert.equal(title.textContent, 'SOTA Lab');
  assert.equal(en.getAttribute('aria-pressed'), 'true');
  assert.equal(ko.getAttribute('aria-pressed'), 'false');
  assert.equal(I.t('사진', 'Photos'), 'Photos');
  assert.deepEqual(events.map((e) => [e.type, e.detail.lang]), [['sota:lang', 'en']]);

  // 이미 영어일 때 EN 을 다시 눌러도 아무 일도 없다
  click(en);
  assert.equal(events.length, 1);

  click(ko);
  assert.equal(html.getAttribute('data-lang'), 'ko');
  assert.equal(store.get('sota-lang'), 'ko');
  assert.equal(close.getAttribute('aria-label'), '닫기', 'the Korean original comes back');
  assert.equal(photo.getAttribute('alt'), '권용인');
  assert.equal(title.textContent, 'SOTA 연구실');
  assert.equal(ko.getAttribute('aria-pressed'), 'true');
});

test('i18n.js applies the language chosen in <head> to elements added later (the injected header)', () => {
  const later = fakeEl({ 'aria-label': '메뉴 열기', 'data-en-aria-label': 'Open navigation menu' });
  const elements = [];
  const { win, html } = bootI18n(elements);
  html.setAttribute('data-lang', 'en');  // <head> 스크립트가 정한 것처럼
  elements.push(later);                  // layout.js 가 헤더를 끼워 넣은 뒤
  win.SOTA_I18N.apply(win.document);
  assert.equal(later.getAttribute('aria-label'), 'Open navigation menu');
});

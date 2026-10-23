// 테스트용: HTML 에서 한 언어로 보이는 모습만 남긴다.
// view(html, 'en') 은 [data-ko] 요소를 통째로 지운 HTML(=영어 화면), view(html, 'ko') 는 [data-en] 을 지운 HTML.
// 브라우저 없이 태그를 차례로 읽으며 깊이를 세므로, 같은 태그가 안에 겹쳐 있어도 짝이 맞게 지운다.

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '');
}

// attr 를 가진 요소(여는 태그부터 짝이 되는 닫는 태그까지)를 모두 지운다
function removeElementsWith(html, attr) {
  const tagRe = /<(\/?)([a-zA-Z][\w-]*)\b([^>]*?)(\/?)>/g;
  const has = new RegExp('\\s' + attr + '(?=[\\s=>/]|$)');
  let out = '';
  let last = 0;
  let m;
  while ((m = tagRe.exec(html))) {
    const [, closing, name, attrs, selfClose] = m;
    if (closing || !has.test(attrs)) continue;
    const tag = name.toLowerCase();
    out += html.slice(last, m.index);
    if (VOID.has(tag) || selfClose) { last = tagRe.lastIndex; continue; }
    // 같은 이름의 태그 깊이를 세어 짝이 되는 닫는 태그를 찾는다
    const inner = new RegExp('<(/?)' + tag + '\\b[^>]*?(/?)>', 'gi');
    inner.lastIndex = tagRe.lastIndex;
    let depth = 1, n;
    while (depth && (n = inner.exec(html))) {
      if (n[2]) continue;
      depth += n[1] ? -1 : 1;
    }
    if (depth) throw new Error('unclosed <' + tag + '> with ' + attr);
    last = inner.lastIndex;
    tagRe.lastIndex = inner.lastIndex;
  }
  return out + html.slice(last);
}

function view(html, lang) {
  return removeElementsWith(stripComments(html), lang === 'en' ? 'data-ko' : 'data-en');
}

// 화면에 보이는 글자만 (script/style/noscript 와 태그를 뺀다)
function visibleText(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function body(html) {
  const i = html.search(/<body\b/i);
  return i < 0 ? html : html.slice(i);
}

module.exports = { view, visibleText, body, removeElementsWith, stripComments };

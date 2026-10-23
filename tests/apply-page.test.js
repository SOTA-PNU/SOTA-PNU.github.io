// apply.html 지원 서류 · 지원 절차 테스트. 연구실이 정한 목록과 약속(72시간 이내 회신)이
// 페이지를 고치다가 빠지거나 순서가 바뀌지 않도록 지킨다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'apply.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const text = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function section(id) {
  const open = new RegExp('<section\\b[^>]*\\sid="' + id + '"[^>]*>').exec(HTML);
  assert.ok(open, `apply.html has no <section id="${id}">`);
  return HTML.slice(open.index, HTML.indexOf('</section>', open.index));
}
// 바깥 <ol> 의 항목만 (안쪽 <ul> 의 li 는 빼고)
function items(sectionHtml) {
  const ol = sectionHtml.slice(sectionHtml.indexOf('<ol'), sectionHtml.lastIndexOf('</ol>'));
  const out = [];
  let depth = 0, start = -1;
  for (const m of ol.matchAll(/<(\/?)(li|ul)\b[^>]*>/g)) {
    if (m[2] === 'ul') { depth += m[1] ? -1 : 1; continue; }
    if (depth) continue;
    if (!m[1]) start = m.index;
    else { out.push(ol.slice(start, m.index)); start = -1; }
  }
  return out;
}

test('지원 서류: the lab’s four items, in its order', () => {
  const docs = items(section('apply-documents'));
  assert.deepEqual(docs.map((li) => text(/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(li)[1])),
    ['필수 첨부 서류', '실적 증빙자료', '관심 연구 소개 또는 연구 계획서', '연구 및 프로젝트 포트폴리오']);

  const required = text(docs[0]);
  for (const s of ['필수', '성적증명서', 'CV', '발표 PPT', '15~20분 발표']) assert.ok(required.includes(s), `missing "${s}"`);
  assert.match(required, /PPT에는 관심 분야 와 무엇을 배우고 싶은지 에 대한 방향성을 꼭 담아/);

  const portfolio = text(docs[3]);
  assert.ok(portfolio.includes('경험이 있다면'), 'the portfolio is only for those with experience');
  assert.match(portfolio, /어떤 공부를 했고, 어떤 과제에 참여했고, 어떤 대회에 나갔는지/);
  // 포트폴리오 내용은 발표 PPT에도 함께 담는다
  assert.match(portfolio, /이 내용은 발표 PPT에도 함께 담아 주세요/);
});

test('지원 절차: four steps, with the 72-hour reply promise', () => {
  const steps = items(section('apply-process'));
  assert.deepEqual(steps.map((li) => text(/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(li)[1])),
    ['서류 제출', '결정 및 회신', '면접', '교수님 면담']);
  assert.ok(text(steps[1]).includes('72시간 이내'));
  assert.match(text(section('apply-process')), /메일을 받은 뒤 72시간 이내 에 결정해 회신드립니다/);
  // 면접 일정·면담 방식은 회신 메일에서 안내한다 (페이지에 날짜를 박지 않는다)
  assert.match(text(steps[2]), /회신 메일/);
  assert.match(text(steps[3]), /회신 메일/);
});

test('applicants are asked to say whether they apply as an undergraduate or a graduate student', () => {
  // 메일 안내(지원 서류 첫 문단)와 절차 1단계 두 곳에서 말한다
  const docs = section('apply-documents');
  const intro = text(docs.slice(0, docs.indexOf('<ol')));
  assert.match(intro, /메일에는 학부 지원 인지 대학원 지원 인지 꼭 적어 주세요/);
  const step1 = text(items(section('apply-process'))[0]);
  assert.match(step1, /학부 지원인지 대학원 지원인지 적고/);
});

test('the old one-line recommendation is gone and every mail link goes to the lab address', () => {
  assert.doesNotMatch(HTML, /Recommended: attach/);
  const mails = [...HTML.matchAll(/href="mailto:([^"]+)"/g)].map((m) => m[1]);
  assert.ok(mails.length >= 2);
  assert.ok(mails.every((m) => m === 'sota@sota.dooray.com'), mails.join(', '));
});

test('the recruiting card points to both sections and never contradicts the 72-hour promise', () => {
  const card = HTML.slice(HTML.indexOf('<h1'), HTML.indexOf('id="apply-documents"'));
  assert.match(card, /href="mailto:sota@sota\.dooray\.com"/);
  assert.match(card, /href="#apply-documents"/);
  assert.match(card, /href="#apply-process"/);
  // 카드에 회신 시간을 적는다면 절차 섹션의 약속과 같은 숫자여야 한다
  const hours = (s) => [...text(s).matchAll(/(\d+)\s*(?:시간|hours?)/g)].map((m) => m[1]);
  assert.ok(hours(card).every((h) => h === '72'), `card says ${hours(card).join(', ')} hours`);
  assert.deepEqual([...new Set(hours(section('apply-process')))], ['72']);
});

test('page copy has no em or en dashes', () => {
  // "—" 같은 기계적인 문장 부호를 본문에 쓰지 않는다 (브라우저 탭 제목은 사이트 공통이라 제외)
  const body = text(HTML.slice(HTML.indexOf('<body')));
  assert.doesNotMatch(body, /[—–]/);
});

test('apply.html: unique ids, working in-page links and labelled sections', () => {
  const ids = [...HTML.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id');
  for (const m of HTML.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(m[1]), `href="#${m[1]}" has no target`);
  for (const m of HTML.matchAll(/aria-labelledby="([^"]+)"/g)) assert.ok(ids.includes(m[1]), `aria-labelledby="${m[1]}"`);
  assert.equal((HTML.match(/<h1\b/g) || []).length, 1);
  // 고정 헤더 아래로 숨지 않게 앵커 섹션에는 scroll margin 을 둔다
  for (const id of ['apply-documents', 'apply-process']) assert.match(section(id), /^<section\b[^>]*scroll-mt-/);
});

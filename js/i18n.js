/*
 * js/i18n.js — 한국어(기본) / English 전환
 *
 * 페이지 문구는 두 언어를 나란히 적는다. 지금 언어만 보이는 것은 css/redesign.css 가 맡는다.
 *   <h2><span data-ko>지원 서류</span><span data-en>Application documents</span></h2>
 * 속성은 영어 값을 data-en-<속성> 에 둔다 (한국어 값은 원래 속성 그대로).
 *   <button aria-label="닫기" data-en-aria-label="Close">
 * 글자만 바꾸는 요소는 data-en-text 를 쓴다.
 *
 * 헤더의 <button data-set-lang="ko|en"> 를 누르면 바뀐다. 선택은 localStorage('sota-lang') 에 남고,
 * 주소에 ?lang=en 을 붙여 영어로 열 수도 있다. 처음 언어는 각 페이지 <head> 의 짧은 스크립트가 정한다.
 * 언어가 바뀌면 document 에 'sota:lang' 이벤트를 보낸다 (논문·갤러리 목록이 다시 그린다).
 */
(function (root) {
  'use strict';

  var KEY = 'sota-lang';
  var ATTRS = ['aria-label', 'alt', 'title', 'placeholder'];

  function htmlEl() { return root.document.documentElement; }

  function current() {
    return htmlEl().getAttribute('data-lang') === 'en' ? 'en' : 'ko';
  }

  function each(scope, selector, fn) {
    var list = scope.querySelectorAll(selector);
    for (var i = 0; i < list.length; i++) fn(list[i]);
  }

  // 속성·글자 바꾸기. 처음 바꿀 때 한국어 원본을 data-ko-<속성> 에 보관해 두고 되돌릴 때 쓴다.
  function swap(scope, lang) {
    ATTRS.forEach(function (a) {
      each(scope, '[data-en-' + a + ']', function (el) {
        if (!el.hasAttribute('data-ko-' + a)) el.setAttribute('data-ko-' + a, el.getAttribute(a) || '');
        el.setAttribute(a, el.getAttribute((lang === 'en' ? 'data-en-' : 'data-ko-') + a));
      });
    });
    each(scope, '[data-en-text]', function (el) {
      if (!el.hasAttribute('data-ko-text')) el.setAttribute('data-ko-text', el.textContent);
      el.textContent = el.getAttribute(lang === 'en' ? 'data-en-text' : 'data-ko-text');
    });
  }

  function syncButtons(lang) {
    each(root.document, '[data-set-lang]', function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-set-lang') === lang ? 'true' : 'false');
    });
  }

  // scope 안(기본: 문서 전체)을 지금 언어에 맞춘다. 헤더처럼 나중에 끼워 넣은 부분에도 부른다.
  function apply(scope) {
    var lang = current();
    swap(scope || root.document, lang);
    syncButtons(lang);
  }

  function set(lang) {
    lang = lang === 'en' ? 'en' : 'ko';
    var el = htmlEl();
    el.setAttribute('data-lang', lang);
    el.setAttribute('lang', lang);
    try { root.localStorage.setItem(KEY, lang); } catch (e) { /* 저장 못 해도 이 페이지에서는 바뀐다 */ }
    apply(root.document);
    var ev;
    try { ev = new root.CustomEvent('sota:lang', { detail: { lang: lang } }); }
    catch (e) { ev = root.document.createEvent('CustomEvent'); ev.initCustomEvent('sota:lang', false, false, { lang: lang }); }
    root.document.dispatchEvent(ev);
  }

  // 한국어/영어 중 지금 언어 쪽을 고른다: SOTA_I18N.t('사진', 'Photos')
  function t(ko, en) { return current() === 'en' ? en : ko; }

  root.SOTA_I18N = { KEY: KEY, lang: current, set: set, apply: apply, t: t };

  // 헤더는 나중에 끼워 넣으므로 문서 전체에서 클릭을 받는다
  root.document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('[data-set-lang]') : null;
    if (!b) return;
    var lang = b.getAttribute('data-set-lang');
    if (lang !== current()) set(lang);
  });

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', function () { apply(root.document); });
  } else {
    apply(root.document);
  }
})(window);

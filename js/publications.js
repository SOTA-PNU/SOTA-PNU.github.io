/*
 * js/publications.js — data/publications.json → 논문 카드 렌더링 + 필터
 *
 * 데이터는 Google 시트('논문 등록')에서 Apps Script가 GitHub에 커밋한다 (apps-script/README.md 참고).
 * 카드 마크업/클래스는 css/redesign.css 의 .pnu-pub-* 스타일과 1:1 이므로 바꿀 때 CSS 도 함께 볼 것.
 * Node 테스트(tests/render.test.js)에서도 require 되므로 브라우저 전용 코드는 아래 진입점 안에만 둔다.
 */
(function (root) {
  'use strict';

  var KIND_LABEL = { conference: 'Conference', journal: 'Journal', workshop: 'Workshop' };
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  }

  function safeUrl(u) {
    u = String(u == null ? '' : u).trim();
    return /^https?:\/\//i.test(u) ? u : '';
  }

  function tagsFor(p) {
    var tags = p.type === 'journal' ? ['journal'] : p.type === 'workshop' ? ['conference', 'workshop'] : ['conference'];
    if (p.award) tags.push('awarded');
    return tags.join(',');
  }

  function cardHtml(p) {
    var paper = safeUrl(p.paperUrl);
    var code = safeUrl(p.codeUrl);
    var top = '';
    if (p.award || paper || code) {
      top = '<div class="pnu-pub-top">' +
        '<div class="pnu-badges">' + (p.award ? '<span class="pnu-badge pnu-badge-award">' + esc(p.award) + '</span>' : '') + '</div>' +
        ((paper || code)
          ? '<div class="pnu-links">' +
            (paper ? '<a class="pnu-link pnu-link-paper" href="' + esc(paper) + '" target="_blank" rel="noreferrer">Paper</a>' : '') +
            (code ? '<a class="pnu-link pnu-link-code" href="' + esc(code) + '" target="_blank" rel="noreferrer">Code</a>' : '') +
            '</div>'
          : '') +
        '</div>';
    }
    var meta = '<span class="pnu-meta">' + esc(p.venue) + '</span>' +
      (p.keywords ? '<span class="pnu-dot">|</span><span class="pnu-meta">' + esc(p.keywords) + '</span>' : '');
    return '<article class="pnu-pub-card' + (p.award ? ' pnu-pub-awarded' : '') + '" data-tags="' + tagsFor(p) + '" id="' + esc(p.id) + '">' +
      '<div class="pnu-pub-side">' +
        '<div class="pnu-venue-pill ' + (p.tier === 'top' ? 'pnu-venue-top' : 'pnu-venue-conf') + '">' + (esc(p.venueShort) || '—') + '</div>' +
        '<div class="pnu-venue-meta">' + (KIND_LABEL[p.type] || 'Conference') + '</div>' +
      '</div>' +
      '<div class="pnu-pub-main">' + top +
        '<h3 class="pnu-title">' + esc(p.title) + '</h3>' +
        '<p class="pnu-authors">' + esc((p.authors || []).join(', ')) + '</p>' +
        '<div class="pnu-meta-row">' + meta + '</div>' +
      '</div>' +
    '</article>';
  }

  function buildPublicationsHtml(doc) {
    var pubs = (doc && doc.publications) || [];
    var years = [];
    var byYear = {};
    pubs.forEach(function (p) {
      if (!byYear[p.year]) { byYear[p.year] = []; years.push(p.year); }
      byYear[p.year].push(p);
    });
    years.sort(function (a, b) { return b - a; });
    return years.map(function (y) {
      return '<div class="pnu-year-block">' +
        '<div class="pnu-year-badge"><div class="text-sm text-slate-500 font-semibold">Year</div>' +
        '<div class="text-3xl font-extrabold tracking-tight text-slate-900">' + y + '</div></div>' +
        '<div class="pnu-pub-list">' + byYear[y].map(cardHtml).join('') + '</div>' +
      '</div>';
    }).join('');
  }

  // 필터 칩 (#pubFilters [data-filter]) — 기존 publications.html 인라인 스크립트와 동일한 동작
  function initFilters(doc) {
    var filterBar = doc.getElementById('pubFilters');
    if (!filterBar) return;
    var chips = Array.prototype.slice.call(filterBar.querySelectorAll('[data-filter]'));
    var cards = Array.prototype.slice.call(doc.querySelectorAll('.pnu-pub-card'));
    var yearBlocks = Array.prototype.slice.call(doc.querySelectorAll('.pnu-year-block'));

    function normalizeTags(tagStr) {
      return (tagStr || '').split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    }
    function applyFilter(filterKey) {
      chips.forEach(function (c) { c.classList.toggle('is-active', c.dataset.filter === filterKey); });
      cards.forEach(function (card) {
        var tags = normalizeTags(card.getAttribute('data-tags'));
        card.style.display = (filterKey === 'all' || tags.indexOf(filterKey) !== -1) ? '' : 'none';
      });
      yearBlocks.forEach(function (block) {
        var visible = Array.prototype.slice.call(block.querySelectorAll('.pnu-pub-card'))
          .filter(function (c) { return c.style.display !== 'none'; });
        block.style.display = visible.length ? '' : 'none';
      });
    }
    if (!filterBar.__pnuBound) {
      filterBar.__pnuBound = true;
      filterBar.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-filter]');
        if (btn) applyFilter(btn.dataset.filter);
      });
    }
    applyFilter('all');
  }

  var api = { esc: esc, safeUrl: safeUrl, tagsFor: tagsFor, cardHtml: cardHtml,
    buildPublicationsHtml: buildPublicationsHtml, initFilters: initFilters };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // ---- 브라우저 진입점 ----
  if (typeof document !== 'undefined') {
    root.PnuPublications = api;
    var run = function () {
      var mount = document.getElementById('pubList');
      if (!mount) return;
      fetch('data/publications.json', { cache: 'no-cache' })
        .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .then(function (data) {
          var html = buildPublicationsHtml(data);
          mount.innerHTML = html || '<p class="text-slate-500">등록된 논문이 없습니다.</p>';
          initFilters(document);
        })
        .catch(function (err) {
          console.error('[publications] load failed:', err);
          mount.innerHTML = '<p class="text-slate-600">논문 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>';
        });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  }
})(typeof window !== 'undefined' ? window : globalThis);

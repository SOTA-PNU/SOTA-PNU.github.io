/*
 * js/publications.js — data/publications.json → 논문 카드 렌더링 + 필터
 *
 * 데이터는 Google 시트('논문 등록')에서 Apps Script가 GitHub에 커밋한다 (apps-script/README.md 참고).
 * 카드 마크업/클래스는 css/redesign.css 의 .pnu-pub-* 스타일과 1:1 이므로 바꿀 때 CSS 도 함께 볼 것.
 * Node 테스트(tests/render.test.js)에서도 require 되므로 브라우저 전용 코드는 아래 진입점 안에만 둔다.
 */
(function (root) {
  'use strict';

  // 화면 문구는 한국어·영어를 함께 내보내고, 지금 언어만 보이는 것은 css/redesign.css 가 맡는다 (js/i18n.js).
  // 그래서 언어를 바꿔도 목록을 다시 그릴 필요가 없다.
  var KIND_LABEL = {
    conference: ['학술대회', 'Conference'],
    journal: ['저널', 'Journal'],
    workshop: ['워크숍', 'Workshop']
  };
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function both(ko, en) { return '<span data-ko>' + ko + '</span><span data-en>' + en + '</span>'; }

  // 글자를 직접 넣는 곳(결과 알림)은 지금 언어 하나만 쓴다. 브라우저 밖(테스트)에서는 한국어.
  function lang() { var i = root.SOTA_I18N; return i && i.lang ? i.lang() : 'ko'; }
  function L(ko, en) { return lang() === 'en' ? en : ko; }

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

  // 국제/국내: 갱신 스크립트가 시트에서 판정해 region 에 적는다 ('SCI/학회' 가 국내…·KCI… 이거나
  // 저널/학회명에 한글이 있으면 국내 — apps-script/lib.js isDomestic). 카드 pill 색과 필터가 모두 이 값을 쓴다.
  // region 이 없는 예전 JSON(스크립트를 다시 붙여넣기 전)은 같은 판정에서 나온 tier 로 대신한다.
  function regionOf(p) {
    if (p.region === 'international' || p.region === 'domestic') return p.region;
    return p.tier === 'top' ? 'international' : 'domestic';
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
            (paper ? '<a class="pnu-link pnu-link-paper" href="' + esc(paper) + '" target="_blank" rel="noreferrer">' + both('논문', 'Paper') + '</a>' : '') +
            (code ? '<a class="pnu-link pnu-link-code" href="' + esc(code) + '" target="_blank" rel="noreferrer">' + both('코드', 'Code') + '</a>' : '') +
            '</div>'
          : '') +
        '</div>';
    }
    var meta = '<span class="pnu-meta">' + esc(p.venue) + '</span>' +
      (p.keywords ? '<span class="pnu-dot">|</span><span class="pnu-meta">' + esc(p.keywords) + '</span>' : '');
    var region = regionOf(p);
    var kind = KIND_LABEL[p.type] || KIND_LABEL.conference;
    // 제목: 한국어 화면은 원래 언어 그대로(국내 논문은 한글, 국제 논문은 영어), 영어 화면은 영문 제목이 따로 있으면 그것
    var title = esc(p.title);
    var titleEn = esc(p.titleEn || '');
    return '<article class="pnu-pub-card' + (p.award ? ' pnu-pub-awarded' : '') + '" data-tags="' + tagsFor(p) +
      '" data-region="' + region + '" id="' + esc(p.id) + '">' +
      '<div class="pnu-pub-side">' +
        '<div class="pnu-venue-pill ' + (region === 'international' ? 'pnu-venue-top' : 'pnu-venue-conf') + '">' + (esc(p.venueShort) || '—') + '</div>' +
        '<div class="pnu-venue-meta">' + both(kind[0], kind[1]) + '</div>' +
      '</div>' +
      '<div class="pnu-pub-main">' + top +
        '<h3 class="pnu-title">' + (titleEn && titleEn !== title ? both(title, titleEn) : title) + '</h3>' +
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
        '<div class="pnu-year-badge"><div class="text-sm text-slate-500 font-semibold">' + both('연도', 'Year') + '</div>' +
        '<div class="text-3xl font-extrabold tracking-tight text-slate-900">' + esc(y) + '</div></div>' +
        '<div class="pnu-pub-list">' + byYear[y].map(cardHtml).join('') + '</div>' +
      '</div>';
    }).join('');
  }

  // 필터 칩 (#pubFilters)
  //  - [data-filter="all"]: 모든 조건 해제. 토글이 아니라 '전체 보기' 버튼이라 aria-pressed 를 두지 않는다.
  //  - [data-region="international|domestic"]: 국제/국내, [data-filter="conference|journal|awarded"]: 유형.
  //    묶음마다 하나만 켜지고, 두 묶음은 함께 걸린다(AND). 켜진 칩을 다시 누르면 그 조건만 해제된다.
  //  조건 상태는 #pubFilters 에 둔다 — 클릭 리스너는 한 번만 붙으므로 다시 호출돼도 같은 상태를 봐야 한다.
  //  #pubStatus(role=status)는 늘 페이지에 있어야 스크린리더가 바뀐 내용을 읽는다 (숨겼다 보이면 안 읽힐 수 있다).
  //  알림 글자는 지금 언어로 넣고, 언어가 바뀌면(sota:lang) 다시 맞춘다.
  function noMatchText() { return L('선택한 조건에 맞는 논문이 없습니다.', 'No papers match the selected filters.'); }
  function countText(n) { return L('논문 ' + n + '편', n + (n === 1 ? ' paper' : ' papers')); }
  function initFilters(doc) {
    var filterBar = doc.getElementById('pubFilters');
    if (!filterBar) return;
    var slice = function (list) { return Array.prototype.slice.call(list); };
    filterBar.__pnuState = { kind: 'all', region: 'all' };

    function normalizeTags(tagStr) {
      return (tagStr || '').split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
    }
    function isOn(chip, state) {
      var kind = chip.getAttribute('data-filter');
      if (kind === 'all') return state.kind === 'all' && state.region === 'all';
      if (kind) return state.kind === kind;
      return state.region === chip.getAttribute('data-region');
    }
    // 카드/연도 블록은 호출 시점에 다시 조회한다 (재렌더 뒤에도 최신 목록을 필터링)
    // announce: 사용자가 칩을 눌렀을 때만 결과 수를 스크린리더에 알린다 (처음 그릴 때는 조용히)
    function apply(announce) {
      var state = filterBar.__pnuState;
      slice(filterBar.querySelectorAll('[data-filter], [data-region]')).forEach(function (chip) {
        var on = isOn(chip, state);
        chip.classList.toggle('is-active', on);
        if (chip.getAttribute('data-filter') !== 'all') chip.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var cards = slice(doc.querySelectorAll('.pnu-pub-card'));
      var shown = 0;
      cards.forEach(function (card) {
        var ok = (state.kind === 'all' || normalizeTags(card.getAttribute('data-tags')).indexOf(state.kind) !== -1) &&
          (state.region === 'all' || card.getAttribute('data-region') === state.region);
        card.style.display = ok ? '' : 'none';
        if (ok) shown++;
      });
      // 연도 블록은 display 대신 hidden 으로 숨긴다: #pubList 의 space-y 간격 규칙이 [hidden] 만 건너뛴다
      slice(doc.querySelectorAll('.pnu-year-block')).forEach(function (block) {
        block.hidden = !slice(block.querySelectorAll('.pnu-pub-card'))
          .some(function (c) { return c.style.display !== 'none'; });
      });
      var status = doc.getElementById('pubStatus');
      if (!status) return;
      // 목록 자체가 비어 있으면 목록이 '등록된 논문이 없습니다.' 를 보여 주므로 여기서는 말하지 않는다
      var noMatch = cards.length > 0 && shown === 0;
      status.textContent = noMatch ? noMatchText() : (announce && cards.length ? countText(shown) : '');
      status.classList.toggle('pnu-sr-only', !noMatch);
    }
    if (!filterBar.__pnuBound) {
      filterBar.__pnuBound = true;
      filterBar.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-filter], [data-region]');
        if (!btn) return;
        var state = filterBar.__pnuState;
        var kind = btn.getAttribute('data-filter');
        var region = btn.getAttribute('data-region');
        if (kind === 'all') { state.kind = 'all'; state.region = 'all'; }
        else if (kind) state.kind = state.kind === kind ? 'all' : kind;
        else if (region) state.region = state.region === region ? 'all' : region;
        apply(true);
      });
      // 언어가 바뀌면 화면에 나와 있는 알림("조건에 맞는 논문이 없습니다")도 그 언어로 바꾼다
      doc.addEventListener('sota:lang', function () { apply(false); });
    }
    apply(false);
  }

  var api = { esc: esc, safeUrl: safeUrl, tagsFor: tagsFor, regionOf: regionOf, cardHtml: cardHtml,
    buildPublicationsHtml: buildPublicationsHtml, initFilters: initFilters, KIND_LABEL: KIND_LABEL };

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
          mount.innerHTML = html || '<p class="text-slate-500">' + both('등록된 논문이 없습니다.', 'No publications yet.') + '</p>';
          initFilters(document);
        })
        .catch(function (err) {
          console.error('[publications] load failed:', err);
          mount.innerHTML = '<p class="text-slate-600">' +
            both('논문 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
              'We could not load the publication list. Please try again later.') + '</p>';
        });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  }
})(typeof window !== 'undefined' ? window : globalThis);

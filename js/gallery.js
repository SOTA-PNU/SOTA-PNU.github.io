/*
 * js/gallery.js — data/gallery.json → 갤러리 렌더링 + 필터 + 사진 뷰어
 *
 * Publications 와 같은 구조다: 연도별 .pnu-year-block 안에 앨범 한 줄씩(.pnu-gallery-item).
 * 사진 추가 방법은 assets/images/gallery/README.md 참고.
 * 카드 마크업/클래스는 css/redesign.css 의 .pnu-gallery-* 와 1:1 이므로 바꿀 때 CSS 도 함께 볼 것.
 * Node 테스트(tests/gallery.test.js)에서도 require 되므로 브라우저 전용 코드는 아래 진입점 안에만 둔다.
 */
(function (root) {
  'use strict';

  var CATEGORIES = ['conference', 'lab', 'award', 'seminar'];
  var CATEGORY_LABEL = { conference: 'Conference', lab: 'Lab', award: 'Award', seminar: 'Seminar' };
  var STRIP_THUMBS = 6;               // 카드 필름스트립에 보여줄 썸네일 수 (표지 제외)
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; });
  }

  // 저장소 안의 상대 경로와 https 주소만 허용한다 (javascript:, data:, http:, //host 차단)
  function safeSrc(p) {
    var s = String(p == null ? '' : p).trim();
    if (!s) return '';
    if (s.indexOf('//') === 0) return '';
    if (/^https:\/\//i.test(s)) return encodeURI(s).replace(/#/g, '%23');
    if (/^[a-z][a-z0-9+.\-]*:/i.test(s)) return '';
    return encodeURI(s).replace(/#/g, '%23');
  }

  // [표지, ...사진] 순서로 합치고 중복을 없앤다
  function photosOf(album) {
    var out = [];
    var seen = {};
    [safeSrc(album && album.cover)].concat(((album && album.photos) || []).map(safeSrc))
      .forEach(function (p) {
        if (p && !seen[p]) { seen[p] = true; out.push(p); }
      });
    return out;
  }

  function categoryOf(album) {
    var c = String((album && album.category) || '').trim().toLowerCase();
    return CATEGORIES.indexOf(c) !== -1 ? c : 'lab';
  }

  // 2026-03-14 → 2026.03.14 / 2026-03 → 2026.03 / 없으면 연도만
  function dateLabel(album) {
    var m = String((album && album.date) || '').match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
    if (!m) return String((album && album.year) || '');
    return m[3] ? m[1] + '.' + m[2] + '.' + m[3] : m[1] + '.' + m[2];
  }

  function yearOf(album) {
    if (album && album.year) return Number(album.year);
    var m = String((album && album.date) || '').match(/^(\d{4})/);
    return m ? Number(m[1]) : 0;
  }

  function normalize(album) {
    return {
      id: String((album && album.id) || ''),
      title: String((album && album.title) || ''),
      date: String((album && album.date) || ''),
      year: yearOf(album),
      category: categoryOf(album),
      place: String((album && album.place) || ''),
      description: String((album && album.description) || ''),
      photos: photosOf(album)
    };
  }

  // 최신순: 연도 내림차순 → 날짜 내림차순(빈 날짜는 그 해의 뒤로) → 원래 순서
  function sortAlbums(albums) {
    return albums.map(function (a, i) { return { a: a, i: i }; })
      .sort(function (x, y) {
        if (y.a.year !== x.a.year) return y.a.year - x.a.year;
        var xd = x.a.date, yd = y.a.date;
        if (xd !== yd) {
          if (!xd) return 1;
          if (!yd) return -1;
          return xd < yd ? 1 : -1;
        }
        return x.i - y.i;
      })
      .map(function (o) { return o.a; });
  }

  function groupByYear(albums) {
    var years = [], byYear = {};
    sortAlbums(albums).forEach(function (a) {
      if (!byYear[a.year]) { byYear[a.year] = []; years.push(a.year); }
      byYear[a.year].push(a);
    });
    years.sort(function (x, y) { return y - x; });
    return years.map(function (y) { return { year: y, albums: byYear[y] }; });
  }

  function countLine(albums) {
    var n = albums.length;
    var m = albums.reduce(function (s, a) { return s + a.photos.length; }, 0);
    return n + (n === 1 ? ' album · ' : ' albums · ') + m + (m === 1 ? ' photo' : ' photos');
  }

  function thumbHtml(src, index, total, title) {
    return '<button class="pnu-gallery-thumb" type="button" data-index="' + index +
      '" aria-label="' + esc(title) + ' 사진 ' + (index + 1) + ' / ' + total + '">' +
      '<img src="' + src + '" alt="" loading="lazy" decoding="async" width="124" height="124">' +
      '</button>';
  }

  function cardHtml(raw) {
    var a = normalize(raw);
    var photos = a.photos;
    var total = photos.length;

    var cover = total
      ? '<button class="pnu-gallery-cover" type="button" data-index="0" aria-label="' + esc(a.title) +
        (total > 1 ? ' — 사진 ' + total + '장 크게 보기' : ' — 사진 크게 보기') + '">' +
        '<img src="' + photos[0] + '" alt="" loading="lazy" decoding="async" width="960" height="600">' +
        (total > 1 ? '<span class="pnu-gallery-count">' + total + ' photos</span>' : '') +
        '</button>'
      : '<div class="pnu-gallery-cover is-empty" aria-hidden="true"></div>';

    var strip = '';
    if (total > 1) {
      var thumbs = [];
      for (var i = 1; i <= STRIP_THUMBS && i < total; i++) thumbs.push(thumbHtml(photos[i], i, total, a.title));
      var shown = 1 + Math.min(STRIP_THUMBS, total - 1);
      if (total > shown) {
        thumbs.push('<button class="pnu-gallery-more" type="button" data-index="' + shown +
          '" aria-label="' + esc(a.title) + ' 사진 ' + total + '장 모두 보기">+' + (total - shown) + '</button>');
      }
      strip = '<div class="pnu-gallery-strip" role="group" tabindex="0" aria-label="' + esc(a.title) +
        ' 사진 목록">' + thumbs.join('') + '</div>';
    }

    return '<article class="pnu-gallery-item" id="album-' + esc(a.id) + '" data-album="' + esc(a.id) +
      '" data-tags="' + a.category + '" data-photos="' + total + '">' +
      '<div class="pnu-gallery-card">' + cover +
        '<div class="pnu-gallery-body">' +
          '<div class="pnu-gallery-meta">' +
            '<span class="pnu-badge pnu-gallery-cat" data-cat="' + a.category + '">' + CATEGORY_LABEL[a.category] + '</span>' +
            (dateLabel(a) ? '<span class="pnu-gallery-date">' + esc(dateLabel(a)) + '</span>' : '') +
          '</div>' +
          '<h3 class="pnu-gallery-title">' + esc(a.title) + '</h3>' +
          (a.place ? '<p class="pnu-gallery-place">' + esc(a.place) + '</p>' : '') +
          (a.description ? '<p class="pnu-gallery-desc">' + esc(a.description) + '</p>' : '') +
          strip +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function buildGalleryHtml(doc) {
    var albums = ((doc && doc.albums) || []).map(normalize).filter(function (a) { return a.title || a.photos.length; });
    if (!albums.length) return '';
    return groupByYear(albums).map(function (g) {
      return '<div class="pnu-year-block" id="year-' + g.year + '">' +
        '<div class="pnu-year-badge pnu-gallery-year-badge">' +
          '<div class="text-sm text-slate-500 font-semibold">Year</div>' +
          '<div class="text-3xl font-extrabold tracking-tight text-slate-900">' + g.year + '</div>' +
          '<div class="pnu-gallery-year-count" data-year-count>' + countLine(g.albums) + '</div>' +
        '</div>' +
        '<div class="pnu-gallery-track">' + g.albums.map(function (a) { return cardHtml(a); }).join('') + '</div>' +
      '</div>';
    }).join('');
  }

  var EMPTY_HTML = '<div class="pnu-gallery-empty">' +
    '<p class="pnu-gallery-empty-title">No albums yet</p>' +
    '<p class="pnu-gallery-empty-text">사진이 등록되면 이곳에 연도별로 쌓입니다.<br>' +
    '학회 출장 · 랩 워크숍 · 수상 · 세미나 기록을 시간순으로 모아 둡니다.</p>' +
    '<p class="pnu-gallery-empty-text">현장 사진이 있다면 ' +
    '<a href="mailto:sota@sota.dooray.com">sota@sota.dooray.com</a> 으로 보내 주세요.</p>' +
    '</div>';

  function filterEmptyHtml(label) {
    return '<div class="pnu-gallery-empty">' +
      '<p class="pnu-gallery-empty-title">No albums in ' + esc(label) + '</p>' +
      '<p class="pnu-gallery-empty-text">이 분류에는 아직 등록된 앨범이 없습니다. 다른 분류를 고르거나 ' +
      '<button class="pnu-gallery-empty-reset" type="button" data-filter="all">All</button> 로 돌아가 보세요.</p>' +
      '</div>';
  }

  // ---- 필터: DOM 을 인자(ctx)로만 만지므로 브라우저 밖에서도 테스트할 수 있다 ----

  function renderJump(list, jump) {
    if (!jump) return;
    var blocks = Array.prototype.slice.call(list.querySelectorAll('.pnu-year-block'))
      .filter(function (b) { return b.style.display !== 'none'; });
    var links = blocks.map(function (b) {
      var y = String(b.id).replace('year-', '');
      return '<a href="#year-' + y + '">' + y + '</a>';
    });
    if (links.length < 2) { jump.hidden = true; return; }
    jump.innerHTML = '<span class="pnu-gallery-jump-label">Jump to</span>' + links.join('');
    jump.hidden = false;
  }

  function applyFilter(key, ctx) {
    var chips = Array.prototype.slice.call(ctx.filters.querySelectorAll('[data-filter]'));
    chips.forEach(function (c) { c.classList.toggle('is-active', c.dataset.filter === key); });

    Array.prototype.slice.call(ctx.list.querySelectorAll('.pnu-gallery-item')).forEach(function (item) {
      var show = key === 'all' || item.getAttribute('data-tags') === key;
      item.style.display = show ? '' : 'none';
    });

    var visible = 0;
    Array.prototype.slice.call(ctx.list.querySelectorAll('.pnu-year-block')).forEach(function (block) {
      var shown = Array.prototype.slice.call(block.querySelectorAll('.pnu-gallery-item'))
        .filter(function (i) { return i.style.display !== 'none'; });
      block.style.display = shown.length ? '' : 'none';
      visible += shown.length;
      var line = block.querySelector('[data-year-count]');
      if (line) {
        var photos = shown.reduce(function (s, i) { return s + (Number(i.getAttribute('data-photos')) || 0); }, 0);
        line.textContent = shown.length + (shown.length === 1 ? ' album · ' : ' albums · ') +
          photos + (photos === 1 ? ' photo' : ' photos');
      }
    });

    var old = ctx.list.querySelector('.pnu-gallery-empty');
    if (old && old.parentNode) old.parentNode.removeChild(old);
    if (!visible) {
      var chip = chips.filter(function (c) { return c.dataset.filter === key; })[0];
      ctx.list.insertAdjacentHTML('beforeend', filterEmptyHtml(chip ? chip.textContent.trim() : key));
    }
    if (ctx.status) ctx.status.textContent = visible + (visible === 1 ? ' album' : ' albums');
    renderJump(ctx.list, ctx.jump);
    return visible;
  }

  function initFilters(ctx) {
    if (!ctx.filters || ctx.filters.__pnuBound) return;
    ctx.filters.__pnuBound = true;
    ctx.filters.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-filter]');
      if (btn) applyFilter(btn.dataset.filter, ctx);
    });
    ctx.list.addEventListener('click', function (e) {
      if (e.target.closest('.pnu-gallery-empty-reset')) applyFilter('all', ctx);
    });
  }

  var api = {
    CATEGORIES: CATEGORIES,
    CATEGORY_LABEL: CATEGORY_LABEL,
    applyFilter: applyFilter,
    initFilters: initFilters,
    renderJump: renderJump,
    esc: esc,
    safeSrc: safeSrc,
    photosOf: photosOf,
    categoryOf: categoryOf,
    dateLabel: dateLabel,
    normalize: normalize,
    sortAlbums: sortAlbums,
    groupByYear: groupByYear,
    countLine: countLine,
    cardHtml: cardHtml,
    buildGalleryHtml: buildGalleryHtml,
    EMPTY_HTML: EMPTY_HTML,
    filterEmptyHtml: filterEmptyHtml
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  root.PnuGallery = api;

  // ------------------------------------------------------------------ 브라우저

  var PHOTOS = {};      // albumId → [src]
  var TITLES = {};      // albumId → { title, place, date }

  function stash(doc) {
    PHOTOS = {}; TITLES = {};
    ((doc && doc.albums) || []).forEach(function (raw) {
      var a = normalize(raw);
      if (!a.id) return;
      PHOTOS[a.id] = a.photos;
      TITLES[a.id] = { title: a.title, place: a.place, date: dateLabel(a) };
    });
  }

  // ------------------------------------------------------------------ 사진 뷰어

  function Lightbox() {
    var el = document.getElementById('galleryLightbox');
    if (!el) return null;
    var img = document.getElementById('galleryLbImg');
    var railEl = document.getElementById('galleryLbRail');
    var prev = document.getElementById('galleryLbPrev');
    var next = document.getElementById('galleryLbNext');
    var close = document.getElementById('galleryLbClose');
    var titleEl = document.getElementById('galleryLbTitle');
    var subEl = document.getElementById('galleryLbSub');
    var countEl = document.getElementById('galleryLbCount');
    var list = [], at = 0, lastFocus = null, hideTimer = null;

    function show(i) {
      at = Math.max(0, Math.min(i, list.length - 1));
      img.src = list[at];
      countEl.textContent = list.length > 1 ? (at + 1) + ' / ' + list.length : '';
      prev.disabled = at === 0;
      next.disabled = at === list.length - 1;
      prev.hidden = next.hidden = list.length < 2;
      Array.prototype.slice.call(railEl.children).forEach(function (b, i2) {
        b.classList.toggle('is-current', i2 === at);
        if (i2 === at && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      });
      [at - 1, at + 1].forEach(function (j) {
        if (list[j]) { var p = new Image(); p.src = list[j]; }
      });
    }

    function open(id, index) {
      list = PHOTOS[id] || [];
      if (!list.length) return;
      var meta = TITLES[id] || {};
      titleEl.textContent = meta.title || '';
      subEl.textContent = [meta.date, meta.place].filter(Boolean).join(' · ');
      railEl.innerHTML = list.length > 1 ? list.map(function (src, i) {
        return '<button type="button" data-rail="' + i + '" aria-label="사진 ' + (i + 1) + ' / ' + list.length + '">' +
          '<img src="' + src + '" alt="" loading="lazy" decoding="async"></button>';
      }).join('') : '';
      lastFocus = document.activeElement;
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      el.hidden = false;
      document.documentElement.classList.add('pnu-lightbox-open');
      show(index || 0);
      void el.offsetHeight;
      el.classList.add('is-open');
      close.focus();
    }

    function hide() {
      el.classList.remove('is-open');
      document.documentElement.classList.remove('pnu-lightbox-open');
      hideTimer = window.setTimeout(function () { el.hidden = true; hideTimer = null; }, 200);
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    function isOpen() { return !el.hidden; }

    prev.addEventListener('click', function () { show(at - 1); });
    next.addEventListener('click', function () { show(at + 1); });
    close.addEventListener('click', hide);
    el.addEventListener('click', function (e) {
      if (e.target === el || e.target.classList.contains('pnu-gallery-lb-stage')) hide();
      var r = e.target.closest('[data-rail]');
      if (r) show(Number(r.getAttribute('data-rail')));
    });
    window.addEventListener('keydown', function (e) {
      if (!isOpen()) return;
      if (e.key === 'Escape') { hide(); return; }
      if (e.key === 'ArrowLeft') { show(at - 1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { show(at + 1); e.preventDefault(); }
      else if (e.key === 'Home') { show(0); e.preventDefault(); }
      else if (e.key === 'End') { show(list.length - 1); e.preventDefault(); }
      else if (e.key === 'Tab') {
        // 포커스를 뷰어 안에 가둔다
        var focusable = [close, prev, next].filter(function (b) { return !b.hidden && !b.disabled; })
          .concat(Array.prototype.slice.call(railEl.children));
        if (!focusable.length) return;
        var i = focusable.indexOf(document.activeElement);
        var nextI = e.shiftKey ? (i <= 0 ? focusable.length - 1 : i - 1) : (i === focusable.length - 1 ? 0 : i + 1);
        focusable[nextI].focus();
        e.preventDefault();
      }
    });

    return { open: open, hide: hide, isOpen: isOpen };
  }

  function run() {
    var list = document.getElementById('galleryList');
    if (!list) return;
    var ctx = {
      list: list,
      filters: document.getElementById('galleryFilters'),
      jump: document.getElementById('galleryJump'),
      status: document.getElementById('galleryStatus')
    };

    fetch('data/gallery.json', { cache: 'no-cache' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (doc) {
        stash(doc);
        var html = buildGalleryHtml(doc);
        list.innerHTML = html || EMPTY_HTML;
        list.setAttribute('aria-busy', 'false');
        if (!html) { if (ctx.jump) ctx.jump.hidden = true; return; }

        initFilters(ctx);
        applyFilter('all', ctx);

        var lb = Lightbox();
        if (lb) {
          list.addEventListener('click', function (e) {
            var target = e.target.closest('[data-index]');
            if (!target) return;
            var item = target.closest('[data-album]');
            if (!item) return;
            lb.open(item.getAttribute('data-album'), Number(target.getAttribute('data-index')) || 0);
          });
        }
      })
      .catch(function (err) {
        console.error('[gallery] load failed:', err);
        list.innerHTML = '<p class="text-slate-600">갤러리를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>';
        list.setAttribute('aria-busy', 'false');
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})(typeof window !== 'undefined' ? window : globalThis);

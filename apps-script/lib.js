/*
 * apps-script/lib.js — 시트 행 → 홈페이지 논문 레코드 변환 (순수 로직)
 *
 * Google Apps Script(V8)와 Node.js 양쪽에서 그대로 실행된다.
 *  - Apps Script: 이 파일을 lib.gs 로 붙여넣으면 전역 PubLib 로 접근
 *  - Node: require('./lib.js')
 * 시트 셀 값 이외의 외부 상태(시각, 네트워크)에 의존하지 않는다.
 */
var PubLib = (function () {
  'use strict';

  // 논리 이름 → 시트 헤더 (헤더는 공백/줄바꿈을 제거한 뒤 비교한다)
  var COLUMNS = {
    publish: 'Publish',
    type: 'SCI/학회',
    date: '발표일자',
    venue: '저널명/학회명',
    titleKo: '제목(한글)',
    titleEn: '제목(영어)',
    country: '출판국/개최국',
    first: '1저자',
    co: '공동',
    corr: '교신',
    // 홈페이지용 열 (초기 설정에서 추가)
    exclude: '홈페이지 제외',
    kind: '구분',
    venueShort: '약칭',
    keywords: '키워드',
    paperUrl: 'Paper 링크',
    codeUrl: 'Code 링크',
    award: '수상'
  };
  var REQUIRED_HEADERS = [COLUMNS.publish, COLUMNS.date, COLUMNS.titleKo, COLUMNS.titleEn, COLUMNS.first];
  var WEBSITE_HEADERS = [COLUMNS.exclude, COLUMNS.kind, COLUMNS.venueShort, COLUMNS.keywords,
    COLUMNS.paperUrl, COLUMNS.codeUrl, COLUMNS.award];

  function str(v) {
    return String(v == null ? '' : v).trim();
  }

  function normalizeHeader(h) {
    return String(h == null ? '' : h).replace(/\s+/g, '');
  }

  function headerIndex(headers) {
    var map = {};
    (headers || []).forEach(function (h, i) {
      var k = normalizeHeader(h);
      if (k && !(k in map)) map[k] = i;
    });
    return map;
  }

  function cell(row, idx, headerName) {
    var i = idx[normalizeHeader(headerName)];
    if (i == null || !row || i >= row.length) return '';
    var v = row[i];
    return v == null ? '' : v;
  }

  function isTruthy(v) {
    if (v === true) return true;
    if (typeof v === 'number') return v !== 0;
    var s = str(v).toLowerCase();
    return s === 'true' || s === '1' || s === 'y' || s === 'yes';
  }

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function ymd(y, m, d) {
    // m/d 는 null 허용 (부분 날짜). 범위 검사 후 {year, iso} 또는 null
    if (!(y >= 1900 && y <= 2100)) return null;
    if (m != null && !(m >= 1 && m <= 12)) return null;
    if (d != null && !(d >= 1 && d <= 31)) return null;
    var iso = String(y);
    if (m != null) iso += '-' + pad2(m);
    if (m != null && d != null) iso += '-' + pad2(d);
    return { year: y, iso: iso };
  }

  function parseDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) {
      if (isNaN(v.getTime())) return null;
      return ymd(v.getFullYear(), v.getMonth() + 1, v.getDate());
    }
    if (typeof v === 'number') {
      // 스프레드시트 시리얼: 1899-12-30 기준 일수
      var ms = Date.UTC(1899, 11, 30) + Math.round(v) * 86400000;
      var dt = new Date(ms);
      return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
    }
    var s = str(v);
    var m = s.match(/^(\d{4})(?:\s*[.\-\/년]\s*(\d{1,2})(?:\s*[.\-\/월]\s*(\d{1,2}))?)?/);
    if (!m) return null;
    return ymd(Number(m[1]), m[2] != null ? Number(m[2]) : null, m[3] != null ? Number(m[3]) : null);
  }

  function splitAuthors(v) {
    return str(v).split(/[,;\/\n]+/).map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function mergeAuthors(first, co, corr) {
    var out = [];
    var seen = {};
    [first, co, corr].forEach(function (v) {
      splitAuthors(v).forEach(function (a) {
        var k = a.replace(/\s+/g, '').toLowerCase();
        if (!seen[k]) { seen[k] = true; out.push(a); }
      });
    });
    return out;
  }

  function isDomestic(typeCell, countryCell) {
    return /^국내/.test(str(typeCell)) || /한국|korea/i.test(str(countryCell));
  }

  // 약칭 매핑표: 저널명/학회명에 대해 위에서부터 첫 매칭. 추가/수정은 여기서.
  var VENUE_SHORT_MAP = [
    [/IEMEK|임베디드공학회/i, 'IEMEK'],
    [/\bKIPS\b|정보처리학회|\bASK\b/i, 'KIPS'],
    [/NeurIPS/i, 'NeurIPS'],
    [/\bICCV\b|ICCV-W/i, 'ICCV'],
    [/\bECCV\b|ECCV-W/i, 'ECCV'],
    [/\bCGO\b|CGO-W/i, 'CGO'],
    [/\bLCTES\b/i, 'LCTES'],
    [/\bCASES\b/i, 'CASES'],
    [/\bIJCAI\b/i, 'IJCAI'],
    [/\bIROS\b/i, 'IROS'],
    [/\bICRA\b/i, 'ICRA'],
    [/Future Generation Computer Systems/i, 'FGCS'],
    [/Transactions on Embedded Computing/i, 'TECS'],
    [/Transactions on Mobile Computing/i, 'TMC'],
    [/ETRI\s*Journal/i, 'ETRI Journal'],
    [/Parallel and Distributed Computing/i, 'JPDC'],
    [/Internet of Things Journal/i, 'IEEE IoT-J'],
    [/전자공학회/i, 'IEIE'],
    [/한국\s*컴퓨터\s*종합/i, 'KCC'],
    [/통신학회/i, 'KICS'],
    [/기계학회/i, 'KSME'],
    [/AICompS/i, 'AICompS'],
    [/\bACK\b/i, 'ACK'],
    [/Workload Characterization|\bIISWC\b/i, 'IISWC']
  ];
  var TYPE_JOURNAL_HINT = /\bSCI\b|\bKCI\b|저널|논문지|학회지|\bjournal\b/i;
  var VENUE_JOURNAL_HINT = /저널|논문지|학회지|\bjournal\b|\btransactions\b/i;
  var WORKSHOP_HINT = /workshop|-W\b|\bWIP\b/i;

  function detectKind(kindCell, typeCell, venueCell) {
    var k = str(kindCell).toLowerCase();
    if (k === 'conference' || k === 'journal' || k === 'workshop') return k;
    if (TYPE_JOURNAL_HINT.test(str(typeCell)) || VENUE_JOURNAL_HINT.test(str(venueCell))) return 'journal';
    if (WORKSHOP_HINT.test(str(venueCell))) return 'workshop';
    return 'conference';
  }

  function detectVenueShort(shortCell, venueCell) {
    var s = str(shortCell);
    if (s) return s;
    var v = str(venueCell);
    if (!v) return '';
    for (var i = 0; i < VENUE_SHORT_MAP.length; i++) {
      if (VENUE_SHORT_MAP[i][0].test(v)) return VENUE_SHORT_MAP[i][1];
    }
    var m = v.match(/\(([A-Z][A-Za-z0-9-]{1,10})\)/);
    if (m) return m[1];
    return v.split(/\s+/)[0].replace(/[,:;]+$/, '');
  }

  function slugify(title) {
    return str(title).toLowerCase()
      .replace(/[^0-9a-z가-힣]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/, '');
  }

  function normalizeTitle(title) {
    return str(title).normalize('NFKC').toLowerCase().replace(/[^0-9a-z가-힣]+/g, '');
  }

  function checkUrl(v) {
    var u = str(v);
    return /^https?:\/\//i.test(u) ? u : '';
  }

  return {
    VENUE_SHORT_MAP: VENUE_SHORT_MAP,
    detectKind: detectKind,
    detectVenueShort: detectVenueShort,
    slugify: slugify,
    normalizeTitle: normalizeTitle,
    checkUrl: checkUrl,
    COLUMNS: COLUMNS,
    REQUIRED_HEADERS: REQUIRED_HEADERS,
    WEBSITE_HEADERS: WEBSITE_HEADERS,
    str: str,
    normalizeHeader: normalizeHeader,
    headerIndex: headerIndex,
    cell: cell,
    isTruthy: isTruthy,
    parseDate: parseDate,
    splitAuthors: splitAuthors,
    mergeAuthors: mergeAuthors,
    isDomestic: isDomestic
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PubLib;

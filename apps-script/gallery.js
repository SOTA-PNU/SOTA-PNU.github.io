/*
 * apps-script/gallery.js — 시트 '갤러리' 탭 → data/gallery.json 변환 (순수 로직)
 *
 * Google Apps Script(V8)와 Node.js 양쪽에서 그대로 실행된다.
 *  - Apps Script: 이 파일을 pubGallery.gs 로 붙여넣으면 전역 GalLib 로 접근 (pubLib.gs 가 먼저 있어야 한다)
 *  - Node: require('./gallery.js')
 * 시트 셀 값 이외의 외부 상태(시각, 드라이브, 네트워크)에 의존하지 않는다.
 */
var GalLib = (function (lib) {
  'use strict';

  var COLUMNS = {
    publish: '게시',
    title: '행사명',
    date: '날짜',
    place: '장소',
    description: '설명',
    folder: '드라이브 폴더 링크',
    id: 'ID (자동)',
    photoCount: '사진 수 (자동)',
    syncedAt: '마지막 갱신 (자동)'
  };
  // 사람이 채우는 열 + 스크립트가 채우는 열 (초기 설정에서 이 순서로 만든다)
  var HEADERS = [COLUMNS.publish, COLUMNS.title, COLUMNS.date, COLUMNS.place, COLUMNS.description,
    COLUMNS.folder, COLUMNS.id, COLUMNS.photoCount, COLUMNS.syncedAt];
  var REQUIRED_HEADERS = [COLUMNS.publish, COLUMNS.title, COLUMNS.date, COLUMNS.folder];
  var AUTO_HEADERS = [COLUMNS.id, COLUMNS.photoCount, COLUMNS.syncedAt];

  // 드라이브 폴더 링크에서 폴더 ID 를 뽑는다.
  // https://drive.google.com/drive/folders/<ID>?usp=sharing  /  .../folders/<ID>  /  ID 만 붙여넣은 경우
  function folderIdFrom(value) {
    var s = lib.str(value);
    if (!s) return '';
    var m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/) ||
            s.match(/[?&]id=([A-Za-z0-9_-]{10,})/) ||
            s.match(/^([A-Za-z0-9_-]{10,})$/);
    return m ? m[1] : '';
  }

  // 앨범 ID: 2026-05-iset-2026 처럼 연-월 + 제목 슬러그. 시트에 적어 두므로 제목을 고쳐도 유지된다.
  function makeAlbumId(dateIso, title) {
    var ym = String(dateIso || '').slice(0, 7).replace(/[^0-9]/g, '-').replace(/-+$/, '');
    var slug = lib.slugify(title).slice(0, 40).replace(/-+$/, '');
    return [ym, slug].filter(Boolean).join('-') || 'album';
  }

  // 저장소에 넣을 파일명: 확장자는 소문자, 나머지는 안전한 문자만.
  // forceExt 를 주면 그 확장자를 쓴다 (드라이브 축소본은 항상 JPEG 이라 'jpg' 를 넘긴다).
  function safeFileName(name, index, forceExt) {
    var s = lib.str(name);
    var dot = s.lastIndexOf('.');
    var base = dot > 0 ? s.slice(0, dot) : s;
    var ext = lib.str(forceExt) || (dot > 0 ? s.slice(dot + 1) : 'jpg');
    ext = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!ext) ext = 'jpg';
    base = base.normalize ? base.normalize('NFKC') : base;
    base = base.toLowerCase().replace(/[^0-9a-z가-힣]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    var n = String(index + 1);
    while (n.length < 2) n = '0' + n;
    return n + (base ? '-' + base : '') + '.' + ext;
  }

  /**
   * 시트 행 → 앨범 목록. 사진은 아직 채우지 않는다 (드라이브를 읽는 쪽에서 채운다).
   * @returns {{albums: Array, warnings: string[]}}
   */
  function convertRows(headers, rows, opts) {
    opts = opts || {};
    var today = opts.today instanceof Date ? opts.today : new Date();
    var idx = lib.headerIndex(headers);
    var missing = REQUIRED_HEADERS.filter(function (h) { return idx[lib.normalizeHeader(h)] == null; });
    if (missing.length) throw new Error('갤러리 탭에 필수 헤더가 없습니다: ' + missing.join(', '));

    var albums = [];
    var warnings = [];
    var usedIds = {};

    (rows || []).forEach(function (row, i) {
      var rowNo = i + 2;
      var get = function (name) { return lib.cell(row, idx, name); };
      if (!lib.isTruthy(get(COLUMNS.publish))) return;

      var title = lib.text(get(COLUMNS.title));
      if (!title) { warnings.push(rowNo + '행: 행사명이 없어 건너뜁니다'); return; }

      var parsed = lib.parseDate(get(COLUMNS.date));
      var year, date;
      if (parsed) { year = parsed.year; date = parsed.iso; }
      else {
        year = today.getFullYear(); date = '';
        warnings.push(rowNo + '행 "' + title.slice(0, 20) + '": 날짜가 없어 ' + year + '년으로 넣습니다');
      }

      var folderId = folderIdFrom(get(COLUMNS.folder));
      if (!folderId) {
        warnings.push(rowNo + '행 "' + title.slice(0, 20) + '": 드라이브 폴더 링크를 알아볼 수 없어 건너뜁니다');
        return;
      }

      var id = lib.str(get(COLUMNS.id)) || makeAlbumId(date || String(year), title);
      var base = id, n = 1;
      while (usedIds[id]) id = base + '-' + (++n);
      usedIds[id] = true;

      albums.push({
        rowNo: rowNo,
        id: id,
        title: title,
        date: date,
        year: year,
        place: lib.text(get(COLUMNS.place)),
        description: lib.text(get(COLUMNS.description)),
        folderId: folderId,
        photos: []
      });
    });

    return { albums: albums, warnings: warnings };
  }

  // photos 항목은 "경로" 또는 {src, caption} 둘 다 될 수 있다
  function srcOf(photo) {
    return photo && typeof photo === 'object' ? lib.str(photo.src) : lib.str(photo);
  }

  // 앨범 → data/gallery.json 이 기대하는 레코드 (사진이 채워진 뒤 호출한다)
  function toRecord(album) {
    return {
      id: album.id,
      title: album.title,
      date: album.date,
      year: album.year,
      category: album.category || 'lab',
      place: album.place,
      description: album.description,
      cover: album.photos.length ? srcOf(album.photos[0]) : '',
      photos: album.photos.slice()
    };
  }

  function buildDocument(albums, meta) {
    meta = meta || {};
    var records = albums.map(toRecord).sort(function (a, b) {
      if (b.year !== a.year) return b.year - a.year;
      if (a.date === b.date) return 0;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date < b.date ? 1 : -1;
    });
    return {
      schemaVersion: 1,
      generatedAt: meta.generatedAt || '',
      source: meta.source || '갤러리',
      count: records.length,
      albums: records
    };
  }

  function serialize(doc) {
    return JSON.stringify(doc, null, 2) + '\n';
  }

  function sameAlbums(a, b) {
    if (!a || !b || !a.albums || !b.albums) return false;
    if (a.schemaVersion !== b.schemaVersion) return false;
    return JSON.stringify(a.albums) === JSON.stringify(b.albums);
  }

  return {
    COLUMNS: COLUMNS,
    HEADERS: HEADERS,
    REQUIRED_HEADERS: REQUIRED_HEADERS,
    AUTO_HEADERS: AUTO_HEADERS,
    folderIdFrom: folderIdFrom,
    srcOf: srcOf,
    makeAlbumId: makeAlbumId,
    safeFileName: safeFileName,
    convertRows: convertRows,
    toRecord: toRecord,
    buildDocument: buildDocument,
    serialize: serialize,
    sameAlbums: sameAlbums
  };
})(typeof PubLib !== 'undefined' ? PubLib : require('./lib.js'));

if (typeof module !== 'undefined' && module.exports) module.exports = GalLib;

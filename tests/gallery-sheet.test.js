const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../apps-script/gallery.js');

const H = ['게시', '행사명', '날짜', '장소', '설명', '드라이브 폴더 링크', 'ID (자동)', '사진 수 (자동)', '마지막 갱신 (자동)'];
const COL = { publish: 0, title: 1, date: 2, place: 3, description: 4, folder: 5, id: 6 };
const FOLDER = 'https://drive.google.com/drive/folders/1AbC_defGHIjklMnop?usp=sharing';
function row(o) {
  const r = new Array(H.length).fill('');
  for (const k of Object.keys(o)) r[COL[k]] = o[k];
  return r;
}
const TODAY = new Date(2026, 8, 9);
const conv = (rows) => G.convertRows(H, rows, { today: TODAY });
const base = { publish: true, title: 'ISET 2026', date: '2026-05-13', place: '제주',
  description: '학술대회 발표', folder: FOLDER };

test('folderIdFrom accepts share links, open links and a bare id', () => {
  assert.equal(G.folderIdFrom(FOLDER), '1AbC_defGHIjklMnop');
  assert.equal(G.folderIdFrom('https://drive.google.com/drive/folders/1AbC_defGHIjklMnop'), '1AbC_defGHIjklMnop');
  assert.equal(G.folderIdFrom('https://drive.google.com/open?id=1AbC_defGHIjklMnop'), '1AbC_defGHIjklMnop');
  assert.equal(G.folderIdFrom('1AbC_defGHIjklMnop'), '1AbC_defGHIjklMnop');
  assert.equal(G.folderIdFrom('https://example.com/nope'), '');
  assert.equal(G.folderIdFrom(''), '');
});

test('makeAlbumId is year-month plus a title slug', () => {
  assert.equal(G.makeAlbumId('2026-05-13', 'IEMEK Symposium (ISET) 2026'), '2026-05-iemek-symposium-iset-2026');
  assert.equal(G.makeAlbumId('2026-05-13', '연구실 워크숍'), '2026-05-연구실-워크숍');
  assert.equal(G.makeAlbumId('', '제목만'), '제목만');
  assert.ok(G.makeAlbumId('2026-05-13', 'x'.repeat(200)).length <= 48);
});

test('safeFileName numbers files and keeps them URL-safe', () => {
  assert.equal(G.safeFileName('IMG_2026 사진.JPG', 0), '01-img-2026-사진.jpg');
  assert.equal(G.safeFileName('photo.jpeg', 9), '10-photo.jpeg');
  assert.equal(G.safeFileName('no-extension', 0), '01-no-extension.jpg');
  assert.doesNotMatch(G.safeFileName('a b/c?d.png', 0), /[ /?]/);
});

test('safeFileName can force an extension, because the Drive copy is always JPEG', () => {
  assert.equal(G.safeFileName('shot.png', 0, 'jpg'), '01-shot.jpg');
  assert.equal(G.safeFileName('shot.HEIC', 2, 'jpg'), '03-shot.jpg');
  assert.equal(G.safeFileName('shot.png', 0, ''), '01-shot.png');
});

test('convertRows only takes published rows with a title and a usable folder link', () => {
  assert.equal(conv([row(base)]).albums.length, 1);
  assert.equal(conv([row({ ...base, publish: false })]).albums.length, 0);

  const noTitle = conv([row({ ...base, title: '' })]);
  assert.equal(noTitle.albums.length, 0);
  assert.match(noTitle.warnings[0], /행사명이 없어/);

  const noFolder = conv([row({ ...base, folder: 'https://example.com/x' })]);
  assert.equal(noFolder.albums.length, 0);
  assert.match(noFolder.warnings[0], /폴더 링크를 알아볼 수 없어/);
});

test('convertRows fills the album fields and generates an id', () => {
  const [a] = conv([row(base)]).albums;
  assert.equal(a.rowNo, 2);
  assert.equal(a.id, '2026-05-iset-2026');
  assert.equal(a.title, 'ISET 2026');
  assert.equal(a.date, '2026-05-13');
  assert.equal(a.year, 2026);
  assert.equal(a.place, '제주');
  assert.equal(a.folderId, '1AbC_defGHIjklMnop');
  assert.deepEqual(a.photos, []);
});

test('an id already written into the sheet wins, so renaming an event keeps its folder', () => {
  const [a] = conv([row({ ...base, title: '이름을 바꾼 행사', id: '2026-05-iset-2026' })]).albums;
  assert.equal(a.id, '2026-05-iset-2026');
  assert.equal(a.title, '이름을 바꾼 행사');
});

test('duplicate ids get a suffix', () => {
  const ids = conv([row(base), row(base)]).albums.map((a) => a.id);
  assert.deepEqual(ids, ['2026-05-iset-2026', '2026-05-iset-2026-2']);
});

test('a missing date warns and falls back to this year', () => {
  const r = conv([row({ ...base, date: '' })]);
  assert.equal(r.albums[0].year, 2026);
  assert.equal(r.albums[0].date, '');
  assert.match(r.warnings[0], /날짜가 없어/);
});

test('a missing required header is an error, not a silent empty result', () => {
  assert.throws(() => G.convertRows(H.filter((h) => h !== '드라이브 폴더 링크'), [], { today: TODAY }),
    /필수 헤더가 없습니다: 드라이브 폴더 링크/);
});

test('buildDocument writes the gallery.json shape, newest first, cover = first photo', () => {
  const albums = [
    { id: 'a', title: 'A', date: '2025-01-01', year: 2025, place: '', description: '', photos: ['p/a1.jpg'] },
    { id: 'b', title: 'B', date: '2026-06-01', year: 2026, place: '부산', description: '설명', photos: ['p/b1.jpg', 'p/b2.jpg'] },
  ];
  const doc = G.buildDocument(albums, { generatedAt: '2026-09-09T00:00:00.000Z' });
  assert.deepEqual(Object.keys(doc), ['schemaVersion', 'generatedAt', 'source', 'count', 'albums']);
  assert.equal(doc.count, 2);
  assert.deepEqual(doc.albums.map((a) => a.id), ['b', 'a']);
  assert.equal(doc.albums[0].cover, 'p/b1.jpg');
  assert.deepEqual(Object.keys(doc.albums[0]),
    ['id', 'title', 'date', 'year', 'category', 'place', 'description', 'cover', 'photos']);
});

test('the produced document is what js/gallery.js renders', () => {
  const R = require('../js/gallery.js');
  const doc = G.buildDocument([
    { id: '2026-05-iset', title: 'ISET 2026', date: '2026-05-13', year: 2026, place: '제주',
      description: '발표', photos: ['assets/images/gallery/2026-05-iset/01.jpg', 'assets/images/gallery/2026-05-iset/02.jpg'] },
  ], {});
  const html = R.buildGalleryHtml(doc);
  assert.match(html, /id="album-2026-05-iset"/);
  assert.match(html, /<h3 class="pnu-gallery-title">ISET 2026<\/h3>/);
  assert.match(html, /<span class="pnu-gallery-count">2 photos<\/span>/);
});

test('sameAlbums ignores generatedAt but not the album list or the schema', () => {
  const albums = [{ id: 'a', title: 'A', date: '2026-01-01', year: 2026, place: '', description: '', photos: ['x.jpg'] }];
  const one = G.buildDocument(albums, { generatedAt: 'first' });
  const two = G.buildDocument(albums, { generatedAt: 'second' });
  assert.equal(G.sameAlbums(one, two), true);
  assert.equal(G.sameAlbums(one, G.buildDocument([], {})), false);
  const older = JSON.parse(JSON.stringify(two)); older.schemaVersion = 0;
  assert.equal(G.sameAlbums(one, older), false);
  assert.equal(G.sameAlbums(one, null), false);
});

test('serialize round-trips and ends with a newline', () => {
  const doc = G.buildDocument([], {});
  const text = G.serialize(doc);
  assert.ok(text.endsWith('}\n'));
  assert.deepEqual(JSON.parse(text), doc);
});

test('photos may carry a caption; cover stays a plain path', () => {
  const doc = G.buildDocument([{
    id: 'a', title: 'A', date: '2026-01-01', year: 2026, place: '', description: '',
    photos: [{ src: 'p/1.jpg', caption: '개회식' }, { src: 'p/2.jpg', caption: '' }],
  }], {});
  assert.equal(doc.albums[0].cover, 'p/1.jpg');
  assert.deepEqual(doc.albums[0].photos, [{ src: 'p/1.jpg', caption: '개회식' }, { src: 'p/2.jpg', caption: '' }]);
  assert.equal(G.srcOf({ src: 'p/1.jpg', caption: 'x' }), 'p/1.jpg');
  assert.equal(G.srcOf('p/1.jpg'), 'p/1.jpg');
});

test('a captioned album renders and the caption reaches the viewer data', () => {
  const R = require('../js/gallery.js');
  const doc = G.buildDocument([{
    id: 'a', title: 'A', date: '2026-01-01', year: 2026, place: '', description: '',
    photos: [{ src: 'p/1.jpg', caption: '개회식' }, { src: 'p/2.jpg', caption: '단체 사진' }],
  }], {});
  assert.match(R.buildGalleryHtml(doc), /<img src="p\/1\.jpg"/);
  assert.deepEqual(R.photosOf(doc.albums[0]).map((p) => p.caption), ['개회식', '단체 사진']);
});

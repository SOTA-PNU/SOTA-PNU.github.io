// 카드 사진 주소 회귀 테스트.
// 실제로 있었던 일: 첫 실제 앨범(폴더 "2026-08-sor-워크샵")에서 카드 사진 10장이 전부 깨졌고,
// 같은 사진이 상세 창에서는 정상으로 보였다. buildGalleryHtml 이 정리(normalize)한 앨범을 cardHtml 이
// 한 번 더 정리하면서 한글 경로가 두 번 인코딩됐다 (%EC → %25EC). 영문 경로는 두 번 인코딩해도 같아서
// 이전 시드 앨범에서는 드러나지 않았다.
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/gallery.js');

const HANGUL_ALBUM = {
  id: '2026-08-sor-워크샵',
  title: 'SOR 워크샵',
  date: '2026-08-30',
  year: 2026,
  category: 'lab',
  place: '부산대학교',
  description: '워크샵',
  cover: 'assets/images/gallery/2026-08-sor-워크샵/01-01-dsc02223.jpg',
  photos: [
    { src: 'assets/images/gallery/2026-08-sor-워크샵/01-01-dsc02223.jpg', caption: '' },
    { src: 'assets/images/gallery/2026-08-sor-워크샵/02-dsc01849.jpg', caption: '' },
    { src: 'assets/images/gallery/2026-08-sor-워크샵/03-dsc01858.jpg', caption: '' },
  ],
};

const imgSrcs = (html) => [...html.matchAll(/<img src="([^"]+)"/g)].map((m) => m[1]);

test('card photos in the page use exactly the URLs the detail dialog uses', () => {
  const html = G.buildGalleryHtml({ albums: [HANGUL_ALBUM] });
  const card = imgSrcs(html);
  const dialog = G.normalize(HANGUL_ALBUM).photos.map((p) => p.src);
  assert.deepEqual(card, dialog, 'cover and thumbnails must match the dialog URLs one for one');
});

test('Hangul in a photo path is percent-encoded exactly once', () => {
  const html = G.buildGalleryHtml({ albums: [HANGUL_ALBUM] });
  for (const src of imgSrcs(html)) {
    assert.doesNotMatch(src, /%25/, `double-encoded: ${src}`);
    assert.match(src, /%EC%9B%8C%ED%81%AC%EC%83%B5/, `워크샵 should be encoded once: ${src}`);
    assert.equal(decodeURI(src).includes('워크샵'), true);
  }
});

test('cardHtml gives the same markup for a raw album and for one already normalized', () => {
  assert.equal(G.cardHtml(G.normalize(HANGUL_ALBUM)), G.cardHtml(HANGUL_ALBUM));
});

test('the cover survives when the card is built from a normalized album', () => {
  // normalize 결과에는 cover 필드가 따로 없고 photos[0] 이 표지다. 표지를 잃으면 안 된다.
  const html = G.cardHtml(G.normalize({ ...HANGUL_ALBUM, photos: HANGUL_ALBUM.photos.slice(1) }));
  assert.match(html, /<button class="pnu-gallery-cover"[^>]*><img src="[^"]*01-01-dsc02223\.jpg"/);
});

// Apps Script 는 브라우저 밖에서 실행할 수 없으므로, 붙여넣기 전에 정적으로 잡을 수 있는 것들을 확인한다.
// 메뉴가 없는 함수를 가리키거나, 라이브러리에 없는 이름을 쓰는 실수가 여기서 걸린다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8');
const PubLib = require('../apps-script/lib.js');
const GalLib = require('../apps-script/gallery.js');

const definedFunctions = new Set([...code.matchAll(/^function\s+([A-Za-z0-9_]+)\s*\(/gm)].map((m) => m[1]));

test('every menu item points at a function that exists', () => {
  const targets = [...code.matchAll(/\.addItem\('[^']*',\s*'([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(targets.length >= 7, `expected the full menu, found ${targets.length} items`);
  for (const fn of targets) {
    assert.ok(definedFunctions.has(fn), `menu points at ${fn}(), which Code.gs does not define`);
  }
});

test('the menu offers both syncs, both previews, both setups and the token', () => {
  for (const fn of ['syncPublicationsToGitHub', 'previewPublications', 'syncGalleryToGitHub',
    'previewGallery', 'setupWebsiteColumns', 'setupGalleryTab', 'configureGitHubToken']) {
    assert.match(code, new RegExp(`addItem\\('[^']*',\\s*'${fn}'\\)`), `${fn} is not in the menu`);
  }
});

test('Code.gs only uses names the two libraries actually export', () => {
  for (const [lib, exports, file] of [['PubLib', PubLib, 'lib.js'], ['GalLib', GalLib, 'gallery.js']]) {
    const used = new Set([...code.matchAll(new RegExp(`${lib}\\.([A-Za-z0-9_]+)`, 'g'))].map((m) => m[1]));
    for (const name of used) {
      assert.ok(name in exports, `Code.gs uses ${lib}.${name}, which apps-script/${file} does not export`);
    }
  }
});

test('every internal helper Code.gs calls is defined in Code.gs', () => {
  // 이름 끝에 _ 가 붙은 함수는 Apps Script 관례상 내부 전용이다
  const called = new Set([...code.matchAll(/(?<![.\w])([A-Za-z][A-Za-z0-9_]*_)\s*\(/g)].map((m) => m[1]));
  for (const fn of called) {
    assert.ok(definedFunctions.has(fn), `Code.gs calls ${fn}(), which it does not define`);
  }
});

test('the gallery sync commits photos and the json in one commit', () => {
  assert.match(code, /githubCommitFiles_/, 'gallery sync must use the Git Data API helper');
  assert.match(code, /\/git\/blobs/);
  assert.match(code, /\/git\/trees/);
  assert.match(code, /\/git\/commits/);
  assert.match(code, /\/git\/refs\/heads\//);
  // 사진마다 커밋을 만드는 실수를 막는다
  assert.doesNotMatch(code, /images\.forEach[\s\S]{0,400}githubPutFile_/);
});

test('the gallery sync stops before the Apps Script time limit', () => {
  assert.match(code, /budgetMs/, 'there must be a time budget');
  assert.match(code, /stopped = true/, 'it must stop rather than run past the limit');
  assert.match(code, /한 번 더 실행/, 'and tell the user to run it again');
});

test('a failed resize falls back to the original and says so, with no size limit', () => {
  assert.match(code, /driveResizedBlob_/);
  assert.match(code, /축소본을 받지 못해 원본을 올립니다/, 'the fallback must warn');
  assert.doesNotMatch(code, /fallbackMaxBytes/, 'the size limit was removed on purpose');
  assert.doesNotMatch(code, /직접 줄여서 올려 주세요/, 'photos are never skipped for being large');
});

test('the Drive helper degrades instead of throwing when the thumbnail is unavailable', () => {
  const fn = code.slice(code.indexOf('function driveResizedBlob_'), code.indexOf('// ------', code.indexOf('function driveResizedBlob_')));
  assert.match(fn, /catch \(e\) \{\s*return null;/, 'a failed thumbnail must return null, not throw');
  assert.match(fn, /muteHttpExceptions: true/);
});

test('the token is never written into a commit message or the log', () => {
  const messages = [...code.matchAll(/message:\s*([^,\n]+)/g)].map((m) => m[1]).join(' ');
  assert.doesNotMatch(messages, /token/i);
  assert.doesNotMatch(code, /log_\([^)]*token/i);
});

test('gallery paths stay under assets/images/gallery and data/gallery.json', () => {
  assert.match(code, /dir:\s*'assets\/images\/gallery'/);
  assert.match(code, /path:\s*'data\/gallery\.json'/);
});

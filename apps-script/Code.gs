/*
 * apps-script/Code.gs — Google 시트 → GitHub(data/publications.json) 업로드
 *
 * 설치: 이 파일 + lib.js(→ lib.gs) + seed.js(→ seed.gs) 를 시트의 Apps Script 프로젝트에 붙여넣는다.
 * 자세한 절차는 apps-script/README.md.
 *
 * 이미 프로젝트에 onOpen() 이 있으면 아래 onOpen 을 지우고 기존 onOpen 안에 addWebsiteMenu(); 한 줄을 추가한다.
 */
var CONFIG = {
  sheetName: '논문 등록',
  logSheetName: '홈페이지 갱신 로그',
  repo: 'SOTA-PNU/SOTA-PNU.github.io',
  branch: 'main',
  path: 'data/publications.json',
  siteUrl: 'https://sota.pusan.ac.kr/publications.html'
};
var TOKEN_KEY = 'GITHUB_TOKEN';

function onOpen() {
  addWebsiteMenu();
}

function addWebsiteMenu() {
  SpreadsheetApp.getUi().createMenu('🌐 홈페이지')
    .addItem('논문 목록 갱신 → GitHub 업로드', 'syncPublicationsToGitHub')
    .addItem('논문 미리보기 (검증만, 업로드 없음)', 'previewPublications')
    .addSeparator()
    .addItem('갤러리 갱신 → GitHub 업로드', 'syncGalleryToGitHub')
    .addItem('갤러리 미리보기 (업로드 없음)', 'previewGallery')
    .addSeparator()
    .addItem('초기 설정 (논문 열 추가)', 'setupWebsiteColumns')
    .addItem('갤러리 탭 만들기', 'setupGalleryTab')
    .addItem('GitHub 토큰 설정', 'configureGitHubToken')
    .addToUi();
}

// ---------------------------------------------------------------- 시트 읽기

function readPublicationRows_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetName);
  if (!sh) throw new Error('"' + CONFIG.sheetName + '" 탭을 찾을 수 없습니다.');
  var values = sh.getDataRange().getValues();
  if (values.length < 2) throw new Error('"' + CONFIG.sheetName + '" 탭에 데이터가 없습니다.');
  return { headers: values[0], rows: values.slice(1) };
}

function buildPublications_() {
  var data = readPublicationRows_();
  // 날짜 셀은 스크립트 시간대로 해석된다. Apps Script 프로젝트 설정(appsscript.json)의
  // timeZone 이 시트 시간대(Asia/Seoul)와 다르면 날짜가 하루 밀릴 수 있다 — README 5장 참고.
  var result = PubLib.convertRows(data.headers, data.rows, { today: new Date() });
  var doc = PubLib.buildDocument(result, { generatedAt: new Date().toISOString(), source: CONFIG.sheetName });
  return { doc: doc, warnings: result.warnings };
}

function summarize_(doc, warnings) {
  var byYear = {};
  doc.publications.forEach(function (p) { byYear[p.year] = (byYear[p.year] || 0) + 1; });
  var years = Object.keys(byYear).sort(function (a, b) { return b - a; })
    .map(function (y) { return y + '년 ' + byYear[y] + '건'; }).join(', ');
  var s = '게시 대상: ' + doc.count + '건\n' + years + '\n';
  if (warnings.length) {
    s += '\n⚠ 경고 ' + warnings.length + '건\n' + warnings.slice(0, 15).join('\n') + (warnings.length > 15 ? '\n…' : '');
  } else {
    s += '\n경고 없음';
  }
  return s;
}

// ---------------------------------------------------------------- 메뉴 동작

// pubLib.gs / pubSeed.gs 를 붙여넣지 않았거나 저장하지 않으면 여기서 걸린다.
// (메뉴는 PubLib 없이도 만들어지므로 메뉴가 보인다고 설치가 끝난 것은 아니다)
function requirePubLib_(ui) {
  if (typeof PubLib !== 'undefined' && PubLib && PubLib.WEBSITE_HEADERS) return true;
  ui.alert('설치가 덜 되었습니다',
    'pubLib.gs 파일을 찾을 수 없습니다.\n\n' +
    'Apps Script 편집기에서 새 스크립트 파일 pubLib.gs 를 만들고 저장소의 apps-script/lib.js 내용을 ' +
    '전부 붙여넣은 뒤 저장(💾)하고 다시 실행하세요.\n' +
    '이미 있다면 파일 맨 위가 "var PubLib = (function () {" 로 시작하는지 확인하세요.',
    ui.ButtonSet.OK);
  return false;
}

function previewPublications() {
  var ui = SpreadsheetApp.getUi();
  if (!requirePubLib_(ui)) return;
  try {
    var b = buildPublications_();
    ui.alert('미리보기', summarize_(b.doc, b.warnings), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('오류', String(e.message || e), ui.ButtonSet.OK);
  }
}

function syncPublicationsToGitHub() {
  var ui = SpreadsheetApp.getUi();
  if (!requirePubLib_(ui)) return;
  var user = getUserEmail_();
  var started = new Date();
  try {
    var token = getToken_();
    if (!token) {
      ui.alert('GitHub 토큰이 없습니다', '메뉴 🌐 홈페이지 ▸ "GitHub 토큰 설정" 을 먼저 실행하세요.', ui.ButtonSet.OK);
      return;
    }
    var b = buildPublications_();
    if (b.warnings.length) {
      var answer = ui.alert('경고 ' + b.warnings.length + '건', summarize_(b.doc, b.warnings) + '\n\n계속 업로드할까요?', ui.ButtonSet.YES_NO);
      if (answer !== ui.Button.YES) { log_(started, user, b.doc.count, '취소 (경고 확인)', b.warnings); return; }
    }
    var remote = githubGetFile_(token);
    if (remote && remote.doc && PubLib.samePublications(remote.doc, b.doc)) {
      SpreadsheetApp.getActiveSpreadsheet().toast('홈페이지 데이터가 이미 최신입니다 (변경 없음).', '🌐 홈페이지', 8);
      log_(started, user, b.doc.count, '변경 없음', b.warnings);
      return;
    }
    // 커밋 메시지는 공개 저장소에 남으므로 실행자 이메일을 넣지 않는다 (기록은 아래 로그 탭에만).
    var message = 'chore(publications): sync ' + b.doc.count + ' papers from sheet';
    var commit = githubPutFile_(token, PubLib.serialize(b.doc), message, remote ? remote.sha : null);
    log_(started, user, b.doc.count, commit.html_url, b.warnings);
    ui.alert('완료', '업로드했습니다. 1~2분 후 홈페이지에 반영됩니다.\n\n' + CONFIG.siteUrl + '\n커밋: ' + commit.html_url, ui.ButtonSet.OK);
  } catch (e) {
    log_(started, user, '', '실패: ' + String(e.message || e), []);
    ui.alert('업로드 실패', String(e.message || e), ui.ButtonSet.OK);
  }
}

function configureGitHubToken() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('GitHub 토큰 설정',
    'GitHub fine-grained Personal Access Token 을 붙여넣으세요.\n' +
    '(저장소: ' + CONFIG.repo + ' / 권한: Contents — Read and write)\n' +
    '토큰은 이 스크립트의 속성 저장소에만 보관되며 시트에는 기록되지 않습니다.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  var token = r.getResponseText().trim();
  if (!token) { ui.alert('토큰이 비어 있습니다.'); return; }
  var check = githubApi_(token, 'get', '/repos/' + CONFIG.repo);
  if (check.status !== 200) { ui.alert('토큰 확인 실패', explainStatus_(check), ui.ButtonSet.OK); return; }
  var perms = JSON.parse(check.body).permissions || {};
  if (perms.push === false) {
    ui.alert('토큰 확인 실패', '이 토큰(계정)으로는 저장소에 쓸 수 없습니다. 저장소 쓰기 권한이 있는 계정으로 Contents: Read and write 토큰을 발급하세요.', ui.ButtonSet.OK);
    return;
  }
  PropertiesService.getScriptProperties().setProperty(TOKEN_KEY, token);
  // 공개 저장소는 권한 없는 토큰으로도 조회가 되므로, 위 확인은 "쓸 수 있다"는 뜻이 아니다.
  ui.alert('저장 완료',
    '토큰을 저장했습니다.\n\n' +
    '다만 ' + CONFIG.repo + ' 는 공개 저장소라 조회만으로는 쓰기 권한을 확인할 수 없습니다.\n' +
    '실제 확인은 "논문 목록 갱신" 을 처음 실행할 때 이루어집니다.\n' +
    '거기서 403 이 나오면 조직 승인 대기이거나 Contents 권한이 Read 로 되어 있는 경우입니다.',
    ui.ButtonSet.OK);
}

function setupWebsiteColumns() {
  var ui = SpreadsheetApp.getUi();
  if (!requirePubLib_(ui)) return;
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetName);
  if (!sh) { ui.alert('"' + CONFIG.sheetName + '" 탭을 찾을 수 없습니다. 탭 이름을 확인하세요.'); return; }

  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var idx = PubLib.headerIndex(headers);

  // 시트의 실제 열 개수가 데이터 폭과 같으면 오른쪽에 쓸 칸이 없어 setValue 가 실패한다.
  // 부족한 만큼 먼저 열을 만들어 둔다.
  var missing = PubLib.WEBSITE_HEADERS.filter(function (name) {
    return idx[PubLib.normalizeHeader(name)] == null;
  });
  var maxCol = sh.getMaxColumns();
  if (missing.length && maxCol < lastCol + missing.length) {
    sh.insertColumnsAfter(maxCol, lastCol + missing.length - maxCol);
  }

  var added = [];
  PubLib.WEBSITE_HEADERS.forEach(function (name) {
    if (idx[PubLib.normalizeHeader(name)] != null) return;
    lastCol += 1;
    sh.getRange(1, lastCol).setValue(name).setFontWeight('bold').setBackground('#e8f0fe');
    idx[PubLib.normalizeHeader(name)] = lastCol - 1;
    added.push(name);
  });

  var n = Math.max(sh.getLastRow() - 1, 1);
  var C = PubLib.COLUMNS;
  if (added.indexOf(C.exclude) !== -1) {
    // insertCheckboxes 는 값을 false 로 초기화하므로 새로 만든 열에만 적용
    sh.getRange(2, idx[PubLib.normalizeHeader(C.exclude)] + 1, n, 1).insertCheckboxes();
  }
  var kindRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Conference', 'Journal', 'Workshop'], true).setAllowInvalid(true).build();
  sh.getRange(2, idx[PubLib.normalizeHeader(C.kind)] + 1, n, 1).setDataValidation(kindRule);

  var filled = seedKeywords_(sh, idx, n);
  ui.alert('초기 설정 완료',
    (added.length ? '추가된 열: ' + added.join(', ') : '홈페이지용 열이 이미 있어 추가하지 않았습니다.') +
    '\n키워드 자동 채움: ' + filled + '건 (빈 셀만)', ui.ButtonSet.OK);
}

function seedKeywords_(sh, idx, n) {
  if (typeof PUB_SEED === 'undefined') return 0;
  var C = PubLib.COLUMNS;
  var koCol = idx[PubLib.normalizeHeader(C.titleKo)];
  var enCol = idx[PubLib.normalizeHeader(C.titleEn)];
  var kwCol = idx[PubLib.normalizeHeader(C.keywords)];
  if (koCol == null || enCol == null || kwCol == null) return 0;
  var values = sh.getRange(2, 1, n, sh.getLastColumn()).getValues();
  var kwRange = sh.getRange(2, kwCol + 1, n, 1);
  var kws = kwRange.getValues();
  var filled = 0;
  for (var i = 0; i < n; i++) {
    if (PubLib.str(kws[i][0])) continue;
    var hit = PUB_SEED[PubLib.normalizeTitle(values[i][koCol])] || PUB_SEED[PubLib.normalizeTitle(values[i][enCol])];
    if (hit && hit.keywords) { kws[i][0] = hit.keywords; filled++; }
  }
  if (filled) kwRange.setValues(kws);
  return filled;
}

// ---------------------------------------------------------------- GitHub API

function githubApi_(token, method, path, payload) {
  var options = {
    method: method,
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  };
  if (payload) options.payload = JSON.stringify(payload);
  var res = UrlFetchApp.fetch('https://api.github.com' + path, options);
  return { status: res.getResponseCode(), body: res.getContentText() };
}

function contentsPath_() {
  return '/repos/' + CONFIG.repo + '/contents/' + CONFIG.path;
}

function githubGetFile_(token) {
  var r = githubApi_(token, 'get', contentsPath_() + '?ref=' + encodeURIComponent(CONFIG.branch));
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error(explainStatus_(r));
  var json = JSON.parse(r.body);
  var text = Utilities.newBlob(Utilities.base64Decode(String(json.content || '').replace(/\n/g, ''))).getDataAsString('UTF-8');
  var doc = null;
  try { doc = JSON.parse(text); } catch (e) { doc = null; }
  return { sha: json.sha, doc: doc };
}

function githubPutFile_(token, content, message, sha) {
  var payload = {
    message: message,
    content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
    branch: CONFIG.branch
  };
  if (sha) payload.sha = sha;
  var r = githubApi_(token, 'put', contentsPath_(), payload);
  if (r.status === 409 || r.status === 422) {
    // sha 불일치(다른 사람이 방금 커밋) → 최신 sha 로 1회 재시도
    var latest = githubGetFile_(token);
    if (latest) payload.sha = latest.sha; else delete payload.sha;
    r = githubApi_(token, 'put', contentsPath_(), payload);
  }
  if (r.status !== 200 && r.status !== 201) throw new Error(explainStatus_(r));
  return JSON.parse(r.body).commit;
}

function explainStatus_(r) {
  var hints = {
    401: '토큰이 만료되었거나 잘못되었습니다 → 메뉴 "GitHub 토큰 설정" 에서 다시 설정하세요.',
    403: '토큰이 이 저장소에 쓸 수 없습니다. 아래를 순서대로 확인하세요.\n' +
      '  1) 조직 승인 대기 — fine-grained 토큰은 조직 소유자가 승인해야 조직 저장소에 쓸 수 있습니다.\n' +
      '     https://github.com/settings/personal-access-tokens 에서 토큰 상태가 Pending 인지 확인하세요.\n' +
      '  2) Permissions 의 Contents 가 "Read and write" 인지 (Read 만이면 실패합니다)\n' +
      '  3) Repository access 에 ' + CONFIG.repo + ' 가 포함됐는지\n' +
      '  승인이 어려우면 classic 토큰(public_repo 스코프)으로 대체할 수 있습니다.',
    404: '저장소 또는 파일 경로를 찾을 수 없습니다 → 설정값(저장소 ' + CONFIG.repo + ', 브랜치 ' +
      CONFIG.branch + ', 경로 ' + CONFIG.path + ')과 토큰의 저장소 접근 범위를 확인하세요.'
  };
  var msg = '';
  try { msg = JSON.parse(r.body).message || ''; } catch (e) { msg = String(r.body || '').slice(0, 200); }
  return 'GitHub API ' + r.status + (hints[r.status] ? ' — ' + hints[r.status] : '') + (msg ? '\n(' + msg + ')' : '');
}

// ---------------------------------------------------------------- 기타

function getToken_() {
  return PropertiesService.getScriptProperties().getProperty(TOKEN_KEY) || '';
}

function getUserEmail_() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}

function log_(started, user, count, result, warnings) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(CONFIG.logSheetName);
    if (!sh) {
      sh = ss.insertSheet(CONFIG.logSheetName);
      sh.appendRow(['시각', '실행자', '게시 건수', '결과', '경고']);
      sh.getRange(1, 1, 1, 5).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
    sh.appendRow([started, user, count, result, (warnings || []).join('\n')]);
  } catch (e) {
    console.error('log_ failed: ' + e);
  }
}

// ================================================================ 갤러리
//
// 시트 '갤러리' 탭 + 구글 드라이브 폴더 → assets/images/gallery/<앨범>/ 와 data/gallery.json.
// 사진 몇 장이든 커밋은 한 번만 만든다 (Git Data API). 이미 올린 사진은 건너뛴다.

var GALLERY = {
  sheetName: '갤러리',
  path: 'data/gallery.json',
  dir: 'assets/images/gallery',
  siteUrl: 'https://sota.pusan.ac.kr/gallery.html',
  maxPx: 1600,                // 드라이브에서 받아올 축소본의 긴 변
  budgetMs: 4.5 * 60 * 1000   // Apps Script 6분 제한 전에 안전하게 멈출 시간
};

function requireGalLib_(ui) {
  if (!requirePubLib_(ui)) return false;
  if (typeof GalLib !== 'undefined' && GalLib && GalLib.HEADERS) return true;
  ui.alert('설치가 덜 되었습니다',
    'pubGallery.gs 파일을 찾을 수 없습니다.\n\n' +
    'Apps Script 편집기에서 새 스크립트 파일 pubGallery.gs 를 만들고 저장소의 apps-script/gallery.js 내용을 ' +
    '전부 붙여넣은 뒤 저장(💾)하고 다시 실행하세요.',
    ui.ButtonSet.OK);
  return false;
}

// ---------------------------------------------------------------- 시트

function setupGalleryTab() {
  var ui = SpreadsheetApp.getUi();
  if (!requireGalLib_(ui)) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(GALLERY.sheetName);
  var created = false;
  if (!sh) { sh = ss.insertSheet(GALLERY.sheetName); created = true; }

  var headers = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
  var idx = PubLib.headerIndex(headers);
  var lastCol = sh.getLastColumn();
  var added = [];
  GalLib.HEADERS.forEach(function (name) {
    if (idx[PubLib.normalizeHeader(name)] != null) return;
    lastCol += 1;
    if (sh.getMaxColumns() < lastCol) sh.insertColumnsAfter(sh.getMaxColumns(), lastCol - sh.getMaxColumns());
    sh.getRange(1, lastCol).setValue(name).setFontWeight('bold')
      .setBackground(GalLib.AUTO_HEADERS.indexOf(name) === -1 ? '#e8f0fe' : '#f1f3f4');
    idx[PubLib.normalizeHeader(name)] = lastCol - 1;
    added.push(name);
  });
  sh.setFrozenRows(1);

  var n = Math.max(sh.getMaxRows() - 1, 1);
  if (added.indexOf(GalLib.COLUMNS.publish) !== -1) {
    sh.getRange(2, idx[PubLib.normalizeHeader(GalLib.COLUMNS.publish)] + 1, n, 1).insertCheckboxes();
  }

  ui.alert('갤러리 탭 준비 완료',
    (created ? '"' + GALLERY.sheetName + '" 탭을 만들었습니다.\n' : '') +
    (added.length ? '추가된 열: ' + added.join(', ') : '열이 이미 있어 추가하지 않았습니다.') +
    '\n\n다음 순서로 쓰시면 됩니다.\n' +
    '1) 구글 드라이브에 행사별 폴더를 만들고 사진을 넣습니다\n' +
    '2) 이 탭에 행사명 · 날짜 · 장소 · 설명을 적고, 그 폴더 링크를 "' + GalLib.COLUMNS.folder + '" 에 붙여넣습니다\n' +
    '3) "게시" 를 체크하고 메뉴에서 갤러리 갱신을 누릅니다\n\n' +
    'ID · 사진 수 · 마지막 갱신 열은 스크립트가 채우니 비워 두세요.',
    ui.ButtonSet.OK);
}

function readGalleryRows_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GALLERY.sheetName);
  if (!sh) throw new Error('"' + GALLERY.sheetName + '" 탭이 없습니다. 메뉴에서 "갤러리 탭 만들기" 를 먼저 실행하세요.');
  var values = sh.getDataRange().getValues();
  if (values.length < 2) throw new Error('"' + GALLERY.sheetName + '" 탭에 행이 없습니다.');
  return { sheet: sh, headers: values[0], rows: values.slice(1) };
}

// ---------------------------------------------------------------- 드라이브

function listDriveImages_(folderId) {
  var folder;
  try { folder = DriveApp.getFolderById(folderId); }
  catch (e) { throw new Error('드라이브 폴더를 열 수 없습니다 (' + folderId + '). 링크와 공유 권한을 확인하세요.'); }
  var it = folder.getFiles();
  var out = [];
  while (it.hasNext()) {
    var f = it.next();
    if (String(f.getMimeType()).indexOf('image/') !== 0) continue;
    out.push({ id: f.getId(), name: f.getName(), size: f.getSize(), file: f });
  }
  out.sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });
  return out;
}

// 드라이브가 만들어 둔 축소본(JPEG, 위치정보 없음)을 받는다.
// 공식 문서로 보장된 주소 형식이 아니므로 실패하면 null 을 돌려주고 호출한 쪽이 원본으로 처리한다.
function driveResizedBlob_(fileId, maxPx) {
  try {
    var headers = { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
    var meta = UrlFetchApp.fetch(
      'https://www.googleapis.com/drive/v3/files/' + fileId + '?fields=thumbnailLink&supportsAllDrives=true',
      { method: 'get', muteHttpExceptions: true, headers: headers });
    if (meta.getResponseCode() !== 200) return null;
    var link = JSON.parse(meta.getContentText()).thumbnailLink;
    if (!link) return null;
    var big = link.replace(/=s\d+(-c)?$/, '=s' + maxPx);
    var res = UrlFetchApp.fetch(big, { method: 'get', muteHttpExceptions: true, headers: headers });
    if (res.getResponseCode() !== 200) return null;
    var blob = res.getBlob();
    return blob.getBytes().length ? blob : null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------- GitHub (여러 파일을 한 커밋으로)

function githubGetJson_(token, path) {
  var r = githubApi_(token, 'get', '/repos/' + CONFIG.repo + '/contents/' + path +
    '?ref=' + encodeURIComponent(CONFIG.branch));
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error(explainStatus_(r));
  var json = JSON.parse(r.body);
  var text = Utilities.newBlob(Utilities.base64Decode(String(json.content || '').replace(/\n/g, '')))
    .getDataAsString('UTF-8');
  try { return JSON.parse(text); } catch (e) { return null; }
}

// 폴더 안 파일 이름 목록. 폴더가 없으면 빈 객체.
function githubListDir_(token, dir) {
  var r = githubApi_(token, 'get', '/repos/' + CONFIG.repo + '/contents/' + dir +
    '?ref=' + encodeURIComponent(CONFIG.branch));
  if (r.status === 404) return {};
  if (r.status !== 200) throw new Error(explainStatus_(r));
  var map = {};
  var body = JSON.parse(r.body);
  if (!body.length) return map;
  body.forEach(function (e) { if (e.type === 'file') map[e.name] = true; });
  return map;
}

/**
 * 여러 파일을 하나의 커밋으로 올린다.
 * @param {Array<{path:string, blob?:Blob, content?:string}>} files
 */
function githubCommitFiles_(token, files, message) {
  var repo = '/repos/' + CONFIG.repo;
  var branch = encodeURIComponent(CONFIG.branch);

  var refRes = githubApi_(token, 'get', repo + '/git/ref/heads/' + branch);
  if (refRes.status !== 200) throw new Error(explainStatus_(refRes));
  var headSha = JSON.parse(refRes.body).object.sha;

  var headRes = githubApi_(token, 'get', repo + '/git/commits/' + headSha);
  if (headRes.status !== 200) throw new Error(explainStatus_(headRes));
  var baseTree = JSON.parse(headRes.body).tree.sha;

  var tree = files.map(function (f) {
    var b64 = f.blob
      ? Utilities.base64Encode(f.blob.getBytes())
      : Utilities.base64Encode(f.content, Utilities.Charset.UTF_8);
    var blobRes = githubApi_(token, 'post', repo + '/git/blobs', { content: b64, encoding: 'base64' });
    if (blobRes.status !== 201) throw new Error(explainStatus_(blobRes));
    return { path: f.path, mode: '100644', type: 'blob', sha: JSON.parse(blobRes.body).sha };
  });

  var treeRes = githubApi_(token, 'post', repo + '/git/trees', { base_tree: baseTree, tree: tree });
  if (treeRes.status !== 201) throw new Error(explainStatus_(treeRes));

  var commitRes = githubApi_(token, 'post', repo + '/git/commits', {
    message: message,
    tree: JSON.parse(treeRes.body).sha,
    parents: [headSha]
  });
  if (commitRes.status !== 201) throw new Error(explainStatus_(commitRes));
  var newSha = JSON.parse(commitRes.body).sha;

  var updRes = githubApi_(token, 'patch', repo + '/git/refs/heads/' + branch, { sha: newSha });
  if (updRes.status !== 200) throw new Error(explainStatus_(updRes));

  return { sha: newSha, html_url: 'https://github.com/' + CONFIG.repo + '/commit/' + newSha };
}

// ---------------------------------------------------------------- 갱신

/**
 * 시트와 드라이브를 읽어 올릴 파일 목록과 gallery.json 을 만든다.
 * @param {string} token GitHub 토큰. 없으면 저장소 조회를 건너뛰고 미리보기용으로만 계산한다.
 */
function buildGallery_(token) {
  var data = readGalleryRows_();
  var built = GalLib.convertRows(data.headers, data.rows, { today: new Date() });
  var warnings = built.warnings;
  var files = [];
  var deadline = new Date().getTime() + GALLERY.budgetMs;
  var stopped = false;
  var totalFound = 0;

  built.albums.forEach(function (album) {
    var dir = GALLERY.dir + '/' + album.id;
    var existing = token ? githubListDir_(token, dir) : {};
    var images = listDriveImages_(album.folderId);
    totalFound += images.length;
    if (!images.length) {
      warnings.push(album.rowNo + '행 "' + album.title.slice(0, 20) + '": 드라이브 폴더에 사진이 없습니다');
    }

    images.forEach(function (img, i) {
      var jpgName = GalLib.safeFileName(img.name, i, 'jpg');
      var rawName = GalLib.safeFileName(img.name, i);
      if (existing[jpgName]) { album.photos.push(dir + '/' + jpgName); return; }
      if (existing[rawName]) { album.photos.push(dir + '/' + rawName); return; }
      if (!token) { album.photos.push(dir + '/' + jpgName); return; }   // 미리보기
      if (stopped || new Date().getTime() > deadline) { stopped = true; return; }

      var blob = driveResizedBlob_(img.id, GALLERY.maxPx);
      if (blob) {
        files.push({ path: dir + '/' + jpgName, blob: blob });
        album.photos.push(dir + '/' + jpgName);
        return;
      }
      // 축소본을 못 받으면 원본을 그대로 올린다. 크기 제한은 두지 않되 경고로 알린다.
      warnings.push(album.title.slice(0, 15) + ' / ' + img.name + ': 축소본을 받지 못해 원본을 올립니다' +
        (img.size ? ' (' + Math.round(img.size / 1024 / 1024 * 10) / 10 + 'MB)' : ''));
      files.push({ path: dir + '/' + rawName, blob: img.file.getBlob() });
      album.photos.push(dir + '/' + rawName);
    });
  });

  if (stopped) {
    warnings.push('시간 제한 때문에 이번에는 여기까지만 올립니다. 완료 후 한 번 더 실행하면 이어서 올라갑니다.');
  }

  var doc = GalLib.buildDocument(built.albums, {
    generatedAt: new Date().toISOString(),
    source: GALLERY.sheetName
  });
  return { doc: doc, albums: built.albums, files: files, warnings: warnings, stopped: stopped, found: totalFound };
}

function summarizeGallery_(b) {
  var photos = b.doc.albums.reduce(function (s, a) { return s + a.photos.length; }, 0);
  var s = '앨범 ' + b.doc.count + '개 · 사진 ' + photos + '장\n' +
    '드라이브에서 찾은 사진 ' + b.found + '장, 이번에 올릴 사진 ' + b.files.length + '장\n';
  b.doc.albums.slice(0, 10).forEach(function (a) {
    s += '\n· ' + (a.date || a.year) + '  ' + a.title + '  (' + a.photos.length + '장)';
  });
  if (b.doc.albums.length > 10) s += '\n…';
  if (b.warnings.length) {
    s += '\n\n⚠ 경고 ' + b.warnings.length + '건\n' + b.warnings.slice(0, 10).join('\n') +
      (b.warnings.length > 10 ? '\n…' : '');
  }
  return s;
}

function previewGallery() {
  var ui = SpreadsheetApp.getUi();
  if (!requireGalLib_(ui)) return;
  try {
    var b = buildGallery_(null);
    ui.alert('갤러리 미리보기 (업로드 없음)', summarizeGallery_(b), ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('오류', String(e.message || e), ui.ButtonSet.OK);
  }
}

function syncGalleryToGitHub() {
  var ui = SpreadsheetApp.getUi();
  if (!requireGalLib_(ui)) return;
  var started = new Date();
  var user = getUserEmail_();
  try {
    var token = getToken_();
    if (!token) {
      ui.alert('GitHub 토큰이 없습니다', '메뉴 🌐 홈페이지 ▸ "GitHub 토큰 설정" 을 먼저 실행하세요.', ui.ButtonSet.OK);
      return;
    }

    SpreadsheetApp.getActiveSpreadsheet().toast('드라이브에서 사진을 읽는 중입니다…', '🌐 갤러리', 30);
    var b = buildGallery_(token);

    if (b.warnings.length) {
      var answer = ui.alert('경고 ' + b.warnings.length + '건',
        summarizeGallery_(b) + '\n\n계속 업로드할까요?', ui.ButtonSet.YES_NO);
      if (answer !== ui.Button.YES) {
        logGallery_(started, user, b.doc.count, '취소 (경고 확인)', b.warnings);
        return;
      }
    }

    var remote = githubGetJson_(token, GALLERY.path);
    if (!b.files.length && remote && GalLib.sameAlbums(remote, b.doc)) {
      SpreadsheetApp.getActiveSpreadsheet().toast('갤러리가 이미 최신입니다 (변경 없음).', '🌐 갤러리', 8);
      logGallery_(started, user, b.doc.count, '변경 없음', b.warnings);
      return;
    }

    var all = b.files.concat([{ path: GALLERY.path, content: GalLib.serialize(b.doc) }]);
    var message = 'chore(gallery): sync ' + b.doc.count + ' albums from sheet' +
      (b.files.length ? ' (+' + b.files.length + ' photos)' : '');
    var commit = githubCommitFiles_(token, all, message);

    writeBackGallery_(b.albums);
    logGallery_(started, user, b.doc.count, commit.html_url, b.warnings);
    ui.alert('완료',
      '앨범 ' + b.doc.count + '개, 새로 올린 사진 ' + b.files.length + '장.\n' +
      (b.stopped ? '\n시간 제한으로 일부만 올렸습니다. 한 번 더 실행해 주세요.\n' : '') +
      '\n1~2분 후 홈페이지에 반영됩니다.\n' + GALLERY.siteUrl + '\n커밋: ' + commit.html_url,
      ui.ButtonSet.OK);
  } catch (e) {
    logGallery_(started, user, '', '실패: ' + String(e.message || e), []);
    ui.alert('갤러리 업로드 실패', String(e.message || e), ui.ButtonSet.OK);
  }
}

// ID · 사진 수 · 마지막 갱신 열을 시트에 되돌려 적는다 (ID 가 있어야 제목을 바꿔도 폴더가 유지된다)
function writeBackGallery_(albums) {
  try {
    var data = readGalleryRows_();
    var idx = PubLib.headerIndex(data.headers);
    var C = GalLib.COLUMNS;
    var idCol = idx[PubLib.normalizeHeader(C.id)];
    var cntCol = idx[PubLib.normalizeHeader(C.photoCount)];
    var atCol = idx[PubLib.normalizeHeader(C.syncedAt)];
    var now = new Date();
    albums.forEach(function (a) {
      if (idCol != null) data.sheet.getRange(a.rowNo, idCol + 1).setValue(a.id);
      if (cntCol != null) data.sheet.getRange(a.rowNo, cntCol + 1).setValue(a.photos.length);
      if (atCol != null) data.sheet.getRange(a.rowNo, atCol + 1).setValue(now);
    });
  } catch (e) {
    console.error('writeBackGallery_ failed: ' + e);
  }
}

function logGallery_(started, user, count, result, warnings) {
  log_(started, user, count, '[갤러리] ' + result, warnings);
}

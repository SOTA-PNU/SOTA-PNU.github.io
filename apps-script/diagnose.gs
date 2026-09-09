/*
 * apps-script/diagnose.gs — 설치나 갱신이 안 될 때 원인을 알려주는 진단용 파일 (선택)
 *
 * 사용법: Apps Script 편집기에 pubDiag.gs 로 붙여넣고 저장한 뒤,
 *        함수 드롭다운에서 아래 함수를 골라 실행하고 시트 탭으로 넘어가 알림창을 봅니다.
 *
 *   diagnoseWebsiteSetup   설치 상태 + 논문 초기 설정이 왜 실패하는지
 *   diagnoseGalleryFolder  드라이브 폴더에서 스크립트가 무엇을 보고 있는지
 *
 * 알림창 내용을 그대로 복사해서 문의하면 됩니다. 문제가 풀리면 이 파일은 지워도 됩니다.
 *
 * 이 파일은 pubSite.gs 가 예전 버전이어도 동작하도록 필요한 것을 스스로 갖고 있다.
 * (진단 도구가 진단 대상에 의존하면, 정작 필요할 때 같이 고장난다)
 */

// pubSite.gs 없이도 폴더를 들여다볼 수 있게 여기에 따로 둔다
function diagListFolder_(folderId) {
  var folder = DriveApp.getFolderById(folderId);
  var images = [], others = [], subfolders = [];
  var it = folder.getFiles();
  while (it.hasNext()) {
    var f = it.next();
    var mime = String(f.getMimeType());
    var entry = { name: f.getName(), mime: mime, size: f.getSize(),
      caption: String(f.getDescription() || '').replace(/\s+/g, ' ').trim() };
    if (mime.indexOf('image/') === 0) images.push(entry); else others.push(entry);
  }
  images.sort(function (a, b) { return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0); });
  var fit = folder.getFolders();
  while (fit.hasNext()) subfolders.push(fit.next().getName());
  return { name: folder.getName(), images: images, others: others, subfolders: subfolders };
}

// 링크에서 폴더 ID 뽑기 (pubGallery.gs 가 없어도 동작하도록 여기에도 둔다)
function diagFolderId_(value) {
  var s = String(value == null ? '' : value).trim();
  if (!s) return '';
  var m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/) ||
          s.match(/[?&]id=([A-Za-z0-9_-]{10,})/) ||
          s.match(/^([A-Za-z0-9_-]{10,})$/);
  return m ? m[1] : '';
}

// 지금 이 스크립트에 실제로 승인된 권한 목록을 가져온다.
// appsscript.json 에 oauthScopes 가 적혀 있으면 Apps Script 는 그 목록만 쓰기 때문에,
// DriveApp 코드를 넣어도 드라이브 권한이 자동으로 붙지 않는다.
function diagScopes_() {
  try {
    var res = UrlFetchApp.fetch(
      'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + encodeURIComponent(ScriptApp.getOAuthToken()),
      { method: 'get', muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return null;
    return String(JSON.parse(res.getContentText()).scope || '').split(/\s+/).filter(Boolean);
  } catch (e) {
    return null;
  }
}

function diagUserEmail_() {
  try { return Session.getActiveUser().getEmail() || ''; } catch (e) { return ''; }
}

function diagnoseWebsiteSetup() {
  var ui = SpreadsheetApp.getUi();
  var out = [];
  function add(label, value) { out.push(label + ': ' + value); }
  function safe(label, fn) {
    try { add(label, fn()); } catch (e) { add(label, '확인 실패 (' + (e && e.message ? e.message : e) + ')'); }
  }

  add('pubLib(PubLib)', typeof PubLib === 'undefined' ? '없음 ← lib.js 를 붙여넣고 저장하세요'
    : '있음, 헤더 ' + (PubLib.WEBSITE_HEADERS || []).length + '개');
  add('pubGallery(GalLib)', typeof GalLib === 'undefined' ? '없음 ← gallery.js 를 붙여넣고 저장하세요'
    : '있음, 열 ' + (GalLib.HEADERS || []).length + '개');
  add('pubSeed(PUB_SEED)', typeof PUB_SEED === 'undefined' ? '없음 (키워드 자동 채움만 건너뜀)'
    : '있음, ' + Object.keys(PUB_SEED).length + '건');
  add('GitHub 토큰', PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN') ? '저장됨' : '없음 ← 메뉴에서 "GitHub 토큰 설정" 실행');
  safe('실행 계정', function () { return diagUserEmail_() || '(확인 불가)'; });
  safe('스프레드시트 시간대', function () { return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(); });
  safe('탭 목록', function () {
    return SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function (s) {
      return '[' + s.getName() + ']';
    }).join(' ');
  });

  var sh = null;
  try { sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('논문 등록'); } catch (e) { sh = null; }
  add('논문 탭 찾기', sh ? '성공' : '실패 ← 위 탭 목록에 "논문 등록" 이 있는지 확인');
  if (sh) {
    safe('데이터 크기 (열/행)', function () { return sh.getLastColumn() + ' / ' + sh.getLastRow(); });
    safe('격자 크기 (열/행)', function () { return sh.getMaxColumns() + ' / ' + sh.getMaxRows(); });
    safe('보호된 범위 수', function () {
      return '범위 ' + sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).length +
        ' / 시트 ' + sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length;
    });
  }

  if (typeof setupWebsiteColumns === 'function') {
    try {
      setupWebsiteColumns();
      add('논문 초기 설정 실행', '오류 없이 끝났습니다');
    } catch (e) {
      add('논문 초기 설정 오류', (e && e.message) ? e.message : String(e));
      add('오류 위치', (e && e.stack) ? String(e.stack).split('\n').slice(0, 4).join(' / ') : '스택 없음');
    }
  } else {
    add('논문 초기 설정 실행', '건너뜀 (pubSite.gs 가 없습니다)');
  }

  ui.alert('설치 진단 결과', out.join('\n'), ui.ButtonSet.OK);
}

/**
 * 드라이브 폴더에서 스크립트가 실제로 무엇을 보는지 보여준다.
 * "사진이 없습니다" 가 나올 때 실행하면 하위 폴더에 넣었는지, 이미지가 아닌 파일인지 알 수 있다.
 */
function diagnoseGalleryFolder() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.prompt('갤러리 폴더 진단',
    '확인할 드라이브 폴더 링크를 붙여넣으세요.\n(비워 두고 확인을 누르면 "갤러리" 탭의 모든 행을 검사합니다)',
    ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;

  var typed = r.getResponseText().trim();
  var targets = [];
  if (typed) {
    targets.push({ label: '입력한 링크', link: typed });
  } else {
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('갤러리');
    if (!sh) {
      ui.alert('"갤러리" 탭이 없습니다', '메뉴에서 "갤러리 탭 만들기" 를 먼저 실행하거나, 폴더 링크를 직접 입력해 주세요.', ui.ButtonSet.OK);
      return;
    }
    var values = sh.getDataRange().getValues();
    var head = values[0].map(function (h) { return String(h).replace(/\s+/g, ''); });
    var titleCol = head.indexOf('행사명');
    var linkCol = -1;
    head.forEach(function (h, i) { if (h.indexOf('드라이브') === 0) linkCol = i; });
    values.slice(1).forEach(function (row, i) {
      var title = titleCol > -1 ? String(row[titleCol] || '').trim() : '';
      var link = linkCol > -1 ? String(row[linkCol] || '').trim() : '';
      if (title || link) targets.push({ label: (i + 2) + '행 ' + (title || '(행사명 없음)'), link: link });
    });
  }
  if (!targets.length) { ui.alert('갤러리 탭에 검사할 행이 없습니다.'); return; }

  var out = ['실행 계정: ' + (diagUserEmail_() || '(확인 불가)')];

  // 승인된 권한부터 보여 준다 — 드라이브가 없으면 그것이 원인이다
  var scopes = diagScopes_();
  if (scopes) {
    var hasDrive = scopes.some(function (x) { return x.indexOf('/auth/drive') !== -1; });
    out.push('승인된 권한 ' + scopes.length + '개: ' + scopes.map(function (x) {
      return x.replace('https://www.googleapis.com/auth/', '');
    }).join(', '));
    out.push('드라이브 권한: ' + (hasDrive ? '있음' : '없음 ← 이것이 원인입니다'));
    if (!hasDrive) {
      out.push('  고치는 법: Apps Script 편집기 ⚙️ 프로젝트 설정 →');
      out.push('    "appsscript.json 매니페스트 파일을 편집기에 표시" 체크 →');
      out.push('    왼쪽 파일 목록의 appsscript.json 열기 →');
      out.push('    oauthScopes 배열에 아래 한 줄 추가 → 저장 → 메뉴 다시 실행 후 승인');
      out.push('    "https://www.googleapis.com/auth/drive.readonly"');
    }
  } else {
    out.push('승인된 권한: 확인하지 못했습니다');
  }

  // 드라이브 자체에 접근이 되는지부터 본다.
  // 여기가 막히면 폴더 문제가 아니라 스크립트의 드라이브 권한(스코프) 문제다.
  var driveOk = false;
  try {
    var rootName = DriveApp.getRootFolder().getName();
    driveOk = true;
    out.push('드라이브 접근: 됨 (내 드라이브 = "' + rootName + '")');
    var names = [], fit = DriveApp.getRootFolder().getFolders();
    while (fit.hasNext() && names.length < 8) names.push(fit.next().getName());
    out.push('내 드라이브 최상위 폴더: ' + (names.length ? names.join(', ') : '(없음)'));
  } catch (e) {
    out.push('드라이브 접근: 실패 — ' + String(e && e.message ? e.message : e));
    out.push('  → 폴더가 아니라 스크립트의 드라이브 권한 문제입니다.');
    out.push('    Apps Script 편집기 ⚙️ 프로젝트 설정에서 "appsscript.json 매니페스트 파일을 편집기에 표시" 를 켜고,');
    out.push('    oauthScopes 에 https://www.googleapis.com/auth/drive 가 있는지 확인하세요.');
  }
  targets.forEach(function (t) {
    out.push('');
    out.push('── ' + t.label);
    var id = diagFolderId_(t.link);
    if (!id) {
      out.push('  링크에서 폴더 ID 를 찾지 못했습니다: ' + (t.link || '(비어 있음)'));
      return;
    }
    out.push('  폴더 ID: ' + id);
    try {
      var info = diagListFolder_(id);
      out.push('  폴더 이름: ' + info.name);
      out.push('  이미지: ' + info.images.length + '장' +
        (info.images.length ? ' (' + info.images.slice(0, 5).map(function (f) { return f.name; }).join(', ') +
          (info.images.length > 5 ? ' 외' : '') + ')' : ''));
      out.push('  이미지 아닌 파일: ' + info.others.length +
        (info.others.length ? '개 (' + info.others.slice(0, 3).map(function (o) {
          return o.name + ' · ' + o.mime;
        }).join(', ') + ')' : '개'));
      out.push('  하위 폴더: ' + info.subfolders.length +
        (info.subfolders.length ? '개 (' + info.subfolders.slice(0, 5).join(', ') + ')' : '개'));
      if (!info.images.length) {
        if (info.subfolders.length) {
          out.push('  → 사진이 이 폴더에 직접 있지 않고 하위 폴더에 있습니다. 시트에는 하위 폴더의 링크를 넣으세요.');
        } else if (info.others.length) {
          out.push('  → 파일은 있는데 이미지가 아닙니다. 드라이브 바로가기가 아니라 사진 파일 자체를 넣으세요.');
        } else {
          out.push('  → 폴더가 비어 있습니다.');
        }
      }
      var withCaption = info.images.filter(function (f) { return f.caption; }).length;
      if (info.images.length) out.push('  사진 설명이 적힌 사진: ' + withCaption + '장');
    } catch (e) {
      out.push('  열 수 없음: ' + String(e.message || e));
      if (driveOk) {
        out.push('  → 드라이브 자체는 되는데 이 폴더만 안 열립니다. 다음을 확인하세요.');
        out.push('    1) 다른 구글 계정으로 만든 폴더인지 (링크의 /u/0/ 는 브라우저의 첫 번째 계정을 뜻하며,');
        out.push('       그 계정이 ' + (diagUserEmail_() || '실행 계정') + ' 이 아닐 수 있습니다)');
        out.push('    2) 폴더를 휴지통으로 옮겼는지');
        out.push('    3) 다른 계정 폴더라면 ' + (diagUserEmail_() || '실행 계정') + ' 에게 편집자로 공유했는지');
      }
    }
  });

  ui.alert('갤러리 폴더 진단', out.join('\n'), ui.ButtonSet.OK);
}

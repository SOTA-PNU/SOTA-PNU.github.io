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
 */

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
  add('GitHub 토큰', getToken_() ? '저장됨' : '없음 ← 메뉴에서 "GitHub 토큰 설정" 실행');
  safe('실행 계정', function () { return getUserEmail_() || '(확인 불가)'; });
  safe('스프레드시트 시간대', function () { return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(); });
  safe('탭 목록', function () {
    return SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function (s) {
      return '[' + s.getName() + ']';
    }).join(' ');
  });

  var sh = null;
  try { sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetName); } catch (e) { sh = null; }
  add('논문 탭 찾기', sh ? '성공' : '실패 ← 위 탭 목록과 CONFIG.sheetName 이 같은지 확인');
  if (sh) {
    safe('데이터 크기 (열/행)', function () { return sh.getLastColumn() + ' / ' + sh.getLastRow(); });
    safe('격자 크기 (열/행)', function () { return sh.getMaxColumns() + ' / ' + sh.getMaxRows(); });
    safe('보호된 범위 수', function () {
      return '범위 ' + sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).length +
        ' / 시트 ' + sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length;
    });
  }

  try {
    setupWebsiteColumns();
    add('논문 초기 설정 실행', '오류 없이 끝났습니다');
  } catch (e) {
    add('논문 초기 설정 오류', (e && e.message) ? e.message : String(e));
    add('오류 위치', (e && e.stack) ? String(e.stack).split('\n').slice(0, 4).join(' / ') : '스택 없음');
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
    try {
      var data = readGalleryRows_();
      var idx = PubLib.headerIndex(data.headers);
      data.rows.forEach(function (row, i) {
        var title = PubLib.str(PubLib.cell(row, idx, GalLib.COLUMNS.title));
        var link = PubLib.str(PubLib.cell(row, idx, GalLib.COLUMNS.folder));
        if (title || link) targets.push({ label: (i + 2) + '행 ' + (title || '(행사명 없음)'), link: link });
      });
    } catch (e) {
      ui.alert('오류', String(e.message || e), ui.ButtonSet.OK);
      return;
    }
  }
  if (!targets.length) { ui.alert('갤러리 탭에 검사할 행이 없습니다.'); return; }

  var out = ['실행 계정: ' + (getUserEmail_() || '(확인 불가)')];
  targets.forEach(function (t) {
    out.push('');
    out.push('── ' + t.label);
    var id = GalLib.folderIdFrom(t.link);
    if (!id) {
      out.push('  링크에서 폴더 ID 를 찾지 못했습니다: ' + (t.link || '(비어 있음)'));
      return;
    }
    out.push('  폴더 ID: ' + id);
    try {
      var info = listDriveFolder_(id);
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
      if (!info.images.length) out.push('  → ' + explainEmptyFolder_(info));
      var withCaption = info.images.filter(function (f) { return f.caption; }).length;
      if (info.images.length) out.push('  사진 설명이 적힌 사진: ' + withCaption + '장');
    } catch (e) {
      out.push('  열 수 없음: ' + String(e.message || e));
    }
  });

  ui.alert('갤러리 폴더 진단', out.join('\n'), ui.ButtonSet.OK);
}

/*
 * apps-script/diagnose.gs — 설치가 안 될 때 원인을 한 번에 보여주는 진단용 파일 (선택)
 *
 * 사용법: Apps Script 편집기에 pubDiag.gs 로 붙여넣고 저장한 뒤,
 *        함수 드롭다운에서 diagnoseWebsiteSetup 을 골라 실행.
 *        알림창에 나온 내용을 그대로 복사해서 문의하면 됩니다.
 *
 * 문제가 해결되면 이 파일은 지워도 됩니다.
 */
function diagnoseWebsiteSetup() {
  var ui = SpreadsheetApp.getUi();
  var out = [];

  function add(label, value) { out.push(label + ': ' + value); }
  function safe(label, fn) {
    try { add(label, fn()); } catch (e) { add(label, '확인 실패 (' + (e && e.message ? e.message : e) + ')'); }
  }

  // 1) 붙여넣은 파일들이 실제로 로드됐는지
  add('pubLib(PubLib)', typeof PubLib === 'undefined' ? '없음 ← lib.js 를 붙여넣고 저장하세요'
    : '있음, 헤더 ' + (PubLib.WEBSITE_HEADERS || []).length + '개');
  add('pubSeed(PUB_SEED)', typeof PUB_SEED === 'undefined' ? '없음 (키워드 자동 채움만 건너뜀)'
    : '있음, ' + Object.keys(PUB_SEED).length + '건');
  add('CONFIG.sheetName', typeof CONFIG === 'undefined' ? 'CONFIG 없음' : '"' + CONFIG.sheetName + '"');

  // 2) 시트 상태
  safe('스프레드시트 시간대', function () { return SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(); });
  safe('탭 목록', function () {
    return SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function (s) {
      return '[' + s.getName() + ']';
    }).join(' ');
  });

  var sh = null;
  try { sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.sheetName); } catch (e) { sh = null; }
  add('대상 탭 찾기', sh ? '성공' : '실패 ← 위 탭 목록의 이름과 CONFIG.sheetName 이 정확히 같은지 확인');

  if (sh) {
    safe('데이터 크기 (열/행)', function () { return sh.getLastColumn() + ' / ' + sh.getLastRow(); });
    safe('격자 크기 (열/행)', function () { return sh.getMaxColumns() + ' / ' + sh.getMaxRows(); });
    safe('보호된 범위 수', function () {
      var r = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).length;
      var s = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET).length;
      return '범위 ' + r + ' / 시트 ' + s + (r + s ? ' ← 보호가 걸려 있으면 열 추가가 막힐 수 있습니다' : '');
    });
    safe('1행 헤더', function () {
      return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) {
        return String(h).replace(/\s+/g, ' ');
      }).join(' | ');
    });
  }

  // 3) 실제로 초기 설정을 돌려보고 오류를 그대로 받는다
  try {
    setupWebsiteColumns();
    add('초기 설정 실행', '오류 없이 끝났습니다');
  } catch (e) {
    add('초기 설정 오류', (e && e.message) ? e.message : String(e));
    add('오류 위치', (e && e.stack) ? String(e.stack).split('\n').slice(0, 4).join(' / ') : '스택 없음');
  }

  ui.alert('설치 진단 결과', out.join('\n'), ui.ButtonSet.OK);
}

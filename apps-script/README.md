# 홈페이지 논문 목록 자동 갱신 (Google 시트 → GitHub)

`논문 등록` 탭에 논문을 등록하고 시트 메뉴 **🌐 홈페이지 ▸ 논문 목록 갱신 → GitHub 업로드** 를 누르면
`data/publications.json` 이 GitHub 에 커밋되고, 1~2분 뒤 https://sota.pusan.ac.kr/publications.html 에 반영됩니다.
`publications.html` 을 직접 편집할 필요가 없습니다.

```
[시트: 논문 등록] → (메뉴 클릭, Apps Script) → GitHub data/publications.json → GitHub Pages 자동 빌드 → 홈페이지
```

## 1. 최초 설치 (한 번만, 저장소 쓰기 권한이 있는 사람이)

### 1-1. GitHub 토큰 발급

바로 가기: **https://github.com/settings/personal-access-tokens/new**

메뉴로 찾으려면 우측 상단 프로필 → **Settings** → 왼쪽 사이드바를 **맨 아래까지 스크롤** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**.
사이드바가 길어서 대부분 여기서 못 찾습니다. Developer settings 는 **개인 계정 설정**에만 있고 조직·저장소 설정에는 없습니다.

채울 값:

| 항목 | 값 |
|---|---|
| Token name | `sota-sheet-sync` |
| Expiration | 1 year (만료되면 1-4 "GitHub 토큰 설정" 으로 교체) |
| Resource owner | **SOTA-PNU** (조직) |
| Repository access | **Only select repositories** → `SOTA-PNU.github.io` |
| Permissions | **Contents: Read and write** (아래 설명 참고) |

**Permissions 는 목록이 아니라 검색해서 추가하는 방식입니다.** 처음에는 `Repositories 0` 과 "No repository permissions added yet" 만 보이는 것이 정상입니다.
1. 오른쪽 위 **`+ Add permissions`** 클릭
2. 검색창에 `Contents` 입력 후 선택
3. 접근 수준을 **Read and write** 로 변경
4. `Metadata: Read-only` 가 자동으로 함께 추가됩니다 (필수 의존 권한이므로 지우지 마세요)

필요한 권한은 Contents 하나뿐입니다. 마지막으로 **Generate token** → 토큰 문자열을 복사해서 바로 1-4 에 붙여넣으세요 (다시 볼 수 없습니다).

> **조직 승인이 필요할 수 있습니다.** Resource owner 목록에 SOTA-PNU 가 없거나 토큰 상태가 `Pending` 이면, 조직 소유자가 조직 Settings → Third-party Access → Personal access tokens 에서 승인해야 합니다.
> 승인이 어려우면 https://github.com/settings/tokens 에서 **Generate new token (classic)** → `public_repo` 스코프 하나만 체크해도 동작합니다. 다만 그 계정의 **모든 공개 저장소** 쓰기 권한이 생기므로 fine-grained 를 우선 시도하세요.

### 1-2. Apps Script 코드 넣기
1. 시트 상단 메뉴 **확장 프로그램 → Apps Script**
2. **새 파일 3개**를 만들고(`+` → 스크립트) 저장소의 파일 내용을 그대로 붙여넣기

   | Apps Script 에서 만들 파일 | 붙여넣을 내용 (GitHub 에서 복사 아이콘 클릭) |
   |---|---|
   | `pubLib.gs` | [`apps-script/lib.js`](https://github.com/SOTA-PNU/SOTA-PNU.github.io/blob/main/apps-script/lib.js) |
   | `pubSeed.gs` | [`apps-script/seed.js`](https://github.com/SOTA-PNU/SOTA-PNU.github.io/blob/main/apps-script/seed.js) |
   | `pubSite.gs` | [`apps-script/Code.gs`](https://github.com/SOTA-PNU/SOTA-PNU.github.io/blob/main/apps-script/Code.gs) |

   > ⚠️ 이미 있는 `Code.gs`(대시보드 `[갱신]` 스크립트)를 **덮어쓰지 마세요.** 파일 이름은 아무거나 상관없고, 위 이름은 기존 파일과 겹치지 않게 하려는 것뿐입니다.

3. 프로젝트에 이미 `onOpen` 함수가 있으면(대시보드 스크립트 등) 방금 붙여넣은 `pubSite.gs` 의 `onOpen` 함수를 지우고, 기존 `onOpen` 안에 `addWebsiteMenu();` 한 줄을 추가
   (`CONFIG` 라는 전역 변수가 기존 스크립트에도 있으면 둘 중 하나의 이름을 바꿔야 합니다 — Apps Script 는 모든 파일이 전역을 공유합니다)
4. 저장(💾) 후 시트 탭을 새로고침 → 메뉴에 **🌐 홈페이지** 가 보이면 성공
5. 메뉴를 처음 실행하면 Google 권한 승인 창이 뜹니다: **권한 검토 → 계정 선택 → "고급" → "…(안전하지 않음)으로 이동" → 허용**. (외부 URL 접근 = GitHub API 호출 권한)

### 1-3. 초기 설정
메뉴 **🌐 홈페이지 ▸ 초기 설정 (홈페이지 열 추가)** → `논문 등록` 탭 오른쪽 끝에 아래 열이 생깁니다. 기존 열/수식은 건드리지 않습니다.
현재 홈페이지에 있던 키워드는 제목 매칭으로 자동 채워집니다(빈 셀만).

| 열 | 의미 | 비우면 |
|---|---|---|
| 홈페이지 제외 | ☑ 이면 게시 안 함 | 게시 |
| 구분 | Conference / Journal / Workshop | 자동 판정 (SCI·KCI·저널·논문지·Journal·Transactions → Journal, `-W`/Workshop/WIP → Workshop) |
| 약칭 | 카드 왼쪽 pill 텍스트 (예: `NeurIPS`, `IEMEK`) | 자동 판정 (매핑표 → 괄호 약어 → 첫 단어) |
| 키워드 | 카드 아래 회색 텍스트 (예: `Edge AI · NPU`) | 표시 안 함 |
| Paper 링크 / Code 링크 | `https://…` | 버튼 없음 |
| 수상 | 예: `⭐ Best Paper` | 배지 없음 (Awarded 필터에 안 잡힘) |

### 1-4. 토큰 저장
메뉴 **🌐 홈페이지 ▸ GitHub 토큰 설정** → 1-1 에서 복사한 토큰 붙여넣기. 저장소 접근이 확인되면 저장됩니다.
토큰은 Apps Script 의 "스크립트 속성"에 저장되며 시트 셀·커밋 메시지·로그에는 기록되지 않습니다.

> ⚠️ **토큰은 시트 편집 권한자 모두가 볼 수 있습니다.** 시트를 편집할 수 있는 사람은 Apps Script 편집기를 열어 스크립트 속성의 토큰 값을 읽을 수 있고, 그 토큰으로 저장소에 직접 커밋할 수도 있습니다. 그래서
> - 토큰은 **fine-grained + 이 저장소 1개 + Contents 만** 으로 발급하세요 (classic `public_repo` 는 그 계정의 **모든 공개 저장소** 쓰기 권한이라 마지막 수단입니다).
> - 시트 **편집** 권한은 연구실 구성원에게만 주세요 (보기 권한은 상관없습니다).
> - 사람이 나가는 등 변동이 있으면 GitHub 에서 토큰을 폐기하고 새로 발급 → 메뉴에서 재설정하세요.

### 1-5. 첫 갱신
1. **미리보기 (검증만)** 로 게시 건수와 경고를 확인 (예: "발표일자 없음" 행은 날짜를 채우면 해결)
2. **논문 목록 갱신 → GitHub 업로드** → 완료 창의 커밋 링크 확인 → 1~2분 뒤 홈페이지 확인

## 2. 평소 사용법

- **새 논문**: `논문 등록` 탭에 행 추가 → `Publish` 체크 → (선택) 키워드/링크/수상 입력 → **논문 목록 갱신**
- **수정/삭제**: 셀을 고치거나 `Publish` 를 해제(또는 `홈페이지 제외` 체크) → **논문 목록 갱신**
- 게시 조건: `Publish` 체크 ∧ `홈페이지 제외` 미체크 ∧ 제목(한글 또는 영어) 있음
- 표시 규칙
  - 제목: 국내 논문(`SCI/학회` 가 `국내…`, `KCI…`, 또는 저널/학회명에 한글)이면 한글 제목, 아니면 영어 제목 (없는 쪽은 다른 언어로 대체)
  - 저자: `1저자` → `공동` → `교신` 순서, 중복 제거
  - 연도: `발표일자` 기준. 없으면 경고 후 올해로 배치
  - pill 색: 국제 학회/저널은 파랑, 국내는 초록
- 변경이 없으면 커밋하지 않고 "변경 없음" 으로 끝납니다.
- 실행 기록은 `홈페이지 갱신 로그` 탭에 남습니다.

## 3. 대시보드 `[갱신]` 버튼과 합치기 (선택)
기존 재계산 함수의 마지막 줄에 `syncPublicationsToGitHub();` 를 추가하면 버튼 하나로 대시보드 재계산 + 홈페이지 업로드가 됩니다.

## 4. Apps Script 없이 수동 갱신 (비상용)
시트가 "링크가 있는 모든 사용자 보기" 상태일 때만 동작합니다. 시트 ID 는 공개 저장소에 커밋하지 않으므로 먼저 알려줘야 합니다.
```bash
echo '<시트 ID>' > tools/sheet-id.local     # 이 파일은 .gitignore 됨 (또는 SOTA_SHEET_ID 환경변수)
node tools/sync_from_sheet.mjs             # → data/publications.json
git add data/publications.json
git commit -m "chore(publications): manual sync"
git push
```
시트 ID 는 시트 URL 의 `/spreadsheets/d/` 와 `/edit` 사이 문자열입니다.
`--seed` 옵션은 시트에 `키워드` 열이 없던 최초 1회 생성용입니다(옛 홈페이지의 키워드를 채움). 초기 설정(1-3)을 실행한 뒤에는 필요 없습니다.
`data/publications.json` 을 GitHub 웹에서 직접 편집해도 됩니다(다음 시트 갱신 때 덮어써짐).

> 🔒 **시트 공개 범위**: Apps Script 경로(1~3장)는 시트에 바인딩되어 실행되므로 시트를 공개하지 않아도 됩니다. 이 워크북에는 미공개 논문·특허·기술이전 탭이 있으니, 수동 갱신을 쓰지 않는다면 공유 설정을 "링크가 있는 모든 사용자"에서 **제한됨**으로 되돌리는 것을 권합니다.

## 5. 문제 해결

| 증상 | 원인 / 조치 |
|---|---|
| 메뉴가 안 보임 | 시트 새로고침. 그래도 없으면 Apps Script 에서 `onOpen` 이 두 개인지 확인 (1-2의 3번) |
| "GitHub API 401" | 토큰 만료/오타 → 새 토큰 발급 후 **GitHub 토큰 설정** |
| "GitHub API 403" (Resource not accessible by personal access token) | 대부분 **조직 승인 대기**입니다. https://github.com/settings/personal-access-tokens 에서 토큰에 `Pending` 이 붙어 있으면, 조직 소유자가 조직 Settings → Third-party Access → Personal access tokens → Pending requests 에서 승인해야 합니다. 승인을 기다리기 어려우면 classic 토큰(`public_repo`)으로 대체하세요. 그 외 원인은 Contents 가 Read 로만 설정됐거나 Repository access 에 저장소가 빠진 경우입니다 |
| 토큰 설정은 "저장 완료" 인데 갱신에서 403 | 공개 저장소는 권한 없는 토큰으로도 조회가 되므로 저장 시점에는 쓰기 권한을 확인할 수 없습니다. 위 403 항목을 따르세요 |
| "GitHub API 404" | 토큰의 Repository access 에 `SOTA-PNU.github.io` 가 없음, 또는 `Code.gs` 의 `CONFIG.repo` 오타 |
| "필수 헤더 없음: …" | `논문 등록` 1행 헤더 이름이 바뀜 (`Publish`, `발표일자`, `제목(한글)`, `제목(영어)`, `1저자` 필요). 헤더를 되돌리거나 `lib.js` 의 `COLUMNS` 수정 |
| 홈페이지에 반영이 안 됨 | 커밋 링크가 열리는지 확인 → GitHub 저장소 **Actions** 탭의 `pages build and deployment` 가 초록인지 확인 → 브라우저 강력 새로고침 |
| 홈페이지에 "불러오지 못했습니다" | `data/publications.json` 이 잘못된 JSON. 수동으로 만든 경우 `npm test` 로 검사 |
| 카드 모양/문구 수정 | `js/publications.js` (`cardHtml`), 스타일은 `css/redesign.css` 의 `.pnu-pub-*` |
| 약칭/구분 자동 판정 규칙 수정 | `apps-script/lib.js` 의 `VENUE_SHORT_MAP`, `detectKind` → 수정 후 `pubLib.gs` 에도 다시 붙여넣기 |
| 날짜가 하루씩 밀림 | Apps Script 프로젝트 시간대가 시트와 다름 → Apps Script 편집기 ⚙️ 프로젝트 설정에서 시간대를 `Asia/Seoul` 로 맞추세요 |
| 수동 갱신에서 "시트 ID 를 찾을 수 없습니다" | 4장 참고 (`tools/sheet-id.local` 또는 `SOTA_SHEET_ID`) |

## 6. 개발자용
- 테스트: `npm test` (Node ≥ 20, 의존성 없음)
- 변환 규칙과 데이터 스키마: `docs/superpowers/specs/2026-09-08-sheet-publications-sync-design.md`
- `apps-script/seed.js` 는 `tools/extract_seed.mjs` 로 생성된 파일 (초기 설정 후에는 더 이상 필요 없음)

# Google Sheet → GitHub → publications.html 동기화 설계

- 작성일: 2026-09-08
- 상태: 승인된 설계 (구현 전)
- 범위: **논문 목록(Publications)만.** 갤러리는 별도 설계(2단계).

## 1. 목표

연구실 구성원이 Google 스프레드시트 `논문 등록` 탭에 논문을 등록한 뒤
시트 메뉴의 **갱신** 버튼 하나로 GitHub 저장소에 반영되고, GitHub Pages가
자동으로 다시 빌드되어 `sota.pusan.ac.kr/publications.html`에 나타나게 한다.
`publications.html`을 손으로 편집하는 일을 없앤다.

### 성공 기준

1. 시트에 행을 추가하고 **갱신**을 누르면 1~2분 안에 홈페이지에 카드가 생긴다.
2. 홈페이지의 카드 모양·필터(All / Conference / Journal / Awarded)는 지금과 동일하다.
3. 현재 홈페이지에 손으로 넣어둔 정보(학회 약칭, 키워드, Paper/Code 링크, 수상)는 유실되지 않는다.
4. 시트 데이터에 문제가 있으면(날짜 없음 등) 갱신 시 경고로 알려준다.
5. GitHub 토큰은 시트 셀에 노출되지 않는다.

## 2. 현재 상태 (조사 결과)

- 홈페이지: 빌드 도구 없는 정적 HTML. GitHub Pages(legacy 빌드, `main` 브랜치 루트), 도메인 `sota.pusan.ac.kr`.
  header/footer는 `js/layout.js`가 `partials/*.html`을 fetch해서 주입한다(이미 JS 의존).
- `publications.html`: 연도별 `pnu-year-block` 안에 `pnu-pub-card` 53개가 손으로 작성됨.
  하단 인라인 스크립트가 `data-tags`로 필터링. 1289행에 `</spanㅌㄴ>` 오타 존재.
- 시트(`1Iz3_QLSXu6Ovww27wobo3JcsCSPZrhWN-OwEQnwjnc4`): 링크 공개(읽기).
  `논문 등록` 탭 헤더(A~U): 검증 · Publish · SCI/학회 · 발표일자 · 저널명/학회명 · 학술지 상위(%) · 기관 ·
  제목(한글) · 제목(영어) · 호 · ISSN/등록번호 · 출판국/개최국 · 1저자 · 공동 · 교신 · 실적기관 · mrnIF(2024) ·
  비고 · 사사 문구 · 사사 비율 · PDF. 실제 논문 61행(Publish=1 59행).
  대시보드 탭에 이미 `[갱신]` 버튼이 있어 Apps Script 프로젝트가 바인딩되어 있음(내용은 미확인).
- 저장소 권한: 현재 계정이 admin. Actions 활성화됨(이 설계에서는 사용하지 않음).

## 3. 전체 흐름

```
[시트: 논문 등록] ─ 메뉴 "🌐 홈페이지 ▸ 논문 목록 갱신" ─▶ [Apps Script]
      Publish=1 행 읽기 → 검증(경고 요약) → JSON 생성
      → GitHub Contents API PUT  data/publications.json
        (fine-grained PAT: 이 저장소 1개, Contents: Read & Write)
                                     │
                                     ▼  push → GitHub Pages 자동 빌드 (~1분)
[publications.html] ─ js/publications.js 가 data/publications.json fetch
                     → 카드 렌더 → 필터 바인딩
```

- 커밋은 1회(파일 1개)라 부분 실패가 없다.
- 사용자 PAT로 push되므로 Pages는 지금처럼 자동 빌드된다.
- GitHub Actions, 별도 빌드 단계, 봇 커밋은 없다.

## 4. 구성요소

### 4.1 저장소

| 경로 | 역할 |
|---|---|
| `data/publications.json` | 홈페이지가 읽는 **유일한 데이터 소스**. 초기값은 현재 시트 데이터로 생성해서 함께 커밋한다(Apps Script 연결 전에도 사이트 동작). |
| `js/publications.js` | 렌더러. 순수 함수 `buildPublicationsHtml(data)` + 브라우저 진입점(fetch → 렌더 → 필터 바인딩). 브라우저와 Node 양쪽에서 로드 가능. |
| `publications.html` | 손으로 쓴 카드 53개와 하단 필터 스크립트를 제거. `<div id="pubList">` 마운트, 로드 실패 안내 문구, `<script src="js/publications.js">` 추가. 헤더/필터 칩 마크업은 유지. |
| `apps-script/lib.js` | 행 → 레코드 변환 규칙(§5). GAS 전역에 의존하지 않는 순수 JS. Apps Script에 그대로 붙여넣고 Node 테스트에서도 같은 파일을 로드한다. |
| `apps-script/Code.gs` | 메뉴, 시트 읽기, 다이얼로그, GitHub 업로드, 로그 탭 기록, 초기 설정(열 추가 + seed), 토큰 설정. |
| `apps-script/seed.js` | 현재 `publications.html`에서 추출한 약칭/키워드/링크/수상 (제목 정규화 키 → 값). 초기 설정에서 한 번 사용. |
| `apps-script/README.md` | 설치 절차(토큰 발급 → 코드 붙여넣기 → 초기 설정 → 갱신), 운영 방법, 문제 해결. |
| `tests/*.test.js` | `node --test` 로 실행하는 단위 테스트(§8). |
| `docs/superpowers/specs/…` | 이 문서. |

`apps-script/`, `tests/`, `docs/` 는 Pages에 정적 파일로 노출되지만 문제 없는 내용만 담는다(토큰 없음).

### 4.2 시트 `논문 등록` 탭 — V열부터 추가 (기존 A~U 열과 수식은 손대지 않음)

| 열 | 헤더 | 형식 | 의미 | 비우면 |
|---|---|---|---|---|
| V | 홈페이지 제외 | 체크박스 | ☑ 이면 게시하지 않음 | 게시 |
| W | 구분 | 드롭다운 `Conference` / `Journal` | 카드 종류·필터 태그 | 자동 판정 |
| X | 약칭 | 텍스트 | pill 텍스트 (예: `NeurIPS`, `IEMEK`) | 자동 판정 |
| Y | 키워드 | 텍스트 | 메타 행 우측 (예: `Edge AI · NPU`) | 표시 안 함 |
| Z | Paper 링크 | URL | `Paper` 버튼 | 버튼 없음 |
| AA | Code 링크 | URL | `Code` 버튼 | 버튼 없음 |
| AB | 수상 | 텍스트 | 배지 (예: `⭐ Best Paper`) | 배지 없음, Awarded 필터 제외 |

초기 설정(`setupWebsiteColumns`)은 헤더가 이미 있으면 건너뛰고(멱등), 새로 만들 때만
헤더 스타일·데이터 검증(체크박스/드롭다운)을 넣는다. seed는 **빈 셀만** 채운다.

헤더는 **이름으로** 찾는다(열 위치가 아니라). 사용자가 열 순서를 바꿔도 동작한다.

## 5. 변환 규칙 (`apps-script/lib.js`)

입력: 헤더 배열 + 행 배열(Apps Script `getValues()` 결과: 날짜 셀은 `Date`, 체크박스는 boolean).
출력: `{ publications: [...], warnings: [...] }`.

### 게시 조건
`Publish` 가 1/true/"1" ∧ `홈페이지 제외` 미체크 ∧ (제목(한글) 또는 제목(영어) 있음).
제목이 둘 다 없으면 제외하고 경고.

### 필드 규칙

| 필드 | 규칙 |
|---|---|
| `date`, `year` | `발표일자`. Date → `YYYY-MM-DD`. 숫자(시리얼)면 1899-12-30 기준 변환. 문자열이면 `YYYY-MM-DD` / `YYYY.MM.DD` 파싱. 없거나 파싱 실패 → 경고, `year`는 **올해**, `date`는 `""`. |
| `titleKo`, `titleEn` | 각 열 trim. |
| `title` | 국내(`SCI/학회`가 `국내`로 시작 또는 `출판국/개최국`이 `한국`) → 한글 우선, 아니면 영어 우선. 우선 쪽이 없으면 다른 쪽. |
| `authors` | `1저자` → `공동` → `교신` 순으로 이어붙임. 구분자 `,` `;` `/` 줄바꿈. trim 후 빈 값 제거, **먼저 나온 위치를 유지하며** 중복 제거. |
| `type` | `구분` 열이 `Conference`/`Journal`(대소문자 무시) → 그 값. 없으면 `SCI/학회` 또는 `저널명/학회명`에 `SCI` `KCI` `저널` `논문지` `학회지` `Journal` `Transactions` 중 하나 포함 → `journal`, 아니면 `conference`. |
| `venue` | `저널명/학회명` trim. |
| `venueShort` | `약칭` 열 우선 → 매핑표(아래) 첫 매칭 → 저널명 괄호 안 대문자 약어(예: `(ISET)`) → 저널명 첫 단어. |
| `tier` | `SCI/학회`에 `BK IF` 또는 `SCI Q1` 포함 → `top`, 아니면 `normal`. |
| `keywords`, `paperUrl`, `codeUrl`, `award` | 해당 열 trim. URL은 `http://`/`https://`로 시작하지 않으면 경고 후 비움. |
| `id` | `${year}-${slug}`: 제목을 소문자·영숫자/한글만 남기고 `-`로 연결, 60자 절단. 같은 id가 생기면 `-2`, `-3` 접미. |

매핑표(부분 문자열, 대소문자 무시, 위에서부터 첫 매칭):
`IEMEK`→IEMEK, `임베디드공학회`→IEMEK, `KIPS`/`정보처리학회`→KIPS, `ASK 20`→KIPS,
`NeurIPS`→NeurIPS, `ICCV`→ICCV, `ECCV`→ECCV, `CGO`→CGO, `LCTES`→LCTES, `CASES`→CASES,
`IJCAI`→IJCAI, `IROS`→IROS, `Future Generation Computer Systems`→FGCS,
`Transactions on Embedded Computing`→TECS, `Transactions on Mobile Computing`→TMC,
`ETRI Journal`→ETRI J., `Parallel and Distributed Computing`→JPDC,
`Internet of Things Journal`→IoT-J, `전자공학회`→IEIE, `한국 컴퓨터 종합`/`한국컴퓨터종합`→KCC,
`통신학회`→KICS, `기계학회`→KSME, `AICompS`→AICompS, `ACK`→ACK.
매핑표는 `lib.js` 상수라 추가·수정이 쉽다.

### 정렬
`year` 내림차순 → `date` 내림차순(빈 date는 해당 연도 맨 뒤) → 시트 행 순서.

### JSON 스키마 (`data/publications.json`)

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-09-08T05:00:00.000Z",
  "source": "논문 등록",
  "count": 59,
  "publications": [
    {
      "id": "2026-비동기-큐-파이프라인-기법을-통한-임베디드-환경에서-추론-처리량-개선",
      "year": 2026,
      "date": "2026-05-13",
      "type": "conference",
      "tier": "normal",
      "venue": "IEMEK Symposium on Embedded Technology (ISET) 2026",
      "venueShort": "IEMEK",
      "title": "비동기 큐 파이프라인 기법을 통한 임베디드 환경에서 추론 처리량 개선",
      "titleKo": "비동기 큐 파이프라인 기법을 통한 임베디드 환경에서 추론 처리량 개선",
      "titleEn": "Improving Inference Throughput in Embedded Environments via Asynchronous Queue Pipelining",
      "authors": ["조현준", "이지호", "차주형", "김진목", "이지원", "김용주", "권용인"],
      "keywords": "Edge AI · NPU · Asynchronous Queue",
      "paperUrl": "",
      "codeUrl": "",
      "award": ""
    }
  ]
}
```

`generatedAt`은 Apps Script에서 주입(순수 함수 `lib.js`는 시각을 만들지 않음).

## 6. Apps Script 동작 (`apps-script/Code.gs`)

### 메뉴 `🌐 홈페이지`
1. **논문 목록 갱신 → GitHub 업로드** (`syncPublicationsToGitHub`)
2. **미리보기 (검증만)** (`previewPublications`) — 게시 건수·연도별 건수·경고 목록을 다이얼로그로 표시, 업로드 없음.
3. **초기 설정 (홈페이지 열 추가)** (`setupWebsiteColumns`)
4. **GitHub 토큰 설정** (`configureGitHubToken`)

### 갱신 흐름
1. `논문 등록` 탭 헤더·행 읽기 → `lib.js` 변환.
2. 경고가 있으면 "경고 N건 — 계속할까요?" (예/아니오). 아니오 → 중단.
3. JSON 직렬화(들여쓰기 2, 키 순서 고정) → UTF-8 → base64.
4. `GET /repos/SOTA-PNU/SOTA-PNU.github.io/contents/data/publications.json?ref=main` → sha.
   404면 신규 생성(sha 없이 PUT).
5. 원격 파일의 `publications` 배열과 새 배열이 동일하면(=`generatedAt` 제외 비교) "변경 없음" 토스트 후 종료(커밋 안 함).
6. `PUT` 커밋. 메시지: `chore(publications): sync N papers from sheet` + 두 번째 줄에 실행자 이메일(있을 때).
7. 성공 → 다이얼로그 "완료. 1~2분 후 홈페이지에 반영됩니다." + 커밋 URL. 로그 탭에 기록.

### 로그
`홈페이지 갱신 로그` 탭(없으면 생성): 시각 · 실행자 · 게시 건수 · 결과(커밋 URL / 변경 없음 / 실패 사유) · 경고 요약.
대시보드 탭은 건드리지 않는다.

### 토큰
- Script Properties `GITHUB_TOKEN` 에 저장. 시트 셀·로그에 절대 쓰지 않는다.
- `configureGitHubToken`: 프롬프트로 입력받아 저장 후 `GET /repos/…` 로 즉시 검증(권한 확인).
- 권장 토큰: fine-grained PAT, Repository access = `SOTA-PNU/SOTA-PNU.github.io` 1개, Permissions = Contents: Read and write, 만료 1년.
  조직 설정에서 fine-grained PAT가 막혀 있으면 classic PAT `public_repo` 스코프로 대체(README에 두 경로 모두 기술).

### 오류 처리

| 상황 | 동작 |
|---|---|
| 토큰 없음 | "④ GitHub 토큰 설정을 먼저 실행하세요" |
| 401 / 403 | "토큰이 만료되었거나 권한이 없습니다 → ④에서 재설정" |
| 409 (sha 불일치) | sha 재조회 후 1회 재시도, 그래도 실패면 오류 표시 |
| 404 (저장소/경로) | "저장소 설정 확인" + 설정값 표시 |
| 네트워크/기타 | 상태 코드·응답 본문 요약을 다이얼로그와 로그에 기록 |
| 시트 헤더 누락 | 필수 헤더(Publish, 발표일자, 제목(한글), 제목(영어), 1저자) 없으면 즉시 중단·안내 |

### 기존 `[갱신]` 버튼과 통합
기존 대시보드 재계산 함수 마지막에 `syncPublicationsToGitHub();` 한 줄을 추가하면 한 버튼으로 둘 다 실행된다(README에 안내). 기본은 별도 메뉴.

## 7. 홈페이지 렌더링 (`js/publications.js`)

- 진입: `DOMContentLoaded` 후 `fetch("data/publications.json", { cache: "no-cache" })`.
- 실패 시 `#pubList`에 "논문 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." 표시.
- `buildPublicationsHtml(data)` → 연도별 `pnu-year-block` (배지 + `pnu-pub-list`) → 카드.
- 카드 마크업은 현재 `publications.html`의 것과 동일:
  - `article.pnu-pub-card[data-tags="<type>[,awarded]"]` (+ `pnu-pub-awarded` 클래스 when award)
  - `.pnu-pub-side` > `.pnu-venue-pill.pnu-venue-conf|pnu-venue-top` (venueShort) + `.pnu-venue-meta` (Conference/Journal)
  - `.pnu-pub-main` > `.pnu-pub-top`(`.pnu-badges` 수상 배지 · `.pnu-links` Paper/Code — 둘 다 없으면 `.pnu-pub-top` 생략)
    > `h3.pnu-title` > `p.pnu-authors` > `.pnu-meta-row` (`venue` · `|` · `keywords`; keywords 없으면 구분점 생략)
- 모든 텍스트는 HTML 이스케이프. URL은 `http(s)://`만 허용(아니면 링크 생략).
- 필터: 기존 인라인 스크립트 로직을 그대로 옮김(칩 활성화, 카드 표시/숨김, 빈 연도 블록 숨김). 렌더 완료 후 바인딩.
- 브라우저/Node 겸용: `if (typeof module !== "undefined") module.exports = {...}` 패턴. 브라우저 진입점은 `document`가 있을 때만 실행.

## 8. 테스트 · 검증

`node --test tests/` (Node 24, 의존성 없음).

- `tests/lib.test.js` — 변환 규칙: 게시 조건(Publish 0/1, 제외 체크, 제목 없음), 제목 선택(국내/국제, 결측 대체), 저자 병합·중복 제거·구분자, 구분 판정(override/키워드/기본), 약칭(override/매핑표/괄호/첫 단어), tier, 날짜(Date/시리얼/문자열/결측 → 경고+올해), URL 검증, id slug·중복 접미, 정렬.
- `tests/render.test.js` — 렌더 출력: 연도 블록 순서, 카드 클래스/`data-tags`, 수상 배지·awarded 태그, 링크 유무에 따른 `.pnu-pub-top` 생략, 이스케이프(`<script>` 입력이 텍스트로 나옴), 잘못된 URL 링크 생략.
- `tests/seed.test.js` — seed 키 정규화가 시트 제목과 매칭되는지(대표 사례 몇 건).
- 초기 `data/publications.json`: 시트 xlsx export를 파싱해 `lib.js`로 생성(스크립트 `tests/fixtures/` 또는 일회성 도구). 생성 결과의 건수/연도 분포를 시트와 대조.
- 로컬 확인: `python3 -m http.server` 로 띄워 `publications.html` 렌더·필터 동작 확인(가능하면 브라우저 스크린샷).
- 현재 사이트 53개 카드 ↔ 시트 61행 제목 대조 → 시트에 없는 논문 목록을 최종 보고서에 포함.
- Apps Script → GitHub 실제 실행은 사용자 Google 계정이 필요하므로 이 작업에서는 수행하지 않는다. README 절차와 "미리보기"로 사용자가 검증한다.

## 9. 브랜치 · 배포

- 워크트리 브랜치 `worktree-feat-sheet-publications-sync` → push → **draft PR**. main 머지는 사용자.
- 머지 후 사용자 작업: README 절차대로 토큰 발급 → Apps Script 붙여넣기 → 초기 설정 → 갱신.

## 10. 범위 밖 (이번에 하지 않음)

- 갤러리 동기화(사진 저장 위치 결정 필요) — 같은 구조(시트 탭 + JSON + 렌더러)로 2단계에서 설계.
- 특허·수상·홍보 등 다른 탭.
- Apps Script 프로젝트 자동 배포(clasp) — 수동 붙여넣기로 충분.
- 기존 대시보드 `[갱신]` 스크립트 수정.

# 홈페이지 논문 목록 자동 갱신 (Google 시트 → GitHub)

`논문 등록` 탭에 논문을 등록하고 시트 메뉴 **🌐 홈페이지 ▸ 논문 목록 갱신 → GitHub 업로드** 를 누르면
`data/publications.json` 이 GitHub 에 커밋되고, 1~2분 뒤 https://sota.pusan.ac.kr/publications.html 에 반영됩니다.
`publications.html` 을 직접 편집할 필요가 없습니다.

```
[시트: 논문 등록] → (메뉴 클릭, Apps Script) → GitHub data/publications.json → GitHub Pages 자동 빌드 → 홈페이지
```

## 1. 최초 설치 (한 번만, 저장소 쓰기 권한이 있는 사람이)

### 1-1. GitHub 토큰 발급
1. GitHub → 우측 상단 프로필 → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
2. 설정
   - Token name: `sota-sheet-sync`
   - Expiration: 1 year (만료되면 1-4 "GitHub 토큰 설정" 으로 교체)
   - Resource owner: **SOTA-PNU** (조직). 목록에 없으면 조직 Settings → Third-party Access → Personal access tokens 에서 fine-grained 토큰 허용 필요. 허용이 어려우면 **Tokens (classic)** 에서 `public_repo` 스코프로 발급해도 됩니다.
   - Repository access: **Only select repositories** → `SOTA-PNU.github.io`
   - Permissions → Repository permissions → **Contents: Read and write** (Metadata 는 자동으로 Read)
3. **Generate token** → 토큰 문자열을 복사 (다시 볼 수 없으니 바로 1-4 에 붙여넣기)

### 1-2. Apps Script 코드 넣기
1. 시트 상단 메뉴 **확장 프로그램 → Apps Script**
2. 파일 3개를 만들고 저장소의 파일 내용을 그대로 붙여넣기 (`+` → 스크립트)

   | Apps Script 파일 | 저장소 파일 |
   |---|---|
   | `lib.gs` | `apps-script/lib.js` |
   | `seed.gs` | `apps-script/seed.js` |
   | `Code.gs` | `apps-script/Code.gs` |

3. 프로젝트에 이미 `onOpen` 함수가 있으면(대시보드 `[갱신]` 버튼용 스크립트 등) `Code.gs` 의 `onOpen` 을 지우고, 기존 `onOpen` 안에 `addWebsiteMenu();` 한 줄을 추가
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
토큰은 Apps Script 의 "스크립트 속성"에만 저장되며 시트 셀에는 기록되지 않습니다. (시트 편집 권한이 있는 사람은 누구나 이 메뉴로 업로드할 수 있습니다.)

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
시트가 "링크가 있는 모든 사용자 보기" 상태이면 로컬에서도 만들 수 있습니다.
```bash
node tools/sync_from_sheet.mjs        # → data/publications.json
git add data/publications.json
git commit -m "chore(publications): manual sync"
git push
```
`data/publications.json` 을 GitHub 웹에서 직접 편집해도 됩니다(다음 시트 갱신 때 덮어써짐).

## 5. 문제 해결

| 증상 | 원인 / 조치 |
|---|---|
| 메뉴가 안 보임 | 시트 새로고침. 그래도 없으면 Apps Script 에서 `onOpen` 이 두 개인지 확인 (1-2의 3번) |
| "GitHub API 401" | 토큰 만료/오타 → 새 토큰 발급 후 **GitHub 토큰 설정** |
| "GitHub API 403" | 토큰 권한 부족 → Contents: Read and write 로 재발급. 조직이 fine-grained 를 막았으면 classic `public_repo` |
| "GitHub API 404" | 토큰의 Repository access 에 `SOTA-PNU.github.io` 가 없음, 또는 `Code.gs` 의 `CONFIG.repo` 오타 |
| "필수 헤더 없음: …" | `논문 등록` 1행 헤더 이름이 바뀜 (`Publish`, `발표일자`, `제목(한글)`, `제목(영어)`, `1저자` 필요). 헤더를 되돌리거나 `lib.js` 의 `COLUMNS` 수정 |
| 홈페이지에 반영이 안 됨 | 커밋 링크가 열리는지 확인 → GitHub 저장소 **Actions** 탭의 `pages build and deployment` 가 초록인지 확인 → 브라우저 강력 새로고침 |
| 홈페이지에 "불러오지 못했습니다" | `data/publications.json` 이 잘못된 JSON. 수동으로 만든 경우 `npm test` 로 검사 |
| 카드 모양/문구 수정 | `js/publications.js` (`cardHtml`), 스타일은 `css/redesign.css` 의 `.pnu-pub-*` |
| 약칭/구분 자동 판정 규칙 수정 | `apps-script/lib.js` 의 `VENUE_SHORT_MAP`, `detectKind` → 수정 후 `lib.gs` 에도 다시 붙여넣기 |

## 6. 개발자용
- 테스트: `npm test` (Node ≥ 20, 의존성 없음)
- 변환 규칙과 데이터 스키마: `docs/superpowers/specs/2026-09-08-sheet-publications-sync-design.md`
- `apps-script/seed.js` 는 `tools/extract_seed.mjs` 로 생성된 파일 (초기 설정 후에는 더 이상 필요 없음)

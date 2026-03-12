# SOTA Lab Website

GitHub Pages 배포는 그대로 유지합니다.

## Local development

이 저장소는 정적 HTML/CSS/JS 사이트이지만, 일부 자산과 스크립트가 루트 경로(`/assets/...`) 및 `fetch("partials/...")`를 사용합니다. 그래서 브라우저에서 파일을 직접 여는 `file://` 방식이 아니라 HTTP 서버로 실행해야 합니다.

권장 방식은 VS Code 또는 Cursor에서 Dev Container로 여는 것입니다.

1. Dev Containers 지원 에디터에서 이 저장소를 엽니다.
2. `Reopen in Container`를 실행합니다.
3. 컨테이너가 올라오면 `http://localhost:8080`으로 접속합니다.

## Notes

- 로컬에서도 GitHub Pages와 동일하게 정적 파일을 그대로 서빙합니다.
- `/_vercel/insights/script.js`는 로컬에서 404가 날 수 있지만 페이지 렌더링에는 영향이 없습니다.
- 공개 사이트 주소: https://sota-pnu.github.io/

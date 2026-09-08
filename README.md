https://sota-pnu.github.io/

## 홈페이지 유지보수

- **논문 목록**은 Google 시트(`논문 등록` 탭)에서 관리합니다. 시트 메뉴 **🌐 홈페이지 ▸ 논문 목록 갱신** 을 누르면 `data/publications.json` 이 커밋되고 홈페이지에 반영됩니다. 설치·사용법: [`apps-script/README.md`](apps-script/README.md)
- `publications.html` 은 직접 편집하지 마세요 (`js/publications.js` 가 JSON 을 렌더링합니다).
- 테스트: `npm test`

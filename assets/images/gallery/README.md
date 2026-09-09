# 갤러리 사진

**보통은 이 폴더를 직접 건드릴 일이 없습니다.** 시트 `갤러리` 탭과 구글 드라이브로 사진을 올리면 스크립트가 여기에 넣어 줍니다. 사용법은 [`apps-script/README.md`](../../../apps-script/README.md) 3장을 보세요.

아래는 스크립트를 쓰지 않고 손으로 넣을 때의 규칙입니다.

행사 사진은 이 폴더 아래 행사별 폴더에 넣습니다.

```
assets/images/gallery/
  2026-05-iset/
    01.jpg
    02.jpg
  2026-06-ict-contest/
    01.jpg
```

폴더 이름은 `연-월-행사약칭` 형식을 권합니다. `data/gallery.json` 의 `cover` 와 `photos` 가 이 경로를 가리킵니다.

## 올리기 전에

- **긴 변 1600px, JPEG 품질 70~80** 정도로 줄여주세요. 휴대폰 원본(3~5MB)을 그대로 올리면 저장소가 금방 무거워지고 페이지도 느려집니다. 줄이면 보통 한 장에 200~600KB 입니다.
  - macOS 한 줄로: `sips -s format jpeg -s formatOptions 75 -Z 1600 원본.jpg --out 01.jpg`
  - 폴더 전체: `for f in *.JPG; do sips -s format jpeg -s formatOptions 75 -Z 1600 "$f" --out "${f%.*}.jpg"; done`
  - 미리보기 앱에서는 도구 → 크기 조정 후 내보내기
- **위치 정보(EXIF)를 지워주세요.** 휴대폰 사진에는 촬영 장소 좌표가 들어 있습니다. 위 `sips` 명령이나 미리보기로 저장하면 대부분 제거됩니다.
- 사람이 식별되는 사진은 찍힌 분들의 동의를 받고 올려주세요.

## 사진을 추가한 뒤

`data/gallery.json` 의 `albums` 에 항목을 추가합니다.

```json
{
  "id": "2026-05-iset",
  "title": "ISET 2026",
  "date": "2026-05-13",
  "year": 2026,
  "category": "conference",
  "place": "제주",
  "description": "임베디드공학회 학술대회 발표",
  "cover": "assets/images/gallery/2026-05-iset/01.jpg",
  "photos": [
    "assets/images/gallery/2026-05-iset/01.jpg",
    "assets/images/gallery/2026-05-iset/02.jpg"
  ]
}
```

`category` 는 `conference`, `lab`, `award`, `seminar` 중 하나입니다. `count` 도 항목 수에 맞게 고쳐주세요.

사진마다 설명을 붙이려면 `photos` 항목을 객체로 적습니다. 문자열과 섞어 써도 됩니다.

```json
"photos": [
  { "src": "assets/images/gallery/2026-05-iset/01.jpg", "caption": "개회식 발표" },
  "assets/images/gallery/2026-05-iset/02.jpg"
]
```

설명은 상세 창에서 그 사진을 볼 때 사진 아래에 나옵니다.

- `cover` 는 카드에 크게 보이는 대표 사진이고 16:10 으로 잘립니다. 세로로 찍은 사진은 위아래가 잘리니 가로 사진을 고르세요.
- `photos` 는 앨범 전체입니다. `cover` 를 첫 장으로 자동으로 넣으므로 목록에 중복으로 적어도 괜찮습니다.
- 카드에는 썸네일이 6장까지 보이고 나머지는 `+N` 으로 묶입니다. 사진을 클릭하면 전체 보기 창이 열립니다.
- 파일 이름의 대소문자가 정확해야 합니다. `.JPG` 와 `.jpg` 는 맥에서는 같지만 GitHub Pages 에서는 다릅니다.
- 다 고친 뒤 `npm test` 를 돌리면 경로 오타, 없는 파일, 잘못된 `category` 를 잡아줍니다.

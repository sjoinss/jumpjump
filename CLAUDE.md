@AGENTS.md

# 점프점프 — 작업 안내

내가 그린 도트 캐릭터로 끝없이 올라가는 세로 점프 게임 (Next.js 정적 내보내기 + Canvas 2D, PWA).
배포: https://sjoinss.github.io/jumpjump/ (저장소 sjoinss/jumpjump, `main` 푸시 → GitHub Actions가 test → build → Pages)

## 문서 우선순위

1. **사용자 결정** — 아래 "사용자 결정" 절 + `docs/ui-plan.md` 맨 위 "변경 사항" (기획서와 다르면 이쪽이 우선)
2. `dot-jump-climb-spec.md` (기획서), `UI제작원칙.md`
3. `docs/qa-checklist.md` (검수 결과)

## 명령

| 명령 | 내용 |
|---|---|
| `npm run dev` | 개발 서버 (서비스 워커는 등록 안 함, `window.__engine` 디버그 훅 있음) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | `tsconfig.test.json`으로 `.test-build/`에 컴파일 후 `node --test` (DOM 없는 로직만) |
| `npm run build` | `out/` 정적 내보내기 + `postbuild`가 `out/sw.js` 생성 |

- 이 PC(Windows)의 `python`은 MS Store 스텁이라 멈춘다 → 스크립트는 **node**로.
- 셸에서 긴 heredoc에 따옴표가 섞이면 깨지기 쉽다 → 긴 수정 스크립트는 scratchpad에 `.cjs` 파일로 써서 실행.
- 큰 작업 전후로 커밋·푸시 (사용자 선호). 커밋 메시지는 한국어.

## 구조

```
src/
  app/            layout(카카오톡 → 기본 브라우저로 넘기는 이른 스크립트, 테마 이른 적용)
  components/     화면(screens/PlayScreen·SettingsScreen), 결과 카드, 미니게임 화면, 데이터 관리, ui/(Button·Dialog·Toast·Segmented…)
  editor/         도트 에디터(session.ts = 순수 reducer), 이미지 불러오기·스킨 변환, 보관함(LibrarySection), PNG 저장(pngExport·PngSaveSection)
  game/           engine(루프·그리기), world(물리·발판·후보, 순수), config, themes(SCENE·THEMES), background, tiles(단면 타일 엔진)
    tilesets/     테마별 단면 타일 (blocks·candy·city·forest·winter·sakura·toys·desert)
    themePlatforms.ts  테마별 기본 발판 4종 (모양까지 다름)
    dream.ts      꿈나라 전용 배경 장식
    minigames/    파닥파닥·줄넘기·슈팅·피하기 (순수 로직 + draw)
  lib/            저장 스키마(v2)·검증·마이그레이션·내보내기 파일·파일 저장(fileIO)
  share/          결과 이미지(PNG·GIF) 렌더러·GIF 인코더(Web Worker)
  styles/tokens.css  UI 색·모양 토큰, 테마별 [data-theme] 블록
tests/            node:test (대비, 테마, 세계, 미니게임 밸런스, 에디터, 저장 …)
```

## 핵심 규칙

- **점수 = 높이(m)**, 1m = 72px. 게임 속도는 75/260/600m에서 1.05/1.1/1.15배 (`CONFIG.regions.speedSteps`) — 테마와 무관.
- **지역(배경)**은 테마마다 `SCENE[테마].regions`. 기본 높이 0/300/1000/2500m(블록 월드만 0/150/500/1200/2500 + 엔더 월드 4000m).
- **테마 추가 체크리스트**: `THEME_IDS` + `THEMES`(이름·설명·미리보기 색) + `SCENE`(지역·장식·바닥 색) + `tokens.css`의 `[data-theme]` 블록 + `tests/contrast.test.ts` 항목 + `themePlatforms.ts`(4종, 타입이 강제) + 필요하면 `tilesets/*.ts`. 대비 테스트(글자 4.5:1, 포커스 3:1)를 통과해야 한다.
- **테마 발판**: 저장된 발판이 기본(PLATFORM_PRESETS) 그대로인 종류만 지금 테마 발판으로 보인다(`resolvePlatforms`). 에디터에서 테마 발판과 똑같이 저장하면 다시 "기본"으로(`platformsForSave`) → 테마를 바꾸면 따라 바뀐다.
- **저장 데이터**: IndexedDB `dot-jump-climb`/`kv`(`save`, `editor.draft`, `editor.draft.companion.N`). 나중에 생긴 항목(theme, moving 발판, savedCharacters/savedPlatforms 등)은 없으면 기본값으로 읽는다(마이그레이션 없이). 구조를 바꾸면 `SCHEMA_VERSION` + `migrate.ts`.
- **보관함**: 캐릭터 5개, 발판 세트(4종) 3개. 내보내기 파일에도 포함.
- **알림(Toast)**은 popover로 맨 위 층에 올린다 — `<dialog>`(showModal) 위에서도 보이게.
- **파일 저장**: `saveOrShareFile` 후 버튼을 4초 "저장 완료"(`useSavedFlag`)로 바꾸고 파일 이름·위치 알림(`downloadedMessage`, 6초). 앱 안 브라우저(카카오톡 등)는 내려받기가 안 돼서 길게 눌러 저장 창 / 기본 브라우저로 열기.

## 사용자 결정 (기획서보다 우선)

UI·게임
- 파스텔 **게임풍** UI(두꺼운 외곽선, 눌리는 버튼, 도트 아이콘). 타이틀 화면 없음 — 시작 장면에 "시작하기/캐릭터 만들기" 카드(세로 가운데 양 끝). HUD 오른쪽 위 ⚙ → ‖ 아이콘만.
- 디자인 지시는 **말한 그대로 단순하게**. 보이게 하려고 임의로 비틀지 않는다.
- 테마 고르기는 작은 카드 격자(폭에 따라 3~4칸) + 고른 테마 설명만 아래.
- **테마 12종**: 도트 놀이터 · 솜사탕 · 꿈나라(잠든 방→양 세는 언덕→무지개 구름→은하수) · 바닷속 · 블록 월드(…→우주→엔더 월드) · 과자 나라 · 도시 빌딩 · 동화 숲 · 겨울 왕국 · 벚꽃 마을 · 장난감 방 · 사막 피라미드. 화산은 제외.
- 테마 발판은 **색만 바꾸지 말고 모양부터** 테마답게(구름·베개·I빔·통나무·썰매…).
- 일회용 발판: 밟으면 그 아래 발판이 가까운 것부터 차례로 무너짐(화면을 끌어올리지 않음).
- 동료 거절 3번이면 지금 동료 수로 자동 설정. 거절한 구슬은 사라짐.
- 미니게임은 "첫 시도 대부분 성공"보다 어렵게. **파닥파닥: 기둥 230px/s, 목숨 2개**(느린 반응 자동 플레이 약 30%). 미니게임 판은 테두리 두른 창.
- 캐릭터 공유 링크 기능은 원하지 않음(만들었다가 제거).

캐릭터·에디터
- 키보드로 그리기 없음(Ctrl+Z 등 단축키는 유지).
- 캐릭터 모습 3가지: 기본(필수)·내려갈 때·착지.
- 이미지 → 도트 변환은 격자와 **정확히 같은 px(16×18, 32×36)**일 때만. 등록한 이미지 그림은 수정 불가(도트만 수정).
- 스킨 → 도트: 머리 3배·몸 작게, 차렷/십자(어깨에 붙은 6칸 팔)/착지 다리 굽힘, 모자 층은 머리보다 한 칸 크게, 겉 층 그림자 없음.
- **기본 캐릭터(말랑이 등) → 내 이미지·내 그림**으로 바꿀 때만 "기본 캐릭터의 내려갈 때·착지 그림이 사라져요" 묻고 지우기/남겨두기. **내 그림 → 내 그림은 절대 지우지 않음.**
- **PNG 저장**: 칸 격자 그대로(빈 칸 포함) n배, 정사각형·여백·빈칸 자르기 없음. 고른 크기(64·128·256·512) = 가로.

## 확인 요령 (브라우저, Claude in Chrome)

- 탭이 숨겨져 있으면 rAF가 안 돈다 → `window.__engine`으로 `update()`/`render()`를 직접 부르고, `world`를 조작해 후보·게임오버를 만든다. 자동 일시정지(창 blur)가 잘 걸리니 "계속하기"를 눌러 준다.
- 여러 폭·테마 비교: `/__audit` 같은 404 주소에서 body를 비우고 같은 출처 iframe(390·320px, 또는 scale .5로 여러 개)을 띄운다. UI 색만 볼 땐 iframe의 `data-theme`만 바꾸고, 게임 배경까지 볼 땐 설정 화면 라디오로 실제 테마를 바꾼다.
- **사용자 로컬 데이터 보호**: 확인 전에 IndexedDB `dot-jump-climb`를 localStorage에 백업하고 끝나면 되돌린다(게임오버 테스트는 최고 기록을, 에디터는 임시 저장본을 바꾼다). 에디터의 "그리던 그림" 창에서 "버리고 새로 시작"을 누르지 않는다.
- **다운로드 확인**: iframe의 `HTMLAnchorElement.prototype.click`을 클릭 직전에 덮어써서 실제 파일을 받지 않고 href(blob)·이름만 잡아 검사한다(버튼이 다시 그려지면 예전 버튼을 누르지 않게 다시 찾기).
- 배경만 높이별로 볼 땐 PlayScreen dev 훅 옆에 `import("@/game/background")`를 `window.__bg`로 잠깐 걸어 `drawBackground`를 캔버스에 그린다(확인 후 제거). 발판 시트는 `npm test` 뒤 `.test-build/src/game/themePlatforms.js`를 node로 읽어 그릴 수 있다(임시 파일은 꼭 지우기).
- 코드를 고치면 dev 서버가 부모 페이지까지 새로고침할 수 있다 → 확인용 스크립트는 다시 실행할 수 있게 둔다.

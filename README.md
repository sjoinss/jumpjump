# 점프점프

내가 그린 도트 캐릭터로 끝없이 올라가는 세로형 점프 게임입니다. 모바일 웹·PC 브라우저에서 동작합니다.

- 기획: [`dot-jump-climb-spec.md`](dot-jump-climb-spec.md)
- UI 분석·구성안: [`docs/ui-plan.md`](docs/ui-plan.md)

## 개발

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 단위 테스트 (node:test)
npm run build      # 정적 파일을 out/ 에 생성
```

Next.js(App Router, 정적 내보내기) + TypeScript, 외부 라이브러리 없이 Canvas 2D로 만듭니다.
데이터는 브라우저의 IndexedDB에만 저장되며 서버로 보내지 않습니다.

## 배포

`main` 브랜치에 푸시하면 GitHub Actions(`.github/workflows/deploy.yml`)가 테스트 → 빌드 → GitHub Pages 배포를 합니다.
하위 경로(`/<저장소 이름>/`)는 워크플로가 `PAGES_BASE_PATH`로 넣어 줍니다.

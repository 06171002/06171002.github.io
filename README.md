# 06171002.github.io

이상진의 포트폴리오 사이트 — https://06171002.github.io/

- **콘텐츠 원본은 노션**이다. `pnpm sync`(M1 예정)가 노션을 Markdown 스냅샷으로 내려받고, 변경분을 검토한 뒤 커밋한다
- 스택: Astro 7 · TypeScript · GitHub Pages
- 설계: [docs/design.md](docs/design.md)

## 명령어

| 명령 | 설명 |
| --- | --- |
| `pnpm install` | 의존성 설치. 스크립트용 Node 24.22.0 은 pnpm 이 이 리포 전용으로 내려받는다 |
| `pnpm dev` | 개발 서버 (http://localhost:4321) |
| `pnpm build` | 타입 검사(`astro check`) + 정적 빌드 → `dist/` |
| `pnpm preview` | 빌드 결과 미리보기 |

## 배포

`main` 에 push 하면 GitHub Actions(`.github/workflows/deploy.yml`)가 빌드해 GitHub Pages 에 올린다.

## 비공개 자료

노션 토큰 · 노션 ID 매핑 · 치환표 · 공개 전 점검 목록은 이 리포가 아니라 형제 폴더 `../portfolio-private/` 에 둔다. 이 리포는 공개 리포다.

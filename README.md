# 06171002.github.io

이상진의 포트폴리오 사이트 — https://06171002.github.io/

- **콘텐츠 원본은 노션**이다. `pnpm sync` 가 노션을 Markdown 스냅샷으로 내려받고, 변경분을 검토한 뒤 커밋한다
- 프로젝트 내부 정보(API · 테이블 · 코드 식별자 · 인프라 · 연동 업체 등)는 싣지 않는다. 동기화 대상은 노션 원문이 아니라 이를 일반화한 '공개용 카드' 사본이다 (설계 6.5)
- 스택: Astro 7 · TypeScript · GitHub Pages
- 설계: [docs/design.md](docs/design.md)

## 명령어

| 명령 | 설명 |
| --- | --- |
| `pnpm install` | 의존성 설치. 스크립트용 Node 24.22.0 은 pnpm 이 이 리포 전용으로 내려받는다 |
| `pnpm dev` | 개발 서버 (http://localhost:4321) |
| `pnpm build` | 타입 검사(`astro check`) + 정적 빌드 → `dist/` |
| `pnpm preview` | 빌드 결과 미리보기 |
| `pnpm guard` | 빌드 결과(`dist/`)를 공개 규칙 + 비공개 금지어로 검사한다 (CI 2차 가드와 같은 검사) |
| `pnpm guard --secret-file` | 금지어 목록을 바꾼 뒤 CI 시크릿 값 파일(`../portfolio-private/ci-secret.env`)을 만든다 → `gh secret set -f` 로 등록 |

## 노션 동기화

| 명령 | 설명 |
| --- | --- |
| `pnpm sync` | 허용 목록(`sync.config.ts`)의 카드를 노션에서 내려받아 Markdown · 다이어그램 SVG · 커버로 쓴다 |
| `pnpm sync claims` | 특정 카드만 |
| `pnpm sync --dry-run` | 변환 · 가드만 하고 파일은 쓰지 않는다 |
| `pnpm sync --check` | 공개 기준으로 가드를 돌려 본다 (`publish: true` 로 바꾸기 전) |
| `pnpm diagrams` | 저장된 다이어그램 원문(`diagram-N.mmd`)을 노션 없이 다시 그린다 — 그림 테마를 바꾼 뒤 |

- 카드마다 `publish` 플래그가 있다. `false`(초안)는 커밋되지 않는 `src/content/drafts/` 에만 쓰고 로컬에서만 보인다. `true`(공개)만 커밋 대상이다
- 노션에서 토글 · 콜아웃 · 토글 제목을 `[비공개]` 로 시작하면 사이트에서 빠진다. 일반 제목에 붙이면 같은 단계 이상의 다음 제목 전까지 그 절이 통째로 빠진다
- Mermaid 렌더에는 이 PC 의 Chrome · Edge 를 쓴다. 다른 PC 면 `PUPPETEER_EXECUTABLE_PATH` 로 지정한다
- Windows PowerShell 이 `pnpm.ps1` 실행을 막으면 `pnpm.cmd sync` 처럼 `.cmd` 로 실행한다

## 배포

`main` 에 push 하면 GitHub Actions(`.github/workflows/deploy.yml`)가 빌드 → 2차 가드(빌드 결과를 공개 규칙 + 시크릿 금지어로 검사) → 배포 순서로 GitHub Pages 에 올린다. 가드에 걸리거나 시크릿 `PORTFOLIO_DENYLIST` 가 없으면 배포하지 않는다. 금지어 목록을 바꾸면 시크릿도 다시 등록한다 (`pnpm guard --secret-file` → `gh secret set -f`).

## 비공개 자료

노션 토큰 · 노션 ID 매핑 · 치환표 · 공개 전 점검 목록은 이 리포가 아니라 형제 폴더 `../portfolio-private/` 에 둔다. 이 리포는 공개 리포다.

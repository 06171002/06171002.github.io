# CLAUDE.md

노션 포트폴리오를 정적 사이트(https://06171002.github.io/)로 옮기는 개인 리포. 설계 정본은 [docs/design.md](docs/design.md).

## 지켜야 할 것

- **공개 리포다.** 비공개 자료(노션 토큰, 노션 ID 매핑, 치환표, 공개 전 점검 목록)는 리포 밖 `../portfolio-private/` (`C:\dev\portfolio-private\`)에만 둔다. `.gitignore` 는 2차 안전장치일 뿐이다
- **프로젝트 내부 정보는 사이트에 싣지 않는다** (design.md 6.5): API · 테이블/컬럼/코드값 · 클래스/메서드/파일 이름 · 설정 · 인프라 사양 · 연동 업체 · 고객 도메인 · 프로젝트 소개 문서. 내가 한 일(문제 · 판단 · 결과 · 검증)만 개념 이름으로 쓴다. 이 리포의 어떤 파일에도 숨길 고유명사를 적지 않는다
- **콘텐츠 원본은 노션이다.** 사이트는 노션 원문 카드가 아니라 일반화한 **'공개용 카드' 사본**을 동기화한다. `src/content/` 의 Markdown 은 `pnpm sync` 결과물이라 손으로 고치지 말고 사본을 고친 뒤 다시 동기화한다
- **공개 점검 전 카드는 커밋하지 않는다.** `sync.config.ts` 의 `publish: false` 카드는 gitignore 된 `src/content/drafts/` · `public/content-assets/drafts/` 에만 쓰인다. `publish: true` 로 바꾸기 전에 `pnpm sync --check` 와 비공개 점검 목록을 확인한다 (design.md 6.7)
- 노션 토큰은 사용자가 직접 넣는다. 스크립트가 API 호출에만 읽고, 토큰 값을 화면에 출력하거나 다른 곳으로 옮기지 않는다
- 커밋 · push 는 사용자가 요청할 때만 한다

## 명령어

- `pnpm dev` — 개발 서버 (4321)
- `pnpm build` — `astro check` + `astro build`
- `pnpm preview` — 빌드 결과 미리보기
- `pnpm sync [slug …] [--dry-run | --check]` — 노션 동기화 (README 참고)
- 앱 터미널(PowerShell)에서는 실행 정책 때문에 `pnpm.cmd dev` 처럼 `.cmd` 로 실행한다. 실행 정책은 바꾸지 않는다

## 동기화 규칙 (scripts/sync)

- 콜아웃 · 토글 · 열 · 표 래퍼 · 다이어그램은 원시 HTML 블록으로 쓴다. Astro 7 기본 Markdown 처리기(Sätteri)는 remark 플러그인을 돌리지 않는다 — remark 플러그인 · 지시문(`:::`)을 추가하지 말 것
- 노션에서 빼고 싶은 블록 표식은 글머리 `[비공개]`(일반 제목에 붙이면 그 절 전체). 🔒 아이콘은 내용 아이콘으로 쓰이므로 표식이 아니다
- 처리하지 못하는 노션 블록 타입이 나오면 동기화가 실패한다. 조용히 빠뜨리게 바꾸지 말고 변환을 추가한다

## 환경

- Astro 7.4.0 은 Node 22.22 이상이 필요하다. 시스템 Node 는 그대로 두고, `package.json` 의 `devEngines.runtime` 으로 pnpm 이 Node 24.22.0 을 내려받아 스크립트에 쓴다
- `@astrojs/check` 0.9.x 는 TypeScript 5 · 6 만 지원한다 → TypeScript 6.0.3 고정 (7.x 금지)
- **npm 명령은 쓰지 않는다.** npm 은 `devEngines` 를 검사해 시스템 Node(22.14)에서 `EBADDEVENGINES` 로 실패한다. 항상 pnpm
- 코드 스타일은 `.prettierrc` (4칸 · 작은따옴표 · 120자, YAML 은 2칸). `pnpm format` 으로 맞춘다. Markdown 은 포맷 대상에서 뺐다

## 단계

M0 뼈대 · 배포 → M1 동기화 파일럿 → M2 화면 → M3 전체 + 공개 점검 → M4 마감 (design.md 13장)

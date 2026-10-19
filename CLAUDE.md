# CLAUDE.md

노션 포트폴리오를 정적 사이트(https://06171002.github.io/)로 옮기는 개인 리포. 설계 정본은 [docs/design.md](docs/design.md).

## 지켜야 할 것

- **공개 리포다.** 비공개 자료(노션 토큰, 노션 ID 매핑, 치환표, 공개 전 점검 목록)는 리포 밖 `../portfolio-private/` (`C:\dev\portfolio-private\`)에만 둔다. `.gitignore` 는 2차 안전장치일 뿐이다
- 회사 고유명사 · 내부 식별자 · 보안 상세 · 회사 코드 원문은 공개 전에 일반화하거나 뺀다 (design.md 6.5). 이 리포의 어떤 파일에도 숨길 고유명사를 적지 않는다
- **콘텐츠 원본은 노션이다.** M1 이후 `src/content/` 의 Markdown 은 `pnpm sync` 결과물이다. 손으로 고치지 말고 노션을 고친 뒤 다시 동기화한다
- 노션 토큰은 사용자가 직접 넣는다. 토큰 값을 읽거나 출력하거나 옮기지 않는다
- 커밋 · push 는 사용자가 요청할 때만 한다

## 명령어

- `pnpm dev` — 개발 서버 (4321)
- `pnpm build` — `astro check` + `astro build`
- `pnpm preview` — 빌드 결과 미리보기

## 환경

- Astro 7.4.0 은 Node 22.22 이상이 필요하다. 시스템 Node 는 그대로 두고, `package.json` 의 `devEngines.runtime` 으로 pnpm 이 Node 24.22.0 을 내려받아 스크립트에 쓴다
- `@astrojs/check` 0.9.x 는 TypeScript 5 · 6 만 지원한다 → TypeScript 6.0.3 고정 (7.x 금지)
- **npm 명령은 쓰지 않는다.** npm 은 `devEngines` 를 검사해 시스템 Node(22.14)에서 `EBADDEVENGINES` 로 실패한다. 항상 pnpm
- 코드 스타일은 `.prettierrc` (4칸 · 작은따옴표 · 120자, YAML 은 2칸). `pnpm format` 으로 맞춘다. Markdown 은 포맷 대상에서 뺐다

## 단계

M0 뼈대 · 배포 → M1 동기화 파일럿 → M2 화면 → M3 전체 + 공개 점검 → M4 마감 (design.md 13장)

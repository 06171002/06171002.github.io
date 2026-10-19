// @ts-check
import { defineConfig } from 'astro/config';
import fontSubset from './src/integrations/font-subset.ts';

// <username>.github.io 리포라 루트 주소로 배포된다 → base 설정 불필요
// Markdown 은 Astro 7 기본 처리기(Sätteri)를 그대로 쓴다. 동기화 Markdown 의 콜아웃 등은 원시 HTML 블록이라 플러그인이 필요 없다
export default defineConfig({
    site: 'https://06171002.github.io',
    // CSS 를 페이지에 인라인으로 넣는다 — 외부 CSS 한 벌이 모바일 첫 화면을 약 1.9초 막았다(Lighthouse, 2026-10-19).
    // 늘어나는 양은 페이지당 gzip 약 4KB 다
    build: { inlineStylesheets: 'always' },
    integrations: [fontSubset()],
    markdown: {
        shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
    },
});

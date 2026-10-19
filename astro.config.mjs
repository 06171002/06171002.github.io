// @ts-check
import { defineConfig } from 'astro/config';

// <username>.github.io 리포라 루트 주소로 배포된다 → base 설정 불필요
// Markdown 은 Astro 7 기본 처리기(Sätteri)를 그대로 쓴다. 동기화 Markdown 의 콜아웃 등은 원시 HTML 블록이라 플러그인이 필요 없다
export default defineConfig({
    site: 'https://06171002.github.io',
    markdown: {
        shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
    },
});

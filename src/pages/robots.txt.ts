// 모든 페이지 수집 허용 + 사이트맵 위치 (docs/design.md 10장)
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) =>
    new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site)}\n`, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

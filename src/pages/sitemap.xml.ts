// 검색 엔진용 페이지 목록 (docs/design.md 10장). 카드는 기준일을 lastmod 로, 홈 · 프로젝트는 그 안 카드 중 가장 최근 기준일
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { projectKeys } from '../data/projects';

export const GET: APIRoute = async ({ site }) => {
    const entries = (await getCollection('features')).filter((entry) => !entry.data.draft);
    const day = (date: Date) => date.toISOString().slice(0, 10);
    const latest = (items: typeof entries) =>
        day(new Date(Math.max(...items.map((entry) => entry.data.notionEditedAt.getTime()))));

    const urls: { path: string; lastmod?: string }[] = [
        { path: '/', lastmod: entries.length ? latest(entries) : undefined },
    ];
    for (const key of projectKeys) {
        const cards = entries.filter((entry) => entry.data.project === key).sort((a, b) => a.data.order - b.data.order);
        if (cards.length === 0) continue;
        urls.push({ path: `/${key}/`, lastmod: latest(cards) });
        for (const card of cards) urls.push({ path: `/${key}/${card.id}/`, lastmod: day(card.data.notionEditedAt) });
    }

    const body = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map(
            ({ path, lastmod }) =>
                `  <url><loc>${new URL(path, site)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
        ),
        '</urlset>',
        '',
    ].join('\n');
    return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};

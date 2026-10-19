// 페이지마다 공유 미리보기 이미지를 만든다 → /og/index.png · /og/{project}.png · /og/{project}/{slug}.png
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { profile } from '../../data/profile';
import { projectKeys, projects } from '../../data/projects';
import { renderOg, type OgInput } from '../../lib/og';

export const getStaticPaths = (async () => {
    const entries = await getCollection('features');
    const home: OgInput = {
        kind: 'home',
        eyebrow: `${profile.role} · 포트폴리오`,
        name: profile.name,
        tagline: profile.tagline,
    };
    const pages: { params: { path: string }; props: { input: OgInput } }[] = [
        { params: { path: 'index' }, props: { input: home } },
    ];
    for (const key of projectKeys) {
        const cards = entries.filter((entry) => entry.data.project === key);
        if (cards.length === 0) continue;
        const project = projects[key];
        pages.push({
            params: { path: key },
            props: {
                input: {
                    kind: 'project',
                    eyebrow: `프로젝트 · 담당 기능 ${cards.length}`,
                    name: project.name,
                    summary: project.summary,
                    tone: key,
                },
            },
        });
    }
    for (const entry of entries) {
        const project = projects[entry.data.project];
        pages.push({
            params: { path: `${entry.data.project}/${entry.id}` },
            props: {
                input: {
                    kind: 'card',
                    eyebrow: [project.name, entry.data.domain].filter(Boolean).join(' · '),
                    title: entry.data.title,
                    keywords: entry.data.keywords.slice(0, 4),
                    tone: entry.data.project,
                },
            },
        });
    }
    return pages;
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) =>
    new Response(new Uint8Array(renderOg((props as { input: OgInput }).input)), {
        headers: { 'Content-Type': 'image/png' },
    });

// pnpm diagrams [slug …] — 저장된 다이어그램 원문(diagram-N.mmd)을 노션 없이 다시 그린다. 테마(diagrams.ts)를 바꿨을 때 쓴다
// 동기화(index.ts)와 같은 함수 · 같은 svgId(`${slug}-${name}-${theme}`) · 같은 파일 이름이라, 다음 동기화와 결과가 같다
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { openBrowser, renderDiagram } from './diagrams.ts';
import { repoRoot } from './env.ts';

const only = new Set(process.argv.slice(2).filter((arg) => !arg.startsWith('--')));
// 공개 카드와 초안 카드 (index.ts 의 outputDirs 와 같은 자리)
const roots = [
    { content: path.join(repoRoot, 'src/content/features'), assets: path.join(repoRoot, 'public/content-assets') },
    {
        content: path.join(repoRoot, 'src/content/drafts/features'),
        assets: path.join(repoRoot, 'public/content-assets/drafts'),
    },
];

interface Job {
    slug: string;
    name: string;
    source: string;
    assets: string;
}

const jobs: Job[] = [];
for (const root of roots) {
    if (!existsSync(root.content)) continue;
    for (const project of readdirSync(root.content)) {
        for (const slug of readdirSync(path.join(root.content, project))) {
            if (only.size > 0 && !only.has(slug)) continue;
            const dir = path.join(root.content, project, slug);
            for (const file of readdirSync(dir).filter((name) => /^diagram-\d+\.mmd$/.test(name))) {
                jobs.push({
                    slug,
                    name: file.replace(/\.mmd$/, ''),
                    source: readFileSync(path.join(dir, file), 'utf8'),
                    assets: path.join(root.assets, project, slug),
                });
            }
        }
    }
}

const browser = await openBrowser();
try {
    for (const job of jobs) {
        for (const theme of ['default', 'dark'] as const) {
            const svg = await renderDiagram(browser, job.source, theme, `${job.slug}-${job.name}-${theme}`);
            const file = `${job.name}.${theme === 'dark' ? 'dark' : 'light'}.svg`;
            writeFileSync(path.join(job.assets, file), svg, 'utf8');
        }
    }
} finally {
    await browser.close();
}
console.log(`다이어그램 ${jobs.length}개 · SVG ${jobs.length * 2}개를 다시 그렸다`);

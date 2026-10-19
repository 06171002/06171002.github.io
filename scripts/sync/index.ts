// pnpm sync [slug ...] [--dry-run | --check]
//   --dry-run  변환 · 가드만 하고 파일은 쓰지 않는다
//   --check    공개 기준으로 가드를 돌려 본다 (초안도 차단 규칙 적용, 파일은 쓰지 않음) — publish: true 로 바꾸기 전에
// 노션 → Markdown 스냅샷 동기화 (docs/design.md 6장). 노션 토큰 값은 어디에도 출력하지 않는다

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { PageObjectResponse } from '@notionhq/client';
import type { Browser } from 'puppeteer';
import { features } from '../../sync.config.ts';
import type { FeatureEntry } from '../../sync.config.ts';
import { convertPage } from './convert.ts';
import { openBrowser, renderDiagram } from './diagrams.ts';
import { readPrivateEnv, repoRoot } from './env.ts';
import { scan, summarize } from './guard.ts';
import { frontmatter, serialize } from './markdown.ts';
import { createNotion, fetchBlockTree, fetchPage } from './notion.ts';
import { loadPrivateConfig } from './private-config.ts';
import { createRedactor } from './redact.ts';
import type { Redactor } from './redact.ts';

type Properties = PageObjectResponse['properties'];
type Outcome = 'written' | 'checked' | 'blocked';

const args = process.argv.slice(2);
const strictCheck = args.includes('--check');
const dryRun = args.includes('--dry-run') || strictCheck;
const onlySlugs = args.filter((arg) => !arg.startsWith('--'));

function normalizeId(id: string): string {
    return id.replace(/-/g, '').toLowerCase();
}

function titleProp(properties: Properties): string {
    for (const value of Object.values(properties)) {
        if (value.type === 'title') return value.title.map((item) => item.plain_text).join('');
    }
    return '';
}

function selectProp(properties: Properties, name: string): string | null {
    const value = properties[name];
    return value?.type === 'select' ? (value.select?.name ?? null) : null;
}

function numberProp(properties: Properties, name: string): number | null {
    const value = properties[name];
    return value?.type === 'number' ? value.number : null;
}

function textProp(properties: Properties, name: string): string {
    const value = properties[name];
    return value?.type === 'rich_text' ? value.rich_text.map((item) => item.plain_text).join('') : '';
}

interface Cover {
    ext: string;
    bytes: Buffer;
    /** SVG 면 가드 검사용 텍스트 */
    text: string | null;
}

/** 노션 커버를 바로 내려받는다 — 노션 업로드 파일의 서명 URL 은 곧 만료된다 */
async function downloadCover(page: PageObjectResponse): Promise<Cover | null> {
    const cover = page.cover;
    if (!cover) return null;
    const url = cover.type === 'external' ? cover.external.url : cover.type === 'file' ? cover.file.url : null;
    if (!url) return null;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`커버를 내려받지 못했습니다 (HTTP ${response.status})`);
    const type = response.headers.get('content-type') ?? '';
    const fromPath = new URL(url).pathname.split('.').pop()?.toLowerCase() ?? 'bin';
    const ext = type.includes('svg')
        ? 'svg'
        : type.includes('png')
          ? 'png'
          : type.includes('webp')
            ? 'webp'
            : type.includes('jpeg')
              ? 'jpg'
              : fromPath;
    const bytes = Buffer.from(await response.arrayBuffer());
    return { ext, bytes, text: ext === 'svg' ? bytes.toString('utf8') : null };
}

function featureFrontmatter(
    entry: FeatureEntry,
    page: PageObjectResponse,
    redact: Redactor,
    cover: string | null
): Record<string, unknown> {
    const properties = page.properties;
    const keywords = redact(textProp(properties, '핵심 키워드'))
        .split(/[·,]/)
        .map((keyword) => keyword.trim())
        .filter(Boolean);
    return {
        title: redact(titleProp(properties)).trim(),
        slug: entry.slug,
        project: entry.project,
        order: entry.order,
        domain: selectProp(properties, '도메인'),
        apiCount: numberProp(properties, 'API 수'),
        tableCount: numberProp(properties, '테이블 수'),
        keywords,
        evidence: entry.evidence,
        draft: !entry.publish,
        cover,
        notionEditedAt: page.last_edited_time,
    };
}

function outputDirs(entry: FeatureEntry, publish: boolean) {
    const assetsRel = `content-assets/${publish ? '' : 'drafts/'}${entry.project}/${entry.slug}`;
    return {
        content: path.join(
            repoRoot,
            'src',
            'content',
            publish ? 'features' : 'drafts/features',
            entry.project,
            entry.slug
        ),
        assets: path.join(repoRoot, 'public', assetsRel),
        assetsUrl: `/${assetsRel}`,
    };
}

async function main(): Promise<void> {
    const token = readPrivateEnv('NOTION_TOKEN');
    if (!token) throw new Error('비공개 .env 에 NOTION_TOKEN 이 비어 있습니다');
    const config = loadPrivateConfig();
    const redact = createRedactor(config.redact);
    const denylist = [...config.denylist, ...config.redact.flatMap((rule) => (rule.find ? [rule.find] : []))];
    const notion = createNotion(token);

    const targets = features.filter((entry) => onlySlugs.length === 0 || onlySlugs.includes(entry.slug));
    const unknown = onlySlugs.filter((slug) => !features.some((entry) => entry.slug === slug));
    if (unknown.length > 0) throw new Error(`sync.config.ts 허용 목록에 없는 slug: ${unknown.join(', ')}`);

    // 노션 페이지 ID → 사이트 경로 (허용 목록에 있는 카드끼리만 서로 링크된다)
    const pathByPageId = new Map<string, string>();
    for (const entry of features) {
        const id = config.notion.features[entry.slug];
        if (id) pathByPageId.set(normalizeId(id), `/${entry.project}/${entry.slug}/`);
    }
    const resolvePage = (pageId: string) => pathByPageId.get(normalizeId(pageId)) ?? null;

    async function syncOne(entry: FeatureEntry, browser: Browser | null): Promise<Outcome> {
        // 공개 카드이거나 --check 면 가드에 걸릴 때 차단한다
        const strict = entry.publish || strictCheck;
        const pageId = config.notion.features[entry.slug];
        if (!pageId) throw new Error(`sync.local.json 에 ${entry.slug} 의 노션 페이지 ID 가 없습니다`);

        const started = Date.now();
        const page = await fetchPage(notion, pageId);
        const blocks = await fetchBlockTree(notion, pageId);
        const dirs = outputDirs(entry, entry.publish);
        const result = convertPage(blocks, { redact, resolvePage, assetsBase: dirs.assetsUrl });
        const cover = await downloadCover(page);
        const coverUrl = cover ? `${dirs.assetsUrl}/cover.${cover.ext}` : null;
        const markdown = frontmatter(featureFrontmatter(entry, page, redact, coverUrl)) + serialize(result.root);

        const hits = [
            ...scan(markdown, denylist),
            ...result.diagrams.flatMap((diagram) => scan(diagram.source, denylist)),
            ...(cover?.text ? scan(cover.text, denylist).map((hit) => ({ ...hit, rule: `커버 SVG ${hit.rule}` })) : []),
        ];
        const seconds = ((Date.now() - started) / 1000).toFixed(1);
        console.log(`    블록 변환 ${seconds}초 · 다이어그램 ${result.diagrams.length}개`);
        for (const item of result.excluded) console.log(`    [비공개] 제외: ${item}`);
        if (cover && !cover.text) {
            console.log(`    ⚠ 커버가 ${cover.ext} 이미지라 글자 검사를 못 합니다 — 눈으로 확인하세요`);
        }

        if (hits.length > 0) {
            const prefix = strict ? '    ✗ 가드 차단' : '    ⚠ 가드 경고(초안이라 쓰기는 진행)';
            for (const line of summarize(hits)) console.log(`${prefix} — ${line}`);
            if (strict) return 'blocked';
        } else if (strictCheck) {
            // 가드는 문자열 패턴만 본다. 회사 코드 발췌 · 결함 서술 같은 내용 항목은 공개 점검 목록으로 따로 확인한다
            console.log('    ✓ 가드 통과 — 남은 건 공개 점검 목록의 내용 항목(회사 코드 · 결함 서술 등) 확인');
        }
        if (dryRun || !browser) return 'checked';

        // 공개 ↔ 초안을 오가도 옛 산출물이 남지 않게 두 위치를 모두 지운다
        for (const dir of [outputDirs(entry, true), outputDirs(entry, false)]) {
            rmSync(dir.content, { recursive: true, force: true });
            rmSync(dir.assets, { recursive: true, force: true });
        }
        mkdirSync(dirs.content, { recursive: true });
        writeFileSync(path.join(dirs.content, 'index.md'), markdown, 'utf8');
        if (result.diagrams.length > 0 || cover) mkdirSync(dirs.assets, { recursive: true });
        for (const diagram of result.diagrams) {
            // 원문은 콘텐츠 폴더에 둔다 — 커밋되어 diff 로 그림 변경을 읽을 수 있고, 배포(public)에는 나가지 않는다
            writeFileSync(path.join(dirs.content, `${diagram.name}.mmd`), diagram.source, 'utf8');
            for (const theme of ['default', 'dark'] as const) {
                const svg = await renderDiagram(
                    browser,
                    diagram.source,
                    theme,
                    `${entry.slug}-${diagram.name}-${theme}`
                );
                const file = `${diagram.name}.${theme === 'dark' ? 'dark' : 'light'}.svg`;
                writeFileSync(path.join(dirs.assets, file), svg, 'utf8');
            }
        }
        if (cover) writeFileSync(path.join(dirs.assets, `cover.${cover.ext}`), cover.bytes);
        console.log(`    → ${path.relative(repoRoot, path.join(dirs.content, 'index.md'))}`);
        return 'written';
    }

    const mode = strictCheck ? ' (공개 기준 점검: 파일을 쓰지 않음)' : dryRun ? ' (dry-run: 파일을 쓰지 않음)' : '';
    console.log(`노션 동기화${mode} — ${targets.length}장\n`);
    const browser = dryRun ? null : await openBrowser();
    let blocked = 0;
    let failed = 0;
    try {
        for (const entry of targets) {
            console.log(`• ${entry.project}/${entry.slug} ${entry.publish ? '[공개]' : '[초안]'}`);
            try {
                if ((await syncOne(entry, browser)) === 'blocked') blocked += 1;
            } catch (error) {
                // 한 장이 실패해도 나머지는 계속한다
                failed += 1;
                console.log(`    ✗ 실패 — ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    } finally {
        await browser?.close();
    }

    if (failed > 0) {
        console.error(`\n${failed}장이 실패했습니다. 위의 실패 사유를 확인하세요`);
        process.exit(1);
    }
    if (blocked > 0) {
        console.error(`\n${blocked}장이 가드에 막혔습니다. 노션 원문을 고치거나 치환표에 추가한 뒤 다시 실행하세요`);
        process.exit(2);
    }
    console.log('\n완료');
}

main().catch((error: unknown) => {
    console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});

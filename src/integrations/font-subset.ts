// 본문 글꼴 Pretendard 를 사이트에 실제로 쓰인 글자만 남긴 가변 글꼴 한 벌로 만든다 (docs/design.md 11장)
// 패키지의 동적 서브셋은 긴 카드 하나에 woff2 를 26개(약 700KB) 불러 모바일 첫 화면을 늦췄다.
// 빌드가 끝나면 dist 의 HTML 에서 글자를 모아 서브셋을 쓰고, 개발 서버는 같은 주소로 원본(약 2MB)을 내준다
import type { AstroIntegration } from 'astro';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

/** src/styles/global.css 의 @font-face 가 가리키는 주소 */
const FONT_PATH = '/fonts/pretendard.woff2';

// 브라우저가 기본으로 켜는 기능만 남긴다 — ss · cv · tnum 같은 대체 글리프를 빼면 약 14% 작아진다.
// CSS 에서 font-variant-* · font-feature-settings 로 다른 기능을 켜게 되면 여기에 더한다
const FEATURES = ['ccmp', 'locl', 'rlig', 'calt', 'clig', 'liga', 'kern', 'mark', 'mkmk', 'rvrn'];

const require = createRequire(join(process.cwd(), 'package.json'));
const SOURCE = require.resolve('pretendard/dist/web/variable/woff2/PretendardVariable.woff2');

export default function fontSubset(): AstroIntegration {
    return {
        name: 'font-subset',
        hooks: {
            'astro:server:setup': ({ server }) => {
                server.middlewares.use(FONT_PATH, (_req, res, next) => {
                    readFile(SOURCE).then((font) => {
                        res.setHeader('Content-Type', 'font/woff2');
                        res.end(font);
                    }, next);
                });
            },
            'astro:build:done': async ({ dir, logger }) => {
                const root = fileURLToPath(dir);
                const chars = await collectChars(root);
                const font = await subsetFont(await readFile(SOURCE), [...chars].join(''), {
                    targetFormat: 'woff2',
                    keepFeatures: FEATURES,
                });
                const out = join(root, FONT_PATH);
                await mkdir(dirname(out), { recursive: true });
                await writeFile(out, font);
                logger.info(`Pretendard 서브셋 — 글자 ${chars.size}개 · ${Math.round(font.length / 1024)}KB`);
            },
        },
    };
}

/** 출력 가능한 ASCII 전부 + 빌드한 HTML · JS 에 나오는 그 밖의 글자. 코드 블록은 고정폭 글꼴로 찍히므로 뺀다 */
async function collectChars(root: string): Promise<Set<string>> {
    const chars = new Set<string>();
    for (let code = 0x20; code < 0x7f; code++) chars.add(String.fromCharCode(code));
    for (const file of await readdir(root, { recursive: true })) {
        if (!/\.(html|js)$/.test(file)) continue;
        const text = (await readFile(join(root, file), 'utf8')).replace(/<pre\b[\s\S]*?<\/pre>/g, '');
        for (const char of text) if (char.codePointAt(0)! > 0x7e) chars.add(char);
    }
    return chars;
}

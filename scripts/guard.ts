// pnpm guard [폴더]          CI 2차 가드 — 배포할 빌드 결과(기본 dist/)를 공개 규칙 · 비공개 금지어로 검사한다 (docs/design.md 6.6)
// pnpm guard --secret-file   Actions 시크릿 PORTFOLIO_DENYLIST 에 넣을 값을 비공개 폴더의 ci-secret.env 로 쓴다
//
// 금지어는 환경변수 PORTFOLIO_DENYLIST(CI 시크릿)에서, 없으면 로컬 비공개 폴더의 sync.local.json 에서 읽는다 —
// 동기화 1차 가드와 같은 목록(denylist 다음에 치환표의 find). 금지어는 어디에도 출력하지 않는다: 건수 · 파일 · 규칙 · 번호만

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { publicPatterns } from '../guard.config.ts';
import { privateDir, repoRoot } from './sync/env.ts';
import { scan } from './sync/guard.ts';
import { loadPrivateConfig } from './sync/private-config.ts';

const SECRET_NAME = 'PORTFOLIO_DENYLIST';
const SECRET_FILE = 'ci-secret.env';
const inCI = process.env.GITHUB_ACTIONS === 'true';

// 파일 종류. 모르는 확장자는 건너뛰지 않고 실패시킨다 — 조용히 빠뜨리지 않는다
/** 보이는 글자를 뽑아 공개 규칙까지 검사 */
const MARKUP = new Set(['.html', '.htm', '.svg']);
/** 금지어만 — 주소 목록 · 코드라 공개 규칙(파일 이름 · 식별자)은 오탐만 난다 */
const PLAIN = new Set(['.txt', '.xml', '.css', '.js', '.mjs', '.json', '.webmanifest', '.md']);
/** 확장자 없는 텍스트 파일 (커스텀 도메인을 붙이면 CNAME 이 생긴다 — docs/design.md 10장) */
const PLAIN_NAMES = new Set(['CNAME', '.nojekyll']);
/** 글자 검사를 하지 않는다 — 무작위 바이트에서 우연 일치 오탐만 난다 (잠금 파일 해시와 같은 이유) */
const BINARY = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf']);

interface Term {
    /** fold() 한 금지어 — 출력하지 않는다 */
    needle: string;
    /** 출력용 번호 */
    label: string;
}

interface FileReport {
    file: string;
    /** 금지어 번호 → 건수 · 자리(본문인지, 주소 · 속성 · 코드에만 있는지) */
    denied: Map<string, { count: number; inText: boolean }>;
    /** 공개 규칙 이름 → 걸린 표현 */
    patterns: Map<string, string[]>;
}

// ── 금지어 ──────────────────────────────────────────────

/** 대소문자 · 전각/반각 · 공백 변형을 하나로 접는다. 줄바꿈이나 태그 경계로 갈린 표기도 한 칸 공백이 된다 */
function fold(text: string): string {
    return text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
}

/** 시크릿 값은 금지어 배열 JSON 의 base64 한 줄이다 — dotenv 파일로 그대로 등록되고, 로그 가림이 낱말 단위로 갈리지 않는다 */
function encodeSecret(list: string[]): string {
    return Buffer.from(JSON.stringify(list), 'utf8').toString('base64');
}

function decodeSecret(value: string): string[] {
    let parsed: unknown = null;
    try {
        parsed = JSON.parse(Buffer.from(value.trim(), 'base64').toString('utf8'));
    } catch {
        // 아래에서 형식 오류로 알린다. 값은 출력하지 않는다
    }
    if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
        throw new Error(`${SECRET_NAME} 형식이 맞지 않습니다 — pnpm guard --secret-file 로 만든 값을 등록하세요`);
    }
    return parsed;
}

/** 동기화 1차 가드(scripts/sync/index.ts)와 같은 목록 · 순서: denylist 다음에 치환표의 find */
function localList(): { list: string[]; labels: string[] } {
    let config: ReturnType<typeof loadPrivateConfig>;
    try {
        config = loadPrivateConfig();
    } catch (error) {
        // JSON 문법 오류 메시지는 원문 일부를 인용한다 — 비공개 파일 내용이 화면에 나가지 않게 바꿔 말한다
        if (error instanceof SyntaxError) throw new Error('sync.local.json 의 JSON 형식이 맞지 않습니다');
        throw error;
    }
    const list: string[] = [];
    const labels: string[] = [];
    config.denylist.forEach((term, index) => {
        list.push(term);
        labels.push(`denylist ${index + 1}번째`);
    });
    config.redact.forEach((rule, index) => {
        if (!rule.find) return;
        list.push(rule.find);
        labels.push(`치환표 ${index + 1}번째`);
    });
    return { list, labels };
}

/** 번호(#n)는 시크릿 목록의 순서다. 로컬에서는 sync.local.json 의 어디인지도 붙인다 */
function toTerms(list: string[], labels: string[] = []): Term[] {
    return list.flatMap((term, index) => {
        const needle = fold(term).trim();
        if (!needle) return [];
        const where = labels[index];
        return [{ needle, label: where ? `#${index + 1}(${where})` : `#${index + 1}` }];
    });
}

/** 금지어 목록. 없거나 비어 있으면 null */
function loadTerms(): { terms: Term[]; origin: string } | null {
    const secret = process.env[SECRET_NAME]?.trim();
    let loaded: { terms: Term[]; origin: string } | null = null;
    if (secret) {
        loaded = { terms: toTerms(decodeSecret(secret)), origin: '시크릿' };
    } else if (!inCI) {
        // CI 에는 비공개 폴더가 없다
        const { list, labels } = localList();
        loaded = { terms: toTerms(list, labels), origin: '로컬 비공개 설정' };
    }
    return loaded && loaded.terms.length > 0 ? loaded : null;
}

function occurrences(haystack: string, needle: string): number {
    let count = 0;
    for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) count += 1;
    return count;
}

function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** 출력할 글자(파일 경로 · 걸린 표현)에 금지어가 섞여 있으면 가린다 */
function safe(text: string, terms: Term[]): string {
    let out = text;
    for (const { needle } of terms) out = out.replace(new RegExp(escapeRegExp(needle), 'gi'), '***');
    const folded = fold(out);
    return terms.some(({ needle }) => folded.includes(needle)) ? '(금지어가 섞여 표시하지 않음)' : out;
}

// ── HTML · SVG 에서 읽는 글자 뽑기 ─────────────────────

/** 앞뒤 글자와 이어 붙는 태그. 나머지 태그 경계는 줄바꿈으로 본다 */
const INLINE_TAGS = new Set([
    'a',
    'abbr',
    'b',
    'bdi',
    'bdo',
    'cite',
    'data',
    'del',
    'dfn',
    'em',
    'i',
    'ins',
    'kbd',
    'mark',
    'q',
    's',
    'samp',
    'small',
    'span',
    'strong',
    'sub',
    'sup',
    'time',
    'u',
    'var',
    'wbr',
]);
/** 화면 · 검색 · 공유에 글자로 나가는 속성 */
const TEXT_ATTRIBUTES = new Set(['alt', 'title', 'aria-label', 'aria-description', 'placeholder', 'label', 'content']);
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text: string): string {
    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (whole, ref: string) => {
        if (!ref.startsWith('#')) return ENTITIES[ref.toLowerCase()] ?? whole;
        const code = /^#x/i.test(ref) ? parseInt(ref.slice(2), 16) : parseInt(ref.slice(1), 10);
        return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    });
}

function percentDecode(text: string): string {
    return text.replace(/(?:%[0-9a-f]{2})+/gi, (run) => {
        try {
            return decodeURIComponent(run);
        } catch {
            return run;
        }
    });
}

function separator(tag: string, attributes: string): string {
    // Mermaid 라벨: 줄마다 위치(x · dy)를 새로 잡는 tspan, 그 안의 낱말 tspan 은 앞 공백을 품고 있다
    if (tag === 'tspan') return /\s(?:x|y|dx|dy)\s*=/i.test(attributes) ? ' ' : '';
    // Markdown 의 `코드` 처럼 낱말 경계
    if (tag === 'code') return ' ';
    return INLINE_TAGS.has(tag) ? '' : '\n';
}

function attributeTexts(attributes: string): string[] {
    const values: string[] = [];
    for (const match of attributes.matchAll(/([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
        const value = match[2] ?? match[3] ?? match[4];
        if (value && TEXT_ATTRIBUTES.has((match[1] ?? '').toLowerCase())) values.push(decodeEntities(value));
    }
    return values;
}

function jsonStrings(body: string): string[] {
    const strings: string[] = [];
    const visit = (value: unknown): void => {
        if (typeof value === 'string') strings.push(value);
        else if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value === 'object') Object.values(value).forEach(visit);
    };
    try {
        visit(JSON.parse(body));
    } catch {
        return [body];
    }
    return strings;
}

/** 글자 노드 + 대체 텍스트 · 메타 설명 · JSON-LD 의 값. 스크립트 · 스타일 · 주석은 빼고, 태그 경계는 붙이거나 줄을 바꾼다 */
function readableText(markup: string): string {
    const out: string[] = [];
    const token =
        /<!--[\s\S]*?-->|<(script|style)\b((?:[^>"']|"[^"]*"|'[^']*')*)>([\s\S]*?)<\/\1\s*>|<\/?([a-z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|<!\[CDATA\[([\s\S]*?)\]\]>|<[!?][^>]*>|[^<]+|</gi;
    for (const match of markup.matchAll(token)) {
        const [whole, codeTag, codeAttributes, codeBody, tag, attributes, cdata] = match;
        if (codeTag) {
            const jsonLd = /type\s*=\s*["']?application\/ld\+json/i.test(codeAttributes ?? '');
            if (codeTag.toLowerCase() === 'script' && jsonLd)
                out.push('\n', jsonStrings(codeBody ?? '').join('\n'), '\n');
        } else if (tag) {
            out.push(separator(tag.toLowerCase(), attributes ?? ''));
            const values = attributeTexts(attributes ?? '');
            if (values.length > 0) out.push('\n', values.join('\n'), '\n');
        } else if (cdata !== undefined) {
            out.push(cdata);
        } else if (whole.startsWith('<') && whole.length > 1) {
            // 주석 · DOCTYPE · 처리 지시
            out.push('\n');
        } else {
            out.push(decodeEntities(whole));
        }
    }
    return out.join('');
}

// ── 검사 ────────────────────────────────────────────────

function listFiles(root: string): string[] {
    const files: string[] = [];
    const odd: string[] = [];
    for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
        const full = path.join(entry.parentPath, entry.name);
        if (entry.isFile()) files.push(full);
        else if (!entry.isDirectory()) odd.push(full);
    }
    if (odd.length > 0) {
        throw new Error(`파일도 폴더도 아닌 항목(링크 등)은 검사하지 못합니다: ${odd.length}개`);
    }
    return files.sort();
}

function inspect(file: string, rel: string, kind: 'markup' | 'plain', terms: Term[]): FileReport {
    const content = readFileSync(file, 'utf8');
    const text = kind === 'markup' ? readableText(content) : null;
    const report: FileReport = { file: rel, denied: new Map(), patterns: new Map() };

    // 금지어: 원문 그대로(주소 · 속성 · 스크립트 · 스타일까지)와 읽는 글자 양쪽에서 세어 많은 쪽
    const raw = fold(decodeEntities(percentDecode(content)));
    const readable = text === null ? null : fold(text);
    for (const term of terms) {
        const inText = readable === null ? 0 : occurrences(readable, term.needle);
        const count = Math.max(occurrences(raw, term.needle), inText);
        if (count > 0) report.denied.set(term.label, { count, inText: text === null || inText > 0 });
    }

    // 공개 규칙: 1차 가드와 같은 scan(guard.config.ts) 을 읽는 글자에 — 금지어는 위에서 따로 봤다
    if (text !== null) {
        for (const hit of scan(text, [])) {
            report.patterns.set(hit.rule, [...(report.patterns.get(hit.rule) ?? []), hit.match]);
        }
    }
    return report;
}

function main(): number {
    const args = process.argv.slice(2);
    if (args.includes('--secret-file')) return writeSecretFile();

    const target = path.resolve(args.find((arg) => !arg.startsWith('--')) ?? path.join(repoRoot, 'dist'));
    if (!existsSync(path.join(target, 'index.html'))) {
        // 아티팩트를 잘못 풀었을 때 빈 폴더를 통과시키지 않는다
        throw new Error(`검사할 빌드 결과가 없습니다(index.html 없음): ${target} — 먼저 pnpm build`);
    }

    // 금지어 목록이 없거나 비면 배포를 막는다 (2026-11-09 결정) — 금지어 검사 없이 나가는 배포를 만들지 않는다.
    // 그래서 시크릿을 지우거나 이름을 바꾸면 모든 배포가 멈춘다: 시크릿을 먼저 바꾸고 워크플로를 바꾼다
    const deny = loadTerms();
    if (!deny) {
        report(
            'error',
            `금지어 목록이 없습니다(시크릿 ${SECRET_NAME} 이 없거나 비었음) — 금지어 검사 없이는 배포하지 않습니다. 등록: pnpm guard --secret-file 뒤 gh secret set -f`
        );
        return 1;
    }
    const terms = deny.terms;

    const counts = { markup: 0, plain: 0, binary: 0 };
    const unknown = new Map<string, number>();
    const reports: FileReport[] = [];
    for (const file of listFiles(target)) {
        const rel = path.relative(target, file).split(path.sep).join('/');
        const ext = path.extname(file).toLowerCase();
        if (BINARY.has(ext)) {
            counts.binary += 1;
            continue;
        }
        const kind = MARKUP.has(ext)
            ? 'markup'
            : PLAIN.has(ext) || PLAIN_NAMES.has(path.basename(file))
              ? 'plain'
              : null;
        if (!kind) {
            unknown.set(ext || '(확장자 없음)', (unknown.get(ext || '(확장자 없음)') ?? 0) + 1);
            continue;
        }
        counts[kind] += 1;
        const result = inspect(file, rel, kind, terms);
        if (result.denied.size > 0 || result.patterns.size > 0) reports.push(result);
    }

    console.log(`2차 가드 — 금지어 ${terms.length}개(${deny.origin}) · 공개 규칙 ${publicPatterns.length}개`);
    console.log(
        `  검사: 페이지 · SVG ${counts.markup}개, 텍스트 ${counts.plain}개 / 글자 검사 제외(이미지 · 글꼴): ${counts.binary}개`
    );
    let deniedTotal = 0;
    let patternTotal = 0;
    for (const result of reports) {
        console.log(`  ✗ ${safe(result.file, terms)}`);
        if (result.denied.size > 0) {
            const entries = [...result.denied];
            const total = entries.reduce((sum, [, hit]) => sum + hit.count, 0);
            deniedTotal += total;
            // 금지어 자체 대신 번호와 자리만 알린다
            const where = entries.map(([label, hit]) =>
                hit.inText ? label : `${label} 마크업(주소 · 속성 · 코드)에만`
            );
            console.log(`      금지어 ${total}건 — ${where.join(' · ')}`);
        }
        for (const [rule, matches] of result.patterns) {
            patternTotal += matches.length;
            const samples = [...new Set(matches.map((match) => safe(match, terms)))];
            console.log(
                `      ${rule} ${matches.length}건: ${samples.slice(0, 4).join(', ')}${samples.length > 4 ? ' …' : ''}`
            );
        }
    }
    if (unknown.size > 0) {
        const list = [...unknown].map(([ext, count]) => `${safe(ext, terms)} ${count}개`).join(', ');
        report(
            'error',
            `처리 방법을 모르는 파일 형식: ${list} — scripts/guard.ts 의 MARKUP · PLAIN · BINARY 에 넣으세요`
        );
    }
    if (reports.length > 0) {
        report(
            'error',
            `가드 차단 — 파일 ${reports.length}개 · 금지어 ${deniedTotal}건 · 공개 규칙 ${patternTotal}건. 배포하지 않습니다`
        );
        return 2;
    }
    if (unknown.size > 0) return 1;
    console.log('✓ 가드 통과 — 0건');
    return 0;
}

/** 마지막 판정. CI 에서는 실행 요약의 주석으로 남긴다 (건수 · 규칙만 — 금지어는 넣지 않는다) */
function report(level: 'error' | 'warning', message: string): void {
    if (inCI) console.log(`::${level} title=2차 가드::${message}`);
    else console.error(`${level === 'error' ? '✗' : '⚠'} ${message}`);
}

/** 시크릿 값을 비공개 폴더에 dotenv 형식으로 쓴다 — gh secret set -f 로 등록. 값은 화면에 내지 않는다 */
function writeSecretFile(): number {
    if (inCI) throw new Error('--secret-file 은 로컬에서만 씁니다');
    const { list } = localList();
    const value = encodeSecret(list);
    if (JSON.stringify(decodeSecret(value)) !== JSON.stringify(list)) {
        throw new Error('시크릿 값을 되읽어 보니 원래 목록과 다릅니다');
    }
    const file = path.join(privateDir, SECRET_FILE);
    writeFileSync(file, `${SECRET_NAME}=${value}\n`, 'utf8');
    console.log(`비공개 폴더에 썼습니다: ${file} (금지어 ${list.length}개)`);
    console.log(`등록 (리포 폴더에서, gh 활성 계정이 리포 주인인지 먼저 확인): gh secret set -f "${file}"`);
    return 0;
}

try {
    process.exitCode = main();
} catch (error) {
    report('error', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}

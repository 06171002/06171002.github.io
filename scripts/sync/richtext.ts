import type { RichTextItemResponse } from '@notionhq/client';
import type { PhrasingContent } from 'mdast';
import type { Redactor } from './redact.ts';

export interface RichTextContext {
    redact: Redactor;
    /** 노션 페이지 ID → 사이트 안 경로. 모르는 페이지면 null — 노션 원문으로는 절대 링크하지 않는다 */
    resolvePage: (pageId: string) => string | null;
}

/** 서식이 같은 텍스트 조각 */
export interface Segment {
    text: string;
    bold: boolean;
    italic: boolean;
    strike: boolean;
    code: boolean;
    color: string;
    href: string | null;
}

const NOTION_HOST = /(^|\.)notion\.(so|site|com)$/i;
const TRAILING_PAGE_ID = /([0-9a-f]{32})$/i;
/** CommonMark 의 구두점 범주 (P · S). 강조 기호 바로 안쪽에 있으면 강조가 깨진다 */
const PUNCT = /[\p{P}\p{S}]/u;

/** 링크 주소를 정리한다. 노션 내부 링크는 사이트 경로로 바꾸거나 링크를 뗀다 */
export function resolveHref(href: string | null, ctx: RichTextContext): string | null {
    if (!href) return null;
    if (href.startsWith('/')) {
        const id = href.replace(/[?#].*$/, '').match(TRAILING_PAGE_ID)?.[1];
        return id ? ctx.resolvePage(id) : null;
    }
    let url: URL;
    try {
        url = new URL(href);
    } catch {
        return null;
    }
    if (NOTION_HOST.test(url.hostname)) {
        const id = url.pathname.match(TRAILING_PAGE_ID)?.[1];
        return id ? ctx.resolvePage(id) : null;
    }
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? href : null;
}

function sameFormat(a: Segment, b: Segment): boolean {
    return (
        a.bold === b.bold &&
        a.italic === b.italic &&
        a.strike === b.strike &&
        a.code === b.code &&
        a.color === b.color &&
        a.href === b.href
    );
}

/** 노션 리치 텍스트 → 서식이 같은 조각끼리 합친 목록. 치환표를 적용한다 */
export function segmentsOf(items: RichTextItemResponse[], ctx: RichTextContext): Segment[] {
    const merged: Segment[] = [];
    for (const item of items) {
        const a = item.annotations;
        let text = item.plain_text;
        let code = a.code;
        let href: string | null = null;
        if (item.type === 'text') {
            href = resolveHref(item.text.link?.url ?? null, ctx);
        } else if (item.type === 'mention') {
            href = item.mention.type === 'page' ? ctx.resolvePage(item.mention.page.id) : resolveHref(item.href, ctx);
        } else {
            text = item.equation.expression;
            code = true;
        }
        const segment: Segment = {
            text,
            bold: a.bold,
            italic: a.italic,
            strike: a.strikethrough,
            code,
            color: a.color,
            href,
        };
        const prev = merged.at(-1);
        if (prev && sameFormat(prev, segment)) {
            prev.text += segment.text;
        } else {
            merged.push(segment);
        }
    }
    for (const segment of merged) {
        segment.text = ctx.redact(segment.text);
    }
    return merged.filter((segment) => segment.text.length > 0);
}

export function plainText(segments: Segment[]): string {
    return segments.map((segment) => segment.text).join('');
}

/** 줄바꿈(\n) 기준으로 조각 목록을 줄 단위로 나눈다 */
export function splitLines(segments: Segment[]): Segment[][] {
    const lines: Segment[][] = [[]];
    for (const segment of segments) {
        segment.text.split('\n').forEach((part, i) => {
            if (i > 0) lines.push([]);
            if (part) lines.at(-1)!.push({ ...segment, text: part });
        });
    }
    return lines;
}

/** 줄 앞에서 글자 n 개를 떼어 낸다 (목록 기호 제거용) */
export function dropPrefix(line: Segment[], count: number): Segment[] {
    let rest = count;
    const out: Segment[] = [];
    for (const segment of line) {
        if (rest >= segment.text.length) {
            rest -= segment.text.length;
            continue;
        }
        out.push({ ...segment, text: segment.text.slice(rest) });
        rest = 0;
    }
    return out;
}

function htmlWrap(open: string, close: string, children: PhrasingContent[]): PhrasingContent[] {
    return [{ type: 'html', value: open }, ...children, { type: 'html', value: close }];
}

function wrapColor(color: string, children: PhrasingContent[]): PhrasingContent[] {
    if (color === 'default') return children;
    if (color.endsWith('_background')) {
        const name = color.replace('_background', '');
        return htmlWrap(`<mark class="bg-${name}">`, '</mark>', children);
    }
    return htmlWrap(`<span class="tc-${color}">`, '</span>', children);
}

function formatted(segment: Segment): PhrasingContent[] {
    if (segment.code) {
        const node: PhrasingContent[] = [{ type: 'inlineCode', value: segment.text }];
        return segment.href ? [{ type: 'link', url: segment.href, children: node }] : node;
    }
    // 강조 기호 안쪽 끝에 공백이 있으면 CommonMark 강조가 깨지므로 공백은 바깥으로 뺀다
    const lead = segment.text.match(/^\s*/)?.[0] ?? '';
    const trail = segment.text.slice(lead.length).match(/\s*$/)?.[0] ?? '';
    const core = segment.text.slice(lead.length, segment.text.length - trail.length);
    if (!core) return [{ type: 'text', value: segment.text }];

    // "따옴표"**로** 처럼 구두점에 붙은 강조는 CommonMark 에서 깨진다 → 그 경우만 HTML 태그로 쓴다
    const chars = [...core];
    const useHtml = PUNCT.test(chars[0]!) || PUNCT.test(chars.at(-1)!);
    let nodes: PhrasingContent[] = [{ type: 'text', value: core }];
    if (segment.strike) nodes = useHtml ? htmlWrap('<del>', '</del>', nodes) : [{ type: 'delete', children: nodes }];
    if (segment.italic) nodes = useHtml ? htmlWrap('<em>', '</em>', nodes) : [{ type: 'emphasis', children: nodes }];
    if (segment.bold)
        nodes = useHtml ? htmlWrap('<strong>', '</strong>', nodes) : [{ type: 'strong', children: nodes }];
    nodes = wrapColor(segment.color, nodes);
    if (segment.href) nodes = [{ type: 'link', url: segment.href, children: nodes }];

    const out: PhrasingContent[] = [];
    if (lead) out.push({ type: 'text', value: lead });
    out.push(...nodes);
    if (trail) out.push({ type: 'text', value: trail });
    return out;
}

/**
 * 조각 목록 → mdast 인라인 노드.
 * lineBreak: 'node' 는 mdast 줄바꿈, 'html' 은 <br> (GFM 표 셀처럼 줄바꿈 노드를 못 쓰는 곳)
 */
export function toPhrasing(segments: Segment[], lineBreak: 'node' | 'html' = 'node'): PhrasingContent[] {
    const out: PhrasingContent[] = [];
    for (const segment of segments) {
        segment.text.split('\n').forEach((part, i) => {
            if (i > 0) out.push(lineBreak === 'node' ? { type: 'break' } : { type: 'html', value: '<br>' });
            if (part) out.push(...formatted({ ...segment, text: part }));
        });
    }
    return out;
}

import type { RichTextItemResponse } from '@notionhq/client';
import type { BlockContent, Html, List, ListItem, Paragraph, PhrasingContent, Root, Table, TableRow } from 'mdast';
import { escapeAttr, phrasingToHtml } from './html.ts';
import type { BlockNode } from './notion.ts';
import { dropPrefix, plainText, segmentsOf, splitLines, toPhrasing } from './richtext.ts';
import type { RichTextContext, Segment } from './richtext.ts';

// 콜아웃 · 토글 · 열 · 표 래퍼 · 다이어그램은 원시 HTML 블록으로 쓴다.
// "<aside …>" + 빈 줄 + Markdown + 빈 줄 + "</aside>" 는 CommonMark 표준이라 어떤 Markdown 처리기에서도 그대로 동작한다
// (Astro 7 기본 처리기 Sätteri 포함 — 별도 플러그인 불필요). docs/design.md 6.2

export interface DiagramRequest {
    name: string;
    source: string;
    alt: string;
    light: string;
    dark: string;
}

export interface ConvertOptions extends RichTextContext {
    /** 이 페이지 자산의 공개 URL 접두사 (예: /content-assets/drafts/b2b/claims) */
    assetsBase: string;
}

export interface ConvertResult {
    root: Root;
    diagrams: DiagramRequest[];
    /** [비공개] 표시로 뺀 블록 (보고용) */
    excluded: string[];
}

interface State {
    options: ConvertOptions;
    diagrams: DiagramRequest[];
    excluded: string[];
    unsupported: Set<string>;
    lastHeading: string;
    /** 페이지의 가장 높은 제목 단계를 H2 로 맞추기 위한 이동량 (페이지 제목이 H1) */
    headingShift: number;
}

/** 이 블록 타입들은 조용히 건너뛴다 — 사이트가 자체 목차 · 경로를 그린다 */
const SKIPPED = new Set(['table_of_contents', 'breadcrumb']);
/**
 * 사이트에서 뺄 블록 표식: 토글 · 제목 · 콜아웃 글이 [비공개] 로 시작 (docs/design.md 6.5).
 * 🔒 같은 아이콘은 쓰지 않는다 — 잠금 · 암호화를 다루는 카드가 내용 아이콘으로 이미 쓴다
 */
const PRIVATE_MARKER = /^\s*\[(?:비공개|private)\]/i;
const BULLET = /^\s*(?:[•·▪◦‣]|[-–])\s+/;
const CHOSEN = '✅';

export function convertPage(blocks: BlockNode[], options: ConvertOptions): ConvertResult {
    const state: State = {
        options,
        diagrams: [],
        excluded: [],
        unsupported: new Set(),
        lastHeading: '',
        headingShift: 2 - minHeadingLevel(blocks, 2),
    };
    const children = convertBlocks(blocks, state);
    if (state.unsupported.size > 0) {
        throw new Error(`지원하지 않는 노션 블록이 있습니다: ${[...state.unsupported].join(', ')}`);
    }
    return { root: { type: 'root', children }, diagrams: state.diagrams, excluded: state.excluded };
}

function html(value: string): Html {
    return { type: 'html', value };
}

function headingLevel(type: string): number | null {
    const match = /^heading_(\d)$/.exec(type);
    return match ? Number(match[1]) : null;
}

function minHeadingLevel(blocks: BlockNode[], fallback: number): number {
    let min = Infinity;
    const walk = (nodes: BlockNode[]) => {
        for (const node of nodes) {
            const level = headingLevel(node.type);
            if (level !== null) min = Math.min(min, level);
            walk(node.children);
        }
    };
    walk(blocks);
    return Number.isFinite(min) ? min : fallback;
}

function clip(text: string): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > 40 ? `${flat.slice(0, 40)}…` : flat;
}

function exclude(state: State, kind: string, text: string): BlockContent[] {
    state.excluded.push(`${kind} '${clip(text)}'`);
    return [];
}

function paragraphOf(items: RichTextItemResponse[], state: State): Paragraph[] {
    const children = toPhrasing(segmentsOf(items, state.options));
    return children.length > 0 ? [{ type: 'paragraph', children }] : [];
}

function details(label: PhrasingContent[], children: BlockContent[], className?: string): BlockContent[] {
    const cls = className ? ` class="${escapeAttr(className)}"` : '';
    return [html(`<details${cls}>\n<summary>${phrasingToHtml(label)}</summary>`), ...children, html('</details>')];
}

function convertBlocks(blocks: BlockNode[], state: State): BlockContent[] {
    const out: BlockContent[] = [];
    let list: List | null = null;
    for (const block of blocks) {
        if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item' || block.type === 'to_do') {
            const ordered = block.type === 'numbered_list_item';
            if (!list || list.ordered !== ordered) {
                list = { type: 'list', ordered, spread: false, children: [] };
                out.push(list);
            }
            list.children.push(listItem(block, state));
            continue;
        }
        list = null;
        out.push(...convertBlock(block, state));
    }
    return out;
}

function listItem(block: BlockNode, state: State): ListItem {
    let rich: RichTextItemResponse[] = [];
    let checked: boolean | null = null;
    if (block.type === 'bulleted_list_item') rich = block.bulleted_list_item.rich_text;
    else if (block.type === 'numbered_list_item') rich = block.numbered_list_item.rich_text;
    else if (block.type === 'to_do') {
        rich = block.to_do.rich_text;
        checked = block.to_do.checked;
    }
    const head = toPhrasing(segmentsOf(rich, state.options));
    return {
        type: 'listItem',
        spread: false,
        checked,
        children: [{ type: 'paragraph', children: head }, ...convertBlocks(block.children, state)],
    };
}

function convertBlock(block: BlockNode, state: State): BlockContent[] {
    const level = headingLevel(block.type);
    if (level !== null) return heading(block, level, state);

    switch (block.type) {
        case 'paragraph':
            return [...paragraphOf(block.paragraph.rich_text, state), ...convertBlocks(block.children, state)];

        case 'quote':
            return [
                {
                    type: 'blockquote',
                    children: [...paragraphOf(block.quote.rich_text, state), ...convertBlocks(block.children, state)],
                },
            ];

        case 'toggle': {
            const segments = segmentsOf(block.toggle.rich_text, state.options);
            const text = plainText(segments);
            if (PRIVATE_MARKER.test(text)) return exclude(state, 'toggle', text);
            return details(toPhrasing(segments), convertBlocks(block.children, state));
        }

        case 'callout':
            return callout(block, state);

        case 'code':
            return code(block, state);

        case 'divider':
            return [{ type: 'thematicBreak' }];

        case 'table':
            return table(block, state);

        case 'column_list': {
            const out: BlockContent[] = [html('<div class="columns">')];
            for (const column of block.children) {
                if (column.type !== 'column') continue;
                out.push(html('<div class="column">'), ...convertBlocks(column.children, state), html('</div>'));
            }
            out.push(html('</div>'));
            return out;
        }

        default:
            if (!SKIPPED.has(block.type)) state.unsupported.add(block.type);
            return [];
    }
}

function heading(block: BlockNode, level: number, state: State): BlockContent[] {
    // heading_1~3 은 타입이 있고, heading_4 같은 새 단계도 같은 모양이라고 보고 처리한다
    const data = (block as unknown as Record<string, { rich_text: RichTextItemResponse[]; is_toggleable?: boolean }>)[
        block.type
    ];
    if (!data) {
        state.unsupported.add(block.type);
        return [];
    }
    const segments = segmentsOf(data.rich_text, state.options);
    const text = plainText(segments);
    if (PRIVATE_MARKER.test(text)) return exclude(state, block.type, text);

    const depth = Math.min(6, Math.max(2, level + state.headingShift)) as 2 | 3 | 4 | 5 | 6;
    state.lastHeading = text.trim();
    const label = toPhrasing(segments);
    if (data.is_toggleable) {
        return details(label, convertBlocks(block.children, state), `heading-toggle h${depth}`);
    }
    return [{ type: 'heading', depth, children: label }];
}

/** 콜아웃 톤 — 본문 첫 줄 · 아이콘으로 의미 톤을 먼저 정하고, 없으면 노션 색을 따른다 */
function calloutTone(text: string, emoji: string, color: string): string {
    const head = text.trimStart();
    if (head.startsWith('이 검증이 말하지 않는 것')) return 'limits';
    if (head.startsWith('시나리오')) return 'scenario';
    if (emoji === '🧪') return 'evidence';
    return color.replace('_background', '');
}

function calloutBody(segments: Segment[]): BlockContent[] {
    const out: BlockContent[] = [];
    let paragraph: Paragraph | null = null;
    let list: List | null = null;
    for (const line of splitLines(segments)) {
        const text = plainText(line);
        if (!text.trim()) {
            paragraph = null;
            list = null;
            continue;
        }
        const bullet = BULLET.exec(text);
        if (bullet) {
            paragraph = null;
            if (!list) {
                list = { type: 'list', ordered: false, spread: false, children: [] };
                out.push(list);
            }
            const content = toPhrasing(dropPrefix(line, bullet[0].length));
            list.children.push({
                type: 'listItem',
                spread: false,
                children: [{ type: 'paragraph', children: content }],
            });
            continue;
        }
        list = null;
        if (!paragraph) {
            paragraph = { type: 'paragraph', children: [] };
            out.push(paragraph);
        } else {
            paragraph.children.push({ type: 'break' });
        }
        paragraph.children.push(...toPhrasing(line));
    }
    return out;
}

function callout(block: BlockNode, state: State): BlockContent[] {
    if (block.type !== 'callout') return [];
    const { rich_text, icon, color } = block.callout;
    const emoji = icon?.type === 'emoji' ? icon.emoji : '';
    const segments = segmentsOf(rich_text, state.options);
    const text = plainText(segments);
    if (PRIVATE_MARKER.test(text)) return exclude(state, 'callout', text);

    const tone = calloutTone(text, emoji, color);
    const icon_ = emoji ? ` data-icon="${escapeAttr(emoji)}"` : '';
    return [
        html(`<aside class="callout tone-${escapeAttr(tone)}"${icon_}>`),
        ...calloutBody(segments),
        ...convertBlocks(block.children, state),
        html('</aside>'),
    ];
}

const LANGUAGE: Record<string, string> = { 'plain text': 'text', shell: 'sh', 'c++': 'cpp', 'c#': 'csharp' };

function code(block: BlockNode, state: State): BlockContent[] {
    if (block.type !== 'code') return [];
    const source = state.options.redact(block.code.rich_text.map((item) => item.plain_text).join(''));
    const language = block.code.language;
    if (language !== 'mermaid') {
        return [{ type: 'code', lang: LANGUAGE[language] ?? language, value: source }];
    }
    const name = `diagram-${state.diagrams.length + 1}`;
    const caption = state.options.redact(block.code.caption.map((item) => item.plain_text).join('')).trim();
    const alt = caption || (state.lastHeading ? `${state.lastHeading} 다이어그램` : '다이어그램');
    const diagram: DiagramRequest = {
        name,
        source,
        alt,
        light: `${state.options.assetsBase}/${name}.light.svg`,
        dark: `${state.options.assetsBase}/${name}.dark.svg`,
    };
    state.diagrams.push(diagram);
    // 같은 그림의 라이트 · 다크 두 벌. 화면 낭독기는 한 번만 읽도록 다크 쪽은 숨긴다
    const img = (src: string, className: string, altText: string, hidden: boolean) =>
        `<img src="${escapeAttr(src)}" alt="${escapeAttr(altText)}" class="${className}" loading="lazy" decoding="async"${hidden ? ' aria-hidden="true"' : ''}>`;
    return [
        html(
            `<figure class="diagram">${img(diagram.light, 'diagram-light', alt, false)}${img(diagram.dark, 'diagram-dark', '', true)}</figure>`
        ),
    ];
}

/** 대안 비교표의 ✅(채택안) 표시를 행 강조용 표식으로 감싼다 — CSS 가 tr:has(.chosen-mark) 로 행을 칠한다 */
function markChosen(nodes: PhrasingContent[]): PhrasingContent[] {
    return nodes.flatMap((node): PhrasingContent[] => {
        if (node.type === 'text' && node.value.includes(CHOSEN)) {
            return node.value
                .split(CHOSEN)
                .flatMap((part, i): PhrasingContent[] => [
                    ...(i > 0 ? [html(`<span class="chosen-mark">${CHOSEN}</span>`)] : []),
                    ...(part ? [{ type: 'text', value: part } as const] : []),
                ]);
        }
        if ('children' in node && Array.isArray(node.children)) {
            return [{ ...node, children: markChosen(node.children as PhrasingContent[]) } as PhrasingContent];
        }
        return [node];
    });
}

function table(block: BlockNode, state: State): BlockContent[] {
    if (block.type !== 'table') return [];
    const { has_column_header, has_row_header, table_width } = block.table;
    const rows: TableRow[] = [];
    for (const row of block.children) {
        if (row.type !== 'table_row') continue;
        const cells = Array.from({ length: table_width }, (_, i) => row.table_row.cells[i] ?? []);
        rows.push({
            type: 'tableRow',
            children: cells.map((cell) => ({
                type: 'tableCell',
                children: markChosen(toPhrasing(segmentsOf(cell, state.options), 'html')),
            })),
        });
    }
    const node: Table = { type: 'table', align: Array.from({ length: table_width }, () => null), children: rows };
    // 넓은 표는 페이지가 아니라 표 안에서만 가로로 스크롤한다
    const classes = ['table-wrap', has_row_header ? 'row-header' : '', has_column_header ? '' : 'no-column-header']
        .filter(Boolean)
        .join(' ');
    return [html(`<div class="${classes}">`), node, html('</div>')];
}

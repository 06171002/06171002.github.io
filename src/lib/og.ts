// 공유 미리보기용 OG 이미지(1200×630 PNG)를 빌드 때 그린다 (docs/design.md 10장)
// SVG 틀에 글자를 직접 배치하고 resvg 로 굽는다. 글꼴은 자체 호스팅 중인 Pretendard 정적 OTF — CI 에서도 똑같이 그려진다
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

export type OgInput =
    | { kind: 'home'; eyebrow: string; name: string; tagline: string }
    | { kind: 'project'; eyebrow: string; name: string; summary: string; tone: Tone }
    | { kind: 'card'; eyebrow: string; title: string; keywords: string[]; tone: Tone };

export type Tone = 'b2b' | 'stt' | 'accent';

// 라이트 테마 토큰과 같은 값 (src/styles/tokens.css)
const COLOR = {
    bg: '#ffffff',
    fg: '#17191d',
    muted: '#5b6270',
    border: '#e4e7ec',
    accent: '#2457d6',
    b2b: '#497622',
    stt: '#6047b8',
};

const SITE = '06171002.github.io';
const PAD_X = 96;
const TEXT_WIDTH = OG_WIDTH - PAD_X * 2;

const require = createRequire(join(process.cwd(), 'package.json'));
const fontFiles = ['Bold', 'SemiBold', 'Medium'].map((weight) =>
    require.resolve(`pretendard/dist/public/static/Pretendard-${weight}.otf`)
);

export function renderOg(input: OgInput): Buffer {
    const resvg = new Resvg(svgOf(input), {
        fitTo: { mode: 'width', value: OG_WIDTH },
        font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Pretendard' },
    });
    return resvg.render().asPng();
}

function svgOf(input: OgInput): string {
    const tone = input.kind === 'home' ? COLOR.accent : COLOR[input.tone === 'accent' ? 'accent' : input.tone];
    const parts: string[] = [];
    let y = 128;
    parts.push(text(input.eyebrow, { x: PAD_X, y, size: 30, weight: 600, fill: tone }));

    if (input.kind === 'home') {
        y += 124;
        parts.push(text(input.name, { x: PAD_X, y, size: 104, weight: 700, fill: COLOR.fg }));
        y += 88;
        y = block(parts, input.tagline, { y, size: 38, weight: 500, fill: COLOR.muted, lineHeight: 56, maxLines: 3 });
    } else if (input.kind === 'project') {
        y += 100;
        y = block(parts, input.name, { y, size: 68, weight: 700, fill: COLOR.fg, lineHeight: 84, maxLines: 2 });
        block(parts, input.summary, { y, size: 34, weight: 500, fill: COLOR.muted, lineHeight: 52, maxLines: 3 });
    } else {
        y += 100;
        y = block(parts, input.title, { y, size: 66, weight: 700, fill: COLOR.fg, lineHeight: 84, maxLines: 3 });
        // 키워드 하나가 두 줄로 갈라지지 않게 키워드 단위로 줄을 바꾼다
        block(
            parts,
            { tokens: input.keywords, joiner: ' · ' },
            {
                y,
                size: 32,
                weight: 500,
                fill: COLOR.muted,
                lineHeight: 48,
                maxLines: 2,
            }
        );
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}">
<rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="${COLOR.bg}"/>
<rect width="20" height="${OG_HEIGHT}" fill="${tone}"/>
${parts.join('\n')}
<line x1="${PAD_X}" y1="${OG_HEIGHT - 112}" x2="${OG_WIDTH - PAD_X}" y2="${OG_HEIGHT - 112}" stroke="${COLOR.border}" stroke-width="2"/>
${text('이상진 · 백엔드 포트폴리오', { x: PAD_X, y: OG_HEIGHT - 58, size: 28, weight: 500, fill: COLOR.muted })}
${text(SITE, { x: OG_WIDTH - PAD_X, y: OG_HEIGHT - 58, size: 28, weight: 600, fill: COLOR.accent, anchor: 'end' })}
</svg>`;
}

interface TextStyle {
    x: number;
    y: number;
    size: number;
    weight: number;
    fill: string;
    anchor?: 'start' | 'end';
}

function text(content: string, style: TextStyle): string {
    const anchor = style.anchor === 'end' ? ' text-anchor="end"' : '';
    return `<text x="${style.x}" y="${style.y}" font-family="Pretendard" font-size="${style.size}" font-weight="${style.weight}" fill="${style.fill}"${anchor}>${escapeXml(content)}</text>`;
}

/** 여러 줄 문단을 그리고, 같은 줄 간격으로 한 줄 더 쓴다면 놓일 기준선 y 를 돌려준다 (다음 문단의 첫 기준선) */
function block(
    parts: string[],
    content: string | { tokens: string[]; joiner: string },
    style: Omit<TextStyle, 'x'> & { lineHeight: number; maxLines: number }
): number {
    const width = TEXT_WIDTH / style.size;
    let lines: string[];
    if (typeof content === 'string') {
        lines = wrap(content.split(/\s+/).filter(Boolean), ' ', width, style.maxLines);
    } else {
        // 목록은 넘치면 뒤 항목부터 통째로 뺀다 — 말줄임표가 붙으면 항목이 잘린 것처럼 보인다
        let count = content.tokens.length;
        lines = wrap(content.tokens, content.joiner, width, Infinity);
        while (count > 1 && lines.length > style.maxLines) {
            count -= 1;
            lines = wrap(content.tokens.slice(0, count), content.joiner, width, Infinity);
        }
        lines = lines.slice(0, style.maxLines);
    }
    let y = style.y;
    for (const line of lines) {
        parts.push(text(line, { ...style, x: PAD_X, y }));
        y += style.lineHeight;
    }
    return y;
}

/**
 * 낱말(또는 키워드) 단위로 줄을 채운다 (본문의 word-break: keep-all 과 같은 규칙). width 는 em 단위
 * 넘치면 마지막 줄을 말줄임표로 끝낸다. 글자 폭은 Pretendard 렌더 결과에서 잰 값(한글 약 0.86em · 영문 대문자 약 0.58em)보다 조금 넉넉하게 잡는다
 */
function wrap(tokens: string[], joiner: string, width: number, maxLines: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const token of tokens) {
        const next = line ? `${line}${joiner}${token}` : token;
        if (measure(next) <= width) {
            line = next;
            continue;
        }
        if (line) lines.push(line);
        line = token;
        while (measure(line) > width) {
            let cut = line.length - 1;
            while (cut > 1 && measure(line.slice(0, cut)) > width) cut -= 1;
            lines.push(line.slice(0, cut));
            line = line.slice(cut);
        }
    }
    if (line) lines.push(line);
    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1]!;
    while (last.length > 1 && measure(`${last}…`) > width) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last.trimEnd()}…`;
    return kept;
}

function measure(content: string): number {
    let total = 0;
    for (const char of content) total += advance(char);
    return total;
}

function advance(char: string): number {
    const code = char.codePointAt(0) ?? 0;
    if ((code >= 0xac00 && code <= 0xd7a3) || (code >= 0x3130 && code <= 0x318f)) return 0.88;
    if (code >= 0x2e80 && code <= 0x9fff) return 1;
    if (char === ' ') return 0.27;
    if (/[A-Z]/.test(char)) return 0.64;
    if (/[a-z0-9]/.test(char)) return 0.56;
    if (/[.,:;'"!|·()[\]/]/.test(char)) return 0.34;
    return 1;
}

function escapeXml(content: string): string {
    return content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

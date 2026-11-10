// 다이어그램 SVG 의 viewBox 에서 가로 · 세로를 읽어 <img> 에 width · height 로 붙인다.
// 동기화가 쓰는 SVG 는 width="100%" 라 원래 크기가 없고 비율만 있다 — 속성이 없으면 그림이 뜨기 전까지
// 자리를 못 잡아 아래 내용이 밀린다(레이아웃 이동, CLS). 그려지는 폭은 그대로 CSS(상자 폭)가 정한다
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface FigureSize {
    width: number;
    height: number;
}

const cache = new Map<string, FigureSize | null>();

/** 사이트 경로(/content-assets/….svg)의 viewBox 가로 · 세로. SVG 가 아니거나 못 읽으면 null */
export function svgSize(src: string): FigureSize | null {
    if (!src.startsWith('/') || !src.endsWith('.svg')) return null;
    const cached = cache.get(src);
    if (cached !== undefined) return cached;
    let size: FigureSize | null = null;
    try {
        const svg = readFileSync(join(process.cwd(), 'public', decodeURI(src)), 'utf8');
        // 맨 바깥 <svg> 의 viewBox 만 본다 (안쪽 marker 의 viewBox 는 화살표 크기다)
        const box = /<svg\b[^>]*\bviewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(svg);
        if (box) size = { width: Math.round(Number(box[1])), height: Math.round(Number(box[2])) };
    } catch {
        size = null;
    }
    cache.set(src, size);
    return size;
}

/** 렌더한 HTML 의 SVG <img> 에 width · height 를 붙인다. 이미 크기가 있는 태그는 그대로 둔다 */
export function sizeImages(html: string): string {
    return html.replace(/<img\b[^>]*>/g, (tag) => {
        if (/\s(width|height)=/.test(tag)) return tag;
        const src = /\ssrc="([^"]+)"/.exec(tag)?.[1];
        const size = src ? svgSize(src) : null;
        return size ? tag.replace(/^<img\b/, `<img width="${size.width}" height="${size.height}"`) : tag;
    });
}

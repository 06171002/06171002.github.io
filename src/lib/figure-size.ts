// 다이어그램 SVG 의 viewBox 에서 가로 · 세로를 읽어 <img> 에 width · height 로 붙인다.
// 동기화가 쓰는 SVG 는 width="100%" 라 원래 크기가 없고 비율만 있다 — 속성이 없으면 그림이 뜨기 전까지
// 자리를 못 잡아 아래 내용이 밀린다(레이아웃 이동, CLS). 그려지는 폭은 CSS 가 정한다(원래 크기, 상자보다 크면 줄임)
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface FigureSize {
    width: number;
    height: number;
}

// 같은 파일 이름에 다른 그림이 들어올 수 있다(동기화가 diagram-N 을 다시 쓴다) — 수정 시각까지 열쇠로 쓴다.
// 그러지 않으면 dev 서버가 떠 있는 동안 옛 크기를 내준다
const cache = new Map<string, FigureSize | null>();

/** 사이트 경로(/content-assets/….svg)의 viewBox 가로 · 세로. SVG 가 아니거나 못 읽으면 null */
export function svgSize(src: string): FigureSize | null {
    if (!src.startsWith('/') || !src.endsWith('.svg')) return null;
    const file = join(process.cwd(), 'public', decodeURI(src));
    let key: string;
    try {
        key = `${src}@${statSync(file).mtimeMs}`;
    } catch {
        return null;
    }
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    let size: FigureSize | null = null;
    try {
        const svg = readFileSync(file, 'utf8');
        // 맨 바깥 <svg> 의 viewBox 만 본다 (안쪽 marker 의 viewBox 는 화살표 크기다)
        const box = /<svg\b[^>]*\bviewBox="\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(svg);
        if (box) size = { width: Math.round(Number(box[1])), height: Math.round(Number(box[2])) };
    } catch {
        size = null;
    }
    cache.set(key, size);
    return size;
}

/**
 * 본문 다이어그램(라이트 · 다크 두 벌)을 원본 SVG(라이트) 링크로 감싸고 '그림 크게 보기' 안내를 붙인다.
 * 안내는 상자에 맞춰 줄어든 그림에만 보인다(content.css · 카드 페이지 스크립트) — 좁은 화면에서는 새 탭에서 확대해 본다
 */
export function linkDiagrams(html: string): string {
    return html.replace(/<figure class="diagram">((?:<img\b[^>]*>)+)<\/figure>/g, (whole, images: string) => {
        const light = /<img\b[^>]*\bclass="diagram-light"[^>]*>/.exec(images)?.[0] ?? images;
        const href = /\ssrc="([^"]+)"/.exec(light)?.[1];
        if (!href) return whole;
        return (
            `<figure class="diagram"><a class="diagram-open" href="${href}" target="_blank" rel="noopener">` +
            `${images}<span class="diagram-more">그림 크게 보기 ↗</span></a></figure>`
        );
    });
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

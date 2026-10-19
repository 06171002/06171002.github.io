import { existsSync } from 'node:fs';
import { renderMermaid } from '@mermaid-js/mermaid-cli';
import puppeteer from 'puppeteer';
import type { Browser } from 'puppeteer';

// Chrome 을 따로 내려받지 않고 이 PC 에 있는 Chrome · Edge 를 쓴다 (pnpm 이 puppeteer 설치 스크립트를 막아 둠)
const BROWSER_CANDIDATES = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
];

const FONT_FAMILY = "Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', sans-serif";

export async function openBrowser(): Promise<Browser> {
    const executablePath = BROWSER_CANDIDATES.find((candidate): candidate is string =>
        Boolean(candidate && existsSync(candidate))
    );
    if (!executablePath) {
        throw new Error('Mermaid 렌더용 Chrome · Edge 를 찾지 못했습니다. PUPPETEER_EXECUTABLE_PATH 로 지정하세요');
    }
    return puppeteer.launch({ executablePath, headless: true });
}

/** Mermaid 원문 → SVG 문자열. 라이트 · 다크 두 벌을 따로 만든다 (docs/design.md 6.4) */
export async function renderDiagram(
    browser: Browser,
    source: string,
    theme: 'default' | 'dark',
    svgId: string
): Promise<string> {
    const { data } = await renderMermaid(browser, source, 'svg', {
        backgroundColor: 'transparent',
        svgId,
        // HTML 라벨(foreignObject)은 <img> 로 띄울 때 브라우저마다 다르게 보이므로 순수 SVG 텍스트로 그린다.
        // wrappingWidth 는 ER 다이어그램 이름에도 적용된다 — 기본 200px 이면 긴 엔티티 이름이 글자 중간에서 잘린다
        mermaidConfig: {
            theme,
            fontFamily: FONT_FAMILY,
            htmlLabels: false,
            flowchart: { htmlLabels: false, wrappingWidth: 400 },
        },
    });
    return new TextDecoder().decode(data);
}

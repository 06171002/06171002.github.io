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

/**
 * 사이트 색에 맞춘 중립 테마 (docs/design.md 8장) — Mermaid 'base' 테마에 변수를 준다.
 * 상자는 흰 바탕 + 회색 테두리, 메모는 옅은 포인트 파랑, 묶음은 옅은 회색. 기본 테마의 노랑 · 연보라를 쓰지 않는다
 */
const THEME_VARIABLES = {
    default: {
        darkMode: false,
        background: '#ffffff',
        fontFamily: FONT_FAMILY,
        primaryColor: '#ffffff',
        primaryBorderColor: '#a9b1bc',
        primaryTextColor: '#14181d',
        secondaryColor: '#f1f3f6',
        secondaryBorderColor: '#c3c9d1',
        secondaryTextColor: '#14181d',
        tertiaryColor: '#f6f7f9',
        tertiaryBorderColor: '#d3d8de',
        tertiaryTextColor: '#14181d',
        mainBkg: '#ffffff',
        nodeBorder: '#a9b1bc',
        lineColor: '#7d8592',
        textColor: '#14181d',
        titleColor: '#14181d',
        clusterBkg: '#f6f7f9',
        clusterBorder: '#d3d8de',
        edgeLabelBackground: '#ffffff',
        noteBkgColor: '#eef3fc',
        noteBorderColor: '#b9cbea',
        noteTextColor: '#14181d',
        actorBkg: '#ffffff',
        actorBorder: '#a9b1bc',
        actorTextColor: '#14181d',
        actorLineColor: '#a9b1bc',
        signalColor: '#5c646e',
        signalTextColor: '#14181d',
        labelBoxBkgColor: '#f1f3f6',
        labelBoxBorderColor: '#a9b1bc',
        labelTextColor: '#14181d',
        loopTextColor: '#14181d',
        activationBkgColor: '#f1f3f6',
        activationBorderColor: '#a9b1bc',
        attributeBackgroundColorOdd: '#ffffff',
        attributeBackgroundColorEven: '#f6f7f9',
        xyChart: {
            backgroundColor: '#ffffff',
            titleColor: '#14181d',
            xAxisLabelColor: '#5c646e',
            xAxisTitleColor: '#5c646e',
            xAxisTickColor: '#a9b1bc',
            xAxisLineColor: '#a9b1bc',
            yAxisLabelColor: '#5c646e',
            yAxisTitleColor: '#5c646e',
            yAxisTickColor: '#a9b1bc',
            yAxisLineColor: '#a9b1bc',
            plotColorPalette: '#003da5, #9aa3ad',
        },
    },
    dark: {
        darkMode: true,
        background: '#151a21',
        fontFamily: FONT_FAMILY,
        primaryColor: '#1c222b',
        primaryBorderColor: '#4a5462',
        primaryTextColor: '#e8ecf1',
        secondaryColor: '#222a35',
        secondaryBorderColor: '#3a434f',
        secondaryTextColor: '#e8ecf1',
        tertiaryColor: '#181e26',
        tertiaryBorderColor: '#2f3741',
        tertiaryTextColor: '#e8ecf1',
        mainBkg: '#1c222b',
        nodeBorder: '#4a5462',
        lineColor: '#8b949f',
        textColor: '#e8ecf1',
        titleColor: '#e8ecf1',
        clusterBkg: '#181e26',
        clusterBorder: '#2f3741',
        edgeLabelBackground: '#151a21',
        noteBkgColor: '#17243a',
        noteBorderColor: '#2f4c7d',
        noteTextColor: '#e8ecf1',
        actorBkg: '#1c222b',
        actorBorder: '#4a5462',
        actorTextColor: '#e8ecf1',
        actorLineColor: '#4a5462',
        signalColor: '#a2abb6',
        signalTextColor: '#e8ecf1',
        labelBoxBkgColor: '#222a35',
        labelBoxBorderColor: '#4a5462',
        labelTextColor: '#e8ecf1',
        loopTextColor: '#e8ecf1',
        activationBkgColor: '#222a35',
        activationBorderColor: '#4a5462',
        attributeBackgroundColorOdd: '#1c222b',
        attributeBackgroundColorEven: '#181e26',
        xyChart: {
            backgroundColor: '#151a21',
            titleColor: '#e8ecf1',
            xAxisLabelColor: '#a2abb6',
            xAxisTitleColor: '#a2abb6',
            xAxisTickColor: '#4a5462',
            xAxisLineColor: '#4a5462',
            yAxisLabelColor: '#a2abb6',
            yAxisTitleColor: '#a2abb6',
            yAxisTickColor: '#4a5462',
            yAxisLineColor: '#4a5462',
            plotColorPalette: '#7aa7f0, #6b7480',
        },
    },
} as const;

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
            theme: 'base',
            themeVariables: THEME_VARIABLES[theme],
            fontFamily: FONT_FAMILY,
            htmlLabels: false,
            flowchart: { htmlLabels: false, wrappingWidth: 400 },
            // 선 위 라벨의 바탕 사각형이 기본 반투명(0.5)이라 선이 글자를 가로질러 보인다 → 불투명하게.
            // 상태 다이어그램은 '.edgeLabel .label rect' 로 따로 반투명을 주므로 같은 깊이로 덮는다
            themeCSS: '.edgeLabel rect, .edgeLabel .label rect { opacity: 1; }',
        },
    });
    return new TextDecoder().decode(data);
}

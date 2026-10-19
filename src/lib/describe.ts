// 카드 본문(Markdown)에서 메타 설명을 뽑는다 — 검색 결과 · 공유 미리보기 문구 (docs/design.md 10장)
// '개요' 절의 첫 글 문단을 목록이 시작되기 전까지 읽고, 문장 단위로 max 자 안쪽까지 자른다. 개요가 없으면 null

const MIN_LENGTH = 20;

export function describe(body: string, max = 150): string | null {
    const section = body.match(/^#{2,4} 개요[ \t]*\n([\s\S]*?)(?=^#{1,6} |^---[ \t]*$|(?![\s\S]))/m)?.[1];
    if (!section) return null;
    const lead = section
        .replace(/```[\s\S]*?```/g, '')
        .split(/\n[ \t]*\n/)
        .map(leadText)
        .find((text) => text.length >= MIN_LENGTH);
    return lead ? clip(lead, max) : null;
}

/** 문단 하나를 글자만 남긴다. 목록 · 표가 시작되면 거기서 멈춘다 */
function leadText(block: string): string {
    const lines: string[] = [];
    for (const raw of block.replace(/\\\n/g, '\n').split('\n')) {
        const line = raw.trim();
        if (/^(?:[-*+•]\s|\d+[.)]\s|\|)/.test(line)) break;
        lines.push(line);
    }
    return lines
        .join(' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\*\*|__|`/g, '')
        .replace(/\\([\\`*_{}[\]()#+\-.!<>~|])/g, '$1')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim();
}

/** 문장 경계에서 자른다. 첫 문장부터 넘치면 낱말 경계에서 자르고 말줄임표를 붙인다 */
function clip(text: string, max: number): string {
    if (text.length <= max) return text;
    let out = '';
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
        const next = out ? `${out} ${sentence}` : sentence;
        if (next.length > max) break;
        out = next;
    }
    if (out) return out;
    const cut = text.slice(0, max - 1);
    const space = cut.lastIndexOf(' ');
    return `${space > max / 2 ? cut.slice(0, space) : cut}…`;
}

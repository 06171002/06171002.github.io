import { publicPatterns } from '../../guard.config.ts';

export interface GuardHit {
    rule: string;
    match: string;
    line: number;
}

/** Markdown 이스케이프(\_ 등)를 걷어 내야 원문 표현 그대로 검사할 수 있다 */
function unescapeMarkdown(text: string): string {
    return text.replace(/\\([\\`*_{}[\]()#+\-.!|~<>:])/g, '$1');
}

/** 금지어(대소문자 무시) · 공개 패턴 검사 (docs/design.md 6.5) */
export function scan(text: string, denylist: string[]): GuardHit[] {
    const hits: GuardHit[] = [];
    const terms = denylist.filter(Boolean).map((term) => term.toLowerCase());
    unescapeMarkdown(text)
        .split('\n')
        .forEach((line, index) => {
            const lower = line.toLowerCase();
            for (const term of terms) {
                if (lower.includes(term)) hits.push({ rule: '금지어', match: term, line: index + 1 });
            }
            for (const pattern of publicPatterns) {
                for (const match of line.matchAll(pattern.regex)) {
                    if (pattern.allow?.includes(match[0])) continue;
                    hits.push({ rule: pattern.name, match: match[0], line: index + 1 });
                }
            }
        });
    return hits;
}

/** 규칙별로 묶은 짧은 요약 */
export function summarize(hits: GuardHit[]): string[] {
    const byRule = new Map<string, GuardHit[]>();
    for (const hit of hits) byRule.set(hit.rule, [...(byRule.get(hit.rule) ?? []), hit]);
    return [...byRule].map(([rule, list]) => {
        const samples = [...new Set(list.map((hit) => `${hit.match}(${hit.line}행)`))].slice(0, 4).join(', ');
        return `${rule} ${list.length}건: ${samples}${list.length > 4 ? ' …' : ''}`;
    });
}

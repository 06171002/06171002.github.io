import type { Root } from 'mdast';
import { gfmToMarkdown } from 'mdast-util-gfm';
import { toMarkdown } from 'mdast-util-to-markdown';

/** mdast → Markdown. 이스케이프와 인접 서식은 직렬화기가 처리한다 (docs/design.md 6.2) */
export function serialize(root: Root): string {
    return toMarkdown(root, {
        extensions: [gfmToMarkdown()],
        bullet: '-',
        emphasis: '*',
        strong: '*',
        fence: '`',
        fences: true,
        rule: '-',
        listItemIndent: 'one',
    });
}

/** 프론트매터. 값은 JSON 으로 쓴다 — JSON 은 YAML 의 부분집합이라 따옴표 · 특수문자 걱정이 없다 */
export function frontmatter(data: Record<string, unknown>): string {
    const lines = Object.entries(data).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);
    return `---\n${lines.join('\n')}\n---\n\n`;
}

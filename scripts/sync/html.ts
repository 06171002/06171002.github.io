import type { PhrasingContent } from 'mdast';

export function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escapeAttr(text: string): string {
    return escapeHtml(text).replace(/"/g, '&quot;');
}

/** 인라인 노드 → HTML (HTML 블록 한 줄 안에 넣어야 하는 <summary> 라벨용) */
export function phrasingToHtml(nodes: PhrasingContent[]): string {
    return nodes
        .map((node) => {
            switch (node.type) {
                case 'text':
                    return escapeHtml(node.value);
                case 'strong':
                    return `<strong>${phrasingToHtml(node.children)}</strong>`;
                case 'emphasis':
                    return `<em>${phrasingToHtml(node.children)}</em>`;
                case 'delete':
                    return `<del>${phrasingToHtml(node.children)}</del>`;
                case 'inlineCode':
                    return `<code>${escapeHtml(node.value)}</code>`;
                case 'link':
                    return `<a href="${escapeAttr(node.url)}">${phrasingToHtml(node.children)}</a>`;
                case 'html':
                    return node.value;
                case 'break':
                    return '<br>';
                default:
                    return '';
            }
        })
        .join('');
}

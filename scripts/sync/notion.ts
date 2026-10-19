import { Client, collectPaginatedAPI, isFullBlock, isFullPage } from '@notionhq/client';
import type { BlockObjectResponse, PageObjectResponse } from '@notionhq/client';

/** 자식 블록까지 붙인 블록 */
export type BlockNode = BlockObjectResponse & { children: BlockNode[] };

export function createNotion(token: string): Client {
    // 429(요청 한도) 재시도는 SDK 기본 동작에 맡긴다
    return new Client({ auth: token });
}

export async function fetchPage(notion: Client, pageId: string): Promise<PageObjectResponse> {
    const page = await notion.pages.retrieve({ page_id: pageId });
    if (!isFullPage(page)) {
        throw new Error(`페이지 전체 정보를 받지 못했습니다: ${pageId}`);
    }
    return page;
}

/** 블록 트리를 재귀로 가져온다. 하위 페이지 · DB 안으로는 내려가지 않는다 */
export async function fetchBlockTree(notion: Client, blockId: string): Promise<BlockNode[]> {
    const results = await collectPaginatedAPI(notion.blocks.children.list, { block_id: blockId, page_size: 100 });
    const nodes: BlockNode[] = [];
    for (const block of results) {
        if (!isFullBlock(block)) {
            throw new Error(`블록 전체 정보를 받지 못했습니다: ${block.id}`);
        }
        const descend = block.has_children && block.type !== 'child_page' && block.type !== 'child_database';
        const children = descend ? await fetchBlockTree(notion, block.id) : [];
        nodes.push({ ...block, children });
    }
    return nodes;
}

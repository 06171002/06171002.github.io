import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// 노션 '담당 기능 상세' 카드 — pnpm sync 결과물이다. 손으로 고치지 말 것 (docs/design.md 7장)
// features/ = 공개 점검을 마친 카드(커밋됨) · drafts/features/ = 점검 전 초안(gitignore → CI 빌드에는 없음)
// 프론트매터의 slug 가 엔트리 id 가 된다 → 라우트 /{project}/{id}/
const features = defineCollection({
    loader: glob({ pattern: '{features,drafts/features}/**/index.md', base: './src/content' }),
    schema: z.object({
        title: z.string(),
        project: z.enum(['b2b', 'stt']),
        order: z.number().int(),
        domain: z.string().nullable(),
        apiCount: z.number().int().nullable(),
        tableCount: z.number().int().nullable(),
        keywords: z.array(z.string()),
        evidence: z.array(z.enum(['measured', 'tested', 'static', 'estimated'])),
        draft: z.boolean(),
        cover: z.string().nullable(),
        notionEditedAt: z.coerce.date(),
    }),
});

export const collections = { features };

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/** 리포 루트 (scripts/sync/ 에서 두 단계 위) */
export const repoRoot = path.resolve(import.meta.dirname, '..', '..');

/** 비공개 폴더 — 공개 리포 밖에 둔다 (docs/design.md 6.6) */
export const privateDir = path.resolve(
    process.env.PORTFOLIO_PRIVATE_DIR ?? path.join(repoRoot, '..', 'portfolio-private')
);

/** 비공개 파일을 읽는다. 메모장이 넣는 BOM 을 제거한다 */
export function readPrivateFile(name: string): string {
    const file = path.join(privateDir, name);
    if (!existsSync(file)) {
        throw new Error(`비공개 파일이 없습니다: ${file}`);
    }
    return readFileSync(file, 'utf8').replace(/^﻿/, '');
}

/** 비공개 .env 의 값을 읽는다. CRLF · 따옴표를 견딘다. 값은 절대 출력하지 않는다 */
export function readPrivateEnv(name: string): string {
    for (const line of readPrivateFile('.env').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed.startsWith(`${name}=`)) {
            return trimmed
                .slice(name.length + 1)
                .trim()
                .replace(/^['"]|['"]$/g, '');
        }
    }
    return '';
}

import { readPrivateFile } from './env.ts';

export interface RedactRule {
    /** 그대로 찾을 문자열 */
    find?: string;
    /** 정규식 (find 대신) */
    pattern?: string;
    flags?: string;
    replace: string;
}

/** ../portfolio-private/sync.local.json — 공개 리포에 두면 안 되는 설정 */
export interface PrivateConfig {
    /** slug → 노션 페이지 ID */
    notion: { features: Record<string, string> };
    /** 공개용 표현으로 바꾸는 치환표 (앞에서부터 차례로 적용) */
    redact: RedactRule[];
    /** 동기화 결과에 남아 있으면 안 되는 말 (대소문자 무시) */
    denylist: string[];
}

export function loadPrivateConfig(): PrivateConfig {
    const config = JSON.parse(readPrivateFile('sync.local.json')) as PrivateConfig;
    if (!config.notion?.features || !Array.isArray(config.redact) || !Array.isArray(config.denylist)) {
        throw new Error('sync.local.json 에 notion.features · redact · denylist 가 모두 있어야 합니다');
    }
    return config;
}

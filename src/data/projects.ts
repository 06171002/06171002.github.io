// 노션 메인 페이지의 프로젝트 이름 (프로필 데이터라 동기화하지 않고 직접 관리 — docs/design.md 7장)
export const projects = {
    b2b: { name: '기업 간 구매·조달 플랫폼' },
    stt: { name: '실시간 음성 전사·요약 STT 서버' },
} as const;

export type ProjectKey = keyof typeof projects;

export const projectKeys = Object.keys(projects) as ProjectKey[];

export const evidenceLabel = {
    measured: '실측',
    tested: '테스트',
    static: '정적 분석',
    estimated: '추정',
} as const;

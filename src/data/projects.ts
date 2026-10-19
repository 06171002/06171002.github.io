// 노션 메인 페이지의 프로젝트 소개 (프로필 데이터라 동기화하지 않고 직접 관리 — docs/design.md 7장)
// 제품 구조 · 고객 도메인 같은 프로젝트 내부 정보는 싣지 않고 맡은 일만 쓴다 (docs/design.md 6.5)
export const projects = {
    b2b: {
        name: '기업 간 구매·조달 플랫폼',
        short: 'B2B 구매·조달',
        summary:
            '기업 간 구매 · 조달 서비스의 백엔드. 주문 · 결제 · 클레임 같은 핵심 흐름에서 동시 요청의 정합성과 응답 지연을 개선했다.',
        role: '백엔드',
        stack: ['Java', 'Spring Boot', 'JPA', 'MyBatis', 'MySQL'],
    },
    stt: {
        name: '실시간 음성 전사·요약 STT 서버',
        short: 'STT 서버',
        summary:
            '음성을 실시간 · 배치로 전사하고 LLM 으로 요약하는 비동기 백엔드. 엔진을 교체할 수 있는 구조와 실시간 처리의 논블로킹화를 맡았다.',
        role: '백엔드',
        stack: ['Python', 'FastAPI', 'Celery', 'Redis'],
    },
} as const;

export type ProjectKey = keyof typeof projects;

export const projectKeys = Object.keys(projects) as ProjectKey[];

export const evidenceLabel = {
    measured: '실측',
    tested: '테스트',
    static: '정적 분석',
    estimated: '추정',
} as const;

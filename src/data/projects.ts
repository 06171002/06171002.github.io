// 노션 메인 페이지의 프로젝트 소개 (프로필 데이터라 동기화하지 않고 직접 관리 — docs/design.md 7장)
export const projects = {
    b2b: {
        name: '기업 간 구매·조달 플랫폼',
        short: 'B2B 구매·조달',
        summary:
            '고객사의 상품 검색 · 주문 · 결재 · 정산 전체 프로세스를 한 플랫폼에서 처리하는 B2B 멀티테넌트 서비스. 회사 · 거래트랙 2축으로 데이터를 격리하고, 조직도 · 결재선 · 예산 · 여신을 기업별로 독립 운영한다.',
        role: '백엔드',
        stack: ['Java', 'Spring Boot', 'JPA', 'MyBatis', 'MySQL'],
    },
    stt: {
        name: '실시간 음성 전사·요약 STT 서버',
        short: 'STT 서버',
        summary:
            '의료 상담 음성을 실시간(WebSocket) · 배치로 전사하고 LLM 으로 구조화 요약하는 FastAPI 비동기 백엔드. STT · LLM 엔진을 교체 가능하게 추상화하고, 발화 분할과 스레드 오프로딩으로 실시간 처리를 논블로킹으로 만들었다.',
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

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
        name: '사내 받아쓰기·요약 서비스',
        short: '받아쓰기·요약',
        summary:
            '사내 여러 서비스가 함께 쓰는 요약 서비스에 실시간 · 파일 받아쓰기와 마이크 하나의 화자 구분을 더하고, 화상 상담 앱이 참가자마다 자막을 받고 상담이 끝나면 대화 전체를 요약해 기록하도록 연결했다.',
        role: '백엔드',
        stack: ['Python', 'FastAPI', 'faster-whisper', 'ONNX Runtime', 'Java', 'Spring Boot'],
    },
    llm: {
        name: '사내 LLM 게이트웨이',
        short: 'LLM 게이트웨이',
        summary:
            '사내 서비스가 OpenAI · Anthropic · 사내 Ollama 모델을 한 입구로 쓰게 하는 LLM 게이트웨이. 예산 예약 · 정산과 유료 요금 셈, 테넌트 자료 격리를 설계했다.',
        role: '백엔드 설계 · 검증',
        stack: ['Python', 'FastAPI', 'httpx', 'SQLAlchemy', 'MySQL'],
    },
    files: {
        name: '사내 파일·이미지 서버',
        short: '파일 서버',
        summary:
            '사내 여러 서비스가 함께 쓰는 파일 · 이미지 전용 서버. 업로드 검사 · 저장 · 썸네일 · 서명 주소 · 정리를 한곳에 모으고, 브라우저 직접 업로드와 DB 작업 대기열을 더했다.',
        role: '백엔드 설계',
        stack: ['Java', 'Spring Boot', 'MySQL', 'S3', 'Vue'],
    },
    coupon: {
        name: '포인트·쿠폰 엔진',
        short: '쿠폰 엔진',
        summary:
            '쇼핑몰마다 새로 만들던 쿠폰 발급 · 할인 계산과 포인트 적립 · 사용 · 소멸을 한곳에서 맡는 엔진. 할인을 줄마다 나누는 계산 모듈과 동시 요청에도 어긋나지 않는 원장을 만들고, 회사가 운영 중인 쇼핑몰의 규칙으로 다시 계산해 붙일 수 있는지 확인했다.',
        role: '백엔드 설계',
        stack: ['Java', 'Spring Boot', 'MySQL', 'Testcontainers', 'Vue'],
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

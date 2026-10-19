// 공개해도 되는 가드 규칙 (docs/design.md 6.6)
// 숨길 고유명사 목록은 여기 두지 않는다 → ../portfolio-private/sync.local.json 의 denylist

export interface GuardPattern {
    name: string;
    regex: RegExp;
    /** 이 규칙에 걸려도 통과시킬 표현 — 프로젝트와 무관한 표준 라이브러리 · 오픈소스 · 문법 용어만 둔다 */
    allow?: readonly string[];
}

// 공개본은 실제 시스템의 식별자 대신 개념 이름으로 쓴다 (docs/design.md 6.5) — 아래 식별자 규칙들이 그 기준을 지킨다
const GENERIC_CLASSES = [
    'LocalDate',
    'LocalDateTime',
    'BigDecimal',
    'ThreadPool',
    'ThreadPoolExecutor',
    'WebSocket',
    'WebSocketDisconnect',
    'NullPool',
    'NumPy',
    'MyBatis',
    'MybatisTest',
    'WebMvcTest',
    'DataJpaTest',
    'NotBlank',
    'ShedLock',
    'MapStruct',
    'TanStack',
    'WhisperLive',
    'ValueError',
    'StopIteration',
    'GitHub',
    'JavaScript',
    'TypeScript',
    'PowerShell',
];
const GENERIC_MEMBERS = [
    'erDiagram',
    'stateDiagram',
    'classDiagram',
    'sequenceDiagram',
    'notionEditedAt',
    'entrySet',
    'getKey',
    'getValue',
    'setValue',
    'getMessage',
    'hasNext',
    'hasPrevious',
    'isBefore',
    'isAfter',
    'parseLong',
    'toString',
    'valueOf',
    'maxDuration',
];
const GENERIC_SNAKE_CALLS = [
    'get_event_loop',
    'run_in_executor',
    'run_until_complete',
    'create_task',
    'to_thread',
    'create_async_engine',
];
const GENERIC_UPPER = ['AUTO_INCREMENT', 'LAST_INSERT_ID', 'ROW_COUNT', 'PESSIMISTIC_WRITE', 'REC_NOT_GAP'];

export const publicPatterns: GuardPattern[] = [
    { name: '내부 테이블 접두사', regex: /\b[Tt]_[A-Za-z][A-Za-z0-9_]*/g },
    { name: 'IPv4 주소', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
    {
        name: '호스트:포트',
        regex: /\b(?:localhost|redis|mysql|mariadb|postgres|kafka|rabbitmq|minio|mongo(?:db)?|[a-z0-9-]+\.(?:internal|local|corp|lan)):\d{2,5}\b/gi,
    },
    {
        // `POST /경로` 처럼 붙은 형태, 그리고 API 목록 표처럼 메서드와 칸이 갈려 경로만 남은 형태
        name: 'API 경로',
        regex: /\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/[\w/{}:.-]+|(?<![\w.:/])\/(?:api|ws|public)(?:\/[\w{}:.-]+)+/g,
    },
    { name: '파일 이름', regex: /\b[\w-]+(?:\.[\w-]+)*\.(?:py|java|kt|sql|xml|ya?ml|json|txt|properties)\b/g },
    {
        name: '대문자 식별자(테이블 · 컬럼 · 코드값 · 설정)',
        regex: /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g,
        allow: GENERIC_UPPER,
    },
    { name: '클래스 이름', regex: /\b[A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+\b/g, allow: GENERIC_CLASSES },
    { name: '필드 · 메서드 이름', regex: /\b[a-z][a-z0-9]*(?:[A-Z][a-z0-9]+)+\b/g, allow: GENERIC_MEMBERS },
    { name: '함수 이름', regex: /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+(?=\s*\()/g, allow: GENERIC_SNAKE_CALLS },
    { name: '인스턴스 사양', regex: /\b[a-z]\d[a-z]*\.\d*x?large\b|\b\d+\s*vCPU\b/gi },
    { name: '노션 링크', regex: /notion\.(?:so|site|com)\//gi },
];

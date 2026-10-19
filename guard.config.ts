// 공개해도 되는 가드 규칙 (docs/design.md 6.6)
// 숨길 고유명사 목록은 여기 두지 않는다 → ../portfolio-private/sync.local.json 의 denylist

export interface GuardPattern {
    name: string;
    regex: RegExp;
}

export const publicPatterns: GuardPattern[] = [
    { name: '내부 테이블 접두사', regex: /\b[Tt]_[A-Za-z][A-Za-z0-9_]*/g },
    { name: 'IPv4 주소', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
    {
        name: '호스트:포트',
        regex: /\b(?:localhost|redis|mysql|mariadb|postgres|kafka|rabbitmq|minio|mongo(?:db)?|[a-z0-9-]+\.(?:internal|local|corp|lan)):\d{2,5}\b/gi,
    },
    { name: 'HTTP 메서드 + 경로', regex: /\b(?:GET|POST|PUT|PATCH|DELETE)\s+\/[\w/{}:.-]+/g },
    { name: '노션 링크', regex: /notion\.(?:so|site|com)\//gi },
];

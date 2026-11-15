// 공개 설정 — 어떤 노션 카드를 어느 주소로 동기화할지 정한다 (docs/design.md 6장)
// 노션 페이지 ID · 치환표 · 금지어는 공개 리포에 두지 않는다 → ../portfolio-private/sync.local.json (6.6)

export type Project = 'b2b' | 'stt' | 'llm' | 'files' | 'coupon';
export type Evidence = 'measured' | 'tested' | 'static' | 'estimated';

export interface FeatureEntry {
    project: Project;
    slug: string;
    /** 프로젝트 안 순서 — 기본은 노션 보기 순서 */
    order: number;
    /** 카드에 붙일 근거 배지. 본문의 표기(실측 · N/N 통과 · 추정)를 보고 정한다 */
    evidence: Evidence[];
    /**
     * 공개 점검을 마쳤는가.
     * false → 커밋되지 않는 초안 폴더(src/content/drafts)로만 동기화한다. 로컬 미리보기 전용
     * true  → src/content/features 로 동기화한다. 가드에 하나라도 걸리면 쓰지 않는다
     */
    publish: boolean;
}

/** 동기화 허용 목록. 여기 없는 노션 카드는 동기화하지 않는다 */
export const features: FeatureEntry[] = [
    // 기업 간 구매·조달 플랫폼
    { project: 'b2b', slug: 'order-deadlock', order: 1, evidence: ['measured'], publish: true },
    { project: 'b2b', slug: 'direct-trade', order: 2, evidence: ['tested'], publish: true },
    { project: 'b2b', slug: 'supplier-po-delivery', order: 3, evidence: ['tested'], publish: true },
    { project: 'b2b', slug: 'claims', order: 4, evidence: ['tested', 'measured'], publish: true },
    { project: 'b2b', slug: 'order-payment', order: 5, evidence: ['measured', 'tested'], publish: true },
    { project: 'b2b', slug: 'cart', order: 6, evidence: ['measured', 'tested'], publish: true },
    { project: 'b2b', slug: 'company-join-request', order: 7, evidence: ['tested'], publish: true },
    // 사내 받아쓰기·요약 서비스
    { project: 'stt', slug: 'realtime-stt', order: 1, evidence: ['tested', 'measured'], publish: true },
    { project: 'stt', slug: 'speaker-labels', order: 2, evidence: ['measured', 'tested'], publish: true },
    { project: 'stt', slug: 'room-summary', order: 3, evidence: ['tested'], publish: true },
    { project: 'stt', slug: 'batch-transcription', order: 4, evidence: ['tested'], publish: true },
    // 사내 LLM 게이트웨이 — 요금 셈(cost-accounting)은 2026-11-15 예산 카드에 합쳤다. 옛 주소는 astro.config.mjs 의 redirects
    { project: 'llm', slug: 'budget', order: 1, evidence: ['measured', 'tested'], publish: true },
    { project: 'llm', slug: 'tenant-isolation', order: 2, evidence: ['tested', 'measured'], publish: true },
    // 사내 파일·이미지 서버
    { project: 'files', slug: 'upload-deadlock', order: 1, evidence: ['tested', 'measured'], publish: true },
    { project: 'files', slug: 'direct-upload', order: 2, evidence: ['tested', 'measured'], publish: true },
    { project: 'files', slug: 'job-queue', order: 3, evidence: ['tested'], publish: true },
    { project: 'files', slug: 'security-checklist', order: 4, evidence: ['tested'], publish: true },
    // 포인트·쿠폰 엔진
    { project: 'coupon', slug: 'discount-allocation', order: 1, evidence: ['tested'], publish: true },
    { project: 'coupon', slug: 'partial-refund', order: 2, evidence: ['tested'], publish: true },
    { project: 'coupon', slug: 'ledger-concurrency', order: 3, evidence: ['tested'], publish: true },
    { project: 'coupon', slug: 'replay-and-trial', order: 4, evidence: ['tested'], publish: true },
];

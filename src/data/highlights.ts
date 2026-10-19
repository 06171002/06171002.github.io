// 홈 대표 수치 3개 — 카드 본문의 문장을 그대로 옮긴 값이다 (2026-10-19 동기화본으로 확인)
import type { Evidence, Project } from '../../sync.config';

export interface Highlight {
    value: string;
    label: string;
    evidence: Evidence;
    /** 실측 환경 (로컬 / 배포 환경) */
    env?: string;
    project: Project;
    slug: string;
    cardTitle: string;
}

export const highlights: Highlight[] = [
    {
        value: '23 → 0건',
        label: '동시 주문 교착 · 25명 동시 주문 × 3회 재현',
        evidence: 'measured',
        env: '로컬',
        project: 'b2b',
        slug: 'order-deadlock',
        cardTitle: '동시 주문 데드락',
    },
    {
        value: '4 × 10,000회',
        label: '금액 배분 불변식 property 테스트 10/10 통과',
        evidence: 'tested',
        project: 'b2b',
        slug: 'claims',
        cardTitle: '반품/교환',
    },
    {
        value: '2.44배',
        label: '병목이 커넥션 풀임을 규명 · 115 → 280 req/s',
        evidence: 'measured',
        env: '로컬',
        project: 'b2b',
        slug: 'cart',
        cardTitle: '장바구니',
    },
];

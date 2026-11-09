// 홈 대표 사례 — 어떤 카드를 어떤 순서로 싣고, 큰 숫자 · 근거 배지를 무엇으로 할지 정한다 (docs/design.md 5.1)
// 성과 제목 · 문제 · 해결 · 결과 문장은 카드의 '한눈에'(노션 공개용 사본 속성)에서 온다.
// 값은 카드 본문의 문장을 그대로 옮긴 것이다 (2026-10-19 동기화본으로 확인, 실시간 STT 는 2026-11-09 정정본)
import type { Evidence, Project } from '../../sync.config';

export interface Highlight {
    /** 큰 숫자 */
    value: string;
    /** 카드에 '한눈에' 가 아직 없을 때만 쓰는 한 줄 설명 */
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
    {
        value: '17/17',
        label: '발화 분할 상태머신 테스트 17/17 통과 · 무음만 들어오면 세그먼트가 나오지 않는다',
        evidence: 'tested',
        project: 'stt',
        slug: 'realtime-stt',
        cardTitle: '실시간 스트리밍 STT',
    },
];

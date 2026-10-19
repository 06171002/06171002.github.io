// 공개 설정 — 어떤 노션 카드를 어느 주소로 동기화할지 정한다 (docs/design.md 6장)
// 노션 페이지 ID · 치환표 · 금지어는 공개 리포에 두지 않는다 → ../portfolio-private/sync.local.json (6.6)

export type Project = 'b2b' | 'stt';
export type Evidence = 'measured' | 'tested' | 'static' | 'estimated';

export interface FeatureEntry {
    project: Project;
    slug: string;
    order: number;
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
    // M1 파일럿: 표준 틀 카드 1장 + 예외 블록(토글 · 열 · 셀 색)이 많은 카드 1장
    { project: 'b2b', slug: 'claims', order: 4, evidence: ['tested', 'measured'], publish: false },
    { project: 'b2b', slug: 'company-join-request', order: 7, evidence: [], publish: false },
];

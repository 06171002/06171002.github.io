// 카드 본문의 「카드 제목」 텍스트 참조를 그 카드 페이지 링크로 바꾼다 (docs/design.md 6.3)
// 동기화가 아니라 렌더 때 한다 — 카드 제목이 바뀌어도 링크가 따라가고, 동기화 결과물(src/content)은 손대지 않는다.
// 「」 안 글자가 다른 공개 카드의 제목과 정확히 같을 때만 잇고, 링크 글자는 「제목」 그대로 둔다

export interface CardTarget {
    title: string;
    href: string;
    /** 초안은 배포되지 않으므로 잇지 않는다 */
    draft: boolean;
}

/** 잇지 못한 참조 — 노션 공개용 사본에서 고칠 후보 */
export interface UnlinkedRef {
    /** 「」 안 글자 */
    text: string;
    reason: string;
    count: number;
}

export interface CardRefResult {
    html: string;
    unlinked: UnlinkedRef[];
}

/** 이 요소 안의 글자는 바꾸지 않는다. summary(토글 제목)는 그 자체가 누르는 요소라 링크를 넣지 않는다 */
const SKIP = new Set([
    'a',
    'pre',
    'code',
    'kbd',
    'samp',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'summary',
    'button',
    'svg',
    'math',
    'template',
]);

/** 글줄 안의 요소 — 경고용으로 글자만 모을 때 이것 말고는 줄을 나눈다 */
const INLINE = new Set([
    'a',
    'abbr',
    'b',
    'cite',
    'code',
    'del',
    'em',
    'i',
    'ins',
    'kbd',
    'mark',
    'q',
    's',
    'samp',
    'small',
    'span',
    'strong',
    'sub',
    'sup',
    'time',
    'u',
]);

// 원시 글자 요소(script · style · textarea · title)는 통째로, 그다음 주석 · 선언 · 태그. 따옴표 안의 > 에서는 태그가 끝나지 않는다
const TOKEN =
    /<(script|style|textarea|title)\b[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->|<![^>]*>|<(\/?)([a-z][\w:-]*)(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
const REF = /「([^「」]+)」/g;
/** 경고용 — 뒤에 '카드'가 붙으면 카드를 가리키는 참조로 본다 */
const LOOSE_REF = /「([^「」\n]+)」([ \t ]*카드)?/g;

export function linkCardRefs(html: string, cards: CardTarget[], self: string): CardRefResult {
    const targets = new Map(
        cards.filter((card) => !card.draft && card.href !== self).map((card) => [normalize(card.title), card.href])
    );
    let out = '';
    for (const piece of walk(html)) {
        if (piece.tag !== null || piece.skipped) {
            out += piece.raw;
            continue;
        }
        out += piece.raw.replace(REF, (whole, inner: string) => {
            const href = targets.get(normalize(decode(inner)));
            return href ? `<a href="${escapeAttr(href)}" class="card-ref">${whole}</a>` : whole;
        });
    }
    return { html: out, unlinked: findUnlinked(out, cards, self) };
}

interface Piece {
    raw: string;
    /** 태그면 요소 이름(주석 · 원시 글자 요소는 빈 문자열), 글자 조각이면 null */
    tag: string | null;
    /** SKIP 요소 안의 글자인가 */
    skipped: boolean;
}

/** HTML 을 태그와 글자 조각으로 나눈다. 동기화 · Markdown 처리기가 만든 HTML 이라 짝이 맞는다고 본다 */
function* walk(html: string): Generator<Piece> {
    let depth = 0;
    let last = 0;
    for (const match of html.matchAll(TOKEN)) {
        if (match.index > last) yield { raw: html.slice(last, match.index), tag: null, skipped: depth > 0 };
        const [raw, , slash, name = ''] = match;
        const tag = name.toLowerCase();
        if (SKIP.has(tag) && !raw.endsWith('/>')) depth = Math.max(0, depth + (slash ? -1 : 1));
        yield { raw, tag, skipped: depth > 0 };
        last = match.index + raw.length;
    }
    if (last < html.length) yield { raw: html.slice(last), tag: null, skipped: depth > 0 };
}

/** 링크가 되지 못한 「」 중 카드를 가리키는 것 같은 참조를 모은다 — 링크 · 코드 · 제목 안은 보지 않는다 */
function findUnlinked(html: string, cards: CardTarget[], self: string): UnlinkedRef[] {
    // 글자 조각 안의 줄바꿈은 화면에서 띄어쓰기다 — 줄은 블록 경계에서만 나눈다
    let plain = '';
    for (const piece of walk(html)) {
        if (piece.tag === null) plain += piece.skipped ? '' : decode(piece.raw).replace(/[\r\n]+/g, ' ');
        else if (!INLINE.has(piece.tag)) plain += '\n';
    }
    const found = new Map<string, UnlinkedRef>();
    for (const [, inner, cardWord] of plain.matchAll(LOOSE_REF)) {
        const text = normalize(inner);
        const reason = classify(text, cardWord !== undefined, cards, self);
        if (!reason) continue;
        const seen = found.get(text);
        if (seen) seen.count++;
        else found.set(text, { text, reason, count: 1 });
    }
    return [...found.values()];
}

/** 고칠 후보면 까닭을, 카드 참조가 아니면(인용 · 절 이름 등) null 을 돌려준다 */
function classify(text: string, cardWord: boolean, cards: CardTarget[], self: string): string | null {
    const exact = cards.find((card) => normalize(card.title) === text);
    if (exact) {
        if (exact.href === self) return null;
        if (exact.draft) return '초안 카드라 잇지 않았다 (공개하면 이어진다)';
        return '「」 안팎에 서식이 걸쳐 있어 잇지 못했다';
    }
    const near = cards.find((card) => card.href !== self && resembles(card.title, text));
    if (near) return `카드 제목과 다르다 (가까운 제목: ${near.title})`;
    return cardWord ? '같은 제목의 카드가 없다' : null;
}

/** 괄호 · 줄표 뒤 부제 · 띄어쓰기 · 문장부호를 뺀 뼈대가 같거나, 제목이 참조로 시작하면 비슷하다고 본다 */
function resembles(title: string, text: string): boolean {
    const stem = (value: string) =>
        normalize(value)
            .replace(/\([^)]*\)/g, '')
            .replace(/\s[—–-]\s.*$/, '')
            .replace(/[\s\p{P}]/gu, '')
            .toLowerCase();
    const full = stem(title);
    const part = stem(text);
    return part.length >= 2 && (full === part || (part.length >= 4 && full.startsWith(part)));
}

function normalize(text: string): string {
    return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decode(text: string): string {
    return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
        if (name[0] !== '#') return NAMED[name.toLowerCase()] ?? whole;
        const code = /^#x/i.test(name) ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
        return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    });
}

function escapeAttr(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

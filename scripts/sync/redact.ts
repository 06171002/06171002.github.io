import type { RedactRule } from './private-config.ts';

export type Redactor = (text: string) => string;

/** 치환표를 앞에서부터 차례로 적용하는 함수를 만든다 */
export function createRedactor(rules: RedactRule[]): Redactor {
    const steps = rules.map((rule): Redactor => {
        if (rule.pattern) {
            const flags = (rule.flags ?? '').includes('g') ? (rule.flags ?? '') : `${rule.flags ?? ''}g`;
            const regex = new RegExp(rule.pattern, flags);
            return (text) => text.replace(regex, rule.replace);
        }
        if (rule.find) {
            const find = rule.find;
            // replace 의 $ 가 특수문자로 해석되지 않도록 함수로 넘긴다
            return (text) => text.split(find).join(rule.replace);
        }
        throw new Error('치환 규칙에는 find 나 pattern 이 필요합니다');
    });
    return (text) => steps.reduce((acc, step) => step(acc), text);
}

// subset-font 는 타입을 싣지 않는다 — 여기서 쓰는 만큼만 적는다
declare module 'subset-font' {
    interface SubsetOptions {
        targetFormat?: 'sfnt' | 'truetype' | 'woff' | 'woff2';
        /** 남길 OpenType 기능 태그. 주지 않으면 모든 기능을 남긴다 */
        keepFeatures?: string[];
    }
    export default function subsetFont(font: Buffer, text: string, options?: SubsetOptions): Promise<Buffer>;
}

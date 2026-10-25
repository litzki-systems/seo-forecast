/**
 * seo-forecast · turns data/ctr-curves.json into calculator curves. MIT License.
 */
import type { CtrTable, Curve } from './forecast.js';
export type Lang = 'de' | 'en';
export interface SourceInfo {
    title: string;
    publisher: string;
    url: string;
    published: string;
    data_period: string;
    market: string;
    method: string;
}
export interface CurveFile {
    version: string;
    updated: string;
    sources: Record<string, SourceInfo>;
    curves: Array<{
        id: string;
        label: Record<Lang, string>;
        source: string;
        device: string;
        query_type: string;
        ctr: CtrTable;
        aio: {
            type: 'reduction';
            source: string;
        } | {
            type: 'curve';
            source: string;
            ctr: CtrTable;
        };
    }>;
    aio_reductions: Record<string, {
        label: Record<Lang, string>;
        source: string;
        change_percent: CtrTable;
    }>;
    caveats: Record<Lang, string[]>;
}
export declare function curvesFromFile(file: CurveFile, lang: Lang): Curve[];

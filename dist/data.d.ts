/**
 * seo-forecast · turns data/ctr-curves.json into calculator curves. MIT License.
 */
import type { CtrTable, Curve, CurveChoice } from './forecast.js';
export type Lang = 'de' | 'en';
export interface SourceInfo {
    title: string;
    publisher: string;
    url: string;
    published: string;
    data_period: string;
    market: string;
    method: string;
    /** German version of method, optional. */
    method_de?: string;
}
export interface CurveFile {
    version: string;
    updated: string;
    sources: Record<string, SourceInfo>;
    curves: Array<{
        id: string;
        label: Record<Lang, string>;
        /** Short name for table headers, optional. */
        short?: Record<Lang, string>;
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
    presets?: Array<{
        id: string;
        type: 'single';
        label: Record<Lang, string>;
        curve: string;
    } | {
        id: string;
        type: 'brand';
        label: Record<Lang, string>;
        default: string;
        brand: string;
    } | {
        id: string;
        type: 'query-length';
        label: Record<Lang, string>;
        by_words: Record<string, string>;
    }>;
    aio_reductions: Record<string, {
        label: Record<Lang, string>;
        source: string;
        change_percent: CtrTable;
    }>;
    caveats: Record<Lang, string[]>;
    aio_citation?: {
        source: string;
        source_ref: {
            name: string;
            url: string;
            year: number;
        };
        cited: number;
        not_cited: number;
        /** Lower and upper value the source supports for not cited. */
        not_cited_range?: [number, number];
        calculation: string;
        label: Record<Lang, string>;
    };
    industry_lead_rates?: {
        source: string;
        source_ref: {
            name: string;
            url: string;
            year: number;
        };
        note: Record<Lang, string>;
        industries: Array<{
            id: string;
            label: Record<Lang, string>;
            lead_rate: number;
        }>;
        average: number;
    };
}
export declare function curvesFromFile(file: CurveFile, lang: Lang): Curve[];
export interface Preset {
    id: string;
    label: string;
    choice: CurveChoice;
    /** Curves this preset can use, for the assumptions table. */
    curves: Curve[];
    type: 'single' | 'brand' | 'query-length';
}
/** Number of words in a query (whitespace-separated). */
export declare function wordCount(keyword: string): number;
/** Presets for the calculator: single curves, brand/non-brand split, query length. */
export declare function presetsFromFile(file: CurveFile, lang: Lang): Preset[];

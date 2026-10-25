/**
 * seo-forecast · calculation core
 *
 * clicks per month = search volume × CTR(position) × AI Overview factor(position)
 * with a linear ramp from today's clicks to the target clicks.
 *
 * Pure functions, no I/O, no dependencies. Runs in the browser, in Node and in Workers.
 * MIT License.
 */
/** CTR in percent per position, e.g. { "1": 19.38, "2": 9.64 }. */
export type CtrTable = Record<string, number>;
export type AioModel = {
    type: 'reduction';
    changePercent: CtrTable;
    source?: string;
} | {
    type: 'curve';
    ctr: CtrTable;
    source?: string;
} | {
    type: 'none';
};
export interface Curve {
    id: string;
    label: string;
    ctr: CtrTable;
    aio: AioModel;
    source?: string;
}
export interface Keyword {
    keyword: string;
    /** Monthly searches. Taken from your own data (keyword tool, Search Console). Never estimated here. */
    volume: number;
    /** Today's position. null = not ranking in the curve's range. */
    currentPosition: number | null;
    /** Position you plan to reach. */
    targetPosition: number;
    /** An AI Overview appears on the results page for this keyword. */
    aio: boolean;
}
export interface Settings {
    /** Months until the target position is reached. */
    rampMonths: number;
    /** Months shown in the forecast. */
    horizonMonths: number;
}
export interface ForecastWarning {
    /** beyond-data: no CTR for this position in the curve (beyond its range or a gap); no-aio-reduction: no published reduction, base CTR used. */
    type: 'beyond-data' | 'no-aio-reduction';
    which: 'current' | 'target';
    position: number;
    /** Highest position with data in the curve. */
    maxPosition: number;
    message: string;
}
export interface KeywordResult {
    keyword: string;
    volume: number;
    currentPosition: number | null;
    targetPosition: number;
    aio: boolean;
    currentCtr: number;
    targetCtr: number;
    currentClicks: number;
    targetClicks: number;
    /** Clicks per month, index 0 = month 1. */
    monthly: number[];
    /** Positions outside the curve's data and similar gaps, reported instead of guessed. */
    warnings: ForecastWarning[];
}
export interface ForecastResult {
    curveId: string;
    settings: Settings;
    keywords: KeywordResult[];
    totals: {
        currentClicks: number;
        targetClicks: number;
        monthly: number[];
        additionalClicksOverHorizon: number;
    };
}
/** Highest position a table has data for. */
export declare function maxPosition(table: CtrTable): number;
/**
 * Base CTR (percent) for a position. Positions are rounded to whole numbers,
 * as Search Console reports averages like 3.4. Positions without data return null.
 */
export declare function baseCtr(curve: Curve, position: number | null): number | null;
/** CTR (percent) for a position, with the AI Overview model applied when aio is true. */
export declare function ctrFor(curve: Curve, position: number | null, aio: boolean): number | null;
export declare function forecast(curve: Curve, keywords: Keyword[], settings: Settings): ForecastResult;
export interface SearchConsoleRow {
    clicks: number;
    impressions: number;
    position: number;
}
/**
 * Builds a CTR curve from your own Search Console query export:
 * rows are grouped by rounded position, CTR = sum of clicks / sum of impressions.
 * Positions with fewer than minImpressions impressions are left out.
 */
export declare function curveFromSearchConsole(rows: SearchConsoleRow[], maxPos?: number, minImpressions?: number): {
    ctr: CtrTable;
    impressions: Record<string, number>;
};

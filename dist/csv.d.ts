/**
 * seo-forecast · CSV import and export
 * Accepts comma, semicolon or tab as separator, quoted fields, German and English headers,
 * and German or English number formats. MIT License.
 */
import type { ForecastResult, Intent, Keyword, SearchConsoleRow } from './forecast.js';
import type { FunnelResult } from './funnel.js';
export declare function parseCsv(text: string): string[][];
/**
 * Parses "1.234,5", "1,234.5", "3,4", "12.3%" and "" (→ NaN).
 * A single separator followed by exactly three digits groups for thousands ("1.300", "1,300" = 1300).
 */
export declare function parseNumber(raw: string): number;
/** Reads info/informational/informativ, comm/commercial/kommerziell, trans/transactional/transaktional. */
export declare function parseIntent(v: string): Intent | null;
/**
 * Reads a keyword list. Required columns: keyword, volume, target_position.
 * Optional: current_position (empty = not ranking), aio (yes/no).
 */
export declare function keywordsFromCsv(text: string): {
    keywords: Keyword[];
    errors: string[];
};
/** Reads a Google Search Console query export (Queries.csv), German or English. */
export declare function searchConsoleFromCsv(text: string): {
    rows: SearchConsoleRow[];
    errors: string[];
};
/** Result table as CSV: one row per keyword, one column per month, plus a total row. */
export declare function resultToCsv(result: ForecastResult): string;
/** Funnel table as CSV: one row per month plus a total row. */
export declare function funnelToCsv(f: FunnelResult): string;

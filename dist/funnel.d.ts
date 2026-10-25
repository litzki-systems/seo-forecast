/**
 * seo-forecast · business funnel
 *
 * clicks → leads → customers → revenue → gross profit → net profit after SEO investment
 *
 * Every rate and value comes from the user. There are no industry defaults:
 * without your own conversion rates the funnel is not calculated.
 * MIT License.
 */
import type { ForecastResult, Intent } from './forecast.js';
export interface FunnelSettings {
    /** Visitors who become a lead (enquiry, sign-up, order), in percent. */
    leadRate: number;
    /** Optional lead rates per search intent, in percent. Missing ones fall back to leadRate. */
    leadRateByIntent?: Partial<Record<Intent, number>>;
    /** Leads who become customers, in percent. Use 100 for shops where the lead is the order. */
    closeRate: number;
    /** Revenue per customer: customer lifetime value or average order value. */
    customerValue: number;
    /** Margin on revenue, in percent. 100 = treat revenue as profit. */
    margin: number;
    /** SEO investment per month. 0 or empty = no ROI calculation. */
    monthlyInvestment?: number;
    /** One-off investment in month 1 (e.g. setup, relaunch). */
    oneOffInvestment?: number;
    /**
     * 'additional': only the clicks on top of today's clicks count (what the SEO work adds).
     * 'total': all forecast clicks count.
     */
    basis: 'additional' | 'total';
}
export interface FunnelMonth {
    month: number;
    clicks: number;
    leads: number;
    customers: number;
    revenue: number;
    grossProfit: number;
    investment: number;
    netProfit: number;
    cumulativeRevenue: number;
    cumulativeGrossProfit: number;
    cumulativeInvestment: number;
    cumulativeNetProfit: number;
    /** Cumulative ROI in percent, null without investment. */
    cumulativeRoi: number | null;
}
export interface FunnelResult {
    settings: FunnelSettings;
    months: FunnelMonth[];
    /** Values for one month once the target positions are reached. */
    atTarget: {
        clicks: number;
        leads: number;
        customers: number;
        revenue: number;
        grossProfit: number;
        netProfit: number;
        roi: number | null;
    };
    totals: {
        clicks: number;
        leads: number;
        customers: number;
        revenue: number;
        grossProfit: number;
        investment: number;
        netProfit: number;
        /** Cumulative ROI over the horizon in percent, null without investment. */
        roi: number | null;
        /** Gross profit per euro invested over the horizon, null without investment. */
        returnPerEuro: number | null;
        /** First month in which cumulative net profit is ≥ 0, null if not reached. */
        breakEvenMonth: number | null;
    };
    /** Effective lead rate per keyword, to show which rate was used. */
    keywordLeadRates: Array<{
        keyword: string;
        intent: Intent | null;
        leadRate: number;
    }>;
}
export declare function validateFunnel(f: FunnelSettings): string[];
export declare function leadRateFor(f: FunnelSettings, intent: Intent | null): number;
export declare function funnel(result: ForecastResult, f: FunnelSettings): FunnelResult;

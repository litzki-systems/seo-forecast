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
  atTarget: { clicks: number; leads: number; customers: number; revenue: number; grossProfit: number; netProfit: number; roi: number | null };
  totals: {
    clicks: number; leads: number; customers: number; revenue: number; grossProfit: number;
    investment: number; netProfit: number;
    /** Cumulative ROI over the horizon in percent, null without investment. */
    roi: number | null;
    /** Gross profit per euro invested over the horizon, null without investment. */
    returnPerEuro: number | null;
    /** First month in which cumulative net profit is ≥ 0, null if not reached. */
    breakEvenMonth: number | null;
  };
  /** Effective lead rate per keyword, to show which rate was used. */
  keywordLeadRates: Array<{ keyword: string; intent: Intent | null; leadRate: number }>;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

export function validateFunnel(f: FunnelSettings): string[] {
  const errors: string[] = [];
  const pct = (v: number | undefined, name: string, max = 100) => {
    if (v === undefined) return;
    if (!Number.isFinite(v) || v < 0 || v > max) errors.push(`${name} must be between 0 and ${max}`);
  };
  pct(f.leadRate, 'lead rate');
  pct(f.closeRate, 'close rate');
  pct(f.margin, 'margin');
  for (const [k, v] of Object.entries(f.leadRateByIntent || {})) pct(v, `lead rate (${k})`);
  if (!Number.isFinite(f.customerValue) || f.customerValue < 0) errors.push('customer value must be ≥ 0');
  if (f.monthlyInvestment !== undefined && (!Number.isFinite(f.monthlyInvestment) || f.monthlyInvestment < 0)) errors.push('monthly investment must be ≥ 0');
  if (f.oneOffInvestment !== undefined && (!Number.isFinite(f.oneOffInvestment) || f.oneOffInvestment < 0)) errors.push('one-off investment must be ≥ 0');
  return errors;
}

export function leadRateFor(f: FunnelSettings, intent: Intent | null): number {
  const v = intent ? f.leadRateByIntent?.[intent] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? v : f.leadRate;
}

export function funnel(result: ForecastResult, f: FunnelSettings): FunnelResult {
  const errors = validateFunnel(f);
  if (errors.length) throw new Error(errors.join(', '));
  const horizon = result.totals.monthly.length;
  const monthlyInvest = f.monthlyInvestment || 0;
  const oneOff = f.oneOffInvestment || 0;
  const hasInvestment = monthlyInvest > 0 || oneOff > 0;

  const keywordLeadRates = result.keywords.map((k) => ({ keyword: k.keyword, intent: k.intent, leadRate: leadRateFor(f, k.intent) }));

  // Leads are calculated per keyword, because each keyword may carry its own intent and lead rate.
  const clicksIn = (k: ForecastResult['keywords'][number], i: number): number =>
    f.basis === 'additional' ? Math.max(0, k.monthly[i] - k.currentClicks) : k.monthly[i];

  const months: FunnelMonth[] = [];
  let cumRev = 0, cumGross = 0, cumInv = 0, cumNet = 0;
  let breakEven: number | null = null;
  let sumClicks = 0, sumLeads = 0, sumCustomers = 0;
  for (let i = 0; i < horizon; i++) {
    let clicks = 0, leads = 0;
    result.keywords.forEach((k, j) => {
      const c = clicksIn(k, i);
      clicks += c;
      leads += (c * keywordLeadRates[j].leadRate) / 100;
    });
    const customers = (leads * f.closeRate) / 100;
    const revenue = customers * f.customerValue;
    const gross = (revenue * f.margin) / 100;
    const investment = monthlyInvest + (i === 0 ? oneOff : 0);
    const net = gross - investment;
    cumRev += revenue; cumGross += gross; cumInv += investment; cumNet += net;
    sumClicks += clicks; sumLeads += leads; sumCustomers += customers;
    if (breakEven === null && hasInvestment && cumNet >= 0) breakEven = i + 1;
    months.push({
      month: i + 1,
      clicks: r2(clicks), leads: r2(leads), customers: r2(customers), revenue: r2(revenue), grossProfit: r2(gross),
      investment: r2(investment), netProfit: r2(net),
      cumulativeRevenue: r2(cumRev), cumulativeGrossProfit: r2(cumGross), cumulativeInvestment: r2(cumInv), cumulativeNetProfit: r2(cumNet),
      cumulativeRoi: cumInv > 0 ? r2(((cumGross - cumInv) / cumInv) * 100) : null,
    });
  }

  // One month at target positions (after the ramp).
  let tClicks = 0, tLeads = 0;
  result.keywords.forEach((k, j) => {
    const c = f.basis === 'additional' ? Math.max(0, k.targetClicks - k.currentClicks) : k.targetClicks;
    tClicks += c;
    tLeads += (c * keywordLeadRates[j].leadRate) / 100;
  });
  const tCustomers = (tLeads * f.closeRate) / 100;
  const tRevenue = tCustomers * f.customerValue;
  const tGross = (tRevenue * f.margin) / 100;
  const tNet = tGross - monthlyInvest;

  return {
    settings: f,
    months,
    atTarget: {
      clicks: r2(tClicks), leads: r2(tLeads), customers: r2(tCustomers), revenue: r2(tRevenue), grossProfit: r2(tGross),
      netProfit: r2(tNet), roi: monthlyInvest > 0 ? r2(((tGross - monthlyInvest) / monthlyInvest) * 100) : null,
    },
    totals: {
      clicks: r2(sumClicks), leads: r2(sumLeads), customers: r2(sumCustomers), revenue: r2(cumRev), grossProfit: r2(cumGross),
      investment: r2(cumInv), netProfit: r2(cumNet),
      roi: cumInv > 0 ? r2(((cumGross - cumInv) / cumInv) * 100) : null,
      returnPerEuro: cumInv > 0 ? r2(cumGross / cumInv) : null,
      breakEvenMonth: breakEven,
    },
    keywordLeadRates,
  };
}

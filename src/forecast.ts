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

export type AioModel =
  | { type: 'reduction'; changePercent: CtrTable; source?: string }
  | { type: 'curve'; ctr: CtrTable; source?: string }
  | { type: 'none' };

export interface Curve {
  id: string;
  label: string;
  /** Short name for table headers. */
  shortLabel?: string;
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
  /**
   * Whether your page is cited in that AI Overview. Only used when aio is true and
   * citation factors are given in the settings. null/undefined = unknown (average model).
   */
  aioCitation?: AioCitation | null;
  /** Brand keyword (your own brand name). Selects the brand curve where a curve set has one. */
  brand?: boolean;
  /** Search intent. Only used to pick your own lead rate per intent in the funnel. */
  intent?: Intent | null;
}

export type Intent = 'informational' | 'commercial' | 'transactional';
export type AioCitation = 'cited' | 'not-cited';

/** CTR multipliers relative to the same result without an AI Overview. */
export interface CitationFactors { cited: number; notCited: number }

/**
 * Either one curve for all keywords, or a picker that chooses a curve per keyword
 * (e.g. brand vs. non-brand, or by query length). The picker may return a note,
 * which is reported with the keyword.
 */
export type CurveChoice = Curve | { id: string; pick: (k: Keyword) => { curve: Curve; note?: string } };

export interface Settings {
  /** Months until the target position is reached. */
  rampMonths: number;
  /** Months shown in the forecast. */
  horizonMonths: number;
  /** Multipliers for keywords whose AI Overview citation status is known (see data file for the source). */
  citationFactors?: CitationFactors;
  /**
   * Your own CTR adjustment in percent (100 = none), applied to every keyword.
   * A user assumption without a source, shown as such in the result.
   */
  userCtrFactor?: number;
}

export interface ForecastWarning {
  /** beyond-data: no CTR for this position in the curve (beyond its range or a gap); no-aio-reduction: no published reduction, base CTR used. */
  type: 'beyond-data' | 'no-aio-reduction' | 'curve-note';
  which: 'current' | 'target' | 'both';
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
  aioCitation: AioCitation | null;
  brand: boolean;
  intent: Intent | null;
  /** Curve used for this keyword. */
  curveId: string;
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

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Highest position a table has data for. */
export function maxPosition(table: CtrTable): number {
  return Object.keys(table).reduce((m, k) => Math.max(m, Number(k)), 0);
}

/**
 * Base CTR (percent) for a position. Positions are rounded to whole numbers,
 * as Search Console reports averages like 3.4. Positions without data return null.
 */
export function baseCtr(curve: Curve, position: number | null): number | null {
  if (position === null || !Number.isFinite(position) || position < 1) return null;
  const v = curve.ctr[String(Math.round(position))];
  return typeof v === 'number' ? v : null;
}

/**
 * CTR (percent) for a position, with the AI Overview model applied when aio is true.
 * With a known citation status and citation factors, the citation factor replaces the average model.
 */
export function ctrFor(curve: Curve, position: number | null, aio: boolean, citation?: AioCitation | null, factors?: CitationFactors): number | null {
  const base = baseCtr(curve, position);
  if (base === null) return null;
  if (!aio || curve.aio.type === 'none') return base;
  if (citation && factors) return base * (citation === 'cited' ? factors.cited : factors.notCited);
  const key = String(Math.round(position as number));
  if (curve.aio.type === 'curve') {
    const v = curve.aio.ctr[key];
    return typeof v === 'number' ? v : null;
  }
  const change = curve.aio.changePercent[key];
  // No published reduction for this position: keep the base value and let the caller warn.
  if (typeof change !== 'number') return base;
  return base * (1 + change / 100);
}

function validate(k: Keyword): string[] {
  const errors: string[] = [];
  if (k.aioCitation && !['cited', 'not-cited'].includes(k.aioCitation)) errors.push('aioCitation must be cited, not-cited or empty');
  if (!k.keyword) errors.push('keyword missing');
  if (!Number.isFinite(k.volume) || k.volume < 0) errors.push('volume must be a number ≥ 0');
  if (!Number.isFinite(k.targetPosition) || k.targetPosition < 1) errors.push('target position must be ≥ 1');
  if (k.currentPosition !== null && (!Number.isFinite(k.currentPosition) || k.currentPosition < 1)) {
    errors.push('current position must be ≥ 1 or empty');
  }
  return errors;
}

function resolve(choice: CurveChoice, k: Keyword): { curve: Curve; note?: string } {
  return 'pick' in choice ? choice.pick(k) : { curve: choice };
}

export function forecast(choice: CurveChoice, keywords: Keyword[], settings: Settings): ForecastResult {
  if (settings.userCtrFactor !== undefined && (!Number.isFinite(settings.userCtrFactor) || settings.userCtrFactor < 0 || settings.userCtrFactor > 500)) {
    throw new Error('userCtrFactor must be between 0 and 500 percent');
  }
  const ramp = Math.max(1, Math.round(settings.rampMonths));
  const horizon = Math.max(1, Math.round(settings.horizonMonths));

  const results: KeywordResult[] = keywords.map((k) => {
    const errors = validate(k);
    if (errors.length) throw new Error(`${k.keyword || '(empty)'}: ${errors.join(', ')}`);

    const { curve, note } = resolve(choice, k);
    const limit = maxPosition(curve.ctr);
    const warnings: ForecastWarning[] = [];
    if (note) warnings.push({ type: 'curve-note', which: 'both', position: k.targetPosition, maxPosition: limit, message: note });
    const factor = (settings.userCtrFactor ?? 100) / 100;
    const adjust = (v: number | null): number | null => (v === null ? null : Math.min(100, v * factor));
    const cur = adjust(ctrFor(curve, k.currentPosition, k.aio, k.aioCitation, settings.citationFactors));
    const tgt = adjust(ctrFor(curve, k.targetPosition, k.aio, k.aioCitation, settings.citationFactors));
    const beyond = (which: 'current' | 'target', position: number): ForecastWarning => ({
      type: 'beyond-data', which, position, maxPosition: limit,
      message: `no CTR data for ${which} position ${position} in this curve, counted as 0 clicks`,
    });
    if (k.currentPosition !== null && cur === null) warnings.push(beyond('current', k.currentPosition));
    if (tgt === null) warnings.push(beyond('target', k.targetPosition));
    if (k.aio && curve.aio.type === 'reduction' && !(k.aioCitation && settings.citationFactors)) {
      for (const [which, p] of [['current', k.currentPosition], ['target', k.targetPosition]] as const) {
        if (p !== null && baseCtr(curve, p) !== null && typeof curve.aio.changePercent[String(Math.round(p))] !== 'number') {
          warnings.push({
            type: 'no-aio-reduction', which, position: Math.round(p), maxPosition: limit,
            message: `no published AI Overview reduction for position ${Math.round(p)}, base CTR used`,
          });
        }
      }
    }

    const currentCtr = cur ?? 0;
    const targetCtr = tgt ?? 0;
    const currentClicks = (k.volume * currentCtr) / 100;
    const targetClicks = (k.volume * targetCtr) / 100;
    const monthly: number[] = [];
    for (let m = 1; m <= horizon; m++) {
      const share = Math.min(m / ramp, 1);
      monthly.push(round2(currentClicks + (targetClicks - currentClicks) * share));
    }
    return {
      keyword: k.keyword,
      volume: k.volume,
      currentPosition: k.currentPosition,
      targetPosition: k.targetPosition,
      aio: k.aio,
      aioCitation: k.aio ? (k.aioCitation ?? null) : null,
      brand: !!k.brand,
      intent: k.intent ?? null,
      curveId: curve.id,
      currentCtr: round2(currentCtr),
      targetCtr: round2(targetCtr),
      currentClicks: round2(currentClicks),
      targetClicks: round2(targetClicks),
      monthly,
      warnings,
    };
  });

  const monthly = Array.from({ length: horizon }, (_, i) => round2(results.reduce((s, r) => s + r.monthly[i], 0)));
  const currentClicks = round2(results.reduce((s, r) => s + r.currentClicks, 0));
  const targetClicks = round2(results.reduce((s, r) => s + r.targetClicks, 0));
  const additional = round2(monthly.reduce((s, v) => s + (v - currentClicks), 0));

  return {
    curveId: choice.id,
    settings: { rampMonths: ramp, horizonMonths: horizon, citationFactors: settings.citationFactors, userCtrFactor: settings.userCtrFactor ?? 100 },
    keywords: results,
    totals: { currentClicks, targetClicks, monthly, additionalClicksOverHorizon: additional },
  };
}

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
export function curveFromSearchConsole(rows: SearchConsoleRow[], maxPos = 20, minImpressions = 100): { ctr: CtrTable; impressions: Record<string, number> } {
  const clicks: Record<string, number> = {};
  const impressions: Record<string, number> = {};
  for (const r of rows) {
    const p = Math.round(r.position);
    if (!Number.isFinite(p) || p < 1 || p > maxPos) continue;
    if (!Number.isFinite(r.clicks) || !Number.isFinite(r.impressions) || r.impressions <= 0) continue;
    const k = String(p);
    clicks[k] = (clicks[k] || 0) + r.clicks;
    impressions[k] = (impressions[k] || 0) + r.impressions;
  }
  const ctr: CtrTable = {};
  const kept: Record<string, number> = {};
  for (const k of Object.keys(impressions)) {
    if (impressions[k] < minImpressions) continue;
    ctr[k] = round2((clicks[k] / impressions[k]) * 100);
    kept[k] = impressions[k];
  }
  return { ctr, impressions: kept };
}

/**
 * seo-forecast · calculation core
 *
 * clicks per month = search volume × CTR(position) × AI Overview factor(position)
 * with a linear ramp from today's clicks to the target clicks.
 *
 * Pure functions, no I/O, no dependencies. Runs in the browser, in Node and in Workers.
 * MIT License.
 */
const round2 = (n) => Math.round(n * 100) / 100;
/** Highest position a table has data for. */
export function maxPosition(table) {
    return Object.keys(table).reduce((m, k) => Math.max(m, Number(k)), 0);
}
/**
 * Base CTR (percent) for a position. Positions are rounded to whole numbers,
 * as Search Console reports averages like 3.4. Positions without data return null.
 */
export function baseCtr(curve, position) {
    if (position === null || !Number.isFinite(position) || position < 1)
        return null;
    const v = curve.ctr[String(Math.round(position))];
    return typeof v === 'number' ? v : null;
}
/** CTR (percent) for a position, with the AI Overview model applied when aio is true. */
export function ctrFor(curve, position, aio) {
    const base = baseCtr(curve, position);
    if (base === null)
        return null;
    if (!aio || curve.aio.type === 'none')
        return base;
    const key = String(Math.round(position));
    if (curve.aio.type === 'curve') {
        const v = curve.aio.ctr[key];
        return typeof v === 'number' ? v : null;
    }
    const change = curve.aio.changePercent[key];
    // No published reduction for this position: keep the base value and let the caller warn.
    if (typeof change !== 'number')
        return base;
    return base * (1 + change / 100);
}
function validate(k) {
    const errors = [];
    if (!k.keyword)
        errors.push('keyword missing');
    if (!Number.isFinite(k.volume) || k.volume < 0)
        errors.push('volume must be a number ≥ 0');
    if (!Number.isFinite(k.targetPosition) || k.targetPosition < 1)
        errors.push('target position must be ≥ 1');
    if (k.currentPosition !== null && (!Number.isFinite(k.currentPosition) || k.currentPosition < 1)) {
        errors.push('current position must be ≥ 1 or empty');
    }
    return errors;
}
function resolve(choice, k) {
    return 'pick' in choice ? choice.pick(k) : { curve: choice };
}
export function forecast(choice, keywords, settings) {
    const ramp = Math.max(1, Math.round(settings.rampMonths));
    const horizon = Math.max(1, Math.round(settings.horizonMonths));
    const results = keywords.map((k) => {
        const errors = validate(k);
        if (errors.length)
            throw new Error(`${k.keyword || '(empty)'}: ${errors.join(', ')}`);
        const { curve, note } = resolve(choice, k);
        const limit = maxPosition(curve.ctr);
        const warnings = [];
        if (note)
            warnings.push({ type: 'curve-note', which: 'both', position: k.targetPosition, maxPosition: limit, message: note });
        const cur = ctrFor(curve, k.currentPosition, k.aio);
        const tgt = ctrFor(curve, k.targetPosition, k.aio);
        const beyond = (which, position) => ({
            type: 'beyond-data', which, position, maxPosition: limit,
            message: `no CTR data for ${which} position ${position} in this curve, counted as 0 clicks`,
        });
        if (k.currentPosition !== null && cur === null)
            warnings.push(beyond('current', k.currentPosition));
        if (tgt === null)
            warnings.push(beyond('target', k.targetPosition));
        if (k.aio && curve.aio.type === 'reduction') {
            for (const [which, p] of [['current', k.currentPosition], ['target', k.targetPosition]]) {
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
        const monthly = [];
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
        settings: { rampMonths: ramp, horizonMonths: horizon },
        keywords: results,
        totals: { currentClicks, targetClicks, monthly, additionalClicksOverHorizon: additional },
    };
}
/**
 * Builds a CTR curve from your own Search Console query export:
 * rows are grouped by rounded position, CTR = sum of clicks / sum of impressions.
 * Positions with fewer than minImpressions impressions are left out.
 */
export function curveFromSearchConsole(rows, maxPos = 20, minImpressions = 100) {
    const clicks = {};
    const impressions = {};
    for (const r of rows) {
        const p = Math.round(r.position);
        if (!Number.isFinite(p) || p < 1 || p > maxPos)
            continue;
        if (!Number.isFinite(r.clicks) || !Number.isFinite(r.impressions) || r.impressions <= 0)
            continue;
        const k = String(p);
        clicks[k] = (clicks[k] || 0) + r.clicks;
        impressions[k] = (impressions[k] || 0) + r.impressions;
    }
    const ctr = {};
    const kept = {};
    for (const k of Object.keys(impressions)) {
        if (impressions[k] < minImpressions)
            continue;
        ctr[k] = round2((clicks[k] / impressions[k]) * 100);
        kept[k] = impressions[k];
    }
    return { ctr, impressions: kept };
}

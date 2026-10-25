const r2 = (n) => Math.round(n * 100) / 100;
export function validateFunnel(f) {
    const errors = [];
    const pct = (v, name, max = 100) => {
        if (v === undefined)
            return;
        if (!Number.isFinite(v) || v < 0 || v > max)
            errors.push(`${name} must be between 0 and ${max}`);
    };
    pct(f.leadRate, 'lead rate');
    pct(f.closeRate, 'close rate');
    pct(f.margin, 'margin');
    for (const [k, v] of Object.entries(f.leadRateByIntent || {}))
        pct(v, `lead rate (${k})`);
    if (!Number.isFinite(f.customerValue) || f.customerValue < 0)
        errors.push('customer value must be ≥ 0');
    if (f.monthlyInvestment !== undefined && (!Number.isFinite(f.monthlyInvestment) || f.monthlyInvestment < 0))
        errors.push('monthly investment must be ≥ 0');
    if (f.oneOffInvestment !== undefined && (!Number.isFinite(f.oneOffInvestment) || f.oneOffInvestment < 0))
        errors.push('one-off investment must be ≥ 0');
    return errors;
}
export function leadRateFor(f, intent) {
    const v = intent ? f.leadRateByIntent?.[intent] : undefined;
    return typeof v === 'number' && Number.isFinite(v) ? v : f.leadRate;
}
export function funnel(result, f) {
    const errors = validateFunnel(f);
    if (errors.length)
        throw new Error(errors.join(', '));
    const horizon = result.totals.monthly.length;
    const monthlyInvest = f.monthlyInvestment || 0;
    const oneOff = f.oneOffInvestment || 0;
    const hasInvestment = monthlyInvest > 0 || oneOff > 0;
    const keywordLeadRates = result.keywords.map((k) => ({ keyword: k.keyword, intent: k.intent, leadRate: leadRateFor(f, k.intent) }));
    // Leads are calculated per keyword, because each keyword may carry its own intent and lead rate.
    const clicksIn = (k, i) => f.basis === 'additional' ? Math.max(0, k.monthly[i] - k.currentClicks) : k.monthly[i];
    const months = [];
    let cumRev = 0, cumGross = 0, cumInv = 0, cumNet = 0;
    let breakEven = null;
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
        cumRev += revenue;
        cumGross += gross;
        cumInv += investment;
        cumNet += net;
        sumClicks += clicks;
        sumLeads += leads;
        sumCustomers += customers;
        if (breakEven === null && hasInvestment && cumNet >= 0)
            breakEven = i + 1;
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

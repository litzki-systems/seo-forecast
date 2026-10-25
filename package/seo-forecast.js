/*! seo-forecast 1.4.1 · MIT License · https://github.com/litzki-systems/seo-forecast */

// src/forecast.ts
var round2 = (n) => Math.round(n * 100) / 100;
function maxPosition(table2) {
  return Object.keys(table2).reduce((m, k) => Math.max(m, Number(k)), 0);
}
function baseCtr(curve, position) {
  if (position === null || !Number.isFinite(position) || position < 1) return null;
  const v = curve.ctr[String(Math.round(position))];
  return typeof v === "number" ? v : null;
}
function ctrFor(curve, position, aio, citation, factors) {
  const base = baseCtr(curve, position);
  if (base === null) return null;
  if (!aio || curve.aio.type === "none") return base;
  if (citation && factors) return base * (citation === "cited" ? factors.cited : factors.notCited);
  const key = String(Math.round(position));
  if (curve.aio.type === "curve") {
    const v = curve.aio.ctr[key];
    return typeof v === "number" ? v : null;
  }
  const change = curve.aio.changePercent[key];
  if (typeof change !== "number") return base;
  return base * (1 + change / 100);
}
function validate(k) {
  const errors = [];
  if (k.aioCitation && !["cited", "not-cited"].includes(k.aioCitation)) errors.push("aioCitation must be cited, not-cited or empty");
  if (!k.keyword) errors.push("keyword missing");
  if (!Number.isFinite(k.volume) || k.volume < 0) errors.push("volume must be a number \u2265 0");
  if (!Number.isFinite(k.targetPosition) || k.targetPosition < 1) errors.push("target position must be \u2265 1");
  if (k.currentPosition !== null && (!Number.isFinite(k.currentPosition) || k.currentPosition < 1)) {
    errors.push("current position must be \u2265 1 or empty");
  }
  return errors;
}
function resolve(choice, k) {
  return "pick" in choice ? choice.pick(k) : { curve: choice };
}
function forecast(choice, keywords, settings) {
  if (settings.userCtrFactor !== void 0 && (!Number.isFinite(settings.userCtrFactor) || settings.userCtrFactor < 0 || settings.userCtrFactor > 500)) {
    throw new Error("userCtrFactor must be between 0 and 500 percent");
  }
  const ramp = Math.max(1, Math.round(settings.rampMonths));
  const horizon = Math.max(1, Math.round(settings.horizonMonths));
  const results = keywords.map((k) => {
    const errors = validate(k);
    if (errors.length) throw new Error(`${k.keyword || "(empty)"}: ${errors.join(", ")}`);
    const { curve, note } = resolve(choice, k);
    const limit = maxPosition(curve.ctr);
    const warnings = [];
    if (note) warnings.push({ type: "curve-note", which: "both", position: k.targetPosition, maxPosition: limit, message: note });
    const factor = (settings.userCtrFactor ?? 100) / 100;
    const adjust = (v) => v === null ? null : Math.min(100, v * factor);
    const cur = adjust(ctrFor(curve, k.currentPosition, k.aio, k.aioCitation, settings.citationFactors));
    const tgt = adjust(ctrFor(curve, k.targetPosition, k.aio, k.aioCitation, settings.citationFactors));
    const beyond = (which, position) => ({
      type: "beyond-data",
      which,
      position,
      maxPosition: limit,
      message: `no CTR data for ${which} position ${position} in this curve, counted as 0 clicks`
    });
    if (k.currentPosition !== null && cur === null) warnings.push(beyond("current", k.currentPosition));
    if (tgt === null) warnings.push(beyond("target", k.targetPosition));
    if (k.aio && curve.aio.type === "reduction" && !(k.aioCitation && settings.citationFactors)) {
      for (const [which, p] of [["current", k.currentPosition], ["target", k.targetPosition]]) {
        if (p !== null && baseCtr(curve, p) !== null && typeof curve.aio.changePercent[String(Math.round(p))] !== "number") {
          warnings.push({
            type: "no-aio-reduction",
            which,
            position: Math.round(p),
            maxPosition: limit,
            message: `no published AI Overview reduction for position ${Math.round(p)}, base CTR used`
          });
        }
      }
    }
    const currentCtr = cur ?? 0;
    const targetCtr = tgt ?? 0;
    const currentClicks2 = k.volume * currentCtr / 100;
    const targetClicks2 = k.volume * targetCtr / 100;
    const monthly2 = [];
    for (let m = 1; m <= horizon; m++) {
      const share = Math.min(m / ramp, 1);
      monthly2.push(round2(currentClicks2 + (targetClicks2 - currentClicks2) * share));
    }
    return {
      keyword: k.keyword,
      volume: k.volume,
      currentPosition: k.currentPosition,
      targetPosition: k.targetPosition,
      aio: k.aio,
      aioCitation: k.aio ? k.aioCitation ?? null : null,
      brand: !!k.brand,
      intent: k.intent ?? null,
      curveId: curve.id,
      currentCtr: round2(currentCtr),
      targetCtr: round2(targetCtr),
      currentClicks: round2(currentClicks2),
      targetClicks: round2(targetClicks2),
      monthly: monthly2,
      warnings
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
    totals: { currentClicks, targetClicks, monthly, additionalClicksOverHorizon: additional }
  };
}
function curveFromSearchConsole(rows, maxPos = 20, minImpressions = 100) {
  const clicks = {};
  const impressions = {};
  for (const r of rows) {
    const p = Math.round(r.position);
    if (!Number.isFinite(p) || p < 1 || p > maxPos) continue;
    if (!Number.isFinite(r.clicks) || !Number.isFinite(r.impressions) || r.impressions <= 0) continue;
    const k = String(p);
    clicks[k] = (clicks[k] || 0) + r.clicks;
    impressions[k] = (impressions[k] || 0) + r.impressions;
  }
  const ctr = {};
  const kept = {};
  for (const k of Object.keys(impressions)) {
    if (impressions[k] < minImpressions) continue;
    ctr[k] = round2(clicks[k] / impressions[k] * 100);
    kept[k] = impressions[k];
  }
  return { ctr, impressions: kept };
}

// src/funnel.ts
var r2 = (n) => Math.round(n * 100) / 100;
function validateFunnel(f) {
  const errors = [];
  const pct = (v, name, max = 100) => {
    if (v === void 0) return;
    if (!Number.isFinite(v) || v < 0 || v > max) errors.push(`${name} must be between 0 and ${max}`);
  };
  pct(f.leadRate, "lead rate");
  pct(f.closeRate, "close rate");
  pct(f.margin, "margin");
  for (const [k, v] of Object.entries(f.leadRateByIntent || {})) pct(v, `lead rate (${k})`);
  if (!Number.isFinite(f.customerValue) || f.customerValue < 0) errors.push("customer value must be \u2265 0");
  if (f.monthlyInvestment !== void 0 && (!Number.isFinite(f.monthlyInvestment) || f.monthlyInvestment < 0)) errors.push("monthly investment must be \u2265 0");
  if (f.oneOffInvestment !== void 0 && (!Number.isFinite(f.oneOffInvestment) || f.oneOffInvestment < 0)) errors.push("one-off investment must be \u2265 0");
  return errors;
}
function leadRateFor(f, intent) {
  const v = intent ? f.leadRateByIntent?.[intent] : void 0;
  return typeof v === "number" && Number.isFinite(v) ? v : f.leadRate;
}
function funnel(result, f) {
  const errors = validateFunnel(f);
  if (errors.length) throw new Error(errors.join(", "));
  const horizon = result.totals.monthly.length;
  const monthlyInvest = f.monthlyInvestment || 0;
  const oneOff = f.oneOffInvestment || 0;
  const hasInvestment = monthlyInvest > 0 || oneOff > 0;
  const keywordLeadRates = result.keywords.map((k) => ({ keyword: k.keyword, intent: k.intent, leadRate: leadRateFor(f, k.intent) }));
  const clicksIn = (k, i) => f.basis === "additional" ? Math.max(0, k.monthly[i] - k.currentClicks) : k.monthly[i];
  const months = [];
  let cumRev = 0, cumGross = 0, cumInv = 0, cumNet = 0;
  let breakEven = null;
  let sumClicks = 0, sumLeads = 0, sumCustomers = 0;
  for (let i = 0; i < horizon; i++) {
    let clicks = 0, leads = 0;
    result.keywords.forEach((k, j) => {
      const c = clicksIn(k, i);
      clicks += c;
      leads += c * keywordLeadRates[j].leadRate / 100;
    });
    const customers = leads * f.closeRate / 100;
    const revenue = customers * f.customerValue;
    const gross = revenue * f.margin / 100;
    const investment = monthlyInvest + (i === 0 ? oneOff : 0);
    const net = gross - investment;
    cumRev += revenue;
    cumGross += gross;
    cumInv += investment;
    cumNet += net;
    sumClicks += clicks;
    sumLeads += leads;
    sumCustomers += customers;
    if (breakEven === null && hasInvestment && cumNet >= 0) breakEven = i + 1;
    months.push({
      month: i + 1,
      clicks: r2(clicks),
      leads: r2(leads),
      customers: r2(customers),
      revenue: r2(revenue),
      grossProfit: r2(gross),
      investment: r2(investment),
      netProfit: r2(net),
      cumulativeRevenue: r2(cumRev),
      cumulativeGrossProfit: r2(cumGross),
      cumulativeInvestment: r2(cumInv),
      cumulativeNetProfit: r2(cumNet),
      cumulativeRoi: cumInv > 0 ? r2((cumGross - cumInv) / cumInv * 100) : null
    });
  }
  let tClicks = 0, tLeads = 0;
  result.keywords.forEach((k, j) => {
    const c = f.basis === "additional" ? Math.max(0, k.targetClicks - k.currentClicks) : k.targetClicks;
    tClicks += c;
    tLeads += c * keywordLeadRates[j].leadRate / 100;
  });
  const tCustomers = tLeads * f.closeRate / 100;
  const tRevenue = tCustomers * f.customerValue;
  const tGross = tRevenue * f.margin / 100;
  const tNet = tGross - monthlyInvest;
  return {
    settings: f,
    months,
    atTarget: {
      clicks: r2(tClicks),
      leads: r2(tLeads),
      customers: r2(tCustomers),
      revenue: r2(tRevenue),
      grossProfit: r2(tGross),
      netProfit: r2(tNet),
      roi: monthlyInvest > 0 ? r2((tGross - monthlyInvest) / monthlyInvest * 100) : null
    },
    totals: {
      clicks: r2(sumClicks),
      leads: r2(sumLeads),
      customers: r2(sumCustomers),
      revenue: r2(cumRev),
      grossProfit: r2(cumGross),
      investment: r2(cumInv),
      netProfit: r2(cumNet),
      roi: cumInv > 0 ? r2((cumGross - cumInv) / cumInv * 100) : null,
      returnPerEuro: cumInv > 0 ? r2(cumGross / cumInv) : null,
      breakEvenMonth: breakEven
    },
    keywordLeadRates
  };
}

// src/csv.ts
function parseCsv(text) {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] || "";
  const counts = [
    [";", (firstLine.match(/;/g) || []).length],
    ["	", (firstLine.match(/\t/g) || []).length],
    [",", (firstLine.match(/,/g) || []).length]
  ];
  const sep = counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts[0][0] : ",";
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}
function parseNumber(raw) {
  let s = String(raw ?? "").trim().replace(/%$/, "").replace(/\s/g, "");
  if (s === "") return NaN;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (hasComma) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  return Number(s);
}
var norm = (h) => h.toLowerCase().trim().replace(/[\s\-]+/g, "_");
var KEYWORD_HEADERS = {
  keyword: ["keyword", "query", "suchbegriff", "top_queries", "h\xE4ufigste_suchanfragen", "haeufigste_suchanfragen"],
  volume: ["volume", "search_volume", "msv", "suchvolumen", "volumen"],
  currentPosition: ["current_position", "position", "aktuelle_position"],
  targetPosition: ["target_position", "zielposition", "ziel_position"],
  aio: ["aio", "ai_overview", "ai_overviews"],
  brand: ["brand", "marke", "branded"],
  intent: ["intent", "intention", "suchintention", "search_intent"]
};
function parseAio(v) {
  const s = String(v || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (/^(not cited|nicht zitiert|uncited)$/.test(s)) return { aio: true, citation: "not-cited" };
  if (/^(cited|zitiert)$/.test(s)) return { aio: true, citation: "cited" };
  return { aio: truthy(s), citation: null };
}
function parseIntent(v) {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("info")) return "informational";
  if (s.startsWith("comm") || s.startsWith("komm")) return "commercial";
  if (s.startsWith("trans")) return "transactional";
  return null;
}
function indexOf(header, names) {
  const h = header.map(norm);
  for (const n of names) {
    const i = h.indexOf(n);
    if (i >= 0) return i;
  }
  return -1;
}
var truthy = (v) => /^(1|yes|ja|true|wahr|x)$/i.test(String(v || "").trim());
function keywordsFromCsv(text) {
  const rows = parseCsv(text);
  const errors = [];
  if (rows.length < 2) return { keywords: [], errors: ["no data rows"] };
  const header = rows[0];
  const col = {
    keyword: indexOf(header, KEYWORD_HEADERS.keyword),
    volume: indexOf(header, KEYWORD_HEADERS.volume),
    currentPosition: indexOf(header, KEYWORD_HEADERS.currentPosition),
    targetPosition: indexOf(header, KEYWORD_HEADERS.targetPosition),
    aio: indexOf(header, KEYWORD_HEADERS.aio),
    brand: indexOf(header, KEYWORD_HEADERS.brand),
    intent: indexOf(header, KEYWORD_HEADERS.intent)
  };
  for (const k of ["keyword", "volume", "targetPosition"]) {
    if (col[k] < 0) errors.push(`column missing: ${KEYWORD_HEADERS[k][0]}`);
  }
  if (errors.length) return { keywords: [], errors };
  const keywords = [];
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const keyword = (r[col.keyword] || "").trim();
    const volume = parseNumber(r[col.volume]);
    const target = parseNumber(r[col.targetPosition]);
    const curRaw = col.currentPosition >= 0 ? r[col.currentPosition] : "";
    const current = curRaw && curRaw.trim() !== "" ? parseNumber(curRaw) : null;
    if (!keyword) {
      errors.push(`line ${line}: keyword missing`);
      return;
    }
    if (!Number.isFinite(volume) || volume < 0) {
      errors.push(`line ${line}: volume is not a number`);
      return;
    }
    if (!Number.isFinite(target) || target < 1) {
      errors.push(`line ${line}: target position is not a number \u2265 1`);
      return;
    }
    if (current !== null && (!Number.isFinite(current) || current < 1)) {
      errors.push(`line ${line}: current position is not a number \u2265 1`);
      return;
    }
    const intentRaw = col.intent >= 0 ? r[col.intent] : "";
    const intent = parseIntent(intentRaw);
    if (intentRaw && intentRaw.trim() && !intent) {
      errors.push(`line ${line}: intent must be informational, commercial or transactional`);
      return;
    }
    keywords.push({
      keyword,
      volume,
      currentPosition: current,
      targetPosition: target,
      ...(() => {
        const a = col.aio >= 0 ? parseAio(r[col.aio]) : { aio: false, citation: null };
        return { aio: a.aio, aioCitation: a.citation };
      })(),
      brand: col.brand >= 0 ? truthy(r[col.brand]) : false,
      intent
    });
  });
  return { keywords, errors };
}
function searchConsoleFromCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return { rows: [], errors: ["no data rows"] };
  const header = rows[0];
  const ci = indexOf(header, ["clicks", "klicks"]);
  const ii = indexOf(header, ["impressions", "impressionen"]);
  const pi = indexOf(header, ["position"]);
  const errors = [];
  if (ci < 0) errors.push("column missing: clicks");
  if (ii < 0) errors.push("column missing: impressions");
  if (pi < 0) errors.push("column missing: position");
  if (errors.length) return { rows: [], errors };
  const out = [];
  for (const r of rows.slice(1)) {
    const row = { clicks: parseNumber(r[ci]), impressions: parseNumber(r[ii]), position: parseNumber(r[pi]) };
    if (Number.isFinite(row.clicks) && Number.isFinite(row.impressions) && Number.isFinite(row.position)) out.push(row);
  }
  return { rows: out, errors };
}
var esc = (v) => {
  const s = String(v);
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
function resultToCsv(result) {
  const months = result.totals.monthly.map((_, i) => `month_${i + 1}`);
  const head = ["keyword", "volume", "current_position", "target_position", "aio", "brand", "intent", "curve", "current_ctr_percent", "target_ctr_percent", "current_clicks", "target_clicks", ...months];
  const lines = [head.join(",")];
  for (const k of result.keywords) {
    lines.push([k.keyword, k.volume, k.currentPosition ?? "", k.targetPosition, k.aio ? k.aioCitation === "cited" ? "cited" : k.aioCitation === "not-cited" ? "not cited" : "yes" : "no", k.brand ? "yes" : "no", k.intent ?? "", k.curveId, k.currentCtr, k.targetCtr, k.currentClicks, k.targetClicks, ...k.monthly].map(esc).join(","));
  }
  if ((result.settings.userCtrFactor ?? 100) !== 100) lines.push(["NOTE", `user CTR factor ${result.settings.userCtrFactor} % applied (assumption without source)`].map(esc).join(","));
  lines.push(["TOTAL", "", "", "", "", "", "", "", "", "", result.totals.currentClicks, result.totals.targetClicks, ...result.totals.monthly].map(esc).join(","));
  return lines.join("\n") + "\n";
}
function funnelToCsv(f) {
  const head = ["month", "clicks", "leads", "customers", "revenue", "gross_profit", "investment", "net_profit", "cumulative_revenue", "cumulative_gross_profit", "cumulative_investment", "cumulative_net_profit", "cumulative_roi_percent"];
  const lines = [head.join(",")];
  for (const m of f.months) {
    lines.push([m.month, m.clicks, m.leads, m.customers, m.revenue, m.grossProfit, m.investment, m.netProfit, m.cumulativeRevenue, m.cumulativeGrossProfit, m.cumulativeInvestment, m.cumulativeNetProfit, m.cumulativeRoi ?? ""].map(esc).join(","));
  }
  const t = f.totals;
  lines.push(["TOTAL", t.clicks, t.leads, t.customers, t.revenue, t.grossProfit, t.investment, t.netProfit, "", "", "", "", t.roi ?? ""].map(esc).join(","));
  const s = f.settings;
  lines.push("");
  lines.push(["basis", s.basis].join(","));
  lines.push(["lead_rate_percent", s.leadRate].join(","));
  for (const [k, v] of Object.entries(s.leadRateByIntent || {})) lines.push([`lead_rate_${k}_percent`, v].join(","));
  lines.push(["close_rate_percent", s.closeRate].join(","));
  lines.push(["customer_value", s.customerValue].join(","));
  lines.push(["margin_percent", s.margin].join(","));
  lines.push(["monthly_investment", s.monthlyInvestment ?? 0].join(","));
  lines.push(["one_off_investment", s.oneOffInvestment ?? 0].join(","));
  return lines.join("\n") + "\n";
}

// src/data.ts
function curvesFromFile(file, lang) {
  return file.curves.map((c) => {
    const aio = c.aio.type === "curve" ? { type: "curve", ctr: c.aio.ctr, source: c.aio.source } : { type: "reduction", changePercent: file.aio_reductions[c.aio.source].change_percent, source: file.aio_reductions[c.aio.source].source };
    return { id: c.id, label: c.label[lang], shortLabel: c.short?.[lang], ctr: c.ctr, aio, source: c.source };
  });
}
function wordCount(keyword) {
  return keyword.trim().split(/\s+/).filter(Boolean).length;
}
var NOTES = {
  en: { longer: (n, max) => `${n} words: no published curve beyond ${max} words, the ${max}-word curve is used` },
  de: { longer: (n, max) => `${n} W\xF6rter: \xDCber ${max} W\xF6rter hinaus ist keine Kurve ver\xF6ffentlicht, es gilt die ${max}-Wort-Kurve` }
};
function presetsFromFile(file, lang) {
  const curves = curvesFromFile(file, lang);
  const byId = (id) => {
    const c = curves.find((x) => x.id === id);
    if (!c) throw new Error(`unknown curve ${id}`);
    return c;
  };
  const list = file.presets && file.presets.length ? file.presets : file.curves.map((c) => ({ id: c.id, type: "single", label: c.label, curve: c.id }));
  return list.map((p) => {
    if (p.type === "brand") {
      const normal = byId(p.default);
      const brand = byId(p.brand);
      return {
        id: p.id,
        label: p.label[lang],
        type: "brand",
        curves: [normal, brand],
        choice: { id: p.id, pick: (k) => ({ curve: k.brand ? brand : normal }) }
      };
    }
    if (p.type === "query-length") {
      const sizes = Object.keys(p.by_words).map(Number).sort((a, b) => a - b);
      const max = sizes[sizes.length - 1];
      const map = new Map(sizes.map((n) => [n, byId(p.by_words[String(n)])]));
      return {
        id: p.id,
        label: p.label[lang],
        type: "query-length",
        curves: sizes.map((n) => map.get(n)),
        choice: {
          id: p.id,
          pick: (k) => {
            const n = Math.max(1, wordCount(k.keyword));
            if (n > max) return { curve: map.get(max), note: NOTES[lang].longer(n, max) };
            return { curve: map.get(n) };
          }
        }
      };
    }
    const c = byId(p.curve);
    return { id: p.id, label: p.label[lang], type: "single", curves: [c], choice: c };
  });
}

// src/ui.ts
function strings(lang, currency) {
  const locale = lang === "de" ? "de-DE" : "en-US";
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const nf0 = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const cur = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 });
  const cur2 = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 });
  const pct = (n) => nf2.format(n) + (lang === "de" ? " %" : "%");
  const base = { nf, nf0, nf2, cur, cur2, pct, locale };
  if (lang === "de") return {
    ...base,
    title: "SEO-Prognose",
    live: "Live",
    months: "Zeitraum",
    ramp: "Hochlauf",
    monthsUnit: "Mon.",
    keywords: "Keywords",
    addRow: "+ Keyword",
    importKeywords: "CSV laden",
    importGsc: "Search-Console-Kurve",
    template: "CSV-Vorlage",
    exampleKw: "Beispiel-Keywords. \xDCberschreiben Sie sie mit Ihren eigenen.",
    kwName: "Keyword",
    volume: "Suchvolumen",
    target: "Ziel-Rang",
    current: "Rang heute",
    currentNone: "rankt nicht",
    intent: "Suchabsicht",
    intents: { "": "Absicht offen", informational: "Informational", commercial: "Kommerziell", transactional: "Transaktional" },
    brand: "Marke",
    aio: "AI Overview",
    aioSel: { "": "Keine AI Overview", yes: "AI Overview", cited: "AI Overview, zitiert", "not-cited": "AI Overview, nicht zitiert" },
    expected: "Erwartete CTR",
    perMonth: "Klicks/Monat",
    remove: "Keyword entfernen",
    curveH: "CTR-Grundlage",
    curve: "CTR-Kurve",
    ownCurve: "Eigene Kurve aus der Search Console",
    userFactor: "Eigener CTR-Faktor",
    assumption: "Eigene Annahme",
    userFactorHelp: "Ohne Quelle, z. B. f\xFCr Snippets, Anzeigen oder Mobil. F\xFCr diese Effekte gibt es keine belegten Faktoren. 100 % = keine \xC4nderung.",
    funnelH: "Business-Funnel",
    industry: "Branche",
    industryNone: "Branche w\xE4hlen \u2026",
    industryAvg: (v) => `Durchschnitt aller Branchen \xB7 ${v}`,
    industryShort: (y) => `Lead-Rate organische Suche, Ruler Analytics ${y}. Ersetzen Sie sie durch Ihre GA4-Zahl.`,
    leadRate: "Lead-Rate",
    closeRate: "Abschlussrate",
    customerValue: "Kundenwert",
    margin: "Marge",
    invest: "SEO-Budget / Monat",
    oneOff: "Einmalig (Monat 1)",
    investPh: "optional",
    example: "Beispiel",
    exampleHelp: "Beispielwert ohne Quelle. Tragen Sie Ihre eigene Zahl ein.",
    basis: "Rechnen mit",
    basisAdditional: "Zusatz-Klicks",
    basisTotal: "Allen Klicks",
    intentRates: "Lead-Rate je Suchabsicht",
    intentRatesHelp: "Optional, wenn Sie je Suchabsicht eigene Raten kennen.",
    kpiTraffic: (b) => b === "additional" ? "Zusatz-Traffic" : "Traffic",
    kpiTrafficSub: "Klicks pro Monat im Ziel",
    kpiRevenue: "Umsatz-Potenzial",
    kpiRevenueSub: "pro Monat im Ziel",
    kpiNet: "Reingewinn",
    kpiGross: "Rohertrag",
    kpiNetSub: "pro Monat im Ziel",
    kpiRoi: "ROI",
    kpiRoiNone: "SEO-Budget eintragen",
    kpiRoiSub: (n) => `nach ${n} Monaten`,
    perEuro: (v) => `1 \u20AC bringt ${v}`,
    breakEven: (m, n) => m === null ? `Kein Break-even in ${n} Monaten` : `Break-even in Monat ${m}`,
    tabMoney: "Rohertrag",
    tabClicks: "Klicks",
    legendGross: "Rohertrag kumuliert",
    legendInvest: "Investition kumuliert",
    legendClicks: "Klicks",
    legendToday: "heute",
    month: "Monat",
    monthShort: "M",
    kpiTable: "Performance",
    colPerMonth: "Monatlich im Ziel",
    colCumulative: (n) => `Kumuliert ${n} Monate`,
    rowClicks: "Klicks",
    rowLeads: "Leads",
    rowCustomers: "Kunden",
    rowRevenue: "Umsatz",
    rowGross: "Rohertrag",
    rowInvest: "Investition",
    rowNet: "Reingewinn",
    kwTable: "Je Keyword",
    colKw: "Keyword",
    colPos: "Rang",
    colCtr: "CTR",
    colClicks: "Klicks / Monat",
    monthly: "Monat f\xFCr Monat",
    colCumNet: "Reingewinn kum.",
    colRoi: "ROI kum.",
    exportClicks: "Klicks als CSV",
    exportFunnel: "Funnel als CSV",
    funnelMissing: "Lead-Rate, Abschlussrate und Kundenwert eintragen, dann erscheinen Umsatz und Gewinn.",
    funnelInvalid: "Raten und Marge zwischen 0 und 100, Betr\xE4ge nicht negativ.",
    notes: "Hinweise",
    errors: "Bitte pr\xFCfen",
    warnBeyond: (which, p) => `F\xFCr ${which === "current" ? "den heutigen Rang" : "den Ziel-Rang"} ${p} hat diese Kurve keine Daten; z\xE4hlt als 0 Klicks.`,
    warnNoAio: (p) => `F\xFCr Rang ${p} ist kein AI-Overview-Abschlag ver\xF6ffentlicht; es gilt die CTR ohne AI Overview.`,
    userFactorNote: (f) => `Eigener CTR-Faktor ${f} angewendet. Das ist Ihre Annahme, keine belegte Zahl.`,
    invalid: (kw) => `${kw || "(ohne Name)"}: Suchvolumen \u2265 0 und Ziel-Rang \u2265 1 eintragen.`,
    noKeywords: "F\xFCgen Sie mindestens ein Keyword hinzu.",
    assumptions: "Annahmen und Quellen",
    formula: "Klicks pro Monat = Suchvolumen \xD7 CTR des Rangs \xD7 AI-Overview-Faktor \xD7 eigener CTR-Faktor. Bis zum Ziel-Rang steigen die Klicks linear \xFCber die Hochlauf-Monate.",
    formulaFunnel: "Leads = Klicks \xD7 Lead-Rate (je Keyword nach Suchabsicht, falls angegeben) \xB7 Kunden = Leads \xD7 Abschlussrate \xB7 Umsatz = Kunden \xD7 Kundenwert \xB7 Rohertrag = Umsatz \xD7 Marge \xB7 Reingewinn = Rohertrag \u2212 Investition \xB7 ROI = (Rohertrag \u2212 Investition) \xF7 Investition, kumuliert.",
    source: "Quelle",
    position: "Rang",
    ctrAioShort: "mit AIO",
    noData: "keine Daten",
    aioReduction: (s) => `Mit AI Overview (Zitierung unbekannt) sinkt die CTR um den ver\xF6ffentlichten Abschlag je Rang (${s}).`,
    aioCurve: "Mit AI Overview (Zitierung unbekannt) gilt die eigene CTR-Spalte derselben Quelle.",
    aioNone: "F\xFCr die eigene Kurve gibt es keinen AI-Overview-Abschlag; Ihre Search-Console-Daten enthalten den Effekt bereits.",
    citedNote: (f) => `Zitiert: CTR \xD7 ${f} gegen\xFCber keiner AI Overview (Seer 2026).`,
    notCitedNote: (f, lo) => `Nicht zitiert: CTR \xD7 ${f} (Seer 2026, ohne ein Konto mit 47 % der Impressionen; mit ihm \xD7 ${lo}).`,
    citation: (l) => `Ist bekannt, ob Ihre Seite in der AI Overview zitiert wird, gilt statt des Durchschnitts: ${l}`,
    presetBrand: "Keywords mit \u201EMarke\u201C nutzen die Marken-Kurve, alle anderen die Kurve ohne Marke.",
    presetLength: "Jedes Keyword nutzt die Kurve f\xFCr seine Wortzahl (1 bis 4 W\xF6rter).",
    gscInfo: (n) => `Eigene Kurve aus ${n} Zeilen Ihres Search-Console-Exports; R\xE4nge mit weniger als 100 Impressionen ausgelassen.`,
    examplesNote: "Abschlussrate, Kundenwert und Marge sind als Beispiel vorbelegt, damit der Funnel sofort rechnet. F\xFCr sie gibt es keine belegten Branchenwerte; ersetzen Sie sie durch Ihre Zahlen.",
    notTaken: "Gegen\xFCber fr\xFCheren Fassungen durch Daten ersetzt: \u201EKI-Ziel/KI-Dominanz\u201C durch die Seer-Faktoren f\xFCr zitiert/nicht zitiert, Marke \xD71,8 durch die Marken-Kurve, Long-Tail \xD71,2 durch die Kurven nach Wortzahl, Branchen-Lead-Raten durch Ruler Analytics. F\xFCr Snippets, Anzeigen oder Mobil gibt es keine belegten Faktoren; daf\xFCr ist der eigene CTR-Faktor da, gekennzeichnet als Annahme. Nicht \xFCbernommen: pauschaler Lead-Aufschlag f\xFCr kommerzielle Keywords und exponentielles Wachstum.",
    local: "Alle Eingaben bleiben in Ihrem Browser. Nichts wird gespeichert oder \xFCbertragen.",
    loadFailed: "Die CTR-Daten konnten nicht geladen werden. Bitte laden Sie die Seite neu."
  };
  return {
    ...base,
    title: "SEO forecast",
    live: "Live",
    months: "Period",
    ramp: "Ramp-up",
    monthsUnit: "mo",
    keywords: "Keywords",
    addRow: "+ Keyword",
    importKeywords: "Load CSV",
    importGsc: "Search Console curve",
    template: "CSV template",
    exampleKw: "Example keywords. Overwrite them with your own.",
    kwName: "Keyword",
    volume: "Search volume",
    target: "Target rank",
    current: "Rank today",
    currentNone: "not ranking",
    intent: "Intent",
    intents: { "": "Intent open", informational: "Informational", commercial: "Commercial", transactional: "Transactional" },
    brand: "Brand",
    aio: "AI Overview",
    aioSel: { "": "No AI Overview", yes: "AI Overview", cited: "AI Overview, cited", "not-cited": "AI Overview, not cited" },
    expected: "Expected CTR",
    perMonth: "clicks/month",
    remove: "Remove keyword",
    curveH: "CTR basis",
    curve: "CTR curve",
    ownCurve: "Your own curve from Search Console",
    userFactor: "Your own CTR factor",
    assumption: "Your assumption",
    userFactorHelp: "Without a source, e.g. for snippets, ads or mobile. There are no sourced factors for these effects. 100% = no change.",
    funnelH: "Business funnel",
    industry: "Industry",
    industryNone: "Choose industry \u2026",
    industryAvg: (v) => `Average of all industries \xB7 ${v}`,
    industryShort: (y) => `Organic search lead rate, Ruler Analytics ${y}. Replace it with your GA4 figure.`,
    leadRate: "Lead rate",
    closeRate: "Close rate",
    customerValue: "Customer value",
    margin: "Margin",
    invest: "SEO budget / month",
    oneOff: "One-off (month 1)",
    investPh: "optional",
    example: "Example",
    exampleHelp: "Example value without a source. Enter your own figure.",
    basis: "Count",
    basisAdditional: "Additional clicks",
    basisTotal: "All clicks",
    intentRates: "Lead rate per intent",
    intentRatesHelp: "Optional, if you know separate rates per intent.",
    kpiTraffic: (b) => b === "additional" ? "Additional traffic" : "Traffic",
    kpiTrafficSub: "clicks per month at target",
    kpiRevenue: "Revenue potential",
    kpiRevenueSub: "per month at target",
    kpiNet: "Net profit",
    kpiGross: "Gross profit",
    kpiNetSub: "per month at target",
    kpiRoi: "ROI",
    kpiRoiNone: "Enter SEO budget",
    kpiRoiSub: (n) => `after ${n} months`,
    perEuro: (v) => `\u20AC1 returns ${v}`,
    breakEven: (m, n) => m === null ? `No break-even within ${n} months` : `Break-even in month ${m}`,
    tabMoney: "Gross profit",
    tabClicks: "Clicks",
    legendGross: "Gross profit, cumulative",
    legendInvest: "Investment, cumulative",
    legendClicks: "Clicks",
    legendToday: "today",
    month: "Month",
    monthShort: "M",
    kpiTable: "Performance",
    colPerMonth: "Per month at target",
    colCumulative: (n) => `Cumulative ${n} months`,
    rowClicks: "Clicks",
    rowLeads: "Leads",
    rowCustomers: "Customers",
    rowRevenue: "Revenue",
    rowGross: "Gross profit",
    rowInvest: "Investment",
    rowNet: "Net profit",
    kwTable: "Per keyword",
    colKw: "Keyword",
    colPos: "Rank",
    colCtr: "CTR",
    colClicks: "Clicks / month",
    monthly: "Month by month",
    colCumNet: "Net profit cum.",
    colRoi: "ROI cum.",
    exportClicks: "Clicks as CSV",
    exportFunnel: "Funnel as CSV",
    funnelMissing: "Enter lead rate, close rate and customer value to see revenue and profit.",
    funnelInvalid: "Rates and margin between 0 and 100, amounts not negative.",
    notes: "Notes",
    errors: "Please check",
    warnBeyond: (which, p) => `This curve has no data for the ${which === "current" ? "current" : "target"} rank ${p}; counts as 0 clicks.`,
    warnNoAio: (p) => `No published AI Overview reduction for rank ${p}; the CTR without AI Overview is used.`,
    userFactorNote: (f) => `Your own CTR factor of ${f} is applied. This is your assumption, not a sourced figure.`,
    invalid: (kw) => `${kw || "(no name)"}: enter search volume \u2265 0 and target rank \u2265 1.`,
    noKeywords: "Add at least one keyword.",
    assumptions: "Assumptions and sources",
    formula: "Clicks per month = search volume \xD7 CTR of the rank \xD7 AI Overview factor \xD7 your own CTR factor. Clicks rise linearly over the ramp-up months until the target rank.",
    formulaFunnel: "Leads = clicks \xD7 lead rate (per keyword by intent, if given) \xB7 Customers = leads \xD7 close rate \xB7 Revenue = customers \xD7 customer value \xB7 Gross profit = revenue \xD7 margin \xB7 Net profit = gross profit \u2212 investment \xB7 ROI = (gross profit \u2212 investment) \xF7 investment, cumulative.",
    source: "Source",
    position: "Rank",
    ctrAioShort: "with AIO",
    noData: "no data",
    aioReduction: (s) => `With an AI Overview (citation unknown), CTR drops by the published reduction per rank (${s}).`,
    aioCurve: "With an AI Overview (citation unknown), the separate CTR column of the same source applies.",
    aioNone: "Your own curve has no AI Overview reduction; your Search Console data already contains the effect.",
    citedNote: (f) => `Cited: CTR \xD7 ${f} relative to no AI Overview (Seer 2026).`,
    notCitedNote: (f, lo) => `Not cited: CTR \xD7 ${f} (Seer 2026, without one account holding 47% of impressions; with it \xD7 ${lo}).`,
    citation: (l) => `If you know whether your page is cited in the AI Overview, this applies instead of the average: ${l}`,
    presetBrand: "Keywords marked \u201CBrand\u201D use the brand curve, all others the non-brand curve.",
    presetLength: "Each keyword uses the curve for its word count (1 to 4 words).",
    gscInfo: (n) => `Your own curve from ${n} rows of your Search Console export; ranks with fewer than 100 impressions left out.`,
    examplesNote: "Close rate, customer value and margin are prefilled as examples so the funnel calculates right away. There are no sourced industry values for them; replace them with your figures.",
    notTaken: "Replaced by data compared with earlier versions: \u201CAI target/AI dominance\u201D by the Seer factors for cited/not cited, brand \xD71.8 by the brand curve, long tail \xD71.2 by the word-count curves, industry lead rates by Ruler Analytics. There are no sourced factors for snippets, ads or mobile; that is what your own CTR factor is for, labelled as an assumption. Not carried over: a flat lead bonus for commercial keywords and exponential growth.",
    local: "All input stays in your browser. Nothing is stored or transmitted.",
    loadFailed: "The CTR data could not be loaded. Please reload the page."
  };
}
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== void 0) n.textContent = text;
  return n;
}
var SVG = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs = {}, text) {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (text !== void 0) n.textContent = text;
  return n;
}
function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = el("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
function readFile(input) {
  const f = input.files && input.files[0];
  return f ? f.text() : Promise.resolve("");
}
function table(headers, rows, cls = "fc-table") {
  const wrap = el("div", "fc-table-wrap");
  const t = el("table", cls);
  const thead = el("thead");
  const hr = el("tr");
  headers.forEach((h) => hr.appendChild(el("th", void 0, h)));
  thead.appendChild(hr);
  const tbody = el("tbody");
  rows.forEach((r) => {
    const tr = el("tr");
    r.forEach((c) => tr.appendChild(el("td", void 0, c)));
    tbody.appendChild(tr);
  });
  t.append(thead, tbody);
  wrap.appendChild(t);
  return wrap;
}
var reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var Ticker = class {
  constructor(node, fmt) {
    this.node = node;
    this.fmt = fmt;
    this.value = 0;
    this.frame = 0;
  }
  set(to, text = "\u2013") {
    cancelAnimationFrame(this.frame);
    this.node.classList.remove("fc-is-bump");
    if (to === null || !Number.isFinite(to)) {
      this.node.textContent = text;
      return;
    }
    const from = this.value;
    this.value = to;
    if (reducedMotion() || Math.abs(from - to) < 1e-9) {
      this.node.textContent = this.fmt(to);
      return;
    }
    void this.node.offsetWidth;
    this.node.classList.add("fc-is-bump");
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / 420);
      const e = 1 - Math.pow(1 - p, 3);
      this.node.textContent = this.fmt(from + (to - from) * e);
      if (p < 1) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }
  stop() {
    cancelAnimationFrame(this.frame);
  }
};
var Chart = class {
  constructor(label) {
    this.paths = [];
    this.W = 720;
    this.H = 320;
    this.L = 64;
    this.R = 16;
    this.T = 16;
    this.B = 36;
    this.last = null;
    this.root = el("div", "fc-chart");
    this.svg = document.createElementNS(SVG, "svg");
    this.svg.setAttribute("class", "fc-svg");
    this.svg.setAttribute("role", "img");
    this.svg.setAttribute("aria-label", label);
    const defs = svgEl("defs");
    this.gradId = `fc-grad-${Math.random().toString(36).slice(2, 9)}`;
    const grad = svgEl("linearGradient", { id: this.gradId, x1: 0, x2: 0, y1: 0, y2: 1 });
    grad.append(svgEl("stop", { offset: "0%", class: "fc-grad-top" }), svgEl("stop", { offset: "100%", class: "fc-grad-bottom" }));
    defs.appendChild(grad);
    this.gGrid = svgEl("g");
    this.gAxis = svgEl("g");
    this.gDots = svgEl("g");
    this.cursor = svgEl("line", { class: "fc-cursor", x1: 0, x2: 0, y1: 0, y2: 0 });
    this.svg.append(defs, this.gGrid, this.gAxis, this.cursor, this.gDots);
    this.tip = el("div", "fc-tip");
    this.tip.hidden = true;
    this.root.append(this.svg, this.tip);
    this.svg.addEventListener("pointermove", (e) => this.hover(e));
    this.svg.addEventListener("pointerleave", () => this.leave());
  }
  setLabel(label) {
    this.svg.setAttribute("aria-label", label);
  }
  draw(series, fmt, label) {
    this.last = { series, fmt, label };
    const n = series[0]?.values.length || 0;
    if (!n) return;
    const width = this.root.clientWidth || this.root.parentElement?.clientWidth || 720;
    this.W = Math.max(260, Math.round(width));
    this.H = this.W < 560 ? 240 : 320;
    const raw = Math.max(1, ...series.flatMap((s) => s.values)) / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const tick = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) || 10) * mag;
    const max = tick * 4;
    this.L = Math.max(48, Math.min(120, fmt(max).length * 8.6 + 16));
    const { W, H, L, R, T, B } = this;
    const x = (i) => L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1));
    const y = (v) => T + (1 - Math.max(0, v) / max) * (H - T - B);
    this.svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    this.svg.setAttribute("width", String(W));
    this.svg.setAttribute("height", String(H));
    this.gGrid.textContent = "";
    this.gAxis.textContent = "";
    for (let g = 0; g <= 4; g++) {
      const v = max * g / 4;
      this.gGrid.appendChild(svgEl("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "fc-grid-line" }));
      this.gAxis.appendChild(svgEl("text", { x: L - 10, y: y(v) + 5, "text-anchor": "end", class: "fc-axis" }, fmt(v)));
    }
    const maxLabels = Math.max(2, Math.floor((W - L - R) / 52));
    const step = Math.max(1, Math.ceil(n / maxLabels));
    for (let i = 0; i < n; i++) {
      if (i % step === 0) {
        this.gAxis.appendChild(svgEl("text", { x: x(i), y: H - 10, "text-anchor": "middle", class: "fc-axis" }, label(i)));
      }
    }
    while (this.paths.length < series.length * 2) {
      const p = svgEl("path");
      this.svg.insertBefore(p, this.cursor);
      this.paths.push(p);
    }
    this.paths.forEach((p, idx) => {
      const s = series[Math.floor(idx / 2)];
      const isFill = idx % 2 === 0;
      if (!s || isFill && s.kind !== "area") {
        p.setAttribute("d", "M0,0");
        p.setAttribute("class", "fc-off");
        return;
      }
      const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      if (isFill) {
        p.setAttribute("d", `M${x(0).toFixed(1)},${y(0).toFixed(1)} L${pts.join(" L")} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} Z`);
        p.setAttribute("class", "fc-area");
        p.setAttribute("fill", `url(#${this.gradId})`);
      } else {
        p.setAttribute("d", `M${pts.join(" L")}`);
        p.setAttribute("class", s.kind === "dashed" ? "fc-line fc-line--dashed" : "fc-line");
      }
    });
    const main = series[0];
    this.gDots.textContent = "";
    main.values.forEach((v, i) => this.gDots.appendChild(svgEl("circle", { cx: x(i), cy: y(v), r: n > 24 ? 2.5 : 3.5, class: "fc-dot" })));
    this.cursor.setAttribute("y1", String(T));
    this.cursor.setAttribute("y2", String(H - B));
  }
  redraw() {
    if (this.last) this.draw(this.last.series, this.last.fmt, this.last.label);
  }
  leave() {
    this.tip.hidden = true;
    this.cursor.setAttribute("class", "fc-cursor");
  }
  hover(e) {
    if (!this.last) return;
    const { series, fmt, label } = this.last;
    const n = series[0].values.length;
    const box = this.svg.getBoundingClientRect();
    const scale = this.W / Math.max(1, box.width);
    const px = (e.clientX - box.left) * scale;
    const i = Math.max(0, Math.min(n - 1, Math.round((px - this.L) / (this.W - this.L - this.R) * (n - 1))));
    const cx = this.L + (n === 1 ? (this.W - this.L - this.R) / 2 : i * (this.W - this.L - this.R) / (n - 1));
    this.cursor.setAttribute("x1", String(cx));
    this.cursor.setAttribute("x2", String(cx));
    this.cursor.setAttribute("class", "fc-cursor fc-is-on");
    this.tip.textContent = "";
    this.tip.appendChild(el("strong", "fc-tip__head", label(i)));
    series.forEach((s) => {
      const row = el("span", "fc-tip__row" + (s.kind === "dashed" ? " fc-is-dashed" : ""));
      row.append(el("span", "fc-tip__name", s.name), el("span", "fc-tip__val", fmt(s.values[i])));
      this.tip.appendChild(row);
    });
    this.tip.hidden = false;
    const left = cx / scale;
    const tipW = this.tip.offsetWidth || 180;
    this.tip.style.left = `${left + 14 + tipW > box.width ? Math.max(0, left - tipW - 14) : left + 14}px`;
    this.tip.style.top = `${Math.max(0, this.T / scale)}px`;
  }
};
function defaultSrc() {
  try {
    return new URL("./ctr-curves.json", import.meta.url).href;
  } catch {
    return "ctr-curves.json";
  }
}
function mount(root, options = {}) {
  const wanted = options.lang || root.dataset.lang || document.documentElement.lang || "de";
  const lang = wanted.slice(0, 2).toLowerCase() === "en" ? "en" : "de";
  const currency = (options.currency || root.dataset.currency || "EUR").toUpperCase();
  const t = strings(lang, currency);
  const curSym = 0 .toLocaleString(t.locale, { style: "currency", currency, maximumFractionDigits: 0 }).replace(/[\d\s.,]/g, "") || currency;
  const src = options.src || root.dataset.src || defaultSrc();
  let file;
  let presets = [];
  let own = null;
  let ownInfo = "";
  let last = null;
  let lastFunnel = null;
  let chartMode = "money";
  let basis = "additional";
  let examplesActive = true;
  let uid = 0;
  const nextId = () => `fc-${++uid}-${Math.random().toString(36).slice(2, 7)}`;
  const rows = lang === "de" ? [
    { keyword: "briefing erstellen", volume: 1300, currentPosition: null, targetPosition: 3, aio: true, aioCitation: "cited", brand: false, intent: "informational" },
    { keyword: "seo agentur m\xFCnchen", volume: 880, currentPosition: 8, targetPosition: 3, aio: false, brand: false, intent: "commercial" },
    { keyword: "seo beratung", volume: 1900, currentPosition: 9, targetPosition: 2, aio: false, brand: false, intent: "commercial" }
  ] : [
    { keyword: "how to write a brief", volume: 1900, currentPosition: null, targetPosition: 3, aio: true, aioCitation: "cited", brand: false, intent: "informational" },
    { keyword: "seo agency london", volume: 1300, currentPosition: 8, targetPosition: 3, aio: false, brand: false, intent: "commercial" },
    { keyword: "seo consulting", volume: 2400, currentPosition: 9, targetPosition: 2, aio: false, brand: false, intent: "commercial" }
  ];
  root.textContent = "";
  root.classList.add("fc");
  const button = (text, cls) => {
    const b = el("button", "fc-btn " + cls, text);
    b.type = "button";
    return b;
  };
  const numInput = (value, min = "0", step = "any", max) => {
    const i = el("input", "fc-input");
    i.type = "number";
    i.min = min;
    i.step = step;
    i.value = value;
    i.inputMode = "decimal";
    if (max) i.max = max;
    return i;
  };
  const rangeInput = (min, max, value, step = 1) => {
    const i = el("input", "fc-range");
    i.type = "range";
    i.min = String(min);
    i.max = String(max);
    i.step = String(step);
    i.value = String(value);
    return i;
  };
  const labelled = (label, content, target = content) => {
    const f = el("div", "fc-field");
    target.id = nextId();
    const l = el("label", "fc-label");
    l.appendChild(el("span", void 0, label));
    l.htmlFor = target.id;
    f.append(l, content);
    return f;
  };
  const chip = (field, text, cls, title) => {
    const c = el("span", "fc-chip " + cls, text);
    if (title) c.title = title;
    field.querySelector(".fc-label")?.appendChild(c);
    return c;
  };
  const unitField = (label, input, unit, example = false) => {
    const wrap = el("div", "fc-unit");
    wrap.append(input, el("span", "fc-unit__u", unit));
    const field = labelled(label, wrap, input);
    if (example) {
      const c = chip(field, t.example, "fc-chip--example", t.exampleHelp);
      input.addEventListener("input", () => c.remove(), { once: true });
    }
    return field;
  };
  const panel = (title, extra) => {
    const box = el("section", "fc-panel");
    const head = el("div", "fc-panel__head");
    head.appendChild(el("h3", "fc-panel__title", title));
    if (extra) head.appendChild(extra);
    const body = el("div", "fc-panel__body");
    box.append(head, body);
    return { box, body };
  };
  const bar = el("div", "fc-bar");
  const brandBox = el("div", "fc-bar__brand");
  brandBox.append(el("span", "fc-bar__title", t.title), el("span", "fc-live", t.live));
  const barCtl = (label, input) => {
    const box = el("div", "fc-bar__ctl");
    input.id = nextId();
    const l = el("label", "fc-bar__label", label);
    l.htmlFor = input.id;
    const out = el("output", "fc-bar__val");
    out.htmlFor.add(input.id);
    box.append(l, input, out);
    return { box, out };
  };
  const months = rangeInput(3, 36, 12);
  const ramp = rangeInput(1, 24, 6);
  const monthsCtl = barCtl(t.months, months);
  const rampCtl = barCtl(t.ramp, ramp);
  bar.append(brandBox, rampCtl.box, monthsCtl.box);
  const side = el("div", "fc-side");
  const kwCount = el("span", "fc-count");
  const kwPanel = panel(t.keywords, kwCount);
  const kwList = el("div", "fc-kws");
  const exampleNote = el("p", "fc-note fc-note--example", t.exampleKw);
  const kwTools = el("div", "fc-tools");
  const addBtn = button(t.addRow, "fc-btn--primary fc-btn--small");
  const kwImport = button(t.importKeywords, "fc-btn--ghost fc-btn--small");
  const gscImport = button(t.importGsc, "fc-btn--ghost fc-btn--small");
  const templateBtn = button(t.template, "fc-btn--ghost fc-btn--small");
  const kwFile = el("input");
  kwFile.type = "file";
  kwFile.accept = ".csv,text/csv,text/plain";
  kwFile.hidden = true;
  const gscFile = el("input");
  gscFile.type = "file";
  gscFile.accept = ".csv,text/csv,text/plain";
  gscFile.hidden = true;
  kwTools.append(addBtn, kwImport, gscImport, templateBtn, kwFile, gscFile);
  kwPanel.body.append(exampleNote, kwList, kwTools);
  const ctrPanel = panel(t.curveH);
  const curveSel = el("select", "fc-input");
  const presetNote = el("p", "fc-note");
  const userFactor = rangeInput(50, 200, 100, 5);
  const ufBox = el("div", "fc-slider");
  const ufOut = el("output", "fc-slider__val");
  ufBox.append(userFactor, ufOut);
  const ufField = labelled(t.userFactor, ufBox, userFactor);
  chip(ufField, t.assumption, "fc-chip--assumption");
  ufField.appendChild(el("p", "fc-help", t.userFactorHelp));
  ctrPanel.body.append(labelled(t.curve, curveSel), presetNote, ufField);
  const fPanel = panel(t.funnelH);
  const industrySel = el("select", "fc-input");
  const industryNote = el("p", "fc-help");
  const leadRate = numInput("", "0", "any", "100");
  const closeRate = numInput("20", "0", "any", "100");
  const custValue = numInput("1500", "0", "any");
  const margin = numInput("40", "0", "any", "100");
  const invest = numInput("1000", "0", "any");
  const oneOff = numInput("", "0", "any");
  oneOff.placeholder = t.investPh;
  const leadInfo = numInput("", "0", "any", "100");
  const leadComm = numInput("", "0", "any", "100");
  const leadTrans = numInput("", "0", "any", "100");
  for (const i of [leadInfo, leadComm, leadTrans]) i.placeholder = t.investPh;
  const seg = (a, b) => {
    const box = el("div", "fc-seg");
    const ba = button(a, "fc-seg__btn fc-is-on");
    const bb = button(b, "fc-seg__btn");
    ba.setAttribute("aria-pressed", "true");
    bb.setAttribute("aria-pressed", "false");
    box.append(ba, bb);
    return { box, a: ba, b: bb };
  };
  const basisSeg = seg(t.basisAdditional, t.basisTotal);
  basisSeg.box.setAttribute("role", "group");
  basisSeg.box.setAttribute("aria-label", t.basis);
  const industryField = labelled(t.industry, industrySel);
  industryField.appendChild(industryNote);
  const fGrid = el("div", "fc-pair");
  fGrid.append(
    unitField(t.leadRate, leadRate, "%"),
    unitField(t.closeRate, closeRate, "%", true),
    unitField(t.customerValue, custValue, curSym, true),
    unitField(t.margin, margin, "%", true)
  );
  const iGrid = el("div", "fc-pair");
  iGrid.append(unitField(t.intents.informational, leadInfo, "%"), unitField(t.intents.commercial, leadComm, "%"), unitField(t.intents.transactional, leadTrans, "%"));
  const intentDet = el("details", "fc-more");
  intentDet.append(el("summary", void 0, t.intentRates), el("p", "fc-help", t.intentRatesHelp), iGrid);
  const invGrid = el("div", "fc-pair");
  const investField = unitField(t.invest, invest, curSym, true);
  invGrid.append(investField, unitField(t.oneOff, oneOff, curSym));
  const basisField = el("div", "fc-field");
  basisField.append(el("span", "fc-label", t.basis), basisSeg.box);
  fPanel.body.append(industryField, fGrid, invGrid, basisField, intentDet);
  side.append(kwPanel.box, ctrPanel.box, fPanel.box);
  const main = el("div", "fc-main");
  const kpis = el("div", "fc-kpis");
  const kpi = (mod) => {
    const box = el("div", "fc-kpi " + mod);
    const label = el("p", "fc-kpi__label");
    const value = el("p", "fc-kpi__value", "\u2013");
    const sub = el("p", "fc-kpi__sub");
    box.append(label, value, sub);
    return { box, label, value, sub };
  };
  const kTraffic = kpi("fc-kpi--traffic");
  const kRevenue = kpi("fc-kpi--revenue");
  const kProfit = kpi("fc-kpi--profit");
  const kRoi = kpi("fc-kpi--roi");
  kpis.append(kTraffic.box, kRevenue.box, kProfit.box, kRoi.box);
  const tickTraffic = new Ticker(kTraffic.value, (n) => t.nf0.format(n));
  const tickRevenue = new Ticker(kRevenue.value, (n) => t.cur.format(n));
  const tickProfit = new Ticker(kProfit.value, (n) => t.cur.format(n));
  const tickRoi = new Ticker(kRoi.value, (n) => t.pct(Math.round(n)));
  const chartBox = el("section", "fc-console");
  const chartHead = el("div", "fc-chart__head");
  const tabs = seg(t.tabMoney, t.tabClicks);
  tabs.box.classList.add("fc-seg--dark");
  tabs.box.setAttribute("role", "group");
  const legend = el("div", "fc-legend");
  chartHead.append(tabs.box, legend);
  const chart = new Chart(t.tabMoney);
  const chartFoot = el("p", "fc-chart__foot");
  chartBox.append(chartHead, chart.root, chartFoot);
  const perfBox = el("section", "fc-card");
  const perfBody = el("div");
  const funnelMsg = el("p", "fc-note");
  perfBox.append(el("h3", "fc-card__title", t.kpiTable), funnelMsg, perfBody);
  const kwResBox = el("section", "fc-card");
  const kwResBody = el("div");
  const warnBox = el("div", "fc-warnings");
  const messages = el("div", "fc-messages");
  messages.setAttribute("role", "status");
  messages.setAttribute("aria-live", "polite");
  const actions = el("div", "fc-tools");
  const exportBtn = button(t.exportClicks, "fc-btn--ghost fc-btn--small");
  const exportFunnelBtn = button(t.exportFunnel, "fc-btn--ghost fc-btn--small");
  actions.append(exportBtn, exportFunnelBtn);
  kwResBox.append(el("h3", "fc-card__title", t.kwTable), kwResBody, warnBox, actions);
  main.append(messages, kpis, chartBox);
  const below = el("div", "fc-below");
  below.append(perfBox, kwResBox);
  const cockpit = el("div", "fc-cockpit");
  cockpit.append(side, main);
  const assumptions = el("details", "fc-assumptions");
  assumptions.appendChild(el("summary", void 0, t.assumptions));
  const assBody = el("div", "fc-assumptions__body");
  assumptions.appendChild(assBody);
  root.append(bar, cockpit, below, assumptions, el("p", "fc-local", t.local));
  const kwOut = [];
  function markOwnInput() {
    if (!examplesActive) return;
    examplesActive = false;
    exampleNote.remove();
  }
  function renderRows() {
    kwList.textContent = "";
    kwOut.length = 0;
    kwCount.textContent = String(rows.length);
    rows.forEach((r, i) => {
      const card = el("div", "fc-kw");
      const top = el("div", "fc-kw__top");
      const name = el("input", "fc-input fc-kw__name");
      name.type = "text";
      name.value = r.keyword;
      name.placeholder = t.kwName;
      name.setAttribute("aria-label", `${t.kwName} ${i + 1}`);
      name.addEventListener("input", () => {
        r.keyword = name.value.trim();
        markOwnInput();
        update();
      });
      const del = button("\xD7", "fc-btn--icon");
      del.setAttribute("aria-label", `${t.remove}: ${r.keyword || i + 1}`);
      del.title = t.remove;
      del.addEventListener("click", () => {
        rows.splice(i, 1);
        markOwnInput();
        renderRows();
        update();
      });
      top.append(name, del);
      const vol = numInput(Number.isFinite(r.volume) ? String(r.volume) : "");
      vol.addEventListener("input", () => {
        r.volume = vol.value === "" ? NaN : Number(vol.value);
        markOwnInput();
        update();
      });
      const cur = numInput(r.currentPosition === null ? "" : String(r.currentPosition), "1", "0.1");
      cur.placeholder = t.currentNone;
      cur.addEventListener("input", () => {
        r.currentPosition = cur.value.trim() === "" ? null : Number(cur.value);
        markOwnInput();
        update();
      });
      const nums = el("div", "fc-pair");
      nums.append(labelled(t.volume, vol), labelled(t.current, cur));
      const rank = rangeInput(1, 20, Math.min(20, Math.max(1, Math.round(r.targetPosition))));
      const badge = el("output", "fc-badge", `#${rank.value}`);
      const rankBox = el("div", "fc-slider");
      rankBox.append(rank, badge);
      rank.addEventListener("input", () => {
        r.targetPosition = Number(rank.value);
        badge.textContent = `#${rank.value}`;
        markOwnInput();
        update();
      });
      const rankField = labelled(t.target, rankBox, rank);
      const chips = el("div", "fc-kw__chips");
      const intent = el("select", "fc-input fc-input--chip");
      for (const [v, l] of Object.entries(t.intents)) {
        const o = el("option", void 0, l);
        o.value = v;
        intent.appendChild(o);
      }
      intent.value = r.intent || "";
      intent.setAttribute("aria-label", `${t.intent} ${i + 1}`);
      intent.addEventListener("change", () => {
        r.intent = intent.value || null;
        markOwnInput();
        update();
      });
      const aio = el("select", "fc-input fc-input--chip");
      for (const [v, l] of Object.entries(t.aioSel)) {
        const o = el("option", void 0, l);
        o.value = v;
        aio.appendChild(o);
      }
      aio.value = !r.aio ? "" : r.aioCitation || "yes";
      aio.setAttribute("aria-label", `${t.aio} ${i + 1}`);
      aio.addEventListener("change", () => {
        r.aio = aio.value !== "";
        r.aioCitation = aio.value === "cited" || aio.value === "not-cited" ? aio.value : null;
        markOwnInput();
        update();
      });
      const brandLbl = el("label", "fc-toggle");
      const brand = el("input");
      brand.type = "checkbox";
      brand.checked = !!r.brand;
      brand.addEventListener("change", () => {
        r.brand = brand.checked;
        markOwnInput();
        update();
      });
      brandLbl.append(brand, el("span", void 0, t.brand));
      chips.append(intent, aio, brandLbl);
      const out = el("div", "fc-kw__out");
      const ctrOut = el("span", "fc-kw__ctr", "\u2013");
      const clickOut = el("span", "fc-kw__clicks");
      const meter = el("span", "fc-meter");
      const meterBar = el("span", "fc-meter__bar");
      meter.appendChild(meterBar);
      const line = el("div", "fc-kw__outline");
      line.append(el("span", "fc-kw__outlabel", t.expected), ctrOut);
      const note = el("span", "fc-kw__note");
      out.append(line, meter, clickOut, note);
      kwOut.push({ ctr: ctrOut, clicks: clickOut, bar: meterBar, note });
      card.append(top, nums, rankField, chips, out);
      kwList.appendChild(card);
    });
  }
  function renderPresetOptions() {
    const selected = curveSel.value;
    curveSel.textContent = "";
    for (const p of [...presets, ...own ? [own] : []]) {
      const o = el("option", void 0, p.label);
      o.value = p.id;
      curveSel.appendChild(o);
    }
    curveSel.value = selected && [...curveSel.options].some((o) => o.value === selected) ? selected : presets[0].id;
  }
  const currentPreset = () => own && curveSel.value === own.id ? own : presets.find((p) => p.id === curveSel.value) || presets[0];
  function showMessages(list) {
    messages.textContent = "";
    if (!list.length) return;
    const box = el("div", "fc-msg");
    box.appendChild(el("p", "fc-label", t.errors));
    const ul = el("ul");
    list.forEach((m) => ul.appendChild(el("li", void 0, m)));
    box.appendChild(ul);
    messages.appendChild(box);
  }
  const num = (i) => i.value.trim() === "" ? void 0 : Number(i.value);
  function funnelSettings() {
    const lr = num(leadRate), cr = num(closeRate), cv = num(custValue);
    if (lr === void 0 || cr === void 0 || cv === void 0) return null;
    const byIntent = {};
    const li = num(leadInfo), lc = num(leadComm), lt = num(leadTrans);
    if (li !== void 0) byIntent.informational = li;
    if (lc !== void 0) byIntent.commercial = lc;
    if (lt !== void 0) byIntent.transactional = lt;
    return {
      leadRate: lr,
      closeRate: cr,
      customerValue: cv,
      margin: num(margin) ?? 100,
      leadRateByIntent: byIntent,
      monthlyInvestment: num(invest),
      oneOffInvestment: num(oneOff),
      basis
    };
  }
  function renderAll(result) {
    const maxClicks = Math.max(1, ...result.keywords.map((k) => k.targetClicks));
    result.keywords.forEach((k, i) => {
      const o = kwOut[i];
      if (!o) return;
      o.ctr.textContent = t.pct(Math.round(k.targetCtr * 100) / 100);
      o.clicks.textContent = `${t.nf0.format(k.currentClicks)} \u2192 ${t.nf0.format(k.targetClicks)} ${t.perMonth}`;
      o.bar.style.transform = `scaleX(${(k.targetClicks / maxClicks).toFixed(3)})`;
      const c = file.aio_citation;
      o.note.textContent = !k.aio || !c ? "" : k.aioCitation === "cited" ? t.citedNote(t.nf2.format(c.cited)) : k.aioCitation === "not-cited" ? t.notCitedNote(t.nf2.format(c.not_cited), t.nf2.format((c.not_cited_range || [c.not_cited])[0])) : "";
    });
    const fs = funnelSettings();
    const valid = fs ? validateFunnel(fs).length === 0 : false;
    const f = fs && valid ? funnel(result, fs) : null;
    lastFunnel = f;
    exportFunnelBtn.disabled = !f;
    const n = result.totals.monthly.length;
    const hasInv = !!f && f.totals.investment > 0;
    const atTargetClicks = result.keywords.reduce((s, k) => s + (basis === "additional" ? Math.max(0, k.targetClicks - k.currentClicks) : k.targetClicks), 0);
    kTraffic.label.textContent = t.kpiTraffic(basis);
    kTraffic.sub.textContent = t.kpiTrafficSub;
    tickTraffic.set(atTargetClicks);
    kRevenue.label.textContent = t.kpiRevenue;
    kRevenue.sub.textContent = t.kpiRevenueSub;
    tickRevenue.set(f ? f.atTarget.revenue : null);
    kProfit.label.textContent = hasInv ? t.kpiNet : t.kpiGross;
    kProfit.sub.textContent = t.kpiNetSub;
    tickProfit.set(f ? hasInv ? f.atTarget.netProfit : f.atTarget.grossProfit : null);
    kProfit.box.classList.toggle("fc-is-negative", !!f && hasInv && f.atTarget.netProfit < 0);
    kRoi.label.textContent = t.kpiRoi;
    if (f && hasInv && f.totals.roi !== null) {
      tickRoi.set(f.totals.roi);
      kRoi.sub.textContent = `${t.kpiRoiSub(n)} \xB7 ${t.perEuro(t.cur2.format(f.totals.returnPerEuro ?? 0))}`;
      kRoi.box.classList.toggle("fc-is-negative", f.totals.roi < 0);
    } else {
      tickRoi.set(null);
      kRoi.sub.textContent = t.kpiRoiNone;
      kRoi.box.classList.remove("fc-is-negative");
    }
    const monthLabel = (i) => `${t.monthShort}${i + 1}`;
    legend.textContent = "";
    const leg = (cls, text) => legend.appendChild(el("span", "fc-legend__item " + cls, text));
    if (chartMode === "money" && f) {
      const series = [{ name: t.legendGross, values: f.months.map((m) => m.cumulativeGrossProfit), kind: "area" }];
      if (hasInv) series.push({ name: t.legendInvest, values: f.months.map((m) => m.cumulativeInvestment), kind: "dashed" });
      leg("fc-is-main", t.legendGross);
      if (hasInv) leg("fc-is-dashed", t.legendInvest);
      chart.setLabel(t.tabMoney);
      chart.draw(series, (v) => t.cur.format(v), monthLabel);
      chartFoot.textContent = hasInv ? t.breakEven(f.totals.breakEvenMonth, n) : "";
      chartFoot.classList.toggle("fc-is-good", hasInv && f.totals.breakEvenMonth !== null);
    } else {
      const series = [
        { name: t.legendClicks, values: result.totals.monthly, kind: "area" },
        { name: t.legendToday, values: result.totals.monthly.map(() => result.totals.currentClicks), kind: "dashed" }
      ];
      leg("fc-is-main", t.legendClicks);
      leg("fc-is-dashed", t.legendToday);
      chart.setLabel(t.tabClicks);
      chart.draw(series, (v) => t.nf0.format(v), monthLabel);
      chartFoot.textContent = chartMode === "money" ? t.funnelMissing : "";
      chartFoot.classList.remove("fc-is-good");
    }
    perfBody.textContent = "";
    funnelMsg.textContent = !fs ? t.funnelMissing : !valid ? t.funnelInvalid : "";
    const cumClicks = f ? f.totals.clicks : result.totals.monthly.reduce((s, v) => s + (basis === "additional" ? Math.max(0, v - result.totals.currentClicks) : v), 0);
    const rowsKpi = [[t.rowClicks, t.nf0.format(atTargetClicks), t.nf0.format(cumClicks)]];
    if (f) {
      rowsKpi.push(
        [t.rowLeads, t.nf.format(f.atTarget.leads), t.nf.format(f.totals.leads)],
        [t.rowCustomers, t.nf.format(f.atTarget.customers), t.nf.format(f.totals.customers)],
        [t.rowRevenue, t.cur.format(f.atTarget.revenue), t.cur.format(f.totals.revenue)],
        [t.rowGross, t.cur.format(f.atTarget.grossProfit), t.cur.format(f.totals.grossProfit)]
      );
      if (hasInv) {
        rowsKpi.push([t.rowInvest, t.cur.format(fs?.monthlyInvestment || 0), t.cur.format(f.totals.investment)]);
        rowsKpi.push([t.rowNet, t.cur.format(f.atTarget.netProfit), t.cur.format(f.totals.netProfit)]);
      }
    }
    const perfTable = table(["", t.colPerMonth, t.colCumulative(n)], rowsKpi, "fc-table fc-table--kpi");
    if (f) perfTable.querySelector("tbody tr:last-child")?.classList.add("fc-is-total");
    perfBody.appendChild(perfTable);
    if (f) {
      const det = el("details", "fc-more");
      det.appendChild(el("summary", void 0, t.monthly));
      det.appendChild(table(
        [t.month, t.rowClicks, t.rowLeads, t.rowCustomers, t.rowRevenue, t.rowGross, ...hasInv ? [t.colCumNet, t.colRoi] : []],
        f.months.map((m) => [
          String(m.month),
          t.nf0.format(m.clicks),
          t.nf.format(m.leads),
          t.nf2.format(m.customers),
          t.cur.format(m.revenue),
          t.cur.format(m.grossProfit),
          ...hasInv ? [t.cur.format(m.cumulativeNetProfit), m.cumulativeRoi === null ? "\u2013" : t.pct(Math.round(m.cumulativeRoi))] : []
        ]),
        "fc-table fc-table--num"
      ));
      perfBody.appendChild(det);
    }
    kwResBody.textContent = "";
    kwResBody.appendChild(table(
      [t.colKw, t.colPos, t.colCtr, t.colClicks],
      result.keywords.map((k) => [
        k.keyword + (k.aio ? ` \xB7 ${t.aioSel[k.aioCitation || "yes"]}` : ""),
        `${k.currentPosition === null ? "\u2013" : t.nf.format(k.currentPosition)} \u2192 ${t.nf.format(k.targetPosition)}`,
        `${t.pct(Math.round(k.currentCtr * 100) / 100)} \u2192 ${t.pct(Math.round(k.targetCtr * 100) / 100)}`,
        `${t.nf.format(k.currentClicks)} \u2192 ${t.nf.format(k.targetClicks)}`
      ]),
      "fc-table fc-table--num"
    ));
    warnBox.textContent = "";
    const warns = result.keywords.flatMap((k) => k.warnings.map((w) => `${k.keyword}: ${w.type === "beyond-data" ? t.warnBeyond(w.which, Math.round(w.position)) : w.type === "no-aio-reduction" ? t.warnNoAio(w.position) : w.message}`));
    const uf = result.settings.userCtrFactor ?? 100;
    if (uf !== 100) warns.unshift(t.userFactorNote(t.pct(uf)));
    if (warns.length) {
      warnBox.appendChild(el("p", "fc-label", t.notes));
      const ul = el("ul");
      warns.forEach((w) => ul.appendChild(el("li", void 0, w)));
      warnBox.appendChild(ul);
    }
  }
  const link = (text, href) => {
    const a = el("a", void 0, text);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    return a;
  };
  const method = (key) => {
    const s = file.sources[key];
    return s ? lang === "de" && s.method_de || s.method : "";
  };
  function renderAssumptions(preset) {
    assBody.textContent = "";
    assBody.append(el("p", void 0, t.formula), el("p", void 0, t.formulaFunnel));
    const first = preset.curves[0];
    const s = first.source ? file.sources[first.source] : null;
    const p = el("p");
    if (s && first.source) {
      p.append(
        document.createTextNode(`${t.curve}: ${preset.label}. ${t.source}: `),
        link(`${s.publisher}, ${s.title}`, s.url),
        document.createTextNode(` (${s.market}, ${s.data_period}). ${method(first.source)}`)
      );
    } else {
      p.textContent = ownInfo;
    }
    assBody.appendChild(p);
    if (preset.type === "brand") assBody.appendChild(el("p", void 0, t.presetBrand));
    if (preset.type === "query-length") assBody.appendChild(el("p", void 0, t.presetLength));
    if (first.aio.type === "reduction") {
      const r = first.aio.source ? file.sources[first.aio.source] : null;
      const ap = el("p");
      ap.appendChild(document.createTextNode(t.aioReduction(r ? `${r.publisher}, ${r.data_period}` : "")));
      if (r && first.aio.source) ap.append(document.createTextNode(" "), link(r.title, r.url), document.createTextNode(`. ${method(first.aio.source)}`));
      assBody.appendChild(ap);
    } else {
      assBody.appendChild(el("p", void 0, first.aio.type === "curve" ? t.aioCurve : t.aioNone));
    }
    if (file.aio_citation && first.aio.type !== "none") {
      const c = file.aio_citation;
      const cp = el("p");
      cp.append(document.createTextNode(t.citation(c.label[lang]) + " "), link(c.source_ref.name, c.source_ref.url), document.createTextNode(`. ${method(c.source)}`));
      assBody.appendChild(cp);
    }
    const lr = file.industry_lead_rates;
    if (lr) {
      const lp = el("p");
      lp.append(document.createTextNode(`${t.industry}: ${industrySel.selectedOptions[0]?.textContent || ""}. ${lr.note[lang]} ${t.source}: `), link(lr.source_ref.name, lr.source_ref.url), document.createTextNode(`. ${method(lr.source)}`));
      assBody.appendChild(lp);
    }
    assBody.appendChild(el("p", void 0, t.examplesNote));
    const uf = Number(userFactor.value);
    if (uf !== 100) assBody.appendChild(el("p", "fc-msg", t.userFactorNote(t.pct(uf))));
    const maxP = Math.max(10, ...preset.curves.map((c) => maxPosition(c.ctr)));
    const short = (c) => c.shortLabel || c.label;
    const headers = [t.position, ...preset.curves.flatMap((c) => preset.curves.length > 1 ? [short(c), `${short(c)} ${t.ctrAioShort}`] : ["CTR", `CTR ${t.ctrAioShort}`])];
    const rowsA = [];
    for (let pos = 1; pos <= maxP; pos++) {
      rowsA.push([String(pos), ...preset.curves.flatMap((c) => {
        const b = ctrFor(c, pos, false), a = ctrFor(c, pos, true);
        return [b === null ? t.noData : t.pct(b), a === null ? t.noData : t.pct(Math.round(a * 100) / 100)];
      })]);
    }
    assBody.appendChild(table(headers, rowsA, "fc-table fc-table--num fc-table--compact"));
    const ul = el("ul", "fc-caveats");
    file.caveats[lang].forEach((c) => ul.appendChild(el("li", void 0, c)));
    ul.appendChild(el("li", void 0, t.notTaken));
    assBody.appendChild(ul);
  }
  function update() {
    monthsCtl.out.textContent = `${months.value} ${t.monthsUnit}`;
    rampCtl.out.textContent = `${ramp.value} ${t.monthsUnit}`;
    ufOut.textContent = t.pct(Number(userFactor.value));
    ufOut.classList.toggle("fc-is-changed", userFactor.value !== "100");
    const preset = currentPreset();
    presetNote.textContent = own && preset === own ? ownInfo : preset.type === "brand" ? t.presetBrand : preset.type === "query-length" ? t.presetLength : "";
    renderAssumptions(preset);
    last = null;
    exportBtn.disabled = true;
    if (!rows.length) {
      showMessages([t.noKeywords]);
      return;
    }
    const invalid = rows.filter((r) => !Number.isFinite(r.volume) || r.volume < 0 || !Number.isFinite(r.targetPosition) || r.targetPosition < 1 || r.currentPosition !== null && (!Number.isFinite(r.currentPosition) || r.currentPosition < 1));
    if (invalid.length) {
      showMessages(invalid.map((r) => t.invalid(r.keyword)));
      return;
    }
    try {
      const cf = file.aio_citation ? { cited: file.aio_citation.cited, notCited: file.aio_citation.not_cited } : void 0;
      const named = rows.map((r, i) => ({ ...r, keyword: r.keyword || `${t.kwName} ${i + 1}` }));
      last = forecast(preset.choice, named, {
        rampMonths: Number(ramp.value),
        horizonMonths: Number(months.value),
        citationFactors: cf,
        userCtrFactor: Number(userFactor.value)
      });
      exportBtn.disabled = false;
      showMessages([]);
      renderAll(last);
    } catch (e) {
      showMessages([e.message]);
    }
  }
  for (const i of [months, ramp, userFactor]) i.addEventListener("input", update);
  for (const i of [leadRate, closeRate, custValue, margin, invest, oneOff, leadInfo, leadComm, leadTrans]) i.addEventListener("input", update);
  curveSel.addEventListener("change", update);
  const setSeg = (s, first) => {
    s.a.classList.toggle("fc-is-on", first);
    s.b.classList.toggle("fc-is-on", !first);
    s.a.setAttribute("aria-pressed", String(first));
    s.b.setAttribute("aria-pressed", String(!first));
  };
  basisSeg.a.addEventListener("click", () => {
    basis = "additional";
    setSeg(basisSeg, true);
    update();
  });
  basisSeg.b.addEventListener("click", () => {
    basis = "total";
    setSeg(basisSeg, false);
    update();
  });
  tabs.a.addEventListener("click", () => {
    chartMode = "money";
    setSeg(tabs, true);
    if (last) renderAll(last);
  });
  tabs.b.addEventListener("click", () => {
    chartMode = "clicks";
    setSeg(tabs, false);
    if (last) renderAll(last);
  });
  industrySel.addEventListener("change", () => {
    const lr = file.industry_lead_rates;
    const v = industrySel.value;
    if (lr && v) {
      const rate = v === "average" ? lr.average : lr.industries.find((x) => x.id === v)?.lead_rate;
      if (typeof rate === "number") leadRate.value = String(rate);
    }
    update();
  });
  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => chart.redraw(), 120);
  };
  window.addEventListener("resize", onResize);
  addBtn.addEventListener("click", () => {
    rows.push({ keyword: "", volume: 0, currentPosition: null, targetPosition: 3, aio: false, brand: false, intent: null });
    markOwnInput();
    renderRows();
    update();
    kwList.querySelector(".fc-kw:last-child .fc-kw__name")?.focus();
  });
  kwImport.addEventListener("click", () => kwFile.click());
  kwFile.addEventListener("change", async () => {
    const { keywords, errors } = keywordsFromCsv(await readFile(kwFile));
    kwFile.value = "";
    if (keywords.length) {
      rows.splice(0, rows.length, ...keywords);
      markOwnInput();
      renderRows();
      update();
    }
    if (errors.length) showMessages(errors);
  });
  gscImport.addEventListener("click", () => gscFile.click());
  gscFile.addEventListener("change", async () => {
    const { rows: gsc, errors } = searchConsoleFromCsv(await readFile(gscFile));
    gscFile.value = "";
    if (errors.length) {
      showMessages(errors);
      return;
    }
    const { ctr } = curveFromSearchConsole(gsc);
    if (!Object.keys(ctr).length) {
      showMessages([t.gscInfo(0)]);
      return;
    }
    const curve = { id: "own-search-console", label: t.ownCurve, ctr, aio: { type: "none" } };
    own = { id: curve.id, label: t.ownCurve, type: "single", curves: [curve], choice: curve };
    ownInfo = t.gscInfo(gsc.length);
    renderPresetOptions();
    curveSel.value = own.id;
    update();
  });
  templateBtn.addEventListener("click", () => {
    const csv = lang === "de" ? "keyword;suchvolumen;aktuelle_position;zielposition;suchintention;marke;ai_overview\nbriefing erstellen;1300;;3;info;nein;zitiert\nseo agentur;880;12;5;kommerziell;nein;nein\n" : "keyword,volume,current_position,target_position,intent,brand,aio\nhow to write a brief,1900,,3,informational,no,cited\nseo agency,1300,12,5,commercial,no,no\n";
    download(lang === "de" ? "seo-prognose-vorlage.csv" : "seo-forecast-template.csv", csv);
  });
  exportBtn.addEventListener("click", () => {
    if (last) download(lang === "de" ? "seo-prognose-klicks.csv" : "seo-forecast-clicks.csv", resultToCsv(last));
  });
  exportFunnelBtn.addEventListener("click", () => {
    if (lastFunnel) download(lang === "de" ? "seo-prognose-funnel.csv" : "seo-forecast-funnel.csv", funnelToCsv(lastFunnel));
  });
  fetch(src, { credentials: "same-origin" }).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }).then((json) => {
    file = json;
    presets = presetsFromFile(file, lang);
    renderPresetOptions();
    const lr = file.industry_lead_rates;
    const addOpt = (v, l) => {
      const o = el("option", void 0, l);
      o.value = v;
      industrySel.appendChild(o);
    };
    if (lr) {
      addOpt("", t.industryNone);
      lr.industries.slice().sort((a, b) => a.label[lang].localeCompare(b.label[lang], lang)).forEach((x) => addOpt(x.id, `${x.label[lang]} \xB7 ${t.pct(x.lead_rate)}`));
      addOpt("average", t.industryAvg(t.pct(lr.average)));
      industrySel.value = "average";
      leadRate.value = String(lr.average);
      industryNote.textContent = t.industryShort(lr.source_ref.year);
    } else {
      industryField.remove();
    }
    renderRows();
    update();
  }).catch(() => {
    root.textContent = t.loadFailed;
  });
  return {
    destroy() {
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimer);
      for (const tk of [tickTraffic, tickRevenue, tickProfit, tickRoi]) tk.stop();
      root.textContent = "";
      root.classList.remove("fc");
    }
  };
}
export {
  baseCtr,
  ctrFor,
  curveFromSearchConsole,
  curvesFromFile,
  forecast,
  funnel,
  funnelToCsv,
  keywordsFromCsv,
  leadRateFor,
  maxPosition,
  mount,
  parseCsv,
  parseIntent,
  parseNumber,
  presetsFromFile,
  resultToCsv,
  searchConsoleFromCsv,
  validateFunnel,
  wordCount
};

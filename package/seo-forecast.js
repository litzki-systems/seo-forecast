/*! seo-forecast 1.2.0 · MIT License · https://github.com/litzki-systems/seo-forecast */

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
function ctrFor(curve, position, aio) {
  const base = baseCtr(curve, position);
  if (base === null) return null;
  if (!aio || curve.aio.type === "none") return base;
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
  const ramp = Math.max(1, Math.round(settings.rampMonths));
  const horizon = Math.max(1, Math.round(settings.horizonMonths));
  const results = keywords.map((k) => {
    const errors = validate(k);
    if (errors.length) throw new Error(`${k.keyword || "(empty)"}: ${errors.join(", ")}`);
    const { curve, note } = resolve(choice, k);
    const limit = maxPosition(curve.ctr);
    const warnings = [];
    if (note) warnings.push({ type: "curve-note", which: "both", position: k.targetPosition, maxPosition: limit, message: note });
    const cur = ctrFor(curve, k.currentPosition, k.aio);
    const tgt = ctrFor(curve, k.targetPosition, k.aio);
    const beyond = (which, position) => ({
      type: "beyond-data",
      which,
      position,
      maxPosition: limit,
      message: `no CTR data for ${which} position ${position} in this curve, counted as 0 clicks`
    });
    if (k.currentPosition !== null && cur === null) warnings.push(beyond("current", k.currentPosition));
    if (tgt === null) warnings.push(beyond("target", k.targetPosition));
    if (k.aio && curve.aio.type === "reduction") {
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
    settings: { rampMonths: ramp, horizonMonths: horizon },
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
      aio: col.aio >= 0 ? truthy(r[col.aio]) : false,
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
    lines.push([k.keyword, k.volume, k.currentPosition ?? "", k.targetPosition, k.aio ? "yes" : "no", k.brand ? "yes" : "no", k.intent ?? "", k.curveId, k.currentCtr, k.targetCtr, k.currentClicks, k.targetClicks, ...k.monthly].map(esc).join(","));
  }
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
  const base = { nf, nf0, nf2, cur, cur2, pct };
  if (lang === "de") return {
    ...base,
    loadFailed: "Die CTR-Daten konnten nicht geladen werden. Bitte laden Sie die Seite neu.",
    setup: "1. Grundlage",
    curve: "CTR-Kurve",
    ownCurve: "Eigene Kurve aus der Search Console",
    ramp: "Monate bis zur Zielposition",
    horizon: "Prognosezeitraum (Monate)",
    keywords: "2. Keywords",
    keywordsHelp: "Suchvolumen aus Ihrem Keyword-Tool oder der Search Console. Der Rechner sch\xE4tzt kein Suchvolumen. Aktuelle Position leer lassen, wenn die Seite nicht rankt. \u201EMarke\u201C wirkt bei der Kurve mit Marken-Aufteilung, die Suchabsicht nur auf Ihre Lead-Raten im Funnel.",
    colKeyword: "Keyword",
    colVolume: "Suchvolumen / Monat",
    colCurrent: "Aktuelle Position",
    colTarget: "Zielposition",
    colIntent: "Suchabsicht",
    colBrand: "Marke",
    colAio: "AI Overview",
    intents: { "": "\u2013", informational: "Info", commercial: "Kommerziell", transactional: "Transaktional" },
    remove: "Entfernen",
    addRow: "Zeile hinzuf\xFCgen",
    importKeywords: "Keywords aus CSV laden",
    importGsc: "Search-Console-Export als eigene Kurve laden",
    template: "CSV-Vorlage",
    example: "Die zwei Zeilen sind Beispielwerte. Ersetzen Sie sie durch Ihre Keywords oder laden Sie eine CSV-Datei.",
    funnelH: "3. Business-Funnel (optional)",
    funnelHelp: "Tragen Sie Ihre eigenen Zahlen ein, zum Beispiel aus GA4, Ihrem CRM oder Ihrer Buchhaltung. Ohne Lead-Rate, Abschlussrate und Kundenwert rechnet der Rechner nur Klicks und erfindet keinen Umsatz.",
    basis: "Grundlage der Rechnung",
    basisAdditional: "Nur zus\xE4tzliche Klicks (was die SEO-Arbeit bringt)",
    basisTotal: "Alle prognostizierten Klicks",
    leadRate: "Lead-Rate (%)",
    leadRateHelp: "Anteil der Besucher, die anfragen, sich eintragen oder bestellen.",
    leadRateIntent: (i) => `Lead-Rate ${i} (%)`,
    leadRateIntentHelp: "Optional, nur wenn Sie f\xFCr diese Suchabsicht eine eigene Rate kennen.",
    closeRate: "Abschlussrate (%)",
    closeRateHelp: "Anteil der Leads, die Kunde werden. Im Shop, wo der Lead die Bestellung ist: 100.",
    customerValue: (c) => `Kundenwert (${c})`,
    customerValueHelp: "Customer Lifetime Value oder durchschnittlicher Auftragswert.",
    margin: "Marge (%)",
    marginHelp: "Anteil des Umsatzes, der als Rohertrag bleibt. 100 = Umsatz z\xE4hlt voll.",
    invest: (c) => `SEO-Investition pro Monat (${c})`,
    oneOff: (c) => `Einmalige Investition im 1. Monat (${c})`,
    investHelp: "Optional. Nur mit Investition rechnet der Rechner ROI und Break-even.",
    result: "4. Ergebnis: Klicks",
    today: "Klicks pro Monat heute",
    target: "Klicks pro Monat bei Zielposition",
    extra: (n) => `Zus\xE4tzliche Klicks in ${n} Monaten`,
    chartClicks: "Organische Klicks pro Monat (Summe aller Keywords, gestrichelt: heute)",
    month: "Monat",
    colCurve: "Kurve",
    colCtrNow: "CTR heute",
    colCtrTarget: "CTR Ziel",
    colClicksNow: "Klicks heute",
    colClicksTarget: "Klicks Ziel",
    exportCsv: "Klicks als CSV",
    funnelResult: "5. Ergebnis: Business-Funnel",
    funnelMissing: "F\xFCr den Funnel fehlen noch Lead-Rate, Abschlussrate oder Kundenwert.",
    kpiTraffic: (b) => b === "additional" ? "Zusatz-Klicks pro Monat im Ziel" : "Klicks pro Monat im Ziel",
    kpiLeads: "Leads pro Monat im Ziel",
    kpiCustomers: "Kunden pro Monat im Ziel",
    kpiRevenue: "Umsatz pro Monat im Ziel",
    kpiGross: "Rohertrag pro Monat im Ziel",
    kpiNet: "Reingewinn pro Monat im Ziel",
    kpiRoi: (n) => `ROI nach ${n} Monaten`,
    kpiReturn: (n) => `Rohertrag je investiertem Euro (${n} Monate)`,
    kpiBreakEven: "Break-even",
    breakEvenMonth: (m) => `Monat ${m}`,
    breakEvenNone: (n) => `nicht in ${n} Monaten`,
    chartFunnel: "Kumuliert: Rohertrag (durchgezogen) und Investition (gestrichelt)",
    kpiTable: "Kennzahlen",
    colPerMonth: "Monatlich (Ziel)",
    colCumulative: (n) => `Kumuliert (${n} Monate)`,
    rowClicks: "Klicks",
    rowLeads: "Leads",
    rowCustomers: "Kunden",
    rowRevenue: "Umsatz",
    rowGross: "Rohertrag",
    rowInvest: "Investition",
    rowNet: "Reingewinn",
    monthlyTable: "Monat f\xFCr Monat",
    colMonth: "Monat",
    colCumNet: "Reingewinn kumuliert",
    colRoi: "ROI kumuliert",
    exportFunnel: "Funnel als CSV",
    assumptions: "6. Annahmen",
    formula: "Klicks pro Monat = Suchvolumen \xD7 CTR der Position \xD7 AI-Overview-Faktor. Zwischen heute und dem Erreichen der Zielposition steigen die Klicks linear.",
    formulaFunnel: "Leads = Klicks \xD7 Lead-Rate (je Keyword nach Suchabsicht, falls angegeben) \xB7 Kunden = Leads \xD7 Abschlussrate \xB7 Umsatz = Kunden \xD7 Kundenwert \xB7 Rohertrag = Umsatz \xD7 Marge \xB7 Reingewinn = Rohertrag \u2212 Investition \xB7 ROI = (Rohertrag \u2212 Investition) \xF7 Investition, kumuliert.",
    source: "Quelle",
    position: "Position",
    ctrAioShort: "mit AIO",
    aioReduction: (s) => `Mit AI Overview wird die CTR um den ver\xF6ffentlichten Abschlag je Position gesenkt (${s}).`,
    aioCurve: "Mit AI Overview gilt die eigene CTR-Spalte derselben Quelle.",
    aioNone: "F\xFCr die eigene Kurve ist kein AI-Overview-Abschlag hinterlegt. Ihre Search-Console-Daten enthalten den Effekt bereits.",
    presetBrand: "Keywords mit H\xE4kchen bei \u201EMarke\u201C nutzen die Marken-Kurve, alle anderen die Kurve ohne Marke.",
    presetLength: "Jedes Keyword nutzt die Kurve f\xFCr seine Wortzahl (1 bis 4 W\xF6rter).",
    noData: "keine Daten",
    gscInfo: (n) => `Eigene Kurve aus ${n} Zeilen Ihres Search-Console-Exports. Positionen mit weniger als 100 Impressionen sind ausgelassen.`,
    notTaken: "Bewusst nicht \xFCbernommen aus fr\xFCheren Fassungen (keine Quelle): Branchenfaktoren auf die CTR, Branchen-Standardwerte f\xFCr Conversion-Raten, pauschaler Lead-Aufschlag f\xFCr kommerzielle Keywords, Aufschl\xE4ge f\xFCr Ads (\xD71,1), Featured Snippet (\xD71,2) und \u201EKI-Sichtbarkeit\u201C (\xD71,15 bis \xD71,25), Mobil-Abschlag (\xD70,75), Long-Tail-Aufschlag (\xD71,2, ersetzt durch die Kurve nach L\xE4nge der Suchanfrage), exponentielles Wachstum.",
    warnings: "Hinweise",
    errors: "Bitte pr\xFCfen",
    noKeywords: "Tragen Sie mindestens ein Keyword ein.",
    warnBeyond: (which, p) => `F\xFCr die ${which === "current" ? "aktuelle Position" : "Zielposition"} ${p} enth\xE4lt diese Kurve keine Daten; sie z\xE4hlt als 0 Klicks.`,
    warnNoAio: (p) => `F\xFCr Position ${p} ist kein AI-Overview-Abschlag ver\xF6ffentlicht; es gilt die CTR ohne AI Overview.`,
    invalid: (kw) => `${kw || "(ohne Keyword)"}: Bitte Suchvolumen (\u2265 0), Zielposition (\u2265 1) und, falls die Seite rankt, die aktuelle Position (\u2265 1) eintragen.`,
    funnelInvalid: "Raten und Marge m\xFCssen zwischen 0 und 100 liegen, Betr\xE4ge d\xFCrfen nicht negativ sein.",
    local: "Alle Eingaben bleiben in Ihrem Browser. Nichts wird gespeichert oder \xFCbertragen."
  };
  return {
    ...base,
    loadFailed: "The CTR data could not be loaded. Please reload the page.",
    setup: "1. Basis",
    curve: "CTR curve",
    ownCurve: "Your own curve from Search Console",
    ramp: "Months until the target position",
    horizon: "Forecast period (months)",
    keywords: "2. Keywords",
    keywordsHelp: "Search volume from your keyword tool or Search Console. The calculator does not estimate search volume. Leave the current position empty if the page does not rank. \u201CBrand\u201D applies with the brand-split curve; intent only affects your lead rates in the funnel.",
    colKeyword: "Keyword",
    colVolume: "Search volume / month",
    colCurrent: "Current position",
    colTarget: "Target position",
    colIntent: "Intent",
    colBrand: "Brand",
    colAio: "AI Overview",
    intents: { "": "\u2013", informational: "Informational", commercial: "Commercial", transactional: "Transactional" },
    remove: "Remove",
    addRow: "Add row",
    importKeywords: "Load keywords from CSV",
    importGsc: "Load Search Console export as your own curve",
    template: "CSV template",
    example: "The two rows are example values. Replace them with your keywords or load a CSV file.",
    funnelH: "3. Business funnel (optional)",
    funnelHelp: "Enter your own figures, for example from GA4, your CRM or your accounts. Without lead rate, close rate and customer value the calculator only forecasts clicks and invents no revenue.",
    basis: "What to count",
    basisAdditional: "Additional clicks only (what the SEO work adds)",
    basisTotal: "All forecast clicks",
    leadRate: "Lead rate (%)",
    leadRateHelp: "Share of visitors who enquire, sign up or order.",
    leadRateIntent: (i) => `Lead rate ${i} (%)`,
    leadRateIntentHelp: "Optional, only if you know a separate rate for this intent.",
    closeRate: "Close rate (%)",
    closeRateHelp: "Share of leads who become customers. For shops where the lead is the order: 100.",
    customerValue: (c) => `Customer value (${c})`,
    customerValueHelp: "Customer lifetime value or average order value.",
    margin: "Margin (%)",
    marginHelp: "Share of revenue that remains as gross profit. 100 = count revenue in full.",
    invest: (c) => `SEO investment per month (${c})`,
    oneOff: (c) => `One-off investment in month 1 (${c})`,
    investHelp: "Optional. ROI and break-even are only calculated with an investment.",
    result: "4. Result: clicks",
    today: "Clicks per month today",
    target: "Clicks per month at target position",
    extra: (n) => `Additional clicks over ${n} months`,
    chartClicks: "Organic clicks per month (all keywords, dashed: today)",
    month: "Month",
    colCurve: "Curve",
    colCtrNow: "CTR today",
    colCtrTarget: "CTR target",
    colClicksNow: "Clicks today",
    colClicksTarget: "Clicks target",
    exportCsv: "Clicks as CSV",
    funnelResult: "5. Result: business funnel",
    funnelMissing: "The funnel still needs lead rate, close rate or customer value.",
    kpiTraffic: (b) => b === "additional" ? "Additional clicks per month at target" : "Clicks per month at target",
    kpiLeads: "Leads per month at target",
    kpiCustomers: "Customers per month at target",
    kpiRevenue: "Revenue per month at target",
    kpiGross: "Gross profit per month at target",
    kpiNet: "Net profit per month at target",
    kpiRoi: (n) => `ROI after ${n} months`,
    kpiReturn: (n) => `Gross profit per euro invested (${n} months)`,
    kpiBreakEven: "Break-even",
    breakEvenMonth: (m) => `Month ${m}`,
    breakEvenNone: (n) => `not within ${n} months`,
    chartFunnel: "Cumulative: gross profit (solid) and investment (dashed)",
    kpiTable: "Key figures",
    colPerMonth: "Per month (target)",
    colCumulative: (n) => `Cumulative (${n} months)`,
    rowClicks: "Clicks",
    rowLeads: "Leads",
    rowCustomers: "Customers",
    rowRevenue: "Revenue",
    rowGross: "Gross profit",
    rowInvest: "Investment",
    rowNet: "Net profit",
    monthlyTable: "Month by month",
    colMonth: "Month",
    colCumNet: "Net profit, cumulative",
    colRoi: "ROI, cumulative",
    exportFunnel: "Funnel as CSV",
    assumptions: "6. Assumptions",
    formula: "Clicks per month = search volume \xD7 CTR of the position \xD7 AI Overview factor. Between today and reaching the target position, clicks rise linearly.",
    formulaFunnel: "Leads = clicks \xD7 lead rate (per keyword by intent, if given) \xB7 Customers = leads \xD7 close rate \xB7 Revenue = customers \xD7 customer value \xB7 Gross profit = revenue \xD7 margin \xB7 Net profit = gross profit \u2212 investment \xB7 ROI = (gross profit \u2212 investment) \xF7 investment, cumulative.",
    source: "Source",
    position: "Position",
    ctrAioShort: "with AIO",
    aioReduction: (s) => `With an AI Overview, CTR is lowered by the published reduction per position (${s}).`,
    aioCurve: "With an AI Overview, the separate CTR column of the same source applies.",
    aioNone: "No AI Overview reduction is applied to your own curve. Your Search Console data already contains the effect.",
    presetBrand: "Keywords ticked as \u201CBrand\u201D use the brand curve, all others the non-brand curve.",
    presetLength: "Each keyword uses the curve for its word count (1 to 4 words).",
    noData: "no data",
    gscInfo: (n) => `Your own curve from ${n} rows of your Search Console export. Positions with fewer than 100 impressions are left out.`,
    notTaken: "Deliberately not carried over from earlier versions (no source): industry factors on CTR, industry default conversion rates, a flat lead bonus for commercial keywords, boosts for ads (\xD71.1), featured snippets (\xD71.2) and \u201CAI visibility\u201D (\xD71.15 to \xD71.25), a mobile discount (\xD70.75), a long-tail boost (\xD71.2, replaced by the query-length curves), exponential growth.",
    warnings: "Notes",
    errors: "Please check",
    noKeywords: "Enter at least one keyword.",
    warnBeyond: (which, p) => `This curve has no data for the ${which === "current" ? "current" : "target"} position ${p}, so it counts as 0 clicks.`,
    warnNoAio: (p) => `No published AI Overview reduction for position ${p}; the CTR without AI Overview is used.`,
    invalid: (kw) => `${kw || "(no keyword)"}: please enter search volume (\u2265 0), target position (\u2265 1) and, if it ranks, a current position (\u2265 1).`,
    funnelInvalid: "Rates and margin must be between 0 and 100, amounts must not be negative.",
    local: "All input stays in your browser. Nothing is stored or transmitted."
  };
}
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
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
function lineChart(host, title, series, fmt) {
  const width = host.clientWidth || (host.parentElement ? host.parentElement.clientWidth : 0) || 720;
  host.textContent = "";
  const months = series[0]?.values.length || 0;
  if (!months) return;
  const W = Math.max(280, Math.min(1600, Math.round(width)));
  const H = W < 500 ? 220 : 280, R = 16, TOP = 20, B = 36;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const L = Math.max(48, Math.min(96, fmt(max).length * 8 + 12));
  const x = (i) => L + (months === 1 ? 0 : i * (W - L - R) / (months - 1));
  const y = (v) => TOP + (1 - Math.max(0, v) / max) * (H - TOP - B);
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("class", "fc-svg");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", title);
  const add = (tag, attrs, text) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    if (text !== void 0) n.textContent = text;
    svg.appendChild(n);
  };
  for (let g = 0; g <= 4; g++) {
    const v = max * g / 4;
    add("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), class: "fc-grid-line" });
    add("text", { x: L - 8, y: y(v) + 5, "text-anchor": "end", class: "fc-axis" }, fmt(v));
  }
  const step = W < 500 ? Math.ceil(months / 6) : months <= 12 ? 1 : 3;
  for (let i = 0; i < months; i++) {
    if (i === 0 || (i + 1) % step === 0) add("text", { x: x(i), y: H - 10, "text-anchor": "middle", class: "fc-axis" }, String(i + 1));
  }
  for (const s of series) {
    if (s.values.every((v) => v === s.values[0]) && s.cls.includes("baseline")) {
      add("line", { x1: L, x2: W - R, y1: y(s.values[0]), y2: y(s.values[0]), class: s.cls });
      continue;
    }
    add("polyline", { points: s.values.map((v, i) => `${x(i)},${y(v)}`).join(" "), class: s.cls });
    if (s.cls === "fc-line") s.values.forEach((v, i) => add("circle", { cx: x(i), cy: y(v), r: 4, class: "fc-dot" }));
  }
  host.appendChild(el("p", "fc-label", title));
  host.appendChild(svg);
}
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
  const curSym = 0 .toLocaleString(lang === "de" ? "de-DE" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).replace(/[\d\s.,]/g, "") || currency;
  const src = options.src || root.dataset.src || defaultSrc();
  let file;
  let presets = [];
  let own = null;
  let ownInfo = "";
  let last = null;
  let lastFunnel = null;
  const rows = lang === "de" ? [
    { keyword: "briefing erstellen", volume: 1300, currentPosition: null, targetPosition: 3, aio: true, brand: false, intent: "informational" },
    { keyword: "seo agentur", volume: 880, currentPosition: 12, targetPosition: 5, aio: false, brand: false, intent: "commercial" }
  ] : [
    { keyword: "how to write a brief", volume: 1900, currentPosition: null, targetPosition: 3, aio: true, brand: false, intent: "informational" },
    { keyword: "seo agency", volume: 1300, currentPosition: 12, targetPosition: 5, aio: false, brand: false, intent: "commercial" }
  ];
  root.textContent = "";
  root.classList.add("fc");
  const field = (label, input, help) => {
    const f = el("div", "fc-field");
    const id = "fc-" + Math.random().toString(36).slice(2, 9);
    input.id = id;
    const l = el("label", "fc-label", label);
    l.htmlFor = id;
    f.append(l, input);
    if (help) {
      const h = el("p", "fc-help", help);
      h.id = id + "-help";
      input.setAttribute("aria-describedby", h.id);
      f.appendChild(h);
    }
    return f;
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
  const button = (text, cls) => {
    const b = el("button", "fc-btn " + cls, text);
    b.type = "button";
    return b;
  };
  const setup = el("section", "fc-card");
  setup.appendChild(el("h2", "fc-h", t.setup));
  const grid = el("div", "fc-grid");
  const curveSel = el("select", "fc-input");
  const ramp = numInput("6", "1", "1", "36");
  const horizon = numInput("12", "1", "1", "36");
  grid.append(field(t.curve, curveSel), field(t.ramp, ramp), field(t.horizon, horizon));
  setup.appendChild(grid);
  const presetNote = el("p", "fc-note");
  setup.appendChild(presetNote);
  const kwCard = el("section", "fc-card");
  kwCard.append(el("h2", "fc-h", t.keywords), el("p", "fc-note", t.keywordsHelp), el("p", "fc-note fc-example", t.example));
  const kwWrap = el("div", "fc-table-wrap");
  const kwTable = el("table", "fc-table fc-table--input");
  kwWrap.appendChild(kwTable);
  kwCard.appendChild(kwWrap);
  const kwActions = el("div", "fc-actions");
  const addBtn = button(t.addRow, "fc-btn--outline");
  const kwFile = el("input");
  kwFile.type = "file";
  kwFile.accept = ".csv,text/csv,text/plain";
  kwFile.hidden = true;
  const kwImport = button(t.importKeywords, "fc-btn--outline");
  const gscFile = el("input");
  gscFile.type = "file";
  gscFile.accept = ".csv,text/csv,text/plain";
  gscFile.hidden = true;
  const gscImport = button(t.importGsc, "fc-btn--outline");
  const templateBtn = button(t.template, "fc-btn--secondary");
  kwActions.append(addBtn, kwImport, kwFile, gscImport, gscFile, templateBtn);
  kwCard.appendChild(kwActions);
  const messages = el("div", "fc-messages");
  messages.setAttribute("role", "status");
  messages.setAttribute("aria-live", "polite");
  kwCard.appendChild(messages);
  const fCard = el("section", "fc-card");
  fCard.append(el("h2", "fc-h", t.funnelH), el("p", "fc-note", t.funnelHelp));
  const basisSel = el("select", "fc-input");
  for (const [v, l] of [["additional", t.basisAdditional], ["total", t.basisTotal]]) {
    const o = el("option", void 0, l);
    o.value = v;
    basisSel.appendChild(o);
  }
  const leadRate = numInput("", "0", "any", "100");
  const leadInfo = numInput("", "0", "any", "100");
  const leadComm = numInput("", "0", "any", "100");
  const leadTrans = numInput("", "0", "any", "100");
  const closeRate = numInput("", "0", "any", "100");
  const custValue = numInput("", "0", "any");
  const margin = numInput("100", "0", "any", "100");
  const invest = numInput("", "0", "any");
  const oneOff = numInput("", "0", "any");
  const fGrid1 = el("div", "fc-grid");
  fGrid1.append(
    field(t.basis, basisSel),
    field(t.leadRate, leadRate, t.leadRateHelp),
    field(t.closeRate, closeRate, t.closeRateHelp),
    field(t.customerValue(curSym), custValue, t.customerValueHelp),
    field(t.margin, margin, t.marginHelp)
  );
  const fGrid2 = el("div", "fc-grid");
  fGrid2.append(
    field(t.leadRateIntent(t.intents.informational), leadInfo, t.leadRateIntentHelp),
    field(t.leadRateIntent(t.intents.commercial), leadComm),
    field(t.leadRateIntent(t.intents.transactional), leadTrans)
  );
  const fGrid3 = el("div", "fc-grid");
  fGrid3.append(field(t.invest(curSym), invest, t.investHelp), field(t.oneOff(curSym), oneOff));
  fCard.append(fGrid1, fGrid2, fGrid3);
  const resCard = el("section", "fc-card");
  resCard.appendChild(el("h2", "fc-h", t.result));
  const kpis = el("div", "fc-kpis");
  const chart = el("div", "fc-chart");
  const resTableHost = el("div");
  const warnBox = el("div", "fc-warnings");
  const resActions = el("div", "fc-actions");
  const exportBtn = button(t.exportCsv, "fc-btn--primary");
  resActions.appendChild(exportBtn);
  resCard.append(kpis, chart, resTableHost, warnBox, resActions);
  const fRes = el("section", "fc-card");
  fRes.appendChild(el("h2", "fc-h", t.funnelResult));
  const fBody = el("div");
  const fActions = el("div", "fc-actions");
  const exportFunnelBtn = button(t.exportFunnel, "fc-btn--primary");
  fActions.appendChild(exportFunnelBtn);
  fRes.append(fBody, fActions);
  const assCard = el("section", "fc-card");
  assCard.appendChild(el("h2", "fc-h", t.assumptions));
  const assBody = el("div", "fc-assumptions");
  assCard.appendChild(assBody);
  root.append(setup, kwCard, fCard, resCard, fRes, assCard, el("p", "fc-note fc-local", t.local));
  const numOrNull = (v) => v.trim() === "" ? null : Number(v.replace(",", "."));
  function renderRows() {
    kwTable.textContent = "";
    const head = el("thead");
    const hr = el("tr");
    for (const h of [t.colKeyword, t.colVolume, t.colCurrent, t.colTarget, t.colIntent, t.colBrand, t.colAio, ""]) hr.appendChild(el("th", void 0, h));
    head.appendChild(hr);
    const body = el("tbody");
    rows.forEach((r, i) => {
      const tr = el("tr");
      const cell = (input, label) => {
        const td2 = el("td");
        td2.dataset.label = label;
        input.setAttribute("aria-label", `${label} ${i + 1}`);
        td2.appendChild(input);
        tr.appendChild(td2);
      };
      const kw = el("input", "fc-input");
      kw.type = "text";
      kw.value = r.keyword;
      kw.addEventListener("input", () => {
        r.keyword = kw.value.trim();
        update();
      });
      const vol = numInput(String(r.volume));
      vol.classList.add("fc-input--num");
      vol.addEventListener("input", () => {
        r.volume = vol.value === "" ? NaN : Number(vol.value);
        update();
      });
      const cur = numInput(r.currentPosition === null ? "" : String(r.currentPosition), "1", "0.1");
      cur.classList.add("fc-input--num");
      cur.addEventListener("input", () => {
        r.currentPosition = numOrNull(cur.value);
        update();
      });
      const tgt = numInput(String(r.targetPosition), "1", "1");
      tgt.classList.add("fc-input--num");
      tgt.addEventListener("input", () => {
        r.targetPosition = tgt.value === "" ? NaN : Number(tgt.value);
        update();
      });
      const intent = el("select", "fc-input");
      for (const [v, l] of Object.entries(t.intents)) {
        const o = el("option", void 0, l);
        o.value = v;
        intent.appendChild(o);
      }
      intent.value = r.intent || "";
      intent.addEventListener("change", () => {
        r.intent = intent.value || null;
        update();
      });
      const brand = el("input");
      brand.type = "checkbox";
      brand.checked = !!r.brand;
      brand.addEventListener("change", () => {
        r.brand = brand.checked;
        update();
      });
      const aio = el("input");
      aio.type = "checkbox";
      aio.checked = r.aio;
      aio.addEventListener("change", () => {
        r.aio = aio.checked;
        update();
      });
      const del = button("\xD7", "fc-btn--secondary fc-btn--small fc-btn--icon");
      del.setAttribute("aria-label", `${t.remove}: ${r.keyword || i + 1}`);
      del.title = t.remove;
      del.addEventListener("click", () => {
        rows.splice(i, 1);
        renderRows();
        update();
      });
      cell(kw, t.colKeyword);
      cell(vol, t.colVolume);
      cell(cur, t.colCurrent);
      cell(tgt, t.colTarget);
      cell(intent, t.colIntent);
      cell(brand, t.colBrand);
      cell(aio, t.colAio);
      const td = el("td");
      td.appendChild(del);
      tr.appendChild(td);
      body.appendChild(tr);
    });
    kwTable.append(head, body);
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
    const box = el("div", "fc-msg fc-msg--error");
    box.appendChild(el("p", "fc-label", t.errors));
    const ul = el("ul");
    list.forEach((m) => ul.appendChild(el("li", void 0, m)));
    box.appendChild(ul);
    messages.appendChild(box);
  }
  const kpi = (host, value, label, accent = false) => {
    const k = el("div", "fc-kpi" + (accent ? " fc-kpi--accent" : ""));
    k.append(el("p", "fc-kpi__value", value), el("p", "fc-kpi__label", label));
    host.appendChild(k);
  };
  function renderResult(result) {
    kpis.textContent = "";
    kpi(kpis, t.nf0.format(result.totals.currentClicks), t.today);
    kpi(kpis, t.nf0.format(result.totals.targetClicks), t.target);
    kpi(kpis, t.nf0.format(result.totals.additionalClicksOverHorizon), t.extra(result.settings.horizonMonths), true);
    lineChart(chart, t.chartClicks, [
      { values: result.totals.monthly.map(() => result.totals.currentClicks), cls: "fc-baseline" },
      { values: result.totals.monthly, cls: "fc-line" }
    ], (n) => t.nf0.format(n));
    const preset = currentPreset();
    const curveName = (id) => {
      const c = preset.curves.find((x) => x.id === id);
      return c ? c.shortLabel || c.label : id;
    };
    resTableHost.textContent = "";
    resTableHost.appendChild(table(
      [t.colKeyword, t.colVolume, t.colCurrent, t.colTarget, ...preset.curves.length > 1 ? [t.colCurve] : [], t.colCtrNow, t.colCtrTarget, t.colClicksNow, t.colClicksTarget],
      result.keywords.map((k) => [
        k.keyword + (k.aio ? " \xB7 AIO" : ""),
        t.nf0.format(k.volume),
        k.currentPosition === null ? "\u2013" : t.nf.format(k.currentPosition),
        t.nf.format(k.targetPosition),
        ...preset.curves.length > 1 ? [curveName(k.curveId)] : [],
        t.pct(k.currentCtr),
        t.pct(k.targetCtr),
        t.nf.format(k.currentClicks),
        t.nf.format(k.targetClicks)
      ])
    ));
    warnBox.textContent = "";
    const warns = result.keywords.flatMap((k) => k.warnings.map((w) => `${k.keyword}: ${w.type === "beyond-data" ? t.warnBeyond(w.which, Math.round(w.position)) : w.type === "no-aio-reduction" ? t.warnNoAio(w.position) : w.message}`));
    if (warns.length) {
      warnBox.appendChild(el("p", "fc-label", t.warnings));
      const ul = el("ul");
      warns.forEach((w) => ul.appendChild(el("li", void 0, w)));
      warnBox.appendChild(ul);
    }
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
      basis: basisSel.value === "total" ? "total" : "additional"
    };
  }
  function renderFunnel(result) {
    fBody.textContent = "";
    lastFunnel = null;
    exportFunnelBtn.disabled = true;
    const fs = funnelSettings();
    if (!result || !fs) {
      fBody.appendChild(el("p", "fc-note", t.funnelMissing));
      return;
    }
    if (validateFunnel(fs).length) {
      fBody.appendChild(el("p", "fc-msg fc-msg--error", t.funnelInvalid));
      return;
    }
    const f = funnel(result, fs);
    lastFunnel = f;
    exportFunnelBtn.disabled = false;
    const n = f.months.length;
    const hasInv = f.totals.investment > 0;
    const k1 = el("div", "fc-kpis");
    kpi(k1, t.nf0.format(f.atTarget.clicks), t.kpiTraffic(fs.basis));
    kpi(k1, t.nf.format(f.atTarget.leads), t.kpiLeads);
    kpi(k1, t.nf.format(f.atTarget.customers), t.kpiCustomers);
    kpi(k1, t.cur.format(f.atTarget.revenue), t.kpiRevenue);
    kpi(k1, t.cur.format(f.atTarget.grossProfit), t.kpiGross, !hasInv);
    if (hasInv) kpi(k1, t.cur.format(f.atTarget.netProfit), t.kpiNet, true);
    fBody.appendChild(k1);
    if (hasInv) {
      const k2 = el("div", "fc-kpis fc-kpis--second");
      kpi(k2, f.totals.roi === null ? "\u2013" : t.pct(Math.round(f.totals.roi)), t.kpiRoi(n), true);
      kpi(k2, f.totals.returnPerEuro === null ? "\u2013" : t.cur2.format(f.totals.returnPerEuro), t.kpiReturn(n));
      kpi(k2, f.totals.breakEvenMonth === null ? t.breakEvenNone(n) : t.breakEvenMonth(f.totals.breakEvenMonth), t.kpiBreakEven);
      fBody.appendChild(k2);
    }
    const fc = el("div", "fc-chart");
    fBody.appendChild(fc);
    lineChart(fc, hasInv ? t.chartFunnel : t.rowGross, [
      ...hasInv ? [{ values: f.months.map((m) => m.cumulativeInvestment), cls: "fc-line fc-line--invest" }] : [],
      { values: f.months.map((m) => m.cumulativeGrossProfit), cls: "fc-line" }
    ], (v) => t.cur.format(v));
    fBody.appendChild(el("p", "fc-label fc-gap", t.kpiTable));
    const rowsKpi = [
      [t.rowClicks, t.nf0.format(f.atTarget.clicks), t.nf0.format(f.totals.clicks)],
      [t.rowLeads, t.nf.format(f.atTarget.leads), t.nf0.format(f.totals.leads)],
      [t.rowCustomers, t.nf.format(f.atTarget.customers), t.nf.format(f.totals.customers)],
      [t.rowRevenue, t.cur.format(f.atTarget.revenue), t.cur.format(f.totals.revenue)],
      [t.rowGross, t.cur.format(f.atTarget.grossProfit), t.cur.format(f.totals.grossProfit)]
    ];
    if (hasInv) {
      rowsKpi.push([t.rowInvest, t.cur.format(fs.monthlyInvestment || 0), t.cur.format(f.totals.investment)]);
      rowsKpi.push([t.rowNet, t.cur.format(f.atTarget.netProfit), t.cur.format(f.totals.netProfit)]);
    }
    fBody.appendChild(table(["", t.colPerMonth, t.colCumulative(n)], rowsKpi, "fc-table fc-table--kpi"));
    const det = el("details", "fc-details");
    det.appendChild(el("summary", void 0, t.monthlyTable));
    det.appendChild(table(
      [t.colMonth, t.rowClicks, t.rowLeads, t.rowCustomers, t.rowRevenue, t.rowGross, ...hasInv ? [t.rowInvest, t.colCumNet, t.colRoi] : []],
      f.months.map((m) => [
        String(m.month),
        t.nf0.format(m.clicks),
        t.nf.format(m.leads),
        t.nf2.format(m.customers),
        t.cur.format(m.revenue),
        t.cur.format(m.grossProfit),
        ...hasInv ? [t.cur.format(m.investment), t.cur.format(m.cumulativeNetProfit), m.cumulativeRoi === null ? "\u2013" : t.pct(Math.round(m.cumulativeRoi))] : []
      ])
    ));
    fBody.appendChild(det);
  }
  function renderAssumptions(preset) {
    assBody.textContent = "";
    assBody.append(el("p", void 0, t.formula), el("p", void 0, t.formulaFunnel));
    const first = preset.curves[0];
    const s = first.source ? file.sources[first.source] : null;
    const p = el("p");
    if (s) {
      p.appendChild(document.createTextNode(`${t.curve}: ${preset.label}. ${t.source}: `));
      const a = el("a", void 0, `${s.publisher}, ${s.title}`);
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noopener";
      p.append(a, document.createTextNode(` (${s.market}, ${s.data_period}). ${lang === "de" && s.method_de || s.method}`));
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
      if (r) {
        const a = el("a", void 0, r.title);
        a.href = r.url;
        a.target = "_blank";
        a.rel = "noopener";
        ap.append(document.createTextNode(" "), a, document.createTextNode(`. ${lang === "de" && r.method_de || r.method}`));
      }
      assBody.appendChild(ap);
    } else {
      assBody.appendChild(el("p", void 0, first.aio.type === "curve" ? t.aioCurve : t.aioNone));
    }
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
    assBody.appendChild(table(headers, rowsA, "fc-table fc-table--compact"));
    const ul = el("ul", "fc-caveats");
    file.caveats[lang].forEach((c) => ul.appendChild(el("li", void 0, c)));
    ul.appendChild(el("li", void 0, t.notTaken));
    assBody.appendChild(ul);
  }
  function update() {
    const preset = currentPreset();
    presetNote.textContent = own && preset === own ? ownInfo : preset.type === "brand" ? t.presetBrand : preset.type === "query-length" ? t.presetLength : "";
    renderAssumptions(preset);
    last = null;
    if (!rows.length) {
      showMessages([t.noKeywords]);
      renderFunnel(null);
      return;
    }
    const invalid = rows.filter((r) => !r.keyword || !Number.isFinite(r.volume) || r.volume < 0 || !Number.isFinite(r.targetPosition) || r.targetPosition < 1 || r.currentPosition !== null && (!Number.isFinite(r.currentPosition) || r.currentPosition < 1));
    if (invalid.length) {
      showMessages(invalid.map((r) => t.invalid(r.keyword)));
      renderFunnel(null);
      return;
    }
    try {
      last = forecast(preset.choice, rows, { rampMonths: Number(ramp.value) || 1, horizonMonths: Number(horizon.value) || 12 });
      showMessages([]);
      renderResult(last);
    } catch (e) {
      showMessages([e.message]);
    }
    renderFunnel(last);
  }
  curveSel.addEventListener("change", update);
  for (const i of [ramp, horizon, leadRate, leadInfo, leadComm, leadTrans, closeRate, custValue, margin, invest, oneOff]) i.addEventListener("input", update);
  basisSel.addEventListener("change", update);
  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(update, 150);
  };
  window.addEventListener("resize", onResize);
  addBtn.addEventListener("click", () => {
    rows.push({ keyword: "", volume: 0, currentPosition: null, targetPosition: 1, aio: false, brand: false, intent: null });
    renderRows();
    const first = kwTable.querySelector("tbody tr:last-child input");
    if (first) first.focus();
  });
  kwImport.addEventListener("click", () => kwFile.click());
  kwFile.addEventListener("change", async () => {
    const { keywords, errors } = keywordsFromCsv(await readFile(kwFile));
    kwFile.value = "";
    if (keywords.length) {
      rows.splice(0, rows.length, ...keywords);
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
      showMessages(["no position with at least 100 impressions"]);
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
    const csv = lang === "de" ? "keyword;suchvolumen;aktuelle_position;zielposition;suchintention;marke;ai_overview\nbriefing erstellen;1300;;3;info;nein;ja\nseo agentur;880;12;5;kommerziell;nein;nein\n" : "keyword,volume,current_position,target_position,intent,brand,aio\nhow to write a brief,1900,,3,informational,no,yes\nseo agency,1300,12,5,commercial,no,no\n";
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
    renderRows();
    update();
  }).catch(() => {
    root.textContent = t.loadFailed;
  });
  return {
    destroy() {
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimer);
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

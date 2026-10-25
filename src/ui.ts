/**
 * seo-forecast · browser UI
 *
 *   import { mount } from './seo-forecast.js';
 *   mount(document.getElementById('forecast'), { lang: 'de' });
 *
 * Renders the whole calculator into the given element. No globals, no inline
 * scripts or styles (CSP style-src 'self' works), no storage, no cookies and no
 * requests besides loading ctr-curves.json from next to the module.
 * All classes use the fc- prefix. MIT License.
 */
import { forecast, ctrFor, maxPosition, curveFromSearchConsole, type Curve, type Keyword, type ForecastResult, type Intent } from './forecast.js';
import { funnel, validateFunnel, type FunnelResult, type FunnelSettings } from './funnel.js';
import { keywordsFromCsv, searchConsoleFromCsv, resultToCsv, funnelToCsv } from './csv.js';
import { presetsFromFile, type CurveFile, type Lang, type Preset } from './data.js';

function strings(lang: Lang, currency: string) {
  const locale = lang === 'de' ? 'de-DE' : 'en-US';
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const nf0 = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const cur = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 });
  const cur2 = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 });
  const pct = (n: number) => nf2.format(n) + (lang === 'de' ? ' %' : '%');
  const base = { nf, nf0, nf2, cur, cur2, pct };
  if (lang === 'de') return { ...base,
    loadFailed: 'Die CTR-Daten konnten nicht geladen werden. Bitte laden Sie die Seite neu.',
    setup: '1. Grundlage', curve: 'CTR-Kurve', ownCurve: 'Eigene Kurve aus der Search Console',
    ramp: 'Monate bis zur Zielposition', horizon: 'Prognosezeitraum (Monate)',
    keywords: '2. Keywords',
    keywordsHelp: 'Suchvolumen aus Ihrem Keyword-Tool oder der Search Console. Der Rechner schätzt kein Suchvolumen. Aktuelle Position leer lassen, wenn die Seite nicht rankt. „Marke“ wirkt bei der Kurve mit Marken-Aufteilung, die Suchabsicht nur auf Ihre Lead-Raten im Funnel.',
    colKeyword: 'Keyword', colVolume: 'Suchvolumen / Monat', colCurrent: 'Aktuelle Position', colTarget: 'Zielposition', colIntent: 'Suchabsicht', colBrand: 'Marke', colAio: 'AI Overview',
    intents: { '': '–', informational: 'Info', commercial: 'Kommerziell', transactional: 'Transaktional' } as Record<string, string>,
    remove: 'Entfernen', addRow: 'Zeile hinzufügen',
    importKeywords: 'Keywords aus CSV laden', importGsc: 'Search-Console-Export als eigene Kurve laden', template: 'CSV-Vorlage',
    example: 'Die zwei Zeilen sind Beispielwerte. Ersetzen Sie sie durch Ihre Keywords oder laden Sie eine CSV-Datei.',
    funnelH: '3. Business-Funnel (optional)',
    funnelHelp: 'Tragen Sie Ihre eigenen Zahlen ein, zum Beispiel aus GA4, Ihrem CRM oder Ihrer Buchhaltung. Ohne Lead-Rate, Abschlussrate und Kundenwert rechnet der Rechner nur Klicks und erfindet keinen Umsatz.',
    basis: 'Grundlage der Rechnung', basisAdditional: 'Nur zusätzliche Klicks (was die SEO-Arbeit bringt)', basisTotal: 'Alle prognostizierten Klicks',
    leadRate: 'Lead-Rate (%)', leadRateHelp: 'Anteil der Besucher, die anfragen, sich eintragen oder bestellen.',
    leadRateIntent: (i: string) => `Lead-Rate ${i} (%)`, leadRateIntentHelp: 'Optional, nur wenn Sie für diese Suchabsicht eine eigene Rate kennen.',
    closeRate: 'Abschlussrate (%)', closeRateHelp: 'Anteil der Leads, die Kunde werden. Im Shop, wo der Lead die Bestellung ist: 100.',
    customerValue: (c: string) => `Kundenwert (${c})`, customerValueHelp: 'Customer Lifetime Value oder durchschnittlicher Auftragswert.',
    margin: 'Marge (%)', marginHelp: 'Anteil des Umsatzes, der als Rohertrag bleibt. 100 = Umsatz zählt voll.',
    invest: (c: string) => `SEO-Investition pro Monat (${c})`, oneOff: (c: string) => `Einmalige Investition im 1. Monat (${c})`, investHelp: 'Optional. Nur mit Investition rechnet der Rechner ROI und Break-even.',
    result: '4. Ergebnis: Klicks',
    today: 'Klicks pro Monat heute', target: 'Klicks pro Monat bei Zielposition', extra: (n: number) => `Zusätzliche Klicks in ${n} Monaten`,
    chartClicks: 'Organische Klicks pro Monat (Summe aller Keywords, gestrichelt: heute)', month: 'Monat',
    colCurve: 'Kurve', colCtrNow: 'CTR heute', colCtrTarget: 'CTR Ziel', colClicksNow: 'Klicks heute', colClicksTarget: 'Klicks Ziel',
    exportCsv: 'Klicks als CSV',
    funnelResult: '5. Ergebnis: Business-Funnel',
    funnelMissing: 'Für den Funnel fehlen noch Lead-Rate, Abschlussrate oder Kundenwert.',
    kpiTraffic: (b: string) => b === 'additional' ? 'Zusatz-Klicks pro Monat im Ziel' : 'Klicks pro Monat im Ziel',
    kpiLeads: 'Leads pro Monat im Ziel', kpiCustomers: 'Kunden pro Monat im Ziel', kpiRevenue: 'Umsatz pro Monat im Ziel', kpiGross: 'Rohertrag pro Monat im Ziel', kpiNet: 'Reingewinn pro Monat im Ziel',
    kpiRoi: (n: number) => `ROI nach ${n} Monaten`, kpiReturn: (n: number) => `Rohertrag je investiertem Euro (${n} Monate)`, kpiBreakEven: 'Break-even', breakEvenMonth: (m: number) => `Monat ${m}`, breakEvenNone: (n: number) => `nicht in ${n} Monaten`,
    chartFunnel: 'Kumuliert: Rohertrag (durchgezogen) und Investition (gestrichelt)',
    kpiTable: 'Kennzahlen', colPerMonth: 'Monatlich (Ziel)', colCumulative: (n: number) => `Kumuliert (${n} Monate)`,
    rowClicks: 'Klicks', rowLeads: 'Leads', rowCustomers: 'Kunden', rowRevenue: 'Umsatz', rowGross: 'Rohertrag', rowInvest: 'Investition', rowNet: 'Reingewinn',
    monthlyTable: 'Monat für Monat', colMonth: 'Monat', colCumNet: 'Reingewinn kumuliert', colRoi: 'ROI kumuliert',
    exportFunnel: 'Funnel als CSV',
    assumptions: '6. Annahmen',
    formula: 'Klicks pro Monat = Suchvolumen × CTR der Position × AI-Overview-Faktor. Zwischen heute und dem Erreichen der Zielposition steigen die Klicks linear.',
    formulaFunnel: 'Leads = Klicks × Lead-Rate (je Keyword nach Suchabsicht, falls angegeben) · Kunden = Leads × Abschlussrate · Umsatz = Kunden × Kundenwert · Rohertrag = Umsatz × Marge · Reingewinn = Rohertrag − Investition · ROI = (Rohertrag − Investition) ÷ Investition, kumuliert.',
    source: 'Quelle', position: 'Position', ctrAioShort: 'mit AIO',
    aioReduction: (s: string) => `Mit AI Overview wird die CTR um den veröffentlichten Abschlag je Position gesenkt (${s}).`,
    aioCurve: 'Mit AI Overview gilt die eigene CTR-Spalte derselben Quelle.',
    aioNone: 'Für die eigene Kurve ist kein AI-Overview-Abschlag hinterlegt. Ihre Search-Console-Daten enthalten den Effekt bereits.',
    presetBrand: 'Keywords mit Häkchen bei „Marke“ nutzen die Marken-Kurve, alle anderen die Kurve ohne Marke.',
    presetLength: 'Jedes Keyword nutzt die Kurve für seine Wortzahl (1 bis 4 Wörter).',
    noData: 'keine Daten',
    gscInfo: (n: number) => `Eigene Kurve aus ${n} Zeilen Ihres Search-Console-Exports. Positionen mit weniger als 100 Impressionen sind ausgelassen.`,
    notTaken: 'Gegenüber früheren Fassungen durch Daten ersetzt: „KI-Ziel/KI-Dominanz“ (×1,15/×1,25) durch die Seer-Faktoren für zitiert/nicht zitiert, Marke ×1,8 durch die Marken-Kurve, Long-Tail ×1,2 durch die Kurven nach Wortzahl, Branchen-Lead-Raten durch Ruler Analytics. Nicht übernommen: pauschaler Lead-Aufschlag für kommerzielle Keywords (stattdessen eigene Raten je Suchabsicht) und exponentielles Wachstum.',
    aioSel: { '': 'Keine', yes: 'Ja', cited: 'Ja, Seite zitiert', 'not-cited': 'Ja, nicht zitiert' } as Record<string, string>,
    aioCitedTag: 'AIO, zitiert', aioNotCitedTag: 'AIO, nicht zitiert',
    citation: (l: string) => `Ist bekannt, ob Ihre Seite in der AI Overview zitiert wird, gilt statt des Durchschnitts: ${l}`,
    userFactor: 'Eigener CTR-Faktor (%)', userFactorHelp: 'Ihre Annahme ohne Quelle, z. B. aus eigenen Tests zu Snippets, Anzeigen oder Mobil. 100 = keine Änderung. Wird im Ergebnis als Annahme ausgewiesen.',
    userFactorNote: (f: number) => `Eigener CTR-Faktor ${f} % auf alle Keywords angewendet. Das ist Ihre Annahme, keine belegte Zahl.`,
    industry: 'Branche', industryNone: 'Keine Vorbelegung', industryAvg: (v: string) => `Durchschnitt aller Branchen (${v})`,
    industrySource: 'Quelle',
    industryShort: (y: number) => `Startwert aus Ruler Analytics (${y}), organische Suche. Bitte durch Ihre eigene Zahl ersetzen; Details unter „Annahmen“.`,
    warnings: 'Hinweise', errors: 'Bitte prüfen', noKeywords: 'Tragen Sie mindestens ein Keyword ein.',
    warnBeyond: (which: string, p: number) => `Für die ${which === 'current' ? 'aktuelle Position' : 'Zielposition'} ${p} enthält diese Kurve keine Daten; sie zählt als 0 Klicks.`,
    warnNoAio: (p: number) => `Für Position ${p} ist kein AI-Overview-Abschlag veröffentlicht; es gilt die CTR ohne AI Overview.`,
    invalid: (kw: string) => `${kw || '(ohne Keyword)'}: Bitte Suchvolumen (≥ 0), Zielposition (≥ 1) und, falls die Seite rankt, die aktuelle Position (≥ 1) eintragen.`,
    funnelInvalid: 'Raten und Marge müssen zwischen 0 und 100 liegen, Beträge dürfen nicht negativ sein.',
    local: 'Alle Eingaben bleiben in Ihrem Browser. Nichts wird gespeichert oder übertragen.',
  };
  return { ...base,
    loadFailed: 'The CTR data could not be loaded. Please reload the page.',
    setup: '1. Basis', curve: 'CTR curve', ownCurve: 'Your own curve from Search Console',
    ramp: 'Months until the target position', horizon: 'Forecast period (months)',
    keywords: '2. Keywords',
    keywordsHelp: 'Search volume from your keyword tool or Search Console. The calculator does not estimate search volume. Leave the current position empty if the page does not rank. “Brand” applies with the brand-split curve; intent only affects your lead rates in the funnel.',
    colKeyword: 'Keyword', colVolume: 'Search volume / month', colCurrent: 'Current position', colTarget: 'Target position', colIntent: 'Intent', colBrand: 'Brand', colAio: 'AI Overview',
    intents: { '': '–', informational: 'Informational', commercial: 'Commercial', transactional: 'Transactional' } as Record<string, string>,
    remove: 'Remove', addRow: 'Add row',
    importKeywords: 'Load keywords from CSV', importGsc: 'Load Search Console export as your own curve', template: 'CSV template',
    example: 'The two rows are example values. Replace them with your keywords or load a CSV file.',
    funnelH: '3. Business funnel (optional)',
    funnelHelp: 'Enter your own figures, for example from GA4, your CRM or your accounts. Without lead rate, close rate and customer value the calculator only forecasts clicks and invents no revenue.',
    basis: 'What to count', basisAdditional: 'Additional clicks only (what the SEO work adds)', basisTotal: 'All forecast clicks',
    leadRate: 'Lead rate (%)', leadRateHelp: 'Share of visitors who enquire, sign up or order.',
    leadRateIntent: (i: string) => `Lead rate ${i} (%)`, leadRateIntentHelp: 'Optional, only if you know a separate rate for this intent.',
    closeRate: 'Close rate (%)', closeRateHelp: 'Share of leads who become customers. For shops where the lead is the order: 100.',
    customerValue: (c: string) => `Customer value (${c})`, customerValueHelp: 'Customer lifetime value or average order value.',
    margin: 'Margin (%)', marginHelp: 'Share of revenue that remains as gross profit. 100 = count revenue in full.',
    invest: (c: string) => `SEO investment per month (${c})`, oneOff: (c: string) => `One-off investment in month 1 (${c})`, investHelp: 'Optional. ROI and break-even are only calculated with an investment.',
    result: '4. Result: clicks',
    today: 'Clicks per month today', target: 'Clicks per month at target position', extra: (n: number) => `Additional clicks over ${n} months`,
    chartClicks: 'Organic clicks per month (all keywords, dashed: today)', month: 'Month',
    colCurve: 'Curve', colCtrNow: 'CTR today', colCtrTarget: 'CTR target', colClicksNow: 'Clicks today', colClicksTarget: 'Clicks target',
    exportCsv: 'Clicks as CSV',
    funnelResult: '5. Result: business funnel',
    funnelMissing: 'The funnel still needs lead rate, close rate or customer value.',
    kpiTraffic: (b: string) => b === 'additional' ? 'Additional clicks per month at target' : 'Clicks per month at target',
    kpiLeads: 'Leads per month at target', kpiCustomers: 'Customers per month at target', kpiRevenue: 'Revenue per month at target', kpiGross: 'Gross profit per month at target', kpiNet: 'Net profit per month at target',
    kpiRoi: (n: number) => `ROI after ${n} months`, kpiReturn: (n: number) => `Gross profit per euro invested (${n} months)`, kpiBreakEven: 'Break-even', breakEvenMonth: (m: number) => `Month ${m}`, breakEvenNone: (n: number) => `not within ${n} months`,
    chartFunnel: 'Cumulative: gross profit (solid) and investment (dashed)',
    kpiTable: 'Key figures', colPerMonth: 'Per month (target)', colCumulative: (n: number) => `Cumulative (${n} months)`,
    rowClicks: 'Clicks', rowLeads: 'Leads', rowCustomers: 'Customers', rowRevenue: 'Revenue', rowGross: 'Gross profit', rowInvest: 'Investment', rowNet: 'Net profit',
    monthlyTable: 'Month by month', colMonth: 'Month', colCumNet: 'Net profit, cumulative', colRoi: 'ROI, cumulative',
    exportFunnel: 'Funnel as CSV',
    assumptions: '6. Assumptions',
    formula: 'Clicks per month = search volume × CTR of the position × AI Overview factor. Between today and reaching the target position, clicks rise linearly.',
    formulaFunnel: 'Leads = clicks × lead rate (per keyword by intent, if given) · Customers = leads × close rate · Revenue = customers × customer value · Gross profit = revenue × margin · Net profit = gross profit − investment · ROI = (gross profit − investment) ÷ investment, cumulative.',
    source: 'Source', position: 'Position', ctrAioShort: 'with AIO',
    aioReduction: (s: string) => `With an AI Overview, CTR is lowered by the published reduction per position (${s}).`,
    aioCurve: 'With an AI Overview, the separate CTR column of the same source applies.',
    aioNone: 'No AI Overview reduction is applied to your own curve. Your Search Console data already contains the effect.',
    presetBrand: 'Keywords ticked as “Brand” use the brand curve, all others the non-brand curve.',
    presetLength: 'Each keyword uses the curve for its word count (1 to 4 words).',
    noData: 'no data',
    gscInfo: (n: number) => `Your own curve from ${n} rows of your Search Console export. Positions with fewer than 100 impressions are left out.`,
    notTaken: 'Replaced by data compared with earlier versions: “AI target/AI dominance” (×1.15/×1.25) by the Seer factors for cited/not cited, brand ×1.8 by the brand curve, long tail ×1.2 by the word-count curves, industry lead rates by Ruler Analytics. Not carried over: a flat lead bonus for commercial keywords (use your own rates per intent instead) and exponential growth.',
    aioSel: { '': 'None', yes: 'Yes', cited: 'Yes, page cited', 'not-cited': 'Yes, not cited' } as Record<string, string>,
    aioCitedTag: 'AIO, cited', aioNotCitedTag: 'AIO, not cited',
    citation: (l: string) => `If you know whether your page is cited in the AI Overview, this applies instead of the average: ${l}`,
    userFactor: 'Your own CTR factor (%)', userFactorHelp: 'Your assumption without a source, e.g. from your own tests on snippets, ads or mobile. 100 = no change. Shown as an assumption in the result.',
    userFactorNote: (f: number) => `Your own CTR factor of ${f} % is applied to all keywords. This is your assumption, not a sourced figure.`,
    industry: 'Industry', industryNone: 'No starting value', industryAvg: (v: string) => `Average of all industries (${v})`,
    industrySource: 'Source',
    industryShort: (y: number) => `Starting value from Ruler Analytics (${y}), organic search. Please replace it with your own figure; details under “Assumptions”.`,
    warnings: 'Notes', errors: 'Please check', noKeywords: 'Enter at least one keyword.',
    warnBeyond: (which: string, p: number) => `This curve has no data for the ${which === 'current' ? 'current' : 'target'} position ${p}, so it counts as 0 clicks.`,
    warnNoAio: (p: number) => `No published AI Overview reduction for position ${p}; the CTR without AI Overview is used.`,
    invalid: (kw: string) => `${kw || '(no keyword)'}: please enter search volume (≥ 0), target position (≥ 1) and, if it ranks, a current position (≥ 1).`,
    funnelInvalid: 'Rates and margin must be between 0 and 100, amounts must not be negative.',
    local: 'All input stays in your browser. Nothing is stored or transmitted.',
  };
}

type Strings = ReturnType<typeof strings>;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = el('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readFile(input: HTMLInputElement): Promise<string> {
  const f = input.files && input.files[0];
  return f ? f.text() : Promise.resolve('');
}

function table(headers: string[], rows: string[][], cls = 'fc-table'): HTMLDivElement {
  const wrap = el('div', 'fc-table-wrap');
  const t = el('table', cls);
  const thead = el('thead');
  const hr = el('tr');
  headers.forEach((h) => hr.appendChild(el('th', undefined, h)));
  thead.appendChild(hr);
  const tbody = el('tbody');
  rows.forEach((r) => {
    const tr = el('tr');
    r.forEach((c) => tr.appendChild(el('td', undefined, c)));
    tbody.appendChild(tr);
  });
  t.append(thead, tbody);
  wrap.appendChild(t);
  return wrap;
}

interface Series { values: number[]; cls: string }

function lineChart(host: HTMLElement, title: string, series: Series[], fmt: (n: number) => string): void {
  // Measure before clearing: an empty host may be hidden by CSS and report width 0.
  const width = host.clientWidth || (host.parentElement ? host.parentElement.clientWidth : 0) || 720;
  host.textContent = '';
  const months = series[0]?.values.length || 0;
  if (!months) return;
  const W = Math.max(280, Math.min(1600, Math.round(width)));
  const H = W < 500 ? 220 : 280, R = 16, TOP = 20, B = 36;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const L = Math.max(48, Math.min(96, fmt(max).length * 8 + 12));
  const x = (i: number) => L + (months === 1 ? 0 : (i * (W - L - R)) / (months - 1));
  const y = (v: number) => TOP + (1 - Math.max(0, v) / max) * (H - TOP - B);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('class', 'fc-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', title);
  const add = (tag: string, attrs: Record<string, string | number>, text?: string) => {
    const n = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    if (text !== undefined) n.textContent = text;
    svg.appendChild(n);
  };
  for (let g = 0; g <= 4; g++) {
    const v = (max * g) / 4;
    add('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'fc-grid-line' });
    add('text', { x: L - 8, y: y(v) + 5, 'text-anchor': 'end', class: 'fc-axis' }, fmt(v));
  }
  const step = W < 500 ? Math.ceil(months / 6) : (months <= 12 ? 1 : 3);
  for (let i = 0; i < months; i++) {
    if (i === 0 || (i + 1) % step === 0) add('text', { x: x(i), y: H - 10, 'text-anchor': 'middle', class: 'fc-axis' }, String(i + 1));
  }
  for (const s of series) {
    if (s.values.every((v) => v === s.values[0]) && s.cls.includes('baseline')) {
      add('line', { x1: L, x2: W - R, y1: y(s.values[0]), y2: y(s.values[0]), class: s.cls });
      continue;
    }
    add('polyline', { points: s.values.map((v, i) => `${x(i)},${y(v)}`).join(' '), class: s.cls });
    if (s.cls === 'fc-line') s.values.forEach((v, i) => add('circle', { cx: x(i), cy: y(v), r: 4, class: 'fc-dot' }));
  }
  host.appendChild(el('p', 'fc-label', title));
  host.appendChild(svg);
}

export interface MountOptions {
  /** 'de' or 'en'. Default: data-lang of the element, then <html lang>, then 'de'. */
  lang?: Lang;
  /** URL of ctr-curves.json. Default: the file next to this module. */
  src?: string;
  /** ISO currency code for the funnel. Default: EUR. */
  currency?: string;
}

export interface Mounted {
  /** Removes the calculator and its window listener. */
  destroy(): void;
}

function defaultSrc(): string {
  try {
    return new URL('./ctr-curves.json', import.meta.url).href;
  } catch {
    return 'ctr-curves.json';
  }
}

export function mount(root: HTMLElement, options: MountOptions = {}): Mounted {
  const wanted = options.lang || root.dataset.lang || document.documentElement.lang || 'de';
  const lang: Lang = wanted.slice(0, 2).toLowerCase() === 'en' ? 'en' : 'de';
  const currency = (options.currency || root.dataset.currency || 'EUR').toUpperCase();
  const t: Strings = strings(lang, currency);
  const curSym = (0).toLocaleString(lang === 'de' ? 'de-DE' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).replace(/[\d\s.,]/g, '') || currency;
  const src = options.src || root.dataset.src || defaultSrc();

  let file: CurveFile;
  let presets: Preset[] = [];
  let own: Preset | null = null;
  let ownInfo = '';
  let last: ForecastResult | null = null;
  let lastFunnel: FunnelResult | null = null;
  const rows: Keyword[] = lang === 'de'
    ? [
        { keyword: 'briefing erstellen', volume: 1300, currentPosition: null, targetPosition: 3, aio: true, brand: false, intent: 'informational' },
        { keyword: 'seo agentur', volume: 880, currentPosition: 12, targetPosition: 5, aio: false, brand: false, intent: 'commercial' },
      ]
    : [
        { keyword: 'how to write a brief', volume: 1900, currentPosition: null, targetPosition: 3, aio: true, brand: false, intent: 'informational' },
        { keyword: 'seo agency', volume: 1300, currentPosition: 12, targetPosition: 5, aio: false, brand: false, intent: 'commercial' },
      ];

  root.textContent = '';
  root.classList.add('fc');

  const field = (label: string, input: HTMLElement, help?: string): HTMLDivElement => {
    const f = el('div', 'fc-field');
    const id = 'fc-' + Math.random().toString(36).slice(2, 9);
    input.id = id;
    const l = el('label', 'fc-label', label);
    l.htmlFor = id;
    f.append(l, input);
    if (help) {
      const h = el('p', 'fc-help', help);
      h.id = id + '-help';
      input.setAttribute('aria-describedby', h.id);
      f.appendChild(h);
    }
    return f;
  };
  const numInput = (value: string, min = '0', step = 'any', max?: string): HTMLInputElement => {
    const i = el('input', 'fc-input');
    i.type = 'number'; i.min = min; i.step = step; i.value = value; i.inputMode = 'decimal';
    if (max) i.max = max;
    return i;
  };
  const button = (text: string, cls: string): HTMLButtonElement => {
    const b = el('button', 'fc-btn ' + cls, text);
    b.type = 'button';
    return b;
  };

  // ---------- 1. basis ----------
  const setup = el('section', 'fc-card');
  setup.appendChild(el('h2', 'fc-h', t.setup));
  const grid = el('div', 'fc-grid');
  const curveSel = el('select', 'fc-input');
  const ramp = numInput('6', '1', '1', '36');
  const horizon = numInput('12', '1', '1', '36');
  const userFactor = numInput('100', '0', 'any', '500');
  grid.append(field(t.curve, curveSel), field(t.ramp, ramp), field(t.horizon, horizon), field(t.userFactor, userFactor, t.userFactorHelp));
  setup.appendChild(grid);
  const presetNote = el('p', 'fc-note');
  setup.appendChild(presetNote);

  // ---------- 2. keywords ----------
  const kwCard = el('section', 'fc-card');
  kwCard.append(el('h2', 'fc-h', t.keywords), el('p', 'fc-note', t.keywordsHelp), el('p', 'fc-note fc-example', t.example));
  const kwWrap = el('div', 'fc-table-wrap');
  const kwTable = el('table', 'fc-table fc-table--input');
  kwWrap.appendChild(kwTable);
  kwCard.appendChild(kwWrap);
  const kwActions = el('div', 'fc-actions');
  const addBtn = button(t.addRow, 'fc-btn--outline');
  const kwFile = el('input'); kwFile.type = 'file'; kwFile.accept = '.csv,text/csv,text/plain'; kwFile.hidden = true;
  const kwImport = button(t.importKeywords, 'fc-btn--outline');
  const gscFile = el('input'); gscFile.type = 'file'; gscFile.accept = '.csv,text/csv,text/plain'; gscFile.hidden = true;
  const gscImport = button(t.importGsc, 'fc-btn--outline');
  const templateBtn = button(t.template, 'fc-btn--secondary');
  kwActions.append(addBtn, kwImport, kwFile, gscImport, gscFile, templateBtn);
  kwCard.appendChild(kwActions);
  const messages = el('div', 'fc-messages');
  messages.setAttribute('role', 'status');
  messages.setAttribute('aria-live', 'polite');
  kwCard.appendChild(messages);

  // ---------- 3. funnel inputs ----------
  const fCard = el('section', 'fc-card');
  fCard.append(el('h2', 'fc-h', t.funnelH), el('p', 'fc-note', t.funnelHelp));
  const basisSel = el('select', 'fc-input');
  for (const [v, l] of [['additional', t.basisAdditional], ['total', t.basisTotal]]) { const o = el('option', undefined, l); o.value = v; basisSel.appendChild(o); }
  const leadRate = numInput('', '0', 'any', '100');
  const leadInfo = numInput('', '0', 'any', '100');
  const leadComm = numInput('', '0', 'any', '100');
  const leadTrans = numInput('', '0', 'any', '100');
  const closeRate = numInput('', '0', 'any', '100');
  const custValue = numInput('', '0', 'any');
  const margin = numInput('100', '0', 'any', '100');
  const invest = numInput('', '0', 'any');
  const oneOff = numInput('', '0', 'any');
  const industrySel = el('select', 'fc-input');
  const industryNote = el('p', 'fc-help');
  const industryField = field(t.industry, industrySel);
  industryField.appendChild(industryNote);
  const fGrid1 = el('div', 'fc-grid');
  fGrid1.append(industryField, field(t.basis, basisSel), field(t.leadRate, leadRate, t.leadRateHelp), field(t.closeRate, closeRate, t.closeRateHelp),
    field(t.customerValue(curSym), custValue, t.customerValueHelp), field(t.margin, margin, t.marginHelp));
  const fGrid2 = el('div', 'fc-grid');
  fGrid2.append(field(t.leadRateIntent(t.intents.informational), leadInfo, t.leadRateIntentHelp), field(t.leadRateIntent(t.intents.commercial), leadComm),
    field(t.leadRateIntent(t.intents.transactional), leadTrans));
  const fGrid3 = el('div', 'fc-grid');
  fGrid3.append(field(t.invest(curSym), invest, t.investHelp), field(t.oneOff(curSym), oneOff));
  fCard.append(fGrid1, fGrid2, fGrid3);

  // ---------- 4. clicks result ----------
  const resCard = el('section', 'fc-card');
  resCard.appendChild(el('h2', 'fc-h', t.result));
  const kpis = el('div', 'fc-kpis');
  const chart = el('div', 'fc-chart');
  const resTableHost = el('div');
  const warnBox = el('div', 'fc-warnings');
  const resActions = el('div', 'fc-actions');
  const exportBtn = button(t.exportCsv, 'fc-btn--primary');
  resActions.appendChild(exportBtn);
  resCard.append(kpis, chart, resTableHost, warnBox, resActions);

  // ---------- 5. funnel result ----------
  const fRes = el('section', 'fc-card');
  fRes.appendChild(el('h2', 'fc-h', t.funnelResult));
  const fBody = el('div');
  const fActions = el('div', 'fc-actions');
  const exportFunnelBtn = button(t.exportFunnel, 'fc-btn--primary');
  fActions.appendChild(exportFunnelBtn);
  fRes.append(fBody, fActions);

  // ---------- 6. assumptions ----------
  const assCard = el('section', 'fc-card');
  assCard.appendChild(el('h2', 'fc-h', t.assumptions));
  const assBody = el('div', 'fc-assumptions');
  assCard.appendChild(assBody);

  root.append(setup, kwCard, fCard, resCard, fRes, assCard, el('p', 'fc-note fc-local', t.local));

  // ---------- keyword rows ----------
  const numOrNull = (v: string): number | null => (v.trim() === '' ? null : Number(v.replace(',', '.')));

  function renderRows(): void {
    kwTable.textContent = '';
    const head = el('thead');
    const hr = el('tr');
    for (const h of [t.colKeyword, t.colVolume, t.colCurrent, t.colTarget, t.colIntent, t.colBrand, t.colAio, '']) hr.appendChild(el('th', undefined, h));
    head.appendChild(hr);
    const body = el('tbody');
    rows.forEach((r, i) => {
      const tr = el('tr');
      const cell = (input: HTMLElement, label: string) => {
        const td = el('td');
        td.dataset.label = label;
        input.setAttribute('aria-label', `${label} ${i + 1}`);
        td.appendChild(input);
        tr.appendChild(td);
      };
      const kw = el('input', 'fc-input'); kw.type = 'text'; kw.value = r.keyword;
      kw.addEventListener('input', () => { r.keyword = kw.value.trim(); update(); });
      const vol = numInput(String(r.volume)); vol.classList.add('fc-input--num');
      vol.addEventListener('input', () => { r.volume = vol.value === '' ? NaN : Number(vol.value); update(); });
      const cur = numInput(r.currentPosition === null ? '' : String(r.currentPosition), '1', '0.1'); cur.classList.add('fc-input--num');
      cur.addEventListener('input', () => { r.currentPosition = numOrNull(cur.value); update(); });
      const tgt = numInput(String(r.targetPosition), '1', '1'); tgt.classList.add('fc-input--num');
      tgt.addEventListener('input', () => { r.targetPosition = tgt.value === '' ? NaN : Number(tgt.value); update(); });
      const intent = el('select', 'fc-input');
      for (const [v, l] of Object.entries(t.intents)) { const o = el('option', undefined, l); o.value = v; intent.appendChild(o); }
      intent.value = r.intent || '';
      intent.addEventListener('change', () => { r.intent = (intent.value || null) as Intent | null; update(); });
      const brand = el('input'); brand.type = 'checkbox'; brand.checked = !!r.brand;
      brand.addEventListener('change', () => { r.brand = brand.checked; update(); });
      const aio = el('select', 'fc-input');
      for (const [v, l] of Object.entries(t.aioSel)) { const o = el('option', undefined, l); o.value = v; aio.appendChild(o); }
      aio.value = !r.aio ? '' : (r.aioCitation || 'yes');
      aio.addEventListener('change', () => {
        r.aio = aio.value !== '';
        r.aioCitation = aio.value === 'cited' || aio.value === 'not-cited' ? aio.value : null;
        update();
      });
      const del = button('×', 'fc-btn--secondary fc-btn--small fc-btn--icon');
      del.setAttribute('aria-label', `${t.remove}: ${r.keyword || i + 1}`);
      del.title = t.remove;
      del.addEventListener('click', () => { rows.splice(i, 1); renderRows(); update(); });
      cell(kw, t.colKeyword); cell(vol, t.colVolume); cell(cur, t.colCurrent); cell(tgt, t.colTarget);
      cell(intent, t.colIntent); cell(brand, t.colBrand); cell(aio, t.colAio);
      const td = el('td'); td.appendChild(del); tr.appendChild(td);
      body.appendChild(tr);
    });
    kwTable.append(head, body);
  }

  // ---------- presets ----------
  function renderPresetOptions(): void {
    const selected = curveSel.value;
    curveSel.textContent = '';
    for (const p of [...presets, ...(own ? [own] : [])]) { const o = el('option', undefined, p.label); o.value = p.id; curveSel.appendChild(o); }
    curveSel.value = selected && [...curveSel.options].some((o) => o.value === selected) ? selected : presets[0].id;
  }
  const currentPreset = (): Preset => (own && curveSel.value === own.id ? own : presets.find((p) => p.id === curveSel.value) || presets[0]);

  // ---------- messages ----------
  function showMessages(list: string[]): void {
    messages.textContent = '';
    if (!list.length) return;
    const box = el('div', 'fc-msg fc-msg--error');
    box.appendChild(el('p', 'fc-label', t.errors));
    const ul = el('ul');
    list.forEach((m) => ul.appendChild(el('li', undefined, m)));
    box.appendChild(ul);
    messages.appendChild(box);
  }

  const kpi = (host: HTMLElement, value: string, label: string, accent = false) => {
    const k = el('div', 'fc-kpi' + (accent ? ' fc-kpi--accent' : ''));
    k.append(el('p', 'fc-kpi__value', value), el('p', 'fc-kpi__label', label));
    host.appendChild(k);
  };

  // ---------- clicks result ----------
  function renderResult(result: ForecastResult): void {
    kpis.textContent = '';
    kpi(kpis, t.nf0.format(result.totals.currentClicks), t.today);
    kpi(kpis, t.nf0.format(result.totals.targetClicks), t.target);
    kpi(kpis, t.nf0.format(result.totals.additionalClicksOverHorizon), t.extra(result.settings.horizonMonths), true);
    lineChart(chart, t.chartClicks, [
      { values: result.totals.monthly.map(() => result.totals.currentClicks), cls: 'fc-baseline' },
      { values: result.totals.monthly, cls: 'fc-line' },
    ], (n) => t.nf0.format(n));
    const preset = currentPreset();
    const curveName = (id: string) => { const c = preset.curves.find((x) => x.id === id); return c ? (c.shortLabel || c.label) : id; };
    resTableHost.textContent = '';
    resTableHost.appendChild(table(
      [t.colKeyword, t.colVolume, t.colCurrent, t.colTarget, ...(preset.curves.length > 1 ? [t.colCurve] : []), t.colCtrNow, t.colCtrTarget, t.colClicksNow, t.colClicksTarget],
      result.keywords.map((k) => [
        k.keyword + (k.aio ? ` · ${k.aioCitation === 'cited' ? t.aioCitedTag : k.aioCitation === 'not-cited' ? t.aioNotCitedTag : 'AIO'}` : ''), t.nf0.format(k.volume), k.currentPosition === null ? '–' : t.nf.format(k.currentPosition), t.nf.format(k.targetPosition),
        ...(preset.curves.length > 1 ? [curveName(k.curveId)] : []),
        t.pct(k.currentCtr), t.pct(k.targetCtr), t.nf.format(k.currentClicks), t.nf.format(k.targetClicks),
      ]),
    ));
    warnBox.textContent = '';
    const warns = result.keywords.flatMap((k) => k.warnings.map((w) => `${k.keyword}: ${
      w.type === 'beyond-data' ? t.warnBeyond(w.which, Math.round(w.position)) : w.type === 'no-aio-reduction' ? t.warnNoAio(w.position) : w.message}`));
    if ((result.settings.userCtrFactor ?? 100) !== 100) warns.unshift(t.userFactorNote(result.settings.userCtrFactor as number));
    if (warns.length) {
      warnBox.appendChild(el('p', 'fc-label', t.warnings));
      const ul = el('ul');
      warns.forEach((w) => ul.appendChild(el('li', undefined, w)));
      warnBox.appendChild(ul);
    }
  }

  // ---------- funnel ----------
  const num = (i: HTMLInputElement): number | undefined => (i.value.trim() === '' ? undefined : Number(i.value));

  function funnelSettings(): FunnelSettings | null {
    const lr = num(leadRate), cr = num(closeRate), cv = num(custValue);
    if (lr === undefined || cr === undefined || cv === undefined) return null;
    const byIntent: Partial<Record<Intent, number>> = {};
    const li = num(leadInfo), lc = num(leadComm), lt = num(leadTrans);
    if (li !== undefined) byIntent.informational = li;
    if (lc !== undefined) byIntent.commercial = lc;
    if (lt !== undefined) byIntent.transactional = lt;
    return {
      leadRate: lr, closeRate: cr, customerValue: cv, margin: num(margin) ?? 100,
      leadRateByIntent: byIntent, monthlyInvestment: num(invest), oneOffInvestment: num(oneOff),
      basis: basisSel.value === 'total' ? 'total' : 'additional',
    };
  }

  function renderFunnel(result: ForecastResult | null): void {
    fBody.textContent = '';
    lastFunnel = null;
    exportFunnelBtn.disabled = true;
    const fs = funnelSettings();
    if (!result || !fs) { fBody.appendChild(el('p', 'fc-note', t.funnelMissing)); return; }
    if (validateFunnel(fs).length) { fBody.appendChild(el('p', 'fc-msg fc-msg--error', t.funnelInvalid)); return; }
    const f = funnel(result, fs);
    lastFunnel = f;
    exportFunnelBtn.disabled = false;
    const n = f.months.length;
    const hasInv = f.totals.investment > 0;

    const k1 = el('div', 'fc-kpis');
    kpi(k1, t.nf0.format(f.atTarget.clicks), t.kpiTraffic(fs.basis));
    kpi(k1, t.nf.format(f.atTarget.leads), t.kpiLeads);
    kpi(k1, t.nf.format(f.atTarget.customers), t.kpiCustomers);
    kpi(k1, t.cur.format(f.atTarget.revenue), t.kpiRevenue);
    kpi(k1, t.cur.format(f.atTarget.grossProfit), t.kpiGross, !hasInv);
    if (hasInv) kpi(k1, t.cur.format(f.atTarget.netProfit), t.kpiNet, true);
    fBody.appendChild(k1);
    if (hasInv) {
      const k2 = el('div', 'fc-kpis fc-kpis--second');
      kpi(k2, f.totals.roi === null ? '–' : t.pct(Math.round(f.totals.roi)), t.kpiRoi(n), true);
      kpi(k2, f.totals.returnPerEuro === null ? '–' : t.cur2.format(f.totals.returnPerEuro), t.kpiReturn(n));
      kpi(k2, f.totals.breakEvenMonth === null ? t.breakEvenNone(n) : t.breakEvenMonth(f.totals.breakEvenMonth), t.kpiBreakEven);
      fBody.appendChild(k2);
    }

    const fc = el('div', 'fc-chart');
    fBody.appendChild(fc);
    lineChart(fc, hasInv ? t.chartFunnel : t.rowGross, [
      ...(hasInv ? [{ values: f.months.map((m) => m.cumulativeInvestment), cls: 'fc-line fc-line--invest' }] : []),
      { values: f.months.map((m) => m.cumulativeGrossProfit), cls: 'fc-line' },
    ], (v) => t.cur.format(v));

    fBody.appendChild(el('p', 'fc-label fc-gap', t.kpiTable));
    const rowsKpi: string[][] = [
      [t.rowClicks, t.nf0.format(f.atTarget.clicks), t.nf0.format(f.totals.clicks)],
      [t.rowLeads, t.nf.format(f.atTarget.leads), t.nf0.format(f.totals.leads)],
      [t.rowCustomers, t.nf.format(f.atTarget.customers), t.nf.format(f.totals.customers)],
      [t.rowRevenue, t.cur.format(f.atTarget.revenue), t.cur.format(f.totals.revenue)],
      [t.rowGross, t.cur.format(f.atTarget.grossProfit), t.cur.format(f.totals.grossProfit)],
    ];
    if (hasInv) {
      rowsKpi.push([t.rowInvest, t.cur.format(fs.monthlyInvestment || 0), t.cur.format(f.totals.investment)]);
      rowsKpi.push([t.rowNet, t.cur.format(f.atTarget.netProfit), t.cur.format(f.totals.netProfit)]);
    }
    fBody.appendChild(table(['', t.colPerMonth, t.colCumulative(n)], rowsKpi, 'fc-table fc-table--kpi'));

    const det = el('details', 'fc-details');
    det.appendChild(el('summary', undefined, t.monthlyTable));
    det.appendChild(table(
      [t.colMonth, t.rowClicks, t.rowLeads, t.rowCustomers, t.rowRevenue, t.rowGross, ...(hasInv ? [t.rowInvest, t.colCumNet, t.colRoi] : [])],
      f.months.map((m) => [String(m.month), t.nf0.format(m.clicks), t.nf.format(m.leads), t.nf2.format(m.customers), t.cur.format(m.revenue), t.cur.format(m.grossProfit),
        ...(hasInv ? [t.cur.format(m.investment), t.cur.format(m.cumulativeNetProfit), m.cumulativeRoi === null ? '–' : t.pct(Math.round(m.cumulativeRoi))] : [])]),
    ));
    fBody.appendChild(det);
  }

  // ---------- assumptions ----------
  function renderAssumptions(preset: Preset): void {
    assBody.textContent = '';
    assBody.append(el('p', undefined, t.formula), el('p', undefined, t.formulaFunnel));
    const first = preset.curves[0];
    const s = first.source ? file.sources[first.source] : null;
    const p = el('p');
    if (s) {
      p.appendChild(document.createTextNode(`${t.curve}: ${preset.label}. ${t.source}: `));
      const a = el('a', undefined, `${s.publisher}, ${s.title}`);
      a.href = s.url; a.target = '_blank'; a.rel = 'noopener';
      p.append(a, document.createTextNode(` (${s.market}, ${s.data_period}). ${(lang === 'de' && s.method_de) || s.method}`));
    } else {
      p.textContent = ownInfo;
    }
    assBody.appendChild(p);
    if (preset.type === 'brand') assBody.appendChild(el('p', undefined, t.presetBrand));
    if (preset.type === 'query-length') assBody.appendChild(el('p', undefined, t.presetLength));

    if (first.aio.type === 'reduction') {
      const r = first.aio.source ? file.sources[first.aio.source] : null;
      const ap = el('p');
      ap.appendChild(document.createTextNode(t.aioReduction(r ? `${r.publisher}, ${r.data_period}` : '')));
      if (r) {
        const a = el('a', undefined, r.title); a.href = r.url; a.target = '_blank'; a.rel = 'noopener';
        ap.append(document.createTextNode(' '), a, document.createTextNode(`. ${(lang === 'de' && r.method_de) || r.method}`));
      }
      assBody.appendChild(ap);
    } else {
      assBody.appendChild(el('p', undefined, first.aio.type === 'curve' ? t.aioCurve : t.aioNone));
    }

    if (file.aio_citation && first.aio.type !== 'none') {
      const c = file.aio_citation;
      const cp = el('p');
      cp.appendChild(document.createTextNode(t.citation(c.label[lang]) + ' '));
      const a = el('a', undefined, c.source_ref.name); a.href = c.source_ref.url; a.target = '_blank'; a.rel = 'noopener';
      cp.append(a, document.createTextNode(`. ${(() => { const s = file.sources[c.source]; return s ? ((lang === 'de' && s.method_de) || s.method) : ''; })()}`));
      assBody.appendChild(cp);
    }
    const uf = Number(userFactor.value);
    if (Number.isFinite(uf) && uf !== 100 && userFactor.value.trim() !== '') assBody.appendChild(el('p', 'fc-msg', t.userFactorNote(uf)));
    const lr = file.industry_lead_rates;
    if (lr && industrySel.value) {
      const lp = el('p');
      const s = file.sources[lr.source];
      lp.appendChild(document.createTextNode(`${t.industry}: ${industrySel.selectedOptions[0]?.textContent || ''}. ${lr.note[lang]} ${t.industrySource}: `));
      const a = el('a', undefined, lr.source_ref.name); a.href = lr.source_ref.url; a.target = '_blank'; a.rel = 'noopener';
      lp.append(a, document.createTextNode(s ? `. ${(lang === 'de' && s.method_de) || s.method}` : '.'));
      assBody.appendChild(lp);
    }

    const maxP = Math.max(10, ...preset.curves.map((c) => maxPosition(c.ctr)));
    const short = (c: Curve) => c.shortLabel || c.label;
    const headers = [t.position, ...preset.curves.flatMap((c) => preset.curves.length > 1 ? [short(c), `${short(c)} ${t.ctrAioShort}`] : ['CTR', `CTR ${t.ctrAioShort}`])];
    const rowsA: string[][] = [];
    for (let pos = 1; pos <= maxP; pos++) {
      rowsA.push([String(pos), ...preset.curves.flatMap((c) => {
        const b = ctrFor(c, pos, false), a = ctrFor(c, pos, true);
        return [b === null ? t.noData : t.pct(b), a === null ? t.noData : t.pct(Math.round(a * 100) / 100)];
      })]);
    }
    assBody.appendChild(table(headers, rowsA, 'fc-table fc-table--compact'));

    const ul = el('ul', 'fc-caveats');
    file.caveats[lang].forEach((c) => ul.appendChild(el('li', undefined, c)));
    ul.appendChild(el('li', undefined, t.notTaken));
    assBody.appendChild(ul);
  }

  // ---------- update ----------
  function update(): void {
    const preset = currentPreset();
    presetNote.textContent = own && preset === own ? ownInfo : (preset.type === 'brand' ? t.presetBrand : preset.type === 'query-length' ? t.presetLength : '');
    renderAssumptions(preset);
    last = null;
    if (!rows.length) { showMessages([t.noKeywords]); renderFunnel(null); return; }
    const invalid = rows.filter((r) => !r.keyword || !Number.isFinite(r.volume) || r.volume < 0 || !Number.isFinite(r.targetPosition) || r.targetPosition < 1
      || (r.currentPosition !== null && (!Number.isFinite(r.currentPosition) || r.currentPosition < 1)));
    if (invalid.length) { showMessages(invalid.map((r) => t.invalid(r.keyword))); renderFunnel(null); return; }
    try {
      const ufv = userFactor.value.trim() === '' ? 100 : Number(userFactor.value);
      const cf = file.aio_citation ? { cited: file.aio_citation.cited, notCited: file.aio_citation.not_cited } : undefined;
      last = forecast(preset.choice, rows, { rampMonths: Number(ramp.value) || 1, horizonMonths: Number(horizon.value) || 12, citationFactors: cf, userCtrFactor: ufv });
      showMessages([]);
      renderResult(last);
    } catch (e) {
      showMessages([(e as Error).message]);
    }
    renderFunnel(last);
  }

  // ---------- events ----------
  curveSel.addEventListener('change', update);
  userFactor.addEventListener('input', update);
  industrySel.addEventListener('change', () => {
    const lr = file.industry_lead_rates;
    const v = industrySel.value;
    if (lr && v) {
      const rate = v === 'average' ? lr.average : lr.industries.find((i) => i.id === v)?.lead_rate;
      if (typeof rate === 'number') leadRate.value = String(rate);
      industryNote.textContent = t.industryShort(lr.source_ref.year);
    } else {
      industryNote.textContent = '';
    }
    update();
  });
  for (const i of [ramp, horizon, leadRate, leadInfo, leadComm, leadTrans, closeRate, custValue, margin, invest, oneOff]) i.addEventListener('input', update);
  basisSel.addEventListener('change', update);
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(update, 150); };
  window.addEventListener('resize', onResize);
  addBtn.addEventListener('click', () => {
    rows.push({ keyword: '', volume: 0, currentPosition: null, targetPosition: 1, aio: false, brand: false, intent: null });
    renderRows();
    const first = kwTable.querySelector<HTMLInputElement>('tbody tr:last-child input');
    if (first) first.focus();
  });
  kwImport.addEventListener('click', () => kwFile.click());
  kwFile.addEventListener('change', async () => {
    const { keywords, errors } = keywordsFromCsv(await readFile(kwFile));
    kwFile.value = '';
    if (keywords.length) { rows.splice(0, rows.length, ...keywords); renderRows(); update(); }
    if (errors.length) showMessages(errors);
  });
  gscImport.addEventListener('click', () => gscFile.click());
  gscFile.addEventListener('change', async () => {
    const { rows: gsc, errors } = searchConsoleFromCsv(await readFile(gscFile));
    gscFile.value = '';
    if (errors.length) { showMessages(errors); return; }
    const { ctr } = curveFromSearchConsole(gsc);
    if (!Object.keys(ctr).length) { showMessages(['no position with at least 100 impressions']); return; }
    const curve: Curve = { id: 'own-search-console', label: t.ownCurve, ctr, aio: { type: 'none' } };
    own = { id: curve.id, label: t.ownCurve, type: 'single', curves: [curve], choice: curve };
    ownInfo = t.gscInfo(gsc.length);
    renderPresetOptions();
    curveSel.value = own.id;
    update();
  });
  templateBtn.addEventListener('click', () => {
    const csv = lang === 'de'
      ? 'keyword;suchvolumen;aktuelle_position;zielposition;suchintention;marke;ai_overview\nbriefing erstellen;1300;;3;info;nein;zitiert\nseo agentur;880;12;5;kommerziell;nein;nein\n'
      : 'keyword,volume,current_position,target_position,intent,brand,aio\nhow to write a brief,1900,,3,informational,no,cited\nseo agency,1300,12,5,commercial,no,no\n';
    download(lang === 'de' ? 'seo-prognose-vorlage.csv' : 'seo-forecast-template.csv', csv);
  });
  exportBtn.addEventListener('click', () => { if (last) download(lang === 'de' ? 'seo-prognose-klicks.csv' : 'seo-forecast-clicks.csv', resultToCsv(last)); });
  exportFunnelBtn.addEventListener('click', () => { if (lastFunnel) download(lang === 'de' ? 'seo-prognose-funnel.csv' : 'seo-forecast-funnel.csv', funnelToCsv(lastFunnel)); });

  // ---------- start ----------
  fetch(src, { credentials: 'same-origin' })
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then((json: CurveFile) => {
      file = json;
      presets = presetsFromFile(file, lang);
      const lr = file.industry_lead_rates;
      if (lr) {
        const add = (v: string, l: string) => { const o = el('option', undefined, l); o.value = v; industrySel.appendChild(o); };
        add('', t.industryNone);
        lr.industries.slice().sort((a, b) => a.label[lang].localeCompare(b.label[lang], lang)).forEach((i) => add(i.id, `${i.label[lang]} · ${t.pct(i.lead_rate)}`));
        add('average', t.industryAvg(t.pct(lr.average)));
      } else {
        industryField.hidden = true;
      }
      renderPresetOptions();
      renderRows();
      update();
    })
    .catch(() => { root.textContent = t.loadFailed; });

  return {
    destroy() {
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
      root.textContent = '';
      root.classList.remove('fc');
    },
  };
}

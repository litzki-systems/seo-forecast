/**
 * seo-forecast · browser UI ("cockpit")
 *
 *   import { mount } from './seo-forecast.js';
 *   mount(document.getElementById('forecast'), { lang: 'de' });
 *
 * Inputs on the left, live results on the right: every change updates the key figures,
 * the chart and the tables at once. No globals, no inline scripts or style attributes
 * (CSP style-src 'self' works; the tooltip is positioned through the CSSOM), no storage,
 * no cookies, no requests besides loading ctr-curves.json from next to the module.
 * All classes use the fc- prefix. MIT License.
 */
import { forecast, ctrFor, maxPosition, curveFromSearchConsole, type Curve, type Keyword, type ForecastResult, type Intent, type AioCitation } from './forecast.js';
import { funnel, validateFunnel, type FunnelResult, type FunnelSettings } from './funnel.js';
import { keywordsFromCsv, searchConsoleFromCsv, resultToCsv, funnelToCsv } from './csv.js';
import { presetsFromFile, type CurveFile, type Lang, type Preset } from './data.js';

// ---------------------------------------------------------------------------
// Texts
// ---------------------------------------------------------------------------
function strings(lang: Lang, currency: string) {
  const locale = lang === 'de' ? 'de-DE' : 'en-US';
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const nf0 = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const cur = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 });
  const cur2 = new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 });
  const pct = (n: number) => nf2.format(n) + (lang === 'de' ? ' %' : '%');
  const base = { nf, nf0, nf2, cur, cur2, pct, locale };
  if (lang === 'de') return { ...base,
    title: 'SEO-Prognose', live: 'Live',
    months: 'Zeitraum', ramp: 'Hochlauf', monthsUnit: 'Mon.',
    keywords: 'Keywords', addRow: '+ Keyword', importKeywords: 'CSV laden', importGsc: 'Search-Console-Kurve', template: 'CSV-Vorlage',
    exampleKw: 'Beispiel-Keywords. Überschreiben Sie sie mit Ihren eigenen.',
    kwName: 'Keyword', volume: 'Suchvolumen', target: 'Ziel-Rang', current: 'Rang heute', currentNone: 'rankt nicht',
    intent: 'Suchabsicht', intents: { '': 'Absicht offen', informational: 'Informational', commercial: 'Kommerziell', transactional: 'Transaktional' } as Record<string, string>,
    brand: 'Marke', aio: 'AI Overview',
    aioSel: { '': 'Keine AI Overview', yes: 'AI Overview', cited: 'AI Overview, zitiert', 'not-cited': 'AI Overview, nicht zitiert' } as Record<string, string>,
    expected: 'Erwartete CTR', perMonth: 'Klicks/Monat', remove: 'Keyword entfernen',
    curveH: 'CTR-Grundlage', curve: 'CTR-Kurve', ownCurve: 'Eigene Kurve aus der Search Console',
    userFactor: 'Eigener CTR-Faktor', assumption: 'Eigene Annahme',
    userFactorHelp: 'Ohne Quelle, z. B. für Snippets, Anzeigen oder Mobil. Für diese Effekte gibt es keine belegten Faktoren. 100 % = keine Änderung.',
    funnelH: 'Business-Funnel', industry: 'Branche', industryNone: 'Branche wählen …', industryAvg: (v: string) => `Durchschnitt aller Branchen · ${v}`,
    industryShort: (y: number) => `Lead-Rate organische Suche, Ruler Analytics ${y}. Ersetzen Sie sie durch Ihre GA4-Zahl.`,
    leadRate: 'Lead-Rate', closeRate: 'Abschlussrate', customerValue: 'Kundenwert', margin: 'Marge',
    invest: 'SEO-Budget / Monat', oneOff: 'Einmalig (Monat 1)', investPh: 'optional',
    example: 'Beispiel', exampleHelp: 'Beispielwert ohne Quelle. Tragen Sie Ihre eigene Zahl ein.',
    basis: 'Rechnen mit', basisAdditional: 'Zusatz-Klicks', basisTotal: 'Allen Klicks',
    intentRates: 'Lead-Rate je Suchabsicht', intentRatesHelp: 'Optional, wenn Sie je Suchabsicht eigene Raten kennen.',
    kpiTraffic: (b: string) => (b === 'additional' ? 'Zusatz-Traffic' : 'Traffic'), kpiTrafficSub: 'Klicks pro Monat im Ziel',
    kpiRevenue: 'Umsatz-Potenzial', kpiRevenueSub: 'pro Monat im Ziel',
    kpiNet: 'Reingewinn', kpiGross: 'Rohertrag', kpiNetSub: 'pro Monat im Ziel',
    kpiRoi: 'ROI', kpiRoiNone: 'SEO-Budget eintragen', kpiRoiSub: (n: number) => `nach ${n} Monaten`, perEuro: (v: string) => `1 € bringt ${v}`,
    breakEven: (m: number | null, n: number) => (m === null ? `Kein Break-even in ${n} Monaten` : `Break-even in Monat ${m}`),
    tabMoney: 'Rohertrag', tabClicks: 'Klicks',
    legendGross: 'Rohertrag kumuliert', legendInvest: 'Investition kumuliert', legendClicks: 'Klicks', legendToday: 'heute',
    month: 'Monat', monthShort: 'M',
    kpiTable: 'Performance', colPerMonth: 'Monatlich im Ziel', colCumulative: (n: number) => `Kumuliert ${n} Monate`,
    rowClicks: 'Klicks', rowLeads: 'Leads', rowCustomers: 'Kunden', rowRevenue: 'Umsatz', rowGross: 'Rohertrag', rowInvest: 'Investition', rowNet: 'Reingewinn',
    kwTable: 'Je Keyword', colKw: 'Keyword', colPos: 'Rang', colCtr: 'CTR', colClicks: 'Klicks / Monat',
    monthly: 'Monat für Monat', colCumNet: 'Reingewinn kum.', colRoi: 'ROI kum.',
    exportClicks: 'Klicks als CSV', exportFunnel: 'Funnel als CSV',
    funnelMissing: 'Lead-Rate, Abschlussrate und Kundenwert eintragen, dann erscheinen Umsatz und Gewinn.',
    funnelInvalid: 'Raten und Marge zwischen 0 und 100, Beträge nicht negativ.',
    notes: 'Hinweise', errors: 'Bitte prüfen',
    warnBeyond: (which: string, p: number) => `Für ${which === 'current' ? 'den heutigen Rang' : 'den Ziel-Rang'} ${p} hat diese Kurve keine Daten; zählt als 0 Klicks.`,
    warnNoAio: (p: number) => `Für Rang ${p} ist kein AI-Overview-Abschlag veröffentlicht; es gilt die CTR ohne AI Overview.`,
    userFactorNote: (f: string) => `Eigener CTR-Faktor ${f} angewendet. Das ist Ihre Annahme, keine belegte Zahl.`,
    invalid: (kw: string) => `${kw || '(ohne Name)'}: Suchvolumen ≥ 0 und Ziel-Rang ≥ 1 eintragen.`,
    noKeywords: 'Fügen Sie mindestens ein Keyword hinzu.',
    assumptions: 'Annahmen und Quellen',
    formula: 'Klicks pro Monat = Suchvolumen × CTR des Rangs × AI-Overview-Faktor × eigener CTR-Faktor. Bis zum Ziel-Rang steigen die Klicks linear über die Hochlauf-Monate.',
    formulaFunnel: 'Leads = Klicks × Lead-Rate (je Keyword nach Suchabsicht, falls angegeben) · Kunden = Leads × Abschlussrate · Umsatz = Kunden × Kundenwert · Rohertrag = Umsatz × Marge · Reingewinn = Rohertrag − Investition · ROI = (Rohertrag − Investition) ÷ Investition, kumuliert.',
    source: 'Quelle', position: 'Rang', ctrAioShort: 'mit AIO', noData: 'keine Daten',
    aioReduction: (s: string) => `Mit AI Overview (Zitierung unbekannt) sinkt die CTR um den veröffentlichten Abschlag je Rang (${s}).`,
    aioCurve: 'Mit AI Overview (Zitierung unbekannt) gilt die eigene CTR-Spalte derselben Quelle.',
    aioNone: 'Für die eigene Kurve gibt es keinen AI-Overview-Abschlag; Ihre Search-Console-Daten enthalten den Effekt bereits.',
    citation: (l: string) => `Ist bekannt, ob Ihre Seite in der AI Overview zitiert wird, gilt statt des Durchschnitts: ${l}`,
    presetBrand: 'Keywords mit „Marke“ nutzen die Marken-Kurve, alle anderen die Kurve ohne Marke.',
    presetLength: 'Jedes Keyword nutzt die Kurve für seine Wortzahl (1 bis 4 Wörter).',
    gscInfo: (n: number) => `Eigene Kurve aus ${n} Zeilen Ihres Search-Console-Exports; Ränge mit weniger als 100 Impressionen ausgelassen.`,
    examplesNote: 'Abschlussrate, Kundenwert und Marge sind als Beispiel vorbelegt, damit der Funnel sofort rechnet. Für sie gibt es keine belegten Branchenwerte; ersetzen Sie sie durch Ihre Zahlen.',
    notTaken: 'Gegenüber früheren Fassungen durch Daten ersetzt: „KI-Ziel/KI-Dominanz“ durch die Seer-Faktoren für zitiert/nicht zitiert, Marke ×1,8 durch die Marken-Kurve, Long-Tail ×1,2 durch die Kurven nach Wortzahl, Branchen-Lead-Raten durch Ruler Analytics. Für Snippets, Anzeigen oder Mobil gibt es keine belegten Faktoren; dafür ist der eigene CTR-Faktor da, gekennzeichnet als Annahme. Nicht übernommen: pauschaler Lead-Aufschlag für kommerzielle Keywords und exponentielles Wachstum.',
    local: 'Alle Eingaben bleiben in Ihrem Browser. Nichts wird gespeichert oder übertragen.',
    loadFailed: 'Die CTR-Daten konnten nicht geladen werden. Bitte laden Sie die Seite neu.',
  };
  return { ...base,
    title: 'SEO forecast', live: 'Live',
    months: 'Period', ramp: 'Ramp-up', monthsUnit: 'mo',
    keywords: 'Keywords', addRow: '+ Keyword', importKeywords: 'Load CSV', importGsc: 'Search Console curve', template: 'CSV template',
    exampleKw: 'Example keywords. Overwrite them with your own.',
    kwName: 'Keyword', volume: 'Search volume', target: 'Target rank', current: 'Rank today', currentNone: 'not ranking',
    intent: 'Intent', intents: { '': 'Intent open', informational: 'Informational', commercial: 'Commercial', transactional: 'Transactional' } as Record<string, string>,
    brand: 'Brand', aio: 'AI Overview',
    aioSel: { '': 'No AI Overview', yes: 'AI Overview', cited: 'AI Overview, cited', 'not-cited': 'AI Overview, not cited' } as Record<string, string>,
    expected: 'Expected CTR', perMonth: 'clicks/month', remove: 'Remove keyword',
    curveH: 'CTR basis', curve: 'CTR curve', ownCurve: 'Your own curve from Search Console',
    userFactor: 'Your own CTR factor', assumption: 'Your assumption',
    userFactorHelp: 'Without a source, e.g. for snippets, ads or mobile. There are no sourced factors for these effects. 100% = no change.',
    funnelH: 'Business funnel', industry: 'Industry', industryNone: 'Choose industry …', industryAvg: (v: string) => `Average of all industries · ${v}`,
    industryShort: (y: number) => `Organic search lead rate, Ruler Analytics ${y}. Replace it with your GA4 figure.`,
    leadRate: 'Lead rate', closeRate: 'Close rate', customerValue: 'Customer value', margin: 'Margin',
    invest: 'SEO budget / month', oneOff: 'One-off (month 1)', investPh: 'optional',
    example: 'Example', exampleHelp: 'Example value without a source. Enter your own figure.',
    basis: 'Count', basisAdditional: 'Additional clicks', basisTotal: 'All clicks',
    intentRates: 'Lead rate per intent', intentRatesHelp: 'Optional, if you know separate rates per intent.',
    kpiTraffic: (b: string) => (b === 'additional' ? 'Additional traffic' : 'Traffic'), kpiTrafficSub: 'clicks per month at target',
    kpiRevenue: 'Revenue potential', kpiRevenueSub: 'per month at target',
    kpiNet: 'Net profit', kpiGross: 'Gross profit', kpiNetSub: 'per month at target',
    kpiRoi: 'ROI', kpiRoiNone: 'Enter SEO budget', kpiRoiSub: (n: number) => `after ${n} months`, perEuro: (v: string) => `€1 returns ${v}`,
    breakEven: (m: number | null, n: number) => (m === null ? `No break-even within ${n} months` : `Break-even in month ${m}`),
    tabMoney: 'Gross profit', tabClicks: 'Clicks',
    legendGross: 'Gross profit, cumulative', legendInvest: 'Investment, cumulative', legendClicks: 'Clicks', legendToday: 'today',
    month: 'Month', monthShort: 'M',
    kpiTable: 'Performance', colPerMonth: 'Per month at target', colCumulative: (n: number) => `Cumulative ${n} months`,
    rowClicks: 'Clicks', rowLeads: 'Leads', rowCustomers: 'Customers', rowRevenue: 'Revenue', rowGross: 'Gross profit', rowInvest: 'Investment', rowNet: 'Net profit',
    kwTable: 'Per keyword', colKw: 'Keyword', colPos: 'Rank', colCtr: 'CTR', colClicks: 'Clicks / month',
    monthly: 'Month by month', colCumNet: 'Net profit cum.', colRoi: 'ROI cum.',
    exportClicks: 'Clicks as CSV', exportFunnel: 'Funnel as CSV',
    funnelMissing: 'Enter lead rate, close rate and customer value to see revenue and profit.',
    funnelInvalid: 'Rates and margin between 0 and 100, amounts not negative.',
    notes: 'Notes', errors: 'Please check',
    warnBeyond: (which: string, p: number) => `This curve has no data for the ${which === 'current' ? 'current' : 'target'} rank ${p}; counts as 0 clicks.`,
    warnNoAio: (p: number) => `No published AI Overview reduction for rank ${p}; the CTR without AI Overview is used.`,
    userFactorNote: (f: string) => `Your own CTR factor of ${f} is applied. This is your assumption, not a sourced figure.`,
    invalid: (kw: string) => `${kw || '(no name)'}: enter search volume ≥ 0 and target rank ≥ 1.`,
    noKeywords: 'Add at least one keyword.',
    assumptions: 'Assumptions and sources',
    formula: 'Clicks per month = search volume × CTR of the rank × AI Overview factor × your own CTR factor. Clicks rise linearly over the ramp-up months until the target rank.',
    formulaFunnel: 'Leads = clicks × lead rate (per keyword by intent, if given) · Customers = leads × close rate · Revenue = customers × customer value · Gross profit = revenue × margin · Net profit = gross profit − investment · ROI = (gross profit − investment) ÷ investment, cumulative.',
    source: 'Source', position: 'Rank', ctrAioShort: 'with AIO', noData: 'no data',
    aioReduction: (s: string) => `With an AI Overview (citation unknown), CTR drops by the published reduction per rank (${s}).`,
    aioCurve: 'With an AI Overview (citation unknown), the separate CTR column of the same source applies.',
    aioNone: 'Your own curve has no AI Overview reduction; your Search Console data already contains the effect.',
    citation: (l: string) => `If you know whether your page is cited in the AI Overview, this applies instead of the average: ${l}`,
    presetBrand: 'Keywords marked “Brand” use the brand curve, all others the non-brand curve.',
    presetLength: 'Each keyword uses the curve for its word count (1 to 4 words).',
    gscInfo: (n: number) => `Your own curve from ${n} rows of your Search Console export; ranks with fewer than 100 impressions left out.`,
    examplesNote: 'Close rate, customer value and margin are prefilled as examples so the funnel calculates right away. There are no sourced industry values for them; replace them with your figures.',
    notTaken: 'Replaced by data compared with earlier versions: “AI target/AI dominance” by the Seer factors for cited/not cited, brand ×1.8 by the brand curve, long tail ×1.2 by the word-count curves, industry lead rates by Ruler Analytics. There are no sourced factors for snippets, ads or mobile; that is what your own CTR factor is for, labelled as an assumption. Not carried over: a flat lead bonus for commercial keywords and exponential growth.',
    local: 'All input stays in your browser. Nothing is stored or transmitted.',
    loadFailed: 'The CTR data could not be loaded. Please reload the page.',
  };
}

type Strings = ReturnType<typeof strings>;

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

const SVG = 'http://www.w3.org/2000/svg';
function svgEl(tag: string, attrs: Record<string, string | number> = {}, text?: string): SVGElement {
  const n = document.createElementNS(SVG, tag) as SVGElement;
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
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

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animated number: counts from the last shown value to the new one. */
class Ticker {
  private value = 0;
  private frame = 0;
  constructor(private node: HTMLElement, private fmt: (n: number) => string) {}
  set(to: number | null, text = '–'): void {
    cancelAnimationFrame(this.frame);
    this.node.classList.remove('fc-is-bump');
    if (to === null || !Number.isFinite(to)) { this.node.textContent = text; return; }
    const from = this.value;
    this.value = to;
    if (reducedMotion() || Math.abs(from - to) < 1e-9) { this.node.textContent = this.fmt(to); return; }
    void this.node.offsetWidth;
    this.node.classList.add('fc-is-bump');
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / 420);
      const e = 1 - Math.pow(1 - p, 3);
      this.node.textContent = this.fmt(from + (to - from) * e);
      if (p < 1) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }
  stop(): void { cancelAnimationFrame(this.frame); }
}

// ---------------------------------------------------------------------------
// Chart: one persistent SVG; paths only change their "d", so CSS can animate them
// ---------------------------------------------------------------------------
interface ChartSeries { name: string; values: number[]; kind: 'area' | 'dashed' }

class Chart {
  readonly root: HTMLDivElement;
  private svg: SVGSVGElement;
  private gGrid: SVGElement;
  private gAxis: SVGElement;
  private paths: SVGElement[] = [];
  private gDots: SVGElement;
  private cursor: SVGElement;
  private tip: HTMLDivElement;
  private gradId: string;
  private W = 720; private H = 320; private L = 64; private R = 16; private T = 16; private B = 36;
  private last: { series: ChartSeries[]; fmt: (n: number) => string; label: (i: number) => string } | null = null;

  constructor(label: string) {
    this.root = el('div', 'fc-chart');
    this.svg = document.createElementNS(SVG, 'svg') as SVGSVGElement;
    this.svg.setAttribute('class', 'fc-svg');
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', label);
    const defs = svgEl('defs');
    this.gradId = `fc-grad-${Math.random().toString(36).slice(2, 9)}`;
    const grad = svgEl('linearGradient', { id: this.gradId, x1: 0, x2: 0, y1: 0, y2: 1 });
    grad.append(svgEl('stop', { offset: '0%', class: 'fc-grad-top' }), svgEl('stop', { offset: '100%', class: 'fc-grad-bottom' }));
    defs.appendChild(grad);
    this.gGrid = svgEl('g');
    this.gAxis = svgEl('g');
    this.gDots = svgEl('g');
    this.cursor = svgEl('line', { class: 'fc-cursor', x1: 0, x2: 0, y1: 0, y2: 0 });
    this.svg.append(defs, this.gGrid, this.gAxis, this.cursor, this.gDots);
    this.tip = el('div', 'fc-tip');
    this.tip.hidden = true;
    this.root.append(this.svg, this.tip);
    this.svg.addEventListener('pointermove', (e) => this.hover(e));
    this.svg.addEventListener('pointerleave', () => this.leave());
  }

  setLabel(label: string): void { this.svg.setAttribute('aria-label', label); }

  draw(series: ChartSeries[], fmt: (n: number) => string, label: (i: number) => string): void {
    this.last = { series, fmt, label };
    const n = series[0]?.values.length || 0;
    if (!n) return;
    // drawn 1:1 in CSS pixels, so the 14 px axis labels stay 14 px
    const width = this.root.clientWidth || this.root.parentElement?.clientWidth || 720;
    this.W = Math.max(260, Math.round(width));
    this.H = this.W < 560 ? 240 : 320;
    const raw = Math.max(1, ...series.flatMap((s) => s.values)) / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const tick = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) || 10) * mag;
    const max = tick * 4;
    this.L = Math.max(48, Math.min(120, fmt(max).length * 8.6 + 16));
    const { W, H, L, R, T, B } = this;
    const x = (i: number) => L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
    const y = (v: number) => T + (1 - Math.max(0, v) / max) * (H - T - B);
    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.svg.setAttribute('width', String(W));
    this.svg.setAttribute('height', String(H));

    this.gGrid.textContent = '';
    this.gAxis.textContent = '';
    for (let g = 0; g <= 4; g++) {
      const v = (max * g) / 4;
      this.gGrid.appendChild(svgEl('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'fc-grid-line' }));
      this.gAxis.appendChild(svgEl('text', { x: L - 10, y: y(v) + 5, 'text-anchor': 'end', class: 'fc-axis' }, fmt(v)));
    }
    const maxLabels = Math.max(2, Math.floor((W - L - R) / 52));
    const step = Math.max(1, Math.ceil(n / maxLabels));
    for (let i = 0; i < n; i++) {
      if (i % step === 0) {
        this.gAxis.appendChild(svgEl('text', { x: x(i), y: H - 10, 'text-anchor': 'middle', class: 'fc-axis' }, label(i)));
      }
    }

    while (this.paths.length < series.length * 2) {
      const p = svgEl('path');
      this.svg.insertBefore(p, this.cursor);
      this.paths.push(p);
    }
    this.paths.forEach((p, idx) => {
      const s = series[Math.floor(idx / 2)];
      const isFill = idx % 2 === 0;
      if (!s || (isFill && s.kind !== 'area')) { p.setAttribute('d', 'M0,0'); p.setAttribute('class', 'fc-off'); return; }
      const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
      if (isFill) {
        p.setAttribute('d', `M${x(0).toFixed(1)},${y(0).toFixed(1)} L${pts.join(' L')} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} Z`);
        p.setAttribute('class', 'fc-area');
        p.setAttribute('fill', `url(#${this.gradId})`);
      } else {
        p.setAttribute('d', `M${pts.join(' L')}`);
        p.setAttribute('class', s.kind === 'dashed' ? 'fc-line fc-line--dashed' : 'fc-line');
      }
    });

    const main = series[0];
    this.gDots.textContent = '';
    main.values.forEach((v, i) => this.gDots.appendChild(svgEl('circle', { cx: x(i), cy: y(v), r: n > 24 ? 2.5 : 3.5, class: 'fc-dot' })));
    this.cursor.setAttribute('y1', String(T));
    this.cursor.setAttribute('y2', String(H - B));
  }

  redraw(): void { if (this.last) this.draw(this.last.series, this.last.fmt, this.last.label); }

  private leave(): void {
    this.tip.hidden = true;
    this.cursor.setAttribute('class', 'fc-cursor');
  }

  private hover(e: PointerEvent): void {
    if (!this.last) return;
    const { series, fmt, label } = this.last;
    const n = series[0].values.length;
    const box = this.svg.getBoundingClientRect();
    const scale = this.W / Math.max(1, box.width);
    const px = (e.clientX - box.left) * scale;
    const i = Math.max(0, Math.min(n - 1, Math.round(((px - this.L) / (this.W - this.L - this.R)) * (n - 1))));
    const cx = this.L + (n === 1 ? (this.W - this.L - this.R) / 2 : (i * (this.W - this.L - this.R)) / (n - 1));
    this.cursor.setAttribute('x1', String(cx));
    this.cursor.setAttribute('x2', String(cx));
    this.cursor.setAttribute('class', 'fc-cursor fc-is-on');
    this.tip.textContent = '';
    this.tip.appendChild(el('strong', 'fc-tip__head', label(i)));
    series.forEach((s) => {
      const row = el('span', 'fc-tip__row' + (s.kind === 'dashed' ? ' fc-is-dashed' : ''));
      row.append(el('span', 'fc-tip__name', s.name), el('span', 'fc-tip__val', fmt(s.values[i])));
      this.tip.appendChild(row);
    });
    this.tip.hidden = false;
    const left = cx / scale;
    const tipW = this.tip.offsetWidth || 180;
    // CSSOM positioning, allowed under style-src 'self'
    this.tip.style.left = `${left + 14 + tipW > box.width ? Math.max(0, left - tipW - 14) : left + 14}px`;
    this.tip.style.top = `${Math.max(0, (this.T / scale))}px`;
  }
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------
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
  const curSym = (0).toLocaleString(t.locale, { style: 'currency', currency, maximumFractionDigits: 0 }).replace(/[\d\s.,]/g, '') || currency;
  const src = options.src || root.dataset.src || defaultSrc();

  let file: CurveFile;
  let presets: Preset[] = [];
  let own: Preset | null = null;
  let ownInfo = '';
  let last: ForecastResult | null = null;
  let lastFunnel: FunnelResult | null = null;
  let chartMode: 'money' | 'clicks' = 'money';
  let basis: 'additional' | 'total' = 'additional';
  let examplesActive = true;
  let uid = 0;
  const nextId = () => `fc-${++uid}-${Math.random().toString(36).slice(2, 7)}`;

  const rows: Keyword[] = lang === 'de'
    ? [
        { keyword: 'briefing erstellen', volume: 1300, currentPosition: null, targetPosition: 3, aio: true, aioCitation: 'cited', brand: false, intent: 'informational' },
        { keyword: 'seo agentur münchen', volume: 880, currentPosition: 8, targetPosition: 3, aio: false, brand: false, intent: 'commercial' },
        { keyword: 'seo beratung', volume: 1900, currentPosition: 9, targetPosition: 2, aio: false, brand: false, intent: 'commercial' },
      ]
    : [
        { keyword: 'how to write a brief', volume: 1900, currentPosition: null, targetPosition: 3, aio: true, aioCitation: 'cited', brand: false, intent: 'informational' },
        { keyword: 'seo agency london', volume: 1300, currentPosition: 8, targetPosition: 3, aio: false, brand: false, intent: 'commercial' },
        { keyword: 'seo consulting', volume: 2400, currentPosition: 9, targetPosition: 2, aio: false, brand: false, intent: 'commercial' },
      ];

  root.textContent = '';
  root.classList.add('fc');

  // ---------- small builders ----------
  const button = (text: string, cls: string): HTMLButtonElement => { const b = el('button', 'fc-btn ' + cls, text); b.type = 'button'; return b; };
  const numInput = (value: string, min = '0', step = 'any', max?: string): HTMLInputElement => {
    const i = el('input', 'fc-input');
    i.type = 'number'; i.min = min; i.step = step; i.value = value; i.inputMode = 'decimal';
    if (max) i.max = max;
    return i;
  };
  const rangeInput = (min: number, max: number, value: number, step = 1): HTMLInputElement => {
    const i = el('input', 'fc-range');
    i.type = 'range'; i.min = String(min); i.max = String(max); i.step = String(step); i.value = String(value);
    return i;
  };
  /** Field with label; `target` is the element the label points to (default: `content`). */
  const labelled = (label: string, content: HTMLElement, target: HTMLElement = content): HTMLDivElement => {
    const f = el('div', 'fc-field');
    target.id = nextId();
    const l = el('label', 'fc-label');
    l.appendChild(el('span', undefined, label));
    l.htmlFor = target.id;
    f.append(l, content);
    return f;
  };
  const chip = (field: HTMLElement, text: string, cls: string, title?: string): HTMLSpanElement => {
    const c = el('span', 'fc-chip ' + cls, text);
    if (title) c.title = title;
    field.querySelector('.fc-label')?.appendChild(c);
    return c;
  };
  /** Number input with a unit; an "example" chip disappears once the value is edited. */
  const unitField = (label: string, input: HTMLInputElement, unit: string, example = false): HTMLDivElement => {
    const wrap = el('div', 'fc-unit');
    wrap.append(input, el('span', 'fc-unit__u', unit));
    const field = labelled(label, wrap, input);
    if (example) {
      const c = chip(field, t.example, 'fc-chip--example', t.exampleHelp);
      input.addEventListener('input', () => c.remove(), { once: true });
    }
    return field;
  };
  const panel = (title: string, extra?: HTMLElement): { box: HTMLElement; body: HTMLDivElement } => {
    const box = el('section', 'fc-panel');
    const head = el('div', 'fc-panel__head');
    head.appendChild(el('h3', 'fc-panel__title', title));
    if (extra) head.appendChild(extra);
    const body = el('div', 'fc-panel__body');
    box.append(head, body);
    return { box, body };
  };

  // ---------- top bar ----------
  const bar = el('div', 'fc-bar');
  const brandBox = el('div', 'fc-bar__brand');
  brandBox.append(el('span', 'fc-bar__title', t.title), el('span', 'fc-live', t.live));
  const barCtl = (label: string, input: HTMLInputElement): { box: HTMLDivElement; out: HTMLOutputElement } => {
    const box = el('div', 'fc-bar__ctl');
    input.id = nextId();
    const l = el('label', 'fc-bar__label', label);
    l.htmlFor = input.id;
    const out = el('output', 'fc-bar__val');
    out.htmlFor.add(input.id);
    box.append(l, input, out);
    return { box, out };
  };
  const months = rangeInput(3, 36, 12);
  const ramp = rangeInput(1, 24, 6);
  const monthsCtl = barCtl(t.months, months);
  const rampCtl = barCtl(t.ramp, ramp);
  bar.append(brandBox, rampCtl.box, monthsCtl.box);

  // ---------- left: keywords ----------
  const side = el('div', 'fc-side');
  const kwCount = el('span', 'fc-count');
  const kwPanel = panel(t.keywords, kwCount);
  const kwList = el('div', 'fc-kws');
  const exampleNote = el('p', 'fc-note fc-note--example', t.exampleKw);
  const kwTools = el('div', 'fc-tools');
  const addBtn = button(t.addRow, 'fc-btn--primary fc-btn--small');
  const kwImport = button(t.importKeywords, 'fc-btn--ghost fc-btn--small');
  const gscImport = button(t.importGsc, 'fc-btn--ghost fc-btn--small');
  const templateBtn = button(t.template, 'fc-btn--ghost fc-btn--small');
  const kwFile = el('input'); kwFile.type = 'file'; kwFile.accept = '.csv,text/csv,text/plain'; kwFile.hidden = true;
  const gscFile = el('input'); gscFile.type = 'file'; gscFile.accept = '.csv,text/csv,text/plain'; gscFile.hidden = true;
  kwTools.append(addBtn, kwImport, gscImport, templateBtn, kwFile, gscFile);
  kwPanel.body.append(exampleNote, kwList, kwTools);

  // ---------- left: CTR basis ----------
  const ctrPanel = panel(t.curveH);
  const curveSel = el('select', 'fc-input');
  const presetNote = el('p', 'fc-note');
  const userFactor = rangeInput(50, 200, 100, 5);
  const ufBox = el('div', 'fc-slider');
  const ufOut = el('output', 'fc-slider__val');
  ufBox.append(userFactor, ufOut);
  const ufField = labelled(t.userFactor, ufBox, userFactor);
  chip(ufField, t.assumption, 'fc-chip--assumption');
  ufField.appendChild(el('p', 'fc-help', t.userFactorHelp));
  ctrPanel.body.append(labelled(t.curve, curveSel), presetNote, ufField);

  // ---------- left: funnel ----------
  const fPanel = panel(t.funnelH);
  const industrySel = el('select', 'fc-input');
  const industryNote = el('p', 'fc-help');
  const leadRate = numInput('', '0', 'any', '100');
  const closeRate = numInput('20', '0', 'any', '100');
  const custValue = numInput('1500', '0', 'any');
  const margin = numInput('40', '0', 'any', '100');
  const invest = numInput('1000', '0', 'any');
  const oneOff = numInput('', '0', 'any'); oneOff.placeholder = t.investPh;
  const leadInfo = numInput('', '0', 'any', '100');
  const leadComm = numInput('', '0', 'any', '100');
  const leadTrans = numInput('', '0', 'any', '100');
  for (const i of [leadInfo, leadComm, leadTrans]) i.placeholder = t.investPh;
  const seg = (a: string, b: string): { box: HTMLDivElement; a: HTMLButtonElement; b: HTMLButtonElement } => {
    const box = el('div', 'fc-seg');
    const ba = button(a, 'fc-seg__btn fc-is-on');
    const bb = button(b, 'fc-seg__btn');
    ba.setAttribute('aria-pressed', 'true'); bb.setAttribute('aria-pressed', 'false');
    box.append(ba, bb);
    return { box, a: ba, b: bb };
  };
  const basisSeg = seg(t.basisAdditional, t.basisTotal);
  basisSeg.box.setAttribute('role', 'group');
  basisSeg.box.setAttribute('aria-label', t.basis);
  const industryField = labelled(t.industry, industrySel);
  industryField.appendChild(industryNote);
  const fGrid = el('div', 'fc-pair');
  fGrid.append(
    unitField(t.leadRate, leadRate, '%'),
    unitField(t.closeRate, closeRate, '%', true),
    unitField(t.customerValue, custValue, curSym, true),
    unitField(t.margin, margin, '%', true),
  );
  const iGrid = el('div', 'fc-pair');
  iGrid.append(unitField(t.intents.informational, leadInfo, '%'), unitField(t.intents.commercial, leadComm, '%'), unitField(t.intents.transactional, leadTrans, '%'));
  const intentDet = el('details', 'fc-more');
  intentDet.append(el('summary', undefined, t.intentRates), el('p', 'fc-help', t.intentRatesHelp), iGrid);
  const invGrid = el('div', 'fc-pair');
  const investField = unitField(t.invest, invest, curSym, true);
  invGrid.append(investField, unitField(t.oneOff, oneOff, curSym));
  const basisField = el('div', 'fc-field');
  basisField.append(el('span', 'fc-label', t.basis), basisSeg.box);
  fPanel.body.append(industryField, fGrid, invGrid, basisField, intentDet);

  side.append(kwPanel.box, ctrPanel.box, fPanel.box);

  // ---------- right: results ----------
  const main = el('div', 'fc-main');
  const kpis = el('div', 'fc-kpis');
  const kpi = (mod: string): { box: HTMLDivElement; label: HTMLParagraphElement; value: HTMLParagraphElement; sub: HTMLParagraphElement } => {
    const box = el('div', 'fc-kpi ' + mod);
    const label = el('p', 'fc-kpi__label');
    const value = el('p', 'fc-kpi__value', '–');
    const sub = el('p', 'fc-kpi__sub');
    box.append(label, value, sub);
    return { box, label, value, sub };
  };
  const kTraffic = kpi('fc-kpi--traffic');
  const kRevenue = kpi('fc-kpi--revenue');
  const kProfit = kpi('fc-kpi--profit');
  const kRoi = kpi('fc-kpi--roi');
  kpis.append(kTraffic.box, kRevenue.box, kProfit.box, kRoi.box);
  const tickTraffic = new Ticker(kTraffic.value, (n) => t.nf0.format(n));
  const tickRevenue = new Ticker(kRevenue.value, (n) => t.cur.format(n));
  const tickProfit = new Ticker(kProfit.value, (n) => t.cur.format(n));
  const tickRoi = new Ticker(kRoi.value, (n) => t.pct(Math.round(n)));

  const chartBox = el('section', 'fc-console');
  const chartHead = el('div', 'fc-chart__head');
  const tabs = seg(t.tabMoney, t.tabClicks);
  tabs.box.classList.add('fc-seg--dark');
  tabs.box.setAttribute('role', 'group');
  const legend = el('div', 'fc-legend');
  chartHead.append(tabs.box, legend);
  const chart = new Chart(t.tabMoney);
  const chartFoot = el('p', 'fc-chart__foot');
  chartBox.append(chartHead, chart.root, chartFoot);

  const perfBox = el('section', 'fc-card');
  const perfBody = el('div');
  const funnelMsg = el('p', 'fc-note');
  perfBox.append(el('h3', 'fc-card__title', t.kpiTable), funnelMsg, perfBody);

  const kwResBox = el('section', 'fc-card');
  const kwResBody = el('div');
  const warnBox = el('div', 'fc-warnings');
  const messages = el('div', 'fc-messages');
  messages.setAttribute('role', 'status');
  messages.setAttribute('aria-live', 'polite');
  const actions = el('div', 'fc-tools');
  const exportBtn = button(t.exportClicks, 'fc-btn--ghost fc-btn--small');
  const exportFunnelBtn = button(t.exportFunnel, 'fc-btn--ghost fc-btn--small');
  actions.append(exportBtn, exportFunnelBtn);
  kwResBox.append(el('h3', 'fc-card__title', t.kwTable), kwResBody, warnBox, actions);

  main.append(messages, kpis, chartBox, perfBox, kwResBox);

  const cockpit = el('div', 'fc-cockpit');
  cockpit.append(side, main);

  const assumptions = el('details', 'fc-assumptions');
  assumptions.appendChild(el('summary', undefined, t.assumptions));
  const assBody = el('div', 'fc-assumptions__body');
  assumptions.appendChild(assBody);

  root.append(bar, cockpit, assumptions, el('p', 'fc-local', t.local));

  // ---------- keyword cards ----------
  const kwOut: Array<{ ctr: HTMLElement; clicks: HTMLElement; bar: HTMLElement }> = [];
  function markOwnInput(): void {
    if (!examplesActive) return;
    examplesActive = false;
    exampleNote.remove();
  }

  function renderRows(): void {
    kwList.textContent = '';
    kwOut.length = 0;
    kwCount.textContent = String(rows.length);
    rows.forEach((r, i) => {
      const card = el('div', 'fc-kw');
      const top = el('div', 'fc-kw__top');
      const name = el('input', 'fc-input fc-kw__name');
      name.type = 'text'; name.value = r.keyword; name.placeholder = t.kwName;
      name.setAttribute('aria-label', `${t.kwName} ${i + 1}`);
      name.addEventListener('input', () => { r.keyword = name.value.trim(); markOwnInput(); update(); });
      const del = button('×', 'fc-btn--icon');
      del.setAttribute('aria-label', `${t.remove}: ${r.keyword || i + 1}`);
      del.title = t.remove;
      del.addEventListener('click', () => { rows.splice(i, 1); markOwnInput(); renderRows(); update(); });
      top.append(name, del);

      const vol = numInput(Number.isFinite(r.volume) ? String(r.volume) : '');
      vol.addEventListener('input', () => { r.volume = vol.value === '' ? NaN : Number(vol.value); markOwnInput(); update(); });
      const cur = numInput(r.currentPosition === null ? '' : String(r.currentPosition), '1', '0.1');
      cur.placeholder = t.currentNone;
      cur.addEventListener('input', () => { r.currentPosition = cur.value.trim() === '' ? null : Number(cur.value); markOwnInput(); update(); });
      const nums = el('div', 'fc-pair');
      nums.append(labelled(t.volume, vol), labelled(t.current, cur));

      const rank = rangeInput(1, 20, Math.min(20, Math.max(1, Math.round(r.targetPosition))));
      const badge = el('output', 'fc-badge', `#${rank.value}`);
      const rankBox = el('div', 'fc-slider');
      rankBox.append(rank, badge);
      rank.addEventListener('input', () => { r.targetPosition = Number(rank.value); badge.textContent = `#${rank.value}`; markOwnInput(); update(); });
      const rankField = labelled(t.target, rankBox, rank);

      const chips = el('div', 'fc-kw__chips');
      const intent = el('select', 'fc-input fc-input--chip');
      for (const [v, l] of Object.entries(t.intents)) { const o = el('option', undefined, l); o.value = v; intent.appendChild(o); }
      intent.value = r.intent || '';
      intent.setAttribute('aria-label', `${t.intent} ${i + 1}`);
      intent.addEventListener('change', () => { r.intent = (intent.value || null) as Intent | null; markOwnInput(); update(); });
      const aio = el('select', 'fc-input fc-input--chip');
      for (const [v, l] of Object.entries(t.aioSel)) { const o = el('option', undefined, l); o.value = v; aio.appendChild(o); }
      aio.value = !r.aio ? '' : (r.aioCitation || 'yes');
      aio.setAttribute('aria-label', `${t.aio} ${i + 1}`);
      aio.addEventListener('change', () => {
        r.aio = aio.value !== '';
        r.aioCitation = aio.value === 'cited' || aio.value === 'not-cited' ? (aio.value as AioCitation) : null;
        markOwnInput(); update();
      });
      const brandLbl = el('label', 'fc-toggle');
      const brand = el('input'); brand.type = 'checkbox'; brand.checked = !!r.brand;
      brand.addEventListener('change', () => { r.brand = brand.checked; markOwnInput(); update(); });
      brandLbl.append(brand, el('span', undefined, t.brand));
      chips.append(intent, aio, brandLbl);

      const out = el('div', 'fc-kw__out');
      const ctrOut = el('span', 'fc-kw__ctr', '–');
      const clickOut = el('span', 'fc-kw__clicks');
      const meter = el('span', 'fc-meter');
      const meterBar = el('span', 'fc-meter__bar');
      meter.appendChild(meterBar);
      const line = el('div', 'fc-kw__outline');
      line.append(el('span', 'fc-kw__outlabel', t.expected), ctrOut);
      out.append(line, meter, clickOut);
      kwOut.push({ ctr: ctrOut, clicks: clickOut, bar: meterBar });

      card.append(top, nums, rankField, chips, out);
      kwList.appendChild(card);
    });
  }

  // ---------- presets ----------
  function renderPresetOptions(): void {
    const selected = curveSel.value;
    curveSel.textContent = '';
    for (const p of [...presets, ...(own ? [own] : [])]) { const o = el('option', undefined, p.label); o.value = p.id; curveSel.appendChild(o); }
    curveSel.value = selected && [...curveSel.options].some((o) => o.value === selected) ? selected : presets[0].id;
  }
  const currentPreset = (): Preset => (own && curveSel.value === own.id ? own : presets.find((p) => p.id === curveSel.value) || presets[0]);

  function showMessages(list: string[]): void {
    messages.textContent = '';
    if (!list.length) return;
    const box = el('div', 'fc-msg');
    box.appendChild(el('p', 'fc-label', t.errors));
    const ul = el('ul');
    list.forEach((m) => ul.appendChild(el('li', undefined, m)));
    box.appendChild(ul);
    messages.appendChild(box);
  }

  // ---------- funnel settings ----------
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
      leadRateByIntent: byIntent, monthlyInvestment: num(invest), oneOffInvestment: num(oneOff), basis,
    };
  }

  // ---------- results ----------
  function renderAll(result: ForecastResult): void {
    const maxClicks = Math.max(1, ...result.keywords.map((k) => k.targetClicks));
    result.keywords.forEach((k, i) => {
      const o = kwOut[i];
      if (!o) return;
      o.ctr.textContent = t.pct(Math.round(k.targetCtr * 100) / 100);
      o.clicks.textContent = `${t.nf0.format(k.currentClicks)} → ${t.nf0.format(k.targetClicks)} ${t.perMonth}`;
      o.bar.style.transform = `scaleX(${(k.targetClicks / maxClicks).toFixed(3)})`;
    });

    const fs = funnelSettings();
    const valid = fs ? validateFunnel(fs).length === 0 : false;
    const f = fs && valid ? funnel(result, fs) : null;
    lastFunnel = f;
    exportFunnelBtn.disabled = !f;
    const n = result.totals.monthly.length;
    const hasInv = !!f && f.totals.investment > 0;

    // key figures
    const atTargetClicks = result.keywords.reduce((s, k) => s + (basis === 'additional' ? Math.max(0, k.targetClicks - k.currentClicks) : k.targetClicks), 0);
    kTraffic.label.textContent = t.kpiTraffic(basis);
    kTraffic.sub.textContent = t.kpiTrafficSub;
    tickTraffic.set(atTargetClicks);
    kRevenue.label.textContent = t.kpiRevenue;
    kRevenue.sub.textContent = t.kpiRevenueSub;
    tickRevenue.set(f ? f.atTarget.revenue : null);
    kProfit.label.textContent = hasInv ? t.kpiNet : t.kpiGross;
    kProfit.sub.textContent = t.kpiNetSub;
    tickProfit.set(f ? (hasInv ? f.atTarget.netProfit : f.atTarget.grossProfit) : null);
    kProfit.box.classList.toggle('fc-is-negative', !!f && hasInv && f.atTarget.netProfit < 0);
    kRoi.label.textContent = t.kpiRoi;
    if (f && hasInv && f.totals.roi !== null) {
      tickRoi.set(f.totals.roi);
      kRoi.sub.textContent = `${t.kpiRoiSub(n)} · ${t.perEuro(t.cur2.format(f.totals.returnPerEuro ?? 0))}`;
      kRoi.box.classList.toggle('fc-is-negative', f.totals.roi < 0);
    } else {
      tickRoi.set(null);
      kRoi.sub.textContent = t.kpiRoiNone;
      kRoi.box.classList.remove('fc-is-negative');
    }

    // chart
    const monthLabel = (i: number) => `${t.monthShort}${i + 1}`;
    legend.textContent = '';
    const leg = (cls: string, text: string) => legend.appendChild(el('span', 'fc-legend__item ' + cls, text));
    if (chartMode === 'money' && f) {
      const series: ChartSeries[] = [{ name: t.legendGross, values: f.months.map((m) => m.cumulativeGrossProfit), kind: 'area' }];
      if (hasInv) series.push({ name: t.legendInvest, values: f.months.map((m) => m.cumulativeInvestment), kind: 'dashed' });
      leg('fc-is-main', t.legendGross);
      if (hasInv) leg('fc-is-dashed', t.legendInvest);
      chart.setLabel(t.tabMoney);
      chart.draw(series, (v) => t.cur.format(v), monthLabel);
      chartFoot.textContent = hasInv ? t.breakEven(f.totals.breakEvenMonth, n) : '';
      chartFoot.classList.toggle('fc-is-good', hasInv && f.totals.breakEvenMonth !== null);
    } else {
      const series: ChartSeries[] = [
        { name: t.legendClicks, values: result.totals.monthly, kind: 'area' },
        { name: t.legendToday, values: result.totals.monthly.map(() => result.totals.currentClicks), kind: 'dashed' },
      ];
      leg('fc-is-main', t.legendClicks);
      leg('fc-is-dashed', t.legendToday);
      chart.setLabel(t.tabClicks);
      chart.draw(series, (v) => t.nf0.format(v), monthLabel);
      chartFoot.textContent = chartMode === 'money' ? t.funnelMissing : '';
      chartFoot.classList.remove('fc-is-good');
    }

    // performance table
    perfBody.textContent = '';
    funnelMsg.textContent = !fs ? t.funnelMissing : !valid ? t.funnelInvalid : '';
    const cumClicks = f ? f.totals.clicks : result.totals.monthly.reduce((s, v) => s + (basis === 'additional' ? Math.max(0, v - result.totals.currentClicks) : v), 0);
    const rowsKpi: string[][] = [[t.rowClicks, t.nf0.format(atTargetClicks), t.nf0.format(cumClicks)]];
    if (f) {
      rowsKpi.push(
        [t.rowLeads, t.nf.format(f.atTarget.leads), t.nf.format(f.totals.leads)],
        [t.rowCustomers, t.nf.format(f.atTarget.customers), t.nf.format(f.totals.customers)],
        [t.rowRevenue, t.cur.format(f.atTarget.revenue), t.cur.format(f.totals.revenue)],
        [t.rowGross, t.cur.format(f.atTarget.grossProfit), t.cur.format(f.totals.grossProfit)],
      );
      if (hasInv) {
        rowsKpi.push([t.rowInvest, t.cur.format(fs?.monthlyInvestment || 0), t.cur.format(f.totals.investment)]);
        rowsKpi.push([t.rowNet, t.cur.format(f.atTarget.netProfit), t.cur.format(f.totals.netProfit)]);
      }
    }
    const perfTable = table(['', t.colPerMonth, t.colCumulative(n)], rowsKpi, 'fc-table fc-table--kpi');
    if (f) perfTable.querySelector('tbody tr:last-child')?.classList.add('fc-is-total');
    perfBody.appendChild(perfTable);
    if (f) {
      const det = el('details', 'fc-more');
      det.appendChild(el('summary', undefined, t.monthly));
      det.appendChild(table(
        [t.month, t.rowClicks, t.rowLeads, t.rowCustomers, t.rowRevenue, t.rowGross, ...(hasInv ? [t.colCumNet, t.colRoi] : [])],
        f.months.map((m) => [String(m.month), t.nf0.format(m.clicks), t.nf.format(m.leads), t.nf2.format(m.customers), t.cur.format(m.revenue), t.cur.format(m.grossProfit),
          ...(hasInv ? [t.cur.format(m.cumulativeNetProfit), m.cumulativeRoi === null ? '–' : t.pct(Math.round(m.cumulativeRoi))] : [])]),
        'fc-table fc-table--num',
      ));
      perfBody.appendChild(det);
    }

    // per keyword
    kwResBody.textContent = '';
    kwResBody.appendChild(table(
      [t.colKw, t.colPos, t.colCtr, t.colClicks],
      result.keywords.map((k) => [
        k.keyword + (k.aio ? ` · ${t.aioSel[k.aioCitation || 'yes']}` : ''),
        `${k.currentPosition === null ? '–' : t.nf.format(k.currentPosition)} → ${t.nf.format(k.targetPosition)}`,
        `${t.pct(Math.round(k.currentCtr * 100) / 100)} → ${t.pct(Math.round(k.targetCtr * 100) / 100)}`,
        `${t.nf.format(k.currentClicks)} → ${t.nf.format(k.targetClicks)}`,
      ]),
      'fc-table fc-table--num',
    ));
    warnBox.textContent = '';
    const warns = result.keywords.flatMap((k) => k.warnings.map((w) => `${k.keyword}: ${
      w.type === 'beyond-data' ? t.warnBeyond(w.which, Math.round(w.position)) : w.type === 'no-aio-reduction' ? t.warnNoAio(w.position) : w.message}`));
    const uf = result.settings.userCtrFactor ?? 100;
    if (uf !== 100) warns.unshift(t.userFactorNote(t.pct(uf)));
    if (warns.length) {
      warnBox.appendChild(el('p', 'fc-label', t.notes));
      const ul = el('ul');
      warns.forEach((w) => ul.appendChild(el('li', undefined, w)));
      warnBox.appendChild(ul);
    }
  }

  // ---------- assumptions ----------
  const link = (text: string, href: string): HTMLAnchorElement => { const a = el('a', undefined, text); a.href = href; a.target = '_blank'; a.rel = 'noopener'; return a; };
  const method = (key: string): string => { const s = file.sources[key]; return s ? ((lang === 'de' && s.method_de) || s.method) : ''; };

  function renderAssumptions(preset: Preset): void {
    assBody.textContent = '';
    assBody.append(el('p', undefined, t.formula), el('p', undefined, t.formulaFunnel));
    const first = preset.curves[0];
    const s = first.source ? file.sources[first.source] : null;
    const p = el('p');
    if (s && first.source) {
      p.append(document.createTextNode(`${t.curve}: ${preset.label}. ${t.source}: `), link(`${s.publisher}, ${s.title}`, s.url),
        document.createTextNode(` (${s.market}, ${s.data_period}). ${method(first.source)}`));
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
      if (r && first.aio.source) ap.append(document.createTextNode(' '), link(r.title, r.url), document.createTextNode(`. ${method(first.aio.source)}`));
      assBody.appendChild(ap);
    } else {
      assBody.appendChild(el('p', undefined, first.aio.type === 'curve' ? t.aioCurve : t.aioNone));
    }
    if (file.aio_citation && first.aio.type !== 'none') {
      const c = file.aio_citation;
      const cp = el('p');
      cp.append(document.createTextNode(t.citation(c.label[lang]) + ' '), link(c.source_ref.name, c.source_ref.url), document.createTextNode(`. ${method(c.source)}`));
      assBody.appendChild(cp);
    }
    const lr = file.industry_lead_rates;
    if (lr) {
      const lp = el('p');
      lp.append(document.createTextNode(`${t.industry}: ${industrySel.selectedOptions[0]?.textContent || ''}. ${lr.note[lang]} ${t.source}: `), link(lr.source_ref.name, lr.source_ref.url), document.createTextNode(`. ${method(lr.source)}`));
      assBody.appendChild(lp);
    }
    assBody.appendChild(el('p', undefined, t.examplesNote));
    const uf = Number(userFactor.value);
    if (uf !== 100) assBody.appendChild(el('p', 'fc-msg', t.userFactorNote(t.pct(uf))));

    const maxP = Math.max(10, ...preset.curves.map((c) => maxPosition(c.ctr)));
    const short = (c: Curve) => c.shortLabel || c.label;
    const headers = [t.position, ...preset.curves.flatMap((c) => (preset.curves.length > 1 ? [short(c), `${short(c)} ${t.ctrAioShort}`] : ['CTR', `CTR ${t.ctrAioShort}`]))];
    const rowsA: string[][] = [];
    for (let pos = 1; pos <= maxP; pos++) {
      rowsA.push([String(pos), ...preset.curves.flatMap((c) => {
        const b = ctrFor(c, pos, false), a = ctrFor(c, pos, true);
        return [b === null ? t.noData : t.pct(b), a === null ? t.noData : t.pct(Math.round(a * 100) / 100)];
      })]);
    }
    assBody.appendChild(table(headers, rowsA, 'fc-table fc-table--num fc-table--compact'));
    const ul = el('ul', 'fc-caveats');
    file.caveats[lang].forEach((c) => ul.appendChild(el('li', undefined, c)));
    ul.appendChild(el('li', undefined, t.notTaken));
    assBody.appendChild(ul);
  }

  // ---------- update ----------
  function update(): void {
    monthsCtl.out.textContent = `${months.value} ${t.monthsUnit}`;
    rampCtl.out.textContent = `${ramp.value} ${t.monthsUnit}`;
    ufOut.textContent = t.pct(Number(userFactor.value));
    ufOut.classList.toggle('fc-is-changed', userFactor.value !== '100');
    const preset = currentPreset();
    presetNote.textContent = own && preset === own ? ownInfo : (preset.type === 'brand' ? t.presetBrand : preset.type === 'query-length' ? t.presetLength : '');
    renderAssumptions(preset);
    last = null;
    exportBtn.disabled = true;
    if (!rows.length) { showMessages([t.noKeywords]); return; }
    const invalid = rows.filter((r) => !Number.isFinite(r.volume) || r.volume < 0 || !Number.isFinite(r.targetPosition) || r.targetPosition < 1
      || (r.currentPosition !== null && (!Number.isFinite(r.currentPosition) || r.currentPosition < 1)));
    if (invalid.length) { showMessages(invalid.map((r) => t.invalid(r.keyword))); return; }
    try {
      const cf = file.aio_citation ? { cited: file.aio_citation.cited, notCited: file.aio_citation.not_cited } : undefined;
      const named = rows.map((r, i) => ({ ...r, keyword: r.keyword || `${t.kwName} ${i + 1}` }));
      last = forecast(preset.choice, named, {
        rampMonths: Number(ramp.value), horizonMonths: Number(months.value),
        citationFactors: cf, userCtrFactor: Number(userFactor.value),
      });
      exportBtn.disabled = false;
      showMessages([]);
      renderAll(last);
    } catch (e) {
      showMessages([(e as Error).message]);
    }
  }

  // ---------- events ----------
  for (const i of [months, ramp, userFactor]) i.addEventListener('input', update);
  for (const i of [leadRate, closeRate, custValue, margin, invest, oneOff, leadInfo, leadComm, leadTrans]) i.addEventListener('input', update);
  curveSel.addEventListener('change', update);
  const setSeg = (s: { a: HTMLButtonElement; b: HTMLButtonElement }, first: boolean) => {
    s.a.classList.toggle('fc-is-on', first); s.b.classList.toggle('fc-is-on', !first);
    s.a.setAttribute('aria-pressed', String(first)); s.b.setAttribute('aria-pressed', String(!first));
  };
  basisSeg.a.addEventListener('click', () => { basis = 'additional'; setSeg(basisSeg, true); update(); });
  basisSeg.b.addEventListener('click', () => { basis = 'total'; setSeg(basisSeg, false); update(); });
  tabs.a.addEventListener('click', () => { chartMode = 'money'; setSeg(tabs, true); if (last) renderAll(last); });
  tabs.b.addEventListener('click', () => { chartMode = 'clicks'; setSeg(tabs, false); if (last) renderAll(last); });
  industrySel.addEventListener('change', () => {
    const lr = file.industry_lead_rates;
    const v = industrySel.value;
    if (lr && v) {
      const rate = v === 'average' ? lr.average : lr.industries.find((x) => x.id === v)?.lead_rate;
      if (typeof rate === 'number') leadRate.value = String(rate);
    }
    update();
  });
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => chart.redraw(), 120); };
  window.addEventListener('resize', onResize);
  addBtn.addEventListener('click', () => {
    rows.push({ keyword: '', volume: 0, currentPosition: null, targetPosition: 3, aio: false, brand: false, intent: null });
    markOwnInput();
    renderRows();
    update();
    kwList.querySelector<HTMLInputElement>('.fc-kw:last-child .fc-kw__name')?.focus();
  });
  kwImport.addEventListener('click', () => kwFile.click());
  kwFile.addEventListener('change', async () => {
    const { keywords, errors } = keywordsFromCsv(await readFile(kwFile));
    kwFile.value = '';
    if (keywords.length) { rows.splice(0, rows.length, ...keywords); markOwnInput(); renderRows(); update(); }
    if (errors.length) showMessages(errors);
  });
  gscImport.addEventListener('click', () => gscFile.click());
  gscFile.addEventListener('change', async () => {
    const { rows: gsc, errors } = searchConsoleFromCsv(await readFile(gscFile));
    gscFile.value = '';
    if (errors.length) { showMessages(errors); return; }
    const { ctr } = curveFromSearchConsole(gsc);
    if (!Object.keys(ctr).length) { showMessages([t.gscInfo(0)]); return; }
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
      renderPresetOptions();
      const lr = file.industry_lead_rates;
      const addOpt = (v: string, l: string) => { const o = el('option', undefined, l); o.value = v; industrySel.appendChild(o); };
      if (lr) {
        addOpt('', t.industryNone);
        lr.industries.slice().sort((a, b) => a.label[lang].localeCompare(b.label[lang], lang)).forEach((x) => addOpt(x.id, `${x.label[lang]} · ${t.pct(x.lead_rate)}`));
        addOpt('average', t.industryAvg(t.pct(lr.average)));
        industrySel.value = 'average';
        leadRate.value = String(lr.average);
        industryNote.textContent = t.industryShort(lr.source_ref.year);
      } else {
        industryField.remove();
      }
      renderRows();
      update();
    })
    .catch(() => { root.textContent = t.loadFailed; });

  return {
    destroy() {
      window.removeEventListener('resize', onResize);
      clearTimeout(resizeTimer);
      for (const tk of [tickTraffic, tickRevenue, tickProfit, tickRoi]) tk.stop();
      root.textContent = '';
      root.classList.remove('fc');
    },
  };
}

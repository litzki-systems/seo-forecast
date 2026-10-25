/**
 * seo-forecast · browser UI
 * Mounts into <div id="seo-forecast">. No inline scripts, no storage, no network
 * besides loading the curve data file. Language from data-lang or <html lang>.
 * Optional data-src: URL of ctr-curves.json (default: data/ctr-curves.json).
 * MIT License.
 */
import { forecast, ctrFor, maxPosition, curveFromSearchConsole, type Curve, type Keyword, type ForecastResult } from './forecast.js';
import { keywordsFromCsv, searchConsoleFromCsv, resultToCsv } from './csv.js';
import { curvesFromFile, type CurveFile, type Lang } from './data.js';

const T = {
  de: {
    loadFailed: 'Die CTR-Daten konnten nicht geladen werden. Bitte laden Sie die Seite neu.',
    setup: 'Grundlage',
    curve: 'CTR-Kurve',
    ownCurve: 'Eigene Kurve aus der Search Console',
    ramp: 'Monate bis zur Zielposition',
    horizon: 'Prognosezeitraum (Monate)',
    keywords: 'Keywords',
    keywordsHelp: 'Suchvolumen aus Ihrem Keyword-Tool oder der Search Console. Der Rechner schätzt kein Suchvolumen. Aktuelle Position leer lassen, wenn die Seite nicht rankt.',
    colKeyword: 'Keyword', colVolume: 'Suchvolumen / Monat', colCurrent: 'Aktuelle Position', colTarget: 'Zielposition', colAio: 'AI Overview',
    remove: 'Entfernen', addRow: 'Zeile hinzufügen',
    importKeywords: 'Keywords aus CSV laden', importGsc: 'Search-Console-Export als eigene Kurve laden', template: 'CSV-Vorlage',
    example: 'Beispiel',
    result: 'Ergebnis',
    today: 'Klicks pro Monat heute', target: 'Klicks pro Monat bei Zielposition', extra: (n: number) => `Zusätzliche Klicks in ${n} Monaten`,
    chartTitle: 'Organische Klicks pro Monat (Summe aller Keywords)', month: 'Monat',
    colCtrNow: 'CTR heute', colCtrTarget: 'CTR Ziel', colClicksNow: 'Klicks heute', colClicksTarget: 'Klicks Ziel',
    exportCsv: 'Ergebnis als CSV',
    assumptions: 'Annahmen',
    formula: 'Klicks pro Monat = Suchvolumen × CTR der Position × AI-Overview-Faktor. Zwischen heute und dem Erreichen der Zielposition steigen die Klicks linear.',
    source: 'Quelle', position: 'Position', ctrBase: 'CTR', ctrAio: 'CTR mit AI Overview',
    aioReduction: (s: string) => `Mit AI Overview wird die CTR um den veröffentlichten Abschlag je Position gesenkt (${s}).`,
    aioCurve: 'Mit AI Overview gilt die eigene CTR-Spalte derselben Quelle.',
    aioNone: 'Für die eigene Kurve ist kein AI-Overview-Abschlag hinterlegt. Ihre Search-Console-Daten enthalten den Effekt bereits.',
    noData: 'keine Daten, zählt als 0',
    gscInfo: (n: number) => `Eigene Kurve aus ${n} Zeilen Ihres Search-Console-Exports. Positionen mit weniger als 100 Impressionen sind ausgelassen.`,
    warnings: 'Hinweise',
    warnBeyond: (which: string, p: number) => `Für die ${which === 'current' ? 'aktuelle Position' : 'Zielposition'} ${p} enthält diese Kurve keine Daten; sie zählt als 0 Klicks.`,
    warnNoAio: (p: number) => `Für Position ${p} ist kein AI-Overview-Abschlag veröffentlicht; es gilt die CTR ohne AI Overview.`,
    invalid: (kw: string) => `${kw || '(ohne Keyword)'}: Bitte Suchvolumen (≥ 0), Zielposition (≥ 1) und, falls die Seite rankt, die aktuelle Position (≥ 1) eintragen.`,
    errors: 'Bitte prüfen',
    noKeywords: 'Tragen Sie mindestens ein Keyword ein.',
    local: 'Alle Eingaben bleiben in Ihrem Browser. Nichts wird gespeichert oder übertragen.',
    nf: new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }),
    nf0: new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }),
    pct: (n: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(n) + ' %',
  },
  en: {
    loadFailed: 'The CTR data could not be loaded. Please reload the page.',
    setup: 'Basis',
    curve: 'CTR curve',
    ownCurve: 'Your own curve from Search Console',
    ramp: 'Months until the target position',
    horizon: 'Forecast period (months)',
    keywords: 'Keywords',
    keywordsHelp: 'Search volume from your keyword tool or Search Console. The calculator does not estimate search volume. Leave the current position empty if the page does not rank.',
    colKeyword: 'Keyword', colVolume: 'Search volume / month', colCurrent: 'Current position', colTarget: 'Target position', colAio: 'AI Overview',
    remove: 'Remove', addRow: 'Add row',
    importKeywords: 'Load keywords from CSV', importGsc: 'Load Search Console export as your own curve', template: 'CSV template',
    example: 'Example',
    result: 'Result',
    today: 'Clicks per month today', target: 'Clicks per month at target position', extra: (n: number) => `Additional clicks over ${n} months`,
    chartTitle: 'Organic clicks per month (all keywords)', month: 'Month',
    colCtrNow: 'CTR today', colCtrTarget: 'CTR target', colClicksNow: 'Clicks today', colClicksTarget: 'Clicks target',
    exportCsv: 'Result as CSV',
    assumptions: 'Assumptions',
    formula: 'Clicks per month = search volume × CTR of the position × AI Overview factor. Between today and reaching the target position, clicks rise linearly.',
    source: 'Source', position: 'Position', ctrBase: 'CTR', ctrAio: 'CTR with AI Overview',
    aioReduction: (s: string) => `With an AI Overview, CTR is lowered by the published reduction per position (${s}).`,
    aioCurve: 'With an AI Overview, the separate CTR column of the same source applies.',
    aioNone: 'No AI Overview reduction is applied to your own curve. Your Search Console data already contains the effect.',
    noData: 'no data, counts as 0',
    gscInfo: (n: number) => `Your own curve from ${n} rows of your Search Console export. Positions with fewer than 100 impressions are left out.`,
    warnings: 'Notes',
    warnBeyond: (which: string, p: number) => `This curve has no data for the ${which === 'current' ? 'current' : 'target'} position ${p}, so it counts as 0 clicks.`,
    warnNoAio: (p: number) => `No published AI Overview reduction for position ${p}; the CTR without AI Overview is used.`,
    invalid: (kw: string) => `${kw || '(no keyword)'}: please enter search volume (≥ 0), target position (≥ 1) and, if it ranks, a current position (≥ 1).`,
    errors: 'Please check',
    noKeywords: 'Enter at least one keyword.',
    local: 'All input stays in your browser. Nothing is stored or transmitted.',
    nf: new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }),
    nf0: new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }),
    pct: (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n) + '%',
  },
};

type Strings = typeof T.de;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
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
  if (!f) return Promise.resolve('');
  return f.text();
}

export function mount(root: HTMLElement): void {
  const lang: Lang = ((root.dataset.lang || document.documentElement.lang || 'de').slice(0, 2).toLowerCase() === 'en') ? 'en' : 'de';
  const t: Strings = T[lang] as Strings;
  const src = root.dataset.src || 'data/ctr-curves.json';

  let file: CurveFile;
  let curves: Curve[] = [];
  let ownCurve: Curve | null = null;
  let ownInfo = '';
  const rows: Keyword[] = lang === 'de'
    ? [
        { keyword: `${t.example}: briefing erstellen`, volume: 1300, currentPosition: null, targetPosition: 3, aio: true },
        { keyword: `${t.example}: content briefing vorlage`, volume: 390, currentPosition: 8, targetPosition: 2, aio: false },
      ]
    : [
        { keyword: `${t.example}: how to write a brief`, volume: 1900, currentPosition: null, targetPosition: 3, aio: true },
        { keyword: `${t.example}: content brief template`, volume: 720, currentPosition: 8, targetPosition: 2, aio: false },
      ];
  let last: ForecastResult | null = null;

  // ---------- layout ----------
  root.textContent = '';
  root.classList.add('sf');

  const setup = el('section', 'sf-card');
  setup.appendChild(el('h2', 'sf-h', t.setup));
  const grid = el('div', 'sf-grid');
  const curveSel = el('select', 'sf-input');
  curveSel.id = 'sf-curve';
  const ramp = el('input', 'sf-input');
  ramp.type = 'number'; ramp.min = '1'; ramp.max = '36'; ramp.value = '6'; ramp.id = 'sf-ramp';
  const horizon = el('input', 'sf-input');
  horizon.type = 'number'; horizon.min = '1'; horizon.max = '36'; horizon.value = '12'; horizon.id = 'sf-horizon';
  for (const [id, label, input] of [['sf-curve', t.curve, curveSel], ['sf-ramp', t.ramp, ramp], ['sf-horizon', t.horizon, horizon]] as const) {
    const f = el('div', 'sf-field');
    const l = el('label', 'sf-label', label);
    l.htmlFor = id;
    f.append(l, input);
    grid.appendChild(f);
  }
  setup.appendChild(grid);
  const ownNote = el('p', 'sf-note');
  setup.appendChild(ownNote);

  const kwCard = el('section', 'sf-card');
  kwCard.appendChild(el('h2', 'sf-h', t.keywords));
  kwCard.appendChild(el('p', 'sf-note', t.keywordsHelp));
  const tableWrap = el('div', 'sf-table-wrap');
  const kwTable = el('table', 'sf-table sf-table--input');
  tableWrap.appendChild(kwTable);
  kwCard.appendChild(tableWrap);
  const kwActions = el('div', 'sf-actions');
  const addBtn = el('button', 'sf-btn sf-btn--outline', t.addRow);
  addBtn.type = 'button';
  const kwFile = el('input');
  kwFile.type = 'file'; kwFile.accept = '.csv,text/csv,text/plain'; kwFile.hidden = true;
  const kwImport = el('button', 'sf-btn sf-btn--outline', t.importKeywords);
  kwImport.type = 'button';
  const gscFile = el('input');
  gscFile.type = 'file'; gscFile.accept = '.csv,text/csv,text/plain'; gscFile.hidden = true;
  const gscImport = el('button', 'sf-btn sf-btn--outline', t.importGsc);
  gscImport.type = 'button';
  const templateBtn = el('button', 'sf-btn sf-btn--secondary', t.template);
  templateBtn.type = 'button';
  kwActions.append(addBtn, kwImport, kwFile, gscImport, gscFile, templateBtn);
  kwCard.appendChild(kwActions);
  const messages = el('div', 'sf-messages');
  messages.setAttribute('role', 'status');
  messages.setAttribute('aria-live', 'polite');
  kwCard.appendChild(messages);

  const resCard = el('section', 'sf-card');
  resCard.appendChild(el('h2', 'sf-h', t.result));
  const kpis = el('div', 'sf-kpis');
  const chart = el('div', 'sf-chart');
  const resWrap = el('div', 'sf-table-wrap');
  const resTable = el('table', 'sf-table');
  resWrap.appendChild(resTable);
  const warnBox = el('div', 'sf-warnings');
  const exportBtn = el('button', 'sf-btn sf-btn--primary', t.exportCsv);
  exportBtn.type = 'button';
  const resActions = el('div', 'sf-actions');
  resActions.appendChild(exportBtn);
  resCard.append(kpis, chart, resWrap, warnBox, resActions);

  const assCard = el('section', 'sf-card');
  assCard.appendChild(el('h2', 'sf-h', t.assumptions));
  const assBody = el('div', 'sf-assumptions');
  assCard.appendChild(assBody);

  const local = el('p', 'sf-note sf-local', t.local);
  root.append(setup, kwCard, resCard, assCard, local);

  // ---------- keyword table ----------
  function numOrNull(v: string): number | null {
    if (v.trim() === '') return null;
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }

  function renderRows(): void {
    kwTable.textContent = '';
    const head = el('thead');
    const hr = el('tr');
    for (const h of [t.colKeyword, t.colVolume, t.colCurrent, t.colTarget, t.colAio, '']) hr.appendChild(el('th', undefined, h));
    head.appendChild(hr);
    kwTable.appendChild(head);
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
      const kw = el('input', 'sf-input'); kw.type = 'text'; kw.value = r.keyword;
      kw.addEventListener('input', () => { r.keyword = kw.value.trim(); update(); });
      const vol = el('input', 'sf-input sf-input--num'); vol.type = 'number'; vol.min = '0'; vol.value = String(r.volume);
      vol.addEventListener('input', () => { r.volume = vol.value === '' ? NaN : Number(vol.value); update(); });
      const cur = el('input', 'sf-input sf-input--num'); cur.type = 'number'; cur.min = '1'; cur.step = '0.1'; cur.value = r.currentPosition === null ? '' : String(r.currentPosition);
      cur.addEventListener('input', () => { r.currentPosition = numOrNull(cur.value); update(); });
      const tgt = el('input', 'sf-input sf-input--num'); tgt.type = 'number'; tgt.min = '1'; tgt.step = '1'; tgt.value = String(r.targetPosition);
      tgt.addEventListener('input', () => { r.targetPosition = tgt.value === '' ? NaN : Number(tgt.value); update(); });
      const aio = el('input'); aio.type = 'checkbox'; aio.checked = r.aio;
      aio.addEventListener('change', () => { r.aio = aio.checked; update(); });
      const del = el('button', 'sf-btn sf-btn--secondary sf-btn--small', t.remove); del.type = 'button';
      del.addEventListener('click', () => { rows.splice(i, 1); renderRows(); update(); });
      cell(kw, t.colKeyword); cell(vol, t.colVolume); cell(cur, t.colCurrent); cell(tgt, t.colTarget); cell(aio, t.colAio);
      const td = el('td'); td.appendChild(del); tr.appendChild(td);
      body.appendChild(tr);
    });
    kwTable.appendChild(body);
  }

  // ---------- curves ----------
  function renderCurveOptions(): void {
    const selected = curveSel.value;
    curveSel.textContent = '';
    for (const c of curves) {
      const o = el('option', undefined, c.label); o.value = c.id; curveSel.appendChild(o);
    }
    if (ownCurve) {
      const o = el('option', undefined, t.ownCurve); o.value = ownCurve.id; curveSel.appendChild(o);
    }
    curveSel.value = selected && [...curveSel.options].some((o) => o.value === selected) ? selected : curves[0].id;
  }

  function currentCurve(): Curve {
    if (ownCurve && curveSel.value === ownCurve.id) return ownCurve;
    return curves.find((c) => c.id === curveSel.value) || curves[0];
  }

  // ---------- output ----------
  function showMessages(list: string[], cls: string, title: string): void {
    messages.textContent = '';
    if (!list.length) return;
    const box = el('div', cls);
    box.appendChild(el('p', 'sf-label', title));
    const ul = el('ul');
    for (const m of list) ul.appendChild(el('li', undefined, m));
    box.appendChild(ul);
    messages.appendChild(box);
  }

  function renderChart(result: ForecastResult): void {
    chart.textContent = '';
    const values = result.totals.monthly;
    // Draw at the real container width so the 14px axis labels stay 14px on phones.
    const W = Math.max(300, Math.min(960, Math.round(chart.clientWidth || resCard.clientWidth || 720)));
    const H = W < 500 ? 220 : 280, L = 56, R = 16, TOP = 20, B = 36;
    const max = Math.max(1, ...values, result.totals.currentClicks);
    const x = (i: number) => L + (values.length === 1 ? 0 : (i * (W - L - R)) / (values.length - 1));
    const y = (v: number) => TOP + (1 - v / max) * (H - TOP - B);
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('class', 'sf-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t.chartTitle);
    const add = (tag: string, attrs: Record<string, string | number>, text?: string) => {
      const n = document.createElementNS(ns, tag);
      for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
      if (text !== undefined) n.textContent = text;
      svg.appendChild(n);
      return n;
    };
    for (let g = 0; g <= 4; g++) {
      const v = (max * g) / 4;
      add('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'sf-grid-line' });
      add('text', { x: L - 8, y: y(v) + 5, 'text-anchor': 'end', class: 'sf-axis' }, t.nf0.format(v));
    }
    values.forEach((_, i) => {
      const step = W < 500 ? Math.ceil(values.length / 6) : (values.length <= 12 ? 1 : 3);
      if (i === 0 || (i + 1) % step === 0) add('text', { x: x(i), y: H - 10, 'text-anchor': 'middle', class: 'sf-axis' }, String(i + 1));
    });
    add('line', { x1: L, x2: W - R, y1: y(result.totals.currentClicks), y2: y(result.totals.currentClicks), class: 'sf-baseline' });
    add('polyline', { points: values.map((v, i) => `${x(i)},${y(v)}`).join(' '), class: 'sf-line' });
    values.forEach((v, i) => add('circle', { cx: x(i), cy: y(v), r: 4, class: 'sf-dot' }));
    chart.appendChild(el('p', 'sf-label', t.chartTitle));
    chart.appendChild(svg);
  }

  function renderResult(result: ForecastResult): void {
    kpis.textContent = '';
    for (const [label, value] of [
      [t.today, result.totals.currentClicks],
      [t.target, result.totals.targetClicks],
      [t.extra(result.settings.horizonMonths), result.totals.additionalClicksOverHorizon],
    ] as const) {
      const k = el('div', 'sf-kpi');
      k.append(el('p', 'sf-kpi__value', t.nf0.format(value)), el('p', 'sf-kpi__label', label));
      kpis.appendChild(k);
    }
    renderChart(result);

    resTable.textContent = '';
    const head = el('thead');
    const hr = el('tr');
    for (const h of [t.colKeyword, t.colVolume, t.colCurrent, t.colTarget, t.colCtrNow, t.colCtrTarget, t.colClicksNow, t.colClicksTarget]) hr.appendChild(el('th', undefined, h));
    head.appendChild(hr);
    resTable.appendChild(head);
    const body = el('tbody');
    for (const k of result.keywords) {
      const tr = el('tr');
      for (const v of [k.keyword + (k.aio ? ' · AIO' : ''), t.nf0.format(k.volume), k.currentPosition === null ? '–' : t.nf.format(k.currentPosition), t.nf.format(k.targetPosition), t.pct(k.currentCtr), t.pct(k.targetCtr), t.nf.format(k.currentClicks), t.nf.format(k.targetClicks)]) tr.appendChild(el('td', undefined, v));
      body.appendChild(tr);
    }
    resTable.appendChild(body);

    warnBox.textContent = '';
    const warns = result.keywords.flatMap((k) => k.warnings.map((w) => `${k.keyword}: ${w.type === 'beyond-data' ? t.warnBeyond(w.which, Math.round(w.position)) : t.warnNoAio(w.position)}`));
    if (warns.length) {
      warnBox.appendChild(el('p', 'sf-label', t.warnings));
      const ul = el('ul');
      for (const w of warns) ul.appendChild(el('li', undefined, w));
      warnBox.appendChild(ul);
    }
  }

  function renderAssumptions(curve: Curve): void {
    assBody.textContent = '';
    assBody.appendChild(el('p', undefined, t.formula));
    const srcId = curve.source;
    const s = srcId ? file.sources[srcId] : null;
    const p = el('p');
    if (s) {
      p.appendChild(document.createTextNode(`${t.curve}: ${curve.label}. `));
      p.appendChild(document.createTextNode(`${t.source}: `));
      const a = el('a', undefined, `${s.publisher}, ${s.title}`);
      a.href = s.url; a.target = '_blank'; a.rel = 'noopener';
      p.append(a, document.createTextNode(` (${s.market}, ${s.data_period}). ${s.method}`));
    } else {
      p.appendChild(document.createTextNode(ownInfo));
    }
    assBody.appendChild(p);

    if (curve.aio.type === 'reduction') {
      const r = curve.aio.source ? file.sources[curve.aio.source] : null;
      const ap = el('p');
      ap.appendChild(document.createTextNode(t.aioReduction(r ? `${r.publisher}, ${r.data_period}` : '')));
      if (r) {
        ap.appendChild(document.createTextNode(' '));
        const a = el('a', undefined, r.title); a.href = r.url; a.target = '_blank'; a.rel = 'noopener';
        ap.append(a, document.createTextNode(`. ${r.method}`));
      }
      assBody.appendChild(ap);
    } else {
      assBody.appendChild(el('p', undefined, curve.aio.type === 'curve' ? t.aioCurve : t.aioNone));
    }

    const wrap = el('div', 'sf-table-wrap');
    const tbl = el('table', 'sf-table sf-table--compact');
    const head = el('thead');
    const hr = el('tr');
    for (const h of [t.position, t.ctrBase, t.ctrAio]) hr.appendChild(el('th', undefined, h));
    head.appendChild(hr);
    tbl.appendChild(head);
    const body = el('tbody');
    const maxP = Math.max(10, maxPosition(curve.ctr));
    for (let pos = 1; pos <= maxP; pos++) {
      const b = ctrFor(curve, pos, false);
      const a = ctrFor(curve, pos, true);
      const tr = el('tr');
      tr.append(el('td', undefined, String(pos)), el('td', undefined, b === null ? t.noData : t.pct(b)), el('td', undefined, a === null ? t.noData : t.pct(Math.round(a * 100) / 100)));
      body.appendChild(tr);
    }
    tbl.appendChild(body);
    wrap.appendChild(tbl);
    assBody.appendChild(wrap);

    const ul = el('ul', 'sf-caveats');
    for (const c of file.caveats[lang]) ul.appendChild(el('li', undefined, c));
    assBody.appendChild(ul);
  }

  function update(): void {
    const curve = currentCurve();
    ownNote.textContent = ownCurve && curve === ownCurve ? ownInfo : '';
    renderAssumptions(curve);
    if (!rows.length) { showMessages([t.noKeywords], 'sf-msg sf-msg--error', t.errors); return; }
    const invalid = rows.filter((r) => !r.keyword || !Number.isFinite(r.volume) || r.volume < 0 || !Number.isFinite(r.targetPosition) || r.targetPosition < 1
      || (r.currentPosition !== null && (!Number.isFinite(r.currentPosition) || r.currentPosition < 1)));
    if (invalid.length) { showMessages(invalid.map((r) => t.invalid(r.keyword)), 'sf-msg sf-msg--error', t.errors); return; }
    try {
      last = forecast(curve, rows, { rampMonths: Number(ramp.value) || 1, horizonMonths: Number(horizon.value) || 12 });
      showMessages([], '', '');
      renderResult(last);
    } catch (e) {
      showMessages([(e as Error).message], 'sf-msg sf-msg--error', t.errors);
    }
  }

  // ---------- events ----------
  curveSel.addEventListener('change', update);
  ramp.addEventListener('input', update);
  let resizeTimer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (last) renderChart(last); }, 150);
  });
  horizon.addEventListener('input', update);
  addBtn.addEventListener('click', () => {
    rows.push({ keyword: '', volume: 0, currentPosition: null, targetPosition: 1, aio: false });
    renderRows();
    const inputs = kwTable.querySelectorAll<HTMLInputElement>('tbody tr:last-child input');
    if (inputs[0]) inputs[0].focus();
  });
  kwImport.addEventListener('click', () => kwFile.click());
  kwFile.addEventListener('change', async () => {
    const { keywords, errors } = keywordsFromCsv(await readFile(kwFile));
    kwFile.value = '';
    if (keywords.length) { rows.splice(0, rows.length, ...keywords); renderRows(); update(); }
    if (errors.length) showMessages(errors, 'sf-msg sf-msg--error', t.errors);
  });
  gscImport.addEventListener('click', () => gscFile.click());
  gscFile.addEventListener('change', async () => {
    const { rows: gsc, errors } = searchConsoleFromCsv(await readFile(gscFile));
    gscFile.value = '';
    if (errors.length) { showMessages(errors, 'sf-msg sf-msg--error', t.errors); return; }
    const { ctr } = curveFromSearchConsole(gsc);
    if (!Object.keys(ctr).length) { showMessages(['no position with at least 100 impressions'], 'sf-msg sf-msg--error', t.errors); return; }
    ownCurve = { id: 'own-search-console', label: t.ownCurve, ctr, aio: { type: 'none' } };
    ownInfo = t.gscInfo(gsc.length);
    renderCurveOptions();
    curveSel.value = ownCurve.id;
    update();
  });
  templateBtn.addEventListener('click', () => {
    const csv = lang === 'de'
      ? 'keyword;suchvolumen;aktuelle_position;zielposition;ai_overview\nbriefing erstellen;1300;;3;ja\ncontent briefing vorlage;390;8;2;nein\n'
      : 'keyword,volume,current_position,target_position,aio\nhow to write a brief,1900,,3,yes\ncontent brief template,720,8,2,no\n';
    download(lang === 'de' ? 'seo-prognose-vorlage.csv' : 'seo-forecast-template.csv', csv, 'text/csv;charset=utf-8');
  });
  exportBtn.addEventListener('click', () => {
    if (last) download(lang === 'de' ? 'seo-prognose.csv' : 'seo-forecast.csv', resultToCsv(last), 'text/csv;charset=utf-8');
  });

  // ---------- start ----------
  fetch(src, { credentials: 'same-origin' })
    .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then((json: CurveFile) => {
      file = json;
      curves = curvesFromFile(file, lang);
      renderCurveOptions();
      renderRows();
      update();
    })
    .catch(() => { root.textContent = t.loadFailed; });
}

const target = typeof document !== 'undefined' ? document.getElementById('seo-forecast') : null;
if (target) mount(target);

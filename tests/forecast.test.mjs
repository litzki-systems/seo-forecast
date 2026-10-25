import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { forecast, ctrFor, curveFromSearchConsole, maxPosition } from '../dist/forecast.js';
import { keywordsFromCsv, searchConsoleFromCsv, parseNumber, resultToCsv } from '../dist/csv.js';
import { curvesFromFile } from '../dist/data.js';

const file = JSON.parse(readFileSync(new URL('../data/ctr-curves.json', import.meta.url), 'utf8'));
const curves = curvesFromFile(file, 'en');
const unbranded = curves.find((c) => c.id === 'awr-us-unbranded-2026-07');
const desktop = curves.find((c) => c.id === 'awr-us-desktop-2026-07');

test('data file: every curve and AI Overview model names a known source with a URL', () => {
  for (const c of file.curves) {
    assert.ok(file.sources[c.source]?.url, c.id);
    const aioSource = c.aio.type === 'curve' ? c.aio.source : file.aio_reductions[c.aio.source].source;
    assert.ok(file.sources[aioSource]?.url, c.id + ' aio');
  }
});

test('data file: values are plausible percentages', () => {
  for (const c of file.curves) {
    for (const v of Object.values(c.ctr)) assert.ok(v > 0 && v < 100, c.id);
  }
});

test('ctrFor: base value, AI Overview reduction and AI Overview curve', () => {
  assert.equal(ctrFor(unbranded, 1, false), 19.38);
  assert.ok(Math.abs(ctrFor(unbranded, 1, true) - 19.38 * 0.42) < 1e-9);
  assert.equal(ctrFor(desktop, 1, true), 9.69);
  assert.equal(ctrFor(unbranded, 3.4, false), 6.02, 'rounds Search Console averages');
  assert.equal(ctrFor(unbranded, 11, false), null, 'no data beyond position 10');
  assert.equal(ctrFor(unbranded, null, false), null);
});

test('forecast: volume × CTR, linear ramp, totals', () => {
  const r = forecast(unbranded, [
    { keyword: 'a', volume: 1000, currentPosition: 5, targetPosition: 1, aio: false },
  ], { rampMonths: 4, horizonMonths: 6 });
  const k = r.keywords[0];
  assert.equal(k.currentClicks, 26.8);
  assert.equal(k.targetClicks, 193.8);
  assert.deepEqual(k.monthly, [68.55, 110.3, 152.05, 193.8, 193.8, 193.8]);
  assert.equal(r.totals.targetClicks, 193.8);
  assert.equal(r.totals.additionalClicksOverHorizon, Math.round((68.55 + 110.3 + 152.05 + 193.8 * 3 - 26.8 * 6) * 100) / 100);
});

test('forecast: positions beyond the data count as 0 and produce a warning', () => {
  const r = forecast(unbranded, [
    { keyword: 'b', volume: 500, currentPosition: 25, targetPosition: 3, aio: false },
  ], { rampMonths: 2, horizonMonths: 2 });
  assert.equal(r.keywords[0].currentClicks, 0);
  assert.equal(r.keywords[0].warnings.length, 1);
  assert.equal(r.keywords[0].warnings[0].type, 'beyond-data');
});

test('forecast: rejects invalid input instead of guessing', () => {
  assert.throws(() => forecast(unbranded, [{ keyword: 'c', volume: -1, currentPosition: null, targetPosition: 1, aio: false }], { rampMonths: 1, horizonMonths: 1 }));
});

test('curveFromSearchConsole: clicks / impressions per rounded position', () => {
  const { ctr } = curveFromSearchConsole([
    { clicks: 30, impressions: 100, position: 1.2 },
    { clicks: 10, impressions: 100, position: 0.9 },
    { clicks: 5, impressions: 100, position: 2.4 },
    { clicks: 1, impressions: 10, position: 3 },
  ]);
  assert.deepEqual(ctr, { 1: 20, 2: 5 });
});

test('parseNumber: German and English formats', () => {
  assert.equal(parseNumber('1.234,5'), 1234.5);
  assert.equal(parseNumber('1,234.5'), 1234.5);
  assert.equal(parseNumber('3,4'), 3.4);
  assert.equal(parseNumber('12.3%'), 12.3);
  assert.ok(Number.isNaN(parseNumber('')));
});

test('keywordsFromCsv: German headers, semicolons, empty current position', () => {
  const { keywords, errors } = keywordsFromCsv('Keyword;Suchvolumen;Aktuelle Position;Zielposition;AI Overview\n"briefing erstellen";1.300;;3;ja\nseo agentur;880;12,4;5;nein\n');
  assert.deepEqual(errors, []);
  assert.deepEqual(keywords, [
    { keyword: 'briefing erstellen', volume: 1300, currentPosition: null, targetPosition: 3, aio: true, brand: false, intent: null },
    { keyword: 'seo agentur', volume: 880, currentPosition: 12.4, targetPosition: 5, aio: false, brand: false, intent: null },
  ]);
});

test('keywordsFromCsv: reports missing columns', () => {
  assert.deepEqual(keywordsFromCsv('keyword,volume\na,1\n').errors, ['column missing: target_position']);
});

test('searchConsoleFromCsv: English export', () => {
  const { rows } = searchConsoleFromCsv('Top queries,Clicks,Impressions,CTR,Position\nfoo,10,200,5%,2.1\n');
  assert.deepEqual(rows, [{ clicks: 10, impressions: 200, position: 2.1 }]);
});

test('resultToCsv: header, keyword row and total row', () => {
  const r = forecast(unbranded, [{ keyword: 'a, b', volume: 100, currentPosition: 2, targetPosition: 1, aio: false }], { rampMonths: 1, horizonMonths: 2 });
  const lines = resultToCsv(r).trim().split('\n');
  assert.equal(lines.length, 3);
  assert.ok(lines[1].startsWith('"a, b",100,2,1,no,no,,awr-us-unbranded-2026-07'));
  assert.ok(lines[2].startsWith('TOTAL'));
});

test('maxPosition', () => {
  assert.equal(maxPosition(unbranded.ctr), 10);
  assert.equal(maxPosition(desktop.ctr), 20);
});

// ---------- presets and funnel ----------
import { presetsFromFile, wordCount } from '../dist/data.js';
import { funnel, validateFunnel, leadRateFor } from '../dist/funnel.js';
import { funnelToCsv, parseIntent } from '../dist/csv.js';

const presets = presetsFromFile(file, 'en');

test('presets: brand split picks the brand curve for brand keywords', () => {
  const p = presets.find((x) => x.type === 'brand');
  const r = forecast(p.choice, [
    { keyword: 'acme', volume: 100, currentPosition: null, targetPosition: 1, aio: false, brand: true },
    { keyword: 'widgets', volume: 100, currentPosition: null, targetPosition: 1, aio: false, brand: false },
  ], { rampMonths: 1, horizonMonths: 1 });
  assert.equal(r.keywords[0].targetCtr, 27.32);
  assert.equal(r.keywords[1].targetCtr, 19.38);
});

test('presets: query length picks the word-count curve and notes > 4 words', () => {
  const p = presets.find((x) => x.type === 'query-length');
  const r = forecast(p.choice, [
    { keyword: 'seo', volume: 100, currentPosition: null, targetPosition: 1, aio: false },
    { keyword: 'how to write a brief', volume: 100, currentPosition: null, targetPosition: 1, aio: false },
  ], { rampMonths: 1, horizonMonths: 1 });
  assert.equal(r.keywords[0].targetCtr, 25.67);
  assert.equal(r.keywords[1].targetCtr, 21.97);
  assert.equal(r.keywords[1].warnings[0].type, 'curve-note');
  assert.equal(wordCount('  a  b '), 2);
});

const baseForecast = () => forecast(unbranded, [
  { keyword: 'a', volume: 1000, currentPosition: 5, targetPosition: 1, aio: false, intent: 'commercial' },
  { keyword: 'b', volume: 1000, currentPosition: null, targetPosition: 2, aio: false, intent: 'informational' },
], { rampMonths: 2, horizonMonths: 4 });

test('funnel: additional clicks → leads → customers → revenue → profit', () => {
  const r = baseForecast();
  const f = funnel(r, { leadRate: 2, leadRateByIntent: { commercial: 4 }, closeRate: 25, customerValue: 1000, margin: 50, basis: 'additional' });
  // at target: a = 193.8 - 26.8 = 167 additional clicks at 4 %, b = 96.4 at 2 %
  assert.equal(f.atTarget.clicks, 263.4);
  assert.equal(f.atTarget.leads, Math.round((167 * 0.04 + 96.4 * 0.02) * 100) / 100);
  const leads = 167 * 0.04 + 96.4 * 0.02;
  assert.equal(f.atTarget.customers, Math.round(leads * 0.25 * 100) / 100);
  assert.equal(f.atTarget.revenue, Math.round(leads * 0.25 * 1000 * 100) / 100);
  assert.equal(f.atTarget.grossProfit, Math.round(leads * 0.25 * 1000 * 0.5 * 100) / 100);
  assert.equal(f.totals.roi, null, 'no ROI without investment');
  assert.equal(f.months.length, 4);
  assert.equal(f.months[3].clicks, 263.4);
});

test('funnel: total basis counts today\'s clicks too', () => {
  const f = funnel(baseForecast(), { leadRate: 10, closeRate: 100, customerValue: 1, margin: 100, basis: 'total' });
  assert.equal(f.atTarget.clicks, 290.2);
  assert.equal(f.atTarget.revenue, 29.02);
});

test('funnel: investment, cumulative ROI, return per euro, break-even', () => {
  const f = funnel(baseForecast(), { leadRate: 10, closeRate: 50, customerValue: 100, margin: 100, monthlyInvestment: 500, oneOffInvestment: 1000, basis: 'additional' });
  assert.equal(f.months[0].investment, 1500);
  assert.equal(f.months[1].investment, 500);
  const gross = f.months.reduce((s, m) => s + m.grossProfit, 0);
  assert.equal(f.totals.investment, 3000);
  assert.ok(Math.abs(f.totals.roi - ((gross - 3000) / 3000) * 100) < 0.01);
  assert.ok(Math.abs(f.totals.returnPerEuro - gross / 3000) < 0.01);
  assert.equal(f.totals.breakEvenMonth, f.months.find((m) => m.cumulativeNetProfit >= 0)?.month ?? null);
});

test('funnel: rejects rates outside 0 to 100', () => {
  assert.ok(validateFunnel({ leadRate: 120, closeRate: 10, customerValue: 1, margin: 50, basis: 'total' }).length);
  assert.throws(() => funnel(baseForecast(), { leadRate: -1, closeRate: 10, customerValue: 1, margin: 50, basis: 'total' }));
});

test('funnel: intent lead rate falls back to the general rate', () => {
  const s = { leadRate: 3, leadRateByIntent: { transactional: 8 }, closeRate: 1, customerValue: 1, margin: 1, basis: 'total' };
  assert.equal(leadRateFor(s, 'transactional'), 8);
  assert.equal(leadRateFor(s, 'informational'), 3);
  assert.equal(leadRateFor(s, null), 3);
});

test('funnelToCsv and intent parsing', () => {
  const f = funnel(baseForecast(), { leadRate: 2, closeRate: 10, customerValue: 100, margin: 50, monthlyInvestment: 100, basis: 'additional' });
  const lines = funnelToCsv(f).split('\n');
  assert.ok(lines[0].startsWith('month,clicks,leads'));
  assert.ok(lines[5].startsWith('TOTAL'));
  assert.equal(parseIntent('Kommerziell'), 'commercial');
  assert.equal(parseIntent('transaktional'), 'transactional');
  assert.equal(parseIntent('info'), 'informational');
  assert.equal(parseIntent(''), null);
});

test('keywordsFromCsv: brand and intent columns', () => {
  const { keywords, errors } = keywordsFromCsv('keyword,volume,target_position,intent,brand\nacme shoes,500,1,transactional,yes\n');
  assert.deepEqual(errors, []);
  assert.equal(keywords[0].intent, 'transactional');
  assert.equal(keywords[0].brand, true);
});

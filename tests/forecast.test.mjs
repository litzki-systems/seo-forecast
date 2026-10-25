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
    { keyword: 'briefing erstellen', volume: 1300, currentPosition: null, targetPosition: 3, aio: true },
    { keyword: 'seo agentur', volume: 880, currentPosition: 12.4, targetPosition: 5, aio: false },
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
  assert.ok(lines[1].startsWith('"a, b",100,2,1,no'));
  assert.ok(lines[2].startsWith('TOTAL'));
});

test('maxPosition', () => {
  assert.equal(maxPosition(unbranded.ctr), 10);
  assert.equal(maxPosition(desktop.ctr), 20);
});

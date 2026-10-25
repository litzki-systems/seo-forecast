/**
 * seo-forecast · package entry
 * The bundle package/seo-forecast.js is built from this file.
 * MIT License.
 */
export { mount, type MountOptions, type Mounted } from './ui.js';
export { forecast, ctrFor, baseCtr, maxPosition, curveFromSearchConsole } from './forecast.js';
export type { Curve, CurveChoice, Keyword, Intent, Settings, ForecastResult, KeywordResult, ForecastWarning, CtrTable, AioModel, SearchConsoleRow } from './forecast.js';
export { funnel, validateFunnel, leadRateFor } from './funnel.js';
export type { FunnelSettings, FunnelResult, FunnelMonth } from './funnel.js';
export { keywordsFromCsv, searchConsoleFromCsv, resultToCsv, funnelToCsv, parseCsv, parseNumber, parseIntent } from './csv.js';
export { presetsFromFile, curvesFromFile, wordCount, type Preset, type CurveFile, type Lang } from './data.js';

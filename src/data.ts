/**
 * seo-forecast · turns data/ctr-curves.json into calculator curves. MIT License.
 */
import type { CtrTable, Curve } from './forecast.js';

export type Lang = 'de' | 'en';

export interface SourceInfo {
  title: string;
  publisher: string;
  url: string;
  published: string;
  data_period: string;
  market: string;
  method: string;
}

export interface CurveFile {
  version: string;
  updated: string;
  sources: Record<string, SourceInfo>;
  curves: Array<{
    id: string;
    label: Record<Lang, string>;
    source: string;
    device: string;
    query_type: string;
    ctr: CtrTable;
    aio: { type: 'reduction'; source: string } | { type: 'curve'; source: string; ctr: CtrTable };
  }>;
  aio_reductions: Record<string, { label: Record<Lang, string>; source: string; change_percent: CtrTable }>;
  caveats: Record<Lang, string[]>;
}

export function curvesFromFile(file: CurveFile, lang: Lang): Curve[] {
  return file.curves.map((c) => {
    const aio = c.aio.type === 'curve'
      ? { type: 'curve' as const, ctr: c.aio.ctr, source: c.aio.source }
      : { type: 'reduction' as const, changePercent: file.aio_reductions[c.aio.source].change_percent, source: file.aio_reductions[c.aio.source].source };
    return { id: c.id, label: c.label[lang], ctr: c.ctr, aio, source: c.source };
  });
}

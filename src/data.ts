/**
 * seo-forecast · turns data/ctr-curves.json into calculator curves. MIT License.
 */
import type { CtrTable, Curve, CurveChoice, Keyword } from './forecast.js';

export type Lang = 'de' | 'en';

export interface SourceInfo {
  title: string;
  publisher: string;
  url: string;
  published: string;
  data_period: string;
  market: string;
  method: string;
  /** German version of method, optional. */
  method_de?: string;
}

export interface CurveFile {
  version: string;
  updated: string;
  sources: Record<string, SourceInfo>;
  curves: Array<{
    id: string;
    label: Record<Lang, string>;
    /** Short name for table headers, optional. */
    short?: Record<Lang, string>;
    source: string;
    device: string;
    query_type: string;
    ctr: CtrTable;
    aio: { type: 'reduction'; source: string } | { type: 'curve'; source: string; ctr: CtrTable };
  }>;
  presets?: Array<
    | { id: string; type: 'single'; label: Record<Lang, string>; curve: string }
    | { id: string; type: 'brand'; label: Record<Lang, string>; default: string; brand: string }
    | { id: string; type: 'query-length'; label: Record<Lang, string>; by_words: Record<string, string> }
  >;
  aio_reductions: Record<string, { label: Record<Lang, string>; source: string; change_percent: CtrTable }>;
  caveats: Record<Lang, string[]>;
  aio_citation?: {
    source: string;
    source_ref: { name: string; url: string; year: number };
    cited: number;
    not_cited: number;
    /** Lower and upper value the source supports for not cited. */
    not_cited_range?: [number, number];
    calculation: string;
    label: Record<Lang, string>;
  };
  industry_lead_rates?: {
    source: string;
    source_ref: { name: string; url: string; year: number };
    note: Record<Lang, string>;
    industries: Array<{ id: string; label: Record<Lang, string>; lead_rate: number }>;
    average: number;
  };
}

export function curvesFromFile(file: CurveFile, lang: Lang): Curve[] {
  return file.curves.map((c) => {
    const aio = c.aio.type === 'curve'
      ? { type: 'curve' as const, ctr: c.aio.ctr, source: c.aio.source }
      : { type: 'reduction' as const, changePercent: file.aio_reductions[c.aio.source].change_percent, source: file.aio_reductions[c.aio.source].source };
    return { id: c.id, label: c.label[lang], shortLabel: c.short?.[lang], ctr: c.ctr, aio, source: c.source };
  });
}

export interface Preset {
  id: string;
  label: string;
  choice: CurveChoice;
  /** Curves this preset can use, for the assumptions table. */
  curves: Curve[];
  type: 'single' | 'brand' | 'query-length';
}

/** Number of words in a query (whitespace-separated). */
export function wordCount(keyword: string): number {
  return keyword.trim().split(/\s+/).filter(Boolean).length;
}

const NOTES: Record<Lang, { longer: (n: number, max: number) => string }> = {
  en: { longer: (n, max) => `${n} words: no published curve beyond ${max} words, the ${max}-word curve is used` },
  de: { longer: (n, max) => `${n} Wörter: Über ${max} Wörter hinaus ist keine Kurve veröffentlicht, es gilt die ${max}-Wort-Kurve` },
};

/** Presets for the calculator: single curves, brand/non-brand split, query length. */
export function presetsFromFile(file: CurveFile, lang: Lang): Preset[] {
  const curves = curvesFromFile(file, lang);
  const byId = (id: string): Curve => {
    const c = curves.find((x) => x.id === id);
    if (!c) throw new Error(`unknown curve ${id}`);
    return c;
  };
  const list = file.presets && file.presets.length
    ? file.presets
    : file.curves.map((c) => ({ id: c.id, type: 'single' as const, label: c.label, curve: c.id }));
  return list.map((p): Preset => {
    if (p.type === 'brand') {
      const normal = byId(p.default);
      const brand = byId(p.brand);
      return {
        id: p.id, label: p.label[lang], type: 'brand', curves: [normal, brand],
        choice: { id: p.id, pick: (k: Keyword) => ({ curve: k.brand ? brand : normal }) },
      };
    }
    if (p.type === 'query-length') {
      const sizes = Object.keys(p.by_words).map(Number).sort((a, b) => a - b);
      const max = sizes[sizes.length - 1];
      const map = new Map(sizes.map((n) => [n, byId(p.by_words[String(n)])]));
      return {
        id: p.id, label: p.label[lang], type: 'query-length', curves: sizes.map((n) => map.get(n) as Curve),
        choice: {
          id: p.id,
          pick: (k: Keyword) => {
            const n = Math.max(1, wordCount(k.keyword));
            if (n > max) return { curve: map.get(max) as Curve, note: NOTES[lang].longer(n, max) };
            return { curve: map.get(n) as Curve };
          },
        },
      };
    }
    const c = byId(p.curve);
    return { id: p.id, label: p.label[lang], type: 'single', curves: [c], choice: c };
  });
}

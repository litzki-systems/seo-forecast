export function curvesFromFile(file, lang) {
    return file.curves.map((c) => {
        const aio = c.aio.type === 'curve'
            ? { type: 'curve', ctr: c.aio.ctr, source: c.aio.source }
            : { type: 'reduction', changePercent: file.aio_reductions[c.aio.source].change_percent, source: file.aio_reductions[c.aio.source].source };
        return { id: c.id, label: c.label[lang], shortLabel: c.short?.[lang], ctr: c.ctr, aio, source: c.source };
    });
}
/** Number of words in a query (whitespace-separated). */
export function wordCount(keyword) {
    return keyword.trim().split(/\s+/).filter(Boolean).length;
}
const NOTES = {
    en: { longer: (n, max) => `${n} words: no published curve beyond ${max} words, the ${max}-word curve is used` },
    de: { longer: (n, max) => `${n} Wörter: Über ${max} Wörter hinaus ist keine Kurve veröffentlicht, es gilt die ${max}-Wort-Kurve` },
};
/** Presets for the calculator: single curves, brand/non-brand split, query length. */
export function presetsFromFile(file, lang) {
    const curves = curvesFromFile(file, lang);
    const byId = (id) => {
        const c = curves.find((x) => x.id === id);
        if (!c)
            throw new Error(`unknown curve ${id}`);
        return c;
    };
    const list = file.presets && file.presets.length
        ? file.presets
        : file.curves.map((c) => ({ id: c.id, type: 'single', label: c.label, curve: c.id }));
    return list.map((p) => {
        if (p.type === 'brand') {
            const normal = byId(p.default);
            const brand = byId(p.brand);
            return {
                id: p.id, label: p.label[lang], type: 'brand', curves: [normal, brand],
                choice: { id: p.id, pick: (k) => ({ curve: k.brand ? brand : normal }) },
            };
        }
        if (p.type === 'query-length') {
            const sizes = Object.keys(p.by_words).map(Number).sort((a, b) => a - b);
            const max = sizes[sizes.length - 1];
            const map = new Map(sizes.map((n) => [n, byId(p.by_words[String(n)])]));
            return {
                id: p.id, label: p.label[lang], type: 'query-length', curves: sizes.map((n) => map.get(n)),
                choice: {
                    id: p.id,
                    pick: (k) => {
                        const n = Math.max(1, wordCount(k.keyword));
                        if (n > max)
                            return { curve: map.get(max), note: NOTES[lang].longer(n, max) };
                        return { curve: map.get(n) };
                    },
                },
            };
        }
        const c = byId(p.curve);
        return { id: p.id, label: p.label[lang], type: 'single', curves: [c], choice: c };
    });
}

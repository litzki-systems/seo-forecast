export function curvesFromFile(file, lang) {
    return file.curves.map((c) => {
        const aio = c.aio.type === 'curve'
            ? { type: 'curve', ctr: c.aio.ctr, source: c.aio.source }
            : { type: 'reduction', changePercent: file.aio_reductions[c.aio.source].change_percent, source: file.aio_reductions[c.aio.source].source };
        return { id: c.id, label: c.label[lang], ctr: c.ctr, aio, source: c.source };
    });
}

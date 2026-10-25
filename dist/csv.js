export function parseCsv(text) {
    const clean = text.replace(/^﻿/, '');
    const firstLine = clean.split(/\r?\n/, 1)[0] || '';
    const counts = [
        [';', (firstLine.match(/;/g) || []).length],
        ['\t', (firstLine.match(/\t/g) || []).length],
        [',', (firstLine.match(/,/g) || []).length],
    ];
    const sep = counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts[0][0] : ',';
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < clean.length; i++) {
        const c = clean[i];
        if (quoted) {
            if (c === '"' && clean[i + 1] === '"') {
                field += '"';
                i++;
            }
            else if (c === '"')
                quoted = false;
            else
                field += c;
        }
        else if (c === '"')
            quoted = true;
        else if (c === sep) {
            row.push(field);
            field = '';
        }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && clean[i + 1] === '\n')
                i++;
            row.push(field);
            field = '';
            if (row.some((f) => f.trim() !== ''))
                rows.push(row);
            row = [];
        }
        else
            field += c;
    }
    row.push(field);
    if (row.some((f) => f.trim() !== ''))
        rows.push(row);
    return rows;
}
/**
 * Parses "1.234,5", "1,234.5", "3,4", "12.3%" and "" (→ NaN).
 * A single separator followed by exactly three digits groups for thousands ("1.300", "1,300" = 1300).
 */
export function parseNumber(raw) {
    let s = String(raw ?? '').trim().replace(/%$/, '').replace(/\s/g, '');
    if (s === '')
        return NaN;
    const hasComma = s.includes(',');
    const hasDot = s.includes('.');
    if (hasComma && hasDot) {
        s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    }
    else if (hasComma) {
        s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
    }
    else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) {
        // German thousands separator: "1.300" = 1300
        s = s.replace(/\./g, '');
    }
    return Number(s);
}
const norm = (h) => h.toLowerCase().trim().replace(/[\s\-]+/g, '_');
const KEYWORD_HEADERS = {
    keyword: ['keyword', 'query', 'suchbegriff', 'top_queries', 'häufigste_suchanfragen', 'haeufigste_suchanfragen'],
    volume: ['volume', 'search_volume', 'msv', 'suchvolumen', 'volumen'],
    currentPosition: ['current_position', 'position', 'aktuelle_position'],
    targetPosition: ['target_position', 'zielposition', 'ziel_position'],
    aio: ['aio', 'ai_overview', 'ai_overviews'],
};
function indexOf(header, names) {
    const h = header.map(norm);
    for (const n of names) {
        const i = h.indexOf(n);
        if (i >= 0)
            return i;
    }
    return -1;
}
const truthy = (v) => /^(1|yes|ja|true|wahr|x)$/i.test(String(v || '').trim());
/**
 * Reads a keyword list. Required columns: keyword, volume, target_position.
 * Optional: current_position (empty = not ranking), aio (yes/no).
 */
export function keywordsFromCsv(text) {
    const rows = parseCsv(text);
    const errors = [];
    if (rows.length < 2)
        return { keywords: [], errors: ['no data rows'] };
    const header = rows[0];
    const col = {
        keyword: indexOf(header, KEYWORD_HEADERS.keyword),
        volume: indexOf(header, KEYWORD_HEADERS.volume),
        currentPosition: indexOf(header, KEYWORD_HEADERS.currentPosition),
        targetPosition: indexOf(header, KEYWORD_HEADERS.targetPosition),
        aio: indexOf(header, KEYWORD_HEADERS.aio),
    };
    for (const k of ['keyword', 'volume', 'targetPosition']) {
        if (col[k] < 0)
            errors.push(`column missing: ${KEYWORD_HEADERS[k][0]}`);
    }
    if (errors.length)
        return { keywords: [], errors };
    const keywords = [];
    rows.slice(1).forEach((r, i) => {
        const line = i + 2;
        const keyword = (r[col.keyword] || '').trim();
        const volume = parseNumber(r[col.volume]);
        const target = parseNumber(r[col.targetPosition]);
        const curRaw = col.currentPosition >= 0 ? r[col.currentPosition] : '';
        const current = curRaw && curRaw.trim() !== '' ? parseNumber(curRaw) : null;
        if (!keyword) {
            errors.push(`line ${line}: keyword missing`);
            return;
        }
        if (!Number.isFinite(volume) || volume < 0) {
            errors.push(`line ${line}: volume is not a number`);
            return;
        }
        if (!Number.isFinite(target) || target < 1) {
            errors.push(`line ${line}: target position is not a number ≥ 1`);
            return;
        }
        if (current !== null && (!Number.isFinite(current) || current < 1)) {
            errors.push(`line ${line}: current position is not a number ≥ 1`);
            return;
        }
        keywords.push({ keyword, volume, currentPosition: current, targetPosition: target, aio: col.aio >= 0 ? truthy(r[col.aio]) : false });
    });
    return { keywords, errors };
}
/** Reads a Google Search Console query export (Queries.csv), German or English. */
export function searchConsoleFromCsv(text) {
    const rows = parseCsv(text);
    if (rows.length < 2)
        return { rows: [], errors: ['no data rows'] };
    const header = rows[0];
    const ci = indexOf(header, ['clicks', 'klicks']);
    const ii = indexOf(header, ['impressions', 'impressionen']);
    const pi = indexOf(header, ['position']);
    const errors = [];
    if (ci < 0)
        errors.push('column missing: clicks');
    if (ii < 0)
        errors.push('column missing: impressions');
    if (pi < 0)
        errors.push('column missing: position');
    if (errors.length)
        return { rows: [], errors };
    const out = [];
    for (const r of rows.slice(1)) {
        const row = { clicks: parseNumber(r[ci]), impressions: parseNumber(r[ii]), position: parseNumber(r[pi]) };
        if (Number.isFinite(row.clicks) && Number.isFinite(row.impressions) && Number.isFinite(row.position))
            out.push(row);
    }
    return { rows: out, errors };
}
const esc = (v) => {
    const s = String(v);
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
/** Result table as CSV: one row per keyword, one column per month, plus a total row. */
export function resultToCsv(result) {
    const months = result.totals.monthly.map((_, i) => `month_${i + 1}`);
    const head = ['keyword', 'volume', 'current_position', 'target_position', 'aio', 'current_ctr_percent', 'target_ctr_percent', 'current_clicks', 'target_clicks', ...months];
    const lines = [head.join(',')];
    for (const k of result.keywords) {
        lines.push([k.keyword, k.volume, k.currentPosition ?? '', k.targetPosition, k.aio ? 'yes' : 'no', k.currentCtr, k.targetCtr, k.currentClicks, k.targetClicks, ...k.monthly].map(esc).join(','));
    }
    lines.push(['TOTAL', '', '', '', '', '', '', result.totals.currentClicks, result.totals.targetClicks, ...result.totals.monthly].map(esc).join(','));
    return lines.join('\n') + '\n';
}

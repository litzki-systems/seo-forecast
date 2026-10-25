# Embedding SEO Forecast in a website

The calculator is built to drop into an existing site without touching its design system or its Content Security Policy.

## Files to ship

| Path | Purpose |
| --- | --- |
| `dist/ui.js`, `dist/forecast.js`, `dist/csv.js`, `dist/data.js` | ES modules, no dependencies |
| `data/ctr-curves.json` | CTR curves and sources |
| `css/seo-forecast.css` | optional; all calculator rules use the `sf-` prefix |

## Markup

```html
<div id="seo-forecast" data-lang="en" data-src="/path/to/ctr-curves.json"></div>
<script type="module" src="/path/to/dist/ui.js"></script>
```

- `data-lang`: `de` or `en` (default: `<html lang>`).
- `data-src`: URL of `ctr-curves.json` (default: `data/ctr-curves.json`, relative to the page).

`ui.js` mounts itself into `#seo-forecast`. To mount elsewhere, import `mount(element)` from `dist/ui.js`.

## Content Security Policy

- No inline scripts, no inline event handlers, no `eval`: `script-src 'self'` is enough.
- No inline styles in markup. The chart is SVG with classes; styling comes from the stylesheet.
- One request: `fetch` of `ctr-curves.json` from the same origin (`connect-src 'self'`).
- No cookies, no `localStorage`, no third-party requests. Downloads use `blob:` URLs (CSV export).

## Styling with your own design system

Either load `css/seo-forecast.css` and override its custom properties (`--sf-navy`, `--sf-gold`, `--sf-serif`, `--sf-sans`, …), or skip it and style the `sf-` classes directly:

`sf-card`, `sf-h`, `sf-grid`, `sf-field`, `sf-label`, `sf-note`, `sf-input`, `sf-table`, `sf-table--input`, `sf-actions`, `sf-btn` (`--primary`, `--outline`, `--secondary`, `--small`), `sf-msg`, `sf-warnings`, `sf-kpis`, `sf-kpi`, `sf-kpi__value`, `sf-kpi__label`, `sf-chart`, `sf-svg`, `sf-line`, `sf-dot`, `sf-baseline`, `sf-grid-line`, `sf-axis`, `sf-assumptions`, `sf-caveats`.

## Using only the core

For a custom interface, import the pure functions and render the result yourself:

```js
import { forecast, ctrFor, curveFromSearchConsole } from './dist/forecast.js';
import { keywordsFromCsv, resultToCsv } from './dist/csv.js';
import { curvesFromFile } from './dist/data.js';
```

Type definitions are in `dist/*.d.ts`.

## Updating the CTR data

Edit `data/ctr-curves.json` only with published figures and add the source under `sources`. Run `npm test`: it checks that every curve names a source with a URL and that all values are plausible percentages.

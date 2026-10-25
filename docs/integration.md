# Embedding SEO Forecast in a website

The package in `package/` is built for a host page with a strict Content Security Policy and its own design system (written for litzki-systems.com, usable anywhere).

## Files

Take the three files of a tagged release (for example `v1.2.0`) and serve them together from one folder, e.g. `/assets/tools/seo-forecast/`:

| File | Content |
| --- | --- |
| `seo-forecast.js` | one ES module, no dependencies, no side effects on import |
| `seo-forecast.css` | all rules with the `.fc-` prefix, only the host page's design tokens |
| `ctr-curves.json` | CTR curves per position and device, each with source (name, URL, year) |

`seo-forecast.js` loads `ctr-curves.json` from its own folder (`new URL('./ctr-curves.json', import.meta.url)`), so the three files must stay together.

## Mounting

```html
<link rel="stylesheet" href="/assets/tools/seo-forecast/seo-forecast.css">
<div id="forecast"></div>
<script type="module" src="/assets/js/forecast-page.js"></script>
```

```js
// /assets/js/forecast-page.js
import { mount } from '/assets/tools/seo-forecast/seo-forecast.js';
mount(document.getElementById('forecast'), { lang: 'de' }); // 'de' | 'en'
```

`mount(el, options)` renders the whole interface into `el` and returns `{ destroy() }`.

| Option | Default | Purpose |
| --- | --- | --- |
| `lang` | `data-lang` of `el`, then `<html lang>`, then `de` | interface language, `de` or `en` |
| `src` | `ctr-curves.json` next to the module | other location of the data file |
| `currency` | `EUR` | ISO code for the funnel figures |

All texts (DE and EN) are inside the module.

## Content Security Policy

Works with `script-src 'self'` and `style-src 'self'` without `unsafe-inline`:

- no inline scripts, no `<style>` elements, no `style="…"` attributes, no `innerHTML`, no `eval`;
- the chart is SVG with classes only; nothing is styled from JavaScript;
- one request: `fetch` of `ctr-curves.json` from the same origin (`connect-src 'self'`);
- no cookies, no `localStorage`, no third-party requests; CSV downloads use `blob:` URLs.

`npm test` runs `scripts/check-package.mjs`, which fails the build if any of this changes.

## Design tokens used

`seo-forecast.css` defines no colours and loads no fonts. It relies on these custom properties of the host page:

- colours: `--color-navy`, `--color-navy-*`, `--color-white`, `--color-off-white`, `--color-accent`, `--color-accent-dark`, `--color-accent-light`, `--color-accent-bg`, `--color-gray-200` … `--color-gray-600`
- fonts: `--font-serif` (headings, weight 400), `--font-sans` (text), `--font-mono` (numbers, labels)
- sizes: `--text-xs` (14 px, smallest used) … `--text-3xl`, `--radius-md`, `--radius-pill`
- theme: `--line`, `--surface`

The demo (`index.html`, `index.de.html`) loads `demo/tokens.css`, a copy of these tokens, so it looks like the host page.

## Classes

`fc` (root), `fc-card`, `fc-h`, `fc-note`, `fc-example`, `fc-local`, `fc-grid`, `fc-field`, `fc-label`, `fc-help`, `fc-input`, `fc-input--num`, `fc-actions`, `fc-btn` (`--primary`, `--outline`, `--secondary`, `--small`, `--icon`), `fc-table-wrap`, `fc-table` (`--input`, `--compact`, `--kpi`), `fc-messages`, `fc-msg`, `fc-msg--error`, `fc-warnings`, `fc-kpis`, `fc-kpis--second`, `fc-kpi`, `fc-kpi--accent`, `fc-kpi__value`, `fc-kpi__label`, `fc-chart`, `fc-svg`, `fc-grid-line`, `fc-baseline`, `fc-line`, `fc-line--invest`, `fc-dot`, `fc-axis`, `fc-gap`, `fc-details`, `fc-assumptions`, `fc-caveats`.

## Only the logic

For a custom interface, import the pure functions from the same module:

```js
import { forecast, funnel, presetsFromFile, keywordsFromCsv } from '/assets/tools/seo-forecast/seo-forecast.js';
```

Types are in `dist/*.d.ts`.

## Updating the CTR data

Edit `data/ctr-curves.json` only with published figures; give each curve `source_ref` (name, url, year) and `device`. `npm test` checks it, rebuilds `package/` and runs the package gate.

# Third-party material

## Data

The CTR values in `data/ctr-curves.json` are published figures, cited with source, period and method in the file itself:

- Advanced Web Ranking, "Google Organic CTR by Position: 2026 Study + AI Overviews", data for July 2026, Google US. https://www.advancedwebranking.com/seo/organic-ctr
- Ahrefs, "Update: AI Overviews Reduce Clicks by 58%", published 2026-02-04. https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/

All rights in those studies remain with their publishers. Please cite them when you reuse the figures.

## Demo fonts

The package loads no fonts. The demo pages use the fonts of the host page, copied to `demo/fonts/`:

| Font | License | File |
| --- | --- | --- |
| EB Garamond | SIL Open Font License 1.1 | `demo/fonts/LICENSE-eb-garamond.txt` |
| Inter | SIL Open Font License 1.1 | `demo/fonts/LICENSE-inter.txt` |
| JetBrains Mono | SIL Open Font License 1.1 | `demo/fonts/LICENSE-jetbrains-mono.txt` |

## Development dependency

TypeScript (Apache License 2.0) compiles `src/` to `dist/`, esbuild (MIT) bundles `package/seo-forecast.js`. Neither is shipped.

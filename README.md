# SEO Forecast

**English** · [Deutsch](#deutsch)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

How many organic clicks, leads, customers and how much profit can a better ranking bring? SEO Forecast multiplies **your** search volume with **published, sourced** click-through rates per position and the **measured** effect of Google AI Overviews, ramps the result up linearly to your target month, and, if you enter your own conversion figures, follows it through the business funnel to revenue, profit, ROI and break-even. Every number it uses is shown next to the result, with its source.

## Measured, not estimated

A forecast is never a measurement. What this tool does instead is keep every input traceable:

- **Search volume** comes from you (keyword tool, Search Console). The calculator never estimates it.
- **CTR curves** are copied as published, with source, market, period and method: [Advanced Web Ranking](https://www.advancedwebranking.com/seo/organic-ctr), Google US, July 2026. Nothing is smoothed or extrapolated. Positions without published data count as 0 clicks and are reported, not guessed.
- **AI Overview impact** lowers CTR, as measured by [Ahrefs](https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/) (300,000 keywords, Search Console data, December 2025: position 1 minus 58 %), or uses AWR's separate CTR column for SERPs with an AI Overview.
- **Your own curve** beats every preset: load your Search Console query export, and the tool computes CTR per position from your clicks and impressions.
- **Funnel figures are yours.** Lead rate, close rate, customer value, margin and investment come from your GA4, CRM or accounts. There are no industry defaults; without your rates the tool forecasts clicks only and invents no revenue.
- **No hidden factors.** Industry multipliers, industry default conversion rates and boosts for ads, snippets, “AI visibility”, mobile or long tail from older versions are gone because no source backs them. Brand and query length are back, but through published curves instead of flat multipliers.

## Formula

```
clicks per month = search volume × CTR(position) × AI Overview factor(position)
month m          = clicks today + (clicks at target − clicks today) × min(m / ramp months, 1)

leads            = clicks × lead rate (per keyword: your rate for its intent, if given)
customers        = leads × close rate
revenue          = customers × customer value
gross profit     = revenue × margin
net profit       = gross profit − investment (monthly, plus an optional one-off in month 1)
ROI              = (cumulative gross profit − cumulative investment) ÷ cumulative investment
```

By default the funnel counts only the **additional** clicks on top of today's clicks, which is what the SEO work adds. You can switch to all forecast clicks.

Positions are rounded to whole numbers (Search Console reports averages like 3.4).

## CTR presets

| Preset | How the curve is chosen | Positions | AI Overview model |
| --- | --- | --- | --- |
| All devices, brand / non-brand (AWR, US, 07/2026) | per keyword: brand curve if ticked as brand, else non-brand | 1 to 10 | Ahrefs reduction per position |
| All devices, by query length (AWR, US, 07/2026) | per keyword: curve for 1, 2, 3 or 4 words (longer: 4, with a note) | 1 to 10 | Ahrefs reduction per position |
| Desktop, all intents (AWR, US, 07/2026) | one curve | 1 to 20 | AWR column “with AI Overview” |
| Your own curve from Search Console | one curve | your data | none (already in your data) |

All values with sources: [`data/ctr-curves.json`](data/ctr-curves.json).

## Limits

- Published curves swing hard from month to month: AWR's desktop CTR for position 1 ranged from 14.61 % to 45.57 % within one year.
- All presets describe Google US. No comparable public per-position data for Germany was found.
- The brand and non-brand curves already include SERPs with AI Overviews; the Ahrefs reduction on top can count part of the effect twice. Treat results for AI Overview keywords as a conservative lower bound.
- Reaching a target position is your assumption, not a prediction of the tool.

## Use it

### Demo page

```bash
python3 -m http.server 8000
# English: http://localhost:8000/
# German:  http://localhost:8000/index.de.html
```

### In your website

Each release tag (for example `v1.2.0`) contains three ready files in `package/`:

| File | Content |
| --- | --- |
| `seo-forecast.js` | one ES module: `mount(el, { lang })` plus the calculation functions |
| `seo-forecast.css` | `.fc-` classes, uses only your page's design tokens |
| `ctr-curves.json` | CTR curves with source (name, URL, year) |

```js
import { mount } from './seo-forecast.js';
mount(document.getElementById('forecast'), { lang: 'en' });
```

Works under `script-src 'self'; style-src 'self'` without `unsafe-inline`. Details: [`docs/integration.md`](docs/integration.md).

### Keyword CSV

Columns (comma or semicolon, German or English headers):

| Column | Required | Example |
| --- | --- | --- |
| `keyword` | yes | `how to write a brief` |
| `volume` (`suchvolumen`) | yes | `1900` |
| `current_position` (`aktuelle_position`) | no, empty = not ranking | `8` |
| `target_position` (`zielposition`) | yes | `3` |
| `aio` (`ai_overview`) | no, `yes`/`no` or `ja`/`nein` | `yes` |
| `intent` (`suchintention`) | no, `informational`/`commercial`/`transactional` (or `info`, `kommerziell`, `transaktional`) | `informational` |
| `brand` (`marke`) | no, `yes`/`no` | `no` |

### Search Console curve

In Search Console, open *Performance → Search results*, choose a period, export *Queries* as CSV and load `Queries.csv`. The tool groups queries by rounded position and computes clicks ÷ impressions. Positions with fewer than 100 impressions are left out.

### As a library

```js
import { forecast, funnel, presetsFromFile } from './package/seo-forecast.js';

const file = await (await fetch('./package/ctr-curves.json')).json();
const [preset] = presetsFromFile(file, 'en');
const clicks = forecast(preset.choice, [
  { keyword: 'how to write a brief', volume: 1900, currentPosition: null, targetPosition: 3, aio: true, intent: 'informational' },
], { rampMonths: 6, horizonMonths: 12 });
const money = funnel(clicks, {
  leadRate: 1, closeRate: 15, customerValue: 1500, margin: 20,
  monthlyInvestment: 500, basis: 'additional',
});
```

The core (`src/forecast.ts`, `src/funnel.ts`, `src/csv.ts`) has no dependencies and no I/O. It runs in browsers, Node and edge workers.

### Develop

```bash
npm install
npm test        # TypeScript → dist/, unit tests, package/ build, package gate
```

## Privacy

The calculator runs in the browser. No server, no cookies, no storage, no tracking. The only request it makes is loading `data/ctr-curves.json` from the same origin.

## License

MIT, see [LICENSE](LICENSE). Data sources and demo fonts: [NOTICE.md](NOTICE.md).

## Author

Thorsten Litzki · [Litzki Systems](https://litzki-systems.com)

---

<a id="deutsch"></a>

# SEO-Prognose (Deutsch)

[English](#seo-forecast) · **Deutsch**

[![Lizenz: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Wie viele organische Klicks, Leads, Kunden und wie viel Gewinn bringt ein besseres Ranking? Die SEO-Prognose multipliziert **Ihr** Suchvolumen mit **veröffentlichten, belegten** Klickraten je Position und dem **gemessenen** Einfluss der Google AI Overviews, lässt das Ergebnis linear bis zum Zielmonat ansteigen und rechnet es mit Ihren eigenen Conversion-Zahlen durch den Business-Funnel bis zu Umsatz, Gewinn, ROI und Break-even. Jede verwendete Zahl steht mit Quelle neben dem Ergebnis.

## Gemessen statt geschätzt

Eine Prognose ist nie eine Messung. Dieses Werkzeug hält deshalb jede Eingabe nachvollziehbar:

- **Suchvolumen** kommt von Ihnen (Keyword-Tool, Search Console). Der Rechner schätzt es nie.
- **CTR-Kurven** sind unverändert übernommen, mit Quelle, Markt, Zeitraum und Methode: [Advanced Web Ranking](https://www.advancedwebranking.com/seo/organic-ctr), Google USA, Juli 2026. Nichts ist geglättet oder hochgerechnet. Positionen ohne veröffentlichte Daten zählen als 0 Klicks und werden gemeldet, nicht geraten.
- **AI Overviews** senken die CTR, gemessen von [Ahrefs](https://ahrefs.com/blog/ai-overviews-reduce-clicks-update/) (300.000 Keywords, Search-Console-Daten, Dezember 2025: Position 1 minus 58 %), oder es gilt die eigene AWR-Spalte für Suchergebnisse mit AI Overview.
- **Ihre eigene Kurve** schlägt jede Voreinstellung: Laden Sie Ihren Search-Console-Export der Suchanfragen, und das Werkzeug berechnet die CTR je Position aus Ihren Klicks und Impressionen.
- **Funnel-Zahlen sind Ihre.** Lead-Rate, Abschlussrate, Kundenwert, Marge und Investition kommen aus Ihrem GA4, CRM oder Ihrer Buchhaltung. Es gibt keine Branchen-Standardwerte; ohne Ihre Raten rechnet das Werkzeug nur Klicks und erfindet keinen Umsatz.
- **Keine versteckten Faktoren.** Branchenfaktoren, Branchen-Standardwerte und Aufschläge für Ads, Snippets, „KI-Sichtbarkeit“, Mobil oder Long-Tail aus früheren Fassungen sind entfallen, weil keine Quelle sie belegt. Marke und Länge der Suchanfrage sind wieder dabei, aber über veröffentlichte Kurven statt pauschaler Faktoren.

## Formel

```
Klicks pro Monat = Suchvolumen × CTR(Position) × AI-Overview-Faktor(Position)
Monat m          = Klicks heute + (Klicks im Ziel − Klicks heute) × min(m / Monate bis Ziel, 1)

Leads            = Klicks × Lead-Rate (je Keyword: Ihre Rate für seine Suchabsicht, falls angegeben)
Kunden           = Leads × Abschlussrate
Umsatz           = Kunden × Kundenwert
Rohertrag        = Umsatz × Marge
Reingewinn       = Rohertrag − Investition (monatlich, optional einmalig im 1. Monat)
ROI              = (Rohertrag kumuliert − Investition kumuliert) ÷ Investition kumuliert
```

Standardmäßig zählt der Funnel nur die **zusätzlichen** Klicks über den heutigen hinaus, also das, was die SEO-Arbeit bringt. Umschaltbar auf alle prognostizierten Klicks.

## Grenzen

- Veröffentlichte Kurven schwanken stark: Die Desktop-CTR für Position 1 lag bei AWR innerhalb eines Jahres zwischen 14,61 % und 45,57 %.
- Alle Voreinstellungen beschreiben Google USA. Vergleichbare öffentliche Daten je Position für Deutschland wurden nicht gefunden.
- Die Kurven mit und ohne Marke enthalten bereits Suchergebnisse mit AI Overviews; der zusätzliche Ahrefs-Abschlag kann einen Teil doppelt zählen. Ergebnisse für Keywords mit AI Overview sind eine vorsichtige Untergrenze.
- Dass eine Zielposition erreicht wird, ist Ihre Annahme, keine Vorhersage des Werkzeugs.

## Nutzung

```bash
python3 -m http.server 8000
# Deutsch:  http://localhost:8000/index.de.html
```

Einbindung in eine Website: Jeder Release-Tag (z. B. `v1.2.0`) enthält in `package/` drei fertige Dateien: `seo-forecast.js` (ES-Modul mit `mount(el, { lang })`), `seo-forecast.css` (Klassen mit Präfix `.fc-`, nur Design-Tokens der Seite) und `ctr-curves.json`. Läuft unter `script-src 'self'; style-src 'self'` ohne `unsafe-inline`. Details: [`docs/integration.md`](docs/integration.md).

Keyword-CSV mit den Spalten `keyword`, `suchvolumen`, `aktuelle_position` (leer = rankt nicht), `zielposition`, `ai_overview` (ja/nein), `suchintention` (info/kommerziell/transaktional), `marke` (ja/nein), getrennt durch Komma oder Semikolon. Eigene Kurve: In der Search Console unter *Leistung → Suchergebnisse* die Suchanfragen als CSV exportieren und `Queries.csv` laden.

Der Rechner läuft vollständig im Browser: kein Server, keine Cookies, kein Speicher, kein Tracking.

## Lizenz

MIT, siehe [LICENSE](LICENSE). Datenquellen und Demo-Schriften: [NOTICE.md](NOTICE.md).

## Autor

Thorsten Litzki · [Litzki Systems](https://litzki-systems.com)

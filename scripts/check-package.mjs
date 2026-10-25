// Gate for package/: the rules the host page (litzki-systems.com) relies on.
import { readFileSync } from 'node:fs';

const js = readFileSync('package/seo-forecast.js', 'utf8');
const css = readFileSync('package/seo-forecast.css', 'utf8');
const data = JSON.parse(readFileSync('package/ctr-curves.json', 'utf8'));
const errors = [];
const fail = (m) => errors.push(m);

// JavaScript: CSP style-src 'self' / script-src 'self', no storage, no foreign requests
if (/\bstyle\s*=\s*["'`]/.test(js) || /setAttribute\(\s*["']style["']/.test(js)) fail('JS writes a style attribute');
if (/<style/i.test(js)) fail('JS creates a <style> element');
if (/\binnerHTML\b|\bouterHTML\b|insertAdjacentHTML|document\.write/.test(js)) fail('JS writes HTML strings');
if (/\beval\(|new Function\(/.test(js)) fail('JS uses eval');
if (/localStorage|sessionStorage|indexedDB|document\.cookie/.test(js)) fail('JS uses storage or cookies');
const fetches = js.match(/fetch\(([^,)]*)/g) || [];
if (fetches.length !== 1) fail(`expected exactly one fetch, found ${fetches.length}`);
if (!/export\s*\{[^}]*\bmount\b/.test(js)) fail('mount is not exported');

// CSS: tokens only, fc- prefix, nothing below 14 px
const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
if (/#[0-9a-f]{3,8}\b/i.test(body) || /\b(rgb|rgba|hsl|hsla)\(/i.test(body)) fail('CSS contains its own colour values');
if (/@font-face|@import/.test(body)) fail('CSS loads fonts or other files');
for (const m of body.matchAll(/font-size:\s*([0-9.]+)(px|rem|em)/g)) {
  const px = m[2] === 'px' ? Number(m[1]) : Number(m[1]) * 16;
  if (px < 14) fail(`font-size below 14px: ${m[0]}`);
}
for (const m of body.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
  if (!/^fc(\b|-)/.test(m[1])) fail(`class without fc- prefix: .${m[1]}`);
}

// Data: every curve with source name, URL and year
for (const c of data.curves) {
  for (const [what, r] of [['ctr', c.source_ref], ['aio', c.aio && c.aio.source_ref]]) {
    if (!r || !r.name || !/^https:\/\//.test(r.url || '') || !Number.isInteger(r.year)) fail(`${c.id}: ${what} source_ref incomplete`);
  }
  if (!c.device) fail(`${c.id}: device missing`);
}

for (const [name, block] of [['aio_citation', data.aio_citation], ['industry_lead_rates', data.industry_lead_rates]]) {
  if (!block) continue;
  const r = block.source_ref;
  if (!r || !r.name || !/^https:\/\//.test(r.url || '') || !Number.isInteger(r.year)) fail(`${name}: source_ref incomplete`);
}

if (errors.length) {
  console.error('package check failed:\n- ' + [...new Set(errors)].join('\n- '));
  process.exit(1);
}
console.log('package check passed');

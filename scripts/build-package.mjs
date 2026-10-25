// Builds package/: seo-forecast.js (one ES module), seo-forecast.css, ctr-curves.json.
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
mkdirSync('package', { recursive: true });
await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  target: 'es2020',
  platform: 'browser',
  outfile: 'package/seo-forecast.js',
  legalComments: 'inline',
  banner: { js: `/*! seo-forecast ${pkg.version} · MIT License · https://github.com/litzki-systems/seo-forecast */` },
  logLevel: 'warning',
});
copyFileSync('css/seo-forecast.css', 'package/seo-forecast.css');
copyFileSync('data/ctr-curves.json', 'package/ctr-curves.json');
console.log(`package/ built for ${pkg.version}`);

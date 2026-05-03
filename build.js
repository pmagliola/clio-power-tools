// Build script — bundles background.js and its dependencies (including ExtPay)
// Run: node build.js
// Output: dist/background.js (loaded by Chrome instead of src/background.js)

import esbuild from 'esbuild';
import { mkdir, copyFile } from 'fs/promises';

await mkdir('dist', { recursive: true });

// Bundle background.js — includes ExtPay and config
await esbuild.build({
  entryPoints: ['src/background.js'],
  bundle: true,
  outfile: 'dist/background.js',
  format: 'esm',
  platform: 'browser',
  target: 'chrome114',
  alias: {
    'webextension-polyfill': './src/webextension-polyfill-stub.js',
  },
});

// Copy unbundled files that don't need bundling
const files = [
  'src/content.js',
  'src/popup.js',
  'src/popup.html',
  'src/timer.css',
];
for (const f of files) {
  await copyFile(f, `dist/${f.replace('src/', '')}`);
}

console.log('Build complete → dist/');

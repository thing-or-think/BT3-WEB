const fs = require('node:fs');
const path = require('node:path');
const base = process.env.ARENA_API_BASE_URL || '';
if (base && new URL(base).protocol !== 'https:') throw new Error('GitHub Pages requires an HTTPS backend URL.');
const target = path.resolve('.site-public');
fs.mkdirSync(target, { recursive: true });
// Explicit allowlist: demo data, account records and bot sources must not be published.
for (const name of ['index.html', 'styles', 'dist']) {
  fs.cpSync(path.join('client', name), path.join(target, name), { recursive: true });
}
fs.writeFileSync(path.join(target, 'config.js'), `window.ARENA_API_BASE_URL = ${JSON.stringify(base)};\n`);
fs.writeFileSync(path.join(target, '.nojekyll'), '');
console.log('GitHub Pages site prepared successfully for pure client-side / playhtml serverless CTF arena.');

// Controleert of geen enkel object uit PROPS in een gebouw of op de rijbaan
// staat. Gebruik: node tools/propcheck.mjs
import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 400, height: 300 } });
const w = [];
p.on('console', m => { const t=m.text(); if (t.startsWith('object ')) w.push(t); });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto('http://127.0.0.1:8123/index.html', { waitUntil: 'load' });
await p.waitForFunction(() => window.__game, null, { timeout: 90000 });
console.log(w.length ? w.join('\n') : 'alle objecten staan vrij');
await b.close();

// Test de objectstand van de editor.
import { chromium } from 'playwright';
const port = process.argv[2] || '8123';
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', e => console.log('[pageerror]', e.message));
p.on('console', m => { if (m.type()==='error' && !m.text().includes('404')) console.log('[fout]', m.text()); });
await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__game, null, { timeout: 90000 });
await p.evaluate(() => { localStorage.clear(); window.__autoplay = true; document.getElementById('overlay').style.display='none'; });
await p.waitForTimeout(800);

const props = () => p.evaluate(async () => (await import('./js/data.js')).PROPS.length);
const laatste = () => p.evaluate(async () => { const {PROPS}=await import('./js/data.js'); const q=PROPS[PROPS.length-1]; return q && {type:q.type, at:q.at.map(Math.round), yaw:q.yaw, scale:+(q.scale||1).toFixed(2)}; });

console.log('objecten bij start:', await props());
await p.keyboard.press('F2'); await p.waitForTimeout(400);
await p.keyboard.press('KeyO'); await p.waitForTimeout(400);
console.log('paneel:', (await p.evaluate(() => document.getElementById('editor').textContent.slice(0,40))).replace(/\s+/g,' '));

// camera op een leeg stuk gras zetten en een carport neerzetten
await p.evaluate(() => { const g=window.__game; g.player.pos.set((470-370)/3.26, 9, (1330-1245)/3.26); g.player.yaw=1.1; g.player.pitch=-0.35; });
await p.waitForTimeout(1800);
const n0 = await props();
await p.keyboard.press('Enter'); await p.waitForTimeout(2600);
console.log('na Enter:', n0, '->', await props(), JSON.stringify(await laatste()));

// palet doorbladeren en nog een object
for (let i=0;i<3;i++){ await p.keyboard.press('PageDown'); await p.waitForTimeout(150); }
await p.keyboard.press('Enter'); await p.waitForTimeout(2600);
console.log('tweede object:', JSON.stringify(await laatste()));

// naar groep 4 (spelen) en plaatsen
await p.keyboard.press('Digit4'); await p.waitForTimeout(200);
await p.keyboard.press('Enter'); await p.waitForTimeout(2600);
console.log('uit groep spelen:', JSON.stringify(await laatste()));

// verzetten, draaien, schalen
await p.keyboard.down('Shift'); for(let i=0;i<3;i++){ await p.keyboard.press('ArrowRight'); await p.waitForTimeout(120);} await p.keyboard.up('Shift');
await p.keyboard.press('Period'); await p.keyboard.press('Period');
await p.keyboard.down('Shift'); await p.keyboard.press('Equal'); await p.keyboard.up('Shift');
await p.waitForTimeout(2800);
console.log('na bewerken:  ', JSON.stringify(await laatste()));
await p.screenshot({ path: 'shots/prop_bewerkt.png' });

// ongedaan
for (let i=0;i<6;i++){ await p.keyboard.press('Control+z'); await p.waitForTimeout(700); }
await p.waitForTimeout(1200);
console.log('na 6x Ctrl+Z:', await props(), 'objecten');

// export bevat PROPS
const t = await p.evaluate(async () => (await import('./js/editor.js')).rijenAlsBestand());
console.log('export heeft PROPS:', t.includes('export const PROPS'), '· regels P(:', (t.match(/^\s+P\(/gm)||[]).length);
console.log(t.split('\n').filter(l=>l.trim().startsWith('P(')).slice(0,3).join('\n'));

// terug naar rijen
await p.keyboard.press('KeyO'); await p.waitForTimeout(400);
console.log('terug in rijenstand:', (await p.evaluate(() => document.getElementById('editor').textContent.slice(0,42))).replace(/\s+/g,' '));
await p.evaluate(() => localStorage.clear());
await b.close();

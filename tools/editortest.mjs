// Test de wijkeditor: selecteren, verplaatsen, type wisselen, toevoegen,
// verwijderen, ongedaan maken en exporteren.
// Gebruik: node tools/editortest.mjs [poort]
import { chromium } from 'playwright';

const port = process.argv[2] || '8123';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('[fout]', m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 90000 });
await page.evaluate(() => { window.__autoplay = true; document.getElementById('overlay').style.display = 'none'; });
await page.waitForTimeout(800);

const rijen = () => page.evaluate(async () => (await import('./js/data.js')).ROWS.length);
const rij = i => page.evaluate(async (i) => {
  const { ROWS } = await import('./js/data.js');
  const r = ROWS[i]; return r && { a: r.a.map(Math.round), b: r.b.map(Math.round), off: r.off, type: r.type, depth: r.depth };
}, i);

console.log('rijen bij start:', await rijen());

// editor aan
await page.keyboard.press('F2');
await page.waitForTimeout(300);
console.log('editor actief:', await page.evaluate(() => window.__game.editor.actief),
  '· paneel:', await page.evaluate(() => getComputedStyle(document.getElementById('editor')).display));
console.log('vrije camera:', await page.evaluate(() => window.__game.player.fly));

// rij 60 selecteren via Tab-cyclus (deterministisch)
await page.evaluate(() => { window.__game.editor.zet(true); });
for (let i = 0; i <= 60; i++) await page.keyboard.press('Tab');
await page.waitForTimeout(1200);
const gekozen = await page.evaluate(() => document.getElementById('editor').textContent.match(/rij (\d+)/)[1]);
console.log('geselecteerd:', gekozen);

const voor = await rij(Number(gekozen));
console.log('voor:', JSON.stringify(voor));

// verschuiven, draaien, verder van de weg, ander type
await page.keyboard.down('Shift');
for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');   // 4 x 5 px
await page.keyboard.up('Shift');
await page.keyboard.press('BracketRight');                              // 1 graad
await page.keyboard.press('Period');                                    // +0,5 m
await page.keyboard.press('KeyT');                                      // volgend type
await page.waitForTimeout(2500);
const na = await rij(Number(gekozen));
console.log('na:  ', JSON.stringify(na));
console.log('verschoven x:', na.a[0] - voor.a[0], 'px · off', voor.off, '->', na.off, '· type', voor.type, '->', na.type);
await page.screenshot({ path: 'shots/ed_bewerkt.png' });

// nieuwe rij en weer weg
const n0 = await rijen();
await page.keyboard.press('KeyN');
await page.waitForTimeout(2500);
const n1 = await rijen();
await page.keyboard.press('Delete');
await page.waitForTimeout(2500);
const n2 = await rijen();
console.log('rijen na N:', n1, '(was', n0 + ') · na Delete:', n2);

// ongedaan maken: eerst het verwijderen en toevoegen, dan de zes bewerkingen
for (let i = 0; i < 8; i++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(900); }
await page.waitForTimeout(1500);
const terug = await rij(Number(gekozen));
console.log('na 8x Ctrl+Z:', JSON.stringify(terug), '· rijen', await rijen());
console.log('terug bij af:', JSON.stringify(terug) === JSON.stringify(voor));

// export
const uit = await page.evaluate(async () => {
  const m = await import('./js/editor.js');
  const t = m.rijenAlsBestand();
  return { lengte: t.length, kop: t.split('\n').slice(0, 6).join('\n'), regel: t.split('\n').find(l => l.trim().startsWith('R(')) };
});
console.log('--- export ---');
console.log(uit.kop);
console.log(uit.regel);
console.log('lengte', uit.lengte, 'tekens');

// opslag in de browser
console.log('localStorage gevuld:', await page.evaluate(() => !!localStorage.getItem('tinga.rows.v1')));

// editor uit, spel weer normaal
await page.keyboard.press('F2');
await page.waitForTimeout(500);
console.log('editor uit:', !(await page.evaluate(() => window.__game.editor.actief)),
  '· vliegen uit:', !(await page.evaluate(() => window.__game.player.fly)));
console.log('render', await page.evaluate(() => ({ calls: window.__game.renderer.info.render.calls, tris: window.__game.renderer.info.render.triangles })));
await browser.close();

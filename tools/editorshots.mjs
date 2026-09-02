// Maakt een reeks screenshots die laat zien hoe de wijkeditor werkt.
// Gebruik: node tools/editorshots.mjs [poort]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const uit = 'shots/editor';
mkdirSync(uit, { recursive: true });

const PX = 3.26, OX = 370, OY = 1245;
const zet = (page, px, py, y, yaw, pitch) => page.evaluate(({ px, py, y, yaw, pitch, PX, OX, OY }) => {
  const g = window.__game;
  g.player.pos.set((px - OX) / PX, y, (py - OY) / PX);
  g.player.yaw = yaw; g.player.pitch = pitch;
}, { px, py, y, yaw, pitch, PX, OX, OY });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 90000 });
await page.evaluate(() => { localStorage.clear(); window.__autoplay = true; document.getElementById('overlay').style.display = 'none'; });
await page.waitForTimeout(900);

const schot = async (naam, wacht = 700) => { await page.waitForTimeout(wacht); await page.screenshot({ path: `${uit}/${naam}.png` }); console.log('  ', naam); };

// 1 – gewoon spelen, de Molenkrite in
await zet(page, 405, 1222, 0, -0.88, 0.0);
await schot('01_spel');

// 2 – F2: editor aan, vrije camera boven de straat
await page.keyboard.press('F2');
await page.waitForTimeout(400);
await zet(page, 398, 1235, 17, -0.86, -0.42);
await schot('02_editor_aan', 1200);

// 3 – vizier op een rij en klikken (de zonnepanelenkant van de Molenkrite)
await zet(page, 420, 1230, 12, -0.22, -0.26);
await page.waitForTimeout(1800);          // camera eerst laten aankomen
await page.mouse.click(640, 380);
await schot('03_rij_gekozen', 900);

const staat = async () => page.evaluate(() => {
  const t = document.getElementById('editor').textContent;
  return (t.match(/rij (\d+)/) || [])[1] + ' | ' + (t.match(/afstand tot wegas ([\d.]+) m/) || [])[1] + ' m';
});
console.log('  geselecteerd:', await staat());

// 4 – verder van de weg zetten met de punt-toets
for (let i = 0; i < 8; i++) { await page.keyboard.press('Period'); await page.waitForTimeout(120); }
await schot('04_verder_van_de_weg', 2600);
console.log('  na verzetten:', await staat());

// 5 – ander woningtype
for (let i = 0; i < 3; i++) { await page.keyboard.press('KeyT'); await page.waitForTimeout(120); }
await schot('05_ander_type', 2600);

// 6 – ongedaan maken, terug naar hoe het was
for (let i = 0; i < 12; i++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(200); }
await schot('06_ongedaan', 2600);
console.log('  na ongedaan maken:', await staat());

// 7 – nieuwe rij neerzetten op een leeg stuk gras
await zet(page, 470, 1330, 12, 1.10, -0.30);
await page.waitForTimeout(1800);
await page.keyboard.press('KeyN');
await page.waitForTimeout(2600);
// even naar achteren voor het plaatje, zodat de nieuwe rij vrij staat
await zet(page, 560, 1420, 22, 0.97, -0.19);
await schot('07_nieuwe_rij', 2200);
console.log('  nieuwe rij:', await staat());

// 8 – opslaan
await page.keyboard.press('Control+s');
await schot('08_opslaan', 1200);

// weer schoon achterlaten
await page.evaluate(() => localStorage.clear());
console.log('klaar');
await browser.close();

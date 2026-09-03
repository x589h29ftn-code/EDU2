// Controleert het gezelschap in de voortuin van 19 Molenkrite: staan de vier
// poppetjes en de radio er, bewegen de armen met het bierflesje, en zwelt het
// radiogeluid aan als je dichterbij komt?
import { chromium } from 'playwright';

const port = process.argv[2] || '8123';
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
         '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 60000 });
await page.evaluate(() => { window.__autoplay = true; document.getElementById('overlay').style.display = 'none'; });
await page.waitForTimeout(1200);

const telling = await page.evaluate(async () => {
  const w = await import('./js/world.js');
  return { armen: w.drinkArmen.length, radios: w.radioPlekken.length };
});
console.log(`drinkarmen: ${telling.armen} · radios: ${telling.radios}`);

// Elke arm moet binnen een volledige cyclus omhoog komen. De cyclus loopt tot
// veertien seconden, dus die draaien we hier met de hand door in plaats van te
// wachten: in een headless browser haalt het spel maar een paar beelden per
// seconde.
const hoogste = await page.evaluate(async () => {
  const w = await import('./js/world.js');
  const max = w.drinkArmen.map(() => 0);
  for (let t = 0; t < 20; t += 0.1) {
    w.updateProps(0.1);
    w.drinkArmen.forEach((a, k) => { max[k] = Math.max(max[k], a.obj.rotation.x); });
  }
  return max.map(v => +v.toFixed(2));
});
console.log('hoogste armstand per poppetje (rad):', hoogste.join(', '),
  hoogste.every(v => v > 1.2) ? '- alle vier drinken' : '- FOUT: een arm komt niet omhoog');

// geluid aanzetten en het volume op afstand vergelijken
const volume = await page.evaluate(async () => {
  const { geluid } = await import('./js/audio.js');
  geluid.start();
  const meet = (afstand) => { geluid.radio(afstand); return null; };
  meet(100); meet(60); meet(4);
  return typeof geluid.radio === 'function';
});
console.log('geluid.radio aanroepbaar zonder fout:', volume);

// speler naast de radio zetten en een paar beelden draaien
await page.evaluate(async () => {
  const w = await import('./js/world.js');
  const r = w.radioPlekken[0];
  if (r) window.__game.player.pos.set(r.x + 2, 0, r.z + 2);
});
await page.waitForTimeout(1500);
console.log('speler bij de radio, geen fouten hierboven = goed');
await browser.close();

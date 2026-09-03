// Fotografeert elk object uit js/props.js apart op een leeg veld.
// Levert shots/props/<naam>.png en een overzichtsblad per groep.
// Gebruik: node tools/propshots.mjs [poort]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const port = process.argv[2] || '8123';
const uit = 'shots/props';
mkdirSync(uit, { recursive: true });
const PLEK = [2400, 800];   // leeg veld ver ten oosten van de wijk

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 560 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 90000 });
await page.evaluate(() => {
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('ui').style.display = 'none';
});
await page.waitForTimeout(600);

const lijst = await page.evaluate(async () => {
  const { PROP_TYPES } = await import('./js/props.js');
  return Object.values(PROP_TYPES).map(d => ({ naam: d.naam, label: d.label, groep: d.groep, maat: d.maat, h: d.h }));
});
console.log(`${lijst.length} objecten`);

// alleen dit ene object bouwen, geen huizen
await page.evaluate(async () => {
  const { ROWS, PROPS } = await import('./js/data.js');
  window.__rijen = ROWS.slice(); window.__props = PROPS.slice();
  ROWS.length = 0;
});

for (const it of lijst) {
  await page.evaluate(async ({ it, PLEK }) => {
    const { PROPS, toWorld } = await import('./js/data.js');
    const w = await import('./js/world.js');
    const g = window.__game;
    PROPS.length = 0;
    PROPS.push({ src: 0, type: it.naam, at: [PLEK[0], PLEK[1]], yaw: 25, scale: 1 });
    w.resetWorld(g.scene); w.buildWorld(g.scene);

    const [cx, cz] = toWorld(PLEK[0], PLEK[1]);
    // afstand naar de grootste maat van het object, zodat alles even groot lijkt
    const grootte = Math.max(it.maat[0], it.maat[1], it.h);
    const afstand = 2.8 + grootte * 1.3;
    const hoogte = Math.max(1.0, it.h * 0.75);
    // objecten kijken naar -Z, dus de camera staat aan die kant
    g.player.fly = true;
    g.player.pos.set(cx + afstand * 0.55, hoogte, cz - afstand * 0.84);
    g.player.yaw = Math.atan2(afstand * 0.55, -afstand * 0.84);
    g.player.pitch = Math.atan2(it.h * 0.45 - hoogte, afstand);
    g.camera.fov = 45; g.camera.updateProjectionMatrix();
    g.scene.traverse(o => { if (o.isMesh && o.material && o.material.type === 'ShaderMaterial') o.position.copy(g.player.pos); });
  }, { it, PLEK });
  await page.waitForTimeout(650);
  await page.screenshot({ path: `${uit}/${it.naam}.png` });
  console.log('  ', it.naam.padEnd(16), it.groep.padEnd(8), it.label);
}

// wereld terugzetten
await page.evaluate(async () => {
  const { ROWS, PROPS } = await import('./js/data.js');
  const w = await import('./js/world.js');
  ROWS.length = 0; window.__rijen.forEach(r => ROWS.push(r));
  PROPS.length = 0; window.__props.forEach(r => PROPS.push(r));
  window.__game.camera.fov = 72; window.__game.camera.updateProjectionMatrix();
  w.resetWorld(window.__game.scene); w.buildWorld(window.__game.scene);
});
// lijstje meeschrijven, zodat tools/contactblad.py het overzicht kan plakken
writeFileSync(`${uit}/lijst.json`, JSON.stringify(lijst.map(l => [l.groep, l.naam, l.label]), null, 1));
console.log(JSON.stringify(lijst.map(l => [l.groep, l.naam, l.label])));
await browser.close();

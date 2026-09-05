/*
 Foto's van het rijden: de auto van dichtbij, de camera achter de auto, de
 camera achter jezelf te voet, en een aangereden voetganger.

 Gebruik: python3 -m http.server 8123 &  node tools/rijshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  window.__rij = (n, keys = {}, dt = 1 / 30) => {
    const p = g.player;
    for (let i = 0; i < n; i++) {
      Object.assign(p.keys, keys);
      if (p.inCar) {
        g.vehicles.drive(p.inCar, p.keys, dt, g.aanrijden);
        if (p.lastCarYaw !== undefined) p.yaw += p.inCar.yaw - p.lastCarYaw;
        p.lastCarYaw = p.inCar.yaw;
      }
      g.npcs.update(dt, 0);
      g.derde.update(dt, p.inCar || null);
    }
    for (const k of Object.keys(keys)) p.keys[k] = false;
  };
  window.__stil = () => { g.hud.msgT = 0; g.hud.msg.style.opacity = 0; };
});
await page.waitForTimeout(1500);

const foto = async (naam) => {
  await page.evaluate(() => window.__stil());
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${map}/${naam}.png` });
  console.log(`${map}/${naam}.png`);
};

// een auto op een recht stuk Molenkrite
const plek = await page.evaluate(async () => {
  const { KAART } = await import('./js/kaart.js');
  const g = window.__game;
  // een recht stuk Molenkrite midden in de wijk, bij het huis van Mark
  const huis = KAART.panden.find(q => q.straat === 'Molenkrite' && (q.nr || []).includes('15'));
  const assen = KAART.wegassen.filter(w => w.drive && w.naam === 'Molenkrite' && w.lengte > 45);
  const as = assen.sort((p1, p2) => {
    const d = (w) => Math.hypot(w.pts[0][0] - huis.rect.cx, w.pts[0][1] - huis.rect.cz);
    return d(p1) - d(p2);
  })[0];
  const a = as.pts[0], b = as.pts[as.pts.length - 1];
  const yaw = Math.atan2(-(b[0] - a[0]), -(b[1] - a[1]));
  const auto = g.vehicles.voegToe({ x: a[0], z: a[1], yaw, soort: 'hatch', kleur: 0x9c1f1f });
  window.__auto = auto;
  g.player.inCar = auto; g.player.lastCarYaw = auto.yaw;
  g.player.pos.set(a[0], 0, a[1]);
  return { x: a[0], z: a[1], yaw };
});

// 1. de auto van dichtbij, schuin van voren
await page.evaluate((p) => {
  const g = window.__game;
  g.player.inCar = null;
  g.derde.aan = false;
  const r = 6.4, hoek = p.yaw + 0.85;
  g.player.pos.set(p.x - Math.sin(hoek) * r, 0, p.z - Math.cos(hoek) * r);
  g.player.yaw = Math.atan2(-(p.x - g.player.pos.x), -(p.z - g.player.pos.z));
  g.player.pitch = -0.07;
  g.player.applyCamera();
}, plek);
await foto('auto_model');

// 2. rijden met de camera achter de auto
await page.evaluate((p) => {
  const g = window.__game;
  const c = window.__auto;
  c.x = p.x; c.z = p.z; c.yaw = p.yaw; c.rij = p.yaw; c.speed = 0;
  g.player.inCar = c; g.player.lastCarYaw = c.yaw;
  g.derde.aan = true; g.derde.achterAuto(c);
  window.__rij(70, { KeyW: true });
}, plek);
await foto('auto_derdepersoon');

// 3. te voet met de camera over de schouder
await page.evaluate(() => {
  const g = window.__game;
  const c = window.__auto;
  g.player.inCar = null; g.player.lastCarYaw = undefined;
  g.player.pos.set(c.x - 3.2, 0, c.z - 3.2);
  g.player.yaw = c.yaw; g.player.pitch = -0.05;
  window.__rij(50);
});
await foto('lopen_derdepersoon');

// 4. een voetganger aanrijden — de dichtstbijzijnde wandelaar in de wijk
const raak = await page.evaluate((plek) => {
  const g = window.__game;
  const c = window.__auto;
  const wandelaars = g.npcs.people
    .filter(q => q.alive && !q.fietst)
    .sort((a, b) => Math.hypot(a.x - plek.x, a.z - plek.z) - Math.hypot(b.x - plek.x, b.z - plek.z));
  const p = wandelaars[0];
  const afstand = 8.5;
  const yaw = Math.atan2(-(p.x - c.x), -(p.z - c.z));
  c.x = p.x + Math.sin(yaw) * afstand; c.z = p.z + Math.cos(yaw) * afstand;
  c.yaw = Math.atan2(-(p.x - c.x), -(p.z - c.z)); c.rij = c.yaw; c.speed = 10;
  g.player.inCar = c; g.player.lastCarYaw = c.yaw;
  g.player.pos.set(c.x, 0, c.z);
  g.derde.achterAuto(c);
  // rijden tot er iemand neergaat, dan nog even doorrollen zodat hij ligt
  g.hud.msg.style.transition = 'none';
  let frames = 0;
  while (p.alive && frames < 60) { window.__rij(1, { KeyW: true }); frames++; }
  window.__rij(5, { KeyW: false });
  // in headless loopt de klok op beelden, dus de melding zelf even vasthouden
  g.hud.msgT = 3; g.hud.msg.style.opacity = 1;
  return { geraakt: !p.alive, frames };
}, plek);
console.log('aanrijden:', JSON.stringify(raak));
await page.waitForTimeout(700);
await page.screenshot({ path: `${map}/aangereden.png` });
console.log(`${map}/aangereden.png`);

await browser.close();

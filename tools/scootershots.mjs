/*
 Foto's van stap 138: de rijder op de scooter van de pizzabaan, zoals op de foto van de gebruiker.

   scooter_rijder.png       schuin van voren, zoals de foto die erom vroeg
   scooter_rijder_zij.png   van opzij: billen op het zadel, voeten op de plank, handen om het stuur

 Gebruik: npm run server &   node tools/scootershots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

await page.evaluate(async () => {
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  await g.reliëfAf();
  window.__autoplay = false; g.player.active = false;
  g.sfeer.weer = 'helder';
  g.sfeer.uur = 14;
  const P = g.pizzabaan, car = P.scooters[0];
  const zp = car.mesh.userData.zitPlek;
  zp.add(P.rijder.groep); P.rijder.groep.visible = true;
  P.rijder.opScooter(0.05, zp.position);
  window.__scooter = car;
});

const foto = async (naam, hoek, afstand, hoogte) => {
  await page.evaluate(async ({ hoek, afstand, hoogte }) => {
    const W = await import('/js/world.js');
    const g = window.__game, pl = g.player, c = window.__scooter;
    const m = c.mesh.position, yaw = c.mesh.rotation.y;
    // hoek 0 = recht van voren (de voorkant is −z van de scooter)
    const a = yaw + hoek;
    const x = m.x - Math.sin(a) * afstand, z = m.z - Math.cos(a) * afstand;
    const y = m.y + hoogte;
    pl.inCar = null; pl.zit = false; pl.fly = false;
    pl.wapenUit = true; if (pl.gun) pl.gun.visible = false;
    pl.pos.set(x, y - pl.eye, z);
    pl.yaw = Math.atan2(-(m.x - x), -(m.z - z));
    pl.pitch = Math.atan2(m.y + 0.85 - y, Math.hypot(m.x - x, m.z - z));
    pl.applyCamera();
    W.updateLOD(x, z); g.vehicles.lod(x, z);
    if (g.grasVeld) g.grasVeld.update(x, z, true);
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    document.getElementById('dialoog').hidden = true;
    const h = document.getElementById('hint'); if (h) { h.textContent = ''; h.style.visibility = 'hidden'; }
    const u = document.getElementById('uitleg'); if (u) u.style.visibility = 'hidden';
    if (g.renderer && g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
  }, { hoek, afstand, hoogte });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};

await foto('scooter_rijder', 0.95, 3.6, 1.7);
await foto('scooter_rijder_zij', Math.PI / 2, 3.0, 1.1);
await browser.close();
console.log('EINDE');

/*
 Foto's van missie 18, de avond (stap 109):

   avond_deur.png      uit de deur van de heli: de buitencamera boven Tinga, het zoeklicht op de
                       auto van Bouwman
   avond_heli.png      de heli van opzij: Erik in de open deur, Wiebe voorin
   avond_landing.png   geland bij het Autohuis: de zwarte Ferrari, Mark en Johan ernaast
   avond_loods.png     het vuurgevecht bij de loods: Bouwman en zijn mannen, Mark en Johan
   avond_brug.png      het filmbeeld op de Dúvelsrak: de knal achter de auto, de politie ervoor

 Gebruik: npm run server &   node tools/avondshots.mjs 8123 [map]
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

const foto = async (naam, { wacht = 1500 } = {}) => {
  await page.evaluate(() => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    g.hud.missieT = 0; g.hud.missieEl.style.transition = 'none'; g.hud.missieEl.style.opacity = 0;
    document.getElementById('dialoog').hidden = true;
    document.getElementById('praat').hidden = true;
    document.getElementById('schaduwbalk').hidden = true;
    const h = document.getElementById('hint'); if (h) { h.textContent = ''; h.style.visibility = 'hidden'; }
    const u = document.getElementById('uitleg'); if (u) u.style.visibility = 'hidden';
    if (g.renderer && g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
  });
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};
const bevries = () => page.evaluate(() => {
  const v = window.__game.verhaal;
  if (!v.__echteUpdate) { v.__echteUpdate = v.update; v.update = () => {}; }
});
const ontdooi = () => page.evaluate(() => {
  const v = window.__game.verhaal;
  if (v.__echteUpdate) { v.update = v.__echteUpdate; v.__echteUpdate = null; }
});
// de camera op (x, y, z), kijkend naar (kx, ky, kz), via de speler
const kamera = (x, y, z, kx, ky, kz) => page.evaluate(async ({ x, y, z, kx, ky, kz }) => {
  const W = await import('/js/world.js');
  const g = window.__game, pl = g.player;
  window.__autoplay = false; pl.active = false;
  pl.inCar = null; pl.zit = false; pl.fly = false;
  pl.wapenUit = true; if (pl.gun) pl.gun.visible = false;
  pl.pos.set(x, y - pl.eye, z);
  pl.yaw = Math.atan2(-(kx - x), -(kz - z));
  pl.pitch = Math.atan2(ky - y, Math.hypot(kx - x, kz - z));
  pl.applyCamera();
  W.updateLOD(x, z); g.vehicles.lod(x, z);
  if (g.grasVeld) g.grasVeld.update(x, z, true);
}, { x, y, z, kx, ky, kz });
const filmFoto = async (naam, film = false) => {
  const c = await page.evaluate(() => { const c = window.__game.verhaal.avond.filmCam; return c; });
  await bevries();
  if (c) await kamera(c.pos[0], c.pos[1], c.pos[2], c.kijk[0], c.kijk[1], c.kijk[2]);
  if (film) await page.evaluate(() => document.body.classList.add('film'));
  await foto(naam);
  await page.evaluate(() => document.body.classList.remove('film'));
  await ontdooi();
};

await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.reliëfAf();
  window.__autoplay = false; g.player.active = false;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; (v.__echteUpdate || v.update).call(v, dt); } };
  window.__klik = (max = 60) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__bij = (fase) => {
    const s = v.bewaar(); s.missie = 'uitzending'; s.fase = fase;
    Object.assign(s, { schaduwKlaar: true, raceKlaar: true, brugKlaar: true, schriftKlaar: true, invalKlaar: true, invalKeus: 2,
      ronaldKlaar: true, ronaldPraatte: true, uitzendingKlaar: false });
    g.politie.reset();
    v.herstel(s);
    window.__stap(2);
  };
  g.sfeer.weer = 'helder';
  window.__bij('heliStart');
  window.__klik();
  // een flink stuk de rit in, met de blik op de auto
  for (let t = 0; t < 60 && !(v.avond.rit && v.avond.rit.s > 420); t += 0.1) window.__stap(1, 0.1);
  const r = v.avond.rit, c = v.avond.filmCam;
  if (r && c) {
    const dx = r.x - c.pos[0], dz = r.z - c.pos[2], dy = 0.5 - c.pos[1];
    g.player.yaw = Math.atan2(-dx, -dz); g.player.pitch = Math.atan2(dy, Math.hypot(dx, dz)) + 0.12;
  }
  window.__stap(2, 0.05);
});
await filmFoto('avond_deur');

// ------------------------------------------------------ de heli van opzij
{
  const p = await page.evaluate(() => {
    const h = window.__game.verhaal.avond.heli, n = h.deurNormaal(), P = h.pos;
    // links voor de deur, iets lager, schuin van voren
    const fx = -Math.sin(h.yaw), fz = -Math.cos(h.yaw);
    return { x: P.x + n.x * 13 + fx * 7, y: P.y - 1.5, z: P.z + n.z * 13 + fz * 7, kx: P.x, ky: P.y - 0.3, kz: P.z };
  });
  await bevries();
  await kamera(p.x, p.y, p.z, p.kx, p.ky, p.kz);
  await foto('avond_heli');
  await ontdooi();
}

// ------------------------------------------------------ geland bij het Autohuis
{
  const p = await page.evaluate(() => {
    const g = window.__game, v = g.verhaal;
    for (let t = 0; t < 200 && v.fase !== 'naarAuto'; t += 0.1) { window.__stap(1, 0.1); if (!document.getElementById('dialoog').hidden) v.toets(); }
    window.__stap(10);
    const a = v.avond, auto = a.auto, h = a.heli.pos;
    const dx = auto.x - h.x, dz = auto.z - h.z, d = Math.hypot(dx, dz) || 1;
    // achter de heli, aan de kant weg van de showroom (die staat achter de auto), iets opzij
    return { x: h.x - dx / d * 13 - dz / d * 5, y: 3.6, z: h.z - dz / d * 13 + dx / d * 5, kx: (auto.x + h.x) / 2 + dx / d * 2, ky: 1.2, kz: (auto.z + h.z) / 2 + dz / d * 2 };
  });
  await bevries();
  await kamera(p.x, p.y, p.z, p.kx, p.ky, p.kz);
  await foto('avond_landing');
  await ontdooi();
}

// ------------------------------------------------------ het vuurgevecht bij de loods
{
  const p = await page.evaluate(() => {
    const g = window.__game, v = g.verhaal, P = g.player;
    window.__klik();
    P.inCar = v.avond.auto;
    window.__stap(2);
    for (let t = 0; t < 200 && v.fase === 'achtervolging'; t += 0.1) {
      const r = v.avond.rit, a = v.avond.auto;
      if (r) { const j = Math.max(0, v.avond.B.n - 1); a.x = r.x; a.z = r.z; P.pos.set(r.x, 0, r.z); }
      window.__stap(1, 0.1);
      if (!document.getElementById('dialoog').hidden) v.toets();
    }
    window.__klik();
    const lo = v.schaduw.wereld.bouwmanStaat, a = v.avond.auto;
    // de auto een eindje voor de loods, uitstappen
    a.x = lo.x - 20; a.z = lo.z - 14; a.speed = 0;
    if (a.mesh) a.mesh.position.set(a.x, 0, a.z);
    g.vehicles.zetNeer(a, 0, a.yaw);
    P.inCar = null; P.pos.set(a.x - 2, 0, a.z - 3);
    for (let i = 0; i < 70; i++) window.__stap(1);
    const m = v.avond.mark.groep.position;
    return { x: a.x - 6, y: 2.1, z: a.z - 7, kx: lo.x, ky: 1.2, kz: lo.z };
  });
  await bevries();
  await kamera(p.x, p.y, p.z, p.kx, p.ky, p.kz);
  await foto('avond_loods');
  await ontdooi();
}

// ------------------------------------------------------ de Dúvelsrak
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__bij('politie');
  window.__klik();
  const a = v.avond, br = a.brugAssen, auto = a.auto;
  const p = br.p(4, 0);
  auto.yaw = br.noord; auto.x = p.x; auto.z = p.z; auto.speed = 17;
  if (auto.mesh) { auto.mesh.visible = true; auto.mesh.position.set(p.x, br.hoogte, p.z); auto.mesh.rotation.y = br.noord; }
  P.inCar = auto;
  window.__stap(1);
  for (let i = 0; i < 400 && v.fase === 'brugFilm' && v.avond.brug && v.avond.brug.t < 2.35; i++) window.__stap(1);
});
await filmFoto('avond_brug', true);

await browser.close();

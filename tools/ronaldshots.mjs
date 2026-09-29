/*
 Foto's van missie 17, Wie is R. (stap 103):

   ronald_plan.png        binnen aan de Wieken 29: Mark op de bank, Johan bij de tafel
   ronald_erf.png         het erf om één uur: de caravan, de gele kegel van de camera, de hond
   ronald_koplampen.png   het filmbeeld vanuit de deur van de caravan: Ronald rijdt de oprit op
   ronald_geweer.png      het filmbeeld: Ronald met zijn jachtgeweer
   ronald_gevecht.png     gezien: drie auto's op de oprit en de weg, de mannen van Bouwman
   ronald_loods.png       het filmbeeld aan het water: Bouwman belt Ronald

 Gebruik: npm run server &   node tools/ronaldshots.mjs 8123 [map]
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
// de camera op (x, y, z), kijkend naar (kx, ky, kz): via de speler, zoals in tools/invalshots.mjs
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
const filmFoto = async (naam) => {
  const c = await page.evaluate(() => { const c = window.__game.verhaal.ronald.filmCam || window.__cam; window.__cam = null; return c; });
  await bevries();
  if (c) await kamera(c.pos[0], c.pos[1], c.pos[2], c.kijk[0], c.kijk[1], c.kijk[2]);
  await page.evaluate(() => document.body.classList.add('film'));
  await foto(naam);
  await ontdooi();
};

await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.reliëfAf();
  window.__autoplay = false; g.player.active = false;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; (v.__echteUpdate || v.update).call(v, dt); if (v.ronald.filmCam) window.__cam = v.ronald.filmCam; } };
  window.__klik = (max = 80) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__zet = (x, z, y = 0) => { if (g.player.inCar) { g.player.inCar.speed = 0; g.player.inCar = null; } g.player.pos.set(x, y, z); g.player.applyCamera(); };
  window.__opFase = (fase, extra = {}) => {
    const s = v.bewaar(); s.missie = 'ronald'; s.fase = fase;
    Object.assign(s, { invalKlaar: true, ronaldKlaar: false, ronaldPraatte: false, ronaldWeg: false, ronaldSchrift: false, erfHeeftWorst: false }, extra);
    g.politie.reset();
    v.herstel(s);
  };
  g.sfeer.weer = 'helder'; g.sfeer.uur = 10;
  const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null; s.invalKlaar = true; s.invalKeus = 2; s.invalTelefoon = true;
  v.herstel(s);
  v.startMissie('ronald');
  window.__stap(40); window.__klik();
  const w = g.woningen[1], d = w.plekken.deurBinnen;
  window.__zet(d.x, d.z); window.__stap(4);
});
// ------------------------------------------------------ binnen bij de Wieken
{
  const p = await page.evaluate(() => {
    const g = window.__game, v = g.verhaal, w = g.woningen[1];
    const m = v.mark.groep.position, j = v.ronald.johan.groep.position;
    // vanaf de keuken, over de tafel naar de bank
    const k = w.plekken.koelkast || w.plekken.tafel;
    const dx = k.x - m.x, dz = k.z - m.z, L = Math.hypot(dx, dz) || 1;
    const d = { x: m.x + dx / L * Math.min(L, 4.2), z: m.z + dz / L * Math.min(L, 4.2) };
    return { d, m: { x: m.x, z: m.z }, j: { x: j.x, z: j.z } };
  });
  await bevries();
  const kx = (p.m.x + p.j.x) / 2, kz = (p.m.z + p.j.z) / 2;
  await kamera(p.d.x, 1.6, p.d.z, kx, 0.9, kz);
  await foto('ronald_plan');
  await ontdooi();
}

// ------------------------------------------------------ het erf om één uur
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__klik();
  window.__opFase('sluipen');
  window.__stap(4); window.__klik();
  // de kegel zo gedraaid dat hij over de oprit ligt
  v.ronald.erf.t = 5.0;
});
{
  const p = await page.evaluate(() => {
    const E = window.__game.verhaal.ronald.erf;
    const cam = E.p(17, -12), kijk = E.p(3, -4.5);
    return { cam, kijk };
  });
  await bevries();
  await kamera(p.cam.x, 3.2, p.cam.z, p.kijk.x, 0.4, p.kijk.z);
  await foto('ronald_erf');
  await ontdooi();
}

// ------------------------------------------------------ de koplampen
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, E = v.ronald.erf;
  window.__zet(E.deur.x, E.deur.z);
  window.__stap(2); v.toets(); window.__stap(1); window.__klik();
  window.__stap(Math.ceil(7.5 / 0.05));
  window.__klik();
  // tot de auto halverwege de oprit is
  for (let i = 0; i < 600 && v.ronald.film === 'koplampen'; i++) {
    window.__stap(1);
    const a = v.ronald.auto;
    if (a && Math.hypot(a.x - E.deur.x, a.z - E.deur.z) < 11) break;
  }
});
await filmFoto('ronald_koplampen');
await page.evaluate(() => {
  const v = window.__game.verhaal;
  for (let i = 0; i < 600 && v.ronald.film === 'koplampen' && !(v.ronald.persoon.groep.visible && v.ronald.filmT > 0); i++) window.__stap(1);
  // even wachten tot hij mikt
  for (let i = 0; i < 40 && v.ronald.film === 'koplampen'; i++) window.__stap(1);
});
await filmFoto('ronald_geweer');

// ------------------------------------------------------ gezien: het gevecht
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  for (let i = 0; i < 400 && v.ronald.film; i++) window.__stap(1);
  window.__opFase('sluipen');
  window.__stap(2); window.__klik();
  const E = v.ronald.erf;
  v.schotGehoord(E.deur.x, E.deur.z);
  window.__stap(2); window.__klik();
  window.__zet(E.deur.x, E.deur.z);
  window.__stap(2); v.toets(); window.__stap(1); window.__klik();
  window.__stap(Math.ceil(7.5 / 0.05)); window.__klik();
  for (let i = 0; i < 600 && v.ronald.film === 'koplampen' && !(v.ronald.mannen && v.ronald.filmT > 0 && v.ronald.persoon.groep.visible); i++) window.__stap(1);
  for (let i = 0; i < 30 && v.ronald.film === 'koplampen'; i++) window.__stap(1);
});
await filmFoto('ronald_gevecht');

// ------------------------------------------------------ aan het water
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  for (let i = 0; i < 400 && v.ronald.film; i++) window.__stap(1);
  window.__klik();
  const M = v.ronald.mannen;
  if (M) for (const w of M.wachters) { M.raak(w.persoon.groep); window.__stap(1); }
  window.__stap(Math.ceil(4 / 0.05)); window.__klik();
  g.politie.reset();
  const golf = v.ronald.golf;
  g.player.inCar = golf; window.__stap(2); window.__klik();
  const deur = g.woningen[1].plekken.deurBuiten;
  golf.x = deur.x + 4; golf.z = deur.z + 4; if (golf.mesh) golf.mesh.position.set(golf.x, golf.mesh.position.y, golf.z);
  window.__stap(4); window.__klik();
  window.__stap(Math.ceil(9 / 0.05));
  for (let i = 0; i < 300 && v.ronald.film === 'loods' && v.ronald.filmT < 3.0 + 2.5; i++) window.__stap(1);
});
await filmFoto('ronald_loods');

await browser.close();

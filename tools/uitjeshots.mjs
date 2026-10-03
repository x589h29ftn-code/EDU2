/*
 Foto's van stap 115 (na het einde een middag met Mark):

   uitje_bank.png   binnen bij Molenkrite 15: Mark op de bank vraagt "de wedstrijd of de bank?"
   uitje_lijn.png   aan de lijn bij VV Sneek: Mark kijkt de wedstrijd, vanaf de tribune over zijn schouder

 Gebruik: npm run server &   node tools/uitjeshots.mjs 8123 [map]
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

const foto = async (naam, { wacht = 1500, dialoog = false } = {}) => {
  await page.evaluate((dialoog) => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    // (een melding blijft in de DOM staan; alleen zijn doorzichtigheid gaat omlaag)
    g.hud.missieT = 0; g.hud.missieEl.style.transition = 'none'; g.hud.missieEl.style.opacity = 0;
    if (!dialoog) document.getElementById('dialoog').hidden = true;
    const h = document.getElementById('hint'); if (h) { h.textContent = ''; h.style.visibility = 'hidden'; }
    const u = document.getElementById('uitleg'); if (u) u.style.visibility = 'hidden';
    if (g.renderer && g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
  }, dialoog);
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};
// de camera op (x, y, z) boven de grond daar, kijkend naar (kx, ky, kz); `binnen`: y is al absoluut
const kamera = (x, y, z, kx, ky, kz, binnen = false) => page.evaluate(async ({ x, y, z, kx, ky, kz, binnen }) => {
  const W = await import('/js/world.js');
  if (!binnen) { y += W.grondHoogte(x, z, 50); ky += W.grondHoogte(kx, kz, 50); }
  const g = window.__game, pl = g.player;
  window.__autoplay = false; pl.active = false;
  pl.inCar = null; pl.zit = false; pl.fly = false;
  pl.wapenUit = true; if (pl.gun) pl.gun.visible = false;
  pl.pos.set(x, y - pl.eye, z);
  pl.yaw = Math.atan2(-(kx - x), -(kz - z));
  pl.pitch = Math.atan2(ky - y, Math.hypot(kx - x, kz - z));
  pl.applyCamera();
  if (!binnen) { W.updateLOD(x, z); g.vehicles.lod(x, z); if (g.grasVeld) g.grasVeld.update(x, z, true); }
}, { x, y, z, kx, ky, kz, binnen });

await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  await g.reliëfAf();
  window.__autoplay = false; g.player.active = false;
  g.sfeer.weer = 'helder'; g.sfeer.uur = 13;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__klik = (max = 80) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
  Object.assign(s, { huis: 'Koningsspil 20', veteraanKlaar: true, politieautoKlaar: true, brugKlaar: true, schriftKlaar: true, raceKlaar: true,
    schaduwKlaar: true, invalKlaar: true, ronaldKlaar: true, uitzendingKlaar: true, geld: 5000 });
  v.herstel(s);
  for (let t = 0; t < 200 && v.uitje.fase !== 'wacht'; t += 0.5) window.__stap(1, 0.5);
  // naar binnen: Mark op de bank, het gesprek tot de vraag
  const w = g.woningen[0];
  g.player.pos.set(w.plekken.deurBinnen.x, 0, w.plekken.deurBinnen.z);
  window.__stap(2);
  // de tweede regel (de vraag) laten staan
  v.toets(); window.__stap(1);
});
// ------------------------------------------------------ op de bank
{
  const q = await page.evaluate(() => {
    const g = window.__game, v = g.verhaal, w = g.woningen[0];
    const k = w.plekken.bankKijk !== undefined ? w.plekken.bankKijk : v.mark.groep.rotation.y;
    const m = v.mark.groep.position;
    return { x: m.x, y: m.y, z: m.z, fx: -Math.sin(k), fz: -Math.cos(k) };
  });
  await kamera(q.x + q.fx * 2.6 + q.fz * 0.6, q.y + 1.55, q.z + q.fz * 2.6 - q.fx * 0.6, q.x, q.y + 0.85, q.z, true);
  await foto('uitje_bank', { dialoog: true });
}
// ------------------------------------------------------ aan de lijn
{
  const q = await page.evaluate(async () => {
    const g = window.__game, v = g.verhaal, P = g.player;
    window.__klik();
    v.kiesHuis(1); window.__klik();
    for (let t = 0; t < 15 && v.zwart; t += 0.05) window.__stap(1);
    window.__stap(4);
    for (let t = 0; t < 12 && !document.getElementById('dialoog').hidden; t += 0.05) window.__stap(1);
    const p = v.uitje.plek, a = P.inCar;
    a.x = p.parkeer.x; a.z = p.parkeer.z; a.speed = 0;
    if (a.mesh) a.mesh.position.set(a.x, a.mesh.position.y, a.z);
    window.__stap(4);
    P.inCar = null;
    // Mark meteen op zijn plek (het lopen zelf meet de proef)
    v.mark.groep.position.set(p.mark.x, v.mark.groep.position.y, p.mark.z);
    const u = v.uitje; u.pad && (u.pad.length = 0);
    P.pos.set(p.jij.x, 0, p.jij.z); P.applyCamera();
    window.__stap(4);
    for (let t = 0; t < 12 && !document.getElementById('dialoog').hidden; t += 0.05) window.__stap(1);
    // de wedstrijd een poosje laten lopen, met de camera daar
    for (let i = 0; i < 160; i++) { g.werkWedstrijdBij(0.05); window.__stap(1); }
    // en dan stil: de lus mag niets meer verschuiven
    g.wedstrijd.update = () => {};
    const W = await import('/js/world.js');
    const tb = (await import('/js/kaart.js')).KAART.sportvelden.find(s => s.hoofd);
    return { m: { x: p.mark.x, z: p.mark.z }, j: { x: p.jij.x, z: p.jij.z }, veld: { x: tb.cx, z: tb.cz }, fase: v.uitje.fase };
  });
  console.log('fase', q.fase);
  // achter en boven Mark (op de tribune), over zijn schouder naar het veld
  const dx = q.veld.x - q.m.x, dz = q.veld.z - q.m.z, d = Math.hypot(dx, dz);
  const ux = dx / d, uz = dz / d;
  await kamera(q.m.x - ux * 3.2 - uz * 1.4, 2.6, q.m.z - uz * 3.2 + ux * 1.4, q.m.x + ux * 20, 0.6, q.m.z + uz * 20);
  await foto('uitje_lijn', { wacht: 2500 });
}

await browser.close();

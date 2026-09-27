/*
 Foto's van missie 14, Ronald en de race naar IJlst:

   race_ronald.png   Ronald voor zijn huis aan de Lemmerweg 80, bij de schuur
   race_grid.png     die nacht op de Lemmerweg bij de BP: de grid, Bouwman en
                     Ronald langs de kant, zijn politieauto, de eerste ring
   race_pijlen.png   na het startsein: de lichtpijlen op de Lemmerweg
   race_ring.png     onderweg: de zwarte Ferrari op weg naar een ring
   race_finish.png   de finish in IJlst, met Bouwman, Ronald en de politieauto

 Gebruik: npm run server &   node tools/raceshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const foto = async (naam, { gesprek = false, wacht = 1500 } = {}) => {
  await page.evaluate((gesprek) => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    g.hud.melding('', '', 0);
    if (g.uitleg) g.uitleg.update(999);
    if (!gesprek) document.getElementById('dialoog').hidden = true;
    document.getElementById('praat').hidden = true;
    const h = document.getElementById('hint'); if (h) h.textContent = '';
    if (g.renderer && g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
  }, gesprek);
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
  window.__autoplay = true; window.__game.player.active = true;
});
// de camera op (x, y, z), kijkend naar (kx, ky, kz); zie tools/brugshots.mjs
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

await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  window.__autoplay = true;
  g.sfeer.weer = 'helder'; g.sfeer.uur = 15;
  g.reliëfAf();
  geluid.start();
  window.__stap = (n = 20, dt = 0.05) => {
    const v = g.verhaal, f = v.__echteUpdate || v.update;
    for (let i = 0; i < n; i++) f.call(v, dt);
  };
  window.__klik = (max = 40) => {
    for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { g.praat(); window.__stap(2); }
  };
  g.verhaal.startMissie('race');
  window.__stap(30);
  window.__klik();
  window.__stap(3);
});

// ----------------------------------------------------------- Ronald thuis
{
  const r = await page.evaluate(() => window.__game.verhaal.race.huis);
  const dx = r.straat.x - r.x, dz = r.straat.z - r.z, l = Math.hypot(dx, dz) || 1;
  const cx = r.x + dx / l * 8 - dz / l * 3.5, cz = r.z + dz / l * 8 + dx / l * 3.5;
  await bevries();
  await kamera(cx, 1.7, cz, r.x - dx / l * 3, 2.2, r.z - dz / l * 3);
  await foto('race_ronald');
  await ontdooi();
}

// ------------------------------------------------------ de grid bij de BP
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const s = v.bewaar(); s.missie = 'race'; s.fase = 'start';
  v.herstel(s);
  window.__stap(3);
});
{
  const p = await page.evaluate(() => {
    const pl = window.__game.verhaal.race.plek;
    return { k: pl.kant, s: pl.start, sp: pl.speler };
  });
  // van voren, schuin over de grid terug: de auto's met hun lampen aan, Bouwman en
  // Ronald langs de kant, zijn politieauto erachter
  await bevries();
  const vx = p.s.x + p.s.tx * 16 - p.s.tz * 3, vz = p.s.z + p.s.tz * 16 + p.s.tx * 3;
  await kamera(vx, 2.3, vz, p.sp.x - p.sp.tz * -3, 0.8, p.sp.z + p.sp.tx * -3);
  await foto('race_grid');
  await ontdooi();
}

// --------------------------------------------------------------- onderweg
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  // (de camera van de foto haalde je uit de auto: weer erin, anders beginnen de
  // pijlen bij de plek van de camera en niet bij jou)
  const auto = v.race.auto;
  g.player.inCar = auto; g.player.pos.set(auto.x, 0, auto.z);
  // (de foto verbergt de balk; het gesprek loopt nog, dus gewoon E tot het aftellen)
  document.getElementById('dialoog').hidden = false;
  for (let i = 0; i < 20 && v.fase === 'start'; i++) { g.praat(); window.__stap(2); }
  window.__stap(70);                      // het aftellen
});
// ------------------------------------------------- de pijlen op de weg
{
  const p = await page.evaluate(() => {
    // (de camera van de vorige foto haalde je uit de auto: dus de auto van de race zelf)
    const v = window.__game.verhaal, R = v.race.race, car = v.race.auto;
    const q = R.voortgang(car.x, car.z);
    return { a: R.punt(q.s - 9, 0.4), b: R.punt(q.s + 34, 0) };
  });
  await bevries();
  await kamera(p.a.x, 3.4, p.a.z, p.b.x, 0, p.b.z);
  await foto('race_pijlen');
  await ontdooi();
}
await page.evaluate(() => {
  window.__stap(300);                     // vijftien tellen racen
});
{
  const p = await page.evaluate(() => {
    const R = window.__game.verhaal.race.race, a = R.rijders[0];
    const cps = R.controlepunten, c = cps.find(s => s > a.s + 20) ?? cps[cps.length - 1];
    const ring = R.punt(c);
    // de ring van de zwarte Ferrari is die van de speler niet: zet de ring voor de foto bij hem
    R.ringen[0].position.set(ring.x, R.ringen[0].position.y, ring.z); R.ringen[0].rotation.y = Math.atan2(ring.tx, ring.tz); R.ringen[0].visible = true;
    const achter = R.punt(a.s - 14, 3.5);
    return { a: { x: a.car.x, z: a.car.z }, achter, ring, fase: window.__game.verhaal.fase, s: a.s };
  });
  await bevries();
  console.log(`onderweg: fase ${p.fase}, de zwarte Ferrari op ${Math.round(p.s)} m`);
  await kamera(p.achter.x, 2.4, p.achter.z, p.ring.x, 3.2, p.ring.z);
  await foto('race_ring');
  await ontdooi();
}

// ---------------------------------------------------------------- de finish
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, pl = v.race.plek;
  // de speler een eind van de start, zodat Bouwman en Ronald naar de finish gaan
  const car = g.player.inCar;
  if (car) { car.x = pl.eind.x + pl.eind.tx * 12; car.z = pl.eind.z + pl.eind.tz * 12; car.yaw = pl.eind.yaw; car.speed = 0; car.mesh.position.set(car.x, 0, car.z); car.mesh.rotation.y = car.yaw; }
  window.__stap(3);
});
{
  const p = await page.evaluate(() => {
    const pl = window.__game.verhaal.race.plek;
    return { e: pl.eind, k: pl.eindKant };
  });
  await bevries();
  await kamera(p.e.x - p.e.tx * 30 - p.e.tz * 3, 2.2, p.e.z - p.e.tz * 30 + p.e.tx * 3, p.e.x + p.e.tx * 4, 2.6, p.e.z + p.e.tz * 4);
  await foto('race_finish');
  await ontdooi();
}

await browser.close();

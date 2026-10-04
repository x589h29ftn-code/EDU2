/*
 Foto's van stap 119:

   intro_voetbal_begin.png  het begin van het nieuwe beeld in de intro: laag voor een bord van Radio Spannenburg
   intro_voetbal_eind.png   het eind: boven de middenlijn, de wedstrijd in beeld
   missie1_opspringer.png   missie 1: de man die opspringt en terugschiet, met de lege stoel
   missie4_boerderij.png    missie 4: Mark wacht bij de boerderij
   missie5_tuinen.png       missie 5: de dief in de tuinen, de auto op straat

 Gebruik: npm run server &   node tools/beginmissieshots.mjs 8123 [map]
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
  document.getElementById('overlay').style.display = 'none';
  await g.reliëfAf();
  window.__autoplay = false;
  g.player.active = false;
  window.__W = await import('/js/world.js');
  g.sfeer.uur = 13.5;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) g.verhaal.update(dt); };
  // de camera op een stand zetten, met de wereld eromheen zoals de hoofdlus hem zou zetten
  window.__cam = (pos, kijk) => {
    const P = g.player;
    P.fly = true;
    P.pos.set(pos.x, pos.y, pos.z);
    P.yaw = Math.atan2(-(kijk.x - pos.x), -(kijk.z - pos.z));
    P.pitch = Math.atan2(kijk.y - pos.y, Math.hypot(kijk.x - pos.x, kijk.z - pos.z));
    P.updateFly(0);
    P.applyCamera();
    window.__W.updateLOD(pos.x, pos.z); g.vehicles.lod(pos.x, pos.z);
    if (g.grasVeld) g.grasVeld.update(pos.x, pos.z, true);
    g.zetSchaduwDoos(kijk.x, kijk.z);
    if (g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
    document.getElementById('ui').style.display = 'none';
  };
});
const foto = async (naam) => {
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};

// ---- de intro: het begin en het eind van het beeld bij VV Sneek, met de wedstrijd
for (const [naam, waar] of [['intro_voetbal_begin', 0.03], ['intro_voetbal_eind', 0.97]]) {
  const info = await page.evaluate(async (u) => {
    const I = await import('/js/intro.js');
    const { KAART } = await import('/js/kaart.js');
    const g = window.__game;
    const tot = I.beeldOp(0, KAART, g.start).totaal;
    let t0 = null, t1 = null;
    for (let t = 0; t < tot; t += 0.05) if (I.beeldOp(t, KAART, g.start).soort === 'kraan') { if (t0 === null) t0 = t; t1 = t; }
    const b = I.beeldOp(t0 + (t1 - t0) * u, KAART, g.start);
    window.__cam(b.pos, b.kijk);
    g.camera.position.set(b.pos.x, b.pos.y, b.pos.z);
    g.camera.lookAt(b.kijk.x, b.kijk.y, b.kijk.z);
    g.camera.updateMatrixWorld();
    for (let i = 0; i < 30; i++) g.wedstrijdInFilm(0.05);
    return { t: (t0 + (t1 - t0) * u).toFixed(1), y: b.pos.y.toFixed(1), aanwezig: g.wedstrijd && g.wedstrijd.aanwezig };
  }, waar);
  console.log(naam, JSON.stringify(info));
  await foto(naam);
}

// ---- missie 1: de opspringer
const m1 = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game, v = g.verhaal, P = g.player;
  P.fly = false;
  v.__startMissie('molenkrite');
  window.__stap(2);
  const s = v.bewaar(); s.volgende = null; Object.assign(s, { missie: 'molenkrite', fase: 'opdracht', om: [] });
  v.herstel(s); window.__stap(2);
  const doelen = v.doelen();
  const tafel = v.plekken.tafel, M = v.mark.groep.position;
  const r = Math.hypot(M.x - tafel.x, M.z - tafel.z) || 1;
  P.pos.set(tafel.x + (M.x - tafel.x) / r * 9, 0, tafel.z + (M.z - tafel.z) / r * 9);
  const dichtst = doelen.map(o => ({ o, d: o.getWorldPosition(new THREE.Vector3()).distanceTo(P.pos) })).sort((a, b) => a.d - b.d)[0].o;
  v.raak(dichtst);
  for (let i = 0; i < 24; i++) v.update(0.05);
  const O = v.opspringer;
  if (!O) return null;
  const w = O.groep.wachters[0].persoon.groep.position;
  window.__cam({ x: P.pos.x, y: 1.7, z: P.pos.z }, { x: w.x, y: 1.2, z: w.z });
  return { x: w.x.toFixed(1), z: w.z.toFixed(1) };
});
console.log('missie1', JSON.stringify(m1));
await foto('missie1_opspringer');

// ---- missie 4: Mark bij de boerderij
const m4 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  v.__startMissie('bewaking'); window.__stap(2);
  v.__startMissie('afleveren'); window.__stap(2);
  const M = v.mark.groep.position, S = v.plekken.schuur;
  // achter Mark, op de weg ernaartoe, iets hoger
  const dx = M.x - S.x, dz = M.z - S.z, d = Math.hypot(dx, dz) || 1;
  window.__cam({ x: M.x + dx / d * 12, y: 3.2, z: M.z + dz / d * 12 }, { x: M.x, y: 1.4, z: M.z });
  return { mark: [M.x.toFixed(1), M.z.toFixed(1)] };
});
console.log('missie4', JSON.stringify(m4));
await foto('missie4_boerderij');

// ---- missie 5: de dief in de tuinen
const m5 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  v.__startMissie('johan'); window.__stap(2);
  const dief = v.dief;
  if (!dief) return null;
  dief.schrik(); dief.update(1.2, P);
  const pos = dief.positie;
  const s = v.bewaar(); s.volgende = null;
  Object.assign(s, { missie: 'johan', fase: 'achtervolging', dief: { staat: 'vlucht', x: pos.x, z: pos.z, yaw: 0, vluchtT: 5, omT: 0 } });
  g.politie.reset(); v.herstel(s); window.__stap(2);
  const auto = g.vehicles.voegToe({ x: pos.x + 16, z: pos.z, yaw: 0, soort: 'hatch', kleur: 0x2a3f8f });
  P.fly = false;
  P.inCar = auto; P.pos.set(auto.x, 0, auto.z);
  for (let i = 0; i < 40 && !dief.tuin; i++) v.update(0.05);
  for (let i = 0; i < 60 && dief.tuin; i++) v.update(0.05);
  P.inCar = null;
  // vanaf de auto, hoog genoeg om over de schutting te kijken
  window.__cam({ x: auto.x, y: 4.5, z: auto.z }, { x: pos.x, y: 1.0, z: pos.z });
  return { tuin: dief.tuin, dief: [pos.x.toFixed(1), pos.z.toFixed(1)] };
});
console.log('missie5', JSON.stringify(m5));
await foto('missie5_tuinen');

await browser.close();

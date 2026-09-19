/*
 Foto's van de ronde van 19 september 2026 (tweede lijst):

   vang_voorgevel.png     de woningen aan de Vang, nu met een deur in de punt
   jumbo_lemmerweg.png    Jumbo Kooistra aan de Lemmerweg
   duinterpen_zalm.png    het gebogen blok in Duinterpen
   atalanta.png           de rij aan de Atalanta
   poiesz_duinterpen.png  de tweede ingang van de Poiesz
   cabine.png             vanaf de bestuurdersstoel van de bakwagen
   minikaart_groot.png    de vergrote minikaart na één keer M

 Gebruik: npm run server &   node tools/rondeshots.mjs 8123 [map]
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
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

const foto = async (naam) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};

await page.evaluate(() => {
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('ui').style.display = 'none';
  g.player.active = true;
  g.sfeer.uur = 13; g.sfeer.weer = 'helder';
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  g.player.fly = true;
  window.__kijk = (doel, afst, hoog, hoek, mikY = 3) => {
    const x = doel.x + Math.cos(hoek) * afst, z = doel.z + Math.sin(hoek) * afst;
    g.player.pos.set(x, hoog, z);
    g.player.yaw = Math.atan2(-(doel.x - x), -(doel.z - z));
    g.player.pitch = Math.atan2(mikY - hoog, Math.hypot(doel.x - x, doel.z - z));
    g.player.updateFly(0);
  };
  /*
   Een standpunt vóór het pand: `front` uit de kaart wijst de voorgevel uit, en
   dat is de kant waar de deur zit. Zonder dat kijk je tegen een zijgevel aan.
  */
  /*
   `kies` is of een BAG-pandnummer, of een stukje voorwaarde over `q` (bijvoorbeeld
   "q.type === 'atalanta'"). Een nummer bestaat alleen uit cijfers, dus daar is
   geen twijfel over mogelijk; al het andere wordt een functie.
  */
  window.__voorPand = async (kies, afst, hoog, mikY) => {
    const { KAART } = await import('/js/kaart.js');
    const test = /^\d+$/.test(kies) ? (q) => q.id === kies : new Function('q', `return ${kies}`);
    const p = KAART.panden.find(test);
    if (!p) return null;
    let x = 0, z = 0;
    for (const q of p.voet) { x += q[0]; z += q[1]; }
    const hart = { x: x / p.voet.length, z: z / p.voet.length };
    const f = p.front || [0, -1];
    window.__kijk(hart, afst, hoog, Math.atan2(f[1], f[0]), mikY);
    return { id: p.id, type: p.type, x: hart.x, z: hart.z };
  };
});

const shot = async (naam, kies, afst, hoog, mikY) => {
  const p = await page.evaluate(([k, a, h, m]) => window.__voorPand(k, a, h, m), [kies, afst, hoog, mikY]);
  if (!p) { console.log(`${naam}: geen pand gevonden`); return; }
  console.log(`${naam}: ${p.id} (${p.type}) op (${p.x.toFixed(0)}, ${p.z.toFixed(0)})`);
  await foto(naam);
};

// de woning aan de Vang met de laagste goot — die had het probleem het ergst
// hoger dan ooghoogte, want voor deze woningen staat een heg van ruim een meter
// en die neemt precies de onderste helft van de voorgevel weg
await shot('vang_voorgevel', "q.straat === 'de Vang' && q.goot < 1.4 && q.nok > 8", 16, 3.6, 3.0);
await shot('jumbo_lemmerweg', '1900100010087000', 48, 4.0, 5.0);
// van de binnenkant van de boog: daar ligt het parkeerterrein en zit de pui
await shot('duinterpen_zalm', "q.type === 'duinterpen_zalm'", -34, 4.0, 6.0);
await shot('atalanta', "q.type === 'atalanta'", 22, 2.0, 4.0);
await shot('poiesz_duinterpen', '0091100000019594', 38, 3.0, 5.0);

// ---- vanaf de bestuurdersstoel van de bakwagen ----
const cabine = await page.evaluate(async () => {
  const THREE = await import('three');
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  const car = g.vehicles.cars.find(c => c.soort === 'truck')
    || g.vehicles.voegToe({ x: KAART.start.x, z: KAART.start.z + 24, yaw: 0, soort: 'truck', kleur: 0xdedede });
  if (!car) return null;
  g.vehicles.ruiten(car, false);
  const st = car.stoel || (car.mesh && car.mesh.userData.oog) || { x: -0.34, y: 1.32, z: -0.87 };
  const oog = new THREE.Vector3(st.x, st.y, st.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.yaw);
  g.player.fly = true;
  g.player.pos.set(car.x + oog.x, (car.mesh ? car.mesh.position.y : 0) + st.y, car.z + oog.z);
  g.player.yaw = car.yaw; g.player.pitch = -0.04;
  g.player.updateFly(0);
  const binnen = car.mesh && car.mesh.userData.binnen;
  if (binnen) { binnen.groep.visible = true; binnen.update(car, 0.016); }
  return { x: car.x, z: car.z };
});
if (cabine) await foto('cabine');

// ---- de vergrote minikaart ----
await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  g.player.fly = false;
  g.player.pos.set(KAART.start.x, 0, KAART.start.z);
  g.player.yaw = KAART.start.yaw; g.player.pitch = 0;
  g.player.applyCamera();
  document.getElementById('ui').style.display = '';
  g.hud.kaartStand = 0;
  g.hud.kaartStap();                       // stand 1: de vergrote minikaart
});
await foto('minikaart_groot');

await browser.close();

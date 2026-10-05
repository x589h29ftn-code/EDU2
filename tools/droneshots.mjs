/*
 Foto's van stap 124:

   drone_beeld.png        het beeld van de drone boven Tinga, met de waarden onderin
   drone_bereik.png       boven de 150 m: OUT OF RANGE, ruis en de tellen
   nacht_sterren.png      's nachts: sterren, de maan en de rode lampjes op de hoge daken
   ochtendmist.png        zes uur 's ochtends, mist over de wijk
   eenden.png             eenden en zwanen op het water
   meeuwen_ijlst.png      de meeuwen boven de haven van IJlst
   terras_poiesz.png      het terras naast de ingang van de Poiesz in IJlst
   vuilniswagen.png       de vuilniswagen die de kliko's leegt
   autoschade.png         een deuk, kogelgaten en een gebarsten voorruit

 Gebruik: npm run server &   node tools/droneshots.mjs 8123 [map] [alleen]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
const alleen = process.argv[4] || null;
const doe = (naam) => !alleen || alleen.split(',').some(a => naam.startsWith(a));
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
  window.__autoplay = false; window.__geenDownload = true;
  window.__W = await import('/js/world.js');
  g.sfeer.uur = 13.5; g.sfeer.weer = 'helder';
  window.__wereld = (x, z, kx, kz) => {
    window.__W.updateLOD(x, z); g.vehicles.lod(x, z);
    if (g.grasVeld) g.grasVeld.update(x, z, true);
    g.zetSchaduwDoos(kx, kz);
    if (g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
  };
  window.__cam = (pos, kijk, ui = false) => {
    const P = g.player;
    P.fly = true;
    P.pos.set(pos.x, pos.y, pos.z);
    P.yaw = Math.atan2(-(kijk.x - pos.x), -(kijk.z - pos.z));
    P.pitch = Math.atan2(kijk.y - pos.y, Math.hypot(kijk.x - pos.x, kijk.z - pos.z));
    P.updateFly(0);
    P.applyCamera();
    window.__wereld(pos.x, pos.z, kijk.x, kijk.z);
    document.getElementById('ui').style.display = ui ? '' : 'none';
  };
  // de drone op een plek, kijkend naar een punt; Erik staat op `erik`
  window.__drone = (erik, pos, kijk) => {
    const P = g.player, D = g.drone;
    P.fly = false; P.inCar = null; P.binnen = false; P.zit = false; P.health = 100;
    P.pos.set(erik.x, 0, erik.z);
    P.drone = true; D.accu = 240;
    if (!D.actief) D.start();
    D.pos.set(pos.x, pos.y, pos.z);
    P.yaw = Math.atan2(-(kijk.x - pos.x), -(kijk.z - pos.z));
    P.pitch = Math.atan2(kijk.y - pos.y, Math.hypot(kijk.x - pos.x, kijk.z - pos.z));
    P.keys = {};
    D.update(0.05);
    window.__wereld(pos.x, pos.z, kijk.x, kijk.z);
    document.getElementById('ui').style.display = 'none';
  };
});
const foto = async (naam) => {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};

const S = await page.evaluate(() => window.__game.start || { x: 10.7, z: -7.1 });

if (doe('drone_beeld')) {
  await page.evaluate((s) => {
    window.__drone(s, { x: s.x - 40, y: 55, z: s.z + 60 }, { x: s.x + 40, y: 0, z: s.z - 60 });
    // de ruis van het opstijgen eerst laten wegzakken, en dan weer op de plek
    const D = window.__game.drone;
    for (let i = 0; i < 60; i++) D.update(0.05);
    D.pos.set(s.x - 40, 55, s.z + 60); D.update(0.05);
  }, S);
  await foto('drone_beeld');
}
if (doe('drone_bereik')) {
  await page.evaluate((s) => {
    const D = window.__game.drone;
    window.__drone(s, { x: s.x + 20, y: 153, z: s.z + 20 }, { x: s.x + 300, y: 0, z: s.z - 300 });
    for (let i = 0; i < 30; i++) D.update(0.05);
  }, S);
  await foto('drone_bereik');
}
await page.evaluate(() => { const D = window.__game.drone; if (D.actief) D.terug(); });

if (doe('nacht')) {
  await page.evaluate(async () => {
    const g = window.__game;
    const { KAART } = await import('/js/kaartwereld.js');
    g.sfeer.uur = 1.0;
    // het hoogste pand, van een eind weg en van onderen, met de lucht erachter
    const pand = KAART.panden.reduce((a, b) => (b.nok > a.nok ? b : a));
    const cx = pand.voet.reduce((s, q) => s + q[0], 0) / pand.voet.length, cz = pand.voet.reduce((s, q) => s + q[1], 0) / pand.voet.length;
    window.__cam({ x: cx - 110, y: 32, z: cz + 90 }, { x: cx, y: pand.nok + 18, z: cz });
    for (let i = 0; i < 40 && !g.knipper.aan; i++) g.knipper.update(0.1, true);
  });
  await foto('nacht_sterren');
}
if (doe('ochtendmist')) {
  await page.evaluate((s) => {
    const g = window.__game;
    g.sfeer.uur = 6.1;
    window.__cam({ x: s.x - 60, y: 26, z: s.z + 80 }, { x: s.x + 100, y: 0, z: s.z - 120 });
  }, S);
  await foto('ochtendmist');
}
if (doe('eenden')) {
  await page.evaluate(async () => {
    const g = window.__game, V = g.vogels;
    g.sfeer.uur = 11;
    const { LIGPLAATSEN } = await import('/js/boot.js');
    const p = LIGPLAATSEN[0];
    V.vulAan(p.x, p.z);
    // het dichtstbijzijnde groepje, van de oever af bekeken
    const gr = V.groepen.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    const W = window.__W;
    let oog = null;
    for (let a = 0; a < 32 && !oog; a++) {
      const h = a / 32 * Math.PI * 2;
      const x = gr.x + Math.cos(h) * 9, z = gr.z + Math.sin(h) * 9;
      if (!W.pointInWater(x, z)) oog = { x, z };
    }
    oog = oog || { x: gr.x + 9, z: gr.z };
    window.__cam({ x: oog.x, y: 2.2, z: oog.z }, { x: gr.x, y: 0, z: gr.z });
  });
  await foto('eenden');
}
if (doe('meeuwen')) {
  await page.evaluate(() => {
    const g = window.__game, V = g.vogels;
    g.sfeer.uur = 15;
    const H = { x: -1282, z: 1106 };
    V.update(0.1, H.x, H.z);
    // van dichtbij, schuin omhoog naar de zwerm
    // vlak onder de laagste meeuw, schuin omhoog naar hem en de zwerm erachter
    let m = V.meeuwPlek(0);
    for (let i = 1; i < V.meeuwen; i++) { const q = V.meeuwPlek(i); if (q.y < m.y) m = q; }
    window.__cam({ x: m.x + 7, y: Math.max(2, m.y - 4), z: m.z + 6 }, { x: m.x, y: m.y + 1.5, z: m.z });
  });
  await foto('meeuwen_ijlst');
}
if (doe('terras')) {
  await page.evaluate(() => {
    const g = window.__game, L = g.leven;
    g.sfeer.uur = 13;
    const T = L.terras;
    if (!T.plek) return;
    L.update(0.1, { x: T.plek.x, z: T.plek.z }, () => true, 13);
    const mx = (T.plek.x + T.plek.x2) / 2, mz = (T.plek.z + T.plek.z2) / 2;
    const deur = g.supermarkt.ingangen[0];
    // van de straat af: vóór het terras, naar de gevel kijkend
    window.__cam({ x: mx + deur.f[0] * 9 + 2, y: 2.0, z: mz + deur.f[1] * 9 + 2 }, { x: mx, y: 0.9, z: mz });
  });
  await foto('terras_poiesz');
}
if (doe('vuilnis')) {
  await page.evaluate((s) => {
    const g = window.__game, L = g.leven;
    g.sfeer.uur = 8;
    L.startVuilnis(s, { zeker: true });
    for (let i = 0; i < 400 && !L.vuilnis.stil; i++) L.update(0.1, s, () => true, 8);
    const w = L.vuilnis.wagen;
    // schuin van voren, aan de kant van het logo en de grijper (rechts, +x)
    const zij = { x: Math.cos(w.yaw), z: -Math.sin(w.yaw) };
    // op de weg vóór hem, iets naar rechts: de grille met DAF, en de rechterkant met het logo en de grijper
    // (opzij van de weg stond de camera in een gevel)
    const vx = -Math.sin(w.yaw), vz = -Math.cos(w.yaw);
    const doel = { x: w.x + vx * 1.0, y: 1.8, z: w.z + vz * 1.0 };
    window.__cam({ x: w.x + vx * 13 + zij.x * 3.2, y: 2.3, z: w.z + vz * 13 + zij.z * 3.2 }, doel);
  }, S);
  await foto('vuilniswagen');
}
if (doe('autoschade')) {
  await page.evaluate(async (s) => {
    const g = window.__game, A = g.autoschade;
    const THREE = await import('three');
    g.sfeer.uur = 12;
    // (het poppetje van Erik niet in beeld)
    if (g.derde) g.derde.aan = false;
    // op de rijbaan van de Molenkrite, een stuk voor het beginpunt
    const yaw0 = s.yaw ?? -0.88;
    const car = g.vehicles.voegToe({ x: s.x, z: s.z, yaw: yaw0, soort: 'hatch', kleur: 0x2a5aa0 });
    car.mesh.updateMatrixWorld(true);
    A.botsing(car, 11, true);
    A.botsing(car, 17, true);
    // drie kogels in de zijkant
    const r = new THREE.Raycaster();
    const delen = [];
    car.mesh.traverse(o => { if (o.isMesh && (o.userData.lak || o === car.mesh.userData.glas)) delen.push(o); });
    for (const [dz, dy] of [[-0.5, 0.75], [0.2, 0.7], [0.9, 0.85]]) {
      const a = car.mesh.localToWorld(new THREE.Vector3(-3, dy, dz)), b = car.mesh.localToWorld(new THREE.Vector3(0, dy, dz));  // (links, de kant van de camera)
      r.set(a, b.sub(a).normalize());
      const h = r.intersectObjects(delen, false)[0];
      if (h) A.kogel(car, h.object, h.point, h.face.normal.clone().transformDirection(h.object.matrixWorld));
    }
    // schuin van voren links
    // vóór de auto, rechts van de neus en laag: de deuk, de barst in de voorruit (links staat vaak een voetganger)
    const voor = car.mesh.localToWorld(new THREE.Vector3(1.6, 1.3, -4.4));
    window.__cam({ x: voor.x, y: 1.5, z: voor.z }, { x: car.x, y: 0.75, z: car.z });
  }, S);
  await foto('autoschade');
}

await browser.close();

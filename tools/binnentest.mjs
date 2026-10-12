/*
 Het interieur van elke soort auto, gemeten uit de ogen van de bestuurder (stap 146): npm run binnentest.
 Laadt alleen de modellen (js/carmodel.js, js/nomercy5.js) op een lege pagina, dus een paar minuten.

 Per soort (hatch, van, bx, gti, truck, ferrari, ambulance en de stafauto):
 1. er is een interieur, en het staat uit tot je erin zit;
 2. het stuur staat 0,38–0,70 m vóór je ogen en 20–40° onder de horizon (de ambulance had 0,16 m en 71°: onder je kin);
 3. de klokken liggen hoogstens 33° onder de horizon, dus binnen beeld als je recht vooruit kijkt (de camera ziet 36°
    naar beneden);
 4. recht vooruit en 6° omlaag kijk je vrij door de voorruit: geen stuk carrosserie boven de raamlijn binnen 1,6 m (de bus
    had zijn motorkap op 1,80 m, een balk dwars door de voorruit; de motorkap van de Ferrari onder de raamlijn mag);
 5. het stuur draait mee met het sturen en de snelheidsmeter met de vaart;
 6. de pook is een dunne stang met een bol (geen balkje), behalve in de Ferrari en de stafauto (die hun eigen hebben).
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fout++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(600000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/binnenbank`, { waitUntil: 'load', timeout: 120000 });
await page.setContent(`<!doctype html><html><head>
<script type="importmap">{ "imports": { "three": "/lib/three.module.js" } }</script></head><body>
<script type="module">
  import * as THREE from 'three';
  import { makeCar, autoMaat } from '/js/carmodel.js';
  import { maakStafauto } from '/js/nomercy5.js';
  window.__t = { THREE, makeCar, autoMaat, maakStafauto };
</script></body></html>`);
await page.waitForFunction(() => window.__t, null, { timeout: 120000 });

const uit = await page.evaluate(() => {
  const { THREE, makeCar, autoMaat, maakStafauto } = window.__t;
  const res = {};
  for (const soort of ['hatch', 'van', 'bx', 'gti', 'truck', 'ferrari', 'ambulance', 'staf']) {
    const g = soort === 'staf' ? maakStafauto() : makeCar(0x3b6ea8, soort, true);
    g.updateMatrixWorld(true);
    const u = g.userData, B = u.binnen, o = u.oog;
    if (!B) { res[soort] = null; continue; }
    const uitBijStart = B.groep.visible === false;
    B.groep.visible = true;
    const wp = (x) => x.getWorldPosition(new THREE.Vector3());
    // het stuur: de groep die draait (autobinnen: `stuur`, de stafauto: `draai`)
    const stuurObj = B.stuur || B.draai;
    const st = wp(stuurObj);
    const hoek = (p) => Math.atan2(o.y - p.y, Math.hypot(p.z - o.z, p.x - o.x)) * 180 / Math.PI;
    // de klokken: het laagste punt van de wijzerplaat(en)
    let klokObj = B.klok || null;
    if (!klokObj) B.groep.traverse(x => { if (!klokObj && x.name === 'klok') klokObj = x; });
    const kb = new THREE.Box3().setFromObject(klokObj);
    const klokLaag = new THREE.Vector3((kb.min.x + kb.max.x) / 2, kb.min.y, (kb.min.z + kb.max.z) / 2);
    // vrij zicht: stralen recht vooruit en 6° omlaag, carrosserie zonder glas en zonder interieur
    const glas = new Set(); if (u.glas) u.glas.traverse ? u.glas.traverse(x => glas.add(x)) : glas.add(u.glas);
    const inBinnen = (x) => { let q = x; while (q) { if (q === B.groep) return true; q = q.parent; } return false; };
    const ray = new THREE.Raycaster(); const vrij = {};
    for (const a of [0, 6]) {
      const d = new THREE.Vector3(0, -Math.sin(a * Math.PI / 180), -Math.cos(a * Math.PI / 180));
      ray.set(new THREE.Vector3(o.x, o.y, o.z), d); ray.far = 1.6;
      // carrosserie onder de raamlijn (de motorkap van een lage sportwagen) mag; erboven is een balk door de voorruit
      const raamlijn = soort === 'staf' ? 0.98 : autoMaat(soort).schouderY;
      const h = ray.intersectObject(g, true).find(x => !glas.has(x.object) && !inBinnen(x.object) && x.object.visible !== false && x.point.y > raamlijn + 0.10);
      vrij[a] = h ? +h.distance.toFixed(2) : null;
    }
    // sturen en snelheid
    const auto = { steer: 0, speed: 0, topSnelheid: 30 };
    B.update(auto, 1);
    const s0 = stuurObj.rotation.z;
    auto.steer = 0.3; auto.speed = 50 / 3.6;
    for (let i = 0; i < 40; i++) B.update(auto, 0.1);
    const s1 = stuurObj.rotation.z;
    const naald = (B.naalden && B.naalden[0]) || B.naald;
    // naald: opnieuw vanaf stilstand, dan op snelheid
    const auto2 = { steer: 0, speed: 0, topSnelheid: 30 };
    for (let i = 0; i < 40; i++) B.update(auto2, 0.1);
    const n0 = naald.rotation.z;
    auto2.speed = 50 / 3.6; for (let i = 0; i < 40; i++) B.update(auto2, 0.1);
    const n1 = naald.rotation.z;
    // de pook: een bol, en de stang dun
    let bol = 0, dunsteStang = Infinity;
    B.groep.traverse(x => {
      if (!x.isMesh) return;
      const p = x.geometry.parameters || {};
      if (x.geometry.type === 'SphereGeometry' && p.radius < 0.04 && p.radius > 0.015) bol++;
      if (x.geometry.type === 'CylinderGeometry' && p.height > 0.1 && p.height < 0.2 && Math.max(p.radiusTop, p.radiusBottom) < 0.015) dunsteStang = Math.min(dunsteStang, Math.max(p.radiusTop, p.radiusBottom));
    });
    res[soort] = {
      uitBijStart, oog: o,
      stuur: { dz: +(o.z - st.z).toFixed(2), hoek: +hoek(st).toFixed(1) },
      klokHoek: +hoek(klokLaag).toFixed(1), vrij, stuurDraait: Math.abs(s1 - s0) > 0.5, naaldLoopt: Math.abs(n1 - n0) > 0.2,
      pook: { bol, stang: isFinite(dunsteStang) ? dunsteStang : null },
    };
  }
  return res;
});

for (const [soort, r] of Object.entries(uit)) {
  kop(soort);
  ok(!!r && r.uitBijStart, 'een interieur, en het staat uit tot je erin zit');
  if (!r) continue;
  ok(r.stuur.dz >= 0.38 && r.stuur.dz <= 0.70 && r.stuur.hoek >= 20 && r.stuur.hoek <= 40, 'het stuur vóór je, onder je ogen', `${r.stuur.dz} m, ${r.stuur.hoek}° omlaag`);
  ok(r.klokHoek <= 33, 'de klokken in beeld als je recht vooruit kijkt', `${r.klokHoek}° omlaag`);
  ok(r.vrij[0] === null && r.vrij[6] === null, 'vrij zicht door de voorruit, recht vooruit en 6° omlaag (boven de raamlijn)', `${r.vrij[0] ?? 'vrij'} / ${r.vrij[6] ?? 'vrij'}`);
  ok(r.stuurDraait && r.naaldLoopt, 'het stuur draait mee en de naald loopt mee');
  if (soort !== 'ferrari' && soort !== 'staf') ok(r.pook.bol >= 1 && r.pook.stang !== null, 'de pook: een dunne stang met een bol', r.pook.stang ? `stang ${r.pook.stang} m` : 'geen');
}

await browser.close();
console.log(fout ? `\n${fout} fout${fout > 1 ? 'en' : ''}` : '\nalles goed');
process.exit(fout ? 1 : 0);

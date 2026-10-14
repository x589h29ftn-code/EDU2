/*
 Stap 172: de auto's zelf — remlichten, achteruitrijlicht, een bestuurder achter het stuur, en wielen die meesturen en
 rollen (npm run autodetailtest).

 Deel A laadt alleen de modules (js/carmodel.js, js/autodetail.js) op een lege pagina:
   1. per soort (hatch, van, bx, gti, truck, ferrari, ambulance) de bestuurder: links, het hoofd onder de hemel (een
      straal recht omhoog uit het hoofd raakt binnen 25 cm het dak of de hemel), de billen op de zitting (een straal
      recht omlaag uit de heup raakt binnen 10 cm de zitting van js/autobinnen.js), de handen hoogstens 15 cm van de
      krans van het echte stuur, en niets steekt door de carrosserie (stralen uit negen richtingen op een raster van
      3 cm: wie de bestuurder raakt, ging eerst door glas); hoogstens 3000 driehoeken;
   2. in het verkeer ('verkeer') zit hij er altijd in, in een auto uit `voegToe` pas als die rijdt, en in jouw auto alleen
      van buiten (in Eriks kleren); na `bestuurderNa` stilstand is hij weg;
   3. de wielen: de naaf rolt (hoek = afstand / straal), achteruit de andere kant op; de voorwielen draaien mee met het
      stuur (dezelfde kant als de draai van de auto, tan(stuur) = draai · wielbasis / v), de achterwielen niet;
   4. het remlicht: met toetsen bij de rem, niet bij gas of stil zonder rem; zonder toetsen bij vertragen, en blijvend
      als hij zo tot stilstand remt, uit bij optrekken; het achteruitrijlicht alleen achteruit; het remlicht feller dan
      het achterlicht 's nachts; geen lichtbron in een auto.
 Deel B in het spel:
   5. elke rijdende auto van het verkeer heeft een bestuurder, een geparkeerde auto die je klaarmaakt niet; dichtbij losse
      wielen en de bestuurder, voorbij 90 m de samengevoegde wielen zonder bestuurder;
   6. een auto van het verkeer die moet stoppen remt met licht, trekt op zonder, en rijdt achteruit met het witte licht;
   7. geen nieuw shaderprogramma overdag en 's nachts met remlicht, achteruitrijlicht en bestuurders in beeld, en het
      aantal lichtbronnen in de scène blijft gelijk.

 Gebruik: node tools/server.mjs 8132 &  node tools/autodetailtest.mjs 8132
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fout++; };
const kop = (t) => console.log(`\n--- ${t} ---`);
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(1800000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });

// ------------------------------------------------------------------ deel A: de modules
await page.goto(`http://127.0.0.1:${poort}/autodetailbank`, { waitUntil: 'load', timeout: 120000 });
await page.setContent(`<!doctype html><html><head>
<script type="importmap">{ "imports": { "three": "/lib/three.module.js" } }</script></head><body>
<script type="module">
  import * as THREE from 'three';
  import * as C from '/js/carmodel.js';
  import * as D from '/js/autodetail.js';
  import * as B from '/js/bestuurder.js';
  window.__t = { THREE, C, D, B };
</script></body></html>`);
await page.waitForFunction(() => window.__t, null, { timeout: 120000 });

const A = await page.evaluate(() => {
  const { THREE, C, D, B } = window.__t;
  const uit = { soorten: {} };
  const rc = new THREE.Raycaster();
  for (const soort of ['hatch', 'van', 'bx', 'gti', 'truck', 'ferrari', 'ambulance']) {
    const maat = C.autoMaat(soort);
    const vol = C.makeCar(0x3b6ea8, soort, true);      // met interieur: voor stoel en stuur
    const ver = C.makeCar(0x3b6ea8, soort, 'verkeer'); // zoals hij in het verkeer rijdt
    vol.updateMatrixWorld(true); ver.updateMatrixWorld(true);
    const u = vol.userData, b = u.bestuurder, P = b.userData.plek;
    const r = { volUit: b.visible === false, verAan: ver.userData.bestuurder.visible === true, verZonderBinnen: !ver.userData.binnen };
    // de hoekpunten van de bestuurder
    const pos = b.geometry.attributes.position;
    let maxY = -1e9, minX = 1e9, maxX = -1e9;
    for (let i = 0; i < pos.count; i++) { maxY = Math.max(maxY, pos.getY(i)); minX = Math.min(minX, pos.getX(i)); maxX = Math.max(maxX, pos.getX(i)); }
    r.driehoeken = pos.count / 3;
    r.links = maxX < 0.05 && P.hoofd.x < -0.2;
    r.xBereik = [+minX.toFixed(3), +maxX.toFixed(3)];
    r.hemelMarge = +(P.hemelY - maxY).toFixed(3);
    // het dak of de hemel recht boven het hoofd (het interieur meetelt: de hemel is het dak van binnen)
    u.binnen.groep.visible = true; vol.updateMatrixWorld(true);
    const zichtbaar = (o) => { for (let q = o; q; q = q.parent) if (q.visible === false) return false; return true; };
    rc.set(new THREE.Vector3(P.hoofd.x, P.hoofd.y, P.hoofd.z), new THREE.Vector3(0, 1, 0)); rc.far = 1;
    const omhoog = rc.intersectObject(vol, true).filter(h => zichtbaar(h.object) && h.object !== b)[0];
    r.dak = omhoog ? { d: +(omhoog.distance - B.BESTUURDER.hoofdR * 1.05).toFixed(3), naam: omhoog.object.name || omhoog.object.material.type } : null;
    // de zitting recht onder de heup
    rc.set(new THREE.Vector3(P.heup.x, P.heup.y, P.heup.z), new THREE.Vector3(0, -1, 0)); rc.far = 1;
    const omlaag = rc.intersectObject(u.binnen.groep, true).filter(h => zichtbaar(h.object))[0];
    r.zit = omlaag ? { d: +(omlaag.distance - B.BESTUURDER.heupBoven).toFixed(3), naam: omlaag.object.name } : null;
    // de handen tegen de krans van het echte stuur (js/autobinnen.js)
    const st = u.binnen.stuur; st.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(st.matrixWorld).invert();
    const kransR = st.children[0].geometry.parameters.radius;
    r.handen = [P.handL, P.handR].map(h => {
      const l = new THREE.Vector3(h.x, h.y, h.z).applyMatrix4(inv);
      return +Math.hypot(Math.hypot(l.x, l.y) - kransR, l.z).toFixed(3);
    });
    u.binnen.groep.visible = false;
    // van buiten: niets van de bestuurder steekt door de carrosserie (het verkeersmodel, zonder interieur)
    const vb = ver.userData.bestuurder;
    vb.raycast = THREE.Mesh.prototype.raycast;
    const bb = new THREE.Box3().setFromObject(vb), cB = bb.getCenter(new THREE.Vector3());
    const isGlas = (h) => h.object.material && h.object.material.transparent;
    let uitN = 0, stralen = 0; const waar = [];
    for (const d of [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,-1,0],[0.7,-0.7,0],[-0.7,-0.7,0],[0,-0.7,0.7],[0,-0.7,-0.7]]) {
      const Dv = new THREE.Vector3(...d).normalize();
      const a1 = Math.abs(Dv.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0).cross(Dv).normalize();
      const a2 = new THREE.Vector3().crossVectors(Dv, a1).normalize();
      for (let a = -1.0; a <= 1.0; a += 0.03) for (let c = -1.0; c <= 1.0; c += 0.03) {
        const o = cB.clone().addScaledVector(a1, a).addScaledVector(a2, c).addScaledVector(Dv, -6);
        rc.set(o, Dv); rc.far = 12;
        if (!rc.ray.intersectsBox(bb)) continue;
        const hs = rc.intersectObject(ver, true).filter(h => zichtbaar(h.object));
        const eerste = hs.find(h => !isGlas(h));
        if (!eerste || eerste.object !== vb) continue;
        stralen++;
        if (hs.some(h => isGlas(h) && h.distance < eerste.distance)) continue;
        uitN++; if (waar.length < 4) waar.push(eerste.point.toArray().map(v => +v.toFixed(2)));
      }
    }
    vb.raycast = () => {};
    r.buiten = { uitN, stralen, waar };
    uit.soorten[soort] = r;
  }

  // ---- 2. wanneer zit er iemand in
  {
    const g = C.makeCar(0x777777, 'hatch', true);
    const car = { mesh: g, x: 0, z: 0, yaw: 0, speed: 0, steer: 0, as: 1.4 };
    D.werkAutoBij(car, 1 / 30);
    const stil = g.userData.bestuurder.visible;
    for (let i = 0; i < 30; i++) { car.z -= 0.3; D.werkAutoBij(car, 1 / 30); }
    const rijdt = g.userData.bestuurder.visible;
    car._detail.rijdT -= D.AUTODETAIL.bestuurderNa + 1; D.werkAutoBij(car, 1 / 30);
    const naStil = g.userData.bestuurder.visible;
    const p = { mesh: C.makeCar(0x777777, 'hatch', true), x: 0, z: 0, yaw: 0, speed: 0, steer: 0, as: 1.4 };
    D.spelerInAuto(p, true); D.werkAutoBij(p, 1 / 30);
    const derde = p.mesh.userData.bestuurder.visible, erik = !!p.mesh.userData.bestuurder.userData.erik;
    D.spelerInAuto(p, false); D.werkAutoBij(p, 1 / 30);
    const eerste = p.mesh.userData.bestuurder.visible;
    uit.wie = { stil, rijdt, naStil, derde, erik, eerste };
  }

  // ---- 3. wielen
  {
    const g = C.makeCar(0x777777, 'hatch', 'verkeer'), R = g.userData.R;
    const t = { mesh: g, snelheid: 10, soort: 'hatch' };
    const dt = 1 / 30;
    D.werkVerkeerBij(t, dt);
    const naaf = g.userData.wielen[2].naaf, voorL = g.userData.wielen[0], achter = g.userData.wielen[2];
    const r0 = naaf.rotation.x;
    for (let i = 0; i < 60; i++) { g.position.z -= 10 * dt; D.werkVerkeerBij(t, dt); }
    const vooruit = naaf.rotation.x - r0, afstand = 20;
    const r1 = naaf.rotation.x; t.snelheid = -3;
    for (let i = 0; i < 30; i++) { g.position.z += 3 * dt; D.werkVerkeerBij(t, dt); }
    const terug = naaf.rotation.x - r1;
    // een bocht naar links: de draai positief, op 8 m/s met 0,4 rad/s
    t.snelheid = 8; let yaw = 0;
    for (let i = 0; i < 60; i++) {
      yaw += 0.4 * dt; g.rotation.y = yaw;
      g.position.x -= Math.sin(yaw) * 8 * dt; g.position.z -= Math.cos(yaw) * 8 * dt;
      D.werkVerkeerBij(t, dt);
    }
    const verwacht = Math.atan(0.4 * 2.64 / 8);
    uit.wielen = { R, vooruit, verwachtV: -afstand / R, terug, verwachtT: 3 / R, stuurV: voorL.groep.rotation.y, stuurA: achter.groep.rotation.y, verwacht,
      naafEnBand: Math.abs(achter.band.rotation.x - achter.naaf.rotation.x) < 1e-9 };
    // de auto van de speler: car.steer en car.speed, ook achteruit
    const p = { mesh: C.makeCar(0x777777, 'hatch', true), x: 0, z: 0, yaw: 0, speed: 12, steer: -0.3, as: 1.4 };
    const pn = p.mesh.userData.wielen[3].naaf;
    D.werkAutoBij(p, dt, { gas: true, rem: false, hand: false });
    const q0 = pn.rotation.x;
    for (let i = 0; i < 30; i++) { p.z -= 12 * dt; D.werkAutoBij(p, dt, { gas: true, rem: false, hand: false }); }
    uit.speler = { stuur: p.mesh.userData.wielen[1].groep.rotation.y, rol: pn.rotation.x - q0, verwacht: -12 / p.mesh.userData.R };
  }

  // ---- 4. lichten
  {
    const dt = 1 / 30;
    const g = C.makeCar(0x777777, 'hatch', 'verkeer'), u = g.userData;
    const t = { mesh: g, snelheid: 12, soort: 'hatch' };
    const stap = (v, n) => { const res = []; for (let i = 0; i < n; i++) { t.snelheid = typeof v === 'function' ? v(i) : v; g.position.z -= t.snelheid * dt; D.werkVerkeerBij(t, dt); res.push(u.rem.visible); } return res; };
    stap(12, 30); const gelijk = u.rem.visible;
    let v = 12; const remmen = stap(() => (v = Math.max(0, v - 6 * dt)), 60);   // 6 m/s² tot stilstand
    const stilNaRemmen = u.rem.visible;
    stap(0, 30); const blijftStil = u.rem.visible;
    v = 0; stap(() => (v = v + 3 * dt), 30); const optrekken = u.rem.visible;
    // uitrollen op 1 m/s²: geen remmen
    v = 6; stap(() => (v = Math.max(0, v - 1 * dt)), 30); const uitrollen = u.rem.visible;
    stap(-2.5, 20); const achteruit = u.achteruit.visible, remAchteruit = u.rem.visible;
    stap(5, 30); const vooruitWit = u.achteruit.visible;
    uit.verkeer = { gelijk, remmen: remmen.filter(Boolean).length, stilNaRemmen, blijftStil, optrekken, uitrollen, achteruit, remAchteruit, vooruitWit };
    // de speler, met toetsen
    const p = { mesh: C.makeCar(0x777777, 'hatch', true), x: 0, z: 0, yaw: 0, speed: 8, steer: 0, as: 1.4 };
    const pu = p.mesh.userData;
    const met = (inv, speed) => { p.speed = speed; p.z -= speed * dt; D.werkAutoBij(p, dt, inv); return { rem: pu.rem.visible, wit: pu.achteruit.visible }; };
    uit.toetsen = {
      rem: met({ gas: false, rem: true, hand: false }, 8), gas: met({ gas: true, rem: false, hand: false }, 9),
      stilZonder: met({ gas: false, rem: false, hand: false }, 0), hand: met({ gas: false, rem: false, hand: true }, 4),
      achteruit: met({ gas: false, rem: true, hand: false }, -2),
    };
    // een missie-auto zonder toetsen (zoals Bouwman over zijn lijn): remmen uit de vertraging
    const m = { mesh: C.makeCar(0x222222, 'hatch', true), x: 0, z: 0, yaw: 0, speed: 0, steer: 0, as: 1.4 };
    let mv = 12; for (let i = 0; i < 30; i++) { m.z -= mv * dt; D.werkAutoBij(m, dt); }
    const missieGelijk = m.mesh.userData.rem.visible;
    for (let i = 0; i < 30; i++) { mv = Math.max(0, mv - 7 * dt); m.z -= mv * dt; D.werkAutoBij(m, dt); }
    uit.missie = { gelijk: missieGelijk, remt: m.mesh.userData.rem.visible };
    // feller dan het achterlicht 's nachts, en geen lampen
    C.zetKoplampen(true);
    const achter = []; g.traverse(o => { if (o.isMesh && o.material && o.material.emissive && o.material.emissive.r > 0.9 && o.material.emissive.g < 0.3 && o !== u.rem) achter.push(o.material.emissiveIntensity); });
    const gloed = u.rem.children.find(o => o.name === 'remgloed');
    uit.fel = { rem: u.rem.material.emissiveIntensity, achterNacht: Math.max(...achter), gloed: !!gloed, gloedNacht: gloed ? gloed.material.opacity : 0 };
    C.zetKoplampen(false);
    uit.fel.gloedDag = gloed ? gloed.material.opacity : 0;
    // de gloed om de achterlichten: achter de auto, aan beide kanten
    if (gloed) { gloed.geometry.computeBoundingBox(); const bb = gloed.geometry.boundingBox; uit.fel.gloedZ = +bb.min.z.toFixed(2); uit.fel.gloedX = [+bb.min.x.toFixed(2), +bb.max.x.toFixed(2)]; uit.fel.L = u.length; }
    let lampen = 0; for (const x of [g, p.mesh, m.mesh]) x.traverse(o => { if (o.isLight) lampen++; });
    uit.lampen = lampen;
  }
  return uit;
});

kop('1. de bestuurder per soort');
for (const [soort, r] of Object.entries(A.soorten)) {
  ok(r.volUit && r.verAan && r.verZonderBinnen, `${soort}: in een stilstaande auto uit voegToe niemand, in het verkeer wel (zonder interieur)`);
  ok(r.links, `${soort}: links achter het stuur`, `x ${r.xBereik.join(' … ')}`);
  ok(r.hemelMarge > 0.005 && r.dak && r.dak.d < 0.25, `${soort}: het hoofd onder de hemel, het dak recht erboven`, `${(r.hemelMarge * 100).toFixed(1)} cm onder de hemel; ${r.dak ? `${r.dak.naam} op ${(r.dak.d * 100).toFixed(1)} cm` : 'niets erboven'}`);
  ok(r.zit && r.zit.naam === 'zitting' && Math.abs(r.zit.d) < 0.10, `${soort}: de billen op de zitting`, r.zit ? `${r.zit.naam} ${(r.zit.d * 100).toFixed(1)} cm onder de billen` : 'geen zitting');
  ok(r.handen.every(h => h < 0.15), `${soort}: beide handen aan het stuur (≤ 15 cm van de krans)`, r.handen.map(h => `${(h * 100).toFixed(1)} cm`).join(', '));
  // (de ambulance is van buiten één dichte vorm met de ruiten erop geschilderd, js/carmodel.js: daar raakt geen straal hem)
  ok(r.buiten.uitN === 0 && (r.buiten.stralen > 0 || soort === 'ambulance'), `${soort}: van buiten steekt niets door de carrosserie`, `${r.buiten.uitN} van ${r.buiten.stralen} stralen op de bestuurder niet door glas${soort === 'ambulance' && !r.buiten.stralen ? ' (dichte romp)' : ''} ${r.buiten.waar.length ? JSON.stringify(r.buiten.waar) : ''}`);
  ok(r.driehoeken <= 3000, `${soort}: grof genoeg`, `${r.driehoeken} driehoeken`);
}
kop('2. wanneer zit er iemand in');
const w = A.wie;
ok(!w.stil && w.rijdt && !w.naStil, 'een auto uit voegToe: leeg tot hij rijdt, en weer leeg na een tijd stilstaan', JSON.stringify({ stil: w.stil, rijdt: w.rijdt, naStil: w.naStil }));
ok(w.derde && w.erik && !w.eerste, 'jouw auto: van buiten Erik achter het stuur, vanuit je ogen niemand', JSON.stringify({ derde: w.derde, erik: w.erik, eerste: w.eerste }));
kop('3. wielen');
const wl = A.wielen;
ok(Math.abs(wl.vooruit - wl.verwachtV) < 0.02 * Math.abs(wl.verwachtV), 'vooruit rolt de naaf afstand / straal', `${wl.vooruit.toFixed(2)} rad op 20 m, verwacht ${wl.verwachtV.toFixed(2)}`);
ok(Math.abs(wl.terug - wl.verwachtT) < 0.05 * Math.abs(wl.verwachtT), 'achteruit de andere kant op', `${wl.terug.toFixed(2)} rad op 3 m, verwacht ${wl.verwachtT.toFixed(2)}`);
ok(wl.naafEnBand, 'band en naaf rollen samen');
ok(wl.stuurV > 0 && Math.abs(wl.stuurV - wl.verwacht) < 0.03 && wl.stuurA === 0, 'een bocht naar links: de voorwielen naar links, zo ver als de bocht vraagt; de achterwielen recht', `voor ${wl.stuurV.toFixed(3)} rad (verwacht ${wl.verwacht.toFixed(3)}), achter ${wl.stuurA}`);
ok(Math.abs(A.speler.stuur - -0.3) < 0.02 && Math.abs(A.speler.rol - A.speler.verwacht) < 0.05 * Math.abs(A.speler.verwacht), 'jouw auto: de voorwielen op car.steer, rollen op car.speed', `stuur ${A.speler.stuur.toFixed(3)}, rol ${A.speler.rol.toFixed(2)} (verwacht ${A.speler.verwacht.toFixed(2)})`);
kop('4. lichten');
const v = A.verkeer;
ok(!v.gelijk && v.remmen > 40 && v.stilNaRemmen && v.blijftStil && !v.optrekken, 'verkeer: geen remlicht op gelijke vaart, aan bij remmen, blijft aan als hij stilstaat, uit bij optrekken', JSON.stringify(v));
ok(!v.uitrollen, 'verkeer: uitrollen (1 m/s²) is geen remmen');
ok(v.achteruit && !v.remAchteruit && !v.vooruitWit, 'verkeer: het witte licht alleen achteruit');
const tt = A.toetsen;
ok(tt.rem.rem && !tt.gas.rem && !tt.stilZonder.rem && tt.hand.rem, 'speler: remlicht bij de rem en de handrem, niet bij gas of stil zonder rem', JSON.stringify(tt));
ok(tt.achteruit.wit && !tt.achteruit.rem && !tt.gas.wit, 'speler: achteruit wit, zonder remlicht');
ok(!A.missie.gelijk && A.missie.remt, 'een missie-auto zonder toetsen remt met licht als hij vertraagt', JSON.stringify(A.missie));
ok(A.fel.rem > A.fel.achterNacht * 1.5, 'het remlicht feller dan het achterlicht \'s nachts', `${A.fel.rem} tegen ${A.fel.achterNacht}`);
ok(A.fel.gloed && A.fel.gloedNacht > A.fel.gloedDag && A.fel.gloedDag > 0 && A.fel.gloedZ > A.fel.L / 2 - 0.1 && A.fel.gloedX[0] < -0.3 && A.fel.gloedX[1] > 0.3,
  'een rode gloed om de achterlichten die met het remlicht meegaat, \'s nachts feller dan overdag', JSON.stringify(A.fel));
ok(A.lampen === 0, 'geen lichtbron in een auto', `${A.lampen}`);

// ------------------------------------------------------------------ deel B: in het spel
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 1800000 });
const S = await page.evaluate(async () => {
  const g = window.__game, W = await import('./js/world.js'), D = await import('./js/autodetail.js');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = false; window.__autoplay = false;
  await g.voorbereidSpel();
  const V = g.vehicles, uit = {};
  const lampen = () => { let n = 0; g.scene.traverse(o => { if (o.isLight) n++; }); return n; };
  uit.lampen0 = lampen();
  // ---- 5. bestuurders
  const wakker = V.traffic.filter(t => !t.slaapt);
  uit.verkeer = { n: V.traffic.length, wakker: wakker.length, metBestuurder: V.traffic.filter(t => t.mesh.userData.bestuurder && t.mesh.userData.verkeer).length };
  const t = wakker.find(x => x.lokaal) || wakker[0];
  const cam = g.camera;
  const volg = (achter = 9) => {
    const m = t.mesh, y = m.rotation.y;
    cam.position.set(m.position.x + Math.sin(y) * achter + 2.5, m.position.y + 2.2, m.position.z + Math.cos(y) * achter);
    cam.lookAt(m.position.x, m.position.y + 0.8, m.position.z); cam.updateMatrixWorld(true);
  };
  const stap = (n, dt = 1 / 30) => { for (let i = 0; i < n; i++) { volg(); V.updateTraffic(dt, g.player, null, cam.position.x, cam.position.z); } volg(); };
  stap(10);
  const u = t.mesh.userData;
  uit.dichtbij = { bestuurder: u.bestuurder.visible, wielen: u.wielen.every(w => w.groep.visible), samen: u.lod.ver.some(m => m.visible) };
  // ver weg
  const verWeg = V.traffic.find(x => !x.slaapt && x !== t && Math.hypot(x.mesh.position.x - cam.position.x, x.mesh.position.z - cam.position.z) > 120);
  uit.ver = verWeg ? { bestuurder: verWeg.mesh.userData.bestuurder.visible, wielen: verWeg.mesh.userData.wielen.some(w => w.groep.visible), samen: verWeg.mesh.userData.lod.ver.every(m => m.visible) } : null;
  // een geparkeerde auto die je klaarmaakt (zoals bij instappen): leeg
  const park = V.cars.find(c => c.inst && c.driveable);
  V.maakBestuurbaar(park); V.zetNeer(park, 1 / 30, park.yaw); V.zetNeer(park, 1 / 30, park.yaw);
  uit.geparkeerd = { bestuurder: park.mesh.userData.bestuurder.visible };
  // ---- 6. remmen in het verkeer: hij moet stoppen (zijn wens op nul), en daarna weer door
  const wens = t.speed;
  stap(20); const vaart0 = t.snelheid, remVoor = u.rem.visible;
  t.speed = 0; const remmen = []; for (let i = 0; i < 30; i++) { stap(1); remmen.push(u.rem.visible); }
  const stil = t.snelheid, remStil = u.rem.visible;
  // ---- 7a. programma's overdag met remlicht en bestuurder in beeld
  const R = g.renderer;
  const teken = () => { W.updateLOD(cam.position.x, cam.position.z); g.scene.updateMatrixWorld(true); R.render(g.scene, cam); return R.info.programs.length; };
  const progDag = [teken()];
  t.speed = wens; const optrek = []; for (let i = 0; i < 30; i++) { stap(1); optrek.push(u.rem.visible); }
  // achteruit (zoals na een aanrijding, `schrikAf`)
  t.achteruit = 2; const wit = []; for (let i = 0; i < 25; i++) { stap(1); wit.push(u.achteruit.visible); }
  progDag.push(teken());
  uit.remmen = { vaart0: +vaart0.toFixed(1), remVoor, remmen: remmen.filter(Boolean).length, stil: +stil.toFixed(2), remStil, optrek: optrek.slice(-10).filter(Boolean).length, wit: wit.slice(-10).filter(Boolean).length, snelheidAchteruit: +t.snelheid.toFixed(2) };
  // ---- 7b. 's nachts
  g.sfeer.uur = 1; for (let i = 0; i < 3; i++) g.sfeer.update(0.1, cam.position.x, cam.position.z);
  stap(5);
  const progNacht = [teken()];
  t.achteruit = 0; t.speed = wens; for (let i = 0; i < 40; i++) stap(1);
  t.speed = 0; for (let i = 0; i < 20; i++) stap(1);
  uit.remNacht = u.rem.visible; uit.slaaptNacht = !!t.slaapt;
  progNacht.push(teken());
  t.speed = wens;
  uit.prog = { dag: progDag, nacht: progNacht };
  uit.lampen1 = lampen();
  return uit;
});
kop('5. bestuurders in het spel');
ok(S.verkeer.metBestuurder === S.verkeer.n && S.verkeer.n > 20, 'elke auto van het verkeer heeft een bestuurder', `${S.verkeer.metBestuurder} van ${S.verkeer.n} (${S.verkeer.wakker} wakker)`);
ok(S.dichtbij.bestuurder && S.dichtbij.wielen && !S.dichtbij.samen, 'dichtbij: de bestuurder en losse wielen', JSON.stringify(S.dichtbij));
ok(S.ver && !S.ver.bestuurder && !S.ver.wielen && S.ver.samen, 'voorbij 90 m: de samengevoegde wielen, geen bestuurder', JSON.stringify(S.ver));
ok(!S.geparkeerd.bestuurder, 'een geparkeerde auto blijft leeg');
kop('6. remmen in het verkeer');
const rm = S.remmen;
ok(!rm.remVoor && rm.remmen > 5 && rm.stil < 0.3 && rm.remStil, 'hij moet stoppen: remlicht aan, en aan tot stilstand', JSON.stringify(rm));
ok(rm.optrek === 0, 'hij trekt weer op: het remlicht uit');
ok(rm.wit >= 8 && rm.snelheidAchteruit < -0.2, 'achteruit: het witte licht');
ok(S.remNacht && !S.slaaptNacht, "'s nachts remt hij ook met licht", JSON.stringify({ rem: S.remNacht, slaapt: S.slaaptNacht }));
kop('7. shaders en lichtbronnen');
ok(S.prog.dag[1] === S.prog.dag[0], 'overdag geen nieuw programma met remlicht, achteruitrijlicht en bestuurder in beeld', S.prog.dag.join(' → '));
ok(S.prog.nacht[1] === S.prog.nacht[0], "'s nachts geen nieuw programma", S.prog.nacht.join(' → '));
ok(S.lampen1 === S.lampen0, 'het aantal lichtbronnen in de scène blijft gelijk', `${S.lampen0} → ${S.lampen1}`);

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);

/*
 De ronde van 20 september 2026.

   npm run server &   node tools/sniptest.mjs [poort]

 Vijf punten:

 1. De sniper: het derde wapen bij Tinga State. Eén schot per keer, een kijker
    erop, rechtermuisknop om erdoor te kijken en het scrollwiel om te zoomen.
 2. De koplampen werpen 's nachts licht op de weg in plaats van alleen zelf op
    te lichten.
 3. Ranzijn Tuin & Dier is een kas met een glazen puntgevel en het gele bord,
    geen grijze loods met een streepje.
 4. De fietsers zaten vierenveertig centimeter boven hun zadel en trapten een
    halve meter vóór de trapas in de lucht.
 5. Uit de steekproef: kopgevels kregen de witte wangen van een dakkapel, en er
    stonden bomen en struiken op de stoep en in het water.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let goed = 0, fout = 0;
const ok = (naam, waar, extra = '') => {
  if (waar) { goed++; console.log(`  ✓ ${naam}${extra ? ' — ' + extra : ''}`); }
  else { fout++; console.log(`  ✗ ${naam}${extra ? ' — ' + extra : ''}`); }
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const fouten = [];
page.on('pageerror', e => fouten.push(e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(() => {
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
});

// --------------------------------------------------------------- de sniper
console.log('\nde sniper');
const sn = await page.evaluate(async () => {
  const { WAPENS } = await import('/js/player.js');
  const B = await import('/js/boerderij.js');
  const g = window.__game;
  const p = g.player;
  const uit = { info: WAPENS.sniper, prijs: B.SNIPER && B.SNIPER.prijs, model: !!p.modellen.sniper };
  // kopen en in de hand nemen
  p.reserve = 200;
  p.krijgWapen('sniper');
  uit.inHand = p.wapenSoort;
  uit.mag = p.ammo;
  /*
   Eerst de wisselbeweging laten aflopen. `krijgWapen` zet `wisselT` op de tijd
   die het trekken kost, en zolang die loopt weigert `richten` — je bent het
   wapen aan het optrekken. Zonder deze regels blijft `mik` nul en gaat de
   beeldhoek nooit dicht; dat is geen fout in de kijker maar in de toets.
  */
  for (let i = 0; i < 60; i++) p.update(1 / 60);
  // door de kijker kijken: de beeldhoek moet fors dichtgaan
  const fovUit = p.camera.fov;
  p.richten(true);
  for (let i = 0; i < 40; i++) p.update(1 / 60);
  uit.fovUit = fovUit; uit.fovIn = p.camera.fov;
  uit.zoom = p.zoom;
  uit.scopeAan = !document.getElementById('scope').hidden;
  uit.wapenWeg = p.gun.visible === false;
  // scrollen zoomt in en uit, en loopt niet voorbij de grenzen
  const z0 = p.zoom;
  for (let i = 0; i < 3; i++) p.zoomStap(1);
  uit.naIn = p.zoom;
  for (let i = 0; i < 20; i++) p.zoomStap(1);
  uit.max = p.zoom;
  for (let i = 0; i < 40; i++) p.zoomStap(-1);
  uit.min = p.zoom;
  uit.opliep = uit.naIn > z0;
  // en met het pistool doet het scrollwiel gewoon weer van wapen wisselen
  p.richten(false);
  for (let i = 0; i < 30; i++) p.update(1 / 60);
  p.zetWapen('pistool');
  uit.pistoolZoom = p.zoom;
  uit.pistoolScope = !!p.wapenInfo.scope;
  for (let i = 0; i < 20; i++) p.update(1 / 60);
  uit.scopeUit = document.getElementById('scope').hidden;
  return uit;
});
ok('de sniper staat in de wapenlijst', !!sn.info, sn.info ? `${sn.info.naam}, ${sn.info.mag} patronen` : 'niet');
ok('hij schiet niet automatisch en laadt traag door',
  sn.info && sn.info.auto === false && sn.info.tempo > 0.5, sn.info ? `${sn.info.tempo} s tussen twee schoten` : '');
ok('hij kost € 650 bij Tinga State', sn.prijs === 650, `€ ${sn.prijs}`);
ok('er is een model voor', sn.model === true);
ok('je krijgt hem in handen met een vol magazijn', sn.inHand === 'sniper' && sn.mag === 5, `${sn.mag} patronen`);
ok('door de kijker gaat de beeldhoek fors dicht',
  sn.fovIn < sn.fovUit / 3, `${sn.fovUit.toFixed(0)}° → ${sn.fovIn.toFixed(1)}°`);
ok('het kijkerbeeld staat in beeld en het wapen niet', sn.scopeAan === true && sn.wapenWeg === true);
ok('scrollen zoomt in', sn.opliep === true, `${sn.zoom}× → ${sn.naIn}×`);
ok('en loopt niet voorbij de grenzen',
  sn.max === sn.info.scope.max && sn.min === sn.info.scope.min, `${sn.min}× tot ${sn.max}×`);
ok('met het pistool is er geen kijker', sn.pistoolScope === false && sn.pistoolZoom === 1);
ok('en het kijkerbeeld is weg', sn.scopeUit === true);

// ------------------------------------------------------------ de koplampen
console.log('\nde koplampen in het donker');
const lamp = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  const spots = [];
  g.scene.traverse(o => { if (o.isSpotLight) spots.push(o); });
  if (!spots.length) return null;
  const l = spots[0];
  const uit = { n: spots.length, bereik: l.distance, hoek: +(l.angle).toFixed(2), overdag: l.visible };
  /*
   Op een recht stuk weg, met een auto mét eigen mesh: de geparkeerde auto's
   staan als instanced meshes in de wereld en hebben er geen, en dan loopt de
   hoofdlus stuk op `car.mesh.position`. Het rechte vak komt uit KAART.wegassen,
   zodat er ook echt asfalt vóór de bundel ligt om op te vallen.
  */
  let beste = null;
  for (const w of KAART.wegassen) {
    if (!w.drive) continue;
    for (let i = 0; i + 1 < w.pts.length; i++) {
      const a = w.pts[i], b = w.pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L > 60 && L < 200 && (!beste || L > beste.L)) beste = { a, b, L };
    }
  }
  if (!beste) return { ...uit, geenWeg: true };
  const dx = (beste.b[0] - beste.a[0]) / beste.L, dz = (beste.b[1] - beste.a[1]) / beste.L;
  const car = g.vehicles.voegToe({ x: beste.a[0] + dx * 6, z: beste.a[1] + dz * 6,
    yaw: Math.atan2(-dx, -dz), soort: 'hatch', kleur: 0x2a3f8f });
  if (!car || !car.mesh) return { ...uit, geenAuto: true };
  g.player.pos.set(car.x, 0, car.z);
  g.player.inCar = car;
  g.player.yaw = car.yaw; g.player.pitch = -0.06;
  g.sfeer.uur = 23.5;
  for (let i = 0; i < 40; i++) await new Promise(r => requestAnimationFrame(r));
  uit.nacht = g.sfeer.nacht;
  uit.aan = l.visible && l.intensity > 0;
  // de bundel wijst voor de auto uit en niet naar de oorsprong
  const vx = -Math.sin(car.yaw), vz = -Math.cos(car.yaw);
  const dx2 = l.target.position.x - car.x, dz2 = l.target.position.z - car.z;
  const lengte = Math.hypot(dx2, dz2) || 1;
  uit.vooruit = +((dx2 / lengte) * vx + (dz2 / lengte) * vz).toFixed(2);
  uit.doelOnder = l.target.position.y < l.position.y;
  /*
   En of er ook werkelijk licht op de weg valt. Dat is niet hetzelfde als een
   lamp die aanstaat: de eerste versie scheen vanaf 0,62 m recht vooruit, en dan
   strijkt de bundel zo scheer over het asfalt dat er van het licht bijna niets
   overblijft (de invalshoek eet het op). Gemeten aan het beeld zelf: het strookje
   weg vóór de motorkap was 90,2 met lamp en 83,8 zonder — zeven procent. Nu
   staat de lamp hoger en schijnt hij korter vooruit, en is dat een derde.
  */
  const beeld = () => new Promise(r => requestAnimationFrame(() => {
    const cv = g.renderer.domElement;
    const c2 = document.createElement('canvas');
    c2.width = cv.width; c2.height = cv.height;
    const ctx = c2.getContext('2d');
    ctx.drawImage(cv, 0, 0);
    const x0 = Math.floor(cv.width * 0.42), x1 = Math.floor(cv.width * 0.58);
    const y0 = Math.floor(cv.height * 0.47), y1 = Math.floor(cv.height * 0.55);
    const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    let som = 0;
    for (let i = 0; i < d.length; i += 4) som += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    r(+(som / (d.length / 4)).toFixed(1));
  }));
  uit.licht = await beeld();
  // de lamp doven zonder dat de hoofdlus hem meteen weer aanzet
  Object.defineProperty(l, 'intensity', { get: () => 0, set: () => {} });
  for (let i = 0; i < 10; i++) await new Promise(r => requestAnimationFrame(r));
  uit.donker = await beeld();
  // uitstappen zet hem weer uit
  g.player.inCar = null;
  for (let i = 0; i < 12; i++) await new Promise(r => requestAnimationFrame(r));
  uit.naUitstappen = l.visible;
  g.sfeer.uur = 13;
  return uit;
});
ok('er is precies één koplampspot', lamp && lamp.n === 1, lamp ? `${lamp.n}` : 'geen');
ok('overdag staat hij uit', lamp && lamp.overdag === false);
ok("'s nachts in de auto brandt hij", lamp && lamp.nacht === true && lamp.aan === true);
ok('en hij schijnt vooruit, iets omlaag',
  lamp && lamp.vooruit > 0.95 && lamp.doelOnder === true, lamp ? `richting ${lamp.vooruit}` : '');
ok('hij reikt tot een meter of zestig', lamp && lamp.bereik > 40, lamp ? `${lamp.bereik} m` : '');
ok('en er valt ook echt licht op de weg', lamp && lamp.licht > lamp.donker * 1.15,
  lamp ? `${lamp.licht} met, ${lamp.donker} zonder` : '');
ok('en uit de auto gaat hij uit', lamp && lamp.naUitstappen === false);

// ----------------------------------------------------------- het tuincentrum
console.log('\nRanzijn Tuin & Dier');
const tc = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const T = await import('/js/textures.js');
  const p = KAART.panden.find(q => q.type === 'tuincentrum');
  const st = T.HOUSE_STYLES.tuincentrum;
  return { id: p && p.id, straat: p && p.straat, goot: p && p.goot, nok: p && p.nok,
    dak: st.roofType, pui: st.puiDeel, merk: st.merk, zon: !!st.solar };
});
ok('het tuincentrum staat in de kaart', !!tc.id, `${tc.straat} (${tc.id})`);
ok('het heeft een puntdak, geen plat dak', tc.dak === 'gable', `goot ${tc.goot} m, nok ${tc.nok} m`);
ok('de pui loopt tot onder de dakrand door', tc.pui > 0.8, `${tc.pui}`);
ok('met het woordmerk en zonnepanelen', tc.merk === 'RANZIJN' && tc.zon === true);

// --------------------------------------------------------------- de fietsers
console.log('\nde fietsers');
/*
 Gemeten aan wat er werkelijk staat, niet aan de houding op papier.

 De eerste versie van deze toets rekende de heup, de hand en de voet zelf uit
 de gewrichtshoeken uit en kantelde ze daarna over de voorovergebogen stand. Hij
 stond op groen terwijl de rijder in beeld veertig centimeter achter zijn zadel
 zat: de toets maakte dezelfde tekenfout als js/npc.js, dus de twee waren het
 keurig met elkaar eens en allebei mis.

 Nu leest hij de instantiematrices uit de scene — de plek waar de wielrenner
 echt getekend wordt — en rekent die terug naar het assenstelsel van de fiets.
 Dan staan de maten van fietsGeo() er rechtstreeks naast.
*/
const fiets = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  const nr = g.npcs.people.findIndex(p => p.fietst && p.alive !== false);
  if (nr < 0) return null;
  // alleen wie binnen tweehonderd meter is heeft een lichaam in de meshes, en
  // zijn instantie is `slotVan[nr]`: één beeld bijwerken vanaf waar hij fietst
  const w = g.npcs.people[nr];
  g.npcs.update(0.001, 0, w.x, w.z);
  const i = g.npcs.slotVan[nr];
  if (i < 0) return null;
  const M = new THREE.Matrix4();
  g.npcs.fiets.getMatrixAt(i, M);
  const inv = new THREE.Matrix4().copy(M).invert();
  // waar staat dit gewricht, gerekend vanaf de fiets zelf?
  const lokaal = (mesh, nr) => {
    const m2 = new THREE.Matrix4();
    mesh.getMatrixAt(nr, m2);
    const p = new THREE.Vector3().setFromMatrixPosition(m2).applyMatrix4(inv);
    return { z: +p.z.toFixed(2), y: +p.y.toFixed(2) };
  };
  return {
    n: g.npcs.people.filter(p => p.fietst).length,
    heup: lokaal(g.npcs.meshes.bovenbeen, i * 2),
    hand: lokaal(g.npcs.meshes.hand, i * 2),
    voet: lokaal(g.npcs.meshes.schoen, i * 2),
  };
});
/*
 De maten van de fiets staan in js/npc.js (fietsGeo): het zadel op (−0,20, 0,88),
 de trapas op (−0,49, 0,26) en het stuur op (−0,80, 1,20). De enkel draait om de
 trapas heen — trapperarm plus de afstand van de enkel tot de trapper — dus daar
 hoort een ring omheen en geen punt.
*/
const ZADEL = { z: -0.20, y: 0.88 }, TRAPAS = { z: -0.49, y: 0.26 }, STUUR = { z: -0.80, y: 1.20 };
const afst = (a, b) => Math.hypot(a.z - b.z, a.y - b.y);
ok('er rijden fietsers rond', !!fiets && fiets.n > 0, fiets ? `${fiets.n} van de 130` : 'geen');
ok('de heup zit op het zadel', fiets && afst(fiets.heup, ZADEL) < 0.16,
  fiets ? `heup op (${fiets.heup.z}, ${fiets.heup.y}), zadel op (${ZADEL.z}, ${ZADEL.y})` : '');
ok('de handen liggen op het stuur', fiets && afst(fiets.hand, STUUR) < 0.20,
  fiets ? `hand op (${fiets.hand.z}, ${fiets.hand.y}), stuur op (${STUUR.z}, ${STUUR.y})` : '');
const rond = fiets ? afst(fiets.voet, TRAPAS) : 0;
ok('en de voeten draaien om de trapas', fiets && rond > 0.05 && rond < 0.38,
  fiets ? `enkel op (${fiets.voet.z}, ${fiets.voet.y}), ${rond.toFixed(2)} m van de trapas` : '');

// ------------------------------------------------------- uit de steekproef
console.log('\nwat de steekproef opleverde');
const steek = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  // 1. kopgevels met witte kapelwangen
  /*
   Per dríéhoek meten, niet per mesh: alle dakkapellen van de hele kaart zitten
   in een handvol meshes, dus de omhullende daarvan is honderden meters breed en
   zegt niets. Een kapelwang is een driehoek van hoogstens een paar meter; een
   kopgevel die er per ongeluk als wang in terecht kwam is er een van negen.
  */
  const g = window.__game;
  let breedste = 0, wangen = 0, top = null;
  g.scene.traverse(o => {
    if (!o.isMesh || o.userData.klasse !== 'dakkapel') return;
    wangen++;
    const pos = o.geometry.getAttribute('position');
    // een geindexeerde geometrie heeft zijn driehoeken in de index staan, niet
    // in de volgorde van de hoekpunten; zonder dit meet je drie willekeurige
    // punten uit de hele kaart als één driehoek
    const idx = o.geometry.getIndex();
    const n = idx ? idx.count : pos.count;
    const hoek = (i) => (idx ? idx.getX(i) : i);
    for (let i = 0; i + 2 < n; i += 3) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let k = 0; k < 3; k++) {
        const h = hoek(i + k);
        const x = pos.getX(h), z = pos.getZ(h);
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
      const w = Math.hypot(x1 - x0, z1 - z0);
      if (w > breedste) { breedste = w; top = { w: +w.toFixed(1), x: +x0.toFixed(0), z: +z0.toFixed(0) }; }
    }
  });
  const kapelTop = top;
  // 2. bomen en struiken op verharding of in het water
  const HARD = new Set(['rijbaan', 'autoweg', 'parkeervlak', 'asfaltvlak', 'fietspad',
    'voetpad', 'verharding', 'inrit', 'water', 'brug', 'steiger']);
  const inRing = (r, x, z) => {
    let b = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i], c = r[j];
      if ((a[1] > z) !== (c[1] > z) && x < (c[0] - a[0]) * (z - a[1]) / (c[1] - a[1]) + a[0]) b = !b;
    }
    return b;
  };
  const CEL = 40, net = new Map();
  for (const v of KAART.vlakken) {
    if (!HARD.has(v.k)) continue;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const r of v.r) for (const p of r) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1];
    }
    for (let i = Math.floor(x0 / CEL); i <= Math.floor(x1 / CEL); i++) {
      for (let j = Math.floor(z0 / CEL); j <= Math.floor(z1 / CEL); j++) {
        const k = `${i}:${j}`;
        if (!net.has(k)) net.set(k, []);
        net.get(k).push({ v, bb: [x0, x1, z0, z1] });
      }
    }
  }
  const op = (x, z) => {
    const l = net.get(`${Math.floor(x / CEL)}:${Math.floor(z / CEL)}`);
    if (!l) return null;
    for (const { v, bb } of l) {
      if (x < bb[0] || x > bb[1] || z < bb[2] || z > bb[3]) continue;
      if (!inRing(v.r[0], x, z)) continue;
      let gat = false;
      for (let i = 1; i < v.r.length; i++) if (inRing(v.r[i], x, z)) { gat = true; break; }
      if (!gat) return v.k;
    }
    return null;
  };
  let bFout = 0, sFout = 0;
  for (const b of KAART.bomen) if (op(b.x, b.z)) bFout++;
  for (const s of (KAART.struiken || [])) if (op(s.x, s.z)) sFout++;
  return { wangen, breedste: +breedste.toFixed(1), top: kapelTop, bomen: KAART.bomen.length, bFout,
    struiken: (KAART.struiken || []).length, sFout };
});
ok('er staan nog dakkapellen', steek.wangen > 0, `${steek.wangen} meshes`);
ok('maar geen kopgevel meer met de witte wangen van een kapel',
  steek.breedste < 5.0, `breedste wangdriehoek ${steek.breedste} m`);
ok('bijna geen boom meer op de stoep of in het water',
  steek.bFout / steek.bomen < 0.002, `${steek.bFout} van de ${steek.bomen}`);
ok('en bijna geen struik', steek.sFout / steek.struiken < 0.002, `${steek.sFout} van de ${steek.struiken}`);

console.log(`\nfouten in de pagina: ${fouten.length ? fouten.join(' | ') : 'geen'}`);
if (fouten.length) fout++;
console.log(`\n${goed} goed, ${fout} fout`);
await browser.close();
process.exit(fout ? 1 : 0);

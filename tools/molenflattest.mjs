/*
 Stap 163: de flats aan de Molenkrite (npm run molenflattest).
 Gevraagd: "verbeter ook deze woningen: 399.9, -26.9 zie foto van straatkant."

   1. beide panden zijn gebouwd (BAG 0091100000006034 en 0091100000006042), op hun voetafdruk, en het oude kale blok is
      weg: een straal van boven raakt het nieuwe platte dak en niets van een oud blok eronder;
   2. de hoogtes: elk deel op de hoogte van zijn dakvlak in de 3D BAG, het hoogste op de nok van het pand;
   3. de straatgevel: stralen op raamhoogte raken een raam of een blauw kozijn (elk raam van voren, en een waaier vanaf
      waar de gebruiker stond); het kozijn is blauw, de baksteen donker bruin;
   4. de witte dakrand steekt uit: een straal omlaag een halve meter voor de gevel raakt de rand, een straal omhoog zijn
      onderkant; het dakschild erboven is donker;
   5. loggia's: een nis van ruim een meter diep, met een hek of een borstwering;
   6. de bergingen: een blauwe boeiboord; schoorstenen boven het dak; het trappenhuis;
   7. de botsdozen van de panden blijven;
   8. 's nachts licht achter een deel van de ramen, alleen met emissiveIntensity;
   9. geen nieuw shaderprogramma als de flats in beeld komen (dag en nacht).

 Gebruik: npm run server &  node tools/molenflattest.mjs [poort]
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
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 1800000 });

const r = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game, W = await import('./js/world.js');
  const { KAART } = await import('./js/kaart.js');
  const { MOLENFLAT, MOLENFLAT_PAND, regios } = await import('./js/molenflat.js');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = false; window.__autoplay = false;
  await g.voorbereidSpel();
  g.reliëfAf();
  const A = MOLENFLAT_PAND.nu, uit = { er: !!A, viaGame: g.molenflat === A };
  if (!A) return uit;
  const MAT = A.materialen;
  const naam = (h) => h.object.userData.klasse === 'molenflat' ? h.object.name : (h.object.userData.klasse || h.object.name || '?');
  const binnen = (x, z, v) => { let c = false; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const a = v[i], b = v[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  const randAfst = (x, z, v) => { let best = Infinity; for (let i = 0, j = v.length - 1; i < v.length; j = i++) { const a = v[j], b = v[i], dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)); best = Math.min(best, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z)); } return best; };
  const midden = (ring) => { let x = 0, z = 0; for (const q of ring) { x += q[0]; z += q[1]; } return [x / ring.length, z / ring.length]; };
  W.updateLOD(420, -55); g.scene.updateMatrixWorld(true);
  const alles = (o, d, ver = 80, wat = g.scene.children) => new THREE.Raycaster(o, d.clone().normalize(), 0, ver).intersectObjects(wat, true)
    .filter(h => h.object.visible && h.object.isMesh && !h.object.isInstancedMesh && !h.object.isSprite);
  const eigen = (o, d, ver = 80) => alles(o, d, ver, A.groep.children);
  const doekGem = (tex) => {
    const img = tex.image, c = img.getContext('2d').getImageData(0, 0, img.width, img.height).data;
    let r = 0, gr = 0, b = 0, n = 0; for (let i = 0; i < c.length; i += 4) { r += c[i]; gr += c[i + 1]; b += c[i + 2]; n++; }
    return [r / n, gr / n, b / n].map(Math.round);
  };
  // het trappenhuis in het midden is een eigen pand van js/kaartwereld.js: daar niet van boven meten
  const torens = KAART.panden.filter(p => ['0091100000014656', '0091100000006038'].includes(p.id)).map(p => p.voet);

  // ---- 1 en 2. op de voetafdruk, het oude blok weg, de hoogtes
  uit.panden = A.panden.map(P => {
    const p = KAART.panden.find(q => q.id === P.id);
    const bag = regios(p);
    const delen = P.regios.map(R => {
      const [cx, cz] = midden(R.top || R.ring);
      let x = cx, z = cz;
      if (!binnen(x, z, R.top || R.ring) || torens.some(t => binnen(x, z, t) || randAfst(x, z, t) < 1)) {
        // het midden ligt niet in het deel (een L-vorm) of boven het trappenhuis: een punt van de ring een stukje naar binnen
        for (const q of R.ring) { const nx = q[0] + (cx - q[0]) * 0.3, nz = q[1] + (cz - q[1]) * 0.3; if (binnen(nx, nz, R.ring) && !torens.some(t => binnen(nx, nz, t) || randAfst(nx, nz, t) < 1)) { x = nx; z = nz; break; } }
      }
      const hs = alles(new THREE.Vector3(x, 60, z), new THREE.Vector3(0, -1, 0), 80);
      const eerste = hs[0];
      return {
        H: +R.H.toFixed(2), Hw: +R.Hw.toFixed(2), berging: R.berging, lagen: R.lagen,
        raak: eerste ? naam(eerste) : null, y: eerste ? +(eerste.point.y - P.grond).toFixed(2) : null,
        // alles onder het eerste dak tot het maaiveld: van de flat zelf (of de grond)
        eronder: hs.slice(1).filter(h => h.point.y > P.grond + 0.5 && h.object.userData.klasse !== 'molenflat').map(h => `${naam(h)}@${h.point.y.toFixed(1)}`),
        bagH: +(bag.find(b => Math.abs(b.H - R.H) < 0.01) || { H: NaN }).H.toFixed(2),
        opVoet: R.ring.every(q => binnen(q[0], q[1], p.voet) || randAfst(q[0], q[1], p.voet) < 0.4),
      };
    });
    // de hoogste hoogte die een straal van boven vindt, tegen de nok van het pand
    let top = 0;
    for (let x = Math.min(...p.voet.map(q => q[0])); x < Math.max(...p.voet.map(q => q[0])); x += 1.5)
      for (let z = Math.min(...p.voet.map(q => q[1])); z < Math.max(...p.voet.map(q => q[1])); z += 1.5) {
        if (!binnen(x, z, p.voet)) continue;
        const h = eigen(new THREE.Vector3(x, 60, z), new THREE.Vector3(0, -1, 0))[0];
        if (h && h.object.name === 'platdak') top = Math.max(top, h.point.y - P.grond);
      }
    // het trappenhuis: ook van deze module, met een blauwe band
    const trap = P.torens.map(T => {
      const [tx, tz] = midden(T.voet);
      const hs = alles(new THREE.Vector3(tx, 60, tz), new THREE.Vector3(0, -1, 0), 80).filter(h => h.point.y > P.grond + 0.5);
      return { H: +T.H.toFixed(2), alleenFlat: hs.length > 0 && hs.every(h => h.object.userData.klasse === 'molenflat') };
    });
    return { id: P.id, nr: P.nr, nok: p.nok, goot: p.goot, top: +top.toFixed(2), delen, torens: trap, schoorstenen: P.schoorstenen.length,
      schoorsteenBoven: P.schoorstenen.every(s => s.punt.y > P.grond + s.H + 1) };
  });

  // ---- 3. de straatgevel: elk raam van voren
  const gevelRamen = A.ramen.filter(w => w.gevel && !w.strook);
  let raak = 0; const mis = [];
  for (const w of gevelRamen) {
    const o = w.midden.clone().addScaledVector(w.naar, 3);
    const h = eigen(o, w.naar.clone().negate(), 6)[0];
    if (h && ['glas', 'glasLicht', 'kozijn'].includes(naam(h)) && Math.abs(h.distance - 3) < 0.2) raak++; else if (mis.length < 5) mis.push(h ? `${naam(h)}@${h.distance.toFixed(2)}` : '-');
  }
  uit.ramen = { aantal: gevelRamen.length, raak, mis, perPand: A.panden.map(P => gevelRamen.filter(w => P.voet && randAfst(w.midden.x, w.midden.z, P.voet) < 3).length) };
  // een waaier vanaf waar de gebruiker stond (399.9, -26.9), op drie hoogtes
  const user = new THREE.Vector3(399.9, 0, -26.9), g0 = A.panden[0].grond;
  uit.waaier = [1.6, 4.6, 7.6].map(yy => {
    let flat = 0, ruit = 0, steen = 0, anders = 0;
    for (let a = -0.9; a <= 0.25; a += 0.01) {
      const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));   // van oost (0) naar noordoost en zuidoost
      const hs = alles(new THREE.Vector3(user.x, g0 + yy, user.z), d, 90);
      const h = hs.find(h => h.object.userData.klasse === 'molenflat' || ['gebouw', 'pand', 'gevel'].includes(h.object.userData.klasse));
      if (!h) continue;
      if (h.object.userData.klasse !== 'molenflat') { anders++; continue; }
      flat++;
      if (['glas', 'glasLicht', 'kozijn'].includes(naam(h))) ruit++; else if (naam(h) === 'steen') steen++;
    }
    return { y: yy, flat, ruit, steen, anders };
  });
  uit.kozijn = MAT.kozijn.color.toArray().map(v => +v.toFixed(2));
  uit.steen = doekGem(MAT.steen.map);
  uit.dak = doekGem(MAT.dak.map);

  // ---- 4. de witte dakrand
  const randen = [];
  for (const P of A.panden) for (const R of P.regios) {
    if (R.berging) continue;
    for (const e of R.randen) {
      if (e.binnen || e.l < 2.5) continue;
      const mx = (e.A[0] + e.B[0]) / 2, mz = (e.A[1] + e.B[1]) / 2;
      // van net boven de rand naar beneden (boven een lager deel naast een hoger hangt anders de kap van het hogere erboven)
      const neer = eigen(new THREE.Vector3(mx + e.o[0] * 0.45, P.grond + R.Hw + MOLENFLAT.rand + 0.3, mz + e.o[1] * 0.45), new THREE.Vector3(0, -1, 0), 20)[0];
      const op = eigen(new THREE.Vector3(mx + e.o[0] * 0.35, P.grond + R.Hw - 0.6, mz + e.o[1] * 0.35), new THREE.Vector3(0, 1, 0), 5)[0];
      // een stukje binnen de gevel, net onder de dakhoogte: het donkere dakschild
      const schild = eigen(new THREE.Vector3(mx - e.o[0] * 0.2, P.grond + R.H + 0.3, mz - e.o[1] * 0.2), new THREE.Vector3(0, -1, 0), 20)[0];
      randen.push({ neer: neer ? naam(neer) : '-', neerY: neer ? +(neer.point.y - P.grond - R.Hw).toFixed(2) : null, op: op ? naam(op) : '-', opY: op ? +(op.point.y - P.grond - R.Hw).toFixed(2) : null,
        schild: schild ? naam(schild) : '-' });
    }
  }
  uit.randen = {
    aantal: randen.length,
    neer: randen.filter(q => q.neer === 'rand' && q.neerY > 0 && q.neerY < MOLENFLAT.rand + 0.05).length,
    op: randen.filter(q => q.op === 'onderrand' && Math.abs(q.opY) < 0.05).length,
    schild: randen.filter(q => q.schild === 'dak').length,
    mis: randen.filter(q => q.neer !== 'rand' || q.op !== 'onderrand').slice(0, 4),
  };

  // ---- 5. loggia's: hoe diep is de nis?
  uit.loggias = { aantal: A.loggias.length, hek: A.loggias.filter(l => l.hek).length,
    diep: A.loggias.slice(0, 40).map(l => { const o = l.midden.clone().addScaledVector(l.naar, 3); const h = eigen(o, l.naar.clone().negate(), 8)[0]; return h ? +(h.distance - 3).toFixed(2) : null; }),
    perPand: A.panden.map(P => A.loggias.filter(l => randAfst(l.midden.x, l.midden.z, P.voet) < 3).length) };

  // ---- 6. de bergingen
  uit.bergingen = A.panden.map(P => P.regios.filter(R => R.berging).map(R => {
    const e = R.randen.filter(q => !q.binnen).sort((a, b) => b.l - a.l)[0];
    if (!e) return null;
    const mx = (e.A[0] + e.B[0]) / 2, mz = (e.A[1] + e.B[1]) / 2;
    const d = new THREE.Vector3(-e.o[0], 0, -e.o[1]);
    const h = eigen(new THREE.Vector3(mx + e.o[0] * 3, P.grond + R.H - 0.25, mz + e.o[1] * 3), d, 6)[0];
    const laag = eigen(new THREE.Vector3(mx + e.o[0] * 3, P.grond + 1.5, mz + e.o[1] * 3), d, 6)[0];
    return { H: +R.H.toFixed(2), boei: h ? naam(h) : '-', muur: laag ? naam(laag) : '-' };
  }).filter(Boolean));
  uit.blauw = MAT.blauw.color.toArray().map(v => +v.toFixed(2));

  // ---- 7. botsdozen
  // elk deel ligt onder botsdozen: een rooster van punten in het deel (niet vlak bij de rand), elk binnen een doos. (De dozen
  // zijn strookjes over de voetafdruk; tussen twee strookjes zit soms een naad van een paar millimeter: 3 cm speling.)
  const bedekt = (x, z) => W.colliders.some(c => {
    if (!(c.h > 2)) return false;
    const dx = x - c.cx, dz = z - c.cz, lx = dx * c.cos - dz * c.sin, lz = dx * c.sin + dz * c.cos;
    return Math.abs(lx) <= c.hx + 0.03 && Math.abs(lz) <= c.hz + 0.03;
  });
  uit.bots = A.panden.map(P => P.regios.map(R => {
    let n = 0, in1 = 0;
    const xs = R.ring.map(q => q[0]), zs = R.ring.map(q => q[1]);
    for (let x = Math.min(...xs); x < Math.max(...xs); x += 0.7) for (let z = Math.min(...zs); z < Math.max(...zs); z += 0.7) {
      if (!binnen(x, z, R.ring) || randAfst(x, z, R.ring) < 0.6) continue;
      n++; if (bedekt(x, z)) in1++;
    }
    return n ? +(in1 / n).toFixed(3) : null;
  }));
  // van buiten naar een gevel lopen, langs beide assen: je komt er niet doorheen
  uit.lopen = [];
  for (const P of A.panden) {
    const p = KAART.panden.find(q => q.id === P.id), [cx, cz] = midden(p.voet);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let x = cx - dx * 40, z = cz - dz * 40, door = false;
      for (let i = 0; i < 400; i++) {
        const nx = x + dx * 0.1, nz = z + dz * 0.1;
        const [rx, rz] = W.resolveCollisions(nx, nz, 0.4);
        x = rx; z = rz;
        if (binnen(x, z, p.voet) && randAfst(x, z, p.voet) > 1.2) { door = true; break; }
      }
      uit.lopen.push(door);
    }
  }

  // ---- 8 en 9. 's nachts licht, en de shaders
  const C = g.camera, R = g.renderer;
  const kijk = (uur, zien) => {
    g.sfeer.uur = uur; for (let i = 0; i < 30; i++) g.sfeer.update(0.1, 399.9, -26.9);
    for (let i = 0; i < 10; i++) A.update(0.5, g.sfeer.nacht);
    A.groep.visible = zien;
    C.position.set(399.9, 1.7, -26.9); C.lookAt(428, 5, -42); C.updateMatrixWorld(true);
    W.updateLOD(399.9, -26.9); g.scene.updateMatrixWorld(true); R.render(g.scene, C);
    return R.info.programs.length;
  };
  kijk(13, false); kijk(1, false);
  const p0 = kijk(13, false), p1 = kijk(13, true);
  const dag = { gloed: A.gloed, int: MAT.glasLicht.emissiveIntensity };
  const p2 = kijk(1, false), p3 = kijk(1, true);
  const nacht = { gloed: A.gloed, int: MAT.glasLicht.emissiveIntensity, nachtSfeer: g.sfeer.nacht, ander: MAT.glas.emissiveIntensity };
  uit.prog = [p0, p1, p2, p3];
  uit.licht = { dag, nacht, aan: A.ramen.filter(w => w.licht).length, totaal: A.ramen.filter(w => !w.deur).length };
  A.groep.visible = true;
  return uit;
});

kop('1. op de voetafdruk, het oude blok weg');
ok(r.er && r.viaGame, 'de flats zijn gebouwd (en __game.molenflat wijst ernaar)');
if (!r.er) { await browser.close(); console.log(`\n${fout + 1} fout(en)`); process.exit(1); }
for (const P of r.panden) {
  console.log(`       ${P.id} (${P.nr}): ${P.delen.length} delen`, JSON.stringify(P.delen.map(d => [d.H, d.Hw, d.lagen, d.raak, d.y])));
  ok(P.delen.length >= 5, `${P.id}: de delen uit de 3D BAG (bergingen en woningen in trappen)`, `${P.delen.length}`);
  ok(P.delen.every(d => d.opVoet), `${P.id}: elk deel ligt op de voetafdruk`);
  ok(P.delen.every(d => d.raak === 'platdak' && d.eronder.length === 0), `${P.id}: van boven het nieuwe platte dak, geen oud blok eronder`, JSON.stringify(P.delen.filter(d => d.raak !== 'platdak' || d.eronder.length).map(d => [d.H, d.raak, d.eronder])));
}
kop('2. de hoogtes uit de 3D BAG');
for (const P of r.panden) {
  ok(P.delen.every(d => d.y !== null && Math.abs(d.y - d.H) < 0.1 && Math.abs(d.bagH - d.H) < 0.01), `${P.id}: elk deel op de hoogte van zijn dakvlak`, JSON.stringify(P.delen.map(d => [d.bagH, d.y])));
  ok(Math.abs(P.top - P.nok) < 0.25, `${P.id}: het hoogste dak op de nok van het pand`, `${P.top} tegen ${P.nok}`);
  const lagen = [...new Set(P.delen.map(d => d.berging ? 'b' : d.lagen))].sort().join('');
  ok(lagen.includes('b') && lagen.includes('2') && lagen.includes('3'), `${P.id}: bergingen, twee en drie lagen`, lagen);
}
kop('3. de straatgevel: ramen met blauwe kozijnen');
ok(r.ramen.aantal > 150 && r.ramen.perPand.every(n => n > 60), 'ramen in de gevels van beide panden', `${r.ramen.aantal} ${JSON.stringify(r.ramen.perPand)}`);
ok(r.ramen.raak / r.ramen.aantal > 0.97, 'elk raam van voren: glas of kozijn, in de gevel', `${r.ramen.raak}/${r.ramen.aantal} ${JSON.stringify(r.ramen.mis)}`);
for (const w of r.waaier) ok(w.flat > 20 && w.ruit >= 4 && w.steen > w.ruit, `vanaf waar de gebruiker stond, op ${w.y} m: baksteen met ramen`, JSON.stringify(w));
ok(r.kozijn[2] > r.kozijn[0] + 0.4 && r.kozijn[2] > r.kozijn[1] + 0.2, 'de kozijnen zijn blauw', JSON.stringify(r.kozijn));
ok(r.steen[0] > r.steen[1] + 15 && r.steen[0] > r.steen[2] + 15 && r.steen[0] < 125, 'de baksteen is donker bruin', JSON.stringify(r.steen));
kop('4. de witte dakrand');
ok(r.randen.aantal > 30, 'randen met een mansardekap', `${r.randen.aantal}`);
ok(r.randen.neer / r.randen.aantal > 0.95, 'een halve meter voor de gevel: de witte rand, schuin boven de goot', `${r.randen.neer}/${r.randen.aantal} ${JSON.stringify(r.randen.mis)}`);
ok(r.randen.op / r.randen.aantal > 0.95, 'van onderen: de onderkant van de overstek op de goot', `${r.randen.op}/${r.randen.aantal}`);
ok(r.randen.schild / r.randen.aantal > 0.9, 'net binnen de gevel: het donkere dakschild', `${r.randen.schild}/${r.randen.aantal}`);
ok(Math.max(...r.dak) < 85, 'het dakschild is donker', JSON.stringify(r.dak));
kop("5. loggia's");
ok(r.loggias.aantal >= 12 && r.loggias.perPand.every(n => n >= 5), "loggia's in beide panden", `${r.loggias.aantal} ${JSON.stringify(r.loggias.perPand)}`);
ok(r.loggias.diep.every(d => d !== null && d > 0.85 && d < 1.25), 'een nis van ruim een meter diep (tot de achterwand of zijn raam)', JSON.stringify(r.loggias.diep));
ok(r.loggias.hek > 0 && r.loggias.hek < r.loggias.aantal, 'met een metalen hek of een borstwering van baksteen', `${r.loggias.hek} van ${r.loggias.aantal} met een hek`);
kop('6. bergingen en schoorstenen');
ok(r.bergingen.every(b => b.length >= 1 && b.every(q => q.boei === 'blauw' && q.muur === 'steen')), 'de bergingen: baksteen met een blauwe boeiboord', JSON.stringify(r.bergingen));
ok(r.blauw[2] > r.blauw[0] + 0.4, 'de boeiboord is blauw', JSON.stringify(r.blauw));
ok(r.panden.every(P => P.schoorstenen >= 2 && P.schoorsteenBoven), 'schoorstenen boven het dak', JSON.stringify(r.panden.map(P => P.schoorstenen)));
ok(r.panden.every(P => P.torens.length === 1 && P.torens.every(T => T.alleenFlat && T.H > 11 && T.H < 12)), 'het trappenhuis in het midden (11,4 m) is van deze module, geen oud blok', JSON.stringify(r.panden.map(P => P.torens)));
kop('7. botsdozen');
ok(r.bots.every(b => b.length && b.every(f => f === null || f >= 0.99)), 'elk deel ligt onder de botsdozen van het pand', JSON.stringify(r.bots));
ok(r.lopen.every(d => !d), 'van vier kanten lopend kom je niet door een gevel', JSON.stringify(r.lopen));
kop("8. 's nachts licht achter de ramen");
ok(r.licht.dag.int === 0 && r.licht.nacht.nachtSfeer && r.licht.nacht.int > 0.6 && r.licht.nacht.ander === 0, 'overdag uit, \'s nachts aan (alleen emissiveIntensity)', JSON.stringify(r.licht));
ok(r.licht.aan > r.licht.totaal * 0.2 && r.licht.aan < r.licht.totaal * 0.45, 'achter ongeveer een derde van de ramen', `${r.licht.aan}/${r.licht.totaal}`);
kop('9. shaders');
ok(r.prog[1] === r.prog[0] && r.prog[3] === r.prog[2], 'de flats in beeld: geen nieuw programma, overdag en \'s nachts', `dag ${r.prog[0]} → ${r.prog[1]}, nacht ${r.prog[2]} → ${r.prog[3]}`);

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);

/*
 Stap 152: onder de zuilengang van de Poiesz in Duinterpen door, en de schuifdeuren (npm run zuilengangtest).

 Per blok met een zuilengang (de Poiesz en zijn buurpand aan de Keizersmantel):
   1. lopen door de gang, over de middenlijn tussen de zuilen en de pui, om de halve meter: nergens tegen een
      botsdoos (behalve vlak bij een zuil); eerst stond de hele gang in de dozen van het pand;
   2. tussen twee zuilen door naar binnen lopen kan;
   3. de winkel blijft dicht: een meter achter de pui sta je altijd in een doos;
   4. de rest van het pand blijft dicht: van de punten in de voetafdruk, verder dan diepte + 1 m van de boog, staat
      hoogstens 3 % buiten de dozen;
 En geen gras, onkruid of zwerfvuil in of vlak voor de gang (er stond een pol onkruid tussen de zuilen).
 En bij de Poiesz:
   5. de ingang van js/supermarkt.js zit bij de schuifdeuren in de pui, de stoep in de gang;
   6. de deuren schuiven open als je ervoor staat en weer dicht als je wegloopt;
   7. met E naar binnen vanaf de stoep, en weer naar buiten: je staat in de gang, niet in een doos;
   8. in beeld vertaalt de deur geen nieuw shaderprogramma.

 Gebruik: npm run server &  node tools/zuilengangtest.mjs [poort]
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
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const g = window.__game;
  const W = await import('./js/world.js');
  const { KAART } = await import('./js/kaart.js');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = false; window.__autoplay = false;
  const R = 0.35;
  const geraakt = (x, z) => { const [rx, rz] = W.resolveCollisions(x, z, R); return Math.hypot(rx - x, rz - z) > 0.02; };
  const binnenVeelhoek = (x, z, v) => {
    let in_ = false;
    for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
      const a = v[i], b = v[j];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) in_ = !in_;
    }
    return in_;
  };
  const uit = { gangen: [] };
  for (const gang of KAART.zuilengangen || []) {
    const pand = KAART.panden.find(p => p.id === gang.pand);
    const D = gang.diepte, boog = gang.boog;
    const bijZuil = (x, z) => gang.zuilen.some(s => Math.hypot(s[0] - x, s[1] - z) < gang.straal + R + 0.15);
    // 1. de middenlijn van de gang
    let punten = 0, vast = [];
    for (let i = 0; i < boog.length - 1; i++) {
      const a = boog[i], b = boog[i + 1], n = gang.binnen[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t <= L; t += 0.5) {
        const x = a[0] + (b[0] - a[0]) * t / L + n[0] * D * 0.5, z = a[1] + (b[1] - a[1]) * t / L + n[1] * D * 0.5;
        if (bijZuil(x, z)) continue;
        punten++;
        if (geraakt(x, z)) vast.push(`(${x.toFixed(1)}, ${z.toFixed(1)})`);
      }
    }
    // 2. tussen twee zuilen door, van buiten de gang in
    const zm = Math.floor(gang.zuilen.length / 2), z1 = gang.zuilen[zm - 1], z2 = gang.zuilen[zm];
    const mx = (z1[0] + z2[0]) / 2, mz = (z1[1] + z2[1]) / 2;
    let nI = 0, best = Infinity;
    for (let i = 0; i < boog.length - 1; i++) { const d = Math.hypot(boog[i][0] - mx, boog[i][1] - mz); if (d < best) { best = d; nI = i; } }
    const n = gang.binnen[nI];
    let doorgang = true;
    for (let s = -2; s <= D * 0.6; s += 0.25) if (geraakt(mx + n[0] * s, mz + n[1] * s)) doorgang = false;
    // 3. een meter achter de pui
    let winkelOpen = 0, winkelN = 0;
    for (let i = 0; i < boog.length - 1; i++) {
      const a = boog[i], b = boog[i + 1], nn = gang.binnen[i];
      const x = (a[0] + b[0]) / 2 + nn[0] * (D + 1.0), z = (a[1] + b[1]) / 2 + nn[1] * (D + 1.0);
      if (!binnenVeelhoek(x, z, pand.voet)) continue;
      winkelN++;
      if (!geraakt(x, z)) winkelOpen++;
    }
    // 4. de rest van de voetafdruk
    const xs = pand.voet.map(q => q[0]), zs = pand.voet.map(q => q[1]);
    let rest = 0, restOpen = 0;
    for (let x = Math.min(...xs); x <= Math.max(...xs); x += 1) for (let z = Math.min(...zs); z <= Math.max(...zs); z += 1) {
      if (!binnenVeelhoek(x, z, pand.voet)) continue;
      let dBoog = Infinity;
      for (let i = 1; i < boog.length; i++) {
        const a = boog[i - 1], b = boog[i], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
        dBoog = Math.min(dBoog, Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)));
      }
      if (dBoog < D + 1.0) continue;
      rest++;
      if (!geraakt(x, z)) restOpen++;
    }
    uit.gangen.push({ pand: gang.pand, merk: gang.merk, punten, vast, doorgang, winkelN, winkelOpen, rest, restOpen });
  }

  // (en geen gras in de gang: het gras in 3D en de struiken vragen `geenGroen`/`inZuilengang`)
  const KW = await import('./js/kaartwereld.js');
  for (const u of uit.gangen) {
    const gang = KAART.zuilengangen.find(z => z.pand === u.pand);
    let gras = 0, n = 0;
    for (let i = 0; i < gang.boog.length - 1; i++) {
      const a = gang.boog[i], b = gang.boog[i + 1], nn = gang.binnen[i];
      for (const t of [0.25, 0.5, 0.75]) for (const d of [-0.5, 0.4, 1.2, 2.0]) {
        n++;
        if (!KW.inZuilengang(a[0] + (b[0] - a[0]) * t + nn[0] * d, a[1] + (b[1] - a[1]) * t + nn[1] * d)) gras++;
      }
    }
    u.gras = { gras, n };
  }
  // en geen onkruid, zwerfvuil of kliko's in de gang (js/rommel.js langs de wegassen)
  {
    const THREE = await import('./lib/three.module.js');
    const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3();
    let rommel = 0;
    g.scene.traverse(o => {
      if (!o.isInstancedMesh || !['onkruid', 'zwerfvuil', 'kliko'].includes(o.userData.klasse)) return;
      for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); v3.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld); if (KW.inZuilengang(v3.x, v3.z)) rommel++; }
    });
    uit.rommel = rommel;
  }
  // 5–7. de Poiesz: de ingang, de deuren, naar binnen en buiten
  const sm = g.supermarkt, ing = sm.ingangen.find(i => /duinterpen/i.test(i.naam));
  const deur = g.schuifdeuren[0];
  uit.deur = deur ? { afstand: Math.hypot(deur.x - ing.deur.x, deur.z - ing.deur.z), stoepVrij: !geraakt(ing.stoep.x, ing.stoep.z) } : null;
  if (deur) {
    const ver = { x: deur.x + 30, z: deur.z };
    g.werkSchuifdeurenBij(5, [ver]);
    const dicht = deur.open, xDicht = deur.vleugels.map(v => v.position.x);
    g.werkSchuifdeurenBij(2, [ing.stoep]);
    const open = deur.open, xOpen = deur.vleugels.map(v => v.position.x);
    g.werkSchuifdeurenBij(2, [ver]);
    uit.schuif = { dicht, open, weer: deur.open, verschoven: Math.min(...xOpen.map((x, i) => Math.abs(x - xDicht[i]))) };
  }
  window.__autoplay = true;      // (toets doet alleen iets als je speelt)
  g.player.pos.set(ing.stoep.x, 0, ing.stoep.z);
  sm.toets();
  const binnen = sm.binnen(g.player.pos.x, g.player.pos.z);
  // naar de deur binnen en weer naar buiten
  const bd = sm.plekken && sm.plekken.deurBinnen ? sm.plekken.deurBinnen : null;
  if (bd) g.player.pos.set(bd.x, 0, bd.z);
  sm.toets();
  window.__autoplay = false;
  const p = g.player.pos;
  uit.inUit = { binnen, buiten: !sm.binnen(p.x, p.z), naStoep: Math.hypot(p.x - ing.stoep.x, p.z - ing.stoep.z), vrij: !geraakt(p.x, p.z) };

  // 8. geen nieuw programma
  await g.voorbereidSpel();
  const Rn = g.renderer, C = g.camera;
  if (deur) {
    const voor = Rn.info.programs.length;
    C.position.set(ing.stoep.x - ing.f[0] * -4, 1.6, ing.stoep.z - ing.f[1] * -4);
    C.lookAt(deur.x, 1.2, deur.z); C.updateMatrixWorld(true);
    W.updateLOD(C.position.x, C.position.z);
    g.scene.updateMatrixWorld(true); Rn.render(g.scene, C); Rn.render(g.scene, C);
    uit.programmas = { voor, na: Rn.info.programs.length };
  }
  return uit;
});

for (const gg of r.gangen) {
  kop(`zuilengang van ${gg.pand}${gg.merk ? ' (de Poiesz)' : ''}`);
  ok(gg.vast.length === 0 && gg.punten > 30, 'door de gang lopen: nergens tegen een doos', gg.vast.length ? `${gg.vast.length} van ${gg.punten}: ${gg.vast.slice(0, 4).join(' ')}` : `${gg.punten} punten`);
  ok(gg.doorgang, 'tussen twee zuilen door de gang in');
  ok(gg.winkelN > 3 && gg.winkelOpen === 0, 'een meter achter de pui sta je in een doos: de winkel blijft dicht', `${gg.winkelOpen} van ${gg.winkelN} open`);
  ok(gg.rest > 50 && gg.restOpen / gg.rest <= 0.03, 'de rest van het pand blijft dicht', `${gg.restOpen} van ${gg.rest} punten buiten de dozen`);
  ok(gg.gras.gras === 0, 'geen gras in of vlak voor de gang', `${gg.gras.gras} van ${gg.gras.n} punten mogen groen`);
}
ok(r.rommel === 0, 'geen onkruid, zwerfvuil of kliko in de gang', `${r.rommel}`);
kop('de Poiesz: de deur');
ok(!!r.deur && r.deur.afstand < 0.3, 'de ingang zit bij de schuifdeuren in de pui', r.deur ? `${r.deur.afstand.toFixed(2)} m` : 'geen schuifdeur');
ok(!!r.deur && r.deur.stoepVrij, 'de stoep ligt vrij, in de gang');
ok(!!r.schuif && r.schuif.dicht === 0 && r.schuif.open === 1 && r.schuif.weer === 0 && r.schuif.verschoven > 0.9,
  'de deuren schuiven open als je ervoor staat, en weer dicht', r.schuif ? `${r.schuif.verschoven.toFixed(2)} m opzij` : '');
ok(r.inUit.binnen && r.inUit.buiten && r.inUit.naStoep < 0.6 && r.inUit.vrij,
  'met E naar binnen en weer naar buiten, in de gang', `binnen ${r.inUit.binnen}, buiten ${r.inUit.buiten}, ${r.inUit.naStoep.toFixed(2)} m van de stoep`);
ok(!!r.programmas && r.programmas.na === r.programmas.voor, 'de schuifdeuren in beeld: geen nieuw programma', r.programmas ? `${r.programmas.voor} → ${r.programmas.na}` : '');

await browser.close();
console.log(fout ? `\n${fout} fout${fout > 1 ? 'en' : ''}` : '\nalles goed');
process.exit(fout ? 1 : 0);

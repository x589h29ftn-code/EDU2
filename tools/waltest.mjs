/*
 De wal langs het water.

   npm run server &   node tools/waltest.mjs [poort]

 Sinds er boten zijn kijk je van het water naar de kant in plaats van andersom,
 en dan valt er van alles op wat je vanaf de stoep nooit zag. Deze toets houdt
 drie dingen vast.

 1. **Er staat niets in het water.** De lagen van de BGT overlappen elkaar en een
    struik of een rolcontainer kreeg zijn plek zonder dat er iemand naar de
    sloot ernaast keek. Zo'n ding staat op maaiveldhoogte en de waterspiegel ligt
    op −0,35, dus het zweeft er een halve meter boven.
 2. **De oeverwand wordt aan twee kanten getekend.** Op de rand van elk
    waterdeel staat er een, van 0,13 tot −0,6, met de normaal naar het water toe.
    Wordt de achterkant weggeknipt, dan kijk je vanaf de kant door de wal heen
    tot op het grondvlak op −1 m.
 3. **De boot vaart de kant niet in.** `pastHier` toetst punten op de buitenkant
    van de romp. Liggen die te ver naar binnen, dan steekt de steven het gras in
    voordat er iets tegenhoudt — de boeg verdwijnt dan in de wal.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let goed = 0, fout = 0;
const ok = (naam, waar, extra = '') => {
  if (waar) { goed++; console.log(`  ✓ ${naam}`); }
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
await page.waitForFunction(() => window.__game && window.__game.boten, null, { timeout: 300000 });

// ---------- 1: er staat niets in het water ----------
console.log('\nniets in het water');
const nat = await page.evaluate(async () => {
  const THREE = await import('/lib/three.module.js');
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  g.scene.updateMatrixWorld(true);
  /*
   Het waterdeel zelf, mét de gaten erin: een eilandje midden in een plas is
   geen water. Een bbox per vlak scheelt het langslopen van alle 529 delen voor
   elk van de tienduizenden punten.
  */
  const bbox = (r) => { const b = [1e9, 1e9, -1e9, -1e9];
    for (const [x, z] of r) { if (x < b[0]) b[0] = x; if (z < b[1]) b[1] = z; if (x > b[2]) b[2] = x; if (z > b[3]) b[3] = z; }
    return b; };
  const inRing = (x, z, r) => { let o = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], c = r[j];
      if ((a[1] > z) !== (c[1] > z) && x < (c[0] - a[0]) * (z - a[1]) / (c[1] - a[1]) + a[0]) o = !o; }
    return o; };
  const water = KAART.vlakken.filter(v => v.k === 'water').map(v => ({ r: v.r, b: bbox(v.r[0]) }));
  const inWater = (x, z) => water.some(w => x >= w.b[0] && x <= w.b[2] && z >= w.b[1] && z <= w.b[3]
    && inRing(x, z, w.r[0]) && !w.r.slice(1).some(h => inRing(x, z, h)));

  // struiken en bomen komen uit de kaart; die tellen we bij de bron
  const uit = { struik: 0, boom: 0, totaalStruik: KAART.struiken.length, totaalBoom: KAART.bomen.length,
    vuil: 0, kliko: 0, totaalVuil: 0, totaalKliko: 0 };
  for (const s of KAART.struiken) if (inWater(s.x, s.z)) uit.struik++;
  for (const b of KAART.bomen) if (inWater(b.x, b.z)) uit.boom++;

  // zwerfvuil en rolcontainers zet js/rommel.js zelf neer, dus die lezen we uit
  // de instanties in de scene
  const m4 = new THREE.Matrix4(), p = new THREE.Vector3();
  g.scene.traverse(o => {
    const k = o.userData.klasse;
    if (!o.isInstancedMesh || (k !== 'zwerfvuil' && k !== 'kliko')) return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m4);
      p.setFromMatrixPosition(m4).applyMatrix4(o.matrixWorld);
      if (k === 'kliko') { uit.totaalKliko++; if (inWater(p.x, p.z)) uit.kliko++; }
      else { uit.totaalVuil++; if (inWater(p.x, p.z)) uit.vuil++; }
    }
  });
  return uit;
});
/*
 Nul is bij de struiken niet haalbaar en ook niet nodig: een enkel vak groen
 valt net over een duiker of een overkluizing, en daar hoort beplanting. Meer dan
 een handvol betekent dat er ergens weer zonder kijken gestrooid wordt.
*/
ok('er staan hoogstens een paar struiken in het water',
  nat.struik <= 5, `${nat.struik} van de ${nat.totaalStruik}`);
ok('en hoogstens een paar bomen', nat.boom <= 5, `${nat.boom} van de ${nat.totaalBoom}`);
ok('er drijft geen zwerfvuil', nat.vuil === 0, `${nat.vuil} van de ${nat.totaalVuil}`);
ok('en er staat geen rolcontainer in de sloot', nat.kliko === 0, `${nat.kliko} van de ${nat.totaalKliko}`);

// ---------- 2: de oeverwand ----------
console.log('\nde oeverwand');
const wand = await page.evaluate(async () => {
  const THREE = await import('/lib/three.module.js');
  const g = window.__game;
  const wanden = [];
  g.scene.traverse(o => { if (o.isMesh && o.userData.klasse === 'oeverwand') wanden.push(o); });
  return { aantal: wanden.length, tweezijdig: wanden.every(m => m.material.side === THREE.DoubleSide) };
});
ok('er staan oeverwanden langs het water', wand.aantal > 50, `${wand.aantal} stukken`);
ok('en ze worden aan twee kanten getekend', wand.tweezijdig);

// ---------- 3: de boot tegen de wal ----------
console.log('\nde boot tegen de wal');
const boot = await page.evaluate(async () => {
  const { vaarbaar } = await import('/js/world.js');
  const g = window.__game, B = g.boten;
  g.player.active = true;
  const b = B.ruw(0);
  B.stapIn(b);
  // neus recht op de dichtstbijzijnde wal, en er een halve minuut vol op af
  let land = null;
  for (let r = 4; r <= 40 && !land; r += 0.5) for (let i = 0; i < 64; i++) {
    const h = i / 64 * 6.283, x = b.x + Math.cos(h) * r, z = b.z + Math.sin(h) * r;
    if (!B.pastHier(x, z, b.yaw)) { land = { x, z }; break; }
  }
  B.verplaats(b, b.x, b.z, Math.atan2(-(land.x - b.x), -(land.z - b.z)));
  for (let i = 0; i < 1800; i++) B.update(1 / 60, { KeyW: true });
  const L = B.maten.LENGTE, BR = B.maten.BREEDTE;
  const punt = (l, d) => [b.x - Math.sin(b.yaw) * l + Math.cos(b.yaw) * d,
    b.z - Math.cos(b.yaw) * l - Math.sin(b.yaw) * d];
  // de vier uitersten van de romp: steven, spiegel en de twee breedste punten
  const hoeken = [[L * 0.55, 0], [-L * 0.5, 0], [L * 0.05, BR * 0.5], [L * 0.05, -BR * 0.5]];
  const droog = hoeken.map(([l, d]) => { const [x, z] = punt(l, d); return vaarbaar(x, z); });
  return { droog, vaart: B.vaart };
});
ok('de steven en de breedste punten blijven op het water', boot.droog.every(Boolean), JSON.stringify(boot.droog));
ok('en hij ligt er stil tegenaan', Math.abs(boot.vaart) < 1.5, `${boot.vaart.toFixed(2)} m/s`);

console.log(`\nfouten in de pagina: ${fouten.length ? fouten.join(' | ') : 'geen'}`);
if (fouten.length) fout++;
console.log(`\n${goed} goed, ${fout} fout`);
await browser.close();
process.exit(fout ? 1 : 0);

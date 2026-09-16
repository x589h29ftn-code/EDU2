/*
 De Terpensmole en de houtkolk.

   npm run server &   node tools/terptest.mjs [poort]

 Twee dingen die uit dezelfde foto's kwamen (16 sep 2026).

 1. Langs het Sneekerpad, het slingerweggetje van Sneek naar IJlst, staat een
    spinnenkopmolen. Het spel tekende die tot nu toe als `schuur`: zestien
    vierkante meter grondvlak en tien meter hoog, want dat is wat het 3D
    BAG-model ervan zegt. Dat is precies de kandidaat die je zoekt — een schuur
    van vijf bij vijf met een nok op tien meter bestaat niet.
 2. Achter houtzaagmolen De Rat ligt een inham die aan de Geeuw vastzit. Daar
    lagen de boomstammen te wachten tot ze de molen in gingen.

 Wat hier getoetst wordt is vooral of de meting klopt: staat de molen op de plek
 uit de BAG, is het pand niet óók nog als schuur getekend, en liggen alle stammen
 echt in het water in plaats van op de wal.
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
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

// ---------- de kaart ----------
console.log('\nwat er in de kaart staat');
const kaart = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const sp = KAART.molens.find(m => m.soort === 'spinnenkop');
  const st = KAART.molens.find(m => m.soort !== 'spinnenkop');
  const pand = sp ? KAART.panden.find(p => p.id === sp.pand) : null;
  return {
    aantal: KAART.molens.length,
    sp: sp && { naam: sp.naam, cx: sp.cx, cz: sp.cz, top: sp.top, vlucht: sp.vlucht, voet: sp.voet, loods: !!sp.loods },
    pandType: pand ? pand.type : null,
    pandNok: pand ? pand.nok : null,
    kolk: st && st.kolk ? { opp: st.kolk.opp, punten: st.kolk.ring.length, y: st.kolk.y, cx: st.kolk.cx, cz: st.kolk.cz } : null,
    ratNaarKolk: st && st.kolk ? Math.hypot(st.cx - st.kolk.cx, st.cz - st.kolk.cz) : -1,
  };
});
ok('er staan twee molens in de kaart', kaart.aantal === 2, `${kaart.aantal}`);
ok('een daarvan is een spinnenkop', !!kaart.sp, kaart.sp ? kaart.sp.naam : 'geen');
ok('zonder zaagloodsen eromheen', kaart.sp && kaart.sp.loods === false);
ok('met een vierkante romp uit de omhullende rechthoek',
  kaart.sp && kaart.sp.voet && Math.abs(kaart.sp.voet.hx - kaart.sp.voet.hz) < 0.2,
  kaart.sp && kaart.sp.voet ? `${kaart.sp.voet.hx} x ${kaart.sp.voet.hz} m` : '');
ok('het BAG-pand telt als molen en niet meer als schuur', kaart.pandType === 'molen', `${kaart.pandType}`);
ok('de kap staat lager dan de hoogste 3D-punten (dat waren de roeden)',
  kaart.sp && kaart.pandNok && kaart.sp.top < kaart.pandNok - 1.5,
  kaart.sp ? `kap ${kaart.sp.top} m, hoogste punt ${kaart.pandNok} m` : '');
ok('en er is een houtkolk bij De Rat', !!kaart.kolk,
  kaart.kolk ? `${kaart.kolk.opp} m² op ${kaart.ratNaarKolk.toFixed(0)} m van de molen` : 'geen');
ok('die groter is dan de sloot ernaast', kaart.kolk && kaart.kolk.opp > 300, kaart.kolk ? `${kaart.kolk.opp} m²` : '');

// ---------- wat er gebouwd is ----------
console.log('\nwat er in de wereld staat');
const wereld = await page.evaluate(async () => {
  const { molenIntern } = await import('/js/molen.js');
  const g = window.__game;
  const namen = [];
  g.scene.traverse(o => { if (o.isMesh && o.name && o.name.startsWith('molen-')) namen.push(o.name); });
  const kolkMeshes = [];
  g.scene.traverse(o => { if (o.isMesh && o.name && o.name.startsWith('houtkolk')) kolkMeshes.push(o.name); });
  return { gevluchten: molenIntern().map(v => v.naam), meshes: namen, kolk: kolkMeshes };
});
ok('allebei de molens hebben een draaiend gevlucht', wereld.gevluchten.length === 2, wereld.gevluchten.join(', '));
ok('de spinnenkop heeft zijn eigen romp-mesh', wereld.meshes.includes('molen-romp-spinnenkop'), wereld.meshes.join(', '));
ok('en de houtkolk heeft stammen', wereld.kolk.length >= 1, wereld.kolk.join(', '));

// ---------- het gevlucht draait ----------
const draait = await page.evaluate(async () => {
  const { molenIntern, draaiMolens } = await import('/js/molen.js');
  const v = molenIntern();
  const voor = v.map(x => x.groep.rotation.z);
  for (let i = 0; i < 150; i++) draaiMolens(1 / 30);      // vijf seconden
  return v.map((x, i) => +(x.groep.rotation.z - voor[i]).toFixed(3));
});
ok('en ze draaien allebei', draait.every(d => d > 0.1), `${draait.join(' en ')} rad in vijf seconden`);

// ---------- de molen houdt je tegen ----------
console.log('\nje loopt er niet doorheen');
const klem = await page.evaluate(async () => {
  const { resolveCollisions } = await import('/js/world.js');
  const { KAART } = await import('/js/kaart.js');
  const m = KAART.molens.find(x => x.soort === 'spinnenkop');
  const [rx, rz] = resolveCollisions(m.cx, m.cz, 0.35, 0);
  // en tien meter ernaast moet je gewoon kunnen staan
  const [vx, vz] = resolveCollisions(m.cx + 10, m.cz, 0.35, 0);
  return {
    inDeMolen: Math.hypot(rx - m.cx, rz - m.cz) > 0.01,
    ernaast: Math.hypot(vx - (m.cx + 10), vz - m.cz) < 0.01,
  };
});
ok('de romp houdt je tegen', klem.inDeMolen);
ok('en tien meter ernaast sta je vrij', klem.ernaast);

// ---------- de stammen liggen in het water ----------
console.log('\nde stammen liggen in de kolk');
const stammen = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const { vaarbaar } = await import('/js/world.js');
  const st = KAART.molens.find(m => m.kolk);
  const ring = st.kolk.ring;
  const inRing = (x, z) => {
    let b = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], c = ring[j];
      if ((a[1] > z) !== (c[1] > z) && x < (c[0] - a[0]) * (z - a[1]) / (c[1] - a[1]) + a[0]) b = !b;
    }
    return b;
  };
  // de hartpunten van alle drijvende stammen uit de mesh terugrekenen
  const g = window.__game;
  let mesh = null;
  g.scene.traverse(o => { if (o.isMesh && o.name === 'houtkolk-stammen') mesh = o; });
  if (!mesh) return { gevonden: false };
  const pos = mesh.geometry.getAttribute('position');
  // per cilinder (7 zijden, elk 2 driehoeken plus de doppen) het zwaartepunt is
  // te duur om uit te rekenen; we toetsen de hoekpunten zelf, op waterhoogte
  let inWater = 0, opDeWal = 0, hoog = 0;
  for (let i = 0; i < pos.count; i += 17) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y > 0.6) { hoog++; continue; }            // de stapel op de wal
    if (inRing(x, z)) inWater++; else opDeWal++;
  }
  return {
    gevonden: true, inWater, opDeWal, hoog,
    kolkVaarbaar: vaarbaar(st.kolk.cx, st.kolk.cz),
    punten: pos.count,
  };
});
ok('er zijn stammen gevonden', stammen.gevonden && stammen.punten > 500, `${stammen.punten} hoekpunten`);
ok('het grootste deel drijft in de kolk', stammen.inWater > stammen.opDeWal * 3,
  `${stammen.inWater} in het water, ${stammen.opDeWal} erbuiten, ${stammen.hoog} op de stapel`);
ok('en de kolk blijft bevaarbaar', stammen.kolkVaarbaar === true);

console.log(`\nfouten in de pagina: ${fouten.length ? fouten.join(' | ') : 'geen'}`);
if (fouten.length) fout++;
console.log(`\n${goed} goed, ${fout} fout`);
await browser.close();
process.exit(fout ? 1 : 0);

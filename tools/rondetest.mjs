/*
 De ronde van 19 september 2026, tweede lijst.

   npm run server &   node tools/rondetest.mjs [poort]

 Zeven punten uit één document, en ze hebben gemeen dat ze pas opvallen als je
 er staat:

 1. Aan de Vang was de voorgevel van de woningen kale baksteen zonder deur of
    raam. Het dak loopt daar tot vlak boven de grond door — het 3D BAG-model
    geeft een goot van 0,51 tot 3,22 m — en de gevel werd op die goot geknipt.
    Wat eronder overbleef was te laag voor een deur, dus werd de hele voorkant
    kopgevel.
 2. Het pand aan de Lemmerweg 130B stond als naamloos groot gebouw in beeld. Het
    is Jumbo Kooistra.
 3. De Poiesz in Duinterpen was alleen van buiten te zien. Je kunt er nu naar
    binnen, in dezelfde winkel als die in IJlst — en je komt er ook weer uit
    waar je naar binnen ging.
 4. M loopt nu in drie standen: minikaart, grotere minikaart, grote kaart.
 5. In de cabine van de bakwagen zat een dichte wand waar de voorruit hoort.
 6/7. Twee bouwblokken kregen hun eigen gevel: het gebogen blok in Duinterpen en
    de rij aan de Atalanta.
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

// ------------------------------------------------- de gevels aan de Vang
console.log('\nde voorgevels aan de Vang');
const vang = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const mid = (p) => {
    let x = 0, z = 0;
    for (const q of p.voet) { x += q[0]; z += q[1]; }
    return { x: x / p.voet.length, z: z / p.voet.length };
  };
  // de woningen aan de Vang met een goot onder de 2,6 m: die hadden het probleem
  const laag = KAART.panden.filter(p => p.straat === 'de Vang' && p.goot < 2.6 && p.nok > 6);
  const harten = laag.map(mid);
  const met = new Set();
  window.__game.scene.traverse(o => {
    if (!o.isMesh) return;
    const k = o.userData.klasse;
    if (k !== 'voorgevel' && k !== 'achtergevel') return;
    const pos = o.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i += 3) {
      const x = pos.getX(i), z = pos.getZ(i);
      for (let h = 0; h < harten.length; h++) {
        if (met.has(h)) continue;
        if (Math.hypot(x - harten[h].x, z - harten[h].z) < 9) met.add(h);
      }
    }
  });
  return { n: laag.length, met: met.size, goot: laag.map(p => p.goot) };
});
ok('er staan woningen met een goot onder de 2,6 m aan de Vang', vang.n > 0,
  `${vang.n} stuks, goot ${Math.min(...vang.goot).toFixed(2)}–${Math.max(...vang.goot).toFixed(2)} m`);
ok('en die hebben nu een gevel met een deur in plaats van kale steen',
  vang.met >= vang.n * 0.8, `${vang.met} van de ${vang.n}`);

// ------------------------------------------------------------- de Jumbo
console.log('\nde Jumbo aan de Lemmerweg');
const jumbo = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const T = await import('/js/textures.js');
  const p = KAART.panden.find(q => q.id === '1900100010087000');
  const st = T.HOUSE_STYLES.jumbo_lemmerweg;
  return { type: p && p.type, goot: p && p.goot, nok: p && p.nok,
    merk: st && st.merk, winkel: st && st.winkel, lagen: st && st.storeys };
});
ok('het pand aan de Lemmerweg 130B is een supermarkt', jumbo.type === 'jumbo_lemmerweg', `${jumbo.type}`);
ok('met het woordmerk erop', jumbo.merk === 'JUMBO' && jumbo.winkel === true);
ok('en twee lagen, zoals in de BAG', jumbo.lagen === 2, `goot ${jumbo.goot} m, nok ${jumbo.nok} m`);

// ----------------------------------------------------- de Poiesz Duinterpen
console.log('\nnaar binnen bij de Poiesz in Duinterpen');
const poiesz = await page.evaluate(async () => {
  const g = window.__game;
  const s = g.supermarkt;
  if (!s || !s.ingangen) return null;
  const uit = { namen: s.ingangen.map(i => i.naam), winkels: (s.winkels || []).length };
  const duin = s.ingangen.find(i => i.naam.includes('Duinterpen'));
  if (!duin) return uit;
  uit.afstand = Math.round(Math.hypot(duin.deur.x - s.ingangen[0].deur.x, duin.deur.z - s.ingangen[0].deur.z));
  // bij de Duinterpen-deur gaan staan, naar binnen, en weer naar buiten
  g.player.pos.set(duin.deur.x, 0, duin.deur.z);
  g.player.inCar = null;
  uit.naarBinnen = s.toets();                          // E bij de deur
  uit.binnen = s.binnen(g.player.pos.x, g.player.pos.z);
  uit.kaart = s.kaart(g.player.pos.x, g.player.pos.z);
  // binnen bij de deur gaan staan en weer naar buiten stappen
  const bd = s.plekken.deurBinnen;
  g.player.pos.set(bd.x, 0, bd.z);
  uit.naarBuiten = s.toets();
  uit.terug = { x: g.player.pos.x, z: g.player.pos.z };
  uit.bijDuinterpen = Math.round(Math.hypot(g.player.pos.x - duin.stoep.x, g.player.pos.z - duin.stoep.z));
  return uit;
});
ok('er zijn twee ingangen', poiesz && poiesz.namen.length === 2, poiesz ? poiesz.namen.join(' en ') : 'geen');
ok('ze staan allebei als winkel op de kaart', poiesz && poiesz.winkels === 2, poiesz ? `${poiesz.winkels}` : '');
ok('en ze liggen ver uit elkaar', poiesz && poiesz.afstand > 1000, poiesz ? `${poiesz.afstand} m` : '');
ok('via Duinterpen sta je binnen in de winkel',
  poiesz && poiesz.naarBinnen === true && poiesz.binnen === true);
ok('de kaart noemt dan Duinterpen en niet IJlst',
  poiesz && poiesz.kaart && poiesz.kaart.naam.includes('Duinterpen'),
  poiesz && poiesz.kaart ? poiesz.kaart.naam : '');
ok('en je komt weer buiten waar je naar binnen ging',
  poiesz && poiesz.bijDuinterpen < 8, poiesz ? `${poiesz.bijDuinterpen} m van de deur` : '');

// -------------------------------------------------------------- de M-toets
console.log('\nde kaart in drie standen (M)');
const kaartM = await page.evaluate(() => {
  const hud = window.__game.hud;
  const meet = () => ({ stand: hud.kaartStand, doek: hud.canvas.width, groot: hud.bigOpen });
  const rij = [meet()];
  for (let i = 0; i < 3; i++) { hud.kaartStap(); rij.push(meet()); }
  return rij;
});
ok('stand 0 is de gewone minikaart', kaartM[0].doek === 220 && !kaartM[0].groot, `doek ${kaartM[0].doek}`);
ok('één keer M maakt de minikaart groter', kaartM[1].doek > kaartM[0].doek && !kaartM[1].groot,
  `doek ${kaartM[1].doek}`);
ok('nog een keer M opent de grote kaart', kaartM[2].groot === true && kaartM[2].doek === 220);
ok('en nog een keer is alles weer dicht', kaartM[3].doek === 220 && !kaartM[3].groot);

// -------------------------------------------------------- de vrachtwagencabine
console.log('\nuit de cabine van de bakwagen kijken');
const cabine = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  /*
   De bakwagen van de missie staat er pas als die missie loopt (js/verhaal.js),
   dus hier wordt er zelf een neergezet. Het gaat om het model, niet om het
   verhaal: de vraag is of er plaatwerk vóór de bestuurdersstoel zit.
  */
  const { KAART } = await import('/js/kaart.js');
  const car = g.vehicles.cars.find(c => c.soort === 'truck')
    || g.vehicles.voegToe({ x: KAART.start.x + 30, z: KAART.start.z + 30, yaw: 0, soort: 'truck', kleur: 0xdedede });
  if (!car) return null;
  const st = car.stoel || (car.mesh && car.mesh.userData.oog) || { x: -0.34, y: 1.32, z: -0.87 };
  const oog = new THREE.Vector3(st.x, st.y, st.z);
  oog.applyAxisAngle(new THREE.Vector3(0, 1, 0), car.yaw);
  const van = new THREE.Vector3(car.x + oog.x, (car.mesh ? car.mesh.position.y : 0) + st.y, car.z + oog.z);
  // recht vooruit kijken vanaf de stoel
  const naar = new THREE.Vector3(-Math.sin(car.yaw), 0, -Math.cos(car.yaw));
  const straal = new THREE.Raycaster(van, naar, 0.05, 6);
  g.vehicles.ruiten(car, false);                       // zoals main.js doet als je erin zit
  const raak = straal.intersectObject(car.mesh, true).filter(h => h.object.visible);
  return { n: raak.length, eerste: raak.length ? Math.round(raak[0].distance * 100) / 100 : null };
});
ok('er staat een bakwagen in de wereld', cabine !== null);
ok('en vanaf de bestuurdersstoel kijk je zo naar buiten',
  cabine && cabine.n === 0, cabine ? `${cabine.n} vlak(ken) in de weg, eerste op ${cabine.eerste} m` : '');

// ------------------------------------------------------------ de twee blokken
console.log('\nde twee bouwblokken met een eigen gevel');
const blokken = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const T = await import('/js/textures.js');
  const tel = (t) => KAART.panden.filter(p => p.type === t).length;
  return {
    zalm: tel('duinterpen_zalm'), atalanta: tel('atalanta'),
    zalmStijl: !!T.HOUSE_STYLES.duinterpen_zalm,
    atalantaStijl: T.HOUSE_STYLES.atalanta && { hout: !!T.HOUSE_STYLES.atalanta.hout, solar: !!T.HOUSE_STYLES.atalanta.solar },
    // de flats in de Atalanta horen hun eigen type te houden
    flats: KAART.panden.filter(p => p.straat === 'Atalanta' && (p.type === 'appart' || p.type === 'jasker_flat')).length,
  };
});
ok('het gebogen blok in Duinterpen telt vijftien panden', blokken.zalm === 15, `${blokken.zalm}`);
ok('met een eigen gevel', blokken.zalmStijl === true);
ok('de rij aan de Atalanta heeft een eigen gevel met hout en zonnepanelen',
  blokken.atalanta > 30 && blokken.atalantaStijl && blokken.atalantaStijl.hout && blokken.atalantaStijl.solar,
  `${blokken.atalanta} panden`);
ok('en de flats in die straat houden hun eigen type', blokken.flats > 0, `${blokken.flats}`);

console.log(`\nfouten in de pagina: ${fouten.length ? fouten.join(' | ') : 'geen'}`);
if (fouten.length) fout++;
console.log(`\n${goed} goed, ${fout} fout`);
await browser.close();
process.exit(fout ? 1 : 0);

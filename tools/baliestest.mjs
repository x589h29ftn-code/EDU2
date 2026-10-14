/*
 Stap 170 (npm run baliestest): vier wensen in één ronde.

   1. de mat bij de schuifdeuren van de BP clipt niet meer met de vloer: van boven raak je eerst de mat, ruim boven de vloer;
   2. het kraslot laat zien wat je wint: een kaartje in beeld met het bedrag ("€ 50 GEWONNEN!" of "Helaas…"), het geluid erbij,
      en na een paar tellen weer weg;
   3. de wegversperring op de Stadsrondweg-Zuid bij (1708,4; −110,1): hekken in beeld, en rijdend (een auto houdt alles onder
      3,5 m niet tegen) of lopend, ook door de berm ernaast, kom je er niet langs;
   4. de tuning bij Sjoerd aan de balie: met je eigen auto voor de deur opent E daar het menu, zonder auto niet; de zuil met het
      scherm is weg.

 Gebruik: npm run server &  node tools/baliestest.mjs [poort]
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
  const THREE = await import('three');
  const g = window.__game, W = await import('./js/world.js');
  const { KAART } = await import('./js/kaart.js');
  const { TUNING } = await import('./js/tuning.js');
  const { BP } = await import('./js/bpwinkel.js');
  document.getElementById('overlay').style.display = 'none';
  await g.voorbereidSpel();
  window.__autoplay = true; const pl = g.player; pl.active = true;
  const uit = {};

  // ---- 1. de mat
  const S = g.bpshop, [mx, mz] = S.wereld((BP.deur.u0 + BP.deur.u1) / 2, S.deur.w + 0.9);
  W.updateLOD(mx, mz); g.scene.updateMatrixWorld(true);
  const rc = new THREE.Raycaster(new THREE.Vector3(mx, 3, mz), new THREE.Vector3(0, -1, 0), 0, 5);
  const hits = rc.intersectObject(S.groep, true).filter(h => h.object.visible).map(h => ({ naam: h.object.name, y: +h.point.y.toFixed(3) }));
  uit.mat = hits.slice(0, 3);

  // ---- 2. het kraslot
  g.verhaal.verdien(500);
  const [bx, bz] = S.wereld(5.3, 5.2); pl.pos.x = bx; pl.pos.z = bz;
  const K = g.bpKassa;
  let gespeeld = null;
  // het geluid: vang de aanroep af (headless klinkt er niets)
  const geluid = (await import('./js/audio.js')).geluid;
  const was = geluid.kraslot; geluid.kraslot = (p) => { gespeeld = p; };
  K.toets();
  const kaarten = [];
  for (let i = 0; i < 6; i++) {
    const voor = K.stand.gewonnen; K.kies(2); const prijs = K.stand.gewonnen - voor;
    const el = document.getElementById('kraslot');
    kaarten.push({ prijs, tekst: el ? el.querySelector('.bedrag').textContent : null, zichtbaar: !!el && !el.hidden && getComputedStyle(el).display !== 'none', geluid: gespeeld });
  }
  K.toets();
  geluid.kraslot = was;
  uit.kaarten = kaarten;
  uit.heeftGeluid = typeof was === 'function';
  await new Promise(res => setTimeout(res, 4300));
  const el = document.getElementById('kraslot');
  uit.kaartWeg = !el || el.hidden || getComputedStyle(el).display === 'none';

  // ---- 3. de wegversperring
  const A = KAART.wegafsluitingen.find(a => a.naam === 'Rondweg oost');
  uit.afsluiting = A ? { x: A.x, z: A.z, breed: A.breed, muur: A.muur } : null;
  if (A) {
    // dwars door de afzetting heen: van 12 m ervoor naar 12 m erachter, langs de as, op de weg en 20 m opzij (de berm)
    const [ax, az] = A.as, nx = -az, nz = ax;
    const door = (opzij, straal, laag) => {
      let x = A.x - ax * 12 + nx * opzij, z = A.z - az * 12 + nz * opzij;
      for (let i = 0; i < 240; i++) { [x, z] = W.resolveCollisions(x + ax * 0.1, z + az * 0.1, straal, laag, 0); }
      return +((x - A.x) * ax + (z - A.z) * az).toFixed(2);   // hoe ver voorbij de afzetting (langs de as)
    };
    uit.auto = [door(0, 1.0, 3.5), door(3, 1.0, 3.5), door(20, 1.0, 3.5)];
    uit.lopen = [door(0, 0.35, 0), door(-25, 0.35, 0)];
    // de hekken in beeld: iets van de afzetting binnen 2 m van het punt
    let hek = 0; const p = new THREE.Vector3();
    g.scene.traverse(o => { if (o.isMesh && o.material && o.material.map && o.material.map.image && o.material.map.image.width === 256 && o.material.map.image.height === 128) { o.getWorldPosition(p); if (Math.hypot(p.x - A.x, p.z - A.z) < 9) hek++; } });
    uit.hekken = hek;
  }

  // ---- 4. de tuning bij Sjoerd
  const ga = g.garage, t = g.tuning, b = ga.plekken.balie;
  pl.pos.x = b.x + 1.2; pl.pos.z = b.z;
  t.update(0.1);
  uit.zonderAuto = { toets: t.toets(), open: t.open };
  if (t.open) t.sluit();
  const { TE_KOOP } = await import('./js/garage.js');
  g.verhaal.verdien(5000);
  ga.koop(TE_KOOP.find(q => q.id === 'gti'));
  pl.pos.x = b.x + 1.2; pl.pos.z = b.z; t.update(0.1);
  uit.metAuto = { toets: t.toets(), open: t.open };
  const regels = [...document.querySelectorAll('#tuningMenu .r')].map(e => e.dataset.n);
  uit.regels = regels;
  t.sluit();
  // bij de oude zuil gaat hij niet meer open, en daar staat geen doos meer
  pl.pos.x = TUNING.zuil.x - 1.2; pl.pos.z = TUNING.zuil.z; t.update(0.1);
  const oud = Math.hypot(TUNING.zuil.x - b.x, TUNING.zuil.z - b.z);
  uit.oudeZuil = { afstandTotBalie: +oud.toFixed(2), opent: t.bijPlek(TUNING.zuil.x - 1.2, TUNING.zuil.z) };
  const [zx, zz] = W.resolveCollisions(TUNING.zuil.x, TUNING.zuil.z, 0.1, 0, 0);
  uit.zuilDoos = +Math.hypot(zx - TUNING.zuil.x, zz - TUNING.zuil.z).toFixed(3);
  let zuilMesh = 0; const q = new THREE.Vector3();
  g.scene.traverse(o => { if (o.isMesh && o.geometry && o.geometry.type === 'BoxGeometry' && o.geometry.parameters.height === 1.25 && o.geometry.parameters.width === 0.5) { o.getWorldPosition(q); if (Math.hypot(q.x - TUNING.zuil.x, q.z - TUNING.zuil.z) < 0.5) zuilMesh++; } });
  uit.zuilMesh = zuilMesh;
  pl.active = false; window.__autoplay = false;
  return uit;
});

kop('1. de mat bij de schuifdeuren');
const M = r.mat;
ok(M.length >= 2 && M[0].naam === 'mat' && M[0].y >= 0.05, 'van boven eerst de mat, ruim boven de vloer', JSON.stringify(M));
ok(M.length >= 2 && M[0].y - M.find(h => h.naam === 'vloer').y >= 0.03, 'minstens 3 cm tussen mat en vloer (geen gevecht om dezelfde pixels)', JSON.stringify(M));

kop('2. het kraslot in beeld');
const Kd = r.kaarten;
ok(Kd.every(k => k.zichtbaar), 'na elk lot staat het kaartje in beeld', JSON.stringify(Kd.map(k => k.zichtbaar)));
ok(Kd.every(k => k.prijs > 0 ? k.tekst === `€ ${k.prijs.toLocaleString('nl-NL')} GEWONNEN!` : k.tekst === 'Helaas…'), 'met het bedrag dat je wint, of "Helaas…"', JSON.stringify(Kd.map(k => [k.prijs, k.tekst])));
ok(r.heeftGeluid && Kd.every(k => k.geluid === k.prijs), 'het geluid erbij, met de prijs', JSON.stringify(Kd.map(k => k.geluid)));
ok(r.kaartWeg, 'na een paar tellen is het kaartje weer weg');

kop('3. de wegversperring op de rondweg');
ok(!!r.afsluiting && Math.hypot(r.afsluiting.x - 1708.4, r.afsluiting.z + 110.1) < 3, 'de afzetting staat bij (1708,4; −110,1)', JSON.stringify(r.afsluiting));
ok(r.hekken > 0, 'met hekken in beeld', `${r.hekken} delen`);
ok(r.auto && r.auto.every(d => d < 0.5), 'een auto komt er niet langs, ook niet door de berm', JSON.stringify(r.auto));
ok(r.lopen && r.lopen.every(d => d < 0.5), 'lopend ook niet', JSON.stringify(r.lopen));

kop('4. de tuning bij Sjoerd aan de balie');
ok(r.zonderAuto.toets && !r.zonderAuto.open, 'zonder eigen auto gaat het menu niet open (Sjoerd zegt waarom)', JSON.stringify(r.zonderAuto));
ok(r.metAuto.toets && r.metAuto.open, 'met je eigen auto voor de deur opent E het menu aan de balie', JSON.stringify(r.metAuto));
ok(r.regels.includes('1') && r.regels.includes('5') && r.regels.includes('0'), 'met motor, vering, spoiler, velgen en decals', r.regels.join(','));
ok(!r.oudeZuil.opent, 'bij de plek van de oude zuil niet meer', JSON.stringify(r.oudeZuil));
ok(r.zuilDoos < 0.001 && r.zuilMesh === 0, 'de zuil en zijn botsdoos zijn weg', `${r.zuilDoos} m, ${r.zuilMesh} zuil`);

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);

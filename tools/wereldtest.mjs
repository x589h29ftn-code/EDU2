/*
 Toetst wat je in beeld ziet en niet in een van de andere proeven past.

 1. De lucht: nergens een gat. De luchtbol heeft een straal van 1000 m; stond
    hij op de oorsprong, dan viel zijn achterkant aan de rand van de wijk buiten
    het achtervlak van de camera en keek je door dat gat tegen de zwarte
    achtergrond aan — een zwarte koepel die met je meedraaide.
 2. Het pistool: zichtbaar in de eerste persoon, met een arm die tot in de
    rechteronderhoek doorloopt, en met H stop je hem weg (dan schiet je niet en
    staat het kruisje uit).
 3. Erfscheidingen: in de vakken uit data/stijl/omgeving.json →
    `lageErfscheidingen` staat geen schutting van 1,8 m maar een lage haag.
 4. De vlaggen bij de supermarkt: het doek is twee panelen rug aan rug, zodat
    het woordmerk van beide kanten goed leest.

 Gebruik: python3 -m http.server 8123 &  node tools/wereldtest.mjs 8123
*/
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const port = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 400, height: 260 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  window.__game.player.active = true;
});

// ---------- 1. gaten in de lucht ----------
kop('de lucht');
const lucht = await page.evaluate(async () => {
  const g = window.__game;
  const cv = document.createElement('canvas'); cv.width = 400; cv.height = 260;
  const ctx = cv.getContext('2d');
  // de hoeken van de wijk: daar is de camera het verst van de oorsprong.
  // Er wordt niet zelf gerenderd: de hoofdlus van js/main.js moet het doen,
  // want dáár schuift de luchtbol met de camera mee.
  const beeld = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const plekken = [[380, -420], [-320, -400], [360, 420], [-300, 430]];
  let ergste = 0, waar = null;
  for (const [x, z] of plekken) {
    for (let k = 0; k < 4; k++) {
      g.player.pos.set(x, 0, z);
      g.player.yaw = k * Math.PI / 2; g.player.pitch = 0.3;
      g.player.applyCamera();
      await beeld();
      ctx.drawImage(g.renderer.domElement, 0, 0, 400, 260);
      const d = ctx.getImageData(0, 0, 400, 110).data;      // bovenste deel = lucht
      let n = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i] < 24 && d[i + 1] < 24 && d[i + 2] < 24) n++;
      if (n > ergste) { ergste = n; waar = [x, z, Math.round(k * 90)]; }
    }
  }
  return { ergste, waar };
});
ok(lucht.ergste < 40, 'nergens een zwart gat in de lucht',
  lucht.waar ? `ergste plek ${lucht.waar[0]},${lucht.waar[1]} kijkend ${lucht.waar[2]}°: ${lucht.ergste} beeldpunten` : 'geen');

// ---------- 2. het pistool ----------
kop('het pistool in beeld');
const wapen = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  g.player.inCar = null; g.derde.aan = false;
  g.player.pos.set(96, 0, -58); g.player.yaw = 0; g.player.pitch = 0;
  g.player.update(1 / 60);
  // maten in cameraruimte: het wapen hangt aan de camera, dus een gewone
  // wereld-Box3 zou de plek van de speler teruggeven
  const doos = new THREE.Box3();
  for (const o of g.player.gun.children) {
    if (!o.isMesh) continue;
    o.updateMatrix();
    o.geometry.computeBoundingBox();
    doos.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrix));
  }
  doos.translate(g.player.gun.position);
  const grootte = doos.getSize(new THREE.Vector3());
  const zichtbaar = g.player.gun.visible;
  // de arm moet naar rechtsonder uit beeld lopen
  const armEind = doos.max.z, armRechts = doos.max.x, armOnder = doos.min.y;
  g.player.wisselWapen();
  g.player.update(1 / 60);
  const naH = { zichtbaar: g.player.gun.visible, kruis: getComputedStyle(document.getElementById('crosshair')).display };
  const munitieVoor = g.player.ammo;
  g.player.shoot();
  const geschoten = g.player.ammo !== munitieVoor;
  g.player.wisselWapen();
  g.player.update(1 / 60);
  return { zichtbaar, lengte: +grootte.z.toFixed(3), hoogte: +grootte.y.toFixed(3),
    armEind: +armEind.toFixed(2), armRechts: +armRechts.toFixed(2), armOnder: +armOnder.toFixed(2),
    naH, geschoten, weerTerug: g.player.gun.visible,
    kruisTerug: getComputedStyle(document.getElementById('crosshair')).display };
});
ok(wapen.zichtbaar, 'het pistool staat in beeld');
ok(wapen.lengte > 0.55, 'het is groot genoeg om iets van te zien', `${wapen.lengte} m van loop tot elleboog`);
ok(wapen.armEind > 0.05 && wapen.armRechts > 0.2 && wapen.armOnder < -0.25,
  'de arm loopt naar de rechteronderhoek uit beeld',
  `tot x ${wapen.armRechts}, y ${wapen.armOnder}, z ${wapen.armEind}`);
ok(!wapen.naH.zichtbaar && wapen.naH.kruis === 'none', 'met H stop je hem weg, met het kruisje erbij');
ok(!wapen.geschoten, 'weggestopt schiet je niet');
ok(wapen.weerTerug && wapen.kruisTerug !== 'none', 'en met H komt hij weer terug');

// ---------- 3. erfscheidingen ----------
kop('erfscheidingen');
const omgeving = JSON.parse(readFileSync('data/stijl/omgeving.json', 'utf8'));
const vakken = omgeving.lageErfscheidingen || [];
const erf = await page.evaluate(async (vakken) => {
  const { KAART } = await import('./js/kaart.js');
  const uit = [];
  for (const v of vakken) {
    const inVak = (x, z) => x >= v.x0 && x <= v.x1 && z >= v.z0 && z <= v.z1;
    const hoog = KAART.schuttingen.filter(s => inVak((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2));
    const laag = KAART.heggen.filter(s => inVak((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2));
    uit.push({ naam: v.naam, hoog: hoog.length, laag: laag.length,
      hoogste: laag.reduce((m, s) => Math.max(m, s.h), 0) });
  }
  return uit;
}, vakken);
for (const v of erf) {
  ok(v.hoog === 0, `geen schutting van 1,8 m bij "${v.naam}"`, `${v.hoog} gevonden`);
  ok(v.laag > 0 && v.hoogste < 1.1, 'wel een lage haag of hekje', `${v.laag} stuks, hoogste ${v.hoogste} m`);
}

// ---------- 4. de vlaggen bij de supermarkt ----------
kop('de vlaggen bij de supermarkt');
const vlag = await page.evaluate(() => {
  const g = window.__game;
  let doek = null;
  g.scene.traverse(o => {
    if (doek || !o.isMesh || !o.material || !o.material.map) return;
    if (o.material.map.image && o.material.map.image.width === 128 && o.material.map.image.height === 512) doek = o;
  });
  if (!doek) return { gevonden: false };
  const n = doek.geometry.attributes.position.count / 3;
  return { gevonden: true, driehoeken: n };
});
ok(vlag.gevonden, 'het vlaggendoek zit in de wereld');
ok(vlag.gevonden && vlag.driehoeken >= 24,
  'het doek is twee panelen rug aan rug, dus het woordmerk leest van beide kanten goed',
  `${vlag.driehoeken} driehoeken`);

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);

/*
 Stap 174 (npm run claxonwraktest): twee opmerkingen van de gebruiker.

   1. "gebruik dit muziek geluidje als claxon auto's": audio/auto/claxon.mp3 staat er, wordt geladen, en
      `geluid.claxon` speelt daarna de opname (zachter op afstand), niet de twee tonen;
   2. "na explosie politieauto ziet het model er wat gek uit, aan de bovenkant": na `laatOntploffen` is geen
      gloed, halo of plas licht een zwart vlak geworden — die zijn uit — en het wrak is niet hoger dan de auto
      zelf (geen zwart vlak boven het dak). Na `herstelWrak` is alles weer zoals het was.

 Gebruik: npm run server &  node tools/claxonwraktest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fout++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  const { geluid, CLAXON } = await import('./js/audio.js');
  document.getElementById('overlay').style.display = 'none';
  await g.voorbereidSpel();
  const uit = {};

  // ---- 1. de claxon
  const res = await fetch(CLAXON.url);
  uit.bestand = res.status;
  geluid.start();
  await geluid.laadWapenOpnames();
  geluid.claxonTot = 0; geluid.claxon(3); uit.dicht = geluid.laatsteClaxon ? { ...geluid.laatsteClaxon } : null;
  geluid.claxonTot = 0; geluid.claxon(25); uit.ver = geluid.laatsteClaxon ? { ...geluid.laatsteClaxon } : null;
  const n0 = geluid.claxons; geluid.claxon(3); uit.nietOverElkaar = geluid.claxons === n0 + 1;

  // ---- 2. het politiewrak
  const P = g.player, V = g.vehicles;
  const car = g.politie.parkeerAuto(P.pos.x + 30, P.pos.z, 0);
  V.zetNeer(car, 0.016, car.yaw, {});
  if (car.zwaailicht && car.zwaailicht.zet) car.zwaailicht.zet(true);
  g.scene.updateMatrixWorld(true);
  const lichtVlak = (m) => m && (m.blending === THREE.AdditiveBlending || (m.transparent && (m.isMeshBasicMaterial || m.opacity < 0.5 || m.depthWrite === false)));
  const meet = () => {
    const box = new THREE.Box3(); let zwartLicht = 0, lichtAan = 0;
    car.mesh.traverse(o => {
      if (!o.isMesh) return;
      let zicht = true; for (let q = o; q; q = q.parent) if (!q.visible) zicht = false;
      if (!zicht) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const was = car.lak && car.lak.find(([oo]) => oo === o);
      if (was && lichtVlak(Array.isArray(was[1]) ? was[1][0] : was[1])) zwartLicht++;
      if (lichtVlak(m)) { lichtAan++; return; }
      box.expandByObject(o);
    });
    return { top: +(box.max.y - car.mesh.position.y).toFixed(2), zwartLicht, lichtAan };
  };
  uit.voor = meet();
  V.laatOntploffen(car);
  g.scene.updateMatrixWorld(true);
  uit.wrak = meet();
  uit.uit = car.lakUit ? car.lakUit.length : 0;
  V.herstelWrak(car);
  g.scene.updateMatrixWorld(true);
  uit.terug = meet();
  return uit;
});

kop('1. de claxon');
ok(r.bestand === 200, 'audio/auto/claxon.mp3 staat er', `${r.bestand}`);
ok(r.dicht && r.dicht.opname, 'de claxon speelt de opname van de gebruiker', JSON.stringify(r.dicht));
ok(r.ver && r.dicht && r.ver.gain < r.dicht.gain, 'op afstand zachter', JSON.stringify([r.dicht, r.ver]));
ok(r.nietOverElkaar, 'een claxon die nog klinkt laat de volgende vallen (geteld, niet gespeeld)');

kop('2. het politiewrak');
ok(r.wrak.zwartLicht === 0 && r.wrak.lichtAan === 0 && r.uit > 0, 'geen gloed of plas licht als zwart vlak: die zijn uit', JSON.stringify({ wrak: r.wrak, uit: r.uit }));
ok(r.wrak.top <= r.voor.top + 0.01, 'het wrak is niet hoger dan de auto (niets zwarts boven het dak)', `${r.voor.top} → ${r.wrak.top} m`);
ok(r.terug.top === r.voor.top && r.terug.zwartLicht === 0, 'na herstelWrak weer de oude auto', JSON.stringify(r.terug));

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);

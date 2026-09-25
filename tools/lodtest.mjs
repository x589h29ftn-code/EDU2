/*
 De LOD verder weg en zacht, de intro voorbereid, en het verkeer (melding
 25 sep 2026: "de voortuinen clippen in het intro filmpje. Ook bij de intro is de
 LOD wat lelijk; misschien kan je dat pre-renderen. Ik zie ook geen verkeer meer
 rijden. Verder de LOD pas op verdere afstand inzetten en smooth laten
 overgaan").

   node tools/server.mjs 8123 &   node tools/lodtest.mjs [poort]

 1. Verder weg: alle afstanden maal `LOD.schaal`, de auto's vanaf 70 m grof.
 2. Zacht: een tegel die aan of uit gaat vervaagt in `LOD.VERVAAG` seconden, op
    een eigen kopie van zijn materialen (het origineel blijft zonder dithering);
    de fijne en de grove kroon lopen precies tegen elkaar in, met het omgekeerde
    patroon, en in beeld vullen ze elkaars gaten: het groen van de kronen blijft
    gelijk tijdens de overgang.
 3. Het voorvlak loopt met de hoogte mee, en vanaf 200 m hoog flikkeren de tuinen
    niet meer (gemeten bij een verschuiving van één millimeter).
 4. De intro: vóór het filmpje zijn de gevels en het reliëf af en is elk beeld
    één keer getekend; tijdens het filmpje volgt de LOD de camera.
 5. Het verkeer: na een minuut aan de Molenkrite rijden er wijkauto's in de buurt.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fout++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  window.__W = await import('/js/world.js');
  window.__I = await import('/js/intro.js');
  window.__C = await import('/js/carmodel.js');
  window.__K = (await import('/js/kaart.js')).KAART;
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  // de hoofdlus zet de camera elk beeld op de speler; hier beslist de proef
  window.__camVrij = g.player.applyCamera.bind(g.player);
  g.player.applyCamera = () => {};
});

// ---------------------------------------------------------------- 4. de intro (eerst: reliëf is dan nog bezig)
kop('de intro, voorbereid');
const voor = await page.evaluate(async () => {
  const g = window.__game;
  const bezig = g.reliëfBezig;
  await g.voorFilm();
  return { bezigVoor: bezig, bezigNa: g.reliëfBezig, ...window.__voorFilm, zwart: document.getElementById('introzwart').style.opacity };
});
ok(!voor.bezigNa, 'vóór het filmpje zijn de gevels en het reliëf af', voor.bezigVoor ? 'was nog bezig bij het begin' : 'was al af');
ok(voor.beelden >= 9, 'en is elk stuk van de film één keer getekend, achter zwart', `${voor.beelden} beelden in ${voor.ms} ms, zwart ${voor.zwart}`);

// ---------------------------------------------------------------- 1. verder weg
kop('verder weg');
const ver = await page.evaluate(() => {
  const W = window.__W, g = window.__game;
  // de gewone groepen (zonder `vanaf`): welke staat aan op 1,2 × zijn oude grens
  let n = 0, aan = 0;
  for (const q of W.lodGroepen) {
    if (q.vanaf || !q.tot || q.tot > 600) continue;
    n++;
    const x = q.x + q.tot * 1.2, z = q.z;           // 1,2 × de oude afstand
    W.updateLOD(x, z);
    if (q.obj.visible) aan++;
    if (n >= 40) break;
  }
  W.updateLOD(g.start.x, g.start.z);
  return { schaal: W.LOD.schaal, n, aan, auto: window.__C.VER_VANAF };
});
ok(ver.schaal >= 1.4, 'alle afstanden van de LOD gaan maal', `${ver.schaal}`);
ok(ver.aan === ver.n, 'wat op 1,2 × de oude grens staat, is nu nog te zien', `${ver.aan} van ${ver.n} groepen`);
ok(ver.auto >= 70, 'en een geparkeerde auto wordt pas grof op', `${ver.auto} m`);

// ---------------------------------------------------------------- 2. zacht
kop('zacht');
const zacht = await page.evaluate(() => {
  const W = window.__W, g = window.__game;
  // een boomtegel met een fijne en een grove kroon: dezelfde plek, `vanaf` bij de grove
  const fijn = W.lodGroepen.find(q => q.obj.userData.klasse === 'kroon');
  const grof = W.lodGroepen.find(q => q.obj.userData.klasse === 'kroonVer' && q.x === fijn.x && q.z === fijn.z);
  const grens = fijn.tot * W.LOD.schaal;
  // dichtbij: fijn aan, grof uit
  W.updateLOD(fijn.x + grens - 20, fijn.z);
  const voor = { fijn: fijn.obj.visible, grof: grof.obj.visible, mat: fijn.obj.material };
  // een paar meter over de grens, zacht: allebei in beeld, de fijne gaat eruit
  W.updateLOD(fijn.x + grens + 5, fijn.z, { zacht: true });
  const direct = { fijn: fijn.obj.visible, grof: grof.obj.visible, ff: fijn.f, fg: grof.f };
  W.vervaagLOD(W.LOD.VERVAAG * 0.5);
  const half = { fijn: fijn.obj.visible, grof: grof.obj.visible, ff: fijn.f, fg: grof.f,
    kopie: fijn.obj.material !== voor.mat, define: 'LOD_VERVAAG' in (fijn.obj.material.defines || {}),
    origZonder: !('LOD_VERVAAG' in (voor.mat.defines || {})),
    omFijn: fijn.obj.material._lodOm && fijn.obj.material._lodOm.value, omGrof: grof.obj.material._lodOm && grof.obj.material._lodOm.value,
    uFijn: fijn.obj.material._lodF && fijn.obj.material._lodF.value };
  W.vervaagLOD(W.LOD.VERVAAG * 0.6);
  const na = { fijn: fijn.obj.visible, grof: grof.obj.visible, terug: fijn.obj.material === voor.mat, vervagend: W.lodVervagend() };
  return { voor, direct, half, na };
});
ok(zacht.voor.fijn && !zacht.voor.grof, 'dichtbij staat de fijne kroon, niet de grove');
ok(zacht.direct.fijn && zacht.direct.grof, 'over de grens staan ze even allebei in beeld, niets klapt om');
ok(Math.abs(zacht.half.ff - 0.5) < 0.02 && Math.abs(zacht.half.ff + zacht.half.fg - 1) < 1e-6,
  'halverwege: de fijne half weg, de grove half erbij, samen precies één', `fijn ${zacht.half.ff.toFixed(2)}, grof ${zacht.half.fg.toFixed(2)}`);
ok(zacht.half.kopie && zacht.half.define && zacht.half.origZonder, 'dat gaat op een kopie van het materiaal; het origineel heeft geen dithering');
ok(zacht.half.omFijn === 0 && zacht.half.omGrof === 1 && Math.abs(zacht.half.uFijn - zacht.half.ff) < 1e-6, 'de grove met het omgekeerde patroon, zodat ze elkaars gaten vullen');
ok(!zacht.na.fijn && zacht.na.grof && zacht.na.terug && zacht.na.vervagend === 0, 'en daarna staat alleen de grove er, weer op het gewone materiaal',
  `${zacht.na.vervagend} nog bezig`);

// in beeld: evenveel kroongroen voor, tijdens en na de overgang
const beeld = await page.evaluate(async () => {
  const W = window.__W, g = window.__game, cam = g.camera, gl = g.renderer.getContext();
  const fijn = W.lodGroepen.find(q => q.obj.userData.klasse === 'kroon' && q.obj.count > 20);
  const grof = W.lodGroepen.find(q => q.obj.userData.klasse === 'kroonVer' && q.x === fijn.x && q.z === fijn.z);
  // alleen deze twee kronen in beeld, tegen een lege achtergrond
  const scene = new (await import('three')).Scene();
  const ouders = [fijn.obj.parent, grof.obj.parent];
  scene.add(fijn.obj, grof.obj);
  const THREE = await import('three');
  scene.add(new THREE.AmbientLight(0xffffff, 3));
  const grens = fijn.tot * W.LOD.schaal;
  // de LOD rekent met de plek die `updateLOD` krijgt, niet met de camera: die mag
  // dus dichtbij staan, schuin boven de tegel, zodat er veel kroon in beeld is
  cam.position.set(fijn.x + 160, 90, fijn.z + 60); cam.lookAt(fijn.x, 4, fijn.z); cam.near = 1; cam.far = 2000; cam.updateProjectionMatrix();
  // de camera hangt in de echte scène: bij een andere scène werkt three zijn
  // stand niet zelf bij
  cam.updateMatrixWorld(true);
  const tel = () => {
    g.renderer.setRenderTarget(null); g.renderer.setClearColor(0x000000, 1); g.renderer.clear(); g.renderer.render(scene, cam);
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a);
    let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] + a[i + 1] + a[i + 2] > 20) n++;
    return n;
  };
  // (zonder `zacht` staat het meteen; zo tellen we de fijne en de grove los)
  W.updateLOD(fijn.x + grens - 20, fijn.z); const alleenFijn = tel();
  W.updateLOD(fijn.x + grens + 20, fijn.z); const alleenGrof = tel();
  W.updateLOD(fijn.x + grens - 20, fijn.z);
  W.updateLOD(fijn.x + grens + 5, fijn.z, { zacht: true });
  const rij = [];
  for (let k = 0; k < 5; k++) { W.vervaagLOD(W.LOD.VERVAAG / 6); rij.push({ f: +fijn.f.toFixed(2), n: tel() }); }
  W.vervaagLOD(1);
  // terugzetten
  ouders[0].add(fijn.obj); ouders[1].add(grof.obj);
  W.updateLOD(g.start.x, g.start.z);
  g.renderer.setClearColor(0x000000, 0);
  cam.near = g.cameraNear; cam.far = 1200; cam.updateProjectionMatrix();
  return { alleenFijn, alleenGrof, rij };
});
const minst = Math.min(...beeld.rij.map(r => r.n)), meest = Math.max(...beeld.rij.map(r => r.n));
const ref = Math.max(beeld.alleenFijn, beeld.alleenGrof);
ok(minst > Math.min(beeld.alleenFijn, beeld.alleenGrof) * 0.9 && meest < ref * 1.1,
  'in beeld: tijdens de overgang evenveel kroon als ervoor en erna — geen gat, niets dubbel',
  `fijn ${beeld.alleenFijn}, grof ${beeld.alleenGrof}, onderweg ${beeld.rij.map(r => r.n).join(' / ')} beeldpunten`);

// ---------------------------------------------------------------- 3. het voorvlak
kop('het voorvlak en de tuinen van boven');
const vlak = await page.evaluate(async () => {
  const g = window.__game, I = window.__I, cam = g.camera, gl = g.renderer.getContext(), W = window.__W;
  const near = (y) => { cam.position.y = y; g.zetVoorvlak(); return cam.near; };
  const oog = near(1.7), dak = near(12), hoog = near(200);
  const zet = (t) => { const B = I.beeldOp(t, window.__K, g.start); cam.position.set(B.pos.x, B.pos.y, B.pos.z); cam.lookAt(B.kijk.x, B.kijk.y, B.kijk.z); cam.updateMatrixWorld(); return B; };
  const beeld = () => { g.renderer.setRenderTarget(null); g.renderer.render(g.scene, cam); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; const a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
  const flikker = (t, metVoorvlak) => {
    const B = zet(t); W.updateLOD(B.pos.x, B.pos.z);
    if (metVoorvlak) g.zetVoorvlak(); else { cam.near = g.cameraNear; cam.updateProjectionMatrix(); }
    const a = beeld();
    zet(t + 0.0001);                         // een millimeter verder
    if (metVoorvlak) g.zetVoorvlak();
    const c = beeld();
    let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - c[i]) + Math.abs(a[i + 1] - c[i + 1]) + Math.abs(a[i + 2] - c[i + 2]) > 90) n++;
    return n / (a.length / 4);
  };
  const oud = [2, 6].map(t => flikker(t, false)), nu = [2, 6].map(t => flikker(t, true));
  cam.near = g.cameraNear; cam.updateProjectionMatrix();
  return { oog, dak, hoog, oud, nu };
});
ok(Math.abs(vlak.oog - 0.15) < 1e-6, 'op ooghoogte blijft het voorvlak 15 cm', `${vlak.oog} m`);
ok(vlak.hoog > 3, 'op tweehonderd meter hoog ligt het een paar meter voor de camera', `${vlak.dak.toFixed(2)} m op 12 m hoog, ${vlak.hoog.toFixed(2)} m op 200 m`);
ok(Math.max(...vlak.nu) < 0.001 && Math.max(...vlak.nu) < Math.min(...vlak.oud) * 0.4, 'en de tuinen flikkeren niet meer in het eerste beeld van de intro',
  `${vlak.oud.map(v => (v * 100).toFixed(2)).join(' en ')} % van het beeld sprong, nu ${vlak.nu.map(v => (v * 100).toFixed(3)).join(' en ')} %`);

// ---------------------------------------------------------------- 4b. tijdens het filmpje volgt de LOD de camera
const film = await page.evaluate(async () => {
  const g = window.__game, I = window.__I, W = window.__W;
  W.updateLOD(g.start.x, g.start.z);
  // het filmpje echt laten lopen (zonder muziek) en na een paar seconden kijken
  const p = I.speelIntro({ camera: g.camera, KAART: window.__K, start: g.start, geluidAan: false });
  await new Promise(r => setTimeout(r, 4000));
  // de hoofdlus loopt headless nauwelijks: een paar beelden van de intro-tak zelf
  for (let i = 0; i < 4; i++) await new Promise(r => requestAnimationFrame(r));
  // (headless duurt een beeld een seconde: de camera is dan al verder dan waar
  // de LOD het laatst gerekend is; die plek houdt het spel bij)
  const cam = g.lodFilmBij || { x: NaN, z: NaN };
  const vanStart = Math.hypot(cam.x - g.start.x, cam.z - g.start.z);
  let klopt = 0, n = 0;
  for (const q of W.lodGroepen) {
    if (q.vanaf) continue;
    const d = Math.hypot(q.x - cam.x, q.z - cam.z), grens = q.tot * W.LOD.schaal;
    if (Math.abs(d - grens) < 40) continue;         // op de grens kan hij net omklappen
    n++; if (q.doel === (d < grens)) klopt++;
  }
  const t = I.stand().t;
  I.slaOver(); await p;
  return { klopt, n, t, vanStart, cam: [cam.x, cam.z].map(v => Math.round(v)) };
});
ok(film.n > 0 && film.klopt === film.n && film.vanStart > 100, 'tijdens het filmpje volgt de LOD de camera, niet het beginpunt',
  `${film.klopt} van ${film.n} groepen goed op ${film.t} s, bijgewerkt op (${film.cam.join(', ')}), ${Math.round(film.vanStart)} m van het beginpunt`);

// ---------------------------------------------------------------- 5. verkeer
kop('verkeer');
const verkeer = await page.evaluate(() => {
  const g = window.__game, v = g.vehicles, s = g.start;
  for (let i = 0; i < 1800; i++) v.updateTraffic(1 / 30, null, [], s.x, s.z);
  const lokaal = v.traffic.filter(t => t.lokaal && t._pos);
  const dicht = lokaal.filter(t => Math.hypot(t._pos.x - s.x, t._pos.y - s.z) < 260);
  return { totaal: lokaal.length, dicht: dicht.length, rijdt: dicht.filter(t => t.snelheid > 2).length };
});
ok(verkeer.totaal >= 12, 'er zijn twaalf wijkauto\'s in plaats van zes', `${verkeer.totaal}`);
ok(verkeer.dicht >= 5 && verkeer.rijdt >= 4, 'en na een minuut rijden er een stuk of vijf binnen 260 m (was twee)',
  `${verkeer.dicht} binnen 260 m, waarvan ${verkeer.rijdt} rijden`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);

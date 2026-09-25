/*
 De nacht op straat (ronde van 25 sep 2026: "neem de wereld verder door op
 verbeteringen, optimalisatie en spelbeleving").

   node tools/server.mjs 8123 &   node tools/nachttest.mjs [poort]

 1. Onder elke lantaarn ligt 's nachts een plas licht op de grond: één instanced
    mesh, recht onder de kop, overdag uit. Een omgereden paal schijnt niet meer
    op straat, en overeind weer wel.
 2. Geparkeerde auto's staan met hun lampen uit — dat stonden ze dag en nacht aan,
    want ze deelden het lampmateriaal met het verkeer. Wat rijdt heeft overdag
    dagrijverlichting en 's nachts de lampen vol aan, met een bundel op de weg
    vóór de neus, waar een kogel doorheen gaat.
 3. In beeld: 's nachts is de straat onder de palen lichter dan zonder de plassen,
    warm van kleur, en nergens wit.
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
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const THREE = await import('three');
  const W = await import('/js/world.js');
  const KW = await import('/js/kaartwereld.js');
  const C = await import('/js/carmodel.js');
  const g = window.__game, s = g.start, v = g.vehicles, gl = g.renderer.getContext();
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  g.reliëfAf();
  const zet = (uur) => { g.sfeer.uur = uur; g.sfeer.weer = 'helder'; for (let i = 0; i < 3; i++) g.sfeer.update(0.1, s.x, s.z); };
  const uit = {};
  const poel = KW.lichtpoelen();

  // ---- 1. de plassen
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  let mis = 0;
  for (let i = 0; i < poel.count; i++) {
    poel.getMatrixAt(i, m); m.decompose(p, q, sc);
    const l = W.lampPosities[i];
    if (!l || Math.hypot(p.x - l.x, p.z - l.z) > 0.1 || sc.x < 5) mis++;
  }
  uit.poel = { n: poel.count, lampen: W.lampPosities.length, mis, klasse: poel.userData.klasse };
  zet(13);
  uit.dag = { zicht: poel.visible, kop: C.koplampStand() };
  zet(23);
  uit.nacht = { zicht: poel.visible, opacity: poel.material.opacity, kop: C.koplampStand() };
  // een paal omrijden en weer overeind laten komen
  const L = W.lampPosities[0];
  const paal = KW.lantaarnBij(L.x, L.z, 2);
  const omver = paal ? KW.raakLantaarn(paal.x, paal.z, 0, 20) : false;
  poel.getMatrixAt(paal.i, m); m.decompose(p, q, sc); const omSchaal = sc.x;
  // uit beeld en lang genoeg: hij komt overeind
  KW.werkLantaarnsBij(60, paal.x + 500, paal.z);
  KW.werkLantaarnsBij(60, paal.x + 500, paal.z);
  poel.getMatrixAt(paal.i, m); m.decompose(p, q, sc);
  uit.paal = { omver, omSchaal, terugSchaal: sc.x, om: KW.lantaarnsOm() };

  // ---- 2. de auto's
  const stapel = Object.values(v.stapels)[0].stapel;
  const lampMat = (lijst) => lijst.map(x => x.material).filter(mt => mt.emissiveMap);
  uit.stil = lampMat(stapel.meshes).concat(lampMat(stapel.verMeshes)).map(mt => mt.emissiveIntensity);
  const t0 = v.traffic[0].mesh;
  const kopMat = [];
  t0.traverse(o => { if (o.isMesh && o.material.emissiveMap) kopMat.push(o.material.emissiveIntensity); });
  const bundel = t0.children.find(c => c.userData.bundel);
  t0.updateMatrixWorld(true);
  const voor = new THREE.Vector3(0, 0, -1).transformDirection(t0.matrixWorld);
  const midden = new THREE.Box3().setFromObject(bundel).getCenter(new THREE.Vector3());
  const naar = midden.sub(t0.getWorldPosition(new THREE.Vector3()));
  const rc = new THREE.Raycaster(new THREE.Vector3(midden.x, 5, midden.z), new THREE.Vector3(0, -1, 0));
  uit.verkeer = { kop: kopMat, bundel: !!bundel, zicht: bundel && bundel.visible, vooruit: naar.dot(voor), raak: rc.intersectObject(bundel).length,
    bundels: v.traffic.filter(t => t.mesh.children.some(c => c.userData.bundel && c.visible)).length, totaal: v.traffic.length };

  // ---- 3. in beeld: 's nachts met en zonder de plassen
  // vanaf het beginpunt staat er geen paal in beeld (de dichtstbijzijnde staat
  // dertig meter opzij): dus op ooghoogte veertien meter van de dichtstbijzijnde,
  // ernaar kijkend
  const cam = g.camera;
  g.player.applyCamera = () => {};
  const LP = W.lampPosities.map(l => ({ l, d: Math.hypot(l.x - s.x, l.z - s.z) })).sort((a, b) => a.d - b.d)[0].l;
  cam.position.set(LP.x + 12, 1.7, LP.z + 7); cam.lookAt(LP.x, 0.5, LP.z); cam.updateMatrixWorld(true);
  W.updateLOD(cam.position.x, cam.position.z);
  const beeld = () => { g.renderer.setRenderTarget(null); g.renderer.render(g.scene, g.camera); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, a = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
  const met = beeld();
  poel.visible = false;
  const zonder = beeld();
  poel.visible = true;
  let n = 0, lum = 0, r0 = 0, b0 = 0, wit = 0, witZonder = 0;
  for (let i = 0; i < met.length; i += 4) {
    const d = met[i] + met[i + 1] + met[i + 2] - zonder[i] - zonder[i + 1] - zonder[i + 2];
    if (met[i] > 245 && met[i + 1] > 245 && met[i + 2] > 245) wit++;
    if (zonder[i] > 245 && zonder[i + 1] > 245 && zonder[i + 2] > 245) witZonder++;
    if (d < 9) continue;
    n++; lum += d / 3; r0 += met[i] - zonder[i]; b0 += met[i + 2] - zonder[i + 2];
  }
  const N = met.length / 4;
  uit.beeld = { deel: n / N, erbij: n ? lum / n : 0, warm: n ? (r0 - b0) / n : 0, wit: (wit - witZonder) / N };
  zet(13);
  return uit;
});

kop('plassen licht onder de palen');
ok(r.poel.n === r.poel.lampen && r.poel.mis === 0, 'onder elke lantaarn ligt er een, recht onder de kop', `${r.poel.n} plassen voor ${r.poel.lampen} lampen, ${r.poel.mis} ernaast`);
ok(!r.dag.zicht && r.nacht.zicht && r.nacht.opacity > 0.3, 'overdag uit, om elf uur aan', `dekking ${r.nacht.opacity.toFixed(2)}`);
ok(r.paal.omver && r.paal.omSchaal === 0, 'een omgereden paal schijnt niet meer op straat');
ok(r.paal.terugSchaal > 5 && r.paal.om === 0, 'en als hij weer overeind staat wel', `schaal ${r.paal.terugSchaal.toFixed(1)}`);

kop('de lampen van de auto\'s');
ok(r.stil.length >= 4 && r.stil.every(x => x < 0.1), 'geparkeerde auto\'s staan met hun lampen uit', r.stil.map(x => x.toFixed(2)).join(', '));
ok(r.dag.kop.kop > 0.2 && r.dag.kop.kop < 0.6, 'wat rijdt heeft overdag dagrijverlichting', `${r.dag.kop.kop}`);
ok(r.nacht.kop.kop > 1.5 && r.verkeer.kop.some(x => x > 1.5), 'en \'s nachts de lampen vol aan', `${r.nacht.kop.kop}`);
ok(r.verkeer.bundel && r.verkeer.zicht && r.verkeer.vooruit > 3 && r.verkeer.bundels === r.verkeer.totaal,
  'met een bundel licht op de weg, vóór de neus', `${r.verkeer.vooruit.toFixed(1)} m vooruit, ${r.verkeer.bundels} van ${r.verkeer.totaal} auto's`);
ok(r.verkeer.raak === 0, 'waar een kogel doorheen gaat');

kop('in beeld');
// (veertien meter van de paal op ooghoogte: de plas ligt schuin in beeld, een paar honderd beeldpunten)
ok(r.beeld.deel > 0.003 && r.beeld.erbij > 10, '\'s nachts is de straat onder de palen lichter', `${(r.beeld.deel * 100).toFixed(1)} % van het beeld, gemiddeld ${r.beeld.erbij.toFixed(0)} lichter`);
ok(r.beeld.warm > 3, 'warm van kleur', `rood ${r.beeld.warm.toFixed(0)} boven blauw`);
ok(r.beeld.wit < 0.001, 'en nergens wit', `${(r.beeld.wit * 100).toFixed(3)} % witte beeldpunten erbij`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);

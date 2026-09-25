/*
 De omgeving: gras, hagen, water, riet, wind en licht (verzoek 25 sep 2026:
 "kijk ook naar gras texture, gras 3d objecten, hegjes, water, belichting
 kwaliteit").

   node tools/server.mjs 8123 &   node tools/omgevingtest.mjs [poort]

 1. Wind: al het blad waait — ook de kronen en struiken van stap 78, die
    stonden stil — en een waaiend materiaal houdt wat het al had (de haag houdt
    zijn omgevingsschaduw).
 2. Gras in 3D: pollen rond de speler, alleen op gras, en weinig driehoeken.
 3. Riet: bossen stengels van meer dan een meter in plaats van bolletjes van
    veertig centimeter, en goedkoper (twaalf driehoeken per bos, was dertig).
 4. Haag: reliëf in het blad en omgevingsschaduw aan de voet.
 5. Water: donker, glad en met rimpels die bewegen.
 6. 's Avonds: de wolken worden donker, en achter een deel van de ramen brandt
    licht (gemeten in het beeld zelf).
 7. Voor de pc: de driehoeken in beeld op de drie vaste plekken van de
    groentest (7,53, 4,21 en 3,13 miljoen) hoogstens 3 % meer.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fout++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const VOOR = [7.53e6, 4.21e6, 3.13e6];

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const THREE = await import('three');
  const W = await import('/js/world.js');
  const KW = await import('/js/kaartwereld.js');
  const L = await import('/js/licht.js');
  const g = window.__game, s = g.start;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true; g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  g.reliëfAf();
  const uit = {};
  const gl = g.renderer.getContext();
  const programmaMet = (tekst) => (g.renderer.info.programs || []).filter(p => (gl.getAttachedShaders(p.program) || []).some(sh => (gl.getShaderSource(sh) || '').includes(tekst))).length;
  const zet = (x, z, yaw, pitch = -0.05, uur = 14) => {
    g.sfeer.uur = uur; g.sfeer.weer = 'helder';
    for (let i = 0; i < 3; i++) g.sfeer.update(0.1, x, z);
    g.player.pos.set(x, 0, z); g.player.yaw = yaw; g.player.pitch = pitch; g.player.applyCamera();
    W.updateLOD(g.camera.position.x, g.camera.position.z);
    if (g.grasVeld) g.grasVeld.update(g.camera.position.x, g.camera.position.z, true);
  };

  // ---- wind
  const soorten = {};
  g.scene.traverse(o => { if (o.isMesh && o.userData.klasse && ['kroon', 'kroonBobbel', 'kroonVer', 'struik', 'riet', 'grasveld'].includes(o.userData.klasse)) soorten[o.userData.klasse] = o.material; });
  uit.wind = Object.fromEntries(Object.entries(soorten).map(([k, m]) => [k, !!m.userData.waait]));
  const heg = W.sfeerMaterialen().hedge;
  uit.heg = { waait: !!heg.userData.waait, ao: !!heg.userData.grondAO, normaal: !!heg.normalMap };
  zet(s.x, s.z, s.yaw || 0);
  g.renderer.render(g.scene, g.camera);
  uit.windProgramma = programmaMet('uWind');
  uit.haagAO = (g.renderer.info.programs || []).some(p => { const src = (gl.getAttachedShaders(p.program) || []).map(sh => gl.getShaderSource(sh) || '').join(''); return src.includes('uWind') && src.includes('aoGrond'); });

  // ---- gras in 3D
  const gv = g.grasVeld;
  let opGras = 0, naast = 0;
  if (gv) {
    const m = new THREE.Matrix4();
    for (let i = 0; i < gv.mesh.count; i++) { gv.mesh.getMatrixAt(i, m); const v = KW.vlakOp(m.elements[12], m.elements[14]); if (v && (v.m === 'gras' || v.m === 'bodembedekker')) opGras++; else naast++; }
  }
  uit.gras = gv ? { aantal: gv.mesh.count, opGras, naast, driehoeken: gv.mesh.count * gv.mesh.geometry.attributes.position.count / 3, alpha: gv.mat.alphaTest > 0 } : null;

  // ---- riet
  let rietN = 0, rietDrie = 0, rietH = [];
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  g.scene.traverse(o => {
    if (o.userData.klasse !== 'riet') return;
    if (o.isInstancedMesh) { rietN += o.count; rietDrie = o.geometry.attributes.position.count / 3; for (let i = 0; i < Math.min(o.count, 40); i++) { o.getMatrixAt(i, m); m.decompose(p, q, sc); rietH.push(sc.y); } }
    else { rietN = -1; }
  });
  uit.riet = { n: rietN, drie: rietDrie, laag: Math.min(...rietH), hoog: Math.max(...rietH) };

  // ---- water
  const wm = W.sfeerMaterialen().water;
  zet(s.x, s.z, s.yaw || 0, -0.05, 14);
  const off0 = wm.normalMap ? wm.normalMap.offset.clone() : null;
  g.sfeer.update(1.0, s.x, s.z);
  uit.water = { ruw: wm.roughness, normaal: !!wm.normalMap, beweegt: off0 ? wm.normalMap.offset.distanceTo(off0) > 0.001 : false, helder: wm.color.r * 0.3 + wm.color.g * 0.55 + wm.color.b * 0.15 };

  // ---- avond: wolken en ramen
  const wolk = (g.wolken || [])[0];
  zet(s.x, s.z, s.yaw || 0, -0.05, 13);
  uit.wolkDag = wolk ? wolk.mesh.material.color.getHSL({}).l : null;
  uit.nachtDag = L.nachtUniform.value;
  zet(s.x, s.z, s.yaw || 0, -0.05, 23);
  uit.wolkNacht = wolk ? wolk.mesh.material.color.getHSL({}).l : null;
  uit.nachtNacht = L.nachtUniform.value;
  let gevels = 0, metRamen = 0;
  g.scene.traverse(o => { if (o.isMesh && (o.userData.klasse === 'voorgevel' || o.userData.klasse === 'achtergevel')) { gevels++; if (o.material.userData.nachtRamen) metRamen++; } });
  uit.ramen = { gevels, metRamen };
  // in beeld: warme, lichte beeldpunten op de gevels aan de Molenkrite om elf uur
  // (uit het echte beeld, niet uit een eigen rendertarget: die is lineair en
  // zonder tonemapping, en dan valt een warm raam onder de drempel)
  const telWarm = () => {
    g.renderer.setRenderTarget(null); g.renderer.render(g.scene, g.camera);
    const W2 = gl.drawingBufferWidth, H2 = gl.drawingBufferHeight;
    const b = new Uint8Array(W2 * H2 * 4); gl.readPixels(0, 0, W2, H2, gl.RGBA, gl.UNSIGNED_BYTE, b);
    // lichte, warme beeldpunten (de tonemapping maakt het raam beige, niet oranje)
    let n = 0; for (let i = 0; i < b.length; i += 4) if (b[i] > 110 && b[i] > b[i + 2] + 20) n++;
    return n / (W2 * H2);
  };
  const vx = -Math.sin(s.yaw || 0), vz = -Math.cos(s.yaw || 0);
  // dezelfde nacht twee keer: met de ramen aan en met de ramen uit
  zet(s.x - vx * 6, s.z - vz * 6, s.yaw || 0, -0.05, 23);
  uit.warmNacht = telWarm();
  L.nachtUniform.value = 0;
  uit.warmUit = telWarm();

  // ---- driehoeken
  const plekken = [[s.x, s.z, s.yaw || 0], [s.x + 150, s.z - 60, 1.2], [s.x - 200, s.z + 120, 3.0]];
  uit.driehoeken = [];
  for (const [x, z, yaw] of plekken) {
    zet(x, z, yaw, 0, 14);
    const rd = g.renderer; rd.info.autoReset = false; rd.info.reset();
    rd.render(g.scene, g.camera);
    uit.driehoeken.push(rd.info.render.triangles);
    rd.info.autoReset = true;
  }
  return uit;
});

kop('wind');
for (const k of ['kroon', 'kroonBobbel', 'kroonVer', 'struik', 'riet', 'grasveld']) ok(r.wind[k] === true, `${k} waait`, r.wind[k] === undefined ? 'niet gevonden' : '');
ok(r.windProgramma > 0, 'en de wind zit echt in de shaders', `${r.windProgramma} programma's`);
ok(r.heg.waait && r.heg.ao && r.haagAO, 'de haag waait én houdt zijn omgevingsschaduw aan de voet');

kop('gras in 3D');
ok(r.gras && r.gras.aantal > 500, 'er staan pollen gras rond de speler', r.gras ? `${r.gras.aantal} pollen` : 'geen grasveld');
ok(r.gras && r.gras.naast === 0, 'en alleen op het gras', r.gras ? `${r.gras.naast} ernaast` : '');
ok(r.gras && r.gras.driehoeken < 60000 && r.gras.alpha, 'met weinig driehoeken en een doorzichtig doek', r.gras ? `${r.gras.driehoeken} driehoeken` : '');

kop('riet');
ok(r.riet.n > 1000, 'riet langs het water, als instanties', `${r.riet.n} bossen`);
ok(r.riet.laag >= 1.0 && r.riet.hoog <= 2.0, 'van 1,1 tot 1,9 m hoog (was 0,4 m)', `${r.riet.laag.toFixed(2)} tot ${r.riet.hoog.toFixed(2)} m`);
ok(r.riet.drie <= 12, 'met twaalf driehoeken per bos (was dertig)', `${r.riet.drie}`);

kop('haag');
ok(r.heg.normaal, 'de haag heeft reliëf in het blad');

kop('water');
ok(r.water.normaal && r.water.beweegt, 'het water heeft rimpels die bewegen');
ok(r.water.ruw < 0.12 && r.water.helder < 0.3, 'en is donker en glad, zodat het de lucht spiegelt', `ruwheid ${r.water.ruw}, helderheid ${r.water.helder.toFixed(2)}`);

kop("'s avonds");
ok(r.wolkDag > 0.8 && r.wolkNacht < 0.3, "de wolken zijn 's nachts donker, niet wit", `${r.wolkDag?.toFixed(2)} overdag, ${r.wolkNacht?.toFixed(2)} 's nachts`);
ok(r.nachtDag === 0 && r.nachtNacht > 0.9, 'de nacht gaat aan en uit met de klok', `${r.nachtDag} om één uur, ${r.nachtNacht.toFixed(2)} om elf uur`);
ok(r.ramen.metRamen === r.ramen.gevels, 'elke gevel kan licht achter de ramen hebben', `${r.ramen.metRamen} van ${r.ramen.gevels}`);
ok(r.warmNacht - r.warmUit > 0.004, 'en om elf uur brandt er echt licht in beeld',
  `${(r.warmNacht * 100).toFixed(2)} % lichte warme beeldpunten met de ramen aan, ${(r.warmUit * 100).toFixed(2)} % met de ramen uit`);

kop('voor de pc');
r.driehoeken.forEach((d, i) => ok(d <= VOOR[i] * 1.03, `plek ${i + 1}: hoogstens 3 % meer driehoeken`, `${(d / 1e6).toFixed(2)} miljoen (was ${(VOOR[i] / 1e6).toFixed(2)})`));

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);

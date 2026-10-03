/*
 Stap 112: de ambulance en het nieuws op Radio Tinga.

   node tools/server.mjs 8123 &   node tools/ambulancetest.mjs [poort]   (npm run ambulancetest)

 1. Het model: het busje in ambulancegeel, de doeken op de flanken en achterop, vier blauwe lampen.
 2. Een voetganger neergeschoten: de ambulance komt (met de kans op 1 gezet). Hij begint ver weg en
    niet bij de speler, de patiënt blijft liggen, en hij rijdt over de weg met zwaailicht en sirene,
    op de grond, niet harder dan zijn top.
 3. Aankomen, uitstappen, knielen, en de patiënt staat weer op; dan weg zonder zwaailicht, en uit
    beeld verdwijnt hij. Daarna een rustpauze.
 4. 's Nachts: de lampen feller en met gloed.
 5. Niet altijd: van tweehonderd meldingen komt hij bij ongeveer AMB.kans.
 6. Een speler bij VV Sneek aangereden: via js/main.js; de ambulance komt en hij staat weer op.
 7. Stukgeschoten: de rit stopt.
 8. Het nieuws: een melding wacht, komt alleen als je luistert, met de straat erin, de muziek
    zachter; dezelfde soort niet twee keer kort na elkaar; oud nieuws vervalt. En een echte
    schietpartij via js/main.js komt in de rij.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const r1 = (n) => (n == null || !isFinite(n)) ? String(n) : n.toFixed(1);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const A = await import('/js/ambulance.js');
  const N = await import('/js/nieuws.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = false;
  window.__autoplay = false;
  window.__W = W; window.__A = A; window.__N = N;
  // de sirene tellen
  window.__sirene = [];
  const echt = g.geluid.sirene.bind(g.geluid);
  g.geluid.sirene = (d) => { if (d != null) window.__sirene.push(d); return echt(d); };
  window.__zet = (x, z) => { const P = g.player; P.inCar = null; P.pos.set(x, 0, z); P.applyCamera(); };
});

// ------------------------------------------------------------------ 1. het model
kop('het model');
const model = await page.evaluate(() => {
  const g = window.__game, a = g.ambulance;
  if (!a) return { geen: true };
  const m = a.auto.mesh;
  let doeken = 0, ver = 0, lampen = 0;
  // alles wat erop hangt hoort binnen de wagen: in zijn eigen assen niet verder dan vier meter
  const inv = new m.matrixWorld.constructor().copy(m.matrixWorld).invert();
  m.updateMatrixWorld(true);
  m.traverse(o => {
    if (!o.isMesh) return;
    const doek = o.material && o.material.map && o.material.map.image && o.material.map.image.width >= 256 && o.geometry.type === 'PlaneGeometry';
    const lamp = o.material && o.material.emissive && o.material.color && o.material.color.getHex() === 0x2b6bff;
    if (!doek && !lamp) return;
    if (doek) doeken++; if (lamp) lampen++;
    const p = o.getWorldPosition(new m.position.constructor()).applyMatrix4(inv);
    if (Math.hypot(p.x, p.z) > 4 || p.y < 0 || p.y > 3.5) ver++;
  });
  return { soort: a.auto.soort, kleur: a.auto.kleur, doeken, lampen, ver, verborgen: !m.visible, fase: a.fase, bemanning: a.bemanning.length };
});
ok(!model.geen && model.soort === 'van' && model.kleur === 0xe6dd18, 'een busje in ambulancegeel', `${model.soort}`);
ok(model.doeken >= 3 && model.lampen === 4, 'de doeken op beide flanken en achterop, vier blauwe lampen', `${model.doeken} doeken, ${model.lampen} lampen`);
ok(model.ver === 0, 'en die hangen op de wagen, niet ergens anders', `${model.ver} te ver weg`);
ok(model.verborgen && model.fase === 'vrij' && model.bemanning === 2, 'hij wacht buiten beeld, met twee man bemanning');

// ------------------------------------------------------------------ 2. de rit erheen
kop('de rit erheen');
const heen = await page.evaluate(() => {
  const g = window.__game, a = g.ambulance, W = window.__W, P = g.player;
  g.sfeer.uur = 13;
  // een voetganger die leeft, ergens midden in de wijk
  const p = g.npcs.people.find(q => q.alive && !q.slaapt && Math.hypot(q.x - 700, q.z + 100) < 400) || g.npcs.people.find(q => q.alive);
  window.__zet(p.x + 25, p.z + 25);
  g.npcs.hitPersoon(p, 1);
  window.__A.AMB.kans = 1;
  const komt = g.ambulanceMelding(p.x, p.z);
  const st = a.st, L = st.lijn;
  const begin = L ? { d: Math.hypot(L.x[0] - p.x, L.z[0] - p.z), dSp: Math.hypot(L.x[0] - P.pos.x, L.z[0] - P.pos.z) } : null;
  const vast = p.respawn;
  window.__sirene.length = 0;
  let maxV = 0, lampen = 0, n = 0, hoog = 0, t = 0;
  for (; t < 150 && a.fase === 'heen'; t += 0.1) {
    a.update(0.1, P.pos, () => false);
    maxV = Math.max(maxV, a.auto.speed); n++;
    if (a.lampenAan) lampen++;
    const gy = W.grondHoogte(a.auto.x, a.auto.z, a.auto.mesh.position.y + 1);
    hoog = Math.max(hoog, Math.abs(a.auto.mesh.position.y - gy));
  }
  window.__p = p;
  const eind = { d: Math.hypot(a.auto.x - p.x, a.auto.z - p.z) };
  return { komt, begin, vast, maxV, lampen: lampen / Math.max(1, n), sirene: window.__sirene.length, t, fase: a.fase, eind, hoog, nieuws: g.nieuws.rij.map(m => m.soort),
    lengte: L ? L.lengte : 0, top: window.__A.AMB.top };
});
ok(heen.komt && heen.begin && heen.begin.d > 250 && heen.begin.dSp > 170, 'hij komt, van ver weg en niet vlak bij jou', heen.begin && `${r1(heen.begin.d)} m van de patiënt, ${r1(heen.begin.dSp)} m van jou, rit ${r1(heen.lengte)} m`);
ok(heen.vast > 1000, 'de patiënt blijft liggen tot hij er is');
ok(heen.fase === 'uitstappen' && heen.t < 120, 'hij komt aan', `na ${r1(heen.t)} s, ${r1(heen.eind.d)} m van de patiënt`);
ok(heen.eind.d < 140, 'op de weg bij de patiënt');
ok(heen.lampen > 0.9 && heen.sirene > 50, 'met zwaailicht en sirene', `${(heen.lampen * 100).toFixed(0)} % van de tijd lampen, ${heen.sirene} keer sirene`);
ok(heen.maxV <= heen.top + 0.5 && heen.hoog < 0.3, 'niet harder dan zijn top, en op de grond', `${r1(heen.maxV)} m/s, ${r1(heen.hoog)} m`);
ok(heen.nieuws.includes('ambulance'), 'Radio Tinga krijgt het door', heen.nieuws.join(', '));

// ------------------------------------------------------------------ 3. helpen en weer weg
kop('helpen en weer weg');
const help = await page.evaluate(() => {
  const g = window.__game, a = g.ambulance, P = g.player, p = window.__p;
  let t = 0, minD = Infinity, hurkt = false;
  for (; t < 60 && a.fase !== 'helpt'; t += 0.1) a.update(0.1, P.pos, () => false);
  const tHelp = t;
  for (const b of a.bemanning) minD = Math.min(minD, Math.hypot(b.groep.position.x - p.x, b.groep.position.z - p.z));
  for (let i = 0; i < 20; i++) { a.update(0.1, P.pos, () => false); }
  hurkt = a.bemanning.every(b => b.groep.position.y < b.grond + 0.0 + 0.05 || b._h.knieL > 0.5);
  for (t = 0; t < 30 && a.fase === 'helpt'; t += 0.1) a.update(0.1, P.pos, () => false);
  const op = p.alive;
  // instappen en weg; zolang je kijkt blijft hij in beeld, daarna weg
  let lampenTerug = false;
  for (t = 0; t < 60 && a.fase !== 'terug'; t += 0.1) a.update(0.1, P.pos, () => true);
  for (let i = 0; i < 100; i++) { a.update(0.1, P.pos, () => true); if (a.lampenAan) lampenTerug = true; }
  const nogInBeeld = a.fase === 'terug' && a.auto.mesh.visible;
  for (t = 0; t < 120 && a.fase !== 'vrij'; t += 0.1) a.update(0.1, P.pos, () => false);
  const rust = a.st.rust;
  const meteen = g.ambulanceMelding(p.x, p.z);
  return { tHelp, minD, hurkt, op, gered: a.st.gereanimeerd, lampenTerug, nogInBeeld, vrij: a.fase, verborgen: !a.auto.mesh.visible, rust, meteen };
});
ok(help.tHelp < 50 && help.minD < 1.5, 'de bemanning stapt uit en loopt naar de patiënt', `${r1(help.tHelp)} s, ${r1(help.minD)} m`);
ok(help.hurkt, 'ze knielen bij hem');
ok(help.op && help.gered >= 1, 'en hij staat weer op');
ok(!help.lampenTerug && help.nogInBeeld, 'weg zonder zwaailicht, en niet weg voor je neus');
ok(help.vrij === 'vrij' && help.verborgen, 'uit beeld verdwijnt hij');
ok(help.rust > 60 && !help.meteen, 'daarna eerst een pauze: niet meteen weer een', `${r1(help.rust)} s`);

// ------------------------------------------------------------------ 4. 's nachts
kop("'s nachts");
const nacht = await page.evaluate(() => {
  const g = window.__game, a = g.ambulance, P = g.player;
  const meet = (uur) => {
    g.sfeer.uur = uur;
    a.st.rust = 0; a.verstop(); a.st.rust = 0;
    const p = g.npcs.people.find(q => q.alive && !q.slaapt);
    window.__zet(p.x + 25, p.z + 25);
    g.npcs.hitPersoon(p, 1);
    a.melding(p.x, p.z, null, P.pos, { zeker: true });
    let maxE = 0, maxG = 0;
    for (let i = 0; i < 40; i++) {
      a.update(0.1, P.pos, () => false);
      a.auto.mesh.traverse(o => { if (o.isMesh && o.material && o.material.emissive && o.material.emissiveIntensity) maxE = Math.max(maxE, o.material.emissiveIntensity); if (o.userData && o.userData.gloed) maxG = Math.max(maxG, o.userData.gloed.opacity); });
    }
    p.alive = true; p.respawn = 0;
    a.verstop(); a.st.rust = 0;
    return { maxE, maxG, nacht: g.sfeer.nacht };
  };
  return { dag: meet(13), nacht: meet(1) };
});
ok(nacht.nacht.nacht && nacht.nacht.maxE > nacht.dag.maxE && nacht.nacht.maxG > 0.9, "'s nachts feller, met gloed", `lamp ${r1(nacht.dag.maxE)} → ${r1(nacht.nacht.maxE)}, gloed ${nacht.dag.maxG.toFixed(2)} → ${nacht.nacht.maxG.toFixed(2)}`);

// ------------------------------------------------------------------ 5. niet altijd
kop('niet altijd');
const kans = await page.evaluate(() => {
  const g = window.__game, a = g.ambulance, P = g.player, A = window.__A;
  A.AMB.kans = 0.4;
  g.sfeer.uur = 13;
  let ja = 0;
  const p = g.npcs.people.find(q => q.alive && !q.slaapt);
  for (let i = 0; i < 200; i++) {
    a.verstop(); a.st.rust = 0;
    p.alive = false; p.respawn = 20;
    if (a.melding(p.x, p.z, null, P.pos)) ja++;
  }
  a.verstop(); a.st.rust = 0; p.alive = true; p.respawn = 0;
  return { ja, kans: A.AMB.kans };
});
ok(kans.ja > 200 * kans.kans * 0.6 && kans.ja < 200 * kans.kans * 1.4, 'van tweehonderd keer komt hij ongeveer zo vaak als de kans zegt', `${kans.ja} keer (kans ${kans.kans})`);

// ------------------------------------------------------------------ 6. een speler bij VV Sneek
kop('een speler bij VV Sneek');
const wed = await page.evaluate(() => {
  const g = window.__game, a = g.ambulance, w = g.wedstrijd, V = w.veld, P = g.player, A = window.__A;
  A.AMB.kans = 1;
  a.verstop(); a.st.rust = 0;
  g.sfeer.uur = 13; w.weg(); w.st.dag = -1;
  P.pos.set(V.cx + 600, 0, V.cz + 600); P.yaw = Math.atan2(-600, -600); P.applyCamera(); g.camera.updateMatrixWorld();
  g.werkWedstrijdBij(0.1);
  P.pos.set(V.cx - 80, 0, V.cz - 80); P.yaw = Math.atan2(-(V.cx - P.pos.x), -(V.cz - P.pos.z)); P.applyCamera(); g.camera.updateMatrixWorld();
  for (let i = 0; i < 20; i++) g.werkWedstrijdBij(0.1);
  const s = w.spelers.find(q => !q.keeper && !q.neer);
  const q = s.p.groep.position;
  g.aanrijden(q.x, q.z, 1.5, 12);
  const komt = a.fase === 'heen';
  let t = 0;
  for (; t < 220 && !(a.fase === 'instappen' || a.fase === 'terug'); t += 0.1) { a.update(0.1, P.pos, () => false); g.werkWedstrijdBij(0.1); }
  return { komt, op: !s.neer, t, gestaakt: w.gestaakt, slacht: w.slachtoffers.length, nieuws: g.nieuws.rij.map(m => m.soort) };
});
ok(wed.komt, 'een speler aangereden: de ambulance komt', wed.nieuws.join(', '));
ok(wed.op && wed.slacht === 0, 'en hij staat weer op', `na ${r1(wed.t)} s`);

// ------------------------------------------------------------------ 7. stukgeschoten
kop('stukgeschoten');
const stuk = await page.evaluate(() => {
  const g = window.__game, a = g.ambulance, P = g.player;
  a.verstop(); a.st.rust = 0;
  const p = g.npcs.people.find(q => q.alive && !q.slaapt);
  window.__zet(p.x + 25, p.z + 25);
  g.npcs.hitPersoon(p, 1);
  a.melding(p.x, p.z, null, P.pos, { zeker: true });
  for (let i = 0; i < 10; i++) a.update(0.1, P.pos, () => false);
  a.auto.wrak = true; a.auto.hp = 0;
  for (let i = 0; i < 5; i++) a.update(0.1, P.pos, () => false);
  const fase = a.fase, rust = a.st.rust, vrij = p.respawn < 100;
  a.auto.wrak = false; a.auto.hp = 100; a.verstop(); a.st.rust = 0;
  p.alive = true; p.respawn = 0;
  return { fase, rust, vrij };
});
ok(stuk.fase === 'vrij' && stuk.rust > 0 && stuk.vrij, 'stukgeschoten: de rit stopt, en de patiënt staat later gewoon weer op');

// ------------------------------------------------------------------ 8. het nieuws
kop('het nieuws op Radio Tinga');
const nws = await page.evaluate(() => {
  const g = window.__game, N = window.__N;
  const n = N.maakNieuws({ hud: { show: (t, d) => { window.__toon = t; } }, geluid: { nieuwsJingle: () => { window.__jingle = (window.__jingle || 0) + 1; } },
    straatVan: (x, z) => window.__W.nearestRoadName(x, z) });
  const p = g.npcs.people.find(q => q.alive);
  const eerste = n.meld('schietpartij', p.x, p.z);
  const nogEens = n.meld('schietpartij', p.x, p.z);
  // 30 s niet luisteren: niets
  for (let i = 0; i < 300; i++) n.update(0.1, false);
  const nietGehoord = n.gehoord.length;
  n.update(0.1, true);
  const bericht = n.laatsteBericht;
  const demp = n.demp;
  for (let i = 0; i < 80; i++) n.update(0.1, false);
  const dempNa = n.demp;
  // oud nieuws vervalt
  n.meld('aanrijding', p.x, p.z);
  for (let i = 0; i < 3200; i++) n.update(0.1, false);
  const vervallen = n.rij.length;
  // een echte schietpartij via js/main.js
  const voor = g.nieuws.rij.length;
  const v = g.npcs.people.find(q => q.alive && !q.slaapt);
  const P = g.player;
  window.__zet(v.x + 6, v.z + 2);
  const oog = { x: P.pos.x, y: P.pos.y + P.eye, z: P.pos.z };
  const dx = v.x - oog.x, dz = v.z - oog.z;
  P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(1.1 - oog.y, Math.hypot(dx, dz));
  P.applyCamera(); P.vuurKlok = 0; P.ammo = 5; P.reloading = 0; P.kickPitch = 0; P.kickYaw = 0; P.mik = 0;
  g.npcs.update(0.016, 0, P.pos.x, P.pos.z);
  g.scene.updateMatrixWorld(true);
  for (let k = 0; k < 2; k++) { P.vuurKlok = 0; P.shoot(); }
  return { eerste, nogEens, nietGehoord, bericht, demp, dempNa, vervallen, jingle: window.__jingle || 0, toon: window.__toon || '',
    echt: g.nieuws.rij.slice(voor).map(m => m.soort), straat: window.__W.nearestRoadName(p.x, p.z), dood: !v.alive };
});
ok(nws.eerste && !nws.nogEens, 'dezelfde soort niet twee keer kort na elkaar');
ok(nws.nietGehoord === 0, 'wie niet luistert, hoort niets');
ok(nws.bericht && nws.jingle === 1 && /Radio Tinga/.test(nws.toon), 'wie luistert: een jingle en het bericht in beeld', nws.bericht && nws.bericht.tekst);
ok(nws.bericht && (!nws.straat || nws.bericht.tekst.includes(nws.straat)), 'met de straat erin', nws.straat || '(geen straat)');
ok(nws.demp < 1 && nws.dempNa === 1, 'de muziek even zachter, en daarna weer gewoon', `${nws.demp} → ${nws.dempNa}`);
ok(nws.vervallen === 0, 'oud nieuws vervalt');
ok(nws.dood && nws.echt.includes('schietpartij'), 'een echte schietpartij via js/main.js komt in de rij', `${nws.echt.join(', ')} (geraakt: ${nws.dood})`);

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);

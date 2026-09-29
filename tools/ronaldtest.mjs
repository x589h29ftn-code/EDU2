/*
 Missie 17, Wie is R. (stap 103).

   node tools/server.mjs 8123 &   node tools/ronaldtest.mjs [poort]   (npm run ronaldtest)

 1. Na missie 16 staat hij klaar, en voor Molenkrite 15 hangt lint.
 2. Mark belt; de M bij de Wieken 29; binnen het plan, Mark op de bank en Johan erbij.
 3. De worst uit de koelkast; naar buiten, "Die nacht…" om één uur.
 4. Het erf, gemeten: de caravan vrij van het huis en het water, de kraakplek nooit in de kegel en
    buiten het bereik van de hond, de weg van de Golf naar de deur wel door de kegel, de Golf op de
    weg, en de route van Ronald van de Lemmerweg de oprit op zonder sprong.
 5. Sluipen: in de kegel loopt de argwaan snel op en gaat het alarm; bij de hond langzaam; met de
    worst is hij stil; kraken met onderbreken.
 6. Stil gebleven: het filmbeeld van de koplampen, Ronald met zijn geweer, het gesprek (niet schieten),
    de Golf, de Wieken, € 2.500, het filmbeeld aan het water en de ochtend.
 7. Gezien: de kluis met het schrift (na de ruil), twee auto's en vier man, Ronald rent weg en leeft,
    sterren na een schot, niet thuis met sterren, € 1.500.
 8. Opnieuw na het neergaan op het erf (met de worst), en de opslag.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
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
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const V = await import('/js/viaduct.js');
  const { KAART } = await import('/js/kaartwereld.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  g.sfeer.uur = 10;
  window.__W = W; window.__V = V; window.__K = KAART;
  window.__meld = [];
  const echt = g.hud.melding.bind(g.hud);
  g.hud.melding = (k, o, t) => { window.__meld.push(`${k}|${o}`); return echt(k, o, t); };
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__klik = (max = 80) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__tot = (fase, maxS = 20, dt = 0.05) => {
    for (let t = 0; t < maxS && v.fase !== fase; t += dt) { g.player.health = 100; v.update(dt); if (!document.getElementById('dialoog').hidden) v.toets(); }
    return v.fase === fase;
  };
  window.__zet = (x, z, y = 0) => { if (g.player.inCar) { g.player.inCar.speed = 0; g.player.inCar = null; } g.player.pos.set(x, y, z); g.player.applyCamera(); };
  window.__zetAuto = (a, x, z, yaw) => {
    a.x = x; a.z = z; a.yaw = yaw; a.rij = yaw; a.speed = 0;
    if (a.mesh) { a.mesh.position.set(x, a.mesh.position.y, z); a.mesh.rotation.y = yaw; }
  };
  window.__na16 = (extra = {}) => {
    const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
    Object.assign(s, { schaduwKlaar: true, raceKlaar: true, brugKlaar: true, schriftKlaar: true, invalKlaar: true, invalKeus: 2,
      invalTelefoon: true, schriftKwijt: false, ronaldKlaar: false, huisGekozen: s.huisGekozen || 'Koningsspil 20' }, extra);
    g.politie.reset();
    v.herstel(s);
  };
  window.__opFase = (fase, extra = {}) => {
    const s = v.bewaar(); s.missie = 'ronald'; s.fase = fase;
    Object.assign(s, { invalKlaar: true, ronaldKlaar: false, ronaldPraatte: false, ronaldWeg: false, ronaldSchrift: false, erfHeeftWorst: false }, extra);
    g.politie.reset();
    v.herstel(s);
  };
});

// ------------------------------------------------------------------ 1. na missie 16
kop('na missie 16');
const na16 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__na16();
  window.__stap(30);
  return { volgende: v.volgendeMissie, lint: v.ronald.lint.zichtbaar };
});
ok(na16.volgende && na16.volgende.naam === 'ronald', 'na De inval staat Wie is R. klaar', JSON.stringify(na16.volgende));
ok(na16.lint, 'voor de deur van Molenkrite 15 hangt politielint');

// ------------------------------------------------------------------ 2. het telefoontje en het plan
kop('het telefoontje en het plan');
const plan = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, w = g.woningen[1];
  v.startMissie('ronald');
  window.__stap(40);
  const naam = document.getElementById('dialoogNaam').textContent;
  const tel = !document.getElementById('dialoog').hidden;
  window.__klik();
  const fase1 = v.fase, nav = g.hud.nav && g.hud.nav.letter;
  // naar binnen bij de Wieken
  const d = w.plekken.deurBinnen;
  window.__zet(d.x, d.z);
  window.__stap(4);
  const fase2 = v.fase, markZit = v.mark.groep.visible, johan = v.ronald.johan.groep.visible;
  const namen = new Set();
  for (let i = 0; i < 60 && !document.getElementById('dialoog').hidden; i++) { namen.add(document.getElementById('dialoogNaam').textContent); v.toets(); window.__stap(1); }
  return { naam, tel, fase1, nav, fase2, markZit, johan, namen: [...namen], fase3: v.fase };
});
ok(plan.tel && plan.naam === 'Mark', 'Mark belt', plan.naam);
ok(plan.fase1 === 'naarWieken' && plan.nav === 'M', 'een M bij de Wieken 29', `${plan.fase1}, ${plan.nav}`);
ok(plan.fase2 === 'plan' && plan.markZit && plan.johan, 'binnen: Mark op de bank, Johan erbij', plan.fase2);
ok(plan.namen.includes('Mark') && plan.namen.includes('Johan') && plan.fase3 === 'klaarmaken', 'het plan, en dan klaarmaken', plan.fase3);

// ------------------------------------------------------------------ 3. de worst, en die nacht
kop('de worst, en die nacht');
const nacht = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, w = g.woningen[1];
  const k = w.plekken.koelkast;
  window.__zet(k.x, k.z);
  window.__stap(2);
  const hint = document.getElementById('praat').hidden ? '' : document.getElementById('praat').textContent;
  const aanspreekbaar = v.aanspreekbaar;
  v.toets(); window.__stap(2); window.__klik();
  const worst = v.ronald.worst;
  // naar buiten
  const b = w.plekken.deurBuiten;
  window.__zet(b.x, b.z);
  window.__stap(2);
  const faseNacht = v.fase;
  window.__stap(Math.ceil(6 / 0.05)); window.__klik();
  const R = v.ronald;
  return { hint, aanspreekbaar, worst, faseNacht, fase: v.fase, uur: g.sfeer.uur, erf: R.erf.zichtbaar,
    golf: !!R.golf, dGolf: R.golf ? Math.hypot(g.player.pos.x - R.golf.x, g.player.pos.z - R.golf.z) : null,
    balk: !document.getElementById('schaduwbalk').hidden };
});
ok(/worst/.test(nacht.hint) && nacht.aanspreekbaar, 'bij de koelkast: E — een worst', nacht.hint);
ok(nacht.worst, 'de worst in je zak');
ok(nacht.faseNacht === 'nacht', 'naar buiten: "Die nacht…"', nacht.faseNacht);
ok(nacht.fase === 'sluipen' && Math.abs(nacht.uur - 1) < 0.05 && nacht.erf, 'één uur, op het erf van Ronald', `${nacht.fase}, ${nacht.uur} uur`);
ok(nacht.golf && nacht.dGolf < 4 && nacht.balk, 'naast de Golf van Mark, en de balk van de argwaan', `${nacht.dGolf && nacht.dGolf.toFixed(1)} m`);

// ------------------------------------------------------------------ 4. het erf, gemeten
kop('het erf, gemeten');
const maat = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal, R = v.ronald, E = R.erf, ERF = R.ERF, K = window.__K;
  const W = window.__W, V = window.__V;
  const pand = K.panden.find(p => p.straat === 'Lemmerweg' && (p.nr || []).includes('80'));
  // punt-in-veelhoek
  const binnen = (x, z, r) => { let b = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, zi] = r[i], [xj, zj] = r[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) b = !b; } return b; };
  const dSeg = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2)); return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t); };
  const C = E.caravan;
  const hoeken = [];
  for (const [a, b] of [[-1, -1], [-1, 1], [1, 1], [1, -1]]) hoeken.push(E.p(ERF.caravan.v + a * C.lang / 2, ERF.caravan.s + b * C.breed / 2));
  const midden = E.p(ERF.caravan.v, ERF.caravan.s);
  // afstand van de caravan tot het huis
  let huisD = Infinity;
  for (const h of [...hoeken, midden]) for (let i = 0; i < pand.voet.length; i++) huisD = Math.min(huisD, dSeg(h.x, h.z, pand.voet[i], pand.voet[(i + 1) % pand.voet.length]));
  const inHuis = [...hoeken, midden].some(h => binnen(h.x, h.z, pand.voet));
  // water: geen hoek van de caravan, de kraakplek, het hok of de hond in een watervlak
  const water = (K.vlakken || []).filter(q => /water/i.test(q.k || '') && Array.isArray(q.r));
  const natte = (p) => water.some(q => { const r = Array.isArray(q.r[0][0]) ? q.r[0] : q.r; return binnen(p.x, p.z, r); });
  const plekken = { caravan: [...hoeken, midden], deur: [E.deur], hok: [E.hok], hond: [E.anker], golf: [R.golf] };
  const nat = Object.entries(plekken).filter(([, ps]) => ps.some(natte)).map(([k]) => k);
  // de kraakplek nooit in de kegel, over een hele zwaai
  let deurInKegel = 0;
  for (let t = 0; t < ERF.camera.periode; t += 0.05) if (E.kegelRaakt(E.deur.x, E.deur.z, E.hoekOp(t))) deurInKegel++;
  /*
   Van de Golf recht naar de deur lopen (4 m/s), vertrekkend op elk moment van een zwaai: wie het
   goede moment afwacht komt er ongezien door, wie zomaar gaat loopt erin. Gemeten zoals je het
   speelt: de kegel draait mee terwijl je loopt.
  */
  // de weg zoals je hem loopt: over de weg naar de oprit, de oprit op, en langs het huis naar de deur
  const sp = { x: g.player.pos.x, z: g.player.pos.z };
  const weg = [sp, R.straat.straat, E.p(11, -5), E.deur];
  const lengtes = weg.slice(1).map((q, i) => Math.hypot(q.x - weg[i].x, q.z - weg[i].z));
  const lang = lengtes.reduce((a, b) => a + b, 0);
  const opWeg = (m) => { for (let i = 0; i < lengtes.length; i++) { if (m <= lengtes[i] || i === lengtes.length - 1) { const f = Math.min(1, m / (lengtes[i] || 1)); return { x: weg[i].x + (weg[i + 1].x - weg[i].x) * f, z: weg[i].z + (weg[i + 1].z - weg[i].z) * f }; } m -= lengtes[i]; } return weg[weg.length - 1]; };
  let raakMoment = 0, vrijMoment = 0;
  for (let t0 = 0; t0 < ERF.camera.periode; t0 += 0.25) {
    let geraakt = 0;
    for (let tau = 0; tau * 4 <= lang; tau += 0.05) {
      const q = opWeg(tau * 4);
      if (E.kegelRaakt(q.x, q.z, E.hoekOp(t0 + tau))) geraakt += 0.05;
    }
    // (een tel of minder in de kegel is nog geen alarm: 0,55 per seconde)
    if (geraakt > 0.3) raakMoment++; else vrijMoment++;
  }
  const hondDeur = Math.hypot(E.deur.x - E.anker.x, E.deur.z - E.anker.z);
  // de kraakplek is te bereiken (niet in een botsdoos) en de caravan houdt je tegen
  const [rx, rz] = W.resolveCollisions(E.deur.x, E.deur.z, 0.4);
  const [cx, cz] = W.resolveCollisions(midden.x, midden.z, 0.4);
  // de Golf op een rijbaan
  let golfWeg = Infinity;
  for (const as of K.wegassen || []) if (as.drive) for (let i = 1; i < as.pts.length; i++) golfWeg = Math.min(golfWeg, dSeg(R.golf.x, R.golf.z, as.pts[i - 1], as.pts[i]) - (as.w || 4) / 2);
  // de route van Ronald
  const route = R.route();
  let sprong = 0, yv = null;
  for (let s = 0; s <= route.lengte; s += 1) {
    let rest = s, x = route.pts[0][0], z = route.pts[0][1];
    for (let i = 1; i < route.pts.length; i++) { const a = route.pts[i - 1], b = route.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (rest <= L) { x = a[0] + (b[0] - a[0]) * rest / (L || 1); z = a[1] + (b[1] - a[1]) * rest / (L || 1); break; } rest -= L; x = b[0]; z = b[1]; }
    const y = V.grondHoogte(x, z, yv == null ? 0 : yv + 0.9);
    if (yv != null) sprong = Math.max(sprong, Math.abs(y - yv)); yv = y;
  }
  let knik = 0;
  for (let i = 2; i < route.pts.length; i++) {
    const a1 = Math.atan2(route.pts[i - 1][1] - route.pts[i - 2][1], route.pts[i - 1][0] - route.pts[i - 2][0]);
    const a2 = Math.atan2(route.pts[i][1] - route.pts[i - 1][1], route.pts[i][0] - route.pts[i - 1][0]);
    let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d;
    knik = Math.max(knik, d);
  }
  const eind = route.pts[route.pts.length - 1], begin = route.pts[0];
  const eindOprit = Math.hypot(eind[0] - E.p(11.4, -4.9).x, eind[1] - E.p(11.4, -4.9).z);
  const beginD = Math.hypot(begin[0] - eind[0], begin[1] - eind[1]);
  // de kegel ligt óp de grond, niet eronder: een straal recht naar beneden op een paar plekken in de kegel
  const THREE = await import('/lib/three.module.js');
  const ray = new THREE.Raycaster();
  const kegelMesh = E.groep.children.find(o => o.isMesh && o.material && o.material.transparent && o.geometry && o.geometry.index && o.geometry.index.count > 20);
  let grondMax = -Infinity;
  const c0 = E.assen.lokaal(E.camera.x, E.camera.z);
  for (const [dv, ds] of [[4, -2], [7, -3], [9, -5]]) {
    const q = E.p(c0.v + dv, c0.s + ds);
    ray.set(new THREE.Vector3(q.x, 6, q.z), new THREE.Vector3(0, -1, 0));
    const hits = ray.intersectObjects(g.scene.children, true).filter(h => h.object !== kegelMesh && !(h.object.material && h.object.material.transparent) && h.object.visible !== false);
    if (hits.length) grondMax = Math.max(grondMax, hits[0].point.y);
  }
  const kegelY = kegelMesh ? kegelMesh.position.y : null;
  return { kegelY, grondMax, huisD, inHuis, nat, deurInKegel, raakMoment, vrijMoment, hondDeur, blaf: ERF.hond.blaf,
    deurVrij: Math.hypot(rx - E.deur.x, rz - E.deur.z), caravanDuwt: Math.hypot(cx - midden.x, cz - midden.z),
    golfWeg, lengte: route.lengte, sprong, knik, eindOprit, beginD, straat: R.straat && R.straat.naam, lem: R.straat && R.straat.lemmerweg };
});
ok(!maat.inHuis && maat.huisD > 2, 'de caravan staat vrij van het huis', `${maat.huisD.toFixed(1)} m`);
ok(maat.nat.length === 0, 'niets van het erf staat in het water', maat.nat.join(', ') || 'droog');
ok(maat.kegelY != null && maat.kegelY > maat.grondMax + 0.03, 'de gele kegel ligt boven de grond (en is dus te zien)', `kegel ${maat.kegelY && maat.kegelY.toFixed(2)} m, grond ${maat.grondMax.toFixed(2)} m`);
ok(maat.deurInKegel === 0, 'de kraakplek komt nooit in de kegel van de camera', `${maat.deurInKegel} momenten`);
ok(maat.raakMoment >= 4 && maat.vrijMoment >= 4, 'van de Golf naar de deur lopen: op het goede moment ongezien, anders erin', `${maat.raakMoment} keer erin, ${maat.vrijMoment} keer vrij`);
ok(maat.hondDeur > maat.blaf + 1, 'de kraakplek ligt buiten het bereik van de hond', `${maat.hondDeur.toFixed(1)} m`);
ok(maat.deurVrij < 0.05 && maat.caravanDuwt > 0.5, 'bij de deur kun je staan, door de caravan niet', `${maat.deurVrij.toFixed(2)} / ${maat.caravanDuwt.toFixed(2)} m`);
ok(maat.golfWeg < 0.5, 'de Golf staat op de weg', `${maat.golfWeg.toFixed(2)} m buiten de rijbaan`);
ok(maat.lengte > 60 && maat.lengte < 160 && maat.beginD > 50 && maat.eindOprit < 1 && maat.sprong < 0.3, 'Ronald komt van de Lemmerweg de oprit op, zonder sprong',
  `${maat.lengte.toFixed(0)} m, eind ${maat.eindOprit.toFixed(2)} m van de oprit, sprong ${maat.sprong.toFixed(2)}`);
ok(maat.knik < 0.35, 'en zonder knik: hooguit 20 graden per meter', `${(maat.knik * 180 / Math.PI).toFixed(1)}°`);

// ------------------------------------------------------------------ 5. sluipen
kop('sluipen');
const sluip = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const uit = {};
  // (a) in de kegel: meelopen met de kegel, op zes meter van de camera
  let R = v.ronald, E = R.erf;
  const inKegelPunt = () => { const a = E.hoek, c = E.assen.lokaal(E.camera.x, E.camera.z); return E.p(c.v + Math.sin(a) * 6, c.s - Math.cos(a) * 6); };
  let t = 0;
  for (; t < 4 && !v.ronald.alarm; t += 0.05) { const q = inKegelPunt(); window.__zet(q.x, q.z); window.__stap(1); }
  uit.kegelT = t; uit.alarm = v.ronald.alarm; uit.balkTekst = document.querySelector('#schaduwbalk .tekst').textContent;
  // (b) opnieuw, en bij de hond (buiten de kegel): langzaam
  window.__opFase('sluipen', { erfHeeftWorst: true });
  window.__stap(2); window.__klik();
  R = v.ronald; E = R.erf;
  const bijHond = E.p(R.ERF.hond.v, R.ERF.hond.s - 5.2);
  window.__zet(bijHond.x, bijHond.z);
  window.__stap(Math.ceil(3 / 0.05));
  uit.hondArg = v.ronald.argwaan; uit.hondKegel = E.kegelRaakt(bijHond.x, bijHond.z);
  // (c) de worst: van negen meter gooien, en dan is hij stil
  const gooi = E.p(R.ERF.hond.v, R.ERF.hond.s - 9);
  window.__zet(gooi.x, gooi.z);
  window.__stap(2);
  uit.gooiHint = document.getElementById('praat').hidden ? '' : document.getElementById('praat').textContent;
  v.toets(); window.__stap(1); window.__klik();
  window.__stap(Math.ceil(5 / 0.05));
  uit.stil = v.ronald.erf.stil;
  const a0 = v.ronald.argwaan;
  window.__zet(E.anker.x + 1.5, E.anker.z + 0.5);
  window.__stap(Math.ceil(3 / 0.05));
  uit.naWorst = v.ronald.argwaan - a0;
  // (d) kraken, met onderbreken
  window.__zet(E.deur.x, E.deur.z);
  window.__stap(2);
  uit.kraakHint = document.getElementById('praat').hidden ? '' : document.getElementById('praat').textContent;
  v.toets(); window.__stap(1); window.__klik();
  window.__stap(Math.ceil(3 / 0.05));
  window.__zet(E.deur.x + 3, E.deur.z + 1.5);
  window.__stap(4);
  uit.onderbroken = v.fase; uit.kraak = v.ronald.kraak;
  window.__zet(E.deur.x, E.deur.z);
  window.__stap(2); v.toets(); window.__stap(1);
  window.__stap(Math.ceil(4.6 / 0.05));
  uit.fase = v.fase; uit.buit = v.ronald.buit; uit.argwaan = v.ronald.argwaan; uit.alarm2 = v.ronald.alarm;
  return uit;
});
ok(sluip.alarm && sluip.kegelT < 2.5, 'in de kegel: binnen twee tellen gezien', `${sluip.kegelT.toFixed(2)} s, "${sluip.balkTekst}"`);
ok(!sluip.hondKegel && sluip.hondArg > 0.1 && sluip.hondArg < 0.6, 'bij de hond loopt de argwaan langzaam op', sluip.hondArg.toFixed(2));
ok(/worst/.test(sluip.gooiHint) && sluip.stil, 'de worst van negen meter: de hond eet, en is stil', sluip.gooiHint);
ok(sluip.naWorst <= 0.001, 'daarna blaft hij niet meer, ook niet vlak bij hem', sluip.naWorst.toFixed(3));
ok(/kluis/.test(sluip.kraakHint), 'bij de deur: E — de kluis kraken', sluip.kraakHint);
ok(sluip.onderbroken === 'sluipen' && sluip.kraak > 2.5 && sluip.kraak < 4, 'weglopen onderbreekt het kraken, zonder het kwijt te raken', `${sluip.onderbroken}, ${sluip.kraak.toFixed(1)} s`);
ok(sluip.fase === 'buit' && sluip.buit && !sluip.alarm2, 'de kluis open, en niemand heeft iets gezien', `${sluip.fase}, argwaan ${sluip.argwaan.toFixed(2)}`);

// ------------------------------------------------------------------ 6. stil gebleven
kop('stil gebleven: Ronald praat');
const stil = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const uit = {};
  const lijnen = new Set();
  for (let i = 0; i < 20 && !document.getElementById('dialoog').hidden; i++) { lijnen.add(document.getElementById('dialoogTekst').textContent); v.toets(); window.__stap(1); }
  uit.sleutel = [...lijnen].some(t => /container 3/.test(t));
  uit.film = v.ronald.film; uit.balken = document.body.classList.contains('film');
  const a = v.ronald.auto;
  const d0 = a ? Math.hypot(a.x - v.ronald.erf.deur.x, a.z - v.ronald.erf.deur.z) : null;
  let uitgestapt = false, geweer = false;
  for (let i = 0; i < 600 && v.ronald.film === 'koplampen'; i++) {
    window.__stap(1);
    const p = v.ronald.persoon;
    if (p.groep.visible) { uitgestapt = true; geweer = !!(p.wapen && p.wapen.visible); }
  }
  const d1 = a ? Math.hypot(a.x - v.ronald.erf.deur.x, a.z - v.ronald.erf.deur.z) : null;
  uit.d0 = d0; uit.d1 = d1; uit.uitgestapt = uitgestapt; uit.geweer = geweer; uit.fase = v.fase;
  // tijdens het gesprek kun je niet schieten, en Ronald is geen doelwit
  uit.slot = !!g.player.vuurSlot;
  const doelen = (g.verhaal.doelen ? g.verhaal.doelen() : []) || [];
  const vanRonald = (o) => { for (let q = o; q; q = q.parent) if (q === v.ronald.persoon.groep) return true; return false; };
  uit.doelwit = doelen.some(d => vanRonald(d && (d.obj || d.mesh || d.groep || d)));
  const namen = new Set();
  for (let i = 0; i < 40 && !document.getElementById('dialoog').hidden; i++) { namen.add(document.getElementById('dialoogNaam').textContent); v.toets(); window.__stap(1); }
  uit.namen = [...namen]; uit.praatte = v.ronald.praatte; uit.faseNa = v.fase;
  window.__stap(Math.ceil(8 / 0.05));
  uit.ronaldBinnen = !v.ronald.persoon.groep.visible;
  // in de Golf, naar de Wieken
  const golf = v.ronald.golf;
  g.player.inCar = golf; window.__stap(2); window.__klik();
  uit.terug = v.fase; uit.nav = g.hud.nav && g.hud.nav.letter;
  const d = v.ronald.erf && g.woningen[1].plekken.stoep;
  const deur = g.woningen[1].plekken.deurBuiten;
  window.__zetAuto(golf, deur.x + 4, deur.z + 4, golf.yaw);
  const geld0 = v.geld;
  window.__stap(4);
  uit.afronding = v.fase;
  window.__klik();
  uit.verdiend = v.geld - geld0; uit.klaar = v.ronald.klaar;
  // vijf tellen, dan het water
  window.__stap(Math.ceil(9 / 0.05));
  uit.loods = v.ronald.film;
  const c = v.ronald.filmCam;
  uit.camBijLoods = c ? Math.hypot(c.pos[0] - 1406, c.pos[2] + 190) : null;
  uit.bouwman = v.inval.bouwman.groep.visible;
  const loodsLijnen = new Set();
  for (let i = 0; i < 260 && v.ronald.film === 'loods'; i++) { window.__stap(1); if (!document.getElementById('dialoog').hidden) loodsLijnen.add(document.getElementById('dialoogTekst').textContent); }
  uit.neemtNietOp = [...loodsLijnen].some(t => /neemt niet op/.test(t));
  window.__stap(Math.ceil(7 / 0.05));
  uit.uur = g.sfeer.uur;
  return uit;
});
ok(stil.sleutel && stil.film === 'koplampen' && stil.balken, 'de sleutel van container 3, dan het filmbeeld: koplampen', String(stil.film));
ok(stil.d0 > 40 && stil.d1 < 9, 'Ronald rijdt de oprit op', `${stil.d0 && stil.d0.toFixed(0)} → ${stil.d1 && stil.d1.toFixed(1)} m`);
ok(stil.uitgestapt && stil.geweer, 'hij stapt uit, met zijn jachtgeweer');
ok(stil.fase === 'praten' && !stil.doelwit && stil.slot, 'hij praat; hij is geen doelwit en je kunt niet schieten');
ok(stil.namen.includes('Ronald') && stil.praatte && stil.faseNa === 'naarGolf', 'het gesprek, en dan naar de Golf', stil.faseNa);
ok(stil.ronaldBinnen, 'Ronald gaat zijn huis in (hij leeft)');
ok(stil.terug === 'terug' && stil.nav === 'M', 'in de Golf: naar de Wieken', stil.terug);
ok(stil.afronding === 'afronding' && stil.verdiend === 2500 && stil.klaar, 'MISSIE GESLAAGD: € 2.500', `${stil.afronding}, + € ${stil.verdiend}`);
ok(stil.loods === 'loods' && stil.camBijLoods != null && stil.camBijLoods < 40 && stil.bouwman, 'het filmbeeld aan het water, met Bouwman', `${stil.camBijLoods && stil.camBijLoods.toFixed(0)} m`);
ok(stil.neemtNietOp, '"Hij neemt niet op."');
ok(Math.abs(stil.uur - 9.5) < 0.2, 'en de volgende ochtend', `${stil.uur.toFixed(2)} uur`);

// ------------------------------------------------------------------ 7. gezien
kop('gezien: de mannen van Bouwman');
const alarm = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const uit = {};
  window.__opFase('sluipen', { schriftKwijt: true, invalKeus: 1 });
  window.__stap(2); window.__klik();
  let E = v.ronald.erf;
  // een schot op het erf: alarm
  v.schotGehoord(E.deur.x, E.deur.z);
  window.__stap(2); window.__klik();
  uit.alarm = v.ronald.alarm;
  window.__zet(E.deur.x, E.deur.z);
  window.__stap(2); v.toets(); window.__stap(1); window.__klik();
  window.__stap(Math.ceil(7.5 / 0.05));
  uit.buit = v.fase;
  const lijnen = new Set();
  for (let i = 0; i < 20 && !document.getElementById('dialoog').hidden; i++) { lijnen.add(document.getElementById('dialoogTekst').textContent); v.toets(); window.__stap(1); }
  uit.schrift = v.ronald.schrift && !v.inval.schriftKwijt && [...lijnen].some(t => /schrift van De Veteraan/.test(t));
  for (let i = 0; i < 600 && v.ronald.film === 'koplampen'; i++) window.__stap(1);
  uit.wagens = v.ronald.wagens.length;
  uit.mannen = v.ronald.mannen ? v.ronald.mannen.aantal : 0;
  uit.fase = v.fase;
  window.__klik();
  uit.ronaldWeg = v.ronald.weg;
  const p0 = { x: v.ronald.persoon.groep.position.x, z: v.ronald.persoon.groep.position.z };
  window.__stap(Math.ceil(3 / 0.05));
  const p1 = v.ronald.persoon.groep.position;
  uit.rent = Math.hypot(p1.x - p0.x, p1.z - p0.z);
  uit.mannenAlarm = !!(v.ronald.mannen && v.ronald.mannen.alarm);
  // een schot in het gevecht: twee sterren
  v.schotGehoord(E.deur.x, E.deur.z);
  window.__stap(2);
  uit.sterren = g.politie.ster;
  // alle vier neer
  const M = v.ronald.mannen;
  for (const w of M.wachters) { M.raak(w.persoon.groep); window.__stap(1); }
  window.__stap(Math.ceil(20 / 0.05)); window.__klik();
  uit.ronaldLeeft = !v.ronald.persoon.groep.visible;       // weggerend, niet neergeschoten: hij is uit beeld
  uit.naGevecht = v.fase;
  const golf = v.ronald.golf;
  g.player.inCar = golf; window.__stap(2); window.__klik();
  const deur = g.woningen[1].plekken.deurBuiten;
  window.__zetAuto(golf, deur.x + 4, deur.z + 4, golf.yaw);
  window.__stap(4);
  uit.metSterren = v.fase;
  g.politie.reset();
  const geld0 = v.geld;
  window.__stap(4); window.__klik();
  uit.verdiend = v.geld - geld0; uit.klaar = v.ronald.klaar;
  window.__stap(Math.ceil(25 / 0.05)); window.__klik();
  return uit;
});
ok(alarm.alarm, 'een schot op het erf: het alarm gaat');
ok(alarm.buit === 'buit' && alarm.schrift, 'na de ruil lag het schrift van De Veteraan in de kluis');
ok(alarm.wagens === 2 && alarm.mannen === 4, 'twee auto\'s achter Ronald aan, vier man', `${alarm.wagens} auto's, ${alarm.mannen} man`);
ok(alarm.fase === 'gevecht' && alarm.mannenAlarm, 'na het filmbeeld: het gevecht', alarm.fase);
ok(alarm.ronaldWeg && alarm.rent > 8, 'Ronald rent weg', `${alarm.rent.toFixed(1)} m in 3 s`);
ok(alarm.sterren >= 2, 'een schot in het gevecht: twee sterren', `${alarm.sterren}`);
ok(alarm.ronaldLeeft && alarm.naGevecht === 'naarGolf', 'alle vier neer; Ronald is weg, niet dood', alarm.naGevecht);
ok(alarm.metSterren === 'terug', 'met sterren bij de Wieken: eerst de politie kwijt', alarm.metSterren);
ok(alarm.verdiend === 1500 && alarm.klaar, 'zonder sterren: € 1.500', `+ € ${alarm.verdiend}`);

// ------------------------------------------------------------------ 8. opnieuw en de opslag
kop('opnieuw en de opslag');
const opslag = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const uit = {};
  // neergaan op het erf: weer bij de Golf, met de worst
  window.__opFase('sluipen', { erfHeeftWorst: true });
  window.__stap(2); window.__klik();
  const E = v.ronald.erf;
  window.__zet(E.deur.x + 2, E.deur.z);
  g.player.health = 0; v.dood();
  for (let i = 0; i < 70; i++) v.update(0.05);
  const knop = document.querySelector('#doodkeus button[data-keuze="missie"]');
  uit.knop = !!knop && !document.getElementById('doodkeus').hidden;
  if (knop) knop.click();
  window.__stap(6); window.__klik();
  uit.fase = v.fase; uit.worst = v.ronald.worst;
  uit.bijGolf = v.ronald.golf ? Math.hypot(g.player.pos.x - v.ronald.golf.x, g.player.pos.z - v.ronald.golf.z) : null;
  // de afloop gaat mee in de opslag
  const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
  Object.assign(s, { ronaldKlaar: true, ronaldPraatte: true, ronaldSchrift: true });
  v.herstel(s);
  const s2 = v.bewaar();
  uit.bewaard = s2.ronaldKlaar === true && s2.ronaldPraatte === true && s2.ronaldSchrift === true;
  uit.volgende = v.volgendeMissie;
  return uit;
});
ok(opslag.knop && opslag.fase === 'sluipen' && opslag.worst && opslag.bijGolf < 4, 'neergaan op het erf: de missie opnieuw, weer bij de Golf, met de worst', `${opslag.fase}, ${opslag.bijGolf && opslag.bijGolf.toFixed(1)} m`);
ok(opslag.bewaard, 'de afloop gaat mee in de opslag');
ok(!opslag.volgende || opslag.volgende.naam !== 'ronald', 'en daarna begint Wie is R. niet opnieuw', JSON.stringify(opslag.volgende));

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);

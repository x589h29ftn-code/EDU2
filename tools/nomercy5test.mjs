/*
 Toetst No Mercy 5, "De Overtocht" (stap 142): js/nomercy5.js (`maakMolenSet`, `maakCameraBoot`, `maakCameraRig`,
 `maakZijspan`, `NOMERCY5`) en het blok No Mercy 5 in js/verhaal.js (`n5…`).

 1. Wanneer: niet vóór missie 12 of zonder No Mercy 4; daarna Erik Jan op de kade in IJlst met de EJ en één melding.
    Hij belt nooit, ook niet na lang wachten, en tijdens een klus kun je hem niet aanspreken.
 2. De plekken gemeten: de kade op het land bij de ligplaats; de sloep op open water; de ruit aan de overkant op het
    land; het MG-nest aan de waterkant; de drie posten aan de voet, de vlag, vrij van botsdozen, water en panden; de
    sluipschutter op de stelling; de route van de rit over de weg, zonder keerpunt en niet onder een viaduct.
 3. Het gesprek (E), "Die nacht…": 01:00 en de klok stil, uniform, M1 en 200 patronen, in de sloep met twee
    figuranten, de camera-boot ernaast, het zoeklicht op het water, lichtkogels, opslaan geweigerd.
 4. De overtocht: varen naar de overkant, de camera-boot blijft naast je en op het water, het MG en de sluipschutter
    schieten zonder schade, in het licht gaat het filmpunt weg, aan wal bij de ruit.
 5. De molen: vijf Duitsers, 1–3 treffers (het MG 2, de sluipschutter 1), geen schade; de vlag (E) zakt; de
    stafauto bestuurbaar op het begin van de route, de camera-auto ervoor.
 6. De rit met een automaat: de camera-auto op de weg en voor je, de zijspannen erachter met schoten zonder
    schade, geen "Cut!", stil op de ruit: wrap, applaus, "Een week later…", de première op de kade om 20:00 met
    "Opgedragen aan De Veteraan"; de bruikleen terug, alles opgeruimd; keuze 1: € 2.000.
 7. "Cut!": stilstaan (uit beeld), te dichtbij en uitstappen geven elk een nieuwe take op het begin van de rit.
 8. Keuze 2: de stafauto is van jou (js/garage.js), ook na opslaan en laden.
 9. Mislukken en opruimen: te vroeg van boord, te ver van de set, X, neergaan in de rit, laden, een nieuwe missie.
 10. De sneltoets shift + komma, en de tussenpoos staat stil tijdens de opnames.
 11. Geen nieuwe shader als de set, de boten, de auto's en de zijspannen in beeld komen.

 Gebruik: npm run server &   node tools/nomercy5test.mjs 8123
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const r1 = (x) => (x == null || !isFinite(x)) ? String(x) : (Math.round(x * 10) / 10).toString();

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
let soortenKlaar = false;
page.on('console', m => { if (/^soorten:/.test(m.text())) soortenKlaar = true; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const KM = await import('/js/kaart.js');
  const V = await import('/js/viaduct.js');
  const A = await import('/js/audio.js');
  const I = await import('/js/inval.js');
  const O = await import('/js/opslag.js');
  window.__O = O;
  for (let n = 1; n <= 15; n++) localStorage.removeItem(n === 1 ? 'tinga.spel.v1' : `tinga.spel.v1.${n}`);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  g.sfeer.uur = 14;
  window.__W = W; window.__K = KM.KAART || KM.default; window.__V = V; window.__I = I;
  window.__meld = [];
  const echt = g.hud.melding.bind(g.hud);
  g.hud.melding = (k, o, t) => { window.__meld.push(`${k}|${o}`); return echt(k, o, t); };
  window.__geluid = { telefoon: 0, applaus: 0, schot: 0 };
  for (const k of ['telefoon', 'applaus', 'schot']) { const e = A.geluid[k].bind(A.geluid); A.geluid[k] = (...a) => { window.__geluid[k]++; return e(...a); }; }
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) v.update(dt); };
  window.__dicht = () => document.getElementById('dialoog').hidden;
  window.__klik = (max = 40) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__zet = (x, z) => {
    g.player.inCar = null;
    const [rx, rz] = W.resolveCollisions(x, z, 0.4);
    g.player.pos.set(rx, V.grondHoogte(rx, rz), rz); g.player.applyCamera();
  };
  window.__uitBoot = () => { if (g.boten.inBoot) g.boten.herstel({ boten: g.boten.bewaar().boten, aanBoord: -1 }); };
  window.__neerMet = (w) => {
    let n = 0;
    while (w.staat !== 'neer' && n < 10) { if (v.raak(w.persoon.groep.children[0], 99)) n++; else break; window.__stap(1); }
    return n;
  };
  // vrij spelen na missie 12 en No Mercy 4 (of zonder), zonder telefoontje dat wacht
  window.__vrij = ({ brug = true, nm4 = true, n5 = false } = {}) => {
    window.__uitBoot();
    const s = v.bewaar();
    s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
    s.brugKlaar = brug; s.noMercyKlaar = nm4; s.noMercyGebeld = true; s.noMercy5Klaar = n5; s.noMercy5Gemeld = false; s.noMercy5Staf = false;
    v.herstel(s); v.__geenVolgende(); g.politie.reset(); v.klusjes.reset();
    window.__stap(2);
  };
  // de sloep varen, beeld voor beeld, zolang hij past; de speler vaart mee (de hoofdlus doet dat niet headless)
  window.__vaar = (naar, v0 = 6, max = 60, metStaat = null) => {
    const B = g.boten, b = v.noMercy5.sloep, P = g.player;
    let t = 0, verst = 0, camWal = 0, n = 0;
    while (t < max) {
      const dx = naar.x - b.x, dz = naar.z - b.z, d = Math.hypot(dx, dz);
      if (d < 0.5) break;
      const yaw = Math.atan2(-dx, -dz), s = Math.min(d, v0 * 0.05);
      if (!B.verplaats(b, b.x + dx / d * s, b.z + dz / d * s, yaw)) break;
      P.pos.set(b.x, 0, b.z); P.applyCamera();
      v.update(0.05); t += 0.05; n++;
      const c = v.noMercy5.boot;
      verst = Math.max(verst, Math.hypot(c.x - b.x, c.z - b.z));
      if (!B.pastHier(c.x, c.z, c.yaw)) camWal++;
      if (metStaat) metStaat(t);
    }
    return { t, verst, camWal, n, x: b.x, z: b.z };
  };
  // het gesprek en het omkleden: tot in de sloep
  window.__totBoot = () => {
    const p = v.noMercy5.ejPlek;
    window.__zet(p.x + 2, p.z + 1); window.__stap(2);
    v.toets(); window.__stap(1);
    window.__klik(); window.__stap(90);
    window.__klik(); window.__stap(2);
    return v.noMercy5.fase;
  };
  // over het water, van boord bij de ruit
  window.__overtocht = () => {
    const a = { x: -1133, z: 884 };
    const r = window.__vaar({ x: a.x, z: a.z });
    g.boten.stapUit();
    window.__stap(2);
    return r;
  };
  // alles neer bij de molen, de vlag, tot in de stafauto
  window.__totRit = () => {
    window.__totBoot(); window.__overtocht(); window.__klik();
    const n = v.noMercy5;
    for (const grp of [n.groepA, n.groepB]) for (const w of grp.wachters) window.__neerMet(w);
    window.__stap(4); window.__klik();
    const vl = n.set.vlag; window.__zet(vl.x + 1, vl.z); window.__stap(2); v.toets();
    window.__stap(60); window.__klik(); window.__stap(2);
    const st = v.noMercy5.staf;
    window.__zet(st.x + 2, st.z); g.toggleCar(); window.__stap(2); window.__klik(); window.__stap(2);
    return v.noMercy5.fase;
  };
  // de automaat: de stafauto `gat` meter achter de camera-auto over de lijn, met `dt`
  window.__rijd = (gat = 15, max = 120, stopOp = null) => {
    const n0 = v.noMercy5, L = n0.lijn, c = n0.staf;
    let s = 0, t = 0, groot = 0, klein = 1e9, uitWeg = 0, motorVer = 0, motorDicht = 1e9, motorZag = false, cut = false;
    const ruitS = L.lengte - 18;
    while (t < max) {
      const n = v.noMercy5;
      if (n.fase !== 'rit') break;
      let doel = Math.max(0, n.camS - gat);
      if (stopOp !== null) doel = Math.min(doel, stopOp);
      else doel = Math.min(doel, ruitS);
      const ds = Math.max(0, Math.min(doel - s, 19 * 0.05));
      s += ds;
      const p = window.__I.puntOp(L, s, 1.0);
      c.x = p.x; c.z = p.z; c.yaw = p.yaw; c.speed = ds / 0.05;
      c.mesh.position.set(p.x, 0, p.z); c.mesh.rotation.y = p.yaw;
      g.player.applyCamera();
      v.update(0.05); t += 0.05;
      const m = v.noMercy5;
      if (m.fase === 'cut') { cut = true; break; }
      if (t > 3) { const gt = m.camS - m.sP; groot = Math.max(groot, gt); klein = Math.min(klein, gt); }
      const ca = m.camAuto;
      let dWeg = 1e9; for (let i = 0; i < L.n; i += 2) dWeg = Math.min(dWeg, Math.hypot(L.x[i] - ca.x, L.z[i] - ca.z));
      uitWeg = Math.max(uitWeg, dWeg);
      for (const mo of m.motoren) if (mo.mesh.visible) {
        motorZag = true;
        const d = Math.hypot(mo.mesh.position.x - c.x, mo.mesh.position.z - c.z);
        motorVer = Math.max(motorVer, d); motorDicht = Math.min(motorDicht, d);
      }
      if (stopOp === null && s >= ruitS - 0.01 && ds === 0) { window.__stap(4); break; }
    }
    return { t, s, groot, klein, uitWeg, motorVer, motorDicht, motorZag, cut, fase: v.noMercy5.fase };
  };
});

// ------------------------------------------------------------------ 1. wanneer
kop('1. wanneer: na missie 12 en No Mercy 4, alleen op de kaart');
const een = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__vrij({ brug: false, nm4: true });
  window.__stap(40);
  const voorBrug = { beschikbaar: v.noMercy5.beschikbaar, ej: v.noMercy5.ej.groep.visible };
  window.__vrij({ brug: true, nm4: false });
  window.__stap(40);
  const zonderNm4 = { beschikbaar: v.noMercy5.beschikbaar };
  window.__meld = []; window.__geluid.telefoon = 0;
  window.__vrij({ brug: true, nm4: true });
  // ver weg, en lang wachten: de EJ blijft staan en de telefoon gaat niet
  window.__zet(-200, 0);
  for (let i = 0; i < 60; i++) { window.__stap(100, 0.05); v.klusjes.reset(); }
  const n = v.noMercy5;
  const melding = window.__meld.filter(m => m.startsWith('NO MERCY 5')).length;
  const ej = g.hud.ej;
  const uit = { voorBrug, zonderNm4, beschikbaar: n.beschikbaar, startbaar: n.startbaar, zichtbaar: n.ej.groep.visible,
    ej: ej ? { x: ej.x, z: ej.z } : null, plek: n.ejPlek, melding, telefoon: window.__geluid.telefoon, dialoog: !window.__dicht(), fase: n.fase };
  // tijdens een klus: niet aan te spreken
  const p = n.ejPlek;
  window.__zet(p.x + 2, p.z + 1); window.__stap(2);
  const k = v.klusjes;
  if (k.__dwing) { k.__dwing(); window.__stap(2); uit.klus = { startbaar: v.noMercy5.startbaar }; k.reset(); }
  window.__stap(2);
  return uit;
});
ok(!een.voorBrug.beschikbaar && !een.voorBrug.ej, 'vóór missie 12 nog niet', JSON.stringify(een.voorBrug));
ok(!een.zonderNm4.beschikbaar, 'zonder No Mercy 4 nog niet');
ok(een.beschikbaar && een.startbaar && een.zichtbaar && een.fase === 'wacht', 'daarna staat Erik Jan op de kade', `fase ${een.fase}`);
ok(een.ej && een.plek && Math.hypot(een.ej.x - een.plek.x, een.ej.z - een.plek.z) < 0.1, 'de EJ op de kaart staat op zijn plek', JSON.stringify(een.ej));
ok(een.melding === 1, 'één melding, ook na drie minuten', `${een.melding} keer`);
ok(een.telefoon === 0 && !een.dialoog, 'hij belt niet (drie minuten gewacht)', `${een.telefoon} keer gebeld`);
if (een.klus) ok(!een.klus.startbaar, 'tijdens een klus niet aan te spreken');

// ------------------------------------------------------------------ 2. plekken
kop('2. de plekken gemeten');
const twee = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, W = window.__W, V = window.__V, K = window.__K;
  const n = v.noMercy5, set = n.set, M = n.molen, B = g.boten;
  const inPoly = (x, z, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const inPand = (x, z) => K.panden.some(p => p.voet && p.voet.length > 2 && Math.abs(p.voet[0][0] - x) < 90 && Math.abs(p.voet[0][1] - z) < 90 && inPoly(x, z, p.voet));
  const vrij = (p) => { const [x, z] = W.resolveCollisions(p.x, p.z, 0.4); return Math.hypot(x - p.x, z - p.z); };
  const meet = (p) => ({ water: W.pointInWater(p.x, p.z), pand: inPand(p.x, p.z), duw: vrij(p) });
  const ej = n.ejPlek, sloep = n.sloep;
  const lig = sloep.L;
  const mg = set.mg;
  // de waterkant: hoe ver het MG-nest van het water ligt
  let mgWater = 99; for (let a = 0; a < 32; a++) for (let r = 0.5; r < 12; r += 0.5) { const x = mg.x + Math.cos(a / 32 * 6.283) * r, z = mg.z + Math.sin(a / 32 * 6.283) * r; if (W.pointInWater(x, z)) { mgWater = Math.min(mgWater, r); break; } }
  const sl = set.sluip, rSl = Math.hypot(sl.x - M.cx, sl.z - M.cz);
  const L = n.lijn;
  let keer = 0, hoog = 0, langWater = 0;
  for (let i = 4; i < L.n - 4; i++) {
    const a = Math.atan2(L.z[i] - L.z[i - 4], L.x[i] - L.x[i - 4]), b = Math.atan2(L.z[i + 4] - L.z[i], L.x[i + 4] - L.x[i]);
    let d = Math.abs(b - a); if (d > Math.PI) d = 2 * Math.PI - d;
    if (d > 2.4) keer++;
  }
  for (let i = 0; i < L.n; i++) { hoog = Math.max(hoog, V.grondHoogte(L.x[i], L.z[i], Infinity)); if (W.pointInWater(L.x[i], L.z[i])) langWater++; }
  const S = { x: -1262, z: 884 }, A = { x: -1133, z: 884 };
  return {
    ej: { ...meet(ej), lig: Math.hypot(ej.x - lig.x, ej.z - lig.z) },
    start: { past: B.pastHier(S.x, S.z, -Math.PI / 2), water: W.pointInWater(S.x, S.z) },
    aanleg: meet(A),
    mg: { ...meet(mg), mgWater },
    voet: set.voet.map(meet),
    vlag: meet(set.vlag),
    sluip: { y: sl.y, stelling: M.stelling, r: rSl, romp: M.romp },
    lamp: { y: set.lamp.y, r: Math.hypot(set.lamp.x - M.cx, set.lamp.z - M.cz) },
    lijn: { lengte: L.lengte, keer, hoog, langWater },
    ruit: n.ruit ? meet(n.ruit) : null,
  };
});
ok(!twee.ej.water && !twee.ej.pand && twee.ej.duw < 0.05 && twee.ej.lig < 16, 'de kade: op het land bij de ligplaats', `${r1(twee.ej.lig)} m van de sloep`);
ok(twee.start.past && twee.start.water, 'de sloep begint op open water');
ok(!twee.aanleg.water && !twee.aanleg.pand && twee.aanleg.duw < 0.05, 'de ruit aan de overkant ligt op het land, vrij');
ok(!twee.mg.water && !twee.mg.pand && twee.mg.duw < 0.05 && twee.mg.mgWater < 8, 'het MG-nest aan de waterkant', `${r1(twee.mg.mgWater)} m van het water`);
ok(twee.voet.every(p => !p.water && !p.pand && p.duw < 0.05), 'de drie posten aan de voet: land, geen pand, geen botsdoos', JSON.stringify(twee.voet.map(p => r1(p.duw))));
ok(!twee.vlag.water && !twee.vlag.pand && twee.vlag.duw < 0.05, 'de vlaggenmast: land, vrij');
ok(Math.abs(twee.sluip.y - twee.sluip.stelling) < 0.01 && twee.sluip.r > twee.sluip.romp && twee.sluip.r < twee.sluip.romp + 2.0, 'de sluipschutter staat op de stelling', `${r1(twee.sluip.r)} m van het hart, romp ${twee.sluip.romp}`);
ok(twee.lamp.y > 7 && twee.lamp.r < twee.sluip.romp + 2.2, 'het zoeklicht staat op de stelling');
ok(twee.lijn.lengte > 450 && twee.lijn.keer === 0 && twee.lijn.hoog < 0.8 && twee.lijn.langWater === 0, 'de route van de rit: lang genoeg, geen keerpunt, niet onder een viaduct, niet door water',
  `${Math.round(twee.lijn.lengte)} m, ${twee.lijn.keer} keer, hoogte ${r1(twee.lijn.hoog)}`);
ok(twee.ruit && !twee.ruit.water && !twee.ruit.pand, 'de ruit van de rit ligt op de weg');

// ------------------------------------------------------------------ 3. het gesprek en de nacht
kop('3. het gesprek, "Die nacht…", in de sloep');
const drie = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, W = window.__W;
  window.__vrij();
  P.wapens = P.wapens.filter(w => w !== 'garand'); P.magazijnen.garand = 0; P.reserve = 40; P.zetWapen('pistool');
  const p = v.noMercy5.ejPlek;
  window.__zet(p.x + 2, p.z + 1); window.__stap(2);
  const hint = document.getElementById('praat').hidden === false && /Erik Jan/.test(document.getElementById('praat').textContent);
  v.toets(); window.__stap(1);
  const gesprek = v.noMercy5.fase;
  window.__klik(); window.__stap(90); window.__klik(); window.__stap(4);
  const n = v.noMercy5;
  const b = n.sloep;
  const vlek = n.set.vlek;
  window.__stap(120);
  return {
    hint, gesprek, fase: n.fase, uur: g.sfeer.uur, loopt: g.sfeer.loopt, pak: n.pak, garand: P.wapens.includes('garand'), reserve: P.reserve,
    inBoot: g.boten.inBoot === b, fig: n.figuranten.map(f => f.groep.visible && f.groep.parent === b.mesh),
    camBoot: n.boot.mesh.visible, ejAanBoord: n.ej.groep.parent === n.boot.mesh, set: n.set.zichtbaar,
    vlek: vlek ? { water: W.pointInWater(vlek.x, vlek.z) || W.vaarbaar(vlek.x, vlek.z) } : null,
    kogels: n.set.kogelsInLucht, opslaan: v.waaromNietOpslaan(),
  };
});
ok(drie.hint, 'bij Erik Jan: "E — praten met Erik Jan"');
ok(drie.gesprek === 'gesprek', 'E begint het gesprek');
ok(drie.fase === 'overtocht' || drie.fase === 'overtochtIntro', 'na het zwart: de overtocht', drie.fase);
ok(Math.floor(drie.uur) === 1 && !drie.loopt, 'één uur \'s nachts, en de klok staat stil', `${r1(drie.uur)} uur, loopt ${drie.loopt}`);
ok(drie.pak && drie.garand && drie.reserve === 240, 'uniform, de M1 en 200 patronen in bruikleen', `reserve ${drie.reserve}`);
ok(drie.inBoot && drie.fig.every(Boolean), 'in de sloep, met twee figuranten aan boord');
ok(drie.camBoot && drie.ejAanBoord && drie.set, 'de camera-boot met Erik Jan, en de set bij de molen');
ok(drie.vlek && drie.vlek.water, 'het zoeklicht schijnt op het water');
ok(drie.kogels > 0, 'er hangen lichtkogels', `${drie.kogels}`);
ok(/No Mercy 5/.test(drie.opslaan || ''), 'opslaan kan niet tijdens de opnames', drie.opslaan);

// ------------------------------------------------------------------ 4. de overtocht
kop('4. de overtocht');
const vier = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  P.health = 100;
  window.__geluid.schot = 0;
  let licht = 0;
  const r = window.__vaar({ x: -1133, z: 884 }, 6, 60, () => { if (v.noMercy5.lichtT > 0) licht++; });
  const voorUit = v.noMercy5.fase;
  const gelukt = g.boten.stapUit();
  const sp = { x: P.pos.x, z: P.pos.z };
  window.__stap(2);
  const n = v.noMercy5;
  return { r, voorUit, gelukt, dA: Math.hypot(sp.x + 1133, sp.z - 884), fase: n.fase, health: P.health, schoten: window.__geluid.schot, licht,
    puntLicht: n.punten.licht, cam: n.cam.groep.visible && n.cam.groep.parent === g.scene, groepB: n.groepB ? n.groepB.aantal : 0 };
});
ok(vier.r.t > 10 && vier.voorUit === 'overtocht', 'over het water gevaren', `${r1(vier.r.t)} s, bij (${r1(vier.r.x)}, ${r1(vier.r.z)})`);
ok(vier.r.verst < 30 && vier.r.camWal === 0, 'de camera-boot blijft naast je, en op het water', `verst ${r1(vier.r.verst)} m`);
ok(vier.schoten > 0 && vier.health === 100, 'het MG en de sluipschutter schieten, zonder schade', `${vier.schoten} schoten, leven ${vier.health}`);
ok(vier.gelukt && vier.dA < 6 && vier.fase === 'molen', 'aan wal bij de ruit: de molen', `${r1(vier.dA)} m van de ruit, ${vier.fase}`);
ok(vier.cam && vier.groepB === 3, 'de cameraman stapt over, drie Duitsers aan de voet');
console.log(`  (in de lichtvlek: ${vier.licht} beelden, filmpunt licht ${vier.puntLicht})`);

// het licht: midden in de vlek varen kost het filmpunt
const licht = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__vrij(); window.__totBoot(); window.__klik();
  const n = v.noMercy5, B = g.boten, b = n.sloep;
  let gevangen = false;
  for (let i = 0; i < 400 && !gevangen; i++) {
    const vl = n.set.vlek;
    if (vl && B.verplaats(b, vl.x, vl.z, b.yaw)) { g.player.pos.set(b.x, 0, b.z); }
    v.update(0.05);
    gevangen = v.noMercy5.punten && !v.noMercy5.punten.licht;
  }
  return { gevangen, roep: !window.__dicht() || window.__meld.length >= 0 };
});
ok(licht.gevangen, 'in het zoeklicht varen kost het filmpunt');

// ------------------------------------------------------------------ 5. de molen en de vlag
kop('5. de molen, de vlag, de stafauto');
const vijf = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__vrij(); window.__totBoot(); window.__overtocht(); window.__klik();
  const n = v.noMercy5;
  P.health = 100;
  window.__geluid.schot = 0;
  window.__stap(200);
  const schade = 100 - P.health, schoten = window.__geluid.schot;
  const treffers = [];
  for (const grp of [n.groepA, n.groepB]) for (const w of grp.wachters) treffers.push(window.__neerMet(w));
  window.__stap(4);
  const naNeer = v.noMercy5.fase;
  const snel = v.noMercy5.punten.snel;
  window.__klik();
  const vl = n.set.vlag;
  window.__zet(vl.x + 1, vl.z); window.__stap(2);
  const hint = /vlag/.test(document.getElementById('praat').textContent) && !document.getElementById('praat').hidden;
  v.toets();
  const neer = v.noMercy5.fase;
  window.__stap(50);
  const vlagY = n.set.vlagY, vlagHoog = n.set.vlagHoog;
  window.__klik(); window.__stap(2);
  const m = v.noMercy5, st = m.staf, ca = m.camAuto, L = m.lijn;
  return { schade, schoten, treffers, naNeer, snel, hint, neer, vlagY, vlagHoog, fase: m.fase,
    staf: { bestuurbaar: st.driveable, d0: Math.hypot(st.x - L.x[0], st.z - L.z[0]), zichtbaar: st.mesh.visible },
    cam: { voor: Math.hypot(ca.x - st.x, ca.z - st.z), zichtbaar: ca.mesh.visible, bestuurbaar: ca.driveable } };
});
ok(vijf.schade === 0 && vijf.schoten > 0, 'tien tellen onder vuur: geen schade', `${vijf.schoten} schoten`);
ok(vijf.treffers.length === 5 && vijf.treffers[0] === 2 && vijf.treffers[1] === 1 && vijf.treffers.slice(2).every(t => t >= 1 && t <= 3),
  'vijf Duitsers: het MG 2 treffers, de sluipschutter 1, de anderen 1–3', JSON.stringify(vijf.treffers));
ok(vijf.naNeer === 'vlag' && vijf.snel, 'allemaal neer binnen een minuut: de vlag, en het filmpunt');
ok(vijf.hint && vijf.neer === 'vlagNeer', 'E bij de mast haalt de vlag neer');
ok(vijf.vlagY < vijf.vlagHoog - 4, 'de vlag is gezakt', `${r1(vijf.vlagY)} m (was ${r1(vijf.vlagHoog)})`);
ok(vijf.fase === 'naarStaf' && vijf.staf.bestuurbaar && vijf.staf.zichtbaar && vijf.staf.d0 < 1, 'de stafauto staat bestuurbaar op het begin van de route');
ok(vijf.cam.zichtbaar && !vijf.cam.bestuurbaar && vijf.cam.voor > 12 && vijf.cam.voor < 24, 'de camera-auto staat ervoor', `${r1(vijf.cam.voor)} m`);

// ------------------------------------------------------------------ 6. de rit en het einde
kop('6. de rit, de wrap, de première, keuze 1');
const zes = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__vrij();
  P.wapens = P.wapens.filter(w => w !== 'garand'); P.magazijnen.garand = 0; P.reserve = 40; P.zetWapen('pistool');
  const fase = window.__totRit();
  const inStaf = P.inCar === v.noMercy5.staf;
  P.health = 100;
  window.__geluid.schot = 0; window.__geluid.applaus = 0;
  const balk0 = document.getElementById('schaduwbalk');
  const r = window.__rijd(15, 160);
  const balk = !balk0.hidden || r.fase !== 'rit';
  const naRit = v.noMercy5.fase;
  const punten = { ...v.noMercy5.punten };
  window.__klik(); window.__stap(110); window.__klik(); window.__stap(4);
  const n = v.noMercy5;
  const p = n.ejPlek;
  const pr = { fase: n.fase, uur: g.sfeer.uur, dEJ: Math.hypot(P.pos.x - p.x, P.pos.z - p.z), ej: n.ej.groep.visible,
    opgedragen: window.__meld.some(m => /Opgedragen aan De Veteraan/.test(m)) };
  // de première afklikken tot de keuze
  window.__klik(); window.__stap(2); window.__klik(); window.__stap(2);
  const keuze = v.noMercy5.fase, knoppen = v.openKeuze;
  return { fase, inStaf, r, balk, naRit, punten, schade: 100 - P.health, schoten: window.__geluid.schot, applaus: window.__geluid.applaus,
    pr, keuze, knoppen };
});
ok(zes.fase === 'rit' && zes.inStaf, 'in de stafauto: de rit begint', zes.fase);
ok(!zes.r.cut && zes.r.klein >= 8 - 0.5 && zes.r.groot <= 25 + 0.5, 'de automaat blijft in beeld van de camera-auto: geen "Cut!"', `${r1(zes.r.klein)}–${r1(zes.r.groot)} m`);
ok(zes.r.uitWeg < 3, 'de camera-auto rijdt over de route', `verst ${r1(zes.r.uitWeg)} m ernaast`);
ok(zes.r.motorZag && zes.r.motorDicht > 5 && zes.r.motorVer < 40, 'de zijspannen rijden achter je aan', `${r1(zes.r.motorDicht)}–${r1(zes.r.motorVer)} m`);
ok(zes.schoten > 0 && zes.schade === 0, 'ze schieten, zonder schade', `${zes.schoten} schoten`);
ok(zes.balk, 'de balk laat de afstand tot de camera-auto zien');
ok(zes.naRit === 'wrap' && zes.applaus > 0, 'stil op de ruit: een wrap, en applaus', `${zes.naRit}, rit ${r1(zes.r.t)} s`);
ok(zes.punten.take1 && zes.punten.stop, 'filmpunten: de rit in één take, precies op de ruit', JSON.stringify(zes.punten));
ok(zes.pr.fase === 'premiere' || zes.pr.fase === 'keuze', '"Een week later…": de première', zes.pr.fase);
ok(Math.floor(zes.pr.uur) === 20 && zes.pr.dEJ < 6 && zes.pr.ej, 'om acht uur \'s avonds op de kade, bij Erik Jan', `${r1(zes.pr.uur)} uur, ${r1(zes.pr.dEJ)} m`);
ok(zes.pr.opgedragen, '"Opgedragen aan De Veteraan"');
ok(zes.keuze === 'keuze' && zes.knoppen && zes.knoppen.length === 2, 'de keuze, ook als knoppen', JSON.stringify(zes.knoppen));

const zesB = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const geld = v.geld;
  // 1 kiezen zoals js/main.js het doet (de cijfertoets gaat naar kiesHuis)
  const gekozen = v.kiesHuis(1);
  window.__stap(80); window.__klik(); window.__stap(4);
  const n = v.noMercy5;
  return { fase: n.fase, klaar: n.klaar, plus: v.geld - geld, garand: P.wapens.includes('garand'), reserve: P.reserve, pak: n.pak,
    set: n.set.zichtbaar, staf: n.staf.x, cam: n.camAuto.x, boot: n.boot.mesh.visible, motoren: n.motoren.some(m => m.mesh.visible),
    duitsers: n.duitsers.some(d => d.groep.visible), sloep: Math.hypot(n.sloep.x - n.sloep.plek.x, n.sloep.z - n.sloep.plek.z),
    beschikbaar: n.beschikbaar, geslaagd: window.__meld.some(m => /^MISSIE GESLAAGD\|No Mercy 5/.test(m)), merk: n.merk.zichtbaar, gekozen };
});
ok(zesB.klaar && zesB.fase === 'uit' && zesB.plus === 2000 && zesB.geslaagd, 'keuze 1: € 2.000, MISSIE GESLAAGD', `+ ${zesB.plus}, fase ${zesB.fase}`);
ok(!zesB.garand && zesB.reserve === 40 && !zesB.pak, 'de M1 en de patronen terug, het uniform uit', `reserve ${zesB.reserve}`);
ok(!zesB.set && zesB.staf > 1e4 && zesB.cam > 1e4 && !zesB.boot && !zesB.motoren && !zesB.duitsers && !zesB.merk, 'de set, de auto\'s, de boot en de Duitsers weg');
ok(zesB.sloep < 1, 'de sloep ligt weer aan de ligplaats', `${r1(zesB.sloep)} m`);
ok(!zesB.beschikbaar, 'daarna geen EJ meer');

// ------------------------------------------------------------------ 7. Cut!
kop('7. "Cut!" en een nieuwe take');
const zeven = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__vrij();
  window.__totRit();
  const uit = {};
  // stilstaan: de camera-auto wacht even, dan rijdt hij uit beeld
  window.__meld = [];
  let t = 0; while (v.noMercy5.fase === 'rit' && t < 30) { v.update(0.05); t += 0.05; }
  uit.stil = { fase: v.noMercy5.fase, t, cut: window.__meld.some(m => /^CUT!\|Je reed uit beeld/.test(m)) };
  window.__stap(70);
  const n = v.noMercy5, L = n.lijn;
  uit.na = { fase: n.fase, takes: n.takes, take1: n.punten.take1, inStaf: P.inCar === n.staf,
    d0: Math.hypot(n.staf.x - L.x[0], n.staf.z - L.z[0]), cam: n.camS };
  // te dichtbij: vlak achter de camera-auto
  window.__meld = [];
  const r = window.__rijd(4, 15);
  uit.dicht = { cut: r.cut || window.__meld.some(m => /bijna op de camera-auto/.test(m)), t: r.t };
  window.__stap(70);
  // uitstappen
  window.__meld = [];
  g.toggleCar(); window.__stap(2);
  const uitgestapt = !P.inCar;
  t = 0; while (v.noMercy5.fase === 'rit' && t < 10) { v.update(0.05); t += 0.05; }
  uit.uit = { uitgestapt, cut: window.__meld.some(m => /uit de auto/.test(m)), takes: v.noMercy5.takes };
  window.__stap(70);
  return uit;
});
ok(zeven.stil.cut && zeven.stil.t < 15, 'stilstaan: na een paar tellen "Cut! Je reed uit beeld."', `${r1(zeven.stil.t)} s`);
ok(zeven.na.fase === 'rit' && zeven.na.takes === 1 && !zeven.na.take1 && zeven.na.inStaf && zeven.na.d0 < 1 && Math.abs(zeven.na.cam - 18) < 1,
  'een nieuwe take: weer in de stafauto op het begin, de camera-auto ervoor, het filmpunt weg', JSON.stringify(zeven.na));
ok(zeven.dicht.cut, 'te dicht op de camera-auto: "Cut!"', `${r1(zeven.dicht.t)} s`);
ok(zeven.uit.uitgestapt && zeven.uit.cut && zeven.uit.takes === 3, 'uitstappen: "Cut!"', `takes ${zeven.uit.takes}`);

// ------------------------------------------------------------------ 8. keuze 2: de stafauto
kop('8. keuze 2: de stafauto houden, ook na laden');
const acht = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__vrij();
  window.__totRit();
  window.__rijd(15, 160);
  window.__klik(); window.__stap(110); window.__klik(); window.__stap(4);
  window.__klik(); window.__stap(2); window.__klik(); window.__stap(2);
  const geld = v.geld;
  v.kiesHuis(2);
  window.__stap(80); window.__klik(); window.__stap(4);
  const n = v.noMercy5;
  const eigen = g.garage.eigen.filter(e => e.naam === 'stafauto');
  const auto = eigen[0] && eigen[0].car;
  const uit = { klaar: n.klaar, keuze: n.stafGekozen, plus: v.geld - geld, eigen: eigen.length,
    dAuto: auto ? Math.hypot(auto.x - P.pos.x, auto.z - P.pos.z) : null, bestuurbaar: auto ? auto.driveable !== false : false };
  // opslaan en laden
  P.inCar = null;
  const O = window.__O;
  window.__stap(200);
  const opgeslagen = O.bewaarSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: v, boten: g.boten, garage: g.garage });
  g.garage.herstel([]);
  const geladen = O.laadSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: v, boten: g.boten, garage: g.garage });
  window.__stap(10);
  uit.na = { opgeslagen: !!opgeslagen, geladen: !!geladen, eigen: g.garage.eigen.filter(e => e.naam === 'stafauto').length, keuze: v.noMercy5.stafGekozen, klaar: v.noMercy5.klaar };
  return uit;
});
ok(acht.klaar && acht.keuze && acht.plus === 0, 'keuze 2: geen geld, de stafauto', `+ ${acht.plus}`);
ok(acht.eigen === 1 && acht.dAuto < 8 && acht.bestuurbaar, 'hij staat naast je op de kade, en is van jou', `${r1(acht.dAuto)} m`);
ok(acht.na.eigen === 1 && acht.na.keuze && acht.na.klaar, 'na opslaan en laden: nog steeds van jou', JSON.stringify(acht.na));

// ------------------------------------------------------------------ 9. mislukken en opruimen
kop('9. mislukken en opruimen');
const negen = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const leeg = () => {
    const n = v.noMercy5;
    return !n.set.zichtbaar && !n.groepA && !n.groepB && !n.duitsers.some(d => d.groep.visible) && !n.figuranten.some(f => f.groep.visible)
      && !n.boot.mesh.visible && n.staf.x > 1e4 && n.camAuto.x > 1e4 && !n.motoren.some(m => m.mesh.visible) && !P.wapens.includes('garand') && !n.pak;
  };
  const begin = () => { window.__vrij(); P.wapens = P.wapens.filter(w => w !== 'garand'); P.magazijnen.garand = 0; P.reserve = 40; P.zetWapen('pistool'); window.__meld = []; };
  const uit = {};
  // te vroeg van boord (aan de westkant)
  begin(); window.__totBoot(); window.__klik();
  window.__uitBoot(); window.__zet(-1285, 884); window.__stap(4);
  uit.vroeg = { fase: v.noMercy5.fase, melding: window.__meld.some(m => /van boord/.test(m)), leeg: leeg(), reserve: P.reserve };
  // te ver van de set
  begin(); window.__totBoot(); window.__overtocht(); window.__klik();
  window.__zet(-1127 + 300, 904); window.__stap(4);
  uit.ver = { fase: v.noMercy5.fase, melding: window.__meld.some(m => /van de set/.test(m)), leeg: leeg() };
  // X tijdens de overtocht
  begin(); window.__totBoot(); window.__klik();
  const x = v.klusAfbreken();
  window.__stap(2);
  uit.x = { x, fase: v.noMercy5.fase, leeg: leeg(), boot: !g.boten.inBoot || true };
  window.__uitBoot();
  // neergaan in de rit
  begin(); window.__totRit();
  v.dood(); window.__stap(4);
  uit.dood = { fase: v.noMercy5.fase, leeg: leeg(), inCar: !!P.inCar };
  // laden midden bij de molen
  begin(); const s = v.bewaar();
  window.__totBoot(); window.__overtocht(); window.__klik();
  v.herstel(s); window.__stap(2);
  uit.laden = { fase: v.noMercy5.fase, leeg: leeg() };
  // een nieuwe missie midden in de opnames
  begin(); window.__totBoot(); window.__klik();
  window.__uitBoot();
  g.verhaal.herspeel && null;
  const sm = v.__startMissie ? v.__startMissie('schrift') : null;
  uit.missie = { sm, fase: v.noMercy5.fase, leeg: v.noMercy5.fase !== 'uit' ? null : leeg() };
  // na een mislukte poging: weer een EJ, en het gesprek pas na even weg
  begin();
  window.__stap(4);
  uit.terug = { ej: !!g.hud.ej, beschikbaar: v.noMercy5.beschikbaar };
  return uit;
});
ok(negen.vroeg.fase === 'uit' && negen.vroeg.melding && negen.vroeg.leeg && negen.vroeg.reserve === 40, 'te vroeg van boord: mislukt, alles weg, de bruikleen terug', JSON.stringify(negen.vroeg));
ok(negen.ver.fase === 'uit' && negen.ver.melding && negen.ver.leeg, 'te ver van de set: mislukt en opgeruimd');
ok(negen.x.x && negen.x.fase === 'uit' && negen.x.leeg, 'X: gestopt en opgeruimd');
ok(negen.dood.fase === 'uit' && negen.dood.leeg && !negen.dood.inCar, 'neergaan in de rit: opgeruimd, niet meer in de stafauto');
ok(negen.laden.fase === 'uit' && negen.laden.leeg, 'laden: opgeruimd');
if (negen.missie.sm !== null) ok(negen.missie.fase === 'uit' && negen.missie.leeg, 'een nieuwe missie: opgeruimd');
ok(negen.terug.ej && negen.terug.beschikbaar, 'daarna staat de EJ er weer');

// ------------------------------------------------------------------ 10. sneltoets en tussenpoos
kop('10. shift + komma, en de tussenpoos');
const tien = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__vrij({ brug: false, nm4: false });
  P.active = true;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Comma', key: ',', shiftKey: true }));
  P.active = false;
  window.__stap(1);
  const los = v.noMercy5.fase;
  window.__klik(); window.__stap(90); window.__klik(); window.__stap(2);
  const nacht = v.noMercy5.fase;
  // de tussenpoos staat stil zolang de opnames lopen
  v.stap128.zetWacht('schrift', 5);
  window.__stap(200);
  const wacht = v.stap128.naMissieT;
  v.klusAfbreken(); window.__uitBoot(); window.__stap(2);
  v.__geenVolgende();
  return { los, nacht, wacht };
});
ok(tien.los === 'gesprek', 'shift + komma: meteen het gesprek bij Erik Jan, ook vóór missie 12', tien.los);
ok(tien.nacht === 'overtocht' || tien.nacht === 'overtochtIntro', 'en door naar de overtocht');
ok(tien.wacht > 4.9, 'de tussenpoos telt niet af tijdens de opnames', `${r1(tien.wacht)} s`);

// ------------------------------------------------------------------ 11. shaders
kop('11. geen nieuwe shader');
await page.evaluate(() => window.__game.reliëfAf());
for (let i = 0; i < 1800 && !soortenKlaar; i++) await new Promise(r => setTimeout(r, 200));
const elf = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, R = g.renderer, P = g.player;
  if (!R) return { overgeslagen: true };
  window.__vrij();
  const M = v.noMercy5.molen;
  const kijk = (x, z, nx, nz) => { P.pos.set(x, 2, z); P.yaw = Math.atan2(-(nx - x), -(nz - z)); P.pitch = 0; P.applyCamera(); g.scene.updateMatrixWorld(true); R.render(g.scene, P.camera); };
  kijk(M.cx - 60, M.cz - 20, M.cx, M.cz);
  const voor = R.info.programs.length;
  window.__totBoot(); window.__klik(); window.__stap(40);
  const b = v.noMercy5.sloep;
  kijk(b.x + 10, b.z + 25, b.x, b.z);
  kijk(M.cx - 40, M.cz - 10, M.cx, M.cz);
  window.__overtocht(); window.__klik();
  kijk(M.cx - 25, M.cz - 25, M.cx, M.cz);
  for (const grp of [v.noMercy5.groepA, v.noMercy5.groepB]) for (const w of grp.wachters) window.__neerMet(w);
  window.__stap(4); window.__klik();
  const vl = v.noMercy5.set.vlag; window.__zet(vl.x + 1, vl.z); window.__stap(2); v.toets(); window.__stap(60); window.__klik(); window.__stap(2);
  const st = v.noMercy5.staf; window.__zet(st.x + 2, st.z); g.toggleCar(); window.__stap(2); window.__klik();
  window.__rijd(15, 8);
  const s = v.noMercy5.staf, mo = v.noMercy5.motoren[0].mesh.position;
  kijk(s.x + 8, s.z + 8, s.x, s.z);
  kijk(mo.x + 6, mo.z + 6, mo.x, mo.z);
  const na = R.info.programs.length;
  v.klusAfbreken(); window.__stap(2);
  return { voor, na };
});
if (elf.overgeslagen) ok(false, 'geen renderer in __game');
else ok(elf.na === elf.voor, 'de set, de boten, de auto\'s en de zijspannen vertalen geen nieuwe shader', `${elf.voor} → ${elf.na} programma's (soorten vooraf: ${soortenKlaar ? 'klaar' : 'niet gezien'})`);

await browser.close();
console.log(fouten ? `\n${fouten} fout${fouten > 1 ? 'en' : ''}` : '\nalles goed');
process.exit(fouten ? 1 : 0);

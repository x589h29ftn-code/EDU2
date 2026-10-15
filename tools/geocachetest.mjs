/*
 Proef bij stap 196 (npm run geocachetest): de Tinga Cache (js/geocache.js, ontwerp in docs/ontwerp-geocache.md).

 1. De omrekening (zonder browser): de oorsprong van de kaart is 53,020904 N 5,643757 O; heen en terug op een millimeter; het
    schrijven als N 53° 01.254 / E 005° 38.612.
 2. De posters: op de balie van de BP-shop, op een prikbord bij Radio Tinga en op de eettafel van de drie woningen die Erik kan
    kopen (op 74 cm, op het tafelblad).
 3. De kassa: met te weinig geld geen GPS; met genoeg € 250 eraf, de medewerker zegt dat je bij Sjors moet zijn; een tweede niet.
 4. Sjors op de stoep van Radio Tinga met de S op de kaart; E: de uitleg; N: de GPS in beeld (getekend).
 5. De vijf plekken gemeten: niet in het water, niet in een botsdoos, het punt uit het raadsel binnen `CACHE.radius` (plus de
    afronding) van het kistje; cache 4 aan het water; elk bij zijn anker (Geeuwbrug, Duinterpen, tennishal, De Rat, de Tiger).
 6. Het raadsel van cache 2 klopt met de wereld (1944 op de gedenksteen, 87.9 FM, Molenkrite 15) en geeft het goede punt.
 7. Alle vijf achter elkaar: cache 1 openen; cache 2 eerst verkeerd ingetikt (hier is niets), dan goed; cache 3 met het bordje
    (stap 1) en de tweede stap; cache 4 te voet niet, vanuit de boot wel; cache 5 met de cijfers uit de logboeken: € 2.500 en de
    gouden M1 Garand.
 8. De statistieken: "Tinga Cache 5 van 5". Opslaan en laden houdt alles (ook het goud); een nieuw spel begint opnieuw.
 9. Geen nieuw shaderprogramma: de posters, de kistjes, Sjors, de GPS en de gouden M1.
 10. (stap 197) De GPS in je hand: geen wapen en niet schieten; klikken, R, een wapen kiezen en H stoppen hem weg (zonder schot);
     pakken breekt het herladen af; de rechtermuisknop houdt hem dichterbij; het scherm wordt bijgewerkt; binnen en met de drone
     gaat hij weg. De gouden M1 met echte doeken van gepolijst goud, metalness 1, en weer terug.

 Gebruik: npm run server &  node tools/geocachetest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fouten++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, P = g.player, v = g.verhaal;
  P.active = true; window.__autoplay = true;
  g.politie.proefStil = true;
  window.__W = await import('/js/world.js');
  window.__regels = [];
  const tekst = document.getElementById('dialoogTekst');
  const dicht = () => document.getElementById('dialoog').hidden;
  let laatst = '';
  window.__lees = () => { const t = dicht() ? '' : tekst.textContent; if (t && t !== laatst) window.__regels.push(t); laatst = t; };
  window.__stap = (n = 1, dt = 0.05) => { for (let i = 0; i < n; i++) { P.health = 100; v.update(dt); g.geocache.update(dt); window.__lees(); } };
  window.__klik = (max = 30) => { for (let i = 0; i < max && !dicht(); i++) { window.__lees(); v.toets(); window.__stap(1); } };
  window.__zet = (x, z) => { if (P.inCar) { P.inCar.speed = 0; P.inCar = null; } P.zit = false; P.pos.set(x, 0, z); P.applyCamera(); };
  // vrij spelen na het einde, met geld
  const s = v.bewaar(); Object.assign(s, { missie: 'klaar', fase: 'klaar', volgende: null, uitzendingKlaar: true, invalKlaar: true, ronaldKlaar: true, roanKlaar: true, noMercyKlaar: true, noMercyGebeld: true, geld: 0 });
  v.herstel(s); window.__stap(2);
});

kop('1. de omrekening');
{
  const r = await page.evaluate(async () => {
    const G = await import('/js/geocache.js');
    const om = G.maakOmrekening([53.020904, 5.643757]);
    const o0 = om.naarGraden(0, 0), p = om.naarGraden(1234.5, -876.5), t = om.vanGraden(p.lat, p.lon);
    const n = om.naarGraden(0, -1.85), e = om.naarGraden(1.12, 0);
    return { o0, t, tn: G.tekstN(53.020904), te: G.tekstE(5.643757), dn: (n.lat - 53.020904) * 60000, de: (e.lon - 5.643757) * 60000 };
  });
  ok(Math.abs(r.o0.lat - 53.020904) < 1e-9 && Math.abs(r.o0.lon - 5.643757) < 1e-9, 'de oorsprong is 53,020904 N 5,643757 O');
  ok(Math.abs(r.t.x - 1234.5) < 0.001 && Math.abs(r.t.z + 876.5) < 0.001, 'heen en terug op een millimeter');
  ok(r.tn === 'N 53° 01.254' && r.te === 'E 005° 38.625', 'geschreven als een geocacher', `${r.tn} ${r.te}`);
  ok(Math.abs(r.dn - 1) < 0.02 && Math.abs(r.de - 1) < 0.02, 'een duizendste minuut is ~1,85 m noord en ~1,1 m oost', `${r.dn.toFixed(3)} / ${r.de.toFixed(3)}`);
}

kop('2. de posters');
const posters = await page.evaluate(async () => {
  const g = window.__game, C = g.geocache, B = await import('/js/bouwvlak.js');
  C.bouw();
  const ps = C.posters.filter(m => m.geometry.type === 'PlaneGeometry');
  const bp = ps.filter(m => B.inBpWinkel ? B.inBpWinkel(m.position.x, m.position.z) : false).length;
  const tafels = g.woningen.filter(w => /Zeskanter|Molenkrite130c|Molenkrite 130c|Koningsspil/.test(w.adres || w.naam || '')).map(w => {
    const t = w.plekken.tafel;
    const p = ps.find(m => Math.hypot(m.position.x - t.x, m.position.z - t.z) < 0.6);
    return p ? +p.position.y.toFixed(3) : null;
  });
  const st = g.studio.plekken.stoep;
  const radio = ps.filter(m => Math.hypot(m.position.x - st.x, m.position.z - st.z) < 8).length;
  return { aantal: ps.length, bp, tafels, radio, bouwFout: C.stand.bouwFout };
});
ok(!posters.bouwFout, 'de plekken zijn gevonden', posters.bouwFout || '');
ok(posters.bp >= 1, 'een poster op de balie van de BP-shop');
ok(posters.radio >= 1, 'een poster op een prikbord bij Radio Tinga');
ok(posters.tafels.length === 3 && posters.tafels.every(y => y !== null && y > 0.74 && y < 0.76), 'op de eettafel van de drie woningen van Erik, op het tafelblad', posters.tafels.join(', '));

kop('3. de kassa');
const kassa = await page.evaluate(async () => {
  const g = window.__game, P = g.player, v = g.verhaal, K = g.bpKassa, B = await import('/js/bouwvlak.js'), BK = await import('/js/bpkassa.js');
  const vak = BK.BP_KASSA.vak, [x, z] = B.bpWereld((vak.u0 + vak.u1) / 2, (vak.w0 + vak.w1) / 2);
  window.__zet(x, z); window.__stap(2);
  const toon = K.toets();
  const keuzes = K.keuzes;
  v.betaal(v.geld);
  K.kies(3);
  const arm = g.geocache.gps;
  v.verdien(1000);
  const voor = v.geld;
  window.__regels = [];
  K.kies(3);
  const wieEl = document.getElementById('dialoogNaam');
  const wie = wieEl ? wieEl.textContent.trim() : null;
  window.__klik();
  const regels = window.__regels.slice();
  const na = v.geld;
  // een tweede
  K.toets(); K.kies(3);
  const tweede = v.geld;
  if (K.open) K.toets();
  return { toon, keuzes, arm, voor, na, tweede, gps: g.geocache.gps, regels, wie };
});
ok(kassa.toon && kassa.keuzes && kassa.keuzes.length === 3 && /GPS/.test(kassa.keuzes[2]), 'aan de kassa is 3 de GPS', kassa.keuzes ? kassa.keuzes[2] : '');
ok(!kassa.arm, 'met te weinig geld geen GPS');
ok(kassa.gps && kassa.voor - kassa.na === 250 && kassa.tweede === kassa.na, '€ 250 eraf, en een tweede kost niets', `€ ${kassa.voor} → € ${kassa.na}`);
ok(kassa.regels.some(r => /Sjors/.test(r) && /Radio Tinga/.test(r)) && kassa.wie === 'Medewerker BP', 'de medewerker zegt dat je bij Sjors van Radio Tinga moet zijn', kassa.regels.find(r => /Sjors/.test(r)) || kassa.regels.join(' | ').slice(0, 120));

kop('4. Sjors en de GPS');
const sjors = await page.evaluate(() => {
  const g = window.__game, C = g.geocache, st = g.studio.plekken.stoep;
  window.__zet(st.x + 120, st.z + 120); window.__stap(4);
  const s = C.sjors, zicht = !!(s && s.groep.visible), S = g.hud.sjors;
  const d = s ? Math.hypot(s.groep.position.x - st.x, s.groep.position.z - st.z) : null;
  window.__zet(s.groep.position.x + 1.5, s.groep.position.z); window.__stap(2);
  const hint = C.hint();
  window.__regels = [];
  C.toets(); window.__klik();
  const uitleg = window.__regels.slice();
  C.wissel(); window.__stap(10);
  // (stap 197) het toestel in 3D aan de camera, op de wapenlaag, het scherm in beeld en het lcd getekend
  const T = C.toestel, cam = g.camera; cam.updateMatrixWorld(true); T.groep.updateMatrixWorld(true);
  let laag = true; T.groep.traverse(o => { if (o.isMesh && o.layers.mask !== 2) laag = false; });
  const sw = new T.scherm.position.constructor(); T.scherm.getWorldPosition(sw); sw.project(cam);
  const px = C.lcd.getContext('2d').getImageData(4, 4, 1, 1).data;
  let geel = false; T.groep.traverse(o => { if (o.isMesh && o.material.color && o.material.color.r > 0.8 && o.material.color.g > 0.4 && o.material.color.b < 0.2 && !o.material.map) geel = true; });
  return { zicht, kaart: !!S, d: d && +d.toFixed(1), hint, uitleg, gpsZicht: C.aan && T.groep.visible && T.groep.parent === cam && C.inBeeld, laag,
    inBeeld: Math.abs(sw.x) < 1 && Math.abs(sw.y) < 1 && sw.z < 1, ndc: [+sw.x.toFixed(2), +sw.y.toFixed(2)], lcd: px[1] > px[2] && px[1] > 150, scherm: T.scherm.material.map && T.scherm.material.map.image === C.lcd,
    geel, doel: !!C.doel() };
});
ok(sjors.zicht && sjors.kaart && sjors.d < 6, 'Sjors staat bij de stoep van Radio Tinga, met de S op de kaart', `${sjors.d} m van de stoep`);
ok(/Sjors/.test(sjors.hint || '') && sjors.uitleg.length >= 4 && sjors.uitleg.some(r => /vijf/.test(r)) && sjors.uitleg.some(r => /\bN\b/.test(r)), 'E bij Sjors: de uitleg (vijf caches, N voor de GPS)', sjors.uitleg[0] || '');
ok(sjors.gpsZicht && sjors.geel && sjors.doel, 'N: de GPS in je hand, een geel handapparaat, met het doel van cache 1 al ingevuld');
ok(sjors.laag && sjors.inBeeld, '(stap 197) het toestel in 3D aan de camera, op de wapenlaag, het scherm in beeld', JSON.stringify(sjors.ndc));
ok(sjors.lcd && sjors.scherm, '(stap 197) het scherm is het lcd-doek, grijsgroen getekend');

kop('5. de vijf plekken');
const plekken = await page.evaluate(async () => {
  const g = window.__game, C = g.geocache, W = window.__W, K = (await import('/js/kaart.js')).KAART;
  const inPand = (x, z) => K.panden.some(p => {
    if (!p.voet || !p.rect || Math.abs(p.rect.cx - x) > 60 || Math.abs(p.rect.cz - z) > 60) return false;
    let b = false;
    for (let i = 0, j = p.voet.length - 1; i < p.voet.length; j = i++) {
      const [xi, zi] = p.voet[i], [xj, zj] = p.voet[j];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) b = !b;
    }
    return b;
  });
  const st = C.stand;
  return st.caches.map(c => {
    const [rx, rz] = W.resolveCollisions(c.plek.x, c.plek.z, 0.3);
    let water = false;
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; if (W.pointInWater(c.plek.x + Math.cos(a) * 2.5, c.plek.z + Math.sin(a) * 2.5)) water = true; }
    return { nr: c.nr, pand: inPand(c.plek.x, c.plek.z), inWater: W.pointInWater(c.plek.x, c.plek.z), doos: Math.hypot(rx - c.plek.x, rz - c.plek.z) > 0.01, afPunt: +Math.hypot(c.punt.x - c.plek.x, c.punt.z - c.plek.z).toFixed(2), waterBij: water, x: +c.plek.x.toFixed(1), z: +c.plek.z.toFixed(1) };
  });
});
const ankers = { 1: [-85, -482, 40], 2: [1400, 470, 260], 3: [null], 4: [-1133, 884, 35], 5: [46, 1097, 25] };
for (const p of plekken) {
  ok(!p.inWater && !p.doos && !p.pand && p.afPunt <= 5 + 1.6, `cache ${p.nr}: op het droge, niet in een botsdoos of pand, ${p.afPunt} m van het punt uit het raadsel`, `(${p.x}, ${p.z})`);
  const a = ankers[p.nr];
  if (a[0] !== null) ok(Math.hypot(p.x - a[0], p.z - a[1]) < a[2], `cache ${p.nr}: bij zijn plek`, `${Math.round(Math.hypot(p.x - a[0], p.z - a[1]))} m van (${a[0]}, ${a[1]})`);
}
ok(plekken[3].waterBij, 'cache 4 ligt aan het water');

kop('6. het raadsel van cache 2');
const raad = await page.evaluate(async () => {
  const T = await import('/js/tiger.js'), S = await import('/js/studio.js');
  return { steen: T.TEKST.join(' '), fm: S.ZENDER.frequentie };
});
ok(/1944/.test(raad.steen) && raad.fm === '87.9 FM', 'de antwoorden staan in de wereld: 1944 op de gedenksteen, 87.9 FM', `${raad.steen} · ${raad.fm}`);

kop('7. alle vijf');
const vijf = await page.evaluate(() => {
  const g = window.__game, C = g.geocache, P = g.player, v = g.verhaal;
  const uit = {};
  const st = () => C.stand;
  const naar = (p, dx = 0.8) => { window.__zet(p.x + dx, p.z); window.__stap(2); };
  const tik = (s) => { for (const ch of s) C.cijfer(ch === 'terug' ? 'terug' : +ch); };
  const geld0 = v.geld;
  // 1
  naar(st().caches[0].plek);
  uit.hint1 = C.hint();
  uit.open1 = C.toets(); window.__stap(2);
  // 2: eerst verkeerd (100 m ernaast), dan goed uit het raadsel
  const c2 = st().caches[1];
  const r2 = C.raadsel(), regel = r2.find(r => /\(B/.test(r)) || '';
  const m = /\(B ([−+]) (\d+)\).*\(C \+ A ([−+]) (\d+)\)/.exec(regel);
  const A = 15, B = 1944, Cc = 879;
  const nDui = m ? (m[1] === '−' ? B - +m[2] : B + +m[2]) : -1, eDui = m ? (m[3] === '−' ? Cc + A - +m[4] : Cc + A + +m[4]) : -1;
  uit.raad = { regel, nDui, eDui, echtN: c2.n.dui, echtE: c2.e.dui };
  const fout = String((nDui + 60) % 1000).padStart(3, '0') + String(eDui).padStart(3, '0');
  tik(fout);
  const df = C.doel(); window.__zet(df.x, df.z); window.__stap(4);
  uit.mis = document.getElementById('missie') ? document.getElementById('missie').textContent : '';
  tik(String(nDui).padStart(3, '0') + String(eDui).padStart(3, '0'));
  const d2 = C.doel();
  uit.doel2 = d2 ? +Math.hypot(d2.x - c2.punt.x, d2.z - c2.punt.z).toFixed(2) : null;
  naar(c2.plek); uit.open2 = C.toets(); window.__stap(2);
  // 3: stap 1 (de coördinaten van het bordje), dan het bordje, dan stap 2
  const c3 = st().caches[2];
  const r3 = C.raadsel().join(' ');
  const s1 = /Stap 1: N \d+° \d+\.(\d{3})\s+E \d+° \d+\.(\d{3})/.exec(r3);
  tik(s1[1] + s1[2]);
  const d31 = C.doel();
  uit.stap1 = d31 ? +Math.hypot(d31.x - c3.stap1.x, d31.z - c3.stap1.z).toFixed(2) : null;
  naar(c3.stap1, 1.2);
  uit.bordHint = C.hint();
  C.toets();
  const regels = C.bordje.userData.regels.join(' ');
  const s2 = /N \d+° \d+\.(\d{3})\s+E \d+° \d+\.(\d{3})/.exec(regels);
  tik(s2[1] + s2[2]);
  const d32 = C.doel();
  uit.stap2 = d32 ? +Math.hypot(d32.x - c3.punt.x, d32.z - c3.punt.z).toFixed(2) : null;
  naar(c3.plek); uit.open3 = C.toets(); window.__stap(2);
  // 4: te voet niet, vanuit de boot wel
  const c4 = st().caches[3];
  const r4 = C.raadsel().join(' '), s4 = /N \d+° \d+\.(\d{3})\s+E \d+° \d+\.(\d{3})/.exec(r4);
  tik(s4[1] + s4[2]);
  naar(c4.plek);
  uit.voet4 = C.toets();
  // de boot: een plek op het water bij de cache
  const W = window.__W, Bt = g.boten;
  let wp = null;
  for (let r = 1; r < 6 && !wp; r += 0.5) for (let i = 0; i < 24 && !wp; i++) { const a = i / 24 * Math.PI * 2, x = c4.plek.x + Math.cos(a) * r, z = c4.plek.z + Math.sin(a) * r; if (W.vaarbaar(x, z)) wp = { x, z }; }
  const boot = Bt.ruw(0);
  if (wp && boot) { boot.x = wp.x; boot.z = wp.z; boot.vx = 0; boot.vz = 0; Bt.stapIn(boot); window.__stap(2); }
  uit.waterPlek = wp;
  uit.boot4 = C.toets(); window.__stap(2);
  if (Bt.inBoot) Bt.herstel({});
  // 5: de cijfers uit de logboeken
  const c5 = st().caches[4], cs = st().caches.slice(0, 4).map(c => c.cijfer).join('');
  tik(cs + st().rest);
  const d5 = C.doel();
  uit.doel5 = d5 ? +Math.hypot(d5.x - c5.punt.x, d5.z - c5.punt.z).toFixed(2) : null;
  uit.letters = st().caches.slice(0, 4).map(c => c.letter).join('');
  const geldVoor5 = v.geld;
  naar(c5.plek); uit.open5 = C.toets(); window.__stap(2);
  uit.geld5 = v.geld - geldVoor5;
  uit.geldTotaal = v.geld - geld0;
  uit.gevonden = C.gevonden;
  uit.garand = P.wapens.includes('garand');
  uit.goud = !!(P.modellen.garand && P.modellen.garand.goud);
  uit.regels = g.statistiek.regels(v.voortgang());
  uit.sjorsWeg = (() => { window.__zet(g.studio.plekken.stoep.x + 120, g.studio.plekken.stoep.z); window.__stap(3); return !C.sjors.groep.visible && !g.hud.sjors; })();
  return uit;
});
ok(/cache openen/.test(vijf.hint1 || '') && vijf.open1, 'cache 1: E — cache openen, en open');
ok(vijf.raad.nDui === vijf.raad.echtN && vijf.raad.eDui === vijf.raad.echtE, 'cache 2: het raadsel met 15, 1944 en 879 geeft precies de coördinaten', `${vijf.raad.regel}`);
ok(/niets/.test(vijf.mis), 'verkeerd ingetikt: op dat punt "Hier is niets…"', vijf.mis.slice(0, 40));
ok(vijf.doel2 !== null && vijf.doel2 < 0.01 && vijf.open2, 'goed ingetikt: het doel is het punt uit het raadsel, en de cache gaat open', `${vijf.doel2} m`);
ok(vijf.stap1 !== null && vijf.stap1 < 1.6 && /bordje/.test(vijf.bordHint || ''), 'cache 3: stap 1 wijst naar het bordje bij de vishandel', `${vijf.stap1} m`);
ok(vijf.stap2 !== null && vijf.stap2 < 0.01 && vijf.open3, 'het bordje geeft de tweede stap, en de cache gaat open', `${vijf.stap2} m`);
ok(!vijf.voet4 && vijf.waterPlek && vijf.boot4, 'cache 4: te voet niet, vanuit de boot wel', JSON.stringify(vijf.waterPlek));
ok(vijf.letters === 'SLAG' && vijf.doel5 !== null && vijf.doel5 < 0.01 && vijf.open5, 'cache 5: SLAG, en de cijfers uit de logboeken geven het punt', `${vijf.doel5} m`);
ok(vijf.geld5 === 2500 && vijf.geldTotaal === 100 + 200 + 250 + 300 + 2500, '€ 2.500 voor de laatste, € 3.350 in totaal', `€ ${vijf.geldTotaal}`);
ok(vijf.gevonden === 5 && vijf.garand && vijf.goud, 'de gouden M1 Garand');
ok(vijf.regels.some(([k, w]) => k === 'Tinga Cache' && w === '5 van 5'), 'in de statistieken: Tinga Cache 5 van 5');
ok(vijf.sjorsWeg, 'daarna staat Sjors er niet meer, en de S is van de kaart');

kop('8. opslaan en laden');
const opslag = await page.evaluate(async () => {
  const g = window.__game, P = g.player, C = g.geocache, O = await import('/js/opslag.js');
  O.bewaarSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: g.verhaal });
  C.nieuw(); P.modellen.garand.zetGoud(false);
  const leeg = { gps: C.gps, gevonden: C.gevonden, goud: P.modellen.garand.goud };
  O.laadSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: g.verhaal });
  const na = { gps: C.gps, gevonden: C.gevonden, goud: P.modellen.garand.goud };
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  return { leeg, na };
});
ok(!opslag.leeg.gps && opslag.leeg.gevonden === 0, 'een nieuw spel begint zonder GPS en zonder caches');
ok(opslag.na.gps && opslag.na.gevonden === 5 && opslag.na.goud, 'na laden: de GPS, vijf caches en de gouden M1', JSON.stringify(opslag.na));

kop('10. de GPS in je hand en je wapen (stap 197)');
const hand = await page.evaluate(() => {
  const g = window.__game, C = g.geocache, P = g.player, uit = {};
  const st = g.studio.plekken.stoep; window.__zet(st.x + 30, st.z + 30);
  P.zetWapen('pistool'); P.wisselT = 0; P.holster = 0; P.reloading = 0; P.wapenUit = false; P.ammo = 5; P.vuurKlok = 0; P.reserve = 50;
  const aan = () => { if (!C.aan) C.wissel(); window.__stap(8); P.update(0.05); };
  // vasthouden: geen wapen, niet schieten
  aan();
  uit.vast = { inHand: P.gpsInHand, wapen: P.gun.visible, mag: P.magSchieten() };
  // klikken: de GPS weg, het wapen omhoog, geen schot
  const a0 = P.ammo; P.shoot();
  uit.klik = { aan: C.aan, inHand: P.gpsInHand, schot: a0 - P.ammo, wissel: P.wisselT > 0 };
  window.__stap(8); for (let i = 0; i < 12; i++) P.update(0.05);
  uit.terug = { wapen: P.gun.visible, toestel: C.inBeeld, mag: P.magSchieten() };
  // herladen: eerst de GPS weg
  aan(); P.ammo = 3; P.reload(); uit.herlaad = { aan: C.aan, laadt: P.reloading > 0 };
  window.__stap(8); for (let i = 0; i < 12; i++) P.update(0.05);
  // pakken midden in het herladen breekt het af
  P.reload(); const laadde = P.reloading > 0; aan(); uit.pakTijdensLaden = { laadde, nu: P.reloading };
  // een wapen kiezen
  P.wapens.includes('garand') || P.krijgWapen('garand'); P.zetWapen('pistool'); aan();
  P.startWissel('garand'); uit.kies = { aan: C.aan, naar: P.wisselNaar };
  for (let i = 0; i < 20; i++) P.update(0.05); window.__stap(8);
  // H: met het wapen weggestopt pak je het weer en gaat de GPS weg
  aan(); P.wisselWapen(); const weg = P.wapenUit; P.wisselWapen(); uit.h = { weg, aan: C.aan, wapenUit: P.wapenUit };
  for (let i = 0; i < 20; i++) P.update(0.05);
  // de rechtermuisknop: dichterbij om te lezen, niet richten
  aan(); const z0 = C.toestel.groep.position.z, y0 = C.toestel.groep.position.y;
  P.richten(true); window.__stap(8);
  uit.lees = { dichter: C.toestel.groep.position.z - z0, hoger: C.toestel.groep.position.y - y0, richt: P.richtAan };
  P.richten(false); window.__stap(8);
  // het scherm wordt bijgewerkt
  const v0 = C.toestel.scherm.material.map.version; window.__stap(10);
  uit.scherm = C.toestel.scherm.material.map.version - v0;
  // waar het niet kan: binnen, zittend, de drone; en dan gaat N ook niet aan
  P.binnen = true; window.__stap(2); uit.binnen = C.aan; uit.binnenN = C.wissel(); P.binnen = false;
  aan(); P.inDrone = true; window.__stap(2); uit.drone = C.aan; P.inDrone = false;
  window.__stap(10); uit.wegNa = C.inBeeld;
  // de gouden M1: echte doeken van goud, metalness 1, en weer terug
  const G = P.modellen.garand;
  const mats = () => { const s = new Set(); G.groep.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => s.add(m)); }); return [...s]; };
  G.zetGoud(false);
  const staal = mats().filter(m => m.metalness >= 0.3 && m.metalness < 0.9 && m.map);
  // (de M1 heeft van zichzelf al delen met metalness 1, zoals het messing: die tellen we niet mee)
  const vooraf = mats().filter(m => m.metalness === 1 && m.map).length;
  G.zetGoud(true);
  const goud = mats().filter(m => m.metalness === 1 && m.map);
  const kleur = (m) => { const c = m.map.image, d = c.getContext('2d').getImageData(3, 3, 1, 1).data; return [d[0], d[1], d[2]]; };
  const k = goud.map(kleur);
  uit.goud = { staal: staal.length, goud: goud.length - vooraf, vooraf, kleur: k.slice(0, 3), ruw: goud.map(m => { const c = m.roughnessMap.image; return c.getContext('2d').getImageData(3, 3, 1, 1).data[0]; }).slice(0, 3),
    zelfde: goud.every(m => m.normalMap && m.roughnessMap) };
  G.zetGoud(false); uit.terugStaal = mats().filter(m => m.metalness === 1 && m.map).length - vooraf;
  G.zetGoud(true);
  return uit;
});
ok(hand.vast.inHand && !hand.vast.wapen && !hand.vast.mag, 'met de GPS in je hand: geen wapen in beeld en niet schieten', JSON.stringify(hand.vast));
ok(!hand.klik.aan && !hand.klik.inHand && hand.klik.schot === 0 && hand.klik.wissel, 'klikken stopt de GPS weg en pakt het wapen, zonder schot', JSON.stringify(hand.klik));
ok(hand.terug.wapen && !hand.terug.toestel && hand.terug.mag, 'daarna het wapen weer in je hand en de GPS uit beeld', JSON.stringify(hand.terug));
ok(!hand.herlaad.aan && !hand.herlaad.laadt, 'R stopt eerst de GPS weg (en herlaadt nog niet)', JSON.stringify(hand.herlaad));
ok(hand.pakTijdensLaden.laadde && hand.pakTijdensLaden.nu === 0, 'de GPS pakken breekt het herladen af', JSON.stringify(hand.pakTijdensLaden));
ok(!hand.kies.aan && hand.kies.naar === 'garand', 'een wapen kiezen stopt de GPS weg', JSON.stringify(hand.kies));
ok(hand.h.weg && !hand.h.aan && !hand.h.wapenUit, 'H pakt het wapen weer en stopt de GPS weg', JSON.stringify(hand.h));
ok(hand.lees.dichter > 0.03 && hand.lees.hoger > 0.02 && !hand.lees.richt, 'de rechtermuisknop houdt de GPS dichterbij om te lezen, richten doet hij niet', JSON.stringify(hand.lees));
ok(hand.scherm > 0, 'het scherm wordt bijgewerkt', `${hand.scherm}`);
ok(!hand.binnen && hand.binnenN === false && !hand.drone && !hand.wegNa, 'binnen en met de drone gaat de GPS weg (en binnen niet aan)', JSON.stringify({ b: hand.binnen, n: hand.binnenN, d: hand.drone }));
const Gd = hand.goud;
ok(Gd.staal >= 5 && Gd.goud >= 7 && Gd.zelfde, 'de gouden M1: elk stalen deel krijgt het doek van goud, metalness 1, met glans- en reliëfkaart', JSON.stringify({ staal: Gd.staal, goud: Gd.goud }));
ok(Gd.kleur.every(([r, g, b]) => r > 200 && g > 150 && g < r && b < 150), 'het doek is goud van kleur', JSON.stringify(Gd.kleur));
ok(Gd.ruw.every(w => w < 110), 'en glad gepolijst (ruwheid onder 0,43)', JSON.stringify(Gd.ruw));
ok(hand.terugStaal === 0, 'zonder goud weer het geparkeerde staal');

kop('9. geen nieuw shaderprogramma');
const sh = await page.evaluate(async () => {
  const g = window.__game, R = g.renderer, C = g.geocache, P = g.player;
  for (let i = 0; i < 600 && !(R.info.programs && R.info.programs.length > 20); i++) await new Promise(r => setTimeout(r, 100));
  // eerst alles zonder de nieuwe dingen (de tegenproef), dan met
  const beelden = [];
  const st = C.stand;
  for (const c of st.caches) beelden.push([c.plek.x + 2, 1.4, c.plek.z + 2, c.plek.x, 0.2, c.plek.z]);
  const sp = g.studio.plekken.stoep; beelden.push([sp.x + 4, 1.7, sp.z + 4, sp.x, 1.2, sp.z]);
  const nieuw = [...C.posters, ...(st.caches.map(() => null))];
  const dingen = [];
  g.scene.traverse(o => { if (o.isMesh && (C.posters.includes(o))) dingen.push(o); });
  const kist = []; for (const c of g.scene.children) if (c.userData && c.userData.deksel) kist.push(c);
  const alles = [...dingen, ...kist, C.bordje, C.sjors && C.sjors.groep].filter(Boolean);
  const was = alles.map(o => o.visible);
  const teken = () => { for (const b of beelden) { g.camera.position.set(b[0], b[1], b[2]); g.camera.lookAt(b[3], b[4], b[5]); g.camera.updateMatrixWorld(true); R.render(g.scene, g.camera); } };
  alles.forEach(o => { o.visible = false; }); teken();
  P.zetWapen && P.zetWapen('pistool'); P.wisselT = 0; g.tekenWapen && g.tekenWapen();
  const voor = R.info.programs.length;
  alles.forEach((o, i) => { o.visible = true; }); teken();
  P.zetWapen('garand'); P.wisselT = 0; P.holster = 0; for (let i = 0; i < 4; i++) { P.update(0.05); P.gun.visible = true; g.tekenWapen && g.tekenWapen(); }
  // (stap 197) en de GPS in je hand
  if (!C.aan) C.wissel(); for (let i = 0; i < 10; i++) C.update(0.05); g.tekenWapen && g.tekenWapen();
  if (C.aan) C.wissel();
  alles.forEach((o, i) => { o.visible = was[i]; });
  return { voor, na: R.info.programs.length };
});
ok(sh.na === sh.voor, 'posters, kistjes, het bordje, Sjors, de gouden M1 en de GPS in je hand vertalen niets nieuws', `${sh.voor} → ${sh.na}`);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);

/*
 De politie slimmer (stap 144, js/politieslim.js en js/politie.js): npm run politieslimtest.

 1. Het zicht: overdag 42 m, 's nachts 20, onder een lantaarn 34, in de bundel van een zaklamp 32, regen een vijfde
    minder; gehurkt in een struik 2,5 m, staand erin een derde, in het bos de helft, gehurkt nog minder.
 2. Verstoppen gemeten aan een echte struik uit de kaart: staand erin zien ze je op 6 m, gehurkt niet, op 2 m wel;
    gehurkt achter een bosje ook niet; gehurkt in het open wel. Het bos aan echte bomen. De heli ziet je in een struik niet.
 3. 's Nachts: een agent ziet je op 25 m in de bundel van zijn zaklamp wel, ernaast niet; overdag allebei.
 4. Raak schieten: de eerste schoten vaker mis, rennen/rijden/gedekt minder, stil in het open meer, nooit boven 0,8.
 5. Dekking: een plek waar de agent gehurkt gedekt zit en staand (of een stap opzij) de speler ziet; in het spel gaat
    hij er zitten, komt omhoog voor een schot en schiet nooit vanuit zijn dekking.
 6. Gericht zoeken: de zoekpunten liggen in de richting waarin je verdween, en mijden vakken die net doorzocht zijn.
 7. De looproute: een agent komt in een achtertuin waar hij over de straat niet in kwam.
 8. Terug naar de auto: helemaal uit beeld lopen ze terug, stappen in en rijden weer mee.
 9. Rammen, insluiten, omsingelen.
10. De hud zegt VERSTOPT; de zaklamp vangt geen kogels; 's nachts geen nieuwe shader.

 Gebruik: npm run server &  node tools/politieslimtest.mjs 8123
*/
import { chromium } from 'playwright';

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
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 600000 });
await page.evaluate(async () => {
  const { KAART } = await import('./js/kaart.js');
  window.__S = await import('./js/politieslim.js');
  window.__W = await import('./js/world.js');
  window.__L = await import('./js/looppad.js');
  window.__KW = await import('./js/kaartwereld.js');
  window.__K = KAART;
  window.__THREE = await import('three');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = false;
  window.__autoplay = false;
  // dezelfde plek als tools/politietest.mjs: het stuk Molenkrite het dichtst bij de nulmeter
  const as = KAART.wegassen.filter(w => w.drive && w.naam === 'Molenkrite' && w.lengte > 60)
    .sort((p, q) => {
      const m = (w) => { const t = w.pts[Math.floor(w.pts.length / 2)]; return Math.hypot(t[0], t[1]); };
      return m(p) - m(q);
    })[0];
  const a = as.pts[Math.floor(as.pts.length / 2)];
  const b = as.pts[Math.min(as.pts.length - 1, Math.floor(as.pts.length / 2) + 3)];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  window.__pd = { x: a[0], z: a[1] };
  window.__langs = { x: (b[0] - a[0]) / L, z: (b[1] - a[1]) / L };
  window.__zet = (x, z, hurk = 0) => {
    g.player.inCar = null;
    g.player.pos.set(x, 0, z); g.player.hurk = hurk;
    g.player.health = 100; g.hud.zetLeven(100);
  };
  window.__dag = () => { g.sfeer.uur = 12; g.sfeer.weer = 'helder'; for (let i = 0; i < 3; i++) g.sfeer.update(0.1, window.__pd.x, window.__pd.z); };
  window.__nacht = () => { g.sfeer.uur = 1; g.sfeer.weer = 'helder'; for (let i = 0; i < 3; i++) g.sfeer.update(0.1, window.__pd.x, window.__pd.z); };
  window.__stap = (n, dt = 1 / 30, elk = null) => {
    let schade = 0;
    for (let i = 0; i < n; i++) { if (elk) elk(i); schade += g.politie.update(dt); }
    return schade;
  };
  window.__schoon = () => { g.politie.reset(); g.politie.proefStil = true; g.player.hurk = 0; window.__dag(); };
  window.__schoon();
});

// ---------- 1. het zicht als getal ----------
kop('hoe ver ze zien');
const zicht = await page.evaluate(() => {
  const { zichtAfstand } = window.__S;
  const open = { struik: false, bos: false, kroon: false, lamp: false };
  return {
    dag: zichtAfstand({ v: open }),
    nacht: zichtAfstand({ v: open, nacht: true }),
    lamp: zichtAfstand({ v: { ...open, lamp: true }, nacht: true }),
    bundel: zichtAfstand({ v: open, nacht: true, inBundel: true }),
    regen: zichtAfstand({ v: open, zwaar: 2 }),
    struikH: zichtAfstand({ v: { ...open, struik: true }, hurk: 1 }),
    struikS: zichtAfstand({ v: { ...open, struik: true } }),
    bosS: zichtAfstand({ v: { ...open, bos: true } }),
    bosH: zichtAfstand({ v: { ...open, bos: true }, hurk: 1 }),
    hurk: zichtAfstand({ v: open, hurk: 1 }),
    ren: zichtAfstand({ v: open, vaart: 6 }),
    autoNacht: zichtAfstand({ v: open, nacht: true, inAuto: true }),
  };
});
ok(zicht.dag === 42, 'overdag 42 m, zoals altijd', zicht.dag);
ok(zicht.nacht === 20 && zicht.lamp === 34 && zicht.bundel === 32, "'s nachts 20, onder een lantaarn 34, in de zaklamp 32",
  `${zicht.nacht} / ${zicht.lamp} / ${zicht.bundel}`);
ok(Math.abs(zicht.regen - 33.6) < 0.01, 'regen haalt er een vijfde af', zicht.regen.toFixed(1));
ok(zicht.struikH === 2.5 && Math.abs(zicht.struikS - 14.7) < 0.01, 'gehurkt in een struik 2,5 m, staand erin 14,7',
  `${zicht.struikH} / ${zicht.struikS.toFixed(1)}`);
ok(zicht.bosS < 25 && zicht.bosH < 13 && zicht.bosH < zicht.bosS, 'in het bos de helft, gehurkt minder dan een derde',
  `${zicht.bosS.toFixed(1)} / ${zicht.bosH.toFixed(1)}`);
ok(zicht.hurk < 42 && zicht.ren === 42, 'gehurkt minder, rennen niet verder dan het gewone zicht', `${zicht.hurk.toFixed(1)} / ${zicht.ren}`);
ok(zicht.autoNacht === 36, "een auto zien ze 's nachts aan zijn lampen", zicht.autoNacht);

// ---------- 2. verstoppen aan een echte struik ----------
kop('verstoppen');
const struik = await page.evaluate(() => {
  const g = window.__game, P = g.politie, K = window.__K, W = window.__W, S = window.__S, KW = window.__KW;
  const pd = window.__pd;
  window.__schoon();
  // een struik die los staat (geen andere binnen zes meter), op een plek waar je kunt staan, met vrij zicht van 6 m
  const kand = K.struiken.filter(s => Math.hypot(s.x - pd.x, s.z - pd.z) < 600)
    .sort((a, b) => Math.hypot(a.x - pd.x, a.z - pd.z) - Math.hypot(b.x - pd.x, b.z - pd.z));
  for (const s of kand) {
    if (K.struiken.some(t => t !== s && Math.hypot(t.x - s.x, t.z - s.z) < 6)) continue;
    if (KW.inPand(s.x, s.z) || KW.geenGroen(s.x, s.z)) continue;
    const [rx, rz] = W.resolveCollisions(s.x, s.z, 0.34);
    if (Math.hypot(rx - s.x, rz - s.z) > 0.05) continue;
    for (let k = 0; k < 8; k++) {
      const h = k * Math.PI / 4, ux = Math.cos(h), uz = Math.sin(h);
      const ax = s.x + ux * 6, az = s.z + uz * 6;
      const [bx, bz] = W.resolveCollisions(ax, az, 0.34);
      if (Math.hypot(bx - ax, bz - az) > 0.05) continue;
      if (!W.zichtVrij(ax, az, s.x, s.z, 0.5)) continue;
      // en een open plek acht meter de andere kant op, zonder struik in de buurt
      const ox = s.x - uz * 8, oz = s.z + ux * 8;
      if (K.struiken.some(t => Math.hypot(t.x - ox, t.z - oz) < 5)) continue;
      if (!W.zichtVrij(ox + ux * 6, oz + uz * 6, ox, oz, 0.5)) continue;
      const kijk = (px, pz, tx, tz) => Math.atan2(-(tx - px), -(tz - pz));
      const r = { s, ux, uz };
      const ziet = (afst, hurk, cx = s.x, cz = s.z) => {
        window.__zet(cx, cz, hurk); P.update(0.001);
        const pos = { x: cx + ux * afst, z: cz + uz * afst };
        return P.zietSpeler(pos, kijk(pos.x, pos.z, cx, cz), false, false);
      };
      r.staand6 = ziet(6, 0); r.gehurkt6 = ziet(6, 1); r.gehurkt2 = ziet(2, 1);
      r.verstop = S.verstop(s.x, s.z);
      r.hud = (() => {
        window.__zet(s.x, s.z, 1); P.zetHeat(40); P.update(0.001);
        g.hud.zetVerstopt(P.gezocht && P.verstopt);
        const el = document.getElementById('verstopt');
        const aan = getComputedStyle(el).display !== 'none' && el.textContent === 'VERSTOPT';
        window.__zet(ox, oz, 0); P.update(0.001); g.hud.zetVerstopt(P.gezocht && P.verstopt);
        const uit = getComputedStyle(el).display === 'none';
        P.reset(); P.proefStil = true;
        return { aan, uit };
      })();
      r.openGehurkt6 = ziet(6, 1, ox, oz);
      // achter een bosje: gehurkt op 1,6 m achter de struik, de agent aan de andere kant
      const ax2 = s.x - ux * 1.6, az2 = s.z - uz * 1.6;
      const achter = W.resolveCollisions(ax2, az2, 0.34);
      r.achterVrij = Math.hypot(achter[0] - ax2, achter[1] - az2) < 0.05;
      r.lijn = S.struikOpLijn(s.x + ux * 9, s.z + uz * 9, ax2, az2, 1);
      r.lijnStaand = S.struikOpLijn(s.x + ux * 9, s.z + uz * 9, ax2, az2, 0);
      return r;
    }
  }
  return null;
});
ok(!!struik, 'een losse struik gevonden in Tinga', struik ? `${struik.s.x.toFixed(0)}, ${struik.s.z.toFixed(0)}` : 'geen');
if (struik) {
  ok(struik.verstop.struik, 'daar sta je in de struik');
  ok(struik.staand6, 'staand in de struik zien ze je op 6 m');
  ok(!struik.gehurkt6, 'gehurkt in de struik niet');
  ok(struik.gehurkt2, 'op 2 m wel');
  ok(struik.openGehurkt6, 'gehurkt in het open zien ze je op 6 m gewoon');
  ok(struik.lijn && !struik.lijnStaand, 'gehurkt achter een bosje houdt het de kijklijn tegen, staand niet');
  ok(struik.hud.aan && struik.hud.uit, 'de hud zegt VERSTOPT in de struik, en niet in het open');
}
const bos = await page.evaluate(() => {
  const W = window.__W, S = window.__S;
  // de dichtste plek in de bomen: tel per boom zijn buren
  const T = W.treePositions;
  let beste = null, n = 0;
  for (let i = 0; i < T.length; i += 7) {
    const t = T[i]; let k = 0;
    for (let j = 0; j < T.length; j++) if (Math.abs(T[j].x - t.x) < 8 && Math.abs(T[j].z - t.z) < 8 && Math.hypot(T[j].x - t.x, T[j].z - t.z) < 8) k++;
    if (k > n) { n = k; beste = t; }
    if (n > 12) break;
  }
  const v = beste ? S.verstop(beste.x + 1.5, beste.z + 1.5) : null;
  return { n, v, ver: S.verstop(window.__pd.x, window.__pd.z) };
});
ok(bos.v && bos.v.bos, 'tussen de bomen telt als bos', `${bos.n} bomen binnen 8 m, ${bos.v && bos.v.bomen} bij het punt`);
ok(!bos.ver.bos && !bos.ver.struik, 'midden op de Molenkrite niet');

// ---------- 3. de nacht en de zaklamp ----------
kop("'s nachts");
const nacht = await page.evaluate(() => {
  const g = window.__game, P = g.politie, W = window.__W, S = window.__S, pd = window.__pd, l = window.__langs;
  window.__schoon();
  window.__nacht();
  const isNacht = g.sfeer.nacht;
  // een plek langs de weg zonder lantaarn en met vrij zicht over 25 m
  for (let d = 0; d < 120; d += 3) {
    const px = pd.x + l.x * d, pz = pd.z + l.z * d;
    const ax = px + l.x * 25, az = pz + l.z * 25;
    if (!W.zichtVrij(ax, az, px, pz, 0.6)) continue;
    window.__zet(px, pz, 0); P.update(0.001);
    if (P.intern.verstopNu.lamp) continue;
    const yaw = Math.atan2(-(px - ax), -(pz - az));
    const op = P.zietSpeler({ x: ax, z: az }, yaw, false, true);
    const naast = P.zietSpeler({ x: ax, z: az }, yaw + 0.6, false, true);
    const zonder = P.zietSpeler({ x: ax, z: az }, yaw, false, false);
    window.__dag(); P.update(0.001);
    const dagOp = P.zietSpeler({ x: ax, z: az }, yaw, false, true), dagNaast = P.zietSpeler({ x: ax, z: az }, yaw + 0.6, false, true);
    // de zaklamp aan een agent
    const a = P.proef.agent(ax, az);
    window.__nacht(); P.update(0.001);
    const lampAan = a.zaklamp.visible && a.zaklamp.material.opacity > 0;
    window.__dag(); P.update(0.001);
    const lampUit = !a.zaklamp.visible || a.zaklamp.material.opacity === 0;
    return { isNacht, op, naast, zonder, dagOp, dagNaast, lampAan, lampUit, d };
  }
  return { isNacht, geen: true };
});
ok(nacht.isNacht, "het is nacht (01:00)");
ok(!nacht.geen, 'een stuk weg zonder lantaarn met 25 m vrij zicht');
if (!nacht.geen) {
  ok(nacht.op && !nacht.naast, "op 25 m in de bundel van zijn zaklamp ziet hij je, 0,6 rad ernaast niet");
  ok(!nacht.zonder, 'zonder zaklamp ook niet');
  ok(nacht.dagOp && nacht.dagNaast, 'overdag allebei wel');
  ok(nacht.lampAan && nacht.lampUit, "de zaklamp brandt 's nachts en niet overdag");
}

// ---------- 4. raak schieten ----------
kop('raak schieten');
const raak = await page.evaluate(() => {
  const { raakKans } = window.__S;
  const b = { d: 12, richtT: 3 };
  return {
    eerst: raakKans({ ...b, richtT: 0 }), later: raakKans(b),
    stil: raakKans({ ...b, vaart: 0 }), ren: raakKans({ ...b, vaart: 6 }),
    autoTraag: raakKans({ ...b, inAuto: true, vaart: 5 }), autoSnel: raakKans({ ...b, inAuto: true, vaart: 25 }),
    gedekt: raakKans({ ...b, gedekt: true }), hurk: raakKans({ ...b, hurk: 1 }),
    onder: raakKans({ ...b, onderdrukt: true }), donker: raakKans({ ...b, donker: true }),
    max: raakKans({ d: 0, richtT: 9 }), oud: Math.max(0.14, 0.58 - 12 * 0.0105),
  };
});
ok(raak.eerst < raak.later * 0.5, 'het eerste schot op een nieuw doel gaat vaker mis', `${raak.eerst.toFixed(2)} tegen ${raak.later.toFixed(2)}`);
ok(raak.ren < raak.stil * 0.6, 'wie rent is lastiger te raken dan wie stilstaat', `${raak.ren.toFixed(2)} tegen ${raak.stil.toFixed(2)}`);
ok(raak.stil > raak.oud, 'stil in het open makkelijker dan vroeger', `${raak.stil.toFixed(2)} tegen ${raak.oud.toFixed(2)}`);
ok(raak.autoSnel < raak.autoTraag, 'een snelle auto lastiger dan een langzame', `${raak.autoSnel.toFixed(2)} tegen ${raak.autoTraag.toFixed(2)}`);
ok(raak.gedekt < raak.stil * 0.6 && raak.hurk < raak.stil && raak.onder < raak.stil && raak.donker < raak.stil,
  'gedekt, gehurkt, onder vuur en in het donker minder');
ok(raak.max <= 0.8, 'nooit boven 0,8', raak.max.toFixed(2));

// ---------- 5. dekking ----------
kop('dekking');
const dek = await page.evaluate(() => {
  const g = window.__game, P = g.politie, W = window.__W, S = window.__S, pd = window.__pd;
  window.__schoon();
  // een speler midden op straat, een agent op 12–20 m: waar vindt hij dekking?
  let gevonden = null, spelerPlek = null, agentPlek = null, pogingen = 0;
  const kandidaten = [];
  for (let r = 0; r < 160 && !gevonden; r += 10) for (let k = 0; k < 6 && !gevonden; k++) {
    const sx = pd.x + Math.cos(k + r) * r, sz = pd.z + Math.sin(k + r) * r;
    const [qx, qz] = W.resolveCollisions(sx, sz, 0.4);
    if (Math.hypot(qx - sx, qz - sz) > 0.05) continue;
    for (let j = 0; j < 6 && !gevonden; j++) {
      const h = j * 1.05, ax = sx + Math.cos(h) * 16, az = sz + Math.sin(h) * 16;
      const [bx, bz] = W.resolveCollisions(ax, az, 0.4);
      if (Math.hypot(bx - ax, bz - az) > 0.05 || !W.zichtVrij(ax, az, sx, sz, 1.3)) continue;
      pogingen++;
      const d = S.zoekDekking({ x: ax, z: az }, { x: sx, z: sz }, { pogingen: 30 });
      if (d) { gevonden = d; spelerPlek = { x: sx, z: sz }; agentPlek = { x: ax, z: az }; }
    }
  }
  if (!gevonden) return { pogingen };
  const sp = spelerPlek;
  const laagDicht = !W.zichtVrij(gevonden.x, gevonden.z, sp.x, sp.z, 0.7);
  const staandZiet = W.zichtVrij(gevonden.x, gevonden.z, sp.x, sp.z, 1.45) || (gevonden.piek && W.zichtVrij(gevonden.piek.x, gevonden.piek.z, sp.x, sp.z, 1.3));
  // in het spel: een agent op jacht, twee sterren
  window.__zet(sp.x, sp.z, 0);
  P.zetSter(2, sp.x, sp.z);
  const a = P.proef.agent(agentPlek.x, agentPlek.z);
  a.rol = 'aanval'; a.staat = 'jacht'; a.mp = false;
  let laagGezien = false, opGezien = false, schotLaag = 0, schoten = 0, minD = Infinity, hadDekking = false;
  const vuur = a.persoon.vuur.bind(a.persoon);
  a.persoon.vuur = (...x) => { schoten++; if (a.laag) schotLaag++; return vuur(...x); };
  window.__stap(300, 1 / 30, () => {
    window.__zet(sp.x, sp.z, 0);
    if (a.dekking) {
      hadDekking = true;
      minD = Math.min(minD, Math.hypot(a.persoon.groep.position.x - a.dekking.x, a.persoon.groep.position.z - a.dekking.z));
      if (a.laag) laagGezien = true; else if (minD < 1.5) opGezien = true;
    }
  });
  window.__schoon();
  return { pogingen, laagDicht, staandZiet: !!staandZiet, piek: !!gevonden.piek, hadDekking, minD, laagGezien, opGezien, schotLaag, schoten };
});
ok(!!dek.laagDicht, 'een dekkingsplek gevonden: gehurkt ziet hij de speler niet', `na ${dek.pogingen} plekken${dek.piek ? ', met een stap opzij' : ''}`);
ok(dek.staandZiet, 'staand (of een stap opzij) wel');
ok(dek.hadDekking && dek.minD < 1.5, 'in het spel gaat de agent naar zijn dekking', dek.minD != null ? `${(+dek.minD).toFixed(2)} m` : '');
ok(dek.laagGezien && dek.opGezien, 'hij zit laag en komt omhoog', `laag ${dek.laagGezien}, op ${dek.opGezien}`);
ok(dek.schotLaag === 0, 'en schiet nooit vanuit zijn dekking', `${dek.schoten} schoten, ${dek.schotLaag} laag`);

// ---------- 6. gericht zoeken ----------
kop('gericht zoeken');
const zoek = await page.evaluate(() => {
  const g = window.__game, P = g.politie, pd = window.__pd;
  window.__schoon();
  window.__zet(pd.x + 900, pd.z + 900, 0);
  P.zetSter(2, pd.x, pd.z);
  const G = P.intern.geheugen;
  const richting = () => {
    let som = 0;
    for (let i = 0; i < 40; i++) { const e = {}; const p = P.nieuwZoekpunt(e); som += (p.x - pd.x) / (Math.hypot(p.x - pd.x, p.z - pd.z) || 1); }
    return som / 40;
  };
  // welk deel van de zoekpunten valt in vakken die net doorzocht zijn?
  const inVers = () => {
    let n = 0;
    for (let i = 0; i < 60; i++) { const p = P.nieuwZoekpunt({}); if (G.vers(p.x, p.z) > 0.5) n++; }
    return n / 60;
  };
  const zonder = richting();
  G.verdween(pd.x, pd.z, 1, 0);           // naar het oosten verdwenen
  const oost = richting();
  // en nu het oosten net doorzocht, zonder vluchtrichting: hoeveel punten vallen er nog in?
  G.vlucht = null;
  G.wis();
  const oostDeel = (() => { let n = 0; for (let i = 0; i < 60; i++) { const p = P.nieuwZoekpunt({}); if (p.x > pd.x) n++; } return n / 60; })();
  for (let x = 0; x < 260; x += 10) for (let z = -260; z < 260; z += 10) G.stempel(pd.x + x, pd.z + z);
  const doorzocht = inVers();
  window.__schoon();
  return { zonder, oost, oostDeel, doorzocht };
});
ok(zoek.oost > 0.35 && zoek.oost > zoek.zonder + 0.25, 'eerst zoeken ze in de richting waarin je verdween',
  `gemiddeld ${zoek.oost.toFixed(2)} naar het oosten, zonder richting ${zoek.zonder.toFixed(2)}`);
ok(zoek.doorzocht < zoek.oostDeel * 0.6, 'een kant die net doorzocht is laten ze zoveel mogelijk liggen',
  `${Math.round(zoek.doorzocht * 100)} % van de punten in doorzochte vakken, tegen ${Math.round(zoek.oostDeel * 100)} % daarvoor`);

// ---------- 7. de looproute ----------
kop('de looproute');
const tuin = await page.evaluate(() => {
  const g = window.__game, P = g.politie, K = window.__K, W = window.__W, Lp = window.__L, pd = window.__pd;
  window.__schoon();
  window.__zet(pd.x + 900, pd.z + 900, 0);
  P.zetSter(1, pd.x + 900, pd.z + 900);
  // een tuin achter de huizen: over de straat moet je eromheen
  const tuinen = (K.tuinvlakken || []).map(t => {
    // (een tuinvlak is één ring [[x, z], …], soms in een lijst van ringen)
    const r = Array.isArray(t.r[0][0]) ? t.r[0] : t.r; let x = 0, z = 0; for (const p of r) { x += p[0]; z += p[1]; }
    return { x: x / r.length, z: z / r.length };
  }).filter(t => Math.hypot(t.x - pd.x, t.z - pd.z) < 600)
    .sort((p, q) => Math.hypot(p.x - pd.x, p.z - pd.z) - Math.hypot(q.x - pd.x, q.z - pd.z));
  for (const t of tuinen) {
    const [tx, tz] = W.resolveCollisions(t.x, t.z, 0.4);
    if (Math.hypot(tx - t.x, tz - t.z) > 0.05 || W.pointInWater(tx, tz)) continue;
    // een start op de rijbaan, 20 tot 40 m verderop, zonder vrij zicht op de tuin
    for (const w of K.wegassen) {
      if (!w.drive) continue;
      for (const p of w.pts) {
        const d = Math.hypot(p[0] - tx, p[1] - tz);
        if (d < 20 || d > 40 || W.zichtVrij(p[0], p[1], tx, tz, 0.5)) continue;
        const pad = Lp.zoekLooppad({ x: p[0], z: p[1] }, { x: tx, z: tz });
        if (!pad) continue;
        let L = 0; for (let i = 1; i < pad.length; i++) L += Math.hypot(pad[i][0] - pad[i - 1][0], pad[i][1] - pad[i - 1][1]);
        if (L < d * 1.25) continue;
        const a = P.proef.agent(p[0], p[1]);
        a.staat = 'zoekt'; a.doel = { x: tx, z: tz }; a.zoekT = 120; a.wacht = 0;
        let min = Infinity;
        window.__stap(900, 1 / 15, () => {
          const q = a.persoon.groep.position;
          min = Math.min(min, Math.hypot(q.x - tx, q.z - tz));
          if (min < 3) a.zoekT = 120;
        });
        window.__schoon();
        return { min, d, L, start: p, tuin: [tx, tz] };
      }
    }
  }
  return null;
});
ok(!!tuin, 'een achtertuin waar je van de straat omheen moet', tuin ? `${tuin.d.toFixed(0)} m hemelsbreed, ${tuin.L.toFixed(0)} m lopen` : '');
if (tuin) ok(tuin.min < 3, 'een zoekende agent komt in die tuin', `${tuin.min.toFixed(1)} m van het punt`);

// ---------- 8. terug naar de auto ----------
kop('terug naar de auto');
const terug = await page.evaluate(() => {
  const g = window.__game, P = g.politie, pd = window.__pd, l = window.__langs;
  window.__schoon();
  window.__zet(pd.x + l.x * 12, pd.z + l.z * 12, 0);
  P.zetSter(3, pd.x, pd.z);
  const w = P.proef.wagen(pd.x, pd.z, Math.atan2(-l.x, -l.z));
  const car = w.car;
  // ze zijn uitgestapt en lopen te zoeken
  w.agenten.forEach((a, i) => {
    a.persoon.zetNeer(pd.x + l.z * (i ? 2 : -2) + l.x * 8, pd.z - l.x * (i ? 2 : -2) + l.z * 8, 0);
    a.persoon.groep.visible = true; a.staat = 'zoekt'; a.doel = { x: pd.x + l.x * 30, z: pd.z + l.z * 30 };
  });
  const bemanning = [...w.agenten];
  P.proef.verlaat(w);
  // de speler rijdt weg: ze zagen hem in een auto, en dan helemaal uit beeld
  const auto = g.vehicles.voegToe({ x: pd.x + l.x * 20, z: pd.z + l.z * 20, yaw: Math.atan2(-l.x, -l.z), soort: 'hatch', kleur: 0x884422, driveable: true });
  g.player.inCar = auto;
  for (const a of bemanning) { a.staat = 'jacht'; a.zicht = true; }
  P.update(1 / 30);
  const ver = { x: pd.x + 700, z: pd.z + 700 };
  auto.x = ver.x; auto.z = ver.z; if (auto.mesh) auto.mesh.position.set(ver.x, 0, ver.z);
  const staten = new Set();
  let weer = null, t = 0;
  window.__stap(30 * 30, 1 / 30, (i) => {
    t = i / 30;
    for (const a of bemanning) staten.add(a.staat);
    if (!weer) weer = P.intern.wagens.find(x => x.car === car) || null;
  });
  const res = {
    staten: [...staten], weer: !!weer, inWagen: weer ? weer.agenten.length : 0,
    verborgen: bemanning.every(a => !a.persoon.groep.visible), nietTeStelen: car.driveable === false,
    vluchtInAuto: P.intern.vluchtInAuto, ster: P.ster,
  };
  g.player.inCar = null;
  g.vehicles.verwijder ? g.vehicles.verwijder(auto) : null;
  window.__schoon();
  return res;
});
ok(terug.vluchtInAuto, 'ze zagen je wegrijden');
ok(terug.staten.includes('naarAuto') && terug.staten.includes('inAuto'), 'uit beeld lopen ze terug en stappen in', terug.staten.join(', '));
ok(terug.weer && terug.inWagen === 2 && terug.verborgen && terug.nietTeStelen, 'en de wagen rijdt weer mee, met hen erin',
  `${terug.inWagen} in de wagen, nog ${terug.ster} sterren`);

// ---------- 9. rammen, insluiten, omsingelen ----------
kop('rammen, insluiten, omsingelen');
const ram = await page.evaluate(() => {
  const g = window.__game, P = g.politie, pd = window.__pd, l = window.__langs, V = g.vehicles;
  const yaw = Math.atan2(-l.x, -l.z);
  const proef = (sterren, vaart, tweede) => {
    window.__schoon();
    const auto = V.voegToe({ x: pd.x + l.x * 6, z: pd.z + l.z * 6, yaw, soort: 'hatch', kleur: 0x226688, driveable: true });
    g.player.inCar = auto; g.player.pos.set(auto.x, 0, auto.z);
    P.zetSter(sterren, auto.x, auto.z);
    const w = P.proef.wagen(pd.x - l.x * 22, pd.z - l.z * 22, yaw);
    w.staat = 'jacht';
    const w2 = tweede ? P.proef.wagen(pd.x + l.x * 50 + l.z * 8, pd.z + l.z * 50 - l.x * 8, yaw + Math.PI) : null;
    if (w2) w2.staat = 'jacht';
    let ramt = false, sluit = false, klap = null, uit = false;
    window.__stap(9 * 30, 1 / 30, () => {
      auto.speed = vaart; auto.x += l.x * vaart / 30; auto.z += l.z * vaart / 30;
      if (auto.mesh) auto.mesh.position.set(auto.x, auto.mesh.position.y, auto.z);
      g.player.pos.set(auto.x, 0, auto.z);
      if (w.ramt) ramt = true;
      if (w2 && w2.sluit) sluit = true;
      const r = P.pakRam(); if (r && !klap) klap = r;
      if (w.agenten.some(a => a.persoon.groep.visible)) uit = true;
    });
    g.player.inCar = null;
    V.verwijder ? V.verwijder(auto) : null;
    return { ramt, sluit, klap, uit };
  };
  const a = proef(2, 5, false);
  const b = proef(3, 3, true);
  const c = proef(1, 5, false);
  // omsingelen: drie wagens, ze raken je kwijt
  window.__schoon();
  window.__zet(pd.x + 900, pd.z + 900, 0);
  P.zetSter(3, pd.x, pd.z);
  for (let i = 0; i < 3; i++) { const w = P.proef.wagen(pd.x + l.x * 10 * i, pd.z + l.z * 10 * i, yaw); w.staat = 'jacht'; }
  P.intern.geheugen.verdween(pd.x, pd.z, l.x, l.z);
  const n = P.omsingel();
  const posten = P.intern.wagens.filter(w => w.staat === 'post').map(w => Math.hypot(w.doel.x - pd.x, w.doel.z - pd.z));
  window.__schoon();
  return { a, b, c, n, posten };
});
ok(ram.a.ramt, 'twee sterren, je rijdt langzaam: de wagen gaat rammen');
ok(!!ram.a.klap && ram.a.klap.kracht > 2.5, 'en raakt je', ram.a.klap ? `klap ${ram.a.klap.kracht.toFixed(1)} m/s` : 'geen klap');
ok(!ram.a.uit, 'ze stappen niet uit zolang je rijdt');
ok(ram.b.sluit, 'drie sterren, je staat bijna stil: een tweede wagen zet je klem');
ok(!ram.c.ramt, 'bij één ster rammen ze niet');
ok(ram.n >= 1 && ram.posten.length >= 1 && ram.posten.every(d => d >= 45 && d < 170), 'kwijt bij drie sterren: wagens posten op de kruisingen eromheen',
  `${ram.n} posten op ${ram.posten.map(d => d.toFixed(0)).join(', ')} m`);

// ---------- 10. de zaklamp, de heli en de shaders ----------
kop('zaklamp, heli, shaders');
const rest = await page.evaluate(() => {
  const g = window.__game, P = g.politie, pd = window.__pd, l = window.__langs, R = g.renderer;
  window.__schoon();
  window.__nacht();
  const a = P.proef.agent(pd.x, pd.z);
  a.persoon.zetNeer(pd.x, pd.z, Math.atan2(-l.x, -l.z));
  P.update(0.001);
  g.scene.updateMatrixWorld(true);
  // een kogel recht door de bundel (voor de agent langs, op een meter of vijf) raakt niets van de zaklamp
  const THREE = window.__THREE;
  let raakLamp = false;
  if (THREE) {
    const rc = new THREE.Raycaster(new THREE.Vector3(pd.x + l.z * 4 + l.x * 5, 1.1, pd.z - l.x * 4 + l.z * 5), new THREE.Vector3(-l.z, 0, l.x));
    const h = rc.intersectObjects(P.doelen(), true);
    raakLamp = h.some(x => x.object.userData.zaklamp);
  }
  // shaders: een agent met zaklamp 's nachts in beeld
  let voor = null, na = null;
  if (R) {
    const P2 = g.player;
    const kijk = () => { P2.pos.set(pd.x + l.x * 8, 2, pd.z + l.z * 8); P2.yaw = Math.atan2(l.x, l.z); P2.pitch = -0.1; P2.applyCamera(); g.scene.updateMatrixWorld(true); R.render(g.scene, P2.camera); };
    a.zaklamp.visible = false; kijk();
    voor = R.info.programs.length;
    P.update(0.001); kijk(); kijk();
    na = R.info.programs.length;
  }
  window.__schoon();
  return { raakLamp, heeftThree: !!THREE, voor, na };
});
if (rest.heeftThree) ok(!rest.raakLamp, 'een kogel door de bundel raakt de zaklamp niet');
if (rest.voor != null) ok(rest.na === rest.voor, "'s nachts met de zaklamp in beeld geen nieuwe shader", `${rest.voor} → ${rest.na}`);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);

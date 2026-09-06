/*
 Toetst het sportpark aan de Molenkrite (js/sportveld.js) en de volkstuinen
 achter de Wieken (js/volkstuin.js), en de bron waar ze op staan:

   - herkent de keten de kunstgrasvelden uit de BGT ("kunststof") en liggen ze
     niet meer als grijs asfalt in de wereld?
   - staan de vier velden van VV Sneek Wit Zwart op hun eigen BGT-vlak, met de
     maten van een voetbalveld en de richting van dat vlak?
   - ligt de belijning op het veld, staan de doelen op de doellijn, en loopt de
     ring reclameborden rond het hoofdveld, met dat van Radio Spannenburg aan
     alle vier de kanten?
   - houden de borden, de ballenvanger en de lichtmasten je tegen, en kun je wel
     gewoon het veld op lopen?
   - liggen de volkstuintjes binnen het perceel, met een grasrand langs de sloot,
     paden ertussen en schuurtjes en kassen erop?
   - kun je tussen de bedden door lopen zonder vast te lopen?

 Gebruik: python3 -m http.server 8123 &  node tools/sporttest.mjs 8123
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
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(async () => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  const { KAART } = await import('/js/kaartwereld.js');
  window.__W = await import('/js/world.js');
  window.__K = KAART;
  // in een vlak zoeken: het vlak waar dit punt in ligt
  window.__inRing = (p, ring) => {
    let in_ = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) in_ = !in_;
    }
    return in_;
  };
});
await page.waitForTimeout(400);

// ---------- 1. kunstgras uit de brondata ----------
/*
 De BGT zet een kunstgrasmat neer als "gesloten verharding" met
 plus_fysiekVoorkomen "kunststof". Dat viel in de keten onder gesloten
 verharding, dus lagen de velden als grijs asfalt in het spel.
*/
kop('kunstgras komt uit de brondata');
const kg = await page.evaluate(() => {
  const K = window.__K;
  const vakken = K.vlakken.filter(v => v.k === 'kunstgras');
  const opp = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(a) / 2; };
  const groot = vakken.filter(v => opp(v.r[0]) > 4000);
  return { n: vakken.length, groot: groot.length, opp: Math.round(groot.reduce((s, v) => s + opp(v.r[0]), 0)) };
});
ok(kg.n >= 7, 'de kunstgrasvakken staan in de kaart', `${kg.n} vakken`);
ok(kg.groot === 4, 'waarvan vier hele velden: twee voetbal en twee hockey',
  `${kg.groot} van meer dan 4000 m², samen ${kg.opp} m²`);

// ---------- 2. de velden zelf ----------
kop('de velden van VV Sneek Wit Zwart');
const velden = await page.evaluate(() => {
  const K = window.__K;
  const V = K.sportvelden || [];
  const opp = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(a) / 2; };
  // ligt het midden van elk veld in een BGT-vlak van de goede soort?
  const inVlak = V.map(v => {
    const vak = K.vlakken.find(q => ['kunstgras', 'gras'].includes(q.k) && window.__inRing([v.cx, v.cz], q.r[0]));
    return vak ? { k: vak.k, opp: Math.round(opp(vak.r[0])) } : null;
  });
  // Molenkrite 132 is het adres van de club
  const club = K.panden.filter(p => Array.isArray(p.nr) && p.nr.some(n => String(n).startsWith('132')));
  const hoofd = V.find(v => v.hoofd);
  const dichtstbij = hoofd && club.length
    ? Math.min(...club.map(p => Math.hypot(p.rect.cx - hoofd.cx, p.rect.cz - hoofd.cz))) : 1e9;
  return {
    n: V.length, soorten: V.map(v => v.soort), inVlak,
    maten: V.map(v => [Math.round(v.vl), Math.round(v.vb)]),
    binnen: V.every(v => v.vl <= v.l && v.vb <= v.b),
    hoofd: !!hoofd, dichtstbij: Math.round(dichtstbij),
  };
});
ok(velden.n === 4, 'er liggen vier velden', `${velden.n}`);
ok(velden.inVlak.every(v => v), 'elk veld ligt op zijn eigen BGT-vlak',
  velden.inVlak.map(v => v ? `${v.k} ${v.opp} m²` : 'geen').join(', '));
ok(velden.soorten.filter(s => s === 'kunstgras').length === 2,
  'twee kunstgras en twee gras', velden.soorten.join(', '));
ok(velden.maten.every(([l, b]) => l >= 90 && l <= 105 && b >= 60 && b <= 68),
  'de speelvelden hebben de maat van een voetbalveld',
  velden.maten.map(m => m.join('×')).join(', '));
ok(velden.binnen, 'en ze passen binnen het vlak uit de brondata');
ok(velden.hoofd && velden.dichtstbij < 90, 'het hoofdveld ligt bij het clubgebouw Molenkrite 132',
  `${velden.dichtstbij} m`);

// ---------- 3. wat erop en eromheen staat ----------
kop('belijning, doelen en reclame');
const erop = await page.evaluate(async () => {
  const THREE = await import('/lib/three.module.js');
  const g = window.__game;
  const K = window.__K;
  const V = K.sportvelden.find(v => v.hoofd);
  let lijnen = null, banen = 0;
  const groep = g.scene.children.find(c => c.name === 'sportvelden');
  if (!groep) return { groep: false };
  groep.traverse(o => {
    if (o.userData && o.userData.klasse === 'veldlijn') lijnen = o;
    if (o.userData && o.userData.klasse === 'maaibaan') banen++;
  });
  // liggen alle lijnpunten binnen het speelveld en net boven de grond?
  const ex = Math.cos(V.hoek), ez = Math.sin(V.hoek);
  const pos = lijnen && lijnen.geometry.getAttribute('position');
  let buiten = 0, hoogte = 0, minY = 9, maxY = -9;
  if (pos) for (let i = 0; i < pos.count; i++) {
    const dx = pos.getX(i) - V.cx, dz = pos.getZ(i) - V.cz;
    const u = dx * ex + dz * ez, v = -dx * ez + dz * ex;
    // ook de lijnen van de andere drie velden zitten in deze mesh
    const eigen = Math.abs(u) < V.vl / 2 + 1.5 && Math.abs(v) < V.vb / 2 + 1.5;
    if (!eigen) continue;
    if (Math.abs(u) > V.vl / 2 + 1.2 || Math.abs(v) > V.vb / 2 + 1.2) buiten++;
    minY = Math.min(minY, pos.getY(i)); maxY = Math.max(maxY, pos.getY(i));
    hoogte++;
  }
  // de normalen van de belijning horen omhoog te wijzen, anders zie je hem niet
  const nor = lijnen && lijnen.geometry.getAttribute('normal');
  let omlaag = 0;
  if (nor) for (let i = 0; i < nor.count; i++) if (nor.getY(i) < 0.5) omlaag++;
  /*
   De doelen. Alle doelpalen en latten zitten in één mesh — per materiaal één,
   anders kost een sportpark honderden draw calls — dus we tellen geen meshes
   maar kijken of er hoekpunten staan op de vier plekken waar de palen horen:
   op de doellijn, 3,66 m links en rechts van het midden.
  */
  let paalMesh = null;
  groep.traverse(o => { if (o.userData && o.userData.klasse === 'doelpaal') paalMesh = o; });
  const palen = [];
  let latHoogte = 0;
  if (paalMesh) {
    const pp = paalMesh.geometry.getAttribute('position');
    for (const su of [-1, 1]) for (const sv of [-1, 1]) {
      const pu = su * V.vl / 2, pv = sv * 7.32 / 2;
      let n = 0;
      for (let i = 0; i < pp.count; i++) {
        const dx = pp.getX(i) - V.cx, dz = pp.getZ(i) - V.cz;
        const u = dx * ex + dz * ez, v = -dx * ez + dz * ex;
        if (Math.hypot(u - pu, v - pv) < 0.3) { n++; latHoogte = Math.max(latHoogte, pp.getY(i)); }
      }
      if (n) palen.push(n);
    }
  }
  /*
   Het net hangt achter het doel, dus buiten het speelveld. Stond het net erin,
   dan stond het doel met zijn rug naar de goede kant — dat is precies wat er een
   ronde lang mis was.
  */
  let netMesh = null;
  groep.traverse(o => { if (o.userData && o.userData.klasse === 'doelnet') netMesh = o; });
  let netBinnen = 0, netDiepst = 0;
  if (netMesh) {
    const np = netMesh.geometry.getAttribute('position');
    for (let i = 0; i < np.count; i++) {
      const dx = np.getX(i) - V.cx, dz = np.getZ(i) - V.cz;
      const u = dx * ex + dz * ez, v = -dx * ez + dz * ex;
      if (Math.abs(v) > V.vb / 2 + 4) continue;              // een net van een ander veld
      if (Math.abs(u) < V.vl / 2 - 3) continue;              // idem
      if (Math.abs(u) < V.vl / 2 - 0.05) netBinnen++;
      netDiepst = Math.max(netDiepst, Math.abs(u) - V.vl / 2);
    }
  }
  return { groep: true, lijnpunten: hoogte, buiten, minY, maxY, omlaag, banen,
    palen: palen.length, latHoogte: Math.round(latHoogte * 100) / 100,
    netBinnen, netDiepst: Math.round(netDiepst * 100) / 100 };
});
ok(erop.groep, 'de sportvelden staan in de wereld');
ok(erop.lijnpunten > 300, 'het hoofdveld heeft belijning', `${erop.lijnpunten} hoekpunten`);
ok(erop.buiten === 0, 'die helemaal binnen de zijlijnen valt', `${erop.buiten} erbuiten`);
ok(erop.maxY - erop.minY < 0.01 && erop.minY > 0.12,
  'vlak op de mat, net boven de grond', `${(erop.minY * 100).toFixed(1)} cm`);
ok(erop.omlaag === 0, 'en met de goede kant naar boven, anders zie je hem niet',
  `${erop.omlaag} driehoeken omgekeerd`);
ok(erop.banen === 2, 'er liggen maaibanen in de lengterichting', `${erop.banen} lagen`);
ok(erop.palen === 4, 'er staan twee doelen, met de palen op de doellijn', `${erop.palen} palen`);
ok(Math.abs(erop.latHoogte - (0.12 + 2.44)) < 0.12, 'met de lat op 2,44 m',
  `${erop.latHoogte} m boven maaiveld`);
ok(erop.netBinnen === 0 && erop.netDiepst > 1,
  'en met het net erachter, niet het veld in', `tot ${erop.netDiepst} m achter de doellijn`);

const reclame = await page.evaluate(() => {
  const g = window.__game;
  const V = window.__K.sportvelden.find(v => v.hoofd);
  const ex = Math.cos(V.hoek), ez = Math.sin(V.hoek);
  // botsingsdozen van 0,9 m hoog rond het hoofdveld: dat zijn de borden
  const borden = window.__W.colliders.filter(c => Math.abs(c.h - 0.9) < 0.01
    && Math.hypot(c.cx - V.cx, c.cz - V.cz) < V.vl);
  let langs = 0, kop = 0, binnen = 0;
  for (const c of borden) {
    const dx = c.cx - V.cx, dz = c.cz - V.cz;
    const u = dx * ex + dz * ez, v = -dx * ez + dz * ex;
    if (Math.abs(u) < V.vl / 2 - 1 && Math.abs(v) < V.vb / 2 - 1) binnen++;
    else if (Math.abs(v) > V.vb / 2) langs++;
    else kop++;
  }
  return { n: borden.length, langs, kop, binnen };
});
ok(reclame.n > 60, 'er staat een ring reclameborden om het hoofdveld',
  `${reclame.n} borden`);
ok(reclame.langs > 0 && reclame.kop > 0, 'langs alle vier de kanten',
  `${reclame.langs} langs de zijlijn, ${reclame.kop} achter de doelen`);
ok(reclame.binnen === 0, 'en geen enkel bord staat op het veld zelf');

/*
 Het bord van Radio Spannenburg hoort niet op één plek te staan maar rond het
 hele veld terug te komen, zoals een hoofdsponsor langs de lijn staat.
*/
const sponsor = await page.evaluate(() => {
  const g = window.__game;
  const V = window.__K.sportvelden.find(v => v.hoofd);
  const ex = Math.cos(V.hoek), ez = Math.sin(V.hoek);
  const groep = g.scene.children.find(c => c.name === 'sportvelden');
  let mesh = null;
  groep.traverse(o => { if (o.userData && o.userData.klasse === 'reclamebordSpannenburg') mesh = o; });
  if (!mesh) return { er: false };
  const pos = mesh.geometry.getAttribute('position');
  // elk bord is één rechthoek van zes hoekpunten; welke kant staat hij aan?
  const kanten = new Set();
  for (let i = 0; i < pos.count; i += 6) {
    const dx = pos.getX(i) - V.cx, dz = pos.getZ(i) - V.cz;
    const u = dx * ex + dz * ez, v = -dx * ez + dz * ex;
    kanten.add(Math.abs(v) > V.vb / 2 ? (v > 0 ? 'zuid' : 'noord') : (u > 0 ? 'oost' : 'west'));
  }
  return { er: true, n: pos.count / 6, kanten: [...kanten].sort() };
});
ok(sponsor.er, 'Radio Spannenburg staat langs de lijn');
ok(sponsor.er && sponsor.n >= 15, 'op diverse plekken rond het veld', `${sponsor.n} borden`);
ok(sponsor.er && sponsor.kanten.length === 4, 'aan alle vier de kanten',
  (sponsor.kanten || []).join(', '));

/*
 Een voetbalveld is geen gazon. De twee grasvelden zijn in de BGT
 groenvoorziening van meer dan 600 m², en dat is precies waar de parkbomenregel
 grote bomen in strooit: er stonden vijfentwintig bomen midden op het veld.
*/
const begroeiing = await page.evaluate(() => {
  const K = window.__K;
  let bomen = 0, struiken = 0, lantaarns = 0;
  for (const V of K.sportvelden) {
    const vak = K.vlakken.find(q => ['kunstgras', 'gras'].includes(q.k) && window.__inRing([V.cx, V.cz], q.r[0]));
    if (!vak) continue;
    bomen += K.bomen.filter(o => window.__inRing([o.x, o.z], vak.r[0])).length;
    struiken += K.struiken.filter(o => window.__inRing([o.x, o.z], vak.r[0])).length;
    lantaarns += K.lantaarns.filter(o => window.__inRing([o.x, o.z], vak.r[0])).length;
  }
  return { bomen, struiken, lantaarns, weg: K.telling.van_sportveld_weggehaald || 0 };
});
ok(begroeiing.bomen === 0 && begroeiing.struiken === 0 && begroeiing.lantaarns === 0,
  'er groeit niets op de velden zelf',
  `${begroeiing.bomen} bomen, ${begroeiing.struiken} struiken, ${begroeiing.lantaarns} lantaarns`);
ok(begroeiing.weg > 0, 'de generator haalt weg wat er wel op terechtkwam',
  `${begroeiing.weg} stuks`);

// ---------- 4. erlangs en erop lopen ----------
kop('over het sportpark lopen');
const lopen = await page.evaluate(() => {
  const g = window.__game;
  const V = window.__K.sportvelden.find(v => v.hoofd);
  const ex = Math.cos(V.hoek), ez = Math.sin(V.hoek);
  const wx = (u, v) => V.cx + ex * u - ez * v, wz = (u, v) => V.cz + ez * u + ex * v;
  const vrij = (u, v) => {
    const x = wx(u, v), z = wz(u, v);
    const [nx, nz] = window.__W.resolveCollisions(x, z, 0.35);
    return Math.hypot(nx - x, nz - z) < 0.02;
  };
  // midden op het veld en op tien punten eromheen: overal vrij
  let opVeld = 0;
  for (let i = 0; i < 24; i++) {
    const h = i / 24 * Math.PI * 2;
    if (vrij(Math.cos(h) * V.vl * 0.35, Math.sin(h) * V.vb * 0.35)) opVeld++;
  }
  // de bordenring hoort je wel tegen te houden
  let geblokkeerd = 0;
  for (let i = 0; i < 24; i++) {
    const h = i / 24 * Math.PI * 2;
    const u = Math.cos(h) * (V.vl / 2 + 1.6), v = Math.sin(h) * (V.vb / 2 + 1.6);
    // alleen de punten die echt op de ring liggen
    if (Math.abs(u) > V.vl / 2 + 1.2 || Math.abs(v) > V.vb / 2 + 1.2) { if (!vrij(u, v)) geblokkeerd++; }
  }
  return { opVeld, geblokkeerd };
});
ok(lopen.opVeld === 24, 'op het veld zelf loop je nergens tegenaan', `${lopen.opVeld} van 24`);
ok(lopen.geblokkeerd > 0, 'maar de reclameborden houden je wel tegen',
  `${lopen.geblokkeerd} van de punten op de ring`);

// ---------- 5. de volkstuinen ----------
kop('de volkstuinen achter de Wieken');
const tuin = await page.evaluate(() => {
  const K = window.__K;
  const C = (K.volkstuinen || [])[0];
  if (!C) return null;
  // het perceel waar ze in liggen
  const vak = K.vlakken.find(q => ['gras', 'bodembedekker', 'heesters'].includes(q.k)
    && window.__inRing([C.tuinen[0].x, C.tuinen[0].z], q.r[0]));
  const afstandTotRand = (p) => {
    let bd = 1e9;
    for (const r of vak.r) for (let i = 0; i < r.length; i++) {
      const a = r[i], b = r[(i + 1) % r.length];
      const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
      let u = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L2; u = Math.max(0, Math.min(1, u));
      bd = Math.min(bd, Math.hypot(p[0] - (a[0] + dx * u), p[1] - (a[1] + dz * u)));
    }
    return bd;
  };
  let buiten = 0, teDichtbij = 1e9;
  for (const t of C.tuinen) {
    if (!window.__inRing([t.x, t.z], vak.r[0])) buiten++;
    teDichtbij = Math.min(teDichtbij, afstandTotRand([t.x, t.z]) - Math.max(t.b, t.d) / 2);
  }
  // de Wieken 32 wees het complex aan: het hoort daar in de buurt te liggen
  const wieken = K.panden.find(p => p.straat === 'de Wieken' && Array.isArray(p.nr) && p.nr.includes('32'));
  const mid = C.tuinen.reduce((s, t) => [s[0] + t.x / C.tuinen.length, s[1] + t.z / C.tuinen.length], [0, 0]);
  return {
    naam: C.naam, n: C.tuinen.length, paden: C.paden.length,
    schuren: C.tuinen.filter(t => t.schuur).length,
    kassen: C.tuinen.filter(t => t.kas).length,
    gewassen: new Set(C.tuinen.map(t => t.gewas)).size,
    buiten, rand: Math.round(teDichtbij * 10) / 10,
    afstandWieken: wieken ? Math.round(Math.hypot(mid[0] - wieken.rect.cx, mid[1] - wieken.rect.cz)) : -1,
    perceel: Math.round(vak.r[0].length),
  };
});
ok(!!tuin, 'de kaart kent een volkstuincomplex', tuin ? tuin.naam : 'geen');
if (tuin) {
  ok(tuin.n > 40, 'er liggen tientallen tuintjes', `${tuin.n} stuks`);
  ok(tuin.buiten === 0, 'allemaal binnen het BGT-perceel', `${tuin.buiten} erbuiten`);
  ok(tuin.rand > 3, 'met een grasrand langs de sloot',
    `dichtstbijzijnde tuintje op ${tuin.rand} m van de rand`);
  ok(tuin.paden >= 3, 'er lopen paden tussen de rijen door', `${tuin.paden} paden`);
  ok(tuin.schuren > 10 && tuin.schuren < tuin.n, 'een deel van de tuintjes heeft een schuurtje',
    `${tuin.schuren} van ${tuin.n}`);
  ok(tuin.kassen > 3 && tuin.kassen < tuin.schuren, 'en een kleiner deel een kasje',
    `${tuin.kassen}`);
  ok(tuin.gewassen >= 4, 'niet elk tuintje heeft hetzelfde staan', `${tuin.gewassen} soorten`);
  ok(tuin.afstandWieken < 300, 'het complex ligt achter de Wieken 32',
    `${tuin.afstandWieken} m`);
}

const tuinLopen = await page.evaluate(() => {
  const K = window.__K;
  const C = (K.volkstuinen || [])[0];
  const g = window.__game;
  const groep = g.scene.children.find(c => c.name === 'volkstuinen');
  const soorten = new Set();
  if (groep) groep.traverse(o => { if (o.isMesh && o.userData.klasse) soorten.add(o.userData.klasse); });
  const vrij = (x, z) => {
    const [nx, nz] = window.__W.resolveCollisions(x, z, 0.32);
    return Math.hypot(nx - x, nz - z) < 0.02;
  };
  // midden op het pad hoor je vrij te lopen
  let padVrij = 0, padTotaal = 0;
  for (const p of C.paden) {
    for (let t = 0.1; t <= 0.9; t += 0.1) {
      padTotaal++;
      if (vrij(p.a[0] + (p.b[0] - p.a[0]) * t, p.a[1] + (p.b[1] - p.a[1]) * t)) padVrij++;
    }
  }
  // en midden op een bed ook: alleen de rand, de schuur en de kas houden je tegen
  let bedVrij = 0;
  for (const t of C.tuinen) if (vrij(t.x, t.z)) bedVrij++;
  // de rand van een tuintje hoort je juist wél tegen te houden
  const t0 = C.tuinen[0];
  const ex = Math.cos(t0.hoek), ez = Math.sin(t0.hoek);
  const randX = t0.x - ez * (t0.d / 2), randZ = t0.z + ex * (t0.d / 2);
  return {
    soorten: [...soorten].sort(), padVrij, padTotaal, bedVrij, tuinen: C.tuinen.length,
    randDicht: !vrij(randX, randZ),
    meshes: groep ? groep.children.length : 0,
  };
});
ok(tuinLopen.soorten.includes('moestuin') && tuinLopen.soorten.includes('volkstuinpad'),
  'de bedden en de paden liggen in de wereld', tuinLopen.soorten.join(', '));
ok(tuinLopen.padVrij === tuinLopen.padTotaal, 'over de paden loop je vrij',
  `${tuinLopen.padVrij} van ${tuinLopen.padTotaal} punten`);
ok(tuinLopen.bedVrij > tuinLopen.tuinen * 0.85, 'en tussen de bedden door ook',
  `${tuinLopen.bedVrij} van ${tuinLopen.tuinen} tuintjes`);
ok(tuinLopen.randDicht, 'maar door de haag heen loop je niet');
ok(tuinLopen.meshes < 20, 'het hele complex kost maar een handvol meshes',
  `${tuinLopen.meshes}`);

console.log(fouten ? `\n${fouten} fout(en).` : '\nAlles goed.');
await browser.close();
process.exit(fouten ? 1 : 0);

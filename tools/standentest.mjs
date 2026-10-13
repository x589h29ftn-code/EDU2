/*
 Stap 157: grafische standen en de moeilijkheidsgraad (npm run standentest). Gevraagd: "Voeg idd grafische standen
 toe. Standaard hoe het nu is maar ook optie om te verhogen en verlagen. Moeilijkheidsgraad ook goed, normaal hoe het
 nu is, dan easy en hard."

   1. normaal is het oude spel: LOD-schaal 1,4, schaduwkaart 3072, gras in 3D aan, lichamen tot 200 m, grof tot 350;
   2. laag en hoog: elk knopje de goede kant op, de schaduwkaart echt op de nieuwe maat na een schaduwpas, meer of
      minder fijne LOD-tegels rond de speler; en wisselen vertaalt geen nieuw shaderprogramma;
   3. in het menu: Instellingen heeft "Grafische stand" en "Moeilijkheid", een klik wisselt en het blijft bewaard;
   4. de moeilijkheid: een treffer van 50 kost op makkelijk 30, op normaal 50, op moeilijk 70; bier (omhoog) telt
      gewoon; het laden van een opslag zet het leven zonder schaling;
   5. de politie: in dezelfde tijd en op dezelfde plek kost een schietende agent op makkelijk minder dan de helft van
      wat hij op moeilijk kost; en zonder zicht zakt de jacht op makkelijk sneller dan op normaal, op moeilijk trager.

 Gebruik: npm run server &  node tools/standentest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fout++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(() => { try { localStorage.removeItem('tinga.grafisch'); localStorage.removeItem('tinga.moeilijk'); } catch {} });

// ---- 1 en 2: de grafische standen
const g1 = await page.evaluate(async () => {
  const g = window.__game, W = await import('./js/world.js');
  // alles voorbereid zoals bij Start spel (het reliëf, de vervaagshaders, de soorten en de avond): wat daarna nog
  // vertaald wordt, komt door het wisselen
  await g.voorbereidSpel();
  for (const st of ['laag', 'hoog', 'normaal']) { g.zetGrafisch(st); g.renderer.render(g.scene, g.camera); }   // (één keer rond: wat er in beeld komt)
  const R = g.renderer, sun = g.scene.children.find(o => o.isDirectionalLight && o.castShadow);
  const gras = (() => { let m = null; g.scene.traverse(o => { if (o.userData && o.userData.klasse === 'grasveld') m = o; }); return m; })();
  const fijn = () => { let n = 0; g.scene.traverse(o => { if (o.isMesh && o.visible && o.parent && o.parent.visible) n++; }); return n; };
  const lees = () => {
    R.shadowMap.needsUpdate = true; R.render(g.scene, g.camera);
    return { stand: g.grafisch, lod: +W.LOD.schaal.toFixed(3), kaart: g.schaduwKaart, kaartEcht: sun && sun.shadow.map ? sun.shadow.map.width : null,
      gras: gras ? gras.visible : null, mensen: g.npcs.ZICHT, grof: g.npcs.ZICHT_GROF, zichtbaar: fijn(), prog: R.info.programs.length };
  };
  const uit = { normaal: lees() };
  g.zetGrafisch('laag'); uit.laag = lees();
  g.zetGrafisch('hoog'); uit.hoog = lees();
  g.zetGrafisch('normaal'); uit.terug = lees();
  uit.maxTex = R.capabilities.maxTextureSize;
  return uit;
});
kop('1. normaal is het oude spel');
const n = g1.normaal;
ok(n.stand === 'normaal' && n.lod === 1.4 && n.kaart === 3072 && n.gras === true && n.mensen === 200 && n.grof === 350,
  'LOD 1,4, schaduwkaart 3072, gras aan, lichamen 200 m, grof 350 m', JSON.stringify({ lod: n.lod, kaart: n.kaart, gras: n.gras, mensen: n.mensen, grof: n.grof }));
kop('2. laag en hoog');
const l = g1.laag, h = g1.hoog;
ok(l.lod < n.lod && l.kaart === 1536 && l.kaartEcht === 1536 && l.gras === false && l.mensen < n.mensen && l.grof < n.grof,
  'laag: kortere LOD, schaduwkaart 1536 (echt na een schaduwpas), geen gras in 3D, minder mensen', JSON.stringify({ lod: l.lod, kaart: l.kaartEcht, gras: l.gras, mensen: l.mensen, grof: l.grof }));
ok(h.lod > n.lod && h.kaart === Math.min(4096, g1.maxTex) && h.kaartEcht === h.kaart && h.gras === true && h.mensen > n.mensen && h.grof <= 350,
  'hoog: langere LOD, schaduwkaart 4096, gras aan, meer mensen, grof niet voorbij 350 m', JSON.stringify({ lod: h.lod, kaart: h.kaartEcht, mensen: h.mensen }));
ok(l.zichtbaar < n.zichtbaar && h.zichtbaar > n.zichtbaar, 'rond de speler minder of meer zichtbare meshes', `${l.zichtbaar} · ${n.zichtbaar} · ${h.zichtbaar}`);
ok(g1.terug.lod === n.lod && g1.terug.kaartEcht === 3072 && g1.terug.zichtbaar === n.zichtbaar, 'terug op normaal is alles weer zoals het was');
ok(l.prog === n.prog && h.prog === n.prog && g1.terug.prog === n.prog, 'wisselen vertaalt geen nieuw shaderprogramma', `${n.prog} · ${l.prog} · ${h.prog} · ${g1.terug.prog}`);

// ---- 3: het menu
const m = await page.evaluate(async () => {
  const g = window.__game;
  document.getElementById('overlay').style.display = '';
  const knop = document.getElementById('menuInstellingen'); if (knop) knop.click();
  await new Promise(r => setTimeout(r, 50));
  const gr = document.getElementById('instel_grafisch'), mo = document.getElementById('instel_moeilijk');
  const voor = { gr: gr && gr.textContent, mo: mo && mo.textContent };
  if (gr) gr.click(); if (mo) mo.click();
  await new Promise(r => setTimeout(r, 50));
  const na = { gr: gr && gr.textContent, mo: mo && mo.textContent, stand: g.grafisch, moeilijk: g.moeilijk.stand,
    bewaard: [localStorage.getItem('tinga.grafisch'), localStorage.getItem('tinga.moeilijk')] };
  // terug naar normaal (twee klikken verder in de rij van drie)
  if (gr) { gr.click(); gr.click(); } if (mo) { mo.click(); mo.click(); }
  const terug = { stand: g.grafisch, moeilijk: g.moeilijk.stand };
  document.getElementById('overlay').style.display = 'none';
  return { er: !!gr && !!mo, voor, na, terug };
});
kop('3. in het menu');
ok(m.er, 'Instellingen heeft "Grafische stand" en "Moeilijkheid"');
ok(m.voor.gr === 'normaal' && m.voor.mo === 'normaal', 'allebei standaard normaal', JSON.stringify(m.voor));
ok(m.na.stand === 'hoog' && m.na.moeilijk === 'moeilijk' && m.na.bewaard[0] === 'hoog' && m.na.bewaard[1] === 'moeilijk',
  'een klik wisselt (normaal → hoog, normaal → moeilijk) en het blijft bewaard', JSON.stringify(m.na));
ok(m.terug.stand === 'normaal' && m.terug.moeilijk === 'normaal', 'en de rij loopt rond (laag, normaal, hoog)', JSON.stringify(m.terug));

// ---- 4 en 5: de moeilijkheid
const d = await page.evaluate(async () => {
  const g = window.__game, P = g.player, Po = g.politie, W = await import('./js/world.js');
  const { KAART } = await import('./js/kaart.js');
  const uit = {};
  for (const s of ['makkelijk', 'normaal', 'moeilijk']) {
    g.moeilijk.zet(s);
    P.health = 100; P.health -= 50;
    const na = P.health;
    P.health = Math.min(100, P.health + 20);
    uit[s] = { na, bier: P.health };
  }
  g.moeilijk.zet('makkelijk'); P.health = 100; P.zetLevenRuw(40); uit.laden = P.health;
  g.moeilijk.zet('normaal'); P.health = 100;
  // de politie: een agent op 14 m, twee sterren, 20 s; het verlies aan leven per stand
  const as = KAART.wegassen.filter(w => w.drive && w.naam === 'Molenkrite' && w.lengte > 60)[0];
  const sp = { x: as.pts[1][0], z: as.pts[1][1] };
  g.sfeer.uur = 12; g.sfeer.weer = 'helder'; for (let i = 0; i < 3; i++) g.sfeer.update(0.1, sp.x, sp.z);
  const verlies = (s) => {
    g.moeilijk.zet(s);
    let tot = 0;
    for (let ronde = 0; ronde < 4; ronde++) {
      Po.reset(); Po.proefStil = true; P.inCar = null; P.pos.set(sp.x, 0, sp.z);
      Po.zetSter(2, sp.x, sp.z);
      for (const b of Po.agentenLijst) { b.staat = 'neer'; b.persoon.groep.visible = false; }
      const [ax, az] = W.resolveCollisions(sp.x + 14, sp.z + 1, 0.4);
      const a = Po.proef.agent(ax, az); a.rol = 'aanval'; a.staat = 'jacht'; a.mp = false; a.wagen = null;
      for (let i = 0; i < 600; i++) {
        P.pos.set(sp.x, 0, sp.z); P.health = 100;
        const s2 = Po.update(1 / 30);
        if (s2 > 0) { P.health -= s2; tot += 100 - P.health; }
        a.staat = 'jacht';
      }
    }
    return Math.round(tot);
  };
  uit.verlies = { makkelijk: verlies('makkelijk'), normaal: verlies('normaal'), moeilijk: verlies('moeilijk') };
  // de jacht zakt zonder zicht: heat na 20 s ver weg
  const koel = (s) => {
    g.moeilijk.zet(s);
    Po.reset(); Po.proefStil = true;
    Po.zetSter(3, sp.x, sp.z);
    const h0 = Po.heat;
    P.pos.set(sp.x + 5000, 0, sp.z + 5000);
    // (hij begint pas te zakken na VERGETEN + 6 s per ster zonder zicht, 36 s: dan nog 2 s, zodat hij niet op nul uitkomt)
    for (let i = 0; i < 1140; i++) Po.update(1 / 30);
    return +(h0 - Po.heat).toFixed(2);
  };
  uit.koel = { makkelijk: koel('makkelijk'), normaal: koel('normaal'), moeilijk: koel('moeilijk') };
  Po.reset(); g.moeilijk.zet('normaal'); P.health = 100;
  return uit;
});
kop('4. de moeilijkheid: schade');
ok(d.makkelijk.na === 70 && d.normaal.na === 50 && d.moeilijk.na === 30, 'een treffer van 50: makkelijk 30, normaal 50, moeilijk 70 eraf',
  `${d.makkelijk.na} · ${d.normaal.na} · ${d.moeilijk.na}`);
ok(d.makkelijk.bier === 90 && d.normaal.bier === 70 && d.moeilijk.bier === 50, 'bier (+20) telt in elke stand gewoon', `${d.makkelijk.bier} · ${d.normaal.bier} · ${d.moeilijk.bier}`);
ok(d.laden === 40, 'het laden zet het leven zonder schaling', `${d.laden}`);
kop('5. de moeilijkheid: de politie');
ok(d.verlies.normaal > 0, 'de agent schiet en raakt', `${d.verlies.normaal} punten op normaal`);
ok(d.verlies.makkelijk < d.verlies.moeilijk * 0.5, 'op makkelijk kost hij minder dan de helft van moeilijk', `${d.verlies.makkelijk} · ${d.verlies.normaal} · ${d.verlies.moeilijk}`);
ok(d.koel.makkelijk > d.koel.normaal && d.koel.normaal > d.koel.moeilijk && d.koel.normaal > 0, 'zonder zicht zakt de jacht op makkelijk sneller, op moeilijk trager',
  `${d.koel.makkelijk} · ${d.koel.normaal} · ${d.koel.moeilijk}`);

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);

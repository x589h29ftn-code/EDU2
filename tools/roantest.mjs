/*
 Stap 178 (npm run roantest): de bijmissie "Roan naar Ma". Gevraagd: "na de missie met Johan, wanneer de No Mercy-missie
 gestart kan worden, een andere missie. Op de locatie van Radio Tinga een R voor Roan (het gebouw is ook een school). Als je
 in de omgeving bent van het gebouw of er is geen missie, dan word je gebeld door Mark: 'Erik, ff je hulp nodig. Kan jij Roan
 naar Ma brengen? Super bedankt!' Roan is een kindje van 4 en kan opgehaald worden bij de speeltoestellen, alleen zichtbaar
 als de missie begonnen is. Hij volgt je naar Molenkrite 15; daar staat de moeder van Erik en Mark. Missie klaar, € 450."

   1. vóór missie 5 geen R; erna de R bij Radio Tinga, en Roan en Ma nog niet te zien;
   2. Mark belt pas na de tussenpoos (90 s, na Erik Jan); sinds stap 193 vóór het einde alleen als je bij de R E drukt (langsrijden
      onder een wachtende missie belde eerst vanzelf en nam de navigatie van de missie over), na het einde vanzelf;
      "Erik, ff je hulp nodig" … "Super bedankt!";
   3. Roan staat dan bij de speeltoestellen naast de school, buiten de botsdozen, en is een kind (kleiner dan Erik);
   4. ophalen: hij groet en volgt je over je eigen spoor, nooit door een muur of het water, en blijft dichtbij;
   5. in een auto stapt hij mee in, en bij het uitstappen weer uit;
   6. Ma op de stoep van Molenkrite 15; met Roan bij haar het gesprek, € 450 en MISSIE GESLAAGD; daarna gaan ze naar binnen;
   7. opslaan kan niet zolang Roan bij je is; neergaan zet hem terug bij de school; de opslag onthoudt klaar;
   8. geen nieuw shaderprogramma voor Roan en Ma.

 Gebruik: npm run server &  node tools/roantest.mjs [poort]
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

const r = await page.evaluate(async () => {
  const W = await import('/js/world.js');
  for (let n = 1; n <= 15; n++) localStorage.removeItem(n === 1 ? 'tinga.spel.v1' : `tinga.spel.v1.${n}`);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal, P = g.player, R = g.renderer;
  await g.voorbereidSpel();
  const programmasVoor = R.info.programs.length;
  P.active = false; window.__autoplay = false; g.sfeer.uur = 14;
  const meld = []; const echt = g.hud.melding.bind(g.hud); g.hud.melding = (k, o, t) => { meld.push(`${k}|${o}`); return echt(k, o, t); };
  const stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) v.update(dt); };
  const dicht = () => document.getElementById('dialoog').hidden;
  const tekst = () => document.getElementById('dialoog').textContent;
  const klik = (max = 40) => { for (let i = 0; i < max && !dicht(); i++) { v.toets(); stap(1); } };
  const zet = (x, z) => { P.inCar = null; const [rx, rz] = W.resolveCollisions(x, z, 0.4); P.pos.set(rx, 0, rz); P.applyCamera(); };
  const uit = {};

  // ---- 1. vóór missie 5
  let s = v.bewaar(); s.missie = 'johan'; s.fase = 'naar_kruirad'; s.noMercyKlaar = true; s.noMercyGebeld = true; s.roanKlaar = false;
  v.herstel(s); stap(4);
  uit.voor = { beschikbaar: v.roan.beschikbaar, R: !!g.hud.roan };
  // na missie 5: missie 5 op 'terug', bij Johan, het gesprek door (No Mercy 4 al gedaan, dan belt Erik Jan niet tussendoor)
  s = v.bewaar(); s.missie = 'johan'; s.fase = 'terug'; s.volgende = null; s.noMercyKlaar = true; s.noMercyGebeld = true; s.roanKlaar = false;
  v.herstel(s); v.__geenVolgende(); g.politie.reset();
  const doel = g.hud.nav && g.hud.nav.doel;
  zet(doel[0] + 1, doel[1] + 1); stap(3); klik(); stap(2);
  const school = v.roan.school;
  uit.na = { missie: v.missie, belT: v.roan.belT, R: g.hud.roan ? Math.round(Math.hypot(g.hud.roan.x - school.x, g.hud.roan.z - school.z)) : null,
    roan: v.roan.kind.groep.visible, ma: v.roan.ma.groep.visible, dSchool: Math.round(Math.hypot(P.pos.x - school.x, P.pos.z - school.z)) };

  // ---- 2. het telefoontje
  stap(1200);        // 60 s
  uit.na60 = { fase: v.roan.fase, dialoog: !dicht() };
  stap(800);         // 100 s: ver van de school, met missie 6 die onder zijn M wacht, belt hij niet (stap 179)
  uit.verWeg = { fase: v.roan.fase, dialoog: !dicht() };
  // (stap 193) langs de school, met missie 6 die onder zijn M wacht: dan belt hij niet meer, en de M van de missie blijft
  zet(school.x + 60, school.z + 20); stap(200);
  uit.langs = { fase: v.roan.fase, dialoog: !dicht(), nav: (g.hud.nav && g.hud.nav.letter) || null, missie: v.missie };
  // dan zelf naar de R op de stoep van Radio Tinga en E: dan belt Mark
  zet(school.x, school.z); stap(4);
  uit.bijR = v.aanspreekbaar;
  v.toets();
  let rinkel = v.roan.fase;
  for (let i = 0; i < 200 && rinkel !== 'bellen'; i++) { stap(1); rinkel = v.roan.fase; }
  stap(60);          // 3 s: het gesprek
  uit.bel = { fase: rinkel, tekst: tekst(), open: !dicht() };
  const regels = [];
  for (let i = 0; i < 10 && !dicht(); i++) { regels.push(tekst()); v.toets(); stap(1); }
  stap(2);
  uit.belRegels = regels;
  const rk = v.roan.kind, sp = v.roan.speel;
  uit.ophalen = { fase: v.roan.fase, zicht: rk.groep.visible, nav: v.navDoel ? v.navDoel.letter : (g.hud.nav && g.hud.nav.letter) || null,
    dSpeel: Math.round(Math.hypot(rk.groep.position.x - 315.2, rk.groep.position.z + 84.6) * 10) / 10, opdracht: document.getElementById('opdracht') ? document.getElementById('opdracht').textContent : '' };
  // een kind: kleiner dan Erik
  rk.groep.updateMatrixWorld(true);
  const THREE = await import('three');
  const b = new THREE.Box3().setFromObject(rk.groep);
  uit.lengte = Math.round((b.max.y - b.min.y) * 100) / 100;
  const [kx, kz] = W.resolveCollisions(rk.groep.position.x, rk.groep.position.z, 0.25);
  uit.vrij = Math.hypot(kx - rk.groep.position.x, kz - rk.groep.position.z) < 0.02 && !W.pointInWater(kx, kz);

  // ---- 4. ophalen en volgen
  zet(rk.groep.position.x + 1.6, rk.groep.position.z);
  stap(4);
  uit.hoi = { tekst: tekst(), open: !dicht() };
  stap(120);          // het gesprek loopt vanzelf door
  uit.lopen = { fase: v.roan.fase, ma: v.roan.ma.groep.visible };
  // langs de navigatie naar Ma lopen (de route van de hud), 3 m/s, Roan erachteraan
  let maxAfstand = 0, inMuur = 0, inWater = 0, t = 0;
  const route = () => (g.hud.nav && g.hud.nav.route) || [];
  const ma = v.roan.maPlek;
  for (t = 0; t < 40; t += 0.05) {
    const rt = route();
    let doelP = rt.length > 1 ? rt[Math.min(rt.length - 1, 2)] : [ma.x, ma.z];
    if (Array.isArray(doelP) === false) doelP = [doelP.x, doelP.z];
    const dx = doelP[0] - P.pos.x, dz = doelP[1] - P.pos.z, d = Math.hypot(dx, dz);
    if (Math.hypot(ma.x - P.pos.x, ma.z - P.pos.z) < 2.5) break;
    const st = Math.min(d, 3 * 0.05);
    if (d > 0.01) { P.yaw = Math.atan2(-dx, -dz); const [rx, rz] = W.resolveCollisions(P.pos.x + dx / d * st, P.pos.z + dz / d * st, 0.4); P.pos.set(rx, 0, rz); }
    v.update(0.05);
    const k = rk.groep.position;
    if (t > 3) maxAfstand = Math.max(maxAfstand, Math.hypot(k.x - P.pos.x, k.z - P.pos.z));
    const [qx, qz] = W.resolveCollisions(k.x, k.z, 0.2);
    if (Math.hypot(qx - k.x, qz - k.z) > 0.05) inMuur++;
    if (W.pointInWater(k.x, k.z)) inWater++;
    if (v.roan.fase !== 'lopen') break;
    // halverwege: even met de auto (hij stapt mee in en weer uit)
    if (Math.abs(t - 20) < 0.026 && !uit.auto) {
      const auto = g.vehicles.voegToe({ x: P.pos.x + 1.5, z: P.pos.z, yaw: P.yaw, soort: 'hatch' });
      zet(P.pos.x, P.pos.z);
      for (let i = 0; i < 60; i++) v.update(0.05);   // Roan komt bij
      P.inCar = auto; for (let i = 0; i < 4; i++) v.update(0.05);
      const inAuto = v.roan.inAuto, zicht = rk.groep.visible;
      P.inCar = null; P.pos.set(auto.x - 1.6, 0, auto.z); for (let i = 0; i < 4; i++) v.update(0.05);
      uit.auto = { inAuto, zichtInAuto: zicht, naUit: rk.groep.visible && !v.roan.inAuto, dNaUit: Math.round(Math.hypot(rk.groep.position.x - P.pos.x, rk.groep.position.z - P.pos.z) * 10) / 10 };
      g.vehicles.verwijder && g.vehicles.verwijder(auto);
    }
  }
  uit.volg = { t: Math.round(t), maxAfstand: Math.round(maxAfstand * 10) / 10, inMuur, inWater, fase: v.roan.fase };
  // ---- 7a. opslaan kan niet zolang Roan bij je is (onderweg, zonder gesprek)
  for (let i = 0; i < 80 && !dicht(); i++) v.update(0.05);
  uit.opslaan = v.waaromNietOpslaan();
  // het laatste stuk: Erik vlak bij Ma neergezet, Roan een paar meter achter hem (hij loopt het laatste stuk zelf)
  const fxM = -Math.sin(ma.yaw), fzM = -Math.cos(ma.yaw);
  zet(ma.x + fxM * 2.5, ma.z + fzM * 2.5);
  rk.zetNeer(ma.x + fxM * 5.5, ma.z + fzM * 5.5, 0);
  for (let i = 0; i < 20; i++) { P.yaw = Math.atan2(fxM, fzM); v.update(0.05); }
  zet(ma.x + fxM * 1.8, ma.z + fzM * 1.8);
  // ---- 6. bij Ma
  const geld0 = v.geld;
  for (let i = 0; i < 200 && v.roan.fase === 'lopen'; i++) v.update(0.05);
  uit.thuis = { fase: v.roan.fase, tekst: tekst(), open: !dicht(), dKind: Math.round(Math.hypot(rk.groep.position.x - ma.x, rk.groep.position.z - ma.z) * 10) / 10 };
  const thuisRegels = [];
  for (let i = 0; i < 10 && !dicht(); i++) { thuisRegels.push(tekst()); v.toets(); stap(1); }
  stap(2);
  uit.klaar = { fase: v.roan.fase, klaar: v.roan.klaar, geld: v.geld - geld0, melding: meld.filter(m => m.startsWith('MISSIE GESLAAGD')).pop() || null, R: !!g.hud.roan, regels: thuisRegels };
  stap(120);
  uit.binnen = { roan: v.roan.kind.groep.visible, ma: v.roan.ma.groep.visible };
  uit.opslag = v.bewaar().roanKlaar;

  // ---- 7b. neergaan tijdens de missie: terug bij de school
  s = v.bewaar(); s.roanKlaar = false; v.herstel(s); stap(2);
  zet(v.roan.school.x, v.roan.school.z); v.roan.zetBel(0); stap(2); v.toets(); stap(80); klik(); stap(2);
  const voorNeer = v.roan.fase;
  P.health = 0; v.dood(); stap(2);
  uit.neer = { voor: voorNeer, na: v.roan.fase, zicht: v.roan.kind.groep.visible };
  P.zetLevenRuw(100);

  // ---- 7c. (stap 193) na het einde belt Mark nog vanzelf, ook ver van de school
  s = v.bewaar(); Object.assign(s, { missie: 'klaar', fase: 'klaar', volgende: null, uitzendingKlaar: true, invalKlaar: true, ronaldKlaar: true, roanKlaar: false });
  v.herstel(s); stap(2);
  zet(v.roan.school.x + 400, v.roan.school.z + 300); v.roan.zetBel(0);
  let belNa = v.roan.fase;
  for (let i = 0; i < 200 && belNa !== 'bellen' && dicht(); i++) { stap(1); belNa = v.roan.fase; }
  uit.einde = { fase: belNa, open: !dicht() || belNa === 'bellen' };
  klik(); stap(2);
  v.roan.stop();
  // ---- 8. shaders: Roan en Ma in beeld
  s = v.bewaar(); s.roanKlaar = false; v.herstel(s); stap(2);
  zet(v.roan.school.x, v.roan.school.z); v.roan.zetBel(0); stap(2); v.toets(); stap(80); klik(); stap(2);
  const k2 = v.roan.kind.groep.position, m2 = v.roan.maPlek;
  // eerst dezelfde twee beelden zonder Roan en Ma (de wereld daar), dan met: alleen het verschil telt
  const beeld = (x, y, z, lx, ly, lz) => { g.camera.position.set(x, y, z); g.camera.lookAt(lx, ly, lz); g.camera.updateMatrixWorld(true);
    W.updateLOD(x, z); g.scene.updateMatrixWorld(true); g.renderer.shadowMap.needsUpdate = true; R.render(g.scene, g.camera); };
  const beelden = () => { beeld(k2.x + 3, 1.5, k2.z + 3, k2.x, 0.6, k2.z); beeld(m2.x + 3, 1.6, m2.z + 3, m2.x, 1, m2.z); };
  v.roan.kind.groep.visible = false; v.roan.ma.groep.visible = false;
  beelden();
  const programmasZonder = R.info.programs.length;
  v.roan.kind.groep.visible = true; v.roan.ma.groep.visible = true; v.roan.ma.zetNeer(m2.x, m2.z, m2.yaw);
  beelden();
  uit.programmas = { voor: programmasZonder, na: R.info.programs.length, opstart: programmasVoor };
  // wie de nieuwe programma's gebruikt (voor het zoeken)
  const nieuw = new Set(R.info.programs.slice(uit.programmas.voor));
  const wie = [];
  g.scene.traverse(o => {
    if (!o.isMesh) return;
    for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
      const pm = m && R.properties.get(m);
      if (pm && pm.currentProgram && nieuw.has(pm.currentProgram) && wie.length < 8) {
        let pad = o.name || o.type, q = o.parent; for (let k = 0; k < 3 && q; k++, q = q.parent) pad = `${q.name || q.type}/${pad}`;
        wie.push(`${m.type}${m.transparent ? ' doorzichtig' : ''}${m.map ? ' kaart' : ''}${m.vertexColors ? ' kleuren' : ''} · ${pad}`);
      }
    }
  });
  uit.programmas.wie = wie;
  return uit;
});

kop('1. de R');
ok(!r.voor.beschikbaar && !r.voor.R, 'vóór missie 5 geen R', JSON.stringify(r.voor));
ok(r.na.missie === 'bx' && r.na.R !== null && r.na.R < 2, 'na missie 5 de R bij Radio Tinga', JSON.stringify(r.na));
ok(!r.na.roan && !r.na.ma, 'Roan en Ma nog niet te zien', JSON.stringify(r.na));

kop('2. Mark belt');
ok(r.na60.fase === 'wacht' && !r.na60.dialoog, 'niet vóór de tussenpoos (90 s)', JSON.stringify(r.na60));
ok(r.na.dSchool > 150 && r.verWeg.fase === 'wacht' && !r.verWeg.dialoog, 'ver van de school, met een missie die op je wacht, belt hij niet (stap 179)', JSON.stringify(r.verWeg));
ok(r.langs.fase === 'wacht' && !r.langs.dialoog && r.langs.nav !== 'R', 'langs de school met een missie die wacht: geen telefoontje, de missie houdt zijn navigatie (stap 193)', JSON.stringify(r.langs));
ok(r.bijR, 'bij de R op de stoep is E van Roan');
ok(r.bel.fase === 'bellen' && r.bel.open, 'E bij de R: dan belt Mark', JSON.stringify({ fase: r.bel.fase }));
ok(r.belRegels.join(' ').includes('Erik, ff je hulp nodig') && r.belRegels.join(' ').includes('Roan naar Ma') && r.belRegels.join(' ').includes('Super bedankt'), '"Erik, ff je hulp nodig. Kan jij Roan naar Ma brengen? … Super bedankt!"', JSON.stringify(r.belRegels));

kop('3. Roan bij de speeltoestellen');
ok(r.ophalen.fase === 'ophalen' && r.ophalen.zicht, 'na het telefoontje staat Roan er', JSON.stringify(r.ophalen));
ok(r.ophalen.dSpeel < 2.5 && r.vrij, 'bij de speeltoestellen, buiten de botsdozen en niet in het water', JSON.stringify({ d: r.ophalen.dSpeel, vrij: r.vrij }));
ok(r.lengte > 0.9 && r.lengte < 1.25, 'een kind van vier (ongeveer 1,05 m)', `${r.lengte} m`);

kop('4. ophalen en volgen');
ok(r.hoi.tekst.includes('oma'), 'hij groet: "Gaan we naar oma?"', r.hoi.tekst);
ok(r.lopen.fase === 'lopen' && r.lopen.ma, 'dan lopen, en Ma staat klaar', JSON.stringify(r.lopen));
ok(r.volg.inMuur === 0 && r.volg.inWater === 0, 'hij loopt nooit door een muur of het water', JSON.stringify(r.volg));
ok(r.volg.maxAfstand < 6, 'en blijft dichtbij', JSON.stringify(r.volg));

kop('5. de auto');
ok(r.auto && r.auto.inAuto && !r.auto.zichtInAuto, 'in de auto stapt hij mee in', JSON.stringify(r.auto));
ok(r.auto && r.auto.naUit && r.auto.dNaUit < 3, 'en stapt met je uit', JSON.stringify(r.auto));

kop('6. bij Ma');
ok(r.thuis.fase === 'thuis' && r.thuis.open, 'met Roan bij Ma: het gesprek', JSON.stringify(r.thuis));
ok(r.klaar.klaar && r.klaar.geld === 450 && r.klaar.melding && !r.klaar.R, 'MISSIE GESLAAGD, € 450, en de R is weg', JSON.stringify(r.klaar));
ok(!r.binnen.roan && !r.binnen.ma, 'daarna gaan Ma en Roan naar binnen', JSON.stringify(r.binnen));

kop('7. opslaan en neergaan');
ok(r.opslaan === 'zolang Roan bij je is', 'opslaan kan niet zolang Roan bij je is', r.opslaan);
ok(r.opslag === true, 'de opslag onthoudt dat Roan thuis is');
ok(r.einde.open, 'na het einde belt Mark nog vanzelf, ook ver van de school (stap 193)', JSON.stringify(r.einde));
ok(r.neer.voor === 'ophalen' && r.neer.na === 'wacht' && !r.neer.zicht, 'neergaan: Roan weer bij de school, Mark belt opnieuw', JSON.stringify(r.neer));

kop('8. shaders');
ok(r.programmas.na === r.programmas.voor, 'geen nieuw shaderprogramma voor Roan en Ma', `${r.programmas.voor} → ${r.programmas.na} ${JSON.stringify(r.programmas.wie)}`);

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);

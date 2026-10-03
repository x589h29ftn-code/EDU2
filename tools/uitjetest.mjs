/*
 Stap 115: na het einde een middag met Mark (js/verhaal.js, `uitje`).

   node tools/server.mjs 8123 &   node tools/uitjetest.mjs [poort]   (npm run uitjetest)

 1. Vóór het einde geen M; na het einde wel, bij Molenkrite 15, als vlag zonder route, en het
    lint van de inval is weg.
 2. Binnen zit Mark op de bank en vraagt: de wedstrijd of de bank. Zolang het uitje loopt geen klus.
 3. De wedstrijd, 's ochtends gekozen: "Die middag…", de klok op 12:12 en stil, de wedstrijd staat
    klaar, je zit in de Golf van Mark voor de deur, Mark naast je, de navigatie naar VV Sneek.
    Ook als de wedstrijd die dag al geweest is: dan is het de volgende middag.
 4. De kijkplek gemeten: tussen de zijlijn en de reclameborden, voor de tribune, vrij van botsdozen,
    en te voet te halen vanaf het clubparkeerterrein.
 5. Aankomen: Mark stapt uit en loopt naar de lijn; jij erbij: kijken. Een biertje met E (leven
    erbij, vanaf het derde de waas, na zes is het genoeg), Mark juicht bij een doelpunt.
 6. Na de kijktijd: "Mooi geweest", de klok loopt weer; ver weg is Mark naar huis en na een poos
    staat de M er weer.
 7. Weglopen en de wedstrijd stilleggen eindigen het uitje ook.
 8. De bank: naast Mark zitten, "Een paar uur later…", drie uur later, vol leven.
 9. De keuze open laten en het huis uit lopen; laden tijdens het uitje; de geldrace blijft werken.
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
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  window.__W = await import('/js/world.js');
  window.__LP = await import('/js/looppad.js');
  window.__K = (await import('/js/kaart.js')).KAART;
  g.player.active = false;
  window.__autoplay = false;
  window.__meld = []; window.__regels = [];
  const echt = g.hud.melding.bind(g.hud);
  g.hud.melding = (k, o, t) => { window.__meld.push(`${k}|${o}`); return echt(k, o, t); };
  /*
   Alles wat er in de balk komt te staan, ook de regels die zichzelf wegklikken. Elke stap gelezen:
   een MutationObserver meldt pas iets als de (synchrone) evaluate klaar is, en dan is het te laat.
  */
  const tekst = document.getElementById('dialoogTekst');
  const dicht = () => document.getElementById('dialoog').hidden;
  let laatst = '';
  window.__lees = () => { const t = dicht() ? '' : tekst.textContent; if (t && t !== laatst) window.__regels.push(t); laatst = t; };
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { if (g.player.health > 0 && !window.__leven) g.player.health = 100; v.update(dt); window.__lees(); } };
  window.__klik = (max = 80) => { for (let i = 0; i < max && !dicht(); i++) { window.__lees(); v.toets(); window.__stap(1); } };
  window.__wachtDicht = (maxS = 12) => { for (let t = 0; t < maxS && !dicht(); t += 0.05) window.__stap(1); return dicht(); };
  window.__zet = (x, z) => { const P = g.player; if (P.inCar) { P.inCar.speed = 0; P.inCar = null; } P.zit = false; P.eye = P.eyeStaand; P.pos.set(x, 0, z); P.applyCamera(); };
  window.__E = () => { const was = g.player.active; g.player.active = true; v.toets(); g.player.active = was; window.__lees(); };
  window.__uur = (u) => { g.sfeer.uur = u; };
  // vrij spelen; `einde` zegt of missie 18 al gespeeld is
  window.__vrij = (einde = true, extra = {}) => {
    const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
    Object.assign(s, { huis: 'Koningsspil 20', veteraanKlaar: true, politieautoKlaar: true, brugKlaar: true, schriftKlaar: true, raceKlaar: true,
      schaduwKlaar: true, invalKlaar: true, ronaldKlaar: true, uitzendingKlaar: einde, geld: 5000 }, extra);
    g.politie.reset();
    v.herstel(s);
    g.sfeer.loopt = true;              // na de titelrol loopt de klok
    window.__stap(2);
  };
  // tot de M er staat
  window.__totM = () => { for (let t = 0; t < 200 && v.uitje.fase !== 'wacht'; t += 0.5) window.__stap(1, 0.5); window.__stap(30); return v.uitje.fase; };
  // binnen bij Molenkrite 15 en het gesprek door, tot de keuze
  window.__binnen = () => { const w = g.woningen[0]; window.__zet(w.plekken.deurBinnen.x, w.plekken.deurBinnen.z); window.__stap(2); window.__klik(); return v.uitje.fase; };
  // tot het zwart weg is
  window.__totLicht = (maxS = 15) => { for (let t = 0; t < maxS && v.zwart; t += 0.05) window.__stap(1); window.__stap(4); };
});

// ------------------------------------------------------------------ 1. de M
kop('de M na het einde');
const m = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__vrij(false);
  window.__stap(60, 0.5);
  const voor = { fase: v.uitje.fase, nav: g.hud.nav ? g.hud.nav.letter : null, lint: v.uitje.lint };
  window.__vrij(true);
  const fase = window.__totM();
  const nav = g.hud.nav, d = g.woningen[0].plekken.deurBuiten;
  return { voor, fase, letter: nav && nav.letter, route: nav && nav.route, dDeur: nav ? Math.hypot(nav.doel[0] - d.x, nav.doel[1] - d.z) : -1,
    lint: v.uitje.lint, missie: v.missie };
});
ok(m.voor.fase === 'uit' && m.voor.nav !== 'M', 'vóór het einde van missie 18 geen M', JSON.stringify(m.voor));
ok(m.fase === 'wacht' && m.letter === 'M' && m.dDeur < 1 && !m.route, 'na het einde: een M bij Molenkrite 15, zonder route', `${r1(m.dDeur)} m van de deur`);
ok(!m.lint && m.voor.lint, 'het lint van de inval hangt er niet meer (Mark woont er weer)');
ok(m.missie === 'klaar', 'het is geen missie: vrij spelen blijft vrij spelen');

// ------------------------------------------------------------------ 2. binnen
kop('binnen bij Mark');
const binnen = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, w = g.woningen[0];
  window.__regels.length = 0;
  const fase = window.__binnen();
  const bank = w.plekken.bank, mp = v.mark.groep.position;
  return { fase, zicht: v.mark.groep.visible, dBank: Math.hypot(mp.x - bank.x, mp.z - bank.z), regels: window.__regels.join(' / '),
    opdracht: document.getElementById('opdracht').textContent, bezig: v.uitje.bezig, nav: !!g.hud.nav };
});
ok(binnen.zicht && binnen.dBank < 0.6, 'Mark zit op de bank', `${r1(binnen.dBank)} m van de bank`);
ok(/wedstrijd/.test(binnen.regels) && /bank/.test(binnen.regels), 'hij vraagt: de wedstrijd of de bank', binnen.regels.slice(0, 140));
ok(binnen.fase === 'keuze' && /1 — naar de wedstrijd/.test(binnen.opdracht) && /2 — op de bank/.test(binnen.opdracht), '1 de wedstrijd · 2 de bank', binnen.opdracht);
ok(binnen.bezig && !binnen.nav, 'zolang het uitje loopt geen klus, en de vlag is weg');

// ------------------------------------------------------------------ 3. de wedstrijd kiezen, 's ochtends
kop('de wedstrijd, om negen uur gekozen');
const rit = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, w = g.wedstrijd;
  window.__uur(9);
  w.weg();
  window.__regels.length = 0;
  v.kiesHuis(1);
  window.__klik();
  window.__totLicht();
  const golf = v.uitje.golf, t = v.plekken.thuis, nav = g.hud.nav;
  return { fase: v.uitje.fase, uur: g.sfeer.uur, loopt: g.sfeer.loopt, aanwezig: w.aanwezig, gestaakt: w.gestaakt,
    inGolf: !!golf && g.player.inCar === golf, dThuis: golf ? Math.hypot(golf.x - t.x, golf.z - t.z) : -1, mark: v.mark.groep.visible,
    nav: nav && nav.letter, route: !!(nav && nav.route && nav.route.length), overgang: document.getElementById('overgangtekst').textContent,
    regels: window.__regels.join(' / ') };
});
ok(/twaalf/.test(rit.regels) && rit.overgang === 'Die middag…', 'Mark: om twaalf uur de aftrap, en "Die middag…"', rit.overgang);
ok(Math.abs(rit.uur - 12.2) < 0.01 && rit.loopt === false, 'de klok op 12:12, en stil', `${r1(rit.uur)} uur`);
ok(rit.aanwezig && !rit.gestaakt, 'de wedstrijd loopt');
ok(rit.inGolf && rit.dThuis < 30 && !rit.mark, 'in de Golf van Mark voor de deur, Mark naast je', `${r1(rit.dThuis)} m van Molenkrite 15`);
ok(rit.fase === 'rijden' && rit.nav === 'V' && rit.route, 'de navigatie naar VV Sneek, over de weg');

// ------------------------------------------------------------------ 4. de kijkplek gemeten
kop('de kijkplek');
const plek = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, W = window.__W, K = window.__K;
  const p = v.uitje.plek, V = K.sportvelden.find(q => q.hoofd);
  const ex = Math.cos(V.hoek), ez = Math.sin(V.hoek), hb = V.vb / 2, hl = V.vl / 2;
  const uv = (q) => { const dx = q.x - V.cx, dz = q.z - V.cz; return { u: dx * ex + dz * ez, v: -dx * ez + dz * ex }; };
  const a = uv(p.jij), b = uv(p.mark);
  const vrij = (q) => { const [x, z] = W.resolveCollisions(q.x, q.z, 0.3); return Math.hypot(x - q.x, z - q.z); };
  const pad = window.__LP.zoekLooppad(p.parkeer, p.jij, { laag: 0.7 });
  return { va: Math.abs(a.v) - hb, vb: Math.abs(b.v) - hb, ua: a.u, hl, duw: Math.max(vrij(p.jij), vrij(p.mark)), pad: pad ? pad.length : 0,
    dPark: Math.hypot(p.parkeer.x - p.jij.x, p.parkeer.z - p.jij.z) };
});
ok(plek.va > 0.2 && plek.va < 1.5 && plek.vb > 0.2 && plek.vb < 1.5, 'tussen de zijlijn en de reclameborden (die staan op 1,6 m)', `${r1(plek.va)} en ${r1(plek.vb)} m achter de lijn`);
ok(Math.abs(plek.ua) < plek.hl - 10, 'langs de lange kant, niet bij een doel', `${r1(plek.ua)} m van de middenlijn`);
ok(plek.duw < 0.05, 'vrij van botsdozen', `${plek.duw.toFixed(2)} m geduwd`);
ok(plek.pad > 1, 'te voet te halen vanaf het clubparkeerterrein', `${plek.pad} punten, ${r1(plek.dPark)} m hemelsbreed`);

// ------------------------------------------------------------------ 5. aankomen en kijken
kop('aan de lijn');
const lijn = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, w = g.wedstrijd;
  const p = v.uitje.plek, a = P.inCar;
  window.__wachtDicht();
  // rijden tot het parkeerterrein (verschoven, niet gereden: de rit zelf is gewoon rijden)
  a.x = p.parkeer.x; a.z = p.parkeer.z; a.speed = 0;
  if (a.mesh) a.mesh.position.set(a.x, a.mesh.position.y, a.z);
  window.__stap(4);
  const na = { fase: v.uitje.fase, mark: v.mark.groep.visible, dMark: Math.hypot(v.mark.groep.position.x - a.x, v.mark.groep.position.z - a.z) };
  // uitstappen, Mark loopt
  P.inCar = null; P.pos.set(a.x + 2, 0, a.z); P.applyCamera();
  let t = 0;
  const mp = v.mark.groep.position;
  for (; t < 120 && Math.hypot(mp.x - p.mark.x, mp.z - p.mark.z) > 0.5; t += 0.05) window.__stap(1);
  const markEr = { t, d: Math.hypot(mp.x - p.mark.x, mp.z - p.mark.z) };
  // jij erbij
  window.__zet(p.jij.x, p.jij.z);
  window.__stap(4);
  const kijken = { fase: v.uitje.fase, opdracht: document.getElementById('opdracht').textContent };
  window.__wachtDicht();
  // biertjes
  window.__leven = true;
  P.health = 60;
  window.__E(); window.__stap(1);
  const na1 = { flesjes: v.uitje.flesjes, leven: P.health, dronken: P.dronken || 0 };
  window.__E(); window.__stap(1); window.__E(); window.__stap(1);
  const na3 = { flesjes: v.uitje.flesjes, dronken: P.dronken || 0 };
  window.__regels.length = 0;
  for (let i = 0; i < 4; i++) { window.__E(); window.__stap(1); window.__wachtDicht(); }
  const na7 = { flesjes: v.uitje.flesjes, regels: window.__regels.join(' / ') };
  window.__leven = false; P.dronken = 0;
  // een doelpunt voor Sneek
  window.__wachtDicht();
  window.__regels.length = 0;
  w.st.stand[0]++;
  window.__stap(2);
  const goal = { regels: window.__regels.join(' / '), stand: w.stand.join('-') };
  window.__wachtDicht();
  return { na, markEr, kijken, na1, na3, na7, goal, missie: v.missie };
});
ok(lijn.na.fase === 'lopen' && lijn.na.mark && lijn.na.dMark < 4, 'bij het parkeerterrein: Mark stapt uit', `${r1(lijn.na.dMark)} m van de auto`);
ok(lijn.markEr.d < 0.5, 'Mark loopt naar de lijn', `na ${r1(lijn.markEr.t)} s, ${r1(lijn.markEr.d)} m van zijn plek`);
ok(lijn.kijken.fase === 'kijken' && /biertje/.test(lijn.kijken.opdracht), 'jij erbij: kijken', lijn.kijken.opdracht);
ok(lijn.na1.flesjes === 1 && lijn.na1.leven === 72 && lijn.na1.dronken === 0, 'E: een biertje van Mark, 12 leven erbij', `${lijn.na1.leven} leven`);
ok(lijn.na3.flesjes === 3 && lijn.na3.dronken > 0, 'vanaf het derde de waas', `dronken ${lijn.na3.dronken.toFixed(2)}`);
ok(lijn.na7.flesjes === 6 && /genoeg/.test(lijn.na7.regels), 'na zes is het genoeg', lijn.na7.regels);
ok(/Sneek|goal|Daar/.test(lijn.goal.regels) && lijn.goal.regels.includes(lijn.goal.stand), 'een doelpunt voor Sneek: Mark juicht, met de stand', lijn.goal.regels);
ok(lijn.missie === 'klaar', 'nog steeds vrij spelen');

// ------------------------------------------------------------------ 6. mooi geweest
kop('mooi geweest');
const einde = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const u = v.uitje;
  window.__regels.length = 0;
  u.zetKijkT(u.KIJK + 1);
  window.__stap(2);
  window.__klik();
  const na = { fase: v.uitje.fase, loopt: g.sfeer.loopt, keer: v.uitje.keer, regels: window.__regels.join(' / '), mark: v.mark.groep.visible };
  // een eind weg: Mark naar huis, en na een poos de M weer
  window.__zet(P.pos.x + 200, P.pos.z);
  window.__stap(4);
  const weg = { fase: v.uitje.fase, mark: v.mark.groep.visible };
  const fase = window.__totM();
  return { na, weg, fase, letter: g.hud.nav && g.hud.nav.letter };
});
ok(einde.na.fase === 'na' && /Mooi geweest/.test(einde.na.regels) && einde.na.mark, 'na de kijktijd: "Mooi geweest", Mark blijft nog even', einde.na.regels.slice(0, 80));
ok(einde.na.loopt === true, 'de klok loopt weer');
ok(einde.weg.fase === 'rust' && !einde.weg.mark, 'een eind weg: Mark is naar huis');
ok(einde.fase === 'wacht' && einde.letter === 'M', 'na een poos staat de M er weer');

// ------------------------------------------------------------------ 7. weglopen, en stilleggen
kop('weglopen en stilleggen');
const anders = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, w = g.wedstrijd;
  const naarDeLijn = () => {
    window.__binnen(); v.kiesHuis(1); window.__klik(); window.__totLicht(); window.__wachtDicht();
    const p = v.uitje.plek, a = g.player.inCar;
    a.x = p.parkeer.x; a.z = p.parkeer.z; a.speed = 0; window.__stap(4);
    window.__zet(p.jij.x, p.jij.z); window.__stap(4); window.__wachtDicht();
    return v.uitje.fase;
  };
  // (de wedstrijd van vandaag is al geweest: dan de volgende middag)
  window.__uur(16); w.weg(); w.st.dag = g.wedDag;
  const dag0 = g.wedDag;
  const f1 = naarDeLijn();
  const nieuweDag = { aanwezig: w.aanwezig, dag: g.wedDag - dag0, uur: g.sfeer.uur, overgang: document.getElementById('overgangtekst').textContent };
  window.__regels.length = 0;
  window.__zet(g.player.pos.x + 90, g.player.pos.z);
  window.__stap(3);
  const weg = { fase: v.uitje.fase, regels: window.__regels.join(' / ') };
  window.__zet(g.player.pos.x + 300, g.player.pos.z); window.__stap(3);
  window.__totM();
  const f2 = naarDeLijn();
  window.__regels.length = 0;
  w.raak(w.spelers[5].p.groep);
  window.__stap(3);
  const stil = { fase: v.uitje.fase, regels: window.__regels.join(' / '), gestaakt: w.gestaakt };
  window.__zet(g.player.pos.x + 300, g.player.pos.z); window.__stap(3);
  return { f1, nieuweDag, weg, f2, stil };
});
ok(anders.f1 === 'kijken' && anders.nieuweDag.aanwezig && anders.nieuweDag.dag === 1 && anders.nieuweDag.overgang === 'De volgende middag…', 'om vier uur gekozen, de wedstrijd van vandaag al geweest: de volgende middag', JSON.stringify(anders.nieuweDag));
ok(anders.weg.fase === 'na' && /Ga je al/.test(anders.weg.regels), 'weglopen: "Ga je al? Ik blijf nog even kijken."', anders.weg.regels);
ok(anders.f2 === 'kijken' && anders.stil.gestaakt && anders.stil.fase === 'na' && /gek geworden/.test(anders.stil.regels), 'een speler neerschieten: gestaakt, en Mark is er klaar mee', anders.stil.regels);

// ------------------------------------------------------------------ 8. de bank
kop('de bank');
const bank = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, w = g.woningen[0];
  window.__totM();
  window.__uur(14);
  window.__binnen();
  window.__leven = true; P.health = 50;
  v.kiesHuis(2);
  window.__klik();
  const zit = P.zit, mp = v.mark.groep.position, dMark = Math.hypot(mp.x - P.pos.x, mp.z - P.pos.z);
  window.__totLicht();
  window.__klik();
  window.__leven = false;
  const na = { fase: v.uitje.fase, uur: g.sfeer.uur, leven: P.health, overgang: document.getElementById('overgangtekst').textContent };
  // opstaan en naar buiten
  window.__zet(w.plekken.stoep.x, w.plekken.stoep.z);
  window.__stap(4);
  return { zit, dMark, na, weg: { fase: v.uitje.fase, mark: v.mark.groep.visible } };
});
ok(bank.zit && bank.dMark > 0.5 && bank.dMark < 1.6, 'je gaat zitten, Mark schuift op', `${r1(bank.dMark)} m naast je`);
ok(bank.na.overgang === 'Een paar uur later…' && Math.abs(bank.na.uur - 17) < 0.3 && bank.na.leven === 100, '"Een paar uur later…": drie uur later, vol leven', `${r1(bank.na.uur)} uur, ${bank.na.leven} leven`);
ok(bank.na.fase === 'na' && bank.weg.fase === 'rust' && !bank.weg.mark, 'naar buiten: Mark blijft thuis, de M komt later terug');

// ------------------------------------------------------------------ 9. de keuze open, laden, de geldrace
kop('open laten, laden, en de rest van vrij spelen');
const rest = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, w = g.woningen[0];
  window.__totM();
  window.__binnen();
  window.__zet(w.plekken.stoep.x, w.plekken.stoep.z);
  window.__stap(30);
  const open = { fase: v.uitje.fase, mark: v.mark.groep.visible, opdracht: document.getElementById('opdracht').hidden || document.getElementById('opdracht').textContent === '' };
  // laden midden in de rit
  window.__totM();
  window.__binnen(); v.kiesHuis(1); window.__klik(); window.__totLicht();
  const tijdens = { fase: v.uitje.fase, loopt: g.sfeer.loopt };
  const s = v.bewaar();
  v.herstel(s); window.__stap(2);
  const geladen = { fase: v.uitje.fase, loopt: g.sfeer.loopt, mark: v.mark.groep.visible, missie: v.missie, nav: g.hud.nav && g.hud.nav.letter };
  // de geldrace bij de balie gaat gewoon
  const b = g.garage.plekken.balie; window.__zet(b.x + 1.2, b.z); window.__stap(2);
  window.__regels.length = 0;
  window.__E(); window.__klik();
  const geld = window.__regels.join(' / ');
  return { open, tijdens, geladen, geld };
});
ok(rest.open.fase === 'wacht' && !rest.open.mark, 'de keuze open laten en naar buiten: Mark blijft binnen, de M staat er weer');
ok(rest.tijdens.fase === 'rijden' && rest.tijdens.loopt === false && rest.geladen.fase === 'rust' && rest.geladen.loopt === true && !rest.geladen.mark && rest.geladen.missie === 'klaar',
  'laden tijdens de rit: geen uitje meer, de klok loopt weer', JSON.stringify(rest.geladen));
ok(/inleg|Hoeveel/i.test(rest.geld), 'en de geldrace bij Sjoerd werkt na het einde nog', rest.geld.slice(0, 80));

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);

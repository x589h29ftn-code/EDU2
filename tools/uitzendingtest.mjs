/*
 Missie 18, De uitzending (stap 107): de studio van Radio Tinga en het einde van het spel.

   node tools/server.mjs 8123 &   node tools/uitzendingtest.mjs [poort]   (npm run uitzendingtest)

 1. Na missie 17 staat hij klaar; shift en de / start hem los.
 2. De studio gemeten: het pand aan de Tinga, de ingang aan de straatkant, de mast op het dak, de
    zuil vrij van de deur; binnen het bureau met vijf schermen, twee mengpanelen en twee
    microfoons, de dj op zijn stoel, en een vrije weg van de deur naar de tafel.
 3. Het fragment: audio/radio/uitzending.mp3 laadt en duurt 40,2 s.
 4. Mark belt; de M bij de Wieken 29; binnen het plan met Mark en Johan; naar buiten: "Die nacht…" (de
    avond zelf staat in tools/avondtest.mjs), en daarna zondagochtend.
 5. Bij Radio Tinga: de deur zit dicht tot Johan gebeld heeft; dan een minuut, de dj weg.
 6. Binnen: E de stick erin, E de schuif omhoog; ON AIR; de montage met het fragment (zeven shots,
    geen camera in een muur); de radio en de muziek zwijgen eronder; Sjors komt terug.
 7. Buiten: Mark en Johan, € 10.000, "Die avond…", het filmbeeld voor de Wieken bij zonsondergang,
    de titelrol, en dan vrij spelen: geen missie meer, Radio Tinga zendt het fragment opnieuw uit.
 8. Te laat: Sjors komt terug en de missie mislukt.
 9. De opslag.
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
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const { KAART } = await import('/js/kaartwereld.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  g.sfeer.uur = 10;
  g.geluid.start();
  window.__W = W; window.__K = KAART;
  window.__meld = [];
  const echt = g.hud.melding.bind(g.hud);
  g.hud.melding = (k, o, t) => { window.__meld.push(`${k}|${o}`); return echt(k, o, t); };
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); for (const r of [g.studio]) r.update(dt, v.aanspreekbaar); } };
  window.__klik = (max = 80) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__tot = (fase, maxS = 20, dt = 0.05) => {
    for (let t = 0; t < maxS && v.fase !== fase; t += dt) { window.__stap(1, dt); if (!document.getElementById('dialoog').hidden) v.toets(); }
    return v.fase === fase;
  };
  window.__zet = (x, z, y = 0) => { if (g.player.inCar) { g.player.inCar.speed = 0; g.player.inCar = null; } g.player.pos.set(x, y, z); g.player.applyCamera(); };
  // E zoals in het spel: eerst het verhaal, dan de binnenruimtes
  window.__E = () => { const was = g.player.active; g.player.active = true; if (!v.toets()) for (const r of [...g.woningen, g.boerderij, g.supermarkt, g.studio]) if (r.toets && r.toets()) break; g.player.active = was; };
  window.__na17 = (extra = {}) => {
    const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
    Object.assign(s, { schaduwKlaar: true, raceKlaar: true, brugKlaar: true, schriftKlaar: true, invalKlaar: true, invalKeus: 2,
      invalTelefoon: true, ronaldKlaar: true, ronaldPraatte: true, uitzendingKlaar: false, huisGekozen: s.huisGekozen || 'Koningsspil 20' }, extra);
    g.politie.reset();
    v.herstel(s);
  };
});

// ------------------------------------------------------------------ 1. na missie 17
kop('na missie 17');
const na17 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__na17();
  window.__stap(10);
  const volgende = v.volgendeMissie;
  // shift en / start hem los (js/main.js)
  g.player.active = true;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Slash', key: '/', shiftKey: true, bubbles: true }));
  g.player.active = false;
  return { volgende, missie: v.missie };
});
ok(na17.volgende && na17.volgende.naam === 'uitzending', 'na Wie is R. staat De uitzending klaar', JSON.stringify(na17.volgende));
ok(na17.missie === 'uitzending', 'shift en / start missie 18', na17.missie);

// ------------------------------------------------------------------ 2. de studio gemeten
kop('de studio');
const studio = await page.evaluate(() => {
  const g = window.__game, W = window.__W, K = window.__K, st = g.studio;
  if (!st || !st.plekken) return { geen: true };
  const P = st.plekken, M = st.maten;
  const pand = K.panden.find(p => p.type === 'zorg');
  const binnenVoet = (x, z) => {
    let i = false; const r = pand.voet;
    for (let a = 0, b = r.length - 1; a < r.length; b = a++) {
      const [xa, za] = r[a], [xb, zb] = r[b];
      if ((za > z) !== (zb > z) && x < (xb - xa) * (z - za) / (zb - za) + xa) i = !i;
    }
    return i;
  };
  // de dichtstbijzijnde as bij de stoep (ook een voetpad), en de dichtstbijzijnde weg voor auto's
  let weg = null, rijweg = null;
  for (const w of K.wegassen) {
    for (let i = 1; i < w.pts.length; i++) {
      if (!w.drive) break;
      const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i];
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((P.stoep.x - ax) * dx + (P.stoep.z - az) * dz) / L2));
      const d = Math.hypot(ax + dx * t - P.stoep.x, az + dz * t - P.stoep.z);
      if (!rijweg || d < rijweg.d) rijweg = { d, naam: w.naam };
    }
    for (let i = 1; i < w.pts.length; i++) {
      if (!w.naam) break;                            // (paden zonder naam tellen hier niet)
      const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i];
      const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((P.stoep.x - ax) * dx + (P.stoep.z - az) * dz) / L2));
      const d = Math.hypot(ax + dx * t - P.stoep.x, az + dz * t - P.stoep.z);
      if (!weg || d < weg.d) weg = { d, naam: w.naam };
    }
  }
  const [sx, sz] = W.resolveCollisions(P.stoep.x, P.stoep.z, 0.4);
  // de weg van de deur binnen naar de tafel, om de stoel en het bureau heen
  const N = P.nul, C = { x: N.x + M.stoel.x, z: N.z + M.stoel.z };
  const route = [[P.deurBinnen.x, P.deurBinnen.z], [C.x - 1.9, C.z - 1.6], [P.tafel.x, P.tafel.z]];
  let geduwd = 0;
  for (let i = 1; i < route.length; i++) {
    const [ax, az] = route[i - 1], [bx, bz] = route[i];
    for (let k = 0; k <= 20; k++) {
      const x = ax + (bx - ax) * k / 20, z = az + (bz - az) * k / 20;
      const [rx, rz] = W.resolveCollisions(x, z, 0.32);
      geduwd = Math.max(geduwd, Math.hypot(rx - x, rz - z));
    }
  }
  const dj = st.dj.groep.position;
  return {
    pandBreed: M.pandBreed, deurOpVoet: binnenVoet(P.deurBuiten.x - P.f[0] * 0.5, P.deurBuiten.z - P.f[1] * 0.5),
    stoepVrij: Math.hypot(sx - P.stoep.x, sz - P.stoep.z), stoepBuiten: !binnenVoet(P.stoep.x, P.stoep.z),
    weg, rijweg, mastOpDak: binnenVoet(P.mast.x, P.mast.z), mastVoet: P.mast.voet, dak: M.dak, mastTop: P.mast.top,
    zuilDeur: Math.hypot(P.zuil.x - P.deurBuiten.x, P.zuil.z - P.deurBuiten.z), zuilBuiten: !binnenVoet(P.zuil.x, P.zuil.z),
    schermen: M.schermen, panelen: M.panelen, microfoons: M.microfoons,
    djOpStoel: Math.hypot(dj.x - P.stoel.x, dj.z - P.stoel.z), djZit: st.djZit, djZichtbaar: st.dj.groep.visible,
    geduwd, onAir: st.onAir, usb: st.usb, schuif: st.schuif,
    binnenDeurBinnen: st.binnen(P.deurBinnen.x, P.deurBinnen.z), buitenNietBinnen: !st.binnen(P.stoep.x, P.stoep.z),
  };
});
ok(!studio.geen, 'Radio Tinga staat in de wereld (js/studio.js)');
ok(studio.weg && studio.weg.d < 12 && /^tinga$/i.test(studio.weg.naam || ''), 'aan de Tinga: het pad met die naam loopt langs de ingang', studio.weg ? `${studio.weg.naam}, ${studio.weg.d.toFixed(1)} m van de stoep` : '');
ok(studio.rijweg && studio.rijweg.d < 60, 'en met de auto kom je er: een weg op loopafstand', studio.rijweg ? `${studio.rijweg.naam}, ${studio.rijweg.d.toFixed(0)} m` : '');
ok(studio.deurOpVoet && studio.stoepBuiten && studio.stoepVrij < 0.05, 'de ingang op de gevel, de stoep ervoor vrij', `geduwd ${studio.stoepVrij.toFixed(2)} m`);
ok(studio.mastOpDak && studio.mastVoet === studio.dak && studio.mastTop > 20, 'de zendmast staat op het dak en steekt erboven uit', `dak ${studio.dak} m, top ${studio.mastTop.toFixed(1)} m`);
ok(studio.zuilDeur > 2.5 && studio.zuilBuiten, 'de zuil met het merk staat naast de deur, niet ervoor', `${studio.zuilDeur.toFixed(1)} m`);
ok(studio.schermen === 5 && studio.panelen === 2 && studio.microfoons === 2, 'het bureau zoals op de foto: vijf schermen, twee mengpanelen, twee microfoons');
ok(studio.djZichtbaar && studio.djZit && studio.djOpStoel < 0.2, 'de dj zit aan tafel', `${studio.djOpStoel.toFixed(2)} m van de stoel`);
ok(studio.geduwd < 0.02, 'van de deur om de stoel heen naar de tafel: nergens een muur of het bureau in de weg', `${(studio.geduwd * 100).toFixed(0)} cm`);
ok(!studio.onAir && !studio.usb && studio.schuif === 0, 'ON AIR uit, geen stick, de schuif dicht');
ok(studio.binnenDeurBinnen && studio.buitenNietBinnen, 'binnen is binnen, de stoep is buiten');

// ------------------------------------------------------------------ 3. het fragment
kop('het fragment');
const mp3 = await page.evaluate(async () => {
  const g = window.__game;
  await g.geluid.laadUitzending();
  return g.geluid.uitzendingStand();
});
ok(mp3.geladen && Math.abs(mp3.duur - 40.2) < 0.4, 'audio/radio/uitzending.mp3 laadt', `${mp3.duur.toFixed(2)} s, ${mp3.kanaal} kanaal`);

// ------------------------------------------------------------------ 4. het telefoontje en het plan
kop('het telefoontje en het plan');
const plan = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, w = g.woningen[1];
  v.startMissie('uitzending');
  window.__stap(40);
  const naam = document.getElementById('dialoogNaam').textContent;
  const tel = !document.getElementById('dialoog').hidden;
  window.__klik();
  const fase1 = v.fase, nav = g.hud.nav && g.hud.nav.letter;
  const d = w.plekken.deurBinnen;
  window.__zet(d.x, d.z);
  window.__stap(4);
  const fase2 = v.fase, markZit = v.mark.groep.visible, johan = v.uitzending.johan.groep.visible;
  const namen = new Set(), tekst = [];
  for (let i = 0; i < 60 && !document.getElementById('dialoog').hidden; i++) {
    namen.add(document.getElementById('dialoogNaam').textContent); tekst.push(document.getElementById('dialoogTekst').textContent);
    v.toets(); window.__stap(1);
  }
  const fase3 = v.fase;
  // naar buiten: eerst de avond (de heli, Bouwman: tools/avondtest.mjs), dan zondagochtend
  const s = w.plekken.stoep;
  window.__zet(s.x, s.z);
  const avond = window.__tot('heliStart', 12);
  const avondUur = g.sfeer.uur;
  // de avond overslaan: verder bij zondagochtend
  const s2 = v.bewaar(); s2.missie = 'uitzending'; s2.fase = 'naarStudio';
  v.herstel(s2);
  window.__stap(2);
  const ochtend = v.fase === 'naarStudio';
  return { naam, tel, fase1, nav, fase2, markZit, johan, namen: [...namen], fase3, ochtend, avond, avondUur, uur: g.sfeer.uur,
    zit: g.player.zit, heli: v.avond.heli.zichtbaar,
    stick: tekst.some(t => /usb|stick/i.test(t)) || tekst.some(t => /Veertig seconden/.test(t)),
    heliPlan: tekst.some(t => /heli/.test(t)) && tekst.some(t => /Bouwman/.test(t)) };
});
ok(plan.tel && plan.naam === 'Mark', 'Mark belt', plan.naam);
ok(plan.fase1 === 'naarWieken' && plan.nav === 'M', 'een M bij de Wieken 29', `${plan.fase1}, ${plan.nav}`);
ok(plan.fase2 === 'plan' && plan.markZit && plan.johan, 'binnen: Mark op de bank, Johan aan tafel', plan.fase2);
ok(plan.namen.includes('Mark') && plan.namen.includes('Johan') && plan.fase3 === 'klaarmaken', 'het plan, met Mark en Johan', plan.fase3);
ok(plan.stick && plan.heliPlan, 'het plan: vanavond Bouwman, met een heli, en de usb-stick voor morgen');
ok(plan.avond && Math.abs(plan.avondUur - 1) < 0.1, 'naar buiten: "Die nacht…", één uur, de heli', `uur ${plan.avondUur.toFixed(2)}`);
ok(plan.ochtend && Math.abs(plan.uur - 7.75) < 0.1 && !plan.zit && !plan.heli, 'en daarna zondagochtend, kwart voor acht (de heli weg, niet meer zitten)', `uur ${plan.uur.toFixed(2)}`);

// ------------------------------------------------------------------ 5. bij Radio Tinga
kop('bij Radio Tinga');
const deur = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, st = g.studio, P = st.plekken, U = v.uitzending;
  const nav = g.hud.nav && g.hud.nav.letter;
  const j = U.johan.groep.position, johanBijDeur = Math.hypot(j.x - P.deurBuiten.x, j.z - P.deurBuiten.z);
  // naar Johan (hij staat naast de deur, dus wie bij de deur komt, praat met hem)
  window.__zet(j.x + P.f[0] * 1.5, j.z + P.f[1] * 1.5);
  window.__stap(4);
  const praat = !document.getElementById('dialoog').hidden && document.getElementById('dialoogNaam').textContent;
  window.__klik();
  const fase1 = v.fase;
  // Johan gaat naar binnen; de deur zit dicht tot hij belt
  window.__zet(P.deurBuiten.x + P.f[0] * 1.2, P.deurBuiten.z + P.f[1] * 1.2);
  window.__stap(1);
  window.__meld = [];
  window.__E();
  const dicht = !st.binnen(g.player.pos.x, g.player.pos.z) && window.__meld.some(m => /Johan/.test(m));
  const gebeld = window.__tot('binnen', 30);
  const tekst = document.getElementById('dialoogTekst').textContent;
  window.__stap(2);
  return { nav, johanBijDeur, dicht, praat, fase1, gebeld, tekst, klok: v.uitzending.klok, djWeg: !st.dj.groep.visible,
    johanWeg: !U.johan.groep.visible, balk: !document.getElementById('schaduwbalk').hidden };
});
ok(deur.nav === 'M', 'de navigatie naar Radio Tinga');
ok(deur.johanBijDeur < 4, 'Johan wacht bij de ingang', `${deur.johanBijDeur.toFixed(1)} m van de deur`);
ok(deur.dicht, 'de deur zit dicht zolang Johan niet gebeld heeft');
ok(deur.praat === 'Johan' && deur.fase1 === 'wachten', 'Johan legt het uit ("Bouwman is verleden tijd") en gaat naar binnen', `${deur.praat}, ${deur.fase1}`);
ok(deur.gebeld && /Nu/.test(deur.tekst) && deur.johanWeg, 'Johan belt: "Nu."', deur.tekst);
ok(deur.klok > 50 && deur.balk && deur.djWeg, 'een minuut in de balk, en de stoel van de dj is leeg', `${deur.klok.toFixed(1)} s`);

// ------------------------------------------------------------------ 6. de stick, de schuif, de uitzending
kop('de stick en de schuif');
const lucht = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, st = g.studio, P = st.plekken, W = window.__W;
  // de speler doet mee (de hints aan de tafel tonen alleen voor een actieve speler)
  g.player.active = true;
  window.__zet(P.deurBuiten.x + P.f[0] * 1.2, P.deurBuiten.z + P.f[1] * 1.2);
  window.__stap(1);
  window.__E();
  const binnen = st.binnen(g.player.pos.x, g.player.pos.z);
  window.__zet(P.tafel.x, P.tafel.z);
  window.__stap(2);
  const hint1 = document.getElementById('praat').hidden ? '' : document.getElementById('praat').textContent;
  window.__E(); window.__stap(30);
  const usb = st.usb;
  const hint2 = document.getElementById('praat').hidden ? '' : document.getElementById('praat').textContent;
  window.__E(); window.__stap(1);
  const U = v.uitzending;
  g.player.active = false;
  return { binnen, hint1, usb, hint2, fase: v.fase, film: U.film, shots: U.shots, duur: U.duur, onAir: st.onAir, schuif: st.schuif,
    geluid: g.geluid.uitzendingStand() };
});
ok(lucht.binnen, 'na het telefoontje gaat de deur open');
ok(/usb-stick/.test(lucht.hint1) && lucht.usb, 'E aan de tafel: de stick in het mengpaneel', lucht.hint1);
ok(/schuif/.test(lucht.hint2), 'en dan: de rode schuif omhoog', lucht.hint2);
ok(lucht.fase === 'uitzending' && lucht.film === 'uitzending' && lucht.onAir && lucht.schuif === 1, 'de schuif omhoog, ON AIR brandt, het filmbeeld begint');
ok(Math.abs(lucht.duur - 40.2) < 0.4 && lucht.shots >= 6, 'de montage duurt zo lang als het fragment', `${lucht.duur.toFixed(1)} s, ${lucht.shots} shots`);
ok((lucht.geluid.speelt || lucht.geluid.wil) && lucht.geluid.gedempt, 'het fragment speelt, en de radio en de muziek zwijgen eronder');

const montage = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, W = window.__W, st = g.studio, N = st.plekken.nul, M = st.maten;
  const gezien = new Set(), inMuur = new Set(), dt = 0.1;
  let t = 0;
  while (t < 60 && v.uitzending.film === 'uitzending') {
    window.__stap(1, dt); t += dt;
    const U = v.uitzending;
    if (U.film !== 'uitzending' || !U.filmCam) continue;
    gezien.add(U.shot);
    const [x, y, z] = U.filmCam.pos;
    if (st.binnen(x, z)) {
      // in de studio: binnen de wanden en onder het plafond
      if (x < N.x + 0.2 || x > N.x + M.breed - 0.2 || z < N.z + 0.2 || z > N.z + M.diep - 0.2 || y > M.plafond - 0.1) inMuur.add(U.shot);
    } else if (y < 6) {
      // buiten, onder de daken: niet in een gebouw of een schuurtje (elk beeld gemeten)
      const [rx, rz] = W.resolveCollisions(x, z, 0.25);
      if (Math.hypot(rx - x, rz - z) > 0.01) inMuur.add(U.shot);
    }
  }
  const na = { fase: v.fase, film: v.uitzending.film, dj: g.studio.dj.groep.visible };
  const sjors = !document.getElementById('dialoog').hidden ? document.getElementById('dialoogNaam').textContent : '';
  const klaarT = t;
  for (let i = 0; i < 200 && v.fase !== 'naarBuiten'; i++) { window.__stap(1, 0.05); if (!document.getElementById('dialoog').hidden) v.toets(); }
  return { gezien: gezien.size, inMuur: [...inMuur], na, sjors, klaarT, fase: v.fase, film: v.uitzending.film };
});
ok(montage.gezien >= 6, 'alle shots van de montage komen voorbij', `${montage.gezien} shots in ${montage.klaarT.toFixed(1)} s`);
ok(montage.inMuur.length === 0, 'geen camera in een muur of een gebouw', montage.inMuur.join(', ') || 'geen');
ok(montage.na.film === 'terug' && montage.na.dj && montage.sjors === 'Sjors', 'na het fragment: Sjors staat in de deur met zijn koffie', `${montage.na.film}, ${montage.sjors}`);
ok(montage.fase === 'naarBuiten' && !montage.film, 'en dan weer zelf: naar buiten', montage.fase);

// ------------------------------------------------------------------ 7. buiten, de avond, het einde
kop('het einde');
const einde = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, st = g.studio, P = st.plekken;
  const geld0 = v.geld;
  // terug naar de deur en naar buiten
  window.__zet(P.deurBinnen.x, P.deurBinnen.z);
  window.__stap(2);
  window.__E();
  const buiten = !st.binnen(g.player.pos.x, g.player.pos.z);
  window.__stap(6);
  const markBuiten = v.mark.groep.visible && v.uitzending.johan.groep.visible;
  window.__meld = [];
  window.__klik();
  const geld1 = v.geld, geslaagd = window.__meld.some(m => /MISSIE GESLAAGD – DE UITZENDING/.test(m));
  const herhaling = g.geluid.uitzendingStand().herhaling;
  const avond = window.__tot('einde', 14);
  window.__stap(2);
  const uur = g.sfeer.uur, film = v.uitzending.film, beiden = v.mark.groep.visible && v.uitzending.johan.groep.visible;
  const namen = new Set();
  let titel = false, hoog = 0;
  for (let t = 0; t < 30 && !titel; t += 0.1) {
    window.__stap(1, 0.1);
    if (!document.getElementById('dialoog').hidden) namen.add(document.getElementById('dialoogNaam').textContent);
    const c = v.uitzending.filmCam; if (c) hoog = Math.max(hoog, c.pos[1]);
    titel = !!v.uitzending.titelrol;
  }
  const el = document.getElementById('titelrol');
  const zichtbaar = getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 100;
  // en hij ligt bovenop: niet onder het zwart van de overgang of de filmbalken
  const midden = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  const boven = !!midden && (midden === el || el.contains(midden));
  const tekst = el.textContent;
  window.__stap(20, 0.1);
  window.__meld = [];
  // E klikt de titelrol weg
  window.__E();
  window.__stap(4);
  return { geld0, geld1, buiten, markBuiten, geslaagd, herhaling, avond, uur, film, beiden, namen: [...namen], hoog,
    titel, zichtbaar, boven, tekst, missie: v.missie, weg: getComputedStyle(el).display === 'none',
    vrij: window.__meld.some(m => /VRIJ SPELEN/.test(m)), volgende: v.volgendeMissie };
});
ok(einde.buiten && einde.markBuiten, 'buiten staan Mark en Johan');
ok(einde.geslaagd && einde.geld1 - einde.geld0 === 10000, 'MISSIE GESLAAGD, € 10.000', `+ € ${einde.geld1 - einde.geld0}`);
ok(einde.herhaling, 'Radio Tinga zendt het fragment voortaan af en toe opnieuw uit');
ok(einde.avond && Math.abs(einde.uur - 20.5) < 0.1 && einde.film === 'einde' && einde.beiden, '"Die avond…": voor de Wieken 29, met Mark en Johan', `uur ${einde.uur.toFixed(2)}, ${einde.film}`);
ok(einde.namen.includes('Mark') && einde.namen.includes('Johan') && einde.namen.includes('Erik'), 'het laatste gesprek', einde.namen.join(', '));
ok(einde.hoog > 60, 'de camera stijgt op over de daken, naar de mast', `${einde.hoog.toFixed(0)} m`);
ok(einde.titel && einde.zichtbaar && /Tinga is van jou/.test(einde.tekst) && /Bouwman/.test(einde.tekst), 'de titelrol', einde.tekst.slice(0, 60));
ok(einde.boven, 'en hij ligt bovenop, ook boven het zwart van de overgang');
ok(einde.weg && einde.missie === 'klaar' && einde.vrij && !einde.volgende, 'en dan vrij spelen: geen missie meer', `${einde.missie}, volgende ${JSON.stringify(einde.volgende)}`);

// ------------------------------------------------------------------ 8. te laat
kop('te laat');
const laat = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, st = g.studio, P = st.plekken;
  window.__na17();
  v.startMissie('uitzending');
  const s = v.bewaar(); s.missie = 'uitzending'; s.fase = 'naarStudio';
  v.herstel(s);
  window.__stap(4);
  const j = v.uitzending.johan.groep.position;
  window.__zet(j.x + P.f[0] * 1.5, j.z + P.f[1] * 1.5);
  window.__stap(4);
  window.__klik();
  window.__tot('binnen', 30);
  window.__meld = [];
  const misluktNu = () => window.__meld.some(m => /MISSIE MISLUKT/.test(m));
  let t = 0;
  while (t < 75 && !misluktNu()) { window.__stap(1, 0.1); t += 0.1; }
  return { mislukt: misluktNu(), t, reden: window.__meld.find(m => /MISLUKT/.test(m)) || '' };
});
ok(laat.mislukt && laat.t > 59 && /Sjors/.test(laat.reden), 'na een minuut komt Sjors terug: mislukt', `${laat.t.toFixed(1)} s, ${laat.reden}`);

// ------------------------------------------------------------------ 9. de opslag
kop('de opslag');
const opslag = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__stap(80);           // de mislukking afwachten
  window.__na17({ uitzendingKlaar: true });
  const s = v.bewaar();
  g.geluid.zetHerhaling(false);
  v.herstel(s);
  window.__stap(10);
  return { klaar: s.uitzendingKlaar, herhaling: g.geluid.uitzendingStand().herhaling, volgende: v.volgendeMissie };
});
ok(opslag.klaar && opslag.herhaling && !opslag.volgende, 'opgeslagen na de uitzending: klaar, de herhaling staat aan, geen missie meer');

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);

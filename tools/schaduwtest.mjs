/*
 Missie 15: Bouwman schaduwen (verzoek 27 sep 2026).

   node tools/server.mjs 8123 &   node tools/schaduwtest.mjs [poort]

 1. Na de race belt Mark, en er komt een M bij Molenkrite 15.
 2. Binnen op de bank: het schrift, "opslag aan het water"; dan "Die avond…", om
    elf uur in de oude Golf van Mark bij het Autohuis, Bouwman bij de pomp van de BP.
 3. De route van Bouwman: van de BP door Duinterpen (langs Parelmoervlinder 3) en
    over de N7 naar zijn loods; geen keerpunt, geen sprong in hoogte, over de rijbaan. De loods staat vrij: geen pand,
    geen water, geen weg op het erf, en de drie fotoplekken liggen uit het zicht van
    de twee mannen.
 4. Goed volgen (een automaat die op 55 m achter hem blijft): hij stopt bij
    Parelmoervlinder 3, rijdt door naar de loods, en je bent nooit gezien of kwijt.
 5. Drie foto's, alleen recht naar het onderwerp kijkend; terug bij Mark € 1.500.
 6. Te dichtbij: gezien, twee sterren, mislukt, en opnieuw bij het Autohuis. Te ver:
    kwijt. In de Ferrari ziet hij je van verder.
 7. Gezien bij de loods: Bouwman gaat ervandoor, en Mark geeft de helft.
 8. Opslaan en laden, en shift+\ start hem los.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fout++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  localStorage.removeItem('tinga.spel.v1');
  localStorage.removeItem('tinga.checkpoint.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  geluid.start();
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) g.verhaal.update(dt); };
  window.__balkDicht = () => document.getElementById('dialoog').hidden;
  window.__gesprek = (max = 40) => {
    const regels = [];
    for (let i = 0; i < max && !window.__balkDicht(); i++) {
      regels.push({ wie: document.getElementById('dialoogNaam').textContent, tekst: document.getElementById('dialoogTekst').textContent,
        telefoon: document.getElementById('dialoog').classList.contains('telefoon') });
      g.praat();
      window.__stap(2);
    }
    return regels;
  };
  window.__nav = () => (g.hud.nav ? { letter: g.hud.nav.letter, x: g.hud.nav.doel[0], z: g.hud.nav.doel[1] } : null);
  window.__zet = (x, z) => { g.player.inCar = null; g.player.pos.set(x, 0, z); g.player.applyCamera(); };
  window.__zwartUit = () => { for (let i = 0; i < 400 && g.verhaal.zwart; i++) window.__stap(1); };
  // (de tekst van een melding blijft in het element staan: dus een vlag bij het melden zelf)
  window.__misluktNu = false; window.__misluktTekst = '';
  const meld = g.hud.melding.bind(g.hud);
  g.hud.melding = (kop, onder = '', tijd = 4) => { if (/MISLUKT/.test(kop)) { window.__misluktNu = true; window.__misluktTekst = onder; } return meld(kop, onder, tijd); };
  window.__mislukt = () => window.__misluktNu;
  // na een mislukking: wachten tot hij opnieuw is opgezet, en de vlag weer neer
  window.__naMislukking = () => {
    for (let i = 0; i < 160 && (g.verhaal.fase !== 'wacht' || !g.player.active || g.verhaal.zwart); i++) g.verhaal.update(0.05);
    window.__misluktNu = false;
  };
  // een auto kinematisch op de lijn van Bouwman zetten, `terug` meter achter hem
  window.__achter = (car, terug) => {
    const S = g.verhaal.schaduw.wereld, rit = g.verhaal.schaduw.rit;
    const s = Math.max(0, rit.s - terug), p = S.punt(s, S.opzij(s));
    car.x = p.x; car.z = p.z; car.yaw = p.yaw; car.rij = p.yaw; car.speed = rit.v;
    if (car.mesh) car.mesh.position.set(p.x, car.mesh.position.y, p.z);
    g.player.pos.set(p.x, 0, p.z);
  };
  /*
   De automaat: rijdt de Golf met het rijgedrag van de speler (js/vehicles.js
   `drive`) langs de lijn van Bouwman, en houdt de afstand langs de lijn op `gap`
   meter: harder als hij uitloopt, zachter (tot stilstaan) als hij inloopt, en
   rustig door de bochten.
  */
  window.__volg = (maxT = 420, gap = 55, dt = 0.1) => {
    const v = g.verhaal, S = v.schaduw.wereld, L = S.lijn, V = g.vehicles, car = g.player.inCar;
    let i = Math.max(0, Math.round((v.schaduw.rit.s - gap) / 2)), t = 0, dMin = Infinity, dMax = 0, stop = null, sprong = 0, vorigeY = null;
    let balk = null, marker = null, meestS = 0, spoorT = 0, vastT = 0, omT = 0;
    const spoor = [];
    const keys = {};
    while (t < maxT) {
      const sch = v.schaduw, rit = sch.rit, b = sch.auto;
      if (!rit || v.fase !== 'volgen' || window.__mislukt()) break;
      // (de route rijdt een rondje door Tinga over dezelfde straten: dus alleen vlak vóór de vorige plek zoeken)
      let bi = i, bd = Infinity;
      for (let j = Math.max(0, i - 3); j <= Math.min(L.n - 1, i + 12); j++) { const d = (L.x[j] - car.x) ** 2 + (L.z[j] - car.z) ** 2; if (d < bd) { bd = d; bi = j; } }
      i = bi;
      const p = { s: L.s[i], i };
      const snel = Math.abs(car.speed);
      const vi = Math.min(L.n - 1, i + Math.round((5 + snel * 0.45) / 2));
      // vast tegen iets (een auto die daar stilstaat)? Dan zoals een speler: even achteruit en eromheen
      if (snel < 1 && keys.KeyW) vastT += dt; else if (snel > 3) vastT = 0;
      if (vastT > 1.2 && omT <= 0) { omT = 3.5; vastT = 0; }
      const u = omT > 0 ? -1.3 : S.opzij(L.s[vi]);
      const q = S.punt(L.s[vi], u);
      let f = Math.atan2(-(q.x - car.x), -(q.z - car.z)) - car.yaw;
      while (f > Math.PI) f -= Math.PI * 2;
      while (f < -Math.PI) f += Math.PI * 2;
      let k = 0;
      for (let j = i; j < Math.min(L.n, i + 20); j++) k = Math.max(k, L.k[j]);
      const bocht = Math.min(24, Math.sqrt(5 / Math.max(k, 1e-4)));
      const kloof = rit.s - p.s;
      const doel = Math.max(0, Math.min(bocht, rit.v + (kloof - gap) * 0.35));
      keys.KeyA = f > 0.02; keys.KeyD = f < -0.02;
      keys.KeyW = snel < doel; keys.KeyS = snel > doel + 1.5;
      if (omT > 0) { omT -= dt; if (omT > 2.6) { keys.KeyW = false; keys.KeyS = true; keys.KeyA = !keys.KeyA; keys.KeyD = !keys.KeyD; } }
      V.drive(car, keys, dt);
      g.player.pos.set(car.x, 0, car.z);
      v.update(dt);
      const na = v.schaduw;
      if (na.afstand != null) { dMin = Math.min(dMin, na.afstand); dMax = Math.max(dMax, na.afstand); }
      if (rit.wacht > 0 && !stop) stop = { x: b.x, z: b.z, s: rit.s };
      if (b.mesh) { const y = b.mesh.position.y; if (vorigeY != null) sprong = Math.max(sprong, Math.abs(y - vorigeY)); vorigeY = y; }
      meestS = Math.max(meestS, rit.s);
      spoorT += dt;
      if (spoorT >= 1) {
        spoorT = 0;
        spoor.push({ t: Math.round(t), b: Math.round(rit.s), bv: +rit.v.toFixed(1), w: rit.wacht > 0, ik: Math.round(p.s), v: +car.speed.toFixed(1),
          naast: +Math.hypot(L.x[i] - car.x, L.z[i] - car.z).toFixed(1), d: na.afstand != null ? Math.round(na.afstand) : null });
        if (spoor.length > 25) spoor.shift();
      }
      if (!balk && t > 20) {
        const el = document.getElementById('schaduwbalk');
        balk = { zichtbaar: !el.hidden, tekst: el.querySelector('.tekst').textContent };
        marker = window.__nav();
        marker = marker && { letter: marker.letter, d: Math.hypot(marker.x - b.x, marker.z - b.z) };
      }
      t += dt;
    }
    return { t: +t.toFixed(1), fase: v.fase, dMin: +dMin.toFixed(1), dMax: +dMax.toFixed(1), stop, sprong: +sprong.toFixed(2),
      balk, marker, mislukt: window.__mislukt(), meestS: Math.round(meestS), spoor };
  };
});

// --------------------------------------------------------- na de race
kop('na de race belt Mark');
const bel = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  // een spel waarin de race net gewonnen is (missie 14 zelf: tools/racetest.mjs)
  const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.raceKlaar = true; s.schriftKlaar = true; s.brugKlaar = true;
  s.politieautoKlaar = true; s.veteraanKlaar = true; s.volgende = null; s.schaduwKlaar = false;
  v.herstel(s);
  const volgende = v.volgendeMissie;
  window.__stap(160);                          // de zes tellen van het laden, en het overgaan
  const telefoon = { missie: v.missie, fase: v.fase, balk: !window.__balkDicht(),
    telefoon: document.getElementById('dialoog').classList.contains('telefoon') };
  const regels = window.__gesprek();
  window.__stap(3);
  const d = g.woningen[0].plekken.deurBuiten;
  return { volgende, telefoon, regels, nav: window.__nav(), deur: { x: d.x, z: d.z }, fase: v.fase,
    melding: document.getElementById('missie').textContent };
});
ok(bel.volgende && bel.volgende.naam === 'schaduw', 'na de race staat missie 15 klaar', JSON.stringify(bel.volgende));
ok(bel.telefoon.missie === 'schaduw' && bel.telefoon.balk && bel.telefoon.telefoon, 'de telefoon gaat', JSON.stringify(bel.telefoon));
ok(bel.regels.some(r => r.wie === 'Mark') && bel.regels.some(r => /Bouwman/.test(r.tekst)), 'Mark belt over Bouwman', bel.regels.map(r => r.tekst).join(' ').slice(0, 90));
ok(bel.fase === 'naarMark' && bel.nav && bel.nav.letter === 'M' && Math.hypot(bel.nav.x - bel.deur.x, bel.nav.z - bel.deur.z) < 2, 'een M bij Molenkrite 15', JSON.stringify(bel.nav));
ok(/BOUWMAN SCHADUWEN/.test(bel.melding), 'NIEUWE MISSIE – BOUWMAN SCHADUWEN', bel.melding.slice(0, 60));

// ------------------------------------------------------------- op de bank
kop('binnen: het schrift, en die avond');
const avond = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, w = g.woningen[0];
  window.__zet(w.plekken.deurBinnen.x, w.plekken.deurBinnen.z);
  window.__stap(3);
  const bank = w.plekken.bank, m = v.mark.groep.position;
  const opBank = Math.hypot(m.x - bank.x, m.z - bank.z);
  const regels = window.__gesprek();
  const zwart = !!v.zwart;
  window.__zwartUit();
  window.__stap(2);
  const sch = v.schaduw, car = g.player.inCar, b = sch.auto;
  const bp = g.verhaal.schaduw.wereld.punt(0);
  return { opBank, regels, zwart, fase: v.fase, uur: g.sfeer.uur,
    golf: car ? { soort: car.soort, x: car.x, z: car.z, isGolf: car === sch.golf } : null,
    bouwman: b ? { x: b.x, z: b.z, politie: !!b.politieAuto, zichtbaar: b.mesh.visible, dPomp: Math.hypot(b.x - 721, b.z - 133.2), dStart: Math.hypot(b.x - bp.x, b.z - bp.z) } : null,
    persoon: sch.bouwman.groep.visible,
    mannen: sch.mannen ? sch.mannen.wachters.length : 0,
    bus: sch.bus ? { x: sch.bus.x, z: sch.bus.z, zichtbaar: sch.bus.mesh.visible } : null,
    balk: !document.getElementById('schaduwbalk').hidden, marker: window.__nav(), opdracht: document.getElementById('opdracht').textContent,
    zone: typeof g.vehicles.vrijeZone === 'function',
    opRoute: g.vehicles.traffic.filter(q => q.lokaal && q._pos && !q.slaapt && sch.wereld.opRoute(q._pos.x, q._pos.y)).length };
});
const avondTekst = avond.regels.map(r => r.tekst).join(' ');
ok(avond.opBank < 0.8 && avond.regels[0] && avond.regels[0].wie === 'Mark', 'Mark zit binnen op de bank en begint vanzelf', `${avond.opBank.toFixed(2)} m van de bank`);
ok(/opslag aan het water/.test(avondTekst) && /vrijdag/.test(avondTekst) && /Golf/.test(avondTekst) && /Autohuis/.test(avondTekst),
  'het schrift: "B. — opslag aan het water", en de Golf staat bij het Autohuis', avondTekst.slice(0, 80));
ok(avond.zwart && avond.fase === 'wacht' && Math.abs(avond.uur - 23) < 0.05, '"Die avond…": om elf uur', `${avond.fase}, ${avond.uur}`);
ok(avond.golf && avond.golf.isGolf && avond.golf.soort === 'hatch' && avond.golf.x > 763 && avond.golf.x < 770 && avond.golf.z > 110 && avond.golf.z < 126,
  'je zit in de Golf van Mark op het voorterrein van het Autohuis', JSON.stringify(avond.golf));
ok(avond.bouwman && avond.bouwman.politie && avond.bouwman.zichtbaar && avond.bouwman.dPomp < 4 && !avond.persoon,
  'Bouwman zit in zijn politieauto bij de pomp van de BP', JSON.stringify(avond.bouwman));
ok(avond.mannen === 2 && avond.bus && avond.bus.zichtbaar && Math.hypot(avond.bus.x - 1411.2, avond.bus.z + 199.2) < 1, 'bij de loods staan de bestelbus en twee mannen', `${avond.mannen} man`);
ok(avond.zone && avond.opRoute === 0, 'zolang je hem volgt: geen wijkverkeer op zijn route', `${avond.opRoute} wijkauto's op de route`);
ok(avond.balk && avond.marker && avond.marker.letter === 'B', 'de afstandsbalk staat in beeld, en een B op de kaart', avond.opdracht);

// ------------------------------------------------------------- de route en de loods
kop('de route en de loods');
const route = await page.evaluate(async () => {
  const K = await import('/js/kaartwereld.js');
  const W = await import('/js/world.js');
  const { LOODS } = await import('/js/bouwvlak.js');
  const g = window.__game, v = g.verhaal, S = v.schaduw.wereld, L = S.lijn;
  let rijbaan = 0, n = 0, draai = 0;
  for (let i = 0; i < L.n; i += 3) {
    if (L.s[i] > L.lengte - 22) continue;       // (het laatste stuk is de oprit en het erf)
    n++;
    const vl = K.vlakOp(L.x[i], L.z[i]);
    if (vl && ['rijbaan', 'autoweg', 'brug', 'inrit', 'parkeervlak', 'woonerf', 'verharding', 'asfaltvlak'].includes(vl.k)) rijbaan++;
  }
  for (let i = 3; i < L.n - 3; i++) {
    let d = Math.atan2(L.tz[i + 3], L.tx[i + 3]) - Math.atan2(L.tz[i - 3], L.tx[i - 3]);
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    draai = Math.max(draai, Math.abs(d));
  }
  const thuis = v.schrift.deur;                  // Parelmoervlinder 3, waar Mark zat in missie 13
  let langs15 = Infinity;
  for (let i = 0; i < L.n; i++) langs15 = Math.min(langs15, Math.hypot(L.x[i] - thuis.x, L.z[i] - thuis.z));
  const stop = S.punt(S.stopS);
  // de loods: geen pand, water of weg op het erf of onder de loods
  const E = LOODS.erf;
  let slecht = [];
  for (let x = LOODS.x0; x <= LOODS.x1; x += 2) for (let z = E.z0; z <= LOODS.z1; z += 2) {
    const vl = K.vlakOp(x, z);
    if (vl && ['water', 'rijbaan', 'autoweg', 'steiger', 'bouwwerk', 'fietspad', 'voetpad'].includes(vl.k)) slecht.push(`${vl.k} ${x},${z}`);
  }
  const panden = (K.KAART.panden || []).filter(p => {
    const r = Array.isArray(p.voet[0][0]) ? p.voet[0] : p.voet;
    return r.some(([x, z]) => x > E.x0 - 30 && x < E.x1 + 30 && z > E.z0 - 30 && z < LOODS.kade.z1 + 10);
  }).length;
  const eind = { x: L.x[L.n - 1], z: L.z[L.n - 1] };
  // de fotoplekken uit het zicht: van elk eind en het midden van elke post, op ooghoogte
  const zicht = S.fotos.map(f => S.posten.flatMap(p => [p.a, p.b, [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2]])
    .filter(q => W.zichtVrij(q[0], q[1], f.plek.x, f.plek.z, 1.5)).length);
  // en van de weg af zie je de roldeur wel (anders valt er niets te ontdekken)
  const deurZicht = W.zichtVrij(1405, -214, S.loods.deur.x, S.loods.deur.z + 1.2, 1.5);
  // het bord is door het raam te zien: niets tussen de fotoplek en het bord behalve het glas
  return { sprongLijn: +L.sprong.toFixed(2), lengte: Math.round(L.lengte), rijbaan, n, draai: Math.round(draai * 180 / Math.PI), langs15: +langs15.toFixed(1),
    stopBij: +Math.hypot(stop.x - thuis.x, stop.z - thuis.z).toFixed(1), namen: [...new Set(L.naam.filter(Boolean))],
    slecht, panden, eind, erf: E, zicht, deurZicht, snel: +(Array.from(L.vmax).filter(x => x > 15).length / L.n).toFixed(2) };
});
ok(route.lengte > 1800 && route.lengte < 3000, 'van de BP naar de loods, ruim twee kilometer', `${route.lengte} m`);
ok(route.rijbaan / route.n > 0.93, 'over de rijbaan', `${route.rijbaan} van ${route.n}`);
ok(route.draai < 120, 'zonder keerpunt: hooguit een gewone kruising', `grootste draai ${route.draai}° over twaalf meter`);
ok(route.sprongLijn < 0.5, 'en nergens van een dek af: de hoogte loopt geleidelijk', `grootste sprong ${route.sprongLijn} m tussen twee monsters`);
ok(route.langs15 < 20 && route.stopBij < 20, 'langs Parelmoervlinder 3, en daar stopt hij', `${route.langs15} m langs het huis, stop op ${route.stopBij} m`);
ok(route.namen.includes('N7') && route.namen.includes('Parelmoervlinder') && route.snel > 0.08, 'door Duinterpen en over de N7', `${Math.round(route.snel * 100)} % over de snelle weg · ${route.namen.join(', ')}`);
ok(route.eind.x > route.erf.x0 && route.eind.x < route.erf.x1 && route.eind.z > route.erf.z0 && route.eind.z < route.erf.z1, 'hij parkeert op het erf van de loods', `${route.eind.x.toFixed(0)}, ${route.eind.z.toFixed(0)}`);
ok(route.slecht.length === 0 && route.panden === 0, 'de loods staat vrij: geen pand, water of weg eronder', route.slecht.slice(0, 3).join(', ') || `${route.panden} panden`);
ok(route.zicht.every(n => n === 0), 'de drie fotoplekken liggen uit het zicht van de mannen', route.zicht.join(', ') + ' zichtlijnen');
ok(route.deurZicht, 'en van de weg zie je de roldeur');

// ------------------------------------------------------------- goed volgen
kop('volgen');
const volg = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__stap(130);                           // zes tellen: dan rijdt hij weg
  const weg = v.fase;
  // de automaat pakt hem op zestig meter achter hem op (de Golf rijdt eerst van het voorterrein)
  for (let i = 0; i < 400 && v.schaduw.rit.s < 70 && !window.__mislukt(); i++) v.update(0.05);
  window.__achter(g.player.inCar, 55);
  const r = window.__volg(480, 55);
  const sch = v.schaduw, b = sch.auto;
  return { weg, ...r, persoon: sch.bouwman.groep.visible, pDus: Math.hypot(sch.bouwman.groep.position.x - sch.wereld.bus.x, sch.bouwman.groep.position.z - sch.wereld.bus.z),
    auto: { x: b.x, z: b.z }, merken: sch.merken.filter(m => m.zichtbaar).length, opdracht: document.getElementById('opdracht').textContent,
    balkWeg: document.getElementById('schaduwbalk').hidden, gezien: sch.gezien, thuis: v.schrift.deur, zoneWeg: g.vehicles.vrijeZone == null };
});
ok(volg.weg === 'volgen', 'na zes tellen rijdt Bouwman weg');
ok(!volg.mislukt && volg.fase === 'loods', 'goed gevolgd: tot aan de loods', `${volg.t} s, fase ${volg.fase}, tot s = ${volg.meestS}`);
if (volg.mislukt || volg.fase !== 'loods') console.log('   spoor:', volg.spoor.map(q => JSON.stringify(q)).join('\n          '));
ok(volg.dMin > 22 && volg.dMax < 170, 'nooit te dichtbij en nooit kwijt', `tussen ${volg.dMin} en ${volg.dMax} m`);
ok(volg.stop && Math.hypot(volg.stop.x - volg.thuis.x, volg.stop.z - volg.thuis.z) < 22, 'onderweg stopt hij bij Parelmoervlinder 3', volg.stop && `${Math.round(Math.hypot(volg.stop.x - volg.thuis.x, volg.stop.z - volg.thuis.z))} m van het huis`);
ok(volg.sprong < 0.5, 'de politieauto blijft op de weg (geen sprong in hoogte)', `grootste sprong ${volg.sprong} m per stap`);
ok(volg.balk && volg.balk.zichtbaar && /Bouwman · \d+ m · goed zo/.test(volg.balk.tekst), 'de balk zegt hoe ver je achter hem zit', volg.balk && volg.balk.tekst);
ok(volg.marker && volg.marker.letter === 'B' && volg.marker.d < 12, 'de B op de kaart rijdt met hem mee', volg.marker && `${volg.marker.d.toFixed(1)} m`);
ok(volg.persoon && volg.pDus < 8, 'bij de loods stapt hij uit, bij de bestelbus');
ok(volg.zoneWeg, 'bij de loods mag het verkeer weer overal');
ok(volg.merken === 3 && /drie foto/.test(volg.opdracht) && volg.balkWeg, 'drie gele ruiten, en de opdracht: drie foto\'s zonder gezien te worden', volg.opdracht);

// ------------------------------------------------------------- de foto's
kop('drie foto\'s');
const fotos = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, S = v.schaduw.wereld;
  window.__gesprek(6);
  // over de weg langs de loods: dat is gewoon verkeer, daar letten de mannen niet op
  window.__zet(1410, -214.5);
  window.__stap(80);
  const weg = { alarm: v.schaduw.mannen.alarm, erf: S.opHetErf(1410, -214.5) };
  const uit = [];
  S.fotos.forEach((f, i) => {
    window.__zet(f.plek.x, f.plek.z);
    // eerst de verkeerde kant op: dan geen foto
    g.player.yaw = Math.atan2(f.kijk.x - f.plek.x, f.kijk.z - f.plek.z);
    window.__stap(2);
    const scheef = { hint: document.getElementById('praat').textContent, zichtbaar: !document.getElementById('praat').hidden };
    g.praat(); window.__stap(1);
    const naScheef = v.schaduw.fotos[i];
    g.player.yaw = Math.atan2(-(f.kijk.x - f.plek.x), -(f.kijk.z - f.plek.z));
    window.__stap(2);
    const hint = document.getElementById('praat').textContent;
    g.praat();
    const flits = document.getElementById('fotoflits').classList.contains('aan');
    window.__stap(2);
    const regel = document.getElementById('dialoogTekst').textContent;
    uit.push({ scheef, naScheef, hint, flits, gemaakt: v.schaduw.fotos[i], regel, alarm: v.schaduw.mannen ? v.schaduw.mannen.alarm : null });
    window.__gesprek(6);
  });
  window.__stap(3);
  return { weg, uit, fase: v.fase, nav: window.__nav(), gezien: v.schaduw.gezien, deur: g.woningen[0].plekken.deurBuiten };
});
ok(!fotos.weg.alarm && !fotos.weg.erf, 'op de weg langs de loods zien de mannen je niet: ze letten op het erf', JSON.stringify(fotos.weg));
fotos.uit.forEach((f, i) => {
  ok(f.scheef.zichtbaar && /richt op/.test(f.scheef.hint) && !f.naScheef, `foto ${i + 1}: de verkeerde kant op geeft geen foto`, f.scheef.hint);
  ok(/E — foto maken/.test(f.hint) && f.gemaakt && f.flits && !f.alarm, `foto ${i + 1}: E — ${f.hint.replace('E — foto maken: ', '')}`, f.regel.slice(0, 60));
});
ok(fotos.fase === 'terug' && !fotos.gezien && fotos.nav && fotos.nav.letter === 'M', 'alle drie, ongezien: terug naar Mark', `${fotos.fase}`);

kop('terug bij Mark');
const klaar = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, w = g.woningen[0];
  const geld = v.geld;
  window.__zet(w.plekken.deurBinnen.x, w.plekken.deurBinnen.z);
  window.__stap(3);
  const regels = window.__gesprek();
  window.__stap(3);
  const sch = v.schaduw;
  return { regels, geld: v.geld - geld, missie: v.missie, klaar: sch.klaar, melding: document.getElementById('missie').textContent,
    mannen: !!sch.mannen, bus: sch.bus ? sch.bus.mesh.visible : false, auto: sch.auto ? sch.auto.mesh.visible : false,
    bewaard: v.bewaar().schaduwKlaar };
});
const klaarTekst = klaar.regels.map(r => r.tekst).join(' ');
ok(/Ronald\. Johan\. En ik/.test(klaarTekst) && /Hij wil ons hebben/.test(klaarTekst), 'Mark ziet zijn naam op het bord: "Hij wil ons hebben"');
ok(klaar.missie === 'klaar' && klaar.klaar && klaar.geld === 1500 && /GESLAAGD/.test(klaar.melding), 'geslaagd: € 1.500', klaar.melding.slice(0, 50));
ok(!klaar.mannen && !klaar.bus && !klaar.auto, 'Bouwman, zijn mannen en de bus zijn weg bij de loods');
ok(klaar.bewaard === true, 'en het opgeslagen spel weet dat de missie af is');

// ------------------------------------------------------------- te dichtbij
kop('te dichtbij: gezien');
const dicht = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const s = v.bewaar(); s.missie = 'schaduw'; s.fase = 'volgen';
  v.herstel(s);
  window.__stap(2);
  const opStart = { fase: v.fase, golf: g.player.inCar === v.schaduw.golf };
  window.__gesprek(4);
  window.__stap(125);
  for (let i = 0; i < 400 && v.schaduw.rit.s < 50; i++) v.update(0.05);
  let t = 0;
  while (t < 8 && !window.__mislukt()) { window.__achter(g.player.inCar, 12); v.update(0.05); t += 0.05; }
  const na = { t: +t.toFixed(2), mislukt: window.__mislukt(), melding: window.__misluktTekst, ster: g.politie.ster };
  // de mislukking loopt af: opnieuw bij het Autohuis
  window.__naMislukking();
  window.__stap(4);
  const car = g.player.inCar;
  return { opStart, na, fase: v.fase, golf: car ? { x: car.x, z: car.z } : null, rit: v.schaduw.rit ? v.schaduw.rit.s : null };
});
ok(dicht.opStart.fase === 'wacht' && dicht.opStart.golf, 'midden in het volgen geladen: weer bij het Autohuis, in de Golf', JSON.stringify(dicht.opStart));
ok(dicht.na.mislukt && /gezien/.test(dicht.na.melding) && dicht.na.t > 2.9 && dicht.na.t < 4, 'twaalf meter erachter: na drie tellen heeft hij je gezien', `${dicht.na.t} s, ${dicht.na.melding.slice(0, 50)}`);
ok(dicht.na.ster === 2, 'en dat kost twee sterren', `${dicht.na.ster}`);
ok(dicht.fase === 'wacht' && dicht.golf && dicht.golf.x > 763 && dicht.golf.x < 770 && dicht.rit != null && dicht.rit < 5, 'mislukt: je begint weer bij het Autohuis, Bouwman bij de pomp', JSON.stringify(dicht.golf));

kop('te ver: kwijt');
const ver = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  g.politie.reset();
  window.__gesprek(4);
  let t = 0;
  while (t < 90 && !window.__mislukt()) { v.update(0.1); t += 0.1; }
  const uit = { t: +t.toFixed(1), mislukt: window.__mislukt(), melding: window.__misluktTekst, s: Math.round(v.schaduw.rit.s) };
  window.__naMislukking();
  return uit;
});
ok(ver.mislukt && /kwijt/.test(ver.melding) && ver.t > 15, 'wie bij het Autohuis blijft staan, raakt hem kwijt', `${ver.t} s, hij was op ${ver.s} m`);

kop('in de Ferrari ziet hij je van verder');
const ferrari = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, V = g.vehicles;
  g.politie.reset();
  window.__gesprek(4);
  window.__stap(125);
  for (let i = 0; i < 400 && v.schaduw.rit.s < 60; i++) v.update(0.05);
  // eerst in de Golf op 35 m: dat mag
  let t = 0;
  while (t < 6 && !window.__mislukt()) { window.__achter(g.player.inCar, 35); v.update(0.05); t += 0.05; }
  const golf = window.__mislukt();
  // dan in een rode Ferrari op dezelfde afstand
  const f = V.voegToe({ x: g.player.inCar.x, z: g.player.inCar.z, yaw: g.player.inCar.yaw, soort: 'ferrari', kleur: 0xc40a12 });
  g.player.inCar.mesh.position.set(1e5, 0, 1e5); g.player.inCar.x = g.player.inCar.z = 1e5;
  g.player.inCar = f;
  t = 0;
  while (t < 8 && !window.__mislukt()) { window.__achter(f, 35); v.update(0.05); t += 0.05; }
  const uit = { golf, ferrari: window.__mislukt(), t: +t.toFixed(2) };
  f.driveable = false; f.mesh.visible = false; f.x = f.z = 1e5; f.mesh.position.set(1e5, 0, 1e5);
  window.__naMislukking();
  return uit;
});
ok(!ferrari.golf, 'in de Golf op 35 m: niets aan de hand');
ok(ferrari.ferrari && ferrari.t < 4, 'in een rode Ferrari op 35 m: gezien', `${ferrari.t} s`);

// ------------------------------------------------------------- gezien bij de loods
kop('gezien bij de loods: de helft');
const helft = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, S = v.schaduw.wereld;
  g.politie.reset();
  const s = v.bewaar(); s.missie = 'schaduw'; s.fase = 'loods'; s.schaduwFotos = [true, false, false]; s.schaduwGezien = false;
  v.herstel(s);
  window.__stap(2);
  const opLoods = { fase: v.fase, fotos: v.schaduw.fotos.join(), golf: !!g.player.inCar, persoon: v.schaduw.bouwman.groep.visible };
  const b = v.schaduw.auto, bx = b.x, bz = b.z;
  // pal voor de eerste man op het erf gaan staan
  const man = v.schaduw.mannen.wachters[0].persoon, w = man.groep.position;
  window.__zet(w.x - Math.sin(man.yaw) * 5, w.z - Math.cos(man.yaw) * 5);
  let t = 0;
  while (t < 6 && !v.schaduw.gezien) { g.player.health = 100; v.update(0.05); t += 0.05; }
  const gezien = { gezien: v.schaduw.gezien, t: +t.toFixed(2), opdracht: document.getElementById('opdracht').textContent, persoon: v.schaduw.bouwman.groep.visible };
  for (let i = 0; i < 120; i++) { g.player.health = 100; v.update(0.05); }
  const weg = Math.hypot(b.x - bx, b.z - bz);
  // de laatste twee foto's alsnog
  for (const i of [1, 2]) {
    const f = S.fotos[i];
    window.__zet(f.plek.x, f.plek.z);
    g.player.yaw = Math.atan2(-(f.kijk.x - f.plek.x), -(f.kijk.z - f.plek.z));
    g.player.health = 100;
    window.__stap(2);
    g.praat(); window.__stap(2);
    window.__gesprek(6);
  }
  const fase = v.fase;
  const woning = g.woningen[0];
  const geld = v.geld;
  g.player.health = 100;
  window.__zet(woning.plekken.deurBinnen.x, woning.plekken.deurBinnen.z);
  window.__stap(3);
  const regels = window.__gesprek();
  window.__stap(3);
  return { opLoods, gezien, weg: +weg.toFixed(1), fase, geld: v.geld - geld, regels: regels.map(r => r.tekst).join(' '), klaar: v.schaduw.klaar };
});
ok(helft.opLoods.fase === 'loods' && helft.opLoods.fotos === 'true,false,false' && helft.opLoods.persoon, 'bij de loods geladen: met de foto die je al had', JSON.stringify(helft.opLoods));
ok(helft.gezien.gezien && /maak de foto's af/.test(helft.gezien.opdracht) && !helft.gezien.persoon, 'recht voor een van de mannen: gezien, en Bouwman stapt in', `${helft.gezien.t} s · ${helft.gezien.opdracht}`);
ok(helft.weg > 30, 'Bouwman gaat er met zijn auto vandoor', `${helft.weg} m in zes tellen`);
ok(helft.fase === 'terug', 'de foto\'s kun je alsnog maken', helft.fase);
ok(helft.klaar && helft.geld === 750 && /helft/.test(helft.regels), 'Mark geeft de helft: € 750', `€ ${helft.geld}`);

// ------------------------------------------------------------- los te starten
kop('los te starten');
const los = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backslash', key: '\\', shiftKey: true, bubbles: true }));
  window.__stap(2);
  return { missie: v.missie, fase: v.fase, merken: v.schaduw.merken.filter(m => m.zichtbaar).length, mannen: !!v.schaduw.mannen };
});
ok(los.missie === 'schaduw' && los.fase === 'telefoon', 'shift+\\ begint missie 15 met het telefoontje', JSON.stringify(los));
ok(los.merken === 0 && !los.mannen, 'en de loods van daarnet is leeg');

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);

/*
 Missie 14: Ronald en de race van de BP naar IJlst (verzoek 27 sep 2026).

   node tools/server.mjs 8123 &   node tools/racetest.mjs [poort]

 1. Een minuut na het schrift belt Ronald, en er komt een R op de kaart bij de
    Lemmerweg 80.
 2. Bij Ronald: De Boer, de races, met een BX win je het niet. Geen Ferrari: dan
    naar Autohuis Lemmerweg (A), en Ronald legt bij wat je tekortkomt.
 3. Gekocht: Ronald belt, "Die nacht…", en om één uur zit je in je Ferrari op de
    grid op de Lemmerweg bij de BP, met De Boer en Ronald langs de kant.
 4. Het parcours ligt op de rijbaan van de BP tot bij de Poiesz in IJlst; de
    tegenstanders rijden het echt, en blijven op de weg.
 5. Met de Ferrari win je het (hier gereden door een automaat op het rijgedrag
    van de speler); De Boer betaalt € 2.000. Met een gewone auto verlies je, en
    begin je weer aan de start.
 6. Opslaan en laden midden in de race, en shift+] start hem los.
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
  // wacht tot het zwart voorbij is (missie 10 en 12)
  window.__zwartUit = () => {
    for (let i = 0; i < 400 && g.verhaal.zwart; i++) window.__stap(1);
  };
  /*
   De automaat: rijdt een auto met het rijgedrag van de speler (js/vehicles.js
   `drive`, met de toetsen W, S, A en D) langs de lijn van de race. Hij kijkt een
   stuk vooruit, stuurt naar dat punt, en remt voor een bocht zoals een speler
   dat zou doen. Levert het hoogste tempo en of hij ergens vast kwam te zitten.
  */
  window.__rij = (car, maxT = 150, dt = 0.05) => {
    const v = g.verhaal, R = v.race.race, L = R.lijn, V = g.vehicles;
    let i = R.voortgang(car.x, car.z).i, top = 0, vast = 0, maxVast = 0, t = 0, vanWeg = 0;
    const keys = {};
    while (t < maxT) {
      const p = R.voortgang(car.x, car.z, i); i = p.i;
      vanWeg = Math.max(vanWeg, p.af);
      const snel = Math.abs(car.speed);
      const vooruit = Math.min(L.n - 1, i + Math.round((5 + snel * 0.45) / 2));
      // midden op de weg: op een strook opzij kwam hij langs de lantaarnpalen aan de
      // rand (anderhalve meter), en daar reed hij tegenaan
      const dx = L.x[vooruit] - car.x, dz = L.z[vooruit] - car.z;
      let fout = Math.atan2(-dx, -dz) - car.yaw;
      while (fout > Math.PI) fout -= Math.PI * 2;
      while (fout < -Math.PI) fout += Math.PI * 2;
      // de bocht die eraan komt, over zestig meter
      let k = 0;
      for (let j = i; j < Math.min(L.n, i + 30); j++) k = Math.max(k, L.k[j]);
      const mag = Math.min(58, Math.sqrt(24 / Math.max(k, 1e-4)));
      keys.KeyA = fout > 0.02; keys.KeyD = fout < -0.02;
      keys.KeyW = snel < mag; keys.KeyS = snel > mag + 4;
      V.drive(car, keys, dt);
      g.player.pos.set(car.x, 0, car.z);
      v.update(dt);
      top = Math.max(top, snel);
      if (snel < 1 && v.fase === 'race') { vast += dt; maxVast = Math.max(maxVast, vast); } else vast = 0;
      if (v.fase !== 'race') break;
      t += dt;
    }
    return { top: Math.round(top * 3.6), t: +t.toFixed(1), maxVast: +maxVast.toFixed(1), vanWeg: +vanWeg.toFixed(1), fase: v.fase };
  };
});

// --------------------------------------------------------- na het schrift
kop('een minuut na het schrift belt Ronald');
const bel = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  v.startMissie('schrift');
  window.__stap(2);
  const s = v.bewaar(); s.missie = 'schrift'; s.fase = 'terug';
  v.herstel(s);
  window.__stap(2);
  g.politie.reset();
  const d = v.schrift.deur;
  window.__zet(d.x + 3, d.z + 1);
  window.__stap(3);
  window.__gesprek();
  window.__stap(2);
  const na = { missie: v.missie, klaar: v.schrift.klaar, wachtT: v.race.wachtT };
  // 55 seconden: nog niets
  for (let i = 0; i < 550; i++) v.update(0.1);
  const na55 = { missie: v.missie };
  for (let i = 0; i < 80; i++) v.update(0.1);
  const telefoon = { missie: v.missie, fase: v.fase, balk: !window.__balkDicht(),
    telefoon: document.getElementById('dialoog').classList.contains('telefoon') };
  const regels = window.__gesprek();
  window.__stap(3);
  const nav = window.__nav(), r = v.race.huis;
  return { na, na55, telefoon, regels, nav, huis: r, pand: v.race.pand, fase: v.fase,
    melding: document.getElementById('missie').textContent,
    ronald: { zichtbaar: v.race.ronald.groep.visible, x: v.race.ronald.groep.position.x, z: v.race.ronald.groep.position.z } };
});
ok(bel.na.missie === 'klaar' && bel.na.klaar && Math.abs(bel.na.wachtT - 60) < 1, 'het schrift is geslaagd, en over een minuut belt Ronald', JSON.stringify(bel.na));
ok(bel.na55.missie === 'klaar', 'na 55 seconden nog niet');
ok(bel.telefoon.missie === 'race' && bel.telefoon.balk && bel.telefoon.telefoon, 'na een minuut gaat de telefoon', JSON.stringify(bel.telefoon));
const belTekst = bel.regels.map(r => r.tekst).join(' ');
ok(bel.regels.some(r => r.wie === 'Ronald') && /Lemmerweg/.test(belTekst) && /80/.test(belTekst), 'Ronald: hij woont aan de Lemmerweg 80', belTekst.slice(0, 90));
ok(bel.pand, 'de Lemmerweg 80 staat in de kaart');
ok(bel.nav && bel.nav.letter === 'R' && Math.hypot(bel.nav.x - bel.huis.x, bel.nav.z - bel.huis.z) < 1, 'er staat een R op de kaart bij zijn huis', JSON.stringify(bel.nav));
ok(/R op de kaart/.test(bel.melding), 'en de melding zegt dat', bel.melding.slice(0, 80));
ok(bel.ronald.zichtbaar && Math.hypot(bel.ronald.x - bel.huis.x, bel.ronald.z - bel.huis.z) < 1, 'Ronald staat voor zijn huis');

// ---------------------------------------------------------------- bij Ronald
kop('bij Ronald, zonder Ferrari');
const uitleg = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, r = v.race.huis;
  v.betaal(v.geld); v.verdien(1000);
  window.__zet(r.x + 3, r.z);
  window.__stap(3);
  const regels = window.__gesprek(40);
  window.__stap(3);
  const nav = window.__nav();
  const a = g.garage.deur;
  return { regels, fase: v.fase, geld: v.geld, nav, garage: { x: a.x, z: a.z } };
});
const uitlegTekst = uitleg.regels.map(r => r.tekst).join(' ');
ok(/De Boer/.test(uitlegTekst) && /schrift/.test(uitlegTekst) && /BP/.test(uitlegTekst) && /IJlst/.test(uitlegTekst), 'Ronald vertelt over De Boer en de races van de BP naar IJlst');
ok(/BX/.test(uitlegTekst) && /rij ik voor je/.test(uitlegTekst), 'met zijn BX wint hij het niet, dus Erik rijdt');
ok(uitleg.fase === 'auto' && /Autohuis/.test(uitlegTekst), 'geen Ferrari: naar Autohuis Lemmerweg', uitleg.fase);
ok(uitleg.geld === 3000 && /overgemaakt/.test(uitlegTekst), 'Ronald legt de € 2.000 bij die je tekortkomt', `€ ${uitleg.geld}`);
ok(uitleg.nav && uitleg.nav.letter === 'A' && Math.hypot(uitleg.nav.x - uitleg.garage.x, uitleg.nav.z - uitleg.garage.z) < 4, 'een A op de kaart bij de showroom', JSON.stringify(uitleg.nav));

kop('de Ferrari, en die nacht');
const nacht = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, G = g.garage;
  const m = G.modellen.find(a => a.id === 'ferrari_rood');
  window.__zet(m.bord.x + 0.4, m.bord.z);
  window.__stap(2);
  G.koop(m);
  window.__stap(4);
  const tel = { fase: v.fase, balk: !window.__balkDicht(), telefoon: document.getElementById('dialoog').classList.contains('telefoon') };
  const regels = window.__gesprek();
  const zwart = !!v.zwart;
  window.__zwartUit();
  window.__stap(2);
  const R = v.race, pl = R.plek, auto = g.player.inCar;
  return { tel, regels, zwart, fase: v.fase, uur: g.sfeer.uur,
    inAuto: auto ? { soort: auto.soort, eigen: G.idVan(auto), x: auto.x, z: auto.z } : null,
    speler: pl && pl.speler, start: pl && pl.start,
    boer: { zichtbaar: R.deBoer.groep.visible, x: R.deBoer.groep.position.x, z: R.deBoer.groep.position.z },
    ronald: { zichtbaar: R.ronald.groep.visible, x: R.ronald.groep.position.x, z: R.ronald.groep.position.z },
    politie: R.boerAuto ? { x: R.boerAuto.x, z: R.boerAuto.z, politie: !!R.boerAuto.politieAuto, zichtbaar: R.boerAuto.mesh.visible } : null,
    rijders: R.race.rijders.map(r => ({ soort: r.soort, x: r.car.x, z: r.car.z, zichtbaar: r.car.mesh.visible })),
    balk: !window.__balkDicht(), wie: document.getElementById('dialoogNaam').textContent };
});
ok(nacht.tel.fase === 'gekocht' && nacht.tel.balk && nacht.tel.telefoon, 'gekocht: Ronald belt', JSON.stringify(nacht.tel));
ok(nacht.regels.some(r => /één uur/.test(r.tekst)) && nacht.zwart, '"vannacht om één uur bij de BP", en het wordt zwart');
ok(nacht.fase === 'start' && Math.abs(nacht.uur - 1) < 0.05, 'die nacht, om één uur, op de start', `${nacht.fase}, ${nacht.uur}`);
ok(nacht.inAuto && nacht.inAuto.soort === 'ferrari' && nacht.inAuto.eigen != null && Math.hypot(nacht.inAuto.x - nacht.speler.x, nacht.inAuto.z - nacht.speler.z) < 0.5,
  'je zit in je eigen Ferrari op de grid', JSON.stringify(nacht.inAuto));
const bp = { x: 716, z: 152 };
ok(nacht.start && Math.hypot(nacht.start.x - bp.x, nacht.start.z - bp.z) < 120, 'de start is op de Lemmerweg bij de BP', nacht.start && `${nacht.start.x.toFixed(0)}, ${nacht.start.z.toFixed(0)}`);
ok(nacht.boer.zichtbaar && nacht.ronald.zichtbaar && Math.hypot(nacht.boer.x - nacht.start.x, nacht.boer.z - nacht.start.z) < 15,
  'De Boer en Ronald staan langs de kant');
ok(nacht.politie && nacht.politie.politie && nacht.politie.zichtbaar && Math.hypot(nacht.politie.x - nacht.start.x, nacht.politie.z - nacht.start.z) < 20, 'met de politieauto van De Boer erachter');
ok(nacht.rijders.length === 3 && nacht.rijders.every(r => r.zichtbaar) && nacht.rijders.every(r => Math.hypot(r.x - nacht.start.x, r.z - nacht.start.z) < 45),
  'drie tegenstanders op de grid', nacht.rijders.map(r => r.soort).join(', '));
ok(nacht.balk && nacht.wie === 'De Boer', 'De Boer neemt het woord');

// ------------------------------------------------------------- het parcours
kop('het parcours');
const parcours = await page.evaluate(async () => {
  const K = await import('/js/kaartwereld.js');
  const g = window.__game, R = g.verhaal.race.race, L = R.lijn;
  let rijbaan = 0, n = 0;
  for (let i = 0; i < L.n; i += 4) { n++; const v = K.vlakOp(L.x[i], L.z[i]); if (v && (v.k === 'rijbaan' || v.k === 'autoweg' || v.k === 'brug')) rijbaan++; }
  const eind = R.punt(L.lengte);
  const poiesz = g.supermarkt && g.supermarkt.ingangen ? g.supermarkt.ingangen[0].deur : null;
  return { lengte: Math.round(L.lengte), rijbaan, n, cps: R.controlepunten.length, eind: { x: eind.x, z: eind.z },
    poiesz: poiesz ? { x: poiesz.x, z: poiesz.z } : null };
});
ok(parcours.lengte > 2000 && parcours.lengte < 3500, 'van de BP naar IJlst', `${parcours.lengte} m`);
ok(parcours.rijbaan / parcours.n > 0.95, 'over de rijbaan', `${parcours.rijbaan} van ${parcours.n}`);
ok(parcours.cps >= 6, 'met controlepunten onderweg', `${parcours.cps} ringen, de laatste is de finish`);
ok(!parcours.poiesz || Math.hypot(parcours.eind.x - parcours.poiesz.x, parcours.eind.z - parcours.poiesz.z) < 350, 'de finish is in IJlst, op de Sudergoweg bij de Poiesz',
  parcours.poiesz ? `${Math.round(Math.hypot(parcours.eind.x - parcours.poiesz.x, parcours.eind.z - parcours.poiesz.z))} m van de deur` : 'geen Poiesz');

// ------------------------------------------------------------------- de race
kop('de race met de Ferrari');
const start = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const regels = window.__gesprek();
  const af = v.fase;
  window.__stap(20);                 // één seconde: je staat nog stil
  const stil = Math.abs(g.player.inCar.speed);
  window.__stap(50);                 // na drie seconden: start
  const R = v.race.race;
  const s0 = R.rijders.map(r => r.s);
  window.__stap(20);
  return { regels: regels.length, af, stil, fase: v.fase, ringen: R.ringen.filter(r => r.visible).length, finish: R.finish.visible,
    vooruit: R.rijders.map((r, i) => Math.round(r.s - s0[i])) };
});
ok(start.af === 'aftellen' && start.stil === 0, 'na De Boer: aftellen, en je staat stil', `${start.af}`);
ok(start.fase === 'race' && start.ringen === 2 && start.finish, 'START: de ringen en de finishboog staan er');
ok(start.vooruit.every(d => d > 5), 'de tegenstanders rijden weg', start.vooruit.join(', ') + ' m in een seconde');
const rit = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, R = v.race.race;
  // de tegenstanders onderweg: blijven ze op de weg?
  const r = window.__rij(g.player.inCar, 160);
  const st = R.stand();
  return { ...r, stand: st, uitslag: v.race.uitslag, fase: v.fase, melding: document.getElementById('missie').textContent,
    rijders: R.rijders.map(q => ({ s: Math.round(q.s), klaar: q.klaar })) };
});
ok(rit.maxVast < 1.5, 'de Ferrari komt nergens vast te zitten', `langste stilstand ${rit.maxVast} s, hooguit ${rit.vanWeg} m van de lijn`);
ok(rit.top >= 170, 'en haalt op de Sudergoweg ruim 170', `${rit.top} km/u`);
ok(rit.stand.cp === rit.stand.cps, 'door alle ringen', `${rit.stand.cp} van ${rit.stand.cps}`);
ok(rit.uitslag && rit.uitslag.plek === 1 && rit.fase === 'finish', 'als eerste over de finish', JSON.stringify({ uitslag: rit.uitslag, fase: rit.fase, tijd: rit.t }));
ok(/GEWONNEN/.test(rit.melding), 'GEWONNEN!', rit.melding.slice(0, 50));
const eind = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, d = v.race.deBoer.groep.position;
  const car = g.player.inCar;
  car.speed = 0; car.x = d.x + 6; car.z = d.z; car.mesh.position.set(car.x, 0, car.z);
  const geld = v.geld;
  window.__stap(4);
  const regels = window.__gesprek();
  window.__stap(3);
  return { regels, missie: v.missie, klaar: v.race.klaar, geld: v.geld - geld, melding: document.getElementById('missie').textContent };
});
const eindTekst = eind.regels.map(r => r.tekst).join(' ');
ok(/schuld is afgelost/.test(eindTekst) && /Erik van Mark/.test(eindTekst), 'De Boer: de schuld is afgelost… "Erik van Mark?"');
ok(eind.missie === 'klaar' && eind.klaar && eind.geld === 2000 && /GESLAAGD/.test(eind.melding), 'geslaagd: € 2.000', eind.melding.slice(0, 40));

// ------------------------------------------------------------ met een hatchback
kop('met een gewone auto');
const verlies = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  // opnieuw op de grid (zoals na het laden midden in de race)
  const s = v.bewaar(); s.missie = 'race'; s.fase = 'race';
  v.herstel(s);
  window.__stap(2);
  const opStart = v.fase;
  window.__gesprek();
  window.__stap(70);
  // en nu in een hatchback op de plek van de Ferrari
  const f = g.player.inCar, p = v.race.plek.speler;
  const h = g.vehicles.voegToe({ x: p.x + 0.01, z: p.z, yaw: p.yaw, soort: 'hatch', kleur: 0x8a8d93 });
  f.x = f.z = 5000; f.mesh.position.set(5000, 0, 5000);
  g.player.inCar = h;
  const r = window.__rij(h, 200);
  const na = { fase: v.fase, melding: document.getElementById('missie').textContent, uitslag: v.race.uitslag, overT: v.race.overT };
  for (let i = 0; i < 80; i++) v.update(0.05);
  return { opStart, r, na, weer: v.fase, inAuto: g.player.inCar ? g.player.inCar.soort : null };
});
ok(verlies.opStart === 'start', 'na het laden midden in de race sta je weer op de grid', verlies.opStart);
ok(verlies.r.top < 100, 'een hatchback haalt geen 100', `${verlies.r.top} km/u`);
ok(/MISLUKT/.test(verlies.na.melding) && verlies.na.overT > 0, 'je verliest de race', `${verlies.na.melding.slice(0, 60)} ${JSON.stringify(verlies.na.uitslag)}`);
ok(verlies.weer === 'start' && verlies.inAuto === 'ferrari', 'en begint weer aan de start, in de Ferrari', `${verlies.weer}, ${verlies.inAuto}`);

kop('los te starten');
const los = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'BracketRight', key: '}', shiftKey: true, bubbles: true }));
  window.__stap(2);
  return { missie: v.missie, fase: v.fase, rijders: v.race.race.rijders.filter(r => r.car && r.car.mesh.visible).length, ringen: v.race.race.ringen.filter(r => r.visible).length };
});
ok(los.missie === 'race' && los.fase === 'telefoon', 'shift+] begint missie 14 met het telefoontje', JSON.stringify(los));
ok(los.rijders === 0 && los.ringen === 0, 'en de race van daarnet is opgeruimd');

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);

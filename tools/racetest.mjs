/*
 Missie 14: Ronald en de race van de BP naar IJlst (verzoek 27 sep 2026).

   node tools/server.mjs 8123 &   node tools/racetest.mjs [poort]

 1. Een minuut na het schrift belt Ronald, en er komt een R op de kaart bij de
    Lemmerweg 80.
 2. Bij Ronald: Bouwman, de races, met een BX win je het niet. Geen Ferrari: dan
    naar Autohuis Lemmerweg (A), en Ronald legt bij wat je tekortkomt.
 3. Gekocht: Ronald belt, "Die nacht…", en om één uur zit je in je Ferrari op de
    grid op de Lemmerweg bij de BP, met Bouwman en Ronald langs de kant.
 4. Het parcours ligt op de rijbaan van de BP tot bij de Poiesz in IJlst; de
    tegenstanders rijden het echt, en blijven op de weg.
 5. Met de Ferrari win je het (hier gereden door een automaat op het rijgedrag
    van de speler); Bouwman betaalt € 2.000. Met een gewone auto verlies je, en
    begin je weer aan de start.
 6. Opslaan en laden midden in de race, en shift+] start hem los.

 En de ronde van stap 95 (melding 27 sep 2026): een ring in de top van de eerste
 rotonde (afsnijden telt niet), piepjes bij het aftellen, geen wijkverkeer op de
 route, rustiger sturen op snelheid, de race staat stil in het pauzemenu, en na
 afloop "De volgende ochtend" voor je eigen huis.
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
  // de automaat: een goede rijder en een slordige (hoe hard ze een bocht in durven, m/s²)
  window.__GOED = 22; window.__SLORDIG = 8;
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
  window.__rij = (car, maxT = 150, bocht = window.__GOED, dt = 0.05) => {
    const v = g.verhaal, R = v.race.race, L = R.lijn, V = g.vehicles;
    let i = R.voortgang(car.x, car.z).i, top = 0, vast = 0, maxVast = 0, t = 0, vanWeg = 0;
    const keys = {};
    let uNu = 1.2, doorElkaar = 0, tegenAuto = 0, botsen = 0;
    const pijlMeting = [];
    while (t < maxT) {
      const p = R.voortgang(car.x, car.z, i); i = p.i;
      vanWeg = Math.max(vanWeg, p.af);
      const snel = Math.abs(car.speed);
      const vooruit = Math.min(L.n - 1, i + Math.round((5 + snel * 0.45) / 2));
      /*
       Midden op de weg (op een strook opzij kwam hij langs de lantaarnpalen aan de
       rand), en om een tegenstander heen zoals een speler dat doet: rijdt er een
       vóór hem op dezelfde strook, dan naar de andere kant. Zonder dat reed hij ze
       van achteren aan, tot vierentwintig keer per race.
      */
      // de dichtstbijzijnde tegenstander vóór hem (of naast hem): dan aan de andere kant
      // van die auto blijven, en pas als de weg vrij is weer naar het midden
      let u = 0, dichtst = Infinity;
      for (const q of R.rijders) {
        if (!q.car || q.klaar) continue;
        const ds = q.s - p.s;
        if (ds > -5 && ds < 40 && ds < dichtst) { dichtst = ds; u = q.u > 0 ? -1.25 : 1.25; }
      }
      uNu += Math.max(-1.5 * dt, Math.min(1.5 * dt, u - uNu));
      const dx = L.x[vooruit] - L.tz[vooruit] * uNu - car.x, dz = L.z[vooruit] + L.tx[vooruit] * uNu - car.z;
      let fout = Math.atan2(-dx, -dz) - car.yaw;
      while (fout > Math.PI) fout -= Math.PI * 2;
      while (fout < -Math.PI) fout += Math.PI * 2;
      // de bocht die eraan komt, over zestig meter
      let k = 0;
      for (let j = i; j < Math.min(L.n, i + 30); j++) k = Math.max(k, L.k[j]);
      const mag = Math.min(58, Math.sqrt(bocht / Math.max(k, 1e-4)));
      keys.KeyA = fout > 0.02; keys.KeyD = fout < -0.02;
      keys.KeyW = snel < mag; keys.KeyS = snel > mag + 4;
      V.drive(car, keys, dt);
      // rijden de auto's door elkaar heen? (de tegenstanders onderling, en met jou)
      const rs = R.rijders.filter(q => q.car && q.car.mesh.visible);
      for (let a = 0; a < rs.length; a++) {
        // door elkaar: minder dan een autolengte achter elkaar én minder dan een autobreedte opzij
        for (let b = a + 1; b < rs.length; b++) if (Math.abs(rs[a].s - rs[b].s) < 4.4 && Math.abs(rs[a].u - rs[b].u) < 1.9) doorElkaar++;
        if (car.botsKracht > 0 && Math.hypot(rs[a].car.x - car.x, rs[a].car.z - car.z) < 4) tegenAuto++;
      }
      if (car.botsKracht > 0) botsen++;
      // de pijlen: staan ze vóór je op de lijn, en loopt er licht door?
      const pj = R.pijlen;
      if (pj.visible && Math.round(t / dt) % 20 === 5) {
        const e = pj.instanceMatrix.array, c = pj.instanceColor.array;
        const eerste = { x: e[12], z: e[14] };
        const pv = R.voortgang(eerste.x, eerste.z);
        // (op het laatste stuk voor de finish zijn ze weg: daar ligt de eerste onder de grond)
        if (e[13] > -1) pijlMeting.push({ voor: +(pv.s - p.s).toFixed(1), opLijn: +pv.af.toFixed(2),
          licht: Array.from({ length: pj.count }, (_, k) => c[k * 3]).filter(x => x > 0) });
      }
      g.player.pos.set(car.x, 0, car.z);
      v.update(dt);
      top = Math.max(top, snel);
      if (snel < 1 && v.fase === 'race') { vast += dt; maxVast = Math.max(maxVast, vast); } else vast = 0;
      if (v.fase !== 'race') break;
      t += dt;
    }
    return { top: Math.round(top * 3.6), t: +t.toFixed(1), maxVast: +maxVast.toFixed(1), vanWeg: +vanWeg.toFixed(1), fase: v.fase,
      doorElkaar, tegenAuto, botsen, pijlMeting };
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
ok(/Bouwman/.test(uitlegTekst) && /schrift/.test(uitlegTekst) && /BP/.test(uitlegTekst) && /IJlst/.test(uitlegTekst), 'Ronald vertelt over Bouwman en de races van de BP naar IJlst');
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
    boer: { zichtbaar: R.bouwman.groep.visible, x: R.bouwman.groep.position.x, z: R.bouwman.groep.position.z },
    ronald: { zichtbaar: R.ronald.groep.visible, x: R.ronald.groep.position.x, z: R.ronald.groep.position.z },
    politie: R.bouwmanAuto ? { x: R.bouwmanAuto.x, z: R.bouwmanAuto.z, politie: !!R.bouwmanAuto.politieAuto, zichtbaar: R.bouwmanAuto.mesh.visible } : null,
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
  'Bouwman en Ronald staan langs de kant');
ok(nacht.politie && nacht.politie.politie && nacht.politie.zichtbaar && Math.hypot(nacht.politie.x - nacht.start.x, nacht.politie.z - nacht.start.z) < 20, 'met de politieauto van Bouwman erachter');
ok(nacht.rijders.length === 3 && nacht.rijders.every(r => r.zichtbaar) && nacht.rijders.every(r => Math.hypot(r.x - nacht.start.x, r.z - nacht.start.z) < 45),
  'drie tegenstanders op de grid', nacht.rijders.map(r => r.soort).join(', '));
ok(nacht.balk && nacht.wie === 'Bouwman', 'Bouwman neemt het woord');
const verkeer = await page.evaluate(() => {
  const g = window.__game, V = g.vehicles, R = g.verhaal.race.race;
  const wijk = V.traffic.filter(q => q.lokaal && q._pos && !q.slaapt);
  const opRoute = wijk.filter(q => R.opRoute(q._pos.x, q._pos.y)).length;
  // en een nieuwe plek voor een wijkauto kiest nooit de route
  let gekozen = 0, fout = 0;
  const sp = g.player.inCar;
  for (let i = 0; i < 40; i++) {
    const c = V.kiesRijbaan(sp.x, sp.z, 60, 60, 900);
    if (!c) continue;
    gekozen++;
    if (R.opRoute(c.q.x, c.q.y)) fout++;
  }
  // de route zelf: ligt de lijn in de zone?
  const L = R.lijn;
  let dekt = 0, n = 0;
  for (let i = 0; i < L.n; i += 10) { n++; if (R.opRoute(L.x[i], L.z[i])) dekt++; }
  return { zone: typeof V.vrijeZone === 'function', wijk: wijk.length, opRoute, gekozen, fout, dekt, n };
});
ok(verkeer.zone && verkeer.dekt === verkeer.n, 'de route is een vrije zone voor het verkeer', `${verkeer.dekt} van ${verkeer.n} punten van de lijn`);
ok(verkeer.opRoute === 0, 'geen wijkauto op de route', `${verkeer.opRoute} van ${verkeer.wijk} wakkere wijkauto's`);
ok(verkeer.gekozen > 5 && verkeer.fout === 0, 'en er komt er ook geen bij', `${verkeer.fout} van ${verkeer.gekozen} nieuwe plekken op de route`);

// ------------------------------------------------------------- het parcours
kop('het parcours');
const parcours = await page.evaluate(async () => {
  const K = await import('/js/kaartwereld.js');
  const g = window.__game, R = g.verhaal.race.race, L = R.lijn;
  let rijbaan = 0, n = 0;
  for (let i = 0; i < L.n; i += 4) { n++; const v = K.vlakOp(L.x[i], L.z[i]); if (v && (v.k === 'rijbaan' || v.k === 'autoweg' || v.k === 'brug')) rijbaan++; }
  const eind = R.punt(L.lengte);
  const poiesz = g.supermarkt && g.supermarkt.ingangen ? g.supermarkt.ingangen[0].deur : null;
  // de bochtringen, en de eerste rotonde (zo'n 200 m na de start): hoe ver ligt de
  // rechte lijn tussen in- en uitrit van het hart van de ring?
  const bocht = R.bochtRingen.map(s => Math.round(s));
  const rs = R.bochtRingen.find(s => s > 120 && s < 320);
  let rotonde = null;
  if (rs != null) {
    const c = R.punt(rs), a = R.punt(rs - 30), b = R.punt(rs + 30);
    const abx = b.x - a.x, abz = b.z - a.z, l2 = abx * abx + abz * abz;
    const f = Math.max(0, Math.min(1, ((c.x - a.x) * abx + (c.z - a.z) * abz) / l2));
    const koorde = Math.hypot(a.x + abx * f - c.x, a.z + abz * f - c.z);
    rotonde = { s: Math.round(rs), koorde: +koorde.toFixed(1), straal: 8 };
  }
  return { lengte: Math.round(L.lengte), rijbaan, n, cps: R.controlepunten.length, eind: { x: eind.x, z: eind.z }, bocht, rotonde,
    poiesz: poiesz ? { x: poiesz.x, z: poiesz.z } : null };
});
ok(parcours.lengte > 2000 && parcours.lengte < 3500, 'van de BP naar IJlst', `${parcours.lengte} m`);
ok(parcours.rijbaan / parcours.n > 0.95, 'over de rijbaan', `${parcours.rijbaan} van ${parcours.n}`);
ok(parcours.rotonde, 'een ring in de top van de eerste rotonde', parcours.rotonde ? `op ${parcours.rotonde.s} m, straal ${parcours.rotonde.straal} m` : JSON.stringify(parcours.bocht));
ok(parcours.rotonde && parcours.rotonde.koorde > parcours.rotonde.straal + 2, 'wie rechtdoor over het eiland rijdt, mist hem',
  parcours.rotonde && `de rechte lijn erlangs ligt ${parcours.rotonde.koorde} m van het hart van de ring`);
ok(parcours.cps >= 6, 'met controlepunten onderweg', `${parcours.cps} ringen, de laatste is de finish`);
ok(!parcours.poiesz || Math.hypot(parcours.eind.x - parcours.poiesz.x, parcours.eind.z - parcours.poiesz.z) < 350, 'de finish is in IJlst, op de Sudergoweg bij de Poiesz',
  parcours.poiesz ? `${Math.round(Math.hypot(parcours.eind.x - parcours.poiesz.x, parcours.eind.z - parcours.poiesz.z))} m van de deur` : 'geen Poiesz');

// ------------------------------------------------------------------- de race
kop('de race met de Ferrari');
const start = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  // de piepjes tellen (js/audio.js `aftelPiep`)
  const piep = [], echt = g.geluid.aftelPiep;
  g.geluid.aftelPiep = (s) => { piep.push(!!s); echt.call(g.geluid, s); };
  const regels = window.__gesprek();
  const af = v.fase;
  window.__stap(20);                 // één seconde: je staat nog stil
  const stil = Math.abs(g.player.inCar.speed);
  window.__stap(50);                 // na drie seconden: start
  const R = v.race.race;
  const s0 = R.rijders.map(r => r.s);
  window.__stap(20);
  g.geluid.aftelPiep = echt;
  return { piep, regels: regels.length, af, stil, fase: v.fase, ringen: R.ringen.filter(r => r.visible).length, finish: R.finish.visible,
    vooruit: R.rijders.map((r, i) => Math.round(r.s - s0[i])) };
});
ok(start.af === 'aftellen' && start.stil === 0, 'na Bouwman: aftellen, en je staat stil', `${start.af}`);
ok(start.piep.join() === 'false,false,false,true', 'drie korte piepjes en een lange op START', start.piep.map(s => s ? 'lang' : 'kort').join(', '));
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
const pm = rit.pijlMeting || [];
// (`voortgang` meet tot het dichtstbijzijnde monster van de lijn, en die liggen twee meter
// uit elkaar: een pijl ertussenin ligt dan tot een meter 'naast' de lijn)
const pmFout = pm.filter(q => !(q.voor > 0 && q.voor < 25 && q.opLijn < 1.05));
ok(pm.length > 5 && pmFout.length === 0, 'lichtpijlen op de weg, vlak voor je, op de lijn van de race',
  pmFout.length ? `${pmFout.length} van ${pm.length} niet: ${JSON.stringify(pmFout.slice(0, 3).map(q => ({ voor: q.voor, opLijn: q.opLijn })))}` : pm.slice(0, 3).map(q => `${q.voor} m voor je`).join(', '));
ok(pm.length > 5 && pm.every(q => Math.max(...q.licht) - Math.min(...q.licht) > 0.3), 'met een looplicht erdoorheen', pm[0] && `licht van ${Math.min(...pm[0].licht).toFixed(2)} tot ${Math.max(...pm[0].licht).toFixed(2)}`);
ok(rit.doorElkaar === 0, 'de tegenstanders rijden niet door elkaar heen', `${rit.doorElkaar} beelden waarin twee auto's elkaar overlapten`);
ok(rit.tegenAuto <= 3, 'en rijden je niet van de weg', `${rit.tegenAuto} botsingen met een tegenstander, ${rit.botsen} in totaal`);
ok(rit.maxVast < 1.5, 'de Ferrari komt nergens vast te zitten', `langste stilstand ${rit.maxVast} s, hooguit ${rit.vanWeg} m van de lijn`);
ok(rit.top >= 170, 'en haalt op de Sudergoweg ruim 170', `${rit.top} km/u`);
ok(rit.stand.cp === rit.stand.cps, 'door alle ringen', `${rit.stand.cp} van ${rit.stand.cps}`);
ok(rit.uitslag && rit.uitslag.plek === 1 && rit.fase === 'finish', 'goed gereden: als eerste over de finish', JSON.stringify({ uitslag: rit.uitslag, fase: rit.fase, tijd: rit.t }));
const tweede = await page.evaluate(() => {
  const v = window.__game.verhaal, R = v.race.race;
  const car = window.__game.player.inCar;
  for (let i = 0; i < 300 && !R.rijders.some(q => q.klaar); i++) R.update(0.05, { x: car.x, z: car.z });
  const t = R.rijders.filter(q => q.klaar).map(q => q.tijd);
  return t.length ? Math.min(...t) : null;
});
ok(tweede != null && tweede - rit.uitslag.tijd < 8, 'maar niet makkelijk: de eerste tegenstander komt vlak achter je binnen', `${rit.uitslag.tijd.toFixed(1)} s tegen ${tweede && tweede.toFixed(1)} s`);
ok(/GEWONNEN/.test(rit.melding), 'GEWONNEN!', rit.melding.slice(0, 50));
const eind = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, d = v.race.bouwman.groep.position;
  const car = g.player.inCar;
  car.speed = 0; car.x = d.x + 6; car.z = d.z; car.mesh.position.set(car.x, 0, car.z);
  const geld = v.geld;
  window.__stap(4);
  const regels = window.__gesprek();
  window.__stap(3);
  return { regels, missie: v.missie, klaar: v.race.klaar, geld: v.geld - geld, melding: document.getElementById('missie').textContent };
});
const eindTekst = eind.regels.map(r => r.tekst).join(' ');
ok(/schuld is afgelost/.test(eindTekst) && /Erik van Mark/.test(eindTekst), 'Bouwman: de schuld is afgelost… "Erik van Mark?"');
ok(eind.missie === 'klaar' && eind.klaar && eind.geld === 2000 && /GESLAAGD/.test(eind.melding), 'geslaagd: € 2.000', eind.melding.slice(0, 40));
const ochtend = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const zone = g.vehicles.vrijeZone;
  let t = 0;
  while (!v.zwart && t < 12) { v.update(0.05); t += 0.05; }
  const tekst = document.getElementById('overgangtekst') ? document.getElementById('overgangtekst').textContent : '';
  window.__zwartUit();
  window.__stap(2);
  const d = v.thuisDoel, auto = g.player.inCar;
  const eigen = g.garage.eigen.find(e => e.soort === 'ferrari');
  const f = eigen && eigen.car;
  return { zone: zone == null, t: +t.toFixed(1), tekst, uur: g.sfeer.uur, naam: d && d.naam,
    afstand: d ? +Math.hypot(g.player.pos.x - d.deur.x, g.player.pos.z - d.deur.z).toFixed(1) : null,
    inAuto: !!auto, ferrari: f && d ? +Math.hypot(f.x - d.deur.x, f.z - d.deur.z).toFixed(1) : null,
    finish: v.race.race.finish.visible, rijders: v.race.race.rijders.filter(q => q.car && q.car.mesh.visible).length,
    boer: v.race.bouwman.groep.visible, volgende: v.volgendeMissie };
});
ok(ochtend.zone, 'na de race mag het verkeer weer over de route');
ok(ochtend.t >= 4 && ochtend.t <= 6 && /volgende ochtend/.test(ochtend.tekst), 'vijf tellen later wordt het zwart: "De volgende ochtend"', `${ochtend.t} s, "${ochtend.tekst}"`);
ok(Math.abs(ochtend.uur - 9.5) < 0.1 && ochtend.afstand != null && ochtend.afstand < 4 && !ochtend.inAuto, 'en je staat om half tien voor je huis', `${ochtend.naam}, ${ochtend.afstand} m van de deur, ${ochtend.uur.toFixed(2)} uur`);
ok(ochtend.ferrari != null && ochtend.ferrari < 15, 'met de Ferrari op de oprit', `${ochtend.ferrari} m van de deur`);
ok(!ochtend.finish && ochtend.rijders === 0 && !ochtend.boer, 'de race in IJlst is opgeruimd');
ok(ochtend.volgende && ochtend.volgende.naam === 'schaduw' && ochtend.volgende.over > 50 && ochtend.volgende.over <= 60,
  'en over een minuut belt Mark: missie 15', JSON.stringify(ochtend.volgende));

// ------------------------------------------------------------ met een hatchback
kop('een slordige rit: verloren');
const slordig = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  // opnieuw op de grid (zoals na het laden midden in de race)
  const s = v.bewaar(); s.missie = 'race'; s.fase = 'race';
  v.herstel(s);
  window.__stap(2);
  const opStart = v.fase;
  window.__gesprek();
  window.__stap(61);
  const r = window.__rij(g.player.inCar, 200, window.__SLORDIG);
  const na = { fase: v.fase, melding: document.getElementById('missie').textContent, uitslag: v.race.uitslag };
  // even VERLOREN, dan Bouwman
  for (let i = 0; i < 60 && window.__balkDicht(); i++) v.update(0.05);
  const regels = window.__gesprek();
  return { opStart, r, na, regels, fase: v.fase, schuld: v.race.schuld, opdracht: document.getElementById('opdracht') ? document.getElementById('opdracht').textContent : '',
    tegen: v.race.race.rijders.map(q => q.tijd && +q.tijd.toFixed(1)) };
});
ok(slordig.opStart === 'start', 'na het laden midden in de race sta je weer op de grid', slordig.opStart);
ok(slordig.na.fase === 'verloren' && /VERLOREN/.test(slordig.na.melding), 'wie de bochten te voorzichtig neemt, verliest ook met de Ferrari',
  `${slordig.r.t} s, ${JSON.stringify(slordig.na.uitslag)}, de anderen: ${slordig.tegen.join(', ')}`);
const slordigTekst = slordig.regels.map(r => r.tekst).join(' ');
ok(slordig.regels.some(r => r.wie === 'Bouwman') && /schuldig/.test(slordigTekst) && /Dubbel of niks/.test(slordigTekst), 'Bouwman komt verhaal halen: de schuld is nu van jou, of dubbel of niks');
ok(slordig.fase === 'keuze' && slordig.schuld === 1500, 'de keuze: 1 nog een keer, 2 € 1.500 betalen', `${slordig.fase}, € ${slordig.schuld}`);

kop('revanche, en weer verloren');
const revanche = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', key: '1', bubbles: true }));
  window.__stap(2);
  const na1 = v.fase;
  window.__gesprek();
  window.__zwartUit();
  window.__stap(2);
  const opStart = { fase: v.fase, auto: g.player.inCar ? g.player.inCar.soort : null };
  window.__gesprek();
  window.__stap(61);
  // een ring missen: de auto vijftig meter voorbij de eerste ring, naast de weg
  const R = v.race.race, cp = R.controlepunten[0], p = R.punt(cp + 60, 0), car = g.player.inCar;
  car.x = p.x; car.z = p.z; car.speed = 0; car.mesh.position.set(p.x, 0, p.z);
  window.__stap(3);
  const gemist = document.getElementById('missie').textContent;
  // en uitstappen: na twintig tellen is het verloren
  g.player.inCar = null; g.player.pos.set(p.x + 3, 0, p.z);
  window.__stap(100);
  const halverwege = { fase: v.fase, bericht: g.hud.msg.textContent };
  window.__stap(320);
  const verloren = { fase: v.fase, verloor: v.race.verloor };
  for (let i = 0; i < 80 && window.__balkDicht(); i++) v.update(0.05);
  const telefoon = document.getElementById('dialoog').classList.contains('telefoon');
  const regels = window.__gesprek();
  return { na1, opStart, gemist, halverwege, verloren, telefoon, regels, fase: v.fase, schuld: v.race.schuld };
});
ok(revanche.na1 === 'revanche' && revanche.opStart.fase === 'start' && revanche.opStart.auto === 'ferrari', '1: "Terug naar de start", en je staat weer op de grid', JSON.stringify(revanche.opStart));
ok(/RING GEMIST/.test(revanche.gemist), 'een ring gemist: dat zegt het scherm', revanche.gemist.slice(0, 60));
ok(revanche.halverwege.fase === 'race' && /Stap in/.test(revanche.halverwege.bericht), 'uitgestapt: "Stap in — de race loopt!"', revanche.halverwege.bericht);
ok(revanche.verloren.fase === 'verloren' || revanche.verloren.fase === 'keuze', 'na twintig tellen buiten de auto is het verloren', JSON.stringify(revanche.verloren));
ok(revanche.telefoon && revanche.fase === 'keuze' && revanche.schuld === 3000, 'Bouwman belt: dubbel of niks, nu € 3.000', `${revanche.fase}, € ${revanche.schuld}`);

kop('betalen');
const betalen = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  v.betaal(v.geld); v.verdien(5000);
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', key: '2', bubbles: true }));
  window.__stap(2);
  const regels = window.__gesprek();
  window.__stap(3);
  return { regels, geld: v.geld, missie: v.missie, klaar: v.race.klaar, melding: document.getElementById('missie').textContent,
    pijlen: v.race.race.pijlen.visible };
});
ok(betalen.geld === 2000 && betalen.regels.some(r => /Verstandig/.test(r.tekst)) && betalen.regels.some(r => /Erik van Mark/.test(r.tekst)), '2: € 3.000 betaald, "Verstandig. Ronald is van me af."', `nog € ${betalen.geld}`);
ok(betalen.missie === 'klaar' && betalen.klaar && /VOLTOOID/.test(betalen.melding), 'de missie is voorbij, zonder beloning', betalen.melding.slice(0, 50));
ok(!betalen.pijlen, 'en de pijlen zijn weg');

kop('sturen op snelheid');
const stuur = await page.evaluate(() => {
  const V = window.__game.vehicles;
  // op een lege vlakte buiten de kaart; de snelheid vast, alleen het stuur
  const meet = (v0, tik) => {
    const car = V.voegToe({ x: 4000 + Math.random(), z: 4000, yaw: 0, soort: 'ferrari', kleur: 0xc40a12 });
    car.speed = v0; car.steer = 0;
    const dt = 1 / 60, y0 = car.yaw;
    for (let i = 0; i < 60; i++) { car.speed = v0; V.drive(car, { KeyA: i * dt < tik }, dt); }
    const draai = car.yaw - y0;
    car.driveable = false; car.mesh.visible = false; car.x = car.z = 1e5; car.mesh.position.set(1e5, 0, 1e5);
    return +draai.toFixed(3);
  };
  return { vol50: meet(50, 1), tik50: meet(50, 0.1), vol10: meet(10, 1) };
});
ok(stuur.vol50 * 50 < 28, 'op 180 km/u vol naar links: niet harder dan de banden houden', `${(stuur.vol50 * 50).toFixed(1)} m/s² dwars, ${stuur.vol50} rad in een seconde`);
ok(stuur.tik50 < 0.08, 'en een tikje van een tiende seconde is een kleine koerswijziging', `${(stuur.tik50 * 180 / Math.PI).toFixed(1)}°`);
ok(stuur.vol10 > 0.8, 'maar langzaam stuurt hij nog gewoon', `${stuur.vol10} rad in een seconde op 36 km/u`);

kop('pauze');
const pauze = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal;
  const s = v.bewaar(); s.missie = 'race'; s.fase = 'race';
  v.herstel(s);
  window.__stap(2);
  window.__gesprek();
  window.__stap(61);
  const fase = v.fase, R = v.race.race;
  // de hoofdlus zelf laten lopen: eerst gewoon, dan in het pauzemenu
  const wacht = (ms) => new Promise(r => setTimeout(r, ms));
  const beeld = () => g.renderer.info.render.frame;
  const tot = async (n) => { const b = beeld(); for (let i = 0; i < 60 && beeld() - b < n; i++) await wacht(500); return beeld() - b; };
  window.__autoplay = false; g.player.active = true;
  const k0 = R.stand().klok;
  const b0 = await tot(3);
  const k1 = R.stand().klok;
  g.pauzeer();
  const k2 = R.stand().klok;
  const b1 = await tot(3);
  const k3 = R.stand().klok;
  window.__autoplay = true;
  return { fase, loopt: { beelden: b0, klok: +(k1 - k0).toFixed(2) }, pauze: { beelden: b1, klok: +(k3 - k2).toFixed(2) } };
});
ok(pauze.fase === 'race' && pauze.loopt.beelden >= 3 && pauze.loopt.klok > 0, 'zonder pauze loopt de race met de hoofdlus mee', JSON.stringify(pauze.loopt));
ok(pauze.pauze.beelden >= 3 && pauze.pauze.klok === 0, 'in het pauzemenu staat de klok van de race stil', JSON.stringify(pauze.pauze));

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

/*
 Toetst het bijvullen van de buurt: voetgangers (js/npc.js) en wijkverkeer
 (js/vehicles.js) verhuizen mee met de speler.

 Waarom dit er is: de honderddertig voetgangers werden bij het opstarten één
 keer op een willekeurig wegvak in de héle wereld gezet, en de twintig rijdende
 auto's waren veertien op de N7 plus zes op acht assen in Tinga. Over 10,95 km²
 is dat twaalf mensen per vierkante kilometer. Gemeten stond er op elk standpunt
 nul of één iemand binnen tachtig meter, en in IJlst en Duinterpen niets binnen
 tweehonderd meter. Rijd je hard, dan laat je die paar achter en er komt niets
 bij, want na het opstarten werd er niemand meer neergezet.

 De toetsen zijn gekozen op wat er tijdens het bouwen misging:

 1. het aantal mag niet groeien — er wordt verhuisd, niet bijgemaakt;
 2. na een minuut staat er in elke wijk een buurt om je heen, óók in IJlst en
    Duinterpen, waar het wijkverkeer nooit kwam;
 3. de binnenste ring (100 m) moet echt gevuld worden. Met alleen de buitenste
    ring bleef het bij nul tot twee mensen binnen tachtig meter: twintig mensen
    verdeeld over een schijf van tweehonderd meter laten er maar een paar bij je
    staan;
 4. maar de binnenste ring mag de buitenste niet uithongeren. In IJlst, waar de
    straten open zijn, lukte het niet iemand dichtbij achter een gebouw te
    zetten, en dan bleef het spel dat proberen en kwam het nooit aan de buitenste
    ring toe: de hele buurt bleef leeg (1 binnen 200 m in plaats van 20);
 5. niemand mag vóór je neus verschijnen: dichter dan de open-grens moet er een
    gebouw tussen staan (`zichtVrij` uit js/world.js);
 6. rijdend op 50 km/u moet de buurt bijblijven, en niet te druk worden;
 7. het mag niets kosten: het bijvullen loopt hoogstens twee keer per seconde.

 Gebruik: python3 -m http.server 8123 &  node tools/bevolkingtest.mjs 8123
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
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

const uit = await page.evaluate(async () => {
  const g = window.__game;
  const { KAART } = await import('/js/kaart.js');
  const { zichtVrij } = await import('/js/world.js');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  const dt = 1 / 30;

  const tel = (x, z, R) => {
    let m = 0, a = 0;
    for (const p of g.npcs.people) if (p.alive && Math.hypot(p.x - x, p.z - z) < R) m++;
    for (const t of g.vehicles.traffic) if (t._pos && Math.hypot(t._pos.x - x, t._pos.y - z) < R) a++;
    return { mensen: m, autos: a };
  };
  const stap = (x, z, s) => {
    for (let i = 0; i < Math.round(s * 30); i++) {
      g.npcs.update(dt, i * dt, x, z);
      g.vehicles.updateTraffic(dt, null, null, x, z);
    }
  };

  const begin = { mensen: g.npcs.people.length, verkeer: g.vehicles.traffic.length };
  stap(0, 0, 0.1);   // één beeld, zodat elke auto een `_pos` heeft

  // ---- 1/2/3/4: de wijken ----
  const wijken = [];
  for (const [naam, x, z] of [['Molenkrite', 30, -20], ['Jasker', -180, 120], ['Bonkelaar', 210, 60],
    ['Lemmerweg', 700, 330], ['IJlst', 1180, 700], ['Duinterpen', 1320, 300]]) {
    const voor = { r80: tel(x, z, 80), r200: tel(x, z, 200) };
    stap(x, z, 60);
    wijken.push({ naam, x, z, voor, na: { r80: tel(x, z, 80), r200: tel(x, z, 200) } });
  }

  // ---- 5: nooit in het zicht dichtbij ----
  // Tweehonderd keer verhuizen vanaf een standpunt in de wijk en elke keer
  // nakijken waar iemand terechtkomt.
  const cx = 30, cz = -20;
  const zicht = { totaal: 0, teDichtbij: 0, dichtstbij: 1e9, inZichtOnder110: 0 };
  const proef = g.npcs.people[0];
  for (let i = 0; i < 200; i++) {
    if (!g.npcs.verhuisNaarBuurt(proef, cx, cz)) continue;
    const s = proef.seg, t = proef.t;
    const x = s.a[0] + (s.b[0] - s.a[0]) * t, z = s.a[1] + (s.b[1] - s.a[1]) * t;
    const d = Math.hypot(x - cx, z - cz);
    zicht.totaal++;
    zicht.dichtstbij = Math.min(zicht.dichtstbij, d);
    if (d < 70 || d > 205) zicht.teDichtbij++;
    if (d < 110 && zichtVrij(cx, cz, x, z, 1.6)) zicht.inZichtOnder110++;
  }
  // en hetzelfde voor de binnenste ring, waar álles achter een gebouw moet liggen
  const kort = { totaal: 0, inZicht: 0, dichtstbij: 1e9, verste: 0 };
  for (let i = 0; i < 200; i++) {
    if (!g.npcs.verhuisNaarBuurt(proef, cx, cz, 45, Infinity, 105)) continue;
    const s = proef.seg, t = proef.t;
    const x = s.a[0] + (s.b[0] - s.a[0]) * t, z = s.a[1] + (s.b[1] - s.a[1]) * t;
    const d = Math.hypot(x - cx, z - cz);
    kort.totaal++;
    kort.dichtstbij = Math.min(kort.dichtstbij, d);
    kort.verste = Math.max(kort.verste, d);
    if (zichtVrij(cx, cz, x, z, 1.6)) kort.inZicht++;
  }

  // ---- 6: een rit van 50 km/u door de wijk ----
  const as = KAART.wegassen.filter(w => w.drive && /Molenkrite|Jasker|Bonkelaar|Wieken/.test(w.naam || '') && w.lengte > 150)
    .sort((a, b) => b.lengte - a.lengte)[0];
  const pad = as.pts;
  let k = 0, over = 0, richting = 1, rx = pad[0][0], rz = pad[0][1];
  const rit = [];
  for (let s = 0; s < 120; s++) {
    for (let i = 0; i < 30; i++) {
      let rest = 13.9 * dt;                       // 50 km/u
      while (rest > 0) {
        const j = k + richting;
        if (j < 0 || j >= pad.length) { richting *= -1; continue; }
        const L = Math.hypot(pad[j][0] - pad[k][0], pad[j][1] - pad[k][1]);
        if (over + rest < L) { over += rest; rest = 0; } else { rest -= L - over; over = 0; k = j; }
      }
      const j = Math.max(0, Math.min(pad.length - 1, k + richting));
      const L = Math.max(1e-6, Math.hypot(pad[j][0] - pad[k][0], pad[j][1] - pad[k][1]));
      rx = pad[k][0] + (pad[j][0] - pad[k][0]) * (over / L);
      rz = pad[k][1] + (pad[j][1] - pad[k][1]) * (over / L);
      g.npcs.update(dt, s + i * dt, rx, rz);
      g.vehicles.updateTraffic(dt, null, null, rx, rz);
    }
    if (s > 10 && s % 5 === 4) rit.push(tel(rx, rz, 80));
  }

  // ---- 7: wat het kost ----
  const meet = (metCam) => {
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) {
      if (metCam) { g.npcs.update(dt, i * dt, rx, rz); g.vehicles.updateTraffic(dt, null, null, rx, rz); }
      else { g.npcs.update(dt, i * dt); g.vehicles.updateTraffic(dt, null, null); }
    }
    return (performance.now() - t0) / 60;
  };
  meet(true);
  const kosten = { zonder: meet(false), met: meet(true) };

  return { begin, eind: { mensen: g.npcs.people.length, verkeer: g.vehicles.traffic.length },
           lokaal: g.vehicles.traffic.filter(t => t.lokaal).length,
           rijbanen: g.vehicles.rijbanen.length, as: as.naam, wijken, zicht, kort, rit, kosten };
});

// ---------- 1. er wordt verhuisd, niet bijgemaakt ----------
kop('het aantal blijft gelijk');
ok(uit.eind.mensen === uit.begin.mensen, 'er komen geen voetgangers bij',
  `${uit.begin.mensen} → ${uit.eind.mensen}`);
ok(uit.eind.verkeer === uit.begin.verkeer, 'en geen auto\'s',
  `${uit.begin.verkeer} → ${uit.eind.verkeer}`);
ok(uit.lokaal >= 4, 'het wijkverkeer is als `lokaal` gemerkt', `${uit.lokaal} van ${uit.eind.verkeer}`);
ok(uit.rijbanen > 200, 'en kan op elke rijbaan van de wereld gezet worden', `${uit.rijbanen} rijbanen`);

// ---------- 2/3/4. de wijken ----------
kop('na een minuut staat er een buurt om je heen');
for (const w of uit.wijken) {
  ok(w.na.r200.mensen >= 12, `${w.naam}: mensen binnen 200 m`,
    `${w.voor.r200.mensen} → ${w.na.r200.mensen}`);
}
const leegVoor = uit.wijken.filter(w => w.voor.r200.mensen < 4);
ok(leegVoor.length > 0 && leegVoor.every(w => w.na.r200.mensen >= 12),
  'ook de wijken die eerst helemaal leeg waren',
  leegVoor.map(w => `${w.naam} ${w.voor.r200.mensen}→${w.na.r200.mensen}`).join(', '));
const dichtbij = uit.wijken.filter(w => w.na.r80.mensen >= 2).length;
ok(dichtbij >= 4, 'en in de meeste wijken ook in de straat waar je staat',
  `${dichtbij} van ${uit.wijken.length} wijken met 2+ binnen 80 m: ` +
  uit.wijken.map(w => `${w.na.r80.mensen}`).join('/'));
const metVerkeer = uit.wijken.filter(w => w.na.r200.autos >= 1).length;
ok(metVerkeer >= 5, 'er rijdt overal verkeer, ook in IJlst en Duinterpen',
  uit.wijken.map(w => `${w.naam} ${w.voor.r200.autos}→${w.na.r200.autos}`).join(', '));

// ---------- 5. niemand verschijnt vóór je neus ----------
kop('niet in het zicht');
ok(uit.zicht.totaal > 150, 'de buitenste ring vindt bijna altijd een plek',
  `${uit.zicht.totaal} van 200`);
ok(uit.zicht.teDichtbij === 0, 'alles komt in de band 70–205 m terecht',
  `dichtstbij ${uit.zicht.dichtstbij.toFixed(1)} m`);
ok(uit.zicht.inZichtOnder110 === 0, 'onder 110 m staat er altijd een gebouw tussen',
  `${uit.zicht.inZichtOnder110} keer in het vrije zicht`);
// Een minderheid: de meeste straatpunten binnen honderd meter liggen in het
// vrije zicht, en die vallen af. Eén op de drie is genoeg — het spel probeert
// het twee keer per seconde.
ok(uit.kort.totaal >= 40, 'de binnenste ring vindt in de wijk een plek achter een gebouw',
  `${uit.kort.totaal} van 200 pogingen, dichtstbij ${uit.kort.dichtstbij.toFixed(1)} m`);
ok(uit.kort.inZicht === 0, 'en daar ligt nooit iets in het vrije zicht',
  `${uit.kort.inZicht} keer`);
ok(uit.kort.verste <= 105.1, 'de binnenste ring blijft binnen 105 m',
  `verste ${uit.kort.verste.toFixed(1)} m`);

// ---------- 6. rijdend ----------
kop('rijdend op 50 km/u');
const m80 = uit.rit.map(r => r.mensen);
const gem = m80.reduce((a, b) => a + b, 0) / m80.length;
ok(gem >= 2.5, `over ${uit.as} blijft de buurt bijblijven`,
  `gemiddeld ${gem.toFixed(1)} mensen binnen 80 m, min ${Math.min(...m80)}, max ${Math.max(...m80)}`);
ok(Math.min(...m80) >= 1, 'en het is nooit helemaal uitgestorven');
ok(Math.max(...m80) <= 14, 'maar ook niet stampvol — het is een woonwijk',
  `max ${Math.max(...m80)} binnen 80 m`);
const a80 = uit.rit.map(r => r.autos);
ok(a80.some(a => a >= 1), 'er komt rijdend verkeer voorbij',
  `${a80.filter(a => a >= 1).length} van ${a80.length} metingen met een auto binnen 80 m`);

// ---------- 7. kosten ----------
kop('wat het kost');
const extra = uit.kosten.met - uit.kosten.zonder;
ok(extra < 0.35, 'het bijvullen kost bijna niets per beeld',
  `${uit.kosten.zonder.toFixed(3)} → ${uit.kosten.met.toFixed(3)} ms (+${extra.toFixed(3)})`);

console.log(fouten ? `\n${fouten} fout(en).` : '\nAlles goed.');
await browser.close();
process.exit(fouten ? 1 : 0);

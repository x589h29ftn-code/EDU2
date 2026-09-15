/*
 Varen: de twee sloepen, hoe ze varen en hoe je in- en uitstapt.

   npm run server &   node tools/boottest.mjs [poort]

 Wat hier getoetst wordt is vooral wat je niet ziet: dat de boot traag is en
 blijft, dat hij op het water blijft, dat hij onder een brug door kan en niet
 door een duiker, dat het roer pas werkt als er vaart in zit, en dat je niet
 midden op de Geeuw uit kunt stappen.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let goed = 0, fout = 0;
const ok = (naam, waar, extra = '') => {
  if (waar) { goed++; console.log(`  ✓ ${naam}`); }
  else { fout++; console.log(`  ✗ ${naam}${extra ? ' — ' + extra : ''}`); }
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1024, height: 640 } });
const fouten = [];
page.on('pageerror', e => fouten.push(e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game && window.__game.boten, null, { timeout: 300000 });

await page.evaluate(() => {
  const g = window.__game;
  g.player.active = true;
  // hulpjes: een aantal beelden varen met vaste stappen, zonder op de klok te wachten
  window.__vaar = (toetsen, n = 60, dt = 1 / 60) => {
    for (let i = 0; i < n; i++) g.boten.update(dt, toetsen);
    return g.boten.boten.find(b => b.inBoot) || null;
  };
  window.__zetPlek = (i) => g.boten.naarLigplaats(i);
  /*
   Ruim water om op te meten. Het grootste watervlak in het spel is ruim
   180.000 m² en meet vijfhonderd bij zeshonderd meter; daar kun je een halve
   minuut vol gas geven zonder ergens tegenaan te lopen, en dat is precies wat
   je nodig hebt om een boot die traag is ook traag te kunnen noemen.
  */
  window.__ruim = (yaw = -0.785) => {
    const b = g.boten.inBoot;
    return b ? g.boten.verplaats(b, 1650, 1390, yaw) : false;
  };
  window.__zetKoers = (yaw) => {
    const b = g.boten.inBoot;
    return b ? g.boten.verplaats(b, b.x, b.z, yaw) : false;
  };
  window.__verplaats = (x, z) => {
    const b = g.boten.inBoot;
    return b ? g.boten.verplaats(b, x, z, b.yaw) : false;
  };
});

// ---------- de ligplaatsen ----------
console.log('\nligplaatsen');
const lig = await page.evaluate(() => window.__game.boten.boten);
ok('er liggen twee boten', lig.length === 2, JSON.stringify(lig.map(b => b.naam)));
ok('er ligt er een bij de Geeuw', lig.some(b => b.naam === 'Geeuw'));
ok('er ligt er een in IJlst', lig.some(b => b.naam === 'IJlst'));
const opWater = await page.evaluate(() => {
  const g = window.__game;
  return g.boten.boten.map(b => g.boten.pastHier(b.x, b.z, b.yaw));
});
ok('allebei liggen ze in bevaarbaar water', opWater.every(Boolean), JSON.stringify(opWater));

// ---------- instappen ----------
console.log('\ninstappen');
const instap = await page.evaluate(() => {
  const g = window.__game, b = g.boten.boten[0];
  g.player.pos.set(b.x + 2, 0, b.z);          // binnen de instapafstand
  const dicht = g.boten.dichtstbij(g.player.pos.x, g.player.pos.z);
  const ver = g.boten.dichtstbij(b.x + 400, b.z);
  const gelukt = g.boten.stapIn(dicht);
  return { dicht: !!dicht, ver: !!ver, gelukt, inBoot: !!g.boten.inBoot, spelerInBoot: !!g.player.inBoot };
});
ok('vlakbij vind je de boot', instap.dicht);
ok('op vierhonderd meter niet', !instap.ver);
ok('instappen lukt', instap.gelukt && instap.inBoot);
ok('de speler weet dat hij aan boord is', instap.spelerInBoot);

/*
 En het geval waar het echt om gaat: je staat op de kant. Je kunt niet het water
 in lopen (js/player.js houdt je tegen), dus als je de boot niet vanaf de wal
 kunt pakken kun je hem nooit pakken.
*/
const vanafDeWal = await page.evaluate(() => {
  const g = window.__game, B = g.boten;
  B.stapUit();
  return B.boten.map((b, i) => {
    // het dichtstbijzijnde stukje droge grond naast deze boot
    let wal = null;
    for (let r = 1; r <= 14 && !wal; r += 0.5) for (let k = 0; k < 48; k++) {
      const h = k / 48 * 6.283, x = b.x + Math.cos(h) * r, z = b.z + Math.sin(h) * r;
      if (!B.pastHier(x, z, 0)) { wal = { x, z, r }; break; }
    }
    if (!wal) return { naam: b.naam, wal: null };
    const gevonden = B.dichtstbij(wal.x, wal.z);
    return { naam: b.naam, afstand: +wal.r.toFixed(1), raak: !!gevonden && gevonden.naam === b.naam, i };
  });
});
// weer aan boord, want de rest van deze test vaart
await page.evaluate(() => window.__game.boten.stapIn(window.__game.boten.ruw(0)));
for (const r of vanafDeWal) {
  ok(`vanaf de wal kun je bij de sloep in ${r.naam}`, r.raak, `oever op ${r.afstand} m`);
}

// ---------- traag ----------
console.log('\ntrage boot');
const traag = await page.evaluate(() => {
  const g = window.__game;
  const ruim = window.__ruim();
  const na = (n) => { window.__vaar({ KeyW: true }, n); return g.boten.vaart; };
  const v1 = na(60);          // één seconde vol gas
  const v3 = na(120);         // en nog twee erbij
  const v10 = na(420);        // tien seconden
  return { ruim, v1, v3, v10, top: g.boten.top };
});
ok('het ruime water is bevaarbaar', traag.ruim);
ok('na een seconde vol gas nog geen drie meter per seconde', traag.v1 < 3, `${traag.v1.toFixed(2)}`);
ok('hij loopt wel op', traag.v3 > traag.v1);
ok('de topsnelheid is zeven meter per seconde', Math.abs(traag.top - 7) < 0.01, `${traag.top}`);
ok('na tien seconden zit hij onder de top', traag.v10 <= traag.top + 0.01, `${traag.v10.toFixed(2)}`);
ok('en hij haalt wel het grootste deel ervan', traag.v10 > traag.top * 0.6, `${traag.v10.toFixed(2)}`);

// een auto is veel sneller: dat is het hele punt van een trage boot
ok('een boot is veel trager dan een auto', traag.top < 24 * 0.4, `${traag.top} tegen 24`);

// ---------- uitlopen: er zit geen rem op ----------
console.log('\nuitlopen');
const uitloop = await page.evaluate(() => {
  const g = window.__game;
  window.__ruim();
  window.__vaar({ KeyW: true }, 420);
  const v0 = g.boten.vaart;
  const b = g.boten.boten.find(o => o.inBoot);
  const x0 = b.x, z0 = b.z;
  window.__vaar({}, 60);                        // één seconde niets doen
  const v1 = g.boten.vaart;
  window.__vaar({}, 600);                       // en dan tien seconden
  const na = g.boten.boten.find(o => o.inBoot);
  return { v0, v1, v10: g.boten.vaart, weg: Math.hypot(na.x - x0, na.z - z0) };
});
ok('gas eraf remt hem maar langzaam af', uitloop.v1 > uitloop.v0 * 0.7,
  `${uitloop.v0.toFixed(2)} → ${uitloop.v1.toFixed(2)}`);
ok('maar na tien seconden ligt hij bijna stil', uitloop.v10 < 1.2, `${uitloop.v10.toFixed(2)}`);
ok('en hij is ondertussen flink doorgelopen', uitloop.weg > 8, `${uitloop.weg.toFixed(1)} m`);

// ---------- het roer ----------
console.log('\nhet roer');
const roer = await page.evaluate(() => {
  const g = window.__game;
  const boot = () => g.boten.boten.find(o => o.inBoot);
  // eerst helemaal stil leggen op ruim water
  window.__ruim();
  window.__vaar({}, 600);
  const stil = boot().yaw;
  window.__vaar({ KeyA: true }, 120);           // roer om, geen gas
  const naStil = boot().yaw;
  window.__ruim();
  window.__vaar({ KeyW: true }, 420);           // op snelheid
  const voor = boot().yaw;
  window.__vaar({ KeyW: true, KeyA: true }, 120);
  const naVaart = boot().yaw;
  return {
    zonderVaart: Math.abs(naStil - stil),
    metVaart: Math.abs(naVaart - voor),
    snelheid: g.boten.vaart,
  };
});
ok('stilliggend draait het roer bijna niets', roer.zonderVaart < 0.05, `${roer.zonderVaart.toFixed(3)} rad`);
ok('met vaart draait hij wel', roer.metVaart > 0.3, `${roer.metVaart.toFixed(3)} rad`);
ok('en dat is véél meer dan stilliggend', roer.metVaart > roer.zonderVaart * 6);

// draaien op de schroef: gas geven vanuit stilstand met het roer om moet wél werken
const schroef = await page.evaluate(() => {
  const g = window.__game;
  const boot = () => g.boten.boten.find(o => o.inBoot);
  window.__ruim();
  const voor = boot().yaw;
  window.__vaar({ KeyW: true, KeyD: true }, 90);
  return Math.abs(boot().yaw - voor);
});
ok('met gas draait hij vanuit stilstand wel van de kant af', schroef > 0.15, `${schroef.toFixed(3)} rad`);

// ---------- achteruit ----------
console.log('\nachteruit');
const achter = await page.evaluate(() => {
  const g = window.__game;
  window.__ruim();
  window.__vaar({ KeyS: true }, 420);
  return g.boten.vaart;
});
ok('achteruit gaat hij ook, maar traag', achter < -0.4 && achter > -2.5, `${achter.toFixed(2)}`);

// ---------- op het water blijven ----------
console.log('\nop het water blijven');
const wal = await page.evaluate(() => {
  const g = window.__game, B = g.boten;
  // terug naar de ligplaats en daar de neus recht op de wal zetten
  window.__zetPlek(0);
  const b = B.boten.find(o => o.inBoot);
  let land = null;
  for (let r = 4; r <= 40 && !land; r += 1) for (let i = 0; i < 48; i++) {
    const h = i / 48 * 6.283, x = b.x + Math.cos(h) * r, z = b.z + Math.sin(h) * r;
    if (!B.pastHier(x, z, b.yaw)) { land = { x, z }; break; }
  }
  const yaw = Math.atan2(-(land.x - b.x), -(land.z - b.z));
  window.__zetKoers(yaw);
  window.__vaar({ KeyW: true }, 1800);          // een halve minuut vol op de kant af
  const live = B.inBoot;                         // ongeafrond, anders wringt een centimeter
  const na = { x: live.x, z: live.z, yaw: live.yaw };
  return { vaarbaar: B.pastHier(na.x, na.z, na.yaw), land, na,
    vaart: B.vaart, weg: Math.hypot(na.x - land.x, na.z - land.z) };
});
ok('hij vaart de wal niet op', wal.vaarbaar, JSON.stringify(wal));
ok('en hij ligt daar stil', Math.abs(wal.vaart) < 1.5, `${wal.vaart.toFixed(2)} m/s`);

/*
 En de steven zelf blijft ook op het water. `pastHier` toetst de buitenkant van
 de romp; zou hij ergens binnenin toetsen, dan steekt de boeg het gras in en dat
 is precies waar het op lijkt als je erop afvaart.
*/
const steven = await page.evaluate(async () => {
  const { vaarbaar } = await import('/js/world.js');
  const b = window.__game.boten.inBoot;
  const L = window.__game.boten.maten.LENGTE, B = window.__game.boten.maten.BREEDTE;
  const punt = (l, d) => [b.x - Math.sin(b.yaw) * l + Math.cos(b.yaw) * d,
    b.z - Math.cos(b.yaw) * l - Math.sin(b.yaw) * d];
  const hoeken = [[L * 0.55, 0], [-L * 0.5, 0], [L * 0.05, B * 0.5], [L * 0.05, -B * 0.5]];
  return hoeken.map(([l, d]) => { const [x, z] = punt(l, d); return vaarbaar(x, z); });
});
ok('ook zijn steven en zijn breedste punten liggen nog op het water',
  steven.every(Boolean), JSON.stringify(steven));

// ---------- uitstappen ----------
console.log('\nuitstappen');
const uit = await page.evaluate(() => {
  const g = window.__game;
  // terug naar de ligplaats, daar is de kant vlakbij
  window.__zetPlek(0);
  const gelukt = g.boten.stapUit();
  return { gelukt, inBoot: !!g.boten.inBoot, spelerInBoot: !!g.player.inBoot,
    speler: { x: g.player.pos.x, z: g.player.pos.z },
    opWater: g.boten.pastHier(g.player.pos.x, g.player.pos.z, 0) };
});
ok('aan de kant stap je uit', uit.gelukt && !uit.inBoot);
ok('de speler staat niet meer aan boord', !uit.spelerInBoot);
ok('en hij staat op het droge', !uit.opWater, JSON.stringify(uit.speler));

const midden = await page.evaluate(() => {
  const g = window.__game;
  // midden op het brede water: daar is geen wal binnen negen meter
  g.boten.stapIn(g.boten.ruw(0));
  const ruim = window.__ruim();
  const kan = g.boten.stapUit();
  return { ruim, kan, inBoot: !!g.boten.inBoot };
});
ok('op ruim water ligt hij er ook echt', midden.ruim);
ok('midden op het water stap je niet uit', !midden.kan && midden.inBoot);

// ---------- onder een brug door, niet door een duiker ----------
console.log('\nbruggen en duikers');
const bg = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const { vaarbaar, pointInWater } = await import('/js/world.js');
  /*
   Het zwaartepunt van een ring ligt er bij een gebogen steiger of een knik in
   een brug soms náást. Daarom eerst nakijken of het punt er echt in ligt, en
   anders dit vlak overslaan: we toetsen `vaarbaar`, niet de meetkunde.
  */
  const inRing = (x, z, r) => { let b = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const a = r[i], c = r[j];
      if ((a[1] > z) !== (c[1] > z) && x < (c[0] - a[0]) * (z - a[1]) / (c[1] - a[1]) + a[0]) b = !b; }
    return b; };
  const punt = (v) => {
    let x = 0, z = 0;
    for (const p of v.r[0]) { x += p[0]; z += p[1]; }
    x /= v.r[0].length; z /= v.r[0].length;
    return inRing(x, z, v.r[0]) ? [x, z] : null;
  };
  const tel = { brug: [0, 0], duiker: [0, 0], steiger: [0, 0] };
  let overgeslagen = 0;
  for (const v of KAART.vlakken) {
    const t = tel[v.k];
    if (!t) continue;
    const p = punt(v);
    if (!p) { overgeslagen++; continue; }
    if (vaarbaar(p[0], p[1])) t[0]++; else t[1]++;
  }
  // en te voet moet een brug juist géén water zijn
  const brug = KAART.vlakken.filter(v => v.k === 'brug').map(punt).find(Boolean);
  return { tel, overgeslagen, teVoet: brug ? pointInWater(brug[0], brug[1]) : null };
});
ok('onder bruggen kun je door varen', bg.tel.brug[0] > 0, JSON.stringify(bg.tel.brug));
ok('door duikers niet', bg.tel.duiker[0] === 0, JSON.stringify(bg.tel.duiker));
ok('en niet onder een steiger door', bg.tel.steiger[0] === 0, JSON.stringify(bg.tel.steiger));
ok('te voet is een brug geen water', bg.teVoet === false);

// ---------- schuim ----------
console.log('\nschuim');
const schuim = await page.evaluate(() => {
  const g = window.__game;
  window.__ruim();
  window.__vaar({}, 600);                       // het schuim van daarvoor uit laten doven
  const stil = g.boten.schuimAan;
  window.__vaar({ KeyW: true }, 300);
  return { stil, varend: g.boten.schuimAan };
});
ok('stilliggend laat hij geen schuim na', schuim.stil === 0, `${schuim.stil}`);
ok('varend wel', schuim.varend > 0, `${schuim.varend}`);

/*
 ---------- opslaan en laden ----------
 F5 sloeg alleen de auto op. Voer je naar de overkant en drukte je F9, dan stond
 je ineens op de kant en lag de boot weer op zijn ligplaats. Nu hoort allebei
 terug te komen: waar de sloepen liggen en of jij aan het roer stond.
*/
console.log('\nopslaan en laden');
const bewaard = await page.evaluate(() => {
  const g = window.__game;
  if (!g.boten.inBoot) g.boten.stapIn(g.boten.ruw(0));
  window.__ruim(1.1);                       // een eind van de ligplaats vandaan
  const b = g.boten.inBoot;
  const voor = { x: b.x, z: b.z, yaw: b.yaw };
  g.opslaan();
  // alles overhoop: van boord, en de boten terug naar hun ligplaats
  g.boten.herstel(null);
  g.boten.naarLigplaats(0); g.boten.naarLigplaats(1);
  const tussen = { x: g.boten.ruw(0).x, z: g.boten.ruw(0).z, aanBoord: !!g.boten.inBoot };
  g.laden();
  const na = g.boten.ruw(0);
  return {
    voor, tussen,
    na: { x: na.x, z: na.z, yaw: na.yaw },
    aanBoord: g.boten.inBoot === na,
    spelerInBoot: g.player.inBoot === na,
    inCar: !!g.player.inCar,
  };
});
ok('de proef begon met een verzette boot', Math.hypot(bewaard.tussen.x - bewaard.voor.x, bewaard.tussen.z - bewaard.voor.z) > 50);
ok('na laden ligt de boot terug waar je hem liet',
  Math.hypot(bewaard.na.x - bewaard.voor.x, bewaard.na.z - bewaard.voor.z) < 0.1,
  JSON.stringify(bewaard));
ok('met dezelfde koers', Math.abs(bewaard.na.yaw - bewaard.voor.yaw) < 0.01);
ok('en je staat weer aan het roer', bewaard.aanBoord && bewaard.spelerInBoot);
ok('en niet ook nog in een auto', !bewaard.inCar);

const teVoet = await page.evaluate(() => {
  const g = window.__game;
  g.boten.stapUit() || g.boten.herstel({ boten: g.boten.bewaar().boten, aanBoord: -1 });
  const b = g.boten.ruw(0);
  g.player.pos.set(b.x, 0, b.z + 30);
  g.opslaan();
  g.boten.stapIn(b);
  g.laden();
  return { aanBoord: !!g.boten.inBoot, spelerInBoot: !!g.player.inBoot };
});
ok('sla je te voet op, dan sta je na laden niet ineens in de boot',
  !teVoet.aanBoord && !teVoet.spelerInBoot, JSON.stringify(teVoet));

console.log(`\nfouten in de pagina: ${fouten.length ? fouten.join(' | ') : 'geen'}`);
if (fouten.length) fout++;
console.log(`\n${goed} goed, ${fout} fout`);
await browser.close();
process.exit(fout ? 1 : 0);

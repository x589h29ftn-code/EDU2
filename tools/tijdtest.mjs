/*
 Stap 125: het dag-en-nachtritme en de vuilniswagen van Súdwest-Fryslân (5 okt 2026: "Zorg dan ook dat er
 standaard een dag en nacht ritme loopt met de tijd. … Laat gebruiker met een knop de tijd kiezen als een
 soort schakelaar (bijvoorbeeld knop T). Zet dit ook in de instellingen. Tijdens missie is het bepaald
 tijdstip en dan staat als het nodig is voor de missie de tijd stil. … maak voor de vuilniswagen een
 speciaal auto model … met sudwest Fryslan logo. Is een daf vrachtauto voor afval").

   node tools/server.mjs 8123 &   node tools/tijdtest.mjs [poort]   (npm run tijdtest)

 1. De klok loopt vanaf het begin: een dag in 48 minuten; licht van zes tot zes.
 2. T: ochtend → middag → avond → nacht → ochtend, met een melding.
 3. De instellingen: dag en nacht aan en uit (bewaard in de browser), de tijd kiezen.
 4. Een missie: begint 's nachts de volgende ochtend, staat stil zolang hij loopt, T doet dan niets;
    wachten onder de M laat de klok lopen; na de missie loopt hij weer; na laden geen sprong.
 5. Een missie die de nacht nodig heeft (de race) blijft donker en stil.
 6. De vuilniswagen: het eigen model (geel, DAF, het logo met rood, blauw en groen), lengte, botsen.
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
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 960, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(() => {
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1'); localStorage.removeItem('tinga.checkpoint.v1');
  document.getElementById('overlay').style.display = 'none';
  window.__autoplay = true;
  g.player.active = false;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; g.verhaal.update(dt); } };
  window.__vrij = () => {
    const v = g.verhaal, s = v.bewaar(); s.volgende = null; s.punt = null;
    Object.assign(s, { missie: 'klaar', fase: 'klaar' });
    v.herstel(s); window.__stap(2);
  };
});

// ------------------------------------------------------------------ 1. de klok loopt
kop('de klok loopt vanaf het begin');
const klok = await page.evaluate(async () => {
  const g = window.__game, S = g.sfeer;
  const { DAG_MINUTEN } = await import('/js/sfeer.js');
  // een nieuw spel begint in missie 1, overdag: ook dan loopt de klok
  window.__stap(2);
  const uit = { voorkeur: S.voorkeur, loopt: S.loopt, dagMin: DAG_MINUTEN, missie: g.verhaal.missie };
  S.uur = 10;
  S.update(60, 0, 0);                      // een minuut
  uit.naMinuut = S.uur;
  S.uur = 12; uit.middagNacht = S.nacht;
  S.uur = 2; uit.nachtNacht = S.nacht;
  S.uur = 13;
  return uit;
});
ok(klok.voorkeur && klok.loopt, 'een nieuw spel (missie 1, overdag): de klok loopt mee', klok.missie);
ok(klok.dagMin === 48 && Math.abs(klok.naMinuut - 10.5) < 0.01, 'een minuut is een half uur: een dag in 48 minuten', `10:00 → ${klok.naMinuut.toFixed(3)}`);
ok(!klok.middagNacht && klok.nachtNacht, 'om 12 uur licht, om 2 uur donker');

// ------------------------------------------------------------------ 2. T
kop('T: ochtend, middag, avond, nacht');
const t = await page.evaluate(() => {
  const g = window.__game, S = g.sfeer;
  window.__vrij();
  S.uur = 13;
  const rij = [];
  for (let i = 0; i < 5; i++) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT' }));
    rij.push({ naam: S.tijdNaam, uur: S.uur, nacht: S.nacht });
  }
  const melding = document.getElementById('msg') ? document.getElementById('msg').textContent : '';
  return { rij, melding };
});
ok(t.rij.map(r => r.naam).join(',') === 'avond,nacht,ochtend,middag,avond', 'de schakelaar gaat rond', t.rij.map(r => `${r.naam} ${r.uur}`).join(' · '));
ok(t.rij[1].nacht && !t.rij[2].nacht && !t.rij[3].nacht, '\'s nachts donker, \'s ochtends en \'s middags licht');
ok(/Avond/.test(t.melding), 'met een melding in beeld', t.melding);

// ------------------------------------------------------------------ 3. de instellingen
kop('de instellingen');
const inst = await page.evaluate(async () => {
  const g = window.__game, S = g.sfeer;
  const M = await import('/js/menu.js');
  const uit = {};
  g.pauzeer && g.pauzeer();
  document.getElementById('menuInstellingen') && document.getElementById('menuInstellingen').click();
  const tekst = document.querySelector('.menuzij') ? document.querySelector('.menuzij').textContent : '';
  uit.regels = /Dag en nacht/.test(tekst) && /Tijd/.test(tekst);
  uit.tekst = tekst.slice(0, 300);
  // de regel Dag en nacht omzetten
  const knoppen = [...document.querySelectorAll('.menuzij *')].filter(e => /Dag en nacht/.test(e.textContent) && e.children.length <= 3);
  S.zetVoorkeur(false);
  uit.uit = { voorkeur: S.voorkeur, loopt: S.loopt, opslag: localStorage.getItem('tinga.dagnacht') };
  // zonder missie houdt het verhaal zich aan de voorkeur
  window.__stap(3);
  uit.blijftStil = S.loopt === false;
  S.zetVoorkeur(true);
  window.__stap(3);
  uit.aan = { voorkeur: S.voorkeur, loopt: S.loopt, opslag: localStorage.getItem('tinga.dagnacht') };
  g.hervat && g.hervat();
  return uit;
});
ok(inst.regels, 'Dag en nacht en Tijd staan in de instellingen', inst.tekst);
ok(!inst.uit.voorkeur && !inst.uit.loopt && inst.uit.opslag === 'stil' && inst.blijftStil, 'uitzetten: de klok staat stil, ook na het verhaal, en de browser onthoudt het');
ok(inst.aan.voorkeur && inst.aan.loopt && inst.aan.opslag === 'loopt', 'en weer aan');

// ------------------------------------------------------------------ 4. een missie
kop('een missie: overdag, en de tijd ligt vast');
const missie = await page.evaluate(() => {
  const g = window.__game, S = g.sfeer, v = g.verhaal;
  const uit = {};
  g.politie.reset();
  S.uur = 23.5;
  v.startMissie('rijden');
  window.__stap(3);
  uit.start = { uur: S.uur, loopt: S.loopt, bezig: v.missieBezig, vast: v.tijdVast() };
  const voor = S.uur;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyT' }));
  uit.tNiets = S.uur === voor;
  uit.tMelding = document.getElementById('msg') ? document.getElementById('msg').textContent : '';
  // overdag loopt hij door; om zes uur 's avonds blijft hij staan
  S.update(120, 0, 0);
  uit.loopt = S.uur - voor;
  S.uur = 17.9; window.__stap(1);
  for (let i = 0; i < 20; i++) { S.update(30, 0, 0); window.__stap(1); }
  uit.avond = { uur: S.uur, loopt: S.loopt, nacht: S.nacht };
  // en 's nachts (een missie die zijn eigen nacht zet) staat hij stil
  S.uur = 1; window.__stap(2);
  const nacht = S.uur; S.update(120, 0, 0);
  uit.nachtStil = S.uur === nacht && !S.loopt;
  // een missie die onder zijn M wacht: de klok loopt
  v.startMissie('bx');
  window.__stap(3);
  uit.wacht = { fase: v.fase, bezig: v.missieBezig, loopt: S.loopt, vast: v.tijdVast() };
  // klaar: weer vrij
  return uit;
});
ok(Math.abs(missie.start.uur - 9) < 0.01 && missie.start.bezig, 'om half twaalf \'s nachts begint een missie de volgende ochtend', `${missie.start.uur}`);
ok(missie.start.loopt && /missie/.test(missie.start.vast || ''), 'overdag loopt de klok in de missie door, maar de tijd ligt vast', missie.start.vast);
ok(missie.tNiets && /missie/.test(missie.tMelding), 'T doet dan niets en zegt waarom', missie.tMelding);
ok(Math.abs(missie.loopt - 1) < 0.01, 'twee minuten later is het een uur later', missie.loopt.toFixed(3));
ok(Math.abs(missie.avond.uur - 18) < 0.3 && !missie.avond.loopt && !missie.avond.nacht, 'om zes uur blijft hij staan: een dagmissie wordt niet donker', JSON.stringify(missie.avond));
ok(missie.nachtStil, '\'s nachts staat de klok in een missie stil');
ok(!missie.wacht.bezig && missie.wacht.loopt && missie.wacht.vast === null, 'een missie die onder zijn M wacht: de klok loopt gewoon', JSON.stringify(missie.wacht));

const laden = await page.evaluate(() => {
  const g = window.__game, S = g.sfeer, v = g.verhaal;
  const uit = {};
  // klaar: de klok loopt weer
  v.startMissie('rijden'); window.__stap(2);
  const s = v.bewaar(); s.volgende = null; s.punt = null;
  Object.assign(s, { missie: 'klaar', fase: 'klaar' });
  v.herstel(s); window.__stap(3);
  uit.klaar = { loopt: S.loopt, vast: v.tijdVast() };
  // een opslag midden in een missie, 's nachts geladen: geen sprong naar de ochtend
  v.startMissie('rijden'); window.__stap(2);
  const s2 = v.bewaar();
  S.uur = 1.5;
  v.herstel(s2); window.__stap(3);
  uit.geladen = { uur: S.uur, loopt: S.loopt, missie: v.missie };
  return uit;
});
ok(laden.klaar.loopt && laden.klaar.vast === null, 'na de missie loopt de klok weer');
ok(Math.abs(laden.geladen.uur - 1.5) < 0.01 && !laden.geladen.loopt, 'een geladen missie springt niet naar de ochtend, en staat \'s nachts stil', JSON.stringify(laden.geladen));

// ------------------------------------------------------------------ 5. de nacht van de race
kop('een missie die de nacht nodig heeft');
const race = await page.evaluate(() => {
  const g = window.__game, S = g.sfeer, v = g.verhaal;
  const uit = {};
  S.uur = 14;
  if (v.__opDeStart) v.__opDeStart();
  else {
    // de race begint op de grid om 01:00 (missie 14); de missie zelf zet die nacht
    v.startMissie('race');
    window.__stap(2);
  }
  // na het telefoontje, aan de schuur van Ronald, de grid: het verhaal zet zelf de nacht
  uit.missie = v.missie;
  S.uur = 1; window.__stap(20);
  uit.na = { uur: S.uur, loopt: S.loopt, nacht: S.nacht, bezig: v.missieBezig };
  return uit;
});
ok(race.missie === 'race', 'missie 14 begint');
ok(!race.na.bezig || (race.na.nacht && !race.na.loopt), 'een nacht die het verhaal zet blijft nacht, en de klok staat stil', JSON.stringify(race.na));

// ------------------------------------------------------------------ 6. de vuilniswagen
kop('de vuilniswagen van Súdwest-Fryslân');
const wagen = await page.evaluate(async () => {
  const g = window.__game, L = g.leven;
  const uit = {};
  const w = L.vuilnis.wagen;
  uit.bestaat = !!w && w.soort === 'vuilnis' && g.vehicles.cars.includes(w);
  const m = w.mesh;
  uit.lengte = m.userData.length;
  // het hele model, met de wielen en de spiegels
  const doos = new (await import('three')).Box3().setFromObject(m);
  uit.maat = { l: doos.max.z - doos.min.z, b: doos.max.x - doos.min.x, h: doos.max.y - doos.min.y };
  // het geel, de DAF-grille en het logo: tel kleuren op de doeken
  const doeken = [];
  m.traverse(o => { if (o.isMesh) for (const mat of [].concat(o.material)) if (mat.map && mat.map.image && mat.map.image.getContext) doeken.push(mat.map.image); });
  const telt = (c, test) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (test(d[i], d[i + 1], d[i + 2])) n++; return n / (c.width * c.height); };
  const zij = doeken.reduce((a, c) => (c.width > (a ? a.width : 0) ? c : a), null);
  uit.doeken = doeken.length;
  uit.geel = telt(zij, (r, g2, b) => r > 220 && g2 > 180 && b < 60);
  uit.rood = telt(zij, (r, g2, b) => r > 150 && g2 < 60 && b > 40 && b < 90);
  uit.blauw = telt(zij, (r, g2, b) => r < 110 && g2 > 150 && b > 200);
  uit.groen = telt(zij, (r, g2, b) => r > 130 && r < 180 && g2 > 180 && b < 90);
  uit.grijsTekst = telt(zij, (r, g2, b) => Math.abs(r - 107) < 12 && Math.abs(g2 - 109) < 12 && Math.abs(b - 112) < 12);
  uit.ruit = !!m.userData.glas;
  // je botst ertegen: zet hem op de weg en kijk of botsAutos hem ziet
  const s = g.start || { x: 10.7, z: -7.1 };
  uit.gestart = L.startVuilnis({ x: s.x, z: s.z }, { zeker: true });
  for (let i = 0; i < 5; i++) L.update(0.1, { x: s.x, z: s.z }, () => true, 8);
  uit.opWeg = Math.hypot(w.x, w.z) < 5000;
  uit.rit = { fase: L.vuilnis.fase, zelfde: L.vuilnis.wagen === w, hp: w.hp, wrak: !!w.wrak, x: Math.round(w.x), z: Math.round(w.z) };
  // een deuk op de neus kan ook (js/autoschade.js)
  w.mesh.updateMatrixWorld(true);
  uit.deuk = g.autoschade.botsing(w, 10, true);
  g.autoschade.herstel(w);
  L.vuilnisWeg();
  return uit;
});
ok(wagen.bestaat, 'een eigen model, soort vuilnis, tussen de auto\'s');
ok(Math.abs(wagen.maat.l - 9.6) < 0.4 && wagen.maat.b > 2.4 && wagen.maat.b < 3.4 && wagen.maat.h > 3.4 && wagen.maat.h < 4.2, 'ruim negen meter lang, 2,5 m breed (met de spiegels ruim 3), bijna 4 m hoog', `${wagen.maat.l.toFixed(2)} × ${wagen.maat.b.toFixed(2)} × ${wagen.maat.h.toFixed(2)} m`);
ok(wagen.geel > 0.4, 'geel', `${(wagen.geel * 100).toFixed(0)} % van de zijkant`);
ok(wagen.rood > 0.002 && wagen.blauw > 0.002 && wagen.groen > 0.002 && wagen.grijsTekst > 0.001, 'het logo: rood, blauw, groen en de grijze letters', `${(wagen.rood * 100).toFixed(2)} / ${(wagen.blauw * 100).toFixed(2)} / ${(wagen.groen * 100).toFixed(2)} / ${(wagen.grijsTekst * 100).toFixed(2)} %`);
ok(wagen.ruit && wagen.doeken >= 4, 'een voorruit en eigen doeken (cabine, bak, achterkant)', `${wagen.doeken} doeken`);
ok(wagen.opWeg, 'hij rijdt in de wijk', `${wagen.gestart} ${JSON.stringify(wagen.rit)}`);
ok(wagen.deuk && wagen.deuk.deuk, 'en krijgt een deuk als je hem ramt');

console.log(fouten ? `\n${fouten} FOUT(EN)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);

/*
 Toetst het botsgevoel en de geluiden uit de beta-ronde.

 Wat er mis kan gaan, en dus wat hier nagerekend wordt:
 1. de motor bromde door zodra je pauzeerde, en de sirene loeide door zodra je
    een gebouw in liep — allebei omdat de lus die ze bijwerkt dan niet meer
    draait. De ketting moet in beide gevallen dicht;
 2. remsporen moeten er komen als je slipt en weer weggaan; blijven ze liggen,
    dan ligt de hele wijk na een half uur vol rubber;
 3. de schok van een botsing moet de camera bewegen en daarna weer uitdempen —
    een schok die blijft hangen is erger dan geen schok;
 4. een wrak hoort na verloop van tijd opgeruimd te worden en als gewone auto
    terug te komen op zijn eigen plek;
 5. in de auto hoort de muziek boven de motor uit te komen, niet andersom.

 Gebruik: python3 -m http.server 8123 &  node tools/gevoeltest.mjs 8123
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
// het geluid start pas na een aanraking van de gebruiker
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  window.__game.player.active = true;
  window.__game.geluid.start();
});
await page.waitForTimeout(400);

kop('de geluidsketen gaat dicht als het spel stilstaat');
const pauze = await page.evaluate(async () => {
  const g = window.__game;
  g.geluid.motorAan();
  g.geluid.motorToeren(14, 24);
  await new Promise(r => setTimeout(r, 350));
  const rijdend = g.geluid.stand();
  g.pauzeer();
  await new Promise(r => setTimeout(r, 400));
  const stil = g.geluid.stand();
  g.geluid.pauzeer(false);
  await new Promise(r => setTimeout(r, 400));
  const weer = g.geluid.stand();
  g.geluid.motorUit();
  return { rijdend, stil, weer };
});
ok(pauze.rijdend.motor > 0.01, 'de motor loopt als je rijdt', `motor ${pauze.rijdend.motor}`);
ok(pauze.stil.hoofd < 0.02, 'en in de pauze staat alles dicht', `hoofdvolume ${pauze.stil.hoofd}`);
ok(pauze.weer.hoofd > 0.3, 'en na de pauze weer open', `hoofdvolume ${pauze.weer.hoofd}`);

kop('de sirene stopt zodra je naar binnen gaat');
const sir = await page.evaluate(async () => {
  const g = window.__game;
  g.geluid.sirene(10);                       // een wagen vlakbij
  await new Promise(r => setTimeout(r, 500));
  const buiten = g.geluid.stand().sirene;
  g.geluid.sirene(null);                     // dit doet js/main.js als je binnen staat
  await new Promise(r => setTimeout(r, 700));
  return { buiten, binnen: g.geluid.stand().sirene };
});
ok(sir.buiten > 0.02, 'buiten hoor je hem', `${sir.buiten}`);
ok(sir.binnen < 0.005, 'binnen niet meer', `${sir.binnen}`);

kop('de muziek komt boven de motor uit');
const balans = await page.evaluate(async () => {
  // De luidste stand van de motor: vol toerental in de hoogste versnelling. Het
  // volume loopt met een tijdconstante, dus er moet even op gewacht worden —
  // meteen uitlezen geeft nul en dan toetst de proef zichzelf.
  const g = window.__game;
  g.geluid.motorAan();
  for (let i = 0; i < 12; i++) { g.geluid.motorToeren(24, 24); await new Promise(r => setTimeout(r, 60)); }
  const motorMax = g.geluid.stand().motor;
  g.geluid.motorUit();
  return { motorMax };
});
ok(balans.motorMax != null && balans.motorMax < 0.08,
  'de motor gaat niet boven 0,08 uit', `${balans.motorMax}`);

kop('remsporen komen en gaan');
const sporen = await page.evaluate(async () => {
  const g = window.__game;
  const voor = g.sporen();
  // twintig stukjes spoor neerleggen zoals een slippende auto dat doet
  for (let i = 0; i < 20; i++) g.vehicles.spoor(100 + i, 100, 0.4, 0.24, 0.8, 0.9);
  const na = g.sporen();
  return { voor, na };
});
ok(sporen.na >= 20, 'er komen sporen bij als je slipt', `${sporen.voor} → ${sporen.na}`);
const weg = await page.evaluate(async () => {
  const { werkSporenBij, sporenTeller } = await import('/js/sporen.js');
  for (let i = 0; i < 160; i++) werkSporenBij(0.1);      // zestien seconden
  return sporenTeller();
});
ok(weg === 0, 'en ze zijn na veertien seconden weer weg', `${weg} over`);

kop('de camera schudt van een klap en komt weer tot rust');
const schok = await page.evaluate(async () => {
  const g = window.__game;
  const cam = g.camera;
  const y0 = cam.position.y;
  g.schok(1);
  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => requestAnimationFrame(r));
  let grootste = 0;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => requestAnimationFrame(r));
    grootste = Math.max(grootste, Math.abs(cam.position.y - y0));
  }
  await new Promise(r => setTimeout(r, 1400));
  const rust = Math.abs(cam.position.y - y0);
  return { grootste, rust };
});
ok(schok.grootste > 0.01, 'een klap beweegt het beeld', `${schok.grootste.toFixed(3)} m uitslag`);
ok(schok.rust < 0.01, 'en na anderhalve seconde staat het weer stil', `${schok.rust.toFixed(4)} m`);

kop('een wrak wordt opgeruimd');
const wrak = await page.evaluate(() => {
  const g = window.__game;
  const car = g.vehicles.cars.find(c => c.driveable && !c.wrak && c.inst);
  if (!car) return null;
  const plek = { x: car.x, z: car.z };
  g.vehicles.laatOntploffen(car);
  const na = { wrak: car.wrak, rijdbaar: car.driveable };
  car.wrakT = 61;                                   // een minuut verder
  g.vehicles.werkKnallenBij(0.016, car.x + 500, car.z);   // en de speler ver weg
  return { na, terug: { wrak: car.wrak, rijdbaar: car.driveable, hp: car.hp },
    verplaatst: Math.hypot(car.x - plek.x, car.z - plek.z) };
});
ok(wrak && wrak.na.wrak && !wrak.na.rijdbaar, 'een opgeblazen auto is een wrak en rijdt niet meer');
ok(wrak && !wrak.terug.wrak && wrak.terug.rijdbaar && wrak.terug.hp === 100,
  'en is later weer een gewone auto', wrak ? `hp ${wrak.terug.hp}` : '');
ok(wrak && wrak.verplaatst < 0.5, 'op zijn eigen parkeerplek',
  wrak ? `${wrak.verplaatst.toFixed(2)} m ernaast` : '');

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);

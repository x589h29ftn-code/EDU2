/*
 Toetst de punten uit de beta-test die over de wereld en de auto gaan.

 Wat er mis kan gaan, en dus wat hier nagerekend wordt:
 1. 's avonds zakte het spel in. Dat komt van de straatlampen: elke puntlamp telt
    mee in de belichting van élk materiaal. Er mogen er dus niet te veel zijn;
 2. uit de auto schieten moet kunnen naar voren en opzij, maar niet naar
    achteren — je hangt uit het raam, niet over de achterbank;
 3. de koplampen en achterlichten staken vijf centimeter vóór het plaatwerk uit
    en zweefden van schuin voren als een los blokje naast de neus;
 4. een lantaarnpaal moet omver te rijden zijn, met zijn botsdoos mee omlaag, en
    later weer overeind komen — anders is de wijk na een half uur kaal;
 5. de wegafsluiting moet je tegenhouden, ook als je er via de berm omheen wilt;
 6. het tankstation had een verhoogd betonnen platform op het pompplein: het
    BGT-bouwwerk van de luifel lag er ook nog als vlak.

 Gebruik: python3 -m http.server 8123 &  node tools/betatest.mjs 8123
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
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  window.__game.player.active = true;
});

kop('de avond kost niet de halve snelheid meer');
const licht = await page.evaluate(async () => {
  const g = window.__game;
  const THREE = await import('three');
  g.sfeer.uur = 23;
  // de lampen worden op een eigen klokje van 0,4 s gezet; even doortikken
  for (let i = 0; i < 4; i++) g.sfeer.update(0.5, g.camera.position.x, g.camera.position.z);
  await new Promise(r => setTimeout(r, 400));
  let punt = 0, zicht = 0;
  g.scene.traverse(o => { if (o.isPointLight) { punt++; if (o.visible && o.intensity > 0) zicht++; } });
  g.sfeer.uur = 12;
  for (let i = 0; i < 4; i++) g.sfeer.update(0.5, g.camera.position.x, g.camera.position.z);
  await new Promise(r => setTimeout(r, 400));
  let overdag = 0;
  g.scene.traverse(o => { if (o.isPointLight && o.visible && o.intensity > 0) overdag++; });
  return { punt, zicht, overdag };
});
ok(licht.punt <= 4, 'er staan hoogstens vier straatlampen in de pool', `${licht.punt} lampen`);
ok(licht.zicht > 0, 'en die branden ook echt \'s nachts', `${licht.zicht} aan`);
ok(licht.overdag === 0, 'overdag staan ze allemaal uit', `${licht.overdag} aan`);

kop('uit de auto schieten: naar voren en opzij, niet naar achteren');
const schiet = await page.evaluate(async () => {
  const g = window.__game;
  const car = g.vehicles.cars.find(c => c.driveable && !c.wrak);
  g.player.pos.set(car.x + 1.4, 0, car.z);
  g.toggleCar();
  const inCar = !!g.player.inCar;
  const proef = (graden) => {
    g.player.yaw = car.yaw + graden * Math.PI / 180;
    return g.player.magSchieten();
  };
  const uit = { inCar, recht: proef(0), schuin: proef(60), dwars: proef(95), achter: proef(180), bijna: proef(160) };
  g.player.yaw = car.yaw;
  g.toggleCar();
  return uit;
});
ok(schiet.inCar, 'je zit in de auto');
ok(schiet.recht && schiet.schuin && schiet.dwars, 'naar voren en opzij kun je schieten');
ok(!schiet.achter && !schiet.bijna, 'recht naar achteren niet');

kop('de lampen zitten in het plaatwerk');
const lamp = await page.evaluate(async () => {
  const { autoOnderdelen } = await import('/js/carmodel.js');
  const uit = {};
  for (const soort of ['hatch', 'van', 'truck']) {
    const A = autoOnderdelen(soort);
    /*
     Waar houdt de auto op? Dat is het plaatwerk plus de bumpers: de
     kentekenplaat hóórt op de bumper te zitten en steekt dus voorbij de lak uit.
     Meten tegen de lak alleen zou die plaat als fout aanwijzen.
    */
    let vz = Infinity, az = -Infinity;
    for (const d of A.dozen) {
      if (d.groep !== 'lak' && d.groep !== 'zwart') continue;
      vz = Math.min(vz, d.z - d.d / 2);
      az = Math.max(az, d.z + d.d / 2);
    }
    let voor = 0, achter = 0;
    for (const d of A.dozen) {
      if (d.groep !== 'licht') continue;
      voor = Math.max(voor, vz - (d.z - d.d / 2));       // hoever steekt hij vóór het plaatwerk uit
      achter = Math.max(achter, (d.z + d.d / 2) - az);
    }
    uit[soort] = { voor: +voor.toFixed(3), achter: +achter.toFixed(3) };
  }
  return uit;
});
for (const soort of ['hatch', 'van']) {
  ok(lamp[soort].voor <= 0.03, `${soort}: de koplamp steekt hoogstens drie centimeter uit`,
    `${(lamp[soort].voor * 100).toFixed(1)} cm`);
  ok(lamp[soort].achter <= 0.03, `${soort}: en het achterlicht ook`,
    `${(lamp[soort].achter * 100).toFixed(1)} cm`);
}

kop('een lantaarnpaal gaat om en komt terug');
const paal = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  const W = await import('/js/world.js');
  const l = KAART.lantaarns[0];
  const staand = W.resolveCollisions(l.x, l.z, 0.9);
  const voorHoog = Math.hypot(staand[0] - l.x, staand[1] - l.z);
  // te zacht: er gebeurt niets
  const zacht = g.raakLantaarn(l.x, l.z, 0, 2);
  const hard = g.raakLantaarn(l.x, l.z, 0, 14);
  for (let i = 0; i < 80; i++) g.werkLantaarnsBij(0.05, l.x, l.z);   // vier seconden vallen
  const gevallen = g.lantaarnsOm();
  /*
   Een auto negeert botsdozen die lager zijn dan 3,5 m (`ignoreLowH`) — daarmee
   rijdt hij over een stoeprand en onder een luifel door. De omgevallen paal
   zakt naar 0,35 m en valt daar dus onder. Te voet loop je er nog wel tegenaan,
   en dat hoort ook: een paal op straat stap je omheen.
  */
  const na = W.resolveCollisions(l.x, l.z, 0.9, 3.5, 0);
  const naHoog = Math.hypot(na[0] - l.x, na[1] - l.z);
  const teVoet = W.resolveCollisions(l.x, l.z, 0.9);
  const teVoetHoog = Math.hypot(teVoet[0] - l.x, teVoet[1] - l.z);
  // en later, ver weg, weer overeind
  for (let i = 0; i < 60; i++) g.werkLantaarnsBij(1.0, l.x + 400, l.z);
  return { voorHoog: +voorHoog.toFixed(2), zacht, hard, gevallen, naHoog: +naHoog.toFixed(2), teVoetHoog: +teVoetHoog.toFixed(2), terug: g.lantaarnsOm() };
});
ok(paal.voorHoog > 0.3, 'rechtop houdt de paal je tegen', `${paal.voorHoog} m weggeduwd`);
ok(!paal.zacht, 'stapvoets rijd je hem niet om');
ok(paal.hard && paal.gevallen === 1, 'met vaart wel', `${paal.gevallen} om`);
ok(paal.naHoog < 0.05, 'en dan rijd je er met de auto overheen', `${paal.naHoog} m`);
ok(paal.teVoetHoog > 0.2, 'maar te voet stap je er nog omheen', `${paal.teVoetHoog} m`);
ok(paal.terug === 0, 'later staat hij weer overeind', `${paal.terug} nog om`);

kop('de wegafsluiting houdt je tegen');
const dicht = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const W = await import('/js/world.js');
  const A = (KAART.wegafsluitingen || [])[0];
  if (!A) return null;
  const duw = (x, z) => { const [nx, nz] = W.resolveCollisions(x, z, 0.9); return +Math.hypot(nx - x, nz - z).toFixed(2); };
  const bx = -A.as[1], bz = A.as[0];     // dwars op de weg
  return {
    straat: A.straat, muur: A.muur,
    opDeWeg: duw(A.x, A.z),
    inDeBerm: duw(A.x + bx * 12, A.z + bz * 12),
    verErnaast: duw(A.x + bx * (A.muur / 2 + 6), A.z + bz * (A.muur / 2 + 6)),
    erachter: duw(A.x - A.as[0] * 12, A.z - A.as[1] * 12),
  };
});
ok(!!dicht, 'er staat een afsluiting in de kaart', dicht ? `${dicht.straat}, muur ${dicht.muur} m` : '');
ok(dicht && dicht.opDeWeg > 0.4, 'op de weg kom je er niet langs', dicht ? `${dicht.opDeWeg} m weggeduwd` : '');
ok(dicht && dicht.inDeBerm > 0.4, 'en via de berm ook niet', dicht ? `${dicht.inDeBerm} m weggeduwd` : '');
ok(dicht && dicht.erachter < 0.05, 'twaalf meter ervandaan sta je vrij', dicht ? `${dicht.erachter} m` : '');

kop('het tankstation heeft geen verhoogd platform meer');
const tank = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const T = (KAART.tankstations || [])[0];
  // ligt er nog een bouwwerk-vlak onder de luifel?
  let onder = 0;
  for (const v of KAART.vlakken) {
    if (v.k !== 'bouwwerk') continue;
    const r = v.r[0];
    let cx = 0, cz = 0; for (const q of r) { cx += q[0]; cz += q[1]; }
    cx /= r.length; cz /= r.length;
    if (Math.hypot(cx - T.cx, cz - T.cz) < 8) onder++;
  }
  return { onder, hoogte: T.hoogte };
});
ok(tank.onder === 0, 'het BGT-bouwwerk van de luifel ligt niet meer als vlak op het plein',
  `${tank.onder} gevonden`);

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);

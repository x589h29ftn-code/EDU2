/*
 Erfscheidingen kapotrijden.

   npm run server &   node tools/breektest.mjs [poort]

 Sinds heggen en schuttingen botsdozen hebben houden ze je tegen en breken ze de
 kijklijn. Auto's negeren alles onder de 3,5 meter en reden er dus nog dwars
 doorheen alsof er niets stond. Dat hoort ook niet andersom te worden opgelost —
 een schutting van achttien millimeter plank is geen muur — dus hij breekt.

 Wat hier getoetst wordt:
 1. elke erfscheiding weet welk stukje tekening van hem is (anders valt er niets
    om te klappen);
 2. vóór de klap houdt hij je tegen en breekt hij de kijklijn;
 3. rijd je erdoorheen, dan gaat hij om: de doos is weg, de hoekpunten liggen
    plat, en je loopt en kijkt er voortaan overheen;
 4. stilstaand sloop je niets — anders breek je een tuin af door ertegenaan te
    leunen;
 5. het kost vaart.
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
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const g = window.__game;
  g.player.active = true;
  window.__W = W;
  /*
   De schuttingen uit de kaart terugvinden tussen de tweeëntachtigduizend
   botsdozen: dat zijn precies de dozen met een `breek`-koppeling. We nemen er
   een die lang genoeg is om er met een auto niet naast te rijden, en waar geen
   andere hoge doos vlak naast staat — anders meet je een botsing tegen een huis.
  */
  window.__kies = (minH, aantal = 1) => {
    const uit = [];
    for (const c of W.colliders) {
      if (!c.breek || c.h < minH || c.hx < 2.5) continue;
      // vrij veld: binnen zes meter van het midden staat niets anders hoogs
      let vrij = true;
      for (const o of W.colliders) {
        if (o === c || o.h < 2 || o.breek) continue;
        if (Math.abs(o.cx - c.cx) < 6 + o.hx && Math.abs(o.cz - c.cz) < 6 + o.hz) { vrij = false; break; }
      }
      if (vrij) uit.push(c);
      if (uit.length >= aantal) break;
    }
    return uit;
  };
  // de normaal op een scheiding, in wereldcoördinaten
  window.__normaal = (c) => {
    const b = c.breek;
    let nx = -(b.bz - b.az), nz = b.bx - b.ax;
    const L = Math.hypot(nx, nz) || 1;
    return [nx / L, nz / L];
  };
  window.__hoogsteY = (c) => {
    const b = c.breek, a = b.doel.attr;
    if (!a) return null;
    let m = -Infinity;
    for (let i = b.van; i < b.tot; i += 3) m = Math.max(m, a.array[i + 1]);
    return m;
  };
});

// ---------- 1. de koppeling tussen doos en tekening ----------
console.log('\nelke erfscheiding kent zijn eigen tekening');
const tel = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const W = window.__W;
  const met = W.colliders.filter(c => c.breek);
  const uitKaart = (KAART.heggen || []).length + (KAART.schuttingen || []).length;
  return {
    dozen: met.length,
    uitKaart,
    metDoek: met.filter(c => c.breek.doel && c.breek.doel.attr).length,
    metBereik: met.filter(c => c.breek.tot > c.breek.van).length,
  };
});
ok('er zijn breekbare erfscheidingen', tel.dozen > 20000, `${tel.dozen}`);
ok('en dat zijn er ongeveer zoveel als er in de kaart staan',
  Math.abs(tel.dozen - tel.uitKaart) < tel.uitKaart * 0.05, `${tel.dozen} van ${tel.uitKaart}`);
ok('ze hebben allemaal een doek om uit te tekenen', tel.metDoek === tel.dozen, `${tel.metDoek}`);
ok('en een bereik van hoekpunten', tel.metBereik === tel.dozen, `${tel.metBereik}`);

// ---------- 2 en 3. erdoorheen rijden ----------
console.log('\nmet de auto erdoorheen');
const rit = await page.evaluate(() => {
  const g = window.__game, W = window.__W;
  const c = window.__kies(1.5)[0];
  if (!c) return { gevonden: false };
  const [nx, nz] = window.__normaal(c);

  // vóór de klap: houdt hij je tegen, en breekt hij de kijklijn?
  const proef = (x, z) => {
    const [rx, rz] = W.resolveCollisions(x, z, 0.35, 0);
    return Math.hypot(rx - x, rz - z) > 0.001;
  };
  const voorKlem = proef(c.cx, c.cz);
  const voorZicht = W.zichtVrij(c.cx - nx * 4, c.cz - nz * 4, c.cx + nx * 4, c.cz + nz * 4);
  const voorHoog = window.__hoogsteY(c);

  /*
   De auto vier meter voor de schutting, neus erop. Rijrichting is
   (−sin yaw, −cos yaw), dus de yaw die naar (nx, nz) wijst is atan2(−nx, −nz).
  */
  // een auto met een model: de meeste staan als instantie in de wereld en hebben
  // er pas een zodra je erin stapt, en `drive` rekent met dat model
  const car = g.vehicles.cars[0];
  g.vehicles.maakBestuurbaar(car);
  const yaw = Math.atan2(-nx, -nz);
  car.x = c.cx - nx * 4; car.z = c.cz - nz * 4;
  car.yaw = yaw; car.rij = yaw; car.steer = 0;
  car.speed = 9; car.brakKracht = 0;
  if (car.mesh) car.mesh.position.set(car.x, car.mesh.position.y, car.z);
  let kracht = 0, stappen = 0;
  for (let i = 0; i < 40 && c.h > 0; i++) {
    g.vehicles.drive(car, { KeyW: true }, 1 / 60);
    if (car.brakKracht) { kracht = Math.max(kracht, car.brakKracht); car.brakKracht = 0; }
    stappen++;
  }

  return {
    gevonden: true,
    voorKlem, voorZicht, voorHoog,
    hoogte: c.h,
    stappen, kracht,
    naKlem: proef(c.cx, c.cz),
    naZicht: W.zichtVrij(c.cx - nx * 4, c.cz - nz * 4, c.cx + nx * 4, c.cz + nz * 4),
    naHoog: window.__hoogsteY(c),
    y0: c.breek.y0,
    snelheid: car.speed,
  };
});
ok('er is een vrijstaande schutting om op te meten', rit.gevonden);
ok('vóór de klap loop je er niet doorheen', rit.voorKlem);
ok('en kijk je er niet doorheen', rit.voorZicht === false);
ok('hij stond overeind', rit.voorHoog > rit.y0 + 1.4, `${(rit.voorHoog - rit.y0).toFixed(2)} m`);
ok('de auto rijdt hem om', rit.hoogte === 0, `${rit.stappen} beelden, hoogte ${rit.hoogte}`);
ok('daarna loop je er doorheen', rit.naKlem === false);
ok('en kijk je er overheen', rit.naZicht === true);
ok('en de tekening ligt plat', rit.naHoog !== null && rit.naHoog - rit.y0 < 0.1,
  `${rit.naHoog === null ? '?' : (rit.naHoog - rit.y0).toFixed(3)} m`);
ok('het kost vaart', rit.snelheid < 9, `${rit.snelheid.toFixed(2)} m/s`);
ok('en het geeft een tik', rit.kracht > 0, `${rit.kracht}`);

// ---------- 4. stilstaand sloop je niets ----------
console.log('\nstilstaand gebeurt er niets');
const stil = await page.evaluate(() => {
  const g = window.__game;
  const c = window.__kies(1.5, 40).find(x => x.h > 0);
  if (!c) return { gevonden: false };
  const car = g.vehicles.cars[0];
  g.vehicles.maakBestuurbaar(car);
  car.x = c.cx; car.z = c.cz; car.speed = 0; car.rij = car.yaw; car.steer = 0;
  if (car.mesh) car.mesh.position.set(car.x, car.mesh.position.y, car.z);
  for (let i = 0; i < 30; i++) g.vehicles.drive(car, {}, 1 / 60);
  return { gevonden: true, hoogte: c.h };
});
ok('een stilstaande auto laat de schutting staan', stil.gevonden && stil.hoogte > 0, JSON.stringify(stil));

console.log(`\nfouten in de pagina: ${fouten.length ? fouten.join(' | ') : 'geen'}`);
if (fouten.length) fout++;
console.log(`\n${goed} goed, ${fout} fout`);
await browser.close();
process.exit(fout ? 1 : 0);

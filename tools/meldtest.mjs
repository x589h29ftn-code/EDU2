/*
 Toetst de vijf punten van 14 september 2026 (tweede ronde):

 1. Het schap bij Tinga State blijft niet in beeld staan als je op Esc drukt.
 2. Ziet één agent je, dan gaat dat over de portofoon en komen de anderen er
    rennend op af in plaats van hun eigen rondje af te lopen.
 3. Schiet je terwijl je gezocht wordt: staat er een getuige bij, dan weten ze
    waar je bent; is er niemand, dan geef je je plek niet weg.
 4. Een kogelinslag laat niets achter dat blijft hangen.
 5. Het herladen is een echte beweging: het magazijn valt eruit, een linkerhand
    brengt een nieuw magazijn en duwt het erin.

 Gebruik: npm run server &  node tools/meldtest.mjs 8123
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
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const p = window.__game.player;
  p.active = true;
  // waar het spel begint; de proeven verslepen de speler en zetten hem hiermee terug
  window.__start = { x: p.pos.x, y: p.pos.y, z: p.pos.z };
});

// ---------- 1. het schap verdwijnt met het spel ----------
kop('het schap aan de toonbank');
const schap = await page.evaluate(async () => {
  const g = window.__game, b = g.boerderij;
  const zichtbaar = () => !document.getElementById('schap').hidden;
  g.player.pos.set(b.plekken.toonbank.x, 0, b.plekken.toonbank.z);
  b.update(0.1, false);
  const aan = zichtbaar();
  b.toets('1');                           // iets kopen verandert daar niets aan
  b.update(0.1, false);
  const naKoop = zichtbaar();
  g.pauzeer();                            // Esc: de hoofdlus staat stil
  await new Promise(res => setTimeout(res, 400));
  const naPauze = zichtbaar();
  // en weer verder: wie nog aan de toonbank staat ziet hem meteen terug
  g.player.active = true;
  b.update(0.1, false);
  const naHervat = zichtbaar();
  g.player.pos.set(b.plekken.deurBuiten.x + 40, 0, b.plekken.deurBuiten.z + 40);
  b.update(0.1, false);
  return { aan, naKoop, naPauze, naHervat, weg: !zichtbaar() };
});
ok(schap.aan && schap.naKoop, 'aan de toonbank staat het schap in beeld, ook na een aankoop');
ok(schap.naPauze === false, 'druk je op Esc, dan gaat het weg — het bleef er anders staan');
ok(schap.naHervat === true, 'en het komt terug zodra je verdergaat');
ok(schap.weg === true, 'loop je weg, dan verdwijnt het');

// ---------- 2. de portofoon ----------
kop('één agent ziet je, de rest hoort het');
const radio = await page.evaluate(async () => {
  const g = window.__game, P = g.politie;
  const loop = (n, dt = 0.1) => { for (let i = 0; i < n; i++) P.update(dt); };
  P.reset();
  P.zetHeat(300);
  loop(300);                                // de eenheden druppelen binnen; geef ze de tijd
  /*
   Ook wie nog in de auto zit telt mee: die stapt normaal pas uit als je
   dichtbij komt, en het gaat hier om wat de portofoon met ze doet.
  */
  const A = P.intern.agenten.filter(a => a.staat !== 'neer');
  for (const a of A) a.persoon.groep.visible = true;
  if (A.length < 3) return { er: false, n: A.length };
  /*
   Iedereen ver weg zetten en aan het zoeken, behalve één die vlak naast de
   speler komt te staan en je dus ziet. Zonder portofoon blijven de anderen
   rustig hun sector aflopen.
  */
  const sp = g.player.pos;
  A.forEach((a, i) => {
    a.persoon.zetNeer(sp.x + 120 + i * 9, sp.z + 120, 0);
    a.staat = 'zoekt'; a.route = null; a.zicht = false; a.kijkT = 1;
    a.doel = { x: sp.x + 180, z: sp.z + 180 };
  });
  const kijker = A[0];
  kijker.persoon.zetNeer(sp.x + 6, sp.z, Math.PI);
  kijker.kijkT = 0;
  const voor = A.slice(1).map(a => a.staat);
  loop(30);                                 // drie seconden: zien, melden, uitdelen
  const na = A.slice(1).map(a => a.staat);
  const naarSpeler = A.slice(1).filter(a => a.doel
    && Math.hypot(a.doel.x - sp.x, a.doel.z - sp.z) < 25).length;
  const jaagt = kijker.staat;
  P.reset();
  return { er: true, n: A.length, voor, na, naarSpeler, jaagt };
});
ok(radio.er, 'er lopen genoeg agenten rond om het te kunnen meten', `${radio.n} agenten`);
if (!radio.er) { console.log('\n(de rest van dit hoofdstuk is overgeslagen)'); }
ok(radio.er && radio.jaagt === 'jacht', 'de agent die je ziet zet de achtervolging in', radio.jaagt);
ok(radio.er && radio.na.every(s => s === 'naarPlek'),
  'en de rest gaat ervandoor naar de melding in plaats van door te zoeken',
  radio.er ? `${radio.voor.join(', ')} → ${radio.na.join(', ')}` : '');
ok(radio.er && radio.naarSpeler === radio.na.length,
  'allemaal naar de plek waar hij gezien is',
  radio.er ? `${radio.naarSpeler} van ${radio.na.length}` : '');

// ---------- 3. schieten met en zonder getuige ----------
kop('schieten tijdens een achtervolging');
const getuige = await page.evaluate(async () => {
  const g = window.__game, P = g.politie;
  const loop = (n, dt = 0.1) => { for (let i = 0; i < n; i++) P.update(dt); };
  const sp = g.player.pos;

  // iedereen een eind verderop: geen voetganger, geen agent binnen gehoorafstand
  P.reset();
  const mensen = g.npcs.people.filter(p => p.alive);
  const bewaar = mensen.map(p => ({ p, x: p.x, z: p.z }));
  for (const m of mensen) { m.x = sp.x + 800; m.z = sp.z + 800; }
  P.zetHeat(200);
  loop(10);
  for (const a of P.intern.agenten) a.persoon.zetNeer(sp.x + 600, sp.z + 600, 0);
  for (const w of P.intern.wagens) { w.car.x = sp.x + 600; w.car.z = sp.z + 600; }

  /*
   Dertig keer schieten zonder dat er iemand bij is. Vroeger werd elk schot
   gemeld zodra je gezocht werd — dertig van de dertig — en verschoof je plek
   dus elke keer naar jou. Nu is het een kleine kans dat iemand achter een raam
   het toch hoort.
  */
  let alleen = 0;
  for (let k = 0; k < 30; k++) { P.zetHeat(200); if (P.misdaad('schot', sp.x, sp.z)) alleen++; }

  // en nu mét een voetganger op zes meter, met vrij zicht
  const m = mensen[0];
  m.x = sp.x + 6; m.z = sp.z + 2;
  let metGetuige = 0;
  for (let k = 0; k < 10; k++) { P.zetHeat(200); if (P.misdaad('schot', sp.x, sp.z)) metGetuige++; }
  const bekend = P.intern.laatstBekend
    ? Math.hypot(P.intern.laatstBekend.x - sp.x, P.intern.laatstBekend.z - sp.z) : -1;

  for (const b of bewaar) { b.p.x = b.x; b.p.z = b.z; }
  P.reset();
  return { alleen, metGetuige, bekend };
});
ok(getuige.metGetuige === 10,
  'met een voetganger ernaast wordt elk schot gemeld', `${getuige.metGetuige} van 10`);
ok(getuige.bekend >= 0 && getuige.bekend < 2,
  'en dan staat de laatst bekende plek precies op jou',
  `${getuige.bekend.toFixed(1)} m ernaast`);
ok(getuige.alleen < 15,
  'schiet je zonder dat iemand het ziet, dan geef je je plek meestal níét weg',
  `${getuige.alleen} van 30 gemeld (was 30 van 30)`);

// ---------- 4. de inslag laat niets liggen ----------
kop('waar de kogel aankomt');
const inslag = await page.evaluate(async () => {
  const g = window.__game, P = g.politie;
  const THREE = await import('three');
  // zwarte bolletjes van vier centimeter: die hingen hier vroeger in de lucht
  const telBol = () => {
    let n = 0;
    g.scene.traverse(o => {
      if (o.isMesh && o.geometry && o.geometry.type === 'SphereGeometry'
        && o.material && o.material.color && o.material.color.getHex() === 0x222222) n++;
    });
    return n;
  };
  const voor = telBol();
  /*
   Op een agent schieten. Die staat als een echte groep in de scene en je kunt
   hem met `zetNeer` op de centimeter neerzetten, dus de straal raakt hem
   gegarandeerd — bij het verkeer en de voetgangers zit alles in instanced
   meshes en is dat veel lastiger te sturen.
  */
  // terug naar de startplek: daar staan we op vlakke grond midden op straat
  g.player.pos.set(window.__start.x, window.__start.y, window.__start.z);
  P.reset(); P.zetHeat(300);
  for (let i = 0; i < 200; i++) P.update(0.1);
  const a = P.intern.agenten.find(x => x.staat !== 'neer');
  if (!a) return { geenDoel: true };
  const sp = g.player.pos;
  a.persoon.groep.visible = true;
  a.persoon.zetNeer(sp.x, sp.z - 5, 0);
  // het poppetje één beeld laten bijwerken, anders staan zijn ledematen nog
  // niet op hun plek en raakt de straal niets
  a.persoon.update(0.05, { loopt: false, mikt: false, snelheid: 0 });
  a.persoon.groep.traverse(o => { o.visible = true; });
  /*
   En de matrices bijwerken. In het spel gebeurt dat elk beeld bij het
   renderen; hier verplaatsen we iemand en schieten we in dezelfde tel, en dan
   staat hij voor de straal nog op zijn oude plek.
  */
  g.scene.updateMatrixWorld(true);
  g.player.yaw = 0; g.player.pitch = -0.06;      // recht vooruit, iets omlaag
  g.player.applyCamera();
  g.player.wapenUit = false; g.player.reloading = 0; g.player.wisselT = 0;
  g.player.reserve = 500;
  const dirVoor = new THREE.Vector3(); g.camera.getWorldDirection(dirVoor);
  const rcVoor = new THREE.Raycaster(g.camera.getWorldPosition(new THREE.Vector3()), dirVoor);
  rcVoor.far = 120;
  // staat het doelwit werkelijk in de baan van de kogel?
  const hitsVoor = rcVoor.intersectObjects(g.politie.doelen(), true).length;
  for (let i = 0; i < 6; i++) { g.player.ammo = 12; g.player.vuurKlok = 0; g.player.shoot(); }
  const meteen = g.__inslagen();
  const bloedNu = g.__bloed();
  const zwart = telBol();
  /*
   De wolkjes lopen mee met de hoofdlus, niet met de klok van de computer: op de
   softwarerenderer draait het spel op een beeld per seconde, en dan is een
   kwart seconde spéltijd pas na een paar beelden om. Dus wachten we op beelden
   en niet op een `setTimeout`.
  */
  for (let k = 0; k < 90 && g.__inslagen() > 0; k++) {
    await new Promise(res => requestAnimationFrame(res));
  }
  const later = g.__inslagen();
  P.reset();
  return { voor, zwart, meteen, bloedNu, later, hitsVoor };
});
ok(!inslag.geenDoel, 'er staat iets om op te schieten');
ok(inslag.zwart === 0 && inslag.voor === 0,
  'er blijven geen zwarte bolletjes in de lucht hangen', `${inslag.zwart} gevonden`);
ok(inslag.hitsVoor > 0, 'de agent staat in de baan van de kogel', `${inslag.hitsVoor} raakvlakken`);
/*
 Op een mens komt er sinds 20 september bloed in plaats van stof: het grijze
 wolkje legde zich over de rode spat heen en maakte er een bleke vlek van, dus
 er komt nu één ding per treffer. Hier wordt op een agent geschoten, en dus
 hoort er bloed te staan en géén stof.
*/
ok(inslag.bloedNu > 0, 'je ziet bloed op de plek van de treffer', `${inslag.bloedNu} spatten in beeld`);
ok(inslag.meteen === 0, 'en geen stofwolkje erbovenop', `${inslag.meteen} wolkjes`);
ok(inslag.later === 0, 'en dat is een fractie later weer weg — er blijft niets liggen', `${inslag.later} over`);

// ---------- 5. de herlaadbeweging ----------
kop('het magazijn eruit en een nieuwe erin');
const herlaad = await page.evaluate(() => {
  const g = window.__game, p = g.player;
  p.zetWapen('pistool'); p.wisselT = 0; p.holster = 0;
  p.reserve = 200; p.ammo = 0;
  for (let i = 0; i < 30; i++) p.update(0.02);
  p.reload();
  const rij = [];
  for (let i = 0; i < 110; i++) {
    p.update(0.02);
    const d = p.wapen.delen;
    rij.push({
      magY: d.magazijn.position.y, magZien: d.magazijn.visible, magDraai: d.magazijn.rotation.z,
      nieuwZien: d.nieuwMag.visible, nieuwY: d.nieuwMag.position.y,
      handZien: d.linkerhand.visible, handY: d.linkerhand.position.y,
      groepY: p.gun.position.y,
    });
  }
  const rust = p.wapen.houding.rust;
  return {
    omhoog: Math.max(...rij.map(r => r.groepY)),
    rustY: rust.y,
    magDiepst: Math.min(...rij.map(r => r.magY)),
    magTuimelt: Math.max(...rij.map(r => Math.abs(r.magDraai))),
    handBeelden: rij.filter(r => r.handZien).length,
    handOmhoog: (() => {
      const h = rij.filter(r => r.handZien).map(r => r.handY);
      return h.length ? Math.max(...h) - Math.min(...h) : 0;
    })(),
    nieuwBeelden: rij.filter(r => r.nieuwZien).length,
    eind: rij[rij.length - 1],
    ammo: p.ammo,
  };
});
ok(herlaad.omhoog > herlaad.rustY + 0.06,
  'het wapen komt omhoog, zodat de hele beweging in beeld valt',
  `van ${herlaad.rustY.toFixed(3)} naar ${herlaad.omhoog.toFixed(3)} m`);
ok(herlaad.magDiepst < -0.4, 'het lege magazijn valt er echt uit en weg',
  `${herlaad.magDiepst.toFixed(2)} m gezakt`);
ok(herlaad.magTuimelt > 0.4, 'en tuimelt daarbij, zoals iets dat valt',
  `${herlaad.magTuimelt.toFixed(2)} rad gedraaid`);
ok(herlaad.handBeelden > 15, 'een linkerhand komt met een nieuw magazijn in beeld',
  `${herlaad.handBeelden} beelden lang`);
ok(herlaad.handOmhoog > 0.2, 'en duwt het omhoog de schacht in',
  `${herlaad.handOmhoog.toFixed(2)} m omhoog`);
ok(herlaad.nieuwBeelden > 10, 'het nieuwe magazijn is onderweg te zien',
  `${herlaad.nieuwBeelden} beelden`);
ok(!herlaad.eind.handZien && !herlaad.eind.nieuwZien && herlaad.eind.magZien
  && Math.abs(herlaad.eind.magY) < 0.01,
  'en als het klaar is zit er gewoon weer één magazijn in, zonder hand erbij');
ok(herlaad.ammo === 12, 'het wapen is daarna vol', `${herlaad.ammo} kogels`);

console.log(`\n${fouten === 0 ? 'alles goed.' : `${fouten} fout(en).`}`);
await browser.close();
process.exit(fouten ? 1 : 0);

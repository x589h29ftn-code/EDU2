/*
 Foto's van de politie-inzet: hoeveel eenheden er bij vijf sterren uitrukken en
 hoe ver ze over de wijk uitwaaieren.

   politie.png        straatbeeld met een surveillanceauto en agenten, de
                      sterren rechtsboven en de blauwe stipjes op de minikaart
   politie_zoekt.png  de grote kaart: de eenheden zoeken niet op één kluitje
                      maar in een ring rond de laatst bekende plek
   politie_leeg.png   een surveillanceauto waar de agenten uit gestapt zijn:
                      hij blijft staan met zijn zwaailicht aan en is te stelen
   politie_blokkade.png  twee wagens dwars over de rijbaan, vanaf vier sterren
                      neergezet buiten je zicht
   politie_wrak.png   een surveillanceauto die na tien kogels is opgeblazen:
                      zwartgeblakerd, met de rook er nog boven

 Gebruik: python3 -m http.server 8123 &  node tools/politieshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });

// ---------- opzet: speler op een recht stuk Molenkrite, vijf sterren ----------
await page.evaluate(async () => {
  const { KAART } = await import('./js/kaart.js');
  const W = await import('./js/world.js');
  window.__zichtVrij = W.zichtVrij;
  // staat dit punt vrij, of zit het in een muur, een heg of een schutting?
  window.__vrijeGrond = (x, z) => {
    const [nx, nz] = W.resolveCollisions(x, z, 0.4);
    return Math.hypot(nx - x, nz - z) < 0.05;
  };
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  /*
   Een recht stuk Molenkrite, en wel het stuk in het hart van Tinga: de as die
   het dichtst bij de nulmeter ligt (de kruising Molenkrite / Monnikmolen /
   Jasker). Dit stond op "de eerste in de lijst", maar die volgorde komt uit de
   gegenereerde kaart, en toen de wereld groter werd schoof de foto vanzelf een
   halve kilometer naar het oosten — naar een parkeerplaats bij de Stadsrondweg.
   Dezelfde correctie staat in tools/politietest.mjs.
  */
  const as = KAART.wegassen.filter(w => w.drive && w.naam === 'Molenkrite' && w.lengte > 60)
    .sort((p, q) => {
      const m = (w) => { const t = w.pts[Math.floor(w.pts.length / 2)]; return Math.hypot(t[0], t[1]); };
      return m(p) - m(q);
    })[0];
  const a = as.pts[Math.floor(as.pts.length / 2)];
  const b = as.pts[as.pts.length - 1];
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  window.__pd = { x: a[0], z: a[1], rx: (b[0] - a[0]) / l, rz: (b[1] - a[1]) / l };
  g.player.pos.set(a[0], 0, a[1]); g.player.applyCamera();
  // hoe ver is een punt van de dichtstbijzijnde rijbaanas? Daarmee kiezen we
  // voor een foto een camerapunt dat op straat ligt en niet in een voortuin of
  // dwars in een muur.
  window.__opWeg = (x, z) => {
    let d = 1e9;
    for (const as of KAART.wegassen) {
      if (!as.drive) continue;
      for (const p of as.pts) d = Math.min(d, Math.hypot(p[0] - x, p[1] - z));
    }
    return d;
  };
  // vooruitspoelen zonder te renderen: anders duurt het in swiftshader uren
  window.__spoel = (sec) => {
    const g = window.__game;
    for (let i = 0; i < Math.round(sec * 30); i++) { g.politie.update(1 / 30); g.npcs.update(1 / 30, i / 30); }
    g.hud.zetSterren(g.politie.ster, g.politie.gezocht);
    g.hud.zetPolitie(g.politie.plekken);
  };
});
await page.waitForTimeout(1200);

// vijf sterren, en de eenheden de tijd geven om uit te rukken en uit te waaieren
const inzet = await page.evaluate(() => {
  const g = window.__game;
  g.politie.zetHeat(400);
  window.__spoel(70);
  return { ster: g.politie.ster, ...g.politie.eenheden };
});
console.log(`${inzet.ster} sterren · ${inzet.wagens} wagens · ${inzet.voet + inzet.inWagen} agenten`);

// ---------- 1. straatbeeld ----------
// De eenheden zoeken rond de speler, dus voor de foto stappen we een straat
// verderop en kijken we terug: zo staan ze in beeld in plaats van tegen de lens.
await page.evaluate(() => {
  const g = window.__game, pd = window.__pd;
  const AF = 15;
  g.player.pos.set(pd.x + pd.rx * AF, 0, pd.z + pd.rz * AF);
  g.player.yaw = Math.atan2(pd.rx, pd.rz);      // terug de straat in kijken
  g.player.pitch = -0.03;
  g.player.applyCamera();
});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${map}/politie.png`, timeout: 180000 });
console.log(`${map}/politie.png`);

// ---------- 2. de grote kaart ----------
// tussen de gebouwen en de bomen door zie je van bovenaf weinig; op de kaart
// staat wél in één oogopslag hoe wijd ze uitwaaieren
const spreiding = await page.evaluate(() => {
  const g = window.__game, pd = window.__pd;
  g.hud.toggleBig();
  const ds = g.politie.plekken.map(q => Math.hypot(q.x - pd.x, q.z - pd.z));
  return { n: ds.length, dichtst: Math.min(...ds), verst: Math.max(...ds) };
});
await page.waitForTimeout(2500);
await page.screenshot({ path: `${map}/politie_zoekt.png`, timeout: 180000 });
console.log(`${map}/politie_zoekt.png`);
console.log(`${spreiding.n} eenheden op de kaart, van ${Math.round(spreiding.dichtst)} tot ${Math.round(spreiding.verst)} m van de plaats delict`);

// ---------- 3. een lege surveillanceauto ----------
const leeg = await page.evaluate(() => {
  const g = window.__game;
  // doorspoelen tot er eentje leeg staat
  let stap = 0;
  while (stap < 150 * 30 && g.politie.eenheden.verlaten === 0) { window.__spoel(2); stap += 60; }
  const v = g.politie.intern.verlaten[0];
  if (!v) return { er: false };
  if (g.hud.bigOpen) g.hud.toggleBig();
  // schuin voor de auto gaan staan, op instapafstand
  const zij = { x: Math.cos(v.car.yaw), z: -Math.sin(v.car.yaw) };
  const vooruit = { x: -Math.sin(v.car.yaw), z: -Math.cos(v.car.yaw) };
  const van = { x: v.car.x + zij.x * 1.9 + vooruit.x * 1.9, z: v.car.z + zij.z * 1.9 + vooruit.z * 1.9 };
  g.player.inCar = null;
  g.player.pos.set(van.x, 0, van.z);
  g.player.yaw = Math.atan2(-(v.car.x - van.x), -(v.car.z - van.z));
  g.player.pitch = -0.04;
  g.player.applyCamera();
  g.hud.update(0.05, g.player, g.vehicles, g.npcs, 'Molenkrite', false);
  return { er: true, hint: document.getElementById('hint').textContent };
});
if (leeg.er) {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${map}/politie_leeg.png`, timeout: 180000 });
  console.log(`${map}/politie_leeg.png — ${leeg.hint}`);
} else {
  console.log('geen lege surveillanceauto gevonden');
}

// ---------- 4. een wegblokkade ----------
// Blokkades worden juist buiten je zicht neergezet, dus voor de foto lopen we er
// naartoe: op 20 m ervoor staan is ongeveer wat je ziet als je komt
// aanrijden en op de rem gaat.
const blok = await page.evaluate(() => {
  const g = window.__game, pd = window.__pd;
  if (g.hud.bigOpen) g.hud.toggleBig();
  /*
   Een blokkade komt er alleen als de politie ziet welke kant je op gaat — sta je
   stil, dan is er geen "vóór je" en wachten ze. Dus rijd de straat uit terwijl
   we doorspoelen.
  */
  const dt = 1 / 30;
  let x = pd.x, z = pd.z;
  for (let i = 0; i < 30 * 45 && !g.politie.intern.blokkades.length; i++) {
    x += pd.rx * 9 * dt; z += pd.rz * 9 * dt;
    g.player.pos.set(x, 0, z);
    g.politie.update(dt);
  }
  const b = g.politie.intern.blokkades[0];
  if (!b) return { er: false };
  // Een camerapunt op twintig meter dat vrij zicht op de blokkade heeft en zo
  // dicht mogelijk bij de rijbaan ligt — recht de straat uit meten werkt niet,
  // want die bocht om sta je in een voortuin of in een muur.
  const yaw = b.cars[0].car.yaw;
  const langs = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  let van = null, beste = 1e9;
  for (let h = 0; h < 24; h++) {
    const a = h * Math.PI / 12;
    const p = { x: b.x + Math.cos(a) * 20, z: b.z + Math.sin(a) * 20 };
    if (!window.__zichtVrij(p.x, p.z, b.x, b.z, 1.6) || !window.__vrijeGrond(p.x, p.z)) continue;
    const d = window.__opWeg(p.x, p.z);
    if (d < beste) { beste = d; van = p; }
  }
  if (!van) van = { x: b.x + langs.x * 20, z: b.z + langs.z * 20 };
  g.player.inCar = null;
  g.player.pos.set(van.x, 0, van.z);
  g.player.yaw = Math.atan2(-(b.x - van.x), -(b.z - van.z));
  g.player.pitch = -0.05;
  g.player.applyCamera();
  return { er: true, aantal: g.politie.intern.blokkades.length, wagens: b.cars.length };
});
if (blok.er) {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${map}/politie_blokkade.png`, timeout: 180000 });
  console.log(`${map}/politie_blokkade.png — ${blok.aantal} blokkade(s) van ${blok.wagens} wagens`);
} else {
  console.log('geen wegblokkade gevonden');
}

// ---------- 5. een uitgebrande surveillanceauto ----------
const wrak = await page.evaluate(() => {
  const g = window.__game;
  // een bezette wagen als het kan, anders een verlaten of een blokkadewagen —
  // na een minuut of wat zijn de inzittenden er meestal allang uit gestapt
  const w = g.politie.intern.wagens[0] || g.politie.intern.verlaten[0]
    || (g.politie.intern.blokkades[0] && g.politie.intern.blokkades[0].cars[0]);
  if (!w) return { er: false };
  const car = w.car;
  // tien kogels erin, zonder te richten: raakWagen doet de schade, main.js zou
  // daarna hetzelfde doen als hieronder
  for (let i = 0; i < 10; i++) g.politie.raakWagen(car.mesh, 10);   // hp 100, tien kogels
  if (car.hp <= 0 && !car.wrak) { g.vehicles.laatOntploffen(car); g.politie.wagenOp(car); }
  // ruim een seconde verder: de vuurbal is dan half opgetrokken, dus je ziet
  // zowel de vlammen en de rook als de zwartgeblakerde auto eronder
  for (let i = 0; i < 36; i++) g.vehicles.werkKnallenBij(1 / 30);
  // rondom de auto het punt zoeken dat het dichtst bij de rijbaan ligt: op zeven
  // meter afstand, want anders sta je zomaar in een voorgevel
  let van = null, beste = 1e9;
  for (let h = 0; h < 24; h++) {
    const a = h * Math.PI / 12;
    const p = { x: car.x + Math.cos(a) * 8, z: car.z + Math.sin(a) * 8 };
    if (!window.__zichtVrij(p.x, p.z, car.x, car.z, 1.6) || !window.__vrijeGrond(p.x, p.z)) continue;
    const d = window.__opWeg(p.x, p.z);
    if (d < beste) { beste = d; van = p; }
  }
  if (!van) van = { x: car.x + 8, z: car.z + 8 };
  g.player.inCar = null;
  g.player.pos.set(van.x, 0, van.z);
  g.player.yaw = Math.atan2(-(car.x - van.x), -(car.z - van.z));
  g.player.pitch = -0.02;
  g.player.applyCamera();
  return { er: true, wrak: !!car.wrak, wrakken: g.politie.intern.wrakken.length };
});
if (wrak.er) {
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${map}/politie_wrak.png`, timeout: 180000 });
  console.log(`${map}/politie_wrak.png — wrak: ${wrak.wrak}, in de lijst: ${wrak.wrakken}`);
} else {
  console.log('geen surveillanceauto om op te schieten');
}

await browser.close();

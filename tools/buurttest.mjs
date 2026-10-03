/*
 Stap 113: het tuinfeest, de pizzascooter en de plezierboot op de Geeuw (js/leven.js).

   node tools/server.mjs 8123 &   node tools/buurttest.mjs [poort]   (npm run buurttest)

 1. Het tuinfeest: zelden (de kans per uur gemeten), alleen 's middags en 's avonds, in een tuin
    uit beeld en op afstand; iedereen staat vrij (geen gast in een muur of schutting), de tafel,
    lampionnen die 's avonds gloeien, muziek binnen tachtig meter; een schot in de buurt: ze rennen
    weg; uit beeld weg; een gast aanrijden of raken; de ambulance kan hem weer overeind helpen.
 2. De pizzascooter: alleen rond etenstijd; hij begint uit beeld en ver weg, rijdt over de weg
    (op de grond, niet harder dan zijn top), stapt af bij het adres, loopt met de doos naar de deur
    en terug, en rijdt weg; beide merken komen voor; aanrijden: hij valt om.
 3. De plezierboot: vaart overdag heen en weer over het water (elk punt van de route op het water),
    op zijn snelheid, ligt aan het eind even stil, en 's avonds ligt hij aan de Geeuwkade.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const r1 = (n) => (n == null || !isFinite(n)) ? String(n) : n.toFixed(1);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const L = await import('/js/leven.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = false;
  window.__autoplay = false;
  window.__W = W; window.__L = L;
  window.__zet = (x, z) => { const P = g.player; P.inCar = null; P.pos.set(x, 0, z); P.applyCamera(); };
  // het geluid tellen
  window.__tik = 0; window.__brom = [];
  const tik = g.geluid.feestTik.bind(g.geluid); g.geluid.feestTik = (d, t) => { window.__tik++; return tik(d, t); };
  const brom = g.geluid.brommer.bind(g.geluid); g.geluid.brommer = (d, v) => { if (d != null) window.__brom.push(d); return brom(d, v); };
});

// ------------------------------------------------------------------ 1. het tuinfeest
kop('het tuinfeest');
const feest = await page.evaluate(() => {
  const g = window.__game, l = g.leven, W = window.__W, F = window.__L.FEEST;
  const sp = { x: 900, z: -150 };
  window.__zet(sp.x, sp.z);
  // de kans: twee uur spelen 's avonds, zonder dat iemand kijkt
  g.sfeer.uur = 19;
  let gestart = 0;
  for (let i = 0; i < 2 * 3600 / 1; i++) {
    l.update(1, sp, () => false, 19);
    if (l.feest.aan) { gestart++; l.eindFeest(); }
  }
  // overdag om tien uur niet
  let ochtend = 0;
  for (let i = 0; i < 3600; i++) { l.update(1, sp, () => false, 10); if (l.feest.aan) { ochtend++; l.eindFeest(); } }
  // een feest neerzetten
  const plek = l.vrijeTuin(sp);
  l.beginFeest(plek);
  const d = Math.hypot(plek.x - sp.x, plek.z - sp.z);
  const vrij = l.gasten.map(q => { const p = q.p.groep.position; const [rx, rz] = W.resolveCollisions(p.x, p.z, 0.25); return Math.hypot(rx - p.x, rz - p.z); });
  const water = l.gasten.filter(q => W.vaarbaar && W.vaarbaar(q.p.groep.position.x, q.p.groep.position.z)).length;
  // de muziek: dichtbij wel, ver weg niet
  window.__tik = 0;
  for (let i = 0; i < 40; i++) l.update(0.1, { x: plek.x + 30, z: plek.z }, () => true, 21);
  const tikDichtbij = window.__tik;
  window.__tik = 0;
  for (let i = 0; i < 40; i++) l.update(0.1, { x: plek.x + 150, z: plek.z }, () => true, 21);
  const tikVer = window.__tik;
  // de lampionnen 's avonds
  g.sfeer.uur = 22;
  l.update(0.1, { x: plek.x + 30, z: plek.z }, () => true, 22);
  let gloei = 0; l.feest && g.scene.traverse(o => { if (o.isMesh && o.parent && o.parent.name === 'tuinfeest' && o.material.emissiveIntensity > gloei) gloei = o.material.emissiveIntensity; });
  // een schot in de buurt: ze rennen weg; na een poos en uit beeld is het weg
  const voor = l.gasten.map(q => ({ x: q.p.groep.position.x, z: q.p.groep.position.z }));
  l.schrik(plek.x + 10, plek.z);
  for (let i = 0; i < 60; i++) l.update(0.1, { x: plek.x + 30, z: plek.z }, () => true, 22);
  // weg: tien meter verder, of (vast tegen de schutting) het huis in gerend
  const gevlucht = l.gasten.filter((q, i) => q.binnen || Math.hypot(q.p.groep.position.x - voor[i].x, q.p.groep.position.z - voor[i].z) > 10).length;
  const nogAan = l.feest.aan;
  l.update(0.1, { x: plek.x + 30, z: plek.z }, () => false, 22);
  const weg = !l.feest.aan;
  // aanrijden en raken, en de ambulance
  l.beginFeest(plek);
  const q = l.gasten[0].p.groep.position;
  const n = g.aanrijden(q.x, q.z, 1.5, 12);
  const neer = l.gasten[0].neer;
  const g2 = l.gasten[2];
  const r = l.raak(g2.p.groep.children[0]);
  const neer2 = g2.neer;
  if (r && r.herstel) r.herstel();
  const op = !g2.neer;
  l.eindFeest();
  return { gestart, ochtend, d, maxVrij: Math.max(...vrij), water, tikDichtbij, tikVer, gloei, gevlucht, nogAan, weg, n, neer, neer2, op, r: !!r,
    gasten: l.gasten.length, kans: F.kans, elke: F.elke };
});
const verwacht = 2 * 3600 / feest.elke * feest.kans;
ok(feest.gestart > 0 && feest.gestart < verwacht * 2 && feest.gestart <= 30, 'zelden: een paar keer in twee uur avond', `${feest.gestart} keer (verwacht ~${verwacht.toFixed(0)})`);
ok(feest.ochtend === 0, 'niet om tien uur in de ochtend');
ok(feest.d >= 100 && feest.d <= 300, 'in een tuin op afstand', `${r1(feest.d)} m`);
ok(feest.maxVrij < 0.05 && feest.water === 0, 'iedereen staat vrij: niet in een muur, schutting of in het water', `hoogstens ${feest.maxVrij.toFixed(2)} m geduwd`);
ok(feest.gasten >= 7, 'zeven, acht man', `${feest.gasten}`);
ok(feest.tikDichtbij > 4 && feest.tikVer === 0, 'muziek die je dichtbij hoort en van ver niet', `${feest.tikDichtbij} tikken op 30 m, ${feest.tikVer} op 150 m`);
ok(feest.gloei > 1.5, "'s avonds gloeien de lampionnen", r1(feest.gloei));
ok(feest.gevlucht >= 6 && feest.nogAan && feest.weg, 'een schot: ze rennen weg, en uit beeld is het feest weg', `${feest.gevlucht} weg`);
ok(feest.n >= 1 && feest.neer && feest.neer2 && feest.r && feest.op, 'een gast aanrijden of raken, en de ambulance helpt hem overeind');

// ------------------------------------------------------------------ 2. de pizzascooter
kop('de pizzascooter');
const pizza = await page.evaluate(() => {
  const g = window.__game, l = g.leven, W = window.__W, P = window.__L.PIZZA;
  const sp = { x: 900, z: -150 };
  window.__zet(sp.x, sp.z);
  l.pizzaWeg();
  // om tien uur 's ochtends: geen bezorger
  let ochtend = 0;
  for (let i = 0; i < 900; i++) { l.update(1, sp, () => false, 10); if (l.pizza.fase !== 'weg') ochtend++; }
  // om zes uur: wel, binnen een paar minuten
  let t = 0;
  for (; t < 600 && l.pizza.fase === 'weg'; t += 1) l.update(1, sp, () => false, 18);
  const begin = { x: l.scooter.position.x, z: l.scooter.position.z };
  const dBegin = Math.hypot(begin.x - sp.x, begin.z - sp.z);
  const adres = l.pizza.adres;
  let maxV = 0, hoog = 0, n = 0, rit = 0;
  window.__brom.length = 0;
  for (rit = 0; rit < 200 && l.pizza.fase === 'heen'; rit += 0.1) {
    l.update(0.1, sp, () => false, 18);
    maxV = Math.max(maxV, l.pizza.v);
    const gy = W.grondHoogte(l.scooter.position.x, l.scooter.position.z, l.scooter.position.y + 1);
    hoog = Math.max(hoog, Math.abs(l.scooter.position.y - gy)); n++;
  }
  const brom = window.__brom.length;
  const afgestapt = l.pizza.fase;
  let lopen = 0;
  for (; lopen < 90 && l.pizza.fase !== 'deur'; lopen += 0.1) l.update(0.1, sp, () => false, 18);
  // (het adrespunt ligt midden in het pand; de deur is het dichtste punt van de gevel)
  const deur = l.pizza.deur || adres;
  const bijDeur = Math.hypot(l.rijder.groep.position.x - deur.x, l.rijder.groep.position.z - deur.z);
  const deurAdres = Math.hypot(deur.x - adres.x, deur.z - adres.z);
  const [dx2, dz2] = W.resolveCollisions(deur.x, deur.z, 0.2);
  const deurVrij = Math.hypot(dx2 - deur.x, dz2 - deur.z) < 0.25;
  for (let i = 0; i < 400 && l.pizza.fase !== 'terug'; i++) l.update(0.1, sp, () => false, 18);
  const terug = l.pizza.fase, bezorgd = l.pizza.bezorgd;
  for (let i = 0; i < 2000 && l.pizza.fase !== 'weg'; i++) l.update(0.1, sp, () => false, 18);
  const weg = l.pizza.fase;
  // beide merken
  const merken = new Set();
  for (let i = 0; i < 20; i++) { l.pizzaWeg(); if (l.startPizza(sp, () => false, { zeker: true })) merken.add(l.pizza.merk); }
  // aanrijden
  let gestart = false;
  for (let k = 0; k < 5 && !gestart; k++) { l.pizzaWeg(); gestart = l.startPizza(sp, () => false, { zeker: true }); }
  for (let i = 0; i < 30; i++) l.update(0.1, sp, () => false, 18);
  const voorAan = l.pizza.fase;
  const q = l.scooter.position;
  const aan = g.aanrijden(q.x, q.z, 1.5, 12);
  for (let i = 0; i < 10; i++) l.update(0.1, sp, () => true, 18);
  const om = l.pizza.omgevallen && l.rijder.omT > 0.9;
  const omInfo = `gestart ${gestart}, fase ${voorAan} → ${l.pizza.fase}, omgevallen ${l.pizza.omgevallen}, omT ${l.rijder.omT}`;
  l.pizzaWeg();
  return { ochtend, t, dBegin, maxV, top: P.top, hoog, brom, afgestapt, bijDeur, terug, bezorgd, weg, merken: [...merken], aan, om, omInfo, rit, deurAdres, deurVrij };
});
ok(pizza.ochtend === 0, 'om tien uur in de ochtend geen bezorger');
ok(pizza.t < 360, 'rond etenstijd komt hij binnen een paar minuten', `na ${pizza.t} s`);
ok(pizza.dBegin > 250, 'hij begint ver weg', `${r1(pizza.dBegin)} m`);
ok(pizza.maxV <= pizza.top + 0.2 && pizza.hoog < 0.3, 'over de weg, op de grond, niet harder dan zijn top', `${r1(pizza.maxV)} m/s, ${r1(pizza.hoog)} m`);
ok(pizza.brom > 20, 'je hoort de brommer', `${pizza.brom} keer`);
ok(pizza.deurVrij && pizza.deurAdres < 30, 'de deur: op de gevel van het pand van het adres, buiten de muur', `${r1(pizza.deurAdres)} m van het adrespunt`);
ok(pizza.afgestapt === 'afstappen' && pizza.bijDeur < 1.5, 'hij stapt af en loopt naar de deur', `na ${r1(pizza.rit)} s rijden, ${r1(pizza.bijDeur)} m van de deur`);
ok(pizza.terug === 'terug' && pizza.bezorgd >= 1 && pizza.weg === 'weg', 'bezorgd, terug op de scooter, en weg');
ok(pizza.merken.includes('Pizzeria Sneek') && pizza.merken.includes('Cappadocia'), 'Pizzeria Sneek en Cappadocia', pizza.merken.join(', '));
ok(pizza.aan >= 1 && pizza.om, 'aangereden: hij valt om', `${pizza.aan} geraakt · ${pizza.omInfo}`);

// ------------------------------------------------------------------ 3. de plezierboot
kop('de plezierboot');
const boot = await page.evaluate(async () => {
  const g = window.__game, l = g.leven, W = window.__W, B = window.__L.BOOT;
  const b = l.boot;
  if (!b.groep) return { geen: true };
  // zitten ze, ook als je nog ver weg bent? De kruin boven de romp (staand 1,75 m)
  const T = await import('/lib/three.module.js');
  b.groep.updateMatrixWorld(true);
  const kruin = Math.max(...b.mensen.map(m => new T.Box3().setFromObject(m.groep).max.y - b.groep.position.y));
  // elk punt van de route op het water
  let droog = 0, n = 0;
  for (let s = 0; s <= b.lengte; s += 10) { const p = l.bootPunt(s); n++; if (!W.vaarbaar(p.x, p.z)) droog++; }
  // overdag: varen
  const sp = { x: 0, z: 0 };
  b.s = b.lengte * 0.3; b.richting = 1; b.wachtT = 0;
  const s0 = b.s;
  for (let i = 0; i < 100; i++) l.update(0.1, sp, () => false, 14);
  const snel = (b.s - s0) / 10;
  // het eind: even stil, dan terug
  b.s = b.lengte - 2; b.richting = 1;
  for (let i = 0; i < 20; i++) l.update(0.1, sp, () => false, 14);
  const keert = b.richting === -1 && b.wachtT > 0;
  // 's avonds terug naar de Geeuwkade
  b.s = b.lengte * 0.05;
  for (let i = 0; i < 600; i++) l.update(0.1, sp, () => false, 22);
  const thuis = b.s;
  const p = b.groep.position;
  return { lengte: b.lengte, droog, n, snel, verwacht: B.snel, keert, thuis, y: p.y, mensen: b.mensen.length, kruin, opWater: W.vaarbaar(p.x, p.z) };
});
ok(!boot.geen && boot.lengte > 1500, 'de route over de Geeuw, van de Geeuwkade naar IJlst', `${r1(boot.lengte)} m`);
ok(boot.droog === 0, 'elk punt van de route ligt op het water', `${boot.droog} van ${boot.n} droog`);
ok(Math.abs(boot.snel - boot.verwacht) < 0.3, 'overdag vaart hij, rustig', `${r1(boot.snel)} m/s`);
ok(boot.keert, 'aan het eind ligt hij even stil en keert');
ok(boot.thuis === 0 && boot.opWater && boot.y < 0.5, "'s avonds ligt hij aan de Geeuwkade, op het water", `y ${r1(boot.y)}`);
ok(boot.mensen === 4, 'vier man aan boord');
ok(boot.kruin < 1.6, 'ze zitten op de banken, ook van ver', `kruin ${boot.kruin.toFixed(2)} m boven de boot`);

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);

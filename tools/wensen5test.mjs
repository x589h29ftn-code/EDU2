/*
 Stap 131: de vijfde ronde wensen van 10 okt 2026, nagemeten.

   node tools/server.mjs 8123 &   node tools/wensen5test.mjs [poort]   (npm run wensen5test)

 1. Martens Vishandel bij de Jumbo aan de Molenkrite: kibbeling € 20, +25 leven, open van 9 tot 18 uur.
 2. Pizza bezorgen vanuit Pizzeria Sneek en Cappadocia: een rit, op tijd € 40 plus fooi, te laat koud.
 3. Tennis als minispel: een game winnen levert € 50 op.
 4. Zeilbootjes die echt varen, op het water blijven en 's nachts weg zijn.
 5. Onweer in de regen: bliksem en donder.
 6. Tuning aan de balie van het Autohuis, alleen aan je eigen auto: motor, vering, decals; bewaard.
 7. Tinga Nieuws op de tv thuis.
 8. Aan de knoppen van Radio Tinga: een verzoeknummer, ON AIR, de schuif, € 75.
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
  const { KAART } = await import('/js/kaartwereld.js');
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  window.__W = W; window.__K = KAART;
  window.__meld = [];
  const echt = g.hud.melding.bind(g.hud);
  g.hud.melding = (k, o, t) => { window.__meld.push(`${k}|${o}`); return echt(k, o, t); };
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__klik = (max = 80) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__tot = (fase, maxS = 20, dt = 0.05) => {
    for (let t = 0; t < maxS && v.fase !== fase; t += dt) { window.__stap(1, dt); if (!document.getElementById('dialoog').hidden) v.toets(); }
    return v.fase === fase;
  };
  window.__na17 = () => {
    const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
    Object.assign(s, { schaduwKlaar: true, raceKlaar: true, brugKlaar: true, schriftKlaar: true, invalKlaar: true, invalKeus: 2,
      invalTelefoon: true, ronaldKlaar: true, ronaldPraatte: true, uitzendingKlaar: false, huisGekozen: s.huisGekozen || 'Koningsspil 20' });
    g.politie.reset();
    v.herstel(s);
  };
  // missie 18 op een fase hervatten (zoals het laden en het neergaan dat doen)
  window.__bij = (fase) => {
    if (v.missie !== 'uitzending') { window.__na17(); v.startMissie('uitzending'); window.__stap(2); }
    const s = v.bewaar(); s.missie = 'uitzending'; s.fase = fase;
    g.politie.reset();
    v.herstel(s);
    window.__stap(2);
  };
});

// het verhaal klaar: vrij spelen, zodat niets op een missie wacht
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__na17();
  const s = v.bewaar(); s.uitzendingKlaar = true; v.herstel(s);
  window.__stap(2);
  g.player.inCar = null; g.player.zit = null;
});

// ------------------------------------------------------------------ 1. vishandel
kop('Martens Vishandel');
const vis = await page.evaluate(async () => {
  const g = window.__game, V = g.vishandel, v = g.verhaal, p = g.player;
  const { VIS, NAAM } = await import('/js/vishandel.js');
    const s = V.stand;
  // de Jumbo aan de Molenkrite: het dichtstbijzijnde pand van de Jumbo
  const lz = 2.2;
  p.active = true;
  g.sfeer.uur = 12;
  p.pos.set(s.x + lz * Math.sin(s.yaw), 0, s.z + lz * Math.cos(s.yaw));
  p.health = 50;
  v.verdien(100);
  V.update(5);
  const geld0 = v.geld;
  const hint = V.hint();
  V.toets();
  const na = { geld: v.geld, leven: p.health };
  V.toets();
  const tweede = { geld: v.geld, leven: p.health };
  // 's avonds dicht
  g.sfeer.uur = 21; V.update(5);
  for (let i = 0; i < 40; i++) V.update(0.1);
  p.health = 50;
  const geldD = v.geld;
  V.toets();
  const dicht = { geld: v.geld, leven: p.health, hint: V.hint() };
  g.sfeer.uur = 12;
  p.active = false;
  return { naam: NAAM, VIS, x: s.x, z: s.z, geld0, na, tweede, geldD, dicht, hint,
    speld: V.winkels && V.winkels.length ? V.winkels[0].wat : null };
});
ok(/Martens/.test(vis.naam), 'de naam is Martens Vishandel', vis.naam);
ok(Math.hypot(vis.x - 237.6, vis.z + 62.4) < 15, 'op het parkeerterrein van de Jumbo aan de Molenkrite', `${r1(vis.x)}, ${r1(vis.z)}`);
ok(vis.VIS.prijs === 20 && vis.VIS.leven === 25, 'kibbeling € 20, +25 leven');
ok(/kibbeling/i.test(vis.hint || ''), 'een hint bij de toonbank', vis.hint);
ok(vis.geld0 - vis.na.geld === 20 && vis.na.leven === 75, 'kopen: −€ 20, leven 50 → 75', `${vis.geld0} → ${vis.na.geld}, ${vis.na.leven}`);
ok(vis.tweede.geld === vis.na.geld, 'meteen nog eens E doet niets');
ok(vis.dicht.geld === vis.geldD && vis.dicht.leven === 50 && /dicht/.test(vis.dicht.hint || ''), "om 21 uur dicht", vis.dicht.hint);
ok(vis.speld === 'vis', 'een speldje op de kaart', vis.speld);

// ------------------------------------------------------------------ 2. pizza bezorgen
kop('pizza bezorgen');
const pz = await page.evaluate(() => {
  const g = window.__game, P = g.pizzabaan, v = g.verhaal, p = g.player;
  const uit = { zaken: P.plekken.map(q => q.naam) };
  p.active = true;
  const z = P.plekken[0];
  p.pos.set(z.x, 0, z.z);
  P.update(0.1, { vrij: true });
  const geld0 = v.geld;
  uit.aan = P.toets();
  const r = P.stand.rit;
  uit.rit = r ? { naam: r.naam, tijd: r.tijd, lengte: r.lengte, scooter: P.scooters.includes(r.auto) } : null;
  if (r) {
    uit.nav = !!(g.hud.eigenNav || document.getElementById('minimap'));
    p.inCar = null;
    p.pos.set(r.x, 0, r.z);
    for (let i = 0; i < 10; i++) P.update(0.5, { vrij: true });
    P.toets();
    uit.laatste = P.stand.laatste;
    uit.verdiend = v.geld - geld0;
  }
  // te laat
  p.inCar = null;
  p.pos.set(z.x, 0, z.z);
  for (let i = 0; i < 4; i++) P.update(0.5, { vrij: true });
  // (terug bij de zaak)
  P.toets();
  const r2 = P.stand.rit;
  if (r2) { P.update(r2.tijd + 1, { vrij: true }); uit.koud = P.stand.laatste && P.stand.laatste.koud; uit.naKoud = P.bezig; }
  // tijdens een missie niet
  p.pos.set(z.x, 0, z.z);
  P.update(0.1, { vrij: false });
  uit.nietVrij = P.toets() && !P.bezig;
  P.afbreken();
  p.inCar = null; p.active = false;
  return uit;
});
ok(pz.zaken.length === 2 && pz.zaken.some(n => /Sneek/.test(n)) && pz.zaken.some(n => /Cappadocia/.test(n)), 'twee pizzeria\'s', pz.zaken.join(', '));
ok(pz.aan && pz.rit && pz.rit.scooter, 'E bij de zaak: een rit op de scooter', JSON.stringify(pz.rit));
ok(pz.rit && pz.rit.lengte > 100 && pz.rit.tijd > 20, 'een adres verderop met genoeg tijd', pz.rit && `${r1(pz.rit.lengte)} m, ${r1(pz.rit.tijd)} s`);
ok(pz.laatste && pz.laatste.loon >= 40 && pz.laatste.loon === 40 + pz.laatste.fooi && pz.verdiend === pz.laatste.loon, 'op tijd afgeleverd: € 40 plus fooi', pz.laatste && `€ ${pz.laatste.loon} (fooi ${pz.laatste.fooi})`);
ok(pz.koud === true && pz.naKoud === false, 'te laat: koud, geen geld, de rit voorbij');
ok(pz.nietVrij, 'tijdens een missie geen rit');

// ------------------------------------------------------------------ 3. tennis
kop('tennis');
const tn = await page.evaluate(async () => {
  const g = window.__game, T = g.tennisspel, v = g.verhaal, p = g.player;
  const uit = { plekken: T.plekken.length };
  p.active = true; p.inCar = null;
  const q = T.plekken[0];
  p.pos.set(q.x, 0, q.z);
  const geld0 = v.geld;
  uit.start = T.toets() && T.bezig;
  const dt = 1 / 30;
  let slagen = 0;
  for (let t = 0; t < 240 && T.bezig; t += dt) {
    p.update(dt);
    T.update(dt);
    if (T.stand.fase === 'opslag') { T.slag(); slagen++; }
    const r = T.totRaak;
    if (r != null && r < 0.6) T.naarBal();
    if (r != null && Math.abs(r) <= dt) { T.slag(); slagen++; }
  }
  uit.slagen = slagen; uit.laatste = T.stand.laatste; uit.verdiend = v.geld - geld0;
  uit.bezig = T.bezig;
  T.afbreken(); p.active = false;
  return uit;
});
ok(tn.plekken >= 1, 'een tennisbaan om te spelen', `${tn.plekken}`);
ok(tn.start, 'E aan het hek: het potje begint');
ok(tn.laatste === 'gewonnen' && tn.verdiend === 50, 'goed geslagen: de game gewonnen, € 50', `${tn.laatste}, € ${tn.verdiend}, ${tn.slagen} slagen`);

// ------------------------------------------------------------------ 4. zeilbootjes
kop('zeilbootjes');
const zl = await page.evaluate(async () => {
  const g = window.__game, Z = g.zeilen;
  const { vaarbaar: vb } = await import('/js/world.js');
  const vaarbaar = (x, z, m) => vb(x, z) || [[m,0],[-m,0],[0,m],[0,-m]].some(([a, b]) => vb(x + a, z + b));
  g.sfeer.uur = 13; g.sfeer.weer = 'helder';
  const start = Z.boten.map(b => ({ x: b.x, z: b.z }));
  let opLand = 0;
  for (let i = 0; i < 300; i++) {
    Z.update(0.1, Z.boten[0].x, Z.boten[0].z);
    if (vaarbaar && i % 20 === 0) for (const b of Z.boten) if (!vaarbaar(b.x, b.z, 3)) opLand++;
  }
  const verder = Z.boten.map((b, i) => Math.hypot(b.x - start[i].x, b.z - start[i].z));
  const zichtbaarDag = Z.boten.filter(b => b.groep.visible).length;
  g.sfeer.uur = 23;
  for (let i = 0; i < 5; i++) Z.update(0.1, Z.boten[0].x, Z.boten[0].z);
  const zichtbaarNacht = Z.boten.filter(b => b.groep.visible).length;
  g.sfeer.uur = 12;
  return { n: Z.boten.length, verder, zichtbaarDag, zichtbaarNacht, opLand, getoetst: !!vaarbaar };
});
ok(zl.n >= 3, 'een paar zeilbootjes', `${zl.n}`);
ok(zl.verder.every(d => d > 20), 'in 30 s vaart elk bootje meer dan 20 m', zl.verder.map(r1).join(', '));
ok(!zl.getoetst || zl.opLand === 0, 'ze blijven op het water', `${zl.opLand} keer op land`);
ok(zl.zichtbaarDag === zl.n && zl.zichtbaarNacht === 0, 'overdag op het water, om 23 uur binnen', `${zl.zichtbaarDag} / ${zl.zichtbaarNacht}`);

// ------------------------------------------------------------------ 5. onweer
kop('onweer');
const ow = await page.evaluate(async () => {
  const g = window.__game, s = g.sfeer;
  const { ONWEER } = await import('/js/sfeer.js');
  let donders = 0;
  const was = s.opDonder;
  s.opDonder = () => { donders++; };
  // zonder regen geen onweer
  s.weer = 'helder';
  const b0 = s.bliksems;
  for (let i = 0; i < 100; i++) s.update(0.05, 0, 0);
  const zonderRegen = s.bliksems - b0;
  s.forceerOnweer({ flitsNa: 0.1 });
  for (let i = 0; i < 160; i++) s.update(0.05, 0, 0);
  const uit = { zonderRegen, bliksems: s.bliksems - b0, donders, flitsMax: s.onweer.flitsMax, weer: s.weer, kans: ONWEER && ONWEER.kans };
  s.opDonder = was;
  s.weer = 'helder';
  for (let i = 0; i < 10; i++) s.update(0.05, 0, 0);
  return uit;
});
ok(ow.zonderRegen === 0, 'zonder regen geen bliksem');
ok(ow.weer === 'regen' && ow.bliksems >= 1, 'in de regen een bliksem', `${ow.bliksems}`);
ok(ow.donders >= 1, 'en daarna de donder', `${ow.donders}`);
ok(ow.flitsMax > 0.25, 'de lucht licht op', r1(ow.flitsMax));
ok(ow.kans > 0 && ow.kans < 1, 'onweer is een kans, niet elke bui', String(ow.kans));

// ------------------------------------------------------------------ 6. tuning
kop('tuning');
const tu = await page.evaluate(async () => {
  const g = window.__game, t = g.tuning, ga = g.garage, v = g.verhaal, p = g.player;
  const { TE_KOOP } = await import('/js/garage.js');
  p.active = true; p.inCar = null;
  p.pos.set(783.4, 0, 144.0);
  const uit = {};
  t.update(0.1);
  uit.zonderAuto = t.toets() && !t.open;
  v.verdien(10000);
  const geld0 = v.geld;
  const m = ga.eigen.length;
  ga.koop(TE_KOOP.find(q => q.id === 'gti'));
  const car = ga.eigen[m] && ga.eigen[m].car;
  uit.gekocht = !!car;
  const geld1 = v.geld;
  const top0 = car.topSnelheid;
  p.pos.set(783.4, 0, 144.0);
  t.update(0.1);
  uit.open = t.toets() && t.open;
  t.kies(1); t.kies(5); t.kies(2);
  uit.factor = car.topSnelheid / top0;
  uit.betaald = geld1 - v.geld;
  let dec = 0;
  car.mesh.traverse(o => { if (o.userData && o.userData.decal === 'markant') dec++; });
  uit.decals = dec;
  const zichtbaar = getComputedStyle(document.getElementById('tuningMenu')).display !== 'none';
  t.kies(0); t.kies(0);
  uit.menuWeg = !t.open && getComputedStyle(document.getElementById('tuningMenu')).display === 'none';
  uit.menuZichtbaar = zichtbaar;
  const e = ga.bewaar().find(q => q.tuning);
  uit.bewaard = e && e.tuning.motor && JSON.stringify(e.tuning).includes('markant') ? e.tuning : null;
  p.active = false;
  return uit;
});
ok(tu.zonderAuto, 'zonder gekochte auto geen tuning');
ok(tu.gekocht && tu.open && tu.menuZichtbaar, 'met je eigen GTI ervoor gaat het menu open');
ok(Math.abs(tu.factor - 1.12) < 0.01, 'de motor: +12 % topsnelheid', tu.factor && tu.factor.toFixed(3));
ok(tu.betaald === 1500 + 150 + 1200, 'betaald: GTI € 1.200, motor € 1.500, decal € 150', `€ ${tu.betaald}`);
ok(tu.decals === 2, 'de decal van Radio Markant op beide flanken', `${tu.decals}`);
ok(tu.menuWeg, '0 sluit het menu');
ok(!!tu.bewaard, 'de tuning gaat mee in de opslag', JSON.stringify(tu.bewaard).slice(0, 80));

// ------------------------------------------------------------------ 7. Tinga Nieuws
kop('Tinga Nieuws op de tv');
const tv = await page.evaluate(async () => {
  const g = window.__game, n = await import('/js/nieuws.js'), p = g.player;
  n.onthoud('schietpartij', 'Molenkrite');
  const w = g.woningen.find(q => q.tvPunt);
  if (!w) return { geen: true };
  p.active = true; p.inCar = null; p.zit = null;
  if (w.tvAan) w.zetTv(false);
  p.pos.set(w.tvPunt.x, 0, w.tvPunt.z);
  const bij = w.bijTv(p.pos.x, p.pos.z);
  w.toets();
  for (let i = 0; i < 10; i++) w.update(0.1);
  const kop = w.tvKop;
  const koppen = n.kopteksten(8);
  // het logo: rood in de linkerbovenhoek van het doek
  let rood = false;
  const c = w.tvDoek;
  if (c && c.getContext) {
    const d = c.getContext('2d').getImageData(Math.round(c.width * 0.04), Math.round(c.height * 0.06), 1, 1).data;
    rood = d[0] > 150 && d[1] < 90 && d[2] < 90;
  }
  const aan = w.tvAan;
  w.zetTv(false);
  p.active = false;
  return { bij, aan, kop: kop && kop.tekst, inLijst: !!kop && koppen.some(k => (k.tekst || k) === kop.tekst), molen: /Molenkrite/.test(kop && kop.tekst || ''), rood };
});
ok(!tv.geen && tv.bij && tv.aan, 'E bij de tv: hij gaat aan');
ok(tv.inLijst && tv.molen, 'de kop gaat over wat er gebeurd is', tv.kop);
ok(tv.rood, 'het rode logo van Tinga Nieuws');

// ------------------------------------------------------------------ 8. dj bij Radio Tinga
kop('Radio Tinga: aan de knoppen');
const dj = await page.evaluate(async () => {
  const g = window.__game, D = g.djdienst, st = g.studio, v = g.verhaal, p = g.player, G = g.geluid;
  for (let i = 0; i < 100 && !D.lijst.length; i++) await new Promise(r => setTimeout(r, 50));
  const t = st.plekken.tafel;
  p.active = true; p.inCar = null;
  p.pos.set(t.x, 0, t.z + 0.6);
  const bij = st.bijTafel(p.pos.x, p.pos.z) || (p.pos.set(t.x, 0, t.z), st.bijTafel(p.pos.x, p.pos.z));
  const geld0 = v.geld, schuif0 = st.schuif;
  const open = D.toets() && D.open;
  D.kies(2);
  for (let i = 0; i < 30; i++) D.update(0.1, { vrij: true });
  const uit = { bij, open, lijst: D.lijst.length, gekozen: D.gekozen && D.gekozen.bestand, verzoek: G.verzoek,
    loon: v.geld - geld0, schuif0, schuif: st.schuif };
  D.kies(3);
  uit.tweede = v.geld - geld0;
  D.kies(5);
  for (let i = 0; i < 30; i++) D.update(0.1, { vrij: true });
  uit.dicht = !D.open; uit.schuifNa = st.schuif;
  p.active = false;
  return uit;
});
ok(dj.bij && dj.open && dj.lijst === 3, 'E aan de tafel: drie nummers om te kiezen');
ok(dj.gekozen && dj.verzoek === dj.gekozen, 'het gekozen nummer is het volgende op Radio Tinga', dj.verzoek);
ok(dj.schuif > 0.9 && dj.schuif0 < 0.5, 'de schuif gaat omhoog', `${r1(dj.schuif0)} → ${r1(dj.schuif)}`);
ok(dj.loon === 75 && dj.tweede === 75, 'Sjors geeft € 75, en niet meteen nog eens', `€ ${dj.loon}, € ${dj.tweede}`);
ok(dj.dicht && dj.schuifNa < 0.05, '5: de knoppen terug, de schuif omlaag');

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);

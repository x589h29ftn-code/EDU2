/*
 Stap 123: zes dingen die er voor de publicatie nog bij kwamen (4 okt 2026: "1. 3. 5. 6. 8. En voeg ook een
 mes toe als wapen voor als je wapen leeg is").

   node tools/server.mjs 8123 &   node tools/zespuntentest.mjs [poort]   (npm run zespuntentest)

 1. Het mes: je hebt het altijd; met alles leeg wissel je er vanzelf naartoe; een steek op 1,6 m legt
    een bewaker neer, op 6 m raakt hij niets; niemand hoort een schot.
 2. De GTI in de showroom: te koop, een eigen model, sneller dan een hatchback, in de legenda.
 3. Uitleg bij de eerste ster en de eerste keer de grote kaart.
 4. De wapens van de anderen: afgerond, gedeeld tussen iedereen, de goede lengte.
 5. Voetgangers steken over in plaats van in één beeld naar de overkant te springen.
 6. Na het einde een missie opnieuw spelen vanuit het pauzemenu, en daarna weer vrij spelen.
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
const page = await browser.newPage({ viewport: { width: 1100, height: 680 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  localStorage.removeItem('tinga.spel.v1'); localStorage.removeItem('tinga.checkpoint.v1');
  document.getElementById('overlay').style.display = 'none';
  window.__autoplay = false;
  g.player.active = false;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  window.__laad = (extra) => {
    const s = v.bewaar(); s.volgende = null; s.punt = null;
    Object.assign(s, extra);
    g.politie.reset();
    v.herstel(s);
    window.__stap(2);
  };
});

// ------------------------------------------------------------------ 1. het mes
kop('het mes');
const mes = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const THREE = await import('three');
  const { WAPENS } = await import('/js/player.js');
  const uit = { wapens: P.wapens.slice(), info: WAPENS.mes };
  // alles leeg: één klik en het mes komt
  P.wapens = ['pistool', 'mes']; P.wapenNr = 0; P.zetWapen('pistool');
  P.ammo = 0; P.reserve = 0; P.magazijnen = {};
  P.active = true; P.vuurKlok = 0;
  P.shoot();
  P.wisselStap(0.3); P.wisselStap(0.3); P.wisselStap(0.3);
  uit.naLeeg = P.wapenSoort;
  // bewakers van missie 3 als doel; geen schot te horen
  let gehoord = 0;
  const echtHoor = v.schotGehoord.bind(v);
  v.schotGehoord = (...a) => { gehoord++; return echtHoor(...a); };
  v.__startMissie('bewaking'); window.__stap(4);
  const doelen = () => v.doelen().filter(o => o.visible !== false);
  const voor = doelen().length;
  const doel = doelen()[0];
  const q = doel.getWorldPosition(new THREE.Vector3());
  const zetVoor = (afstand) => {
    const dx = 1, dz = 0;
    P.pos.set(q.x - dx * afstand, 0, q.z - dz * afstand);
    P.yaw = Math.atan2(-dx, -dz);
    const oog = P.pos.y + (P.eye || 1.6);
    P.pitch = Math.atan2(q.y + 1.1 - oog, afstand);
    P.inCar = null; P.applyCamera();
    g.scene.updateMatrixWorld(true);
  };
  // eerst op zes meter: mis
  zetVoor(6);
  P.vuurKlok = 0; P.shoot();
  uit.op6 = { over: doelen().length, steken: P.steken || 0 };
  // dan op 1,6 m
  zetVoor(1.6);
  P.vuurKlok = 0; P.shoot();
  window.__stap(2);
  uit.op16 = { over: doelen().length, voor };
  uit.gehoord = gehoord;
  v.schotGehoord = echtHoor;
  P.active = false;
  return uit;
});
ok(mes.wapens.includes('mes') && mes.info && mes.info.mes, 'je hebt het mes altijd', JSON.stringify(mes.wapens));
ok(mes.naLeeg === 'mes', 'alles leeg en de trekker over: je pakt je mes', mes.naLeeg);
ok(mes.op6.over === mes.op16.voor && mes.op6.steken >= 1, 'een steek op zes meter raakt niets', JSON.stringify(mes.op6));
ok(mes.op16.over === mes.op16.voor - 1, 'op 1,6 m gaat een bewaker neer', JSON.stringify(mes.op16));
ok(mes.gehoord === 0, 'niemand hoort een steek als schot', String(mes.gehoord));

// ------------------------------------------------------------------ 2. de GTI
kop('de GTI in de showroom');
const gti = await page.evaluate(async () => {
  const g = window.__game;
  const { TE_KOOP } = await import('/js/garage.js');
  const { RIJ } = await import('/js/vehicles.js');
  const { makeCar } = await import('/js/carmodel.js');
  const THREE = await import('three');
  const a = TE_KOOP.find(t => t.soort === 'gti');
  const maat = (soort) => new THREE.Box3().setFromObject(makeCar(0x3355aa, soort, false)).getSize(new THREE.Vector3());
  const m = maat('gti'), h = maat('hatch');
  const legenda = ((g.hud.legenda || []).find(l => l.wat === "auto's") || {}).uitleg || '';
  // (de doos van het hele model telt de lichtbundel van de koplampen mee: vergelijk met de hatchback)
  return { a: a && { prijs: a.prijs, naam: a.naam }, rij: RIJ.gti, hatch: RIJ.hatch, gtiH: m.y, hatchH: h.y, gtiL: Math.max(m.x, m.z), hatchL: Math.max(h.x, h.z), legenda,
    plekken: TE_KOOP.length };
});
ok(gti.a && gti.a.prijs === 1200 && gti.plekken === 4, 'een vierde auto: de GTI voor € 1.200', JSON.stringify(gti.a));
ok(gti.rij && gti.rij.top > gti.hatch.top && gti.rij.top < 70, 'sneller dan een hatchback, langzamer dan de Ferrari', JSON.stringify(gti.rij));
ok(gti.gtiH < gti.hatchH && gti.gtiL <= gti.hatchL, 'een eigen model: lager en niet langer dan een hatchback', `${gti.gtiH.toFixed(2)} tegen ${gti.hatchH.toFixed(2)} m hoog`);
ok(/GTI/.test(gti.legenda) && /1\.200/.test(gti.legenda), 'in de legenda van de grote kaart', gti.legenda);

// ------------------------------------------------------------------ 3. uitleg
kop('uitleg bij de eerste ster en de grote kaart');
// (de tekst meteen na het tonen gelezen: headless kan één beeld zo lang duren dat het klokje van de uitleg al af is)
const uitl = await page.evaluate(async () => {
  const g = window.__game;
  const U = await import('/js/uitleg.js');
  const el = document.getElementById('uitleg');
  const lees = () => (el && el.classList.contains('zichtbaar') ? el.textContent : '');
  g.player.active = true;
  g.politie.zetSter(1, g.player.pos.x + 300, g.player.pos.z);
  g.uitlegBij();
  const ster = lees() || (U.gezien('sterren') ? '(al getoond)' : '');
  g.politie.reset();
  while (!g.hud.bigOpen) g.hud.kaartStap();
  g.uitlegBij();
  const kaart = lees() || (U.gezien('kaart') ? '(al getoond)' : '');
  while (g.hud.kaartStand !== 0) g.hud.kaartStap();
  g.player.active = false;
  return { ster, kaart };
});
ok(/wasbox/i.test(uitl.ster), 'de eerste ster: uit het zicht blijven of de wasbox', uitl.ster.slice(0, 120));
ok(/eigen doel/i.test(uitl.kaart), 'de grote kaart: klik voor een eigen doel', uitl.kaart.slice(0, 120));

// ------------------------------------------------------------------ 4. de wapens van de anderen
kop('de wapens van de anderen');
const npcw = await page.evaluate(async () => {
  const g = window.__game;
  const THREE = await import('three');
  const { Persoon } = await import('/js/persoon.js');
  const uit = {};
  for (const soort of ['pistool', 'mp', 'geweer']) {
    const a = new Persoon({ wapen: soort }), b = new Persoon({ wapen: soort });
    const meshes = (p) => p.wapen.children.filter(o => o.isMesh && o.geometry.attributes.position.count > 100);
    const ma = meshes(a), mb = meshes(b);
    const geo = ma.map(o => o.geometry);
    const box = new THREE.Box3();
    for (const o of ma) { o.geometry.computeBoundingBox(); box.union(o.geometry.boundingBox); }
    const s = box.getSize(new THREE.Vector3());
    uit[soort] = { delen: ma.length, gedeeld: mb.every((o, i) => o.geometry === geo[i]), lengte: s.z, punten: geo.reduce((n, q) => n + q.attributes.position.count, 0) };
  }
  return uit;
});
ok(npcw.pistool.delen >= 1 && npcw.pistool.lengte > 0.17 && npcw.pistool.lengte < 0.26, 'het pistool: afgerond, ruim 20 cm', JSON.stringify(npcw.pistool));
ok(npcw.mp.lengte > 0.55 && npcw.mp.lengte < 0.85, 'het machinepistool met stut', JSON.stringify(npcw.mp));
ok(npcw.geweer.lengte > 0.85 && npcw.geweer.lengte < 1.2, 'het geweer met kolf en loop', JSON.stringify(npcw.geweer));
ok(npcw.pistool.gedeeld && npcw.mp.gedeeld && npcw.geweer.gedeeld, 'één vorm per soort, gedeeld door iedereen');
ok(npcw.geweer.punten > 500, 'geen blokjes meer: afgeronde randen', `${npcw.geweer.punten} hoekpunten`);

// ------------------------------------------------------------------ 5. oversteken
kop('voetgangers steken over');
const steek = await page.evaluate(() => {
  const g = window.__game, N = g.npcs;
  // iemand aan het eind van een stuk stoep langs een rijweg, steeds opnieuw
  const p = N.people.find(q => q.alive && q.seg);
  const seg0 = (N.segs || []).find(q => q.drive && N.buren(q.b, q).some(c => c.drive));
  if (!p || !seg0) return { geen: !p ? 'persoon' : 'rijweg' };
  const magWas = N.magOversteken;
  N.magOversteken = null;               // (geen verkeer: dan mag hij altijd)
  let sprong = 0, over = 0, n = 0;
  for (let i = 0; i < 400; i++) {
    p.seg = seg0; p.t = 1; p.dir = 1; p.paniek = 0; p.steek = 0;
    const zij = p.side;
    N.pickSegment(p);
    n++;
    if (p.side !== zij && !(p.steek > 0)) sprong++;
    if (p.steek > 0) over++;
  }
  N.magOversteken = magWas;
  p.steek = 0;
  return { sprong, over, n };
});
ok(steek && steek.sprong === 0, 'nooit meer in één beeld naar de overkant', JSON.stringify(steek));
ok(steek && steek.over > 20, 'maar wel oversteken, over de rijweg', JSON.stringify(steek));

// ------------------------------------------------------------------ 6. missie opnieuw
kop('missie opnieuw na het einde');
const her = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__laad({ missie: 'klaar', fase: 'klaar', huis: 'Koningsspil 20', veteraanKlaar: true, politieautoKlaar: true, brugKlaar: true,
    schriftKlaar: true, raceKlaar: true, schaduwKlaar: true, invalKlaar: true, invalKeus: 2, ronaldKlaar: true, uitzendingKlaar: true });
  v.__geenVolgende();
  const lijst = v.herspeelbaar();
  g.player.active = true;
  g.pauzeer();
  const knop = document.getElementById('menuHerspeel');
  return { n: lijst.length, eerste: lijst[0], knop: !!knop && !knop.hidden && getComputedStyle(knop).display !== 'none' };
});
ok(her.n === 16 && her.eerste.nr === 2, 'zestien missies om opnieuw te spelen (niet 1 en 9)', JSON.stringify(her));
ok(her.knop, 'in het pauzemenu: Missie opnieuw', String(her.knop));
await page.evaluate(() => document.getElementById('menuHerspeel').click());
await page.waitForTimeout(300);
const lijstKnoppen = await page.$$eval('.menuknop.klein', bs => bs.map(b => b.textContent));
ok(lijstKnoppen.length === 16 && lijstKnoppen.some(t => /Dúvelsrak/.test(t)), 'de lijst in het menu', lijstKnoppen.slice(0, 3).join(' | '));
await page.evaluate(() => document.querySelector('.menuknop.klein[data-missie="brug"]').click());
await page.waitForTimeout(800);
const na = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const uit = { missie: v.missie, herspeelt: v.herspeelt, brugKlaar: v.brug ? v.brug.klaar : null,
    menu: getComputedStyle(document.getElementById('overlay')).display };
  // wat het einde van missie 12 ook doet: de volgende beginnen; dat wordt vrij spelen
  v.startMissie('schrift');
  window.__stap(2);
  uit.daarna = { missie: v.missie, fase: v.fase, herspeelt: v.herspeelt, brugKlaar: v.brug ? v.brug.klaar : null };
  // missie 1 tot 4 lopen in elkaar door: na missie 2 opnieuw ook vrij spelen
  v.herspeel('rijden');
  uit.rijden = v.missie;
  v.startMissie('bewaking'); window.__stap(2);
  uit.naRijden = v.missie;
  g.player.active = false;
  return uit;
});
ok(na.missie === 'brug' && na.herspeelt === 'brug' && na.brugKlaar === false && na.menu === 'none', 'missie 12 begint opnieuw, met een hele brug', JSON.stringify(na));
ok(na.daarna.missie === 'klaar' && na.daarna.herspeelt === null && na.daarna.brugKlaar === true, 'daarna vrij spelen, en de brug heeft zijn gat weer', JSON.stringify(na.daarna));
ok(na.rijden === 'rijden' && na.naRijden === 'klaar', 'na missie 2 niet door naar missie 3', JSON.stringify(na));

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);

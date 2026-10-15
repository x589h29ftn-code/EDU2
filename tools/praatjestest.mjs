/*
 Proef bij stap 192 (npm run praatjestest): Mark en Johan tussendoor aanspreken. Gevraagd: "Kan je voor missies tussendoor of
 na het spel zorgen dat je Johan en Mark kan vinden. Mark Molenkrite 15. Johan bij zijn huis. Ze geven diverse random dialogen
 als je probeert te praten. Los van het naar voetbal gaan en op de bank zitten."

 1. De gesprekken (js/praatjes.js): genoeg, met Yugo, GTA 6 in november, de spelletjesavond en de kaasfondue; nooit twee keer
    hetzelfde achter elkaar, ook niet over 200 keer kiezen.
 2. Bij het begin van het spel (missie 1) staan ze er niet.
 3. Tussen twee missies (missie 6 wacht): Mark op de stoep voor Molenkrite 15 en Johan op zijn oprit aan het Kruirad 62, gemeten:
    bij het pand, niet in het water, niet in een botsdoos.
 4. E bij Mark: een praatje van Mark en Erik; acht keer, nooit hetzelfde na elkaar en minstens vijf verschillende. Bij Johan ook.
    De hint "E — praten met …", en `aanspreekbaar` zodat E niet ook een auto instapt.
 5. Als het verhaal ze zelf nodig heeft niet: Johan niet bij missie 5 (dan ijsbeert de Johan van de missie daar), Mark niet met
    een missievlag bij zijn deur (missie 11 wacht binnen).
 6. Na het einde: Johan op zijn oprit, Mark binnen op de bank met als keuze 3 "even kletsen"; daarna staat de keuze weer open.
 7. Ze zijn geen doelwit: een schot op hun borst doet niets.
 8. Geen nieuw shaderprogramma.

 Gebruik: npm run server &  node tools/praatjestest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fouten++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

kop('1. de gesprekken');
{
  const { PRAATJES, kiesPraatje } = await import('../js/praatjes.js');
  const alles = JSON.stringify(PRAATJES);
  ok(PRAATJES.mark.length >= 12 && PRAATJES.johan.length >= 10, 'genoeg praatjes', `Mark ${PRAATJES.mark.length}, Johan ${PRAATJES.johan.length}`);
  ok(['Yugo', 'GTA 6', 'november', 'spelletjesavond', 'kaasfondue'].every(w => alles.includes(w)), 'Yugo, GTA 6 in november, de spelletjesavond, de kaasfondue');
  ok(PRAATJES.mark.every(p => p.every(([w]) => w === 'm' || w === 'e')) && PRAATJES.johan.every(p => p.every(([w]) => w === 'j' || w === 'e')),
    'bij Mark praten Mark en Erik, bij Johan Johan en Erik');
  ok(!alles.includes('—'), 'geen gedachtestreepjes in de gesprekken');
  const recent = []; let vorig = -1, dubbel = 0; const gezien = new Set();
  for (let k = 0; k < 200; k++) { const i = kiesPraatje(PRAATJES.mark, recent); if (i === vorig) dubbel++; vorig = i; gezien.add(i); }
  ok(dubbel === 0 && gezien.size === PRAATJES.mark.length, '200 keer kiezen: nooit twee keer hetzelfde na elkaar, en elk komt aan bod', `${gezien.size} verschillende`);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  window.__W = await import('/js/world.js');
  window.__K = (await import('/js/kaart.js')).KAART;
  g.player.active = false; window.__autoplay = false;
  g.politie.proefStil = true;
  window.__regels = [];
  const tekst = document.getElementById('dialoogTekst');
  const dicht = () => document.getElementById('dialoog').hidden;
  let laatst = '';
  window.__lees = () => { const t = dicht() ? '' : tekst.textContent; if (t && t !== laatst) window.__regels.push(t); laatst = t; };
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); window.__lees(); } };
  window.__klik = (max = 40) => { for (let i = 0; i < max && !dicht(); i++) { window.__lees(); v.toets(); window.__stap(1); } };
  window.__zet = (x, z) => { const P = g.player; if (P.inCar) { P.inCar.speed = 0; P.inCar = null; } P.zit = false; P.pos.set(x, 0, z); P.applyCamera(); };
  window.__E = () => { const was = g.player.active; g.player.active = true; v.toets(); g.player.active = was; window.__lees(); };
  window.__stand = (extra) => {
    const s = v.bewaar(); s.volgende = null;
    Object.assign(s, { noMercyKlaar: true, noMercyGebeld: true, roanKlaar: true }, extra);
    g.politie.reset(); v.herstel(s); window.__stap(2);
  };
  window.__thuisMark = { x: v.praatjes.mark.plek.x, z: v.praatjes.mark.plek.z };
  window.__pand = (straat, nr) => window.__K.panden.find(p => p.straat === straat && (p.nr || []).includes(nr));
});

kop('2. bij het begin');
const begin = await page.evaluate(() => { const v = window.__game.verhaal; window.__stap(4); return { missie: v.missie, p: v.praatjes }; });
ok(begin.missie === 'molenkrite' && !begin.p.mark.zichtbaar && !begin.p.johan.zichtbaar, 'bij missie 1 staan ze er niet (de Mark van de missie staat er al)', begin.missie);

kop('3. tussen twee missies');
const tussen = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, W = window.__W;
  window.__stand({ missie: 'bx', fase: 'wacht' });
  window.__zet(window.__thuisMark.x + 150, window.__thuisMark.z + 150);
  window.__stap(4);
  const p = v.praatjes;
  const meet = (wie, straat, nr) => {
    const q = p[wie], pand = window.__pand(straat, nr);
    const [rx, rz] = W.resolveCollisions(q.x, q.z, 0.3);      // (een rij [x, z])
    const d = pand ? Math.hypot(pand.rect.cx - q.x, pand.rect.cz - q.z) : null;
    return { zichtbaar: q.zichtbaar, d: d && +d.toFixed(1), water: W.pointInWater(q.x, q.z), doos: !(Math.hypot(rx - q.x, rz - q.z) <= 0.01) };
  };
  return { missie: v.missie, fase: v.fase, mark: meet('mark', 'Molenkrite', '15'), johan: meet('johan', 'Kruirad', '62') };
});
for (const [wie, adres] of [['mark', 'Molenkrite 15'], ['johan', 'Kruirad 62']]) {
  const q = tussen[wie];
  ok(q.zichtbaar, `${wie === 'mark' ? 'Mark' : 'Johan'} staat er tussen missie 5 en 6`, `${tussen.missie}/${tussen.fase}`);
  ok(q.d !== null && q.d < 20 && !q.water && !q.doos, `bij ${adres}, niet in het water of een botsdoos`, `${q.d} m van het midden van het pand`);
}

kop('4. praten');
const praat = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const uit = {};
  for (const wie of ['mark', 'johan']) {
    const q = v.praatjes[wie];
    window.__zet(q.x + 2.2, q.z + 1.0);
    window.__stap(4);
    const hint = document.getElementById('hint') ? document.getElementById('hint').textContent : '';
    const aanspreekbaar = v.aanspreekbaar;
    const reeks = [], sprekers = new Set();
    for (let k = 0; k < 8; k++) {
      window.__regels = [];
      window.__E();
      reeks.push(v.praatjes.laatste ? v.praatjes.laatste.i : -1);
      window.__klik();
      for (const r of window.__regels) sprekers.add(r.split(':')[0].trim());
      window.__stap(2);
    }
    uit[wie] = { reeks, aantal: v.praatjes[wie].aantal, aanspreekbaar, eersteRegels: window.__regels.slice(0, 2), dicht: document.getElementById('dialoog').hidden };
  }
  return uit;
});
for (const [wie, naam] of [['mark', 'Mark'], ['johan', 'Johan']]) {
  const q = praat[wie];
  const dubbel = q.reeks.some((i, k) => k > 0 && i === q.reeks[k - 1]);
  ok(q.aanspreekbaar, `naast ${naam}: E is van het gesprek (geen auto instappen)`);
  ok(q.aantal >= 8 && !q.reeks.includes(-1) && q.dicht, `acht keer E: acht praatjes, en het gesprek gaat dicht`, q.reeks.join(' '));
  ok(!dubbel && new Set(q.reeks).size >= 5, 'nooit hetzelfde na elkaar, minstens vijf verschillende', `${new Set(q.reeks).size} verschillende`);
}

kop('5. als het verhaal ze zelf nodig heeft');
const verhaal = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__zet(window.__thuisMark.x + 150, window.__thuisMark.z + 150);
  window.__stand({ missie: 'johan', fase: 'naar_kruirad' });
  window.__stap(6);
  const m5 = { johan: v.praatjes.johan.hoort, zichtbaar: v.praatjes.johan.zichtbaar };
  window.__stand({ missie: 'politieauto', fase: 'wacht' });
  window.__stap(6);
  const nav = g.hud.nav && g.hud.nav.doel;
  const m11 = { mark: v.praatjes.mark.hoort, zichtbaar: v.praatjes.mark.zichtbaar, vlag: nav ? Math.hypot(nav[0] - window.__thuisMark.x, nav[1] - window.__thuisMark.z).toFixed(1) : null };
  return { m5, m11 };
});
ok(!verhaal.m5.johan && !verhaal.m5.zichtbaar, 'bij missie 5 niet op zijn oprit (de Johan van de missie staat daar)');
ok(!verhaal.m11.mark && !verhaal.m11.zichtbaar, 'met de missievlag bij Molenkrite 15 niet op de stoep (Mark wacht binnen)', `vlag ${verhaal.m11.vlag} m van zijn plek`);

kop('6. na het einde');
const einde = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__zet(window.__thuisMark.x + 150, window.__thuisMark.z + 150);
  window.__stand({ missie: 'klaar', fase: 'klaar', huis: 'Koningsspil 20', veteraanKlaar: true, politieautoKlaar: true, brugKlaar: true, schriftKlaar: true,
    raceKlaar: true, schaduwKlaar: true, invalKlaar: true, ronaldKlaar: true, uitzendingKlaar: true, geld: 5000 });
  window.__stap(6);
  const buiten = { mark: v.praatjes.mark.zichtbaar, johan: v.praatjes.johan.zichtbaar };
  for (let t = 0; t < 200 && v.uitje.fase !== 'wacht'; t += 0.5) window.__stap(1, 0.5);
  window.__stap(30);
  const w = g.woningen[0];
  window.__zet(w.plekken.deurBinnen.x, w.plekken.deurBinnen.z); window.__stap(2); window.__klik();
  const voor = v.uitje.fase, keuzes = v.openKeuze;
  window.__regels = [];
  const r = v.kiesHuis(3);
  const tijdens = v.uitje.fase;
  window.__klik();
  return { buiten, voor, keuzes, r, tijdens, na: v.uitje.fase, regels: window.__regels.slice(0, 3), opdracht: document.getElementById('opdracht') ? document.getElementById('opdracht').textContent : '' };
});
ok(einde.buiten.johan && !einde.buiten.mark, 'na het einde: Johan op zijn oprit, Mark niet op de stoep (die zit binnen)', JSON.stringify(einde.buiten));
ok(einde.voor === 'keuze' && Array.isArray(einde.keuzes) && einde.keuzes[2] === 'even kletsen', 'binnen op de bank: keuze 3 is "even kletsen"', JSON.stringify(einde.keuzes));
ok(einde.r && einde.tijdens === 'gesprek' && einde.regels.length >= 2, '3 geeft een praatje van Mark', einde.regels[0] || '');
ok(einde.na === 'keuze' && /3 — even kletsen/.test(einde.opdracht), 'daarna staat de keuze weer open', `${einde.na}: ${einde.opdracht}`);

kop('7. geen doelwit');
const schot = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal, THREE = await import('three');
  // (eerst ver weg: ze verschijnen alleen uit de buurt; binnen bij Mark was je dat)
  // (de keuze open laten en het huis uit lopen: dan gaat het uitje terug naar de vlag, zie js/verhaal.js)
  const q0 = v.praatjes.johan.plek;
  window.__zet(q0.x + 150, q0.z + 150); window.__stap(4);
  const q = v.praatjes.johan;
  window.__zet(q.x + 8, q.z);
  window.__stap(2);
  g.scene.updateMatrixWorld(true);
  const van = new THREE.Vector3(q.x + 4, 1.4, q.z), dir = new THREE.Vector3(q.x, 1.25, q.z).sub(van).normalize();
  g.player.wapens = ['pistool']; g.player.wapenNr = 0; g.player.ammo = 12;
  g.player.shootCb(van, dir);
  window.__stap(10);
  const na = v.praatjes.johan;
  return { zichtbaar: na.zichtbaar, hoort: na.hoort, voor: q.zichtbaar, verschoven: Math.hypot(na.x - q.x, na.z - q.z), sterren: g.politie.sterren };
});
ok(schot.zichtbaar && schot.verschoven < 0.05, 'een schot op Johan doet niets', JSON.stringify(schot));

kop('8. geen nieuw shaderprogramma');
const sh = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal, R = g.renderer;
  for (let i = 0; i < 600 && !(R.info.programs && R.info.programs.length > 20); i++) await new Promise(r => setTimeout(r, 100));
  // (Johan: de stand is nog die van na het einde, en dan staat Mark binnen)
  const m = v.praatjes.johan;
  // hetzelfde beeld eerst zonder Johan (de tegenproef: wat daar verder staat), dan met
  const fig = g.scene.children.find(o => o.position && Math.hypot(o.position.x - m.x, o.position.z - m.z) < 0.01 && o.visible);
  g.camera.position.set(m.x + 3, 1.7, m.z + 1); g.camera.lookAt(m.x, 1.2, m.z); g.camera.updateMatrixWorld(true);
  if (fig) fig.visible = false;
  R.render(g.scene, g.camera);
  const voor = R.info.programs.length;
  if (fig) fig.visible = true;
  R.render(g.scene, g.camera);
  return { voor, na: R.info.programs.length, mark: m.zichtbaar, gevonden: !!fig, hoort: m.hoort };
});
ok(sh.mark && sh.gevonden && sh.na === sh.voor, 'Johan tekenen vertaalt niets nieuws (hetzelfde beeld zonder en met hem)', `${sh.voor} → ${sh.na}, ${JSON.stringify({ mark: sh.mark, gevonden: sh.gevonden, hoort: sh.hoort })}`);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);

/*
 Toetst No Mercy 4 (stap 140): de bijmissie na missie 5 waarin Erik figureert als Amerikaanse soldaat in
 het Tinga-bos (js/nomercy.js, het blok "No Mercy 4" in js/verhaal.js).

 1. Vóór het einde van missie 5 geen EJ; erna het speldje bij de waterzuivering, missie 6 met zijn M.
 2. 30 s na missie 5 belt Erik Jan, niet eerder, en niet tijdens een klus (daarna wel).
 3. Het gesprek bij het speldje: de M1 en 200 patronen in bruikleen, het uniform, missie 6 wacht.
 4. De set rond (−150,8, −180,6): de Flak op de grond, niet in een boom of een botsdoos, in het bos.
 5. De cameraman loopt mee (< 8 m), de C4, de knal.
 6. Vier Duitsers: ze schieten, maar de speler verliest geen leven; elk gaat neer na zijn eigen 1 tot 3 treffers.
 7. Het bos uit, vijf erbij, neer, en (stap 141) geen "Cut!" maar "nu de tweede take!": het bunkerdorp. Het einde,
    de keuze en het opruimen daarna staan in tools/nomercy2test.mjs, net als 8 (met een eigen M1).
 9. Mislukken (te ver weg, X), neergaan en laden ruimen op; de tussenpoos naar een missie staat stil en loopt daarna.
 10. Opslaan: niet tijdens de opnames, en `noMercyKlaar` in de opslag.
 11. Geen nieuwe shader als de set in beeld komt.

 Gebruik: npm run server &   node tools/nomercytest.mjs 8123
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const r1 = (x) => Math.round(x * 10) / 10;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
let soortenKlaar = false;
page.on('console', m => { if (/^soorten:/.test(m.text())) soortenKlaar = true; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const { KAART } = await import('/js/kaart.js');
  const V = await import('/js/viaduct.js');
  for (let n = 1; n <= 15; n++) localStorage.removeItem(n === 1 ? 'tinga.spel.v1' : `tinga.spel.v1.${n}`);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  g.sfeer.uur = 14;
  window.__W = W; window.__KAART = KAART; window.__V = V;
  window.__meld = [];
  const echt = g.hud.melding.bind(g.hud);
  g.hud.melding = (k, o, t) => { window.__meld.push(`${k}|${o}`); return echt(k, o, t); };
  // (zonder het leven aan te vullen: de proef kijkt of de Duitsers schade doen)
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) v.update(dt); };
  window.__dicht = () => document.getElementById('dialoog').hidden;
  window.__klik = (max = 40) => {
    for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); }
  };
  window.__zet = (x, z) => {
    g.player.inCar = null;
    const [rx, rz] = W.resolveCollisions(x, z, 0.4);
    g.player.pos.set(rx, 0, rz); g.player.applyCamera();
  };
  // lopen naar een punt, beeld voor beeld; levert de grootste afstand tot de cameraman (na de eerste twee tellen)
  window.__loop = (x, z, v0 = 4.5, max = 60) => {
    const P = g.player;
    let groot = 0, t = 0;
    while (t < max) {
      const dx = x - P.pos.x, dz = z - P.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.6) break;
      const s = Math.min(d, v0 * 0.05);
      P.yaw = Math.atan2(-dx, -dz);
      const [rx, rz] = W.resolveCollisions(P.pos.x + dx / d * s, P.pos.z + dz / d * s, 0.4);
      P.pos.set(rx, 0, rz); P.applyCamera();
      v.update(0.05); t += 0.05;
      const c = v.noMercy.cam.groep;
      if (t > 2 && c.visible) groot = Math.max(groot, Math.hypot(c.position.x - rx, c.position.z - rz));
      const f = v.noMercy.fase;
      if (!['naarSet', 'wegkomen', 'golf2', 'weg'].includes(f)) break;
    }
    return { groot, t };
  };
  // een Duitser raken tot hij ligt: hoeveel treffers
  window.__neerMet = (w) => {
    let n = 0;
    while (w.staat !== 'neer' && n < 10) { if (v.raak(w.persoon.groep.children[0], 99)) n++; else break; window.__stap(1); }
    return n;
  };
  // de stand na missie 5: missie 5 op 'terug', bij Johan, het gesprek door
  window.__naMissie5 = () => {
    const s = v.bewaar(); s.missie = 'johan'; s.fase = 'terug'; s.volgende = null; s.noMercyKlaar = false; s.noMercyGebeld = false;
    v.herstel(s); v.__geenVolgende(); g.politie.reset();
    const doel = g.hud.nav && g.hud.nav.doel;
    window.__zet(doel[0] + 1, doel[1] + 1);
    window.__stap(3);
    window.__klik();
    window.__stap(2);
  };
});

// ------------------------------------------------------------------ 1. het speldje
kop('1. vóór en na missie 5');
const een = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const s = v.bewaar(); s.missie = 'johan'; s.fase = 'naar_kruirad'; s.noMercyKlaar = false; s.noMercyGebeld = false;
  v.herstel(s); window.__stap(4);
  const voor = { ej: !!g.hud.ej, zichtbaar: v.noMercy.ej.groep.visible };
  window.__naMissie5();
  const nm = v.noMercy, p = nm.ejPlek;
  return { voor, missie: v.missie, fase: v.fase, ej: g.hud.ej, ejZicht: nm.ej.groep.visible, p, belT: nm.belT, nav: g.hud.nav && g.hud.nav.letter };
});
ok(!een.voor.ej && !een.voor.zichtbaar, 'tijdens missie 5 nog geen Erik Jan en geen EJ');
ok(een.missie === 'bx' && een.fase === 'wacht' && een.nav === 'M', 'na missie 5 wacht missie 6 onder zijn M', `${een.missie}/${een.fase}, ${een.nav}`);
ok(!!een.ej && een.ejZicht, 'en Erik Jan staat er, met het EJ-speldje', een.ej ? `${r1(een.ej.x)}, ${r1(een.ej.z)}` : '-');
ok(een.p && Math.hypot(een.p.x + 101.4, een.p.z + 263.5) < 20, 'bij de poort van de waterzuivering (de plek van missie 2)', een.p ? `${r1(Math.hypot(een.p.x + 101.4, een.p.z + 263.5))} m` : '-');
ok(Math.abs(een.belT - 30) < 0.5, 'het telefoontje over 30 s', `${r1(een.belT)} s`);

// ------------------------------------------------------------------ 2. het telefoontje
kop('2. Erik Jan belt');
const twee = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, K = window.__KAART;
  window.__zet(K.start.x, K.start.z);
  const uit = {};
  window.__stap(570);                         // 28,6 s na missie 5 (het klikken hierboven meegeteld)
  uit.na29 = { gebeld: v.noMercy.gebeld, fase: v.noMercy.fase };
  window.__stap(50);                          // 31,1 s
  uit.na31 = { gebeld: v.noMercy.gebeld, fase: v.noMercy.fase };
  window.__stap(50);                          // en de telefoon opnemen
  uit.balk = !window.__dicht() && document.getElementById('dialoogNaam').textContent;
  uit.tekst = document.getElementById('dialoogTekst').textContent;
  window.__klik();
  window.__stap(2);
  uit.nav = g.hud.nav ? { letter: g.hud.nav.letter, naam: g.hud.nav.naam } : null;
  // niet tijdens een klus: opnieuw, met een klus aangenomen
  window.__naMissie5();
  const kl = v.klusjes;
  kl.__soort('tas');
  kl.__nieuwAanbod();
  const a = kl.aanbod;
  window.__zet(a.x + 1.2, a.z); window.__stap(2); v.toets(); window.__klik();
  uit.klus = kl.bezig;
  v.noMercy.zetBelT(0.5);
  window.__stap(200);
  uit.tijdensKlus = v.noMercy.gebeld;
  kl.afbreken();
  window.__zet(K.start.x, K.start.z);
  window.__stap(10);
  uit.naKlus = v.noMercy.gebeld;
  window.__stap(60); window.__klik(); window.__stap(2);
  return uit;
});
ok(!twee.na29.gebeld, 'na 28,6 s nog niet gebeld', JSON.stringify(twee.na29));
ok(twee.na31.gebeld && twee.na31.fase === 'bellen', 'na 31 s gaat de telefoon', JSON.stringify(twee.na31));
ok(twee.balk === 'Erik Jan' && /No Mercy/.test(twee.tekst + ''), 'Erik Jan aan de lijn, over No Mercy', twee.tekst);
ok(twee.nav && twee.nav.letter === 'EJ', 'daarna de navigatie naar hem', JSON.stringify(twee.nav));
ok(twee.klus && !twee.tijdensKlus, 'tijdens een klus belt hij niet');
ok(twee.naKlus, 'na de klus wel');

// ------------------------------------------------------------------ 3. het gesprek en de bruikleen
kop('3. bij Erik Jan');
const drie = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__naMissie5();
  P.wapens = P.wapens.filter(w => w !== 'garand'); P.magazijnen.garand = 0;
  P.reserve = 40; P.zetWapen('pistool');
  const geld = v.geld;
  const p = v.noMercy.ejPlek;
  window.__zet(p.x + 3, p.z + 1);
  window.__stap(2);
  const uit = { fase: v.noMercy.fase, praat: document.getElementById('dialoogNaam').textContent, voorRes: P.reserve };
  uit.opslaan = v.waaromNietOpslaan();
  window.__klik();
  uit.naGesprek = v.noMercy.fase;
  window.__stap(90);           // het zwart: omkleden
  const nm = v.noMercy;
  uit.na = { fase: nm.fase, wapens: P.wapens.slice(), soort: P.wapenSoort, pool: P.reserve + (P.wapenSoort === 'garand' ? P.ammo : P.magazijnen.garand),
    clip: P.ammo, pak: g.derde.pak, opdracht: document.getElementById('opdracht').textContent, nav: g.hud.nav && g.hud.nav.letter,
    missie: v.missie, missieFase: v.fase, opslaan: v.waaromNietOpslaan(), cam: nm.cam.groep.visible, set: nm.set.zichtbaar, geld: v.geld - geld };
  return uit;
});
ok(drie.fase === 'gesprek' && drie.praat === 'Erik Jan', 'het gesprek begint vanzelf bij Erik Jan', drie.fase);
ok(!!drie.opslaan, 'tijdens het gesprek niet opslaan', drie.opslaan);
ok(drie.na.fase === 'naarSet', 'na het omkleden: naar de set', drie.na.fase);
ok(drie.na.wapens.includes('garand') && drie.na.soort === 'garand' && drie.na.clip === 8, 'een M1 Garand in de hand, met een volle clip', drie.na.wapens.join(','));
ok(drie.na.pool - drie.voorRes === 200, '200 patronen erbij', `${drie.voorRes} → ${drie.na.pool}`);
ok(drie.na.pak === 'soldaat', 'in uniform', drie.na.pak);
ok(drie.na.missie === 'bx' && drie.na.missieFase === 'wacht', 'missie 6 wacht gewoon', `${drie.na.missie}/${drie.na.missieFase}`);
ok(drie.na.opslaan === 'tijdens de opnames van No Mercy 4', 'tijdens de opnames niet opslaan', drie.na.opslaan);
ok(drie.na.cam && drie.na.set && drie.na.nav === 'EJ', 'de cameraman staat naast je, de set staat er, de navigatie gaat erheen');

// ------------------------------------------------------------------ 4. de set gemeten
kop('4. de set in het Tinga-bos');
const vier = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, W = window.__W, V = window.__V;
  const nm = v.noMercy, f = nm.set.groep.position;
  let boom = Infinity;
  for (const t of W.treePositions) boom = Math.min(boom, Math.hypot(t.x - f.x, t.z - f.z));
  // botsdozen rond het kanon (behalve zijn eigen doos): op een ring van 3,4 m wordt niets weggeduwd
  const h = nm.doos.h; nm.doos.h = 0;
  let geduwd = 0;
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2;
    for (const r of [1.5, 3.4]) {
      const x = f.x + Math.cos(a) * r, z = f.z + Math.sin(a) * r;
      const [rx, rz] = W.resolveCollisions(x, z, 0.3);
      geduwd = Math.max(geduwd, Math.hypot(rx - x, rz - z));
    }
  }
  nm.doos.h = h;
  // de laagste punt van het kanon tegen de grond
  g.scene.updateMatrixWorld(true);
  let minY = Infinity;
  nm.set.flak.groep.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); minY = Math.min(minY, b.min.y); } });
  return { x: f.x, z: f.z, y: f.y, grond: V.grondHoogte(f.x, f.z), minY, boom, geduwd, inBos: nm.bos.inBos(f.x, f.z), opp: nm.bos.oppervlak, doos: h };
});
ok(Math.hypot(vier.x + 150.8, vier.z + 180.6) < 0.5, 'de Flak staat op de plek uit de foto', `${r1(vier.x)}, ${r1(vier.z)}`);
ok(Math.abs(vier.minY - vier.grond) < 0.05, 'op de grond (de stelvoeten raken het maaiveld)', `onderkant ${vier.minY.toFixed(3)}, grond ${vier.grond.toFixed(3)}`);
ok(vier.boom > 4.5, 'geen boom in het kanon: de dichtstbijzijnde stam', `${r1(vier.boom)} m`);
ok(vier.geduwd < 0.02, 'geen botsdoos in of naast het kanon', `${vier.geduwd.toFixed(3)} m`);
ok(vier.inBos && vier.opp > 15000, 'midden in het Tinga-bos', `bos ${Math.round(vier.opp)} m²`);
ok(vier.doos > 0, 'en het kanon houdt je tegen');

// ------------------------------------------------------------------ 5. lopen, C4, knal
kop('5. met de cameraman naar het kanon, de C4, de knal');
const vijf = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const nm = v.noMercy, f = nm.set.groep.position;
  const loop = window.__loop(f.x + 3, f.z + 9);
  const uit = { loop, fase: v.noMercy.fase };
  window.__klik();
  uit.bom = v.noMercy.fase; uit.merk = v.noMercy.merk.zichtbaar;
  const r = v.noMercy.set.ruit;
  window.__zet(r.x + 0.8, r.z);
  window.__stap(2);
  uit.hint = document.getElementById('praat').hidden === false && document.getElementById('praat').textContent;
  v.toets();
  uit.c4 = v.noMercy.c4.zichtbaar; uit.weg = v.noMercy.fase;
  // wegrennen
  const dx = r.x - f.x, dz = r.z - f.z, d = Math.hypot(dx, dz);
  const l2 = window.__loop(f.x + dx / d * 17, f.z + dz / d * 17);
  uit.l2 = l2;
  window.__stap(40);
  const n2 = v.noMercy;
  uit.knal = { fase: n2.fase, scheef: n2.set.flak.romp.rotation.z, c4: n2.c4.zichtbaar };
  uit.health = g.player.health;
  return uit;
});
ok(vijf.loop.groot > 0 && vijf.loop.groot < 8, 'de cameraman loopt mee', `hoogstens ${r1(vijf.loop.groot)} m achter je, ${r1(vijf.loop.t)} s gelopen`);
ok(vijf.bom === 'bom' && vijf.merk, 'bij het kanon: de gele markering', vijf.bom);
ok(/C4/.test(vijf.hint || ''), 'met de hint om de C4 te plaatsen', vijf.hint);
ok(vijf.c4 && vijf.weg === 'weg', 'E plaatst de C4');
ok(vijf.l2.groot < 8, 'de cameraman ook bij het wegrennen', `${r1(vijf.l2.groot)} m`);
ok(vijf.knal.fase === 'knal' || vijf.knal.fase === 'golf1', 'op afstand de knal', vijf.knal.fase);
ok(vijf.knal.scheef > 0.1 && !vijf.knal.c4, 'het kanon staat scheef, de C4 is weg', `${vijf.knal.scheef.toFixed(2)} rad`);

// ------------------------------------------------------------------ 6. de eerste golf
kop('6. vier Duitsers');
const zes = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__stap(60);
  const nm = v.noMercy;
  const uit = { fase: nm.fase, aantal: nm.golf ? nm.golf.aantal : 0 };
  const golf = nm.golf;
  let schoten = 0;
  for (const w of golf.wachters) { const e = w.persoon.vuur.bind(w.persoon); w.persoon.vuur = () => { schoten++; e(); }; }
  P.health = 100;
  window.__stap(400);       // twintig tellen tussen ze in
  uit.schoten = schoten; uit.health = P.health;
  uit.uniform = golf.wachters.every(w => w.persoon.hoofd.getObjectByName('helm') && w.persoon.wapenSoort === 'garand');
  uit.dichtbij = Math.min(...golf.wachters.map(w => Math.hypot(w.persoon.groep.position.x - P.pos.x, w.persoon.groep.position.z - P.pos.z)));
  uit.treffers = [];
  uit.levens = nm.levens.slice(0, 4);
  for (const w of golf.wachters) uit.treffers.push(window.__neerMet(w));
  window.__stap(3);
  uit.na = v.noMercy.fase;
  uit.uitgang = v.noMercy.uitgang; uit.uitBos = uit.uitgang ? v.noMercy.bos.inBos(uit.uitgang.x, uit.uitgang.z) : null;
  return uit;
});
ok(zes.aantal === 4, 'vier Duitsers', `${zes.aantal}`);
ok(zes.uniform, 'in uniform met een stahlhelm en een M1 Garand');
ok(zes.schoten >= 4, 'ze schieten', `${zes.schoten} schoten in 20 s, de dichtste op ${r1(zes.dichtbij)} m`);
ok(zes.health === 100, 'maar de speler verliest geen leven', `${zes.health}`);
ok(zes.treffers.every((n, i) => n >= 1 && n <= 3 && n === zes.levens[i]), 'elk gaat neer na zijn eigen 1 tot 3 treffers', `${zes.treffers.join(', ')} (gegeven ${zes.levens.join(', ')})`);
ok(zes.na === 'wegkomen' && zes.uitgang && zes.uitBos === false, 'daarna: het bos uit, naar een plek buiten het bos', zes.uitgang ? `${r1(zes.uitgang.d)} m` : '-');

// ------------------------------------------------------------------ 7. de tweede golf en het einde
kop('7. vijf erbij, de tweede take');
const zeven = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const u = v.noMercy.uitgang;
  const geld = v.geld;
  const res = { voor: P.reserve };
  const l = window.__loop(u.x, u.z, 4.5, 40);
  res.loop = l;
  res.gehaald = Math.hypot(P.pos.x - u.x, P.pos.z - u.z);
  if (res.gehaald > 1.5) { window.__zet(u.x, u.z); window.__stap(2); }
  const nm = v.noMercy;
  res.fase = nm.fase; res.aantal = nm.golf ? nm.golf.aantal : 0;
  res.treffers = []; res.levens = nm.levens.slice(4, 9);
  for (const w of nm.golf.wachters.slice(4)) res.treffers.push(window.__neerMet(w));
  window.__loop(u.x + (u.x - P.pos.x) * 0.1, u.z + (u.z - P.pos.z) * 0.1, 4.5, 40);
  window.__stap(70);
  res.buiten = !v.noMercy.bos.inBos(P.pos.x, P.pos.z);
  res.take = v.noMercy.fase;
  res.spreker = document.getElementById('dialoogNaam').textContent;
  res.zin = document.getElementById('dialoogTekst').textContent;
  window.__klik();
  window.__stap(4);
  const n2 = v.noMercy;
  res.na = { fase: n2.fase, klaar: n2.klaar, geld: v.geld - geld, wapens: P.wapens.slice(), pak: g.derde.pak,
    melding: window.__meld.slice(-2).join(' / ') };
  // het zwart ("Even later, dieper in het bos…"), dan het bunkerdorp
  window.__stap(100);
  const n3 = v.noMercy;
  res.kamp = { fase: n3.fase, kamp: n3.kamp.zichtbaar, set: n3.set.zichtbaar, golf: n3.golf ? n3.golf.aantal : 0 };
  v.klusAfbreken(); window.__stap(2);
  return res;
});
ok(zeven.aantal === 9, 'onderweg komen er vijf bij', `${zeven.aantal - 4} (na ${r1(zeven.loop.t)} s lopen)`);
ok(zeven.loop.groot < 8, 'de cameraman loopt mee het bos uit', `${r1(zeven.loop.groot)} m`);
ok(zeven.gehaald < 1.5, 'de plek buiten het bos is te voet te halen', `${r1(zeven.gehaald)} m ervandaan na ${r1(zeven.loop.t)} s`);
ok(zeven.treffers.every((n, i) => n >= 1 && n <= 3 && n === zeven.levens[i]), 'ook die gaan neer na 1 tot 3 treffers', zeven.treffers.join(', '));
ok(zeven.buiten && zeven.take === 'take2' && zeven.spreker === 'Erik Jan' && /tweede take/.test(zeven.zin), 'buiten het bos (stap 141): "Goed zo — nu de tweede take!"', `${zeven.take}: ${zeven.zin}`);
ok(zeven.na.geld === 0 && !zeven.na.klaar && zeven.na.wapens.includes('garand') && zeven.na.pak === 'soldaat', 'nog geen geld, de M1 en het uniform houd je aan', `${zeven.na.geld}`);
ok(!/MISSIE GESLAAGD/.test(zeven.na.melding), 'en nog geen MISSIE GESLAAGD', zeven.na.melding);
ok(zeven.kamp.fase === 'kampIntro' && zeven.kamp.kamp && !zeven.kamp.set && zeven.kamp.golf === 2, 'na het zwart: het bunkerdorp, met twee schildwachten (verder: npm run nomercy2test)', JSON.stringify(zeven.kamp));

// (8, met een eigen M1, staat sinds stap 141 in tools/nomercy2test.mjs: het einde is daar)

// ------------------------------------------------------------------ 9. mislukken, neergaan, laden, de tussenpoos
kop('9. mislukken, neergaan, laden, X');
const negen = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const r1 = (x) => Math.round(x * 10) / 10;
  const leeg = () => { const n = v.noMercy; return !n.set.zichtbaar && !n.golf && n.duitsers.every(p => !p.groep.visible) && !n.cam.groep.visible && !P.wapens.includes('garand') && g.derde.pak === 'gewoon'; };
  const naarGolf = () => {
    v.startNoMercy(); window.__klik(); window.__stap(90);
    const f = v.noMercy.set.groep.position;
    window.__zet(f.x + 2, f.z + 9); window.__stap(3); window.__klik();
    const r = v.noMercy.set.ruit; window.__zet(r.x + 0.8, r.z); window.__stap(1); v.toets();
    window.__zet(f.x + 18, f.z + 6); window.__stap(100);
    return v.noMercy.fase;
  };
  const uit = {};
  P.wapens = P.wapens.filter(w => w !== 'garand'); P.magazijnen.garand = 0; P.reserve = 40; P.zetWapen('pistool');
  // te ver weg
  window.__naMissie5();
  v.startNoMercy(); window.__klik(); window.__stap(90);
  window.__zet(-150.8 + 200, -180.6); window.__stap(3);
  uit.ver = { leeg: leeg(), fase: v.noMercy.fase, meld: window.__meld.slice(-1)[0], reserve: P.reserve };
  window.__stap(60);
  uit.ver.pin = !!g.hud.ej;
  // neergaan in het gevecht
  uit.golfDood = naarGolf();
  window.__autoplay = true;
  v.dood(); window.__stap(80);
  window.__autoplay = false;
  uit.dood = { leeg: leeg(), fase: v.noMercy.fase };
  // X
  g.player.active = true;
  window.__naMissie5();
  naarGolf();
  const ej = v.noMercy.ejPlek; window.__zet(ej.x + 2, ej.z + 1);
  uit.x = v.klusAfbreken();
  uit.xLeeg = leeg();
  window.__stap(20);
  uit.xNiet = v.noMercy.fase === 'wacht' && window.__dicht();
  window.__zet(ej.x + 20, ej.z + 20); window.__stap(2); window.__zet(ej.x + 2, ej.z + 1); window.__stap(2);
  uit.xWel = v.noMercy.fase === 'gesprek';
  window.__klik(); window.__stap(90); v.klusAfbreken(); window.__stap(2);
  // laden midden in het gevecht
  window.__naMissie5();
  const s = v.bewaar();
  naarGolf();
  v.herstel(s); window.__stap(2);
  const n = v.noMercy;
  uit.laden = { set: n.set.zichtbaar, golf: !!n.golf, duitsers: n.duitsers.filter(p => p.groep.visible).length, fase: n.fase, pak: g.derde.pak };
  // de tussenpoos naar een missie staat stil tijdens de opnames
  const k = v.bewaar(); k.missie = 'klaar'; k.fase = 'klaar'; k.volgende = null; v.herstel(k);
  v.stap128.zetWacht('huis', 5);
  window.__stap(2);
  v.startNoMercy(); window.__klik(); window.__stap(90);
  window.__stap(200);
  uit.wacht = { missie: v.missie, volgende: v.volgendeMissie && v.volgendeMissie.naam };
  v.klusAfbreken(); window.__stap(2);
  uit.daarna = { na: v.volgendeMissie && r1(v.volgendeMissie.over), fase: v.noMercy.fase, dicht: window.__dicht(), klus: v.klusjes.bezig };
  window.__stap(158);
  uit.daarna.missie = v.missie; uit.daarna.over = v.volgendeMissie && v.volgendeMissie.over;
  return uit;
});
ok(negen.ver.leeg && /MISLUKT/.test(negen.ver.meld || '') && negen.ver.reserve === 40, 'te ver van de set: mislukt, alles weg, de bruikleen terug', negen.ver.meld);
ok(negen.ver.pin, 'en het EJ-speldje staat er weer');
ok(negen.golfDood === 'golf1' && negen.dood.leeg, 'neergaan in het gevecht ruimt op', JSON.stringify(negen.dood));
ok(negen.x === true && negen.xLeeg, 'X breekt de opnames af');
ok(negen.xNiet && negen.xWel, 'naast Erik Jan begint het gesprek pas weer als je even weg bent geweest');
ok(!negen.laden.set && !negen.laden.golf && negen.laden.duitsers === 0 && negen.laden.pak === 'gewoon', 'laden ruimt de set op', JSON.stringify(negen.laden));
ok(negen.wacht.missie === 'klaar' && negen.wacht.volgende === 'huis', 'de tussenpoos naar missie 9 telt niet af tijdens de opnames', JSON.stringify(negen.wacht));
ok(negen.daarna.missie === 'huis', 'en loopt daarna gewoon af', JSON.stringify(negen.daarna));

// ------------------------------------------------------------------ 10. opslaan
kop('10. opslaan');
const tien = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  const s = v.bewaar(); s.missie = 'bx'; s.fase = 'wacht'; s.noMercyKlaar = true; s.noMercyGebeld = true;
  v.herstel(s); window.__stap(4);
  return { pin: !!g.hud.ej, ej: v.noMercy.ej.groep.visible, klaar: v.noMercy.klaar };
});
ok(tien.klaar && !tien.pin && !tien.ej, 'een opslag met noMercyKlaar: geen Erik Jan meer');

// ------------------------------------------------------------------ 11. shaders
kop('11. geen nieuwe shader');
await page.evaluate(() => window.__game.reliëfAf());
for (let i = 0; i < 1800 && !soortenKlaar; i++) await new Promise(r => setTimeout(r, 200));
const elf = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, R = g.renderer, P = g.player;
  if (!R) return { overgeslagen: true };
  window.__naMissie5();
  const S = { x: -150.8, z: -180.6 };
  const kijk = () => {
    P.inCar = null; P.pos.set(S.x + 4, 0, S.z + 12); P.yaw = Math.atan2(-(S.x - P.pos.x), -(S.z - P.pos.z)); P.pitch = 0; P.applyCamera();
    g.scene.updateMatrixWorld(true); R.render(g.scene, P.camera);
  };
  kijk();
  const voor = R.info.programs.length;
  v.startNoMercy(); window.__klik(); window.__stap(90);
  const f = v.noMercy.set.groep.position;
  window.__zet(f.x + 2, f.z + 9); window.__stap(3); window.__klik();
  const r = v.noMercy.set.ruit; window.__zet(r.x + 0.8, r.z); window.__stap(1); v.toets();
  window.__zet(f.x + 18, f.z + 6); window.__stap(36);
  kijk();
  window.__stap(60);
  kijk();
  const na = R.info.programs.length;
  v.klusAfbreken();
  return { voor, na, golf: !!v.noMercy };
});
if (elf.overgeslagen) ok(false, 'geen renderer in __game');
else ok(elf.na === elf.voor, 'de set, de knal en de Duitsers vertalen geen nieuwe shader', `${elf.voor} → ${elf.na} programma's (soorten vooraf: ${soortenKlaar ? 'klaar' : 'niet gezien'})`);

await browser.close();
console.log(fouten ? `\n${fouten} fout` : '\nalles goed');
process.exit(fouten ? 1 : 0);

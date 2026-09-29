/*
 Overgangen: laden, een nieuwe missie en een geparkeerde auto (stap 102, na missie 16).

   node tools/server.mjs 8123 &   node tools/overgangtest.mjs [poort]   (npm run overgangtest)

 Bij missie 16 kwamen drie fouten uit dezelfde hoek: iets van vóór een overgang liep erna door.

 1. Na missie 12, 14 en 16 telt een klokje een paar tellen af tot het zwart ("Een paar dagen
    later", "De volgende ochtend"), en halverwege dat zwart springt de klok en sta je voor je huis.
    Laden, of een nieuwe missie beginnen, stopte dat niet: de ochtend van de vorige missie sprong
    midden in de geladen. Nu zet `stopNaloop` in js/verhaal.js alles op nul.
 2. En een tegenproef: zonder laden komt die ochtend wel (anders meet 1 niets).
 3. `vehicles.zetNeer` op een geparkeerde auto uit de stapel (die heeft geen eigen model) viel om
    op `mesh.position`; nu krijgt hij het losse model, zoals bij instappen met E.
 4. Missie 16 "Die nacht…" met zo'n auto: geen fout, de auto op het dek, en je wapen weg.
 0. En vooraf: geen functienaam twee keer in js/verhaal.js (missie 15 had die van missie 12).
*/
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

// ------------------------------------------------------------------ 0. één bereik, dus unieke namen
/*
 js/verhaal.js is één grote functie. Een tweede `function` met dezelfde naam wint stil (hoisting):
 in stap 89 namen `beginGevecht` en `naarDeC4` zo die van missie 10 en 11 over, en van stap 96 tot
 102 reed missie 12 na het plan de avond van missie 15 in (`naarDeAvond`). Dit leest alleen het
 bestand, dus het draait voordat de browser er is.
*/
kop('unieke functienamen');
for (const bestand of ['js/verhaal.js', 'js/main.js']) {
  const bron = readFileSync(new URL(`../${bestand}`, import.meta.url), 'utf8');
  const tel = new Map();
  for (const m of bron.matchAll(/^\s*(?:async\s+)?function\s+([\p{L}\p{N}_$]+)/gmu)) tel.set(m[1], (tel.get(m[1]) || 0) + 1);
  const dubbel = [...tel].filter(([, n]) => n > 1).map(([k]) => k);
  ok(dubbel.length === 0, `${bestand}: geen functie twee keer`, dubbel.length ? dubbel.join(', ') : `${tel.size} namen`);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
  // een opgeslagen spel tussen de missies door, om 15:00 voor de deur
  g.sfeer.uur = 15;
  const s = v.bewaar(); s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
  window.__s0 = s;
  window.__terug = () => { v.herstel(window.__s0); v.__geenVolgende && v.__geenVolgende(); g.sfeer.uur = 15; };
  window.__terug();
});

// ------------------------------------------------------------------ 1. laden tijdens het klokje
kop('laden na een missie');
for (const soort of ['brug', 'race', 'inval']) {
  const r = await page.evaluate((soort) => {
    const g = window.__game, v = g.verhaal, pl = g.player;
    window.__terug();
    const p0 = { x: pl.pos.x, z: pl.pos.z };
    // (a) het klokje loopt af en het zwart is begonnen, maar nog niet gesprongen: dan laden
    v.zetNaloop(soort, 0.3);
    window.__stap(16);
    const zwartVoor = v.naloop.zwart;
    window.__terug();
    const na = v.naloop;
    window.__stap(200);
    const a = { zwartVoor, leeg: !na.zwart && !na.brug && !na.race && !na.inval, uur: g.sfeer.uur,
      weg: Math.hypot(pl.pos.x - p0.x, pl.pos.z - p0.z) };
    // (b) het klokje loopt nog: meteen laden
    v.zetNaloop(soort, 3);
    window.__terug();
    window.__stap(200);
    const b = { uur: g.sfeer.uur, weg: Math.hypot(pl.pos.x - p0.x, pl.pos.z - p0.z), zwart: v.naloop.zwart };
    return { a, b };
  }, soort);
  ok(r.a.zwartVoor && r.a.leeg, `${soort}: laden in het zwart stopt het zwart en het klokje`);
  ok(Math.abs(r.a.uur - 15) < 0.05 && r.a.weg < 1, `${soort}: en daarna springt er niets`, `${r.a.uur.toFixed(2)} uur, ${r.a.weg.toFixed(1)} m`);
  ok(Math.abs(r.b.uur - 15) < 0.05 && r.b.weg < 1 && !r.b.zwart, `${soort}: laden terwijl het klokje nog loopt ook`, `${r.b.uur.toFixed(2)} uur, ${r.b.weg.toFixed(1)} m`);
}

// ------------------------------------------------------------------ 1b. een nieuwe missie
kop('een nieuwe missie');
const nieuw = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__terug();
  v.zetNaloop('race', 2);
  v.startMissie('schaduw');
  const na = v.naloop;
  window.__stap(160);
  const uit = { leeg: !na.race && !na.zwart, uur: g.sfeer.uur, missie: v.missie };
  window.__terug();
  return uit;
});
ok(nieuw.leeg && Math.abs(nieuw.uur - 15) < 0.05, 'missie 15 los starten vlak na de race: geen ochtend ertussen', `${nieuw.uur.toFixed(2)} uur, ${nieuw.missie}`);

// ------------------------------------------------------------------ 2. de tegenproef
kop('zonder laden');
const tegen = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__terug();
  v.zetNaloop('race', 0.2);
  window.__stap(200);
  const uur = g.sfeer.uur;
  window.__stap(60);
  window.__terug();
  return { uur };
});
ok(Math.abs(tegen.uur - 9.5) < 0.1, 'zonder laden komt "De volgende ochtend" na de race wel', `${tegen.uur.toFixed(2)} uur`);

// ------------------------------------------------------------------ 3. een geparkeerde auto
kop('een geparkeerde auto verplaatsen');
const park = await page.evaluate(() => {
  const g = window.__game, vh = g.vehicles;
  const vrij = vh.cars.filter(c => c.inst && !c.mesh && c.driveable && !c.wrak);
  const c = vrij[0];
  if (!c) return { geen: true, n: 0 };
  c.x += 0.5;
  let fout = null;
  try { vh.zetNeer(c, 0, c.yaw); } catch (e) { fout = e.message; }
  return { n: vrij.length, fout, model: !!(c.mesh && c.mesh.userData.wielen),
    d: c.mesh ? Math.hypot(c.mesh.position.x - c.x, c.mesh.position.z - c.z) : null, instantieWeg: c.zichtbaar === false };
});
ok(!park.geen, 'er staan geparkeerde auto\'s zonder eigen model', `${park.n}`);
ok(!park.fout && park.model && park.d < 0.01, 'zetNeer geeft er een het losse model, op zijn plek', park.fout || `${park.d && park.d.toFixed(3)} m`);
ok(park.instantieWeg, 'en de instantie in de stapel is weg (geen twee auto\'s op elkaar)');

// ------------------------------------------------------------------ 4. missie 16 met zo'n auto
kop('missie 16: "Die nacht…" in een geparkeerde auto');
const nacht = await page.evaluate(async () => {
  const g = window.__game, v = g.verhaal, pl = g.player;
  const V = await import('/js/viaduct.js');
  window.__terug();
  const c = g.vehicles.cars.find(k => k.inst && !k.mesh && k.driveable && !k.wrak);
  if (!c) return { geen: true };
  pl.inCar = c;
  pl.wapenUit = false;
  let fout = null;
  try {
    const s = v.bewaar(); s.missie = 'inval'; s.fase = 'brugFilm'; s.invalKeus = 2; s.invalKlaar = false;
    g.politie.reset();
    v.herstel(s);
    window.__stap(4);
  } catch (e) { fout = e.message; }
  const y = c.mesh ? c.mesh.position.y : null, dek = V.grondHoogte(c.x, c.z, Infinity);
  const uit = { fout, model: !!c.mesh, y, dek, wapenWeg: pl.wapenUit === true, film: v.inval.film, fase: v.fase };
  window.__terug();
  return uit;
});
ok(!nacht.geen && !nacht.fout && nacht.model, 'geen fout, en de auto heeft een model', nacht.fout || '');
ok(nacht.y != null && nacht.y > 4.5, 'hij staat op het dek, niet op de N7', `${nacht.y && nacht.y.toFixed(2)} m (dek ${nacht.dek && nacht.dek.toFixed(2)})`);
ok(nacht.wapenWeg && nacht.film === 'brug', 'je wapen is weg, en het filmbeeld op de brug loopt', `${nacht.fase}, ${nacht.film}`);

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);

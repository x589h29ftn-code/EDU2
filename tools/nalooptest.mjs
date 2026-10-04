/*
 Stap 120: missie 6 tot 10 nagelopen op fouten (4 okt 2026, "check nu de volgende 5 missies op foutjes").

   node tools/server.mjs 8123 &   node tools/nalooptest.mjs [poort]   (npm run nalooptest)

 1. Missie 6: een BX van een vorige poging (weggereden na de missie) is bij opnieuw beginnen heel en
    zichtbaar terug op zijn plek; uitgebrand en neergegaan: een nieuwe, groene BX bij VV Sneek en jij ernaast.
 2. Missie 6 in een nieuwe sessie laden: dezelfde auto is de BX, je zit erin, en er staat er geen tweede.
 3. Missie 7: laden bij de M zonder spanningsmuziek; opnieuw beginnen laat geen auto's achter.
 4. Missie 8: opnieuw vanaf 'terug' in de sloep bij de molen, met drie politieboten die echt komen; laden
    van een andere missie ruimt de boten en het schietslot op; het herstelpunt komt uit de opslag.
 5. Missie 9: de gezien-lijst blijft na het laden; geen huis kiezen tijdens een klus; de keuze ook na de
    missie op een aanraakscherm; een cijfer aan de toonbank kiest geen huis.
 6. Neergaan sluit een open gesprek.
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
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
const opzet = async () => {
  await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
  await page.evaluate(() => {
    const g = window.__game, v = g.verhaal;
    window.__autoplay = false;
    g.player.active = true;
    const dicht = () => document.getElementById('dialoog').hidden;
    window.__dicht = dicht;
    window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) { g.player.health = 100; v.update(dt); } };
    window.__klik = (max = 120) => { for (let i = 0; i < max && !dicht(); i++) { v.toets(); window.__stap(2); } };
    window.__laad = (extra) => {
      const s = v.bewaar(); s.volgende = null; s.punt = null;
      Object.assign(s, extra);
      g.politie.reset();
      v.herstel(s);
      window.__stap(2);
    };
    window.__opdracht = () => (document.getElementById('opdracht').hidden ? '' : document.getElementById('opdracht').textContent);
  });
};
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await opzet();
await page.evaluate(() => { localStorage.removeItem('tinga.spel.v1'); localStorage.removeItem('tinga.checkpoint.v1'); });

// ------------------------------------------------------------------ 1. missie 6
kop('missie 6: de BX bij opnieuw beginnen');
const m6 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, V = g.vehicles;
  v.__startMissie('bx');
  window.__stap(2);
  const c = v.__bx.zetNeer();
  const start = { ...v.__bx.start };
  const groen = c.kleur;
  const uit = { start };
  // na missie 6 is hij "weggereden": onzichtbaar en niet te besturen, ergens anders
  c.x += 40; c.mesh.position.x += 40;
  c.mesh.visible = false; c.zichtbaar = false; c.driveable = false;
  v.__startMissie('bx');
  window.__stap(2);
  uit.terug = { zicht: V.isZichtbaar(c), rijdt: c.driveable, d: Math.hypot(c.x - start.x, c.z - start.z), zelfde: v.__bx.zetNeer() === c };
  // uitgebrand tijdens het overspuiten, en neergegaan
  window.__laad({ missie: 'bx', fase: 'spuiten' });
  c.x += 120; c.mesh.position.x += 120;
  V.verf(c, 0xc22a2a);
  P.pos.set(c.x + 200, 0, c.z + 200);     // ver weg van de knal
  V.laatOntploffen(c);
  uit.wrakVoor = !!c.wrak;
  v.__herstartMissie();
  window.__stap(2);
  uit.na = { wrak: !!c.wrak, rijdt: c.driveable, zicht: V.isZichtbaar(c), groen: c.kleur === groen,
    d: Math.hypot(c.x - start.x, c.z - start.z), fase: v.fase, speler: Math.hypot(P.pos.x - c.x, P.pos.z - c.z),
    spanning: v.spanning, opdracht: window.__opdracht() };
  return uit;
});
ok(m6.terug.zicht && m6.terug.rijdt && m6.terug.d < 0.1 && m6.terug.zelfde, 'een weggereden BX staat bij opnieuw beginnen heel op zijn plek', JSON.stringify(m6.terug));
ok(m6.wrakVoor && !m6.na.wrak && m6.na.rijdt && m6.na.zicht, 'uitgebrand en neergegaan: weer een hele BX', JSON.stringify({ wrak: m6.na.wrak, rijdt: m6.na.rijdt }));
ok(m6.na.groen && m6.na.d < 0.1 && m6.na.fase === 'ophalen', 'groen, bij VV Sneek, en weer ophalen', `${m6.na.fase}, ${m6.na.d.toFixed(2)} m`);
ok(m6.na.speler < 6 && m6.na.spanning && /ophalen|BX/i.test(m6.na.opdracht), 'je staat ernaast, met muziek en een opdracht', `${m6.na.speler.toFixed(1)} m · ${m6.na.opdracht}`);

// ------------------------------------------------------------------ 2. missie 6 in een nieuwe sessie
kop('missie 6 laden in een nieuwe sessie');
const voor = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__laad({ missie: 'bx', fase: 'spuiten' });
  const c = v.bx;
  P.inCar = c; P.pos.set(c.x, 0, c.z);
  P.active = true;
  g.opslaan();
  return { x: c.x, z: c.z, opslag: !!localStorage.getItem('tinga.spel.v1'), index: g.vehicles.cars.indexOf(c) };
});
ok(voor.opslag, 'opgeslagen in de BX', `index ${voor.index}`);
await page.reload({ waitUntil: 'load', timeout: 900000 });
await opzet();
const na = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  P.active = true;
  g.laden();
  window.__stap(2);
  const c = v.bx;
  const buren = g.vehicles.cars.filter(a => a !== c && Math.hypot(a.x - c.x, a.z - c.z) < 1.5 && g.vehicles.isZichtbaar(a)).length;
  return { inBX: !!c && P.inCar === c, soort: c && c.soort, buren, fase: v.fase, x: c && c.x, z: c && c.z, index: g.vehicles.cars.indexOf(c) };
});
ok(na.inBX && na.soort === 'bx', 'na het laden zit je in de BX', `${na.soort}, index ${na.index}`);
ok(na.buren === 0, 'en er staat geen tweede auto op dezelfde plek', `${na.buren} buren`);
ok(Math.hypot(na.x - voor.x, na.z - voor.z) < 0.5, 'op de plek van de opslag');

// ------------------------------------------------------------------ 3. missie 7
kop('missie 7: muziek en auto\'s');
const m7 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__laad({ missie: 'bom', fase: 'instappen' });
  const uit = { fase: v.fase, spanning: v.spanning };
  window.__laad({ missie: 'bom', fase: 'vluchten' });
  const n1 = g.vehicles.cars.length;
  for (let i = 0; i < 3; i++) window.__laad({ missie: 'bom', fase: 'vluchten' });
  uit.autos = [n1, g.vehicles.cars.length];
  return uit;
});
ok(m7.fase === 'wacht' && !m7.spanning, 'laden bij de M: zonder spanningsmuziek', `${m7.fase}, spanning ${m7.spanning}`);
ok(m7.autos[1] <= m7.autos[0], 'drie keer opnieuw: er komen geen auto\'s bij', `${m7.autos[0]} → ${m7.autos[1]}`);

// ------------------------------------------------------------------ 4. missie 8
kop('missie 8: terug, de boten en het opruimen');
const m8 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const B = g.boten;
  const uit = {};
  window.__laad({ missie: 'sniper', fase: 'terug' });
  const sloep = B.ruw(0), plek = v.snipPlek;
  uit.fase = v.fase;
  uit.boten = v.snipBoten.length;
  uit.aanBoord = B.inBoot === sloep;
  uit.bijMolen = plek ? Math.hypot(sloep.x - plek.boot.x, sloep.z - plek.boot.z) : -1;
  uit.punt = v.punt && v.punt.fase;
  // (de opdracht noemt de waterpolitie meteen; wachten tot er echt een boot op het water is)
  for (let i = 0; i < 400 && !v.snipBoten.some(b => b.actief); i++) window.__stap(1, 0.05);
  uit.politie = window.__opdracht();
  uit.actief = v.snipBoten.filter(b => b.actief).length;
  // een andere missie laden ruimt het op, ook het schietslot van het meekijken
  P.vuurSlot = true;
  window.__laad({ missie: 'johan', fase: 'naar_kruirad' });
  // (van boord gaan doet js/opslag.js bij echt laden, via `boten.herstel`; deze proef laadt alleen het verhaal)
  uit.naLaden = { boten: v.snipBoten.length, vuurSlot: P.vuurSlot };
  // het herstelpunt uit de opslag, en geen oud punt
  window.__laad({ missie: 'sniper', fase: 'varen', punt: { missie: 'sniper', fase: 'vuurgevecht' } });
  uit.puntUitOpslag = v.punt && v.punt.fase;
  window.__laad({ missie: 'sniper', fase: 'varen', punt: null });
  uit.puntZonder = v.punt && v.punt.fase;
  return uit;
});
ok(m8.fase === 'terug' && m8.punt === 'terug', 'opnieuw vanaf terug', `${m8.fase}, punt ${m8.punt}`);
ok(m8.aanBoord && m8.bijMolen >= 0 && m8.bijMolen < 3, 'in de sloep bij de molen', `${m8.bijMolen.toFixed(1)} m van de plek`);
ok(m8.boten === 3, 'met drie politieboten', String(m8.boten));
ok(/waterpolitie/.test(m8.politie) && m8.actief > 0, 'die ook echt komen', `${m8.actief} actief · ${m8.politie}`);
ok(m8.naLaden.boten === 0 && !m8.naLaden.vuurSlot, 'een andere missie laden ruimt de boten en het schietslot op', JSON.stringify(m8.naLaden));
ok(m8.puntUitOpslag === 'vuurgevecht', 'het herstelpunt komt uit de opslag', String(m8.puntUitOpslag));
ok(m8.puntZonder === 'varen', 'zonder punt in de opslag: de fase van nu, geen oud punt', String(m8.puntZonder));

// ------------------------------------------------------------------ 5. missie 9
kop('missie 9: gezien, klus, keuze, toonbank');
const m9 = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const uit = {};
  window.__laad({ missie: 'huis', fase: 'kiezen', aanbod: true, huis: null, gezien: ['Zeskanter 16', 'Koningsspil 20'] });
  uit.gezien = v.huisGezien;
  uit.keuze = v.openKeuze;
  // tijdens een klus geen huis kiezen
  const K = v.klusjes;
  let nep = false;
  try { Object.defineProperty(K, 'bezig', { configurable: true, get: () => true }); nep = K.bezig === true; } catch { nep = false; }
  uit.nep = nep;
  if (nep) {
    uit.kiesTijdensKlus = v.kiesHuis(1);
    uit.keuzeTijdensKlus = v.openKeuze;
    delete K.bezig;
  }
  // een cijfer aan de toonbank kiest geen huis
  const opdrachtVoor = window.__opdracht();
  const toets = g.boerderij.toets;
  g.boerderij.toets = () => true;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', bubbles: true, cancelable: true }));
  uit.naToonbank = window.__opdracht();
  g.boerderij.toets = toets;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2', bubbles: true, cancelable: true }));
  uit.naCijfer = window.__opdracht();
  uit.opdrachtVoor = opdrachtVoor;
  // na de missie, het aanbod nog open: ook dan knoppen
  window.__laad({ missie: 'klaar', fase: 'klaar', aanbod: true, huis: null });
  uit.keuzeNa = v.openKeuze;
  return uit;
});
ok(m9.gezien.includes('Zeskanter 16') && m9.gezien.includes('Koningsspil 20'), 'de woningen die je al zag blijven gezien', m9.gezien.join(', '));
ok(Array.isArray(m9.keuze) && m9.keuze.length === 3, 'drie keuzes', JSON.stringify(m9.keuze));
if (m9.nep) {
  ok(m9.kiesTijdensKlus === false && m9.keuzeTijdensKlus === null, 'tijdens een klus kies je geen huis', `${m9.kiesTijdensKlus}, ${JSON.stringify(m9.keuzeTijdensKlus)}`);
} else ok(false, 'tijdens een klus: de klus kon in de proef niet nagebootst worden');
ok(!/ga kijken bij/.test(m9.naToonbank) && /ga kijken bij/.test(m9.naCijfer), 'een cijfer aan de toonbank kiest geen huis, daarbuiten wel', `${m9.naToonbank} | ${m9.naCijfer}`);
ok(Array.isArray(m9.keuzeNa) && m9.keuzeNa.length === 3, 'na de missie, aanbod open: de keuze staat ook als knoppen', JSON.stringify(m9.keuzeNa));

// ------------------------------------------------------------------ 6. neergaan
kop('neergaan sluit een gesprek');
const dood = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__laad({ missie: 'johan', fase: 'naar_kruirad' });
  v.zegLosse(['Een zin die blijft hangen.']);
  const open = !window.__dicht();
  v.dood();
  return { open, dichtNa: window.__dicht() };
});
ok(dood.open && dood.dichtNa, 'het gesprek gaat dicht bij het neergaan');

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);

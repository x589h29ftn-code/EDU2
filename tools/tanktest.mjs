/*
 Toetst tankstation BP Slump Oil aan de Lemmerweg 63.

 Wat er mis kan gaan, en dus wat hier nagerekend wordt:
 1. de luifel komt uit de BGT (los bouwwerk) en niet uit een schatting: maat en
    plek moeten met dat vlak overeenkomen — en dat vlak mag daarna niet ook nog
    als verhoogde betonplaat op het pompplein liggen;
 2. de pompen en de kolommen staan midden op het pompplein, dus je moet er niet
    doorheen kunnen rijden — ze hebben een botsdoos nodig;
 3. je moet er wél onderdoor kunnen: de luifel hangt op 5,2 m en mag geen
    botsdoos op ooghoogte hebben;
 4. de shop is het pand ernaast en krijgt zijn eigen gevel (bp_shop), niet het
    woningtype van de straat.

 Gebruik: python3 -m http.server 8123 &  node tools/tanktest.mjs 8123
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
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

kop('de luifel komt uit de kaart');
const kaart = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const T = (KAART.tankstations || [])[0];
  if (!T) return null;
  /*
   De BGT-polygoon van het bouwwerk ligt in het tankstation zelf (`ring`) en
   níét meer in `vlakken`: hij is opgegaan in de luifel. Zolang hij ook nog als
   vlak in de kaart stond, lag er midden op het pompplein een verhoogd betonnen
   platform (melding beta-test 12 sep 2026). Het zwaartepunt van die ring moet
   dus op de opgegeven plek liggen, en er mag geen bouwwerk-vlak meer over
   heenliggen.
  */
  const r = T.ring || [];
  let cx = 0, cz = 0; for (const q of r) { cx += q[0]; cz += q[1]; }
  cx /= (r.length || 1); cz /= (r.length || 1);
  const bd = Math.hypot(cx - T.cx, cz - T.cz);
  let restVlak = 0;
  for (const v of KAART.vlakken) {
    if (v.k !== 'bouwwerk') continue;
    const ring = v.r[0];
    let vx = 0, vz = 0; for (const q of ring) { vx += q[0]; vz += q[1]; }
    vx /= ring.length; vz /= ring.length;
    if (Math.hypot(vx - T.cx, vz - T.cz) < 8) restVlak++;
  }
  const pand = KAART.panden.find(p => p.id === T.pand);
  return { T, bd, punten: r.length, restVlak, pandType: pand && pand.type, pandNr: pand && (pand.nr || []).join(',') };
});
ok(!!kaart, 'het tankstation staat in de kaart');
ok(kaart && kaart.bd < 1.0 && kaart.punten >= 4, 'en zijn luifel is het bouwwerk uit de BGT',
  kaart ? `${kaart.bd.toFixed(2)} m van het zwaartepunt, ${kaart.punten} hoekpunten` : '');
ok(kaart && kaart.restVlak === 0, 'dat bouwwerk ligt niet ook nog als verhoogd vlak op het plein',
  kaart ? `${kaart.restVlak} gevonden` : '');
ok(kaart && kaart.T.lengte > 20 && kaart.T.lengte < 30 && kaart.T.breedte > 8 && kaart.T.breedte < 14,
  'met de maat uit de brondata', kaart ? `${kaart.T.lengte} × ${kaart.T.breedte} m` : '');
ok(kaart && kaart.T.eilanden.length >= 2 && kaart.T.eilanden.every(e => e.pompen >= 2),
  'er staan twee pompeilanden met elk twee pompen onder',
  kaart ? kaart.T.eilanden.map(e => `${e.pompen} pompen over ${e.lengte} m`).join(', ') : '');
ok(kaart && kaart.pandType === 'bp_shop', 'de shop ernaast heeft zijn eigen gevel',
  kaart ? `${kaart.pandNr}: ${kaart.pandType}` : '');

kop('je rijdt er onderdoor, niet doorheen');
const bots = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const W = await import('/js/world.js');
  const T = (KAART.tankstations || [])[0];
  // een punt vlak voor een pomp en een punt midden op het plein
  const eil = T.eilanden[0];
  const [ax, az] = T.as;
  const duw = (x, z, straal = 0.9) => {
    const [nx, nz] = W.resolveCollisions(x, z, straal);
    return Math.hypot(nx - x, nz - z);
  };
  // dwars door het eiland heen mikken
  const opPomp = duw(eil.x, eil.z);
  // tussen de eilanden door: daar moet je vrij kunnen rijden
  const midden = duw(T.cx, T.cz);
  // onder de luifel door bij de rand van het plein
  const onderRand = duw(T.cx + ax * (T.lengte / 2 - 1), T.cz + az * (T.lengte / 2 - 1));
  // de prijzenzuil
  const zuil = duw(T.zuil.x, T.zuil.z);
  return { opPomp: +opPomp.toFixed(2), midden: +midden.toFixed(2), onderRand: +onderRand.toFixed(2), zuil: +zuil.toFixed(2) };
});
ok(bots.opPomp > 0.4, 'door een pomp rijd je niet heen', `${bots.opPomp} m weggeduwd`);
ok(bots.zuil > 0.4, 'en door de prijzenzuil ook niet', `${bots.zuil} m weggeduwd`);
ok(bots.midden < 0.05 && bots.onderRand < 0.05, 'maar onder de luifel door kun je gewoon rijden',
  `midden ${bots.midden} m, bij de rand ${bots.onderRand} m`);

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);

/*
 Toetst de scheidingen uit de BGT: muren, hekken, kademuren, damwanden,
 vangrails en balustrades.

 Deze twee lagen (`scheiding` en `weginrichtingselement`) werden overgeslagen
 toen het spel nog alleen Tinga was — er stond toen bijna niets in. Met IJlst en
 Duinterpen erbij is het ruim acht kilometer straatmeubilair.

 Wat er mis kan gaan, en dus wat hier nagerekend wordt:
 1. de zes soorten moeten er allemaal zijn, met een lengte die klopt met de
    brondata (een muur die tot een punt is samengevallen valt hier door);
 2. een muur in de BGT is een vlák, geen lijn. Die wordt teruggebracht tot zijn
    hartlijn; komt daar een lijn uit die langer is dan de muur zelf, dan is de
    projectie fout gegaan;
 3. er moet ook echt iets staan: de meshes moeten hoekpunten hebben. De
    vangrailpaaltjes zijn er eerst uit gevallen omdat ze als doos van een
    millimeter lang werden gebouwd;
 4. te voet loop je er niet doorheen — er hoort een botsdoos te staan;
 5. een vangrail hangt op een halve meter en staat niet op de grond: je moet er
    onderdoor kunnen kijken.

 Gebruik: python3 -m http.server 8123 &  node tools/scheidingtest.mjs 8123
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
await page.evaluate(() => { document.getElementById('overlay').style.display = 'none'; });

kop('de zes soorten staan in de kaart');
const kaart = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const lijst = KAART.scheidingen || [];
  const per = {};
  for (const s of lijst) {
    const q = per[s.soort] = per[s.soort] || { n: 0, m: 0, punten: 0, langste: 0 };
    q.n++; q.m += s.lengte; q.punten += s.pts.length;
    q.langste = Math.max(q.langste, s.lengte);
    // klopt de opgegeven lengte met de punten?
    let echt = 0;
    for (let i = 1; i < s.pts.length; i++) echt += Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]);
    q.afwijking = Math.max(q.afwijking || 0, Math.abs(echt - s.lengte));
  }
  for (const k of Object.keys(per)) per[k].m = Math.round(per[k].m);
  return { totaal: lijst.length, per };
});
const soorten = ['muur', 'hek', 'kademuur', 'damwand', 'vangrail', 'balustrade'];
ok(kaart.totaal > 80, 'er staan meer dan tachtig scheidingen in de kaart', `${kaart.totaal}`);
for (const s of soorten) {
  const q = kaart.per[s];
  ok(!!q && q.m > 40, `${s}: staat erin met een fatsoenlijke lengte`, q ? `${q.n}x, ${q.m} m` : 'ontbreekt');
}
ok(Object.values(kaart.per).every(q => q.afwijking < 0.6),
  'de opgegeven lengte klopt met de punten',
  `grootste afwijking ${Math.max(...Object.values(kaart.per).map(q => q.afwijking)).toFixed(2)} m`);
ok(kaart.per.muur && kaart.per.muur.langste < 400,
  'geen muur die door de projectie de halve wijk door loopt',
  kaart.per.muur ? `langste ${Math.round(kaart.per.muur.langste)} m` : '');

kop('en er staat ook echt iets');
const bouw = await page.evaluate(() => {
  const g = window.__game;
  const per = {};
  g.scene.traverse(o => {
    if (!o.isMesh || !o.userData.scheiding) return;
    per[o.userData.scheiding] = (per[o.userData.scheiding] || 0) + o.geometry.attributes.position.count;
  });
  return per;
});
ok((bouw.muur || 0) > 2000, 'de muren zijn gebouwd', `${bouw.muur || 0} hoekpunten`);
ok((bouw.vangrail || 0) > 2000, 'de vangrails en balustrades ook — met paaltjes',
  `${bouw.vangrail || 0} hoekpunten`);
/*
 Een spijlenhek is één doorzichtig vlak per recht stuk, met de textuur die zich
 langs de lengte herhaalt: achttienhonderd meter hek is daardoor maar een paar
 honderd hoekpunten. Dat is de bedoeling — het waren er eerst zes per twee meter.
*/
ok((bouw.hekwerk || 0) > 200, 'de spijlenhekken staan er', `${bouw.hekwerk || 0} hoekpunten`);
ok((bouw.damwand || 0) > 1000, 'en de damwanden langs het water', `${bouw.damwand || 0} hoekpunten`);

kop('je loopt er niet doorheen');
const bots = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const W = await import('/js/world.js');
  const duw = (x, z) => { const [nx, nz] = W.resolveCollisions(x, z, 0.5); return +Math.hypot(nx - x, nz - z).toFixed(2); };
  const opLijn = (soort) => {
    const s = (KAART.scheidingen || []).filter(q => q.soort === soort).sort((a, b) => b.lengte - a.lengte)[0];
    if (!s) return null;
    // midden van het langste segment
    let beste = 0, a = s.pts[0], b = s.pts[1];
    for (let i = 1; i < s.pts.length; i++) {
      const L = Math.hypot(s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]);
      if (L > beste) { beste = L; a = s.pts[i - 1]; b = s.pts[i]; }
    }
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  const uit = {};
  for (const soort of ['muur', 'hek', 'vangrail']) {
    const p = opLijn(soort);
    uit[soort] = p ? duw(p[0], p[1]) : null;
  }
  return uit;
});
ok(bots.muur > 0.2, 'tegen een muur loop je aan', `${bots.muur} m weggeduwd`);
ok(bots.hek > 0.2, 'door een spijlenhek ook niet', `${bots.hek} m weggeduwd`);
ok(bots.vangrail > 0.2, 'en over een vangrail stap je niet zomaar', `${bots.vangrail} m weggeduwd`);

kop('een vangrail hangt en staat niet');
const rail = await page.evaluate(() => {
  const g = window.__game;
  let laagste = Infinity, hoogste = -Infinity;
  g.scene.traverse(o => {
    if (!o.isMesh || o.userData.scheiding !== 'vangrail') return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { laagste = Math.min(laagste, p.getY(i)); hoogste = Math.max(hoogste, p.getY(i)); }
  });
  return { laagste: +laagste.toFixed(2), hoogste: +hoogste.toFixed(2) };
});
ok(rail.hoogste > 0.7 && rail.hoogste < 1.3, 'het blad zit op rijhoogte', `top op ${rail.hoogste} m`);
ok(rail.laagste >= -0.05, 'en niets zakt door de grond', `laagste punt ${rail.laagste} m`);

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);

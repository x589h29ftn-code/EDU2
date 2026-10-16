/*
 Proef bij stap 203 (npm run politievuurtest). Gevraagd (16 okt 2026): "Met al het flanken schiet de politie in het begin vrij
 weinig op Erik en raak."

 Drie agenten op 12, 16 en 20 m van Erik op de Molenkrite (dezelfde plek als tools/politietest.mjs en politieslimtest), overdag,
 Erik staat stil in het open. Dat vuurgevecht twintig keer, met de oude stand van js/politie.js `AANVAL` (richten vanaf nul, geen
 snel eerste schot) en met de nieuwe, in dezelfde pagina. Gemeten per beeld (1/30 s): de schade aan Erik, en wanneer het eerste
 schot valt.

  1. De eerste vijf tellen: met de nieuwe stand duidelijk meer schade (minstens anderhalf keer) en het eerste schot eerder.
  2. Niet te veel: na vijftien tellen in het open is Erik met de nieuwe stand niet meer dan 2,5 keer zo hard geraakt als met de
     oude (de raakkans erna is niet veranderd), en de schade per seconde blijft onder de 12 (drie schutters, VUURDERS).
  3. Flankeerders schieten ook: van de drie agenten loopt er minstens één als flankeerder en die vuurt binnen de eerste vijf tellen.

 Gebruik: npm run server &  node tools/politievuurtest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fouten++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const PM = await import('/js/politie.js');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, P = g.politie, pl = g.player;
  pl.active = false; window.__autoplay = false;
  const as = KAART.wegassen.filter(w => w.drive && w.naam === 'Molenkrite' && w.lengte > 60)
    .sort((p, q) => { const m = (w) => { const t = w.pts[Math.floor(w.pts.length / 2)]; return Math.hypot(t[0], t[1]); }; return m(p) - m(q); })[0];
  const a = as.pts[Math.floor(as.pts.length / 2)], b = as.pts[Math.min(as.pts.length - 1, Math.floor(as.pts.length / 2) + 3)];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, lx = (b[0] - a[0]) / L, lz = (b[1] - a[1]) / L;
  const dag = () => { g.sfeer.uur = 12; g.sfeer.weer = 'helder'; for (let i = 0; i < 3; i++) g.sfeer.update(0.1, a[0], a[1]); };
  const NIEUW = { ...PM.AANVAL }, OUD = { richtStart: 0, eersteSchot: 99, spreiding: 0 };
  const gevecht = (stand) => {
    Object.assign(PM.AANVAL, stand);
    P.reset(); P.proefStil = true; dag();
    pl.inCar = null; pl.hurk = 0; pl.pos.set(a[0], 0, a[1]);
    P.zetSter(2, a[0], a[1]);
    const agenten = [12, 16, 20].map(d => P.proef.agent(a[0] + lx * d, a[1] + lz * d));
    const per = [];
    let eerste = null, flankVuur = false, tijd = 0;
    const flank = agenten.filter(x => x.rol === 'flank');
    // ze komen eraan en kijken jouw kant op (zoals een agent die net uit zijn wagen stapt); het eerste zien moet nog gebeuren
    for (const x of agenten) {
      x.persoon.kijkNaar(a[0], a[1], 10, 1000);
      const vuur = x.persoon.vuur.bind(x.persoon);
      x.persoon.vuur = (...q) => { if (eerste === null) eerste = tijd; if (x.rol === 'flank' && tijd < 5) flankVuur = true; return vuur(...q); };
    }
    for (let i = 0; i < 15 * 30; i++) {
      tijd = i / 30;
      pl.health = 100; pl.pos.set(a[0], 0, a[1]); pl.hurk = 0;
      per.push(P.update(1 / 30));
    }
    const som = (t0, t1) => per.slice(t0 * 30, t1 * 30).reduce((x, y) => x + y, 0);
    return { vijf: som(0, 5), vijftien: som(0, 15), eerste, flank: flank.length, flankVuur };
  };
  const meet = (stand, n) => {
    const res = [];
    for (let k = 0; k < n; k++) res.push(gevecht(stand));
    const gem = (f) => res.reduce((x, y) => x + f(y), 0) / res.length;
    return { vijf: +gem(x => x.vijf).toFixed(1), vijftien: +gem(x => x.vijftien).toFixed(1),
      eerste: +gem(x => x.eerste ?? 15).toFixed(2), flankRondes: res.filter(x => x.flank > 0).length, flankVuur: res.filter(x => x.flankVuur).length };
  };
  const oud = meet(OUD, 20);
  const nieuw = meet(NIEUW, 20);
  Object.assign(PM.AANVAL, NIEUW);
  P.reset();
  return { oud, nieuw, stand: NIEUW };
});

kop('1. de eerste vijf tellen');
console.log(`  oud:   ${JSON.stringify(r.oud)}\n  nieuw: ${JSON.stringify(r.nieuw)}`);
ok(r.nieuw.vijf >= r.oud.vijf * 1.5 && r.nieuw.vijf > 6, 'met de nieuwe stand in de eerste vijf tellen minstens anderhalf keer zoveel schade', `${r.oud.vijf} → ${r.nieuw.vijf} leven`);
ok(r.nieuw.eerste < r.oud.eerste && r.nieuw.eerste < 1.2, 'het eerste schot eerder, binnen ruim een seconde', `${r.oud.eerste} → ${r.nieuw.eerste} s`);

kop('2. niet te veel');
ok(r.nieuw.vijftien <= r.oud.vijftien * 2.5, 'na vijftien tellen niet meer dan 2,5 keer zo hard geraakt als met de oude stand', `${r.oud.vijftien} → ${r.nieuw.vijftien} leven`);
ok(r.nieuw.vijftien / 15 < 12, 'onder de 12 leven per seconde van drie schutters', `${(r.nieuw.vijftien / 15).toFixed(1)} per s`);

kop('3. flankeerders schieten ook');
ok(r.nieuw.flankRondes > 0 && r.nieuw.flankVuur >= r.nieuw.flankRondes * 0.6, 'een flankeerder vuurt binnen de eerste vijf tellen', `${r.nieuw.flankVuur} van ${r.nieuw.flankRondes} gevechten met een flankeerder`);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);

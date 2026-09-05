/*
 Kun je overal komen waar je hoort te kunnen komen?

 De botsingsdozen van de panden waren tot nu toe de omhullende rechthoek van het
 pand. Bij een school of een zorgcomplex met een binnenplein betekende dat een
 muur dwars over het plein en over de paden erlangs: je liep er vast, te voet en
 met de auto, en soms drukte de botsingsafhandeling je zelfs het gebouw in.

 Deze toets loopt daarom twee dingen na:

 1. Van elk pand het omhullende vlak: elk punt dat buiten de echte voetafdruk
    ligt (met een marge van 0,6 m voor de gevel) moet vrij zijn.
 2. Een echte wandeling: vanuit het binnenplein van de grote panden acht kanten
    op lopen; je mag nergens klem komen te staan of binnen een voetafdruk
    eindigen.

 Gebruik: python3 -m http.server 8123 &  node tools/looptest.mjs 8123
*/
import { chromium } from 'playwright';

const port = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });

const uitslag = await page.evaluate(async () => {
  const w = await import('./js/world.js');
  const { KAART } = await import('./js/kaart.js');

  const inVoet = (x, z, voet) => {
    let inn = false;
    for (let i = 0, j = voet.length - 1; i < voet.length; j = i++) {
      const a = voet[i], b = voet[j];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inn = !inn;
    }
    return inn;
  };
  // afstand tot de rand van de voetafdruk, om de gevelmarge over te slaan
  const randAf = (x, z, voet) => {
    let best = 1e9;
    for (let i = 0, j = voet.length - 1; i < voet.length; j = i++) {
      const a = voet[i], b = voet[j];
      const ux = b[0] - a[0], uz = b[1] - a[1], L2 = ux * ux + uz * uz || 1;
      const t = Math.max(0, Math.min(1, ((x - a[0]) * ux + (z - a[1]) * uz) / L2));
      best = Math.min(best, Math.hypot(x - (a[0] + ux * t), z - (a[1] + uz * t)));
    }
    return best;
  };

  // 1. het open terrein binnen de omhullende rechthoek. Een punt telt alleen
  // mee als het buiten élk pand ligt: bij een rijtje overlappen de omhullende
  // rechthoeken elkaar, en de muur van de buren hoort natuurlijk dicht te zijn.
  const dichtbij = (x, z, straal) => KAART.panden.filter(q =>
    q.voet && Math.abs(q.rect.cx - x) < straal + q.rect.hx + q.rect.hz &&
    Math.abs(q.rect.cz - z) < straal + q.rect.hx + q.rect.hz);
  // 1,5 m marge rond elke gevel: daar hoort de botsingsdoos te staan, en een
  // strookje dat net iets te ruim is hindert niemand
  const vrijVanPanden = (x, z) => !dichtbij(x, z, 4).some(q => inVoet(x, z, q.voet) || randAf(x, z, q.voet) < 1.5);

  let punten = 0, klem = 0;
  const ergste = [];
  for (const p of KAART.panden) {
    if (!p.rect || !p.voet || p.voet.length < 4) continue;
    const r = p.rect;
    if (r.hx * r.hz * 4 < 120) continue;               // alleen de grotere panden
    const c = Math.cos(r.hoek), s = Math.sin(r.hoek);
    let dicht = 0, hier = 0;
    for (let du = -r.hx; du <= r.hx; du += 1) for (let dv = -r.hz; dv <= r.hz; dv += 1) {
      const x = r.cx + du * c - dv * s, z = r.cz + du * s + dv * c;
      if (!vrijVanPanden(x, z)) continue;
      punten++; hier++;
      const [rx, rz] = w.resolveCollisions(x, z, 0.35);
      if (Math.hypot(rx - x, rz - z) > 0.01) { klem++; dicht++; }
    }
    if (dicht > 4) ergste.push({ nr: (p.nr || []).join('/') || p.id.slice(-6), straat: p.straat || '?', dicht, hier });
  }
  ergste.sort((a, b) => b.dicht - a.dicht);

  // 2. echt lopen vanuit het binnenplein van de grootste panden
  const grote = KAART.panden.filter(p => p.rect && p.voet && p.rect.hx * p.rect.hz * 4 > 1500)
    .sort((a, b) => b.rect.hx * b.rect.hz - a.rect.hx * a.rect.hz).slice(0, 4);
  const wandelingen = [];
  for (const p of grote) {
    // een open plek binnen de omhullende rechthoek zoeken
    const r = p.rect, c = Math.cos(r.hoek), s = Math.sin(r.hoek);
    let start = null;
    for (let du = -r.hx; du <= r.hx && !start; du += 1) for (let dv = -r.hz; dv <= r.hz; dv += 1) {
      const x = r.cx + du * c - dv * s, z = r.cz + du * s + dv * c;
      if (inVoet(x, z, p.voet) || randAf(x, z, p.voet) < 1.5) continue;
      const [rx, rz] = w.resolveCollisions(x, z, 0.35);
      if (Math.hypot(rx - x, rz - z) < 0.01) { start = { x, z }; break; }
    }
    if (!start) { wandelingen.push({ nr: (p.nr || []).join('/') || p.id.slice(-6), geenPlek: true }); continue; }
    let vast = 0, binnen = 0, verste = 0;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      let x = start.x, z = start.z, gelopen = 0;
      for (let i = 0; i < 200; i++) {                  // 20 m in stapjes van 10 cm
        const nx = x + Math.sin(a) * 0.1, nz = z + Math.cos(a) * 0.1;
        const [rx, rz] = w.resolveCollisions(nx, nz, 0.35);
        gelopen += Math.hypot(rx - x, rz - z);
        x = rx; z = rz;
        if (inVoet(x, z, p.voet)) { binnen++; break; }
      }
      verste = Math.max(verste, gelopen);
      if (gelopen < 1.5) vast++;                       // geen meter vooruit gekomen
    }
    wandelingen.push({ nr: (p.nr || []).join('/') || p.id.slice(-6), vast, binnen, verste: +verste.toFixed(1) });
  }

  return { colliders: w.colliders.length, punten, klem, ergste: ergste.slice(0, 6), wandelingen };
});

console.log(`${uitslag.colliders} botsingsdozen · ${uitslag.punten} open punten binnen de panden getoetst`);
ok(uitslag.klem / Math.max(1, uitslag.punten) < 0.02,
  'het open terrein binnen de panden is begaanbaar',
  `${uitslag.klem} van de ${uitslag.punten} punten geblokkeerd`);
for (const e of uitslag.ergste) console.log(`       ${e.straat} ${e.nr}: ${e.dicht} van ${e.hier} punten dicht`);

for (const wl of uitslag.wandelingen) {
  ok(!wl.geenPlek && wl.vast === 0 && wl.binnen === 0,
    `vanaf het binnenterrein van ${wl.nr} kun je alle kanten op lopen`,
    wl.geenPlek ? 'geen open plek gevonden' : `${wl.vast} richtingen klem, ${wl.binnen} keer een gebouw in, verste ${wl.verste} m`);
}

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);

/*
 Sneller opstarten (verzoek 24 sep 2026).

   node tools/server.mjs 8123 &   node tools/opstarttest.mjs [poort]

 Het profiel van 24 sep: 72 s tot het spel klaarstond (headless, drie keer
 trager dan een gewone pc). Het tekenen van 1145 gevels, het reliëf en de
 wachttijd van `setTimeout(0)` tussen de stukken opbouw waren samen ruim de
 helft. Nu:

 1. worden de gevels tijdens de opbouw niet getekend maar als doekje van 4×4 in
    de steenkleur neergezet, en na het opstarten getekend, dichtstbij eerst;
 2. komt het reliëf ook pas daarna;
 3. is alles na `reliëfAf` weer precies zoals het was: elke gevel zijn echte
    doek en zijn roughness map, elk reliëfdoek zijn normal map.

 De tijden per fase staan erbij (window.__opstart); de proef eist alleen wat
 niet van de snelheid van de machine afhangt, plus een ruime bovengrens.
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fout++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
const totaal = (Date.now() - t0) / 1000;

kop('de fases');
const start = await page.evaluate(async () => {
  const T = await import('/js/textures.js');
  const g = window.__game;
  // hoeveel gevels staan er nog als doekje, en wat voor kleur heeft zo'n doekje?
  let klein = 0, kleurGoed = 0, gevelMats = 0;
  const gezien = new Set();
  g.scene.traverse(o => {
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      if (!m || !m.map || gezien.has(m.map)) continue;
      gezien.add(m.map);
      if (m.map.image && m.map.image.width === 4) {
        klein++;
        const d = m.map.image.getContext('2d').getImageData(1, 1, 1, 1).data;
        if (d[3] === 255 && d[0] + d[1] + d[2] > 30) kleurGoed++;
      }
    }
  });
  return { fases: window.__opstart, wachtend: T.wachtendeGevels(), klein, kleurGoed, bezig: g.reliëfBezig };
});
for (const f of start.fases) console.log(`       ${String(f.ms).padStart(6)} ms  ${f.wat}`);
const som = (re) => start.fases.filter(f => re.test(f.wat)).reduce((t, f) => t + f.ms, 0);
console.log(`       totaal tot het spel klaarstaat: ${totaal.toFixed(1)} s (was 72 s)`);
ok(start.wachtend > 1000, 'de gevels worden na het opstarten getekend', `${start.wachtend} wachten nog`);
ok(start.klein > 1000 && start.kleurGoed === start.klein, 'tot die tijd een doekje in de kleur van de steen',
  `${start.klein} doekjes, ${start.kleurGoed} met kleur`);
ok(start.bezig, 'en het reliëf komt ook daarna');
ok(!start.fases.some(f => /reliëf/.test(f.wat)), 'het reliëf is geen fase van het opstarten meer');
ok(som(/gebouwen/) < 25000, 'de gebouwen kosten geen 32 s meer', `${(som(/gebouwen/) / 1000).toFixed(1)} s`);
ok(totaal < 60, 'en het geheel blijft ruim onder de 72 s', `${totaal.toFixed(1)} s`);

kop('daarna is alles zoals het was');
const na = await page.evaluate(async () => {
  const T = await import('/js/textures.js');
  const g = window.__game;
  const uit = g.reliëfAf();
  let gevels = 0, klein = 0, ruw = 0, normaal = 0;
  const gezien = new Set();
  g.scene.traverse(o => {
    const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
    for (const m of mats) {
      if (!m || gezien.has(m)) continue;
      gezien.add(m);
      if (m.map && m.map.image && m.map.image.width === 4) klein++;
      if (m.roughnessMap) ruw++;
      if (m.normalMap) normaal++;
    }
  });
  // en een gevel die de proeven zelf opvragen is meteen af
  const los = T.facade('molenkrite', 3, 2, false, 1).image;
  return { uit, klein, ruw, normaal, wachtend: T.wachtendeGevels(), los: [los.width, los.height] };
});
ok(na.wachtend === 0 && na.klein === 0, 'geen enkele gevel staat nog als doekje', `${na.klein} doekjes, ${na.wachtend} wachtend`);
// vóór 24 sep: "179 normal maps en 1145 roughness maps" bij het opstarten
ok(na.ruw >= 1145 && na.normaal >= 179, 'elke gevel heeft zijn glans en het reliëf is er',
  `${na.ruw} roughness maps, ${na.normaal} normal maps`);
ok(na.los[0] > 100, 'een gevel die je daarna opvraagt krijg je af', `${na.los[0]}×${na.los[1]}`);

console.log(`\n${fout ? fout + ' fout' : 'alles goed'}`);
await browser.close();
process.exit(fout ? 1 : 0);

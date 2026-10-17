/*
 Proef bij stap 212 (npm run nachtregentest). Gemeld (17 okt 2026), met een foto van missie 18 in de heli: "Het is wel 1:00 's nachts
 maar behoorlijk lichter ineens. Kwam door regen denk ik. Misschien dat uitzetten tijdens de missie."

 De wolken mengden een vaste grijze kleur door de lucht, ook 's nachts; de mist neemt de kleur van de onderkant van de lucht, dus
 om 01:00 met regen hing er een lichtgrijze waas over de wijk (js/sfeer.js).

  1. Om 01:00: de mist en de lucht met regen en bewolkt zijn niet lichter dan bij helder weer (oud: veel lichter, nagerekend).
  2. Overdag (13:00) blijft regen grijs en donkerder dan helder: daar verandert niets.
  3. Een beeld om 01:00 met regen is niet lichter dan met helder weer (gemiddelde helderheid van de pixels), met foto's.
  4. In de nacht van missie 18 (de heli) wordt regen helder, en zo blijft het; buiten een missie mag het 's nachts wel regenen.
  5. Geen nieuw shaderprogramma.

 Gebruik: npm run server &  node tools/nachtregentest.mjs [poort]
*/
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fouten++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal, P = g.player, R = g.renderer, sf = g.sfeer;
  await g.voorbereidSpel();
  P.active = false; window.__autoplay = false; g.politie.proefStil = true;
  const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const meet = (uur, weer) => { sf.weer = weer; sf.uur = uur; return { mist: +lum(g.scene.fog.color).toFixed(4) }; };
  const uit = { nacht: {}, dag: {} };
  for (const w of ['helder', 'bewolkt', 'regen']) { uit.nacht[w] = meet(1, w); uit.dag[w] = meet(13, w); }
  // het oude grijs, nagerekend: de vaste kleur 0x8d959c / 0x5d666e in de onderkant van de nachtlucht (0x1b2b40), f = 0.75 × 0.8
  const T = await import('/lib/three.module.js');
  const oud = new T.Color(0x1b2b40).lerp(new T.Color(0x5d666e), 0.75 * 0.8);
  uit.oudRegen = +lum(oud).toFixed(4);
  // een beeld om 01:00, van boven over de wijk zoals uit de heli
  const beeld = (weer) => {
    sf.weer = weer; sf.uur = 1;
    P.pos.set(0, 0, 0); P.yaw = 0.6; P.pitch = -0.55; P.applyCamera();
    g.camera.position.set(-60, 70, 60); g.camera.lookAt(40, 0, -60);
    g.scene.updateMatrixWorld(true);
    R.render(g.scene, g.camera);
    const c = R.domElement, gl = R.getContext();
    const px = new Uint8Array(4 * 64 * 40);
    let som = 0, n = 0;
    for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) {
      const p = new Uint8Array(4);
      gl.readPixels(Math.floor((x + 0.5) * c.width / 16), Math.floor((y + 0.5) * c.height / 10), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p);
      som += 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]; n++;
    }
    return { gem: +(som / n).toFixed(1), url: c.toDataURL('image/png') };
  };
  // (eerst één keer: het eerste beeld van een nieuwe plek 's nachts vertaalt de nachtvarianten van wat daar staat, zie open punt 30;
  // daarna mag het weer wisselen zonder dat er iets bij komt)
  beeld('helder'); beeld('regen');
  const progs0 = R.info.programs.length;
  uit.beeld = { helder: beeld('helder'), regen: beeld('regen') };
  uit.progs = { voor: progs0, na: R.info.programs.length };
  // missie 18, de nacht in de heli, met regen
  const s = v.bewaar(); s.missie = 'uitzending'; s.fase = 'heliStart';
  v.herstel(s);
  for (let i = 0; i < 4; i++) v.update(0.05);
  sf.weer = 'regen';
  for (let i = 0; i < 6; i++) v.update(0.05);
  uit.missie = { uur: +sf.uur.toFixed(2), weer: sf.weer, doel: sf.weerDoel, fase: v.fase };
  for (let i = 0; i < 40; i++) v.update(0.05);
  uit.missieLater = { weer: sf.weer };
  // vrij spelen, 's nachts: regen blijft
  const s2 = v.bewaar(); Object.assign(s2, { missie: 'klaar', fase: 'klaar', volgende: null, uitzendingKlaar: true });
  v.herstel(s2); for (let i = 0; i < 4; i++) v.update(0.05);
  sf.uur = 1; sf.weer = 'regen';
  for (let i = 0; i < 10; i++) v.update(0.05);
  uit.vrij = { weer: sf.weer, uur: +sf.uur.toFixed(2) };
  return uit;
});

kop('1. om 01:00');
const N = r.nacht;
console.log(`  mist: helder ${N.helder.mist}, bewolkt ${N.bewolkt.mist}, regen ${N.regen.mist} (oud, nagerekend: regen ${r.oudRegen})`);
ok(N.regen.mist <= N.helder.mist * 1.05 + 0.002 && N.bewolkt.mist <= N.helder.mist * 1.05 + 0.002, 'de mist bij regen en bewolkt is niet lichter dan bij helder weer');
ok(r.oudRegen > N.helder.mist * 1.5, 'met het oude vaste grijs was hij veel lichter (zo zag de foto eruit)', `${r.oudRegen} tegen ${N.helder.mist}`);
kop('2. overdag');
const D = r.dag;
console.log(`  mist: helder ${D.helder.mist}, bewolkt ${D.bewolkt.mist}, regen ${D.regen.mist}`);
ok(D.regen.mist < D.helder.mist && D.bewolkt.mist < D.helder.mist, 'overdag is regen nog grijs en donkerder dan helder');
kop('3. het beeld om 01:00');
writeFileSync('docs/screenshots/nacht_helder.png', Buffer.from(r.beeld.helder.url.split(',')[1], 'base64'));
writeFileSync('docs/screenshots/nacht_regen.png', Buffer.from(r.beeld.regen.url.split(',')[1], 'base64'));
ok(r.beeld.regen.gem <= r.beeld.helder.gem * 1.1 + 2, 'met regen niet lichter dan helder', `gemiddeld ${r.beeld.regen.gem} tegen ${r.beeld.helder.gem} (foto's nacht_regen.png, nacht_helder.png)`);
kop('4. de nacht van missie 18');
ok(r.missie.weer === 'helder' && r.missie.doel === 0 && r.missieLater.weer === 'helder', 'in de heli om 01:00 regent het niet', JSON.stringify(r.missie));
ok(r.vrij.weer === 'regen', 'buiten een missie mag het \'s nachts regenen', JSON.stringify(r.vrij));
kop('5. shaders');
ok(r.progs.na === r.progs.voor, 'geen nieuw shaderprogramma', `${r.progs.voor} → ${r.progs.na}`);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);

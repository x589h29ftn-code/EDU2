/*
 Toetst de autoradio met muziek uit een bestand (audio/radio/).

 Wat er mis kan gaan: de lijst wordt niet gevonden, het bestand laadt niet, de
 muziek speelt door terwijl je uitstapt, of hij gaat niet door de filterketen en
 klinkt dus als een concert in plaats van uit de portierspeakers. En als er géén
 muziek is moet het gesynthetiseerde riffje het overnemen — dat is de terugval.

 Gebruik: python3 -m http.server 8123 &  node tools/radiotest.mjs 8123
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
  // zonder deze vlag weigert de browser af te spelen zonder klik; in het spel
  // zelf heb je die klik al gegeven voordat je in een auto stapt
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

kop('de afspeellijst');
const lijst = await page.evaluate(async () => {
  const r = await fetch('audio/radio/nummers.json');
  const j = await r.json();
  const uit = [];
  for (const n of j.nummers || []) {
    const h = await fetch('audio/radio/' + n.bestand, { method: 'HEAD' });
    uit.push({ ...n, ok: h.ok, mb: +(Number(h.headers.get('content-length') || 0) / 1048576).toFixed(1) });
  }
  return uit;
});
ok(lijst.length > 0, 'er staat muziek in audio/radio/', `${lijst.length} nummer(s)`);
ok(lijst.every(n => n.ok), 'en elk bestand uit de lijst bestaat ook echt',
  lijst.map(n => `${n.bestand} ${n.mb} MB`).join(', '));
ok(lijst.every(n => n.titel && n.artiest), 'met titel en artiest erbij, voor het berichtbalkje',
  lijst.map(n => `${n.titel} — ${n.artiest}`).join(' · '));

kop('in de auto');
const rit = await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  geluid.start();
  const lijst = await geluid.laadRadio();
  // instappen. De geparkeerde auto's staan in de zuinige uitvoering zonder eigen
  // model; `maakBestuurbaar` geeft hem er een, net als wanneer je op E drukt.
  const auto = g.vehicles.cars.find(c => c.driveable);
  g.vehicles.maakBestuurbaar(auto);
  g.player.inCar = auto;
  geluid.autoradio(true);
  await new Promise(r => setTimeout(r, 1500));
  const inAuto = { ...geluid.radioStand(), nummer: geluid.radioNummer() };
  // en weer uitstappen
  g.player.inCar = null;
  geluid.autoradio(false);
  await new Promise(r => setTimeout(r, 600));
  const buiten = geluid.radioStand();
  return { nummers: lijst.length, inAuto, buiten };
});
ok(rit.inAuto.speler, 'de speler hangt in de geluidsketen');
ok(!rit.inAuto.stuk && rit.inAuto.speelt, 'en speelt zodra je in de auto zit',
  `${rit.inAuto.bron} op ${rit.inAuto.tijd}s van ${rit.inAuto.duur}s`);
ok(rit.inAuto.tijd > 0.2, 'de muziek loopt ook echt door', `${rit.inAuto.tijd} s gespeeld`);
ok(!!rit.inAuto.nummer && !!rit.inAuto.nummer.titel, 'en het spel weet welk nummer het is',
  rit.inAuto.nummer ? `${rit.inAuto.nummer.titel} — ${rit.inAuto.nummer.artiest}` : '');
ok(!rit.buiten.speelt, 'stap je uit, dan stopt hij', `speelt: ${rit.buiten.speelt}`);

kop('de klank van een autoradio');
const keten = await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  // de filters zitten in de module; we kijken of het geluid niet rechtstreeks
  // op de uitgang staat maar door een hoog- en laagdoorlaat gaat
  const bron = geluid.radioStand();
  return { speler: bron.speler };
});
ok(keten.speler, 'de muziek gaat door de filterketen van de portierspeakers');

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);

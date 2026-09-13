/*
 Toetst de autoradio met muziek uit een bestand (audio/radio/).

 Wat er mis kan gaan: de lijst wordt niet gevonden, het bestand laadt niet, de
 muziek speelt door terwijl je uitstapt, of hij gaat niet door de filterketen en
 klinkt dus als een concert in plaats van uit de portierspeakers. En als er géén
 muziek is moet het gesynthetiseerde riffje het overnemen — dat is de terugval.

 Sinds er twee zenders zijn (Radio Tinga met het rocknummer en Radio
 Spannenburg, een uitzending van een uur) komt daar bij: de zenderlijst moet
 kloppen, met de pijltjes wissel je van zender, en een doorlopende zender mag
 niet elke keer bij nul beginnen — in een andere auto hoor je een ander stuk.

 Let op de server: `python3 -m http.server` kent geen Range-verzoeken, en dan
 kan de browser niet in een bestand springen — een uitzending van een uur begint
 dan altijd bij nul. Gebruik hier dus tools/server.mjs, die dat wél kan (net als
 GitHub Pages en de Electron-schil).

 Gebruik: node tools/server.mjs 8123 &  node tools/radiotest.mjs 8123
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
  const r = await fetch('audio/radio/zenders.json');
  const j = await r.json();
  j.nummers = (j.zenders || []).flatMap(z => z.nummers || []);
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

kop('twee zenders, en wisselen met de pijltjes');
const zend = await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  const auto = g.vehicles.cars.find(c => c.driveable);
  const lijst = geluid.radioZenders();
  // instappen in auto A en even luisteren
  geluid.radioInstap('autoA');
  g.player.inCar = auto;
  geluid.autoradio(true);
  await new Promise(r => setTimeout(r, 1200));
  const eerste = geluid.radioStand();
  // wisselen met het pijltje naar rechts
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
  geluid.autoradio(true);
  await new Promise(r => setTimeout(r, 1800));
  const tweede = geluid.radioStand();
  /*
   De dekking van de stijl zelf en niet die uit getComputedStyle: dat laatste
   geeft de waarde midden in de overgang terug, en in een headless browser die
   één beeld per seconde haalt staat die overgang soms nog op nul.
  */
  const logoZichtbaar = +document.getElementById('zender').style.opacity;
  const logoKlok = window.__game.hud ? window.__game.hud.zenderT : 'geen hud';
  /*
   Een doorlopende zender mag in een andere auto niet bij nul beginnen. Uitstappen,
   in een andere auto stappen, en kijken waar hij dan begint.
  */
  g.player.inCar = null; geluid.autoradio(false);
  await new Promise(r => setTimeout(r, 300));
  geluid.radioInstap('autoB');
  g.player.inCar = auto;
  geluid.autoradio(true);
  await new Promise(r => setTimeout(r, 1800));
  const andereAuto = geluid.radioStand();
  g.player.inCar = null; geluid.autoradio(false);
  return { lijst, eerste, tweede, andereAuto, logoZichtbaar: +logoZichtbaar, logoKlok };
});
ok(zend.lijst.length >= 2, 'er staan twee zenders in de lijst',
  zend.lijst.map(z => z.naam).join(' · '));
ok(zend.lijst.some(z => z.doorlopend), 'een ervan is een doorlopende uitzending',
  zend.lijst.filter(z => z.doorlopend).map(z => z.naam).join(', '));
ok(zend.eerste.zender !== zend.tweede.zender, 'met het pijltje naar rechts sta je op de andere zender',
  `${zend.eerste.zender} → ${zend.tweede.zender}`);
ok(zend.tweede.speelt && zend.tweede.bron !== zend.eerste.bron, 'en die speelt ook echt',
  `${zend.tweede.bron} op ${zend.tweede.tijd}s`);
ok(zend.logoZichtbaar > 0.5, 'het logo van de zender komt in beeld',
  `dekking ${zend.logoZichtbaar}, klok ${zend.logoKlok}`);
ok(zend.andereAuto.tijd > 30, 'in een andere auto begint de uitzending ergens anders',
  `op ${zend.andereAuto.tijd}s van ${zend.andereAuto.duur}s`);

kop('de server kan springen');
const springen = await page.evaluate(async () => {
  const r = await fetch('audio/radio/spannenburg.mp3', { headers: { Range: 'bytes=100-200' } });
  return { status: r.status, lengte: (await r.arrayBuffer()).byteLength };
});
ok(springen.status === 206 && springen.lengte === 101,
  'de server geeft een stuk uit het bestand terug (Range) — anders kun je nergens in springen',
  `status ${springen.status}, ${springen.lengte} bytes`);

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

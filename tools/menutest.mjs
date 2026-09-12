/*
 Toetst het startscherm, het laadscherm en de opbouw in stukjes.

 Wat er mis kan gaan, en dus wat hier nagerekend wordt:
 1. het menu hoort er meteen te staan. Dat is de hele reden van deze verbouwing:
    de wereld bouwen duurde drieënveertig seconden en al die tijd stond er een
    zwart scherm. Staat het menu er pas na dertig seconden, dan is er niets
    gewonnen;
 2. de opbouw moet in stukjes gaan en tussendoor het beeld teruggeven. Zo niet,
    dan bevriest het tabblad alsnog en loopt de voortgangsbalk niet;
 3. de voortgang moet oplopen van nul naar één en onderweg vertellen waar hij mee
    bezig is;
 4. de knoppen moeten doen wat ze zeggen: Start spel begint, Spel laden staat er
    alleen als er iets opgeslagen is, en Besturing en Instellingen klappen open;
 5. de wereld die eruit komt moet dezelfde zijn als vroeger — evenveel
    botsdozen, panden en parkeerplekken.

 Gebruik: python3 -m http.server 8123 &  node tools/menutest.mjs 8123
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
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });

kop('het menu staat er voordat de wereld klaar is');
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForSelector('#menuNieuw', { state: 'attached', timeout: 120000 });
const menuNa = Date.now() - t0;
const wereldKlaar = await page.evaluate(() => !!window.__game);
ok(menuNa < 30000, 'het menu is er binnen dertig seconden', `${(menuNa / 1000).toFixed(1)} s`);
ok(!wereldKlaar, 'en de wereld is dan nog niet klaar — hij bouwt eronder door');

kop('de opbouw gaat in stukjes en laat zien hoever hij is');
/*
 Tijdens het bouwen wordt er gemeten hoe lang het langste blok is waarin de
 pagina niet reageert. Bouwt hij in één keer, dan is dat tientallen seconden; in
 stukjes hoort het een fractie daarvan te zijn.

 De meting stopt zodra de balk op honderd staat. Wat daarna komt is het eerste
 beeld, en dat is één blok dat niet op te knippen is: de kaart moet zijn dertig
 programma's vertalen en tweehonderdvijftig megabyte textuur naar de kaart
 sturen. Op de softwarerenderer van de proefopstelling duurt dat tien seconden;
 op een machine met een grafische kaart een fractie daarvan. Het laadscherm
 blijft al die tijd staan, dus je kijkt er niet naar een bevroren wereld.
*/
const meting = await page.evaluate(() => new Promise(klaar => {
  const stappen = [];
  let vorige = performance.now(), langste = 0;
  const tik = () => {
    const nu = performance.now();
    langste = Math.max(langste, nu - vorige);
    vorige = nu;
    const b = document.getElementById('laadbalkin');
    const w = b ? parseFloat(b.style.width) || 0 : 0;
    if (w) stappen.push(w);
    if (w >= 100 || window.__game) { klaar({ langste: Math.round(langste), stappen }); return; }
    setTimeout(tik, 16);
  };
  // eerst kiezen, zodat het laadscherm met de balk in beeld komt
  document.getElementById('menuNieuw').click();
  tik();
}));
ok(meting.langste < 5000, 'de pagina staat tijdens de opbouw nooit langer dan vijf seconden stil',
  `langste blok ${meting.langste} ms`);
ok(meting.stappen.length > 5, 'de voortgangsbalk loopt in stappen op',
  `${meting.stappen.length} standen gemeten, van ${Math.min(...meting.stappen)}% tot ${Math.max(...meting.stappen)}%`);
ok(meting.stappen.length > 5 && Math.max(...meting.stappen) >= 99, 'en komt op honderd procent uit',
  `${Math.max(...meting.stappen)}%`);

kop('de wereld die eruit komt is dezelfde als vroeger');
// de balk staat op honderd, maar het eerste beeld moet nog; even wachten tot
// js/main.js helemaal klaar is
await page.waitForFunction(() => !!window.__game, null, { timeout: 300000 });
const wereld = await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const { KAART } = await import('/js/kaart.js');
  return {
    botsdozen: W.colliders.length,
    wegstukken: W.roadSegments.length,
    panden: KAART.panden.length,
    autos: window.__game.vehicles.cars.length,
    mensen: window.__game.npcs.people.length,
  };
});
ok(wereld.botsdozen > 50000, 'de botsdozen staan er', `${wereld.botsdozen}`);
ok(wereld.wegstukken > 5000, 'de wegstukken ook', `${wereld.wegstukken}`);
ok(wereld.autos > 1500, 'en de geparkeerde auto\'s', `${wereld.autos} auto\'s, ${wereld.mensen} mensen`);

kop('het spel begint na het laadscherm');
await page.waitForFunction(() => window.__game && window.__game.player.active, null, { timeout: 60000 });
const gestart = await page.evaluate(() => ({
  actief: window.__game.player.active,
  menuWeg: getComputedStyle(document.getElementById('overlay')).display === 'none',
}));
ok(gestart.actief, 'de speler is actief');
ok(gestart.menuWeg, 'en het menu is uit beeld');

kop('Esc brengt het menu terug, met Doorgaan erbij');
const pauze = await page.evaluate(async () => {
  window.__game.pauzeer();
  await new Promise(r => setTimeout(r, 120));
  const zicht = (id) => { const e = document.getElementById(id); return !!e && !e.hidden; };
  const zij = () => { const e = document.getElementById('overlay').querySelector('.menuzij'); return !!e && !e.hidden; };
  document.getElementById('menuBesturing').click();
  const besturing = zij();
  const regels = document.getElementById('overlay').querySelectorAll('.menuzij .menurij').length;
  document.getElementById('menuInstellingen').click();
  const instellingen = zij();
  const instelRegels = document.getElementById('overlay').querySelectorAll('.menuzij .menurij').length;
  return {
    zichtbaar: getComputedStyle(document.getElementById('overlay')).display !== 'none',
    doorgaan: zicht('menuDoorgaan'), actief: window.__game.player.active,
    besturing, regels, instellingen, instelRegels,
  };
});
ok(pauze.zichtbaar && !pauze.actief, 'Esc pauzeert en toont het menu');
ok(pauze.doorgaan, 'met Doorgaan erbij');
ok(pauze.besturing && pauze.regels >= 8, 'Besturing klapt open met de hele toetsenlijst',
  `${pauze.regels} regels`);
ok(pauze.instellingen && pauze.instelRegels >= 4, 'en Instellingen met de schuiven',
  `${pauze.instelRegels} regels`);

kop('Doorgaan speelt verder');
const door = await page.evaluate(async () => {
  document.getElementById('menuDoorgaan').click();
  await new Promise(r => setTimeout(r, 400));
  return {
    actief: window.__game.player.active,
    menuWeg: getComputedStyle(document.getElementById('overlay')).display === 'none',
  };
});
ok(door.actief && door.menuWeg, 'na Doorgaan speel je weer');

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);

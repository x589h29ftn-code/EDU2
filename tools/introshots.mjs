/*
 Foto's van de intro en van de uitleg onderweg:

   intro_lucht.png   het eerste beeld, hoog boven de wijk, met de eerste titel
   intro_viaduct.png het vijfde beeld: de rechte aanvlucht op het Viaduct Tinga
   intro_daken.png   lager over de daken, met "presents"
   intro_straat.png  door de straat op ooghoogte, met "GTA VI TINGA"
   intro_erik.png    het laatste beeld: het standpunt waar het spel begint
   uitleg_wapen.png  de uitleg bij het wapen dat Erik krijgt
   uitleg_auto.png   de uitleg de eerste keer dat je in een auto zit

 Gebruik: npm run server &   node tools/introshots.mjs 8123 [map]

 De beelden worden niet "op tijd" genomen maar met `beeldOp(t)` uit js/intro.js:
 die functie zegt waar de camera op seconde t staat, dus de foto van seconde
 dertien is echt het beeld van seconde dertien — ook op een machine die drie
 beelden per seconde haalt.
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

// het spel starten en de intro overslaan; daarna zetten we de beelden zelf
await page.evaluate(() => {
  const b = [...document.querySelectorAll('#overlay button')].find(x => x.textContent.trim() === 'Start spel');
  b.click();
});
await page.waitForTimeout(800);
await page.evaluate(async () => { const m = await import('/js/menu.js'); m.__start(); });
await page.waitForTimeout(600);
await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' })));
await page.waitForFunction(async () => {
  const I = await import('/js/intro.js');
  return !I.bezig() && window.__game.player.active;
}, null, { timeout: 40000 });
/*
 Nog even wachten. Het uitfaden van de intro loopt met een `setTimeout`, en op
 een trage machine komt die pas een seconde later aan de beurt — zette de
 fotolus de filmlaag daarvóór aan, dan haalde dat aflopen hem er meteen weer af
 en stond er op de eerste twee foto's geen balk en geen titel.
*/
await page.waitForTimeout(2500);

const foto = async (naam, wacht = 800) => {
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};

// een beeld uit het filmpje: camera op de plek van seconde t, titel erbij
const filmbeeld = async (naam, t) => {
  const info = await page.evaluate(async (tt) => {
    const I = await import('/js/intro.js');
    const { KAART } = await import('/js/kaart.js');
    const g = window.__game;
    const b = I.beeldOp(tt, KAART, g.start);
    /*
     De camera van de speler op dezelfde stand zetten in plaats van de camera
     zelf: de hoofdlus zet die elk beeld terug. `fly` houdt hem in de lucht.
    */
    g.player.fly = true;
    g.player.pos.set(b.pos.x, b.pos.y, b.pos.z);
    g.player.yaw = Math.atan2(-(b.kijk.x - b.pos.x), -(b.kijk.z - b.pos.z));
    g.player.pitch = Math.atan2(b.kijk.y - b.pos.y, Math.hypot(b.kijk.x - b.pos.x, b.kijk.z - b.pos.z));
    g.player.updateFly(0);
    document.getElementById('ui').style.display = 'none';
    // de filmlaag met de balken en de titel erbij
    const laag = document.getElementById('intro');
    laag.classList.add('aan');
    document.getElementById('introzwart').style.opacity = '0';
    const tel = document.getElementById('introtitel');
    const T = b.titel;
    tel.querySelector('.klein').textContent = T ? (T.klein || '') : '';
    tel.querySelector('.groot').textContent = T ? (T.groot || '') : '';
    tel.querySelector('.sub').textContent = T ? (T.sub || '') : '';
    tel.classList.toggle('zichtbaar', !!T);
    return { x: b.pos.x, y: b.pos.y, z: b.pos.z, titel: T ? [T.klein, T.sub].filter(Boolean).join(' ') : '',
      laag: getComputedStyle(laag).display, overlay: getComputedStyle(document.getElementById('overlay')).display,
      titelOp: getComputedStyle(tel).opacity };
  }, t);
  console.log(`${naam}: t=${t}s op (${info.x.toFixed(0)}, ${info.y.toFixed(0)}, ${info.z.toFixed(0)}) — ${info.titel || 'geen titel'} · laag ${info.laag}, overlay ${info.overlay}, titel ${info.titelOp}`);
  await foto(naam);
};

/*
 Eén foto per beeld, op het midden ervan: `beeldOp` geeft ook terug welk beeld
 er bij een tijdstip hoort, dus de lijst hieronder volgt gewoon het filmpje.
*/
const momenten = await page.evaluate(async () => {
  const I = await import('/js/intro.js');
  const { KAART } = await import('/js/kaart.js');
  const g = window.__game;
  const tot = I.beeldOp(0, KAART, g.start).totaal;
  const midden = [];
  let vorige = -1;
  // per beeld het midden opzoeken door de tijd af te lopen
  const grenzen = [];
  for (let t = 0; t <= tot; t += 0.1) {
    const nr = I.beeldOp(t, KAART, g.start).beeldNr;
    if (nr !== vorige) { grenzen.push(t); vorige = nr; }
  }
  grenzen.push(tot);
  for (let i = 0; i + 1 < grenzen.length; i++) midden.push(+((grenzen[i] + grenzen[i + 1]) / 2).toFixed(1));
  return midden;
});
const namen = ['intro_lucht', 'intro_molenkrite', 'intro_jumbo', 'intro_bosje', 'intro_viaduct',
  'intro_rwzi', 'intro_geeuw', 'intro_molen', 'intro_poiesz', 'intro_erik'];
for (let i = 0; i < momenten.length; i++) {
  await filmbeeld(namen[i] || `intro_${i}`, momenten[i]);
}

// de filmlaag weer weg en de HUD terug
await page.evaluate(() => {
  document.getElementById('intro').classList.remove('aan');
  document.getElementById('ui').style.display = '';
  const g = window.__game;
  g.player.fly = false;
  g.player.pos.set(g.start.x, 0, g.start.z);
  g.player.yaw = g.start.yaw; g.player.pitch = 0;
  g.player.applyCamera();
});

// de uitleg bij het wapen
await page.evaluate(() => { window.__game.verhaal.__geefWapen(); });
await foto('uitleg_wapen', 600);

// en de uitleg in de auto
const auto = await page.evaluate(async () => {
  const g = window.__game;
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Enter' }));
  await new Promise(r => requestAnimationFrame(r));
  const car = g.vehicles.voegToe({ x: g.player.pos.x + 2.4, z: g.player.pos.z, yaw: g.start.yaw, soort: 'hatch', kleur: 0x2a3f8f });
  if (!car) return null;
  g.toggleCar();
  for (let i = 0; i < 6; i++) await new Promise(r => requestAnimationFrame(r));
  return { in: !!g.player.inCar };
});
if (auto && auto.in) await foto('uitleg_auto', 600);
else console.log('uitleg_auto: niet ingestapt');

await browser.close();

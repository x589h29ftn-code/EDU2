/*
 Foto's van missie 7, de bom bij de Poiesz in Duinterpen:

   bom_bank.png      Mark op de bank in de Wieken 29, hij begint te praten
   bom_auto.png      de auto die daarna voor de deur staat
   bom_plek.png      binnen in de winkel: de gele ruit bij de schappen
   bom_knal.png      de ontploffing tegen de gevel, van het parkeerterrein af
   bom_schutters.png de zes man die daarna uitstappen en beginnen te schieten

 Gebruik: npm run server &   node tools/bomshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required',
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

const foto = async (naam, wacht = 900) => {
  // de losse meldingen ("Uitgestapt") en de missiebalk staan niet op de foto
  await page.evaluate(() => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    g.hud.melding('', '', 0);
    // en de rode flits van een treffer: die kleurt het hele beeld paars
    g.hud.flitsT = 0; if (g.hud.flitsEl) g.hud.flitsEl.style.opacity = 0;
  });
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};

/*
 Het verhaal stilzetten en weer laten lopen. Op een softwarerenderer duurt één
 beeld seconden; een ontploffing van drieënhalve seconde is dan voorbij voordat
 het beeld staat. Zolang het verhaal bevroren is werkt niets zich nog bij — de
 vuurbal, de rook en de schutters blijven staan waar ze staan, en de foto laat
 precies het moment zien dat bedoeld was.
*/
const bevries = () => page.evaluate(() => {
  const v = window.__game.verhaal;
  if (!v.__echteUpdate) { v.__echteUpdate = v.update; v.update = () => {}; }
});
const ontdooi = () => page.evaluate(() => {
  const v = window.__game.verhaal;
  if (v.__echteUpdate) { v.update = v.__echteUpdate; v.__echteUpdate = null; }
});

/*
 De camera op een plek zetten en naar een punt laten kijken. De speler staat
 gewoon op de grond (geen vliegstand), dus de camera hangt op ooghoogte: die
 hoogte moet ook in de kijkhoek zitten, anders kijk je over alles heen.
*/
const kijk = async (px, pz, kx, kz, kijkY = 1.6) => {
  await page.evaluate(({ px, pz, kx, kz, kijkY }) => {
    const g = window.__game;
    g.player.inCar = null; g.player.zit = false; g.player.fly = false;
    g.player.pos.set(px, 0, pz);
    const oog = g.player.eyeStaand || 1.7;
    g.player.yaw = Math.atan2(-(kx - px), -(kz - pz));
    g.player.pitch = Math.atan2(kijkY - oog, Math.hypot(kx - px, kz - pz));
    g.player.applyCamera();
  }, { px, pz, kx, kz, kijkY });
};

await page.evaluate(async () => {
  const { geluid } = await import('/js/audio.js');
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  window.__autoplay = true;
  g.sfeer.uur = 15; g.sfeer.weer = 'helder';
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  geluid.start();
  await geluid.laadMissieMuziek();
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) g.verhaal.update(dt); };
  g.verhaal.__startMissie('bom');
  window.__stap(4);
});

// ----------------------------------------------- Mark op de bank, de Wieken
const bank = await page.evaluate(() => {
  const g = window.__game, h = g.woningen[1], p = h.plekken;
  g.player.inCar = null;
  g.player.pos.set(p.deurBinnen.x, 0, p.deurBinnen.z);
  window.__stap(6);                              // hij begint te praten
  h.update(0.1, false);
  const m = g.verhaal.mark.groep.position;
  return { x: m.x, z: m.z, tekst: document.getElementById('dialoogTekst').textContent };
});
console.log(`op de bank: "${(bank.tekst || '').slice(0, 48)}"`);
// de bank staat tegen de rechterwand van de kamer (js/interieur.js), dus de
// kamer ligt aan de kant van de kleinere x: daar gaat de camera staan
await kijk(bank.x - 2.9, bank.z - 0.9, bank.x, bank.z, 1.15);
await foto('bom_bank');

// ------------------------------------------- de auto die voor de deur staat
const auto = await page.evaluate(() => {
  const g = window.__game;
  for (let i = 0; i < 20; i++) {
    if (!document.getElementById('dialoogTekst').textContent) break;
    g.praat(); window.__stap(2);
  }
  window.__stap(8);
  g.hud.melding('', '', 0);
  const a = g.verhaal.bomAuto;
  return a ? { x: a.x, z: a.z, yaw: a.yaw, soort: a.soort } : null;
});
if (auto) {
  console.log(`de auto: ${auto.soort} op ${auto.x.toFixed(0)},${auto.z.toFixed(0)}`);
  await kijk(auto.x - Math.sin(auto.yaw + 0.9) * 7.5, auto.z - Math.cos(auto.yaw + 0.9) * 7.5,
    auto.x, auto.z, 0.9);
  await foto('bom_auto');
}

// ------------------------------------ bij de winkel: Mark geeft de explosieven
const winkel = await page.evaluate(() => {
  const g = window.__game;
  const ing = g.supermarkt.ingangen.find(i => /duinterpen/i.test(i.naam));
  g.player.inCar = null;
  g.player.pos.set(ing.stoep.x, 0, ing.stoep.z);
  window.__stap(6);
  for (let i = 0; i < 12; i++) {
    if (!document.getElementById('dialoogTekst').textContent) break;
    g.praat(); window.__stap(2);
  }
  window.__stap(6);
  const p = g.verhaal.bomPlek;
  const nul = g.supermarkt.plekken.nul, m = g.supermarkt.maten;
  const mid = { x: nul.x + m.hal / 2, z: nul.z + m.diep / 2 };
  return { plek: { x: p.x, z: p.z }, mid, nul: { x: nul.x, z: nul.z },
    ing: { x: ing.deur.x, z: ing.deur.z, fx: ing.f[0], fz: ing.f[1] } };
});

// ------------------------------------------- de gele ruit bij de schappen
{
  const p = winkel.plek;
  await page.evaluate(() => { window.__stap(4); });
  /*
   Het bierschap staat tegen de linkerwand van de hal en de winkel staat met
   zijn assen gelijk aan de wereld (js/supermarkt.js), dus de +x gaat het
   gangpad in — dezelfde kant op als de bierfoto in tools/poieszshots.mjs.
   Naar het midden van de hal toe lopen komt in een schappenrij terecht.
  */
  console.log(`de plek bij de schappen: ${p.x.toFixed(0)}, ${p.z.toFixed(0)}` +
    ` (in de winkel: ${(p.x - winkel.nul.x).toFixed(1)}, ${(p.z - winkel.nul.z).toFixed(1)})`);
  // tweeënhalve meter het gangpad in: verder naar achteren staat de volgende
  // schappenrij in de weg
  await kijk(p.x + 2.6, p.z, p.x, p.z, 1.2);
  await foto('bom_plek');
}

// ------------------------------------------------------------- de knal
const knal = await page.evaluate(() => {
  const g = window.__game;
  const p = g.verhaal.bomPlek;
  // bij de schappen gaan staan en hem planten, zoals de speler met E doet
  g.player.pos.set(p.x + 1.2, 0, p.z + 1.2);
  window.__stap(4);
  g.praat();
  window.__stap(4);
  return { geplant: g.verhaal.bomGeplant, fase: g.verhaal.fase };
});
console.log(`geplant: ${knal.geplant} · fase ${knal.fase}`);

// naar buiten, naar Mark: de camera staat al klaar aan de overkant van het
// parkeerterrein, zodat de vuurbal en de rook boven de gevel uitkomen
const buiten = await page.evaluate(() => {
  const g = window.__game;
  const m = g.verhaal.mark.groep.position;
  g.player.pos.set(m.x + 2.5, 0, m.z + 2.5);
  window.__stap(6);
  for (let i = 0; i < 12; i++) {
    if (!document.getElementById('dialoogTekst').textContent) break;
    g.praat(); window.__stap(2);
  }
  return { mx: m.x, mz: m.z, fase: g.verhaal.fase };
});
{
  const d = winkel.ing;
  // van het parkeerterrein af, een meter of achttien van de deur en een paar
  // meter opzij: recht tegenover de ingang staat een boom
  await kijk(d.x + d.fx * 18 - d.fz * 6, d.z + d.fz * 18 + d.fx * 6, d.x, d.z, 5.5);
  await page.evaluate(() => {
    const g = window.__game;
    // doorstappen tot de bom afgaat
    for (let i = 0; i < 200 && !g.verhaal.knalBezig; i++) g.verhaal.update(0.05);
    /*
     En dan de ontploffing zelf een halve seconde vooruit: op een trage
     softwarerenderer duurt één beeld zo lang dat wachten op de klok de vuurbal
     mist. De vuurbal is het grootst rond zeven tiende seconde en is na negen
     tiende uitgedoofd (js/bom.js).
    */
    for (let i = 0; i < 12; i++) g.verhaal.update(0.05);
    g.hud.melding('', '', 0);
  });
  await bevries();                      // de vuurbal blijft staan tot de foto klaar is
  await foto('bom_knal', 120);
  await ontdooi();
}

// ------------------------------------------------- de zes man die uitstappen
const schutters = await page.evaluate(() => {
  const g = window.__game;
  for (let i = 0; i < 400 && !g.verhaal.schutters; i++) {
    g.verhaal.update(0.05);
    if (document.getElementById('dialoogTekst').textContent) g.praat();
  }
  for (let i = 0; i < 20; i++) g.verhaal.update(0.05);
  const s = g.verhaal.schutters;
  if (!s) return null;
  const sp = g.player.pos;
  let best = null, dBest = 1e9;
  for (const w of s.wachters) {
    const p = w.persoon.groep.position;
    const d = Math.hypot(p.x - sp.x, p.z - sp.z);
    if (d < dBest) { dBest = d; best = { x: p.x, z: p.z }; }
  }
  g.hud.melding('', '', 0);
  return { best, dBest, aantal: s.aantal, px: sp.x, pz: sp.z };
});
if (schutters && schutters.best) {
  console.log(`${schutters.aantal} man · de dichtstbijzijnde op ${schutters.dBest.toFixed(0)} m`);
  const b = schutters.best;
  const dx = b.x - schutters.px, dz = b.z - schutters.pz, l = Math.hypot(dx, dz) || 1;
  const ex = dx / l, ez = dz / l;
  // een paar meter achter de speler en drie opzij: recht achter hem staat een
  // lantaarnpaal precies in beeld
  await kijk(schutters.px - ex * 4 - ez * 3, schutters.pz - ez * 4 + ex * 3, b.x, b.z, 1.5);
  // ze schieten op je terwijl de foto wordt gemaakt; even bijtanken zodat de
  // levensbalk niet halfleeg op de foto staat, en dan meteen afdrukken
  await page.evaluate(() => {
    const g = window.__game;
    g.player.health = 100; g.hud.zetLeven(100);
  });
  await bevries();                      // ze schieten door terwijl het beeld staat
  await foto('bom_schutters', 250);
  await ontdooi();
} else {
  console.log('geen schutters in beeld');
}

await browser.close();

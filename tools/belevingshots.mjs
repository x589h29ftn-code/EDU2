/*
 Foto's van de belevingsronde van 22 september 2026:

   beleving_paniek.png    de buurt die wegrent bij de Poiesz in Duinterpen
   beleving_voorrang.png  een auto die afremt voor wie oversteekt

 De schrikgolf wordt hier rechtstreeks aangeroepen — `npcs.paniek` met dezelfde
 zeventig meter die de bom gebruikt — in plaats van de hele missie te spelen:
 een foto hoeft alleen te laten zien hóe het eruitziet. Dát de bom hem afvuurt
 staat in `npm run belevingtest`. De andere drie punten van deze ronde
 (herstelpunten, het verbod op De Veteraan, de ruimte in het geluid) zijn niet
 te fotograferen en staan alleen in die proef.

 Gebruik: npm run server &   node tools/belevingshots.mjs 8123 [map]
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
console.log('spel geladen');

const foto = async (naam, wacht = 900) => {
  await page.evaluate(() => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    g.hud.melding('', '', 0);
    g.hud.flitsT = 0; if (g.hud.flitsEl) g.hud.flitsEl.style.opacity = 0;
  });
  await page.waitForTimeout(wacht);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};

/*
 De camera op een plek zetten en naar een punt laten kijken. De speler staat op
 de grond, dus de camera hangt op ooghoogte: die hoogte hoort ook in de kijkhoek
 te zitten, anders kijk je over alles heen.
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

await page.evaluate(() => {
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true;
  g.sfeer.uur = 15; g.sfeer.weer = 'helder';
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
});

// --------------------------------------------- de buurt rent weg van de knal
const paniek = await page.evaluate(() => {
  const g = window.__game;
  const ing = g.supermarkt.ingangen.find(i => /duinterpen/i.test(i.naam));
  const d = ing.deur, f = ing.f;
  /*
   Niet zelf mensen neerzetten: de bevolking komt naar de speler toe (stap 36),
   dus de camera gaat eerst op zijn plek staan en dan lopen ze er vanzelf
   heen. Zelf een rij neerzetten werkte niet — de eerstvolgende stap zet ze
   weer op hun eigen route.
  */
  g.player.inCar = null;
  g.player.pos.set(d.x + f[0] * 20, 0, d.z + f[1] * 20);
  for (let i = 0; i < 120; i++) g.npcs.update(0.1, i * 0.1, g.player.pos.x, g.player.pos.z);
  const bij = () => g.npcs.people.filter(q => q.alive
    && Math.hypot(q.x - g.player.pos.x, q.z - g.player.pos.z) < 45);
  const dichtbij = bij().length;
  // dezelfde aanroep die de bom doet (BOM_PANIEK in js/verhaal.js)
  const gevlucht = g.npcs.paniek(g.player.pos.x, g.player.pos.z, 70);
  for (let i = 0; i < 8; i++) g.npcs.update(0.08, 100 + i * 0.08, g.player.pos.x, g.player.pos.z);
  return { deur: { x: d.x, z: d.z, fx: f[0], fz: f[1] }, gevlucht, dichtbij,
    rennend: bij().filter(q => q.paniek > 0).length };
});
console.log(`paniek: ${paniek.gevlucht} mensen op de vlucht,` +
  ` ${paniek.rennend} van de ${paniek.dichtbij} in beeld`);
{
  // blijven staan waar de mensen zijn, en naar de gevel kijken
  const d = paniek.deur;
  await kijk(d.x + d.fx * 20, d.z + d.fz * 20, d.x, d.z, 2.0);
  await foto('beleving_paniek');
}

// ------------------------------------------ een auto remt voor wie oversteekt
const weg = await page.evaluate(() => {
  const g = window.__game;
  // een rustig rijdende auto zoeken en er iemand voor laten oversteken
  const rijdend = g.vehicles.traffic.filter(a => a._pos && a._dir && a.snelheid > 3)
    .sort((a, b) => a.snelheid - b.snelheid);
  const t = rijdend[0];
  if (!t) return null;
  const p = g.npcs.people.find(q => q.alive);
  p.paniek = 0; p.opWeg = true; p.steek = 1;
  const voor = t.snelheid;
  /*
   De voetganger blijft de hele opname voor de auto staan en schuift langzaam
   dichterbij: hij loopt in het echt ook de weg op terwijl de auto nadert, en
   zo staat hij op de foto nog op de rijbaan in plaats van er net achter. Na
   elke verplaatsing moet `npcs.update` langskomen, anders verhuist alleen het
   getal en blijft het poppetje staan waar het liep.
  */
  const zet = (afstand, dt) => {
    p.x = t._pos.x + t._dir.x * afstand; p.z = t._pos.y + t._dir.y * afstand;
    g.npcs.update(dt, 200 + afstand, t._pos.x, t._pos.y);
  };
  for (let i = 0; i < 24; i++) {
    zet(Math.max(6, 12 - i * 0.25), 0.05);
    g.vehicles.updateTraffic(0.05, g.player, g.npcs.people, t._pos.x, t._pos.y);
  }
  zet(6, 0.001);                        // en vlak voor de foto nog één keer
  return { voor, na: t.snelheid,
    auto: { x: t.mesh.position.x, z: t.mesh.position.z },
    dir: { x: t._dir.x, z: t._dir.y }, mens: { x: p.x, z: p.z } };
});
if (weg) {
  console.log(`voorrang: ${weg.voor.toFixed(1)} → ${weg.na.toFixed(1)} m/s`);
  // schuin van voren, zodat de auto, de voetganger en de weg erbij staan
  const a = weg.auto, d = weg.dir, zij = { x: -d.z, z: d.x };
  await kijk(a.x + d.x * 11 + zij.x * 7, a.z + d.z * 11 + zij.z * 7,
    a.x + d.x * 3, a.z + d.z * 3, 1.3);
  await foto('beleving_voorrang');
} else {
  console.log('geen rijdende auto gevonden');
}

await browser.close();

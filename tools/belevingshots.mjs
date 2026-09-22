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
  /*
   De camera gaat naar de mensen toe, en niet andersom. Een voetganger staat
   niet op een plek maar op een wegvak (`p.seg`, `p.t` in js/npc.js): zijn x en
   z worden elk beeld opnieuw uit dat vak gerekend, dus wie hem verplaatst ziet
   hem één beeld later weer op zijn oude route lopen. Daarom wordt hier de
   drukste plek van de wijk opgezocht — waar de meeste mensen binnen veertig
   meter van elkaar lopen — en dáár gaat de camera staan.
  */
  const mensen = g.npcs.people.filter(q => q.alive);
  let mid = null, besteN = 0;
  for (const q of mensen) {
    const groep = mensen.filter(r => Math.hypot(r.x - q.x, r.z - q.z) < 40);
    if (groep.length > besteN) {
      besteN = groep.length;
      mid = { x: groep.reduce((s, r) => s + r.x, 0) / groep.length,
        z: groep.reduce((s, r) => s + r.z, 0) / groep.length };
    }
  }
  if (!mid) return null;
  g.player.inCar = null;
  g.player.pos.set(mid.x, 0, mid.z);
  // dezelfde aanroep die de bom doet (BOM_PANIEK in js/verhaal.js)
  const gevlucht = g.npcs.paniek(mid.x, mid.z, 70);
  for (let i = 0; i < 10; i++) g.npcs.update(0.1, 100 + i * 0.1, mid.x, mid.z);
  const bij = g.npcs.people.filter(q => q.alive && Math.hypot(q.x - mid.x, q.z - mid.z) < 40);
  return { mid, gevlucht, dichtbij: bij.length, rennend: bij.filter(q => q.paniek > 0).length };
});
if (paniek) {
  console.log(`paniek: ${paniek.gevlucht} mensen op de vlucht,` +
    ` ${paniek.rennend} van de ${paniek.dichtbij} in beeld`);
  const m = paniek.mid;
  await kijk(m.x + 14, m.z + 14, m.x, m.z, 1.6);
  await foto('beleving_paniek');
} else {
  console.log('geen mensen gevonden');
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
  const voor = t.snelheid;
  /*
   Een voetganger staat op een wegvak en niet op een plek (zie hierboven), dus
   hem naar de weg schuiven houdt geen beeld stand. In plaats daarvan krijgt hij
   een eigen wegvak: een lijntje dwars over de rijbaan, tien meter voor de auto.
   Met `walkOff: 0` valt de stoeprand-verschuiving weg en staat hij precies op
   die lijn; met `steek` staat hij midden in het oversteken, wat het verkeer
   ziet als iemand die de weg op stapt.
  */
  const dwars = { x: -t._dir.y, z: t._dir.x };
  const zet = (afstand) => {
    const m = { x: t._pos.x + t._dir.x * afstand, z: t._pos.y + t._dir.y * afstand };
    p.seg = { a: [m.x - dwars.x * 5, m.z - dwars.z * 5],
      b: [m.x + dwars.x * 5, m.z + dwars.z * 5], drive: true, w: 6, walkOff: 0 };
    p.t = 0.5; p.dir = 1; p.side = 0; p.steekVan = 0; p.steekNaar = 0;
    p.steek = 0.9; p.opWeg = true; p.pause = 0; p.paniek = 0; p.smak = null;
  };
  for (let i = 0; i < 24; i++) {
    zet(Math.max(7, 12 - i * 0.25));
    g.npcs.update(0.05, 200 + i * 0.05, t._pos.x, t._pos.y);
    g.vehicles.updateTraffic(0.05, g.player, g.npcs.people, t._pos.x, t._pos.y);
  }
  zet(7); g.npcs.update(0.001, 300, t._pos.x, t._pos.y);   // vlak voor de foto
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

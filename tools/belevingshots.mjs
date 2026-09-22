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

await page.evaluate(async () => {
  const g = window.__game;
  // vrij zicht van hier naar daar: dezelfde toets die het spel zelf gebruikt
  const { zichtVrij } = await import('/js/world.js');
  window.__zicht = (ax, az, bx, bz) => zichtVrij(ax, az, bx, bz, 1.6);
  /*
   Stil en weer op gang. Tussen het klaarzetten van een beeld en het afdrukken
   zitten op een softwarerenderer een paar seconden, en de hoofdlus loopt
   gewoon door: de vluchtende mensen zijn dan alweer de hoek om en de
   overstekende voetganger staat weer op zijn eigen route. Zolang de mensen en
   het verkeer stilstaan blijft staan wat er stond.
  */
  window.__stil = () => {
    if (!g.npcs.__echt) { g.npcs.__echt = g.npcs.update; g.npcs.update = () => {}; }
    if (!g.vehicles.__echt) {
      g.vehicles.__echt = g.vehicles.updateTraffic; g.vehicles.updateTraffic = () => {};
    }
  };
  window.__losser = () => {
    if (g.npcs.__echt) { g.npcs.update = g.npcs.__echt; g.npcs.__echt = null; }
    if (g.vehicles.__echt) { g.vehicles.updateTraffic = g.vehicles.__echt; g.vehicles.__echt = null; }
  };
  // ook bruikbaar als alles stilstaat: dan gaat het langs de bewaarde lus
  window.__mensen = (dt, t, x, z) => (g.npcs.__echt || g.npcs.update).call(g.npcs, dt, t, x, z);
  window.__verkeer = (dt, x, z) =>
    (g.vehicles.__echt || g.vehicles.updateTraffic)
      .call(g.vehicles, dt, g.player, g.npcs.people, x, z);
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
  window.__stil();
  /*
   De camera gaat op het punt van de schrik staan en kijkt de vluchters
   achterna. Ernaast gaan staan hielp niet: ze rennen van de knal weg, dus
   vanaf elk ander punt loopt de helft uit beeld. Vanaf de knal zelf lopen ze
   allemaal van je vandaan, en de dichtstbijzijnde met vrij zicht geeft de
   kijkrichting.
  */
  const weg = bij.filter(q => q.paniek > 0)
    .sort((a, b) => Math.hypot(a.x - mid.x, a.z - mid.z) - Math.hypot(b.x - mid.x, b.z - mid.z));
  const vrij = weg.find(q => window.__zicht(mid.x, mid.z, q.x, q.z)) || weg[0];
  const doel = vrij ? { x: vrij.x, z: vrij.z } : { x: mid.x + 10, z: mid.z };
  return { mid, doel, gevlucht, dichtbij: bij.length, rennend: weg.length };
});
if (paniek) {
  console.log(`paniek: ${paniek.gevlucht} mensen op de vlucht,` +
    ` ${paniek.rennend} van de ${paniek.dichtbij} in beeld`);
  const m = paniek.mid, d = paniek.doel;
  await kijk(m.x, m.z, d.x, d.z, 1.2);
  await foto('beleving_paniek');
} else {
  console.log('geen mensen gevonden');
}

// ------------------------------------------ een auto remt voor wie oversteekt
const weg = await page.evaluate(() => {
  const g = window.__game;
  window.__losser();
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
    window.__mensen(0.05, 200 + i * 0.05, t._pos.x, t._pos.y);
    window.__verkeer(0.05, t._pos.x, t._pos.y);
  }
  zet(7); window.__mensen(0.001, 300, t._pos.x, t._pos.y);  // vlak voor de foto
  window.__stil();                                          // en dan alles stil
  const a = { x: t.mesh.position.x, z: t.mesh.position.z };
  const d = { x: t._dir.x, z: t._dir.y }, zij = { x: -t._dir.y, z: t._dir.x };
  /*
   Een plek zoeken met vrij zicht op allebei. De eerste poging zette de camera
   op een vast punt schuin voor de auto en dat werd een close-up van een
   boomstam; nu worden een stuk of wat plekken langs de weg getoetst met
   `zichtVrij`, en die met zicht op zowel de auto als de voetganger wint.
  */
  let cam = null;
  for (const ver of [12, 15, 18]) {
    for (const opzij of [6, -6, 9, -9, 3, -3]) {
      const c = { x: a.x + d.x * ver + zij.x * opzij, z: a.z + d.z * ver + zij.z * opzij };
      if (window.__zicht(c.x, c.z, a.x, a.z) && window.__zicht(c.x, c.z, p.x, p.z)) { cam = c; break; }
    }
    if (cam) break;
  }
  return { voor, na: t.snelheid, a, d,
    cam: cam || { x: a.x + d.x * 12 + zij.x * 6, z: a.z + d.z * 12 + zij.z * 6 },
    vrij: !!cam, mens: { x: p.x, z: p.z } };
});
if (weg) {
  console.log(`voorrang: ${weg.voor.toFixed(1)} → ${weg.na.toFixed(1)} m/s` +
    `${weg.vrij ? '' : ' (geen plek met vrij zicht gevonden)'}`);
  // tussen de auto en de voetganger in kijken, zodat ze er allebei op staan
  const mik = { x: (weg.a.x + weg.mens.x) / 2, z: (weg.a.z + weg.mens.z) / 2 };
  await kijk(weg.cam.x, weg.cam.z, mik.x, mik.z, 1.3);
  await foto('beleving_voorrang');
} else {
  console.log('geen rijdende auto gevonden');
}

await browser.close();

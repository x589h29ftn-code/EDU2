// Test geluid, remmend verkeer, oversteken en fietsers.
import { chromium } from 'playwright';
const port = process.argv[2] || '8123';
const b = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'],
});
const p = await b.newPage({ viewport: { width: 1100, height: 640 } });
p.on('pageerror', e => console.log('[pageerror]', e.message));
p.on('console', m => { if (m.type()==='error' && !m.text().includes('404')) console.log('[fout]', m.text()); });
await p.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await p.waitForFunction(() => window.__game, null, { timeout: 90000 });
await p.evaluate(() => { localStorage.clear(); window.__autoplay = true; document.getElementById('overlay').style.display='none'; });
await p.waitForTimeout(900);

// --- geluid ---
const g1 = await p.evaluate(async () => {
  const { geluid } = await import('./js/audio.js');
  geluid.start();
  return { gestart: !!window.__geluid, actief: geluid.actief };
});
console.log('geluid gestart:', g1.gestart, '· actief:', g1.actief);
const g2 = await p.evaluate(async () => {
  const { geluid } = await import('./js/audio.js');
  // roep alles een keer aan; een fout hier zou als pageerror binnenkomen
  geluid.schot(); geluid.herladen(); geluid.voetstap('klinker'); geluid.voetstap('gras');
  geluid.voetstap('tegel', true); geluid.sprong(); geluid.landing(); geluid.portier();
  geluid.raak(); geluid.klap();
  geluid.motorAan(); geluid.motorToeren(14); geluid.motorUit();
  geluid.omgeving(0.016, { weer: 'regen', nacht: false });
  geluid.omgeving(0.016, { weer: 'helder', nacht: true });
  return 'alle geluiden aangeroepen zonder fout';
});
console.log(g2);
const ondergrond = await p.evaluate(async () => {
  const w = await import('./js/world.js');
  const d = await import('./js/data.js');
  // loop dwars op de Molenkrite naar buiten en kijk waar de ondergrond wisselt
  const uit = {};
  for (let m = 0; m <= 14; m++) {
    const [x, z] = d.toWorld(405 + m * 3.26 * 0.64, 1222 - m * 3.26 * 0.77);
    uit[m + ' m'] = w.ondergrondOp(x, z);
  }
  return uit;
});
console.log('ondergrond:', JSON.stringify(ondergrond));

// --- verkeer remt ---
const verkeer = await p.evaluate(async () => {
  const g = window.__game;
  // een auto in de wijk, niet op de snelweg (die rijdt 22-30 m/s)
  g.vehicles.updateTraffic(0.016, g.player, g.npcs.people);
  const t = g.vehicles.traffic.find(x => x.speed < 12);
  const vrijeSnelheid = t.snelheid;
  g.player.inCar = null;
  // de speler blijft zeven meter voor de auto staan, anders rijdt hij er zo langs
  for (let i = 0; i < 60; i++) {
    g.player.pos.set(t._pos.x + t._dir.x * 7, 0, t._pos.y + t._dir.y * 7);
    g.vehicles.updateTraffic(0.05, g.player, g.npcs.people);
  }
  const geremd = t.snelheid;
  // speler weghalen, auto moet weer optrekken
  g.player.pos.set(t._pos.x + 300, 0, t._pos.y + 300);
  for (let i = 0; i < 120; i++) g.vehicles.updateTraffic(0.05, g.player, g.npcs.people);
  return { vrij: +vrijeSnelheid.toFixed(2), geremd: +geremd.toFixed(2), weerOp: +t.snelheid.toFixed(2), vrijeSnelheidVanDezeAuto: +t.speed.toFixed(2) };
});
console.log('verkeer:', JSON.stringify(verkeer));

// --- fietsers en oversteken ---
const mensen = await p.evaluate(() => {
  const ps = window.__game.npcs.people;
  return { totaal: ps.length, fietsers: ps.filter(p => p.fietst).length };
});
console.log('mensen:', JSON.stringify(mensen));
const steken = await p.evaluate(() => {
  const g = window.__game;
  let max = 0;
  for (let i = 0; i < 1400; i++) {   // ongeveer een halve minuut spel
    g.npcs.update(0.02, i * 0.02);
    const n = g.npcs.people.filter(p => p.opWeg).length;
    if (n > max) max = n;
  }
  return { tegelijkOversteken: max, nuOpWeg: g.npcs.people.filter(p => p.opWeg).length };
});
console.log('oversteken:', JSON.stringify(steken));

await p.evaluate(() => { const g = window.__game; g.player.pos.set((405-370)/3.26, 0, (1222-1245)/3.26); g.player.yaw=-0.88; g.player.pitch=0; });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'shots/levend.png' });
console.log('render', await p.evaluate(() => ({ calls: window.__game.renderer.info.render.calls, tris: window.__game.renderer.info.render.triangles })));
await b.close();

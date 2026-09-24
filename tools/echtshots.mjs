/*
 Foto's van de ronde "realistischer" (24 sep 2026): de wapens en de auto's in
 de wereld, met de echte lucht als omgeving.

   wapen_echt_pistool.png      het pistool in de aanslag: geblauwd staal,
                               kunststof onderstel met stippels op de greep
   wapen_echt_schot.png        60 ms na een schot: de huls in de lucht, de
                               slede terug, mondingsvuur en een wolkje damp
   wapen_echt_sniper.png       de sniper met de grendel open, na het schot
   mens_echt_gezicht.png       een meespelend personage van dichtbij: gezicht,
                               ronde romp, breisteek en spijkerstof
   mens_echt_straat.png        voetgangers op straat (de instanced mensen)
   auto_echt_straat.png        een geparkeerde auto schuin van achteren: ronde
                               randen, lak met een laklaag, achterlichten
   auto_echt_voor.png          van voren: koplampen en het gele kenteken

 Gebruik: npm run server &   node tools/echtshots.mjs 8123 [map]
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
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

await page.evaluate(() => {
  const g = window.__game;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = true; window.__autoplay = true;
  g.reliëfAf();
  g.sfeer.uur = 15; g.sfeer.weer = 'helder';
  for (let i = 0; i < 5; i++) g.sfeer.update(0.1, g.camera.position.x, g.camera.position.z);
  g.werkOmgevingBij(7);
});
// alles stil zetten en zelf één beeld tekenen, met de wapenpas erbij
const teken = () => page.evaluate(() => {
  const g = window.__game;
  g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
  if (g.uitleg) g.uitleg.update(999);
  g.zetSchaduwDoos(g.camera.position.x, g.camera.position.z);
  g.renderer.render(g.scene, g.camera);
  if (g.player.gun && g.player.gun.visible) g.tekenWapen();
});
const foto = async (naam) => {
  await teken();
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};

// ---- de wapens, op straat met de gevels erachter
await page.evaluate(() => {
  const g = window.__game, p = g.player, s = g.start;
  p.inCar = null;
  p.pos.set(s.x, 0, s.z); p.yaw = s.yaw || 0; p.pitch = 0.02;
  p.wapenUit = false;
  for (let i = 0; i < 40; i++) p.update(1 / 60);
});
await foto('wapen_echt_pistool');
await page.evaluate(() => {
  const g = window.__game, p = g.player;
  p.ammo = 12; p.vuurKlok = 0; p.shoot();
  for (let i = 0; i < 4; i++) p.wapen.update(1 / 60, { yaw: p.yaw, pitch: p.pitch });
  p.kickPitch = 0; p.kickYaw = 0; p.applyCamera();
  g.player.wapen.delen.flits.visible = true;           // het vuur van het schot zelf erbij
});
await foto('wapen_echt_schot');
await page.evaluate(() => {
  const g = window.__game, p = g.player;
  p.krijgWapen('sniper');
  for (let i = 0; i < 80; i++) p.update(1 / 60);
  p.wapen.vuur();
  for (let i = 0; i < 20; i++) p.wapen.update(1 / 60, { yaw: p.yaw, pitch: p.pitch });
  p.kickPitch = 0; p.kickYaw = 0; p.applyCamera();
});
await foto('wapen_echt_sniper');

// ---- de poppetjes: een personage van dichtbij en de voetgangers op straat
await page.evaluate(async () => {
  const g = window.__game, p = g.player, s = g.start;
  const { Persoon } = await import('/js/persoon.js');
  p.wapenUit = true; if (p.gun) p.gun.visible = false;
  // twee mensen naast elkaar, anderhalve meter voor de camera, naar je toe
  const vx = -Math.sin(p.yaw), vz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
  window.__poppen = [
    new Persoon({ shirt: 0xb03a2e, broek: 0x2c3e66, huid: 0xe0b896, haar: 0x3a2616 }),
    new Persoon({ shirt: 0x2e7d4f, broek: 0x3b3b3b, huid: 0x8d5a3b, haar: 0x111111, korteMouw: true }),
  ];
  window.__poppen.forEach((q, i) => {
    q.groep.position.set(p.pos.x + vx * 1.9 + rx * (i - 0.5) * 0.9, 0, p.pos.z + vz * 1.9 + rz * (i - 0.5) * 0.9);
    q.groep.rotation.y = p.yaw + Math.PI + (i - 0.5) * 0.5;      // naar de camera toe
    q.groep.traverse(o => { o.frustumCulled = false; });
    g.scene.add(q.groep);
  });
  p.pitch = -0.12; p.applyCamera();
});
await foto('mens_echt_gezicht');
await page.evaluate(() => {
  const g = window.__game, p = g.player;
  for (const q of window.__poppen) g.scene.remove(q.groep);
  // de dichtstbijzijnde voetganger die loopt, en de camera op vijf meter
  const ik = { x: p.pos.x, z: p.pos.z };
  const mensen = g.npcs.people.filter(q => q.x !== undefined && !q.fietst);
  const q = mensen.map(q => ({ q, d: Math.hypot(q.x - ik.x, q.z - ik.z) })).sort((a, b) => a.d - b.d)[0].q;
  // vóór hem, in de richting waarin hij loopt (hij kijkt langs zijn eigen −z)
  const kx = -Math.sin(q.yaw || 0), kz = -Math.cos(q.yaw || 0);
  p.pos.set(q.x + kx * 4.5 + kz * 1.2, 0, q.z + kz * 4.5 - kx * 1.2);
  p.yaw = Math.atan2(-(q.x - p.pos.x), -(q.z - p.pos.z)); p.pitch = -0.10;
  p.applyCamera();
});
await foto('mens_echt_straat');

// ---- een geparkeerde auto vlak bij het begin
const auto = await page.evaluate(() => {
  const g = window.__game, p = g.player, s = g.start;
  p.wapenUit = true; if (p.gun) p.gun.visible = false;
  const c = g.vehicles.cars.filter(c => !c.driveable || true)
    .map(c => ({ c, d: Math.hypot(c.x - s.x, c.z - s.z) })).filter(o => o.d > 4).sort((a, b) => a.d - b.d)[0].c;
  return { x: c.x, z: c.z, yaw: c.yaw };
});
await page.evaluate(({ x, z, yaw }) => {
  const g = window.__game, p = g.player;
  // de neus van de auto wijst naar (−sin yaw, −cos yaw); dit is de andere
  // kant, dus schuin van achteren
  const vx = Math.sin(yaw), vz = Math.cos(yaw), zx = Math.cos(yaw), zz = -Math.sin(yaw);
  const cx = x + vx * 4.2 + zx * 2.6, cz = z + vz * 4.2 + zz * 2.6;
  p.pos.set(cx, -0.2, cz);
  p.yaw = Math.atan2(-(x - cx), -(z - cz)); p.pitch = -0.16;
  p.applyCamera();
}, auto);
await foto('auto_echt_straat');
await page.evaluate(({ x, z, yaw }) => {
  const g = window.__game, p = g.player;
  const ax = -Math.sin(yaw), az = -Math.cos(yaw);
  const cx = x + ax * 5.6, cz = z + az * 5.6;
  p.pos.set(cx, -0.35, cz);
  p.yaw = Math.atan2(-(x - cx), -(z - cz)); p.pitch = -0.16;
  p.applyCamera();
}, auto);
await foto('auto_echt_voor');
await browser.close();

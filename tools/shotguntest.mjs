/*
 Proef bij stap 189 (npm run shotguntest): het pompgeweer. Gevraagd: "doe een pompgeweer, shotgun, ww2 stijl".

 1. Kopen bij Tinga State: € 1.200, met te weinig geld niet, daarna in je hand met zes patronen en 24 erbij; een tweede niet.
 2. Eén schot = negen korrels in een kegel om de kijkrichting (over de korrel smaller), elk een eigen straal tot 42 m.
 3. Pompen: na een schot gaat het voorhout naar achteren en terug, de haan wordt gespannen, er vliegt een huls uit,
    twee keer het pompgeluid; binnen het pompen schiet een klik niet, daarna wel.
 4. Herladen patroon voor patroon: één per 0,55 s, tot de buis vol is of de voorraad op; de hand drukt er telkens een in;
    schieten breekt het laden af; leeg geladen pompt hij er na de laatste een in de kamer.
 5. Raak: een voetganger op 4 m gaat in één schot neer (meerdere korrels); op 60 m komt er niets aan (bereik).
    Een omstander, de politie en het verhaal krijgen elk hun eigen korrels; de kreet één keer per schot.
 6. In beeld: "Pompgeweer · 6 / …", en "laden… 3 / 6" tijdens het laden.
 7. Opslaan en laden houdt het wapen en de patronen in de buis.
 8. Geen nieuw shaderprogramma: schieten, pompen en laden met het pompgeweer.
 9. (stap 190) Het model op de maten van de M1897 (99,7 cm, loop 50,8 cm), het hitteschild boven de loop, en de opnames
    van de gebruiker voor het schot en het pompen.

 Gebruik: npm run server &  node tools/shotguntest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fouten++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, P = g.player;
  P.active = false; window.__autoplay = false;
  g.politie.proefStil = true;
  P.wapenUit = false; P.binnen = false; P.vuurSlot = false; P.oneindig = false;
  window.__stap = (n = 1, dt = 0.05) => { for (let i = 0; i < n; i++) { P.health = 100; P.update(dt); } };
  window.__klaar = () => { for (let i = 0; i < 80 && (P.wisselT > 0 || P.vuurKlok > 0 || P.reloading > 0); i++) window.__stap(1); };
});

kop('1. kopen');
const koop = await page.evaluate(async () => {
  const g = window.__game, P = g.player, v = g.verhaal;
  const { SHOTGUN } = await import('/js/boerderij.js');
  v.betaal(v.geld);
  const arm = g.boerderij.koopWapen('shotgun');
  const naArm = P.wapens.includes('shotgun');
  const inSchap = g.boerderij.schap.find(a => a.sleutel === 'shotgun');
  v.verdien(2000);
  const voor = v.geld, reserveVoor = P.reserve;
  const uit = g.boerderij.koopWapen('shotgun');
  window.__klaar();
  return { prijs: SHOTGUN.prijs, arm, naArm, inSchap: !!inSchap, voor, na: v.geld, uit, soort: P.wapenSoort, ammo: P.ammo,
    erbij: P.reserve - reserveVoor, nogmaals: g.boerderij.koopWapen('shotgun') };
});
ok(koop.prijs === 1200 && koop.inSchap, 'het pompgeweer ligt voor € 1.200 in het schap');
ok(koop.arm === 'arm' && !koop.naArm, 'met te weinig geld niet', koop.arm);
ok(koop.uit === 'ok' && koop.na === koop.voor - 1200 && koop.soort === 'shotgun', 'gekocht, € 1.200 eraf, in je hand', `${koop.soort}`);
ok(koop.ammo === 6 && koop.erbij === 24, 'zes patronen in de buis en 24 erbij', `${koop.ammo}, +${koop.erbij}`);
ok(koop.nogmaals === 'heeft', 'een tweede kopen kan niet');

kop('2. hagel');
const hagel = await page.evaluate(async () => {
  const g = window.__game, P = g.player, THREE = await import('three');
  const { WAPENS } = await import('/js/player.js');
  const W = WAPENS.shotgun;
  const echte = P.shootCb; let opt = null;
  P.shootCb = (o, d, x) => { opt = x; };
  const kegel = (mik) => {
    P.mik = mik; P.ammo = 6; P.vuurKlok = 0; P.reloading = 0;
    let max = 0;
    for (let k = 0; k < 20; k++) {
      P.vuurKlok = 0; P.ammo = 6; P.shoot();
      const d = new THREE.Vector3(); P.camera.getWorldDirection(d);
      for (const q of opt.korrels) max = Math.max(max, Math.acos(Math.min(1, q.dot(d))));
    }
    return max;
  };
  P.vuurKlok = 0; P.ammo = 6; P.shoot();
  const n = opt.korrels.length, bereik = opt.bereik;
  const heup = kegel(0), mik = kegel(1);
  P.mik = 0; P.shootCb = echte;
  return { n, bereik, heup, mik, hagel: W.hagel };
});
ok(hagel.n === 9 && hagel.bereik === 42, 'negen korrels per schot, bereik 42 m', `${hagel.n}, ${hagel.bereik}`);
ok(hagel.heup <= hagel.hagel * 1.01 && hagel.heup > hagel.hagel * 0.6, 'uit de heup in een kegel van 0,075 rad', hagel.heup.toFixed(3));
ok(hagel.mik < hagel.heup * 0.85, 'over de korrel smaller', `${hagel.mik.toFixed(3)} tegen ${hagel.heup.toFixed(3)}`);

kop('3. pompen');
const pomp = await page.evaluate(async () => {
  const g = window.__game, P = g.player, w = P.modellen.shotgun;
  const echte = P.shootCb; P.shootCb = null;
  P.zetWapen('shotgun'); window.__klaar();
  const pompen0 = g.geluid.pompen || 0;
  P.ammo = 6; P.vuurKlok = 0; P.mik = 0;
  P.shoot();
  const naSchot = P.ammo;
  let maxPomp = 0, hulzen = 0, haanAf = w.haan;
  const klik = []; let n = 0;
  for (let i = 0; i < 24; i++) {
    window.__stap(1, 0.025); n++;
    maxPomp = Math.max(maxPomp, w.pompStand); hulzen = Math.max(hulzen, w.hulzenInDeLucht);
    if (i === 8) { P.shoot(); klik.push(P.ammo); }     // na 0,225 s: hoort niet te schieten
  }
  const eindPomp = w.pompStand, gespannen = w.haanGespannen;
  for (let i = 0; i < 20; i++) window.__stap(1, 0.025);
  P.shoot(); klik.push(P.ammo);
  P.shootCb = echte;
  return { naSchot, maxPomp, eindPomp, hulzen, haanAf, gespannen, klik, pompen: (g.geluid.pompen || 0) - pompen0 };
});
ok(pomp.naSchot === 5, 'een schot kost één patroon', `${pomp.naSchot}`);
ok(pomp.maxPomp > 0.95 && pomp.eindPomp < 0.02, 'het voorhout gaat helemaal naar achteren en weer terug', `${pomp.maxPomp.toFixed(2)} → ${pomp.eindPomp.toFixed(2)}`);
ok(pomp.hulzen >= 1, 'er vliegt een huls uit');
ok(pomp.gespannen, 'de haan is weer gespannen', `haan ${pomp.haanAf.toFixed(2)} rad bij het schot`);
ok(pomp.pompen >= 1, 'het pompgeluid', `${pomp.pompen}`);
ok(pomp.klik[0] === 5 && pomp.klik[1] === 4, 'tijdens het pompen schiet een klik niet, daarna wel', pomp.klik.join(' → '));

kop('4. herladen per patroon');
const laad = await page.evaluate(async () => {
  const g = window.__game, P = g.player, w = P.modellen.shotgun;
  const echte = P.shootCb; P.shootCb = null;
  window.__klaar();
  P.ammo = 2; P.reserve = 3;
  const in0 = w.ingeladen, ins0 = g.geluid.hagelIns || 0;
  P.reload();
  const tekst = [];
  const verloop = [];
  for (let i = 0; i < 60; i++) { window.__stap(1, 0.05); if (i % 11 === 10) verloop.push(P.ammo); if (i === 15) { window.__game.hud.update && 0; } }
  const naVol = { ammo: P.ammo, reserve: P.reserve, reloading: P.reloading, ingeladen: w.ingeladen - in0, geluid: (g.geluid.hagelIns || 0) - ins0 };
  // afbreken: laden, en na één patroon schieten
  P.ammo = 2; P.reserve = 20; P.vuurKlok = 0;
  P.reload();
  for (let i = 0; i < 13; i++) window.__stap(1, 0.05);
  const voorSchot = P.ammo;
  P.shoot();
  const afgebroken = { voorSchot, na: P.ammo, reloading: P.reloading };
  // leeg laden: na de laatste een pomp
  window.__klaar();
  P.ammo = 0; P.reserve = 2; P.reload();
  let pompNa = 0;
  for (let i = 0; i < 40; i++) { window.__stap(1, 0.05); if (P.reloading <= 0) pompNa = Math.max(pompNa, w.pompStand); }
  const leeg = { ammo: P.ammo, pompNa };
  P.shootCb = echte;
  return { naVol, verloop, afgebroken, leeg };
});
ok(laad.naVol.ammo === 5 && laad.naVol.reserve === 0 && laad.naVol.reloading <= 0, 'twee + drie: tot de voorraad op is', `${laad.naVol.ammo} in de buis, ${laad.naVol.reserve} over`);
ok(laad.verloop[0] < laad.verloop[2], 'één voor één', laad.verloop.join(' → '));
ok(laad.naVol.ingeladen === 3 && laad.naVol.geluid === 3, 'de hand drukt er drie in, drie klikjes', `${laad.naVol.ingeladen}, ${laad.naVol.geluid}`);
ok(laad.afgebroken.voorSchot === 3 && laad.afgebroken.na === 2 && laad.afgebroken.reloading === 0, 'schieten breekt het laden af', `${laad.afgebroken.voorSchot} → ${laad.afgebroken.na}`);
ok(laad.leeg.ammo === 2 && laad.leeg.pompNa > 0.9, 'leeg geladen: na de laatste pompt hij er een in de kamer', `pomp ${laad.leeg.pompNa.toFixed(2)}`);

kop('5. raak');
const raak = await page.evaluate(async () => {
  const g = window.__game, P = g.player, THREE = await import('three');
  P.zetWapen('shotgun'); window.__klaar();
  const kreten = { n: 0 }; const kreet = g.geluid.kreet.bind(g.geluid);
  g.geluid.kreet = (...a) => { if (a[0] === 'pijn') kreten.n++; return kreet(...a); };
  g.derde.aan = false;
  // een voetganger op een eigen wegvak naast de camera (zoals tools/wapentest.mjs), zodat hij een lichaam heeft
  const zet = (q, x, z) => {
    q.seg = { a: [x, z - 6], b: [x, z + 6], w: 5, walkOff: 2, drive: false, name: 'proef' };
    q.t = 0.5; q.dir = 1; q.side = 0; q.steek = 0; q.pause = 0; q.alive = true; q.raken = 0; q.fall = 0; q.respawn = 0;
    q.paniek = 0; q.vNu = 0; q.smak = null; q.speed = 0; q.slaapt = false;
    for (let k = 0; k < 3; k++) g.npcs.update(0.016, performance.now() / 1000, x + 3, z);
    g.scene.updateMatrixWorld(true);
  };
  const schiet = (q, afstand) => {
    const doel = new THREE.Vector3(q.x, 1.2, q.z);
    const van = doel.clone().add(new THREE.Vector3(afstand, 0.25, 0));
    const dir = doel.clone().sub(van).normalize();
    const zij = new THREE.Vector3(dir.z, 0, -dir.x).normalize(), op = new THREE.Vector3().crossVectors(zij, dir).normalize();
    const korrels = [];
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, r = Math.sqrt((i + 0.5) / 9) * 0.075; korrels.push(dir.clone().addScaledVector(zij, Math.cos(a) * r).addScaledVector(op, Math.sin(a) * r).normalize()); }
    P.shootCb(van, dir, { korrels, bereik: 42 });
  };
  const levend = () => g.npcs.people.filter(p => p.alive && !p.slaapt && !p.verborgen && !p.fietst && !p.doe);
  const c = g.camera.position;
  const q = levend()[0];
  zet(q, c.x, c.z);
  const k0 = kreten.n;
  schiet(q, 4);
  const dichtbij = { neer: !q.alive, raken: q.raken || 0, kreten: kreten.n - k0 };
  const q2 = levend()[0];
  zet(q2, c.x, c.z);
  schiet(q2, 60);
  const ver = q2.alive && !(q2.raken > 0);
  g.geluid.kreet = kreet;
  return { dichtbij, ver };
});
ok(raak.dichtbij.neer, 'een voetganger op 4 m gaat in één schot neer', `raken ${raak.dichtbij.raken}`);
ok(raak.dichtbij.kreten === 1, 'met één kreet, niet negen', `${raak.dichtbij.kreten}`);
ok(raak.ver, 'op 60 m komt er niets aan (bereik 42 m)');

kop('6. in beeld');
const hud = await page.evaluate(() => {
  const g = window.__game, P = g.player;
  window.__klaar();
  P.zetWapen('shotgun'); window.__klaar(); P.ammo = 6; P.reserve = 24;
  g.hud.update(0.016, P, g.vehicles, g.npcs, '');
  const vol = document.getElementById('ammo').textContent;
  P.ammo = 3; P.reload(); window.__stap(1);
  g.hud.update(0.016, P, g.vehicles, g.npcs, '');
  const laden = document.getElementById('ammo').textContent;
  window.__klaar();
  return { vol, laden };
});
ok(hud.vol === 'Pompgeweer · 6 / 24', 'de naam en de patronen', `"${hud.vol}"`);
ok(hud.laden === 'laden… 3 / 6', 'tijdens het laden telt hij mee', `"${hud.laden}"`);

kop('7. opslaan en laden');
const opslag = await page.evaluate(async () => {
  const g = window.__game, P = g.player;
  const O = await import('/js/opslag.js');
  P.zetWapen('shotgun'); window.__klaar(); P.ammo = 4;
  O.bewaarSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: g.verhaal });
  P.wapens = ['pistool', 'mes']; P.zetWapen('pistool');
  O.laadSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: g.verhaal });
  window.__stap(10);
  const r = { wapens: P.wapens.slice(), soort: P.wapenSoort, ammo: P.ammo };
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  return r;
});
ok(opslag.wapens.includes('shotgun') && opslag.soort === 'shotgun' && opslag.ammo === 4, 'na laden het pompgeweer in je hand, met vier in de buis', `${opslag.soort}, ${opslag.ammo}`);

kop('8. geen nieuw shaderprogramma');
const sh = await page.evaluate(async () => {
  const g = window.__game, P = g.player, R = g.renderer;
  if (!R || !g.tekenWapen) return { overgeslagen: true };
  for (let i = 0; i < 600 && !(R.info.programs && R.info.programs.length > 20); i++) await new Promise(r => setTimeout(r, 100));
  const echte = P.shootCb; P.shootCb = null;
  const ronde = (soort) => {
    P.zetWapen(soort); P.wisselT = 0; P.holster = 0; P.reserve = Math.max(P.reserve, 50);
    window.__stap(2);
    P.ammo = 1; P.vuurKlok = 0; P.shoot();
    for (let i = 0; i < 24; i++) { window.__stap(1, 0.03); P.gun.visible = true; g.tekenWapen(); }
    P.reload();
    for (let i = 0; i < 40; i++) { window.__stap(1, 0.04); P.gun.visible = true; g.tekenWapen(); }
  };
  ronde('pistool'); ronde('garand');
  const voor = R.info.programs.length;
  ronde('shotgun');
  P.shootCb = echte;
  return { voor, na: R.info.programs.length };
});
if (sh.overgeslagen) ok(false, 'geen renderer of tekenWapen in __game');
else ok(sh.na === sh.voor, 'het pompgeweer vertaalt geen nieuw programma', `${sh.voor} → ${sh.na}`);

kop('9. het model (stap 190) en de opnames');
const mdl = await page.evaluate(async () => {
  const g = window.__game, P = g.player, THREE = await import('three');
  const w = P.modellen.shotgun, wap = w.groep.children[0];
  w.groep.updateMatrixWorld(true);
  const inv = wap.matrixWorld.clone().invert();
  // de lengte van het geweer zelf: alle meshes van het wapen, zonder de linkerhand en de patroon in die hand, en zonder het vuur
  const weg = new Set();
  for (const o of [w.delen.linkerhand, w.delen.flits]) o.traverse(q => weg.add(q));
  const box = new THREE.Box3(), v = new THREE.Vector3();
  wap.traverse(o => {
    if (!o.isMesh || weg.has(o)) return;
    const pos = o.geometry.attributes.position, m = inv.clone().multiply(o.matrixWorld);
    for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k).applyMatrix4(m); box.expandByPoint(v); }
  });
  // het hitteschild ligt bóven de loop: een straal recht omlaag midden boven het schild raakt eerst het schild
  const M = w.meetpunten, ray = new THREE.Raycaster();
  ray.layers.enableAll();            // (het wapen staat op laag 1)
  const raakY = (x, z) => {
    const van = new THREE.Vector3(x, 0.3, z).applyMatrix4(wap.matrixWorld);
    const dir = new THREE.Vector3(0, -1, 0).transformDirection(wap.matrixWorld);
    ray.set(van, dir);
    const h = ray.intersectObject(wap, true).find(q => !weg.has(q.object));
    return h ? +h.point.clone().applyMatrix4(inv).y.toFixed(4) : null;
  };
  const schildMidden = (w.maat.schild[0] + w.maat.schild[1]) / 2;
  const geluid = g.geluid;
  geluid.start && geluid.start();
  await Promise.all([geluid.laadSchot(), geluid.laadWapenOpnames()]);
  const op = geluid.wapenOpnameStand();
  P.shootCb = null;
  P.zetWapen('shotgun'); window.__klaar();
  P.ammo = 6; P.vuurKlok = 0; P.shoot();
  const schot = geluid.schotStand().laatste;
  for (let k = 0; k < 10; k++) window.__stap(1, 0.025);
  return {
    lengte: +(box.max.z - box.min.z).toFixed(3), achter: +box.max.z.toFixed(3), voor: +box.min.z.toFixed(3),
    loop: +(w.maat.kastVoor - w.maat.mond).toFixed(3),
    schildY: raakY(0.003, schildMidden), loopY: M.loopY, slede: raakY(0, M.hz - 0.06),
    op: { shotgun: op.shotgun, pomp: op.pomp }, schot, pomp: op.laatstePomp || geluid.wapenOpnameStand().laatstePomp,
  };
});
ok(mdl.lengte > 0.985 && mdl.lengte < 1.015, 'het geweer is 99,7 cm lang (39¼ inch)', `${mdl.lengte} m, van ${mdl.achter} tot ${mdl.voor}`);
ok(Math.abs(mdl.loop - 0.508) < 0.002, 'met een loop van 50,8 cm (20 inch)', `${mdl.loop} m`);
ok(mdl.schildY !== null && mdl.schildY > mdl.loopY + 0.016, 'het hitteschild ligt boven op de loop', `geraakt op y ${mdl.schildY}, loop ${mdl.loopY}`);
ok(mdl.op.shotgun && mdl.op.shotgun.duur > 3.3 && mdl.op.shotgun.duur < 3.6, 'de opname van het schot is geladen (3,5 s)', JSON.stringify(mdl.op.shotgun));
ok(mdl.op.pomp && mdl.op.pomp.duur > 0.5 && mdl.op.pomp.duur < 0.8, 'de opname van het pompen ook', JSON.stringify(mdl.op.pomp));
ok(mdl.schot && mdl.schot.bestand === 'shotgun_schot.mp3' && Math.abs(mdl.schot.gain - 0.32) < 0.01, 'een schot speelt shotgun_schot.mp3 op 0,32', JSON.stringify(mdl.schot));
ok(mdl.pomp && mdl.pomp.opname === true, 'en het pompen speelt de opname', JSON.stringify(mdl.pomp));

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);

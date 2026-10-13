/*
 Stap 160: de shop van de BP aan de Lemmerweg van binnen (npm run bptest). Gevraagd: "Maak de BP zo dat je er in kan gaan
 met schuifdeuren net als het autogarage. Met een balie en medewerker erachter. Voor nu kan je er niks dan rondlopen."

   1. de shop staat op zijn voetafdruk (BAG 0091100000004556): van boven raak je zijn dak, niet het oude blok;
   2. de schuifdeuren: dicht als er niemand is, open binnen een seconde als je ervoor staat, weer dicht als je weggaat;
      de botsdoos van de deur gaat mee;
   3. lopen (met `resolveCollisions`, zoals js/player.js): door de open deur naar binnen, door de dichte niet; links en
      rechts van de deur houdt de pui je tegen, net als de zij- en achtermuren van binnenuit;
   4. binnen rondlopen: tussen de gondels door, langs de koelvitrine, van het oostdeel naar het westdeel en naar de balie;
   5. de balie houdt je tegen, de medewerker staat erachter (verder van de deur dan de balie), kijkt naar de deur en
      draait naar je toe;
   6. geen gras, bomen of rommel in de shop;
   7. de pompen onder de luifel: elk met een plint, displays aan beide kanten, zes pistolen met elk een slang die van de kop
      naar het pistool loopt en niet door de grond gaat, het nummer, ongeveer 2 m hoog en een botsdoos;
   8. geen nieuw shaderprogramma als de shop of de pompen in beeld komen, overdag; 's nachts hoogstens de eigen twee van de shop
      bij de eerste blik (open punt 30).

 Gebruik: npm run server &  node tools/bptest.mjs [poort]
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fout = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`); if (!goed) fout++; };
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
page.setDefaultTimeout(900000);
page.on('pageerror', e => { console.log('[pageerror]', e.message); fout++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });

const r = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game, W = await import('./js/world.js');
  const { BP_WINKEL, inBpWinkel } = await import('./js/bouwvlak.js');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = false; window.__autoplay = false;
  await g.voorbereidSpel();
  const S = g.bpshop, uit = { er: !!S };
  if (!S) return uit;
  const yaw0 = S.medewerker.yaw;   // vóór er iemand in de buurt was
  const P = S.wereld, A = BP_WINKEL.west, O = BP_WINKEL.oost;
  W.updateLOD(...P(10, 5)); g.scene.updateMatrixWorld(true);

  // ---- 1. van boven
  const [mx, mz] = P(14, 6);
  const rc = new THREE.Raycaster(new THREE.Vector3(mx, 40, mz), new THREE.Vector3(0, -1, 0), 0, 60);
  const boven = rc.intersectObjects(g.scene.children, true).filter(h => h.object.visible && h.object.isMesh);
  uit.boven = boven.slice(0, 2).map(h => ({ klasse: h.object.userData.klasse || h.object.name || '?', y: +h.point.y.toFixed(2) }));

  // ---- 2. de deur
  const ver = { x: S.deur.x + 50, z: S.deur.z, y: 0 };
  const bij = (() => { const [x, z] = P((S.deur.u0 + S.deur.u1) / 2, S.deur.w - 1.5); return { x, z, y: 0 }; })();
  for (let i = 0; i < 40; i++) S.update(0.05, [ver]);
  const dicht0 = { open: S.deur.open, h: S.deur.bots ? S.deur.bots.h : -1 };
  let tijd = 0; while (S.deur.open < 1 && tijd < 3) { S.update(0.05, [bij]); tijd += 0.05; }
  const open1 = { open: S.deur.open, tijd: +tijd.toFixed(2), h: S.deur.bots ? S.deur.bots.h : -1 };
  const bladOpen = S.bladen.map(b => b.position.clone());
  tijd = 0; while (S.deur.open > 0 && tijd < 3) { S.update(0.05, [ver]); tijd += 0.05; }
  uit.deur = { dicht0, open1, dicht2: { open: S.deur.open, tijd: +tijd.toFixed(2), h: S.deur.bots ? S.deur.bots.h : -1 },
    schuif: +bladOpen[0].distanceTo(S.bladen[0].position).toFixed(2) };

  // ---- 3/4. lopen in het eigen assenstelsel (u, w); de stap is 0,1 m, zoals een paar beelden lopen
  const loop = (van, naar, metDeur = null) => {
    let [x, z] = P(...van); const [tx, tz] = P(...naar);
    for (let i = 0; i < 600; i++) {
      if (metDeur !== null) S.update(0.016, metDeur ? [{ x, z, y: 0 }] : [ver]);
      const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz);
      if (d < 0.05) break;
      const s = Math.min(0.1, d);
      [x, z] = W.resolveCollisions(x + dx / d * s, z + dz / d * s, 0.35, 0, 0);
    }
    const L = BP_WINKEL.u, o = BP_WINKEL.o, ax = x - o[0], az = z - o[1];
    const u = ax * L[0] + az * L[1], w = -ax * L[1] + az * L[0];
    return { u: +u.toFixed(2), w: +w.toFixed(2), rest: +Math.hypot(tx - x, tz - z).toFixed(2) };
  };
  const dm = (S.deur.u0 + S.deur.u1) / 2;
  uit.lopen = {
    deurOpen: loop([dm, -6], [dm, 2.5], true),
    deurDicht: (() => { for (let i = 0; i < 80; i++) S.update(0.05, [ver]); return loop([dm, -6], [dm, 2.5], false); })(),
    puiOost: loop([18.5, -6], [18.5, 2], false),
    puiWest: loop([4.5, -5], [4.5, 2], false),
    puiWest2: loop([11.2, -6], [11.2, 2], false),
    vanBinnenOost: loop([18, 1], [24, 1], null),
    vanBinnenAchter: loop([13.8, 9.5], [13.8, 18], null),
    vanBinnenWest: loop([2.5, 1.2], [-4, 1.2], null),
    vanBinnenVoor: loop([8, 2], [8, -4], null),
    tussenGondels: loop([13.8, 2.6], [13.8, 9.4], null),
    langsKoel: loop([17.6, 1.6], [17.6, 11], null),
    naarWest: loop([13.8, 2.6], [2.5, 2.6], null),
    naarBalie: loop([5.3, 2.6], [5.3, 8], null),
    rondjeAchter: loop([8.5, 4], [8.5, 8.5], null),
  };
  // ---- 5. de balie en de medewerker
  const L = BP_WINKEL.u, o = BP_WINKEL.o;
  const mp = S.medewerker.groep.position, ax = mp.x - o[0], az = mp.z - o[1];
  const mu = ax * L[0] + az * L[1], mw = -ax * L[1] + az * L[0];
  // de kijkrichting van een Persoon is zijn −z: (−sin yaw, −cos yaw)
  const kijk = (y) => { const fx = -Math.sin(y), fz = -Math.cos(y); return { du: fx * L[0] + fz * L[1], dw: -fx * L[1] + fz * L[0] }; };
  const k0 = kijk(yaw0);
  const [kx, kz] = P(9, 3.5);
  for (let i = 0; i < 60; i++) S.update(0.05, [{ x: kx, z: kz, y: 0 }]);
  const naar = Math.atan2(-(kx - mp.x), -(kz - mp.z));
  let dyaw = S.medewerker.yaw - naar; while (dyaw > Math.PI) dyaw -= 2 * Math.PI; while (dyaw < -Math.PI) dyaw += 2 * Math.PI;
  uit.mw = { u: +mu.toFixed(2), w: +mw.toFixed(2), balie: S.balie, k0: { du: +k0.du.toFixed(2), dw: +k0.dw.toFixed(2) }, dyaw: +dyaw.toFixed(2),
    zichtbaar: S.medewerker.groep.visible, inScene: !!S.medewerker.groep.parent,
    vrij: (() => { const [x, z] = P(mu, mw); const [a, b] = W.resolveCollisions(x, z, 0.3, 0, 0); return +Math.hypot(a - x, b - z).toFixed(2); })() };

  // ---- 6. groen
  const m4 = new THREE.Matrix4(), pp = new THREE.Vector3();
  let inst = 0; const namen = new Set();
  g.scene.traverse(ob => {
    if (!ob.isInstancedMesh) return;
    const naam = `${ob.name} ${ob.userData.klasse || ''} ${ob.material && ob.material.name || ''}`;
    if (!/gras|boom|bomen|struik|kroon|stam|riet|blad|pol|rommel|kliko|fiets/.test(naam)) return;
    for (let i = 0; i < ob.count; i++) { ob.getMatrixAt(i, m4); pp.setFromMatrixPosition(m4); pp.applyMatrix4(ob.matrixWorld); if (pp.y > -50 && inBpWinkel(pp.x, pp.z, -0.3)) { inst++; namen.add(naam.trim()); } }
  });
  const bomen = W.treePositions.filter(b => inBpWinkel(b.x, b.z, 0)).length;
  uit.groen = { inst, bomen, namen: [...namen].slice(0, 4) };

  // ---- 7. de pompen
  const pompen = []; g.scene.traverse(o => { if (o.name === 'pomp') pompen.push(o); });
  const bx3 = new THREE.Box3();
  uit.pompen = pompen.map(pm => {
    pm.updateMatrixWorld(true);
    bx3.setFromObject(pm);
    const buizen = [], displays = [];
    pm.traverse(o => {
      if (o.geometry && o.geometry.type === 'TubeGeometry') {
        const pos = o.geometry.attributes.position; let laag = Infinity;
        for (let i = 0; i < pos.count; i++) laag = Math.min(laag, pos.getY(i));
        buizen.push(+(laag + pm.position.y).toFixed(2));
      }
      if (o.material && o.material.emissiveMap && o.isMesh) displays.push(o);
    });
    const w = new THREE.Vector3(); pm.getWorldPosition(w);
    const [a, b] = W.resolveCollisions(w.x + 0.2, w.z, 0.35, 0, 0);
    return { nr: pm.userData.nr, hoog: +(bx3.max.y - bx3.min.y).toFixed(2), slangen: buizen.length, laagsteSlang: Math.min(...buizen),
      displays: displays.length, bots: +Math.hypot(a - w.x - 0.2, b - w.z).toFixed(2) };
  });
  const pompMidden = (() => { const v = new THREE.Vector3(); if (pompen[0]) pompen[0].getWorldPosition(v); return v; })();

  // ---- 7. shaders
  const Cam = g.camera, R = g.renderer;
  const [vx, vz] = P(dm, -14), [bx, bz] = P(8, 3);
  const kijkNaar = (uur, zien, binnen) => {
    g.sfeer.uur = uur; for (let i = 0; i < 30; i++) g.sfeer.update(0.1, vx, vz);
    S.groep.visible = zien; S.bladen.forEach(b => { b.visible = zien; }); S.medewerker.groep.visible = zien;
    pompen.forEach(pm => { pm.visible = zien; });
    if (binnen === 'pomp') { Cam.position.set(pompMidden.x + 4, 1.7, pompMidden.z + 3); Cam.lookAt(pompMidden.x, 1.2, pompMidden.z); }
    else if (binnen) { Cam.position.set(bx, 1.7, bz); Cam.lookAt(...[P(15, 8)].map(([x, z]) => [x, 1.4, z])[0]); }
    else { Cam.position.set(vx, 1.7, vz); Cam.lookAt(S.deur.x, 2, S.deur.z); }
    Cam.updateMatrixWorld(true);
    W.updateLOD(Cam.position.x, Cam.position.z); g.scene.updateMatrixWorld(true); R.render(g.scene, Cam);
    return R.info.programs.length;
  };
  // per standpunt eerst zonder (dan vertaalt three wat er van de omgeving in beeld is), dan met de shop en de pompen
  uit.prog = [];
  for (const uur of [13, 1]) for (const waar of [false, true, 'pomp']) {
    kijkNaar(uur, false, waar); const zonder = kijkNaar(uur, false, waar);
    uit.prog.push([uur, String(waar), zonder, kijkNaar(uur, true, waar)]);
  }
  pompen.forEach(pm => { pm.visible = true; });
  S.groep.visible = true; S.bladen.forEach(b => { b.visible = true; }); S.medewerker.groep.visible = true;
  return uit;
});

kop('1. op de voetafdruk');
ok(r.er, 'de shop is gebouwd');
if (!r.er) { await browser.close(); console.log(`\n${fout + 1} fout(en)`); process.exit(1); }
ok(r.boven.length && r.boven[0].klasse === 'bpwinkel' && r.boven[0].y > 4 && r.boven[0].y < 5.5, 'van boven raak je het dak van de shop', JSON.stringify(r.boven));
ok(!r.boven.slice(1).some(h => h.klasse !== 'bpwinkel' && h.y > 0.5), 'onder het dak geen oud blok', JSON.stringify(r.boven));

kop('2. de schuifdeuren');
const D = r.deur;
ok(D.dicht0.open === 0 && D.dicht0.h > 2, 'dicht als er niemand is, met een botsdoos', JSON.stringify(D.dicht0));
ok(D.open1.open === 1 && D.open1.tijd <= 1 && D.open1.h === 0, 'open binnen een seconde als je ervoor staat, botsdoos weg', JSON.stringify(D.open1));
ok(D.schuif > 0.9, 'de bladen schuiven echt opzij', `${D.schuif} m`);
ok(D.dicht2.open === 0 && D.dicht2.tijd <= 1.2 && D.dicht2.h > 2, 'weer dicht als je weggaat', JSON.stringify(D.dicht2));

kop('3. naar binnen, en de muren');
const Lp = r.lopen;
ok(Lp.deurOpen.rest < 0.1 && Lp.deurOpen.w > 2, 'door de open deur naar binnen', JSON.stringify(Lp.deurOpen));
ok(Lp.deurDicht.w < -0.9, 'de dichte deur houdt je tegen', JSON.stringify(Lp.deurDicht));
ok(Lp.puiOost.w < -0.9, 'de pui rechts van de deur houdt je tegen', JSON.stringify(Lp.puiOost));
ok(Lp.puiWest2.w < -0.9, 'de pui links van de deur (oostdeel) houdt je tegen', JSON.stringify(Lp.puiWest2));
ok(Lp.puiWest.w < -0.2, 'de pui van het westdeel houdt je tegen', JSON.stringify(Lp.puiWest));
ok(Lp.vanBinnenOost.u < O_u1(r) - 0.2, 'de oostmuur van binnen dicht', JSON.stringify(Lp.vanBinnenOost));
ok(Lp.vanBinnenAchter.w < 13.25, 'de achtermuur van binnen dicht', JSON.stringify(Lp.vanBinnenAchter));
ok(Lp.vanBinnenWest.u > 0, 'de westmuur van binnen dicht', JSON.stringify(Lp.vanBinnenWest));
ok(Lp.vanBinnenVoor.w > 0, 'de pui van binnen dicht', JSON.stringify(Lp.vanBinnenVoor));

kop('4. rondlopen');
ok(Lp.tussenGondels.rest < 0.1, 'tussen de gondels door naar achteren', JSON.stringify(Lp.tussenGondels));
ok(Lp.langsKoel.rest < 0.1, 'langs de koelvitrine', JSON.stringify(Lp.langsKoel));
ok(Lp.naarWest.rest < 0.1, 'van het oostdeel naar het westdeel', JSON.stringify(Lp.naarWest));
ok(Lp.rondjeAchter.rest < 0.1, 'langs de balie naar achteren (de doorgang van de medewerker)', JSON.stringify(Lp.rondjeAchter));

kop('5. de balie en de medewerker');
const M = r.mw;
ok(Lp.naarBalie.w < M.balie.w0 && Lp.naarBalie.w > M.balie.w0 - 0.6, 'de balie houdt je tegen', JSON.stringify(Lp.naarBalie));
ok(M.u > M.balie.u0 && M.u < M.balie.u1 && M.w > M.balie.w1 + 0.2, 'de medewerker staat achter de balie', JSON.stringify(M));
ok(M.k0.dw < -0.9, 'hij kijkt naar de deur', JSON.stringify(M.k0));
ok(Math.abs(M.dyaw) < 0.3, 'hij draait naar je toe', `${M.dyaw}`);
ok(M.vrij < 0.05, 'hij staat niet in een botsdoos', `${M.vrij} m`);
ok(M.zichtbaar && M.inScene, 'hij is te zien');

kop('6. geen groen of rommel binnen');
ok(r.groen.inst === 0 && r.groen.bomen === 0, 'geen gras, bomen, struiken of rommel in de shop', JSON.stringify(r.groen));

kop('7. de pompen');
const Pm = r.pompen;
ok(Pm.length >= 2, 'er staan pompen onder de luifel', `${Pm.length}`);
ok(Pm.every(p => p.hoog > 1.8 && p.hoog < 2.3), 'elke pomp ongeveer 2 m hoog', JSON.stringify(Pm.map(p => p.hoog)));
ok(Pm.every(p => p.slangen === 6 && p.laagsteSlang > 0.35), 'zes slangen per pomp, geen door de grond', JSON.stringify(Pm.map(p => [p.slangen, p.laagsteSlang])));
ok(Pm.every(p => p.displays >= 2), 'displays aan beide kanten', JSON.stringify(Pm.map(p => p.displays)));
ok(Pm.every(p => p.bots > 0.2), 'je loopt niet door een pomp', JSON.stringify(Pm.map(p => p.bots)));
ok(new Set(Pm.map(p => p.nr)).size === Pm.length, 'elke pomp een eigen nummer', JSON.stringify(Pm.map(p => p.nr)));

kop('8. shaders');
const dag = r.prog.filter(p => p[0] === 13), nacht = r.prog.filter(p => p[0] === 1);
ok(dag.every(p => p[3] === p[2]), 'overdag geen nieuw programma, buiten, binnen en bij de pompen', JSON.stringify(dag));
// 's nachts: bij de eerste blik hoogstens de twee nachtvarianten van de shop zelf (open punt 30, net als het kantoor aan het water
// in aafftest: het voorvertalen van de avond dekt de nachtstand van wat ver van het beginpunt staat nog niet), daarna niets meer
ok(nacht[0][3] - nacht[0][2] <= 2 && nacht.slice(1).every(p => p[3] === p[2]),
  '\'s nachts hoogstens de eigen twee bij de eerste blik, binnen en bij de pompen niets', JSON.stringify(nacht));

function O_u1() { return 19.82; }

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);

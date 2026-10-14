/*
 Foto's van het verkeer dat zich gedraagt (stap 173, js/verkeersregels.js):

   voorrang_kruising.png    twee auto's tegelijk bij een kruising: de een wacht voor de
                            stopstreep, de ander (van rechts) rijdt over de kruising
   voorrang_voetganger.png  een auto die stilstaat voor iemand die midden op zijn strook loopt
   voorrang_uitwijken.png   een auto die over de andere strook om een rode auto heen rijdt
                            die in zijn strook staat
   voorrang_rotonde.png     een rotonde: de een wacht aan de rand, de ander rijdt tegen de
                            klok in over de ring

 Gebruik: node tools/server.mjs 8133 &   node tools/voorrangshots.mjs 8133 [map]
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

const foto = async (naam) => {
  await page.evaluate(() => {
    const g = window.__game;
    g.hud.msgT = 0; g.hud.msg.style.transition = 'none'; g.hud.msg.style.opacity = 0;
    document.getElementById('dialoog').hidden = true;
    const h = document.getElementById('hint'); if (h) { h.textContent = ''; h.style.visibility = 'hidden'; }
    const u = document.getElementById('uitleg'); if (u) u.style.visibility = 'hidden';
    if (g.renderer && g.renderer.shadowMap) g.renderer.shadowMap.needsUpdate = true;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 600000 });
  console.log(`${map}/${naam}.png`);
};
// de camera op (x, y, z), kijkend naar (kx, ky, kz); zie tools/bochtenshots.mjs
const kamera = (x, y, z, kx, ky, kz) => page.evaluate(async ({ x, y, z, kx, ky, kz }) => {
  const W = await import('/js/world.js');
  const g = window.__game, pl = g.player;
  window.__autoplay = false; pl.active = false;
  pl.inCar = null; pl.zit = false; pl.fly = false;
  pl.wapenUit = true; if (pl.gun) pl.gun.visible = false;
  pl.pos.set(x, y - pl.eye, z);
  pl.yaw = Math.atan2(-(kx - x), -(kz - z));
  pl.pitch = Math.atan2(ky - y, Math.hypot(kx - x, kz - z));
  pl.applyCamera();
  W.updateLOD(x, z); g.vehicles.lod(x, z);
  if (g.grasVeld) g.grasVeld.update(x, z, true);
}, { x, y, z, kx, ky, kz });
// van opzij en wat hoger op een punt, met de rijrichting (rx, rz) dwars door beeld
const vanOpzij = (p, rx, rz, af = 16, hoog = 9) => kamera(p.x - rz * af + rx * 4, hoog, p.z + rx * af + rz * 4, p.x, 0.8, p.z);

await page.evaluate(async () => {
  const { gladPad } = await import('/js/vehicles.js');
  const g = window.__game, V = g.vehicles, R = V.regels;
  // eerst de avondstand klaar, anders slaat de hoofdlus zijn beeld over (stap 155) en is de eerste foto zwart
  if (g.avondBelofte) await g.avondBelofte;
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  g.sfeer.weer = 'helder'; g.sfeer.uur = 14;
  for (let i = 0; i < 20; i++) g.sfeer.update(0.1, g.player.pos.x, g.player.pos.z);
  g.reliëfAf();
  window.__autoplay = false; g.player.active = false;
  const lokaal = V.traffic.filter(t => t.lokaal && t.bounce && t.soort !== 'truck');
  const alleen = (keep) => {
    for (const q of V.traffic) { if (!keep.includes(q)) { q.slaapt = true; q.mesh.visible = false; } }
    for (const q of keep) { q.slaapt = false; q.mesh.visible = true; }
  };
  const zetNeer = (t, P, i, dir, v = 7) => {
    if (t.rond) t.bounce = t.rond.bounce;
    t.path = P; t.t = Math.max(0.001, Math.min(P.length - 1.001, i)); t.dir = dir; t.keer = null; t.rond = null;
    t.uitwijk = null; t.lane = 1.4; t.vLane = 0; t.zijHoek = 0;
    t.haast = 0; t.achteruit = 0; t.speed = v; t.snelheid = v; t.doel = v;
    t._gaatK = null; t._forceerK = null; t._wachtT = 0; t.blokT = 0; t._pos = null; t._dir = null;
  };
  const terug = (P, i, dir, meter) => {
    let j = i;
    while (j - dir >= 0 && j - dir <= P.length - 1 && Math.abs(P.lang[i] - P.lang[j]) < meter) j -= dir;
    return Math.abs(P.lang[i] - P.lang[j]) >= meter - 2.5 ? j : null;
  };
  const stap = (spelers = null, mensen = null) => V.updateTraffic(1 / 30, spelers, mensen, null, null);
  window.__vs = { g, V, R, gladPad, lokaal, alleen, zetNeer, terug, stap };
});

// ------------------------------------------------------ de kruising
{
  const p = await page.evaluate(() => {
    const { V, R, gladPad, lokaal, alleen, zetNeer, terug, stap } = window.__vs;
    let keus = null;
    const per = new Map();
    for (const q of V.rijbanen) {
      const P = gladPad(q);
      const lijst = R.knopenOp(P);
      for (const e of lijst) for (const dir of [1, -1]) {
        const j = terug(P, e.i, dir, 42);
        if (j === null || lijst.some(f => f !== e && (f.i - j) * dir > 0 && (e.i - f.i) * dir > 0)) continue;
        let l = per.get(e.k); if (!l) per.set(e.k, l = []);
        l.push({ P, i: e.i, j, dir, rx: P.raak.tx[e.i] * dir, rz: P.raak.tz[e.i] * dir, w: R.breedte(P) });
      }
    }
    for (const [k, l] of per) {
      for (const A of l) for (const B of l) if (!keus && A.P !== B.P && Math.abs(A.rx * B.rx + A.rz * B.rz) < 0.35 && Math.abs(A.w - B.w) < 0.5) keus = { k, A, B };
      if (keus) break;
    }
    const [a, b] = lokaal;
    alleen([a, b]);
    zetNeer(a, keus.A.P, keus.A.j, keus.A.dir);
    zetNeer(b, keus.B.P, keus.B.j, keus.B.dir);
    // tot de een stilstaat voor de streep en de ander midden op de kruising is
    for (let n = 0; n < 1200; n++) {
      stap();
      const wacht = [a, b].find(t => t._wachtK && t.snelheid < 0.3);
      const gaat = [a, b].find(t => t !== wacht && t._kn && t._kn.k === keus.k && t._kn.s < 3);
      if (wacht && gaat) break;
    }
    return { x: keus.k.x, z: keus.k.z, rx: keus.A.rx, rz: keus.A.rz };
  });
  await kamera(p.x + p.rx * -14 + p.rz * 10, 11, p.z + p.rz * -14 - p.rx * 10, p.x, 0, p.z);
  await foto('voorrang_kruising');
}

// ------------------------------------------------------ de voetganger
{
  const p = await page.evaluate(async () => {
    const { Persoon } = await import('/js/persoon.js');
    const { V, R, g, gladPad, lokaal, alleen, zetNeer, stap } = window.__vs;
    let keus = null;
    for (const q of V.rijbanen) {
      const P = gladPad(q);
      if (P.length < 50 || R.knopenOp(P).length > 2) continue;
      const [pv, pa] = R.passages(P);
      if (pv.length || pa.length) continue;
      for (let i = 5; i < P.length - 40 && !keus; i++) {
        let recht = true;
        for (let j = i; j < i + 34; j++) if (P.vmax[j] < 20) { recht = false; break; }
        if (recht) keus = { P, i };
      }
      if (keus) break;
    }
    const { P, i } = keus;
    const [t] = lokaal;
    alleen([t]);
    zetNeer(t, P, i, 1, 7);
    const k = i + 14, q = P[k], tx = P.raak.tx[k], tz = P.raak.tz[k];
    const x = q.x - tz * 1.0, z = q.y + tx * 1.0;
    const mens = new Persoon({ shirt: 0xc23b2e, broek: 0x24303f });
    mens.groep.position.set(x, 0, z);
    mens.groep.rotation.y = Math.atan2(-tz, tx);          // dwars over de weg
    g.scene.add(mens.groep);
    mens.update(0.3, { loopt: true });
    const v = { alive: true, opWeg: true, slaapt: false, x, z };
    for (let n = 0; n < 30 * 8; n++) stap(null, [v]);
    return { x: (t.mesh.position.x + x) / 2, z: (t.mesh.position.z + z) / 2, rx: tx, rz: tz };
  });
  await vanOpzij(p, p.rx, p.rz, 13, 5);
  await foto('voorrang_voetganger');
}

// ------------------------------------------------------ uitwijken
{
  const p = await page.evaluate(() => {
    const { V, R, gladPad, lokaal, alleen, zetNeer, stap } = window.__vs;
    let keus = null;
    for (const q of V.rijbanen) {
      const P = gladPad(q);
      const w = R.breedte(P);
      if (w < 6.5 || P.length < 60) continue;
      const [pv, pa] = R.passages(P);
      if (pv.length || pa.length) continue;
      for (let i = 6; i < P.length - 50 && !keus; i++) {
        let recht = true;
        for (let j = i; j < i + 40; j++) if (P.vmax[j] < 25) { recht = false; break; }
        if (!recht || R.knopenOp(P).some(e => e.i > i - 4 && e.i < i + 45)) continue;
        let vrij = true;
        for (let j = i; j < i + 40 && vrij; j += 2) for (const c of V.parkeerNabij(P[j].x, P[j].y, 6)) if (Math.hypot(c.x - P[j].x, c.z - P[j].y) < 5) vrij = false;
        if (vrij) keus = { P, i };
      }
      if (keus) break;
    }
    const { P, i } = keus;
    const [t] = lokaal;
    alleen([t]);
    zetNeer(t, P, i, 1, 7);
    stap();
    const k = i + 15, q = P[k], tx = P.raak.tx[k], tz = P.raak.tz[k];
    const x = q.x - tz * 1.4, z = q.y + tx * 1.4;
    const car = V.voegToe({ x, z, yaw: Math.atan2(-tx, -tz), soort: 'hatch', kleur: 0x9c1f1f });
    // rijden tot hij naast de rode auto is
    for (let n = 0; n < 30 * 30; n++) {
      stap();
      const langs = (car.x - t.mesh.position.x) * tx + (car.z - t.mesh.position.z) * tz;
      if (t.uitwijk && langs < 1.5) break;
    }
    return { x, z, rx: tx, rz: tz };
  });
  await vanOpzij(p, p.rx, p.rz, 15, 8);
  await foto('voorrang_uitwijken');
}

// ------------------------------------------------------ de rotonde
{
  const p = await page.evaluate(() => {
    const { V, R, gladPad, lokaal, alleen, zetNeer, terug, stap } = window.__vs;
    const per = new Map();
    for (const q of V.rijbanen) {
      const P = gladPad(q);
      const [pv, pa] = R.passages(P);
      for (const [lijst, dir] of [[pv, 1], [pa, -1]]) for (const s of lijst) {
        const j = terug(P, s.iIn, dir, 16);
        if (j === null) continue;
        let l = per.get(s.o); if (!l) per.set(s.o, l = []);
        l.push({ P, q: s, dir, j });
      }
    }
    let keus = null;
    for (const [o, l] of per) {
      for (const A of l) {
        const gA = R.rondje(A.P, A.q, A.dir);
        for (const B of l) {
          if (B === A || B.P === A.P && B.dir === A.dir) continue;
          const gB = R.rondje(B.P, B.q, B.dir);
          for (let i = gB.boogBegin; i < gB.boogEind - 3; i++) {
            const th = Math.atan2(gB[i].y - o.z, gB[i].x - o.x);
            const voor = ((th - gA.th1) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
            if (Math.abs(voor - 1.2) < 0.15) { keus = { o, A, B, gB, iB: i }; break; }
          }
          if (keus) break;
        }
        if (keus) break;
      }
      if (keus) break;
    }
    const { o, A, B, gB, iB } = keus;
    const [tA, tB] = lokaal;
    alleen([tA, tB]);
    zetNeer(tA, A.P, A.j, A.dir, 6);
    zetNeer(tB, gB, iB, 1, 5);
    tB.rond = { pad: gB, o, terug: B.P, iUit: B.q.iUit, dirUit: B.q.dirUit, bounce: true };
    tB.bounce = false;
    for (let n = 0; n < 30 * 10; n++) { stap(); if (tA._wachtR && tA.snelheid < 0.3) { for (let k = 0; k < 20; k++) stap(); break; } }
    return { x: o.x, z: o.z, r: o.r };
  });
  await kamera(p.x + p.r + 14, 16 + p.r * 0.5, p.z + p.r + 14, p.x, 0, p.z);
  await foto('voorrang_rotonde');
}

await browser.close();

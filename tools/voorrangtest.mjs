/*
 Toetst of het verkeer zich gedraagt (stap 173, gevraagd: "Voorrang op kruisingen en
 rotondes, wachten voor overstekende voetgangers, en uitwijken of stoppen als jij dwars
 staat in plaats van door te rijden"). De regels staan in js/verkeersregels.js.

 1. De kaart: kruisingen en rotondes gevonden, ringassen uit de voorraad van rijbanen.
 2. Twee auto's tegelijk naar een kruising (gelijke wegen): wie van rechts komt gaat
    voor, de ander wacht vóór de stopstreep, geen botsing, binnen een halve minuut allebei
    voorbij. En waar een bredere weg een smallere kruist: de bredere gaat voor.
 3. Een rotonde: wie op wil, wacht voor verkeer dat al op de ring aankomt; daarna rijdt
    hij tegen de klok in (eiland links) om het eiland en komt er weer uit; geen draai in
    één beeld, geen sprong.
 4. Een voetganger die oversteekt: de auto stopt minstens twee meter vóór hem en rijdt
    door als hij weg is. Hetzelfde voor de speler te voet, met de claxon.
 5. De auto van de speler dwars op de weg: het verkeer stopt, wacht, toetert en keert;
    langs in de strook: het wijkt uit en gaat terug naar zijn strook; een wrak: idem. Elk
    beeld gemeten: geen verkeersauto ooit in de botsdoos van die auto.
 6. Vier auto's op één kruising die allemaal iemand van rechts hebben: het vangnet lost het op.
 7. Drie minuten gewoon verkeer, met en zonder de regels: de gemiddelde snelheid stort niet
    in, niemand staat eindeloos stil, en de tijd per beeld van `updateTraffic`.
 8. Geen nieuw shaderprogramma.

 Gebruik: node tools/server.mjs 8133 &   node tools/voorrangtest.mjs 8133
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const f1 = (x) => (x === null || x === undefined || !isFinite(x)) ? String(x) : x.toFixed(1);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = false;
  window.__autoplay = false;
  g.sfeer.uur = 14;
  g.vehicles.drukte = 1;
});

// gereedschap in de pagina
await page.evaluate(async () => {
  const { gladPad } = await import('/js/vehicles.js');
  const { autoMaat } = await import('/js/carmodel.js');
  const g = window.__game, V = g.vehicles, R = V.regels;
  const maat = (s) => { try { const a = autoMaat(s || 'hatch'); return { hl: a.L / 2, hw: a.W / 2 }; } catch { return { hl: 2.15, hw: 0.9 }; } };
  // twee draaibare rechthoeken: overlappen ze? (scheidende as)
  const hoeken = (x, z, yaw, m) => {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = -fz, rz = fx;
    return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => [x + fx * m.hl * a + rx * m.hw * b, z + fz * m.hl * a + rz * m.hw * b]);
  };
  const overlap = (A, B) => {
    for (const P of [A, B]) for (let i = 0; i < 4; i++) {
      const [x1, z1] = P[i], [x2, z2] = P[(i + 1) % 4];
      const nx = z2 - z1, nz = x1 - x2;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (const [x, z] of A) { const d = x * nx + z * nz; a0 = Math.min(a0, d); a1 = Math.max(a1, d); }
      for (const [x, z] of B) { const d = x * nx + z * nz; b0 = Math.min(b0, d); b1 = Math.max(b1, d); }
      if (a1 < b0 || b1 < a0) return false;
    }
    return true;
  };
  const hoek = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const lokaal = V.traffic.filter(t => t.lokaal && t.bounce && t.soort !== 'truck');
  // alleen deze auto's wakker, de rest slaapt (en staat dan ver buiten de wereld)
  const alleen = (keep) => {
    for (const q of V.traffic) if (!keep.includes(q)) q.slaapt = true;
    for (const q of keep) { q.slaapt = false; q.mesh.visible = true; }
  };
  const zetNeer = (t, P, i, dir, v = 7) => {
    if (t.rond) t.bounce = t.rond.bounce;
    t.path = P; t.t = Math.max(0.001, Math.min(P.length - 1.001, i)); t.dir = dir; t.keer = null; t.rond = null;
    if (t.uitwijk) { t.uitwijk = null; } t.lane = 1.4; t.vLane = 0; t.zijHoek = 0;
    t.haast = 0; t.achteruit = 0; t.speed = v; t.snelheid = v; t.doel = v;
    t._gaatK = null; t._forceerK = null; t._wachtT = 0; t.blokT = 0; t._pos = null; t._dir = null;
  };
  // het monster dat `meter` meter vóór monster i ligt, als je in richting dir rijdt
  const terug = (P, i, dir, meter) => {
    let j = i;
    while (j - dir >= 0 && j - dir <= P.length - 1 && Math.abs(P.lang[i] - P.lang[j]) < meter) j -= dir;
    return Math.abs(P.lang[i] - P.lang[j]) >= meter - 2.5 ? j : null;
  };
  const stap = (dt = 1 / 30, speler = null, mensen = null) => V.updateTraffic(dt, speler, mensen, null, null);
  window.__vr = { g, V, R, gladPad, maat, hoeken, overlap, hoek, lokaal, alleen, zetNeer, terug, stap };
});

// ------------------------------------------------------------------ 1. de kaart
kop('1. kruisingen en rotondes op de kaart');
const kaart = await page.evaluate(() => {
  const { V, R, gladPad } = window.__vr;
  const ringIn = V.rijbanen.filter(p => R.isRing(p)).length;
  let metKnoop = 0, metPas = 0;
  for (const p of V.rijbanen) { const P = gladPad(p); if (R.knopenOp(P).length) metKnoop++; const [a, b] = R.passages(P); if (a.length || b.length) metPas++; }
  return { knopen: R.knopen.length, rot: R.rotondes.length, ringIn, rijbanen: V.rijbanen.length, metKnoop, metPas, aan: !!R && R.aan };
});
ok(kaart.aan, 'de verkeersregels hangen aan het verkeer (vehicles.regels)');
ok(kaart.knopen > 300, 'kruisingen gevonden', `${kaart.knopen} knopen; ${kaart.metKnoop} van ${kaart.rijbanen} rijbanen kruisen er een`);
ok(kaart.rot >= 10, 'rotondes gevonden', `${kaart.rot}, ${kaart.metPas} rijbanen rijden er een op`);
ok(kaart.ringIn === 0, 'geen as die vooral ring is in de voorraad van rijbanen', `${kaart.ringIn}`);

// ------------------------------------------------------------------ 2. kruising
kop('2. twee auto\'s tegelijk naar een kruising');
const kruis = await page.evaluate(() => {
  const { V, R, gladPad, lokaal, alleen, zetNeer, terug, stap, overlap, hoeken, maat } = window.__vr;
  // per kruising de aanritten: (pad, monster, richting) met veertig meter aanloop zonder andere kruising of rotonde
  const aanritten = new Map();
  for (const p of V.rijbanen) {
    const P = gladPad(p);
    const lijst = R.knopenOp(P);
    for (let n = 0; n < lijst.length; n++) {
      const e = lijst[n];
      for (const dir of [1, -1]) {
        const j = terug(P, e.i, dir, 42);
        if (j === null) continue;
        // geen andere kruising op de aanloop
        if (lijst.some(f => f !== e && (f.i - j) * dir > 0 && (e.i - f.i) * dir > 0)) continue;
        const [pv, pa] = R.passages(P);
        if ((dir > 0 ? pv : pa).some(q => (q.iIn - j) * dir >= 0 && (e.i - q.iIn) * dir >= -10)) continue;
        const rx = P.raak.tx[e.i] * dir, rz = P.raak.tz[e.i] * dir;
        let l = aanritten.get(e.k); if (!l) aanritten.set(e.k, l = []);
        l.push({ P, i: e.i, j, dir, rx, rz, w: R.breedte(P), k: e.k });
      }
    }
  }
  const paren = (gelijk) => {
    for (const [k, l] of aanritten) for (let a = 0; a < l.length; a++) for (let b = a + 1; b < l.length; b++) {
      const A = l[a], B = l[b];
      if (A.P === B.P) continue;
      if (Math.abs(A.rx * B.rx + A.rz * B.rz) > 0.35) continue;      // haaks
      const dw = Math.abs(A.w - B.w);
      if (gelijk ? dw > 0.5 : dw < 1.5) continue;
      return { k, A, B };
    }
    return null;
  };
  const rijd = (paar) => {
    const [ta, tb] = lokaal;
    alleen([ta, tb]);
    zetNeer(ta, paar.A.P, paar.A.j, paar.A.dir);
    zetNeer(tb, paar.B.P, paar.B.j, paar.B.dir);
    stap(1 / 30);
    const k = paar.k;
    // wie gaat volgens de regel voor?
    const rechtsVan = (t, a) => { const vx = a._pos.x - k.x, vz = a._pos.y - k.z, l = Math.hypot(vx, vz); return (vx * -t._dir.y + vz * t._dir.x) / l; };
    const uit = { k: [Math.round(k.x), Math.round(k.z)], wA: paar.A.w, wB: paar.B.w, rechtsB: rechtsVan(ta, tb), rechtsA: rechtsVan(tb, ta) };
    const st = [ta, tb].map(t => ({ vMin: Infinity, sMin: Infinity, voorbijT: null, wachtte: 0 }));
    let minAfst = Infinity, botsing = 0, eersteOp = null;
    const ma = maat(ta.soort), mb = maat(tb.soort);
    for (let n = 0; n < 1500; n++) {
      stap(1 / 30);
      const tijd = (n + 1) / 30;
      [ta, tb].forEach((t, i) => {
        const s = st[i];
        const kn = t._kn && t._kn.k === k ? t._kn.s : null;
        if (kn !== null && s.voorbijT === null) {
          s.vMin = Math.min(s.vMin, t.snelheid);
          // waar hij stilstaat (niet waar hij daarna over de kruising rijdt)
          if (t.snelheid < 0.3) s.sMin = Math.min(s.sMin, kn);
          if (t._wachtK) s.wachtte += 1 / 30;
        }
        if (eersteOp === null && kn !== null && kn < 2) eersteOp = i;
        if (s.voorbijT === null && (!t._kn || t._kn.k !== k) && n > 5) s.voorbijT = tijd;
      });
      const d = Math.hypot(ta.mesh.position.x - tb.mesh.position.x, ta.mesh.position.z - tb.mesh.position.z);
      minAfst = Math.min(minAfst, d);
      if (overlap(hoeken(ta.mesh.position.x, ta.mesh.position.z, ta.mesh.rotation.y, ma), hoeken(tb.mesh.position.x, tb.mesh.position.z, tb.mesh.rotation.y, mb))) botsing++;
      if (st[0].voorbijT !== null && st[1].voorbijT !== null) break;
    }
    uit.st = st; uit.minAfst = minAfst; uit.botsing = botsing; uit.eersteOp = eersteOp; uit.r = k.r;
    return uit;
  };
  const gelijk = paren(true), breed = paren(false);
  const res = { gelijk: gelijk ? rijd(gelijk) : null, breed: breed ? rijd(breed) : null };
  // de uitkomst van de regel
  if (res.gelijk) res.gelijk.voorrang = res.gelijk.rechtsB > 0.3 ? 1 : res.gelijk.rechtsA > 0.3 ? 0 : -1;
  if (res.breed) res.breed.voorrang = res.breed.wB > res.breed.wA ? 1 : 0;
  return res;
});
for (const [naam, r] of [['gelijke wegen (rechts gaat voor)', kruis.gelijk], ['een bredere weg (die gaat voor)', kruis.breed]]) {
  ok(!!r, `een kruising gevonden: ${naam}`, r ? `bij ${r.k}, breedte ${r.wA} en ${r.wB} m` : 'niet gevonden');
  if (!r) continue;
  const v = r.voorrang, w = v < 0 ? null : 1 - v;
  ok(v >= 0, 'de regel wijst er een aan', `rechts van A ${f1(r.rechtsB)}, rechts van B ${f1(r.rechtsA)}`);
  if (v < 0) continue;
  ok(r.st[w].vMin < 0.5 && r.st[w].sMin >= r.r - 1.2, 'wie geen voorrang heeft stopt vóór de stopstreep',
    `laagste ${f1(r.st[w].vMin)} m/s, dichtst ${f1(r.st[w].sMin)} m van het midden (streep ${f1(r.r)} m), ${f1(r.st[w].wachtte)} s gewacht`);
  ok(r.st[v].vMin > 1.5 && r.st[v].wachtte === 0, 'wie voorrang heeft rijdt door', `laagste ${f1(r.st[v].vMin)} m/s`);
  ok(r.eersteOp === v, 'de voorrang is als eerste op de kruising', `eerst ${r.eersteOp === 0 ? 'A' : r.eersteOp === 1 ? 'B' : 'niemand'}`);
  ok(r.botsing === 0, 'geen botsing', `dichtst ${f1(r.minAfst)} m van midden tot midden`);
  ok(r.st[0].voorbijT !== null && r.st[1].voorbijT !== null && Math.max(r.st[0].voorbijT, r.st[1].voorbijT) < 40, 'allebei voorbij binnen veertig tellen',
    `${f1(r.st[0].voorbijT)} en ${f1(r.st[1].voorbijT)} s`);
}

// ------------------------------------------------------------------ 3. rotonde
kop('3. een rotonde: wachten voor de ring, tegen de klok in');
const rot = await page.evaluate(() => {
  const { V, R, gladPad, lokaal, alleen, zetNeer, terug, stap, overlap, hoeken, maat, hoek } = window.__vr;
  // per rotonde alle passages (pad, richting)
  const per = new Map();
  for (const p of V.rijbanen) {
    const P = gladPad(p);
    const [pv, pa] = R.passages(P);
    for (const [lijst, dir] of [[pv, 1], [pa, -1]]) for (const q of lijst) {
      const j = terug(P, q.iIn, dir, 16);
      if (j === null) continue;
      let l = per.get(q.o); if (!l) per.set(q.o, l = []);
      l.push({ P, q, dir, j });
    }
  }
  // een rotonde met een aanrit en een ander stuk ring dat over ons invoegpunt loopt
  let keus = null;
  for (const [o, l] of per) {
    for (const A of l) {
      const gA = R.rondje(A.P, A.q, A.dir);
      for (const B of l) {
        if (B === A || B.P === A.P && B.dir === A.dir) continue;
        const gB = R.rondje(B.P, B.q, B.dir);
        // een monster op de ring van B, 1,2 rad vóór het invoegpunt van A, met nog ring erna
        for (let i = gB.boogBegin; i < gB.boogEind - 3; i++) {
          const th = Math.atan2(gB[i].y - o.z, gB[i].x - o.x);
          const voor = ((th - gA.th1) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
          const restBoog = (gB.boogEind - i) * 2 / (o.r + 2);
          if (Math.abs(voor - 1.2) < 0.15 && restBoog > voor + 0.3) { keus = { o, A, B, gB, iB: i }; break; }
        }
        if (keus) break;
      }
      if (keus) break;
    }
    if (keus) break;
  }
  if (!keus) return null;
  const { o, A, B, gB, iB } = keus;
  const [tA, tB] = lokaal;
  alleen([tA, tB]);
  zetNeer(tA, A.P, A.j, A.dir, 6);
  // B staat al op de ring
  zetNeer(tB, gB, iB, 1, 5);
  tB.rond = { pad: gB, o, terug: B.P, iUit: B.q.iUit, dirUit: B.q.dirUit, bounce: true };
  tB.bounce = false;
  stap(1 / 30);
  const uit = { o: [Math.round(o.x), Math.round(o.z), +o.r.toFixed(1)], wachtte: 0, vMinVoor: Infinity, opRing: false, klaar: false, tegenKlok: 0, metKlok: 0,
    maxDraai: 0, maxSprong: 0, botsing: 0, minAfst: Infinity, bOpRingBijInvoegen: null, rondT: null, duur: 0 };
  const ma = maat(tA.soort), mb = maat(tB.soort);
  let vorig = { x: tA.mesh.position.x, z: tA.mesh.position.z, yaw: tA.mesh.rotation.y };
  let thV = null;
  for (let n = 0; n < 1800; n++) {
    stap(1 / 30);
    const p = { x: tA.mesh.position.x, z: tA.mesh.position.z, yaw: tA.mesh.rotation.y };
    const weg = Math.hypot(p.x - vorig.x, p.z - vorig.z);
    const dr = Math.abs(hoek(p.yaw - vorig.yaw)) * 30;
    if (!tA.keer && dr > uit.maxDraai) { uit.maxDraai = dr; uit.draaiWaar = `${tA.rond ? 'op de rotonde, monster ' + tA.t.toFixed(1) + ' van ' + tA.path.length : 'op de as'}, ${tA.snelheid.toFixed(1)} m/s`; }
    uit.maxSprong = Math.max(uit.maxSprong, weg - Math.abs(tA.snelheid) / 30 * 1.02 - 0.02);
    vorig = p;
    if (!tA.rond && !uit.opRing) {
      if (tA._wachtR) uit.wachtte += 1 / 30;
      uit.vMinVoor = Math.min(uit.vMinVoor, tA.snelheid);
    }
    if (tA.rond && !uit.opRing) {
      uit.opRing = true; uit.rondT = (n + 1) / 30;
      // komt B nog aan bij ons invoegpunt? (al voorbij of van de ring af is goed)
      const th = Math.atan2(tB.mesh.position.z - o.z, tB.mesh.position.x - o.x);
      const voor = ((th - tA.path.th1) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      uit.bOpRingBijInvoegen = !tB.slaapt && !!tB.rond && tB.t < tB.path.boogEind && voor < 1.9;
    }
    if (tA.rond && tA.t > tA.path.boogBegin && tA.t < tA.path.boogEind) {
      const th = Math.atan2(p.z - o.z, p.x - o.x);
      if (thV !== null) { const d = hoek(th - thV); if (d < -1e-4) uit.tegenKlok++; else if (d > 1e-4) uit.metKlok++; }
      thV = th;
    }
    if (uit.opRing && !tA.rond) { uit.klaar = true; uit.duur = (n + 1) / 30; break; }
    if (!tB.slaapt) {
      uit.minAfst = Math.min(uit.minAfst, Math.hypot(p.x - tB.mesh.position.x, p.z - tB.mesh.position.z));
      if (overlap(hoeken(p.x, p.z, p.yaw, ma), hoeken(tB.mesh.position.x, tB.mesh.position.z, tB.mesh.rotation.y, mb))) uit.botsing++;
    }
  }
  uit.uitAs = tA.path === A.P;
  uit.dirNa = tA.dir; uit.dirUit = A.q.dirUit;
  return uit;
});
ok(!!rot, 'een rotonde met een aanrit en verkeer op de ring gevonden', rot ? `midden ${rot.o[0]},${rot.o[1]}, eiland ${rot.o[2]} m` : 'niet gevonden');
if (rot) {
  ok(rot.wachtte > 0.5 && rot.vMinVoor < 2, 'wie op wil remt en wacht voor het verkeer op de ring', `${f1(rot.wachtte)} s gewacht, laagste ${f1(rot.vMinVoor)} m/s`);
  ok(rot.opRing && rot.bOpRingBijInvoegen === false, 'en rijdt pas op als de ring vrij is (de ander voorbij zijn invoegpunt)', `op na ${f1(rot.rondT)} s`);
  ok(rot.tegenKlok > 20 && rot.metKlok === 0, 'tegen de klok in om het eiland (eiland links)', `${rot.tegenKlok} beelden tegen, ${rot.metKlok} met de klok`);
  ok(rot.klaar && rot.uitAs && rot.dirNa === rot.dirUit, 'en weer de rotonde af, terug op zijn eigen as', `na ${f1(rot.duur)} s`);
  ok(rot.maxDraai < 1.4, 'geen draai in één beeld (onder 1,4 rad/s, ook bij op- en afrijden)', `${rot.maxDraai.toFixed(2)} rad/s (${rot.draaiWaar})`);
  ok(rot.maxSprong < 0.08, 'geen sprong bij het wisselen van pad', `${rot.maxSprong.toFixed(3)} m te veel`);
  ok(rot.botsing === 0, 'geen botsing met de auto op de ring', `dichtst ${f1(rot.minAfst)} m`);
}

// ------------------------------------------------------------------ 4. voetgangers
kop('4. een voetganger die oversteekt, en de speler te voet');
const mens = await page.evaluate(() => {
  const { V, R, g, gladPad, lokaal, alleen, zetNeer, stap, maat } = window.__vr;
  // een recht stuk rijbaan van zestig meter zonder kruising of rotonde
  let keus = null;
  for (const p of V.rijbanen) {
    const P = gladPad(p);
    if (P.length < 50 || R.knopenOp(P).length > 2) continue;
    const [pv, pa] = R.passages(P);
    if (pv.length || pa.length) continue;
    for (let i = 5; i < P.length - 40 && !keus; i++) {
      let recht = true;
      for (let j = i; j < i + 34; j++) if (P.vmax[j] < 20) { recht = false; break; }
      if (recht && !R.knopenOp(P).some(e => e.i > i - 5 && e.i < i + 40)) keus = { P, i };
    }
    if (keus) break;
  }
  if (!keus) return null;
  const { P, i } = keus;
  const [t] = lokaal;
  const res = {};
  const plek = (k, opzij) => {
    const q = P[k], tx = P.raak.tx[k], tz = P.raak.tz[k];
    return { x: q.x - tz * opzij, z: q.y + tx * opzij };
  };
  const m = maat(t.soort);
  const rit = (zet, weg, metSpeler) => {
    alleen([t]);
    zetNeer(t, P, i, 1, 7);
    stap();
    const doel = plek(i + 14, 1.4);           // 28 m vóór hem, midden op zijn strook
    zet(doel);
    let vMin = Infinity, gap = Infinity, stilT = 0, n = 0, toeter = 0;
    const oud = V.opClaxon;
    V.opClaxon = () => { toeter++; };
    for (; n < 30 * 12; n++) {
      stap(1 / 30, metSpeler ? g.player : null, metSpeler ? null : [res.v]);
      const d = Math.hypot(t.mesh.position.x - doel.x, t.mesh.position.z - doel.z) - m.hl;
      gap = Math.min(gap, d);
      vMin = Math.min(vMin, t.snelheid);
      if (t.snelheid < 0.2) stilT += 1 / 30;
    }
    weg();
    let doorT = null;
    for (let k = 0; k < 30 * 10; k++) {
      stap(1 / 30, metSpeler ? g.player : null, metSpeler ? null : [res.v]);
      if (t.snelheid > 3 && doorT === null) doorT = (k + 1) / 30;
    }
    V.opClaxon = oud;
    return { vMin, gap, stilT, doorT, toeter };
  };
  // een voetganger midden op de rijbaan, aan het oversteken
  res.v = { alive: true, opWeg: true, slaapt: false, x: 0, z: 0 };
  res.voetganger = rit(d => { res.v.x = d.x; res.v.z = d.z; }, () => { res.v.opWeg = false; res.v.x += 40; }, false);
  // de speler te voet op de weg
  const pl = g.player, was = { x: pl.pos.x, z: pl.pos.z, inCar: pl.inCar };
  pl.inCar = null;
  // (niet elke bestuurder toetert: js/vehicles.js loot 70 %; hier toetert iedereen)
  const rnd = Math.random; Math.random = () => 0.1;
  res.speler = rit(d => { pl.pos.x = d.x; pl.pos.z = d.z; }, () => { pl.pos.x += 40; }, true);
  Math.random = rnd;
  pl.pos.x = was.x; pl.pos.z = was.z;
  return { voetganger: res.voetganger, speler: res.speler, waar: [Math.round(P[i].x), Math.round(P[i].y)] };
});
ok(!!mens, 'een recht stuk rijbaan gevonden', mens ? `bij ${mens.waar}` : 'niet gevonden');
if (mens) {
  for (const [naam, r] of [['de voetganger', mens.voetganger], ['de speler te voet', mens.speler]]) {
    ok(r.vMin < 0.2 && r.stilT > 3, `stopt voor ${naam}`, `laagste ${f1(r.vMin)} m/s, ${f1(r.stilT)} s stil`);
    ok(r.gap >= 2, `op minstens twee meter (neus tot ${naam})`, `${f1(r.gap)} m`);
    ok(r.doorT !== null && r.doorT < 6, `en rijdt door als ${naam} weg is`, `na ${f1(r.doorT)} s weer 3 m/s`);
  }
  ok(mens.speler.toeter >= 1, 'voor de speler gaat de claxon (niet meteen)', `${mens.speler.toeter} keer in twaalf tellen`);
}

// ------------------------------------------------------------------ 5. een auto op de rijbaan
kop('5. de auto van de speler dwars op de weg, langs in de strook, en een wrak');
const blok = await page.evaluate(() => {
  const { V, R, g, gladPad, lokaal, alleen, zetNeer, stap, maat, overlap, hoeken } = window.__vr;
  // een rechte straat van 5 tot 6,5 m breed (dwars: geen ruimte) en een van minstens 6 m (langs: wel)
  const zoek = (wMin, wMax, nietDit) => {
    for (const p of V.rijbanen) {
      const P = gladPad(p);
      if (P === nietDit) continue;
      const w = R.breedte(P);
      if (w < wMin || w > wMax || P.length < 60) continue;
      const [pv, pa] = R.passages(P);
      if (pv.length || pa.length) continue;
      for (let i = 6; i < P.length - 50; i++) {
        let recht = true;
        for (let j = i; j < i + 40; j++) if (P.vmax[j] < 25) { recht = false; break; }
        if (!recht || R.knopenOp(P).some(e => e.i > i - 4 && e.i < i + 45)) continue;
        // en geen geparkeerde auto vlak langs de route
        let vrij = true;
        for (let j = i; j < i + 40 && vrij; j += 2) for (const c of V.parkeerNabij(P[j].x, P[j].y, 6)) if (Math.hypot(c.x - P[j].x, c.z - P[j].y) < 5) vrij = false;
        if (vrij) return { P, i, w };
      }
    }
    return null;
  };
  const [t] = lokaal;
  const mt = maat(t.soort);
  const geval = (straat, opzij, dwars, wrak) => {
    if (!straat) return null;
    const { P, i } = straat;
    alleen([t]);
    zetNeer(t, P, i, 1, 7);
    stap();
    const k = i + 15, q = P[k], tx = P.raak.tx[k], tz = P.raak.tz[k];
    const x = q.x - tz * opzij, z = q.y + tx * opzij;
    const yawLangs = Math.atan2(-tx, -tz);
    const car = V.voegToe({ x, z, yaw: dwars ? yawLangs + Math.PI / 2 : yawLangs, soort: 'hatch', kleur: 0x9c1f1f });
    car.mesh.position.set(x, 0, z);
    car.mesh.rotation.y = car.yaw;
    if (wrak) V.laatOntploffen(car);
    const pl = g.player;
    if (!wrak) pl.inCar = car;               // de speler zit erin
    const mc = maat('hatch');
    const box = hoeken(car.x, car.z, car.mesh.rotation.y, mc);
    const oud = V.opClaxon; let toeter = 0; V.opClaxon = () => { toeter++; };
    const uit = { botsing: 0, minGap: Infinity, stilT: 0, uitgeweken: false, gekeerd: false, voorbij: false, terugInStrook: false, laneMin: 1.4, laneMax: 1.4, maxSprong: 0, maxDraai: 0, duur: 0 };
    const dir0 = t.dir;
    let vorig = { x: t.mesh.position.x, z: t.mesh.position.z, yaw: t.mesh.rotation.y };
    for (let n = 0; n < 30 * 40; n++) {
      stap();
      const p = { x: t.mesh.position.x, z: t.mesh.position.z, yaw: t.mesh.rotation.y };
      if (overlap(hoeken(p.x, p.z, p.yaw, mt), box)) uit.botsing++;
      const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
      const langs = (car.x - p.x) * fx + (car.z - p.z) * fz;
      if (langs > 0) uit.minGap = Math.min(uit.minGap, Math.hypot(car.x - p.x, car.z - p.z));
      if (t.snelheid < 0.2) uit.stilT += 1 / 30;
      if (t.uitwijk) uit.uitgeweken = true;
      if (t.keer || t.dir !== dir0) uit.gekeerd = true;
      uit.laneMin = Math.min(uit.laneMin, t.lane); uit.laneMax = Math.max(uit.laneMax, t.lane);
      if (!t.keer) {
        const d = Math.abs(((p.yaw - vorig.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * 30;
        uit.maxDraai = Math.max(uit.maxDraai, d);
        uit.maxSprong = Math.max(uit.maxSprong, Math.hypot(p.x - vorig.x, p.z - vorig.z) - Math.abs(t.snelheid) / 30 * 1.02 - 0.02);
      }
      vorig = p;
      // voorbij: de auto ligt ruim achter hem, in de oude rijrichting
      if (t.dir === dir0 && (t.t - k) * dir0 > 6) uit.voorbij = true;
      if (uit.voorbij && !t.uitwijk && Math.abs(t.lane - 1.4) < 1e-6) { uit.terugInStrook = true; uit.duur = (n + 1) / 30; break; }
      if (uit.gekeerd && !t.keer && (t.t - k) * dir0 < -10) { uit.duur = (n + 1) / 30; break; }
    }
    V.opClaxon = oud;
    if (!wrak) pl.inCar = null;
    V.verwijder ? V.verwijder(car) : (car.mesh.visible = false, car.x = car.z = 1e5);
    uit.toeter = toeter;
    uit.waar = [Math.round(x), Math.round(z)];
    return uit;
  };
  const smal = zoek(5, 6.5), breed = zoek(6.5, 9, smal && smal.P);
  return {
    dwars: geval(smal, 0, true, false),
    langs: geval(breed, 1.4, false, false),
    wrak: geval(breed, 1.4, false, true),
    smalW: smal && smal.w, breedW: breed && breed.w,
    regels: { ...R.stats },
  };
});
for (const [naam, r] of [['dwars over de weg (de speler zit erin)', blok.dwars], ['langs in de strook', blok.langs], ['een wrak in de strook', blok.wrak]]) {
  ok(!!r, `een straat gevonden: ${naam}`, r ? `bij ${r.waar}` : 'niet gevonden');
  if (!r) continue;
  ok(r.botsing === 0, 'geen verkeersauto ooit in de botsdoos van die auto (elk beeld gemeten)', `${r.botsing} beelden, dichtst ${f1(r.minGap)} m midden tot midden`);
  ok(r.stilT > 2, 'het verkeer stopt en wacht eerst', `${f1(r.stilT)} s stil`);
}
if (blok.dwars) {
  ok(blok.dwars.gekeerd && !blok.dwars.uitgeweken, 'dwars over een smalle straat: geen plek om langs, dus hij keert', `straat ${blok.smalW} m, na ${f1(blok.dwars.duur)} s weg`);
  ok(blok.dwars.toeter >= 1, 'en toetert eerst', `${blok.dwars.toeter} keer`);
}
for (const r of [blok.langs, blok.wrak].filter(Boolean)) {
  ok(r.uitgeweken && r.laneMin < 0 && r.voorbij, 'langs in de strook: hij wijkt uit over de andere strook en komt erlangs', `strook van 1,4 naar ${f1(r.laneMin)} m, straat ${blok.breedW} m`);
  ok(r.terugInStrook, 'en gaat daarna terug naar zijn eigen strook', `na ${f1(r.duur)} s`);
  ok(r.maxDraai < 1.4 && r.maxSprong < 0.08, 'zonder draai of sprong in één beeld', `${r.maxDraai.toFixed(2)} rad/s, ${r.maxSprong.toFixed(3)} m`);
}

// ------------------------------------------------------------------ 6. vier auto's
kop('6. vier auto\'s op één kruising: het vangnet');
const vier = await page.evaluate(() => {
  const { V, R, gladPad, lokaal, alleen, zetNeer, terug, stap, overlap, hoeken, maat } = window.__vr;
  // een kruising met vier aanritten uit vier richtingen, allemaal even breed
  const per = new Map();
  for (const p of V.rijbanen) {
    const P = gladPad(p);
    for (const e of R.knopenOp(P)) for (const dir of [1, -1]) {
      const j = terug(P, e.i, dir, 26);
      if (j === null) continue;
      let l = per.get(e.k); if (!l) per.set(e.k, l = []);
      l.push({ P, j, dir, rx: P.raak.tx[e.i] * dir, rz: P.raak.tz[e.i] * dir, w: R.breedte(P) });
    }
  }
  let keus = null;
  for (const [k, l] of per) {
    const hk = l.map(a => Math.atan2(a.rz, a.rx));
    // vier richtingen die elk minstens 60° van elkaar liggen, verschillende paden, even breed
    const gekozen = [];
    for (let a = 0; a < l.length; a++) {
      if (gekozen.some(b => { let d = Math.abs(hk[a] - hk[b]); d = Math.min(d, 2 * Math.PI - d); return d < 1.05; })) continue;
      if (gekozen.some(b => l[b].P === l[a].P && l[b].dir === l[a].dir)) continue;
      gekozen.push(a);
    }
    if (gekozen.length >= 4) { keus = { k, auto: gekozen.slice(0, 4).map(a => l[a]) }; break; }
    // drie aanritten die elk minstens 100° van elkaar liggen (een Y): ook daar heeft ieder iemand van rechts
    if (!keus && gekozen.length === 3 && gekozen.every((a, i) => gekozen.every((b, j) => {
      if (i === j) return true; let d = Math.abs(hk[a] - hk[b]); d = Math.min(d, 2 * Math.PI - d); return d > 1.75;
    }))) keus = { k, auto: gekozen.map(a => l[a]), drie: true };
  }
  if (!keus) return null;
  // alle vier even breed (de breedte van een pad wordt onthouden op `_breed`): dan heeft ieder iemand van rechts
  const breed = keus.auto.map(a => a.P._breed);
  keus.auto.forEach(a => { a.P._breed = 6; });
  const autos = lokaal.slice(0, keus.auto.length);
  alleen(autos);
  keus.auto.forEach((a, i) => zetNeer(autos[i], a.P, a.j, a.dir, 6));
  const f0 = R.stats.forceer;
  stap();
  const voorbij = autos.map(() => null);
  let botsing = 0, maxStil = 0;
  const stil = autos.map(() => 0);
  for (let n = 0; n < 30 * 60; n++) {
    stap();
    autos.forEach((t, i) => {
      if (voorbij[i] === null && (!t._kn || t._kn.k !== keus.k) && n > 5) voorbij[i] = (n + 1) / 30;
      stil[i] = t.snelheid < 0.2 ? stil[i] + 1 / 30 : 0;
      maxStil = Math.max(maxStil, stil[i]);
    });
    for (let a = 0; a < autos.length; a++) for (let b = a + 1; b < autos.length; b++) {
      const A = autos[a].mesh, B = autos[b].mesh;
      if (overlap(hoeken(A.position.x, A.position.z, A.rotation.y, maat(autos[a].soort)), hoeken(B.position.x, B.position.z, B.rotation.y, maat(autos[b].soort)))) botsing++;
    }
    if (voorbij.every(v => v !== null)) break;
  }
  keus.auto.forEach((a, i) => { a.P._breed = breed[i]; });
  return { n: autos.length, drie: !!keus.drie, waar: [Math.round(keus.k.x), Math.round(keus.k.z)], voorbij, botsing, forceer: R.stats.forceer - f0, maxStil };
});
ok(!!vier, 'een kruising met vier aanritten (of een Y met drie; even breed gezet)', vier ? `${vier.n} auto's bij ${vier.waar}` : 'niet gevonden');
if (vier) {
  ok(vier.voorbij.every(v => v !== null && v < 50), 'iedereen komt binnen vijftig tellen over de kruising', vier.voorbij.map(f1).join(', ') + ' s');
  ok(vier.botsing === 0, 'zonder botsing', `${vier.botsing} beelden`);
  ok(vier.forceer >= 1, 'het vangnet heeft het opgelost (wie het langst wacht gaat)', `${vier.forceer} keer`);
}

// ------------------------------------------------------------------ 7. gewoon verkeer
kop('7. drie minuten gewoon verkeer, met en zonder regels');
const vrij = await page.evaluate(() => {
  const { V, R, g } = window.__vr;
  const rit = (aan) => {
    R.aan = aan;
    // iedereen weer wakker, op een rijbaan rond de speler
    const cx = g.player.pos.x, cz = g.player.pos.z;
    for (const t of V.traffic) {
      if (t.rond) t.bounce = t.rond.bounce;
      t.slaapt = false; t.mesh.visible = true; t.rond = null; t.uitwijk = null; t.lane = t.lokaal ? 1.4 : t.lane; t.zijHoek = 0; t.keer = null;
      t.haast = 0; t.achteruit = 0;
      if (t.lokaal) V.zetOpRijbaan(t, cx, cz, 0, 0, 500);
    }
    const dt = 1 / 30, N = 30 * 180;
    let som = 0, tel = 0, tijd = 0, maxStil = 0, wie = null;
    const stil = new Map();
    for (let n = 0; n < N; n++) {
      const t0 = performance.now();
      V.updateTraffic(dt, null, null, cx, cz);
      tijd += performance.now() - t0;
      for (const t of V.traffic) {
        if (t.slaapt) continue;
        som += Math.max(0, t.snelheid); tel++;
        const s = t.snelheid < 0.2 ? (stil.get(t) || 0) + dt : 0;
        stil.set(t, s);
        if (n > 300 && s > maxStil) { maxStil = s; wie = t; }
      }
    }
    // wie stond het langst stil, en waarom?
    let waarom = null;
    if (wie) {
      const voor = V.traffic.filter(a => a !== wie && !a.slaapt && a._pos).map(a => {
        const dx = a._pos.x - wie._pos.x, dz = a._pos.y - wie._pos.y;
        return { d: Math.hypot(dx, dz), langs: dx * wie._dir.x + dz * wie._dir.y, tegen: a._dir.x * wie._dir.x + a._dir.y * wie._dir.y, v: a.snelheid };
      }).filter(a => a.langs > 0 && a.d < 14);
      const b = aan ? R.blokkadeVoor(wie) : null;
      waarom = { lokaal: !!wie.lokaal, bounce: !!wie.bounce, soort: wie.soort, x: Math.round(wie._pos.x), z: Math.round(wie._pos.y), stil: +(stil.get(wie) || 0).toFixed(1),
        doel: +(wie.doel || 0).toFixed(2), bocht: +(wie.bocht || 0).toFixed(2), wachtK: !!wie._wachtK, wachtR: !!wie._wachtR, blokT: +(wie.blokT || 0).toFixed(1),
        achteruit: wie.achteruit, voor: voor.map(a => `${a.d.toFixed(1)} m, tegen ${a.tegen.toFixed(2)}, ${a.v.toFixed(1)} m/s`),
        blok: b ? `${b.c.soort} op ${b.gap.toFixed(1)} m, ${b.c.mesh ? 'eigen model' : 'geparkeerd'}` : null };
    }
    return { gem: som / tel, msPerBeeld: tijd / N, maxStil, waarom, autos: V.traffic.filter(t => !t.slaapt).length };
  };
  const s0 = { ...R.stats };
  const zonder = rit(false);
  const met = rit(true);
  const stats = {}; for (const k in R.stats) stats[k] = R.stats[k] - s0[k];
  R.aan = true;
  return { zonder, met, stats };
});
ok(vrij.met.gem >= vrij.zonder.gem * 0.75, 'de gemiddelde snelheid stort niet in', `met regels ${f1(vrij.met.gem)} m/s, zonder ${f1(vrij.zonder.gem)} m/s (${vrij.met.autos} auto's)`);
ok(vrij.met.maxStil < 45, 'geen auto die eindeloos stilstaat', `langst ${f1(vrij.met.maxStil)} s (zonder regels ${f1(vrij.zonder.maxStil)} s)`);
ok(vrij.met.msPerBeeld < Math.max(vrij.zonder.msPerBeeld * 1.6, vrij.zonder.msPerBeeld + 0.25), 'updateTraffic niet duidelijk trager',
  `met ${vrij.met.msPerBeeld.toFixed(3)} ms per beeld, zonder ${vrij.zonder.msPerBeeld.toFixed(3)} ms`);
console.log(`       (in die drie minuten: ${JSON.stringify(vrij.stats)})`);
console.log(`       (het langst stil met regels: ${JSON.stringify(vrij.met.waarom)})`);
console.log(`       (het langst stil zonder regels: ${JSON.stringify(vrij.zonder.waarom)})`);

// ------------------------------------------------------------------ 8. shaders
kop('8. geen nieuw shaderprogramma');
const prog = await page.evaluate(async () => {
  const { V, g } = window.__vr;
  const W = await import('/js/world.js');
  const R = g.renderer, Cam = g.camera;
  const t = V.traffic.find(q => !q.slaapt && q.lokaal);
  const teken = () => {
    Cam.position.set(t.mesh.position.x + 8, 3, t.mesh.position.z + 8);
    Cam.lookAt(t.mesh.position.x, 1, t.mesh.position.z);
    Cam.updateMatrixWorld(true);
    W.updateLOD(Cam.position.x, Cam.position.z);
    g.scene.updateMatrixWorld(true);
    R.render(g.scene, Cam);
    return R.info.programs.length;
  };
  teken(); const voor = teken();
  for (let n = 0; n < 90; n++) V.updateTraffic(1 / 30, null, null, g.player.pos.x, g.player.pos.z);
  const na = teken();
  return { voor, na };
});
ok(prog.na === prog.voor, 'evenveel programma\'s na het rijden', `${prog.voor} → ${prog.na}`);

await browser.close();
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);

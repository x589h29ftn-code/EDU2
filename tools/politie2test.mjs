/*
 Stap 156: de agenten lopen niet meer langs Erik, en hebben geen zaklamp (npm run politie2test). Gevraagd: "Agenten
 lopen nu met de nieuwe code soms ook compleet langs Erik om maar dekking te zoeken of flanken. Daarnaast verwijder de
 zaklamp van ze in de nacht."

   1. dekking (js/politieslim.js `zoekDekking`) op 400 plekken rond Tinga: elke gekozen plek ligt aan de kant van de
      agent (hoogstens driekwart van de weg naar de speler) en de rechte weg erheen komt niet dichter dan 5 m bij de
      speler (of niet dichter dan de agent al stond); met de oude regels kwam dat wel voor (tegenproef);
   2. flanken (`flankStap`) als meetkunde: vanuit 72 beginplekken, van 3 tot 25 m en rondom, nooit dichter bij de
      speler dan hij begon (of dan de flankafstand), en hij komt bij zijn flankpunt; de oude rechte lijn kwam wel dichtbij;
   2b. Erik loopt langs (3 m/s): met het oude vaste flankpunt kwam de flankeerder dichter dan met de boog;
   3. in het spel: per rol vanaf 6 en 9 m aan de andere kant van het flankpunt, twee sterren, tien seconden: de flankeerder
      komt niet dichter dan 4 m bij Erik en komt nooit aan de overkant (meer dan 150° om hem heen gelopen); de aanvaller
      met dekking niet dichter dan zijn plek bij het begin;
   3b. in het spel loopt Erik op 3 m langs een flankeerder: die blijft ten minste 2 m weg;
   4. geen zaklamp: een agent heeft 's nachts geen bundel in zijn hand, en ziet je op 25 m in het donker niet (wel op 15).

 Gebruik: npm run server &  node tools/politie2test.mjs [poort]
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
  const g = window.__game, P = g.politie, pl = g.player;
  const S = await import('./js/politieslim.js');
  const W = await import('./js/world.js');
  const { KAART } = await import('./js/kaart.js');
  const { FLANK } = await import('./js/politie.js');
  document.getElementById('overlay').style.display = 'none';
  pl.active = false; window.__autoplay = false;
  const uit = {};
  let zaad = 7;
  const rnd = () => { zaad = (zaad * 16807) % 2147483647; return zaad / 2147483647; };

  // ---- 1. dekking
  const assen = KAART.wegassen.filter(w => w.drive && w.lengte > 40 && Math.hypot(w.pts[0][0], w.pts[0][1]) < 900);
  let gevonden = 0, fout1 = [], oudFout = 0;
  for (let i = 0; i < 400; i++) {
    const as = assen[Math.floor(rnd() * assen.length)], p = as.pts[Math.floor(rnd() * as.pts.length)];
    const sp = { x: p[0], z: p[1] };
    const h = rnd() * Math.PI * 2, d = i < 200 ? 3 + rnd() * 9 : 6 + rnd() * 24;     // de helft dichtbij: daar ging het mis
    const [ax, az] = W.resolveCollisions(sp.x + Math.cos(h) * d, sp.z + Math.sin(h) * d, 0.4);
    const pos = { x: ax, z: az };
    const dek = S.zoekDekking(pos, sp, { rnd });
    if (dek) {
      gevonden++;
      if (!S.langsVrij(pos, dek, sp)) fout1.push(`(${dek.x.toFixed(0)}, ${dek.z.toFixed(0)})`);
    }
    // tegenproef: hoe vaak koos de oude regel (zonder `langsVrij`) een plek voorbij of langs de speler?
    const oud = S.zoekDekking(pos, sp, { rnd, zonderLangs: true });
    if (oud && !S.langsVrij(pos, oud, sp)) oudFout++;
  }
  uit.dekking = { gevonden, fout: fout1.length, voorbeeld: fout1.slice(0, 3), oudFout };

  // ---- 2. flanken als meetkunde
  let minRatio = Infinity, aangekomen = 0, n2 = 0, oudDicht = 0;
  const mik = { x: 0, z: 0 };
  for (const d0 of [3, 6, 10, 15, 20, 25]) for (let k = 0; k < 12; k++) {
    n2++;
    const a0 = k / 12 * Math.PI * 2, zij = k % 2 ? 1 : -1;
    const pos = { x: Math.cos(a0) * d0, z: Math.sin(a0) * d0 };
    const hoek = a0 + zij * FLANK.hoek;
    const doel = { x: Math.cos(hoek) * FLANK.afst, z: Math.sin(hoek) * FLANK.afst };
    let minD = d0;
    for (let t = 0; t < 400; t++) {
      if (Math.hypot(doel.x - pos.x, doel.z - pos.z) < 1.5) { aangekomen++; break; }
      const q = S.flankStap(pos, mik, hoek, FLANK.afst);
      const dx = q.x - pos.x, dz = q.z - pos.z, l = Math.hypot(dx, dz) || 1, s = Math.min(l, 0.15);
      pos.x += dx / l * s; pos.z += dz / l * s;
      minD = Math.min(minD, Math.hypot(pos.x, pos.z));
    }
    minRatio = Math.min(minRatio, minD / Math.min(d0, FLANK.afst));
    // de oude rechte lijn van het begin naar het flankpunt
    const ex = doel.x - Math.cos(a0) * d0, ez = doel.z - Math.sin(a0) * d0, l2 = ex * ex + ez * ez;
    const t = Math.max(0, Math.min(1, -(Math.cos(a0) * d0 * ex + Math.sin(a0) * d0 * ez) / l2));
    if (Math.hypot(Math.cos(a0) * d0 + ex * t, Math.sin(a0) * d0 + ez * t) < Math.min(d0, 5) - 0.5) oudDicht++;
  }
  /*
   De speler loopt langs (3 m/s, op 2 m langs de agent heen, 6 s lang): de oude manier (het flankpunt op een vaste hoek
   vanaf de speler, om de vier tellen opnieuw, de agent er recht heen op 4,5 m/s) tegen `flankStap`.
  */
  const loop = (nieuw) => {
    let slechtst = Infinity;
    for (let k = 0; k < 12; k++) {
      const pos = { x: 2, z: 0 }, sp = { x: -12 + k * 0.5, z: -18 + k * 3 };
      const vx = 0, vz = 3, zij = k % 2 ? 1 : -1;
      const hoek = Math.atan2(pos.z - sp.z, pos.x - sp.x) + zij * FLANK.hoek;
      let punt = null, tPunt = 0, minD = Infinity;
      for (let t = 0; t < 6; t += 1 / 30) {
        sp.x += vx / 30; sp.z += vz / 30;
        let q;
        if (nieuw) q = S.flankStap(pos, sp, hoek, FLANK.afst);
        else { tPunt -= 1 / 30; if (!punt || tPunt <= 0) { punt = { x: sp.x + Math.cos(hoek) * FLANK.afst, z: sp.z + Math.sin(hoek) * FLANK.afst }; tPunt = FLANK.opnieuw; } q = punt; }
        const dx = q.x - pos.x, dz = q.z - pos.z, l = Math.hypot(dx, dz);
        if (l > 1.5) { const st = Math.min(l, 4.5 / 30); pos.x += dx / l * st; pos.z += dz / l * st; }
        minD = Math.min(minD, Math.hypot(pos.x - sp.x, pos.z - sp.z));
      }
      slechtst = Math.min(slechtst, minD);
    }
    return slechtst;
  };
  uit.flank = { n: n2, aangekomen, minRatio, oudDicht, langsNieuw: loop(true), langsOud: loop(false) };

  // ---- 3. in het spel
  const as = KAART.wegassen.filter(w => w.drive && w.naam === 'Molenkrite' && w.lengte > 60)
    .sort((p, q) => { const m = (w) => { const t = w.pts[Math.floor(w.pts.length / 2)]; return Math.hypot(t[0], t[1]); }; return m(p) - m(q); })[0];
  const sp = { x: as.pts[Math.floor(as.pts.length / 2)][0], z: as.pts[Math.floor(as.pts.length / 2)][1] };
  const zet = () => { pl.inCar = null; pl.pos.set(sp.x, 0, sp.z); pl.health = 100; };
  g.sfeer.uur = 12; g.sfeer.weer = 'helder'; for (let i = 0; i < 3; i++) g.sfeer.update(0.1, sp.x, sp.z);
  uit.spel = [];
  for (const rol of ['flank', 'aanval']) for (const d0 of [6, 9]) for (const kant of [0, 1, 2, 3]) {
    P.reset(); P.proefStil = true; zet();
    P.zetSter(2, sp.x, sp.z);
    const h0 = kant * Math.PI / 2 + 0.3;
    const [ax, az] = W.resolveCollisions(sp.x + Math.cos(h0) * d0, sp.z + Math.sin(h0) * d0, 0.4);
    const a = P.proef.agent(ax, az);
    a.rol = rol; a.staat = 'jacht'; a.zijde = 1; a.mp = false; a.wagen = null; a.persoon.groep.visible = true;
    // geen andere wagens of agenten erbij
    for (const b of P.agentenLijst) if (b !== a) { b.staat = 'neer'; b.persoon.groep.visible = false; }
    const hoekVan = () => Math.atan2(a.persoon.groep.position.z - sp.z, a.persoon.groep.position.x - sp.x);
    const begin = hoekVan(), d00 = Math.hypot(ax - sp.x, az - sp.z);
    let minD = Infinity, maxOm = 0, metDekking = false;
    for (let i = 0; i < 300; i++) {
      zet();
      P.update(1 / 30);
      a.staat = 'jacht';
      const q = a.persoon.groep.position;
      minD = Math.min(minD, Math.hypot(q.x - sp.x, q.z - sp.z));
      let v = hoekVan() - begin; while (v > Math.PI) v -= Math.PI * 2; while (v < -Math.PI) v += Math.PI * 2;
      maxOm = Math.max(maxOm, Math.abs(v));
      if (a.dekking) metDekking = true;
    }
    uit.spel.push({ rol, d0: +d00.toFixed(1), minD: +minD.toFixed(1), om: Math.round(maxOm * 180 / Math.PI), metDekking });
  }
  // Erik loopt langs een flankeerder (3 m/s, 8 s, langs de as)
  {
    const A = as.pts[0], B = as.pts[as.pts.length - 1], ll = Math.hypot(B[0] - A[0], B[1] - A[1]);
    const ux = (B[0] - A[0]) / ll, uz = (B[1] - A[1]) / ll;
    uit.langs = [];
    for (const zij of [1, -1]) {
      P.reset(); P.proefStil = true;
      let ex = sp.x - ux * 12, ez = sp.z - uz * 12;
      pl.inCar = null; pl.pos.set(ex, 0, ez); pl.health = 100;
      P.zetSter(2, ex, ez);
      const [ax, az] = W.resolveCollisions(sp.x - uz * 3 * zij, sp.z + ux * 3 * zij, 0.4);
      const a = P.proef.agent(ax, az);
      a.rol = 'flank'; a.staat = 'jacht'; a.zijde = zij; a.mp = false; a.wagen = null; a.persoon.groep.visible = true;
      for (const b of P.agentenLijst) if (b !== a) { b.staat = 'neer'; b.persoon.groep.visible = false; }
      let minD = Infinity;
      for (let i = 0; i < 240; i++) {
        ex += ux * 0.1; ez += uz * 0.1;
        const [cx, cz] = W.resolveCollisions(ex, ez, 0.35); ex = cx; ez = cz;
        pl.pos.set(ex, 0, ez); pl.health = 100;
        P.update(1 / 30); a.staat = 'jacht';
        const q = a.persoon.groep.position;
        minD = Math.min(minD, Math.hypot(q.x - ex, q.z - ez));
      }
      uit.langs.push(+minD.toFixed(1));
    }
  }
  P.reset();

  // ---- 4. geen zaklamp
  g.sfeer.uur = 1; for (let i = 0; i < 3; i++) g.sfeer.update(0.1, sp.x, sp.z);
  P.proefStil = true; zet();
  const a = P.proef.agent(sp.x + 30, sp.z);
  P.update(0.001);
  let lamp = !!a.zaklamp;
  a.persoon.groep.traverse(o => { if (o.userData && o.userData.zaklamp) lamp = true; });
  // een plek met vrij zicht en zonder lantaarn langs de as: zien op 25 en 15 m, recht vooruit
  const L = as.pts, A = L[0], B = L[L.length - 1], lx = (B[0] - A[0]), lz = (B[1] - A[1]), ll = Math.hypot(lx, lz);
  let zien = null;
  for (let s = 0; s < 1 && !zien; s += 0.05) {
    const px = A[0] + lx * s, pz = A[1] + lz * s;
    const vx = px + lx / ll * 25, vz = pz + lz / ll * 25, wx = px + lx / ll * 15, wz = pz + lz / ll * 15;
    if (!W.zichtVrij(vx, vz, px, pz, 0.6)) continue;
    pl.pos.set(px, 0, pz); P.update(0.001);
    if (P.intern && P.intern.verstopNu && P.intern.verstopNu.lamp) continue;
    const yaw = Math.atan2(-(px - vx), -(pz - vz));
    zien = { op25: P.zietSpeler({ x: vx, z: vz }, yaw, false, false), op15: P.zietSpeler({ x: wx, z: wz }, yaw, false, false) };
  }
  uit.nacht = { nacht: g.sfeer.nacht, lamp, zien };
  P.reset();
  return uit;
});

kop('1. dekking aan de eigen kant');
ok(r.dekking.gevonden > 50, 'dekking gevonden', `${r.dekking.gevonden} van 400 plekken`);
ok(r.dekking.fout === 0, 'nooit voorbij of langs de speler', r.dekking.fout ? r.dekking.voorbeeld.join(' ') : '0 keer');
ok(r.dekking.oudFout > 0, 'tegenproef: de oude regel deed dat wel', `${r.dekking.oudFout} keer`);
kop('2. flanken in een boog');
ok(r.flank.aangekomen === r.flank.n, 'elke flankeerder komt bij zijn flankpunt', `${r.flank.aangekomen} van ${r.flank.n}`);
ok(r.flank.minRatio >= 0.95, 'nooit dichterbij dan hij begon (of dan de flankafstand)', `ten minste ${(r.flank.minRatio * 100).toFixed(0)} %`);
// (de rechte lijn vanaf een stilstaande plek kwam nooit dichtbij: de fout zat in een speler die beweegt)
ok(r.flank.langsNieuw >= 3, 'loopt Erik langs, dan wijkt de flankeerder uit', `dichtst ${r.flank.langsNieuw.toFixed(1)} m`);
ok(r.flank.langsOud < r.flank.langsNieuw - 1, 'tegenproef: met het oude vaste flankpunt kwam hij dichter', `dichtst ${r.flank.langsOud.toFixed(1)} m`);
kop('3. in het spel');
for (const s of r.spel) console.log(`       ${s.rol} vanaf ${s.d0} m: hoogstens ${s.om}° om hem heen, dichtst ${s.minD} m${s.metDekking ? ', met dekking' : ''}`);
const fl = r.spel.filter(s => s.rol === 'flank'), aa = r.spel.filter(s => s.rol === 'aanval');
ok(fl.every(s => s.minD >= Math.min(4, s.d0 - 0.5)), 'de flankeerder komt niet dichter dan 4 m bij Erik', fl.map(s => s.minD).join(', '));
ok(fl.every(s => s.om <= 150), 'en komt nooit aan de overkant', fl.map(s => s.om + '°').join(', '));
ok(aa.filter(s => s.metDekking).every(s => s.om <= 120), 'de aanvaller met dekking blijft aan zijn kant', aa.filter(s => s.metDekking).map(s => s.om + '°').join(', ') || 'geen dekking gevonden');
ok(r.langs.every(d => d >= 2), 'Erik loopt op 3 m langs een flankeerder: die gaat opzij in plaats van langs hem', `dichtst ${r.langs.join(', ')} m`);
kop('4. geen zaklamp');
ok(r.nacht.nacht, "het is nacht (01:00)");
ok(!r.nacht.lamp, 'een agent heeft geen zaklamp');
ok(r.nacht.zien && !r.nacht.zien.op25 && r.nacht.zien.op15, 'in het donker: op 25 m ziet hij je niet, op 15 m wel', JSON.stringify(r.nacht.zien));

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);

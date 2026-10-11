/*
 Toetst de tweede scène van No Mercy 4, "Het bunkerdorp" (stap 141): js/nomercy.js (`maakKamp`, `maakKlapbord`,
 `KAMP`), js/bouwvlak.js (`NOMERCY_KAMP`) en het blok No Mercy 4 in js/verhaal.js (`nmNaarKamp`, `nmKampBij`).

 1. Van de eerste scène door naar het bunkerdorp: "nu de tweede take!", het zwart, het kamp, de eerste set weg.
 2. De plek gemeten: in het bos, ruim van de eerste set, geen boom in het kamp, alles op de grond, geen water,
    geen botsdoos van de wereld erin; de stafauto staat er, niet bestuurbaar.
 3. Sluipen: van de rand recht naar de tent, achter de schildwachten langs; ze zien je niet. De cameraman loopt mee.
    De kaart (E), "Mooi stil", het luchtalarm, zes figuranten; ze schieten zonder schade en gaan neer na 1–3 treffers.
 4. De radiopost: C4 op de ruit, afstand, de knal; de post kantelt en is zwartgeblakerd.
 5. De close-up: bewegen telt niet, drie tellen stil wel; de balk telt af. Applaus, het klapbord omhoog.
 6. Keuze 1: € 1.000, de M1 en de patronen terug, alles opgeruimd, de opslag.
 7. Keuze 2: de M1 blijft, met de overgebleven patronen, geen geld; ook na opslaan en laden.
 8. Gezien worden: geen "cut", het gevecht gaat los, de missie loopt door; schieten wordt gehoord.
 9. Met een eigen M1: geen keuze, € 1.000, je eigen clip en voorraad.
 10. Opruimen bij mislukken (gemeten vanaf het kamp, niet de eerste set), neergaan, X en laden.
 11. Geen nieuwe shader als het kamp, de knal en het klapbord in beeld komen.

 Gebruik: npm run server &   node tools/nomercy2test.mjs 8123
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const r1 = (x) => Math.round(x * 10) / 10;

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
let soortenKlaar = false;
page.on('console', m => { if (/^soorten:/.test(m.text())) soortenKlaar = true; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const { KAART } = await import('/js/kaart.js');
  const V = await import('/js/viaduct.js');
  const A = await import('/js/audio.js');
  const O = await import('/js/opslag.js');
  for (let n = 1; n <= 15; n++) localStorage.removeItem(n === 1 ? 'tinga.spel.v1' : `tinga.spel.v1.${n}`);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  g.sfeer.uur = 14;
  window.__W = W; window.__KAART = KAART; window.__V = V; window.__O = O;
  window.__meld = [];
  const echt = g.hud.melding.bind(g.hud);
  g.hud.melding = (k, o, t) => { window.__meld.push(`${k}|${o}`); return echt(k, o, t); };
  // de geluiden van de tweede scène tellen (js/verhaal.js zoekt ze op bij het afspelen)
  window.__geluid = { luchtalarm: 0, applaus: 0 };
  for (const k of ['luchtalarm', 'applaus']) { const e = A.geluid[k].bind(A.geluid); A.geluid[k] = (...a) => { window.__geluid[k]++; return e(...a); }; }
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) v.update(dt); };
  window.__dicht = () => document.getElementById('dialoog').hidden;
  window.__klik = (max = 40) => {
    for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); }
  };
  window.__zet = (x, z) => {
    g.player.inCar = null;
    const [rx, rz] = W.resolveCollisions(x, z, 0.4);
    g.player.pos.set(rx, 0, rz); g.player.applyCamera();
  };
  // lopen naar een punt, beeld voor beeld; de grootste afstand tot de cameraman, en of er alarm kwam
  window.__loop = (x, z, v0 = 2.2, max = 60, fasen = ['kamp']) => {
    const P = g.player;
    let groot = 0, t = 0, alarm = false;
    while (t < max) {
      const dx = x - P.pos.x, dz = z - P.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.4) break;
      const s = Math.min(d, v0 * 0.05);
      P.yaw = Math.atan2(-dx, -dz);
      const [rx, rz] = W.resolveCollisions(P.pos.x + dx / d * s, P.pos.z + dz / d * s, 0.4);
      P.pos.set(rx, 0, rz); P.applyCamera();
      v.update(0.05); t += 0.05;
      const n = v.noMercy, c = n.cam.groep;
      if (n.golf && n.golf.alarm) alarm = true;
      if (t > 2 && c.visible) groot = Math.max(groot, Math.hypot(c.position.x - rx, c.position.z - rz));
      if (!fasen.includes(n.fase)) break;
    }
    return { groot, t, alarm, eind: Math.hypot(P.pos.x - x, P.pos.z - z) };
  };
  /*
   Een looproute om de stammen heen (de bomen in het bos zijn botsdozen): breedte-eerst over een rooster van 1 m
   vanaf het doel, met elke stap in vieren nagemeten met resolveCollisions; levert de punten van (x, z) naar het doel.
  */
  window.__pad = (x, z, dx, dz, R = 50) => {
    const N = 2 * R + 1, x0 = dx - R, z0 = dz - R;
    const vrij = (ax, az, bx, bz) => { for (let t = 0.25; t <= 1.001; t += 0.25) { const px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      const [rx, rz] = W.resolveCollisions(px, pz, 0.4); if (Math.hypot(rx - px, rz - pz) > 0.01 || W.pointInWater(px, pz)) return false; } return true; };
    const d = new Int32Array(N * N).fill(-1);
    d[R * N + R] = R * N + R;
    const q = [[R, R]];
    for (let h = 0; h < q.length; h++) { const [i, j] = q[h];
      for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) { const ii = i + a, jj = j + c;
        if (ii < 0 || jj < 0 || ii >= N || jj >= N || d[ii * N + jj] >= 0) continue;
        if (!vrij(x0 + i, z0 + j, x0 + ii, z0 + jj)) continue;
        d[ii * N + jj] = i * N + j; q.push([ii, jj]); } }
    let i = Math.round(x - x0), j = Math.round(z - z0);
    if (d[i * N + j] < 0) return null;
    const pad = [];
    for (let k = 0; k < 4 * N; k++) { const ouder = d[i * N + j]; const oi = Math.floor(ouder / N), oj = ouder % N;
      if (oi === i && oj === j) break; i = oi; j = oj; pad.push([x0 + i, z0 + j]); }
    pad.push([dx, dz]);
    return pad;
  };
  window.__neerMet = (w) => {
    let n = 0;
    while (w.staat !== 'neer' && n < 10) { if (v.raak(w.persoon.groep.children[0], 99)) n++; else break; window.__stap(1); }
    return n;
  };
  window.__naMissie5 = () => {
    const s = v.bewaar(); s.missie = 'johan'; s.fase = 'terug'; s.volgende = null; s.noMercyKlaar = false; s.noMercyGebeld = false;
    v.herstel(s); v.__geenVolgende(); g.politie.reset();
    const doel = g.hud.nav && g.hud.nav.doel;
    window.__zet(doel[0] + 1, doel[1] + 1);
    window.__stap(3);
    window.__klik();
    window.__stap(2);
  };
  // het gesprek bij Erik Jan, omkleden, en dan meteen naar het bunkerdorp (de eerste scène toetst nomercytest)
  window.__naarKamp = () => {
    v.startNoMercy(); window.__klik(); window.__stap(90);
    v.noMercy.naarKamp();
    window.__stap(2);
    window.__klik();           // het praatje van Erik Jan bij het kamp
    window.__stap(2);
    return v.noMercy.fase;
  };
  // de kaart gepakt, alle mannen neer, de radiopost op, tot aan de close-up
  window.__totCloseup = () => {
    const n = v.noMercy, i = n.kamp.ingang;
    window.__zet(i.x, i.z); window.__stap(2); v.toets(); window.__stap(2);
    for (const w of v.noMercy.golf.wachters) window.__neerMet(w);
    window.__stap(4); window.__klik(); window.__stap(4);
    const r = v.noMercy.kamp.radioRuit;
    window.__zet(r.x, r.z); window.__stap(2); v.toets();
    const rp = v.noMercy.kamp.radioPlek;
    window.__zet(rp.x - 15, rp.z); window.__stap(100);
    window.__klik(); window.__stap(4);
    return v.noMercy.fase;
  };
  window.__stilOp = () => {
    const c = v.noMercy.kamp.closeup;
    window.__zet(c.x, c.z);
    for (let i = 0; i < 90 && v.noMercy.fase === 'closeup'; i++) window.__stap(1);
    return v.noMercy.fase;
  };
  window.__leeg = () => {
    const n = v.noMercy, P = g.player;
    return !n.kamp.zichtbaar && !n.set.zichtbaar && !n.golf && n.duitsers.every(p => !p.groep.visible) && !n.klapbord.visible
      && !n.staf.mesh.visible && n.staf.x > 1e4 && n.tentDoos.h === 0 && n.radioDoos.h === 0 && g.derde.pak === 'gewoon'
      && document.getElementById('schaduwbalk').hidden;
  };
});

// ------------------------------------------------------------------ 1. door naar het bunkerdorp
kop('1. van de eerste scène naar het bunkerdorp');
const een = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__naMissie5();
  P.wapens = P.wapens.filter(w => w !== 'garand'); P.magazijnen.garand = 0; P.reserve = 40; P.zetWapen('pistool');
  v.startNoMercy(); window.__klik(); window.__stap(90);
  // de eerste scène in het kort: C4, knal, vier neer, het bos uit, vijf neer
  const f = v.noMercy.set.groep.position;
  window.__zet(f.x + 2, f.z + 9); window.__stap(3); window.__klik();
  const r = v.noMercy.set.ruit; window.__zet(r.x + 0.8, r.z); window.__stap(1); v.toets();
  window.__zet(f.x + 18, f.z + 6); window.__stap(100);
  for (const w of v.noMercy.golf.wachters) window.__neerMet(w);
  window.__stap(3);
  const u = v.noMercy.uitgang; window.__zet(u.x, u.z); window.__stap(3);
  for (const w of v.noMercy.golf.wachters) window.__neerMet(w);
  window.__zet(u.x, u.z); window.__stap(70);
  const uit = { fase: v.noMercy.fase, zin: document.getElementById('dialoogTekst').textContent, wie: document.getElementById('dialoogNaam').textContent };
  window.__klik(); window.__stap(100);
  const n = v.noMercy, K = n.kamp.midden;
  uit.na = { fase: n.fase, kamp: n.kamp.zichtbaar, set: n.set.zichtbaar, golf: n.golf ? n.golf.aantal : 0,
    dSpeler: Math.hypot(P.pos.x - K.x, P.pos.z - K.z), cam: n.cam.groep.visible ? Math.hypot(n.cam.groep.position.x - P.pos.x, n.cam.groep.position.z - P.pos.z) : -1,
    ej: n.ej.groep.visible, staf: n.staf.mesh.visible ? Math.hypot(n.staf.x - K.x, n.staf.z - K.z) : -1, dalen: n.duitsers.filter(p => p.groep.visible).length,
    zin: document.getElementById('dialoogTekst').textContent };
  window.__klik(); window.__stap(2);
  uit.na.daarna = v.noMercy.fase;
  uit.na.opdracht = document.getElementById('opdracht').textContent;
  return uit;
});
ok(een.fase === 'take2' && een.wie === 'Erik Jan' && /Goed zo — nu de tweede take!/.test(een.zin), 'Erik Jan: "Goed zo — nu de tweede take!"', een.zin);
ok(een.na.fase === 'kampIntro' && een.na.kamp && !een.na.set, 'na het zwart: het kamp staat er, de eerste set is weg', een.na.fase);
ok(een.na.golf === 2 && een.na.dalen === 2, 'twee schildwachten, verder geen Duitsers', `${een.na.golf}`);
ok(een.na.dSpeler > 25 && een.na.dSpeler < 40, 'Erik staat aan de rand van de open plek', `${r1(een.na.dSpeler)} m van het midden`);
ok(een.na.cam > 0 && een.na.cam < 5 && een.na.ej, 'de cameraman naast je, Erik Jan op zijn plek', `${r1(een.na.cam)} m`);
ok(een.na.staf >= 0 && een.na.staf < 12, 'de stafauto staat in het kamp', `${r1(een.na.staf)} m`);
ok(een.na.daarna === 'kamp' && /kaart/.test(een.na.opdracht), 'na het praatje: de kaart pakken, sluipen of vechten', een.na.opdracht);

// ------------------------------------------------------------------ 2. de plek gemeten
kop('2. het bunkerdorp gemeten');
const twee = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, W = window.__W, V = window.__V;
  const n = v.noMercy, K = n.kamp.midden, S = n.set.groep.position;
  let boom = Infinity;
  for (const t of W.treePositions) boom = Math.min(boom, Math.hypot(t.x - K.x, t.z - K.z));
  // de plekken: midden, tent, radiopost, stafauto, close-up, de ruiten, de ingang
  const plekken = { midden: K, tent: n.kamp.tent, radio: n.kamp.radioPlek, staf: n.kamp.staf, closeup: n.kamp.closeup,
    radioRuit: n.kamp.radioRuit, ingang: n.kamp.ingang, camera: n.kamp.cameraPlek, regisseur: n.kamp.regisseur, ejSlot: n.kamp.ejSlot };
  // alles waar iemand staat of loopt, binnen de open plek (daarbuiten staan de stammen, en die zijn botsdozen)
  let buiten = 0;
  for (const p of [...Object.values(plekken), ...n.kamp.wachtPosten().flatMap(w => [{ x: w.a[0], z: w.a[1] }, { x: w.b[0], z: w.b[1] }])])
    buiten = Math.max(buiten, Math.hypot(p.x - K.x, p.z - K.z));
  let water = 0, hoogte = 0;
  const y0 = n.kamp.groep.position.y;
  for (const p of Object.values(plekken)) {
    if (W.pointInWater(p.x, p.z)) water++;
    hoogte = Math.max(hoogte, Math.abs(V.grondHoogte(p.x, p.z) - y0));
  }
  // botsdozen van de wereld in het kamp: de eigen dozen even plat, dan op ringen tot 11 m niets weggeduwd
  const th = n.tentDoos.h, rh = n.radioDoos.h; n.tentDoos.h = 0; n.radioDoos.h = 0;
  let geduwd = 0;
  for (let i = 0; i < 36; i++) for (const r of [0, 3, 6, 9, 11]) {
    const a = i / 36 * Math.PI * 2, x = K.x + Math.cos(a) * r, z = K.z + Math.sin(a) * r;
    const [rx, rz] = W.resolveCollisions(x, z, 0.3);
    geduwd = Math.max(geduwd, Math.hypot(rx - x, rz - z));
  }
  n.tentDoos.h = th; n.radioDoos.h = rh;
  // de eigen dozen houden je wel tegen
  const [tx, tz] = W.resolveCollisions(n.kamp.tent.x, n.kamp.tent.z, 0.3);
  const tentHoudt = Math.hypot(tx - n.kamp.tent.x, tz - n.kamp.tent.z) > 1;
  // de laagste punt van tent en radiopost tegen de grond
  g.scene.updateMatrixWorld(true);
  let minY = Infinity;
  n.kamp.groep.traverse(o => { if (o.isMesh && o.visible) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); minY = Math.min(minY, b.min.y); } });
  const st = n.staf;
  return { buiten, boom, water, hoogte, geduwd, tentHoudt, minY, grond: V.grondHoogte(K.x, K.z), inBos: n.bos.inBos(K.x, K.z),
    vanSet: Math.hypot(K.x - S.x, K.z - S.z), stafY: st.mesh.position.y, stafGrond: V.grondHoogte(st.x, st.z), stafRijdt: st.driveable,
    stafIn: v.noMercy.staf === st && g.vehicles.cars.includes(st) };
});
ok(twee.inBos, 'midden in het Tinga-bos');
ok(twee.vanSet > 60, 'ruim weg van de eerste set', `${r1(twee.vanSet)} m`);
ok(twee.boom > 11, 'geen boom in het kamp: de dichtstbijzijnde stam', `${r1(twee.boom)} m van het midden`);
ok(twee.water === 0, 'geen water onder het kamp');
ok(twee.buiten < 12, 'alle plekken en de posten van de schildwachten binnen de open plek', `verst ${r1(twee.buiten)} m van het midden`);
ok(twee.hoogte < 0.05 && Math.abs(twee.minY - twee.grond) < 0.05, 'op de grond', `hoogteverschil ${twee.hoogte.toFixed(3)}, onderkant ${twee.minY.toFixed(3)} tegen ${twee.grond.toFixed(3)}`);
ok(twee.geduwd < 0.02, 'geen botsdoos van de wereld in het kamp', `${twee.geduwd.toFixed(3)} m`);
ok(twee.tentHoudt, 'de tent houdt je tegen');
ok(twee.stafIn && !twee.stafRijdt && Math.abs(twee.stafY - twee.stafGrond) < 0.05, 'de stafauto: een auto uit de wereld, niet bestuurbaar, op de grond', `${twee.stafY.toFixed(2)}`);

// ------------------------------------------------------------------ 3. sluipen, de kaart, de figuranten
kop('3. sluipen, de kaart, het alarm');
const drie = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const n = v.noMercy, i = n.kamp.ingang;
  // van de rand naar de ingang van de tent, achter de schildwachten langs (om de stammen heen)
  const pad = window.__pad(P.pos.x, P.pos.z, i.x - 0.6, i.z);
  const l = { groot: 0, t: 0, alarm: false, eind: 99, punten: pad ? pad.length : 0 };
  for (const [px, pz] of pad || []) {
    const s = window.__loop(px, pz, 2.2, 6);
    l.t += s.t; l.alarm = l.alarm || s.alarm;
    const c = v.noMercy.cam.groep;
    if (l.t > 2 && c.visible) l.groot = Math.max(l.groot, Math.hypot(c.position.x - P.pos.x, c.position.z - P.pos.z));
    if (v.noMercy.fase !== 'kamp') break;
  }
  l.eind = Math.hypot(P.pos.x - (i.x - 0.6), P.pos.z - i.z);
  const uit = { l, fase: v.noMercy.fase, gezien: v.noMercy.gezien, hint: !document.getElementById('praat').hidden && document.getElementById('praat').textContent };
  const alarmVoor = window.__geluid.luchtalarm;
  v.toets(); window.__stap(1);
  const m = v.noMercy;
  uit.na = { fase: m.fase, stil: m.stil, kaart: m.kamp.kaart.visible, zin: document.getElementById('dialoogTekst').textContent,
    alarm: window.__geluid.luchtalarm - alarmVoor, aantal: m.golf.aantal, alarmGolf: m.golf.alarm };
  // ze schieten, maar zonder schade
  const golf = m.golf;
  let schoten = 0;
  for (const w of golf.wachters) { const e = w.persoon.vuur.bind(w.persoon); w.persoon.vuur = () => { schoten++; e(); }; }
  P.health = 100;
  window.__stap(400);
  uit.schoten = schoten; uit.health = P.health;
  uit.uniform = golf.wachters.every(w => w.persoon.hoofd.getObjectByName('helm') && w.persoon.wapenSoort === 'garand');
  uit.levens = v.noMercy.levens.slice(0, 8);
  uit.treffers = golf.wachters.map(w => window.__neerMet(w));
  window.__stap(4);
  uit.radio = { fase: v.noMercy.fase, merk: v.noMercy.merk.zichtbaar, opdracht: document.getElementById('opdracht').textContent };
  return uit;
});
ok(drie.l.eind < 1 && !drie.l.alarm && !drie.gezien, 'achter de schildwachten langs naar de tent: niet gezien', `${r1(drie.l.t)} s gelopen over ${drie.l.punten} punten, ${r1(drie.l.eind)} m van de ingang`);
ok(drie.l.groot > 0 && drie.l.groot < 8, 'de cameraman loopt mee', `hoogstens ${r1(drie.l.groot)} m`);
ok(/kaart/.test(drie.hint || ''), 'bij de ingang: E — de kaart pakken', drie.hint);
ok(drie.na.fase === 'figuranten' && drie.na.stil && !drie.na.kaart, 'E pakt de kaart, ongezien', drie.na.fase);
ok(/Mooi stil, dat is cinema!/.test(drie.na.zin), 'Erik Jan: "Mooi stil, dat is cinema!"', drie.na.zin);
ok(drie.na.alarm === 1 && drie.na.alarmGolf, 'het luchtalarm gaat', `${drie.na.alarm}`);
ok(drie.na.aantal === 8, 'zes figuranten erbij', `${drie.na.aantal - 2}`);
ok(drie.schoten >= 4 && drie.health === 100, 'ze schieten, maar de speler verliest geen leven', `${drie.schoten} schoten, leven ${drie.health}`);
ok(drie.uniform, 'in feldgrau met helm en M1');
ok(drie.treffers.every((t, i) => t >= 1 && t <= 3 && t === drie.levens[i]), 'elk gaat neer na zijn eigen 1 tot 3 treffers', `${drie.treffers.join(', ')}`);
ok(drie.radio.fase === 'radio' && drie.radio.merk && /radiopost/.test(drie.radio.opdracht), 'daarna: de radiopost, met een gele markering', drie.radio.opdracht);

// ------------------------------------------------------------------ 4. de radiopost
kop('4. de radiopost opblazen');
const vier = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal;
  window.__klik();
  const r = v.noMercy.kamp.radioRuit;
  window.__zet(r.x, r.z); window.__stap(2);
  const uit = { hint: !document.getElementById('praat').hidden && document.getElementById('praat').textContent };
  v.toets();
  uit.c4 = v.noMercy.c4.zichtbaar; uit.fase = v.noMercy.fase;
  window.__stap(60);
  uit.nogNiet = v.noMercy.fase;
  const rp = v.noMercy.kamp.radioPlek;
  const l = window.__loop(rp.x - 14, rp.z, 4.5, 20, ['radioWeg']);
  window.__stap(30);
  const n = v.noMercy, romp = n.kamp.post.children[0];
  uit.knal = { fase: n.fase, kantel: romp.rotation.z, kleur: n.kamp.radio.material[0].color.getHSL({}).l, c4: n.c4.zichtbaar, knal: !!n.knal };
  window.__stap(60);
  uit.daarna = { fase: v.noMercy.fase, merk: v.noMercy.merk.zichtbaar, opdracht: document.getElementById('opdracht').textContent };
  return uit;
});
ok(/C4/.test(vier.hint || ''), 'bij de ruit: E — de C4 plaatsen', vier.hint);
ok(vier.c4 && vier.fase === 'radioWeg', 'E plaatst de C4');
ok(vier.nogNiet === 'radioWeg', 'dichtbij blijft hij liggen');
ok((vier.knal.fase === 'radioKnal' || vier.knal.fase === 'closeup') && !vier.knal.c4, 'op afstand: de knal', vier.knal.fase);
ok(Math.abs(vier.knal.kantel) > 0.3 && vier.knal.kleur < 0.12, 'de post kantelt en is zwartgeblakerd', `${r1(vier.knal.kantel)} rad, helderheid ${vier.knal.kleur.toFixed(2)}`);
ok(vier.daarna.fase === 'closeup' && vier.daarna.merk && /close-up/.test(vier.daarna.opdracht), 'daarna de close-up, met een gele ruit', vier.daarna.opdracht);

// ------------------------------------------------------------------ 5. de close-up
kop('5. de close-up');
const vijf = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__klik();
  const c = v.noMercy.kamp.closeup;
  window.__zet(c.x, c.z);
  // heen en weer schuifelen op de ruit (1 m/s): telt niet
  let groot = 0;
  for (let i = 0; i < 100; i++) {
    const dx = (Math.floor(i / 8) % 2 ? -1 : 1) * 0.05;
    P.pos.x += dx; P.applyCamera();
    window.__stap(1);
    groot = Math.max(groot, v.noMercy.stilT);
  }
  const uit = { schuifel: groot, fase: v.noMercy.fase };
  // naast de ruit stil: telt ook niet
  window.__zet(c.x + 2.5, c.z); window.__stap(40);
  uit.naast = v.noMercy.stilT;
  // stil op de ruit
  window.__zet(c.x, c.z);
  window.__stap(30);
  const b = document.getElementById('schaduwbalk');
  uit.half = { stilT: v.noMercy.stilT, balk: !b.hidden, nu: parseFloat(b.style.getPropertyValue('--nu')), tekst: b.querySelector('.tekst').textContent };
  window.__stap(40);
  const n = v.noMercy;
  g.scene.updateMatrixWorld(true);
  const kb = n.klapbord.getWorldPosition(new (n.klapbord.position.constructor)());
  const ej = n.ej.groep.position;
  uit.na = { fase: n.fase, balk: b.hidden, applaus: window.__geluid.applaus, klapbord: n.klapbord.visible && n.ej.groep.visible,
    kbHoog: kb.y - ej.y, kbBij: Math.hypot(kb.x - ej.x, kb.z - ej.z), ejPlek: Math.hypot(ej.x - n.kamp.ejSlot.x, ej.z - n.kamp.ejSlot.z), wie: document.getElementById('dialoogNaam').textContent,
    zin: document.getElementById('dialoogTekst').textContent };
  window.__klik(6);
  window.__stap(2);
  window.__klik(6); window.__stap(2);
  uit.keuze = { fase: v.noMercy.fase, open: v.openKeuze, opdracht: document.getElementById('opdracht').textContent };
  return uit;
});
ok(vijf.schuifel < 0.1 && vijf.fase === 'closeup', 'bewegen op de ruit telt niet', `hoogstens ${vijf.schuifel.toFixed(2)} s`);
ok(vijf.naast === 0, 'stilstaan naast de ruit ook niet');
ok(vijf.half.balk && vijf.half.stilT > 1.2 && vijf.half.stilT < 1.8 && Math.abs(vijf.half.nu - vijf.half.stilT / 3 * 100) < 4, 'stil op de ruit: de balk loopt op', `${vijf.half.stilT.toFixed(2)} s, ${vijf.half.nu}%: ${vijf.half.tekst}`);
ok(vijf.na.fase === 'applaus' && vijf.na.balk && vijf.na.applaus === 1, 'na drie tellen: applaus van de ploeg, de balk weg', vijf.na.fase);
ok(vijf.na.klapbord && vijf.na.kbHoog > 1.4 && vijf.na.kbBij < 0.8, 'Erik Jan houdt het klapbord omhoog', `${r1(vijf.na.kbHoog)} m hoog`);
ok(vijf.na.ejPlek < 1, 'naast de camera: hij is van zijn regieplek naar de camera gelopen', `${r1(vijf.na.ejPlek)} m van zijn plek`);
ok(vijf.na.wie === 'Erik Jan' && /wrap/.test(vijf.na.zin), '"dat is een wrap!"', vijf.na.zin);
ok(vijf.keuze.fase === 'keuze' && Array.isArray(vijf.keuze.open) && vijf.keuze.open.length === 2 && /M1/.test(vijf.keuze.open[1]), 'de keuze staat open, ook als knoppen', JSON.stringify(vijf.keuze.open));

// ------------------------------------------------------------------ 6. keuze 1: het geld
kop('6. keuze 1: € 1.000');
const zes = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const geld = v.geld;
  const goed = v.kiesHuis(1);
  window.__klik(); window.__stap(60);
  window.__stap(160);           // de cameraman loopt terug
  const n = v.noMercy;
  return { goed, fase: n.fase, klaar: n.klaar, geld: v.geld - geld, wapens: P.wapens.slice(), reserve: P.reserve, leeg: window.__leeg(),
    cam: n.cam.groep.visible, ej: n.ej.groep.visible, m1: n.m1, opslag: v.bewaar(), melding: window.__meld.slice(-2).join(' / '),
    missie: v.missie, missieFase: v.fase };
});
ok(zes.goed && zes.fase === 'uit' && zes.klaar, 'gekozen: klaar', zes.fase);
ok(zes.geld === 1000, '€ 1.000', `${zes.geld}`);
ok(!zes.wapens.includes('garand') && zes.reserve === 40, 'de M1 en de patronen zijn terug: precies je eigen voorraad', `${zes.wapens.join(',')}, ${zes.reserve}`);
ok(zes.leeg && !zes.cam && !zes.ej, 'alles opgeruimd: kamp, stafauto, klapbord, figuranten, cameraman, Erik Jan, uniform');
ok(/MISSIE GESLAAGD/.test(zes.melding), 'MISSIE GESLAAGD', zes.melding);
ok(zes.opslag.noMercyKlaar === true && zes.opslag.noMercyM1 === false && !zes.m1, 'in de opslag: klaar, M1 niet gehouden');
ok(zes.missie === 'bx' && zes.missieFase === 'wacht', 'missie 6 wacht weer', `${zes.missie}/${zes.missieFase}`);

// ------------------------------------------------------------------ 7. keuze 2: de M1 houden
kop('7. keuze 2: de M1 houden');
const zeven = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, O = window.__O;
  window.__naMissie5();
  P.wapens = P.wapens.filter(w => w !== 'garand'); P.magazijnen.garand = 0; P.reserve = 40; P.zetWapen('pistool');
  const geld = v.geld;
  const uit = { kamp: window.__naarKamp() };
  uit.tot = window.__totCloseup();
  window.__klik();
  uit.close = window.__stilOp();
  window.__klik(6); window.__stap(2); window.__klik(6); window.__stap(2);
  uit.keuze = v.noMercy.fase;
  // twaalf schoten verschoten
  P.zetWapen('garand'); P.ammo = 4; P.reserve -= 8;
  const pot = P.reserve + P.ammo;
  v.kiesHuis(2); window.__klik(); window.__stap(60);
  uit.na = { fase: v.noMercy.fase, klaar: v.noMercy.klaar, m1: v.noMercy.m1, geld: v.geld - geld, wapens: P.wapens.slice(), pot,
    nuPot: P.reserve + (P.wapenSoort === 'garand' ? P.ammo : P.magazijnen.garand), leeg: window.__leeg(), melding: window.__meld.slice(-1)[0] };
  // opslaan en laden
  window.__stap(200);
  const gelukt = O.bewaarSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: v });
  P.wapens = ['pistool', 'mes']; P.zetWapen('pistool'); P.reserve = 0;
  const geladen = O.laadSpel({ player: P, sfeer: g.sfeer, vehicles: g.vehicles, verhaal: v });
  window.__stap(10);
  uit.geladen = { gelukt, geladen: !!geladen, wapens: P.wapens.slice(), m1: v.noMercy.m1, pot: P.reserve + (P.wapenSoort === 'garand' ? P.ammo : P.magazijnen.garand), ej: !!g.hud.ej };
  for (const k of Object.keys(localStorage)) if (k.startsWith('tinga.spel')) localStorage.removeItem(k);
  return uit;
});
ok(zeven.kamp === 'kamp' && zeven.tot === 'closeup' && zeven.close === 'applaus' && zeven.keuze === 'keuze', 'opnieuw tot aan de keuze', `${zeven.kamp}, ${zeven.tot}, ${zeven.close}, ${zeven.keuze}`);
ok(zeven.na.klaar && zeven.na.m1 && zeven.na.geld === 0, 'keuze 2: geen geld, de M1 is van jou', `${zeven.na.geld}`);
ok(zeven.na.wapens.includes('garand') && zeven.na.nuPot === zeven.na.pot, 'de M1 blijft, met alle overgebleven patronen', `${zeven.na.pot} → ${zeven.na.nuPot}`);
ok(zeven.na.leeg, 'en verder alles opgeruimd');
ok(/van jou/.test(zeven.na.melding || ''), 'de melding zegt het', zeven.na.melding);
ok(zeven.geladen.gelukt && zeven.geladen.geladen && zeven.geladen.wapens.includes('garand') && zeven.geladen.m1 && zeven.geladen.pot === zeven.na.pot, 'na opslaan en laden: de M1 en de patronen zijn er nog', `${zeven.geladen.wapens.join(',')}, ${zeven.geladen.pot}`);
ok(!zeven.geladen.ej, 'en geen Erik Jan meer');

// ------------------------------------------------------------------ 8. gezien worden
kop('8. gezien: geen cut, gewoon vechten');
const acht = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  P.wapens = P.wapens.filter(w => w !== 'garand'); P.magazijnen.garand = 0; P.reserve = 40; P.zetWapen('pistool');
  window.__naMissie5();
  window.__naarKamp();
  const meld = window.__meld.length;
  // recht voor schildwacht A (die naar het oosten kijkt), op zes meter
  const a = v.noMercy.golf.wachters[0].persoon.groep.position;
  window.__zet(a.x + 6, a.z);
  window.__stap(40);
  const n = v.noMercy;
  const uit = { fase: n.fase, gezien: n.gezien, alarm: n.golf.alarm, staat: n.golf.wachters.map(w => w.staat), zin: document.getElementById('dialoogTekst').textContent,
    mislukt: window.__meld.slice(meld).some(m => /MISLUKT/.test(m)), opdracht: document.getElementById('opdracht').textContent };
  P.health = 100; window.__stap(100); uit.health = P.health;
  // dan toch de kaart: geen "Mooi stil"
  const i = v.noMercy.kamp.ingang; window.__zet(i.x, i.z); window.__stap(2); v.toets(); window.__stap(1);
  uit.kaart = { fase: v.noMercy.fase, stil: v.noMercy.stil, zin: document.getElementById('dialoogTekst').textContent };
  v.klusAfbreken(); window.__stap(2);
  uit.xLeeg = window.__leeg();
  // gehoord: een schot vanaf de rand
  window.__naMissie5();
  window.__naarKamp();
  window.__stap(10);
  const voor = v.noMercy.golf.alarm;
  // (wat js/main.js bij elk schot van de speler doet)
  v.schotGehoord(P.pos.x, P.pos.z);
  window.__stap(10);
  uit.gehoord = { voor, na: v.noMercy.golf.alarm, gezien: v.noMercy.gezien, fase: v.noMercy.fase };
  v.klusAfbreken(); window.__stap(2);
  return uit;
});
ok(acht.gezien && acht.alarm && acht.fase === 'kamp', 'gezien: het alarm, en de missie loopt door', acht.fase);
ok(!acht.mislukt, 'geen "Cut! Overnieuw": niets mislukt');
ok(acht.staat.every(s => s === 'aanval' || s === 'zoekt'), 'de schildwachten vechten', acht.staat.join(', '));
ok(/Ze zien je/.test(acht.zin), 'Erik Jan: "Ze zien je! … vechten!"', acht.zin);
ok(acht.health === 100, 'zonder schade');
ok(acht.kaart.fase === 'figuranten' && !acht.kaart.stil && !/Mooi stil/.test(acht.kaart.zin), 'de kaart daarna: wel het alarm, geen "Mooi stil"', acht.kaart.zin);
ok(acht.xLeeg, 'X ruimt het kamp op');
ok(!acht.gehoord.voor && acht.gehoord.na && acht.gehoord.fase === 'kamp', 'een schot wordt gehoord: alarm, de missie loopt door', JSON.stringify(acht.gehoord));

// ------------------------------------------------------------------ 9. met een eigen M1
kop('9. met een eigen M1');
const negen = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  window.__naMissie5();
  if (!P.wapens.includes('garand')) P.wapens.push('garand');
  P.magazijnen.garand = 5; P.reserve = 37; P.zetWapen('pistool');
  const pistool = P.ammo;
  const geld = v.geld;
  window.__naarKamp();
  P.ammo = 2;                       // zes verschoten
  window.__totCloseup(); window.__klik(); window.__stilOp();
  // de twee regels van het applaus, dan Erik Jan over je eigen M1
  window.__klik(2);
  const uit = { open: v.openKeuze, fase: v.noMercy.fase, zin: document.getElementById('dialoogTekst').textContent };
  window.__klik(6); window.__stap(4);
  uit.na = { fase: v.noMercy.fase, klaar: v.noMercy.klaar, m1: v.noMercy.m1, geld: v.geld - geld, wapens: P.wapens.slice(), clip: P.magazijnen.garand,
    reserve: P.reserve, soort: P.wapenSoort, ammo: P.ammo, pistool, leeg: window.__leeg() };
  return uit;
});
ok(negen.open === null && negen.fase === 'applaus' && /eigen M1/.test(negen.zin), 'geen keuze: je had al een M1', negen.zin);
ok(negen.na.klaar && negen.na.geld === 1000, '€ 1.000', `${negen.na.geld}`);
ok(negen.na.wapens.includes('garand') && negen.na.clip === 5 && negen.na.reserve === 37, 'je eigen M1 met je eigen clip en voorraad', `clip ${negen.na.clip}, voorraad ${negen.na.reserve}`);
ok(negen.na.soort === 'pistool' && negen.na.ammo === negen.na.pistool && negen.na.leeg, 'weer het wapen dat je vasthad, en alles opgeruimd');

// ------------------------------------------------------------------ 10. opruimen
kop('10. mislukken, neergaan, laden');
const tien = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  P.wapens = P.wapens.filter(w => w !== 'garand'); P.magazijnen.garand = 0; P.reserve = 40; P.zetWapen('pistool');
  const uit = {};
  // 140 m van het kamp (en 230 van de eerste set): nog goed
  window.__naMissie5(); window.__naarKamp();
  const K = v.noMercy.kamp.midden, S = v.noMercy.set.groep.position;
  let x = K.x + 140, z = K.z;
  window.__zet(x, z); window.__stap(3);
  uit.ver140 = { fase: v.noMercy.fase, vanSet: Math.hypot(P.pos.x - S.x, P.pos.z - S.z), vanKamp: Math.hypot(P.pos.x - K.x, P.pos.z - K.z) };
  window.__zet(K.x + 175, K.z); window.__stap(3);
  uit.ver175 = { fase: v.noMercy.fase, leeg: window.__leeg(), meld: window.__meld.slice(-1)[0], reserve: P.reserve, wapens: P.wapens.slice() };
  // neergaan midden in het gevecht met de figuranten
  window.__naMissie5(); window.__naarKamp();
  const i = v.noMercy.kamp.ingang; window.__zet(i.x, i.z); window.__stap(2); v.toets(); window.__stap(2);
  uit.voorDood = v.noMercy.fase;
  window.__autoplay = true;
  v.dood(); window.__stap(80);
  window.__autoplay = false;
  uit.dood = { leeg: window.__leeg(), fase: v.noMercy.fase, garand: P.wapens.includes('garand') };
  // laden midden in de close-up
  g.player.active = true;
  window.__naMissie5();
  const s = v.bewaar();
  window.__naarKamp(); window.__totCloseup();
  uit.voorLaden = v.noMercy.fase;
  v.herstel(s); window.__stap(2);
  uit.laden = { leeg: window.__leeg(), fase: v.noMercy.fase };
  // X tijdens de keuze doet niets
  g.player.active = false; P.health = 100;
  // (laden hierboven was alleen het verhaal: de geleende M1 zat nog in de wapens, js/opslag.js zet die normaal terug)
  P.wapens = P.wapens.filter(w => w !== 'garand'); P.magazijnen.garand = 0; P.reserve = 40; P.zetWapen('pistool');
  const f = [];
  window.__naMissie5(); f.push(v.noMercy.fase); window.__naarKamp(); f.push(v.noMercy.fase); window.__totCloseup(); f.push(v.noMercy.fase);
  window.__klik(); window.__stilOp(); f.push(v.noMercy.fase);
  window.__klik(6); window.__stap(2); window.__klik(6); window.__stap(2);
  uit.xKeuze = { x: v.klusAfbreken(), fase: v.noMercy.fase, f: f.join('>'), meld: window.__meld.slice(-1)[0] };
  v.kiesHuis(1); window.__klik(); window.__stap(4);
  return uit;
});
ok(tien.ver140.fase === 'kamp' && tien.ver140.vanSet > 160, 'de grens telt in het bunkerdorp vanaf het kamp, niet vanaf de eerste set', `${r1(tien.ver140.vanKamp)} m van het kamp, ${r1(tien.ver140.vanSet)} m van de set`);
ok(tien.ver175.leeg && /MISLUKT/.test(tien.ver175.meld || '') && tien.ver175.reserve === 40 && !tien.ver175.wapens.includes('garand'), 'verder dan 160 m van het kamp: mislukt, alles weg, de bruikleen terug', tien.ver175.meld);
ok(tien.voorDood === 'figuranten' && tien.dood.leeg && !tien.dood.garand, 'neergaan in het gevecht ruimt op', JSON.stringify(tien.dood));
ok(tien.voorLaden === 'closeup' && tien.laden.leeg && tien.laden.fase !== 'closeup', 'laden ruimt op', JSON.stringify(tien.laden));
ok(!tien.xKeuze.x && tien.xKeuze.fase === 'keuze', 'X tijdens de keuze doet niets', JSON.stringify(tien.xKeuze));

// ------------------------------------------------------------------ 11. shaders
kop('11. geen nieuwe shader');
await page.evaluate(() => window.__game.reliëfAf());
for (let i = 0; i < 1800 && !soortenKlaar; i++) await new Promise(r => setTimeout(r, 200));
const elf = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, R = g.renderer, P = g.player;
  if (!R) return { overgeslagen: true };
  P.wapens = P.wapens.filter(w => w !== 'garand'); P.magazijnen.garand = 0; P.reserve = 40; P.zetWapen('pistool');
  window.__naMissie5();
  const K = { x: -63, z: -214 };
  const kijk = () => {
    const c = v.noMercy.kamp.closeup || K;
    P.inCar = null; P.pos.set(K.x - 16, 0, K.z + 4); P.yaw = Math.atan2(-(K.x - P.pos.x), -(K.z - P.pos.z)); P.pitch = 0; P.applyCamera();
    g.scene.updateMatrixWorld(true); R.render(g.scene, P.camera);
  };
  kijk();
  const voor = R.info.programs.length;
  window.__naarKamp();
  kijk();
  const i = v.noMercy.kamp.ingang; window.__zet(i.x, i.z); window.__stap(2); v.toets(); window.__stap(30);
  kijk();
  for (const w of v.noMercy.golf.wachters) window.__neerMet(w);
  window.__stap(4); window.__klik();
  const r = v.noMercy.kamp.radioRuit; window.__zet(r.x, r.z); window.__stap(2); v.toets();
  window.__zet(r.x - 15, r.z); window.__stap(36);
  kijk();
  window.__stap(60); window.__klik();
  window.__stilOp();
  kijk();
  const na = R.info.programs.length;
  v.kiesHuis(1); window.__klik(); window.__klik(6); window.__klik(6); window.__stap(4);
  return { voor, na };
});
if (elf.overgeslagen) ok(false, 'geen renderer in __game');
else ok(elf.na === elf.voor, 'het kamp, de figuranten, de knal en het klapbord vertalen geen nieuwe shader', `${elf.voor} → ${elf.na} programma's (soorten vooraf: ${soortenKlaar ? 'klaar' : 'niet gezien'})`);

await browser.close();
console.log(fouten ? `\n${fouten} fout` : '\nalles goed');
process.exit(fouten ? 1 : 0);

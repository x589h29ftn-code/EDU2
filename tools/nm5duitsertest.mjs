/*
 Stap 167: "bij laatste no mercy missie kon ik een Duitser niet vinden. Misschien zat die vast in een gebouw oid."

 Meet elke Duitser van No Mercy 5 (de molen De Rat in IJlst) en van No Mercy 4 (het bos en het bunkerdorp):

 1. No Mercy 5, aan wal: voor elk van de vijf (het MG, de sluipschutter, drie aan de voet) de plek: niet in het water,
    niet in een pand (KAART.panden), niet in een botsdoos, op de grond (of, de sluipschutter, op de stelling), zichtbaar
    in de scène; vanaf een plek waar je kunt komen een vrije kijklijn (`zichtVrij`, voor de sluipschutter zonder de dozen
    van het molenpand en met de romp ertussen); te voet bereikbaar (`zoekLooppad`, behalve de sluipschutter).
 2. De overtocht en het gevecht: twee minuten spel met `verhaal.update`, de speler loopt een ronde om de molen; elk
    beeld: niemand in een pand, een doos, het water of op de verkeerde hoogte, niemand verdwijnt. De sluipschutter ziet je
    en schiet (vóór stap 167 stond hij binnen de botsdozen van het molenpand en zag hij nooit iemand: geen schot, geen
    flits, een stille man hoog op de stelling 's nachts).
 3. Nog twee over: rode ruitjes op de kaart (js/hud.js `zetVijanden`), ook op de minikaart, met één melding; dan echte
    schoten (`player.shoot`) vanaf een plek op de grond op de laatste twee, tot ze liggen; daarna geen ruitjes meer.
 4. `n5VrijePost`: een plek in het molenpand wordt een vrije plek erbuiten.
 5. Opnieuw beginnen: X ruimt alles op (geen Duitser meer zichtbaar, geen ruitjes), een nieuwe poging zet er weer
    precies vijf neer, niet dubbel.
 6. No Mercy 4, het bos: de eerste golf anderhalve minuut met de speler op 45 m tussen de bomen; elk beeld niemand in
    een pand, een doos of het water; niemand staat langer dan 40 s ver weg en buiten zicht (`jagen`, Bewaking); de
    laatste twee als ruitjes.
 7. No Mercy 4, het bunkerdorp: de twee schildwachten gemeten, en een minuut gevecht.

 Gebruik: node tools/server.mjs 8123 &   node tools/nm5duitsertest.mjs 8123
*/
import { chromium } from 'playwright';

const poort = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);
const r1 = (x) => (x == null || !isFinite(x)) ? String(x) : (Math.round(x * 10) / 10).toString();

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 900000 });
await page.waitForFunction(() => window.__game, null, { timeout: 900000 });
await page.evaluate(async () => {
  const W = await import('/js/world.js');
  const KM = await import('/js/kaart.js');
  const KW = await import('/js/kaartwereld.js');
  const V = await import('/js/viaduct.js');
  const LP = await import('/js/looppad.js');
  for (let n = 1; n <= 15; n++) localStorage.removeItem(n === 1 ? 'tinga.spel.v1' : `tinga.spel.v1.${n}`);
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game, v = g.verhaal;
  g.player.active = false;
  window.__autoplay = false;
  g.sfeer.uur = 14;
  window.__W = W; window.__K = KM.KAART || KM.default; window.__V = V; window.__LP = LP; window.__inPand = KW.inPand;
  window.__meld = [];
  const echt = g.hud.melding.bind(g.hud);
  g.hud.melding = (k, o, t) => { window.__meld.push(`${k}|${o}`); return echt(k, o, t); };
  window.__stap = (n = 20, dt = 0.05) => { for (let i = 0; i < n; i++) v.update(dt); };
  window.__dicht = () => document.getElementById('dialoog').hidden;
  window.__klik = (max = 40) => { for (let i = 0; i < max && !document.getElementById('dialoog').hidden; i++) { v.toets(); window.__stap(1); } };
  window.__zet = (x, z) => {
    g.player.inCar = null;
    const [rx, rz] = W.resolveCollisions(x, z, 0.4);
    g.player.pos.set(rx, V.grondHoogte(rx, rz), rz); g.player.applyCamera();
  };
  window.__teken = () => g.hud.update(0.016, g.player, g.vehicles, g.npcs, 'IJlst', false);
  window.__uitBoot = () => { if (g.boten.inBoot) g.boten.herstel({ boten: g.boten.bewaar().boten, aanBoord: -1 }); };
  window.__neerMet = (w, grp) => {
    let n = 0;
    while (w.staat !== 'neer' && n < 10) { if (v.raak(w.persoon.groep.children[0], 99)) n++; else break; window.__stap(1); }
    return n;
  };
  // de stand na missie 5, voor No Mercy 4 (zoals tools/figurantentest.mjs)
  window.__naMissie5 = () => {
    window.__uitBoot();
    const s = v.bewaar(); s.missie = 'johan'; s.fase = 'terug'; s.volgende = null; s.noMercyKlaar = false; s.noMercyGebeld = false;
    v.herstel(s); v.__geenVolgende(); g.politie.reset();
    const doel = g.hud.nav && g.hud.nav.doel;
    if (doel) { window.__zet(doel[0] + 1, doel[1] + 1); window.__stap(3); window.__klik(); window.__stap(2); }
  };
  window.__vrij = () => {
    window.__uitBoot();
    const s = v.bewaar();
    s.missie = 'klaar'; s.fase = 'klaar'; s.volgende = null;
    s.brugKlaar = true; s.noMercyKlaar = true; s.noMercyGebeld = true; s.noMercy5Klaar = false; s.noMercy5Gemeld = false; s.noMercy5Staf = false;
    v.herstel(s); v.__geenVolgende(); g.politie.reset(); v.klusjes.reset();
    window.__stap(2);
  };
  // de sloep varen tot de ruit, de speler vaart mee; `elk` wordt elk beeld aangeroepen
  window.__vaar = (naar, elk = null) => {
    const B = g.boten, b = v.noMercy5.sloep, P = g.player;
    let t = 0;
    while (t < 60) {
      const dx = naar.x - b.x, dz = naar.z - b.z, d = Math.hypot(dx, dz);
      if (d < 0.5) break;
      const s = Math.min(d, 6 * 0.05);
      if (!B.verplaats(b, b.x + dx / d * s, b.z + dz / d * s, Math.atan2(-dx, -dz))) break;
      P.pos.set(b.x, 0, b.z); P.applyCamera();
      v.update(0.05); t += 0.05;
      if (elk) elk(t);
    }
    return t;
  };
  window.__totBoot = () => {
    const p = v.noMercy5.ejPlek;
    window.__zet(p.x + 2, p.z + 1); window.__stap(2);
    v.toets(); window.__stap(1);
    window.__klik(); window.__stap(90);
    window.__klik(); window.__stap(2);
    return v.noMercy5.fase;
  };
  window.__wapen = () => {
    const P = g.player;
    if (!P.wapens.includes('garand')) P.wapens.push('garand');
    P.wapenNr = P.wapens.indexOf('garand'); P.ammo = 8; P.reserve = Math.max(P.reserve, 200);
    P.wisselT = 0; P.reloading = 0; P.wapenUit = false; P.binnen = false; P.vuurSlot = false;
  };
  // in de scène en zichtbaar: de groep en al zijn ouders
  window.__inBeeld = (o) => { let p = o; while (p) { if (!p.visible) return false; if (p === g.scene) return true; p = p.parent; } return false; };
  // de stand van één man: plek, pand, doos, water, hoogte
  window.__man = (w, M) => {
    const p = w.persoon.groep.position, vast = w.persoon.vasteGrond;
    const [rx, rz] = W.resolveCollisions(p.x, p.z, 0.34, 0, vast != null ? null : p.y);
    const grond = V.grondHoogte(p.x, p.z);
    const uit = { i: w.i, x: p.x, z: p.z, y: p.y, staat: w.staat, vast: vast ?? null, water: W.pointInWater(p.x, p.z), beeld: window.__inBeeld(w.persoon.groep) };
    if (vast != null) {
      // op de stelling: op zijn hoogte, tussen de romp en de rand van de omloop
      const r = M ? Math.hypot(p.x - M.cx, p.z - M.cz) : 0;
      uit.stelling = M && Math.abs(p.y - M.stelling) < 0.05 && r > M.romp + 0.12 + 0.3 && r < M.romp + 0.12 + 1.8 - 0.3;
      uit.pand = false; uit.duw = 0; uit.dy = 0; uit.r = r;
    } else {
      uit.pand = window.__inPand(p.x, p.z); uit.duw = Math.hypot(rx - p.x, rz - p.z); uit.dy = p.y - grond;
    }
    uit.fout = uit.water || uit.pand || uit.duw > 0.05 || Math.abs(uit.dy) > 0.15 || (vast != null && !uit.stelling) || (w.staat !== 'neer' && !uit.beeld);
    return uit;
  };
});

// ------------------------------------------------------------------ 1. No Mercy 5: elke man aan wal
kop('1. No Mercy 5: de vijf Duitsers aan wal, elk gemeten');
const een = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, W = window.__W, V = window.__V, LP = window.__LP;
  window.__vrij();
  window.__totBoot(); window.__klik();
  const n0 = v.noMercy5, M = n0.molen;
  // de overtocht: tel de schoten van de sluipschutter en of hij je zag
  const sluip = n0.duitsers[1];
  let sluipVuur = 0, sluipZag = 0;
  const e = sluip.vuur.bind(sluip); sluip.vuur = (...a) => { sluipVuur++; return e(...a); };
  P.health = 100;
  const t = window.__vaar({ x: -1133, z: 884 }, () => { const w = v.noMercy5.groepA.wachters[1]; if (w.zicht) sluipZag++; });
  g.boten.stapUit(); window.__stap(2); window.__klik();
  const n = v.noMercy5;
  const a = { x: -1133, z: 884 };
  // plekken waar je kunt komen: een ring om de molen, op het land, vrij, niet in een pand, te voet vanaf de ruit
  const plekken = [];
  for (const r of [12, 18, 26, 34]) for (let k = 0; k < 20; k++) {
    const h = k / 20 * Math.PI * 2, x = M.cx + Math.cos(h) * r, z = M.cz + Math.sin(h) * r;
    if (W.pointInWater(x, z) || window.__inPand(x, z)) continue;
    const [rx, rz] = W.resolveCollisions(x, z, 0.4);
    if (Math.hypot(rx - x, rz - z) > 0.05) continue;
    const pad = LP.zoekLooppad(a, { x, z });
    if (pad) plekken.push({ x, z, r, h });
  }
  window.__plekken = plekken;
  const groepen = [['A', n.groepA], ['B', n.groepB]];
  const mannen = [];
  for (const [gi, grp] of groepen) for (const w of grp.wachters) {
    const m = window.__man(w, M);
    m.wie = gi + w.i;
    const p = w.persoon.groep.position, vast = w.persoon.vasteGrond;
    // zicht: vanaf hoeveel plekken waar je kunt komen is er een vrije kijklijn (zoals hij zelf kijkt, js/bewaking.js)
    const negeer = vast != null ? (W.dozenOp ? W.dozenOp(p.x, p.z, w.persoon.grond + 0.1) : []) : null;
    let zicht = 0;
    for (const q of plekken) {
      let vrij = W.zichtVrij(p.x, p.z, q.x, q.z, 1.5, w.persoon.grond, negeer && negeer.length ? negeer : null);
      if (vrij && vast != null) vrij = (n.rompVrij ? n.rompVrij(p, q) : true);
      if (vrij) zicht++;
    }
    m.zicht = zicht;
    m.bereik = vast != null ? null : !!LP.zoekLooppad(a, { x: p.x, z: p.z });
    m.dozen = negeer ? negeer.length : 0;
    mannen.push(m);
  }
  return { t, sluipVuur, sluipZag, health: P.health, plekken: plekken.length, mannen, fase: n.fase, M: { cx: M.cx, cz: M.cz, romp: M.romp, stelling: M.stelling } };
});
console.log(`  (molen (${r1(een.M.cx)}, ${r1(een.M.cz)}), romp ${een.M.romp}, stelling ${een.M.stelling}; ${een.plekken} plekken om de molen te voet bereikbaar)`);
ok(een.fase === 'molen', 'aan wal: de molen', een.fase);
ok(een.mannen.length === 5, 'vijf Duitsers', `${een.mannen.length}`);
for (const m of een.mannen) {
  const wie = m.wie === 'A0' ? 'het MG' : m.wie === 'A1' ? 'de sluipschutter' : `aan de voet ${m.wie}`;
  console.log(`  ${wie}: (${r1(m.x)}, ${r1(m.z)}) y ${r1(m.y)}${m.vast != null ? ` op de stelling, ${r1(m.r)} m van het hart, ${m.dozen} dozen van het pand` : ''}, zicht vanaf ${m.zicht} plekken`);
  ok(!m.water && !m.pand && m.duw < 0.05, `${wie}: niet in het water, een pand of een botsdoos`, `water ${m.water}, pand ${m.pand}, geduwd ${r1(m.duw)} m`);
  ok(m.vast != null ? m.stelling : Math.abs(m.dy) < 0.15, `${wie}: ${m.vast != null ? 'op de stelling' : 'op de grond'}`, `dy ${r1(m.dy)}`);
  ok(m.beeld, `${wie}: zichtbaar in de scène`);
  ok(m.zicht >= 3, `${wie}: vanaf plekken waar je kunt komen te zien`, `${m.zicht} van de ${een.plekken} plekken`);
  if (m.bereik !== null) ok(m.bereik, `${wie}: te voet bereikbaar vanaf de ruit`);
}
ok(een.sluipZag > 0 && een.sluipVuur > 0, 'de sluipschutter ziet je op het water en schiet (zijn flits en knal wijzen hem aan)',
  `${een.sluipVuur} schoten, ${Math.round(een.sluipZag * 0.05)} s zicht in ${r1(een.t)} s varen`);
ok(een.health === 100, 'zonder schade (losse flodders)', `${een.health}`);

// ------------------------------------------------------------------ 2. het gevecht, twee minuten
kop('2. No Mercy 5: twee minuten gevecht, elk beeld gemeten');
const twee = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, W = window.__W, V = window.__V;
  const n = v.noMercy5, M = n.molen;
  const pl = window.__plekken.filter(q => q.r <= 26).sort((p, q) => p.h - q.h);
  const wachters = [...n.groepA.wachters, ...n.groepB.wachters];
  const vuur = wachters.map(() => 0), zag = wachters.map(() => 0);
  wachters.forEach((w, j) => { const e = w.persoon.vuur.bind(w.persoon); w.persoon.vuur = (...a) => { vuur[j]++; return e(...a); }; });
  const fout = {}, verst = wachters.map(() => 0), start = wachters.map(w => ({ x: w.persoon.groep.position.x, z: w.persoon.groep.position.z }));
  let beelden = 0, t = 0, k = 0;
  P.health = 100;
  while (t < 120) {
    // naar de volgende plek lopen (4,5 m/s), daar drie tellen staan
    const q = pl[k++ % pl.length];
    let blijf = 3;
    while (t < 120) {
      const dx = q.x - P.pos.x, dz = q.z - P.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.6) {
        const s = Math.min(d, 4.5 * 0.05);
        P.yaw = Math.atan2(-dx, -dz);
        let [rx, rz] = W.resolveCollisions(P.pos.x + dx / d * s, P.pos.z + dz / d * s, 0.4);
        if (Math.hypot(rx - P.pos.x, rz - P.pos.z) < s * 0.2) { rx = q.x; rz = q.z; }      // vast: dan erheen
        P.pos.set(rx, V.grondHoogte(rx, rz), rz);
      } else if ((blijf -= 0.05) <= 0) break;
      P.applyCamera();
      v.update(0.05); t += 0.05; beelden++;
      wachters.forEach((w, j) => {
        if (w.staat === 'neer') return;
        if (w.zicht) zag[j]++;
        const m = window.__man(w, M);
        const p = w.persoon.groep.position;
        verst[j] = Math.max(verst[j], Math.hypot(p.x - start[j].x, p.z - start[j].z));
        if (m.fout && !fout[j]) fout[j] = { t: Math.round(t * 10) / 10, ...m };
      });
    }
  }
  return { beelden, t, vuur, zag, verst, fout, levend: wachters.filter(w => w.staat !== 'neer').length, health: P.health, fase: n.fase,
    over: n.groepA.wachters.concat(n.groepB.wachters).filter(w => w.staat !== 'neer').length };
});
ok(twee.beelden >= 2000, 'twee minuten spel, beeld voor beeld', `${twee.beelden} beelden, ${r1(twee.t)} s`);
ok(Object.keys(twee.fout).length === 0, 'geen enkel beeld iemand in een pand, een doos, het water, op de verkeerde hoogte of onzichtbaar', JSON.stringify(twee.fout));
ok(twee.levend === 5 && twee.fase === 'molen', 'niemand verdwijnt uit zichzelf', `${twee.levend} levend, ${twee.fase}`);
ok(twee.vuur.every(n => n > 0), 'alle vijf schieten op je', twee.vuur.join(', '));
ok(twee.zag[1] > 0, 'ook de sluipschutter op de stelling ziet je', `${Math.round(twee.zag[1] * 0.05)} s`);
ok(twee.verst.every(d => d < 3), 'en ze blijven bij hun plek (houden)', twee.verst.map(r1).join(', '));
ok(twee.health === 100, 'zonder schade', `${twee.health}`);

// ------------------------------------------------------------------ 3. nog twee: de ruitjes, en echte schoten
kop('3. nog twee over: rode ruitjes op de kaart, en echte schoten');
const drie = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, W = window.__W, V = window.__V, h = g.hud;
  const n = v.noMercy5, M = n.molen;
  window.__meld = [];
  const uit = { voor: h.vijanden ? h.vijanden.length : 0 };
  // het MG en twee aan de voet neer: de sluipschutter en de laatste aan de voet blijven over
  window.__neerMet(n.groepA.wachters[0]);
  window.__neerMet(n.groepB.wachters[0]);
  uit.bijDrie = h.vijanden ? h.vijanden.length : 0;
  window.__neerMet(n.groepB.wachters[1]);
  window.__stap(2);
  const rest = [n.groepA.wachters[1], n.groepB.wachters[2]];
  uit.twee = h.vijanden ? h.vijanden.map(p => ({ ...p })) : null;
  uit.klopt = !!uit.twee && uit.twee.length === 2 && rest.every(w => uit.twee.some(p => Math.hypot(p.x - w.persoon.groep.position.x, p.z - w.persoon.groep.position.z) < 0.1));
  uit.meld = window.__meld.filter(m => /^Nog (één|twee)/.test(m));
  // de minikaart: ver weg staan ze op de rand
  window.__zet(M.cx - 100, M.cz - 110); window.__stap(1); window.__teken();
  const mini = (h._miniPlekken || []).filter(q => q.wat === 'vijand');
  uit.mini = { n: mini.length, rand: mini.filter(q => q.rand).length };
  // echte schoten vanaf de grond, vanaf een plek met zicht, met de M1
  const schiet = (w) => {
    const p = w.persoon.groep.position, vast = w.persoon.vasteGrond;
    const negeer = vast != null ? (W.dozenOp ? W.dozenOp(p.x, p.z, w.persoon.grond + 0.1) : []) : null;
    const q = window.__plekken.filter(q => {
      let vrij = W.zichtVrij(p.x, p.z, q.x, q.z, 1.5, w.persoon.grond, negeer && negeer.length ? negeer : null);
      if (vrij && vast != null) vrij = (n.rompVrij ? n.rompVrij(p, q) : true);
      return vrij;
    }).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (!q) return { geen: true };
    let schoten = 0;
    for (let i = 0; i < 16 && w.staat !== 'neer'; i++) {
      window.__wapen();
      P.inCar = null; P.pos.set(q.x, V.grondHoogte(q.x, q.z), q.z);
      const oog = { x: q.x, y: P.pos.y + P.eye, z: q.z };
      const dx = p.x - oog.x, dy = p.y + 1.15 - oog.y, dz = p.z - oog.z;
      P.yaw = Math.atan2(-dx, -dz); P.pitch = Math.atan2(dy, Math.hypot(dx, dz));
      P.zicht.yaw = 0; P.zicht.pitch = 0; P.applyCamera();
      P.vuurKlok = 0; P.kickPitch = 0; P.kickYaw = 0; P.mik = 1;
      g.scene.updateMatrixWorld(true);
      P.shoot(); schoten++;
      window.__stap(1);
    }
    return { schoten, neer: w.staat === 'neer', afstand: Math.hypot(q.x - p.x, q.z - p.z), hoogte: p.y };
  };
  uit.sluip = schiet(rest[0]);
  uit.naEen = h.vijanden ? h.vijanden.length : 0;
  uit.voet = schiet(rest[1]);
  window.__stap(3);
  uit.na = h.vijanden ? h.vijanden.length : 0;
  uit.fase = v.noMercy5.fase;
  return uit;
});
ok(drie.voor === 0 && drie.bijDrie === 0, 'met vijf of drie over nog geen ruitjes', `${drie.voor}, ${drie.bijDrie}`);
ok(drie.klopt, 'met twee over: twee rode ruitjes, precies op de laatste twee', JSON.stringify(drie.twee));
ok(drie.meld.length === 1, 'één melding', drie.meld.join(' / '));
ok(drie.mini.n === 2 && drie.mini.rand === 2, 'op de minikaart, op de rand als ze buiten het rondje staan', JSON.stringify(drie.mini));
ok(drie.sluip.neer, 'de sluipschutter op de stelling gaat neer met echte schoten van de grond', JSON.stringify(drie.sluip));
ok(drie.naEen === 1, 'daarna nog één ruitje', `${drie.naEen}`);
ok(drie.voet.neer, 'de laatste aan de voet ook', JSON.stringify(drie.voet));
ok(drie.na === 0 && drie.fase === 'vlag', 'alles neer: geen ruitjes meer, door naar de vlag', `${drie.na}, ${drie.fase}`);

// ------------------------------------------------------------------ 4. de vrije plek
kop('4. een post in een pand wordt een vrije plek');
const vier = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, W = window.__W;
  const n = v.noMercy5, M = n.molen;
  if (!n.vrijePost) return [];
  const proef = [{ x: M.cx - 4, z: M.cz + 4 }, { x: M.cx + 8, z: M.cz - 4 }, { x: -1155.3, z: 917.1 }];
  return proef.map(p => {
    const q = n.vrijePost(p.x, p.z);
    const [rx, rz] = W.resolveCollisions(q.x, q.z, 0.4);
    return { in: window.__inPand(p.x, p.z), pand: window.__inPand(q.x, q.z), water: W.pointInWater(q.x, q.z), duw: Math.hypot(rx - q.x, rz - q.z), d: Math.hypot(q.x - p.x, q.z - p.z) };
  });
});
ok(vier.length === 3, 'n5VrijePost bestaat');
ok(vier.some(p => p.in), 'de proefplekken liggen (deels) in een pand', vier.map(p => p.in).join(', '));
ok(vier.every(p => !p.pand && !p.water && p.duw < 0.05 && p.d <= 14), 'n5VrijePost: daarbuiten, op het land, vrij, hoogstens 14 m verder', vier.map(p => r1(p.d)).join(', '));

// ------------------------------------------------------------------ 5. opnieuw beginnen
kop('5. X en opnieuw: opgeruimd, en niet dubbel');
const vijf = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player;
  const uit = {};
  // terug naar een gevecht met twee over, dan X
  window.__vrij(); window.__totBoot(); window.__klik();
  window.__vaar({ x: -1133, z: 884 }); g.boten.stapUit(); window.__stap(2); window.__klik();
  let n = v.noMercy5;
  for (const w of [n.groepA.wachters[0], ...n.groepB.wachters]) window.__neerMet(w);
  window.__stap(2);
  uit.voorX = g.hud.vijanden ? g.hud.vijanden.length : 0;
  uit.x = v.klusAfbreken(); window.__stap(30);
  n = v.noMercy5;
  uit.naX = { zichtbaar: n.duitsers.filter(d => d.groep.visible).length, groepen: !!(n.groepA || n.groepB), ruitjes: g.hud.vijanden ? g.hud.vijanden.length : 0, fase: n.fase };
  // een nieuwe poging, tot aan wal
  window.__vrij(); window.__totBoot(); window.__klik();
  window.__vaar({ x: -1133, z: 884 }); g.boten.stapUit(); window.__stap(2); window.__klik();
  n = v.noMercy5;
  const inScene = n.duitsers.filter(d => d.groep.parent === g.scene).length;
  uit.opnieuw = { zichtbaar: n.duitsers.filter(d => d.groep.visible).length, A: n.groepA.aantal, B: n.groepB.aantal,
    staan: [...n.groepA.wachters, ...n.groepB.wachters].filter(w => w.staat !== 'neer').length, inScene, fase: n.fase };
  v.klusAfbreken(); window.__stap(30);
  return uit;
});
ok(vijf.voorX === 1, 'met één over: één ruitje', `${vijf.voorX}`);
ok(vijf.x && vijf.naX.zichtbaar === 0 && !vijf.naX.groepen && vijf.naX.ruitjes === 0, 'X: geen Duitser meer zichtbaar, geen groepen, geen ruitjes', JSON.stringify(vijf.naX));
ok(vijf.opnieuw.zichtbaar === 5 && vijf.opnieuw.A === 2 && vijf.opnieuw.B === 3 && vijf.opnieuw.staan === 5 && vijf.opnieuw.inScene === 5,
  'opnieuw: precies vijf, allemaal rechtop, niet dubbel', JSON.stringify(vijf.opnieuw));

// ------------------------------------------------------------------ 6. No Mercy 4: het bos
kop('6. No Mercy 4: de eerste golf in het bos, anderhalve minuut');
const zes = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, W = window.__W, V = window.__V, h = g.hud;
  window.__naMissie5();
  v.startNoMercy(); window.__klik(); window.__stap(90);
  const f = v.noMercy.set.groep.position, r = v.noMercy.set.ruit;
  window.__zet(f.x - 3, f.z + 10.5); window.__stap(3); window.__klik();
  window.__zet(r.x + 0.8, r.z); window.__stap(2); v.toets();
  const dx = r.x - f.x, dz = r.z - f.z, d = Math.hypot(dx, dz);
  window.__zet(f.x + dx / d * 17, f.z + dz / d * 17);
  window.__stap(140);
  const nm = v.noMercy, golf = nm.golf;
  const uit = { fase: nm.fase, aantal: golf ? golf.aantal : 0, jagen: golf ? golf.jagen : 0 };
  if (!golf) return uit;
  // 45 m van de golf af, het bos in (maar binnen de grens van de set)
  const mid = golf.wachters.reduce((a, w) => ({ x: a.x + w.persoon.groep.position.x / golf.aantal, z: a.z + w.persoon.groep.position.z / golf.aantal }), { x: 0, z: 0 });
  let plek = null;
  for (let k = 0; k < 36 && !plek; k++) {
    const a = k / 36 * Math.PI * 2, x = mid.x + Math.cos(a) * 45, z = mid.z + Math.sin(a) * 45;
    if (Math.hypot(x - f.x, z - f.z) > 120 || W.pointInWater(x, z) || window.__inPand(x, z)) continue;
    const [rx, rz] = W.resolveCollisions(x, z, 0.4);
    if (Math.hypot(rx - x, rz - z) < 0.05 && nm.bos.inBos(x, z)) plek = { x, z };
  }
  uit.plek = !!plek;
  if (plek) window.__zet(plek.x, plek.z);
  const fout = {}, blind = golf.wachters.map(() => 0), langst = golf.wachters.map(() => 0);
  let beelden = 0;
  for (let t = 0; t < 90; t += 0.05) {
    v.update(0.05); beelden++;
    golf.wachters.forEach((w, j) => {
      if (w.staat === 'neer') return;
      const m = window.__man(w, null);
      if (m.fout && !fout[j]) fout[j] = { t: Math.round(t * 10) / 10, ...m };
      const p = w.persoon.groep.position, dSp = Math.hypot(p.x - P.pos.x, p.z - P.pos.z);
      if (w.zicht || dSp < golf.zicht) blind[j] = 0; else blind[j] += 0.05;
      langst[j] = Math.max(langst[j], blind[j]);
    });
  }
  uit.beelden = beelden; uit.fout = fout; uit.langst = langst; uit.gejaagd = golf.gejaagd || 0;
  uit.fase2 = v.noMercy.fase;
  uit.levend = golf.wachters.filter(w => w.staat !== 'neer').length;
  // twee over: ruitjes
  const levend = golf.wachters.filter(w => w.staat !== 'neer');
  for (const w of levend.slice(0, Math.max(0, levend.length - 2))) window.__neerMet(w);
  window.__stap(2);
  uit.ruitjes = h.vijanden ? h.vijanden.length : 0;
  for (const w of golf.wachters) window.__neerMet(w);
  window.__stap(3);
  uit.ruitjesNa = h.vijanden ? h.vijanden.length : 0;
  uit.fase3 = v.noMercy.fase;
  return uit;
});
ok(zes.fase === 'golf1' && zes.aantal === 4 && zes.jagen > 0, 'de eerste golf: vier Duitsers die je komen zoeken (`jagen`)', `${zes.fase}, ${zes.aantal}, jagen ${zes.jagen} s`);
ok(zes.plek, 'een plek 45 m verder in het bos');
if (zes.beelden) {
  ok(Object.keys(zes.fout).length === 0, 'geen enkel beeld iemand in een pand, een doos, het water of op de verkeerde hoogte', JSON.stringify(zes.fout));
  ok(zes.langst.every(s => s <= 40), 'niemand staat langer dan 40 s ver weg en buiten zicht', zes.langst.map(r1).join(', ') + ` s; ${zes.gejaagd} keer een looproute naar je toe`);
  ok(zes.ruitjes === 2 && zes.ruitjesNa === 0, 'de laatste twee als ruitjes, daarna niets', `${zes.ruitjes} → ${zes.ruitjesNa}`);
}

// ------------------------------------------------------------------ 7. No Mercy 4: het bunkerdorp
kop('7. No Mercy 4: de schildwachten in het bunkerdorp, en een minuut gevecht');
const zeven = await page.evaluate(() => {
  const g = window.__game, v = g.verhaal, P = g.player, W = window.__W;
  v.klusAfbreken(); window.__stap(30);
  window.__naMissie5();
  v.startNoMercy(); window.__klik(); window.__stap(90);
  v.noMercy.naarKamp(); window.__stap(2); window.__klik(); window.__stap(2);
  const nm = v.noMercy, golf = nm.golf;
  const uit = { fase: nm.fase, aantal: golf ? golf.aantal : 0 };
  if (!golf) return uit;
  uit.begin = golf.wachters.map(w => window.__man(w, null));
  // gezien: het gevecht (de speler 25 m van de eerste schildwacht)
  const p0 = golf.wachters[0].persoon.groep.position;
  window.__zet(p0.x - 25, p0.z + 4);
  v.schotGehoord(P.pos.x, P.pos.z);
  const fout = {};
  let beelden = 0, maxN = 0;
  for (let t = 0; t < 60; t += 0.05) {
    v.update(0.05); beelden++;
    if (!document.getElementById('dialoog').hidden) v.toets();
    const g2 = v.noMercy.golf;
    if (!g2) break;
    maxN = Math.max(maxN, g2.aantal);
    g2.wachters.forEach((w, j) => {
      if (w.staat === 'neer') return;
      const m = window.__man(w, null);
      if (m.fout && !fout[j]) fout[j] = { t: Math.round(t * 10) / 10, ...m };
    });
  }
  uit.beelden = beelden; uit.fout = fout; uit.maxN = maxN; uit.fase2 = v.noMercy.fase;
  v.klusAfbreken(); window.__stap(30);
  uit.ruitjes = g.hud.vijanden ? g.hud.vijanden.length : 0;
  return uit;
});
ok(zeven.aantal === 2, 'twee schildwachten', `${zeven.fase}, ${zeven.aantal}`);
if (zeven.begin) for (const [j, m] of zeven.begin.entries()) ok(!m.fout, `schildwacht ${j + 1}: niet in een pand, een doos of het water, op de grond, in beeld`, `(${r1(m.x)}, ${r1(m.z)}) pand ${m.pand}, geduwd ${r1(m.duw)}, dy ${r1(m.dy)}`);
if (zeven.beelden) ok(Object.keys(zeven.fout).length === 0, 'een minuut gevecht: elk beeld niemand in een pand, een doos of het water', `${zeven.beelden} beelden, tot ${zeven.maxN} man; ${JSON.stringify(zeven.fout)}`);
ok(zeven.ruitjes === 0, 'X ruimt ook de ruitjes van No Mercy 4 op');

console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
await browser.close();
process.exit(fouten ? 1 : 0);

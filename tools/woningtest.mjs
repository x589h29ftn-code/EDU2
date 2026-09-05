/*
 Toetst de tweede woning (de Wieken 29), het zitten op de bank, de plafondlamp
 die 's avonds aangaat, het uitzicht door het glas, en het speeltuintje op het
 grasveld achter de Wieken 144.

 De woning aan de Molenkrite zit in npm run verhaaltest; die maten worden hier
 niet nog eens nagelopen.

 Gebruik: python3 -m http.server 8123 &  node tools/woningtest.mjs 8123
*/
import { chromium } from 'playwright';

const port = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  window.__autoplay = true;
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  window.__zet = (p) => { g.player.pos.set(p.x, 0, p.z); g.player.applyCamera(); };
});
await page.waitForTimeout(600);

// ---------- 1. twee woningen ----------
kop('twee voordeuren');
const lijst = await page.evaluate(() => {
  const g = window.__game;
  return (g.woningen || []).map(h => ({ naam: h.naam, breed: h.maten.breed, diep: h.maten.diep, banden: h.maten.banden.length }));
});
ok(lijst.length === 2, 'er zijn twee woningen waar je naar binnen kunt', lijst.map(q => q.naam).join(' · '));
ok(lijst.some(q => q.naam === 'de Wieken 29'), 'de Wieken 29 hoort erbij');
const w29 = lijst.find(q => q.naam === 'de Wieken 29') || {};
ok(w29.breed > 5 && w29.breed < 6 && w29.diep > 13 && w29.diep < 15,
  'met de maten van het pand uit de kaart', `${(w29.breed || 0).toFixed(2)} × ${(w29.diep || 0).toFixed(2)} m`);
ok(w29.banden === 2, 'een voorhuis met een aanbouw erachter', `${w29.banden} banden`);

// ---------- 2. naar binnen en naar buiten ----------
kop('de deur van de Wieken 29');
const deur = await page.evaluate(() => {
  const g = window.__game;
  const h = g.woningen[1];
  const p = h.plekken;
  window.__zet(p.deurBuiten);
  h.update(0.1, false);
  const hint = (() => { const e = document.getElementById('praat'); return e.hidden ? '' : e.textContent; })();
  const heen = h.toets();
  const binnen = h.binnen(g.player.pos.x, g.player.pos.z);
  const kaart = h.kaart(g.player.pos.x, g.player.pos.z);
  const terug = h.toets();
  const buiten = !h.binnen(g.player.pos.x, g.player.pos.z);
  const bij = Math.hypot(g.player.pos.x - p.deurBuiten.x, g.player.pos.z - p.deurBuiten.z);
  // de twee kamers mogen elkaar niet raken
  const ver = Math.hypot(g.woningen[0].plekken.nul.x - p.nul.x, g.woningen[0].plekken.nul.z - p.nul.z);
  return { hint, heen, binnen, kaart: kaart ? kaart.naam : null, terug, buiten, bij, ver };
});
ok(deur.hint.includes('E'), 'bij de deur staat de hint in beeld', deur.hint);
ok(deur.heen && deur.binnen, 'met E sta je binnen');
ok(deur.kaart === 'de Wieken 29', 'en de HUD noemt het adres', String(deur.kaart));
ok(deur.terug && deur.buiten, 'met E bij de deur sta je weer buiten', `${deur.bij.toFixed(1)} m van de deur`);
ok(deur.ver > 60, 'de twee kamers staan ver uit elkaars buurt', `${deur.ver.toFixed(0)} m`);

// ---------- 3. op de bank ----------
kop('op de bank');
const bank = await page.evaluate(async () => {
  const W = await import('./js/world.js');
  const g = window.__game;
  const h = g.woningen[1];
  h.toets();                                    // naar binnen
  window.__zet({ x: h.plekken.bank.x + 1.1, z: h.plekken.bank.z });
  h.update(0.1, false);
  const hint = (() => { const e = document.getElementById('praat'); return e.hidden ? '' : e.textContent; })();
  const staandOog = g.player.eye;
  const gaat = h.toets();
  const zit = { zit: g.player.zit, oog: g.player.eye, x: g.player.pos.x, z: g.player.pos.z };
  h.update(0.1, false);
  const hintZit = (() => { const e = document.getElementById('praat'); return e.hidden ? '' : e.textContent; })();
  // lopen lukt niet meer: een paar stappen vooruit verandert niets
  g.player.keys.KeyW = true;
  for (let i = 0; i < 30; i++) g.player.update(1 / 30);
  g.player.keys.KeyW = false;
  const verzet = Math.hypot(g.player.pos.x - zit.x, g.player.pos.z - zit.z);
  const op = h.toets();
  const staat = { zit: g.player.zit, oog: g.player.eye };
  // en daarna loop je weer gewoon
  g.player.keys.KeyW = true;
  for (let i = 0; i < 30; i++) g.player.update(1 / 30);
  g.player.keys.KeyW = false;
  const gelopen = Math.hypot(g.player.pos.x - zit.x, g.player.pos.z - zit.z);
  return { hint, hintZit, gaat, zit, verzet, op, staat, staandOog, gelopen,
    binnen: h.binnen(g.player.pos.x, g.player.pos.z) };
});
ok(bank.hint.includes('zitten'), 'bij de bank vraagt de hint of je wilt zitten', bank.hint);
ok(bank.gaat && bank.zit.zit, 'met E ga je zitten');
ok(bank.zit.oog < bank.staandOog - 0.4, 'en zit je lager dan je staat',
  `${bank.zit.oog.toFixed(2)} m tegen ${bank.staandOog.toFixed(2)} m`);
ok(bank.verzet < 0.05, 'zittend loop je niet weg', `${bank.verzet.toFixed(2)} m verzet`);
ok(bank.hintZit.includes('opstaan'), 'de hint vertelt hoe je opstaat', bank.hintZit);
ok(bank.op && !bank.staat.zit && Math.abs(bank.staat.oog - bank.staandOog) < 0.01, 'met E sta je weer op');
ok(bank.gelopen > 0.5 && bank.binnen, 'en loop je weer gewoon rond', `${bank.gelopen.toFixed(1)} m`);

// ---------- 4. de plafondlamp ----------
kop('licht als het donker wordt');
const licht = await page.evaluate(() => {
  const g = window.__game;
  const h = g.woningen[1];
  const meet = () => {
    let muur = null, lamp = null;
    h.groep.traverse(o => {
      if (!o.material || !o.material.color) return;
      if (o.material.side === 2 && !lamp) lamp = o.material;             // de lampenkap
    });
    // een wandvlak: het grootste materiaal in de kamer
    h.groep.traverse(o => { if (!muur && o.material && o.material.color && o.material !== lamp) muur = o.material; });
    return { muur: muur ? muur.color.getHex() : 0, lamp: lamp ? lamp.color.getHex() : 0 };
  };
  g.sfeer.uur = 13; h.update(0.1, false);
  const dag = { ...meet(), nacht: h.nacht };
  g.sfeer.uur = 0; h.update(0.1, false);
  const avond = { ...meet(), nacht: h.nacht };
  g.sfeer.uur = 13; h.update(0.1, false);
  const weerDag = { ...meet(), nacht: h.nacht };
  return { dag, avond, weerDag };
});
const helder = (hex) => ((hex >> 16 & 255) + (hex >> 8 & 255) + (hex & 255)) / 3;
ok(licht.dag.nacht === false && licht.avond.nacht === true,
  'de kamer weet of het buiten donker is');
ok(helder(licht.avond.muur) < helder(licht.dag.muur) - 8,
  "'s avonds is de kamer warmer en gedempter dan overdag",
  `${Math.round(helder(licht.dag.muur))} → ${Math.round(helder(licht.avond.muur))}`);
ok(helder(licht.avond.lamp) > helder(licht.dag.lamp),
  'en de plafondlamp is dan juist het felst',
  `${Math.round(helder(licht.dag.lamp))} → ${Math.round(helder(licht.avond.lamp))}`);
ok(licht.weerDag.muur === licht.dag.muur, 'wordt het weer licht, dan gaat hij ook weer uit');

// ---------- 5. door het glas naar buiten ----------
kop('uitzicht');
const uitzicht = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  const h = g.woningen[1];
  let ruit = null;
  h.groep.traverse(o => { if (!ruit && o.material && o.material.transparent && o.material.opacity < 0.5) ruit = o.material; });
  // wat staat er buiten? de buren uit de kaart, rond de kamer
  const nul = h.plekken.nul;
  let buiten = 0, verste = 0;
  for (const kind of g.scene.children) {
    if (!kind.isGroup || kind === h.groep) continue;
    if (Math.hypot(kind.position.x - nul.x, kind.position.z - nul.z) > 1) continue;
    for (const o of kind.children) {
      if (!o.isMesh) continue;
      buiten++;
      verste = Math.max(verste, Math.hypot(o.position.x, o.position.z));
    }
  }
  return { doorzichtig: !!ruit, opacity: ruit ? ruit.opacity : 1, buiten, verste };
});
ok(uitzicht.doorzichtig, 'het glas is doorzichtig', `dekking ${uitzicht.opacity}`);
ok(uitzicht.buiten > 12, 'en er staat een buurt achter de ramen',
  `${uitzicht.buiten} dingen buiten, tot ${uitzicht.verste.toFixed(0)} m van het huis`);

// ---------- 5b. de katten ----------
kop('de katten');
const katten = await page.evaluate(() => {
  const g = window.__game;
  const uit = [];
  for (const h of g.woningen) {
    const start = h.katten.map(k => ({ x: k.x, z: k.z }));
    let opBank = 0, buiten = 0, verzet = 0;
    const m = h.maten;
    for (let i = 0; i < 3600; i++) {
      h.update(1 / 30, false);
      for (const k of h.katten) {
        if (k.opBank) opBank++;
        if (k.x < -1 || k.x > m.breed + 1 || k.z < -1 || k.z > m.diep + 1) buiten++;
      }
    }
    const na = h.katten;
    for (let i = 0; i < na.length; i++) verzet = Math.max(verzet, Math.hypot(na[i].x - start[i].x, na[i].z - start[i].z));
    uit.push({ naam: h.naam, aantal: na.length, opBank, buiten, verzet });
  }
  return uit;
});
const kat15 = katten.find(q => q.naam === 'Molenkrite 15') || {};
const kat29 = katten.find(q => q.naam === 'de Wieken 29') || {};
ok(kat15.aantal === 1, 'aan de Molenkrite loopt één kat', `${kat15.aantal}`);
ok(kat29.aantal === 2, 'aan de Wieken lopen er twee', `${kat29.aantal}`);
ok(kat15.verzet > 0.5 && kat29.verzet > 0.5, 'ze lopen rond',
  `${(kat29.verzet || 0).toFixed(1)} m verplaatst in twee minuten`);
ok(kat15.buiten === 0 && kat29.buiten === 0, 'en blijven binnen',
  `${(kat15.buiten || 0) + (kat29.buiten || 0)} keer buiten de kamer`);
ok(kat15.opBank + kat29.opBank > 0, 'af en toe zit er eentje op de bank',
  `${kat15.opBank + kat29.opBank} beelden op de bank`);

const vacht = await page.evaluate(async () => {
  const THREE = await import('three');
  const g = window.__game;
  const h = g.woningen[1];
  // de kleuren van de katten: wit en zwart
  const kleuren = new Set();
  let meshes = 0;
  h.groep.traverse(o => {
    if (!o.isMesh || !o.material || !o.material.color) return;
    // de katten hangen aan een eigen groep binnen de kamer
    let p = o.parent, kat = false;
    while (p) { if (p.userData && p.userData.kat) kat = true; p = p.parent; }
    if (!kat) return;
    meshes++;
    kleuren.add(o.material.color.getHex());
  });
  return { meshes, kleuren: [...kleuren] };
});
ok(vacht.meshes > 20, 'ze zijn uit losse stukjes opgebouwd', `${vacht.meshes} meshes`);

// ---------- 6. het speeltuintje achter de Wieken 144 ----------
kop('het speeltuintje');
const speel = await page.evaluate(async () => {
  const { KAART } = await import('./js/kaart.js');
  const huis = KAART.panden.find(p => p.straat === 'de Wieken' && (p.nr || []).includes('144'));
  const wil = ['schommel', 'speelhuisje', 'wipwap', 'glijbaan'];
  const staan = KAART.objecten.filter(o => wil.includes(o.type));
  const bij = staan.map(o => Math.hypot(o.x - huis.rect.cx, o.z - huis.rect.cz));
  // ligt het op gras?
  const inRing = (pt, ring) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if (((a[1] > pt[1]) !== (b[1] > pt[1])) && (pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0])) c = !c;
    }
    return c;
  };
  const opGras = staan.filter(o => KAART.vlakken.some(v => v.k === 'gras' && v.r && v.r[0] && inRing([o.x, o.z], v.r[0]))).length;
  /*
   Het moet op het veld staan en niet in de achtertuinen. Dat toetsen we aan de
   afstand tot het dichtstbijzijnde pand én tot de rand van het dichtstbijzijnde
   erf — de tuinen liggen in de kaart als vlakken van de klasse `erf`.
  */
  const randAfstand = (x, z, klassen) => {
    let best = 1e9;
    for (const v of KAART.vlakken) {
      if (!klassen.includes(v.k) || !v.r || !v.r[0]) continue;
      for (const ring of v.r) for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
        best = Math.min(best, Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t)));
      }
    }
    return best;
  };
  const totPand = staan.map(o => Math.min(...KAART.panden.map(p => Math.hypot(p.rect.cx - o.x, p.rect.cz - o.z))));
  const totTuin = staan.map(o => randAfstand(o.x, o.z, ['erf']));
  return {
    soorten: [...new Set(staan.map(o => o.type))],
    aantal: staan.length, opGras,
    dichtst: bij.length ? Math.min(...bij) : 0, verst: bij.length ? Math.max(...bij) : 0,
    dichtstePand: Math.min(...totPand), dichtsteTuin: Math.min(...totTuin),
  };
});
ok(speel.soorten.length === 4, 'er staan een schommel, een speelhuisje, een wipwap en een glijbaan',
  speel.soorten.join(', '));
ok(speel.opGras === speel.aantal, 'allemaal op het grasveld', `${speel.opGras} van ${speel.aantal}`);
ok(speel.verst < 60 && speel.dichtst > 25, 'achter de Wieken 144',
  `${speel.dichtst.toFixed(0)} tot ${speel.verst.toFixed(0)} m van het huis`);
ok(speel.dichtstePand > 15, 'op het veld, ruim bij de huizen vandaan',
  `${speel.dichtstePand.toFixed(0)} m tot het dichtstbijzijnde pand`);
ok(speel.dichtsteTuin > 12, 'en niet in iemands achtertuin',
  `${speel.dichtsteTuin.toFixed(0)} m tot de dichtstbijzijnde tuin`);

console.log(fouten ? `\n${fouten} fout(en).` : '\nAlles goed.');
await browser.close();
process.exit(fouten ? 1 : 0);

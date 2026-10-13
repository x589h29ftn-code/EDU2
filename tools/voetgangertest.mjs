/*
 Stap 154: de voetgangers (npm run voetgangertest). Gevraagd: "Personen optie 1, 3, 4" en "voeg div variatie huidskleur
 gender toe en lengte haar/baard".

   1. variatie: mannen en vrouwen, kinderen en ouderen, alle kapsels en baarden, rokken, minstens zeven huidskleuren;
   2. wat iemand niet heeft staat op schaal nul (een vrouw met lang haar heeft geen kort haar en geen baard), en wat
      zichtbaar is blijft onder 4000 driehoeken per persoon;
   3. regen: wie een jas heeft trekt hem aan (en droog weer uit), paraplu's in de hand en boven het hoofd;
   4. een bankje: erheen, zitten met de heup op de zitting en de voeten op de grond, opstaan en terug op het wegvak zonder sprong;
   5. de Poiesz: door de gang naar de schuifdeuren, die gaan open, binnen uit beeld, weer naar buiten en terug;
   6. de fiets: naar het rek, gehurkt op slot, de fiets blijft in het rek, de winkel in en uit, van het slot en weg;
   7. bellen: de telefoon in de hand bij het hoofd;
   8. schrik op het bankje: hij breekt af en rent naar zijn wegvak;
   9. grof op afstand: precies wie tussen 200 en 350 m vóór je loopt, niemand dichterbij of verder;
  10. geen nieuw shaderprogramma als dat allemaal in beeld komt.

 Gebruik: npm run server &  node tools/voetgangertest.mjs [poort]
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
  const g = window.__game, npcs = g.npcs, THREE = await import('three');
  const { GEDRAG } = await import('./js/gedrag.js');
  const { MAAT } = await import('./js/lichaam.js');
  const { werkSchuifdeurenBij, SCHUIFDEUREN } = await import('./js/zuilengang.js');
  document.getElementById('overlay').style.display = 'none';
  g.player.active = false; window.__autoplay = false;
  const gd = npcs.gedrag, uit = {};
  // niemand gaat vanzelf iets doen: de proef kiest zelf
  Object.assign(GEDRAG, { bankKans: 0, winkelKans: 0, fietsKans: 0, belKans: 0, bankTijd: [3, 3], binnenTijd: [3, 3] });
  npcs.drukte = 1;

  // ---- 1. variatie
  const P = npcs.people;
  const tel = (f) => P.filter(f).length;
  uit.variatie = {
    n: P.length, vrouw: tel(p => p.vrouw), kind: tel(p => p.kind), oud: tel(p => p.oud), rok: tel(p => p.rok),
    kapsels: [...new Set(P.map(p => p.kapsel))].sort(), baarden: [...new Set(P.map(p => p.baard))].sort(),
    huid: new Set(npcs.kleurVan.map(k => k.huid)).size, paraplu: tel(p => p.paraplu), jas: tel(p => p.jasBijRegen),
  };

  // hulp: een persoon op een wegvak vlak bij een punt zetten
  const opWegvakBij = (p, x, z) => {
    let best = null, bd = Infinity;
    for (const s of npcs.segs) {
      const ex = s.b[0] - s.a[0], ez = s.b[1] - s.a[1], L2 = ex * ex + ez * ez || 1;
      const t = Math.max(0.05, Math.min(0.95, ((x - s.a[0]) * ex + (z - s.a[1]) * ez) / L2));
      const d = Math.hypot(s.a[0] + ex * t - x, s.a[1] + ez * t - z);
      if (d < bd) { bd = d; best = { s, t }; }
    }
    p.seg = best.s; p.t = best.t; p.pause = 999; p.steek = 0; p.steekWacht = 999; p.paniek = 0; p.alive = true; p.slaapt = false;
    p.slaap = 0; p.doe = null; p.belt = 0; p.vNu = 0;
    return bd;
  };
  let klok = 0;
  const stap = (cx, cz, dt = 0.1) => {
    klok += dt;
    npcs.kijk = null;
    npcs.update(dt, klok, cx, cz);
    werkSchuifdeurenBij(dt, gd.bijDeur(P));
  };
  const matVan = (naam, slot) => { const m = new THREE.Matrix4(); npcs.meshes[naam].getMatrixAt(slot, m); return m; };
  const schaal = (naam, slot) => { const s = new THREE.Vector3(); matVan(naam, slot).decompose(new THREE.Vector3(), new THREE.Quaternion(), s); return s.length(); };
  const plek = (naam, slot) => new THREE.Vector3().setFromMatrixPosition(matVan(naam, slot));

  // ---- 2. varianten op schaal nul, driehoeken
  stap(P[0].x, P[0].z);
  const tris = (naam) => { const geo = npcs.meshes[naam].geometry; return (geo.index ? geo.index.count : geo.attributes.position.count) / 3; };
  const paar = (naam) => npcs.meshes[naam].userData.paar;
  let maxTris = 0, varFout = [];
  for (let i = 0; i < P.length; i++) {
    const j = npcs.slotVan[i];
    if (j < 0) continue;
    const p = P[i];
    let t = 0;
    for (const naam of Object.keys(npcs.meshes)) {
      const nr = paar(naam) ? j * 2 : j;
      if (schaal(naam, nr) > 1e-6) t += tris(naam) * (paar(naam) ? 2 : 1);
    }
    maxTris = Math.max(maxTris, t);
    const haarNaam = { kort: 'haar', halflang: 'haarHalflang', lang: 'haarLang', staart: 'haarStaart' }[p.kapsel];
    for (const naam of ['haar', 'haarHalflang', 'haarLang', 'haarStaart']) if ((schaal(naam, j) > 1e-6) !== (naam === haarNaam)) varFout.push(`${i}:${naam}`);
    if ((schaal('baard', j) > 1e-6) !== (p.baard === 'stoppels' || p.baard === 'kort')) varFout.push(`${i}:baard`);
    if ((schaal('baardVol', j) > 1e-6) !== (p.baard === 'vol')) varFout.push(`${i}:baardVol`);
    if ((schaal('rok', j) > 1e-6) !== !!p.rok) varFout.push(`${i}:rok`);
  }
  uit.getekend = npcs.nZicht; uit.maxTris = maxTris; uit.varFout = varFout.slice(0, 6); uit.varFoutN = varFout.length;

  // ---- 4. een bankje
  const bank = gd.plekken[0];
  const zitter = P.find(p => !p.fietst && !p.hond && !p.jogt && !p.kind && !p.paraplu);
  const iz = P.indexOf(zitter);
  uit.bankAfstand = opWegvakBij(zitter, bank.x, bank.z);
  stap(bank.x, bank.z, 0.016);
  const wegvakPlek = { x: zitter.x, z: zitter.z };
  zitter.pause = 0;
  uit.bankBegin = gd.begin(zitter, 'bank', { plek: bank });
  let voetY = null, zat = false, heupY = null, zitAfstand = null, sprong = 0, vorig = { x: zitter.x, z: zitter.z }, klaarNa = null;
  for (let n = 0; n < 900 && zitter.doe !== null || n === 0; n++) {
    stap(bank.x, bank.z);
    sprong = Math.max(sprong, Math.hypot(zitter.x - vorig.x, zitter.z - vorig.z)); vorig = { x: zitter.x, z: zitter.z };
    if (zitter.doe && zitter.doe.fase === 'zit' && zitter.houding === 'zit' && !zat) {
      stap(bank.x, bank.z, 0.016);
      const j = npcs.slotVan[iz];
      zat = true; zitAfstand = Math.hypot(zitter.x - bank.x, zitter.z - bank.z);
      // de heup: het bekken staat op MAAT.bekken, het heupgewricht op MAAT.heup; zitHouding zet de heup op de zitting
      heupY = j >= 0 ? plek('bekken', j).y - (MAAT.bekken - MAAT.heup) * zitter.height : null;
      // de enkels (de oorsprong van de schoen) op enkelhoogte boven de grond, niet in de lucht
      voetY = j >= 0 ? Math.max(plek('schoen', j * 2).y, plek('schoen', j * 2 + 1).y) : null;
    }
    if (zitter.doe === null) { klaarNa = n; break; }
  }
  // na de overdracht nog een paar beelden lopen: geen sprong
  zitter.pause = 0; let naSprong = 0; vorig = { x: zitter.x, z: zitter.z };
  for (let n = 0; n < 5; n++) { stap(bank.x, bank.z, 0.05); naSprong = Math.max(naSprong, Math.hypot(zitter.x - vorig.x, zitter.z - vorig.z)); vorig = { x: zitter.x, z: zitter.z }; }
  uit.bank = { zat, voetY, hoogte: zitter.height, heupY, zitting: GEDRAG.zitting, zitAfstand, klaarNa, sprong, naSprong, terugAfstand: Math.hypot(wegvakPlek.x - vorig.x, wegvakPlek.z - vorig.z), vrij: !bank.bezet };

  // ---- 8. schrik op het bankje
  opWegvakBij(zitter, bank.x, bank.z); stap(bank.x, bank.z, 0.016); zitter.pause = 0;
  gd.begin(zitter, 'bank', { plek: bank });
  for (let n = 0; n < 400 && !(zitter.doe && zitter.doe.fase === 'zit'); n++) stap(bank.x, bank.z);
  const zatVoorSchrik = !!(zitter.doe && zitter.doe.fase === 'zit');
  zitter.paniek = 6; zitter.schrik = 0;
  stap(bank.x, bank.z);
  uit.schrik = { zatVoorSchrik, fase: zitter.doe && zitter.doe.fase, ren: zitter.doe && zitter.doe.ren, houding: zitter.houding, bankVrij: !bank.bezet };
  for (let n = 0; n < 300 && zitter.doe; n++) stap(bank.x, bank.z);
  zitter.paniek = 0;

  // ---- 5. de Poiesz
  const w = gd.winkel;
  uit.winkel = { er: !!w };
  if (w) {
    const klant = P.find(p => !p.fietst && !p.hond && !p.jogt && p !== zitter);
    const ik = P.indexOf(klant);
    opWegvakBij(klant, w.stoep.x, w.stoep.z); stap(w.stoep.x, w.stoep.z, 0.016); klant.pause = 0;
    uit.winkel.begin = gd.begin(klant, 'winkel', { toch: true });
    let deurOpen = 0, binnen = false, verborgenGoed = true, buiten = false, klaar = false, fasen = new Set();
    for (let n = 0; n < 1500; n++) {
      stap(w.stoep.x, w.stoep.z);
      if (!klant.doe) { klaar = true; break; }
      fasen.add(klant.doe.fase);
      if (klant.doe.fase === 'deur' || klant.doe.fase === 'binnen') deurOpen = Math.max(deurOpen, SCHUIFDEUREN.length ? Math.max(...SCHUIFDEUREN.map(d => d.open)) : 0);
      // (het beeld waarin hij binnenkomt is de verdeling al gemaakt; vanaf het beeld erna is hij weg)
      if (klant.doe.fase === 'binnen') { if (binnen && (!klant.verborgen || npcs.slotVan[ik] !== -1)) verborgenGoed = false; binnen = true; }
      if (klant.doe.fase === 'uit') buiten = true;
    }
    uit.winkel = { ...uit.winkel, fasen: [...fasen], deurOpen, binnen, verborgenGoed, buiten, klaar, inWinkel: gd.inWinkel, zichtbaar: !klant.verborgen };
    // deuren weer dicht als niemand er meer is
    for (let n = 0; n < 30; n++) werkSchuifdeurenBij(0.1, []);
    uit.winkel.dicht = SCHUIFDEUREN.every(d => d.open === 0);

    // ---- 6. de fiets
    const fietser = P.find(p => p.fietst && p !== klant);
    const ifi = P.indexOf(fietser);
    uit.fiets = { er: !!fietser, rek: !!gd.rek };
    if (fietser && gd.rek) {
      opWegvakBij(fietser, gd.rek.x, gd.rek.z); stap(w.stoep.x, w.stoep.z, 0.016); fietser.pause = 0;
      uit.fiets.begin = gd.begin(fietser, 'fiets', { toch: true });
      uit.fiets.start = Math.hypot(fietser.x - gd.rek.x, fietser.z - gd.rek.z).toFixed(1);
      const fasenF = [];
      let gehurkt = false, inRek = 0, rekAfstand = null, fietsWeg = null, binnenF = false, slot2 = false;
      for (let n = 0; n < 2000; n++) {
        stap(w.stoep.x, w.stoep.z);
        if (!fietser.doe) break;
        const f = fietser.doe.fase;
        if (fasenF[fasenF.length - 1] !== f) fasenF.push(f);
        if (f === 'slot' && fietser.houding === 'hurk') {
          gehurkt = true;
          if (!fietser.doe.terugNaarHuis) {
            inRek = gd.fietsen ? gd.fietsen.count : 0;
            const m = new THREE.Matrix4(); gd.fietsen.getMatrixAt(0, m);
            const v = new THREE.Vector3().setFromMatrixPosition(m);
            rekAfstand = Math.hypot(v.x - gd.rek.x, v.z - gd.rek.z);
          } else slot2 = true;
        }
        if (f === 'binnen') binnenF = true;
      }
      for (let n = 0; n < 3; n++) stap(w.stoep.x, w.stoep.z);
      fietsWeg = gd.fietsen ? gd.fietsen.count : -1;
      uit.fiets = { ...uit.fiets, fasenF, start: uit.fiets.start, gehurkt, inRek, rekAfstand, binnen: binnenF, slot2, fietsWeg, fietstWeer: fietser.fietst, klaar: !fietser.doe,
        fietsOnder: npcs.slotVan[ifi] >= 0 ? (() => { const m = new THREE.Matrix4(); npcs.fiets.getMatrixAt(npcs.slotVan[ifi], m); return new THREE.Vector3().setFromMatrixScale(m).x > 0.1; })() : null };
    }
  }

  // ---- 7. bellen
  const beller = P.find(p => !p.fietst && !p.kind && p.alive && p !== zitter);
  const ib = P.indexOf(beller);
  opWegvakBij(beller, P[0].x + 1, P[0].z + 1); beller.pause = 999;
  gd.begin(beller, 'bellen', { tijd: 5 });
  stap(beller.x, beller.z, 0.016); stap(beller.x, beller.z, 0.016);
  {
    const j = npcs.slotVan[ib];
    const kop = j >= 0 ? plek('hoofd', j) : null;
    const m = new THREE.Matrix4(); npcs.telefoon.getMatrixAt(0, m);
    const tel = new THREE.Vector3().setFromMatrixPosition(m);
    uit.bellen = { telefoons: npcs.telefoon.count, afstandKop: kop ? tel.distanceTo(kop) / beller.height : null, boven: kop ? (tel.y - beller.handR.y) : null };
  }
  for (let n = 0; n < 60; n++) stap(beller.x, beller.z);
  uit.bellen.na = npcs.telefoon.count;

  // ---- 3. regen
  npcs.zetRegen(true);
  const metJas = P.findIndex(p => p.jasBijRegen);
  const jasGoed = npcs.kleurVan[metJas].shirt === npcs.kleurVan[metJas].jas;
  const paraplu = P.find(p => p.paraplu && !p.doe);
  const ip = P.indexOf(paraplu);
  opWegvakBij(paraplu, P[0].x + 3, P[0].z); paraplu.pause = 0;
  stap(paraplu.x, paraplu.z, 0.016); stap(paraplu.x, paraplu.z, 0.016);
  let parapluBoven = null;
  if (npcs.paraplu.count > 0 && npcs.slotVan[ip] >= 0) {
    // het scherm (1,04 m boven de hand) boven het hoofd
    const kop = plek('hoofd', npcs.slotVan[ip]);
    let best = Infinity;
    for (let k = 0; k < npcs.paraplu.count; k++) {
      const m = new THREE.Matrix4(); npcs.paraplu.getMatrixAt(k, m);
      const v = new THREE.Vector3(0, 1.04, 0).applyMatrix4(m);
      const d = Math.hypot(v.x - kop.x, v.z - kop.z);
      if (d < best) { best = d; parapluBoven = { opzij: d, boven: v.y - kop.y }; }
    }
  }
  const nParaplu = npcs.paraplu.count;
  // nieuw programma? render met alles in beeld
  // nieuw programma? eerst zonder de extra's renderen (wat hier verder in beeld staat telt niet), dan met
  const extras = [npcs.telefoon, npcs.paraplu, ...Object.values(npcs.grof), gd.fietsen].filter(Boolean);
  const metEnZonder = () => {
    extras.forEach(x => { x.visible = false; }); g.renderer.render(g.scene, g.camera);
    const voor = g.renderer.info.programs.length;
    extras.forEach(x => { x.visible = true; }); g.renderer.render(g.scene, g.camera);
    return [voor, g.renderer.info.programs.length];
  };
  g.camera.position.set(paraplu.x + 3, 1.7, paraplu.z + 3); g.camera.lookAt(paraplu.x, 1.2, paraplu.z);
  const prog1 = metEnZonder();
  npcs.zetRegen(false);
  uit.regen = { jasGoed, terug: npcs.kleurVan[metJas].shirt === npcs.kleurVan[metJas].droog.shirt, nParaplu, parapluBoven };
  stap(paraplu.x, paraplu.z, 0.016);
  uit.regen.naDroog = npcs.paraplu.count;

  // ---- 9. grof op afstand
  const doel = P.find(p => p.alive && !p.slaapt && !p.doe && p !== zitter);
  const cx = doel.x + 260, cz = doel.z;
  npcs.kijk = { x: -1, z: 0 };
  klok += 0.016; npcs.update(0.016, klok, cx, cz);
  const KEGEL = Math.cos(75 * Math.PI / 180);
  let verwacht = 0, fout9 = [];
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    if (p.slaapt || p.verborgen || !p.alive) continue;
    const dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz);
    const voor = (dx * -1) >= KEGEL * d;
    if (d > npcs.ZICHT && d <= npcs.ZICHT_GROF && voor) verwacht++;
    if (npcs.slotVan[i] >= 0 && d > npcs.ZICHT + 1) fout9.push(`lijf op ${d.toFixed(0)} m`);
  }
  uit.grof = { verwacht, n: npcs.nGrof, doelAfstand: Math.hypot(doel.x - cx, doel.z - cz), fout: fout9.slice(0, 3) };
  // de plekken van de figuurtjes: allemaal tussen 200 en 350 m
  let buitenBand = 0;
  for (let k = 0; k < npcs.nGrof; k++) {
    const m = new THREE.Matrix4(); npcs.grof.romp.getMatrixAt(k, m);
    const v = new THREE.Vector3().setFromMatrixPosition(m), d = Math.hypot(v.x - cx, v.z - cz);
    if (d <= 199 || d > 351) buitenBand++;
  }
  uit.grof.buitenBand = buitenBand;
  g.camera.position.set(cx, 1.7, cz); g.camera.lookAt(cx - 10, 1.7, cz);
  const prog2 = metEnZonder();
  npcs.kijk = null;
  uit.programmas = [prog1[0], prog1[1], prog2[0], prog2[1], npcs.telefoon.count, npcs.paraplu.count, npcs.nGrof];
  return uit;
});

kop('1. variatie');
const v = r.variatie;
console.log('      ', JSON.stringify(v));
ok(v.vrouw > v.n * 0.35 && v.vrouw < v.n * 0.65, 'mannen en vrouwen', `${v.vrouw} van ${v.n} vrouw`);
ok(v.kind >= 3 && v.oud >= 5, 'kinderen en ouderen', `${v.kind} kinderen, ${v.oud} ouderen`);
ok(['halflang', 'kaal', 'kort', 'lang', 'staart'].every(k => v.kapsels.includes(k)), 'alle kapsels', v.kapsels.join(', '));
ok(['geen', 'kort', 'stoppels', 'vol'].every(k => v.baarden.includes(k)), 'alle baarden', v.baarden.join(', '));
ok(v.rok >= 5, 'rokken', `${v.rok}`);
ok(v.huid >= 7, 'huidskleuren', `${v.huid} verschillende`);
kop('2. varianten en driehoeken');
ok(r.varFoutN === 0, 'wat iemand niet heeft staat op schaal nul', r.varFoutN ? r.varFout.join(' ') : `${r.getekend} getekend`);
ok(r.maxTris > 0 && r.maxTris <= 4000, 'zichtbaar ≤ 4000 driehoeken per persoon', `${r.maxTris}`);
kop('3. regen');
ok(r.regen.jasGoed && r.regen.terug, 'een jas aan bij regen en weer uit');
ok(r.regen.nParaplu > 0 && r.regen.naDroog === 0, 'paraplu bij regen, weg bij droog', `${r.regen.nParaplu} → ${r.regen.naDroog}`);
ok(r.regen.parapluBoven && r.regen.parapluBoven.opzij < 0.5 && r.regen.parapluBoven.boven > 0.15, 'het scherm boven het hoofd',
  r.regen.parapluBoven ? `${r.regen.parapluBoven.opzij.toFixed(2)} m opzij, ${r.regen.parapluBoven.boven.toFixed(2)} m boven` : 'geen');
kop('4. een bankje');
const b = r.bank;
ok(r.bankBegin && r.bankAfstand < 20, 'een bankje bij een wegvak', `${r.bankAfstand.toFixed(1)} m`);
ok(b.zat && b.zitAfstand < 0.4, 'hij zit op de plek', b.zitAfstand != null ? `${b.zitAfstand.toFixed(2)} m` : 'niet');
ok(b.heupY != null && Math.abs(b.heupY - b.zitting) < 0.06, 'de heup op de zitting', b.heupY != null ? `${b.heupY.toFixed(2)} tegen ${b.zitting.toFixed(2)}` : '');
ok(b.voetY != null && b.voetY < 0.07 * b.hoogte + 0.04, 'de voeten op de grond', b.voetY != null ? `enkel op ${b.voetY.toFixed(3)} m` : '');
ok(b.klaarNa != null && b.vrij, 'opgestaan en terug, het bankje vrij', `${b.klaarNa} beelden`);
ok(b.sprong < 0.6 && b.naSprong < 0.4, 'nergens een sprong, ook niet bij de overdracht', `${b.sprong.toFixed(2)} / ${b.naSprong.toFixed(2)} m per beeld`);
kop('5. de Poiesz');
const w = r.winkel;
ok(w.er && w.begin, 'de ingang onder de zuilengang');
ok(w.deurOpen > 0.9, 'de schuifdeuren gaan voor hem open', `${(w.deurOpen || 0).toFixed(2)}`);
ok(w.binnen && w.verborgenGoed, 'binnen uit beeld', (w.fasen || []).join(' → '));
ok(w.buiten && w.klaar && w.zichtbaar && w.inWinkel === 0, 'weer naar buiten en terug op zijn wegvak');
ok(w.dicht, 'de deuren weer dicht');
kop('6. de fiets');
const f = r.fiets || {};
ok(f.er && f.rek && f.begin, 'een fietser en het rek');
ok(f.gehurkt && f.inRek === 1 && f.rekAfstand < 2, 'gehurkt op slot, de fiets in het rek', `${(f.fasenF || []).join(' → ')} vanaf ${f.start} m; ${f.inRek}, ${f.rekAfstand != null ? f.rekAfstand.toFixed(2) : '-'} m`);
ok(f.binnen && f.slot2, 'de winkel in, terug naar de fiets, van het slot');
ok(f.klaar && f.fietstWeer && f.fietsWeg === 0 && f.fietsOnder !== false, 'en weer weg op de fiets, het rek leeg');
kop('7. bellen');
ok(r.bellen.telefoons >= 1, 'een telefoon in beeld', `${r.bellen.telefoons}`);
ok(r.bellen.afstandKop != null && r.bellen.afstandKop < 0.2, 'bij het hoofd', r.bellen.afstandKop != null ? `${r.bellen.afstandKop.toFixed(2)} lichaamslengte` : '');
ok(r.bellen.na === 0, 'na het gesprek weg');
kop('8. schrik');
ok(r.schrik.zatVoorSchrik && r.schrik.fase === 'terug' && r.schrik.ren && !r.schrik.houding && r.schrik.bankVrij, 'van het bankje en rennen', JSON.stringify(r.schrik));
kop('9. grof op afstand');
ok(r.grof.verwacht > 0 && r.grof.n === r.grof.verwacht, 'precies wie tussen 200 en 350 m vóór je loopt', `${r.grof.n} van ${r.grof.verwacht}`);
ok(r.grof.buitenBand === 0 && !r.grof.fout.length, 'niemand dichterbij of verder, geen lijf voorbij 200 m', r.grof.fout.join(' '));
kop('10. shaders');
const pr = r.programmas;
ok(pr[1] === pr[0] && pr[3] === pr[2], 'geen nieuw programma door telefoon, paraplu, grof en het rek', `${pr[0]} → ${pr[1]}, ${pr[2]} → ${pr[3]}`);

await browser.close();
console.log(fout ? `\n${fout} fout(en)` : '\nalles goed');
process.exit(fout ? 1 : 0);

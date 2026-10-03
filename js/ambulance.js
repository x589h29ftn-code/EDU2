/*
 De ambulance (stap 112). Gevraagd op 3 okt 2026, met twee foto's van een Nederlandse ambulance:
 "ambulance ook bouwen, kan mensen reviven. Incl sirenes en lampen in de nacht. Laat random af en
 toe komen bij doden, dus niet oneindig veel en altijd."

 - Het model is het busje uit js/carmodel.js ('van') in ambulancegeel, met daaroverheen een doek
   langs de flanken: rood-blauwe blokken onderaan (de "battenburg" van de foto's), AMBULANCE en
   de blauwe ster van het leven; op de achterdeuren schuine rood-gele strepen. Op het dak een
   lichtbalk met vier blauwe zwaailichten, met de gloed en de plas licht van de politie
   (js/politie.js `maakGloed`): geen lichtbronnen erbij.
 - Gaat er iemand neer (js/main.js `melding`), dan komt hij met kans AMB.kans, alleen als er geen
   andere onderweg is en de vorige minstens AMB.rust seconden klaar is. Wie hij komt halen blijft
   zolang liggen (bij een voetganger gaat de teller van het opstaan op wacht).
 - Hij begint op AMB.van–AMB.tot meter van de plek, op een weg die je niet ziet, en rijdt over de
   weg (`lijnDoor` en `rijdVlucht`, zoals Bouwman) met zwaailicht en sirene naar de dichtstbijzijnde
   weg bij het slachtoffer. Twee verpleegkundigen stappen uit, lopen ernaartoe, knielen AMB.helpT
   seconden en de patiënt staat weer op. Dan terug in de wagen en rustig weg, zonder sirene; uit
   beeld en ver genoeg weg verdwijnt hij.
 - Schiet je hem stuk, dan is het voorbij: de bemanning rent weg.
*/
import * as THREE from 'three';
import { Persoon } from './persoon.js';
import { grondHoogte } from './world.js';
import { maakGloed, zetZwaailamp } from './politie.js';
import { lijnDoor } from './schaduw.js';
import { profiel, rijdVlucht } from './inval.js';
import { geluid } from './audio.js';

export const AMB = {
  kans: 0.4,            // zoveel kans dat er een komt als er iemand neergaat
  rust: 120,            // s na de vorige rit voordat er weer een kan komen
  van: 300, tot: 480,   // m: waar hij begint, van het slachtoffer
  nietBij: 180,         // m: en niet dichter bij de speler dan dit
  top: 16,              // m/s met spoed
  terugTop: 11,         // m/s op de terugweg
  lopen: 3.6,           // m/s: de bemanning
  helpT: 8,             // s geknield bij de patiënt
  weg: 220,             // m: verder weg (en uit beeld) verdwijnt hij
  geel: 0xe6dd18,
};

// ---- de doeken ----
function sterVanHetLeven(g, x, y, r, kleur) {
  g.save(); g.translate(x, y); g.fillStyle = kleur;
  for (let i = 0; i < 3; i++) { g.save(); g.rotate(i * Math.PI / 3); g.fillRect(-r * 0.22, -r, r * 0.44, r * 2); g.restore(); }
  g.fillStyle = '#ffffff'; g.fillRect(-r * 0.05, -r * 0.7, r * 0.1, r * 1.4);
  g.restore();
}
function flankDoek(spiegel) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 256;
  const g = c.getContext('2d');
  if (spiegel) { g.translate(1024, 0); g.scale(-1, 1); }
  g.fillStyle = '#e6dd18'; g.fillRect(0, 0, 1024, 256);
  // onderaan twee rijen schuine blokken, rood en blauw om en om, met geel ertussen
  const blok = 64;
  for (let rij = 0; rij < 2; rij++) {
    for (let i = -2; i < 20; i++) {
      const x = i * blok + (rij ? blok / 2 : 0), y = 150 + rij * 48;
      g.fillStyle = (i + rij) % 2 ? '#1d4fb4' : '#d4202a';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + blok * 0.8, y); g.lineTo(x + blok * 0.8 + 22, y + 48); g.lineTo(x + 22, y + 48); g.closePath(); g.fill();
    }
  }
  // een dunne retroreflecterende rand erboven
  g.fillStyle = '#c9c214'; g.fillRect(0, 140, 1024, 8);
  if (spiegel) { g.setTransform(1, 0, 0, 1, 0, 0); }
  // de letters staan altijd goed leesbaar, ook op de linkerflank
  g.fillStyle = '#1d4fb4';
  g.font = 'bold 74px Arial, Helvetica, sans-serif';
  g.textBaseline = 'middle';
  g.fillText('AMBULANCE', spiegel ? 330 : 300, 82);
  sterVanHetLeven(g, spiegel ? 160 : 860, 74, 46, '#1d4fb4');
  g.font = 'bold 34px Arial, Helvetica, sans-serif';
  g.fillText('112', spiegel ? 800 : 160, 84);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
function achterDoek() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e6dd18'; g.fillRect(0, 0, 256, 256);
  // schuine strepen, rood op geel, naar het midden toe (de chevrons achterop)
  g.fillStyle = '#d4202a';
  for (let i = -6; i < 10; i++) {
    for (const kant of [-1, 1]) {
      g.beginPath();
      const x = 128 + kant * (i * 36);
      g.moveTo(x, 256); g.lineTo(x + kant * 18, 256); g.lineTo(x + kant * 18 - kant * 128, 128); g.lineTo(x - kant * 128, 128);
      g.closePath(); g.fill();
    }
  }
  g.fillStyle = '#e6dd18'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#1d4fb4'; g.font = 'bold 40px Arial, Helvetica, sans-serif'; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillText('AMBULANCE', 128, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function initAmbulance({ scene, vehicles, KAART, npcs = null, sfeer = null }) {
  if (!vehicles || !KAART) return null;
  // ---- het model ----
  const auto = vehicles.voegToe({ x: 1e5, z: 1e5, yaw: 0, soort: 'van', kleur: AMB.geel, driveable: false });
  auto.ambulance = true;
  const mesh = auto.mesh;
  /*
   De maten van het model, gemeten in de oorsprong. `setFromObject` meet in de wereld, en het busje
   staat geparkeerd op 1e5: zo kwamen de doeken en de lichtbalk honderd kilometer achter de wagen te
   hangen (de foto's van stap 112 waren een gele bus zonder iets erop).
  */
  mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.updateMatrixWorld(true);
  // en alleen de carrosserie (de lak): het hele model telt ook de bundels van de koplampen mee, en
  // dan hingen de doeken een meter naast en achter de wagen
  let romp = null;
  mesh.traverse(o => { if (!romp && o.isMesh && o.userData.lak) romp = o; });
  const doos = romp ? new THREE.Box3().setFromObject(romp) : new THREE.Box3().setFromObject(mesh);
  const L = doos.max.z - doos.min.z, B = doos.max.x - doos.min.x, H = doos.max.y - doos.min.y;
  const z0 = (doos.max.z + doos.min.z) / 2;
  // de flanken: een band van de dorpel tot onder de ruiten
  const flankH = Math.min(0.85, H * 0.38), flankY = 0.36 + flankH / 2;
  for (const kant of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.9, flankH),
      new THREE.MeshStandardMaterial({ map: flankDoek(kant < 0), roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.y = kant * Math.PI / 2;
    m.position.set(kant * (B / 2 + 0.012), flankY, z0);
    m.raycast = () => {};
    mesh.add(m);
  }
  {
    // achterop: het busje kijkt naar −z, dus achter is +z
    const m = new THREE.Mesh(new THREE.PlaneGeometry(B * 0.86, flankH * 1.25),
      new THREE.MeshStandardMaterial({ map: achterDoek(), roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(0, flankY + 0.05, doos.max.z + 0.012);
    m.raycast = () => {};
    mesh.add(m);
  }
  // de lichtbalk: voor en achter op het dak twee blauwe lampen
  const lampen = [];
  const balk = new THREE.Group();
  const lampMat = () => new THREE.MeshStandardMaterial({ color: 0x2b6bff, emissive: 0x2b6bff, emissiveIntensity: 0.15 });
  for (const [zz, breed] of [[doos.min.z + 0.55, 0.95], [doos.max.z - 0.25, 0.7]]) {
    const voet = new THREE.Mesh(new THREE.BoxGeometry(breed + 0.1, 0.06, 0.22), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 }));
    voet.position.set(0, doos.max.y + 0.03, zz);
    balk.add(voet);
    for (const kant of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.18), lampMat());
      l.position.set(kant * breed * 0.3, doos.max.y + 0.12, zz);
      balk.add(l);
      maakGloed(l, balk, kant);
      lampen.push(l);
    }
  }
  // (de plassen licht van `maakGloed` hangen aan de balk op 7 cm: de balk zelf staat op de grond van de wagen)
  mesh.add(balk);

  // ---- de bemanning ----
  const kleding = { shirt: 0xc9d52c, broek: 0x1e2b45, schoen: 0x15171b };
  const bemanning = [0, 1].map(i => {
    const p = new Persoon({ ...kleding, huid: i ? 0xc79a72 : 0xe0bfa0, haar: i ? 0x111111 : 0x9a7a52, hoogte: 0.98 + i * 0.03 });
    p.groep.visible = false;
    scene.add(p.groep);
    return p;
  });

  const st = { fase: 'vrij', rust: 0, lijn: null, rit: null, doel: null, helpT: 0, ritten: 0, gereanimeerd: 0, knipper: 0, weigeringen: 0 };

  function verstop() {
    auto.speed = 0; auto.zichtbaar = false;
    mesh.visible = false; mesh.position.set(1e5, 0, 1e5); auto.x = auto.z = 1e5;
    for (const p of bemanning) p.groep.visible = false;
    for (const l of lampen) zetZwaailamp(l, 0, false);
  }
  verstop();

  // een punt op een weg voor auto's: dichtstbijzijnde bij (x, z), of op afstand [van, tot]
  /*
   Een punt op een weg voor auto's: de dichtstbijzijnde bij (x, z), of op afstand [van, tot]. Alleen
   op de hoogte van het doel (stap 113): de dichtstbijzijnde weg lag soms op het dek van het viaduct,
   vijf meter boven wie er lag, en dan liep de bemanning door de lucht.
  */
  function wegPunt(x, z, { van = 0, tot = 120, weg = null, niet = [], los = 60 } = {}) {
    const hDoel = grondHoogte(x, z);       // (zoals de voetgangers: het bovenste vlak)
    let beste = null;
    for (const as of KAART.wegassen || []) {
      if (!as.drive) continue;
      for (const q of as.pts) {
        const d = Math.hypot(q[0] - x, q[1] - z);
        if (d < van || d > tot) continue;
        if (weg && Math.hypot(q[0] - weg.x, q[1] - weg.z) < weg.min) continue;
        if (Math.abs(grondHoogte(q[0], q[1]) - hDoel) > 1.5) continue;
        // (een vertrekpunt dat al eens niets opleverde: niet weer, en ook niet vlak ernaast)
        if (niet.some(n => Math.hypot(q[0] - n.x, q[1] - n.z) < 40)) continue;
        const sc = van ? Math.abs(d - (van + tot) / 2) + Math.random() * los : d;
        if (!beste || sc < beste.sc) beste = { sc, x: q[0], z: q[1], d };
      }
    }
    return beste;
  }
  function opLijnBegin(Ln) {
    const dx = Ln.x[1] - Ln.x[0], dz = Ln.z[1] - Ln.z[0];
    const yaw = Math.atan2(-dx, -dz);
    auto.x = Ln.x[0]; auto.z = Ln.z[0]; auto.yaw = yaw; auto.speed = 0; auto.hp = 100; auto.wrak = false;
    mesh.visible = true; mesh.position.set(auto.x, 0, auto.z); mesh.rotation.y = yaw; auto.zichtbaar = true;
    vehicles.zetNeer(auto, 0, yaw);
  }

  /*
   Iemand ligt op (x, z). `wie` is { npc } (een voetganger uit js/npc.js), { persoon, herstel }
   (iemand anders die met `herstel()` weer opstaat), of niets: dan zoekt hij zelf een voetganger
   die daar ligt. `speler` is waar jij bent. Levert true als hij komt.
  */
  function melding(x, z, wie = null, speler = null, { zeker = false } = {}) {
    if (st.fase !== 'vrij' || st.rust > 0) return false;
    if (!zeker && Math.random() > AMB.kans) { st.weigeringen++; return false; }
    let doel = wie;
    if (!doel && npcs) {
      let best = null, bd = 4;
      for (const p of npcs.people) {
        if (p.alive) continue;
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) doel = { npc: best };
    }
    if (!doel) return false;
    const aan = wegPunt(x, z, { tot: 140 });
    if (!aan) return false;
    const sp = speler || { x: 1e5, z: 1e5 };
    // (steeds een ander vertrekpunt, en hoe vaker het mislukt hoe losser gekozen: in een proef
    // leverden zes bijna dezelfde punten zes keer geen route op)
    const geprobeerd = [];
    for (let poging = 0; poging < 12; poging++) {
      const begin = wegPunt(x, z, { van: AMB.van, tot: AMB.tot, weg: { x: sp.x, z: sp.z, min: AMB.nietBij }, niet: geprobeerd, los: 60 + poging * 60 });
      if (!begin) return false;
      geprobeerd.push(begin);
      const Ln = lijnDoor(KAART, [[begin.x, begin.z], [aan.x, aan.z]]);
      if (!Ln || Ln.lengte > 1400 || Ln.n < 4) continue;
      // de patiënt blijft liggen tot hij er is
      if (doel.npc) doel.npc.respawn = Math.max(doel.npc.respawn || 0, 9999);
      st.doel = { x, z, ...doel };
      st.lijn = Ln;
      st.rit = { s: 0, v: 0, prof: profiel(Ln, { top: AMB.top }), klaar: false, gecrasht: false };
      st.fase = 'heen'; st.ritten++;
      opLijnBegin(Ln);
      return true;
    }
    return false;
  }

  function lampenBij(dt, aan) {
    st.knipper += dt;
    const nacht = !!(sfeer && sfeer.nacht);
    const fase = Math.floor(st.knipper / 0.18) % 4;
    lampen.forEach((l, i) => zetZwaailamp(l, aan ? ((i + fase) % 2 === 0 ? 1 : 0.08) : 0, nacht));
  }
  // de bemanning loopt naar een punt; levert true als ze er zijn
  function loop(p, doel, dt, snel) {
    const pos = p.groep.position, dx = doel.x - pos.x, dz = doel.z - pos.z, d = Math.hypot(dx, dz);
    if (d < 0.5) { p.update(dt, {}); return true; }
    const stap = Math.min(d, snel * dt);
    pos.x += dx / d * stap; pos.z += dz / d * stap;
    p.draaiNaar(Math.atan2(-dx, -dz), dt, 8);
    p.update(dt, { loopt: true, snelheid: snel });
    return false;
  }
  function achterDeur() {
    // achter de wagen (+z in het model is achter), een meter verder
    const ax = Math.sin(auto.yaw), az = Math.cos(auto.yaw);
    return { x: auto.x + ax * (L / 2 + 0.8), z: auto.z + az * (L / 2 + 0.8) };
  }
  function opstaan() {
    const d = st.doel;
    if (d.npc) {
      const p = d.npc;
      p.alive = true; p.fall = 0; p.raken = 0; p.respawn = 0; p.paniek = 0; p.smak = null; p.vNu = 0; p.bron = null;
    } else if (d.herstel) d.herstel();
    st.gereanimeerd++;
  }
  function vertrek() {
    for (const p of bemanning) p.groep.visible = false;
    const naar = wegPunt(auto.x, auto.z, { van: 350, tot: 520 });
    const Ln = naar ? lijnDoor(KAART, [[auto.x, auto.z], [naar.x, naar.z]]) : null;
    st.lijn = Ln;
    st.rit = Ln ? { s: 0, v: 0, prof: profiel(Ln, { top: AMB.terugTop }), klaar: false, gecrasht: false } : null;
    st.fase = 'terug';
  }
  function klaar() {
    verstop();
    st.fase = 'vrij'; st.rust = AMB.rust; st.doel = null; st.lijn = null; st.rit = null;
  }

  return {
    auto, bemanning, st,
    get fase() { return st.fase; },
    get lampenAan() { return lampen.some(l => l.material.emissiveIntensity > 1); },
    melding,
    /*
     Eén beeld. `speler` { x, z }, `ziet(x, z)` of de camera daar kan kijken (om uit beeld te
     verdwijnen).
    */
    update(dt, speler, ziet = () => false) {
      if (st.rust > 0) st.rust -= dt;
      if (st.fase === 'vrij') return;
      const dSp = Math.hypot(auto.x - speler.x, auto.z - speler.z);
      // stukgeschoten: de bemanning rent weg en het is voorbij zodra je het niet meer ziet
      if (auto.wrak || auto.hp <= 0) {
        lampenBij(dt, false);
        if (st.doel && st.doel.npc) st.doel.npc.respawn = 20;
        if (!ziet(auto.x, auto.z) || dSp > AMB.weg) { st.fase = 'vrij'; st.rust = AMB.rust; for (const p of bemanning) p.groep.visible = false; st.doel = null; }
        return;
      }
      if (st.fase === 'heen') {
        rijdVlucht(st.rit, st.lijn, auto, vehicles, dt);
        lampenBij(dt, true);
        geluid.sirene(dSp);
        if (st.rit.klaar) {
          auto.speed = 0;
          st.fase = 'uitstappen';
          const a = achterDeur();
          bemanning.forEach((p, i) => { p.zetNeer(a.x + (i ? 0.7 : -0.7), a.z, auto.yaw + Math.PI); p.groep.visible = true; });
        }
        return;
      }
      lampenBij(dt, st.fase !== 'terug');
      if (st.fase === 'uitstappen') {
        // naar de patiënt, ieder aan een kant
        const d = st.doel;
        const px = d.npc ? d.npc.x : d.x, pz = d.npc ? d.npc.z : d.z;
        let er = 0;
        bemanning.forEach((p, i) => { if (loop(p, { x: px + (i ? 0.75 : -0.75), z: pz + 0.3 }, dt, AMB.lopen)) er++; });
        if (er === 2) { st.fase = 'helpt'; st.helpT = AMB.helpT; }
        return;
      }
      if (st.fase === 'helpt') {
        st.helpT -= dt;
        const d = st.doel, px = d.npc ? d.npc.x : d.x, pz = d.npc ? d.npc.z : d.z;
        for (const p of bemanning) { p.kijkNaar(px, pz, dt, 6); p.update(dt, { hurkt: 0.85 }); }
        if (st.helpT <= 0) { opstaan(); st.fase = 'instappen'; }
        return;
      }
      if (st.fase === 'instappen') {
        const a = achterDeur();
        let er = 0;
        bemanning.forEach((p, i) => { if (loop(p, { x: a.x + (i ? 0.7 : -0.7), z: a.z }, dt, AMB.lopen * 0.8)) er++; });
        if (er === 2) vertrek();
        return;
      }
      if (st.fase === 'terug') {
        if (st.rit && !st.rit.klaar) rijdVlucht(st.rit, st.lijn, auto, vehicles, dt);
        else auto.speed = 0;
        if ((!st.rit || st.rit.klaar || dSp > AMB.weg) && !ziet(auto.x, auto.z)) klaar();
      }
    },
    // voor de proeven
    verstop: klaar,
  };
}

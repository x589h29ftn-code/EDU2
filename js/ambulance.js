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
import { autoMaat } from './carmodel.js';
import { lijnDoor } from './schaduw.js';
import { profiel, rijdVlucht } from './inval.js';
import { geluid } from './audio.js';

export const AMB = {
  kans: 0.85,           // zoveel kans dat er een komt als er iemand neergaat (stap 128: was 0,4, "meer ambulances")
  rust: 45,             // s na de vorige rit voordat er weer een kan komen (stap 128: was 120)
  van: 300, tot: 480,   // m: waar hij begint, van het slachtoffer
  nietBij: 180,         // m: en niet dichter bij de speler dan dit
  top: 16,              // m/s met spoed
  terugTop: 11,         // m/s op de terugweg
  lopen: 3.6,           // m/s: de bemanning
  helpT: 8,             // s geknield bij de patiënt
  weg: 220,             // m: verder weg (en uit beeld) verdwijnt hij
  geel: 0xe6dd18,
};

// ---- de doeken (stap 116: op het eigen model, js/carmodel.js `ambulanceGeoms`) ----
const GEEL = '#e6dd18', ROOD = '#d4202a', BLAUW = '#1d4fb4';
function sterVanHetLeven(g, x, y, r, kleur, rand = null) {
  g.save(); g.translate(x, y);
  for (const [k, extra] of rand ? [[rand, r * 0.12], [kleur, 0]] : [[kleur, 0]]) {
    g.fillStyle = k;
    for (let i = 0; i < 3; i++) { g.save(); g.rotate(i * Math.PI / 3); g.fillRect(-r * 0.22 - extra, -r - extra, r * 0.44 + 2 * extra, r * 2 + 2 * extra); g.restore(); }
  }
  // de esculaap: een staf met een slang eromheen
  g.fillStyle = '#ffffff'; g.fillRect(-r * 0.05, -r * 0.72, r * 0.10, r * 1.44);
  g.strokeStyle = '#ffffff'; g.lineWidth = r * 0.07; g.beginPath();
  for (let t = 0; t <= 1.001; t += 0.05) { const yy = -r * 0.55 + t * r * 1.1, xx = Math.sin(t * Math.PI * 3) * r * 0.16; t ? g.lineTo(xx, yy) : g.moveTo(xx, yy); }
  g.stroke();
  g.restore();
}
const doek = (c, aniso = 8) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };
// het zijprofiel van het model (in z, y), net binnen de rand: daarbuiten mag de beplakking niet komen
const PROFIEL = [[-2.52, 0.30], [-2.52, 1.09], [-2.40, 1.12], [-2.04, 1.20], [-1.98, 1.25], [-1.37, 2.06], [-1.35, 2.20], [-1.30, 2.42],
  [-1.17, 2.59], [-0.95, 2.64], [2.80, 2.64], [2.90, 2.54], [2.90, 0.30]];
const ZIJ = { z0: -2.95, z1: 2.95, y0: 0.30, y1: 2.66, b: 2048, h: 816 };
/*
 Een flank. Het doek is de hele zijkant (z van −2,95 tot 2,95, y van 0,30 tot 2,66) en doorzichtig
 waar geen beplakking zit, zodat het geel de lak van het model is. `kant` +1 is rechts: daar zit de
 neus links op het doek niet, maar rechts (zie de draaiing in `initAmbulance`).
*/
function zijDoek(kant, m) {
  const c = document.createElement('canvas'); c.width = ZIJ.b; c.height = ZIJ.h;
  const g = c.getContext('2d');
  const X = (z) => (kant > 0 ? (ZIJ.z1 - z) : (z - ZIJ.z0)) / (ZIJ.z1 - ZIJ.z0) * ZIJ.b;
  const Y = (y) => (ZIJ.y1 - y) / (ZIJ.y1 - ZIJ.y0) * ZIJ.h;
  const M = ZIJ.b / (ZIJ.z1 - ZIJ.z0);                    // beeldpunten per meter
  const veelhoek = (pts) => { g.beginPath(); pts.forEach(([z, y], i) => (i ? g.lineTo(X(z), Y(y)) : g.moveTo(X(z), Y(y)))); g.closePath(); };
  g.save();
  veelhoek(PROFIEL); g.clip();
  /*
   De blokken (de "battenburg" van de foto's): schuine banen die met hun bovenkant naar voren
   leunen, onder blauw en boven rood, met geel ertussen. Van het voorspatbord tot vóór het
   achterwiel, en daar schuin afgesneden.
  */
  const yb = 0.50, ym = 0.92, yt = 1.34, leun = 0.42, baan = 0.27;
  const zEind = 0.95;
  for (let zb = -2.9; zb < zEind + leun; zb += baan * 2) {
    const op = (y) => (y - yb) / (yt - yb) * leun;      // hoeveel de baan op hoogte y naar voren schuift
    for (const [y0, y1, kleur] of [[yb, ym, BLAUW], [ym, yt, ROOD]]) {
      veelhoek([[zb - op(y0), y0], [zb + baan - op(y0), y0], [zb + baan - op(y1), y1], [zb - op(y1), y1]]);
      g.fillStyle = kleur; g.fill();
    }
  }
  // de band houdt schuin op, en een dunne retroreflecterende rand eromheen
  g.globalCompositeOperation = 'destination-out';
  veelhoek([[zEind, yb - 0.01], [3.2, yb - 0.01], [3.2, yt + 0.01], [zEind - leun, yt + 0.01]]); g.fill();
  veelhoek([[-3.2, 0], [3.2, 0], [3.2, yb], [-3.2, yb]]); g.fill();
  veelhoek([[-3.2, yt], [3.2, yt], [3.2, 3], [-3.2, 3]]); g.fill();
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = '#c4bd12'; g.lineWidth = 0.025 * M; g.setLineDash([0.05 * M, 0.03 * M]);
  g.beginPath(); g.moveTo(X(-2.52), Y(yt + 0.02)); g.lineTo(X(zEind - leun), Y(yt + 0.02)); g.lineTo(X(zEind), Y(yb - 0.02)); g.lineTo(X(-2.52), Y(yb - 0.02)); g.stroke();
  g.setLineDash([]);
  // AMBULANCE en de regio, achter in de flank boven het achterwiel
  g.fillStyle = BLAUW; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold ${Math.round(0.25 * M)}px Arial, Helvetica, sans-serif`;
  g.fillText('AMBULANCE', X(1.78), Y(1.56));
  g.font = `bold ${Math.round(0.11 * M)}px Arial, Helvetica, sans-serif`;
  g.fillText('Fryslân', X(1.78), Y(1.35));
  g.font = `bold ${Math.round(0.13 * M)}px Arial, Helvetica, sans-serif`;
  g.fillText('02-115', X(1.95), Y(2.50));
  // 112 in rood en blauw, achter het achterwiel
  g.font = `bold ${Math.round(0.15 * M)}px Arial, Helvetica, sans-serif`;
  g.fillStyle = ROOD; g.fillText('1', X(2.48), Y(1.12));
  g.fillStyle = BLAUW; g.fillText('12', X(2.66), Y(1.12));
  // het logo van de dienst, hoog op de schuifdeur of het paneel
  g.fillStyle = BLAUW; g.font = `bold ${Math.round(0.085 * M)}px Arial, Helvetica, sans-serif`;
  g.fillText('Ambulancezorg', X(-0.28), Y(2.02));
  g.fillText('Fryslân', X(-0.28), Y(1.91));
  sterVanHetLeven(g, X(-0.72), Y(1.965), 0.10 * M, BLAUW);
  // de wielkasten en de ruiten vrij: daar zit geen plaat (en geen doek)
  g.globalCompositeOperation = 'destination-out';
  for (const z of [m.wielVoor, m.wielAchter]) { g.beginPath(); g.arc(X(z), Y(m.R), (m.kast + 0.04) * M, 0, Math.PI * 2); g.fill(); }
  const P = m.portier, A = m.raamAchter;
  veelhoek([[P.z0 + 0.02, P.y0], [P.z1, P.y0], [P.z1, P.y1], [-1.40, P.y1], [P.z0, P.y0 + 0.06]]); g.fill();
  veelhoek([[A.z0, A.y0], [A.z1, A.y0], [A.z1, A.y1], [A.z0, A.y1]]); g.fill();
  g.globalCompositeOperation = 'source-over';
  g.restore();
  // de ster van het leven op de donkere ruit achterin (het doek ligt over het glas heen)
  sterVanHetLeven(g, X((A.z0 + A.z1) / 2 + 0.25), Y((A.y0 + A.y1) / 2), 0.22 * M, BLAUW, '#ffffff');
  return doek(c);
}
/*
 De motorkap: langs de voorrand de blokken in rood en blauw, en AMBULANCE in spiegelschrift (dan
 lees je het in je binnenspiegel). Het doek ligt plat op de kap met de bovenrand aan de neus, dus
 voor wie ervoor staat is het een halve slag gedraaid: spiegelschrift is dan alleen omgeklapt.
*/
function kapDoek() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  const blok = 64;
  for (let i = -2; i < 20; i++) {
    const x = i * blok;
    g.fillStyle = i % 2 ? BLAUW : ROOD;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + blok * 0.55, 0); g.lineTo(x + blok * 0.55 + 40, 96); g.lineTo(x + 40, 96); g.closePath(); g.fill();
  }
  g.save(); g.translate(512, 300); g.scale(1, -1);
  g.fillStyle = BLAUW; g.font = 'bold 118px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('AMBULANCE', 0, 0);
  g.restore();
  return doek(c);
}
// de achterdeuren: rood-gele punten naar boven, en AMBULANCE erboven
function achterDoek() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 384;
  const g = c.getContext('2d');
  // per deur één richting, zodat de strepen in het midden een punt maken (eerst liepen beide
  // richtingen over de hele breedte en werd het een ruitjespatroon)
  for (const kant of [-1, 1]) {
    g.save();
    g.beginPath(); g.rect(kant < 0 ? 0 : 256, 150, 256, 234); g.clip();
    for (let i = -8; i < 12; i++) {
      const x = 256 + kant * i * 56;
      g.fillStyle = ROOD;
      g.beginPath(); g.moveTo(x, 384); g.lineTo(x + kant * 28, 384); g.lineTo(x + kant * 28 - kant * 234, 150); g.lineTo(x - kant * 234, 150); g.closePath(); g.fill();
    }
    g.restore();
  }
  g.fillStyle = BLAUW; g.font = 'bold 64px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('AMBULANCE', 256, 80);
  // de naad tussen de deuren loopt erdoorheen
  g.fillStyle = '#20232a'; g.fillRect(254, 0, 4, 384);
  return doek(c, 4);
}

export function initAmbulance({ scene, vehicles, KAART, npcs = null, sfeer = null }) {
  if (!vehicles || !KAART) return null;
  // ---- het model: een eigen model in js/carmodel.js (stap 116), geen geel busje meer ----
  const auto = vehicles.voegToe({ x: 1e5, z: 1e5, yaw: 0, soort: 'ambulance', kleur: AMB.geel, driveable: false });
  auto.ambulance = true;
  const mesh = auto.mesh;
  const maat = autoMaat('ambulance'), m = maat.amb;
  const L = maat.L;
  // de beplakking hangt in de carrosseriegroep (die helt over in de bocht), en is geen doel
  const bak = mesh.userData.bak || mesh;
  const sticker = (map, b, h) => {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(b, h),
      new THREE.MeshStandardMaterial({ map, transparent: true, alphaTest: 0.35, roughness: 0.45, polygonOffset: true, polygonOffsetFactor: -2 }));
    d.raycast = () => {};
    d.userData.beplakking = true;
    bak.add(d);
    return d;
  };
  for (const kant of [-1, 1]) {
    const d = sticker(zijDoek(kant, m), ZIJ.z1 - ZIJ.z0, ZIJ.y1 - ZIJ.y0);
    d.rotation.y = kant * Math.PI / 2;
    d.position.set(kant * (m.zijX + 0.025), (ZIJ.y0 + ZIJ.y1) / 2, (ZIJ.z0 + ZIJ.z1) / 2);
  }
  {
    // de motorkap: plat op de schuine kap, met de bovenrand van het doek aan de neus
    const a = m.kapA, b = m.kapB, lang = Math.hypot(b.z - a.z, b.y - a.y), hoek = Math.atan2(b.y - a.y, b.z - a.z);
    const d = sticker(kapDoek(), m.zijX * 2 * 0.80, lang * 0.92);
    d.rotation.x = -Math.PI / 2 - hoek;
    d.position.set(0, (a.y + b.y) / 2 + 0.02, (a.z + b.z) / 2);
  }
  {
    // (boven de kentekenplaat, die op 0,62 m hangt: eerst lag het doek eroverheen)
    const d = sticker(achterDoek(), (m.achterlicht.x - m.achterlicht.b / 2 - 0.02) * 2, 1.0);
    d.position.set(0, 1.23, m.achterZ + 0.02);
  }
  /*
   De zwaailichten: een witte balk vóór op het dak met aan elke kant een blauwe kap, twee op de
   achterhoeken van het dak, en twee knipperlichten in de grille. Allemaal met de gloed van de
   politie (`maakGloed`); de plas licht op straat alleen van die op het dak.
  */
  const lampen = [];
  const balk = new THREE.Group();
  const lampMat = () => new THREE.MeshStandardMaterial({ color: 0x2b6bff, emissive: 0x2b6bff, emissiveIntensity: 0.15, roughness: 0.25 });
  const wit = new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.5 });
  const huis = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.12, 0.30), wit);
  huis.position.set(0, m.dakY + 0.06, m.dakVoorZ + 0.12);
  balk.add(huis);
  const lamp = (x, y, z, b, h, d, plas) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(b, h, d), lampMat());
    l.position.set(x, y, z);
    balk.add(l);
    maakGloed(l, balk, Math.sign(x) || 1);
    if (!plas) { const p = balk.children[balk.children.length - 1]; balk.remove(p); delete l.userData.plas; }
    lampen.push(l);
    return l;
  };
  for (const sx of [-1, 1]) lamp(sx * 0.70, m.dakY + 0.15, m.dakVoorZ + 0.12, 0.30, 0.13, 0.26, true);
  for (const sx of [-1, 1]) lamp(sx * 0.78, m.dakY + 0.08, m.achterZ - 0.18, 0.22, 0.13, 0.18, true);
  for (const sx of [-1, 1]) lamp(sx * 0.30, 0.80, m.voorZ - 0.05, 0.16, 0.07, 0.03, false);
  // (de plassen licht van `maakGloed` hangen aan de balk op 7 cm: de balk zelf staat op de grond van de wagen)
  bak.add(balk);

  // ---- de bemanning ----
  const kleding = { shirt: 0xc9d52c, broek: 0x1e2b45, schoen: 0x15171b };
  const bemanning = [0, 1].map(i => {
    const p = new Persoon({ ...kleding, huid: i ? 0xc79a72 : 0xe0bfa0, haar: i ? 0x111111 : 0x9a7a52, hoogte: 0.98 + i * 0.03 });
    p.groep.visible = false;
    scene.add(p.groep);
    p.neer = false; p.omT = 0;
    return p;
  });
  /*
   De bemanning is te raken (stap 129, gevraagd: "Ambulance broeders kan je niet neerschieten, verander dit"). Wie
   neergaat blijft liggen; de ander rent terug en de ambulance vertrekt zonder te helpen. Bij `klaar` (uit beeld)
   ruimt hij op.
  */
  function bemanningNeer() { return bemanning.some(p => p.neer); }
  function raakBemanning(obj) {
    for (let o = obj; o; o = o.parent) {
      const p = bemanning.find(q => q.groep === o);
      if (!p) continue;
      if (p.neer || !p.groep.visible) return null;
      p.neer = true; p.omT = 0;
      if (st.fase === 'uitstappen' || st.fase === 'helpt' || st.fase === 'instappen') vertrek();
      return { x: p.groep.position.x, z: p.groep.position.z };
    }
    return null;
  }

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
    for (const p of bemanning) if (!p.neer) p.groep.visible = false;
    const naar = wegPunt(auto.x, auto.z, { van: 350, tot: 520 });
    const Ln = naar ? lijnDoor(KAART, [[auto.x, auto.z], [naar.x, naar.z]]) : null;
    st.lijn = Ln;
    st.rit = Ln ? { s: 0, v: 0, prof: profiel(Ln, { top: AMB.terugTop }), klaar: false, gecrasht: false } : null;
    st.fase = 'terug';
  }
  function klaar() {
    verstop();
    for (const p of bemanning) { p.neer = false; p.omT = 0; p.legNeer(0); }
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
    doelen() { return bemanning.filter(p => p.groep.visible && !p.neer).map(p => p.groep); },
    raak: raakBemanning,
    update(dt, speler, ziet = () => false) {
      if (st.rust > 0) st.rust -= dt;
      for (const p of bemanning) if (p.neer && p.omT < 1) { p.omT = Math.min(1, p.omT + dt * 1.8); p.legNeer(p.omT); }
      if (st.fase === 'vrij') return;
      const dSp = Math.hypot(auto.x - speler.x, auto.z - speler.z);
      // stukgeschoten: de bemanning rent weg en het is voorbij zodra je het niet meer ziet
      if (auto.wrak || auto.hp <= 0) {
        lampenBij(dt, false);
        if (st.doel && st.doel.npc) st.doel.npc.respawn = 20;
        if (!ziet(auto.x, auto.z) || dSp > AMB.weg) { st.fase = 'vrij'; st.rust = AMB.rust; for (const p of bemanning) { p.groep.visible = false; p.neer = false; p.omT = 0; p.legNeer(0); } st.doel = null; }
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

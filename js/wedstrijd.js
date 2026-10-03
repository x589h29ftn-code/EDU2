/*
 Een wedstrijd op het hoofdveld van VV Sneek Wit Zwart (stap 111). Gevraagd op 3 okt 2026: "Zet
 standaard een wedstrijd bij VV Sneek op het hoofdveld tussen 12:00 en 15:00 op een dag. Daarna
 zijn de mensen weg, bijvoorbeeld als de speler het niet ziet, zodat ze niet ineens verdwijnen.
 De spelers kunnen aangereden worden en spelen met een bal."

 - Elke dag van WEDSTRIJD.van tot WEDSTRIJD.tot. Komen en gaan gebeurt alleen als je het veld niet
   ziet (`gezien`: binnen WEDSTRIJD.zicht en in het beeld van de camera). Wie om twaalf uur naar
   het veld staat te kijken, ziet het dus pas beginnen als hij even wegkijkt, en om drie uur blijft
   het spel doorgaan tot hij wegkijkt.
 - Twee elftallen in een 4-4-2: VV Sneek in wit met zwarte broeken tegen een tegenstander in rood.
   Iedereen heeft een plek in de opstelling, en die schuift mee met de bal. Van elk elftal gaat de
   speler die er het dichtst bij staat op de bal af. Wie de bal heeft, schiet op het doel als hij
   dichtbij genoeg is, en speelt anders over naar een ploeggenoot die verder naar voren staat (soms
   met een boogbal), of dribbelt. De keeper blijft in zijn doel en pakt wat in zijn buurt komt.
 - De bal: een bol met een eigen doek, die rolt (met wrijving), stuitert en uit kan gaan. Over de
   zijlijn: een inworp vanaf de lijn. Over de achterlijn: tussen de palen en onder de lat is het een
   doelpunt (gejuich, en aftrap vanaf de middenstip), anders een doeltrap.
 - De scheidsrechter loopt mee met de bal, op een afstand.
 - Publiek: een rij op de tribune (zittend, in een eigen houder op de hoogte van de trede) en een
   paar man langs de lijn aan de overkant. Bij een doelpunt gaan de armen omhoog.
 - Aanrijden en raken: een auto die harder dan AANRIJ_V gaat en binnen AANRIJ_R van iemand op het
   veld komt, rijdt hem omver. Een kogel doet hetzelfde. Dan is de wedstrijd gestaakt: iedereen
   rent weg van de plek, en wie ligt blijft liggen (`slachtoffers`, voor de ambulance).
 - Verder dan WEDSTRIJD.teken van de speler wordt niets bijgewerkt of getekend.
*/
import * as THREE from 'three';
import { Persoon } from './persoon.js';
import { grondHoogte } from './world.js';
import { geluid } from './audio.js';

export const WEDSTRIJD = {
  van: 12, tot: 15,          // de wedstrijd loopt van twaalf tot drie
  zicht: 260,                // verder weg zie je het veld niet (en mag het wisselen)
  teken: 240,                // verder weg wordt niets bijgewerkt
  ren: 6.4, draf: 3.3,       // m/s: op de bal af, en naar je plek in de opstelling
  bereik: 0.95,              // zo dicht bij de bal kun je hem raken (m)
  schietAfstand: 20,         // dichter bij het doel: schieten
  aanrijV: 3.5,              // m/s: harder rijdt iemand omver
  aanrijR: 1.5,              // m
};
const BAL_R = 0.11;
const DOEL_HALF = 3.66, LAT = 2.44;
const ZWAAR = 9.81;
const KEEPER_PAKT = 0.8;     // zo vaak houdt de keeper een hard schot tegen dat hij kan halen
const GESTAAKT_T = 90;       // s: zo lang blijft een gestaakte wedstrijd (met wie er ligt) minstens staan

const THUIS = { shirt: 0xf2f2f0, broek: 0x16181b, korteMouw: true };
const UIT = { shirt: 0xc4232b, broek: 0xf0f0ee, korteMouw: true };
const KEEPER = [{ shirt: 0x2c9a4a, broek: 0x16181b, korteMouw: false }, { shirt: 0xe3c12a, broek: 0x16181b, korteMouw: false }];
const SCHEIDS = { shirt: 0x141518, broek: 0x141518, korteMouw: true };
const PUBLIEK = [0x2f4a7a, 0x6b2f2f, 0x2f5a3a, 0x4a4a52, 0x8a6a3a, 0x1f2a3a, 0x5a3a6a, 0x3a5a6a, 0x7a7a72, 0x2a2a2a];
const HUID = [0xd9b48f, 0xc79a72, 0xe0bfa0, 0x8d5f3f, 0xd2a77f];
const HAAR = [0x2a1d12, 0x5a3a22, 0x9a8a72, 0x111111, 0xb08a52];

// de opstelling (4-4-2) voor wie naar +u speelt, als deel van de halve lengte en breedte
const OPSTELLING = [
  [-0.95, 0],                                                        // keeper
  [-0.62, -0.62], [-0.66, -0.2], [-0.66, 0.2], [-0.62, 0.62],       // verdediging
  [-0.25, -0.65], [-0.3, -0.2], [-0.3, 0.2], [-0.25, 0.65],         // middenveld
  [0.08, -0.22], [0.1, 0.22],                                        // spitsen
];

// het doek van de bal: wit met zwarte vijfhoeken
function balDoek() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#18181a';
  const vijf = (x, y, r) => {
    g.beginPath();
    for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    g.closePath(); g.fill();
  };
  for (let i = 0; i < 6; i++) { vijf(10 + i * 22, 16, 6); vijf(21 + i * 22, 46, 6); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function maakWedstrijd({ scene, veld }) {
  if (!veld) return null;
  const V = veld;
  const ex = Math.cos(V.hoek), ez = Math.sin(V.hoek);
  const hl = V.vl / 2, hb = V.vb / 2;
  const wx = (u, v) => V.cx + ex * u - ez * v;
  const wz = (u, v) => V.cz + ez * u + ex * v;
  // terug: wereld naar (u, v)
  const naarUV = (x, z) => { const dx = x - V.cx, dz = z - V.cz; return { u: dx * ex + dz * ez, v: -dx * ez + dz * ex }; };
  // yaw van iemand die in de richting (du, dv) kijkt (yaw 0 is −z)
  const yawUV = (du, dv) => { const dx = ex * du - ez * dv, dz = ez * du + ex * dv; return Math.atan2(-dx, -dz); };
  const grondY = grondHoogte(V.cx, V.cz);

  const groep = new THREE.Group();
  groep.name = 'wedstrijd';
  groep.visible = false;
  scene.add(groep);

  // ---- de spelers ----
  const spelers = [];
  for (let t = 0; t < 2; t++) {
    for (let i = 0; i < 11; i++) {
      const k = i === 0 ? KEEPER[t] : (t === 0 ? THUIS : UIT);
      const p = new Persoon({ ...k, huid: HUID[(i * 3 + t) % HUID.length], haar: HAAR[(i + t * 2) % HAAR.length],
        hoogte: 0.97 + ((i * 7 + t * 3) % 5) * 0.015, schoen: 0x101012 });
      groep.add(p.groep);
      spelers.push({ p, team: t, nr: i, keeper: i === 0, u: 0, v: 0, yaw: 0, schopT: 0, neer: false, omT: 0, vlucht: null, juich: 0 });
    }
  }
  const scheids = { p: new Persoon({ ...SCHEIDS, huid: 0xd2a77f, haar: 0x2a1d12 }), u: 0, v: 0, neer: false, omT: 0, vlucht: null };
  groep.add(scheids.p.groep);

  // ---- het publiek: een rij op de tribune, en een paar langs de lijn aan de overkant ----
  const publiek = [];
  const Tb = V.tribune;
  if (Tb) {
    const ax = Math.cos(Tb.hoek), az = Math.sin(Tb.hoek);
    const nx = -az * Tb.kant, nz = ax * Tb.kant;
    const tx = (l, d) => Tb.vx + ax * l - nx * d, tz = (l, d) => Tb.vz + az * l - nz * d;
    const tredeD = Tb.diep / Tb.treden, tredeH = 0.38;
    let n = 0;
    for (let i = 1; i < Tb.treden && n < 14; i++) {
      const d = Tb.diep - (i + 0.5) * tredeD, h = (i + 1) * tredeH;
      for (let l = -Tb.lang / 2 + 1.2; l <= Tb.lang / 2 - 1.2 && n < 14; l += 0.52 * (5 + ((n * 7) % 4))) {
        if (Math.abs(l) < 1.4) continue;
        const houder = new THREE.Group();
        houder.position.set(tx(l, d), grondHoogte(tx(l, d), tz(l, d)) + h + 0.265 - 0.46, tz(l, d));
        const p = new Persoon({ shirt: PUBLIEK[n % PUBLIEK.length], broek: 0x24303f, huid: HUID[n % HUID.length], haar: HAAR[(n * 2) % HAAR.length],
          hoogte: 0.95 + (n % 4) * 0.02, pet: n % 5 === 2 });
        houder.add(p.groep);
        groep.add(houder);
        const kijk = Math.atan2(-(V.cx - houder.position.x), -(V.cz - houder.position.z));
        p.groep.rotation.y = p.yaw = kijk;
        publiek.push({ p, houder, zit: true, juich: 0, neer: false, omT: 0, vlucht: null });
        n++;
      }
    }
  }
  // langs de lijn aan de overkant van de tribune, achter het hek
  const overkant = Tb ? -Tb.kant : 1;
  for (let i = 0; i < 6; i++) {
    const u = -hl * 0.55 + i * hl * 0.22, v = overkant * (hb + 2.4);
    const p = new Persoon({ shirt: PUBLIEK[(i + 4) % PUBLIEK.length], broek: 0x2a2c30, huid: HUID[(i + 2) % HUID.length], haar: HAAR[i % HAAR.length],
      hoogte: 0.96 + (i % 3) * 0.02, pet: i % 3 === 0 });
    p.zetNeer(wx(u, v), wz(u, v), yawUV(0, -overkant));
    groep.add(p.groep);
    publiek.push({ p, houder: null, zit: false, juich: 0, neer: false, omT: 0, vlucht: null, u, v });
  }

  // ---- de bal ----
  const balMat = new THREE.MeshStandardMaterial({ map: balDoek(), roughness: 0.55 });
  const balMesh = new THREE.Mesh(new THREE.SphereGeometry(BAL_R, 14, 10), balMat);
  balMesh.castShadow = true;
  groep.add(balMesh);
  const bal = { u: 0, v: 0, h: BAL_R, vu: 0, vv: 0, vh: 0, laatste: 0, inHanden: null, vasthoudT: 0 };

  const st = { aanwezig: false, gestaakt: false, gestaaktT: 0, stand: [0, 0], pauzeT: 0, aftrap: 0, dag: -1, gezien: false,
    doelpunten: 0, schoten: 0, passes: 0, uit: 0, slachtoffers: [] };

  // ---- opstellen en aftrappen ----
  function opstelling(s) {
    const r = s.team === 0 ? 1 : -1;
    const [fu, fv] = OPSTELLING[s.nr];
    return { u: r * fu * hl, v: r * fv * hb };
  }
  function stelOp(team = 0) {
    for (const s of spelers) {
      const o = opstelling(s);
      s.u = o.u * (s.keeper ? 1 : 0.9); s.v = o.v; s.schopT = 0;
      s.yaw = yawUV(s.team === 0 ? 1 : -1, 0);
    }
    // wie aftrapt staat bij de middenstip
    const trapper = spelers.find(s => s.team === team && s.nr === 9);
    trapper.u = team === 0 ? -0.6 : 0.6; trapper.v = 0;
    bal.u = 0; bal.v = 0; bal.h = BAL_R; bal.vu = bal.vv = bal.vh = 0; bal.inHanden = null;
    scheids.u = 0; scheids.v = hb * 0.35;
  }
  function begin() {
    st.aanwezig = true; st.gestaakt = false; st.stand = [0, 0]; st.pauzeT = 1.5;
    st.slachtoffers = [];
    for (const s of [...spelers, scheids, ...publiek]) {
      s.neer = false; s.omT = 0; s.vlucht = null; s.juich = 0;
      s.p.groep.visible = true; s.p.legNeer(0);
    }
    stelOp(Math.random() < 0.5 ? 0 : 1);
    plaatsAlles(0);
    groep.visible = true;
  }
  function weg() {
    st.aanwezig = false; st.gestaakt = false;
    groep.visible = false;
  }

  // ---- de bal raken ----
  function schop(s, doelU, doelV, snel, hoog = 0) {
    const du = doelU - bal.u, dv = doelV - bal.v, d = Math.hypot(du, dv) || 1;
    bal.vu = du / d * snel; bal.vv = dv / d * snel; bal.vh = hoog;
    bal.h = Math.max(bal.h, BAL_R + 0.02);
    bal.laatste = s.team; bal.inHanden = null;
    s.schopT = 0.7;
  }
  function beslis(s) {
    const r = s.team === 0 ? 1 : -1;            // speelrichting
    const doelU = r * hl;
    const dDoel = Math.hypot(doelU - bal.u, bal.v);
    if (dDoel < WEDSTRIJD.schietAfstand && !s.keeper) {
      st.schoten++;
      // op het doel, met een afwijking: niet elk schot is raak
      // (gemeten: met 3,2 halve doelbreedtes en een keeper die 60 % pakt vielen er 7 in tien minuten)
      const naast = (Math.random() - 0.5) * DOEL_HALF * 4.4;
      schop(s, doelU + r * 2, naast, 19 + Math.random() * 6, 1 + Math.random() * 4);
      return;
    }
    // een ploeggenoot verder naar voren
    const maats = spelers.filter(m => m.team === s.team && m !== s && !m.neer && (m.u - s.u) * r > 3)
      .sort((a, b) => Math.hypot(a.u - s.u, a.v - s.v) - Math.hypot(b.u - s.u, b.v - s.v)).slice(0, 3);
    if (maats.length && (Math.random() < 0.72 || s.keeper)) {
      const m = maats[Math.floor(Math.random() * maats.length)];
      const d = Math.hypot(m.u - s.u, m.v - s.v);
      // een beetje voor hem uit, en ver weg met een boogbal
      const lang = d > 26;
      st.passes++;
      schop(s, m.u + r * 2, m.v, Math.min(21, 6 + d * (lang ? 0.55 : 0.8)), lang ? 6 + Math.random() * 2 : 0);
      return;
    }
    // dribbelen: een tikje vooruit
    schop(s, bal.u + r * 6, bal.v + (Math.random() - 0.5) * 4, 6.5, 0);
  }

  // ---- uit, en doelpunten ----
  function balUit() {
    if (Math.abs(bal.v) > hb + 0.3) {
      // inworp: vanaf de lijn, de andere ploeg
      st.uit++;
      bal.v = Math.sign(bal.v) * (hb - 0.5); bal.vu = bal.vv = bal.vh = 0; bal.h = BAL_R;
      bal.laatste = 1 - bal.laatste;
      st.pauzeT = 1.2;
      geluid.fluit && geluid.fluit(afstandSpeler(), false);
      return;
    }
    if (Math.abs(bal.u) > hl + 0.2) {
      const kant = Math.sign(bal.u);
      if (Math.abs(bal.v) < DOEL_HALF && bal.h < LAT) {
        // doelpunt: wie op dit doel speelt (team 0 speelt naar +u)
        const scoort = kant > 0 ? 0 : 1;
        st.stand[scoort]++; st.doelpunten++;
        for (const s of spelers) if (s.team === scoort) s.juich = 3;
        for (const p of publiek) p.juich = 3;
        geluid.juich && geluid.juich(afstandSpeler());
        geluid.fluit && geluid.fluit(afstandSpeler(), true);
        st.pauzeT = 4; st.aftrap = 1 - scoort;
        bal.vu *= 0.2; bal.vv *= 0.2;
        st.naDoel = true;
        return;
      }
      // doeltrap: de keeper van die kant
      st.uit++;
      bal.u = kant * (hl - 5.5); bal.v = 0; bal.h = BAL_R; bal.vu = bal.vv = bal.vh = 0;
      bal.laatste = kant > 0 ? 1 : 0;
      st.pauzeT = 1.5;
    }
  }
  let spelerPos = { x: 0, z: 0 };
  const afstandSpeler = () => Math.hypot(wx(bal.u, bal.v) - spelerPos.x, wz(bal.u, bal.v) - spelerPos.z);

  // ---- een beeld van het spel ----
  function speel(dt) {
    if (st.pauzeT > 0) {
      st.pauzeT -= dt;
      if (st.pauzeT <= 0 && st.naDoel) { st.naDoel = false; stelOp(st.aftrap); st.pauzeT = 1.6; }
    }
    // de bal
    if (bal.inHanden) {
      const k = bal.inHanden;
      bal.u = k.u + (k.team === 0 ? 0.5 : -0.5); bal.v = k.v; bal.h = 1.1; bal.vu = bal.vv = bal.vh = 0;
      bal.vasthoudT -= dt;
      if (bal.vasthoudT <= 0) {
        bal.inHanden = null; beslis(k);
        bal.vh = Math.max(bal.vh, 5);
      }
    } else {
      bal.u += bal.vu * dt; bal.v += bal.vv * dt; bal.h += bal.vh * dt;
      if (bal.h > BAL_R) bal.vh -= ZWAAR * dt;
      if (bal.h <= BAL_R) {
        bal.h = BAL_R;
        if (bal.vh < -1.5) bal.vh = -bal.vh * 0.45; else bal.vh = 0;
        const f = Math.exp(-dt * 0.85);
        bal.vu *= f; bal.vv *= f;
      } else {
        const f = Math.exp(-dt * 0.12);
        bal.vu *= f; bal.vv *= f;
      }
      // (niet tijdens de pauze na een doelpunt: dan telde hetzelfde doelpunt elk beeld opnieuw)
      if (st.pauzeT <= 0 && !st.naDoel) balUit();
      // na een doelpunt blijft hij in het net liggen (anders rolde hij negen meter door)
      if (st.naDoel && Math.abs(bal.u) > hl + 1.4) { bal.u = Math.sign(bal.u) * (hl + 1.4); bal.vu = 0; bal.vv *= 0.3; }
    }
    // wie gaat er op af: per ploeg de dichtstbijzijnde die niet ligt
    const jagers = [0, 1].map(t => {
      let best = null, bd = Infinity;
      for (const s of spelers) {
        if (s.team !== t || s.keeper || s.neer) continue;
        const d = Math.hypot(s.u - bal.u, s.v - bal.v);
        if (d < bd) { bd = d; best = s; }
      }
      return best;
    });
    for (const s of spelers) {
      if (s.neer) continue;
      s.schopT = Math.max(0, s.schopT - dt);
      s.juich = Math.max(0, s.juich - dt);
      const r = s.team === 0 ? 1 : -1;
      let doelU, doelV, snel;
      if (s.keeper) {
        // op de lijn, met de bal mee schuivend; komt hij dichtbij, dan eropaf
        const lijn = -r * (hl - 1.5);
        const dBal = Math.hypot(bal.u - lijn, bal.v);
        if (dBal < 9 && !bal.inHanden && st.pauzeT <= 0) { doelU = bal.u; doelV = bal.v; snel = WEDSTRIJD.ren; }
        else { doelU = lijn; doelV = Math.max(-2.8, Math.min(2.8, bal.v * 0.25)); snel = WEDSTRIJD.draf; }
      } else if (s === jagers[s.team] && st.pauzeT <= 0 && !st.naDoel && !bal.inHanden) {
        doelU = bal.u - r * 0.35; doelV = bal.v; snel = WEDSTRIJD.ren;
      } else {
        const o = opstelling(s);
        doelU = o.u + Math.max(-hl * 0.35, Math.min(hl * 0.35, bal.u * 0.45)) + (s.team === bal.laatste ? r * hl * 0.08 : 0);
        doelV = o.v + bal.v * 0.22;
        snel = WEDSTRIJD.draf;
      }
      if (st.naDoel) { const o = opstelling(s); doelU = o.u * 0.9; doelV = o.v; snel = WEDSTRIJD.draf * 0.8; }
      const du = doelU - s.u, dv = doelV - s.v, d = Math.hypot(du, dv);
      const stap = Math.min(d, snel * dt);
      s.loopt = d > 0.25;
      s.snelheid = snel;
      if (s.loopt) { s.u += du / d * stap; s.v += dv / d * stap; s.yaw = yawUV(du, dv); }
      else s.yaw = yawUV(bal.u - s.u, bal.v - s.v);
      // de bal raken
      const dBal = Math.hypot(s.u - bal.u, s.v - bal.v);
      if (dBal < WEDSTRIJD.bereik && bal.h < (s.keeper ? 2.2 : 0.6) && s.schopT <= 0 && !bal.inHanden && st.pauzeT <= 0 && !st.naDoel) {
        // een hard schot pakt de keeper niet altijd (KEEPER_PAKT)
        if (s.keeper && Math.hypot(bal.vu, bal.vv) > 12 && Math.random() > KEEPER_PAKT) s.schopT = 1.0;
        else if (s.keeper && Math.abs(bal.u) > hl - 17) { bal.inHanden = s; bal.vasthoudT = 1.4; s.schopT = 1.6; bal.laatste = s.team; }
        else beslis(s);
      }
    }
    // de scheidsrechter: op een afstand mee met de bal
    {
      const du = bal.u - scheids.u, dv = (bal.v + hb * 0.3) - scheids.v, d = Math.hypot(du, dv);
      const wil = Math.max(0, d - 10);
      const stap = Math.min(wil, WEDSTRIJD.draf * 1.1 * dt);
      scheids.loopt = wil > 0.3;
      if (scheids.loopt) { scheids.u += du / d * stap; scheids.v += dv / d * stap; }
      scheids.yaw = yawUV(bal.u - scheids.u, bal.v - scheids.v);
    }
  }

  // ---- gestaakt: iedereen rent weg van de plek ----
  function vlucht(s, dt, van) {
    if (!s.vlucht) {
      const x = s.p.groep.parent === groep ? s.p.groep.position.x : (s.houder ? s.houder.position.x : s.p.groep.position.x);
      const z = s.p.groep.parent === groep ? s.p.groep.position.z : (s.houder ? s.houder.position.z : s.p.groep.position.z);
      let dx = x - van.x, dz = z - van.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
      s.vlucht = { x: x + dx * 60, z: z + dz * 60 };
      if (s.houder) {
        // van de tribune af: de houder op de grond, de persoon los erin
        s.houder.position.y = grondHoogte(s.houder.position.x, s.houder.position.z);
        s.zit = false;
      }
    }
    return s.vlucht;
  }

  // ---- alles op zijn plek zetten en bewegen ----
  function plaatsAlles(dt, dichtbij = true) {
    for (const s of [...spelers, scheids]) {
      const p = s.p;
      if (s.neer) {
        if (s.omT < 1) { s.omT = Math.min(1, s.omT + dt * 2); p.legNeer(s.omT); }
        continue;
      }
      if (s.vlucht) {
        const pos = p.groep.position, dx = s.vlucht.x - pos.x, dz = s.vlucht.z - pos.z, d = Math.hypot(dx, dz);
        const stap = Math.min(d, 5.5 * dt);
        if (d > 0.3) { pos.x += dx / d * stap; pos.z += dz / d * stap; p.draaiNaar(Math.atan2(-dx, -dz), dt, 8); }
        if (dichtbij) p.update(dt, { loopt: d > 0.3, snelheid: 5.5 });
        continue;
      }
      p.groep.position.x = wx(s.u, s.v); p.groep.position.z = wz(s.u, s.v);
      p.yaw = s.yaw; p.groep.rotation.y = s.yaw;
      if (dichtbij) {
        p.update(dt, { loopt: !!s.loopt, snelheid: s.snelheid || WEDSTRIJD.draf, zwaait: s.juich > 0 && !s.loopt });
        if (s.juich > 0) { p.armLinks.boven.rotation.z = 2.5; p.armRechts.boven.rotation.z = -2.5; }
        else { p.armLinks.boven.rotation.z = 0; }
      }
    }
    for (const s of publiek) {
      const p = s.p;
      if (s.neer) {
        if (s.omT < 1) { s.omT = Math.min(1, s.omT + dt * 2); p.legNeer(s.omT); }
        continue;
      }
      s.juich = Math.max(0, s.juich - dt);
      if (s.vlucht) {
        // (een toeschouwer van de tribune loopt in zijn houder; die schuift mee)
        const pos = s.houder ? s.houder.position : p.groep.position;
        const dx = s.vlucht.x - pos.x, dz = s.vlucht.z - pos.z, d = Math.hypot(dx, dz);
        const stap = Math.min(d, 5 * dt);
        if (d > 0.3) { pos.x += dx / d * stap; pos.z += dz / d * stap; p.draaiNaar(Math.atan2(-dx, -dz), dt, 8); }
        if (dichtbij) p.update(dt, { loopt: d > 0.3, snelheid: 5 });
        if (s.houder) { p.groep.position.x = 0; p.groep.position.z = 0; s.houder.position.y = grondHoogte(pos.x, pos.z); p.groep.position.y = Math.min(0.2, Math.max(-0.2, p.groep.position.y)); }
        continue;
      }
      if (!dichtbij) continue;
      // kijken naar de bal
      const bx = wx(bal.u, bal.v), bz = wz(bal.u, bal.v);
      const hx = s.houder ? s.houder.position.x : p.groep.position.x, hz = s.houder ? s.houder.position.z : p.groep.position.z;
      p.draaiNaar(Math.atan2(-(bx - hx), -(bz - hz)), dt, 1.5);
      p.update(dt, { zit: s.zit && s.juich <= 0 ? 0.46 : 0, zwaait: s.juich > 0 });
      if (s.juich > 0) { p.armLinks.boven.rotation.z = 2.4; p.armRechts.boven.rotation.z = -2.4; }
      if (s.houder) { p.groep.position.x = 0; p.groep.position.z = 0; p.groep.position.y = Math.min(0.2, Math.max(-0.2, p.groep.position.y)); }
    }
    balMesh.position.set(wx(bal.u, bal.v), grondY + bal.h, wz(bal.u, bal.v));
    const sp = Math.hypot(bal.vu, bal.vv);
    if (sp > 0.05) { balMesh.rotation.x += sp * dt / BAL_R * 0.6; balMesh.rotation.y = yawUV(bal.vu, bal.vv); }
  }

  // ---- iemand gaat neer: de wedstrijd is gestaakt ----
  function valt(s, x, z, hoe) {
    if (s.neer) return false;
    s.neer = true; s.omT = 0; s.vlucht = null;
    st.slachtoffers.push({ x, z, hoe, persoon: s.p });
    if (!st.gestaakt) {
      st.gestaakt = true; st.gestaaktT = 0;
      geluid.fluit && geluid.fluit(Math.hypot(x - spelerPos.x, z - spelerPos.z), true);
      bal.vu *= 0.3; bal.vv *= 0.3;
    }
    for (const a of [...spelers, scheids, ...publiek]) if (!a.neer) vlucht(a, 0, { x, z });
    return true;
  }
  const allen = () => [...spelers, scheids, ...publiek];
  function wieIs(obj) {
    for (let o = obj; o; o = o.parent) {
      const s = allen().find(a => a.p.groep === o);
      if (s) return s;
    }
    return null;
  }

  // ---- zie je het veld? ----
  const frustum = new THREE.Frustum(), pm = new THREE.Matrix4();
  const bol = new THREE.Sphere(new THREE.Vector3(V.cx, grondY + 2, V.cz), Math.hypot(hl + 12, hb + 12));
  function zieJe(camera, x, z) {
    const d = Math.hypot(V.cx - x, V.cz - z);
    if (d > WEDSTRIJD.zicht + bol.radius) return false;
    if (!camera) return d < WEDSTRIJD.zicht;
    camera.updateMatrixWorld();
    pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(pm);
    return frustum.intersectsSphere(bol);
  }

  return {
    groep, veld: V, bal, spelers, scheids, publiek, st, naarUV, wx, wz,
    get aanwezig() { return st.aanwezig; },
    get gestaakt() { return st.gestaakt; },
    get stand() { return st.stand.slice(); },
    get slachtoffers() { return st.slachtoffers; },
    get balWereld() { return { x: wx(bal.u, bal.v), y: grondY + bal.h, z: wz(bal.u, bal.v) }; },
    /*
     Eén beeld. `uur` is de klok (js/sfeer.js), `dag` telt de dagen (een nieuwe dag mag weer een
     wedstrijd), `camera` om te weten of je het veld ziet, `x, z` waar de speler is.
    */
    update(dt, { uur, dag = 0, camera = null, x = 0, z = 0 } = {}) {
      spelerPos = { x, z };
      const tijd = uur >= WEDSTRIJD.van && uur < WEDSTRIJD.tot;
      const gezien = st.aanwezig ? zieJe(camera, x, z) && groep.visible : zieJe(camera, x, z);
      st.gezien = gezien;
      // komen en gaan, alleen als je het niet ziet
      if (!gezien) {
        if (tijd && !st.aanwezig && st.dag !== dag) { st.dag = dag; begin(); }
        // gestaakt: pas opruimen na een poos of als je ver weg bent, anders verdwenen de slachtoffers
        // al als je even wegkeek (en had de ambulance niets meer te doen)
        else if (st.aanwezig && (!tijd || (st.gestaakt && (st.gestaaktT > GESTAAKT_T || Math.hypot(V.cx - x, V.cz - z) > WEDSTRIJD.zicht)))) weg();
      }
      if (st.gestaakt) st.gestaaktT += dt;
      if (!st.aanwezig) return;
      const d = Math.hypot(V.cx - x, V.cz - z);
      const dichtbij = d < WEDSTRIJD.teken;
      groep.visible = dichtbij || st.gestaakt;
      if (!dichtbij) return;
      if (!st.gestaakt) speel(dt);
      plaatsAlles(dt, true);
    },
    // een auto die over het veld rijdt: wie hij raakt gaat neer (geeft het aantal)
    aanrijden(x, z, straal = WEDSTRIJD.aanrijR, snelheid = 0) {
      if (!st.aanwezig || snelheid < WEDSTRIJD.aanrijV) return 0;
      if (Math.hypot(V.cx - x, V.cz - z) > Math.hypot(hl, hb) + 30) return 0;
      let n = 0;
      for (const s of allen()) {
        if (s.neer) continue;
        const q = s.houder ? s.houder.position : s.p.groep.position;
        if (Math.hypot(q.x - x, q.z - z) < straal) { if (valt(s, q.x, q.z, 'aangereden')) n++; }
      }
      return n;
    },
    // de kogel van de speler (js/main.js)
    doelen() { return st.aanwezig && groep.visible ? allen().filter(s => !s.neer).map(s => s.p.groep) : []; },
    raak(obj) {
      if (!st.aanwezig) return false;
      const s = wieIs(obj);
      if (!s || s.neer) return false;
      const q = s.houder ? s.houder.position : s.p.groep.position;
      return valt(s, q.x, q.z, 'neergeschoten');
    },
    // de ambulance (js/ambulance.js): wie er lag staat op en loopt het veld af
    herstel(persoon) {
      const s = allen().find(a => a.p === persoon);
      if (!s || !s.neer) return false;
      s.neer = false; s.omT = 0; s.p.legNeer(0);
      s.vlucht = null;
      const q = s.houder ? s.houder.position : s.p.groep.position;
      vlucht(s, 0, { x: V.cx, z: V.cz });
      st.slachtoffers = st.slachtoffers.filter(o => o.persoon !== persoon);
      return { x: q.x, z: q.z };
    },
    // voor de proeven
    begin, weg, stelOp, schop: (snelU, snelV) => { bal.vu = snelU; bal.vv = snelV; },
  };
}

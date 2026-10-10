/*
 Tennis als minispel, op het tennispark aan de Molenkrite (gevraagd: "tennis
 toevoegen als mini spel").

 De banen zelf staan er al (js/tennis.js); hier komt het potje. Aan het hek van
 elke baan, achter een achterlijn, ligt een plek: E zet je binnen op die
 achterlijn, met aan de overkant een tegenstander in het wit. De camera blijft
 de jouwe. Je loopt met de gewone toetsen, maar alleen langs de achterlijn: wat
 je vooruit of opzij loopt wordt na `player.update` teruggelegd op de baan
 (`update` projecteert `player.pos`). Met `invoer.links` / `invoer.rechts` kan
 de hoofdlus (of een proef) je ook zelf opzij schuiven.

 De bal is een gele bol die in bogen heen en weer gaat. Hij komt over het net,
 stuit, en komt dan op je af; het moment dat hij bij je racket is (`tc`) staat
 vast zodra hij geslagen is. E of de linkermuisknop slaat: binnen `TENNIS.venster`
 van dat moment gaat hij terug, en hoe vroeg of laat je was bepaalt waarheen —
 vroeg trekt hem naar links, laat naar rechts, precies op tijd (`TENNIS.mooi`)
 gaat hij diep en hard. Te vroeg, te laat of te ver weg is het punt voor hem.
 De tegenstander loopt naar de bal en mist soms; die kans groeit met de rally.

 Telling: één game, 15-30-40, met deuce en voordeel. Winst € 50 (`TENNIS.prijs`).
 X (via `afbreken`) of weglopen naar het hek breekt af.

 Rekenen gaat in de assen van de baan zoals de speler hem ziet: `s` van jouw
 achterlijn (s = −11,9) over het net (s = 0) naar de zijne, `u` positief naar
 jouw rechterhand. `wereld(s, u)` legt dat in de kaart, via `baanAssen` uit
 js/tennis.js.

 Alle meshes en materialen worden bij het opstarten gemaakt en verborgen in de
 scene gehangen, zodat `soortenVoorbereid` (js/world.js) hun shaders achter het
 laadscherm vertaalt. Er komt geen lichtbron bij.
*/
import * as THREE from 'three';
import { baanAssen, BAAN } from './tennis.js';
import { Persoon } from './persoon.js';

export const TENNIS = {
  prijs: 50,
  plekAfstand: 2.2,      // zo dicht bij de plek aan het hek werkt E
  achter: 12.6,          // waar je staat: iets achter de achterlijn (11,885)
  venster: 0.30,         // s: zoveel te vroeg of te laat raak je hem nog
  mooi: 0.10,            // s: binnen dit stuk is het een mooie slag (diep en hard)
  bereik: 1.5,           // m: zo ver opzij reikt je racket
  straal: 0.09,          // de bal is groter dan echt (3,3 cm): op 20 m was hij drie beeldpunten
  vloer: 0.135,          // de baanvloer uit js/tennis.js
  pauze: 1.4,            // s tussen twee punten
  loopTegen: 4.4,        // m/s, de tegenstander opzij
  loopSpeler: 4.6,       // m/s met `invoer.links`/`rechts`
};

// ---------- de doeken ----------

// de snaren van een racket: een raster op een canvas, met doorzicht
function snarenDoek() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 64, 64);
  g.strokeStyle = 'rgba(236,236,226,0.95)'; g.lineWidth = 1.4;
  for (let i = 3; i < 64; i += 6) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 64); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(64, i); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// de bal: geel-groen vilt met de witte naad eroverheen
function balDoek() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#d8e83a'; g.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,200,0.18)' : 'rgba(120,140,20,0.16)';
    g.fillRect(Math.random() * 128, Math.random() * 64, 1.5, 1.5);
  }
  g.strokeStyle = '#f6f6ee'; g.lineWidth = 3;
  g.beginPath();
  for (let x = 0; x <= 128; x += 2) {
    const y = 32 + Math.sin((x / 128) * Math.PI * 4) * 16;
    if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// een racket: greep, steel en een ovaal blad, hangend langs -y vanuit de hand
function maakRacket(M) {
  const r = new THREE.Group();
  const greep = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.014, 0.20, 8), M.greep);
  greep.position.y = -0.08;
  r.add(greep);
  const steel = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.14, 6), M.frame);
  steel.position.y = -0.24;
  r.add(steel);
  const rand = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.011, 6, 24), M.frame);
  rand.scale.set(0.82, 1.1, 1);
  rand.position.y = -0.44;
  rand.rotation.y = Math.PI / 2;      // het blad in het vlak van de arm, zoals je hem vasthoudt
  r.add(rand);
  const blad = new THREE.Mesh(new THREE.CircleGeometry(0.122, 20), M.snaren);
  blad.scale.set(0.82, 1.1, 1);
  blad.position.y = -0.44;
  blad.rotation.y = Math.PI / 2;
  r.add(blad);
  return r;
}

export function initTennisspel({ scene, KAART, player, hud, geluid, verdien = null, vrij = null, tik = null } = {}) {
  const banen = baanAssen(KAART && KAART.tennisparken);

  /*
   De plek per baan: buiten het hek, op de as van de baan, aan het eind dat niet
   tegen een ander blok aan ligt (de blokken liggen op het park tegen elkaar).
  */
  const blokken = banen.map(b => b.blok).filter((b, i, a) => a.indexOf(b) === i);
  function inBlok(x, z, marge = 1.0) {   // ook niet in de smalle gang tussen twee hekken
    for (const blok of blokken) {
      const l = Math.hypot(blok.as[0], blok.as[1]);
      const a0 = blok.as[0] / l, a1 = blok.as[1] / l;
      const dx = x - blok.cx, dz = z - blok.cz;
      const s = dx * a0 + dz * a1, u = dx * -a1 + dz * a0;
      if (Math.abs(s) < blok.lengte / 2 + marge && Math.abs(u) < blok.breedte / 2 + marge) return true;
    }
    return false;
  }
  const plekken = [];
  for (const baan of banen) {
    for (const k of [-1, 1]) {
      const p = baan.punt(k * (baan.L / 2 + 1.3), 0);
      if (inBlok(p.x, p.z)) continue;
      // k is de kant van de speler; m zet de assen van de speler om naar die van de baan
      const m = -k;
      const kijk = { x: -k * baan.as[0], z: -k * baan.as[1] };     // van de plek naar de baan
      plekken.push({ x: p.x, z: p.z, yaw: Math.atan2(-kijk.x, -kijk.z), baan, m });
      break;
    }
  }

  // ---------- de dingen in de scene, verborgen tot er gespeeld wordt ----------
  const M = {
    bal: new THREE.MeshStandardMaterial({ map: balDoek(), roughness: 0.95 }),
    schaduw: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }),
    frame: new THREE.MeshStandardMaterial({ color: 0x1f2a44, roughness: 0.45, metalness: 0.3 }),
    greep: new THREE.MeshStandardMaterial({ color: 0xece8dc, roughness: 0.85 }),
    snaren: new THREE.MeshStandardMaterial({ map: snarenDoek(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.8 }),
  };
  const bal = new THREE.Mesh(new THREE.SphereGeometry(TENNIS.straal, 14, 10), M.bal);
  bal.visible = false;
  scene.add(bal);
  const balSchaduw = new THREE.Mesh(new THREE.CircleGeometry(TENNIS.straal * 1.3, 14), M.schaduw);
  balSchaduw.rotation.x = -Math.PI / 2;
  balSchaduw.renderOrder = 1;
  balSchaduw.visible = false;
  scene.add(balSchaduw);

  const tegen = new Persoon({ shirt: 0xf2f2ec, broek: 0xf0f0ea, huid: 0xd2a27c, haar: 0x3a2616,
    korteMouw: true, pet: true, petKleur: 0xf4f4f0, schoen: 0xe8e8e2 });
  tegen.armRechts.eind.add(maakRacket(M));
  tegen.groep.visible = false;
  scene.add(tegen.groep);

  // ---------- het balkje: stand, het tijdsmetertje en de toetsen ----------
  const balk = document.createElement('div');
  balk.id = 'tennisbalk';
  balk.style.cssText = 'position:absolute;top:66px;left:50%;transform:translateX(-50%);min-width:240px;'
    + 'padding:8px 14px;border-radius:8px;background:rgba(10,14,18,0.72);color:#fff;font:700 13px system-ui,sans-serif;'
    + 'text-align:center;pointer-events:none;display:none;';
  balk.innerHTML = '<div class="stand" style="font-size:15px"></div>'
    + '<div class="meter" style="position:relative;height:10px;margin:7px 0 5px;border-radius:5px;background:rgba(255,255,255,0.16)">'
    + '<div style="position:absolute;top:0;bottom:0;border-radius:5px;background:rgba(120,220,120,0.45)" class="zone"></div>'
    + '<div style="position:absolute;top:0;bottom:0;border-radius:5px;background:rgba(150,255,140,0.9)" class="mooi"></div>'
    + '<div style="position:absolute;top:-4px;width:4px;height:18px;margin-left:-2px;background:#f4e04a;border-radius:2px" class="wijzer"></div></div>'
    + '<div class="hint" style="font-weight:400;font-size:11px;opacity:0.85"></div>';
  (document.getElementById('ui') || document.body).appendChild(balk);
  const standEl = balk.querySelector('.stand'), meterEl = balk.querySelector('.meter');
  const wijzerEl = balk.querySelector('.wijzer'), hintEl = balk.querySelector('.hint');
  {
    // de meter loopt over drie keer het venster; het groene stuk is het venster zelf
    const zone = (TENNIS.venster / (TENNIS.venster * 3)) * 50, mooi = (TENNIS.mooi / (TENNIS.venster * 3)) * 50;
    const z = balk.querySelector('.zone'), m = balk.querySelector('.mooi');
    z.style.left = `${50 - zone}%`; z.style.width = `${zone * 2}%`;
    m.style.left = `${50 - mooi}%`; m.style.width = `${mooi * 2}%`;
  }

  // ---------- de stand van het spel ----------
  let bezig = false;
  let plek = null;            // de plek waar je begon (en weer neergezet wordt)
  let fase = 'uit';           // 'pauze' · 'opslag' (jij slaat op) · 'rally' · 'uitrol' (punt beslist, bal rolt uit)
  let faseT = 0;
  let punten = [0, 0];        // [jij, hij]
  let opslagJij = false;      // wie slaat dit punt op
  let rally = 0;
  let tegenU = 0;             // waar de tegenstander opzij staat
  let slaatT = -1;            // de slagbeweging van de tegenstander (0..1), -1 = niet
  let hintT = 0;
  let laatste = null;         // de laatste melding (voor proeven)
  let was = null;             // wat we van de speler aanpasten, om terug te zetten
  /*
   De bal in de lucht. Been 1: van de slag naar de stuit (`T1`, met een boog `h1`).
   Been 2: van de stuit naar het raakvlak van wie hem moet terugslaan (`T2`, boog
   `h2`). Daarna (niemand raakt hem) rolt hij gewoon door. `tc` = T1 + T2: het
   moment dat hij bij het racket is.
  */
  let b = null;

  const wereld = (s, u) => plek.baan.punt(plek.m * s, plek.m * u);
  function spelerSU() {
    const baan = plek.baan;
    const dx = player.pos.x - baan.blok.cx, dz = player.pos.z - baan.blok.cz;
    const s = dx * baan.as[0] + dz * baan.as[1];
    const u = dx * baan.zij[0] + dz * baan.zij[1] - baan.u0;
    return { s: plek.m * s, u: plek.m * u };
  }

  function klink(soort) {
    if (typeof tik === 'function') { tik(soort); return; }
    if (!geluid) return;
    try {
      if (soort === 'slag' && geluid.sprong) geluid.sprong();
      else if (soort === 'stuit' && geluid.magazijnKnop) geluid.magazijnKnop();
      else if (soort === 'winst' && geluid.juich) geluid.juich(8);
    } catch { /* geen geluid: dan maar stil */ }
  }

  function tekstStand() {
    const [a, h] = punten;
    const T = ['0', '15', '30', '40'];
    if (a >= 3 && h >= 3) {
      if (a === h) return 'Deuce';
      return a > h ? 'Voordeel jij' : 'Voordeel hem';
    }
    return `Jij ${T[Math.min(3, a)]} — ${T[Math.min(3, h)]} Hij`;
  }
  function gewonnenDoor() {
    const [a, h] = punten;
    if (a >= 4 && a - h >= 2) return 'jij';
    if (h >= 4 && h - a >= 2) return 'hij';
    return null;
  }
  function zetBalk() {
    standEl.textContent = tekstStand();
    const opslag = fase === 'opslag';
    hintEl.textContent = opslag ? 'E of klik: opslaan · X: stoppen'
      : 'E of klik op het moment dat de bal bij je is · X: stoppen';
  }

  /*
   Een slag: van `van` (s, u, y) naar de stuit (s, u), in `T1` seconden. De boog
   wordt hoog genoeg gemaakt om 20 cm over het net te gaan.
  */
  function slagNaar(van, naar, T1, { naarSpeler, h1 = 2.0, dood = false } = {}) {
    const yb = TENNIS.vloer + TENNIS.straal;
    const f0 = (0 - van.s) / (naar.s - van.s);
    if (!dood && f0 > 0.05 && f0 < 0.95) {
      const lijn = van.y + (yb - van.y) * f0;
      const nodig = (BAAN.netHoog + 0.2 - lijn) / (4 * f0 * (1 - f0));
      h1 = Math.max(h1, nodig);
    }
    const vs = (naar.s - van.s) / T1, vu = (naar.u - van.u) / T1;
    // na de stuit gaat hij een derde langzamer verder
    const v2s = vs * 0.65, v2u = vu * 0.65;
    let T2 = 0.5, raakS = 0;
    if (!dood) {
      if (naarSpeler) raakS = Math.min(-TENNIS.achter + 0.7, spelerSU().s + 0.7);
      else raakS = TENNIS.achter - 0.7;
      T2 = Math.max(0.18, (raakS - naar.s) / v2s);
    }
    b = { van, naar, T1, T2, tc: T1 + T2, h1, h2: 0.85, vs, vu, v2s, v2u, t: 0, naarSpeler, dood,
      gestuit: false, zwaai: false, beslist: false, s: van.s, u: van.u, y: van.y };
    klink('slag');
  }

  function balStap(dt) {
    if (!b) return;
    b.t += dt;
    const yb = TENNIS.vloer + TENNIS.straal;
    if (b.t <= b.T1) {
      const f = b.t / b.T1;
      b.s = b.van.s + b.vs * b.t;
      b.u = b.van.u + b.vu * b.t;
      b.y = b.van.y + (yb - b.van.y) * f + 4 * b.h1 * f * (1 - f);
    } else {
      if (!b.gestuit) { b.gestuit = true; klink('stuit'); }
      const t2 = b.t - b.T1;
      if (b.dood) {
        // in het net: hij zakt erlangs naar beneden en blijft liggen
        b.y = Math.max(yb, b.y - dt * 2);
      } else {
        b.s = b.naar.s + b.v2s * t2;
        b.u = b.naar.u + b.v2u * t2;
        if (t2 <= b.T2) {
          const f = t2 / b.T2;
          b.y = yb + (1.0 - yb) * f + 4 * b.h2 * f * (1 - f);
        } else {
          // niemand raakte hem: hij valt nog een keer en rolt uit
          const t3 = t2 - b.T2;
          b.y = Math.max(yb, 1.0 + 1.5 * t3 - 6 * t3 * t3);
        }
      }
    }
    const p = wereld(b.s, b.u);
    bal.position.set(p.x, b.y, p.z);
    bal.rotation.x += dt * 9; bal.rotation.z += dt * 5;
    balSchaduw.position.set(p.x, TENNIS.vloer + 0.012, p.z);
    const hoog = Math.max(0, b.y - yb);
    balSchaduw.scale.setScalar(1 + hoog * 0.35);
    M.schaduw.opacity = Math.max(0.08, 0.34 - hoog * 0.06);
  }

  function punt(voor, reden) {
    if (b) b.beslist = true;
    punten[voor === 'jij' ? 0 : 1]++;
    laatste = reden;
    const w = gewonnenDoor();
    if (w) { einde(w); return; }
    if (hud) hud.show(`${reden}  ${tekstStand()}`, 2);
    fase = 'uitrol'; faseT = 0;
    zetBalk();
  }

  function nieuwPunt() {
    b = null;
    rally = 0;
    opslagJij = !opslagJij;
    bal.visible = false; balSchaduw.visible = false;
    fase = opslagJij ? 'opslag' : 'pauze';
    faseT = 0;
    if (opslagJij) {
      // de bal ligt klaar boven je hand
      const sp = spelerSU();
      const p = wereld(sp.s + 0.4, sp.u + 0.35);
      bal.position.set(p.x, 1.35, p.z);
      bal.visible = true;
    }
    zetBalk();
  }

  // de tegenstander slaat op, of slaat terug
  function tegenSlaat(van) {
    rally++;
    const mis = Math.min(0.65, 0.06 + 0.045 * rally + (b && b.mooi ? 0.15 : 0));
    if (b && Math.random() < mis) {
      // in het net
      slagNaar(van, { s: 0.35, u: van.u * 0.6 }, 0.55, { naarSpeler: true, h1: 0.25, dood: true });
      punt('jij', Math.random() < 0.5 ? 'In het net!' : 'Hij mist!');
      return;
    }
    // hij mikt bij voorkeur weg van waar jij staat
    const sp = spelerSU();
    let u = (Math.random() - 0.5) * (BAAN.enkel - 1.4);
    if (Math.abs(u - sp.u) < 1.2 && Math.random() < 0.6) u = -Math.sign(sp.u || 1) * (1.2 + Math.random() * 2.2);
    u = Math.max(-(BAAN.enkel / 2 - 0.5), Math.min(BAAN.enkel / 2 - 0.5, u));
    const s = -(5.2 + Math.random() * 5.0);
    const T1 = Math.max(0.95, 1.5 - 0.035 * rally);
    slagNaar(van, { s, u }, T1, { naarSpeler: true, h1: 1.6 + Math.random() * 1.2 });
  }

  // jij slaat terug; `d` is hoe vroeg (−1) of laat (+1) je was
  function jijSlaat(d) {
    rally++;
    const mooi = Math.abs(d * TENNIS.venster) <= TENNIS.mooi;
    const hb = BAAN.enkel / 2 - 0.45;
    const u = Math.max(-hb, Math.min(hb, d * 3.4 + (Math.random() - 0.5) * 0.8));
    const s = mooi ? 9.0 + Math.random() * 1.8 : 5.5 + Math.random() * 4.0;
    const T1 = Math.max(0.85, (mooi ? 1.2 : 1.45) - 0.03 * rally);
    slagNaar({ s: b.s, u: b.u, y: Math.max(0.6, b.y) }, { s, u }, T1, { naarSpeler: false, h1: mooi ? 1.4 : 2.1 });
    b.mooi = mooi;
    if (hud && mooi) hud.show('Mooi!', 0.9);
  }

  function start(p) {
    plek = p;
    bezig = true;
    punten = [0, 0];
    opslagJij = true;       // nieuwPunt draait het om: hij slaat als eerste op
    rally = 0; slaatT = -1; laatste = null;
    tegenU = 0;
    was = { vuurSlot: player.vuurSlot, wapenUit: player.wapenUit };
    player.vuurSlot = true;      // de klik is een slag, geen schot
    player.wapenUit = true;
    // binnen het hek, op jouw achterlijn, met je gezicht naar het net
    const a = wereld(-TENNIS.achter, 0);
    player.pos.x = a.x; player.pos.z = a.z;
    const net = wereld(0, 0);
    player.yaw = Math.atan2(-(net.x - a.x), -(net.z - a.z));
    player.pitch = -0.06;
    const t = wereld(TENNIS.achter, 0);
    tegen.zetNeer(t.x, t.z, Math.atan2(-(a.x - t.x), -(a.z - t.z)));
    tegen.groep.visible = true;
    balSchaduw.visible = false;
    balk.style.display = 'block';
    nieuwPunt();
    if (hud) hud.show('Tennis: eerste game. Hij slaat op.', 2.5);
  }

  function opruimen() {
    bezig = false;
    fase = 'uit';
    b = null;
    bal.visible = false; balSchaduw.visible = false;
    tegen.groep.visible = false;
    balk.style.display = 'none';
    if (was) { player.vuurSlot = was.vuurSlot; player.wapenUit = was.wapenUit; was = null; }
  }

  // terug naar de plek buiten het hek
  function zetTerug() {
    if (!plek) return;
    player.pos.x = plek.x; player.pos.z = plek.z;
    player.yaw = plek.yaw + Math.PI;
  }

  function einde(wie) {
    laatste = wie === 'jij' ? 'gewonnen' : 'verloren';
    opruimen();
    zetTerug();
    if (wie === 'jij') {
      if (verdien) verdien(TENNIS.prijs);
      else if (window.__game && window.__game.verhaal && window.__game.verhaal.verdien) window.__game.verhaal.verdien(TENNIS.prijs);
      if (hud) hud.melding('GAME, SET, MATCH', `€ ${TENNIS.prijs} — mooi gespeeld`, 4);
      klink('winst');
    } else if (hud) hud.melding('VERLOREN', 'Hij was je te snel af', 3.5);
  }

  function afbreken(reden = 'Gestopt met tennis') {
    if (!bezig) return false;
    laatste = 'afgebroken';
    opruimen();
    zetTerug();
    if (hud) hud.show(reden, 2);
    return true;
  }

  function dichtstePlek() {
    let best = null, bd = TENNIS.plekAfstand;
    for (const p of plekken) {
      const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  function magNu() {
    if (player.inCar || player.binnen || player.zit || player.inDrone) return 'Niet nu.';
    if (typeof vrij === 'function') {
      const v = vrij();
      if (v === false) return 'Niet nu.';
      if (typeof v === 'string') return v;
    }
    return null;
  }

  // ---------- E en de klik ----------
  function slag() {
    if (!bezig) return false;
    if (fase === 'opslag') {
      const sp = spelerSU();
      const u = (sp.u > 0 ? -1 : 1) * (0.6 + Math.random() * 2.6);    // schuin over, in het opslagvak
      slagNaar({ s: sp.s + 0.4, u: sp.u, y: 2.4 }, { s: 3.4 + Math.random() * 2.6, u }, 1.15, { naarSpeler: false, h1: 0.9 });
      rally = 0;
      fase = 'rally'; faseT = 0;
      bal.visible = true; balSchaduw.visible = true;
      zetBalk();
      return true;
    }
    if (fase !== 'rally' || !b || !b.naarSpeler || b.zwaai || b.beslist) return true;   // E is wel van het potje
    b.zwaai = true;
    const verschil = b.t - b.tc;
    if (Math.abs(verschil) > TENNIS.venster) {
      punt('hij', verschil < 0 ? 'Te vroeg!' : 'Te laat!');
      return true;
    }
    // waar is de bal op het moment van raken, en kun je erbij
    const sp = spelerSU();
    if (Math.abs(b.u - sp.u) > TENNIS.bereik) { punt('hij', 'Je kunt er niet bij!'); return true; }
    jijSlaat(verschil / TENNIS.venster);
    return true;
  }

  function toets() {
    if (bezig) return slag();
    const p = dichtstePlek();
    if (!p) return false;
    const nee = magNu();
    if (nee) { if (hud) hud.show(nee, 2); return true; }
    start(p);
    return true;
  }

  // ---------- elk beeld ----------
  function update(dt, invoer = null) {
    if (!bezig) {
      // een hint als je bij een plek aan het hek staat
      hintT -= dt;
      if (hintT <= 0 && hud && plekken.length) {
        hintT = 0.5;
        const p = dichtstePlek();
        if (p && !magNu()) hud.show(`E — een potje tennis (winst € ${TENNIS.prijs})`, 0.7);
      }
      return;
    }
    if (player.inCar || player.binnen || player.health <= 0) { afbreken(); return; }

    // de speler blijft op zijn achterlijn
    const sp = spelerSU();
    let s = sp.s, u = sp.u;
    if (invoer) {
      if (invoer.links) u -= TENNIS.loopSpeler * dt;
      if (invoer.rechts) u += TENNIS.loopSpeler * dt;
    }
    if (s < -TENNIS.achter - 2.8) { afbreken('Weggelopen: gestopt met tennis'); return; }
    s = Math.max(-TENNIS.achter - 3, Math.min(-BAAN.l / 2 + 0.6, s));
    u = Math.max(-(BAAN.b / 2 + 1.2), Math.min(BAAN.b / 2 + 1.2, u));
    const w = wereld(s, u);
    player.pos.x = w.x; player.pos.z = w.z;

    faseT += dt;
    if (fase === 'pauze' && faseT >= TENNIS.pauze) {
      // hij slaat op, schuin over naar jouw opslagvak
      const van = { s: TENNIS.achter, u: tegenU, y: 2.4 };
      const doelU = (tegenU > 0 ? 1 : -1) * (0.6 + Math.random() * 2.6);
      b = null;
      slagNaar(van, { s: -(3.4 + Math.random() * 2.6), u: -doelU }, 1.3, { naarSpeler: true, h1: 0.9 });
      slaatT = 0.35;
      rally = 0;
      fase = 'rally'; faseT = 0;
      bal.visible = true; balSchaduw.visible = true;
      zetBalk();
    } else if (fase === 'uitrol' && faseT >= TENNIS.pauze) {
      nieuwPunt();
    }

    if (b && (fase === 'rally' || fase === 'uitrol')) {
      balStap(dt);
      if (fase === 'rally' && !b.beslist) {
        if (b.naarSpeler && !b.zwaai && b.t > b.tc + TENNIS.venster) punt('hij', 'Gemist!');
        else if (!b.naarSpeler && b.t >= b.tc) {
          // de tegenstander is aan de beurt
          if (Math.abs(b.u - tegenU) > TENNIS.bereik) punt('jij', 'Hij komt er niet bij!');
          else tegenSlaat({ s: b.s, u: b.u, y: Math.max(0.6, b.y) });
        }
      }
    }

    // de tegenstander loopt naar waar de bal straks is, anders terug naar het midden
    let doelU = 0;
    if (b && !b.naarSpeler && !b.beslist && !b.dood) doelU = b.naar.u + b.v2u * b.T2;
    else if (fase === 'pauze') doelU = tegenU;
    const stap = Math.max(-1, Math.min(1, doelU - tegenU)) * (TENNIS.loopTegen + rally * 0.05) * dt;
    const loopt = Math.abs(doelU - tegenU) > 0.05;
    tegenU += Math.abs(stap) > Math.abs(doelU - tegenU) ? doelU - tegenU : stap;
    const tp = wereld(TENNIS.achter, tegenU - 0.35);   // de bal komt rechts van hem, bij het racket
    tegen.groep.position.x = tp.x; tegen.groep.position.z = tp.z;
    const kijk = b && bal.visible ? bal.position : player.pos;
    tegen.kijkNaar(kijk.x, kijk.z, dt, 6);
    // de slagbeweging: begint vlak voor hij hem raakt
    if (b && !b.naarSpeler && !b.beslist && slaatT < 0 && b.tc - b.t < 0.35) slaatT = 0;
    if (slaatT >= 0) { slaatT += dt / 0.55; if (slaatT >= 1) slaatT = -1; }
    tegen.update(dt, { loopt, snelheid: 2.5, slaat: slaatT > 0 ? slaatT : 0 });

    // het metertje: hoe ver is de bal van het goede moment
    if (b && b.naarSpeler && !b.zwaai && !b.beslist && !b.dood) {
      meterEl.style.opacity = '1';
      const x = Math.max(-1, Math.min(1, (b.t - b.tc) / (TENNIS.venster * 3)));
      wijzerEl.style.left = `${50 + x * 50}%`;
    } else meterEl.style.opacity = '0.35';
  }

  return {
    update, toets, slag, afbreken, plekken,
    get bezig() { return bezig; },
    get stand() {
      return { jij: punten[0], hij: punten[1], tekst: tekstStand(), fase, rally, laatste,
        bal: b ? { t: b.t, tc: b.tc, naarSpeler: b.naarSpeler, zwaai: b.zwaai, beslist: b.beslist } : null };
    },
    // voor proeven: hoe lang tot de bal bij je racket is (s), of null
    get totRaak() { return b && b.naarSpeler && !b.zwaai && !b.beslist && !b.dood ? b.tc - b.t : null; },
    // voor proeven: zet de speler opzij precies waar de bal straks bij het racket is
    naarBal() {
      if (!bezig || !b || !b.naarSpeler || b.dood) return false;
      const u = b.naar.u + b.v2u * b.T2;
      const w = wereld(spelerSU().s, u);
      player.pos.x = w.x; player.pos.z = w.z;
      return true;
    },
    tegenstander: tegen,
  };
}

/*
 De bende van De Veteraan op straat (na missie 10).

 Sinds de hinderlaag bij VV Sneek heeft De Veteraan zich tegen je gekeerd, en
 dat merk je in de wijk (verzoek 23 sep 2026). Op willekeurige plekken in Tinga
 en langs de Lemmerweg hangen groepjes van twee tot vier man rond. Kom je te
 dichtbij, dan vallen ze aan; loop je langs, dan komen ze achter je aan, en na
 een tijdje geven ze het op en slenteren ze terug naar hun plek. Een paar hebben
 een pistool en schieten van een meter of tien, de rest heeft een knuppel en
 moet bij je komen om te slaan.

 Waar ze staan komt uit de kaart: punten langs de wegassen van de straten van
 Tinga en de Lemmerweg, op de stoep naast de rijbaan en nooit in een botsdoos of
 in het water. Er staan er nooit meer dan een paar tegelijk, altijd op zestig
 tot tweehonderdveertig meter van je, en nooit waar je net kijkt: een groepje
 dat voor je neus uit het niets verschijnt leest als een fout, een groepje dat er
 staat als je de hoek om komt leest als de buurt.

 Een treffer legt een man neer. Wie een pistool had laat het liggen, met wat
 kogels; wie een knuppel had soms wat geld. Er komen geen sterren van: zij
 begonnen.
*/
import { Persoon } from './persoon.js';
import { KAART } from './kaartwereld.js';
import { resolveCollisions, zichtVrij, pointInWater } from './world.js';
import { geluid } from './audio.js';
import { zoekLooppad } from './looppad.js';

// de straten waar ze rondhangen: de wijk Tinga, en de Lemmerweg erlangs
export const BENDE_STRATEN = [
  'Molenkrite', 'Monnikmolen', 'Kruirad', 'Binnenroede', 'Buitenroede', 'Jasker', 'Molenpaal',
  'Spinnekop', 'Omloop', 'de Wieken', 'Windbord', 'Voorzoom', 'Bovenas', 'Grootwiel', 'Bonkelaar',
  'Eekmolen', 'de Hekken', 'de Ligger', 'de Loper', 'Korte Spruit', 'Koningsspil', 'Zeskanter',
  'Kaar', 'de Kap', 'de Vang', 'Lemmerweg',
];
const STRAAL_WIJK = 1100;        // de Lemmerweg loopt kilometers door: alleen het stuk bij Tinga
const PLEK_STAP = 22;            // om de zoveel meter een mogelijke plek langs een as
const STOEP = 2.6;               // zover naast de rand van de rijbaan
const MAX_GROEPEN = 3;           // zoveel groepjes tegelijk in de buurt
const OPDUIKEN = [60, 240];      // op deze afstand van de speler verschijnt er een
const TUSSEN = 90;               // zo ver liggen twee groepjes minstens uit elkaar
const WEG = 330;                 // verder weg (en uit zicht) verdwijnt een groepje
const ZOEK_T = 2.5;              // om de zoveel tellen kijken of er een groepje bij moet

const TE_DICHT = 13;             // dichterbij dan dit vallen ze aan (te voet)
const TE_DICHT_AUTO = 7;         // in de auto merken ze je pas als je vlak langs komt
const GEHOOR = 40;               // een schot binnen deze afstand hoort het groepje
const REN = 4.6;                 // sneller dan jij loopt (4,2), langzamer dan je sprint (7,5)
const SLENTER = 1.4;
const OPGEVEN = [16, 26];        // na zoveel tellen achter je aan houden ze op
const KWIJT = 30;                // verder weg dan dit ben je ze kwijt ...
const KWIJT_T = 3;               // ... als dat zo lang duurt (sprinten: na een tel of tien)
const EIGEN_STUK = 35;           // zover van hun plek jagen ze door, ook na OPGEVEN
const RUST = 12;                 // na het opgeven vallen ze zo lang niet opnieuw aan

const PISTOOL_KANS = 0.4;        // zoveel van de mannen heeft een pistool
const SCHIET_AF = [8, 15];       // op die afstand blijft een pistool staan
const VUURTIJD = [1.4, 2.2];     // tussen twee schoten
/*
 De schade (verzoek 24 sep 2026: lager). Met 7 per klap en 5 per kogel lag wie
 bleef staan naast een groepje van vier binnen tien tellen, met 4 en 3 na
 negentien. Nu 3 per klap met een langere pauze tussen twee slagen, en 2 per
 kogel: npm run bendetest meet hoelang je het dan uithoudt en eist minstens
 vijfentwintig tellen — genoeg om terug te schieten of weg te rennen als je er
 per ongeluk tegenaan loopt.
*/
const PISTOOL_SCHADE = 2;
const SLAG_BEREIK = 1.7;         // zo dichtbij raakt een knuppel
const SLAG_DUUR = 0.55;          // een slag, van uithalen tot raken
const SLAG_RUST = 1.6;           // en de pauze erna
const SLAG_SCHADE = 3;
const OVER_LAAG = 0.7;           // over lage heggen en borden stappen ze heen
const AANRIJ_V = 5;              // harder dan dit rijd je een man omver

const KLEREN = [                 // trainingspakken en hoodies, geen uniform
  { shirt: 0x1f2226, broek: 0x2a2d33 }, { shirt: 0x6b1f24, broek: 0x1c1c20 },
  { shirt: 0x2d3440, broek: 0x3a3a3f }, { shirt: 0x39433a, broek: 0x202326 },
  { shirt: 0x4a4038, broek: 0x26282d }, { shirt: 0x151619, broek: 0x3b2f28 },
];

const afst = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/*
 ctx = { scene, player, laatVallen, paniek, uitleg }. `laatVallen` en `paniek`
 zijn dezelfde haakjes als bij de bende uit missie 7.
*/
export function initBendes({ scene, player, laatVallen = null, paniek = null, uitleg = null }) {
  const groepen = [];
  let zoekT = 0;
  let plekken = null;            // [{x, z, straat}]
  let gezien = false;            // is de uitleg al getoond?
  let opduiken = true;           // mogen er groepjes bij komen (de proef zet dit uit)

  // ---------- waar ze kunnen staan ----------
  /*
   Staat een punt op een rijbaan? Niet alleen die van de eigen straat: bij een
   kruising ligt de stoep van de ene straat op de rijbaan van de andere (de
   eerste proef: 34 van de 317). Een raster van twintig meter met de stukken
   rijbaan erin, zodat dat niet voor elk punt alle 4351 assen afloopt.
  */
  let baanRaster = null;
  function opRijbaan(x, z, marge = 0.6) {
    const C = 20;
    if (!baanRaster) {
      baanRaster = new Map();
      for (const as of (KAART && KAART.wegassen) || []) {
        if (!as.drive) continue;
        const half = (as.w || 5) / 2;
        for (let i = 1; i < as.pts.length; i++) {
          const a = as.pts[i - 1], b = as.pts[i];
          const st = { a, b, half };
          const i0 = Math.floor((Math.min(a[0], b[0]) - 8) / C), i1 = Math.floor((Math.max(a[0], b[0]) + 8) / C);
          const j0 = Math.floor((Math.min(a[1], b[1]) - 8) / C), j1 = Math.floor((Math.max(a[1], b[1]) + 8) / C);
          for (let ii = i0; ii <= i1; ii++) for (let jj = j0; jj <= j1; jj++) {
            const k = ii * 100003 + jj;
            if (!baanRaster.has(k)) baanRaster.set(k, []);
            baanRaster.get(k).push(st);
          }
        }
      }
    }
    for (const st of baanRaster.get(Math.floor(x / C) * 100003 + Math.floor(z / C)) || []) {
      const dx = st.b[0] - st.a[0], dz = st.b[1] - st.a[1], L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - st.a[0]) * dx + (z - st.a[1]) * dz) / L2));
      if (Math.hypot(st.a[0] + dx * t - x, st.a[1] + dz * t - z) < st.half + marge) return true;
    }
    return false;
  }
  // vrij: geen botsdoos en geen water. Met twee stralen, want twee heggen aan
  // weerskanten duwen bij een grote straal precies even hard terug
  function vrijePlek(x, z) {
    if (pointInWater(x, z)) return false;
    for (const r of [0.4, 1.4]) {
      const [kx, kz] = resolveCollisions(x, z, r);
      if (Math.hypot(kx - x, kz - z) > 0.01) return false;
    }
    return true;
  }

  function maakPlekken() {
    plekken = [];
    for (const as of (KAART && KAART.wegassen) || []) {
      if (!as.drive || !BENDE_STRATEN.includes(as.naam)) continue;
      const opzij = (as.w || 5) / 2 + STOEP;
      let rest = PLEK_STAP / 2;
      for (let i = 1; i < as.pts.length; i++) {
        const a = as.pts[i - 1], b = as.pts[i];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 0.01) continue;
        const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
        for (; rest < L; rest += PLEK_STAP) {
          const mx = a[0] + ux * rest, mz = a[1] + uz * rest;
          if (Math.hypot(mx, mz) > STRAAL_WIJK) continue;
          // om de beurt links en rechts van de rijbaan
          const kant = (plekken.length % 2) ? 1 : -1;
          const x = mx - uz * opzij * kant, z = mz + ux * opzij * kant;
          // ruim genoeg voor een kringetje, en niet op een rijbaan
          if (!vrijePlek(x, z) || opRijbaan(x, z, 1.0)) continue;
          plekken.push({ x, z, straat: as.naam });
        }
        rest -= L;
      }
    }
    return plekken;
  }

  // ---------- een groepje neerzetten ----------
  function zetGroep(plek, n = 2 + Math.floor(Math.random() * 3)) {
    const leden = [];
    for (let i = 0; i < n; i++) {
      const hoek = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const r = 0.9 + Math.random() * 0.4;
      const [x, z] = resolveCollisions(plek.x + Math.cos(hoek) * r, plek.z + Math.sin(hoek) * r, 0.4);
      const kleur = KLEREN[Math.floor(Math.random() * KLEREN.length)];
      const persoon = new Persoon({ ...kleur, huid: Math.random() < 0.5 ? 0xd9b48f : 0xc79a72,
        hoogte: 0.97 + Math.random() * 0.07, pet: Math.random() < 0.45, petKleur: 0x16181c });
      const soort = Math.random() < PISTOOL_KANS ? 'pistool' : 'knuppel';
      persoon.geefWapen(soort);
      persoon.zetNeer(x, z, Math.atan2(-(plek.x - x), -(plek.z - z)));   // naar het midden
      scene.add(persoon.groep);
      leden.push({
        persoon, soort, thuis: { x, z },
        staat: 'hangen',           // hangen | jacht | terug | neer
        vuurT: VUURTIJD[0] + Math.random(), slag: 0, slagRust: 0, omT: 0, geraakt: false,
        vastT: 0, kijkT: Math.random() * 3,
        pad: null, padI: 0, padDoel: null, padT: 0, meetT: 0, meetD: Infinity, meetPos: null, terugT: 0,
      });
    }
    // minstens één van de twee soorten, en bij een groepje van vier allebei
    if (n >= 3 && leden.every(l => l.soort === leden[0].soort)) {
      const l = leden[n - 1];
      l.soort = l.soort === 'pistool' ? 'knuppel' : 'pistool';
      if (l.persoon.wapen && l.persoon.wapen.parent) l.persoon.wapen.parent.remove(l.persoon.wapen);
      l.persoon.wapen = null;
      l.persoon.geefWapen(l.soort);
    }
    const g = { plek, leden, staat: 'hangen', jachtT: 0, kwijtT: 0, rustT: 0,
      opgeven: OPGEVEN[0] + Math.random() * (OPGEVEN[1] - OPGEVEN[0]) };
    groepen.push(g);
    return g;
  }

  function verwijder(g) {
    for (const l of g.leden) scene.remove(l.persoon.groep);
    const i = groepen.indexOf(g);
    if (i >= 0) groepen.splice(i, 1);
  }

  // Ziet de speler dit punt? Dan mag er niets verschijnen of verdwijnen.
  function inZicht(x, z, sp) {
    const d = Math.hypot(x - sp.x, z - sp.z);
    if (d > 260) return false;
    const vx = -Math.sin(player.yaw), vz = -Math.cos(player.yaw);
    if (d > 1 && ((x - sp.x) * vx + (z - sp.z) * vz) / d < 0.25) return false;   // achter je
    return zichtVrij(sp.x, sp.z, x, z, 1.5);
  }

  function spelerPunt() {
    return player.inCar ? { x: player.inCar.x, z: player.inCar.z } : { x: player.pos.x, z: player.pos.z };
  }

  // Er moet (misschien) een groepje bij: een plek op afstand, uit zicht, niet naast een ander.
  function misschienErbij(sp) {
    if (groepen.length >= MAX_GROEPEN) return null;
    if (!plekken) maakPlekken();
    const kandidaten = [];
    for (const p of plekken) {
      const d = Math.hypot(p.x - sp.x, p.z - sp.z);
      if (d < OPDUIKEN[0] || d > OPDUIKEN[1]) continue;
      if (groepen.some(g => afst(g.plek, p) < TUSSEN)) continue;
      kandidaten.push(p);
    }
    for (let poging = 0; poging < 12 && kandidaten.length; poging++) {
      const k = Math.floor(Math.random() * kandidaten.length);
      const p = kandidaten[k];
      kandidaten.splice(k, 1);
      if (inZicht(p.x, p.z, sp)) continue;
      return zetGroep(p);
    }
    return null;
  }

  // ---------- aanvallen ----------
  function slaAlarm(g, sp) {
    if (g.staat === 'jacht') return;
    g.staat = 'jacht';
    g.jachtT = 0; g.kwijtT = 0;
    for (const l of g.leden) if (l.staat !== 'neer') { l.staat = 'jacht'; l.persoon.geefWapen(l.soort); }
    if (paniek) paniek(g.plek.x, g.plek.z, 30);
    geluid.kreet('schrik', afst(sp, g.plek), 0.1);
    // de eerste keer: wat is dit?
    if (!gezien && uitleg) {
      gezien = true;
      uitleg.toon('bendes', 'DE BENDE VAN DE VETERAAN',
        'Zijn mannen hangen overal in Tinga en langs de Lemmerweg rond. Kom je te dichtbij, dan vallen ze aan. '
        + 'Met een knuppel moeten ze bij je komen, met een pistool niet — <kbd>shift</kbd> sprinten is sneller dan zij.', 12);
    }
  }

  function geefOp(g) {
    g.staat = 'terug';
    g.rustT = RUST;
    for (const l of g.leden) if (l.staat !== 'neer') { l.staat = 'terug'; l.slag = 0; l.terugT = 0; l.pad = null; }
  }

  // lopen met botsingen, net als js/bewaking.js; true als hij er is
  function loopNaar(l, doel, dt, v) {
    const pos = l.persoon.groep.position;
    let dx = doel.x - pos.x, dz = doel.z - pos.z;
    const a = Math.hypot(dx, dz);
    if (a < 0.5) return true;
    dx /= a; dz /= a;
    const stap = Math.min(a, v * dt);
    for (const draai of [0, 0.7, -0.7, 1.4, -1.4]) {
      const c = Math.cos(draai), s = Math.sin(draai);
      const rx = dx * c - dz * s, rz = dx * s + dz * c;
      const nx = pos.x + rx * stap, nz = pos.z + rz * stap;
      const [kx, kz] = resolveCollisions(nx, nz, 0.34, OVER_LAAG);
      if (Math.hypot(kx - nx, kz - nz) < 0.02) {
        pos.x = kx; pos.z = kz;
        l.persoon.draaiNaar(Math.atan2(-rx, -rz), dt, 7);
        l.vastT = 0;
        return false;
      }
    }
    l.vastT += dt;
    return false;
  }

  /*
   Ergens heen, en om de heg heen als het rechtdoor niet lukt. Om de 1,2 tel
   wordt gemeten of hij dichterbij is gekomen en of hij zelf wel is opgeschoten;
   allebei niet, dan staat hij vast (tegen een heg met jou erachter, de eerste
   proef: 2,1 m van je af en geen slag) en zoekt hij een route (js/looppad.js),
   hoogstens om de twee tellen. Verplaats je je meer dan zes meter, dan telt de
   oude route niet meer.
  */
  function volg(l, doel, dt, v) {
    const pos = l.persoon.groep.position;
    if (l.padT > 0) l.padT -= dt;
    if (l.pad) {
      const q = l.pad[l.padI];
      if (!q || Math.hypot(doel.x - l.padDoel.x, doel.z - l.padDoel.z) > 6) l.pad = null;
      else {
        if (loopNaar(l, { x: q[0], z: q[1] }, dt, v)) { l.padI++; if (l.padI >= l.pad.length) l.pad = null; }
        return false;
      }
    }
    const er = loopNaar(l, doel, dt, v);
    l.meetT += dt;
    if (l.meetT >= 1.2) {
      const d = Math.hypot(doel.x - pos.x, doel.z - pos.z);
      const bewogen = l.meetPos ? Math.hypot(pos.x - l.meetPos.x, pos.z - l.meetPos.z) : Infinity;
      const vast = !er && d > l.meetD - 0.5 && bewogen < v * 1.2 * 0.6;
      l.meetT = 0; l.meetD = d; l.meetPos = { x: pos.x, z: pos.z };
      if (vast && l.padT <= 0 && d < 120) {
        l.padT = 2;
        const pad = zoekLooppad({ x: pos.x, z: pos.z }, doel, { laag: OVER_LAAG });
        if (pad && pad.length > 1) { l.pad = pad; l.padI = 1; l.padDoel = { x: doel.x, z: doel.z }; }
      }
    }
    return er;
  }

  function valNeer(l, g) {
    if (l.staat === 'neer') return;
    l.staat = 'neer';
    l.omT = 0;
    l.slag = 0;
    const p = l.persoon.groep.position;
    if (laatVallen) {
      if (l.soort === 'pistool') laatVallen('pistool', p.x, p.z, 6 + Math.floor(Math.random() * 7));
      else if (Math.random() < 0.35) laatVallen('geld', p.x, p.z, 20 + Math.floor(Math.random() * 41));
    }
  }

  /*
   Eén beeld. `actief` is false tijdens een missie en tot missie 10 voorbij is;
   dan verdwijnen de groepjes. Levert de schade aan de speler dit beeld.
  */
  function update(dt, actief) {
    const sp = spelerPunt();
    if (!actief) {
      if (groepen.length) for (const g of [...groepen]) verwijder(g);
      return 0;
    }
    zoekT -= dt;
    if (zoekT <= 0) {
      zoekT = ZOEK_T;
      if (opduiken) misschienErbij(sp);
      // wat ver weg is en uit zicht, of helemaal neer ligt en uit zicht, gaat weg
      for (const g of [...groepen]) {
        const d = afst(sp, g.plek);
        const allemaal = g.leden.every(l => l.staat === 'neer');
        if ((d > WEG || (allemaal && d > 40)) && g.staat !== 'jacht' && !inZicht(g.plek.x, g.plek.z, sp)) verwijder(g);
      }
    }
    let schade = 0;
    const teVoet = !player.inCar;
    const autoV = player.inCar ? Math.abs(player.inCar.speed || 0) : 0;
    for (const g of groepen) {
      if (g.rustT > 0) g.rustT -= dt;
      let dichtst = Infinity;
      for (const l of g.leden) {
        const p = l.persoon;
        const pos = p.groep.position;
        if (l.staat === 'neer') {
          if (l.omT < 1) { l.omT = Math.min(1, l.omT + dt * 1.8); p.legNeer(l.omT); }
          continue;
        }
        const d = Math.hypot(sp.x - pos.x, sp.z - pos.z);
        dichtst = Math.min(dichtst, d);
        // omver gereden
        if (player.inCar && autoV > AANRIJ_V && d < 1.9) {
          valNeer(l, g); slaAlarm(g, sp);
          geluid.klap(); geluid.kreet('pijn', d, Math.random());
          continue;
        }

        if (l.staat === 'hangen') {
          // rondhangen: naar het midden kijken, en af en toe naar jou als je in de buurt komt
          l.kijkT -= dt;
          if (d < 30 && l.kijkT < 1.5) p.kijkNaar(sp.x, sp.z, dt, 2);
          else p.kijkNaar(g.plek.x, g.plek.z, dt, 1.5);
          if (l.kijkT <= 0) l.kijkT = 3 + Math.random() * 4;
          p.update(dt, {});
          const grens = teVoet ? TE_DICHT : TE_DICHT_AUTO;
          if (d < grens && g.rustT <= 0) slaAlarm(g, sp);
          continue;
        }

        if (l.staat === 'terug') {
          const er = volg(l, l.thuis, dt, SLENTER);
          p.update(dt, { loopt: !er, snelheid: SLENTER });
          l.terugT += dt;
          /*
           Lukt het na anderhalve minuut nog niet, dan staat hij weer op zijn
           plek zodra je niet kijkt — beter dan een man die de rest van het spel
           tegen een schutting aan loopt.
          */
          if (!er && l.terugT > 90 && !inZicht(pos.x, pos.z, sp) && !inZicht(l.thuis.x, l.thuis.z, sp)) {
            p.zetNeer(l.thuis.x, l.thuis.z, p.yaw);
            l.staat = 'hangen'; l.pad = null;
          } else if (er) { l.staat = 'hangen'; l.pad = null; }
          continue;
        }

        // ---- jacht ----
        if (l.soort === 'pistool') {
          const zien = d < 70 && zichtVrij(pos.x, pos.z, sp.x, sp.z, 1.2);
          const staan = zien && d < SCHIET_AF[1];
          if (!staan) volg(l, sp, dt, REN);
          else if (d < SCHIET_AF[0] && teVoet) {
            // te dichtbij: een paar passen achteruit
            const terug = { x: pos.x + (pos.x - sp.x), z: pos.z + (pos.z - sp.z) };
            loopNaar(l, terug, dt, 1.6);
          }
          p.kijkNaar(sp.x, sp.z, dt, 7);
          p.update(dt, { loopt: !staan, mikt: zien, snelheid: staan ? 1.3 : REN });
          l.vuurT -= dt;
          if (zien && d < SCHIET_AF[1] + 10 && l.vuurT <= 0) {
            l.vuurT = VUURTIJD[0] + Math.random() * (VUURTIJD[1] - VUURTIJD[0]);
            p.vuur();
            geluid.schot(d);
            if (Math.random() < Math.max(0.1, 0.5 - d * 0.02)) schade += PISTOOL_SCHADE;
          }
        } else {
          // de knuppel: erheen rennen, en dichtbij uithalen
          if (l.slagRust > 0) l.slagRust -= dt;
          if (l.slag > 0) {
            const voor = l.slag;
            l.slag += dt / SLAG_DUUR;
            // raak op het moment dat hij naar beneden komt, als je er nog staat
            if (voor < 0.6 && l.slag >= 0.6 && d < SLAG_BEREIK + 0.25 && teVoet) {
              schade += SLAG_SCHADE;
              geluid.klap();
            }
            if (l.slag >= 1) { l.slag = 0; l.slagRust = SLAG_RUST; }
            p.kijkNaar(sp.x, sp.z, dt, 9);
            p.update(dt, { slaat: Math.min(1, l.slag) });
          } else {
            const bij = d < SLAG_BEREIK;
            if (!bij) volg(l, sp, dt, REN);
            p.kijkNaar(sp.x, sp.z, dt, 8);
            p.update(dt, { loopt: !bij, snelheid: REN });
            if (bij && teVoet && l.slagRust <= 0) l.slag = 0.001;
          }
        }
      }

      // ---- opgeven ----
      if (g.staat === 'jacht') {
        g.jachtT += dt;
        if (dichtst > KWIJT) g.kwijtT += dt; else g.kwijtT = 0;
        const iemand = g.leden.some(l => l.staat !== 'neer');
        if (!iemand) g.staat = 'leeg';
        /*
         Opgeven: als ze je kwijt zijn, of na een tijdje als je van hun plek weg
         bent gelopen. Lopend houden ze je bij (ze zijn net iets sneller), dus
         alleen "te ver weg" was nooit genoeg (de eerste proef). Sta je bij hun
         plek te vechten, dan houden ze niet op.
        */
        else if (g.kwijtT > KWIJT_T || (g.jachtT > g.opgeven && afst(sp, g.plek) > EIGEN_STUK)) geefOp(g);
      } else if (g.staat === 'terug' && g.leden.every(l => l.staat !== 'terug')) {
        g.staat = 'hangen';
      }
    }
    return schade;
  }

  // ---------- schieten ----------
  function doelen() {
    const uit = [];
    for (const g of groepen) for (const l of g.leden) if (l.staat !== 'neer') uit.push(l.persoon.groep);
    return uit;
  }
  function raak(obj) {
    for (const g of groepen) {
      for (const l of g.leden) {
        if (l.staat === 'neer') continue;
        let p = obj, hit = false;
        while (p) { if (p === l.persoon.groep) { hit = true; break; } p = p.parent; }
        if (!hit) continue;
        valNeer(l, g);
        slaAlarm(g, spelerPunt());
        return true;
      }
    }
    return false;
  }
  // een schot in de buurt: het groepje komt eropaf
  function hoorSchot(x, z) {
    const sp = spelerPunt();
    for (const g of groepen) {
      if (g.staat === 'jacht' || g.rustT > 0) continue;
      if (Math.hypot(g.plek.x - x, g.plek.z - z) < GEHOOR) slaAlarm(g, sp);
    }
  }
  function reset() { for (const g of [...groepen]) verwijder(g); zoekT = 0; }

  return {
    update, doelen, raak, hoorSchot, reset,
    // voor de proef: een groepje op een plek neerzetten, en de lijst van plekken
    zetGroep: (x, z, n) => zetGroep({ x, z, straat: 'proef' }, n),
    get plekken() { return plekken || maakPlekken(); },
    get opduiken() { return opduiken; },
    set opduiken(v) { opduiken = !!v; },
    get groepen() { return groepen; },
  };
}

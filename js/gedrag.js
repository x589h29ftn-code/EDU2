/*
 Wat voetgangers doen behalve lopen (stap 154, gevraagd: "Gedrag: mensen die bij de Poiesz in- en uitlopen, op een
 bankje zitten, bellen of een fiets op slot zetten").

 js/npc.js laat iedereen over wegvakken lopen: zijn plek komt elk beeld uit `p.seg` en `p.t`. Een bezigheid neemt dat
 tijdelijk over (`p.doe`): de voetganger verlaat zijn wegvak op het punt waar hij is (`terug`), loopt in een rechte
 lijn naar zijn doel (met de botsdozen, en wie vastloopt geeft het op), doet daar wat hij komt doen, en loopt terug naar
 dat punt; daar neemt het wegvak het weer over, zonder sprong.

   bank    naar een vrije plek op een bankje (KAART.objecten 'bank'), 20–60 s zitten (de zithouding uit js/lichaam.js)
   winkel  naar de Poiesz in Duinterpen: door de gang naar de schuifdeuren, naar binnen (weg uit beeld, achter de
           deuren), 30–90 s later weer naar buiten
   fiets   wie fietst: naar het fietsenrek voor de Poiesz, afstappen, gehurkt op slot (2,5 s), de fiets blijft in het
           rek staan, dan de winkel in; terug: van het slot, opstappen en wegrijden
   bellen  geen plek maar een houding: een paar tellen tot een minuut de telefoon aan het oor, lopend of staand

 Alles staat in `GEDRAG`. Wie in paniek raakt, breekt af en rent terug naar zijn wegvak; wie in de winkel is, blijft
 binnen tot het voorbij is.
*/
import * as THREE from 'three';

export const GEDRAG = {
  bankKans: 0.12,          // per seconde, als er binnen bankBereik een vrije plek is
  bankBereik: 14,
  bankTijd: [20, 60],
  winkelKans: 0.035,       // per seconde, binnen winkelBereik van de stoep
  winkelBereik: 70,
  winkelMax: 3,            // zoveel tegelijk op weg naar of in de winkel
  binnenTijd: [30, 90],
  fietsKans: 0.05,
  fietsBereik: 90,
  slotTijd: 2.5,
  belKans: 0.008,          // per seconde, lopend of staand
  belTijd: [8, 60],
  vast: 4,                 // seconden zonder voortgang: dan geeft hij het op
  aankomst: 0.35,
  zitting: 0.49 + 0.12,    // de zitting van een bankje (js/props.js) op de stoep (KERB_Y)
};

const r2 = (a, b) => a + Math.random() * (b - a);

export function maakGedrag({ scene, kaart, winkel = null, resolveCollisions, addCollider = null, maakProp = null, grondHoogte = () => 0 }) {
  // ---- de plekken op de bankjes: twee per bank, op de zitting, met de rug naar de leuning
  const plekken = [];
  for (const o of (kaart && kaart.objecten) || []) {
    if (o.type !== 'bank') continue;
    const yaw = (o.yaw || 0) * Math.PI / 180, c = Math.cos(yaw), s = Math.sin(yaw);
    for (const lx of [-0.45, 0.45]) {
      // lokaal (lx, 0.05) → wereld; het bankje kijkt naar zijn +z, de leuning staat op −0,2
      const x = o.x + lx * c + 0.05 * s, z = o.z - lx * s + 0.05 * c;
      // een voetganger kijkt langs zijn eigen −z: met zijn rug naar de leuning is dat yaw + π
      plekken.push({ x, z, yaw: yaw + Math.PI, voor: { x: x + s * 0.75, z: z + c * 0.75 }, bezet: null });
    }
  }

  // ---- het fietsenrek bij de Poiesz: buiten de zuilen, vijf meter naast de deur, langs de gang
  let rek = null;
  if (winkel) {
    const fx = winkel.f[0], fz = winkel.f[1];                // naar buiten
    const tx = -fz, tz = fx;                                 // langs de gang
    for (const zij of [1, -1]) {
      const x = winkel.deur.x + fx * 4.6 + tx * 5.5 * zij, z = winkel.deur.z + fz * 4.6 + tz * 5.5 * zij;
      const [rx, rz] = resolveCollisions(x, z, 1.3);
      if (Math.hypot(rx - x, rz - z) < 0.05) { rek = { x, z, yaw: Math.atan2(tx, tz) + Math.PI / 2, tx, tz, fx, fz, plaatsen: [] }; break; }
    }
    if (rek) {
      for (let i = 0; i < 5; i++) {
        const o = -1.0 + i * 0.5;
        rek.plaatsen.push({ x: rek.x + rek.tx * o + rek.fx * 0.9, z: rek.z + rek.tz * o + rek.fz * 0.9, bezet: null });
      }
      const obj = maakProp ? maakProp('fietsenrek') : null;
      if (obj) {
        obj.position.set(rek.x, grondHoogte(rek.x, rek.z) + 0.12, rek.z);
        obj.rotation.y = Math.atan2(rek.tx, rek.tz) - Math.PI / 2;
        obj.userData.klasse = 'fietsenrek';
        scene.add(obj);
      }
      // de lange kant langs de gang (eerst stond de doos een kwartslag gedraaid, over de plekken van de fietsen heen)
      if (addCollider) addCollider(rek.x, rek.z, 1.2, 0.3, -Math.atan2(rek.tx, rek.tz) + Math.PI, 0.8);
    }
  }
  // de geparkeerde fietsen: dezelfde fiets als in js/npc.js (die geeft de vorm en het materiaal)
  let fietsGeo = null;
  const zetFietsGeo = (geo, mat) => {
    if (fietsGeo) return;
    fietsGeo = geo;
    const nieuw = new THREE.InstancedMesh(geo, mat, 5);
    nieuw.count = 0; nieuw.castShadow = true; nieuw.frustumCulled = false; nieuw.userData.klasse = 'geparkeerdeFiets';
    api.fietsen = nieuw;
    scene.add(nieuw);
  };

  let inWinkel = 0;          // op weg naar, in of uit de winkel
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();

  function zetFietsen() {
    if (!api.fietsen || !rek) return;
    let n = 0;
    for (const pl of rek.plaatsen) {
      if (!pl.bezet || !pl.fiets) continue;
      e.set(0, pl.yaw, 0, 'YXZ'); q.setFromEuler(e);
      m4.compose(v3.set(pl.x, grondHoogte(pl.x, pl.z), pl.z), q, s3.setScalar(pl.h || 1));
      api.fietsen.setMatrixAt(n++, m4);
    }
    api.fietsen.count = n;
    api.fietsen.instanceMatrix.needsUpdate = true;
  }

  // ---- beginnen
  function begin(p, soort, opties = {}) {
    if (p.doe || !p.alive) return false;
    const terug = { x: p.x, z: p.z };
    if (soort === 'bank') {
      const pl = opties.plek || plekken.filter(q2 => !q2.bezet).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      if (!pl) return false;
      pl.bezet = p;
      p.doe = { soort, fase: 'heen', doel: pl.voor, plek: pl, terug, vast: 0, beste: Infinity };
      return true;
    }
    if (soort === 'winkel') {
      if (!winkel || inWinkel >= GEDRAG.winkelMax && !opties.toch) return false;
      inWinkel++;
      p.doe = { soort, fase: 'heen', doel: winkel.stoep, terug, vast: 0, beste: Infinity };
      return true;
    }
    if (soort === 'fiets') {
      if (!winkel || !rek || !p.fietst) return false;
      const pl = rek.plaatsen.find(q2 => !q2.bezet);
      if (!pl || (inWinkel >= GEDRAG.winkelMax && !opties.toch)) return false;
      inWinkel++;
      pl.bezet = p; pl.h = p.height;
      p.doe = { soort, fase: 'heen', doel: pl, plek: pl, terug, vast: 0, beste: Infinity };
      return true;
    }
    if (soort === 'bellen') {
      p.belt = opties.tijd || r2(...GEDRAG.belTijd);
      return true;
    }
    return false;
  }

  // ---- de kans dat iemand die gewoon loopt iets gaat doen (js/npc.js, één keer per beeld per voetganger)
  function misschien(p, dt) {
    if (p.doe || p.jogt || p.paniek > 0 || p.steek > 0 || !p.alive) return;
    if (!p.fietst && !p.belt && Math.random() < GEDRAG.belKans * dt) begin(p, 'bellen');
    if (Math.random() > dt * 0.5) return;            // de rest gemiddeld eens per twee seconden bekijken
    if (p.fietst) {
      if (winkel && rek && Math.hypot(p.x - winkel.stoep.x, p.z - winkel.stoep.z) < GEDRAG.fietsBereik && Math.random() < GEDRAG.fietsKans * 2) begin(p, 'fiets');
      return;
    }
    if (p.hond) return;
    if (winkel && Math.hypot(p.x - winkel.stoep.x, p.z - winkel.stoep.z) < GEDRAG.winkelBereik && Math.random() < GEDRAG.winkelKans * 2) { begin(p, 'winkel'); return; }
    for (const pl of plekken) {
      if (pl.bezet || Math.hypot(pl.x - p.x, pl.z - p.z) > GEDRAG.bankBereik) continue;
      if (Math.random() < GEDRAG.bankKans * 2) begin(p, 'bank', { plek: pl });
      return;
    }
  }

  // een stap naar een doel; geeft true als hij er is
  function stap(p, doel, v, dt, botsen = true) {
    const dx = doel.x - p.x, dz = doel.z - p.z, d = Math.hypot(dx, dz);
    if (d < GEDRAG.aankomst) return true;
    const s = Math.min(d, v * dt);
    let x = p.x + dx / d * s, z = p.z + dz / d * s;
    if (botsen) [x, z] = resolveCollisions(x, z, 0.32, 0, grondHoogte(x, z));
    p.x = x; p.z = z;
    p.yaw = Math.atan2(-dx, -dz);
    // vastgelopen? Dan op naar huis
    const doe = p.doe;
    if (d < doe.beste - 0.3) { doe.beste = d; doe.vast = 0; } else doe.vast += dt;
    return false;
  }

  function afmaken(p) {
    const doe = p.doe;
    if (!doe) return;
    if (doe.plek && doe.plek.bezet === p && doe.soort === 'bank') doe.plek.bezet = null;
    if (doe.soort === 'winkel' || doe.soort === 'fiets') inWinkel = Math.max(0, inWinkel - 1);
    if (doe.soort === 'fiets' && doe.plek) { doe.plek.bezet = null; doe.plek.fiets = false; zetFietsen(); }
    p.doe = null; p.verborgen = false; p.houding = null;
  }

  // naar huis: terug naar het punt op het wegvak (zonder botsen het laatste stuk: daar kwam hij vandaan)
  function naarHuis(p, ren = false) {
    const doe = p.doe;
    if (doe.soort === 'bank' && doe.plek) { doe.plek.bezet = null; doe.plek = null; }
    doe.fase = 'terug'; doe.doel = doe.terug; doe.vast = 0; doe.beste = Infinity; doe.ren = ren;
    p.verborgen = false; p.houding = null;
  }

  /*
   Eén beeld voor iemand met een bezigheid. Levert { loopt, ren } voor de pas, en zet p.x, p.z, p.yaw, p.houding
   ('zit' of 'hurk') en p.verborgen. Klaar: p.doe weer null, en het wegvak neemt het over.
  */
  function werk(p, dt) {
    const doe = p.doe;
    const v = doe.ren ? p.ren : p.speed * (doe.soort === 'fiets' && p.fietst ? 0.75 : 1);
    if (p.paniek > 0 && doe.fase !== 'binnen' && doe.fase !== 'terug') naarHuis(p, true);
    if (doe.vast > GEDRAG.vast && doe.fase !== 'terug') naarHuis(p);
    switch (doe.fase) {
      case 'heen': {
        // het laatste stukje naar de zitting of het rek zonder botsdozen (het bankje en het rek zijn er zelf een)
        const dDoel = Math.hypot(doe.doel.x - p.x, doe.doel.z - p.z);
        if (stap(p, doe.doel, v, dt, dDoel > 1.4)) {
          if (doe.soort === 'bank') { doe.fase = 'naarZit'; doe.doel = doe.plek; }
          else if (doe.soort === 'winkel') { doe.fase = 'deur'; doe.doel = winkel.deur; doe.beste = Infinity; }
          else if (doe.soort === 'fiets') { doe.fase = 'slot'; doe.t = GEDRAG.slotTijd; p.fietst = false; doe.plek.fiets = true; doe.plek.yaw = p.yaw; zetFietsen(); }
        }
        return { loopt: true, ren: doe.ren ? 1 : 0 };
      }
      case 'naarZit': {
        if (stap(p, doe.doel, 0.8, dt, false)) { doe.fase = 'zit'; doe.t = r2(...GEDRAG.bankTijd); p.yaw = doe.plek.yaw; }
        return { loopt: true, ren: 0 };
      }
      case 'zit': {
        p.houding = 'zit'; p.yaw = doe.plek.yaw;
        doe.t -= dt;
        if (doe.t <= 0) { p.houding = null; doe.fase = 'opstaan'; doe.doel = doe.plek.voor; }
        return { loopt: false, ren: 0 };
      }
      case 'opstaan': {
        if (stap(p, doe.doel, 0.8, dt, false)) naarHuis(p);
        return { loopt: true, ren: 0 };
      }
      case 'slot': {
        p.houding = 'hurk';
        doe.t -= dt;
        if (doe.t <= 0) {
          p.houding = null;
          if (doe.terugNaarHuis) { p.fietst = true; doe.plek.fiets = false; zetFietsen(); naarHuis(p); }
          else { doe.fase = 'heenWinkel'; doe.doel = winkel.stoep; doe.vast = 0; doe.beste = Infinity; }
        }
        return { loopt: false, ren: 0 };
      }
      case 'heenWinkel': {
        if (stap(p, doe.doel, p.speed > 3 ? 1.3 : p.speed, dt)) { doe.fase = 'deur'; doe.doel = winkel.deur; doe.beste = Infinity; }
        return { loopt: true, ren: 0 };
      }
      case 'deur': {
        // de laatste meter naar de deur gaat door de pui heen, dus zonder botsen
        if (stap(p, doe.doel, 1.1, dt, false)) { doe.fase = 'binnen'; doe.t = r2(...GEDRAG.binnenTijd); p.verborgen = true; }
        return { loopt: true, ren: 0 };
      }
      case 'binnen': {
        p.verborgen = true;
        doe.t -= dt;
        if (doe.t <= 0) { p.verborgen = false; doe.fase = 'uit'; doe.doel = winkel.stoep; doe.beste = Infinity; p.yaw = Math.atan2(-winkel.f[0], -winkel.f[1]); }
        return { loopt: false, ren: 0 };
      }
      case 'uit': {
        if (stap(p, doe.doel, 1.1, dt, false)) {
          if (doe.soort === 'fiets') { doe.fase = 'naarFiets'; doe.doel = doe.plek; doe.beste = Infinity; }
          else naarHuis(p);
        }
        return { loopt: true, ren: 0 };
      }
      case 'naarFiets': {
        const dDoel = Math.hypot(doe.doel.x - p.x, doe.doel.z - p.z);
        if (stap(p, doe.doel, 1.3, dt, dDoel > 1.4)) { doe.fase = 'slot'; doe.t = GEDRAG.slotTijd; doe.terugNaarHuis = true; }
        return { loopt: true, ren: 0 };
      }
      case 'terug': {
        const dHuis = Math.hypot(doe.terug.x - p.x, doe.terug.z - p.z);
        if (stap(p, doe.terug, v, dt, dHuis > 1.0) || doe.vast > GEDRAG.vast * 2) afmaken(p);
        return { loopt: true, ren: doe.ren ? 1 : 0 };
      }
    }
    afmaken(p);
    return { loopt: false, ren: 0 };
  }

  const api = {
    plekken, rek, begin, misschien, werk, afmaken, zetFietsGeo, fietsen: null,
    get inWinkel() { return inWinkel; },
    winkel,
    // de punten bij de schuifdeuren voor js/zuilengang.js (de deuren gaan ook voor hen open)
    bijDeur(people) {
      const uit = [];
      if (!winkel) return uit;
      for (const p of people) if (p.doe && (p.doe.fase === 'deur' || p.doe.fase === 'uit' || (p.doe.fase === 'binnen' && p.doe.t < 1.5))) uit.push({ x: p.x, z: p.z });
      return uit;
    },
  };
  return api;
}

/*
 Omstanders die je kunt raken (stap 188, gevraagd: "als een persoon op een zeilboot zit kan je hem niet neerschieten zo te zien,
 dat soort dingetjes"). Een kogel raakt alleen wat in een lijst van het schot staat (js/main.js `shootCb`): de voetgangers, de
 politie, het verhaal, de wedstrijd, de buurt, de ambulance. Wie daar niet in stond, liep er ongedeerd bij: de zeilers, de mensen
 op de plezierboot en het terras, de verkopers van de viskraam, de medewerker van de BP, Sjoerd in het Autohuis, het personeel en
 de klanten van de supermarkt, de tegenstander bij tennis.

 Gevraagd daarna: "ik denk dat je de figuranten zoals Mark en Sjoerd ed niet moet neerschieten". Wie een rol heeft (Sjoerd, de
 medewerker van de BP, de verkopers van de viskraam, het personeel van de supermarkt, de tegenstander bij tennis, en natuurlijk
 Mark, Johan, Erik Jan, Sjors, Wiebe) blijft staan. Hier alleen gewone omstanders: de zeilers, de opvarenden van de plezierboot,
 de terrasgasten en de klanten van de supermarkt.

 Zo'n figuur meldt zich hier aan (`registreer`). Geraakt (een kogel, het mes, een knal): hij gaat neer (`Persoon.legNeer`, of bij
 een zeiler overboord), het spel meldt het als een misdaad, en `opNeer` zegt het tegen de module zelf (een zeilboot drijft dan
 uit). Na `OMSTANDER.terug` seconden, als je niet dichtbij bent, staat hij weer op.

*/
export const OMSTANDER = {
  terug: 75,        // seconden tot hij weer opstaat
  verweg: 45,       // en pas als de camera minstens zo ver weg is
  val: 1.6,         // hoe snel hij omvalt (legNeer van 0 naar 1)
};

const lijst = [];

function zichtbaar(o) {
  for (let q = o; q; q = q.parent) if (!q.visible) return false;
  return true;
}

/**
 * @param {object} p   een Persoon (met `groep` en `legNeer`), of { groep, valOverboord: true } voor een eenvoudig figuurtje
 * @param {object} o   { wie, mag: () => bool (mag hij nu geraakt worden), opNeer(), opTerug() }
 */
export function registreer(p, o = {}) {
  const e = { p, groep: p.groep, wie: o.wie || 'omstander', mag: o.mag || (() => true), opNeer: o.opNeer, opTerug: o.opTerug,
    neer: false, t: 0, val: 0 };
  lijst.push(e);
  p.omstander = e;
  return e;
}

export function isNeer(p) { return !!(p && p.omstander && p.omstander.neer); }

export const omstanders = {
  get lijst() { return lijst; },
  // wat een kogel kan raken: de groep van wie staat, zichtbaar is en geraakt mag worden
  doelen() {
    const uit = [];
    for (const e of lijst) if (!e.neer && e.mag() && zichtbaar(e.groep)) uit.push(e.groep);
    return uit;
  },
  // `obj` is wat de straal raakte (een mesh in de groep); geeft { x, z, wie } of null
  raak(obj) {
    for (let o = obj; o; o = o.parent) {
      const e = lijst.find(q => q.groep === o);
      if (!e) continue;
      if (e.neer || !e.mag()) return null;
      e.neer = true; e.t = 0; e.val = 0;
      if (e.opNeer) e.opNeer();
      const w = e.groep.getWorldPosition ? e.groep.getWorldPosition(e.groep.position.clone()) : e.groep.position;
      return { x: w.x, z: w.z, wie: e.wie };
    }
    return null;
  },
  // na de updates van de modules: wie neer is ligt (legNeer wint van hun eigen houding), en staat later weer op
  update(dt, camX, camZ) {
    for (const e of lijst) {
      if (!e.neer) continue;
      e.t += dt;
      if (e.p.valOverboord) {
        // een zeiler: even schuin, dan het water in
        e.val = Math.min(1, e.val + dt * OMSTANDER.val);
        e.groep.rotation.z = e.val * 1.4;
        if (e.val >= 1) e.groep.visible = false;
      } else if (e.p.legNeer) {
        e.val = Math.min(1, e.val + dt * OMSTANDER.val);
        e.p.legNeer(e.val);
      }
      if (e.t > OMSTANDER.terug && camX !== undefined) {
        const w = e.groep.getWorldPosition ? e.groep.getWorldPosition(e.groep.position.clone()) : e.groep.position;
        if (Math.hypot(w.x - camX, w.z - camZ) > OMSTANDER.verweg) omstanders.herstel(e);
      }
    }
  },
  herstel(e) {
    e.neer = false; e.t = 0; e.val = 0;
    if (e.p.valOverboord) { e.groep.rotation.z = 0; e.groep.visible = true; } else if (e.p.legNeer) e.p.legNeer(0);
    if (e.opTerug) e.opTerug();
  },
  // laden, een nieuwe missie: iedereen weer overeind
  reset() { for (const e of lijst) if (e.neer) omstanders.herstel(e); },
};

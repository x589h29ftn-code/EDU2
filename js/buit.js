/*
 Wat er op straat blijft liggen: geld, kogels en een pistool.

 Tot nu toe leverde neerschieten niets op. Nu laat een voetganger die je
 neerschiet wisselend wat geld vallen — vaak niets, hooguit een tientje, zoals
 iemand met een paar briefjes op zak — en een agent laat zijn munitie vallen,
 drie tot vijftien kogels. Die kogels passen in elk wapen: de reserve in
 js/player.js is er één voor allemaal, dus het maakt niet uit waar je ze mee
 opschiet.

 Het ligt er echt: een stapeltje briefjes of een doosje patronen op de grond,
 dat rondjes draait en op en neer dobbert zodat je het ziet liggen. Loop je er
 binnen een meter langs, dan pak je het op. Na een minuut is het weg — anders
 ligt de wijk na een half uur vol.

 Geen plaatjes: de briefjes en het doosje zijn geverfde blokjes, net als de rest
 van het spel.
*/
import * as THREE from 'three';

const LEVEN = 60;          // seconden dat iets blijft liggen
const PAKAFSTAND = 1.25;   // hoe dicht je erlangs moet lopen
const HOOG = 0.45;         // zweefhoogte boven de grond
// Een pakje briefjes is vijftien centimeter breed en dat is van drie meter niet
// meer te zien. Net als in GTA staat de buit daarom groter dan levensgroot in de
// wereld: anders loop je er zonder het te merken langs.
const SCHAAL = 1.7;

function mat(kleur, ruw = 0.7, metaal = 0) {
  return new THREE.MeshStandardMaterial({ color: kleur, roughness: ruw, metalness: metaal });
}

/*
 Eén stapeltje briefjes: drie biljetten op elkaar met een bandje eromheen.
*/
function geldVorm(M) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.008, 0.075), M.biljet);
    b.position.set((Math.random() - 0.5) * 0.012, i * 0.009, (Math.random() - 0.5) * 0.008);
    b.rotation.y = (Math.random() - 0.5) * 0.14;
    g.add(b);
  }
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.032, 0.082), M.band);
  band.position.y = 0.009;
  g.add(band);
  return g;
}

/*
 Een doosje patronen: een kartonnen doos met een streep erover en twee hulzen
 die er bovenop liggen.
*/
function kogelVorm(M) {
  const g = new THREE.Group();
  const doos = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.058, 0.085), M.karton);
  g.add(doos);
  const streep = new THREE.Mesh(new THREE.BoxGeometry(0.132, 0.016, 0.087), M.streep);
  streep.position.y = 0.008;
  g.add(streep);
  for (const sx of [-1, 1]) {
    const huls = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.030, 8), M.messing);
    huls.rotation.z = Math.PI / 2;
    huls.position.set(sx * 0.022, 0.038, sx * 0.012);
    g.add(huls);
  }
  return g;
}

/*
 Een pistool dat op straat ligt: slede met loop, greep eronder. Het ligt plat,
 een slag gedraaid, zodat je van bovenaf de vorm ziet. Dit valt uit de hand van
 iemand die je neerschiet en een wapen droeg (missie 7, js/verhaal.js).
*/
function pistoolVorm(M) {
  const g = new THREE.Group();
  const slede = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.035, 0.055), M.staal);
  slede.position.y = 0.03;
  g.add(slede);
  const loop = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.026, 0.026), M.staal);
  loop.position.set(-0.115, 0.028, 0);
  g.add(loop);
  const greep = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.032), M.greep);
  greep.position.set(0.05, 0.012, 0);
  greep.rotation.z = 0.22;
  g.add(greep);
  const beugel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.018, 0.02), M.staal);
  beugel.position.set(0.005, 0.012, 0);
  g.add(beugel);
  return g;
}

/**
 * De buit die op straat ligt. `maaiveld(x, z)` geeft de grondhoogte terug —
 * daar komt het bovenop te liggen, ook op een viaduct.
 */
export function maakBuit(scene, maaiveld = () => 0) {
  const M = {
    biljet: mat(0x6f9f63, 0.86), band: mat(0xd8d2c4, 0.9),
    karton: mat(0xa98a5e, 0.92), streep: mat(0x9a2f22, 0.9), messing: mat(0xbb9a42, 0.45, 0.8),
    staal: mat(0x2a2d33, 0.45, 0.6), greep: mat(0x1b1b1f, 0.8),
  };
  const dingen = [];

  /**
   * Iets laten vallen. `soort` is 'geld', 'kogels' of 'pistool'; `waarde` is
   * het bedrag in euro's, het aantal kogels, of bij een pistool het aantal
   * kogels dat er nog in zit. Levert het ding terug, of null als er niets viel
   * (waarde nul).
   */
  function laatVallen(soort, x, z, waarde) {
    if (!(waarde > 0)) return null;
    const groep = soort === 'geld' ? geldVorm(M) : soort === 'pistool' ? pistoolVorm(M) : kogelVorm(M);
    const y = maaiveld(x, z);
    groep.position.set(x, y + HOOG, z);
    groep.scale.setScalar(SCHAAL);
    groep.userData.buit = soort;
    scene.add(groep);
    const ding = { soort, waarde, groep, t: 0, y0: y + HOOG, draai: Math.random() * Math.PI * 2 };
    dingen.push(ding);
    return ding;
  }

  /**
   * Eén beeld. `oppakken(soort, waarde)` wordt aangeroepen zodra de speler er
   * langs loopt. Levert terug hoeveel er is opgepakt.
   */
  function update(dt, speler, oppakken) {
    let gepakt = 0;
    for (let i = dingen.length - 1; i >= 0; i--) {
      const d = dingen[i];
      d.t += dt;
      d.draai += dt * 1.6;
      d.groep.rotation.y = d.draai;
      d.groep.position.y = d.y0 + Math.sin(d.t * 2.2) * 0.05;
      // de laatste vijf seconden knippert het, zodat het niet zomaar verdwijnt
      if (d.t > LEVEN - 5) d.groep.visible = Math.floor(d.t * 6) % 2 === 0;
      const weg = d.t > LEVEN;
      const dichtbij = speler && !speler.inCar
        && Math.hypot(speler.pos.x - d.groep.position.x, speler.pos.z - d.groep.position.z) < PAKAFSTAND
        && Math.abs(speler.pos.y - (d.y0 - HOOG)) < 2.2;
      if (!weg && !dichtbij) continue;
      scene.remove(d.groep);
      d.groep.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      dingen.splice(i, 1);
      if (dichtbij) { gepakt++; if (oppakken) oppakken(d.soort, d.waarde); }
    }
    return gepakt;
  }

  // alles weghalen, bijvoorbeeld als je een opgeslagen spel laadt
  function leeg() {
    for (const d of dingen) {
      scene.remove(d.groep);
      d.groep.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    dingen.length = 0;
  }

  return { laatVallen, update, leeg, get dingen() { return dingen; } };
}

/*
 Hoeveel iemand op zak heeft. Vaak niets — de meeste mensen lopen met hun pas op
 zak en niet met contant geld — en anders een paar euro, hooguit een tientje.
*/
export function zakgeld(r = Math.random) {
  if (r() < 0.45) return 0;
  return 1 + Math.floor(r() * 10);
}

// Wat een agent aan munitie bij zich draagt: drie tot vijftien kogels.
export function agentMunitie(r = Math.random) {
  return 3 + Math.floor(r() * 13);
}

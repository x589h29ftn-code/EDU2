/*
 Schade aan auto's die blijft (stap 124). Een harde klap laat een deuk achter op de neus of de
 achterkant, een kogel een gat in het blik, en een kogel in het glas of een heel harde klap een ruit vol
 barsten. Zolang de auto bestaat blijft het zitten; overspuiten in de wasbox (`vehicles.verf`) of een
 uitgebrand wrak dat weer een gewone auto wordt (`herstelWrak`) haalt het weg.

 Het zijn doeken op de carrosserie, geen vervormde hoekpunten: de geometrie van een auto is gedeeld
 met elke andere auto van dat soort. Waar het doek komt, zoekt een straal van buitenaf naar de echte
 lak of het echte glas, zodat het precies op het oppervlak ligt en ermee meekantelt (het hangt in de
 carrosseriegroep `bak`). De drie materialen bestaan vanaf het opstarten en staan in de scene, zodat
 hun shaders vooraf vertaald zijn (`soortenVoorbereid`, stap 83).

 Alleen een auto met een eigen model krijgt schade; een geparkeerde auto in de stapel heeft er geen.
*/
import * as THREE from 'three';

export const SCHADE = { max: 14, deukVanaf: 6, barstVanaf: 13 };

function doek(teken, b = 128, h = 128) {
  const c = document.createElement('canvas'); c.width = b; c.height = h;
  teken(c.getContext('2d'), b, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// een deuk: een donkere, onregelmatige kuil met krassen en een lichte rand waar de lak geknikt is
function deukDoek() {
  return doek((g, b, h) => {
    const r = g.createRadialGradient(b / 2, h / 2, 4, b / 2, h / 2, b / 2);
    r.addColorStop(0, 'rgba(20,20,22,0.62)'); r.addColorStop(0.55, 'rgba(30,30,32,0.35)'); r.addColorStop(0.8, 'rgba(240,240,240,0.18)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.beginPath(); g.ellipse(b / 2, h / 2, b * 0.48, h * 0.4, 0.2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(205,205,200,0.75)'; g.lineWidth = 1.2;
    let s = 7;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 16; i++) {
      const x = 20 + rnd() * 88, y = 30 + rnd() * 68, l = 10 + rnd() * 30, a = -0.3 + rnd() * 0.6;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  });
}
// een kogelgat: zwart gat, een kraag van kaal metaal
function gatDoek() {
  return doek((g, b, h) => {
    const r = g.createRadialGradient(b / 2, h / 2, 2, b / 2, h / 2, b / 2);
    r.addColorStop(0, 'rgba(5,5,5,1)'); r.addColorStop(0.18, 'rgba(10,10,10,1)'); r.addColorStop(0.24, 'rgba(190,190,186,0.95)');
    r.addColorStop(0.42, 'rgba(120,118,112,0.55)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, b, h);
  }, 64, 64);
}
// barsten in het glas: een ster van witte lijnen met kringen eromheen
function barstDoek() {
  return doek((g, b, h) => {
    g.translate(b / 2, h / 2);
    g.strokeStyle = 'rgba(240,244,248,0.9)'; g.lineWidth = 1.4;
    let s = 3;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2 + rnd() * 0.3;
      g.beginPath(); g.moveTo(0, 0);
      let x = 0, y = 0;
      for (let k = 0; k < 5; k++) { x += Math.cos(a + (rnd() - 0.5) * 0.5) * 22; y += Math.sin(a + (rnd() - 0.5) * 0.5) * 22; g.lineTo(x, y); }
      g.stroke();
    }
    g.lineWidth = 1;
    for (const r of [14, 30, 52]) { g.beginPath(); for (let k = 0; k <= 18; k++) { const a = k / 18 * Math.PI * 2; const rr = r * (0.85 + rnd() * 0.3); k ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); }
    g.fillStyle = 'rgba(230,236,240,0.85)'; g.beginPath(); g.arc(0, 0, 5, 0, Math.PI * 2); g.fill();
  }, 256, 256);
}

export function initAutoschade(scene) {
  const opties = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, roughness: 0.7, metalness: 0.2 };
  const MAT = {
    deuk: new THREE.MeshStandardMaterial({ ...opties, map: deukDoek() }),
    gat: new THREE.MeshStandardMaterial({ ...opties, map: gatDoek() }),
    barst: new THREE.MeshStandardMaterial({ ...opties, map: barstDoek(), roughness: 0.2, metalness: 0 }),
  };
  const vlak = new THREE.PlaneGeometry(1, 1);
  // een verborgen staal van elk, zodat de shaders bij het opstarten vertaald worden
  const staal = new THREE.Group(); staal.visible = false;
  for (const m of Object.values(MAT)) staal.add(new THREE.Mesh(vlak, m));
  scene.add(staal);

  const straal = new THREE.Raycaster();
  const Z = new THREE.Vector3(0, 0, 1), n = new THREE.Vector3(), q = new THREE.Quaternion(), mInv = new THREE.Matrix3();

  // het doek op een punt (wereld) met een normaal (wereld) aan de carrosserie hangen
  function plak(car, soort, punt, normaal, maat) {
    const m = car.mesh;
    if (!m) return null;
    const bak = m.userData.bak || m;
    car.schade = car.schade || [];
    if (car.schade.length >= SCHADE.max) return null;
    bak.updateMatrixWorld(true);
    const p = bak.worldToLocal(punt.clone());
    mInv.getNormalMatrix(bak.matrixWorld).invert();
    n.copy(normaal).applyMatrix3(mInv).normalize();
    const d = new THREE.Mesh(vlak, MAT[soort]);
    d.position.copy(p).addScaledVector(n, 0.004);
    d.quaternion.copy(q.setFromUnitVectors(Z, n));
    d.rotateZ(Math.random() * Math.PI * 2);
    d.scale.set(maat, soort === 'deuk' ? maat * 0.7 : maat, 1);
    d.renderOrder = 3;
    d.userData.schade = soort;
    bak.add(d);
    car.schade.push(d);
    return d;
  }

  // de lak (body) of het glas van een auto
  function delen(car, glas) {
    const u = car.mesh && car.mesh.userData;
    if (!u) return [];
    if (glas) return u.glas ? [u.glas] : [];
    const uit = [];
    (u.bak || car.mesh).traverse(o => { if (o.isMesh && o.userData.lak) uit.push(o); });
    return uit;
  }
  // een straal van buiten de auto (lokaal punt `van`) naar binnen (`naar`): waar raakt hij het oppervlak?
  function zoek(car, van, naar, glas) {
    const lijst = delen(car, glas);
    if (!lijst.length) return null;
    car.mesh.updateMatrixWorld(true);
    const a = car.mesh.localToWorld(new THREE.Vector3(van.x, van.y, van.z));
    const b = car.mesh.localToWorld(new THREE.Vector3(naar.x, naar.y, naar.z));
    straal.set(a, b.sub(a).normalize());
    straal.far = 8;
    const h = straal.intersectObjects(lijst, false)[0];
    if (!h || !h.face) return null;
    const nw = h.face.normal.clone().transformDirection(h.object.matrixWorld);
    return { punt: h.point, normaal: nw };
  }

  /*
   Een botsing van de auto waar je in zit. `kracht` is de snelheid waarmee je ergens in reed (m/s, uit
   js/vehicles.js `botsKracht`), `vooruit` of je vooruit reed: dan zit de deuk in de neus (lokaal −z),
   anders in de kont.
  */
  function botsing(car, kracht, vooruit = true) {
    if (!car || !car.mesh || kracht < SCHADE.deukVanaf) return null;
    const L = (car.mesh.userData.length || 4.3) / 2;
    const k = vooruit ? -1 : 1;
    const x = (Math.random() - 0.5) * 1.1, y = 0.45 + Math.random() * 0.3;
    const raak = zoek(car, { x, y, z: k * (L + 2) }, { x: x * 0.5, y, z: 0 }, false);
    let deuk = null;
    if (raak) deuk = plak(car, 'deuk', raak.punt, raak.normaal, 0.45 + Math.min(0.5, (kracht - SCHADE.deukVanaf) * 0.04));
    // een heel harde klap: de voorruit (of de achterruit) barst
    let barst = null;
    if (kracht >= SCHADE.barstVanaf) {
      const r = zoek(car, { x: (Math.random() - 0.5) * 0.6, y: 2.6, z: k * (L + 1.5) }, { x: 0, y: 0.9, z: 0 }, true);
      if (r) barst = plak(car, 'barst', r.punt, r.normaal, 0.7);
    }
    return { deuk: !!deuk, barst: !!barst };
  }

  /*
   Een kogel op een auto met een eigen model: `obj` is wat de straal raakte, `punt` en `normaal` in de
   wereld. Glas barst, blik krijgt een gat.
  */
  function kogel(car, obj, punt, normaal) {
    if (!car || !car.mesh || !obj) return null;
    const u = car.mesh.userData;
    const glas = obj === u.glas;
    if (obj.userData.schade) return null;              // een doek dat er al zit
    // alles van de carrosserie telt (lak, de zwarte randen en stijlen, chroom), maar niet de lichtbundel
    let inBak = false;
    for (let o = obj; o; o = o.parent) if (o === (u.bak || car.mesh)) { inBak = true; break; }
    if (!glas && !inBak) return null;
    return plak(car, glas ? 'barst' : 'gat', punt, normaal, glas ? 0.42 : 0.07);
  }

  // alles weg: overgespoten, of het wrak is weer een gewone auto
  function herstel(car) {
    if (!car || !car.schade) return;
    for (const d of car.schade) if (d.parent) d.parent.remove(d);
    car.schade = [];
  }

  return { botsing, kogel, herstel, MAT };
}

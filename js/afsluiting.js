/*
 Wegafsluitingen: waar de wijk voor de speler ophoudt.

 De kaart loopt door tot in de polder, maar het spel speelt in Tinga. Rij je de
 Lemmerweg af, dan is er op een gegeven moment niets meer — en dat is geen einde,
 dat is een rand. Een afzetting is wél een einde: je ziet dat hier de weg dicht
 is, je keert om, en je hebt niet het gevoel dat het spel op is.

 Wat er staat: rood-wit gestreepte schrikhekken dwars over de weg, met aan
 weerszijden een baken. De streping wordt op een canvas getekend, net als alle
 andere texturen in dit spel.

 En wat je niet ziet: de botsdoos loopt links en rechts door tot `muur` meter
 breed. Zonder dat rij je er via de berm gewoon omheen, en dan is de afzetting
 een decorstuk in plaats van een grens. Hij is vier meter hoog, zodat je er ook
 te voet niet overheen springt.

 De plekken staan in data/stijl/omgeving.json onder `wegafsluitingen`; de
 richting en de breedte komen uit de rijbaan-as van de BGT.
*/
import * as THREE from 'three';

const HEK_H = 1.0;        // hoogte van een schrikhek
const HEK_DIK = 0.07;
const MUUR_H = 4.0;       // hoogte van de onzichtbare wand

let doekje = null;
/*
 De rood-witte streping van een schrikhek: schuine banen van vijftien centimeter,
 zoals op een Nederlands hek. Het doek is één paneel breed; hoe vaak het herhaald
 wordt volgt uit de breedte van de weg.
*/
function strepen() {
  if (doekje) return doekje;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#c8322b';
  g.save();
  g.beginPath(); g.rect(0, 0, 256, 128); g.clip();
  for (let x = -160; x < 320; x += 64) {
    g.beginPath();
    g.moveTo(x, 0); g.lineTo(x + 32, 0); g.lineTo(x + 32 + 128, 128); g.lineTo(x + 128, 128);
    g.closePath(); g.fill();
  }
  g.restore();
  // een randje rondom, zodat het paneel een rand heeft en geen vlak is
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 5;
  g.strokeRect(2.5, 2.5, 251, 123);
  doekje = new THREE.CanvasTexture(c);
  doekje.colorSpace = THREE.SRGBColorSpace;
  doekje.wrapS = THREE.RepeatWrapping;
  doekje.anisotropy = 8;
  return doekje;
}

export function bouwAfsluitingen(scene, W, plekken) {
  if (!plekken || !plekken.length) return 0;
  const paalMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.7, metalness: 0.3 });
  let n = 0;

  for (const A of plekken) {
    const l = Math.hypot(A.as[0], A.as[1]) || 1;
    const ax = A.as[0] / l, az = A.as[1] / l;          // langs de weg
    const bx = -az, bz = ax;                            // dwars erop: de hekkenlijn
    const groep = new THREE.Group();
    // het hek is iets breder dan de rijbaan, zodat de bermrand meedoet
    const breed = A.breed + 2.4;

    const doek = strepen().clone();
    doek.needsUpdate = true;
    doek.repeat.set(Math.max(2, Math.round(breed / 2)), 1);
    const paneel = new THREE.Mesh(
      new THREE.BoxGeometry(breed, HEK_H, HEK_DIK),
      [paalMat, paalMat, paalMat, paalMat,
        new THREE.MeshStandardMaterial({ map: doek, roughness: 0.85 }),
        new THREE.MeshStandardMaterial({ map: doek, roughness: 0.85 })],
    );
    paneel.position.set(A.x, 0.62, A.z);
    paneel.rotation.y = Math.atan2(bx, bz) + Math.PI / 2;
    paneel.castShadow = true;
    groep.add(paneel);

    // pootjes onder het hek en een baken aan weerszijden
    for (const t of [-0.36, 0, 0.36]) {
      const poot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.62, 0.30), paalMat);
      poot.position.set(A.x + bx * breed * t, 0.31, A.z + bz * breed * t);
      poot.rotation.y = Math.atan2(bx, bz) + Math.PI / 2;
      groep.add(poot);
    }
    for (const kant of [-1, 1]) {
      const baken = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.5, 8), paalMat);
      baken.position.set(A.x + bx * (breed / 2 + 0.5) * kant, 0.75, A.z + bz * (breed / 2 + 0.5) * kant);
      groep.add(baken);
      const kop = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.5, 0.05),
        new THREE.MeshStandardMaterial({ map: strepen(), roughness: 0.85 }));
      kop.position.set(A.x + bx * (breed / 2 + 0.5) * kant, 1.6, A.z + bz * (breed / 2 + 0.5) * kant);
      kop.rotation.y = Math.atan2(bx, bz) + Math.PI / 2;
      groep.add(kop);
    }

    scene.add(groep);
    if (W.lodAan) W.lodAan(groep, A.x, A.z, { tot: 420, straal: breed });

    /*
     De onzichtbare wand. `addCollider` wil de hoek van de lange as zelf
     (−atan2(dz, dx)) en niet de draaiing van het model; die twee schelen een
     kwartslag. De lange as is hier de hekkenlijn.
    */
    const muurBreed = Math.max(A.muur || 24, breed);
    const botsYaw = -Math.atan2(bz, bx);
    W.addCollider(A.x, A.z, muurBreed / 2, 0.5, botsYaw, MUUR_H);
    n++;
  }
  return n;
}

/*
 Grenzen zonder hek (stap 130, gevraagd: "Zorg dat speler ook niet veel verder kan dan -364.3, -613.5 dan ga je
 niemandsland in"). Dat punt ligt op de N7: daar rijdt het doorgaande verkeer over zijn eigen lijn verder, dus een
 schrikhek over de weg zou door de auto's heen staan. Alleen een onzichtbare wand dwars over de weg en de bermen,
 `muur` meter breed en zes meter hoog (een auto rijdt door alles lager dan 3,5 m). De richting komt van de
 dichtstbijzijnde rijbaan-as.
*/
export const GRENZEN = [
  { naam: 'N7 west', punt: [-364.3, -613.5], muur: 150, bron: 'gebruiker, chat 10 okt 2026' },
];
export function bouwGrenzen(W, K, lijst = GRENZEN) {
  let n = 0;
  for (const g of lijst) {
    const [px, pz] = g.punt;
    let beste = null;
    for (const as of (K && K.wegassen) || []) {
      if (!as.drive) continue;
      for (let i = 1; i < as.pts.length; i++) {
        const a = as.pts[i - 1], b = as.pts[i];
        const dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / L2));
        const d = Math.hypot(a[0] + dx * t - px, a[1] + dz * t - pz);
        if (!beste || d < beste.d) beste = { d, dx, dz };
      }
    }
    if (!beste) continue;
    const L = Math.hypot(beste.dx, beste.dz) || 1;
    const nx = -beste.dz / L, nz = beste.dx / L;            // dwars op de weg
    W.addCollider(px, pz, g.muur / 2, 0.5, -Math.atan2(nz, nx), 6);
    g.dwars = [nx, nz];
    n++;
  }
  return n;
}

/*
 Missie 13, het schrift van De Veteraan.

 De Veteraan hield bij wie hij betaalde: agenten, de man van de gemeente, en ook
 Mark en Erik. Het schrift ligt in zijn sloep in IJlst, en de politie heeft de
 kade met lint afgezet. Hier staan de twee dingen die het spel daarvoor nog niet
 had:

 - `maakSchrift`: een zwart notitieboek met een rood elastiek en de randen van
   de bladzijden, klein genoeg om op de bank van een sloep te liggen;
 - `maakLint`: rood-wit politielint tussen twee paaltjes, dat een beetje
   doorhangt en in de wind wappert.

 Beide worden bij het opstarten gemaakt en verborgen neergezet (zie js/brug.js
 en `soortenVoorbereid` in js/world.js): een materiaal dat pas midden in het
 spel ontstaat, hapert. Geen afbeeldingen: de tekst op het lint is op een doek
 getekend.
*/
import * as THREE from 'three';

export function maakSchrift(scene) {
  const groep = new THREE.Group();
  const kaft = new THREE.MeshStandardMaterial({ color: 0x17181b, roughness: 0.7 });
  const blad = new THREE.MeshStandardMaterial({ color: 0xece6d6, roughness: 0.95 });
  const band = new THREE.MeshStandardMaterial({ color: 0xa3232b, roughness: 0.6 });
  const boek = new THREE.Mesh(new THREE.BoxGeometry(0.21, 0.035, 0.15), kaft);
  boek.position.y = 0.018;
  groep.add(boek);
  // de bladzijden aan drie kanten, net binnen de kaft
  const randen = new THREE.Mesh(new THREE.BoxGeometry(0.205, 0.025, 0.146), blad);
  randen.position.set(0.003, 0.018, 0);
  groep.add(randen);
  const elastiek = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.037, 0.152), band);
  elastiek.position.set(0.07, 0.018, 0);
  groep.add(elastiek);
  groep.visible = false;
  scene.add(groep);
  return {
    groep,
    // op een plek in de wereld, of aan een ouder (de sloep) met plaatselijke maten
    zet(x, y, z, yaw = 0, ouder = null) {
      if (ouder && groep.parent !== ouder) ouder.add(groep);
      else if (!ouder && groep.parent !== scene) scene.add(groep);
      groep.position.set(x, y, z); groep.rotation.y = yaw;
    },
    toon(v) { groep.visible = !!v; },
    get zichtbaar() { return groep.visible; },
  };
}

let lintDoek = null;
function lintKaart() {
  if (lintDoek) return lintDoek;
  const c = document.createElement('canvas'); c.width = 256; c.height = 32;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f5f2ea' : '#c61f2a'; g.fillRect(i * 32, 0, 32, 32); }
  g.fillStyle = '#1b2a4a'; g.font = 'bold 19px sans-serif'; g.textBaseline = 'middle';
  g.fillText('POLITIE', 14, 17); g.fillText('POLITIE', 142, 17);
  lintDoek = new THREE.CanvasTexture(c);
  lintDoek.colorSpace = THREE.SRGBColorSpace;
  lintDoek.wrapS = THREE.RepeatWrapping;
  return lintDoek;
}

const LINT_DELEN = 10;
let lintTeller = 0;
/*
 Een stuk lint van a naar b ({x, z}), op `hoogte` boven `y`, met een paaltje aan
 elk eind. Het lint is een smalle strook die in het midden een paar centimeter
 doorhangt; `update` laat hem wapperen.
*/
export function maakLint(scene) {
  const groep = new THREE.Group();
  const paalMat = new THREE.MeshStandardMaterial({ color: 0xdadde0, roughness: 0.6, metalness: 0.3 });
  const palen = [0, 1].map(() => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.05, 8), paalMat);
    groep.add(p);
    return p;
  });
  const geo = new THREE.PlaneGeometry(1, 0.075, LINT_DELEN, 1);
  const mat = new THREE.MeshStandardMaterial({ map: lintKaart(), roughness: 0.8, side: THREE.DoubleSide });
  const lint = new THREE.Mesh(geo, mat);
  groep.add(lint);
  const basis = geo.attributes.position.array.slice();
  let lengte = 1, t = (lintTeller++ * 1.3) % 3;     // (geen Math.random bij het opstarten: zie js/brug.js)
  groep.visible = false;
  scene.add(groep);
  return {
    groep,
    span(a, b, y, hoogte = 0.95) {
      const dx = b.x - a.x, dz = b.z - a.z;
      lengte = Math.hypot(dx, dz) || 1;
      groep.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
      groep.rotation.y = Math.atan2(-dz, dx);
      palen[0].position.set(-lengte / 2, 0.525, 0);
      palen[1].position.set(lengte / 2, 0.525, 0);
      lint.position.y = hoogte;
      lint.scale.x = lengte;
      mat.map.repeat.set(Math.max(1, lengte / 2.2), 1);
    },
    toon(v) { groep.visible = !!v; },
    get zichtbaar() { return groep.visible; },
    update(dt) {
      if (!groep.visible) return;
      t += dt;
      const pos = geo.attributes.position.array;
      for (let i = 0; i < pos.length; i += 3) {
        const u = basis[i] + 0.5;                     // 0 aan het ene paaltje, 1 aan het andere
        const zak = Math.sin(u * Math.PI);
        pos[i + 1] = basis[i + 1] - zak * 0.06;
        pos[i + 2] = zak * Math.sin(t * 3.1 + u * 7) * 0.05;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

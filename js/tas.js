/*
 De tas bij de tribune van VV Sneek (missie 10).

 Een zwarte sporttas met twee hengsels, een rits over de bovenkant en een
 schouderband. Hij staat op de tegels voor de tribune en zweeft niet: het
 gele ruitje van js/bom.js wijst hem aan, de tas zelf is gewoon een tas.
 Alles is geometrie, er komt geen plaatje aan te pas.
*/
import * as THREE from 'three';

const LANG = 0.62, HOOG = 0.30, DIEP = 0.30;    // een gewone sporttas

export function maakTas(scene) {
  const groep = new THREE.Group();
  const zwart = new THREE.MeshStandardMaterial({ color: 0x1c1d21, roughness: 0.82 });
  const band = new THREE.MeshStandardMaterial({ color: 0x2c2f36, roughness: 0.7 });
  const rits = new THREE.MeshStandardMaterial({ color: 0x9a9ca2, roughness: 0.4, metalness: 0.6 });
  const logo = new THREE.MeshStandardMaterial({ color: 0xd8d8d2, roughness: 0.6 });

  // de romp: een liggende cilinder met een platte onderkant
  const romp = new THREE.Mesh(new THREE.CylinderGeometry(HOOG / 2, HOOG / 2, LANG, 16), zwart);
  romp.rotation.z = Math.PI / 2;
  romp.scale.set(1, 1, DIEP / HOOG);
  romp.position.y = HOOG / 2;
  groep.add(romp);
  const bodem = new THREE.Mesh(new THREE.BoxGeometry(LANG * 0.96, 0.04, DIEP * 0.8), band);
  bodem.position.y = 0.02;
  groep.add(bodem);
  // de rits over de bovenkant en een streepje logo op de zijkant
  const ritsje = new THREE.Mesh(new THREE.BoxGeometry(LANG * 0.86, 0.012, 0.03), rits);
  ritsje.position.y = HOOG + 0.002;
  groep.add(ritsje);
  const merk = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.005), logo);
  merk.position.set(0.12, HOOG * 0.55, DIEP / 2 + 0.003);
  groep.add(merk);
  // twee hengsels: halve ringen boven op de tas
  for (const x of [-0.12, 0.12]) {
    const hengsel = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 12, Math.PI), band);
    hengsel.position.set(x, HOOG - 0.01, 0);
    groep.add(hengsel);
  }
  // en de schouderband die er slap naast ligt
  const riem = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.006, 0.7), band);
  riem.position.set(-0.36, 0.004, 0.18);
  riem.rotation.y = 0.5;
  groep.add(riem);

  groep.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  groep.visible = false;
  scene.add(groep);
  return {
    groep,
    zet(x, y, z, yaw = 0) { groep.position.set(x, y || 0, z); groep.rotation.y = yaw; },
    toon(v) { groep.visible = !!v; },
    get zichtbaar() { return groep.visible; },
    verwijder() { scene.remove(groep); },
  };
}

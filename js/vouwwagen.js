/*
 Een vouwwagen op het gras aan de Wieken (stap 184, gevraagd met een foto: "zet rond plek en coördinaten op de foto in het gras
 een vouwwagen", plek −128,8, 7,0). Een kampeeraanhanger zoals je ze op elke camping ziet, uitgeklapt:

   - de bak: een witte aanhanger van 2,4 × 1,55 m op één as, met een grijze bies, spatborden, rode achterlichten en een
     geel kenteken (verzonnen);
   - de dissel naar voren in een V met de koppeling, een neuswiel en een disselbak voor de gasfles;
   - het deksel is naar opzij geklapt en vormt het tweede bed, op twee poten;
   - daarover de tent: beige doek met een donkergroene rand onderaan, een groen dak in een flauwe boog, ramen met
     een vliegengaas en een deur met een rits aan de achterkant, en een trapje;
   - vier uitdraaisteunen onder de hoeken van de bak.

 Alles op canvas getekend (CLAUDE.md: geen afbeeldingsbestanden), geen merknaam. Waar hij staat is gemeten, niet geraden:
 `VOUWWAGEN` in js/bouwvlak.js (de dichtstbijzijnde plek bij de gevraagde coördinaat waar de hele wagen plus een halve meter op
 het gras staat, ver genoeg van bomen, lantaarns, paden en panden; tools/vouwwagentest.mjs meet het na). Daar groeit niets
 (`inBouwvlak`), anders stak het gras door de bodem. Eén botsdoos over bak en tent, één over de dissel.

 Assen van het model: z langs de wagen (de dissel naar −z), x opzij (het uitgeklapte bed naar +x); het midden van de groep is
 het midden van de hele ligplek, zodat de doos in js/bouwvlak.js er precies omheen ligt.
*/
import * as THREE from 'three';
import { VOUWWAGEN } from './bouwvlak.js';

export const VW = {
  bakL: 2.4, bakB: 1.55, bakOnder: 0.36, bakH: 0.62, // de bak: lengte, breedte, onderkant, hoogte
  wiel: 0.29,                                       // straal van de wielen
  tentH: 0.92, dakBoog: 0.24,                       // de tentwanden boven de bak en de boog van het dak
  dissel: 1.25,                                     // hoe ver de koppeling voor de bak ligt
};

function doek(w, h, teken) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  teken(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// tentdoek: een fijne weving en naden, met de kleur van het doek
function tentDoek(basis, naad) {
  return doek(256, 256, (g, w, h) => {
    g.fillStyle = basis; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
      g.fillStyle = v; g.fillRect(Math.random() * w, Math.random() * h, 2, 1);
    }
    g.strokeStyle = naad; g.lineWidth = 2;
    for (const y of [h * 0.02, h * 0.98]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.setLineDash([5, 4]); g.lineWidth = 1;
    for (const y of [h * 0.06, h * 0.94]) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  });
}
// het kenteken: geel, verzonnen
function kenteken() {
  return doek(256, 56, (g, w, h) => {
    g.fillStyle = '#f2c200'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d3f9a'; g.fillRect(0, 0, 26, h);
    g.fillStyle = '#ffffff'; g.font = 'bold 13px sans-serif'; g.fillText('NL', 4, h - 8);
    g.fillStyle = '#111'; g.font = 'bold 38px sans-serif'; g.textBaseline = 'middle'; g.fillText('WE-38-KT', 34, h / 2 + 2);
  });
}
// het raam: donker vliegengaas in een rand
function raamDoek() {
  return doek(128, 96, (g, w, h) => {
    g.fillStyle = '#2b2f2d'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += 4) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = '#d9cfb4'; g.lineWidth = 8; g.strokeRect(0, 0, w, h);
  });
}
// de deur: hetzelfde doek met een rits in een boog
function deurDoek() {
  return doek(128, 256, (g, w, h) => {
    g.fillStyle = '#d8ccaa'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3a3a34'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(10, h); g.lineTo(10, 40); g.quadraticCurveTo(w / 2, -10, w - 10, 40); g.lineTo(w - 10, h); g.stroke();
    g.fillStyle = '#3a3a34'; g.fillRect(w - 16, 130, 8, 16);           // het lipje van de rits
  });
}

export function maakVouwwagen() {
  const V = VW;
  const groep = new THREE.Group();
  groep.name = 'vouwwagen';
  const std = (kleur, extra = {}) => new THREE.MeshStandardMaterial({ color: kleur, roughness: 0.6, ...extra });
  const M = {
    bak: std(0xf1f1ee, { roughness: 0.35 }), bies: std(0x6d7378, { roughness: 0.5 }), zwart: std(0x1c1c1c, { roughness: 0.8 }),
    staal: std(0x9ea3a8, { metalness: 0.6, roughness: 0.4 }), band: std(0x151515, { roughness: 0.9 }), velg: std(0xc9ccd0, { metalness: 0.5, roughness: 0.35 }),
    rood: std(0xc4161c, { roughness: 0.3, emissive: 0x330000 }), oranje: std(0xe58a0f, { roughness: 0.3 }),
    wand: std(0xffffff, { map: tentDoek('#d8ccaa', '#b9ab86') }), rand: std(0xffffff, { map: tentDoek('#2f4a33', '#22382a') }),
    dak: std(0xffffff, { map: tentDoek('#3d5c40', '#2a4430'), side: THREE.DoubleSide }),
    raam: std(0xffffff, { map: raamDoek(), roughness: 0.9 }), deur: std(0xffffff, { map: deurDoek() }),
    plaat: std(0xffffff, { map: kenteken(), roughness: 0.4 }), hout: std(0x8a6a44, { roughness: 0.8 }),
  };
  const doos = (w, h, d, mat, x, y, z, ry = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z); m.rotation.y = ry; groep.add(m); return m;
  };
  const staaf = (r, a, b, mat) => {        // een ronde stang van punt a naar punt b
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), L = va.distanceTo(vb);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 10), mat);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    groep.add(m); return m;
  };

  // de bak ligt aan de −x kant van de ligplek, het uitgeklapte bed aan de +x kant
  const bx = -V.bakB / 2, top = V.bakOnder + V.bakH;
  doos(V.bakB, V.bakH, V.bakL, M.bak, bx, V.bakOnder + V.bakH / 2, 0);
  doos(V.bakB + 0.012, 0.07, V.bakL + 0.012, M.bies, bx, V.bakOnder + 0.16, 0);           // de grijze bies
  doos(V.bakB + 0.02, 0.05, V.bakL + 0.02, M.zwart, bx, top - 0.02, 0);                     // de rubberen rand van het deksel
  // achterlichten, reflectoren en het kenteken (achter is +z)
  for (const s of [-1, 1]) {
    doos(0.2, 0.09, 0.03, M.rood, bx + s * 0.58, V.bakOnder + 0.26, V.bakL / 2 + 0.01);
    doos(0.05, 0.05, 0.02, M.oranje, bx + s * 0.76, V.bakOnder + 0.42, -V.bakL / 2 - 0.01);
  }
  const plaat = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.11), M.plaat);
  plaat.position.set(bx, V.bakOnder + 0.25, V.bakL / 2 + 0.02); groep.add(plaat);

  // de as met twee wielen en spatborden
  const asZ = 0.12;
  for (const s of [-1, 1]) {
    const x = bx + s * (V.bakB / 2 + 0.13);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(V.wiel, V.wiel, 0.17, 22), M.band);
    band.rotation.z = Math.PI / 2; band.position.set(x, V.wiel, asZ); groep.add(band);
    const velg = new THREE.Mesh(new THREE.CylinderGeometry(V.wiel * 0.6, V.wiel * 0.6, 0.18, 18), M.velg);
    velg.rotation.z = Math.PI / 2; velg.position.copy(band.position); groep.add(velg);
    const scherm = new THREE.Mesh(new THREE.CylinderGeometry(V.wiel + 0.06, V.wiel + 0.06, 0.22, 20, 1, true, 0, Math.PI), M.bak);
    scherm.material = M.bak; scherm.rotation.z = Math.PI / 2; scherm.rotation.y = Math.PI / 2;
    scherm.position.set(x, V.wiel + 0.01, asZ); groep.add(scherm);
  }
  staaf(0.03, [bx - V.bakB / 2 - 0.05, V.wiel, asZ], [bx + V.bakB / 2 + 0.05, V.wiel, asZ], M.staal);

  // de dissel: een V naar de koppeling, met een neuswiel en de disselbak
  const voor = -V.bakL / 2, kop = [bx, 0.42, voor - V.dissel];
  for (const s of [-1, 1]) staaf(0.035, [bx + s * 0.62, V.bakOnder + 0.05, voor + 0.15], kop, M.zwart);
  doos(0.12, 0.09, 0.26, M.staal, bx, 0.44, voor - V.dissel - 0.08);                       // de koppelingskop
  staaf(0.03, [bx + 0.18, 0.62, voor - V.dissel + 0.32], [bx + 0.18, 0.1, voor - V.dissel + 0.32], M.staal);   // het neuswiel
  const neus = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 14), M.band);
  neus.rotation.z = Math.PI / 2; neus.position.set(bx + 0.18, 0.09, voor - V.dissel + 0.32); groep.add(neus);
  doos(0.62, 0.36, 0.44, M.bak, bx, 0.66, voor - 0.42);                                     // de disselbak voor de gasfles
  doos(0.64, 0.04, 0.46, M.bies, bx, 0.86, voor - 0.42);

  // vier uitdraaisteunen onder de hoeken
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    staaf(0.025, [bx + sx * 0.68, V.bakOnder, sz * 1.05], [bx + sx * 0.68, 0.03, sz * 1.15], M.staal);
    doos(0.12, 0.02, 0.12, M.staal, bx + sx * 0.68, 0.13, sz * 1.15);
  }

  // het deksel is naar +x geklapt en draagt het tweede bed, op twee poten
  const bedX = V.bakB / 2;
  doos(V.bakB, 0.07, V.bakL, M.bak, bedX, top - 0.035, 0);
  for (const sz of [-1, 1]) {
    staaf(0.025, [bedX + V.bakB / 2 - 0.12, top - 0.07, sz * (V.bakL / 2 - 0.12)], [bedX + V.bakB / 2 - 0.12, 0.13, sz * (V.bakL / 2 - 0.12)], M.staal);
    doos(0.12, 0.02, 0.12, M.staal, bedX + V.bakB / 2 - 0.12, 0.13, sz * (V.bakL / 2 - 0.12));
  }

  // de tent: een donkergroene rand, beige wanden en een groen dak in een flauwe boog over de hele breedte
  const B = V.bakB * 2, L = V.bakL - 0.06, wy0 = top, wy1 = top + V.tentH;
  const wand = (w, h, mat, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.y = ry; groep.add(m); return m; };
  const randH = 0.16;
  for (const [x, z, ry, w] of [[0, L / 2, 0, B], [0, -L / 2, Math.PI, B], [B / 2, 0, Math.PI / 2, L], [-B / 2, 0, -Math.PI / 2, L]]) {
    wand(w, randH, M.rand, x, wy0 + randH / 2, z, ry);
    wand(w, V.tentH - randH, M.wand, x, wy0 + randH + (V.tentH - randH) / 2, z, ry);
    // en van binnen hetzelfde doek, anders kijk je door een wand heen als je ervoor staat
    wand(w, V.tentH, M.wand, x * 0.998, wy0 + V.tentH / 2, z * 0.998, ry + Math.PI);
  }
  // ramen: twee in de lange kant aan het bed, één in elke kop
  const raam = (w, h, x, y, z, ry) => wand(w, h, M.raam, x, y, z, ry);
  for (const sz of [-0.55, 0.55]) raam(0.62, 0.38, B / 2 + 0.006, wy0 + 0.56, sz, Math.PI / 2);
  raam(0.7, 0.36, B / 4, wy0 + 0.58, -L / 2 - 0.006, Math.PI);
  raam(0.62, 0.38, -B / 2 - 0.006, wy0 + 0.56, 0, -Math.PI / 2);
  // de deur met de rits aan de achterkant, boven de bak, en het trapje ervoor
  wand(0.62, V.tentH - 0.06, M.deur, bx, wy0 + (V.tentH - 0.06) / 2 + 0.03, L / 2 + 0.006, 0);
  doos(0.5, 0.03, 0.26, M.staal, bx, 0.42, V.bakL / 2 + 0.2);
  staaf(0.015, [bx - 0.23, 0.42, V.bakL / 2 + 0.3], [bx - 0.23, 0.02, V.bakL / 2 + 0.38], M.staal);
  staaf(0.015, [bx + 0.23, 0.42, V.bakL / 2 + 0.3], [bx + 0.23, 0.02, V.bakL / 2 + 0.38], M.staal);

  // het dak: een boog over x, uitgerekt over de lengte, met wat overstek
  const boog = new THREE.Shape();
  const N = 14, ov = 0.08;
  boog.moveTo(-B / 2 - ov, -0.02);
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = -B / 2 - ov + t * (B + 2 * ov);
    boog.lineTo(x, Math.sin(t * Math.PI) * V.dakBoog);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N, x = -B / 2 - ov + t * (B + 2 * ov);
    boog.lineTo(x, Math.sin(t * Math.PI) * V.dakBoog - 0.035);
  }
  const dakGeo = new THREE.ExtrudeGeometry(boog, { depth: L + 2 * ov, bevelEnabled: false });
  dakGeo.translate(0, 0, -(L + 2 * ov) / 2);
  const dak = new THREE.Mesh(dakGeo, M.dak); dak.position.y = wy1; groep.add(dak);
  // de kopgevels onder de boog dicht
  const kopVorm = new THREE.Shape();
  kopVorm.moveTo(-B / 2, 0);
  for (let i = 0; i <= N; i++) { const t = i / N; kopVorm.lineTo(-B / 2 + t * B, Math.sin(t * Math.PI) * V.dakBoog); }
  kopVorm.lineTo(B / 2, 0);
  for (const sz of [-1, 1]) {
    const k = new THREE.Mesh(new THREE.ShapeGeometry(kopVorm), new THREE.MeshStandardMaterial({ color: 0xd8ccaa, roughness: 0.7, side: THREE.DoubleSide }));
    k.position.set(0, wy1, sz * L / 2); groep.add(k);
  }
  // een spanlijn met haring aan elke hoek van het bed
  for (const sz of [-1, 1]) staaf(0.006, [B / 2, wy1 - 0.05, sz * L / 2], [B / 2 + 0.45, 0.02, sz * (L / 2 + 0.35)], M.zwart);

  groep.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { groep, M };
}

/*
 In de wereld: neerzetten op de gemeten plek, op de hoogte van het gras, met twee botsdozen. De doos over bak en tent is
 2,4 m hoog: een auto rijdt door alles onder 3,5 m (js/vehicles.js), maar dit is gras naast het pad, daar komt geen auto.
*/
export function initVouwwagen({ scene, addCollider, grondHoogte, vlakOp = null }) {
  const P = VOUWWAGEN;
  const { groep } = maakVouwwagen();
  // op het grasvlak, dat 12 cm boven nul ligt (de `y` van het vlak in de kaart; `grondHoogte` kent alleen het viaduct)
  const vlak = vlakOp ? vlakOp(P.x, P.z) : null;
  const y = Math.max(grondHoogte ? grondHoogte(P.x, P.z, 3) : 0, vlak && Number.isFinite(vlak.y) ? vlak.y : 0);
  groep.position.set(P.x, y, P.z);
  groep.rotation.y = P.yaw;
  scene.add(groep);
  const c = Math.cos(P.yaw), s = Math.sin(P.yaw);
  const wereld = (lx, lz) => ({ x: P.x + lx * c + lz * s, z: P.z - lx * s + lz * c });
  const dozen = [];
  if (addCollider) {
    dozen.push(addCollider(P.x, P.z, VW.bakB, VW.bakL / 2, P.yaw, 2.4));
    const d = wereld(-VW.bakB / 2, -VW.bakL / 2 - VW.dissel / 2);
    dozen.push(addCollider(d.x, d.z, 0.4, VW.dissel / 2 + 0.1, P.yaw, 0.9));
  }
  return { groep, dozen, plek: { ...P, y } };
}

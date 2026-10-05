/*
 De vuilniswagen (stap 125, naar foto's van de gebruiker): een gele DAF CF van de gemeente Súdwest-Fryslân,
 een zijlader met een grijze bumper, een zwarte grille met DAF erop, een zwaailicht op het dak, een rode
 grijparm aan de rechterkant en het logo van de gemeente op de bak. Ruim negen meter lang.

 Geen plaatjesbestanden: alle doeken worden hier op een canvas getekend, ook het logo (de drie vormen in
 rood, blauw en groen, en "Gemeente Súdwest-Fryslân" ernaast). Het model staat met de neus naar −z, net als
 de auto's uit js/carmodel.js, en draagt dezelfde `userData` (`length`, `bak`, `glas`), zodat
 js/vehicles.js (botsen, kogels) en js/autoschade.js (deuken, barsten) er net zo mee werken. De lak-delen
 hebben `userData.lak`.

 Gemaakt bij het opstarten (js/leven.js), zodat de materialen in de scene staan als de shaders vooraf
 vertaald worden.
*/
import * as THREE from 'three';
import { rondeDoosGeo } from './wapen.js';

export const VUILNISWAGEN = {
  lengte: 9.6, breed: 2.5,
  cabine: { z0: -4.8, z1: -2.5, y0: 0.55, y1: 3.15 },
  bak: { z0: -2.35, z1: 4.7, y0: 1.0, y1: 3.55 },
  wiel: 0.52, assen: [-3.75, 2.35, 3.75],
};
const GEEL = '#f4cf12', GRIJS = '#8a8f94', ZWART = '#1b1d20';

function doek(b, h, teken) {
  const c = document.createElement('canvas'); c.width = b; c.height = h;
  teken(c.getContext('2d'), b, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/*
 Het logo van de gemeente. Links drie vormen naast elkaar — een rode met een halve schijf, een blauwe kom
 en een groene t — en daarnaast in grijs "Gemeente" en daaronder "Súdwest" vet en schuin, "-Fryslân" gewoon.
 `x, y` is linksboven, `h` de hoogte van de vormen.
*/
export function tekenLogo(g, x, y, h, { tekst = true } = {}) {
  const e = h / 10;
  // rood: een staande balk met een halve schijf eronder naar links
  g.fillStyle = '#b01f3f';
  g.beginPath();
  g.moveTo(x + 2.2 * e, y); g.lineTo(x + 4.2 * e, y); g.lineTo(x + 4.2 * e, y + 10 * e); g.lineTo(x + 2.2 * e, y + 10 * e);
  g.closePath(); g.fill();
  g.beginPath(); g.moveTo(x, y + 4.4 * e); g.lineTo(x + 2.4 * e, y + 4.4 * e); g.lineTo(x + 2.4 * e, y + 3.2 * e); g.lineTo(x, y + 3.2 * e); g.fill();
  g.beginPath(); g.arc(x + 2.4 * e, y + 5.4 * e, 3.6 * e, Math.PI * 0.5, Math.PI * 1.5, false); g.closePath(); g.fill();
  g.beginPath(); g.arc(x + 4.2 * e, y + 6.4 * e, 3.4 * e, -Math.PI * 0.5, Math.PI * 0.5, false); g.closePath(); g.fill();
  // blauw: een kom met een schuine rechterkant
  const bx = x + 8.4 * e;
  g.fillStyle = '#4eaee3';
  g.beginPath();
  g.moveTo(bx, y + 3.4 * e); g.lineTo(bx + 2.2 * e, y + 3.4 * e); g.lineTo(bx + 2.2 * e, y + 7.2 * e);
  g.lineTo(bx + 4.2 * e, y + 7.2 * e); g.lineTo(bx + 4.2 * e, y + 3.4 * e); g.lineTo(bx + 6.6 * e, y + 3.4 * e);
  g.lineTo(bx + 6.0 * e, y + 10 * e); g.lineTo(bx + 1.6 * e, y + 10 * e);
  g.quadraticCurveTo(bx, y + 10 * e, bx, y + 8.2 * e);
  g.closePath(); g.fill();
  // groen: een t
  const tx = bx + 7.4 * e;
  g.fillStyle = '#9bc53d';
  g.fillRect(tx + 1.0 * e, y, 2.4 * e, 10 * e);
  g.fillRect(tx + 1.0 * e, y + 3.4 * e, 4.2 * e, 2.0 * e);
  g.beginPath(); g.moveTo(tx + 1.0 * e, y + 10 * e); g.lineTo(tx - 0.8 * e, y + 10 * e); g.lineTo(tx + 1.0 * e, y + 7.6 * e); g.fill();
  if (!tekst) return tx + 6 * e;
  const sx = tx + 7.4 * e;
  g.fillStyle = '#6b6d70';
  g.textBaseline = 'alphabetic';
  g.font = `${Math.round(3.4 * e)}px Arial, Helvetica, sans-serif`;
  g.fillText('Gemeente', sx, y + 3.9 * e);
  g.font = `italic bold ${Math.round(5.0 * e)}px Arial, Helvetica, sans-serif`;
  g.fillText('Súdwest', sx, y + 9.8 * e);
  const w = g.measureText('Súdwest').width;
  g.font = `${Math.round(5.0 * e)}px Arial, Helvetica, sans-serif`;
  g.fillText('-Fryslân', sx + w + 0.3 * e, y + 9.8 * e);
  return sx + w + g.measureText('-Fryslân').width;
}

// de zijkant van de bak: geel, met het grote logo op een witte plaat, strepen en de luiken
function bakZij() {
  return doek(1024, 384, (g, b, h) => {
    g.fillStyle = GEEL; g.fillRect(0, 0, b, h);
    // de ribben van de bak
    g.fillStyle = 'rgba(0,0,0,0.10)';
    for (const x of [8, b - 14]) g.fillRect(x, 0, 6, h);
    g.fillRect(0, 10, b, 4); g.fillRect(0, h - 26, b, 6);
    // de witte plaat met het logo
    g.fillStyle = '#ffffff';
    const px = 120, py = 92, pw = 760, ph = 170;
    g.beginPath(); g.roundRect ? g.roundRect(px, py, pw, ph, 14) : g.rect(px, py, pw, ph); g.fill();
    tekenLogo(g, px + 34, py + 30, 110);
    // het onderste stuk: een grijze rand met reflectoren
    g.fillStyle = '#5b6066'; g.fillRect(0, h - 20, b, 20);
    g.fillStyle = '#ff8a1a';
    for (let x = 40; x < b; x += 160) g.fillRect(x, h - 16, 26, 10);
    // een luik
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3;
    g.strokeRect(910, 150, 70, 120);
  });
}
function bakAchter() {
  return doek(256, 256, (g, b, h) => {
    g.fillStyle = GEEL; g.fillRect(0, 0, b, h);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 4; g.strokeRect(14, 14, b - 28, h - 40);
    // rood-witte strepen onderaan
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#d8232a'; g.beginPath(); g.moveTo(i * 32, h); g.lineTo(i * 32 + 32, h); g.lineTo(i * 32 + 48, h - 22); g.lineTo(i * 32 + 16, h - 22); g.fill(); }
    // achterlichten
    g.fillStyle = '#c4141a'; g.fillRect(10, h - 64, 34, 20); g.fillRect(b - 44, h - 64, 34, 20);
    g.fillStyle = '#ff9a1a'; g.fillRect(10, h - 86, 34, 16); g.fillRect(b - 44, h - 86, 34, 16);
  });
}
// de voorkant van de cabine: bumper, grille met DAF, koplampen, het kleine logo; de ruit is een eigen vlak
function cabineVoor() {
  return doek(256, 288, (g, b, h) => {
    // y = 0 is de bovenkant van de cabine (3,15 m), y = 288 de onderkant (0,55 m): 1 px ≈ 9 mm
    g.fillStyle = GEEL; g.fillRect(0, 0, b, h);
    // zonneklep en dakrand
    g.fillStyle = ZWART; g.fillRect(0, 0, b, 34);
    g.fillStyle = '#c9ccd0'; g.fillRect(40, 8, b - 80, 10);
    // waar de ruit zit (eigen vlak): donker, voor als je er schuin langs kijkt
    g.fillStyle = '#20262c'; g.fillRect(10, 40, b - 20, 92);
    // het logo klein onder de ruit
    g.save(); g.translate(150, 146); tekenLogo(g, 0, 0, 12, { tekst: false }); g.restore();
    g.fillStyle = '#6b6d70'; g.font = 'italic bold 9px Arial'; g.fillText('Súdwest-Fryslân', 186, 156);
    // de grille
    g.fillStyle = '#c9ccd0'; g.fillRect(40, 166, b - 80, 22);
    g.fillStyle = '#3a3d42'; g.font = 'bold 20px Arial'; g.textAlign = 'center'; g.fillText('DAF', b / 2, 184); g.textAlign = 'left';
    g.fillStyle = ZWART; g.fillRect(40, 190, b - 80, 52);
    g.fillStyle = '#2d3136';
    for (let y = 196; y < 240; y += 9) g.fillRect(46, y, b - 92, 4);
    // koplampen
    g.fillStyle = '#e8edf2'; g.fillRect(8, 214, 30, 20); g.fillRect(b - 38, 214, 30, 20);
    g.fillStyle = '#ff9a1a'; g.fillRect(8, 236, 30, 6); g.fillRect(b - 38, 236, 30, 6);
    // de bumper, grijs met een treeplank
    g.fillStyle = '#9da2a7'; g.fillRect(0, 248, b, 40);
    g.fillStyle = '#6e7378'; g.fillRect(0, 248, b, 4);
    // het kenteken
    g.fillStyle = '#f6c400'; g.fillRect(b / 2 - 34, 262, 68, 16);
    g.fillStyle = '#111'; g.font = 'bold 12px Arial'; g.textAlign = 'center'; g.fillText('44-BLG-6', b / 2, 275); g.textAlign = 'left';
  });
}
function cabineZij(spiegel) {
  return doek(256, 288, (g, b, h) => {
    g.fillStyle = GEEL; g.fillRect(0, 0, b, h);
    if (spiegel) { g.translate(b, 0); g.scale(-1, 1); }
    // dakrand
    g.fillStyle = ZWART; g.fillRect(0, 0, b, 30);
    // het zijraam en de deur (de neus is links)
    g.fillStyle = '#20262c'; g.fillRect(14, 40, 150, 92);
    g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 3; g.strokeRect(10, 36, 160, 210);
    g.fillStyle = '#3a3d42'; g.fillRect(140, 150, 20, 6);            // deurgreep
    // het groene vlak met het logo, achter de deur
    g.fillStyle = '#9bc53d'; g.fillRect(186, 140, 50, 70);
    g.save(); g.translate(22, 158); tekenLogo(g, 0, 0, 14, { tekst: false }); g.restore();
    // de opstap en de grijze onderkant
    g.fillStyle = '#9da2a7'; g.fillRect(0, 238, b, 50);
    g.fillStyle = '#5b6066'; g.fillRect(20, 252, 60, 8); g.fillRect(20, 270, 60, 8);
    if (spiegel) g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#3a3d42'; g.font = 'bold 13px Arial';
    g.fillText(spiegel ? '' : 'R 38-18', 186, 230);
  });
}

export function maakVuilniswagen() {
  const V = VUILNISWAGEN, C = V.cabine, B = V.bak, W = V.breed;
  const g = new THREE.Group();
  const bak = new THREE.Group(); g.add(bak);
  const geel = new THREE.MeshStandardMaterial({ color: 0xf4cf12, roughness: 0.45, metalness: 0.1 });
  const grijs = new THREE.MeshStandardMaterial({ color: 0x8a8f94, roughness: 0.6, metalness: 0.3 });
  const zwart = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.7 });
  const rood = new THREE.MeshStandardMaterial({ color: 0x9e1b22, roughness: 0.55, metalness: 0.2 });
  const band = new THREE.MeshStandardMaterial({ color: 0x151617, roughness: 0.9 });
  const velg = new THREE.MeshStandardMaterial({ color: 0xc8cbce, roughness: 0.35, metalness: 0.7 });
  const zwaai = new THREE.MeshStandardMaterial({ color: 0xff9a12, emissive: 0xff7a00, emissiveIntensity: 0.6, roughness: 0.4 });
  const glas = new THREE.MeshStandardMaterial({ color: 0x1d252c, roughness: 0.08, metalness: 0.4 });
  const m = (kaart) => new THREE.MeshStandardMaterial({ map: kaart, roughness: 0.45, metalness: 0.1 });
  const zij = bakZij(), achter = bakAchter();

  // de cabine: [+x, −x, +y, −y, +z, −z]; de neus is −z
  // (een gewone doos: `rondeDoosGeo` knijpt de buitenste vakjes tot de afronding, en dan viel van een doek
  // alleen het midden in beeld — de grille en de bumper verdwenen in de rand)
  const cabGeo = new THREE.BoxGeometry(W, C.y1 - C.y0, C.z1 - C.z0);
  const cabMat = [m(cabineZij(true)), m(cabineZij(false)), geel, zwart, geel, m(cabineVoor())];
  const cab = new THREE.Mesh(cabGeo, cabMat);
  cab.position.set(0, (C.y0 + C.y1) / 2, (C.z0 + C.z1) / 2);
  cab.userData.lak = true; cab.castShadow = true;
  bak.add(cab);
  // de voorruit, een eigen vlak (voor de barsten van js/autoschade.js)
  const ruit = new THREE.Mesh(new THREE.BoxGeometry(W - 0.22, 0.82, 0.03), glas);
  ruit.position.set(0, C.y1 - 0.42 - 0.45, C.z0 - 0.005);
  ruit.rotation.x = -0.06;
  bak.add(ruit);
  // de bak: [+x, −x, +y, −y, +z, −z]
  const bakGeo = new THREE.BoxGeometry(W, B.y1 - B.y0, B.z1 - B.z0);
  // (een gewone doos zet het doek aan beide kanten leesbaar neer: links van achter naar voren, rechts andersom)
  const zijMat = m(zij);
  const bakMesh = new THREE.Mesh(bakGeo, [zijMat, zijMat, geel, zwart, m(achter), geel]);
  bakMesh.position.set(0, (B.y0 + B.y1) / 2, (B.z0 + B.z1) / 2);
  bakMesh.userData.lak = true; bakMesh.castShadow = true;
  bak.add(bakMesh);
  // de kap boven de laadopening, net achter de cabine
  const kap = new THREE.Mesh(rondeDoosGeo(W, 0.5, 0.9, 0.06), geel);
  kap.position.set(0, B.y1 + 0.2, B.z0 + 0.5); kap.userData.lak = true; bak.add(kap);
  // het chassis en de zijafscherming
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, V.lengte - 0.6), zwart);
  chassis.position.set(0, 0.78, 0); bak.add(chassis);
  for (const s of [-1, 1]) {
    const lat = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 4.4), grijs);
    lat.position.set(s * (W / 2 - 0.08), 0.72, -0.4); bak.add(lat);
    const lat2 = lat.clone(); lat2.position.y = 0.52; bak.add(lat2);
    // spiegels aan een beugel
    const spiegel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.22), zwart);
    spiegel.position.set(s * (W / 2 + 0.22), 2.35, C.z0 + 0.35); bak.add(spiegel);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.04, 0.04), zwart);
    arm.position.set(s * (W / 2 + 0.1), 2.45, C.z0 + 0.35); bak.add(arm);
  }
  // de grijparm van de zijlader, rechts achter de cabine
  const grijper = new THREE.Group();
  const paal = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.6, 0.22), rood); paal.position.y = 0.8; grijper.add(paal);
  const klauw = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.6), zwart); klauw.position.set(0.1, 0.4, 0); grijper.add(klauw);
  grijper.position.set(W / 2 + 0.16, 1.05, B.z0 + 0.6);
  bak.add(grijper);
  // het zwaailicht op het dak
  for (const x of [-0.5, 0.5]) {
    const z = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.16), zwaai);
    z.position.set(x, C.y1 + 0.06, C.z0 + 0.35); bak.add(z);
  }
  // de wielen: voor enkel, achter een tandem met dubbele banden
  const bandGeo = new THREE.CylinderGeometry(V.wiel, V.wiel, 0.32, 20); bandGeo.rotateZ(Math.PI / 2);
  const velgGeo = new THREE.CylinderGeometry(V.wiel * 0.55, V.wiel * 0.55, 0.33, 14); velgGeo.rotateZ(Math.PI / 2);
  for (const az of V.assen) for (const s of [-1, 1]) {
    const x = s * (W / 2 - 0.2);
    const b1 = new THREE.Mesh(bandGeo, band); b1.position.set(x, V.wiel, az); b1.castShadow = true; g.add(b1);
    const v1 = new THREE.Mesh(velgGeo, velg); v1.position.set(x + s * 0.005, V.wiel, az); g.add(v1);
  }
  g.userData = { length: V.lengte, bak, glas: ruit, oog: { x: -0.6, y: 2.4, z: C.z0 + 0.8 }, vuilnis: true };
  return g;
}

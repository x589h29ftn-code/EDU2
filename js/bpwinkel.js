/*
 De shop van BP Slump Oil aan de Lemmerweg 63, van binnen (stap 160). Gevraagd: "Maak de BP zo dat je er in kan gaan met
 schuifdeuren net als het autogarage. Met een balie en medewerker erachter. Voor nu kan je er niks dan rondlopen. Ook
 exterieurfoto voor details." Met foto's van de gebruiker: buiten een lage shop in donkerrode baksteen met een groene
 boeiboord met "shop" en een glazen pui naar de luifel; binnen een lichte tegelvloer, een systeemplafond met spots,
 gondels met snoep en chips, een koelvitrine met flessen, een wand "ZOETWAREN", een groene wand "Bedankt voor uw bezoek",
 een rode ijsvriezer en een koffiehoek.

 Het pand (BAG 0091100000004556, een L) en zijn assenstelsel staan in js/bouwvlak.js (`BP_WINKEL`, `bpWereld`,
 `bpLokaal`): `u` langs de voorgevel naar het oosten, `w` de diepte in (de voorgevel op w = 0 in het westdeel en op
 w = −0,75 in het oostdeel, naar de luifel toe). js/kaartwereld.js slaat de geometrie én de botsdozen van het pand over
 (`BINNEN_PANDEN`); hier staan de gevels met een gat voor de schuifdeur, en de inrichting, met eigen botsdozen.

 Alle getallen staan in `BP`. Alles op canvas, enkelzijdig; elke muur heeft een buiten- en een binnenkant.
*/
import * as THREE from 'three';
import { BP_WINKEL, bpWereld } from './bouwvlak.js';
import { heliosDoek } from './tankstation.js';
import { Persoon } from './persoon.js';
import { registreer } from './omstanders.js';

export const BP = {
  hoog: 4.8,            // de bovenkant van de muren (de goot in de 3D BAG: 4,81)
  plafond: 3.1,         // het systeemplafond binnen
  dik: 0.25,            // de muren
  pui: [0.3, 3.2],      // de glazen pui aan de voorkant: van, tot
  deur: { u0: 13.6, u1: 15.8, hoog: 2.4 },   // de schuifdeur in de voorgevel van het oostdeel
  deurBereik: 3.5,      // zo dichtbij gaat de deur open (binnen of buiten)
  deurTijd: [0.6, 0.8], // open, dicht (s)
  botsH: 2.6,           // de hoogte van de dozen van de inrichting
};

// ------------------------------------------------------------------ doeken
let zaad = 23;
const ruis = () => { zaad = (zaad * 16807) % 2147483647; return zaad / 2147483647; };
const doek = (b, h, teken, herhaal = true) => {
  const c = document.createElement('canvas'); c.width = b; c.height = h;
  teken(c.getContext('2d'), b, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (herhaal) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};
// donkerrode baksteen: een tegel van 1 × 1 m (lagen van 6,25 cm, stenen van 21 cm)
function baksteenDoek() {
  return doek(256, 256, (g, b, h) => {
    g.fillStyle = '#5a5550'; g.fillRect(0, 0, b, h);
    const laag = h / 16, steen = b / 4.7;
    for (let r = 0; r < 16; r++) {
      const sch = (r % 2) * steen / 2;
      for (let k = -1; k < 6; k++) {
        const c = 70 + ruis() * 30;
        g.fillStyle = `rgb(${c + 40},${c * 0.45},${c * 0.32})`;
        g.fillRect(k * steen + sch + 1.5, r * laag + 1.5, steen - 3, laag - 3);
      }
    }
  });
}
function pleisterDoek() {
  return doek(128, 128, (g, b, h) => {
    g.fillStyle = '#dcdcd6'; g.fillRect(0, 0, b, h);
    for (let i = 0; i < 900; i++) { const c = 205 + ruis() * 30; g.fillStyle = `rgba(${c},${c},${c - 4},0.4)`; g.fillRect(ruis() * b, ruis() * h, 2, 2); }
  });
}
// de tegelvloer: tegels van 60 cm (een doek van 1,2 m: twee bij twee), lichtgrijs met voegen
function vloerDoek() {
  return doek(256, 256, (g, b, h) => {
    const t = b / 2;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const c = 150 + ruis() * 18;
      g.fillStyle = `rgb(${c},${c - 2},${c - 6})`; g.fillRect(i * t, j * t, t, t);
      for (let k = 0; k < 300; k++) { const d = c - 15 + ruis() * 30; g.fillStyle = `rgba(${d},${d},${d - 4},0.5)`; g.fillRect(i * t + ruis() * t, j * t + ruis() * t, 2, 2); }
    }
    g.fillStyle = '#6f6c66';
    for (let i = 0; i <= 2; i++) { g.fillRect(i * t - 1.5, 0, 3, h); g.fillRect(0, i * t - 1.5, b, 3); }
  });
}
// het systeemplafond: platen van 60 cm, een tegel van 1,8 m met in het midden een ronde spot
function plafondDoek(licht = false) {
  return doek(270, 270, (g, b, h) => {
    const t = b / 3;
    g.fillStyle = licht ? '#000' : '#a9a8a3'; g.fillRect(0, 0, b, h);
    if (!licht) {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        for (let k = 0; k < 160; k++) { const d = 150 + ruis() * 30; g.fillStyle = `rgba(${d},${d},${d},0.35)`; g.fillRect(i * t + ruis() * t, j * t + ruis() * t, 2, 2); }
      }
      g.fillStyle = '#7b7a76';
      for (let i = 0; i <= 3; i++) { g.fillRect(i * t - 2, 0, 4, h); g.fillRect(0, i * t - 2, b, 4); }
    }
    // de spot
    g.fillStyle = licht ? '#fff6dc' : '#e8e4da';
    g.beginPath(); g.arc(b / 2, h / 2, t * 0.22, 0, Math.PI * 2); g.fill();
    if (!licht) { g.strokeStyle = '#8d8b85'; g.lineWidth = 3; g.stroke(); }
  });
}
// verpakkingen op een schap: rijen dozen en zakken in felle kleuren, met de rand van de plank (een tegel van 1 m breed en
// 1,5 m hoog: vijf planken)
const FEL = ['#d8262d', '#f2c418', '#1f5fb4', '#f07d18', '#2e9b48', '#7a3c96', '#f4f1ea', '#e64d8b', '#8a4b2a', '#13a3c9'];
function schapDoek(soort = 'snoep') {
  return doek(256, 384, (g, b, h) => {
    g.fillStyle = '#3b3f43'; g.fillRect(0, 0, b, h);
    const planken = 5, ph = h / planken;
    for (let p = 0; p < planken; p++) {
      const y0 = p * ph;
      let x = 4;
      while (x < b - 6) {
        const kl = FEL[Math.floor(ruis() * FEL.length)];
        if (soort === 'zak') {
          const w = 22 + ruis() * 20, hh = ph * (0.55 + ruis() * 0.32);
          g.fillStyle = kl; g.beginPath(); g.moveTo(x, y0 + ph - 8); g.lineTo(x + 2, y0 + ph - 8 - hh); g.lineTo(x + w - 2, y0 + ph - 8 - hh); g.lineTo(x + w, y0 + ph - 8); g.fill();
          g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x + 2, y0 + ph - 8 - hh + 4, Math.max(2, w * 0.25), hh * 0.3);
          x += w + 1;
        } else {
          // snoep: een vak van één soort, twee of drie lage pakjes op elkaar (repen, zakjes, rolletjes), met een etiket
          const w = 26 + ruis() * 22, lagen = 2 + Math.floor(ruis() * 2), lh = (ph - 14) / 3.2;
          for (let l = 0; l < lagen; l++) {
            const yy = y0 + ph - 8 - (l + 1) * lh;
            g.fillStyle = kl; g.fillRect(x, yy + 1, w - 3, lh - 2);
            g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(x + w * 0.25, yy + lh * 0.3, w * 0.4, lh * 0.35);
            g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, yy + lh - 4, w - 3, 3);
          }
          x += w + 2;
        }
      }
      g.fillStyle = '#8c9196'; g.fillRect(0, y0 + ph - 8, b, 8);            // de plankrand
      g.fillStyle = '#f2f2f2'; for (let k = 6; k < b; k += 40) g.fillRect(k, y0 + ph - 7, 14, 5);   // prijskaartjes
    }
  });
}
// de koelvitrine: flessen en blikjes op vijf planken, een tegel van 1 m breed en 1,8 m hoog
function koelDoek() {
  return doek(256, 460, (g, b, h) => {
    g.fillStyle = '#e9eef0'; g.fillRect(0, 0, b, h);
    const planken = 5, ph = h / planken, kl = ['#2a6fd6', '#1b8a3c', '#e9e9e9', '#d23a2b', '#f4c20d', '#57b7e8', '#2b2b2b', '#ff7f1e'];
    for (let p = 0; p < planken; p++) {
      const y0 = p * ph;
      let x = 4;
      while (x < b - 10) {
        const w = 13 + ruis() * 8, hh = ph * (0.6 + ruis() * 0.25), c = kl[Math.floor(ruis() * kl.length)];
        g.fillStyle = c; g.fillRect(x, y0 + ph - 6 - hh * 0.75, w - 2, hh * 0.75);
        g.fillRect(x + w * 0.3, y0 + ph - 6 - hh, w * 0.35, hh * 0.3);                  // de hals
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + 2, y0 + ph - 6 - hh * 0.6, 3, hh * 0.4);
        x += w + 1;
      }
      g.fillStyle = '#9aa3a8'; g.fillRect(0, y0 + ph - 6, b, 6);
    }
  });
}
// de tabakswand achter de balie: vakjes met kleine pakjes
function tabakDoek() {
  return doek(256, 256, (g, b, h) => {
    g.fillStyle = '#26282b'; g.fillRect(0, 0, b, h);
    for (let r = 0; r < 10; r++) for (let k = 0; k < 12; k++) {
      g.fillStyle = ['#e4e4e4', '#c9c9c9', '#3a5ea8', '#b8312f', '#d8b03a', '#5a5a5a'][Math.floor(ruis() * 6)];
      g.fillRect(k * b / 12 + 2, r * h / 10 + 3, b / 12 - 4, h / 10 - 6);
    }
  });
}
// een bord met tekst
function bordDoek(tekst, achter, voor, { font = 'bold', b = 1024, h = 128, klein = false } = {}) {
  return doek(b, h, (g, B, H) => {
    g.fillStyle = achter; g.fillRect(0, 0, B, H);
    g.fillStyle = voor; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${font} ${Math.round(klein ? Math.min(H / tekst.split('\n').length * 0.62, B * 0.2) : H * 0.56)}px "Arial", "Helvetica", sans-serif`;
    const regels = tekst.split('\n');
    // te breed: kleiner tot de langste regel past
    let px = parseInt(g.font.match(/(\d+)px/)[1], 10);
    while (px > 8 && Math.max(...regels.map(r => g.measureText(r).width)) > B * 0.86) { px -= 4; g.font = g.font.replace(/\d+px/, `${px}px`); }
    regels.forEach((r, i) => g.fillText(r, B / 2, H * (i + 0.5) / regels.length + (regels.length > 1 ? 0 : 2)));
  }, false);
}
// tijdschriften en kranten in een rek: schuin gestapelde omslagen (een tegel van 1 m breed, 1,2 m hoog: vier vakken)
function bladenDoek() {
  return doek(256, 320, (g, b, h) => {
    g.fillStyle = '#4a4e52'; g.fillRect(0, 0, b, h);
    const vak = h / 4;
    for (let r = 0; r < 4; r++) for (let k = 0; k < 5; k++) {
      const x = 4 + k * (b - 8) / 5, y = r * vak + 8, w = (b - 8) / 5 - 6, hh = vak - 16;
      g.fillStyle = r === 3 ? '#e9e6dc' : FEL[Math.floor(ruis() * FEL.length)]; g.fillRect(x, y, w, hh);
      g.fillStyle = r === 3 ? '#222' : '#ffffff'; g.fillRect(x + 3, y + 4, w - 6, hh * 0.16);              // de titel
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x + w * 0.2, y + hh * 0.35, w * 0.6, hh * 0.45);          // de foto
      if (r === 3) { g.fillStyle = '#9a978f'; for (let l = 0; l < 6; l++) g.fillRect(x + 3, y + hh * 0.3 + l * 7, w - 6, 2); }
    }
  });
}
// olie, ruitenvloeistof en autospullen: flessen met dop op drie planken (1 m × 1,2 m)
function olieDoek() {
  return doek(256, 300, (g, b, h) => {
    g.fillStyle = '#3b3f43'; g.fillRect(0, 0, b, h);
    const ph = h / 3, kl = ['#1c1c1c', '#f2c418', '#1f5fb4', '#c8202a', '#2e9b48', '#e9e9e9'];
    for (let p = 0; p < 3; p++) {
      let x = 6;
      while (x < b - 24) {
        const w = 20 + ruis() * 10, hh = ph * (0.55 + ruis() * 0.25), y = (p + 1) * ph - 7 - hh;
        g.fillStyle = kl[Math.floor(ruis() * kl.length)]; g.fillRect(x, y + 8, w, hh - 8);
        g.fillRect(x + w * 0.55, y, w * 0.3, 9);                                  // de dop
        g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x + 3, y + hh * 0.45, w - 6, hh * 0.25);
        x += w + 4;
      }
      g.fillStyle = '#8c9196'; g.fillRect(0, (p + 1) * ph - 7, b, 7);
    }
  });
}
// het menubord boven de balie: koffie en broodjes in witte letters op zwart
function menuDoek() {
  return doek(1024, 320, (g, b, h) => {
    g.fillStyle = '#16181a'; g.fillRect(0, 0, b, h);
    g.fillStyle = '#00843d'; g.fillRect(0, 0, b, 56);
    g.fillStyle = '#ffffff'; g.font = 'bold 40px Arial, sans-serif'; g.textBaseline = 'middle';
    g.fillText('koffie & broodjes', 24, 30);
    g.font = '30px Arial, sans-serif';
    const regels = [['Koffie', '2,50'], ['Cappuccino', '2,95'], ['Latte macchiato', '3,25'], ['Broodje kaas', '3,49'],
      ['Saucijzenbroodje', '2,49'], ['Croissant', '1,75']];
    regels.forEach(([n, pr], i) => {
      const x = i < 3 ? 30 : b / 2 + 30, y = 96 + (i % 3) * 72;
      g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.fillText(n, x, y);
      g.fillStyle = '#f2c418'; g.textAlign = 'right'; g.fillText(`€ ${pr}`, x + b / 2 - 70, y);
    });
  }, false);
}
// het ijs onder het glas van de vriezer: bakjes en hoorntjes van boven
function ijsDoek() {
  return doek(256, 128, (g, b, h) => {
    g.fillStyle = '#dfe9ee'; g.fillRect(0, 0, b, h);
    for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) {
      g.fillStyle = ['#f4f1ea', '#e64d8b', '#8a4b2a', '#1f5fb4', '#f2c418', '#2e9b48'][Math.floor(ruis() * 6)];
      g.fillRect(k * b / 9 + 2, r * h / 4 + 3, b / 9 - 4, h / 4 - 6);
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(k * b / 9 + 5, r * h / 4 + 8, 6, 4);
    }
  });
}
// de deurmat: antraciet met een groene rand
function matDoek() {
  return doek(256, 128, (g, b, h) => {
    g.fillStyle = '#00843d'; g.fillRect(0, 0, b, h);
    g.fillStyle = '#2b2d30'; g.fillRect(10, 10, b - 20, h - 20);
    for (let i = 0; i < 700; i++) { const c = 35 + ruis() * 25; g.fillStyle = `rgb(${c},${c},${c + 3})`; g.fillRect(10 + ruis() * (b - 20), 10 + ruis() * (h - 20), 2, 2); }
  }, false);
}
// het stoepbord bij de deur en de affiches op het glas
function affiche(regels, achter, voor) {
  return doek(256, 360, (g, b, h) => {
    g.fillStyle = achter; g.fillRect(0, 0, b, h);
    g.fillStyle = '#ffffff'; g.fillRect(12, 12, b - 24, h - 24);
    g.fillStyle = achter; g.fillRect(20, 20, b - 40, h - 40);
    g.fillStyle = voor; g.textAlign = 'center'; g.textBaseline = 'middle';
    regels.forEach(([t, maat], i) => { g.font = `bold ${maat}px Arial, sans-serif`; g.fillText(t, b / 2, 70 + i * (h - 120) / Math.max(1, regels.length - 1)); });
  }, false);
}
// een wandklok
function klokDoek() {
  return doek(128, 128, (g, b, h) => {
    g.fillStyle = '#d9dcdf'; g.fillRect(0, 0, b, h);
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2a2d30'; g.lineWidth = 6; g.stroke();
    g.fillStyle = '#2a2d30';
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillRect(64 + Math.sin(a) * 46 - 2, 64 - Math.cos(a) * 46 - 2, 4, 4); }
    g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + 26, 64 - 10); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 - 8, 64 - 42); g.stroke();
  }, false);
}
// de groene boeiboord over de voorgevel: BP-groen met witte "shop", het zonnetje erbij
function boeiDoek(lengte, waar) {
  const helios = heliosDoek(128).image;
  return doek(2048, 96, (g, b, h) => {
    g.fillStyle = '#00843d'; g.fillRect(0, 0, b, h);
    g.fillStyle = '#0a6b33'; g.fillRect(0, h - 8, b, 8);
    g.fillStyle = '#ffffff'; g.font = `italic 600 ${Math.round(h * 0.62)}px "Arial", sans-serif`;
    g.textBaseline = 'middle'; g.textAlign = 'left';
    // "shop" boven de deur: `waar` m van het begin van de `lengte` m
    const x = b * (waar / lengte);
    g.fillText('shop', x, h * 0.5);
    if (helios) g.drawImage(helios, x - h * 1.15, h * 0.08, h * 0.84, h * 0.84);
  }, false);
}

// ------------------------------------------------------------------ bouwen
export function bouwBpWinkel(scene, { addCollider, grondHoogte = () => 0 } = {}) {
  const B = BP_WINKEL, U = B.u, A = B.west, O = B.oost;
  const W = (u, w) => bpWereld(u, w);
  const yaw = Math.atan2(-U[1], U[0]);                              // de hoek van `addCollider` (zie `duwUit` in js/world.js)
  const voet = grondHoogte(...W(10, 6));
  const MAT = {
    steen: new THREE.MeshStandardMaterial({ map: baksteenDoek(), roughness: 0.9 }),
    pleister: new THREE.MeshStandardMaterial({ map: pleisterDoek(), roughness: 0.95 }),
    vloer: new THREE.MeshStandardMaterial({ map: vloerDoek(), roughness: 0.55 }),
    // (het plafond geeft zelf licht met zijn eigen doek: anders kleurt de groene grond van de hemisfeer het)
    plafond: new THREE.MeshStandardMaterial({ map: plafondDoek(), emissiveMap: plafondDoek(), emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.9 }),
    dak: new THREE.MeshStandardMaterial({ color: 0x3c3e40, roughness: 0.9 }),
    glas: new THREE.MeshStandardMaterial({ color: 0x9fb8c2, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.32, depthWrite: false }),
    kozijn: new THREE.MeshStandardMaterial({ color: 0x2a2d30, roughness: 0.5, metalness: 0.3 }),
    snoep: new THREE.MeshStandardMaterial({ map: schapDoek('snoep'), roughness: 0.6 }),
    zak: new THREE.MeshStandardMaterial({ map: schapDoek('zak'), roughness: 0.55 }),
    koel: new THREE.MeshStandardMaterial({ map: koelDoek(), emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.4 }),
    tabak: new THREE.MeshStandardMaterial({ map: tabakDoek(), roughness: 0.6 }),
    gondel: new THREE.MeshStandardMaterial({ color: 0x55595d, roughness: 0.6, metalness: 0.4 }),
    hout: new THREE.MeshStandardMaterial({ color: 0xb98a55, roughness: 0.7 }),
    balie: new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.6 }),
    balieTop: new THREE.MeshStandardMaterial({ color: 0xd8d6d0, roughness: 0.35 }),
    groen: new THREE.MeshStandardMaterial({ color: 0x00843d, roughness: 0.6 }),
    vriezer: new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.45 }),
    wit: new THREE.MeshStandardMaterial({ color: 0xf0f0ec, roughness: 0.5 }),
    zwart: new THREE.MeshStandardMaterial({ color: 0x141517, roughness: 0.4 }),
    boei: new THREE.MeshStandardMaterial({ map: boeiDoek(O.u1 - O.u0, (BP.deur.u0 + BP.deur.u1) / 2 - 0.3 - O.u0), roughness: 0.5 }),
    boeiKaal: new THREE.MeshStandardMaterial({ color: 0x00843d, roughness: 0.5 }),
    bladen: new THREE.MeshStandardMaterial({ map: bladenDoek(), roughness: 0.6 }),
    olie: new THREE.MeshStandardMaterial({ map: olieDoek(), roughness: 0.55 }),
    menu: new THREE.MeshStandardMaterial({ map: menuDoek(), emissiveMap: menuDoek(), emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.4 }),
    ijs: new THREE.MeshStandardMaterial({ map: ijsDoek(), roughness: 0.5 }),
    mat: new THREE.MeshStandardMaterial({ map: matDoek(), roughness: 1 }),
    mand: new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.5 }),
    staal: new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.35, metalness: 0.6 }),
    aanbod: new THREE.MeshStandardMaterial({ map: affiche([['2 voor', 52], ['€ 3', 96], ['Red Bull', 40], ['250 ml', 30]], '#1f5fb4', '#ffffff'), roughness: 0.6 }),
    koffieBord: new THREE.MeshStandardMaterial({ map: affiche([['Koffie', 56], ['to go', 44], ['€ 2,50', 70], ['koffie & broodjes', 26]], '#00843d', '#ffffff'), roughness: 0.6 }),
    snoepBord: new THREE.MeshStandardMaterial({ map: bordDoek('SNOEP', '#f4f4f0', '#00843d', { b: 512, h: 128 }), roughness: 0.6 }),
    chipsBord: new THREE.MeshStandardMaterial({ map: bordDoek('CHIPS & NOTEN', '#f4f4f0', '#00843d', { b: 512, h: 128, klein: true }), roughness: 0.6 }),
    autoBord: new THREE.MeshStandardMaterial({ map: bordDoek('AUTO', '#f4f4f0', '#00843d', { b: 512, h: 128 }), roughness: 0.6 }),
    klok: new THREE.MeshStandardMaterial({ map: klokDoek(), roughness: 0.5 }),
    zoet: new THREE.MeshStandardMaterial({ map: bordDoek('ZOETWAREN', '#2c2e31', '#f2f2f2'), roughness: 0.6 }),
    bedankt: new THREE.MeshStandardMaterial({ map: bordDoek('Bedankt\nvoor uw\nbezoek', '#00843d', '#ffffff', { b: 512, h: 640, klein: true }), roughness: 0.6 }),
  };
  MAT.pleister.map.repeat.set(1, 1);
  MAT.vloer.map.repeat.set(1 / 1.2, 1 / 1.2);
  MAT.plafond.map.repeat.set(1 / 1.8, 1 / 1.8); MAT.plafond.emissiveMap.repeat.set(1 / 1.8, 1 / 1.8);
  MAT.plafond.emissiveMap.wrapS = MAT.plafond.emissiveMap.wrapT = THREE.RepeatWrapping;
  MAT.snoep.map.repeat.set(1, 1 / 1.5); MAT.zak.map.repeat.set(1, 1 / 1.5);
  MAT.koel.map.repeat.set(1, 1 / 1.8);
  MAT.tabak.map.repeat.set(1 / 1.2, 1 / 1.2);

  // per materiaal één geometrie; een vlak is vier hoeken (u, y, w), uv in meters langs het vlak (of 0–1 met `heel`)
  const bak = new Map();
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpN = new THREE.Vector3();
  const P3 = (u, y, w) => { const [x, z] = W(u, w); return new THREE.Vector3(x, voet + y, z); };
  /**
   * Een vlak met de normaal naar (nu, ny, nw) in het eigen assenstelsel; de volgorde van de hoeken maakt niet uit, de
   * winding wordt zo gezet dat het vlak die kant op kijkt.
   */
  const vlak = (mat, a, b, c, d, naar, heel = false) => {
    if (!bak.has(mat)) bak.set(mat, { pos: [], uv: [] });
    const g = bak.get(mat);
    let P = [a, b, c, d].map(q => P3(q[0], q[1], q[2]));
    tmpA.subVectors(P[1], P[0]); tmpB.subVectors(P[2], P[1]); tmpN.crossVectors(tmpA, tmpB);
    const [nx, nz] = [naar[0] * U[0] - naar[2] * U[1], naar[0] * U[1] + naar[2] * U[0]];
    if (tmpN.x * nx + tmpN.y * naar[1] + tmpN.z * nz < 0) P = [P[1], P[0], P[3], P[2]];
    const breed = P[0].distanceTo(P[1]), hoog = P[1].distanceTo(P[2]);
    const uv = heel ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [breed, 0], [breed, hoog], [0, hoog]];
    for (const i of [0, 1, 2, 0, 2, 3]) { g.pos.push(P[i].x, P[i].y, P[i].z); g.uv.push(uv[i][0], uv[i][1]); }
  };
  // een staand vlak langs een lijn (u0, w0) → (u1, w1), van y0 tot y1, kijkend naar `naar` ([nu, nw])
  const staand = (mat, u0, w0, u1, w1, y0, y1, naar, heel = false) =>
    vlak(mat, [u0, y0, w0], [u1, y0, w1], [u1, y1, w1], [u0, y1, w0], [naar[0], 0, naar[1]], heel);
  const liggend = (mat, u0, u1, w0, w1, y, omhoog) =>
    vlak(mat, [u0, y, w0], [u1, y, w0], [u1, y, w1], [u0, y, w1], [0, omhoog ? 1 : -1, 0]);
  // een doos met alle zes kanten naar buiten
  const doos = (mat, u0, u1, y0, y1, w0, w1, kanten = 'vaowbd', matVoor = null) => {
    if (kanten.includes('v')) staand(matVoor || mat, u0, w0, u1, w0, y0, y1, [0, -1]);
    if (kanten.includes('a')) staand(mat, u0, w1, u1, w1, y0, y1, [0, 1]);
    if (kanten.includes('w')) staand(mat, u0, w0, u0, w1, y0, y1, [-1, 0]);
    if (kanten.includes('o')) staand(mat, u1, w0, u1, w1, y0, y1, [1, 0]);
    if (kanten.includes('b')) liggend(mat, u0, u1, w0, w1, y1, true);
    if (kanten.includes('d')) liggend(mat, u0, u1, w0, w1, y0, false);
  };
  const dozen = [];
  const bots = (u0, u1, w0, w1, h = BP.botsH) => {
    const [cx, cz] = W((u0 + u1) / 2, (w0 + w1) / 2);
    const c = addCollider ? addCollider(cx, cz, (u1 - u0) / 2, (w1 - w0) / 2, yaw, h) : null;
    dozen.push({ u0, u1, w0, w1, h, c });
    return c;
  };

  const H = BP.hoog, D = BP.dik, [P0, P1] = BP.pui, PL = BP.plafond;
  /*
   De muren. Elke muur ligt op de rand van de voetafdruk en is D dik naar binnen: buiten steen, binnen pleister (tot
   het plafond; erboven ziet niemand het). Een muur met een pui heeft onder en boven het glas steen.
  */
  const muur = (u0, w0, u1, w1, naar, { pui = false, deur = null } = {}) => {
    // naar = de buitenkant ([nu, nw]); de binnenkant ligt D verder naar binnen
    const iu = -naar[0] * D, iw = -naar[1] * D;
    const stukken = deur ? [[u0, deur.u0], [deur.u1, u1]] : [[u0, u1]];
    if (pui) {
      staand(MAT.steen, u0, w0, u1, w1, 0, P0, naar);
      staand(MAT.steen, u0, w0, u1, w1, P1, H, naar);
      staand(MAT.pleister, u0 + iu, w0 + iw, u1 + iu, w1 + iw, P1, PL, [-naar[0], -naar[1]]);
      // het glas: één ruit over de hele pui (de deur zit erin, in zijn eigen kozijn), en kozijnstijlen om de 1,2 m
      for (const [a, b] of stukken) {
        const lw = (t) => w0 + (w1 - w0) * ((t - u0) / Math.max(1e-6, u1 - u0));
        staand(MAT.glas, a, lw(a) - naar[1] * 0.02, b, lw(b) - naar[1] * 0.02, P0, P1, naar);
        for (let t = a; t <= b + 1e-6; t += Math.max(0.6, (b - a) / Math.max(1, Math.round((b - a) / 1.2)))) {
          doos(MAT.kozijn, t - 0.04, t + 0.04, P0, P1, lw(t) - 0.06, lw(t) + 0.02);
        }
        doos(MAT.kozijn, a, b, P1 - 0.06, P1, lw(a) - 0.06, lw(a) + 0.02, 'vb');
        doos(MAT.kozijn, a, b, P0, P0 + 0.06, lw(a) - 0.06, lw(a) + 0.02, 'vb');
      }
      if (deur) {
        // boven de deur glas, en het deurkozijn
        staand(MAT.glas, deur.u0, w0 - naar[1] * 0.02, deur.u1, w0 - naar[1] * 0.02, deur.hoog + 0.08, P1, naar);
        doos(MAT.kozijn, deur.u0 - 0.08, deur.u1 + 0.08, deur.hoog, deur.hoog + 0.08, w0 - 0.08, w0 + 0.08);
        for (const t of [deur.u0, deur.u1]) doos(MAT.kozijn, t - 0.08, t, 0, deur.hoog, w0 - 0.08, w0 + 0.08);
        // onder de deur geen steen: de drempel
        doos(MAT.kozijn, deur.u0, deur.u1, 0, 0.02, w0 - 0.1, w0 + 0.1, 'b');
      }
    } else {
      staand(MAT.steen, u0, w0, u1, w1, 0, H, naar);
      staand(MAT.pleister, u0 + iu, w0 + iw, u1 + iu, w1 + iw, 0, PL, [-naar[0], -naar[1]]);
    }
    // de bovenkant van de muur (de dakrand)
    vlak(MAT.dak, [u0, H, w0], [u1, H, w1], [u1 + iu, H, w1 + iw], [u0 + iu, H, w0 + iw], [0, 1, 0]);
    // botsdozen: de muur, met een gat voor de deur
    for (const [a, b] of stukken) {
      const uu0 = Math.min(a, b), uu1 = Math.max(a, b);
      if (naar[1] !== 0) bots(uu0, uu1, Math.min(w0, w0 + iw), Math.max(w0, w0 + iw), H);
      else bots(Math.min(u0, u0 + iu), Math.max(u0, u0 + iu), Math.min(w0, w1), Math.max(w0, w1), H);
    }
  };
  // westdeel: voor (glas), west, achter; de knik naar het oostdeel; oostdeel: achter, oost, voor (glas met de deur)
  muur(A.u0, A.w0, A.u1, A.w0, [0, -1], { pui: true });
  muur(A.u0, A.w0, A.u0, A.w1, [-1, 0]);
  muur(A.u0, A.w1, A.u1, A.w1, [0, 1]);
  muur(A.u1, A.w1, A.u1, O.w1, [-1, 0]);
  muur(O.u0, O.w1, O.u1, O.w1, [0, 1]);
  muur(O.u1, O.w0, O.u1, O.w1, [1, 0]);
  muur(O.u0, O.w0, O.u1, O.w0, [0, -1], { pui: true, deur: BP.deur });
  muur(A.u1, O.w0, A.u1, A.w0, [-1, 0]);
  // het dak (bovenop) en de boeiboord met "shop" over de hele voorkant
  liggend(MAT.dak, A.u0, A.u1, A.w0, A.w1, H, true);
  liggend(MAT.dak, O.u0, O.u1, O.w0, O.w1, H, true);
  staand(MAT.boeiKaal, A.u0 - 0.02, A.w0 - 0.05, A.u1, A.w0 - 0.05, P1 + 0.35, H - 0.25, [0, -1]);
  staand(MAT.boei, O.u0, O.w0 - 0.05, O.u1 + 0.02, O.w0 - 0.05, P1 + 0.35, H - 0.25, [0, -1], true);   // het doek over de hele lengte (0–1)
  // binnen: de vloer en het plafond
  liggend(MAT.vloer, A.u0 + D, A.u1, A.w0 + D, A.w1 - D, 0.02, true);
  liggend(MAT.vloer, O.u0, O.u1 - D, O.w0 + D, O.w1 - D, 0.02, true);
  liggend(MAT.plafond, A.u0 + D, A.u1, A.w0 + D, A.w1 - D, PL, false);
  liggend(MAT.plafond, O.u0, O.u1 - D, O.w0 + D, O.w1 - D, PL, false);

  // ---- de inrichting
  // twee gondels in het oostdeel, haaks op de voorgevel, met snoep en chips aan beide kanten en een houten voet
  const gondels = [];
  for (const [uc, mat] of [[12.0, MAT.snoep], [15.6, MAT.zak]]) {
    const u0 = uc - 0.45, u1 = uc + 0.45, w0 = 3.4, w1 = 8.2;
    doos(MAT.hout, u0, u1, 0, 0.15, w0, w1, 'vaow');
    doos(MAT.gondel, u0, u1, 1.5, 1.56, w0, w1, 'vaowb');
    staand(mat, u0, w0, u0, w1, 0.15, 1.5, [-1, 0]); staand(mat, u1, w0, u1, w1, 0.15, 1.5, [1, 0]);
    doos(MAT.gondel, u0, u1, 0.15, 1.5, w0, w1, 'va');
    // het bordje bovenop
    doos(MAT.zwart, uc - 0.02, uc + 0.02, 1.56, 1.86, w0 + 0.3, w0 + 1.6, 'woab');
    bots(u0, u1, w0, w1);
    gondels.push({ u0, u1, w0, w1 });
  }
  // de koelvitrine tegen de oostmuur: een donkere kast met glas, binnen licht met flessen
  const KU0 = O.u1 - D - 0.75, KU1 = O.u1 - D;
  doos(MAT.zwart, KU0, KU1, 0, 2.15, 1.4, 10.4, 'vab', null);
  staand(MAT.koel, KU0 + 0.04, 1.6, KU0 + 0.04, 10.2, 0.2, 2.0, [-1, 0]);
  staand(MAT.glas, KU0 - 0.01, 1.4, KU0 - 0.01, 10.4, 0.15, 2.05, [-1, 0]);
  for (let w = 1.4; w <= 10.4 + 1e-6; w += 1.5) doos(MAT.kozijn, KU0 - 0.04, KU0, 0.15, 2.05, w - 0.03, w + 0.03, 'vawo');
  bots(KU0 - 0.05, KU1, 1.4, 10.4);
  // de achterwand van het oostdeel: schappen met zoetwaren, en het bord erboven
  const AW = O.w1 - D;
  doos(MAT.gondel, 10.2, KU0 - 0.3, 0, 1.95, AW - 0.55, AW, 'wob');
  staand(MAT.snoep, 10.2, AW - 0.56, KU0 - 0.3, AW - 0.56, 0.1, 1.9, [0, -1]);
  bots(10.2, KU0 - 0.3, AW - 0.55, AW);
  staand(MAT.zoet, 11.5, AW - 0.02, 17.0, AW - 0.02, 2.3, 2.85, [0, -1], true);
  // de groene wand bij de deur (binnen, tegen de oostmuur aan de voorkant)
  staand(MAT.bedankt, O.u1 - D - 0.02, O.w0 + D + 0.1, O.u1 - D - 0.02, 1.25, 0.2, 2.6, [-1, 0], true);
  // de rode ijsvriezer bij het raam
  doos(MAT.vriezer, 16.6, 17.9, 0, 0.85, O.w0 + D + 0.1, O.w0 + D + 0.85);
  doos(MAT.glas, 16.65, 17.85, 0.86, 0.88, O.w0 + D + 0.15, O.w0 + D + 0.8, 'b');
  bots(16.6, 17.9, O.w0 + D + 0.1, O.w0 + D + 0.85);
  // de koffiehoek in het westdeel, tegen de westmuur: een houten werkblad met een machine
  doos(MAT.hout, A.u0 + D, A.u0 + D + 0.65, 0, 0.92, 1.3, 3.9);
  doos(MAT.zwart, A.u0 + D + 0.1, A.u0 + D + 0.55, 0.92, 1.55, 2.2, 2.8);
  doos(MAT.wit, A.u0 + D + 0.1, A.u0 + D + 0.45, 0.92, 1.05, 3.1, 3.5);
  bots(A.u0 + D, A.u0 + D + 0.65, 1.3, 3.9);
  // schappen tegen de westmuur achterin
  doos(MAT.gondel, A.u0 + D, A.u0 + D + 0.5, 0, 1.85, 5.0, A.w1 - D - 0.1, 'vab');
  staand(MAT.zak, A.u0 + D + 0.51, 5.0, A.u0 + D + 0.51, A.w1 - D - 0.1, 0.1, 1.8, [1, 0]);
  bots(A.u0 + D, A.u0 + D + 0.5, 5.0, A.w1 - D - 0.1);
  // de balie: in het westdeel, de klant aan de kant van de deur (noord), de medewerker erachter; de tabakswand achterin
  const BL = { u0: 3.2, u1: 7.4, w0: 5.9, w1: 6.6 };
  doos(MAT.balie, BL.u0, BL.u1, 0, 1.0, BL.w0, BL.w1, 'vaow', MAT.balie);
  doos(MAT.balieTop, BL.u0 - 0.05, BL.u1 + 0.05, 1.0, 1.05, BL.w0 - 0.08, BL.w1 + 0.03);
  staand(MAT.groen, BL.u0, BL.w0 - 0.01, BL.u1, BL.w0 - 0.01, 0.75, 0.9, [0, -1]);
  doos(MAT.zwart, 5.6, 6.05, 1.05, 1.32, 6.15, 6.45);                                    // de kassa
  doos(MAT.zwart, 5.65, 6.0, 1.32, 1.6, 6.38, 6.42);                                      // het scherm
  doos(MAT.balie, BL.u0, BL.u0 + 0.7, 0, 1.0, BL.w1, A.w1 - D - 1.2, 'wob');              // het zijstuk
  bots(BL.u0, BL.u1, BL.w0, BL.w1); bots(BL.u0, BL.u0 + 0.7, BL.w1, A.w1 - D - 1.2);
  doos(MAT.gondel, 3.6, 8.6, 0, 2.3, A.w1 - D - 0.45, A.w1 - D, 'vwob');
  staand(MAT.tabak, 3.7, A.w1 - D - 0.46, 8.5, A.w1 - D - 0.46, 0.9, 2.2, [0, -1]);
  bots(3.6, 8.6, A.w1 - D - 0.45, A.w1 - D);

  // ---- de details (stap 160, "nog net wat meer detail van binnen")
  const vlakHeel = (mat, u0, u1, w0, w1, y) => vlak(mat, [u0, y, w0], [u1, y, w0], [u1, y, w1], [u0, y, w1], [0, 1, 0], true);
  // de deurmat binnen, voor de schuifdeur
  // (stap 170) een centimeter of vier boven de vloer (0,02): op 0,03 vochten mat en vloer om dezelfde pixels ("de mat clipt")
  vlakHeel(MAT.mat, BP.deur.u0 - 0.2, BP.deur.u1 + 0.2, O.w0 + D + 0.02, O.w0 + D + 1.3, 0.06);
  doos(MAT.zwart, BP.deur.u0 - 0.2, BP.deur.u1 + 0.2, 0.02, 0.06, O.w0 + D + 0.02, O.w0 + D + 1.3, 'vaow');   // de rand van de mat
  // een stapel rode mandjes naast de deur
  for (let i = 0; i < 6; i++) doos(MAT.mand, 12.55 - i * 0.004, 13.1 + i * 0.004, i * 0.09, i * 0.09 + 0.08, O.w0 + D + 0.1, O.w0 + D + 0.5, 'vaowb');
  doos(MAT.staal, 12.6, 13.05, 0.54, 0.56, O.w0 + D + 0.27, O.w0 + D + 0.33, 'vab');
  bots(12.55, 13.1, O.w0 + D + 0.1, O.w0 + D + 0.5, 0.6);
  // bordjes boven de gondels, aan twee draadjes
  for (const [i, bord] of [[0, MAT.snoepBord], [1, MAT.chipsBord]]) {
    const gd = gondels[i], uc = (gd.u0 + gd.u1) / 2;
    doos(MAT.wit, uc - 0.02, uc + 0.02, 2.3, 2.58, 5.1, 6.5, 'b');
    staand(bord, uc - 0.025, 5.1, uc - 0.025, 6.5, 2.3, 2.58, [-1, 0], true);
    staand(bord, uc + 0.025, 6.5, uc + 0.025, 5.1, 2.3, 2.58, [1, 0], true);
    for (const w of [5.3, 6.3]) doos(MAT.staal, uc - 0.005, uc + 0.005, 2.58, PL, w - 0.005, w + 0.005, 'vaow');
  }
  // olie en autospullen tegen de knik van het oostdeel, met een bordje
  doos(MAT.gondel, A.u1 + D, A.u1 + D + 0.45, 0, 1.4, A.w1 + 0.1, O.w1 - D - 0.7, 'vab');
  staand(MAT.olie, A.u1 + D + 0.46, A.w1 + 0.1, A.u1 + D + 0.46, O.w1 - D - 0.7, 0.1, 1.35, [1, 0]);
  staand(MAT.autoBord, A.u1 + D + 0.02, A.w1 + 0.6, A.u1 + D + 0.02, A.w1 + 2.0, 1.75, 2.1, [1, 0], true);
  bots(A.u1 + D, A.u1 + D + 0.45, A.w1 + 0.1, O.w1 - D - 0.7);
  // het tijdschriftenrek tegen de pui van het westdeel, schuin naar binnen
  doos(MAT.gondel, 6.0, 8.4, 0, 1.25, A.w0 + D, A.w0 + D + 0.4, 'wob');
  vlak(MAT.bladen, [6.05, 0.1, A.w0 + D + 0.42], [8.35, 0.1, A.w0 + D + 0.42], [8.35, 1.22, A.w0 + D + 0.3], [6.05, 1.22, A.w0 + D + 0.3], [0, 0.1, 1]);
  bots(6.0, 8.4, A.w0 + D, A.w0 + D + 0.4, 1.3);
  // vóór de balie een rekje met snoep, op de balie een bakje kauwgom
  doos(MAT.gondel, 6.75, 7.3, 0, 1.0, BL.w0 - 0.4, BL.w0, 'waob');
  staand(MAT.snoep, 6.75, BL.w0 - 0.41, 7.3, BL.w0 - 0.41, 0.1, 0.95, [0, -1]);
  bots(6.75, 7.3, BL.w0 - 0.4, BL.w0, 1.0);
  doos(MAT.mand, 4.0, 4.4, 1.05, 1.13, 5.95, 6.2, 'vaowb');
  // het menubord boven de balie, aan het plafond
  staand(MAT.menu, 3.5, BL.w1 + 1.05, 6.9, BL.w1 + 1.05, 2.15, 2.9, [0, -1], true);
  doos(MAT.zwart, 3.48, 6.92, 2.13, 2.92, BL.w1 + 1.06, BL.w1 + 1.1, 'aowb');
  for (const u of [3.8, 6.6]) doos(MAT.staal, u - 0.005, u + 0.005, 2.92, PL, BL.w1 + 1.075, BL.w1 + 1.085, 'vaow');
  // een wandklok naast ZOETWAREN, en camerabolletjes aan het plafond
  staand(MAT.klok, 17.55, AW - 0.03, 18.0, AW - 0.03, 2.4, 2.85, [0, -1], true);
  for (const [u, w] of [[12, 1.2], [17.5, 7], [4.5, 4.4], [8.6, 8.8]]) doos(MAT.zwart, u - 0.09, u + 0.09, PL - 0.12, PL, w - 0.09, w + 0.09, 'vaowd');
  // het ijs onder het glas van de vriezer
  liggend(MAT.ijs, 16.68, 17.82, O.w0 + D + 0.17, O.w0 + D + 0.78, 0.84, true);
  // affiches op de binnenkant van de pui, te lezen van buiten; de achterkant wit
  for (const [u0, mat] of [[10.6, MAT.aanbod], [17.2, MAT.aanbod], [1.0, MAT.koffieBord]]) {
    const w = (u0 < A.u1 ? A.w0 : O.w0) + 0.06;
    staand(mat, u0, w, u0 + 0.9, w, 1.2, 2.45, [0, -1], true);
    staand(MAT.wit, u0, w + 0.005, u0 + 0.9, w + 0.005, 1.2, 2.45, [0, 1]);
  }
  // het stoepbord buiten, rechts van de deur: twee schuine borden
  {
    const su0 = BP.deur.u1 + 0.6, su1 = su0 + 0.6, sw = O.w0 - 1.3;
    vlak(MAT.koffieBord, [su0, 0, sw - 0.3], [su1, 0, sw - 0.3], [su1, 1.0, sw - 0.02], [su0, 1.0, sw - 0.02], [0, 0.3, -1], true);
    vlak(MAT.koffieBord, [su1, 0, sw + 0.3], [su0, 0, sw + 0.3], [su0, 1.0, sw + 0.02], [su1, 1.0, sw + 0.02], [0, 0.3, 1], true);
    bots(su0, su1, sw - 0.3, sw + 0.3, 1.0);
  }

  const groep = new THREE.Group();
  groep.name = 'bpwinkel';
  for (const [mat, g] of bak) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.uv, 2));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = mat !== MAT.glas; m.receiveShadow = true;
    if (mat === MAT.glas) m.renderOrder = 2;
    m.userData.klasse = 'bpwinkel';
    m.name = Object.keys(MAT).find(k => MAT[k] === mat) || '';
    groep.add(m);
  }
  scene.add(groep);

  // ---- de schuifdeur: twee bladen die opzij schuiven, in de voorgevel van het oostdeel
  const dw = O.w0, dbreed = (BP.deur.u1 - BP.deur.u0) / 2;
  const blad = (zij) => {
    const g = new THREE.Group();
    const ruit = new THREE.Mesh(new THREE.BoxGeometry(dbreed - 0.04, BP.deur.hoog - 0.06, 0.03), MAT.glas);
    ruit.renderOrder = 2;
    const rand = new THREE.Mesh(new THREE.BoxGeometry(dbreed, 0.06, 0.05), MAT.kozijn);
    rand.position.y = BP.deur.hoog / 2 - 0.03;
    const rand2 = rand.clone(); rand2.position.y = -BP.deur.hoog / 2 + 0.03;
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, BP.deur.hoog, 0.05), MAT.kozijn);
    st.position.x = zij * (dbreed / 2 - 0.025);
    g.add(ruit, rand, rand2, st);
    g.rotation.y = Math.atan2(-U[1], U[0]);
    scene.add(g);
    return g;
  };
  const bladen = [blad(-1), blad(1)];
  const deurMidU = (BP.deur.u0 + BP.deur.u1) / 2;
  const zetBladen = (f) => {
    bladen.forEach((g, i) => {
      const zij = i ? 1 : -1;
      const u = deurMidU + zij * (dbreed / 2) + zij * f * (dbreed - 0.05);
      const [x, z] = W(u, dw);
      g.position.set(x, voet + BP.deur.hoog / 2, z);
    });
  };
  zetBladen(0);
  const deurBots = bots(BP.deur.u0, BP.deur.u1, dw - 0.06, dw + 0.06, H);
  let deurOpen = 0;

  // ---- de medewerker achter de balie, in het BP-groen
  const mw = new Persoon({ shirt: 0x0b7a3b, broek: 0x23262b, huid: 0xe0b89a, haar: 0x3b2a1c, vest: 0x0b7a3b });
  const [mx, mz] = W((BL.u0 + BL.u1) / 2 + 0.3, BL.w1 + 0.55);
  // kijkt naar de deur (naar −w): de kijkrichting van een Persoon is zijn −z, dus yaw = atan2(−f.x, −f.z)
  const fx = U[1], fz = -U[0];
  const mwYaw = Math.atan2(-fx, -fz);
  mw.zetNeer(mx, mz, mwYaw);
  scene.add(mw.groep);
  registreer(mw, { wie: 'medewerker BP' });   // (stap 188) te raken; dan is de kassa dicht tot hij terug is

  const deurPunt = W(deurMidU, dw);
  const api = {
    groep, bladen, dozen, materialen: MAT, medewerker: mw, balie: BL, gondels,
    deur: { u0: BP.deur.u0, u1: BP.deur.u1, w: dw, x: deurPunt[0], z: deurPunt[1], get open() { return deurOpen; }, bots: deurBots },
    wereld: W,
    /**
     * Elk beeld: de deur open als er iemand (te voet) binnen `deurBereik` staat, binnen of buiten; de medewerker kijkt
     * naar wie er dichtbij is en ademt.
     */
    update(dt, punten = []) {
      const dichtbij = punten.some(p => p && Math.hypot(p.x - deurPunt[0], p.z - deurPunt[1]) < BP.deurBereik);
      const doel = dichtbij ? 1 : 0;
      if (deurOpen !== doel) {
        deurOpen = doel > deurOpen ? Math.min(1, deurOpen + dt / BP.deurTijd[0]) : Math.max(0, deurOpen - dt / BP.deurTijd[1]);
        zetBladen(deurOpen * deurOpen * (3 - 2 * deurOpen));
        if (deurBots) deurBots.h = deurOpen > 0.55 ? 0 : H;
      }
      const p = punten[0];
      if (p && Math.hypot(p.x - mx, p.z - mz) < 12) mw.kijkNaar(p.x, p.z, dt, 2.0);
      mw.update(dt, { loopt: false });
    },
  };
  BP_SHOP.nu = api;
  return api;
}
export const BP_SHOP = { nu: null };

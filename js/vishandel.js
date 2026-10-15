/*
 Martens Vishandel: een viswagen op het parkeerterrein voor de Jumbo aan de
 Molenkrite (verzoek 10 okt 2026: "Martens Vishandel voor de jumbo op de
 Molenkrite op het parkeerterrein. Krijg je bij kopen portie kibbeling 25
 levens. Kost 20 euro.").

 Het model volgt de foto die de gebruiker erbij stuurde: een lange witte
 verkoopwagen, zoals ze op de markt en voor de supermarkten staan.

   - een aanhanger van 7 m lang, 2,4 m breed en 3,1 m hoog, op één as met aan
     elke kant een wiel, een dissel met een neuswiel en steunpoten;
   - de hele lange kant gaat open: het luik scharniert aan de bovenrand en
     staat open bijna vlak naar buiten, en daaraan hangt de witte luifel met
     een golvende onderrand, de naam en in het blauw "Warme gebakken vis",
     "Verse vis" en "Hollandse nieuwe", met kleine rood-wit-blauwe vlagjes;
   - op de hoek een Nederlandse vlag aan een stok;
   - binnen een zwarte bovenrand met een rij verlichte menukaartjes (kibbeling
     € 20, lekkerbekje, haring…) en een klein blauw scherm in het midden;
   - daaronder een lange gekoelde vitrine, schuin glas op een rvs-toonbank,
     met bakjes vis tussen een rand van groene plastic peterselie;
   - twee verkopers in donkere schorten achter de toonbank, een bloembak met
     rode bloemen op de linkerhoek, en rechts een zwart zijpaneel dat uitklapt;
   - de naam ook op de achterwand en op het luik (dat zie je als hij dicht is),
     en een stoepbord ervoor: "Kibbeling € 20".

 Alles is op canvas getekend (geen afbeeldingsbestanden, zie CLAUDE.md).

 Waar hij staat wordt gezocht, niet geraden (`zoekPlek`): vóór de ingang van
 het pand van type `jumbo` in de kaart, op het verharde terrein ervoor
 (parkeervlak, voetpad), met de open kant naar de ingang. Een plek valt af als
 een stuk van de wagen of van de strook waar de klanten staan in een rijbaan,
 een inrit of een pand ligt, op een parkeerplek (daar zet js/vehicles.js een
 auto neer), bij een boom of een lantaarn, of midden op het looppad van de
 voetgangers. Bij het opstarten kijkt `resolveCollisions` daarna nog of er geen
 botsdoos staat (een vlaggenmast, een fietsenrek); pas dan krijgt de wagen zijn
 eigen doos. Die is hoger dan 3,5 m, anders rijdt een auto er dwars doorheen
 (js/vehicles.js).

 Open van 9 tot 18 uur (`VIS.open`, `VIS.dicht`, op `sfeer.uur`). Daarbuiten
 gaan het luik en het zijpaneel dicht en zijn de verkopers naar huis. Zij
 verdwijnen pas als het luik dicht is; het aantal lichtbronnen verandert
 nergens (zie stap 83): de gloed van de kaartjes en borden zit in de materialen.

 Kopen: E binnen `VIS.bereik` van de toonbank (gemeten tot de toonbank als lijn,
 hij is zes meter lang), te voet. Een portie kibbeling kost `VIS.prijs` en geeft
 `VIS.leven` leven, tot het maximum van 100 (zoals het bier en de barbecue in
 js/interieur.js). Te weinig geld of al vol: een melding, en niets betaald. Na
 een poging wacht E `VIS.afkoel` tellen, zodat je er niet per ongeluk tien koopt.
*/
import * as THREE from 'three';
import { addCollider, resolveCollisions } from './world.js';
import { Persoon } from './persoon.js';
import { HUD } from './hud.js';

export const NAAM = 'Martens Vishandel';

export const VIS = {
  prijs: 20,          // € per portie kibbeling
  leven: 25,          // leven erbij
  max: 100,           // meer leven dan dit heeft niemand (js/boerderij.js MAX_LEVEN)
  bereik: 2.5,        // m van de toonbank
  afkoel: 1.5,        // s tussen twee pogingen
  open: 9,            // uur
  dicht: 18,
  luikTijd: 2.4,      // s om het luik open of dicht te doen
  zicht: 260,         // verder weg tekenen we hem niet
};

// ---------- maten (m), in het assenstelsel van de wagen ----------
// x langs de wagen (+x is rechts voor wie ervoor staat), z dwars (+z is de open
// kant), y omhoog
const L = 7.0, B = 2.4, H = 3.1;
const ONDER = 0.55;            // onderkant van de opbouw
const VLOER = 0.4;             // daar staan de verkopers op (de vloer ligt tussen de balken)
const OPEN_X0 = -L / 2 + 0.25, OPEN_X1 = L / 2 - 0.25;
const OPEN_Y0 = 1.15, OPEN_Y1 = 2.75;
const OPEN_B = OPEN_X1 - OPEN_X0, OPEN_H = OPEN_Y1 - OPEN_Y0;
const LUIK_H = OPEN_H - 0.07;  // dicht rust hij net boven de toonbank
const LUIK_OPEN = -(Math.PI / 2 + 0.08);   // bijna vlak, de voorrand iets omhoog
const LUIFEL_H = 0.62;         // de hangende luifel aan de voorrand
const PANEEL_B = 1.1;          // het zwarte zijpaneel rechts
const DISSEL = 1.1;            // zover steekt de dissel links uit (-x)
const KLANT = 1.8;             // diepte van de strook voor de toonbank waar je staat
const TOONBANK = { x0: OPEN_X0 + 0.15, x1: OPEN_X1 - 0.15, z: B / 2 + 0.25 };
const BOTS_H = 3.6;            // hoger dan 3,5: anders rijdt een auto erdoorheen

// als er in de kaart geen Jumbo te vinden is: de plek van 10 okt 2026
const VASTE_PLEK = { x: 237.57, z: -62.38, yaw: -0.0898 };

// ---------- doeken ----------
function doek(w, h, teken) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  teken(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const BLAUW = '#1d4f9c', LICHT = '#5aa6e0';
const ROOD = '#ae1c28', NLBLAUW = '#21468b';
function kansen(zaad) { let s = zaad; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

// een vis van opzij: lijf, staart, oog; `k` is de kleur van de rug
function vis(g, x, y, s, k = LICHT, buik = '#e8f2fa') {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = k;
  g.beginPath(); g.ellipse(0, 0, 50, 20, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(42, 0); g.lineTo(80, -22); g.lineTo(72, 0); g.lineTo(80, 22); g.closePath(); g.fill();
  g.fillStyle = buik;
  g.beginPath(); g.ellipse(-4, 7, 40, 9, 0, 0, Math.PI); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(-32, -5, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#10213a'; g.beginPath(); g.arc(-33, -5, 3, 0, Math.PI * 2); g.fill();
  g.restore();
}
// golfjes, de huisstijl van elke viskraam
function golven(g, y, w, kleur, dik = 6, hoog = 9, lengte = 60) {
  g.strokeStyle = kleur; g.lineWidth = dik; g.beginPath();
  for (let x = 0; x <= w; x += 4) {
    const yy = y + Math.sin(x / lengte * Math.PI * 2) * hoog;
    if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
  }
  g.stroke();
}
// de naam: "Martens" groot en schuin, "Vishandel" eronder
function naam(g, x, y, schaal, kleur = BLAUW) {
  g.save(); g.translate(x, y); g.scale(schaal, schaal);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = kleur;
  g.font = 'italic bold 150px Georgia, serif';
  g.fillText('Martens', 0, 0);
  g.font = 'bold 64px sans-serif';
  g.fillText('V I S H A N D E L', 0, 78);
  g.restore();
}
// een vlaggetje (driehoek) in rood, wit en blauw van boven naar beneden
function vlagje(g, x, y, b, h) {
  g.save();
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + b, y); g.lineTo(x + b / 2, y + h); g.closePath(); g.clip();
  g.fillStyle = ROOD; g.fillRect(x, y, b, h / 3);
  g.fillStyle = '#ffffff'; g.fillRect(x, y + h / 3, b, h / 3);
  g.fillStyle = NLBLAUW; g.fillRect(x, y + 2 * h / 3, b, h / 3);
  g.restore();
}

// de achterwand (de kant van de wagen zonder luik): de hele wand
function wandDoek() {
  return doek(2048, 1024, (g, w, h) => {
    g.fillStyle = '#f6f7f6'; g.fillRect(0, 0, w, h);
    g.fillStyle = BLAUW; g.fillRect(0, h * 0.74, w, h * 0.26);
    golven(g, h * 0.70, w, LICHT, 10, 12, 140);
    golven(g, h * 0.66, w, BLAUW, 6, 10, 140);
    naam(g, w * 0.42, h * 0.36, 1.45);
    vis(g, w * 0.82, h * 0.30, 2.6);
    vis(g, w * 0.86, h * 0.50, 1.6, BLAUW);
    g.fillStyle = '#ffffff'; g.font = 'bold 70px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Warme gebakken vis  ·  Verse vis  ·  Hollandse nieuwe', w / 2, h * 0.865);
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (const f of [0.005, 0.995]) g.fillRect(w * f - 3, 0, 6, h);
  });
}
// het luik van buiten: dat zie je als de wagen dicht is
function luikDoek() {
  return doek(2048, 512, (g, w, h) => {
    g.fillStyle = '#f6f7f6'; g.fillRect(0, 0, w, h);
    g.fillStyle = BLAUW; g.fillRect(0, h - 70, w, 70);
    naam(g, w * 0.4, h * 0.52, 1.25);
    vis(g, w * 0.78, h * 0.44, 2.0);
    g.fillStyle = '#ffffff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`Open van ${VIS.open} tot ${VIS.dicht} uur  ·  Kibbeling € ${VIS.prijs}`, w / 2, h - 35);
    g.strokeStyle = '#c9ccce'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  });
}
// het luik van onderen: wit, met een rij lichtbakken
function luikOnderDoek() {
  return doek(1024, 256, (g, w, h) => {
    g.fillStyle = '#eef0f0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fffbe6';
    for (let i = 0; i < 5; i++) g.fillRect(w * (0.1 + i * 0.2) - 50, h * 0.42, 100, 26);
    g.strokeStyle = '#cfd3d4'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  });
}
/*
 De luifel: wit doek met een golvende onderrand (de golven zijn doorzichtig,
 `alphaTest`), boven een rij vlagjes, in het midden de naam en links en rechts
 wat er te koop is, in het blauw zoals op de foto.
*/
function luifelDoek() {
  return doek(2048, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const golfH = 26, n = 22;
    g.fillStyle = '#fbfbfa';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, h - golfH);
    for (let i = n; i > 0; i--) {
      const x1 = (i - 1) * w / n, xm = (i - 0.5) * w / n;
      g.quadraticCurveTo(xm, h + golfH * 0.6, x1, h - golfH);
    }
    g.closePath(); g.fill();
    // de zoom langs de golven
    g.strokeStyle = BLAUW; g.lineWidth = 5;
    g.beginPath(); g.moveTo(w, h - golfH);
    for (let i = n; i > 0; i--) g.quadraticCurveTo((i - 0.5) * w / n, h + golfH * 0.6 - 8, (i - 1) * w / n, h - golfH);
    g.stroke();
    g.fillStyle = BLAUW; g.fillRect(0, 0, w, 10);
    // vlagjes aan een lijntje
    g.strokeStyle = '#555'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, 16); g.lineTo(w, 16); g.stroke();
    for (let x = 6; x < w - 30; x += 52) vlagje(g, x, 16, 30, 34);
    g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillStyle = BLAUW;
    g.font = 'italic bold 104px Georgia, serif';
    g.fillText('Martens Vishandel', w / 2, 118);
    g.font = 'bold 50px sans-serif';
    g.fillText('Warme gebakken vis', w * 0.15, 112);
    g.fillText('Hollandse nieuwe', w * 0.85, 112);
    g.font = 'bold 40px sans-serif';
    g.fillText('—  Verse vis  —', w / 2, 192);
    vis(g, w * 0.15, 172, 0.7, BLAUW, LICHT);
    vis(g, w * 0.85, 172, 0.7, BLAUW, LICHT);
  });
}
// de zwarte bovenrand binnen: verlichte menukaartjes en een blauw scherm
const MENU = [
  { naam: 'Kibbeling', prijs: VIS.prijs, soort: 'kibbeling', groot: true },
  { naam: 'Lekkerbekje', prijs: 22, soort: 'lekkerbekje' },
  { naam: 'Haring', prijs: 15, soort: 'haring' },
  { naam: 'Kibbeling', prijs: VIS.prijs, soort: 'kibbeling' },
  null,                                             // het scherm
  { naam: 'Mosselen', prijs: 18, soort: 'mosselen' },
  { naam: 'Lekkerbekje', prijs: 22, soort: 'lekkerbekje' },
  { naam: 'Gebakken vis', prijs: 24, soort: 'kibbeling' },
  { naam: 'Kibbeling', prijs: VIS.prijs, soort: 'kibbeling', groot: true },
];
function gerecht(g, soort, x, y, b, h, r) {
  // een "foto": een kartonnen bakje op een houten plank
  g.fillStyle = '#8a5a32'; g.fillRect(x, y, b, h);
  g.fillStyle = '#f2ece0';
  g.beginPath(); g.ellipse(x + b / 2, y + h * 0.55, b * 0.42, h * 0.36, 0, 0, Math.PI * 2); g.fill();
  if (soort === 'kibbeling') {
    for (let i = 0; i < 16; i++) {
      g.fillStyle = ['#c98a2e', '#dca04a', '#b8741f'][i % 3];
      g.beginPath(); g.ellipse(x + b * (0.22 + r() * 0.56), y + h * (0.35 + r() * 0.38), b * 0.07, h * 0.08, r() * 3, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#f7f3e6'; g.beginPath(); g.arc(x + b * 0.74, y + h * 0.4, b * 0.08, 0, Math.PI * 2); g.fill();   // remoulade
  } else if (soort === 'lekkerbekje') {
    g.fillStyle = '#cf8f3a'; g.beginPath(); g.ellipse(x + b / 2, y + h * 0.55, b * 0.32, h * 0.18, 0.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f2d23a'; g.beginPath(); g.ellipse(x + b * 0.78, y + h * 0.42, b * 0.06, h * 0.07, 0, 0, Math.PI * 2); g.fill();  // citroen
  } else if (soort === 'haring') {
    vis(g, x + b / 2, y + h * 0.55, b / 210, '#7d8c99', '#dfe6ec');
    g.fillStyle = '#f2f2ee'; for (let i = 0; i < 6; i++) g.fillRect(x + b * (0.3 + r() * 0.4), y + h * (0.3 + r() * 0.15), 4, 4);  // uitjes
  } else {
    for (let i = 0; i < 10; i++) {
      g.fillStyle = '#1d1f2a'; g.beginPath(); g.ellipse(x + b * (0.25 + r() * 0.5), y + h * (0.38 + r() * 0.3), b * 0.08, h * 0.05, r() * 3, 0, Math.PI * 2); g.fill();
    }
  }
}
function menuDoek() {
  return doek(2048, 192, (g, w, h) => {
    g.fillStyle = '#111214'; g.fillRect(0, 0, w, h);
    const r = kansen(13);
    const vak = w / MENU.length;
    MENU.forEach((m, i) => {
      const x = i * vak + 10, b = vak - 20, y = 14, hh = h - 28;
      if (!m) {                                   // het kleine blauwe scherm
        g.fillStyle = '#0c3f8f'; g.fillRect(x + 20, y + 18, b - 40, hh - 36);
        g.fillStyle = '#59a8ff'; g.fillRect(x + 20, y + 18, b - 40, 8);
        g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = 'italic bold 30px Georgia, serif'; g.fillText('Martens', x + b / 2, y + hh * 0.42);
        g.font = '20px sans-serif'; g.fillText('vandaag vers', x + b / 2, y + hh * 0.66);
        return;
      }
      g.fillStyle = m.groot ? '#fff6c8' : '#fbf7ee'; g.fillRect(x, y, b, hh);
      gerecht(g, m.soort, x + 8, y + 8, b - 16, hh * 0.55, r);
      g.fillStyle = '#1c2a44'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `bold ${m.groot ? 30 : 24}px sans-serif`;
      g.fillText(`€ ${m.prijs}`, x + b / 2, y + hh * 0.73);
      g.font = `${m.groot ? 'bold ' : ''}20px sans-serif`;
      g.fillText(m.naam.toLowerCase(), x + b / 2, y + hh * 0.9);
    });
  });
}
// de onderkant aan de open kant, onder de toonbank
function onderDoek() {
  return doek(2048, 256, (g, w, h) => {
    g.fillStyle = '#f6f7f6'; g.fillRect(0, 0, w, h);
    g.fillStyle = BLAUW; g.fillRect(0, h * 0.45, w, h * 0.55);
    golven(g, h * 0.38, w, LICHT, 8, 8, 120);
    g.fillStyle = '#ffffff'; g.font = 'bold 66px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('MARTENS VISHANDEL  ·  VERSE VIS  ·  ELKE DAG', w / 2, h * 0.73);
  });
}
// het stoepbord: krijt op een schoolbord
function stoepDoek() {
  return doek(256, 384, (g, w, h) => {
    g.fillStyle = '#6b4a2b'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1f2a24'; g.fillRect(14, 14, w - 28, h - 28);
    g.fillStyle = '#f2f2ea'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'italic bold 44px Georgia, serif'; g.fillText('Martens', w / 2, 62);
    g.font = '24px sans-serif'; g.fillText('vandaag vers', w / 2, 104);
    g.fillStyle = '#ffe680'; g.font = 'bold 42px sans-serif'; g.fillText('Kibbeling', w / 2, 170);
    g.fillStyle = '#ffffff'; g.font = 'bold 76px sans-serif'; g.fillText(`€ ${VIS.prijs}`, w / 2, 246);
    g.strokeStyle = '#f2f2ea'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(50, 300); g.lineTo(w - 50, 300); g.stroke();
    g.fillStyle = '#f2f2ea'; g.font = '24px sans-serif'; g.fillText(`+${VIS.leven} leven`, w / 2, 334);
  });
}
/*
 De vitrine van boven: een rij bakjes op ijs, elk met een rand van groene
 plastic peterselie, zoals in elke viswagen.
*/
function vitrineDoek() {
  return doek(2048, 256, (g, w, h) => {
    g.fillStyle = '#e9f2f6'; g.fillRect(0, 0, w, h);
    const r = kansen(5);
    const soorten = ['kibbeling', 'zalm', 'lekkerbekje', 'haring', 'garnalen', 'mosselen', 'kibbeling', 'zalm', 'haring', 'lekkerbekje'];
    const vak = w / soorten.length;
    soorten.forEach((s, i) => {
      const x = i * vak, m = 14;
      // de peterselie: groene krulletjes rondom
      for (let k = 0; k < 160; k++) {
        const t = r(), kant = Math.floor(r() * 4);
        const px = kant < 2 ? x + t * vak : x + (kant === 2 ? m * r() : vak - m * r());
        const py = kant >= 2 ? t * h : (kant === 0 ? m * r() : h - m * r());
        g.fillStyle = ['#2f8a2a', '#3fa336', '#24701f'][k % 3];
        g.beginPath(); g.arc(px, py, 5 + r() * 5, 0, Math.PI * 2); g.fill();
      }
      const bx = x + m + 4, by = m + 4, bb = vak - 2 * m - 8, bh = h - 2 * m - 8;
      g.fillStyle = '#d7dde0'; g.fillRect(bx, by, bb, bh);
      g.fillStyle = '#f5f7f7'; g.fillRect(bx + 4, by + 4, bb - 8, bh - 8);
      const stuk = (kleuren, n, rx, ry) => {
        for (let k = 0; k < n; k++) {
          g.fillStyle = kleuren[k % kleuren.length];
          g.beginPath(); g.ellipse(bx + 14 + r() * (bb - 28), by + 14 + r() * (bh - 28), rx, ry, r() * 3, 0, Math.PI * 2); g.fill();
        }
      };
      if (s === 'kibbeling') stuk(['#c98a2e', '#dca04a', '#b8741f'], 40, 12, 9);
      else if (s === 'zalm') stuk(['#f08a5d', '#e9774a', '#f6a07a'], 7, 30, 16);
      else if (s === 'lekkerbekje') stuk(['#c88634', '#d99b45'], 5, 36, 18);
      else if (s === 'garnalen') stuk(['#f2a3a0', '#e98f8a', '#f7bcb3'], 70, 6, 4);
      else if (s === 'mosselen') stuk(['#1d1f2a', '#2b2e3e'], 34, 12, 7);
      else for (let k = 0; k < 4; k++) vis(g, bx + bb / 2, by + 30 + k * 46, 0.75, '#7d8c99', '#dfe6ec');
    });
  });
}
// de Nederlandse vlag, met een zoom
function vlagDoek() {
  return doek(192, 128, (g, w, h) => {
    g.fillStyle = ROOD; g.fillRect(0, 0, w, h / 3);
    g.fillStyle = '#ffffff'; g.fillRect(0, h / 3, w, h / 3);
    g.fillStyle = NLBLAUW; g.fillRect(0, 2 * h / 3, w, h / 3);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 6, h);
  });
}

// ---------- materialen: allemaal bij het opstarten, ook de doorzichtige ----------
function materialen() {
  const std = (kleur, extra = {}) => new THREE.MeshStandardMaterial({ color: kleur, roughness: 0.6, ...extra });
  const bord = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.5, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.05, ...extra });
  return {
    wit: std(0xf4f5f4, { roughness: 0.4 }),
    blauw: std(0x1d4f9c, { roughness: 0.45 }),
    zwart: std(0x141517, { roughness: 0.55 }),
    rvs: std(0xc4c9cc, { roughness: 0.28, metalness: 0.75 }),
    binnen: std(0xdfe3e3, { roughness: 0.7 }),
    rubber: std(0x1b1c1e, { roughness: 0.9 }),
    velg: std(0x9ea3a7, { roughness: 0.35, metalness: 0.6 }),
    staal: std(0x2c2f33, { roughness: 0.55, metalness: 0.4 }),
    olie: std(0xb8862a, { roughness: 0.15, metalness: 0.1, emissive: 0x3a2400, emissiveIntensity: 0.35 }),
    bak: std(0x3b3f45, { roughness: 0.8 }),
    aarde: std(0x3a2a1c, { roughness: 1 }),
    blad: std(0x2f6b2a, { roughness: 0.8 }),
    bloem: std(0xc8141e, { roughness: 0.6 }),
    glas: new THREE.MeshStandardMaterial({ color: 0xdfeef4, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }),
    wand: bord(wandDoek()),
    luik: bord(luikDoek()),
    luikOnder: std(0xffffff, { map: luikOnderDoek(), emissive: 0xfff4d6, emissiveIntensity: 0.12 }),
    luifel: bord(luifelDoek(), { alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 }),
    menu: bord(menuDoek(), { emissiveIntensity: 0.55 }),
    onder: bord(onderDoek()),
    stoep: bord(stoepDoek()),
    vitrine: std(0xffffff, { map: vitrineDoek(), roughness: 0.35, emissive: 0xffffff, emissiveIntensity: 0.0 }),
    vlag: std(0xffffff, { map: vlagDoek(), roughness: 0.8, side: THREE.DoubleSide }),
  };
}

/*
 ---------------------------------------------------------------- de plek

 Vóór de ingang van de Jumbo: de voorgevel kijkt naar `front` van het pand (in
 de kaart staat dat naar het parkeerterrein aan de noordkant, zie
 data/stijl/straten.json), en de ingang is het midden van die gevel. Vanaf
 daar een raster van plekken op 7–14 m voor de gevel en tot 20 m opzij; de
 wagen staat er evenwijdig aan de gevel, met de open kant naar de ingang.

 Pure kaartgegevens, dus ook zonder browser na te rekenen; `vrij` is een
 extra toets die bij het opstarten de botsdozen erbij neemt.
*/
function inRing(x, z, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [a, b] = r[i], [d, e] = r[j];
    if ((b > z) !== (e > z) && x < (d - a) * (z - b) / (e - b) + a) c = !c;
  }
  return c;
}
function inVlak(x, z, v) {
  if (!v.r || !v.r.length || !inRing(x, z, v.r[0])) return false;
  for (let i = 1; i < v.r.length; i++) if (inRing(x, z, v.r[i])) return false;
  return true;
}
function afstandTotLijn(px, pz, pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(px - ax - t * dx, pz - az - t * dz));
  }
  return best;
}
const VERHARD = new Set(['parkeervlak', 'voetpad', 'verharding', 'asfaltvlak']);
const VERBODEN = new Set(['rijbaan', 'inrit', 'fietspad', 'water']);

export function zoekPlek(KAART, vrij = null) {
  const pand = KAART && (KAART.panden || []).find(p => p.type === 'jumbo');
  if (!pand || !pand.voet || !pand.voet.length) return { ...VASTE_PLEK, bron: 'vast' };
  let cx = 0, cz = 0;
  for (const q of pand.voet) { cx += q[0]; cz += q[1]; }
  cx /= pand.voet.length; cz /= pand.voet.length;
  const f = pand.front || [0, -1];
  const fl = Math.hypot(f[0], f[1]) || 1;
  const fx = f[0] / fl, fz = f[1] / fl;
  let diep = 0;
  for (const q of pand.voet) diep = Math.max(diep, (q[0] - cx) * fx + (q[1] - cz) * fz);
  const ingang = { x: cx + fx * diep, z: cz + fz * diep };
  const sx = -fz, sz = fx;                        // langs de gevel

  // alles in de buurt één keer verzamelen
  const R = 48, bij = (x, z) => Math.abs(x - ingang.x) < R && Math.abs(z - ingang.z) < R;
  const vlakken = (KAART.vlakken || []).filter(v => v.r && v.r[0] && v.r[0].some(q => bij(q[0], q[1])));
  const panden = (KAART.panden || []).filter(p => p.voet && p.voet.some(q => bij(q[0], q[1])));
  const plekken = (KAART.parkeerplekken || []).filter(p => bij(p.x, p.z));
  const bomen = (KAART.bomen || []).filter(p => bij(p.x, p.z));
  const lampen = (KAART.lantaarns || []).filter(p => bij(p.x, p.z));
  const assen = (KAART.wegassen || []).filter(a => a.pts && a.pts.some(q => bij(q[0], q[1])));

  // de wagen kijkt met zijn open kant (+z) naar de ingang, dus z van de wagen = -front
  const yaw = Math.atan2(-fx, -fz);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const naarWereld = (px, pz, lx, lz) => ({ x: px + lx * c + lz * s, z: pz - lx * s + lz * c });

  function toets(px, pz) {
    // de wagen met de dissel en de strook ervoor waar de klanten staan
    const punten = [];
    for (let lx = -L / 2 - DISSEL; lx <= L / 2 + 0.2 + 1e-6; lx += 0.8)
      for (let lz = -B / 2; lz <= B / 2 + KLANT + 1e-6; lz += 0.6) punten.push(naarWereld(px, pz, lx, lz));
    for (const p of punten) {
      let verhard = false;
      for (const v of vlakken) {
        if (!inVlak(p.x, p.z, v)) continue;
        if (VERBODEN.has(v.k)) return false;
        if (VERHARD.has(v.k)) verhard = true;
      }
      if (!verhard) return false;                 // helemaal op de klinkers
      for (const q of panden) if (inRing(p.x, p.z, q.voet)) return false;
      // een geparkeerde auto is 4,6 bij 1,9: zijn hart moet ruim van de wagen af
      for (const q of plekken) if (Math.hypot(p.x - q.x, p.z - q.z) < 2.6) return false;
      for (const q of bomen) if (Math.hypot(p.x - q.x, p.z - q.z) < 2.2 + (q.s || 1) * 0.6) return false;
      for (const q of lampen) if (Math.hypot(p.x - q.x, p.z - q.z) < 0.9) return false;
      for (const a of assen) {
        const d = afstandTotLijn(p.x, p.z, a.pts);
        // rijwegen ruim mijden; van het looppad van de voetgangers (js/npc.js) het hart
        if (a.drive && d < a.w / 2 + 1.5) return false;
        if (!a.drive && d < a.w * 0.35) return false;
      }
      if (vrij && !vrij(p.x, p.z)) return false;
    }
    return true;
  }

  // dichtbij de ingang en zo recht mogelijk ervoor gaat voor
  const kandidaten = [];
  for (let voor = 7; voor <= 14; voor += 0.5)
    for (let opzij = -20; opzij <= 20; opzij += 0.5)
      kandidaten.push({ voor, opzij, kost: (voor - 7) + Math.abs(opzij) * 0.35 });
  kandidaten.sort((a, b) => a.kost - b.kost);
  for (const k of kandidaten) {
    // het hart van de wagen ligt B/2 achter de rand aan de open kant
    const x = ingang.x + fx * (k.voor + B / 2) + sx * k.opzij;
    const z = ingang.z + fz * (k.voor + B / 2) + sz * k.opzij;
    if (toets(x, z)) return { x, z, yaw, ingang, bron: 'kaart', voor: k.voor, opzij: k.opzij };
  }
  return { ...VASTE_PLEK, ingang, bron: 'vast' };
}

/*
 ---------------------------------------------------------------- de wagen
*/
export function initVishandel({ scene, KAART, player, hud, sfeer, verhaal = null }) {
  if (!scene || !player) return null;
  const M = materialen();

  // waar? Eerst de kaart, dan de botsdozen die er bij het opstarten al staan
  const vrijVanDozen = (x, z) => {
    const [nx, nz] = resolveCollisions(x, z, 0.25);
    return Math.hypot(nx - x, nz - z) < 1e-3;
  };
  const plek = zoekPlek(KAART, vrijVanDozen);
  const grondY = 0.02;                          // de klinkers van het parkeervlak (y 0 in de kaart)

  const groep = new THREE.Group();
  groep.name = 'vishandel';
  groep.position.set(plek.x, grondY, plek.z);
  groep.rotation.y = plek.yaw;
  scene.add(groep);

  const blok = (b, h, d, mat, x, y, z, { schaduw = true, ouder = groep } = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = schaduw; m.receiveShadow = true;
    ouder.add(m);
    return m;
  };
  const vlak = (b, h, mat, x, y, z, ry = 0, ouder = groep) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(b, h), mat);
    m.position.set(x, y, z); m.rotation.y = ry;
    m.receiveShadow = true;
    ouder.add(m);
    return m;
  };

  // ---- de opbouw: onderbak, dak, achterwand, kopse kanten, de stijlen naast de opening ----
  blok(L, OPEN_Y0 - ONDER, B, M.wit, 0, (ONDER + OPEN_Y0) / 2, 0);
  blok(L + 0.06, H - OPEN_Y1, B + 0.06, M.wit, 0, (OPEN_Y1 + H) / 2, 0);
  blok(L, OPEN_H, 0.06, M.wit, 0, (OPEN_Y0 + OPEN_Y1) / 2, -B / 2 + 0.03);
  for (const sx of [-1, 1]) {
    blok(0.06, OPEN_H, B, M.wit, sx * (L / 2 - 0.03), (OPEN_Y0 + OPEN_Y1) / 2, 0);
    blok(L / 2 - OPEN_X1, OPEN_H, 0.06, M.wit, sx * (OPEN_X1 + L / 2) / 2, (OPEN_Y0 + OPEN_Y1) / 2, B / 2 - 0.03);
  }
  blok(L - 0.3, 0.08, B - 0.3, M.wit, 0, H + 0.04, 0);                 // de kap op het dak
  blok(L + 0.02, 0.2, B + 0.02, M.blauw, 0, 0.66, 0);                  // de blauwe band rondom
  vlak(L, H - ONDER, M.wand, 0, (ONDER + H) / 2, -B / 2 - 0.035, Math.PI);   // de achterwand, van buiten
  vlak(L, OPEN_Y0 - 0.78, M.onder, 0, (0.78 + OPEN_Y0) / 2, B / 2 + 0.012);   // onder de toonbank

  // ---- binnen: de wand, de vloer, de frituur, de zwarte bovenrand met de kaartjes ----
  vlak(L - 0.12, OPEN_Y1 - VLOER, M.binnen, 0, (VLOER + OPEN_Y1) / 2, -B / 2 + 0.065);
  blok(L - 0.12, 0.04, B - 0.12, M.binnen, 0, VLOER - 0.02, 0, { schaduw: false });
  blok(1.6, 0.9, 0.6, M.rvs, -1.6, VLOER + 0.45, -B / 2 + 0.4);
  for (const dx of [-1.95, -1.25]) blok(0.55, 0.04, 0.42, M.olie, dx, VLOER + 0.9, -B / 2 + 0.4, { schaduw: false });
  blok(1.2, 1.0, 0.5, M.rvs, 1.6, VLOER + 0.5, -B / 2 + 0.35);
  blok(OPEN_B, 0.48, 0.05, M.zwart, 0, OPEN_Y1 - 0.24, B / 2 - 0.1);
  vlak(OPEN_B - 0.1, 0.42, M.menu, 0, OPEN_Y1 - 0.24, B / 2 - 0.07);

  // ---- de toonbank met de gekoelde vitrine: schuin glas, binnen de lijn van het luik ----
  const VX0 = OPEN_X0 + 0.25, VX1 = OPEN_X1 - 0.25, VB = VX1 - VX0, VM = (VX0 + VX1) / 2;
  blok(OPEN_B + 0.1, 0.06, 0.9, M.rvs, 0, OPEN_Y0 + 0.03, B / 2 - 0.2);
  blok(VB, 0.12, 0.62, M.rvs, VM, OPEN_Y0 + 0.12, B / 2 - 0.4);             // de koelbak
  const ijs = vlak(VB - 0.04, 0.56, M.vitrine, VM, OPEN_Y0 + 0.185, B / 2 - 0.4);
  ijs.rotation.x = -Math.PI / 2;
  {
    // het glas: een schuine voorruit van de voorrand naar achter, en een smalle bovenplaat
    const voorZ = B / 2 - 0.1, achterZ = B / 2 - 0.55, onderY = OPEN_Y0 + 0.18, bovenY = OPEN_Y0 + 0.52;
    const lang = Math.hypot(voorZ - achterZ - 0.15, bovenY - onderY);
    const ruit = vlak(VB, lang, M.glas, VM, (onderY + bovenY) / 2, (voorZ + achterZ + 0.15) / 2);
    ruit.rotation.x = -Math.atan2(voorZ - achterZ - 0.15, bovenY - onderY);
    const top = vlak(VB, 0.15, M.glas, VM, bovenY, achterZ + 0.075);
    top.rotation.x = -Math.PI / 2;
    for (const x of [VX0, VX1]) blok(0.03, bovenY - onderY, voorZ - achterZ, M.rvs, x, (onderY + bovenY) / 2, (voorZ + achterZ) / 2, { schaduw: false });
  }
  // een bakje kibbeling op de toonbank, klaar om mee te nemen
  blok(0.22, 0.06, 0.14, M.wit, VX1 + 0.12, OPEN_Y0 + 0.09, B / 2 + 0.18);
  blok(0.18, 0.04, 0.1, M.olie, VX1 + 0.12, OPEN_Y0 + 0.13, B / 2 + 0.18, { schaduw: false });

  // ---- de bloembak op de linkerhoek, met rode bloemen: aan de wand onder de
  // toonbank, zodat het luik er overheen dicht kan ----
  {
    const bx = -L / 2 + 0.45, bz = B / 2 + 0.17, by = 0.86;
    blok(0.04, 0.2, 0.16, M.staal, bx, by - 0.08, B / 2 + 0.08);       // de beugel
    blok(0.55, 0.22, 0.3, M.bak, bx, by + 0.11, bz);
    blok(0.5, 0.02, 0.26, M.aarde, bx, by + 0.215, bz, { schaduw: false });
    const blad = new THREE.IcosahedronGeometry(0.07, 0), bloem = new THREE.IcosahedronGeometry(0.05, 0);
    const r = kansen(29);
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(blad, M.blad);
      m.position.set(bx - 0.22 + r() * 0.44, by + 0.27 + r() * 0.06, bz - 0.1 + r() * 0.2);
      m.scale.set(1.3, 0.8, 1.1); groep.add(m);
    }
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(bloem, M.bloem);
      m.position.set(bx - 0.22 + r() * 0.44, by + 0.33 + r() * 0.1, bz - 0.11 + r() * 0.22);
      groep.add(m);
    }
  }

  // ---- onderstel: één as met twee wielen, spatborden, steunpoten, de dissel links ----
  for (const sz of [-1, 1]) {
    const wiel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 20), M.rubber);
    wiel.rotation.x = Math.PI / 2; wiel.position.set(0.2, 0.34, sz * (B / 2 - 0.16)); wiel.castShadow = true;
    groep.add(wiel);
    const velg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.23, 16), M.velg);
    velg.rotation.x = Math.PI / 2; velg.position.copy(wiel.position);
    groep.add(velg);
    blok(0.95, 0.04, 0.3, M.staal, 0.2, 0.74, sz * (B / 2 - 0.1));
    for (const sx of [-1, 1]) blok(0.08, ONDER, 0.08, M.staal, sx * (L / 2 - 0.4), ONDER / 2, sz * (B / 2 - 0.3));
  }
  blok(L - 0.4, 0.12, 0.12, M.staal, 0, ONDER - 0.06, 0);
  {
    const d = new THREE.Shape();
    d.moveTo(0, -0.8); d.lineTo(DISSEL, 0); d.lineTo(0, 0.8); d.lineTo(0, 0.65); d.lineTo(DISSEL - 0.22, 0); d.lineTo(0, -0.65);
    const geo = new THREE.ExtrudeGeometry(d, { depth: 0.08, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    geo.rotateY(Math.PI);                         // naar links (-x)
    const m = new THREE.Mesh(geo, M.staal);
    m.position.set(-L / 2, 0.5, 0); m.castShadow = true;
    groep.add(m);
    blok(0.06, 0.5, 0.06, M.staal, -L / 2 - DISSEL + 0.15, 0.25, 0);            // de steunpoot onder de neus
    const neus = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 12), M.rubber);
    neus.rotation.x = Math.PI / 2; neus.position.set(-L / 2 - DISSEL + 0.15, 0.08, 0);
    groep.add(neus);
  }

  // ---- het luik met de luifel: scharniert aan de bovenrand van de opening ----
  const luik = new THREE.Group();
  luik.position.set(0, OPEN_Y1, B / 2 + 0.03);
  groep.add(luik);
  const luifel = new THREE.Group();               // hangt aan de voorrand, altijd recht naar beneden
  {
    const m = new THREE.Mesh(new THREE.BoxGeometry(OPEN_B + 0.1, LUIK_H, 0.05),
      [M.wit, M.wit, M.wit, M.wit, M.luik, M.luikOnder]);
    m.position.set(0, -LUIK_H / 2, 0.025);
    m.castShadow = true; m.receiveShadow = true;
    luik.add(m);
    luifel.position.set(0, -LUIK_H, 0.05);
    luik.add(luifel);
    const geo = new THREE.PlaneGeometry(OPEN_B + 0.2, LUIFEL_H);
    geo.translate(0, -LUIFEL_H / 2 + 0.05, 0);
    const doekM = new THREE.Mesh(geo, M.luifel);
    doekM.castShadow = true;
    luifel.add(doekM);
    // de kopse kanten van de luifel: een smalle strook terug naar de wagen
    for (const sx of [-1, 1]) {
      const kant = new THREE.Mesh(new THREE.PlaneGeometry(LUIK_H, 0.3), M.wit);
      kant.position.set(sx * (OPEN_B / 2 + 0.1), -0.1, -LUIK_H / 2);
      kant.rotation.y = Math.PI / 2;
      luifel.add(kant);
    }
    // twee gasveren
    for (const sx of [-1, 1]) {
      const veer = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.0, 6), M.staal);
      veer.position.set(sx * (OPEN_B / 2 - 0.1), -0.5, 0.06);
      luik.add(veer);
      luik.userData['veer' + sx] = veer;
    }
  }

  // ---- de vlag aan een stok op de linkerhoek ----
  const vlag = new THREE.Group();
  {
    const stok = new THREE.Group();
    stok.position.set(-L / 2 + 0.05, H - 0.2, B / 2 + 0.05);
    stok.rotation.z = 0.35; stok.rotation.x = 0.25;     // schuin naar buiten
    const paal = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.9, 8), M.wit);
    paal.position.y = 0.95; stok.add(paal);
    const knop = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), M.rvs);
    knop.position.y = 1.92; stok.add(knop);
    const geo = new THREE.PlaneGeometry(0.9, 0.6, 8, 1);
    geo.translate(0.45, 0, 0);
    const doekV = new THREE.Mesh(geo, M.vlag);
    doekV.position.y = 1.55; doekV.castShadow = true;
    stok.add(doekV);
    vlag.add(stok);
    vlag.userData.doek = doekV;
    groep.add(vlag);
  }

  // ---- het zwarte zijpaneel rechts: klapt open naar voren ----
  const paneel = new THREE.Group();
  paneel.position.set(L / 2 + 0.02, 0, B / 2);
  {
    const m = new THREE.Mesh(new THREE.BoxGeometry(PANEEL_B, OPEN_Y1 - 0.3, 0.04), M.zwart);
    m.position.set(PANEEL_B / 2, 0.3 + (OPEN_Y1 - 0.3) / 2, 0);
    m.castShadow = true; m.receiveShadow = true;
    paneel.add(m);
  }
  groep.add(paneel);

  // ---- het stoepbord voor de wagen ----
  const STOEP = { x: OPEN_X1 - 0.6, z: B / 2 + 1.5 };
  {
    const sb = new THREE.Group();
    sb.position.set(STOEP.x, 0, STOEP.z);
    sb.rotation.y = 0.35;
    for (const sz of [-1, 1]) {
      const p = vlak(0.55, 0.85, M.stoep, 0, 0.45, sz * 0.13, sz > 0 ? 0 : Math.PI, sb);
      p.rotation.x = sz * -0.16;
      p.castShadow = true;
    }
    groep.add(sb);
  }

  // ---- de twee verkopers in donkere schorten ----
  const ploeg = new THREE.Group();
  groep.add(ploeg);
  const verkopers = [
    { x: -1.1, kleren: { shirt: 0xf2f4f6, broek: 0x26303e, huid: 0xe3b993, haar: 0x7a5a3a, vest: 0x1f2226, korteMouw: true } },
    { x: 1.3, kleren: { shirt: 0x2c3e66, broek: 0x23262c, huid: 0xd8ad86, haar: 0x2a1d12, vest: 0x1a1c20, pet: true, petKleur: 0x1d4f9c } },
  ].map(v => {
    const drager = new THREE.Group();
    drager.position.set(v.x, VLOER, B / 2 - 0.95);
    ploeg.add(drager);
    const p = new Persoon(v.kleren);
    p.yaw = Math.PI; p.groep.rotation.y = Math.PI;    // naar de toonbank (+z van de wagen)
    drager.add(p.groep);
    return { p, drager };
  });

  // ---- botsdozen: de wagen met de dissel, het zijpaneel, de bloembak en het stoepbord ----
  const cy = Math.cos(plek.yaw), sy = Math.sin(plek.yaw);
  const wereld = (lx, lz) => ({ x: plek.x + lx * cy + lz * sy, z: plek.z - lx * sy + lz * cy });
  const naarWagen = (x, z) => {
    const dx = x - plek.x, dz = z - plek.z;
    return { x: dx * cy - dz * sy, z: dx * sy + dz * cy };
  };
  const hart = wereld(-DISSEL / 2, 0);
  const bots = addCollider(hart.x, hart.z, L / 2 + DISSEL / 2, B / 2 + 0.02, plek.yaw, BOTS_H);
  const pp = wereld(L / 2 + 0.02, B / 2 + PANEEL_B / 2);
  const paneelBots = addCollider(pp.x, pp.z, 0.05, PANEEL_B / 2, plek.yaw, 2.6);
  const sp = wereld(STOEP.x, STOEP.z);
  addCollider(sp.x, sp.z, 0.32, 0.22, plek.yaw + 0.35, 1.0);
  const midden = wereld((TOONBANK.x0 + TOONBANK.x1) / 2, TOONBANK.z);

  // ---------- open of dicht ----------
  const uurNu = () => (sfeer && typeof sfeer.uur === 'number' ? sfeer.uur : 12);
  const openUur = u => u >= VIS.open && u < VIS.dicht;
  let stand = openUur(uurNu()) ? 1 : 0;           // 0 dicht … 1 open
  function zetStand(f) {
    const e = f * f * (3 - 2 * f);
    luik.rotation.x = e * LUIK_OPEN;
    luifel.rotation.x = -luik.rotation.x;         // de luifel hangt altijd recht
    luifel.visible = e > 0.5;
    for (const sx of [-1, 1]) luik.userData['veer' + sx].visible = e > 0.3;
    // het paneel: dicht plat tegen de kopse kant, open haaks naar voren
    paneel.rotation.y = Math.PI / 2 - e * Math.PI;
    paneelBots.h = e > 0.6 ? 2.6 : 0;
    ploeg.visible = f > 0.02;
    vlag.visible = f > 0.02;
  }
  zetStand(stand);

  // ---------- kopen ----------
  let afkoel = 0, gekocht = 0, gloed = -1, klok = 0;
  const geldNu = () => (verhaal && typeof verhaal.geld === 'number') ? verhaal.geld
    : (typeof player.geld === 'number' ? player.geld : 0);
  function betaal(bedrag) {
    if (verhaal && typeof verhaal.betaal === 'function') return verhaal.betaal(bedrag);
    if (typeof player.geld === 'number' && player.geld >= bedrag) { player.geld -= bedrag; return true; }
    return false;
  }
  const isOpen = () => stand > 0.98 && openUur(uurNu());
  // afstand tot de toonbank, die als lijn langs de open kant ligt
  function totToonbank() {
    const p = naarWagen(player.pos.x, player.pos.z);
    const x = Math.max(TOONBANK.x0, Math.min(TOONBANK.x1, p.x));
    // achter de wagen langs telt niet: je moet aan de open kant staan
    if (p.z < B / 2 - 0.1) return Infinity;
    return Math.hypot(p.x - x, p.z - TOONBANK.z);
  }
  function bijToonbank() {
    if (player.inCar || player.inDrone || player.zit) return false;
    if (player.health != null && player.health <= 0) return false;
    return totToonbank() < VIS.bereik;
  }

  function toets() {
    if (!player.active && !window.__autoplay) return false;
    if (!bijToonbank() || !isOpen()) return false;
    if (afkoel > 0) return true;                 // net geprobeerd: E doet even niets
    afkoel = VIS.afkoel;
    if (player.health >= VIS.max) {
      if (hud) hud.melding(NAAM, 'Je zit nog vol. "Kom straks maar terug!"', 2.5);
      return true;
    }
    if (!betaal(VIS.prijs)) {
      if (hud) hud.melding('Te weinig geld', `Kibbeling kost € ${VIS.prijs}. Je hebt € ${geldNu().toLocaleString('nl-NL')}.`, 3);
      return true;
    }
    player.health = Math.min(VIS.max, player.health + VIS.leven);
    if (hud && hud.zetLeven) hud.zetLeven(player.health);
    if (hud) hud.melding(`Kibbeling! +${VIS.leven} leven`, `€ ${VIS.prijs} betaald bij ${NAAM}. Met remoulade.`, 3);
    gekocht++;
    return true;
  }

  function hint() {
    if (!bijToonbank()) return null;
    if (!openUur(uurNu())) return `${NAAM} is dicht — open van ${VIS.open} tot ${VIS.dicht} uur`;
    if (!isOpen()) return null;
    return `E — kibbeling kopen (€ ${VIS.prijs}, +${VIS.leven} leven)`;
  }

  // ---------- elk beeld ----------
  function update(dt) {
    if (afkoel > 0) afkoel = Math.max(0, afkoel - dt);
    const px = player.pos.x, pz = player.pos.z;
    const ver = Math.hypot(px - plek.x, pz - plek.z);
    groep.visible = ver < VIS.zicht;
    // open overdag, dicht 's avonds; ver weg meteen op zijn stand
    const doel = openUur(uurNu()) ? 1 : 0;
    if (stand !== doel) {
      stand = ver > 120 ? doel
        : (doel > stand ? Math.min(1, stand + dt / VIS.luikTijd) : Math.max(0, stand - dt / VIS.luikTijd));
      zetStand(stand);
    }
    if (!groep.visible) return;
    klok += dt;
    if (ploeg.visible && ver < 60) {
      // de vlag wappert een beetje
      vlag.userData.doek.rotation.y = Math.sin(klok * 2.1) * 0.25;
      // de verkopers kijken naar wie dichtbij staat (in het assenstelsel van de wagen)
      const w = naarWagen(px, pz);
      for (const { p, drager } of verkopers) {
        if (ver < 12 && !player.inCar && w.z > 0) p.kijkNaar(w.x - drager.position.x, w.z - drager.position.z, dt, 2.0);
        else p.draaiNaar(Math.PI, dt, 1.5);
        p.update(dt, { loopt: false });
        p.groep.position.set(0, 0, 0);          // update zet hem op de grond; hij staat op de vloer van de wagen
      }
    }
    // 's avonds gloeien de borden een beetje
    const avond = sfeer && typeof sfeer.ramenAan === 'number' ? sfeer.ramenAan : 0;
    if (Math.abs(avond - gloed) > 0.02) {
      gloed = avond;
      for (const m of [M.wand, M.luik, M.onder, M.luifel]) m.emissiveIntensity = 0.05 + avond * 0.25;
      M.stoep.emissiveIntensity = 0.08 + avond * 0.4;
      M.menu.emissiveIntensity = 0.55 + avond * 0.35;
      M.luikOnder.emissiveIntensity = 0.12 + avond * 0.6;
    }
  }

  const kaartPlek = { x: midden.x, z: midden.z, naam: NAAM, wat: 'vis' };
  return {
    update, toets, hint,
    plek: kaartPlek,
    get winkels() { return [kaartPlek]; },
    get stand() {
      return {
        x: plek.x, z: plek.z, yaw: plek.yaw, bron: plek.bron,
        toonbank: { x: midden.x, z: midden.z }, afstand: totToonbank(),
        open: isOpen(), luik: stand, verkopers: ploeg.visible,
        afkoel, gekocht, prijs: VIS.prijs, leven: VIS.leven, bots,
      };
    },
    groep, verkopers: verkopers.map(v => v.p),
  };
}

/*
 Het speldje op de kaart: een vis op een zalmkleurig speldje, in dezelfde
 lijst als de andere (js/hud.js `PICTO`, `PICTO_KLEUR`). Zo hoeft js/hud.js zelf
 niet open; de kleur is een andere dan die van de andere speldjes, dat meet
 tools/legendatest.mjs.
*/
HUD.PICTO_KLEUR.vis = '#ff8a7a';
HUD.PICTO.vis = (c, r) => {
  HUD.speld(c, r, HUD.PICTO_KLEUR.vis, '#3a1410');
  c.fillStyle = '#fff6f2';
  c.beginPath(); c.ellipse(-r * 0.1, 0, r * 0.42, r * 0.22, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.moveTo(r * 0.24, 0); c.lineTo(r * 0.58, -r * 0.24); c.lineTo(r * 0.58, r * 0.24); c.closePath(); c.fill();
  c.fillStyle = '#3a1410';
  c.beginPath(); c.arc(-r * 0.32, -r * 0.04, r * 0.06, 0, Math.PI * 2); c.fill();
};

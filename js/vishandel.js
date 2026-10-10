/*
 Martens Vishandel: een viswagen op het parkeerterrein voor de Jumbo aan de
 Molenkrite (verzoek 10 okt 2026: "Martens Vishandel voor de jumbo op de
 Molenkrite op het parkeerterrein. Krijg je bij kopen portie kibbeling 25
 levens. Kost 20 euro.").

 De wagen is een witte verkoopaanhanger met een blauwe band, zoals ze op de
 markt en voor de supermarkten staan:

   - 5,8 m lang, 2,3 m breed en 3,0 m hoog, op één as met een dissel;
   - aan de lange kant een luik van 4,35 bij 1,3 m dat aan zijn bovenrand
     scharniert en open bijna vlak naar buiten staat: dan is het de luifel, met
     een gestreepte rand eraan;
   - een rvs toonbank voor het luik, daarop een vitrine met kibbeling,
     lekkerbekjes en haring op ijs, en achterin de frituur;
   - de naam op de achterwand, op de band boven het luik en op het luik zelf,
     een prijsbord naast het luik en een stoepbord ervoor: "Kibbeling € 20";
   - achter de toonbank de visboer, met pet en blauw schort.

 Alles is op canvas getekend (geen afbeeldingsbestanden, zie CLAUDE.md).

 Waar hij staat wordt gezocht, niet geraden (`zoekPlek`): vóór de ingang van
 het pand van type `jumbo` in de kaart, op het verharde terrein ervoor
 (parkeervlak, voetpad), met het luik naar de ingang. Een plek valt af als een
 hoek van de wagen of het stuk waar de klanten staan in een rijbaan, een inrit
 of een pand ligt, op een parkeerplek (daar zet js/vehicles.js een auto neer),
 bij een boom of een lantaarn, of op het looppad van de voetgangers. Bij het
 opstarten kijkt `resolveCollisions` daarna nog of er geen botsdoos staat (een
 vlaggenmast, een fietsenrek); pas dan krijgt de wagen zijn eigen doos. Die is
 hoger dan 3,5 m, anders rijdt een auto er dwars doorheen (js/vehicles.js).

 Open van 9 tot 18 uur (`VIS.open`, `VIS.dicht`, op `sfeer.uur`). Daarbuiten
 gaat het luik dicht en is de visboer naar huis. Hij verdwijnt pas als het luik
 dicht is, en komt pas terug voordat het opengaat; het aantal lichtbronnen
 verandert nergens (zie stap 83): de gloed van de borden 's avonds zit in de
 materialen.

 Kopen: E binnen `VIS.bereik` van de toonbank, te voet. Een portie kibbeling
 kost `VIS.prijs` en geeft `VIS.leven` leven, tot het maximum van 100 (zoals
 het bier en de barbecue in js/interieur.js). Te weinig geld of al vol: een
 melding, en niets betaald. Na een aankoop wacht E `VIS.afkoel` tellen, zodat
 je er niet per ongeluk tien koopt.
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
  afkoel: 1.5,        // s tussen twee porties
  open: 9,            // uur
  dicht: 18,
  luikTijd: 2.2,      // s om het luik open of dicht te doen
  zicht: 260,         // verder weg tekenen we hem niet
};

// ---------- maten (m), in het assenstelsel van de wagen ----------
// x langs de wagen, z dwars (+z is de kant van het luik), y omhoog
const L = 5.8, B = 2.3, H = 3.0;
const ONDER = 0.55;            // onderkant van de opbouw
const VLOER = 0.62;            // daar staat de visboer op
const LUIK_X0 = -2.4, LUIK_X1 = 1.95;
const LUIK_Y0 = 1.25, LUIK_Y1 = 2.55;
const LUIK_B = LUIK_X1 - LUIK_X0, LUIK_H = LUIK_Y1 - LUIK_Y0;
const LUIK_OPEN = -(Math.PI / 2 + 0.12);   // bijna vlak, de voorrand iets omhoog
const DISSEL = 1.0;            // zover steekt de dissel voor de wagen uit (+x)
const KLANT = 1.8;             // diepte van het stuk voor het luik waar je staat
const TOONBANK = { x: (LUIK_X0 + LUIK_X1) / 2, z: B / 2 + 0.45 };
const BOTS_H = 3.6;            // hoger dan 3,5: anders rijdt een auto erdoorheen

// als er in de kaart geen Jumbo te vinden is: de plek van 10 okt 2026
const VASTE_PLEK = { x: 235.0, z: -62.8, yaw: 0 };

// ---------- doeken ----------
function doek(w, h, teken) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  teken(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const BLAUW = '#1d4f9c', DONKER = '#123468', LICHT = '#5aa6e0';

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

// de achterwand (de kant van de wagen zonder luik): de hele wand
function wandDoek() {
  return doek(2048, 1024, (g, w, h) => {
    g.fillStyle = '#f6f7f6'; g.fillRect(0, 0, w, h);
    // blauwe band onderaan met golfjes erboven
    g.fillStyle = BLAUW; g.fillRect(0, h * 0.74, w, h * 0.26);
    golven(g, h * 0.70, w, LICHT, 10, 12, 140);
    golven(g, h * 0.66, w, BLAUW, 6, 10, 140);
    naam(g, w * 0.42, h * 0.36, 1.45);
    vis(g, w * 0.82, h * 0.30, 2.6);
    vis(g, w * 0.86, h * 0.50, 1.6, BLAUW);
    g.fillStyle = '#ffffff'; g.font = 'bold 74px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Kibbeling  ·  Lekkerbekje  ·  Haring', w / 2, h * 0.865);
    // naden van de opbouw
    g.fillStyle = 'rgba(0,0,0,0.08)';
    for (const f of [0.005, 0.995]) g.fillRect(w * f - 3, 0, 6, h);
  });
}
// het luik van buiten: dat zie je als de wagen dicht is
function luikDoek() {
  return doek(1536, 512, (g, w, h) => {
    g.fillStyle = '#f6f7f6'; g.fillRect(0, 0, w, h);
    g.fillStyle = BLAUW; g.fillRect(0, h - 70, w, 70);
    naam(g, w * 0.44, h * 0.50, 1.15);
    vis(g, w * 0.84, h * 0.42, 1.9);
    g.fillStyle = '#ffffff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('Kibbeling · Lekkerbekje · Haring', w / 2, h - 35);
    g.strokeStyle = '#c9ccce'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  });
}
// het luik van onderen: wit, met twee lichtbakken
function luikOnderDoek() {
  return doek(512, 256, (g, w, h) => {
    g.fillStyle = '#eef0f0'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fffbe6';
    for (const x of [0.22, 0.78]) g.fillRect(w * x - 60, h * 0.42, 120, 30);
    g.strokeStyle = '#cfd3d4'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  });
}
// de band boven het luik
function bandDoek() {
  return doek(2048, 256, (g, w, h) => {
    g.fillStyle = BLAUW; g.fillRect(0, 0, w, h);
    g.fillStyle = LICHT; g.fillRect(0, h - 22, w, 10);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'italic bold 150px Georgia, serif';
    g.fillText('Martens Vishandel', w / 2, h * 0.47);
    vis(g, w * 0.08, h * 0.45, 1.4, '#ffffff', LICHT);
    g.save(); g.translate(w * 0.92, h * 0.45); g.scale(-1, 1); vis(g, 0, 0, 1.4, '#ffffff', LICHT); g.restore();
  });
}
// de onderkant aan de luikkant, onder de toonbank
function onderDoek() {
  return doek(2048, 256, (g, w, h) => {
    g.fillStyle = '#f6f7f6'; g.fillRect(0, 0, w, h);
    g.fillStyle = BLAUW; g.fillRect(0, h * 0.45, w, h * 0.55);
    golven(g, h * 0.38, w, LICHT, 8, 8, 120);
    g.fillStyle = '#ffffff'; g.font = 'bold 72px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('VERSE VIS  ·  ELKE DAG  ·  GEBAKKEN WAAR U BIJ STAAT', w / 2, h * 0.73);
  });
}
// het prijsbord naast het luik
function prijsDoek() {
  return doek(256, 320, (g, w, h) => {
    g.fillStyle = '#16233a'; g.fillRect(0, 0, w, h);
    g.fillStyle = BLAUW; g.fillRect(0, 0, w, 54);
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 30px sans-serif'; g.fillText('MARTENS', w / 2, 28);
    g.font = 'bold 38px sans-serif'; g.fillStyle = '#ffe680';
    g.fillText('Kibbeling', w / 2, 96);
    g.font = 'bold 66px sans-serif'; g.fillStyle = '#ffffff';
    g.fillText(`€ ${VIS.prijs}`, w / 2, 160);
    g.font = '24px sans-serif'; g.fillStyle = '#c9d6ea';
    g.fillText('met remoulade', w / 2, 204);
    g.fillText('of knoflooksaus', w / 2, 232);
    g.font = 'italic 22px sans-serif'; g.fillStyle = '#8fb3e0';
    g.fillText(`+${VIS.leven} leven`, w / 2, 284);
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
    g.fillStyle = '#f2f2ea'; g.font = '24px sans-serif'; g.fillText('lekkerbekje · haring', w / 2, 334);
  });
}
// de vitrine van boven: ijs met vis erop
function vitrineDoek() {
  return doek(1024, 256, (g, w, h) => {
    g.fillStyle = '#e9f2f6'; g.fillRect(0, 0, w, h);
    let s = 5; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 500; i++) {             // het ijs
      g.fillStyle = `rgba(${200 + r() * 40},${225 + r() * 25},255,0.7)`;
      g.beginPath(); g.arc(r() * w, r() * h, 3 + r() * 6, 0, Math.PI * 2); g.fill();
    }
    // drie bakken: kibbeling, lekkerbekjes, haring
    const bak = (x0, x1, teken) => {
      g.fillStyle = '#c9d2d6'; g.fillRect(x0, 20, x1 - x0, h - 40);
      g.fillStyle = '#f4f6f6'; g.fillRect(x0 + 8, 28, x1 - x0 - 16, h - 56);
      teken(x0 + 8, x1 - 8);
    };
    bak(20, 360, (a, b) => {                    // kibbeling: goudbruine brokjes
      for (let i = 0; i < 70; i++) {
        g.fillStyle = ['#c98a2e', '#dca04a', '#b8741f'][i % 3];
        g.beginPath(); g.ellipse(a + 12 + r() * (b - a - 24), 46 + r() * (h - 92), 14, 10, r() * 3, 0, Math.PI * 2); g.fill();
      }
    });
    bak(370, 690, (a, b) => {                   // lekkerbekjes: lange gebakken stukken
      for (let i = 0; i < 6; i++) {
        g.fillStyle = i % 2 ? '#c88634' : '#d99b45';
        g.beginPath(); g.ellipse(a + 50 + (i % 3) * 95, 80 + Math.floor(i / 3) * 90, 44, 22, 0.2, 0, Math.PI * 2); g.fill();
      }
    });
    bak(700, 1004, (a) => {                     // haring: zilver
      for (let i = 0; i < 8; i++) vis(g, a + 50 + (i % 4) * 72, 80 + Math.floor(i / 4) * 92, 0.62, '#7d8c99', '#dfe6ec');
    });
  });
}
// de gestreepte rand aan de voorkant van het open luik
function streepDoek() {
  const t = doek(256, 64, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : BLAUW; g.fillRect(i * 32, 0, 32, h); }
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(i * 32 + 16, h, 16, Math.PI, 0); g.fill(); }
  });
  t.wrapS = THREE.RepeatWrapping; t.repeat.set(4, 1);
  return t;
}

// ---------- materialen: allemaal bij het opstarten, ook de doorzichtige ----------
function materialen() {
  const std = (kleur, extra = {}) => new THREE.MeshStandardMaterial({ color: kleur, roughness: 0.6, ...extra });
  const bord = map => new THREE.MeshStandardMaterial({ map, roughness: 0.5, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.05 });
  return {
    wit: std(0xf4f5f4, { roughness: 0.4 }),
    blauw: std(0x1d4f9c, { roughness: 0.45 }),
    rvs: std(0xc4c9cc, { roughness: 0.28, metalness: 0.75 }),
    binnen: std(0xdfe3e3, { roughness: 0.7 }),
    rubber: std(0x1b1c1e, { roughness: 0.9 }),
    velg: std(0x9ea3a7, { roughness: 0.35, metalness: 0.6 }),
    staal: std(0x2c2f33, { roughness: 0.55, metalness: 0.4 }),
    olie: std(0xb8862a, { roughness: 0.15, metalness: 0.1, emissive: 0x3a2400, emissiveIntensity: 0.35 }),
    glas: new THREE.MeshStandardMaterial({ color: 0xdfeef4, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false }),
    wand: bord(wandDoek()),
    luik: bord(luikDoek()),
    luikOnder: std(0xffffff, { map: luikOnderDoek(), emissive: 0xfff4d6, emissiveIntensity: 0.12 }),
    band: bord(bandDoek()),
    onder: bord(onderDoek()),
    prijs: bord(prijsDoek()),
    stoep: bord(stoepDoek()),
    vitrine: std(0xffffff, { map: vitrineDoek(), roughness: 0.35 }),
    streep: std(0xffffff, { map: streepDoek(), roughness: 0.8, side: THREE.DoubleSide }),
  };
}

/*
 ---------------------------------------------------------------- de plek

 Vóór de ingang van de Jumbo: de voorgevel kijkt naar `front` van het pand (in
 de kaart staat dat naar het parkeerterrein aan de noordkant, zie
 data/stijl/straten.json), en de ingang is het midden van die gevel. Vanaf
 daar een raster van plekken op 7–14 m voor de gevel en tot 20 m opzij; de
 wagen staat er evenwijdig aan de gevel, met het luik naar de ingang.

 Pure kaartgegevens, dus ook zonder browser na te rekenen; `vrij` is een
 extra toets die js/world.js er bij het opstarten bij doet (de botsdozen).
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
  const fl = Math.hypot(...(pand.front || [0, -1])) || 1;
  const fx = (pand.front || [0, -1])[0] / fl, fz = (pand.front || [0, -1])[1] / fl;
  let diep = 0;
  for (const q of pand.voet) diep = Math.max(diep, (q[0] - cx) * fx + (q[1] - cz) * fz);
  const ingang = { x: cx + fx * diep, z: cz + fz * diep };
  const sx = -fz, sz = fx;                        // langs de gevel

  // alles in de buurt één keer verzamelen
  const R = 45, bij = (x, z) => Math.abs(x - ingang.x) < R && Math.abs(z - ingang.z) < R;
  const vlakken = (KAART.vlakken || []).filter(v => v.r && v.r[0] && v.r[0].some(q => bij(q[0], q[1])));
  const panden = (KAART.panden || []).filter(p => p.voet && p.voet.some(q => bij(q[0], q[1])));
  const plekken = (KAART.parkeerplekken || []).filter(p => bij(p.x, p.z));
  const bomen = (KAART.bomen || []).filter(p => bij(p.x, p.z));
  const lampen = (KAART.lantaarns || []).filter(p => bij(p.x, p.z));
  const assen = (KAART.wegassen || []).filter(a => a.pts && a.pts.some(q => bij(q[0], q[1])));

  // de wagen kijkt met zijn luik (+z) naar de ingang, dus z van de wagen = -front
  const yaw = Math.atan2(-fx, -fz);
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const naarWereld = (px, pz, lx, lz) => ({ x: px + lx * c + lz * s, z: pz - lx * s + lz * c });

  function toets(px, pz) {
    // de wagen, de dissel en het stuk ervoor waar de klanten staan
    const punten = [];
    for (let lx = -L / 2; lx <= L / 2 + DISSEL + 1e-6; lx += 0.85)
      for (let lz = -B / 2; lz <= B / 2 + KLANT + 1e-6; lz += 0.6) punten.push(naarWereld(px, pz, lx, lz));
    let verhard = 0;
    for (const p of punten) {
      let ok = false;
      for (const v of vlakken) {
        if (!inVlak(p.x, p.z, v)) continue;
        if (VERBODEN.has(v.k)) return null;
        if (VERHARD.has(v.k)) ok = true;
      }
      if (ok) verhard++;
      for (const q of panden) if (inRing(p.x, p.z, q.voet)) return null;
      // een geparkeerde auto is 4,6 bij 1,9: zijn hart moet ruim van de wagen af
      for (const q of plekken) if (Math.hypot(p.x - q.x, p.z - q.z) < 2.6) return null;
      for (const q of bomen) if (Math.hypot(p.x - q.x, p.z - q.z) < 2.2 + (q.s || 1) * 0.6) return null;
      for (const q of lampen) if (Math.hypot(p.x - q.x, p.z - q.z) < 0.9) return null;
      for (const a of assen) {
        const d = afstandTotLijn(p.x, p.z, a.pts);
        // rijwegen ruim mijden; het looppad van de voetgangers (js/npc.js) half
        if (a.drive && d < a.w / 2 + 1.5) return null;
        if (!a.drive && d < a.w * 0.35) return null;
      }
      if (vrij && !vrij(p.x, p.z)) return null;
    }
    if (verhard < punten.length) return null;    // helemaal op de klinkers
    return punten.length;
  }

  // dichtbij de ingang en zo recht mogelijk ervoor gaat voor
  const kandidaten = [];
  for (let voor = 7; voor <= 14; voor += 0.5)
    for (let opzij = -20; opzij <= 20; opzij += 0.5)
      kandidaten.push({ voor, opzij, kost: (voor - 7) * 1.0 + Math.abs(opzij) * 0.35 });
  kandidaten.sort((a, b) => a.kost - b.kost);
  for (const k of kandidaten) {
    // het hart van de wagen ligt B/2 achter de rand aan de luikkant
    const x = ingang.x + fx * (k.voor + B / 2) + sx * k.opzij;
    const z = ingang.z + fz * (k.voor + B / 2) + sz * k.opzij;
    if (toets(x, z)) return { x, z, yaw, ingang, bron: 'kaart', voor: k.voor, opzij: k.opzij };
  }
  return { ...VASTE_PLEK, yaw, ingang, bron: 'vast' };
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

  const blok = (b, h, d, mat, x, y, z, { schaduw = true } = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = schaduw; m.receiveShadow = true;
    groep.add(m);
    return m;
  };
  const vlak = (b, h, mat, x, y, z, ry = 0, ouder = groep) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(b, h), mat);
    m.position.set(x, y, z); m.rotation.y = ry;
    m.receiveShadow = true;
    ouder.add(m);
    return m;
  };

  // ---- de opbouw: onderbak, dak, achterwand, kopse kanten, de stukken naast het luik ----
  blok(L, LUIK_Y0 - ONDER, B, M.wit, 0, (ONDER + LUIK_Y0) / 2, 0);
  blok(L + 0.06, H - LUIK_Y1, B + 0.06, M.wit, 0, (LUIK_Y1 + H) / 2, 0);
  blok(L, LUIK_Y1 - LUIK_Y0, 0.06, M.wit, 0, (LUIK_Y0 + LUIK_Y1) / 2, -B / 2 + 0.03);
  for (const sx of [-1, 1]) blok(0.06, LUIK_Y1 - LUIK_Y0, B, M.wit, sx * (L / 2 - 0.03), (LUIK_Y0 + LUIK_Y1) / 2, 0);
  blok(LUIK_X0 + L / 2, LUIK_Y1 - LUIK_Y0, 0.06, M.wit, (-L / 2 + LUIK_X0) / 2, (LUIK_Y0 + LUIK_Y1) / 2, B / 2 - 0.03);
  blok(L / 2 - LUIK_X1, LUIK_Y1 - LUIK_Y0, 0.06, M.wit, (LUIK_X1 + L / 2) / 2, (LUIK_Y0 + LUIK_Y1) / 2, B / 2 - 0.03);
  // het dak een tikje bol: een lage kap erop
  blok(L - 0.3, 0.08, B - 0.3, M.wit, 0, H + 0.04, 0);
  // de blauwe band rondom, net onder de toonbank
  blok(L + 0.02, 0.2, B + 0.02, M.blauw, 0, 0.66, 0);
  // de opschriften
  vlak(L, H - ONDER, M.wand, 0, (ONDER + H) / 2, -B / 2 - 0.035, Math.PI);   // achterwand, van buiten
  vlak(L + 0.06, H - LUIK_Y1 - 0.02, M.band, 0, (LUIK_Y1 + H) / 2, B / 2 + 0.035);
  vlak(L, LUIK_Y0 - 0.78, M.onder, 0, (0.78 + LUIK_Y0) / 2, B / 2 + 0.012);
  // binnen: wanden, vloer, de frituur en een schap
  vlak(L - 0.12, LUIK_Y1 - VLOER, M.binnen, 0, (VLOER + LUIK_Y1) / 2, -B / 2 + 0.065);
  blok(L - 0.12, 0.04, B - 0.12, M.binnen, 0, VLOER - 0.02, 0, { schaduw: false });
  blok(1.4, 0.92, 0.6, M.rvs, -1.4, VLOER + 0.46, -B / 2 + 0.4);
  for (const dx of [-1.72, -1.08]) blok(0.5, 0.04, 0.42, M.olie, dx, VLOER + 0.9, -B / 2 + 0.4, { schaduw: false });
  blok(0.9, 1.0, 0.5, M.rvs, 1.1, VLOER + 0.5, -B / 2 + 0.35);
  blok(2.2, 0.04, 0.3, M.rvs, 0.6, 2.0, -B / 2 + 0.2);

  // ---- de toonbank met de vitrine ----
  blok(LUIK_B + 0.1, 0.06, 0.62, M.rvs, TOONBANK.x, LUIK_Y0 + 0.03, B / 2 + 0.06);
  blok(LUIK_B * 0.62, 0.3, 0.44, M.glas, TOONBANK.x - 0.55, LUIK_Y0 + 0.21, B / 2 - 0.05, { schaduw: false });
  const ijs = vlak(LUIK_B * 0.6, 0.42, M.vitrine, TOONBANK.x - 0.55, LUIK_Y0 + 0.08, B / 2 - 0.05);
  ijs.rotation.x = -Math.PI / 2;
  // een bakje kibbeling op de toonbank, klaar om mee te nemen
  blok(0.22, 0.06, 0.14, M.wit, TOONBANK.x + 1.3, LUIK_Y0 + 0.09, B / 2 + 0.12);
  blok(0.18, 0.04, 0.1, M.olie, TOONBANK.x + 1.3, LUIK_Y0 + 0.13, B / 2 + 0.12, { schaduw: false });

  // ---- het prijsbord naast het luik ----
  vlak(0.66, 0.84, M.prijs, (LUIK_X1 + L / 2) / 2, 1.85, B / 2 + 0.012);

  // ---- onderstel: as, wielen, spatborden, steunpoten, dissel ----
  for (const sz of [-1, 1]) {
    const wiel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 20), M.rubber);
    wiel.rotation.x = Math.PI / 2; wiel.position.set(-0.3, 0.34, sz * (B / 2 - 0.16)); wiel.castShadow = true;
    groep.add(wiel);
    const velg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.23, 16), M.velg);
    velg.rotation.x = Math.PI / 2; velg.position.copy(wiel.position);
    groep.add(velg);
    blok(0.95, 0.04, 0.3, M.staal, -0.3, 0.74, sz * (B / 2 - 0.1));
    for (const sx of [-1, 1]) blok(0.08, ONDER, 0.08, M.staal, sx * (L / 2 - 0.35), ONDER / 2, sz * (B / 2 - 0.3));
  }
  blok(L - 0.4, 0.12, 0.12, M.staal, 0, ONDER - 0.06, 0);
  {
    const d = new THREE.Shape();
    d.moveTo(0, -0.75); d.lineTo(DISSEL, 0); d.lineTo(0, 0.75); d.lineTo(0, 0.6); d.lineTo(DISSEL - 0.2, 0); d.lineTo(0, -0.6);
    const geo = new THREE.ExtrudeGeometry(d, { depth: 0.08, bevelEnabled: false });
    geo.rotateX(Math.PI / 2);
    const m = new THREE.Mesh(geo, M.staal);
    m.position.set(L / 2, 0.5, 0); m.castShadow = true;
    groep.add(m);
    blok(0.06, 0.5, 0.06, M.staal, L / 2 + DISSEL - 0.15, 0.25, 0);   // het neuswiel, als poot
  }

  // ---- het luik: scharniert aan de bovenrand van de opening ----
  const luik = new THREE.Group();
  luik.position.set((LUIK_X0 + LUIK_X1) / 2, LUIK_Y1, B / 2 + 0.03);
  groep.add(luik);
  {
    const kant = M.wit;
    const m = new THREE.Mesh(new THREE.BoxGeometry(LUIK_B, LUIK_H, 0.05),
      [kant, kant, kant, kant, M.luik, M.luikOnder]);
    m.position.set(0, -LUIK_H / 2, 0.025);
    m.castShadow = true; m.receiveShadow = true;
    luik.add(m);
    // de gestreepte rand hangt aan de onderrand, en als het luik open is aan de voorkant
    const rand = new THREE.Mesh(new THREE.PlaneGeometry(LUIK_B, 0.28), M.streep);
    rand.position.set(0, -LUIK_H, 0.055); rand.rotation.x = Math.PI / 2;
    rand.castShadow = true;
    luik.add(rand);
    luik.userData.rand = rand;
    // twee gasveren
    for (const sx of [-1, 1]) {
      const veer = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6), M.staal);
      veer.position.set(sx * (LUIK_B / 2 - 0.1), -0.45, 0.06);
      luik.add(veer);
      luik.userData['veer' + sx] = veer;
    }
  }

  // ---- het stoepbord voor de wagen ----
  const STOEP = { x: LUIK_X1 + 0.9, z: B / 2 + 1.35 };
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

  // ---- de visboer ----
  const drager = new THREE.Group();
  drager.position.set(TOONBANK.x + 0.4, VLOER, B / 2 - 0.55);
  groep.add(drager);
  const verkoper = new Persoon({ shirt: 0xf2f4f6, broek: 0x26303e, huid: 0xe3b993, haar: 0x7a5a3a,
    pet: true, petKleur: 0xf4f4f2, vest: 0x1d4f9c, korteMouw: true });
  verkoper.groep.position.set(0, 0, 0);
  verkoper.yaw = Math.PI; verkoper.groep.rotation.y = Math.PI;    // naar het luik (+z van de wagen)
  drager.add(verkoper.groep);

  // ---- botsdozen: de wagen met de dissel, en het stoepbord ----
  const cy = Math.cos(plek.yaw), sy = Math.sin(plek.yaw);
  const wereld = (lx, lz) => ({ x: plek.x + lx * cy + lz * sy, z: plek.z - lx * sy + lz * cy });
  const hart = wereld(DISSEL / 2, 0);
  const bots = addCollider(hart.x, hart.z, L / 2 + DISSEL / 2, B / 2 + 0.02, plek.yaw, BOTS_H);
  const sp = wereld(STOEP.x, STOEP.z);
  addCollider(sp.x, sp.z, 0.32, 0.22, plek.yaw - 0.35, 1.0);
  const toonbank = wereld(TOONBANK.x, TOONBANK.z);

  // ---------- open of dicht ----------
  const uurNu = () => (sfeer && typeof sfeer.uur === 'number' ? sfeer.uur : 12);
  const openUur = u => u >= VIS.open && u < VIS.dicht;
  let luikStand = openUur(uurNu()) ? 1 : 0;     // 0 dicht … 1 open
  function zetLuik(f) {
    const e = f * f * (3 - 2 * f);
    luik.rotation.x = e * LUIK_OPEN;
    // de rand hangt altijd recht naar beneden
    luik.userData.rand.rotation.x = Math.PI / 2 - (Math.PI / 2) * e - luik.rotation.x * 0 + (e > 0 ? -luik.rotation.x : 0) * 0;
    luik.userData.rand.rotation.x = -luik.rotation.x + (1 - e) * Math.PI / 2;
    for (const sx of [-1, 1]) luik.userData['veer' + sx].visible = e > 0.3;
    drager.visible = f > 0.02;
  }
  zetLuik(luikStand);

  // ---------- kopen ----------
  let afkoel = 0, gekocht = 0, gloed = -1;
  const geldNu = () => (verhaal && typeof verhaal.geld === 'number') ? verhaal.geld
    : (typeof player.geld === 'number' ? player.geld : 0);
  function betaal(bedrag) {
    if (verhaal && typeof verhaal.betaal === 'function') return verhaal.betaal(bedrag);
    if (typeof player.geld === 'number' && player.geld >= bedrag) { player.geld -= bedrag; return true; }
    return false;
  }
  const isOpen = () => luikStand > 0.98 && openUur(uurNu());
  function bijToonbank() {
    if (player.inCar || player.inDrone || player.zit) return false;
    if (player.health != null && player.health <= 0) return false;
    return Math.hypot(player.pos.x - toonbank.x, player.pos.z - toonbank.z) < VIS.bereik;
  }

  function toets() {
    if (!player.active && !window.__autoplay) return false;
    if (!bijToonbank() || !isOpen()) return false;
    if (afkoel > 0) return true;                 // net gekocht: E doet even niets
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
    // het luik: open overdag, dicht 's avonds; ver weg meteen op zijn stand
    const doel = openUur(uurNu()) ? 1 : 0;
    if (luikStand !== doel) {
      luikStand = ver > 120 ? doel
        : (doel > luikStand ? Math.min(1, luikStand + dt / VIS.luikTijd) : Math.max(0, luikStand - dt / VIS.luikTijd));
      zetLuik(luikStand);
    }
    if (!groep.visible) return;
    // de visboer kijkt naar wie dichtbij staat (in het assenstelsel van de wagen)
    if (drager.visible && ver < 40) {
      const dx = px - plek.x, dz = pz - plek.z;
      const lx = dx * cy - dz * sy - drager.position.x, lz = dx * sy + dz * cy - drager.position.z;
      if (ver < 12 && !player.inCar) verkoper.kijkNaar(lx, lz, dt, 2.0);
      else verkoper.draaiNaar(Math.PI, dt, 1.5);
      verkoper.update(dt, { loopt: false });
      verkoper.groep.position.set(0, 0, 0);     // update zet hem op de grond; hij staat op de vloer van de wagen
    }
    // 's avonds gloeien de borden een beetje
    const avond = sfeer && typeof sfeer.ramenAan === 'number' ? sfeer.ramenAan : 0;
    if (Math.abs(avond - gloed) > 0.02) {
      gloed = avond;
      for (const m of [M.wand, M.luik, M.band, M.onder]) m.emissiveIntensity = 0.05 + avond * 0.25;
      for (const m of [M.prijs, M.stoep]) m.emissiveIntensity = 0.08 + avond * 0.4;
      M.luikOnder.emissiveIntensity = 0.12 + avond * 0.6;
    }
  }

  const kaartPlek = { x: toonbank.x, z: toonbank.z, naam: NAAM, wat: 'vis' };
  return {
    update, toets, hint,
    plek: kaartPlek,
    get winkels() { return [kaartPlek]; },
    get stand() {
      return {
        x: plek.x, z: plek.z, yaw: plek.yaw, bron: plek.bron,
        toonbank: { ...toonbank }, open: isOpen(), luik: luikStand, verkoper: drager.visible,
        afkoel, gekocht, prijs: VIS.prijs, leven: VIS.leven, bots,
      };
    },
    groep, verkoper,
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

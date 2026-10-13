/*
 Bouwvlakken: plekken waar het spel zelf iets neerzet dat niet in de BGT of de
 3D BAG staat. Daar hoort geen boom, struik of pol gras dwars doorheen te groeien.

 Er zijn er twee. Autohuis Lemmerweg (js/garage.js), op het grasveld aan de
 oostkant van de Lemmerweg, tegenover BP en tegen Duinterpen aan. De plek is
 gekozen uit de kaart zelf (ronde van 27 sep 2026, `npm run garagetest` rekent
 hem na):

   - geen pand, geen rijbaan, geen water in het gebouw of op het voorterrein;
   - ten zuiden van het fietspad naar Duinterpen (z ≈ 97–106), ten oosten van
     de sloot langs de weg (x ≈ 757–763, vanaf z ≈ 116), ten westen van de vijver
     (x ≳ 795) — het grasveld daartussen is 30 bij 50 meter;
   - de inrit ligt ten noorden van waar de sloot begint, recht tegenover de
     zijweg naar BP, zodat hij niet over water hoeft.

 Er stonden twee bomen van de BGT op het veld (bij x 778 z 130 en x 775 z 149);
 die vallen weg, net als de struiken en het gras eronder.

 Dit bestand heeft geen afhankelijkheden, zodat js/kaartwereld.js en
 js/main.js het kunnen lezen zonder dat er een kring van imports ontstaat.
*/

/*
 En de loods van Bouwman (missie 15, js/schaduw.js): op het grasveld tussen de weg
 langs de zuidkant van de stad en het brede water daaronder, oost van de N7-afrit.
 Ook uit de kaart gekozen (27 sep 2026): geen pand binnen zeventig meter, geen
 rijbaan of water op het erf, en van de weg over het gras bereikbaar zonder sloot.
 Het water begint op z ≈ −169 (bij x 1410); de weg ligt op z ≈ −213, met het fietspad
 ertussen op z ≈ −210 tot −206.
*/
export const LOODS = {
  // de loods zelf: de roldeur in de noordgevel kijkt naar het erf
  x0: 1396, x1: 1418, z0: -194, z1: -182,
  // het grind van het erf tussen de loods en het fietspad
  erf: { x0: 1383, x1: 1424, z0: -205.5, z1: -194 },
  // het stukje oprit tussen de weg en het fietspad
  oprit: { x0: 1409, x1: 1415, z0: -213, z1: -210.2 },
  // de kade tussen de loods en het water
  kade: { x0: 1394, x1: 1421, z0: -182, z1: -171.5 },
};

/*
 En de filmset van No Mercy 4 in het Tinga-bos (stap 140, de bijmissie na missie 5, js/nomercy.js): de
 plek uit de foto van de gebruiker, tussen de stammen. Daar staat het bos zo dicht (een stam om de
 twee à drie meter) dat er geen 8,8 cm Flak van zeven meter tussen past; de ploeg heeft een open plek
 gekapt. Een cirkel: geen boom, struik of gras binnen `r` meter.
*/
export const NOMERCY_SET = { x: -150.8, z: -180.6, r: 8.5 };

/*
 En de tweede scène van No Mercy 4, "Het bunkerdorp" (stap 141): een Duits kampement dieper in het bos,
 ten oosten van de eerste set (90 m hemelsbreed, aan de overkant van de sloot die schuin door het bos
 loopt). Gekozen uit de kaart: overal eromheen bos (ook op 10 en 16 m in acht richtingen), geen water,
 oever, pad, erf of rijbaan binnen 14 m, geen pand, hek, heg of as binnen 24 m. Er staan 32 stammen
 binnen 12 m; de ploeg heeft ook hier gekapt. `start` is waar Erik na "Even later…" staat: 32 m ten
 westen van het midden, te voet over droge grond te bereiken (32 m lopen, gemeten op een rooster van 2 m).
*/
export const NOMERCY_KAMP = { x: -63, z: -214, r: 12, start: { x: -95, z: -214 } };

/*
 En de oude Geeuwbrug (stap 161, js/geeuwbrug.js): het betonnen landhoofd met het torentje aan de Geeuw, op het
 BGT-bouwwerk binnen BAG 0091100000016709. Een gedraaide rechthoek: het midden, de richting van de lange as (naar het
 water) en de halve maten, met de cabine die 1,2 m over het eind steekt erbij. Deze getallen komen uit `geeuwAssen`
 (midden −81,53/−478,94, hoek −0,749, 29,25 × 8,15 m); npm run geeuwbrugtest kijkt of ze nog kloppen.
*/
export const GEEUWBRUG = { cx: -81.53, cz: -478.94, hoek: -0.749, hx: 14.62 + 1.3, hz: 4.07 + 0.3, marge: 1.0 };

function inGedraaid(x, z, r) {
  const dx = x - r.cx, dz = z - r.cz, c = Math.cos(r.hoek), s = Math.sin(r.hoek);
  return Math.abs(dx * c + dz * s) < r.hx + r.marge && Math.abs(-dx * s + dz * c) < r.hz + r.marge;
}

export const GARAGE = {
  // het gebouw: de glazen gevel op x0 kijkt naar de Lemmerweg (west)
  x0: 770, x1: 788, z0: 120, z1: 146,
  // het voorterrein tussen de gevel en de sloot
  voor: { x0: 763, x1: 770, z0: 110.5, z1: 150 },
  // de inrit van de Lemmerweg naar het voorterrein, over de berm
  inrit: { x0: 749.5, x1: 763, z0: 110.5, z1: 116.2 },
};

/*
 En de shop van BP Slump Oil aan de Lemmerweg 63 (stap 160, js/bpwinkel.js): het pand uit de BAG (0091100000004556,
 type `bp_shop`), maar nu met een binnenkant waar je in loopt. js/kaartwereld.js slaat zijn geometrie én zijn botsdozen
 over (`BINNEN_PANDEN`); js/bpwinkel.js bouwt de gevels met een gat voor de schuifdeur. Het assenstelsel: `o` is de
 noordwesthoek van de voetafdruk, `u` langs de voorgevel (naar het oosten), `w` de diepte in (naar het zuiden). De
 voetafdruk is een L: het westdeel u 0–9,57 bij w 0–9,79, het oostdeel u 9,57–19,82 bij w −0,75–13,25 (gemeten uit
 KAART.panden, `npm run bptest` rekent het na).
*/
export const BP_WINKEL = {
  pand: '0091100000004556',
  o: [706.49, 145.95],
  u: [0.9958589, 0.0909126],
  west: { u0: 0, u1: 9.57, w0: 0, w1: 9.79 },
  oost: { u0: 9.57, u1: 19.82, w0: -0.75, w1: 13.25 },
};
export const BINNEN_PANDEN = new Set([BP_WINKEL.pand]);
/** Van wereld (x, z) naar (u, w) van de BP-shop. */
export function bpLokaal(x, z) {
  const B = BP_WINKEL, dx = x - B.o[0], dz = z - B.o[1];
  return [dx * B.u[0] + dz * B.u[1], -dx * B.u[1] + dz * B.u[0]];
}
/** Van (u, w) van de BP-shop naar wereld (x, z). */
export function bpWereld(u, w) {
  const B = BP_WINKEL;
  return [B.o[0] + u * B.u[0] - w * B.u[1], B.o[1] + u * B.u[1] + w * B.u[0]];
}
/** Ligt (x, z) in (of binnen `m` meter van) de BP-shop? */
export function inBpWinkel(x, z, m = 0) {
  const [u, w] = bpLokaal(x, z), { west: A, oost: O } = BP_WINKEL;
  return (u > A.u0 - m && u < A.u1 + m && w > A.w0 - m && w < A.w1 + m)
    || (u > O.u0 - m && u < O.u1 + m && w > O.w0 - m && w < O.w1 + m);
}

// hoeveel ruimte rond het gebouw vrij van bomen blijft (een kroon is ruim drie meter breed)
const MARGE = 3.5;

function inRechthoek(x, z, r, m = 0) {
  return x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
}

/** Ligt (x, z) op een bouwvlak? Daar groeit niets. */
export function inBouwvlak(x, z) {
  const G = GARAGE, L = LOODS;
  return inRechthoek(x, z, G, MARGE) || inRechthoek(x, z, G.voor, 0.5) || inRechthoek(x, z, G.inrit, 0.5)
    || inRechthoek(x, z, L, MARGE) || inRechthoek(x, z, L.erf, 1) || inRechthoek(x, z, L.oprit, 0.5) || inRechthoek(x, z, L.kade, 0.5)
    || Math.hypot(x - NOMERCY_SET.x, z - NOMERCY_SET.z) < NOMERCY_SET.r
    || Math.hypot(x - NOMERCY_KAMP.x, z - NOMERCY_KAMP.z) < NOMERCY_KAMP.r
    || inGedraaid(x, z, GEEUWBRUG)
    || inBpWinkel(x, z, 0.5);
}

/*
 Het riet in de sloot vóór de showroom is gemaaid. Het stond tussen de weg en het
 voorterrein, 1,1 tot 1,9 m hoog, en vanaf de Lemmerweg zag je de onderkant van
 de glazen gevel er niet meer door (de eerste foto, garage_buiten.png).
*/
export function gemaaid(x, z) {
  const G = GARAGE, K = LOODS.kade;
  if (x > G.inrit.x0 && x < G.voor.x1 && z > G.inrit.z0 - 1 && z < G.voor.z1 + 1) return true;
  // en langs de kade van de loods, waar de steiger het water in loopt en de boot ligt
  return x > K.x0 - 2 && x < K.x1 + 2 && z > K.z0 && z < K.z1 + 14;
}

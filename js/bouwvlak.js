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

export const GARAGE = {
  // het gebouw: de glazen gevel op x0 kijkt naar de Lemmerweg (west)
  x0: 770, x1: 788, z0: 120, z1: 146,
  // het voorterrein tussen de gevel en de sloot
  voor: { x0: 763, x1: 770, z0: 110.5, z1: 150 },
  // de inrit van de Lemmerweg naar het voorterrein, over de berm
  inrit: { x0: 749.5, x1: 763, z0: 110.5, z1: 116.2 },
};

// hoeveel ruimte rond het gebouw vrij van bomen blijft (een kroon is ruim drie meter breed)
const MARGE = 3.5;

function inRechthoek(x, z, r, m = 0) {
  return x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
}

/** Ligt (x, z) op een bouwvlak? Daar groeit niets. */
export function inBouwvlak(x, z) {
  const G = GARAGE, L = LOODS;
  return inRechthoek(x, z, G, MARGE) || inRechthoek(x, z, G.voor, 0.5) || inRechthoek(x, z, G.inrit, 0.5)
    || inRechthoek(x, z, L, MARGE) || inRechthoek(x, z, L.erf, 1) || inRechthoek(x, z, L.oprit, 0.5) || inRechthoek(x, z, L.kade, 0.5);
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

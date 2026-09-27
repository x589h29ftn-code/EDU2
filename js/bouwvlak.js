/*
 Bouwvlakken: plekken waar het spel zelf iets neerzet dat niet in de BGT of de
 3D BAG staat. Daar hoort geen boom, struik of pol gras dwars doorheen te groeien.

 Er is er één: Autohuis Lemmerweg (js/garage.js), op het grasveld aan de
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
  const G = GARAGE;
  return inRechthoek(x, z, G, MARGE) || inRechthoek(x, z, G.voor, 0.5) || inRechthoek(x, z, G.inrit, 0.5);
}

/*
 Het riet in de sloot vóór de showroom is gemaaid. Het stond tussen de weg en het
 voorterrein, 1,1 tot 1,9 m hoog, en vanaf de Lemmerweg zag je de onderkant van
 de glazen gevel er niet meer door (de eerste foto, garage_buiten.png).
*/
export function gemaaid(x, z) {
  const G = GARAGE;
  return x > G.inrit.x0 && x < G.voor.x1 && z > G.inrit.z0 - 1 && z < G.voor.z1 + 1;
}

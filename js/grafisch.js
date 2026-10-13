/*
 Grafische standen (stap 157, gevraagd: "Voeg idd grafische standen toe. Standaard hoe het nu is maar ook optie om te
 verhogen en verlagen"). `normaal` is precies het spel zoals het was; `laag` voor een zwakke pc, `hoog` voor een sterke.

   lod      de afstand waarop gebouwen, bomen en details hun fijne versie krijgen (maal `LOD.schaal` uit js/world.js)
   schaduw  de schaduwkaart van de zon (maal de standaard: 3072, op een aanraakscherm 1024)
   gras     het gras in 3D (js/groen.js `maakGrasVeld`)
   mensen   tot hoever voetgangers een lichaam hebben (`npcs.ZICHT`), en tot hoever een grof figuurtje (`ZICHT_GROF`;
            nooit voorbij 350 m: op 380 m begint js/npc.js de verste naar je buurt te verhuizen)

 Niets hiervan verandert het aantal lampen of de soort van een materiaal, dus er komt geen nieuw shaderprogramma bij
 (zie de valkuil van stap 83 in CLAUDE.md). De keuze staat in `localStorage` (`tinga.grafisch`).
*/
export const GRAFISCH = {
  laag: { naam: 'laag', lod: 0.7, schaduw: 0.5, gras: false, mensen: 140, grof: 260 },
  normaal: { naam: 'normaal', lod: 1, schaduw: 1, gras: true, mensen: 200, grof: 350 },
  hoog: { naam: 'hoog', lod: 1.45, schaduw: 4 / 3, gras: true, mensen: 260, grof: 350 },
};
export const GRAFISCH_RIJ = ['laag', 'normaal', 'hoog'];

export function grafischVoorkeur() {
  try { const v = localStorage.getItem('tinga.grafisch'); if (GRAFISCH[v]) return v; } catch { /* geen opslag */ }
  return 'normaal';
}
export function bewaarGrafisch(v) { try { localStorage.setItem('tinga.grafisch', v); } catch { /* alleen voor nu */ } }

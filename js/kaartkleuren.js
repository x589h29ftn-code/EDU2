// Eén kleur per klasse ondergrond. Gebruikt door de kaartplaat (tools/geo/plaat.mjs),
// door de platte controleweergave van het spel (?boven=1&plat=1) en door de
// minimap, zodat de vergelijking tussen brondata en spel pixel voor pixel
// dezelfde kleuren heeft.
export const KLEUR = {
  // ondergrond (klasse in kaart.js)
  rijbaan: '#8f8f8f', autoweg: '#6d6d6d', woonerf: '#9a9a9a', voetpad: '#d9d6d0', fietspad: '#c98a7a',
  parkeervlak: '#a6a6a6', inrit: '#bdb8b0', spoorbaan: '#888888',
  berm: '#b7d9a3', gras: '#a8d08d', bodembedekker: '#8fc47a', heesters: '#74ad62', bos: '#5e9a4f',
  erf: '#e9e2d3', verharding: '#c9c4bb', asfaltvlak: '#b9b9b9', zand: '#eadfb8', halfverhard: '#cdc3a9',
  water: '#7fb2e5', oever: '#b5d4ef', brug: '#9c8f7f', steiger: '#a08a6a',
  // bebouwing en groen
  pand: '#8e3b28', pandSchatting: '#b5533c', bouwwerk: '#a07f6a', haag: '#3f7f3a',
  // achtergrond buiten de vlakken
  achtergrond: '#f3f0ea',
};

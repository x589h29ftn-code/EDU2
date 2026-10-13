/*
 De moeilijkheidsgraad (stap 157, gevraagd: "Moeilijkheidsgraad ook goed, normaal hoe het nu is, dan easy en hard").

   schade   hoeveel van elke treffer op je leven aankomt (van wie dan ook: de politie, de bewaking, de bendes, de heli,
            een knal); `normaal` is precies het oude spel
   raak     hoe vaak een agent raak schiet (maal `raakKans` in js/politieslim.js)
   koel     hoe snel de politie je kwijtraakt als ze je niet meer zien (maal `KOEL` in js/politie.js)

 Hoe: `player.health` wordt een eigenschap met een zetter. Een daling is een treffer en wordt met `schade` geschaald;
 een stijging (bier, een EHBO-doos, een nieuwe missie) gaat zoals hij gaat. Zo telt elke plek die `player.health -=`
 doet mee zonder dat die hiervan weet (zoals js/gezondheid.js het geraakt-zijn ook uit het leven zelf leest). Het
 laden van een opslag zet het leven zonder schaling (`zetLevenRuw`). De keuze staat in `localStorage` (`tinga.moeilijk`).
*/
export const MOEILIJK = {
  makkelijk: { naam: 'makkelijk', schade: 0.6, raak: 0.7, koel: 1.6 },
  normaal: { naam: 'normaal', schade: 1, raak: 1, koel: 1 },
  moeilijk: { naam: 'moeilijk', schade: 1.4, raak: 1.3, koel: 0.7 },
};
export const MOEILIJK_RIJ = ['makkelijk', 'normaal', 'moeilijk'];

let stand = 'normaal';
try { const v = localStorage.getItem('tinga.moeilijk'); if (MOEILIJK[v]) stand = v; } catch { /* geen opslag */ }

export const moeilijk = {
  get stand() { return stand; },
  get waarden() { return MOEILIJK[stand]; },
  zet(v) {
    if (!MOEILIJK[v]) return;
    stand = v;
    try { localStorage.setItem('tinga.moeilijk', v); } catch { /* alleen voor nu */ }
  },
  volgende() { this.zet(MOEILIJK_RIJ[(MOEILIJK_RIJ.indexOf(stand) + 1) % MOEILIJK_RIJ.length]); },
};

// het leven van de speler met de schaling erin; `zetLevenRuw` zet het zoals het is (het laden)
export function koppelLeven(player) {
  let leven = typeof player.health === 'number' ? player.health : 100;
  Object.defineProperty(player, 'health', {
    configurable: true, enumerable: true,
    get() { return leven; },
    set(v) {
      if (typeof v === 'number' && isFinite(v) && v < leven && leven > 0) {
        const f = MOEILIJK[stand].schade;
        v = leven - (leven - v) * f;
        // een treffer die op normaal net niet dodelijk was, blijft dat ook (afronden naar een heel getal)
        v = Math.round(v * 100) / 100;
      }
      leven = v;
    },
  });
  player.zetLevenRuw = (v) => { leven = v; };
}

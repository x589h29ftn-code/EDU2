/*
 Eenmalige uitleg, op het moment dat je iets voor het eerst kúnt doen.

 De besturing stond alleen in het menu onder "Besturing", en dat leest niemand
 voordat hij begint. Dit laat het zien wanneer het aan de beurt is (verzoek
 20 sep 2026):

   - je krijgt je wapen bij het gezelschap aan de Molenkrite → hoe je hem pakt,
     schiet, richt en herlaadt;
   - je stapt voor het eerst in de auto van de missie → de radio en de camera.

 Eenmalig betekent hier: één keer per spel. Bij een nieuw spel begint het
 opnieuw, want dan zit er misschien iemand anders achter het toetsenbord — dit
 is een spel dat van hand tot hand gaat. Het staat dus niet in localStorage.

 Het blokje verdwijnt vanzelf na een aantal tellen, of eerder als je op Enter of
 de spatiebalk drukt. Het onderbreekt niets: je kunt gewoon doorspelen terwijl
 het in beeld staat.
*/

let el = null, kopEl = null, regelEl = null;
let klok = 0;                 // tellen tot het blokje weer weggaat
const gehad = new Set();      // welke uitleg al geweest is

function pak() {
  if (el) return el;
  el = document.getElementById('uitleg');
  if (!el) return null;
  kopEl = el.querySelector('.kop');
  regelEl = el.querySelector('.regel');
  /*
   Enter of spatie haalt hem weg. Dat is dezelfde toets waarmee je het
   laadscherm doorklikt, dus het voelt als "ja, gelezen".
  */
  window.addEventListener('keydown', (e) => {
    if (klok <= 0) return;
    if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') verberg();
  });
  return el;
}

function verberg() {
  klok = 0;
  if (el) el.classList.remove('zichtbaar');
}

/*
 Uitleg tonen. `sleutel` zorgt dat het maar één keer gebeurt; `regels` is een
 stukje HTML met <kbd> erin voor de toetsen.
*/
export function toon(sleutel, kop, regels, tellen = 9) {
  if (gehad.has(sleutel)) return false;
  if (!pak()) return false;
  gehad.add(sleutel);
  kopEl.textContent = kop;
  regelEl.innerHTML = regels;
  el.classList.add('zichtbaar');
  klok = tellen;
  return true;
}

// Loopt mee met de hoofdlus, zodat het blokje bij een pauze ook stilstaat.
export function update(dt) {
  if (klok <= 0) return;
  klok -= dt;
  if (klok <= 0) verberg();
}

// Bij een nieuw spel begint de uitleg weer van voren af aan.
export function reset() {
  gehad.clear();
  verberg();
}

// voor de proeven: is deze uitleg al geweest, en staat er nu iets in beeld?
export function gehadHebben() { return [...gehad]; }
export function inBeeld() { return klok > 0; }

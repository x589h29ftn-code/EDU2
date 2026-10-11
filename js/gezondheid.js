/*
 Levens zoals in GTA (stap 138, verzoek 11 okt 2026).

 "De eerste 50 % health langzaam terug als je buiten combat blijft, dus niet geraakt
 wordt. De 50 % daarboven met levens: kopen, kibbeling eten en zo. De healthpacks van
 Tinga State zet je later in met een knop, en je neemt er hoogstens vijf mee."

 Hoe het werkt:

 - **Vanzelf tot de helft.** Wie `LEVEN.wacht` tellen niet geraakt is, krijgt er
   `LEVEN.tempo` punten per seconde bij, tot `LEVEN.vanzelfTot` (50). Daarboven komt er
   vanzelf nooit iets bij. Geraakt worden zet de wachttijd opnieuw.
 - **Geraakt** lees ik niet uit al die plekken die `player.health -=` doen (de bewaking,
   de politie, de bendes, de heli, de knal …), maar uit het leven zelf: is het sinds het
   vorige beeld gezakt, dan ben je geraakt. Zo telt elke bron van schade mee, ook een
   nieuwe, zonder dat die hier iets van hoeft te weten. Omhoog (bier, een proef die elk
   beeld `health = 100` zet, een nieuwe missie) is geen treffer.
 - **Boven de helft** alleen met eten en drinken (bier, de barbecue, kibbeling, het bier
   bij VV Sneek) en met de EHBO-dozen: die gaan gewoon door tot 100.
 - **EHBO-dozen** koop je bij Tinga State (js/boerderij.js, het schap), je draagt er
   hoogstens `LEVEN.maxPacks`, en L zet er één in: `LEVEN.packLeven` punten, tot 100.
   Niet bij vol leven, niet zonder dozen, niet als je neer bent. `player.packs` gaat mee
   in de opslag (js/opslag.js).

 De hoofdlus roept `update(dt)` elk beeld aan (js/main.js); een proef doet dat zelf,
 want headless loopt die lus nauwelijks.
*/

export const LEVEN = {
  max: 100,
  vanzelfTot: 50,     // tot hier komt je leven vanzelf terug
  wacht: 5,           // zoveel tellen niet geraakt voor het herstel begint
  tempo: 2,           // punten per seconde
  maxPacks: 5,        // EHBO-dozen die je mee kunt nemen
  packLeven: 40,      // punten per doos
  packPrijs: 100,     // bij Tinga State
};

export function initGezondheid({ player, hud, geluid = null }) {
  if (typeof player.packs !== 'number') player.packs = 0;
  let vorig = player.health;
  let rust = 0;                        // tellen sinds de laatste treffer

  let packsInBeeld = -1;
  function update(dt) {
    // de dozen in beeld bijhouden, ook als het laden of een proef `player.packs` zelf zet
    if (player.packs !== packsInBeeld) {
      packsInBeeld = player.packs;
      if (hud && hud.zetPacks) hud.zetPacks(player.packs);
    }
    if (!(dt > 0)) return;
    const h = player.health;
    if (typeof h !== 'number' || !isFinite(h)) { vorig = h; return; }
    if (h < vorig - 1e-6) rust = 0; else rust += dt;
    if (h > 0 && h < LEVEN.vanzelfTot && rust >= LEVEN.wacht) {
      player.health = Math.min(LEVEN.vanzelfTot, h + LEVEN.tempo * dt);
      if (hud && hud.zetLeven) hud.zetLeven(player.health);
    }
    vorig = player.health;
  }

  // een doos erbij (het schap): 'ok' of 'vol'
  function koopPack() {
    if ((player.packs || 0) >= LEVEN.maxPacks) return 'vol';
    player.packs = (player.packs || 0) + 1;
    if (hud && hud.zetPacks) hud.zetPacks(player.packs);
    return 'ok';
  }

  /*
   L: een doos inzetten. Geeft 'ok', 'geen' (geen dozen), 'vol' (leven al vol) of
   'neer' (leven op nul, of het spel draait niet).
  */
  function gebruikPack() {
    if (!(player.health > 0)) return 'neer';
    if (!(player.packs > 0)) {
      if (hud && hud.show) hud.show('Geen EHBO-doos bij je — Tinga State verkoopt ze', 2.5);
      return 'geen';
    }
    if (player.health >= LEVEN.max) {
      if (hud && hud.show) hud.show('Je bent er prima aan toe', 2);
      return 'vol';
    }
    const voor = player.health;
    player.health = Math.min(LEVEN.max, player.health + LEVEN.packLeven);
    player.packs -= 1;
    vorig = player.health;
    if (hud) {
      if (hud.zetLeven) hud.zetLeven(player.health);
      if (hud.zetPacks) hud.zetPacks(player.packs);
      if (hud.levenPuls) hud.levenPuls();
      if (hud.show) hud.show(`EHBO-doos: +${Math.round(player.health - voor)} leven · nog ${player.packs}`, 2.5);
    }
    if (geluid && geluid.verband) geluid.verband();
    return 'ok';
  }

  // na het laden: de balk en de dozen in beeld, en geen "treffer" door een lager opgeslagen leven
  function naLaden() {
    if (typeof player.packs !== 'number' || !isFinite(player.packs)) player.packs = 0;
    player.packs = Math.max(0, Math.min(LEVEN.maxPacks, Math.round(player.packs)));
    vorig = player.health;
    if (hud && hud.zetPacks) hud.zetPacks(player.packs);
  }

  if (hud && hud.zetPacks) hud.zetPacks(player.packs);

  return {
    update, koopPack, gebruikPack, naLaden,
    get rust() { return rust; },
    zetRust(t) { rust = t; },
  };
}

/*
 Stap 169: de kassa van de BP-shop (js/bpwinkel.js). Gevraagd: "blikje energy drank kopen bij BP voor 10 health en
 een 5% boost in rennen. Max 20% boost als je doordrinkt. Ook kraslot kopen en dat kost 25 euro, kan tussen 0 en 150
 opleveren, random kans."

 Aan de balie, aan de kant van de klant: E opent de kassa, met 1 of 2 kies je (op een aanraakscherm zijn dat knoppen,
 `keuzes`), E nog een keer of weglopen sluit hem.

   1. **Energydrank** (`BP_KASSA.drank`): +10 leven tot 100, en 5 % sneller rennen per blikje, tot 20 % na vier blikjes.
      De boost houdt `duur` tellen na het laatste blikje en zakt dan in `zak` tellen weg (`player.renBoost`, js/player.js).
      Bij vol leven drink je hem toch: het gaat dan om de boost.
   2. **Kraslot** (`BP_KASSA.lot`): € 25, en dan een prijs uit `prijzen` (van niets tot € 150) met de kans erbij.

 De kans hangt aan `rng` (standaard `Math.random`), zodat een proef hem vast kan zetten.
*/
import { BP_WINKEL, bpLokaal } from './bouwvlak.js';

export const BP_KASSA = {
  drank: { prijs: 3, leven: 10, boost: 0.05, maxBoost: 0.20, duur: 90, zak: 15 },
  lot: {
    prijs: 25,
    // [bedrag, kans]: samen 1; gemiddeld € 14,50 terug, dus de BP verdient eraan
    prijzen: [[0, 0.55], [10, 0.20], [25, 0.12], [50, 0.08], [100, 0.04], [150, 0.01]],
  },
  // waar de klant staat, in het assenstelsel van de shop (u langs de voorgevel, w naar achteren; de balie op w 5,9–6,6)
  vak: { u0: 3.0, u1: 7.6, w0: 4.2, w1: 5.95 },
  max: 100,
};

const euro = (n) => `€ ${n.toLocaleString('nl-NL')}`;

export function initBpKassa({ player, hud, geld = () => 0, betaal = () => false, verdien = () => 0, rng = Math.random }) {
  let open = false, boostT = 0, drankjes = 0, loten = 0, gewonnen = 0;
  const K = BP_KASSA;
  if (player.renBoost == null) player.renBoost = 0;

  function bijBalie() {
    if (!player || player.inCar || player.inDrone || player.zit) return false;
    if (player.health != null && player.health <= 0) return false;
    const [u, w] = bpLokaal(player.pos.x, player.pos.z);
    return u >= K.vak.u0 && u <= K.vak.u1 && w >= K.vak.w0 && w <= K.vak.w1;
  }
  const keuzeTekst = () => [
    `energydrank (${euro(K.drank.prijs)}, +${K.drank.leven} leven, sneller rennen)`,
    `kraslot (${euro(K.lot.prijs)})`,
  ];
  function toonMenu() {
    if (hud) hud.melding('BP · KASSA', `1 — ${keuzeTekst()[0]} · 2 — ${keuzeTekst()[1]} · E — klaar`, 12);
  }
  function sluit() { if (!open) return; open = false; if (hud) hud.melding('BP', '"Fijne dag nog!"', 2); }

  function drink() {
    const d = K.drank;
    if (!betaal(d.prijs)) { if (hud) hud.melding('Te weinig geld', `Een blikje kost ${euro(d.prijs)}. Je hebt ${euro(geld())}.`, 3); return false; }
    player.health = Math.min(K.max, (player.health ?? K.max) + d.leven);
    if (hud && hud.zetLeven) hud.zetLeven(player.health);
    player.renBoost = Math.min(d.maxBoost, (player.renBoost || 0) + d.boost);
    boostT = d.duur;
    drankjes++;
    const pct = Math.round(player.renBoost * 100);
    if (hud) hud.melding(`Energydrank! +${d.leven} leven`, pct >= d.maxBoost * 100
      ? `Je rent ${pct} % sneller — meer gaat er niet in.` : `Je rent ${pct} % sneller (tot ${Math.round(d.maxBoost * 100)} % als je doordrinkt).`, 4);
    return true;
  }
  // een prijs uit de lijst, met de kans erbij
  function trek() {
    let x = rng(), acc = 0;
    for (const [bedrag, kans] of K.lot.prijzen) { acc += kans; if (x < acc) return bedrag; }
    return K.lot.prijzen[K.lot.prijzen.length - 1][0];
  }
  function kras() {
    if (!betaal(K.lot.prijs)) { if (hud) hud.melding('Te weinig geld', `Een kraslot kost ${euro(K.lot.prijs)}. Je hebt ${euro(geld())}.`, 3); return null; }
    const prijs = trek();
    loten++;
    if (prijs > 0) { verdien(prijs); gewonnen += prijs; }
    if (hud) hud.melding(prijs > 0 ? `Kraslot: ${euro(prijs)}!` : 'Kraslot: helaas', prijs >= 100 ? 'De medewerker kijkt even op. "Gefeliciteerd!"'
      : prijs > 0 ? `${euro(prijs)} uitbetaald aan de kassa.` : '"Volgende keer beter."', 4);
    return prijs;
  }

  return {
    get open() { return open; },
    // de knoppen voor een aanraakscherm (js/main.js `werkKeuzeKnoppenBij`)
    get keuzes() { return open ? keuzeTekst() : null; },
    get stand() { return { drankjes, loten, gewonnen, boost: player.renBoost || 0, boostT }; },
    bijBalie,
    // E: de kassa open of dicht; true als de toets gebruikt is
    toets() {
      if (!player.active && !window.__autoplay) return false;
      if (open) { sluit(); return true; }
      if (!bijBalie()) return false;
      open = true; toonMenu();
      return true;
    },
    // 1 of 2 terwijl de kassa open is
    kies(n) {
      if (!open) return false;
      if (n === 1) drink();
      else if (n === 2) kras();
      else return false;
      if (open) toonMenu();
      return true;
    },
    hint() { return !open && bijBalie() ? 'E — afrekenen aan de kassa (energydrank, kraslot)' : null; },
    // elk beeld: de boost laten verlopen, en de kassa dicht als je wegloopt
    update(dt) {
      if (open && !bijBalie()) sluit();
      if (boostT > 0) boostT = Math.max(0, boostT - dt);
      else if (player.renBoost > 0) player.renBoost = Math.max(0, player.renBoost - dt * K.drank.maxBoost / K.drank.zak);
    },
    // laden, neergaan: geen boost meer
    reset() { open = false; boostT = 0; player.renBoost = 0; },
    trek, BP_WINKEL,
  };
}

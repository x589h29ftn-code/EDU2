/*
 Het nieuws op Radio Tinga (stap 112). Gevraagd op 3 okt 2026: "Radio Tinga die schietpartij e.d.
 doorgeeft, goed idee."

 js/main.js meldt wat er gebeurt (`meld(soort, x, z, extra)`): een schietpartij, een aanrijding,
 een knal, een achtervolging met drie sterren of meer, een ambulance die uitrukt, de uitslag of het
 staken van de wedstrijd bij VV Sneek. Elke melding wacht NIEUWS.vertraag seconden (zo snel is
 geen redactie) en blijft NIEUWS.houdbaar seconden staan. Luister je in die tijd naar Radio Tinga
 (in de auto op die zender, of thuis met de radio aan), dan komt hij: een jingle, de muziek even
 zachter (`demp`), en de tekst in beeld met de straat erin. Per soort hooguit eens per
 NIEUWS.zelfde seconden, en tussen twee berichten minstens NIEUWS.tussen.
*/
export const NIEUWS = {
  vertraag: 12,        // s voordat een melding op de radio kan
  houdbaar: 300,       // s daarna is het geen nieuws meer
  zelfde: 150,         // s tussen twee meldingen van dezelfde soort
  tussen: 25,          // s tussen twee berichten
  duur: 7,             // s dat een bericht in beeld staat (en de muziek zachter is)
};

const TEKSTEN = {
  schietpartij: [
    (s) => `Er zijn schoten gelost ${s}. De politie vraagt mensen in de buurt binnen te blijven.`,
    (s) => `Schietpartij ${s}: er is iemand geraakt. De dader is nog voortvluchtig.`,
  ],
  aanrijding: [
    (s) => `Een voetganger is aangereden ${s}. De bestuurder is doorgereden.`,
    (s) => `Aanrijding ${s}. Getuigen spreken van een auto die veel te hard reed.`,
  ],
  explosie: [
    (s) => `Een harde knal ${s}. Er is veel schade; de brandweer is ter plaatse.`,
    (s) => `Explosie ${s}. Bewoners werden opgeschrikt door een vuurbal.`,
  ],
  achtervolging: [
    (s) => `Een wilde achtervolging ${s}. De politie is met meerdere wagens op de been.`,
    (s) => `Verkeer opgelet: een politieachtervolging ${s}. Blijf uit de buurt.`,
  ],
  ambulance: [
    (s) => `Een ambulance is met spoed naar ${s.replace(/^aan |^op |^bij /, '')} gereden.`,
  ],
  uitslag: [
    (s, e) => `Sport: VV Sneek Wit Zwart speelde vanmiddag op eigen veld ${e.thuis}–${e.uit}.`,
  ],
  gestaakt: [
    () => `Sport: de wedstrijd van VV Sneek Wit Zwart is gestaakt na een incident op het veld.`,
  ],
};

export function maakNieuws({ hud, geluid, straatVan = () => null } = {}) {
  const rij = [];              // { soort, x, z, extra, t }
  const laatst = {};           // soort → tijd van de laatste melding
  let klok = 0, tussenT = 0, bezigT = 0;
  let laatsteBericht = null;
  const gehoord = [];

  function plaats(x, z) {
    const naam = x == null ? null : straatVan(x, z);
    return naam ? `aan de ${naam}` : 'in Tinga';
  }

  return {
    get rij() { return rij.slice(); },
    get gehoord() { return gehoord.slice(); },
    get laatsteBericht() { return laatsteBericht; },
    // zolang er een bericht loopt, gaat de muziek zachter (js/main.js vermenigvuldigt hiermee)
    get demp() { return bezigT > 0 ? 0.3 : 1; },
    meld(soort, x = null, z = null, extra = {}) {
      if (!TEKSTEN[soort]) return false;
      if (laatst[soort] != null && klok - laatst[soort] < NIEUWS.zelfde) return false;
      laatst[soort] = klok;
      rij.push({ soort, x, z, extra, t: klok });
      return true;
    },
    /*
     Eén beeld. `luistert`: de speler hoort Radio Tinga (in de auto op die zender, of thuis).
    */
    update(dt, luistert) {
      klok += dt;
      if (bezigT > 0) bezigT -= dt;
      if (tussenT > 0) tussenT -= dt;
      // te oud is geen nieuws meer
      while (rij.length && klok - rij[0].t > NIEUWS.houdbaar) rij.shift();
      if (!luistert || tussenT > 0 || !rij.length) return null;
      const i = rij.findIndex(m => klok - m.t >= NIEUWS.vertraag);
      if (i < 0) return null;
      const m = rij.splice(i, 1)[0];
      const keus = TEKSTEN[m.soort];
      const tekst = keus[Math.floor(Math.random() * keus.length)](plaats(m.x, m.z), m.extra || {});
      laatsteBericht = { soort: m.soort, tekst, t: klok };
      gehoord.push(laatsteBericht);
      if (geluid && geluid.nieuwsJingle) geluid.nieuwsJingle();
      if (hud && hud.show) hud.show(`Radio Tinga — ${tekst}`, NIEUWS.duur);
      bezigT = NIEUWS.duur; tussenT = NIEUWS.tussen;
      return laatsteBericht;
    },
  };
}

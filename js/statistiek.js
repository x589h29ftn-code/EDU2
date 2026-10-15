/*
 Statistieken (stap 195, gevraagd: "een statistiekenscherm in het pauzemenu: gespeelde tijd, gereden kilometers, neergeschoten
 mensen, verdiend geld, hoogste aantal sterren, voltooide missies en bijmissies; en deze ook in het eindscherm laten zien").

 Eén teller voor het hele spel, bewaard in de opslag (js/opslag.js `statistiek`) en bij een nieuw spel weer op nul.
  - Wat met de tijd meeloopt telt `werkBij` elk beeld uit de stand van het spel: speeltijd (alleen als je speelt, niet in het
    menu), afstand te voet, met de auto en met de boot (het verschil in plek per beeld; een sprong van meer dan 25 m is laden of
    een overgang en telt niet), geld verdiend en uitgegeven (het verschil in `verhaal.geld`), klusjes (`klusjes.gedaan`), de
    hoogste sterren, en hoe vaak je neerging (het leven van boven nul naar nul).
  - Wat een gebeurtenis is, telt js/main.js met `tel`: schoten, mensen en agenten neergeschoten, auto's opgeblazen.
 `regels(voortgang)` zet het om in [label, waarde] voor het menu en de titelrol; de missies en bijmissies komen uit js/verhaal.js.
*/
export const STAT = { sprong: 25 };

const leeg = () => ({
  tijd: 0, voet: 0, auto: 0, boot: 0, schoten: 0, mensen: 0, agenten: 0, autos: 0,
  verdiend: 0, uitgegeven: 0, klusjes: 0, sterren: 0, neer: 0,
});

let s = leeg();
// (stap 196) de Tinga Cache: hoeveel caches gevonden (js/geocache.js zet hem)
let cacheTeller = null;
// wat het vorige beeld zag (niet bewaard)
let vorig = null;

const getal = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

export const statistiek = {
  get stand() { return { ...s }; },
  tel(naam, n = 1) { if (naam in s) s[naam] += n; },
  nieuw() { s = leeg(); vorig = null; },
  zetCaches(f) { cacheTeller = f; },
  bewaar() { return { ...s }; },
  herstel(d) { s = leeg(); if (d && typeof d === 'object') for (const k of Object.keys(s)) s[k] = getal(d[k]); vorig = null; },
  // na laden of een sprong: het volgende beeld begint opnieuw (geen afstand, geen geld)
  opnieuw() { vorig = null; },
  /**
   * @param {number} dt
   * @param {{ speelt: boolean, x: number, z: number, auto: boolean, boot: boolean, geld: number, klusjes: number,
   *           sterren: number, leven: number }} nu
   */
  werkBij(dt, nu) {
    if (nu.speelt) s.tijd += dt;
    if (vorig) {
      const d = Math.hypot(nu.x - vorig.x, nu.z - vorig.z);
      if (nu.speelt && d < STAT.sprong) {
        if (nu.boot) s.boot += d; else if (nu.auto) s.auto += d; else s.voet += d;
      }
      const dg = getal(nu.geld) - getal(vorig.geld);
      if (dg > 0) s.verdiend += dg; else if (dg < 0) s.uitgegeven -= dg;
      const dk = getal(nu.klusjes) - getal(vorig.klusjes);
      if (dk > 0) s.klusjes += dk;
      if (vorig.leven > 0 && nu.leven <= 0) s.neer++;
    }
    s.sterren = Math.max(s.sterren, getal(nu.sterren));
    vorig = { x: nu.x, z: nu.z, geld: nu.geld, klusjes: nu.klusjes, leven: nu.leven };
  },
  /**
   * @param {{ missies: number, bijmissies: number, bijTotaal: number }} [voortgang]
   * @returns {Array<[string, string]>}
   */
  regels(voortgang = null) {
    const km = (m) => `${(m / 1000).toLocaleString('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
    const euro = (n) => `€ ${Math.round(n).toLocaleString('nl-NL')}`;
    const u = Math.floor(s.tijd / 3600), m = Math.floor((s.tijd % 3600) / 60);
    const uit = [
      ['Gespeeld', u ? `${u} u ${String(m).padStart(2, '0')} min` : `${m} min`],
    ];
    if (voortgang) {
      uit.push(['Missies', `${voortgang.missies} van 18`]);
      uit.push(['Bijmissies', `${voortgang.bijmissies} van ${voortgang.bijTotaal}`]);
    }
    if (cacheTeller) { const c = cacheTeller(); if (c) uit.push(['Tinga Cache', `${c.gevonden} van ${c.totaal}`]); }
    uit.push(
      ['Klusjes', String(s.klusjes)],
      ['Gereden', km(s.auto)],
      ['Gelopen', km(s.voet)],
      ['Gevaren', km(s.boot)],
      ['Verdiend', euro(s.verdiend)],
      ['Uitgegeven', euro(s.uitgegeven)],
      ['Schoten', String(s.schoten)],
      ['Neergeschoten', String(s.mensen)],
      ['Agenten neergeschoten', String(s.agenten)],
      ['Auto\'s opgeblazen', String(s.autos)],
      ['Hoogste sterren', s.sterren ? '★'.repeat(Math.min(5, s.sterren)) : 'geen'],
      ['Neergegaan', String(s.neer)],
    );
    return uit;
  },
};

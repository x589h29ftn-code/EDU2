/*
 Het nieuws op Radio Tinga (stap 112). Gevraagd op 3 okt 2026: "Radio Tinga die schietpartij e.d.
 doorgeeft, goed idee."

 js/main.js meldt wat er gebeurt (`meld(soort, x, z, extra)`): een schietpartij, een aanrijding,
 een knal, een achtervolging met drie sterren of meer, een ambulance die uitrukt, de uitslag of het
 staken van de wedstrijd bij VV Sneek; sinds stap 131 ook een missie (`{ titel }`), de politie
 afgeschud (`{ sterren }`), een gewonnen race (`{ inleg }`) en een brand. Elke melding wacht NIEUWS.vertraag seconden (zo snel is
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
  // (Tinga Nieuws, stap 131: ook op de radio)
  missie: [
    (s, e) => `In Tinga gaat het verhaal rond over ${e.titel ? `"${e.titel}"` : 'een geheimzinnige klus'}. De politie zegt niets te weten.`,
  ],
  afgeschud: [
    (s) => `De politie is een vluchtende verdachte ${s} uit het oog verloren. De zoektocht is gestaakt.`,
  ],
  race: [
    () => `Buurtbewoners klagen over een illegale straatrace vannacht. De winnaar is spoorloos.`,
  ],
  brand: [
    (s) => `Brand ${s}. De brandweer heeft het vuur onder controle.`,
  ],  dj: [
    () => `Op Radio Tinga draaide vandaag een gastdj. Sjors: "Hij mag terugkomen."`,
  ],
};

/*
 ---------- Tinga Nieuws op de tv (stap 131) ----------
 Gevraagd op 10 okt 2026: "Tv zender Tinga nieuws goed idee". Thuis op de tv
 (js/interieur.js) staan korte koppen over wat jij in het spel hebt gedaan. Daarvoor
 onthoudt deze module de laatste TV.geheugen gebeurtenissen, los van de rij van de
 radio: die raakt een melding kwijt zodra hij voorgelezen is, en de tv wil hem juist
 blijven tonen. Het geheugen staat op moduleniveau, zodat js/interieur.js het kan
 lezen zonder dat js/main.js er iets aan hoeft door te geven (`kopteksten()`).

 Per soort en straat hooguit eens per TV.zelfde seconden: twintig treffers in één
 vuurgevecht zijn één kop. Komt dezelfde soort later terug in dezelfde straat, dan
 wordt het "Opnieuw …".
*/
export const TV = {
  geheugen: 8,         // zoveel gebeurtenissen onthoudt de redactie
  zelfde: 40,          // s tussen twee koppen van dezelfde soort in dezelfde straat
  koppen: 6,           // zoveel regels levert kopteksten() standaard
};

const geheugen = [];   // { soort, straat, uur, t, extra, keus, opnieuw }, nieuwste achteraan
let versie = 0;        // telt op bij elke nieuwe gebeurtenis (de tv springt dan naar het nieuwste)
const nu = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
/*
 Het uur in het spel, voor "om 14:30" bij een kop en het klokje op de tv. js/main.js
 kan het met `zetKlok(() => sfeer.uur)` zetten; zolang dat niet gebeurd is, kijkt
 hij naar de sfeer in `window.__game`, en anders staat er geen uur bij.
*/
let klokVan = () => {
  try {
    const s = globalThis.__game && globalThis.__game.sfeer;
    return s && typeof s.uur === 'number' ? s.uur : null;
  } catch (e) { return null; }
};
export function zetKlok(f) { if (typeof f === 'function') klokVan = f; }
export function speluur() {
  const u = klokVan();
  return typeof u === 'number' && isFinite(u) ? ((u % 24) + 24) % 24 : null;
}
export function uurTekst(u = speluur()) {
  if (u == null) return null;
  const m = Math.floor(u * 60) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/*
 Een gebeurtenis in het geheugen zetten. `straat` is de naam uit `nearestRoadName`
 (of null); `extra` zoals bij `meld`. Geeft true als hij erin kwam.
*/
export function onthoud(soort, straat = null, extra = {}) {
  if (!KOPPEN[soort]) return false;
  const t = nu();
  const eerder = geheugen.filter(g => g.soort === soort && g.straat === straat);
  if (eerder.length && t - eerder[eerder.length - 1].t < TV.zelfde) return false;
  geheugen.push({ soort, straat, extra: extra || {}, t, uur: speluur(),
    keus: Math.floor(Math.random() * KOPPEN[soort].lijst.length), opnieuw: eerder.length > 0 && !!straat });
  while (geheugen.length > TV.geheugen) geheugen.shift();
  versie++;
  return true;
}
export function nieuwsGeheugen() { return geheugen.map(g => ({ ...g })); }
export function nieuwsVersie() { return versie; }
// (voor proeven en een nieuw spel)
export function wisGeheugen() { geheugen.length = 0; versie++; }

// "aan de Molenkrite", "op de Lemmerweg"; een naam met een lidwoord ("de Wieken") houdt het zijne
function lid(straat) { return /^(de|het|'t) /i.test(straat) ? straat : `de ${straat}`; }
const aan = (s) => s ? `aan ${lid(s)}` : 'in Tinga';
const op = (s) => s ? `op ${lid(s)}` : 'in Tinga';
const naar = (s) => s ? lid(s) : 'Tinga';

/*
 De koppen per soort: kort, zoals onderin een nieuwsuitzending. Elke kop krijgt de
 straat (s) en het extraatje (e); `opnieuw` is de kop voor een herhaling.
*/
const KOPPEN = {
  schietpartij: {
    lijst: [
      (s) => `Schietpartij ${aan(s)}: politie zoekt getuigen`,
      (s) => `Schoten gelost ${aan(s)}, buurt geschrokken`,
      (s) => `Kogelinslagen ${aan(s)}: "Het leek wel oorlog"`,
    ],
    opnieuw: (s) => `Opnieuw schoten ${aan(s)}`,
  },
  aanrijding: {
    lijst: [
      (s) => `Voetganger aangereden ${aan(s)}, bestuurder doorgereden`,
      (s) => `Aanrijding ${aan(s)}: getuigen zien auto met hoge snelheid`,
    ],
    opnieuw: (s) => `Weer een aanrijding ${aan(s)}: buurt wil drempels`,
  },
  explosie: {
    lijst: [
      (s) => `Harde knal ${aan(s)}: auto volledig verwoest`,
      (s) => `Explosie ${aan(s)} schrikt bewoners op`,
    ],
    opnieuw: (s) => `Alweer een explosie ${aan(s)}`,
  },
  brand: {
    lijst: [
      (s) => `Brand ${aan(s)}: brandweer rukt groot uit`,
      (s) => `Rookwolk boven Tinga na brand ${aan(s)}`,
    ],
    opnieuw: (s) => `Opnieuw brand ${aan(s)}: politie vermoedt opzet`,
  },
  achtervolging: {
    lijst: [
      (s) => `Achtervolging ${op(s)}: politie met meerdere wagens`,
      (s) => `Wilde achtervolging door Tinga, verkeer ${op(s)} stilgelegd`,
    ],
    opnieuw: (s) => `Opnieuw achtervolging ${op(s)}`,
  },
  afgeschud: {
    lijst: [
      (s, e) => `Verdachte ontkomt ${e.sterren >= 3 ? 'na grote klopjacht ' : ''}${aan(s)}`,
      (s) => `Politie raakt vluchtauto kwijt ${aan(s)}: zoektocht gestaakt`,
    ],
    opnieuw: (s) => `Weer ontsnapt ${aan(s)}: "Hij is ons steeds een stap voor"`,
  },
  ambulance: {
    lijst: [
      (s) => `Ambulance met spoed naar ${naar(s)}`,
      (s) => `Hulpdiensten ${aan(s)}: slachtoffer naar het ziekenhuis`,
    ],
    opnieuw: (s) => `Opnieuw ambulance ${aan(s)}`,
  },
  race: {
    lijst: [
      (s, e) => `Illegale straatrace naar IJlst${e.inleg ? `: om € ${e.inleg} gereden` : ''}, winnaar spoorloos`,
      () => `Nachtelijke race over de Lemmerweg: buurt klaagt over lawaai`,
    ],
  },
  dj: {
    lijst: [() => 'Gastdj achter de knoppen bij Radio Tinga: luisteraars bellen massaal'],
  },
  missie: {
    lijst: [
      (s, e) => e.titel ? `Gerucht in de wijk: "${e.titel}"` : 'Gerucht in de wijk: er is weer iets gebeurd',
      (s, e) => e.titel ? `Politie tast in het duister na "${e.titel}"` : 'Politie tast in het duister',
    ],
  },
  uitslag: {
    lijst: [(s, e) => `Sport: VV Sneek Wit Zwart speelt ${e.thuis ?? '?'}–${e.uit ?? '?'} op eigen veld`],
  },
  gestaakt: {
    lijst: [() => 'Sport: wedstrijd VV Sneek gestaakt na incident op het veld'],
  },
};

// en als er niets gebeurd is: rustig lokaal nieuws
const RUSTIG = [
  'Weer: morgen wisselend bewolkt, af en toe een bui, 17 graden',
  'VV Sneek Wit Zwart traint weer op het hoofdveld',
  'Jumbo in Tinga verlengt openingstijden op zaterdag',
  'Werkzaamheden aan de Dúvelsrak: verkeer wordt omgeleid',
  'Wijkfeest Tinga: vrijwilligers gezocht voor de kraampjes',
  'Gemeente Súdwest-Fryslân haalt kliko\'s voortaan om de week op',
  'Zwanen op de Geeuw: automobilisten gevraagd af te remmen',
  'Radio Tinga zoekt nieuwe dj voor de zondagochtend',
  'Sneekweek komt eraan: de haven loopt al vol',
];

/*
 Van het geheugen nieuwsregels maken, het nieuwste eerst; is er minder dan `n`,
 dan aangevuld met rustig lokaal nieuws (welk stuk hangt aan de tijd, zodat het
 in de loop van een avond wisselt maar binnen een paar seconden niet springt).
 Elke regel is een tekst; `kopteksten({ metSoort: true })` geeft ook de soort,
 het uur en of het "net binnen" is.
*/
export function kopteksten(n = TV.koppen, { metSoort = false } = {}) {
  if (typeof n === 'object' && n) { metSoort = !!n.metSoort; n = n.n || TV.koppen; }
  const uit = [];
  const t = nu();
  for (let i = geheugen.length - 1; i >= 0 && uit.length < n; i--) {
    const g = geheugen[i];
    const k = KOPPEN[g.soort];
    const f = g.opnieuw && k.opnieuw ? k.opnieuw : k.lijst[g.keus % k.lijst.length];
    let tekst;
    try { tekst = f(g.straat, g.extra || {}); } catch (e) { tekst = null; }
    if (!tekst) continue;
    uit.push({ tekst, soort: g.soort, uur: uurTekst(g.uur), vers: t - g.t < 60 });
  }
  const rust = Math.floor(t / 90);
  for (let i = 0; uit.length < n && i < RUSTIG.length; i++) {
    uit.push({ tekst: RUSTIG[(rust + i) % RUSTIG.length], soort: 'lokaal', uur: null, vers: false });
  }
  return metSoort ? uit : uit.map(r => r.tekst);
}

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
      // eerst het geheugen van de tv (stap 131), met een eigen, kortere rem
      if (KOPPEN[soort]) {
        // (de straat alleen opzoeken als het geheugen hem kan nemen: een vuurgevecht meldt elke treffer)
        let p = null;
        for (let i = geheugen.length - 1; i >= 0 && !p; i--) if (geheugen[i].soort === soort) p = geheugen[i];
        if (!p || nu() - p.t >= TV.zelfde) {
          onthoud(soort, x == null ? null : (straatVan(x, z) || null), extra);
        }
      }
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

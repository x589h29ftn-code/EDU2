// Geluid, gesynthetiseerd met de Web Audio API. Op één ding na — de muziek op de
// autoradio, die uit audio/radio/ komt — zijn er geen geluidsbestanden: alles
// wordt uit ruis en oscillatoren opgebouwd. Dat scheelt
// downloads en werkt ook waar externe bestanden geblokkeerd zijn.
//
// Wat er te horen is:
//   - een grondtoon van wind, die aanzwelt bij slecht weer
//   - vogels overdag, krekels 's avonds
//   - regen als geruis, harder naarmate je buiten staat
//   - voetstappen die verschillen op klinkers, tegels en gras
//   - een motor in de auto met een versnellingsbak: de toeren lopen op en
//     vallen terug zodra er geschakeld wordt
//   - een rockdeuntje uit de autoradio zolang je achter het stuur zit
//   - schoten, herladen, portieren en verkeer in de verte
//
// De browser staat pas geluid toe na een klik of toets, dus alles start bij de
// eerste invoer van de speler. Met U zet je het geluid uit en weer aan.

let ctx = null;
let hoofd = null;      // eindvolume
let aan = false;
let gedempt = false;
let gepauzeerd = false;   // Esc: alles stil, zie geluid.pauzeer

const bronnen = {};          // langlopende lagen
let radioLijst = [];         // de nummers van de zender die nu opstaat
let zenders = [];            // de zenders uit audio/radio/zenders.json
let zenderNu = 0;            // welke zender opstaat
let zenderStand = [];        // per zender: waar je gebleven was (seconden)
let radioAuto = null;        // in welke auto je zat: een andere auto = andere plek in de uitzending
let lijstGeladen = false;
let missieLijst = [];        // de spanningsmuziek uit audio/missie/
let missieGeladen = false;
let missiePlek = -1;         // waar het vorige fragment begon (seconden), om niet te herhalen
// en de vier fragmenten daarvoor: een nieuw begin ligt zo ver mogelijk van al die plekken af
const missiePlekken = [];
// zo lang (s) speelt een fragment voor het zacht naar een ander stuk van het nummer overgaat
const MISSIE_WISSEL = 140, MISSIE_WISSEL_EXTRA = 70;
/*
 Zet je zelf een zender op, dan gaat de radio vóór de missiemuziek (verzoek
 21 sep 2026). Dat blijft zo zolang je in die auto zit; stap je uit, dan neemt
 de missiemuziek het weer over.
*/
let radioVoor = false;
// wie claimt de sirene, en tot wanneer (zie `sirene` verderop)
let sireneD = 1e9, sireneT = 0;
let galm = null;               // de galmtak naast de droge (zie `start`)
/*
 Het schot als opname (stap 105, audio/wapen/schot.mp3, aangeleverd 1 okt 2026). Het bestand begint
 met 80 ms stilte (de vertraging van de mp3 plus wat lucht); bij het laden zoeken we waar de knal
 begint en spelen we vanaf daar, anders hoor je je schot pas een tiende seconde na de klik.
 `schotSoort` is 'opname' of 'gemaakt' (het oude, gesynthetiseerde schot), te kiezen in het menu.
*/
let schotBuf = null, schotBegin = 0, schotSoort = 'opname', schotLaden = null;
const schotStemmen = new Map();   // per bron de laatste stem, om die af te kappen bij het volgende schot
let laatsteSchot = null;          // (voor tools/schottest.mjs)
const schotLevend = new Set();    // alle stemmen die nog klinken (ook voor de proef: per bron tellen)
let schotTeller = 0;
/*
 De uitzending van missie 18 (stap 107): audio/radio/uitzending.mp3, het fragment dat de gebruiker
 aanleverde (40,2 s). Gedecodeerd, net als het schot, want het verhaal wil weten hoe lang hij duurt en
 de proef of hij speelt. Zolang hij loopt zwijgen de autoradio, de huisradio en de missiemuziek.
*/
let uitzendBuf = null, uitzendLaden = null, uitzendBron = null, uitzendBegon = 0, uitzendWil = false;
let uitzendingNu = false;
// het muziekje van de intro in de heli van missie 18 (stap 119): seconden aanzwellen, seconden uitdoven, volume
export const HELI_MUZIEK = { url: 'audio/intro/intro.mp3', in: 4, uit: 7, vol: 0.5, dip: 2.5 };
// de wieken van de heli van Wiebe (stap 127): zoveel keer de politieheli
export const HELI_ROND = { luid: 2.6 };
/*
 Opnames van de gebruiker (stap 127, 9 okt 2026): "Ik voeg ook geluid toe voor explosies, twee soorten
 achtergrond geluid ipv wat je nu hanteert, helicopter geluid voor de helicopter let wel op afstand
 helicopter … Verder een radio geluid als je voor het eerst een politiester hebt. Speel je een deel van het
 nummer kort random deel kort fade in en kort fade out". Lukt het laden niet, dan blijft het gemaakte geluid.
*/
export const OPNAMES = {
  explosie: 'audio/explosie/explosie.mp3',      // 2,9 s
  heli: 'audio/heli/heli.mp3',                  // 10,1 s, in een lus
  politieRadio: 'audio/politie/radio.mp3',      // 37,5 s portofoon
};
// de achtergrond: overdag de lange opname (6,8 min), 's nachts de korte (68 s); een element dat streamt
export const ACHTERGROND = {
  dag: { url: 'audio/sfeer/achtergrond1.mp3', vol: 0.55 },
  nacht: { url: 'audio/sfeer/achtergrond2.mp3', vol: 0.30 },
  wissel: 4,           // s overvloeien tussen dag en nacht
  binnen: 0.25,        // zoveel ervan binnen, en doffer
};
// de portofoon bij de eerste ster: een willekeurig stuk van zo lang, zo snel in en uit, en niet vaker dan dit
export const POLITIE_RADIO = { duur: [5, 8], in: 0.35, uit: 0.9, vol: 0.55, rust: 45 };
let herhaling = false;             // na missie 18 zendt Radio Tinga het fragment af en toe opnieuw uit
const HERHALING = { bestand: 'uitzending.mp3', titel: 'Een mededeling van Erik en Mark', artiest: 'Radio Tinga' };
/*
 Per wapen: de afspeelsnelheid (hoger = korter en feller, lager = dieper en voller) en het volume.
 Een volgend schot binnen `kap` seconden kapt de naklank van het vorige af: zo blijft een salvo van het
 machinegeweer twaalf losse knallen per seconde in plaats van één opgestapelde brij, en klinkt
 alleen het laatste helemaal uit.
*/
const SCHOT = {
  pistool: { rate: 1.0, vol: 1.15 },
  mitrailleur: { rate: 1.08, vol: 0.9 },
  sniper: { rate: 0.8, vol: 1.35 },
  ander: { rate: 1.0, vol: 1.0 },
};
const SCHOT_KAP = 0.6;
const MISSIE_VOL = 0.26;     // spanningsmuziek: onder de radio (0,32) en boven de motor
let vogelKlok = 0, krekelKlok = 0, molenKlok = 0;
let laatsteSfeer = null;     // welk omgevingsgeluid er het laatst klonk

/*
 De losse geluiden van de buurt, per moment van de dag. Overdag hoor je vogels,
 een hond en af en toe een brommer; 's nachts blijft er weinig over — een uil,
 een hond verderop, en een enkele brommer. Binnen (in de auto) hoor je de
 kleine geluiden niet, alleen wat er doorheen komt.
*/
const SFEER_DAG = ['mus', 'merel', 'meeuw', 'kraai', 'duif', 'hond', 'brommer', 'klok', 'eend'];
const SFEER_NACHT = ['uil', 'hond', 'brommer', 'kraai', 'klok', 'kikker'];
const SFEER_BINNEN = ['brommer', 'klok', 'meeuw'];
function kiesSfeer(nacht, binnen) {
  const lijst = binnen ? SFEER_BINNEN : nacht ? SFEER_NACHT : SFEER_DAG;
  let naam = lijst[Math.floor(Math.random() * lijst.length)];
  // nooit twee keer achter elkaar hetzelfde: dat is precies wat het oude
  // mussengeluidje deed
  if (naam === laatsteSfeer && lijst.length > 1) naam = lijst[(lijst.indexOf(naam) + 1) % lijst.length];
  return naam;
}

function nu() { return ctx ? ctx.currentTime : 0; }
// de opnames van stap 127 (`OPNAMES`): AudioBuffers zodra ze binnen zijn
const opname = {}, opnameLaden = {};
let politieRadioT = -1e9, politieRadioTeller = 0, explosieTeller = 0;

// ---------- bouwstenen ----------
function ruisBuffer(sec = 2) {
  const n = Math.floor(ctx.sampleRate * sec);
  const b = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

// een doorlopende ruislaag met een filter erop
function ruisLaag(type, freq, q, volume) {
  const src = ctx.createBufferSource();
  src.buffer = ruisBuffer(3);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = volume;
  src.connect(f); f.connect(g); g.connect(hoofd);
  src.start();
  return { src, filter: f, gain: g };
}

// korte klap uit ruis: voetstap, schot, portier. `vertraag` zet hem verder in
// de toekomst (voor een roffel die vooruit gepland wordt), `bus` stuurt hem
// door een eigen volumeregelaar in plaats van rechtstreeks naar het eindvolume.
function tik({ freq = 900, q = 1, duur = 0.12, volume = 0.3, type = 'bandpass', val = 0.9, vertraag = 0, bus = null }) {
  if (!aan) return;
  const src = ctx.createBufferSource();
  src.buffer = ruisBuffer(0.3);
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  const t = nu() + vertraag;
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * val), t + duur);
  src.connect(f); f.connect(g); g.connect(bus || hoofd);
  src.start(t); src.stop(t + duur + 0.02);
}

// een toon met een envelope: vogel, pieptoon
function toon({ freq = 800, naar = null, duur = 0.15, volume = 0.12, golf = 'sine', vertraag = 0 }) {
  if (!aan) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = golf;
  const t = nu() + vertraag;
  o.frequency.setValueAtTime(freq, t);
  if (naar) o.frequency.exponentialRampToValueAtTime(naar, t + duur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volume, t + duur * 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
  o.connect(g); g.connect(hoofd);
  o.start(t); o.stop(t + duur + 0.02);
}

// ---------- publieke geluiden ----------
export const geluid = {
  get actief() { return aan && !gedempt; },

  start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    hoofd = ctx.createGain();
    hoofd.gain.value = 0.55;
    hoofd.connect(ctx.destination);
    /*
     Ruimte. Alles klonk even droog: een schot in een gang klonk als een schot
     op een weiland (verzoek 22 sep 2026). Hier hangt daarom een galmtak naast
     de droge: drie vertragingen met terugkoppeling en een laagdoorlaat erop,
     die samen een kleine ruimte nabootsen. Geen impulsbestand — dat zou een
     geluidsbestand zijn, en die zitten hier alleen in audio/ voor de muziek.

     De sterkte wordt per beeld gezet (zie `omgeving`): binnen hoor je hem, op
     straat bijna niet, want een straat kaatst maar een beetje terug.
    */
    galm = ctx.createGain(); galm.gain.value = 0;
    const galmLo = ctx.createBiquadFilter();
    galmLo.type = 'lowpass'; galmLo.frequency.value = 2600;
    const terug = ctx.createGain(); terug.gain.value = 0.34;
    for (const [tijd, sterkte] of [[0.031, 0.9], [0.057, 0.7], [0.089, 0.5]]) {
      const d = ctx.createDelay(0.4);
      d.delayTime.value = tijd;
      const g = ctx.createGain(); g.gain.value = sterkte;
      hoofd.connect(d); d.connect(g); g.connect(galmLo);
      d.connect(terug);                       // een beetje terugkoppeling: staart
    }
    terug.connect(galmLo);
    galmLo.connect(galm);
    galm.connect(ctx.destination);
    aan = true;

    // grondtoon: wind door de bomen
    bronnen.wind = ruisLaag('lowpass', 420, 0.7, 0.020);
    // verkeersgeruis van de N7 in de verte
    bronnen.verkeer = ruisLaag('bandpass', 180, 0.9, 0.012);
    // regen staat klaar maar begint op nul
    bronnen.regen = ruisLaag('highpass', 1300, 0.5, 0.0);
    /*
     Water tegen de kant. De Geeuw, de vaarten en de kolk bij de molen lagen er
     volkomen stil bij; dit is het klotsen dat je hoort zodra je aan de wal
     staat of erop vaart. Een smalle band rond 700 Hz klinkt als water tegen
     hout en steen, en de sterkte komt uit de afstand tot bevaarbaar water
     (js/main.js).
    */
    bronnen.water = ruisLaag('bandpass', 700, 1.1, 0.0);
    window.__geluid = true;
    this.laadSchot();
    this.laadOpnames();
  },

  // de opnames van stap 127, elk één keer opgehaald en ontleed
  laadOpnames() {
    if (!ctx) return null;
    for (const [k, url] of Object.entries(OPNAMES)) {
      if (opnameLaden[k]) continue;
      opnameLaden[k] = (async () => {
        try {
          const r = await fetch(url, { cache: 'force-cache' });
          if (!r.ok) return null;
          opname[k] = await ctx.decodeAudioData(await r.arrayBuffer());
          return opname[k];
        } catch { return null; }
      })();
    }
    return Promise.all(Object.values(opnameLaden));
  },
  opnameStand() { return Object.fromEntries(Object.keys(OPNAMES).map(k => [k, opname[k] ? +opname[k].duration.toFixed(1) : null])); },

  // het schot als opname: één keer ophalen en ontleden; mislukt het, dan blijft het gemaakte schot
  laadSchot(url = 'audio/wapen/schot.mp3') {
    if (schotLaden || !ctx) return schotLaden;
    schotLaden = (async () => {
      try {
        const r = await fetch(url, { cache: 'force-cache' });
        if (!r.ok) return null;
        const buf = await ctx.decodeAudioData(await r.arrayBuffer());
        // waar begint de knal: het eerste stukje van 5 ms boven −30 dB van de piek, en dan 4 ms ervoor
        const d = buf.getChannelData(0), N = Math.max(1, Math.round(buf.sampleRate * 0.005));
        let piek = 0; for (let i = 0; i < d.length; i++) piek = Math.max(piek, Math.abs(d[i]));
        let begin = 0;
        for (let i = 0; i < d.length; i += N) {
          let som = 0; for (let j = i; j < Math.min(d.length, i + N); j++) som += d[j] * d[j];
          if (Math.sqrt(som / N) > piek * 0.0316) { begin = Math.max(0, i / buf.sampleRate - 0.004); break; }
        }
        schotBuf = buf; schotBegin = begin;
        return buf;
      } catch { return null; }
    })();
    return schotLaden;
  },
  zetSchotSoort(soort) { schotSoort = soort === 'gemaakt' ? 'gemaakt' : 'opname'; },

  // ---------- de uitzending (missie 18) ----------
  laadUitzending(url = 'audio/radio/uitzending.mp3') {
    if (uitzendLaden || !ctx) return uitzendLaden;
    uitzendLaden = (async () => {
      try {
        const r = await fetch(url, { cache: 'force-cache' });
        if (!r.ok) return null;
        uitzendBuf = await ctx.decodeAudioData(await r.arrayBuffer());
        // was hij al gevraagd terwijl hij nog laadde, dan begint hij nu
        if (uitzendWil && !uitzendBron) this.uitzending(true);
        return uitzendBuf;
      } catch { return null; }
    })();
    return uitzendLaden;
  },
  /*
   Aan: vanaf het begin, door een radiofilter (de studiomonitors, en zo klinkt hij straks ook in
   de auto). Uit: meteen weg. Nog niet geladen: hij begint zodra het bestand binnen is.
  */
  uitzending(aanzetten) {
    uitzendWil = !!aanzetten;
    if (!aanzetten) {
      if (uitzendBron) { try { uitzendBron.src.stop(); } catch { /* al gestopt */ } }
      uitzendBron = null; uitzendingNu = false;
      return false;
    }
    if (!aan || !ctx) return false;
    if (!uitzendBuf) { this.laadUitzending(); return false; }
    if (uitzendBron) return true;
    const src = ctx.createBufferSource(); src.buffer = uitzendBuf;
    const hi = ctx.createBiquadFilter(); hi.type = 'highpass'; hi.frequency.value = 110;
    const lo = ctx.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.value = 0.9;
    src.connect(hi); hi.connect(lo); lo.connect(g); g.connect(hoofd);
    src.onended = () => { if (uitzendBron && uitzendBron.src === src) { uitzendBron = null; uitzendingNu = false; uitzendWil = false; } };
    src.start();
    uitzendBron = { src, gain: g };
    uitzendBegon = nu(); uitzendingNu = true;
    return true;
  },
  // (voor het verhaal en tools/uitzendingtest.mjs)
  uitzendingStand() {
    return { geladen: !!uitzendBuf, duur: uitzendBuf ? uitzendBuf.duration : 0, speelt: !!uitzendBron,
      tijd: uitzendBron ? nu() - uitzendBegon : 0, wil: uitzendWil, herhaling,
      gedempt: uitzendingNu, kanaal: uitzendBuf ? uitzendBuf.numberOfChannels : 0 };
  },
  /*
   Na missie 18 staat het fragment in de afspeellijst van Radio Tinga, tussen de nummers door. Werkt
   ook als de zenders nog niet geladen zijn: `laadRadio` kijkt er dan zelf naar.
  */
  zetHerhaling(v) {
    herhaling = !!v;
    const z = zenders.find(q => /tinga/i.test(q.naam || ''));
    if (!z) return herhaling;
    const i = z.nummers.findIndex(n => n.bestand === HERHALING.bestand);
    if (herhaling && i < 0) z.nummers.push({ ...HERHALING, url: 'audio/radio/' + HERHALING.bestand });
    if (!herhaling && i >= 0) z.nummers.splice(i, 1);
    if (zenders[zenderNu] === z) radioLijst = z.nummers;
    return herhaling;
  },
  get schotSoort() { return schotSoort; },
  // (voor tools/schottest.mjs)
  schotStand(bron = null) {
    let stemmen = 0;
    for (const v of schotLevend) if (v.speelt && (bron === null || v.bron === bron)) stemmen++;
    return { geladen: !!schotBuf, begin: schotBegin, duur: schotBuf ? schotBuf.duration : 0, soort: schotSoort,
      laatste: laatsteSchot, teller: schotTeller, stemmen };
  },

  // hoofdvolume; de U-toets in main.js zet het geluid hiermee uit en aan
  demp(v) {
    gedempt = v;
    if (hoofd) hoofd.gain.setTargetAtTime(gedempt || gepauzeerd ? 0 : 0.55, nu(), 0.15);
  },

  /*
   Een schot.

   Een pistoolschot is in het echt geen "boem" maar een **knal**: een
   drukgolf van een paar milliseconden met energie tot ver boven de 10 kHz,
   daarna een korte lage klap van het uitstromende gas, en dan de straat die
   het terugkaatst. Dat laatste is wat je in een woonwijk vooral hoort — twee,
   drie echo's tegen de overkant en de gevels verderop.

   De eerste versie was drie gefilterde ruisstootjes op 2600, 900 en 240 Hz plus
   een vierkante toon: dat klonk dof, meer als een dichtslaande deur. Deze versie
   zet de vier lagen apart neer:

   1. de knal: ongefilterde ruis van vier milliseconden, alleen de laagste tonen
      eraf. Kort en breed, dat is wat het scherp maakt;
   2. de gasklap: ruis door een laagdoorlaat plus een sinus die van 180 naar
      50 Hz zakt — de stoot die je in je borst voelt;
   3. de kaatsingen: drie kopieën van de knal, steeds zachter en doffer, op 38,
      74 en 130 ms. Dat zijn de gevels aan de overkant van de straat;
   4. de naijl: een zachte ruisstaart van een halve seconde die wegsterft.

   Elk schot krijgt wat toonhoogte- en tijdverschil mee, anders klinkt een serie
   als een kopieermachine. En vlak erna tikt de huls op de stoep.
  */
  schot(afstand = 0, { wapen = 'ander', bron = 'ander' } = {}) {
    if (!aan) return;
    schotTeller++;
    const v = 0.92 + Math.random() * 0.16;
    const t0 = nu();
    if (schotBuf && schotSoort === 'opname') {
      /*
       De opname. Van ver weg zachter (dezelfde lijn als het gemaakte schot hieronder) en doffer:
       een laagdoorlaat die van 12 kHz vlakbij naar 1,4 kHz op tachtig meter zakt.
      */
      const W = SCHOT[wapen] || SCHOT.ander;
      const k = Math.max(0.12, 1 - afstand / 80);
      const src = ctx.createBufferSource(); src.buffer = schotBuf;
      const rate = W.rate * (0.96 + Math.random() * 0.08);
      src.playbackRate.value = rate;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.value = 12000 - Math.min(1, afstand / 80) * 10600;
      const g = ctx.createGain(); g.gain.value = W.vol * k;
      src.connect(lp); lp.connect(g); g.connect(hoofd);
      const vorig = schotStemmen.get(bron);
      if (vorig && vorig.speelt && t0 - vorig.t < SCHOT_KAP) {
        vorig.g.gain.cancelScheduledValues(t0);
        vorig.g.gain.setValueAtTime(vorig.g.gain.value, t0);
        vorig.g.gain.linearRampToValueAtTime(0, t0 + 0.025);
        try { vorig.src.stop(t0 + 0.03); } catch { /* al gestopt */ }
        vorig.speelt = false; schotLevend.delete(vorig);
      }
      const stem = { src, g, t: t0, speelt: true, bron };
      schotLevend.add(stem);
      src.onended = () => { stem.speelt = false; schotLevend.delete(stem); };
      schotStemmen.set(bron, stem);
      src.start(t0, schotBegin);
      laatsteSchot = { wapen, bron, rate, offset: schotBegin, gain: W.vol * k, lp: lp.frequency.value, opname: true };
      if (afstand < 25) setTimeout(() => { toon({ freq: 3200, naar: 2100, duur: 0.07, volume: 0.05 }); }, 260);
      return;
    }
    laatsteSchot = { wapen, bron, opname: false };
    /*
     Een schot van ver weg is zachter en doffer. Tot nu toe stond elk schot even
     hard, want er werd alleen vlakbij geschoten; bij de deal aan de molen
     (missie 8) kijk je van vijftig meter mee en dan hoort het geknal daar ook
     vandaan te komen. Boven de tachtig meter blijft er een dof tikje over.
    */
    const k = Math.max(0.12, 1 - afstand / 80);

    // 1. de knal zelf: heel korte, brede ruisstoot
    {
      const src = ctx.createBufferSource(); src.buffer = ruisBuffer(0.1);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320;
      const piek = ctx.createBiquadFilter(); piek.type = 'peaking';
      piek.frequency.value = 3200 * v; piek.Q.value = 0.9; piek.gain.value = 9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.85 * k, t0);
      g.gain.exponentialRampToValueAtTime(0.06 * k, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
      src.connect(hp); hp.connect(piek); piek.connect(g); g.connect(hoofd);
      src.start(t0); src.stop(t0 + 0.08);
    }

    // 2. de klap van het gas
    tik({ freq: 420 * v, q: 0.6, duur: 0.09, volume: 0.42 * k, type: 'lowpass', val: 0.35 });
    toon({ freq: 180 * v, naar: 50, duur: 0.16, volume: 0.20 * k, golf: 'sine' });

    // 3. de straat kaatst hem terug: drie keer zachter en doffer
    const echos = [[0.038, 0.30, 5200], [0.074, 0.16, 3000], [0.130, 0.08, 1800]];
    for (const [na, vol, top] of echos) {
      tik({ freq: top * v, q: 0.5, duur: 0.05, volume: vol * k, type: 'lowpass', val: 0.5,
        vertraag: na + Math.random() * 0.006 });
    }

    // 4. naijl tussen de huizen
    tik({ freq: 900, q: 0.7, duur: 0.55, volume: 0.075 * k, type: 'bandpass', val: 0.35, vertraag: 0.06 });

    // de huls: een klein metalig tikje op de grond, alleen als je erbij staat
    if (afstand < 25) setTimeout(() => { toon({ freq: 3200, naar: 2100, duur: 0.07, volume: 0.05 }); }, 260);
  },

  // klik op een leeg magazijn
  leegKlik() {
    tik({ freq: 3000, q: 6, duur: 0.035, volume: 0.14 });
    tik({ freq: 1200, q: 8, duur: 0.04, volume: 0.08, vertraag: 0.03 });
  },

  // de losse stappen van het herladen; js/wapen.js roept ze aan op het moment
  // dat je de beweging ziet gebeuren
  magazijnKnop() { tik({ freq: 2800, q: 6, duur: 0.035, volume: 0.13 }); },
  magazijnUit() {
    tik({ freq: 1700, q: 3, duur: 0.06, volume: 0.11 });
    setTimeout(() => tik({ freq: 900, q: 2, duur: 0.10, volume: 0.10, val: 0.4 }), 150);  // op de grond
  },
  magazijnIn() {
    tik({ freq: 700, q: 2.5, duur: 0.09, volume: 0.20, val: 0.45 });
    toon({ freq: 220, naar: 120, duur: 0.07, volume: 0.07, golf: 'square' });
  },
  slede() {
    tik({ freq: 2400, q: 4, duur: 0.05, volume: 0.17 });
    tik({ freq: 1500, q: 5, duur: 0.06, volume: 0.20, vertraag: 0.10 });
  },

  /*
   Het moment waarop het ene wapen weg is en het andere komt: geen klik van
   metaal op metaal maar het doffe schuren van staal langs stof — ruis die
   laag wegzakt, met een kort tikje erachteraan van het wapen dat in de hand
   valt. js/player.js roept hem aan halverwege de wisselbeweging.
  */
  wapenWissel() {
    tik({ freq: 480, q: 0.9, duur: 0.13, volume: 0.10, val: 0.5 });
    tik({ freq: 1300, q: 3, duur: 0.05, volume: 0.09, vertraag: 0.12 });
  },

  // blijft bestaan voor wie hem al aanriep: de hele reeks achter elkaar
  herladen() {
    this.magazijnKnop();
    setTimeout(() => this.magazijnUit(), 250);
    setTimeout(() => this.magazijnIn(), 700);
    setTimeout(() => this.slede(), 1150);
  },

  // ondergrond bepaalt de klank: klinkers klinken hard, gras zacht
  voetstap(soort = 'klinker', rennen = false) {
    const v = rennen ? 0.11 : 0.07;
    if (soort === 'gras') tik({ freq: 620, q: 0.8, duur: 0.10, volume: v * 0.8, type: 'lowpass', val: 0.5 });
    else if (soort === 'tegel') tik({ freq: 2100, q: 2.2, duur: 0.07, volume: v });
    else tik({ freq: 1500, q: 1.6, duur: 0.08, volume: v });
  },

  sprong() { tik({ freq: 700, q: 1, duur: 0.09, volume: 0.08, type: 'lowpass' }); },
  landing() { tik({ freq: 380, q: 0.9, duur: 0.14, volume: 0.13, type: 'lowpass', val: 0.4 }); },

  portier() {
    tik({ freq: 300, q: 1.4, duur: 0.18, volume: 0.3, type: 'lowpass', val: 0.4 });
    toon({ freq: 90, naar: 55, duur: 0.16, volume: 0.12, golf: 'triangle' });
  },

  raak() { toon({ freq: 1400, naar: 900, duur: 0.09, volume: 0.14, golf: 'square' }); },
  // het mes (stap 123): een korte zwiep door de lucht, en een doffe tik als hij niets raakt
  mesZwaai() { tik({ freq: 2600, q: 0.8, duur: 0.13, volume: 0.10, type: 'bandpass', val: 0.6 }); },
  mesMis() { tik({ freq: 1800, q: 0.6, duur: 0.08, volume: 0.04, type: 'bandpass', val: 0.5 }); },

  // Schelle ringtone: twee tonen die een paar keer heen en weer gaan, zoals een
  // goedkope telefoon. Wordt door het verhaal aangeroepen (js/verhaal.js).
  telefoon(keren = 3) {
    for (let k = 0; k < keren; k++) {
      const t0 = k * 1.1;
      for (let i = 0; i < 8; i++) {
        toon({ freq: i % 2 ? 1560 : 1180, duur: 0.055, volume: 0.13, golf: 'square', vertraag: t0 + i * 0.06 });
      }
    }
  },

  /*
   Het aftellen voor de race (missie 14): een korte piep op drie, twee en één,
   en op START een lange, een octaaf hoger — zoals de lichten aan de start van
   een race.
  */
  aftelPiep(start = false) {
    if (start) {
      toon({ freq: 1320, duur: 0.7, volume: 0.15, golf: 'square' });
      toon({ freq: 660, duur: 0.7, volume: 0.06, golf: 'square' });
    } else {
      toon({ freq: 660, duur: 0.2, volume: 0.15, golf: 'square' });
    }
  },

  // de sluiter van de telefoon (missie 15): twee korte tikjes vlak na elkaar
  fotoKlik() {
    toon({ freq: 2400, duur: 0.035, volume: 0.10, golf: 'square' });
    toon({ freq: 1600, duur: 0.05, volume: 0.08, golf: 'square', vertraag: 0.07 });
  },

  /*
   Spannend deuntje bij de achtervolging van de dief (js/verhaal.js). Een
   jachtende achtstenbas in d-klein, een dreigende halve toon erboven en een
   trommeltje op de tussenmaat — alles door één lowpass, zodat het onder de
   voetstappen en het geschreeuw blijft.

   Wordt elk beeld aangeroepen met een vlag: `true` laat het deuntje aanzwellen
   en de maten vooruit plannen, `false` laat het in een halve seconde uitdoven.
   Zolang het niet gespeeld heeft, wordt er ook niets gebouwd.
  */
  jacht(actief) {
    if (!aan) return;
    if (!bronnen.jacht) {
      if (!actief) return;
      const g = ctx.createGain(); g.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; f.Q.value = 0.8;
      f.connect(g); g.connect(hoofd);
      bronnen.jacht = { gain: g, bus: f, volgende: 0, maat: 0 };
    }
    const j = bronnen.jacht;
    j.actief = actief;                 // de autoradio zakt hieronder weg
    j.gain.gain.setTargetAtTime(actief ? 0.5 : 0, nu(), actief ? 0.7 : 0.3);
    if (!actief) { j.maat = 0; return; }

    // vier maten van 1,2 s (acht achtsten van 0,15 s), grondtoon per maat
    const GRONDEN = [73.42, 73.42, 61.74, 65.41];      // D2 D2 B1 C2
    const BAS = [0, 0, 7, 0, 0, 10, 7, 5];             // halve tonen boven de grondtoon
    const halve = (f, n) => f * Math.pow(2, n / 12);
    const t = nu();
    if (j.volgende < t) j.volgende = t + 0.05;
    while (j.volgende < t + 1.4) {
      const start = j.volgende;
      const grond = GRONDEN[j.maat % GRONDEN.length];
      const stem = (freq, van, duur, volume, golf) => {
        const o = ctx.createOscillator(); const g2 = ctx.createGain();
        o.type = golf; o.frequency.value = freq;
        g2.gain.setValueAtTime(0.0001, start + van);
        g2.gain.exponentialRampToValueAtTime(volume, start + van + 0.012);
        g2.gain.exponentialRampToValueAtTime(0.0001, start + van + duur);
        o.connect(g2); g2.connect(j.bus);
        o.start(start + van); o.stop(start + van + duur + 0.02);
      };
      // de bas: acht achtsten, kort en hard
      BAS.forEach((n, i) => stem(halve(grond, n), i * 0.15, 0.13, 0.075, 'sawtooth'));
      // erboven twee tonen een halve toon van elkaar: het "hij ontsnapt"-motief
      const hoog = j.maat % 2 ? [880, 830.6] : [830.6, 880];
      stem(hoog[0], 0.0, 0.26, 0.022, 'square');
      stem(hoog[1], 0.6, 0.26, 0.022, 'square');
      // laatste maat van de lus: een oplopend loopje dat de spanning opdrijft
      if (j.maat % 4 === 3) [0, 3, 7, 10].forEach((n, i) => stem(halve(440, n), 0.9 + i * 0.075, 0.09, 0.03, 'triangle'));
      // trommel: een dreun op één en drie, een hoedje op elke tussenmaat
      for (const off of [0, 0.6]) tik({ freq: 150, q: 1.0, duur: 0.16, volume: 0.28, type: 'lowpass', val: 0.35, vertraag: start - t + off, bus: j.bus });
      for (const off of [0.3, 0.75, 1.05]) tik({ freq: 7000, q: 0.8, duur: 0.045, volume: 0.14, type: 'highpass', vertraag: start - t + off, bus: j.bus });
      j.volgende += 1.2; j.maat++;
    }
  },

  /*
   Een grote waakhond (missie 17): twee, drie keer kort en laag, met een raspje
   erbovenop. Dichterbij is harder; de hondjes in de wijk (`sfeerGeluid('hond')`)
   zijn kleiner en veel zachter.
  */
  blaf(afstand = 4) {
    const v = Math.max(0.15, Math.min(1, 6 / Math.max(1, afstand)));
    for (let i = 0, n = 2 + Math.floor(Math.random() * 2); i < n; i++) {
      const na = i * (0.26 + Math.random() * 0.1);
      toon({ freq: 210 + Math.random() * 50, naar: 110, duur: 0.16, volume: 0.13 * v, golf: 'sawtooth', vertraag: na });
      tik({ freq: 900, q: 1.0, duur: 0.12, volume: 0.11 * v, val: 0.35, vertraag: na });
    }
  },

  klap() {   // blik: auto geraakt
    tik({ freq: 1200, q: 1.1, duur: 0.16, volume: 0.3, val: 0.2 });
    toon({ freq: 320, naar: 180, duur: 0.2, volume: 0.12, golf: 'triangle' });
  },

  /*
   Hout dat het begeeft: een schutting waar je doorheen rijdt. Geen blik maar
   brekende planken, dus geen heldere tik met een naklank maar drie droge
   knappen kort na elkaar — de latten geven niet allemaal tegelijk mee — met er
   een lage bons onder van het paneel dat plat slaat.
  */
  kraak() {
    for (const [na, f, v] of [[0, 2600, 0.22], [0.035, 1700, 0.17], [0.075, 3300, 0.12]])
      tik({ freq: f, q: 0.8, duur: 0.06, volume: v, val: 0.25, vertraag: na });
    toon({ freq: 190, naar: 90, duur: 0.22, volume: 0.10, golf: 'triangle' });
  },

  /*
   Een auto die ontploft. Dit was hetzelfde blikken `klap()` als een kogel in een
   portier, en dat leest niet als een explosie — een knal van een benzinetank is
   vooral láág en lang, en de scherpte zit er alleen in de eerste vijftig
   milliseconden.

   Vier lagen, net als bij het schot:
   1. de flits: breedbandige ruis van 60 ms, de klap die je het eerst hoort;
   2. de stoot: een sinus die van 90 naar 28 Hz zakt — dat is wat je voelt;
   3. het vuur: laaggefilterde ruis van anderhalve seconde die uitdooft, het
      rommelende deel;
   4. de brokken: een handvol tikjes in het eerste halve seconde, blik en glas
      dat op de straat terechtkomt.
  */
  explosie(afstand = 0, luid = 1) {
    if (!aan) return;
    /*
     Hoe ver weg het gebeurt telt mee. Een auto die honderd meter verderop de
     lucht in gaat klonk precies zo hard als eentje naast je, en dat verraadde
     dat de knal geen plek in de wereld had. Boven de honderdtwintig meter hoor
     je hem niet meer; de hoge kant (de flits, de brokjes) valt sneller weg dan
     het lage rommelen, want dat is ook wat lucht met geluid doet.
    */
    const v = Math.max(0, 1 - afstand / 120) ** 1.4 * luid;
    if (v < 0.03) return;
    explosieTeller++;
    if (opname.explosie) {
      /*
       De opname (stap 127): verder weg zachter en doffer, en elke knal een tikje anders van toonhoogte.
       Bij `luid` boven de 1 komt er hieronder het naroffelen bij.
      */
      const src = ctx.createBufferSource(); src.buffer = opname.explosie;
      src.playbackRate.value = 0.9 + Math.random() * 0.16;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass';
      f.frequency.value = 900 + 15000 * Math.max(0, 1 - afstand / 90) ** 2;
      const g = ctx.createGain(); g.gain.value = Math.min(1.6, 0.95 * v);
      src.connect(f); f.connect(g); g.connect(hoofd);
      src.start();
      if (luid <= 1) return;
      toon({ freq: 55, naar: 22, duur: 1.6, volume: 0.32 * Math.min(2, luid), golf: 'sine', vertraag: 0.04 });
      tik({ freq: 160, q: 0.5, duur: 2.8, volume: 0.26 * Math.min(2, luid), type: 'lowpass', val: 0.6, vertraag: 0.3 });
      return;
    }
    const hoog = Math.min(1.6, v * v);
    /*
     `luid` boven de 1 (stap 127, de C4 op de Dúvelsrak: "Geef bij explosie duvelsrak ook explosie geluid mee"):
     een tweede, diepere klap en een lang naroffelen onder het dek door.
    */
    if (luid > 1) {
      toon({ freq: 55, naar: 22, duur: 1.6, volume: 0.32 * Math.min(2, luid), golf: 'sine', vertraag: 0.04 });
      tik({ freq: 160, q: 0.5, duur: 2.8, volume: 0.30 * Math.min(2, luid), type: 'lowpass', val: 0.6, vertraag: 0.1 });
      for (let i = 0; i < 6; i++) tik({ freq: 300 + Math.random() * 500, q: 0.8, duur: 0.35, volume: 0.12, type: 'lowpass', val: 0.2, vertraag: 0.4 + i * 0.28 + Math.random() * 0.2 });
    }
    tik({ freq: 2200, q: 0.4, duur: 0.06, volume: 0.5 * hoog, type: 'highpass', val: 0.15 });
    tik({ freq: 240, q: 0.6, duur: 0.55, volume: 0.5 * v, type: 'lowpass', val: 0.25 });
    toon({ freq: 90, naar: 28, duur: 0.65, volume: 0.30 * v, golf: 'sine' });
    tik({ freq: 420, q: 0.5, duur: 1.6, volume: 0.22 * v, type: 'lowpass', val: 0.35, vertraag: 0.05 });
    for (let i = 0; i < 7; i++) {
      tik({ freq: 2600 + Math.random() * 4000, q: 3, duur: 0.05, volume: 0.07 * hoog,
            vertraag: 0.12 + Math.random() * 0.5 });
    }
  },

  /*
   Vuurwerk (stap 127): een doffe plof als de pijl openspringt en daarna het knetteren van de vonken, alles
   zachter en doffer naarmate het verder weg is (tot 400 m).
  */
  vuurwerk(afstand = 100) {
    if (!aan) return;
    const v = Math.max(0, 1 - afstand / 400) ** 1.2;
    if (v < 0.03) return;
    const vertraag = Math.min(0.9, afstand / 340);      // het geluid komt na het licht
    toon({ freq: 120, naar: 40, duur: 0.45, volume: 0.22 * v, golf: 'sine', vertraag });
    tik({ freq: 900, q: 0.6, duur: 0.18, volume: 0.18 * v, type: 'lowpass', val: 0.1, vertraag });
    for (let i = 0; i < 10; i++) {
      tik({ freq: 3000 + Math.random() * 3500, q: 2.5, duur: 0.03, volume: 0.05 * v * v,
            vertraag: vertraag + 0.25 + Math.random() * 1.1 });
    }
  },

  /*
   Glas. Een ruit die het begeeft is geen enkele klap maar een handvol scherven
   die kort na elkaar op de stoep vallen: hoge tikjes met wisselende toonhoogte,
   uitgesmeerd over een halve seconde.
  */
  glas() {
    if (!aan) return;
    tik({ freq: 5200, q: 1.2, duur: 0.05, volume: 0.16, type: 'highpass', val: 0.2 });
    const n = 5 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) {
      toon({ freq: 3200 + Math.random() * 4200, duur: 0.025 + Math.random() * 0.03,
             volume: 0.035 + Math.random() * 0.03, golf: 'triangle',
             vertraag: 0.02 + Math.random() * 0.45 });
    }
  },

  /*
   Een menselijke kreet. Geen samples, dus het moet uit formanten komen: een
   zaagtand op de toonhoogte van een stem met drie smalle banden erop, die samen
   ongeveer een "aah" vormen. `soort` is 'schrik' (kort, hoog, omhoog) of 'pijn'
   (lager, langer, zakkend). `stem` schuift de toonhoogte, zodat niet iedereen in
   de straat dezelfde keel heeft.

   Afstand telt: wie honderd meter verderop schrikt hoor je niet.
  */
  kreet(soort = 'schrik', afstand = 0, stem = Math.random()) {
    if (!aan) return;
    const v = Math.max(0, 1 - afstand / 55) ** 1.5;
    if (v < 0.03) return;
    const t = nu();
    const laag = soort === 'pijn';
    const basis = (laag ? 150 : 230) * (0.82 + stem * 0.42);
    const duur = laag ? 0.42 : 0.26;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(basis * (laag ? 1.12 : 0.88), t);
    o.frequency.exponentialRampToValueAtTime(basis * (laag ? 0.62 : 1.28), t + duur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.035);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
    // drie formanten maken er een klinker van in plaats van een zoemer
    let laatste = o;
    for (const [f, q] of [[720, 7], [1180, 9], [2600, 11]]) {
      const b = ctx.createBiquadFilter();
      b.type = 'bandpass'; b.frequency.value = f * (0.9 + stem * 0.2); b.Q.value = q;
      laatste.connect(b); laatste = b;
    }
    laatste.connect(g); g.connect(hoofd);
    o.start(t); o.stop(t + duur + 0.05);
  },

  /*
   Bandengier. Eén doorlopende bron die elk beeld een sterkte tussen 0 en 1
   krijgt: hoe harder de banden slippen, hoe luider en hoe hoger. Ruis door een
   smalle band rond 1,3 kHz klinkt als rubber over asfalt; een enkele toon erbij
   geeft het de piep.
  */
  gier(sterkte = 0) {
    if (!aan) return;
    if (!bronnen.gier) {
      if (sterkte <= 0.01) return;
      const src = ctx.createBufferSource();
      src.buffer = ruisBuffer(3); src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 7;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 780;
      const og = ctx.createGain(); og.gain.value = 0.06;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); o.connect(og); og.connect(f); f.connect(g); g.connect(hoofd);
      src.start(); o.start();
      bronnen.gier = { gain: g, filter: f, o };
    }
    const s = bronnen.gier, t = nu();
    const k = Math.max(0, Math.min(1, sterkte));
    s.gain.gain.setTargetAtTime(k * 0.13, t, k > 0.05 ? 0.04 : 0.12);
    s.filter.frequency.setTargetAtTime(1050 + k * 900, t, 0.1);
    s.o.frequency.setTargetAtTime(640 + k * 420, t, 0.1);
  },

  /*
   Pauze. Zonder dit blijft de motor doorbrommen zodra je Esc indrukt: de
   oscillator loopt door en `motorToeren` wordt niet meer aangeroepen, dus hij
   blijft op de laatste stand hangen. Hetzelfde geldt voor de sirene en de
   omgevingslagen. Het hoofdvolume in één keer dichtdraaien lost ze alle drie op,
   en de muziek wordt echt stilgezet zodat hij niet doorloopt terwijl je in het
   menu staat.
  */
  // De stand van de geluidsketen, voor tools/gevoeltest.mjs: wat staat er open?
  stand() {
    return {
      aan, gedempt, gepauzeerd,
      hoofd: hoofd ? +hoofd.gain.value.toFixed(4) : null,
      motor: bronnen.motor ? +bronnen.motor.gain.gain.value.toFixed(4) : null,
      sirene: bronnen.sirene ? +bronnen.sirene.gain.gain.value.toFixed(4) : null,
      heli: bronnen.heli ? +bronnen.heli.gain.gain.value.toFixed(4) : null,
      gier: bronnen.gier ? +bronnen.gier.gain.gain.value.toFixed(4) : null,
      muziek: bronnen.muziek ? +bronnen.muziek.gain.gain.value.toFixed(4) : null,
      missie: bronnen.missie ? +bronnen.missie.gain.gain.value.toFixed(4) : null,
    };
  },

  pauzeer(v) {
    gepauzeerd = !!v;
    if (hoofd) hoofd.gain.setTargetAtTime(gedempt || gepauzeerd ? 0 : 0.55, nu(), 0.08);
    const bed = bronnen.bed ? [bronnen.bed.dagB, bronnen.bed.nachtB] : [];
    for (const m of [bronnen.muziek, bronnen.missie, bronnen.heliMuz, ...bed]) {
      if (m && m.el) { if (gepauzeerd) m.el.pause(); else if (m.aan) m.el.play().catch(() => {}); }
    }
  },

  // ---------- motor in de auto ----------
  motorAan() {
    if (!aan || bronnen.motor) return;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'square';
    o1.frequency.value = 55; o2.frequency.value = 27;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.value = 0.0;
    o1.connect(f); o2.connect(f); f.connect(g); g.connect(hoofd);
    o1.start(); o2.start();
    g.gain.setTargetAtTime(0.075, nu(), 0.25);
    bronnen.motor = { o1, o2, filter: f, gain: g };
  },

  motorUit() {
    const m = bronnen.motor; if (!m) return;
    m.gain.gain.setTargetAtTime(0, nu(), 0.2);
    setTimeout(() => { try { m.o1.stop(); m.o2.stop(); } catch {} }, 500);
    bronnen.motor = null;
  },

  /*
   Toeren en versnellingen. Zonder versnellingsbak loopt de toonhoogte recht met
   de snelheid mee en klinkt het alsof je de hele wijk in zijn één doorkomt.
   Daarom een bak met vijf verzetten: binnen een verzet lopen de toeren op, bij
   het schakelen vallen ze terug naar het begin van het volgende. Tijdens dat
   schakelmoment valt het gas even weg en klikt de pook.

   `top` is de topsnelheid van dít voertuig (een bakwagen schakelt eerder op).
  */
  motorToeren(snelheid, top = 24) {
    const m = bronnen.motor; if (!m) return;
    const t = nu();
    const v = Math.abs(snelheid);
    // grenzen waarbij er opgeschakeld wordt, als deel van de topsnelheid
    const GRENZEN = [0.16, 0.32, 0.52, 0.76, 1.02].map(f => f * top);
    let bak = 0;
    while (bak < GRENZEN.length - 1 && v > GRENZEN[bak]) bak++;
    const onder = bak === 0 ? 0 : GRENZEN[bak - 1];
    // achteruit is één lage versnelling die hoog opjankt
    const achteruit = snelheid < -0.2;
    const toeren = achteruit
      ? Math.min(1, v / (top * 0.28))
      : Math.min(1, (v - onder) / Math.max(0.5, GRENZEN[bak] - onder));

    if (m.bak === undefined) m.bak = bak;
    if (!achteruit && bak !== m.bak) {
      m.bak = bak;
      m.schakelT = t + 0.16;              // koppeling in: even geen gas
      tik({ freq: 240, q: 2.4, duur: 0.05, volume: 0.05, type: 'lowpass', val: 0.5 });
    }
    if (achteruit) m.bak = 0;
    const schakelt = (m.schakelT || 0) > t;
    const gas = schakelt ? 0.35 : 1;      // tijdens het schakelen zakt hij in
    const tau = schakelt ? 0.03 : 0.09;
    // binnen een verzet loopt de toon van een derde naar vol toerental
    const n = (achteruit ? 0.45 : 0.30) + toeren * 0.70;
    m.o1.frequency.setTargetAtTime(48 + n * 155, t, tau);
    m.o2.frequency.setTargetAtTime(24 + n * 78, t, tau);
    m.filter.frequency.setTargetAtTime(380 + n * 1500 * gas, t, 0.12);
    m.gain.gain.setTargetAtTime((0.036 + n * 0.038) * gas, t, schakelt ? 0.05 : 0.15);
  },

  /*
   De afspeellijst van de autoradio: audio/radio/nummers.json. Eén keer ophalen,
   en het mag mislukken — dan blijft het gesynthetiseerde riffje hieronder de
   radio. Zo kun je er een nummer bij zetten zonder aan de code te komen.
  */
  async laadRadio(map = 'audio/radio/') {
    if (lijstGeladen) return radioLijst;
    lijstGeladen = true;
    const bestanden = (lijst) => (lijst || []).filter(n => n && n.bestand).map(n => ({ ...n, url: map + n.bestand }));
    try {
      const r = await fetch(`${map}zenders.json`, { cache: 'force-cache' });
      if (r.ok) {
        const j = await r.json();
        zenders = (j.zenders || []).map(z => ({ ...z, nummers: bestanden(z.nummers) })).filter(z => z.nummers.length);
      }
    } catch { /* geen zenderlijst: dan de oude lijst hieronder */ }
    if (!zenders.length) {
      try {
        const r = await fetch(`${map}nummers.json`, { cache: 'force-cache' });
        if (r.ok) {
          const j = await r.json();
          const n = bestanden(j.nummers);
          if (n.length) zenders = [{ naam: 'Radio Tinga', logo: 'tinga', nummers: n }];
        }
      } catch { /* ook niet: het riffje blijft */ }
    }
    zenderStand = zenders.map(() => null);
    radioLijst = zenders.length ? zenders[zenderNu].nummers : [];
    if (herhaling) this.zetHerhaling(true);
    return radioLijst;
  },

  // De zenders, voor het menu en de proef.
  radioZenders() { return zenders.map(z => ({ naam: z.naam, logo: z.logo, nummers: z.nummers.length, doorlopend: !!z.doorlopend })); },
  radioZender() { return zenders[zenderNu] ? { naam: zenders[zenderNu].naam, logo: zenders[zenderNu].logo, nr: zenderNu } : null; },

  /*
   Van zender wisselen. De plek in de uitzending van de zender die je verlaat
   wordt onthouden, zodat je er bij terugkomst weer instapt waar hij was — een
   radiozender loopt door terwijl jij naar iets anders luistert.
  */
  zenderWissel(stap = 1) {
    // jij kiest: vanaf nu hoor je de radio en niet de missiemuziek
    radioVoor = true;
    if (zenders.length < 2) return this.radioZender();
    const m = bronnen.muziek;
    if (m && m.el && !m.stuk) zenderStand[zenderNu] = m.el.currentTime;
    zenderNu = (zenderNu + stap + zenders.length) % zenders.length;
    radioLijst = zenders[zenderNu].nummers;
    if (m) { m.nummer = null; m.zender = zenderNu; }
    return this.radioZender();
  },

  /*
   Een zender op naam kiezen. Het verhaal gebruikt dit: in de groene BX uit
   missie 6 staat Radio Spannenburg op (verzoek 20 sep 2026). Zit die zender er
   niet, dan gebeurt er niets en blijft staan wat er stond.
  */
  zetZender(naam) {
    const i = zenders.findIndex(z => new RegExp(naam, 'i').test(z.naam || ''));
    if (i < 0 || i === zenderNu) return this.radioZender();
    const m = bronnen.muziek;
    if (m && m.el && !m.stuk) zenderStand[zenderNu] = m.el.currentTime;
    zenderNu = i;
    radioLijst = zenders[i].nummers;
    if (m) { m.nummer = null; m.zender = i; }
    return this.radioZender();
  },

  /*
   Je stapt in een auto. Elke auto heeft zijn eigen radio: in dezelfde auto
   loopt de uitzending door waar hij was, in een andere begint hij ergens
   anders. Zonder dat hoor je in elke auto weer hetzelfde begin.
  */
  radioInstap(sleutel) {
    const anders = sleutel !== radioAuto;
    radioAuto = sleutel;
    if (anders) {
      const m = bronnen.muziek;
      if (m) { m.nummer = null; m.nieuweAuto = true; }
      // een andere auto: ook de onthouden plekken van de zenders vervallen
      zenderStand = zenders.map(() => null);
    }
    return this.radioZender();
  },

  // Wat er nu speelt, voor het berichtbalkje: { titel, artiest } of null.
  radioNummer() {
    const m = bronnen.muziek;
    return m && m.nummer ? { titel: m.nummer.titel, artiest: m.nummer.artiest } : null;
  },

  // De stand van de muziekspeler, voor tools/radiotest.mjs.
  radioStand() {
    const m = bronnen.muziek;
    if (!m) return { speler: false, nummers: radioLijst.length };
    return { speler: true, nummers: radioLijst.length, stuk: !!m.stuk, speelt: !m.el.paused,
      bron: (m.el.src || '').split('/').pop(), tijd: +m.el.currentTime.toFixed(2),
      duur: isFinite(m.el.duration) ? +m.el.duration.toFixed(0) : null,
      zender: zenders[zenderNu] ? zenders[zenderNu].naam : null, zenders: zenders.length };
  },

  /*
   Muziek uit een bestand, door dezelfde smalle band als het riffje hieronder:
   een hoogdoorlaat op 190 Hz en een laagdoorlaat op 3,4 kHz, zodat het uit de
   speakers in het portier klinkt en niet als een concert. Het bestand loopt via
   een <audio>-element (dan hoeft er niets in het geheugen te worden gedecodeerd)
   dat als bron in de geluidsketen hangt.

   Lukt dat niet — geen lijst, bestand weg, browser wil niet — dan valt de radio
   terug op het gesynthetiseerde deuntje.
  */
  muziek(actief, sterkte = 1) {
    /*
     Uit de auto: de missiemuziek is weer de baas. Dit staat vóór alles wat
     hieronder kan afhaken (geen lijst, nog geen element), want anders bleef
     `radioVoor` hangen zodra er geen mp3's in audio/radio/ staan en zweeg de
     missiemuziek de rest van de missie.
    */
    if (!actief) radioVoor = false;
    if (!aan || !radioLijst.length) return false;
    if (!bronnen.muziek) {
      if (!actief) return true;
      const el = new Audio();
      el.crossOrigin = 'anonymous';
      el.preload = 'none';
      const g = ctx.createGain(); g.gain.value = 0;
      const lo = ctx.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 3400; lo.Q.value = 0.7;
      const hi = ctx.createBiquadFilter(); hi.type = 'highpass'; hi.frequency.value = 190;
      let bron = null;
      try { bron = ctx.createMediaElementSource(el); } catch { return false; }
      bron.connect(hi); hi.connect(lo); lo.connect(g); g.connect(hoofd);
      bronnen.muziek = { el, gain: g, nummer: null, beurt: Math.floor(Math.random() * radioLijst.length), stuk: false };
      el.addEventListener('ended', () => { bronnen.muziek.nummer = null; });
      el.addEventListener('error', () => { bronnen.muziek.stuk = true; });
    }
    const m = bronnen.muziek;
    m.aan = !!actief;                               // zodat geluid.pauzeer weet of hij mag hervatten
    if (m.stuk) return false;                       // bestand doet het niet: terug naar het riffje
    /*
     De muziek stond op 0,22 en de motor liep tot 0,11 met een open filter erbij;
     in de auto overstemde de motor daarmee het nummer (melding beta-test
     12 sep 2026). De muziek gaat omhoog en de motor omlaag, zodat je de motor
     nog steeds hoort schakelen maar de radio ervoor komt.
    */
    /*
     Onder het jachtdeuntje, en onder de missiemuziek, zakt de radio weg. Zit je
     in de auto van de missie, dan speelt de score; de radio blijft er zacht
     onder staan zodat je hem nog hoort, maar hij dringt niet meer voor.
    */
    const onder = (bronnen.jacht && bronnen.jacht.actief)
      || (bronnen.missie && bronnen.missie.aan && !radioVoor);
    // onder de uitzending van missie 18 zwijgt de radio
    const doel = actief && !uitzendingNu ? (onder ? 0.08 : 0.32) * sterkte : 0;
    m.gain.gain.setTargetAtTime(doel, nu(), actief ? 0.5 : 0.35);
    if (actief) {
      if (!m.nummer) {
        const zender = zenders[zenderNu];
        m.nummer = radioLijst[m.beurt % radioLijst.length];
        m.beurt++;
        /*
         Alleen een ándere bron laden. Dezelfde url opnieuw toekennen laadt het
         bestand wéér, en dan gooit die herstart de plek weg die we er net in
         hadden gezet — precies het geval "je stapt in een andere auto terwijl
         dezelfde zender opstaat".
        */
        const zelfde = m.el.src && m.el.src === new URL(m.nummer.url, location.href).href;
        if (!zelfde) m.el.src = m.nummer.url;
        m.zender = zenderNu;
        /*
         Waar begint hij? Een doorlopende zender (Radio Spannenburg is een
         uitzending van een uur) mag nooit steeds bij nul beginnen: dan hoor je
         in elke auto hetzelfde fragment. Ben je hier al eerder geweest, dan
         pakt hij de onthouden plek op; stap je in een ándere auto, dan begint
         hij ergens willekeurig. De duur is pas bekend als de metadata binnen
         is, dus dat gebeurt in een luisteraar.
        */
        const onthouden = zenderStand[zenderNu];
        const zetPlek = () => {
          const duur = m.el.duration;
          if (!isFinite(duur) || duur < 1) return;
          if (onthouden != null && onthouden < duur - 2) m.el.currentTime = onthouden;
          else if (zender && zender.doorlopend) m.el.currentTime = Math.random() * Math.max(1, duur - 60);
        };
        if (zelfde && m.el.readyState >= 1) zetPlek();
        else m.el.addEventListener('loadedmetadata', zetPlek, { once: true });
        m.nieuweAuto = false;
      }
      if (m.el.paused) m.el.play().catch(() => { m.stuk = true; });
      // waar hij is, voor de volgende keer dat je van zender wisselt
      if (m.zender === zenderNu) zenderStand[zenderNu] = m.el.currentTime;
    } else if (!m.el.paused) {
      m.el.pause();
    }
    return true;
  },

  /*
   De spanningsmuziek onder een missie: audio/missie/nummers.json. Net als de
   radiolijst één keer ophalen, en het mag mislukken — dan blijft het bij het
   gewone geluid van de wijk.
  */
  async laadMissieMuziek(map = 'audio/missie/') {
    if (missieGeladen) return missieLijst;
    missieGeladen = true;
    try {
      const r = await fetch(`${map}nummers.json`, { cache: 'force-cache' });
      if (r.ok) {
        const j = await r.json();
        missieLijst = (j.nummers || []).filter(n => n && n.bestand).map(n => ({ ...n, url: map + n.bestand }));
      }
    } catch { /* geen lijst: geen missiemuziek */ }
    return missieLijst;
  },

  /*
   Muziek onder de spannende delen van een missie (js/verhaal.js roept dit elk
   beeld aan met true of false). Drie dingen maken het anders dan de radio:

   - het is geen uitzending maar een score: hij gaat níet door het bandfilter
     van de autospeakers, maar recht op het eindvolume;
   - hij begint elke keer op een andere plek in het nummer. Het aangeleverde
     bestand is drie kwartier lang; zou hij steeds bij nul beginnen, dan hoor
     je bij elke missie hetzelfde fragment (verzoek 20 sep 2026). De vorige
     plek wordt onthouden, en een nieuwe moet er minstens twee minuten vandaan
     liggen;
   - hij zwelt aan in ongeveer twee seconden en dooft in tweeënhalf weer uit;
     het element gaat pas daarna op pauze, anders hak je de fade eraf.

   De autoradio zakt weg zolang dit speelt — zie `muziek` en `autoradio`
   hieronder: twee nummers door elkaar is geen spanning maar drukte.
  */
  /*
   Het muziekje van de intro (audio/intro/intro.mp3), nog één keer: in missie 18 als Erik in de heli van
   Wiebe zit (stap 119, gevraagd: "met fade in en rustige fade out"). js/verhaal.js roept dit elk beeld aan
   met true zolang je in de heli zit, en met false daarna. Het nummer begint vooraan en zwelt aan in
   `HELI_MUZIEK.in` seconden; uit gaat het in `HELI_MUZIEK.uit`. Is het nummer op voor de vlucht klaar is, dan
   begint het opnieuw (stap 127, zie hieronder). Eén keer per vlucht: wie uitstapt en weer in de heli zit (opnieuw na
   het neergaan) hoort het opnieuw vanaf het begin. De missiemuziek zwijgt eronder.
  */
  heliMuziek(actief) {
    if (!aan || !ctx) return false;
    if (!bronnen.heliMuz) {
      if (!actief) return true;
      const el = new Audio();
      el.crossOrigin = 'anonymous';
      el.preload = 'auto';
      el.src = HELI_MUZIEK.url;
      const g = ctx.createGain(); g.gain.value = 0;
      let bron = null;
      try { bron = ctx.createMediaElementSource(el); } catch { return false; }
      bron.connect(g); g.connect(hoofd);
      bronnen.heliMuz = { el, gain: g, aan: false, speelt: false, uitT: 0, stuk: false, keer: 0, ramps: [], dipt: false, herhaal: 0, vorigeTijd: 0 };
      el.loop = true;
      el.addEventListener('error', () => { bronnen.heliMuz.stuk = true; });
      el.addEventListener('ended', () => { bronnen.heliMuz.speelt = false; });
    }
    const h = bronnen.heliMuz;
    if (h.stuk) return false;
    const t = nu();
    // (de proef leest wat er gepland is: in deze container lopen de audioklok en het element niet op echte tijd)
    const plan = (van, naar, duur, waarom) => { h.ramps.push({ van: +van.toFixed(3), naar, duur: +duur.toFixed(2), waarom }); if (h.ramps.length > 8) h.ramps.shift(); };
    if (actief && !h.aan) {
      // instappen: vooraan beginnen, aanzwellen
      h.aan = true; h.speelt = true; h.uitT = 0; h.keer++; h.dipt = false; h.vorigeTijd = 0;
      try { h.el.currentTime = 0; } catch { /* nog niet geladen */ }
      h.el.play().catch(() => {});
      h.gain.gain.cancelScheduledValues(t);
      h.gain.gain.setValueAtTime(0, t);
      h.gain.gain.linearRampToValueAtTime(HELI_MUZIEK.vol, t + HELI_MUZIEK.in);
      plan(0, HELI_MUZIEK.vol, HELI_MUZIEK.in, 'in');
    } else if (!actief && h.aan) {
      // uitstappen: rustig weg, en pas daarna op pauze
      h.aan = false;
      h.gain.gain.cancelScheduledValues(t);
      h.gain.gain.setValueAtTime(h.gain.gain.value, t);
      h.gain.gain.linearRampToValueAtTime(0, t + HELI_MUZIEK.uit);
      plan(h.gain.gain.value, 0, HELI_MUZIEK.uit, 'uit');
      h.uitT = t + HELI_MUZIEK.uit;
    } else if (actief && h.speelt && !h.uitT && h.el.duration) {
      /*
       Het nummer duurt 65 s, de vlucht langer (stap 127, gevraagd: "Muziekje stopt op de helft van de missie,
       misschien nogmaals spelen totdat heli klaar is"). Het element staat op `loop`: vlak voor het eind zakt het
       even weg en na de sprong naar het begin zwelt het weer aan, tot je uitstapt.
      */
      const rest = h.el.duration - h.el.currentTime;
      if (rest < HELI_MUZIEK.dip && !h.dipt) {
        h.dipt = true;
        h.gain.gain.cancelScheduledValues(t);
        h.gain.gain.setValueAtTime(h.gain.gain.value, t);
        h.gain.gain.linearRampToValueAtTime(HELI_MUZIEK.vol * 0.2, t + Math.max(0.3, rest));
        plan(h.gain.gain.value, +(HELI_MUZIEK.vol * 0.2).toFixed(3), Math.max(0.3, rest), 'dip');
      } else if (h.dipt && h.el.currentTime < h.vorigeTijd - 1) {
        h.dipt = false; h.herhaal++;
        h.gain.gain.cancelScheduledValues(t);
        h.gain.gain.setValueAtTime(h.gain.gain.value, t);
        h.gain.gain.linearRampToValueAtTime(HELI_MUZIEK.vol, t + 2);
        plan(h.gain.gain.value, HELI_MUZIEK.vol, 2, 'opnieuw');
      }
    }
    if (h.speelt) h.vorigeTijd = h.el.currentTime;
    if (!h.aan && h.uitT && t > h.uitT && !h.el.paused) { h.el.pause(); h.speelt = false; }
    return true;
  },
  // (voor tools/introtest.mjs en tools/avondtest.mjs)
  heliMuziekStand() {
    const h = bronnen.heliMuz;
    return h ? { aan: h.aan, speelt: h.speelt && !h.el.paused, volume: +h.gain.gain.value.toFixed(3), tijd: +h.el.currentTime.toFixed(2),
      bestand: HELI_MUZIEK.url, keer: h.keer, herhaal: h.herhaal, loop: h.el.loop, stuk: h.stuk, ramps: h.ramps.slice(), duur: h.el.duration || 0, pauze: h.el.paused } : null;
  },

  missiemuziek(actief) {
    if (uitzendingNu) actief = false;            // onder de uitzending van missie 18
    if (bronnen.heliMuz && bronnen.heliMuz.aan) actief = false;   // en onder het muziekje in de heli (stap 119)
    if (!aan || !missieLijst.length) return false;
    if (!bronnen.missie) {
      if (!actief) return true;
      const el = new Audio();
      el.crossOrigin = 'anonymous';
      el.preload = 'none';
      const g = ctx.createGain(); g.gain.value = 0;
      let bron = null;
      try { bron = ctx.createMediaElementSource(el); } catch { return false; }
      bron.connect(g); g.connect(hoofd);
      bronnen.missie = { el, gain: g, nummer: null, stuk: false, speelt: false, stopT: 0, wil: -1 };
      el.addEventListener('error', () => { bronnen.missie.stuk = true; });
      // loopt het nummer toch een keer af, dan begint hij ergens anders opnieuw
      el.addEventListener('ended', () => { bronnen.missie.nummer = null; bronnen.missie.speelt = false; });
    }
    const m = bronnen.missie;
    m.aan = !!actief;                    // zodat geluid.pauzeer weet of hij mag hervatten
    if (m.stuk) return false;
    if (actief) {
      m.stopT = 0;
      if (!m.speelt) {
        m.speelt = true;
        m.nummer = missieLijst[Math.floor(Math.random() * missieLijst.length)];
        const zelfde = m.el.src && m.el.src === new URL(m.nummer.url, location.href).href;
        if (!zelfde) m.el.src = m.nummer.url;
        /*
         Elke missie een ander stuk van het nummer. Springen kan alleen als de
         speler de lengte al kent én het bestand mag doorzoeken; lukt het niet,
         dan begint hij bij nul en hoor je elke missie hetzelfde begin (melding
         21 sep 2026). Daarom wordt de sprong niet één keer geprobeerd maar
         vastgehouden: de gewenste plek blijft staan tot hij er ook echt staat.
        */
        const kiesPlek = () => {
          const duur = m.el.duration;
          if (!isFinite(duur) || duur < 20) return -1;
          // een fragment van een minuut of wat, ruim binnen de randen van het bestand
          const stuk = Math.min(m.nummer.fragment || 75, Math.max(20, duur - 20));
          const ruimte = Math.max(1, duur - stuk - 10);
          /*
           Tien willekeurige plekken, en daarvan die het verst van de vorige vijf
           beginpunten ligt (verzoek 27 sep 2026: "meer randomness in de
           missiemuziek, door op andere punten te beginnen"). Eén willekeurige
           plek viel vaak dicht bij een eerdere, en dan klinkt het hetzelfde.
          */
          let plek = 5 + Math.random() * ruimte, beste = -1;
          for (let k = 0; k < 10; k++) {
            const p = 5 + Math.random() * ruimte;
            const af = missiePlekken.length ? Math.min(...missiePlekken.map(q => Math.abs(q - p))) : Infinity;
            if (af > beste) { beste = af; plek = p; }
          }
          return plek;
        };
        const zetPlek = () => {
          if (m.wil < 0) {
            const plek = kiesPlek();
            if (plek < 0) return;
            m.wil = plek;
            missiePlek = plek;
            missiePlekken.push(plek); if (missiePlekken.length > 5) missiePlekken.shift();
            m.wisselNa = nu() + MISSIE_WISSEL + Math.random() * MISSIE_WISSEL_EXTRA;
          }
          try { m.el.currentTime = m.wil; } catch { /* nog niet te zetten: straks weer */ }
        };
        m.wil = -1;
        m.zetPlek = zetPlek;               // (ook voor de wissel halverwege, hieronder)
        zetPlek();
        /*
         En daarna nog een keer, zodra de speler iets nieuws weet. `loadedmetadata`
         geeft de lengte, `canplay` betekent dat hij mag springen, en `playing`
         is het laatste vangnet: staat hij dan nog aan het begin terwijl we
         verderop wilden zitten, dan springt hij alsnog.
        */
        for (const gebeurtenis of ['loadedmetadata', 'canplay']) {
          m.el.addEventListener(gebeurtenis, zetPlek, { once: true });
        }
        m.el.addEventListener('playing', () => {
          if (m.wil > 0 && Math.abs(m.el.currentTime - m.wil) > 5) zetPlek();
        }, { once: true });
        m.gain.gain.cancelScheduledValues(nu());
        m.gain.gain.setValueAtTime(0, nu());
      }
      if (m.el.paused && !gepauzeerd) m.el.play().catch(() => { m.stuk = true; });
      /*
       Zet de speler zelf een zender op, dan stapt de missiemuziek opzij: hij
       blijft wel doorlopen (zo komt hij zonder sprong terug zodra je uitstapt)
       maar je hoort hem niet meer. Twee nummers door elkaar is geen spanning.
      */
      const opzij = radioVoor && bronnen.muziek && bronnen.muziek.aan;
      /*
       Een lange missie hoort niet één stuk van het nummer te zijn: na twee à drie
       minuten zakt hij in een seconde weg, springt naar een ander stuk (zo ver
       mogelijk van de vorige) en zwelt daar weer aan.
      */
      if (m.wisselNa && nu() > m.wisselNa && !m.wissel && isFinite(m.el.duration)) {
        m.wissel = nu() + 1.2;
        m.gain.gain.setTargetAtTime(0, nu(), 0.3);
      }
      if (m.wissel) {
        if (nu() < m.wissel) return true;
        m.wissel = 0; m.wil = -1;
        if (m.zetPlek) m.zetPlek();
      }
      m.gain.gain.setTargetAtTime(opzij ? 0 : MISSIE_VOL, nu(), opzij ? 0.6 : 0.7);
    } else if (m.speelt) {
      m.speelt = false;
      m.gain.gain.setTargetAtTime(0, nu(), 0.8);               // uit in ~2,5 s
      m.stopT = nu() + 2.5;
    } else if (m.stopT && nu() > m.stopT) {
      m.stopT = 0;
      if (!m.el.paused) m.el.pause();                          // pas ná de fade
    }
    return true;
  },

  /*
   De stand van de ruimte: hoeveel galm er open staat, hoe dof het verkeer van
   buiten klinkt en hoe hard het water klotst. Voor tools/belevingtest.mjs —
   anders is "het klinkt ruimtelijker" niet te toetsen.
  */
  ruimteStand() {
    return {
      galm: galm ? +galm.gain.value.toFixed(4) : null,
      verkeer: bronnen.verkeer ? Math.round(bronnen.verkeer.filter.frequency.value) : null,
      water: bronnen.water ? +bronnen.water.gain.gain.value.toFixed(4) : null,
    };
  },

  // Gaat de radio nu voor? Voor tools/bxtest.mjs en tools/missietest.mjs.
  radioVoorgrond() { return radioVoor; },

  // Of de missiemuziek nu speelt, voor js/verhaal.js en tools/missietest.mjs.
  missieStand() {
    const m = bronnen.missie;
    if (!m) return { speler: false, nummers: missieLijst.length };
    return { speler: true, nummers: missieLijst.length, stuk: !!m.stuk, speelt: !m.el.paused,
      aan: !!m.aan, volume: +m.gain.gain.value.toFixed(4),
      bron: (m.el.src || '').split('/').pop(), tijd: +m.el.currentTime.toFixed(2),
      plek: m.wil >= 0 ? +m.wil.toFixed(2) : null,
      duur: isFinite(m.el.duration) ? +m.el.duration.toFixed(0) : null,
      // over hoeveel seconden (audioklok) hij naar een ander stuk springt, en de vorige beginpunten
      wisselOver: m.wisselNa ? +(m.wisselNa - nu()).toFixed(1) : null, plekken: missiePlekken.map(q => Math.round(q)) };
  },
  // voor tools/missietest.mjs: de wissel naar een ander stuk over `s` seconden
  missieWissel(s = 0) { const m = bronnen.missie; if (m && m.wisselNa) m.wisselNa = nu() + s; },

  /*
   De autoradio. Een rockdeuntje uit de speakers in het portier: een vervormde
   gitaarriff op de kwint (E-mineur), een bas eronder en een simpel drumstel.
   Alles gaat door een smalle band met een lowpass erachter, zodat het klinkt
   als een autoradio en niet als een concert, en het staat zacht genoeg om
   eronder de motor te blijven horen. Tijdens het jachtdeuntje van het verhaal
   zakt hij nog verder weg.

   Wordt elk beeld aangeroepen met `true` zolang je in de auto zit.
  */
  autoradio(actief, sterkte = 1) {
    if (!aan) return;
    /*
     `sterkte` schaalt het volume. In de auto is dat 1; in huis hangt het af van
     hoe ver je van het radiootje op het dressoir vandaan staat (verzoek
     23 sep 2026), zodat de muziek zachter wordt naarmate je verder de kamer uit
     loopt.
    */
    // Staat er muziek in audio/radio/, dan speelt die; het riffje hieronder is
    // de terugval als dat niet lukt.
    if (this.muziek(actief, sterkte)) {
      if (bronnen.autoradio) bronnen.autoradio.gain.gain.setTargetAtTime(0, nu(), 0.3);
      return;
    }
    if (!bronnen.autoradio) {
      if (!actief) return;
      const g = ctx.createGain(); g.gain.value = 0;
      const lo = ctx.createBiquadFilter(); lo.type = 'lowpass'; lo.frequency.value = 3400; lo.Q.value = 0.7;
      const hi = ctx.createBiquadFilter(); hi.type = 'highpass'; hi.frequency.value = 190;
      // vervorming voor de gitaar: een tanh-kromme, dus zachte overstuur
      const vorm = ctx.createWaveShaper();
      const kromme = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) kromme[i] = Math.tanh((i * 2 / 1024 - 1) * 12);
      vorm.curve = kromme; vorm.oversample = '2x';
      hi.connect(lo); lo.connect(g); g.connect(hoofd);
      vorm.connect(hi);
      bronnen.autoradio = { gain: g, bus: hi, gitaar: vorm, volgende: 0, maat: 0 };
    }
    const rr = bronnen.autoradio;
    // achtergrondniveau; onder het jachtdeuntje en onder de missiemuziek zachter
    const zacht = (bronnen.jacht && bronnen.jacht.actief)
      || (bronnen.missie && bronnen.missie.aan && !radioVoor);
    const doel = actief && !uitzendingNu ? (zacht ? 0.07 : 0.20) * sterkte : 0;
    rr.gain.gain.setTargetAtTime(doel, nu(), actief ? 0.5 : 0.35);
    if (!actief) { rr.maat = 0; return; }

    // 120 slagen per minuut: een achtste van 0,25 s, een maat van 2 s
    const E = 82.41;                                   // E2
    const halve = (n) => E * Math.pow(2, n / 12);
    // twee maten riff in e-klein, per achtste de grondtoon (null = rust)
    const RIFF = [
      [0, 0, null, 3, 0, null, 5, 3],
      [0, 0, null, 3, 5, 3, 0, null],
      [0, 0, null, 3, 0, null, 7, 5],
      [0, 0, 3, 0, 5, null, 3, null],
    ];
    const t = nu();
    if (rr.volgende < t) rr.volgende = t + 0.05;
    while (rr.volgende < t + 1.6) {
      const start = rr.volgende;
      const maat = RIFF[rr.maat % RIFF.length];
      maat.forEach((n, i) => {
        if (n === null) return;
        const f = halve(n), van = i * 0.25;
        // powerchord: grondtoon, kwint en octaaf door de vervorming
        for (const [ratio, vol] of [[1, 0.10], [1.4983, 0.075], [2, 0.05]]) {
          const o = ctx.createOscillator(); const g2 = ctx.createGain();
          o.type = 'sawtooth'; o.frequency.value = f * ratio;
          g2.gain.setValueAtTime(0.0001, start + van);
          g2.gain.exponentialRampToValueAtTime(vol, start + van + 0.015);
          g2.gain.exponentialRampToValueAtTime(0.0001, start + van + 0.23);
          o.connect(g2); g2.connect(rr.gitaar);
          o.start(start + van); o.stop(start + van + 0.26);
        }
        // bas een octaaf lager, schoon
        const b = ctx.createOscillator(); const bg = ctx.createGain();
        b.type = 'triangle'; b.frequency.value = f / 2;
        bg.gain.setValueAtTime(0.0001, start + van);
        bg.gain.exponentialRampToValueAtTime(0.075, start + van + 0.02);
        bg.gain.exponentialRampToValueAtTime(0.0001, start + van + 0.24);
        b.connect(bg); bg.connect(rr.bus);
        b.start(start + van); b.stop(start + van + 0.26);
      });
      // drumstel: trap op één en drie, snare op twee en vier, hi-hat op elke achtste
      for (const off of [0, 1.0]) tik({ freq: 110, q: 1.0, duur: 0.16, volume: 0.30, type: 'lowpass', val: 0.3, vertraag: start - t + off, bus: rr.bus });
      for (const off of [0.5, 1.5]) tik({ freq: 1900, q: 0.7, duur: 0.13, volume: 0.16, type: 'bandpass', val: 0.5, vertraag: start - t + off, bus: rr.bus });
      for (let i = 0; i < 8; i++) tik({ freq: 8000, q: 0.8, duur: 0.04, volume: i % 2 ? 0.05 : 0.08, type: 'highpass', vertraag: start - t + i * 0.25, bus: rr.bus });
      rr.volgende += 2.0; rr.maat++;
    }
  },

  // ---------- radio in de voortuin ----------
  // Een klein deuntje uit een draagbare radio: bas, akkoord en een tikje, alles
  // door een smalle band gehaald zodat het klinkt als een transistorradio en
  // niet als een geluidsinstallatie. Het volume hangt aan de afstand, dus je
  // hoort hem pas als je de Molenkrite in loopt.
  radio(afstand) {
    if (!aan) return;
    if (!bronnen.radio) {
      const g = ctx.createGain(); g.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.7;
      f.connect(g); g.connect(hoofd);
      bronnen.radio = { gain: g, bus: f, volgende: 0, maat: 0 };
    }
    const rd = bronnen.radio;
    // hoorbaar tot een meter of 35, daarbinnen vloeiend luider
    const v = afstand == null || uitzendingNu ? 0 : Math.max(0, 1 - afstand / 35) ** 2;
    rd.gain.gain.setTargetAtTime(v * 0.5, nu(), 0.3);
    if (v <= 0.001) return;

    // noten vooruit plannen; een maat duurt 1,6 s
    const AKKOORDEN = [[220, 277.2, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.7, 246.9]];
    const t = nu();
    if (rd.volgende < t) rd.volgende = t + 0.05;
    while (rd.volgende < t + 1.2) {
      const start = rd.volgende;
      const akk = AKKOORDEN[rd.maat % AKKOORDEN.length];
      const stem = (freq, duur, volume, golf) => {
        const o = ctx.createOscillator(); const g2 = ctx.createGain();
        o.type = golf; o.frequency.value = freq;
        g2.gain.setValueAtTime(0.0001, start);
        g2.gain.exponentialRampToValueAtTime(volume, start + 0.03);
        g2.gain.exponentialRampToValueAtTime(0.0001, start + duur);
        o.connect(g2); g2.connect(rd.bus);
        o.start(start); o.stop(start + duur + 0.02);
      };
      stem(akk[0] / 2, 0.55, 0.09, 'triangle');                       // bas
      for (const f of akk) stem(f, 0.34, 0.028, 'sawtooth');          // akkoord
      stem(akk[(rd.maat * 3 + 1) % 3] * 2, 0.22, 0.03, 'square');     // melodietje
      // hi-hat op de tussenmaat
      for (const off of [0.4, 0.8, 1.2]) {
        const src = ctx.createBufferSource(); src.buffer = ruisBuffer(0.1);
        const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 6000;
        const hg = ctx.createGain();
        hg.gain.setValueAtTime(0.05, start + off);
        hg.gain.exponentialRampToValueAtTime(0.0001, start + off + 0.05);
        src.connect(hf); hf.connect(hg); hg.connect(rd.bus);
        src.start(start + off); src.stop(start + off + 0.07);
      }
      rd.volgende += 1.6; rd.maat++;
    }
  },

  /*
   Sirene van de politie: twee tonen die elkaar afwisselen (de Nederlandse
   twee-toon, een kleine terts uit elkaar), door een bandfilter zodat het scherp
   klinkt en niet als een fluit. Wordt elk beeld aangeroepen met de afstand tot
   de dichtstbijzijnde eenheid met zwaailicht aan; `null` betekent stil.
  */
  /*
   Er is één sirene in de keten, en er zijn meerdere dingen die hem willen: de
   wagens (js/politie.js) en sinds 21 sep 2026 ook de boten (js/politieboot.js).
   Wie het dichtst bij is wint. Dat kan niet met "de laatste die roept", want
   dan bepaalt de volgorde in de hoofdlus wie je hoort, en een wagen die `null`
   roept zou de boot naast je het zwijgen opleggen. Een claim blijft daarom een
   kwart seconde staan; alleen een claim die dichterbij is haalt hem eraf, en
   `null` pas als de laatste claim verlopen is.
  */
  /*
   De scheidsrechter (stap 111, js/wedstrijd.js): een fluitje is een hoge toon met een triller erin
   (het balletje in de fluit). Kort voor een inworp, lang en twee keer bij een doelpunt of als het
   spel stilgelegd wordt. Zachter met de afstand, onhoorbaar verder dan 220 m.
  */
  fluit(afstand = 0, lang = false) {
    if (!aan) return;
    const v = Math.max(0, 1 - afstand / 220) ** 2;
    if (v < 0.01) return;
    const keren = lang ? 2 : 1;
    for (let k = 0; k < keren; k++) {
      const duur = lang ? 0.55 : 0.22, t0 = k * 0.7;
      for (let i = 0; i < Math.round(duur / 0.03); i++) {
        toon({ freq: i % 2 ? 2950 : 3150, duur: 0.035, volume: 0.09 * v, golf: 'sine', vertraag: t0 + i * 0.03 });
      }
    }
  },
  /*
   Gejuich van het publiek: ruis door een bandfilter rond de stem (een kilohertz), die in een halve
   seconde opkomt en in twee seconden wegzakt, met daaronder een lagere laag voor de mannenstemmen.
  */
  juich(afstand = 0) {
    if (!aan) return;
    const v = Math.max(0, 1 - afstand / 260) ** 2;
    if (v < 0.01) return;
    for (const [freq, q, vol] of [[1100, 0.9, 0.16], [480, 1.2, 0.1]]) {
      const src = ctx.createBufferSource(); src.buffer = ruisBuffer(3);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); const t = nu();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol * v, t + 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      src.connect(f); f.connect(g); g.connect(hoofd);
      src.start(t); src.stop(t + 3);
    }
  },

  /*
   Het nieuwsjingletje van Radio Tinga (stap 112, js/nieuws.js): drie oplopende tonen en een lange
   erachteraan, als een tune voor het nieuws.
  */
  nieuwsJingle() {
    if (!aan) return;
    [[523, 0], [659, 0.14], [784, 0.28]].forEach(([f, t]) => toon({ freq: f, duur: 0.16, volume: 0.1, golf: 'triangle', vertraag: t }));
    toon({ freq: 1046, duur: 0.5, volume: 0.09, golf: 'triangle', vertraag: 0.44 });
  },

  /*
   Een feestje in een tuin (stap 113, js/leven.js): elke tel een tik van de beat. Op de tel een lage
   bonk, tussendoor een bastoon en een tikje hihat. Zachter met de afstand, onhoorbaar verder dan
   80 m; `tel` telt de maten zodat de bas loopt.
  */
  feestTik(afstand = 0, tel = 0) {
    if (!aan) return;
    const v = Math.max(0, 1 - afstand / 80) ** 2;
    if (v < 0.01) return;
    toon({ freq: 120, naar: 48, duur: 0.18, volume: 0.22 * v, golf: 'sine' });
    const bas = [55, 55, 65, 49][Math.floor(tel / 2) % 4];
    toon({ freq: bas, duur: 0.22, volume: 0.1 * v, golf: 'triangle', vertraag: 0.25 });
    tik({ freq: 8000, q: 1, duur: 0.04, volume: 0.03 * v, type: 'highpass', vertraag: 0.25 });
  },
  /*
   De brommer van de pizzabezorger (stap 113): een zaagtand van een eencilinder tweetakt door een
   laagdoorlaat, met de toon die met de snelheid meegaat. Eén bron; `null` zet hem uit.
  */
  brommer(afstand, snelheid = 8) {
    if (!aan) return;
    if (!bronnen.brommer) {
      if (afstand == null) return;
      const g = ctx.createGain(); g.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 2;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 90;
      o.connect(f); f.connect(g); g.connect(hoofd); o.start();
      bronnen.brommer = { gain: g, o };
    }
    const b = bronnen.brommer;
    const v = afstand == null ? 0 : Math.max(0, 1 - afstand / 90) ** 2;
    b.gain.gain.setTargetAtTime(v * 0.07, nu(), 0.2);
    b.o.frequency.setTargetAtTime(70 + snelheid * 9, nu(), 0.3);
  },

  sirene(afstand) {
    if (!aan) return;
    const nuT = ctx ? ctx.currentTime : 0;
    if (afstand == null) {
      if (sireneT > nuT) return;            // iemand anders hoort hem nog
    } else if (sireneT > nuT && afstand > sireneD + 0.5) {
      return;                               // er is iets dichterbij aan het gillen
    } else {
      sireneD = afstand; sireneT = nuT + 0.25;
    }
    if (!bronnen.sirene) {
      if (afstand == null) return;
      const g = ctx.createGain(); g.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 1.4;
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 660;
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 330;
      const g2 = ctx.createGain(); g2.gain.value = 0.25;
      o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(hoofd);
      o.start(); o2.start();
      bronnen.sirene = { gain: g, o, o2, volgende: 0, hoog: false };
    }
    const s = bronnen.sirene;
    // hoorbaar tot 140 m, met een kwadratisch verloop
    const v = afstand == null ? 0 : Math.max(0, 1 - afstand / 140) ** 2;
    s.gain.gain.setTargetAtTime(v * 0.22, nu(), 0.15);
    if (v <= 0.001) return;
    const t = nu();
    if (t >= s.volgende) {
      s.hoog = !s.hoog;
      s.volgende = t + 0.62;
      s.o.frequency.setTargetAtTime(s.hoog ? 660 : 550, t, 0.02);
      s.o2.frequency.setTargetAtTime(s.hoog ? 330 : 275, t, 0.02);
    }
  },

  /*
   De roldeur van de wasbox: een elektromotor die aanslaat en de latten die over
   de geleiders ratelen. Een zoemende zaagtand die opkomt en wegzakt, met daar
   overheen een reeks korte tikjes — dat ratelen is wat een roldeur van een
   gewone deur onderscheidt.
  */
  roldeur() {
    toon({ freq: 62, naar: 78, duur: 1.5, volume: 0.07, golf: 'sawtooth' });
    for (let i = 0; i < 14; i++) {
      tik({ freq: 1400 + Math.random() * 900, q: 5, duur: 0.03, volume: 0.035, vertraag: 0.08 + i * 0.1 });
    }
    tik({ freq: 320, q: 2, duur: 0.10, volume: 0.09, vertraag: 1.5 });      // de klap aan het eind
  },

  /*
   De spuitbus in de wasbox: ruis door een smal filter dat heen en weer loopt,
   zoals een spuitpistool dat over een auto zwaait.
  */
  spuitbus() {
    for (let i = 0; i < 5; i++) {
      tik({ freq: 2600 - i * 220, q: 1.1, duur: 0.5, volume: 0.05, type: 'bandpass', val: 0.6, vertraag: i * 0.42 });
    }
  },

  /*
   ---- de buitenboordmotor van de sloep ----
   Een boot klinkt niet als een auto. Er is geen versnellingsbak, dus de toon
   loopt gewoon met het gas mee; daarbovenop hoor je de schroef die het water
   omwoelt en, met vaart, de boeggolf die langs de romp loopt. Dat laatste is
   ruis die met de snelheid opkomt — zonder dat klinkt varen als stilliggen met
   een draaiende motor.

   Elk beeld aanroepen met (gas −1…1, vaart 0…1); `null` zet hem uit.
  */
  bootMotor(gas, vaart = 0) {
    if (!aan) return;
    if (gas == null) {
      const b = bronnen.boot; if (!b) return;
      b.gain.gain.setTargetAtTime(0, nu(), 0.25);
      b.plons.gain.setTargetAtTime(0, nu(), 0.3);
      setTimeout(() => { try { b.o1.stop(); b.o2.stop(); b.ruis.stop(); } catch {} }, 700);
      bronnen.boot = null;
      return;
    }
    if (!bronnen.boot) {
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      o1.type = 'sawtooth'; o2.type = 'triangle';
      o1.frequency.value = 44; o2.frequency.value = 88;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 340; f.Q.value = 1.6;
      const g = ctx.createGain(); g.gain.value = 0;
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(hoofd);
      // het water langs de romp
      const ruis = ctx.createBufferSource();
      ruis.buffer = ruisBuffer(3); ruis.loop = true;
      const pf = ctx.createBiquadFilter(); pf.type = 'bandpass'; pf.frequency.value = 900; pf.Q.value = 0.7;
      const pg = ctx.createGain(); pg.gain.value = 0;
      ruis.connect(pf); pf.connect(pg); pg.connect(hoofd);
      o1.start(); o2.start(); ruis.start();
      bronnen.boot = { o1, o2, filter: f, gain: g, ruis, plons: pg, plonsF: pf };
    }
    const b = bronnen.boot, t = nu();
    const n = 0.3 + Math.abs(gas) * 0.7;            // stationair loopt hij door
    b.o1.frequency.setTargetAtTime(38 + n * 74, t, 0.20);
    b.o2.frequency.setTargetAtTime(76 + n * 150, t, 0.20);
    b.filter.frequency.setTargetAtTime(260 + n * 620, t, 0.25);
    b.gain.gain.setTargetAtTime(0.040 + n * 0.042, t, 0.20);
    b.plons.gain.setTargetAtTime(Math.min(1, vaart) * 0.055, t, 0.30);
    b.plonsF.frequency.setTargetAtTime(700 + Math.min(1, vaart) * 900, t, 0.35);
  },

  /*
   De portofoon van de politie: de melding dat ze je gezien hebben gaat rond.
   Wat je ervan hoort als je dichtbij staat is niet wat er gezegd wordt maar het
   apparaat zelf — een kort ruisje, twee piepjes, en de klik waarmee de
   zendknop weer losgelaten wordt. Geen stem: gesynthetiseerde spraak klinkt
   nergens naar, en dit vertelt hetzelfde.
  */
  portofoon() {
    tik({ freq: 2200, q: 1.2, duur: 0.06, volume: 0.07 });
    toon({ freq: 1500, duur: 0.05, volume: 0.05, vertraag: 0.07 });
    toon({ freq: 1900, duur: 0.05, volume: 0.05, vertraag: 0.14 });
    tik({ freq: 3000, q: 6, duur: 0.03, volume: 0.05, vertraag: 0.24 });
  },

  /*
   ---- de politiehelikopter ----
   Wat je van een heli hoort is niet een motor maar het slaan van de bladen: een
   stoot lucht per blad, vier bladen per omwenteling, een stuk of twintig keer
   per seconde. Dat is hier een lage zaagtand die door een laagdoorlaat gaat
   (het dreunen) met daaroverheen ruis die op datzelfde ritme open- en dichtgaat
   (het klapperen). Hoe verder hij weg is, hoe zachter en hoe doffer — hoge
   tonen halen de afstand niet, en dat is precies waardoor je hoort of hij
   boven je hangt of drie straten verder.

   Wordt elk beeld aangeroepen met de afstand tot de heli; `null` betekent stil.
  */
  heli(afstand) { this.heliBron('heli', afstand, 1); },
  /*
   De heli van Wiebe in missie 18 (stap 127, gevraagd: "Geef de heli luider geluid van de wieken"). Een
   eigen bron naast die van de politieheli: die zet de zijne elk beeld op stil zolang er geen vier sterren
   zijn. `luid` schaalt het volume; in de deur zit je pal onder de bladen.
  */
  heliRond(afstand, luid = HELI_ROND.luid) { this.heliBron('heliRond', afstand, luid); },
  heliBron(sleutel, afstand, luid) {
    if (!aan) return;
    // de opname is binnen gekomen nadat de gemaakte heli al liep: die gaat eruit
    if (bronnen[sleutel] && bronnen[sleutel].gemaakt && opname.heli) {
      const o = bronnen[sleutel]; o.gain.gain.setTargetAtTime(0, nu(), 0.2);
      setTimeout(() => { try { o.gain.disconnect(); } catch { /* al weg */ } }, 1200);
      bronnen[sleutel] = null;
    }
    if (!bronnen[sleutel] && opname.heli) {
      if (afstand == null) return;
      /*
       De opname in een lus (stap 127, "let wel op afstand helicopter"). Hoe verder weg, hoe zachter en
       hoe doffer: een laagdoorlaat van 14 kHz pal eronder naar 500 Hz op 320 m, net als bij de gemaakte heli.
      */
      const src = ctx.createBufferSource(); src.buffer = opname.heli; src.loop = true;
      src.loopStart = 0.05; src.loopEnd = opname.heli.duration - 0.05;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2000; f.Q.value = 0.5;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(hoofd);
      src.start(0, Math.random() * opname.heli.duration * 0.8);
      bronnen[sleutel] = { gain: g, filter: f, src, opname: true };
    }
    if (bronnen[sleutel] && bronnen[sleutel].opname) {
      const h = bronnen[sleutel], t = nu();
      const v = afstand == null ? 0 : Math.max(0, 1 - afstand / 320) ** 1.6;
      h.gain.gain.setTargetAtTime(Math.min(1.4, v * 0.55 * luid), t, 0.35);
      h.filter.frequency.setTargetAtTime(500 + v * v * 13500, t, 0.5);
      return;
    }
    if (!bronnen[sleutel]) {
      if (afstand == null) return;
      const g = ctx.createGain(); g.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 300; f.Q.value = 0.8;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 21;
      // het klapperen: ruis die door dezelfde slagfrequentie gestuurd wordt
      const ruis = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      ruis.buffer = buf; ruis.loop = true;
      const rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 520; rf.Q.value = 1.1;
      const rg = ctx.createGain(); rg.gain.value = 0.0;
      const slag = ctx.createOscillator(); slag.type = 'square'; slag.frequency.value = 21;
      const slagG = ctx.createGain(); slagG.gain.value = 0.5;
      slag.connect(slagG); slagG.connect(rg.gain);
      ruis.connect(rf); rf.connect(rg); rg.connect(g);
      o.connect(f); f.connect(g); g.connect(hoofd);
      o.start(); ruis.start(); slag.start();
      bronnen[sleutel] = { gain: g, filter: f, ruisGain: rg, gemaakt: true };
    }
    const h = bronnen[sleutel];
    // hoorbaar tot 320 m — een heli hoor je veel verder dan een sirene
    const v = afstand == null ? 0 : Math.max(0, 1 - afstand / 320) ** 1.6;
    const t = nu();
    h.gain.gain.setTargetAtTime(v * 0.20 * luid, t, 0.35);
    h.ruisGain.gain.setTargetAtTime(v * 0.16 * luid, t, 0.35);
    // dichtbij hoor je het klapperen, ver weg alleen het dreunen
    h.filter.frequency.setTargetAtTime(180 + v * 900, t, 0.5);
  },
  heliRondStand() { const h = bronnen.heliRond; return h ? { volume: +h.gain.gain.value.toFixed(3), opname: !!h.opname } : null; },
  heliStand() { const h = bronnen.heli; return h ? { volume: +h.gain.gain.value.toFixed(3), opname: !!h.opname, filter: Math.round(h.filter.frequency.value) } : null; },

  /*
   De portofoon van de politie (stap 127): bij de eerste ster een willekeurig stuk van de opname, kort aan
   en kort weg. `forceer` slaat de rust over (voor de proef).
  */
  politieRadio({ forceer = false } = {}) {
    if (!aan || !opname.politieRadio) return false;
    const t = nu();
    if (!forceer && t - politieRadioT < POLITIE_RADIO.rust) return false;
    politieRadioT = t;
    const B = opname.politieRadio, P = POLITIE_RADIO;
    const duur = Math.min(B.duration - 0.5, P.duur[0] + Math.random() * (P.duur[1] - P.duur[0]));
    const begin = Math.random() * Math.max(0, B.duration - duur);
    const src = ctx.createBufferSource(); src.buffer = B;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(P.vol, t + P.in);
    g.gain.setValueAtTime(P.vol, t + duur - P.uit);
    g.gain.linearRampToValueAtTime(0, t + duur);
    src.connect(g); g.connect(hoofd);
    src.start(t, begin, duur + 0.05);
    politieRadioTeller++;
    this.laatsteRadio = { begin: +begin.toFixed(2), duur: +duur.toFixed(2), in: P.in, uit: P.uit };
    return true;
  },
  get politieRadioTeller() { return politieRadioTeller; },
  get explosieTeller() { return explosieTeller; },

  /*
   ---- de drone (stap 124) ----
   Vier kleine propellers op hoge toeren: een zoemende zaagtand rond de 180 Hz met de
   boventonen erbij, en ruis eromheen. `afstand` is hoe ver de drone van Erik is, want
   jij staat daar met de afstandsbediening: hoe verder weg, hoe zachter. Vol gas (`toeren`
   tot 1) gaat de toon omhoog. `null` is uit.
  */
  drone(afstand, toeren = 0) {
    if (!aan) return;
    if (!bronnen.drone) {
      if (afstand == null) return;
      const g = ctx.createGain(); g.gain.value = 0;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2400; f.Q.value = 0.7;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 180;
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 187;
      const r = ruisLaag('bandpass', 1500, 0.8, 0);
      r.gain.disconnect(); r.gain.connect(g);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(hoofd);
      o.start(); o2.start();
      bronnen.drone = { gain: g, filter: f, o, o2, ruis: r };
    }
    const d = bronnen.drone, t = nu();
    // dichtbij goed te horen, op 800 m nog een vleugje: je weet dat hij er is
    const v = afstand == null ? 0 : 0.15 + 0.85 * Math.max(0, 1 - afstand / 300) ** 1.4;
    d.gain.gain.setTargetAtTime(afstand == null ? 0 : v * 0.05, t, 0.15);
    d.ruis.gain.gain.setTargetAtTime(afstand == null ? 0 : v * 0.03, t, 0.15);
    const hz = 175 + toeren * 70;
    d.o.frequency.setTargetAtTime(hz, t, 0.2);
    d.o2.frequency.setTargetAtTime(hz * 1.04, t, 0.2);
    d.filter.frequency.setTargetAtTime(900 + v * 1800, t, 0.3);
  },
  /*
   De vuilniswagen die een kliko leegt (stap 124): het sissen van de hydrauliek, het bonken van de bak
   tegen de rand en twee piepjes van de lift. Zachter op afstand.
  */
  kliko(afstand = 20) {
    if (!aan) return;
    const v = Math.max(0, 1 - afstand / 90) ** 1.3;
    if (v < 0.03) return;
    tik({ freq: 2600, q: 0.6, duur: 1.1, volume: 0.05 * v, type: 'highpass', val: 0.5 });
    for (const t of [0.9, 1.3]) tik({ freq: 140, q: 1.2, duur: 0.25, volume: 0.22 * v, val: 0.8, vertraag: t });
    for (const t of [0, 0.35]) toon({ freq: 1250, duur: 0.12, volume: 0.03 * v, golf: 'square', vertraag: 2.2 + t });
  },
  get droneVolume() { return bronnen.drone ? bronnen.drone.gain.gain.value : 0; },
  get krekelVolume() { return bronnen.krekel ? bronnen.krekel.gain.gain.value : 0; },

  /*
   Een auto die langsrijdt (verzoek 20 sep 2026: "kan je ook auto geluid
   toevoegen als ze langskomen"). Wat je hoort is niet de motor maar de banden
   op het asfalt: een ruisstoot door een filter dat van hoog naar laag zakt,
   precies zoals een auto die eerst naar je toe komt en dan weer weg rijdt —
   het dopplereffect dus, nagebouwd met de filterfrequentie in plaats van met
   een toonhoogte. Er zit een lage rommel onder voor het gewicht.

   `afstand` in meters, `snelheid` in meter per seconde: een auto die stapvoets
   voorbijkomt hoor je nauwelijks, een auto op de rondweg wel.
  */
  passeer(afstand = 12, snelheid = 10) {
    if (!aan) return;
    const dicht = Math.max(0, 1 - afstand / 26);
    const vaart = Math.max(0.25, Math.min(1.4, snelheid / 12));
    const vol = 0.085 * dicht * dicht * vaart;
    if (vol < 0.004) return;
    // de banden: ruis die van 1100 naar 260 Hz wegzakt
    tik({ freq: 1100 * vaart, q: 0.7, duur: 0.85, volume: vol, type: 'bandpass', val: 0.24 });
    // en het gewicht eronder
    toon({ freq: 150 * vaart, naar: 72, duur: 0.9, volume: vol * 0.5, golf: 'sawtooth' });
  },

  /*
   Piepende banden van een auto die vol op de rem gaat. Anders dan `gier`
   hierboven is dit een losse knal van een seconde en geen doorlopende bron:
   `gier` hangt aan de auto waar jij in zit en wordt elk beeld op nul gezet
   zodra je te voet bent (js/main.js). De drie auto's die in missie 7 komen
   aanrijden remmen terwijl jij ernaast staat, en die moeten wél te horen zijn.

   Ruis door een smalle band die van 1,5 kHz naar 700 Hz zakt is het rubber; de
   zaagtand erboven, die mee omlaag glijdt, is de piep.
  */
  piependeBanden(afstand = 0, duur = 0.9) {
    if (!aan) return;
    const v = Math.max(0.08, 1 - afstand / 60);
    const t = nu();
    const src = ctx.createBufferSource();
    src.buffer = ruisBuffer(2);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 6;
    f.frequency.setValueAtTime(1500, t);
    f.frequency.exponentialRampToValueAtTime(700, t + duur);
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(820, t);
    o.frequency.exponentialRampToValueAtTime(430, t + duur);
    const og = ctx.createGain(); og.gain.value = 0.05;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.16 * v, t + 0.08);
    g.gain.setTargetAtTime(0, t + duur * 0.55, 0.18);
    src.connect(f); o.connect(og); og.connect(f); f.connect(g); g.connect(hoofd);
    src.start(t); o.start(t);
    src.stop(t + duur + 0.4); o.stop(t + duur + 0.4);
  },

  /*
   Iets zwaars neerzetten: de tas met explosieven die op de winkelvloer gaat
   (js/verhaal.js, missie 7). Een doffe bonk met een riempje eroverheen.
  */
  neerzetten(afstand = 0) {
    if (!aan) return;
    const v = Math.max(0.15, 1 - afstand / 30);
    tik({ freq: 190, q: 1.1, duur: 0.13, volume: 0.42 * v, type: 'lowpass', val: 0.4 });
    tik({ freq: 1500, q: 1.6, duur: 0.05, volume: 0.14 * v, type: 'bandpass', val: 0.5, vertraag: 0.05 });
  },

  /*
   De claxon. Twee tonen tegelijk (een kleine terts uit elkaar) geeft de scherpe
   klank van een echte toeter; één toon klinkt als een pieper. Twee korte stoten
   met een gaatje ertussen, want zo toetert iemand die geïrriteerd is.
  */
  claxon(afstand = 6) {
    if (!aan) return;
    const dicht = Math.max(0.12, 1 - afstand / 30);
    const vol = 0.12 * dicht;
    for (const vertraag of [0, 0.26]) {
      for (const f of [420, 520]) {
        toon({ freq: f, duur: vertraag ? 0.16 : 0.22, volume: vol, golf: 'square', vertraag });
      }
    }
  },

  /*
   De achtergrond (stap 127): twee opnames van de gebruiker in plaats van het gemaakte verkeersgeruis. Overdag
   de lange, 's nachts de korte; ze vloeien in ACHTERGROND.wissel tellen in elkaar over. Binnen zachter en doffer.
   Twee streamende elementen (de lange is bijna zeven minuten: als buffer zou dat 140 MB zijn). Levert true
   zolang er een speelt.
  */
  achtergrond(nacht, binnen) {
    if (!aan || !ctx) return false;
    if (!bronnen.bed) {
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 18000;
      filter.connect(hoofd);
      const maak = (k) => {
        const el = new Audio(); el.crossOrigin = 'anonymous'; el.preload = 'auto'; el.loop = true; el.src = ACHTERGROND[k].url;
        const g = ctx.createGain(); g.gain.value = 0;
        const b = { el, gain: g, stuk: false, aan: false };
        try { ctx.createMediaElementSource(el).connect(g); g.connect(filter); } catch { b.stuk = true; }
        el.addEventListener('error', () => { b.stuk = true; });
        return b;
      };
      bronnen.bed = { dagB: maak('dag'), nachtB: maak('nacht'), filter };
    }
    const B = bronnen.bed, t = nu();
    let speelt = false;
    for (const [k, b] of [['dag', B.dagB], ['nacht', B.nachtB]]) {
      if (b.stuk) continue;
      const wil = (k === 'nacht') === !!nacht;
      const vol = wil && !gepauzeerd ? ACHTERGROND[k].vol * (binnen ? ACHTERGROND.binnen : 1) : 0;
      b.gain.gain.setTargetAtTime(vol, t, ACHTERGROND.wissel / 3);
      if (wil && !b.aan) { b.aan = true; b.el.play().catch(() => {}); }
      // de andere pas stilzetten als hij is uitgedoofd
      if (!wil && b.aan && b.gain.gain.value < 0.003) { b.aan = false; b.el.pause(); }
      if (wil && !b.el.paused) speelt = true;
    }
    B.filter.frequency.setTargetAtTime(binnen ? 900 : 18000, t, 0.8);
    return speelt;
  },
  achtergrondStand() {
    const B = bronnen.bed;
    if (!B) return null;
    const st = b => ({ aan: b.aan, speelt: !b.el.paused, stuk: b.stuk, volume: +b.gain.gain.value.toFixed(3), bestand: b.el.src.split('/').pop() });
    return { dag: st(B.dagB), nacht: st(B.nachtB), filter: Math.round(B.filter.frequency.value) };
  },

  // ---------- omgeving per beeld ----------
  omgeving(dt, { weer = 'helder', nacht = false, wind = 0.2, binnen = false,
    water = 0, molen = 0 } = {}) {
    if (!aan) return;
    const t = nu();
    /*
     Binnen klinkt het anders. De galmtak komt op, het verkeersgeruis van buiten
     zakt weg én wordt doffer — een muur laat de hoge tonen niet door. Buiten
     staat er een vleugje galm op: een straat met gevels aan twee kanten kaatst
     wel degelijk iets terug, en helemaal droog klinkt als een oefenruimte.
    */
    if (galm) galm.gain.setTargetAtTime(binnen ? 0.22 : 0.05, t, 0.8);
    bronnen.verkeer.filter.frequency.setTargetAtTime(binnen ? 110 : 180, t, 1.5);
    // wind zwelt aan bij slecht weer
    /*
     Iets luider dan het was. Na het introfilmpje — dat op 0,85 speelt — viel de
     buurt in het niet: "ik mis na de intro wat ambient geluid, hoor de vogels
     niet meer" (20 sep 2026). De wind en het verkeersgeruis staan nu een
     kwart hoger en de vogels komen vaker langs; het blijft achtergrond, maar je
     hoort dat er een wijk om je heen ligt.
    */
    const w = weer === 'regen' ? 0.068 : weer === 'bewolkt' ? 0.040 : 0.026;
    bronnen.wind.gain.gain.setTargetAtTime(binnen ? w * 0.35 : w, t, 1.2);
    bronnen.wind.filter.frequency.setTargetAtTime(weer === 'regen' ? 700 : 420, t, 2.0);
    bronnen.regen.gain.gain.setTargetAtTime(weer === 'regen' ? (binnen ? 0.030 : 0.085) : 0, t, 1.0);
    // (stap 127: met de opnames van de achtergrond erbij zwijgt het gemaakte verkeersgeruis en komen de vogeltjes minder vaak)
    const bed = this.achtergrond(nacht, binnen);
    bronnen.verkeer.gain.gain.setTargetAtTime(bed ? 0 : nacht ? 0.006 : 0.017, t, 2.0);

    /*
     De buurt laten horen dat hij er is. Hier stond één mussengeluidje op een
     klok van tweeënhalf tot negenenhalve seconde, en verder niets: acht
     minuten lang steeds datzelfde vogeltje (punt 8 van 13 sep 2026). Nu is er
     een handvol geluiden die bij de wijk en bij het moment horen — zie
     `sfeerGeluid` hieronder — met per keer een andere keuze en een andere
     tussenpoos.
    */
    if (weer !== 'regen') {
      vogelKlok -= dt;
      if (vogelKlok <= 0) {
        vogelKlok = (2.6 + Math.random() * 6.5) * (bed ? 3 : 1);
        this.sfeerGeluid(kiesSfeer(nacht, binnen));
      }
    }
    /*
     Het water. `water` is nul tot één: hoe dichter je bij bevaarbaar water
     staat, hoe luider het klotst. Vaar je zelf, dan hoor je het van dichtbij —
     daar zorgt js/main.js voor door de afstand nul te maken zodra je in een
     boot zit.
    */
    const kl = Math.max(0, Math.min(1, water));
    bronnen.water.gain.gain.setTargetAtTime(binnen ? 0 : kl * 0.045, t, 1.0);
    /*
     Krekels (stap 124). Een doorlopende laag: hoge ruis rond 4,6 kHz die door een blokgolf van
     zeventien tellen per seconde open- en dichtgaat (het tsjirpen), en die zelf weer op een trage
     golf van een halve seconde aan- en uitgaat. Alleen 's nachts, buiten en droog.
    */
    if (!bronnen.krekel) {
      const k = ruisLaag('bandpass', 4600, 9, 0);
      const puls = ctx.createOscillator(); puls.type = 'square'; puls.frequency.value = 17;
      const pg = ctx.createGain(); pg.gain.value = 0.5;
      const mod = ctx.createGain(); mod.gain.value = 0.5;
      k.src.disconnect(); k.src.connect(k.filter); k.filter.disconnect(); k.filter.connect(mod); mod.connect(k.gain);
      puls.connect(pg); pg.connect(mod.gain); puls.start();
      bronnen.krekel = k;
    }
    this.krekelSterkte = (nacht && !binnen && weer !== 'regen') ? 0.030 : 0;
    bronnen.krekel.gain.gain.setTargetAtTime(this.krekelSterkte, t, 2.5);
    bronnen.water.filter.frequency.setTargetAtTime(600 + kl * 260, t, 1.5);
    /*
     En de molen. Sta je onder houtzaagmolen De Rat terwijl de wieken draaien,
     dan hoor je hout kraken en de as knarsen — op onregelmatige tussenpozen,
     want een molen tikt geen maat.
    */
    if (molen > 0.05 && !binnen) {
      molenKlok -= dt;
      if (molenKlok <= 0) {
        molenKlok = 1.4 + Math.random() * 2.6;
        const v = Math.min(1, molen);
        tik({ freq: 220 + Math.random() * 90, q: 2.2, duur: 0.22, volume: 0.05 * v,
          type: 'bandpass', val: 0.5 });
        toon({ freq: 90 + Math.random() * 30, naar: 62, duur: 0.5, volume: 0.035 * v,
          golf: 'triangle', vertraag: 0.06 });
      }
    }
    // krekels blijven wat ze waren: een doorlopend tapijt 's nachts, geen los geluid
    if (nacht && weer !== 'regen') {
      krekelKlok -= dt;
      if (krekelKlok <= 0) {
        krekelKlok = 0.5 + Math.random() * 0.9;
        for (let i = 0; i < 4; i++) toon({ freq: 4300, duur: 0.02, volume: 0.012, golf: 'triangle', vertraag: i * 0.045 });
      }
    }
  },

  /*
   Eén los omgevingsgeluid, met de naam erbij zodat de proef kan kijken of er
   genoeg verschillende langskomen. Alles is hier gemaakt en niet opgenomen: een
   meeuw is een zaagtand met een knik erin, een kraai een ruisstoot door een
   smal filter, een brommer een lage zaagtand die aanzwelt en weer wegzakt.
  */
  sfeerGeluid(naam) {
    if (!aan) return null;
    laatsteSfeer = naam;
    const r = Math.random();
    switch (naam) {
      case 'mus': {                       // het oude geluidje: kort en druk
        const f = 2200 + r * 2200;
        for (let i = 0, n = 2 + Math.floor(Math.random() * 3); i < n; i++) {
          toon({ freq: f * (0.9 + Math.random() * 0.3), naar: f * (0.6 + Math.random() * 0.7),
                 duur: 0.07 + Math.random() * 0.06, volume: 0.034 + Math.random() * 0.03,
                 vertraag: i * (0.09 + Math.random() * 0.07) });
        }
        break;
      }
      case 'merel': {                     // een fluitend zinnetje van vier tonen
        let t = 0;
        for (let i = 0; i < 4 + Math.floor(r * 3); i++) {
          const f = 1500 + Math.random() * 1100;
          toon({ freq: f, naar: f * (0.7 + Math.random() * 0.6), duur: 0.16 + Math.random() * 0.12,
                 volume: 0.027 + Math.random() * 0.018, vertraag: t });
          t += 0.20 + Math.random() * 0.16;
        }
        break;
      }
      case 'meeuw': {                     // Sneek ligt aan het water
        for (let i = 0, n = 3 + Math.floor(r * 3); i < n; i++) {
          const f = 900 + Math.random() * 260;
          toon({ freq: f * 0.8, naar: f * 1.35, duur: 0.10, volume: 0.018, golf: 'sawtooth', vertraag: i * 0.34 });
          toon({ freq: f * 1.3, naar: f * 0.7, duur: 0.18, volume: 0.014, golf: 'sawtooth', vertraag: i * 0.34 + 0.10 });
        }
        break;
      }
      case 'kraai': {
        for (let i = 0, n = 2 + Math.floor(r * 2); i < n; i++) {
          tik({ freq: 780 + Math.random() * 260, q: 5, duur: 0.22, volume: 0.055, val: 0.7, vertraag: i * 0.42 });
        }
        break;
      }
      case 'duif': {                      // houtduif: vijf lage koeroe-tonen
        const f = 430 + r * 60;
        for (const [v, d, k] of [[0, 0.22, 1], [0.26, 0.30, 1.12], [0.60, 0.16, 1], [0.80, 0.18, 0.94], [1.02, 0.26, 0.92]]) {
          toon({ freq: f * k, naar: f * k * 0.94, duur: d, volume: 0.020, vertraag: v });
        }
        break;
      }
      case 'hond': {                      // een blaffende hond in een achtertuin
        for (let i = 0, n = 2 + Math.floor(r * 3); i < n; i++) {
          const v = i * (0.30 + Math.random() * 0.18);
          toon({ freq: 280 + Math.random() * 90, naar: 150, duur: 0.13, volume: 0.030, golf: 'sawtooth', vertraag: v });
          tik({ freq: 1100, q: 1.2, duur: 0.10, volume: 0.030, val: 0.4, vertraag: v });
        }
        break;
      }
      case 'brommer': {                   // eentje die een straat verderop langsrijdt
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth';
        f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = 0.8;
        const t = nu(), duur = 4.5 + r * 2.5, basis = 92 + r * 40;
        o.frequency.setValueAtTime(basis * 1.06, t);
        o.frequency.linearRampToValueAtTime(basis * 1.28, t + duur * 0.45);   // komt eraan
        o.frequency.linearRampToValueAtTime(basis * 0.92, t + duur);          // en weer weg
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.020, t + duur * 0.45);
        g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
        o.connect(f); f.connect(g); g.connect(hoofd);
        o.start(t); o.stop(t + duur + 0.05);
        break;
      }
      case 'eend': {                      // stap 124: een wilde eend in de sloot, kwak-kwak
        for (let i = 0, n = 2 + Math.floor(r * 3); i < n; i++) {
          tik({ freq: 620 + Math.random() * 120, q: 4, duur: 0.16, volume: 0.05, val: 0.6, vertraag: i * 0.24 });
          toon({ freq: 330, naar: 260, duur: 0.14, volume: 0.012, golf: 'sawtooth', vertraag: i * 0.24 });
        }
        break;
      }
      case 'kikker': {                    // stap 124: een kikker langs de Geeuw, 's nachts
        for (let i = 0, n = 3 + Math.floor(r * 4); i < n; i++) {
          toon({ freq: 210 + r * 40, naar: 180, duur: 0.09, volume: 0.02, golf: 'square', vertraag: i * 0.16 });
        }
        break;
      }
      case 'uil': {                       // 's nachts: twee lage hoe-tonen
        for (const v of [0, 0.9]) toon({ freq: 400, naar: 370, duur: 0.42, volume: 0.022, vertraag: v });
        break;
      }
      case 'klok': {                      // de torenklok van de Martinikerk, ver weg
        for (let i = 0, n = 1 + Math.floor(r * 2); i < n; i++) {
          const v = i * 2.2;
          toon({ freq: 262, naar: 258, duur: 1.8, volume: 0.022, vertraag: v });
          toon({ freq: 525, naar: 516, duur: 1.2, volume: 0.011, vertraag: v });
          toon({ freq: 786, naar: 772, duur: 0.7, volume: 0.006, vertraag: v });
        }
        break;
      }
      default: laatsteSfeer = null; return null;
    }
    return naam;
  },

  // welke er het laatst klonk (voor tools/sfeergeluidtest.mjs)
  get laatsteSfeer() { return laatsteSfeer; },
  get sfeerSoorten() { return [...SFEER_DAG, ...SFEER_NACHT].filter((v, i, a) => a.indexOf(v) === i); },
};

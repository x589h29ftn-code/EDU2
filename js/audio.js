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
let radioLijst = [];         // de nummers uit audio/radio/nummers.json
let lijstGeladen = false;
let vogelKlok = 0, krekelKlok = 0;

function nu() { return ctx ? ctx.currentTime : 0; }

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
    aan = true;

    // grondtoon: wind door de bomen
    bronnen.wind = ruisLaag('lowpass', 420, 0.7, 0.020);
    // verkeersgeruis van de N7 in de verte
    bronnen.verkeer = ruisLaag('bandpass', 180, 0.9, 0.012);
    // regen staat klaar maar begint op nul
    bronnen.regen = ruisLaag('highpass', 1300, 0.5, 0.0);
    window.__geluid = true;
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
  schot() {
    if (!aan) return;
    const v = 0.92 + Math.random() * 0.16;
    const t0 = nu();

    // 1. de knal zelf: heel korte, brede ruisstoot
    {
      const src = ctx.createBufferSource(); src.buffer = ruisBuffer(0.1);
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 320;
      const piek = ctx.createBiquadFilter(); piek.type = 'peaking';
      piek.frequency.value = 3200 * v; piek.Q.value = 0.9; piek.gain.value = 9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.85, t0);
      g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
      src.connect(hp); hp.connect(piek); piek.connect(g); g.connect(hoofd);
      src.start(t0); src.stop(t0 + 0.08);
    }

    // 2. de klap van het gas
    tik({ freq: 420 * v, q: 0.6, duur: 0.09, volume: 0.42, type: 'lowpass', val: 0.35 });
    toon({ freq: 180 * v, naar: 50, duur: 0.16, volume: 0.20, golf: 'sine' });

    // 3. de straat kaatst hem terug: drie keer zachter en doffer
    const echos = [[0.038, 0.30, 5200], [0.074, 0.16, 3000], [0.130, 0.08, 1800]];
    for (const [na, vol, top] of echos) {
      tik({ freq: top * v, q: 0.5, duur: 0.05, volume: vol, type: 'lowpass', val: 0.5,
        vertraag: na + Math.random() * 0.006 });
    }

    // 4. naijl tussen de huizen
    tik({ freq: 900, q: 0.7, duur: 0.55, volume: 0.075, type: 'bandpass', val: 0.35, vertraag: 0.06 });

    // de huls: een klein metalig tikje op de grond
    setTimeout(() => { toon({ freq: 3200, naar: 2100, duur: 0.07, volume: 0.05 }); }, 260);
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

  klap() {   // blik: auto geraakt
    tik({ freq: 1200, q: 1.1, duur: 0.16, volume: 0.3, val: 0.2 });
    toon({ freq: 320, naar: 180, duur: 0.2, volume: 0.12, golf: 'triangle' });
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
  explosie() {
    if (!aan) return;
    tik({ freq: 2200, q: 0.4, duur: 0.06, volume: 0.5, type: 'highpass', val: 0.15 });
    tik({ freq: 240, q: 0.6, duur: 0.55, volume: 0.5, type: 'lowpass', val: 0.25 });
    toon({ freq: 90, naar: 28, duur: 0.65, volume: 0.30, golf: 'sine' });
    tik({ freq: 420, q: 0.5, duur: 1.6, volume: 0.22, type: 'lowpass', val: 0.35, vertraag: 0.05 });
    for (let i = 0; i < 7; i++) {
      tik({ freq: 2600 + Math.random() * 4000, q: 3, duur: 0.05, volume: 0.07,
            vertraag: 0.12 + Math.random() * 0.5 });
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
      gier: bronnen.gier ? +bronnen.gier.gain.gain.value.toFixed(4) : null,
      muziek: bronnen.muziek ? +bronnen.muziek.gain.gain.value.toFixed(4) : null,
    };
  },

  pauzeer(v) {
    gepauzeerd = !!v;
    if (hoofd) hoofd.gain.setTargetAtTime(gedempt || gepauzeerd ? 0 : 0.55, nu(), 0.08);
    const m = bronnen.muziek;
    if (m && m.el) { if (gepauzeerd) m.el.pause(); else if (m.aan) m.el.play().catch(() => {}); }
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
  async laadRadio(pad = 'audio/radio/nummers.json') {
    if (lijstGeladen) return radioLijst;
    lijstGeladen = true;
    try {
      const r = await fetch(pad, { cache: 'force-cache' });
      if (!r.ok) return radioLijst;
      const j = await r.json();
      radioLijst = (j.nummers || []).filter(n => n && n.bestand)
        .map(n => ({ ...n, url: pad.replace(/[^/]*$/, '') + n.bestand }));
    } catch { /* geen lijst: het riffje blijft */ }
    return radioLijst;
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
      duur: isFinite(m.el.duration) ? +m.el.duration.toFixed(0) : null };
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
  muziek(actief) {
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
    const doel = actief ? (bronnen.jacht && bronnen.jacht.actief ? 0.08 : 0.32) : 0;
    m.gain.gain.setTargetAtTime(doel, nu(), actief ? 0.5 : 0.35);
    if (actief) {
      if (!m.nummer) {
        m.nummer = radioLijst[m.beurt % radioLijst.length];
        m.beurt++;
        m.el.src = m.nummer.url;
        // niet elke keer bij nul beginnen: een radio speelt door terwijl je loopt
        m.el.currentTime = 0;
      }
      if (m.el.paused) m.el.play().catch(() => { m.stuk = true; });
    } else if (!m.el.paused) {
      m.el.pause();
    }
    return true;
  },

  /*
   De autoradio. Een rockdeuntje uit de speakers in het portier: een vervormde
   gitaarriff op de kwint (E-mineur), een bas eronder en een simpel drumstel.
   Alles gaat door een smalle band met een lowpass erachter, zodat het klinkt
   als een autoradio en niet als een concert, en het staat zacht genoeg om
   eronder de motor te blijven horen. Tijdens het jachtdeuntje van het verhaal
   zakt hij nog verder weg.

   Wordt elk beeld aangeroepen met `true` zolang je in de auto zit.
  */
  autoradio(actief) {
    if (!aan) return;
    // Staat er muziek in audio/radio/, dan speelt die; het riffje hieronder is
    // de terugval als dat niet lukt.
    if (this.muziek(actief)) {
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
    // achtergrondniveau; onder het jachtdeuntje uit het verhaal nog zachter
    const doel = actief ? (bronnen.jacht && bronnen.jacht.actief ? 0.07 : 0.20) : 0;
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
    const v = afstand == null ? 0 : Math.max(0, 1 - afstand / 35) ** 2;
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
  sirene(afstand) {
    if (!aan) return;
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

  // ---------- omgeving per beeld ----------
  omgeving(dt, { weer = 'helder', nacht = false, wind = 0.2, binnen = false } = {}) {
    if (!aan) return;
    const t = nu();
    // wind zwelt aan bij slecht weer
    const w = weer === 'regen' ? 0.055 : weer === 'bewolkt' ? 0.032 : 0.020;
    bronnen.wind.gain.gain.setTargetAtTime(binnen ? w * 0.35 : w, t, 1.2);
    bronnen.wind.filter.frequency.setTargetAtTime(weer === 'regen' ? 700 : 420, t, 2.0);
    bronnen.regen.gain.gain.setTargetAtTime(weer === 'regen' ? (binnen ? 0.030 : 0.085) : 0, t, 1.0);
    bronnen.verkeer.gain.gain.setTargetAtTime(nacht ? 0.004 : 0.012, t, 2.0);

    // vogels overdag, krekels 's avonds
    if (!nacht && weer !== 'regen') {
      vogelKlok -= dt;
      if (vogelKlok <= 0) {
        vogelKlok = 2.5 + Math.random() * 7;
        const f = 2200 + Math.random() * 2200;
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          toon({ freq: f * (0.9 + Math.random() * 0.3), naar: f * (0.6 + Math.random() * 0.7),
                 duur: 0.07 + Math.random() * 0.06, volume: 0.020 + Math.random() * 0.02,
                 vertraag: i * (0.09 + Math.random() * 0.07) });
        }
      }
    } else if (nacht && weer !== 'regen') {
      krekelKlok -= dt;
      if (krekelKlok <= 0) {
        krekelKlok = 0.5 + Math.random() * 0.9;
        for (let i = 0; i < 4; i++) toon({ freq: 4300, duur: 0.02, volume: 0.012, golf: 'triangle', vertraag: i * 0.045 });
      }
    }
  },
};

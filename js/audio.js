// Geluid, volledig gesynthetiseerd met de Web Audio API. Er zijn geen
// geluidsbestanden: alles wordt uit ruis en oscillatoren opgebouwd. Dat scheelt
// downloads en werkt ook waar externe bestanden geblokkeerd zijn.
//
// Wat er te horen is:
//   - een grondtoon van wind, die aanzwelt bij slecht weer
//   - vogels overdag, krekels 's avonds
//   - regen als geruis, harder naarmate je buiten staat
//   - voetstappen die verschillen op klinkers, tegels en gras
//   - een motor in de auto waarvan de toonhoogte met de snelheid meeloopt
//   - schoten, herladen, portieren en verkeer in de verte
//
// De browser staat pas geluid toe na een klik of toets, dus alles start bij de
// eerste invoer van de speler. Met U zet je het geluid uit en weer aan.

let ctx = null;
let hoofd = null;      // eindvolume
let aan = false;
let gedempt = false;

const bronnen = {};    // langlopende lagen
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

// korte klap uit ruis: voetstap, schot, portier
function tik({ freq = 900, q = 1, duur = 0.12, volume = 0.3, type = 'bandpass', val = 0.9 }) {
  if (!aan) return;
  const src = ctx.createBufferSource();
  src.buffer = ruisBuffer(0.3);
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  const t = nu();
  g.gain.setValueAtTime(volume, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duur);
  f.frequency.exponentialRampToValueAtTime(Math.max(60, freq * val), t + duur);
  src.connect(f); f.connect(g); g.connect(hoofd);
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
    if (hoofd) hoofd.gain.setTargetAtTime(v ? 0 : 0.55, nu(), 0.15);
  },

  schot() {
    tik({ freq: 1800, q: 0.6, duur: 0.09, volume: 0.55, val: 0.08 });
    tik({ freq: 260, q: 1.2, duur: 0.28, volume: 0.35, val: 0.25 });
    toon({ freq: 140, naar: 50, duur: 0.22, volume: 0.18, golf: 'square' });
  },

  herladen() {
    tik({ freq: 2600, q: 3, duur: 0.05, volume: 0.16 });
    tik({ freq: 1500, q: 4, duur: 0.06, volume: 0.14, vertraag: 0.18 });
    setTimeout(() => tik({ freq: 900, q: 5, duur: 0.07, volume: 0.18 }), 380);
    setTimeout(() => tik({ freq: 2200, q: 4, duur: 0.05, volume: 0.14 }), 900);
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

  klap() {   // blik: auto geraakt
    tik({ freq: 1200, q: 1.1, duur: 0.16, volume: 0.3, val: 0.2 });
    toon({ freq: 320, naar: 180, duur: 0.2, volume: 0.12, golf: 'triangle' });
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

  motorToeren(snelheid) {
    const m = bronnen.motor; if (!m) return;
    const s = Math.min(1, Math.abs(snelheid) / 22);
    m.o1.frequency.setTargetAtTime(48 + s * 150, nu(), 0.1);
    m.o2.frequency.setTargetAtTime(24 + s * 75, nu(), 0.1);
    m.filter.frequency.setTargetAtTime(380 + s * 1400, nu(), 0.15);
    m.gain.gain.setTargetAtTime(0.06 + s * 0.06, nu(), 0.2);
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

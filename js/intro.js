/*
 De intro: een filmpje van ruim een minuut voordat het spel begint, met muziek.

 Wat je ziet (verzoek 20 sep 2026, uitgebreid op de tweede ronde): een reeks
 rustige beelden langs de plekken die de wijk en de omgeving maken — de
 Molenkrite, de Jumbo, het Tinga-bosje, het Viaduct Tinga, de waterzuivering, de Geeuw,
 houtzaagmolen De Rat aan het Sneekerpad en de Poiesz in IJlst — en dan een
 daling naar precies het standpunt waar je het spel begint. Over het beeld heen
 de titels:

   RED EAGLE PRODUCTIONS   →   presents   →   GTA VI / TINGA

 **Geen enkele coördinaat staat hier hard in.** Elke plek wordt opgezocht in de
 kaart: een pand op zijn type (`poiesz`, `jumbo`), de molen in `KAART.molens`,
 een straat op zijn naam in `KAART.wegassen`, het viaduct in `KAART.viaducten`,
 en het bos en het water
 als het grootste vlak van die klasse in de buurt van waar we willen kijken. Als
 de kaart opnieuw gegenereerd wordt klopt het filmpje dus nog steeds.

 Hoogte en clipping. Alles wat van boven gefilmd wordt zit op minstens dertig
 meter — hoger dan de bomen (18 m), de molen (20,7 m) en de hoogste flat van de
 kaart (26 m) — zodat de camera nergens door een dak of een kruin heen zakt. De
 drie lage beelden (de straat, het viaduct en de Poiesz) liggen op de rijbaan en
 op het parkeerterrein, waar niets staat: bij het viaduct vliegt de camera over
 de rondweg eronder, van elf naar zeven meter.

 De muziek staat in `audio/intro/`. Dat is, net als `audio/menu/` en
 `audio/radio/`, een bewuste uitzondering op de regel dat er geen
 beeld- of geluidsbestanden in het spel zitten: een tune is niet te tekenen.
 Hij fadet uit in de laatste seconden, en meteen als je het filmpje overslaat.

 De lus draait op `requestAnimationFrame` en zet alleen de camera. De hoofdlus
 van js/main.js tekent door, maar zet de camera niet terug zolang `bezig()` true
 is. Overslaan kan altijd met een toets, een klik of een tik.
*/

let bezigNu = false;
let tNu = 0, runs = 0;
export function bezig() { return bezigNu; }
// voor de proeven: hoever het filmpje is en hoe vaak hij gestart is
export function stand() { return { t: +tNu.toFixed(2), runs }; }
// het punt waar de camera nu naar kijkt: js/main.js zet de schaduwdoos daar
let kijkPunt = null;
export function kijkNu() { return bezigNu ? kijkPunt : null; }

// Een verloop dat rustig begint en rustig eindigt: een camera die met een ruk
// op gang komt leest als een storing, ook in een beeld van zes seconden.
const soepel = (u) => u * u * (3 - 2 * u);
// en eentje die alleen aan het eind afremt, voor een vlucht die al loopt
const uitloop = (u) => 1 - (1 - u) * (1 - u);

export const MUZIEK = 'audio/intro/intro.mp3';
const MUZIEK_VOL = 0.85;      // wat luider dan de menumuziek; zie het verzoek
const UITFADE = 3.4;          // seconden waarin de muziek aan het eind wegzakt

// ---------------------------------------------------------------- de plekken

/*
 Het midden van het eerste pand met dit type (bijvoorbeeld 'poiesz'), met de
 richting waar de voorgevel naartoe kijkt erbij. Die richting is waar het om
 gaat: sta je aan de achterkant, dan film je een blinde muur achter een rij
 bomen. Met `front` uit de kaart vliegt de camera langs de kant waar de ingang
 en het parkeerterrein zitten.
*/
function pandVan(KAART, type) {
  const p = (KAART.panden || []).find(q => q.type === type);
  if (!p || !p.voet || !p.voet.length) return null;
  let x = 0, z = 0;
  for (const q of p.voet) { x += q[0]; z += q[1]; }
  const f = p.front || [0, -1];
  return { x: x / p.voet.length, z: z / p.voet.length, hoog: p.nok || 6, hoek: Math.atan2(f[1], f[0]) };
}

// Het midden van alle panden waarvan het type met dit stukje begint: zo is het
// terrein van de waterzuivering (rwzi, rwzi_kantoor, rwzi_blauw) één plek.
function terreinVan(KAART, begin) {
  let x = 0, z = 0, n = 0;
  for (const p of KAART.panden || []) {
    if (!p.type || !p.type.startsWith(begin) || !p.voet) continue;
    let px = 0, pz = 0;
    for (const q of p.voet) { px += q[0]; pz += q[1]; }
    x += px / p.voet.length; z += pz / p.voet.length; n++;
  }
  return n ? { x: x / n, z: z / n, aantal: n } : null;
}

// Het midden van het grootste vlak van een klasse, eventueel in de buurt van
// een punt (het Tinga-bosje is niet het grootste bos van de kaart, wel het
// dichtstbijzijnde).
function vlakVan(KAART, klasse, bij = null, straal = Infinity) {
  let beste = null;
  for (const v of KAART.vlakken || []) {
    if (v.k !== klasse) continue;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const r of v.r) for (const p of r) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1];
    }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const d = bij ? Math.hypot(cx - bij.x, cz - bij.z) : 0;
    if (d > straal) continue;
    const opp = (x1 - x0) * (z1 - z0);
    // dichterbij telt zwaarder dan groter: opp gedeeld door de afstand
    const punt = { x: cx, z: cz, opp, maat: Math.max(x1 - x0, z1 - z0) };
    const score = bij ? opp / (1 + d) : opp;
    if (!beste || score > beste.score) beste = { ...punt, score };
  }
  return beste;
}

// Een punt op een straat met deze naam: het midden van het langste vak.
function straatVan(KAART, naam) {
  let beste = null;
  for (const w of KAART.wegassen || []) {
    if (!w.naam || w.naam.toLowerCase() !== naam.toLowerCase()) continue;
    for (let i = 0; i + 1 < w.pts.length; i++) {
      const a = w.pts[i], b = w.pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!beste || L > beste.L) {
        beste = { L, a, b, x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2,
          dx: (b[0] - a[0]) / (L || 1), dz: (b[1] - a[1]) / (L || 1) };
      }
    }
  }
  return beste;
}

/*
 Een viaduct uit de kaart, met de richting van het dek: het hoogste punt van de
 as, en de lijn van het begin naar dat punt. Daarmee kan de camera er recht op
 af vliegen in plaats van er omheen te draaien.
*/
function viaductVan(KAART, naam) {
  const v = (KAART.viaducten || []).find(x => new RegExp(naam, 'i').test(x.naam || ''));
  if (!v || !v.as || v.as.length < 3) return null;
  let top = v.as[0];
  for (const p of v.as) if (Math.abs(p[2]) > Math.abs(top[2])) top = p;
  const a = v.as[0];
  const dx = top[0] - a[0], dz = top[1] - a[1];
  const L = Math.hypot(dx, dz) || 1;
  /*
   En de weg eronder: het langste stuk rijbaan binnen zeventig meter van het
   hoogste punt dat dwars op het dek ligt. Daarlangs kijk je tegen de boog van
   het viaduct aan; langs het dek zelf zie je alleen asfalt dat wat oploopt.
  */
  let onder = null;
  for (const w of KAART.wegassen || []) {
    for (let i = 0; i + 1 < w.pts.length; i++) {
      const p = w.pts[i], q = w.pts[i + 1];
      const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
      if (Math.hypot(mx - top[0], mz - top[1]) > 70) continue;
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const ux = (q[0] - p[0]) / len, uz = (q[1] - p[1]) / len;
      // dwars op het dek: het inproduct met de richting van het viaduct is klein
      if (Math.abs(ux * (dx / L) + uz * (dz / L)) > 0.35) continue;
      if (!onder || len > onder.len) onder = { len, dx: ux, dz: uz, naam: w.naam };
    }
  }
  return { x: top[0], z: top[1], y: top[2], dx: dx / L, dz: dz / L, naam: v.naam, onder };
}

/*
 Alles wat het filmpje aandoet, opgezocht in de kaart. Wat er niet is wordt
 stilletjes overgeslagen (`null`), zodat een kaart zonder molen of zonder Poiesz
 geen kapot filmpje geeft maar een kortere reeks.
*/
export function zoekPlekken(KAART, start) {
  const molen = (KAART.molens || []).find(m => /rat/i.test(m.naam || '')) || (KAART.molens || [])[0];
  const rwzi = (KAART.poorten || []).find(p => p.terrein === 'rwzi');
  const sneekerpad = straatVan(KAART, 'Sneekerpad');
  const geeuwkade = straatVan(KAART, 'Geeuwkade');
  return {
    start,
    molenkrite: straatVan(KAART, 'Molenkrite'),
    jumbo: pandVan(KAART, 'jumbo'),
    poiesz: pandVan(KAART, 'poiesz'),
    molen: molen ? { x: molen.cx, z: molen.cz, hoog: molen.top || 20 } : null,
    sneekerpad,
    bosje: vlakVan(KAART, 'bos', start, 900),
    brug: vlakVan(KAART, 'brug'),
    viaduct: viaductVan(KAART, 'viaduct tinga'),
    // de Geeuw: het water bij de Geeuwkade in IJlst, en anders bij de molen
    geeuw: vlakVan(KAART, 'water', geeuwkade || sneekerpad || start, 700),
    rwzi: terreinVan(KAART, 'rwzi') ||
      (rwzi ? { x: (rwzi.a[0] + rwzi.b[0]) / 2, z: (rwzi.a[1] + rwzi.b[1]) / 2 } : null),
  };
}

/*
 Een beeld dat om een plek heen draait: twee standen op een cirkel eromheen, met
 de camera er de hele tijd op gericht. Een rechte lijn tussen twee punten op die
 cirkel is een koorde — dat leest als een rustige zwenk en niet als een zwaai.

 `hoogte` is de vlieghoogte, `kijkY` de hoogte van het punt waar hij naar kijkt
 (bij een molen van twintig meter kijk je halverwege de romp en niet naar de
 stoep).
*/
function omheen(p, { straal, hoogte, van, tot, kijkY = 5, duur = 6.5, ease = soepel, basis = 0 }) {
  const op = (hoek) => ({ x: p.x + Math.cos(basis + hoek) * straal, y: hoogte, z: p.z + Math.sin(basis + hoek) * straal });
  return {
    duur, ease,
    van: op(van), naar: op(tot),
    kijkVan: { x: p.x, y: kijkY, z: p.z }, kijkNaar: { x: p.x, y: kijkY, z: p.z },
  };
}

/*
 De beelden, op volgorde. Alles wat van boven komt zit op minstens dertig meter
 (zie de kop van dit bestand); de twee lage beelden liggen op de weg.
*/
function maakBeelden(KAART, start) {
  const P = zoekPlekken(KAART, start);
  const S = { x: start.x, z: start.z, yaw: start.yaw };
  const vx = -Math.sin(S.yaw), vz = -Math.cos(S.yaw);      // de kijkrichting bij de start
  const zx = -vz, zz = vx;                                 // opzij
  const rij = [];

  // 1. hoog boven de wijk, heel langzaam zakkend
  rij.push({
    duur: 7.6, ease: soepel,
    van: { x: S.x - vx * 330 + zx * 240, y: 235, z: S.z - vz * 330 + zz * 240 },
    naar: { x: S.x - vx * 250 + zx * 170, y: 185, z: S.z - vz * 250 + zz * 170 },
    kijkVan: { x: S.x, y: 8, z: S.z }, kijkNaar: { x: S.x, y: 8, z: S.z },
  });

  // 2. de Molenkrite zelf, laag over de rijbaan — hier woont het verhaal
  if (P.molenkrite) {
    const m = P.molenkrite;
    rij.push({
      duur: 7.0, ease: uitloop,
      van: { x: m.a[0] - m.dx * 6, y: 2.2, z: m.a[1] - m.dz * 6 },
      naar: { x: m.a[0] + m.dx * Math.min(m.L * 0.7, 90), y: 2.2, z: m.a[1] + m.dz * Math.min(m.L * 0.7, 90) },
      kijkVan: { x: m.a[0] + m.dx * 45, y: 2.4, z: m.a[1] + m.dz * 45 },
      kijkNaar: { x: m.b[0], y: 2.4, z: m.b[1] },
    });
  }

  // 3. de Jumbo aan de Molenkrite
  // langs de voorkant: `hoek` wijst naar het parkeerterrein, niet naar de achtermuur
  if (P.jumbo) rij.push(omheen(P.jumbo, { basis: P.jumbo.hoek, straal: 66, hoogte: 34, van: 0.45, tot: -0.35, kijkY: 4, duur: 6.5 }));

  // 4. het Tinga-bosje
  if (P.bosje) rij.push(omheen(P.bosje, { straal: Math.max(90, P.bosje.maat * 0.7), hoogte: 46, van: 0.4, tot: 1.1, kijkY: 8, duur: 6.5 }));

  /*
   5. het Viaduct Tinga over de rondweg — de poort van de wijk.

   Dit was eerst de brug over het water, van veraf en rondcirkelend als alle
   andere beelden (verzoek 20 sep 2026: een ander beeld én een andere hoek).
   Hier draait de camera niet: hij vliegt in één rechte lijn over de rondweg
   ónder het viaduct door erop af, en zakt daarbij van elf naar zeven meter. Zo
   staat de boog van het viaduct dwars in beeld; langs het dek zelf zie je
   alleen asfalt dat wat oploopt, en dat leest niet als een viaduct. Een
   inrijdende beweging leest bovendien heel anders dan een zwenk om een punt.
  */
  if (P.viaduct && P.viaduct.onder) {
    const v = P.viaduct, o = v.onder;
    /*
     Zes meter naast de as van de rijbaan. Pal op de as scheerde de camera op
     zeven meter hoogte langs een boom op (196, -210): drie meter ernaast, en
     daarmee de enige treffer in de clipping-proef van de hele film. Aan deze
     kant blijft er negen meter over.
    */
    const zx = o.dz, zz = -o.dx;
    rij.push({
      duur: 6.5, ease: soepel,
      van: { x: v.x - o.dx * 150 + zx * 6, y: 11, z: v.z - o.dz * 150 + zz * 6 },
      naar: { x: v.x - o.dx * 52 + zx * 6, y: 6.6, z: v.z - o.dz * 52 + zz * 6 },
      kijkVan: { x: v.x + o.dx * 25, y: 4.6, z: v.z + o.dz * 25 },
      kijkNaar: { x: v.x + o.dx * 18, y: 4.2, z: v.z + o.dz * 18 },
    });
  }

  // 6. de waterzuivering aan de Buitenroede
  // van de open kant af: aan de zuidkant staat het bos ervoor
  if (P.rwzi) rij.push(omheen(P.rwzi, { straal: 105, hoogte: 62, van: -2.0, tot: -2.6, kijkY: 3, duur: 6.5 }));

  // 7. de Geeuw
  if (P.geeuw) rij.push(omheen(P.geeuw, { straal: Math.max(110, P.geeuw.maat * 0.55), hoogte: 42, van: 5.5, tot: 4.9, kijkY: 1, duur: 6.5 }));

  // 8. houtzaagmolen De Rat aan het Sneekerpad — halverwege de romp gekeken
  if (P.molen) rij.push(omheen(P.molen, { straal: 58, hoogte: 33, van: 2.6, tot: 1.9, kijkY: (P.molen.hoog || 20) * 0.55, duur: 7.0 }));

  // 9. de Poiesz in IJlst, laag langs de voorkant
  if (P.poiesz) rij.push(omheen(P.poiesz, { basis: P.poiesz.hoek, straal: 48, hoogte: 13, van: 0.35, tot: -0.25, kijkY: 4, duur: 6.0 }));

  // 10. en terug naar Erik: de daling naar het standpunt waar het spel begint
  rij.push({
    duur: 5.2, ease: soepel,
    van: { x: S.x - vx * 34 + zx * 14, y: 30, z: S.z - vz * 34 + zz * 14 },
    naar: { x: S.x, y: 1.7, z: S.z },
    kijkVan: { x: S.x + vx * 12, y: 3, z: S.z + vz * 12 },
    kijkNaar: { x: S.x + vx * 30, y: 1.7, z: S.z + vz * 30 },
  });
  return rij;
}

/*
 De titels. Red Eagle en de filmtitel staan er lang in (verzoek 20 sep 2026),
 met genoeg leeg beeld ertussen om de wijk te laten zien.
*/
const TITELS = [
  { van: 1.5, tot: 9.5, klein: 'RED EAGLE PRODUCTIONS' },
  { van: 12.5, tot: 18.0, klein: 'presents' },
  { van: 50.0, tot: 64.5, klein: 'GTA VI', sub: 'TINGA' },
];

/*
 De camerastand op tijdstip `t`, als losse functie. De lus hieronder gebruikt
 hem, en de proeven en de fotogereedschappen ook: zo is "waar staat de camera op
 seconde dertien" een vraag met een antwoord, zonder dat er een filmpje van een
 minuut voor hoeft te lopen.
*/
export function beeldOp(t, KAART, start) {
  const beelden = maakBeelden(KAART, start);
  const totaal = beelden.reduce((a, b) => a + b.duur, 0);
  let rest = Math.max(0, t), beeld = beelden[beelden.length - 1], u = 1, nr = beelden.length - 1;
  for (let i = 0; i < beelden.length; i++) {
    const b = beelden[i];
    if (rest <= b.duur) { beeld = b; nr = i; u = b.duur > 0 ? rest / b.duur : 1; break; }
    rest -= b.duur;
  }
  const e = beeld.ease(Math.max(0, Math.min(1, u)));
  const meng = (a, b) => a + (b - a) * e;
  const titel = TITELS.find(x => t >= x.van && t < x.tot) || null;
  return {
    pos: { x: meng(beeld.van.x, beeld.naar.x), y: meng(beeld.van.y, beeld.naar.y), z: meng(beeld.van.z, beeld.naar.z) },
    kijk: { x: meng(beeld.kijkVan.x, beeld.kijkNaar.x), y: meng(beeld.kijkVan.y, beeld.kijkNaar.y), z: meng(beeld.kijkVan.z, beeld.kijkNaar.z) },
    titel, beeldNr: nr, beelden: beelden.length, deel: totaal > 0 ? Math.min(1, t / totaal) : 1, totaal,
  };
}

/*
 De intro spelen. Levert een belofte die klaar is als het filmpje uit is of
 overgeslagen wordt; daarna staat de camera op het standpunt van de speler.

 `geluid` uit (toets U of de instelling) betekent: geen muziek. Is er geen kaart
 (de oude, handgetekende wereld), dan slaat hij zichzelf over — een filmpje over
 een wijk die er niet zo uitziet heeft geen zin.
*/
export function speelIntro({ camera, KAART, start, geluidAan = true, wapen = null }) {
  const laag = document.getElementById('intro');
  if (!laag || !KAART || !start) return Promise.resolve();
  const titelEl = document.getElementById('introtitel');
  const kleinEl = titelEl.querySelector('.klein');
  const grootEl = titelEl.querySelector('.groot');
  const subEl = titelEl.querySelector('.sub');
  const zwart = document.getElementById('introzwart');
  const totaal = beeldOp(0, KAART, start).totaal;

  bezigNu = true;
  runs++;
  laag.classList.add('aan');
  zwart.style.opacity = '1';
  requestAnimationFrame(() => { zwart.style.opacity = '0'; });
  /*
   Het wapen uit beeld. Het hangt aan de camera, dus tijdens een filmpje waarin
   die camera over de wijk vliegt zweefde het pistool mee door de lucht (gemeld
   20 sep 2026). Het gaat na afloop terug naar de stand die de speler had.
  */
  const wapenStand = wapen ? wapen.visible : null;
  if (wapen) wapen.visible = false;

  // de muziek
  let muziek = null;
  if (geluidAan) {
    try {
      muziek = new Audio(MUZIEK);
      muziek.volume = MUZIEK_VOL;
      const p = muziek.play();
      if (p && p.catch) p.catch(() => { muziek = null; });
    } catch { muziek = null; }
  }
  const muziekUit = (tellen) => {
    if (!muziek) return;
    const m = muziek, van = m.volume, t0 = performance.now();
    const stap = () => {
      const u = (performance.now() - t0) / (tellen * 1000);
      m.volume = Math.max(0, van * (1 - u));
      if (u >= 1) { m.pause(); return; }
      requestAnimationFrame(stap);
    };
    stap();
  };

  // de titel in beeld zetten (of weghalen); `vorigeTitel` voorkomt dat de fade
  // elk beeld opnieuw begint
  let vorigeTitel;
  const zetTitel = (T) => {
    if (T === vorigeTitel) return;
    vorigeTitel = T;
    if (!T) { titelEl.classList.remove('zichtbaar'); return; }
    kleinEl.textContent = T.klein || '';
    grootEl.textContent = T.groot || '';
    subEl.textContent = T.sub || '';
    titelEl.classList.add('zichtbaar');
  };

  return new Promise((klaar) => {
    /*
     De tijd komt van de klok en niet uit een optelling van beeldtijden. Op een
     trage machine haalt hij maar een paar beelden per seconde, en dan zou een
     filmpje van een minuut er vijf duren. Nu duurt het altijd even lang; er
     vallen hooguit beelden weg — en het loopt gelijk met de muziek.
    */
    const t0 = performance.now();
    let t = 0, gestopt = false, faded = false;

    const afsluiten = (snel = true) => {
      if (gestopt) return;
      gestopt = true;
      window.removeEventListener('keydown', opToets);
      window.removeEventListener('pointerdown', opTik);
      if (snel) muziekUit(0.7);
      zwart.style.opacity = '1';
      titelEl.classList.remove('zichtbaar');
      setTimeout(() => {
        laag.classList.remove('aan');
        zwart.style.opacity = '1';
        if (wapen && wapenStand !== null) wapen.visible = wapenStand;
        bezigNu = false;
        klaar();
      }, 620);
    };
    const opToets = (e) => { if (e.ctrlKey || e.metaKey) return; afsluiten(); };
    const opTik = () => afsluiten();
    window.addEventListener('keydown', opToets);
    window.addEventListener('pointerdown', opTik);

    const stap = () => {
      if (gestopt) return;
      t = tNu = (performance.now() - t0) / 1000;
      const beeld = beeldOp(t, KAART, start);
      camera.position.set(beeld.pos.x, beeld.pos.y, beeld.pos.z);
      camera.lookAt(beeld.kijk.x, beeld.kijk.y, beeld.kijk.z);
      kijkPunt = beeld.kijk;
      zetTitel(beeld.titel);
      // de muziek zakt weg in de laatste seconden, het beeld gaat mee naar zwart
      if (!faded && t > totaal - UITFADE) { faded = true; muziekUit(UITFADE); }
      if (t > totaal - 1.2) zwart.style.opacity = String(Math.min(1, (t - (totaal - 1.2)) / 1.2));
      if (t >= totaal) { afsluiten(false); return; }
      requestAnimationFrame(stap);
    };
    requestAnimationFrame(stap);
  });
}

// testhaak: de intro van buitenaf afbreken (tools/introtest.mjs)
export function slaOver() {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
}

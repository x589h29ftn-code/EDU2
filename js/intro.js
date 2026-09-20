/*
 De intro: een filmpje van twintig seconden voordat het spel begint.

 Wat je ziet (verzoek 20 sep 2026): eerst de wijk van boven, dan lager en dichter
 bij, dan een rit door een straat op ooghoogte, en ten slotte een daling naar
 precies het standpunt waar je het spel begint — zo is de overgang van filmpje
 naar spel geen sprong maar een doorkomst. Over het beeld heen komen de titels:

   RED EAGLE PRODUCTIONS   →   presents   →   GTA VI / TINGA

 Geen enkele coördinaat staat hier hard in. De camerastanden worden afgeleid van
 het startpunt uit js/kaart.js en van het wegennet: het rechte stuk straat waar
 de camera doorheen vliegt wordt opgezocht in KAART.wegassen, zodat het filmpje
 ook klopt als de kaart opnieuw gegenereerd wordt.

 De intro draait in zijn eigen lus met `requestAnimationFrame` en zet alleen de
 camera. De hoofdlus van js/main.js tekent gewoon door (de wolken schuiven, de
 auto's rijden), maar zet de camera niet terug zolang `bezig()` true is.

 Overslaan kan altijd: één toets, één klik, één tik. Dan loopt hij netjes af via
 hetzelfde zwart als waarmee hij begint.
*/

let bezigNu = false;
let tNu = 0, runs = 0;
export function bezig() { return bezigNu; }
// voor de proeven: hoever het filmpje is en hoe vaak hij gestart is
export function stand() { return { t: +tNu.toFixed(2), runs }; }

// Een verloop dat rustig begint en rustig eindigt: een camera die met een ruk
// op gang komt leest als een storing, ook in een filmpje van vijf seconden.
const soepel = (u) => u * u * (3 - 2 * u);
// en eentje die alleen aan het eind afremt, voor een vlucht die al op gang is
const uitloop = (u) => 1 - (1 - u) * (1 - u);

/*
 Een recht stuk straat in de buurt van een punt. Levert het begin- en eindpunt
 van het langste rechte vak binnen `straal` meter, of null. Hier vliegt de
 camera doorheen op ooghoogte.
*/
function rechteStraat(KAART, x, z, straal = 230) {
  let beste = null;
  for (const w of KAART.wegassen || []) {
    if (!w.drive) continue;
    for (let i = 0; i + 1 < w.pts.length; i++) {
      const a = w.pts[i], b = w.pts[i + 1];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (L < 45) continue;
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if (Math.hypot(mx - x, mz - z) > straal) continue;
      if (!beste || L > beste.L) beste = { a, b, L, naam: w.naam };
    }
  }
  return beste;
}

/*
 De beelden. Elk beeld heeft een tijdsduur, een cameraweg (`van` → `naar`) en
 een punt waar de camera naar kijkt (`kijkVan` → `kijkNaar`), allemaal in
 wereldmeters. `soepelheid` bepaalt of het beeld op gang komt of juist afremt.
*/
function maakBeelden(KAART, start) {
  const S = { x: start.x, z: start.z, yaw: start.yaw };
  // de kijkrichting van de speler bij het begin: (−sin yaw, −cos yaw)
  const vx = -Math.sin(S.yaw), vz = -Math.cos(S.yaw);
  const zx = -vz, zz = vx;                       // opzij
  const straat = rechteStraat(KAART, S.x, S.z) || { a: [S.x - 60, S.z], b: [S.x + 60, S.z] };
  const dx = (straat.b[0] - straat.a[0]) / straat.L;
  const dz = (straat.b[1] - straat.a[1]) / straat.L;

  return [
    // 1. hoog boven de wijk, langzaam zakkend en meedraaiend
    {
      duur: 6.0, ease: soepel,
      van: { x: S.x - vx * 300 + zx * 210, y: 215, z: S.z - vz * 300 + zz * 210 },
      naar: { x: S.x - vx * 170 + zx * 90, y: 150, z: S.z - vz * 170 + zz * 90 },
      kijkVan: { x: S.x, y: 6, z: S.z }, kijkNaar: { x: S.x, y: 6, z: S.z },
    },
    // 2. lager, schuin over de daken naar de straat toe
    {
      duur: 5.0, ease: soepel,
      van: { x: S.x + vx * 150 - zx * 120, y: 96, z: S.z + vz * 150 - zz * 120 },
      naar: { x: S.x + vx * 60 - zx * 40, y: 44, z: S.z + vz * 60 - zz * 40 },
      kijkVan: { x: S.x, y: 4, z: S.z }, kijkNaar: { x: S.x, y: 4, z: S.z },
    },
    // 3. door de straat, op ooghoogte, met de neus vooruit
    {
      duur: 4.6, ease: uitloop,
      van: { x: straat.a[0] - dx * 4, y: 2.1, z: straat.a[1] - dz * 4 },
      naar: { x: straat.a[0] + dx * straat.L * 0.62, y: 2.1, z: straat.a[1] + dz * straat.L * 0.62 },
      kijkVan: { x: straat.a[0] + dx * 40, y: 2.0, z: straat.a[1] + dz * 40 },
      kijkNaar: { x: straat.b[0], y: 2.0, z: straat.b[1] },
    },
    // 4. de daling naar het hoofdpersonage: eindigt exact op zijn ooghoogte en
    //    in zijn kijkrichting, zodat het spel er naadloos uit tevoorschijn komt
    {
      duur: 4.4, ease: soepel,
      van: { x: S.x - vx * 26 + zx * 12, y: 17, z: S.z - vz * 26 + zz * 12 },
      naar: { x: S.x, y: 1.7, z: S.z },
      kijkVan: { x: S.x + vx * 10, y: 1.4, z: S.z + vz * 10 },
      kijkNaar: { x: S.x + vx * 30, y: 1.7, z: S.z + vz * 30 },
    },
  ];
}

// De titels: wanneer ze komen, hoe lang ze blijven, en wat er staat.
const TITELS = [
  { van: 1.2, tot: 5.0, klein: 'RED EAGLE PRODUCTIONS' },
  { van: 6.6, tot: 9.8, klein: 'presents' },
  { van: 12.0, tot: 19.2, klein: 'GTA VI', sub: 'TINGA' },
];

/*
 De camerastand op tijdstip `t`, als losse functie. De lus hieronder gebruikt
 hem, en de proeven en de fotogereedschappen ook: zo is "waar staat de camera op
 seconde dertien" een vraag met een antwoord, zonder dat er een filmpje van
 twintig seconden voor hoeft te lopen.

 Levert de plek, het punt waar hij naar kijkt, welke titel er hoort te staan en
 hoever het filmpje is (0 tot 1).
*/
export function beeldOp(t, KAART, start) {
  const beelden = maakBeelden(KAART, start);
  const totaal = beelden.reduce((a, b) => a + b.duur, 0);
  let rest = Math.max(0, t), beeld = beelden[beelden.length - 1], u = 1;
  for (const b of beelden) {
    if (rest <= b.duur) { beeld = b; u = b.duur > 0 ? rest / b.duur : 1; break; }
    rest -= b.duur;
  }
  const e = beeld.ease(Math.max(0, Math.min(1, u)));
  const meng = (a, b) => a + (b - a) * e;
  const titel = TITELS.find(x => t >= x.van && t < x.tot) || null;
  return {
    pos: { x: meng(beeld.van.x, beeld.naar.x), y: meng(beeld.van.y, beeld.naar.y), z: meng(beeld.van.z, beeld.naar.z) },
    kijk: { x: meng(beeld.kijkVan.x, beeld.kijkNaar.x), y: meng(beeld.kijkVan.y, beeld.kijkNaar.y), z: meng(beeld.kijkVan.z, beeld.kijkNaar.z) },
    titel, deel: totaal > 0 ? Math.min(1, t / totaal) : 1, totaal,
  };
}

/*
 De intro spelen. Levert een belofte die klaar is als het filmpje uit is of
 overgeslagen wordt; daarna staat de camera op het standpunt van de speler.

 `start` is het beginpunt van de speler ({ x, z, yaw }) en `KAART` de kaart. Is
 er geen kaart (de oude, handgetekende wereld), dan slaat hij zichzelf over —
 een filmpje over een wijk die er niet zo uitziet heeft geen zin.
*/
export function speelIntro({ camera, KAART, start }) {
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
  // het zwart uit laten faden zodra het eerste beeld staat
  requestAnimationFrame(() => { zwart.style.opacity = '0'; });

  // de titel in beeld zetten (of weghalen); `vorigeTitel` voorkomt dat de
  // fade elk beeld opnieuw begint
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
     trage machine (of in een proef met softwarerendering) haalt hij maar een
     paar beelden per seconde, en dan zou een filmpje van twintig seconden er
     een minuut over doen. Nu duurt het altijd even lang; er vallen hooguit
     beelden weg.
    */
    const t0 = performance.now();
    let t = 0, gestopt = false;

    const afsluiten = () => {
      if (gestopt) return;
      gestopt = true;
      window.removeEventListener('keydown', opToets);
      window.removeEventListener('pointerdown', opTik);
      // netjes uitfaden naar zwart en dan het beeld teruggeven aan het spel
      zwart.style.opacity = '1';
      titelEl.classList.remove('zichtbaar');
      setTimeout(() => {
        laag.classList.remove('aan');
        zwart.style.opacity = '1';
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
      zetTitel(beeld.titel);
      // de laatste seconde naar zwart, zodat het spel er niet in springt
      if (t > totaal - 0.9) zwart.style.opacity = String(Math.min(1, (t - (totaal - 0.9)) / 0.9));

      if (t >= totaal) { afsluiten(); return; }
      requestAnimationFrame(stap);
    };
    requestAnimationFrame(stap);
  });
}

// testhaak: de intro van buitenaf afbreken (tools/introtest.mjs)
export function slaOver() {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
}

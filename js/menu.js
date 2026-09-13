/*
 Startscherm, laadscherm en pauzemenu.

 Hoe het loopt. Je komt binnen op het **menu**: Start spel, Doorgaan, Spel laden,
 Instellingen, Besturing, Afsluiten. Ondertussen bouwt js/main.js de wereld al op
 in stukjes, want dat duurt tientallen seconden en dat is precies de tijd waarin
 je naar een menu zit te kijken. Kies je iets, dan schuift het **laadscherm**
 ervoor: een beeld uit de wijk met de voortgangsbalk eronder. Is de wereld dan al
 klaar, dan blijft het laadscherm nog even staan — een balk die in een tiende
 seconde voorbijflitst leest als een storing.

 Tijdens het spelen komt met Esc hetzelfde menu terug, nu met Doorgaan bovenaan.
 Daar zitten ook de instellingen en de besturing, zodat die niet meer permanent
 in beeld hoeven te staan.

 De beelden voor het laadscherm staan in `beeld/laadscherm/`, met een lijstje in
 `beelden.json` — net als de muziek in `audio/radio/`. Is er niets (of laadt het
 niet), dan tekent dit bestand zelf een achtergrond op een canvas: een silhouet
 van de wijk bij zonsondergang. Zo werkt het scherm ook zonder dat er ooit een
 plaatje bij komt, en dat is de enige plek in het spel waar een afbeelding uit
 een bestand mag komen.

 Het beeld staat niet stil: het zoomt in achtentwintig seconden een procent of
 twaalf in, met de vaart er langzaam uit (dezelfde truc als op een echt
 GTA-laadscherm). Hoever, staat per beeld in `beelden.json`. Het verloop dat de
 tekst leesbaar houdt ligt in een eigen laag eroverheen en zoomt dus niet mee —
 anders schuift de donkere onderkant het scherm af terwijl je kijkt.

 Er hoort **muziek** bij, uit `audio/menu/`: één nummer op herhaling dat blijft
 doorspelen als je van het startscherm naar het laadscherm gaat, uitfadet zodra
 het spel begint en terugkomt als je op Esc drukt. Een browser laat geluid pas
 toe ná een klik of toetsaanslag, dus als de eerste poging geweigerd wordt
 wacht dit bestand op de eerste de beste aanraking van de pagina.
*/

const TIPS = [
  'Met V wissel je tussen de camera vanuit je ogen en de camera achter je.',
  'Druk op M voor de grote kaart van de wijk.',
  'Met F5 sla je op, met F9 laad je je laatste opgeslagen spel.',
  'Bij de boerderij aan de Molenkrite koop je kogels, verband en wapens; bij de Poiesz een flesje bier.',
  'Uit het zicht blijven laat de politie je sneller vergeten.',
  'Met [ en ] draai je de klok een uur terug of vooruit.',
  'Met Y wissel je het weer: helder, bewolkt of regen.',
  'In de auto wissel je met ← en → van radiozender.',
  'Met het scrollwiel wissel je van wapen.',
];

let el = {};                 // de vaste onderdelen van het scherm
let keuzeKlaar = null;       // resolve van de belofte waar main.js op wacht
let keuze = null;            // 'nieuw' | 'laden' | 'doorgaan'
let beelden = [];            // achtergronden voor het laadscherm
let opAfsluiten = null;      // wat er moet gebeuren bij Afsluiten
let noodPlaatje = null;      // de zelfgetekende achtergrond, één keer gemaakt

/*
 Een achtergrond als er geen bestand is: de skyline van de wijk bij avond,
 op een canvas getekend. Geen kunstwerk, wel iets beters dan zwart, en het
 verdwijnt zodra er een echte schermafdruk in beeld/laadscherm/ staat.
*/
function nooddoek() {
  if (noodPlaatje) return noodPlaatje;
  const c = document.createElement('canvas');
  c.width = 1280; c.height = 720;
  const g = c.getContext('2d');
  const lucht = g.createLinearGradient(0, 0, 0, 720);
  lucht.addColorStop(0, '#0d1c33'); lucht.addColorStop(0.5, '#3a3050'); lucht.addColorStop(0.78, '#8a4f38'); lucht.addColorStop(1, '#c07742');
  g.fillStyle = lucht; g.fillRect(0, 0, 1280, 720);
  // zon laag boven de horizon
  const zon = g.createRadialGradient(880, 500, 8, 880, 500, 260);
  zon.addColorStop(0, 'rgba(255,226,170,0.95)'); zon.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = zon; g.beginPath(); g.arc(880, 500, 260, 0, Math.PI * 2); g.fill();
  /*
   Twee rijen daken. Breed en laag, want dit is een naoorlogse woonwijk en geen
   skyline: de eerste versie stond vol smalle torentjes en die leken op
   grafstenen. De achterste rij is lichter en staat hoger in beeld.
  */
  const rij = (grond, hoog, breed, kleur, dak, ramen) => {
    for (let x = -60; x < 1340; x += breed + 6) {
      const b = breed * (0.8 + Math.random() * 0.5);
      const h = hoog * (0.8 + Math.random() * 0.45);
      g.fillStyle = kleur;
      g.fillRect(x, grond - h, b, h + 160);
      // zadeldak erop
      g.fillStyle = dak;
      g.beginPath();
      g.moveTo(x - 6, grond - h); g.lineTo(x + b / 2, grond - h - b * 0.20); g.lineTo(x + b + 6, grond - h);
      g.closePath(); g.fill();
      // een paar verlichte ramen
      for (let i = 0; i < ramen; i++) {
        if (Math.random() < 0.55) continue;
        g.fillStyle = `rgba(255,208,130,${0.35 + Math.random() * 0.45})`;
        g.fillRect(x + 10 + Math.random() * (b - 26), grond - h + 14 + Math.random() * (h - 26), 9, 7);
      }
    }
  };
  rij(560, 62, 118, '#2b3553', '#222a44', 5);
  rij(624, 84, 152, '#141b2c', '#0f1422', 7);
  // water onderin met strepen van de laagstaande zon erin
  g.fillStyle = '#0a1120'; g.fillRect(0, 648, 1280, 72);
  g.strokeStyle = 'rgba(255,180,120,0.20)'; g.lineWidth = 2;
  for (let i = 0; i < 34; i++) {
    const y = 654 + Math.random() * 60, w = 30 + Math.random() * 170, x = 620 + (Math.random() - 0.5) * 900;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke();
  }
  noodPlaatje = c.toDataURL('image/jpeg', 0.84);
  return noodPlaatje;
}

/*
 De lijst met achtergronden ophalen. Mislukt dat, dan blijft `beelden` leeg en
 gebruikt het laadscherm het noodddoek hierboven. Het mag dus ontbreken.
*/
export async function laadBeelden(pad = 'beeld/laadscherm/beelden.json') {
  try {
    const r = await fetch(pad, { cache: 'force-cache' });
    if (!r.ok) return beelden;
    const j = await r.json();
    beelden = (j.beelden || []).filter(b => b && b.bestand)
      .map(b => ({ ...b, url: pad.replace(/[^/]*$/, '') + b.bestand }));
  } catch { /* geen lijst: het nooddoek doet het ook */ }
  // het menu staat er al voordat deze lijst binnen is: dan nu pas het echte beeld
  if (beelden.length && el && el.doek) zetDoek(el.doek, kiesBeeld());
  return beelden;
}

/*
 Een achtergrond op een doek zetten en hem langzaam laten inzoomen — zoals een
 GTA-laadscherm, dat nooit helemaal stilstaat. De animatie moet per keer opnieuw
 starten; een CSS-animatie doet dat alleen als hij eerst van het element af is,
 vandaar het lezen van offsetWidth ertussen (dat dwingt de browser tot een
 herberekening).
*/
function zetDoek(doel, b, zoomen = true) {
  if (!doel) return;
  doel.style.backgroundImage = `url(${b ? b.url : nooddoek()})`;
  doel.style.backgroundPosition = (b && b.focus) || 'center';
  doel.classList.remove('zoomt');
  if (!zoomen || !b) { doel.style.transform = ''; return; }
  doel.style.setProperty('--zoom', b.zoom || 1.12);
  void doel.offsetWidth;
  doel.classList.add('zoomt');
}

// Welk beeld komt er in beeld? Eén beeld: altijd dat. Meer: elke keer een ander.
let vorigBeeld = -1;
function kiesBeeld() {
  if (!beelden.length) return null;
  if (beelden.length === 1) return beelden[0];
  let i = Math.floor(Math.random() * beelden.length);
  if (i === vorigBeeld) i = (i + 1) % beelden.length;
  vorigBeeld = i;
  return beelden[i];
}

/* ------------------------------------------------------------------ muziek */
let muziek = null;            // het <audio>-element
let muziekAan = true;         // staat het geluid van het spel aan?
let muziekWil = false;        // moet hij nu spelen?
let vervaag = null;           // lopende fade

const MUZIEK_LUID = 0.55;     // hard genoeg om het scherm te dragen, zacht genoeg om te praten

/*
 De lijst ophalen en het eerste nummer dat laadt klaarzetten. Hij begint pas te
 spelen als het menu erom vraagt; of dat meteen mag, beslist de browser.
*/
export async function laadMuziek(pad = 'audio/menu/nummers.json') {
  if (muziek) return muziek;
  try {
    const r = await fetch(pad, { cache: 'force-cache' });
    if (!r.ok) return null;
    const j = await r.json();
    const eerste = (j.nummers || []).find(n => n && n.bestand);
    if (!eerste) return null;
    const a = new Audio(pad.replace(/[^/]*$/, '') + eerste.bestand);
    a.loop = true;                      // op herhaling, zoals een menu hoort
    a.volume = 0;
    a.preload = 'auto';
    muziek = a;
    if (muziekWil) speelMuziek(true);
  } catch { /* geen muziek: het menu is dan gewoon stil */ }
  return muziek;
}

function naarVolume(doel, seconden = 0.8) {
  if (!muziek) return;
  clearInterval(vervaag);
  const van = muziek.volume, stap = 40;
  let i = 0;
  vervaag = setInterval(() => {
    i++;
    const f = Math.min(1, i / (seconden * stap));
    muziek.volume = Math.max(0, Math.min(1, van + (doel - van) * f));
    if (f >= 1) {
      clearInterval(vervaag); vervaag = null;
      if (doel === 0) muziek.pause();
    }
  }, 1000 / stap);
}

/*
 Aan of uit. Aanzetten kan door de browser geweigerd worden zolang er nog niet
 geklikt is; dan hangen we er een eenmalige luisteraar aan die het bij de eerste
 aanraking alsnog probeert.
*/
export function speelMuziek(aan) {
  muziekWil = aan;
  if (!muziek) return;
  if (!aan || !muziekAan) { naarVolume(0, 0.6); return; }
  const p = muziek.play();
  naarVolume(MUZIEK_LUID, 1.2);
  if (p && p.catch) p.catch(() => {
    const nogEens = () => {
      window.removeEventListener('pointerdown', nogEens);
      window.removeEventListener('keydown', nogEens);
      if (muziekWil && muziekAan) { muziek.play().catch(() => {}); naarVolume(MUZIEK_LUID, 0.6); }
    };
    window.addEventListener('pointerdown', nogEens, { once: true });
    window.addEventListener('keydown', nogEens, { once: true });
  });
}

// Voor de proef: speelt de muziek, staat hij op herhaling, hoe hard?
export function muziekStand() {
  if (!muziek) return { er: false };
  return { er: true, speelt: !muziek.paused, lus: muziek.loop, volume: +muziek.volume.toFixed(2), wil: muziekWil, tijd: +muziek.currentTime.toFixed(1) };
}

// Het geluid van het spel staat uit (of weer aan): de menumuziek doet mee.
export function zetGeluid(aan) {
  muziekAan = !!aan;
  if (muziek) { if (!muziekAan) naarVolume(0, 0.3); else if (muziekWil) speelMuziek(true); }
}

function knop(tekst, id, opKlik, hoofd = false) {
  const b = document.createElement('button');
  b.textContent = tekst; b.id = id;
  b.className = hoofd ? 'menuknop hoofd' : 'menuknop';
  b.addEventListener('click', opKlik);
  return b;
}

/*
 Het scherm opbouwen. Eén wortel met id `overlay`, want daar rekenen alle
 gereedschappen in tools/ op: die zetten hem op display:none om zonder menu een
 foto te maken.
*/
export function bouwMenu({ heeftOpslag, opAfsluiten: afsluiten }) {
  opAfsluiten = afsluiten;
  const wortel = document.getElementById('overlay');
  wortel.innerHTML = '';
  wortel.className = 'menuscherm';

  const doek = document.createElement('div'); doek.id = 'menudoek';
  // achter het menu hetzelfde beeld als op het laadscherm: bij het opstarten is
  // er nog geen wereld om doorheen te kijken, en een zwarte leegte is geen scherm
  zetDoek(doek, kiesBeeld());
  const waas = document.createElement('div'); waas.id = 'menuwaas';
  const paneel = document.createElement('div'); paneel.className = 'menupaneel';
  const titel = document.createElement('h1'); titel.textContent = 'TINGA';
  const onder = document.createElement('div'); onder.className = 'menuonder'; onder.textContent = 'Sneek';
  const lijst = document.createElement('div'); lijst.className = 'menulijst';
  paneel.append(titel, onder, lijst);

  const kies = (wat) => () => { keuze = wat; if (keuzeKlaar) { keuzeKlaar(wat); keuzeKlaar = null; } };
  const knoppen = {
    doorgaan: knop('Doorgaan', 'menuDoorgaan', kies('doorgaan'), true),
    nieuw: knop('Start spel', 'menuNieuw', kies('nieuw'), true),
    laden: knop('Spel laden', 'menuLaden', kies('laden')),
    instellingen: knop('Instellingen', 'menuInstellingen', () => toonPaneel('instellingen')),
    besturing: knop('Besturing', 'menuBesturing', () => toonPaneel('besturing')),
    afsluiten: knop('Afsluiten', 'menuAfsluiten', () => opAfsluiten && opAfsluiten()),
  };
  for (const k of Object.values(knoppen)) lijst.append(k);
  knoppen.doorgaan.hidden = true;
  knoppen.laden.hidden = !heeftOpslag;

  // het onderpaneel: instellingen of besturing, uitklapbaar onder de knoppen
  const zijpaneel = document.createElement('div'); zijpaneel.className = 'menuzij'; zijpaneel.hidden = true;
  paneel.append(zijpaneel);

  // geen voettekst meer onder de knoppen: het startscherm is het beeld en de keuze

  // het laadscherm zit in dezelfde wortel, zodat het met het menu mee verdwijnt
  const laad = document.createElement('div'); laad.id = 'laadscherm'; laad.hidden = true;
  const laadDoek = document.createElement('div'); laadDoek.id = 'laaddoek';
  const laadWaas = document.createElement('div'); laadWaas.id = 'laadwaas';
  const laadVoet = document.createElement('div'); laadVoet.id = 'laadvoet';
  const laadTitel = document.createElement('div'); laadTitel.id = 'laadtitel'; laadTitel.textContent = 'TINGA';
  const laadTip = document.createElement('div'); laadTip.id = 'laadtip';
  const balk = document.createElement('div'); balk.id = 'laadbalk';
  const balkIn = document.createElement('div'); balkIn.id = 'laadbalkin';
  balk.append(balkIn);
  const laadWat = document.createElement('div'); laadWat.id = 'laadwat';
  const laadKlaar = document.createElement('div'); laadKlaar.id = 'laadklaar'; laadKlaar.hidden = true;
  laadVoet.append(laadTitel, laadTip, balk, laadWat, laadKlaar);
  laad.append(laadDoek, laadWaas, laadVoet);

  wortel.append(doek, waas, paneel, laad);
  el = { wortel, doek, paneel, lijst, knoppen, zijpaneel, laad, laadDoek, laadTitel, laadTip, balkIn, laadWat, laadKlaar };
  return el;
}

// Instellingen en besturing, allebei in hetzelfde uitklapvak onder de knoppen.
let instelHaak = null;
export function zetInstellingen(haak) { instelHaak = haak; }

function rij(naam, waarde) {
  const r = document.createElement('div'); r.className = 'menurij';
  const a = document.createElement('span'); a.className = 'menusleutel'; a.textContent = naam;
  const b = document.createElement('span'); b.textContent = waarde;
  r.append(a, b); return r;
}

function toonPaneel(welke) {
  const z = el.zijpaneel;
  if (!z.hidden && z.dataset.welke === welke) { z.hidden = true; return; }
  z.dataset.welke = welke;
  z.innerHTML = '';
  z.hidden = false;
  if (welke === 'besturing') {
    const kop = document.createElement('h3'); kop.textContent = 'Besturing'; z.append(kop);
    for (const [a, b] of [
      ['W A S D', 'lopen · shift = rennen · spatie = springen'],
      ['C', 'bukken: lager, langzamer, en moeilijker te zien'],
      ['muis', 'rondkijken · linkermuisknop = schieten · R = herladen'],
      ['scrollwiel', 'wisselen tussen pistool en machinegeweer · H = wapen weg'],
      ['E', 'praten, naar binnen, in- en uitstappen'],
      ['1 … 4', 'aan de toonbank bij Tinga State: kopen wat er in het schap ligt'],
      ['V', 'camera: vanuit je ogen of achter je'],
      ['M', 'grote kaart van de wijk'],
      ['in de auto', 'W/S gas en rem · A/D sturen · spatie handrem'],
      ['← →', 'in de auto: radiozender wisselen'],
      ['F5 / F9', 'opslaan / laden'],
      ['[ ]  \\', 'klok een uur terug, vooruit, of laten lopen'],
      ['Y · U', 'weer wisselen · geluid uit en aan'],
      ['G', 'scherpte: scherp, normaal of zuinig'],
      ['Esc', 'dit menu'],
    ]) z.append(rij(a, b));
    return;
  }
  const kop = document.createElement('h3'); kop.textContent = 'Instellingen'; z.append(kop);
  const s = instelHaak ? instelHaak() : null;
  if (!s) { z.append(rij('—', 'pas beschikbaar als het spel draait')); return; }
  for (const i of s) {
    const r = document.createElement('div'); r.className = 'menurij';
    const a = document.createElement('span'); a.className = 'menusleutel'; a.textContent = i.naam;
    const b = knop(i.waarde(), `instel_${i.id}`, () => { i.volgende(); b.textContent = i.waarde(); });
    b.className = 'menuwaarde';
    r.append(a, b); z.append(r);
  }
}

// Het menu tonen. `bezig` = de wereld is nog aan het laden; dan staat er bij de
// knoppen hoever hij is, maar je kunt gewoon al kiezen.
export function toonMenu({ pauze = false, heeftOpslag = null } = {}) {
  if (!el.wortel) return;
  el.wortel.style.display = 'flex';
  el.laad.hidden = true;
  el.paneel.hidden = false;
  // sla je tijdens het spelen op met F5, dan hoort 'Spel laden' er daarna te staan
  if (heeftOpslag !== null) el.knoppen.laden.hidden = !heeftOpslag;
  el.knoppen.doorgaan.hidden = !pauze;
  el.knoppen.nieuw.classList.toggle('hoofd', !pauze);
  el.knoppen.doorgaan.classList.toggle('hoofd', pauze);
  el.zijpaneel.hidden = true;
  speelMuziek(true);           // ook bij Esc: het menu heeft zijn eigen deuntje
}

export function verbergMenu() {
  if (!el.wortel) return;
  el.wortel.style.display = 'none';
  el.laad.hidden = true;
  speelMuziek(false);          // het spel begint: de menumuziek fadet uit
}

/*
 Het laadscherm ervoor schuiven. Kiest een achtergrond en een tip, en geeft een
 functie terug waarmee de voortgang bijgewerkt wordt.
*/
export function toonLaadscherm() {
  if (!el.wortel) return () => {};
  el.wortel.style.display = 'flex';
  el.paneel.hidden = true;
  el.laad.hidden = false;
  // de muziek loopt door van het startscherm naar het laadscherm: niets stoppen
  speelMuziek(true);
  const b = kiesBeeld();
  zetDoek(el.laadDoek, b);
  if (el.laadTitel) el.laadTitel.textContent = (b && b.titel) || 'TINGA';
  el.laadTip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  if (el.laadKlaar) el.laadKlaar.hidden = true;
  return (deel, wat) => {
    el.balkIn.style.width = `${Math.round(Math.max(0, Math.min(1, deel)) * 100)}%`;
    el.laadWat.textContent = wat ? `${wat}…` : '';
  };
}

/*
 De wereld staat er — maar het spel begint pas als jij dat zegt. Zoals in GTA:
 de balk is vol, onderaan komt "klik op enter om te beginnen" te staan, en tot
 die tijd blijft het beeld staan en loopt de muziek door. Enter en de spatiebalk
 werken, en een klik of tik ook: op een telefoon is er geen Enter.
*/
export function wachtOpStart() {
  if (!el.laadKlaar) return Promise.resolve();
  const tik = matchMedia('(pointer: coarse)').matches;
  el.laadKlaar.textContent = tik ? 'Tik op het scherm om te beginnen' : 'Klik op enter om te beginnen';
  el.laadKlaar.hidden = false;
  return new Promise(klaar => {
    const af = () => {
      window.removeEventListener('keydown', opToets);
      el.laad.removeEventListener('pointerdown', opTik);
      el.laadKlaar.hidden = true;
      klaar();
    };
    const opToets = (e) => {
      if (e.code !== 'Enter' && e.code !== 'NumpadEnter' && e.code !== 'Space') return;
      e.preventDefault();
      af();
    };
    const opTik = () => af();
    window.addEventListener('keydown', opToets);
    el.laad.addEventListener('pointerdown', opTik);
    startHaak = af;            // voor de proeven: menu.__start()
  });
}

let startHaak = null;
// testhaak: het laadscherm doorklikken zonder toetsenbord
export function __start() { if (startHaak) { const f = startHaak; startHaak = null; f(); } }

// Waar main.js op wacht: de eerste keuze uit het menu.
export function wachtOpKeuze() {
  if (keuze) return Promise.resolve(keuze);
  return new Promise(r => { keuzeKlaar = r; });
}

// De keuze weer vrijgeven, zodat het menu na Esc opnieuw kan worden gebruikt.
export function volgendeKeuze() {
  keuze = null;
  return wachtOpKeuze();
}

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
*/

const TIPS = [
  'Met V wissel je tussen de camera vanuit je ogen en de camera achter je.',
  'Druk op M voor de grote kaart van de wijk.',
  'Met F5 sla je op, met F9 laad je je laatste opgeslagen spel.',
  'Bij de boerderij aan de Molenkrite koop je munitie; bij de Poiesz een flesje bier.',
  'Uit het zicht blijven laat de politie je sneller vergeten.',
  'Met [ en ] draai je de klok een uur terug of vooruit.',
  'Met Y wissel je het weer: helder, bewolkt of regen.',
  'De hele wijk komt uit de BGT en het 3D BAG — elk pand staat waar het echt staat.',
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
  return beelden;
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
  doek.style.backgroundImage = `url(${nooddoek()})`;
  const paneel = document.createElement('div'); paneel.className = 'menupaneel';
  const titel = document.createElement('h1'); titel.textContent = 'TINGA';
  const onder = document.createElement('div'); onder.className = 'menuonder'; onder.textContent = 'Sneek · open wereld op ware grootte';
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

  const voet = document.createElement('div'); voet.className = 'menuvoet';
  voet.textContent = 'De hele wijk komt uit de BGT en het 3D BAG.';
  paneel.append(voet);

  // het laadscherm zit in dezelfde wortel, zodat het met het menu mee verdwijnt
  const laad = document.createElement('div'); laad.id = 'laadscherm'; laad.hidden = true;
  const laadDoek = document.createElement('div'); laadDoek.id = 'laaddoek';
  const laadVoet = document.createElement('div'); laadVoet.id = 'laadvoet';
  const laadTitel = document.createElement('div'); laadTitel.id = 'laadtitel'; laadTitel.textContent = 'TINGA';
  const laadTip = document.createElement('div'); laadTip.id = 'laadtip';
  const balk = document.createElement('div'); balk.id = 'laadbalk';
  const balkIn = document.createElement('div'); balkIn.id = 'laadbalkin';
  balk.append(balkIn);
  const laadWat = document.createElement('div'); laadWat.id = 'laadwat';
  laadVoet.append(laadTitel, laadTip, balk, laadWat);
  laad.append(laadDoek, laadVoet);

  wortel.append(doek, paneel, laad);
  el = { wortel, paneel, lijst, knoppen, zijpaneel, laad, laadDoek, laadTip, balkIn, laadWat };
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
      ['muis', 'rondkijken · linkermuisknop = schieten · R = herladen'],
      ['E', 'praten, naar binnen, in- en uitstappen'],
      ['V', 'camera: vanuit je ogen of achter je'],
      ['M', 'grote kaart van de wijk'],
      ['in de auto', 'W/S gas en rem · A/D sturen · spatie handrem'],
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
}

export function verbergMenu() {
  if (!el.wortel) return;
  el.wortel.style.display = 'none';
  el.laad.hidden = true;
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
  const b = beelden.length ? beelden[Math.floor(Math.random() * beelden.length)] : null;
  el.laadDoek.style.backgroundImage = `url(${b ? b.url : nooddoek()})`;
  el.laadTip.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  return (deel, wat) => {
    el.balkIn.style.width = `${Math.round(Math.max(0, Math.min(1, deel)) * 100)}%`;
    el.laadWat.textContent = wat ? `${wat}…` : '';
  };
}

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

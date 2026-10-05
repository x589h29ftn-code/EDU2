/*
 Opslaan en laden van het spel.

 Eén opslagplek in de localStorage van de browser (in de Windows-app dezelfde
 plek, want die draait dezelfde pagina). Bewaard wordt alles wat je zelf
 veranderd hebt: waar je staat, waar je naar kijkt, je munitie, de tijd van de
 dag, het weer, de auto waar je in zat, waar de sloepen liggen en hoe ver het
 verhaal is.

 De wijk zelf zit er niet in: huizenrijen en objecten uit de wijkeditor hebben
 hun eigen opslag (zie js/editor.js), zodat een gewone opslag geen wijzigingen
 aan de wijk kan overschrijven.
*/
const SLEUTEL = 'tinga.spel.v1';
/*
 En een tweede plek: het checkpoint (verzoek 26 sep 2026: "na doodgaan altijd
 optie geven om vanaf het laatste checkpoint, dus na de laatste missie, te
 herstarten"). js/verhaal.js laat hem schrijven zodra er een missie afgerond is;
 hij staat los van F5, zodat je eigen opslag er nooit door overschreven wordt.
*/
const CHECKPOINT = 'tinga.checkpoint.v1';
const VERSIE = 1;

function lees(sleutel = SLEUTEL) {
  try {
    const raw = localStorage.getItem(sleutel);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.versie === VERSIE ? d : null;
  } catch { return null; }
}

export function heeftOpslag() { return lees() != null; }
export function heeftCheckpoint() { return lees(CHECKPOINT) != null; }
export function wisCheckpoint() {
  try { localStorage.removeItem(CHECKPOINT); return true; } catch { return false; }
}

/*
 Wat er in de opslagplek staat (stap 118): 'leeg', 'ok', of 'onleesbaar' (kapotte tekst, een andere
 versie of geen speler erin). Een onleesbare opslag verdween eerst stil: 'Spel laden' stond dan gewoon
 niet in het menu, en niemand wist waarom.
*/
export function opslagStaat(sleutel = SLEUTEL) {
  try {
    const raw = localStorage.getItem(sleutel);
    if (!raw) return 'leeg';
    const d = JSON.parse(raw);
    return d && d.versie === VERSIE && d.speler && Number.isFinite(d.speler.x) && Number.isFinite(d.speler.z) ? 'ok' : 'onleesbaar';
  } catch { return 'onleesbaar'; }
}

// Voor het startscherm: wanneer is er opgeslagen en waar stond je?
export function opslagInfo() {
  const d = lees();
  if (!d) return null;
  return { tijd: d.tijd || 0, straat: d.straat || '', uur: d.speeluur };
}

export function wisOpslag() {
  try { localStorage.removeItem(SLEUTEL); return true; } catch { return false; }
}

/*
 spel = { player, sfeer, vehicles, verhaal, straat }
 Geeft true als het opslaan gelukt is (localStorage kan vol of geblokkeerd zijn).
*/
export function bewaarSpel({ player, sfeer, vehicles, verhaal, boten = null, vaart = null, garage = null, straat = '', checkpoint = false }) {
  const auto = player.inCar;
  const data = {
    versie: VERSIE,
    tijd: Date.now(),
    straat,
    speeluur: sfeer ? sfeer.uur : null,
    speler: {
      x: player.pos.x, y: player.pos.y, z: player.pos.z,
      yaw: player.yaw, pitch: player.pitch,
      ammo: player.ammo, reserve: player.reserve, health: player.health,
      // welke wapens je hebt, welk je vasthoudt en wat er in het andere magazijn zit
      wapens: (player.wapens || ['pistool']).slice(),
      wapen: player.wapenSoort,
      magazijnen: { ...(player.magazijnen || {}) },
      // de C4 van missie 11
      c4: player.c4 || 0,
      // de drone van Tinga State (stap 124)
      drone: !!player.drone,
    },
    auto: auto ? {
      index: vehicles ? vehicles.cars.indexOf(auto) : -1,
      x: auto.x, z: auto.z, yaw: auto.yaw,
      // een gekochte auto (js/garage.js) staat niet op een vaste plek in de lijst
      eigen: garage ? garage.idVan(auto) : null,
    } : null,
    // de auto's die je bij Autohuis Lemmerweg gekocht hebt, en waar ze staan
    garage: garage ? garage.bewaar() : null,
    // de sloepen: waar ze liggen en of jij aan het roer stond (js/boot.js)
    boten: boten ? boten.bewaar() : null,
    // en hoe ver de lading over het water is (js/vaart.js)
    vaart: vaart ? vaart.bewaar() : null,
    sfeer: sfeer ? { uur: sfeer.uur, weer: sfeer.weer, loopt: sfeer.loopt } : null,
    verhaal: verhaal ? verhaal.bewaar() : null,
  };
  try { localStorage.setItem(checkpoint ? CHECKPOINT : SLEUTEL, JSON.stringify(data)); return true; } catch { return false; }
}

// Zet een opgeslagen spel terug. Geeft false als er niets (bruikbaars) staat.
export function laadSpel({ player, sfeer, vehicles, verhaal, boten = null, vaart = null, garage = null, checkpoint = false }) {
  const d = lees(checkpoint ? CHECKPOINT : SLEUTEL);
  // (zonder plek geen spel: anders stond de speler op NaN)
  if (!d || !d.speler || !Number.isFinite(d.speler.x) || !Number.isFinite(d.speler.z)) return false;
  const s = d.speler;
  player.pos.set(s.x, s.y || 0, s.z);
  player.yaw = s.yaw || 0;
  player.pitch = s.pitch || 0;
  player.vy = 0;
  if (typeof s.ammo === 'number') player.ammo = s.ammo;
  if (typeof s.reserve === 'number') player.reserve = s.reserve;
  /*
   De wapens. Een opslag van vóór het machinegeweer heeft dit veld niet; dan
   blijft het bij het pistool. Het wapen dat je vasthield komt terug in je hand,
   met het magazijn dat erin zat.
  */
  if (Array.isArray(s.wapens) && s.wapens.length) {
    player.wapens = s.wapens.filter(w => player.modellen && player.modellen[w]);
    if (!player.wapens.length) player.wapens = ['pistool'];
    // een opslag van vóór het mes (stap 123): je hebt het altijd
    if (player.modellen && player.modellen.mes && !player.wapens.includes('mes')) player.wapens.push('mes');
    if (s.magazijnen) player.magazijnen = { ...player.magazijnen, ...s.magazijnen };
    player.zetWapen(player.wapens.includes(s.wapen) ? s.wapen : player.wapens[0]);
    if (typeof s.ammo === 'number') player.ammo = s.ammo;
  }
  if (typeof s.health === 'number') player.health = s.health;
  player.c4 = typeof s.c4 === 'number' ? s.c4 : 0;
  player.drone = !!s.drone;
  player.reloading = 0;

  player.inCar = null;

  if (sfeer && d.sfeer) {
    if (typeof d.sfeer.uur === 'number') sfeer.uur = d.sfeer.uur;
    if (d.sfeer.weer) sfeer.weer = d.sfeer.weer;
    sfeer.loopt = !!d.sfeer.loopt;
  }
  // Eerst het verhaal: dat zet de auto en de vrachtwagen van de missies terug
  // (en maakt ze desnoods opnieuw), zodat de stoel hieronder bestaat.
  if (verhaal) verhaal.herstel(d.verhaal);
  // daarna de gekochte auto's: staat er een al op de oprit, dan is dat die (js/garage.js)
  if (garage) garage.herstel(d.garage || []);

  if (d.auto && vehicles) {
    const auto = (garage && d.auto.eigen != null) ? garage.autoVan(d.auto.eigen) : vehicles.cars[d.auto.index];
    if (auto) {
      auto.x = d.auto.x; auto.z = d.auto.z; auto.yaw = d.auto.yaw; auto.speed = 0;
      vehicles.maakBestuurbaar(auto);
      auto.mesh.position.set(auto.x, 0, auto.z); auto.mesh.rotation.y = auto.yaw;
      player.inCar = auto;
      player.lastCarYaw = undefined;
    }
  }
  // zette een missie je net zelf in een auto (de grid van de race, de Golf van Mark), dan wint die
  if (verhaal && verhaal.naLaden && verhaal.naLaden()) player.lastCarYaw = undefined;

  /*
   En de sloepen. Dit moet ná de speler, want stap je aan boord dan bepaalt de
   boot vanaf het eerste beeld waar je staat. In een auto en in een boot tegelijk
   kan niet, dus de boot wint: `herstel` zet je alleen aan boord als je er bij het
   opslaan ook in stond.
  */
  if (boten) {
    boten.herstel(d.boten);
    if (d.boten && d.boten.aanBoord >= 0) player.inCar = null;
  }
  // en de lading: die hangt aan de boot, dus hij moet ná de sloepen
  if (vaart) vaart.herstel(d.vaart);

  player.applyCamera();
  return true;
}

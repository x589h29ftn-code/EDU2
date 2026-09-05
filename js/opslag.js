/*
 Opslaan en laden van het spel.

 Eén opslagplek in de localStorage van de browser (in de Windows-app dezelfde
 plek, want die draait dezelfde pagina). Bewaard wordt alles wat je zelf
 veranderd hebt: waar je staat, waar je naar kijkt, je munitie, de tijd van de
 dag, het weer, de auto waar je in zat en hoe ver het verhaal is.

 De wijk zelf zit er niet in: huizenrijen en objecten uit de wijkeditor hebben
 hun eigen opslag (zie js/editor.js), zodat een gewone opslag geen wijzigingen
 aan de wijk kan overschrijven.
*/
const SLEUTEL = 'tinga.spel.v1';
const VERSIE = 1;

function lees() {
  try {
    const raw = localStorage.getItem(SLEUTEL);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && d.versie === VERSIE ? d : null;
  } catch { return null; }
}

export function heeftOpslag() { return lees() != null; }

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
export function bewaarSpel({ player, sfeer, vehicles, verhaal, straat = '' }) {
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
    },
    auto: auto ? {
      index: vehicles ? vehicles.cars.indexOf(auto) : -1,
      x: auto.x, z: auto.z, yaw: auto.yaw,
    } : null,
    sfeer: sfeer ? { uur: sfeer.uur, weer: sfeer.weer, loopt: sfeer.loopt } : null,
    verhaal: verhaal ? verhaal.bewaar() : null,
  };
  try { localStorage.setItem(SLEUTEL, JSON.stringify(data)); return true; } catch { return false; }
}

// Zet een opgeslagen spel terug. Geeft false als er niets (bruikbaars) staat.
export function laadSpel({ player, sfeer, vehicles, verhaal }) {
  const d = lees();
  if (!d || !d.speler) return false;
  const s = d.speler;
  player.pos.set(s.x, s.y || 0, s.z);
  player.yaw = s.yaw || 0;
  player.pitch = s.pitch || 0;
  player.vy = 0;
  if (typeof s.ammo === 'number') player.ammo = s.ammo;
  if (typeof s.reserve === 'number') player.reserve = s.reserve;
  if (typeof s.health === 'number') player.health = s.health;
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

  if (d.auto && vehicles) {
    const auto = vehicles.cars[d.auto.index];
    if (auto) {
      auto.x = d.auto.x; auto.z = d.auto.z; auto.yaw = d.auto.yaw; auto.speed = 0;
      vehicles.maakBestuurbaar(auto);
      auto.mesh.position.set(auto.x, 0, auto.z); auto.mesh.rotation.y = auto.yaw;
      player.inCar = auto;
      player.lastCarYaw = undefined;
    }
  }
  player.applyCamera();
  return true;
}

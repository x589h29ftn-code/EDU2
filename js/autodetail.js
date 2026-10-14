/*
 Remlichten, achteruitrijlicht, wielen en de bestuurder van een rijdende auto (stap 172).

 Gevraagd: remlichten die oplichten bij het remmen (fel, ook overdag, helderder dan het achterlicht 's nachts), een
 wit licht als hij achteruit rijdt, een bestuurder achter het stuur, en wielen die meesturen en rollen.

 Wat er al was (gemeten): de auto waar je in zit had losse wielen, maar alleen de band rolde — en een band is rondom
 gelijk, dus je zag niets draaien; de naaf met de spaken stond stil. Het remlicht en het achteruitrijlicht van die
 auto werkten, maar alleen op jouw toetsen: een auto uit `voegToe` die over een lijn rijdt (Bouwman, de handlangers,
 de ambulance) gaf geen `rem` mee en remde dus nooit met licht. Het verkeer had niets: geen losse wielen, geen
 remlicht (`t.remlicht` in js/vehicles.js werd nergens gezet) en niemand achter het stuur.

 Hoe het nu gaat. Alles leest de beweging af in plaats van in de rijcode te graven, zodat het werkt welke remlogica
 er ook komt:
   - wielen rollen over de afgelegde weg langs de neus (hoek = afstand / straal), dus ook achteruit en ook als een
     missie de auto zelf verplaatst zonder `speed` te zetten; een sprong (verhuizen, laden) telt niet;
   - de voorwielen sturen met `car.steer`, en zonder stuur (een lijn, het verkeer) met de stuurhoek die bij de
     draaisnelheid hoort: tan(stuur) = draai · wielbasis / snelheid;
   - het remlicht: met toetsen (de speler, de politie via `drive`) de rem of de handrem; anders de vertraging, boven
     `remDrempel` m/s², en het blijft branden als hij zo tot stilstand remt (de voet op de rem) tot hij optrekt;
   - het achteruitrijlicht: zodra hij achteruit rijdt;
   - de bestuurder: in het verkeer altijd (dichtbij), in een auto uit `voegToe` als hij de laatste `bestuurderNa`
     seconden zelf reed, en in jouw auto alleen als je van buiten kijkt (js/main.js `spelerInAuto`).
 Licht is hier een emissief materiaal dat aan- of uitgaat, nooit een lamp: het aantal lichtbronnen blijft gelijk
 (CLAUDE.md, stap 83).
*/
import { bestuurderGeo, BESTUURDER } from './bestuurder.js';
import { autoMaat } from './carmodel.js';

export const AUTODETAIL = {
  remDrempel: 1.6,     // m/s²: zo hard vertragen is remmen (uitrollen op de motor is ~2,4 bij de speler, maar die geeft toetsen)
  remNa: 0.35,         // s: zo lang blijft het remlicht na de laatste vertraging branden
  achteruit: -0.2,     // m/s
  stuurMax: 0.6,       // rad, de grootste uitslag van de voorwielen
  bestuurderNa: 6,     // s: zo lang na het laatste stuk rijden zit er nog iemand in een auto uit `voegToe`
  verVanaf: 90,        // m: verder weg krijgt het verkeer de samengevoegde wielen en geen bestuurder
  sprong: 8,           // m in één beeld: dat is verplaatst, niet gereden
};

const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const klok = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

/*
 Het hart: uit de verplaatsing van (x, z, yaw) sinds het vorige beeld de rolhoek, de stuurhoek en het remmen.
 `st` is het geheugen per auto, `v` de snelheid als die bekend is (anders uit de verplaatsing), `invoer` de toetsen.
*/
function werk(st, u, x, z, yaw, dt, v, steer, invoer, wielbasis) {
  if (!st.init) { st.init = true; st.x = x; st.z = z; st.yaw = yaw; st.v = v || 0; st.remT = 0; st.rem = false; st.steer = 0; }
  const dx = x - st.x, dz = z - st.z, d = Math.hypot(dx, dz);
  const sprong = d > Math.max(AUTODETAIL.sprong, 70 * dt);
  // langs de neus: die wijst naar −z van het model, dus (−sin yaw, −cos yaw)
  const langs = sprong ? 0 : -(dx * Math.sin(yaw) + dz * Math.cos(yaw));
  const dyaw = sprong ? 0 : wrap(yaw - st.yaw);
  st.x = x; st.z = z; st.yaw = yaw;
  const vNu = v != null ? v : (dt > 0 ? langs / dt : st.v);
  // (afgevlakt als hij uit de verplaatsing komt: een lijn met ongelijke stapjes gaf anders een knipperend remlicht)
  const vGlad = v != null ? vNu : st.v + (vNu - st.v) * Math.min(1, dt * 8);
  // (de verandering van de vaart, vooruit en achteruit gelijk: uit een achteruit tot stilstand remmen is ook remmen)
  const versnel = dt > 0 ? (Math.abs(vGlad) - Math.abs(st.v)) / dt : 0;
  st.v = vGlad;
  st.langs = langs;
  if (Math.abs(langs) > 0.002) st.rijdT = klok();

  // ---- stuurhoek ----
  let stuur = steer;
  if (stuur == null) {
    if (Math.abs(vGlad) > 0.6 && dt > 0) stuur = Math.atan((dyaw / dt) * wielbasis / vGlad);
    else stuur = st.steer;
  }
  stuur = Math.max(-AUTODETAIL.stuurMax, Math.min(AUTODETAIL.stuurMax, stuur || 0));
  st.steer += (stuur - st.steer) * Math.min(1, dt * 10);

  // ---- remmen ----
  let rem;
  if (invoer && ('rem' in invoer || 'hand' in invoer)) {
    rem = !!(invoer.hand || (invoer.rem && vGlad > 0.2));
    st.remT = 0;
  } else {
    if (Math.abs(vGlad) > 0.2 && -versnel > AUTODETAIL.remDrempel) st.remT = AUTODETAIL.remNa;
    else if (versnel > 0.4) st.remT = 0;                         // hij trekt op: voet van de rem
    else st.remT = Math.max(0, st.remT - dt);
    // tot stilstand geremd: de voet blijft op de rem tot hij weer optrekt
    const vastGeremd = st.rem && Math.abs(vGlad) < 0.25 && versnel <= 0.4;
    rem = st.remT > 0 || vastGeremd;
  }
  st.rem = rem;
  st.achteruit = vGlad < AUTODETAIL.achteruit;

  // ---- op het model ----
  if (!u) return;
  if (u.wielen) {
    const R = u.R || 0.32;
    const rol = langs / R;
    for (const w of u.wielen) {
      if (w.stuur) w.groep.rotation.y = st.steer;
      if (w.band) w.band.rotation.x -= rol;
      if (w.naaf) w.naaf.rotation.x -= rol;
    }
  }
  if (u.rem) u.rem.visible = rem;
  if (u.achteruit) u.achteruit.visible = st.achteruit;
}

/*
 Een auto uit `vehicles.cars` met een eigen model: de speler, de politie, de missie-auto's. Aangeroepen uit
 js/vehicles.js `zetNeer`. `invoer` zijn de toetsen als die er zijn ({ gas, rem, hand }); zonder toetsen leest hij
 het remmen af aan de vertraging.
*/
export function werkAutoBij(car, dt, invoer = {}) {
  const u = car && car.mesh && car.mesh.userData;
  if (!u) return;
  const st = car._detail || (car._detail = {});
  const toetsen = invoer && ('rem' in invoer || 'hand' in invoer) ? invoer : null;
  // de snelheid: `speed` als de auto zelf rijdt (drive), anders uit de verplaatsing
  // (js/inval.js geeft toetsen mee maar zet geen `speed`: dan ook uit de verplaatsing)
  const v = toetsen && Math.abs(car.speed || 0) > 0.01 ? car.speed : null;
  const steer = toetsen && car.speed ? car.steer : (Math.abs(car.steer || 0) > 1e-4 ? car.steer : null);
  werk(st, u, car.x, car.z, car.yaw, dt, v, steer, toetsen, (car.as || 1.4) * 2);
  if (u.bestuurder) u.bestuurder.visible = bestuurderZichtbaar(car, st);
}

function bestuurderZichtbaar(car, st) {
  if (car.metBestuurder === true) return true;
  if (car.metBestuurder === false) return false;
  // jouw auto: alleen van buiten, en alleen zolang js/main.js zegt dat je erin zit
  if (car._speler) return !!car._spelerDerde && klok() - car._spelerT < 0.5;
  if (car.wrak || car.hp <= 0) return false;
  return st.rijdT != null && klok() - st.rijdT < AUTODETAIL.bestuurderNa;
}

/**
 * js/main.js, elk beeld dat je in een auto zit: `derde` is de derde persoon (dan zit Erik zichtbaar achter het stuur).
 */
export function spelerInAuto(car, derde) {
  if (!car) return;
  car._speler = true;
  car._spelerDerde = !!derde;
  car._spelerT = klok();
  const u = car.mesh && car.mesh.userData, b = u && u.bestuurder;
  if (!b) return;
  // in jouw auto zit Erik, in zijn eigen kleren
  if (!b.userData.erik && u.soort) {
    b.geometry = bestuurderGeo(`${u.soort}|erik`, autoMaat(u.soort), BESTUURDER.erik);
    b.userData.plek = b.geometry.userData.plek;
    b.userData.erik = true;
  }
  b.visible = !!derde;
}

/** Op afstand: de samengevoegde wielen in plaats van de losse, en geen bestuurder (het verkeer). */
export function zetVer(u, ver) {
  const L = u && u.lod;
  if (!L || L.ver_ === ver) return;
  L.ver_ = ver;
  for (const m of L.dicht) m.visible = !ver;
  for (const m of L.ver) m.visible = ver;
  for (const w of u.wielen) w.groep.visible = !ver;
  if (u.bestuurder) u.bestuurder.visible = !ver;
}

/*
 Een auto uit het verkeer (`vehicles.traffic`). Aangeroepen aan het eind van `updateTraffic`, nadat hij op zijn plek
 staat. `t.snelheid` is de snelheid langs de weg (negatief als hij achteruit wil, js/vehicles.js `schrikAf`); de
 rijrichting en de stuurhoek komen uit de verplaatsing van het model.
*/
export function werkVerkeerBij(t, dt, camX = null, camZ = null) {
  const m = t.mesh, u = m && m.userData;
  if (!u || !u.verkeer) return;
  const st = t._detail || (t._detail = {});
  if (camX != null) zetVer(u, Math.hypot(m.position.x - camX, m.position.z - camZ) > AUTODETAIL.verVanaf);
  const wb = t.soort === 'truck' ? 4.4 : t.soort === 'van' ? 3.24 : 2.64;
  werk(st, u, m.position.x, m.position.z, m.rotation.y, dt, typeof t.snelheid === 'number' ? t.snelheid : null, null, null, wb);
}

/** Voor proeven: wat de auto nu laat zien. */
export function detailStand(car) {
  const u = car && car.mesh && car.mesh.userData;
  const st = car && car._detail;
  return {
    rem: !!(u && u.rem && u.rem.visible), achteruit: !!(u && u.achteruit && u.achteruit.visible),
    bestuurder: !!(u && u.bestuurder && u.bestuurder.visible),
    stuur: st ? st.steer : 0, v: st ? st.v : 0,
    rol: u && u.wielen && u.wielen[2] && u.wielen[2].naaf ? u.wielen[2].naaf.rotation.x : 0,
  };
}

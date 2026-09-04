/*
 De bewaking op het terrein van de waterzuivering.

 Vijf bewakers lopen hun rondje over het erf. Zolang je buiten het hek blijft
 doen ze niets. Kom je binnen het hek en zien ze je — recht vooruit, binnen
 zicht, en niet achter een gebouw of de vrachtwagen — of horen ze je schieten,
 dan slaat het alarm en komen ze alle vijf op je af. Ze mikken, vuren en raken
 je vaker naarmate ze dichterbij staan; je levensbalk loopt dan leeg.

 Eén treffer van het pistool legt een bewaker neer.
*/
import { Persoon } from './persoon.js';
import { resolveCollisions, zichtVrij } from './world.js';
import { geluid } from './audio.js';

const ZICHT = 34;          // hoe ver ze je zien (m)
const GEZICHTSVELD = 1.25; // halve openingshoek (rad), ruim 70 graden
const GEHOOR = 90;         // een schot horen ze verder dan ze kijken (m)
const LOOP = 1.3;          // patrouilletempo (m/s)
const REN = 3.2;           // als het alarm af is (m/s)
const DEKKING = 9;         // op zoveel meter blijven ze staan en vuren
const VUURTIJD = 1.7;      // seconden tussen twee schoten
const VUURBEREIK = 42;     // verder dan dit vuren ze niet
const SCHADE = 6;          // levenspunten per treffer

const KLEUREN = [
  { shirt: 0x27303c, broek: 0x1d2430 },
  { shirt: 0x2b3542, broek: 0x22293a },
  { shirt: 0x323c48, broek: 0x1d2430 },
  { shirt: 0x27303c, broek: 0x252c38 },
  { shirt: 0x2e3846, broek: 0x1f2734 },
];

export class Bewaking {
  /*
   posten: [{ a: [x,z], b: [x,z] }] – het lijnstuk waarover een bewaker
   heen en weer loopt.
  */
  constructor(scene, posten) {
    this.scene = scene;
    this.alarm = false;
    this.wachters = posten.map((post, i) => {
      const kleur = KLEUREN[i % KLEUREN.length];
      const persoon = new Persoon({ ...kleur, huid: i % 2 ? 0xd9b48f : 0xc79a72, hoogte: 0.99 + (i % 3) * 0.02, wapen: true, pet: true });
      scene.add(persoon.groep);
      const start = post.a;
      persoon.zetNeer(start[0], start[1], Math.atan2(-(post.b[0] - post.a[0]), -(post.b[1] - post.a[1])));
      return {
        i, persoon, post, naarB: true, wacht: 0,
        staat: 'patrouille',      // patrouille | zoekt | aanval | neer
        vuurT: VUURTIJD * (0.4 + i * 0.2),
        kijkT: i * 0.07,
        zicht: false,
        doel: null,               // waar hij naartoe loopt bij 'zoekt'
        omT: 0,
      };
    });
  }

  get aantal() { return this.wachters.length; }
  get neer() { return this.wachters.filter(w => w.staat === 'neer').length; }
  get alleNeer() { return this.neer === this.aantal; }
  // raycast-doelen voor het pistool van de speler
  doelen() { return this.wachters.filter(w => w.staat !== 'neer').map(w => w.persoon.groep); }

  // Een schot van de speler: alles binnen gehoorafstand komt in beweging.
  hoorSchot(x, z) {
    let gehoord = false;
    for (const w of this.wachters) {
      if (w.staat === 'neer') continue;
      const p = w.persoon.groep.position;
      if (Math.hypot(p.x - x, p.z - z) > GEHOOR) continue;
      gehoord = true;
      if (w.staat === 'patrouille') { w.staat = 'zoekt'; w.doel = [x, z]; }
    }
    if (gehoord) this.alarm = true;
    return gehoord;
  }

  // obj = de geraakte mesh; loop omhoog tot we een bewaker vinden.
  raak(obj) {
    let p = obj;
    while (p) {
      const w = this.wachters.find(q => q.persoon.groep === p);
      if (w) {
        if (w.staat === 'neer') return false;
        w.staat = 'neer';
        w.omT = 0;
        this.alarm = true;      // de rest hoort hem vallen
        for (const ander of this.wachters) if (ander.staat === 'patrouille') ander.staat = 'zoekt';
        return true;
      }
      p = p.parent;
    }
    return false;
  }

  // Lopen met botsingen; geeft true als hij er (ongeveer) is.
  loopNaar(w, doel, dt, snelheid) {
    const pos = w.persoon.groep.position;
    let dx = doel[0] - pos.x, dz = doel[1] - pos.z;
    const afst = Math.hypot(dx, dz);
    if (afst < 0.6) return true;
    dx /= afst; dz /= afst;
    const stap = Math.min(afst, snelheid * dt);
    for (const draai of [0, 0.7, -0.7, 1.4, -1.4]) {
      const c = Math.cos(draai), s = Math.sin(draai);
      const rx = dx * c - dz * s, rz = dx * s + dz * c;
      const nx = pos.x + rx * stap, nz = pos.z + rz * stap;
      const [kx, kz] = resolveCollisions(nx, nz, 0.34);
      if (Math.hypot(kx - nx, kz - nz) < 0.02) {
        pos.x = kx; pos.z = kz;
        w.persoon.draaiNaar(Math.atan2(-rx, -rz), dt, 6);
        return false;
      }
    }
    return false;
  }

  /*
   Eén beeld. `opTerrein` zegt of de speler binnen het hek staat; buiten het hek
   beginnen ze niets uit zichzelf. Geeft de schade terug die de speler dit beeld
   opliep, en meldt via onSchot dat er gevuurd is (voor het geluid).
  */
  update(dt, speler, opTerrein) {
    const sp = speler.inCar ? speler.inCar : speler.pos;
    let schade = 0;
    for (const w of this.wachters) {
      const persoon = w.persoon;
      const pos = persoon.groep.position;

      if (w.staat === 'neer') {
        if (w.omT < 1) { w.omT = Math.min(1, w.omT + dt * 1.8); persoon.legNeer(w.omT); }
        continue;
      }

      const dSp = Math.hypot(sp.x - pos.x, sp.z - pos.z);

      // kijken: een paar keer per seconde, niet elk beeld
      w.kijkT -= dt;
      if (w.kijkT <= 0) {
        w.kijkT = 0.3;
        let zien = false;
        if (dSp < ZICHT && (opTerrein || this.alarm)) {
          const hoek = Math.atan2(-(sp.x - pos.x), -(sp.z - pos.z));
          let d = hoek - persoon.yaw;
          while (d > Math.PI) d -= Math.PI * 2;
          while (d < -Math.PI) d += Math.PI * 2;
          if (Math.abs(d) < GEZICHTSVELD || this.alarm) {
            zien = zichtVrij(pos.x, pos.z, sp.x, sp.z, 1.2);
          }
        }
        w.zicht = zien;
        if (zien) { this.alarm = true; w.staat = 'aanval'; }
        else if (w.staat === 'aanval') { w.staat = 'zoekt'; w.doel = [sp.x, sp.z]; }
      }

      if (w.staat === 'aanval') {
        const dichtbij = dSp < DEKKING;
        if (!dichtbij) this.loopNaar(w, [sp.x, sp.z], dt, REN);
        persoon.kijkNaar(sp.x, sp.z, dt, 7);
        persoon.update(dt, { loopt: !dichtbij, mikt: true, snelheid: REN });
        w.vuurT -= dt;
        if (w.vuurT <= 0 && dSp < VUURBEREIK) {
          w.vuurT = VUURTIJD * (0.8 + Math.random() * 0.5);
          persoon.vuur();
          geluid.schot();
          const kans = Math.max(0.08, 0.55 - dSp * 0.012);
          if (Math.random() < kans) schade += SCHADE;
        }
        continue;
      }

      if (w.staat === 'zoekt') {
        const doel = w.doel || w.post.a;
        const erIs = this.loopNaar(w, doel, dt, REN);
        persoon.update(dt, { loopt: !erIs, mikt: true, snelheid: REN });
        if (erIs) {
          // niets gevonden: rondkijken en terug naar de patrouille
          w.wacht = (w.wacht || 0) + dt;
          persoon.draaiNaar(persoon.yaw + 1.2, dt, 1.2);
          if (w.wacht > 4) { w.wacht = 0; w.staat = 'patrouille'; w.doel = null; }
        }
        continue;
      }

      // patrouille: heen en weer over de post
      if (w.wacht > 0) {
        w.wacht -= dt;
        persoon.update(dt, {});
        continue;
      }
      const doel = w.naarB ? w.post.b : w.post.a;
      if (this.loopNaar(w, doel, dt, LOOP)) { w.naarB = !w.naarB; w.wacht = 1.5; }
      persoon.update(dt, { loopt: true, snelheid: LOOP });
    }
    return schade;
  }

  bewaar() {
    return {
      alarm: this.alarm,
      wachters: this.wachters.map(w => ({
        staat: w.staat, x: w.persoon.groep.position.x, z: w.persoon.groep.position.z,
        yaw: w.persoon.yaw, omT: w.omT,
      })),
    };
  }

  herstel(s) {
    if (!s || !Array.isArray(s.wachters)) return;
    this.alarm = !!s.alarm;
    s.wachters.forEach((d, i) => {
      const w = this.wachters[i];
      if (!w) return;
      w.staat = d.staat || 'patrouille';
      w.doel = null; w.wacht = 0; w.zicht = false;
      w.persoon.zetNeer(d.x, d.z, d.yaw || 0);
      w.omT = w.staat === 'neer' ? 1 : 0;
      w.persoon.legNeer(w.omT);
    });
  }

  // Alles terug naar het begin (bij het opnieuw beginnen van de missie).
  reset() {
    this.alarm = false;
    for (const w of this.wachters) {
      w.staat = 'patrouille'; w.naarB = true; w.wacht = 0; w.doel = null; w.omT = 0; w.zicht = false;
      w.persoon.legNeer(0);
      w.persoon.zetNeer(w.post.a[0], w.post.a[1], Math.atan2(-(w.post.b[0] - w.post.a[0]), -(w.post.b[1] - w.post.a[1])));
    }
  }

  verwijder() {
    for (const w of this.wachters) this.scene.remove(w.persoon.groep);
    this.wachters.length = 0;
  }
}

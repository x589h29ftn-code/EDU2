/*
 De dief van De Wieken 27.

 Hij slentert over het trottoir voor zijn huis in zijn opvallende kleren: felrood
 shirt, kanariegele broek en een wit petje. Kom je binnen vijftien meter en ziet
 hij je, dan schrikt hij en zet hij het op een lopen — over de stoep, door de
 brandgangen, waar hij ook maar naartoe kan. Hij rent net iets langzamer dan een
 sprintende speler, dus je haalt hem langzaam in; na anderhalve minuut rennen is
 hij op en wankelt hij verder op wandeltempo. Kom je dan binnen armlengte, dan
 heb je hem.

 De vluchtroutes komen uit js/navigatie.js: de graaf van alle wegassen en
 padassen uit de kaart. Hij kiest steeds een knoop ver weg, van jou af.
*/
import { Persoon } from './persoon.js';
import { resolveCollisions, zichtVrij } from './world.js';

const SLENTER = 1.05;      // m/s over het trottoir
const VLUCHT = 7.3;        // m/s — net iets minder dan de sprint van de speler (7,5)
const UITGEPUT = 1.75;     // m/s als hij op is
const OP_NA = 90;          // na zoveel seconden rennen is hij op
const ZIET_JE = 15;        // op deze afstand kijkt hij om
const PAKAFSTAND = 1.8;    // zo dicht bij is hij te pakken
const RAM_AFSTAND = 3.4;   // met een auto of vrachtwagen mag het van verder

export class Dief {
  /*
   post: {a:[x,z], b:[x,z]} – het stukje trottoir waar hij heen en weer slentert
   navigatie: js/navigatie.js, voor de vluchtroutes
  */
  constructor(scene, { post, navigatie }) {
    this.scene = scene;
    this.post = post;
    this.nav = navigatie;
    this.persoon = new Persoon({
      shirt: 0xd8232a, broek: 0xf2d024, huid: 0xd9b48f, hoogte: 0.99,
      pet: true, petKleur: 0xf4f4f4,
    });
    scene.add(this.persoon.groep);
    this.persoon.zetNeer(post.a[0], post.a[1], Math.atan2(-(post.b[0] - post.a[0]), -(post.b[1] - post.a[1])));
    this.staat = 'slentert';     // slentert | schrikt | vlucht | uitgeput | gepakt
    this.naarB = true;
    this.wacht = 0;
    this.vluchtT = 0;            // hoelang hij al rent
    this.schrikT = 0;
    this.route = null;
    this.routeIdx = 0;
    this.kiesT = 0;
    this.omT = 0;
  }

  get positie() { return this.persoon.groep.position; }
  get doelen() { return this.staat === 'gepakt' ? [] : [this.persoon.groep]; }
  get rent() { return this.staat === 'vlucht'; }
  get seconden() { return this.vluchtT; }

  // Is dit de dief? (voor de raycast van het pistool)
  isDief(obj) {
    let p = obj;
    while (p) { if (p === this.persoon.groep) return true; p = p.parent; }
    return false;
  }

  afstandTot(punt) { return Math.hypot(punt.x - this.positie.x, punt.z - this.positie.z); }

  // Ziet hij de speler? Alleen binnen vijftien meter en met vrij zicht.
  zietSpeler(sp) {
    if (this.staat !== 'slentert') return false;
    const d = this.afstandTot(sp);
    if (d > ZIET_JE) return false;
    return zichtVrij(this.positie.x, this.positie.z, sp.x, sp.z, 1.2);
  }

  schrik() { if (this.staat === 'slentert') { this.staat = 'schrikt'; this.schrikT = 1.1; } }
  pak() { if (this.staat !== 'gepakt') { this.staat = 'gepakt'; this.omT = 0; return true; } return false; }

  // Kan de speler hem nu pakken? In een auto mag het van iets verder.
  binnenBereik(speler) {
    if (this.staat === 'gepakt') return false;
    const sp = speler.inCar ? speler.inCar : speler.pos;
    const d = this.afstandTot(sp);
    return d < (speler.inCar ? RAM_AFSTAND : PAKAFSTAND);
  }

  // ---------- vluchten ----------
  kiesRoute(sp) {
    if (!this.nav) return;
    const pos = this.positie;
    let wegX = pos.x - sp.x, wegZ = pos.z - sp.z;
    const L = Math.hypot(wegX, wegZ) || 1;
    wegX /= L; wegZ /= L;
    let beste = null, besteScore = -Infinity;
    for (let poging = 0; poging < 40; poging++) {
      const i = Math.floor(Math.random() * this.nav.punten.length);
      const q = this.nav.punten[i];
      const d = Math.hypot(q[0] - pos.x, q[1] - pos.z);
      if (d < 60 || d > 170) continue;
      const score = ((q[0] - pos.x) / d) * wegX + ((q[1] - pos.z) / d) * wegZ + d / 400;
      if (score > besteScore) { besteScore = score; beste = q; }
    }
    if (!beste) return;
    const route = this.nav.route([pos.x, pos.z], [beste[0], beste[1]]);
    if (route && route.length > 2) { this.route = route; this.routeIdx = 1; }
    this.kiesT = 5 + Math.random() * 3;
  }

  // Lopen naar een punt; probeert er schuin langs als er iets in de weg staat.
  stap(doel, dt, snelheid) {
    const pos = this.positie;
    let dx = doel[0] - pos.x, dz = doel[1] - pos.z;
    const a = Math.hypot(dx, dz);
    if (a < 1.0) return true;
    dx /= a; dz /= a;
    const s = Math.min(a, snelheid * dt);
    for (const draai of [0, 0.5, -0.5, 1.1, -1.1, 1.9, -1.9]) {
      const c = Math.cos(draai), si = Math.sin(draai);
      const rx = dx * c - dz * si, rz = dx * si + dz * c;
      const nx = pos.x + rx * s, nz = pos.z + rz * s;
      const [kx, kz] = resolveCollisions(nx, nz, 0.32);
      if (Math.hypot(kx - nx, kz - nz) < 0.02) {
        pos.x = kx; pos.z = kz;
        this.persoon.draaiNaar(Math.atan2(-rx, -rz), dt, 8);
        return false;
      }
    }
    const [kx, kz] = resolveCollisions(pos.x + dx * s, pos.z + dz * s, 0.32);
    pos.x = kx; pos.z = kz;
    return false;
  }

  /*
   Eén beeld. Geeft terug wat er gebeurd is, zodat het verhaal erop kan
   reageren: 'op' als hij net buiten adem raakt.
  */
  update(dt, speler) {
    const sp = speler.inCar ? speler.inCar : speler.pos;
    const p = this.persoon;
    let melding = null;

    if (this.staat === 'gepakt') {
      if (this.omT < 1) { this.omT = Math.min(1, this.omT + dt * 2.2); p.legNeer(this.omT); }
      return melding;
    }

    if (this.staat === 'slentert') {
      if (this.wacht > 0) { this.wacht -= dt; p.update(dt, {}); return melding; }
      const doel = this.naarB ? this.post.b : this.post.a;
      if (this.stap(doel, dt, SLENTER)) { this.naarB = !this.naarB; this.wacht = 1.2; }
      p.update(dt, { loopt: true, snelheid: SLENTER });
      return melding;
    }

    if (this.staat === 'schrikt') {
      // even omkijken en schreeuwen, dan wegwezen
      this.schrikT -= dt;
      p.kijkNaar(sp.x, sp.z, dt, 8);
      p.update(dt, {});
      if (this.schrikT <= 0) { this.staat = 'vlucht'; this.vluchtT = 0; this.kiesRoute(sp); }
      return melding;
    }

    // vluchten of wankelen
    const rennen = this.staat === 'vlucht';
    if (rennen) {
      this.vluchtT += dt;
      if (this.vluchtT >= OP_NA) { this.staat = 'uitgeput'; melding = 'op'; }
    }
    const snelheid = rennen ? VLUCHT : UITGEPUT;
    this.kiesT -= dt;
    const dichtbij = this.afstandTot(sp) < 9;
    if (!this.route || this.routeIdx >= this.route.length || (this.kiesT <= 0 && dichtbij)) this.kiesRoute(sp);
    if (this.route && this.routeIdx < this.route.length) {
      if (this.stap(this.route[this.routeIdx], dt, snelheid)) this.routeIdx++;
    } else {
      // geen route: gewoon van de speler af
      const weg = [this.positie.x + (this.positie.x - sp.x), this.positie.z + (this.positie.z - sp.z)];
      this.stap(weg, dt, snelheid);
    }
    p.update(dt, { loopt: true, snelheid });
    // wie op is, wankelt
    p.groep.rotation.z = rennen ? 0 : Math.sin(p.klok * 3.1) * 0.09;
    return melding;
  }

  bewaar() {
    return {
      staat: this.staat, x: this.positie.x, z: this.positie.z, yaw: this.persoon.yaw,
      vluchtT: this.vluchtT, omT: this.omT,
    };
  }

  herstel(s) {
    if (!s) return;
    this.staat = s.staat || 'slentert';
    this.persoon.zetNeer(s.x, s.z, s.yaw || 0);
    this.vluchtT = s.vluchtT || 0;
    this.route = null; this.routeIdx = 0; this.kiesT = 0; this.wacht = 0;
    this.omT = this.staat === 'gepakt' ? 1 : 0;
    this.persoon.legNeer(this.omT);
    this.persoon.groep.rotation.z = 0;
  }

  reset() {
    this.staat = 'slentert';
    this.naarB = true; this.wacht = 0; this.vluchtT = 0; this.route = null; this.routeIdx = 0; this.omT = 0;
    this.persoon.legNeer(0);
    this.persoon.groep.rotation.z = 0;
    this.persoon.zetNeer(this.post.a[0], this.post.a[1],
      Math.atan2(-(this.post.b[0] - this.post.a[0]), -(this.post.b[1] - this.post.a[1])));
  }
}

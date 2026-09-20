/*
 De pandwijzer: welk pand staat daar, en hoe heet het in de data?

 Waarom dit er is. Een plek doorgeven kon al met **K** — dat zet je eigen x en z
 op het klembord. Maar een plek is niet hetzelfde als een pand: op 20 september
 kreeg het verkeerde gebouw de Ranzijn-stijl, want uit "het grote pand langs de
 rondweg" moest ik zelf raden wélk van de twee grote panden daar bedoeld werd, en
 dat werd de buurman (0091100000015459 in plaats van 0091100000019457, honderd
 meter ernaast). Met **P** hoeft er niets meer geraden te worden: je kijkt het
 pand aan, drukt op P, en het BAG-pandnummer staat op je klembord.

 Hoe het zoeken werkt. Niet met een raycast op de meshes: de gevels van de hele
 kaart zitten samengevoegd in een paar honderd meshes en een mesh weet niet bij
 welk pand hij hoort. In plaats daarvan loopt er een straal over de plattegrond,
 vanaf waar jij staat de kijkrichting op, met stapjes van veertig centimeter tot
 honderdzestig meter ver, en bij elk stapje wordt gekeken of dat punt binnen een
 grondvlak valt. Het eerste pand dat geraakt wordt is het pand dat je aankijkt.

 De hoogte telt niet mee: het is een plattegrondvraag. Kijk je naar de stoep
 vlak voor een huis, dan krijg je dat huis — dat is precies wat je bedoelt, en
 het scheelt dat je niet eerst omhoog hoeft te kijken.

 Vind de straal niets (je staat met je rug naar de wijk, of je kijkt over het
 water), dan pakt hij het dichtstbijzijnde pand binnen dertig meter, zodat
 "ik sta hier pal naast" ook werkt.

 Het rooster eronder is hetzelfde patroon als elders in de kaart: cellen van
 veertig meter met de panden waarvan de omhullende rechthoek de cel raakt.
 Zonder rooster zou elk stapje langs alle 7885 grondvlakken moeten.
*/

const CEL = 40;
const STAP = 0.4;
const VER = 160;
const NAAST = 30;

const inRing = (r, x, z) => {
  let binnen = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i], b = r[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) binnen = !binnen;
  }
  return binnen;
};

export function maakPandWijzer(KAART) {
  const net = new Map();
  const vakken = [];
  for (const p of KAART.panden) {
    if (!p.voet || p.voet.length < 3) continue;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, cx = 0, cz = 0, opp = 0;
    for (const q of p.voet) {
      if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0];
      if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1];
      cx += q[0]; cz += q[1];
    }
    for (let i = 0; i < p.voet.length; i++) {
      const u = p.voet[i], v = p.voet[(i + 1) % p.voet.length];
      opp += u[0] * v[1] - v[0] * u[1];
    }
    const vak = { p, x0, x1, z0, z1, cx: cx / p.voet.length, cz: cz / p.voet.length, opp: Math.abs(opp / 2) };
    vakken.push(vak);
    for (let i = Math.floor(x0 / CEL); i <= Math.floor(x1 / CEL); i++) {
      for (let j = Math.floor(z0 / CEL); j <= Math.floor(z1 / CEL); j++) {
        const k = i + ',' + j;
        let lijst = net.get(k);
        if (!lijst) { lijst = []; net.set(k, lijst); }
        lijst.push(vak);
      }
    }
  }

  const op = (x, z) => {
    const lijst = net.get(Math.floor(x / CEL) + ',' + Math.floor(z / CEL));
    if (!lijst) return null;
    for (const v of lijst) {
      if (x < v.x0 || x > v.x1 || z < v.z0 || z > v.z1) continue;
      if (inRing(v.p.voet, x, z)) return v;
    }
    return null;
  };

  // de rand van een grondvlak, voor het geval de straal niets raakt
  const randAfstand = (v, x, z) => {
    const dx = Math.max(v.x0 - x, 0, x - v.x1);
    const dz = Math.max(v.z0 - z, 0, z - v.z1);
    return Math.hypot(dx, dz);
  };

  return {
    aantal: vakken.length,
    /*
     `yaw` is de kijkrichting zoals de speler hem heeft: vooruit is
     (−sin yaw, −cos yaw) — dezelfde afspraak als overal in het spel.
    */
    zoek(x, z, yaw) {
      const vx = -Math.sin(yaw), vz = -Math.cos(yaw);
      for (let d = 0; d <= VER; d += STAP) {
        const v = op(x + vx * d, z + vz * d);
        if (v) return { ...v, afstand: d, hoe: 'vizier' };
      }
      let dichtst = null, best = NAAST;
      const i0 = Math.floor((x - NAAST) / CEL), i1 = Math.floor((x + NAAST) / CEL);
      const j0 = Math.floor((z - NAAST) / CEL), j1 = Math.floor((z + NAAST) / CEL);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        for (const v of net.get(i + ',' + j) || []) {
          const d = randAfstand(v, x, z);
          if (d < best) { best = d; dichtst = v; }
        }
      }
      return dichtst ? { ...dichtst, afstand: best, hoe: 'dichtstbij' } : null;
    },
  };
}

/*
 De regel die op het klembord komt. Alles wat ik nodig heb om het pand terug te
 vinden staat erin, met het BAG-pandnummer voorop: dat is de sleutel in het blok
 `panden` van data/stijl/straten.json.
*/
export function pandRegel(v) {
  if (!v) return null;
  const p = v.p;
  const naam = [p.straat, (p.nr && p.nr.length) ? p.nr.join('/') : null].filter(Boolean).join(' ');
  const deel = [
    p.id,
    p.type || '(geen type)',
    naam || '(geen adres)',
    `${Math.round(v.opp)} m2`,
    `goot ${(p.goot ?? 0).toFixed(1)} nok ${(p.nok ?? 0).toFixed(1)}${p.schat ? ' (geschat)' : ''}`,
    `midden ${v.cx.toFixed(1)} / ${v.cz.toFixed(1)}`,
  ];
  return deel.join(' · ');
}

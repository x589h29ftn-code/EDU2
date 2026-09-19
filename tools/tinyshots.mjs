/*
 Foto's van de wijzigingen van 19 september 2026:

   tinyhouses_straat.png   de twintig tiny houses aan de Molenkrite, vanaf de
                           stoep bij Jeugdhulp Friesland — het beeld uit de
                           melding, maar dan zoals het hoort te zijn
   tinyhouses_hof.png      van dichtbij: de losse puntgevels van staand hout,
                           de lichte lijst en het grijze plaatdak
   drempel.png             een verkeersdrempel met zijn blokmarkering, waar
                           eerst een egale zwarte band lag
   steiger.png             een steiger boven het water, nu met een houten
                           zijkant in plaats van een platte strook

 De camera vliegt (`player.fly`): een paar van deze standpunten liggen midden op
 het gras en midden op het water.

 Gebruik: npm run server &   node tools/tinyshots.mjs 8123 [map]
*/
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const poort = process.argv[2] || '8123';
const map = process.argv[3] || 'docs/screenshots';
mkdirSync(map, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });

const foto = async (naam) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${map}/${naam}.png`, timeout: 300000 });
  console.log(`${map}/${naam}.png`);
};

await page.evaluate(() => {
  const g = window.__game;
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('ui').style.display = 'none';
  g.player.active = true;
  g.sfeer.uur = 13; g.sfeer.weer = 'helder';
  g.player.wapenUit = true; if (g.player.gun) g.player.gun.visible = false;
  g.player.fly = true;
  window.__kijk = (doel, afst, hoog, hoek, mikY = 3) => {
    const x = doel.x + Math.cos(hoek) * afst, z = doel.z + Math.sin(hoek) * afst;
    g.player.pos.set(x, hoog, z);
    g.player.yaw = Math.atan2(-(doel.x - x), -(doel.z - z));
    g.player.pitch = Math.atan2(mikY - hoog, Math.hypot(doel.x - x, doel.z - z));
    g.player.updateFly(0);
  };
});

// ---- de tiny houses ----
const tiny = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const mid = (p) => {
    let x = 0, z = 0;
    for (const q of p.voet) { x += q[0]; z += q[1]; }
    return { x: x / p.voet.length, z: z / p.voet.length };
  };
  const panden = KAART.panden.filter(p => p.type === 'tinyhouse');
  if (!panden.length) return null;
  const lijst = panden.map(p => ({ ...mid(p), hoek: p.rect ? p.rect.hoek : 0, front: p.front || null }));
  // het hart van de zuidelijke rij (de rij die je ziet vanaf Jeugdhulp Friesland)
  const zuid = lijst.filter(p => p.z < 0);
  const rij = zuid.length ? zuid : lijst;
  const hart = (v) => ({ x: v.reduce((s, p) => s + p.x, 0) / v.length, z: v.reduce((s, p) => s + p.z, 0) / v.length });
  /*
   Dwars op de lange zijde kijken, en dan van de kant waar géén gebouw staat. De
   omsluitende rechthoek van elk pand staat onder `rect.hoek`; een kwartslag
   daarop sta je voor de lange gevel. Welke van de twee kwartslagen, hangt ervan
   af: aan de ene kant staat Jeugdhulp Friesland, en daar sta je met de camera
   dwars door de gevel heen.
  */
  const m = hart(rij);
  /*
   Waar zet je de camera neer? Niet zomaar dwars op de rij: aan de ene kant staat
   Jeugdhulp Friesland en aan de andere basisschool De Spil, allebei groot genoeg
   om er met de camera middenin te staan — dan kijk je van binnenuit tegen een
   plafond aan. Er wordt daarom rondgekeken: zestien hoeken, en die wint waar het
   standpunt het verst van élk pand in de buurt vandaan ligt.
  */
  const buren = KAART.panden
    .filter(p => p.type !== 'tinyhouse')
    .map(mid)
    .filter(p => Math.hypot(p.x - m.x, p.z - m.z) < 220);
  const vrijOp = (h, afst) => {
    const x = m.x + Math.cos(h) * afst, z = m.z + Math.sin(h) * afst;
    let dichtst = Infinity;
    for (const b of buren) dichtst = Math.min(dichtst, Math.hypot(b.x - x, b.z - z));
    return dichtst;
  };
  /*
   De kant waar de voordeuren zitten gaat voor: `front` uit de kaart. Blijkt daar
   geen ruimte te zijn — de camera zou in het buurpand staan — dan wordt er
   rondgekeken en wint de hoek met de meeste ruimte.
  */
  const voor = rij[0].front ? Math.atan2(rij[0].front[1], rij[0].front[0]) : null;
  let kijkhoek = voor, ruimst = voor === null ? -1 : vrijOp(voor, 28);
  if (ruimst < 18) {
    for (let i = 0; i < 16; i++) {
      const h = i * Math.PI / 8;
      const d = vrijOp(h, 28);
      if (d > ruimst) { ruimst = d; kijkhoek = h; }
    }
  }
  return { rij: m, een: rij[Math.floor(rij.length / 2)], kijkhoek, vrij: Math.round(ruimst), n: lijst.length };
});
if (tiny) {
  console.log(`tiny houses: ${tiny.n} stuks, rij rond (${tiny.rij.x.toFixed(0)}, ${tiny.rij.z.toFixed(0)}),`
    + ` standpunt op ${(tiny.kijkhoek * 180 / Math.PI).toFixed(0)}° met ${tiny.vrij} m ruimte`);
  // vanaf de kant van Jeugdhulp Friesland, dus vanuit het zuidoosten
  await page.evaluate((t) => window.__kijk(t, 28, 2.0, t.kijkhoek, 4.0), { ...tiny.rij, kijkhoek: tiny.kijkhoek });
  await foto('tinyhouses_straat');
  /*
   En van dichtbij op één woning, van de kant waar de voordeur zit. `front` uit
   de kaart wijst de voorgevel uit; zonder dat kijk je tegen de lange blinde
   zijgevel aan, en dat is precies de kant zonder ramen.
  */
  /*
   Dichtbij, want de voorgevel is maar drie en een halve meter breed terwijl het
   huis er negen en een half diep achter zit. Van vijftien meter vult de lange
   blinde zijgevel van de buren het beeld en is de deur een postzegel; van acht
   meter sta je ervoor. Iets opzij (de kwartslag erbij is klein) zodat de
   dieptewerking van de rij erin blijft.
  */
  const een = tiny.een;
  const hoekVoor = een.front ? Math.atan2(een.front[1], een.front[0]) : tiny.kijkhoek;
  await page.evaluate((t) => window.__kijk(t, 11, 2.6, t.hoek + 0.5, 2.2), { ...een, hoek: hoekVoor });
  await foto('tinyhouses_hof');
}

// ---- een verkeersdrempel ----
const drempel = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const v = KAART.vlakken.find(v => v.drempel);
  if (!v) return null;
  let x = 0, z = 0;
  for (const p of v.r[0]) { x += p[0]; z += p[1]; }
  return { x: x / v.r[0].length, z: z / v.r[0].length };
});
if (drempel) {
  await page.evaluate((d) => window.__kijk(d, 9, 2.4, 0.6, 0.1), drempel);
  await foto('drempel');
}

// ---- een steiger ----
const steiger = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  /*
   De grootste steiger die écht bóven het water ligt. Zonder die tweede eis win
   je met de betonnen hellingbaan van de waterzuivering: dat is in de BGT ook
   een "steiger", hij is het grootst, en er is geen druppel water bij.
  */
  const inRing = (r, x, z) => {
    let b = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i], c = r[j];
      if ((a[1] > z) !== (c[1] > z) && x < (c[0] - a[0]) * (z - a[1]) / (c[1] - a[1]) + a[0]) b = !b;
    }
    return b;
  };
  const water = KAART.vlakken.filter(v => v.k === 'water');
  let beste = null, bestOpp = 0;
  for (const v of KAART.vlakken) {
    if (v.k !== 'steiger') continue;
    const r = v.r[0];
    let a = 0, x = 0, z = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
    a = Math.abs(a / 2);
    if (a <= bestOpp) continue;
    for (const p of r) { x += p[0]; z += p[1]; }
    x /= r.length; z /= r.length;
    if (!water.some(w => inRing(w.r[0], x, z))) continue;
    bestOpp = a; beste = r;
  }
  if (!beste) return null;
  let x = 0, z = 0;
  for (const p of beste) { x += p[0]; z += p[1]; }
  return { x: x / beste.length, z: z / beste.length, opp: Math.round(bestOpp) };
});
if (steiger) {
  console.log(`steiger van ${steiger.opp} m² op (${steiger.x.toFixed(0)}, ${steiger.z.toFixed(0)})`);
  await page.evaluate((s) => window.__kijk(s, 13, 1.2, 2.3, 0.3), steiger);
  await foto('steiger');
}

await browser.close();

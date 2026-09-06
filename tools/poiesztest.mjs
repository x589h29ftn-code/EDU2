/*
 Toetst de binnenkant van supermarkt Poiesz in IJlst (js/supermarkt.js):

   - staat de winkel er, op de maten van het BAG-pand, en kom je er met E in
     en weer uit?
   - staan de kassa's, de schappenrijen, de diepvries, de versbalie, de
     zuivelwand en het bier erin, en loop je er niet doorheen?
   - lopen er vijf medewerkers en vier klanten rond, blijven ze binnen, en
     dragen de medewerkers het groene shirt met het oranje schort en het logo?
   - kost een flesje bier vijf euro, levert het tien levenspunten op, en gaat
     het niet boven de honderd?
   - zonder geld geen bier;
   - word je van het derde flesje wazig in beeld, en zakt dat in een minuut weg?

 Gebruik: python3 -m http.server 8123 &  node tools/poiesztest.mjs 8123
*/
import { chromium } from 'playwright';

const port = process.argv[2] || '8123';
let fouten = 0;
const ok = (goed, wat, extra = '') => {
  console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? ` — ${extra}` : ''}`);
  if (!goed) fouten++;
};
const kop = (t) => console.log(`\n--- ${t} ---`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(async () => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  const g = window.__game;
  g.player.active = true;
  window.__W = await import('/js/world.js');
  window.__K = (await import('/js/kaartwereld.js')).KAART;
  window.__geld = (n) => g.verhaal.herstel({ ...g.verhaal.bewaar(), geld: n });
  // een aantal beelden van het spel doorrekenen zonder te tekenen
  window.__stap = (n, dt = 1 / 30) => {
    for (let i = 0; i < n; i++) {
      g.supermarkt.update(dt, false);
      g.player.update(dt);
    }
  };
});
await page.waitForTimeout(400);

// ---------- 1. de winkel staat er ----------
kop('de winkel');
const winkel = await page.evaluate(() => {
  const g = window.__game, w = g.supermarkt;
  if (!w || !w.maten) return { er: false };
  const p = window.__K.panden.find(q => q.type === 'poiesz');
  return {
    er: true, ...w.maten,
    pandBreed: p ? p.rect.hx * 2 : 0, pandDiep: p ? p.rect.hz * 2 : 0,
    winkels: (w.winkels || []).map(q => q.naam),
    deurAfstand: Math.hypot(w.plekken.deurBuiten.x - (p ? p.rect.cx : 0), w.plekken.deurBuiten.z - (p ? p.rect.cz : 0)),
  };
});
ok(winkel.er, 'de Poiesz heeft een binnenkant', winkel.er ? `${winkel.hal.toFixed(1)} x ${winkel.diep.toFixed(1)} m` : 'niet gevonden');
ok(winkel.er && Math.abs(winkel.diep - winkel.pandDiep) < 1.2,
  'de diepte komt van het BAG-pand', `${winkel.diep.toFixed(1)} m tegen ${winkel.pandDiep.toFixed(1)} m`);
ok(winkel.er && winkel.plafond > 2.8 && winkel.plafond < winkel.diep,
  'het plafond hangt op winkelhoogte', `${winkel.plafond} m`);
ok(winkel.er && winkel.kassas === 5, 'er staan vijf kassa\'s', `${winkel.kassas}`);
ok(winkel.er && winkel.rijen >= 6, 'en een stuk of zeven schappenrijen', `${winkel.rijen}`);
ok(winkel.er && (winkel.winkels || []).includes('Poiesz IJlst'), 'hij staat als winkel op de kaart');

// ---------- 2. naar binnen en naar buiten ----------
kop('naar binnen en naar buiten');
const deur = await page.evaluate(() => {
  const g = window.__game, w = g.supermarkt, P = w.plekken;
  // buiten voor de deur gaan staan en op E drukken
  g.player.inCar = null;
  g.player.pos.set(P.deurBuiten.x, 0, P.deurBuiten.z);
  const gebruikt = w.toets();
  const na = { x: g.player.pos.x, z: g.player.pos.z };
  const binnen = w.binnen(na.x, na.z);
  // en weer naar buiten
  const uit = w.toets();
  const terug = { x: g.player.pos.x, z: g.player.pos.z };
  return {
    gebruikt, binnen, uit, buiten: !w.binnen(terug.x, terug.z),
    bijGevel: Math.hypot(terug.x - P.deurBuiten.x, terug.z - P.deurBuiten.z),
    ver: Math.hypot(na.x - P.deurBuiten.x, na.z - P.deurBuiten.z),
  };
});
ok(deur.gebruikt && deur.binnen, 'met E ga je bij de schuifdeuren naar binnen');
ok(deur.ver > 100, 'de winkel staat als losse doos ver buiten het kaartgebied', `${Math.round(deur.ver)} m`);
ok(deur.uit && deur.buiten, 'en met E sta je weer buiten');
ok(deur.bijGevel < 6, 'vlak voor de gevel', `${deur.bijGevel.toFixed(1)} m van de deur`);

// ---------- 3. de inrichting ----------
kop('de inrichting');
const spul = await page.evaluate(() => {
  const g = window.__game, w = g.supermarkt, P = w.plekken;
  // hoeveel losse vlakken staan er, en hoe hoog reikt de inrichting?
  let meshes = 0, punten = 0, hoogste = 0;
  w.groep.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    meshes++;
    const pos = o.geometry.attributes.position;
    punten += pos.count;
    for (let i = 0; i < pos.count; i++) hoogste = Math.max(hoogste, pos.getY(i));
  });
  // door een schappenrij heen lopen: van het ene gangpad naar het andere
  const W = window.__W;
  const start = { x: P.nul.x + 4.0, z: P.nul.z + 17.0 };
  let x = start.x, z = start.z;
  for (let i = 0; i < 120; i++) {
    const [nx, nz] = W.resolveCollisions(x + 0.25, z, 0.35);
    x = nx; z = nz;
  }
  return { meshes, punten, hoogste: +hoogste.toFixed(2), doorgelopen: x - start.x };
});
ok(spul.meshes >= 8 && spul.meshes <= 40, 'de winkel is per materiaal samengevoegd', `${spul.meshes} meshes, ${spul.punten} hoekpunten`);
ok(spul.hoogste > 3.3, 'er staat een plafond in', `hoogste punt ${spul.hoogste} m`);
ok(spul.doorgelopen < 3.0, 'je loopt niet dwars door een schappenrij heen',
  `${spul.doorgelopen.toFixed(1)} m opgeschoven in dertig meter lopen`);

// ---------- 4. de mensen ----------
kop('de mensen');
const mensen = await page.evaluate(() => {
  const g = window.__game, w = g.supermarkt, P = w.plekken;
  g.player.inCar = null;
  g.player.pos.set(P.deurBinnen.x, 0, P.deurBinnen.z);       // binnen, anders lopen ze niet
  const lijst = w.mensen;
  const voor = lijst.map(p => ({ x: p.groep.position.x, z: p.groep.position.z }));
  // twintig seconden, niet acht: wie rondloopt blijft onderweg ook een paar
  // tellen bij een schap staan, en dan heeft niet iedereen zich in acht
  // seconden verplaatst
  window.__stap(30 * 20);
  const na = lijst.map(p => ({ x: p.groep.position.x, z: p.groep.position.z }));
  let bewogen = 0, buiten = 0;
  for (let i = 0; i < lijst.length; i++) {
    if (Math.hypot(na[i].x - voor[i].x, na[i].z - voor[i].z) > 1.0) bewogen++;
    if (!w.binnen(na[i].x, na[i].z)) buiten++;
  }
  // de medewerkers: groen shirt, oranje schort, en een lapje met het logo
  let groen = 0, schort = 0, logo = 0;
  for (const p of lijst) {
    let heeftGroen = false, heeftOranje = false, heeftLogo = false;
    p.groep.traverse(o => {
      if (!o.material) return;
      const c = o.material.color;
      if (o.material.map) heeftLogo = true;
      if (!c) return;
      const hex = c.getHex();
      if (hex === 0x43b02a) heeftGroen = true;
      if (hex === 0xef7d00) heeftOranje = true;
    });
    if (heeftGroen) groen++;
    if (heeftOranje) schort++;
    if (heeftLogo) logo++;
  }
  return { aantal: lijst.length, bewogen, buiten, groen, schort, logo };
});
ok(mensen.aantal === 9, 'er lopen negen mensen rond: vijf medewerkers en vier klanten', `${mensen.aantal}`);
// twee van de negen staan op hun post: de kassière en de man aan de versbalie
ok(mensen.bewogen >= 5, 'de zeven die rondlopen doen dat ook echt',
  `${mensen.bewogen} van de ${mensen.aantal} verplaatst in twintig seconden`);
ok(mensen.buiten === 0, 'en niemand loopt de winkel uit', `${mensen.buiten} buiten`);
ok(mensen.groen === 5, 'vijf mensen in het groene Poiesz-shirt', `${mensen.groen}`);
ok(mensen.schort === 5, 'met het oranje schort erover', `${mensen.schort}`);
ok(mensen.logo === 5, 'en het logo op de borst', `${mensen.logo}`);

// ---------- 5. het bier ----------
kop('bier kopen');
const bier = await page.evaluate(() => {
  const g = window.__game, w = g.supermarkt, P = w.plekken;
  window.__geld(100);
  g.player.health = 60;
  g.hud.zetLeven(60);
  g.player.dronken = 0;
  const voorGeld = g.verhaal.geld;
  const uit = w.koop();
  return {
    uit, voorGeld, naGeld: g.verhaal.geld, leven: g.player.health,
    prijs: w.maten.bier.prijs, per: w.maten.bier.leven,
    hint: (() => {
      g.player.pos.set(P.bier.x, 0, P.bier.z);
      w.update(0.05, false);
      return document.getElementById('praat').textContent;
    })(),
  };
});
ok(bier.uit === 'ok', 'je koopt een flesje bier');
ok(bier.voorGeld - bier.naGeld === bier.prijs, 'en het geld gaat eraf', `€ ${bier.voorGeld} → € ${bier.naGeld}`);
ok(bier.leven === 70, 'een flesje geeft tien levenspunten', `60 → ${bier.leven}`);
ok(/bier/i.test(bier.hint), 'bij het schap zegt de hint wat E doet', bier.hint);

const vol = await page.evaluate(() => {
  const g = window.__game, w = g.supermarkt;
  window.__geld(100);
  g.player.health = 96;
  w.koop();
  return g.player.health;
});
ok(vol === 100, 'boven de honderd kom je niet', `${vol}`);

const arm = await page.evaluate(() => {
  const g = window.__game, w = g.supermarkt;
  window.__geld(2);
  g.player.health = 50;
  const uit = w.koop();
  return { uit, leven: g.player.health, geld: g.verhaal.geld };
});
ok(arm.uit === 'arm' && arm.leven === 50, 'zonder geld geen bier', `€ ${arm.geld}, ${arm.leven} leven`);

// ---------- 6. drie op ----------
kop('drie flesjes op');
const dronken = await page.evaluate(() => {
  const g = window.__game, w = g.supermarkt;
  window.__geld(200);
  g.player.dronken = 0;
  g.player.health = 40;
  // de teller staat na de proeven hierboven nog op een paar flesjes; een minuut
  // niets drinken zet hem terug op nul, net als in het spel
  window.__stap(30 * 61);
  const na = [];
  for (let i = 0; i < 4; i++) { w.koop(); na.push(+g.player.dronken.toFixed(3)); }
  /*
   Even doorlopen voor de rol gemeten wordt. Het deinen begint op nul en loopt
   op met de tijd (js/player.js telt `dronkenT` mee zolang je dronken bent), dus
   op het moment van drinken staat het beeld nog precies recht — en dat is ook
   de bedoeling: het komt op gang, het springt niet.
  */
  window.__stap(24);
  g.player.applyCamera();
  const rol = Math.abs(g.camera.rotation.z);
  w.update(0.05, false);
  const waas = parseFloat(document.getElementById('dronken').style.opacity || '0');
  // en dan een minuut wachten
  window.__stap(30 * 61);
  g.player.applyCamera();
  w.update(0.05, false);
  return {
    na, rol: +rol.toFixed(4), waas,
    naMinuut: +g.player.dronken.toFixed(3),
    rolNa: +Math.abs(g.camera.rotation.z).toFixed(4),
    waasNa: parseFloat(document.getElementById('dronken').style.opacity || '0'),
    flesjes: w.flesjes,
  };
});
ok(dronken.na[0] === 0 && dronken.na[1] === 0, 'van één of twee flesjes merk je niets', dronken.na.join(', '));
ok(dronken.na[2] > 0, 'vanaf het derde flesje word je wazig', `${dronken.na[2]}`);
ok(dronken.na[3] > dronken.na[2], 'en het vierde maakt het erger', `${dronken.na[3]}`);
ok(dronken.rol > 0.01, 'het beeld gaat scheef hangen', `${dronken.rol} rad rol`);
ok(dronken.waas > 0.05, 'en er komt een waas overheen', `waas ${dronken.waas}`);
ok(dronken.naMinuut === 0, 'na een minuut ben je weer nuchter', `${dronken.naMinuut}`);
ok(dronken.rolNa < 0.0005 && dronken.waasNa < 0.02, 'het beeld staat dan weer recht en helder',
  `rol ${dronken.rolNa}, waas ${dronken.waasNa}`);

console.log(fouten ? `\n${fouten} fout(en).` : '\nAlles goed.');
await browser.close();
process.exit(fouten ? 1 : 0);

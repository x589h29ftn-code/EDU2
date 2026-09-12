/*
 Toetst de rotonde in de Lemmerweg die over de N7 heen ligt.

 Uit de beta-test: "op lemmerweg loopt het omhoog de rotonde, onder rotonde
 loopt de andere weg door". In het spel lag alles plat: de rijksweg en de
 rotonde kruisten elkaar op hetzelfde vlak.

 Wat er mis kan gaan, en dus wat hier nagerekend wordt:
 1. de rijksweg hoort in een bak te liggen — vijf en een halve meter onder
    maaiveld onder de brug, en aan de uiteinden weer op nul. Zonder dat klopt
    het beeld niet en rijd je door de rotonde heen;
 2. de rotonde zelf moet juist wél op maaiveld blijven. De eerste poging tilde
    de hele ring op en dan kantelt de halve wijk mee;
 3. er moet doorrijhoogte onder het dek zijn: een vrachtwagen van vier meter
    hoort eronderdoor te kunnen;
 4. de hoogte hangt af van waar je bent. Sta je op de brug, dan is de grond nul;
    rijd je eronderdoor, dan is hij min vijf en een half;
 5. het grondvlak op −1 m moet een gat hebben boven de bak. Zonder dat gat kijk
    je op gras in plaats van in de tunnelbak — dat was de eerste keer ook zo;
 6. het wegdek in de bak moet er echt liggen (een straal van boven raakt asfalt
    op de diepte van het hoogteveld);
 7. het fietspad langs de rijksweg gaat onder de opritten door (foto's van de
    gebruiker): twee fietstunneltjes met 2,5 m doorrijhoogte.

 Gebruik: python3 -m http.server 8123 &  node tools/rotondetest.mjs 8123
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
const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
page.on('pageerror', e => { console.log('[pageerror]', e.message); fouten++; });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load', timeout: 300000 });
await page.waitForFunction(() => window.__game, null, { timeout: 300000 });
await page.evaluate(() => {
  localStorage.removeItem('tinga.spel.v1');
  document.getElementById('overlay').style.display = 'none';
  window.__game.player.active = true;
});

kop('de bak staat in de kaart');
const kaart = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const V = (KAART.viaducten || []).find(v => v.verdiept);
  if (!V) return null;
  const diepste = Math.min(...V.as.map(s => s[2]));
  return {
    naam: V.naam, hoogte: V.hoogte, dekdikte: V.dekdikte, diepste,
    dekken: (V.bakDekken || []).length,
    stations: V.as.length,
    eindA: V.as[0][2], eindB: V.as[V.as.length - 1][2],
    steilste: Math.max(...V.as.slice(1).map((s, i) => Math.abs(s[2] - V.as[i][2]))),
  };
});
ok(!!kaart, 'de verdiepte rijksweg staat erin', kaart ? kaart.naam : '');
ok(kaart && kaart.dekken === 2, 'met twee brugdekken erover', kaart ? `${kaart.dekken}` : '');
ok(kaart && Math.abs(kaart.diepste + 5.6) < 0.05, 'en hij ligt 5,6 m onder maaiveld',
  kaart ? `${kaart.diepste.toFixed(2)} m` : '');
ok(kaart && Math.abs(kaart.eindA) < 0.1 && Math.abs(kaart.eindB) < 0.1,
  'aan de uiteinden ligt hij weer op maaiveld',
  kaart ? `${kaart.eindA.toFixed(2)} en ${kaart.eindB.toFixed(2)} m` : '');
ok(kaart && kaart.steilste <= 0.08, 'de helling blijft onder de acht procent',
  kaart ? `${(kaart.steilste * 100).toFixed(1)} %` : '');

kop('de rijksweg ligt laag, de rotonde niet');
const hoogtes = await page.evaluate(async () => {
  const V = await import('/js/viaduct.js');
  const g = (x, z, y = -Infinity) => +V.grondHoogte(x, z, y).toFixed(2);
  return {
    onderDekWest: g(759, -150), onderDekOost: g(803, -149),
    tussenDeDekken: g(782, -149.7),
    ringNoord: g(782, -172), ringZuid: g(782, -130),
    ringWest: g(759, -180), ringOost: g(805, -125),
    verWest: g(600, -158), verOost: g(950, -141),
    opHetDek: g(759, -150, 0.5),
    eronder: g(759, -150, -5),
  };
});
ok(hoogtes.onderDekWest < -5.5 && hoogtes.onderDekOost < -5.5, 'onder allebei de dekken ligt de weg diep',
  `${hoogtes.onderDekWest} en ${hoogtes.onderDekOost} m`);
ok(hoogtes.tussenDeDekken < -5.5, 'en tussen de twee dekken ook', `${hoogtes.tussenDeDekken} m`);
ok(hoogtes.ringNoord === 0 && hoogtes.ringZuid === 0, 'de twee middeneilanden blijven op maaiveld',
  `${hoogtes.ringNoord} en ${hoogtes.ringZuid} m`);
ok(hoogtes.ringWest === 0 && hoogtes.ringOost === 0, 'de ring eromheen ook',
  `${hoogtes.ringWest} en ${hoogtes.ringOost} m`);
ok(Math.abs(hoogtes.verWest) < 0.2 && Math.abs(hoogtes.verOost) < 0.2,
  'honderdvijftig meter verderop is de bak weer weg', `${hoogtes.verWest} en ${hoogtes.verOost} m`);
ok(hoogtes.opHetDek === 0, 'sta je op de brug, dan is de grond nul', `${hoogtes.opHetDek} m`);
ok(hoogtes.eronder < -5.5, 'rijd je eronderdoor, dan is hij min vijf en een half', `${hoogtes.eronder} m`);

kop('je kunt er met een vrachtwagen onderdoor');
const ruimte = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const V = await import('/js/viaduct.js');
  const A = (KAART.viaducten || []).find(v => v.verdiept);
  const weg = V.grondHoogte(759, -150, -Infinity);
  return { vrij: +(0 - A.dekdikte - weg).toFixed(2), onderBrug: V.onderBrug(759, -150) };
});
ok(ruimte.vrij >= 4.5, 'er zit meer dan vier en een halve meter tussen wegdek en dek',
  `${ruimte.vrij} m`);
ok(ruimte.onderBrug, 'en het spel weet dat daar een dek boven je hangt (geen bomen in de bak)');

kop('het wegdek ligt er ook echt');
const straal = await page.evaluate(async ([x, z]) => {
  const THREE = await import('three');
  const g = window.__game;
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 60, z), new THREE.Vector3(0, -1, 0), 0, 200);
  const hits = ray.intersectObjects(g.scene.children, true)
    .map(h => ({ y: +h.point.y.toFixed(2), klasse: h.object.userData.klasse || '' }));
  return { eerste: hits[0] || null, asfalt: hits.find(h => h.klasse === 'autoweg') || null, aantal: hits.length };
}, [700, -152]);
ok(straal.asfalt && straal.asfalt.y < -3, 'van bovenaf raak je het asfalt in de bak',
  straal.asfalt ? `${straal.asfalt.y} m` : 'niet geraakt');
ok(straal.eerste && straal.eerste.y < -2.5,
  'en er hangt geen grondvlak overheen — het gat in het maaiveld zit erin',
  straal.eerste ? `eerste treffer ${straal.eerste.y} m (${straal.eerste.klasse || 'zonder klasse'})` : 'niets geraakt');

kop('het fietspad duikt er ook onderdoor');
/*
 Uit de foto's van de gebruiker: het fietspad langs de rijksweg gaat onder de
 oprit door. De BGT heeft dat ook zo — onder de twee brugdekken van de opritten
 liggen fietspad- en voetpadvlakken — maar alles lag plat op elkaar. Twee
 fietstunneltjes zijn nu verdiepte paden, met 2,5 m doorrijhoogte.
*/
const fiets = await page.evaluate(async () => {
  const { KAART } = await import('/js/kaart.js');
  const V = await import('/js/viaduct.js');
  const tunnels = (KAART.viaducten || []).filter(v => /Fietstunnel/.test(v.naam));
  const g = (x, z) => +V.grondHoogte(x, z, -Infinity).toFixed(2);
  return {
    aantal: tunnels.length,
    diepstes: tunnels.map(t => +Math.min(...t.as.map(s => s[2])).toFixed(2)),
    onderNoord: g(742, -172), onderZuid: g(738, -128),
    aanloopNoord: g(750, -210), aanloopZuid: g(736, -102),
    verWeg: g(733, -70),
    hoogtes: tunnels.map(t => t.dekdikte),
  };
});
ok(fiets.aantal === 2, 'er liggen twee fietstunneltjes onder de opritten', `${fiets.aantal}`);
ok(fiets.onderNoord < -3 && fiets.onderZuid < -3, 'onder het dek ligt het pad ruim drie meter lager',
  `${fiets.onderNoord} en ${fiets.onderZuid} m`);
ok(fiets.onderNoord >= -3.6 && 0 - fiets.hoogtes[0] - fiets.onderNoord >= 2.4,
  'met twee en een halve meter doorrijhoogte — genoeg voor een fietser',
  `${(0 - fiets.hoogtes[0] - fiets.onderNoord).toFixed(2)} m vrij`);
ok(fiets.aanloopNoord < -0.3 && fiets.aanloopNoord > -3 && fiets.aanloopZuid < -0.3,
  'de aanloop loopt geleidelijk af', `${fiets.aanloopNoord} en ${fiets.aanloopZuid} m`);
ok(Math.abs(fiets.verWeg) < 0.15, 'en verderop ligt het pad weer op maaiveld', `${fiets.verWeg} m`);

kop('rijden door de bak');
const rit = await page.evaluate(async () => {
  const g = window.__game;
  const car = g.vehicles.cars.find(c => c.driveable && !c.wrak);
  /*
   De auto op de rechterrijbaan zetten, vlak voor de brug. Niet op de as van de
   bak: dat is de middenberm, en daar staat de straatverlichting — de eerste
   versie van deze proef reed tegen een lantaarnpaal aan en kwam nooit aan de
   overkant.
  */
  car.x = 690; car.z = -147; car.yaw = -Math.PI / 2; car.speed = 0;
  if (car.mesh) car.mesh.position.y = (await import('/js/viaduct.js')).grondHoogte(690, -147, -Infinity);
  g.player.pos.set(car.x + 1.4, 0, car.z);
  g.toggleCar();
  const standen = [];
  for (let i = 0; i < 320; i++) {
    Object.assign(g.player.keys, { KeyW: true });
    g.vehicles.drive(car, g.player.keys, 1 / 20, g.aanrijden);
    if (i % 20 === 0) standen.push({ x: +car.x.toFixed(0), y: +(car.mesh ? car.mesh.position.y : 0).toFixed(2) });
  }
  const uit = { standen, eind: +car.x.toFixed(0), diepst: Math.min(...standen.map(s => s.y)) };
  g.player.keys = {};
  g.toggleCar();
  return uit;
});
ok(rit.eind > 880, 'je rijdt de bak door en komt er aan de andere kant uit', `tot x = ${rit.eind}`);
ok(rit.diepst < -5, 'en zakt onderweg de bak in', `${rit.diepst} m`);
ok(rit.standen[rit.standen.length - 1].y > -1.5, 'en komt er weer uit',
  `eindigt op ${rit.standen[rit.standen.length - 1].y} m`);

await browser.close();
console.log(fouten === 0 ? '\nAlles goed.' : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);

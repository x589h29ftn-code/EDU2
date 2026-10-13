// Steekproef voor de stijlcontrole: rendert per adres uit
// data/stijl/steekproef.json het spel vanaf de straat, recht voor de
// voorgevel, en schrijft docs/steekproef/<straat>-<nr>.jpg plus een
// README.md met per adres de meetwaarden uit 3D BAG, het gekozen woningtype en
// de Street View-link van hetzelfde camerapunt.
//
//   node tools/geo/steekproef.mjs [poort]
//
// Vereist een draaiende webserver (npm start) en Playwright.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leesOorsprong, spelNaarRd, rdNaarWgs } from './rd.mjs';
import { camera, cameraPlek as plekVan, zoek as zoekPand, streetView as svLink } from './steekproefplek.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HIER, '..', '..');
const poort = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '8123';
// (stap 158) `--ronde N`: alleen die ronde, naar docs/steekproef/RONDE<N>.md, zonder de omgevingsplekken
const rondeArg = process.argv.indexOf('--ronde');
const alleenRonde = rondeArg >= 0 ? Number(process.argv[rondeArg + 1]) : null;
const { KAART } = await import(join(ROOT, 'js', 'kaart.js'));
const STEEK = JSON.parse(readFileSync(join(ROOT, 'data', 'stijl', 'steekproef.json'), 'utf8'));
const oorsprong = leesOorsprong();
const UIT = join(ROOT, 'docs', 'steekproef');
mkdirSync(UIT, { recursive: true });

/*
 De rekensom voor het camerapunt en de Street View-link staat in
 steekproefplek.mjs, zodat tools/geo/steekproeflinks.mjs (die alleen de lijst
 met links maakt) exact hetzelfde standpunt gebruikt als deze, die er een foto
 van het spel bij rendert.
*/
const zoek = (straat, nr, type) => zoekPand(KAART, straat, nr, type);
const cameraPlek = (pl) => plekVan(pl, KAART);
const streetView = (x, z, koers) => svLink(x, z, koers, oorsprong);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${poort}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__game, null, { timeout: 180000 });
await page.evaluate(() => {
  document.getElementById('overlay').style.display = 'none';
  window.__autoplay = true;
  const g = window.__game;
  // stil beeld: geen verkeer of voetgangers voor de gevel
  for (const t of g.vehicles.traffic) t.mesh.visible = false;
  for (const m of Object.values(g.npcs.meshes)) m.visible = false;
  g.npcs.fiets.visible = false;
  g.player.gun.visible = false;
  // (stap 158) zonder hud en zonder wapen in beeld
  const ui = document.getElementById('ui'); if (ui) ui.style.visibility = 'hidden';
  g.player.wapenUit = true;
});
// (stap 158) de eerste beelden waren zwart: eerst een paar tellen tekenen
await page.waitForTimeout(4000);

const regels = [], regels2 = [], plekRegels = [], regelsR = [];
let eersteGehad = false;
for (const a of STEEK.adressen) {
  if (alleenRonde !== null && a.ronde !== alleenRonde) continue;
  const pand = zoek(a.straat, a.nr, a.type);
  if (pand && !a.nr) a.nr = pand.nr[0];
  const naam = `${a.straat.replace(/\s+/g, '_')}-${a.nr || a.type}`;
  const doel = alleenRonde !== null ? regelsR : a.ronde === 2 ? regels2 : regels;
  if (!pand) { console.log(`${a.straat} ${a.nr || a.type}: niet gevonden`); doel.push(`| ${a.straat} ${a.nr || a.type} | niet gevonden in kaart.js | | | | |`); continue; }
  const cam = camera(pand);
  await page.evaluate((c) => {
    const g = window.__game;
    g.player.pos.set(c.x, 0, c.z); g.player.yaw = c.yaw; g.player.pitch = 0.06; g.player.applyCamera();
    g.player.gun.visible = false;
    // geparkeerde auto's vlak voor de camera even weg
    // niet elke auto heeft een eigen mesh: wie in een stapel staat heeft er geen
    for (const car of g.vehicles.cars) if (car.mesh) car.mesh.visible = Math.hypot(car.x - c.x, car.z - c.z) > 6;
  }, cam);
  // (stap 158: na de eerste grote sprong heeft het spel langer nodig, anders is het eerste beeld zwart)
  await page.waitForTimeout(600);
  if (!eersteGehad) {
    // een eerste schermafdruk is in deze omgeving zwart, ook na lang wachten: één weggooien
    await page.screenshot({ type: 'jpeg', quality: 50, timeout: 300000 });
    await page.waitForTimeout(1500);
    eersteGehad = true;
  }
  /*
   JPEG en geen PNG. Eenentachtig schermafdrukken per ronde is als PNG
   tweeënzestig megabyte, en elke ronde komt daar opnieuw bij in de
   git-geschiedenis. Het zijn foto's van een 3D-beeld: op kwaliteit 82 gaat er
   ruim tachtig procent af en zie je aan een gevel niets terug.
  */
  const bestand = join(UIT, `${naam}.jpg`);
  await page.screenshot({ path: bestand, type: 'jpeg', quality: 82, timeout: 300000 });
  const link = streetView(cam.x, cam.z, cam.koers);
  const meet = pand.v ? `goot ${pand.goot} m, nok ${pand.nok} m, ${pand.dak}` : `geschat (geen 3D BAG)`;
  console.log(`${a.straat} ${a.nr}: ${pand.type}, ${meet}, bouwjaar ${pand.jaar || '?'} -> ${naam}.jpg`);
  if (alleenRonde !== null) {
    // (stap 158) met de plek in het spel en in RD, zodat een foto erbij te zoeken is
    const rd = oorsprong ? spelNaarRd([cam.gevel[0], cam.gevel[1]], oorsprong) : null;
    const wgs = rd ? rdNaarWgs(rd[0], rd[1]) : null;
    doel.push(`| ${a.straat} ${a.nr} | ${pand.type} | ${meet} | spel (${cam.gevel[0].toFixed(1)}, ${cam.gevel[1].toFixed(1)})${rd ? `<br>RD ${rd[0].toFixed(0)}, ${rd[1].toFixed(0)}<br>${wgs[0].toFixed(6)}, ${wgs[1].toFixed(6)}` : ''} | ![](${naam}.jpg) | ${link ? `[Street View](${link})` : ''} | ${a.vraag || ''} |`);
  } else
  doel.push(`| ${a.straat} ${a.nr} | ${pand.type} | ${meet} | ${pand.jaar || '?'} | ![](${naam}.jpg) | ${link ? `[Street View](${link})` : ''} |${a.ronde === 2 ? ` ${a.vraag || ''} |` : ''}`);
}

// omgevingsplekken
for (const pl of alleenRonde !== null ? [] : STEEK.plekken || []) {
  const cam = cameraPlek(pl);
  const naam = 'plek-' + pl.naam.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
  if (!cam) { plekRegels.push(`| ${pl.naam} | ${pl.soort} | geen rijbaan gevonden | | |`); continue; }
  await page.evaluate((c) => {
    const g = window.__game;
    g.player.pos.set(c.x, 0, c.z); g.player.yaw = c.yaw; g.player.pitch = 0.0; g.player.applyCamera();
    for (const car of g.vehicles.cars) if (car.mesh) car.mesh.visible = Math.hypot(car.x - c.x, car.z - c.z) > 4;
  }, cam);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(UIT, `${naam}.jpg`), type: 'jpeg', quality: 82, timeout: 300000 });
  const link = streetView(cam.x, cam.z, cam.koers);
  console.log(`${pl.naam}: vanaf ${cam.straat}, ${cam.afstand.toFixed(0)} m van de plek -> ${naam}.jpg`);
  plekRegels.push(`| ${pl.naam} | ${pl.soort} | ${pl.vraag} | ![](${naam}.jpg) | ${link ? `[Street View](${link})` : ''} |`);
}
await browser.close();

const readme = `# Steekproef stijl

Per adres: het spel vanaf de straat, negen meter voor de voorgevel, en de Street
View-link van hetzelfde camerapunt (zelfde plek, zelfde kijkrichting). Gemaakt met
\`node tools/geo/steekproef.mjs\`; adressen in \`data/stijl/steekproef.json\`, de
gekozen typen in \`data/stijl/straten.json\`.

Kijk per adres naar: steenkleur, kozijnkleur, deurkleur, dakpannen, dakkapel of
dakraam, zonnepanelen, voortuin (heg, hekje, grind). Wat afwijkt, komt als regel in
de stijlcatalogus; positie, breedte en hoogte komen uit de data en worden hier niet
beoordeeld.

## Ronde 1: adressen met foto (verwerkt in de catalogus)

| adres | type | 3D BAG | bouwjaar | spel | foto |
|---|---|---|---|---|---|
${regels.join('\n')}

## Ronde 2: adressen zonder foto

| adres | type nu | 3D BAG | bouwjaar | spel | foto | vraag |
|---|---|---|---|---|---|---|
${regels2.join('\n')}

## Omgeving: groen, water, parkeren, stoepen, voortuinen

Camerapunt op de dichtstbijzijnde rijbaan, kijkend naar de plek (bij een
straatprofiel: langs de straat).

| plek | soort | waar op te letten | spel | foto |
|---|---|---|---|---|
${plekRegels.join('\n')}
`;
if (alleenRonde !== null) {
  const md = `# Steekproef ronde ${alleenRonde}

Gemaakt met \`node tools/geo/steekproef.mjs 8123 --ronde ${alleenRonde}\`; de adressen staan in
\`data/stijl/steekproef.json\` (\`ronde: ${alleenRonde}\`). Per adres het spel vanaf de straat, negen meter voor de
voorgevel, de plek in het spel (x, z) en in RD, en de Street View-link van hetzelfde camerapunt (zelfde plek,
zelfde kijkrichting). Een foto van precies dat standpunt, met de vraag in de laatste kolom, is genoeg om het pand bij
te werken.

| adres | type nu | 3D BAG | plek | spel | foto | vraag |
|---|---|---|---|---|---|---|
${regelsR.join('\n')}
`;
  writeFileSync(join(UIT, `RONDE${alleenRonde}.md`), md);
  console.log(`\n${join(UIT, `RONDE${alleenRonde}.md`)} geschreven`);
} else {
writeFileSync(join(UIT, 'README.md'), readme);
console.log(`\n${join(UIT, 'README.md')} geschreven`);
}

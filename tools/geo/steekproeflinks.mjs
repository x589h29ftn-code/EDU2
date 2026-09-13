/*
 De Street View-links van een steekproefronde, zonder het spel te renderen.

 De grote broer (tools/geo/steekproef.mjs) start een browser, zet de camera in
 het spel neer en maakt er een foto van. Dat is wat je doet als je wilt zien of
 het spel klopt. Maar bij het ópstellen van een nieuwe ronde wil je alleen de
 lijst met plekken: waar moet er gekeken worden, en met welke link kom je daar
 in Street View uit. Dat is deze.

 Allebei rekenen ze het camerapunt uit met tools/geo/steekproefplek.mjs, dus de
 foto die jij maakt heeft gegarandeerd hetzelfde standpunt als het beeld dat het
 spel straks rendert.

   node tools/geo/steekproeflinks.mjs [ronde]

 Zonder ronde: alle rondes. De uitvoer is markdown, klaar om te plakken.
*/
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leesOorsprong } from './rd.mjs';
import { camera, cameraPlek, zoek, streetView } from './steekproefplek.mjs';

const HIER = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HIER, '..', '..');
const ronde = process.argv[2] ? Number(process.argv[2]) : null;

const { KAART } = await import(join(ROOT, 'js', 'kaart.js'));
const STEEK = JSON.parse(readFileSync(join(ROOT, 'data', 'stijl', 'steekproef.json'), 'utf8'));
const oorsprong = leesOorsprong();

const kies = (r) => ronde === null || r === ronde;
let n = 0;

const adressen = (STEEK.adressen || []).filter(a => kies(a.ronde));
if (adressen.length) {
  console.log(`\n## Adressen${ronde ? ` (ronde ${ronde})` : ''}\n`);
  console.log('| # | adres | nu in het spel | meting uit 3D BAG | wat ik wil zien | Street View |');
  console.log('|---|---|---|---|---|---|');
  for (const a of adressen) {
    const pand = zoek(KAART, a.straat, a.nr, a.type);
    if (!pand) { console.log(`| ${++n} | ${a.straat} ${a.nr || a.type} | **niet gevonden in kaart.js** | | ${a.vraag || ''} | |`); continue; }
    const cam = camera(pand);
    const link = streetView(cam.x, cam.z, cam.koers, oorsprong);
    const meet = pand.v
      ? `goot ${pand.goot} m, nok ${pand.nok} m, ${pand.dak}`
      : '**geen 3D BAG-dak** — opgetrokken grondvlak';
    console.log(`| ${++n} | ${a.straat} ${a.nr || pand.nr[0]} | ${pand.type} | ${meet} | ${a.vraag || ''} | [Street View](${link}) |`);
  }
}

const plekken = (STEEK.plekken || []).filter(p => kies(p.ronde));
if (plekken.length) {
  console.log(`\n## Plekken${ronde ? ` (ronde ${ronde})` : ''}\n`);
  console.log('| # | plek | soort | straat | wat ik wil zien | Street View |');
  console.log('|---|---|---|---|---|---|');
  for (const pl of plekken) {
    const cam = cameraPlek(pl, KAART);
    if (!cam) { console.log(`| ${++n} | ${pl.naam} | ${pl.soort} | **geen straat gevonden** | ${pl.vraag || ''} | |`); continue; }
    const link = streetView(cam.x, cam.z, cam.koers, oorsprong);
    console.log(`| ${++n} | ${pl.naam} | ${pl.soort} | ${cam.straat} | ${pl.vraag || ''} | [Street View](${link}) |`);
  }
}
console.log(`\n${n} plekken.`);

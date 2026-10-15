/*
 Proef bij stap 186 (npm run zendertest, zonder browser): de zenderlijst van de autoradio (audio/radio/zenders.json).
 Elk bestand bestaat, is een echte mp3 (een ID3-kop of een mp3-frame) en groter dan een halve megabyte, geen nummer staat
 twee keer op dezelfde zender, elk nummer heeft een titel; en de vijf nummers van 15 okt staan op Radio Tinga.
 Het afspelen zelf (wisselen, filter, doorlopen) toetst npm run radiotest in de browser.
*/
import { readFileSync, existsSync, statSync } from 'node:fs';

let fouten = 0;
const ok = (goed, wat, extra = '') => { console.log(`${goed ? '  ok  ' : ' FOUT '} ${wat}${extra ? `: ${extra}` : ''}`); if (!goed) fouten++; };
const { zenders } = JSON.parse(readFileSync('audio/radio/zenders.json', 'utf8'));
for (const z of zenders) {
  console.log(`\n--- ${z.naam} (${z.nummers.length} nummers) ---`);
  const slecht = [], dubbel = new Set(), gezien = new Set();
  for (const n of z.nummers) {
    const pad = `audio/radio/${n.bestand}`;
    if (!existsSync(pad)) { slecht.push(`${n.bestand} bestaat niet`); continue; }
    const kop = readFileSync(pad).subarray(0, 3);
    const mp3 = (kop[0] === 0x49 && kop[1] === 0x44 && kop[2] === 0x33) || (kop[0] === 0xff && (kop[1] & 0xe0) === 0xe0);
    if (!mp3) slecht.push(`${n.bestand} is geen mp3`);
    if (statSync(pad).size < 5e5) slecht.push(`${n.bestand} is te klein`);
    if (!n.titel) slecht.push(`${n.bestand} zonder titel`);
    if (gezien.has(n.bestand)) dubbel.add(n.bestand);
    gezien.add(n.bestand);
  }
  ok(slecht.length === 0, 'elk bestand bestaat, is een mp3 en heeft een titel', slecht.join(', ') || z.nummers.map(n => n.titel).join(' · '));
  ok(dubbel.size === 0, 'geen nummer twee keer', [...dubbel].join(', '));
}
const tinga = zenders.find(z => z.naam === 'Radio Tinga');
const nieuw = ['Sultans of Swing', 'Rainbow in the Sky', 'Under the Bridge', 'Whatever You Want', "Knockin' on Heaven's Door"];
console.log('\n--- de nummers van 15 okt ---');
ok(nieuw.every(t => tinga.nummers.some(n => n.titel === t)), 'op Radio Tinga', nieuw.join(', '));
console.log(fouten ? `\n${fouten} fout(en)` : '\nalles goed');
process.exit(fouten ? 1 : 0);

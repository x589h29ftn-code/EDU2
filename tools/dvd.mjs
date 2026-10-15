/*
 Zet de inhoud van de dvd klaar in dist/dvd (npm run dvd, na het inpakken en de installer; de workflow windows.yml doet het
 met "dvd" aangevinkt en maakt er daarna een ISO van om te branden):

   Tinga-Setup-<versie>.exe   de installer (installer/tinga.iss)
   autorun.inf                de naam en het icoon van de schijf, en "Tinga installeren" in Automatisch afspelen
   tinga.ico                  het icoon (installer/beelden.py)
   LEESMIJ.txt                installeren, direct spelen, verwijderen, opslaan, de besturing
   Direct spelen\             het spel uitgepakt: Tinga.exe start zonder te installeren, ook vanaf de dvd zelf
   Hoes\                      de hoes om te drukken (A4 met snijtekens, en voor een drukker)

 Windows start sinds Windows 7 niets meer vanzelf van een schijf; Automatisch afspelen biedt "Tinga installeren" aan, en
 anders open je de dvd in de Verkenner en dubbelklik je de setup. Zonder de installer (een lokale proef) wordt die regel
 overgeslagen en zegt het script wat er mist.

 Gebruik: node tools/dvd.mjs
*/
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const versie = pkg.version;
const uit = 'dist/dvd';
const setup = `Tinga-Setup-${versie}.exe`;
const app = 'dist/Tinga-win32-x64';
rmSync(uit, { recursive: true, force: true });
mkdirSync(uit, { recursive: true });
const mist = [];

// de installer
if (existsSync(`dist/installer/${setup}`)) cpSync(`dist/installer/${setup}`, join(uit, setup));
else mist.push(`dist/installer/${setup} (eerst de installer bouwen)`);
// het spel uitgepakt, om direct te spelen
if (existsSync(app)) cpSync(app, join(uit, 'Direct spelen'), { recursive: true });
else mist.push(`${app} (eerst npm run dist:win)`);
// het icoon
if (existsSync('dist/installer/tinga.ico')) cpSync('dist/installer/tinga.ico', join(uit, 'tinga.ico'));
else mist.push('dist/installer/tinga.ico (python installer/beelden.py)');
// de hoes
mkdirSync(join(uit, 'Hoes'), { recursive: true });
for (const [bron, naam] of [['docs/hoes/hoes_a4.pdf', 'Hoes op A4 (zelf printen).pdf'], ['docs/hoes/hoes_dvd.pdf', 'Hoes voor de drukker (279 x 189 mm).pdf']]) {
  if (existsSync(bron)) cpSync(bron, join(uit, 'Hoes', naam)); else mist.push(bron);
}

// Windows leest autorun.inf als ANSI of UTF-16; met alleen gewone tekens is ASCII veilig. CRLF, want het is Windows.
const crlf = (t) => t.replace(/\r?\n/g, '\r\n');
writeFileSync(join(uit, 'autorun.inf'), crlf(`[autorun]
open=${setup}
icon=tinga.ico
label=GTA VI Tinga
action=GTA VI: Tinga installeren
`), 'ascii');

writeFileSync(join(uit, 'LEESMIJ.txt'), '﻿' + crlf(`GTA VI: Tinga  (versie ${versie})
=====================================

Tinga is al jarenlang in de greep van drugskartels. De Veteraan, met zijn
dikke hondje altijd aan de lijn, heeft de wijk stevig in handen. Erik en Mark
werken zich bij hem omhoog. Maar of dat zonder kleerscheuren gaat?


INSTALLEREN
-----------
1. Stop de dvd in de computer. Kies in het venster "Automatisch afspelen"
   voor "GTA VI: Tinga installeren".
   Komt dat venster niet: open "Deze pc", dubbelklik op de dvd-speler en
   dubbelklik op ${setup}.
2. Windows kan waarschuwen dat de uitgever onbekend is ("Windows heeft uw pc
   beschermd"). Klik op "Meer informatie" en dan op "Toch uitvoeren". Het spel
   is niet ondertekend bij Microsoft, dat is alles.
3. Volg de stappen. Er zijn geen beheerdersrechten nodig. Na afloop staat
   "GTA VI - Tinga" in het Startmenu (en op het bureaublad als je dat aanvinkt).


DIRECT SPELEN, ZONDER INSTALLEREN
---------------------------------
Open de map "Direct spelen" op de dvd en dubbelklik op Tinga.exe. Dat werkt
ook vanaf de dvd zelf; het laden duurt dan wat langer. Je kunt de map ook naar
een usb-stick of je bureaublad kopieren.


OPSLAAN
-------
F5 slaat op, F9 laadt (of via het menu). De opgeslagen spellen staan in je
eigen gegevens (%APPDATA%\\Tinga) en blijven staan als je het spel verwijdert
of een nieuwere versie installeert.


BESTURING
---------
W A S D        lopen en rijden          Muis       rondkijken, linkerknop schieten
Shift          rennen                   E          praten, instappen, kopen
Spatie         springen / handrem       C          bukken
V              camera wisselen          R          herladen
M              de grote kaart           Esc        pauze en instellingen
F5 / F9        opslaan / laden          T          de klok aan of uit


VERWIJDEREN
-----------
Windows-instellingen > Apps > Geinstalleerde apps > GTA VI: Tinga >
Verwijderen. Of via het Startmenu: "Tinga verwijderen".


SYSTEEMEISEN
------------
Windows 10 of 11 (64-bit), 4 GB werkgeheugen, een grafische kaart met WebGL 2
(elke kaart van de laatste tien jaar), ongeveer 500 MB vrije ruimte.

Voor Erik: van harte gefeliciteerd met je verjaardag!
`), 'utf8');

// wat er op de schijf komt, en hoe groot
const grootte = (p) => statSync(p).isDirectory() ? readdirSync(p).reduce((s, n) => s + grootte(join(p, n)), 0) : statSync(p).size;
const totaal = grootte(uit);
console.log(`dvd klaar in ${uit}: ${readdirSync(uit).join(', ')} — ${(totaal / 1e6).toFixed(0)} MB (een dvd: 4700 MB)`);
if (mist.length) { console.log('ontbreekt:\n  ' + mist.join('\n  ')); process.exitCode = process.env.DVD_STRENG ? 1 : 0; }

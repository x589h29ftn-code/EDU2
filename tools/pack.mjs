// Pakt de app in tot een Windows-map met Tinga.exe.
// Gebruik: node tools/pack.mjs [platform] [arch]
// De CLI van @electron/packager loopt op de Windows-runner stuk op een
// gesloten stdout (EPIPE), dus roepen we de API rechtstreeks aan.
import { packager } from '@electron/packager';
import { readFileSync } from 'node:fs';

const platform = process.argv[2] || 'win32';
const arch = process.argv[3] || 'x64';
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const paden = await packager({
  dir: '.',
  name: 'Tinga',
  out: 'dist',
  platform, arch,
  overwrite: true,
  asar: false,
  appVersion: pkg.version,
  appCopyright: 'Tinga Sneek',
  prune: true,
  /*
   Wat er niet in de app hoeft. De schil serveert alleen index.html, js/, lib/,
   audio/ en beeld/; de rest is gereedschap en brondata. `data/geo` alleen al is
   148 MB ruwe BGT- en 3D BAG-download waar het spel niets mee doet — dat zit in
   js/kaart.js verwerkt — en data/stijl/fotos zijn de referentiefoto's waarmee
   de gevels zijn gemaakt. Zonder deze regels was de Windows-app 292 MB.
  */
  ignore: [
    /^\/dist/, /^\/shots/, /^\/\.git/, /^\/\.github/,
    /^\/data\/geo/, /^\/data\/stijl\/fotos/, /^\/tools/, /^\/docs/,
    /^\/[^/]*\.md$/,
  ],
  quiet: true,
});

console.log('klaar:', paden.join(', '));

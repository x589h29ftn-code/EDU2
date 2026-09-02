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
  asar: false,                       // de editor moet js/rows.user.js kunnen schrijven
  appVersion: pkg.version,
  appCopyright: 'Tinga Sneek',
  prune: true,
  ignore: [/^\/dist/, /^\/shots/, /^\/\.git/, /^\/docs\/screenshots/],
  quiet: true,
});

console.log('klaar:', paden.join(', '));

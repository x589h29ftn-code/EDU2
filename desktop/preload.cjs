// Brug tussen de pagina en Electron. De pagina krijgt precies twee dingen:
// rijen opslaan, wat info over waar de app staat, en het volledige scherm.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tinga', {
  desktop: true,
  saveRows: tekst => ipcRenderer.invoke('tinga:saveRows', tekst),
  info: () => ipcRenderer.invoke('tinga:info'),
  // volledig scherm (stap 127): aan, uit, of zonder argument wisselen; geeft de nieuwe stand
  volledig: aan => ipcRenderer.invoke('tinga:volledig', aan),
});

/*
 (stap 219) De opslag ook als bestand. De opslag van de pagina (localStorage) hoort bij het adres van het servertje; tot
 stap 219 was dat elke start een andere poort, en dan was je opgeslagen spel "weg". Nu leest het preload bij elke start
 opslag.json (via main.cjs) en zet wat de pagina nog niet heeft terug in localStorage, vóór de scripts van het spel lopen.
 Elke drie tellen, bij het sluiten en op verzoek gaat alles wat met 'tinga.' begint weer naar het bestand.
*/
function tingaSleutels() {
  const o = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('tinga.')) o[k] = localStorage.getItem(k); }
  return o;
}
try {
  const r = ipcRenderer.sendSync('tinga:opslagLees');
  if (r && r.aan) {
    for (const [k, v] of Object.entries(r.data || {})) if (localStorage.getItem(k) === null && typeof v === 'string') localStorage.setItem(k, v);
    let laatst = JSON.stringify(r.data || {});
    const spiegel = () => {
      try { const s = JSON.stringify(tingaSleutels()); if (s !== laatst) { laatst = s; ipcRenderer.sendSync('tinga:opslagSchrijf', s); } } catch { /* later opnieuw */ }
    };
    spiegel();
    setInterval(spiegel, 3000);
    window.addEventListener('beforeunload', spiegel);
    window.addEventListener('pagehide', spiegel);
  }
} catch { /* zonder bestand werkt het spel gewoon met localStorage */ }

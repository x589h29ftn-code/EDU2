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

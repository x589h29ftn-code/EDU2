// Brug tussen de pagina en Electron. De pagina krijgt precies twee dingen:
// rijen opslaan en wat info over waar de app staat.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tinga', {
  desktop: true,
  saveRows: tekst => ipcRenderer.invoke('tinga:saveRows', tekst),
  info: () => ipcRenderer.invoke('tinga:info'),
});

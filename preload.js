const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDesktopSources: (options) => ipcRenderer.invoke('get-sources', options),
  getMatchingScreen: () => ipcRenderer.invoke('get-matching-screen') // Get matching screen bounds

});
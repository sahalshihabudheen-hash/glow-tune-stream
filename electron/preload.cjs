const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nyraDesktop', {
  isDesktop: true,
  updatePresence: (payload) => ipcRenderer.send('nyra:presence', payload),
  clearPresence: () => ipcRenderer.send('nyra:presence', null),
});

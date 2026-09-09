const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', Object.freeze({ copyText: text => ipcRenderer.invoke('copy-text', text), saveText: text => ipcRenderer.invoke('save-text', text), checkUpdate: () => ipcRenderer.invoke('check-update'), openUpdate: () => ipcRenderer.invoke('open-update') }));

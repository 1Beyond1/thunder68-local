const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('thunder68Local', {diagnostic: detail => ipcRenderer.send('diagnostic', detail),setTheme: theme=>ipcRenderer.send('theme',theme)});

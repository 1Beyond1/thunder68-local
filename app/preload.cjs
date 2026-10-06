const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('thunder68Local', {diagnostic: detail => ipcRenderer.send('diagnostic', detail)});

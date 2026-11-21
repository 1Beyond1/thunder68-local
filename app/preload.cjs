const {contextBridge, ipcRenderer} = require('electron');

function readAppVersion() {
  const arg = process.argv.find(item => item.startsWith('--thunder68-version='));
  if (arg) return arg.slice('--thunder68-version='.length);
  try {
    return String(ipcRenderer.sendSync('app-version') || '');
  } catch {
    return '';
  }
}

contextBridge.exposeInMainWorld('thunder68Local', Object.freeze({
  version: readAppVersion(),
  diagnostic: detail => ipcRenderer.send('diagnostic', detail),
  setTheme: theme => ipcRenderer.send('theme', theme)
}));

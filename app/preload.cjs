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
  setTheme: (theme, choice) => ipcRenderer.send('theme', theme, choice),
  reportDeviceStatus: status => ipcRenderer.send('device-status', status),
  readDiagnostics: () => ipcRenderer.invoke('diagnostics:read'),
  onHidDiscovery: callback => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('hid-discovery', handler);
    return () => ipcRenderer.removeListener('hid-discovery', handler);
  },
  onCompanionAction: callback => {
    if (typeof callback !== 'function') return () => {};
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('companion:action', handler);
    return () => ipcRenderer.removeListener('companion:action', handler);
  },
  profiles: Object.freeze({
    list: () => ipcRenderer.invoke('profiles:list'),
    get: id => ipcRenderer.invoke('profiles:get', id),
    save: payload => ipcRenderer.invoke('profiles:save', payload),
    remove: id => ipcRenderer.invoke('profiles:delete', id),
    exportFile: options => ipcRenderer.invoke('profiles:exportFile', options),
    importFile: () => ipcRenderer.invoke('profiles:importFile')
  }),
  preferences: Object.freeze({
    get: () => ipcRenderer.invoke('preferences:get'),
    update: patch => ipcRenderer.invoke('preferences:update', patch),
    openDataDir: () => ipcRenderer.invoke('shell:openDataDir')
  })
}));

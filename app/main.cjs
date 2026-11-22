const {
  app,
  BrowserWindow,
  session,
  protocol,
  dialog,
  Menu,
  Tray,
  nativeImage,
  nativeTheme,
  globalShortcut,
  Notification,
  screen,
  ipcMain,
  shell
} = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const {
  LOCAL_ORIGIN,
  isConfigInterface,
  classifyHidDiscovery,
  redactSensitiveText,
  sanitizeDiagnosticEntry,
  isLocalUrl,
  isAllowedOrigin,
  isAllowedRequestUrl,
  resolveAsset,
  getContentType,
  formatDeviceChoice,
  resolveWritableDataDir,
  listProfileSummaries,
  readProfileFile,
  saveProfileFile,
  deleteProfileFile,
  profileCore,
  mergePreferences,
  loadPreferencesSync,
  savePreferencesSync,
  resolveEffectiveTheme,
  getThemeWindowChrome,
  injectInitialThemeIntoHtml,
  sanitizeWindowBounds,
  shouldTriggerLowBatteryAlert
} = require('./local-core.cjs');

protocol.registerSchemesAsPrivileged([{
  scheme: 'thunder68',
  privileges: {standard: true, secure: true, supportFetchAPI: true}
}]);

app.setName('雷电68 本地驱动');

const allowDiagnostics = !app.isPackaged || process.env.THUNDER68_ENABLE_DIAGNOSTICS === '1';
const diagnosing = allowDiagnostics && process.argv.includes('--self-test');
const backgroundTest = diagnosing && process.argv.includes('--background-test');
const startMinimized = !diagnosing && process.argv.includes('--minimized');

const defaultUserData = app.getPath('userData');
const preferredDataDir = path.resolve(__dirname, app.isPackaged ? '../../../data' : '../data');

let mainWindow = null;
let tray = null;
let isQuitting = false;
let trayHintShown = false;
let dataDir = defaultUserData;
let logFile = path.join(dataDir, 'diagnostics.jsonl');
let prefsFile = path.join(dataDir, 'preferences.json');
let preferences = loadPreferencesSync(null);
let lastHidDiscovery = null;
let latestDeviceStatus = {
  connected: false,
  deviceOpened: false,
  reading: false,
  busy: false,
  modeLabel: 'USB / 2.4G',
  isWireless: false,
  battery: null
};
let lastDeviceStatusKey = '';
let lowBatteryNotified = false;
let quickSwitchCursor = 0;
let shortcutStatus = {
  toggleWindow: {accelerator: '', ok: true, error: ''},
  quickSwitchProfile: {accelerator: '', ok: true, error: ''}
};

function readRecentSanitizedLogs(limit = 60) {
  try {
    if (!fs.existsSync(logFile)) return [];
    const text = fs.readFileSync(logFile, 'utf8');
    const lines = text.split(/\r?\n/).filter(Boolean).slice(-Math.max(limit * 2, 120));
    const parsed = [];
    for (const line of lines) {
      try {
        const safe = sanitizeDiagnosticEntry(JSON.parse(line));
        if (safe) parsed.push(safe);
      } catch {
        // Ignore malformed lines
      }
    }
    return parsed.slice(-limit);
  } catch {
    return [];
  }
}

function log(event) {
  try {
    fs.mkdirSync(path.dirname(logFile), {recursive: true});
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 2 * 1024 * 1024) {
      fs.renameSync(logFile, logFile + '.previous');
    }
    fs.appendFileSync(logFile, JSON.stringify({time: new Date().toISOString(), ...event}) + '\n');
  } catch {
    // Ignore diagnostic I/O failures so logging never crashes the driver.
  }
}

function activeWindow() {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined;
}

if (!diagnosing && !app.requestSingleInstanceLock()) {
  app.quit();
} else {
  const resolvedData = resolveWritableDataDir(preferredDataDir, defaultUserData);
  dataDir = resolvedData.dir;
  logFile = path.join(dataDir, 'diagnostics.jsonl');
  prefsFile = path.join(dataDir, 'preferences.json');
  preferences = loadPreferencesSync(prefsFile);
  app.setPath('userData', backgroundTest ? path.join(dataDir, 'ui-review') : dataDir);

  const persistPreferences = patch => {
    preferences = mergePreferences(preferences, patch);
    if (!diagnosing) {
      try {
        savePreferencesSync(prefsFile, preferences);
      } catch (error) {
        log({event: 'preferences-save-error', message: error.message});
      }
    }
    return preferences;
  };

  const showGentleNotification = (title, body) => {
    if (diagnosing) return;
    try {
      if (Notification.isSupported()) {
        const iconPath = path.join(__dirname, 'assets/app-icon.png');
        const note = new Notification({
          title,
          body,
          icon: fs.existsSync(iconPath) ? iconPath : undefined,
          silent: true
        });
        note.show();
      }
    } catch {
      // Ignore notification failures on restricted OS setups
    }
  };

  app.on('before-quit', () => {
    isQuitting = true;
  });

  app.on('will-quit', () => {
    try { globalShortcut.unregisterAll(); } catch {}
    if (tray && !tray.isDestroyed()) {
      tray.destroy();
      tray = null;
    }
  });

  if (resolvedData.fallbackUsed) {
    log({
      event: 'data-dir-fallback',
      message: resolvedData.error ? String(resolvedData.error.message || resolvedData.error) : 'preferred dataDir not writable',
      name: dataDir
    });
  }
  log({event: 'launch', version: app.getVersion(), electron: process.versions.electron, offline: true});

  app.on('second-instance', () => {
    const win = activeWindow();
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  });

  app.whenReady().then(async () => {
    const ses = session.defaultSession;
    // Never permit the vendor renderer to load a website or a remote firmware.
    ses.webRequest.onBeforeRequest((details, callback) => callback({cancel: !isAllowedRequestUrl(details.url)}));
    ses.setPermissionCheckHandler((_wc, permission, origin) => permission === 'hid' && isAllowedOrigin(origin));
    ses.setPermissionRequestHandler((_wc, permission, callback, details) => callback(permission === 'hid' && isAllowedRequestUrl(details.requestingUrl)));
    ses.setDevicePermissionHandler(details => details.deviceType === 'hid' && isAllowedOrigin(details.origin) && isConfigInterface(details.device));

    ses.on('select-hid-device', async (event, details, callback) => {
      event.preventDefault();
      const discovery = classifyHidDiscovery(details.deviceList);
      lastHidDiscovery = discovery;
      const candidates = details.deviceList.filter(isConfigInterface);
      log({
        event: 'device-selection',
        reason: discovery.reason,
        count: discovery.configCandidatesCount,
        candidates: discovery.candidates.map(d => ({name: d.name, vendorId: d.vendorId, productId: d.productId}))
      });
      const win = activeWindow();
      if (win) {
        win.webContents.send('hid-discovery', discovery);
      }
      if (candidates.length === 1) return callback(candidates[0].deviceId);
      if (!candidates.length) {
        callback('');
        if (backgroundTest) return;
        const isBt = discovery.reason === 'bluetooth-unsupported';
        await dialog.showMessageBox(activeWindow(), {
          type: 'info',
          title: isBt ? '蓝牙模式不支持 WebHID' : '未找到雷电68',
          message: isBt
            ? '检测到雷电68 非配置接口（疑似蓝牙模式），请切换到 USB 有线或 2.4G 接收器模式后再连接。'
            : '请通过 USB 线或 2.4G 接收器连接雷电68，再点击连接。',
          detail: '如果官网驱动仍开着，请先断开官网中的键盘连接。'
        });
        return;
      }
      if (backgroundTest) return callback('');
      const buttons = [...candidates.map((d, idx) => formatDeviceChoice(d, idx, candidates)), '取消'];
      const result = await dialog.showMessageBox(activeWindow(), {
        type: 'question',
        title: '选择键盘',
        message: '检测到多个雷电68 设备，请选择要配置的连接：',
        buttons,
        cancelId: candidates.length
      });
      callback(candidates[result.response]?.deviceId || '');
    });

    const vendorRoot = path.join(__dirname, 'vendor');
    const localExtras = {
      '/thunder68/local-shell-helpers.js': path.join(__dirname, 'shell-helpers.js'),
      '/thunder68/local-profile-core.js': path.join(__dirname, 'profile-core.js'),
      '/thunder68/local-desktop.js': path.join(__dirname, 'desktop.js'),
      '/thunder68/local-desktop.css': path.join(__dirname, 'desktop.css'),
      '/thunder68/local-ui.js': path.join(__dirname, 'ui.js'),
      '/thunder68/local-profiles-panel.js': path.join(__dirname, 'profiles-panel.js'),
      '/thunder68/local-key-tester.js': path.join(__dirname, 'key-tester.js'),
      '/thunder68/local-companion-panel.js': path.join(__dirname, 'companion-panel.js'),
      '/thunder68/vendor-bridge.js': path.join(__dirname, 'vendor-bridge.js')
    };
    const cspHeader = "default-src 'self' data: blob:; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; object-src 'none'; frame-src 'none'; base-uri 'self'";

    protocol.handle('thunder68', async request => {
      let url;
      try {
        url = new URL(request.url);
      } catch {
        return new Response('Invalid URL', {status: 400});
      }
      const file = (isLocalUrl(url) && localExtras[url.pathname]) || resolveAsset(vendorRoot, request.url);
      if (!file) {
        log({event: 'missing-asset', path: url.pathname});
        return new Response('Local asset not found', {status: 404});
      }
      try {
        const stat = await fsp.stat(file);
        if (!stat.isFile()) {
          log({event: 'missing-asset', path: url.pathname});
          return new Response('Local asset not found', {status: 404});
        }
        let body = await fsp.readFile(file);
        if (file.toLowerCase().endsWith('index.html')) {
          const initialTheme = resolveEffectiveTheme(preferences.themeChoice, nativeTheme.shouldUseDarkColors);
          const injection = '<link rel="stylesheet" href="/thunder68/local-desktop.css"><script src="/thunder68/local-shell-helpers.js"></script><script src="/thunder68/local-profile-core.js"></script><script src="/thunder68/local-desktop.js"></script><script src="/thunder68/vendor-bridge.js"></script><script src="/thunder68/local-ui.js"></script><script src="/thunder68/local-profiles-panel.js"></script><script src="/thunder68/local-key-tester.js"></script><script src="/thunder68/local-companion-panel.js"></script></head>';
          let html = injectInitialThemeIntoHtml(body.toString('utf8'), initialTheme, preferences.themeChoice);
          html = html.replace('</head>', injection);
          body = Buffer.from(html);
        }
        return new Response(body, {
          headers: {
            'content-type': getContentType(file),
            'Content-Security-Policy': cspHeader,
            'X-Content-Type-Options': 'nosniff'
          }
        });
      } catch (error) {
        if (error?.code !== 'ENOENT') log({event: 'asset-read-error', path: url.pathname, message: error.message});
        else log({event: 'missing-asset', path: url.pathname});
        return new Response('Local asset not found', {status: 404});
      }
    });

    const getProfilesDir = () => path.join(dataDir, 'profiles');

    const showMainWindow = () => {
      const win = activeWindow();
      if (!win) return;
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    };

    const toggleMainWindow = () => {
      const win = activeWindow();
      if (!win) return;
      if (win.isVisible() && !win.isMinimized()) {
        win.hide();
      } else {
        showMainWindow();
      }
    };

    const triggerProfileApply = profileId => {
      const win = activeWindow();
      if (!win) return;
      win.webContents.send('companion:action', {type: 'apply-profile', id: profileId});
    };

    const triggerOpenTool = toolId => {
      const win = activeWindow();
      if (!win) return;
      showMainWindow();
      win.webContents.send('companion:action', {type: 'open-tool', toolId});
    };

    const applyLoginItemSetting = enabled => {
      if (diagnosing) return;
      try {
        const args = app.isPackaged ? ['--minimized'] : [path.resolve(__dirname, '..'), '--minimized'];
        app.setLoginItemSettings({
          openAtLogin: Boolean(enabled),
          path: process.execPath,
          args
        });
      } catch (error) {
        log({event: 'login-item-error', message: error.message});
      }
    };

    const applyGlobalShortcuts = () => {
      if (diagnosing) return shortcutStatus;
      try { globalShortcut.unregisterAll(); } catch {}
      const registerOne = (accelerator, handler) => {
        if (!accelerator) return {accelerator: '', ok: true, error: ''};
        try {
          const ok = globalShortcut.register(accelerator, handler);
          return {
            accelerator,
            ok,
            error: ok ? '' : '快捷键已被系统或其他程序占用'
          };
        } catch (error) {
          return {
            accelerator,
            ok: false,
            error: error?.message || '快捷键格式无效'
          };
        }
      };

      shortcutStatus = {
        toggleWindow: registerOne(preferences.globalShortcuts.toggleWindow, toggleMainWindow),
        quickSwitchProfile: registerOne(preferences.globalShortcuts.quickSwitchProfile, () => {
          const list = listProfileSummaries(getProfilesDir()).filter(item => !item.isRollback);
          if (!list.length) {
            showGentleNotification('雷电68 方案切换', '方案库中暂无可轮换的用户方案，请先保存方案。');
            return;
          }
          if (!latestDeviceStatus.connected || latestDeviceStatus.busy) {
            showGentleNotification('雷电68 方案切换', '键盘尚未连接或正在忙态，暂无法快速切换方案。');
            return;
          }
          const target = list[quickSwitchCursor % list.length];
          quickSwitchCursor = (quickSwitchCursor + 1) % list.length;
          triggerProfileApply(target.id);
          showGentleNotification('雷电68 方案切换', `正在通过官方原生导入通道切换至「${target.name}」`);
        })
      };
      return shortcutStatus;
    };

    const formatTrayStatusLine = () => {
      if (!latestDeviceStatus.connected) {
        return latestDeviceStatus.reading ? '状态：正在读取配置…' : '状态：未连接';
      }
      const bat = typeof latestDeviceStatus.battery === 'number' ? ` · 电量 ${latestDeviceStatus.battery}%` : '';
      return `状态：${latestDeviceStatus.modeLabel} 已连接${bat}`;
    };

    const rebuildTrayMenu = () => {
      if (!tray || tray.isDestroyed()) return;
      const userProfiles = listProfileSummaries(getProfilesDir()).filter(item => !item.isRollback);
      const canSwitch = Boolean(latestDeviceStatus.connected && !latestDeviceStatus.busy);
      const profileSubmenu = userProfiles.length
        ? userProfiles.slice(0, 12).map(profile => ({
            label: profile.name,
            enabled: canSwitch,
            click: () => {
              triggerProfileApply(profile.id);
              showGentleNotification('雷电68 方案切换', `正在切换方案「${profile.name}」`);
            }
          }))
        : [{label: '暂无已保存方案', enabled: false}];

      const winVisible = Boolean(activeWindow()?.isVisible());
      const statusLine = formatTrayStatusLine();
      tray.setToolTip(`雷电68 本地驱动 · ${statusLine.replace(/^状态：/, '')}`);
      tray.setContextMenu(Menu.buildFromTemplate([
        {label: statusLine, enabled: false},
        {type: 'separator'},
        {label: '快速切换方案', submenu: profileSubmenu},
        {label: '配置方案库', click: () => triggerOpenTool('profiles')},
        {label: '按键与手感测试', click: () => triggerOpenTool('key-tester')},
        {label: '桌面伴侣设置', click: () => triggerOpenTool('companion')},
        {type: 'separator'},
        {label: winVisible ? '隐藏到托盘' : '显示主窗口', click: toggleMainWindow},
        {
          label: '关闭时最小化到托盘',
          type: 'checkbox',
          checked: Boolean(preferences.minimizeToTray),
          click: item => {
            persistPreferences({minimizeToTray: item.checked});
            activeWindow()?.webContents.send('companion:action', {type: 'preferences-changed', preferences});
            rebuildTrayMenu();
          }
        },
        {type: 'separator'},
        {
          label: '退出雷电68 本地驱动',
          click: () => {
            isQuitting = true;
            app.quit();
          }
        }
      ]));
    };

    ipcMain.on('app-version', event => {
      event.returnValue = app.getVersion();
    });

    ipcMain.on('theme', (event, theme, choice) => {
      const win = activeWindow();
      if (!win || event.sender !== win.webContents || !['dark', 'light'].includes(theme)) return;
      const chrome = getThemeWindowChrome(theme);
      win.setTitleBarOverlay(chrome.titleBarOverlay);
      win.setBackgroundColor(chrome.backgroundColor);
      if (['system', 'dark', 'light'].includes(choice) && choice !== preferences.themeChoice) {
        persistPreferences({themeChoice: choice});
      }
    });

    ipcMain.on('device-status', (event, status) => {
      const win = activeWindow();
      if (!win || event.sender !== win.webContents || !status || typeof status !== 'object') return;
      const next = {
        connected: Boolean(status.connected),
        deviceOpened: Boolean(status.deviceOpened),
        reading: Boolean(status.reading),
        busy: Boolean(status.busy),
        modeLabel: typeof status.modeLabel === 'string' ? status.modeLabel.slice(0, 32) : 'USB / 2.4G',
        isWireless: Boolean(status.isWireless),
        battery: typeof status.battery === 'number' && Number.isFinite(status.battery) ? status.battery : null
      };
      const key = JSON.stringify(next);
      latestDeviceStatus = next;
      const alertDecision = shouldTriggerLowBatteryAlert({
        enabled: preferences.lowBatteryAlert,
        threshold: preferences.lowBatteryThreshold,
        isWireless: next.isWireless,
        battery: next.battery,
        alreadyNotified: lowBatteryNotified
      });
      lowBatteryNotified = alertDecision.nextNotified;
      if (alertDecision.notify) {
        showGentleNotification('雷电68 2.4G 电量偏低', `当前剩余电量 ${next.battery}%，建议及时连接 USB 充电。`);
        log({event: 'low-battery-alert', count: next.battery});
      }
      if (key !== lastDeviceStatusKey) {
        lastDeviceStatusKey = key;
        rebuildTrayMenu();
      }
    });

    ipcMain.handle('preferences:get', event => {
      const win = activeWindow();
      if (!win || event.sender !== win.webContents) return null;
      return {
        preferences,
        shortcutStatus,
        isPackaged: app.isPackaged,
        dataDir: redactSensitiveText(dataDir),
        loginItemSupported: process.platform === 'win32' || process.platform === 'darwin'
      };
    });

    ipcMain.handle('preferences:update', (event, patch) => {
      const win = activeWindow();
      if (!win || event.sender !== win.webContents || !patch || typeof patch !== 'object') return null;
      const prevAutoLaunch = preferences.autoLaunch;
      const prevShortcuts = JSON.stringify(preferences.globalShortcuts);
      persistPreferences(patch);
      if (preferences.autoLaunch !== prevAutoLaunch) {
        applyLoginItemSetting(preferences.autoLaunch);
      }
      if (JSON.stringify(preferences.globalShortcuts) !== prevShortcuts) {
        applyGlobalShortcuts();
      }
      const resolved = resolveEffectiveTheme(preferences.themeChoice, nativeTheme.shouldUseDarkColors);
      const chrome = getThemeWindowChrome(resolved);
      win.setTitleBarOverlay(chrome.titleBarOverlay);
      win.setBackgroundColor(chrome.backgroundColor);
      rebuildTrayMenu();
      return {
        preferences,
        shortcutStatus,
        isPackaged: app.isPackaged,
        dataDir: redactSensitiveText(dataDir),
        loginItemSupported: process.platform === 'win32' || process.platform === 'darwin'
      };
    });

    ipcMain.handle('shell:openDataDir', event => {
      const win = activeWindow();
      if (!win || event.sender !== win.webContents) return false;
      shell.openPath(dataDir);
      return true;
    });

    ipcMain.on('diagnostic', (event, detail) => {
      const win = activeWindow();
      if (!win || event.sender !== win.webContents) return;
      const safe = sanitizeDiagnosticEntry(detail);
      if (safe) log(safe);
    });

    ipcMain.handle('diagnostics:read', event => {
      const win = activeWindow();
      if (!win || event.sender !== win.webContents) return null;
      return {
        meta: {
          appVersion: app.getVersion(),
          electron: process.versions.electron,
          platform: process.platform,
          dataDir: redactSensitiveText(dataDir)
        },
        lastDiscovery: lastHidDiscovery,
        entries: readRecentSanitizedLogs(60)
      };
    });

    ipcMain.handle('profiles:list', event => {
      const win = activeWindow();
      if (!win || event.sender !== win.webContents) return [];
      return listProfileSummaries(getProfilesDir());
    });

    ipcMain.handle('profiles:get', (event, id) => {
      const win = activeWindow();
      if (!win || event.sender !== win.webContents) return null;
      try {
        return readProfileFile(getProfilesDir(), id);
      } catch {
        return null;
      }
    });

    ipcMain.handle('profiles:save', (event, payload) => {
      const win = activeWindow();
      if (!win || event.sender !== win.webContents) return {ok: false, errors: ['无效窗口上下文。']};
      const result = saveProfileFile(getProfilesDir(), payload);
      if (result.ok) {
        log({event: 'profile-saved', name: result.profile.id});
        rebuildTrayMenu();
      }
      return result;
    });

    ipcMain.handle('profiles:delete', (event, id) => {
      const win = activeWindow();
      if (!win || event.sender !== win.webContents) return {ok: false, error: '无效窗口上下文。'};
      const result = deleteProfileFile(getProfilesDir(), id);
      if (result.ok) {
        log({event: 'profile-deleted', name: String(id || '')});
        rebuildTrayMenu();
      }
      return result;
    });

    ipcMain.handle('profiles:exportFile', async (event, {id, format = 'profile'} = {}) => {
      const win = activeWindow();
      if (!win || event.sender !== win.webContents) return {ok: false, canceled: true};
      const profile = readProfileFile(getProfilesDir(), id);
      if (!profile) return {ok: false, error: '找不到指定方案。'};
      const safeFileName = (profile.name || profile.id).replace(/[<>:"/\\|?*]+/g, '_').slice(0, 50) || profile.id;
      const dialogResult = await dialog.showSaveDialog(win, {
        title: '导出配置方案 JSON',
        defaultPath: `${safeFileName}${format === 'official' ? '.official' : ''}.json`,
        filters: [{name: 'JSON 配置文件', extensions: ['json']}]
      });
      if (dialogResult.canceled || !dialogResult.filePath) return {ok: false, canceled: true};
      const out = format === 'official'
        ? profileCore.buildOfficialImportPayload(profile.config)
        : profile;
      await fsp.writeFile(dialogResult.filePath, JSON.stringify(out, null, 2), 'utf8');
      return {ok: true, canceled: false};
    });

    ipcMain.handle('profiles:importFile', async event => {
      const win = activeWindow();
      if (!win || event.sender !== win.webContents) return {ok: false, canceled: true};
      const dialogResult = await dialog.showOpenDialog(win, {
        title: '导入配置方案 JSON',
        properties: ['openFile'],
        filters: [{name: 'JSON 配置文件', extensions: ['json']}]
      });
      if (dialogResult.canceled || !dialogResult.filePaths?.length) return {ok: false, canceled: true};
      const picked = dialogResult.filePaths[0];
      const stat = await fsp.stat(picked);
      if (stat.size > 2 * 1024 * 1024) {
        return {ok: false, errors: ['配置文件超过 2 MiB 上限，已拒绝导入。']};
      }
      const rawText = await fsp.readFile(picked, 'utf8');
      const fallbackName = path.basename(picked, path.extname(picked)).slice(0, 50) || '导入方案';
      const parsed = profileCore.parseImportedProfileJson(rawText, fallbackName);
      if (!parsed.ok) return {ok: false, errors: parsed.errors};
      const saved = saveProfileFile(getProfilesDir(), parsed.profile);
      if (saved.ok) {
        log({event: 'profile-imported', name: saved.profile.id});
        rebuildTrayMenu();
      }
      return saved;
    });

    const initialTheme = resolveEffectiveTheme(preferences.themeChoice, nativeTheme.shouldUseDarkColors);
    const initialChrome = getThemeWindowChrome(initialTheme);
    const displayAreas = screen.getAllDisplays().map(d => d.workArea);
    const restoredBounds = diagnosing
      ? {width: 1400, height: 940, maximized: false}
      : sanitizeWindowBounds(preferences.windowBounds, displayAreas);
    const appIconPath = path.join(__dirname, 'assets/app-icon.png');

    mainWindow = new BrowserWindow({
      width: restoredBounds.width,
      height: restoredBounds.height,
      ...(typeof restoredBounds.x === 'number' && typeof restoredBounds.y === 'number'
        ? {x: restoredBounds.x, y: restoredBounds.y}
        : {}),
      minWidth: 1024,
      minHeight: 720,
      show: false,
      title: '雷电68 本地驱动',
      icon: fs.existsSync(appIconPath) ? appIconPath : undefined,
      backgroundColor: initialChrome.backgroundColor,
      titleBarStyle: 'hidden',
      titleBarOverlay: initialChrome.titleBarOverlay,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.cjs'),
        additionalArguments: ['--thunder68-version=' + app.getVersion()],
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        offscreen: backgroundTest,
        backgroundThrottling: !backgroundTest
      }
    });

    let boundsTimer = null;
    const scheduleSaveBounds = () => {
      if (diagnosing) return;
      clearTimeout(boundsTimer);
      boundsTimer = setTimeout(() => {
        const win = activeWindow();
        if (!win) return;
        const maximized = win.isMaximized();
        const normal = win.getNormalBounds();
        persistPreferences({
          windowBounds: {
            x: normal.x,
            y: normal.y,
            width: normal.width,
            height: normal.height,
            maximized
          }
        });
      }, 350);
    };

    mainWindow.on('resize', scheduleSaveBounds);
    mainWindow.on('move', scheduleSaveBounds);
    mainWindow.on('maximize', scheduleSaveBounds);
    mainWindow.on('unmaximize', scheduleSaveBounds);
    mainWindow.on('show', rebuildTrayMenu);
    mainWindow.on('hide', rebuildTrayMenu);

    mainWindow.on('close', event => {
      if (!isQuitting && !diagnosing && preferences.minimizeToTray) {
        event.preventDefault();
        mainWindow.hide();
        rebuildTrayMenu();
        if (!trayHintShown) {
          trayHintShown = true;
          showGentleNotification('雷电68 已最小化到托盘', '程序在系统托盘后台常驻，点击托盘图标可恢复窗口或彻底退出。');
        }
      }
    });

    mainWindow.webContents.on('page-title-updated', event => {
      event.preventDefault();
      const win = activeWindow();
      if (win) win.setTitle('雷电68 本地驱动');
    });
    mainWindow.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
    mainWindow.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith(LOCAL_ORIGIN + '/')) event.preventDefault();
    });
    mainWindow.webContents.on('render-process-gone', (_event, detail) => log({event: 'renderer-gone', reason: detail.reason}));
    mainWindow.on('closed', () => {mainWindow = null;});

    if (!diagnosing) {
      const trayIconPath = path.join(__dirname, 'assets/tray-icon.png');
      const trayImage = fs.existsSync(trayIconPath) ? nativeImage.createFromPath(trayIconPath) : nativeImage.createEmpty();
      tray = new Tray(trayImage);
      tray.on('click', toggleMainWindow);
      tray.on('double-click', showMainWindow);
      rebuildTrayMenu();
      applyGlobalShortcuts();
    }

    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {
        label: '驱动',
        submenu: [
          {label: '重新加载界面', accelerator: 'F5', click: () => activeWindow()?.reload()},
          {label: '打开本地资料目录', click: () => shell.openPath(dataDir)},
          {type: 'separator'},
          {label: '退出', click: () => { isQuitting = true; app.quit(); }}
        ]
      },
      {
        label: '视图',
        submenu: [
          {role: 'resetZoom', label: '恢复默认大小'},
          {role: 'zoomIn', label: '放大'},
          {role: 'zoomOut', label: '缩小'},
          {role: 'togglefullscreen', label: '全屏'}
        ]
      },
      {
        label: '帮助',
        submenu: [{
          label: '关于本地版',
          click: () => dialog.showMessageBox(activeWindow(), {
            title: '雷电68 本地驱动',
            message: '雷电68 本地驱动 ' + app.getVersion(),
            detail: '个人使用的离线桌面版，配置界面与通信逻辑来自达尔优官网。\n资料保存在：' + dataDir + '\n支持本地配置方案库、离线按键与磁轴手感测试及系统托盘常驻。\n固件更新请使用官方网页。'
          })
        }]
      }
    ]));

    await mainWindow.loadURL(LOCAL_ORIGIN + '/thunder68/');
    if (!diagnosing && !startMinimized) {
      if (restoredBounds.maximized) mainWindow.maximize();
      mainWindow.show();
    }

    if (diagnosing) {
      await runDiagnostics(mainWindow);
    }
  }).catch(error => {
    log({event: 'fatal-error', message: error?.stack || String(error)});
    if (!diagnosing) dialog.showErrorBox('本地驱动启动失败', error?.message || String(error));
    app.exit(1);
  });

  app.on('window-all-closed', () => {
    if (isQuitting || diagnosing || !preferences.minimizeToTray) {
      app.quit();
    }
  });
}

async function runDiagnostics(win) {
  await new Promise(resolve => setTimeout(resolve, 700));
  if (process.argv.includes('--connect-test')) {
    await win.webContents.executeJavaScript(`(() => {const button=document.querySelector('.local-connect-button'); if (!button) throw new Error('Connect control not rendered'); button.click(); return true;})()`, true);
    await new Promise(resolve => setTimeout(resolve, 2500));
    for (let attempt = 0; attempt < 100; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      const completed = await win.webContents.executeJavaScript(`!!document.querySelector('.main-content') && !window.thunder68Helpers.isReadingConfig(document.getElementById('root')?.textContent, window.thunder68Presentation?.state())`);
      if (completed) break;
    }
  }
  const report = await win.webContents.executeJavaScript(`(async () => ({title: document.title, text: document.body.textContent.slice(0, 6000), secure: window.isSecureContext, hidAvailable: !!navigator.hid, devices: (await navigator.hid.getDevices()).map(d => ({name: d.productName, opened: d.opened, vendorId: d.vendorId, productId: d.productId, collections: d.collections.map(c => ({usagePage: c.usagePage, usage: c.usage}))})), images: [...document.images].map(i => ({src: i.getAttribute('src'), loaded: i.complete && i.naturalWidth > 0}))}))()`);
  const output = path.resolve(__dirname, app.isPackaged ? '../../../output' : '../output');
  fs.mkdirSync(output, {recursive: true});
  report.configurationReadComplete = report.devices.some(d => d.opened) && await win.webContents.executeJavaScript(`!!document.querySelector('.main-content') && !window.thunder68Presentation.state()?.config?.mask && !window.thunder68Helpers.isReadingConfig(document.getElementById('root')?.textContent, window.thunder68Presentation?.state())`);
  fs.writeFileSync(path.join(output, 'self-test.json'), JSON.stringify(report, null, 2));

  if (process.argv.includes('--redesign-audit')) {
    const auditModulePath = path.join(__dirname, 'redesign-audit.cjs');
    if (fs.existsSync(auditModulePath)) await require(auditModulePath)(win, output);
  }
  if (process.argv.includes('--ui-audit')) {
    const tree = await win.webContents.executeJavaScript(`(() => {function walk(e, depth) {if (depth > 12) return null; const r = e.getBoundingClientRect(); return {tag: e.tagName, cls: e.className, style: e.getAttribute('style'), text: e.children.length ? undefined : e.textContent.slice(0,100), rect: [r.x,r.y,r.width,r.height].map(Math.round), children: [...e.children].map(c => walk(c,depth+1)).filter(Boolean)};} return walk(document.getElementById('root'),0);})()`);
    fs.writeFileSync(path.join(output, 'ui-tree.json'), JSON.stringify(tree, null, 2));
    const bridge = await win.webContents.executeJavaScript(`(() => {const s=window.thunder68Presentation?.state();return {storeFound:!!s, configKeys:Object.keys(s?.config||{}), selection:s?.config?.mapPendingKey, palette:[...document.querySelectorAll('span')].filter(n=>n.textContent==='Esc').map(n=>{const e=n.parentElement,p=e[Object.keys(e).find(k=>k.startsWith('__reactProps$'))];return {style:e.getAttribute('style'),props:Object.keys(p||{})};})};})()`);
    fs.writeFileSync(path.join(output, 'ui-bridge.json'), JSON.stringify(bridge, null, 2));
    if (!backgroundTest) win.show();
    await new Promise(resolve => setTimeout(resolve, 500));
    fs.writeFileSync(path.join(output, process.argv.includes('--connect-test') ? 'ui-keymap.png' : 'ui-home.png'), (await win.webContents.capturePage()).toPNG());
    if (process.argv.includes('--connect-test')) {
      const uiReport = [];
      for (let index = 0; index < 6; index++) {
        await win.webContents.executeJavaScript(`document.querySelector('.local-nav-item[data-page="${index}"]').click()`, true);
        await new Promise(resolve => setTimeout(resolve, 400));
        uiReport.push(await win.webContents.executeJavaScript(`({index:${index}, heading:document.querySelector('.local-page-heading h1').textContent, active:document.querySelector('.local-nav-item.is-active')?.dataset.page, text:document.querySelector('.main-content').textContent.slice(-3500), panelVisible:!!document.querySelector('.local-settings-panel')?.getBoundingClientRect().height, overflow:document.documentElement.scrollWidth > innerWidth})`));
        fs.writeFileSync(path.join(output, 'ui-page-' + index + '.png'), (await win.webContents.capturePage()).toPNG());
      }
      fs.writeFileSync(path.join(output, 'ui-audit.json'), JSON.stringify(uiReport, null, 2));
    }
  }
  try {
    fs.writeFileSync(path.join(output, 'self-test.png'), (await win.webContents.capturePage()).toPNG());
  } catch (error) {
    log({event: 'self-test-screenshot-unavailable', message: error.message});
  }
  app.quit();
}

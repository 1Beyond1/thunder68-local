const {app, BrowserWindow, session, protocol, dialog, Menu, ipcMain, shell} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {LOCAL_ORIGIN, isConfigInterface, isLocalUrl, resolveAsset} = require('./local-core.cjs');
protocol.registerSchemesAsPrivileged([{scheme: 'thunder68', privileges: {standard: true, secure: true, supportFetchAPI: true}}]);
const dataDir = path.resolve(__dirname, app.isPackaged ? '../../../data' : '../data');
fs.mkdirSync(dataDir, {recursive: true});
app.setPath('userData', dataDir);
app.setName('雷电68 本地驱动');
const diagnosing = process.argv.includes('--self-test');
const backgroundTest = diagnosing && process.argv.includes('--background-test');
if (backgroundTest) app.setPath('userData', path.join(dataDir, 'ui-review'));
let mainWindow;
const logFile = path.join(dataDir, 'diagnostics.jsonl');
function log(event) {
  if (fs.existsSync(logFile) && fs.statSync(logFile).size > 2 * 1024 * 1024) fs.renameSync(logFile, logFile + '.previous');
  fs.appendFileSync(logFile, JSON.stringify({time: new Date().toISOString(), ...event}) + '\n');
}
log({event: 'launch', version: app.getVersion(), electron: process.versions.electron, offline: true});

if (!diagnosing && !app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {if (mainWindow) {if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus();}});
  app.whenReady().then(async () => {
    const ses = session.defaultSession;
    // Never permit the vendor renderer to load a website or a remote firmware.
    ses.webRequest.onBeforeRequest((details, callback) => callback({cancel: !details.url.startsWith(LOCAL_ORIGIN + '/') && !/^(data|blob):/.test(details.url)}));
    ses.setPermissionCheckHandler((_wc, permission, origin) => permission === 'hid' && [LOCAL_ORIGIN, LOCAL_ORIGIN + '/'].includes(origin));
    ses.setPermissionRequestHandler((_wc, permission, callback, details) => callback(permission === 'hid' && details.requestingUrl?.startsWith(LOCAL_ORIGIN + '/')));
    ses.setDevicePermissionHandler(details => details.deviceType === 'hid' && details.origin === LOCAL_ORIGIN && isConfigInterface(details.device));
    ses.on('select-hid-device', async (event, details, callback) => {
      event.preventDefault();
      const candidates = details.deviceList.filter(isConfigInterface);
      log({event: 'device-selection', candidates: candidates.map(d => ({name: d.name, vendorId: d.vendorId, productId: d.productId}))});
      if (candidates.length === 1) return callback(candidates[0].deviceId);
      if (!candidates.length) {
        callback('');
        if (backgroundTest) return;
        await dialog.showMessageBox(mainWindow, {type: 'info', title: '未找到雷电68', message: '请用 USB 连接雷电68，再点击连接。', detail: '如果官网驱动仍开着，请先断开官网中的键盘连接。'});
        return;
      }
      if (backgroundTest) return callback('');
      const result = await dialog.showMessageBox(mainWindow, {type: 'question', title: '选择键盘', message: '请选择要配置的雷电68', buttons: [...candidates.map(d => d.name || '雷电68'), '取消'], cancelId: candidates.length});
      callback(candidates[result.response]?.deviceId || '');
    });
    const vendorRoot = path.join(__dirname, 'vendor');
    const types = {'.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf'};
    protocol.handle('thunder68', request => {
      const localExtras = {'/thunder68/local-desktop.js': path.join(__dirname, 'desktop.js'), '/thunder68/local-desktop.css': path.join(__dirname, 'desktop.css'), '/thunder68/local-ui.js': path.join(__dirname, 'ui.js'), '/thunder68/vendor-bridge.js': path.join(__dirname, 'vendor-bridge.js'), '/thunder68/keyboard-layout.json': path.join(__dirname, 'keyboard-layout.json')};
      const url = new URL(request.url);
      const file = isLocalUrl(url) && localExtras[url.pathname] || resolveAsset(vendorRoot, request.url);
      if (!file || !fs.existsSync(file)) {log({event: 'missing-asset', path: url.pathname}); return new Response('Local asset not found', {status: 404});}
      let body = fs.readFileSync(file);
      if (file.endsWith('index.html')) body = Buffer.from(body.toString('utf8').replace('</head>', '<link rel="stylesheet" href="/thunder68/local-desktop.css"><script src="/thunder68/local-desktop.js"></script><script src="/thunder68/vendor-bridge.js"></script><script src="/thunder68/local-ui.js"></script></head>'));
      return new Response(body, {headers: {'content-type': types[path.extname(file)] || 'application/octet-stream', 'Content-Security-Policy': "default-src 'self' data: blob:; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:; object-src 'none'; frame-src 'none'; base-uri 'self'", 'X-Content-Type-Options': 'nosniff'}});
    });
    mainWindow = new BrowserWindow({width: 1400, height: 940, minWidth: 1024, minHeight: 720, show: false, title: '雷电68 本地驱动', backgroundColor: '#101113', titleBarStyle: 'hidden', titleBarOverlay: {color: '#101113', symbolColor: '#f4f5f7', height: 44}, autoHideMenuBar: true, webPreferences: {preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, offscreen: backgroundTest, backgroundThrottling: !backgroundTest}});
    mainWindow.webContents.on('page-title-updated', event => {event.preventDefault(); mainWindow.setTitle('雷电68 本地驱动');});
    ipcMain.on('theme',(event,theme)=>{if(event.sender!==mainWindow.webContents || !['dark','light'].includes(theme))return;mainWindow.setTitleBarOverlay({color:theme==='dark'?'#111214':'#ffffff',symbolColor:theme==='dark'?'#f4f5f7':'#181a1d',height:44});mainWindow.setBackgroundColor(theme==='dark'?'#111214':'#f5f6f7');});
    mainWindow.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
    mainWindow.webContents.on('will-navigate', (event, url) => {if (!url.startsWith(LOCAL_ORIGIN + '/')) event.preventDefault();});
    mainWindow.webContents.on('render-process-gone', (_event, detail) => log({event: 'renderer-gone', reason: detail.reason}));
    ipcMain.on('diagnostic', (event, detail) => {
      if (event.sender !== mainWindow.webContents || !detail || typeof detail.event !== 'string') return;
      const safe = {event: detail.event.slice(0, 80)};
      for (const key of ['name', 'message', 'vendorId', 'productId', 'reportId', 'bytes', 'count']) if (['string', 'number'].includes(typeof detail[key])) safe[key] = typeof detail[key] === 'string' ? detail[key].slice(0, 1200) : detail[key];
      log(safe);
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label: '驱动', submenu: [{label: '重新加载界面', accelerator: 'F5', click: () => mainWindow.reload()}, {label: '打开本地资料目录', click: () => shell.openPath(dataDir)}, {type: 'separator'}, {label: '退出', role: 'quit'}]},
      {label: '视图', submenu: [{role: 'resetZoom', label: '恢复默认大小'}, {role: 'zoomIn', label: '放大'}, {role: 'zoomOut', label: '缩小'}, {role: 'togglefullscreen', label: '全屏'}]},
      {label: '帮助', submenu: [{label: '关于本地版', click: () => dialog.showMessageBox(mainWindow, {title: '雷电68 本地驱动', message: '雷电68 本地驱动 ' + app.getVersion(), detail: '个人使用的离线桌面版，配置界面与通信逻辑来自达尔优官网。\n资料保存在程序旁的 data 目录。\n此版本提供本地配置；暂不提供开机自动恢复。\n固件更新请使用官方网页。'})}]}
    ]));
    await mainWindow.loadURL(LOCAL_ORIGIN + '/thunder68/');
    if (!diagnosing) mainWindow.show();
    if (diagnosing) {
      await new Promise(resolve => setTimeout(resolve, 700));
      if (process.argv.includes('--connect-test')) {
        await mainWindow.webContents.executeJavaScript(`(() => {const button=document.querySelector('.local-connect-button'); if (!button) throw new Error('Connect control not rendered'); button.click(); return true;})()`, true);
        await new Promise(resolve => setTimeout(resolve, 2500));
        for (let attempt = 0; attempt < 100; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 250));
          const completed = await mainWindow.webContents.executeJavaScript(`!!document.querySelector('.main-content') && !document.getElementById('root').textContent.includes('正在配置读取')`);
          if (completed) break;
        }
      }
      const report = await mainWindow.webContents.executeJavaScript(`(async () => ({title: document.title, text: document.body.textContent.slice(0, 6000), secure: window.isSecureContext, hidAvailable: !!navigator.hid, devices: (await navigator.hid.getDevices()).map(d => ({name: d.productName, opened: d.opened, vendorId: d.vendorId, productId: d.productId, collections: d.collections.map(c => ({usagePage: c.usagePage, usage: c.usage}))})), images: [...document.images].map(i => ({src: i.getAttribute('src'), loaded: i.complete && i.naturalWidth > 0}))}))()`);
      const output = path.resolve(__dirname, app.isPackaged ? '../../../output' : '../output'); fs.mkdirSync(output, {recursive: true});
      report.configurationReadComplete = report.devices.some(d => d.opened) && await mainWindow.webContents.executeJavaScript(`!!document.querySelector('.main-content') && !window.thunder68Presentation.state()?.config?.mask && !document.getElementById('root').textContent.includes('正在配置读取')`);
      fs.writeFileSync(path.join(output, 'self-test.json'), JSON.stringify(report, null, 2));
      if(process.argv.includes('--redesign-audit'))await require('./redesign-audit.cjs')(mainWindow,output);
      if (process.argv.includes('--ui-audit')) {
        const tree = await mainWindow.webContents.executeJavaScript(`(() => {function walk(e, depth) {if (depth > 12) return null; const r = e.getBoundingClientRect(); return {tag: e.tagName, cls: e.className, style: e.getAttribute('style'), text: e.children.length ? undefined : e.textContent.slice(0,100), rect: [r.x,r.y,r.width,r.height].map(Math.round), children: [...e.children].map(c => walk(c,depth+1)).filter(Boolean)};} return walk(document.getElementById('root'),0);})()`);
        fs.writeFileSync(path.join(output, 'ui-tree.json'), JSON.stringify(tree, null, 2));
        const bridge = await mainWindow.webContents.executeJavaScript(`(() => {const s=window.thunder68Presentation?.state();return {storeFound:!!s, configKeys:Object.keys(s?.config||{}), selection:s?.config?.mapPendingKey, palette:[...document.querySelectorAll('span')].filter(n=>n.textContent==='Esc').map(n=>{const e=n.parentElement,p=e[Object.keys(e).find(k=>k.startsWith('__reactProps$'))];return {style:e.getAttribute('style'),props:Object.keys(p||{})};})};})()`);
        fs.writeFileSync(path.join(output, 'ui-bridge.json'), JSON.stringify(bridge,null,2));
        if (!backgroundTest) mainWindow.show();
        await new Promise(resolve => setTimeout(resolve, 500));
        fs.writeFileSync(path.join(output, process.argv.includes('--connect-test') ? 'ui-keymap.png' : 'ui-home.png'), (await mainWindow.webContents.capturePage()).toPNG());
        if (process.argv.includes('--connect-test')) {
          const uiReport = [];
          for (let index = 0; index < 6; index++) {
            await mainWindow.webContents.executeJavaScript(`document.querySelector('.local-nav-item[data-page="${index}"]').click()`, true);
            await new Promise(resolve => setTimeout(resolve, 400));
            uiReport.push(await mainWindow.webContents.executeJavaScript(`({index:${index}, heading:document.querySelector('.local-page-heading h1').textContent, active:document.querySelector('.local-nav-item.is-active')?.dataset.page, text:document.querySelector('.main-content').textContent.slice(-3500), panelVisible:!!document.querySelector('.local-settings-panel')?.getBoundingClientRect().height, overflow:document.documentElement.scrollWidth > innerWidth})`));
            fs.writeFileSync(path.join(output, 'ui-page-' + index + '.png'), (await mainWindow.webContents.capturePage()).toPNG());
            if (index === 0) {
              const interaction = await mainWindow.webContents.executeJavaScript(`(async () => {
                const pause=()=>new Promise(r=>setTimeout(r,80));
                const canvas=document.querySelector('.keyboard_image canvas'),r=canvas.getBoundingClientRect();
                const state=window.thunder68Presentation.state();
                const layout=state.common.deviceParams.layoutMappingData;
                const keyCount=layout.length;
                const esc=layout.find(k=>k.id==='Esc');
                canvas.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:r.x+(esc.x+esc.width/2)/state.common.deviceParams.layoutX*r.width,clientY:r.y+(esc.y+esc.height/2)/state.common.deviceParams.layoutY*r.height}));
                await pause();const single=window.thunder68Presentation.state().config.mapPendingKey;
                document.querySelector('.local-clear-selection').click();await pause();const cleared=window.thunder68Presentation.state().config.mapPendingKey;
                const search=document.querySelector('.local-palette input');search.value='空格';search.dispatchEvent(new Event('input',{bubbles:true}));await pause();
                const searchMatches=[...document.querySelectorAll('.local-function-key')].filter(b=>!b.hidden).map(b=>b.textContent);
                search.value='不存在的按键';search.dispatchEvent(new Event('input',{bubbles:true}));const emptyVisible=!document.querySelector('.local-search-empty').hidden;
                search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));
                return {keyCount,single,cleared,searchMatches,emptyVisible,nativeCanvasSize:[canvas.width,canvas.height],photoVisible:getComputedStyle(document.querySelector('.keyboard_image')).opacity==='1'};
              })()`);
              fs.writeFileSync(path.join(output,'ui-interactions.json'),JSON.stringify(interaction,null,2));
              if(interaction.keyCount!==68 || interaction.single.join()!=='Esc' || interaction.cleared.length || !interaction.searchMatches.includes('Space') || !interaction.emptyVisible || !interaction.photoVisible) throw new Error('Replacement UI interaction check failed');
            }
            if (index === 2) {
              await mainWindow.webContents.executeJavaScript(`document.querySelector('[data-select="WASD"]').click()`);
              await new Promise(resolve => setTimeout(resolve,100));
              const bulk = await mainWindow.webContents.executeJavaScript(`window.thunder68Presentation.state().config.mapPendingKey`);
              fs.writeFileSync(path.join(output,'ui-bulk-selection.json'),JSON.stringify({selected:bulk},null,2));
              if(!['W','A','S','D'].every(id=>bulk.includes(id)))throw new Error('WASD selection check failed');
              const detail = await mainWindow.webContents.executeJavaScript(`({text:document.querySelector('.local-key-details').textContent, values:window.thunder68Presentation.state().config.keyValues.filter(k=>['W','A','S','D'].includes(k.id)), width:document.querySelector('.keyboard_image canvas').getBoundingClientRect().width})`);
              fs.writeFileSync(path.join(output,'ui-parameter-details.json'),JSON.stringify(detail,null,2));
              if(detail.width<650 || !detail.text.includes('触发行程') || detail.text.includes('未读取'))throw new Error('Keyboard size or parameter readout check failed');
              fs.writeFileSync(path.join(output,'ui-trigger-selected.png'),(await mainWindow.webContents.capturePage()).toPNG());
              mainWindow.setSize(1920,1080);
              await new Promise(resolve=>setTimeout(resolve,350));
              const resizedDrawing=await mainWindow.webContents.executeJavaScript(`(() => {const c=document.querySelector('.keyboard_image canvas'),pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;return pixels.some((v,i)=>i%4===3 && v>0);})()`);
              if(!resizedDrawing)throw new Error('Keyboard drawing was cleared on resize');
              const resizedParameters=await mainWindow.webContents.executeJavaScript(`(() => {const c=document.querySelector('.local-parameter-labels');return !c.hasAttribute('hidden') && c.querySelectorAll('text').length>=68;})()`);
              if(!resizedParameters)throw new Error('Keyboard parameter labels missing after resize');
              const labelState=await mainWindow.webContents.executeJavaScript(`(() => {const c=document.querySelector('.local-parameter-labels'),s=getComputedStyle(c),r=c.getBoundingClientRect();return {labels:c.querySelectorAll('text').length,display:s.display,opacity:s.opacity,zIndex:s.zIndex,clipPath:s.clipPath,rect:[r.x,r.y,r.width,r.height]};})()`);
              fs.writeFileSync(path.join(output,'ui-parameter-layer.json'),JSON.stringify(labelState,null,2));
              fs.writeFileSync(path.join(output,'ui-trigger-wide.png'),(await mainWindow.webContents.capturePage()).toPNG());
              mainWindow.setSize(1024,720);
              await new Promise(resolve=>setTimeout(resolve,350));
              fs.writeFileSync(path.join(output,'ui-trigger-compact.png'),(await mainWindow.webContents.capturePage()).toPNG());
              mainWindow.setSize(1400,940);
              await new Promise(resolve=>setTimeout(resolve,350));
              await mainWindow.webContents.executeJavaScript(`document.querySelector('.local-clear-selection').click()`);
            }
          }
          mainWindow.setSize(1024, 720);
          await new Promise(resolve => setTimeout(resolve, 400));
          fs.writeFileSync(path.join(output, 'ui-compact.png'), (await mainWindow.webContents.capturePage()).toPNG());
          await mainWindow.webContents.executeJavaScript(`document.querySelector('.local-device-link').click()`, true);
          await new Promise(resolve => setTimeout(resolve, 300));
          uiReport.push(await mainWindow.webContents.executeJavaScript(`({returnedToDevices:document.body.classList.contains('local-home'), overflow:document.documentElement.scrollWidth > innerWidth})`));
          fs.writeFileSync(path.join(output, 'ui-compact-home.png'), (await mainWindow.webContents.capturePage()).toPNG());
          fs.writeFileSync(path.join(output, 'ui-audit.json'), JSON.stringify(uiReport, null, 2));
        }
      }
      try {fs.writeFileSync(path.join(output, 'self-test.png'), (await mainWindow.webContents.capturePage()).toPNG());}
      catch (error) {log({event: 'self-test-screenshot-unavailable', message: error.message});}
      app.quit();
    }
  }).catch(error => {log({event: 'fatal-error', message: error.stack}); if (!diagnosing) dialog.showErrorBox('本地驱动启动失败', error.message); app.exit(1);});
  app.on('window-all-closed', () => app.quit());
}

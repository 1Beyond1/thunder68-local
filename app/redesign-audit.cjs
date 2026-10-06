const fs = require('node:fs/promises');
const path = require('node:path');

// UI actions only: this audit never assigns a function or adjusts a device value.
module.exports = async function redesignAudit(mainWindow, output) {
  await fs.mkdir(output, {recursive: true});
  const report = {startedAt: new Date().toISOString(), checks: [], screenshots: [],
    limits: ['Selection, navigation and theme tests do not validate device parameter writes.',
      'The error message test uses a simulated thunder68-feedback event.',
      'System theme responsiveness is tested through Chromium media emulation; the OS theme is not changed.',
      'Theme persistence is tested by reloading the real device-list page before reconnecting.']};
  const evaluate = code => mainWindow.webContents.executeJavaScript(code, true);
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const check = (name, passed, details) => {
    report.checks.push({name, passed: !!passed, ...(details === undefined ? {} : {details})});
    if (!passed) throw new Error(`Redesign audit failed: ${name}`);
  };
  const waitFor = async (code, label, timeout = 12000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {if (await evaluate(code)) return; await pause(100);}
    check(label, false);
  };
  const snapshot = () => evaluate(`(() => {
    const state = window.thunder68Presentation?.state();
    const config = state?.config;
    if (!config) return null;
    const names = Object.keys(config).filter(name => /keyValues|buttonMap|light|color|settings|superkeys|macroMap|triggerMode|rate|poll|sleep|lock|debounce|axis/i.test(name) && !/Show$|Index$|mask|pending/i.test(name)).sort();
    return {configName: state.common.currentConfigName, configFields: Object.keys(config).sort(),
      deviceFields: Object.fromEntries(names.map(name => [name, config[name]]))};
  })()`);
  const selected = () => evaluate('window.thunder68Presentation.state().config.mapPendingKey');
  const click = async selector => {
    check(`control exists: ${selector}`, await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`));
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await pause(180);
  };
  const navigate = async page => {
    await click(`.local-nav-item[data-page="${page}"]`);
    await waitFor(`document.body.dataset.localPage === '${page}' && !window.thunder68Presentation.state()?.config?.mask`, `navigation page ${page}`);
  };
  const theme = async choice => {
    await evaluate(`(() => {const control=document.querySelector('#local-theme');control.value=${JSON.stringify(choice)};control.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await pause(120);
    const state = await evaluate(`({choice:document.documentElement.dataset.themeChoice,resolved:document.documentElement.dataset.theme,stored:localStorage.getItem('thunder68.theme'),system:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})`);
    check(`theme ${choice}: resolved and stored`, state.choice === choice && state.stored === choice && state.resolved === (choice === 'system' ? state.system : choice), state);
  };
  const systemThemeResponses = async () => {
    const debuggerApi = mainWindow.webContents.debugger;
    let attachedHere = false;
    try {
      if (!debuggerApi.isAttached()) {debuggerApi.attach('1.3'); attachedHere = true;}
      await theme('system');
      for (const resolved of ['dark','light']) {
        await debuggerApi.sendCommand('Emulation.setEmulatedMedia', {features:[{name:'prefers-color-scheme',value:resolved}]});
        await waitFor(`document.documentElement.dataset.theme === '${resolved}'`, `system theme responds to emulated ${resolved}`);
        const state = await evaluate(`({choice:document.documentElement.dataset.themeChoice,resolved:document.documentElement.dataset.theme,stored:localStorage.getItem('thunder68.theme'),media:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'})`);
        check(`system automatic ${resolved} response`, state.choice === 'system' && state.stored === 'system' && state.resolved === resolved && state.media === resolved, {...state,emulated:true});
      }
    } finally {
      try {if (debuggerApi.isAttached()) await debuggerApi.sendCommand('Emulation.setEmulatedMedia',{features:[]});}
      finally {if (attachedHere && debuggerApi.isAttached()) debuggerApi.detach();}
      await pause(120);
    }
  };
  const geometry = () => evaluate(`(() => {
    const bounds=element=>{const r=element?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}:null;};
    const nodes=[document.documentElement,document.body,document.querySelector('#root'),document.querySelector('.main-content')].filter(Boolean);
    return {size:[innerWidth,innerHeight], horizontalOverflow:nodes.some(node=>node.scrollWidth > node.clientWidth + 2),
      overflowNodes:nodes.filter(node=>node.scrollWidth > node.clientWidth + 2).map(node=>({name:node.id||node.className,width:node.clientWidth,scroll:node.scrollWidth})),
      keyboard:bounds(document.querySelector('.keyboard_image canvas')),stage:bounds(document.querySelector('.local-keyboard-stage')),
      panel:bounds(document.querySelector('.local-settings-panel')),
      panelOverflow:[...document.querySelectorAll('.local-settings-panel,.local-field-columns')].filter(node=>node.clientWidth && node.scrollWidth>node.clientWidth+2).map(node=>({name:node.className,width:node.clientWidth,scroll:node.scrollWidth})),
      heading:document.querySelector('.local-page-heading h1').textContent,
      photo:!!document.querySelector('.keyboard_image img')?.naturalWidth};
  })()`);
  const capture = async name => {
    await pause(120);
    await fs.writeFile(path.join(output, name), (await mainWindow.webContents.capturePage()).toPNG());
    report.screenshots.push(name);
  };
  const waitForRead = async label => {
    await waitFor(`document.body.classList.contains('local-config') && window.thunder68Presentation.state()?.config?.keyValues?.length === 68 && !window.thunder68Presentation.state().config.mask && !document.querySelector('#root').textContent.includes('正在配置读取')`, label, 30000);
    await pause(1000);
  };
  const recordDom = async (choice, page) => {
    const tree = await evaluate(`(() => {
      const walk=(node,depth=0)=>{
        if(!node || depth>8)return null;
        const rect=node.getBoundingClientRect(),css=getComputedStyle(node);
        return {tag:node.tagName,id:node.id,cls:node.className,style:node.getAttribute('style'),
          text:node.textContent.trim().slice(0,160),rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},
          computed:{display:css.display,visibility:css.visibility,overflow:css.overflow,flexDirection:css.flexDirection,flex:css.flex,minWidth:css.minWidth},
          children:depth===8?[]:[...node.children].map(child=>walk(child,depth+1))};
      };
      return {page:document.body.dataset.localPage,panel:walk(document.querySelector('.local-settings-panel')),board:walk(document.querySelector('.local-keyboard-stage'))};
    })()`);
    const name = `redesign-${choice}-page-${page}-dom.json`;
    await fs.writeFile(path.join(output,name),JSON.stringify(tree,null,2));
    (report.domReports ||= []).push(name);
  };
  let originalTheme, originalSelection, originalSize, before;
  try {
    await waitFor('!!window.thunder68Presentation?.state()?.config && !window.thunder68Presentation.state().config.mask && !!document.querySelector("#local-theme")', 'connected UI ready', 20000);
    await waitForRead('initial configuration read complete');
    originalTheme = await evaluate("document.documentElement.dataset.themeChoice || 'system'");
    originalSelection = await selected(); originalSize = mainWindow.getSize();
    before = await snapshot(); report.before = before;
    check('device snapshot available', !!before?.deviceFields?.keyValues);

    for (const choice of ['dark', 'light', 'system']) await theme(choice);
    await systemThemeResponses();
    await navigate(2);
    const allIds = await evaluate('window.thunder68Presentation.state().common.deviceParams.layoutMappingData.map(key=>key.id)');
    check('68 official keys available', allIds.length === 68);
    await click('[data-select="WASD"]');
    check('WASD selection', JSON.stringify((await selected()).slice().sort()) === JSON.stringify(['A','D','S','W']));
    const detail = await evaluate('document.querySelector(".local-key-details").textContent');
    const expected = await evaluate(`(() => {const values=window.thunder68Presentation.state().config.keyValues.filter(key=>['W','A','S','D'].includes(key.id));return {travel:values.every(key=>key.travelValue===values[0].travelValue)?Number(values[0].travelValue).toFixed(2)+' mm':'不同', rt:values.every(key=>key.isRTEnabled===values[0].isRTEnabled)?(values[0].isRTEnabled?'开启':'关闭'):'不同'};})()`);
    check('selected current trigger values readable', detail.includes('触发行程') && detail.includes(expected.travel) && detail.includes(expected.rt) && !detail.includes('未读取'), {detail, expected});
    await click('.local-key-chips button');
    check('one selection chip removed', (await selected()).length === 3);
    await click('[data-select="字母键"]');
    check('letter batch selection', (await selected()).length === 26 && (await selected()).every(id => /^[A-Z]$/.test(id)));
    await click('[data-select="反选"]');
    check('inverse selection', (await selected()).length === allIds.length - 26 && (await selected()).every(id => !/^[A-Z]$/.test(id)));
    await click('[data-select="全选"]');
    check('all keys selected', (await selected()).length === allIds.length);
    await click('.local-clear-selection'); check('selection cleared', (await selected()).length === 0);
    await click('[data-select="WASD"]');
    await click('.local-zoom-board');
    check('keyboard expanded', await evaluate('document.body.classList.contains("local-board-expanded") && document.querySelector(".local-zoom-board").getAttribute("aria-pressed")==="true"'));
    await click('.local-zoom-board');
    check('keyboard collapsed', await evaluate('!document.body.classList.contains("local-board-expanded") && document.querySelector(".local-zoom-board").getAttribute("aria-pressed")==="false"'));

    for (const choice of ['dark','light']) {
      await theme(choice);
      for (const [width,height] of [[1400,940],[1920,1080],[1024,720]]) {
        mainWindow.setSize(width,height); await pause(450); await navigate(2);
        await click('[data-select="WASD"]');
        const layout = await geometry();
        check(`${choice} rapid ${width}x${height}: no horizontal overflow`, !layout.horizontalOverflow, layout);
        check(`${choice} rapid ${width}x${height}: official photo and readable board`, layout.photo && layout.keyboard?.width >= 650, {keyboard:layout.keyboard});
        await capture(`redesign-${choice}-rapid-${width}x${height}.png`);
      }
      for (const [width,height] of [[1400,940],[1920,1080],[1024,720]]) {
        mainWindow.setSize(width,height); await pause(450);
        for (let page=0; page<6; page++) {
          await navigate(page);
          const layout = await geometry();
          if(page===1)check(`${choice} lighting ${width}x${height}: controls fit panel`, !layout.panelOverflow.length, layout.panelOverflow);
          check(`${choice} navigation ${page} ${width}x${height}: active and no horizontal overflow`, !layout.horizontalOverflow && await evaluate(`document.querySelector('.local-nav-item[data-page="${page}"]').getAttribute('aria-current')==='page'`), layout);
          if (width===1400) await recordDom(choice,page);
          if (width===1400 && [0,1,5].includes(page)) await capture(`redesign-${choice}-page-${page}.png`);
        }
      }
    }

    await evaluate(`window.dispatchEvent(new CustomEvent('thunder68-feedback',{detail:{event:'hid-send-error',message:'simulated audit error'}}))`);
    const errorFeedback = await evaluate('({kind:document.querySelector(".local-operation").dataset.kind,text:document.querySelector(".local-operation").textContent})');
    check('simulated failure has recovery instruction', errorFeedback.kind === 'error' && errorFeedback.text.includes('USB') && errorFeedback.text.includes('重新连接'), {...errorFeedback, simulated: true});
    await capture('redesign-simulated-error.png');

    // The device-list view is real navigation. Reconnection only re-reads configuration.
    await click('.local-device-link');
    await waitFor('document.body.classList.contains("local-home")', 'device home view');
    for (const choice of ['dark','light']) {
      await theme(choice);
      for (const [width,height] of [[1400,940],[1024,720]]) {
        mainWindow.setSize(width,height); await pause(450);
        const layout = await geometry(); check(`${choice} home ${width}x${height}: no horizontal overflow`, !layout.horizontalOverflow, layout);
        await capture(`redesign-${choice}-home-${width}x${height}.png`);
      }
    }
    await theme('light');
    await new Promise((resolve,reject) => {
      const contents = mainWindow.webContents;
      const loaded = () => {clearTimeout(timer);resolve();};
      const timer = setTimeout(() => {contents.removeListener('did-finish-load',loaded);reject(new Error('Theme persistence reload timed out'));},20000);
      contents.once('did-finish-load',loaded);
      mainWindow.reload();
    });
    await waitFor(`document.body.classList.contains('local-home') && !!document.querySelector('#local-theme') && !!document.querySelector('.device-container')`, 'home page restored after reload');
    const restoredTheme = await evaluate(`({choice:document.documentElement.dataset.themeChoice,resolved:document.documentElement.dataset.theme,control:document.querySelector('#local-theme').value,stored:localStorage.getItem('thunder68.theme')})`);
    check('theme choice restored from storage after reload', ['choice','resolved','control','stored'].every(field=>restoredTheme[field]==='light'), restoredTheme);
    await click('.local-connect-button');
    await waitForRead('configuration re-read after home');
    await click('.local-verify');
    await waitForRead('configuration re-read for verification');
    const verified = await evaluate('({kind:document.querySelector(".local-operation").dataset.kind,text:document.querySelector(".local-operation").textContent})');
    check('real read-only configuration verification succeeds', verified.kind === 'success' && verified.text.includes('已重新读取') && verified.text.includes('一致'), verified);
    const after = await snapshot(); report.after = after;
    check('device configuration unchanged', JSON.stringify(before.deviceFields) === JSON.stringify(after.deviceFields));
    report.completedAt = new Date().toISOString(); report.passed = true;
  } catch (error) {
    report.passed = false; report.error = error.message;
    try {report.after = await snapshot(); await capture('redesign-failure.png');} catch {}
    throw error;
  } finally {
    try {
      if (originalTheme) await theme(originalTheme);
      if (await evaluate('document.body.classList.contains("local-config")')) await navigate(0);
      if (originalSelection) await evaluate(`window.thunder68Presentation?.selectKeys(${JSON.stringify(originalSelection)})`);
      if (originalSize) {mainWindow.setSize(...originalSize); await pause(350);}
    } catch (error) {report.cleanupError = error.message;}
    await fs.writeFile(path.join(output,'redesign-audit.json'), JSON.stringify(report,null,2));
  }
  return report;
};

/* Presentation adapter: official React nodes and HID handlers stay in place. */
(() => {
  'use strict';
  const pages = [
    ['按键定义', 'keyboard', '点击键盘上的按键，再选择要分配的功能。'],
    ['灯效设置', 'sun', '调整灯光模式、亮度与颜色。'],
    ['快速触发', 'activity', '选择按键，调整触发行程与快速触发。'],
    ['超级按键', 'layers', '为按键配置进阶功能。'],
    ['游戏配置', 'game', '查看并应用适合你的游戏配置。'],
    ['其他设置', 'settings', '管理键盘的通用设置。']
  ];
  const paths = {
    keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M10 14h8"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
    game: '<path d="M7 7h10c3 0 5 11 2 11-1 0-3-3-4-3H9c-1 0-3 3-4 3-3 0-1-11 2-11Z"/><path d="M7 10v4m-2-2h4m6-1h.01m3 2h.01"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('root');
    if (!root) return;
    const shell = document.createElement('div'); shell.id = 'local-shell';
    shell.innerHTML = `
      <header class="local-header">
        <a class="local-brand" href="#" aria-label="雷电68，返回设备列表"><span class="local-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M14 2 5 13h6l-1 9 9-12h-6l1-8Z" fill="currentColor"/></svg></span>THUNDER<span class="local-brand-number">68</span></a>
        <span class="local-header-divider"></span><span class="local-header-title">键盘控制中心</span><div class="local-theme-control"><label for="local-theme">外观</label><select id="local-theme" aria-label="外观主题"><option value="system">跟随系统</option><option value="dark">深色</option><option value="light">浅色</option></select></div><span class="local-header-edition">本地运行</span>
      </header>
      <aside class="local-rail">
        <div class="local-rail-label">设备</div>
        <button class="local-device-link">${icon('keyboard')}<span>我的设备</span></button>
        <div class="local-config-nav"><div class="local-rail-label">键盘配置</div>${pages.map(([label, glyph], i) => `<button class="local-nav-item" data-page="${i}">${icon(glyph)}<span>${label}</span></button>`).join('')}</div>
        <div class="local-rail-bottom"><span class="local-offline-dot"></span>THUNDER 68<div>磁轴键盘 · USB</div></div>
      </aside>
      <div class="local-page-heading"><div><h1>按键定义</h1><p></p></div><span class="local-status" role="status"><i></i><span>未连接</span></span></div>
      <section class="local-welcome"><article class="local-connect-card"><div class="local-card-heading"><span class="local-model">THUNDER <b>68</b></span><span class="local-usb-tag">USB 有线</span></div><div class="local-home-board" aria-label="雷电68键盘布局"></div><div class="local-connect-card-bottom"><div><h2>雷电68</h2><p>68 键布局 · 磁轴键盘</p></div><button class="local-connect-button">连接键盘 <span>→</span></button></div></article><aside class="local-connect-guide"><h2>开始配置</h2><ol><li><b>连接键盘</b><p>使用 USB 线将键盘连接到电脑。</p></li><li><b>建立连接</b><p>点击“连接键盘”，读取当前配置。</p></li><li><b>调整手感</b><p>配置按键、灯光与触发行程。</p></li></ol><div class="local-guide-note">连接失败时，先断开官网驱动中的连接，再重试。</div></aside></section>
      <section class="local-board-overlay"><div class="local-board-title"><b>THUNDER 68 <span>当前键盘</span></b><button class="local-zoom-board" aria-pressed="false">放大键盘</button></div><div class="local-live-board"></div><div class="local-selection"><div class="local-selection-summary"><span class="local-selection-label">未选择按键</span><button class="local-clear-selection">清除</button></div><div class="local-selection-shortcuts"><button data-select="WASD">WASD</button><button data-select="字母键">字母</button><button data-select="全选">全选</button><button data-select="反选">反选</button></div><button class="local-reset-keys">恢复默认…</button></div><div class="local-key-chips" aria-label="已选按键"></div><p class="local-board-instruction">点击选择按键；再次点击取消。参数调整作用于全部已选按键。</p></section>
      <section class="local-palette"><div class="local-palette-toolbar"><label class="local-search-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input type="search" placeholder="搜索按键，如 Esc、空格、F1" aria-label="搜索可分配按键"></label><span class="local-palette-count"></span></div><div class="local-palette-grid"></div><div class="local-search-empty" hidden>没有找到匹配按键，试试其他名称。</div></section>
      <footer class="local-footer"><span class="local-operation" role="status" aria-live="polite">连接键盘后读取当前配置</span><button class="local-verify" hidden>重新读取核对</button><span>本地驱动 <span class="local-footer-separator">·</span> 0.2.0</span></footer>`;
    document.body.appendChild(shell);
    const themeControl=shell.querySelector('#local-theme'), media=matchMedia('(prefers-color-scheme: dark)');
    let themeChoice='system';try{themeChoice=localStorage.getItem('thunder68.theme')||'system';}catch{}
    if(!['dark','light','system'].includes(themeChoice))themeChoice='system';
    function applyTheme(){const resolved=themeChoice==='system'?(media.matches?'dark':'light'):themeChoice;document.documentElement.dataset.theme=resolved;document.documentElement.dataset.themeChoice=themeChoice;themeControl.value=themeChoice;window.thunder68Local?.setTheme?.(resolved);}
    themeControl.addEventListener('change',()=>{themeChoice=themeControl.value;try{localStorage.setItem('thunder68.theme',themeChoice);}catch{}applyTheme();});media.addEventListener('change',applyTheme);applyTheme();
    shell.querySelector('.local-zoom-board').addEventListener('click',e=>{const expanded=document.body.classList.toggle('local-board-expanded');e.currentTarget.setAttribute('aria-pressed',String(expanded));e.currentTarget.textContent=expanded?'收起键盘':'放大键盘';window.dispatchEvent(new Event('resize'));});
    const operation=shell.querySelector('.local-operation'),verify=shell.querySelector('.local-verify');
    let connectionTimer, verificationExpected=null, verifying=false, lastConfiguration=null, ready=false, lastBusy=false, feedbackLocked=false,lastEditAt=0,observedSignature='',stableAt=0,settleTimer;
    root.addEventListener('pointerdown',e=>{if(e.target.closest('.local-settings-panel')&&!e.target.closest('.tab-navigation'))lastEditAt=Date.now();},true);
    root.addEventListener('change',e=>{if(e.target.closest('.local-settings-panel'))lastEditAt=Date.now();},true);
    const configuration=config=>JSON.stringify([config?.keyValues,config?.buttonMap,config?.lightness,config?.superkeys,config?.settings,config?.macroMap,config?.triggerMode]);
    const feedback=(text,kind='neutral')=>{operation.textContent=text;operation.dataset.kind=kind;};
    const connect=()=>{
      feedbackLocked=false;
      const container=root.querySelector('.device-container');
      const entries=[...container?.children||[]];
      const target=entries.find(e=>e.querySelector('span') && e.querySelector('span').textContent.trim()!=='新增设备')||entries.find(e=>e.querySelector('span')?.textContent.trim()==='新增设备');
      if(!target){feedback('连接入口尚未就绪，请稍后重试。','error');return;}
      feedback('正在连接并读取配置…');shell.querySelector('.local-connect-button').disabled=true;
      clearTimeout(connectionTimer);connectionTimer=setTimeout(()=>{shell.querySelector('.local-connect-button').disabled=false;feedback('读取未完成。检查 USB 连接，并关闭占用键盘的官网驱动后重试。','error');verifying=false;},30000);
      target.click();
    };
    verify.addEventListener('click',()=>{
      verificationExpected=configuration(window.thunder68Presentation.state()?.config);verifying=true;ready=false;feedbackLocked=false;
      returnToDevices();setTimeout(connect,350);
    });
    window.addEventListener('thunder68-feedback',e=>{
      if(e.detail.event.includes('error')){feedbackLocked=true;verifying=false;feedback('操作失败：请检查 USB 连接，重新连接后核对配置。','error');shell.querySelector('.local-connect-button').disabled=false;}
      else if(e.detail.event==='hid-request-result' && !e.detail.count){clearTimeout(connectionTimer);feedback('未找到或未选择键盘。连接 USB 后重试。','error');shell.querySelector('.local-connect-button').disabled=false;}
      else if(e.detail.event==='hid-output' && ready && !verifying && !feedbackLocked && Date.now()-lastEditAt<3000){feedback('设置已发送 · 重新读取可核对设备当前值');}
    });
    const keyDetails=document.createElement('div');keyDetails.className='local-key-details';keyDetails.setAttribute('role','status');
    shell.querySelector('.local-board-overlay').appendChild(keyDetails);
    const svgNamespace='http://www.w3.org/2000/svg';
    const parameterCanvas=document.createElementNS(svgNamespace,'svg');parameterCanvas.classList.add('local-parameter-labels');parameterCanvas.setAttribute('aria-hidden','true');shell.appendChild(parameterCanvas);
    let parameterSignature;
    function drawParameters() {
      const state=window.thunder68Presentation.state(),native=root.querySelector('.keyboard_image canvas');
      const hidden=currentIndex!==2 || !native;parameterCanvas.toggleAttribute('hidden',hidden);
      if(hidden)return;
      const rect=native.getBoundingClientRect();
      const style=`left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;clip-path:inset(${Math.max(0,148-rect.y)}px 0 ${Math.max(0,rect.bottom-(innerHeight-42))}px 0);`;
      if(parameterCanvas.getAttribute('style')!==style)parameterCanvas.setAttribute('style',style);
      const signature=JSON.stringify([native.width,native.height,state?.config?.keyValues,state?.config?.fastTriggerShow,state?.config?.fastTriggerRTShow]);
      if(signature===parameterSignature)return;parameterSignature=signature;
      parameterCanvas.setAttribute('viewBox',`0 0 ${state.common.deviceParams.layoutX} ${state.common.deviceParams.layoutY}`);parameterCanvas.setAttribute('preserveAspectRatio','none');parameterCanvas.replaceChildren();
      const values=new Map(state.config.keyValues.map(value=>[value.id,value]));
      const badge=(value,x,y,color,align,fontSize)=>{
        if(value===null || value===undefined || !Number.isFinite(Number(value)))return;
        const text=Number(value).toFixed(2),width=text.length*fontSize*.62,left=align==='right'?x-width:align==='center'?x-width/2:x;
        const background=document.createElementNS(svgNamespace,'rect');
        for(const [name,value] of Object.entries({x:left-3,y:y-1,width:width+6,height:fontSize+2,fill:'#fffffff0'}))background.setAttribute(name,value);
        const label=document.createElementNS(svgNamespace,'text');label.textContent=text;
        for(const [name,value] of Object.entries({x,y:y+fontSize*.83,fill:color,'text-anchor':align==='right'?'end':align==='center'?'middle':'start','font-family':'Consolas,monospace','font-size':fontSize,'font-weight':600}))label.setAttribute(name,value);
        parameterCanvas.append(background,label);
      };
      for(const key of state.common.deviceParams.layoutMappingData){
        const value=values.get(key.id);if(!value)continue;
        if(state.config.fastTriggerShow)badge(value.travelValue,key.x+key.width-5,value.isRTEnabled?key.y+4:key.y+key.height-32,'#2155b7','right',26);
        if(state.config.fastTriggerRTShow && value.isRTEnabled){
          badge(value.isIndependentSensitivity?value.triggerSensitivity:value.sensitivity,key.x+4,key.y+key.height-24,'#176339','left',20);
          badge(value.isIndependentSensitivity?value.resetSensitivity:value.sensitivity,key.x+key.width-4,key.y+key.height-24,'#95440c','right',20);
        }
      }
    }
    function updateKeyDetails(config,selection) {
      if(!selection.length){keyDetails.textContent='选择键盘上的按键，查看该键的具体参数。';return;}
      const values=selection.map(id=>config?.keyValues?.find(value=>value.id===id));
      const field=(name,format,read=value=>value?.[name])=>{
        const entries=values.map(read);
        if(entries.some(value=>value===undefined || value===null))return '未读取';
        return entries.every(value=>value===entries[0]) ? format(entries[0]) : '不同';
      };
      const mm=value=>Number.isFinite(Number(value)) ? Number(value).toFixed(2)+' mm' : '未读取';
      const fields=[['触发行程',field('travelValue',mm)],['快速触发 RT',field('isRTEnabled',value=>value?'开启':'关闭')]];
      if(values.some(value=>value?.isRTEnabled) && !values.every(value=>value?.isRTEnabled))fields.push(['RT 灵敏度','不同（部分关闭）']);
      else if(values.some(value=>value?.isRTEnabled)){
        const independent=values.some(value=>value?.isIndependentSensitivity);
        if(independent){fields.push(['按下灵敏度',field('triggerSensitivity',mm,value=>value?.isIndependentSensitivity?value.triggerSensitivity:value?.sensitivity)],['抬起灵敏度',field('resetSensitivity',mm,value=>value?.isIndependentSensitivity?value.resetSensitivity:value?.sensitivity)]);}
        else fields.push(['RT 灵敏度',field('sensitivity',mm)]);
      }
      keyDetails.replaceChildren();
      const name=document.createElement('strong');name.textContent=selection.length===1?selection[0]:`${selection.length} 个按键`;keyDetails.appendChild(name);
      for(const [label,value] of fields){const item=document.createElement('span'),caption=document.createElement('span'),number=document.createElement('b');caption.textContent=label;number.textContent=value;item.append(caption,number);keyDetails.appendChild(item);}
    }
    let tabs = [], deviceOpened = false, storeSubscribed = false, currentIndex = 0, paletteNodes = [];
    const photo=document.createElement('img');photo.src='/thunder68/imgs/mg_main.png';photo.alt='雷电68键盘';shell.querySelector('.local-home-board').appendChild(photo);
    for(const button of shell.querySelectorAll('[data-select]'))button.addEventListener('click',()=>{
      const native=[...root.querySelectorAll('.select_menu div')].find(node=>!node.children.length&&node.textContent.trim()===button.dataset.select);
      if(currentIndex===2 && native){native.parentElement.click();return;}
      const state=window.thunder68Presentation.state(),ids=state?.common.deviceParams.layoutMappingData.map(k=>k.id)||[],selected=state?.config.mapPendingKey||[];
      const value=button.dataset.select;
      window.thunder68Presentation.selectKeys(value==='全选'?ids:value==='反选'?ids.filter(id=>!selected.includes(id)):value==='字母键'?ids.filter(id=>/^[A-Z]$/.test(id)):ids.filter(id=>['W','A','S','D'].includes(id)));
    });
    shell.querySelector('.local-clear-selection').addEventListener('click',()=>{
      const canvas=root.querySelector('.keyboard_image canvas'),rect=canvas?.getBoundingClientRect();
      if(rect)canvas.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:rect.x+rect.width*.5,clientY:rect.y+rect.height*.06}));
      window.thunder68Presentation.selectKeys([]);synchronize();
    });
    shell.querySelector('.local-reset-keys').addEventListener('click',()=>root.querySelector('.select_menu button')?.click());
    shell.querySelector('.local-connect-button').addEventListener('click',connect);
    const palette = shell.querySelector('.local-palette'), search=palette.querySelector('input');
    function filterPalette() {
      const query=search.value.trim().toLowerCase();let count=0;
      for(const button of palette.querySelectorAll('.local-function-key')){const match=!query || button.dataset.search.includes(query);button.hidden=!match;if(match)count++;}
      for(const group of palette.querySelectorAll('.local-function-group'))group.hidden=![...group.querySelectorAll('button')].some(button=>!button.hidden);
      palette.querySelector('.local-palette-count').textContent=`${count} 个按键`;
      palette.querySelector('.local-search-empty').hidden=count>0;
    }
    search.addEventListener('input',filterPalette);
    function positionOverlay(element,rect,insets) {
      if(!rect?.width)return;
      const [left,top,right,bottom]=insets;
      const style=`left:${rect.x+left}px;top:${rect.y+top}px;width:${rect.width-left-right}px;height:${rect.height-top-bottom}px;`;
      if(element.getAttribute('style')!==style)element.setAttribute('style',style);
    }
    function updateOverlays(){
      const stage=root.querySelector('.local-keyboard-stage');
      if(stage)positionOverlay(shell.querySelector('.local-board-overlay'),stage.getBoundingClientRect(),[20,18,20,18]);
      const panel=root.querySelector('.local-settings-panel');
      if(panel){const rect=panel.getBoundingClientRect(),nav=panel.querySelector('.tab-navigation')?.getBoundingClientRect();positionOverlay(palette,rect,[20,nav?nav.bottom-rect.y+18:110,20,20]);}
      drawParameters();
    }
    window.addEventListener('resize',updateOverlays);
    // The captured renderer clears its canvas during resize. Notify it once the
    // image settles so its existing selection and parameter drawing is restored.
    let resizeRefresh;
    window.addEventListener('resize',()=>{
      clearTimeout(resizeRefresh);
      resizeRefresh=setTimeout(()=>{
        const config=window.thunder68Presentation.state()?.config;
        if(root.querySelector('.keyboard_image') && config && !config.mask)window.thunder68Presentation.selectKeys([...config.mapPendingKey]);
      },140);
    });
    root.addEventListener('scroll',updateOverlays,true);
    const refreshDevice = async () => {
      try {deviceOpened = (await navigator.hid.getDevices()).some(d => d.opened && d.vendorId === 0x369b); synchronize();} catch {}
    };
    window.addEventListener('thunder68-device-open', refreshDevice);
    function returnToDevices() {
      const label = [...root.querySelectorAll('span')].find(e => e.textContent.trim() === '返回设备列表');
      if (label) label.parentElement.click();
    }
    shell.querySelector('.local-brand').addEventListener('click', e => {e.preventDefault(); returnToDevices();});
    shell.querySelector('.local-device-link').addEventListener('click', returnToDevices);
    for (const button of shell.querySelectorAll('[data-page]')) button.addEventListener('click', () => {
      const tab = tabs[Number(button.dataset.page)];
      if (tab) {tab.click(); synchronize();}
    });
    const paper = new Set(['white', '#fff', '#ffffff', 'rgb(255, 255, 255)', 'rgb(242, 244, 245)', 'rgb(254, 254, 254)', 'rgb(238, 238, 238)']);
    const muted = new Set(['rgb(217, 217, 217)', 'rgb(196, 196, 196)', 'rgb(221, 221, 221)', 'rgb(204, 204, 204)', 'rgb(153, 153, 153)', 'rgb(243, 243, 243)']);
    const accent = new Set(['rgb(234, 84, 19)', '#ea5413', 'rgb(255, 222, 173)']);
    const ink = new Set(['black', '#000', 'rgb(0, 0, 0)', 'rgb(51, 51, 51)', 'rgb(34, 34, 34)', 'rgb(82, 82, 82)', 'rgb(31, 31, 31)']);
    const mark = (node, key, value) => {if (node.dataset[key] !== value) node.dataset[key] = value;};
    const classify = node => {
      if (node.closest('.colorplate,.color-slider,.color_board')) return;
      if(!node.children.length && node.tagName==='SPAN'){
        const descriptions={'按键在按压到固定位置后触发，回弹到固定位置后释放。触发行程越低，物理响应越快，但更容易误触触发按键所需要的按下的距离':'按下多深才触发。数值越小，触发越快，也更容易误触。','通过动态地触发和重置按键，实现更快的按键操作。当您意图按下或释放按键时，快速触发会立即触发按键的动作，并在达到触发点后自动重置按键。这样可以减少按键的延迟和提高响应速度。':'根据按键的移动距离触发与复位，不必回到固定位置。适合需要连续快速按键的操作。','灵敏度决定了按键抬起（重置）和再次按下按键（触发）所需的键程':'再次按下或抬起多少距离才响应。数值越小越灵敏。','独立的上收/下击灵敏度':'分别设置按下与抬起','如果启用，您可以单独定义快速触发的按下（触发）和抬起（重置）的灵敏度。':'开启后，可分别调整按下触发和抬起复位的距离。'};
        const replacement=descriptions[node.textContent];if(replacement){node.textContent=replacement;mark(node,'localDescription','true');}
      }
      if (!node.children.length && ['DIV','SPAN','P'].includes(node.tagName) && node.textContent.trim().length > 45) mark(node,'localDescription','true');
      const bg = node.style.backgroundColor.toLowerCase(), fg = node.style.color.toLowerCase();
      const rgb = bg.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)?.slice(1).map(Number);
      const neutralPaper = rgb && Math.min(...rgb) >= 170 && Math.max(...rgb) - Math.min(...rgb) <= 12;
      mark(node, 'localSurface', accent.has(bg) ? 'selected' : paper.has(bg) || neutralPaper ? 'paper' : muted.has(bg) ? 'muted' : '');
      mark(node, 'localInk', accent.has(fg) ? 'accent' : ink.has(fg) ? 'text' : '');
      const borderRgb = node.style.borderColor.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/)?.slice(1).map(Number);
      const neutralBorder = borderRgb && Math.min(...borderRgb) >= 170 && Math.max(...borderRgb) - Math.min(...borderRgb) <= 12;
      mark(node, 'localBorder', /234, 84, 19|#ea5413/i.test(node.style.borderColor) ? 'accent' : muted.has(node.style.borderColor) || neutralBorder ? 'muted' : '');
      const gradient = node.style.backgroundImage;
      if (/234,\s*84,\s*19|#ea5413/i.test(gradient)) {
        const localGradient = gradient.replace(/rgb\(234,\s*84,\s*19\)|#ea5413/ig, 'var(--ui-accent)').replace(/\bgray\b/ig, 'var(--ui-line)');
        if (node.style.getPropertyValue('--local-gradient') !== localGradient) node.style.setProperty('--local-gradient', localGradient);
        mark(node, 'localGradient', 'true');
      } else mark(node, 'localGradient', '');
      if (node.tagName === 'IMG' && /(?:check-mark|_orange|macro_tips|trigger_tips)/i.test(node.getAttribute('src') || '')) mark(node, 'localIcon', 'mono');
      if (node.style.fontSize === '0.6rem' && node.style.border && node.querySelector('span') && !node.closest('.keyboard_image,.sidebar')) mark(node, 'localControl', 'key');
      if (node.tagName === 'INPUT' && node.type === 'range') {
        const percent = (Number(node.value) - Number(node.min || 0)) / (Number(node.max || 100) - Number(node.min || 0)) * 100;
        const progress = Math.max(0, Math.min(100, percent)) + '%';
        if (node.style.getPropertyValue('--local-range-progress') !== progress) node.style.setProperty('--local-range-progress', progress);
      }
      if (['立即重置', 'Reset Now'].includes(node.textContent.trim()) && (node.tagName === 'BUTTON' || node.children.length === 1)) mark(node, 'localDanger', 'true');
      if (node.style.cursor === 'pointer' && node.tagName === 'DIV' && !node.closest('.keyboard_image') && !node.hasAttribute('tabindex')) {node.tabIndex = 0; node.setAttribute('role', 'button');}
    };
    root.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('div[role="button"][tabindex="0"]')) {e.preventDefault(); e.target.click();}
    });
    function synchronize() {
      const main = root.querySelector('.main-content'), connectedPage = !!main;
      document.body.classList.toggle('local-config', connectedPage);
      document.body.classList.toggle('local-home', !connectedPage);
      for (const node of root.querySelectorAll('[style]')) classify(node);
      shell.querySelector('.local-device-link').classList.toggle('is-active', !connectedPage);
      if (main) {
        const state=window.thunder68Presentation.state();
        if(!storeSubscribed && state){storeSubscribed=true;window.thunder68Presentation.subscribe(()=>requestAnimationFrame(synchronize));}
        const tabbar = main.querySelector('.local-original-tabs') || [...main.querySelectorAll('span')].find(e => e.textContent.trim() === '按键定义')?.parentElement.parentElement;
        tabs = tabbar ? [...tabbar.children].slice(0,6) : [];
        if (tabbar && !tabbar.classList.contains('local-original-tabs')) tabbar.classList.add('local-original-tabs');
        const selected = tabs.findIndex(t => t?.dataset.localSurface === 'selected'), index = selected < 0 ? 0 : selected;
        currentIndex=index;
        for(const button of shell.querySelectorAll('.local-nav-item'))button.disabled=!!state?.config?.mask;
        document.body.dataset.localPage=String(index);
        document.body.classList.toggle('local-bridge-unavailable',!state);
        const interactive=[0,2,3].includes(index);
        shell.querySelector('.local-board-instruction').textContent=interactive ? '点击选择按键；再次点击取消。参数调整作用于全部已选按键。' : '预览当前键盘。右侧调整整机设置。';
        shell.querySelector('.local-selection').classList.toggle('is-preview',!interactive);
        shell.querySelector('.local-reset-keys').hidden=![0,3].includes(index);
        for (const btn of shell.querySelectorAll('[data-page]')) {const active = Number(btn.dataset.page) === index; btn.classList.toggle('is-active', active); btn.setAttribute('aria-current', active ? 'page' : 'false');}
        shell.querySelector('.local-page-heading h1').textContent = pages[index][0];
        shell.querySelector('.local-page-heading p').textContent = pages[index][2];
        const keyboard = main.querySelector('.keyboard_image');
        if (keyboard && !keyboard.parentElement.parentElement.classList.contains('local-keyboard-stage')) keyboard.parentElement.parentElement.classList.add('local-keyboard-stage');
        if(keyboard){keyboard.parentElement.classList.add('local-board-center');keyboard.nextElementSibling?.classList.add('local-board-modes');}
        if (tabbar?.nextElementSibling && !tabbar.nextElementSibling.classList.contains('local-settings-panel')) tabbar.nextElementSibling.classList.add('local-settings-panel');
        for(const part of main.querySelectorAll('.leftpart'))part.parentElement.classList.add('local-field-columns');
        if(index===1){const lightTab=[...main.querySelectorAll('button')].find(e=>e.textContent.trim()==='主键灯');if(lightTab){lightTab.parentElement.classList.add('local-light-tabs');if(lightTab.parentElement.parentElement!==main.querySelector('.local-settings-panel'))lightTab.parentElement.parentElement.classList.add('local-light-layout');}}
        const selection=state?.config?.mapPendingKey || [];
        const panel=main.querySelector('.local-settings-panel');
        if(panel){panel.dataset.selectionContext=interactive?(selection.length?`编辑 ${selection.length} 个按键 · 调整后直接发送`:'先在键盘上选择要修改的按键'):'调整键盘的全局设置';}
        for(const fields of main.querySelectorAll('.local-field-columns'))fields.inert=(index===2 && !selection.length)||!!state?.config?.mask||!deviceOpened;
        document.body.classList.toggle('local-disconnected',!deviceOpened);
        const chips=shell.querySelector('.local-key-chips');
        if(chips.dataset.value!==selection.join('|')){chips.dataset.value=selection.join('|');chips.replaceChildren();for(const id of selection){const chip=document.createElement('button');chip.textContent=id;chip.title=`取消选择 ${id}`;chip.setAttribute('aria-label',`取消选择 ${id}`);chip.addEventListener('click',()=>{const ids=window.thunder68Presentation.state()?.config?.mapPendingKey||[];window.thunder68Presentation.selectKeys(ids.filter(key=>key!==id));});chips.appendChild(chip);}}
        document.body.classList.toggle('local-has-selection',selection.length>0);
        document.body.classList.toggle('local-busy',!!state?.config?.mask);
        const signature=configuration(state?.config),busy=!!state?.config?.mask;
        if(signature!==observedSignature){observedSignature=signature;stableAt=Date.now();clearTimeout(settleTimer);settleTimer=setTimeout(synchronize,750);}
        const loaded=state?.config?.keyValues?.length===68&&!root.textContent.includes('正在配置读取')&&Date.now()-stableAt>=700;
        if(deviceOpened && !busy && loaded){
          clearTimeout(connectionTimer);shell.querySelector('.local-connect-button').disabled=false;
          if(!ready){ready=true;if(verifying){feedback(signature===verificationExpected?'已重新读取 · 配置与界面一致':'已重新读取 · 设备返回值与刚才不同，请检查当前参数',signature===verificationExpected?'success':'error');verifying=false;feedbackLocked=true;}else if(!feedbackLocked)feedback('已读取键盘当前配置 · 修改后可重新读取核对','success');}
          else if(lastConfiguration && signature!==lastConfiguration && !verifying && Date.now()-lastEditAt<3000){feedbackLocked=false;feedback('当前设置已更新 · 设备结果待重新读取核对');}
          else if(lastBusy && !feedbackLocked)feedback(Date.now()-lastEditAt<3000?'操作已完成 · 重新读取可核对当前值':'当前配置已就绪','success');
          lastConfiguration=signature;
        }else if(busy && !lastBusy){feedback('正在处理，请等待…');}if(!busy && loaded)lastBusy=false;else if(busy)lastBusy=true;
        verify.hidden=!deviceOpened;verify.disabled=busy||verifying||!loaded;
        updateKeyDetails(state?.config,selection);
        for(const button of palette.querySelectorAll('.local-function-key'))button.disabled=!selection.length || !!state?.config?.mask;
        shell.querySelector('.local-selection-label').textContent=selection.length ? `已选择 ${selection.slice(0,3).join('、')}${selection.length>3 ? ` 等 ${selection.length} 键` : ''}` : '未选择按键';
        shell.querySelector('.local-selection-label').title=selection.join('、');
        for(const button of shell.querySelectorAll('[data-select]'))button.disabled=!!state?.config?.triggerMode?.triggerIndex || busy || !deviceOpened;
        shell.querySelector('.local-clear-selection').disabled=!selection.length;
        const nativePalette=[...root.querySelectorAll('[data-local-control=key]')].filter(node=>node.textContent.trim());
        document.body.classList.toggle('local-custom-palette',index===0 && nativePalette.length>30);
        if(nativePalette.length>30 && (nativePalette.length!==paletteNodes.length || nativePalette[0]!==paletteNodes[0])){
          paletteNodes=nativePalette;
          const grid=palette.querySelector('.local-palette-grid');grid.replaceChildren();
          const groups=['字母与数字','功能与修饰键','符号与小键盘'].map(label=>{const section=document.createElement('section');section.className='local-function-group';const heading=document.createElement('h3');heading.textContent=label;const keys=document.createElement('div');section.append(heading,keys);grid.appendChild(section);return keys;});
          const shortNames={PrintScreen:'PrtSc',ScrollLock:'ScrLk',PauseBreak:'Pause',NumLock:'Num',Backspace:'Bksp',Insert:'Ins',Delete:'Del',CapsLock:'Caps'};
          const seenNames=new Map();
          for(const native of nativePalette){
            const name=native.textContent.replace(/\s+/g,' ').trim(),flat=name.replace(/\s/g,'');
            const button=document.createElement('button');button.type='button';button.className='local-function-key';button.textContent=shortNames[flat]||name;
            if(/^[^\w]?\d$/.test(flat))button.textContent=flat.slice(-1);
            button.dataset.search=(name+' '+(name==='Space'?'空格':name==='Enter'?'回车':name==='Backspace'?'退格':name==='Ctrl'?'控制':name==='Shift'?'换挡':'')).toLowerCase();button.title=`分配为 ${name}`;button.addEventListener('click',()=>native.click());
            const repeat=seenNames.get(flat)||0;seenNames.set(flat,repeat+1);
            if(repeat && /^[0-9]$/.test(flat))button.textContent=`Num ${flat}`;
            else if(repeat && /^(Ctrl|Alt|Shift|Win)$/.test(flat)){button.textContent=`${flat} R`;button.title=`分配为右 ${flat}`;}
            const group=repeat && /^[0-9]$/.test(flat)?2:/^[A-Z]$/.test(flat)||/^[^\w]?\d$/.test(flat)?0:/^(F\d+|Esc|Ctrl|Alt|Shift|Win|Space|Tab|CapsLock|Backspace|Enter|Insert|Home|End|PgUp|PgDn|Delete|PrintScreen|ScrollLock|PauseBreak|Fn)$/.test(flat)?1:2;
            groups[group].appendChild(button);
          }
          filterPalette();
          for(const button of palette.querySelectorAll('.local-function-key'))button.disabled=!selection.length || !!state?.config?.mask;
        }
        updateOverlays();
      } else {
        ready=false;lastConfiguration=null;verify.hidden=true;
        parameterCanvas.setAttribute('hidden','');
        document.body.classList.remove('local-custom-palette');
        shell.querySelector('.local-page-heading h1').textContent='我的设备';
        shell.querySelector('.local-page-heading p').textContent='连接键盘，读取并调整你的配置。';
        tabs = [];
        const container = root.querySelector('.device-container');
        if (container) for (const child of container.children) {
          const label = child.querySelector('span');
          const cls = label ? (label.textContent.trim() === '新增设备' ? 'local-add-device' : 'local-saved-device') : 'local-connection-hint';
          if (!child.classList.contains(cls)) child.classList.add(cls);
          if (label) child.setAttribute('aria-label', '连接 ' + label.textContent.trim());
        }
      }
      const reading = root.textContent.includes('正在配置读取'), status = shell.querySelector('.local-status');
      status.classList.toggle('is-connected', connectedPage && deviceOpened && !reading);
      status.querySelector('span').textContent = connectedPage ? (reading ? '正在读取配置' : deviceOpened ? 'USB 已连接' : 'USB 已断开') : '等待连接';
    }
    let pending = false;
    new MutationObserver(() => {if (pending) return; pending = true; requestAnimationFrame(() => {pending = false; synchronize();});}).observe(root, {childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class']});
    navigator.hid?.addEventListener('disconnect', refreshDevice);
    navigator.hid?.addEventListener('disconnect',()=>{ready=false;feedbackLocked=true;feedback('键盘已断开。重新插入 USB，然后返回“我的设备”连接。','error');});
    if (navigator.hid) refreshDevice();
    synchronize();
  });
})();

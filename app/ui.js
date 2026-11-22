/* Presentation adapter: official React nodes and HID handlers stay in place. */
(() => {
  'use strict';
  const helpers = window.thunder68Helpers;
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
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
    diag: '<path d="M4 12h4l2-5 4 10 2-5h4"/><circle cx="12" cy="12" r="9"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;

  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('root');
    if (!root || !helpers) return;

    const appVersion = window.thunder68Local?.version || '';
    const versionSuffix = appVersion ? ` <span class="local-footer-separator">·</span> ${appVersion}` : '';

    const shell = document.createElement('div');
    shell.id = 'local-shell';
    shell.innerHTML = `
      <header class="local-header">
        <a class="local-brand" href="#" aria-label="雷电68，返回设备列表"><span class="local-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M14 2 5 13h6l-1 9 9-12h-6l1-8Z" fill="currentColor"/></svg></span>THUNDER<span class="local-brand-number">68</span></a>
        <span class="local-header-divider"></span><span class="local-header-title">键盘控制中心</span>
        <div class="local-theme-control"><button type="button" class="local-diag-trigger" aria-haspopup="dialog" aria-expanded="false">${icon('diag')}<span>连接诊断</span></button><label for="local-theme">外观</label><select id="local-theme" aria-label="外观主题"><option value="system">跟随系统</option><option value="dark">深色</option><option value="light">浅色</option></select></div><span class="local-header-edition">本地运行</span>
      </header>
      <aside class="local-rail">
        <div class="local-rail-label">设备</div>
        <button type="button" class="local-device-link">${icon('keyboard')}<span>我的设备</span></button>
        <div class="local-config-nav"><div class="local-rail-label">键盘配置</div>${pages.map(([label, glyph], i) => `<button type="button" class="local-nav-item" data-page="${i}">${icon(glyph)}<span>${label}</span></button>`).join('')}</div>
        <div class="local-companion-nav" hidden><div class="local-rail-label">伴侣工具</div><div class="local-companion-nav-list"></div></div>
        <div class="local-rail-bottom"><span class="local-offline-dot"></span>THUNDER 68<div class="local-rail-meta"><span class="local-rail-mode">磁轴键盘 · USB / 2.4G</span><span class="local-rail-version" hidden></span></div></div>
      </aside>
      <div class="local-page-heading"><div><h1>按键定义</h1><p></p></div><div class="local-heading-right"><span class="local-status" role="status"><i></i><span>未连接</span></span></div></div>
      <div class="local-hotplug-banner" role="status" aria-live="polite" hidden><span class="local-hotplug-text"></span><div class="local-hotplug-actions"><button type="button" class="local-hotplug-reconnect">一键重连</button><button type="button" class="local-hotplug-dismiss">忽略</button></div></div>
      <section class="local-welcome">
        <div class="local-welcome-main">
          <article class="local-connect-card"><div class="local-card-heading"><span class="local-model">THUNDER <b>68</b></span><span class="local-usb-tag">USB / 2.4G</span></div><div class="local-home-board" aria-label="雷电68键盘布局"></div><div class="local-connect-card-bottom"><div><h2>雷电68</h2><p>68 键布局 · 磁轴键盘</p></div><button type="button" class="local-connect-button">连接键盘 <span>→</span></button></div></article>
          <section class="local-troubleshoot-card" role="alert" hidden></section>
          <details class="local-narrow-guide"><summary>连接指南与排障提示</summary><ol><li><b>连接键盘</b>：通过 USB 数据线或 2.4G 接收器接入电脑（蓝牙模式不支持 WebHID）。</li><li><b>建立连接</b>：点击“连接键盘”读取配置；2.4G 模式将弹出配对提示。</li><li><b>排障</b>：若无法打开设备，请关闭占用键盘的官网网页驱动或其他外设软件后重试。</li></ol></details>
        </div>
        <aside class="local-connect-guide"><h2>开始配置</h2><ol><li><b>连接键盘</b><p>通过 USB 线或 2.4G 接收器连接到电脑。</p></li><li><b>建立连接</b><p>点击“连接键盘”，读取当前配置（2.4G 模式将弹出配对/进入提示）。</p></li><li><b>调整手感</b><p>配置按键、灯光与触发行程。</p></li></ol><div class="local-guide-note">连接失败时，请先确认未处于蓝牙模式，并关闭占用键盘的官网网页驱动，再重试或打开右上角「连接诊断」。</div></aside>
      </section>
      <section class="local-companion-stage" hidden></section>
      <section class="local-board-overlay"><div class="local-board-title"><b>THUNDER 68 <span>当前键盘</span></b><button type="button" class="local-zoom-board" aria-pressed="false">放大键盘</button></div><div class="local-selection"><div class="local-selection-summary"><span class="local-selection-label">未选择按键</span><button type="button" class="local-clear-selection">清除</button></div><div class="local-selection-shortcuts"><button type="button" data-select="WASD">WASD</button><button type="button" data-select="字母键">字母</button><button type="button" data-select="全选">全选</button><button type="button" data-select="反选">反选</button></div><button type="button" class="local-reset-keys">恢复默认…</button></div><div class="local-key-chips" aria-label="已选按键"></div><p class="local-board-instruction">点击选择按键；再次点击取消。参数调整作用于全部已选按键。</p></section>
      <section class="local-palette"><div class="local-palette-toolbar"><label class="local-search-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg><input type="search" placeholder="搜索按键，如 Esc、空格、Num 1、F1" aria-label="搜索可分配按键"></label><span class="local-palette-count"></span></div><div class="local-palette-grid"></div><div class="local-search-empty" hidden>没有找到匹配按键，试试其他名称。</div></section>
      <div class="local-diag-backdrop" hidden></div>
      <aside class="local-diag-drawer" role="dialog" aria-modal="true" aria-label="连接诊断中心" hidden>
        <div class="local-diag-head"><div><h2>连接诊断中心</h2><p>只读查看枚举接口、HID 收发计数与脱敏日志</p></div><button type="button" class="local-diag-close" aria-label="关闭诊断中心">✕</button></div>
        <div class="local-diag-body">
          <section class="local-diag-section"><h3>最近设备枚举</h3><div class="local-diag-discovery"></div></section>
          <section class="local-diag-section"><h3>已授权 WebHID 接口</h3><div class="local-diag-devices"></div></section>
          <section class="local-diag-section"><h3>本次会话 HID 计数</h3><div class="local-diag-counters"></div></section>
          <section class="local-diag-section"><h3>近期脱敏诊断日志</h3><p class="local-diag-privacy">隐私守则：仅记录设备接口枚举、报告字节长度与错误类别，绝不记录任何按键输入文本、设备序列号或个人路径。</p><pre class="local-diag-logs"></pre></section>
        </div>
        <div class="local-diag-foot"><button type="button" class="local-diag-refresh">刷新状态</button><button type="button" class="local-diag-copy">一键复制脱敏诊断日志</button></div>
      </aside>
      <footer class="local-footer"><span class="local-operation" role="status" aria-live="polite">连接键盘后读取当前配置</span><div class="local-footer-actions"><button type="button" class="local-import-config" hidden>导入配置</button><button type="button" class="local-verify" hidden>重新读取核对</button></div><span>本地驱动${versionSuffix}</span></footer>`;
    document.body.appendChild(shell);

    const themeControl = shell.querySelector('#local-theme');
    const media = matchMedia('(prefers-color-scheme: dark)');
    let themeChoice = document.documentElement.dataset.themeChoice || 'system';
    if (!['dark', 'light', 'system'].includes(themeChoice)) {
      themeChoice = 'system';
      try { themeChoice = localStorage.getItem('thunder68.theme') || 'system'; } catch {}
    }
    if (!['dark', 'light', 'system'].includes(themeChoice)) themeChoice = 'system';

    let parameterSignature;
    let uiInitialized = false;

    function applyTheme(notifyHost = true) {
      const resolved = themeChoice === 'system' ? (media.matches ? 'dark' : 'light') : themeChoice;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.themeChoice = themeChoice;
      themeControl.value = themeChoice;
      if (notifyHost) {
        window.thunder68Local?.setTheme?.(resolved, themeChoice);
      }
      parameterSignature = '';
      if (uiInitialized) drawParameters();
      window.dispatchEvent(new CustomEvent('thunder68-theme-change', {detail: {themeChoice, resolved}}));
    }
    function setThemeChoice(nextChoice, persist = true) {
      if (!['dark', 'light', 'system'].includes(nextChoice)) return;
      themeChoice = nextChoice;
      if (persist) {
        try { localStorage.setItem('thunder68.theme', themeChoice); } catch {}
      }
      applyTheme(persist);
    }
    themeControl.addEventListener('change', () => setThemeChoice(themeControl.value, true));
    media.addEventListener('change', () => applyTheme(true));
    applyTheme(true);

    shell.querySelector('.local-zoom-board').addEventListener('click', e => {
      const expanded = document.body.classList.toggle('local-board-expanded');
      e.currentTarget.setAttribute('aria-pressed', String(expanded));
      e.currentTarget.textContent = expanded ? '收起键盘' : '放大键盘';
      window.dispatchEvent(new Event('resize'));
    });

    const operation = shell.querySelector('.local-operation');
    const verify = shell.querySelector('.local-verify');
    const importBtn = shell.querySelector('.local-import-config');
    const connectButton = shell.querySelector('.local-connect-button');
    const troubleshootCard = shell.querySelector('.local-troubleshoot-card');
    const hotplugBanner = shell.querySelector('.local-hotplug-banner');
    const hotplugText = shell.querySelector('.local-hotplug-text');
    const hotplugReconnect = shell.querySelector('.local-hotplug-reconnect');
    const hotplugDismiss = shell.querySelector('.local-hotplug-dismiss');
    const diagTrigger = shell.querySelector('.local-diag-trigger');
    const diagBackdrop = shell.querySelector('.local-diag-backdrop');
    const diagDrawer = shell.querySelector('.local-diag-drawer');
    const diagClose = shell.querySelector('.local-diag-close');
    const diagRefresh = shell.querySelector('.local-diag-refresh');
    const diagCopy = shell.querySelector('.local-diag-copy');
    const companionNav = shell.querySelector('.local-companion-nav');
    const companionNavList = shell.querySelector('.local-companion-nav-list');
    const companionStage = shell.querySelector('.local-companion-stage');

    const SETTLE_MS = 350;
    const SETTLE_TIMER_MS = 380;
    const verifyMachine = helpers.createVerifyStateMachine({settleMs: SETTLE_MS});
    let connectionTimer;
    let verifyWaitTimer;
    let lastConfiguration = null;
    let ready = false;
    let lastBusy = false;
    let feedbackLocked = false;
    let lastEditAt = 0;
    let observedSignature = '';
    let stableAt = 0;
    let settleTimer;
    let lastDiscovery = null;
    let lastDiagReportText = '';
    let latestDeviceInfo = {productId: null, isWireless: false, isWired: false, modeLabel: 'USB / 2.4G', battery: null, officialVersion: ''};
    let domDirty = true;
    let isClassifying = false;
    let wasConnectedPage = false;
    let wasBusy = false;
    let readStartFrames = 0;
    let lastReportedStatusKey = '';
    let lastShellSyncKey = '';
    let lastReadProgressText = '';
    let silentAutoConnect = false;
    let mutationObserver = null;

    const companionTools = new Map();
    let activeToolId = null;

    window.thunder68Local?.onHidDiscovery?.(summary => {
      lastDiscovery = summary;
      if (summary && summary.reason === 'bluetooth-unsupported' && !deviceOpened && !silentAutoConnect) {
        const info = helpers.classifyConnectionError({discoveryReason: summary.reason});
        renderTroubleshoot(info);
      }
      if (!diagDrawer.hidden) refreshDiagnostics();
    });

    function clearTroubleshoot() {
      troubleshootCard.hidden = true;
      troubleshootCard.replaceChildren();
    }

    function renderTroubleshoot(info) {
      if (!info) {
        clearTroubleshoot();
        return;
      }
      troubleshootCard.hidden = false;
      troubleshootCard.dataset.code = info.code;
      troubleshootCard.dataset.severity = info.severity || 'error';
      troubleshootCard.replaceChildren();

      const header = document.createElement('div');
      header.className = 'local-troubleshoot-head';
      const titleWrap = document.createElement('div');
      const badge = document.createElement('span');
      badge.className = 'local-troubleshoot-badge';
      badge.textContent = info.errorName || info.code;
      const title = document.createElement('strong');
      title.textContent = info.title;
      titleWrap.append(badge, title);

      const dismissBtn = document.createElement('button');
      dismissBtn.type = 'button';
      dismissBtn.className = 'local-troubleshoot-close';
      dismissBtn.setAttribute('aria-label', '关闭排障提示');
      dismissBtn.textContent = '✕';
      dismissBtn.addEventListener('click', clearTroubleshoot);
      header.append(titleWrap, dismissBtn);

      const summary = document.createElement('p');
      summary.className = 'local-troubleshoot-summary';
      summary.textContent = info.summary;

      const list = document.createElement('ol');
      list.className = 'local-troubleshoot-steps';
      for (const step of info.steps || []) {
        const li = document.createElement('li');
        li.textContent = step;
        list.appendChild(li);
      }

      const actions = document.createElement('div');
      actions.className = 'local-troubleshoot-actions';
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = 'local-btn-primary';
      retryBtn.textContent = '重新尝试连接';
      retryBtn.addEventListener('click', () => connect());
      const diagBtn = document.createElement('button');
      diagBtn.type = 'button';
      diagBtn.className = 'local-btn-secondary';
      diagBtn.textContent = '打开连接诊断中心';
      diagBtn.addEventListener('click', () => openDiagnostics());
      actions.append(retryBtn, diagBtn);

      troubleshootCard.append(header, summary, list, actions);
    }

    function showHotplugBanner(device) {
      if (deviceOpened) return;
      const kind = device?.productId === 0x0434 ? '2.4G 接收器' : device?.productId === 0x0211 ? 'USB 有线' : 'HID 接口';
      hotplugText.textContent = `检测到雷电68（${kind}）已接入，点击可立即连接并读取配置。`;
      hotplugBanner.hidden = false;
    }

    function hideHotplugBanner() {
      hotplugBanner.hidden = true;
    }

    hotplugDismiss.addEventListener('click', hideHotplugBanner);
    hotplugReconnect.addEventListener('click', () => {
      hideHotplugBanner();
      exitTool();
      if (root.querySelector('.main-content') && !deviceOpened) {
        returnToDevices();
        setTimeout(() => connect(), 280);
      } else {
        connect();
      }
    });

    async function refreshDiagnostics() {
      const discoveryEl = diagDrawer.querySelector('.local-diag-discovery');
      const devicesEl = diagDrawer.querySelector('.local-diag-devices');
      const countersEl = diagDrawer.querySelector('.local-diag-counters');
      const logsEl = diagDrawer.querySelector('.local-diag-logs');

      let mainData = null;
      try {
        mainData = await window.thunder68Local?.readDiagnostics?.();
      } catch {}

      const effectiveDiscovery = mainData?.lastDiscovery || lastDiscovery;
      if (effectiveDiscovery) {
        const reasonLabels = {
          ready: '已发现可用配置接口',
          'bluetooth-unsupported': '发现非配置接口（疑似蓝牙模式）',
          'no-device': '未枚举到雷电68 配置接口'
        };
        discoveryEl.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'local-diag-kv-grid';
        for (const [k, v] of [
          ['状态判定', reasonLabels[effectiveDiscovery.reason] || effectiveDiscovery.reason],
          ['系统 HID 总数', String(effectiveDiscovery.totalDevices ?? 0)],
          ['可用配置接口', String(effectiveDiscovery.configCandidatesCount ?? 0)],
          ['疑似蓝牙/非配置', String(effectiveDiscovery.suspectedBluetoothCount ?? effectiveDiscovery.sameVendorNonConfigCount ?? 0)]
        ]) {
          const item = document.createElement('div');
          item.className = 'local-diag-kv';
          const label = document.createElement('span');
          label.textContent = k;
          const val = document.createElement('strong');
          val.textContent = v;
          item.append(label, val);
          grid.appendChild(item);
        }
        discoveryEl.appendChild(grid);
      } else {
        discoveryEl.textContent = '本次会话尚未触发设备枚举（点击「连接键盘」后更新）。';
      }

      let hidDevices = [];
      try {
        hidDevices = navigator.hid ? await navigator.hid.getDevices() : [];
      } catch {}

      devicesEl.replaceChildren();
      if (!hidDevices.length) {
        const empty = document.createElement('p');
        empty.className = 'local-diag-empty';
        empty.textContent = '当前暂无已授权的 WebHID 设备接口。';
        devicesEl.appendChild(empty);
      } else {
        for (const d of hidDevices) {
          const card = document.createElement('div');
          card.className = 'local-diag-device-row';
          const hex = n => typeof n === 'number' ? '0x' + n.toString(16).padStart(4, '0').toUpperCase() : '--';
          const cols = (d.collections || []).map(c => `0x${(c.usagePage || 0).toString(16)}/0x${(c.usage || 0).toString(16)}`).join(', ') || '无';
          const head = document.createElement('div');
          head.className = 'local-diag-device-title';
          const title = document.createElement('strong');
          title.textContent = `${d.productName || 'HID Device'} (${hex(d.vendorId)}:${hex(d.productId)})`;
          const pill = document.createElement('span');
          pill.className = d.opened ? 'is-open' : 'is-closed';
          pill.textContent = d.opened ? '已打开' : '未打开';
          head.append(title, pill);
          const sub = document.createElement('div');
          sub.className = 'local-diag-device-meta';
          sub.textContent = `接口集合: ${cols}`;
          card.append(head, sub);
          devicesEl.appendChild(card);
        }
      }

      const stats = window.thunder68DesktopDiag?.stats?.() || {};
      countersEl.replaceChildren();
      const cGrid = document.createElement('div');
      cGrid.className = 'local-diag-kv-grid';
      for (const [label, key] of [
        ['连接请求', 'requests'],
        ['接口打开', 'opens'],
        ['接口关闭', 'closes'],
        ['HID 发包', 'sent'],
        ['HID 收包', 'received'],
        ['通信错误', 'errors'],
        ['热插拔接入', 'connects'],
        ['热插拔断开', 'disconnects']
      ]) {
        const item = document.createElement('div');
        item.className = 'local-diag-kv';
        const span = document.createElement('span');
        span.textContent = label;
        const val = document.createElement('strong');
        val.textContent = String(stats[key] ?? 0);
        item.append(span, val);
        cGrid.appendChild(item);
      }
      countersEl.appendChild(cGrid);

      const sessionLogs = window.thunder68DesktopDiag?.recentEvents?.() || [];
      const mergedEntries = (mainData?.entries?.length ? mainData.entries : sessionLogs).slice(-50);
      lastDiagReportText = helpers.formatSanitizedRendererReport({
        meta: mainData?.meta || {appVersion, platform: navigator.platform || ''},
        discovery: effectiveDiscovery,
        stats,
        devices: hidDevices,
        entries: mergedEntries
      });

      logsEl.textContent = mergedEntries.length
        ? mergedEntries.map(entry => {
            const ts = (entry.time || '').slice(11, 19);
            const parts = [ts || '--:--:--', entry.event];
            if (entry.errorName) parts.push(`[${entry.errorName}]`);
            if (entry.category) parts.push(`(${entry.category})`);
            if (entry.reason) parts.push(`reason=${entry.reason}`);
            if (typeof entry.count === 'number') parts.push(`count=${entry.count}`);
            if (typeof entry.bytes === 'number') parts.push(`${entry.bytes}B`);
            if (entry.message) parts.push(entry.message);
            return parts.join(' ');
          }).join('\n')
        : '暂无诊断事件记录。';
    }

    function openDiagnostics() {
      diagBackdrop.hidden = false;
      diagDrawer.hidden = false;
      diagTrigger.setAttribute('aria-expanded', 'true');
      refreshDiagnostics();
    }

    function closeDiagnostics() {
      diagBackdrop.hidden = true;
      diagDrawer.hidden = true;
      diagTrigger.setAttribute('aria-expanded', 'false');
    }

    diagTrigger.addEventListener('click', () => {
      if (diagDrawer.hidden) openDiagnostics();
      else closeDiagnostics();
    });
    diagClose.addEventListener('click', closeDiagnostics);
    diagBackdrop.addEventListener('click', closeDiagnostics);
    diagRefresh.addEventListener('click', refreshDiagnostics);
    diagCopy.addEventListener('click', async () => {
      await refreshDiagnostics();
      let copied = false;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(lastDiagReportText);
          copied = true;
        }
      } catch {}
      if (!copied) {
        const area = document.createElement('textarea');
        area.value = lastDiagReportText;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try { copied = document.execCommand('copy'); } catch {}
        area.remove();
      }
      diagCopy.textContent = copied ? '已复制脱敏日志 ✓' : '复制失败，请手动选中复制';
      setTimeout(() => { diagCopy.textContent = '一键复制脱敏诊断日志'; }, 2200);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !diagDrawer.hidden) closeDiagnostics();
    });

    root.addEventListener('pointerdown', e => {
      if (e.target.closest('.local-settings-panel') && !e.target.closest('.tab-navigation')) lastEditAt = Date.now();
    }, true);
    root.addEventListener('change', e => {
      if (e.target.closest('.local-settings-panel')) lastEditAt = Date.now();
    }, true);

    const configuration = config => JSON.stringify([
      config?.keyValues, config?.buttonMap, config?.lightness,
      config?.superkeys, config?.settings, config?.macroMap, config?.triggerMode
    ]);
    const feedback = (text, kind = 'neutral') => {
      operation.textContent = text;
      operation.dataset.kind = kind;
    };

    const resetVerifyTimers = () => {
      clearTimeout(verifyWaitTimer);
      verifyWaitTimer = null;
    };

    const connect = options => {
      const silent = Boolean(options && options.silent === true);
      silentAutoConnect = silent;
      feedbackLocked = false;
      const container = root.querySelector('.device-container');
      const target = helpers.findDeviceEntry(container);
      if (!target) {
        silentAutoConnect = false;
        if (verifyMachine.getState().active) {
          verifyMachine.abort();
          resetVerifyTimers();
        }
        connectButton.disabled = false;
        if (!silent) feedback('连接入口尚未就绪，请稍后重试。', 'error');
        return false;
      }
      feedback(silent ? '已检测到键盘，正在自动预读当前配置…' : '正在连接并读取配置…');
      connectButton.disabled = true;
      clearTimeout(connectionTimer);
      connectionTimer = setTimeout(() => {
        // Do not report timeout if the official 2.4G pairing modal is awaiting user action
        if (root.querySelector('.sidebar .modal-overlay')) return;
        const wasSilent = silentAutoConnect;
        silentAutoConnect = false;
        connectButton.disabled = false;
        if (wasSilent) {
          feedback('连接键盘后读取当前配置');
          return;
        }
        const info = helpers.classifyConnectionError({timeout: true, discoveryReason: lastDiscovery?.reason});
        renderTroubleshoot(info);
        feedback(`${info.title}：${info.summary}`, 'error');
        window.thunder68Local?.diagnostic({event: 'hid-connect-timeout', category: info.code});
        verifyMachine.abort();
        resetVerifyTimers();
      }, 30000);
      target.click();
      return true;
    };

    importBtn.addEventListener('click', () => {
      const fileInput = root.querySelector('#fileInput');
      if (!fileInput) {
        feedback('导入控件尚未就绪，请先连接键盘。', 'error');
        return;
      }
      lastEditAt = Date.now();
      fileInput.click();
    });

    verify.addEventListener('click', () => {
      const expected = configuration(window.thunder68Presentation.state()?.config);
      ready = false;
      feedbackLocked = false;
      lastConfiguration = null;
      observedSignature = '';
      stableAt = 0;
      deviceOpened = false;
      clearTimeout(settleTimer);
      clearTimeout(connectionTimer);
      resetVerifyTimers();

      verifyMachine.start(expected);
      feedback('正在断开并重新读取键盘配置…');
      const returned = returnToDevices();
      if (!returned) {
        verifyMachine.abort();
        feedback('未能找到返回设备列表入口，无法重新读取核对。', 'error');
        synchronize();
        return;
      }
      // Safety fallback if leaving the config view stalls
      verifyWaitTimer = setTimeout(() => {
        if (!verifyMachine.getState().active) return;
        const vState = verifyMachine.getState();
        if (!vState.connectTriggered) {
          verifyMachine.abort();
          connectButton.disabled = false;
          feedback('重新读取超时，请手动返回“我的设备”后重连。', 'error');
          synchronize();
        }
      }, 8000);
      synchronize();
    });

    window.addEventListener('thunder68-feedback', e => {
      const kind = helpers.classifyFeedbackEvent(e.detail);
      if (kind === 'page-error') {
        // Keep page script exceptions separate from USB disconnect banners
        return;
      }
      if (kind === 'hid-error') {
        const wasSilent = silentAutoConnect;
        silentAutoConnect = false;
        clearTimeout(connectionTimer);
        resetVerifyTimers();
        verifyMachine.abort();
        connectButton.disabled = false;
        const info = helpers.classifyConnectionError({
          event: e.detail?.event,
          errorName: e.detail?.errorName,
          message: e.detail?.message,
          discoveryReason: lastDiscovery?.reason
        });
        window.thunder68Local?.diagnostic({event: 'connection-classified', category: info.code, errorName: info.errorName});
        if (wasSilent) {
          feedback(info.code === 'device-busy' ? '启动预读已跳过：键盘正被其他驱动占用，关闭后点击「连接键盘」即可' : '连接键盘后读取当前配置');
          return;
        }
        feedbackLocked = true;
        renderTroubleshoot(info);
        feedback(`${info.title}（${info.errorName}）`, 'error');
      } else if (kind === 'hid-request-result' && !e.detail.count) {
        const wasSilent = silentAutoConnect;
        silentAutoConnect = false;
        clearTimeout(connectionTimer);
        resetVerifyTimers();
        verifyMachine.abort();
        connectButton.disabled = false;
        if (wasSilent) {
          feedback('连接键盘后读取当前配置');
          return;
        }
        const info = helpers.classifyConnectionError({
          event: 'hid-request-result',
          count: 0,
          discoveryReason: lastDiscovery?.reason
        });
        renderTroubleshoot(info);
        feedback(info.title, 'error');
      } else if (kind === 'hid-close') {
        deviceOpened = false;
        ready = false;
        verifyMachine.onLeftConfigOrClosed();
        synchronize();
      } else if (kind === 'hid-input') {
        verifyMachine.onFreshHidActivity();
        if (wasBusy) syncScheduler.schedule();
      } else if (kind === 'hid-output' && ready && !verifyMachine.getState().active && !feedbackLocked && Date.now() - lastEditAt < 3000) {
        feedback('设置已发送 · 重新读取可核对设备当前值');
      }
    });

    const keyDetails = document.createElement('div');
    keyDetails.className = 'local-key-details';
    keyDetails.setAttribute('role', 'status');
    shell.querySelector('.local-board-overlay').appendChild(keyDetails);

    const svgNamespace = 'http://www.w3.org/2000/svg';
    const parameterCanvas = document.createElementNS(svgNamespace, 'svg');
    parameterCanvas.classList.add('local-parameter-labels');
    parameterCanvas.setAttribute('aria-hidden', 'true');
    shell.appendChild(parameterCanvas);

    function drawParameters() {
      const state = window.thunder68Presentation?.state();
      const native = root.querySelector('.keyboard_image canvas');
      const params = state?.common?.deviceParams;
      const keyValues = state?.config?.keyValues;
      const hidden = Boolean(activeToolId) || currentIndex !== 2 || !native || !params || !Array.isArray(params.layoutMappingData) || !params.layoutX || !params.layoutY || !Array.isArray(keyValues);
      parameterCanvas.toggleAttribute('hidden', hidden);
      if (hidden) return;

      const rect = native.getBoundingClientRect();
      const style = `left:${rect.x}px;top:${rect.y}px;width:${rect.width}px;height:${rect.height}px;clip-path:inset(${Math.max(0, 148 - rect.y)}px 0 ${Math.max(0, rect.bottom - (innerHeight - 42))}px 0);`;
      if (parameterCanvas.getAttribute('style') !== style) parameterCanvas.setAttribute('style', style);

      const resolvedTheme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
      const signature = JSON.stringify([resolvedTheme, native.width, native.height, keyValues, state?.config?.fastTriggerShow, state?.config?.fastTriggerRTShow]);
      if (signature === parameterSignature) return;
      parameterSignature = signature;

      const badgePalette = helpers.getTravelBadgePalette(resolvedTheme);
      parameterCanvas.setAttribute('viewBox', `0 0 ${params.layoutX} ${params.layoutY}`);
      parameterCanvas.setAttribute('preserveAspectRatio', 'none');
      parameterCanvas.replaceChildren();
      const values = new Map(keyValues.map(value => [value.id, value]));
      const badge = (value, x, y, color, align, fontSize) => {
        if (value === null || value === undefined || !Number.isFinite(Number(value))) return;
        const text = Number(value).toFixed(2);
        const width = text.length * fontSize * 0.62;
        const left = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
        const background = document.createElementNS(svgNamespace, 'rect');
        for (const [name, attrVal] of Object.entries({
          x: left - 4,
          y: y - 2,
          width: width + 8,
          height: fontSize + 4,
          rx: 5,
          ry: 5,
          fill: badgePalette.bg,
          stroke: badgePalette.stroke,
          'stroke-width': 1.5
        })) {
          background.setAttribute(name, attrVal);
        }
        const label = document.createElementNS(svgNamespace, 'text');
        label.textContent = text;
        for (const [name, attrVal] of Object.entries({
          x,
          y: y + fontSize * 0.83,
          fill: color,
          'text-anchor': align === 'right' ? 'end' : align === 'center' ? 'middle' : 'start',
          'font-family': 'Consolas,monospace',
          'font-size': fontSize,
          'font-weight': 700
        })) label.setAttribute(name, attrVal);
        parameterCanvas.append(background, label);
      };

      for (const key of params.layoutMappingData) {
        const value = values.get(key.id);
        if (!value) continue;
        if (state.config.fastTriggerShow) {
          badge(value.travelValue, key.x + key.width - 5, value.isRTEnabled ? key.y + 4 : key.y + key.height - 32, badgePalette.travel, 'right', 26);
        }
        if (state.config.fastTriggerRTShow && value.isRTEnabled) {
          badge(value.isIndependentSensitivity ? value.triggerSensitivity : value.sensitivity, key.x + 4, key.y + key.height - 24, badgePalette.rtTrigger, 'left', 20);
          badge(value.isIndependentSensitivity ? value.resetSensitivity : value.sensitivity, key.x + key.width - 4, key.y + key.height - 24, badgePalette.rtReset, 'right', 20);
        }
      }
    }

    function updateKeyDetails(config, selection) {
      if (!selection.length) {
        keyDetails.textContent = '选择键盘上的按键，查看该键的具体参数。';
        return;
      }
      const values = selection.map(id => config?.keyValues?.find(value => value.id === id));
      const field = (name, format, read = value => value?.[name]) => {
        const entries = values.map(read);
        if (entries.some(value => value === undefined || value === null)) return '未读取';
        return entries.every(value => value === entries[0]) ? format(entries[0]) : '不同';
      };
      const mm = value => Number.isFinite(Number(value)) ? Number(value).toFixed(2) + ' mm' : '未读取';
      const fields = [['触发行程', field('travelValue', mm)], ['快速触发 RT', field('isRTEnabled', value => value ? '开启' : '关闭')]];
      if (values.some(value => value?.isRTEnabled) && !values.every(value => value?.isRTEnabled)) {
        fields.push(['RT 灵敏度', '不同（部分关闭）']);
      } else if (values.some(value => value?.isRTEnabled)) {
        const independent = values.some(value => value?.isIndependentSensitivity);
        if (independent) {
          fields.push(
            ['按下灵敏度', field('triggerSensitivity', mm, value => value?.isIndependentSensitivity ? value.triggerSensitivity : value?.sensitivity)],
            ['抬起灵敏度', field('resetSensitivity', mm, value => value?.isIndependentSensitivity ? value.resetSensitivity : value?.sensitivity)]
          );
        } else {
          fields.push(['RT 灵敏度', field('sensitivity', mm)]);
        }
      }
      keyDetails.replaceChildren();
      const name = document.createElement('strong');
      name.textContent = selection.length === 1 ? selection[0] : `${selection.length} 个按键`;
      keyDetails.appendChild(name);
      for (const [label, value] of fields) {
        const item = document.createElement('span');
        const caption = document.createElement('span');
        const number = document.createElement('b');
        caption.textContent = label;
        number.textContent = value;
        item.append(caption, number);
        keyDetails.appendChild(item);
      }
    }

    let tabs = [];
    let deviceOpened = false;
    let storeSubscribed = false;
    let currentIndex = 0;
    let paletteNodes = [];

    const photo = document.createElement('img');
    photo.src = '/thunder68/imgs/mg_main.png';
    photo.alt = '雷电68键盘';
    shell.querySelector('.local-home-board').appendChild(photo);

    for (const button of shell.querySelectorAll('[data-select]')) {
      button.addEventListener('click', () => {
        const native = helpers.findSelectMenuEntry(root, button.dataset.select);
        if (currentIndex === 2 && native) {
          native.click();
          return;
        }
        const state = window.thunder68Presentation?.state();
        const ids = state?.common?.deviceParams?.layoutMappingData?.map(k => k.id) || [];
        const selected = state?.config?.mapPendingKey || [];
        if (!ids.length) return;
        const value = button.dataset.select;
        window.thunder68Presentation.selectKeys(
          value === '全选' ? ids
            : value === '反选' ? ids.filter(id => !selected.includes(id))
            : value === '字母键' ? ids.filter(id => /^[A-Z]$/.test(id))
            : ids.filter(id => ['W', 'A', 'S', 'D'].includes(id))
        );
      });
    }

    shell.querySelector('.local-clear-selection').addEventListener('click', () => {
      const canvas = root.querySelector('.keyboard_image canvas');
      const rect = canvas?.getBoundingClientRect();
      if (rect) {
        canvas.dispatchEvent(new MouseEvent('click', {bubbles: true, clientX: rect.x + rect.width * 0.5, clientY: rect.y + rect.height * 0.06}));
      }
      window.thunder68Presentation?.selectKeys([]);
      synchronize();
    });
    shell.querySelector('.local-reset-keys').addEventListener('click', () => root.querySelector('.select_menu button')?.click());
    connectButton.addEventListener('click', connect);

    const palette = shell.querySelector('.local-palette');
    const search = palette.querySelector('input');
    function filterPalette() {
      const query = search.value.trim().toLowerCase();
      let count = 0;
      for (const button of palette.querySelectorAll('.local-function-key')) {
        const match = !query || button.dataset.search.includes(query);
        button.hidden = !match;
        if (match) count++;
      }
      for (const group of palette.querySelectorAll('.local-function-group')) {
        group.hidden = ![...group.querySelectorAll('button')].some(button => !button.hidden);
      }
      palette.querySelector('.local-palette-count').textContent = `${count} 个按键`;
      palette.querySelector('.local-search-empty').hidden = count > 0;
    }
    search.addEventListener('input', filterPalette);

    function positionOverlay(element, rect, insets) {
      if (!rect?.width) return;
      const [left, top, right, bottom] = insets;
      const x = rect.x + left;
      const y = rect.y + top;
      const width = Math.max(0, rect.width - left - right);
      const height = Math.max(0, rect.height - top - bottom);
      const style = `left:${x}px;top:${y}px;width:${width}px;height:${height}px;clip-path:inset(${Math.min(height, Math.max(0, 148 - y))}px 0 ${Math.min(height, Math.max(0, y + height - (innerHeight - 42)))}px 0);`;
      if (element.getAttribute('style') !== style) element.setAttribute('style', style);
    }

    function updateOverlays() {
      const stage = root.querySelector('.local-keyboard-stage');
      if (stage) positionOverlay(shell.querySelector('.local-board-overlay'), stage.getBoundingClientRect(), [20, 18, 20, 18]);
      const panel = root.querySelector('.local-settings-panel');
      if (panel) {
        const rect = panel.getBoundingClientRect();
        const nav = (panel.querySelector('.buttonComposition') || panel.querySelector('.tab-navigation'))?.getBoundingClientRect();
        positionOverlay(palette, rect, [20, nav ? nav.bottom - rect.y + 18 : 110, 20, 20]);
      }
      drawParameters();
    }

    window.addEventListener('resize', updateOverlays);
    // The captured renderer clears its canvas during resize. Notify it once the
    // image settles so its existing selection and parameter drawing is restored.
    let resizeRefresh;
    window.addEventListener('resize', () => {
      clearTimeout(resizeRefresh);
      resizeRefresh = setTimeout(() => {
        const config = window.thunder68Presentation?.state()?.config;
        if (root.querySelector('.keyboard_image') && config && !config.mask) {
          window.thunder68Presentation.selectKeys([...(config.mapPendingKey || [])]);
        }
      }, 140);
    });
    root.addEventListener('scroll', updateOverlays, true);

    const refreshDevice = async () => {
      try {
        const opened = (await navigator.hid.getDevices()).some(d => d.opened && d.vendorId === 0x369b);
        const wasOpened = deviceOpened;
        deviceOpened = opened;
        if (opened && !wasOpened) {
          verifyMachine.onDeviceOpened();
        } else if (!opened && wasOpened) {
          verifyMachine.onLeftConfigOrClosed();
        }
        synchronize();
      } catch {}
    };

    window.addEventListener('thunder68-device-open', () => {
      silentAutoConnect = false;
      hideHotplugBanner();
      clearTroubleshoot();
      verifyMachine.onDeviceOpened();
      refreshDevice();
    });
    window.addEventListener('thunder68-device-close', () => {
      deviceOpened = false;
      ready = false;
      verifyMachine.onLeftConfigOrClosed();
      synchronize();
    });

    function exitTool() {
      if (!activeToolId) return;
      const previous = companionTools.get(activeToolId);
      activeToolId = null;
      document.body.classList.remove('local-companion-active');
      companionStage.hidden = true;
      for (const [, tool] of companionTools) {
        if (tool.container) tool.container.hidden = true;
        if (tool.button) {
          tool.button.classList.remove('is-active');
          tool.button.setAttribute('aria-current', 'false');
        }
      }
      try { previous?.onHide?.(); } catch {}
      synchronize();
    }

    function activateTool(id) {
      const tool = companionTools.get(id);
      if (!tool) return false;
      if (activeToolId === id) return true;
      if (activeToolId) {
        const prev = companionTools.get(activeToolId);
        if (prev?.container) prev.container.hidden = true;
        if (prev?.button) {
          prev.button.classList.remove('is-active');
          prev.button.setAttribute('aria-current', 'false');
        }
        try { prev?.onHide?.(); } catch {}
      }
      activeToolId = id;
      document.body.classList.add('local-companion-active');
      companionStage.hidden = false;
      tool.container.hidden = false;
      tool.button.classList.add('is-active');
      tool.button.setAttribute('aria-current', 'page');
      synchronize();
      try { tool.onShow?.(); } catch {}
      return true;
    }

    function registerTool(spec) {
      if (!spec || !spec.id || companionTools.has(spec.id)) return false;
      companionNav.hidden = false;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'local-companion-item';
      button.dataset.tool = spec.id;
      button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${spec.iconSvg || paths.settings}</svg><span></span>`;
      button.querySelector('span').textContent = spec.label || spec.id;
      button.addEventListener('click', () => activateTool(spec.id));
      companionNavList.appendChild(button);

      const container = document.createElement('div');
      container.className = 'local-companion-view';
      container.dataset.toolView = spec.id;
      container.hidden = true;
      companionStage.appendChild(container);

      const entry = {...spec, button, container};
      companionTools.set(spec.id, entry);
      try { spec.render?.(container); } catch {}
      return true;
    }

    function returnToDevices() {
      exitTool();
      const target = helpers.findExitButton(root);
      if (!target) return false;
      target.click();
      return true;
    }

    shell.querySelector('.local-brand').addEventListener('click', e => {
      e.preventDefault();
      returnToDevices();
    });
    shell.querySelector('.local-device-link').addEventListener('click', () => {
      if (activeToolId && !root.querySelector('.main-content')) {
        exitTool();
        return;
      }
      returnToDevices();
    });

    for (const button of shell.querySelectorAll('[data-page]')) {
      button.addEventListener('click', () => {
        exitTool();
        const tab = tabs[Number(button.dataset.page)];
        if (tab) {
          tab.click();
          const main = root.querySelector('.main-content');
          if (main) main.scrollTop = 0;
          synchronize();
        }
      });
    }

    const paper = new Set(['white', '#fff', '#ffffff', 'rgb(255, 255, 255)', 'rgb(242, 244, 245)', 'rgb(254, 254, 254)', 'rgb(238, 238, 238)']);
    const muted = new Set(['rgb(217, 217, 217)', 'rgb(196, 196, 196)', 'rgb(221, 221, 221)', 'rgb(204, 204, 204)', 'rgb(153, 153, 153)', 'rgb(243, 243, 243)']);
    const accent = new Set(['rgb(234, 84, 19)', '#ea5413', 'rgb(255, 222, 173)']);
    const ink = new Set(['black', '#000', 'rgb(0, 0, 0)', 'rgb(51, 51, 51)', 'rgb(34, 34, 34)', 'rgb(82, 82, 82)', 'rgb(31, 31, 31)']);
    const mark = (node, key, value) => { if (node.dataset[key] !== value) node.dataset[key] = value; };

    const classify = node => {
      if (node.closest('.colorplate,.color-slider,.color_board')) return;
      if (node.tagName === 'IMG' && node.title && node.parentElement?.nextElementSibling?.tagName === 'SPAN') {
        const tile = node.parentElement.parentElement;
        tile.classList.add('local-action-tile');
        tile.parentElement.classList.add('local-action-grid');
        tile.parentElement.parentElement.classList.add('local-action-catalog');
      }
      if (node.tagName === 'IMG' && ['DKS', 'SOCD', 'MT', 'TGL', 'MPT', 'END'].includes(node.alt) && node.parentElement.style.width === '30%') {
        node.parentElement.classList.add('local-super-card');
        node.parentElement.parentElement.classList.add('local-super-catalog');
      }
      if (!node.children.length && node.tagName === 'SPAN') {
        const descriptions = {
          '按键在按压到固定位置后触发，回弹到固定位置后释放。触发行程越低，物理响应越快，但更容易误触触发按键所需要的按下的距离': '按下多深才触发。数值越小，触发越快，也更容易误触。',
          '通过动态地触发和重置按键，实现更快的按键操作。当您意图按下或释放按键时，快速触发会立即触发按键的动作，并在达到触发点后自动重置按键。这样可以减少按键的延迟和提高响应速度。': '根据按键的移动距离触发与复位，不必回到固定位置。适合需要连续快速按键的操作。',
          '灵敏度决定了按键抬起（重置）和再次按下按键（触发）所需的键程': '再次按下或抬起多少距离才响应。数值越小越灵敏。',
          '独立的上收/下击灵敏度': '分别设置按下与抬起',
          '如果启用，您可以单独定义快速触发的按下（触发）和抬起（重置）的灵敏度。': '开启后，可分别调整按下触发和抬起复位的距离。'
        };
        const replacement = descriptions[node.textContent];
        if (replacement) {
          node.textContent = replacement;
          mark(node, 'localDescription', 'true');
        }
      }
      if (!node.children.length && ['DIV', 'SPAN', 'P'].includes(node.tagName) && node.textContent.trim().length > 45) {
        mark(node, 'localDescription', 'true');
      }
      const bg = node.style.backgroundColor.toLowerCase();
      const fg = node.style.color.toLowerCase();
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
      } else {
        mark(node, 'localGradient', '');
      }
      if (node.tagName === 'IMG' && /(?:check-mark|_orange|macro_tips|trigger_tips)/i.test(node.getAttribute('src') || '')) {
        mark(node, 'localIcon', 'mono');
      }
      if (node.style.fontSize === '0.6rem' && node.style.border && node.querySelector('span') && !node.closest('.keyboard_image,.sidebar')) {
        mark(node, 'localControl', 'key');
      }
      if (node.tagName === 'INPUT' && node.type === 'range') {
        const percent = (Number(node.value) - Number(node.min || 0)) / (Number(node.max || 100) - Number(node.min || 0)) * 100;
        const progress = Math.max(0, Math.min(100, percent)) + '%';
        if (node.style.getPropertyValue('--local-range-progress') !== progress) node.style.setProperty('--local-range-progress', progress);
      }
      if (helpers.isDangerResetButton(node)) mark(node, 'localDanger', 'true');
      if (node.style.cursor === 'pointer' && node.tagName === 'DIV' && !node.closest('.keyboard_image') && !node.hasAttribute('tabindex')) {
        node.tabIndex = 0;
        node.setAttribute('role', 'button');
      }
    };

    root.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('div[role="button"][tabindex="0"]')) {
        e.preventDefault();
        e.target.click();
      }
    });

    function updateRangeProgress(input) {
      if (!input || input.tagName !== 'INPUT' || input.type !== 'range') return;
      const span = Number(input.max || 100) - Number(input.min || 0);
      const percent = span ? ((Number(input.value) - Number(input.min || 0)) / span) * 100 : 0;
      const progress = Math.max(0, Math.min(100, percent)) + '%';
      if (input.style.getPropertyValue('--local-range-progress') !== progress) {
        input.style.setProperty('--local-range-progress', progress);
      }
    }

    root.addEventListener('input', e => {
      if (e.target?.tagName === 'INPUT' && e.target.type === 'range') {
        isClassifying = true;
        try {
          updateRangeProgress(e.target);
        } finally {
          mutationObserver?.takeRecords();
          isClassifying = false;
        }
      }
    }, true);

    const syncScheduler = helpers.createSyncScheduler({
      run: () => synchronize(),
      isBusy: () => Boolean(window.thunder68Presentation?.state()?.config?.mask),
      busyIntervalMs: 140
    });

    function synchronize() {
      const main = root.querySelector('.main-content');
      const connectedPage = !!main;
      const state = window.thunder68Presentation?.state();
      const sidebarEl = root.querySelector('.sidebar');
      const modalVisible = !!root.querySelector('.sidebar .modal-overlay');
      const busyNow = Boolean(state?.config?.mask);
      const reading = helpers.isReadingConfig(state?.config ? '' : root.textContent, state);
      const pageSwitched = connectedPage !== wasConnectedPage;
      const busyEnded = wasBusy && !busyNow;
      if (!wasBusy && (busyNow || reading)) {
        readStartFrames = window.thunder68DesktopDiag?.stats?.().received || 0;
        lastReadProgressText = '';
      }

      document.body.classList.toggle('local-config', connectedPage);
      document.body.classList.toggle('local-home', !connectedPage);
      document.body.classList.toggle('local-modal-open', modalVisible);

      if (modalVisible) {
        clearTimeout(connectionTimer);
        connectButton.disabled = false;
      }

      // Skip redundant full-DOM [style] scans when vendor DOM did not change or during mid-readback packet storms.
      if ((domDirty || pageSwitched || busyEnded) && (!busyNow || pageSwitched || !wasBusy)) {
        isClassifying = true;
        try {
          for (const node of root.querySelectorAll('[style]')) classify(node);
        } finally {
          mutationObserver?.takeRecords();
          isClassifying = false;
          domDirty = false;
        }
      } else if (!busyNow && connectedPage) {
        isClassifying = true;
        try {
          for (const range of root.querySelectorAll('input[type="range"]')) updateRangeProgress(range);
        } finally {
          mutationObserver?.takeRecords();
          isClassifying = false;
        }
      }
      shell.querySelector('.local-device-link').classList.toggle('is-active', !connectedPage && !activeToolId);

      // Update sidebar-derived device info (2.4G mode, battery, official build version)
      const deviceInfo = helpers.extractDeviceStatusInfo(state, sidebarEl);
      latestDeviceInfo = deviceInfo;
      const railMode = shell.querySelector('.local-rail-mode');
      if (railMode) {
        const batText = deviceInfo.battery !== null ? ` · 电量 ${deviceInfo.battery}%` : '';
        const modeText = `磁轴键盘 · ${deviceInfo.modeLabel}${batText}`;
        if (railMode.textContent !== modeText) railMode.textContent = modeText;
      }
      const railVersion = shell.querySelector('.local-rail-version');
      if (railVersion) {
        railVersion.hidden = !deviceInfo.officialVersion;
        if (deviceInfo.officialVersion && railVersion.textContent !== `内核 ${deviceInfo.officialVersion}`) {
          railVersion.textContent = `内核 ${deviceInfo.officialVersion}`;
        }
      }

      if (main) {
        if (!storeSubscribed && state) {
          storeSubscribed = true;
          window.thunder68Presentation.subscribe(() => syncScheduler.schedule());
        }

        const tabbar = helpers.findTabbarInMain(main);
        tabs = tabbar ? [...tabbar.children].slice(0, 6) : [];
        if (tabbar && !tabbar.classList.contains('local-original-tabs')) tabbar.classList.add('local-original-tabs');

        const selected = tabs.findIndex(t => t?.dataset.localSurface === 'selected');
        const index = selected < 0 ? 0 : selected;
        currentIndex = index;

        for (const button of shell.querySelectorAll('.local-nav-item')) button.disabled = !!state?.config?.mask;
        document.body.dataset.localPage = String(index);
        document.body.classList.toggle('local-bridge-unavailable', !state);

        const interactive = [0, 2, 3].includes(index);
        shell.querySelector('.local-board-instruction').textContent = interactive
          ? '点击选择按键；再次点击取消。参数调整作用于全部已选按键。'
          : '预览当前键盘。右侧调整整机设置。';
        shell.querySelector('.local-selection').classList.toggle('is-preview', !interactive);
        shell.querySelector('.local-reset-keys').hidden = ![0, 3].includes(index);

        for (const btn of shell.querySelectorAll('[data-page]')) {
          const active = !activeToolId && Number(btn.dataset.page) === index;
          btn.classList.toggle('is-active', active);
          btn.setAttribute('aria-current', active ? 'page' : 'false');
        }
        if (!activeToolId) {
          shell.querySelector('.local-page-heading h1').textContent = pages[index][0];
          shell.querySelector('.local-page-heading p').textContent = pages[index][2];
        }

        const keyboard = main.querySelector('.keyboard_image');
        if (keyboard && !keyboard.parentElement.parentElement.classList.contains('local-keyboard-stage')) {
          keyboard.parentElement.parentElement.classList.add('local-keyboard-stage');
        }
        if (keyboard) {
          keyboard.parentElement.classList.add('local-board-center');
          keyboard.nextElementSibling?.classList.add('local-board-modes');
        }
        if (tabbar?.nextElementSibling && !tabbar.nextElementSibling.classList.contains('local-settings-panel')) {
          tabbar.nextElementSibling.classList.add('local-settings-panel');
        }
        for (const part of main.querySelectorAll('.leftpart')) part.parentElement.classList.add('local-field-columns');

        if (index === 1) {
          const lightTabContainer = helpers.findLightTabContainer(main);
          if (lightTabContainer) {
            lightTabContainer.classList.add('local-light-tabs');
            if (lightTabContainer.parentElement && lightTabContainer.parentElement !== main.querySelector('.local-settings-panel')) {
              lightTabContainer.parentElement.classList.add('local-light-layout');
            }
          }
        }

        const selection = state?.config?.mapPendingKey || [];
        const busy = !!state?.config?.mask;

        for (const tile of main.querySelectorAll('.local-action-tile')) {
          tile.inert = !selection.length || busy || !deviceOpened;
          tile.setAttribute('aria-disabled', String(tile.inert));
        }
        const combinationApply = main.querySelector('.buttonComposition button');
        if (combinationApply) combinationApply.disabled = !selection.length || busy || !deviceOpened;

        const panel = main.querySelector('.local-settings-panel');
        let subtabKey = '';
        if (panel) {
          const navButtons = [...panel.querySelectorAll('.tab-navigation button')];
          const activeTabBtn = panel.querySelector('.tab-navigation button.active');
          panel.dataset.localTab = activeTabBtn?.textContent.trim() || '';
          subtabKey = index === 0 ? helpers.identifyKeymapSubtab(activeTabBtn, navButtons, panel) : '';
          panel.dataset.localTabKey = subtabKey;
          document.body.classList.toggle('local-combination', index === 0 && subtabKey === 'combination');

          const values = state?.config?.keyValues?.filter(key => selection.includes(key.id)) || [];
          const mixed = index === 2 && new Set(values.map(key => JSON.stringify([
            key.travelValue, key.isRTEnabled, key.sensitivity,
            key.triggerSensitivity, key.resetSensitivity, key.isIndependentSensitivity
          ]))).size > 1;
          panel.dataset.selectionContext = interactive
            ? (selection.length ? `编辑 ${selection.length} 个按键 · ${mixed ? '当前值不同，调整将统一所选按键' : '调整后直接发送'}` : '先在键盘上选择要修改的按键')
            : '调整键盘的全局设置';
        }

        for (const fields of main.querySelectorAll('.local-field-columns')) {
          fields.inert = (index === 2 && !selection.length) || busy || !deviceOpened;
        }
        document.body.classList.toggle('local-disconnected', !deviceOpened);

        const chips = shell.querySelector('.local-key-chips');
        if (chips.dataset.value !== selection.join('|')) {
          chips.dataset.value = selection.join('|');
          chips.replaceChildren();
          for (const id of selection) {
            const chip = document.createElement('button');
            chip.textContent = id;
            chip.title = `取消选择 ${id}`;
            chip.setAttribute('aria-label', `取消选择 ${id}`);
            chip.addEventListener('click', () => {
              const ids = window.thunder68Presentation?.state()?.config?.mapPendingKey || [];
              window.thunder68Presentation.selectKeys(ids.filter(key => key !== id));
            });
            chips.appendChild(chip);
          }
        }
        document.body.classList.toggle('local-has-selection', selection.length > 0);
        document.body.classList.toggle('local-busy', busy);

        const now = Date.now();
        const keyCount = state?.config?.keyValues?.length || 0;
        const vState = verifyMachine.getState();
        const receivedFrames = window.thunder68DesktopDiag?.stats?.().received || 0;

        if (busy || reading) {
          const progressText = helpers.formatReadProgressText({receivedFrames, readStartFrames, keyCount});
          if (progressText !== lastReadProgressText && (!feedbackLocked || vState.active)) {
            lastReadProgressText = progressText;
            feedback(progressText);
          }
          if (busy) lastBusy = true;
        } else {
          lastReadProgressText = '';
          const signature = configuration(state?.config);
          if (vState.active) {
            if (verifyMachine.observeConfig(signature, now)) {
              clearTimeout(settleTimer);
              settleTimer = setTimeout(() => syncScheduler.schedule({immediate: true}), SETTLE_TIMER_MS);
            }
            const result = verifyMachine.evaluate({connectedPage, deviceOpened, busy, reading, keyCount, now});
            if (result.done) {
              clearTimeout(connectionTimer);
              resetVerifyTimers();
              connectButton.disabled = false;
              ready = true;
              lastConfiguration = result.signature;
              observedSignature = result.signature;
              stableAt = now;
              feedback(
                result.matched
                  ? '已重新读取 · 配置与界面一致'
                  : '已重新读取 · 设备返回值与刚才不同，请检查当前参数',
                result.matched ? 'success' : 'error'
              );
              feedbackLocked = true;
            }
          } else {
            if (signature !== observedSignature) {
              observedSignature = signature;
              stableAt = now;
              clearTimeout(settleTimer);
              settleTimer = setTimeout(() => syncScheduler.schedule({immediate: true}), SETTLE_TIMER_MS);
            }
            const loaded = keyCount === 68 && !reading && stableAt > 0 && now - stableAt >= SETTLE_MS;
            if (deviceOpened && !busy && loaded) {
              clearTimeout(connectionTimer);
              connectButton.disabled = false;
              if (!ready) {
                ready = true;
                if (!feedbackLocked) feedback('已读取键盘当前配置 · 修改后可重新读取核对', 'success');
              } else if (lastConfiguration && signature !== lastConfiguration && Date.now() - lastEditAt < 3000) {
                feedbackLocked = false;
                feedback('当前设置已更新 · 设备结果待重新读取核对');
              } else if (lastBusy && !feedbackLocked) {
                feedback(Date.now() - lastEditAt < 3000 ? '操作已完成 · 重新读取可核对当前值' : '当前配置已就绪', 'success');
              }
              lastConfiguration = signature;
            }
            if (!busy && loaded) lastBusy = false;
          }
        }

        const isVerifying = verifyMachine.getState().active;
        const loadedForActions = !busy && keyCount === 68 && !reading && stableAt > 0 && now - stableAt >= SETTLE_MS;
        verify.hidden = !deviceOpened;
        verify.disabled = busy || isVerifying || !loadedForActions;

        const hasFileInput = !!root.querySelector('#fileInput');
        importBtn.hidden = !deviceOpened || !hasFileInput;
        importBtn.disabled = busy || isVerifying || !deviceOpened;

        updateKeyDetails(state?.config, selection);
        for (const button of palette.querySelectorAll('.local-function-key')) {
          button.disabled = !selection.length || busy || !deviceOpened;
        }
        shell.querySelector('.local-selection-label').textContent = selection.length
          ? `已选择 ${selection.slice(0, 3).join('、')}${selection.length > 3 ? ` 等 ${selection.length} 键` : ''}`
          : '未选择按键';
        shell.querySelector('.local-selection-label').title = selection.join('、');
        for (const button of shell.querySelectorAll('[data-select]')) {
          button.disabled = !!state?.config?.triggerMode?.triggerIndex || busy || !deviceOpened;
        }
        shell.querySelector('.local-clear-selection').disabled = !selection.length;

        const nativePalette = [...root.querySelectorAll('[data-local-control=key]')].filter(node => node.textContent.trim());
        document.body.classList.toggle('local-custom-palette', index === 0 && nativePalette.length > 30);
        const paletteTabKey = subtabKey || panel?.dataset.localTab || '';
        if (nativePalette.length > 30 && (palette.dataset.tab !== paletteTabKey || nativePalette.length !== paletteNodes.length || nativePalette[0] !== paletteNodes[0])) {
          palette.dataset.tab = paletteTabKey;
          paletteNodes = nativePalette;
          const grid = palette.querySelector('.local-palette-grid');
          grid.replaceChildren();
          const groups = ['字母与数字', '功能与修饰键', '符号与小键盘'].map(label => {
            const section = document.createElement('section');
            section.className = 'local-function-group';
            const heading = document.createElement('h3');
            heading.textContent = label;
            const keys = document.createElement('div');
            section.append(heading, keys);
            grid.appendChild(section);
            return keys;
          });
          const seenNames = new Map();
          for (const native of nativePalette) {
            const info = helpers.classifyPaletteKey(native.textContent, seenNames);
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'local-function-key';
            button.textContent = info.label;
            button.dataset.search = info.search;
            button.title = info.title;
            button.addEventListener('click', () => {
              const currentPanel = root.querySelector('.local-settings-panel');
              const navButtons = [...(currentPanel?.querySelectorAll('.tab-navigation button') || [])];
              const activeBtn = currentPanel?.querySelector('.tab-navigation button.active');
              const activeKey = helpers.identifyKeymapSubtab(activeBtn, navButtons, currentPanel) || activeBtn?.textContent.trim() || '';
              if (activeKey !== paletteTabKey || !native.isConnected || !window.thunder68Presentation?.state()?.config?.mapPendingKey?.length) {
                feedback('界面已切换，请在当前分类重新选择功能。');
                synchronize();
                return;
              }
              lastEditAt = Date.now();
              native.click();
            });
            groups[info.group].appendChild(button);
          }
          filterPalette();
          for (const button of palette.querySelectorAll('.local-function-key')) {
            button.disabled = !selection.length || busy || !deviceOpened;
          }
        }
        // Defer layout measurements & 200+ SVG badge rebuilds while config readback is streaming packets.
        if (!busyNow || pageSwitched || !wasBusy) {
          updateOverlays();
        }
      } else {
        ready = false;
        lastConfiguration = null;
        verify.hidden = true;
        importBtn.hidden = true;
        parameterCanvas.setAttribute('hidden', '');
        document.body.classList.remove('local-custom-palette', 'local-combination');
        shell.querySelector('.local-page-heading h1').textContent = '我的设备';
        shell.querySelector('.local-page-heading p').textContent = '连接键盘，读取并调整你的配置。';
        tabs = [];

        const container = root.querySelector('.device-container');
        if (container) {
          for (const child of container.children) {
            const label = child.querySelector('span');
            const cls = label
              ? (helpers.isAddDeviceElement(child) ? 'local-add-device' : 'local-saved-device')
              : 'local-connection-hint';
            if (!child.classList.contains(cls)) child.classList.add(cls);
            if (label) child.setAttribute('aria-label', '连接 ' + label.textContent.trim());
          }
        }

        // Event-driven reconnect during verify once we have genuinely left config view
        const vState = verifyMachine.getState();
        if (vState.active) {
          verifyMachine.onLeftConfigOrClosed();
          if (!verifyMachine.getState().connectTriggered && !modalVisible) {
            const entry = helpers.findDeviceEntry(container);
            if (entry) {
              verifyMachine.markConnectTriggered();
              resetVerifyTimers();
              connect();
            }
          }
        }
      }

      if (activeToolId) {
        const activeTool = companionTools.get(activeToolId);
        if (activeTool) {
          shell.querySelector('.local-page-heading h1').textContent = activeTool.title || activeTool.label;
          shell.querySelector('.local-page-heading p').textContent = activeTool.subtitle || '';
        }
        parameterCanvas.setAttribute('hidden', '');
      }

      const status = shell.querySelector('.local-status');
      const isEffectivelyConnected = connectedPage && deviceOpened && !reading;
      status.classList.toggle('is-connected', isEffectivelyConnected);
      const batBadge = deviceInfo.battery !== null ? ` · ${deviceInfo.battery}%` : '';
      const receivedDelta = Math.max(0, (window.thunder68DesktopDiag?.stats?.().received || 0) - readStartFrames);
      const readingBadge = receivedDelta > 0 ? `正在读取配置 · ${receivedDelta} 帧` : '正在读取配置';
      const nextStatusText = modalVisible
        ? '等待无线配对/确认'
        : connectedPage
          ? ((reading || busyNow) ? readingBadge : deviceOpened ? `${deviceInfo.modeLabel} 已连接${batBadge}` : '设备已断开')
          : '等待连接';
      const statusSpan = status.querySelector('span');
      if (statusSpan.textContent !== nextStatusText) statusSpan.textContent = nextStatusText;

      const deviceStatusPayload = {
        connected: isEffectivelyConnected,
        deviceOpened,
        reading,
        busy: busyNow,
        modeLabel: deviceInfo.modeLabel,
        isWireless: Boolean(deviceInfo.isWireless),
        battery: deviceInfo.battery
      };
      const deviceStatusKey = JSON.stringify(deviceStatusPayload);
      if (deviceStatusKey !== lastReportedStatusKey) {
        lastReportedStatusKey = deviceStatusKey;
        window.thunder68Local?.reportDeviceStatus?.(deviceStatusPayload);
      }

      const shellSyncDetail = {
        connectedPage,
        deviceOpened,
        ready,
        reading,
        busy: busyNow,
        activeToolId,
        deviceInfo
      };
      const shellSyncKey = JSON.stringify(shellSyncDetail);
      if (shellSyncKey !== lastShellSyncKey) {
        lastShellSyncKey = shellSyncKey;
        window.dispatchEvent(new CustomEvent('thunder68-shell-sync', {detail: shellSyncDetail}));
      }

      wasConnectedPage = connectedPage;
      wasBusy = busyNow;
    }

    mutationObserver = new MutationObserver(() => {
      if (isClassifying) return;
      domDirty = true;
      syncScheduler.schedule();
    });
    mutationObserver.observe(root, {childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class']});

    navigator.hid?.addEventListener('connect', event => {
      const device = event?.device;
      if (helpers.isSupportedHotplugDevice(device)) {
        if (!deviceOpened) {
          showHotplugBanner(device);
        }
        refreshDevice();
      }
      if (!diagDrawer.hidden) refreshDiagnostics();
    });

    navigator.hid?.addEventListener('disconnect', () => {
      deviceOpened = false;
      ready = false;
      feedbackLocked = true;
      hideHotplugBanner();
      verifyMachine.onLeftConfigOrClosed();
      feedback('键盘已断开。重新插入 USB 或检查 2.4G 连接，然后返回“我的设备”重连。', 'error');
      refreshDevice();
      if (!diagDrawer.hidden) refreshDiagnostics();
    });

    window.thunder68Shell = Object.freeze({
      registerTool,
      activateTool,
      exitTool,
      getActiveTool: () => activeToolId,
      getStatus: () => ({
        deviceOpened,
        ready,
        connectedPage: !!root.querySelector('.main-content'),
        busy: !!window.thunder68Presentation?.state()?.config?.mask,
        deviceInfo: {...latestDeviceInfo}
      }),
      feedback,
      connect,
      canPreload: () => !deviceOpened && !root.querySelector('.main-content') && !activeToolId && Boolean(helpers.findDeviceEntry(root.querySelector('.device-container'))),
      triggerVerify: () => verify.click(),
      openDiagnostics,
      setThemeChoice,
      getThemeChoice: () => themeChoice,
      navigateToOfficialPage(index) {
        exitTool();
        const tab = tabs[Number(index)];
        if (tab) {
          tab.click();
          const main = root.querySelector('.main-content');
          if (main) main.scrollTop = 0;
          synchronize();
          return true;
        }
        return false;
      }
    });
    uiInitialized = true;
    window.dispatchEvent(new CustomEvent('thunder68-shell-ready'));

    if (navigator.hid) refreshDevice();
    synchronize();
  });
})();

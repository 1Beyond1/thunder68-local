/* Shared presentation & state helpers (browser + Node test UMD module). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.thunder68Helpers = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const I18N_LABELS = Object.freeze({
    topmenu: [
      ['按键定义', 'KeyMapping'],
      ['灯效设置', 'LightEffect'],
      ['快速触发', 'QuickTrigger'],
      ['超级按键', 'AdvancedKey'],
      ['游戏配置', 'GameProfile'],
      ['其他设置', 'Settings']
    ],
    exit: ['返回设备列表', 'Exit'],
    sidebarDeviceList: ['设备列表', 'Device List'],
    addDevice: ['新增设备', 'New Product'],
    reading: ['正在配置读取', 'Loading configuration'],
    lightMainTab: ['主键灯', '按键灯光', 'Main key light'],
    lightFrontTab: ['前灯箱', '侧边灯光', 'Front light box', 'Side light box'],
    keymapSubtabs: {
      basic: ['基础键', 'Basic'],
      multimedia: ['多媒体键', 'Multimedia'],
      lighting: ['灯效键', 'LightEffect'],
      combination: ['组合键', 'CombinedKey'],
      macro: ['宏', 'Macro']
    },
    keymapSubtabOrder: ['basic', 'multimedia', 'lighting', 'combination', 'macro'],
    selectMenu: {
      '全选': {index: 0, labels: ['全选', 'Select All']},
      '反选': {index: 1, labels: ['反选', 'Reverse Select']},
      '数字键': {index: 2, labels: ['数字键', 'Numbers']},
      'WASD': {index: 3, labels: ['WASD']},
      '字母键': {index: 4, labels: ['字母键', 'Letters']},
      '取消全选': {index: 5, labels: ['取消全选', 'Select None']}
    },
    dangerReset: ['立即重置', 'Reset Now', 'Reset'],
    donglePairing: ['Dongle配对', 'Dongle Pair', '正在配对...', 'Pairing...']
  });

  function normalizeLabel(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function matchesLabels(text, candidates) {
    const normalized = normalizeLabel(text).toLowerCase();
    if (!normalized) return false;
    return candidates.some(item => normalizeLabel(item).toLowerCase() === normalized);
  }

  function isReadingConfig(rootText, state) {
    const hintSource = state?.config?.hintSource;
    const hintText = String(state?.config?.hintText || '');
    if (hintSource === 'operation' && state?.config?.mask) return true;
    if (I18N_LABELS.reading.some(phrase => hintText.toLowerCase().includes(phrase.toLowerCase()))) return true;
    const text = String(rootText || '');
    return I18N_LABELS.reading.some(phrase => text.toLowerCase().includes(phrase.toLowerCase()));
  }

  function isAddDeviceElement(element) {
    if (!element) return false;
    const label = element.querySelector?.('span');
    if (label && matchesLabels(label.textContent, I18N_LABELS.addDevice)) return true;
    const img = element.querySelector?.('img');
    const src = img?.getAttribute?.('src') || '';
    return /(?:^|\/)plus(?:_dark)?\.png$/i.test(src);
  }

  function findDeviceEntry(container) {
    if (!container) return null;
    const entries = [...(container.children || [])].filter(child => child.querySelector?.('span'));
    const saved = entries.find(entry => !isAddDeviceElement(entry));
    if (saved) return saved;
    return entries.find(entry => isAddDeviceElement(entry)) || null;
  }

  function findTabbarInMain(main) {
    if (!main) return null;
    const existing = main.querySelector?.('.local-original-tabs');
    if (existing) return existing;

    const spans = [...(main.querySelectorAll?.('span') || [])];
    const firstTabSpan = spans.find(span => matchesLabels(span.textContent, I18N_LABELS.topmenu[0]));
    if (firstTabSpan?.parentElement?.parentElement) {
      return firstTabSpan.parentElement.parentElement;
    }

    // Structural fallback: direct child (or shallow container) with >= 6 items containing img+span
    const candidates = [...(main.children || [])];
    for (const child of candidates) {
      const items = [...(child.children || [])];
      if (items.length < 6) continue;
      const firstSixValid = items.slice(0, 6).every(item => item.querySelector?.('img') && item.querySelector?.('span'));
      if (firstSixValid) return child;
    }
    return null;
  }

  function findExitButton(root) {
    if (!root) return null;
    const main = root.querySelector?.('.main-content');
    const tabbar = findTabbarInMain(main);
    if (tabbar) {
      const items = [...(tabbar.children || [])];
      const byText = items.find(item => matchesLabels(item.textContent, I18N_LABELS.exit));
      if (byText) return byText;
      // Structural fallback: official topmenu places the Exit button as the last child without an <img>
      const last = items[items.length - 1];
      if (items.length >= 7 && last && !last.querySelector?.('img') && last.querySelector?.('span')) {
        return last;
      }
    }

    const searchScopes = [main, root.querySelector?.('.sidebar'), root].filter(Boolean);
    for (const scope of searchScopes) {
      const spans = [...(scope.querySelectorAll?.('span') || [])];
      const match = spans.find(span =>
        matchesLabels(span.textContent, I18N_LABELS.exit) ||
        matchesLabels(span.textContent, I18N_LABELS.sidebarDeviceList)
      );
      if (match?.parentElement) return match.parentElement;
    }
    return null;
  }

  function findLightTabContainer(main) {
    if (!main) return null;
    const buttons = [...(main.querySelectorAll?.('button') || [])];
    const byLabel = buttons.find(btn => matchesLabels(btn.textContent, I18N_LABELS.lightMainTab));
    if (byLabel?.parentElement) return byLabel.parentElement;

    // Structural fallback: inside settings panel, a div containing 1-2 buttons immediately followed by a sibling containing .leftpart
    const panel = main.querySelector?.('.local-settings-panel') || main;
    const divs = [...(panel.querySelectorAll?.('div') || [])];
    for (const div of divs) {
      const children = [...(div.children || [])];
      if (children.length >= 1 && children.length <= 3 && children.every(c => c.tagName === 'BUTTON')) {
        if (div.nextElementSibling?.querySelector?.('.leftpart')) return div;
      }
    }
    return null;
  }

  function identifyKeymapSubtab(activeButton, allButtons, panel) {
    if (activeButton) {
      const text = normalizeLabel(activeButton.textContent);
      for (const [key, labels] of Object.entries(I18N_LABELS.keymapSubtabs)) {
        if (matchesLabels(text, labels)) return key;
      }
    }
    if (panel?.querySelector?.('.buttonComposition')) return 'combination';
    if (activeButton && Array.isArray(allButtons) && allButtons.length) {
      const idx = allButtons.indexOf(activeButton);
      if (idx >= 0 && idx < I18N_LABELS.keymapSubtabOrder.length) {
        return I18N_LABELS.keymapSubtabOrder[idx];
      }
    }
    return '';
  }

  function findSelectMenuEntry(root, selectKey) {
    const spec = I18N_LABELS.selectMenu[selectKey];
    if (!root || !spec) return null;
    const menu = root.querySelector?.('.select_menu');
    if (!menu) return null;

    const leafDivs = [...(menu.querySelectorAll?.('div') || [])].filter(
      node => !(node.children && node.children.length) && matchesLabels(node.textContent, spec.labels)
    );
    if (leafDivs[0]?.parentElement) return leafDivs[0].parentElement;

    // Structural fallback: non-button clickable children follow the fixed official order
    const clickableItems = [...(menu.children || [])].filter(child => child.tagName !== 'BUTTON');
    return clickableItems[spec.index] || null;
  }

  function isDangerResetButton(node) {
    if (!node) return false;
    const isClickable = node.tagName === 'BUTTON' || (node.children && node.children.length <= 1);
    return isClickable && matchesLabels(node.textContent, I18N_LABELS.dangerReset);
  }

  function parseBatteryPercent(batteryInfo) {
    if (batteryInfo === null || batteryInfo === undefined || batteryInfo === '') return null;
    const raw = String(batteryInfo).trim().toLowerCase();
    if (!raw) return null;
    if (raw === 'bc') return 100;
    const parsed = parseInt(raw, 16);
    if (!Number.isFinite(parsed) || parsed === 0x65 || parsed < 0 || parsed > 100) return null;
    return parsed;
  }

  function extractDeviceStatusInfo(state, sidebarEl) {
    const productId = state?.common?.productId;
    const isWireless = productId === 0x0434 || productId === 0x0584;
    const isWired = productId === 0x0211;
    const modeLabel = isWireless ? '2.4G 无线' : isWired ? 'USB 有线' : 'USB / 2.4G';

    let battery = null;
    if (isWireless) {
      battery = parseBatteryPercent(state?.config?.settings?.batteryInfo);
      if (battery === null && sidebarEl) {
        const match = String(sidebarEl.textContent || '').match(/\b(100|[1-9]?\d)%/);
        if (match) battery = Number(match[1]);
      }
    }

    let officialVersion = '';
    if (sidebarEl) {
      const match = String(sidebarEl.textContent || '').match(/\bv\d+(?:\.\d+)*(?:\s+build\s+[a-z0-9._-]+)?/i);
      if (match) officialVersion = match[0].trim();
    }

    return {productId, isWireless, isWired, modeLabel, battery, officialVersion};
  }

  const PALETTE_SHORT_NAMES = Object.freeze({
    PrintScreen: 'PrtSc',
    ScrollLock: 'ScrLk',
    PauseBreak: 'Pause',
    NumLock: 'Num',
    Backspace: 'Bksp',
    Insert: 'Ins',
    Delete: 'Del',
    CapsLock: 'Caps'
  });

  const SEARCH_ALIASES = Object.freeze({
    Space: '空格 spacebar',
    Enter: '回车 return',
    Backspace: '退格 bksp',
    Ctrl: '控制 control',
    Shift: '换挡',
    Alt: '选项',
    Win: '系统 windows meta',
    Esc: '退出 escape',
    Tab: '制表符',
    CapsLock: '大写锁定 caps',
    Delete: '删除 del',
    Insert: '插入 ins',
    NumLock: '小键盘锁定 numlock'
  });

  const FUNCTION_MODIFIER_RE = /^(F\d+|Esc|Ctrl|Alt|Shift|Win|Space|Tab|CapsLock|Backspace|Enter|Insert|Home|End|PgUp|PgDn|Delete|PrintScreen|ScrollLock|PauseBreak|Fn)$/i;
  const MAIN_DIGIT_RE = /^[^\w]\d$/;
  const NUMPAD_DIGIT_RE = /^(\d)(?:Home|End|PgUp|PgDn|Ins|↑|↓|←|→)?$/i;
  const NUMPAD_DECIMAL_RE = /^\.(?:Del)$/i;

  function classifyPaletteKey(rawText, seenNames) {
    const name = normalizeLabel(rawText);
    const flat = name.replace(/\s+/g, '');
    const repeat = seenNames.get(flat) || 0;
    seenNames.set(flat, repeat + 1);

    let label = PALETTE_SHORT_NAMES[flat] || name;
    let title = `分配为 ${name}`;
    let group = 2;
    const searchTokens = [name, flat];

    if (SEARCH_ALIASES[flat]) searchTokens.push(SEARCH_ALIASES[flat]);

    if (MAIN_DIGIT_RE.test(flat)) {
      const digit = flat.slice(-1);
      label = digit;
      title = `分配为主键盘 ${digit} (${name})`;
      group = 0;
      searchTokens.push(digit, `主键盘${digit}`, `digit${digit}`, '主键盘');
    } else if (/^[A-Z]$/.test(flat)) {
      label = flat;
      group = 0;
    } else if (NUMPAD_DIGIT_RE.test(flat)) {
      const digit = flat.match(NUMPAD_DIGIT_RE)[1];
      label = `Num ${digit}`;
      title = `分配为小键盘 ${digit} (${name})`;
      group = 2;
      searchTokens.push(`num${digit}`, `num ${digit}`, `numpad${digit}`, `小键盘${digit}`, '小键盘', 'numpad');
    } else if (NUMPAD_DECIMAL_RE.test(flat)) {
      label = 'Num .';
      title = `分配为小键盘 . (${name})`;
      group = 2;
      searchTokens.push('num.', 'numpad', '小键盘', '小数点');
    } else if (repeat > 0 && flat === 'Enter') {
      label = 'Num Ent';
      title = '分配为小键盘 Enter';
      group = 2;
      searchTokens.push('num enter', 'numpad enter', '小键盘回车', '小键盘', '回车');
    } else if (repeat > 0 && /^(Ctrl|Alt|Shift|Win)$/.test(flat)) {
      label = `${flat} R`;
      title = `分配为右 ${flat}`;
      group = 1;
      searchTokens.push(`右${flat}`, `right ${flat}`, `${flat} r`);
    } else if (FUNCTION_MODIFIER_RE.test(flat)) {
      group = 1;
      if (/^(Ctrl|Alt|Shift|Win)$/.test(flat)) {
        searchTokens.push(`左${flat}`, `left ${flat}`);
      }
    }

    return {
      label,
      title,
      group,
      search: searchTokens.join(' ').toLowerCase()
    };
  }

  function classifyFeedbackEvent(detail) {
    const event = String(detail?.event || '');
    if (event === 'page-error' || event === 'page-rejection') return 'page-error';
    if (event === 'hid-open-error' || event === 'hid-send-error' || event === 'hid-request-error') return 'hid-error';
    if (event === 'hid-request-result') return 'hid-request-result';
    if (event === 'hid-output') return 'hid-output';
    if (event === 'hid-close') return 'hid-close';
    if (event === 'hid-open') return 'hid-open';
    if (event === 'hid-input') return 'hid-input';
    if (event.includes('error')) return 'hid-error';
    return 'other';
  }

  function createHidFeedbackController(options = {}) {
    const onDiagnostic = typeof options.onDiagnostic === 'function' ? options.onDiagnostic : () => {};
    const onFeedback = typeof options.onFeedback === 'function' ? options.onFeedback : () => {};
    const debounceMs = typeof options.debounceMs === 'number' ? options.debounceMs : 80;
    const setTimer = options.setTimeoutFn || setTimeout;
    const clearTimer = options.clearTimeoutFn || clearTimeout;

    let sent = 0;
    let received = 0;
    let outputTimer = null;
    let pendingOutput = null;
    let lastInputNotifyAt = 0;

    function flushOutputFeedback() {
      outputTimer = null;
      if (!pendingOutput) return;
      const payload = pendingOutput;
      pendingOutput = null;
      onFeedback(payload);
    }

    return {
      recordOutput({reportId, bytes}) {
        sent++;
        const detail = {event: 'hid-output', reportId, bytes, count: sent};
        // Keep diagnostic sampling throttled to avoid log bloat
        if (sent <= 8 || sent % 100 === 0) onDiagnostic(detail);
        // Decouple UI feedback: debounce bursts so every real write notifies UI
        pendingOutput = detail;
        if (debounceMs <= 0) {
          flushOutputFeedback();
        } else {
          if (outputTimer) clearTimer(outputTimer);
          outputTimer = setTimer(flushOutputFeedback, debounceMs);
        }
        return detail;
      },
      recordInput({reportId, bytes, now = Date.now()}) {
        received++;
        const detail = {event: 'hid-input', reportId, bytes, count: received};
        if (received <= 8 || received % 100 === 0) onDiagnostic(detail);
        if (now - lastInputNotifyAt >= Math.max(debounceMs, 100)) {
          lastInputNotifyAt = now;
          onFeedback(detail);
        }
        return detail;
      },
      recordClose({name, vendorId, productId}) {
        if (outputTimer) {
          clearTimer(outputTimer);
          outputTimer = null;
          pendingOutput = null;
        }
        const detail = {event: 'hid-close', name, vendorId, productId};
        onDiagnostic(detail);
        onFeedback(detail);
        return detail;
      },
      flush() {
        if (outputTimer) {
          clearTimer(outputTimer);
          flushOutputFeedback();
        }
      },
      stats() {
        return {sent, received};
      }
    };
  }

  function createVerifyStateMachine(options = {}) {
    const settleMs = typeof options.settleMs === 'number' ? options.settleMs : 700;
    let state = {
      active: false,
      phase: 'idle', // idle | disconnecting | reconnecting | waiting-frame | settling
      expectedSignature: null,
      observedSignature: '',
      stableAt: 0,
      sawDisconnect: false,
      sawReconnect: false,
      sawFreshActivity: false,
      connectTriggered: false
    };

    return {
      getState() {
        return {...state};
      },
      start(expectedSignature) {
        state = {
          active: true,
          phase: 'disconnecting',
          expectedSignature,
          observedSignature: '',
          stableAt: 0,
          sawDisconnect: false,
          sawReconnect: false,
          sawFreshActivity: false,
          connectTriggered: false
        };
      },
      abort() {
        state.active = false;
        state.phase = 'idle';
        state.connectTriggered = false;
      },
      onLeftConfigOrClosed() {
        if (!state.active) return false;
        state.sawDisconnect = true;
        if (state.phase === 'disconnecting') {
          state.phase = 'reconnecting';
          return true;
        }
        return false;
      },
      markConnectTriggered() {
        if (!state.active) return;
        state.connectTriggered = true;
        state.phase = 'waiting-frame';
      },
      onDeviceOpened() {
        if (!state.active || !state.sawDisconnect) return;
        state.sawReconnect = true;
        state.observedSignature = '';
        state.stableAt = 0;
        state.phase = 'waiting-frame';
      },
      onFreshHidActivity() {
        if (!state.active || !state.sawDisconnect) return;
        state.sawFreshActivity = true;
        if (!state.sawReconnect) state.sawReconnect = true;
      },
      observeConfig(signature, now = Date.now()) {
        if (signature !== state.observedSignature) {
          state.observedSignature = signature;
          state.stableAt = now;
          if (state.active && state.sawReconnect) state.phase = 'settling';
          return true;
        }
        return false;
      },
      evaluate({connectedPage, deviceOpened, busy, reading, keyCount, now = Date.now()}) {
        if (!state.active) return {done: false};
        if (!state.sawDisconnect || !state.sawReconnect) return {done: false};
        if (!connectedPage || !deviceOpened || busy || reading || keyCount !== 68) return {done: false};
        // Require either a fresh HID input frame or a fresh config observation after reconnect
        if (!state.sawFreshActivity && !state.stableAt) return {done: false};
        if (!state.stableAt || now - state.stableAt < settleMs) return {done: false};
        const matched = state.observedSignature === state.expectedSignature;
        state.active = false;
        state.phase = 'idle';
        return {done: true, matched, signature: state.observedSignature};
      }
    };
  }

  return {
    I18N_LABELS,
    normalizeLabel,
    matchesLabels,
    isReadingConfig,
    isAddDeviceElement,
    findDeviceEntry,
    findTabbarInMain,
    findExitButton,
    findLightTabContainer,
    identifyKeymapSubtab,
    findSelectMenuEntry,
    isDangerResetButton,
    parseBatteryPercent,
    extractDeviceStatusInfo,
    classifyPaletteKey,
    classifyFeedbackEvent,
    createHidFeedbackController,
    createVerifyStateMachine
  };
});

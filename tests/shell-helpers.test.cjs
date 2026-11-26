const {test} = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('../app/shell-helpers.js');

// Minimal DOM node helper for structural + i18n selector tests without external deps
function el(tag, {cls = '', text = '', attrs = {}, children = []} = {}) {
  const node = {
    tagName: tag.toUpperCase(),
    className: cls,
    _text: text,
    attrs: {...attrs},
    children: [],
    parentElement: null,
    get textContent() {
      return this.children.length ? this.children.map(c => c.textContent).join('') : this._text;
    },
    get nextElementSibling() {
      if (!this.parentElement) return null;
      const idx = this.parentElement.children.indexOf(this);
      return idx >= 0 ? this.parentElement.children[idx + 1] || null : null;
    },
    getAttribute(name) {
      return Object.prototype.hasOwnProperty.call(this.attrs, name) ? this.attrs[name] : null;
    },
    matches(selector) {
      if (selector.startsWith('.')) {
        return this.className.split(/\s+/).includes(selector.slice(1));
      }
      return this.tagName.toLowerCase() === selector.toLowerCase();
    },
    querySelectorAll(selector) {
      const results = [];
      const walk = current => {
        for (const child of current.children) {
          if (child.matches(selector)) results.push(child);
          walk(child);
        }
      };
      walk(this);
      return results;
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    }
  };
  for (const child of children) {
    child.parentElement = node;
    node.children.push(child);
  }
  return node;
}

test('findTabbarInMain and findExitButton work in Chinese, English, and structural fallback', () => {
  for (const [labels, exitLabel] of [
    [[' 按键定义', '灯效设置', '快速触发', '超级按键', '游戏配置', '其他设置'], '返回设备列表'],
    [['KeyMapping', 'LightEffect', 'QuickTrigger', 'AdvancedKey', 'GameProfile', 'Settings'], 'Exit'],
    [['TabA', 'TabB', 'TabC', 'TabD', 'TabE', 'TabF'], 'Salir']
  ]) {
    const tabItems = labels.map((label, i) =>
      el('div', {children: [el('img', {attrs: {src: `/t/${i}.png`}}), el('span', {text: label})]})
    );
    const exitItem = el('div', {children: [el('span', {text: exitLabel})]});
    const tabbar = el('div', {children: [...tabItems, exitItem]});
    const main = el('div', {cls: 'main-content', children: [tabbar]});
    const root = el('div', {children: [main]});

    assert.equal(helpers.findTabbarInMain(main), tabbar);
    assert.equal(helpers.findExitButton(root), exitItem);
  }
});

test('findLightTabContainer matches ZH, EN, and structural fallback next to .leftpart', () => {
  for (const btnLabel of ['主键灯', '按键灯光', 'Main key light', 'Primary Light']) {
    const tabRow = el('div', {children: [el('button', {text: btnLabel}), el('button', {text: 'Front'})]});
    const columns = el('div', {children: [el('div', {cls: 'leftpart'})]});
    const panel = el('div', {cls: 'local-settings-panel', children: [el('div', {children: [tabRow, columns]})]});
    const main = el('div', {cls: 'main-content', children: [panel]});
    assert.equal(helpers.findLightTabContainer(main), tabRow);
  }
});

test('identifyKeymapSubtab supports Chinese, English, DOM structure, and index fallback', () => {
  const zhButtons = ['基础键', '多媒体键', '灯效键', '组合键', '宏'].map(t => el('button', {text: t}));
  assert.equal(helpers.identifyKeymapSubtab(zhButtons[3], zhButtons), 'combination');
  assert.equal(helpers.identifyKeymapSubtab(zhButtons[4], zhButtons), 'macro');

  const enButtons = ['Basic', 'Multimedia', 'LightEffect', 'CombinedKey', 'Macro'].map(t => el('button', {text: t}));
  assert.equal(helpers.identifyKeymapSubtab(enButtons[0], enButtons), 'basic');
  assert.equal(helpers.identifyKeymapSubtab(enButtons[1], enButtons), 'multimedia');
  assert.equal(helpers.identifyKeymapSubtab(enButtons[2], enButtons), 'lighting');
  assert.equal(helpers.identifyKeymapSubtab(enButtons[3], enButtons), 'combination');
  assert.equal(helpers.identifyKeymapSubtab(enButtons[4], enButtons), 'macro');

  // Unknown language fallback via index and .buttonComposition
  const otherButtons = ['B0', 'B1', 'B2', 'B3', 'B4'].map(t => el('button', {text: t}));
  assert.equal(helpers.identifyKeymapSubtab(otherButtons[4], otherButtons), 'macro');
  const panelWithComp = el('div', {children: [el('div', {cls: 'buttonComposition'})]});
  assert.equal(helpers.identifyKeymapSubtab(el('button', {text: 'Unknown'}), [], panelWithComp), 'combination');
});

test('findDeviceEntry distinguishes saved devices from add-device in ZH, EN, and icon src', () => {
  const saved = el('div', {children: [el('img', {attrs: {src: '/thunder68/imgs/mg_connect.png'}}), el('span', {text: 'THUNDER 68'})]});
  const addEn = el('div', {children: [el('img', {attrs: {src: '/thunder68/plus.png'}}), el('span', {text: 'New Product'})]});
  const addZh = el('div', {children: [el('img', {attrs: {src: '/thunder68/plus_dark.png'}}), el('span', {text: '新增设备'})]});

  assert.equal(helpers.isAddDeviceElement(addEn), true);
  assert.equal(helpers.isAddDeviceElement(addZh), true);
  assert.equal(helpers.isAddDeviceElement(saved), false);

  const containerWithSaved = el('div', {cls: 'device-container', children: [addEn, saved]});
  assert.equal(helpers.findDeviceEntry(containerWithSaved), saved);

  const containerOnlyAdd = el('div', {cls: 'device-container', children: [addEn]});
  assert.equal(helpers.findDeviceEntry(containerOnlyAdd), addEn);
});

test('findSelectMenuEntry resolves ZH, EN, and positional fallback', () => {
  const enItems = ['Select All', 'Reverse Select', 'Numbers', 'WASD', 'Letters', 'Select None']
    .map(label => el('div', {children: [el('img'), el('div', {text: label})]}));
  const menu = el('div', {cls: 'select_menu', children: [el('button', {text: 'Restore All'}), ...enItems]});
  const root = el('div', {children: [menu]});

  assert.equal(helpers.findSelectMenuEntry(root, '全选'), enItems[0]);
  assert.equal(helpers.findSelectMenuEntry(root, '反选'), enItems[1]);
  assert.equal(helpers.findSelectMenuEntry(root, 'WASD'), enItems[3]);
  assert.equal(helpers.findSelectMenuEntry(root, '字母键'), enItems[4]);
});

test('isReadingConfig and isDangerResetButton handle both Chinese and English', () => {
  assert.equal(helpers.isReadingConfig('正在配置读取，请稍等', null), true);
  assert.equal(helpers.isReadingConfig('Loading configuration, please wait.', null), true);
  assert.equal(helpers.isReadingConfig('idle', {config: {mask: true, hintSource: 'operation'}}), true);
  assert.equal(helpers.isReadingConfig('ready', {config: {mask: false, hintSource: ''}}), false);

  assert.equal(helpers.isDangerResetButton(el('button', {text: '立即重置'})), true);
  assert.equal(helpers.isDangerResetButton(el('button', {text: 'Reset'})), true);
  assert.equal(helpers.isDangerResetButton(el('button', {text: 'Reset Now'})), true);
  assert.equal(helpers.isDangerResetButton(el('button', {text: 'Save'})), false);
});

test('extractDeviceStatusInfo parses 2.4G battery, wired mode, and official version', () => {
  const sidebar = el('div', {cls: 'sidebar', children: [el('span', {text: 'Version:  v1.3 build 0062'})]});
  const wireless = helpers.extractDeviceStatusInfo({
    common: {productId: 0x0434},
    config: {settings: {batteryInfo: '50'}} // 0x50 = 80%
  }, sidebar);
  assert.equal(wireless.isWireless, true);
  assert.equal(wireless.modeLabel, '2.4G 无线');
  assert.equal(wireless.battery, 80);
  assert.equal(wireless.officialVersion, 'v1.3 build 0062');

  const fullCharge = helpers.extractDeviceStatusInfo({
    common: {productId: 0x0434},
    config: {settings: {batteryInfo: 'bc'}}
  }, sidebar);
  assert.equal(fullCharge.battery, 100);

  const invalidBat = helpers.extractDeviceStatusInfo({
    common: {productId: 0x0434},
    config: {settings: {batteryInfo: '65'}} // 0x65 sentinel = unknown
  }, sidebar);
  assert.equal(invalidBat.battery, null);

  const wired = helpers.extractDeviceStatusInfo({
    common: {productId: 0x0211},
    config: {settings: {batteryInfo: '50'}}
  }, sidebar);
  assert.equal(wired.modeLabel, 'USB 有线');
  assert.equal(wired.battery, null);
});

test('classifyPaletteKey distinguishes main row digits from numpad digits, numpad enter, and right modifiers', () => {
  const seen = new Map();
  const main1 = helpers.classifyPaletteKey('!\n1', seen);
  const main5 = helpers.classifyPaletteKey('%\n5', seen);
  const num5 = helpers.classifyPaletteKey('5', seen);
  const num7 = helpers.classifyPaletteKey('7\nHome', seen);
  const num0 = helpers.classifyPaletteKey('0\nIns', seen);
  const numDot = helpers.classifyPaletteKey('.\nDel', seen);
  const mainEnter = helpers.classifyPaletteKey('Enter', seen);
  const numEnter = helpers.classifyPaletteKey('Enter', seen);
  const leftCtrl = helpers.classifyPaletteKey('Ctrl', seen);
  const rightCtrl = helpers.classifyPaletteKey('Ctrl', seen);

  assert.equal(main1.label, '1');
  assert.equal(main1.group, 0);
  assert.match(main1.title, /主键盘/);

  assert.equal(main5.label, '5');
  assert.equal(main5.group, 0);

  assert.equal(num5.label, 'Num 5');
  assert.equal(num5.group, 2);
  assert.match(num5.search, /小键盘/);

  assert.equal(num7.label, 'Num 7');
  assert.equal(num7.group, 2);
  assert.equal(num0.label, 'Num 0');
  assert.equal(numDot.label, 'Num .');

  assert.equal(mainEnter.label, 'Enter');
  assert.equal(mainEnter.group, 1);
  assert.equal(numEnter.label, 'Num Ent');
  assert.equal(numEnter.group, 2);

  assert.equal(leftCtrl.label, 'Ctrl');
  assert.equal(rightCtrl.label, 'Ctrl R');
  assert.equal(rightCtrl.group, 1);
});

test('createHidFeedbackController decouples diagnostic sampling from UI output notifications and handles close', () => {
  const diagnostics = [];
  const feedbacks = [];
  const scheduled = [];
  let timerSeq = 1;

  const controller = helpers.createHidFeedbackController({
    onDiagnostic: d => diagnostics.push(d),
    onFeedback: f => feedbacks.push(f),
    debounceMs: 80,
    setTimeoutFn: fn => {
      const id = timerSeq++;
      scheduled.push({id, fn, active: true});
      return id;
    },
    clearTimeoutFn: id => {
      const entry = scheduled.find(item => item.id === id);
      if (entry) entry.active = false;
    }
  });

  // Burst 1: 15 outputs (exceeds diagnostic threshold of 8)
  for (let i = 0; i < 15; i++) controller.recordOutput({reportId: 0, bytes: 64});
  assert.equal(diagnostics.length, 8);
  assert.equal(feedbacks.length, 0);

  // Fire debounced timer -> UI gets notified even though count is 15!
  scheduled.filter(t => t.active).forEach(t => { t.active = false; t.fn(); });
  assert.equal(feedbacks.length, 1);
  assert.equal(feedbacks[0].event, 'hid-output');
  assert.equal(feedbacks[0].count, 15);

  // Burst 2: outputs 16..25 -> still 0 new diagnostic logs, but UI MUST still get notified
  for (let i = 0; i < 10; i++) controller.recordOutput({reportId: 0, bytes: 64});
  assert.equal(diagnostics.length, 8);
  scheduled.filter(t => t.active).forEach(t => { t.active = false; t.fn(); });
  assert.equal(feedbacks.length, 2);
  assert.equal(feedbacks[1].count, 25);

  // Close event cancels pending debounce and immediately notifies both channels
  controller.recordOutput({reportId: 0, bytes: 64});
  controller.recordClose({name: 'THUNDER 68', vendorId: 0x369b, productId: 0x0211});
  assert.equal(diagnostics[diagnostics.length - 1].event, 'hid-close');
  assert.equal(feedbacks[feedbacks.length - 1].event, 'hid-close');
  assert.equal(scheduled.filter(t => t.active).length, 0);
});

test('classifyFeedbackEvent separates page script errors from USB HID errors', () => {
  assert.equal(helpers.classifyFeedbackEvent({event: 'page-error'}), 'page-error');
  assert.equal(helpers.classifyFeedbackEvent({event: 'page-rejection'}), 'page-error');
  assert.equal(helpers.classifyFeedbackEvent({event: 'hid-send-error'}), 'hid-error');
  assert.equal(helpers.classifyFeedbackEvent({event: 'hid-open-error'}), 'hid-error');
  assert.equal(helpers.classifyFeedbackEvent({event: 'hid-close'}), 'hid-close');
  assert.equal(helpers.classifyFeedbackEvent({event: 'hid-output'}), 'hid-output');
});

test('createVerifyStateMachine prevents stale redux-persist false positives and completes only after real reconnect', () => {
  const vm = helpers.createVerifyStateMachine({settleMs: 700});
  vm.start('sig-expected');

  // Before disconnect/reconnect, observing the same stale signature MUST NOT complete
  vm.observeConfig('sig-expected', 1000);
  assert.deepEqual(
    vm.evaluate({connectedPage: true, deviceOpened: true, busy: false, reading: false, keyCount: 68, now: 2500}),
    {done: false}
  );

  // Step 1: leave config page / close device
  assert.equal(vm.onLeftConfigOrClosed(), true);
  vm.markConnectTriggered();
  assert.equal(vm.getState().phase, 'waiting-frame');

  // Step 2: real device open resets observed signature & stableAt
  vm.onDeviceOpened();
  assert.equal(vm.getState().observedSignature, '');
  assert.equal(vm.getState().stableAt, 0);

  // Step 3: fresh HID frame + new config arrives
  vm.onFreshHidActivity();
  vm.observeConfig('sig-expected', 3000);

  // Not yet settled (< 700ms)
  assert.deepEqual(
    vm.evaluate({connectedPage: true, deviceOpened: true, busy: false, reading: false, keyCount: 68, now: 3500}),
    {done: false}
  );

  // Settled (>= 700ms) -> succeeds accurately
  const res = vm.evaluate({connectedPage: true, deviceOpened: true, busy: false, reading: false, keyCount: 68, now: 3800});
  assert.equal(res.done, true);
  assert.equal(res.matched, true);
  assert.equal(vm.getState().active, false);

  // Mismatch scenario
  vm.start('sig-old');
  vm.onLeftConfigOrClosed();
  vm.onDeviceOpened();
  vm.onFreshHidActivity();
  vm.observeConfig('sig-different', 5000);
  const mismatch = vm.evaluate({connectedPage: true, deviceOpened: true, busy: false, reading: false, keyCount: 68, now: 5800});
  assert.equal(mismatch.done, true);
  assert.equal(mismatch.matched, false);

  // Abort cleanly resets active flag
  vm.start('sig-abort');
  assert.equal(vm.getState().active, true);
  vm.abort();
  assert.equal(vm.getState().active, false);
  assert.equal(vm.getState().phase, 'idle');
});

test('classifyConnectionError separates troubleshooting categories including unsupported-model', () => {
  const noDev = helpers.classifyConnectionError({event: 'hid-request-result', count: 0, discoveryReason: 'no-device'});
  assert.equal(noDev.code, 'no-device');
  assert.ok(noDev.steps.length >= 2);
  assert.match(noDev.steps.join(' '), /蓝牙/);

  const bt = helpers.classifyConnectionError({event: 'hid-request-result', count: 0, discoveryReason: 'bluetooth-unsupported'});
  assert.equal(bt.code, 'bluetooth-unsupported');
  assert.match(bt.title, /蓝牙/);

  const otherModel = helpers.classifyConnectionError({event: 'hid-request-result', count: 0, discoveryReason: 'unsupported-model'});
  assert.equal(otherModel.code, 'unsupported-model');
  assert.match(otherModel.title, /其他型号/);

  const busyByName = helpers.classifyConnectionError({event: 'hid-open-error', errorName: 'NotAllowedError', message: 'Failed to open the device.'});
  assert.equal(busyByName.code, 'device-busy');
  assert.equal(busyByName.errorName, 'NotAllowedError');

  const busyByMsg = helpers.classifyConnectionError({event: 'hid-open-error', errorName: 'DOMException', message: 'Access is denied (in use)'});
  assert.equal(busyByMsg.code, 'device-busy');

  const commErr = helpers.classifyConnectionError({event: 'hid-send-error', errorName: 'NetworkError', message: 'Transfer failed'});
  assert.equal(commErr.code, 'hid-comm-failed');

  const timeoutErr = helpers.classifyConnectionError({timeout: true});
  assert.equal(timeoutErr.code, 'hid-comm-failed');
  assert.match(timeoutErr.title, /超时/);
});

test('formatSanitizedRendererReport redacts personal paths, deviceSN, and serialNumber', () => {
  const text = helpers.formatSanitizedRendererReport({
    meta: {appVersion: '0.2.2', dataDir: 'C:\\Users\\Alice\\data'},
    entries: [{event: 'hid-open-error', message: 'failed deviceSN=SN123456 serialNumber:ABC-999 /home/bob/x'}]
  });
  assert.equal(text.includes('Alice'), false);
  assert.equal(text.includes('bob'), false);
  assert.equal(text.includes('SN123456'), false);
  assert.equal(text.includes('ABC-999'), false);
  assert.match(text, /deviceSN=<redacted>/);
  assert.match(text, /serialNumber=<redacted>/);
});

test('isSupportedHotplugDevice and getTravelBadgePalette validate hotplug devices and theme contrast', () => {
  assert.equal(helpers.isSupportedHotplugDevice({vendorId: 0x369b, productId: 0x0211, collections: [{usagePage: 0xff60, usage: 0x61}]}), true);
  assert.equal(helpers.isSupportedHotplugDevice({vendorId: 0x369b, productId: 0x0434, collections: [{usagePage: 0xffa0, usage: 2}]}), true);
  assert.equal(helpers.isSupportedHotplugDevice({vendorId: 0x369b, productId: 0x0211, collections: [{usagePage: 1, usage: 6}]}), false);
  assert.equal(helpers.isSupportedHotplugDevice({vendorId: 0x046d, productId: 0x0211}), false);

  const darkPalette = helpers.getTravelBadgePalette('dark');
  const lightPalette = helpers.getTravelBadgePalette('light');
  assert.notEqual(darkPalette.bg, lightPalette.bg);
  assert.notEqual(darkPalette.travel, lightPalette.travel);
  assert.match(darkPalette.bg, /17,\s*18,\s*20/);
});

test('createSyncScheduler coalesces frame bursts, throttles during busy readback, and snaps on exit', () => {
  let now = 1000;
  let busy = false;
  let runs = 0;
  let seq = 1;
  const rafQueue = [];
  const timers = [];

  const scheduler = helpers.createSyncScheduler({
    run: () => { runs++; },
    isBusy: () => busy,
    busyIntervalMs: 140,
    now: () => now,
    raf: fn => {
      const id = seq++;
      rafQueue.push({id, fn, active: true});
      return id;
    },
    cancelRaf: id => {
      const item = rafQueue.find(entry => entry.id === id);
      if (item) item.active = false;
    },
    setTimeoutFn: (fn, delay) => {
      const id = seq++;
      timers.push({id, fn, delay, active: true});
      return id;
    },
    clearTimeoutFn: id => {
      const item = timers.find(entry => entry.id === id);
      if (item) item.active = false;
    }
  });

  // 10 rapid triggers in one frame coalesce into a single rAF run
  for (let i = 0; i < 10; i++) scheduler.schedule();
  assert.equal(rafQueue.filter(entry => entry.active).length, 1);
  rafQueue.shift().fn();
  assert.equal(runs, 1);

  // Enter busy readback: packet burst within 140ms schedules a single throttled timer instead of flooding rAF
  busy = true;
  now = 1020;
  for (let i = 0; i < 20; i++) scheduler.schedule();
  assert.equal(rafQueue.filter(entry => entry.active).length, 0);
  assert.equal(timers.filter(entry => entry.active).length, 1);

  // When throttle timer fires, it enqueues 1 rAF run
  now = 1150;
  const activeTimer = timers.find(entry => entry.active);
  activeTimer.active = false;
  activeTimer.fn();
  assert.equal(rafQueue.filter(entry => entry.active).length, 1);
  rafQueue.pop().fn();
  assert.equal(runs, 2);

  // Another busy burst queues timer, then busy ends -> immediately cancels timer and runs on next rAF
  now = 1170;
  scheduler.schedule();
  assert.equal(timers.filter(entry => entry.active).length, 1);
  busy = false;
  now = 1185;
  scheduler.schedule();
  assert.equal(timers.filter(entry => entry.active).length, 0);
  assert.equal(rafQueue.filter(entry => entry.active).length, 1);
  rafQueue.pop().fn();
  assert.equal(runs, 3);
});

test('createSyncScheduler degrades to low-frequency setTimeout when hidden so tray sync never freezes', () => {
  let now = 2000;
  let hidden = false;
  let runs = 0;
  let seq = 1;
  const rafQueue = [];
  const timers = [];

  const scheduler = helpers.createSyncScheduler({
    run: () => { runs++; },
    isBusy: () => false,
    isHidden: () => hidden,
    hiddenIntervalMs: 250,
    now: () => now,
    raf: fn => {
      const id = seq++;
      rafQueue.push({id, fn, active: true});
      return id;
    },
    cancelRaf: id => {
      const item = rafQueue.find(entry => entry.id === id);
      if (item) item.active = false;
    },
    setTimeoutFn: (fn, delay) => {
      const id = seq++;
      timers.push({id, fn, delay, active: true});
      return id;
    },
    clearTimeoutFn: id => {
      const item = timers.find(entry => entry.id === id);
      if (item) item.active = false;
    }
  });

  // Schedule while visible -> queues rAF
  scheduler.schedule();
  assert.equal(rafQueue.filter(entry => entry.active).length, 1);

  // Minimize to tray (hidden = true) -> cancels stalled rAF and degrades to setTimeout
  hidden = true;
  scheduler.schedule();
  assert.equal(rafQueue.filter(entry => entry.active).length, 0);
  assert.equal(timers.filter(entry => entry.active).length, 1);
  assert.equal(timers[0].delay, 250);

  // Burst while hidden coalesces into the single timer
  for (let i = 0; i < 10; i++) scheduler.schedule();
  assert.equal(timers.filter(entry => entry.active).length, 1);
  assert.equal(rafQueue.filter(entry => entry.active).length, 0);

  // Timer fires directly without needing rAF -> runs updates (battery alert & busy state!)
  now = 2250;
  timers[0].active = false;
  timers[0].fn();
  assert.equal(runs, 1);
});

test('formatReadProgressText reports live HID frame progress cleanly', () => {
  assert.match(helpers.formatReadProgressText({receivedFrames: 42, readStartFrames: 10, keyCount: 68}), /已同步 32 帧/);
  assert.match(helpers.formatReadProgressText({receivedFrames: 0, readStartFrames: 0, keyCount: 24}), /24\/68 键/);
  assert.match(helpers.formatReadProgressText({receivedFrames: 5, readStartFrames: 5, keyCount: 0}), /正在读取键盘配置/);
});

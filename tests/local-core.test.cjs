const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const {
  LOCAL_ORIGIN,
  isKeyboard,
  isConfigInterface,
  classifyHidDiscovery,
  redactSensitiveText,
  sanitizeDiagnosticEntry,
  formatSanitizedDiagnosticReport,
  isAllowedOrigin,
  isAllowedRequestUrl,
  validateVendorPath,
  resolveAsset,
  getContentType,
  getDeviceConnectionKind,
  formatDeviceChoice,
  resolveWritableDataDir,
  shouldPackageAppFile,
  normalizePreferences,
  mergePreferences,
  loadPreferencesSync,
  savePreferencesSync,
  resolveEffectiveTheme,
  getThemeWindowChrome,
  injectInitialThemeIntoHtml,
  sanitizeWindowBounds,
  shouldTriggerLowBatteryAlert
} = require('../app/local-core.cjs');

const root = path.resolve(__dirname, '../app/vendor');

test('Only the supported Thunder68 devices receive HID access', () => {
  assert.equal(isKeyboard({vendorId: 0x369b, productId: 0x211}), true);
  assert.equal(isKeyboard({vendorId: 0x369b, productId: 0x434}), true);
  assert.equal(isKeyboard({vendorId: 0x3554, productId: 0xfa09}), false);
  assert.equal(isKeyboard({vendorId: 0x369b, productId: 0x2b1}), false);
  assert.equal(isConfigInterface({vendorId: 0x369b, productId: 0x211, collections: [{usagePage: 0xff60, usage: 0x61}]}), true);
  assert.equal(isConfigInterface({vendorId: 0x369b, productId: 0x434, collections: [{usagePage: 0xffa0, usage: 2}]}), true);
  assert.equal(isConfigInterface({vendorId: 0x369b, productId: 0x211, collections: [{usagePage: 1, usage: 6}]}), false);
});

test('Offline routes resolve to local assets and reject other origins and traversal', () => {
  assert.equal(resolveAsset(root, LOCAL_ORIGIN + '/thunder68/index/keymap'), path.join(root, 'thunder68/index.html'));
  assert.equal(resolveAsset(root, LOCAL_ORIGIN + '/thunder68/plus.png'), path.join(root, 'thunder68/plus.png'));
  for (const url of [
    'https://example.com/thunder68/plus.png',
    LOCAL_ORIGIN + '/data/secret',
    LOCAL_ORIGIN + '/thunder68/%2e%2e%5csecret',
    LOCAL_ORIGIN + '/thunder68/%2e%2e/secret',
    LOCAL_ORIGIN + '/thunder68/%00',
    LOCAL_ORIGIN + '/thunder68/%ZZ',
    'not-a-valid-url'
  ]) {
    assert.equal(resolveAsset(root, url), null, url);
  }
});

test('Origin and request URL checks are unified and strict', () => {
  assert.equal(isAllowedOrigin(LOCAL_ORIGIN), true);
  assert.equal(isAllowedOrigin(LOCAL_ORIGIN + '/'), true);
  assert.equal(isAllowedOrigin('https://oem.dareu.com'), false);
  assert.equal(isAllowedOrigin('thunder68://driver.evil'), false);
  assert.equal(isAllowedOrigin(null), false);

  assert.equal(isAllowedRequestUrl(LOCAL_ORIGIN + '/thunder68/'), true);
  assert.equal(isAllowedRequestUrl('data:image/png;base64,AAA'), true);
  assert.equal(isAllowedRequestUrl('blob:thunder68://driver/123'), true);
  assert.equal(isAllowedRequestUrl('https://oem.dareu.com/thunder68/'), false);
  assert.equal(isAllowedRequestUrl(LOCAL_ORIGIN), false);
});

test('validateVendorPath blocks traversal, backslashes, null bytes and outside paths', () => {
  assert.equal(validateVendorPath(root, '/thunder68/static/js/main.js'), path.join(root, 'thunder68/static/js/main.js'));
  for (const bad of [
    '',
    '/other/a.png',
    '/thunder68/../manifest.json',
    '/thunder68/./a.png',
    '/thunder68/%2e%2e/evil.js',
    '/thunder68/foo\\bar.png',
    '/thunder68/a%00.png',
    '/thunder68/%E0%A4%A'
  ]) {
    assert.equal(validateVendorPath(root, bad), null, bad);
  }
});

test('Device selection labels distinguish wired, 2.4G dongle, and duplicate PIDs', () => {
  const wired = {name: 'THUNDER 68', vendorId: 0x369b, productId: 0x0211};
  const dongle = {name: 'THUNDER 68', vendorId: 0x369b, productId: 0x0434};
  assert.equal(getDeviceConnectionKind(wired), 'USB 有线');
  assert.equal(getDeviceConnectionKind(dongle), '2.4G 接收器');

  const mixed = [wired, dongle];
  const labelWired = formatDeviceChoice(wired, 0, mixed);
  const labelDongle = formatDeviceChoice(dongle, 1, mixed);
  assert.match(labelWired, /USB 有线.*0x0211/);
  assert.match(labelDongle, /2\.4G 接收器.*0x0434/);
  assert.notEqual(labelWired, labelDongle);

  const dupes = [
    {name: 'THUNDER 68', productId: 0x0211, serialNumber: 'SN000111'},
    {name: 'THUNDER 68', productId: 0x0211}
  ];
  assert.match(formatDeviceChoice(dupes[0], 0, dupes), /\[000111\]$/);
  assert.match(formatDeviceChoice(dupes[1], 1, dupes), /#2$/);
  assert.notEqual(formatDeviceChoice(dupes[0], 0, dupes), formatDeviceChoice(dupes[1], 1, dupes));
});

test('resolveWritableDataDir falls back when preferred directory is read-only', () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'thunder68-datadir-'));
  try {
    const preferred = path.join(tmpBase, 'preferred');
    const fallback = path.join(tmpBase, 'fallback');

    const okResult = resolveWritableDataDir(preferred, fallback);
    assert.equal(okResult.dir, preferred);
    assert.equal(okResult.fallbackUsed, false);
    assert.equal(okResult.error, null);

    const fakeFs = {
      mkdirSync(dir, opts) {
        if (dir === preferred) throw Object.assign(new Error('EACCES'), {code: 'EACCES'});
        return fs.mkdirSync(dir, opts);
      },
      writeFileSync: fs.writeFileSync,
      unlinkSync: fs.unlinkSync
    };
    const fbResult = resolveWritableDataDir(preferred, fallback, fakeFs);
    assert.equal(fbResult.dir, fallback);
    assert.equal(fbResult.fallbackUsed, true);
    assert.equal(fbResult.error.code, 'EACCES');
  } finally {
    fs.rmSync(tmpBase, {recursive: true, force: true});
  }
});

test('getContentType normalizes extension case and defaults safely', () => {
  assert.equal(getContentType('INDEX.HTML'), 'text/html; charset=utf-8');
  assert.equal(getContentType('icon.PNG'), 'image/png');
  assert.equal(getContentType('bundle.Js'), 'application/javascript; charset=utf-8');
  assert.equal(getContentType('unknown.bin'), 'application/octet-stream');
});

test('shouldPackageAppFile excludes debug audit and obsolete files', () => {
  assert.equal(shouldPackageAppFile('redesign-audit.cjs'), false);
  assert.equal(shouldPackageAppFile('keyboard-layout.json'), false);
  assert.equal(shouldPackageAppFile('main.cjs'), true);
  assert.equal(shouldPackageAppFile('shell-helpers.js'), true);
  assert.equal(shouldPackageAppFile('vendor/thunder68/index.html'), true);
});

test('classifyHidDiscovery distinguishes ready, bluetooth-unsupported, and no-device', () => {
  const ready = classifyHidDiscovery([
    {name: 'THUNDER 68', vendorId: 0x369b, productId: 0x0211, collections: [{usagePage: 0xff60, usage: 0x61}]}
  ]);
  assert.equal(ready.reason, 'ready');
  assert.equal(ready.configCandidatesCount, 1);

  const btByName = classifyHidDiscovery([
    {name: 'THUNDER 68 BT5.0', vendorId: 0x0a5c, productId: 0x8502, collections: [{usagePage: 1, usage: 6}]}
  ]);
  assert.equal(btByName.reason, 'bluetooth-unsupported');
  assert.equal(btByName.suspectedBluetoothCount, 1);

  const btSameVendor = classifyHidDiscovery([
    {name: 'DAREU Keyboard', vendorId: 0x369b, productId: 0x0211, collections: [{usagePage: 1, usage: 6}]}
  ]);
  assert.equal(btSameVendor.reason, 'bluetooth-unsupported');
  assert.equal(btSameVendor.sameVendorNonConfigCount, 1);

  const empty = classifyHidDiscovery([
    {name: 'Generic Mouse', vendorId: 0x046d, productId: 0xc52b, collections: [{usagePage: 1, usage: 2}]}
  ]);
  assert.equal(empty.reason, 'no-device');
  assert.equal(empty.configCandidatesCount, 0);
});

test('diagnostic sanitization redacts personal paths and drops unwhitelisted/keystroke fields', () => {
  assert.equal(
    redactSensitiveText('Failed at C:\\Users\\Alice\\AppData\\data deviceSN=SN998877'),
    'Failed at C:\\Users\\<redacted>\\AppData\\data deviceSN=<redacted>'
  );
  const safe = sanitizeDiagnosticEntry({
    event: 'hid-open-error',
    errorName: 'NotAllowedError',
    message: 'Cannot open C:\\Users\\Bob\\driver',
    typedKey: 'SecretPassword123',
    key: 'a',
    vendorId: 0x369b
  });
  assert.equal(safe.event, 'hid-open-error');
  assert.equal(safe.errorName, 'NotAllowedError');
  assert.equal(safe.message, 'Cannot open C:\\Users\\<redacted>\\driver');
  assert.equal(safe.vendorId, 0x369b);
  assert.equal('typedKey' in safe, false);
  assert.equal('key' in safe, false);

  const reportText = formatSanitizedDiagnosticReport({
    meta: {appVersion: '0.2.1', dataDir: 'C:\\Users\\Alice\\qudong\\data'},
    stats: {opens: 1, errors: 1},
    entries: [{event: 'hid-open-error', errorName: 'NotAllowedError', typedText: 'MUST_NOT_LEAK'}]
  });
  assert.equal(reportText.includes('Alice'), false);
  assert.equal(reportText.includes('MUST_NOT_LEAK'), false);
  assert.equal(reportText.includes('NotAllowedError'), true);
});

test('preferences persistence, clamping, anti-flash theme chrome, and HTML injection work cleanly', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'thunder68-prefs-'));
  try {
    const file = path.join(tmp, 'preferences.json');
    const defaults = loadPreferencesSync(file);
    assert.equal(defaults.themeChoice, 'system');
    assert.equal(defaults.minimizeToTray, true);
    assert.equal(defaults.windowBounds.width, 1400);

    const saved = savePreferencesSync(file, mergePreferences(defaults, {
      themeChoice: 'light',
      minimizeToTray: false,
      lowBatteryThreshold: 99, // clamped to 50
      windowBounds: {width: 800, height: 1000, x: 100, y: 120, maximized: true},
      globalShortcuts: {toggleWindow: 'CommandOrControl+Shift+T'}
    }));
    assert.equal(saved.themeChoice, 'light');
    assert.equal(saved.minimizeToTray, false);
    assert.equal(saved.lowBatteryThreshold, 50);
    assert.equal(saved.windowBounds.width, 1024); // clamped to minWidth

    const reloaded = loadPreferencesSync(file);
    assert.deepEqual(reloaded, saved);

    // Anti-flash chrome & HTML attribute injection
    assert.equal(resolveEffectiveTheme('light', true), 'light');
    assert.equal(resolveEffectiveTheme('system', false), 'light');
    assert.equal(resolveEffectiveTheme('system', true), 'dark');
    assert.equal(getThemeWindowChrome('light').backgroundColor, '#f5f6f7');
    assert.equal(getThemeWindowChrome('dark').backgroundColor, '#111214');

    const injected = injectInitialThemeIntoHtml('<!doctype html><html lang="en"><head></head></html>', 'light', 'light');
    assert.match(injected, /<html data-theme="light" data-theme-choice="light" lang="en">/);
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
});

test('sanitizeWindowBounds drops offscreen coordinates and keeps visible multi-monitor bounds', () => {
  const displays = [{x: 0, y: 0, width: 1920, height: 1040}];
  const visible = sanitizeWindowBounds({x: 100, y: 80, width: 1400, height: 940, maximized: false}, displays);
  assert.equal(visible.x, 100);
  assert.equal(visible.y, 80);

  const offscreen = sanitizeWindowBounds({x: 3200, y: 100, width: 1400, height: 940, maximized: false}, displays);
  assert.equal('x' in offscreen, false);
  assert.equal('y' in offscreen, false);
  assert.equal(offscreen.width, 1400);
});

test('shouldTriggerLowBatteryAlert applies hysteresis and only triggers for 2.4G wireless mode', () => {
  // Wired mode never alerts
  assert.deepEqual(
    shouldTriggerLowBatteryAlert({enabled: true, threshold: 20, isWireless: false, battery: 10, alreadyNotified: false}),
    {notify: false, nextNotified: false}
  );
  // First drop below threshold alerts once
  const first = shouldTriggerLowBatteryAlert({enabled: true, threshold: 20, isWireless: true, battery: 18, alreadyNotified: false});
  assert.deepEqual(first, {notify: true, nextNotified: true});
  // Repeated readings stay muted
  const second = shouldTriggerLowBatteryAlert({enabled: true, threshold: 20, isWireless: true, battery: 15, alreadyNotified: true});
  assert.deepEqual(second, {notify: false, nextNotified: true});
  // Within hysteresis deadband (22% < 25%) remains armed
  const deadband = shouldTriggerLowBatteryAlert({enabled: true, threshold: 20, isWireless: true, battery: 22, alreadyNotified: true});
  assert.deepEqual(deadband, {notify: false, nextNotified: true});
  // Recharged >= threshold + 5 resets state
  const charged = shouldTriggerLowBatteryAlert({enabled: true, threshold: 20, isWireless: true, battery: 30, alreadyNotified: true});
  assert.deepEqual(charged, {notify: false, nextNotified: false});
});

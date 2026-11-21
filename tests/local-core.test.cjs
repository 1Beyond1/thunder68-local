const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const {
  LOCAL_ORIGIN,
  isKeyboard,
  isConfigInterface,
  isAllowedOrigin,
  isAllowedRequestUrl,
  validateVendorPath,
  resolveAsset,
  getContentType,
  getDeviceConnectionKind,
  formatDeviceChoice,
  resolveWritableDataDir,
  shouldPackageAppFile
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

test('All captured vendor resources match their downloaded hash', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  assert.ok(manifest.files.length > 100);
  assert.equal(manifest.failed.filter(f => /\.(css|js)$/.test(f.path)).length, 0);
  for (const asset of manifest.files) {
    const runtimeFile = resolveAsset(root, LOCAL_ORIGIN + asset.path);
    assert.ok(runtimeFile, asset.path);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(runtimeFile)).digest('hex'), asset.sha256, asset.path);
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

const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const {LOCAL_ORIGIN, isKeyboard, isConfigInterface, resolveAsset} = require('../app/local-core.cjs');
const root = path.resolve(__dirname, '../app/vendor');
test('Only the supported Thunder68 devices receive HID access', () => {
  assert.equal(isKeyboard({vendorId: 0x369b, productId: 0x211}), true);
  assert.equal(isKeyboard({vendorId: 0x369b, productId: 0x434}), true);
  assert.equal(isKeyboard({vendorId: 0x3554, productId: 0xfa09}), false);
  assert.equal(isKeyboard({vendorId: 0x369b, productId: 0x2b1}), false);
  assert.equal(isConfigInterface({vendorId: 0x369b, productId: 0x211, collections: [{usagePage: 0xff60, usage: 0x61}]}), true);
  assert.equal(isConfigInterface({vendorId: 0x369b, productId: 0x211, collections: [{usagePage: 1, usage: 6}]}), false);
});
test('Offline routes resolve to local assets and reject other origins and traversal', () => {
  assert.equal(resolveAsset(root, LOCAL_ORIGIN + '/thunder68/index/keymap'), path.join(root, 'thunder68/index.html'));
  assert.equal(resolveAsset(root, LOCAL_ORIGIN + '/thunder68/plus.png'), path.join(root, 'thunder68/plus.png'));
  for (const url of ['https://example.com/thunder68/plus.png', LOCAL_ORIGIN + '/data/secret', LOCAL_ORIGIN + '/thunder68/%2e%2e%5csecret', LOCAL_ORIGIN + '/thunder68/%00', LOCAL_ORIGIN + '/thunder68/%ZZ']) assert.equal(resolveAsset(root, url), null);
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

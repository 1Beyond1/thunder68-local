const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const {LOCAL_ORIGIN, resolveAsset} = require('../app/local-core.cjs');

const vendorRoot = path.resolve(__dirname, '../app/vendor');
const manifestPath = path.join(vendorRoot, 'manifest.json');

test('All locally synced vendor resources match their manifest SHA256 hashes', () => {
  assert.equal(
    fs.existsSync(manifestPath),
    true,
    '缺少 app/vendor/manifest.json，请先执行 npm run sync 获取本地官方资产'
  );
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.ok(manifest.files.length > 100);
  assert.equal(manifest.failed.filter(f => /\.(css|js)$/.test(f.path)).length, 0);
  for (const asset of manifest.files) {
    const runtimeFile = resolveAsset(vendorRoot, LOCAL_ORIGIN + asset.path);
    assert.ok(runtimeFile, asset.path);
    assert.equal(
      crypto.createHash('sha256').update(fs.readFileSync(runtimeFile)).digest('hex'),
      asset.sha256,
      asset.path
    );
  }
});

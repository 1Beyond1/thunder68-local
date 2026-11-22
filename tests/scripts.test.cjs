const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {discoverAssetPaths, createManifestEntry, planStaleFiles} = require('../scripts/sync-official.cjs');
const {
  verifyBuildPrerequisites,
  mirrorAppDirectory,
  pruneLocalesDirectory,
  shouldKeepLocaleFile,
  measureDirectory
} = require('../scripts/build-portable.cjs');
const {runPackageAudit} = require('../scripts/audit-package.cjs');
const {findForbiddenTrackedFiles} = require('../scripts/check-compliance.cjs');

test('sync-official discovers local assets, builds index.html manifest entry, and plans stale cleanup', () => {
  const html = `
    <link href="/thunder68/static/css/app.css" rel="stylesheet">
    <script src="/thunder68/static/js/app.js"></script>
    <img src="data:image/png;base64,abc">
    <img src="https://evil.example/thunder68/hack.png">
    <style>body{background:url(imgs/bg.png)}</style>
  `;
  const found = discoverAssetPaths(html, 'https://oem.dareu.com/thunder68/');
  assert.equal(found.has('/thunder68/static/css/app.css'), true);
  assert.equal(found.has('/thunder68/static/js/app.js'), true);
  assert.equal(found.has('/thunder68/imgs/bg.png'), true);
  assert.equal([...found].some(p => p.includes('hack.png')), false);

  const entry = createManifestEntry('/thunder68/index.html', '/thunder68/index.html', '/thunder68', Buffer.from('<html></html>'));
  assert.equal(entry.path, '/thunder68/index.html');
  assert.equal(entry.bytes, 13);
  assert.equal(entry.sha256.length, 64);

  const stale = planStaleFiles(
    ['/vendor/thunder68/index.html', '/vendor/thunder68/old.png', '/vendor/thunder68/keep.js'],
    ['/vendor/thunder68/index.html', '/vendor/thunder68/keep.js']
  );
  assert.deepEqual(stale, ['/vendor/thunder68/old.png']);
});

test('build-portable validates prerequisites and mirrors app while pruning orphans and excluded files', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'thunder68-build-'));
  try {
    assert.throws(() => verifyBuildPrerequisites(tmp), /构建前置依赖缺失/);

    const srcApp = path.join(tmp, 'src-app');
    const dstApp = path.join(tmp, 'dst-app');
    fs.mkdirSync(path.join(srcApp, 'vendor/thunder68'), {recursive: true});
    fs.writeFileSync(path.join(srcApp, 'main.cjs'), 'main-v1');
    fs.writeFileSync(path.join(srcApp, 'redesign-audit.cjs'), 'debug-only');
    fs.writeFileSync(path.join(srcApp, 'keyboard-layout.json'), 'obsolete');
    fs.writeFileSync(path.join(srcApp, 'vendor/thunder68/index.html'), '<html></html>');

    // Seed target with an orphan file and previously leaked debug file
    fs.mkdirSync(path.join(dstApp, 'stale-dir'), {recursive: true});
    fs.writeFileSync(path.join(dstApp, 'stale-dir/orphan.txt'), 'old');
    fs.writeFileSync(path.join(dstApp, 'redesign-audit.cjs'), 'old-debug');

    const result = mirrorAppDirectory(srcApp, dstApp);
    assert.equal(result.total, 2);
    assert.equal(result.copied, 2);
    assert.equal(result.removed, 2);
    assert.equal(fs.existsSync(path.join(dstApp, 'main.cjs')), true);
    assert.equal(fs.existsSync(path.join(dstApp, 'vendor/thunder68/index.html')), true);
    assert.equal(fs.existsSync(path.join(dstApp, 'redesign-audit.cjs')), false);
    assert.equal(fs.existsSync(path.join(dstApp, 'keyboard-layout.json')), false);
    assert.equal(fs.existsSync(path.join(dstApp, 'stale-dir')), false);
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
});

test('audit-package detects excluded debug scripts and orphan files in release/', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'thunder68-audit-'));
  try {
    const appDir = path.join(tmp, 'app');
    const vendorDir = path.join(appDir, 'vendor/thunder68');
    const releaseApp = path.join(tmp, 'release/Thunder68-Local/resources/app/app');
    fs.mkdirSync(vendorDir, {recursive: true});
    fs.mkdirSync(path.join(tmp, 'research'), {recursive: true});
    fs.writeFileSync(path.join(appDir, 'main.cjs'), 'console.log(1);');
    fs.writeFileSync(path.join(appDir, 'redesign-audit.cjs'), 'debugger');
    fs.writeFileSync(path.join(vendorDir, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(appDir, 'vendor/manifest.json'), JSON.stringify({files: [], failed: []}));
    fs.writeFileSync(path.join(tmp, 'research/asset-paths.json'), '[]');

    mirrorAppDirectory(appDir, releaseApp);
    const cleanReport = runPackageAudit(tmp);
    assert.deepEqual(cleanReport.issues, []);

    // Inject forbidden debug script & orphan into release
    fs.writeFileSync(path.join(releaseApp, 'redesign-audit.cjs'), 'debugger');
    fs.writeFileSync(path.join(releaseApp, 'leftover.tmp'), 'junk');
    const dirtyReport = runPackageAudit(tmp);
    const kinds = dirtyReport.issues.map(i => i.kind).sort();
    assert.deepEqual(kinds, ['excluded-file-packaged', 'orphan-packaged-file']);
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
});

test('build-portable prunes non-zh-CN/en-US locale packs and reports saved bytes accurately', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'thunder68-locales-'));
  try {
    fs.writeFileSync(path.join(tmp, 'zh-CN.pak'), Buffer.alloc(1024, 1));
    fs.writeFileSync(path.join(tmp, 'en-US.pak'), Buffer.alloc(512, 2));
    fs.writeFileSync(path.join(tmp, 'fr.pak'), Buffer.alloc(2048, 3));
    fs.writeFileSync(path.join(tmp, 'ja.pak'), Buffer.alloc(4096, 4));

    assert.equal(shouldKeepLocaleFile('zh-CN.pak'), true);
    assert.equal(shouldKeepLocaleFile('EN-US.PAK'), true);
    assert.equal(shouldKeepLocaleFile('fr.pak'), false);

    const before = measureDirectory(tmp);
    assert.equal(before.files, 4);
    assert.equal(before.bytes, 1024 + 512 + 2048 + 4096);

    const result = pruneLocalesDirectory(tmp);
    assert.equal(result.removedCount, 2);
    assert.equal(result.removedBytes, 2048 + 4096);
    assert.equal(result.remainingBytes, 1024 + 512);
    assert.deepEqual(result.keptFiles, ['en-US.pak', 'zh-CN.pak']);
    assert.equal(fs.existsSync(path.join(tmp, 'fr.pak')), false);
    assert.equal(fs.existsSync(path.join(tmp, 'zh-CN.pak')), true);
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
});

test('check-compliance detects tracked vendor assets, decoded scripts, and build artifacts', () => {
  const clean = findForbiddenTrackedFiles([
    'app/main.cjs',
    'app/ui.js',
    'research/asset-paths.json',
    'THIRD_PARTY_NOTICES.md'
  ]);
  assert.deepEqual(clean, []);

  const dirty = findForbiddenTrackedFiles([
    'app/main.cjs',
    'app/vendor/manifest.json',
    'app/vendor/thunder68/index.html',
    'research/decoded.js',
    'research/official-main.js',
    'release/Thunder68-Local/Thunder68-Local.exe',
    'data/diagnostics.jsonl'
  ]);
  assert.equal(dirty.length, 6);
  assert.deepEqual(
    dirty.map(v => v.path),
    [
      'app/vendor/manifest.json',
      'app/vendor/thunder68/index.html',
      'research/decoded.js',
      'research/official-main.js',
      'release/Thunder68-Local/Thunder68-Local.exe',
      'data/diagnostics.jsonl'
    ]
  );
});

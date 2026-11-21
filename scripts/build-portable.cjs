const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {shouldPackageAppFile} = require('../app/local-core.cjs');

const hashFile = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(full) : [full];
  });
}

function pruneEmptyDirs(dir, stopAt) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    if (entry.isDirectory()) pruneEmptyDirs(path.join(dir, entry.name), stopAt);
  }
  if (path.resolve(dir) === path.resolve(stopAt)) return;
  if (!fs.readdirSync(dir).length) fs.rmdirSync(dir);
}

function verifyBuildPrerequisites(root) {
  const missing = [];
  const runtimeDir = path.join(root, 'node_modules/electron/dist');
  const vendorDir = path.join(root, 'app/vendor');
  const manifestPath = path.join(vendorDir, 'manifest.json');
  const indexHtmlPath = path.join(vendorDir, 'thunder68/index.html');

  if (!fs.existsSync(runtimeDir)) missing.push('node_modules/electron/dist（请先执行 npm install）');
  if (!fs.existsSync(vendorDir)) missing.push('app/vendor（请先执行 npm run sync）');
  if (!fs.existsSync(manifestPath)) missing.push('app/vendor/manifest.json（请先执行 npm run sync）');
  if (!fs.existsSync(indexHtmlPath)) missing.push('app/vendor/thunder68/index.html（请先执行 npm run sync）');

  if (missing.length) {
    throw new Error('构建前置依赖缺失：\n- ' + missing.join('\n- '));
  }
  return {runtimeDir, vendorDir, manifestPath, indexHtmlPath};
}

function mirrorAppDirectory(sourceAppDir, targetAppDir, filterFn = shouldPackageAppFile) {
  fs.mkdirSync(targetAppDir, {recursive: true});
  const expectedRelatives = new Set();
  let copied = 0;
  let removed = 0;

  for (const srcFile of walkFiles(sourceAppDir)) {
    const relative = path.relative(sourceAppDir, srcFile).replace(/\\/g, '/');
    if (!filterFn(relative)) continue;
    expectedRelatives.add(relative.toLowerCase());
    const dstFile = path.join(targetAppDir, relative);
    fs.mkdirSync(path.dirname(dstFile), {recursive: true});
    if (!fs.existsSync(dstFile) || hashFile(srcFile) !== hashFile(dstFile)) {
      fs.copyFileSync(srcFile, dstFile);
      copied++;
    }
  }

  for (const dstFile of walkFiles(targetAppDir)) {
    const relative = path.relative(targetAppDir, dstFile).replace(/\\/g, '/');
    if (!expectedRelatives.has(relative.toLowerCase())) {
      fs.unlinkSync(dstFile);
      removed++;
    }
  }
  pruneEmptyDirs(targetAppDir, targetAppDir);
  return {copied, removed, total: expectedRelatives.size};
}

function buildPortable(root = path.resolve(__dirname, '..')) {
  const {runtimeDir} = verifyBuildPrerequisites(root);
  const target = path.join(root, 'release/Thunder68-Local');
  fs.mkdirSync(target, {recursive: true});

  const copyChanged = (source, destination) => fs.cpSync(source, destination, {
    recursive: true,
    filter: (src, dst) => {
      if (fs.statSync(src).isDirectory() || !fs.existsSync(dst)) return true;
      return hashFile(src) !== hashFile(dst);
    }
  });

  for (const entry of fs.readdirSync(runtimeDir)) {
    copyChanged(
      path.join(runtimeDir, entry),
      path.join(target, entry === 'electron.exe' ? 'Thunder68-Local.exe' : entry)
    );
  }

  const resources = path.join(target, 'resources/app');
  fs.mkdirSync(resources, {recursive: true});
  const syncResult = mirrorAppDirectory(path.join(root, 'app'), path.join(resources, 'app'));

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  delete pkg.devDependencies;
  delete pkg.scripts;
  fs.writeFileSync(path.join(resources, 'package.json'), JSON.stringify(pkg, null, 2));

  fs.copyFileSync(path.join(root, 'README.md'), path.join(target, '使用说明.md'));
  fs.copyFileSync(path.join(root, 'DEVELOPMENT.md'), path.join(target, '开发说明.md'));
  // Keep Electron's LICENSE intact and label the independently authored code separately.
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(target, 'PROJECT-LICENSE'));
  fs.copyFileSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(target, 'THIRD_PARTY_NOTICES.md'));

  console.log(JSON.stringify({
    executable: path.join(target, 'Thunder68-Local.exe'),
    appSync: syncResult
  }, null, 2));
  return {target, syncResult};
}

if (require.main === module) {
  try {
    buildPortable();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {verifyBuildPrerequisites, mirrorAppDirectory, buildPortable};

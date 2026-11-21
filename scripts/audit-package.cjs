const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {LOCAL_ORIGIN, resolveAsset, shouldPackageAppFile} = require('../app/local-core.cjs');

const hashFile = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(full) : [full];
  });
}

function runPackageAudit(root = path.resolve(__dirname, '..')) {
  const appDir = path.join(root, 'app');
  const vendor = path.join(appDir, 'vendor');
  const release = path.join(root, 'release/Thunder68-Local/resources/app/app');
  const manifest = JSON.parse(fs.readFileSync(path.join(vendor, 'manifest.json'), 'utf8'));
  const issues = [];

  for (const asset of manifest.files) {
    const file = resolveAsset(vendor, LOCAL_ORIGIN + asset.path);
    if (!file || !fs.existsSync(file)) issues.push({kind: 'unresolvable-resource', path: asset.path});
    else if (hashFile(file) !== asset.sha256) issues.push({kind: 'vendor-hash-changed', path: asset.path});
  }

  const indexHtml = path.join(vendor, 'thunder68/index.html');
  if (!fs.existsSync(indexHtml) || fs.statSync(indexHtml).size === 0) {
    issues.push({kind: 'missing-vendor-index', path: '/thunder68/index.html'});
  }

  const expectedPackaged = new Set();
  const allAppFiles = walkFiles(appDir);
  for (const file of allAppFiles) {
    const relative = path.relative(appDir, file).replace(/\\/g, '/');
    if (!shouldPackageAppFile(relative)) continue;
    expectedPackaged.add(relative.toLowerCase());
    const packaged = path.join(release, relative);
    if (!fs.existsSync(packaged) || hashFile(file) !== hashFile(packaged)) {
      issues.push({kind: 'package-differs', path: relative});
    }
  }

  if (!fs.existsSync(release)) {
    issues.push({kind: 'missing-release-app', path: release});
  } else {
    for (const packagedFile of walkFiles(release)) {
      const relative = path.relative(release, packagedFile).replace(/\\/g, '/');
      if (!shouldPackageAppFile(relative)) {
        issues.push({kind: 'excluded-file-packaged', path: relative});
      } else if (!expectedPackaged.has(relative.toLowerCase())) {
        issues.push({kind: 'orphan-packaged-file', path: relative});
      }
    }
  }

  const references = JSON.parse(fs.readFileSync(path.join(root, 'research/asset-paths.json'), 'utf8'));
  for (const reference of references) {
    const urlPath = reference.startsWith('/') ? reference : '/thunder68/' + reference;
    const file = resolveAsset(vendor, LOCAL_ORIGIN + urlPath);
    if (!file || !fs.existsSync(file)) issues.push({kind: 'missing-static-reference', path: reference});
  }

  const report = {
    auditedAt: new Date().toISOString(),
    downloadedResources: manifest.files.length,
    capturedAppFiles: expectedPackaged.size,
    inspectedStaticReferences: references.length,
    downloadFailures: manifest.failed,
    issues,
    limits: [
      'Static reference and package integrity audit; does not prove every runtime feature works.',
      'Online keyboard test (kbtest5.driveall.cn), firmware metadata and DFU download are excluded.',
      'Original React project source and source maps are not available in this capture.'
    ]
  };
  return report;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const report = runPackageAudit(root);
  fs.mkdirSync(path.join(root, 'output'), {recursive: true});
  fs.writeFileSync(path.join(root, 'output/package-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.issues.length || report.downloadFailures.length) process.exitCode = 1;
}

module.exports = {runPackageAudit};

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {LOCAL_ORIGIN, resolveAsset} = require('../app/local-core.cjs');
const root = path.resolve(__dirname, '..');
const vendor = path.join(root, 'app/vendor');
const release = path.join(root, 'release/Thunder68-Local/resources/app/app');
const manifest = JSON.parse(fs.readFileSync(path.join(vendor, 'manifest.json'), 'utf8'));
const issues = [];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const walk = dir => fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
for (const asset of manifest.files) {
  const file = resolveAsset(vendor, LOCAL_ORIGIN + asset.path);
  if (!file || !fs.existsSync(file)) issues.push({kind: 'unresolvable-resource', path: asset.path});
  else if (hash(file) !== asset.sha256) issues.push({kind: 'vendor-hash-changed', path: asset.path});
}
for (const file of walk(path.join(root, 'app'))) {
  const relative = path.relative(path.join(root, 'app'), file);
  const packaged = path.join(release, relative);
  if (!fs.existsSync(packaged) || hash(file) !== hash(packaged)) issues.push({kind: 'package-differs', path: relative});
}
const references = JSON.parse(fs.readFileSync(path.join(root, 'research/asset-paths.json'), 'utf8'));
for (const reference of references) {
  const urlPath = reference.startsWith('/') ? reference : '/thunder68/' + reference;
  const file = resolveAsset(vendor, LOCAL_ORIGIN + urlPath);
  if (!file || !fs.existsSync(file)) issues.push({kind: 'missing-static-reference', path: reference});
}
const report = {auditedAt: new Date().toISOString(), downloadedResources: manifest.files.length,
  capturedAppFiles: walk(path.join(root, 'app')).length, inspectedStaticReferences: references.length,
  downloadFailures: manifest.failed, issues,
  limits: ['Static reference and package integrity audit; does not prove every runtime feature works.',
    'Online keyboard test (kbtest5.driveall.cn), firmware metadata and DFU download are excluded.',
    'Original React project source and source maps are not available in this capture.']};
fs.mkdirSync(path.join(root, 'output'), {recursive: true});
fs.writeFileSync(path.join(root, 'output/package-audit.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (issues.length || manifest.failed.length) process.exitCode = 1;

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const target = path.join(root, 'release/Thunder68-Local');
fs.mkdirSync(target, {recursive: true});
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const copyChanged = (source, destination) => fs.cpSync(source, destination, {recursive: true, filter: (src, dst) => {
  if (fs.statSync(src).isDirectory() || !fs.existsSync(dst)) return true;
  return hash(src) !== hash(dst);
}});
const runtime = path.join(root, 'node_modules/electron/dist');
for (const entry of fs.readdirSync(runtime)) copyChanged(path.join(runtime, entry), path.join(target, entry === 'electron.exe' ? 'Thunder68-Local.exe' : entry));
const resources = path.join(target, 'resources/app');
fs.mkdirSync(resources, {recursive: true});
copyChanged(path.join(root, 'app'), path.join(resources, 'app'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
delete pkg.devDependencies; delete pkg.scripts;
fs.writeFileSync(path.join(resources, 'package.json'), JSON.stringify(pkg, null, 2));
fs.copyFileSync(path.join(root, 'README.md'), path.join(target, '使用说明.md'));
fs.copyFileSync(path.join(root, 'DEVELOPMENT.md'), path.join(target, '开发说明.md'));
// Keep Electron's LICENSE intact and label the independently authored code separately.
fs.copyFileSync(path.join(root, 'LICENSE'), path.join(target, 'PROJECT-LICENSE'));
fs.copyFileSync(path.join(root, 'THIRD_PARTY_NOTICES.md'), path.join(target, 'THIRD_PARTY_NOTICES.md'));
console.log(path.join(target, 'Thunder68-Local.exe'));

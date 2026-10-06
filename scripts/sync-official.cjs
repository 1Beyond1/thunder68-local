const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const origin = 'https://oem.dareu.com';
const root = path.resolve(__dirname, '../app/vendor');
const discovered = new Set();
const failed = [];
const manifest = [];

function discover(text, base) {
  const patterns = [/["'](\/thunder68\/[^"'\s]+\.(?:png|svg|jpg|jpeg|gif|webp|json|woff2?|ttf|css|js))["']/g,
    /["'](static\/media\/[^"'\s]+)["']/g, /(?:src|href)=["']([^"']+)["']/g,
    /url\(\s*["']?([^"')\s]+)["']?\s*\)/g];
  for (const re of patterns) for (const match of text.matchAll(re)) {
    if (match[1].startsWith('data:')) continue;
    const url = new URL(match[1], base);
    if (url.origin === origin && url.pathname.startsWith('/thunder68/')) discovered.add(url.pathname);
  }
}

async function download(urlPath) {
  const localPath = decodeURIComponent(urlPath);
  const local = path.join(root, localPath);
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let data, sourcePath = urlPath;
      try {data = await fs.readFile(local);} catch {
        // Earlier captures stored percent-encoded filenames. Migrate their bytes.
        if (localPath !== urlPath) try {data = await fs.readFile(path.join(root, urlPath));} catch {}
        if (!data) {
        let response = await fetch(origin + urlPath, {signal: AbortSignal.timeout(30000)});
        if (response.status === 404 && urlPath.startsWith('/thunder68/thunder68/')) {
          sourcePath = urlPath.replace('/thunder68/thunder68/', '/thunder68/');
          response = await fetch(origin + sourcePath, {signal: AbortSignal.timeout(30000)});
        }
        if (!response.ok) throw new Error('HTTP ' + response.status);
        data = Buffer.from(await response.arrayBuffer());
        if (/\.(png|svg|woff2?|ttf|json)$/.test(urlPath) && /text\/html/.test(response.headers.get('content-type') || '')) throw new Error('HTML fallback, missing asset');
        }
      }
      await fs.mkdir(path.dirname(local), {recursive: true});
      await fs.writeFile(local, data);
      manifest.push({path: urlPath, localPath, sourcePath, bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex')});
      if (/\.(css|js)$/.test(urlPath)) discover(data.toString('utf8'), origin + urlPath);
      return;
    } catch (error) { lastError = error; }
  }
  failed.push({path: urlPath, error: lastError.message});
}

(async () => {
  await fs.mkdir(root, {recursive: true});
  const response = await fetch(origin + '/thunder68', {signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error('Homepage HTTP ' + response.status);
  const html = await response.text();
  await fs.mkdir(path.join(root, 'thunder68'), {recursive: true});
  await fs.writeFile(path.join(root, 'thunder68/index.html'), html);
  discover(html, origin + '/thunder68/');
  // String-table analysis discovers image paths hidden in the official bundle.
  const paths = JSON.parse(await fs.readFile(path.resolve(__dirname, '../research/asset-paths.json'), 'utf8'));
  paths.forEach(p => discovered.add(p.startsWith('/') ? p : '/thunder68/' + p));
  const completed = new Set();
  for (;;) {
    const todo = [...discovered].filter(p => !completed.has(p));
    if (!todo.length) break;
    for (let i = 0; i < todo.length; i += 8) {
      const batch = todo.slice(i, i + 8); batch.forEach(p => completed.add(p));
      await Promise.all(batch.map(download));
      console.log(`Assets: ${completed.size}/${discovered.size}, failed: ${failed.length}`);
    }
  }
  await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify({source: origin + '/thunder68', capturedAt: new Date().toISOString(), files: manifest, failed}, null, 2));
  console.log(JSON.stringify({downloaded: manifest.length, failed}, null, 2));
  if (failed.length) process.exitCode = 1;
})().catch(error => {console.error(error); process.exitCode = 1;});

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const {validateVendorPath} = require('../app/local-core.cjs');

const ORIGIN = 'https://oem.dareu.com';
const DEFAULT_ROOT = path.resolve(__dirname, '../app/vendor');

function discoverAssetPaths(text, base, origin = ORIGIN) {
  const found = new Set();
  const patterns = [
    /["'](\/thunder68\/[^"'\s]+\.(?:png|svg|jpg|jpeg|gif|webp|json|woff2?|ttf|css|js))["']/g,
    /["'](static\/media\/[^"'\s]+)["']/g,
    /(?:src|href)=["']([^"']+)["']/g,
    /url\(\s*["']?([^"')\s]+)["']?\s*\)/g
  ];
  for (const re of patterns) {
    for (const match of text.matchAll(re)) {
      if (match[1].startsWith('data:')) continue;
      let url;
      try {
        url = new URL(match[1], base);
      } catch {
        continue;
      }
      if (url.origin === origin && url.pathname.startsWith('/thunder68/')) {
        found.add(url.pathname);
      }
    }
  }
  return found;
}

function createManifestEntry(urlPath, localPath, sourcePath, data) {
  return {
    path: urlPath,
    localPath,
    sourcePath,
    bytes: data.length,
    sha256: crypto.createHash('sha256').update(data).digest('hex')
  };
}

function planStaleFiles(existingFiles, expectedFiles) {
  const expectedSet = new Set(expectedFiles.map(file => path.resolve(file).toLowerCase()));
  return existingFiles.filter(file => !expectedSet.has(path.resolve(file).toLowerCase()));
}

async function walkFiles(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, {withFileTypes: true});
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkFiles(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

async function pruneEmptyDirs(dir, stopAt) {
  let entries;
  try {
    entries = await fs.readdir(dir, {withFileTypes: true});
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await pruneEmptyDirs(path.join(dir, entry.name), stopAt);
    }
  }
  if (path.resolve(dir) === path.resolve(stopAt)) return;
  const remaining = await fs.readdir(dir);
  if (!remaining.length) await fs.rmdir(dir);
}

async function runSync({root = DEFAULT_ROOT, force = false} = {}) {
  const discovered = new Set();
  const failed = [];
  const manifest = [];
  const expectedLocalFiles = [];

  async function download(urlPath) {
    const local = validateVendorPath(root, urlPath);
    if (!local) {
      failed.push({path: urlPath, error: 'Invalid or unsafe vendor path'});
      return;
    }
    let localPath;
    try {
      localPath = decodeURIComponent(urlPath);
    } catch {
      failed.push({path: urlPath, error: 'Malformed URI encoding'});
      return;
    }

    let lastError;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        let data;
        let sourcePath = urlPath;
        if (!force) {
          try {
            data = await fs.readFile(local);
          } catch {
            // Earlier captures stored percent-encoded filenames. Migrate their bytes.
            if (localPath !== urlPath) {
              const legacyPath = validateVendorPath(root, encodeURI(urlPath));
              if (legacyPath) {
                try { data = await fs.readFile(legacyPath); } catch {}
              }
            }
          }
        }
        if (!data) {
          let response = await fetch(ORIGIN + urlPath, {signal: AbortSignal.timeout(30000)});
          if (response.status === 404 && urlPath.startsWith('/thunder68/thunder68/')) {
            sourcePath = urlPath.replace('/thunder68/thunder68/', '/thunder68/');
            response = await fetch(ORIGIN + sourcePath, {signal: AbortSignal.timeout(30000)});
          }
          if (!response.ok) throw new Error('HTTP ' + response.status);
          data = Buffer.from(await response.arrayBuffer());
          if (/\.(png|svg|woff2?|ttf|json)$/i.test(urlPath) && /text\/html/i.test(response.headers.get('content-type') || '')) {
            throw new Error('HTML fallback, missing asset');
          }
        }
        await fs.mkdir(path.dirname(local), {recursive: true});
        await fs.writeFile(local, data);
        expectedLocalFiles.push(local);
        manifest.push(createManifestEntry(urlPath, localPath, sourcePath, data));
        if (/\.(css|js)$/i.test(urlPath)) {
          for (const found of discoverAssetPaths(data.toString('utf8'), ORIGIN + urlPath)) {
            discovered.add(found);
          }
        }
        return;
      } catch (error) {
        lastError = error;
      }
    }
    failed.push({path: urlPath, error: lastError.message});
  }

  await fs.mkdir(root, {recursive: true});
  const response = await fetch(ORIGIN + '/thunder68', {signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error('Homepage HTTP ' + response.status);
  const htmlBuffer = Buffer.from(await response.arrayBuffer());
  const html = htmlBuffer.toString('utf8');
  const indexLocal = validateVendorPath(root, '/thunder68/index.html');
  await fs.mkdir(path.dirname(indexLocal), {recursive: true});
  await fs.writeFile(indexLocal, htmlBuffer);
  expectedLocalFiles.push(indexLocal);
  manifest.push(createManifestEntry('/thunder68/index.html', '/thunder68/index.html', '/thunder68', htmlBuffer));

  for (const found of discoverAssetPaths(html, ORIGIN + '/thunder68/')) {
    discovered.add(found);
  }
  // String-table analysis discovers image paths hidden in the official bundle.
  const paths = JSON.parse(await fs.readFile(path.resolve(__dirname, '../research/asset-paths.json'), 'utf8'));
  paths.forEach(p => discovered.add(p.startsWith('/') ? p : '/thunder68/' + p));

  const completed = new Set(['/thunder68/index.html']);
  for (;;) {
    const todo = [...discovered].filter(p => !completed.has(p));
    if (!todo.length) break;
    for (let i = 0; i < todo.length; i += 8) {
      const batch = todo.slice(i, i + 8);
      batch.forEach(p => completed.add(p));
      await Promise.all(batch.map(download));
      console.log(`Assets: ${completed.size}/${discovered.size}, failed: ${failed.length}`);
    }
  }

  let removedStale = [];
  if (force && !failed.length) {
    const thunderDir = path.join(root, 'thunder68');
    const existing = await walkFiles(thunderDir);
    removedStale = planStaleFiles(existing, expectedLocalFiles);
    for (const stale of removedStale) {
      await fs.unlink(stale);
    }
    await pruneEmptyDirs(thunderDir, thunderDir);
  }

  await fs.writeFile(
    path.join(root, 'manifest.json'),
    JSON.stringify({
      source: ORIGIN + '/thunder68',
      capturedAt: new Date().toISOString(),
      files: manifest,
      failed
    }, null, 2)
  );
  console.log(JSON.stringify({downloaded: manifest.length, failed, removedStale: removedStale.length}, null, 2));
  if (failed.length) process.exitCode = 1;
}

if (require.main === module) {
  const force = process.argv.includes('--force');
  runSync({force}).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  ORIGIN,
  discoverAssetPaths,
  createManifestEntry,
  planStaleFiles,
  validateVendorPath,
  runSync
};

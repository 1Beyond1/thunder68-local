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

function canReuseCachedAsset(data, expectedEntry) {
  if (!Buffer.isBuffer(data) || data.length === 0) return false;
  if (!expectedEntry || typeof expectedEntry !== 'object') return false;
  if (typeof expectedEntry.sha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(expectedEntry.sha256)) return false;
  if (typeof expectedEntry.bytes === 'number' && expectedEntry.bytes !== data.length) return false;
  const actualHash = crypto.createHash('sha256').update(data).digest('hex');
  return actualHash.toLowerCase() === expectedEntry.sha256.toLowerCase();
}

function validateFetchedResponse(urlPath, response, data, origin = ORIGIN) {
  if (!response || !response.ok) {
    throw new Error('HTTP ' + (response ? response.status : 'unknown'));
  }
  if (typeof response.url === 'string' && response.url) {
    let finalUrl;
    try {
      finalUrl = new URL(response.url);
    } catch {
      throw new Error('Malformed final response URL');
    }
    if (finalUrl.origin !== origin) {
      throw new Error(`Unexpected cross-origin redirect: ${finalUrl.origin}`);
    }
  }
  if (!Buffer.isBuffer(data) || data.length === 0) {
    throw new Error('Empty response body (0 bytes)');
  }
  const isHtmlPath = /\.html?$/i.test(urlPath) || urlPath === '/thunder68' || urlPath === '/thunder68/';
  const contentType = response.headers?.get ? (response.headers.get('content-type') || '') : '';
  if (!isHtmlPath && /text\/html/i.test(contentType)) {
    throw new Error('HTML fallback, missing asset');
  }
}

async function writeJsonAtomic(filePath, data) {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  const rand = crypto.randomBytes(6).toString('hex');
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.${rand}.tmp`;
  let renamed = false;
  try {
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        await fs.rename(tmpPath, filePath);
        renamed = true;
        return;
      } catch (error) {
        const transient = error && ['EPERM', 'EBUSY', 'EACCES'].includes(error.code);
        if (!transient || attempt === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
      }
    }
  } finally {
    if (!renamed) {
      try {
        await fs.unlink(tmpPath);
      } catch {}
    }
  }
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

async function runSync({root = DEFAULT_ROOT, force = false, fetchImpl = fetch} = {}) {
  const discovered = new Set();
  const failed = [];
  const manifest = [];
  const expectedLocalFiles = [];
  const prevManifestByPath = new Map();

  if (!force) {
    try {
      const prevRaw = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
      if (Array.isArray(prevRaw?.files)) {
        for (const entry of prevRaw.files) {
          if (entry && typeof entry.path === 'string') {
            prevManifestByPath.set(entry.path, entry);
          }
        }
      }
    } catch {
      // No valid prior manifest -> every asset will be fetched freshly.
    }
  }

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
          const prevEntry = prevManifestByPath.get(urlPath);
          let cached = null;
          try {
            cached = await fs.readFile(local);
          } catch {
            // Earlier captures stored percent-encoded filenames. Migrate their bytes.
            if (localPath !== urlPath) {
              const legacyPath = validateVendorPath(root, encodeURI(urlPath));
              if (legacyPath) {
                try { cached = await fs.readFile(legacyPath); } catch {}
              }
            }
          }
          if (canReuseCachedAsset(cached, prevEntry)) {
            data = cached;
            if (typeof prevEntry.sourcePath === 'string' && prevEntry.sourcePath) {
              sourcePath = prevEntry.sourcePath;
            }
          }
        }
        if (!data) {
          let response = await fetchImpl(ORIGIN + urlPath, {signal: AbortSignal.timeout(30000)});
          if (response.status === 404 && urlPath.startsWith('/thunder68/thunder68/')) {
            sourcePath = urlPath.replace('/thunder68/thunder68/', '/thunder68/');
            response = await fetchImpl(ORIGIN + sourcePath, {signal: AbortSignal.timeout(30000)});
          }
          if (!response.ok) throw new Error('HTTP ' + response.status);
          data = Buffer.from(await response.arrayBuffer());
          validateFetchedResponse(urlPath, response, data, ORIGIN);
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
  const response = await fetchImpl(ORIGIN + '/thunder68', {signal: AbortSignal.timeout(30000)});
  if (!response.ok) throw new Error('Homepage HTTP ' + response.status);
  const htmlBuffer = Buffer.from(await response.arrayBuffer());
  validateFetchedResponse('/thunder68/index.html', response, htmlBuffer, ORIGIN);
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

  await writeJsonAtomic(path.join(root, 'manifest.json'), {
    source: ORIGIN + '/thunder68',
    capturedAt: new Date().toISOString(),
    files: manifest,
    failed
  });
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
  canReuseCachedAsset,
  validateFetchedResponse,
  writeJsonAtomic,
  planStaleFiles,
  validateVendorPath,
  runSync
};

// Download the official runtime directly and verify against the npm package's checksums.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {pipeline} = require('node:stream/promises');
const {Readable} = require('node:stream');
(async () => {
  const pkgRoot = path.resolve(__dirname, '../node_modules/electron');
  const {version} = require(path.join(pkgRoot, 'package.json'));
  const name = `electron-v${version}-win32-x64.zip`;
  const checksums = require(path.join(pkgRoot, 'checksums.json'));
  const expected = checksums[name];
  if (!expected) throw new Error('No official checksum for ' + name);
  const zip = path.resolve(__dirname, '../research', name);
  if (process.argv.includes('--mirror')) {
    const url = `https://cdn.npmmirror.com/binaries/electron/${version}/${name}`;
    const head = await fetch(url, {method: 'HEAD', signal: AbortSignal.timeout(20000)});
    const total = Number(head.headers.get('content-length'));
    if (!head.ok || !Number.isSafeInteger(total) || total <= 0) throw new Error('Cannot determine runtime size');
    const file = await fs.promises.open(zip, 'w');
    const chunkSize = 8 * 1024 * 1024;
    try {
      for (let start = 0; start < total; start += chunkSize * 4) {
        await Promise.all(Array.from({length: 4}, async (_, n) => {
          const offset = start + n * chunkSize;
          if (offset >= total) return;
          const end = Math.min(total - 1, offset + chunkSize - 1);
          const response = await fetch(url, {headers: {Range: `bytes=${offset}-${end}`}, signal: AbortSignal.timeout(60000)});
          if (response.status !== 206) throw new Error('Expected range response, got ' + response.status);
          const data = Buffer.from(await response.arrayBuffer());
          if (data.length !== end - offset + 1) throw new Error('Incomplete download range');
          await file.write(data, 0, data.length, offset);
        }));
        console.log(`Downloaded ${Math.min(total, start + chunkSize * 4)}/${total} bytes`);
      }
    } finally {await file.close();}
  } else {
    const response = await fetch(`https://github.com/electron/electron/releases/download/v${version}/${name}`, {signal: AbortSignal.timeout(180000)});
    if (!response.ok) throw new Error('Download HTTP ' + response.status);
    console.log('Downloading official Electron runtime, bytes: ' + response.headers.get('content-length'));
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(zip));
  }
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(zip)) hash.update(chunk);
  if (hash.digest('hex') !== expected) throw new Error('Runtime checksum mismatch');
  console.log('Official SHA256 verified');
  const {extract} = require('@electron-internal/extract-zip');
  await extract(zip, {dir: path.join(pkgRoot, 'dist')});
  fs.writeFileSync(path.join(pkgRoot, 'path.txt'), 'electron.exe');
  console.log('Runtime ready');
})().catch(error => {console.error(error); process.exitCode = 1;});

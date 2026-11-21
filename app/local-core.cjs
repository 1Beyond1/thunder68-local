const fs = require('node:fs');
const path = require('node:path');

const LOCAL_ORIGIN = 'thunder68://driver';
const SUPPORTED_VENDOR_ID = 0x369b;
const WIRED_PRODUCT_ID = 0x0211;
const DONGLE_PRODUCT_ID = 0x0434;

const MIME_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
});

const EXCLUDED_PACKAGE_FILES = new Set([
  'redesign-audit.cjs',
  'keyboard-layout.json'
]);

function isKeyboard(device) {
  return device?.vendorId === SUPPORTED_VENDOR_ID && [WIRED_PRODUCT_ID, DONGLE_PRODUCT_ID].includes(device.productId);
}

function isConfigInterface(device) {
  return isKeyboard(device) && Boolean(device.collections?.some(
    c => (c.usagePage === 0xff60 && c.usage === 0x61) || (c.usagePage === 0xffa0 && c.usage === 2)
  ));
}

function isLocalUrl(url) {
  return url.protocol === 'thunder68:' && url.host === 'driver' && !url.username && !url.password;
}

function isAllowedOrigin(origin) {
  if (typeof origin !== 'string') return false;
  return origin === LOCAL_ORIGIN || origin === LOCAL_ORIGIN + '/';
}

function isAllowedRequestUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return false;
  return rawUrl.startsWith(LOCAL_ORIGIN + '/') || /^(data|blob):/.test(rawUrl);
}

function validateVendorPath(root, urlPath) {
  if (typeof urlPath !== 'string' || !urlPath) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (!pathname.startsWith('/thunder68/') && pathname !== '/thunder68') return null;
  if (pathname.includes('\\') || pathname.includes('\0')) return null;
  const segments = pathname.split('/');
  if (segments.some(seg => seg === '..' || seg === '.')) return null;
  const file = path.resolve(root, '.' + pathname);
  const relative = path.relative(root, file);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? file : null;
}

function resolveAsset(root, rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!isLocalUrl(url)) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (pathname === '/thunder68' || pathname === '/thunder68/' || pathname.startsWith('/thunder68/index/')) {
    pathname = '/thunder68/index.html';
  }
  return validateVendorPath(root, pathname);
}

function getContentType(filePath) {
  if (typeof filePath !== 'string') return 'application/octet-stream';
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

function getDeviceConnectionKind(device) {
  if (device?.productId === WIRED_PRODUCT_ID) return 'USB 有线';
  if (device?.productId === DONGLE_PRODUCT_ID) return '2.4G 接收器';
  return 'HID 设备';
}

function formatDeviceChoice(device, index = 0, allDevices = []) {
  const name = (device?.name || device?.productName || '雷电68').trim() || '雷电68';
  const kind = getDeviceConnectionKind(device);
  const pid = typeof device?.productId === 'number'
    ? '0x' + device.productId.toString(16).padStart(4, '0').toUpperCase()
    : '未知';
  const baseLabel = `${name} · ${kind} (PID ${pid})`;
  if (!Array.isArray(allDevices) || allDevices.length <= 1) return baseLabel;
  const samePidCount = allDevices.filter(d => d?.productId === device?.productId && ((d?.name || d?.productName || '雷电68').trim() || '雷电68') === name).length;
  if (samePidCount <= 1) return baseLabel;
  const serial = typeof device?.serialNumber === 'string' && device.serialNumber.trim()
    ? ` [${device.serialNumber.trim().slice(-6)}]`
    : ` #${index + 1}`;
  return baseLabel + serial;
}

function resolveWritableDataDir(preferredDir, fallbackDir, fsImpl = fs) {
  const tryDir = dir => {
    fsImpl.mkdirSync(dir, {recursive: true});
    const probe = path.join(dir, `.write-probe-${process.pid}-${Date.now()}`);
    fsImpl.writeFileSync(probe, 'ok');
    fsImpl.unlinkSync(probe);
    return dir;
  };
  try {
    return {dir: tryDir(preferredDir), fallbackUsed: false, error: null};
  } catch (firstError) {
    try {
      return {dir: tryDir(fallbackDir), fallbackUsed: true, error: firstError};
    } catch (secondError) {
      return {dir: fallbackDir, fallbackUsed: true, error: secondError};
    }
  }
}

function shouldPackageAppFile(relativePath) {
  if (typeof relativePath !== 'string' || !relativePath) return false;
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  const base = path.posix.basename(normalized);
  if (EXCLUDED_PACKAGE_FILES.has(normalized) || EXCLUDED_PACKAGE_FILES.has(base)) return false;
  return true;
}

module.exports = {
  LOCAL_ORIGIN,
  SUPPORTED_VENDOR_ID,
  WIRED_PRODUCT_ID,
  DONGLE_PRODUCT_ID,
  MIME_TYPES,
  EXCLUDED_PACKAGE_FILES,
  isKeyboard,
  isConfigInterface,
  isLocalUrl,
  isAllowedOrigin,
  isAllowedRequestUrl,
  validateVendorPath,
  resolveAsset,
  getContentType,
  getDeviceConnectionKind,
  formatDeviceChoice,
  resolveWritableDataDir,
  shouldPackageAppFile
};

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

function isSuspectedBluetoothThunder68(device) {
  if (!device || isConfigInterface(device)) return false;
  const name = String(device.name || device.productName || '');
  const looksLikeThunder = /thunder\s*68|雷电\s*68/i.test(name);
  const looksLikeBt = /\b(?:bt|ble|bluetooth)\b|蓝牙/i.test(name);
  if (looksLikeThunder) return true;
  if (device.vendorId === SUPPORTED_VENDOR_ID && looksLikeBt) return true;
  if (device.vendorId === SUPPORTED_VENDOR_ID && !isKeyboard(device)) return true;
  return false;
}

function classifyHidDiscovery(deviceList) {
  const list = Array.isArray(deviceList) ? deviceList : [];
  const configCandidates = list.filter(isConfigInterface);
  const sameVendorNonConfig = list.filter(d => d?.vendorId === SUPPORTED_VENDOR_ID && !isConfigInterface(d));
  const suspectedBluetooth = list.filter(isSuspectedBluetoothThunder68);

  let reason = 'no-device';
  if (configCandidates.length > 0) {
    reason = 'ready';
  } else if (suspectedBluetooth.length > 0 || sameVendorNonConfig.length > 0) {
    reason = 'bluetooth-unsupported';
  }

  return {
    timestamp: new Date().toISOString(),
    totalDevices: list.length,
    configCandidatesCount: configCandidates.length,
    sameVendorNonConfigCount: sameVendorNonConfig.length,
    suspectedBluetoothCount: suspectedBluetooth.length,
    reason,
    candidates: configCandidates.map(d => ({
      name: String(d?.name || d?.productName || 'THUNDER 68').trim().slice(0, 64) || 'THUNDER 68',
      vendorId: typeof d?.vendorId === 'number' ? d.vendorId : null,
      productId: typeof d?.productId === 'number' ? d.productId : null,
      kind: getDeviceConnectionKind(d)
    }))
  };
}

function redactSensitiveText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/([A-Za-z]:\\Users\\)([^\\/:*?"<>|\r\n]+)/gi, '$1<redacted>')
    .replace(/(\/(?:Users|home)\/)([^/\s]+)/g, '$1<redacted>')
    .replace(/\b(deviceSN|serialNumber)\s*[:=]\s*["']?[^"'\s,}]+["']?/gi, '$1=<redacted>');
}

const DIAGNOSTIC_STRING_FIELDS = new Set(['event', 'name', 'errorName', 'category', 'message', 'version', 'electron', 'reason']);
const DIAGNOSTIC_NUMBER_FIELDS = new Set(['vendorId', 'productId', 'reportId', 'bytes', 'count']);

function sanitizeDiagnosticEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.event !== 'string' || !raw.event.trim()) return null;
  const safe = {};
  if (typeof raw.time === 'string' && raw.time) {
    safe.time = raw.time.slice(0, 40);
  }
  safe.event = raw.event.trim().slice(0, 80);
  for (const key of DIAGNOSTIC_STRING_FIELDS) {
    if (key === 'event') continue;
    if (typeof raw[key] === 'string' && raw[key]) {
      const limit = key === 'message' ? 1200 : 120;
      safe[key] = redactSensitiveText(raw[key].slice(0, limit));
    }
  }
  for (const key of DIAGNOSTIC_NUMBER_FIELDS) {
    if (typeof raw[key] === 'number' && Number.isFinite(raw[key])) {
      safe[key] = raw[key];
    }
  }
  if (typeof raw.offline === 'boolean') safe.offline = raw.offline;
  if (Array.isArray(raw.candidates)) {
    safe.candidates = raw.candidates.slice(0, 10).map(item => ({
      name: redactSensitiveText(String(item?.name || '').slice(0, 64)),
      vendorId: typeof item?.vendorId === 'number' ? item.vendorId : null,
      productId: typeof item?.productId === 'number' ? item.productId : null
    }));
  }
  return safe;
}

function formatSanitizedDiagnosticReport({meta = {}, discovery = null, stats = {}, devices = [], entries = []} = {}) {
  const safeMeta = {
    appVersion: String(meta.appVersion || ''),
    electron: String(meta.electron || ''),
    platform: String(meta.platform || ''),
    dataDir: redactSensitiveText(String(meta.dataDir || '')),
    generatedAt: new Date().toISOString(),
    privacyNote: '已自动脱敏：仅包含 WebHID 接口状态、收发计数与错误分类，不含按键文本、个人用户名与设备序列号。'
  };
  const safeDevices = Array.isArray(devices)
    ? devices.slice(0, 20).map(d => ({
        name: redactSensitiveText(String(d?.name || d?.productName || 'HID Device').slice(0, 64)),
        vendorId: typeof d?.vendorId === 'number' ? '0x' + d.vendorId.toString(16).padStart(4, '0') : null,
        productId: typeof d?.productId === 'number' ? '0x' + d.productId.toString(16).padStart(4, '0') : null,
        opened: Boolean(d?.opened),
        collections: Array.isArray(d?.collections)
          ? d.collections.slice(0, 16).map(c => ({
              usagePage: typeof c?.usagePage === 'number' ? '0x' + c.usagePage.toString(16) : null,
              usage: typeof c?.usage === 'number' ? '0x' + c.usage.toString(16) : null
            }))
          : []
      }))
    : [];
  const safeEntries = Array.isArray(entries)
    ? entries.map(sanitizeDiagnosticEntry).filter(Boolean).slice(-60)
    : [];
  return JSON.stringify({
    meta: safeMeta,
    lastDiscovery: discovery || null,
    sessionHidStats: stats || {},
    authorizedHidDevices: safeDevices,
    recentLogs: safeEntries
  }, null, 2);
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
  isSuspectedBluetoothThunder68,
  classifyHidDiscovery,
  redactSensitiveText,
  sanitizeDiagnosticEntry,
  formatSanitizedDiagnosticReport,
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

const path = require('node:path');
const LOCAL_ORIGIN = 'thunder68://driver';
function isKeyboard(device) {
  return device?.vendorId === 0x369b && [0x0211, 0x0434].includes(device.productId);
}
function isConfigInterface(device) {
  return isKeyboard(device) && device.collections?.some(c => (c.usagePage === 0xff60 && c.usage === 0x61) || (c.usagePage === 0xffa0 && c.usage === 2));
}
function isLocalUrl(url) {
  return url.protocol === 'thunder68:' && url.host === 'driver' && !url.username && !url.password;
}
function resolveAsset(root, rawUrl) {
  const url = new URL(rawUrl);
  if (!isLocalUrl(url)) return null;
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return null; }
  if (!pathname.startsWith('/thunder68/') && pathname !== '/thunder68') return null;
  if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').includes('..')) return null;
  if (pathname === '/thunder68' || pathname === '/thunder68/' || pathname.startsWith('/thunder68/index/')) pathname = '/thunder68/index.html';
  const file = path.resolve(root, '.' + pathname);
  const relative = path.relative(root, file);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? file : null;
}
module.exports = {LOCAL_ORIGIN, isKeyboard, isConfigInterface, isLocalUrl, resolveAsset};

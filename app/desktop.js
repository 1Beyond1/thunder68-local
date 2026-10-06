(() => {
  'use strict';
  const emit = detail => {window.thunder68Local?.diagnostic(detail);window.dispatchEvent(new CustomEvent('thunder68-feedback',{detail}));};
  window.addEventListener('error', e => emit({event: 'page-error', message: e.message}));
  window.addEventListener('unhandledrejection', e => emit({event: 'page-rejection', message: String(e.reason)}));
  let sent = 0, received = 0;
  if (navigator.hid) {
    const originalRequest = navigator.hid.requestDevice.bind(navigator.hid);
    navigator.hid.requestDevice = async options => {
      emit({event: 'hid-request', message: JSON.stringify(options)});
      try {
        const devices = await originalRequest(options);
        emit({event: 'hid-request-result', count: devices.length}); return devices;
      }
      catch (error) {emit({event: 'hid-request-error', message: error.name + ': ' + error.message}); throw error;}
    };
  }
  if (window.HIDDevice) {
    const originalOpen = HIDDevice.prototype.open;
    HIDDevice.prototype.open = async function (...args) {
      try {
        const result = await originalOpen.apply(this, args);
        emit({event: 'hid-open', name: this.productName, vendorId: this.vendorId, productId: this.productId});
        window.dispatchEvent(new CustomEvent('thunder68-device-open'));
        if (!this.__localObserved) {
          this.__localObserved = true;
          this.addEventListener('inputreport', event => {received++; if (received <= 8 || received % 100 === 0) emit({event: 'hid-input', reportId: event.reportId, bytes: event.data.byteLength, count: received});});
        }
        return result;
      } catch (error) {emit({event: 'hid-open-error', message: error.message}); throw error;}
    };
    const originalSend = HIDDevice.prototype.sendReport;
    HIDDevice.prototype.sendReport = async function (id, data) {
      try {
        const result = await originalSend.call(this, id, data); sent++;
        if (sent <= 8 || sent % 100 === 0) emit({event: 'hid-output', reportId: id, bytes: data.byteLength, count: sent});
        return result;
      } catch (error) {emit({event: 'hid-send-error', message: error.message}); throw error;}
    };
  }
  document.addEventListener('DOMContentLoaded', () => {
    emit({event: 'page-ready'});
    const updateHint = () => {
      const walker = document.createTreeWalker(document.getElementById('root'), NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) if (walker.currentNode.nodeValue.startsWith('请使用 Chrome、Edge或 Opera 浏览器打开驱动')) walker.currentNode.nodeValue = '通过 USB 连接雷电68，然后点击“新增设备”。如果官网驱动正在连接键盘，请先断开官网连接。';
    };
    if (document.getElementById('root')) {
      updateHint();
      new MutationObserver(updateHint).observe(document.getElementById('root'), {childList: true, subtree: true});
    }
  });
})();

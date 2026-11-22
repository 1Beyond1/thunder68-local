(() => {
  'use strict';
  const MAX_RECENT_EVENTS = 80;
  const recentEvents = [];
  const counters = {
    requests: 0,
    opens: 0,
    closes: 0,
    sent: 0,
    received: 0,
    errors: 0,
    connects: 0,
    disconnects: 0
  };

  function pushRecent(detail) {
    if (!detail || typeof detail.event !== 'string') return;
    const safe = {
      time: new Date().toISOString(),
      event: detail.event.slice(0, 80)
    };
    for (const key of ['name', 'errorName', 'category', 'message']) {
      if (typeof detail[key] === 'string' && detail[key]) {
        safe[key] = detail[key].slice(0, key === 'message' ? 400 : 100);
      }
    }
    for (const key of ['vendorId', 'productId', 'reportId', 'bytes', 'count']) {
      if (typeof detail[key] === 'number' && Number.isFinite(detail[key])) {
        safe[key] = detail[key];
      }
    }
    recentEvents.push(safe);
    if (recentEvents.length > MAX_RECENT_EVENTS) {
      recentEvents.splice(0, recentEvents.length - MAX_RECENT_EVENTS);
    }
  }

  const emitDiagnostic = detail => {
    pushRecent(detail);
    window.thunder68Local?.diagnostic(detail);
  };
  const emitFeedback = detail => window.dispatchEvent(new CustomEvent('thunder68-feedback', {detail}));
  const emit = detail => {
    emitDiagnostic(detail);
    emitFeedback(detail);
  };

  window.addEventListener('error', e => emit({
    event: 'page-error',
    errorName: e.error?.name || 'Error',
    message: e.message
  }));
  window.addEventListener('unhandledrejection', e => emit({
    event: 'page-rejection',
    errorName: e.reason?.name || 'UnhandledRejection',
    message: String(e.reason?.message || e.reason)
  }));

  const hidController = window.thunder68Helpers?.createHidFeedbackController({
    onDiagnostic: emitDiagnostic,
    onFeedback: emitFeedback,
    debounceMs: 80
  });

  if (navigator.hid) {
    const originalRequest = navigator.hid.requestDevice.bind(navigator.hid);
    navigator.hid.requestDevice = async options => {
      counters.requests++;
      emit({event: 'hid-request', message: JSON.stringify(options)});
      try {
        const devices = await originalRequest(options);
        emit({event: 'hid-request-result', count: devices.length});
        return devices;
      } catch (error) {
        counters.errors++;
        emit({
          event: 'hid-request-error',
          errorName: error?.name || 'Error',
          message: error?.message || String(error)
        });
        throw error;
      }
    };

    navigator.hid.addEventListener('connect', event => {
      counters.connects++;
      const d = event?.device;
      emitDiagnostic({
        event: 'hid-connect',
        name: d?.productName || '',
        vendorId: d?.vendorId,
        productId: d?.productId
      });
    });

    navigator.hid.addEventListener('disconnect', event => {
      counters.disconnects++;
      const d = event?.device;
      emitDiagnostic({
        event: 'hid-disconnect',
        name: d?.productName || '',
        vendorId: d?.vendorId,
        productId: d?.productId
      });
    });
  }

  if (window.HIDDevice) {
    const originalOpen = HIDDevice.prototype.open;
    HIDDevice.prototype.open = async function (...args) {
      try {
        const result = await originalOpen.apply(this, args);
        counters.opens++;
        emit({event: 'hid-open', name: this.productName, vendorId: this.vendorId, productId: this.productId});
        window.dispatchEvent(new CustomEvent('thunder68-device-open', {
          detail: {name: this.productName, vendorId: this.vendorId, productId: this.productId}
        }));
        if (!this.__localObserved) {
          this.__localObserved = true;
          this.addEventListener('inputreport', event => {
            counters.received++;
            if (hidController) {
              hidController.recordInput({reportId: event.reportId, bytes: event.data.byteLength});
            }
          });
        }
        return result;
      } catch (error) {
        counters.errors++;
        emit({
          event: 'hid-open-error',
          errorName: error?.name || 'Error',
          name: this.productName || '',
          vendorId: this.vendorId,
          productId: this.productId,
          message: error?.message || String(error)
        });
        throw error;
      }
    };

    const originalClose = HIDDevice.prototype.close;
    HIDDevice.prototype.close = async function (...args) {
      try {
        return await originalClose.apply(this, args);
      } finally {
        counters.closes++;
        const info = {name: this.productName, vendorId: this.vendorId, productId: this.productId};
        if (hidController) {
          hidController.recordClose(info);
        } else {
          emit({event: 'hid-close', ...info});
        }
        window.dispatchEvent(new CustomEvent('thunder68-device-close', {detail: info}));
      }
    };

    const originalSend = HIDDevice.prototype.sendReport;
    HIDDevice.prototype.sendReport = async function (id, data) {
      try {
        const result = await originalSend.call(this, id, data);
        counters.sent++;
        const bytes = data?.byteLength ?? 0;
        if (hidController) {
          hidController.recordOutput({reportId: id, bytes});
        } else {
          emit({event: 'hid-output', reportId: id, bytes});
        }
        return result;
      } catch (error) {
        counters.errors++;
        emit({
          event: 'hid-send-error',
          errorName: error?.name || 'Error',
          reportId: typeof id === 'number' ? id : undefined,
          message: error?.message || String(error)
        });
        throw error;
      }
    };
  }

  window.thunder68DesktopDiag = Object.freeze({
    stats: () => ({...counters}),
    recentEvents: () => recentEvents.map(item => ({...item}))
  });

  document.addEventListener('DOMContentLoaded', () => {
    emit({event: 'page-ready'});
  });
})();

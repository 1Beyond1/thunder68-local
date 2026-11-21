(() => {
  'use strict';
  const emitDiagnostic = detail => window.thunder68Local?.diagnostic(detail);
  const emitFeedback = detail => window.dispatchEvent(new CustomEvent('thunder68-feedback', {detail}));
  const emit = detail => {
    emitDiagnostic(detail);
    emitFeedback(detail);
  };

  window.addEventListener('error', e => emit({event: 'page-error', message: e.message}));
  window.addEventListener('unhandledrejection', e => emit({event: 'page-rejection', message: String(e.reason)}));

  const hidController = window.thunder68Helpers?.createHidFeedbackController({
    onDiagnostic: emitDiagnostic,
    onFeedback: emitFeedback,
    debounceMs: 80
  });

  if (navigator.hid) {
    const originalRequest = navigator.hid.requestDevice.bind(navigator.hid);
    navigator.hid.requestDevice = async options => {
      emit({event: 'hid-request', message: JSON.stringify(options)});
      try {
        const devices = await originalRequest(options);
        emit({event: 'hid-request-result', count: devices.length});
        return devices;
      } catch (error) {
        emit({event: 'hid-request-error', message: error.name + ': ' + error.message});
        throw error;
      }
    };
  }

  if (window.HIDDevice) {
    const originalOpen = HIDDevice.prototype.open;
    HIDDevice.prototype.open = async function (...args) {
      try {
        const result = await originalOpen.apply(this, args);
        emit({event: 'hid-open', name: this.productName, vendorId: this.vendorId, productId: this.productId});
        window.dispatchEvent(new CustomEvent('thunder68-device-open', {
          detail: {name: this.productName, vendorId: this.vendorId, productId: this.productId}
        }));
        if (!this.__localObserved) {
          this.__localObserved = true;
          this.addEventListener('inputreport', event => {
            if (hidController) {
              hidController.recordInput({reportId: event.reportId, bytes: event.data.byteLength});
            }
          });
        }
        return result;
      } catch (error) {
        emit({event: 'hid-open-error', message: error.message});
        throw error;
      }
    };

    const originalClose = HIDDevice.prototype.close;
    HIDDevice.prototype.close = async function (...args) {
      try {
        return await originalClose.apply(this, args);
      } finally {
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
        const bytes = data?.byteLength ?? 0;
        if (hidController) {
          hidController.recordOutput({reportId: id, bytes});
        } else {
          emit({event: 'hid-output', reportId: id, bytes});
        }
        return result;
      } catch (error) {
        emit({event: 'hid-send-error', message: error.message});
        throw error;
      }
    };
  }

  document.addEventListener('DOMContentLoaded', () => {
    emit({event: 'page-ready'});
  });
})();

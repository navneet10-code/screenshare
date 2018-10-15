'use strict';

let initialized = false;

const initializeScreenShare = function (webstoreUrl, force) {
  if (!window.chrome || !window.chrome.webstore) {
    return; // this method works exclusively on chrome
  }
  if (initialized && !force) {
    return; // only initialize once on a single document
  }
  const handleMessage = function (event) {
    if (!event || !event.data || event.data.type !== 'getScreen') {
      return;
    }
    const extId = window.sessionStorage.getScreenMediaJSExtensionId;
    if (!extId) {
      try {
        const getScreenMediaJSExtensionId = webstoreUrl.split('/').pop();
        window.open(webstoreUrl, '_webstore');
        setTimeout(function () {
          window.sessionStorage.getScreenMediaJSExtensionId = getScreenMediaJSExtensionId;
          if (event.data.installOnly) {
            return event.source.postMessage(event.data, '*');
          }
          handleMessage(event);
        }, 3500);
      } catch (err) {
        return event.source.postMessage({ err }, '*');
      }
    }
    if (event.data.installOnly) {
      return event.source.postMessage(event.data, '*');
    }
    window.chrome.runtime.sendMessage(extId, event.data, function (data) {
      event.source.postMessage(data, '*');
    });
  };
  initialized = true;
  window.addEventListener('message', handleMessage);
};

const requestScreenShare = function (constraints, installOnly) {
  if (!window.navigator || !window.navigator.mediaDevices ||
      !window.navigator.mediaDevices.getUserMedia) {
    if (!Promise) {
      throw new Error('requestScreenShare called in unsupported browser');
    }
    return Promise.reject(new Error('Unsupported'));
  }
  if (!window.chrome) {
    if (installOnly) {
      return Promise.resolve();
    }
    const ffConstraints = (constraints && constraints.firefox) || {
      audio: false,
      video: { mediaSource: 'window' }
    };
    return window.navigator.mediaDevices.getUserMedia(ffConstraints);
  } else {
    return new Promise(function (resolve, reject) {
      const handleMessage = function (event) {
        if (event && event.data === 'process-tick') {
          return; // ignore this, don't resolve or reject
        }
        if (window === window.parent) {
          if (event && event.data &&
              (event.data.type === 'getScreen' || event.data.type === 'getScreenPending')
          ) {
            return; // ignore, using on non-iframe
          }
          if (!event.data) {
            return;
          }
        }
        window.removeEventListener('message', handleMessage);
        if (!event || !event.data.sourceId) {
          if (event.data.err) {
            return reject(event.data.err);
          }
          if (event.data.installOnly) {
            return resolve(event.data);
          }
          return reject(new Error('User Cancellation'));
        }
        const chromeConstraints = (constraints && constraints.chrome) || {
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              maxWidth: window.screen.width,
              maxHeight: window.screen.height,
              maxFrameRate: 15,
              chromeMediaSourceId: event.data.sourceId
            }
          }
        };
        window.navigator.mediaDevices.getUserMedia(chromeConstraints).then(resolve, reject);
      };
      window.addEventListener('message', handleMessage);
      window.parent.postMessage({ type: 'getScreen', installOnly, id: 1, url: window.location.origin }, '*');
    });
  }
};

export default {
  initializeScreenShare,
  requestScreenShare
};

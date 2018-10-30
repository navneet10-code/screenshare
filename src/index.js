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
            event.data.type = 'gotScreen';
            return event.source.postMessage(event.data, '*');
          }
          handleMessage(event);
        }, 6000);
        return;
      } catch (err) {
        return event.source.postMessage({ err }, '*');
      }
    }
    if (event.data.installOnly) {
      event.data.type = 'gotScreen';
      return event.source.postMessage(event.data, '*');
    }
    window.chrome.runtime.sendMessage(extId, event.data, function (data) {
      data.id = event.data.id;
      event.source.postMessage(data, '*');
    });
  };
  initialized = true;
  window.addEventListener('message', handleMessage);
};

function getDefaultChromeConstraints () {
  return {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        maxWidth: window.screen.width,
        maxHeight: window.screen.height,
        maxFrameRate: 15
      }
    }
  };
}

let messageCounter = 0;

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
  } else if (window.chrome && !window.chrome.runtime) {
    if (installOnly) {
      return Promise.resolve();
    }
    const chromeConstraints = (constraints && constraints.chrome) || getDefaultChromeConstraints();
    return window.navigator.mediaDevices.getUserMedia(chromeConstraints);
  } else {
    const messageId = messageCounter++;
    return new Promise(function (resolve, reject) {
      let boundFunction;
      const handleMessage = function (event) {
        if (event && event.data === 'process-tick') {
          return; // ignore this, don't resolve or reject
        }
        if (!event || !event.data) {
          return; // this is not for us either
        }
        if (event.data.id !== messageId) {
          return;
        }
        if (window === window.parent) {
          if (event && event.data &&
              (event.data.type === 'getScreen' || event.data.type === 'getScreenPending')
          ) {
            return; // ignore, using on non-iframe
          }
        }
        window.removeEventListener('message', boundFunction);
        if (!event.data.sourceId) {
          if (event.data.err) {
            return reject(event.data.err);
          }
          if (event.data.installOnly) {
            return resolve(event.data);
          }
          return reject(new Error('User Cancellation'));
        }
        const chromeConstraints = (constraints && constraints.chrome) || getDefaultChromeConstraints();
        chromeConstraints.video.mandatory.chromeMediaSourceId = event.data.sourceId;
        window.navigator.mediaDevices.getUserMedia(chromeConstraints).then(resolve, reject);
      };
      boundFunction = handleMessage.bind(this);
      setTimeout(function () {
        reject(new Error('Screen capture timeout'));
      }, 6500);
      window.addEventListener('message', boundFunction);
      window.parent.postMessage({ type: 'getScreen', installOnly, id: messageId, url: window.location.origin }, '*');
    });
  }
};

export default {
  initializeScreenShare,
  requestScreenShare
};

/* global describe, it, beforeEach, afterEach */

import { assert } from 'chai';
import sinon from 'sinon';
import { initializeScreenShare, requestScreenShare } from '../';
import { EventEmitter } from 'events';

let USE_MOCK_WINDOW = false;
if (typeof window === 'undefined') {
  USE_MOCK_WINDOW = true;
}

class Window extends EventEmitter {
  constructor () {
    super();
    this.chrome = {
      runtime: {
        sendMessage: () => {}
      }
    };
    this.open = () => {};
    this.sessionStorage = {};
    this.location = { origin: 'https://examplesrus.com' };
    this.screen = { width: 100, height: 100 };
    this.Promise = Promise;

    this.navigator = {
      mediaDevices: {
        getUserMedia () {}
      }
    };
    this.parent = this;
  }

  addEventListener (event, func) {
    this.on(event, func);
  }

  removeEventListener (event, func) {
    this.removeListener(event, func);
  }

  postMessage (data, source) {
    this.emit('message', {
      data,
      source: typeof source === 'object' ? source : global.window
    });
  }
}

describe('requestScreenShare', function () {
  let sandbox;
  beforeEach(function () {
    if (USE_MOCK_WINDOW) {
      global.window = new Window();
    }
    sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('will not set up a window event listener for message if not in chrome', function () {
    sandbox.spy(window, 'addEventListener');
    window.chrome = null;
    sandbox.stub(window.navigator.mediaDevices, 'getUserMedia').returns(Promise.resolve({}));
    return requestScreenShare().then(stream => {
      assert.ok(stream);
      sinon.assert.notCalled(window.addEventListener);
    });
  });

  it('will immediately call getUserMedia if not in chrome, and getUserMedia exists', function () {
    window.navigator = {
      mediaDevices: {
        getUserMedia: () => {}
      }
    };
    window.chrome = null;
    sandbox.stub(window.navigator.mediaDevices, 'getUserMedia').callsFake(constraints => {
      assert.equal(constraints.audio, false);
      assert.equal(constraints.video.mediaSource, 'window');
      return Promise.resolve();
    });
    return requestScreenShare();
  });

  it('will immediately call getDisplayMedia if not in chrome, and getDisplayMedia exists', function () {
    window.navigator = {
      mediaDevices: {
        getUserMedia: () => {},
        getDisplayMedia: () => {}
      }
    };
    window.chrome = null;
    sandbox.stub(window.navigator.mediaDevices, 'getUserMedia');
    sandbox.stub(window.navigator.mediaDevices, 'getDisplayMedia').callsFake(constraints => {
      assert.equal(constraints.audio, false);
      assert.equal(constraints.video.mediaSource, 'window');
      return Promise.resolve();
    });
    return requestScreenShare().then(() => {
      sinon.assert.notCalled(window.navigator.mediaDevices.getUserMedia);
      sinon.assert.calledOnce(window.navigator.mediaDevices.getDisplayMedia);
    });
  });

  it('will request screen share via the chrome iframe method and resolve', function () {
    const sourceId = '123591911019385';
    const mockStream = {};
    window.navigator = {
      mediaDevices: {
        getUserMedia: () => {}
      }
    };
    window.parent = {
      postMessage: () => {}
    };
    sandbox.stub(window.parent, 'postMessage').callsFake(function (options) {
      assert.equal(options.type, 'getScreen');
      assert.equal(options.url, window.location.origin);
      window.postMessage({ sourceId, id: options.id });
    });
    sandbox.stub(window.navigator.mediaDevices, 'getUserMedia').callsFake(function (constraints) {
      assert.equal(constraints.audio, false);
      assert.equal(constraints.video.mandatory.chromeMediaSource, 'desktop');
      assert.equal(constraints.video.mandatory.chromeMediaSourceId, sourceId);
      return Promise.resolve(mockStream);
    });
    return requestScreenShare().then((stream) => {
      assert.equal(stream, mockStream);
    });
  });

  it('will not request it more than once if called with install only once', function () {
    const sourceId = '123591911019385';
    const mockStream = {};
    window.navigator = {
      mediaDevices: {
        getUserMedia: () => {}
      }
    };
    window.parent = {
      postMessage: () => {}
    };
    sandbox.stub(window.parent, 'postMessage').callsFake(function (options) {
      assert.equal(options.type, 'getScreen');
      assert.equal(options.url, window.location.origin);
      if (!options.installOnly) {
        window.postMessage({ sourceId, id: options.id });
      } else {
        window.postMessage({ installOnly: true, id: options.id });
      }
    });
    sandbox.stub(window.navigator.mediaDevices, 'getUserMedia').callsFake(function (constraints) {
      assert.equal(constraints.audio, false);
      assert.equal(constraints.video.mandatory.chromeMediaSource, 'desktop');
      assert.equal(constraints.video.mandatory.chromeMediaSourceId, sourceId);
      return Promise.resolve(mockStream);
    });
    return requestScreenShare(null, true) // install only
      .then(() => {
        sinon.assert.notCalled(window.navigator.mediaDevices.getUserMedia);
        return requestScreenShare();
      })
      .then(stream => {
        assert.equal(stream, mockStream);
        sinon.assert.calledOnce(window.navigator.mediaDevices.getUserMedia);
      });
  });

  it('will request screen share via getDisplayMedia if available and NOT the iframe method', function () {
    const mockStream = {};
    window.navigator = {
      mediaDevices: {
        getUserMedia: () => {},
        getDisplayMedia: () => {}
      }
    };
    window.parent = {
      postMessage: () => {}
    };
    sandbox.stub(window.parent, 'postMessage');
    sandbox.stub(window.navigator.mediaDevices, 'getUserMedia');
    sandbox.stub(window.navigator.mediaDevices, 'getDisplayMedia').callsFake(function (constraints) {
      assert.equal(constraints.audio, false);
      assert.equal(constraints.video.displaySurface, 'monitor');
      return Promise.resolve(mockStream);
    });
    return requestScreenShare().then((stream) => {
      sinon.assert.notCalled(window.parent.postMessage);
      sinon.assert.notCalled(window.navigator.mediaDevices.getUserMedia);
      assert.equal(stream, mockStream);
    });
  });
});

describe('initializeScreenShare', function () {
  let sandbox;
  beforeEach(function () {
    if (USE_MOCK_WINDOW) {
      global.window = new Window();
    }
    sandbox = sinon.createSandbox();
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('runs', function () {
    initializeScreenShare();
    assert.ok(true);
  });

  it('will not set up a window event listener for message if not in chrome', function () {
    sandbox.spy(window, 'addEventListener');
    window.chrome = null;
    initializeScreenShare(null, true); // force re-initialize
    sinon.assert.notCalled(window.addEventListener);
  });

  it('will set up a window event listener for a message if in chrome', function () {
    sandbox.spy(window, 'addEventListener');
    initializeScreenShare(null, true); // force re-initialize
    sinon.assert.calledOnce(window.addEventListener);
    sinon.assert.calledWithExactly(window.addEventListener, 'message', sinon.match.func);
  });

  describe('the message handler', function () {
    it('will open a new tab to the extension and set a timeout', function (done) {
      const extensionId = 'id-asdlfkjasdkd';
      const webstoreUrl = `https://test.example/test/${extensionId}`;
      window.sessionStorage.getScreenMediaJSExtensionId = extensionId;
      const windowEvent = {
        type: 'getScreen'
      };
      sandbox.stub(window.chrome.runtime, 'sendMessage').callsFake(function (extId, data, callback) {
        assert.equal(extId, extensionId);
        assert.equal(data, windowEvent);
        assert.equal(typeof callback, 'function');
        done();
      });
      initializeScreenShare(webstoreUrl, true);
      window.postMessage(windowEvent);
    });

    it('will attempt to install the chrome extension if it does not exist, then send the message to the extension', function (done) {
      this.timeout(10000); // the install process has a longer timeout

      const webstoreUrl = 'https://test.example';
      sandbox.stub(window, 'open').callsFake(function (url, target) {
        assert.equal(url, webstoreUrl);
        assert.equal(target, '_webstore');
      });
      sandbox.stub(window.chrome.runtime, 'sendMessage').callsFake(function () {
        done();
      });
      initializeScreenShare(webstoreUrl, true);
      window.postMessage({
        type: 'getScreen'
      });
    });

    it('will not attempt to install the chrome extension if it appears to exist', function (done) {
      const webstoreUrl = 'https://test.example';
      sandbox.stub(window, 'open').callsFake(function (url, target) {
        assert.equal(url, webstoreUrl);
        assert.equal(target, '_webstore');
        assert.ok(false, 'window.open should not have been called');
      });
      sandbox.stub(window.chrome.runtime, 'sendMessage').callsFake(function () {
        sinon.assert.notCalled(window.open);
        done();
      });
      window.sessionStorage.getScreenMediaJSExtensionId = '1234';
      initializeScreenShare(webstoreUrl, true);
      window.postMessage({
        type: 'getScreen'
      });
    });

    it('will install the extension but not request media if installOnly is provided', function (done) {
      this.timeout(10000); // the install process has a longer timeout

      const webstoreUrl = 'https://test.example';
      sandbox.stub(window, 'open').callsFake(function (url, target) {
        assert.equal(url, webstoreUrl);
        assert.equal(target, '_webstore');
      });
      sandbox.stub(window.chrome.runtime, 'sendMessage').callsFake(function () {
        assert.ok(false, 'Passed message to extension after installing.');
      });
      const frameWindow = {
        postMessage: () => {}
      };
      sandbox.stub(frameWindow, 'postMessage').callsFake(function (msg) {
        assert.ok(msg.installOnly);
        done();
      });
      initializeScreenShare(webstoreUrl, true);
      window.postMessage({
        type: 'getScreen',
        installOnly: true
      }, frameWindow);
    });

    it('will not loop into eternity if done on the same window', function () {
      this.timeout(10000); // the install process has a longer timeout

      const webstoreUrl = 'https://test.example';
      sandbox.stub(window, 'open').callsFake(function (url, target) {
        assert.equal(url, webstoreUrl);
        assert.equal(target, '_webstore');
      });
      sandbox.stub(window.chrome.runtime, 'sendMessage').callsFake(function () {
        assert.ok(false, 'Passed message to extension after installing.');
      });
      sinon.spy(window, 'postMessage');
      initializeScreenShare(webstoreUrl, true);
      return requestScreenShare(null, true)
        .then(() => {
          sinon.assert.calledTwice(window.postMessage);
        });
    });
  });
});

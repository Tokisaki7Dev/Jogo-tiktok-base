/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "racha-standalone.html",
    "revision": "e9a0c9dc33b4b6b3c6240da5a8633b5b"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "c09558b2dee51a967f7cdad1637adf45"
  }, {
    "url": "pwa-512x512.png",
    "revision": "e2d1c6f03e82d6b6241c8c0892a0dba1"
  }, {
    "url": "pwa-192x192.png",
    "revision": "20f1b41f8af6c2e1028a40c400257358"
  }, {
    "url": "index.html",
    "revision": "57ec2aea677efc465be9ee257ed03bcd"
  }, {
    "url": "icon.svg",
    "revision": "7d186fa94db83721418717455e03367e"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "ea64058db84d9831447e836acc2e8057"
  }, {
    "url": "assets/index-uSD2FxMB.js",
    "revision": null
  }, {
    "url": "assets/aistudio/IMG_4904_eb08da1e.png",
    "revision": null
  }, {
    "url": "assets/aistudio/IMG_4903_44f30876.png",
    "revision": null
  }, {
    "url": "assets/aistudio/IMG_4902_fbe548ef.png",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "ea64058db84d9831447e836acc2e8057"
  }, {
    "url": "icon.svg",
    "revision": "7d186fa94db83721418717455e03367e"
  }, {
    "url": "pwa-192x192.png",
    "revision": "20f1b41f8af6c2e1028a40c400257358"
  }, {
    "url": "pwa-512x512.png",
    "revision": "e2d1c6f03e82d6b6241c8c0892a0dba1"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "c09558b2dee51a967f7cdad1637adf45"
  }, {
    "url": "manifest.webmanifest",
    "revision": "8bb15b07a5d88a5633fcd012ee7575e4"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));

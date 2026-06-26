/* Roo HQ service worker — caches the app shell so it works offline. */
var CACHE = "roohq-v6";
var ASSETS = [
  "./", "./index.html", "./styles.css", "./manifest.webmanifest",
  "./js/firebase-config.js", "./js/seed.js", "./js/logic.js", "./js/merge.js",
  "./js/store.js", "./js/sync.js", "./js/app.js",
  "./icons/icon-192.png", "./icons/icon-512.png",
  "./icons/apple-touch-icon.png", "./icons/favicon-32.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  // Let cross-origin requests (Firebase, gstatic) go straight to the network.
  if (url.origin !== location.origin) return;

  // Stale-while-revalidate: serve cache instantly, refresh it in the background so updates
  // land on the next load while still working fully offline.
  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (cached) {
        var network = fetch(req).then(function (resp) {
          cache.put(req, resp.clone());
          return resp;
        }).catch(function () { return cached || cache.match("./index.html"); });
        return cached || network;
      });
    })
  );
});

// Network-first service worker: always tries the latest files, falls back to cache offline.
const CACHE = 'sketchforge-v2.13.3';
const ASSETS = ['./', 'index.html', 'style.css', 'app.js', 'cloud-config.js', 'cloud-lib.js', 'three3d.js', 'models3d.js', 'vroid3d.js', 'manifest.json', 'mascot.gif', 'icon.svg', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

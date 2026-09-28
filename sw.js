// Keeps the app opening even when you're offline or the host is down.
const CACHE = 'cycle-v1';
const CORE = ['./', './index.html', './apple-touch-icon.png', './icon-512.png', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const cached = () => caches.match('./index.html');
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // The app page: try the network (to pick up updates), fall back to the saved copy
  // if offline, slow (4 s) or the host returns an error page.
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await Promise.race([
          fetch(req),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000))
        ]);
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        }
        return (await cached()) || res;
      } catch (err) {
        return (await cached()) || Response.error();
      }
    })());
    return;
  }

  // Icons and fonts: use the saved copy, fetch and save it the first time.
  const fonts = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin === self.location.origin || fonts) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    })));
  }
});

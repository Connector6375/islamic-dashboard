// Service worker: lets the dashboard open offline after the first visit.
// Registered only when the page is served over http(s) (e.g. GitHub Pages); opening index.html from disk
// does not use it. Strategy: the page itself is network-first (a new version shows on the very next open;
// offline it falls back to the saved copy), everything else shows the cached copy at once and refreshes it
// in the background.
const CACHE = 'dashboard-v2';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const save = (req, res) => {
  if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
  return res;
};

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // Network first, but never wait long on a bad connection: after 4 s use the saved copy.
    event.respondWith(
      new Promise((resolve) => {
        const timer = setTimeout(() => caches.match('index.html').then((hit) => hit && resolve(hit)), 4000);
        fetch(req)
          .then((res) => { clearTimeout(timer); save('index.html', res); resolve(res); })
          .catch(() => { clearTimeout(timer); caches.match('index.html').then((hit) => resolve(hit || Response.error())); });
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      const fresh = fetch(req).then((res) => save(req, res)).catch(() => hit);
      return hit || fresh;
    }),
  );
});

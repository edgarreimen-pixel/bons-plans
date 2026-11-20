// Service worker : application disponible hors ligne, données toujours
// rafraîchies quand le réseau répond (jamais de vieux prix présentés comme récents).
const VERSION = 'bp-__BUILD__';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'api.js', 'taxonomy.js', 'config.js', 'manifest.webmanifest', 'icons/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.includes('/rest/v1/')) {
    // données : réseau d'abord, copie locale seulement si hors ligne
    e.respondWith(fetch(req).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION + '-data').then((c) => c.put(req, copy)); }
      return r;
    }).catch(() => caches.match(req)));
    return;
  }
  if (url.origin === location.origin) {
    // interface : cache immédiat + mise à jour en arrière-plan
    e.respondWith(caches.match(req).then((hit) => {
      const net = fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); } return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});

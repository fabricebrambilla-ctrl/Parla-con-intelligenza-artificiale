/* Cache only the informational fallback. Never store API traffic or conversations. */
'use strict';
const CACHE = 'talk-with-ai-offline-v1';
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/offline.html')));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys
    .filter((key) => key.startsWith('talk-with-ai-offline-') && key !== CACHE)
    .map((key) => caches.delete(key)))));
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' ||
      url.origin !== self.location.origin || url.pathname.startsWith('/api/') ||
      url.pathname === '/stats' || url.pathname.startsWith('/stats/')) return;
  // Keep the live application and its language current; only network failure uses offline help.
  event.respondWith(fetch(event.request).catch(() => caches.open(CACHE)
    .then((cache) => cache.match('/offline.html'))));
});

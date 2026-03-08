// A minimal Service Worker to satisfy PWA install requirements
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    return caches.delete(cacheName);
                })
            );
        }).then(() => {
            self.clients.claim();
        })
    );
});

self.addEventListener('fetch', (e) => {
    // Simply fetch as normal, acting as a pass-through
    e.respondWith(fetch(e.request));
});

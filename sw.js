const CACHE_NAME = 'coc-media-cache-v3.0.1';
const ASSETS_TO_PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './image_ad59c0.jpg',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_PRECACHE).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('fcmregistrations.googleapis.com') ||
    url.hostname.includes('firebaseinstallations.googleapis.com') ||
    url.pathname.includes('firebase-messaging-sw.js')
  ) {
    return;
  }

  if (url.origin === 'https://www.gstatic.com' && url.pathname.includes('/firebasejs/10.8.1/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  const isImageOrFont =
    url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/i) ||
    event.request.destination === 'image' ||
    event.request.destination === 'font';

  if (isImageOrFont) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  const isNavigation = event.request.mode === 'navigate';
  const isSameOriginCode = url.origin === self.location.origin;

  if (isNavigation || isSameOriginCode) {
    event.respondWith(
      caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
        const networkPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => {
            if (cachedResponse) return cachedResponse;
            if (isNavigation) {
              return caches.match('./index.html', { ignoreSearch: true }).then((indexFallback) => indexFallback || caches.match('./'));
            }
            return new Response('Offline - network unavailable', { status: 503, statusText: 'Service Unavailable' });
          });

        return cachedResponse || networkPromise;
      })
    );
    return;
  }
});

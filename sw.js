// Service Worker for COC Media Team PWA (v2.1.1) - GitHub Pages Compatible
const CACHE_NAME = 'coc-media-v2.1.1-r2';
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
      return cache.addAll(ASSETS_TO_PRECACHE).catch((err) => {
        console.warn('Pre-caching some assets failed (continuing safely):', err);
      });
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

  // 1. NEVER intercept or cache auth, firestore, FCM, installation endpoints or messaging worker
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

  // 2. Cache-First Strategy for versioned Firebase CDN modules
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

  // 3. Stale-While-Revalidate Strategy for images, icons, and fonts
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

  // 4. Network-First Strategy with 3-second timeout for same-origin app shell (HTML, JS, CSS, JSON)
  if (url.origin === self.location.origin) {
    event.respondWith(
      new Promise((resolve) => {
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          caches.match(event.request).then((cached) => {
            if (cached) resolve(cached);
          });
        }, 3000);

        fetch(event.request)
          .then((networkResponse) => {
            clearTimeout(timer);
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            if (!timedOut) {
              resolve(networkResponse);
            }
          })
          .catch(() => {
            clearTimeout(timer);
            caches.match(event.request).then((cached) => {
              if (cached) {
                resolve(cached);
              } else if (event.request.mode === 'navigate') {
                caches.match('./index.html').then((indexFallback) => resolve(indexFallback));
              } else {
                resolve(new Response('Network error', { status: 503, statusText: 'Service Unavailable' }));
              }
            });
          });
      })
    );
    return;
  }
});

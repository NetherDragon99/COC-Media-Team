const CACHE_VERSION = 'v3.2.1';
const CACHE_NAME = 'coc-media-cache-v3.2.1';
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

self.addEventListener('push', (event) => {
  let data = {
    title: 'CoC Media Team',
    body: 'New update available',
    icon: './pwa-192x192.png',
    badge: './pwa-192x192.png',
    url: './'
  };
  if (event.data) {
    try {
      const parsed = event.data.json();
      const notif = parsed.notification || (parsed.data ? parsed.data : parsed);
      data = Object.assign(data, notif, parsed.data || {});
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const notifyClients = clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    clientList.forEach((client) => {
      client.postMessage({
        type: 'NEW_PUSH_NOTIFICATION',
        payload: data
      });
    });
  });

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'CoC Media Team', {
        body: data.body || 'New update available',
        icon: data.icon || './pwa-192x192.png',
        badge: data.badge || './pwa-192x192.png',
        vibrate: [200, 100, 200],
        data: { url: data.url || './' }
      }),
      notifyClients
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
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
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('script.googleusercontent.com') ||
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

  const isNavigation = event.request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname === '/' ||
    url.pathname === './';

  // STRICT NETWORK-FIRST STRATEGY FOR NAVIGATION TO PREVENT STALE BOOT/LOADING
  if (isNavigation) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match('./index.html', { ignoreSearch: true }).then((indexFallback) => {
              return indexFallback || caches.match('./');
            });
          });
        })
    );
    return;
  }

  const isSameOriginCode = url.origin === self.location.origin;

  if (isSameOriginCode) {
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
            return new Response('Offline - network unavailable', { status: 503, statusText: 'Service Unavailable' });
          });

        return cachedResponse || networkPromise;
      })
    );
    return;
  }
});

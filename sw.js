const CACHE_VERSION = 'v3.2.10';
const CACHE_NAME = 'coc-media-cache-v3.2.10';
const APP_SEMVER = CACHE_VERSION.replace(/^v/i, '');
const ASSETS_TO_PRECACHE = [
  './',
  './index.html',
  `./tailwind.generated.css?v=${APP_SEMVER}`,
  `./styles.css?v=${APP_SEMVER}`,
  `./vendor/firebase-sdk.js?v=${APP_SEMVER}`,
  `./app.js?v=${APP_SEMVER}`,
  `./manifest.json?v=${APP_SEMVER}`,
  './image_ad59c0.jpg',
  './pwa-192x192.png',
  './pwa-512x512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        ASSETS_TO_PRECACHE.map(async (assetUrl) => {
          try {
            const res = await fetch(assetUrl, { cache: 'reload' });
            if (res && res.status === 200) {
              await cache.put(assetUrl, res.clone());
              if (assetUrl === './index.html') {
                await cache.put('./', res.clone());
              }
            }
          } catch (e) {}
        })
      );
      // Only activate immediately on brand-new install (no existing controller).
      // On updates, remain in `waiting` until user taps "Update Now" or reopens the app next session.
      if (!self.registration || !self.registration.active) {
        await self.skipWaiting();
      }
    })
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
  const msg = event.data;
  if (msg === 'skipWaiting' || (msg && msg.type === 'SKIP_WAITING')) {
    self.skipWaiting();
    return;
  }
  if (msg === 'PURGE_OLD_CACHES' || (msg && msg.type === 'PURGE_OLD_CACHES')) {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
      )
    );
  }
});

self.addEventListener('push', (event) => {
  const scopeBase = (self.registration && self.registration.scope) || (self.location.origin + '/COC-Media-Team/');
  const defaultIconUrl = new URL('./pwa-192x192.png', scopeBase).href;
  const isImageUrl = (v) => typeof v === 'string' && /^(https?:\/\/|\.?\/).+\.(png|jpe?g|webp|ico|svg)(\?.*)?$/i.test(v.trim());

  let data = {
    title: 'CoC Media Team',
    body: '',
    icon: defaultIconUrl,
    badge: defaultIconUrl,
    url: './',
    targetRoute: '',
    targetItemId: '',
    tag: ''
  };
  if (event.data) {
    try {
      const parsed = event.data.json();
      const webpushNotif = parsed.webpush && parsed.webpush.notification ? parsed.webpush.notification : {};
      const notif = parsed.notification || {};
      const payloadData = parsed.data || {};
      data = Object.assign(
        data,
        typeof parsed === 'object' ? parsed : {},
        notif,
        webpushNotif,
        payloadData
      );
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const rawTitle = String(data.title || 'CoC Media Team').trim();
  let rawBody = String(data.body || data.message || '').trim();
  if (rawBody && rawTitle && rawBody.toLowerCase() === rawTitle.toLowerCase()) {
    rawBody = '';
  }
  const title = rawTitle || 'CoC Media Team';
  const body = rawBody;
  const rawIcon = data.iconUrl || data.icon;
  const rawBadge = data.badgeUrl || data.badge;
  const icon = isImageUrl(rawIcon) ? new URL(rawIcon.trim(), scopeBase).href : defaultIconUrl;
  const badge = isImageUrl(rawBadge) ? new URL(rawBadge.trim(), scopeBase).href : defaultIconUrl;
  const inAppIcon = (!isImageUrl(data.inAppIcon || data.iconKey || data.icon) ? (data.inAppIcon || data.iconKey || data.icon) : 'bell') || 'bell';
  const targetRoute = String(data.targetRoute || '').trim();
  const targetItemId = String(data.targetItemId || '').trim();
  const url = data.url || (data.fcm_options && data.fcm_options.link) || (targetRoute ? `./#${targetRoute}` : './');
  const tag = String(data.tag || data.dedupKey || data.notifId || `${title}::${body}`).slice(0, 120);

  const notifyClients = clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
    clientList.forEach((client) => {
      client.postMessage({
        type: 'NEW_PUSH_NOTIFICATION',
        payload: { ...data, title, body, url, icon: inAppIcon, iconUrl: icon, targetRoute, targetItemId, tag }
      });
    });
  });

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body,
        icon,
        badge,
        tag,
        renotify: false,
        vibrate: [200, 100, 200],
        data: { url, targetRoute, targetItemId, tag }
      }),
      notifyClients
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const nData = (event.notification && event.notification.data) || {};
  const rawUrl = nData.url || '/COC-Media-Team/';
  const targetRoute = nData.targetRoute || '';
  const targetItemId = nData.targetItemId || '';
  const scopeBase = (self.registration && self.registration.scope) || (self.location.origin + '/COC-Media-Team/');
  const targetUrl = new URL(rawUrl, scopeBase).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client && client.url && client.url.startsWith(scopeBase)) {
          await client.focus();
          client.postMessage({
            type: 'OPEN_NOTIFICATION_TARGET',
            targetRoute,
            targetItemId,
            url: targetUrl
          });
          return client;
        }
      }
      for (const client of windowClients) {
        if ('focus' in client) {
          await client.focus();
          client.postMessage({
            type: 'OPEN_NOTIFICATION_TARGET',
            targetRoute,
            targetItemId,
            url: targetUrl
          });
          return client;
        }
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

  const isNavigation = event.request.mode === 'navigate' ||
    url.pathname.endsWith('/index.html') ||
    url.pathname === '/' ||
    url.pathname.endsWith('/COC-Media-Team/');

  // INSTANT CACHE-FIRST APP SHELL FOR NAVIGATION:
  // Opens immediately in <5ms both online and offline without waiting on network round-trips!
  // New app versions are discovered via background `sw.js` update checks and pre-warmed cleanly.
  if (isNavigation) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cachedIndex = (await cache.match('./index.html')) || (await cache.match('./'));
        if (cachedIndex) {
          return cachedIndex;
        }
        try {
          const networkResponse = await fetch(event.request, { cache: 'no-cache' });
          if (networkResponse && networkResponse.status === 200) {
            cache.put('./index.html', networkResponse.clone());
            cache.put('./', networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          const anyFallback = (await caches.match('./index.html', { ignoreSearch: true })) || (await caches.match('./', { ignoreSearch: true }));
          if (anyFallback) return anyFallback;
          return new Response('Offline - App shell not yet cached', { status: 503, statusText: 'Service Unavailable' });
        }
      })
    );
    return;
  }

  const isSameOriginAsset = url.origin === self.location.origin;

  if (isSameOriginAsset) {
    const requestedVersion = url.searchParams.get('v');
    const isVersionMismatch = Boolean(requestedVersion && requestedVersion !== APP_SEMVER);

    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        // Never serve an older cached JS/CSS bundle if a newer `?v=` version was requested
        if (isVersionMismatch) {
          try {
            const freshRes = await fetch(event.request, { cache: 'reload' });
            if (freshRes && freshRes.status === 200) {
              cache.put(event.request, freshRes.clone());
            }
            return freshRes;
          } catch (err) {
            return (await cache.match(event.request)) || (await caches.match(event.request, { ignoreSearch: true })) ||
              new Response('Offline', { status: 503 });
          }
        }

        // Instant Cache-First hit for all current-version local assets (CSS, JS, Vendor SDK, Images, Manifest)
        const exactMatch = await cache.match(event.request);
        if (exactMatch) return exactMatch;

        const ignoreSearchMatch = !requestedVersion ? await cache.match(event.request, { ignoreSearch: true }) : null;
        if (ignoreSearchMatch) return ignoreSearchMatch;

        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          const fallback = await caches.match(event.request, { ignoreSearch: true });
          if (fallback) return fallback;
          return new Response('Offline - asset unavailable', { status: 503, statusText: 'Service Unavailable' });
        }
      })
    );
  }
});

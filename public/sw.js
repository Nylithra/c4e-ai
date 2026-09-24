// Code4Ever PWA Service Worker v2 - Resilient Offline & Notification Engine
// v3: simge dosyası değişti (/logo.png aslında .png uzantılı bir SVG idi ve tarayıcı onu
// reddediyordu). Sürüm yükseltilmezse kurulu uygulamalar eski, bozuk dosyayı önbellekten
// sunmaya devam eder — activate aşaması yalnızca ADI FARKLI önbellekleri siliyor.
const CACHE_NAME = 'c4e-pwa-cache-v3';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo-192.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Robust asset precaching: cache each individually so 1 failure doesn't block install
      await Promise.allSettled(
        PRECACHE_ASSETS.map((asset) => cache.add(asset).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only same-origin GET requests are cached. Caching cross-origin responses would let a
  // third-party host poison the cache with a script that then runs on our origin, and also
  // risks storing personalised/authenticated responses in a shared cache.
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api') ||
    url.protocol.startsWith('ws') ||
    event.request.headers.has('Authorization')
  ) {
    return;
  }

  // 1. Navigation requests (HTML): Network-first with cache fallback
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
        })
    );
    return;
  }

  // 2. Static Assets: Cache-first with background revalidation
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background for asset revalidation
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            (event.request.destination === 'image' ||
              event.request.destination === 'style' ||
              event.request.destination === 'script' ||
              event.request.destination === 'font')
          ) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          // If offline and looking for index fallback
          const fallback = await caches.match('/index.html');
          return fallback || new Response('', { status: 408, statusText: 'Request Timeout' });
        });
    })
  );
});

// Push & Notification Click Handlers
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Only same-origin destinations: a push payload must never be able to open an arbitrary
  // external page on the user's behalf.
  const rawUrl = (event.notification.data && event.notification.data.url) || '/';
  let targetUrl = '/';
  try {
    const resolved = new URL(rawUrl, self.location.origin);
    if (resolved.origin === self.location.origin) {
      targetUrl = resolved.href;
    }
  } catch (e) {
    targetUrl = '/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const data = event.data.json();
      const title = data.title || 'Code4Ever';
      const options = {
        body: data.body || 'Yeni bir bildiriminiz var.',
        icon: data.icon || '/logo-192.png',
        badge: '/logo-192.png',
        vibrate: [100, 50, 100, 50, 200],
        tag: data.tag || 'c4e-notification',
        renotify: true,
        data: {
          // Resolved and origin-checked in the notificationclick handler above.
          url: typeof data.url === 'string' ? data.url : '/'
        }
      };
      event.waitUntil(self.registration.showNotification(title, options));
    } catch (e) {
      console.warn('Error displaying push notification:', e);
    }
  }
});


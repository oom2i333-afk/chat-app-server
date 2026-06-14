// WeTalk - Service Worker v1.0
const CACHE_NAME = 'wetalk-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/webrtc.css',
  '/app.js',
  '/webrtc.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ─── 安装 ─────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ─── 激活 ─────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      );
    }).then(() => self.clients.claim())
  );
});

// ─── 请求拦截 ─────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  // API 请求不缓存
  if (e.request.url.includes('/api/')) {
    return;
  }

  // Socket.io 不缓存
  if (e.request.url.includes('/socket.io/')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      return cached || fetch(e.request).then((response) => {
        // 缓存静态资源
        if (e.request.url.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff2?)$/)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, clone);
          });
        }
        return response;
      }).catch(() => {
        // 离线时返回缓存的首页
        if (e.request.mode === 'navigate') {
          return caches.match('/');
        }
        return new Response('离线', { status: 503 });
      });
    })
  );
});

// ─── 推送通知 ─────────────────────────────────────────────
self.addEventListener('push', (e) => {
  const data = e.data?.json() || { title: 'WeTalk', body: '新消息' };
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
  };
  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientsList) => {
      if (clientsList.length > 0) {
        return clientsList[0].focus();
      }
      return clients.openWindow(e.notification.data?.url || '/');
    })
  );
});

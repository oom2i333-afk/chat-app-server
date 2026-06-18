// WeTalk - Service Worker v6.0
// Network-first for JS/CSS (cache-busting with version query), cache-first for images/fonts, offline fallback

const CACHE_NAME = 'wetalk-v6';
const STATIC_CACHE = 'wetalk-static-v6';
const DYNAMIC_CACHE = 'wetalk-dynamic-v6';
const OFFLINE_PAGE = '/offline.html';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/webrtc.css',
  '/app.js',
  '/webrtc.js',
  '/manifest.json',
  '/icons/icon-48.png',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
  '/offline.html',
];

const IGNORE_CACHE = [
  '/api/',
  '/socket.io/',
  'chrome-extension://',
  'extension://',
];

const CACHE_EXTENSIONS = [
  '.css', '.js', '.png', '.jpg', '.jpeg', '.gif',
  '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot',
  '.webp', '.avif',
];

// ─── 安装：预缓存所有静态资源 ───────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Fail gracefully if a resource is missing
      const results = await Promise.allSettled(
        STATIC_ASSETS.map((url) => cache.add(url).catch((err) => {
          console.warn('[SW] Failed to cache', url, err);
        }))
      );
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        console.warn(`[SW] ${failed} static assets failed to cache`);
      }
      await self.skipWaiting();
    })()
  );
});

// ─── 激活：清理旧缓存 ───────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

// ─── 辅助：判断 URL 是否可缓存 ─────────────────────────────
function shouldCache(url) {
  const urlStr = url.toString();
  for (const prefix of IGNORE_CACHE) {
    if (urlStr.includes(prefix)) return false;
  }
  const pathname = new URL(urlStr).pathname;
  return CACHE_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

// ─── 辅助：缓存并限制动态缓存大小 ─────────────────────────
async function cacheWithLimit(cacheName, request, response, maxItems = 50) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length >= maxItems) {
    // Delete the oldest entry
    await cache.delete(keys[0]);
  }
  cache.put(request, response.clone());
}

// ─── 请求拦截 ─────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    // For cross-origin resources (CDN), use stale-while-revalidate
    if (request.destination === 'style' || request.destination === 'script' || request.destination === 'font') {
      e.respondWith(
        caches.match(request).then((cached) => {
          const fetchPromise = fetch(request)
            .then((response) => {
              if (response.ok && shouldCache(request.url)) {
                caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, response.clone()));
              }
              return response;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      );
    }
    return;
  }

  // API 请求不缓存，网络优先
  if (IGNORE_CACHE.some((prefix) => url.pathname.startsWith(prefix))) {
    // WebSocket / Socket.io — pass through, no caching
    if (url.pathname.startsWith('/socket.io/')) return;
    // API — network first with offline fallback
    e.respondWith(
      fetch(request)
        .then((response) => response)
        .catch(() => {
          return new Response(
            JSON.stringify({ success: false, error: '离线模式，无法连接服务器' }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // 导航请求 — 网络优先，离线回退到缓存首页或离线页
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the latest page
          const clone = response.clone();
          caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offlinePage = await caches.match(OFFLINE_PAGE);
          return offlinePage || new Response('离线', { status: 503 });
        })
    );
    return;
  }

  // 脚本和样式 — 网络优先，缓存后备（防止新旧代码混用）
  if (request.destination === 'script' || request.destination === 'style' || url.pathname.match(/\.(js|css)($|\?)/)) {
    e.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) cacheWithLimit(DYNAMIC_CACHE, request, response);
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || new Response('', { status: 503 });
        })
    );
    return;
  }

  // 静态资源 (图片、字体等) — 缓存优先，网络更新
  if (CACHE_EXTENSIONS.some((ext) => url.pathname.endsWith(ext))) {
    e.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((response) => {
            if (response.ok) {
              cacheWithLimit(DYNAMIC_CACHE, request, response);
            }
            return response;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 其他所有请求 — 网络优先
  e.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && shouldCache(request.url)) {
          cacheWithLimit(DYNAMIC_CACHE, request, response);
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        return cached || new Response('请求失败', { status: 503 });
      })
  );
});

// ─── 推送通知 ─────────────────────────────────────────────
self.addEventListener('push', (e) => {
  let data;
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || 'WeTalk';
  const options = {
    body: data.body || '新消息',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    image: data.image || undefined,
    vibrate: data.vibrate || [200, 100, 200],
    tag: data.tag || 'chat-message',
    renotify: true,
    requireInteraction: true,
    silent: false,
    data: {
      url: data.url || '/',
      messageId: data.messageId || null,
      chatId: data.chatId || null,
      senderId: data.senderId || null,
      dateOfArrival: Date.now(),
    },
    actions: data.actions || [
      { action: 'open', title: '打开聊天' },
      { action: 'reply', title: '快速回复' },
    ],
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const action = e.action;
  const targetUrl = e.notification.data?.url || '/';

  if (action === 'reply') {
    // For quick reply, open the chat and focus the input
    e.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
        if (clientsList.length > 0) {
          clientsList[0].focus();
          clientsList[0].postMessage({ type: 'FOCUS_INPUT' });
        } else {
          clients.openWindow(targetUrl);
        }
      })
    );
    return;
  }

  // Default: open chat or app
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('notificationclose', (e) => {
  console.log('[SW] Notification closed', e.notification.tag);
});

// ─── 后台同步 ─────────────────────────────────────────────
self.addEventListener('sync', (e) => {
  if (e.tag === 'sync-messages') {
    e.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  try {
    const db = await openMessageDB();
    const pending = await db.getAll('pending_messages');
    for (const msg of pending) {
      try {
        const resp = await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(msg),
        });
        if (resp.ok) {
          await db.delete('pending_messages', msg.id);
        }
      } catch (err) {
        console.warn('[SW] Failed to sync message', msg.id, err);
        break; // stop retrying until next sync event
      }
    }
  } catch (err) {
    console.warn('[SW] Sync failed', err);
  }
}

function openMessageDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('WeTalkSW', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pending_messages')) {
        db.createObjectStore('pending_messages', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── 消息通道（接收来自页面客户端的消息） ───────────────────
self.addEventListener('message', (e) => {
  if (!e.data) return;
  const { type } = e.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
    case 'CLEAR_CACHE':
      caches.delete(STATIC_CACHE);
      caches.delete(DYNAMIC_CACHE);
      break;
    case 'STORE_MESSAGE': {
      // Store a pending message for background sync
      const { message } = e.data;
      if (message && navigator.onLine === false) {
        openMessageDB().then((db) => {
          const tx = db.transaction('pending_messages', 'readwrite');
          tx.objectStore('pending_messages').add(message);
        });
        self.registration.sync.register('sync-messages');
      }
      break;
    }
  }
});

// ─── 定期同步（Chrome 80+） ─────────────────────────────────
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'check-notifications') {
    e.waitUntil(checkNewNotifications());
  }
});

async function checkNewNotifications() {
  try {
    const resp = await fetch('/api/notifications/check', {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.hasNew && data.count > 0) {
        self.registration.showNotification('WeTalk', {
          body: `你有 ${data.count} 条未读消息`,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-72.png',
          tag: 'periodic-check',
        });
      }
    }
  } catch {
    // Offline, skip silently
  }
}

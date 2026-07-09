const CACHE_NAME = "rk-bill-desk-v1";
// Only include files that actually exist in your 'dist' folder after build
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json"
];

// Install Event: cache core app shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log("[Service Worker] Caching App Shell static assets...");
      try {
        await cache.addAll(ASSETS_TO_CACHE);
      } catch (err) {
        console.warn("[Service Worker] Some assets failed to cache:", err);
      }
      return self.skipWaiting();
    })
  );
});

// Activate Event: clear out outdated cache storage blocks
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[Service Worker] Pruning old cache store:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: respond with cache-first strategy with network fallback
self.addEventListener("fetch", (event) => {
  if (!event.request.url.startsWith("http")) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached asset immediately, update in background
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => { /* silent ignore */ });
        return cachedResponse;
      }

      // If not in cache, fallback to regular network request
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && event.request.method === "GET") {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});
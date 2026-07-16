const CACHE_VERSION = "pp-pwa-v2";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const OFFLINE_URL = "{{ offline_url|escapejs }}";
const ICON_URL = "{{ icon_url|escapejs }}";

const PRECACHE_URLS = [
  OFFLINE_URL,
  ICON_URL
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then(function (cache) {
        return cache.addAll(PRECACHE_URLS);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function (cacheName) {
              return (
                cacheName.startsWith("pp-pwa-")
                && cacheName !== STATIC_CACHE
              );
            })
            .map(function (cacheName) {
              return caches.delete(cacheName);
            })
        );
      })
      .then(function () {
        return self.clients.claim();
      })
  );
});

self.addEventListener("fetch", function (event) {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  const pathname = requestUrl.pathname;

  if (
    pathname.startsWith("/admin/")
    || pathname.startsWith("/owner/")
  ) {
    return;
  }

  /*
   * Page navigations:
   * Always try network first so prices, stock and products remain fresh.
   * Show offline page only when the network is unavailable.
   */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(function () {
        return caches.match(OFFLINE_URL);
      })
    );

    return;
  }

  /*
   * Static assets:
   * Use cache first for faster CSS, JavaScript and icons.
   */
  if (pathname.startsWith("/static/")) {
    event.respondWith(
      caches.match(request).then(function (cachedResponse) {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then(function (networkResponse) {
          if (
            !networkResponse
            || !networkResponse.ok
          ) {
            return networkResponse;
          }

          const responseCopy = networkResponse.clone();

          caches.open(STATIC_CACHE).then(function (cache) {
            cache.put(request, responseCopy);
          });

          return networkResponse;
        });
      })
    );
  }
});
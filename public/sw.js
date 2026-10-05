// public/sw.js
const MEDIA_CACHE_NAME = "prepwise-media-v1";

// Domains to strictly bypass (Live real-time network only)
const BYPASS_DOMAINS = [
  "supabase.co",
  "identitytoolkit.googleapis.com",
  "fcm.googleapis.com",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== MEDIA_CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. STRICT BYPASS: Supabase, APIs, and Non-GET requests
  if (
    request.method !== "GET" ||
    BYPASS_DOMAINS.some((domain) => url.hostname.includes(domain)) ||
    url.pathname.startsWith("/api/")
  ) {
    return; // Pass through to live network
  }

  // 2. CACHE-FIRST for Cloudinary Media & Static Assets
  const isCloudinaryImage = url.hostname.includes("cloudinary.com");
  const isImageOrFont =
    request.destination === "image" ||
    request.destination === "font" ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|woff2)$/i);

  if (isCloudinaryImage || isImageOrFont) {
    event.respondWith(
      caches.open(MEDIA_CACHE_NAME).then(async (cache) => {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse; // 0ms Instant delivery from local phone storage!
        }

        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (_) {
          return cachedResponse || new Response("", { status: 408 });
        }
      })
    );
    return;
  }

  // 3. NETWORK-FIRST for HTML/App Pages (Ensures new Cloudflare updates are never stuck)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
  }
});

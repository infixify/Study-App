// public/sw.js
const CODE_CACHE_NAME = "prepwise-static-code-v1";
const MEDIA_CACHE_NAME = "prepwise-media-v1";

// Live Real-Time APIs: Inko kabhi cache mat karo
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
        keys
          .filter((k) => k !== CODE_CACHE_NAME && k !== MEDIA_CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. STRICT BYPASS: Supabase & dynamic API endpoints (Always live)
  if (
    request.method !== "GET" ||
    BYPASS_DOMAINS.some((domain) => url.hostname.includes(domain)) ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  // 2. IMMUTABLE CODE CHUNKS (Next.js Hashed JS/CSS - 0ms instant disk load)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CODE_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached; // Served instantly from local device!

        try {
          const networkRes = await fetch(request);
          if (networkRes && networkRes.status === 200) {
            cache.put(request, networkRes.clone());
          }
          return networkRes;
        } catch (_) {
          return cached || new Response("", { status: 408 });
        }
      })
    );
    return;
  }

  // 3. CLOUDINARY & MEDIA ASSETS (Cache-First)
  const isCloudinary = url.hostname.includes("cloudinary.com");
  const isMedia =
    request.destination === "image" ||
    request.destination === "font" ||
    url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|woff2)$/i);

  if (isCloudinary || isMedia) {
    event.respondWith(
      caches.open(MEDIA_CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const networkRes = await fetch(request);
          if (networkRes && networkRes.status === 200) {
            cache.put(request, networkRes.clone());
          }
          return networkRes;
        } catch (_) {
          return cached || new Response("", { status: 408 });
        }
      })
    );
    return;
  }

  // 4. HTML PAGES (Network-First with fallback — Ensures new deploys are instantly picked up)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
  }
});

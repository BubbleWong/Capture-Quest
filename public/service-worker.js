const assetVersion = new URL(self.location.href).searchParams.get("v") || "dev";
const cacheName = `capture-quest-${assetVersion}`;
const versionedAsset = (path) => `${path}?v=${encodeURIComponent(assetVersion)}`;
const staticAssets = [
  "/",
  "/index.html",
  versionedAsset("/styles.css"),
  versionedAsset("/scripts/app.js"),
  versionedAsset("/assets/quest-camera.svg"),
  versionedAsset("/manifest.webmanifest")
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(staticAssets)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== cacheName).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/socket.io") || url.pathname.startsWith("/api")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(cacheName).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

const CACHE = "kalakeli-v1";
const ASSETS = ["./","./index.html","./style.css","./app.js","./manifest.webmanifest","./assets/icon.svg","./assets/hauki.png","./assets/ahven.png","./assets/kuha.png"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))));
self.addEventListener("fetch", event => { if(event.request.method !== "GET") return; event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { const copy=response.clone(); if(new URL(event.request.url).origin === location.origin) caches.open(CACHE).then(cache => cache.put(event.request,copy)); return response; }).catch(() => cached))); });

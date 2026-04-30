const cacheName = 'matrix-vfinal';
const assets = ['./', 'index.html', 'style.css', 'script.js', 'manifest.json', 'icon.png'];
self.addEventListener('install', e => {
    e.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)));
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== cacheName).map(k => caches.delete(k)))));
});
self.addEventListener('fetch', e => {
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});

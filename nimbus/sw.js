// Service worker : fonctionnement hors-ligne de l'interface + réception des photos partagées (Android)
const CACHE = 'nimbus-v1';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './providers.js', './crypto.js', './db.js', './config.js',
  './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // les appels aux clouds ne passent jamais par le cache
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) { e.respondWith(handleShare(e.request)); return; }
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && !url.search) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
});

function storeInbox(files) {
  return new Promise((res, rej) => {
    const r = indexedDB.open('nimbus', 1);
    r.onupgradeneeded = () => { for (const s of ['kv', 'thumbs', 'inbox']) if (!r.result.objectStoreNames.contains(s)) r.result.createObjectStore(s); };
    r.onsuccess = () => {
      const t = r.result.transaction('inbox', 'readwrite'), st = t.objectStore('inbox');
      files.forEach((f, i) => st.put(f, `${Date.now()}-${i}`));
      t.oncomplete = res; t.onerror = () => rej(t.error);
    };
    r.onerror = () => rej(r.error);
  });
}
async function handleShare(req) {
  const fd = await req.formData();
  await storeInbox(fd.getAll('media').filter(f => f instanceof File));
  return Response.redirect('./?shared=1', 303);
}

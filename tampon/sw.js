/* Tampon : fonctionnement hors ligne. Seuls les fichiers de Tampon et les polices sont mis en cache. */
const CACHE='tampon-v5';
const CORE=['./','./index.html','./app.js?v=5','./vendor/jspdf-2.5.1.umd.min.js','./vendor/pdf-lib-1.17.1.min.js','./manifest.webmanifest?v=2',
 './icons/icon.svg','./icons/icon-192.png','./icons/tampon-32.png','./icons/tampon-ios-180-v2.png'];
const SCOPE=new URL('./',self.location).pathname;
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>Promise.all(CORE.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n.startsWith('tampon-')&&n!==CACHE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const url=new URL(r.url);
  const own=url.origin===location.origin&&url.pathname.startsWith(SCOPE);
  const font=/^fonts\.(googleapis|gstatic)\.com$/.test(url.host);
  if(!own&&!font)return;
  if(r.mode==='navigate'){e.respondWith(fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put('./index.html',cp))}return res}).catch(()=>caches.match('./index.html')));return}
  e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(CACHE).then(c=>c.put(r,cp))}return res})));
});

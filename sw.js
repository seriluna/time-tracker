const CACHE='time-tracker-v30';const FILES=['./','./index.html','./style.css','./app.js','./manifest.json','./icon.svg','./icon-192.svg','./icon-512.svg','./icon-192.png','./icon-512.png'];self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(a=>Promise.all(a.filter(k=>k.startsWith('time-tracker-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const request=e.request,url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 const refresh=fetch(request).then(response=>{
  if(response&&response.ok){const copy=response.clone();return caches.open(CACHE).then(cache=>cache.put(request,copy)).then(()=>response)}
  return response;
 }).catch(()=>null);
 e.waitUntil(refresh.then(()=>{}));
 e.respondWith((async()=>{
  const cached=await caches.match(request);
  if(cached)return cached;
  return (await refresh)||await caches.match('./');
 })());
});
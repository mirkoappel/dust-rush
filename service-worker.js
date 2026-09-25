const VERSION='1d4aad84d77c8e26';
const PREFIX='dust-rush:'+self.registration.scope+':';
const CACHE=PREFIX+VERSION;
const ROOT=new URL('./',self.location.href).href;
const FILES=['./','./index.html','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png','./assets/icon-maskable.png','./assets/apple-touch-icon.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(path=>new URL(path,ROOT).href))));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(ROOT))return;
  if(request.mode==='navigate'){
    event.respondWith((async()=>{try{const response=await fetch(request);if(response.ok){const cache=await caches.open(CACHE);await cache.put(new URL('./index.html',ROOT).href,response.clone());return response;}throw new Error('Offline');}catch{return (await caches.match(new URL('./index.html',ROOT).href))||Response.error();}})());
  }else if(FILES.some(path=>new URL(path,ROOT).href===url.href)){
    event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
  }
});


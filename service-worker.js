const VERSION='171e60f5b3c4f6a7';
const PREFIX='dust-rush:'+self.registration.scope+':';
const CACHE=PREFIX+VERSION;
const ROOT=new URL('./',self.location.href).href;
const INDEX=new URL('./index.html',ROOT).href;
// One copy of the self-contained game, not another 11 MB copy under "/".
const FILES=['./index.html','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png','./assets/icon-maskable.png','./assets/apple-touch-icon.png'];
const NETWORK_TIMEOUT_MS=15000;
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(path=>new Request(new URL(path,ROOT).href,{cache:'reload'})))));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();});

async function fetchWithDeadline(request){
  const controller=new AbortController();let timer;
  try{
    return await Promise.race([
      fetch(request,{signal:controller.signal}),
      new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('Navigation timed out'));},NETWORK_TIMEOUT_MS);})
    ]);
  }finally{clearTimeout(timer);}
}
function retryPage(){
  // This needs no JavaScript or downloaded assets and can replace Android's
  // native splash even when the game has never been cached successfully.
  return new Response(`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DUST RUSH</title><style>body{margin:0;min-height:100vh;display:grid;place-content:center;gap:24px;text-align:center;background:#142d35;color:#fff1d5;font:20px system-ui}h1{margin:0;font-style:italic}p{max-width:28ch;margin:0 auto}a{justify-self:center;display:grid;place-items:center;width:80px;height:80px;border-radius:22px;background:#c5e679;color:#142d35;text-decoration:none;font-size:48px}</style><h1>DUST RUSH</h1><p>Das Spiel ist noch nicht offline bereit. Bitte die Verbindung prüfen und noch einmal versuchen.</p><a href="./" aria-label="Erneut versuchen">↻</a></html>`,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
}
async function navigate(request){
  try{
    // Pin navigation to the active worker's version. A newer worker prepares
    // its own cache; the existing main-menu update gate still decides when to switch.
    const cache=await caches.open(CACHE);
    const cached=await cache.match(INDEX);
    if(cached)return {response:cached};
  }catch{/* A disabled/full cache must not prevent an online start. */}
  try{
    const response=await fetchWithDeadline(request);
    if(!response.ok)throw new Error('Navigation failed');
    return {response,save:response.clone()};
  }catch{return {response:retryPage()};}
}
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(ROOT))return;
  if(request.mode==='navigate'){
    // Images/docs opened in their own tab are not game launches.
    const path=url.origin+url.pathname;
    if(path!==ROOT&&path!==INDEX)return;
    const navigation=navigate(request);
    event.respondWith(navigation.then(result=>result.response));
    // Saving may fail or be slow. Never hold the first response/paint behind it.
    event.waitUntil(navigation.then(async({save})=>{
      if(save)await (await caches.open(CACHE)).put(INDEX,save);
    }).catch(()=>{}));
  }else if(FILES.some(path=>new URL(path,ROOT).href===url.href)){
    event.respondWith(caches.open(CACHE).then(cache=>cache.match(request)).catch(()=>null).then(cached=>cached||fetch(request)));
  }
});

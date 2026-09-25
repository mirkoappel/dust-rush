import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
test('PWA-Manifest funktioniert unter dem GitHub-Pages-Unterpfad',()=>{
  const m=JSON.parse(read('manifest.webmanifest'));assert.equal(m.scope,'./');assert.equal(m.start_url,'./');assert.equal(m.display,'fullscreen');assert.equal(m.orientation,'landscape');
  assert.ok(m.icons.some(i=>i.sizes==='192x192'));assert.ok(m.icons.some(i=>i.sizes==='512x512'&&i.purpose==='maskable'));
  for(const icon of m.icons){const png=read(icon.src);const size=+icon.sizes.split('x')[0];assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
});
test('Service Worker speichert das Spiel und liefert es bei Netzfehlern aus dem Cache',async()=>{
  const events={},data=new Map(),cache={addAll:async requests=>{for(const request of requests){const url=request.url;assert.equal(request.cache,'reload');data.set(url,new Response(url.includes('index.html')?'offline-game':'asset'));}},put:async(k,v)=>data.set(k,v),match:async k=>data.get(typeof k==='string'?k:k.url)};
  const caches={open:async()=>cache,match:async key=>data.get(typeof key==='string'?key:key.url),keys:async()=>['unrelated-app'],delete:async()=>{throw new Error('Darf fremden Cache nicht löschen');}};
  const self={registration:{scope:'https://example.test/dust-rush/'},location:new URL('https://example.test/dust-rush/service-worker.js'),clients:{claim:async()=>{}},addEventListener:(type,fn)=>events[type]=fn};
  runInNewContext(read('service-worker.js').toString(),{self,caches,URL,Response,Request,AbortController,setTimeout,clearTimeout,fetch:async()=>{throw new Error('No network');}});
  let pending;events.install({waitUntil:p=>pending=p});await pending;events.activate({waitUntil:p=>pending=p});await pending;
  assert.ok(data.has('https://example.test/dust-rush/manifest.webmanifest'));
  assert.ok(!data.has('https://example.test/dust-rush/'),'Spiel wird nicht doppelt gespeichert');
  let response;events.fetch({request:{url:'https://example.test/dust-rush/',method:'GET',mode:'navigate'},respondWith:p=>response=p,waitUntil:p=>pending=p});
  assert.equal(await (await response).text(),'offline-game');
  await pending;
  let intercepted=false;events.fetch({request:{url:'https://example.test/another-app/',method:'GET',mode:'navigate'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});

function workerFixture({cached,fetchImpl=async()=>new Response('fresh-game'),put=async()=>{},openError=false}={}){
  const events={},timers=new Map(),lookups=[],writes=[],network=[];
  let nextTimer=0;
  const cache={match:async key=>{lookups.push(key);return cached?new Response(cached):undefined;},put:async(key,response)=>{writes.push(key);return put(key,response);}};
  const self={registration:{scope:'https://example.test/dust-rush/'},location:new URL('https://example.test/dust-rush/service-worker.js'),addEventListener:(type,fn)=>events[type]=fn};
  const caches={open:async()=>{if(openError)throw new Error('Storage unavailable');return cache;},match:()=>{throw new Error('Must not read another version or app cache');}};
  runInNewContext(read('service-worker.js').toString(),{
    self,caches,URL,Response,Request,AbortController,
    setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
    fetch:(request,options)=>{network.push({request,options});return fetchImpl(request,options);}
  });
  function navigate(url='https://example.test/dust-rush/'){
    let response,background;
    events.fetch({request:{url,method:'GET',mode:'navigate'},respondWith:p=>response=p,waitUntil:p=>background=p});
    return {response,background};
  }
  return {navigate,lookups,writes,network,timers};
}

test('Gespeicherte PWA startet ohne Netzaufruf, selbst wenn das Netz endlos wartet',async()=>{
  const f=workerFixture({cached:'saved-game',fetchImpl:()=>new Promise(()=>{})});
  const {response,background}=f.navigate();
  assert.equal(await (await response).text(),'saved-game');await background;
  assert.equal(f.network.length,0);assert.equal(f.writes.length,0);assert.equal(f.timers.size,0);
});

test('Startparameter verwenden dieselbe Offline-Datei; Bild- und Dokumentaufrufe bleiben unverändert',async()=>{
  const f=workerFixture({cached:'saved-game'});
  for(const path of ['?preview=phone','index.html?version=2']){
    const {response,background}=f.navigate('https://example.test/dust-rush/'+path);
    assert.equal(await (await response).text(),'saved-game');await background;
  }
  const {response,background}=f.navigate('https://example.test/dust-rush/docs/workshop.png');
  assert.equal(response,undefined);assert.equal(background,undefined);
  assert.equal(f.network.length,0);
});

test('Ein langsamer Cache-Schreibvorgang blockiert die fertige Netzantwort nicht',async()=>{
  let release;
  const f=workerFixture({put:()=>new Promise(resolve=>{release=resolve;})});
  const {response,background}=f.navigate();
  assert.equal(await (await response).text(),'fresh-game');
  assert.equal(f.writes.length,1);assert.equal(f.timers.size,0);
  release();await background;
});

test('Quota- und Speicherfehler verhindern keinen Online-Start',async()=>{
  for(const options of [{put:async()=>{throw new Error('QuotaExceededError');}},{openError:true}]){
    const f=workerFixture(options),{response,background}=f.navigate();
    assert.equal(await (await response).text(),'fresh-game');await background;
    assert.equal(f.network.length,1);
  }
});

test('Ohne gespeicherte Kopie beendet ein Timeout das Netzwarten mit einer Wiederholen-Seite',async()=>{
  const f=workerFixture({fetchImpl:()=>new Promise(()=>{})}),{response,background}=f.navigate();
  // Let cache lookup complete and the network deadline be scheduled.
  for(let i=0;i<6;i++)await Promise.resolve();
  assert.equal(f.timers.size,1);
  const timer=[...f.timers.values()][0];assert.equal(timer.ms,15000);timer.fn();
  const result=await response;
  assert.equal(result.status,503);assert.match(await result.text(),/Erneut versuchen/);
  assert.equal(f.network[0].options.signal.aborted,true);
  assert.equal(f.timers.size,0);assert.equal(f.writes.length,0);await background;
});

test('Ohne Cache zeigen Offline- und Serverfehler eine bedienbare Seite statt des System-Splashscreens',async()=>{
  for(const fetchImpl of [async()=>{throw new Error('Offline');},async()=>new Response('error',{status:503})]){
    const f=workerFixture({fetchImpl}),{response,background}=f.navigate(),result=await response;
    assert.equal(result.status,503);assert.equal(result.headers.get('Cache-Control'),'no-store');
    assert.match(await result.text(),/href="\.\/"/);await background;
    assert.equal(f.writes.length,0);assert.equal(f.timers.size,0);
  }
});
test('PWA-Registrierung wird beim direkten Dateistart übersprungen',()=>{
  const pwa=read('src/pwa.mjs').toString();assert.ok(pwa.includes("if(!/^https?:$/.test(location.protocol))return proceed;"));
  assert.ok(!read('service-worker.js').toString().includes('__VERSION__'));
});

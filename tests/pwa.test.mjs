import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
test('PWA-Manifest funktioniert unter dem GitHub-Pages-Unterpfad',()=>{
  const m=JSON.parse(read('manifest.webmanifest'));assert.equal(m.scope,'./');assert.equal(m.start_url,'./');assert.equal(m.display,'standalone');assert.equal(m.orientation,'landscape');
  assert.ok(m.icons.some(i=>i.sizes==='192x192'));assert.ok(m.icons.some(i=>i.sizes==='512x512'&&i.purpose==='maskable'));
  for(const icon of m.icons){const png=read(icon.src);const size=+icon.sizes.split('x')[0];assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}
});
test('Service Worker speichert das Spiel und liefert es bei Netzfehlern aus dem Cache',async()=>{
  const events={},data=new Map(),cache={addAll:async urls=>{for(const url of urls)data.set(url,new Response(url.includes('index.html')?'offline-game':'asset'));},put:async(k,v)=>data.set(k,v),match:async k=>data.get(k)};
  const caches={open:async()=>cache,match:async key=>data.get(typeof key==='string'?key:key.url),keys:async()=>['unrelated-app'],delete:async()=>{throw new Error('Darf fremden Cache nicht löschen');}};
  const self={registration:{scope:'https://example.test/dust-rush/'},location:new URL('https://example.test/dust-rush/service-worker.js'),clients:{claim:async()=>{}},addEventListener:(type,fn)=>events[type]=fn};
  runInNewContext(read('service-worker.js').toString(),{self,caches,URL,Response,fetch:async()=>{throw new Error('No network');}});
  let pending;events.install({waitUntil:p=>pending=p});await pending;events.activate({waitUntil:p=>pending=p});await pending;
  assert.ok(data.has('https://example.test/dust-rush/manifest.webmanifest'));
  let response;events.fetch({request:{url:'https://example.test/dust-rush/',method:'GET',mode:'navigate'},respondWith:p=>response=p});
  assert.equal(await (await response).text(),'offline-game');
  let intercepted=false;events.fetch({request:{url:'https://example.test/another-app/',method:'GET',mode:'navigate'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});
test('PWA-Registrierung wird beim direkten Dateistart übersprungen',()=>{
  const pwa=read('src/pwa.mjs').toString();assert.ok(pwa.includes("if(!/^https?:$/.test(location.protocol))return;"));
  assert.ok(!read('service-worker.js').toString().includes('__VERSION__'));
});


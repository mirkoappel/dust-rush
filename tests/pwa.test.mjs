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
test('PWA-Updates warten auf das Hauptmenü und brauchen keine zusätzlichen Menüknöpfe',async()=>{
  const events={},messages=[],nodes=[],waiting={postMessage:m=>messages.push(m)};
  let safe=false,reloads=0,registrations=0;
  const environment={
    location:{protocol:'https:',hostname:'example.test',href:'https://example.test/dust-rush/',reload:()=>reloads++},
    document:{createElement:()=>({}),head:{append:node=>nodes.push(node)},body:{dataset:{}}},
    navigator:{serviceWorker:{controller:{},ready:Promise.resolve(),addEventListener:(name,fn)=>events[name]=fn,register:async()=>{registrations++;return {waiting,addEventListener(){}};}}},
    URL,
  };
  const setup=runInNewContext(read('src/pwa.mjs').toString().replace('export function','function')+';setupPWA;',environment);
  const apply=setup({isSafe:()=>safe});
  await Promise.resolve();await Promise.resolve();
  assert.equal(registrations,1);assert.equal(messages.length,0);
  assert.ok(nodes.some(node=>node.rel==='manifest'));
  apply();assert.equal(messages.length,0);
  safe=true;apply();apply();assert.equal(messages.length,1);assert.equal(messages[0].type,'SKIP_WAITING');
  events.controllerchange();assert.equal(reloads,1);
  environment.location.protocol='file:';const local=setup({isSafe:()=>true});local();assert.equal(registrations,1);
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
  const pwa=read('src/pwa.mjs').toString();assert.ok(pwa.includes("if(!/^https?:$/.test(location.protocol))return noop;"));
  assert.ok(!read('service-worker.js').toString().includes('__VERSION__'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../src/pwa.mjs',import.meta.url),'utf8');
class Signal{
  listeners=new Map();
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);}
  removeEventListener(name,fn){this.listeners.get(name)?.delete(fn);}
  emit(name){for(const fn of [...this.listeners.get(name)||[]])fn();}
}
function fixture({controlled=true,online=true}={}){
  const messages=[],nodes=[],timers=new Map();let timerId=0,reloads=0,updates=0,registrations=0;
  const worker=state=>Object.assign(new Signal(),{state,postMessage:m=>messages.push(m)});
  const sw=Object.assign(new Signal(),{controller:controlled?worker('activated'):null,ready:Promise.resolve()});
  const reg=Object.assign(new Signal(),{waiting:null,installing:null,update:async()=>{updates++;return reg;}});
  sw.getRegistration=async()=>reg;
  sw.register=async()=>{registrations++;return reg;};
  sw.getRegistrations=async()=>[];
  const environment={
    location:{protocol:'https:',hostname:'example.test',href:'https://example.test/dust-rush/',reload:()=>reloads++},
    navigator:{serviceWorker:sw,onLine:online},
    document:{createElement:()=>({}),head:{append:node=>nodes.push(node)},body:{dataset:{}}},
    URL,setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)
  };
  const setup=runInNewContext(source.replace('export function','function')+';setupPWA;',environment);
  const flush=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
  const fire=ms=>{const timer=[...timers.values()].find(t=>t.ms===ms);assert.ok(timer,'Timer '+ms);timer.fn();};
  return {setup,sw,reg,worker,messages,nodes,timers,environment,flush,fire,counts:()=>({reloads,updates,registrations})};
}
test('Bereites Update wird vor 3D aktiviert; erst der Controllerwechsel lädt genau einmal neu',async()=>{
  const f=fixture();f.reg.waiting=f.worker('installed');
  const pending=f.setup();await f.flush();
  assert.equal(f.messages.length,1);assert.equal(f.messages[0].type,'SKIP_WAITING');
  assert.equal(f.counts().reloads,0);assert.equal(f.timers.size,1);
  f.sw.controller=f.reg.waiting;f.sw.emit('controllerchange');
  assert.equal(await pending,false);assert.equal(f.counts().reloads,1);
  f.sw.emit('controllerchange');assert.equal(f.counts().reloads,1);assert.equal(f.timers.size,0);
});
test('Unveränderte Version wartet nicht die ganze Startfrist ab',async()=>{
  const f=fixture();assert.equal(await f.setup(),true);
  assert.equal(f.counts().updates,1);assert.equal(f.counts().reloads,0);assert.equal(f.timers.size,0);
  assert.ok(f.nodes.some(n=>n.rel==='manifest'));
});
test('Innerhalb der Startfrist fertig installiertes Update wird vor dem Weltaufbau übernommen',async()=>{
  const f=fixture(),worker=f.worker('installing');
  f.reg.update=async()=>{f.reg.installing=worker;f.reg.emit('updatefound');return f.reg;};
  const pending=f.setup();await f.flush();assert.equal(f.messages.length,0);
  f.reg.waiting=worker;f.reg.installing=null;worker.state='installed';worker.emit('statechange');
  assert.equal(f.messages.length,1);
  f.sw.controller=worker;f.sw.emit('controllerchange');assert.equal(await pending,false);
});
test('Langsames Update lässt die gespeicherte Version starten und lädt später nicht im Menü neu',async()=>{
  const f=fixture(),worker=f.worker('installing');
  f.reg.update=async()=>{f.reg.installing=worker;f.reg.emit('updatefound');return f.reg;};
  const pending=f.setup();await f.flush();f.fire(1200);
  assert.equal(await pending,true);assert.equal(f.environment.document.body.dataset.pwaStartup,'deferred');
  f.reg.waiting=worker;f.reg.installing=null;worker.state='installed';worker.emit('statechange');
  f.reg.emit('updatefound');f.sw.controller=worker;f.sw.emit('controllerchange');
  assert.equal(f.messages.length,0);assert.equal(f.counts().reloads,0);assert.equal(f.timers.size,0);
});
test('Hängende Registrierung, Netzprüfung oder Aktivierung blockiert den Start nicht dauerhaft',async()=>{
  for(const phase of ['lookup','update','activation']){
    const f=fixture();
    if(phase==='lookup')f.sw.getRegistration=()=>new Promise(()=>{});
    if(phase==='update')f.reg.update=()=>new Promise(()=>{});
    if(phase==='activation')f.reg.waiting=f.worker('installed');
    const pending=f.setup();await f.flush();f.fire(phase==='activation'?1500:1200);
    assert.equal(await pending,true);f.sw.controller=f.worker('activated');f.sw.emit('controllerchange');
    assert.equal(f.counts().reloads,0);assert.equal(f.timers.size,0);
  }
});
test('Offline startet sofort; ein bereits vollständig vorbereitetes Update funktioniert auch offline',async()=>{
  const f=fixture({online:false});assert.equal(await f.setup(),true);assert.equal(f.counts().updates,0);
  const ready=fixture({online:false});ready.reg.waiting=ready.worker('installed');
  const pending=ready.setup();await ready.flush();assert.equal(ready.messages.length,1);
  ready.sw.controller=ready.reg.waiting;ready.sw.emit('controllerchange');assert.equal(await pending,false);
});
test('Fehlgeschlagene Updates und verworfene Worker lassen die vorhandene Version starten',async()=>{
  const f=fixture();f.reg.update=async()=>{throw Error('offline');};assert.equal(await f.setup(),true);
  const g=fixture(),worker=g.worker('installing');
  g.reg.update=async()=>{g.reg.installing=worker;g.reg.emit('updatefound');return g.reg;};
  const pending=g.setup();await g.flush();worker.state='redundant';worker.emit('statechange');
  assert.equal(await pending,true);assert.equal(g.counts().reloads,0);
});
test('Erstbesuch baut sofort auf; erstmalige Offline-Installation verursacht kein Neuladen',async()=>{
  const f=fixture({controlled:false});f.sw.register=()=>new Promise(()=>{});
  assert.equal(await f.setup(),true);
  f.sw.controller=f.worker('activated');f.sw.emit('controllerchange');
  assert.equal(f.counts().reloads,0);assert.equal(f.timers.size,0);
});
test('Dateistart, lokale Vorschau und Browser ohne Service Worker starten ohne Updatewartezeit',async()=>{
  for(const mode of ['file','local','unsupported']){
    const f=fixture();
    if(mode==='file')f.environment.location.protocol='file:';
    if(mode==='local')f.environment.location.hostname='127.0.0.1';
    if(mode==='unsupported')delete f.environment.navigator.serviceWorker;
    assert.equal(await f.setup(),true);assert.equal(f.timers.size,0);assert.equal(f.counts().updates,0);
  }
});
test('Der Spieleinstieg wartet vor WebGL auf die Prüfung; Moduswechsel lösen kein Update mehr aus',()=>{
  const game=readFileSync(new URL('../src/game.mjs',import.meta.url),'utf8');
  assert.ok(game.indexOf('if(!await pwaReady)return;')<game.indexOf('const resources=await createWorldResources'));
  assert.ok(!game.includes('applyPendingUpdate'));
});

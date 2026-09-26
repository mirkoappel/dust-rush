import test from 'node:test';
import assert from 'node:assert/strict';
import {setupDebugHud} from '../src/ui/debug-hud.mjs';

function fixture(){
  const listeners=new Map(),hud={hidden:false},changes=[];let time=0,closed=0;
  const surface={addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const controls=setupDebugHud({surface,hud,onHide:()=>closed++,onChange:visible=>changes.push(visible),now:()=>time});
  const event=(name,overrides={})=>listeners.get(name)?.({pointerId:1,isPrimary:true,button:0,clientX:100,clientY:100,target:{closest:()=>false},...overrides});
  const tap=(options={})=>{event('pointerdown',options);time+=40;event('pointerup',options);time+=80;};
  return {hud,event,tap,wait:ms=>time+=ms,closed:()=>closed,changes,controls,listeners};
}
test('FPS starten unsichtbar; fünf schnelle Tipps schalten ein und erneut aus',()=>{
  const f=fixture();assert.equal(f.hud.hidden,true);
  for(let i=0;i<4;i++)f.tap();assert.equal(f.hud.hidden,true);
  f.tap();assert.equal(f.hud.hidden,false);assert.deepEqual(f.changes,[true]);
  for(let i=0;i<5;i++)f.tap();assert.equal(f.hud.hidden,true);assert.equal(f.closed(),1);assert.deepEqual(f.changes,[true,false]);
});
test('Langsame Tipps, Ziehen, Halten und Abbruch zählen nicht als Fünffach-Tipp',()=>{
  for(const interrupt of [
    f=>f.wait(500),
    f=>{f.event('pointerdown');f.event('pointerup',{clientX:160});},
    f=>{f.event('pointerdown');f.wait(350);f.event('pointerup');},
    f=>{f.event('pointerdown');f.event('pointercancel');},
    f=>f.tap({clientX:250}),
  ]){
    const f=fixture();for(let i=0;i<4;i++)f.tap();interrupt(f);f.tap();assert.equal(f.hud.hidden,true);
  }
});
test('Spielknöpfe und Mehrfingersteuerung lösen keine Entwickleranzeige aus',()=>{
  for(const excluded of [{target:{closest:()=>true}},{isPrimary:false},{button:2}]){
    const f=fixture();for(let i=0;i<6;i++)f.tap(excluded);assert.equal(f.hud.hidden,true);
    for(let i=0;i<4;i++)f.tap();f.tap(excluded);f.tap();assert.equal(f.hud.hidden,true);
  }
});
test('Maus und Touch verwenden denselben Shortcut; Dispose entfernt seine Listener',()=>{
  const f=fixture();
  for(let i=0;i<5;i++)f.tap({pointerType:'mouse'});assert.equal(f.hud.hidden,false);
  f.controls.dispose();assert.equal(f.listeners.size,0);
});

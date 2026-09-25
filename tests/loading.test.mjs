import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoadingScreen} from '../src/ui/loading.mjs';

function fixture(paint=async()=>{}){
  const attributes=new Map(),styles=new Map(),classes=new Set(['sr-only']);
  const screen={hidden:false,dataset:{}};
  const progress={hidden:false,setAttribute:(key,value)=>attributes.set(key,value),style:{setProperty:(key,value)=>styles.set(key,value)}};
  const status={textContent:'',classList:{remove:value=>classes.delete(value)}},retry={hidden:true};
  return {screen,progress,status,retry,attributes,styles,classes,loader:createLoadingScreen({screen,progress,status,retry,paint})};
}

test('Ladefortschritt folgt abgeschlossenen Schritten, bleibt monoton und endet erst bei 100',async()=>{
  const f=fixture();
  f.loader.finish();assert.equal(f.screen.hidden,false);
  await f.loader.advance(12,'Modelle');
  assert.equal(f.attributes.get('aria-valuenow'),'12');
  assert.equal(f.attributes.get('aria-valuetext'),'Modelle');
  assert.equal(f.styles.get('--progress'),'0.12');
  await f.loader.advance(52,'Teile');
  await f.loader.advance(44,'Modelle');
  assert.equal(f.attributes.get('aria-valuenow'),'52');
  f.loader.finish();assert.equal(f.screen.hidden,false);
  await f.loader.advance(100,'Bereit');
  assert.equal(f.screen.hidden,false);
  f.loader.finish();assert.equal(f.screen.hidden,true);
});

test('Vor dem nächsten schweren Ladeschritt bekommt der Browser Zeit zum Zeichnen',async()=>{
  let release,returned=false;
  const f=fixture(()=>new Promise(resolve=>{release=resolve;}));
  const pending=f.loader.advance(4,'Start').then(()=>{returned=true;});
  assert.equal(f.attributes.get('aria-valuenow'),'4');
  await Promise.resolve();assert.equal(returned,false);
  release();await pending;assert.equal(returned,true);
});

test('Bei Ladefehlern ersetzt ein sichtbarer Wiederholen-Knopf endloses Warten',async()=>{
  const f=fixture();
  await f.loader.advance(52,'Teile');
  f.loader.fail('Bitte neu laden.');
  assert.equal(f.screen.dataset.state,'error');
  assert.equal(f.screen.hidden,false);assert.equal(f.progress.hidden,true);
  assert.equal(f.retry.hidden,false);assert.equal(f.classes.has('sr-only'),false);
  assert.equal(f.status.textContent,'Bitte neu laden.');
  await f.loader.advance(100,'Bereit');f.loader.finish();
  assert.equal(f.screen.hidden,false);
  assert.equal(f.status.textContent,'Bitte neu laden.');
});

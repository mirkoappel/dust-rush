import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameRateMonitor} from '../src/ui/frame-rate.mjs';

test('FPS werden für jede Ansicht aus echten Bildabständen zweimal pro Sekunde bestimmt',()=>{
  for(const fps of [10,30,60,120]){
    const monitor=createFrameRateMonitor();let updates=0;
    for(let frame=0;frame<fps;frame++){
      const value=monitor.sample(1/fps);
      if(value!==null){assert.equal(value,fps);updates++;}
    }
    assert.equal(updates,2);assert.equal(monitor.value,fps);
    assert.ok(Math.abs(monitor.frameMs-1000/fps)<1e-9);
    assert.ok(Math.abs(monitor.peakMs-1000/fps)<1e-9);
  }
});

test('Langsame Einzelbilder werden mitgezählt statt durch das Physik-Limit versteckt',()=>{
  const monitor=createFrameRateMonitor();
  for(let i=0;i<15;i++)monitor.sample(1/60);
  assert.equal(monitor.sample(.25),32);
  assert.equal(monitor.frameMs,31.25);assert.equal(monitor.peakMs,250);
  assert.equal(monitor.sample(1),1);
  assert.equal(monitor.frameMs,1000);assert.equal(monitor.peakMs,1000);
});

test('Tabwechsel verwirft die alte Messung; ungültige Zeitabstände zählen nicht mit',()=>{
  const monitor=createFrameRateMonitor();
  monitor.sample(.2);monitor.reset();
  for(const invalid of [0,-1,NaN,Infinity])assert.equal(monitor.sample(invalid),null);
  assert.equal(monitor.value,0);
  for(let i=0;i<30;i++)monitor.sample(1/60);
  assert.equal(monitor.value,60);
});

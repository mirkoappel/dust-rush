import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrivingCameraMotion} from '../src/driving-camera.mjs';
const neutral={distanceOffset:0,fovOffset:0};
function run(camera,seconds,input,hz=60){let value;for(let i=0;i<seconds*hz;i++)value=camera.step(1/hz,input);return value;}

test('Nitro setzt nur die Kamera weich weiter zurück und erweitert das Blickfeld begrenzt',()=>{
  const c=createDrivingCameraMotion(),input={boosting:true,speed:14};
  const first=c.step(1/60,input);assert.ok(first.distanceOffset>0&&first.distanceOffset<.15);
  assert.ok(Math.abs(first.distanceOffset-1.5*(1-Math.exp(-5/60)))<1e-12);
  const full=run(c,2,input);assert.ok(full.distanceOffset>1.49&&full.distanceOffset<=1.5);
  assert.ok(full.fovOffset>3.9&&full.fovOffset<=4);
  assert.deepEqual(input,{boosting:true,speed:14});
});
test('Loslassen oder leerer Vorrat lässt die Kamera ohne Sprung zurückkommen',()=>{
  const c=createDrivingCameraMotion();run(c,1,{boosting:true,speed:12});
  const before=c.value,first=c.step(1/60,{boosting:false,speed:12});
  assert.ok(first.distanceOffset<before.distanceOffset&&first.distanceOffset>before.distanceOffset*.9);
  const normal=run(c,2,{boosting:false,speed:12});assert.ok(Math.abs(normal.distanceOffset)<.0001);
});
test('Bremsen holt die Kamera näher; Stillstand und Rückwärtsfahrt bauen den Effekt ab',()=>{
  const c=createDrivingCameraMotion();
  const brake=run(c,1,{braking:1,speed:12});
  assert.ok(brake.distanceOffset<-.54&&brake.distanceOffset>=-.55);
  assert.ok(brake.fovOffset<0);
  for(const speed of [0,-3]){
    const rest=run(c,2,{braking:1,speed});assert.ok(Math.abs(rest.distanceOffset)<.0001);
  }
});
test('Bremsen hat Vorrang vor Nitro; schnelle Wechsel bleiben innerhalb der Grenzen',()=>{
  const c=createDrivingCameraMotion();
  for(let i=0;i<240;i++){
    const value=c.step(1/60,{boosting:true,braking:i%40<20?1:0,speed:10});
    assert.ok(value.distanceOffset>=-.55&&value.distanceOffset<=1.5);
    assert.ok(value.fovOffset>=-1.5&&value.fovOffset<=4);
  }
  assert.ok(run(c,2,{boosting:true,braking:1,speed:10}).distanceOffset<0);
});
test('Pause hält den Effekt; Menü, Countdown, Ergebnis, Reset und reduzierte Bewegung setzen ihn zurück',()=>{
  const c=createDrivingCameraMotion();run(c,1,{boosting:true,speed:10});
  const paused=c.value;assert.deepEqual(c.step(1,{mode:'paused'}),paused);
  for(const mode of ['menu','countdown','finished']){
    run(c,1,{boosting:true,speed:10});assert.deepEqual(c.step(1/60,{mode}),neutral);
  }
  run(c,1,{boosting:true,speed:10});assert.deepEqual(c.step(1/60,{reducedMotion:true}),neutral);
  run(c,1,{boosting:true,speed:10});c.reset();assert.deepEqual(c.value,neutral);
});
test('Kameraeffekt bleibt bei unterschiedlichen Bildraten gleich und verträgt ungültige Zeitschritte',()=>{
  const slow=createDrivingCameraMotion(),fast=createDrivingCameraMotion(),input={boosting:true,speed:10};
  assert.ok(Math.abs(run(slow,1,input,30).distanceOffset-run(fast,1,input,120).distanceOffset)<1e-12);
  const before=fast.value;for(const dt of [0,-1,NaN,Infinity])assert.deepEqual(fast.step(dt,input),before);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {CAMERA_TUNING,createDrivingCameraMotion} from '../src/driving-camera.mjs';
import {NITRO,stepNitro} from '../src/driving-input.mjs';
import {resetMotion,stepPlanar} from '../src/physics.mjs';
const neutral={distanceOffset:0,fovOffset:0};
function run(camera,seconds,input,hz=60){let value;for(let i=0;i<seconds*hz;i++)value=camera.step(1/hz,input);return value;}
function accelerate(camera,{start=10,gain=8,seconds=2,hz=60}={}){
  camera.step(1/hz,{speed:start});
  const result=[];
  for(let i=1;i<=seconds*hz;i++)result.push(camera.step(1/hz,{speed:start+gain*i/(seconds*hz)}));
  return result;
}

test('Gleichmäßige Fahrt erzeugt weder Nitro-Dolly noch Kameraabstand',()=>{
  const c=createDrivingCameraMotion();
  assert.deepEqual(run(c,5,{boosting:true,speed:14}),neutral);
  assert.deepEqual(run(c,1,{boosting:false,speed:14}),neutral);
});

test('Der Truck fährt bei Beschleunigung vor; die Drohne beschleunigt weiter vorwärts',()=>{
  const c=createDrivingCameraMotion(),values=accelerate(c);
  assert.ok(values[0].distanceOffset>=0&&values[0].distanceOffset<.01);
  assert.ok(values[30].distanceOffset>values[0].distanceOffset);
  assert.ok(values.at(-1).distanceOffset>2);
  assert.ok(values.every(v=>v.distanceOffset>=0&&v.distanceOffset<20&&v.fovOffset<4));
  const truckSpeed=10+4/60,cameraSpeed=truckSpeed-values[0].distanceOffset*60;
  assert.ok(cameraSpeed>=10&&cameraSpeed<truckSpeed);
});

test('Reaktionszeit und Beschleunigung sind unabhängige Drohnen-Stellschrauben',()=>{
  const previous={...CAMERA_TUNING};
  const peak=()=>Math.max(...accelerate(createDrivingCameraMotion()).map(v=>v.distanceOffset));
  try{
    const baseline=peak();
    CAMERA_TUNING.reactionTime=1.2;
    const slowReaction=peak();
    CAMERA_TUNING.reactionTime=previous.reactionTime;
    CAMERA_TUNING.acceleration=2;
    const weakMotor=peak();
    assert.ok(slowReaction>baseline&&weakMotor>baseline,{baseline,slowReaction,weakMotor});
  }finally{Object.assign(CAMERA_TUNING,previous);}
});

test('Zum Soll-Abstand darf die Drohne vorübergehend schneller als der Truck werden',()=>{
  const c=createDrivingCameraMotion();
  accelerate(c);
  const before=c.value.distanceOffset;
  const after=run(c,4,{speed:18}).distanceOffset;
  assert.ok(after<before);
  assert.ok(Math.abs(run(c,12,{speed:18}).distanceOffset)<.05);
});
test('Das Drohnen-Höchsttempo begrenzt das Aufholen unabhängig von der Beschleunigung',()=>{
  const previous={...CAMERA_TUNING};
  try{
    CAMERA_TUNING.reactionTime=0;CAMERA_TUNING.acceleration=20;
    CAMERA_TUNING.maxSpeed=12;
    const slow=createDrivingCameraMotion();run(slow,1,{speed:10});
    const growing=run(slow,4,{speed:18}).distanceOffset;
    CAMERA_TUNING.maxSpeed=40;
    const fast=createDrivingCameraMotion();run(fast,1,{speed:10});
    const recovered=run(fast,8,{speed:18}).distanceOffset;
    assert.ok(growing>10,{growing});assert.ok(Math.abs(recovered)<.1,{recovered});
  }finally{Object.assign(CAMERA_TUNING,previous);}
});
test('Die Drohnen-Ausregelzeit formt das weiche Annähern unabhängig von Reaktionszeit und Beschleunigungsgrenze',()=>{
  const previous={...CAMERA_TUNING};
  const remaining=response=>{
    Object.assign(CAMERA_TUNING,{reactionTime:0,acceleration:20,braking:20,maxSpeed:40,speedResponse:response});
    const camera=createDrivingCameraMotion();run(camera,1,{speed:8});
    return run(camera,2,{speed:18}).distanceOffset;
  };
  try{assert.ok(remaining(1.5)>remaining(.1)+2);}finally{Object.assign(CAMERA_TUNING,previous);}
});

test('Beim Bremsen nähert sich die träge Drohne und findet danach den Soll-Abstand wieder',()=>{
  const c=createDrivingCameraMotion();
  run(c,1,{speed:18});
  let close=0;
  for(let i=1;i<=120;i++)close=Math.min(close,c.step(1/60,{braking:1,speed:18-18*i/120}).distanceOffset);
  assert.ok(close<-.5&&close>-2.5,{close});
  const still=run(c,12,{braking:1,speed:0});
  assert.ok(Math.abs(still.distanceOffset)<.1,still);
});

test('Schnelle Wechsel und fehlerhafte Sensordaten bleiben endlich und sicher gerahmt',()=>{
  const c=createDrivingCameraMotion();
  for(let i=0;i<1200;i++){
    const value=c.step(1/60,{speed:8+i%200/20,braking:i%80<20?1:0});
    assert.ok(value.distanceOffset>-2.5&&value.distanceOffset<20);
    assert.ok(value.fovOffset>-1.5&&value.fovOffset<4);
  }
  for(const speed of [NaN,Infinity,-Infinity]){
    const value=c.step(1/60,{speed});
    assert.ok(Object.values(value).every(Number.isFinite));
  }
  c.reset();c.step(1/60,{speed:0});
  assert.deepEqual(c.step(2,{speed:20}),neutral,'a stalled frame must not fabricate travel');
});

test('Pause hält die Kameraposition; Neustart und reduzierte Bewegung setzen sie zurück',()=>{
  const c=createDrivingCameraMotion();accelerate(c);
  const paused=c.value;assert.deepEqual(c.step(1,{mode:'paused',speed:0}),paused);
  for(const mode of ['menu','countdown','finished']){
    accelerate(c);assert.deepEqual(c.step(1/60,{mode}),neutral);
    assert.deepEqual(c.step(1/60,{speed:24}),neutral);
  }
  accelerate(c);assert.deepEqual(c.step(1/60,{reducedMotion:true,speed:18}),neutral);
  accelerate(c);c.reset();assert.deepEqual(c.value,neutral);
  assert.deepEqual(c.step(1/60,{speed:20}),neutral);
});

test('Der Drohnennachlauf ist bei unterschiedlichen Bildraten vergleichbar',()=>{
  const slow=createDrivingCameraMotion(),fast=createDrivingCameraMotion();
  const a=accelerate(slow,{hz:30}).at(-1),b=accelerate(fast,{hz:120}).at(-1);
  assert.ok(Math.abs(a.distanceOffset-b.distanceOffset)<.02,{a,b});
  const before=fast.value;
  for(const dt of [0,-1,NaN,Infinity])assert.deepEqual(fast.step(dt,{speed:10}),before);
});

test('Fünf Sekunden echter Nitro-Antrieb bewegen nur die virtuelle Drohne, nicht die Fahrzeugphysik',()=>{
  assert.equal(NITRO.duration,5);
  const truck=()=>{const car={x:0,z:0,y:0,vy:0,heading:0,pitch:0,roll:0,speed:14,steering:0,air:false};resetMotion(car);return car;};
  const car=truck(),copy=truck(),normal=truck(),c=createDrivingCameraMotion(),dt=1/120;
  c.step(dt,{speed:car.speed});
  let peak=0,boostFrames=0;
  for(let i=0;i<600;i++){
    for(const vehicle of [car,copy]){
      stepNitro(vehicle,dt,{requested:true,throttle:1});
      stepPlanar(vehicle,dt,{throttle:1,boost:vehicle.boosting});
    }
    stepPlanar(normal,dt,{throttle:1});
    peak=Math.max(peak,c.step(dt,{speed:car.speed,boosting:car.boosting}).distanceOffset);
    boostFrames+=Number(car.boosting);
    assert.deepEqual(car,copy);
  }
  assert.equal(boostFrames,600);
  assert.ok(peak>1&&peak<20,{peak});
  assert.ok(car.speed>normal.speed+3);
  assert.equal(car.nitro,0);
});

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
  for(let i=1;i<=seconds*hz;i++)result.push(camera.step(1/hz,{boosting:true,speed:start+gain*i/(seconds*hz)}));
  return result;
}

test('Nitro ohne tatsächliche Beschleunigung zieht die Kamera nicht zurück',()=>{
  const c=createDrivingCameraMotion();
  run(c,1,{speed:14});
  assert.deepEqual(run(c,5,{boosting:true,speed:14}),neutral);
  assert.deepEqual(run(c,1,{boosting:false,speed:14}),neutral);
  c.reset();assert.deepEqual(run(c,5,{boosting:true,speed:0}),neutral);
});

test('Der Truck fährt bei echter Beschleunigung allmählich vor die trägere Kamera',()=>{
  const c=createDrivingCameraMotion(),values=accelerate(c);
  assert.ok(values[0].distanceOffset>0&&values[0].distanceOffset<.001);
  assert.ok(values[15].distanceOffset>values[0].distanceOffset);
  assert.ok(values.at(-1).distanceOffset>3);
  assert.ok(values.every(v=>v.distanceOffset>=0&&v.distanceOffset<CAMERA_TUNING.maxBoostGap&&v.fovOffset<4));
  // The first frame keeps nearly the preceding camera speed instead of dollying back.
  const truckSpeed=10+4/60,cameraSpeed=truckSpeed-values[0].distanceOffset*60;
  assert.ok(cameraSpeed>=10&&cameraSpeed<truckSpeed);
  // Even with Nitro still held, steady speed lets the follower eventually catch up.
  assert.ok(run(c,3,{boosting:true,speed:18}).distanceOffset>3.5);
  assert.ok(run(c,32,{boosting:true,speed:18}).distanceOffset<.3);
});

test('Beim Davonfahren beschleunigt die Kamera weiter vorwärts statt künstlich abzubremsen',()=>{
  const c=createDrivingCameraMotion(),dt=1/60,start=10;
  c.step(dt,{speed:start});
  let previousGap=0,previousCameraSpeed=start;
  for(let i=1;i<=120;i++){
    const truckSpeed=start+4*i*dt;
    const gap=c.step(dt,{boosting:true,speed:truckSpeed}).distanceOffset;
    const cameraSpeed=truckSpeed-(gap-previousGap)/dt;
    assert.ok(cameraSpeed>=previousCameraSpeed-1e-9);
    assert.ok(cameraSpeed<truckSpeed);
    previousGap=gap;previousCameraSpeed=cameraSpeed;
  }
});

test('Normales Beschleunigen ohne Nitro erhält die bisherige Kamera',()=>{
  const c=createDrivingCameraMotion();
  for(let i=0;i<300;i++)assert.deepEqual(c.step(1/60,{speed:i/20}),neutral);
});

test('Loslassen oder leerer Vorrat baut den entstandenen Abstand sanft ab',()=>{
  const c=createDrivingCameraMotion();accelerate(c);
  const before=c.value,first=c.step(1/60,{boosting:false,speed:18});
  assert.ok(Math.abs(first.distanceOffset-before.distanceOffset)<.1);
  const offsets=[first.distanceOffset];
  for(let i=0;i<420;i++)offsets.push(c.step(1/60,{boosting:false,speed:18}).distanceOffset);
  assert.ok(offsets.every(v=>v>=0&&v<CAMERA_TUNING.maxBoostGap));
  assert.ok(offsets.at(-1)<.001);
  assert.ok(Math.max(...offsets)<before.distanceOffset+.5);
});

test('Bremsen holt die Kamera näher; Stillstand und Rückwärtsfahrt bauen den Effekt ab',()=>{
  const c=createDrivingCameraMotion();accelerate(c);
  const brake=run(c,3,{braking:1,speed:12});
  assert.ok(brake.distanceOffset<-.54&&brake.distanceOffset>=-.55);
  assert.ok(brake.fovOffset<0);
  for(const speed of [0,-3]){
    const rest=run(c,3,{braking:1,speed});assert.ok(Math.abs(rest.distanceOffset)<.0001);
  }
});

test('Bremsen hat Vorrang; schnelle Wechsel und problematische Sensordaten bleiben begrenzt',()=>{
  const c=createDrivingCameraMotion();
  for(let i=0;i<1200;i++){
    const value=c.step(1/60,{boosting:true,braking:i%80<20?1:0,speed:8+i%200/20});
    assert.ok(value.distanceOffset>=-.55&&value.distanceOffset<CAMERA_TUNING.maxBoostGap);
    assert.ok(value.fovOffset>=-1.5&&value.fovOffset<4);
  }
  assert.ok(run(c,3,{boosting:true,braking:1,speed:10}).distanceOffset<-.54);
  for(const speed of [NaN,Infinity,-Infinity]){
    const value=c.step(1/60,{boosting:true,speed});
    assert.ok(Object.values(value).every(Number.isFinite));
  }
  c.reset();c.step(1/60,{speed:0});
  assert.deepEqual(c.step(2,{boosting:true,speed:20}),neutral,'a stalled frame must not fabricate acceleration');
});

test('Pause hält den Effekt; Neustart, Menü und reduzierte Bewegung verwerfen auch die Tempo-Historie',()=>{
  const c=createDrivingCameraMotion();accelerate(c);
  const paused=c.value;assert.deepEqual(c.step(1,{mode:'paused',speed:0}),paused);
  for(const mode of ['menu','countdown','finished']){
    accelerate(c);assert.deepEqual(c.step(1/60,{mode}),neutral);
    assert.deepEqual(c.step(1/60,{boosting:true,speed:24}),neutral);
  }
  accelerate(c);assert.deepEqual(c.step(1/60,{reducedMotion:true,speed:18}),neutral);
  accelerate(c);c.reset();assert.deepEqual(c.value,neutral);
  assert.deepEqual(c.step(1/60,{boosting:true,speed:20}),neutral);
});

test('Beschleunigungsnachlauf bleibt bei unterschiedlichen Bildraten gleich',()=>{
  const slow=createDrivingCameraMotion(),fast=createDrivingCameraMotion();
  const a=accelerate(slow,{hz:30}).at(-1),b=accelerate(fast,{hz:120}).at(-1);
  assert.ok(Math.abs(a.distanceOffset-b.distanceOffset)<1e-10);
  const before=fast.value;
  for(const dt of [0,-1,NaN,Infinity])assert.deepEqual(fast.step(dt,{boosting:true,speed:10}),before);
});

test('Fünf Sekunden echter Nitro-Antrieb erzeugen Kameranachlauf, ohne die Fahrzeugphysik zu verändern',()=>{
  assert.equal(NITRO.duration,5);
  const truck=()=>{const car={x:0,z:0,y:0,vy:0,heading:0,pitch:0,roll:0,speed:14,steering:0,air:false};resetMotion(car);return car;};
  const car=truck(),copy=truck(),normal=truck(),c=createDrivingCameraMotion(),dt=1/120;
  c.step(dt,{speed:car.speed});
  let peak=0,first=null,boostFrames=0;
  for(let i=0;i<600;i++){
    for(const vehicle of [car,copy]){
      stepNitro(vehicle,dt,{requested:true,throttle:1});
      stepPlanar(vehicle,dt,{throttle:1,boost:vehicle.boosting});
    }
    stepPlanar(normal,dt,{throttle:1});
    const value=c.step(dt,{speed:car.speed,boosting:car.boosting});
    if(first===null)first=value.distanceOffset;
    peak=Math.max(peak,value.distanceOffset);
    boostFrames+=Number(car.boosting);
    assert.deepEqual(car,copy);
  }
  assert.equal(boostFrames,600);
  assert.ok(first<.001&&peak>1.5&&peak<CAMERA_TUNING.maxBoostGap,{first,peak});
  assert.ok(car.speed>normal.speed+3);
  assert.equal(car.nitro,0);
});

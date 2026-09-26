import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpeedway} from '../src/speedway.mjs';
import {TimeTrial,formatLapTime} from '../src/time-trial.mjs';
import {Race,angleDelta,clamp} from '../src/simulation.mjs';
import {applyVehiclePreset,createVehiclePhysicsProfile} from '../src/vehicle-physics-profile.mjs';
import {resetMotion,stepPlanar} from '../src/physics.mjs';

const dt=1/120;
const compact=()=>{const p=createVehiclePhysicsProfile();applyVehiclePreset(p,'compact');return p;};

test('Der ebene Rundkurs hat echte 3-km-Geraden, stetige Übergänge und konsistente Projektion',()=>{
  const track=createSpeedway(),end=track.at(track.length),start=track.at(0);
  assert.deepEqual(end,start);
  assert.equal(track.straights.length,2);
  assert.equal(track.laneWidth,3.75);assert.equal(track.laneCount,4);
  assert.equal(track.width,21);
  assert.ok(track.length>7100&&track.length<7200);
  for(let s=0;s<track.length;s+=13.17)for(const lateral of [-16,0,16]){
    const p=track.at(s,lateral),q=track.project(p.x,p.z);
    assert.ok(Math.abs(q.lateral-lateral)<1e-8);
    assert.ok(Math.abs(q.s-p.s)<1e-8);
  }
  for(const straight of track.straights){
    const a=track.at(straight.s+1),b=track.at(straight.s+2999);
    assert.equal(a.heading,b.heading);
    assert.ok(Math.abs(Math.hypot(b.x-a.x,b.z-a.z)-2998)<1e-8);
  }
  for(const s of [0,3000,3000+Math.PI*180,6000+Math.PI*180]){
    const a=track.at(s-.0001),b=track.at(s+.0001);
    assert.ok(Math.abs(angleDelta(a.heading,b.heading))<.00001);
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)<.00021);
  }
});

test('Im vollständigen Solo-Modus stimmen 0–100 und Geradentempo mit derselben isolierten Physik überein',()=>{
  const profile=compact(),r=new Race(createSpeedway(),false,profile);
  r.start();r.mode='racing';r.setOpponentsEnabled(true);
  assert.equal(r.cars.length,1);assert.equal(r.props.length+r.ramps.length+r.mounds.length,0);
  const reference={x:0,z:0,y:0,vy:0,heading:0,pitch:0,roll:0,speed:0,steering:0,air:false};
  resetMotion(reference,profile);
  let referenceHundred=null,ticks=0;
  while(r.player.s<2900&&ticks<120*120){
    r.step(dt,{forward:1});
    stepPlanar(reference,dt,{throttle:1},profile);
    if(referenceHundred===null&&reference.speed>=100/3.6)referenceHundred=r.time;
    assert.equal(r.player.air,false);
    assert.ok(Math.abs(r.player.speed-reference.speed)<1e-8);
    ticks++;
  }
  assert.ok(r.player.speed*3.6>178,{speed:r.player.speed*3.6});
  assert.equal(r.player.gear,5);
  assert.ok(Math.abs(r.trial.zeroToHundred-referenceHundred)<=dt);
  assert.ok(r.trial.zeroToHundred>9.5&&r.trial.zeroToHundred<10.2);
});

test('Mehrere tatsächlich gefahrene Runden liefern Ergebnisse ohne Rennende oder simulierte Gegner',()=>{
  const r=new Race(createSpeedway(),false,compact());r.start();r.mode='racing';
  while(r.player.lap<2&&r.time<600){
    const c=r.player,t=r.track;
    const target=t.at(c.s+18+Math.abs(c.speed));
    // Damped test-driver inputs prevent steering oscillations after the bends.
    const steer=-clamp(angleDelta(c.heading,Math.atan2(target.x-c.x,target.z-c.z))*.65-c.yawRate*.2,-1,1);
    const straight=t.straights.find(v=>c.s>=v.s&&c.s<v.s+v.length);
    const remaining=straight?straight.s+straight.length-c.s:0;
    const targetSpeed=Math.sqrt(29*29+2*4*Math.max(0,remaining-60));
    r.step(dt,{forward:c.speed<=targetSpeed?1:0,brake:c.speed>targetSpeed?1:0,steer});
  }
  assert.equal(r.player.lap,2);
  assert.equal(r.mode,'racing');assert.equal(r.player.finished,false);
  assert.equal(r.player.respawns,0);
  const results=r.events.filter(e=>e.type==='trialLap');
  assert.equal(results.length,2);
  assert.ok(results.every(v=>v.valid&&v.seconds>140&&v.topKmh>175));
  assert.ok(results.every(v=>v.distanceM>7100&&v.distanceM<7200));
  assert.ok(Math.abs(r.trial.totalDistanceM-results.reduce((sum,v)=>sum+v.distanceM,0))<1e-6);
  assert.ok(results[0].zeroToHundred>9&&results[0].zeroToHundred<11);
  assert.equal(results[1].zeroToHundred,null);
  assert.equal(r.trial.last.lap,2);
  assert.ok(r.trial.best.seconds<=r.trial.last.seconds);
});

test('Countdown und Pause stoppen Messzeit; Abkürzen, Rücksetzen und Rückwärts-Ziellinien zählen keine Bestzeit',()=>{
  const r=new Race(createSpeedway(),false,createVehiclePhysicsProfile());r.start();
  for(let i=0;i<120;i++)r.step(dt,{forward:1});
  assert.equal(r.time,0);assert.equal(r.trial.zeroToHundred,null);
  r.mode='racing';r.step(dt,{forward:1});r.pause();
  const before=r.time;
  for(let i=0;i<120;i++)r.step(dt,{forward:1});
  assert.equal(r.time,before);r.resume();
  const c=r.player,L=r.track.length;
  r.checkpoint(c,L-1,1);assert.equal(c.lap,0);
  r.checkpoint(c,1,L-1);assert.equal(c.lap,0);
  r.respawn();assert.equal(r.trial.valid,false);
  for(let i=1;i<=12;i++){
    const s=i%12*L/12;r.time=i*10;
    r.checkpoint(c,(s-.5+L)%L,(s+.5)%L);
  }
  assert.equal(r.trial.last.valid,false);assert.equal(r.trial.best,null);
  assert.equal(r.trial.valid,true);assert.equal(r.mode,'racing');
  r.physics.powerPs=135;
  r.start();assert.equal(r.trial.last,null);assert.equal(r.trial.best,null);assert.equal(r.cars.length,1);
  assert.equal(r.physics.powerPs,135);assert.equal(r.player.s,0);assert.equal(r.player.speed,0);
  assert.equal(r.trial.totalDistanceM,0);assert.equal(r.trial.lapDistanceM,0);assert.equal(r.mode,'countdown');
});

test('0–100 zählt den Gasaufbau ab Stillstand, interpoliert und erfindet auf fliegenden Runden keinen Start',()=>{
  const trial=new TimeTrial();
  for(let i=1;i<=3;i++)trial.sample(i,1,{speed:i===3?30:(i-1)*10,boosting:false},{forward:1});
  assert.ok(Math.abs(trial.zeroToHundred-(2+(100/3.6-10)/20))<1e-9);
  const first=trial.finish(60,1);
  assert.equal(first.topKmh,108);assert.equal(first.nitroUsed,false);
  trial.sample(61,1,{speed:40,boosting:true},{forward:1});
  const second=trial.finish(110,2);
  assert.equal(second.zeroToHundred,null);assert.equal(second.nitroUsed,true);
  assert.equal(trial.best.lap,2);
  assert.equal(formatLapTime(59.999),'1:00,00');assert.equal(formatLapTime(null),'—');
});

test('Autobahnleitplanken halten auch Front und Heck auf Geraden und in Kurven innerhalb der sichtbaren Grenze',()=>{
  for(const s of [500,3100,3500,4600,6700,7000])for(const side of [-1,1])for(const angle of [0,.6,Math.PI/2]){
    const r=new Race(createSpeedway(),false,compact()),t=r.track;
    const p=t.at(s,side*(t.guardrailOffset-1.5));
    r.start();r.mode='racing';
    const car=r.player;
    car.x=p.x;car.z=p.z;car.heading=p.heading+side*angle;car.speed=40;
    resetMotion(car,r.physics);car.projection=t.project(car.x,car.z);car.s=car.projection.s;
    for(let tick=0;tick<12;tick++){
      r.step(1/60,{forward:1});
      for(const front of [-2.49984*.38,2.49984*.38]){
        const q=t.project(car.x+Math.sin(car.heading)*front,car.z+Math.cos(car.heading)*front);
        assert.ok(Math.abs(q.lateral)+1.45<=t.guardrailOffset-t.guardrailThickness/2+.001,JSON.stringify({s,side,angle,lateral:q.lateral}));
      }
      assert.ok(Number.isFinite(car.speed));
    }
  }
});

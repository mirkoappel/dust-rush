import test from 'node:test';
import assert from 'node:assert/strict';
import {Race} from '../src/simulation.mjs';
import {VEHICLE,SPEEDS,resetMotion,stepPlanar,stepVertical,collideTrucks,collideWall} from '../src/physics.mjs';
import {VEHICLE_PHYSICS,createVehiclePhysicsProfile} from '../src/vehicle-physics-profile.mjs';
const truck=(overrides={})=>{const c={x:0,z:0,y:0,vy:0,heading:0,pitch:0,roll:0,speed:0,steering:0,air:false,...overrides};resetMotion(c);return c;};
const ticks=(n,fn)=>{for(let i=0;i<n;i++)fn(1/120);};
test('Arena: kein Autogas, kein Zittern im Stand – auch nach Start und Neustart',()=>{
  const r=new Race(undefined,true);r.start(true);r.cars=[r.player];r.mode='racing';
  const {x,z}=r.player;
  ticks(1200,dt=>r.step(dt,{}));
  assert.equal(r.assist,false);assert.equal(r.player.speed,0);
  assert.equal(r.player.x,x);assert.equal(r.player.z,z);assert.equal(r.player.y,0);assert.equal(r.player.vy,0);
  assert.ok(r.player.suspension.wheels.every(w=>w.compression===0));
  r.start(true);assert.equal(r.assist,false);
});
test('Weicher Gasaufbau und normale Zielgeschwindigkeit für beide Spielarten',()=>{
  for(const limit of [SPEEDS.race,SPEEDS.arena]){
    const c=truck();let previous=0,maxJump=0;
    ticks(1200,dt=>{stepPlanar(c,dt,{throttle:1,limit});maxJump=Math.max(maxJump,Math.abs(c.speed-previous));previous=c.speed;});
    assert.ok(c.speed>limit-.5&&c.speed<=limit);assert.ok(maxJump<.05);
  }
});
test('Gas loslassen rollt aus; Bremse hält an und fährt erst danach rückwärts',()=>{
  const c=truck();ticks(600,dt=>stepPlanar(c,dt,{throttle:1,limit:SPEEDS.arena}));
  const initial=c.speed;ticks(120,dt=>stepPlanar(c,dt,{limit:SPEEDS.arena}));
  assert.ok(c.speed>0&&c.speed<initial);
  let stopSteps=0;while(c.speed>.05&&stopSteps++<240)stepPlanar(c,1/120,{brake:1});
  assert.ok(stopSteps<240);ticks(10,dt=>stepPlanar(c,dt,{brake:1}));assert.ok(c.speed>=-.1&&c.speed<.3);
  ticks(240,dt=>stepPlanar(c,dt,{brake:1}));assert.ok(c.speed< -2&&c.speed>=-SPEEDS.reverse);
});
test('Tuning der Bremskraft verändert Fuß- und Driftbremse ohne die Rückwärtsgeschwindigkeit zu ändern',()=>{
  const previous=VEHICLE_PHYSICS.brakingG;
  try{
    const remaining=(strength,input)=>{
      VEHICLE_PHYSICS.brakingG=strength;
      const c=truck({speed:10});
      ticks(45,dt=>stepPlanar(c,dt,input));
      return c.speed;
    };
    assert.ok(remaining(.4,{brake:1})>remaining(1.3,{brake:1})+1.5);
    assert.ok(remaining(.4,{driftBrake:true})>remaining(1.3,{driftBrake:true})+1.5);
  }finally{VEHICLE_PHYSICS.brakingG=previous;}
});
test('Tuning der Lenkstärke verändert den maximalen Einschlag bei gleichem Analogsignal',()=>{
  const previous=VEHICLE_PHYSICS.steering;
  try{
    const turn=strength=>{
      VEHICLE_PHYSICS.steering=strength;
      const c=truck({speed:10});
      ticks(60,dt=>stepPlanar(c,dt,{steer:1}));
      return {steering:c.steering,heading:c.heading};
    };
    const gentle=turn(.5),strong=turn(1.5);
    assert.ok(strong.steering>gentle.steering*2.5);
    assert.ok(strong.heading>gentle.heading*2);
  }finally{VEHICLE_PHYSICS.steering=previous;}
});
test('Motorleistung, Gewicht und globaler Fahrzeug-Grip wirken ohne Reifenmodell-Zuordnung',()=>{
  const previous={powerPs:VEHICLE_PHYSICS.powerPs,massKg:VEHICLE_PHYSICS.massKg,grip:VEHICLE_PHYSICS.grip};
  try{
    const speedAfter=(powerPs,massKg,grip)=>{
      Object.assign(VEHICLE_PHYSICS,{powerPs,massKg,grip});
      const c=truck();ticks(120,dt=>stepPlanar(c,dt,{throttle:1}));
      return c.speed;
    };
    const baseline=speedAfter(1500,5000,.9);
    assert.ok(speedAfter(2200,5000,.9)>baseline+.5);
    assert.ok(speedAfter(1500,6500,.9)<baseline-.5);
    assert.ok(speedAfter(1500,5000,.45)<baseline-.35);
  }finally{Object.assign(VEHICLE_PHYSICS,previous);}
});
test('Eine Rennsimulation verwendet ihr explizit übergebenes Physikprofil',()=>{
  const profile=createVehiclePhysicsProfile({massKg:6200,powerPs:2100,grip:.75});
  const r=new Race(undefined,true,profile);r.mode='racing';r.cars=[r.player];r.props=[];r.mounds=[];
  ticks(1,dt=>r.step(dt,{forward:true}));
  assert.equal(r.physics,profile);assert.equal(r.player.mass,6200);
  assert.notEqual(profile.massKg,VEHICLE_PHYSICS.massKg);
});
test('Vier Radkontakte ruhen exakt auf ebenem Boden',()=>{
  const c=truck();ticks(1200,dt=>stepVertical(c,dt,[0,0,0,0]));
  assert.equal(c.y,0);assert.equal(c.vy,0);assert.equal(c.air,false);assert.equal(c.groundedFraction,1);
});
test('Ein einseitiges Hindernis erzeugt unterschiedliche Radkontakte und Rollwinkel',()=>{
  const c=truck();ticks(120,dt=>stepVertical(c,dt,[.6,0,.6,0]));
  assert.ok(c.roll>.15);assert.ok(c.y>.15);assert.equal(c.wheelContacts.length,4);
});
test('In der Luft erzeugen Gas und Bremse keine zusätzliche Vorwärtskraft',()=>{
  const c=truck({air:true,y:5,speed:8});ticks(120,dt=>stepPlanar(c,dt,{throttle:1,brake:1}));
  assert.ok(Math.abs(c.speed-8)<1e-8);
});
test('Landung federt ein und kommt ohne Dauerhüpfen zur Ruhe',()=>{
  const c=truck({air:true,y:3});let landed=false,maxAfter=0;
  ticks(720,dt=>{const result=stepVertical(c,dt,[0,0,0,0]);landed ||=result.landing;if(landed)maxAfter=Math.max(maxAfter,c.y);});
  assert.ok(landed);assert.ok(maxAfter<.7);assert.ok(Math.abs(c.y)<.002&&Math.abs(c.vy)<.002);
});
test('Truck-Kollision überträgt Impuls, ohne lineare Energie zu erzeugen',()=>{
  const a=truck({speed:8}),b=truck({z:3.3,heading:Math.PI,speed:4});
  const beforeMomentum=a.mass*a.vz+b.mass*b.vz;
  const beforeEnergy=.5*a.mass*a.speed**2+.5*b.mass*b.speed**2;
  assert.ok(collideTrucks(a,b)>10);
  assert.ok(Math.abs(a.mass*a.vz+b.mass*b.vz-beforeMomentum)<1e-5);
  const afterEnergy=.5*a.mass*(a.vx*a.vx+a.vz*a.vz)+.5*b.mass*(b.vx*b.vx+b.vz*b.vz);
  assert.ok(afterEnergy<beforeEnergy);assert.ok(b.vz> -4);
});
test('Leichte Kontakte erzeugen weder Extra-Schub noch falsche Crashs',()=>{
  const a=truck(),b=truck({z:3.3});assert.equal(collideTrucks(a,b),0);
  assert.equal(a.speed,0);assert.equal(b.speed,0);
});
test('Wandkontakt prallt gedämpft ab, dreht aber das Lenkrad nicht automatisch',()=>{
  const c=truck({x:89,heading:Math.PI/2,speed:8}),heading=c.heading;
  assert.ok(collideWall(c,-1,0,1)>7);assert.equal(c.x,88);assert.equal(c.heading,heading);
  assert.ok(c.vx<0&&Math.abs(c.vx)<1.1);
});
test('Arena-Sprunghügel hebt bei Anlauf in beiden Richtungen natürlich ab',()=>{
  for(const heading of [0,Math.PI]){
    const r=new Race(undefined,true),c=r.player,z=heading===0?-35:35;
    r.mode='racing';r.cars=[c];r.props=[];
    Object.assign(c,{x:0,z,heading,s:z+95,speed:8.8,projection:r.track.project(0,z)});
    let jump=false,land=false,peak=0;
    ticks(1080,dt=>{r.step(dt,{forward:true});jump ||=c.air;peak=Math.max(peak,c.y);land ||=r.events.some(e=>e.type==='land');});
    assert.ok(jump&&land);assert.ok(peak>4.6&&peak<7);
  }
});
test('Anrollen ohne Fahrhilfe bleibt ohne sichtbaren vertikalen Sprung',()=>{
  const r=new Race();r.start(false);r.mode='racing';r.cars=[r.player];
  let previousY=0,maxChange=0;
  ticks(240,dt=>{r.step(dt,{forward:true});maxChange=Math.max(maxChange,Math.abs(r.player.y-previousY));previousY=r.player.y;});
  assert.ok(maxChange<.002);assert.ok(r.player.speed<10);assert.equal(r.player.air,false);
});
test('Seitliche Steilwand einer Rampe stoppt Reifen statt den Truck hochzusetzen',()=>{
  const r=new Race(undefined,true),c=r.player;r.mode='racing';r.cars=[c];r.props=[];
  Object.assign(c,{x:-13,z:0,s:95,heading:Math.PI/2,speed:8,projection:r.track.project(-13,0)});
  let peak=0;ticks(360,dt=>{r.step(dt,{forward:true});peak=Math.max(peak,c.y);});
  assert.ok(c.x< -11);assert.ok(peak<.1);assert.equal(c.respawns,0);
});

test('Beide Spielarten bleiben ohne Gas und Lenkhilfe stehen',()=>{
  for(const arena of [false,true]){
    const r=new Race(undefined,arena);r.start(true);r.mode='racing';r.cars=[r.player];const c=r.player,{x,z,heading}=c;
    ticks(1200,dt=>r.step(dt,{}));assert.equal(r.assist,false);assert.equal(c.speed,0);assert.equal(c.x,x);assert.equal(c.z,z);assert.equal(c.heading,heading);
  }
});
test('Rampenlippe erzeugt keine künstliche Nasendrehung im Flug',()=>{
  const c=truck({z:-5,speed:12.5});let jumped=false,landed=false,maxAirPitch=0;
  ticks(480,dt=>{
    c.z+=12.5*dt;
    const heights=[1,1,-1,-1].map(front=>{const z=c.z+front*VEHICLE.wheelbase/2;return z>0&&z<14?z/14*3.4:0;});
    const result=stepVertical(c,dt,heights);jumped ||=result.takeoff;landed ||=result.landing;
    if(c.air)maxAirPitch=Math.max(maxAirPitch,Math.abs(c.pitch));
  });
  assert.ok(jumped&&landed);assert.ok(maxAirPitch<Math.PI/6,'Keine 50-Grad-Drehung beim Absprung');
});

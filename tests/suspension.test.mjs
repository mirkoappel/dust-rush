import test from 'node:test';
import assert from 'node:assert/strict';
import {createSuspension,stepSuspension} from '../src/suspension.mjs';
import {createVehiclePhysicsProfile} from '../src/vehicle-physics-profile.mjs';
const tick=(s,config,n=120)=>{for(let i=0;i<n;i++)stepSuspension(s,1/60,config);};
test('Federung bleibt auf ebenem Boden in Ruhe',()=>{
  const s=createSuspension();tick(s,{});assert.equal(s.heave,0);assert.ok(s.wheels.every(w=>w.offset===0&&w.contact));
});
test('Jedes Rad kann unabhängig auf eine Bodenwelle reagieren',()=>{
  const s=createSuspension();tick(s,{ground:[.16,0,0,0]},45);
  assert.ok(s.wheels[0].offset>.15);assert.ok(Math.abs(s.wheels[1].offset)<.005);assert.ok(Math.abs(s.wheels[2].offset)<.005);
  assert.ok(s.wheels[0].compression>s.wheels[1].compression+.14);
});
test('In der Luft federn alle Räder aus',()=>{
  const s=createSuspension();tick(s,{air:true},60);assert.ok(s.wheels.every(w=>w.offset<-.2&&!w.contact));
});
test('Landung drückt die Federung zusammen, danach wippt sie gedämpft aus',()=>{
  const s=createSuspension();tick(s,{air:true},60);s.impact=15;
  let minimum=0,maximum=-1;
  for(let i=0;i<120;i++){stepSuspension(s,1/60,{});minimum=Math.min(minimum,s.heave);if(i>25)maximum=Math.max(maximum,s.heave);}
  assert.ok(minimum<-.15);assert.ok(maximum>0);assert.ok(Math.abs(s.heave)<.008);
});
test('Gasgeben, Bremsen und Kurven erzeugen Lastwechsel',()=>{
  const s=createSuspension();tick(s,{acceleration:25,lateralAcceleration:18},90);assert.ok(s.pitch<-.04);assert.ok(s.roll>.07);
  tick(s,{acceleration:-32,lateralAcceleration:-18},90);assert.ok(s.pitch>.05);assert.ok(s.roll<-.07);
});
test('Federwege bleiben auch bei harten Impulsen begrenzt',()=>{
  const s=createSuspension();s.heaveVelocity=-100;s.rollVelocity=100;
  for(let i=0;i<300;i++){stepSuspension(s,1/60,{ground:[.5,-.5,.4,-.4],crash:i===0?1:0});assert.ok(Number.isFinite(s.heave));assert.ok(s.heave>=-.34&&s.heave<=.28);assert.ok(s.wheels.every(w=>Number.isFinite(w.offset)&&w.offset>=-.38&&w.offset<=.45));}
});
test('Gewicht, Federhärte und Dämpfung wirken über ein isoliertes Fahrzeugprofil',()=>{
  const response=(massKg,stiffness,damping)=>{
    const profile=createVehiclePhysicsProfile({massKg,suspension:{stiffness,damping}});
    const state=createSuspension();state.heave=.18;state.heaveVelocity=-1;
    stepSuspension(state,1/60,{},profile);
    return state;
  };
  const light=response(3500,1,1),heavy=response(7000,1,1);
  const soft=response(5000,.5,1),stiff=response(5000,1.6,1);
  const loose=response(5000,1,.5),damped=response(5000,1,1.8);
  assert.ok(Math.abs(light.heaveVelocity)>Math.abs(heavy.heaveVelocity));
  assert.ok(Math.abs(stiff.heaveVelocity)>Math.abs(soft.heaveVelocity));
  assert.ok(Math.abs(damped.heaveVelocity)<Math.abs(loose.heaveVelocity));
});

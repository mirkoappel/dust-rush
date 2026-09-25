import test from 'node:test';
import assert from 'node:assert/strict';
import {createDebugTuning} from '../src/ui/debug-tuning.mjs';
import {CAMERA_TUNING,createDrivingCameraMotion} from '../src/driving-camera.mjs';
import {createVehiclePhysicsProfile,snapshotVehiclePhysicsProfile} from '../src/vehicle-physics-profile.mjs';

function fixture(cameraOverrides={}){
  const entries={launch:[25,160],baseSpeed:[8,22],powerPs:[750,2500],massKg:[3500,7000],grip:[.4,1.3],brakingG:[.3,1.4],steering:[50,150],suspensionStiffness:[50,160],suspensionDamping:[50,180],speed:[0,14],duration:[1,10],recharge:[1,8],targetDistance:[6,12],reactionTime:[0,1.5],droneAcceleration:[2,16],droneBraking:[2,18]};
  const fields=Object.entries(entries).map(([name,[min,max]])=>({dataset:{tuning:name},min,max,value:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}}));
  const outputs=Object.fromEntries(Object.keys(entries).map(name=>[name,{textContent:''}]));
  const button=()=>({listeners:{},attributes:{},addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(name,value){this.attributes[name]=value;}});
  const vehicleTab={...button(),dataset:{tuningTab:'vehicle'}},nitroTab={...button(),dataset:{tuningTab:'nitro'}},droneTab={...button(),dataset:{tuningTab:'drone'}};
  const vehiclePane={dataset:{tuningPanel:'vehicle'},hidden:false},nitroPane={dataset:{tuningPanel:'nitro'},hidden:true},dronePane={dataset:{tuningPanel:'drone'},hidden:true};
  const panel={
    hidden:true,ownerDocument:null,
    querySelectorAll:selector=>selector==='[data-tuning]'?fields:selector==='[data-tuning-tab]'?[vehicleTab,nitroTab,droneTab]:[vehiclePane,nitroPane,dronePane],
    querySelector:selector=>selector==='[data-tuning-drag-handle]'?null:outputs[selector.match(/"([^"]+)"/)[1]]
  };
  const toggle=button(),resetButton=button(),profile=createVehiclePhysicsProfile(),camera={...CAMERA_TUNING,...cameraOverrides};let opens=0;
  const tuning=createDebugTuning({panel,toggle,resetButton,profile,camera,onOpen:()=>opens++});
  const set=(name,value)=>{const field=fields.find(field=>field.dataset.tuning===name);field.value=String(value);field.listeners.input();};
  return {profile,nitro:profile.nitro,camera,speeds:profile.speed,panel,toggle,resetButton,vehicleTab,nitroTab,droneTab,vehiclePane,nitroPane,dronePane,outputs,tuning,set,get opens(){return opens;}};
}

test('Tuning verändert die wirksamen Nitro- und Kamera-Werte sofort und setzt sie zurück',()=>{
  const f=fixture(),defaults={profile:snapshotVehiclePhysicsProfile(f.profile),camera:{...f.camera}};
  assert.equal(f.panel.hidden,true);
  assert.equal(f.outputs.launch.textContent,'25 %');
  assert.equal(f.outputs.speed.textContent,'+31 km/h');
  assert.equal(f.outputs.recharge.textContent,'1×');
  assert.equal(f.outputs.baseSpeed.textContent,'56 km/h');
  assert.equal(f.outputs.powerPs.textContent,'1.500 PS');
  assert.equal(f.outputs.massKg.textContent,'5 t');
  assert.equal(f.outputs.grip.textContent,'μ 0,9');
  assert.equal(f.outputs.brakingG.textContent,'0,84 g');
  assert.equal(f.outputs.steering.textContent,'100 %');
  assert.equal(f.outputs.suspensionStiffness.textContent,'100 %');
  assert.equal(f.outputs.suspensionDamping.textContent,'100 %');
  assert.equal(f.outputs.reactionTime.textContent,'0,45 s');
  f.toggle.listeners.click();assert.equal(f.tuning.open,true);assert.equal(f.opens,1);
  assert.equal(f.vehicleTab.attributes['aria-selected'],'true');
  f.nitroTab.listeners.click();
  assert.equal(f.vehiclePane.hidden,true);assert.equal(f.nitroPane.hidden,false);assert.equal(f.dronePane.hidden,true);
  assert.equal(f.nitroTab.attributes['aria-selected'],'true');
  f.droneTab.listeners.click();
  assert.equal(f.vehiclePane.hidden,true);assert.equal(f.nitroPane.hidden,true);assert.equal(f.dronePane.hidden,false);
  assert.equal(f.droneTab.attributes['aria-selected'],'true');
  f.set('launch',25);
  assert.equal(f.nitro.power,1);
  assert.equal(f.nitro.forwardGrip,1);
  f.set('baseSpeed',22);f.set('powerPs',2200);f.set('massKg',6000);f.set('grip',1.1);f.set('brakingG',1.05);f.set('steering',125);f.set('suspensionStiffness',135);f.set('suspensionDamping',145);f.set('speed',14);f.set('duration',8);f.set('recharge',8);
  f.set('targetDistance',12);f.set('reactionTime',1.2);f.set('droneAcceleration',4);f.set('droneBraking',6);
  assert.equal(f.speeds.race,22);assert.ok(Math.abs(f.speeds.arena-11.5*22/15.5)<1e-12);
  assert.equal(f.profile.powerPs,2200);assert.equal(f.profile.massKg,6000);
  assert.equal(f.profile.grip,1.1);assert.equal(f.profile.brakingG,1.05);
  assert.equal(f.profile.steering,1.25);
  assert.equal(f.profile.suspension.stiffness,1.35);assert.equal(f.profile.suspension.damping,1.45);
  assert.equal(f.nitro.speedGain,14);assert.equal(f.nitro.duration,8);
  assert.equal(f.nitro.recharge,1.5);assert.equal(f.nitro.delay,.25);
  assert.equal(f.camera.targetDistance,12);assert.equal(f.camera.reactionTime,1.2);
  assert.equal(f.camera.acceleration,4);assert.equal(f.camera.braking,6);
  assert.equal(f.outputs.targetDistance.textContent,'12 m');
  f.resetButton.listeners.click();assert.deepEqual(f.profile,defaults.profile);assert.deepEqual(f.camera,defaults.camera);
  f.toggle.listeners.click();assert.equal(f.tuning.open,false);
  assert.equal(f.toggle.attributes['aria-expanded'],'false');
});

test('Drohnen-Regler zeigen die tatsächlichen Werte beim Öffnen',()=>{
  const f=fixture({reactionTime:1.25,braking:12});
  assert.equal(f.outputs.reactionTime.textContent,'1,25 s');
  assert.equal(f.outputs.droneBraking.textContent,'12 m/s²');
});

test('Bereits erzeugte Fahrkamera liest neue Nachlaufwerte ohne Neustart',()=>{
  const c=createDrivingCameraMotion(),previous={...CAMERA_TUNING};
  try{
    c.step(1/60,{speed:10});
    let baseline=0;
    for(let i=1;i<=240;i++)baseline=Math.max(baseline,c.step(1/60,{boosting:true,speed:10+Math.min(i/60*4,8)}).distanceOffset);
    c.reset();c.step(1/60,{speed:10});
    CAMERA_TUNING.reactionTime=1.2;CAMERA_TUNING.acceleration=2;
    let max=0;
    for(let i=1;i<=240;i++)max=Math.max(max,c.step(1/60,{boosting:true,speed:10+Math.min(i/60*4,8)}).distanceOffset);
    assert.ok(max>baseline&&max<20,{baseline,max});
  }finally{Object.assign(CAMERA_TUNING,previous);}
});

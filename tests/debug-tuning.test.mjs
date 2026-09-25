import test from 'node:test';
import assert from 'node:assert/strict';
import {createDebugTuning} from '../src/ui/debug-tuning.mjs';
import {CAMERA_TUNING,createDrivingCameraMotion} from '../src/driving-camera.mjs';
import {createVehiclePhysicsProfile,snapshotVehiclePhysicsProfile} from '../src/vehicle-physics-profile.mjs';

function fixture(cameraOverrides={}){
  const entries={launch:[25,160],powerPs:[750,2500],gearCount:[2,6],redlineRpm:[4000,9000],finalRatio:[18,48],shiftDuration:[.05,.6],gearHoldTime:[.2,1.5],throttleResponse:[.05,1.5],accelerationFalloff:[1,30],rollingResistance:[.01,.12],dragArea:[2,12],massKg:[3500,7000],grip:[.4,1.3],brakingG:[.3,1.4],brakingResponse:[.02,.8],brakingGrip:[.4,2],steering:[10,150],suspensionSpringRate:[5,160],suspensionDampingRate:[.5,15],speed:[0,14],duration:[1,10],recharge:[1,8],targetDistance:[6,12],reactionTime:[0,1.5],droneAcceleration:[0,20],droneBraking:[2,18],droneMaxSpeed:[20,200],droneSpeedResponse:[.05,2]};
  const fields=Object.entries(entries).map(([name,[min,max]])=>({dataset:{tuning:name},min,max,value:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}}));
  const outputs=Object.fromEntries(Object.keys(entries).map(name=>[name,{textContent:''}]));
  const button=()=>({listeners:{},attributes:{},addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(name,value){this.attributes[name]=value;}});
  const drivetrainTab={...button(),dataset:{tuningTab:'drivetrain'}},chassisTab={...button(),dataset:{tuningTab:'chassis'}},tyresTab={...button(),dataset:{tuningTab:'tyres'}},nitroTab={...button(),dataset:{tuningTab:'nitro'}},droneTab={...button(),dataset:{tuningTab:'drone'}};
  const feelTab={...button(),dataset:{tuningMainTab:'feel'}},performanceTab={...button(),dataset:{tuningMainTab:'performance'}};
  const drivetrainPane={dataset:{tuningPanel:'drivetrain'},hidden:false},chassisPane={dataset:{tuningPanel:'chassis'},hidden:true},tyresPane={dataset:{tuningPanel:'tyres'},hidden:true},nitroPane={dataset:{tuningPanel:'nitro'},hidden:true},dronePane={dataset:{tuningPanel:'drone'},hidden:true};
  const feelPane={dataset:{tuningMainPanel:'feel'},hidden:false},performancePane={dataset:{tuningMainPanel:'performance'},hidden:true};
  const panel={
    hidden:true,ownerDocument:null,
    querySelectorAll:selector=>selector==='[data-tuning]'?fields:selector==='[data-tuning-main-tab]'?[feelTab,performanceTab]:selector==='[data-tuning-main-panel]'?[feelPane,performancePane]:selector==='[data-tuning-tab]'?[drivetrainTab,chassisTab,tyresTab,nitroTab,droneTab]:[drivetrainPane,chassisPane,tyresPane,nitroPane,dronePane],
    querySelector:selector=>selector==='[data-tuning-drag-handle]'?null:outputs[selector.match(/"([^"]+)"/)[1]]
  };
  const toggle=button(),resetButton=button(),profile=createVehiclePhysicsProfile(),camera={...CAMERA_TUNING,...cameraOverrides};let opens=0;
  const tuning=createDebugTuning({panel,toggle,resetButton,profile,camera,onOpen:()=>opens++});
  const set=(name,value)=>{const field=fields.find(field=>field.dataset.tuning===name);field.value=String(value);field.listeners.input();};
  return {profile,nitro:profile.nitro,camera,speeds:profile.speed,panel,toggle,resetButton,feelTab,performanceTab,feelPane,performancePane,drivetrainTab,chassisTab,tyresTab,nitroTab,droneTab,drivetrainPane,chassisPane,tyresPane,nitroPane,dronePane,outputs,tuning,set,get opens(){return opens;}};
}

test('Tuning verändert die wirksamen Nitro- und Kamera-Werte sofort und setzt sie zurück',()=>{
  const f=fixture(),defaults={profile:snapshotVehiclePhysicsProfile(f.profile),camera:{...f.camera}};
  assert.equal(f.panel.hidden,true);
  assert.equal(f.outputs.launch.textContent,'25 %');
  assert.equal(f.outputs.speed.textContent,'+31 km/h');
  assert.equal(f.outputs.recharge.textContent,'1×');
  assert.equal(f.outputs.powerPs.textContent,'1.500 PS');
  assert.equal(f.outputs.gearCount.textContent,'3 Gänge');
  assert.equal(f.outputs.redlineRpm.textContent,'7.000 U/min');
  assert.equal(f.outputs.finalRatio.textContent,'32,4 : 1');
  assert.equal(f.outputs.shiftDuration.textContent,'0,22 s');
  assert.equal(f.outputs.gearHoldTime.textContent,'0,75 s');
  assert.equal(f.outputs.throttleResponse.textContent,'0,29 s');
  assert.equal(f.outputs.accelerationFalloff.textContent,'7 km/h');
  assert.equal(f.outputs.massKg.textContent,'5 t');
  assert.equal(f.outputs.grip.textContent,'μ 0,9');
  assert.equal(f.outputs.brakingG.textContent,'0,84 g');
  assert.equal(f.outputs.brakingResponse.textContent,'0,08 s');
  assert.equal(f.outputs.brakingGrip.textContent,'μ 0,9');
  assert.equal(f.outputs.steering.textContent,'100 %');
  assert.equal(f.outputs.suspensionSpringRate.textContent,'97,5 kN/m');
  assert.equal(f.outputs.suspensionDampingRate.textContent,'8 kN·s/m');
  assert.equal(f.outputs.rollingResistance.textContent,'Crr 0,050');
  assert.equal(f.outputs.dragArea.textContent,'CdA 6 m²');
  assert.equal(f.outputs.reactionTime.textContent,'0 s');
  assert.equal(f.outputs.droneMaxSpeed.textContent,'144 km/h');
  assert.equal(f.outputs.droneSpeedResponse.textContent,'0,35 s');
  f.toggle.listeners.click();assert.equal(f.tuning.open,true);assert.equal(f.opens,1);
  assert.equal(f.feelTab.attributes['aria-selected'],'true');
  f.performanceTab.listeners.click();assert.equal(f.feelPane.hidden,true);assert.equal(f.performancePane.hidden,false);
  f.feelTab.listeners.click();assert.equal(f.feelPane.hidden,false);assert.equal(f.performancePane.hidden,true);
  assert.equal(f.drivetrainTab.attributes['aria-selected'],'true');
  f.chassisTab.listeners.click();
  assert.equal(f.drivetrainPane.hidden,true);assert.equal(f.chassisPane.hidden,false);assert.equal(f.tyresPane.hidden,true);
  f.tyresTab.listeners.click();
  assert.equal(f.chassisPane.hidden,true);assert.equal(f.tyresPane.hidden,false);assert.equal(f.nitroPane.hidden,true);
  f.nitroTab.listeners.click();
  assert.equal(f.tyresPane.hidden,true);assert.equal(f.nitroPane.hidden,false);assert.equal(f.dronePane.hidden,true);
  assert.equal(f.nitroTab.attributes['aria-selected'],'true');
  f.droneTab.listeners.click();
  assert.equal(f.drivetrainPane.hidden,true);assert.equal(f.nitroPane.hidden,true);assert.equal(f.dronePane.hidden,false);
  assert.equal(f.droneTab.attributes['aria-selected'],'true');
  f.set('launch',25);
  assert.equal(f.nitro.power,1);
  assert.equal(f.nitro.forwardGrip,1);
  f.set('powerPs',2200);f.set('gearCount',6);f.set('redlineRpm',8250);f.set('finalRatio',28);f.set('shiftDuration',.41);f.set('gearHoldTime',1.1);f.set('throttleResponse',.8);f.set('accelerationFalloff',18);f.set('rollingResistance',.08);f.set('dragArea',9.5);f.set('massKg',6000);f.set('grip',1.1);f.set('brakingG',1.05);f.set('brakingResponse',.3);f.set('brakingGrip',1.6);f.set('steering',125);f.set('suspensionSpringRate',135);f.set('suspensionDampingRate',11.6);f.set('speed',14);f.set('duration',8);f.set('recharge',8);
  f.set('targetDistance',12);f.set('reactionTime',1.2);f.set('droneAcceleration',4);f.set('droneBraking',6);f.set('droneMaxSpeed',180);f.set('droneSpeedResponse',1.1);
  assert.equal(f.profile.powerPs,2200);assert.equal(f.profile.massKg,6000);
  assert.equal(f.profile.drivetrain.gears.length,6);assert.equal(f.profile.drivetrain.gears.at(-1),1);
  assert.equal(f.profile.drivetrain.redlineRpm,8250);assert.equal(f.profile.drivetrain.finalRatio,28);
  assert.equal(f.profile.drivetrain.shiftDuration,.41);
  assert.equal(f.profile.drivetrain.gearHoldTime,1.1);
  assert.equal(f.profile.throttleResponse,.8);assert.equal(f.profile.accelerationFalloff,5);
  assert.equal(f.profile.resistance.rollingCoefficient,.08);assert.equal(f.profile.resistance.dragAreaM2,9.5);
  assert.equal(f.profile.grip,1.1);assert.equal(f.profile.brakingG,1.05);
  assert.equal(f.profile.brakingResponse,.3);assert.equal(f.profile.brakingGrip,1.6);
  assert.equal(f.profile.steering,1.25);
  assert.equal(f.profile.suspension.springRateKnPerM,135);assert.equal(f.profile.suspension.dampingKnSPerM,11.6);
  assert.equal(f.nitro.speedGain,14);assert.equal(f.nitro.duration,8);
  assert.equal(f.nitro.recharge,1.5);assert.equal(f.nitro.delay,.25);
  assert.equal(f.camera.targetDistance,12);assert.equal(f.camera.reactionTime,1.2);
  assert.equal(f.camera.acceleration,4);assert.equal(f.camera.braking,6);assert.equal(f.camera.maxSpeed,50);assert.equal(f.camera.speedResponse,1.1);
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

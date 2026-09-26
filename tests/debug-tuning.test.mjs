import test from 'node:test';
import assert from 'node:assert/strict';
import {createDebugTuning} from '../src/ui/debug-tuning.mjs';
import {CAMERA_PRESETS,CAMERA_TUNING,createDrivingCameraMotion} from '../src/driving-camera.mjs';
import {createVehiclePhysicsProfile,snapshotVehiclePhysicsProfile,VEHICLE_PRESETS} from '../src/vehicle-physics-profile.mjs';

function fixture(cameraOverrides={}){
  const entries={
    massKg:[500,30000],powerPs:[50,2500],maxTorqueNm:[50,4000],torquePeakStartRpm:[500,10000],torquePeakEndRpm:[750,11000],powerRpm:[1000,12000],idleRpm:[500,4500],redlineRpm:[1500,13000],throttleResponse:[.05,3],
    couplingRpm:[600,8000],torqueMultiplier:[1,3],drivetrainEfficiency:[70,98],gearCount:[2,8],gear1:[.3,6],gear2:[.3,6],gear3:[.3,6],gear4:[.3,6],gear5:[.3,6],gear6:[.3,6],gear7:[.3,6],gear8:[.3,6],finalRatio:[2,48],upshiftRatio:[30,100],downshiftRatio:[5,60],shiftDuration:[.05,1.5],gearHoldTime:[.2,4],
    steering:[10,150],suspensionSpringRate:[5,160],suspensionDampingRate:[.5,15],dragArea:[.2,40],downforceArea:[0,8],
    wheelDiameter:[.5,1.8],grip:[.4,2],rollingResistance:[0,.5],brakingG:[.3,2],brakingResponse:[.02,.8],brakingGrip:[.4,2],
    launch:[0,400],rpmReserve:[0,60],rampTime:[0,10],duration:[1,10],recharge:[1,8],
    targetDistance:[6,12],reactionTime:[0,3],droneAcceleration:[0,20],droneBraking:[2,18],droneSpeedReserve:[20,200],droneSpeedResponse:[.05,2]
  };
  const gearRows={};
  const fields=Object.entries(entries).map(([name,[min,max]])=>({
    dataset:{tuning:name},min,max,value:'',listeners:{},
    addEventListener(type,fn){this.listeners[type]=fn;},
    closest(selector){
      if(selector!=='[data-gear-row]'||!/^gear\d$/.test(name))return null;
      return gearRows[name]??=( {hidden:false,toggleAttribute(attribute,state){if(attribute==='hidden')this.hidden=state;}} );
    }
  }));
  const outputs=Object.fromEntries(Object.keys(entries).map(name=>[name,{textContent:''}]));
  const button=()=>({listeners:{},attributes:{},addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(name,value){this.attributes[name]=value;}});
  const tabNames=['motor','gearbox','chassis','tyres','nitro','drone'];
  const tabs=Object.fromEntries(tabNames.map(name=>[name,{...button(),dataset:{tuningTab:name}}]));
  const panes=Object.fromEntries(tabNames.map((name,index)=>[name,{dataset:{tuningPanel:name},hidden:index!==0}]));
  const feelTab={...button(),dataset:{tuningMainTab:'feel'}},performanceTab={...button(),dataset:{tuningMainTab:'performance'}};
  const feelPane={dataset:{tuningMainPanel:'feel'},hidden:false},performancePane={dataset:{tuningMainPanel:'performance'},hidden:true};
  const makeSelect=(name,value)=>({dataset:{tuningSelect:name},value,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}});
  const selects={
    preset:makeSelect('preset','monster'),
    couplingType:makeSelect('couplingType','converter'),
    driveLayout:makeSelect('driveLayout','awd')
  };
  const panel={
    hidden:true,ownerDocument:null,
    querySelectorAll:selector=>{
      if(selector==='[data-tuning]')return fields;
      if(selector==='[data-tuning-select]')return Object.values(selects);
      if(selector==='[data-tuning-main-tab]')return [feelTab,performanceTab];
      if(selector==='[data-tuning-main-panel]')return [feelPane,performancePane];
      if(selector==='[data-tuning-tab]')return Object.values(tabs);
      if(selector==='[data-tuning-panel]')return Object.values(panes);
      return [];
    },
    querySelector:selector=>{
      if(selector==='[data-tuning-drag-handle]')return null;
      const match=selector.match(/data-tuning-value="([^"]+)"/);
      return match?outputs[match[1]]:null;
    }
  };
  const toggle=button(),resetButton=button(),profile=createVehiclePhysicsProfile(VEHICLE_PRESETS.monster.values),camera={...CAMERA_TUNING,...cameraOverrides};
  let opens=0,changes=0,lastChange=null;
  const tuning=createDebugTuning({
    panel,toggle,resetButton,profile,camera,initialPreset:'monster',
    defaultProfile:createVehiclePhysicsProfile(VEHICLE_PRESETS.monster.values),defaultCamera:CAMERA_PRESETS.monster,
    onOpen:()=>opens++,onChange:state=>{changes++;lastChange=state;}
  });
  const set=(name,value)=>{const field=fields.find(item=>item.dataset.tuning===name);field.value=String(value);field.listeners.input();};
  const choose=(name,value)=>{selects[name].value=value;selects[name].listeners.change();};
  return {profile,camera,panel,toggle,resetButton,feelTab,performanceTab,feelPane,performancePane,tabs,panes,selects,outputs,gearRows,tuning,set,choose,get opens(){return opens;},get changes(){return changes;},get lastChange(){return lastChange;}};
}

test('Presets laden ausschließlich sichtbare Werte und manuelles Tuning wird benutzerdefiniert',()=>{
  const f=fixture();
  assert.equal(f.selects.preset.value,'monster');
  f.choose('preset','suv');
  assert.equal(f.profile.massKg,1600);
  assert.equal(f.profile.powerPs,150);
  assert.equal(f.profile.wheelRadiusM,.4);
  assert.equal(f.profile.drivetrain.couplingType,'converter');
  assert.equal(f.profile.drivetrain.driveLayout,'awd');
  assert.equal(f.profile.drivetrain.gears.length,6);
  assert.equal(f.outputs.wheelDiameter.textContent,'0,8 m');
  f.set('powerPs',180);
  assert.equal(f.selects.preset.value,'custom');
  assert.equal(f.lastChange.preset,'custom');
  assert.equal(f.lastChange.profile.powerPs,180);
  assert.deepEqual(f.lastChange.camera,f.camera);
  f.choose('preset','formula');
  assert.equal(f.profile.resistance.downforceAreaM2,5);
  assert.equal(f.profile.steering,.35);
  assert.equal(f.profile.drivetrain.gears.length,8);
  assert.equal(f.camera.targetDistance,CAMERA_PRESETS.formula.targetDistance);
  assert.equal(f.camera.speedReserve,CAMERA_PRESETS.formula.speedReserve);
  assert.equal(f.selects.preset.value,'formula');
  f.tabs.gearbox.listeners.click();
  f.choose('preset','compact');
  assert.equal(f.tabs.gearbox.attributes['aria-selected'],'true');
  assert.equal(f.panes.gearbox.hidden,false);
  assert.equal(f.profile.drivetrain.gears.length,5);
  assert.equal(f.outputs.powerPs.textContent,'95 PS');
  f.choose('preset','family');
  assert.equal(f.panes.gearbox.hidden,false);
  assert.equal(f.profile.drivetrain.gears.length,6);
  assert.equal(f.outputs.powerPs.textContent,'150 PS');
  f.choose('preset','monsterMedium');
  assert.equal(f.profile.powerPs,1000);
  assert.equal(f.profile.drivetrain.finalRatio,20);
  assert.equal(f.camera.speedReserve,CAMERA_PRESETS.monsterMedium.speedReserve);
  f.choose('preset','monsterBeginner');
  assert.equal(f.profile.powerPs,400);
  assert.equal(f.profile.throttleResponse,.75);
  assert.equal(f.camera.speedReserve,CAMERA_PRESETS.monsterBeginner.speedReserve);
});

test('Direkte Motor-, Getriebe-, Reifen- und Bremswerte wirken sofort und lassen sich zurücksetzen',()=>{
  const f=fixture(),defaults=snapshotVehiclePhysicsProfile(f.profile);
  assert.equal(f.outputs.powerPs.textContent,'1.500 PS');
  assert.equal(f.outputs.maxTorqueNm.textContent,'1.900 Nm');
  assert.equal(f.outputs.wheelDiameter.textContent,'1,68 m');
  assert.equal(f.outputs.drivetrainEfficiency.textContent,'82 %');
  assert.equal(f.outputs.downforceArea.textContent,'ClA 0 m²');
  f.set('powerPs',700);f.set('maxTorqueNm',900);f.set('redlineRpm',8000);f.set('powerRpm',7000);
  f.set('gearCount',6);f.set('gear1',4.2);f.set('finalRatio',4);f.set('drivetrainEfficiency',90);
  f.choose('couplingType','clutch');f.choose('driveLayout','rwd');
  f.set('wheelDiameter',.8);f.set('rollingResistance',.02);f.set('dragArea',.8);f.set('downforceArea',.4);
  f.set('brakingG',1.1);f.set('brakingGrip',1.2);
  assert.equal(f.profile.powerPs,700);assert.equal(f.profile.engine.maxTorqueNm,900);
  assert.equal(f.profile.drivetrain.redlineRpm,8000);assert.equal(f.profile.engine.powerRpm,7000);
  assert.equal(f.profile.drivetrain.gears.length,6);assert.equal(f.profile.drivetrain.gears[0],4.2);
  assert.equal(f.profile.drivetrain.finalRatio,4);assert.equal(f.profile.drivetrain.efficiency,.9);
  assert.equal(f.profile.drivetrain.couplingType,'clutch');assert.equal(f.profile.drivetrain.driveLayout,'rwd');
  assert.equal(f.profile.wheelRadiusM,.4);assert.equal(f.profile.resistance.downforceAreaM2,.4);
  assert.equal(f.profile.brakingG,1.1);assert.equal(f.profile.brakingGrip,1.2);
  f.resetButton.listeners.click();
  assert.deepEqual(f.profile,defaults);
  assert.deepEqual(f.camera,CAMERA_PRESETS.monster);
  assert.equal(f.selects.preset.value,'monster');
  assert.equal(f.lastChange.preset,'monster');
});

test('Presetanzeigen behalten exakte Physikwerte, auch wenn der Browser den Regler auf eine Schrittweite rundet',()=>{
  const f=fixture(),power=f.panel.querySelectorAll('[data-tuning]').find(v=>v.dataset.tuning==='powerPs');
  let thumb='50';
  Object.defineProperty(power,'value',{get:()=>thumb,set:value=>{thumb=String(50+Math.round((Number(value)-50)/10)*10);}});
  f.choose('preset','compact');
  assert.equal(power.value,'100');
  assert.equal(f.profile.powerPs,95);
  assert.equal(f.outputs.powerPs.textContent,'95 PS');
  assert.equal(f.outputs.massKg.textContent,'1,17 t');
});

test('Schaltpunkte und direkte Gangübersetzungen bleiben gültig gekoppelt',()=>{
  const f=fixture();
  f.set('upshiftRatio',30);
  assert.equal(f.profile.drivetrain.upshiftRatio,.3);
  assert.ok(f.profile.drivetrain.downshiftRatio<.18);
  f.set('downshiftRatio',60);
  assert.ok(f.profile.drivetrain.downshiftRatio<.18);
  f.set('gearCount',6);
  assert.equal(f.profile.drivetrain.gears.length,6);
  assert.equal(f.gearRows.gear7.hidden,true);
  assert.equal(f.gearRows.gear8.hidden,true);
  f.set('gear1',5);
  assert.equal(f.profile.drivetrain.gears[0],5);
  f.set('redlineRpm',8000);
  assert.equal(f.outputs.upshiftRatio.textContent,'2.400 U/min · 30 %');
});

test('Tuning-Tabs, Nitro und Drohnenwerte bleiben live bedienbar',()=>{
  const f=fixture({reactionTime:1.25,braking:12});
  assert.equal(f.outputs.reactionTime.textContent,'1,25 s');
  assert.equal(f.outputs.droneBraking.textContent,'12 m/s²');
  f.toggle.listeners.click();assert.equal(f.tuning.open,true);assert.equal(f.opens,1);
  assert.equal(f.tabs.motor.attributes['aria-selected'],'true');
  f.tabs.drone.listeners.click();assert.equal(f.panes.drone.hidden,false);assert.equal(f.panes.motor.hidden,true);
  f.set('launch',60);f.set('rampTime',2.4);f.set('reactionTime',1.2);f.set('droneSpeedReserve',180);
  assert.equal(f.profile.nitro.power,1.6);assert.equal(f.profile.nitro.rampTime,2.4);
  assert.equal(f.camera.reactionTime,1.2);assert.equal(f.camera.speedReserve,50);
  f.performanceTab.listeners.click();assert.equal(f.feelPane.hidden,true);assert.equal(f.performancePane.hidden,false);
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

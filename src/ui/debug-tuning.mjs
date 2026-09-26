import {
  VEHICLE_PRESETS,
  applyVehiclePhysicsProfile,
  applyVehiclePreset,
  automaticGearRatios,
  automaticShiftPoints,
  snapshotVehiclePhysicsProfile
} from '../vehicle-physics-profile.mjs';
import {applyCameraPreset} from '../driving-camera.mjs';

// Controls for comparing and persistently restoring physical vehicle configurations.
export function createDebugTuning({
  panel,toggle,resetButton,profile,camera,onOpen=()=>{},onChange=()=>{},
  initialPreset='monsterBeginner',defaultPreset=initialPreset,defaultProfile=null,defaultCamera=null
}){
  const defaults={
    profile:defaultProfile?snapshotVehiclePhysicsProfile(defaultProfile):snapshotVehiclePhysicsProfile(profile),
    camera:{...(defaultCamera||camera)}
  };
  const {nitro,suspension}=profile;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const fields=[...panel.querySelectorAll('[data-tuning]')];
  const selects=[...panel.querySelectorAll('[data-tuning-select]')];
  const mainTabs=[...panel.querySelectorAll('[data-tuning-main-tab]')];
  const mainPanes=[...panel.querySelectorAll('[data-tuning-main-panel]')];
  const tabs=[...panel.querySelectorAll('[data-tuning-tab]')];
  const panes=[...panel.querySelectorAll('[data-tuning-panel]')];
  let selectedPreset=initialPreset;
  const markCustom=()=>{selectedPreset='custom';};
  const notify=()=>onChange({
    preset:selectedPreset,
    profile:snapshotVehiclePhysicsProfile(profile),
    camera:{...camera}
  });
  const number=(value,digits=1)=>Number(value).toLocaleString('de-DE',{maximumFractionDigits:digits});
  const gearControl=index=>({
    read:()=>profile.drivetrain.gears[index]??profile.drivetrain.gears.at(-1),
    write:value=>{
      const gears=profile.drivetrain.gears;
      if(index>=gears.length)return;
      const upper=index===0?6:gears[index-1]-.05;
      const lower=index===gears.length-1?.3:gears[index+1]+.05;
      gears[index]=clamp(value,lower,upper);
    },
    display:value=>`${number(value,2)} : 1`
  });
  const controls={
    launch:{
      read:()=>(nitro.power-1)*100,
      write:value=>{nitro.power=1+value/100;nitro.forwardGrip=1+value/200;},
      display:value=>`+${Math.round(value)} %`
    },
    massKg:{read:()=>profile.massKg,write:value=>{profile.massKg=value;},display:value=>`${number(value/1000,3)} t`},
    powerPs:{read:()=>profile.powerPs,write:value=>{profile.powerPs=value;},display:value=>`${Math.round(value).toLocaleString('de-DE')} PS`},
    maxTorqueNm:{read:()=>profile.engine.maxTorqueNm,write:value=>{profile.engine.maxTorqueNm=value;},display:value=>`${Math.round(value).toLocaleString('de-DE')} Nm`},
    torquePeakStartRpm:{read:()=>profile.engine.torquePeakStartRpm,write:value=>{profile.engine.torquePeakStartRpm=value;},display:value=>`${Math.round(value).toLocaleString('de-DE')} U/min`},
    torquePeakEndRpm:{read:()=>profile.engine.torquePeakEndRpm,write:value=>{profile.engine.torquePeakEndRpm=value;},display:value=>`${Math.round(value).toLocaleString('de-DE')} U/min`},
    powerRpm:{read:()=>profile.engine.powerRpm,write:value=>{profile.engine.powerRpm=value;},display:value=>`${Math.round(value).toLocaleString('de-DE')} U/min`},
    idleRpm:{read:()=>profile.drivetrain.idleRpm,write:value=>{profile.drivetrain.idleRpm=value;},display:value=>`${Math.round(value).toLocaleString('de-DE')} U/min`},
    redlineRpm:{read:()=>profile.drivetrain.redlineRpm,write:value=>{profile.drivetrain.redlineRpm=value;},display:value=>`${Math.round(value).toLocaleString('de-DE')} U/min`},
    throttleResponse:{read:()=>profile.throttleResponse,write:value=>{profile.throttleResponse=value;},display:value=>`${number(value,2)} s`},
    couplingRpm:{read:()=>profile.drivetrain.couplingRpm,write:value=>{profile.drivetrain.couplingRpm=value;},display:value=>`${Math.round(value).toLocaleString('de-DE')} U/min`},
    torqueMultiplier:{read:()=>profile.drivetrain.torqueMultiplier,write:value=>{profile.drivetrain.torqueMultiplier=value;},display:value=>`${number(value,2)}×`},
    drivetrainEfficiency:{read:()=>profile.drivetrain.efficiency*100,write:value=>{profile.drivetrain.efficiency=value/100;},display:value=>`${Math.round(value)} %`},
    gearCount:{
      read:()=>profile.drivetrain.gears.length,
      write:value=>{
        const gears=profile.drivetrain.gears;
        profile.drivetrain.gears=automaticGearRatios(value,gears[0],gears.at(-1));
      },
      display:value=>`${Math.round(value)} Gänge`
    },
    gear1:gearControl(0),gear2:gearControl(1),gear3:gearControl(2),gear4:gearControl(3),
    gear5:gearControl(4),gear6:gearControl(5),gear7:gearControl(6),gear8:gearControl(7),
    upshiftRatio:{read:()=>profile.drivetrain.upshiftRatio*100,write:value=>{profile.drivetrain.upshiftRatio=value/100;},display:value=>`${Math.round(profile.drivetrain.redlineRpm*value/100).toLocaleString('de-DE')} U/min · ${Math.round(value)} %`},
    downshiftRatio:{read:()=>profile.drivetrain.downshiftRatio*100,write:value=>{profile.drivetrain.downshiftRatio=value/100;},display:value=>`${Math.round(profile.drivetrain.redlineRpm*value/100).toLocaleString('de-DE')} U/min · ${Math.round(value)} %`},
    finalRatio:{read:()=>profile.drivetrain.finalRatio,write:value=>{profile.drivetrain.finalRatio=value;},display:value=>`${number(value,1)} : 1`},
    shiftDuration:{read:()=>profile.drivetrain.shiftDuration,write:value=>{profile.drivetrain.shiftDuration=value;},display:value=>`${number(value,2)} s`},
    gearHoldTime:{read:()=>profile.drivetrain.gearHoldTime,write:value=>{profile.drivetrain.gearHoldTime=value;},display:value=>`${number(value,2)} s`},
    rollingResistance:{read:()=>profile.resistance.rollingCoefficient,write:value=>{profile.resistance.rollingCoefficient=value;},display:value=>`Crr ${Number(value).toLocaleString('de-DE',{minimumFractionDigits:3,maximumFractionDigits:3})}`},
    dragArea:{read:()=>profile.resistance.dragAreaM2,write:value=>{profile.resistance.dragAreaM2=value;},display:value=>`CdA ${number(value,2)} m²`},
    downforceArea:{read:()=>profile.resistance.downforceAreaM2,write:value=>{profile.resistance.downforceAreaM2=value;},display:value=>`ClA ${number(value,2)} m²`},
    wheelDiameter:{read:()=>profile.wheelRadiusM*2,write:value=>{profile.wheelRadiusM=value/2;},display:value=>`${number(value,2)} m`},
    grip:{read:()=>profile.grip,write:value=>{profile.grip=value;},display:value=>`μ ${number(value,2)}`},
    brakingG:{read:()=>profile.brakingG,write:value=>{profile.brakingG=value;},display:value=>`${number(value,2)} g`},
    brakingResponse:{read:()=>profile.brakingResponse,write:value=>{profile.brakingResponse=value;},display:value=>`${number(value,2)} s`},
    brakingGrip:{read:()=>profile.brakingGrip,write:value=>{profile.brakingGrip=value;},display:value=>`μ ${number(value,2)}`},
    steering:{read:()=>profile.steering*100,write:value=>{profile.steering=value/100;},display:value=>`${Math.round(value)} %`},
    suspensionSpringRate:{read:()=>suspension.springRateKnPerM,write:value=>{suspension.springRateKnPerM=value;},display:value=>`${number(value,1)} kN/m`},
    suspensionDampingRate:{read:()=>suspension.dampingKnSPerM,write:value=>{suspension.dampingKnSPerM=value;},display:value=>`${number(value,2)} kN·s/m`},
    rpmReserve:{read:()=>nitro.rpmReserve*100,write:value=>{nitro.rpmReserve=value/100;},display:value=>`+${Math.round(value)} %`},
    rampTime:{read:()=>nitro.rampTime,write:value=>{nitro.rampTime=value;},display:value=>`${number(value,1)} s`},
    duration:{read:()=>nitro.duration,write:value=>{nitro.duration=value;},display:value=>`${number(value)} s`},
    recharge:{
      read:()=>defaults.profile.nitro.recharge/nitro.recharge,
      write:value=>{nitro.recharge=defaults.profile.nitro.recharge/value;nitro.delay=defaults.profile.nitro.delay/value;},
      display:value=>`${number(value)}×`
    },
    targetDistance:{read:()=>camera.targetDistance,write:value=>{camera.targetDistance=value;},display:value=>`${number(value)} m`},
    reactionTime:{read:()=>camera.reactionTime,write:value=>{camera.reactionTime=value;},display:value=>`${number(value,2)} s`},
    droneAcceleration:{read:()=>camera.acceleration,write:value=>{camera.acceleration=value;},display:value=>`${number(value)} m/s²`},
    droneBraking:{read:()=>camera.braking,write:value=>{camera.braking=value;},display:value=>`${number(value)} m/s²`},
    droneSpeedReserve:{read:()=>camera.speedReserve*3.6,write:value=>{camera.speedReserve=value/3.6;},display:value=>`+${Math.round(value)} km/h`},
    droneSpeedResponse:{read:()=>camera.speedResponse,write:value=>{camera.speedResponse=value;},display:value=>`${number(value,2)} s`}
  };

  const normalizeProfile=()=>{
    const {engine,drivetrain}=profile;
    drivetrain.idleRpm=clamp(drivetrain.idleRpm,500,drivetrain.redlineRpm-250);
    engine.torquePeakStartRpm=clamp(engine.torquePeakStartRpm,drivetrain.idleRpm,drivetrain.redlineRpm);
    engine.torquePeakEndRpm=clamp(engine.torquePeakEndRpm,engine.torquePeakStartRpm,drivetrain.redlineRpm);
    engine.powerRpm=clamp(engine.powerRpm,engine.torquePeakEndRpm,drivetrain.redlineRpm);
    drivetrain.couplingRpm=clamp(drivetrain.couplingRpm,drivetrain.idleRpm,drivetrain.redlineRpm);
  };
  const sync=()=>{
    normalizeProfile();
    const points=automaticShiftPoints(profile.drivetrain);
    profile.drivetrain.upshiftRatio=points.upshiftRatio;
    profile.drivetrain.downshiftRatio=points.downshiftRatio;
    for(const field of fields){
      const key=field.dataset.tuning;
      const control=controls[key];
      if(!control)continue;
      if(key==='downshiftRatio')field.max=String(Math.round(points.downshiftMax*100));
      if(key==='idleRpm')field.max=String(profile.drivetrain.redlineRpm-250);
      if(key==='torquePeakStartRpm'){field.min=String(profile.drivetrain.idleRpm);field.max=String(profile.engine.torquePeakEndRpm);}
      if(key==='torquePeakEndRpm'){field.min=String(profile.engine.torquePeakStartRpm);field.max=String(profile.engine.powerRpm);}
      if(key==='powerRpm'){field.min=String(profile.engine.torquePeakEndRpm);field.max=String(profile.drivetrain.redlineRpm);}
      if(key==='couplingRpm'){field.min=String(profile.drivetrain.idleRpm);field.max=String(profile.drivetrain.redlineRpm);}
      if(key.startsWith('gear')){
        const index=Number(key.slice(4))-1;
        if(Number.isInteger(index)){
          const gears=profile.drivetrain.gears;
          field.closest?.('[data-gear-row]')?.toggleAttribute('hidden',index>=gears.length);
          if(index<gears.length){field.min=String(index===gears.length-1?.3:gears[index+1]+.05);field.max=String(index===0?6:gears[index-1]-.05);}
        }
      }
      const value=control.read(),display=control.display(value);
      field.value=String(value);
      // A range input can snap preset values to its editing step (95 PS to
      // 100 PS, for example). Report the real profile, not that rounded thumb.
      field.setAttribute?.('aria-valuetext',display);
      const output=panel.querySelector(`[data-tuning-value="${key}"]`);
      if(output)output.textContent=display;
    }
    for(const select of selects){
      const key=select.dataset.tuningSelect;
      if(key==='preset')select.value=selectedPreset;
      else if(key==='couplingType')select.value=profile.drivetrain.couplingType;
      else if(key==='driveLayout')select.value=profile.drivetrain.driveLayout;
    }
  };
  const setOpen=open=>{
    panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
    if(open)onOpen();
  };
  const selectTab=name=>{
    for(const tab of tabs)tab.setAttribute('aria-selected',String(tab.dataset.tuningTab===name));
    for(const pane of panes)pane.hidden=pane.dataset.tuningPanel!==name;
  };
  const selectMainTab=name=>{
    for(const tab of mainTabs)tab.setAttribute('aria-selected',String(tab.dataset.tuningMainTab===name));
    for(const pane of mainPanes)pane.hidden=pane.dataset.tuningMainPanel!==name;
  };
  for(const tab of mainTabs)tab.addEventListener('click',()=>selectMainTab(tab.dataset.tuningMainTab));
  for(const tab of tabs)tab.addEventListener('click',()=>selectTab(tab.dataset.tuningTab));
  const dragHandle=panel.matches?.('[data-tuning-drag-handle]')?panel:panel.querySelector('[data-tuning-drag-handle]');
  const view=panel.ownerDocument?.defaultView;
  if(dragHandle&&view){
    let drag=null;
    const finish=event=>{
      if(!drag||event.pointerId!==drag.pointerId)return;
      dragHandle.releasePointerCapture?.(event.pointerId);drag=null;
    };
    dragHandle.addEventListener('pointerdown',event=>{
      if(event.button!==0||event.target.closest?.('button,input,label,a,select,textarea'))return;
      const rect=panel.getBoundingClientRect();
      drag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top};
      dragHandle.setPointerCapture?.(event.pointerId);
    });
    dragHandle.addEventListener('pointermove',event=>{
      if(!drag||event.pointerId!==drag.pointerId)return;
      const margin=8,rect=panel.getBoundingClientRect();
      panel.style.left=`${clamp(drag.left+event.clientX-drag.x,margin,Math.max(margin,view.innerWidth-rect.width-margin))}px`;
      panel.style.top=`${clamp(drag.top+event.clientY-drag.y,margin,Math.max(margin,view.innerHeight-rect.height-margin))}px`;
    });
    dragHandle.addEventListener('pointerup',finish);
    dragHandle.addEventListener('pointercancel',finish);
  }
  for(const field of fields)field.addEventListener('input',()=>{
    const control=controls[field.dataset.tuning];
    if(!control)return;
    const value=clamp(Number(field.value),Number(field.min),Number(field.max));
    control.write(value);markCustom();sync();notify();
  });
  for(const select of selects)select.addEventListener('change',()=>{
    const key=select.dataset.tuningSelect;
    if(key==='preset'){
      if(select.value!=='custom'&&VEHICLE_PRESETS[select.value]){
        applyVehiclePreset(profile,select.value);applyCameraPreset(camera,select.value);selectedPreset=select.value;
      }
      else if(select.value==='custom')selectedPreset='custom';
    }else if(key==='couplingType'){profile.drivetrain.couplingType=select.value;markCustom();}
    else if(key==='driveLayout'){profile.drivetrain.driveLayout=select.value;markCustom();}
    sync();notify();
  });
  toggle.addEventListener('click',()=>setOpen(panel.hidden));
  resetButton.addEventListener('click',()=>{applyVehiclePhysicsProfile(profile,defaults.profile);Object.assign(camera,defaults.camera);selectedPreset=defaultPreset;sync();notify();});
  sync();selectMainTab('feel');selectTab('motor');setOpen(false);
  return {setOpen,selectMainTab,selectTab,get open(){return !panel.hidden;}};
}

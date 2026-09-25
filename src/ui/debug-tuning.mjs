import {applyVehiclePhysicsProfile,snapshotVehiclePhysicsProfile} from '../vehicle-physics-profile.mjs';
// Session-only controls for quickly comparing driving feel in the running game.
export function createDebugTuning({panel,toggle,resetButton,profile,camera,onOpen=()=>{}}){
  const defaults={profile:snapshotVehiclePhysicsProfile(profile),camera:{...camera}};
  const {nitro,speed:speeds,suspension}=profile;
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const fields=[...panel.querySelectorAll('[data-tuning]')];
  const tabs=[...panel.querySelectorAll('[data-tuning-tab]')];
  const panes=[...panel.querySelectorAll('[data-tuning-panel]')];
  const controls={
    launch:{
      read:()=>nitro.power/4*100,
      write:value=>{const factor=value/100;nitro.power=Math.max(1,4*factor);nitro.forwardGrip=Math.max(1,2.4*factor);},
      display:value=>`${Math.round(value)} %`
    },
    baseSpeed:{
      read:()=>speeds.race,
      write:value=>{speeds.race=value;speeds.arena=defaults.profile.speed.arena*value/defaults.profile.speed.race;},
      display:value=>`${Math.round(value*3.6)} km/h`
    },
    powerPs:{read:()=>profile.powerPs,write:value=>{profile.powerPs=value;},display:value=>`${Math.round(value).toLocaleString('de-DE')} PS`},
    massKg:{read:()=>profile.massKg,write:value=>{profile.massKg=value;},display:value=>`${(value/1000).toLocaleString('de-DE',{maximumFractionDigits:1})} t`},
    grip:{read:()=>profile.grip,write:value=>{profile.grip=value;},display:value=>`μ ${Number(value).toLocaleString('de-DE',{maximumFractionDigits:2})}`},
    brakingG:{read:()=>profile.brakingG,write:value=>{profile.brakingG=value;},display:value=>`${Number(value).toLocaleString('de-DE',{maximumFractionDigits:2})} g`},
    steering:{read:()=>profile.steering*100,write:value=>{profile.steering=value/100;},display:value=>`${Math.round(value)} %`},
    suspensionStiffness:{read:()=>suspension.stiffness*100,write:value=>{suspension.stiffness=value/100;},display:value=>`${Math.round(value)} %`},
    suspensionDamping:{read:()=>suspension.damping*100,write:value=>{suspension.damping=value/100;},display:value=>`${Math.round(value)} %`},
    speed:{read:()=>nitro.speedGain,write:value=>{nitro.speedGain=value;},display:value=>`+${Math.round(value*3.6)} km/h`},
    duration:{read:()=>nitro.duration,write:value=>{nitro.duration=value;},display:value=>`${Number(value).toLocaleString('de-DE')} s`},
    recharge:{
      read:()=>defaults.profile.nitro.recharge/nitro.recharge,
      write:value=>{nitro.recharge=defaults.profile.nitro.recharge/value;nitro.delay=defaults.profile.nitro.delay/value;},
      display:value=>`${Number(value).toLocaleString('de-DE')}×`
    },
    targetDistance:{read:()=>camera.targetDistance,write:value=>{camera.targetDistance=value;},display:value=>`${Number(value).toLocaleString('de-DE')} m`},
    reactionTime:{read:()=>camera.reactionTime,write:value=>{camera.reactionTime=value;},display:value=>`${Number(value).toLocaleString('de-DE')} s`},
    droneAcceleration:{read:()=>camera.acceleration,write:value=>{camera.acceleration=value;},display:value=>`${Number(value).toLocaleString('de-DE')} m/s²`},
    droneBraking:{read:()=>camera.braking,write:value=>{camera.braking=value;},display:value=>`${Number(value).toLocaleString('de-DE')} m/s²`}
  };
  const sync=()=>{
    for(const field of fields){
      const control=controls[field.dataset.tuning];
      if(!control)continue;
      field.value=String(control.read());
      panel.querySelector(`[data-tuning-value="${field.dataset.tuning}"]`).textContent=control.display(Number(field.value));
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
  for(const tab of tabs)tab.addEventListener('click',()=>selectTab(tab.dataset.tuningTab));
  const dragHandle=panel.querySelector('[data-tuning-drag-handle]');
  const view=panel.ownerDocument?.defaultView;
  if(dragHandle&&view){
    let drag=null;
    const finish=event=>{
      if(!drag||event.pointerId!==drag.pointerId)return;
      dragHandle.releasePointerCapture?.(event.pointerId);drag=null;
    };
    dragHandle.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
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
    control.write(value);
    panel.querySelector(`[data-tuning-value="${field.dataset.tuning}"]`).textContent=control.display(value);
  });
  toggle.addEventListener('click',()=>setOpen(panel.hidden));
  resetButton.addEventListener('click',()=>{applyVehiclePhysicsProfile(profile,defaults.profile);Object.assign(camera,defaults.camera);sync();});
  sync();selectTab('vehicle');setOpen(false);
  return {setOpen,selectTab,get open(){return !panel.hidden;}};
}

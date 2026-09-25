// Session-only controls for quickly comparing driving feel in the running game.
export function createDebugTuning({panel,toggle,resetButton,nitro,camera,speeds,drive,onOpen=()=>{}}){
  const defaults={nitro:{...nitro},camera:{...camera},speeds:{...speeds},drive:{...drive}};
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const fields=[...panel.querySelectorAll('[data-tuning]')];
  const controls={
    launch:{
      read:()=>nitro.power/4*100,
      write:value=>{const factor=value/100;nitro.power=Math.max(1,4*factor);nitro.forwardGrip=Math.max(1,2.4*factor);},
      display:value=>`${Math.round(value)} %`
    },
    baseSpeed:{
      read:()=>speeds.race,
      write:value=>{speeds.race=value;speeds.arena=defaults.speeds.arena*value/defaults.speeds.race;},
      display:value=>`${Math.round(value*3.6)} km/h`
    },
    acceleration:{read:()=>drive.acceleration*100,write:value=>{drive.acceleration=value/100;},display:value=>`${Math.round(value)} %`},
    speed:{read:()=>nitro.speedGain,write:value=>{nitro.speedGain=value;},display:value=>`+${Math.round(value*3.6)} km/h`},
    duration:{read:()=>nitro.duration,write:value=>{nitro.duration=value;},display:value=>`${Number(value).toLocaleString('de-DE')} s`},
    recharge:{
      read:()=>defaults.nitro.recharge/nitro.recharge,
      write:value=>{nitro.recharge=defaults.nitro.recharge/value;nitro.delay=defaults.nitro.delay/value;},
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
  for(const field of fields)field.addEventListener('input',()=>{
    const control=controls[field.dataset.tuning];
    if(!control)return;
    const value=clamp(Number(field.value),Number(field.min),Number(field.max));
    control.write(value);
    panel.querySelector(`[data-tuning-value="${field.dataset.tuning}"]`).textContent=control.display(value);
  });
  toggle.addEventListener('click',()=>setOpen(panel.hidden));
  resetButton.addEventListener('click',()=>{Object.assign(nitro,defaults.nitro);Object.assign(camera,defaults.camera);Object.assign(speeds,defaults.speeds);Object.assign(drive,defaults.drive);sync();});
  sync();setOpen(false);
  return {setOpen,get open(){return !panel.hidden;}};
}

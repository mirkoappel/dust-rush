// Session-only controls for quickly comparing driving feel in the running game.
export function createDebugTuning({panel,toggle,resetButton,nitro,camera,onOpen=()=>{}}){
  const defaults={nitro:{...nitro},camera:{...camera}};
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  const fields=[...panel.querySelectorAll('[data-tuning]')];
  const controls={
    launch:{
      read:()=>nitro.power/4*100,
      write:value=>{const factor=value/100;nitro.power=Math.max(1,4*factor);nitro.forwardGrip=Math.max(1,2.4*factor);},
      display:value=>`${Math.round(value)} %`
    },
    speed:{read:()=>nitro.speedGain,write:value=>{nitro.speedGain=value;},display:value=>`+${Math.round(value*3.6)} km/h`},
    duration:{read:()=>nitro.duration,write:value=>{nitro.duration=value;},display:value=>`${Number(value).toLocaleString('de-DE')} s`},
    lag:{
      read:()=>camera.boostFollowFrequency>=.2
        ?clamp((1.5-camera.boostFollowFrequency)/1.3*100,0,100)
        :clamp(100+(.2/camera.boostFollowFrequency-1)*50,100,150),
      write:value=>{camera.boostFollowFrequency=value<=100?1.5-value/100*1.3:.2/(1+(value-100)/50);},
      display:value=>`${Math.round(value)} %`
    },
    gap:{read:()=>camera.maxBoostGap,write:value=>{camera.maxBoostGap=value;},display:value=>`${Number(value).toLocaleString('de-DE')} m`}
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
  resetButton.addEventListener('click',()=>{Object.assign(nitro,defaults.nitro);Object.assign(camera,defaults.camera);sync();});
  sync();setOpen(false);
  return {setOpen,get open(){return !panel.hidden;}};
}

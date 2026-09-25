const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const deadzone=.12;
const axis=value=>Math.sign(value)*Math.max(0,(Math.abs(value)-deadzone)/(1-deadzone));
export function joystickInput(dx,dy,radius){
  if(![dx,dy,radius].every(Number.isFinite)||radius<=0)return {steer:0,forward:0,brake:0,x:0,y:0};
  // Independent axes: full throttle is still available while cornering.
  const x=clamp(dx/radius,-1,1),y=clamp(dy/radius,-1,1);
  const visualScale=Math.max(1,Math.hypot(x,y));
  return {steer:axis(x),forward:Math.max(0,-axis(y)),brake:Math.max(0,axis(y)),x:x/visualScale*radius,y:y/visualScale*radius};
}

export function createDrivingControls({stick,buttons,isEnabled,indicators=buttons.filter(b=>b.dataset.control==='nitro')}){
  let pointer=null,origin=null,state={active:false,steer:0,forward:0,brake:0};
  const held=new Map();
  const paint=(x=0,y=0)=>{
    stick.style.setProperty('--stick-x',x+'px');stick.style.setProperty('--stick-y',y+'px');
    stick.style.setProperty('--gas',String(state.forward));stick.style.setProperty('--brake',String(state.brake));
    stick.classList.toggle('held',state.active);
  };
  function resetStick(){
    const previous=pointer;pointer=null;origin=null;state={active:false,steer:0,forward:0,brake:0};paint();
    if(previous!==null&&stick.hasPointerCapture?.(previous))stick.releasePointerCapture(previous);
  }
  function move(e){
    if(e.pointerId!==pointer||!origin)return;
    if(!isEnabled()){resetStick();return;}
    e.preventDefault();
    const input=joystickInput(e.clientX-origin.x,e.clientY-origin.y,origin.radius);
    state={active:true,steer:input.steer,forward:input.forward,brake:input.brake};paint(input.x,input.y);
  }
  stick.addEventListener('pointerdown',e=>{
    if(pointer!==null||!isEnabled()||(e.pointerType==='mouse'&&e.button!==0))return;
    e.preventDefault();const box=stick.getBoundingClientRect();
    // Every touch starts neutral; merely touching the base must not apply gas.
    // The fixed base remains a predictable place to find the control.
    origin={x:e.clientX,y:e.clientY,radius:Math.min(box.width,box.height)*.31};
    pointer=e.pointerId;stick.setPointerCapture(pointer);state.active=true;paint();
  });
  stick.addEventListener('pointermove',move);
  for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,e=>{if(e.pointerId===pointer)resetStick();});
  for(const button of buttons){
    const pointers=new Set();held.set(button,pointers);
    const release=e=>{pointers.delete(e.pointerId);button.classList.toggle('pressed',pointers.size>0);};
    button.addEventListener('pointerdown',e=>{
      if(!isEnabled()||(e.pointerType==='mouse'&&e.button!==0))return;
      e.preventDefault();button.setPointerCapture(e.pointerId);pointers.add(e.pointerId);button.classList.add('pressed');
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
  }
  return {
    read:()=>({...state}),
    actions:()=>Object.fromEntries([...held].map(([button,pointers])=>[button.dataset.control,pointers.size>0])),
    reset(){resetStick();for(const [button,pointers] of held){const previous=[...pointers];pointers.clear();button.classList.remove('pressed');for(const id of previous)if(button.hasPointerCapture?.(id))button.releasePointerCapture(id);}},
    update(car){
      for(const nitro of indicators){nitro.style.setProperty('--charge',String(car.nitro??1));nitro.classList.toggle('boosting',!!car.boosting);nitro.classList.toggle('empty',!!car.nitroLocked);nitro.setAttribute('aria-label','Nitro: '+Math.round((car.nitro??1)*100)+' Prozent');}
    }
  };
}

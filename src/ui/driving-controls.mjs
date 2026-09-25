const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const deadzone=.12;
const axis=value=>Math.sign(value)*Math.max(0,(Math.abs(value)-deadzone)/(1-deadzone));
export function joystickInput(dx,dy,radius){
  if(![dx,dy,radius].every(Number.isFinite)||radius<=0)return {steer:0,forward:0,brake:0,x:0,y:0};
  // Vertical thumb movement never shortens the steering travel or applies gas.
  const x=clamp(dx/radius,-1,1);
  return {steer:axis(x),forward:0,brake:0,x:x*radius,y:0};
}

export function createDrivingControls({stick,buttons,isEnabled,indicators=buttons.filter(b=>b.dataset.control==='nitro')}){
  let pointer=null,origin=null,state={active:false,steer:0,forward:0,brake:0};
  const held=new Map(),actionPointers=new Map();
  const paint=(x=0,y=0)=>{
    stick.style.setProperty('--stick-x',x+'px');stick.style.setProperty('--stick-y',y+'px');
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
    // Every touch starts neutral; steering remains relative to the first touch.
    // The fixed base remains a predictable place to find the control.
    origin={x:e.clientX,y:e.clientY,radius:Math.max(1,(box.width-box.height*.74)/2-4)};
    pointer=e.pointerId;stick.setPointerCapture(pointer);state.active=true;paint();
  });
  stick.addEventListener('pointermove',move);
  for(const event of ['pointerup','pointercancel','lostpointercapture'])stick.addEventListener(event,e=>{if(e.pointerId===pointer)resetStick();});
  function selectAction(button,id){
    for(const [target,pointers] of held){
      if(target===button)pointers.add(id);else pointers.delete(id);
      target.classList.toggle('pressed',pointers.size>0);
    }
  }
  for(const button of buttons)held.set(button,new Set());
  for(const button of buttons){
    const release=e=>{
      if(actionPointers.get(e.pointerId)!==button)return;
      actionPointers.delete(e.pointerId);selectAction(null,e.pointerId);
      if(button.hasPointerCapture?.(e.pointerId))button.releasePointerCapture(e.pointerId);
    };
    button.addEventListener('pointerdown',e=>{
      if(!isEnabled()||(e.pointerType==='mouse'&&e.button!==0))return;
      e.preventDefault();button.setPointerCapture(e.pointerId);
      actionPointers.set(e.pointerId,button);selectAction(button,e.pointerId);
    });
    button.addEventListener('pointermove',e=>{
      if(actionPointers.get(e.pointerId)!==button)return;
      if(!isEnabled()){release(e);return;}
      e.preventDefault();
      const target=buttons.find(candidate=>{
        const r=candidate.getBoundingClientRect();
        return Math.hypot((e.clientX-r.left-r.width/2)/(r.width/2),(e.clientY-r.top-r.height/2)/(r.height/2))<=1;
      });
      // Keep the current action through the small gap; a thumb can slide from
      // gas to nitro/brake without requiring a third finger or lifting first.
      if(target)selectAction(target,e.pointerId);
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,release);
  }
  return {
    read:()=>({...state}),
    actions:()=>Object.fromEntries([...held].map(([button,pointers])=>[button.dataset.control,pointers.size>0])),
    reset(){
      resetStick();const captured=[...actionPointers];actionPointers.clear();
      for(const [button,pointers] of held){pointers.clear();button.classList.remove('pressed');}
      for(const [id,button] of captured)if(button.hasPointerCapture?.(id))button.releasePointerCapture(id);
    },
    update(car){
      for(const nitro of indicators){nitro.style.setProperty('--charge',String(car.nitro??1));nitro.classList.toggle('boosting',!!car.boosting);nitro.classList.toggle('empty',!!car.nitroLocked);nitro.setAttribute('aria-label','Nitro: '+Math.round((car.nitro??1)*100)+' Prozent');}
    }
  };
}

// Hidden developer shortcut: five short taps on a free area, never on controls.
// Pointer events cover touch and mouse without counting synthetic clicks twice.
export function setupDebugHud({surface,hud,onHide=()=>{},now=()=>performance.now()}){
  const ignored='button,input,select,textarea,a,summary,[role="button"],.driving-controls,.frame-rate,.tuning-panel';
  let pending=null,taps=0,last=-Infinity,anchor=null;
  hud.hidden=true;
  const reset=()=>{pending=null;taps=0;last=-Infinity;anchor=null;};
  const down=e=>{
    if(e.isPrimary===false||e.button!==0||e.target.closest?.(ignored)){reset();return;}
    pending={id:e.pointerId,x:e.clientX,y:e.clientY,time:now()};
  };
  const up=e=>{
    if(!pending||pending.id!==e.pointerId)return;
    const start=pending,time=now();pending=null;
    if(time-start.time>300||Math.hypot(e.clientX-start.x,e.clientY-start.y)>18){reset();return;}
    if(time-last>400||!anchor||Math.hypot(start.x-anchor.x,start.y-anchor.y)>40){
      taps=0;anchor={x:start.x,y:start.y};
    }
    last=time;
    if(++taps===5){
      hud.hidden=!hud.hidden;
      if(hud.hidden)onHide();
      reset();
    }
  };
  const cancel=()=>reset();
  surface.addEventListener('pointerdown',down,{capture:true});
  surface.addEventListener('pointerup',up,{capture:true});
  surface.addEventListener('pointercancel',cancel,{capture:true});
  return {dispose(){
    surface.removeEventListener('pointerdown',down,{capture:true});
    surface.removeEventListener('pointerup',up,{capture:true});
    surface.removeEventListener('pointercancel',cancel,{capture:true});
  }};
}

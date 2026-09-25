const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const PRESETS={
  truck:{yaw:.65,pitch:.25,distance:7.4},
  engine:{yaw:.65,pitch:.57,distance:3.8},
};
const pose=focus=>({...PRESETS[focus],focus,near:true});
const overviewPose=()=>({...pose('truck'),distance:8.2,near:false});
// These choices change the silhouette, so compare them from the same whole-truck view.
const WHOLE_TRUCK_PARTS=new Set(['body','wheels','lift','wing','lights','decals']);
export function orbitChange(view,dx,dy){
  return {...view,yaw:view.yaw-dx*.009,pitch:clamp(view.pitch+dy*.006,-.22,1.35)};
}
export function orbitZoom(view,factor){return {...view,distance:clamp(view.distance*factor,3.8,12)};}
export function createInspection({canvas,getWorld,isWorkshop,onChange}){
  let active=false,view=overviewPose(),truckView=overviewPose(),start=null,pinch=0;
  const pointers=new Map();
  const sync=()=>{
    const world=getWorld();
    if(world)world.inspection=active?view:null;
    onChange(active);
  };
  const clearGesture=()=>{pointers.clear();start=null;pinch=0;};
  const resetView=()=>{if(!active)return;view=overviewPose();truckView={...view};clearGesture();sync();};
  const set=value=>{
    active=value;
    if(value){view=overviewPose();truckView={...view};}
    clearGesture();sync();
  };
  const focus=part=>{
    const target=WHOLE_TRUCK_PARTS.has(part)?'truck':Object.hasOwn(PRESETS,part)?part:'truck';
    if(!active||target===view.focus)return;
    // Remember manual orbit/zoom before a detail view; detail gestures must not overwrite it.
    if(view.focus==='truck')truckView={...view};
    view=target==='truck'?{...truckView}:pose(target);clearGesture();sync();
  };
  const toggleZoom=()=>{
    const near=!view.near,base=PRESETS[view.focus].distance;
    const far=view.focus==='truck'?overviewPose().distance:Math.min(12,base*1.45);
    view={...view,near,distance:near?base:far};
    sync();
  };
  canvas.addEventListener('pointerdown',e=>{
    if(!isWorkshop())return;
    canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    start={x:e.clientX,y:e.clientY,moved:false};
    if(pointers.size===2){const [a,b]=[...pointers.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);}
  });
  canvas.addEventListener('pointermove',e=>{
    const old=pointers.get(e.pointerId);if(!old)return;
    if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)start.moved=true;
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(!active)return;
    if(pointers.size===2){
      const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);
      if(pinch>0&&distance>0)view=orbitZoom(view,pinch/distance);
      pinch=distance;
    }else view=orbitChange(view,e.clientX-old.x,e.clientY-old.y);
    sync();
  });
  canvas.addEventListener('pointerup',e=>{
    const tap=start&&!start.moved&&pointers.size===1;
    pointers.delete(e.pointerId);pinch=0;
    if(tap&&getWorld()?.pickTruck(e.clientX,e.clientY)){if(active)toggleZoom();else set(true);}
    start=null;
  });
  canvas.addEventListener('pointercancel',clearGesture);
  canvas.addEventListener('wheel',e=>{
    if(!active||!isWorkshop())return;
    e.preventDefault();view=orbitZoom(view,Math.exp(e.deltaY*.001));sync();
  },{passive:false});
  document.getElementById('inspectTruck').addEventListener('click',()=>set(true));
  document.getElementById('closeInspect').addEventListener('click',resetView);
  for(const button of document.querySelectorAll('[data-orbit]'))button.addEventListener('click',()=>{
    const action=button.dataset.orbit;
    if(action==='left')view=orbitChange(view,45,0);
    if(action==='right')view=orbitChange(view,-45,0);
    if(action==='in')view=orbitZoom(view,.82);
    if(action==='out')view=orbitZoom(view,1.22);
    sync();
  });
  window.addEventListener('keydown',e=>{
    if(!active||!isWorkshop())return;
    if(e.key==='Escape'){e.preventDefault();resetView();return;}
    const move={ArrowLeft:[45,0],ArrowRight:[-45,0],ArrowUp:[0,35],ArrowDown:[0,-35]}[e.key];
    if(move){e.preventDefault();view=orbitChange(view,...move);sync();}
  });
  return {set,focus,resetView,get active(){return active;},get view(){return {...view};}};
}

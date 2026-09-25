import * as THREE from 'three';

// Final game metres in the body-kit root. No chassis-length scaling here:
// the Blender body and these exported metadata points already include it.
export const BODY_STYLES=Object.freeze(['pickup','buggy','van','hotrod']);
export const LIGHT_BAR_SPANS=Object.freeze({pickup:1.33,buggy:1.15,van:1.37,hotrod:1.00});
export const FRAME_RAIL_Y=-.44;
export const FRAME_HALF_WIDTH=.40;
export const TRANSFER_POINT=Object.freeze([0,-.49,0]);
const DEFAULT_MOUNTS={
  pickup:{engine:[0,-.12,1.10],scale:.78,roof:[0,.98,-.42],wing:[0,.39,-1.68],width:.727,exhaust:[.98,-.35,-.35]},
  buggy:{engine:[0,-.15,-1.32],scale:.78,roof:[0,.993,-.042],wing:[0,.25,-1.68],width:.56,exhaust:[.48,-.29,-1.36]},
  van:{engine:[0,-.19,.74],scale:.70,roof:[0,1.27,.60],wing:[0,1.27,-1.26],width:.52,exhaust:[.98,-.35,-.40]},
  hotrod:{engine:[0,-.095,.76],scale:.92,roof:[0,.87,-.88],wing:[0,.33,-1.67],width:.40,exhaust:[.72,-.25,.16]},
};
const KEYS={engine:'mount_engine',scale:'mount_engine_scale',roof:'mount_roof',wing:'mount_wing',width:'mount_wing_width',exhaust:'mount_exhaust'};
function validVector(value,name){
  if(!Array.isArray(value)||value.length!==3||value.some(v=>!Number.isFinite(v)))throw new Error('Invalid truck mount: '+name);
  return Object.freeze([...value]);
}
function roofFootHeight(source,point){
  if(!source)return point[1];
  source.updateWorldMatrix(true,true);
  const origin=new THREE.Vector3(point[0],point[1]+.12,point[2]).applyMatrix4(source.matrixWorld);
  const direction=new THREE.Vector3(0,-1,0).transformDirection(source.matrixWorld);
  const inverse=source.matrixWorld.clone().invert(),ray=new THREE.Raycaster(origin,direction);
  for(const hit of ray.intersectObject(source,true)){
    const local=hit.point.clone().applyMatrix4(inverse);
    if(local.y>=point[1]-.15&&local.y<=point[1]+.12)return local.y;
  }
  return point[1];
}
export function getBodyMounts(library,style){
  const body=BODY_STYLES.includes(style)?style:'pickup',fallback=DEFAULT_MOUNTS[body];
  const source=library?.getObjectByName('DR2_Body_'+body),data=source?.userData||{},mounts={body};
  for(const [key,name] of Object.entries(KEYS)){
    const value=data[name]??fallback[key];
    if(key==='scale'||key==='width'){
      if(!Number.isFinite(value)||value<=0)throw new Error('Invalid truck mount: '+name);
      mounts[key]=value;
    }else mounts[key]=validVector(value,name);
  }
  // Roof metadata marks the centre of a curved roof/cage. Derive contact at the
  // actual two feet once, so a crowned roll bar does not leave floating brackets.
  mounts.roofFootHeights=Object.freeze([-1,1].map(side=>roofFootHeight(source,[
    mounts.roof[0]+side*LIGHT_BAR_SPANS[body]*.38,mounts.roof[1],mounts.roof[2],
  ])));
  // width means HALF the spacing between the two spoiler pylons, never full span.
  return Object.freeze(mounts);
}

// Engine source geometry has a fixed crank/output convention. Turn a rear-mounted
// ICE or a front-mounted electric unit so its output points towards the transfer.
export function enginePlacement(mounts,kind='classic'){
  const electric=kind==='electric',direction=mounts.engine[2]>=0?-1:1;
  const yaw=(electric?1:-1)===direction?0:Math.PI,scale=mounts.scale;
  const transform=point=>{
    const [x,y,z]=point,cos=Math.cos(yaw),sin=Math.sin(yaw);
    return [mounts.engine[0]+scale*(cos*x+sin*z),mounts.engine[1]+scale*y,mounts.engine[2]+scale*(-sin*x+cos*z)];
  };
  const feet=[-1,1].flatMap(side=>[-1,1].map(end=>transform([side*.205,electric?.035:-.06,end*.22])));
  const output=transform(electric?[0,.22,.42]:[0,.02,-.34]);
  const exhaust=[-1,1].map(side=>{
    const collector=[transform([side*.40,-.115,.11]),transform([side*.40,-.115,-.43])];
    const worldSide=Math.sign(collector[0][0]-mounts.engine[0]);
    return {collector,junction:[worldSide*.43,FRAME_RAIL_Y-.04,mounts.engine[2]+direction*.31]};
  });
  return {position:[...mounts.engine],scale,yaw,direction,feet,output,exhaust};
}

// Rounded elbows use real swept geometry. Straight runs remain straight, unlike
// an unconstrained spline that can overshoot through the body or nearby tyres.
export function curvedPipeGeometry(points,radius=.04,bend=.10){
  const vertices=points.map(point=>new THREE.Vector3(...point)),path=new THREE.CurvePath();
  let cursor=vertices[0];
  for(let i=1;i<vertices.length-1;i++){
    const previous=vertices[i-1],at=vertices[i],next=vertices[i+1];
    const trim=Math.min(bend,at.distanceTo(previous)*.3,at.distanceTo(next)*.3);
    const before=at.clone().add(previous.clone().sub(at).normalize().multiplyScalar(trim));
    const after=at.clone().add(next.clone().sub(at).normalize().multiplyScalar(trim));
    if(cursor.distanceToSquared(before)>1e-10)path.add(new THREE.LineCurve3(cursor,before));
    path.add(new THREE.QuadraticBezierCurve3(before,at,after));cursor=after;
  }
  const last=vertices[vertices.length-1];
  if(cursor.distanceToSquared(last)>1e-10)path.add(new THREE.LineCurve3(cursor,last));
  return new THREE.TubeGeometry(path,Math.max(12,(points.length-1)*8),radius,8,false);
}

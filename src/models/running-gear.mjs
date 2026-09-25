import * as THREE from 'three';
import {box,rod,mesh,mergeStatic} from './geometry.mjs';
import {VEHICLE_DIMENSIONS as DIM} from '../vehicle-dimensions.mjs';
import {WHEEL_CORNERS} from '../suspension.mjs';
import {createSpringGeometry,updateSpringGeometry,springProfile} from './spring.mjs';

// Rest-pose dimensions are world metres, not the historical Blender scale.
// Body kits and their engine cradles meet these rails at Y=1.08 / X=±.40.
export const GEAR = Object.freeze({railX:.40,railY:1.08,transferY:1.03,shockTopY:1.56,shockTopX:.65,shockBottomX:.82});
const Y=new THREE.Vector3(0,1,0),V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

export function makeRunningGear({shadow=false}={}){
  const root=new THREE.Group();root.name='Articulated_running_gear';root.scale.setScalar(1/DIM.modelScale);
  const frame=new THREE.Group();frame.name='Rigid_tube_frame';frame.matrixAutoUpdate=false;root.add(frame);
  const graphite=new THREE.MeshStandardMaterial({color:'#293139',metalness:.65,roughness:.39});
  const steel=new THREE.MeshStandardMaterial({color:'#809098',metalness:.82,roughness:.30});
  const bright=new THREE.MeshStandardMaterial({color:'#c3cbd0',metalness:.87,roughness:.22});
  const accent=new THREE.MeshStandardMaterial({color:'#ef742a',metalness:.25,roughness:.36});
  const rubber=new THREE.MeshStandardMaterial({color:'#191e22',roughness:.82});
  const half=DIM.wheelbase/2;
  for(const side of [-1,1]){
    rod(frame,[side*.40,GEAR.railY,-1.56],[side*.40,GEAR.railY,1.56],.048,graphite,12);
    // Upper rails and diagonal bracing support the shell, not the axle ends.
    rod(frame,[side*.57,1.35,-.88],[side*.57,1.35,.78],.036,graphite);
    for(const front of [-1,1]){
      rod(frame,[side*.40,1.08,front*.84],[side*.57,1.35,front*.74],.033,graphite);
      const top=[side*GEAR.shockTopX,GEAR.shockTopY,front*half];
      for(const dz of [-.18,.18])rod(frame,[side*.40,1.08,front*half+dz],top,.035,graphite);
      box(frame,.21,.055,.19,steel,...top,.015);
      // Shell mounting pads meet the wheel-well shoulder from below.
      rod(frame,[side*.4,1.08,front*.69],[side*.71,1.13,front*.69],.033,graphite);
      box(frame,.18,.05,.15,rubber,side*.71,1.16,front*.69,.012);
    }
  }
  for(const z of [-1.45,-.58,.48,1.45])rod(frame,[-.4,1.08,z],[.4,1.08,z],.041,graphite);
  for(const side of [-1,1])rod(frame,[side*.4,1.08,-.58],[-side*.4,1.08,.48],.025,graphite);
  box(frame,.66,.07,.85,graphite,0,.96,-.02,.023);
  box(frame,.38,.22,.32,steel,0,GEAR.transferY,0,.055);
  mergeStatic(frame);

  const axles=[1,-1].map(front=>{
    const axle=new THREE.Group();axle.name=front===1?'Front_live_axle':'Rear_live_axle';root.add(axle);
    rod(axle,[-DIM.track/2,0,0],[DIM.track/2,0,0],.075,graphite,16);
    const diff=mesh(axle,new THREE.SphereGeometry(.19,20,12),graphite);diff.scale.set(1.05,.92,1.12);
    rod(axle,[0,0,front*.16],[0,0,front*.20],.147,steel,20);
    for(let i=0;i<10;i++){
      const a=i*Math.PI*2/10;
      rod(axle,[.12*Math.cos(a),.12*Math.sin(a),front*.202],[.12*Math.cos(a),.12*Math.sin(a),front*.217],.013,bright,6);
    }
    for(const side of [-1,1]){
      rod(axle,[side*1.01,0,0],[side*1.08,0,0],.105,steel,16);
      box(axle,.14,.12,.15,graphite,side*GEAR.shockBottomX,.058,0,.019);
    }
    mergeStatic(axle);return axle;
  });

  // Instancing keeps all links, damper sleeves, pins and seats to a handful
  // of draw calls per truck, including the animated rival vehicles.
  const pools=[];
  function pool(name,geometry,material,capacity){
    const object=new THREE.InstancedMesh(geometry,material,capacity);object.name=name;
    object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);object.frustumCulled=false;root.add(object);
    const entry={object,index:0};pools.push(entry);return entry;
  }
  const cylinder=new THREE.CylinderGeometry(1,1,1,12);
  const links=pool('Jointed_four_link_arms',cylinder,steel,10);
  const sleeves=pool('Damper_bodies',cylinder,graphite,4);
  const fittings=pool('Damper_eyelet_necks',cylinder,graphite,8);
  const pistons=pool('Telescoping_piston_rods',cylinder,bright,4);
  const seats=pool('Spring_seats',cylinder,steel,8);
  const bolts=pool('Suspension_pivot_pins',cylinder,bright,24);
  const eyes=pool('Suspension_eyelet_bushings',new THREE.TorusGeometry(.041,.014,8,16),rubber,24);
  const coils=WHEEL_CORNERS.map(c=>{
    const coil=mesh(root,createSpringGeometry(),accent);coil.name='Coil_'+c.code;return coil;
  });
  const dummy=new THREE.Object3D(),direction=V(),middle=V(),mass=new THREE.Matrix4();
  const from=V(),to=V();
  function instance(target,position,rotation,scale){
    dummy.position.copy(position);dummy.quaternion.copy(rotation);dummy.scale.copy(scale);dummy.updateMatrix();
    target.object.setMatrixAt(target.index++,dummy.matrix);
  }
  function bar(target,a,b,radius){
    direction.copy(b).sub(a);const length=direction.length();
    dummy.quaternion.setFromUnitVectors(Y,direction.normalize());
    middle.copy(a).add(b).multiplyScalar(.5);
    instance(target,middle,dummy.quaternion,V(radius,Math.max(.001,length),radius));
  }
  function eye(point){
    dummy.quaternion.setFromAxisAngle(Y,Math.PI/2);
    instance(eyes,point,dummy.quaternion,V(1,1,1));
    bar(bolts,point.clone().add(V(-.054,0,0)),point.clone().add(V(.054,0,0)),.018);
  }
  const framePoint=(x,y,z)=>V(x,y,z).applyMatrix4(mass);
  const axlePoint=(index,x,y=0)=>V(x,y,0).applyMatrix4(axles[index].matrix);
  const endpoints=[];
  // Keep the instance ranges of each complete shock for the configurator.
  // Snapshots use the same coils, seats, dampers and pivots as the live vehicle.
  const shockRanges=WHEEL_CORNERS.map(()=>pools.map(()=>[0,0]));
  function sync(sourceMassMatrix,offsets,bodyLift=0){
    const sizeFactor=springProfile(bodyLift).radius/.098;
    mass.copy(sourceMassMatrix);
    // Rotation is scale-independent; translation converts source-model units.
    mass.elements[12]*=DIM.modelScale;mass.elements[13]*=DIM.modelScale;mass.elements[14]*=DIM.modelScale;
    frame.matrix.copy(mass);frame.matrixWorldNeedsUpdate=true;
    for(const p of pools)p.index=0;
    endpoints.length=0;
    axles.forEach((axle,index)=>{
      const front=index===0?1:-1,l=offsets[index*2]*DIM.modelScale,r=offsets[index*2+1]*DIM.modelScale;
      axle.position.set(0,DIM.wheelRadius+(l+r)/2,front*half);
      axle.rotation.z=Math.atan2(l-r,DIM.track);axle.updateMatrix();
      for(const side of [-1,1])for(const upper of [false,true]){
        const a=framePoint(side*(upper?.21:.40),upper?1.24:1.08,front*(upper?.37:.28));
        const b=axlePoint(index,side*(upper?.39:.82),upper?.11:.012);
        bar(links,a,b,upper?.027:.031);eye(a);eye(b);
      }
      const a=framePoint(0,GEAR.transferY,front*.14),b=axlePoint(index,0,0);b.z-=front*.13;
      bar(links,a,b,.047);
    });
    WHEEL_CORNERS.forEach((corner,i)=>{
      pools.forEach((p,j)=>shockRanges[i][j][0]=p.index);
      const a=axlePoint(i<2?0:1,corner.side*GEAR.shockBottomX,.08);
      const b=framePoint(corner.side*GEAR.shockTopX,GEAR.shockTopY,corner.front*half);
      const axis=b.clone().sub(a),length=axis.length();axis.normalize();
      // The canister stays rigid; the polished rod slides inside it.
      const sleeveLength=Math.min(.43+bodyLift*.42,length*.65);
      from.copy(a).addScaledVector(axis,.035);to.copy(a).addScaledVector(axis,.115);bar(fittings,from,to,.029);
      from.copy(b).addScaledVector(axis,-.105);to.copy(b).addScaledVector(axis,-.035);bar(fittings,from,to,.027);
      from.copy(a).addScaledVector(axis,.10);to.copy(from).addScaledVector(axis,sleeveLength);bar(sleeves,from,to,.048*sizeFactor);
      from.copy(to).addScaledVector(axis,-.075);to.copy(b).addScaledVector(axis,-.08);bar(pistons,from,to,.021*sizeFactor);
      for(const distance of [.12,length-.10]){
        from.copy(a).addScaledVector(axis,distance-.018);to.copy(from).addScaledVector(axis,.036);bar(seats,from,to,.115*sizeFactor);
      }
      const coil=coils[i];coil.position.copy(a).addScaledVector(axis,.14);coil.quaternion.setFromUnitVectors(Y,axis);updateSpringGeometry(coil.geometry,Math.max(.06,length-.26),bodyLift);
      eye(a);eye(b);
      pools.forEach((p,j)=>shockRanges[i][j][1]=p.index);
      endpoints.push({bottom:a.toArray(),top:b.toArray(),length});
    });
    for(const p of pools){p.object.count=p.index;p.object.instanceMatrix.needsUpdate=true;}
  }
  root.traverse(o=>{if(o.isMesh){o.castShadow=shadow;o.receiveShadow=true;}});
  function snapshotShock(index=0){
    if(!endpoints[index])throw new Error('Sync running gear before taking a shock snapshot');
    const group=new THREE.Group();group.name='Shock_'+WHEEL_CORNERS[index].code;
    const coil=coils[index].clone();coil.geometry=coil.geometry.clone();group.add(coil);
    pools.forEach((p,j)=>{
      const [start,end]=shockRanges[index][j];
      for(let instance=start;instance<end;instance++){
        const part=new THREE.Mesh(p.object.geometry,p.object.material);part.name=p.object.name;
        p.object.getMatrixAt(instance,part.matrix);part.matrixAutoUpdate=false;group.add(part);
      }
    });
    return group;
  }
  return {root,frame,axles,endpoints,sync,snapshotShock,setPaint(color){accent.color.set(color);}};
}

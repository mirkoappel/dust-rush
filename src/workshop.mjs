import * as THREE from 'three';
import {box as roundedBox,mergeStatic} from './models/geometry.mjs';
import {cloneAsset} from './models/asset-library.mjs';
import {VEHICLE_DIMENSIONS as DIM} from './vehicle-dimensions.mjs';
const material=(color,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness:.65,metalness});
export function makeWorkshop(library){
  const group=new THREE.Group(),backWall=new THREE.Group(),leftWall=new THREE.Group();group.name='Monstertruck_workshop';
  backWall.name='Workshop_back_wall';leftWall.name='Workshop_left_wall';
  const charcoal=material('#243d45'),wall=material('#7e999a'),floor=material('#748481'),yellow=material('#f9bc51'),metal=material('#7e8e92',.7);
  const cube=(w,h,d,mat,x,y,z)=>{return roundedBox(group,w,h,d,mat,x,y,z,.05);};
  const back=(w,h,d,mat,x,y,z)=>roundedBox(backWall,w,h,d,mat,x,y,z,.05);
  cube(28,.12,25,floor,0,-.11,0);
  back(20,7,.25,wall,0,3.35,-6);
  roundedBox(leftWall,.25,7,13,wall,-10,3.35,.4,.05);
  back(20,.42,.1,charcoal,0,1,-5.83);
  // Open bay, steel roof structure and warm work lights.
  for(const x of [-8,0,8]){
    back(.22,6.2,.28,charcoal,x,3.05,-5.7);
    cube(.2,.24,14,charcoal,x,6.1,.2);
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(2.4,.12,.4),new THREE.MeshStandardMaterial({color:'#fff2cc',emissive:'#fff1c9',emissiveIntensity:1.2}));lamp.position.set(x,5.8,1);group.add(lamp);
  }
  // Painted service bay markings and low drive-on lift.
  cube(6.8,.10,7.6,charcoal,0,-.015,0);
  for(const x of [-3.6,3.6])cube(.10,.012,8.4,yellow,x,.011,0);
  for(const z of [-4.2,4.2])cube(7.3,.012,.10,yellow,0,.011,z);
  for(const x of [-1.2,1.2])cube(.7,.06,5.6,metal,x,-.005,0);
  // The hall remains lightweight procedural geometry; its equipment is authored in Blender.
  const glass=new THREE.MeshStandardMaterial({color:'#a8d9dc',emissive:'#74aebd',emissiveIntensity:.25,roughness:.18,metalness:.3});
  for(const x of [-6.1,-2.8,.5]){
    back(2.6,1.5,.08,charcoal,x,4.5,-5.79);
    for(const side of [-1,1])back(1.16,1.3,.06,glass,x+side*.62,4.5,-5.72);
  }
  for(let i=0;i<9;i++){const line=cube(.018,.005,22,metal,-12+i*3,-.043,0);line.castShadow=false;}
  mergeStatic(group);
  group.add(mergeStatic(backWall),mergeStatic(leftWall));
  // A small local ambient-contact pass grounds the parked truck. It does not
  // follow vehicles into the race or pretend a flying truck touches the floor.
  const pixels=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const radius=((x-31.5)/31.5)**2+((y-31.5)/31.5)**2;
    pixels[(y*64+x)*4+3]=Math.round(Math.max(0,Math.exp(-radius*4.5)-.012)*180);
  }
  const contactMap=new THREE.DataTexture(pixels,64,64);contactMap.magFilter=THREE.LinearFilter;contactMap.minFilter=THREE.LinearFilter;contactMap.needsUpdate=true;
  const contactMaterial=new THREE.MeshBasicMaterial({map:contactMap,transparent:true,depthWrite:false,opacity:.78,toneMapped:false});
  const contacts=[];
  for(const side of [-1,1])for(const front of [-1,1]){
    const contact=new THREE.Mesh(new THREE.PlaneGeometry(1,1),contactMaterial);
    contact.name='Tire_contact_shadow';contact.rotation.x=-Math.PI/2;contact.position.set(side*DIM.track/2,.042,front*DIM.wheelbase/2);
    contact.renderOrder=2;contacts.push(contact);group.add(contact);
  }
  group.userData.setWheelScale=scale=>{for(const contact of contacts)contact.scale.set(.98*scale,.75*scale,1);};
  group.userData.setWheelScale(1);
  const localCamera=new THREE.Vector3();
  group.userData.updateCameraVisibility=position=>{
    group.updateWorldMatrix(true,false);localCamera.copy(position);group.worldToLocal(localCamera);
    // Dollhouse cutaway: the camera may orbit outside, but no wall may cover the truck.
    backWall.visible=localCamera.z>-5.4;leftWall.visible=localCamera.x>-9.4;
  };
  // Add imported meshes after merging: their reusable source geometry must stay intact.
  for(const [name,position,angle,scale] of [
    ['DRP_Workbench',[4.8,0,-4.85],0,1.2],
    ['DRP_Cabinet',[-5.9,0,-3.7],.12,1.1],
    ['DRP_TireStack',[-4.1,0,-4.6],.2,1],
    ['DRP_FloorJack',[7.5,0,-4],-.3,1],
    ['DRP_Compressor',[-6,0,-.6],.2,1],
  ]){
    const asset=cloneAsset(library,name,{shadows:true});asset.position.set(...position);asset.rotation.y=angle;asset.scale.setScalar(scale);group.add(asset);
  }
  return group;
}

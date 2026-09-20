import * as THREE from 'three';
const material=(color,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness:.65,metalness});
export function makeWorkshop(){
  const group=new THREE.Group();group.name='Monstertruck_workshop';
  const charcoal=material('#243d45'),wall=material('#7e999a'),floor=material('#748481'),yellow=material('#f9bc51'),metal=material('#7e8e92',.7),red=material('#e66e43'),black=material('#253036');
  const cube=(w,h,d,mat,x,y,z)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;group.add(o);return o;};
  cube(28,.12,25,floor,0,-.11,0);
  cube(20,7,.25,wall,0,3.35,-6);
  cube(.25,7,13,wall,-10,3.35,.4);
  cube(20,.42,.1,charcoal,0,1,-5.83);
  // Open bay, steel roof structure and warm work lights.
  for(const x of [-8,0,8]){
    cube(.22,6.2,.28,charcoal,x,3.05,-5.7);
    cube(.2,.24,14,charcoal,x,6.1,.2);
    const lamp=new THREE.Mesh(new THREE.BoxGeometry(2.4,.12,.4),new THREE.MeshStandardMaterial({color:'#fff2cc',emissive:'#fff1c9',emissiveIntensity:1.2}));lamp.position.set(x,5.8,1);group.add(lamp);
  }
  // Painted service bay markings and low drive-on lift.
  cube(6.8,.10,7.6,charcoal,0,-.015,0);
  for(const x of [-3.6,3.6])cube(.10,.012,8.4,yellow,x,.011,0);
  for(const z of [-4.2,4.2])cube(7.3,.012,.10,yellow,0,.011,z);
  for(const x of [-1.2,1.2])cube(.7,.06,5.6,metal,x,-.005,0);
  // Workbench, drawers and a visible tool board.
  cube(4.1,.18,1.2,metal,4.8,1.5,-4.7);
  cube(3.7,1.35,1.0,charcoal,4.8,.7,-4.7);
  for(const x of [3.65,4.8,5.95])for(const y of [.4,.85,1.25]){
    cube(1.05,.28,.035,red,x,y,-4.18);cube(.38,.045,.05,metal,x,y,-4.14);
  }
  cube(4.2,1.75,.12,charcoal,4.8,3,-5.7);
  for(let i=0;i<7;i++){
    const x=3.15+i*.55;
    cube(.10,.7+(i%3)*.12,.08,metal,x,3,-5.58);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.14,.045,6,12),metal);ring.position.set(x,3.46+(i%3)*.06,-5.54);group.add(ring);
  }
  cube(1.1,1.3,.8,red,-5.8,.65,-3.7);cube(1.2,.12,.9,metal,-5.8,1.34,-3.7);
  for(let i=0;i<3;i++){
    const tyre=new THREE.Mesh(new THREE.TorusGeometry(.75,.25,8,20),black);tyre.rotation.x=Math.PI/2;tyre.position.set(-4.5,.3+i*.48,-4.5);tyre.castShadow=true;group.add(tyre);
  }
  // Mobile floor jack beside the truck.
  cube(.45,.18,1.4,red,4,.15,2.3);const handle=cube(.07,1.6,.07,metal,4,.85,1.6);handle.rotation.x=-.35;
  return group;
}

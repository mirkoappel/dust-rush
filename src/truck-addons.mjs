import * as THREE from 'three';
export function makeTruckAddons(){
  const root=new THREE.Group(),wing=new THREE.Group(),lights=new THREE.Group(),pipes=new THREE.Group();
  const accent=new THREE.MeshStandardMaterial({color:'#ff6c24',roughness:.4}),dark=new THREE.MeshStandardMaterial({color:'#233039',roughness:.6}),chrome=new THREE.MeshStandardMaterial({color:'#a4b6bb',metalness:.75,roughness:.25});
  root.add(wing,lights,pipes);
  const cube=(parent,w,h,d,mat,x,y,z)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;};
  cube(wing,3.5,.16,.72,accent,0,3.7,-2.38);
  for(const x of [-1.68,1.68])cube(wing,.12,.52,.88,accent,x,3.86,-2.38);
  for(const x of [-.9,.9])cube(wing,.13,.65,.13,dark,x,3.32,-2.38);
  cube(lights,2.65,.12,.22,dark,0,4.03,.05);
  const lamp=new THREE.MeshStandardMaterial({color:'#fff4cb',emissive:'#ffdf8f',emissiveIntensity:1.4,roughness:.3});
  for(const x of [-1.0,-.5,0,.5,1.0]){
    cube(lights,.39,.36,.25,dark,x,4.23,.08);
    cube(lights,.29,.25,.03,lamp,x,4.23,.22);
  }
  for(const x of [-1.52,1.52]){
    const pipe=new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,1.65,12),chrome);pipe.position.set(x,3.35,-1.15);pipe.castShadow=true;pipes.add(pipe);
    const opening=new THREE.Mesh(new THREE.CircleGeometry(.085,12),dark);opening.rotation.x=-Math.PI/2;opening.position.set(x,4.181,-1.15);pipes.add(opening);
  }
  return {root,wing,lights,pipes,accent};
}

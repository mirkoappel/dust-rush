import * as THREE from 'three';
import {mergeGeometries} from '../../vendor/BufferGeometryUtils.js';
const Y=new THREE.Vector3(0,1,0);
export function material(color,metalness=0,roughness=.55){
  return new THREE.MeshStandardMaterial({color,metalness,roughness});
}
export function roundedBox(w,h,d,r=.08){
  r=Math.min(r,w/2-.001,h/2-.001,d/2-.001);
  const x=-w/2+r,y=-h/2+r,s=new THREE.Shape();
  s.moveTo(x,y-r);s.lineTo(x+w-2*r,y-r);s.quadraticCurveTo(w/2,y-r,w/2,y);
  s.lineTo(w/2,h/2-r);s.quadraticCurveTo(w/2,h/2,w/2-r,h/2);
  s.lineTo(-w/2+r,h/2);s.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);
  s.lineTo(-w/2,-h/2+r);s.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
  const g=new THREE.ExtrudeGeometry(s,{depth:d-2*r,bevelEnabled:true,bevelSize:r*.45,bevelThickness:r,bevelSegments:2,curveSegments:3,steps:1});
  g.translate(0,0,-d/2+r);return g;
}
export function mesh(parent,geometry,mat,position=[0,0,0],rotation=[0,0,0]){
  const o=new THREE.Mesh(geometry,mat);o.position.set(...position);o.rotation.set(...rotation);
  o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
}
export function box(parent,w,h,d,mat,x=0,y=0,z=0,r=.05){return mesh(parent,roundedBox(w,h,d,r),mat,[x,y,z]);}
export function rod(parent,a,b,r,mat,segments=10){
  const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),length=to.distanceTo(from);
  const o=mesh(parent,new THREE.CylinderGeometry(r,r,length,segments),mat);
  o.position.copy(from.add(to).multiplyScalar(.5));o.quaternion.setFromUnitVectors(Y,new THREE.Vector3(...b).sub(new THREE.Vector3(...a)).normalize());return o;
}
export function mergeStatic(group){
  group.updateMatrixWorld(true);const inverse=group.matrixWorld.clone().invert(),batches=new Map();
  group.traverse(o=>{
    if(!o.isMesh)return;
    let g=o.geometry.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));
    if(g.index){const indexed=g;g=g.toNonIndexed();indexed.dispose();}
    g.deleteAttribute('uv');g.deleteAttribute('uv1');
    const entries=batches.get(o.material)||[];entries.push(g);batches.set(o.material,entries);
  });
  const children=[...group.children];for(const o of children)group.remove(o);
  for(const [mat,geos] of batches){const joined=mergeGeometries(geos);if(joined)mesh(group,joined,mat);for(const g of geos)g.dispose();}
  for(const o of children)o.traverse(n=>n.geometry?.dispose());
  return group;
}
export function surface(parent,points,mat){
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
  const indices=[];for(let i=1;i<points.length-1;i++)indices.push(0,i,i+1);
  g.setIndex(indices);g.computeVertexNormals();return mesh(parent,g,mat);
}

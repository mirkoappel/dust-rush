import * as THREE from 'three';

// Construction size is independent of suspension travel. More lift means a
// wider, heavier spring with additional turns, not a stretched ballpoint coil.
export function springProfile(lift=0){
  const height=THREE.MathUtils.clamp(lift,0,.56);
  return {radius:.098*(1+height*.55),wire:.016*(1+height*.40),turns:7+Math.round(height/.14)};
}
const rings=154,sides=8,stride=sides+1;
const radial=Array.from({length:sides+1},(_,j)=>[Math.cos(j*Math.PI*2/sides),Math.sin(j*Math.PI*2/sides)]);
export function createSpringGeometry(){
  const geometry=new THREE.BufferGeometry(),vertices=(rings+1)*stride,indices=[];
  geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(vertices*3),3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(vertices*3),3).setUsage(THREE.DynamicDrawUsage));
  for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){
    const a=i*stride+j,b=a+stride;indices.push(a,b,a+1,b,b+1,a+1);
  }
  geometry.setIndex(indices);
  return geometry;
}
export function updateSpringGeometry(geometry,length,lift=0){
  const old=geometry.userData.spring;
  if(old&&Math.abs(old.length-length)<.0005&&old.lift===lift)return false;
  const {radius,wire,turns}=springProfile(lift),omega=turns*Math.PI*2;
  const positions=geometry.attributes.position,normals=geometry.attributes.normal;
  // Analytic tube frame: the wire stays circular and equally thick at every
  // compressed length. No nonuniform mesh scaling, buffer allocation or trig
  // per radial vertex is needed while the suspension moves.
  const pitch=length/Math.hypot(radius*omega,length),rise=radius*omega/Math.hypot(radius*omega,length);
  for(let i=0;i<=rings;i++){
    const t=i/rings,a=t*omega,c=Math.cos(a),s=Math.sin(a);
    for(let j=0;j<=sides;j++){
      const [u,v]=radial[j];
      const nx=c*u-pitch*s*v,ny=-rise*v,nz=s*u+pitch*c*v;
      const k=i*stride+j;
      positions.setXYZ(k,radius*c+wire*nx,length*t+wire*ny,radius*s+wire*nz);
      normals.setXYZ(k,nx,ny,nz);
    }
  }
  positions.needsUpdate=normals.needsUpdate=true;
  geometry.boundingBox??=new THREE.Box3();geometry.boundingSphere??=new THREE.Sphere();
  geometry.boundingBox.min.set(-radius-wire,-wire,-radius-wire);geometry.boundingBox.max.set(radius+wire,length+wire,radius+wire);
  geometry.boundingSphere.center.set(0,length/2,0);geometry.boundingSphere.radius=Math.hypot(length/2+wire,radius+wire);
  geometry.userData.spring={length,lift,radius,wire,turns};
  return true;
}

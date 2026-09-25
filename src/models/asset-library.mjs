import * as THREE from 'three';

// Imported GLB roots are reusable templates. Their shared geometry stays immutable.
export function cloneAsset(library,name,{shadows=false,tint=null}={}){
  const source=library?.getObjectByName(name);
  if(!source)throw new Error('Missing world asset: '+name);
  const result=source.clone(true);
  result.traverse(object=>{
    if(!object.isMesh)return;
    object.castShadow=shadows;object.receiveShadow=true;
    if(tint){
      const colorize=material=>{
        if(!material.name.includes('CarPaint'))return material;
        const copy=material.clone();copy.color.set(tint);return copy;
      };
      object.material=Array.isArray(object.material)?object.material.map(colorize):colorize(object.material);
    }
  });
  return result;
}

// Repeated scenery stays instanced even when an asset contains several materials.
export function instanceAsset(parent,library,name,transforms,{shadows=false}={}){
  const template=library?.getObjectByName(name);
  if(!template)throw new Error('Missing scenery asset: '+name);
  template.updateWorldMatrix(true,true);
  const rootInverse=template.matrixWorld.clone().invert(),dummy=new THREE.Object3D(),result=new THREE.Group();
  result.name=name+'_instances';
  template.traverse(object=>{
    if(!object.isMesh)return;
    const geometry=object.geometry.clone().applyMatrix4(rootInverse.clone().multiply(object.matrixWorld));
    const instances=new THREE.InstancedMesh(geometry,object.material,transforms.length);
    instances.castShadow=shadows;instances.receiveShadow=true;
    transforms.forEach((transform,index)=>{
      dummy.position.set(...transform.p);dummy.rotation.set(...(transform.r||[0,0,0]));dummy.scale.set(...(transform.s||[1,1,1]));dummy.updateMatrix();
      instances.setMatrixAt(index,dummy.matrix);
      if(transform.tint)instances.setColorAt(index,new THREE.Color(transform.tint));
    });
    instances.instanceMatrix.needsUpdate=true;
    if(instances.instanceColor)instances.instanceColor.needsUpdate=true;
    result.add(instances);
  });
  parent.add(result);return result;
}

import * as THREE from 'three';

const PROP_ASSETS={car:'DRP_Car',barrel:'DRP_Barrel',crate:'DRP_Crate',cone:'DRP_Cone',tyre:'DRP_Tire'};
const CAR_PAINT=['#739b9a','#c99b62','#7982a0','#c47856'];
const HIDDEN_MATRIX=new THREE.Matrix4().makeScale(0,0,0);
const paintFor=id=>CAR_PAINT[((id%CAR_PAINT.length)+CAR_PAINT.length)%CAR_PAINT.length];

// A multi-material mesh needs independent primitives so that instanceColor never
// tints its windows/tyres along with CarPaint. Share the original GPU attributes;
// only draw-range wrappers are new, never one geometry copy per obstacle.
function primitives(object){
  if(!Array.isArray(object.material))return [{geometry:object.geometry,material:object.material}];
  return object.geometry.groups.flatMap(group=>{
    const material=object.material[group.materialIndex];
    if(!material)return [];
    const geometry=new THREE.BufferGeometry(),source=object.geometry;
    geometry.setIndex(source.index);
    for(const [name,attribute] of Object.entries(source.attributes))geometry.setAttribute(name,attribute);
    geometry.morphAttributes=source.morphAttributes;
    geometry.morphTargetsRelative=source.morphTargetsRelative;
    const start=Math.max(group.start,source.drawRange.start);
    const end=Math.min(group.start+group.count,source.drawRange.start+source.drawRange.count);
    geometry.setDrawRange(start,Math.max(0,end-start));
    geometry.boundingBox=source.boundingBox?.clone()||null;
    geometry.boundingSphere=source.boundingSphere?.clone()||null;
    return [{geometry,material}];
  });
}

/**
 * Repeated movable obstacles with one InstancedMesh per asset primitive.
 *
 * handles are geometry-free Object3Ds indexed by the physics prop's id. Update
 * their position/rotation/scale/visible exactly like ordinary scene objects,
 * then call sync() once. Do not add the handles themselves to the scene.
 * The returned group can be moved or hidden as a whole by the world.
 */
export function makePropInstances(library,props){
  const group=new THREE.Group(),handles=new Map(),types=new Map(),entries=[],batches=[];
  group.name='Dynamic_obstacle_instances';

  for(const prop of props){
    if(!PROP_ASSETS[prop.type])throw new Error('Unknown obstacle type: '+prop.type);
    if(handles.has(prop.id))throw new Error('Duplicate obstacle id: '+prop.id);
    const handle=new THREE.Object3D();
    handle.name='Obstacle_'+prop.id;
    handle.position.set(prop.x??0,prop.y??0,prop.z??0);
    handle.rotation.set(prop.rx??0,(prop.heading??0)+(prop.ry??0),prop.rz??0,'YXZ');
    const entry={id:prop.id,handle,lastMatrix:new THREE.Matrix4(),lastVisible:true,first:true,changed:true};
    handles.set(prop.id,handle);entries.push(entry);
    if(!types.has(prop.type))types.set(prop.type,[]);
    types.get(prop.type).push(entry);
  }

  for(const [type,slots] of types){
    const name=PROP_ASSETS[type],template=library?.getObjectByName(name);
    if(!template)throw new Error('Missing world asset: '+name);
    template.updateWorldMatrix(true,true);
    const inverseRoot=template.matrixWorld.clone().invert();
    template.traverse(object=>{
      if(!object.isMesh)return;
      const localTransform=inverseRoot.clone().multiply(object.matrixWorld);
      for(const primitive of primitives(object)){
        if(!primitive.material)continue;
        const isCarPaint=type==='car'&&primitive.material.name.includes('CarPaint');
        const material=isCarPaint?primitive.material.clone():primitive.material;
        // instanceColor multiplies the base colour. White reproduces the old
        // per-car material.color replacement without tinting it twice.
        if(isCarPaint)material.color.set(0xffffff);
        const mesh=new THREE.InstancedMesh(primitive.geometry,material,slots.length);
        mesh.name=name+'_'+primitive.material.name+'_instances';
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.castShadow=false;mesh.receiveShadow=true;
        // Individual obstacles can move anywhere. Skip stale shared bounds and
        // avoid recomputing geometry/world bounding boxes on every frame.
        mesh.frustumCulled=false;
        if(isCarPaint){
          const color=new THREE.Color();
          slots.forEach((entry,index)=>mesh.setColorAt(index,color.set(paintFor(entry.id))));
          mesh.instanceColor.needsUpdate=true;
        }
        group.add(mesh);
        batches.push({mesh,slots,localTransform});
      }
    });
  }

  const composed=new THREE.Matrix4();
  function sync(){
    for(const entry of entries){
      const {handle}=entry;
      if(handle.matrixAutoUpdate)handle.updateMatrix();
      entry.changed=entry.first||entry.lastVisible!==handle.visible||!entry.lastMatrix.equals(handle.matrix);
      if(entry.changed){
        entry.lastMatrix.copy(handle.matrix);entry.lastVisible=handle.visible;entry.first=false;
      }
    }
    for(const batch of batches){
      let dirty=false;
      batch.slots.forEach((entry,index)=>{
        if(!entry.changed)return;
        if(entry.handle.visible)composed.multiplyMatrices(entry.handle.matrix,batch.localTransform);
        else composed.copy(HIDDEN_MATRIX);
        batch.mesh.setMatrixAt(index,composed);dirty=true;
      });
      if(dirty)batch.mesh.instanceMatrix.needsUpdate=true;
    }
  }
  sync();
  return {group,handles,sync};
}

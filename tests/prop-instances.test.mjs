import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

// Bundle in memory with the exact locally vendored Three version used by the
// game. No browser, generated test files, network or additional dependency.
const root=fileURLToPath(new URL('../',import.meta.url));
const result=await build({
  stdin:{contents:"export * as THREE from 'three';export {makePropInstances} from './src/models/props.mjs';export {GLTFLoader} from './vendor/GLTFLoader.js';",resolveDir:root,sourcefile:'prop-instance-test-entry.mjs'},
  bundle:true,write:false,format:'esm',platform:'node',target:['node20'],
  alias:{three:fileURLToPath(new URL('../vendor/three.module.js',import.meta.url))},logLevel:'silent',
});
const {THREE,makePropInstances,GLTFLoader}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
const ASSETS={car:'DRP_Car',barrel:'DRP_Barrel',crate:'DRP_Crate',cone:'DRP_Cone',tyre:'DRP_Tire'};
const COLORS=['#739b9a','#c99b62','#7982a0','#c47856'];

function near(actual,expected,tolerance=1e-6){
  assert.ok(Math.abs(actual-expected)<tolerance,actual+' ≈ '+expected);
}
function matrixNear(actual,expected){
  actual.elements.forEach((value,index)=>near(value,expected.elements[index],2e-6));
}
function material(name,color='#507070'){
  const result=new THREE.MeshStandardMaterial({color});result.name=name;return result;
}
function library(){
  const scene=new THREE.Group();
  for(const [type,name] of Object.entries(ASSETS)){
    const group=new THREE.Group();group.name=name;scene.add(group);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material(type==='car'?'CarPaint':'Body'));
    group.add(mesh);
    if(type==='car'){
      group.add(new THREE.Mesh(new THREE.BoxGeometry(.4,.2,.5),material('Glass','#122235')));
      group.add(new THREE.Mesh(new THREE.BoxGeometry(.3,.3,.4),material('Rubber','#292929')));
    }
  }
  return scene;
}
function props(type,count,start=0){
  return Array.from({length:count},(_,index)=>({id:start+index,type,x:index*3,y:.85,z:2,heading:0}));
}
function matrixAt(mesh,index=0){
  const matrix=new THREE.Matrix4();mesh.getMatrixAt(index,matrix);return matrix;
}

test('Hindernisse teilen unveränderte Geometrie statt je Fahrzeug neue Meshes anzulegen',()=>{
  const source=library(),items=[...props('car',20),...props('barrel',8,20),...props('crate',6,28),...props('cone',7,34),...props('tyre',5,41)];
  const originals=new Set();source.traverse(object=>{if(object.isMesh)originals.add(object.geometry);});
  const {group,handles}=makePropInstances(source,items);
  assert.equal(group.children.length,7);assert.equal(handles.size,items.length);
  for(const mesh of group.children){
    assert.ok(mesh.isInstancedMesh);assert.ok(originals.has(mesh.geometry));
    assert.equal(mesh.instanceMatrix.usage,THREE.DynamicDrawUsage);
    assert.equal(mesh.frustumCulled,false);assert.equal(mesh.castShadow,false);
    const type=Object.keys(ASSETS).find(key=>mesh.name.startsWith(ASSETS[key]+'_'));
    assert.equal(mesh.count,items.filter(p=>p.type===type).length);
  }
  for(const [id,handle] of handles){
    assert.ok(handle.isObject3D);assert.ok(!handle.isMesh);
    assert.equal(handle.children.length,0);assert.equal(handle.parent,null);
    assert.equal(handle.position.y,.85);
    assert.equal(id,items.find(p=>p.id===id).id);
  }
});

test('Root-relative Hierarchien, Bewegungen, Drehungen und Crush-Skalierung bleiben exakt',()=>{
  const scene=new THREE.Group();scene.position.set(19,4,-7);scene.rotation.y=.7;
  const root=new THREE.Group();root.name='DRP_Car';root.position.set(3,2,1);root.scale.set(2,.6,1.5);scene.add(root);
  const child=new THREE.Group();child.position.set(.3,-.4,.7);child.rotation.z=.23;child.scale.set(.7,1.1,.8);root.add(child);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(2,1,3),material('CarPaint'));mesh.position.set(-.2,.1,.5);mesh.rotation.x=-.11;child.add(mesh);
  const originalPositions=Array.from(mesh.geometry.attributes.position.array);
  const batches=makePropInstances(scene,[{id:0,type:'car',x:10,y:.85,z:-6}]);
  const handle=batches.handles.get(0);handle.rotation.set(.12,.45,-.07,'YXZ');handle.scale.set(1,.4,1);handle.position.y=.34;
  batches.sync();child.updateMatrix();mesh.updateMatrix();handle.updateMatrix();
  const expected=handle.matrix.clone().multiply(child.matrix).multiply(mesh.matrix);
  matrixNear(matrixAt(batches.group.children[0]),expected);
  assert.deepEqual(Array.from(mesh.geometry.attributes.position.array),originalPositions);
  assert.equal(batches.group.children[0].geometry,mesh.geometry);
});

test('sync lädt nur veränderte Instanzpuffer neu und lässt ruhende Objekte unverändert',()=>{
  const {group,handles,sync}=makePropInstances(library(),[...props('car',2),...props('barrel',1,5)]);
  const initial=group.children.map(mesh=>mesh.instanceMatrix.version);sync();
  assert.deepEqual(group.children.map(mesh=>mesh.instanceMatrix.version),initial);
  handles.get(1).position.x+=4;sync();
  group.children.forEach((mesh,index)=>{
    assert.equal(mesh.instanceMatrix.version,initial[index]+(mesh.name.startsWith('DRP_Car_')?1:0));
  });
  const car=group.children.find(mesh=>mesh.name.startsWith('DRP_Car_'));
  near(matrixAt(car,0).elements[12],0);near(matrixAt(car,1).elements[12],7);
  const afterMove=group.children.map(mesh=>mesh.instanceMatrix.version);sync();
  assert.deepEqual(group.children.map(mesh=>mesh.instanceMatrix.version),afterMove);
});

test('Unsichtbare Instanzen verschwinden und kommen nach Reset in ihrer aktuellen Pose zurück',()=>{
  const {group,handles,sync}=makePropInstances(library(),props('car',2));
  const handle=handles.get(1),mesh=group.children[0];
  const original=matrixAt(mesh,1);handle.visible=false;sync();
  assert.equal(matrixAt(mesh,1).determinant(),0);
  handle.position.x=14;handle.scale.set(1,.45,1);sync();
  assert.equal(matrixAt(mesh,1).determinant(),0);
  handle.visible=true;handle.scale.set(1,1,1);sync();
  const restored=matrixAt(mesh,1);
  near(restored.elements[12],14);near(restored.determinant(),1);
  assert.notDeepEqual(restored.elements,original.elements);
  // A caller can also supply a manually managed local matrix.
  handle.matrixAutoUpdate=false;handle.matrix.makeTranslation(7,8,9);sync();
  matrixNear(matrixAt(mesh,1),new THREE.Matrix4().makeTranslation(7,8,9));
});

test('Individuelle Autofarben betreffen ausschließlich CarPaint und ändern keine Templates',()=>{
  const source=library(),paint=source.getObjectByName('DRP_Car').children[0].material;
  const original=paint.color.clone(),{group}=makePropInstances(source,props('car',4));
  const colored=group.children.filter(mesh=>mesh.material.name.includes('CarPaint'));
  assert.equal(colored.length,1);assert.notEqual(colored[0].material,paint);
  assert.ok(paint.color.equals(original));near(colored[0].material.color.r,1);
  for(let i=0;i<4;i++){
    const actual=new THREE.Color();colored[0].getColorAt(i,actual);
    const expected=new THREE.Color(COLORS[i]);
    near(actual.r,expected.r);near(actual.g,expected.g);near(actual.b,expected.b);
  }
  for(const mesh of group.children.filter(mesh=>!mesh.material.name.includes('CarPaint'))){
    assert.equal(mesh.instanceColor,null);
    assert.ok(source.getObjectByName('DRP_Car').children.some(child=>child.material===mesh.material));
  }
});

test('Mehrmaterial-Geometrien werden als geteilte Draw-Range-Primitives getrennt eingefärbt',()=>{
  const source=new THREE.Group(),geometry=new THREE.BoxGeometry(2,1,3);
  const paint=material('CarPaint'),glass=material('Glass','#102030');
  geometry.groups.forEach((group,index)=>{group.materialIndex=index%2;});
  const groups=geometry.groups.map(group=>({...group})),mesh=new THREE.Mesh(geometry,[paint,glass]);
  mesh.name='DRP_Car';source.add(mesh);
  const {group}=makePropInstances(source,props('car',10));
  assert.equal(group.children.length,6);assert.deepEqual(geometry.groups,groups);
  group.children.forEach((batch,index)=>{
    assert.equal(batch.count,10);
    assert.notEqual(batch.geometry,geometry);
    assert.equal(batch.geometry.index,geometry.index);
    assert.equal(batch.geometry.attributes.position,geometry.attributes.position);
    assert.equal(batch.geometry.attributes.normal,geometry.attributes.normal);
    assert.equal(batch.geometry.drawRange.start,groups[index].start);
    assert.equal(batch.geometry.drawRange.count,groups[index].count);
    assert.equal(!!batch.instanceColor,index%2===0);
  });
});

test('Leere Listen sind günstig und fehlerhafte Physik- oder Assetzuordnung fällt sichtbar auf',()=>{
  const empty=makePropInstances(null,[]);empty.sync();
  assert.equal(empty.group.children.length,0);assert.equal(empty.handles.size,0);
  assert.throws(()=>makePropInstances(library(),[{id:1,type:'unknown'}]),/Unknown obstacle type/);
  assert.throws(()=>makePropInstances(null,[{id:1,type:'car'}]),/Missing world asset: DRP_Car/);
  assert.throws(()=>makePropInstances(library(),[{id:1,type:'car'},{id:1,type:'crate'}]),/Duplicate obstacle id: 1/);
});

test('Die echten Blender-Hindernisse bleiben unabhängig von ihrer Anzahl bei 26 Draw Calls',async()=>{
  const data=readFileSync(new URL('../assets/world-assets-v1.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  const items=Object.keys(ASSETS).flatMap((type,index)=>props(type,30,index*30));
  const {group,handles,sync}=makePropInstances(gltf.scene,items);
  assert.equal(group.children.length,26);assert.equal(handles.size,150);
  assert.ok(group.children.every(mesh=>mesh.count===30));
  const geometrySet=new Set();gltf.scene.traverse(object=>{if(object.isMesh)geometrySet.add(object.geometry);});
  assert.ok(group.children.every(mesh=>geometrySet.has(mesh.geometry)));
  const car=handles.get(0);car.scale.y=.4;car.position.y=.85*.4;sync();
  // Crushing scales around the physics origin, not around a second ground offset.
  let lowest=Infinity;
  for(const mesh of group.children.filter(mesh=>mesh.name.startsWith('DRP_Car_'))){
    mesh.geometry.computeBoundingBox();
    const box=mesh.geometry.boundingBox.clone().applyMatrix4(matrixAt(mesh));
    lowest=Math.min(lowest,box.min.y);
  }
  near(lowest,0,2e-6);
});

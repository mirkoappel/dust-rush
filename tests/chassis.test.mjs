import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {VEHICLE_DIMENSIONS as DIM} from '../src/vehicle-dimensions.mjs';
import {VEHICLE} from '../src/physics.mjs';

const result=await build({
  stdin:{contents:"export * as THREE from 'three';export {GLTFLoader} from './vendor/GLTFLoader.js';export {extendChassis} from './src/models/chassis.mjs';export {makeWorkshop} from './src/workshop.mjs';export {createPartPreview} from './src/ui/part-previews.mjs';",resolveDir:fileURLToPath(new URL('../',import.meta.url))},
  bundle:true,write:false,format:'esm',platform:'node',target:['node20'],logLevel:'silent',
  alias:{three:fileURLToPath(new URL('../vendor/three.module.js',import.meta.url))},
});
const {THREE,GLTFLoader,extendChassis,makeWorkshop,createPartPreview}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-5,actual+' ≈ '+expected);
async function load(name){
  const bytes=readFileSync(new URL('../assets/'+name+'.glb',import.meta.url));
  return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}

test('Reifen-Vorschaubilder verwenden gemeinsame Projektion und wachsen wie die echten Räder',async()=>{
  const library=await load('truck-library-v2'),heights=[],cameras=[];
  for(const type of ['street','standard','sand','giant']){
    const original=library.getObjectByName('DR2_Wheel_'+type),scale=original.scale.clone();
    const {model,camera}=createPartPreview(original,type);cameras.push(camera);
    let low=Infinity,high=-Infinity;
    const point=new THREE.Vector3();
    model.traverse(object=>{
      if(!object.isMesh)return;
      const position=object.geometry.attributes.position;
      for(let i=0;i<position.count;i++){
        point.fromBufferAttribute(position,i).applyMatrix4(object.matrixWorld).project(camera);
        low=Math.min(low,point.y);high=Math.max(high,point.y);
      }
    });
    heights.push(high-low);assert.ok(low>-.95&&high<.95,type+' fits without cropping');
    assert.deepEqual(original.scale.toArray(),scale.toArray());
  }
  assert.deepEqual(heights,[...heights].sort((a,b)=>a-b));
  assert.ok(heights[3]/heights[0]>1.2,heights);
  for(const camera of cameras){
    assert.equal(camera.isOrthographicCamera,true);
    assert.deepEqual(camera.projectionMatrix.elements,cameras[0].projectionMatrix.elements);
    assert.deepEqual(camera.position.toArray(),cameras[0].position.toArray());
  }
});

test('Wagenheber steht hinten neben der Werkbank statt vor der Rad-Nahansicht',async()=>{
  const workshop=makeWorkshop(await load('world-assets-v1'));
  const jack=workshop.getObjectByName('DRP_FloorJack'),bounds=new THREE.Box3().setFromObject(jack);
  assert.ok(bounds.min.x>5);assert.ok(bounds.max.z<0);
});

test('Radstand wächst genau 20 Prozent, Spur und Reifendurchmesser bleiben unabhängig',()=>{
  near(DIM.wheelbase,DIM.sourceWheelbase*1.2);
  assert.equal(VEHICLE.wheelbase,DIM.wheelbase);assert.equal(VEHICLE.track,DIM.track);
  assert.equal(DIM.track,2.2072);assert.equal(DIM.wheelRadius,.685);
});

test('Blender-Fahrwerk verschiebt runde Räder und ganze Federn statt Reifen oval zu skalieren',async()=>{
  const source=await load('monstertruck'),model=source.clone(true);
  extendChassis(model);model.scale.setScalar(DIM.modelScale);model.updateMatrixWorld(true);
  for(const code of ['FL','FR','RL','RR']){
    const old=source.getObjectByName('Suspension_'+code),axle=model.getObjectByName('Suspension_'+code);
    const center=new THREE.Vector3();axle.getWorldPosition(center);
    near(Math.abs(center.z),DIM.wheelbase/2);near(Math.abs(center.x),DIM.track/2);
    near(axle.position.z,old.position.z*DIM.chassisStretch);
    assert.deepEqual(axle.scale.toArray(),[1,1,1]);
    const oldWheel=source.getObjectByName('Wheel_'+code),wheel=model.getObjectByName('Wheel_'+code);
    const oldMeshes=[];oldWheel.traverse(o=>{if(o.isMesh)oldMeshes.push(o);});
    let index=0;wheel.traverse(o=>{if(o.isMesh){assert.equal(o.geometry,oldMeshes[index++].geometry);assert.deepEqual(o.scale.toArray(),[1,1,1]);}});
    const originalSpring=source.getObjectByName('Spring_and_damper_'+code),newSpring=model.getObjectByName('Spring_and_damper_'+code);
    const oldParts=[];originalSpring.traverse(o=>{if(o.isMesh)oldParts.push(o);});
    index=0;newSpring.traverse(o=>{
      if(!o.isMesh)return;const original=oldParts[index++];assert.notEqual(o.geometry,original.geometry);
      o.geometry.computeBoundingBox();original.geometry.computeBoundingBox();
      const before=original.geometry.boundingBox,after=o.geometry.boundingBox;
      for(const axis of ['x','y']){near(after.min[axis],before.min[axis]);near(after.max[axis],before.max[axis]);}
      near(after.min.z-before.min.z,old.position.z*(DIM.chassisStretch-1));
      near(after.max.z-before.max.z,old.position.z*(DIM.chassisStretch-1));
    });
  }
  assert.equal(source.userData.longChassis,undefined);
  assert.throws(()=>extendChassis(model),/already extended/);
});

test('Alle neuen Karosserien deklarieren denselben Radstand wie die Physik',async()=>{
  const library=await load('truck-library-v2');
  for(const style of ['pickup','buggy','van','hotrod']){
    const body=library.getObjectByName('DR2_Body_'+style);
    near(body.userData.wheelbase_m,DIM.wheelbase);
    const size=new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3());
    assert.ok(size.z>4.2&&size.z<4.8,size.z);assert.ok(size.x<2.2,size.x);
  }
});

test('Werkstattwände geben die Rundum-Ansicht auch bei gedrehter Halle frei',async()=>{
  const workshop=makeWorkshop(await load('world-assets-v1'));
  workshop.position.set(23,0,-31);workshop.rotation.y=.7;workshop.updateMatrixWorld(true);
  const back=workshop.getObjectByName('Workshop_back_wall'),left=workshop.getObjectByName('Workshop_left_wall');
  const camera=(x,z)=>workshop.userData.updateCameraVisibility(workshop.localToWorld(new THREE.Vector3(x,3,z)));
  camera(4,7);assert.equal(back.visible,true);assert.equal(left.visible,true);
  camera(0,-10);assert.equal(back.visible,false);assert.equal(left.visible,true);
  camera(-12,0);assert.equal(back.visible,true);assert.equal(left.visible,false);
  camera(-12,-10);assert.equal(back.visible,false);assert.equal(left.visible,false);
  camera(4,7);assert.equal(back.visible,true);assert.equal(left.visible,true);
});

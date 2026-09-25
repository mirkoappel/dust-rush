import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {VEHICLE_DIMENSIONS as DIM} from '../src/vehicle-dimensions.mjs';
import {WHEEL_TYPES} from '../src/customization.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const result=await build({
  stdin:{contents:"export * as THREE from 'three';export {GLTFLoader} from './vendor/GLTFLoader.js';export {installBodyKits} from './src/models/body-kits.mjs';export {makeTruckAddons} from './src/truck-addons.mjs';export * from './src/models/vehicle-mounts.mjs';",resolveDir:root,sourcefile:'truck-assembly-tests.mjs'},
  bundle:true,write:false,format:'esm',platform:'node',target:['node20'],
  alias:{three:fileURLToPath(new URL('../vendor/three.module.js',import.meta.url))},logLevel:'silent',
});
const {THREE,GLTFLoader,installBodyKits,makeTruckAddons,BODY_STYLES,getBodyMounts,enginePlacement,curvedPipeGeometry,FRAME_RAIL_Y,FRAME_HALF_WIDTH,TRANSFER_POINT}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
const bytes=readFileSync(new URL('../assets/truck-library-v2.glb',import.meta.url));
const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const library=gltf.scene,hasFinalMounts=BODY_STYLES.every(body=>library.getObjectByName('DR2_Body_'+body).userData.mount_engine);
const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,a+' ≈ '+b);
const vectorNear=(actual,expected)=>actual.forEach((value,i)=>near(value,expected[i]));
function rig(){
  const scene=new THREE.Group(),model=new THREE.Group(),sprung=new THREE.Group(),oldBody=new THREE.Group();
  model.scale.setScalar(DIM.modelScale);scene.add(model);
  sprung.position.y=(1.52-.187)/DIM.modelScale;model.add(sprung);sprung.add(oldBody);
  const wheels=Array.from({length:4},()=>{const wheel=new THREE.Group();model.add(wheel);return wheel;});
  const kit=installBodyKits(sprung,oldBody,wheels,library);
  return {scene,model,sprung,oldBody,wheels,kit};
}
const selectedAssembly=kit=>kit.root.children.find(object=>object.name.startsWith('Mounted_engine_')&&object.visible);
function triangles(object){
  let count=0;object.traverse(child=>{if(child.isMesh)count+=(child.geometry.index?.count||child.geometry.attributes.position.count)/3;});return count;
}

test('Montagedaten sind finale Body-Meter und die Spoilerbreite ist der halbe Stützenabstand',()=>{
  const root=new THREE.Group();root.name='DR2_Body_pickup';root.userData={
    mount_engine:[.02,-.18,1.07],mount_engine_scale:.82,mount_roof:[0,1.03,-.45],
    mount_wing:[0,.41,-1.73],mount_wing_width:.65,mount_exhaust:[.9,-.31,-.29],
  };
  const source=new THREE.Group();source.add(root);
  const mounts=getBodyMounts(source,'pickup');
  vectorNear(mounts.engine,[.02,-.18,1.07]);vectorNear(mounts.wing,[0,.41,-1.73]);near(mounts.width,.65);
  assert.ok(Object.isFrozen(mounts));assert.ok(Object.isFrozen(mounts.engine));
  assert.notEqual(mounts.engine,root.userData.mount_engine);
  const addons=makeTruckAddons();addons.setBuild({body:'pickup',wing:true},mounts);
  near(addons.wing.userData.footPlates[1][0]-addons.wing.userData.footPlates[0][0],1.30);
  near(addons.wing.position.z,-1.73);
  root.userData.mount_engine=[0,NaN,0];assert.throws(()=>getBodyMounts(source,'pickup'),/Invalid truck mount/);
});

test('Vorne und hinten eingebaute Motoren richten ihren Kraftausgang stets zur Fahrzeugmitte',()=>{
  for(const body of BODY_STYLES)for(const engine of ['classic','supercharged','electric']){
    const mounts=getBodyMounts(library,body),pose=enginePlacement(mounts,engine);
    assert.ok(Math.abs(pose.output[2])<Math.abs(mounts.engine[2]));
    assert.equal(pose.direction,body==='buggy'?1:-1);
    near(pose.yaw,body==='buggy'?(engine==='electric'?0:Math.PI):(engine==='electric'?Math.PI:0));
    for(const foot of pose.feet){
      assert.ok(foot[1]>FRAME_RAIL_Y+.1);assert.ok(Math.abs(foot[0])<FRAME_HALF_WIDTH);
    }
    for(const port of pose.exhaust){
      assert.equal(Math.sign(port.collector[0][0]),Math.sign(port.junction[0]));
      near(port.junction[1],FRAME_RAIL_Y-.04);
    }
  }
});

test('Alle zwölf echten Motor/Karosserie-Kombinationen bleiben in der Motoransicht vollständig befestigt',()=>{
  const {kit,oldBody,wheels}=rig();assert.equal(oldBody.visible,false);
  for(const body of BODY_STYLES)for(const engine of ['classic','supercharged','electric']){
    kit.setStyle(body);kit.setEngine(engine);kit.setFocus('engine');
    const assembly=selectedAssembly(kit);assert.ok(assembly,body+'/'+engine);
    const motor=assembly.getObjectByName('Configured_engine_'+engine),supports=assembly.getObjectByName('Engine_mounts_and_transmission');
    assert.ok(motor.visible&&supports.visible);assert.ok(supports.children.length>=2);
    const mounts=kit.getMounts();motor.updateWorldMatrix(true,true);
    const position=motor.getWorldPosition(new THREE.Vector3());
    vectorNear(position.toArray(),[mounts.engine[0],1.52+mounts.engine[1],mounts.engine[2]]);
    for(const anchor of supports.userData.frameAnchors){
      near(Math.abs(anchor[0]),FRAME_HALF_WIDTH);near(anchor[1],FRAME_RAIL_Y);
    }
    vectorNear(supports.userData.transfer,TRANSFER_POINT);
    for(const shell of kit.root.children.filter(object=>object.name.startsWith('DR2_Body_')))assert.equal(shell.visible,false);
    assert.equal(kit.root.children.filter(object=>object.name.startsWith('Mounted_engine_')&&object.visible).length,1);
    assert.ok(wheels.every(wheel=>wheel.children.filter(child=>child.visible).length===1));
    assert.ok(kit.focusTarget('engine').toArray().every(Number.isFinite));
    assert.ok(triangles(supports)<9000,body+'/'+engine+' support geometry budget');
    kit.setFocus('truck');assert.equal(kit.root.getObjectByName('DR2_Body_'+body).visible,true);
  }
});

test('Spoiler und Lichtbügel werden mit Fußplatten auf den jeweiligen Montageflächen positioniert',()=>{
  const addons=makeTruckAddons();
  for(const body of BODY_STYLES){
    const mounts=getBodyMounts(library,body);addons.setBuild({body,wing:true,lights:true,pipes:true},mounts);
    vectorNear(addons.wing.position.toArray(),mounts.wing);vectorNear(addons.lights.position.toArray(),mounts.roof);
    for(const point of addons.wing.userData.footPlates){near(point[1],mounts.wing[1]);near(point[2],mounts.wing[2]);}
    addons.lights.userData.footPlates.forEach((point,index)=>{near(point[1],mounts.roofFootHeights[index]);near(point[2],mounts.roof[2]);});
    assert.equal(addons.wing.userData.footPlates.length,2);assert.equal(addons.lights.userData.footPlates.length,2);
    assert.ok(addons.focusTarget('wing').toArray().every(Number.isFinite));
    assert.ok(triangles(addons.root)<20000,'Accessories retain a bounded geometry budget');
  }
});

test('Alle sechzehn Dach- und Spoilerfüße treffen die tatsächliche Blender-Oberfläche',{skip:!hasFinalMounts},()=>{
  const addons=makeTruckAddons();
  for(const body of BODY_STYLES){
    const source=library.getObjectByName('DR2_Body_'+body),mounts=getBodyMounts(library,body);
    addons.setBuild({body,wing:true,lights:true},mounts);source.updateWorldMatrix(true,true);
    for(const part of ['wing','lights'])for(const foot of addons[part].userData.footPlates){
      const ray=new THREE.Raycaster(new THREE.Vector3(foot[0],foot[1]+.12,foot[2]),new THREE.Vector3(0,-1,0),0,.4);
      const hit=ray.intersectObject(source,true)[0];
      assert.ok(hit,body+'/'+part+' has a solid surface beneath the foot');
      near(hit.point.y,foot[1],2e-6);
    }
  }
});

test('Auspuffwege starten exakt an den Motoranschlüssen und enden als sichtbare offene Rohre',()=>{
  const addons=makeTruckAddons();
  for(const body of BODY_STYLES){
    const mounts=getBodyMounts(library,body),placement=enginePlacement(mounts,'classic');
    addons.setBuild({body,engine:'classic',pipes:true},mounts);
    assert.equal(addons.pipes.userData.routes.length,2);
    addons.pipes.userData.routes.forEach((route,index)=>{
      vectorNear(route[0],placement.exhaust[index].junction);
      assert.ok(route.flat().every(Number.isFinite));
      const last=route[route.length-1],previous=route[route.length-2];
      assert.ok(new THREE.Vector3(...last).distanceTo(new THREE.Vector3(...previous))>.07);
      if(body==='buggy'){
        assert.ok(Math.abs(last[0])<.55);assert.ok(last[2]<-1.9);
      }
      if(body==='pickup'){
        assert.ok(last[2]<-1.3,'Stacks belong behind the cab, not in front of a door');
        assert.ok(last[1]>.6);assert.ok(Math.abs(last[0])<=.56);
      }
    });
  }
});

test('Gekrümmte Auspuffwege bleiben im Ruhezustand von allen vier Reifentypen frei',()=>{
  const addons=makeTruckAddons();
  for(const body of BODY_STYLES){
    addons.setBuild({body,engine:'classic',pipes:true},getBodyMounts(library,body));
    for(const [kind,{scale}] of Object.entries(WHEEL_TYPES)){
      const tyre=library.getObjectByName('DR2_Wheel_'+kind),bounds=new THREE.Box3().setFromObject(tyre);
      const halfWidth=Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x))*scale,radius=DIM.wheelRadius*scale;
      for(const route of addons.pipes.userData.routes){
        const tube=curvedPipeGeometry(route,body==='pickup'?.050:.043,.115),positions=tube.attributes.position;
        for(let i=0;i<positions.count;i++){
          const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
          for(const side of [-1,1])for(const end of [-1,1]){
            const across=Math.abs(x-side*DIM.track/2),radial=Math.hypot(y-(DIM.wheelRadius-1.52),z-end*DIM.wheelbase/2);
            assert.ok(across>halfWidth||radial>radius-.001,body+'/'+kind+' pipe intersects tyre');
          }
        }
        tube.dispose();
      }
    }
  }
});

test('Elektroantrieb unterdrückt den Auspuff ohne die gespeicherte Auswahl oder Lackierung zu löschen',()=>{
  const addons=makeTruckAddons(),mounts=getBodyMounts(library,'pickup');
  addons.paintMaterials.pipes.color.set('#8d72db');
  addons.setBuild({body:'pickup',engine:'classic',pipes:true,wing:true,lights:true},mounts);
  const geometry=addons.pipes.children[0].geometry;
  assert.equal(addons.pipes.visible,true);
  addons.setBuild({engine:'electric'},mounts);
  assert.equal(addons.pipes.visible,false);assert.equal(addons.getBuild().pipes,true);
  assert.equal(addons.pipes.children[0].geometry,geometry);
  assert.equal(addons.paintMaterials.pipes.color.getHexString(),'8d72db');
  addons.setFocus('engine');assert.ok(!addons.wing.visible&&!addons.lights.visible&&!addons.pipes.visible);
  addons.setFocus('truck');assert.ok(addons.wing.visible&&addons.lights.visible);assert.equal(addons.pipes.visible,false);
  addons.setBuild({engine:'classic'},mounts);assert.equal(addons.pipes.visible,true);
});

test('Finale Blender-Montagepunkte werden ohne zweite Längenskalierung aus dem GLB übernommen',{skip:!hasFinalMounts},()=>{
  for(const body of BODY_STYLES){
    const source=library.getObjectByName('DR2_Body_'+body),meta=source.userData,mounts=getBodyMounts(library,body);
    assert.equal(meta.mount_wing_width_semantics,'half-spacing');
    for(const [key,name] of [['engine','mount_engine'],['roof','mount_roof'],['wing','mount_wing'],['exhaust','mount_exhaust']])vectorNear(mounts[key],meta[name]);
    near(mounts.scale,meta.mount_engine_scale);near(mounts.width,meta.mount_wing_width);
    const bodyBounds=new THREE.Box3().setFromObject(source);
    assert.ok(mounts.engine[2]>=bodyBounds.min.z&&mounts.engine[2]<=bodyBounds.max.z);
    assert.ok(mounts.roof[1]<=bodyBounds.max.y+.025);
    assert.ok(mounts.width<=Math.max(Math.abs(bodyBounds.min.x),Math.abs(bodyBounds.max.x)));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {VEHICLE_DIMENSIONS as DIM} from '../src/vehicle-dimensions.mjs';

const bundle=await build({
  stdin:{contents:"export * as THREE from 'three';export {makeRunningGear,GEAR} from './src/models/running-gear.mjs';",resolveDir:fileURLToPath(new URL('../',import.meta.url))},
  bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent',
  alias:{three:fileURLToPath(new URL('../vendor/three.module.js',import.meta.url))},
});
const {THREE,makeRunningGear,GEAR}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,a+' ≈ '+b);
function pose(lift=0,pitch=0,roll=0){
  return new THREE.Matrix4().compose(new THREE.Vector3(0,2.15+lift/DIM.modelScale,0),new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch,0,roll,'YXZ')),new THREE.Vector3(1,1,1)).multiply(new THREE.Matrix4().makeTranslation(0,-2.15,0));
}

test('Federbein-Enden treffen Achslaschen und obere Rahmentürme',()=>{
  const gear=makeRunningGear();gear.sync(pose(),[0,0,0,0]);
  assert.equal(gear.endpoints.length,4);
  gear.endpoints.forEach((end,i)=>{
    near(end.bottom[1],DIM.wheelRadius+.08);near(end.top[1],GEAR.shockTopY);
    near(Math.abs(end.bottom[0]),GEAR.shockBottomX);near(Math.abs(end.top[0]),GEAR.shockTopX);
    near(end.bottom[2],(i<2?1:-1)*DIM.wheelbase/2);near(end.top[2],end.bottom[2]);
    assert.ok(end.length>.7&&end.length<.9);
  });
  near(gear.frame.matrix.elements[13],0);
});

test('Alle drei Höhen heben Rahmen und obere Augen, nicht Räder oder untere Augen',()=>{
  const gear=makeRunningGear();
  for(const height of [0,.28,.56]){
    gear.sync(pose(height),[0,0,0,0],height);
    near(gear.frame.matrix.elements[13],height);
    for(const end of gear.endpoints){near(end.top[1],GEAR.shockTopY+height);near(end.bottom[1],DIM.wheelRadius+.08);}
    for(const axle of gear.axles)near(axle.position.y,DIM.wheelRadius);
  }
});

test('Verschränkung artikuliert massive Achsen und hält alle Instanzmatrizen endlich',()=>{
  const gear=makeRunningGear();
  const framePositions=[];gear.frame.traverse(o=>{if(o.isMesh)framePositions.push({g:o.geometry,before:Array.from(o.geometry.attributes.position.array)});});
  for(let n=0;n<80;n++){
    const t=n/80,offsets=[.3*t,-.16*t,-.12*t,.2*t].map(v=>v/DIM.modelScale);
    gear.sync(pose(.56,.12*t,-.13*t),offsets,.56);
    assert.ok(gear.axles[0].rotation.z>=0);assert.ok(gear.axles[1].rotation.z<=0);
    gear.root.traverse(o=>{
      if(o.isInstancedMesh){assert.ok(o.count<=o.instanceMatrix.count);assert.ok(Array.from(o.instanceMatrix.array).every(Number.isFinite));}
    });
    for(const end of gear.endpoints)assert.ok(end.length>.35&&end.length<2.1);
  }
  for(const entry of framePositions)assert.deepEqual(Array.from(entry.g.attributes.position.array),entry.before,'Rahmen bleibt ein starrer Körper');
  assert.equal(gear.root.getObjectByName('Suspension_pivot_pins').count,24);
  assert.equal(gear.root.getObjectByName('Jointed_four_link_arms').count,10);
});

test('Federfarbe bleibt getrennt von Metall, Gummilagern und Kolben',()=>{
  const gear=makeRunningGear();gear.setPaint('#fb3047');
  assert.equal(gear.root.getObjectByName('Coil_FL').material.color.getHexString(),'fb3047');
  assert.notEqual(gear.root.getObjectByName('Telescoping_piston_rods').material.color.getHexString(),'fb3047');
});

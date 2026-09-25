import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url));
function library(name){
  const bytes=read('assets/'+name+'.glb');
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  return {bytes,gltf:JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString())};
}
function bounds(gltf,name){
  const node=gltf.nodes.find(n=>n.name===name);assert.ok(node,name);
  assert.ok(!node.translation&&!node.rotation&&!node.scale,'Root transform must be baked');
  const positions=gltf.meshes[node.mesh].primitives.map(p=>gltf.accessors[p.attributes.POSITION]);
  const min=[0,1,2].map(axis=>Math.min(...positions.map(a=>a.min[axis])));
  const max=[0,1,2].map(axis=>Math.max(...positions.map(a=>a.max[axis])));
  return {min,max,size:max.map((v,i)=>v-min[i])};
}
function near(actual,expected,tolerance=.035){assert.ok(Math.abs(actual-expected)<tolerance,actual+' ≈ '+expected);}

test('Neue Blender-Weltbibliotheken sind gespeichert, eigenständig und komplett offline eingebettet',()=>{
  const html=read('index.html').toString();
  for(const [name,roots,maxBytes,maxTriangles] of [
    ['world-assets-v1',['DRP_Car','DRP_Barrel','DRP_Crate','DRP_Cone','DRP_Tire','DRP_TireStack','DRP_Cabinet','DRP_Workbench','DRP_FloorJack','DRP_Compressor'],2200000,55000],
    ['track-assets-v1',['DRS_Ramp','DRS_Barrier','DRS_Rock','DRS_Cactus'],600000,15000],
    ['workshop-parts-v1',['DR2_Engine_injected',...['lip','sport','stunt','delta'].map(k=>'DR2_Wing_'+k),...['bar','round','pods','rally'].map(k=>'DR2_Lights_'+k)],1200000,24000],
  ]){
    const {bytes,gltf}=library(name);
    const rootNames=gltf.scenes[gltf.scene??0].nodes.map(i=>gltf.nodes[i].name);
    assert.deepEqual(rootNames.sort(),roots.sort());
    assert.ok(gltf.buffers.every(b=>!b.uri));assert.ok(!gltf.images?.length);
    assert.ok(!gltf.extensionsRequired?.length);
    const triangles=gltf.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+gltf.accessors[p.indices].count/3,0);
    assert.ok(triangles<maxTriangles,triangles);assert.ok(bytes.length<maxBytes,bytes.length);
    assert.ok(html.includes(bytes.toString('base64')),name+' embedded');
    assert.ok(statSync(new URL('../design/blender/'+name+'.blend',import.meta.url)).size>1000);
  }
});

test('Blender-Hindernisse behalten die zentrierten Ursprünge der Fahrphysik',()=>{
  const {gltf}=library('world-assets-v1');
  for(const [name,halfHeight] of [['DRP_Car',.85],['DRP_Barrel',.9],['DRP_Crate',.825],['DRP_Cone',.65],['DRP_Tire',.8]]){
    const node=gltf.nodes.find(n=>n.name===name),box=bounds(gltf,name);
    assert.equal(node.extras.physics_half_height,halfHeight);
    near(box.min[1],-halfHeight);near(box.max[1],halfHeight);
  }
  const source=read('src/models/props.mjs').toString();
  assert.ok(!source.includes('position.y-='));
});

test('Rampen, Begrenzungen und Naturmodelle halten die Instanzierungsmaße ein',()=>{
  const {gltf}=library('track-assets-v1');
  for(const [name,size] of [['DRS_Ramp',[2,1,4]],['DRS_Barrier',[5.7,1.7,1.4]],['DRS_Rock',[2,2,2]]]){
    bounds(gltf,name).size.forEach((v,i)=>near(v,size[i],.002));
  }
  near(bounds(gltf,'DRS_Cactus').size[1],4,.002);
  near(bounds(gltf,'DRS_Ramp').min[1],0,.002);
  const world=read('src/world.mjs').toString();
  assert.ok(world.includes('s:[r.width/2,r.height,r.length/4]'));
  assert.ok(world.includes('instanceAsset(this.scene,this.sceneryLibrary'));
});

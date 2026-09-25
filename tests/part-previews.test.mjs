import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {createPreviewCache,previewKey} from '../src/ui/preview-cache.mjs';
import {normalizeBuild,normalizePaint} from '../src/customization.mjs';

test('Vorschau-Cache ist begrenzt, behält kürzlich benutzte Farben und gibt alte Slots frei',()=>{
  const evicted=[],cache=createPreviewCache(2,value=>evicted.push(value));
  cache.set('red',1);cache.set('blue',2);assert.equal(cache.get('red'),1);
  cache.set('green',3);assert.equal(cache.size,2);assert.equal(cache.get('blue'),undefined);
  assert.deepEqual(evicted,[2]);assert.equal(cache.get('red'),1);
  cache.clear();assert.equal(cache.size,0);assert.equal(evicted.length,3);
  assert.throws(()=>createPreviewCache(0));
});
test('Cache-Schlüssel hängen nur von sichtbaren Modelleigenschaften und ihrer Farbe ab',()=>{
  const build=normalizeBuild(),paint=normalizePaint();
  const a=previewKey('wheels','giant',build,paint);
  assert.equal(a,previewKey('wheels','giant',{...build,body:'van',engine:'electric'},paint));
  assert.notEqual(a,previewKey('wheels','giant',build,{...paint,wheels:'#292e38'}));
  assert.equal(a,previewKey('wheels','giant',build,{...paint,body:'#292e38'}));
  assert.notEqual(previewKey('wing',null,build,paint),previewKey('wing',null,{...build,body:'van'},paint));
  assert.equal(previewKey('body','pickup',build,{...paint,body:'#AABBCC'}),previewKey('body','pickup',build,{...paint,body:'#aabbcc'}));
});

const bundle=await build({
  stdin:{contents:"export * as THREE from 'three';export {GLTFLoader} from './vendor/GLTFLoader.js';export {createPreviewCatalog} from './src/ui/preview-models.mjs';export {createPreviewAtlas} from './src/ui/part-previews.mjs';",resolveDir:fileURLToPath(new URL('../',import.meta.url))},
  bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent',
  alias:{three:fileURLToPath(new URL('../vendor/three.module.js',import.meta.url))},
});
const {THREE,GLTFLoader,createPreviewCatalog,createPreviewAtlas}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'));
async function loadLibrary(){
  const bytes=readFileSync(new URL('../assets/truck-library-v2.glb',import.meta.url));
  return (await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;
}
function paintedMaterials(entry){
  const materials=new Set();entry.model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
  return materials;
}

test('Alle 24 Modelloptionen nutzen bemalbare echte Modelle ohne die Spielvorlagen einzufärben',async()=>{
  const library=await loadLibrary(),catalog=createPreviewCatalog(library),originals=new Map();
  library.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])originals.set(m,m.color.getHex());});
  const options={body:['pickup','buggy','van','hotrod'],wheels:['street','standard','sand','giant'],lift:['normal','high','extraHigh'],engine:['classic','supercharged','electric'],wing:['lip','sport','stunt'],lights:['bar','round','pods'],decals:['stripes','bolt','flames','tribal']};
  for(const [part,values] of Object.entries(options))for(const value of values){
    const entry=catalog.get(part,value);entry.setPaint('#e82846');
    assert.equal(entry.model.visible,true);
    if(part==='decals'){
      const material=[...paintedMaterials(entry)].find(m=>m.name.includes('Turquoise'));
      const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};material.onBeforeCompile(shader);
      assert.equal(shader.uniforms.drDecalColor.value.getHexString(),'e82846');
    }else assert.ok([...paintedMaterials(entry)].some(m=>m.color.getHexString()==='e82846'),part+' has a paintable surface');
    assert.ok([...paintedMaterials(entry)].some(m=>m.color.getHexString()!=='e82846'),part+' keeps non-painted mechanical surfaces');
    assert.equal(catalog.get(part,value),entry,'model geometry is reused');
    const bounds=new THREE.Box3().setFromObject(entry.model);assert.ok(!bounds.isEmpty());
  }
  assert.equal(catalog.size,24);
  for(const [material,color] of originals)assert.equal(material.color.getHex(),color);
  catalog.dispose();
  for(const [material,color] of originals)assert.equal(material.color.getHex(),color);
});

test('Federbeine zeigen drei zunehmende reale Höhen mit identischer Kamera',async()=>{
  const catalog=createPreviewCatalog(await loadLibrary()),sizes=[],projections=[];
  for(const lift of ['normal','high','extraHigh']){
    const entry=catalog.get('lift',lift);
    assert.ok(entry.model.getObjectByName('Coil_FL'));
    assert.ok(entry.model.getObjectByName('Telescoping_piston_rods'));
    assert.ok(entry.model.getObjectByName('Spring_seats'));
    assert.ok(!entry.model.getObjectByName('Jointed_four_link_arms'));
    sizes.push(new THREE.Box3().setFromObject(entry.model).getSize(new THREE.Vector3()).y);
    projections.push(entry.camera.projectionMatrix.elements);
  }
  assert.ok(sizes[0]<sizes[1]&&sizes[1]<sizes[2]);assert.ok(sizes[2]-sizes[0]>.5);
  assert.deepEqual(projections[0],projections[1]);assert.deepEqual(projections[1],projections[2]);catalog.dispose();
});

test('Anbauteil-Vorschauen passen zur Karosserie und lassen ausgeschaltete Teile sichtbar wählen',async()=>{
  const catalog=createPreviewCatalog(await loadLibrary());
  for(const part of ['wing','lights','pipes']){
    const pickup=catalog.get(part,null,'pickup'),van=catalog.get(part,null,'van');
    assert.notEqual(pickup,van);assert.equal(pickup.model.visible,true);assert.equal(van.model.visible,true);
    assert.notDeepEqual(new THREE.Box3().setFromObject(pickup.model).getSize(new THREE.Vector3()).toArray(),new THREE.Box3().setFromObject(van.model).getSize(new THREE.Vector3()).toArray());
    const color=[...paintedMaterials(pickup)].map(m=>m.color.getHex());
    van.setPaint('#2864e8');assert.deepEqual([...paintedMaterials(pickup)].map(m=>m.color.getHex()),color);
  }
  catalog.dispose();
});

test('Sprite-Atlas belegt feste Slots wieder und kopiert nur den gewählten Ausschnitt',()=>{
  const draws=[],clears=[],canvas={width:0,height:0,getContext:()=>({drawImage:(...args)=>draws.push(args),clearRect:(...args)=>clears.push(args)})};
  const atlas=createPreviewAtlas({document:{createElement:()=>canvas},size:10,capacity:2}),source={width:10,height:10},target={getContext:()=>({clearRect(){},drawImage:(...args)=>draws.push(args)})};
  const first=atlas.store('red',source),second=atlas.store('blue',source);
  assert.notEqual(first.slot,second.slot);assert.equal(atlas.size,2);
  atlas.get('red');const third=atlas.store('green',source);assert.equal(third.slot,second.slot);
  assert.equal(atlas.get('blue'),undefined);assert.equal(atlas.size,2);
  atlas.copy(first,target);const last=draws.at(-1);assert.equal(last[0],canvas);assert.deepEqual(last.slice(1),[0,0,10,10,0,0,10,10]);
  atlas.dispose();assert.equal(canvas.width,1);
});

test('Acht geordnete Farben ohne zusätzliches Blau, Creme und Anthrazit am Ende',()=>{
  const html=readFileSync(new URL('../src/page.html',import.meta.url),'utf8');
  assert.equal((html.match(/data-color=/g)||[]).length,8);
  for(const name of ['Anthrazit','Rot','Orange'])assert.ok(html.includes('aria-label="'+name+'"'));
  const colors=[...html.matchAll(/data-color="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(colors.slice(-2),['#f6eacb','#292e38']);
  assert.deepEqual(colors,['#ae82dc','#14bdd1','#b9ea48','#ffd253','#ff941f','#e82846','#f6eacb','#292e38']);
  assert.ok(!html.includes('type="color"'));
});

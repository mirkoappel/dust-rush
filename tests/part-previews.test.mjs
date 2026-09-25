import {loadTruckLibrary} from './helpers/truck-library.mjs';
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
async function loadLibrary(){return loadTruckLibrary(GLTFLoader);}
function paintedMaterials(entry){
  const materials=new Set();entry.model.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
  return materials;
}

test('Alle 28 Optionen nutzen echte Modelle oder Dekormasken ohne Spielvorlagen zu verändern',async()=>{
  const library=await loadLibrary(),catalog=createPreviewCatalog(library),originals=new Map();
  library.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])originals.set(m,m.color.getHex());});
  const options={body:['pickup','buggy','van','hotrod'],wheels:['street','standard','sand','giant'],lift:['normal','high','tall','extraHigh'],engine:['classic','injected','supercharged','electric'],wing:['lip','sport','stunt','delta'],lights:['bar','round','pods','rally'],decals:['stripes','bolt','flames','tribal']};
  for(const [part,values] of Object.entries(options))for(const value of values){
    const entry=catalog.get(part,value);entry.setPaint('#e82846');
    assert.equal(entry.model.visible,true);
    if(part==='decals'){
      assert.ok(entry.model.name.startsWith('Decal_motif_'));
      assert.ok(entry.camera.isOrthographicCamera);
      assert.equal(catalog.get(part,value,'van'),entry,'motif independent of body');
    }
    assert.ok([...paintedMaterials(entry)].some(m=>m.color.getHexString()==='e82846'),part+' has a paintable surface');
    assert.ok([...paintedMaterials(entry)].some(m=>m.color.getHexString()!=='e82846'),part+' keeps non-painted mechanical surfaces');
    assert.equal(catalog.get(part,value),entry,'model geometry is reused');
    const bounds=new THREE.Box3().setFromObject(entry.model);assert.ok(!bounds.isEmpty());
  }
  assert.equal(catalog.size,28);
  for(const [material,color] of originals)assert.equal(material.color.getHex(),color);
  catalog.dispose();
  for(const [material,color] of originals)assert.equal(material.color.getHex(),color);
});

test('Federbeine zeigen vier zunehmende reale Höhen mit identischer Kamera',async()=>{
  const catalog=createPreviewCatalog(await loadLibrary()),sizes=[],projections=[];
  for(const lift of ['normal','high','tall','extraHigh']){
    const entry=catalog.get('lift',lift);
    assert.ok(entry.model.getObjectByName('Coil_FL'));
    assert.ok(entry.model.getObjectByName('Telescoping_piston_rods'));
    assert.ok(entry.model.getObjectByName('Spring_seats'));
    assert.ok(!entry.model.getObjectByName('Jointed_four_link_arms'));
    sizes.push(new THREE.Box3().setFromObject(entry.model).getSize(new THREE.Vector3()).y);
    projections.push(entry.camera.projectionMatrix.elements);
  }
  assert.ok(sizes[0]<sizes[1]&&sizes[1]<sizes[2]&&sizes[2]<sizes[3]);assert.ok(sizes[3]-sizes[0]>.5);
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


test('Dekorkarten zeigen nur das große flache Muster; Hauptlack und Karosserie beeinflussen es nicht',async()=>{
  const catalog=createPreviewCatalog(await loadLibrary());
  for(const value of ['stripes','bolt','flames','tribal']){
    const entry=catalog.get('decals',value),motif=entry.model.getObjectByName('Decal_color');
    assert.ok(motif);assert.equal(entry.model.children.length,2);
    assert.equal(motif.material.alphaMap.name,'Decal_mask_'+value);
    assert.equal(entry.camera.position.x,0);assert.equal(entry.camera.position.y,0);
    const size=new THREE.Box3().setFromObject(motif).getSize(new THREE.Vector3());
    assert.equal(size.z,0);assert.equal(size.x,2);assert.equal(size.y,1);
    entry.setPaint('#292e38',{body:'#ffffff'},normalizeBuild({body:'van'}));
    assert.equal(motif.material.color.getHexString(),'292e38');
    const outline=entry.model.children.find(object=>object.isInstancedMesh);
    assert.equal(outline.material.color.getHexString(),'f8eedb');
    assert.equal(outline.material.alphaMap,motif.material.alphaMap);
    assert.equal(catalog.get('decals',value,'hotrod'),entry);
  }
  assert.equal(catalog.size,4);catalog.dispose();
});

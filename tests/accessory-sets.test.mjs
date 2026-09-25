import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {normalizeBuild,normalizePaint,selectBuildOption,WING_TYPES,LIGHT_TYPES,DECAL_TYPES} from '../src/customization.mjs';
import {previewKey} from '../src/ui/preview-cache.mjs';

const bundle=await build({
  stdin:{contents:"export * as THREE from 'three';export {GLTFLoader} from './vendor/GLTFLoader.js';export {makeTruckAddons} from './src/truck-addons.mjs';export {getBodyMounts} from './src/models/vehicle-mounts.mjs';export * from './src/models/body-decor.mjs';",resolveDir:fileURLToPath(new URL('../',import.meta.url))},
  bundle:true,write:false,format:'esm',platform:'node',logLevel:'silent',alias:{three:fileURLToPath(new URL('../vendor/three.module.js',import.meta.url))},
});
const {THREE,GLTFLoader,makeTruckAddons,getBodyMounts,prepareBodyDecor,decalMask,isLegacyGraphic}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].contents).toString('base64'));
const bytes=readFileSync(new URL('../assets/truck-library-v2.glb',import.meta.url));
const library=(await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'')).scene;

test('Alte Anbauteil-Schalter migrieren; Varianten und Dekorfarbe bleiben beim Speichern stabil',()=>{
  const migrated=normalizeBuild({wing:true,lights:true,pipes:false});
  assert.equal(migrated.wing,'stunt');assert.equal(migrated.lights,'pods');assert.equal(migrated.pipes,true);
  for(const wing of WING_TYPES)for(const lights of LIGHT_TYPES)for(const decals of DECAL_TYPES){
    const setup=normalizeBuild({wing,lights,decals,engine:'electric'});
    assert.deepEqual(normalizeBuild(JSON.parse(JSON.stringify(setup))),setup);assert.equal(setup.pipes,false);
    assert.deepEqual([setup.wing,setup.lights,setup.decals],[wing,lights,decals]);
  }
  const paint=normalizePaint({body:'#ffffff',decals:'#e82846',wheels:'#292e38'});
  assert.equal(paint.decals,'#e82846');assert.equal(paint.body,'#ffffff');
});

test('Sieben Kategorien, keine Auspuff- oder Ohne-Karte; erneuter Tipp baut Anbauteile ab',()=>{
  const html=readFileSync(new URL('../src/page.html',import.meta.url),'utf8');
  assert.deepEqual([...html.matchAll(/data-workshop-tab="([^"]+)"/g)].map(m=>m[1]),['body','wheels','lift','wing','lights','decals','engine']);
  assert.ok(!html.includes('data-build="pipes"'));assert.ok(!html.includes('data-value="none"'));
  for(const part of ['wing','lights','decals']){
    const value={wing:'sport',lights:'round',decals:'flames'}[part],selected=selectBuildOption(normalizeBuild(),part,value);
    assert.equal(selected[part],value);assert.equal(selectBuildOption(selected,part,value)[part],'none');
    assert.equal(selectBuildOption(selectBuildOption(selected,part,value),part,value)[part],value);
  }
  const body=selectBuildOption(normalizeBuild(),'body','pickup');assert.equal(body.body,'pickup');
  for(const [part,values] of [['wing',WING_TYPES],['lights',LIGHT_TYPES],['decals',DECAL_TYPES]]){
    const actual=[...html.matchAll(new RegExp('data-build="'+part+'" data-value="([^"]+)"','g'))].map(m=>m[1]);
    assert.deepEqual(actual,values.filter(value=>value!=='none'));
  }
});

test('Alle neuen Spoiler und Lampen haben reale unterschiedliche Formen und dieselben montierten Füße',()=>{
  for(const body of ['pickup','van','buggy','hotrod'])for(const [part,values] of [['wing',WING_TYPES],['lights',LIGHT_TYPES]]){
    const kit=makeTruckAddons(),mounts=getBodyMounts(library,body),shapes=new Set();
    for(const value of values.filter(value=>value!=='none')){
      kit.setBuild({body,[part]:value},mounts);
      assert.equal(kit[part].visible,true);
      assert.equal(kit[part].userData.footPlates.length,2);
      const counts=[];kit[part].traverse(m=>{if(m.isMesh)counts.push(m.geometry.attributes.position.count);});
      shapes.add(JSON.stringify([counts,new THREE.Box3().setFromObject(kit[part]).getSize(new THREE.Vector3()).toArray()]));
      const geometry=kit[part].children[0].geometry;
      kit.setBuild({body,[part]:value},mounts);
      assert.equal(kit[part].children[0].geometry,geometry,'reselecting does not rebuild');
    }
    assert.equal(shapes.size,3);
    kit.setBuild({[part]:'none'},mounts);assert.equal(kit[part].visible,false);
  }
});

test('Vier wiederverwendete Dekormasken sind verschieden und lassen freie Lackflächen',()=>{
  const hashes=new Set();
  for(const kind of DECAL_TYPES.filter(value=>value!=='none')){
    const texture=decalMask(kind);assert.equal(decalMask(kind),texture);
    const data=texture.image.data;let covered=0,total=0,hash=0;
    for(let i=0;i<data.length;i+=4){if(data[i]>0)covered++;total++;hash=(hash*31+data[i])|0;}
    assert.ok(covered>total*.08&&covered<total*.70);hashes.add(hash);
  }
  assert.equal(hashes.size,4);
});

test('Dekore verändern weder GLB-Vorlagen noch Blinker und reagieren unabhängig auf Farbe und Motiv',()=>{
  for(const body of ['pickup','van','buggy','hotrod']){
    const source=library.getObjectByName('DR2_Body_'+body),model=source.clone(true),original=new Map();
    source.traverse(m=>{if(m.isMesh)original.set(m,m.geometry);});
    const decor=prepareBodyDecor(model,body);decor.setStyle('flames');decor.setPaint('#ae82dc');
    assert.ok(decor.materials.length>0);
    const shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <color_fragment>'};
    decor.materials[0].onBeforeCompile(shader);
    assert.equal(shader.uniforms.drDecalMap.value,decalMask('flames'));
    assert.equal(shader.uniforms.drDecalColor.value.getHexString(),'ae82dc');
    decor.setPaint('#e82846');assert.equal(shader.uniforms.drDecalColor.value.getHexString(),'e82846');
    decor.setStyle('none');assert.equal(shader.uniforms.drDecalMap.value,decalMask('none'));
    const blank=shader.uniforms.drDecalMap.value.image.data;
    for(let i=0;i<blank.length;i+=4)assert.equal(blank[i],0,'no side or hood decoration remains');
    decor.setStyle('tribal');assert.equal(shader.uniforms.drDecalMap.value,decalMask('tribal'));
    assert.equal(shader.uniforms.drDecalColor.value.getHexString(),'e82846','removing preserves the chosen color');
    for(const [mesh,geometry] of original)assert.equal(mesh.geometry,geometry);
    const oldOrange=[...original.keys()].find(m=>m.material.name.includes('Orange'));
    const orange=model.getObjectByName(oldOrange.name);
    assert.ok(orange.geometry.index.count>0&&orange.geometry.index.count<oldOrange.geometry.index.count);
    const p=orange.geometry.attributes.position,indices=orange.geometry.index;
    for(let i=0;i<indices.count;i+=3){
      assert.ok(![0,1,2].every(j=>{const n=indices.getX(i+j);return isLegacyGraphic(p.getX(n),p.getY(n),p.getZ(n),body);}));
    }
    decor.dispose();
  }
  assert.equal(isLegacyGraphic(.78,.16,1.97,'pickup'),false,'front indicator');
  assert.equal(isLegacyGraphic(.71,.06,-2.02,'pickup'),false,'rear indicator');
  assert.equal(isLegacyGraphic(.29,.35,-.3,'buggy'),false,'seat harness');
});

test('Vorschauschlüssel berücksichtigen Dekor, Hauptfarbe und Karosserie ohne fremde Änderungen',()=>{
  const build=normalizeBuild(),paint=normalizePaint();
  assert.notEqual(previewKey('body','pickup',build,paint),previewKey('body','pickup',{...build,decals:'flames'},paint));
  assert.notEqual(previewKey('body','pickup',build,paint),previewKey('body','pickup',{...build,decals:'none'},paint));
  assert.equal(previewKey('decals','flames',build,paint),previewKey('decals','flames',{...build,body:'van'},{...paint,body:'#ffffff'}));
  assert.notEqual(previewKey('decals','flames',build,paint),previewKey('decals','flames',build,{...paint,decals:'#ffffff'}));
  assert.equal(previewKey('wing','sport',build,paint),previewKey('wing','sport',{...build,decals:'flames'},paint));
});

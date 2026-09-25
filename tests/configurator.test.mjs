import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizePaint,DEFAULT_PAINT,normalizeBuild,isPartAvailable} from '../src/customization.mjs';
import {Race} from '../src/simulation.mjs';
import {stepPlanar,SPEEDS} from '../src/physics.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Elektro-Auspuff ist erkennbar nicht verfügbar, die gespeicherte Verbrennerauswahl bleibt erhalten',()=>{
  const build=normalizeBuild({engine:'electric',pipes:true,wing:true});
  assert.equal(isPartAvailable('pipes',build),false);assert.equal(build.pipes,true);
  assert.equal(isPartAvailable('wing',build),true);assert.equal(isPartAvailable('lights',build),true);
  assert.equal(isPartAvailable('pipes',{...build,engine:'classic'}),true);
  assert.match(read('src/game.mjs'),/b.disabled=!isPartAvailable/);
  assert.match(read('src/game.mjs'),/String\(!b.disabled&&selected\)/);
});
test('Alle Bauteilfarben sind unabhängig und alte Lackierungen werden übernommen',()=>{
  const migrated=normalizePaint({body:'#ae82dc',accent:'#f6eacb'});
  assert.equal(migrated.body,'#ae82dc');assert.equal(migrated.wheels,'#f6eacb');
  const colors=normalizePaint({...migrated,wheels:'#14bdd1',lift:'#b9ea48',engine:'#fc593e',wing:'#ffd253'});
  assert.equal(colors.body,'#ae82dc');assert.equal(colors.wheels,'#14bdd1');
  assert.equal(colors.lift,'#b9ea48');assert.equal(colors.engine,'#fc593e');
  assert.equal(colors.wing,'#ffd253');assert.equal(colors.pipes,'#f6eacb');
  assert.deepEqual(normalizePaint(JSON.parse(JSON.stringify(colors))),colors);
  assert.deepEqual(normalizePaint({body:'url(bad)',wheels:'none'}),DEFAULT_PAINT);
});
test('Motoren unterscheiden sich beim Anfahren, nicht durch Autogas oder unbeherrschbares Tempo',()=>{
  const velocities={};
  for(const engine of ['classic','supercharged','electric']){
    const r=new Race(),c=r.player;c.engine=engine;
    for(let i=0;i<120;i++)stepPlanar(c,1/120,{throttle:0,limit:SPEEDS.arena});
    assert.equal(c.speed,0);
    for(let i=0;i<120;i++)stepPlanar(c,1/120,{throttle:1,limit:SPEEDS.arena});
    velocities[engine]=c.speed;
    for(let i=0;i<1200;i++)stepPlanar(c,1/120,{throttle:1,limit:SPEEDS.arena});
    assert.ok(c.speed<=SPEEDS.arena+.001);
    assert.equal(normalizeBuild({engine}).engine,engine);
  }
  assert.ok(velocities.supercharged>velocities.classic);
  assert.ok(velocities.electric>velocities.classic);
  assert.equal(normalizeBuild({engine:'prototype'}).engine,'classic');
});
test('Werkstatt enthält getrennte Bildkategorien, keine sichtbaren Optionstexte und ein gemeinsames Farbband',()=>{
  const html=read('src/page.html'),panel=html.match(/<section id="workshopPanel"([\s\S]*?)<\/section>/)[1];
  for(const category of ['body','wheels','lift','engine','parts'])assert.ok(panel.includes('data-workshop-tab="'+category+'"'));
  assert.ok(!panel.includes('data-workshop-tab="paint"'));
  assert.ok(!/<span>/.test(panel));
  assert.equal((html.match(/id="paintBand"/g)||[]).length,1);
  assert.equal((html.match(/data-color=/g)||[]).length,7);
  assert.ok(panel.includes('data-preview="Wheel_standard"'));
});
test('Einstellungen schließen durch Hintergrundklick; der dekorative Pause-Kopf ist entfernt',()=>{
  const html=read('src/page.html'),game=read('src/game.mjs');
  assert.match(game,/if\(e.target===e.currentTarget\)closeSettings\(\)/);
  assert.match(html,/<h2 id="settingsTitle" class="sr-only">Einstellungen<\/h2>/);
});
test('Lucide ist lokal eingebunden und seine Lizenz in der Offline-Datei enthalten',()=>{
  assert.ok(read('src/ui/icons.svg').includes('Lucide 1.47.0'));
  assert.ok(read('index.html').includes('Copyright (c) 2026 Lucide Icons'));
  assert.ok(read('vendor/LUCIDE-LICENSE.txt').includes('ISC License'));
});
test('Die Blender-Bibliothek enthält genau vier Karosserien, vier Reifen und drei Motoren',()=>{
  const data=readFileSync(new URL('../assets/truck-library-v2.glb',import.meta.url));
  assert.equal(data.readUInt32LE(0),0x46546c67);
  const length=data.readUInt32LE(12),gltf=JSON.parse(data.subarray(20,20+length).toString('utf8'));
  assert.equal(gltf.nodes.length,11);
  for(const name of ['Body_pickup','Body_buggy','Body_van','Body_hotrod','Wheel_standard','Wheel_giant','Wheel_sand','Wheel_street','Engine_classic','Engine_supercharged','Engine_electric']){
    assert.ok(gltf.nodes.some(n=>n.name==='DR2_'+name),name);
  }
  assert.ok(!gltf.nodes.some(n=>n.name==='Cube'));
  const triangleCount=gltf.meshes.flatMap(m=>m.primitives).reduce((sum,p)=>sum+gltf.accessors[p.indices].count/3,0);
  // Library budget includes mutually exclusive alternatives, not eleven active models.
  assert.ok(triangleCount<110000,triangleCount);
  assert.ok(data.length<3600000,data.length);
  assert.ok(read('index.html').includes(data.toString('base64')));
});

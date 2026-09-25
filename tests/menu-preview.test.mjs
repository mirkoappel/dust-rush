import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from '../vendor/three.module.js';
import {captureMenuView,restoreMenuView} from '../src/menu-preview.mjs';

const point=(car,p)=>new Vector3(car.x+Math.cos(car.heading)*p.x+Math.sin(car.heading)*p.z,car.y+p.y,car.z-Math.sin(car.heading)*p.x+Math.cos(car.heading)*p.z);
function fixture(player,aspect){
  const world={race:{mode:'menu',player},camera:new PerspectiveCamera(52,aspect,.1,800),smoothedTarget:new Vector3(),clock:37,cameraInitialized:true};
  world.camera.position.copy(point(player,{x:8.1,y:4.3,z:8.5}));
  world.smoothedTarget.copy(point(player,{x:-2.1,y:1.2,z:0}));
  world.camera.lookAt(world.smoothedTarget);world.camera.updateMatrixWorld();
  return world;
}
const close=(a,b)=>assert.ok(a.distanceTo(b)<1e-10,JSON.stringify({a:a.toArray(),b:b.toArray()}));

test('Rennen, Arena und Werkstatt behalten die Truck-Projektion in Hoch- und Querformat',()=>{
  for(const aspect of [16/9,390/844]){
    const race=fixture({x:-35,y:0,z:170,heading:1.17},aspect);
    const arena=fixture({x:0,y:0,z:-67,heading:0},aspect);
    const markers=[{x:0,y:1,z:0},{x:1.2,y:0,z:1.6},{x:-1.2,y:0,z:-1.6},{x:0,y:2.2,z:0}];
    const projected=markers.map(p=>point(race.race.player,p).project(race.camera));
    for(const [from,to] of [[race,arena],[arena,race],[race,race],[race,arena],[arena,race]]){
      const snapshot=captureMenuView(from);
      to.cameraInitialized=false;to.clock=0;
      restoreMenuView(to,snapshot);to.camera.updateMatrixWorld();
      assert.equal(to.clock,37);assert.equal(to.cameraInitialized,true);assert.equal(to.camera.fov,52);
      markers.forEach((p,i)=>close(point(to.race.player,p).project(to.camera),projected[i]));
    }
  }
});

test('Kamerazustand ist eine unabhängige Momentaufnahme und verändert keine Fahrzeugposition',()=>{
  const source=fixture({x:-21,y:0,z:94,heading:-.7},1.6),target=fixture({x:0,y:.4,z:-67,heading:Math.PI},1.6);
  const view=captureMenuView(source),copy=structuredClone(view),player=structuredClone(target.race.player);
  source.camera.position.set(0,0,0);source.smoothedTarget.set(0,0,0);source.clock=90;
  restoreMenuView(target,view);
  assert.deepEqual(view,copy);assert.deepEqual(target.race.player,player);
  const restored=captureMenuView(target);
  close(new Vector3(...Object.values(restored.position)),new Vector3(...Object.values(copy.position)));
  assert.equal(target.clock,37);
});

test('Menüübernahme greift niemals in eine Fahrt oder eine noch nicht vorbereitete Kamera ein',()=>{
  const world=fixture({x:0,y:0,z:0,heading:0},1.6);
  const view=captureMenuView(world),position=world.camera.position.clone();
  world.race.mode='racing';world.clock=12;
  assert.equal(captureMenuView(world),null);restoreMenuView(world,view);
  close(world.camera.position,position);assert.equal(world.clock,12);
  world.race.mode='menu';world.cameraInitialized=false;
  assert.equal(captureMenuView(world),null);restoreMenuView(world,null);
  assert.equal(world.cameraInitialized,false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createInspection} from '../src/ui/inspection.mjs';
import {buildGeometry,WHEEL_TYPES,LIFT_HEIGHTS,normalizeBuild} from '../src/customization.mjs';

test('Vier unterschiedliche Reifen und drei unabhängige Fahrwerkshöhen werden gespeichert',()=>{
  assert.equal(Object.keys(WHEEL_TYPES).length,4);
  assert.equal(Object.keys(LIFT_HEIGHTS).length,3);
  const radii=new Set();
  for(const wheels of Object.keys(WHEEL_TYPES)){
    let radius;
    for(const lift of Object.keys(LIFT_HEIGHTS)){
      const value={wheels,lift},saved=normalizeBuild(JSON.parse(JSON.stringify(value))),setup=buildGeometry(saved);
      assert.equal(saved.wheels,wheels);assert.equal(saved.lift,lift);
      assert.equal(setup.bodyLift,LIFT_HEIGHTS[lift]);
      assert.ok(Math.abs(.685+setup.groundLift-setup.wheelRadius)<1e-10);
      if(radius!==undefined)assert.equal(setup.wheelRadius,radius);
      radius=setup.wheelRadius;
    }
    radii.add(radius);
  }
  assert.equal(radii.size,4);
  assert.ok(LIFT_HEIGHTS.extraHigh>LIFT_HEIGHTS.high&&LIFT_HEIGHTS.high>LIFT_HEIGHTS.normal);
});

test('Werkstatt bleibt frei drehbar; Truck-Tap wechselt nur den Abstand und Teilefokus bleibt erhalten',t=>{
  class Target{
    events=new Map();
    addEventListener(type,fn){const list=this.events.get(type)||[];list.push(fn);this.events.set(type,list);}
    setPointerCapture(){}
    send(type,props={}){for(const fn of this.events.get(type)||[])fn({pointerId:1,clientX:100,clientY:100,preventDefault(){},...props});}
  }
  const previousDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),previousWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  const canvas=new Target(),open=new Target(),close=new Target(),keys=new Target(),world={inspection:null,pickTruck:()=>true};
  Object.defineProperty(globalThis,'document',{value:{getElementById:id=>id==='inspectTruck'?open:close,querySelectorAll:()=>[]},configurable:true});
  Object.defineProperty(globalThis,'window',{value:keys,configurable:true});
  t.after(()=>{
    if(previousDocument)Object.defineProperty(globalThis,'document',previousDocument);else delete globalThis.document;
    if(previousWindow)Object.defineProperty(globalThis,'window',previousWindow);else delete globalThis.window;
  });
  let workshop=true;
  const inspection=createInspection({canvas,getWorld:()=>world,isWorkshop:()=>workshop,onChange(){}});
  const tap=()=>{canvas.send('pointerdown');canvas.send('pointerup');};
  inspection.set(true);assert.equal(inspection.active,true);const initial=world.inspection.yaw,nearDistance=world.inspection.distance;
  tap();assert.equal(inspection.active,true);assert.ok(world.inspection.distance>nearDistance);
  tap();assert.equal(world.inspection.distance,nearDistance);
  canvas.send('pointerdown');canvas.send('pointermove',{clientX:180});canvas.send('pointerup',{clientX:180});
  assert.equal(inspection.active,true);assert.notEqual(world.inspection.yaw,initial);
  canvas.send('pointerdown');canvas.send('pointerdown',{pointerId:2,clientX:160});canvas.send('pointerup',{pointerId:2,clientX:160});canvas.send('pointerup');
  assert.equal(inspection.active,true);
  canvas.send('pointerdown');canvas.send('pointercancel');canvas.send('pointerup');assert.equal(inspection.active,true);
  world.pickTruck=()=>false;tap();assert.equal(inspection.active,true);
  world.pickTruck=()=>true;tap();assert.equal(inspection.active,true);assert.ok(world.inspection.distance>nearDistance);
  inspection.focus('engine');assert.equal(world.inspection.focus,'engine');assert.equal(world.inspection.distance,3.8);
  canvas.send('pointerdown');canvas.send('pointermove',{clientX:150});canvas.send('pointerup',{clientX:150});
  const motorAngle=world.inspection.yaw;inspection.focus('engine');assert.equal(world.inspection.yaw,motorAngle);
  inspection.focus('wheels');assert.equal(world.inspection.focus,'wheels');assert.ok(world.inspection.distance<nearDistance);
  close.send('click');assert.equal(world.inspection.focus,'truck');assert.equal(inspection.active,true);
  inspection.set(false);assert.equal(inspection.active,false);assert.equal(world.inspection,null);
  workshop=false;tap();assert.equal(inspection.active,false);
});

test('Konfigurator bleibt beim Zoom sichtbar und das Farbband enthält nur Farbfelder',()=>{
  const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
  const page=read('src/page.html'),game=read('src/game.mjs'),css=read('style.css');
  assert.equal((page.match(/data-build="wheels"/g)||[]).length,4);
  assert.equal((page.match(/data-build="lift"/g)||[]).length,3);
  const band=page.match(/<section id="paintBand"([\s\S]*?)<\/section>/)[1];
  assert.equal((band.match(/data-color=/g)||[]).length,7);
  assert.ok(!band.includes('<svg'));assert.ok(!game.includes('paintTargetIcon'));
  assert.ok(game.includes("$('workshopPanel').hidden=!inWorkshop;"));
  assert.ok(game.includes("$('paintBand').hidden=!inWorkshop;"));
  assert.ok(game.includes('inspection.set(show);'));
  assert.ok(game.includes('inspection.focus(colorTarget)'));
  assert.ok(!css.includes('body[data-inspect="true"] .garage{display:none}'));
  assert.match(css,/\.workshop-tabs \.symbol\{[^}]*color:#fff/);
});

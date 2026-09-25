import test from 'node:test';
import assert from 'node:assert/strict';
import {createDebugTuning} from '../src/ui/debug-tuning.mjs';
import {NITRO} from '../src/driving-input.mjs';
import {CAMERA_TUNING,createDrivingCameraMotion} from '../src/driving-camera.mjs';

function fixture(cameraOverrides={}){
  const entries={launch:[25,160],speed:[0,14],duration:[1,10],lag:[0,150],gap:[1,16]};
  const fields=Object.entries(entries).map(([name,[min,max]])=>({dataset:{tuning:name},min,max,value:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}}));
  const outputs=Object.fromEntries(Object.keys(entries).map(name=>[name,{textContent:''}]));
  const panel={hidden:true,querySelectorAll:()=>fields,querySelector:selector=>outputs[selector.match(/"([^"]+)"/)[1]]};
  const button=()=>({listeners:{},attributes:{},addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(name,value){this.attributes[name]=value;}});
  const toggle=button(),resetButton=button(),nitro={...NITRO},camera={...CAMERA_TUNING,...cameraOverrides};let opens=0;
  const tuning=createDebugTuning({panel,toggle,resetButton,nitro,camera,onOpen:()=>opens++});
  const set=(name,value)=>{const field=fields.find(field=>field.dataset.tuning===name);field.value=String(value);field.listeners.input();};
  return {nitro,camera,panel,toggle,resetButton,outputs,tuning,set,get opens(){return opens;}};
}

test('Config verändert die wirksamen Nitro- und Kamera-Werte sofort und setzt sie zurück',()=>{
  const f=fixture(),defaults={nitro:{...f.nitro},camera:{...f.camera}};
  assert.equal(f.panel.hidden,true);
  assert.equal(f.outputs.launch.textContent,'50 %');
  assert.equal(f.outputs.speed.textContent,'+31 km/h');
  f.toggle.listeners.click();assert.equal(f.tuning.open,true);assert.equal(f.opens,1);
  f.set('launch',25);
  assert.equal(f.nitro.power,1);
  assert.equal(f.nitro.forwardGrip,1);
  f.set('speed',14);f.set('duration',8);f.set('lag',150);f.set('gap',16);
  assert.equal(f.nitro.speedGain,14);assert.equal(f.nitro.duration,8);
  assert.ok(Math.abs(f.camera.boostFollowFrequency-.1)<1e-12);
  assert.equal(f.camera.maxBoostGap,16);
  assert.equal(f.outputs.gap.textContent,'16 m');
  f.set('lag',100);assert.ok(Math.abs(f.camera.boostFollowFrequency-.2)<1e-12);
  f.resetButton.listeners.click();assert.deepEqual(f.nitro,defaults.nitro);assert.deepEqual(f.camera,defaults.camera);
  f.toggle.listeners.click();assert.equal(f.tuning.open,false);
  assert.equal(f.toggle.attributes['aria-expanded'],'false');
});

test('Erweiterter Kameranachlauf zeigt den tatsächlichen Wert beim Öffnen',()=>{
  const f=fixture({boostFollowFrequency:.1});
  assert.equal(f.outputs.lag.textContent,'150 %');
});

test('Bereits erzeugte Fahrkamera liest neue Nachlaufwerte ohne Neustart',()=>{
  const c=createDrivingCameraMotion(),previous={...CAMERA_TUNING};
  try{
    c.step(1/60,{speed:10});
    CAMERA_TUNING.maxBoostGap=16;CAMERA_TUNING.boostFollowFrequency=.1;
    let max=0;
    for(let i=1;i<=240;i++)max=Math.max(max,c.step(1/60,{boosting:true,speed:10+Math.min(i/60*4,8)}).distanceOffset);
    assert.ok(max>previous.maxBoostGap&&max<16,{max});
  }finally{Object.assign(CAMERA_TUNING,previous);}
});

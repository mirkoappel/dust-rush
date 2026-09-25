import test from 'node:test';
import assert from 'node:assert/strict';
import {createDebugTuning} from '../src/ui/debug-tuning.mjs';
import {NITRO} from '../src/driving-input.mjs';
import {CAMERA_TUNING,createDrivingCameraMotion} from '../src/driving-camera.mjs';

function fixture(){
  const entries={launch:[50,160],speed:[0,8.5],duration:[1,10],lag:[0,100],gap:[1,10]};
  const fields=Object.entries(entries).map(([name,[min,max]])=>({dataset:{tuning:name},min,max,value:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;}}));
  const outputs=Object.fromEntries(Object.keys(entries).map(name=>[name,{textContent:''}]));
  const panel={hidden:true,querySelectorAll:()=>fields,querySelector:selector=>outputs[selector.match(/"([^"]+)"/)[1]]};
  const button=()=>({listeners:{},attributes:{},addEventListener(type,fn){this.listeners[type]=fn;},setAttribute(name,value){this.attributes[name]=value;}});
  const toggle=button(),resetButton=button(),nitro={...NITRO},camera={...CAMERA_TUNING};let opens=0;
  const tuning=createDebugTuning({panel,toggle,resetButton,nitro,camera,onOpen:()=>opens++});
  const set=(name,value)=>{const field=fields.find(field=>field.dataset.tuning===name);field.value=String(value);field.listeners.input();};
  return {nitro,camera,panel,toggle,resetButton,outputs,tuning,set,get opens(){return opens;}};
}

test('Config verändert die wirksamen Nitro- und Kamera-Werte sofort und setzt sie zurück',()=>{
  const f=fixture(),defaults={nitro:{...f.nitro},camera:{...f.camera}};
  assert.equal(f.panel.hidden,true);
  assert.equal(f.outputs.speed.textContent,'+29 km/h');
  f.toggle.listeners.click();assert.equal(f.tuning.open,true);assert.equal(f.opens,1);
  f.set('launch',150);
  assert.equal(f.nitro.power,defaults.nitro.power*1.5);
  assert.equal(f.nitro.forwardGrip,defaults.nitro.forwardGrip*1.5);
  f.set('speed',7);f.set('duration',8);f.set('lag',100);f.set('gap',8);
  assert.equal(f.nitro.speedGain,7);assert.equal(f.nitro.duration,8);
  assert.ok(Math.abs(f.camera.boostFollowFrequency-.2)<1e-12);
  assert.equal(f.camera.maxBoostGap,8);
  assert.equal(f.outputs.gap.textContent,'8 m');
  f.resetButton.listeners.click();assert.deepEqual(f.nitro,defaults.nitro);assert.deepEqual(f.camera,defaults.camera);
  f.toggle.listeners.click();assert.equal(f.tuning.open,false);
  assert.equal(f.toggle.attributes['aria-expanded'],'false');
});

test('Bereits erzeugte Fahrkamera liest neue Nachlaufwerte ohne Neustart',()=>{
  const c=createDrivingCameraMotion(),previous={...CAMERA_TUNING};
  try{
    c.step(1/60,{speed:10});
    CAMERA_TUNING.maxBoostGap=8;CAMERA_TUNING.boostFollowFrequency=.2;
    let max=0;
    for(let i=1;i<=240;i++)max=Math.max(max,c.step(1/60,{boosting:true,speed:10+Math.min(i/60*4,8)}).distanceOffset);
    assert.ok(max>previous.maxBoostGap&&max<8,{max});
  }finally{Object.assign(CAMERA_TUNING,previous);}
});

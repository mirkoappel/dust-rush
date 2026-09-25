import test from 'node:test';
import assert from 'node:assert/strict';
import {joystickInput,createDrivingControls} from '../src/ui/driving-controls.mjs';
import {combineDrivingInput,pedal,stepNitro,NITRO} from '../src/driving-input.mjs';
import {stepPlanar,resetMotion,SPEEDS} from '../src/physics.mjs';
import {Race} from '../src/simulation.mjs';
const ticks=(n,fn)=>{for(let i=0;i<n;i++)fn(1/120);};
const truck=(overrides={})=>{const c={x:0,z:0,y:0,vy:0,heading:0,pitch:0,roll:0,speed:0,steering:0,air:false,...overrides};resetMotion(c);return c;};
const neutral={active:false,steer:0,forward:0,brake:0};

test('Joystick dosiert beide Achsen unabhängig mit Totzone und begrenztem sichtbaren Griff',()=>{
  let input=joystickInput(3,-3,50);assert.equal(input.forward,0);assert.equal(Math.abs(input.steer),0);
  input=joystickInput(25,-25,50);assert.ok(input.forward>.4&&input.forward<.5);assert.equal(input.forward,input.steer);
  input=joystickInput(100,-100,50);assert.equal(input.forward,1);assert.equal(input.steer,1);assert.equal(input.brake,0);assert.ok(Math.hypot(input.x,input.y)<=50.00001);
  input=joystickInput(-20,30,50);assert.ok(input.brake>.5);assert.ok(input.steer<0);assert.equal(input.forward,0);
  assert.equal(joystickInput(NaN,1,50).forward,0);
});

test('Tastatur, optionaler Neigesensor und Joystick haben eindeutige Priorität',()=>{
  const stick={active:true,forward:.4,brake:0,steer:.6};
  assert.equal(combineDrivingInput(new Set(),stick,-.7).steer,.6);
  assert.equal(combineDrivingInput(new Set(['ArrowLeft']),stick,.7).steer,-1);
  assert.equal(combineDrivingInput(new Set(),{...stick,steer:0},.7).steer,.7);
  assert.equal(combineDrivingInput(new Set(),stick).forward,.4);
  const keyboard=combineDrivingInput(new Set(['Space','ShiftLeft','KeyX','KeyC']),neutral);
  assert.equal(keyboard.forward,1);assert.equal(keyboard.brake,1);assert.equal(keyboard.handbrake,true);assert.equal(keyboard.nitro,true);
  assert.deepEqual([pedal(true),pedal(false),pedal(.3),pedal(-1),pedal(4),pedal(NaN)],[1,0,.3,0,1,0]);
});

class Element extends EventTarget{
  constructor(control){super();this.dataset={control};this.values=new Map();this.captured=new Set();this.style={setProperty:(k,v)=>this.values.set(k,v)};this.classes=new Set();this.classList={add:k=>this.classes.add(k),toggle:(k,on)=>on?this.classes.add(k):this.classes.delete(k),remove:k=>this.classes.delete(k)};}
  getBoundingClientRect(){return {width:160,height:160,left:20,top:180};}
  setPointerCapture(id){this.captured.add(id);}hasPointerCapture(id){return this.captured.has(id);}releasePointerCapture(id){this.captured.delete(id);}
  setAttribute(k,v){this.values.set(k,v);}
  pointer(type,id,x=100,y=260){this.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),{pointerId:id,clientX:x,clientY:y,pointerType:'touch',button:0}));}
}
function controls(){const stick=new Element(),handbrake=new Element('handbrake'),nitro=new Element('nitro');let enabled=true;return {stick,handbrake,nitro,disable:()=>enabled=false,control:createDrivingControls({stick,buttons:[handbrake,nitro],isEnabled:()=>enabled})};}

test('Ein Finger lenkt und gibt Gas, ein zweiter kann gleichzeitig Nitro halten',()=>{
  const {stick,nitro,control}=controls();stick.pointer('pointerdown',1);assert.equal(control.read().forward,0);
  stick.pointer('pointermove',1,125,225);assert.ok(control.read().forward>.5);assert.ok(control.read().steer>0);
  nitro.pointer('pointerdown',2);assert.equal(control.actions().nitro,true);
  stick.pointer('pointerdown',3);stick.pointer('pointerup',3);assert.equal(control.read().active,true);
  nitro.pointer('pointerup',2);assert.equal(control.actions().nitro,false);assert.equal(control.read().active,true);
  stick.pointer('pointerup',1);assert.deepEqual(control.read(),neutral);assert.equal(stick.values.get('--stick-x'),'0px');
});

test('Pointer-Abbruch, Capture-Verlust und Pause lösen alle festgehaltenen Eingaben',()=>{
  for(const event of ['pointercancel','lostpointercapture']){
    const {stick,control}=controls();stick.pointer('pointerdown',1);stick.pointer('pointermove',1,90,210);stick.pointer(event,1);assert.deepEqual(control.read(),neutral);
  }
  const {stick,handbrake,nitro,control,disable}=controls();stick.pointer('pointerdown',1);nitro.pointer('pointerdown',2);handbrake.pointer('pointerdown',3);control.reset();
  assert.deepEqual(control.read(),neutral);assert.deepEqual(control.actions(),{handbrake:false,nitro:false});assert.equal(stick.captured.size+handbrake.captured.size+nitro.captured.size,0);
  disable();stick.pointer('pointerdown',4);nitro.pointer('pointerdown',5);assert.equal(control.read().active,false);assert.equal(control.actions().nitro,false);
});

test('Halbes Gas ist langsamer als Vollgas; analoge Bremse und Rückwärtsfahrt sind dosierbar',()=>{
  const half=truck(),full=truck();ticks(1200,dt=>{stepPlanar(half,dt,{throttle:.5});stepPlanar(full,dt,{throttle:1});});
  assert.ok(half.speed>5&&half.speed<9);assert.ok(full.speed>14);
  const gentle=truck({speed:10}),hard=truck({speed:10});ticks(60,dt=>{stepPlanar(gentle,dt,{brake:.3});stepPlanar(hard,dt,{brake:1});});assert.ok(gentle.speed>hard.speed+1);
  const reverse=truck();ticks(600,dt=>stepPlanar(reverse,dt,{brake:.5}));assert.ok(reverse.speed<-.5&&reverse.speed>-SPEEDS.reverse*.6);
});

test('Handbremse lässt mehr Seitwärtsbewegung zu, hält an und aktiviert niemals Rückwärtsgas',()=>{
  const normal=truck({speed:11}),sliding=truck({speed:11});normal.vx=sliding.vx=3;
  ticks(45,dt=>{stepPlanar(normal,dt,{steer:.6});stepPlanar(sliding,dt,{steer:.6,handbrake:true});});
  assert.ok(Math.abs(sliding.lateralSpeed)>Math.abs(normal.lateralSpeed));
  ticks(1200,dt=>stepPlanar(sliding,dt,{handbrake:true,throttle:1}));assert.ok(Math.abs(sliding.speed)<.04);assert.equal(sliding.reverseHold,0);
});

test('Nitro ist begrenzt, lädt nach Pause auf und flattert leer nicht im Dauerfeuer',()=>{
  const c=truck({speed:10});ticks(360,dt=>stepNitro(c,dt,{requested:true,throttle:1}));
  assert.equal(c.nitro,0);assert.equal(c.boosting,false);assert.equal(c.nitroLocked,true);
  ticks(1800,dt=>{stepNitro(c,dt,{requested:true,throttle:1});assert.equal(c.boosting,false);});assert.equal(c.nitro,1);
  stepNitro(c,1/120,{});stepNitro(c,1/120,{requested:true,throttle:1});assert.equal(c.boosting,true);assert.ok(c.nitro<1);
});

test('Nitro schiebt nur mit Gas und Bodenkontakt, nie beim Bremsen oder im Flug',()=>{
  for(const [overrides,input] of [[{},{}],[{air:true},{throttle:1}],[{}, {throttle:1,brake:.4}],[{}, {throttle:1,handbrake:true}],[{speed:-1},{throttle:1}]]){
    const c=truck(overrides);stepNitro(c,1/120,{requested:true,...input});assert.equal(c.boosting,false);assert.equal(c.nitro,1);
  }
  const normal=truck({speed:10}),boosted=truck({speed:10});ticks(180,dt=>{stepPlanar(normal,dt,{throttle:1});stepNitro(boosted,dt,{requested:true,throttle:1});stepPlanar(boosted,dt,{throttle:1,boost:boosted.boosting});});
  assert.ok(boosted.speed>normal.speed+1);assert.ok(boosted.speed<=SPEEDS.race+NITRO.speedGain);
  assert.equal(boosted.y,0);assert.equal(boosted.vy,0);
});

test('Pause verbraucht und lädt kein Nitro; Rücksetzen schenkt keinen neuen Vorrat',()=>{
  const r=new Race(undefined,true);r.start();r.mode='racing';r.player.nitro=.4;r.player.nitroCooldown=2;r.pause();
  ticks(120,dt=>r.step(dt,{forward:1,nitro:true}));assert.equal(r.player.nitro,.4);assert.equal(r.player.nitroCooldown,2);
  r.respawn();assert.equal(r.player.nitro,.4);r.start();assert.equal(r.player.nitro,1);
});

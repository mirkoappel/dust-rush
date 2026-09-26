import test from 'node:test';
import assert from 'node:assert/strict';
import {joystickInput,createDrivingControls} from '../src/ui/driving-controls.mjs';
import {combineDrivingInput,createKeyboardNitroControl,pedal,stepNitro,NITRO} from '../src/driving-input.mjs';
import {stepPlanar,resetMotion,SPEEDS,drivetrainTopSpeed} from '../src/physics.mjs';
import {VEHICLE_PHYSICS} from '../src/vehicle-physics-profile.mjs';
import {Race} from '../src/simulation.mjs';
const ticks=(n,fn)=>{for(let i=0;i<n;i++)fn(1/120);};
const truck=(overrides={})=>{const c={x:0,z:0,y:0,vy:0,heading:0,pitch:0,roll:0,speed:0,steering:0,air:false,...overrides};resetMotion(c);return c;};
const neutral={active:false,steer:0,forward:0,brake:0};

test('Lenkregler dosiert nur horizontal; vertikales Ziehen verändert weder Lenkweg noch Pedale',()=>{
  let input=joystickInput(3,-3,50);assert.equal(input.forward,0);assert.equal(Math.abs(input.steer),0);
  input=joystickInput(25,-25,50);assert.ok(input.steer>.4&&input.steer<.5);assert.equal(input.forward,0);
  assert.deepEqual(input,joystickInput(25,1000,50));assert.equal(input.y,0);
  input=joystickInput(100,-100,50);assert.equal(input.forward,0);assert.equal(input.steer,1);assert.equal(input.brake,0);assert.equal(input.x,50);
  input=joystickInput(-20,30,50);assert.equal(input.brake,0);assert.ok(input.steer<0);assert.equal(input.forward,0);
  assert.equal(joystickInput(NaN,1,50).forward,0);
});

test('Tastatur, optionaler Neigesensor und Joystick haben eindeutige Priorität',()=>{
  const stick={active:true,forward:.4,brake:0,steer:.6};
  assert.equal(combineDrivingInput(new Set(),stick,-.7).steer,.6);
  assert.equal(combineDrivingInput(new Set(['ArrowLeft']),stick,.7).steer,-1);
  assert.equal(combineDrivingInput(new Set(),{...stick,steer:0},.7).steer,.7);
  assert.equal(combineDrivingInput(new Set(),stick).forward,0);
  assert.equal(combineDrivingInput(new Set(),stick,0,{forward:true}).forward,1);
  const up=combineDrivingInput(new Set(['ArrowUp']),neutral);
  assert.equal(up.nitro,false);assert.equal(up.forward,1);
  const down=combineDrivingInput(new Set(['ArrowDown']),neutral);
  assert.equal(down.handbrake,true);assert.equal(down.brake,0);
  const keyboard=combineDrivingInput(new Set(['Space','ShiftLeft','KeyX','KeyC']),neutral);
  assert.equal(keyboard.forward,1);assert.equal(keyboard.brake,1);assert.equal(keyboard.handbrake,true);assert.equal(keyboard.nitro,true);
  assert.deepEqual([pedal(true),pedal(false),pedal(.3),pedal(-1),pedal(4),pedal(NaN)],[1,0,.3,0,1,0]);
});

test('Pfeil hoch gibt zuerst Gas und zündet Nitro erst beim schnellen zweiten Druck',()=>{
  const trigger=createKeyboardNitroControl();
  assert.equal(trigger.press(1000),false);
  assert.equal(trigger.press(1010),false);
  trigger.release();
  assert.equal(trigger.press(1350),true);
  assert.equal(combineDrivingInput(new Set(['ArrowUp','NitroDoubleTap']),neutral).nitro,true);
  trigger.release();
  assert.equal(trigger.press(2000),false);
  trigger.release();trigger.reset();
  assert.equal(trigger.press(2050),false);
});

class Element extends EventTarget{
  constructor(control){super();this.dataset={control};this.values=new Map();this.captured=new Set();this.style={setProperty:(k,v)=>this.values.set(k,v)};this.classes=new Set();this.classList={add:k=>this.classes.add(k),toggle:(k,on)=>on?this.classes.add(k):this.classes.delete(k),remove:k=>this.classes.delete(k)};}
  getBoundingClientRect(){return this.rect||{width:160,height:72,left:20,top:180};}
  setPointerCapture(id){this.captured.add(id);}hasPointerCapture(id){return this.captured.has(id);}releasePointerCapture(id){this.captured.delete(id);}
  setAttribute(k,v){this.values.set(k,v);}
  pointer(type,id,x=100,y=260){this.dispatchEvent(Object.assign(new Event(type,{cancelable:true}),{pointerId:id,clientX:x,clientY:y,pointerType:'touch',button:0}));}
}
function controls(){const stick=new Element(),gas=new Element('forward'),handbrake=new Element('handbrake'),nitro=new Element('nitro');let enabled=true;return {stick,gas,handbrake,nitro,disable:()=>enabled=false,control:createDrivingControls({stick,buttons:[gas,handbrake,nitro],isEnabled:()=>enabled})};}

test('Ein Finger lenkt, der andere gibt unabhängig Gas; Loslassen zentriert nur die Lenkung',()=>{
  const {stick,gas,nitro,control}=controls();stick.pointer('pointerdown',1);assert.equal(control.read().forward,0);
  stick.pointer('pointermove',1,125,225);assert.equal(control.read().forward,0);assert.ok(control.read().steer>0);
  gas.pointer('pointerdown',4);assert.equal(control.actions().forward,true);
  nitro.pointer('pointerdown',2);assert.equal(control.actions().nitro,true);
  stick.pointer('pointerdown',3);stick.pointer('pointerup',3);assert.equal(control.read().active,true);
  nitro.pointer('pointerup',2);assert.equal(control.actions().nitro,false);assert.equal(control.read().active,true);
  stick.pointer('pointerup',1);assert.deepEqual(control.read(),neutral);assert.equal(stick.values.get('--stick-x'),'0px');
  assert.equal(control.actions().forward,true);gas.pointer('pointerup',4);assert.equal(control.actions().forward,false);
});

test('Pointer-Abbruch, Capture-Verlust und Pause lösen alle festgehaltenen Eingaben',()=>{
  for(const event of ['pointercancel','lostpointercapture']){
    const {stick,control}=controls();stick.pointer('pointerdown',1);stick.pointer('pointermove',1,90,210);stick.pointer(event,1);assert.deepEqual(control.read(),neutral);
  }
  const {stick,gas,handbrake,nitro,control,disable}=controls();stick.pointer('pointerdown',1);nitro.pointer('pointerdown',2);handbrake.pointer('pointerdown',3);gas.pointer('pointerdown',4);control.reset();
  assert.deepEqual(control.read(),neutral);assert.deepEqual(control.actions(),{forward:false,handbrake:false,nitro:false});assert.equal(stick.captured.size+gas.captured.size+handbrake.captured.size+nitro.captured.size,0);
  disable();stick.pointer('pointerdown',4);nitro.pointer('pointerdown',5);assert.equal(control.read().active,false);assert.equal(control.actions().nitro,false);
});

test('Tippen setzt den Lenkgriff sofort unter den Daumen; Ziehen nutzt dieselbe feste Skala',()=>{
  const {stick,control}=controls();
  stick.pointer('pointerdown',1,20,216);assert.equal(control.read().steer,-1);
  assert.ok(parseFloat(stick.values.get('--stick-x'))<0);
  stick.pointer('pointermove',1,100,216);assert.equal(control.read().steer,0);
  stick.pointer('pointermove',1,180,150);assert.equal(control.read().steer,1);
  assert.equal(stick.values.get('--stick-y'),'0px');
  stick.pointer('pointerup',1);assert.deepEqual(control.read(),neutral);
  stick.pointer('pointerdown',2,180,216);assert.equal(control.read().steer,1);
  stick.pointer('pointerup',2);assert.equal(stick.values.get('--stick-x'),'0px');
});

test('Ein Daumen kann von Gas auf Nitro und Bremse gleiten; Pause und Capture-Verlust lösen auch den Zielknopf',()=>{
  for(const finish of ['pointerup','pointercancel','lostpointercapture','reset']){
    const {gas,nitro,handbrake,control}=controls();
    gas.rect={left:200,top:250,width:92,height:92};
    nitro.rect={left:190,top:130,width:64,height:64};
    handbrake.rect={left:110,top:190,width:64,height:64};
    gas.pointer('pointerdown',1,246,296);
    gas.pointer('pointermove',1,250,220);assert.equal(control.actions().forward,true);
    gas.pointer('pointermove',1,222,162);assert.equal(control.actions().forward,false);assert.equal(control.actions().nitro,true);
    assert.equal(combineDrivingInput(new Set(),neutral,0,control.actions()).forward,1);
    gas.pointer('pointermove',1,142,222);assert.equal(control.actions().nitro,false);assert.equal(control.actions().handbrake,true);
    if(finish==='reset')control.reset();else gas.pointer(finish,1,142,222);
    assert.deepEqual(control.actions(),{forward:false,handbrake:false,nitro:false});assert.equal(gas.captured.size,0);
  }
});

test('Halbes Gas ist langsamer als Vollgas; analoge Bremse und Rückwärtsfahrt sind dosierbar',()=>{
  const half=truck(),full=truck();ticks(240,dt=>{stepPlanar(half,dt,{throttle:.5});stepPlanar(full,dt,{throttle:1});});
  assert.ok(half.speed>0);assert.ok(full.speed>half.speed+1);
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
  assert.equal(NITRO.duration,7);
  const c=truck({speed:10});ticks(420,dt=>stepNitro(c,dt,{requested:true,throttle:1}));
  assert.ok(Math.abs(c.nitro-.5)<1e-12);assert.equal(c.boosting,true);
  ticks(421,dt=>stepNitro(c,dt,{requested:true,throttle:1}));
  assert.equal(c.nitro,0);assert.equal(c.boosting,false);assert.equal(c.nitroLocked,true);
  ticks(1800,dt=>{stepNitro(c,dt,{requested:true,throttle:1});assert.equal(c.boosting,false);});assert.equal(c.nitro,1);
  stepNitro(c,1/120,{});stepNitro(c,1/120,{requested:true,throttle:1});assert.equal(c.boosting,true);assert.ok(c.nitro<1);
});

test('Nach Loslassen lässt sich Nitro schon mit kleinem Vorrat erneut zünden',()=>{
  for(const charge of [.01,.05,.1,.24]){
    const c=truck({nitro:charge,nitroLocked:true,speed:6});
    stepNitro(c,1/120,{});
    assert.equal(c.nitroLocked,false);
    const recharged=c.nitro;
    stepNitro(c,1/120,{requested:true,throttle:1});
    assert.equal(c.boosting,true);assert.ok(c.nitro<recharged);
  }
});

test('Kombinierte Driftbremse wartet auf Stillstand, fährt dann rückwärts und löst beim Loslassen',()=>{
  const c=truck({speed:9});let stoppedAt=null,reversedAt=null;
  for(let i=0;i<1200;i++){
    stepPlanar(c,1/120,{driftBrake:true,throttle:1});
    if(stoppedAt===null&&Math.hypot(c.vx,c.vz)<.2)stoppedAt=i;
    if(reversedAt===null&&c.driftReversing)reversedAt=i;
  }
  assert.ok(stoppedAt!==null&&reversedAt-stoppedAt>=53);
  assert.ok(c.speed<-.5&&c.speed>=-SPEEDS.reverse);assert.ok(c.handbrakeAmount<.01);
  stepPlanar(c,1/120,{});assert.equal(c.driftReversing,false);assert.equal(c.driftReverseHold,0);
  resetMotion(c);assert.equal(c.driftReversing,false);
});

test('Seitliches Rutschen oder Flug gilt nicht als Stillstand für die Rückwärtsumschaltung',()=>{
  for(const moving of [{air:false,vx:4,vz:0},{air:true,vx:0,vz:0}]){
    const c=truck();
    ticks(90,dt=>{Object.assign(c,moving);stepPlanar(c,dt,{driftBrake:true});assert.equal(c.driftReversing,false);});
  }
});

test('Touch-Bremse und Pfeil runter verwenden dieselbe Drift-Rückwärts-Funktion in der Simulation',()=>{
  const run=buttons=>{
    const r=new Race(undefined,true);r.start();r.mode='racing';r.cars=[r.player];r.props=[];r.mounds=[];
    const input=combineDrivingInput(new Set(buttons?[]:['ArrowDown']),neutral,0,buttons?{handbrake:true}:{});
    ticks(240,dt=>r.step(dt,input));return r.player;
  };
  const touch=run(true),keys=run(false);
  assert.ok(touch.speed<-.5);assert.equal(touch.speed,keys.speed);assert.equal(touch.driftReversing,true);
});

test('Nitro schiebt nur mit Gas und Bodenkontakt, nie beim Bremsen oder im Flug',()=>{
  for(const [overrides,input] of [[{},{}],[{air:true},{throttle:1}],[{}, {throttle:1,brake:.4}],[{}, {throttle:1,handbrake:true}],[{speed:-1},{throttle:1}]]){
    const c=truck(overrides);stepNitro(c,1/120,{requested:true,...input});assert.equal(c.boosting,false);assert.equal(c.nitro,1);
  }
  const normal=truck({speed:10}),boosted=truck({speed:10});ticks(180,dt=>{stepPlanar(normal,dt,{throttle:1});stepNitro(boosted,dt,{requested:true,throttle:1});stepPlanar(boosted,dt,{throttle:1,boost:boosted.boosting});});
  assert.ok(boosted.speed>normal.speed+.5);assert.ok(boosted.speed<=drivetrainTopSpeed(undefined,.685,NITRO.rpmReserve)+.05);
  assert.equal(boosted.y,0);assert.equal(boosted.vy,0);
});

test('Leeres Nitro gibt weiterhin normales Gas, ohne Dauerschub oder automatisches Wiederzünden',()=>{
  const input=combineDrivingInput(new Set(),neutral,0,{nitro:true});
  const c=truck({nitro:0,nitroLocked:true,speed:6});
  ticks(480,dt=>{
    stepNitro(c,dt,{requested:input.nitro,throttle:input.forward});
    stepPlanar(c,dt,{throttle:input.forward,boost:c.boosting});
    assert.equal(c.boosting,false);
  });
  assert.equal(input.forward,1);assert.ok(c.speed>10);assert.ok(c.nitro>0);
  assert.equal(combineDrivingInput(new Set(),neutral).forward,0);
});

test('Nitro-Leistungsplus bleibt über alle vier Motoren unabhängig vom normalen Antrieb regelbar',()=>{
  const previous={power:NITRO.power,forwardGrip:NITRO.forwardGrip};
  const run=engine=>{
    const normal=truck({speed:5,engine}),boosted=truck({speed:5,engine});
    normal.pedal=boosted.pedal=1;
    ticks(60,dt=>{stepPlanar(normal,dt,{throttle:1});stepPlanar(boosted,dt,{throttle:1,boost:true});});
    assert.ok(boosted.speed<=drivetrainTopSpeed(undefined,.685,NITRO.rpmReserve)+.05);
    assert.equal(normal.steering,boosted.steering);
    assert.equal(boosted.y,0);assert.equal(boosted.vy,0);
    return {normal,boosted};
  };
  try{
    assert.equal(NITRO.power,5);assert.equal(NITRO.forwardGrip,3);
    for(const engine of ['classic','injected','supercharged','electric']){
      const {normal,boosted}=run(engine);
      assert.ok(boosted.speed>normal.speed,engine);
    }
    NITRO.power=4;NITRO.forwardGrip=2.4;
    for(const engine of ['classic','injected','supercharged','electric']){
      const {normal,boosted}=run(engine);
      assert.ok(boosted.speed-5>(normal.speed-5)*1.6,engine);
    }
  }finally{Object.assign(NITRO,previous);}
});

test('Stärkerer Nitro-Vortrieb wird bei Bremsen, Drift und fehlendem Bodenkontakt vollständig verworfen',()=>{
  for(const [state,input] of [
    [{},{throttle:1,brake:1}],
    [{},{throttle:1,driftBrake:true}],
    [{air:true},{throttle:1}],
    [{groundedFraction:0},{throttle:1}],
    [{},{throttle:0}],
  ]){
    const a=truck({speed:8}),b=truck({speed:8});
    Object.assign(a,state);Object.assign(b,state);a.pedal=b.pedal=1;
    ticks(60,dt=>{stepPlanar(a,dt,input);stepPlanar(b,dt,{...input,boost:true});});
    assert.deepEqual(a,b);
  }
});

test('Nitro-Höchsttempo bleibt in beiden Welten begrenzt und Loslassen erhält eine stetige Geschwindigkeit',()=>{
  for(const limit of [SPEEDS.race,SPEEDS.arena]){
    const c=truck({speed:limit-.4});c.pedal=1;
    ticks(600,dt=>stepPlanar(c,dt,{throttle:1,boost:true,limit}));
    assert.ok(c.speed>limit+1.5&&c.speed<=limit*(1+NITRO.rpmReserve)+.05);
    const before=c.speed,beforeRpm=c.engineRpm;stepPlanar(c,1/120,{throttle:1,limit});
    assert.ok(c.speed<before&&before-c.speed<.2);
    assert.ok(beforeRpm-c.engineRpm<100);
    assert.ok(Number.isFinite(Math.hypot(c.vx,c.vz)));
  }
});

test('Erweiterte Drehzahlreserve wird nicht von der Sicherheitsgrenze abgeschnitten',()=>{
  const previous=NITRO.rpmReserve;
  try{
    NITRO.rpmReserve=.3;
    const wheelRadius=VEHICLE_PHYSICS.wheelRadiusM;
    const normalTop=drivetrainTopSpeed(VEHICLE_PHYSICS,wheelRadius),boostTop=drivetrainTopSpeed(VEHICLE_PHYSICS,wheelRadius,NITRO.rpmReserve);
    const c=truck({speed:0});c.pedal=1;
    ticks(1200,dt=>stepPlanar(c,dt,{throttle:1,boost:true}));
    assert.ok(c.speed>normalTop+2&&c.speed<=boostTop+.05);
    const before=c.speed,beforeRpm=c.engineRpm;stepPlanar(c,1/120,{throttle:1});
    assert.ok(c.speed<before&&before-c.speed<.5);
    assert.ok(c.engineRpm>VEHICLE_PHYSICS.drivetrain.redlineRpm*1.1);
    assert.ok(beforeRpm-c.engineRpm<100);
  }finally{NITRO.rpmReserve=previous;}
});

test('Pause verbraucht und lädt kein Nitro; Rücksetzen schenkt keinen neuen Vorrat',()=>{
  const r=new Race(undefined,true);r.start();r.mode='racing';r.player.nitro=.4;r.player.nitroCooldown=2;r.pause();
  ticks(120,dt=>r.step(dt,{forward:1,nitro:true}));assert.equal(r.player.nitro,.4);assert.equal(r.player.nitroCooldown,2);
  r.respawn();assert.equal(r.player.nitro,.4);r.start();assert.equal(r.player.nitro,1);
});

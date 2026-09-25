import test from 'node:test';
import assert from 'node:assert/strict';
import {screenRoll,steeringFromRoll,horizonCompensation,TiltControl} from '../src/tilt.mjs';

const rad=Math.PI/180;
// Independent physical fixture: R = Rx(screen pitch) * Rz(screen angle - roll).
// Extract W3C Z-X-Y beta/gamma from its third row. Positive roll means the
// right screen edge moves down. Screen orientation is counter-clockwise.
function pose(angle,roll,pitch=60){
  const p=pitch*rad,z=(angle-roll)*rad;
  let beta=Math.asin(Math.sin(p)*Math.cos(z))/rad;
  let gamma=Math.atan2(-Math.sin(p)*Math.sin(z),Math.cos(p))/rad;
  if(Math.abs(gamma)>90){beta=beta>=0?180-beta:-180-beta;gamma+=gamma>0?-180:180;}
  return {beta,gamma};
}
const near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-7,`${message}: ${actual} vs ${expected}`);

test('Physische Links-/Rechtsneigung ergibt in allen vier Displaylagen denselben Winkel',()=>{
  for(const angle of [0,90,180,270,-90])for(const pitch of [20,45,60,85,89,91,100])for(const roll of [-35,-15,-1,0,1,15,35]){
    const {beta,gamma}=pose(angle,roll,pitch);
    const measured=screenRoll(beta,gamma,angle);
    near(measured,roll,`angle=${angle}, pitch=${pitch}, roll=${roll}`);
    near(horizonCompensation(measured),-roll*rad,'Kamera gleicht physische Neigung aus');
    near(Math.sign(steeringFromRoll(measured)),Math.abs(roll)<=2?0:Math.sign(roll),'Lenkrichtung');
  }
});

test('Kleine Querformatbewegungen springen nicht auf die ±45°-Kameragrenze',()=>{
  for(const angle of [90,270]){
    let previous=null;
    for(let roll=-3;roll<=3;roll+=.1){
      const {beta,gamma}=pose(angle,roll,70);
      const camera=horizonCompensation(screenRoll(beta,gamma,angle));
      assert.ok(Math.abs(camera)<4*rad);
      if(previous!==null)assert.ok(Math.abs(camera-previous)<.11*rad);
      previous=camera;
    }
  }
});

test('Flache Haltung und ungültige Sensorwerte liefern keinen erfundenen Rollwinkel',()=>{
  for(const angle of [0,90,180,270]){
    for(const roll of [-30,0,30]){
      const {beta,gamma}=pose(angle,roll,5);
      assert.equal(screenRoll(beta,gamma,angle),null);
    }
  }
  for(const values of [[null,0,0],[0,null,0],[NaN,0,0],[0,Infinity,0],[0,0,NaN]])assert.equal(screenRoll(...values),null);
});

function environment(t,angle=90){
  const window=new EventTarget(),orientation=new EventTarget();
  Object.assign(window,{isSecureContext:true,DeviceOrientationEvent:class {}});
  orientation.angle=angle;
  const screen={orientation};
  for(const [key,value] of Object.entries({window,screen,DeviceOrientationEvent:window.DeviceOrientationEvent})){
    const previous=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true});
    t.after(()=>{if(previous)Object.defineProperty(globalThis,key,previous);else delete globalThis[key];});
  }
  const control=new TiltControl();
  return {control,window,orientation,sample(roll,pitch=60){
    const event=Object.assign(new Event('deviceorientation'),pose(orientation.angle,roll,pitch));
    window.dispatchEvent(event);
  }};
}

test('Displaywechsel verwirft alte Kalibrierung und wartet auf einen neuen Messwert',async t=>{
  const {control,orientation,sample}=environment(t);
  assert.equal(await control.enable(),true);
  sample(0);sample(15);assert.ok(control.read()>0);
  orientation.angle=270;orientation.dispatchEvent(new Event('change'));
  assert.equal(control.active,false);assert.equal(control.read(),0);assert.equal(control.lastRoll,0);
  sample(0);assert.equal(control.active,true);near(control.read(),0,'neue Geradeausstellung');
  sample(-15);assert.ok(control.read()<0);near(control.lastRoll,-15,'neue Bildschirmachsen');
});

test('Ein Displaywechsel ohne rechtzeitiges change-Event wird beim Sensorwert erkannt',async t=>{
  const {control,orientation,sample}=environment(t);
  await control.enable();sample(10);sample(20);
  orientation.angle=270;sample(0);
  near(control.read(),0,'nicht gegen alte Displaylage lenken');near(control.lastRoll,0,'Horizont gerade');
});

test('Ein-/Ausschalten und Fortsetzen kalibrieren nur die Lenkung, nicht den Horizont',async t=>{
  const {control,sample}=environment(t);
  await control.enable();sample(10);
  near(control.read(),0,'Startneutral');near(control.lastRoll,10,'absoluter Horizont');
  sample(20);assert.ok(control.read()>0);control.calibrate();near(control.read(),0,'Fortsetzen');
  near(control.lastRoll,20,'Kalibrierung verdreht den Horizont nicht');
  control.disable();assert.equal(control.active,false);assert.equal(control.lastRoll,0);
  await control.enable();sample(-10);near(control.read(),0,'neuer Start');near(control.lastRoll,-10,'neuer Horizont');
});

test('Flache Haltung hält kurz den letzten sicheren Winkel und läuft dann neutral aus',async t=>{
  const {control,sample}=environment(t);
  await control.enable();sample(0);sample(15);
  const last=control.lastEvent,value=control.read();sample(-30,5);
  near(control.lastRoll,15,'kein Euler-Ersatzwinkel');assert.equal(control.lastEvent,last);assert.equal(control.read(),value);
  control.lastEvent=performance.now()-1600;
  assert.equal(control.active,false);assert.equal(control.read(),0);
  control.calibrate();assert.equal(control.neutral,null);
  sample(0);near(control.read(),0,'nach Unterbrechung neu kalibriert');
});

test('Ältere Browser verwenden weiterhin window.orientation als Bildschirmwinkel',async t=>{
  const {control,window,sample}=environment(t,270);
  screen.orientation=undefined;window.orientation=-90;
  await control.enable();sample(0);sample(15);
  near(control.lastRoll,15,'Legacy-Querformat');assert.ok(control.read()>0);
});

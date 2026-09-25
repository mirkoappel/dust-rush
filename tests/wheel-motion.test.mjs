import test from 'node:test';
import assert from 'node:assert/strict';
import {MAX_VISIBLE_WHEEL_STEP,visibleWheelStep,makeWheelMotion} from '../src/wheel-motion.mjs';
import {buildGeometry} from '../src/customization.mjs';
import {SPEEDS} from '../src/physics.mjs';

test('Schwarzes Reifenprofil bleibt bei Höchsttempo in beiden Richtungen unter der Aliasing-Grenze',()=>{
  const tread=2*Math.PI/24;
  for(const wheels of ['standard','giant'])for(const fps of [20,24,30,60,120])for(const speed of [1,SPEEDS.arena,SPEEDS.race,-3.1]){
    const physical=speed/buildGeometry({wheels}).wheelRadius/fps;
    const visual=visibleWheelStep(physical);
    assert.equal(Math.sign(visual),Math.sign(speed));
    assert.ok(Math.abs(visual)<tread/2);
    assert.ok(Math.abs(visual)<=Math.abs(physical));
    assert.ok(Math.abs(Math.sin(visual*24))>.1,'Kein scheinbarer Stillstand des wiederholten Profils');
  }
});
test('Langsames Rollen und Stillstand bleiben unverändert',()=>{
  for(const angle of [0,.001,.01,.06,-.01,-.06])assert.equal(visibleWheelStep(angle),angle);
  assert.equal(visibleWheelStep(NaN),0);
  assert.ok(MAX_VISIBLE_WHEEL_STEP>0);
});
test('Pause, Neustart und lange Bildaussetzer erzeugen keine ungewollte Radbewegung',()=>{
  const motion=makeWheelMotion();assert.equal(motion.update(0,0,false),0);
  const moving=motion.update(.7,1/30,true);assert.ok(moving>0);
  assert.equal(motion.update(.7,1/30,true),moving);
  assert.equal(motion.update(1.4,1/30,false),moving);
  assert.equal(motion.update(2.1,.5,true),moving);
  assert.equal(motion.update(400,1/30,true),moving);
  assert.equal(motion.update(0,1/30,true),moving);
  assert.equal(motion.update(NaN,1/30,true),moving);
  assert.ok(motion.update(.7,1/30,true)>moving);
});
test('Radanimation hält die Richtung ohne die physikalischen Winkel zu verändern',()=>{
  for(const direction of [1,-1]){
    const motion=makeWheelMotion();motion.update(0,0,false);let previous=0,physical=0;
    for(let i=0;i<300;i++){
      physical+=direction*.75;
      const visual=motion.update(physical,1/30,true);
      assert.equal(Math.sign(visual-previous),direction);previous=visual;
    }
    assert.ok(Math.abs(physical-direction*225)<1e-9);
    assert.ok(Math.abs(previous)<Math.abs(physical));
  }
});

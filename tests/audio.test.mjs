import test from 'node:test';
import assert from 'node:assert/strict';
import {engineSoundTargets} from '../src/audio.mjs';

test('Motorton folgt Drehzahl und Last statt Fahrzeugtempo',()=>{
  const low=engineSoundTargets({engineRpm:2200,pedal:.3,speed:20});
  const high=engineSoundTargets({engineRpm:6800,pedal:.3,speed:20});
  assert.ok(high.frequency>low.frequency);assert.ok(high.filter>low.filter);
  assert.deepEqual(engineSoundTargets({engineRpm:2200,pedal:.3,speed:2}),low);
});

test('Schaltunterbrechung senkt den Motorpegel, nicht die drehzahlabhängige Tonhöhe',()=>{
  const driving=engineSoundTargets({engineRpm:4200,pedal:1,shiftTime:0});
  const shifting=engineSoundTargets({engineRpm:4200,pedal:1,shiftTime:.1});
  assert.equal(shifting.frequency,driving.frequency);assert.ok(shifting.gain<driving.gain);
});

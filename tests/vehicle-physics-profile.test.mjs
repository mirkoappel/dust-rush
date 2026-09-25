import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VEHICLE_PHYSICS_DEFAULTS,
  automaticGearRatios,
  applyVehiclePhysicsProfile,
  createVehiclePhysicsProfile,
  snapshotVehiclePhysicsProfile
} from '../src/vehicle-physics-profile.mjs';

test('Fahrzeug-Physikprofil besitzt klare Einheiten und unabhängige verschachtelte Werte',()=>{
  const a=createVehiclePhysicsProfile(),b=createVehiclePhysicsProfile();
  assert.equal(a.powerPs,1500);assert.equal(a.massKg,5000);
  assert.ok(a.throttleResponse>.29&&a.throttleResponse<.30);assert.equal(a.accelerationFalloff,2);
  assert.equal(a.drivetrain.redlineRpm,7000);assert.equal(a.drivetrain.finalRatio,32.4);assert.deepEqual(a.drivetrain.gears,automaticGearRatios(3));
  assert.equal(a.grip,.9);assert.ok(a.brakingG>.83&&a.brakingG<.84);
  assert.ok(a.brakingResponse>.08&&a.brakingResponse<.09);assert.equal(a.brakingGrip,.9);
  a.nitro.duration=8;a.suspension.stiffness=1.4;
  assert.equal(b.nitro.duration,VEHICLE_PHYSICS_DEFAULTS.nitro.duration);
  assert.equal(b.suspension.stiffness,VEHICLE_PHYSICS_DEFAULTS.suspension.stiffness);
});

test('Automatikgetriebe verteilt zwei bis sechs Gänge zwischen gleicher Start- und Endübersetzung',()=>{
  for(let count=2;count<=6;count++){
    const ratios=automaticGearRatios(count);
    assert.equal(ratios.length,count);assert.equal(ratios[0],2.65);assert.equal(ratios.at(-1),1);
    assert.ok(ratios.every((ratio,index)=>index===0||ratio<ratios[index-1]));
  }
});

test('Profil-Snapshot und Wiederherstellung erfassen alle Fahrzeugwerte',()=>{
  const profile=createVehiclePhysicsProfile(),snapshot=snapshotVehiclePhysicsProfile(profile);
  Object.assign(profile,{powerPs:2400,throttleResponse:.9,accelerationFalloff:6,massKg:6200,grip:.6,brakingG:1.1,brakingResponse:.4,brakingGrip:1.7,steering:1.3});
  Object.assign(profile.drivetrain,{redlineRpm:8500,finalRatio:26,gears:[2.8,1.7,1]});
  Object.assign(profile.suspension,{stiffness:.7,damping:1.6});
  profile.nitro.speedGain=12;profile.speed.race=20;
  applyVehiclePhysicsProfile(profile,snapshot);
  assert.deepEqual(profile,snapshot);
});

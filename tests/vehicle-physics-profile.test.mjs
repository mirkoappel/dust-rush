import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VEHICLE_PHYSICS_DEFAULTS,
  applyVehiclePhysicsProfile,
  createVehiclePhysicsProfile,
  snapshotVehiclePhysicsProfile
} from '../src/vehicle-physics-profile.mjs';

test('Fahrzeug-Physikprofil besitzt klare Einheiten und unabhängige verschachtelte Werte',()=>{
  const a=createVehiclePhysicsProfile(),b=createVehiclePhysicsProfile();
  assert.equal(a.powerPs,1500);assert.equal(a.massKg,5000);
  assert.ok(a.throttleResponse>.29&&a.throttleResponse<.30);assert.equal(a.accelerationFalloff,2);
  assert.equal(a.grip,.9);assert.ok(a.brakingG>.83&&a.brakingG<.84);
  a.nitro.duration=8;a.suspension.stiffness=1.4;
  assert.equal(b.nitro.duration,VEHICLE_PHYSICS_DEFAULTS.nitro.duration);
  assert.equal(b.suspension.stiffness,VEHICLE_PHYSICS_DEFAULTS.suspension.stiffness);
});

test('Profil-Snapshot und Wiederherstellung erfassen alle Fahrzeugwerte',()=>{
  const profile=createVehiclePhysicsProfile(),snapshot=snapshotVehiclePhysicsProfile(profile);
  Object.assign(profile,{powerPs:2400,throttleResponse:.9,accelerationFalloff:6,massKg:6200,grip:.6,brakingG:1.1,steering:1.3});
  Object.assign(profile.suspension,{stiffness:.7,damping:1.6});
  profile.nitro.speedGain=12;profile.speed.race=20;
  applyVehiclePhysicsProfile(profile,snapshot);
  assert.deepEqual(profile,snapshot);
});

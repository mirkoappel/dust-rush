import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VEHICLE_PHYSICS_DEFAULTS,
  VEHICLE_PRESETS,
  automaticGearRatios,
  applyVehiclePhysicsProfile,
  applyVehiclePreset,
  createVehiclePhysicsProfile,
  snapshotVehiclePhysicsProfile
} from '../src/vehicle-physics-profile.mjs';

test('Fahrzeug-Physikprofil besitzt klare Einheiten und unabhängige verschachtelte Werte',()=>{
  const a=createVehiclePhysicsProfile(),b=createVehiclePhysicsProfile();
  assert.equal(a.powerPs,1500);assert.equal(a.massKg,5000);assert.equal(a.wheelRadiusM,.685);
  assert.ok(a.throttleResponse>.29&&a.throttleResponse<.30);
  assert.deepEqual(a.engine,{maxTorqueNm:1900,torquePeakStartRpm:3000,torquePeakEndRpm:5000,powerRpm:5800});
  assert.equal(a.drivetrain.redlineRpm,6000);assert.equal(a.drivetrain.finalRatio,28);assert.equal(a.drivetrain.efficiency,.82);
  assert.equal(a.drivetrain.couplingType,'converter');assert.equal(a.drivetrain.driveLayout,'awd');
  assert.equal(a.drivetrain.shiftDuration,.22);assert.equal(a.drivetrain.gearHoldTime,.75);assert.equal(a.drivetrain.upshiftRatio,.9);assert.equal(a.drivetrain.downshiftRatio,.48);assert.deepEqual(a.drivetrain.gears,automaticGearRatios(3));
  assert.equal(a.grip,.9);assert.ok(a.brakingG>.83&&a.brakingG<.84);
  assert.deepEqual(a.resistance,{rollingCoefficient:.05,dragAreaM2:8,downforceAreaM2:0});
  assert.ok(a.brakingResponse>.08&&a.brakingResponse<.09);assert.equal(a.brakingGrip,.9);
  assert.equal(a.suspension.springRateKnPerM,97.5);assert.equal(a.nitro.rampTime,.6);assert.equal(a.suspension.dampingKnSPerM,8);
  a.engine.maxTorqueNm=2500;a.drivetrain.gears[0]=5;a.resistance.dragAreaM2=9;
  assert.equal(b.engine.maxTorqueNm,VEHICLE_PHYSICS_DEFAULTS.engine.maxTorqueNm);
  assert.equal(b.drivetrain.gears[0],VEHICLE_PHYSICS_DEFAULTS.drivetrain.gears[0]);
  assert.equal(b.resistance.dragAreaM2,VEHICLE_PHYSICS_DEFAULTS.resistance.dragAreaM2);
});

test('Automatikgetriebe verteilt zwei bis acht Gänge zwischen frei wählbarer erster und letzter Übersetzung',()=>{
  for(let count=2;count<=8;count++){
    const ratios=automaticGearRatios(count,4.2,.72);
    assert.equal(ratios.length,count);assert.equal(ratios[0],4.2);assert.equal(ratios.at(-1),.72);
    assert.ok(ratios.every((ratio,index)=>index===0||ratio<ratios[index-1]));
  }
});

test('Profil-Snapshot und Wiederherstellung erfassen alle Fahrzeugwerte',()=>{
  const profile=createVehiclePhysicsProfile(),snapshot=snapshotVehiclePhysicsProfile(profile);
  Object.assign(profile,{powerPs:2400,throttleResponse:.9,massKg:6200,wheelRadiusM:.4,grip:.6,brakingG:1.1,brakingResponse:.4,brakingGrip:1.7,steering:1.3});
  Object.assign(profile.engine,{maxTorqueNm:2200,powerRpm:6500});
  Object.assign(profile.drivetrain,{redlineRpm:8500,finalRatio:26,efficiency:.9,couplingType:'clutch',driveLayout:'rwd',shiftDuration:.4,gearHoldTime:1.2,upshiftRatio:.84,downshiftRatio:.4,gears:[2.8,1.7,1]});
  Object.assign(profile.suspension,{springRateKnPerM:70,dampingKnSPerM:12.8});
  Object.assign(profile.resistance,{rollingCoefficient:.08,dragAreaM2:10,downforceAreaM2:2});
  profile.nitro.rpmReserve=.25;profile.speed.race=20;
  applyVehiclePhysicsProfile(profile,snapshot);
  assert.deepEqual(profile,snapshot);
});

test('Alle Presets verwenden dasselbe vollständige Profil ohne versteckte Fahrzeugmodi',()=>{
  const profile=createVehiclePhysicsProfile();
  assert.deepEqual(Object.keys(VEHICLE_PRESETS),['compact','family','sports','suv','pickup','tractor','truck','formula','monsterBeginner','monsterSlow','monsterMedium','monster']);
  for(const key of Object.keys(VEHICLE_PRESETS)){
    assert.equal(applyVehiclePreset(profile,key),true);
    assert.ok(profile.massKg>0&&profile.powerPs>0&&profile.wheelRadiusM>0);
    assert.ok(profile.engine.maxTorqueNm>0&&profile.drivetrain.gears.length>=2);
    assert.ok(profile.drivetrain.efficiency>0&&profile.drivetrain.efficiency<=1);
    assert.ok(profile.resistance.dragAreaM2>0&&profile.resistance.downforceAreaM2>=0);
    assert.ok(profile.steering>0&&profile.steering<=1.2);
  }
  assert.equal(applyVehiclePreset(profile,'unknown'),false);
});

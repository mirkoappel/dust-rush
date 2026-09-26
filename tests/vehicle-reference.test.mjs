import test from 'node:test';
import assert from 'node:assert/strict';
import {VEHICLE_PRESETS,applyVehiclePreset,createVehiclePhysicsProfile} from '../src/vehicle-physics-profile.mjs';
import {drivetrainTopSpeed,resetMotion,stepPlanar} from '../src/physics.mjs';
import {opponentPace,opponentSpeedLimit} from '../src/simulation.mjs';

const DT=1/120;
const makeCar=(profile,speed=0)=>{
  const car={x:0,z:0,y:0,vy:0,heading:0,pitch:0,roll:0,speed,steering:0,air:false};
  resetMotion(car,profile);
  return car;
};
const preset=key=>{const profile=createVehiclePhysicsProfile();applyVehiclePreset(profile,key);return profile;};
const accelerationRun=(profile,seconds=120)=>{
  const car=makeCar(profile);
  let zeroToThirtyMph=null,zeroToHundred=null,eightyToOneTwentyStart=null,eightyToOneTwenty=null;
  for(let i=0;i<seconds/DT;i++){
    stepPlanar(car,DT,{throttle:1},profile);
    const time=i*DT;
    if(zeroToThirtyMph===null&&car.speed>=13.4112)zeroToThirtyMph=time;
    if(zeroToHundred===null&&car.speed>=100/3.6)zeroToHundred=time;
    if(eightyToOneTwentyStart===null&&car.speed>=80/3.6)eightyToOneTwentyStart=time;
    if(eightyToOneTwenty===null&&eightyToOneTwentyStart!==null&&car.speed>=120/3.6)eightyToOneTwenty=time-eightyToOneTwentyStart;
  }
  return {topKmh:car.speed*3.6,zeroToThirtyMph,zeroToHundred,eightyToOneTwenty};
};
const nitroGainKmh=(profile,seconds=5)=>{
  const normal=makeCar(profile),boosted=makeCar(profile);
  for(let i=0;i<seconds/DT;i++){
    stepPlanar(normal,DT,{throttle:1},profile);
    stepPlanar(boosted,DT,{throttle:1,boost:true},profile);
  }
  return (boosted.speed-normal.speed)*3.6;
};
const brakingDistance=(profile,startKmh=100)=>{
  const car=makeCar(profile,startKmh/3.6);let distance=0;
  for(let i=0;i<10/DT&&car.speed>.05;i++){
    const before=Math.max(0,car.speed);
    stepPlanar(car,DT,{brake:1},profile);
    distance+=(before+Math.max(0,car.speed))*.5*DT;
  }
  return distance;
};

test('Kleinwagen-Referenz liegt bei realistischen Polo-Größenordnungen',()=>{
  const profile=preset('compact'),result=accelerationRun(profile);
  assert.ok(result.zeroToHundred>9.5&&result.zeroToHundred<12,{result});
  assert.ok(result.topKmh>180&&result.topKmh<195,{result});
  assert.ok(result.eightyToOneTwenty>6&&result.eightyToOneTwenty<10,{result});
  assert.ok(brakingDistance(profile)>35&&brakingDistance(profile)<50);
});

test('Presets erzeugen aus denselben Gleichungen unterscheidbare reale Fahrzeugklassen',()=>{
  const family=accelerationRun(preset('family'));
  const sports=accelerationRun(preset('sports'));
  const suv=accelerationRun(preset('suv'));
  const pickup=accelerationRun(preset('pickup'));
  const tractor=accelerationRun(preset('tractor'));
  const truck=accelerationRun(preset('truck'));
  const formula=accelerationRun(preset('formula'));
  assert.ok(family.zeroToHundred>7&&family.zeroToHundred<11&&family.topKmh>190&&family.topKmh<220);
  assert.ok(sports.zeroToHundred>3.5&&sports.zeroToHundred<6&&sports.topKmh>280&&sports.topKmh<325);
  assert.ok(suv.zeroToHundred>7&&suv.zeroToHundred<12&&suv.topKmh>175&&suv.topKmh<205);
  assert.ok(pickup.zeroToHundred>5&&pickup.zeroToHundred<9&&pickup.topKmh>190&&pickup.topKmh<230);
  assert.equal(tractor.zeroToHundred,null);assert.ok(tractor.topKmh>45&&tractor.topKmh<65);
  assert.ok(truck.zeroToHundred>15&&truck.zeroToHundred<25&&truck.topKmh>115&&truck.topKmh<140);
  assert.ok(formula.zeroToHundred>2&&formula.zeroToHundred<4&&formula.topKmh>330&&formula.topKmh<380);
});

test('Monstertruck-Preset trifft offizielle Gewichts-, Reifen-, Leistungs- und Fahrleistungsgrößen',()=>{
  const profile=preset('monster'),result=accelerationRun(profile);
  assert.equal(profile.massKg,5443);
  assert.equal(profile.powerPs,1500);
  assert.equal(profile.wheelRadiusM,.838);
  assert.ok(result.zeroToThirtyMph>1.3&&result.zeroToThirtyMph<2.1,{result});
  assert.ok(result.topKmh>105&&result.topKmh<118,{result});
});

test('Vier Monstertruck-Presets staffeln Leistung, Tempo und Gegner-Pace nachvollziehbar',()=>{
  const beginner=preset('monsterBeginner'),slow=preset('monsterSlow'),medium=preset('monsterMedium'),fast=preset('monster');
  const beginnerRun=accelerationRun(beginner),slowRun=accelerationRun(slow),mediumRun=accelerationRun(medium),fastRun=accelerationRun(fast);
  assert.ok(beginner.powerPs<slow.powerPs&&slow.powerPs<medium.powerPs&&medium.powerPs<fast.powerPs);
  assert.ok(beginnerRun.topKmh<slowRun.topKmh&&slowRun.topKmh<mediumRun.topKmh&&mediumRun.topKmh<fastRun.topKmh,{beginnerRun,slowRun,mediumRun,fastRun});
  assert.ok(opponentPace(beginner)<opponentPace(slow)&&opponentPace(slow)<opponentPace(medium)&&opponentPace(medium)<opponentPace(fast));
  for(const profile of [beginner,slow,medium,fast]){
    const mechanicalTop=drivetrainTopSpeed(profile,profile.wheelRadiusM);
    assert.ok(opponentPace(profile)>mechanicalTop*.9&&opponentPace(profile)<mechanicalTop,{mechanicalTop,pace:opponentPace(profile)});
  }
  assert.ok(beginner.throttleResponse>slow.throttleResponse);
  assert.equal(beginner.nitro.rampTime,.8);
  assert.ok(nitroGainKmh(beginner)>12);
});

test('Gegner nutzen auf Geraden fast das Profiltempo und bremsen Kurven nicht übervorsichtig',()=>{
  const profile=preset('monsterSlow'),top=drivetrainTopSpeed(profile,profile.wheelRadiusM);
  const even=opponentSpeedLimit(profile,{bend:0,behind:0,id:1});
  const trailing=opponentSpeedLimit(profile,{bend:0,behind:1,id:1});
  const leading=opponentSpeedLimit(profile,{bend:0,behind:-1,id:1});
  const curve=opponentSpeedLimit(profile,{bend:.37,behind:0,id:1});
  assert.ok(even>top*.97&&even<top,{top,even});
  assert.ok(trailing>even&&leading<even,{leading,even,trailing});
  assert.ok(curve>top*.68,{top,curve});
});

test('Nitro ist in jedem Preset während einer vollen Ladung deutlich spürbar',()=>{
  for(const key of Object.keys(VEHICLE_PRESETS)){
    const profile=preset(key),gain=nitroGainKmh(profile);
    assert.equal(profile.nitro.power,5,key);
    assert.equal(profile.nitro.forwardGrip,3,key);
    assert.equal(profile.nitro.rpmReserve,.6,key);
    assert.equal(profile.nitro.duration,7,key);
    assert.equal(profile.nitro.recharge,6,key);
    assert.equal(profile.nitro.delay,1,key);
    assert.ok(gain>5,{key,gain});
  }
});

test('Bremsen, Kurvengrip, Abtrieb und Drift bleiben kraftbegrenzt und erzeugen keine Energie',()=>{
  const sports=preset('sports'),formula=preset('formula');
  assert.ok(brakingDistance(sports)>30&&brakingDistance(sports)<42);
  assert.ok(brakingDistance(formula)>18&&brakingDistance(formula)<30);
  const corner=downforceAreaM2=>{
    const profile=createVehiclePhysicsProfile({...formula,resistance:{...formula.resistance,downforceAreaM2}});
    const car=makeCar(profile,55);
    for(let i=0;i<120;i++)stepPlanar(car,DT,{steer:.5},profile);
    return {forward:car.speed,slip:Math.abs(car.lateralSpeed)};
  };
  const flat=corner(0),aero=corner(5);
  assert.ok(aero.forward>flat.forward&&aero.slip<flat.slip,{flat,aero});
  const drift=enabled=>{
    const car=makeCar(sports,20),before=car.vx*car.vx+car.vz*car.vz;
    for(let i=0;i<30;i++)stepPlanar(car,DT,{steer:.8,driftBrake:enabled},sports);
    return {side:Math.abs(car.lateralSpeed),energy:car.vx*car.vx+car.vz*car.vz,before};
  };
  const normal=drift(false),sliding=drift(true);
  assert.ok(sliding.side>normal.side,{normal,sliding});
  assert.ok(sliding.energy<sliding.before&&normal.energy<=normal.before,{normal,sliding});
});

test('Steigfähigkeit und Endgeschwindigkeit folgen Radkraft, Widerstand und Übersetzungsgrenze',()=>{
  const climb=(key,grade)=>{
    const profile=preset(key),car=makeCar(profile);car.pitch=-Math.atan(grade);
    for(let i=0;i<12/DT;i++)stepPlanar(car,DT,{throttle:1},profile);
    return car.speed*3.6;
  };
  assert.ok(climb('suv',.3)>35);
  assert.ok(climb('tractor',.3)>12);
  assert.ok(climb('truck',.3)>20);
  for(const key of ['compact','suv','sports','tractor','truck','formula','monster']){
    const profile=preset(key),result=accelerationRun(profile);
    assert.ok(result.topKmh<=drivetrainTopSpeed(profile,profile.wheelRadiusM)*3.6+.2,key);
  }
});

// Canonical, session-mutable vehicle physics profile.
// Values use game metres, seconds, kilograms and explicitly named UI units.
export function automaticGearRatios(count,first=2.65,top=1){
  const length=Math.max(2,Math.min(8,Math.round(count)));
  first=Math.max(.2,Number(first)||2.65);top=Math.max(.2,Number(top)||1);
  return Array.from({length},(_,index)=>Number((first*Math.pow(top/first,index/(length-1))).toFixed(4)));
}
// Keep the downshift threshold below RPM after the widest upshift.
export function automaticShiftPoints(drivetrain){
  const upshiftRatio=Math.max(.3,Math.min(1,drivetrain.upshiftRatio??.9));
  const step=Math.min(...drivetrain.gears.slice(1).map((ratio,i)=>ratio/drivetrain.gears[i]));
  const downshiftMax=Math.max(.05,Math.min(.6,Math.floor((upshiftRatio*step-.02)*100)/100));
  return {upshiftRatio,downshiftRatio:Math.max(.05,Math.min(downshiftMax,drivetrain.downshiftRatio??.48)),downshiftMax};
}
const DEFAULTS={
  massKg:5000,
  powerPs:1500,
  wheelRadiusM:.685,
  throttleResponse:1/3.4,
  grip:0.9,
  brakingG:8.2/9.81,
  brakingResponse:1/12,
  brakingGrip:0.9,
  steering:1,
  // Physical road-load inputs. The rolling coefficient is dimensionless;
  // dragAreaM2 is Cd multiplied by frontal area.
  engine:{maxTorqueNm:1900,torquePeakStartRpm:3000,torquePeakEndRpm:5000,powerRpm:5800},
  resistance:{rollingCoefficient:.05,dragAreaM2:8,downforceAreaM2:0},
  drivetrain:{idleRpm:1000,redlineRpm:6000,finalRatio:28,efficiency:.82,couplingType:'converter',couplingRpm:2600,torqueMultiplier:1.8,driveLayout:'awd',shiftDuration:.22,gearHoldTime:.75,upshiftRatio:.9,downshiftRatio:.48,gears:automaticGearRatios(3)},
  // Per wheel at the configured ride height. Spring preload balances the
  // static vehicle weight; these values govern motion around that point.
  suspension:{springRateKnPerM:97.5,dampingKnSPerM:8},
  speed:{race:15.5,arena:11.5,reverse:3.1},
  // Deliberately arcade-readable while remaining force based: Nitro raises
  // motor output and available longitudinal grip, then unlocks RPM headroom.
  nitro:{duration:5,recharge:6,delay:1,rampTime:.6,rpmReserve:.6,power:5,forwardGrip:3}
};

const copy=profile=>({
  massKg:profile.massKg,
  powerPs:profile.powerPs,
  wheelRadiusM:profile.wheelRadiusM,
  throttleResponse:profile.throttleResponse,
  grip:profile.grip,
  brakingG:profile.brakingG,
  brakingResponse:profile.brakingResponse,
  brakingGrip:profile.brakingGrip,
  steering:profile.steering,
  engine:{...profile.engine},
  resistance:{...profile.resistance},
  drivetrain:{...profile.drivetrain,gears:[...profile.drivetrain.gears]},
  suspension:{...profile.suspension},
  speed:{...profile.speed},
  nitro:{...profile.nitro}
});

export const VEHICLE_PHYSICS_DEFAULTS=Object.freeze({
  ...DEFAULTS,
  engine:Object.freeze({...DEFAULTS.engine}),
  resistance:Object.freeze({...DEFAULTS.resistance}),
  drivetrain:Object.freeze({...DEFAULTS.drivetrain,gears:Object.freeze([...DEFAULTS.drivetrain.gears])}),
  suspension:Object.freeze({...DEFAULTS.suspension}),
  speed:Object.freeze({...DEFAULTS.speed}),
  nitro:Object.freeze({...DEFAULTS.nitro})
});

export function createVehiclePhysicsProfile(overrides={}){
  return {
    ...copy(VEHICLE_PHYSICS_DEFAULTS),
    ...overrides,
    engine:{...VEHICLE_PHYSICS_DEFAULTS.engine,...overrides.engine},
    resistance:{...VEHICLE_PHYSICS_DEFAULTS.resistance,...overrides.resistance},
    drivetrain:{...VEHICLE_PHYSICS_DEFAULTS.drivetrain,...overrides.drivetrain,gears:[...(overrides.drivetrain?.gears||VEHICLE_PHYSICS_DEFAULTS.drivetrain.gears)]},
    suspension:{...VEHICLE_PHYSICS_DEFAULTS.suspension,...overrides.suspension},
    speed:{...VEHICLE_PHYSICS_DEFAULTS.speed,...overrides.speed},
    nitro:{...VEHICLE_PHYSICS_DEFAULTS.nitro,...overrides.nitro}
  };
}

export function snapshotVehiclePhysicsProfile(profile){
  return copy(profile);
}

export function applyVehiclePhysicsProfile(target,source){
  for(const key of ['massKg','powerPs','wheelRadiusM','throttleResponse','grip','brakingG','brakingResponse','brakingGrip','steering'])target[key]=source[key];
  Object.assign(target.engine,source.engine);
  Object.assign(target.resistance,source.resistance);
  Object.assign(target.drivetrain,source.drivetrain,{gears:[...source.drivetrain.gears]});
  Object.assign(target.suspension,source.suspension);
  Object.assign(target.speed,source.speed);
  Object.assign(target.nitro,source.nitro);
  return target;
}

const preset=(name,values)=>Object.freeze({name,values:Object.freeze(values)});
export const VEHICLE_PRESETS=Object.freeze({
  compact:preset('Kleinwagen',{
    massKg:1170,powerPs:95,wheelRadiusM:.31,grip:.9,brakingG:.9,brakingGrip:.95,steering:.8,
    engine:{maxTorqueNm:175,torquePeakStartRpm:1600,torquePeakEndRpm:3500,powerRpm:5500},
    resistance:{rollingCoefficient:.012,dragAreaM2:.68,downforceAreaM2:0},
    drivetrain:{idleRpm:750,redlineRpm:6500,finalRatio:4.1,efficiency:.88,couplingType:'clutch',couplingRpm:1500,torqueMultiplier:1,driveLayout:'fwd',gears:[3.77,2.1,1.32,.97,.81],upshiftRatio:.85,downshiftRatio:.42}
  }),
  family:preset('Familien-Pkw',{
    massKg:1500,powerPs:150,wheelRadiusM:.33,grip:.92,brakingG:.95,brakingGrip:1,steering:.75,
    engine:{maxTorqueNm:250,torquePeakStartRpm:1500,torquePeakEndRpm:3500,powerRpm:5500},
    resistance:{rollingCoefficient:.012,dragAreaM2:.72,downforceAreaM2:0},
    drivetrain:{idleRpm:750,redlineRpm:6500,finalRatio:4,efficiency:.89,couplingType:'clutch',couplingRpm:1500,torqueMultiplier:1,driveLayout:'fwd',gears:[3.8,2.15,1.45,1.08,.84,.68],upshiftRatio:.86,downshiftRatio:.42}
  }),
  sports:preset('Sportwagen',{
    massKg:1450,powerPs:450,wheelRadiusM:.34,grip:1.08,brakingG:1.15,brakingGrip:1.2,steering:.55,
    engine:{maxTorqueNm:550,torquePeakStartRpm:1800,torquePeakEndRpm:5000,powerRpm:6500},
    resistance:{rollingCoefficient:.014,dragAreaM2:.65,downforceAreaM2:.35},
    drivetrain:{idleRpm:850,redlineRpm:7200,finalRatio:3.7,efficiency:.9,couplingType:'clutch',couplingRpm:2200,torqueMultiplier:1,driveLayout:'rwd',gears:[3.6,2.19,1.52,1.19,.97,.81],upshiftRatio:.92,downshiftRatio:.5}
  }),
  suv:preset('SUV',{
    massKg:1600,powerPs:150,wheelRadiusM:.4,grip:.88,brakingG:.9,brakingGrip:.95,steering:.7,
    engine:{maxTorqueNm:250,torquePeakStartRpm:1500,torquePeakEndRpm:3500,powerRpm:5500},
    resistance:{rollingCoefficient:.02,dragAreaM2:.8,downforceAreaM2:0},
    drivetrain:{idleRpm:750,redlineRpm:6500,finalRatio:4,efficiency:.88,couplingType:'converter',couplingRpm:1900,torqueMultiplier:1.8,driveLayout:'awd',gears:[4.15,2.37,1.56,1.16,.86,.69],upshiftRatio:.86,downshiftRatio:.42}
  }),
  pickup:preset('Pickup / Geländewagen',{
    massKg:2400,powerPs:300,wheelRadiusM:.44,grip:.82,brakingG:.82,brakingGrip:.88,steering:.75,
    engine:{maxTorqueNm:650,torquePeakStartRpm:1600,torquePeakEndRpm:4000,powerRpm:5200},
    resistance:{rollingCoefficient:.025,dragAreaM2:1.05,downforceAreaM2:0},
    drivetrain:{idleRpm:700,redlineRpm:6000,finalRatio:4.3,efficiency:.86,couplingType:'converter',couplingRpm:2000,torqueMultiplier:1.9,driveLayout:'awd',gears:[4.7,3.13,2.1,1.67,1.29,1],upshiftRatio:.85,downshiftRatio:.4}
  }),
  tractor:preset('Traktor',{
    massKg:6500,powerPs:180,wheelRadiusM:.75,grip:1.05,brakingG:.55,brakingGrip:.8,steering:1.15,
    engine:{maxTorqueNm:750,torquePeakStartRpm:1100,torquePeakEndRpm:1600,powerRpm:2100},
    resistance:{rollingCoefficient:.05,dragAreaM2:2.5,downforceAreaM2:0},
    drivetrain:{idleRpm:650,redlineRpm:2400,finalRatio:15,efficiency:.82,couplingType:'clutch',couplingRpm:950,torqueMultiplier:1,driveLayout:'awd',gears:[5.5,3.4,2.2,1.5,1.1,.8],upshiftRatio:.9,downshiftRatio:.5}
  }),
  truck:preset('Lkw',{
    massKg:12000,powerPs:500,wheelRadiusM:.52,grip:.8,brakingG:.65,brakingGrip:.9,steering:.65,
    engine:{maxTorqueNm:2500,torquePeakStartRpm:900,torquePeakEndRpm:1400,powerRpm:1600},
    resistance:{rollingCoefficient:.008,dragAreaM2:5.5,downforceAreaM2:0},
    drivetrain:{idleRpm:550,redlineRpm:2100,finalRatio:3.1,efficiency:.86,couplingType:'clutch',couplingRpm:900,torqueMultiplier:1,driveLayout:'rwd',gears:[5.1,3.6,2.6,1.9,1.4,1],upshiftRatio:.88,downshiftRatio:.48}
  }),
  formula:preset('Formel-Rennwagen',{
    massKg:800,powerPs:1000,wheelRadiusM:.36,grip:1.65,brakingG:1.8,brakingGrip:1.8,steering:.35,
    engine:{maxTorqueNm:650,torquePeakStartRpm:6000,torquePeakEndRpm:10000,powerRpm:10500},
    resistance:{rollingCoefficient:.015,dragAreaM2:1.1,downforceAreaM2:5},
    drivetrain:{idleRpm:4000,redlineRpm:12000,finalRatio:3.2,efficiency:.92,couplingType:'clutch',couplingRpm:7000,torqueMultiplier:1,driveLayout:'rwd',gears:[3.2,2.45,1.9,1.55,1.3,1.1,.95,.84],upshiftRatio:.96,downshiftRatio:.58}
  }),
  monsterBeginner:preset('Monstertruck – Einsteiger',{
    massKg:5443,powerPs:400,wheelRadiusM:.838,throttleResponse:.75,steering:.85,
    engine:{maxTorqueNm:900,torquePeakStartRpm:1800,torquePeakEndRpm:3600,powerRpm:4400},
    drivetrain:{idleRpm:850,redlineRpm:4800,gears:[2.4,1],finalRatio:26},
    nitro:{power:5,forwardGrip:3,rpmReserve:.6,rampTime:.8}
  }),
  monsterSlow:preset('Monstertruck – langsam',{
    massKg:5443,powerPs:650,wheelRadiusM:.838,steering:.95,
    engine:{maxTorqueNm:1200,torquePeakStartRpm:2200,torquePeakEndRpm:4200,powerRpm:5100},
    drivetrain:{idleRpm:900,redlineRpm:5500,gears:[2.1,1],finalRatio:22},
    nitro:{power:5,forwardGrip:3,rpmReserve:.6,rampTime:.9}
  }),
  monsterMedium:preset('Monstertruck – mittel',{
    massKg:5443,powerPs:1000,wheelRadiusM:.838,steering:1,
    engine:{maxTorqueNm:1550,torquePeakStartRpm:2600,torquePeakEndRpm:4600,powerRpm:5600},
    drivetrain:{idleRpm:950,redlineRpm:6000,gears:[1.9,1],finalRatio:20},
    nitro:{power:5,forwardGrip:3,rpmReserve:.6,rampTime:.7}
  }),
  monster:preset('Monstertruck – schnell',{
    massKg:5443,wheelRadiusM:.838,steering:1,
    engine:{maxTorqueNm:1900,torquePeakStartRpm:3000,torquePeakEndRpm:5000,powerRpm:6000},
    drivetrain:{idleRpm:1000,redlineRpm:6500,gears:[1.76,1],finalRatio:18.4}
  })
});

export const VEHICLE_PHYSICS=createVehiclePhysicsProfile(VEHICLE_PRESETS.monster.values);

export function applyVehiclePreset(target,key){
  const selected=VEHICLE_PRESETS[key];
  if(!selected)return false;
  applyVehiclePhysicsProfile(target,createVehiclePhysicsProfile(selected.values));
  return true;
}
